# Scientific Data Model

**File:** `docs/03-science-data/ScientificDataModel.md`  
**Status:** Normative

## Data layers

### Authoritative source

Provider-delivered bytes and metadata.

### Canonical scientific representation

Validated arrays retaining scientific meaning, source identity, coordinates, units, QC, uncertainty, and provenance.

### Derived scientific product

Values calculated from canonical inputs using a versioned algorithm.

### Rendering acceleration product

Quantized, chunked, multiresolution data intended for visualization.

## Scientific roles

- Model.
- Observation.
- Climatology.
- Bathymetry.
- Satellite.
- Derived analysis.
- Rendering acceleration.
- Test fixture.

## Topologies

- `VOLUME_SCALAR`
- `VOLUME_VECTOR`
- `SURFACE_SCALAR`
- `SURFACE_VECTOR`
- `TERRAIN`
- `PROFILE`
- `TRAJECTORY`
- `POINT_TIMESERIES`
- `MESH_SCALAR`
- `MESH_VECTOR`
- `MASK`
- `UNCERTAINTY`

Scientific role and topology are independent.

## Core variable model

Each variable includes:

- Stable registry ID.
- Source name.
- Canonical name.
- CF standard name where available.
- Long name.
- Scientific definition.
- Source, canonical, and display units.
- Datatype and precision.
- Dimensions.
- Coordinates.
- Topology.
- Validity and QC.
- Uncertainty.
- Vector basis or scalar role.
- Time semantics.
- Provenance.

## Dimensions

Standard axis tags:

- `T`: time.
- `Z`: vertical.
- `Y`: latitude or grid y.
- `X`: longitude or grid x.
- `N`: observation or node.
- `F`: face.
- `P`: profile.
- `L`: profile level.
- `C`: vector component.
- `E`: ensemble member.

Original dimension order shall be retained in source metadata.

## Core rule

Canonical scientific data drive analysis and exact inspection. Rendering products drive interactive graphics. Neither representation may silently impersonate the other.
