# Rendering Architecture

**File:** `docs/02-architecture/RenderingArchitecture.md`  
**Status:** Normative

## Approach

QuasarOceanScope uses image-order volume ray casting. Each pixel generates a ray; ray marching integrates scalar samples only after spatial, validity, residency, and transfer-function checks.

## Pipeline

    Camera ray
      → domain intersection
      → ROI/depth/clipping intersection
      → brick-level traversal
      → page-table lookup
      → occupancy and transfer-function test
      → adaptive ray marching
      → front-to-back compositing
      → early termination
      → temporal reconstruction
      → final composition

## Data representation

Dense ocean fields use multiresolution bricks rather than sparse-voxel formats by default. Each brick contains:

- Scalar samples.
- One-voxel halo where required.
- Validity information.
- Min/max.
- Occupancy or histogram mask.
- LOD and geographic bounds.
- Quantization scale and offset.
- Checksum.

Default render precision is R16-compatible where supported. R8 may be used for previews and R32 for validated high-precision modes.

## Acceleration

- Virtual brick coordinates and page table.
- Bounded GPU atlas.
- Coarse fallback LOD.
- Brick-level 3-D DDA traversal.
- Static water-domain masks.
- Transfer-function-aware occupancy.
- Empty-space jumping.
- Adaptive step size.
- Front-to-back compositing.
- Early-ray termination.
- Dynamic resolution during interaction.
- Jittered sampling with temporal accumulation where stable.

Opacity correction shall account for actual sampling distance.

## Backends

### WebGPU

- WGSL shaders.
- Bind groups.
- Storage buffers and textures.
- Compute pipelines for suitable workloads.
- Staged uploads for large transfers.
- GPU-assisted histogram, gradient, particle, or visibility work where justified.

### WebGL 2.0

- GLSL ES 3.00.
- 3-D textures or atlas representation.
- Texture-backed metadata and page tables.
- CPU/worker request scheduling.
- Fragment-pass alternatives for compute-like operations.
- Transform feedback or CPU workers for compatible particles.

## Shared contracts

Both backends consume the same:

- Volume descriptor.
- Brick address and metadata.
- Transfer function.
- Frame state.
- Clipping state.
- Quality profile.
- Coordinate transforms.
- Validity semantics.

## Scientific boundary

Rendering textures may be quantized and interpolated. Picking may provide an approximate immediate value, but exact inspection uses canonical backend queries.

## Resource lifecycle

Every texture, buffer, pipeline, query object, scene node, and event listener has an explicit owner and disposal path. Dataset or backend changes cancel pending uploads and invalidate stale generations.

