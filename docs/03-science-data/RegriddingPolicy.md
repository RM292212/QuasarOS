# Regridding Policy

**File:** `docs/03-science-data/RegriddingPolicy.md`  
**Status:** Normative

## Principle

Regridding is a scientific transformation, not a file-format conversion. Source-grid data and metadata shall remain preserved.

## When regridding is allowed

- Creating a supported rendering product.
- Comparing datasets on incompatible grids.
- Producing a documented derived product.
- Converting curvilinear or staggered data for a V1-compatible renderer.
- Generating climatological anomalies.

## Methods

### Bilinear

Appropriate for smooth continuous scalar fields when grid geometry permits.

### Nearest neighbor

Appropriate for categories, masks, flags, and cases where value mixing is invalid.

### Conservative

Preferred for extensive quantities or fluxes when conservation is required and cell bounds are available.

### Vector-aware

Vector components shall be rotated into a common basis and destaggered before or during regridding according to the approved method.

### Vertical interpolation

Handled separately from horizontal regridding and performed in a physical compatible coordinate.

## Prohibitions

- Bilinear interpolation of categorical QC flags.
- Interpolation through land barriers.
- Silent extrapolation.
- Regridding without storing source and destination grids.
- Treating a regridded field as the original source.
- Regridding vector components without basis handling.
- Conservative claims without validated cell bounds.

## Required metadata

- Source and destination grid IDs.
- Method and library.
- Library version.
- Weight-file identity and checksum.
- Mask policy.
- Periodicity.
- Extrapolation policy.
- Vector rotation.
- Numerical precision.
- Validation report.

## Validation

Check:

- Known constant-field preservation.
- Valid-area coverage.
- Extrema behavior.
- Conservation where required.
- Coastal leakage.
- Dateline behavior.
- Mask propagation.
- Difference statistics against source sampling.

Rendering regridding may optimize geometry, but exact scientific queries should use canonical source-grid data where practical.
