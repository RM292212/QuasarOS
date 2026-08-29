# PerformanceTests.md

## Purpose

Measure responsiveness, throughput, rendering stability, and scalability using reproducible workloads.

## Principles

- Performance results are meaningful only with recorded hardware, browser, renderer, dataset, configuration, and build revision.
- Cold-cache and warm-cache results are reported separately.
- Median, p95, and p99 are preferred over single measurements.
- Performance tests must not weaken scientific correctness.
- Relative regressions and absolute usability budgets are both enforced.

## Browser metrics

Measure:

- Application bootstrap and time to usable shell.
- Catalog query latency.
- Time to first geographic overview.
- Time to first coarse volume.
- Time to requested target quality.
- Frame time, frames per second, and long frames.
- Input-to-visual-response latency.
- Timeline frame readiness.
- Brick fetch, decode, validation, and upload latency.
- Main-thread blocking time.
- CPU and GPU memory.
- Network bytes and request concurrency.

## Service metrics

Measure:

- API request throughput and latency.
- Spatial query performance.
- Manifest generation and lookup.
- Object-store request latency.
- Queue wait and job execution time.
- Ingestion throughput.
- Exact-value and collocation latency.
- Database connections, cache hit ratio, and worker memory.

## Standard workloads

- Small regional rectilinear volume.
- Global multilevel volume with progressive LOD.
- Dense observation region.
- Rapid time scrubbing.
- Multiple concurrent users selecting overlapping data.
- Cold cache and constrained network.
- WebGPU and WebGL 2 renderer paths.
- High-DPI and integrated-GPU configurations.

## Regression rules

For stable benchmark environments:

- A statistically significant regression greater than 10% requires investigation.
- A regression greater than 20% in a P0 metric blocks release unless explicitly approved.
- Frame-time distributions must be inspected for stutter even when average FPS is acceptable.
- Baselines are updated only with reviewed evidence, never automatically from a failing run.

## Noise control

Use pinned browser/container versions, fixed power settings, warm-up iterations, isolated runners, deterministic camera paths, fixed viewport and device-pixel ratio, and repeated samples. Physical-GPU tests must record adapter and driver details.

## Output

Publish machine-readable results, trend charts, traces, and build metadata. Performance failures must identify the affected workload, metric, baseline, observed distribution, and probable subsystem.
