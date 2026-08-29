# Units and Conversions

**File:** `docs/03-science-data/UnitsAndConversions.md`  
**Status:** Normative

## Policy

Source units shall be preserved. Canonical conversion occurs only through documented, tested, physically valid transformations.

## Unit fields

Each variable records:

- Source unit string.
- Parsed unit.
- Canonical unit.
- Display unit.
- Conversion method.
- Conversion-library version.
- Whether conversion is linear, affine, contextual, or scientific.

## Preferred conventions

Use CF-compatible and UDUNITS-compatible unit strings where possible.

Examples:

- Temperature: `degree_Celsius` or `K`, according to variable definition.
- Velocity: `m s-1`.
- Depth: `m`.
- Pressure: `dbar` or `Pa` as declared.
- Dissolved oxygen: retain source units; convert only with required density or molar-mass context.
- Chlorophyll mass concentration: preserve provider units.
- Absolute Salinity: `g kg-1`.
- Practical Salinity: dimensionless under PSS-78, explicitly identified.

## Conversion categories

### Linear

    target = source × scale

### Affine

    target = source × scale + offset

### Contextual

Requires additional variables, such as converting concentration per volume to per mass using density.

### Scientific-definition conversion

Requires an approved algorithm, such as Practical Salinity to Absolute Salinity through TEOS-10 inputs.

## Prohibited behavior

- Treating Practical and Absolute Salinity as identical.
- Converting pressure to depth without latitude and method metadata.
- Converting oxygen units without required density and chemical definitions.
- Comparing values with incompatible definitions because symbols appear similar.
- Dropping source units after normalization.
- Performing hidden shader-only scientific conversions.

## Display

Display rounding shall not alter stored values. Legends, axes, tooltips, inspectors, and exports shall always state units.

## Validation

Conversion tests include reference values, round-trip checks where meaningful, dimensional compatibility, offset units, extremes, missing values, and uncertainty conversion.
