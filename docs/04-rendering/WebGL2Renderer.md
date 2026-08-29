# WebGL2 Renderer

**File:** `docs/04-rendering/WebGL2Renderer.md`  
**Status:** Normative

## Role

WebGL2 is the fully 3-D fallback renderer. It shall preserve the essential scientific workflow when WebGPU is unavailable.

## Initialization

- Request a WebGL2 context explicitly.
- Record supported limits and extensions.
- Verify 3-D texture support and required framebuffer formats.
- Select a compatible quality profile.
- Provide a clear error if requirements are not met.

## Implementation

- Babylon.js WebGL2 engine.
- GLSL ES 3.00 shaders.
- 3-D textures or texture atlas for scalar bricks.
- Integer or normalized textures for page tables.
- Texture-backed brick metadata and occupancy.
- `texSubImage3D` for incremental uploads.
- Pixel buffer objects where reliable and beneficial.
- Transform feedback or worker-assisted particles.
- Fragment-pass reductions where compute is unavailable.

## Constraints

WebGL2 commonly has:

- Lower uniform and binding limits.
- No general compute shaders.
- More limited storage-buffer behavior.
- Greater driver variability.
- More expensive synchronization.
- Format and filtering differences.

Metadata shall therefore be compact and texture-oriented.

## Quality adaptation

WebGL2 may use:

- Lower render scale.
- Larger ray steps.
- Coarser LOD.
- Precomputed gradients.
- Precomputed isosurfaces.
- Fewer particles.
- Smaller GPU cache.
- CPU-managed request scheduling.

## Required features

- Volume ray casting.
- Transfer functions.
- Empty-space skipping.
- LOD fallback.
- Slices and clipping.
- Bathymetry.
- Observations.
- Time playback.
- Picking and exact inspection.
- Context-loss recovery.

## Context loss

Handle `webglcontextlost` and `webglcontextrestored`. Stop rendering, prevent default loss handling where appropriate, recreate resources, restore domain state, and reload resident assets.

## Validation

Run shader compilation, analytical scenes, parity probes, browser matrix, texture-limit tests, context-loss tests, and memory lifecycle tests.
