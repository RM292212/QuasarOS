# ADR-0004: Zarr for Visualization-Ready Multidimensional Storage

- **Status:** Accepted
- **Decision type:** Data-plane storage
- **Owners:** Data, rendering, and architecture teams

## Context

Interactive browser visualization requires chunked, independently retrievable, compressed multidimensional data. Source oceanographic files are commonly optimized for archival distribution or scientific tooling rather than low-latency browser access.

The rendering system requires:

- Spatially addressable chunks or bricks.
- Independent HTTP retrieval.
- Multiple spatial resolutions.
- Per-brick statistics and checksums.
- Parallel decoding.
- Immutable versioned publication.
- Object-storage compatibility.
- Efficient access without a server reading an entire source file.

## Decision

Use Zarr-compatible arrays and QuasarOS render manifests as the primary visualization-ready storage representation.

The visualization product contains:

- Canonically ordered multidimensional arrays.
- Explicit coordinate and dimension metadata.
- Variable units and valid-range metadata.
- Missing-value and mask representation.
- Chunked scalar or vector data.
- Multiresolution levels.
- Brick halos where required for interpolation and gradients.
- Per-brick checksums, byte sizes, min/max statistics, and occupancy metadata.
- Time and depth indexes.
- A versioned render manifest.
- Provenance linking the product to source files and processing configuration.

The precise supported Zarr specification version, codecs, and metadata profile are declared by the product-format version. Readers must reject unsupported mandatory features rather than guessing.

## Chunking policy

Chunk shape is selected for browser retrieval and GPU upload, not copied blindly from the source file.

The initial volume brick target is approximately `64 × 64 × 32` samples before format-specific padding or halo cells. Final chunking may vary by grid, datatype, compression behavior, and device profile.

Each chunk must be:

- Independently retrievable.
- Bounded in compressed and decoded size.
- Deterministically addressed.
- Validated before GPU upload.
- Immutable after publication.

## Multiresolution

Coarse levels support rapid first visualization. Fine levels progressively replace coarse data according to camera, screen-space error, analysis priority, and memory budgets.

Downsampling methods are variable-aware. Scalar averages, categorical modes, vector aggregation, extrema preservation, and masks must not be treated as interchangeable.

## Metadata authority

The render manifest defines the browser-facing contract. Generic Zarr metadata alone is insufficient for renderer residency, page-table layout, LOD hierarchy, coordinate transforms, and provenance.

## Consequences

### Positive

- Efficient object-level parallel access.
- Cloud and CDN compatibility.
- Progressive loading.
- Reuse by analysis tools that support Zarr.
- Separation of source archival format from visualization layout.

### Negative

- Additional processing and storage.
- Potentially high object counts.
- Codec support must exist in browser workers.
- Product-version migrations require explicit compatibility handling.

## Rejected alternatives

- Reading full NetCDF files in the browser.
- One monolithic binary volume per time step.
- Database BLOB storage.
- Renderer-only proprietary storage without scientific metadata.

## Validation

Validate decoded values against source NetCDF, chunk boundaries, halos, masks, LOD aggregation, checksums, coordinate transforms, and exact reference probes.
