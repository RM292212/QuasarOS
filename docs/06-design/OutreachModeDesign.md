# Outreach Mode Design

**File:** `docs/06-design/OutreachModeDesign.md`  
**Status:** Normative

## Audience

Students, educators, public users, media, and non-specialist decision-makers.

## Design priorities

- Immediate visual understanding.
- Minimal setup.
- Curated real datasets.
- Plain language.
- Guided stories.
- Touch support.
- Accessibility.
- Clear source attribution.

## Default layout

- Large central 3-D viewport.
- Compact top bar.
- Collapsible story panel.
- Simplified bottom timeline.
- Minimal legend.
- Optional explanation drawer.

Dataset IDs, diagnostics, and advanced processing controls remain available under **Scientific details**.

## Story structure

Each story includes:

- Title.
- One-sentence phenomenon description.
- Real dataset and source.
- Region and time.
- Guided steps.
- Curated variable.
- Transfer-function preset.
- Camera views.
- Annotations.
- Key takeaway.
- Limitations.
- Attribution.

## Simplified controls

- Play/pause.
- Previous/next time.
- Rotate, pan, zoom, reset.
- Variable choice from a short curated list.
- Depth reveal.
- Observation toggle.
- Explanation toggle.
- Fullscreen.
- Reduced-motion option.

## 3-D presentation

The ocean volume shall appear within recognizable geographic context:

- Surface boundary.
- Bathymetric floor.
- Orientation indicator.
- Depth labels.
- Optional coastline.
- Clearly disclosed vertical exaggeration.

Avoid excessive simultaneous transparent layers.

## Explanations

Plain-language text shall distinguish:

- Model estimate.
- Direct observation.
- Climatology.
- Derived value.
- Visual approximation.

## Device adaptation

On constrained devices, reduce resolution, LOD, particles, lighting, and active layers while retaining 3-D WebGL2 operation.

## Transition

Users may switch to Operational Mode if permitted. Dataset, time, ROI, camera target, and selected observation should remain intact.
