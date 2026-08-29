# Functional Requirements

**Document:** `docs/01-product/FunctionalRequirements.md`  
**Status:** Normative

## 1. Requirement language

The terms **shall**, **shall not**, **should**, and **may** are normative. Every `FR-*` requirement shall be traceable to implementation tasks and tests.

## 2. Application shell and navigation

- **FR-SHELL-001:** The application shall provide Ocean Overview and Scientific Volume Lab workspaces.
- **FR-SHELL-002:** The application shall synchronize dataset, variable, time, ROI, selected observation, and relevant camera target between workspaces.
- **FR-SHELL-003:** The application shall not share Babylon.js, CesiumJS, WebGPU, or WebGL GPU objects across workspaces.
- **FR-SHELL-004:** The application shall display the active provider, product, variable, valid time, and renderer.
- **FR-SHELL-005:** The application shall preserve valid user state when switching workspaces.
- **FR-SHELL-006:** Invalid state from a previous dataset shall be reset or mapped explicitly when datasets change.
- **FR-SHELL-007:** Application routes shall support direct navigation to documented public views without embedding credentials.

## 3. Catalog and discovery

- **FR-CAT-001:** The catalog shall list providers, products, datasets, variables, spatial coverage, temporal coverage, and access status.
- **FR-CAT-002:** Variables shall be grouped by scientific role and topology.
- **FR-CAT-003:** The UI shall identify unavailable variables and explain why they are unavailable.
- **FR-CAT-004:** Catalog filters shall include provider, product, variable, time, topology, and observation platform where applicable.
- **FR-CAT-005:** Dataset entries shall expose licence, attribution, version, and freshness metadata.
- **FR-CAT-006:** Catalog APIs shall support pagination and bounded queries.
- **FR-CAT-007:** A dataset shall not be visible as published until mandatory validation succeeds.

## 4. Region and geographic context

- **FR-GEO-001:** Ocean Overview shall display dataset footprints and geographic context.
- **FR-GEO-002:** Users shall be able to create a rectangular ROI.
- **FR-GEO-003:** Polygonal ROI support should be provided when processing and rendering paths support it.
- **FR-GEO-004:** ROI coordinates shall be stored in a documented geographic CRS.
- **FR-GEO-005:** The application shall validate the ROI against dataset bounds.
- **FR-GEO-006:** Bathymetry shall be rendered as terrain or a seabed mesh, not a scalar volume by default.
- **FR-GEO-007:** Vertical exaggeration shall affect display geometry only and shall be visibly disclosed.

## 5. Dataset and variable selection

- **FR-DATA-001:** Users shall select a provider, product, dataset or run, variable, and time.
- **FR-DATA-002:** The application shall show source, canonical, and display units where they differ.
- **FR-DATA-003:** Variable changes shall cancel obsolete requests.
- **FR-DATA-004:** Results from cancelled or obsolete requests shall not overwrite current state.
- **FR-DATA-005:** The application shall enforce topology-compatible render modes.
- **FR-DATA-006:** A surface-only field shall not be enabled as a depth volume.
- **FR-DATA-007:** The application shall display a reason when a requested representation is scientifically or technically unavailable.

## 6. Scalar-volume rendering

- **FR-VOL-001:** Temperature and salinity shall be renderable as scalar volumes.
- **FR-VOL-002:** Scalar rendering shall use image-order volume ray casting with ray marching for integration.
- **FR-VOL-003:** The renderer shall perform ray-domain intersection before volume sampling.
- **FR-VOL-004:** The renderer shall respect ROI, clipping, validity, land, and seabed boundaries.
- **FR-VOL-005:** The renderer shall composite samples front-to-back.
- **FR-VOL-006:** The renderer shall support early-ray termination.
- **FR-VOL-007:** The renderer shall use step-size-corrected opacity.
- **FR-VOL-008:** The renderer shall support transfer-function-aware empty-space skipping.
- **FR-VOL-009:** The renderer shall support multiresolution bricks and a bounded resident cache.
- **FR-VOL-010:** Missing high-resolution data shall use a lower-resolution fallback when available.
- **FR-VOL-011:** The application shall identify coarse, refining, refined, and incomplete states.
- **FR-VOL-012:** Users shall be able to select interactive, balanced, and reference quality profiles.
- **FR-VOL-013:** Quality adaptation shall not alter canonical scientific values.

## 7. Transfer functions and scalar controls

