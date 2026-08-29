# Grid Topology

**File:** `docs/03-science-data/GridTopology.md`  
**Status:** Normative

## Grid classes

### Regular geographic

One-dimensional longitude and latitude axes forming a rectilinear grid.

### Rectilinear projected

One-dimensional x and y axes in a projected CRS.

### Curvilinear

Two-dimensional longitude and latitude coordinates associated with grid cells.

### Rotated geographic

Grid coordinates use a rotated pole and require transformation to geographic coordinates.

### Staggered structured

Variables occupy different cell locations, including Arakawa A, B, C, or other declared staggering.

### Unstructured

Nodes, edges, faces, and connectivity explicitly define the mesh.

### Local Cartesian

Regional x/y/z coordinates tied to a documented origin and CRS.

## Required grid metadata

- Grid ID and class.
- Horizontal dimensions.
- Coordinate variables.
- Cell-center and boundary coordinates.
- CRS.
- Periodicity.
- Longitude convention.
- Orientation.
- Cell mask.
- Cell area where available.
- Connectivity for unstructured grids.
- Staggering for each variable.
- Vertical-coordinate association.

## Rendering eligibility

| Grid class | V1 rendering policy |
|---|---|
| Regular geographic | Directly supported |
| Rectilinear projected | Supported through validated transform |
| Curvilinear | Resample for V1; preserve source grid |
| Rotated geographic | Transform or validated resampling |
| Staggered structured | Destagger before scalar/vector product generation |
| Unstructured | Deferred unless preprocessed to supported products |
| Local Cartesian | Supported with explicit georeferencing |

## Grid identity

A grid identity changes when coordinates, bounds, topology, connectivity, staggering, CRS, or masks change.

## Validation

Validate:

- Coordinate monotonicity where required.
- Dimensional compatibility.
- Cell bounds.
- Duplicate or inverted cells.
- Connectivity range.
- Periodicity.
- Land and ocean masks.
- Vector component locations.
- Dateline behavior.
- Vertical association.

Grid transformations shall be recorded in provenance and shall not overwrite source-grid metadata.
