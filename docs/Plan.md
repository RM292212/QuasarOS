# QuasarOS V1 Plan

## 1. Mission

Build QuasarOceanScope as a browser-native scientific environment capable of processing, visualizing, and analysing real numerical ocean-model output and real in-situ observations in three and four dimensions.

V1 must prove that a browser application can provide:

- Scientifically meaningful volume rendering.
- Full 3D WebGPU and WebGL 2 operation.
- Progressive large-data access.
- Geographic context.
- Observation-model comparison.
- Reproducible metadata and provenance.
- Operationally understandable workflows.

## 2. V1 success statement

V1 succeeds when a user can:

1. Open QuasarOceanScope in a supported browser.
2. Browse a real model domain geographically.
3. Select a real ROI, model run, time, depth range, and variable.
4. Load a progressively refined 3D temperature or salinity volume.
5. Change its transfer function and clipping.
6. animate multiple time steps.
7. display real Argo profiles.
8. select a profile and compare it with a collocated model profile.
9. inspect exact scientific values and provenance.
10. repeat the workflow under WebGPU or WebGL 2.

## 3. Mandatory V1 scope

### Data

- One approved real physical-ocean model product.
- Temperature.
- Salinity.
- Eastward and northward currents.
- Current speed as a derived scalar.
- Sea-surface height as a surface.
- Mixed-layer depth as a surface where available.
- GEBCO bathymetry.
- Real Argo temperature/salinity profiles.
- WOA climatology for selected anomaly workflows.

### Visualization

- Scalar volume rendering.
- Horizontal and vertical slices.
- Value filtering.
- Transfer functions.
- Bathymetry.
- Current vectors or particles.
- Argo markers, trajectories where available, and vertical profiles.
- Time animation.
- Isosurface support for one scalar field.
- WebGPU primary rendering.
- WebGL 2 full 3D rendering.

### Analysis

- Exact point inspection.
- Vertical model profile extraction.
- Argo profile display.
- Model-observation collocation.
- Difference profile.
- Bias and RMSE over valid matched levels.
- Temperature or salinity anomaly against a declared climatology.
- Metadata, QC, units, and provenance display.

### Platform

- Automated local environment bootstrap.
- Automated real-data bootstrap.
- FastAPI metadata/control service.
- Object-storage data delivery.
- PostgreSQL/PostGIS observation index.
- Zarr-based canonical/serving products.
- CI tests.
- Browser compatibility testing.
- Reproducible performance benchmarks.

## 4. Explicitly deferred

- Every BGC variable.
- Production ingestion for every INCOIS platform.
- Unstructured-grid volume rendering.
- Multi-user collaboration.
- Full WebXR.
- Machine-learning prediction.
- Full global multivolume rendering.
- Ensemble uncertainty rendering.
- Complete acoustic propagation simulation.
- Operational alert issuance.
- Native desktop/mobile applications.

## 5. Delivery strategy

Development follows a vertical-slice-first strategy.

A thin end-to-end path must be completed before broad parallel expansion:

```text
Real NetCDF
    ↓
validated ingestion
    ↓
canonical Zarr
    ↓
render bricks
    ↓
metadata API
    ↓
browser scheduler
    ↓
WebGPU volume
    ↓
WebGL2 volume
    ↓
real Argo profile
    ↓
model-observation comparison
```

## 6. Milestones

### M0 — Specification freeze

Deliver:

- Approved architecture.
- Approved technology stack.
- Canonical scientific data model.
- Source registry.
- API boundaries.
- Renderer contracts.
- Test and performance budgets.

Exit criteria:

- No unresolved contradiction among canonical documents.
- V1 variables and sources are identified.
- Real-data licence/access requirements are understood.

### M1 — Repository and infrastructure bootstrap

Deliver:

- Frontend workspace.
- Backend workspace.
- Scientific-processing workspace.
- Local object storage.
- PostgreSQL/PostGIS.
- CI.
- Environment configuration.
- Real-data bootstrap command.

Exit criteria:

- A new developer or agent can initialize the system reproducibly.
- Bootstrap data pass metadata and integrity validation.

### M2 — Canonical data pipeline

Deliver:

- Model ingestion.
- Argo ingestion.
- CF metadata extraction.
- Canonical variable mapping.
- Zarr output.
- Observation index.
- Provenance records.
- Rendering-product manifest.

Exit criteria:

