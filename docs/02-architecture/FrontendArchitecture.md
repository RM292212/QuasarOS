# Frontend Architecture

**File:** `docs/02-architecture/FrontendArchitecture.md`  
**Status:** Normative

## Stack

- React.
- TypeScript in strict mode.
- Vite.
- Zustand for client/domain interaction state.
- TanStack Query for server state.
- Babylon.js for scientific rendering.
- CesiumJS for geographic overview.
- Apache ECharts for charts.
- Comlink for worker RPC.

## Package boundaries

- `domain`: pure scientific and application types.
- `api-client`: generated or validated API access.
- `state`: stores, actions, selectors, synchronization.
- `ui`: reusable accessible components.
- `cesium-overview`: Cesium adapter.
- `babylon-volume`: Babylon scene adapter.
- `render-core`: renderer-independent contracts.
- `render-webgpu`: WGSL/WebGPU implementation.
- `render-webgl2`: GLSL/WebGL2 implementation.
- `workers`: decoding and background computation.
- `charts`: profile and analysis charts.

## State categories

### URL state

Shareable identifiers and view parameters safe for URLs.

### Domain interaction state

Dataset, variable, time, ROI, layers, clipping, selected observation, transfer function, and quality profile.

### Server state

Catalog, manifests, observations, query results, jobs, and authentication status. Managed by TanStack Query.

### Renderer state

GPU resources, atlas slots, page tables, pipelines, and transient frame data. Never stored in React or shared domain stores.

## Rendering loop

React does not drive every frame. Application state is converted into immutable renderer snapshots. Babylon owns the render loop. State changes update renderer resources through explicit commands.

## Workspace synchronization

Cesium and Babylon synchronize:

- Dataset.
- ROI.
- Selected geographic position.
- Selected observation.
- Time.
- Camera target where meaningful.

They do not share scene nodes, textures, contexts, or engine objects.

## Workers

Workers handle:

- Brick decompression.
- Binary validation.
- Data conversion.
- Optional histogram work.
- Parsing observation payloads.
- CPU fallback calculations.

Messages are typed, versioned, transferable where possible, and cancellable.

## Error boundaries

Separate boundaries protect:

- Application shell.
- Ocean Overview.
- Scientific Volume Lab.
- Charts and analysis.
- Optional layers.

A renderer failure shall not destroy catalog access or saved domain state.

## Accessibility

Controls use semantic HTML. Canvas state has accessible HTML equivalents. Focus, keyboard commands, reduced motion, and live-region behavior follow `AccessibilityRequirements.md`.

## Prohibited patterns

- Large arrays in global React state.
- GPU resources in Zustand.
- Direct API calls from shaders or low-level renderer classes.
- Provider-specific metadata logic in UI components.
- Unbounded effects triggered by animation frames.

