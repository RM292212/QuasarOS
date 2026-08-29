# Coordinate Systems

**File:** `docs/03-science-data/CoordinateSystems.md`  
**Status:** Normative

## Policy

QuasarOS shall preserve source coordinates and explicitly document every transformation. Display coordinates shall never replace canonical scientific coordinates.

## Supported horizontal coordinate classes

- Geographic latitude/longitude.
- Projected Cartesian.
- Rotated geographic.
- Curvilinear.
- Local Cartesian.
- Unstructured mesh coordinates.

Every dataset shall declare:

- CRS identifier or WKT/PROJ definition.
- Axis names, units, order, and direction.
- Longitude convention.
- Coordinate bounds where available.
- Cell-center or cell-edge location.
- Datum and ellipsoid.
- Periodicity and antimeridian behavior.

## Canonical geographic coordinates

Canonical geographic positions use:

- Longitude in degrees east.
- Latitude in degrees north.
- WGS 84 for browser geographic context unless the source requires another documented datum.
- True scientific depth or source vertical coordinate handled separately.

Longitude shall be normalized only for querying or display. Original values remain preserved.

## Rendering transform

The rendering path is:

    source coordinates
      → validated canonical coordinates
      → geographic coordinates
      → ECEF or local ENU
      → display-space transform
      → optional visual vertical exaggeration

Scientific queries occur before display-space exaggeration.

## Local ENU

Regional volume rendering should use a local East-North-Up frame centered near the ROI to improve floating-point precision. The origin, ellipsoid, and transform matrix shall be stored in the render manifest.

## Vector transformation

Vector fields shall declare their source basis:

- Geographic east/north/up.
- Grid-aligned components.
- Projected x/y/z.
- Mesh-local basis.

Grid-relative vectors shall be rotated into a documented geographic or display basis before visualization. Rotation metadata and method shall be retained.

## Antimeridian and poles

Regions crossing the antimeridian shall use wrapped bounds or split spatial extents. Algorithms shall not treat `179°E` and `179°W` as globally separated. Polar datasets require explicit projection and singularity handling.

## Validation

Reject publication when:

- Coordinates are missing or non-finite beyond declared masks.
- CRS cannot be resolved.
- Latitude is outside valid range.
- Axis order is ambiguous.
- Coordinate dimensions conflict with data variables.
- Curvilinear cells are invalid or self-intersecting beyond allowed tolerance.
