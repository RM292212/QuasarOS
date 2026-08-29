# QuasarOS Architecture

## 1. Architectural goals

The architecture must provide:

- Scientifically correct multidimensional data handling.
- Browser-native 3D/4D visualization.
- WebGPU performance with WebGL 2 compatibility.
- Bounded browser and GPU memory.
- Progressive rendering of datasets larger than VRAM.
- Independent scaling of metadata APIs and bulk data delivery.
- Modular support for new models and instruments.
- Traceable processing and reproducible analysis.

## 2. System context

```text
Authoritative providers
INCOIS / Argo GDAC / Copernicus / HYCOM / GEBCO / NOAA
                             │
                             ▼
                   Acquisition adapters
                             │
                             ▼
               Scientific processing pipeline
                             │
               ┌─────────────┴──────────────┐
               ▼                            ▼
     Canonical scientific storage     Observation storage
          NetCDF/Zarr                Parquet/PostGIS
               │                            │
               └─────────────┬──────────────┘
                             ▼
                Metadata and analysis APIs
                             │
                             ▼
                     QuasarOS browser
                 ┌───────────┴───────────┐
                 ▼                       ▼
         Cesium Ocean Overview   Babylon Volume Lab
```

## 3. Major runtime components

### 3.1 Browser application

Responsibilities:

- Authentication/session integration.
- Application state.
- Dataset and variable selection.
- Time and ROI controls.
- Data-request scheduling.
- Cesium overview.
- Babylon scientific rendering.
- Profile and analysis charts.
- Worker coordination.
- Local caches.
- Error and progress presentation.

The browser must not parse complete national-scale NetCDF archives directly during normal operation.

### 3.2 Cesium Ocean Overview

Responsibilities:

- Global/regional navigation.
- Coastline and geographic context.
- Indian EEZ representation.
- Dataset footprints.
- Observation locations.
- Trajectories.
- ROI selection.
- Availability visualization.

Cesium owns its canvas and render loop.

### 3.3 Babylon Scientific Volume Lab

Responsibilities:

- Scalar volumes.
- Slices.
- Isosurfaces.
- Bathymetry.
- Vector fields.
- Observation profiles.
- Picking.
- WebGPU/WebGL 2 selection.
- GPU resource lifecycle.

Babylon owns its canvas, GPU context/device, and render loop.

### 3.4 Shared domain state

Cesium and Babylon communicate through renderer-independent state:

```text
dataset ID
model run
variable
valid time
ROI
depth range
selected observations
selected transfer function
quality profile
vertical exaggeration
```

Shared state must not contain Babylon or Cesium objects.

### 3.5 FastAPI control plane

Responsibilities:

- Dataset catalog.
- Metadata.
- Source provenance.
- Variable availability.
- Observation search.
- Collocation requests.
- Analysis jobs.
- Signed/authorized data URLs.
- Saved views.
- Health/readiness.

FastAPI must not proxy every large brick unless authorization or infrastructure constraints require it.

### 3.6 Object-storage data plane

Responsibilities:

- Canonical Zarr.
- Rendering bricks.
- LOD levels.
- Isosurfaces.
- Parquet assets.
- Immutable manifests.
- Direct HTTP/range delivery.

Preferred implementation:

```text
MinIO/S3-compatible storage
        +
Nginx or infrastructure gateway
```

### 3.7 Scientific processing services

Responsibilities:

- NetCDF ingestion.
- CF normalization.
- Regridding.
- Grid transformations.
- Zarr generation.
- LOD generation.
- Brick construction.
- Statistics.
- Derived variables.
- Model-observation collocation.
- Export generation.

Heavy processing must run outside ordinary interactive API workers.

### 3.8 Observation storage

Use:

- PostgreSQL/PostGIS for platform, profile, trajectory, and spatial indexes.
- Parquet/object storage for large measurement tables.
- Arrow IPC for efficient tabular browser transfer.

## 4. Data layers

### Layer A — Authoritative source

Original provider files and metadata.

Rules:

- Immutable after acquisition.
- Checksummed where possible.
- Provider filename retained.
- Licence retained.
- Acquisition event recorded.

### Layer B — Canonical scientific representation

Analysis-ready representation preserving:

- Scientific values.
- Coordinates.
- Dimensions.
- masks.
- units.
- QC.
- provenance.

Preferred representation: Zarr/NetCDF accessed with xarray.

### Layer C — Visualization acceleration products

Includes:

- Multiresolution scalar bricks.
- Quantized network encoding.
- GPU-ready texture values.
- Occupancy masks.
- Brick min/max.
- gradient products.
- Page-table manifests.
- Cached geometry.

