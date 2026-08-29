# User Journeys

**Document:** `docs/01-product/UserJourneys.md`  
**Status:** Normative for V1 acceptance

## 1. Journey conventions

Each journey defines:

- Actor.
- Preconditions.
- Primary flow.
- Alternate or failure flow.
- Required outcome.
- Related requirement identifiers.

## 2. Journey J-01 — First launch and capability detection

**Actor:** Any viewer  
**Preconditions:** Application URL is reachable.

### Primary flow

1. The user opens QuasarOceanScope.
2. The application loads the shell and checks browser capabilities.
3. If WebGPU satisfies required limits, the application selects WebGPU.
4. Otherwise, it attempts WebGL 2.0.
5. The application displays the selected renderer and quality profile.
6. The catalog and a default geographic overview become available.
7. The user can open the default V1 dataset.

### Alternate flow

- If WebGPU initialization fails after selection, the application releases partial resources and retries with WebGL 2.0.
- If WebGL 2.0 is also unavailable, the application displays supported-browser guidance and retains access to textual documentation where possible.

### Required outcome

A supported browser reaches a fully 3-D workspace without manual backend configuration.

## 3. Journey J-02 — Select a real model dataset and region

**Actor:** Researcher or analyst  
**Preconditions:** Catalog is loaded.

### Primary flow

1. The user opens Ocean Overview.
2. The user selects a provider, product, run, and variable.
3. The application displays the dataset footprint and available times.
4. The user draws or selects a region of interest.
5. The application validates the ROI against dataset coverage.
6. The user opens the Scientific Volume Lab.
7. Dataset, variable, time, ROI, and camera target are synchronized.

### Required outcome

The volume workspace opens using the selected real dataset and ROI without sharing GPU objects between CesiumJS and Babylon.js.

## 4. Journey J-03 — Explore a temperature volume

**Actor:** Researcher, analyst, or student  
**Preconditions:** A compatible temperature product is available.

### Primary flow

1. A low-resolution volume appears first.
2. The status area identifies the result as coarse and refining.
3. Higher-resolution bricks stream according to visibility and importance.
4. The user rotates, pans, and zooms the camera.
5. The renderer temporarily adjusts quality while the camera moves.
6. The user edits the transfer function in physical temperature units.
7. The user restricts the depth range.
8. The user creates a vertical slice.
9. The user pauses interaction and the image refines.
10. The status changes when the target refinement level is reached.

### Required outcome

The user can reveal and inspect depth-dependent thermal structure without loading the entire full-resolution dataset into GPU memory.

## 5. Journey J-04 — Switch to salinity and compare time steps

**Actor:** Researcher or analyst

### Primary flow

1. The user changes the active scalar variable from temperature to salinity.
2. The application loads the appropriate manifest and transfer-function preset.
3. Existing incompatible requests are cancelled.
4. The user selects a later valid time.
5. The coarse next time step appears before full refinement.
6. The user starts animation.
7. The system prefetches likely next steps without exceeding cache budgets.
8. The user pauses and inspects a stable time step.

### Required outcome

Variable and time changes do not leak resources, mix stale bricks, or display incorrect units.

## 6. Journey J-05 — Inspect an exact value

**Actor:** Researcher or analyst

### Primary flow

1. The user activates inspection mode.
2. The user selects a visible location in the volume or on a slice.
3. The application reports the selected geographic coordinate and depth.
4. The UI may immediately show an approximate rendered value, clearly labelled.
5. The application requests the canonical value from the scientific query path.
6. The exact value replaces or accompanies the approximate value.
7. The inspector displays units, time, interpolation, grid identity, validity, QC, and provenance.

### Alternate flow

- If the canonical value is missing or invalid, the inspector displays the specific missing-data category.
- If the request is cancelled by a new selection, the old result shall not overwrite the new selection.

### Required outcome

The user can distinguish visual approximation from an exact canonical query.

## 7. Journey J-06 — Visualize currents

**Actor:** Researcher or analyst

### Primary flow

1. The user enables the current layer.
2. The application verifies component availability and staggering metadata.
3. Components are rotated into the documented geographic or display basis.
4. The user chooses particles, glyphs, or magnitude.
5. The interface displays the vector scale and units.
6. The user adjusts density without changing the scientific vector values.
7. If vertical exaggeration is enabled, the application discloses separate vertical display scaling.

### Required outcome

Direction, speed, component basis, and visual scaling are not conflated.

## 8. Journey J-07 — Discover and inspect an Argo profile

