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

## Exact-value query

Required request fields:

- Dataset ID.
- Variable ID.
- Valid time.
- Longitude and latitude.
- Depth, pressure, or source vertical coordinate.
- Interpolation method.
- Unit preference.

The response includes:

- Canonical value and unit.
- Position and vertical coordinate actually evaluated.
- Grid-cell identity or interpolation neighborhood.
- Validity and QC state.
- Source and processing provenance.
- Interpolation method and numerical precision.

## Render manifest

A render manifest identifies:

- Dataset, variable, time, grid and render-product versions.
- Volume bounds and coordinate transform.
- LOD levels.
- Brick shape and halo.
- Texture format and quantization metadata.
- Page-table dimensions.
- Validity, occupancy, and min/max metadata.
- Brick-address template or signed URL service.
- Checksums and compression.
- Expiration and refresh policy.

## Idempotency and concurrency

- Job-creation endpoints accept `Idempotency-Key`.
- Mutable resources use entity versions or ETags.
- Clients use `If-Match` for protected updates.
- Duplicate idempotent requests return the existing job or result.

## Authentication

Deployments may use OAuth 2.1/OIDC. Authorization is enforced server-side. Signed data URLs are short-lived, resource-scoped, and excluded from exports and logs.

## Compatibility

Additive fields may be introduced within a major API version. Removing fields, changing scientific meaning, or changing units requires a new major version or explicitly versioned representation.

