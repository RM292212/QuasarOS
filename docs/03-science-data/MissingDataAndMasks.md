# Missing Data and Masks

**File:** `docs/03-science-data/MissingDataAndMasks.md`  
**Status:** Normative

## Canonical Categorical Codes & Bitmasks

Categorical validity masks (`schemas/canonical/missing_data_mask.json`) use the following normative integer codes:

| Flag Code | Category Name | Description | Raymarching Treatment |
|---|---|---|---|
| `0` | `VALID` | Physical valid sample | Fully rendered via TF |
| `1` | `SOURCE_MISSING` | Provider `_FillValue` / NaN | 0 opacity ($\alpha=0$) |
| `2` | `LAND` | Dry land mask / topography | Clipped / 0 opacity |
| `3` | `BELOW_SEABED` | Depth exceeds bathymetry | Clipped / 0 opacity |
| `4` | `OUTSIDE_DOMAIN` | Outside spatial bounding box | Clipped / 0 opacity |
| `5` | `QC_REJECTED` | Failed QC filtering ($QC \ge 3$) | 0 opacity / flag inspect |
| `6` | `TEMPORALLY_UNAVAILABLE` | Time slice absent | 0 opacity |
| `7` | `NOT_OBSERVED` | Sparse in-situ unobserved cell | 0 opacity |
| `8` | `PROCESSING_FAILED` | Ingestion/derivation error | 0 opacity |

## Normalized Quality Control Scheme

QuasarOS normalizes diverse provider QC conventions (Argo, Copernicus, WOD, GTSPP) into canonical QC states (`schemas/canonical/quality_control_flag.json`):

- `NO_QC_PERFORMED` (Code 0): Raw unvalidated data.
- `GOOD` (Code 1): Passed all automated and visual quality tests.
- `PROBABLY_GOOD` (Code 2): Minor anomalies, acceptable for standard visualization.
- `PROBABLY_BAD` (Code 3): Suspect values, excluded from default rendering.
- `BAD` (Code 4): Definite sensor or physical failure, excluded from volume rendering and interpolation.
- `CHANGED` (Code 5): Value adjusted by post-processing/recalibration.
- `MISSING_VALUE` (Code 9): Missing observation.


## Rendering representation

Rendering products contain:

- Scalar texture or brick.
- Validity representation.
- Brick valid count.
- Occupancy information.
- Optional land and seabed masks.

Invalid samples contribute zero opacity, not zero scalar value.

## Interpolation

Interpolation shall:

- Use only valid neighbors.
- Require a documented minimum valid support.
- Avoid interpolation across land barriers where topology indicates separation.
- Avoid extrapolating below seabed or outside the domain.
- Return a typed invalid result when support is insufficient.

## LOD generation

Downsampling shall not average missing codes as data. Each output voxel records an appropriate validity state and uses declared valid-sample thresholds.

## UI behavior

The UI shall distinguish:

- Missing from source.
- Rejected by QC.
- Outside coverage.
- Not yet loaded.
- Failed loading.

A gray or transparent region alone is insufficient; the inspector shall provide the reason.
