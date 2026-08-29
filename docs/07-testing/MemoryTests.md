# MemoryTests.md

## Purpose

Prevent unbounded CPU, GPU, browser-worker, and service memory growth during long scientific sessions.

## Budgets

Budgets are defined per supported quality profile and benchmark environment. Tests track:

- JavaScript heap.
- ArrayBuffer and transferable-buffer ownership.
- Browser worker memory.
- Decoded brick cache.
- GPU textures, buffers, bind groups, and pipelines.
- Cesium and Babylon scene resources.
- Backend process resident memory.
- Worker peak memory per job.

A budget change requires measured evidence and review.

## Browser scenarios

1. Load and unload 20 datasets.
2. Switch variables and time steps repeatedly.
3. Scrub the timeline for 10 minutes.
4. Fly between distant regions.
5. Open and close profiles, charts, and inspectors.
6. Toggle observation and vector layers.
7. Enter and leave Volume Lab repeatedly.
8. Force cache eviction.
9. Cancel requests during decoding and upload.
10. Recover from WebGPU device or WebGL context loss.

After warm-up and explicit cleanup, retained memory must return near a stable baseline. Growth is analyzed by trend rather than a single snapshot.

## Leak checks

Verify disposal of:

- Event listeners and subscriptions.
- Abort controllers and pending promises.
- Web workers and message ports.
- Object URLs.
- Cesium entities and primitives.
- Babylon meshes, materials, textures, and observables.
- GPU buffers and textures.
- Query-cache entries with expired ownership.
- Backend sessions, cursors, temporary files, and decoded arrays.

## Stress behavior

When a memory budget is reached, the application must reduce quality, evict low-priority resources, stop speculative prefetch, or reject work with a clear message. It must not crash, freeze indefinitely, or silently display stale data.

## Tooling and evidence

Use browser performance APIs, heap snapshots, allocation timelines, renderer resource counters, process metrics, and repeated-run statistical reports. GPU counters must be maintained by the resource manager because browser heap measurements do not represent device allocation.

## Gate

Block release for monotonic retained-memory growth, resources surviving owner disposal, budget overruns in P0 scenarios, or out-of-memory behavior without controlled degradation.
