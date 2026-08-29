# V1 Requirements

**Document:** `docs/01-product/V1Requirements.md`  
**Status:** Normative  
**Scope:** Minimum releasable QuasarOceanScope V1

## 1. V1 outcome

V1 shall deliver a complete vertical slice using real ocean data:

1. Acquire a pinned model subset, GEBCO bathymetry, Argo profiles, and an optional compatible WOA reference.
2. Validate and transform the data into canonical representations.
3. Generate multiresolution rendering products.
4. Discover the products through the application catalog.
5. Render a scalar model field in WebGPU or WebGL 2.0.
6. Display geographic context and observations.
7. inspect exact canonical values.
8. Compare one observation profile against the model.
9. Export the view and analysis provenance.

## 2. Requirement priorities

- **P0:** Mandatory for V1 release.
- **P1:** Required unless blocked by a documented external dependency.
- **P2:** Desirable after all P0 requirements pass.
- **Deferred:** Explicitly outside V1.

## 3. V1 product requirements

| ID | Priority | Requirement |
|---|---:|---|
| V1-001 | P0 | Provide a reproducible local bootstrap workflow for all mandatory services and pinned real-data subsets. |
| V1-002 | P0 | Use Babylon.js as the scientific renderer and CesiumJS as the geographic overview. |
| V1-003 | P0 | Support WebGPU as the primary 3-D backend. |
| V1-004 | P0 | Support WebGL 2.0 as a fully 3-D fallback. |
| V1-005 | P0 | Render model temperature as a time-aware scalar volume. |
| V1-006 | P0 | Render model salinity as a time-aware scalar volume. |
| V1-007 | P0 | Display current magnitude and at least one directional representation. |
| V1-008 | P0 | Display bathymetry as terrain or a seabed mesh. |
| V1-009 | P1 | Display SSH and mixed-layer depth as surface fields where available. |
| V1-010 | P0 | Support transfer-function editing using physical units. |
| V1-011 | P0 | Support horizontal, vertical, and arbitrary clipping or slicing. |
| V1-012 | P0 | Support discrete time-step selection and animation. |
| V1-013 | P0 | Stream multiresolution volume bricks progressively. |
| V1-014 | P0 | Enforce bounded CPU and GPU caches. |
| V1-015 | P0 | Display Argo locations, trajectories where available, and profile metadata. |
| V1-016 | P0 | Plot Argo temperature and salinity profiles with QC visibility. |
| V1-017 | P0 | Collocate a selected Argo profile with compatible model data. |
| V1-018 | P0 | Display model and observation profile overlays and residuals. |
| V1-019 | P0 | Calculate bias, mean absolute error, RMSE, valid-pair count, and depth coverage. |
| V1-020 | P0 | Provide exact canonical value inspection independently of rendered texture precision. |
| V1-021 | P0 | Preserve provider, product, units, QC, time, grid, and provenance metadata. |
| V1-022 | P0 | Distinguish missing, invalid, below-seabed, outside-domain, and not-yet-loaded states. |
| V1-023 | P0 | Export reproducibility metadata for the current scene and analysis. |
| V1-024 | P0 | Provide visible renderer, resolution, loading, and approximation status. |
| V1-025 | P0 | Pass scientific, renderer, browser, accessibility, security, and performance release gates. |

## 4. Mandatory bootstrap data

The bootstrap manifest shall pin:

- Provider and product identifier.
- Dataset identifier.
- Source URL or API query.
- Region of interest.
- Horizontal and vertical range.
- Time or model cycle.
- Requested variables.
- File sizes where known.
- Retrieval timestamp.
- Checksums after acquisition.
- Licence and attribution.
- Expected dimensions and units.
- Validation rules.
- Processing configuration version.

The bootstrap set shall contain:

1. At least one depth-resolved model temperature field.
2. At least one depth-resolved salinity field.
3. Horizontal current components.
4. At least two model time steps.
5. Bathymetry intersecting the model region.
6. At least one Argo profile inside or near the model region and time range.
7. A climatological reference if compatible with the selected variables and calendar.

No mock provider or generated operational dataset may satisfy this requirement.

## 5. Mandatory rendering behavior

### 5.1 Scalar volumes

The renderer shall:

