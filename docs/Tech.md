# QuasarOS Technology Stack

## 1. Selection criteria

Technologies are selected according to:

- Scientific reliability.
- WebGPU/WebGL 2 capability.
- Performance.
- Maintainability.
- Browser support.
- Interoperability.
- Licensing.
- Community maturity.
- Ability to run on institutional infrastructure.
- Replaceable boundaries.

## 2. Frontend

### TypeScript

Use for:

- Application orchestration.
- Domain models.
- Network clients.
- Worker coordination.
- Renderer coordination.
- UI logic.

Reasoning:

- Stronger contracts than untyped JavaScript.
- Good browser integration.
- Shared API schema generation.
- Easier agent collaboration.

TypeScript must not be used for large synchronous numerical loops on the main thread.

### React

Use for:

- Application shell.
- Panels.
- Dialogs.
- Dataset selection.
- Time controls.
- Charts.
- Metadata.
- Error states.

React must not own per-frame GPU state or large voxel arrays.

### Vite

Use for:

- Frontend build.
- Development server.
- Worker bundling.
- Environment-specific configuration.

### Zustand

Use for renderer-independent client state:

- Selected dataset.
- ROI.
- time.
- variable.
- UI state.
- selected observations.

Large binary arrays and Babylon/Cesium instances must remain outside Zustand.

### TanStack Query

Use for:

- Server-state fetching.
- Request caching.
- invalidation.
- retries.
- background refresh.

Do not use it as the GPU brick cache.

### Apache ECharts

Use for:

- Depth profiles.
- Time series.
- Residuals.
- Histograms.
- Depth-time diagrams.

### Comlink

Use for typed communication with Web Workers where it reduces boilerplate. Transfer large `ArrayBuffer` objects instead of copying them.

## 3. Geospatial rendering

### CesiumJS

Selected for the Ocean Overview:

- Globe and regional navigation.
- Geographic cameras.
- WGS84 context.
- Dataset footprints.
- observations.
- ROI selection.

Cesium is not the production volume renderer.

It runs in a separate canvas from Babylon.js.

## 4. Scientific rendering

### Babylon.js

Selected as the sole production scientific scene engine.

Use for:

- WebGPU and WebGL 2 initialization.
- Camera and scene management.
- Custom WGSL/GLSL materials.
- texture and buffer management.
- meshes.
- picking.
- observations.
- particles.
- GPU lifecycle.

Reasons for choosing Babylon over Three.js:

- Mature WebGPU integration.
- Direct WGSL support.
- WebGL engine support.
- alignment with the reference paper.
- engine-level capabilities suited to a large analytical application.

Three.js may be used only for migration analysis or benchmark prototypes unless this decision is formally changed.

## 5. GPU APIs

### WebGPU

Primary backend.

Use for:

- Volume ray casting.
- GPU compute.
- particle advection.
- gradient generation.
- histogram reduction.
- brick request compaction.
- temporal interpolation.
- supported isosurface processing.

### WebGL 2

Required 3D compatibility backend.

Use for:

- GLSL volume ray casting.
- 3D textures.
- texture-based page tables.
- brick DDA.
- transform-feedback particles.
- multipass texture computation.

WebGL 1 is unsupported.

### WGSL and GLSL

Maintain backend-specific shader source against a shared mathematical specification.

Avoid automatically translating one shader language into the other for the production volume renderer.

### TypeGPU

Not part of the production critical path.

It may be evaluated for isolated compute experiments. It must not attempt to own Babylon-managed GPU resources without an approved architecture.

### Rust/WASM

Optional after profiling.

Potential uses:

- Decompression.
- CPU marching cubes.
- complex interpolation.
- binary decoding.
- validated hot numerical kernels.

Web Workers are mandatory before considering Rust/WASM.

## 6. Backend

### Python

Use for:

- Scientific ingestion.
- metadata normalization.
- grid processing.
- derived variables.
- validation.
- collocation.
- export.

### FastAPI

Use as the control plane:

- Catalog.
- metadata.
- observation search.
- analysis requests.
- signed URLs.
- health.
- saved state.

FastAPI should not proxy large immutable assets unnecessarily.

### Pydantic

Use for validated API models and configuration.

### xarray

Canonical labelled multidimensional-data abstraction.

### Dask

Use for out-of-core and parallel preprocessing. Do not use Dask automatically for small operations where its scheduling overhead dominates.

### cf-xarray

Use for CF-aware coordinate and variable interpretation.

### xgcm

Use for grid-aware operations, especially staggered ocean-model grids.

### xESMF

Use for documented regridding where appropriate.

### NumPy and SciPy

Use for validated general numerical processing.

### PyProj

Use for CRS, WGS84, ECEF, UTM, and local-coordinate transformations.

### GSW/TEOS-10 implementation

Use for thermodynamic seawater calculations such as:

- Absolute Salinity.
- Conservative Temperature.
- density.
- potential density.
- sound speed.

## 7. Data formats and storage

### NetCDF

Authoritative scientific source format.

Do not treat NetCDF as obsolete.

### Zarr v3

Preferred canonical and chunked serving representation.

Use sharding where supported and beneficial to avoid excessive small objects.

### Kerchunk/VirtualiZarr

Use when original NetCDF/HDF data can be exposed through virtual Zarr references without full duplication.

### Parquet

Use for large observation measurement tables.

### Apache Arrow IPC

Use for efficient tabular browser delivery.

### PostgreSQL/PostGIS

Use for:

- Observation metadata.
- positions.
- trajectories.
- spatial search.
- dataset indexes.
- annotations.

### MinIO/S3-compatible storage

Use for:

- NetCDF archives.
- Zarr.
- bricks.
- Parquet.
- generated meshes.
- manifests.

### JSON

Use for metadata, manifests, configuration, and small API responses.

Do not use JSON for large scalar arrays.

## 8. APIs and interoperability

Support:

- REST/OpenAPI.
- ERDDAP integration.
- OPeNDAP integration.
- CF conventions.
- STAC-compatible discovery where appropriate.
- OGC API EDR where appropriate.
- WMS/WCS for required interoperability.

Optimized volume-brick delivery may use a specialized binary data endpoint or direct object URLs.

## 9. Testing

Frontend:

- Vitest.
- React Testing Library.
- Playwright.

Backend/science:

- pytest.
- Hypothesis where property tests are valuable.
- xarray comparison utilities.
- trusted TEOS-10/reference calculations.

Performance:

- browser performance APIs.
- WebGPU timestamp queries when available.
- repeatable benchmark scenes.
- server and storage metrics.

## 10. Deployment

Use:

- Containers.
- PostgreSQL/PostGIS.
- MinIO/S3.
- reverse proxy.
- environment-based secrets.
- health and readiness checks.

Kubernetes is optional and should be introduced only when deployment scale requires it.

## 11. Prohibited stack duplication

Do not add:

- A second production frontend framework.
- A second production 3D engine.
- A second API framework.
- A competing global state framework.
- A custom database in place of PostGIS without evidence.
- Multiple incompatible scientific schemas.

New dependencies require a documented responsibility and measurable value.

