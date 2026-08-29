# Volume Rendering Specification

**File:** `docs/04-rendering/VolumeRenderingSpecification.md`  
**Status:** Normative

## Scope

This specification defines scalar-volume rendering for temperature, salinity, and compatible depth-resolved variables.

## Preconditions

A renderable volume shall have:

- Registered variable identity.
- Supported grid or validated rendering regrid.
- Valid horizontal and vertical coordinates.
- Valid time identity.
- Units.
- Scalar precision metadata.
- Validity and domain masks.
- Render manifest and brick hierarchy.

## Ray algorithm

For each pixel:

1. Construct a camera ray.
2. Intersect the volume bounds.
3. Clip against ROI, depth range, surface, seabed, and user planes.
4. Traverse intersected bricks in front-to-back order.
5. Resolve page-table residency.
6. Use parent LOD when target brick is absent.
7. Skip invisible bricks.
8. Sample scalar and validity.
9. Apply transfer function.
10. Correct opacity for step size.
11. Composite front-to-back.
12. Terminate at low transmittance.
13. Output premultiplied color and optional hit metadata.

## Sampling

- Trilinear scalar interpolation.
- Validity-aware interpolation.
- Physical-spacing-aware adaptive steps.
- Brick halos to avoid seams.
- Optional preintegrated transfer functions.
- Optional jitter and temporal reconstruction.

## Domain boundaries

The renderer shall exclude:

- Land.
- Below-seabed cells.
- Outside-domain cells.
- Missing values.
- QC-rejected values where applicable.
- Not-yet-loaded bricks without fallback.

## Quality

Quality profiles control resolution, step size, LOD, early termination, gradients, and temporal reconstruction. They shall not alter the selected variable, units, time, or exact-query result.

## Outputs

- Color.
- Alpha.
- Optional first-contribution depth.
- Optional selected brick/LOD.
- Optional debug occupancy or residency.

## Scientific disclosure

The interface shall expose:

- Variable and units.
- Time.
- Value range.
- LOD/refinement state.
- Vertical exaggeration.
- Renderer backend.
- Approximation status.

## Conformance

Implementations shall pass analytical, real-data, parity, performance, memory, missing-data, and exact-inspection tests.
