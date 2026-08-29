# Time Semantics

**File:** `docs/03-science-data/TimeSemantics.md`  
**Status:** Normative

## Time types

QuasarOS distinguishes:

- `REFERENCE_TIME`: model initialization or analysis cycle.
- `FORECAST_PERIOD`: duration from reference time.
- `VALID_TIME`: time represented by a model field.
- `OBSERVATION_TIME`: measurement time.
- `START_TIME` and `END_TIME`: interval bounds.
- `CLIMATOLOGY_PERIOD`: month, season, or annual baseline.
- `INGESTION_TIME`: entry into QuasarOS.
- `PROCESSING_TIME`: generated-product time.
- `PUBLICATION_TIME`: catalog publication time.

Valid time is commonly:

    valid_time = reference_time + forecast_period

This relation shall be verified rather than assumed.

## Representation

- APIs use ISO 8601 timestamps with explicit UTC offsets.
- Internal instants use UTC where the source calendar permits.
- Source numeric time values, units, and calendars remain preserved.
- Non-Gregorian calendars require calendar-aware objects and shall not be silently converted to Gregorian dates.

## Intervals

Temporal averages and accumulations shall include:

- Start and end bounds.
- Cell method.
- Averaging or accumulation meaning.
- Timestamp placement.

An averaged field shall not be described as an instantaneous field.

## Climatology

Climatologies include:

- Baseline years.
- Month, season, or annual period.
- Statistical method.
- Depth levels.
- Product version.

Climatology is not assigned a false real-time timestamp.

## Matching

Model-observation matching records:

- Observation time.
- Selected model valid time or bracketing times.
- Absolute time offset.
- Maximum allowed offset.
- Temporal interpolation method.

## UI

The timeline shall display valid time prominently and provide reference time and lead where relevant. Ambiguous labels such as only “time” shall be avoided in scientific metadata.

## Validation

Check monotonicity, duplicates, calendar, timezone, bounds, reference-plus-lead consistency, missing steps, and requested-range containment.
