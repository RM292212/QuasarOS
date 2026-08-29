# Rendering Benchmarks

**File:** `docs/04-rendering/RenderingBenchmarks.md`  
**Status:** Normative

## Purpose

Benchmarks measure repeatable performance and prevent optimization claims without evidence.

## Required benchmark record

- Commit and build.
- Browser and version.
- Operating system.
- CPU and memory.
- GPU and driver.
- Renderer backend.
- Viewport and device-pixel ratio.
- Dataset and manifest checksum.
- Variable and time.
- ROI and camera path.
- Quality profile.
- Cache state.
- Network conditions.

## Standard scenarios

### B1 — Cold start

Empty browser and application caches through first coarse volume.

### B2 — Warm start

Cached application and compressed bricks.

### B3 — Camera orbit

Scripted orbit through representative dense and sparse views.

### B4 — Transfer-function edit

Repeated opacity and color changes.

### B5 — Time-step switch

Current time to prefetched and non-prefetched times.

### B6 — Progressive refinement

Coarse LOD through target LOD.

### B7 — Memory pressure

Repeated variable, dataset, and time changes.

### B8 — Observation load

Dense marker field plus selected profile.

### B9 — WebGPU/WebGL2 parity

Equivalent scene and quality-class comparison.

## Metrics

- Time to usable shell.
- Time to first coarse image.
- Time to target refinement.
- Median, p95, and p99 frame time.
- CPU frame time.
- GPU frame time where supported.
- Main-thread long tasks.
- Network bytes.
- Decode and upload time.
- Cache hit rate.
- GPU and CPU memory.
- Brick residency churn.
- Cancelled and wasted requests.

## Benchmark classes

- Reference discrete GPU desktop.
- Integrated GPU laptop.
- Minimum supported WebGL2 device.
- Optional mobile outreach device.

## Reporting

Results shall include raw samples, summary tables, graphs, limitations, and comparison against the previous accepted baseline. A single favorable FPS number is not sufficient evidence.
