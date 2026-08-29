# Runtime Topology

**File:** `docs/02-architecture/RuntimeTopology.md`  
**Status:** Normative

## Browser runtime

    Main thread
      ├── React application shell
      ├── Zustand domain state
      ├── TanStack Query
      ├── Cesium workspace
      ├── Babylon workspace
      └── Render coordinator
              │
              ├── Decode workers
              ├── Data-processing workers
              └── Optional analysis worker

The main thread owns DOM interaction and graphics contexts. Workers own decompression, parsing, and approved CPU-heavy transformations.

## Backend runtime

    Reverse proxy
      ├── Web/static assets
      ├── FastAPI replicas
      │     ├── Catalog access
      │     ├── Exact query
      │     ├── Observation search
      │     └── Job control
      └── Object data endpoint

    Job queue
      ├── Ingestion workers
      ├── Processing workers
      └── Analysis workers

    Persistent systems
      ├── PostgreSQL/PostGIS
      └── S3-compatible object storage

## Typical volume flow

1. Browser requests catalog metadata.
2. Browser requests a render manifest.
3. Scheduler computes visible bricks.
4. Browser requests brick objects directly.
5. Worker verifies and decodes payloads.
6. Main thread uploads within a per-frame budget.
7. Page table marks completed slots resident.
8. Renderer samples the atlas.
9. Exact inspection separately queries the canonical backend.

## Typical collocation flow

1. Browser selects an observation profile.
2. Browser submits a collocation request.
3. API validates compatibility and creates a job.
4. Worker reads canonical model and observation data.
5. Worker computes collocated values and metrics.
6. Result is written immutably.
7. Browser receives job completion and loads the result.

## Concurrency limits

Browser limits:

- Network requests.
- Worker tasks.
- Decoded bytes.
- Upload bytes per frame.
- GPU cache size.

Backend limits:

- Request body size.
- Concurrent source downloads.
- Worker memory class.
- Job duration.
- Query region.
- Output size.
- User or tenant quota.

## State ownership

- Browser owns transient view state.
- API owns authoritative metadata and job state.
- Database owns catalog and provenance.
- Object storage owns scientific and rendering assets.
- Providers remain authoritative for original source data.

## Recovery

Components restart independently. Published immutable assets remain usable during worker outages. API replicas reconstruct state from persistent stores. Browser reload reconstructs its scene from domain state and manifests.

