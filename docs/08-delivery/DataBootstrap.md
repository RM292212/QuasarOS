# DataBootstrap.md

## Purpose

Populate a new QuasarOS environment with the minimum catalog, scientific fixtures, render assets, observations, and reference cases required for development or validation.

## Bootstrap profiles

### Minimal

Used by unit-adjacent development and API smoke tests:

- One synthetic rectilinear scalar volume.
- Two time steps.
- Multiple depth levels.
- A constant field, axis gradients, and missing-value region.
- One vector field.
- One synthetic observation profile.

### Demo

Used for UI development and demonstrations:

- Curated regional model products.
- Bathymetry.
- Temperature, salinity, and currents.
- Observation profiles.
- Prepared render pyramids and thumbnails.
- Outreach story configuration.

### Validation

Used by CI and release qualification:

- Analytic fields.
- Dateline and polar examples.
- Curvilinear grid.
- QC and missing-data cases.
- Frozen real-data samples.
- Expected exact queries, profiles, and collocation results.

Production data is never loaded by a generic development bootstrap command.

## Bootstrap process

1. Validate environment identity and storage destination.
2. Create an isolated staging prefix.
3. Load fixture manifests and verify licenses.
4. Verify source checksums.
5. Run source decoding and metadata validation.
6. Generate canonical products.
7. Generate LOD pyramids, bricks, page indexes, and statistics.
8. Load observation tables and spatial indexes.
9. Register datasets and variables transactionally.
10. Run exact-query and manifest validation.
11. Atomically publish catalog visibility.
12. Write a bootstrap report containing versions and checksums.

## Idempotency

The same profile, fixture version, and processor configuration must not create duplicate catalog entities or different object keys. Existing matching immutable objects may be reused after checksum verification.

Changed processing configuration creates a new product version. Published objects are never overwritten.

## Safety controls

Bootstrap commands require an explicit environment and profile. Production execution requires an additional approval flag and must accept only production-approved manifests. A destructive reset command is unavailable in production builds.

## Completion criteria

A bootstrap succeeds only when:

- Every catalog record resolves to existing objects.
- Checksums and byte sizes match.
- Units, coordinates, time, and depth metadata validate.
- Exact reference probes pass.
- Both renderer manifests decode successfully.
- Provenance links source, processor, configuration, and output.
- Temporary objects are removed or scheduled for cleanup.
