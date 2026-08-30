/**
 * @quasar/runtime Visibility & Required-Brick Planner
 *
 * Evaluates camera frustum and clipping box visibility against brick bounding boxes,
 * determines the set of active / required bricks for the target LOD,
 * resolves fallback parent bricks when finer LOD bricks are pending/streaming,
 * and computes 6-tier scheduling priority scores for `@quasar/client`.
 */

import type {
  BrickGeometryContract,
  BrickIdentityContract,
  BrickPayloadContract,
  MultiresolutionLevelContract,
  RequestPriorityScore,
  SpatialBoundingBox,
} from '@quasar/client';
import type { NormalizedClippingBox } from '../types.ts';
import type { CoordinateTransformer } from '../coordinates/transformer.ts';
import {
  type AbstractViewState,
  type BoundingBox3D,
  isBoundingBoxInFrustum,
} from './view_state.ts';

export interface ManifestBrickEntry {
  brick_key: string;
  geometry: BrickGeometryContract;
  identity: BrickIdentityContract;
  payload_f16?: BrickPayloadContract;
  payload_u16?: BrickPayloadContract;
}

export interface BrickPlanItem {
  brickKey: string;
  lodLevel: number;
  timestepIndex: number;
  brickIndices: [number, number, number]; // [bx, by, bz]
  spatialBounds: SpatialBoundingBox;
  normalizedBounds: {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
    minW: number;
    maxW: number;
  };
  isVisibleInFrustum: boolean;
  isIntersectingClipping: boolean;
  isVisible: boolean; // isVisibleInFrustum && isIntersectingClipping && !isEmptyOrMasked
  isEmptyOrMasked: boolean;
  cameraDistanceVolume: number;
  priority: RequestPriorityScore;
  /** Manifest metadata */
  entry: ManifestBrickEntry;
  /** Coarser fallback brick key if available */
  fallbackParentKey?: string;
}

export interface BrickPlanResult {
  targetLodLevel: number;
  timestepIndex: number;
  totalBricksEvaluated: number;
  visibleBricksCount: number;
  requiredBricks: BrickPlanItem[];
  culledBricks: BrickPlanItem[];
  fallbackResolutions: Map<string, string>; // Maps fineBrickKey -> fallbackParentKey
}

/**
 * 6-tier priority calculation helper:
 * Tier 1 (Score 900+): Visible target LOD, closest camera distance
 * Tier 2 (Score 700-899): Visible fallback coarser LOD
 * Tier 3 (Score 500-699): Visible target LOD, farther distance
 * Tier 4 (Score 300-499): Adjacent temporal timestep (pre-fetch)
 * Tier 5 (Score 100-299): Out-of-frustum target LOD (peripheral pre-fetch)
 * Tier 6 (Score 0-99): Coarser out-of-frustum / distant background
 */
export function calculate6TierPriorityScore(
  lodLevel: number,
  targetLodLevel: number,
  isVisible: boolean,
  cameraDistance: number,
  temporalDistance: number
): RequestPriorityScore {
  let baseScore = 0;

  if (temporalDistance === 0) {
    if (isVisible) {
      if (lodLevel === targetLodLevel) {
        // Tier 1 / Tier 3: Target LOD visible
        const distFactor = Math.max(0, 1.0 - Math.min(1.0, cameraDistance / 3.0));
        baseScore = 700 + distFactor * 250; // 700 to 950
      } else if (lodLevel > targetLodLevel) {
        // Tier 2: Coarser fallback visible
        const distFactor = Math.max(0, 1.0 - Math.min(1.0, cameraDistance / 3.0));
        baseScore = 600 + distFactor * 150; // 600 to 750
      } else {
        // Finer than target
        baseScore = 400;
      }
    } else {
      // Tier 5: Out of frustum same timestep
      baseScore = 150 + Math.max(0, 50 - cameraDistance * 10);
    }
  } else {
    // Tier 4 / Tier 6: Temporal pre-fetch
    const tempFactor = Math.max(0, 100 - temporalDistance * 30);
    if (isVisible) {
      baseScore = 300 + tempFactor; // Tier 4: 300 - 400
    } else {
      baseScore = 50 + tempFactor * 0.4; // Tier 6: 50 - 90
    }
  }

  // Penalize higher LODs slightly if within same tier
  baseScore -= lodLevel * 10;

  const compositeScore = Math.max(0, Math.min(1000, Math.round(baseScore)));

  return {
    lodLevel,
    isVisibleInViewport: isVisible,
    cameraDistance,
    temporalDistance,
    compositeScore,
  };
}