**Actor:** Researcher, analyst, or student

### Primary flow

1. The user enables the Argo layer in Ocean Overview or Scientific Volume Lab.
2. The application retrieves observations within the current ROI and time window.
3. Markers indicate profile availability and QC state.
4. The user selects a float or profile.
5. The application displays platform, cycle, position, time, data mode, and available variables.
6. Temperature and salinity profiles are plotted against pressure or depth.
7. Rejected values are hidden or styled according to the selected QC policy.
8. Raw and adjusted values are identified correctly.

### Required outcome

Observation measurements remain traceable to source variables and QC flags.

## 9. Journey J-08 — Compare an Argo profile with the model

**Actor:** Researcher or operational analyst

### Primary flow

1. The user selects an Argo profile.
2. The user requests model comparison.
3. The application identifies compatible model products and times.
4. The user confirms or changes the selected model time.
5. The backend performs horizontal, vertical, and temporal collocation using the documented method.
6. The UI displays model and observation profiles on common units.
7. The UI displays residuals and valid-pair coverage.
8. Bias, MAE, and RMSE are shown with units and sign convention.
9. The user opens the provenance record.

### Alternate flow

The application rejects the comparison with a specific explanation if:

- Variables or units are incompatible.
- No model time is within tolerance.
- The observation is outside the model domain.
- Insufficient valid levels remain.
- Required coordinate metadata are missing.

### Required outcome

No metric is presented without valid, unit-compatible value pairs and collocation metadata.

## 10. Journey J-09 — Compare against climatology

**Actor:** Researcher

### Primary flow

1. The user enables a compatible climatological reference.
2. The application selects the appropriate month, season, or annual period.
3. Model and climatology variables are converted to compatible definitions and units.
4. The user requests an anomaly field or profile.
5. The interface displays the anomaly convention and baseline period.
6. The result is labelled as derived.

### Required outcome

A climatology is never presented as a simultaneous observation or real-time field.

## 11. Journey J-10 — Recover from network or brick failure

**Actor:** Any viewer

### Primary flow

1. One or more brick requests fail.
2. The renderer continues using resident lower-resolution data where possible.
3. Failed bricks are visibly represented as unavailable rather than zero-valued.
4. Retry uses bounded exponential backoff.
5. The user may manually retry.
6. Successful requests refine the view without resetting the camera.

### Required outcome

A partial data failure does not corrupt the scene or crash the application.

## 12. Journey J-11 — Recover from GPU context or device loss

**Actor:** Any viewer

### Primary flow

1. The application detects device or context loss.
2. Rendering pauses and the user is informed.
3. GPU resources are discarded safely.
4. The application attempts backend restoration.
5. If WebGPU cannot recover, WebGL 2.0 is offered automatically.
6. Domain state, camera, ROI, time, and selected layers are restored.
7. Required bricks are requested again.

### Required outcome

Loss recovery does not require re-entering the scientific selection.

## 13. Journey J-12 — Export a reproducibility record

**Actor:** Researcher or analyst

### Primary flow

1. The user chooses **Export reproducibility record**.
2. The application collects dataset identifiers, source versions, variables, times, ROI, camera, clipping, transfer function, quality profile, QC policy, derivations, and analysis parameters.
3. The record identifies approximate rendering settings separately from scientific query settings.
4. The user downloads the record in a documented machine-readable format.
5. Sensitive credentials and signed URLs are excluded.

### Required outcome

The exported record contains enough information to reconstruct the scientific selection, subject to source availability and permissions.

## 14. Journey J-13 — Use the application by keyboard

**Actor:** Keyboard-only user

### Primary flow

1. The user navigates the shell using standard focus movement.
2. The user opens the dataset browser and selects a variable.
3. The user moves to the timeline and changes time.
4. The user opens transfer-function presets.
5. The user reaches the inspector and profile chart.
6. Visible focus is retained throughout.
7. Canvas-specific controls provide documented keyboard alternatives.

### Required outcome

The essential V1 workflow does not require pointer-only interaction.

## 15. Journey J-14 — Launch an outreach experience

**Actor:** Educator or public user

### Primary flow

1. The user opens a curated outreach route.
2. The application loads a predefined real dataset and view.
3. A short explanation identifies the phenomenon and data source.
4. Only safe, understandable controls are initially displayed.
5. The user explores the volume, time, and annotations.
6. The user can reveal source and scientific details.
7. The user may switch to operational mode if permitted.

### Required outcome

Simplification changes presentation and available controls, not the underlying scientific identity of the data.

