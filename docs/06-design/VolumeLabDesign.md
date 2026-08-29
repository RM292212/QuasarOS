# Volume Lab Design

**File:** `docs/06-design/VolumeLabDesign.md`  
**Status:** Normative

## Purpose

Scientific Volume Lab is the primary interactive 3-D/4-D environment for depth-resolved ocean fields, surfaces, currents, bathymetry, and observations.

## Scene composition

The scene may contain:

- Scalar volume.
- Horizontal and vertical slices.
- One isosurface.
- Bathymetric terrain or seabed mesh.
- Sea-surface plane.
- Coastline or geographic reference.
- Current glyphs or particles.
- Observation markers, trajectories, and profiles.
- Selection and analysis annotations.

## Spatial model

The regional scene uses a local ENU frame. Horizontal coordinates represent geographic position; vertical coordinates represent true depth transformed by the visible exaggeration factor.

The scene shall expose:

- North orientation.
- Horizontal scale.
- Depth scale.
- Volume bounds.
- Surface level.
- Seabed.
- ROI outline.
- Exaggeration value.

## Camera

Default camera behavior:

- Orbit around ROI center.
- Constrained near/far clipping.
- Fit-volume action.
- Fit-selected-profile action.
- Top, north, south, east, west, and perspective presets.
- Smooth movement disabled under reduced motion.
- No camera reset during data refinement.

## Layer ordering

Recommended composition:

1. Opaque bathymetry and reference geometry.
2. Scalar volume.
3. Isosurface or slices.
4. Vector fields.
5. Observations.
6. Selection overlays and labels.

Transparency and depth behavior shall be explicitly managed.

## 3-D controls

- Camera reset and presets.
- Vertical exaggeration.
- Depth range.
- Horizontal slice.
- Vertical slice.
- Arbitrary clipping plane.
- Volume opacity and transfer function.
- Isosurface threshold.
- Lighting.
- Current mode and density.
- Observation visibility.
- Quality profile.

## Scientific inspector

Picking reports:

- Geographic coordinate.
- True depth.
- Approximate rendered value.
- Exact canonical value when returned.
- Units.
- Valid time.
- LOD.
- Grid cell or interpolation.
- Validity/QC.
- Provenance.

## Progressive rendering

The viewport displays coarse coverage first. A badge indicates `Coarse`, `Refining`, `Target quality`, or `Incomplete`. Parent LOD remains until finer bricks are valid.

## Visual safeguards

- Missing bricks never appear as zero-valued water.
- Land and below-seabed cells remain excluded.
- Surface fields are not extruded into false volumes.
- Vertical exaggeration never changes exact values.
- Quantized GPU values are labelled approximate.
