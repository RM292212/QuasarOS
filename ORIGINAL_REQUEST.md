# Original User Request

## Initial Request — 2026-08-31T18:12:06Z

Reconstruct the QuasarOS ocean scientific visualization and analysis platform into a fully integrated, paper-aligned, multi-dataset Ocean Digital Twin with Cesium Explorer Mode, true high-resolution scientific volume rendering, synchronized Argo in-situ profiles, and complete INCOIS capability coverage.

Working directory: C:\Users\Ranji\Downloads\ocanscope3d
Integrity mode: development

## Requirements

### R1. Elimination of Cube Artifacts, Coordinate Alignment & Realistic Orientation
- Eliminate generic spinning rectangular cube appearances; the volume must render as a georeferenced ocean domain with realistic aspect ratio, downward depth conventions, coastlines/wet masks, and bathymetry clipping.
- Remove automatic rotation completely by default. Camera orientation must remain stationary unless explicitly controlled by the operator.
- Overlay 3D geographic orientation indicators, coordinate ticks, depth markers in physical meters, and explicit vertical exaggeration indicators.

### R2. Depth Range Calibration & Non-Uniform Clipping Alignment
- Resolve the discrepancy between the header full vertical extent (0.494m to 5,727.9m) and the clipping sliders (~453.5m).
- Trace and align source depth coordinates, backend slicing, UI slider domains, and shader uniforms (uClipMin, uClipMax) so operators can clip through the complete depth extent across all non-uniform ocean levels.

### R3. True Resolution & Multi-Level-of-Detail (LOD) Pipeline
- Implement selectable, defensible resolution modes: Preview (fast bounding query), Interactive (balanced performance ~60 FPS), and High Quality / Source Grid (highest practical source resolution).
- Display exact dimensions in UI: source dimensions, returned grid shape, GPU texture dimensions, voxel counts, and memory footprints.

### R4. Deterministic Variable Transitions & State Machine
- Ensure bidirectional variable transitions (e.g. thetao -> speed -> thetao, so -> uo, time/date scrubs) reliably update shader pipelines, colormaps, scalar clamps, legends, and GPU textures without stale frames, visual artifacts, or memory leaks.

### R5. Paper-Aligned Velocity Magnitude & Scientific Rendering
- Reimplement velocity magnitude calculation (speed = sqrt(uo^2 + vo^2)) matching Yu et al. (Applied Sciences 2025).
- Apply scientific colormaps with non-saturating transparency curves (transparent quiescent water, prominent jet cores) with Beer-Lambert opacity correction.

### R6. Cesium Explorer Mode & Bidirectional Spatial Selection
- Implement a global 3D Cesium Explorer Mode with ocean basemaps, coastlines, coverage footprints, and observation overlays.
- Support point, rectangle, polygon, and coordinate selection that seamlessly transfers exact spatial bounds, datasets, and variables into Scientific Volume Mode, with lossless return to Explorer Mode.

### R7. Multi-Dataset Ingestion & INCOIS Requirement Coverage
- Build a unified provider adapter architecture supporting Copernicus (CMEMS), HYCOM, INCOIS, GEBCO/ETOPO bathymetry, Argo GDAC, WOA23, and satellite products.
- Ensure every required dataset is discoverable, queryable, and provenance-traceable with explicit operational status.

### R8. Argo Float & Profile Synchronization
- Synchronize Argo float positions, cycle numbers, QC flags, and physical soundings across Cesium Explorer Mode, Scientific 3D Volume Viewport, and 2D analytical profile charts.
- Support bidirectional selection and interactive model-versus-observation comparison (RMSE, bias, depth matching).

## Acceptance Criteria

### Depth & Coordinate Verification
- [ ] Clipping controls span the full loaded depth range (0.494 m to 5,727.9 m) and accurately slice non-uniform layers.
- [ ] Depth values map linearly and non-linearly to physical meters with zero coordinate inversion.

