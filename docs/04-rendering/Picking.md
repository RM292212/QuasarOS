# Picking

**File:** `docs/04-rendering/Picking.md`  
**Status:** Normative

## Picking modes

- Surface picking.
- Volume first-visible-contribution picking.
- Slice picking.
- Isosurface picking.
- Observation picking.
- Bathymetry picking.
- Geographic coordinate picking.

## Two-stage inspection

### Immediate approximate result

The renderer may return:

- Ray position.
- Approximate scalar value.
- Rendered LOD.
- Brick ID.
- Sample depth.
- Selected primitive ID.

This result shall be labelled approximate.

### Exact scientific result

The application sends canonical coordinates, dataset, variable, time, and interpolation method to the exact-query API. The returned canonical value supersedes or accompanies the approximate value.

## Coordinate reconstruction

Picking shall reverse:

- Canvas and viewport transform.
- Camera projection.
- Local-origin transform.
- Vertical exaggeration.
- Volume normalization.

The final request uses true geographic and vertical coordinates.

## Volume hit definition

The default volume hit is the first sample where accumulated opacity or sample contribution exceeds a configured threshold. Alternative modes may select maximum contribution or user-defined slice intersection.

The active definition shall be documented.

## Stable identity

Observation, surface, brick, and isosurface picks return stable domain IDs rather than pointers to scene objects.

## Cancellation

A new pick cancels or supersedes previous exact queries. Late results shall not overwrite the current selection.

## Accessibility

Picking results appear in an accessible HTML inspector. Keyboard users can inspect the view center, selected marker, slice cursor, or coordinate input.

## Validation

Test screen-to-world round trips, exaggerated depth, local origins, multiple viewport sizes, high DPI, clipping, LOD fallback, missing values, and overlapping observation/volume primitives.
