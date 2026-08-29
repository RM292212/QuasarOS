# Profile Comparison Design

**File:** `docs/06-design/ProfileComparisonDesign.md`  
**Status:** Normative

## Purpose

Compare a model vertical profile with an observation profile while making spatial, temporal, vertical, QC, and unit differences explicit.

## Layout

### Header

- Observation platform and profile.
- Model provider and product.
- Observation time.
- Model valid time.
- Spatial separation.
- Temporal offset.
- QC policy.
- Comparison status.

### Main chart

- Vertical axis: depth or pressure, increasing downward.
- Horizontal axis: selected variable and unit.
- Observation series.
- Model series.
- Optional climatology series.
- Valid and rejected observations distinguished.

### Residual chart

Displays:

    residual = model - observation

Uses the same vertical coordinate and a clear zero reference line.

### Statistics panel

- Valid-pair count.
- Depth coverage.
- Bias.
- MAE.
- RMSE.
- Maximum absolute difference.
- Mean spatial separation where applicable.
- Time offset.

## Interaction

- Hover and keyboard focus reveal paired values.
- Selecting a level highlights corresponding 3-D position.
- Depth-range selection updates statistics.
- Changing QC policy recomputes valid pairs.
- Unit changes apply to all compatible series and metrics.
- Users can reveal interpolation neighborhood and model cell.

## Invalid comparison

The UI shall explain:

- Incompatible variables.
- Incompatible units.
- Outside-domain observation.
- Time offset beyond tolerance.
- Insufficient depth overlap.
- Insufficient valid pairs.
- Missing coordinate metadata.

## Provenance

A details section includes algorithms, interpolation, source versions, dataset IDs, QC mapping, software version, and result checksum.

## Accessibility

Provide a table with depth, observation, model, residual, QC, and uncertainty. Statistics shall be available as text and not only as chart graphics.
