# BrowserCompatibility.md

## Purpose

Define the browser, operating-system, graphics-backend, and device matrix used to qualify QuasarOS.

## Support policy

The application supports the current and previous stable releases of:

- Google Chrome.
- Microsoft Edge.
- Mozilla Firefox.
- Apple Safari.

Support is evaluated on vendor-supported Windows, macOS, and Linux versions. Safari is evaluated on supported macOS and iPadOS releases. Mobile support prioritizes Outreach mode; Operational Volume Lab capabilities may be reduced according to resource limits.

## Graphics matrix

| Browser family | WebGPU path | WebGL 2 path |
|---|---:|---:|
| Chromium | Required when available and healthy | Required fallback |
| Firefox | Required when enabled and conformant | Required fallback |
| Safari/WebKit | Required when available and healthy | Required fallback |
| Restricted or virtualized browser | Optional | Required if WebGL 2 is available |

Capability detection, not user-agent detection, selects the backend. A failed WebGPU initialization must fall back to WebGL 2 without losing dataset selection, time, camera, or analysis state.

## Test coverage

Each supported project verifies:

- Bootstrap and configuration loading.
- Authentication callback.
- Dataset browsing.
- Cesium overview navigation.
- Volume loading and camera interaction.
- Transfer-function editing.
- Clipping and slicing.
- Exact-value inspection.
- Timeline playback.
- Observation selection and profile comparison.
- Renderer fallback and context/device loss.
- Export of reproducibility metadata.
- Keyboard and responsive behavior.

## Graphics validation

Record:

- Browser and engine version.
- Operating system.
- GPU vendor, device class, and driver where exposed.
- Selected renderer and adapter limits.
- Enabled extensions and texture formats.
- Canvas resolution and device-pixel ratio.

Renderer output is evaluated by scientific probes and tolerant image comparisons. Pixel identity across vendors is not required; topology, masking, value mapping, layer placement, and interaction results must remain equivalent.

## Degraded environments

When neither WebGPU nor WebGL 2 is usable:

- The application remains navigable.
- Dataset metadata, charts, tables, and downloads remain available.
- The user receives a clear compatibility explanation.
- The application never loops through repeated renderer initialization.

## Qualification cadence

- Pull requests: Chromium smoke matrix.
- Nightly: Chromium, Firefox, and WebKit.
- Weekly: physical-GPU matrix.
- Release candidate: complete browser, OS, backend, keyboard, and accessibility matrix.

A release is blocked by failure of a P0 workflow on a supported configuration or by an unannounced backend-specific scientific discrepancy.
