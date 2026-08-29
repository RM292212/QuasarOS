# Uncertainty Model

**File:** `docs/03-science-data/UncertaintyModel.md`  
**Status:** Normative

## Principle

Uncertainty, error estimates, spread, variability, and QC are related but distinct concepts and shall not be merged.

## Uncertainty types

- Instrument uncertainty.
- Calibration uncertainty.
- Adjusted-value error.
- Model uncertainty.
- Ensemble spread.
- Analysis error.
- Climatological standard deviation.
- Interpolation uncertainty.
- Representativeness error.
- Quantization error.
- Algorithmic uncertainty.
- Unknown or unavailable uncertainty.

## Required fields

An uncertainty record includes:

- Target variable or measurement.
- Uncertainty type.
- Value or field reference.
- Units.
- Confidence level or coverage factor where applicable.
- Distribution or interpretation.
- Method.
- Source.
- Algorithm version.
- Correlation assumptions.
- Validity range.
- Provenance ID.

## Rules

- QC flags shall not be presented as numerical uncertainty.
- Standard deviation shall not automatically be described as measurement error.
- Ensemble spread shall not be presented as total forecast uncertainty.
- Missing uncertainty shall be represented as unavailable, not zero.
- Unit conversion shall also convert compatible uncertainty values.
- Derived-product uncertainty propagation shall declare assumptions.

## Model-observation comparison

Comparison output should distinguish:

- Observation uncertainty.
- Model uncertainty if available.
- Spatial and temporal separation.
- Interpolation effects.
- Residual.

Residual magnitude alone is not an uncertainty estimate.

## Rendering

Uncertainty may be shown through:

- Separate scalar layers.
- Error bars.
- Bands.
- Opacity.
- Hatching.
- Glyph variation.
- Ensemble summaries.

Color-only encoding shall be avoided.

## Quantization

Rendering quantization error is technical uncertainty and shall be reported separately from scientific uncertainty.

## Validation

Validate non-negative magnitudes where appropriate, unit compatibility, confidence interpretation, missing-state handling, and correct association with source values.
