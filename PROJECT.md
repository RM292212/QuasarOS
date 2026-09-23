# Project: QuasarOS Ocean Digital Twin Reconstruction

## Architecture
QuasarOS is a modular, scientifically rigorous Ocean Digital Twin platform designed to visualize, explore, and analyze multidimensional oceanographic datasets and in-situ observations.
The architecture is structured into decoupled, contract-governed layers:
- **Backend & Science Engine (`packages/services`, `packages/contracts`)**: FastAPI REST APIs, canonical JSON schemas (`quasar-contracts v1.2.0`), Zarr/NetCDF ingestion adapters (CMEMS, HYCOM, INCOIS, GEBCO, WOA23, Argo GDAC), GSW TEOS-10 thermodynamic analysis, and observation collocation engine.
- **Renderer Core & Shaders (`packages/renderer-webgpu`, `packages/renderer-webgl2`, `packages/runtime`)**: Dual-backend image-order volume raycasting (WebGPU WGSL and WebGL2 GLSL ES 3.00), Smits-Kay AABB intersection, non-uniform depth LUT mapping across 50 levels (0.494m to 5,727.9m), Beer-Lambert step-size opacity correction, transfer functions, and 6-plane analytical clipping.
- **Web Application & Viewports (`apps/web`)**: React UI shell, dual-workspace architecture (Cesium Explorer Overview Mode & 3D Volume Viewport Mode adhering to ADR-0002), interactive ROI selection roundtrip, dynamic LOD selector (Preview, Interactive, High-Quality), 2D analytical vertical profile charts, TEOS-10 sounding panels, and Argo observation comparison panels.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Realistic Ocean Slab Aspect Ratio | Eliminate unit cube artifact; scale domain by geographic aspect ratio ($0.534 : 0.172 : 1.000$) | M3 | R1 |
| 2 | Downward Depth & Coordinate Alignment | Align camera orientation with depth downward along vertical Y and North/East horizontal plane | M3 | R1 |
| 3 | Zero Default Auto-Rotation | Remove automatic camera rotation on load; keep camera stationary unless user navigates | M3 | R1 |
| 4 | 3D Geographic Orientation Indicators | Render ENU compass gizmo, coordinate ticks, physical depth markers in meters, and vertical exaggeration indicator | M3 | R1 |
| 5 | Bathymetry Clipping Mesh | Clip volume using bathymetry floor and coastlines/wet masks | M3 | R1 |
| 6 | 64-Entry Depth LUT UBO Allocation | Expand WebGL2 UBO array to 64 entries to map all 50 non-uniform vertical layers ($0.494\text{ m}$ to $5,727.9\text{ m}$) | M2 | R2 |
| 7 | Full Depth Range Clipping Calibration | Calibrate UI clipping sliders and shader uniforms (`uClipMin`, `uClipMax`) across $0.494\text{ m}$ to $5,727.9\text{ m}$ | M2 | R2 |
| 8 | Multi-LOD Resolution Pipeline | Implement selectable Preview ($16\times 32\times 32$), Interactive ($24\times 48\times 48$), and High-Quality ($50\times 181\times 97$) modes | M3 | R3 |
| 9 | Exact Grid Dimension & VRAM Reporting | Display source dimensions, returned grid shape, GPU texture dimensions, voxel count, and VRAM footprint ($<50\text{ MiB}$) | M3 | R3 |
| 10 | Persistent Pipeline & Texture Swapping | Maintain WebGL/WebGPU pipeline without destroying context on date/variable scrubs | M3 | R4 |
| 11 | Deterministic Variable Transitions | Seamless switching between `thetao`, `speed`, `so`, `uo`, `vo`, and `zos` across 7 dates without stale frames | M3 | R4 |
| 12 | Velocity Magnitude Operator | Implement $\text{speed} = \sqrt{u_o^2 + v_o^2}$ in backend analysis engine with verified $\text{m/s}$ units | M1 | R5 |
| 13 | Paper-Aligned Velocity Colormap & Opacity | Non-saturating jet colormap and opacity transfer curve for current jets matching Yu et al. (2025) | M2 | R5 |
| 14 | Cesium Explorer Mode Workspace | Dedicated CesiumJS overview canvas and render loop for global ocean basemaps adhering to ADR-0002 | M4 | R6 |
| 15 | Bidirectional ROI Selection Roundtrip | Interactive point/rect/polygon selection in Cesium transferring exact spatial bounds to Volume Mode and back | M4 | R6 |
| 16 | Multi-Dataset Provider Architecture | Full coverage and catalog exposure for CMEMS (physics/waves/colour), HYCOM, INCOIS, GEBCO, WOA23, Argo GDAC | M1 | R7 |
| 17 | Provenance & Operational Metadata | Display provider, product ID, dataset ID, license, processing history, and valid time semantics | M1 | R7 |
| 18 | Argo Float In-Situ Ingestion & Pins | Ingest Delayed-Mode, Real-Time, and BGC NetCDF profiles and display float pins in Cesium & 3D Volume | M4 | R8 |
| 19 | Argo Collocation & Error Metrics | Calculate layer deltas, Mean Bias, and RMSE between model volume and in-situ Argo soundings | M1 | R8 |
| 20 | Synchronized 2D Analytical Profile Charts | Non-uniform depth profile charts with linear/log scaling, TEOS-10 derived soundings, and model vs. obs overlays | M4 | R8 |
| 21 | Comprehensive Automated Test Verification | Pass 100% of the 805+ automated tests (Node packages, apps, E2E tiers, and pytest) | M5 | AC |
| 22 | Adversarial Hardening & Forensic Audit | Challenger empirical stress testing and Forensic Auditor integrity verification | M5 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Science & Multi-Dataset Engines | Velocity magnitude $\sqrt{u_o^2+v_o^2}$, dataset adapters (CMEMS, HYCOM, INCOIS, GEBCO, WOA23), collocation metrics | none | DONE |
| M2 | Rendering Shaders & Depth/Clipping Calibration | 64-entry Depth LUT UBO, full depth clipping ($0.494\text{ m}$–$5,728\text{ m}$), velocity colormap/opacity curves | none | DONE |
| M3 | 3D Viewport Orientation, Realism & LOD State Machine | Aspect ratio ($0.534 : 0.172 : 1.000$), downward depth, zero auto-rotation, orientation gizmo, LOD modes, persistent pipeline | M1, M2 | DONE |
| M4 | Cesium Explorer Mode & Argo Synchronization | ADR-0002 Cesium overview workspace, ROI selection roundtrip, float pins, synchronized 2D profile charts | M1, M3 | DONE |
| M5 | Final Verification & Adversarial Audit | 100% test pass verification (1,071+ tests), Challenger stress tests, Forensic Auditor integrity check | M1, M2, M3, M4 | DONE |

