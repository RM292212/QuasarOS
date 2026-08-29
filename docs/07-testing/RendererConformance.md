# RendererConformance.md

## Purpose

Verify that the WebGPU and WebGL 2 renderers implement the shared scientific rendering contract.

## Conformance principle

Backend differences may affect performance, maximum resolution, optional effects, and sampling quality. They must not change coordinate placement, masking, transfer-function meaning, time selection, inspection values, or provenance.

## Required reference scenes

- Constant scalar field.
- Linear gradients on each axis.
- Radial and spherical analytic fields.
- Layered depth field.
- Brick-boundary discontinuity detector.
- Missing-value and masked regions.
- Transparent and opaque transfer functions.
- Dateline-crossing and high-latitude domain.
- Coarse-to-fine LOD transition.
- Slice, clipping plane, and isosurface.
- Vector glyph and particle seed field.
- Observation markers and profile paths.

## Assertions

### Geometry and coordinates

- Volume bounds align with the local coordinate frame.
- Axis orientation and depth sign are correct.
- Camera rays enter and exit the expected volume.
- Cesium-to-local and local-to-data transforms round-trip within tolerance.
- Observation and model layers share the same spatial frame.

### Sampling and compositing

- Texture addressing maps to correct voxels.
- Trilinear interpolation matches a CPU reference.
- Step-size opacity correction is applied.
- Front-to-back compositing and early termination are correct.
- Missing samples contribute no false color or opacity.
- Brick halos prevent visible seams.

### Transfer functions

- Domain scaling, clamping, logarithmic rules, and under/over colors match the contract.
- Premultiplied-alpha handling is consistent.
- Empty-space skipping responds correctly to transfer-function changes.

### Streaming

- Coarse data appears before refinement.
- Stale generations are rejected.
- Eviction never leaves page-table references to reused slots.
- Failed bricks are visibly and diagnostically distinguishable from valid data.

## Backend parity

Run identical scene state, camera paths, timestamps, and probes in both backends. Compare CPU-readable probes, render diagnostics, and tolerant images. Exact pixel equality is not required because precision and filtering differ across GPU implementations.

## External conformance

Supported environments should also pass relevant official WebGPU CTS and Khronos WebGL conformance coverage. Product tests remain necessary because platform CTS suites do not validate QuasarOS scientific behavior.

References:

- https://gpuweb.github.io/cts/
- https://registry.khronos.org/webgl/sdk/tests/webgl-conformance-tests.html
