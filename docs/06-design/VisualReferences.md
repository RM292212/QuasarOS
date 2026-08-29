# Visual References

**File:** `docs/06-design/VisualReferences.md`  
**Status:** Normative reference definition

## Purpose

Visual references define the scenes and screenshots used to evaluate layout, visual consistency, rendering correctness, accessibility, and regressions.

## Required reference scenes

### VR-01 — Empty application shell

Shows navigation, panels, timeline, and no-dataset guidance.

### VR-02 — Ocean Overview

Shows dataset footprint, ROI, bathymetric context, Argo markers, and selected profile.

### VR-03 — Temperature volume

Shows a depth-resolved scalar volume, bathymetry, coastline context, legend, valid time, and refinement badge.

### VR-04 — Salinity slice

Shows vertical slice, physical axes, transfer function, and exact inspector.

### VR-05 — Current particles

Shows current direction, magnitude legend, vector scale disclosure, and vertical exaggeration.

### VR-06 — Profile comparison

Shows observation, model, residual, statistics, QC state, and collocation metadata.

### VR-07 — WebGL2 fallback

Shows the same scientific scene with visible WebGL2 badge and fallback quality.

### VR-08 — Outreach story

Shows simplified controls, explanatory content, attribution, and touch-friendly layout.

### VR-09 — Error state

Shows incomplete brick loading with retained coarse volume and recovery action.

### VR-10 — Accessibility state

Shows visible focus, high-contrast controls, reduced-motion indication, and chart table.

## Capture metadata

Every reference records:

- Dataset and checksum.
- Variable.
- Time.
- ROI.
- Camera.
- Transfer function.
- Renderer.
- Quality profile.
- Viewport.
- Browser.
- Theme.
- Vertical exaggeration.
- Expected loading state.

## Review rules

References shall not use arbitrary untracked camera views or datasets. Changes require explanation: intentional design update, renderer correction, browser difference, or regression.