- Canonical values match source values within declared transformation precision.
- Missing values and masks are preserved.
- Time and vertical coordinates are validated.

### M3 — First WebGPU volume

Deliver:

- Babylon scene.
- WGSL volume ray caster.
- Temperature rendering.
- Transfer function.
- Clipping.
- Exact point query.
- Reference image tests.

Exit criteria:

- Real temperature data render correctly.
- Rendering values can be traced to canonical data.
- No persistent GPU-resource growth across reloads.

### M4 — WebGL 2 parity

Deliver:

- GLSL ES 3.00 volume ray caster.
- Equivalent clipping and transfer functions.
- Equivalent scientific coordinate handling.
- Backend-selection logic.

Exit criteria:

- WebGL 2 produces results within declared image/numerical tolerances.
- Failure to initialize WebGPU automatically selects WebGL 2.
- The application remains fully 3D.

### M5 — Progressive bricked rendering

Deliver:

- LOD generation.
- Brick manifest.
- GPU atlas.
- Page table.
- cache.
- priority scheduler.
- cancellation.
- coarse-to-fine rendering.
- empty-space skipping.

Exit criteria:

- Time-to-first-image does not require the full high-resolution volume.
- Memory remains within configured limits.
- Missing fine bricks use valid lower-resolution ancestors.

### M6 — Geospatial overview

Deliver:

- Cesium overview.
- Dataset footprints.
- Bathymetry/geographic context.
- ROI selection.
- Shared state synchronization.
- Argo position display.

Exit criteria:

- Cesium and Babylon remain separate rendering contexts.
- ROI selection opens the corresponding volume region.
- Coordinates remain consistent.

### M7 — Observations and comparison

Deliver:

- Real Argo profiles.
- QC filtering.
- Profile charts.
- Collocation service.
- Model profile.
- residuals.
- bias/RMSE.
- provenance.

Exit criteria:

- Collocation method and tolerances are displayed.
- Invalid QC measurements are handled according to policy.
- Results reproduce reference Python calculations.

### M8 — Currents and time animation

Deliver:

- U/V current ingestion.
- Speed derivation.
- Vector or particle rendering.
- Time-step prefetch.
- animation.
- stale-request cancellation.

Exit criteria:

- Playback remains interactive under target hardware.
- Vector orientation accounts for grid mapping.
- Time semantics are visible.

### M9 — Production qualification

Deliver:

- Security review.
- Browser matrix.
- performance report.
- scientific validation report.
- data licence review.
- deployment procedure.
- recovery procedure.
- release candidate.

Exit criteria:

- Every release gate in `Test.md` passes.
- No fixture is exposed as operational data.
- Known limitations are documented.

## 7. Parallelization policy

Parallel work begins only after contracts required by each workstream are stable.

Safe parallel workstreams include:

- Backend APIs and frontend clients after API schema freeze.
- WebGPU and WebGL 2 after renderer contract freeze.
- Argo ingestion and model ingestion after data-model freeze.
- Cesium overview and Babylon volume workspace after shared-state freeze.
- UI components and scientific algorithms after their input/output contracts are fixed.

Unsafe parallelization includes:

- Multiple agents redefining the canonical variable schema.
- Multiple render engines implementing different scientific semantics.
- Concurrent changes to shared API types without coordination.

## 8. Primary risks

| Risk | Mitigation |
|---|---|
| Dataset access/licensing | Use approved public bootstrap products and retain access metadata |
| Large browser memory | Bricks, LOD, bounded caches, direct object delivery |
| WebGPU variability | Capability detection and WebGL 2 parity |
| Scientific metadata inconsistency | CF-aware normalization and explicit registry |
| Curvilinear/staggered grids | V1 support matrix and validated grid adapters |
| Agent integration conflicts | File ownership, frozen contracts, small tasks |
| Rendering artifacts | Analytical fields, reference images, opacity correction |
| False scientific precision | Exact-query path separate from rendering textures |
| Network latency | Progressive LOD, request priority, caching |
| Data-source changes | Versioned adapters and source-registry monitoring |

## 9. Definition of V1 complete

V1 is complete only when:

- Required real datasets ingest automatically.
- WebGPU and WebGL 2 render the same real volume acceptably.
- Data remain traceable to their sources.
- Model-observation comparison is validated.
- Performance budgets pass on documented hardware classes.
- GPU and CPU memory remain bounded.
- Browser, security, accessibility, and scientific tests pass.
- Production deployment is reproducible.

