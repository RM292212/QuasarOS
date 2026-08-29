# Renderer Parity

**File:** `docs/04-rendering/RendererParity.md`  
**Status:** Normative

## Requirement

WebGPU and WebGL2 shall support the same essential scientific workflow. Visual implementation may differ, but scientific state and exact-query results shall remain equivalent.

## Mandatory parity

- Scalar volume rendering.
- Temperature and salinity.
- Transfer functions.
- Depth limits.
- Horizontal and vertical slices.
- Clipping.
- Bathymetry.
- Time selection and playback.
- Observation overlays.
- Picking and exact inspection.
- Progressive bricks.
- LOD fallback.
- Missing-data handling.
- Renderer status.
- Resource disposal and recovery.

## Permitted differences

WebGL2 may use:

- Larger sampling steps.
- Lower render resolution.
- Fewer particles.
- CPU-driven scheduling.
- Texture-backed metadata.
- Precomputed gradients.
- Precomputed isosurfaces.
- Lower cache size.
- Fewer simultaneous visual effects.

These differences shall be represented by quality and capability profiles.

## Shared inputs

Both backends consume identical renderer-independent:

- Frame state.
- Volume descriptor.
- Page-table semantics.
- Brick metadata.
- Transfer function.
- Clipping state.
- Coordinate transforms.
- Quality profile.
- Validity categories.

## Conformance tests

Test:

- Constant field.
- Gradient.
- Thin layer.
- Masked volume.
- Seabed intersection.
- LOD boundary.
- Empty-space skipping.
- Step-size opacity.
- Transfer-function changes.
- Context/device loss.

Compare:

- Probe values.
- Hit depth.
- Accumulated opacity.
- Image metrics.
- Missing-data behavior.
- Resource budgets.

## Release rule

WebGL2 shall not be called supported if it falls back to a 2-D map or cannot complete the essential V1 model-observation workflow.
