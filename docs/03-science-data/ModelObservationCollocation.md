# Model-Observation Collocation

**File:** `docs/03-science-data/ModelObservationCollocation.md`  
**Status:** Normative

## Purpose

Collocation compares observations with a compatible model estimate at approximately the same location, time, depth, variable definition, and unit.

## Required inputs

- Model dataset and version.
- Model variable.
- Observation profile or measurements.
- QC policy.
- Spatial method.
- Temporal method and maximum offset.
- Vertical method.
- Unit-conversion policy.
- Extrapolation policy.

## Processing sequence

1. Validate variable definitions.
2. Convert compatible units.
3. Apply observation QC.
4. Confirm observation lies within model domain.
5. Select permitted model times.
6. Locate horizontal cell or interpolation neighborhood.
7. Reconstruct physical model depths when necessary.
8. Interpolate model values vertically to observation levels.
9. Optionally interpolate temporally if explicitly enabled.
10. Reject unsupported or extrapolated pairs.
11. Calculate residuals and statistics.
12. Record complete provenance.

## Default V1 methods

- Horizontal: nearest valid cell or bilinear interpolation for supported structured grids.
- Temporal: nearest valid model time within configured tolerance.
- Vertical: linear interpolation in physical depth or pressure-compatible coordinates.
- Extrapolation: disabled.
- Residual: `model - observation`.

## Statistics

Report:

- Valid-pair count.
- Depth range.
- Mean bias.
- Mean absolute error.
- RMSE.
- Mean spatial separation.
- Time offset.
- Rejected-pair reasons.

Metrics shall not be calculated when the valid-pair count is below the configured minimum.

## Compatibility checks

Reject comparison when:

- Units are not convertible.
- Salinity or temperature definitions differ without an approved conversion.
- Observation time is outside tolerance.
- Position is outside the model domain.
- Vertical coordinates cannot be reconciled.
- Required model components are absent.
- Insufficient valid levels remain.

## Provenance

Store model and observation identities, QC flags, selected levels, interpolation weights, cell identities, algorithms, parameters, software versions, and output checksum.