- **FR-TF-001:** Users shall edit color and opacity as functions of physical values.
- **FR-TF-002:** Transfer functions shall support ordered control points.
- **FR-TF-003:** The editor shall display units and active value range.
- **FR-TF-004:** Linear scaling shall be mandatory; logarithmic scaling shall be enabled only for valid domains.
- **FR-TF-005:** Missing, under-range, and over-range values shall have explicit policies.
- **FR-TF-006:** Presets shall be versioned and associated with compatible variables.
- **FR-TF-007:** Color maps shall include perceptually appropriate and color-vision-considerate options.
- **FR-TF-008:** Transfer-function changes shall update visibility metadata without reprocessing canonical source data.

## 8. Slicing, clipping, and isosurfaces

- **FR-CLIP-001:** Users shall control minimum and maximum displayed depth.
- **FR-CLIP-002:** Users shall create horizontal slices.
- **FR-CLIP-003:** Users shall create vertical slices.
- **FR-CLIP-004:** At least one arbitrary clipping plane shall be supported.
- **FR-CLIP-005:** Slice coordinates and values shall be shown in physical coordinates and units.
- **FR-ISO-001:** V1 shall support one scalar isosurface at a time.
- **FR-ISO-002:** The isosurface threshold shall be specified in physical units.
- **FR-ISO-003:** An isosurface generated from an approximate LOD shall be marked accordingly.
- **FR-ISO-004:** Isosurface extraction shall respect masks and seabed boundaries.

## 9. Vector fields

- **FR-VEC-001:** The platform shall preserve vector component identity, basis, and staggering.
- **FR-VEC-002:** Current speed shall be computed from compatible components using a documented formula.
- **FR-VEC-003:** Current visualization shall provide at least magnitude plus one of particles, glyphs, or streamlines.
- **FR-VEC-004:** Particle or glyph density controls shall change display density, not vector magnitude.
- **FR-VEC-005:** The interface shall disclose visual vector scaling.
- **FR-VEC-006:** Vertical vector exaggeration shall be separate from scientific component values.
- **FR-VEC-007:** WebGL2 may use fewer particles than WebGPU but shall preserve direction and speed semantics.

## 10. Time handling

- **FR-TIME-001:** The system shall distinguish model reference time, forecast period, valid time, observation time, climatology period, ingestion time, and processing time.
- **FR-TIME-002:** The timeline shall use valid time as the primary model display unless the user selects another documented view.
- **FR-TIME-003:** Users shall select discrete time steps.
- **FR-TIME-004:** Users shall play, pause, step forward, step backward, and change playback speed.
- **FR-TIME-005:** Playback shall prefetch likely future time steps within cache and network budgets.
- **FR-TIME-006:** Temporal interpolation shall be disabled by default unless scientifically supported and visibly identified.
- **FR-TIME-007:** Climatology selection shall use the correct month, season, or annual period.

## 11. Observation visualization

- **FR-OBS-001:** The platform shall query observations by ROI, time window, platform type, and variable.
- **FR-OBS-002:** Argo profiles shall be supported in V1.
- **FR-OBS-003:** Argo markers shall expose platform identifier, cycle, position, time, data mode, and available variables.
- **FR-OBS-004:** Argo trajectories shall be displayed where trajectory information is available.
- **FR-OBS-005:** Profile charts shall support pressure or depth as the vertical coordinate.
- **FR-OBS-006:** Source QC flags shall be retained.
- **FR-OBS-007:** The UI shall show the active normalized QC policy.
- **FR-OBS-008:** Raw and adjusted values shall not be mixed without explicit labeling.
- **FR-OBS-009:** Rejected values shall not contribute to metrics.
- **FR-OBS-010:** Observation requests shall be spatially and temporally bounded.

## 12. Exact inspection and profiles

- **FR-INSP-001:** Users shall select a point from the volume, a slice, a surface, or a profile.
- **FR-INSP-002:** Approximate GPU-rendered values shall be labelled approximate.
- **FR-INSP-003:** Exact inspection shall query canonical scientific data.
- **FR-INSP-004:** Inspection shall display coordinates, depth or pressure, time, value, units, validity, interpolation, and provenance.
- **FR-INSP-005:** The system shall distinguish nearest-neighbor, bilinear, trilinear, barycentric, and other interpolation methods.
- **FR-INSP-006:** Users shall request a vertical model profile at a selected location.
- **FR-INSP-007:** Profile extraction shall respect the source vertical-coordinate model.
- **FR-INSP-008:** Inspection requests shall be cancellable.

