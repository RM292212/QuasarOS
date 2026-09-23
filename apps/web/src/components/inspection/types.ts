/**
 * Scientific Inspection and Analysis Types.
 *
 * Conforms to TASK-10A/10D and docs/02-architecture/APIContracts.md.
 */

import type {
  ExactValueQueryResponse,
  PhysicalCellState,
  ProvisionalRenderPickResponse,
  ReconcilePickResponse,
  SelectionMethod,
  VerticalProfileLevelSample,
  VerticalProfileQueryResponse,
} from '@quasar/client';

export interface CursorCoordinateReadout {
  longitudeDeg: number;
  latitudeDeg: number;
  depthM: number;
  timestampUtc: string;
}

export interface PickDeltaMetrics {
  absoluteDelta: number | null;
  relativeDeltaPercent: number | null;
  coordinateResolutionDistanceKm: number;
  withinErrorBound: boolean | null;
}

export interface PickReconciliationModel {
  cursor: CursorCoordinateReadout;
  provisional: {
    approximateValue: number;
    displayUnits: string;
    lodLevel: number;
    estimatedSampleErrorBound: number;
    worldRayHitPosition?: number[];
    approximationNotice?: string;
  };
  authoritative: {
    scientificValue: number | null;
    canonicalUnits: string;
    valueState: PhysicalCellState;
    resolvedCoordinates: {
      longitudeDeg: number;
      latitudeDeg: number;
      depthM: number;
      resolvedTimeUtc: string;
    };
    sourceAssetId: string;
    sourceAssetSha256: string;
    selectionMethodUsed: SelectionMethod;
    gridIndexEvaluated?: number[];
    rawResponse?: ExactValueQueryResponse;
  } | null;
  delta: PickDeltaMetrics;
  reconciliationNotice?: string;
  isLoading: boolean;
  error?: string | null;
}

export interface VerticalProfileDataPoint {
  levelIndex: number;
  depthM: number;
  scientificValue: number | null;
  valueState: PhysicalCellState;
  isGap: boolean;
}

export interface VerticalProfileChartModel {
  datasetId: string;
  variableId: string;
  canonicalUnits: string;
  requestedLongitudeDeg: number;
  requestedLatitudeDeg: number;
  resolvedLongitudeDeg: number;
  resolvedLatitudeDeg: number;
  horizontalDistanceDeltaKm: number;
  resolvedTimeUtc: string;
  sourceAssetId: string;
  sourceAssetSha256: string;
  totalLevels: number;
  validLevelsCount: number;
  dataPoints: VerticalProfileDataPoint[];
  observedPoints?: VerticalProfileDataPoint[];
  observationLabel?: string;
  teos10Variable?: 'thetao' | 'CT' | 'SA' | 'sigma0';
  minDepthM: number;
  maxDepthM: number;
  minValue: number;
  maxValue: number;
}

export interface ProvenanceMetadataModel {
  datasetId: string;
  datasetVersion: string;
  variableId: string;
  productId: string;
  provider: string;
  snapshotId: string;
  sourceFilename: string;
  sourceSha256: string;
  canonicalStorePath: string;
  acquisitionTimestampUtc: string;
  licence: string;
  attribution: string;
  processingPipelineVersion?: string;
  geographicBounds?: {
    minLongitude: number;
    maxLongitude: number;
    minLatitude: number;
    maxLatitude: number;
  };
  verticalBounds?: {
    minDepthM: number;
    maxDepthM: number;
    levelCount: number;
  };
}
