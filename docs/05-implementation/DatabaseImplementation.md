# Database Implementation

**File:** `docs/05-implementation/DatabaseImplementation.md`  
**Status:** Normative

## Technology

Use PostgreSQL with PostGIS for:

- Catalog metadata.
- Spatial extents.
- Observation indexes.
- Jobs and results.
- Provenance.
- Access policy.
- Audit metadata.

Large multidimensional arrays and profile values shall not be stored as large JSON documents.

## Schema groups

- `catalog`
- `sources`
- `science`
- `observations`
- `processing`
- `analysis`
- `security`
- `audit`

## Identity

Use UUIDs or stable content-derived identifiers. Human-readable provider IDs may be unique alternate keys.

Immutable scientific products shall have unique constraints over their full identity, including source checksum and processing version.

## Spatial data

Use PostGIS geometry/geography for:

- Dataset footprints.
- Observation locations.
- Trajectories.
- ROI queries.

CRS shall be explicit. Spatial indexes are mandatory for searchable geometry.

## Transactions

Use transactions for:

- Dataset publication.
- Job-state transitions.
- Provenance linkage.
- Result registration.
- Access-policy changes.

Object-store uploads complete and validate before database publication references are committed.

## Indexing

Index:

- Dataset publication state.
- Provider and product.
- Variable.
- Valid-time range.
- Observation platform and time.
- Spatial geometry.
- Job owner and state.
- Provenance parent references.

## Access layer

Repositories own database queries. Routes and UI code shall not use SQL directly. Queries use parameter binding.

## Performance

Avoid N+1 query patterns. Paginate collections. Use query plans and measured indexes before denormalizing.

## Backup

Back up database state, migration history, provenance, access policy, and object-reference metadata. Recovery tests shall verify consistency with object storage.

## Prohibited storage

- Credentials.
- Signed URLs.
- Unbounded volume arrays.
- Raw binary source files.
- GPU brick payloads.
- Unversioned arbitrary metadata blobs.