- Intersect camera rays with the valid domain.
- Respect bathymetry, land, validity masks, ROI, depth, and clipping.
- Traverse resident multiresolution bricks.
- Skip non-resident bricks or use a lower-resolution fallback.
- Apply transfer-function-aware empty-space skipping.
- Composite front-to-back.
- Correct opacity when sampling distance changes.
- Terminate rays after transmittance falls below the quality threshold.
- Expose interactive and reference quality profiles.

### 5.2 WebGPU

WebGPU shall support:

- WGSL shader pipelines.
- Volume atlas or equivalent GPU brick cache.
- Page-table lookup.
- Progressive brick updates.
- Storage-buffer or texture-backed metadata.
- GPU timing where the browser exposes the capability.

### 5.3 WebGL 2.0

WebGL 2.0 shall support:

- GLSL ES 3.00 shaders.
- 3-D textures or a compatible atlas.
- Texture-backed page-table and occupancy data.
- Progressive brick uploads.
- Adaptive resolution and sampling.
- The same variable, time, clipping, inspection, and comparison workflow as WebGPU.

A user shall never receive a 2-D-only fallback when WebGL 2.0 is available.

## 6. Mandatory analysis behavior

Exact-value inspection shall report:

- Longitude and latitude.
- True depth or pressure coordinate.
- Valid time.
- Dataset and variable.
- Canonical value and units.
- Interpolation method.
- Grid indices or cell identity where available.
- QC or validity state.
- Whether the value is source, normalized, or derived.
- Provenance reference.

Model-observation comparison shall report:

- Observation platform and cycle/profile.
- Observation time and position.
- Model reference and valid time.
- Spatial and temporal separation.
- Vertical interpolation method.
- Accepted and rejected observation levels.
- Observation and model values.
- Residual convention.
- Valid-pair count.
- Bias, MAE, and RMSE.
- Units and uncertainty where available.

## 7. Mandatory UX behavior

The interface shall provide:

- Dataset and variable browser.
- Workspace switcher.
- Layer visibility and ordering controls.
- Time selector and playback.
- Transfer-function editor.
- Depth and clipping controls.
- Quality selector.
- Observation browser.
- Scientific inspector.
- Analysis result panel.
- Loading and error states.
- Keyboard operation for primary workflows.
- Reduced-motion behavior.
- Renderer capability indicator.

Unavailable variables shall be disabled with an explanation rather than silently omitted or displayed incorrectly.

## 8. V1 performance targets

The following are release targets, measured using the documented benchmark scene and hardware classes:

| Metric | Target |
|---|---|
| Application shell usable after cached load | ≤ 3 seconds on reference desktop |
| Coarse first 3-D volume after manifest availability | ≤ 5 seconds on reference network |
| Interactive camera p95 frame time, WebGPU reference desktop | ≤ 33.3 ms |
| Settled frame p95, WebGPU reference desktop | ≤ 16.7 ms where dataset and hardware permit |
| Interactive camera p95, WebGL2 reference desktop | ≤ 50 ms |
| Main-thread task duration | No recurring tasks above 50 ms during steady interaction |
| GPU cache | Within configured budget; no unbounded growth |
| CPU decoded-brick cache | Within configured budget; no unbounded growth |
| Time-step switch | Coarse next frame visible before full refinement |
| Exact-value request | p95 ≤ 2 seconds on local reference deployment |
| Model-observation comparison | p95 ≤ 5 seconds for one profile on local reference deployment |

Failure to meet a target shall produce a benchmark report and an explicit release decision. Results shall never be claimed without recording hardware, browser, viewport, dataset, cache state, and quality profile.

## 9. V1 quality gates

V1 shall not be released if any of the following remain unresolved:

- Canonical values fail source comparison.
- WebGL 2.0 falls back to 2-D.
- Missing values appear as valid ocean values.
- Land or below-seabed cells contribute visible scalar opacity.
- Time labels confuse reference, forecast, valid, observation, or climatology time.
- Quantized values are presented as exact values.
- Argo QC information is discarded.
- Comparison metrics use mismatched units.
- GPU or CPU resources grow without bounds during repeated navigation.
- Required keyboard workflows fail.
- A source licence or attribution requirement is not satisfied.