## 13. Model-observation collocation

- **FR-COL-001:** Users shall request a comparison for a compatible observation profile.
- **FR-COL-002:** Collocation shall validate spatial, temporal, vertical, unit, and variable compatibility.
- **FR-COL-003:** Collocation shall record model cell or interpolation neighborhood.
- **FR-COL-004:** Collocation shall record spatial distance and temporal offset.
- **FR-COL-005:** Vertical interpolation shall operate only over valid ranges and shall not silently extrapolate.
- **FR-COL-006:** Residual convention shall be `model - observation` unless explicitly configured otherwise.
- **FR-COL-007:** The system shall calculate valid-pair count, bias, MAE, and RMSE.
- **FR-COL-008:** Statistics shall display units.
- **FR-COL-009:** Comparison shall fail explicitly when insufficient valid pairs remain.
- **FR-COL-010:** Results shall include complete provenance and algorithm version.

## 14. Derived quantities

- **FR-DER-001:** Every derived variable shall declare its inputs, formula or library, parameters, units, and version.
- **FR-DER-002:** TEOS-10 quantities shall use an approved GSW implementation.
- **FR-DER-003:** Practical Salinity, Absolute Salinity, potential temperature, and Conservative Temperature shall remain distinct.
- **FR-DER-004:** Derived products shall be labelled as derived in catalogs, inspectors, exports, and legends.
- **FR-DER-005:** Cached derived products shall be invalidated when an input or algorithm version changes.
- **FR-DER-006:** Anomalies shall identify the baseline product, period, aggregation, and sign convention.

## 15. Data acquisition and processing

- **FR-ING-001:** Acquisition shall use registered provider adapters.
- **FR-ING-002:** Acquisition shall record source URL or query, timestamp, checksum, response metadata, and licence.
- **FR-ING-003:** Credentials shall not be stored in manifests, logs, browser state, or exports.
- **FR-ING-004:** Processing shall validate dimensions, coordinates, units, fill values, time, and grid topology.
- **FR-ING-005:** Canonical conversion shall retain source names and metadata.
- **FR-ING-006:** Rendering-product generation shall create LODs, bricks, halos, validity information, and acceleration metadata.
- **FR-ING-007:** Publication shall be atomic from the catalog user’s perspective.
- **FR-ING-008:** Processing shall be idempotent for the same source and configuration identity.
- **FR-ING-009:** Failed products shall remain unpublished and diagnosable.

## 16. API and storage

- **FR-API-001:** Control APIs shall publish an OpenAPI description.
- **FR-API-002:** Large rendering assets shall be delivered directly from object storage or a dedicated data plane.
- **FR-API-003:** FastAPI shall not proxy large brick payloads unless deployment policy requires it.
- **FR-API-004:** APIs shall validate input sizes, coordinate ranges, time ranges, and identifiers.
- **FR-API-005:** Long-running analysis requests shall be cancellable jobs.
- **FR-API-006:** API errors shall include stable machine-readable codes and safe human-readable messages.
- **FR-API-007:** Binary observation delivery should use Arrow IPC where beneficial.
- **FR-API-008:** JSON shall be used for metadata and bounded responses, not massive multidimensional arrays.

## 17. Reproducibility and export

- **FR-EXP-001:** Users shall export a reproducibility record.
- **FR-EXP-002:** The record shall include dataset, variable, time, ROI, depth, clipping, transfer function, renderer, quality, QC, and derivation metadata.
- **FR-EXP-003:** Analysis exports shall include collocation and statistical parameters.
- **FR-EXP-004:** Exports shall not include credentials, access tokens, or signed URLs.
- **FR-EXP-005:** Export schemas shall be versioned.
- **FR-EXP-006:** Numerical data export shall retain units, validity, and provenance.

## 18. Diagnostics and failure handling

- **FR-DIAG-001:** The application shall expose active renderer and capability status.
- **FR-DIAG-002:** Development diagnostics shall include frame time, cache use, resident bricks, and request counts.
- **FR-DIAG-003:** User-facing errors shall distinguish source, network, processing, authorization, renderer, and unsupported-browser failures.
- **FR-DIAG-004:** A failed layer shall not necessarily terminate unrelated layers.
- **FR-DIAG-005:** GPU device or context loss shall trigger controlled recovery.
- **FR-DIAG-006:** Retry behavior shall be bounded and cancellable.
- **FR-DIAG-007:** Failed or missing bricks shall never be interpreted as scalar zero.

