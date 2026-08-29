# Outreach Mode

**Document:** `docs/01-product/OutreachMode.md`  
**Status:** Normative

## 1. Purpose

Outreach Mode provides an understandable and engaging version of QuasarOceanScope for students, educators, decision-makers, and the public. It uses the same real datasets and scientific identities as Operational Mode while reducing complexity and emphasizing explanation.

Outreach Mode shall simplify interaction, not falsify or silently alter scientific meaning.

## 2. Core principles

1. Use real, attributed data.
2. Prefer guided exploration over unrestricted configuration.
3. Explain model, observation, climatology, and derived data distinctly.
4. Keep units visible or readily available.
5. Use curated transfer functions and camera views.
6. Disclose vertical exaggeration and visual approximation.
7. Provide accessible alternatives to color and animation.
8. Permit deeper scientific details to be revealed progressively.
9. Avoid operational or safety claims.
10. Preserve provenance.

## 3. Default experience

An outreach route should open with:

- A curated geographic region.
- A selected real dataset.
- One primary variable.
- A meaningful camera view.
- A concise phenomenon explanation.
- Source attribution.
- A simple time control.
- A legend with physical units.
- A reset button.
- A link to detailed scientific information.

The first experience shall not require the user to understand model-product identifiers or grid topology.

## 4. Curated stories

Outreach Mode may provide stories such as:

- Temperature changes with depth.
- Salinity structure and freshwater influence.
- Ocean currents and transport.
- Mixed-layer seasonal change.
- Relationship between bathymetry and circulation.
- Model versus Argo observation.
- Chlorophyll at the surface versus depth-resolved measurements.
- Climatological conditions versus a selected period.

Each story shall define:

- Learning objective.
- Dataset and version.
- Region and time.
- Required variables.
- Camera keyframes or views.
- Transfer-function preset.
- Annotations.
- Scientific reviewer.
- Accessibility notes.
- Attribution.
- Last validation date.

## 5. Simplified controls

The default control set may include:

- Play or pause.
- Previous or next time.
- Rotate, zoom, and reset.
- Variable selector limited to curated choices.
- Depth reveal or slice.
- Opacity control.
- Observation toggle.
- Explanation toggle.
- Fullscreen.
- Reduced-motion control.

Advanced controls may be hidden behind **Explore advanced controls**.

## 6. Scientific explanations

Plain-language descriptions shall:

- Define the variable.
- State its units.
- Explain whether it is modeled, observed, climatological, or derived.
- Explain what color and opacity mean.
- State whether vertical scale is exaggerated.
- Explain important limitations.
- Avoid implying that interpolation creates new measurements.
- Link to provider and provenance details.

## 7. Visual design

Outreach Mode should use:

- Large readable labels.
- Limited simultaneous layers.
- Curated color maps.
- Strong contrast.
- Icons plus text.
- Short explanations.
- Touch-friendly targets.
- Stable default camera behavior.
- Minimal technical diagnostics.

Color shall not be the sole carrier of meaning. Legends shall provide labels, ranges, units, and patterns or annotations where necessary.

## 8. Animation

Animations shall:

- Provide play, pause, and restart.
- Respect reduced-motion preferences.
- Avoid uncontrolled rapid camera movement.
- Identify time progression clearly.
- Avoid implying continuous measurements when discrete steps are shown.
- Pause or reduce detail when device performance is inadequate.

## 9. Observation presentation

Observation markers shall explain:

- What the platform is.
- When and where the measurement occurred.
- Which variables were measured.
- That a profile is a vertical sequence of observations.
- Whether values passed the active QC policy.

A model-observation comparison shall explain that differences may arise from:

- Model resolution.
- Spatial separation.
- Temporal separation.
- Measurement uncertainty.
- Interpolation.
- Model limitations.

## 10. Outreach data restrictions

Outreach Mode shall not:

- Expose provider credentials.
- Bypass restricted-data policies.
- Present unvalidated or partially processed products.
- Label satellite surface chlorophyll as full-depth chlorophyll.
- Hide scientific warnings that materially affect interpretation.
- Use synthetic data without explicit and prominent identification.
- Provide unrestricted analysis execution to anonymous users.

## 11. Device adaptation

On resource-constrained devices, Outreach Mode may:

- Lower render resolution.
- Use coarser LODs.
- Reduce particle count.
- Disable expensive lighting.
- Limit active layers.
- Use shorter time ranges.
- Prefer precomputed isosurfaces or slices.

It shall still remain 3-D when WebGL 2.0 is supported and shall indicate reduced quality where relevant.

## 12. Educator support

Educator-facing features may include:

- Lesson links.
- Guided questions.
- Preset views.
- Optional annotations.
- Data-source references.
- Screenshot or view export.
- A glossary.
- A table view of selected values.
- Switching between simplified and advanced explanations.

## 13. Transition to Operational Mode

If permitted, users may switch to Operational Mode. The transition shall:

- Preserve current dataset, time, ROI, and camera where compatible.
- Reveal advanced controls.
- Retain provenance.
- Clearly indicate the change in interface mode.
- Not change values merely because the interface mode changed.

## 14. Outreach acceptance

Outreach Mode is accepted when:

- A new user can launch a curated real-data story without training.
- Variable, units, source, time, and vertical exaggeration are understandable.
- Primary controls work with pointer, touch, and keyboard.
- Reduced-motion behavior works.
- A user can inspect at least one observation and explanation.
- Scientific reviewers approve the story’s wording and presets.
- The experience remains usable under its documented minimum device profile.

