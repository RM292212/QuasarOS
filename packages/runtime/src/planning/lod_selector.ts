/**
 * @quasar/runtime LOD Selector with Hysteresis
 *
 * Evaluates projected voxel screen-space footprint and computes target LOD (0, 1, 2).
 * Applies asymmetric hysteresis bands (promotion vs demotion thresholds) to eliminate
 * high-frequency LOD thrashing/oscillation during continuous camera orbit/dolly.
 *
 * Preserves all 31 non-uniform depth levels across all horizontal LOD selections.
 */

import type { MultiresolutionLevelContract } from '@quasar/client';
import type { AbstractViewState, Vector3D } from './view_state.ts';

export interface LodSelectorConfig {
  /** Target screen-space error threshold in pixels (default: 2.0 px) */
  targetScreenErrorPx?: number;
  /** Hysteresis margin factor for demotion / coarsening (e.g. 1.25 -> 25% looser before coarsening) */
  hysteresisMarginFactor?: number;
  /** Fixed vertical level count preserved at all LODs (31 levels) */
  verticalLevelsCount?: number;
}

export interface LodSelectionResult {
  /** Selected LOD level (0 = finest, 1 = intermediate, 2 = coarsest) */
  selectedLodLevel: number;
  /** Screen-space projected voxel size in pixels at current camera distance */
  projectedVoxelSizePx: number;
  /** Projected voxel sizes evaluated across all available LOD levels */
  levelProjections: {
    lodLevel: number;
    projectedSizePx: number;
    horizontalResolutionDeg: number;
  }[];
  /** Minimum Euclidean distance from camera to ROI / Brick center */
  cameraDistance: number;
  /** Indicates whether hysteresis prevented an LOD switch */
  hysteresisApplied: boolean;
}

export class LodSelector {
  private readonly _targetErrorPx: number;
  private readonly _hysteresisMargin: number;
  private readonly _availableLods: MultiresolutionLevelContract[];
  private _lastSelectedLod = -1;

  constructor(
    availableLods: MultiresolutionLevelContract[],
    config: LodSelectorConfig = {}
  ) {
    if (!availableLods || availableLods.length === 0) {
      throw new Error('LodSelector requires at least one MultiresolutionLevelContract.');
    }
    // Sort available LODs ascending by lod_level (0, 1, 2...)
    this._availableLods = [...availableLods].sort((a, b) => a.lod_level - b.lod_level);
    this._targetErrorPx = Math.max(0.1, config.targetScreenErrorPx ?? 2.0);
    this._hysteresisMargin = Math.max(1.05, config.hysteresisMarginFactor ?? 1.25);
  }

  get availableLods(): readonly MultiresolutionLevelContract[] {
    return this._availableLods;
  }

  get lastSelectedLod(): number {
    return this._lastSelectedLod;
  }

  /**
   * Resets the hysteresis state (e.g. on new snapshot or product change).
   */
  reset(): void {
    this._lastSelectedLod = -1;
  }

  /**
   * Computes projected voxel size in screen pixels given camera distance, FOV, and voxel size in volume/world units.
   *
   * Formula:
   * projected_px = (voxel_size / (2 * distance * tan(fovY / 2))) * viewportHeightPx
   */
  static calculateProjectedVoxelSize(
    voxelSpanNormalized: number,
    cameraDistance: number,
    fieldOfViewYRad: number,
    viewportHeightPx: number
  ): number {
    const safeDist = Math.max(1e-4, cameraDistance);
    const safeFov = Math.max(1e-4, Math.min(Math.PI - 1e-4, fieldOfViewYRad));
    const frustumHeightAtDist = 2.0 * safeDist * Math.tan(safeFov * 0.5);
    return (voxelSpanNormalized / frustumHeightAtDist) * viewportHeightPx;
  }

  /**
   * Selects optimal LOD for a given view state and target evaluation center (or ROI center).
   */
  selectLod(
    viewState: AbstractViewState,
    targetCenterNormalized: Vector3D = { x: 0.5, y: 0.5, z: 0.5 }
  ): LodSelectionResult {
    const camPos = viewState.cameraPositionVolume;
    const dx = camPos.x - targetCenterNormalized.x;
    const dy = camPos.y - targetCenterNormalized.y;
    const dz = camPos.z - targetCenterNormalized.z;
    const cameraDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const fovY = viewState.fieldOfViewYRad;
    const heightPx = viewState.viewport.heightPixels;
    const targetError = viewState.screenSpaceErrorThresholdPixels || this._targetErrorPx;

    const levelProjections: {
      lodLevel: number;
      projectedSizePx: number;
      horizontalResolutionDeg: number;
    }[] = [];

    // Evaluate projected voxel size for each LOD
    for (const lod of this._availableLods) {
      // Voxel normalized horizontal span roughly 1.0 / grid_shape[0] or [1]
      const gridX = lod.grid_shape[0];
      const voxelSpanNorm = 1.0 / Math.max(1, gridX);
      const projectedPx = LodSelector.calculateProjectedVoxelSize(
        voxelSpanNorm,
        cameraDistance,
        fovY,
        heightPx
      );

      levelProjections.push({
        lodLevel: lod.lod_level,
        projectedSizePx: projectedPx,
        horizontalResolutionDeg: lod.voxel_resolution_x_deg,
      });
    }

    // Determine ideal LOD: we want the coarsest LOD whose projected pixel size <= targetError,
    // or if none are <= targetError (i.e. camera is very close), select finest LOD 0.
    // If LOD 0 has projectedPx > targetError, LOD 0 is selected.
    let idealLod = this._availableLods[0].lod_level;
    for (let i = this._availableLods.length - 1; i >= 0; i--) {
      const proj = levelProjections[i];
      if (proj.projectedSizePx <= targetError) {
        idealLod = proj.lodLevel;
        break;
      }
    }

    let finalLod = idealLod;
    let hysteresisApplied = false;

    // Apply Hysteresis if we have a previously selected LOD
    if (this._lastSelectedLod !== -1 && this._lastSelectedLod !== idealLod) {
      const prevLod = this._lastSelectedLod;
      const prevProj = levelProjections.find((p) => p.lodLevel === prevLod);

      if (prevProj) {
        // Demotion to coarser LOD (e.g. 0 -> 1 or 1 -> 2)
        if (idealLod > prevLod) {
          // Only switch to coarser LOD if previous LOD is well below targetError / margin
          const demotionThreshold = targetError / this._hysteresisMargin;
          if (prevProj.projectedSizePx > demotionThreshold) {
            finalLod = prevLod;
            hysteresisApplied = true;
          }
        }
        // Promotion to finer LOD (e.g. 2 -> 1 or 1 -> 0)
        else if (idealLod < prevLod) {
          // Only switch to finer LOD if previous LOD exceeds targetError * margin
          const promotionThreshold = targetError * this._hysteresisMargin;
          if (prevProj.projectedSizePx < promotionThreshold) {
            finalLod = prevLod;
            hysteresisApplied = true;
          }
        }
      }
    }

    this._lastSelectedLod = finalLod;
    const activeProj = levelProjections.find((p) => p.lodLevel === finalLod) ?? levelProjections[0];

    return {
      selectedLodLevel: finalLod,
      projectedVoxelSizePx: activeProj.projectedSizePx,
      levelProjections,
      cameraDistance,
      hysteresisApplied,
    };
  }
}
