# Empty-Space Skipping

**File:** `docs/04-rendering/EmptySpaceSkipping.md`  
**Status:** Normative

## Purpose

Empty-space skipping avoids sampling regions that cannot contribute opacity under the current transfer function.

## Empty-space hierarchy

1. Domain and ROI intersection.
2. Land, seabed, and permanent validity mask.
3. Coarse occupancy hierarchy.
4. Brick residency and validity.
5. Transfer-function-aware brick visibility.
6. Optional local interval or distance skipping.

## Brick metadata

Each brick shall provide:

- Minimum and maximum scalar.
- Valid voxel count.
- Optional histogram.
- Optional binned occupancy bitmask.
- Bounds in normalized volume space.

## Transfer-function visibility

The transfer function generates a visibility mask over scalar bins. A brick is invisible when:

- It has no valid voxels, or
- Its occupied scalar bins do not intersect visible transfer-function bins.

Min/max alone may be used only when opacity is monotonic over the interval or conservatively evaluated.

## Traversal

Use brick-level 3-D DDA or equivalent ordered traversal. Invisible or unavailable segments advance to the next brick boundary rather than repeatedly sampling within the segment.

## Hierarchy

A shallow octree, wide hierarchy, or coarse occupancy texture may skip groups of bricks. The hierarchy shall remain conservative: visible content may not be incorrectly classified as empty.

## SDF usage

Signed distance fields may accelerate coastline, seabed, or clipping-boundary traversal. They are not the default representation for dense temperature or salinity fields.

## Updates

Transfer-function changes update visibility metadata without rebuilding scalar bricks. Time or variable changes use the corresponding occupancy metadata.

## Validation

Test:

- Narrow visible scalar intervals.
- Non-monotonic opacity curves.
- Thin features.
- Entirely invalid bricks.
- Mixed valid and invalid bricks.
- Land and seabed boundaries.
- Hierarchical parent/child consistency.

False-empty classification is a release-blocking rendering defect.
