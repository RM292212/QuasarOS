# Scientific Validation

This directory stores evidence that QuasarOS preserves the scientific meaning of source data through ingestion, transformation, analysis, querying, and rendering.

## Required validation groups

- Coordinate and longitude handling.
- Vertical-coordinate, depth, height, and pressure semantics.
- Time and calendar handling.
- Variable identity and unit conversion.
- Fill-value, mask, and QC propagation.
- Spatial, vertical, and temporal interpolation.
- Multiresolution aggregation.
- Brick boundaries and halos.
- Exact-value queries.
- Profile extraction.
- Model-observation collocation.
- Derived quantities.
- WebGPU and WebGL 2 scientific parity.
- Frozen real-data reference cases.

## Naming

Use:

`<release>-<dataset-or-suite>-scientific-validation-<timestamp>.<extension>`

## Required metadata

Each report identifies:

- Release, commit, and processor version.
- Dataset, source, and product version.
- Source checksum.
- Variables and canonical units.
- Coordinate and calendar conventions.
- Validation method.
- Independent reference implementation or published reference.
- Absolute and relative tolerances.
- Expected and observed values.
- Pass, failure, or review-required status.
- Scientific reviewer.

## Numerical evidence

Machine-readable comparison tables should contain coordinates, time, vertical position, expected value, observed value, difference, tolerance, units, QC state, and method.

Tolerance changes require scientific rationale and review. A tolerance must not be widened solely to make an unexplained failure pass.

## Rendering evidence

Rendering validation must include numerical probes or analytic reference scenes. Screenshots alone do not establish scientific correctness.

## Failures

Any unexplained sign error, axis reversal, unit mismatch, time mismatch, invalid interpolation, hidden missing value, QC error, or provenance loss blocks release.

## Retention

Scientific-validation evidence is retained with every production release and with every published scientific product version required for reproducibility.
