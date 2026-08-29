# Cache Architecture

**File:** `docs/02-architecture/CacheArchitecture.md`  
**Status:** Normative

## Goals

- Bound browser and server memory.
- Reduce repeated network and decode work.
- Preserve interactive frame rates.
- Prevent stale dataset, variable, time, or LOD data from being displayed.
- Separate scientific and rendering caches.

## Browser cache hierarchy

1. **HTTP/browser cache:** immutable manifests, bricks, and static assets.
2. **Persistent cache:** optional Cache Storage or IndexedDB for approved public products.
3. **Compressed brick cache:** downloaded compressed payloads.
4. **Decoded CPU cache:** upload-ready brick data.
5. **GPU cache:** resident atlas slots, textures, buffers, and page-table entries.

Each layer has an independent budget and eviction policy.

## Cache key

A rendering asset key includes:

- Render-product ID.
- Variable ID.
- Valid time.
- LOD.
- Brick coordinates.
- Texture representation.
- Product version.
- Checksum or immutable content identity.

Scientific-query caches additionally include interpolation, coordinate, QC, unit, and algorithm parameters.

## GPU residency

The GPU cache uses:

- Fixed-size atlas slots or bounded texture resources.
- Page-table entries mapping virtual bricks to resident slots.
- Generation numbers to prevent stale references.
- Pinning for coarse fallback LODs and currently visible critical bricks.
- LRU or weighted-LRU eviction.

A slot shall be marked resident only after upload completion.

## Request priorities

Highest to lowest:

1. Visible coarse fallback.
2. Visible current-time bricks.
3. Visible refinement.
4. Near-future playback prefetch.
5. Neighboring spatial prefetch.
6. Background persistent caching.

Priority recalculates after camera, ROI, variable, time, or transfer-function changes.

## Invalidation

Invalidate cache entries when any identity component changes, including:

- Source checksum.
- Processing configuration.
- Quantization.
- Brick shape or halo.
- Coordinate transformation.
- Algorithm version.
- Validity-mask generation.
- Security scope.

Transfer-function changes invalidate visibility decisions, not scalar brick data.

## Server caches

Server-side caches may store:

- Catalog responses.
- Signed-URL metadata.
- Open canonical-array handles.
- Coordinate indexes.
- Completed immutable analysis results.
- Provider discovery metadata.

Authorization-sensitive responses require identity-aware keys.

## Failure rules

- Missing cache entries are not scalar zero.
- Corrupt checksums cause eviction and bounded retry.
- Expired signed URLs are refreshed through the control plane.
- Persistent-cache failures degrade to memory and network operation.
- Cache clearing shall not alter canonical source data.

## Metrics

Track:

- Hit and miss rate by layer.
- Bytes stored and evicted.
- Decode and upload time.
- Residency churn.
- Stale-request cancellation.
- Failed checksum count.
- Budget pressure.
- Coarse-fallback usage.

