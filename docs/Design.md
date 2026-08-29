# QuasarOceanScope UX/UI Design

## 1. Design objective

QuasarOceanScope must make complex ocean data understandable without hiding scientific meaning.

The interface must support both:

- Operational/scientific analysis.
- Public outreach and education.

V1 prioritizes operational/scientific analysis.

## 2. Application shell

Desktop layout:

```text
┌──────────────────────────────────────────────────────────┐
│ Header: project, workspace, dataset, run, status        │
├──────────────┬────────────────────────────┬───────────────┤
│ Data/layers  │ Main Cesium or Babylon    │ Inspector     │
│ panel        │ workspace                  │ and analysis  │
│              │                            │ panel          │
├──────────────┴────────────────────────────┴───────────────┤
│ Timeline, playback, valid time, lead time, loading      │
└──────────────────────────────────────────────────────────┘
```

Panels should be collapsible. The main scientific view must retain adequate screen area.

## 3. Workspaces

### Ocean Overview

Display:

- Globe or regional geographic view.
- India and EEZ context.
- model-domain footprints.
- observation locations.
- tracks.
- selected ROI.
- data availability.
- valid-time context.

Primary actions:

- Select ROI.
- select observation.
- select dataset footprint.
- open selected region in Volume Lab.

### Scientific Volume Lab

Display:

- 3D ocean volume.
- bathymetry.
- current vectors/particles.
- observation markers/profiles.
- clipping planes.
- axes and scale.
- colorbar.
- loading/refinement status.

Primary actions:

- Orbit, pan, zoom.
- change variable.
- change time/depth.
- clip.
- inspect.
- create profile/transect.
- select observation.
- compare model and observation.

## 4. Header

The header must show:

- QuasarOS/QuasarOceanScope identity.
- active workspace.
- active provider/product.
- model run/reference time.
- valid time.
- renderer backend.
- connection/data status.
- user/help menu.

The renderer badge must distinguish:

```text
WebGPU
WebGL 2
```

WebGL 2 must not be labelled as “2D mode.”

## 5. Dataset and layer panel

Organize variables by topology and scientific domain.

```text
Physical ocean
    Temperature
    Salinity
    Current speed
    Currents
    Sea-surface height
    Mixed-layer depth

Biogeochemistry
    Oxygen
    Model chlorophyll
    Nutrients

Observations
    Argo
    Glider
    CTD
    ADCP
    HF radar
    Buoys

Context
    Bathymetry
    Coastline
    EEZ
    Climatology

Derived
    Density
    Anomaly
    N²
    Thermocline
    OMZ
```

Unavailable variables must be visibly disabled with a reason.

## 6. Timeline

The timeline must distinguish:

- Model initialization/reference time.
- Forecast lead time.
- Model valid time.
- Observation time.
- Climatology month.
- Current playback position.

Controls:

- Play/pause.
- step forward/backward.
- playback speed.
- range.
- loop.
- preload status.
- available/missing-time indicators.

## 7. Transfer-function editor

Controls:

- Palette.
- physical min/max.
- linear/log/symmetric-log scale.
- opacity curve.
- discrete/continuous mode.
- under/over colors.
- missing-data treatment.
- preset.
- reset.
- lock range across time.

The colorbar must always display:

- Variable name.
- physical units.
- numeric range.
- scale type.
- source or derived status.

Per-frame autoscaling must never activate silently.

## 8. Volume controls

Provide:

- Volume opacity.
- sampling quality.
- lighting.
- vertical exaggeration.
- depth range.
- clipping planes.
- value filtering.
- isosurface threshold.
- current-particle density.
- reset camera.

Quality presets:

```text
Interactive
Balanced
High
Publication
```

Each preset must have documented rendering behavior.

## 9. Inspector panel

When the user selects a location, display:

- Longitude.
- latitude.
- true depth.
- displayed/exaggerated depth.
- variable.
- approximate display value if available.
- exact canonical value when returned.
- units.
- valid time.
- source cell/grid information.
- interpolation method.
- provider/product.
- QC/uncertainty.
- provenance link.

Approximate and exact values must be visually distinguished.

## 10. Observation panel

For an Argo profile, display:

- WMO ID.
- cycle.
- direction.
- observation time.
- latitude/longitude.
- data mode.
- available variables.
- QC summary.
- provider/source.
- depth profile.
- model comparison.

Charts must support:

- Temperature versus pressure/depth.
- salinity versus pressure/depth.
- model and observation overlay.
- residual.
- synchronized cursor.
- QC markers.
- export.

## 11. Model-observation comparison

The comparison panel must show:

- Model product/run.
- observation ID.
- time separation.
- horizontal separation.
- interpolation method.
- valid levels.
- bias.
- RMSE.
- maximum absolute difference.
- excluded observations and reason.

A comparison without declared collocation settings must not be presented as authoritative.

## 12. Loading and refinement

Progressive volume loading must be understandable.

Show:

- Coarse image available.
- refinement percentage or brick status.
- current LOD.
- network loading.
- decode/upload status.
- incomplete-data warning.

Do not block interaction while fine detail loads.

## 13. Error states

Errors must provide:

- Clear description.
- affected layer.
- whether existing data remain valid.
- retry action.
- change-selection action.
- technical details toggle.
- correlation/request ID where available.

## 14. Scientific trust indicators

Every layer exposes:

- Provider.
- product ID.
- variable definition.
- units.
- timestamp.
- processing level.
- source/canonical/derived classification.
- licence/attribution.
- uncertainty/QC status.

Synthetic test data must never appear in production interfaces.

## 15. Accessibility

Requirements:

- Keyboard operation for major controls.
- Visible focus.
- semantic labels.
- sufficient contrast.
- color-vision-friendly palettes.
- palette not used as the sole status indicator.
- scalable text.
- reduced-motion support.
- textual alternatives for essential chart results.

## 16. Responsive behavior

Desktop is the primary V1 target.

Tablet may provide reduced panels and lower quality.

Small mobile devices may support overview and lightweight inspection, but full production volume analysis is not a V1 requirement.

## 17. Outreach mode

Future/outreach mode may provide:

- Simplified controls.
- guided scenes.
- narrated scientific stories.
- preset locations.
- educational explanations.
- touch-friendly operation.

It must use the same real scientific sources while clearly communicating simplifications.