### Resolution & Performance
- [ ] Preview, Interactive, and High-Quality modes produce distinct requested and returned grid dimensions.
- [ ] Texture dimensions match backend payloads, and GPU memory stays strictly within budget (<50 MiB VRAM for textures).

### Velocity & Variable Transitions
- [ ] Switching between thetao, speed, so, uo, vo, and zos across all 7 operational dates renders distinct scientific gradients without stale texture carryover.
- [ ] Velocity magnitude matches sqrt(uo^2 + vo^2) with verified units (m/s).

### Cesium Explorer & Argo Integration
- [ ] Drawing a region in Cesium opens the exact geographic bounding box in Scientific Volume Mode.
- [ ] Argo float coordinates round-trip between Cesium, 3D volume local space, and physical WGS84 without loss of accuracy.

### Automated Testing & Browser Verification
- [ ] All 805+ automated tests (Node.js and Python pytest) pass cleanly.
- [ ] Live clean-browser acceptance loop confirms zero auto-rotation on load, responsive UI across all resolutions, and valid ground truth matchups.

## Continuation — 2026-09-02T10:20:48Z

CONTINUATION (resuming after network interruption): Continue the QuasarOS Ocean Digital-Twin Reconstruction project from Milestone 2.

Working directory: C:\Users\Ranji\Downloads\ocanscope3d
Integrity mode: development

## Completed before interruption
- Milestone 1 COMPLETE: velocity magnitude speed operator (sqrt(uo^2+vo^2)), multi-provider catalog adapters (CMEMS, HYCOM, INCOIS, GEBCO, WOA23, Argo GDAC), 41 tests passing.
- Pre-merged: auto-rotation disabled in OceanVolumeViewport.tsx, COPERNICUS_50_DEPTH_LEVELS constant (0.494m to 5727.917m), clippingModel initialized with full 50-level depth range, latitude sliders added to 6-plane clipping panel.

## Milestone 2: Shader & Rendering Upgrades (START HERE)
- Implement WebGL2 UBO with 64-entry depth LUT for non-uniform Copernicus depth level indexing in volume_raymarch.glsl.ts
- Align shader uClipMin/uClipMax to full 0.494m-5727.9m range
- Implement paper-aligned velocity magnitude colormap (turbo with non-saturating alpha: quiescent water alpha~0.05, jet core alpha~0.85) in transfer_function_model.ts
- Add LOD quality mode selector: Preview (32x32x16), Interactive (64x64x32), High Quality (96x96x50) with dimension display in UI
- Fix variable transition stale-state to ensure thetao->speed->thetao round trip produces correct GPU textures
- Add regression tests for all of the above
- Run npm test to verify all tests pass

## Milestone 3: Cesium Explorer Mode
- Create CesiumExplorerMode React component in apps/web/src/components/cesium/
- Display global ocean basemap with Cesium Ion terrain, coastlines, dataset coverage footprints
- Implement rectangle/polygon region selection tool that captures WGS84 bounding box
- Add mode switcher in Header: Explorer Mode / Scientific Mode
- Transfer geographic bounds, selected dataset, variable, timestamp, and depth range into Scientific Volume Mode
- Preserve and restore Explorer state when returning from Scientific Mode
- Add component tests for region selection and state transfer

## Milestone 4: Argo Float Integration
- Create ArgoFloatLayer component that loads Argo float positions for selected date from Argo GDAC API
- Render float markers in Cesium Explorer with WMO ID, cycle number, QC flags
- In Scientific Volume Mode, render Argo profile tracks as 3D lines within the ocean volume at correct geographic coordinates
- Synchronize float selection bidirectionally between Cesium, volume viewport, and analytical profile chart
- Add tests for coordinate transformations (geographic -> normalized volume space)

## Milestone 5: Testing & Browser Verification
- Run .venv\Scripts\python.exe -m pytest tests/ and npm test, report all results
- Start stack with .\scripts\start_local_stack.ps1
- Browser-verify using chrome-devtools MCP:
  - Zero auto-rotation confirmed
  - Full depth clipping (0.494m to 5727.9m) working
  - thetao->speed->thetao variable transition correct
  - Velocity magnitude renders with scientific colormap
  - LOD mode selector changes dimensions
  - Cesium Explorer shows globe and accepts region selection
  - Argo floats appear in Explorer and volume modes
