# Observation Implementation

**File:** `docs/05-implementation/ObservationImplementation.md`  
**Status:** Normative

## Storage model

- Platform, profile, trajectory, time, position, and searchable metadata: PostgreSQL/PostGIS.
- Bulk measurement values: Parquet.
- Original provider files: authoritative object storage.
- Browser bulk delivery: Arrow IPC where beneficial.

## Ingestion

Observation adapters shall:

1. Acquire official source files.
2. Verify source identity.
3. Parse platform and profile metadata.
4. Preserve source variable names.
5. Preserve raw, adjusted, error, data-mode, and QC fields.
6. Normalize registry identities and approved units.
7. Write searchable metadata.
8. Write partitioned measurement tables.
9. Validate counts and sample values.
10. Publish atomically.

## Partitioning

Parquet should be partitioned by stable, useful dimensions such as provider, platform type, year, and region without producing excessive tiny files.

## APIs

Support:

- Spatial and time-bounded search.
- Platform lookup.
- Profile metadata.
- Profile measurements.
- Trajectory retrieval.
- Variable availability.
- QC filters.

Queries shall be paginated and bounded.

## Frontend

Markers are clustered or culled by screen density. Selecting a profile fetches detailed values. Full profiles shall not be embedded in every marker.

## Argo policy

Prefer adjusted values when provider rules and data mode support them. Raw and adjusted values remain distinct and visibly labelled. Source QC flags and errors are retained.

## Collocation

Observation IDs passed to collocation resolve to immutable source and normalized measurement identities. The active QC policy is included in the job identity.

## Validation

Compare profile counts, coordinates, time, pressure, temperature, salinity, adjusted values, and QC flags against official source files.
