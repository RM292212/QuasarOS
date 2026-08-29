# Package Boundaries

**File:** `docs/05-implementation/PackageBoundaries.md`  
**Status:** Normative

## TypeScript packages

### `domain`

Scientific identities, topology, time, coordinates, validity, QC, and renderer-independent value objects.

### `schemas`

Runtime validation for APIs, events, manifests, worker messages, and exports.

### `api-client`

HTTP transport, authentication integration, cancellation, pagination, and generated types.

### `state`

Application actions, selectors, synchronization, and view-state persistence.

### `render-core`

Frame state, render descriptors, backend interface, quality profiles, clipping, transfer functions, and resource contracts.

### `render-webgpu`

WGSL pipelines, WebGPU resource binding, compute, uploads, and device handling.

### `render-webgl2`

GLSL pipelines, WebGL2 texture/page-table handling, uploads, and context recovery.

### `cesium-overview`

Geographic overview and ROI adapter.

### `babylon-volume`

Scientific scene integration and layer orchestration.

### `workers`

Worker clients, messages, decoding, and transferable-buffer handling.

### `ui` and `charts`

Accessible shared UI and scientific chart components.

## Python packages

### `quasar_science`

Units, coordinates, grids, vertical transforms, TEOS-10 wrappers, QC, and scientific validation.

### `quasar_ingestion`

Provider adapter contracts, acquisition, normalization, and publication preparation.

### `quasar_analysis`

Queries, profiles, collocation, statistics, climatology, and derived products.

## Rules

- Packages expose explicit public entry points.
- Internal modules are not imported across package boundaries.
- Domain packages do not import frameworks.
- Backend and frontend share schemas through generated artifacts, not duplicated handwritten definitions.
- Renderer packages do not own catalog or authentication logic.
- Scientific packages do not import API routes.
