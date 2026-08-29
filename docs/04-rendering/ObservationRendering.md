# Observation Rendering

**File:** `docs/04-rendering/ObservationRendering.md`  
**Status:** Normative

## Supported primitives

- Platform marker.
- Profile line.
- Trajectory polyline.
- Measurement points.
- Vertical curtain.
- Current-vector glyph.
- Selection highlight.
- Uncertainty or QC styling.

## Coordinate handling

Observation positions use canonical longitude, latitude, and true depth or pressure-derived depth. Rendering converts them through the same geographic-to-local transform used by the scientific scene.

Vertical exaggeration affects display position only.

## Argo rendering

An Argo profile may include:

- Surface marker.
- Float trajectory.
- Vertical profile line.
- Measurement points.
- Color by variable, time, or QC.
- Selected-profile highlight.

Profile points shall not be connected across missing or rejected intervals without explicit styling.

## Level of detail

Observation density is controlled by:

- Spatial clustering.
- Screen-space marker limits.
- Time filtering.
- Platform filtering.
- Importance and selection.
- Distance-based simplification.

Selected observations remain visible and are not removed by clustering.

## Occlusion

Observation layers may support:

- Depth-aware occlusion.
- Always-visible selected marker.
- Optional x-ray mode.
- Clipping-consistent mode.

The active mode shall be understandable from the UI.

## Picking

Every rendered observation primitive carries a stable observation or platform ID. Picking resolves metadata through the observation service rather than embedding full profiles in GPU objects.

## QC and uncertainty

QC uses shape, outline, icon, or label in addition to color. Unknown, rejected, and accepted values remain distinguishable.

## Performance

Use instancing for markers and batched line geometry for trajectories. Large profile data remain outside React state and are uploaded only for visible or selected observations.

## Validation

Test geographic alignment, depth placement, vertical exaggeration, clustering, selected-state persistence, QC styles, missing segments, and WebGPU/WebGL2 parity.
