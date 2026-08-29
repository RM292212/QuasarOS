# Cesium Overview Design

**File:** `docs/06-design/CesiumOverviewDesign.md`  
**Status:** Normative

## Purpose

Ocean Overview provides geographic discovery and context. It shall not duplicate the Scientific Volume Lab’s detailed volume rendering.

## Main scene

Display:

- Globe or regional map.
- Coastlines and boundaries.
- Bathymetric context where appropriate.
- Dataset footprints.
- Model-domain outlines.
- Observation locations and trajectories.
- User ROI.
- Selected volume-lab target.

## Dataset footprints

Footprints shall show:

- Available spatial coverage.
- Selected or hovered state.
- Provider/product label.
- Temporal availability.
- Resolution summary.
- Access restrictions.

Overlapping footprints use controlled opacity and selection emphasis.

## ROI interaction

Users may:

- Draw a rectangle.
- Enter coordinate bounds.
- Move or resize the ROI.
- Reset to dataset extent.
- Fit the camera to ROI.
- Send ROI to Volume Lab.

The UI displays width, height, coordinate bounds, estimated data size, and validation warnings.

## Observation display

Observation markers support:

- Platform-specific symbols.
- Spatial clustering.
- Time-window filtering.
- Selection highlight.
- Trajectory display.
- QC or data-mode indicators.
- Direct opening in Observation Explorer.

Selected observations remain visible when clustering changes.

## Camera synchronization

The overview synchronizes geographic target and ROI with Volume Lab. It shall not attempt exact camera matching because globe and local-volume projections differ.

## Controls

- Home/global view.
- Fit dataset.
- Fit ROI.
- Base-map selector.
- Footprint visibility.
- Observation visibility.
- Bathymetry context.
- Coordinate readout.
- 2-D/3-D Cesium scene mode only if supported by product policy.

## Scientific communication

Surface products such as SSH or satellite chlorophyll may appear on the globe as raster or tiled layers. Depth-resolved variables shall be represented by footprints or entry points, not false surface-only summaries unless clearly labelled.

## Performance

Use clustering, level-of-detail geometry, bounded observation queries, and layer limits. Cesium resources shall be disposed when the workspace is destroyed.
