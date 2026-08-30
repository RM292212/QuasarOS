/**
 * QuasarOS Browser Streaming Engine Types and Data Contracts.
 *
 * Defines the public interfaces and internal data models for:
 * - Priority Queue & Multi-Tier Request Scheduling
 * - Downloader, SHA-256 Verifier, and Decompressor
 * - Float16 and Uint16 Decoders with Validity Mask Generation
 * - LRU In-Memory Brick Cache
 * - Unified Browser Brick Streamer
 */

import type {
  BrickGeometryContract,
  BrickIdentityContract,
  BrickPayloadContract,
  BrickRepresentation,
  QuantizationContract,
  SpatialBoundingBox,
} from '../types.ts';

// ----------------------------------------------------------------------------
// Decoded Brick Data Structure (Renderer-Agnostic)
// ----------------------------------------------------------------------------

/**
 * Clean, renderer-independent decoded sub-volume brick payload ready for GPU texture upload.
 * Scientific rule: Decoded visualization values are strictly for display and raymarching,
 * NEVER to be used as authoritative native-source scientific values.
 */
export interface DecodedBrick {
  /** Deterministic composite brick key */
  brickKey: string;
  /** Representation format */
  representation: BrickRepresentation;
  /** 3D sample dimensions [Nx, Ny, Nz] including halo padding (e.g. [66, 66, 32]) */
  sampleShape: [number, number, number];
  /** Interior valid shape [Nx, Ny, Nz] excluding halo (e.g. [64, 64, 31]) */
  interiorValidShape: [number, number, number];
  /** Halo padding along axes [padX, padY, padZ] (e.g. [1, 1, 0]) */
  haloPadding: [number, number, number];
  /** Sample origin within parent volume grid [origX, origY, origZ] */
  sampleOrigin: [number, number, number];
  /** Spatial bounding box */
  spatialBounds: SpatialBoundingBox;
  /** Vertical depth range (meters) */
  minDepthM: number;
  maxDepthM: number;
  /** Physical scalar min/max values across valid samples in this brick */
  scalarMin: number;
  scalarMax: number;
  /** Total number of voxels in sampleShape */
  totalVoxels: number;
  /** Count of valid physical cells */
  validVoxelsCount: number;
  /** Count of missing/masked cells */
  missingVoxelsCount: number;
  /** Flag indicating whether the entire brick contains only missing/land data */
  isEmptyOrMasked: boolean;

  /**
   * Decoded floating-point scalar buffer (Float32Array) for all voxels.
   * If representation is 'f16', raw half-floats are decoded to Float32.
   * If representation is 'u16', quantized integers are scaled & offset: val = code * scale + offset.
   * Missing / NaN values are explicitly mapped to NaN in scalarData.
   */
  scalarData: Float32Array;

  /**
   * Raw texture-ready buffer:
   * - For 'f16': Uint16Array of IEEE 754 half-float bits (length = totalVoxels, 2 bytes/voxel).
   * - For 'u16': Uint16Array of quantized integers (length = totalVoxels, 2 bytes/voxel).
   */
  rawBuffer: Uint16Array;

  /**
   * Categorical bitwise / byte validity mask:
   * 1 = valid physical cell (including valid 0.0°C / zero scalar values).
   * 0 = missing value / land / masked / NaN.
   * Essential for shader empty-space skipping and accurate iso-surface generation.
   */
  validityMask: Uint8Array;

  /** Quantization parameters if representation is 'u16' */
  quantization?: QuantizationContract | null;

  /** Timestamp of decoding (epoch ms) */
  decodedAtMs: number;
  /** Estimated memory footprint of this decoded brick in bytes */
  memorySizeBytes: number;
}

// ----------------------------------------------------------------------------
// Request Scheduler & Priority Queue Types
// ----------------------------------------------------------------------------

export interface RequestPriorityScore {
  /** LOD level (0 = finest, higher = coarser). Lower LOD has higher priority */
  lodLevel: number;
  /** Flag if brick is currently within camera frustum / view bounds */
  isVisibleInViewport: boolean;
  /** Euclidean distance from camera position to brick center (normalized or metric) */
  cameraDistance: number;
  /** Distance from current playback timestep to brick timestep */
  temporalDistance: number;
  /** Calculated composite scalar priority (higher value = higher dispatch priority) */
  compositeScore: number;
}

export interface StreamingRequestTarget {
  visualizationProductId: string;
  productVersion: string;
  snapshotId: string;
  brickKey: string;
  representation: BrickRepresentation;
  geometry: BrickGeometryContract;
  payloadMetadata: BrickPayloadContract;
  identity?: BrickIdentityContract;
}

export interface QueuedBrickRequest {
  id: string;
  target: StreamingRequestTarget;
  priority: RequestPriorityScore;
  epoch: number;
  createdAtMs: number;
  abortController: AbortController;
  resolve: (brick: DecodedBrick) => void;
  reject: (reason: unknown) => void;
}

// ----------------------------------------------------------------------------
// Streamer Configuration & Statistics
// ----------------------------------------------------------------------------

export interface BrickStreamerConfig {
  /** Base URL of the QuasarOS API service (e.g. 'http://localhost:8000') */
  baseUrl: string;
  /** Maximum concurrent HTTP download requests in flight (default 6) */
  maxConcurrentDownloads?: number;
  /** In-memory LRU cache capacity in bytes (default 50.0 MiB = 52,428,800 bytes) */
  maxCacheSizeBytes?: number;
  /** Custom fetch implementation (optional) */
  fetch?: typeof fetch;
  /** HTTP request timeout in ms (default 15,000) */
  timeoutMs?: number;
  /** Maximum allowed uncompressed payload size in bytes (safety ceiling, default 1.0 MiB) */
  maxUncompressedBytesCeiling?: number;
}

export interface CacheStatistics {
  entryCount: number;
  currentSizeBytes: number;
  maxSizeBytes: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRatePercent: number;
}

export interface StreamerStatistics {
  queuedRequestsCount: number;
  activeDownloadsCount: number;
  inflightDeduplicatedCount: number;
  completedRequestsCount: number;
  abortedRequestsCount: number;
  cacheStats: CacheStatistics;
}
