# ADR-0001: Babylon.js as the Primary Volume Renderer

- **Status:** Accepted
- **Decision type:** Rendering architecture
- **Owners:** Rendering and architecture teams

## Context

QuasarOS requires an interactive 3-D Volume Lab for scientific scalar volumes, clipping, slicing, isosurfaces, vector fields, observations, picking, progressive brick streaming, and GPU resource management.

The renderer must support:

- WebGPU as the preferred browser GPU API.
- WebGL 2 as a functional fallback.
- Custom scientific ray-marching shaders.
- Explicit texture, buffer, and pipeline lifecycle management.
- Progressive out-of-core data loading.
- Stable camera, scene, interaction, and UI integration.
- Deterministic disposal and device-loss recovery.
- Integration with React without placing the render loop in React state.

Building the complete scene engine directly on browser APIs would increase implementation and maintenance cost. CesiumJS is optimized for globe-scale geospatial visualization but is not the preferred engine for the local scientific volume laboratory.

## Decision

Use Babylon.js as the primary scene and rendering engine for the Volume Lab.

Babylon.js owns:

- The Volume Lab canvas.
- Camera and local scene management.
- Scene graph and transforms.
- Render-loop integration.
- GPU resource wrappers.
- WebGPU and WebGL 2 engine initialization.
- Meshes used for bounds, slices, clipping controls, and observations.
- Input and picking integration where consistent with scientific requirements.
- Context and device lifecycle notifications.

QuasarOS owns:

- Volume ray-marching algorithms.
- Brick scheduling and residency.
- Page tables and texture atlases.
- Transfer-function semantics.
- Scientific coordinate transforms.
- Shader contracts and variants.
- Exact-value queries.
- Scientific validation.
- Renderer parity requirements.
- Resource budgets and diagnostic counters.

Babylon abstractions may be bypassed through approved engine extension points when required for compute pipelines, specialized texture layouts, or deterministic scientific behavior. Such bypasses remain isolated in renderer backend packages.

## Boundaries

React components communicate with the renderer through a stable renderer interface. React must not directly create or dispose Babylon resources.

Scientific domain packages must not import Babylon.js. Babylon-specific types remain inside the Babylon and renderer adapter packages.

The rendering result is an approximate visual representation. Babylon picking must not be treated as an authoritative scientific value query.

## Consequences

### Positive

- Mature camera, scene, material, and resource abstractions.
- One scene architecture across WebGPU and WebGL 2.
- Reduced engine-level implementation burden.
- Strong browser integration and debugging support.
- Extensible support for observations, vectors, meshes, and UI overlays.

### Negative

- QuasarOS depends on Babylon release behavior.
- Some scientific rendering features require custom shaders and low-level integration.
- Engine upgrades require renderer conformance and performance testing.
- Resource ownership must be carefully controlled to avoid leaks.

## Rejected alternatives

- **Raw WebGPU and WebGL 2 only:** maximum control but excessive engine and lifecycle work.
- **Three.js:** viable general renderer, but not selected for the primary Volume Lab architecture.
- **CesiumJS for the Volume Lab:** optimized for globe visualization rather than local bricked scientific volume rendering.
- **Server-side image rendering:** incompatible with required interactive inspection and local transfer-function editing.

## Validation

This decision is validated by:

- WebGPU and WebGL 2 renderer conformance tests.
- Analytic volume reference scenes.
- Progressive streaming benchmarks.
- GPU resource lifecycle tests.
- Context and device-loss recovery tests.
- Long-session memory tests.
