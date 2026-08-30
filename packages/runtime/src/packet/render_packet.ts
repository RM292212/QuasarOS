/**
 * @quasar/runtime RenderPacket Types and Synthesizer
 *
 * Synthesizes a backend-neutral, frame-ready execution packet containing:
 * - Session identity and snapshot hash
 * - Selected active timestep index and timestamp string
 * - Active LOD bricks and texture buffer references (`scalarData` / `rawBuffer`)
 * - Validity mask byte buffers for empty-space skipping
 * - Non-uniform depth LUT float array
 * - 6-plane normalized clipping box
 * - Coordinate transformation uniforms (origin lon/lat/depth, scale, vertical exaggeration)
 * - Scalar domain min/max bounds and colormap transfer function reference
 */

import type {
  DecodedBrick,
  TransferFunctionContract,
  SpatialBoundingBox,
} from '@quasar/client';
import type { NormalizedClippingBox } from '../types.ts';
import type { DepthLookupTable } from '../coordinates/depth_lut.ts';
import type { CoordinateTransformer } from '../coordinates/transformer.ts';
import type { BrickPlanItem } from '../planning/brick_planner.ts';
import type { ResidentBrickLedger } from '../residency/resident_ledger.ts';

export interface RenderPacketBrick {
  brickKey: string;
  lodLevel: number;
  timestepIndex: number;
  brickIndices: [number, number, number]; // [bx, by, bz]
  sampleShape: [number, number, number]; // [nx, ny, nz] (e.g. [66, 66, 32])
  interiorValidShape: [number, number, number];
  haloPadding: [number, number, number];
  sampleOrigin: [number, number, number];
  spatialBounds: SpatialBoundingBox;
  normalizedBounds: {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
    minW: number;
    maxW: number;
  };
  scalarMin: number;
  scalarMax: number;
  /** Zero-copy reference to texture-ready rawBuffer */
  rawBuffer: Uint16Array;
  /** Zero-copy reference to scalar Float32Array */
  scalarData: Float32Array;
  /** Zero-copy reference to validity mask Uint8Array */
  validityMask: Uint8Array;
  isFallback: boolean;
  isResident: boolean;
}

export interface CoordinateUniforms {
  originLongitudeDeg: number;
  originLatitudeDeg: number;
  originDepthM: number;
  minLongitudeDeg: number;
  maxLongitudeDeg: number;
  minLatitudeDeg: number;
  maxLatitudeDeg: number;
  minDepthM: number;
  maxDepthM: number;
  verticalExaggeration: number;
}

export interface RenderPacket {
  packetId: string;
  frameTimestampMs: number;
  datasetId: string;
  snapshotId: string;
  visualizationProductId: string;
  productVersion: string;
  manifestSha256: string;
  timestepIndex: number;
  timestepUtc: string;
  targetLodLevel: number;
  isDegraded: boolean;
  totalBricksInVolume: number;
  activeBricksCount: number;
  bricks: RenderPacketBrick[];
  depthLutEntriesM: Float32Array;
  clippingBox: NormalizedClippingBox;
  coordinateUniforms: CoordinateUniforms;
  scalarMin: number;
  scalarMax: number;
  canonicalUnits: string;
  transferFunction?: TransferFunctionContract;
}

export interface SynthesizePacketOptions {
  datasetId: string;
  snapshotId: string;
  visualizationProductId: string;
  productVersion: string;
  manifestSha256: string;
  timestepIndex: number;
  timestepUtc: string;
  targetLodLevel: number;
  planItems: BrickPlanItem[];
  ledger: ResidentBrickLedger;
  transformer: CoordinateTransformer;
  depthLut: DepthLookupTable;
  clippingBox: NormalizedClippingBox;
  scalarMin: number;
  scalarMax: number;
  canonicalUnits: string;
  transferFunction?: TransferFunctionContract;
}

export class RenderPacketSynthesizer {
  private static _packetSequence = 0;

