# Master Root Cause Hypothesis Matrix (H1–H10)

**Document ID**: MATRIX-RCHM-01  
**Milestone**: VISUALIZATION-REMEDIATION-03 (Wave V0 & VR1)  
**Date**: 2026-08-31T15:12:00Z  
**Scope**: Full-Stack Forensic Defect Analysis (Backend, Frontend, Renderer, Data Pipelines, State & Layout)  

---

## Executive Summary

This Master Root Cause Hypothesis Matrix documents the 10 core architectural, mathematical, and implementation defects identified during the Wave V0 & VR1 forensic analysis. All 10 hypotheses (H1 to H10) have been investigated, empirically reproduced, and confirmed with exact code locations, line numbers, and verification evidence chains.

---

## Master Hypothesis Summary Table

| ID | Title | Category | Target Files & Lines | Status | Target Wave |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **H1** | Architectural Viewport Renderer Bypass | Renderer / Arch | `OceanVolumeViewport.tsx:45-280` | **VERIFIED ROOT CAUSE** | Wave VR3 |
| **H2** | Dual-Generation Spatial Bounds Disconnect | Data / Coords | `coordinate_resolver.py:41-44`, `app_store.ts:133-138`, `Teos10SoundingsPanel.tsx:18-21` | **VERIFIED ROOT CAUSE** | Wave VR2 |
| **H3** | Vertical Depth Coordinate Non-Uniformity & LUT Bypass | Renderer / Science | `OceanVolumeViewport.tsx:49,142-163`, `volume_raymarch.wgsl.ts:110-125` | **VERIFIED ROOT CAUSE** | Wave VR3 |
| **H4** | Persistent NetCDF Handle Invalidation & Resource Leaks | Backend / Storage | `query_engine.py:88-106,130-134` | **VERIFIED ROOT CAUSE** | Wave VR2 |
| **H5** | Perpetual PROBING & Health Probe State Stalls | Frontend / FSM | `Header.tsx:20-77`, `app_store.ts:107-160`, `snapshot_session.ts:80-130` | **VERIFIED ROOT CAUSE** | Wave VR5 |
| **H6** | Panel Collision, Viewport Occlusion & Non-Responsive Layout | UI / Layout / A11y | `App.tsx:219-298`, `TransferFunctionLegendControls.tsx:1-120` | **VERIFIED ROOT CAUSE** | Wave VR6 |
| **H7** | 1D/2D Transfer Function & Wet-Mask Format Mismatch | Renderer / Shaders | `OceanVolumeViewport.tsx:122-140`, `volume_raymarch.wgsl.ts:149-156` | **VERIFIED ROOT CAUSE** | Wave VR3 |
| **H8** | Hardcoded Synthetic Mock Models in Production UI | Frontend / Data | `App.tsx:72-186` | **VERIFIED ROOT CAUSE** | Wave VR5 |
| **H9** | Test Suite Path Resolution & Missing Dependencies | Testing / Tooling | `failure_injection.test.ts:365-396`, `integration.test.ts:51` | **VERIFIED ROOT CAUSE** | Wave VR7 |
| **H10**| Timeline Playback Atomic Swap & Frame Latency Jitter | Renderer / Timeline | `OceanVolumeViewport.tsx:88-96`, `TimelineController.tsx:21-41` | **VERIFIED ROOT CAUSE** | Wave VR5 |

---

## Detailed Hypothesis Evidence Chains

### H1: Architectural Viewport Renderer Bypass
- **Problem Statement**: `OceanVolumeViewport.tsx` directly opens a local WebGL2 canvas context inside a React `useEffect` hook and compiles local inline shaders, bypassing `@quasar/renderer-webgpu`, `@quasar/renderer-webgl2`, and `@quasar/runtime`.
- **Evidence**: `OceanVolumeViewport.tsx:45` executes `const gl = canvas.getContext('webgl2')` and renders an ad-hoc rotating box (`boxVertices`), ignoring the engineered rendering pipeline.
- **Remediation (Wave VR3)**: Rewire `OceanVolumeViewport.tsx` to instantiate `WebGPURaymarchingRenderer` with automatic `WebGL2RaymarchingRenderer` fallback.

### H2: Dual-Generation Spatial Bounds Disconnect
- **Problem Statement**: Legacy dataset `copernicus-phy-thetao` spans $[80, 88]^\circ\text{E}$ and $[-3, 12]^\circ\text{N}$ (31 levels). Multivariable dataset `copernicus-phy-multivariable` spans $[60, 68]^\circ\text{E}$ and $[0, 15]^\circ\text{N}$ (50 levels). Hardcoded bounds in `coordinate_resolver.py:41`, `app_store.ts:133`, and `Teos10SoundingsPanel.tsx:20` reject points in the Arabian Sea $[60, 68]^\circ\text{E}$.
- **Evidence**: Querying TEOS-10 at $64^\circ\text{E}$ fails frontend validation; backend nearest selection on $84^\circ\text{E}$ clamps to the edge of the multivariable dataset at $68^\circ\text{E}$.
- **Remediation (Wave VR2)**: Align all coordinate models and validation bounds to the authoritative multivariable domain $[60, 68]^\circ\text{E}$, $[0, 15]^\circ\text{N}$, 50 levels ($0.494\text{ m}$ to $5,727.917\text{ m}$).

