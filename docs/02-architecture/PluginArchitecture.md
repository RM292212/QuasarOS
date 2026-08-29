# Plugin Architecture

**File:** `docs/02-architecture/PluginArchitecture.md`  
**Status:** Normative

## Purpose

Plugins extend data acquisition, normalization, analysis, and visualization through controlled contracts. Arbitrary runtime code downloaded from data providers is prohibited.

## Plugin types

### Data-source plugin

Required operations:

- `discover`
- `inspectMetadata`
- `acquire`
- `verify`
- `listVariables`
- `readSubset`
- `mapSourceMetadata`
- `describeLicence`

### Grid adapter

Required operations:

- Classify grid.
- Validate coordinates.
- Locate cells.
- Transform geographic and model coordinates.
- Define vertical mapping.
- Describe staggering.
- Generate rendering coordinates.

### Observation plugin

Required operations:

- Discover platforms and profiles.
- Normalize metadata.
- Preserve source QC.
- Map variables.
- Read measurements.
- Build trajectory and profile products.

### Derived-field plugin

Required declarations:

- Inputs.
- Output variable.
- Units.
- Formula or library.
- Parameters.
- Missing-data behavior.
- Algorithm version.
- Validation tests.

### Render-layer plugin

Allowed only through renderer contracts. It declares topology, resources, frame inputs, lifecycle, picking, accessibility representation, and backend capabilities.

## Registration

Plugins are registered at build time or trusted server startup. Registration includes:

- Unique ID.
- Semantic version.
- Supported schema versions.
- Capabilities.
- Configuration schema.
- Maintainer.
- Licence.
- Security classification.

## Isolation

- Provider plugins do not write directly to catalog tables.
- Plugins return validated domain objects through service interfaces.
- Plugins receive scoped storage and network clients.
- Render plugins do not access authentication tokens.
- Scientific plugins do not depend on UI components.

## Failure handling

Plugin failures produce typed errors and do not publish partial products. Repeated failures are observable and may disable the plugin until reviewed.

## Compatibility

Breaking contract changes require a new plugin API major version. Plugins declare compatible platform versions. Unsupported plugins fail at startup, not during a user workflow.

## Security

Plugins are trusted deployment code, not a public extension marketplace. New plugins require:

- Code review.
- Dependency review.
- Licence review.
- Input-bound testing.
- Resource-limit review.
- Scientific validation where applicable.

