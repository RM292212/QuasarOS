# Responsive Design

**File:** `docs/06-design/ResponsiveDesign.md`  
**Status:** Normative

## Breakpoints

Breakpoints are content-driven rather than device-specific.

### Wide desktop

- Left and right panels visible.
- Full timeline.
- Large scientific viewport.
- Multi-chart analysis layout.

### Standard desktop or tablet landscape

- One side panel visible at a time.
- Other panel becomes a drawer.
- Timeline remains docked.
- Charts stack vertically.

### Tablet portrait

- Workspace fills most of screen.
- Dataset and inspector use modal drawers.
- Simplified toolbar.
- Timeline uses compact controls.
- Touch camera controls enabled.

### Small screen

- Outreach Mode is preferred.
- One primary panel at a time.
- Fullscreen canvas with bottom sheet.
- Reduced layer count and quality.
- Operational workflows may show minimum-width guidance.

## Panel behavior

- Resizable on desktop.
- Collapsible on all sizes.
- Drawers retain focus and restore it on close.
- Canvas resizes without losing camera state.
- Important units and time remain visible.

## 3-D viewport

Maintain:

- Minimum usable viewport.
- Reset control.
- Orientation widget.
- Legend.
- Active-time display.
- Renderer/quality badge.
- Touch-safe control spacing.

## Touch gestures

- One finger: orbit.
- Two fingers: pan and zoom.
- Buttons provide alternatives.
- No essential action requires complex gestures.
- Accidental page scrolling shall be prevented only inside an actively manipulated canvas.

## Performance adaptation

Smaller or constrained devices may use:

- Lower render scale.
- Coarser LOD.
- Fewer particles.
- Reduced gradients.
- Shorter temporal history.
- Limited simultaneous layers.

## Testing

Test portrait, landscape, zoom, browser UI resizing, touch, virtual keyboards, panel opening, chart readability, and workspace restoration.
