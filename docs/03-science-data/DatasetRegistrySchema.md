# Dataset Registry Schema

**File:** `docs/03-science-data/DatasetRegistrySchema.md`  
**Status:** Normative

## Dataset record

Required fields:

    id
    schemaVersion
    title
    description
    providerId
    productId
    datasetVersion
    scientificRole
    processingLevel
    accessClass
    publicationState
    licence
    attribution
    spatialExtent
    temporalExtent
    variables
    gridId
    provenanceId
    createdAt
    updatedAt

## Scientific role

Allowed values:

- `MODEL`
- `OBSERVATION`
- `CLIMATOLOGY`
- `BATHYMETRY`
- `SATELLITE`
- `DERIVED`
- `RENDER_ACCELERATION`
- `TEST_FIXTURE`

## Publication state

- `DISCOVERED`
- `ACQUIRED`
- `VALIDATING`
- `VALIDATED`
- `PROCESSING`
- `READY`
- `PUBLISHED`
- `WITHDRAWN`
- `FAILED`

Only `PUBLISHED` records are visible to ordinary users.

## Spatial extent

Includes:

- CRS.
- Longitude and latitude bounds.
- Optional polygon or multipolygon.
- Vertical minimum and maximum.
- Vertical-coordinate type.
- Antimeridian-crossing indicator.

## Temporal extent

Includes:

- Start and end.
- Calendar.
- Time semantics.
- Model-reference times where applicable.
- Valid-time resolution.
- Climatology period where applicable.

## Variable reference

Each variable reference contains:

- Variable registry ID.
- Source variable name.
- Dimensions.
- Coordinates.
- Source and canonical units.
- Topology.
- Availability by time or depth.
- QC and uncertainty references.
- Render-product references.

## Source identity

Source records include:

- Source URI or query.
- Provider asset identifier.
- Retrieval timestamp.
- Checksum.
- Byte size.
- Media type.
- Source metadata snapshot.
- Credential-free acquisition method.

## Validation rules

Registry publication shall fail when:

- Required metadata is absent.
- Licence status is unknown.
- Variable registry mapping is unresolved.
- Grid or vertical coordinates are ambiguous.
- Source checksum is missing where obtainable.
- Provenance cannot connect the product to its source.
