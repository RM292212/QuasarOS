# FailureInjection.md

## Purpose

Demonstrate that QuasarOS fails safely, reports failures clearly, preserves scientific state, and recovers without silent corruption.

## Injection points

### Network and storage

- DNS or connection failure.
- High latency and packet interruption.
- HTTP 404, 429, 500, 503, and malformed responses.
- Expired signed URL.
- Missing, truncated, or checksum-invalid brick.
- Object-store partial outage.
- Offline-to-online transition.

### Services and jobs

- API restart during a request.
- Worker termination during each pipeline stage.
- Queue delay, duplicate delivery, and redelivery.
- Database connection loss or transaction rollback.
- Cache unavailability.
- Job timeout and cancellation race.
- Stale catalog or manifest reference.

### Browser and GPU

- WebGPU adapter unavailable.
- Device loss during upload or rendering.
- WebGL context loss.
- Shader compilation failure.
- Texture allocation failure.
- Worker crash.
- Storage quota exhaustion.
- Memory-pressure eviction.

### Data correctness

- Unsupported calendar.
- Invalid coordinate order.
- Inconsistent units.
- Unknown QC code.
- NaN, infinity, extreme values, and all-missing bricks.
- Product version changed while a session is active.

## Expected behavior

For every injected fault, verify:

- No incorrect value is presented as valid.
- Partial products are not published.
- Requests and jobs reach a defined terminal or retryable state.
- Retries are bounded, jittered, and limited to safe operations.
- User-facing messages state impact and available action.
- Correlation identifiers are available without exposing secrets.
- Camera, dataset, time, and analysis state survive recoverable renderer faults.
- Resources are released after cancellation or failure.
- Recovery does not duplicate jobs or catalog records.

## Methods

Use service proxies, deterministic fake failures, container termination, browser network controls, synthetic corrupt assets, forced GPU-loss hooks available only in test builds, and fault-aware adapters. Production code must not expose unauthenticated fault controls.

## Pass criteria

A test passes only when the fault is observed, the expected degraded state is asserted, recovery is demonstrated where supported, and logs contain sufficient diagnostic context. Crashes, infinite retries, blank unexplained canvases, stale scientific values, leaked resources, and silent fallback are release blockers.