- Capture screenshots for all verified scenarios
- Report final status

## Acceptance Criteria
- [ ] Depth clipping spans 0.494m to 5,727.9m with non-uniform depth mapping in shader
- [ ] speed variable renders sqrt(uo^2+vo^2) with paper-aligned colormap
- [ ] thetao->speed->thetao produces correct textures without stale state
- [ ] Preview/Interactive/High Quality show distinct dimensions in UI
- [ ] Cesium Explorer globe renders and accepts rectangle selection
- [ ] Region selection transfers exact bounds into Scientific Mode
- [ ] Argo floats appear in Cesium at correct positions
- [ ] All automated tests pass
- [ ] Browser confirms zero auto-rotation and working controls

## Continuation — 2026-09-02T14:36:04Z

CONTINUATION after device power-off and restart. All previous subagents were killed. Resume the QuasarOS Ocean Digital-Twin Reconstruction project from Milestone 2.

Working directory: C:\Users\Ranji\Downloads\ocanscope3d
Integrity mode: development

## Current verified state (confirmed before this restart)
- Milestone 1 COMPLETE: velocity magnitude speed operator (sqrt(uo^2+vo^2)) in analysis_engine.py and router.py; multi-provider catalog adapters (CMEMS, HYCOM, INCOIS, GEBCO, WOA23, Argo GDAC) in catalog_service.py. Tests passing.
- Pre-merged frontend fixes: auto-rotation removed (OceanVolumeViewport.tsx), COPERNICUS_50_DEPTH_LEVELS constant added (0.494m-5727.917m, 50 levels), clippingModel uses full 50-level depth range, latitude sliders added to 6-plane clipping panel (TransferFunctionLegendControls.tsx).
- Node.js test suite: 203/203 passing.
- The following files have uncommitted modifications (agent work in progress): analysis_engine.py, router.py, catalog_service.py, OceanVolumeViewport.tsx, App.tsx, TransferFunctionLegendControls.tsx, transfer_function_model.ts, volume_raymarch.glsl.ts, volume_raymarch.wgsl.ts, raymarching_renderer.ts (both WebGL2 and WebGPU), app_store.ts, scientific_state.ts, and many test files.
- Project plan file PROJECT.md exists at repo root.
- Agent working directory .agents/ exists with milestone explorer reports.

## START FROM: Milestone 2 — Shader & Rendering Upgrades

Read the existing .agents/ directory to find any completed explorer reports for m2_explorer_1, m2_explorer_2, etc. Use those findings instead of re-exploring.

Then implement Milestone 2:
1. WebGL2 volume_raymarch.glsl.ts: add a 64-entry depth LUT UBO (uDepthLut[64]) so the raymarcher maps normalized Z coordinates to physical depth meters using the actual Copernicus non-uniform depth levels. This ensures depth clipping (uClipMinDepth, uClipMaxDepth in meters) works correctly across the full 0.494m-5727.917m range.
2. WebGPU volume_raymarch.wgsl.ts: equivalent depth LUT binding as a uniform array.
3. OceanVolumeViewport.tsx: upload the COPERNICUS_50_DEPTH_LEVELS array as a UBO/uniform to both WebGL2 and WebGPU renderers, pass actual clipping depths in meters to the shader.
4. transfer_function_model.ts: add configureForVariable('speed') preset with turbo colormap, alpha curve: near-zero velocity alpha=0.05, mid alpha=0.4, high velocity alpha=0.85 (paper-aligned, Yu et al. 2025).
5. App.tsx / Header.tsx or TransferFunctionLegendControls.tsx: add a Quality/LOD selector with three named modes and dimension display: Preview (32x32x16 voxels), Interactive (64x64x32), High Quality (96x96x50). Changing this must change the API request grid size.
6. Variable transition fix: audit and fix the thetao->speed->thetao round-trip in OceanVolumeViewport.tsx to ensure generation tokens cancel stale fetches and the new variable's TF texture is fully uploaded before rendering.
7. Add regression tests for all of the above.
8. Run `npm test` and `.venv\Scripts\python.exe -m pytest tests/` and confirm all pass.