### H3: Vertical Depth Coordinate Non-Uniformity & LUT Bypass
- **Problem Statement**: Copernicus 50 depth levels are non-uniform ($0.494\text{ m}$ to $5,727.917\text{ m}$). Baseline viewport raymarching samples texture coordinates linearly in $z \in [0, 1]$, compressing the surface mixed layer into a tiny fraction of the cube height.
- **Evidence**: `OceanVolumeViewport.tsx:153` executes `float s = texture(uVolumeTex, p).r;` with linear $p.z$, distorting vertical physical gradients.
- **Remediation (Wave VR3)**: Pass the 50-level Depth LUT uniform buffer into the shader and apply piecewise-linear interpolation and vertical exaggeration.

### H4: Persistent NetCDF Handle Invalidation & Resource Leaks
- **Problem Statement**: `ExactQueryEngine` maintains a persistent `netCDF4.Dataset` handle in `self._nc_dataset`. On Windows, persistent open handles prevent file operations and risk handle invalidation under high query concurrency.
- **Evidence**: `query_engine.py:89` holds `self._nc_dataset = netCDF4.Dataset(...)` across the server lifecycle.
- **Remediation (Wave VR2)**: Adopt context manager per-request opening or thread-safe NetCDF connection pooling.

### H5: Perpetual PROBING & Health Probe State Stalls
- **Problem Statement**: Health polling and snapshot session lifecycle can get trapped in `checking` or `PROBING` states on network delay or backend reconnect.
- **Evidence**: `Header.tsx:25` has unbounded initial checking latency; snapshot session lacks deterministic timeout transitions to `READY`.
- **Remediation (Wave VR5)**: Implement robust FSM transitions with bounded timeouts and clear visual offline/ready indicators.

### H6: Panel Collision, Viewport Occlusion & Non-Responsive UI Layout
- **Problem Statement**: Seven analytical panels (`TransectDraw`, `HorizontalSlice`, `TSDiagram`, `PickReconciliationPanel`, `VerticalProfileChart`, `ObservationComparisonPanel`, `Teos10SoundingsPanel`) stack in a single right-side floating container, overlapping the viewport and colormap legend on resolutions $\le 1920\times1080$.
- **Evidence**: `App.tsx:229` sets `absolute top-4 right-4 z-20 flex flex-col gap-3 w-80 max-h-[calc(100vh-140px)] overflow-y-auto`.
- **Remediation (Wave VR6)**: Reorganize panels into a collapsible, tabbed analytical sidebar and non-overlapping floating HUD.

### H7: 1D/2D Transfer Function & Wet-Mask Texture Format Mismatch
- **Problem Statement**: Baseline viewport uses a hardcoded 4-point RGB formula in GLSL. Missing 256x1 RGBA transfer function texture lookup, 2D gradient transfer function, and discrete r8uint wet mask texture causes land cells to blend as muddy black/dark blue volume artifacts.
- **Evidence**: `OceanVolumeViewport.tsx:79` maps land voxels to 0, producing opaque volume artifacts.
- **Remediation (Wave VR3)**: Bind dynamic 256x1 RGBA colormap LUT and r8uint validity mask textures to raymarching shaders.

### H8: Hardcoded Synthetic Mock Models in Production UI
- **Problem Statement**: `App.tsx` hardcodes synthetic mock data (`29.5 - Math.sqrt(depth) * 0.92`) and static mock cursors instead of fetching live authoritative data from backend endpoints.
- **Evidence**: `App.tsx:159` computes mock temperature profiles with algebraic formulas.
- **Remediation (Wave VR5)**: Wire `@quasar/client` live API hooks to update inspection panels on user interaction.

### H9: Test Suite Path Resolution & Missing Dependencies
- **Problem Statement**: `packages/runtime` test suites fail due to hardcoded paths `C:\Users\Ranji\data\` and `failure_injection.test.ts` scanning root `src/`. `test_integrated_contract_validation.py` fails due to missing `jsonschema`.
- **Evidence**: `npm test` reports 4 failed tests with `ENOENT: no such file or directory`.
- **Remediation (Wave VR7)**: Standardize test fixtures to use `path.resolve(__dirname, ...)` and make optional dependencies conditional.

### H10: Timeline Playback Atomic Swap & Frame Latency Jitter
- **Problem Statement**: Timestep scrubbing in `TimelineController.tsx` causes full texture recreation and potential frame dropping due to synchronous GPU texture upload without double-buffering.
- **Evidence**: `OceanVolumeViewport.tsx:88` re-allocates 3D textures on every data fetch.
- **Remediation (Wave VR5)**: Implement double-buffered staging textures and texture pool reuse in renderer packages.
