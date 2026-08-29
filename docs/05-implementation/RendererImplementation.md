# Renderer Implementation

**File:** `docs/05-implementation/RendererImplementation.md`  
**Status:** Normative

## Shared interface

The renderer backend shall implement:

- `initialize(capabilities, canvas)`
- `loadVolume(descriptor)`
- `updateFrame(frameState)`
- `updateTransferFunction(tf)`
- `updateClipping(clipping)`
- `uploadBrick(brick)`
- `evictBrick(address)`
- `pick(request)`
- `resize(viewport)`
- `getDiagnostics()`
- `dispose()`

## Initialization

1. Detect capabilities.
2. Select WebGPU or WebGL2.
3. Resolve quality profile.
4. Create Babylon engine and scene.
5. Initialize atlas, page table, transfer function, pipelines, and frame targets.
6. Start render loop.
7. Publish renderer status.

## Brick workflow

1. Scheduler requests a brick.
2. Worker validates and decodes it.
3. Renderer reserves a cache slot.
4. Upload occurs within frame budget.
5. Page table is updated.
6. Slot becomes resident.
7. Parent fallback remains until replacement is valid.
8. Eviction clears page-table residency before slot reuse.

## Shader variants

- Scalar unlit.
- Scalar lit.
- Preintegrated scalar.
- Isosurface.
- Picking.
- Residency debug.
- LOD debug.
- Occupancy debug.

Variants use stable contract keys and pipeline caching.

## Frame loop

- Apply current immutable state.
- Process bounded uploads.
- Update visibility and scheduling.
- Render terrain.
- Render volume.
- Render vectors and observations.
- Process picking.
- Apply temporal reconstruction.
- Emit diagnostics.

## Cleanup

Dispose pipelines, textures, buffers, page tables, scenes, event listeners, workers, and pending uploads. Generation IDs reject late results.

## Scientific boundary

The renderer may return approximate picks. Exact values always use canonical API queries.
