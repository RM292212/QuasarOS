# Application Shell

**File:** `docs/06-design/ApplicationShell.md`  
**Status:** Normative

## Desktop layout

The default shell contains:

- Top application bar.
- Left dataset and layer panel.
- Central active workspace.
- Right inspector and configuration panel.
- Bottom timeline.
- Status and notification region.

Recommended dimensions:

- Header: 48–56 px.
- Left panel: 280–360 px, resizable.
- Right panel: 320–420 px, resizable.
- Timeline: 96–160 px depending on mode.
- Minimum central viewport: 640 × 480 px.

## Header

The header displays:

- QuasarOS and QuasarOceanScope identity.
- Active workspace.
- Provider and product.
- Dataset or model run.
- Valid time.
- Renderer badge: WebGPU or WebGL2.
- Operational or Outreach mode.
- Connection and processing status.
- Help, settings, and user menu.

## Left panel

Tabs:

1. Data.
2. Layers.
3. Observations.
4. Saved views where enabled.

The panel shall remain navigable by keyboard and support collapse without losing state.

## Right panel

Context-sensitive sections:

- Inspector.
- Visualization.
- Transfer function.
- Clipping and slices.
- Analysis.
- Provenance.

Only controls applicable to the selected layer appear. Unavailable controls remain visible when explanation is useful.

## Central workspace

Contains either:

- Ocean Overview using CesiumJS.
- Scientific Volume Lab using Babylon.js.

The canvas area includes:

- Orientation widget.
- Scale or spatial context.
- Depth indicator.
- Reset-view action.
- Quality/refinement indicator.
- Active-layer legend.
- Optional diagnostics.

## Status behavior

Blocking errors appear inside the affected workspace. Non-blocking warnings appear in a persistent status area. Toasts are reserved for short confirmations and shall not contain essential information exclusively.

## Persistence

The shell may preserve:

- Panel sizes.
- Collapsed sections.
- Theme.
- Mode.
- Preferred quality.
- Last workspace.

Dataset-specific controls shall reset when incompatible with a new selection.