export class BrickPlanner {
  private readonly _manifestBricks: ManifestBrickEntry[];
  private readonly _availableLods: MultiresolutionLevelContract[];
  private readonly _transformer: CoordinateTransformer;
  private readonly _bricksByKey = new Map<string, ManifestBrickEntry>();

  constructor(
    manifestBricks: ManifestBrickEntry[],
    availableLods: MultiresolutionLevelContract[],
    transformer: CoordinateTransformer
  ) {
    this._manifestBricks = manifestBricks;
    this._availableLods = availableLods;
    this._transformer = transformer;

    for (const b of manifestBricks) {
      this._bricksByKey.set(b.brick_key, b);
    }
  }

  /**
   * Helper to find coarser fallback parent for a fine brick at given timestep.
   * e.g. For LOD 0 brick (bx, by, bz), parent at LOD 1 is (floor(bx/2), floor(by/2), floor(bz/2)).
   * If LOD 1 doesn't exist, parent at LOD 2 is (0, 0, 0).
   */
  findFallbackParentBrick(
    brick: ManifestBrickEntry,
    targetTimestep: number
  ): ManifestBrickEntry | undefined {
    const currentLod = brick.identity.lod_level;
    const parentLod = currentLod + 1;

    // Check if parent LOD exists in availableLods
    const parentLodContract = this._availableLods.find((l) => l.lod_level === parentLod);
    if (!parentLodContract) {
      // If parentLod is not available, check coarsest LOD
      const coarsest = this._availableLods[this._availableLods.length - 1];
      if (coarsest && coarsest.lod_level > currentLod) {
        return this._manifestBricks.find(
          (b) =>
            b.identity.lod_level === coarsest.lod_level &&
            b.identity.timestep_index === targetTimestep
        );
      }
      return undefined;
    }

    // Grid aggregation is 2x2x2 horizontally / vertically
    const parentBx = Math.floor(brick.identity.brick_index_x / 2);
    const parentBy = Math.floor(brick.identity.brick_index_y / 2);
    const parentBz = Math.floor(brick.identity.brick_index_z / 2);

    const parent = this._manifestBricks.find(
      (b) =>
        b.identity.lod_level === parentLod &&
        b.identity.timestep_index === targetTimestep &&
        b.identity.brick_index_x === parentBx &&
        b.identity.brick_index_y === parentBy &&
        b.identity.brick_index_z === parentBz
    );

    if (parent) {
      return parent;
    }

    // Fallback to any brick at parent LOD if single brick
    if (parentLodContract.total_brick_count === 1) {
      return this._manifestBricks.find(
        (b) =>
          b.identity.lod_level === parentLod &&
          b.identity.timestep_index === targetTimestep
      );
    }

    return undefined;
  }

