# Accessibility

**File:** `docs/06-design/Accessibility.md`  
**Status:** Normative  
**Target:** WCAG 2.2 AA where applicable

## Principles

- All essential workflows shall be usable without a mouse.
- Color shall never be the only signal.
- Scientific information rendered in canvas shall have an HTML alternative.
- Motion, particles, camera animation, and temporal effects shall respect reduced-motion preferences.
- Accessibility shall be designed into components, not added after completion.

## Keyboard interaction

The keyboard shall support:

- Workspace navigation.
- Dataset and variable selection.
- Timeline control.
- Layer visibility.
- Transfer-function presets and numeric editing.
- Camera orbit, pan, zoom, and reset.
- Slice and clipping controls.
- Observation selection.
- Exact-value inspection.
- Profile comparison.
- Dialog confirmation and cancellation.

Use visible focus indicators and predictable tab order. Canvas-specific shortcuts shall work only while the viewport is focused.

## Canvas accessibility

The 3-D viewport shall expose an accessible HTML summary containing:

- Dataset.
- Variable.
- Units.
- Valid time.
- Geographic region.
- Depth range.
- Renderer.
- Refinement state.
- Selected object or location.
- Vertical exaggeration.

Provide buttons for camera movement, reset, inspection at view center, and opening a tabular inspector.

## Color and contrast

- UI text and controls meet AA contrast.
- Palettes include perceptually uniform and color-vision-considerate options.
- QC states use icons, text, outlines, or patterns in addition to color.
- Model, observation, and residual chart lines use different shapes or line styles.
- Missing data shall be identifiable without relying on transparency alone.

## Motion

Reduced-motion mode shall:

- Disable camera fly-throughs.
- Shorten or remove panel animations.
- Reduce particle trails.
- Disable nonessential temporal accumulation effects.
- Require explicit playback start.
- Avoid automatic camera movement in outreach stories.

## Charts

Charts provide:

- Accessible title.
- Axis names and units.
- Keyboard-readable data points where practical.
- A synchronized table.
- Text summary of metrics.
- Download option where authorized.

## Validation

Accessibility testing includes automated scanning, keyboard-only use, screen-reader review, zoom at 200%, contrast, reduced motion, touch targets, canvas alternatives, and manual completion of the primary V1 workflow.