## Interface Contracts
### Backend Analysis Engine (`analysis_engine.py`) $\leftrightarrow$ Frontend Viewport / Store
- `get_volume_slice_grid(dataset_id, variable, date, depth_levels, lat_res, lon_res, bounding_box)`:
  - Allowed variables: `{"thetao", "so", "uo", "vo", "zos", "speed"}`
  - Returns `VolumeSliceResponse`: dimensions `[depth, lat, lon]`, flat float32 array, scalar `min_val`/`max_val`, `depth_levels_m` array, `units`, `provenance`.
- `compute_collocation(dataset_id, float_id, cycle_number, variable, date)`:
  - Returns `ObservationCollocationResponse`: paired depths, model values, observed values, `bias`, `rmse`, `qc_flags`.

### WebGL2 Shader (`volume_raymarch.glsl.ts`) $\leftrightarrow$ Renderer Pipeline (`raymarching_renderer.ts`)
- Uniform Block `RaymarchUniforms` (std140, binding 0, 1,216 bytes):
  - `mat4 uInverseViewProjection;` (offset 0)
  - `vec4 uCameraPosition;` (offset 64)
  - `vec4 uVolumeDimensions;` (offset 80)
  - `vec4 uClipMin;` (offset 96) — $[x_{\min}, y_{\min}, z_{\min}, 0]$ in $[0, 1]^3$
  - `vec4 uClipMax;` (offset 112) — $[x_{\max}, y_{\max}, z_{\max}, 1]$ in $[0, 1]^3$
  - `vec4 uScalarRange;` (offset 128) — $[\min, \max, \text{stepSize}, \text{opacityCorrection}]$
  - `vec4 uDepthLutEntries[64];` (offset 144) — non-uniform depth LUT entries covering 50 levels ($0.494\text{ m}$ to $5,727.917\text{ m}$)

### Cesium Overview (`CesiumOverviewViewport.tsx`) $\leftrightarrow$ Volume Viewport (`OceanVolumeViewport.tsx`) via `app_store.ts`
- State: `activeWorkspace: "overview" | "volume"`
- Spatial ROI: `selectedBoundingBox: { west, south, east, north, minDepth, maxDepth }`
- Argo float selection: `selectedFloatId: string | null`, `selectedCycleNumber: number | null`

## Code Layout
- `packages/contracts/`: Pydantic models & JSON schema generation
- `packages/services/src/quasar_services/analysis/`: Scientific analysis engine & collocation
- `packages/renderer-webgpu/src/shaders/`: WebGPU WGSL shaders
- `packages/renderer-webgl2/src/shaders/`: WebGL2 GLSL shaders
- `packages/renderer-webgl2/src/pipeline/`: WebGL2 raymarching renderer & UBO management
- `packages/runtime/src/coordinates/`: Coordinate transformations & depth lookup tables
- `apps/web/src/components/viewport/`: 3D Volume Viewport & Cesium Overview Viewport
- `apps/web/src/components/inspection/`: 2D Vertical profile charts & TEOS-10 soundings
- `apps/web/src/components/observations/`: Argo observation comparison panel
- `apps/web/src/context/`: Zustand `app_store.ts` state machine
- `tests/`: E2E integration tests, package tests, app tests, and pytest suites