Rendering products must point back to canonical data and declare precision/error.

### Layer D — Browser cache

Includes:

- Compressed downloaded assets.
- Decoded bricks.
- GPU-resident bricks.
- Current profile data.
- Short-lived query results.

All caches must be bounded.

## 5. Rendering architecture

```text
Camera ray
    ↓
ROI/volume intersection
    ↓
surface and bathymetry clipping
    ↓
brick DDA or hierarchy traversal
    ↓
residency/page-table lookup
    ↓
transfer-function visibility test
    ↓
adaptive ray marching
    ↓
front-to-back compositing
    ↓
early termination
    ↓
temporal reconstruction where enabled
```

### 5.1 Virtual volume

Each logical volume is divided into multiresolution bricks.

Each brick contains:

- Scalar values.
- interpolation halo.
- validity information.
- min/max.
- occupancy mask.
- LOD.
- time.
- variable.
- quantization information.
- canonical-data reference.

### 5.2 GPU cache

The renderer maintains a bounded 3D texture atlas.

A page table maps virtual brick coordinates to physical cache slots.

A missing fine brick must:

- Fall back to an available ancestor.
- Request refinement.
- Never produce an unexplained hole.

### 5.3 WebGPU backend

Uses:

- WGSL.
- WebGPU textures.
- Uniform buffers.
- Storage buffers.
- Compute pipelines.
- GPU-assisted request generation where beneficial.
- Compute-driven particles.
- Batched uploads.

### 5.4 WebGL 2 backend

Uses:

- GLSL ES 3.00.
- 3D texture atlas.
- Integer page-table textures.
- Brick DDA.
- Texture-based metadata.
- Transform feedback for particles.
- Worker/backend computation where compute shaders are unavailable.

## 6. Coordinate architecture

Authoritative data remain in their native documented coordinate system.

The visualization pipeline uses:

```text
source coordinate
    ↓
validated geographic/model transform
    ↓
WGS84/ECEF where required
    ↓
local ENU or local model coordinates
    ↓
visual vertical exaggeration
```

Vertical exaggeration applies only to display coordinates.

Scientific calculations use true coordinates.

For large geographic extents, use a floating/local origin to avoid GPU precision loss.

## 7. Request scheduling

Priority order:

1. Current visible coarse bricks.
2. Current visible fine bricks.
3. Selected observation/profile.
4. Active analysis result.
5. Next time-step coarse bricks.
6. Next time-step fine bricks.
7. Spatial neighbours.
8. Speculative prefetch.

Every request includes:

- Scene version.
- Dataset version.
- Time.
- Variable.
- priority.
- cancellation signal.

## 8. Cache architecture

```text
Provider/object storage
        ↓
HTTP cache or Service Worker cache
        ↓
compressed CPU cache
        ↓
decoded Worker cache
        ↓
GPU brick cache
```

Eviction considers:

- Visibility.
- screen contribution.
- temporal distance.
- ROI.
- re-download cost.
- current selection.
- memory pressure.

## 9. Failure boundaries

### Source failure

The source adapter reports an unavailable or changed product without corrupting existing canonical data.

### Processing failure

Failed output remains unpublished. Previous valid versions remain available.

### API failure

The UI shows recoverable status and retains loaded data where safe.

### Brick failure

The renderer keeps a lower-resolution ancestor and marks incomplete refinement.

### WebGPU failure

Attempt recovery where possible. If initialization fails, start the WebGL 2 backend.

### GPU device/context loss

Pause rendering, retain application state, recreate resources, and reload required bricks.

## 10. Security architecture

- Secrets remain server-side or in secure deployment configuration.
- External file metadata are untrusted.
- Resource allocation is bounded.
- Data paths are normalized.
- Analysis jobs have quotas.
- Signed URLs are short-lived where used.
- Authorization is checked before private data access.
- Logs must not contain credentials or private data payloads.

## 11. Deployment topology

Minimum local/development topology:

```text
Frontend development server
FastAPI
processing worker
PostgreSQL/PostGIS
MinIO
```

Production topology may separate:

- Static frontend hosting.
- API instances.
- analysis workers.
- ingestion workers.
- PostgreSQL.
- object storage.
- reverse proxy.
- monitoring.

## 12. Extensibility

New data sources implement source adapters.

New scientific grid types implement grid adapters.

New observations implement observation adapters.

New derived quantities implement versioned scientific operators.

New render layers implement renderer-independent layer contracts and backend-specific GPU resources.

No plugin may bypass provenance, units, QC, or resource limits.

