# LOD and Streaming

**File:** `docs/04-rendering/LODAndStreaming.md`  
**Status:** Normative

## LOD hierarchy

LOD 0 is the highest available resolution. Each coarser level reduces spatial resolution according to the processing configuration, typically by factors of two.

Downsampling shall be mask-aware and scientifically documented.

## Selection inputs

LOD selection considers:

- Projected voxel size.
- Camera distance.
- Viewport resolution.
- Current quality profile.
- Interaction state.
- ROI and clipping.
- GPU memory.
- Network and decode pressure.
- Brick availability.
- Time-animation state.

## Progressive workflow

1. Request visible coarse coverage.
2. Render coarse fallback.
3. Request visible target LOD.
4. Upload within frame budget.
5. Replace parent bricks after child residency.
6. Prefetch likely adjacent spatial and temporal bricks.
7. Evict low-value assets under pressure.

## Request priorities

- Current visible coarse bricks.
- Current visible refinements.
- Clipping and slice intersections.
- Selected/picked region.
- Next playback time.
- Adjacent spatial bricks.
- Background persistent cache.

## LOD transitions

Use parent fallback, hysteresis, and optional temporal blending. Blending shall not mix different scientific times unless temporal interpolation is explicitly enabled.

## Cancellation

Camera, ROI, variable, time, transfer-function, or dataset changes recalculate priorities. Obsolete queued work is cancelled or deprioritized.

## Backpressure

Bound:

- Concurrent fetches.
- Bytes in flight.
- Worker decodes.
- Decoded CPU bytes.
- Upload bytes per frame.
- GPU-resident slots.

## Failure

Failed child bricks retain parent fallback. Failed bricks shall not appear as zero. Persistent failures produce an incomplete-data indicator.

## Metrics

Measure first coarse image, target refinement time, bytes transferred, cache hit rate, cancellation count, residency churn, upload time, and visible fallback percentage.
