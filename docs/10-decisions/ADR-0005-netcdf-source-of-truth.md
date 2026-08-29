# ADR-0005: NetCDF as the Scientific Source of Truth

- **Status:** Accepted
- **Decision type:** Scientific data governance
- **Owners:** Science, data, and architecture teams

## Context

QuasarOS transforms oceanographic source products into visualization-ready arrays, render bricks, indexes, thumbnails, and analysis tables. Derived formats improve performance but may omit source metadata, alter chunking, normalize units, or use reduced precision.

A durable authoritative representation is required to support:

- Reprocessing.
- Scientific audit.
- provenance.
- Correction of pipeline defects.
- Independent validation.
- Product-version comparison.
- Reproduction of exact queries.

NetCDF with CF-style metadata is widely used by oceanographic providers and scientific tooling. Not every provider starts with NetCDF, but the platform requires an archived, validated source representation.

## Decision

Treat validated, immutable NetCDF source assets as the scientific source of truth for gridded products.

When upstream data is delivered in GRIB, Zarr, HDF, CSV, binary, or another format, the pipeline must either:

1. Preserve the original immutable source and create a canonical NetCDF representation; or
2. Preserve the original as the authoritative source when conversion would lose required semantics, while creating a validated NetCDF interchange product.

The catalog records which object is authoritative.

Visualization-ready Zarr, render bricks, Parquet tables, statistics, thumbnails, and caches are derived products. They may be deleted and regenerated from the authoritative source plus versioned processing configuration.

## Source requirements

Every authoritative source record contains:

- Provider and product identifier.
- Retrieval location and timestamp.
- Source product version.
- Original filename or object identifier.
- Checksum and byte size.
- License and attribution.
- Variables and units.
- Coordinate systems.
- Calendar and time coverage.
- Vertical-coordinate semantics.
- Fill values and QC metadata.
- Ingestion software and validation result.

## Immutability

Source objects are content-addressed or stored under versioned keys. They are never overwritten in place. An upstream revision creates a new source version even if the provider reuses a filename or URL.

## Exact values

Exact-value services use authoritative or scientifically equivalent canonical arrays. They must not derive exact values from lossy render textures, quantized bricks, coarse LOD levels, or screen pixels.

## Metadata corrections

Provider metadata is preserved. Corrections or normalizations are recorded as explicit transformation steps rather than silently rewriting provenance.

## Consequences

### Positive

- Strong scientific audit trail.
- Deterministic regeneration of visualization products.
- Compatibility with established scientific tools.
- Clear separation between authoritative data and performance representations.

### Negative

- Additional storage may be required.
- Some source formats require conversion.
- NetCDF access may not be optimal for browser visualization.
- Scientific metadata validation remains necessary; format alone does not guarantee correctness.

## Validation

Compare canonical NetCDF values and metadata with source documentation, provider checksums, known reference points, and every published derived product.
