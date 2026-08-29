# ADR-0003: WebGL 2 as the Required 3-D Fallback

- **Status:** Accepted
- **Decision type:** Rendering compatibility
- **Owners:** Rendering and architecture teams

## Context

WebGPU provides modern resource binding, compute support, validation, and performance characteristics suitable for QuasarOS. However, WebGPU availability may be limited by browser version, operating system, GPU driver, enterprise policy, remote desktop, virtualization, or device capability.

QuasarOS must remain useful on supported systems where WebGPU cannot initialize or becomes unavailable. A two-dimensional metadata-only fallback does not satisfy the minimum 3-D scientific workflow.

## Decision

Use WebGPU as the preferred rendering backend and WebGL 2 as the required functional 3-D fallback.

Backend selection is based on runtime capability and successful initialization, not user-agent strings.

The selection sequence is:

1. Check whether WebGPU is permitted and available.
2. Request an adapter and device.
3. Validate required limits and features.
4. Perform a minimal initialization and rendering check.
5. Select WebGPU if healthy.
6. Otherwise initialize WebGL 2.
7. Enter non-3-D degraded mode only if both backends fail.

Users may force WebGL 2 for diagnostics or compatibility.

## Required parity

Both backends must support:

- Scalar-volume rendering.
- Transfer functions.
- Progressive brick loading.
- Missing-data masking.
- Time-step selection.
- Clipping and slices.
- Approximate visual picking.
- Exact-value query handoff.
- Observation rendering.
- Resource disposal and recovery.
- Reproducibility metadata identifying the backend.

Backend differences must not change:

- Coordinate placement.
- Variable or unit meaning.
- Selected time.
- Masking semantics.
- Transfer-function domain.
- Exact scientific values.
- Product provenance.

## Permitted differences

WebGL 2 may use:

- Smaller texture atlases.
- Lower cache and brick concurrency.
- Fewer simultaneous optional layers.
- Reduced sampling quality.
- CPU preprocessing instead of compute shaders.
- Reduced optional lighting or particle effects.
- More aggressive LOD selection.

Any reduction must be visible in renderer diagnostics and quality-profile state.

## Shared architecture

Shared packages define scene state, brick manifests, transfer functions, quality profiles, and scientific transforms. Backend packages implement GPU-specific bindings, shaders, upload paths, page tables, and capability limits.

Backend-specific behavior must not leak into scientific domain packages.

## Failure recovery

If WebGPU device loss cannot be recovered safely:

1. Preserve serializable scene and application state.
2. Dispose invalid resources.
3. Attempt one controlled WebGPU reinitialization when appropriate.
4. Fall back to WebGL 2.
5. reload required render assets.
6. notify the user of the backend change.

Repeated initialization loops are prohibited.

## Consequences

Maintaining two backends increases development and test cost, but broadens compatibility and provides operational resilience.

## Validation

Every release runs shared reference scenes, shader checks, scientific probes, browser tests, and selected physical-GPU tests against both backends.
