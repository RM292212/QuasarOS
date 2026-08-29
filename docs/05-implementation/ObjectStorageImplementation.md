# Object Storage Implementation

**File:** `docs/05-implementation/ObjectStorageImplementation.md`  
**Status:** Normative

## Buckets or prefixes

- `source`: authoritative provider assets.
- `canonical`: normalized scientific arrays.
- `render`: manifests, bricks, LODs, masks.
- `observations`: Parquet and Arrow products.
- `results`: analysis and export results.
- `temporary`: incomplete processing outputs.
- `evidence`: approved validation and benchmark artifacts.

## Key structure

Keys shall be server-generated and versioned. Example:

    render/{datasetId}/{productVersion}/{variableId}/{time}/{lod}/{x}/{y}/{z}

User-provided text shall not become an unchecked object key.

## Upload workflow

1. Write to temporary key.
2. Record content type and checksum.
3. Verify size and readability.
4. Complete multipart upload.
5. Copy or promote to immutable versioned key.
6. Register database reference.
7. Remove temporary data.

## Metadata

Object metadata includes:

- Schema version.
- Content encoding.
- Checksum.
- Source/product identity.
- Creation timestamp.
- Compression.
- Uncompressed size where relevant.

Scientific metadata remains in versioned manifests and registries, not only object headers.

## Browser access

- Public immutable assets may use CDN URLs.
- Restricted assets use signed URLs.
- Signed URLs have short expiry.
- CORS allows only approved origins and methods.
- Range requests are enabled where formats require them.

## Integrity

Validate checksums on ingestion and processing boundaries. Corrupt objects are quarantined and removed from publication.

## Lifecycle

Temporary objects expire automatically. Published objects remain while catalog, provenance, or retained results reference them.

## Security

- Disable anonymous bucket listing.
- Apply least-privilege service roles.
- Encrypt transport.
- Enable storage encryption according to deployment policy.
- Log privileged writes and deletions.
