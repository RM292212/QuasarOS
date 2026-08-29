# Backend Architecture

**File:** `docs/02-architecture/BackendArchitecture.md`  
**Status:** Normative

## Responsibilities

The backend provides the control plane for:

- Catalog and metadata.
- Dataset registration and publication.
- Exact scientific queries.
- Observation discovery.
- Model-observation collocation.
- Derived-analysis jobs.
- Authorization and policy.
- Signed data-access URLs.
- Provenance and reproducibility exports.

It shall not become the default proxy for large volume bricks.

## Technology

- Python.
- FastAPI.
- Pydantic.
- SQLAlchemy or approved database access layer.
- PostgreSQL/PostGIS.
- Redis only where required for queues, locks, or ephemeral coordination.
- xarray, Dask, NumPy, SciPy, PyProj, cf-xarray, xgcm, xESMF, and GSW.

## Service boundaries

### API service

Handles validation, authentication, metadata queries, job submission, result retrieval, and signed-URL generation.

### Catalog service

Maintains providers, products, datasets, variables, time coverage, publication state, licences, and render-product references.

### Scientific query service

Reads canonical data and performs exact point, profile, subset, and interpolation queries.

### Observation service

Searches PostGIS metadata and retrieves profile values from Parquet or Arrow-compatible storage.

### Analysis service

Performs collocation, metrics, anomalies, and approved derived calculations.

### Job workers

Execute long-running or memory-intensive processing outside API request workers.

## Request lifecycle

1. Reverse proxy assigns or forwards a request ID.
2. API validates identity, authorization, schema, bounds, and quotas.
3. Bounded synchronous operations execute directly.
4. Long operations create an idempotent job.
5. Workers read canonical data and write immutable results.
6. The API returns metadata or signed result locations.
7. Logs and metrics retain correlation and provenance identifiers.

## Data-access rules

- Metadata: PostgreSQL/PostGIS.
- Canonical arrays: Zarr or virtually referenced NetCDF.
- Observations: PostGIS metadata plus Parquet/Arrow values.
- Rendering products: object storage.
- Temporary results: object storage with retention policy.
- Secrets: external secret management.

## Scientific isolation

Scientific algorithms live in versioned Python packages, not API route handlers. Every algorithm declares:

- Required inputs.
- Units.
- Coordinate assumptions.
- Missing-data policy.
- Output schema.
- Version.
- Validation reference.

## Reliability

- API instances are stateless.
- Jobs are retryable only when safe.
- Publication is transactional.
- Partially processed datasets remain unpublished.
- Workers emit heartbeats and durable terminal states.
- Cancellation is cooperative and checked between processing stages.

## Prohibited patterns

- Large multidimensional arrays encoded as JSON.
- Silent unit conversion.
- Provider-specific logic inside generic routes.
- Direct filesystem assumptions in domain services.
- Unbounded synchronous analysis.
- Storing credentials in dataset records.
- Treating rendered quantized values as exact scientific values.

