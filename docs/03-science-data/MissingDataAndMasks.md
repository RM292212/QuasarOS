# Missing Data and Masks

**File:** `docs/03-science-data/MissingDataAndMasks.md`  
**Status:** Normative

## Missing-data categories

QuasarOS distinguishes:

- `VALID`
- `SOURCE_MISSING`
- `LAND`
- `BELOW_SEABED`
- `OUTSIDE_DOMAIN`
- `QC_REJECTED`
- `TEMPORALLY_UNAVAILABLE`
- `NOT_OBSERVED`
- `NOT_LOADED`
- `PROCESSING_FAILED`
- `UNKNOWN_INVALID`

These states shall not be collapsed into numeric zero.

## Source detection

Missing values may be identified through:

- `_FillValue`.
- `missing_value`.
- Valid ranges.
- NaN.
- Provider quality flags.
- Land/sea masks.
- Bathymetry intersection.
- Mesh-domain boundaries.
- Product documentation.

Source encodings shall be preserved in metadata.

## Canonical representation

Canonical floating arrays should use NaN for computational missingness where compatible, plus a categorical validity mask when the missing reason matters.

Categorical masks shall use stable integer codes documented by schema version.

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
