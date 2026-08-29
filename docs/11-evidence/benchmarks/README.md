# Benchmarks

This directory stores reproducible performance, scalability, memory, and rendering benchmark evidence.

## Required benchmark groups

- Application bootstrap.
- Catalog and API latency.
- Time to first coarse volume.
- Time to target rendering quality.
- Brick fetch, decode, validation, and upload.
- Frame-time distribution.
- Timeline playback and scrubbing.
- Exact-value and collocation latency.
- Worker throughput.
- Database and object-storage performance.
- CPU, browser, worker, and GPU memory.
- WebGPU and WebGL 2 comparison.
- Cold-cache and warm-cache behavior.

## Naming

Use:

`<release>-<environment>-<benchmark>-<renderer>-<timestamp>.<extension>`

Use `none` as the renderer when the benchmark is not renderer-specific.

## Required metadata

Each result includes:

- Release, commit, and artifact digest.
- Benchmark-suite version.
- Browser and operating system.
- CPU, memory, GPU, and driver.
- Renderer and quality profile.
- Viewport and device-pixel ratio.
- Dataset and product version.
- Network and cache condition.
- Iteration count and warm-up policy.
- Median, p95, p99, minimum, and maximum where applicable.
- Baseline and percentage change.
- Test seed and configuration.

## Baselines

Baselines are reviewed, immutable records. A failing benchmark must not automatically replace its baseline. Baseline updates require an explanation of the intentional change and confirmation that scientific correctness was preserved.

## Large artifacts

Traces and profiles may be stored in approved external artifact storage. Commit only small summaries and manifests to the repository.

## Release gate

A statistically significant regression greater than the approved budget requires investigation. P0 regressions greater than the blocking threshold require remediation or a documented, time-limited exception.
