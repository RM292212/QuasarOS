# Data Plane Architecture

**File:** `docs/02-architecture/DataPlaneArchitecture.md`  
**Status:** Normative

## Definition

The data plane moves large immutable or append-only scientific and rendering assets between storage, processing services, and browsers.

## Asset classes

| Asset | Preferred format |
|---|---|
| Authoritative source | NetCDF or provider-native |
| Canonical arrays | Zarr, virtual Zarr, or referenced NetCDF |
| Volume bricks | Compressed binary GPU-oriented bricks |
| Render manifests | Versioned JSON |
| Observation tables | Parquet |
| Browser observation payloads | Arrow IPC or bounded JSON |
| Derived arrays | Zarr |
| Export packages | Versioned documented formats |

## Delivery path

    Object storage/CDN
        ↓ HTTPS range or object request
    Browser request scheduler
        ↓
    Worker decode and validation
        ↓
    CPU cache
        ↓
    GPU upload and page-table update

Large payloads shall not pass through the control-plane API by default.

## Brick organization

Each brick record identifies:

- Dataset and render-product version.
- Variable and valid time.
- LOD.
- Brick coordinates.
- Interior shape and halo.
- Texture representation.
- Compression.
- Checksum.
- Minimum and maximum.
- Occupancy or histogram mask.
- Valid count.
- Quantization scale and offset.

Recommended initial interior shape: `64 × 64 × 32`, subject to benchmarking.

## Immutability

Published object keys shall be content-addressed or version-addressed. Reprocessing produces new keys. Mutable aliases may point to the current published version but shall not alter historical identities.

## Transport

- HTTPS is mandatory outside trusted local development.
- HTTP compression applies to metadata; precompressed bricks shall not be recompressed blindly.
- Range requests may be used for sharded Zarr and compatible packed assets.
- CDN caching may be used for public immutable assets.
- Signed URLs protect restricted assets.

## Integrity

Clients validate:

- Expected length.
- Format version.
- Checksum where provided.
- Brick identity.
- Decompressed size.
- Texture representation.

Corrupt assets are discarded, never uploaded, and retried within limits.

## Backpressure

The browser scheduler limits:

- Concurrent requests.
- Compressed bytes in flight.
- Decode tasks.
- Decoded CPU bytes.
- Upload bytes per frame.
- GPU residency.

Workers and storage clients similarly enforce memory and concurrency limits.

## Security

Object keys are server-generated. User input shall never become an unchecked filesystem path. Signed URLs are scoped, temporary, and excluded from logs and reproducibility exports.

