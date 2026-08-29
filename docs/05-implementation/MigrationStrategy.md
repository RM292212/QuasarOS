# Migration Strategy

**File:** `docs/05-implementation/MigrationStrategy.md`  
**Status:** Normative

## Scope

Migrations cover:

- PostgreSQL schemas.
- API schemas.
- Event schemas.
- Dataset registry schemas.
- Render manifests.
- Object-storage layouts.
- Configuration.
- Scientific algorithm versions.

## Database strategy

Use expand-migrate-contract:

1. Add backward-compatible schema.
2. Deploy code supporting old and new forms.
3. Backfill data.
4. Validate migration.
5. Switch readers and writers.
6. Remove obsolete fields in a later release.

Destructive changes shall not occur in the same release that introduces replacements.

## Data products

Scientific and rendering products are immutable. Changes to:

- Units.
- Algorithms.
- Regridding.
- QC.
- Quantization.
- Brick layout.
- Masks.
- Coordinate transformations.

create a new product version rather than mutating published objects.

## API and events

Additive optional changes may remain within a major version. Breaking changes require a new major version or explicit version field with a documented compatibility period.

## Object storage

Use versioned prefixes:

    source/{sourceVersion}/
    canonical/{productVersion}/
    render/{renderVersion}/
    results/{resultVersion}/

Do not overwrite immutable objects.

## Rollback

Before deployment:

- Confirm prior application compatibility.
- Back up critical metadata.
- Verify object-store references.
- Test rollback.
- Define catalog-pointer restoration.

## Migration jobs

Large backfills run as resumable jobs with checkpoints, metrics, and idempotent writes.

## Validation

After migration, verify row counts, constraints, spatial indexes, provenance links, checksums, sample scientific values, render manifests, and API compatibility.
