# Transfer Function Editor

**File:** `docs/06-design/TransferFunctionEditor.md`  
**Status:** Normative

## Purpose

The editor maps physical scalar values to color and opacity while preserving units, active range, and reproducibility.

## Layout

### Header

- Variable.
- Unit.
- Source range.
- Active display range.
- Preset selector.
- Reset action.

### Histogram

Displays scalar distribution for the selected dataset, time, ROI, and LOD where available. Histogram provenance and approximation state shall be visible.

### Color ramp

Shows ordered color control points across the physical domain.

### Opacity curve

Shows ordered opacity control points with draggable handles and numeric editing.

### Advanced settings

- Linear, logarithmic, or approved scale.
- Under-range color/opacity.
- Over-range color/opacity.
- Missing-data behavior.
- Discrete or continuous mode.
- Reference sampling distance.
- Reverse palette.

## Interaction

Users can:

- Add, select, move, and delete control points.
- Edit physical value numerically.
- Edit opacity numerically.
- Choose color accessibly.
- Zoom the histogram range.
- Restore variable defaults.
- Save a permitted preset.

## Constraints

- Control points remain ordered.
- Log scale requires a valid positive domain.
- Missing data default to transparent.
- Narrow visible ranges trigger conservative occupancy updates.
- Unit conversion updates all control-point values consistently.

## Accessibility

Provide a table representation with value, color, and opacity. Dragging has keyboard and numeric alternatives. The palette name and accessibility characteristics are available as text.

## Reproducibility

The serialized transfer function contains physical domain, units, control points, scale mode, policies, reference step, preset ID, and version.

## Feedback

Changes update the renderer interactively. The UI indicates when visibility metadata or temporal history is rebuilding.
