# Variable Registry

**File:** `docs/03-science-data/VariableRegistry.md`  
**Status:** Normative

## Purpose

The variable registry maps provider-specific variables to stable QuasarOS scientific identities without erasing source definitions.

## Required fields

- Registry ID.
- Canonical name.
- Display name.
- Scientific definition.
- CF standard name where available.
- Source aliases.
- Scientific role.
- Topology.
- Source and canonical units.
- Expected dimensions.
- Coordinate requirements.
- Validity and QC rules.
- Precision policy.
- Default visualization.
- Derivation status.
- Vector component and basis metadata.
- Approved conversions.
- References.

## Initial physical variables

- Sea-water temperature.
- Potential temperature.
- Conservative Temperature.
- Practical Salinity.
- Absolute Salinity.
- Eastward current.
- Northward current.
- Upward current.
- Current speed.
- Sea-surface height.
- Mixed-layer depth or thickness.
- Pressure.
- Sea-floor depth or elevation.

## Initial biogeochemical variables

- Dissolved oxygen.
- Chlorophyll-a.
- Nitrate.
- Phosphate.
- Silicate.
- pH.
- Apparent oxygen utilization.
- Oxygen saturation.
- Suspended particulate matter.
- Primary production.

Availability does not imply every variable is a volume.

## Registry rules

- Similar names do not prove equivalence.
- Source variables retain original names.
- Different temperature and salinity definitions receive different registry IDs.
- Surface and depth-resolved variants declare different topology.
- Vector components declare basis, staggering, and sign.
- Derived variables identify all inputs and algorithms.
- Registry changes are versioned.

## Visualization defaults

Defaults may define:

- Palette.
- Physical display range.
- Opacity preset.
- Recommended topology.
- Log-scale eligibility.
- Unit formatting.
- Missing-value appearance.

Defaults are guidance, not changes to scientific values.

## Approval

New registry entries require scientific definition, source example, units, topology, validation method, and reviewer approval.
