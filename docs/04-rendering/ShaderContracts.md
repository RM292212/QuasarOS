# Shader Contracts

**File:** `docs/04-rendering/ShaderContracts.md`  
**Status:** Normative

## Principles

WGSL and GLSL implementations shall consume equivalent logical inputs and implement equivalent scientific rendering semantics.

## Frame inputs

- View matrix.
- Projection matrix.
- Inverse view-projection.
- Camera position in local coordinates.
- Viewport.
- Frame index.
- Time interpolation state.
- Render scale.
- Quality constants.

## Volume inputs

- Volume bounds.
- Grid dimensions.
- Voxel spacing.
- Coordinate transform.
- Atlas texture.
- Page table.
- Brick metadata.
- Validity texture.
- Occupancy metadata.
- Transfer-function texture.
- Scalar scale and offset.
- Current time and LOD information.

## Clipping inputs

- ROI bounds.
- Depth limits.
- User clipping planes.
- Surface boundary.
- Seabed or domain mask.

## Required shader outputs

Main volume pass outputs:

- Premultiplied color.
- Accumulated alpha.
- Optional hit depth.
- Optional picking identifier.
- Optional debug values.

## Shader variants

- Scalar unlit.
- Scalar lit.
- Preintegrated transfer function.
- Isosurface.
- Picking.
- Debug occupancy.
- Debug LOD.
- Debug brick residency.

Variants shall use explicit feature keys and pipeline caching.

## Numerical rules

- Use physical-spacing-aware gradients.
- Apply scalar scale and offset exactly once.
- Apply step-size opacity correction.
- Treat invalid data as zero opacity.
- Prevent NaN propagation.
- Clamp texture coordinates.
- Avoid sampling outside resident atlas regions.
- Use generation-valid page-table entries.

## Compatibility

WGSL and GLSL bindings may differ physically but share a generated or manually synchronized logical schema. Contract changes require parity tests.

## Validation

Shaders shall compile in CI where tooling permits and run against analytical scenes. Probe outputs and image differences shall be compared across backends.
