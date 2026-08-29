# EndToEndTests.md

## Purpose

Validate complete user journeys through the deployed browser, API, workers, database, and object storage.

## Framework

Playwright is the primary browser automation framework. Tests use role-based locators and user-visible behavior. CSS selectors, arbitrary sleeps, and direct mutation of application state are prohibited unless no stable public interaction exists.

## P0 journeys

1. Open the application and complete capability detection.
2. Browse the catalog and select a dataset, variable, region, depth range, and time.
3. Navigate from Cesium Overview to Volume Lab while preserving context.
4. Progressively load and render a scalar volume.
5. Edit the transfer function and verify legend, range, and rendered response.
6. Add a clipping plane or slice.
7. Pick a location and obtain approximate followed by exact scientific values.
8. Animate time and pause on a deterministic frame.
9. Discover an observation profile and compare it with model output.
10. Export a reproducibility record and reload the represented state.
11. Recover from an asset failure and renderer device/context loss.
12. Complete the equivalent workflow using the WebGL 2 fallback.

## Test design

Each scenario:

- Starts from a known environment and seeded catalog.
- Uses deterministic clocks, identifiers, and fixture data.
- Verifies visible state and relevant backend side effects.
- Records renderer choice and dataset version.
- Cleans up created jobs or saved configurations.
- Captures trace, console output, network log, and screenshot on failure.

Tests must not depend on execution order.

## Assertions

Prefer assertions on:

- Accessible labels and status text.
- URL and workspace state.
- API responses and job status.
- Exact scientific inspection values.
- Loaded brick counts and completion state.
- Reproducibility export contents.
- Renderer diagnostics.
- User-visible error recovery.

Screenshot assertions supplement, but do not replace, semantic and scientific assertions.

## Network behavior

Dedicated cases emulate latency, offline transitions, 404 and 503 responses, signed-URL expiry, truncated assets, and request cancellation. Retry assertions must use bounded deterministic timing.

## Execution schedule

- Pull request: tagged P0 smoke tests.
- Main branch: complete deterministic suite.
- Nightly: browser matrix and selected physical-GPU tests.
- Release candidate: production-like deployment, both renderers, full journeys, and retained evidence.

A release is blocked by any reproducible failure in a P0 journey.
