# DataPipelineTests.md

## Purpose

Verify acquisition, validation, normalization, chunking, publication, and reprocessing of scientific data products.

## Pipeline stages under test

1. Source discovery.
2. Download or remote access.
3. Checksum and transport validation.
4. Source-format decoding.
5. Metadata and coordinate validation.
6. Unit and convention normalization.
7. QC and masking.
8. Regridding or derived-variable computation.
9. Pyramid, brick, and index generation.
10. Catalog registration and atomic publication.

## Test data

Maintain:

- Tiny synthetic NetCDF, Zarr, GRIB, CSV, and Parquet fixtures.
- Curvilinear, rectilinear, depth-positive-up, and depth-positive-down grids.
- Gregorian and non-Gregorian calendar examples.
- Dateline-crossing and polar domains.
- Argo-like profile fixtures with QC flags.
- Missing variables, corrupt chunks, truncated files, invalid checksums, duplicate observations, and inconsistent metadata.
- Frozen real-data samples with source license and checksum.

Fixtures must be small, immutable, versioned, and attributable.

## Invariants

Every published product must have:

- Stable dataset, product, variable, and time identifiers.
- Canonical units and original-unit provenance.
- Monotonic or explicitly indexed coordinate axes.
- Consistent fill-value and NaN handling.
- Valid spatial and temporal bounds.
- Deterministic chunk and brick keys.
- Per-object checksum and byte size.
- Complete source and processing provenance.
- No catalog visibility before all required assets are durable.

## Numerical tests

Compare pipeline outputs with independent reference calculations. Define absolute and relative tolerances per variable and operation. Tests must distinguish floating-point tolerance from scientifically acceptable error. Regridding tests verify conservation or interpolation behavior appropriate to the selected method.

## Idempotency and restartability

Reprocessing the same input and configuration must produce equivalent manifests and values. Tests interrupt each stage, restart the job, and verify that:

- Completed immutable outputs are reused safely.
- Partial temporary outputs are not published.
- Duplicate catalog records are not created.
- Changed configuration produces a new product version.
- Source revision invalidates only affected outputs.

## Scale tests

Use generated datasets to test object counts, long time axes, many depth levels, and high observation density without committing large fixtures. Measure worker memory, throughput, retry behavior, and storage requests.

## Release gate

Block publication when validation fails, provenance is incomplete, checksums differ, coordinate semantics are ambiguous, or scientific comparisons exceed documented tolerances.