## Milestone 3: Cesium Explorer Mode
1. Install cesium and @cesium/widgets in apps/web if not already installed.
2. Create apps/web/src/components/cesium/CesiumExplorerMode.tsx:
   - Full-screen Cesium globe with ocean basemap (CesiumWorldTerrain or OSM)
   - Coastlines and ocean depth layer
   - Rectangle draw tool: user draws a region, captures minLon/maxLon/minLat/maxLat in WGS84
   - Selection summary panel showing bounds, estimated voxel count, available datasets
   - 'Open in Scientific Mode' button that transfers the selection state to Scientific Volume Mode
3. Add mode switcher to Header.tsx: 'Explorer' | 'Scientific' toggle tabs
4. In app_store.ts, add cesiumSelection state: { minLon, maxLon, minLat, maxLat, variable, timestamp, depthMin, depthMax }
5. When switching to Scientific Mode, initialize the viewport bounds from cesiumSelection
6. 'Return to Explorer' button in Scientific Mode preserves selection
7. Add component tests

## Milestone 4: Argo Float Integration (scope-limited)
Scope this to what is achievable without requiring live API authentication:
1. Create a mock/static Argo float positions fixture (5-10 floats in the Arabian Sea region) in data/ with WMO ID, lat, lon, cycle, timestamp, maxDepth
2. In CesiumExplorerMode, render the Argo float markers as billboard entities
3. Clicking a float shows a popup with WMO ID, position, cycle, depth, QC status
4. In Scientific Volume Mode, if a float is within the selected region, render a vertical profile line at the correct geographic coordinates (transformed to normalized volume space)
5. Show a float indicator in the analytical panel when a float is in the selected region
6. Document that live Argo GDAC API integration requires Argo credentials and provide the adapter stub

## Milestone 5: Final Testing & Browser Verification
1. Run full test suites: npm test AND .venv\Scripts\python.exe -m pytest tests/
2. Start stack: powershell -ExecutionPolicy Bypass -File scripts\start_local_stack.ps1 -NoBrowser
3. Wait for backend to be ready, then open http://127.0.0.1:5173
4. Browser-verify using chrome-devtools MCP tools:
   - Confirm zero auto-rotation (camera stays still after 3 seconds of no input)
   - Switch to 6-plane clipping tab, verify depth slider spans 0.494m to 5727.9m
   - Switch variable to 'speed', verify turbo colormap renders
   - Switch back to 'thetao', verify thermal colormap is restored correctly
   - Switch LOD mode, verify displayed dimensions change
   - Navigate to Explorer Mode, verify Cesium globe renders
   - Draw a rectangle selection on the globe
   - Click 'Open in Scientific Mode', verify bounds are transferred
   - Verify Argo float markers appear in Explorer Mode
5. Capture screenshots for all scenarios
6. Report final status with all test totals and browser scenario results

## Acceptance Criteria
- [ ] Depth clipping shader uses actual non-uniform depth LUT, spanning 0.494m to 5,727.9m
- [ ] speed variable renders sqrt(uo^2+vo^2) with paper-aligned turbo colormap (alpha: 0.05 to 0.85)
- [ ] thetao->speed->thetao transition restores correct thermal colormap without stale textures
- [ ] LOD selector shows Preview (32x32x16), Interactive (64x64x32), High Quality (96x96x50) with voxel counts
- [ ] Cesium Explorer Mode renders a global globe with ocean basemap
- [ ] Rectangle region selection transfers exact WGS84 bounds into Scientific Mode
- [ ] Argo float markers appear in Cesium Explorer
- [ ] All npm tests pass (203+)
- [ ] All pytest tests pass (602+)
- [ ] Browser confirms all acceptance scenarios above

