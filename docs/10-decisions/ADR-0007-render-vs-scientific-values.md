# ADR-0007: Separate Render Values from Scientific Values

- **Status:** Accepted
- **Decision type:** Scientific integrity
- **Owners:** Science, rendering, backend, and architecture teams

## Context

Interactive volume rendering depends on performance-oriented representations such as:

- Quantized scalar values.
- Floating-point texture formats with limited precision.
- Compressed bricks.
- Downsampled LOD levels.
- GPU interpolation.
- Adaptive ray steps.
- Empty-space skipping.
- Approximate picking.
- Temporal or spatial interpolation.

These representations are appropriate for visualization but may not preserve exact source values. A visually plausible result must not be presented as an authoritative scientific measurement.

## Decision

Separate the rendering data path from the scientific value data path.

### Render data path

The render path is optimized for interactive visual interpretation. It may use:

- Quantized or normalized textures.
- Multiresolution bricks.
- GPU interpolation.
- Approximate gradients and lighting.
- Adaptive sampling.
- Approximate hit positions.
- Progressive loading.

Render output is explicitly classified as approximate.

### Scientific data path

Exact inspection and analysis use backend scientific services or validated canonical arrays. The scientific response includes:

- Dataset and product version.
- Variable and canonical unit.
- Geographic coordinate.
- Time and calendar.
- Depth, pressure, or vertical coordinate.
- Source grid location.
- Value and missing state.
- QC information.
- Sampling or interpolation method.
- Distance and time offset where applicable.
- Processing and provenance identifiers.
- Uncertainty or precision metadata when available.

## Picking workflow

Picking uses two stages:

1. The renderer determines an approximate visual location and immediately displays a provisional marker.
2. The application submits the reconstructed geographic, temporal, and vertical query to the scientific service.
3. The inspector replaces or augments the provisional result with the authoritative response.
4. The UI visibly distinguishes approximate and exact states.

A screen color, ray-marched sample, quantized texture value, or interpolated LOD voxel must never be labeled exact.

## Offline and unavailable behavior

If the scientific service is unavailable, the UI may show approximate render information only when labeled clearly. It must not fabricate an exact result or silently reuse a stale value from another product version.

## Derived analysis

Profiles, sections, collocation, bias, and statistics use the scientific path. GPU render buffers may support exploratory previews but are not authoritative analytical inputs unless separately validated and explicitly designated.

## Consequences

### Positive

- Prevents visual approximations from being misrepresented.
- Allows aggressive rendering optimization.
- Produces auditable exact results.
- Makes interpolation and provenance visible.
- Supports reproducible analysis.

### Negative

- Exact inspection may require a network request.
- Visual and exact results may differ slightly.
- The UI must represent provisional and authoritative states.
- Two data paths require cross-validation.

## Validation

Analytic and real-data tests compare render probes with scientific queries within declared visualization tolerances. Exact scientific responses are independently compared with canonical source values.
