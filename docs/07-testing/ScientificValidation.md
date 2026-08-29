# ScientificValidation.md

## Purpose

Prove that displayed, queried, transformed, and compared scientific values preserve their documented meaning.

## Authority hierarchy

1. Analytic fields with exact expected results.
2. Independent trusted libraries or reference implementations.
3. Published reference values and provider documentation.
4. Cross-implementation comparison.
5. Expert-reviewed real-data cases.

The same production function must not generate both the expected and observed result.

## Validation domains

### Coordinates

- Longitude conventions and dateline wrapping.
- Latitude orientation.
- Horizontal coordinate reference systems.
- Depth, height, and pressure sign and units.
- Curvilinear-grid lookup.
- Cell centers versus bounds.
- Gregorian and supported non-Gregorian calendars.

### Variables and units

- Canonical variable identity.
- Unit conversion and scale/offset decoding.
- Valid ranges.
- Fill values, NaN, infinity, and masks.
- Vector component orientation.
- Temperature and salinity definitions.
- Density or other TEOS-10-derived quantities when supported.

### Interpolation and sampling

Validate nearest, linear, trilinear, vertical, temporal, and grid-specific interpolation independently. Tests cover boundaries, exact nodes, missing neighbors, thin layers, and extrapolation policy. Extrapolation is forbidden unless explicitly declared.

### Multiresolution products

Coarse levels must preserve documented aggregation behavior. Validate min/max metadata, conservative quantities where applicable, halos, extrema, masks, and reconstruction error.

### Observations and collocation

Verify QC filtering, pressure/depth conversion, spatial distance, temporal difference, model sampling, observation sampling, bias sign, summary statistics, and provenance. Collocation output must expose method and acceptance windows.

### Rendering

Analytic volumes verify transfer-function mapping, opacity integration, clipping, slices, isosurfaces, gradients, and coordinate placement. Visual output is never the sole correctness oracle.

## Tolerances

Every test declares units, absolute tolerance, relative tolerance, and rationale. Tolerances account for precision and algorithmic approximation, not unknown implementation error. GPU and CPU tolerances may differ but must remain scientifically justified.

## Failure policy

Any unexplained sign error, axis reversal, unit mismatch, time mismatch, invalid interpolation, hidden missing value, incorrect QC interpretation, or provenance loss is a release blocker.

Reference:

- https://www.teos-10.org/
