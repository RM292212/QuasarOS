# Data Precision Policy

**File:** `docs/03-science-data/DataPrecisionPolicy.md`  
**Status:** Normative

## Principle

Precision shall be selected according to scientific meaning and workflow. Rendering optimization shall not silently reduce canonical scientific precision.

## Precision layers

### Source precision

Preserve source datatype, packing attributes, fill values, and scale/offset metadata.

### Canonical precision

Canonical arrays should use:

- `float32` for most model and observation variables when source precision and validation permit.
- `float64` for coordinates, time conversion, sensitive thermodynamic calculations, accumulated statistics, and transformations requiring additional precision.
- Integer or categorical types for flags, identifiers, masks, and indexes.

### Rendering precision

Supported rendering representations:

- 8-bit normalized: preview only.
- 16-bit integer with scale/offset: default compact scientific rendering option.
- 16-bit float: default where supported and validated.
- 32-bit float: high-precision rendering or fields requiring larger dynamic range.

## Quantization

Quantized products shall store:

- Encoded datatype.
- Valid code range.
- Scale.
- Offset.
- Missing code.
- Source and canonical ranges.
- Maximum absolute and relative quantization error.
- Quantization algorithm version.

Quantization shall use:

    physical_value = encoded_value × scale + offset

Missing values shall use a reserved code outside the valid encoded range.

## Error budget

Each variable registry entry shall define:

- Canonical numerical tolerance.
- Rendering quantization tolerance.
- Interpolation tolerance.
- Derived-calculation tolerance.
- Display rounding.

Rendering error should remain below the smallest scientifically meaningful visual interval defined for the variable.

## Exact inspection

Exact inspection, profile extraction, exports, and statistics shall read canonical data rather than reconstructing values from GPU textures.

## Validation

For every render product:

- Compare sampled decoded values with canonical values.
- Verify extrema and missing values.
- Measure quantization error.
- Test negative and near-zero values.
- Verify no collision between valid codes and missing codes.
- Record the precision report in provenance.
