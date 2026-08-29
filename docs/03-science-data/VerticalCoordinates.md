# Vertical Coordinates

**File:** `docs/03-science-data/VerticalCoordinates.md`  
**Status:** Normative

## Supported types

- Geometric depth.
- Height.
- Pressure.
- Fixed model level.
- Sigma coordinate.
- Hybrid coordinate.
- Terrain-following coordinate.
- Isopycnal coordinate.
- Provider-specific dimensionless coordinate with documented formula terms.

## Required metadata

Every vertical axis shall declare:

- Coordinate variable.
- Type.
- Units.
- Positive direction.
- Datum or reference surface.
- Bounds where available.
- Time dependence.
- Horizontal dependence.
- Formula terms for dimensionless coordinates.
- Cell-center or interface location.
- Monotonicity.
- Relationship to bathymetry and sea-surface height.

## Canonical depth

Where needed for visualization, physical depth is represented as meters positive downward. The source coordinate and conversion method remain preserved.

Conversion to depth may require:

- Latitude.
- Pressure.
- Sea-surface height.
- Bathymetry.
- Model coefficients.
- Time-dependent free surface.

## Pressure

Pressure is not interchangeable with depth. Pressure-to-depth conversion shall use a documented approved method and required latitude information.

## Sigma and terrain-following grids

Physical depths shall be reconstructed from the documented formula terms for the selected time and horizontal location. A single global depth array shall not be assumed.

## Rendering

Render products may use:

- Regularized depth levels.
- Coordinate lookup textures.
- Per-column depth metadata.
- Curvilinear geometry.

The selected strategy shall record interpolation and approximation errors.

## Vertical exaggeration

Vertical exaggeration affects display geometry only. Exact queries, profiles, exports, and statistics use true vertical coordinates.

## Validation

Verify:

- Positive direction.
- Units.
- Monotonicity per column.
- Surface and seabed consistency.
- Formula-term completeness.
- No invalid inversion.
- Pressure/depth reference values.
- Time dependence.
- Correct handling of dry or below-seabed cells.

Ambiguous vertical coordinates block scientific publication and volume-product generation.
