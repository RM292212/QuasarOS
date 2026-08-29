# ADR-0006: Object Storage as the Scientific Data Plane

- **Status:** Accepted
- **Decision type:** Storage and runtime architecture
- **Owners:** Platform, data, and architecture teams

## Context

QuasarOS scientific assets include source files, canonical NetCDF products, Zarr chunks, render bricks, manifests, observations, exports, thumbnails, and provenance artifacts. These objects may be large, numerous, immutable, and frequently delivered directly to browsers.

Relational databases are appropriate for searchable metadata, spatial indexes, job state, access policy, and provenance relationships, but not for storing high-volume scientific binary payloads.

Shared container filesystems do not provide the required durability, independent scaling, CDN integration, or immutable addressing.

## Decision

Use S3-compatible object storage as the primary scientific data plane.

PostgreSQL/PostGIS remains the control-plane database and stores:

- Dataset and product metadata.
- Spatial and temporal coverage.
- Variable definitions.
- Observation indexes where appropriate.
- Object references and checksums.
- Processing jobs.
- Provenance relationships.
- Access policy and publication state.

Object storage contains:

- Original source assets.
- Canonical NetCDF.
- Visualization-ready Zarr and render bricks.
- Render manifests and indexes.
- Large observation partitions.
- Derived exports.
- Thumbnails and preview artifacts.
- Processing logs or reports designated for artifact retention.

## Object identity

Published objects use deterministic, versioned keys containing stable dataset, product, format, and object identifiers. Mutable aliases may aid discovery but must resolve to immutable versions.

Each catalog reference includes:

- Bucket or logical store.
- Object key.
- Product version.
- Checksum.
- Byte size.
- Media type.
- Compression or codec.
- Creation and provenance information.

## Publication

Workers write to a staging prefix. Publication occurs only after:

1. Every required object exists.
2. Checksums validate.
3. Manifests reference the final immutable keys.
4. Scientific validation passes.
5. The catalog transaction marks the product published.

The catalog must never expose a partially written product.

## Browser delivery

Public or authorized assets may be delivered through a CDN using immutable cache headers. Restricted assets use short-lived scoped signed URLs or authorized proxy access.

Signed URLs must not become durable product identifiers and must not be logged in full.

## Security and durability

Enable encryption, versioning, lifecycle rules, access logging, and deletion protection appropriate to the environment. Services use workload identity and prefix-scoped permissions.

## Consequences

### Positive

- Independent scaling of metadata and binary data.
- Efficient parallel and range retrieval.
- CDN compatibility.
- Strong immutable-version model.
- Lower database load.

### Negative

- Catalog and object state must be reconciled.
- Object counts and request costs require monitoring.
- Publication requires careful atomicity.
- Signed URL expiry affects long sessions.

## Rejected alternatives

- PostgreSQL BLOB storage.
- Shared persistent filesystem as the primary data plane.
- API proxying of every public object.
- Mutable object keys without checksums.

## Validation

Run scheduled catalog-to-object reconciliation, checksum sampling, orphan detection, signed-access tests, and restoration exercises.
