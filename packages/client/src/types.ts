/**
 * QuasarOS Browser API Client Contracts and Type Definitions.
 *
 * Conforms strictly to:
 * - OpenAPI 3.1: schemas/openapi/openapi_v1.json
 * - Canonical Contracts: packages/contracts/types/quasar_contracts.d.ts
 * - API Specification: docs/02-architecture/APIContracts.md
 * - Error Model: docs/02-architecture/ErrorModel.md
 */

import type {
  CanonicalDatasetContract,
  CanonicalVariableContract,
  ExactValueQueryRequest,
  ExactValueQueryResponse,
  MultiresolutionLevelContract,
  PhysicalCellState,
  ProvisionalRenderPickResponse,
  QuantizationContract,
  RenderStatisticsContract,
  SelectionInterpolationContract,
  SelectionMethod,
  SpatialBoundingBox,
  TimeSelectorMode,
  TransferFunctionContract,
  VerticalSelectorType,
  VisualizationProductContract,
  CoordinateTransformContract,
} from '../../contracts/types/quasar_contracts.d.ts';

export type {
  CanonicalDatasetContract,
  CanonicalVariableContract,
  ExactValueQueryRequest,
  ExactValueQueryResponse,
  MultiresolutionLevelContract,
  PhysicalCellState,
  ProvisionalRenderPickResponse,
  QuantizationContract,
  RenderStatisticsContract,
  SelectionInterpolationContract,
  SelectionMethod,
  SpatialBoundingBox,
  TimeSelectorMode,
  TransferFunctionContract,
  VerticalSelectorType,
  VisualizationProductContract,
  CoordinateTransformContract,
};

// ----------------------------------------------------------------------------
// API Envelope & Error Types (APIContracts.md & ErrorModel.md)
// ----------------------------------------------------------------------------

export interface ResponseMeta {
  requestId: string;
  schemaVersion: string;
  timestampUtc: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: ResponseMeta;
}

export interface QuasarErrorDetail {
  code: string;
  message: string;
  requestId: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export interface QuasarErrorResponse {
  error: QuasarErrorDetail;
}

// ----------------------------------------------------------------------------
// Health & Capabilities Types
// ----------------------------------------------------------------------------

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  activeSnapshotsCount: number;
  historicalSnapshotsCount: number;
  visualizationProductsCount: number;
  integrityVerified: boolean;
}

export interface SystemResourceLimits {
  maxQueryPoints: number;
  maxProfileLevels: number;
  maxStreamingChunks: number;
  maxBrickLodLevel: number;
  [key: string]: unknown;
}

export interface SystemCapabilities {
  serverVersion: string;
  supportedRenderingBackends: string[];
  supportedCoordinateSpaces: string[];
  supportedSelectionMethods: string[];
  exactQueryPrecision: string;
  gpuVisualizationPrecision: string;
  resourceLimits: SystemResourceLimits;
}

// ----------------------------------------------------------------------------
// Catalog & Dataset Models
// ----------------------------------------------------------------------------

export interface SnapshotSummary {
  snapshotId: string;
  datasetId: string;
  temporalClassification: string;
  startDate: string;
  endDate: string;
  latestValidTime?: string | null;
  shape: number[];
  temperatureRangeDegC?: number[] | null;
  sourceSha256: string;
  rawNcPath?: string | null;
  canonicalZarrPath?: string | null;
  visualizationProductId?: string | null;
  isEligibleForExactQuery: boolean;
  immutable: boolean;
}

export interface DatasetFamilySummary {
  datasetId: string;
  title: string;
  provider: string;
  scientificRole: string;
  dataClass: string;
  activeSnapshotId: string;
  availableSnapshotsCount: number;
  temporalRange: {
    start: string;
    end: string;
  };
  variables: string[];
  canVolumeRender3d: boolean;
  canExactQuery: boolean;
}

export interface CatalogOverview {
  totalDatasets: number;
  datasets: DatasetFamilySummary[];
  activeSnapshots: SnapshotSummary[];
  historicalSnapshots: SnapshotSummary[];
}

