# Rendering Architecture

**File:** `docs/04-rendering/RenderingArchitecture.md`  
**Status:** Normative

## System composition

    RenderCoordinator
      ├── CapabilityDetector
      ├── QualityManager
      ├── BrickScheduler
      ├── CPUBrickCache
      ├── GPUResidencyManager
      ├── TransferFunctionManager
      ├── VolumeRenderer
      ├── SurfaceRenderer
      ├── VectorRenderer
      ├── ObservationRenderer
      ├── PickingManager
      └── Diagnostics

## Backend selection

1. Detect WebGPU.
2. Request adapter and device.
3. Verify required limits and formats.
4. Select WebGPU quality profile.
5. On failure, request WebGL2.
6. Verify WebGL2 limits and extensions.
7. Select fallback profile.
8. If neither works, show unsupported-device guidance.

## Frame sequence

1. Read immutable frame-state snapshot.
2. Update camera and transforms.
3. Recalculate visible brick priorities.
4. Process bounded uploads.
5. Update page tables.
6. Render opaque terrain and surfaces.
7. Render volume.
8. Render vectors and observations.
9. Execute picking when requested.
10. Apply temporal reconstruction and post-processing.
11. Publish timing and status metrics.

## State separation

Scientific domain state is independent of backend resources. Backend changes preserve:

- Dataset.
- Variable.
- Time.
- ROI.
- Camera.
- Transfer function.
- Clipping.
- Selected observation.

## Data flow

The renderer receives manifests and immutable brick payloads. It does not parse NetCDF, perform authoritative unit conversion, or calculate canonical derived products.

## Scene ownership

Babylon.js owns the Scientific Volume Lab scene and backend engine. Custom shaders and resources integrate through Babylon lifecycle hooks without bypassing disposal and device-loss handling.

## Error boundaries

A layer failure disables that layer where possible. Fatal backend failure triggers recovery or fallback. Invalid scientific metadata prevents layer creation rather than producing guessed rendering.
