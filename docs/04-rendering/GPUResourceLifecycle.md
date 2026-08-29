# GPU Resource Lifecycle

**File:** `docs/04-rendering/GPUResourceLifecycle.md`  
**Status:** Normative

## Ownership

Every GPU resource shall have one explicit owner:

- Renderer backend.
- Scene.
- Volume layer.
- GPU cache.
- Transfer-function manager.
- Vector layer.
- Observation layer.
- Post-processing pipeline.

Shared ownership requires a reference-counted or centralized lifecycle manager.

## Resource states

    CREATED
      → INITIALIZED
      → ACTIVE
      → EVICTING
      → DISPOSED

Resources shall not return from `DISPOSED`.

## Managed resources

- Devices and contexts.
- Textures and texture views.
- Buffers.
- Samplers.
- Pipelines and shader modules.
- Bind groups.
- Framebuffers.
- Query sets.
- Babylon materials, meshes, and scenes.
- WebGL programs, VAOs, and transform-feedback objects.
- Event listeners and animation callbacks.

## Dataset changes

Changing dataset, variable, render-product version, backend, or incompatible precision shall:

1. Increment generation.
2. Cancel pending requests and worker tasks.
3. Stop new uploads.
4. Detach old page tables.
5. Dispose obsolete GPU resources.
6. Initialize the new generation.
7. Reject late stale results.

## Memory budgets

The renderer tracks allocated or estimated bytes for:

- Scalar atlases.
- Masks.
- Gradients.
- Page tables.
- Vector data.
- Frame targets.
- Temporal history.
- Geometry.

Allocation failure shall trigger eviction, quality reduction, or a recoverable error.

## Device/context loss

On loss:

- Stop rendering and uploads.
- Preserve domain state.
- Dispose invalid handles.
- Reinitialize the preferred backend.
- Fall back from WebGPU to WebGL2 if necessary.
- Recreate resources from manifests and caches.

## Testing

Run repeated dataset, time, variable, workspace, and backend changes. Memory shall return to the documented steady-state range without duplicated listeners, workers, or GPU resources.
