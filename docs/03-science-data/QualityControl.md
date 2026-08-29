# Quality Control

**File:** `docs/03-science-data/QualityControl.md`  
**Status:** Normative

## QC layers

1. Provider QC.
2. Structural validation.
3. Scientific range and consistency validation.
4. Processing validation.
5. Rendering-product validation.
6. User-selected acceptance policy.

Provider QC flags shall always be preserved.

## Normalized categories

- `GOOD`
- `PROBABLY_GOOD`
- `QUESTIONABLE`
- `BAD`
- `CHANGED`
- `MISSING`
- `NOT_EVALUATED`
- `UNKNOWN`

Mappings are provider- and variable-specific and shall be versioned.

## Observation policy

Default scientific analysis should accept `GOOD` and, when approved, `PROBABLY_GOOD`. The active policy shall be visible and recorded in analysis provenance.

Rejected measurements remain available for authorized inspection but do not contribute to statistics.

## Model validation

Model QC includes:

- Required dimensions and coordinates.
- Finite valid values.
- Documented fill values.
- Plausible ranges.
- Time monotonicity.
- Grid validity.
- Land and seabed consistency.
- Unit compatibility.
- Vector-component compatibility.
- Source completeness.

Range checks flag suspicious values but shall not automatically delete scientifically possible extremes without product-specific rules.

## Rendering-product QC

Validate:

- Brick dimensions and halos.
- LOD coverage.
- Decoding.
- Quantization error.
- Min/max metadata.
- Occupancy masks.
- Validity masks.
- Geographic bounds.
- Time identity.
- Checksums.

## QC reporting

Reports contain:

- Dataset and variable.
- Rule ID and version.
- Severity.
- Affected count and fraction.
- Example locations.
- Pass, warning, or failure.
- Reviewer disposition.

## Publication rules

- Critical structural or scientific failures block publication.
- Warnings require documented acceptance.
- QC changes create new normalized products or policy versions.
- Source QC shall not be overwritten by normalized QC.