  /**
   * Synthesizes a complete frame-ready RenderPacket from active plan items and resident ledger.
   */
  static synthesize(options: SynthesizePacketOptions): RenderPacket {
    const packetId = `pkt_${Date.now()}_${++RenderPacketSynthesizer._packetSequence}`;
    const frameTimestampMs = Date.now();

    const activePacketBricks: RenderPacketBrick[] = [];
    let hasDegradedFallback = false;

    for (const planItem of options.planItems) {
      if (!planItem.isVisible) {
        continue;
      }

      // Check if target brick is resident
      let residentRec = options.ledger.getRecord(planItem.brickKey, 'f16');
      let isFallback = false;

      if (!residentRec || residentRec.state !== 'RESIDENT' || !residentRec.decodedBrick) {
        // Target LOD is not resident; attempt fallback parent resolution
        if (planItem.fallbackParentKey) {
          const fallbackRec = options.ledger.getRecord(planItem.fallbackParentKey, 'f16');
          if (fallbackRec && fallbackRec.state === 'RESIDENT' && fallbackRec.decodedBrick) {
            residentRec = fallbackRec;
            isFallback = true;
            hasDegradedFallback = true;
          }
        }
      }

      if (residentRec && residentRec.state === 'RESIDENT' && residentRec.decodedBrick) {
        const dec = residentRec.decodedBrick;
        activePacketBricks.push({
          brickKey: planItem.brickKey,
          lodLevel: residentRec.lodLevel,
          timestepIndex: residentRec.timestepIndex,
          brickIndices: planItem.brickIndices,
          sampleShape: dec.sampleShape,
          interiorValidShape: dec.interiorValidShape,
          haloPadding: dec.haloPadding,
          sampleOrigin: dec.sampleOrigin,
          spatialBounds: planItem.spatialBounds,
          normalizedBounds: planItem.normalizedBounds,
          scalarMin: dec.scalarMin,
          scalarMax: dec.scalarMax,
          rawBuffer: dec.rawBuffer,
          scalarData: dec.scalarData,
          validityMask: dec.validityMask,
          isFallback,
          isResident: true,
        });
      }
    }

    const bounds = options.transformer.bounds;
    const coordinateUniforms: CoordinateUniforms = {
      originLongitudeDeg: bounds.originLongitudeDeg ?? (bounds.minLongitudeDeg + bounds.maxLongitudeDeg) * 0.5,
      originLatitudeDeg: bounds.originLatitudeDeg ?? (bounds.minLatitudeDeg + bounds.maxLatitudeDeg) * 0.5,
      originDepthM: bounds.originDepthM ?? bounds.minDepthM,
      minLongitudeDeg: bounds.minLongitudeDeg,
      maxLongitudeDeg: bounds.maxLongitudeDeg,
      minLatitudeDeg: bounds.minLatitudeDeg,
      maxLatitudeDeg: bounds.maxLatitudeDeg,
      minDepthM: bounds.minDepthM,
      maxDepthM: bounds.maxDepthM,
      verticalExaggeration: options.transformer.verticalExaggeration,
    };

    const depthEntriesFloat32 = new Float32Array(options.depthLut.levels);

    return {
      packetId,
      frameTimestampMs,
      datasetId: options.datasetId,
      snapshotId: options.snapshotId,
      visualizationProductId: options.visualizationProductId,
      productVersion: options.productVersion,
      manifestSha256: options.manifestSha256,
      timestepIndex: options.timestepIndex,
      timestepUtc: options.timestepUtc,
      targetLodLevel: options.targetLodLevel,
      isDegraded: hasDegradedFallback,
      totalBricksInVolume: options.planItems.length,
      activeBricksCount: activePacketBricks.length,
      bricks: activePacketBricks,
      depthLutEntriesM: depthEntriesFloat32,
      clippingBox: { ...options.clippingBox },
      coordinateUniforms,
      scalarMin: options.scalarMin,
      scalarMax: options.scalarMax,
      canonicalUnits: options.canonicalUnits,
      transferFunction: options.transferFunction,
    };
  }
}