export interface DatasetTimeAxis {
  datasetId: string;
  snapshotId: string;
  calendar: string;
  temporalClassification: string;
  timeStepsCount: number;
  availableTimestamps: string[];
  referenceTimeUtc?: string | null;
  startDatetimeUtc: string;
  endDatetimeUtc: string;
  temporalResolution: string;
}

export interface DatasetVariablesCatalog {
  datasetId: string;
  snapshotId: string;
  variables: Record<string, CanonicalVariableContract>;
}

// ----------------------------------------------------------------------------
// Visualization Product Models
// ----------------------------------------------------------------------------

export interface VisualizationProductSummary {
  visualizationProductId: string;
  productVersion: string;
  sourceDatasetId: string;
  sourceVariableId: string;
  canonicalUnits: string;
  totalBricks: number;
  lodLevelsCount: number;
  storageBytes: number;
  storageMib: number;
  isEligibleForExactQuery: boolean;
  manifestSha256: string;
}

export interface VisualizationProductDetail {
  visualizationProduct: VisualizationProductContract;
  quantizationContract?: QuantizationContract | null;
  totalBricks: number;
  storageSummary: Record<string, unknown>;
  isEligibleForExactQuery: boolean;
  brickInventoryCount: number;
  manifestPath: string;
}

export type BrickRepresentation = 'f16' | 'u16';

// ----------------------------------------------------------------------------
// Authoritative Scientific Query Models
// ----------------------------------------------------------------------------

export interface VerticalProfileQueryRequest {
  dataset_id: string;
  dataset_version?: string;
  snapshot_id?: string;
  variable_id: string;
  latitude_deg: number;
  longitude_deg: number;
  target_time_utc?: string;
  time_selector_mode?: TimeSelectorMode;
  selection_interpolation?: SelectionInterpolationContract;
  requested_units?: string;
}

export interface VerticalProfileLevelSample {
  level_index: number;
  depth_m: number;
  scientific_value?: number | null;
  value_state: PhysicalCellState;
}

export interface VerticalProfileQueryResponse {
  response_type: 'authoritative_vertical_profile';
  dataset_id: string;
  variable_id: string;
  canonical_units: string;
  requested_latitude_deg: number;
  requested_longitude_deg: number;
  resolved_latitude_deg: number;
  resolved_longitude_deg: number;
  horizontal_distance_delta_km: number;
  resolved_time_utc: string;
  grid_index_evaluated?: number[];
  selection_method_used: SelectionMethod;
  total_levels: number;
  valid_levels_count: number;
  samples: VerticalProfileLevelSample[];
  source_asset_id: string;
  source_asset_sha256: string;
  provenance_details?: Record<string, unknown>;
}

export interface ReconcilePickRequest {
  provisional_pick: ProvisionalRenderPickResponse;
  dataset_id?: string;
  variable_id?: string;
  snapshot_id?: string;
  target_time_utc?: string;
  latitude_deg?: number;
  longitude_deg?: number;
  depth_m?: number;
  selection_method?: SelectionMethod;
}

export interface ReconcilePickResponse {
  response_type: 'authoritative_reconciled_pick';
  provisional_value: number;
  provisional_lod_level: number;
  estimated_sample_error_bound: number;
  authoritative_response: ExactValueQueryResponse;
  absolute_difference_delta?: number | null;
  relative_difference_percent?: number | null;
  within_estimated_error_bound?: boolean | null;
  reconciliation_notice: string;
}

// ----------------------------------------------------------------------------
// Snapshot Pinning & Session State
// ----------------------------------------------------------------------------

export interface PinnedSnapshotSession {
  datasetId: string;
  snapshotId: string;
  visualizationProductId: string;
  productVersion: string;
  manifestSha256: string;
  sourceSha256: string;
  pinnedAtUtc: string;
  shape: number[];
  temporalRange: {
    start: string;
    end: string;
  };
}

// ----------------------------------------------------------------------------
// Client Configuration & Request Options
// ----------------------------------------------------------------------------

export interface QuasarClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface ListSnapshotsOptions extends RequestOptions {
  limit?: number;
  offset?: number;
}
