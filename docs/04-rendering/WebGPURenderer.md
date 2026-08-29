# WebGPU Renderer

**File:** `docs/04-rendering/WebGPURenderer.md`  
**Status:** Normative

## Role

WebGPU is the primary high-performance backend for the Scientific Volume Lab.

## Initialization

1. Detect `navigator.gpu`.
2. Request an adapter using deployment power preference.
3. Inspect adapter limits and features.
4. Request only required device features.
5. Create the Babylon.js WebGPU engine.
6. Configure error scopes and device-loss handling.
7. Select a quality profile from measured limits.

Browser identity alone shall not determine support.

## Bind-group model

Recommended logical groups:

- Group 0: frame, camera, viewport, and quality.
- Group 1: volume textures, samplers, transforms, and scalar metadata.
- Group 2: page table, brick metadata, validity, occupancy, and transfer function.
- Group 3: clipping, surface, vector, observation, or debug resources.

Layouts shall remain stable across compatible shader variants.

## Compute use cases

Compute pipelines may support:

- Particle advection.
- Gradient generation.
- Histogram generation.
- Transfer-function visibility masks.
- Brick metadata reduction.
- Isosurface extraction.
- Temporal reconstruction support.

Compute shall not perform authoritative scientific calculations when canonical backend processing is required.

## Uploads

- Use `queue.writeTexture` for small updates.
- Use staging buffers and copy commands for larger batches.
- Respect row-pitch alignment.
- Limit upload bytes per frame.
- Mark page-table entries resident only after submitted copies are valid.

## Synchronization

Avoid blocking CPU/GPU synchronization. Readbacks are limited to diagnostics, picking, and validated workflows. Buffer mapping shall be asynchronous.

## Error handling

Use validation and out-of-memory error scopes where appropriate. Device loss shall preserve domain state, release invalid resources, attempt reinitialization, and fall back to WebGL2 if recovery fails.

## Performance

Use pipeline caching, immutable bind-group layouts, bounded resource creation, indirect execution only where justified, and timestamp queries only when supported.

## Validation

Test device limits, WGSL compilation, atlas addressing, storage alignment, uploads, compute outputs, device loss, analytical scenes, parity, memory, and benchmark targets.
