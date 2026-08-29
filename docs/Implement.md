# QuasarOS Implementation Specification

## 1. Implementation strategy

Build QuasarOceanScope through thin, testable vertical slices.

The first complete slice must use:

- Real model data.
- Real Argo data.
- One geographic ROI.
- One temperature volume.
- WebGPU rendering.
- WebGL 2 rendering.
- Exact-value inspection.
- One model-observation comparison.

Large-scale optimization follows only after correctness is established.

## 2. Recommended monorepo structure

```text
apps/
    web/
    api/

packages/
    domain/
    scientific-schema/
    api-client/
    data-client/
    render-core/
    render-webgpu/
    render-webgl2/
    cesium-overview/
    babylon-volume/
    ui/
    charts/
    workers/

services/
    ingestion/
    processing/
    analysis/

python/
    quasar_science/
    tests/

infrastructure/
    containers/
    database/
    object-storage/
    proxy/

data/
    manifests/
    test-only/

tests/
    e2e/
    performance/
    scientific/
```

Exact package names may be adjusted before implementation, but responsibilities and dependency boundaries must remain clear.

## 3. Shared domain layer

The domain package owns renderer-independent entities:

- Dataset identity.
- Variable definitions.
- time selections.
- ROI.
- depth ranges.
- transfer functions.
- clipping state.
- quality profiles.
- observation selection.
- provenance.
- error types.

It must not import React, Babylon.js, or CesiumJS.

## 4. API-first development

Before parallel frontend/backend implementation:

1. Define API resources.
2. Define request and response schemas.
3. Generate or maintain typed clients.
4. Add schema tests.
5. Freeze the contract for the milestone.

Primary API resource groups:

```text
/catalog
/datasets
/variables
/runs
/times
/observations
/profiles
/collocations
/analysis-jobs
/render-manifests
/exports
/health
```

Large bricks and Zarr chunks should generally be accessed through object URLs returned by metadata/manifests.

## 5. Ingestion implementation

Each source adapter must perform:

1. Discovery.
2. Authentication where required.
3. Download or remote access.
4. integrity verification.
5. source registration.
6. metadata extraction.
7. schema validation.
8. canonical variable mapping.
9. coordinate validation.
10. QC retention.
11. canonical output generation.
12. visualization-product generation.
13. publication only after successful validation.

Partial outputs must not be published as complete datasets.

## 6. Data bootstrap

Provide an idempotent bootstrap command that:

- Checks configuration.
- Creates required storage buckets/directories.
- downloads approved real subsets.
- verifies file existence and expected metadata.
- records provider and product version.
- processes canonical Zarr.
- creates rendering products.
- ingests Argo metadata and profiles.
- reports completion or actionable failure.

Credentials must come from environment or approved secret storage.

The command must support:

- Resume.
- Retry.
- Force refresh.
- Verification-only mode.
- Clear local-data mode with confirmation.

## 7. Visualization-product generation

For each eligible scalar volume:

1. Validate the source grid.
2. Apply the approved visualization-grid strategy.
3. preserve validity.
4. generate LODs.
5. divide into bricks.
6. add interpolation halos.
7. calculate min/max.
8. calculate scalar occupancy masks.
9. encode values.
10. record scale, offset, precision, and error.
11. write brick assets or Zarr arrays.
12. write a versioned manifest.

Default candidate brick size:

```text
64 × 64 × 32
```

This is a benchmark starting point, not a permanent invariant.

## 8. Renderer-independent volume contract

The render core must expose concepts equivalent to:

```text
VolumeDescriptor
VolumeTimeState
BrickAddress
BrickMetadata
PageTableEntry
TransferFunction
ClipVolume
QualityProfile
RenderCapabilities
```

Shared mathematical behavior includes:

- Ray-box intersection.
- physical-to-texture coordinate mapping.
- front-to-back compositing.
- opacity correction.
- transfer-function semantics.
- clipping.
- LOD selection.
- fallback behavior.

## 9. WebGPU renderer implementation

Initialization:

1. Detect WebGPU.
2. request adapter.
3. inspect limits/features.
4. request device.
5. select supported texture formats.
6. establish memory budget.
7. create Babylon WebGPU engine.
8. compile required pipelines.
9. initialize atlas/page table.
10. register device-loss handling.

Suggested bind-group responsibilities:

```text
Group 0: camera and frame
Group 1: volume atlas and transfer function
Group 2: page table and brick metadata
Group 3: clipping, bathymetry, and analysis state
```

