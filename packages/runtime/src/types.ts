/**
 * @quasar/runtime Types and Interfaces
 */

import type {
  PinnedSnapshotSession,
  SpatialBoundingBox,
  VisualizationProductContract,
  CoordinateTransformContract,
} from '@quasar/client';

export type RuntimeState =
  | 'UNINITIALIZED'
  | 'DISCOVERING'
  | 'SNAPSHOT_PINNED'
  | 'MANIFEST_LOADING'
  | 'MANIFEST_READY'
  | 'STREAMING'
  | 'READY'
  | 'DEGRADED'
  | 'ERROR'
  | 'DISPOSING'
  | 'DISPOSED';

export type RuntimeEvent =
  | 'START_DISCOVERY'
  | 'PIN_SNAPSHOT'
  | 'LOAD_MANIFEST'
  | 'MANIFEST_PARSED'
  | 'START_STREAMING'
  | 'STREAMING_SETTLED'
  | 'FALLBACK_LOD_AVAILABLE'
  | 'LOD_REFINED'
  | 'VIEWPORT_CHANGED'
  | 'FATAL_ERROR'
  | 'RETRY_STREAMING'
  | 'DISPOSE'
  | 'DISPOSAL_COMPLETE';

export interface StateTransitionDetail {
  from: RuntimeState;
  to: RuntimeState;
  event: RuntimeEvent;
  timestampMs: number;
  reason?: string;
  error?: Error;
}

export type StateChangeListener = (detail: StateTransitionDetail) => void;

export interface GeodeticCoordinate {
  longitudeDeg: number;
  latitudeDeg: number;
  depthM: number;
}

export interface NormalizedVolumeCoordinate {
  u: number; // [0, 1] Longitude axis
  v: number; // [0, 1] Latitude axis
  w: number; // [0, 1] Depth axis
}

export interface LocalCartesianENU {
  eastMeters: number;
  northMeters: number;
  upMeters: number;
}

export interface BrickLocalIndexCoordinate {
  gridX: number;
  gridY: number;
  gridZ: number;
  haloOffsetX: number;
  haloOffsetY: number;
  haloOffsetZ: number;
  sampleX: number;
  sampleY: number;
  sampleZ: number;
}

export interface DepthBracket {
  lowerLevelIndex: number;
  upperLevelIndex: number;
  lowerDepthM: number;
  upperDepthM: number;
  interpolationFraction: number; // 0.0 at lowerDepthM, 1.0 at upperDepthM
  isExactLevel: boolean;
  exactLevelIndex?: number;
}

export interface TimestepMetadata {
  index: number;
  timeUtc: string;
  epochMs: number;
  stepName: string;
}

export interface TemporalState {
  currentIndex: number;
  currentTimeUtc: string;
  activeGeneration: number;
  totalTimesteps: number;
  timesteps: TimestepMetadata[];
  isScrubbing: boolean;
}

export interface ClippingPlaneLimits {
  minLonDeg: number;
  maxLonDeg: number;
  minLatDeg: number;
  maxLatDeg: number;
  minDepthM: number;
  maxDepthM: number;
}

export interface NormalizedClippingBox {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  minW: number;
  maxW: number;
}

export interface ScientificVariableMetadata {
  variableId: string;
  canonicalUnits: string;
  cfStandardName?: string;
  longName?: string;
  minValue: number;
  maxValue: number;
  classification: 'ANALYSIS_FORECAST' | 'REANALYSIS' | 'CLIMATOLOGY' | 'OBSERVATION' | 'DERIVED';
  isEligibleForExactQuery: boolean;
}