## 2026-09-04T17:28:58Z

# QUASAROS TARGETED RUNTIME, TEMPORAL-INTEGRITY, SENSOR-NETWORK, AND END-TO-END PERFORMANCE REMEDIATION

Targeted remediation of QuasarOS 3D ocean digital twin: eliminate unexplained green line artifacts in Scientific Volume mode, enforce strict 7-day timeline temporal integrity (click to verified GPU texture), instrument end-to-end distributed tracing, resolve measured bottlenecks, and populate official operational sensor platforms (Argo, gliders, tsunami buoys, tide gauges, OMNI, wave buoys, ADCPs, AWS, drifters).

Working directory: C:\Users\Ranji\Downloads\ocanscope3d
Integrity mode: development

## Requirements

### R1. Elimination of Unexplained Green Floating Lines in Scientific Viewport
- Identify the exact scene primitive producing floating green line curves in Scientific Volume Mode (e.g., coastline overlays, debug paths, unclipped bounds, or leaked Explorer geometries).
- Destroy/disable the offending primitive in Scientific Mode while keeping proper georeferenced coastlines available exclusively in Cesium Explorer Mode.
- Ensure bounding-box, orientation axes, and wireframe edges remain clean, user-toggleable, and distinct.

### R2. Seven-Day Timeline Temporal Integrity & Stale State Prevention
- Ensure each of the 7 timeline dates (2026-08-24 to 2026-08-30) triggers a dedicated query with the exact valid date/index, resolves authoritative source timestamps, updates cache keys, and uploads the corresponding daily frame into GPU texture memory.
- Implement generation-token cancellation so rapid date scrubbing rejects in-flight stale responses and always converges on the active selected day.
- Ensure timeline labels, provenance drawer, HUD metadata, and 2D charts strictly agree on valid time, reference time, and product cycle.

### R3. Correlated End-to-End Profiling & Bottleneck Optimization
- Instrument OpenTelemetry / W3C traceparent distributed tracing across backend startup, API routing, NetCDF slicing, array serialization, frontend decode, and WebGL2/WebGPU texture upload.
- Record cold vs. warm cache metrics, identify top 5 measured bottlenecks, and implement evidence-backed optimizations (e.g., chunk caching, array reuse, binary transfer).

### R4. Official Operational Sensor Network Inventory & UI Presentation
- Transition sensor catalogs from partial samples to verified operational inventories (Argo profiling floats, gliders, tsunami buoys, tide gauges, OMNI buoys, wave-rider buoys, ADCPs, AWS, drifters).
- Display verified active count alongside map-visible count, official provider ("as of" UTC timestamp), QC status, and mode (Real-Time vs. Delayed). Never fabricate placeholder platforms.

## Acceptance Criteria

### Visual & Shader Conformance
- [ ] Zero unexplained floating green line primitives in Scientific Volume Mode in WebGL2 and WebGPU.
- [ ] Bounding box and orientation indicators remain functional and accurately aligned to the ocean domain.

### Temporal Integrity
- [ ] Each of the 7 dates resolves to its verified source timestamp with distinct array checksums (or documented identical source evidence).
- [ ] Rapid scrubbing across all 7 dates never leaves stale textures or mismatched labels.

### Observability & Performance
- [ ] Distributed trace connects backend startup, ROI query, and 7-day timeline frame rendering.
- [ ] Machine-readable profiles (CPU, memory, HAR, trace JSON) exported under reports/operational-runtime-remediation/evidence/.
- [ ] Top bottlenecks ranked and optimized with before/after measurement evidence.

### Sensor Network Truth
- [ ] Sensor platform layers (Argo, gliders, buoys, tide gauges) render distinct symbols with verified platform IDs, WMO metadata, and QC flags.
- [ ] Official source timestamps and active definitions documented in provenance drawer.

### Automated Testing & Browser Verification
- [ ] All automated tests (Python pytest and Node.js vitest) pass cleanly.
- [ ] Clean browser acceptance loop confirms green line removal, 7-day switching, and sensor platform interaction.


