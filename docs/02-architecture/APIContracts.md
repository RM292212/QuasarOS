# API Contracts

**File:** `docs/02-architecture/APIContracts.md`  
**Status:** Normative

## Principles

- Control-plane APIs use HTTPS, JSON, REST, and OpenAPI 3.1.
- Large arrays and volume bricks bypass FastAPI and use signed object-storage URLs.
- Observation tables may use Apache Arrow IPC.
- All public schemas are versioned.
- Requests are bounded, validated, cancellable where applicable, and traceable.
- Scientific values always include units, validity, time, and provenance.

## Base paths

- REST API: `/api/v1`
- OpenAPI: `/api/v1/openapi.json`
- Health: `/health/live`, `/health/ready`
- Object data: deployment-specific S3/CDN URLs

## Core resources

| Method | Path | Purpose |
|---|---|---|
| GET | `/catalog` | Search providers, products, datasets, and variables |
| GET | `/datasets/{datasetId}` | Dataset metadata |
| GET | `/datasets/{datasetId}/variables` | Available variables |
| GET | `/datasets/{datasetId}/times` | Time-axis values and semantics |
| GET | `/render-manifests/{id}` | Volume-brick and LOD manifest |
| GET | `/visualization-products/{productId}/bricks/{brickKey}/payloads/{representation}` | Immutable binary sub-volume brick payload (`f16` or `u16`) |
| GET | `/observations` | Spatial and temporal observation search |
| GET | `/profiles/{profileId}` | Observation profile metadata |
| GET | `/profiles/{profileId}/values` | Profile measurements |
| POST | `/queries/value` | Exact canonical point query |
| POST | `/queries/profile` | Canonical vertical-profile query |
| POST | `/collocations` | Start model-observation comparison |
| GET | `/jobs/{jobId}` | Job status |
| DELETE | `/jobs/{jobId}` | Cancel a job |
| GET | `/results/{resultId}` | Analysis result |
| POST | `/exports/reproducibility` | Generate reproducibility record |
| GET | `/capabilities` | Server features and limits |

## Common response envelope

Successful bounded JSON responses use:

    {
      "data": {},
      "meta": {
        "requestId": "uuid",
        "schemaVersion": "1.0.0"
      }
    }

Errors follow `ErrorModel.md`.

## Pagination

Collection endpoints use cursor pagination:

- `limit`: default 100, server maximum enforced.
- `cursor`: opaque continuation token.
- `nextCursor`: absent when complete.

Clients shall not construct or interpret cursors.

## Exact-value query contract (`ExactValueQueryRequest` & `ExactValueQueryResponse`)

The authoritative exact-value query service guarantees exact numerical recovery from canonical storage, bypassing GPU rendering quantization:

- **Request Schema (`schemas/canonical/exact_value_query_request.json`):**
  - `dataset_id`, `variable_id`, `valid_time`.
  - Spatial coordinates: `longitude` ([-180, 180] or [0, 360]), `latitude` ([-90, 90]).
  - Vertical coordinate: `depth` (meters, positive down), `pressure` (dbar), or dimensionless model coordinate (ROMS s-coordinate).
  - `interpolation_method`: `NEAREST_EXACT`, `TRILINEAR_BOUNDED`, `BARYCENTRIC_ROMS`, `REPRESENTATIVE_NEAREST`.
  - `unit_preference`: Target physical unit (e.g. `degC`, `K`, `psu`, `m/s`).

- **Response Schema (`schemas/canonical/exact_value_query_response.json`):**
  - Canonical floating-point value and unit.
  - Position and vertical coordinate actually evaluated (with source vertical formula terms).
  - Grid-cell identity, surrounding node weights, or interpolation neighborhood.
  - Categorical validity flag (`VALID`, `LAND`, `BELOW_SEABED`, etc.) and QC state.
  - Complete lineage/provenance trace: source product ID, ingestion timestamp, processing recipe ID.
  - Numerical precision (float32/float64) and estimated uncertainty bounds.

## Visualization product contracts (`VolumeRenderManifest`, Bricks, LODs, Quantization, Transfer Functions)

Volume rendering utilizes multi-resolution hierarchical brick volumes with explicit scientific transfer functions:

- **Volume Render Manifest (`schemas/canonical/volume_render_manifest.json`):**
  - Dataset, variable, time, grid, and render-product versions.
  - Volume bounding box (`LocalCartesianBounds` / local ENU frame) and geodetic coordinate transform.
  - Multi-resolution LOD levels (LOD 0 full resolution down to coarsest fallback).
  - Standard brick dimension: `64x64x64` voxels + 1-voxel halo (for seamless trilinear/cubic filtering).
  - Texture format and scientific quantization metadata:
    - `NORM_UINT8` / `NORM_UINT16` with affine scale and offset: $V_{real} = V_{norm} \times \text{scale} + \text{offset}$.
    - Explicit unquantization formula and precision bounds documented in manifest.
  - Page-table dimensions and sparse brick address template (`/bricks/{lod}/{z}/{y}/{x}.bin`).
  - Per-brick validity, transfer-function-aware occupancy mask, and min/max scalar bounds for empty-space skipping.
  - Checksums (SHA-256) and compression encoding (`raw`, `zstd`, `lz4`).

- **Transfer Function Specification (`schemas/canonical/transfer_function.json`):**
  - Piecewise linear or spline color maps mapping scalar range $[S_{min}, S_{max}]$ to RGBA.
  - Step-size-corrected opacity computation: $\alpha_{step} = 1 - (1 - \alpha_{ref})^{\Delta s / \Delta s_{ref}}$.
  - Explicit treatment of missing/land values: invalid samples assigned $\alpha = 0$ (zero opacity, never rendered as 0.0 scalar).

## Idempotency and concurrency

- Job-creation endpoints accept `Idempotency-Key`.
- Mutable resources use entity versions or ETags.
- Clients use `If-Match` for protected updates.
- Duplicate idempotent requests return the existing job or result.

## Authentication

Deployments may use OAuth 2.1/OIDC. Authorization is enforced server-side. Signed data URLs are short-lived, resource-scoped, and excluded from exports and logs.

## Compatibility

Additive fields may be introduced within a major API version. Removing fields, changing scientific meaning, or changing units requires a new major version or explicitly versioned representation.