Use stable layouts and avoid rebuilding bind groups every frame.

Use compute where justified for:

- Brick visibility.
- request compaction.
- particle advection.
- gradients.
- histograms.
- temporal interpolation.

Avoid GPU readback except for compact results.

## 10. WebGL 2 renderer implementation

Initialization:

1. Request WebGL 2 explicitly.
2. inspect texture and draw limits.
3. inspect required extensions.
4. select supported formats.
5. establish memory budget.
6. initialize Babylon WebGL engine.
7. compile GLSL variants.
8. initialize atlas and page-table textures.
9. register context-loss handling.

Use:

- `sampler3D` volume atlas.
- integer page-table textures.
- nearest sampling for metadata.
- trilinear sampling for scalar bricks.
- brick DDA.
- GLSL ES 3.00.
- transform feedback for particles.
- Workers/backend for unavailable compute operations.

## 11. Shader variants

Prefer a small set of explicit variants:

```text
scalar-unlit
scalar-lit
scalar-preintegrated
scalar-debug
multi-volume-experimental
```

Avoid one giant shader controlled by dozens of dynamic branches.

Every variant must declare:

- Required resources.
- supported formats.
- maximum steps.
- precision.
- quality profile.
- WebGPU/WebGL parity status.

## 12. Transfer functions

Represent transfer functions as ordered control points in physical units.

The GPU receives a generated 1D texture. Pre-integrated rendering may use a 2D texture.

Changes to color or opacity must:

- Update the GPU texture.
- update transfer-visible occupancy.
- reset temporal history.
- not modify canonical data.

## 13. Progressive loading

On scene change:

1. Increment scene version.
2. cancel stale requests.
3. request coarse visible bricks.
4. render lower-resolution result.
5. request detailed visible bricks.
6. update page table after successful upload.
7. prefetch next time.
8. evict low-priority bricks as required.

Never expose uninitialized atlas memory as valid data.

## 14. Exact-value inspection

Picking must determine:

- Geographic coordinate.
- true depth.
- selected model cell or interpolation neighbourhood.
- valid time.
- variable.
- exact/canonical value.
- display value.
- source units.
- QC/provenance.
- interpolation method.

The UI may provide an immediate approximate GPU value while an exact canonical query is pending, but it must label the approximation.

## 15. Observation implementation

Argo ingestion retains:

- WMO/platform ID.
- cycle.
- direction.
- position.
- time.
- pressure.
- temperature.
- salinity.
- adjusted values.
- QC.
- data mode.
- source.
- file identity.

Observation rendering uses:

- Surface/current position marker.
- optional trajectory.
- vertical profile line.
- profile chart.
- status/QC styling.

## 16. Collocation implementation

A collocation request declares:

- Model dataset/run.
- variable.
- observation profile.
- temporal tolerance.
- horizontal method.
- vertical method.
- QC policy.
- valid depth range.

The result returns:

- Observation values.
- model values.
- differences.
- valid-level mask.
- time and horizontal separation.
- interpolation metadata.
- bias.
- RMSE.
- provenance.

## 17. Resource lifecycle

Every GPU resource must have an owner.

Owners must release:

- Textures.
- buffers.
- materials.
- meshes.
- compute resources.
- query sets.
- event subscriptions.

Scene changes must not create unbounded resources.

Caches expose:

- Current size.
- budget.
- hit rate.
- miss rate.
- evictions.
- pending uploads.

## 18. Error handling

All layers return structured errors.

The UI must distinguish:

- No data for selection.
- Source unavailable.
- Authorization required.
- Unsupported grid.
- processing incomplete.
- corrupted asset.
- GPU unsupported.
- GPU lost.
- request canceled.
- resource limit.

Canceled/stale work is not reported as a user-facing failure.

## 19. Logging and observability

Record:

- Dataset ingestion events.
- processing versions.
- failed source requests.
- API latency.
- analysis-job latency.
- object-storage errors.
- brick request counts.
- cache behavior.
- renderer backend.
- device loss.
- memory-budget events.

Logs must not contain credentials or complete private payloads.

## 20. Feature completion process

Every feature follows:

```text
contract
    ↓
implementation
    ↓
unit tests
    ↓
integration tests
    ↓
scientific/render validation
    ↓
performance check
    ↓
documentation
    ↓
orchestrator handoff
```

