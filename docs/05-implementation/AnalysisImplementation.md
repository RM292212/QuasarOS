# Analysis Implementation

**File:** `docs/05-implementation/AnalysisImplementation.md`  
**Status:** Normative

## Structure

Scientific analysis shall live in versioned Python modules, separate from FastAPI routes and UI code.

    python/quasar_analysis/
      collocation/
      profiles/
      statistics/
      climatology/
      derived/
      provenance/
      validation/

## Analysis contract

Every analysis operation declares:

- Operation ID and version.
- Required inputs.
- Supported variables and units.
- Coordinate requirements.
- QC policy.
- Interpolation method.
- Missing-data behavior.
- Output schema.
- Numerical tolerances.
- Provenance fields.

## Execution

1. API validates the request.
2. A bounded synchronous query or asynchronous job is created.
3. Worker resolves immutable input identities.
4. Canonical data are opened lazily.
5. Units and coordinates are validated.
6. QC and masks are applied.
7. Analysis is performed.
8. Results are validated.
9. Immutable outputs and provenance are stored.
10. Job state becomes `SUCCEEDED`.

## Initial operations

- Exact point query.
- Vertical model profile.
- Argo profile retrieval.
- Model-observation collocation.
- Residual profile.
- Bias, MAE, and RMSE.
- Current speed and direction.
- Compatible climatological anomaly.
- Approved TEOS-10 quantities.

## Rules

- Use canonical data, never GPU textures.
- Avoid silent extrapolation.
- Reject incompatible variable definitions.
- Accumulate statistics in adequate precision.
- Exclude invalid or QC-rejected values.
- Record valid-pair count and rejected reasons.
- Use GSW for approved TEOS-10 calculations.
- Preserve source and output units.

## Outputs

Small results use validated JSON. Large profile collections or arrays use Arrow, Parquet, or Zarr with a signed result URL.

## Verification

Each operation requires:

- Unit tests.
- Independent reference calculations.
- Pinned real-data validation.
- Missing-data tests.
- Unit-conversion tests.
- Provenance checks.
- Cancellation tests.
