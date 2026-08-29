# Workspace Navigation

**File:** `docs/06-design/WorkspaceNavigation.md`  
**Status:** Normative

## Workspaces

### Ocean Overview

Used for:

- Geographic orientation.
- Dataset discovery.
- Footprints.
- ROI creation.
- Observation search.
- Surface context.

### Scientific Volume Lab

Used for:

- Volume rendering.
- Slices and clipping.
- Bathymetry.
- Currents.
- Observation profiles.
- Exact inspection.
- Scientific comparison.

## Workspace switcher

The header contains a two-option workspace switcher with text and icons. Keyboard shortcuts:

- `1`: Ocean Overview.
- `2`: Scientific Volume Lab.

The current workspace shall be programmatically and visually indicated.

## Synchronized state

Preserve between workspaces:

- Dataset.
- Variable.
- Valid time.
- ROI.
- Selected observation.
- Active surface context.
- Geographic target.
- Relevant filters.

Do not synchronize:

- GPU resources.
- Scene nodes.
- Renderer-specific camera matrices.
- Temporary hover state.
- Backend-specific quality details.

## Transition behavior

When moving from Overview to Volume Lab:

1. Validate dataset and variable.
2. Validate ROI.
3. Create or retrieve render manifest.
4. Map geographic target to local ENU.
5. Open Volume Lab immediately.
6. Show loading state until coarse data arrive.

When returning to Overview, retain ROI and selected observations without forcing the globe camera to match the local 3-D camera exactly.

## Deep linking

Routes should support:

- `/overview`
- `/volume`
- Dataset and variable identifiers.
- Valid time.
- ROI.
- Public selected observation.
- Saved-view identity where permitted.

## Navigation safeguards

If unsaved analysis settings would be lost, prompt only when loss is meaningful. Ordinary workspace changes shall not interrupt background jobs or reset scientific selection.

## Breadcrumbs

Scientific context breadcrumbs may display:

    Provider / Product / Dataset / Variable / Time

Each segment opens the appropriate selection level without discarding unrelated valid state.
