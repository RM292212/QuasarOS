# ShaderTests.md

## Purpose

Validate shader compilation, numerical behavior, backend portability, and rendering invariants independently of full-scene visual tests.

## Scope

- Volume ray setup and box intersection.
- Page-table lookup and atlas addressing.
- Scalar decoding and normalization.
- Trilinear sampling.
- Transfer-function lookup.
- Gradient calculation.
- Lighting.
- Front-to-back compositing.
- Empty-space skipping.
- Clipping and slicing.
- Isosurface crossing.
- Vector-field sampling.
- Picking and diagnostic outputs.

## Static validation

For every shader variant:

- Compile WGSL for WebGPU.
- Compile and link GLSL ES 3.00 for WebGL 2.
- Validate bindings, locations, texture types, uniform layout, and workgroup limits.
- Reject warnings designated by project policy.
- Ensure generated shader source is deterministic.
- Confirm variant keys include every compile-time behavior.

## Numerical fixtures

Use tiny textures and buffers containing constant fields, ramps, impulses, masks, extrema, NaN-equivalent encoded values, and brick edges. Compare GPU-readable outputs with an independent CPU reference.

Required cases include:

- Rays that miss, graze, start inside, or cross the volume.
- Zero and near-zero ray components.
- Exact voxel centers and boundaries.
- First and last atlas texels.
- Halo sampling.
- Fully transparent and fully opaque transfer functions.
- Early termination.
- Degenerate gradients.
- Reversed clipping planes.
- Empty and all-missing bricks.

## Precision policy

Shader code must avoid equality checks on interpolated floating-point values, undefined derivative assumptions, out-of-bounds indexing, and backend-dependent uninitialized values. Tolerances are declared per operation and precision class.

## GPU matrix

Run fast shader tests in software or virtual adapters where possible and repeat the conformance suite on representative integrated and discrete physical GPUs. Record adapter, driver, browser, backend, and shader variant.

## Gate

Compilation failure, validation error, out-of-bounds access, inconsistent binding layout, unexplained backend divergence, NaN propagation into visible output, or a numerical result outside its documented tolerance blocks release.