  /**
   * Plans visibility, required brick set, fallback resolution, and scheduling priorities.
   */
  plan(
    targetLodLevel: number,
    currentTimestepIndex: number,
    viewState: AbstractViewState,
    normalizedClipping?: NormalizedClippingBox
  ): BrickPlanResult {
    const requiredBricks: BrickPlanItem[] = [];
    const culledBricks: BrickPlanItem[] = [];
    const fallbackResolutions = new Map<string, string>();

    const clipping = normalizedClipping ?? {
      minU: 0.0,
      maxU: 1.0,
      minV: 0.0,
      maxV: 1.0,
      minW: 0.0,
      maxW: 1.0,
    };

    // Filter bricks for current timestep
    const timestepBricks = this._manifestBricks.filter(
      (b) => b.identity.timestep_index === currentTimestepIndex
    );

    // Target LOD bricks
    const targetBricks = timestepBricks.filter(
      (b) => b.identity.lod_level === targetLodLevel
    );

    for (const entry of targetBricks) {
      const geom = entry.geometry as any;
      const bounds = geom.spatial_bounds ?? geom.spatialBounds;

      // Convert geodetic spatial bounds and min/max depth to normalized volume bounds
      const minLon = bounds.min_longitude ?? bounds.minLongitude;
      const maxLon = bounds.max_longitude ?? bounds.maxLongitude;
      const minLat = bounds.min_latitude ?? bounds.minLatitude;
      const maxLat = bounds.max_latitude ?? bounds.maxLatitude;
      const minDepth = geom.min_depth_m ?? geom.minDepthM;
      const maxDepth = geom.max_depth_m ?? geom.maxDepthM;

      const minNorm = this._transformer.geodeticToNormalized(
        {
          longitudeDeg: minLon,
          latitudeDeg: minLat,
          depthM: minDepth,
        },
        true
      );

      const maxNorm = this._transformer.geodeticToNormalized(
        {
          longitudeDeg: maxLon,
          latitudeDeg: maxLat,
          depthM: maxDepth,
        },
        true
      );

      const normalizedBounds = {
        minU: Math.min(minNorm.u, maxNorm.u),
        maxU: Math.max(minNorm.u, maxNorm.u),
        minV: Math.min(minNorm.v, maxNorm.v),
        maxV: Math.max(minNorm.v, maxNorm.v),
        minW: Math.min(minNorm.w, maxNorm.w),
        maxW: Math.max(minNorm.w, maxNorm.w),
      };

      // 1. Clipping box AABB intersection
      const isIntersectingClipping =
        normalizedBounds.maxU >= clipping.minU &&
        normalizedBounds.minU <= clipping.maxU &&
        normalizedBounds.maxV >= clipping.minV &&
        normalizedBounds.minV <= clipping.maxV &&
        normalizedBounds.maxW >= clipping.minW &&
        normalizedBounds.minW <= clipping.maxW;

      // 2. Frustum plane intersection
      const box3D: BoundingBox3D = {
        min: {
          x: normalizedBounds.minU,
          y: normalizedBounds.minV,
          z: normalizedBounds.minW,
        },
        max: {
          x: normalizedBounds.maxU,
          y: normalizedBounds.maxV,
          z: normalizedBounds.maxW,
        },
      };

      const isVisibleInFrustum = isBoundingBoxInFrustum(box3D, viewState.frustumPlanes);

      // Distance to camera in volume space
      const brickCenterX = (normalizedBounds.minU + normalizedBounds.maxU) * 0.5;
      const brickCenterY = (normalizedBounds.minV + normalizedBounds.maxV) * 0.5;
      const brickCenterZ = (normalizedBounds.minW + normalizedBounds.maxW) * 0.5;

      const camX = viewState.cameraPositionVolume.x;
      const camY = viewState.cameraPositionVolume.y;
      const camZ = viewState.cameraPositionVolume.z;

      const cameraDistance = Math.sqrt(
        (camX - brickCenterX) ** 2 +
        (camY - brickCenterY) ** 2 +
        (camZ - brickCenterZ) ** 2
      );

      const isVisible =
        isVisibleInFrustum &&
        isIntersectingClipping &&
        !geom.is_empty_or_masked;

      const priority = calculate6TierPriorityScore(
        entry.identity.lod_level,
        targetLodLevel,
        isVisible,
        cameraDistance,
        0 // temporal distance 0 for active timestep
      );

      // Resolve fallback parent
      const fallbackParent = this.findFallbackParentBrick(entry, currentTimestepIndex);
      if (fallbackParent) {
        fallbackResolutions.set(entry.brick_key, fallbackParent.brick_key);
      }

      const planItem: BrickPlanItem = {
        brickKey: entry.brick_key,
        lodLevel: entry.identity.lod_level,
        timestepIndex: entry.identity.timestep_index,
        brickIndices: [
          entry.identity.brick_index_x,
          entry.identity.brick_index_y,
          entry.identity.brick_index_z,
        ],
        spatialBounds: bounds,
        normalizedBounds,
        isVisibleInFrustum,
        isIntersectingClipping,
        isVisible,
        isEmptyOrMasked: geom.is_empty_or_masked,
        cameraDistanceVolume: cameraDistance,
        priority,
        entry,
        fallbackParentKey: fallbackParent?.brick_key,
      };

      if (isVisible) {
        requiredBricks.push(planItem);
      } else {
        culledBricks.push(planItem);
      }
    }

    // Sort required bricks by composite priority descending
    requiredBricks.sort((a, b) => b.priority.compositeScore - a.priority.compositeScore);

    return {
      targetLodLevel,
      timestepIndex: currentTimestepIndex,
      totalBricksEvaluated: targetBricks.length,
      visibleBricksCount: requiredBricks.length,
      requiredBricks,
      culledBricks,
      fallbackResolutions,
    };
  }
}
