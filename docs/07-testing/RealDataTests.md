# RealDataTests.md

## Purpose

Verify assumptions that synthetic fixtures cannot represent by running controlled tests against authoritative oceanographic products.

## Data policy

Real-data fixtures must be:

- Publicly redistributable or accessed under documented terms.
- Attributed to the provider.
- Pinned to a product version, URL or source identifier, retrieval date, and checksum.
- Small enough for routine CI when vendored.
- Free of secrets and unnecessary personal information.

Large or mutable datasets run in scheduled environments and are not fetched unpredictably during pull-request tests.

## Required samples

Maintain representative samples for:

- Global or regional model temperature and salinity.
- Currents with eastward and northward components.
- Argo profile observations and QC flags.
- Climatology such as World Ocean Atlas.
- Bathymetry.
- Rectilinear and curvilinear grids.
- Dateline, polar, coastal, deep-ocean, and all-missing regions.
- Multiple time and depth conventions.

## Verification

For each sample, test:

- Source decoding.
- Coordinate and calendar interpretation.
- Unit conversion.
- Fill values and valid ranges.
- Vertical orientation and pressure/depth semantics.
- Longitude normalization and dateline behavior.
- QC filtering.
- Brick and LOD generation.
- Catalog metadata.
- Exact queries at known locations.
- Profile extraction and model-observation collocation.
- Rendering of masks, coastlines, and vertical structure.

## Golden observations

Store a small table of independently inspected reference points containing coordinates, time, depth or pressure, expected value, unit, QC state, and tolerance. Reference points must avoid accidental interpolation ambiguity unless interpolation is the feature under test.

## Change detection

When an upstream source changes:

1. Detect checksum or metadata differences.
2. Prevent silent replacement of the pinned fixture.
3. Review scientific and licensing changes.
4. Create a new fixture version.
5. Recalculate references independently.
6. Retain provenance for the old version when required for reproducibility.

## Gate

Real-data failures block release when they indicate incorrect coordinate handling, unit conversion, QC interpretation, masking, collocation, provenance, or renderer placement. Temporary upstream availability failures affect only explicitly external tests and must not be confused with product correctness.
