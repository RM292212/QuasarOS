# Dataset Browser

**File:** `docs/06-design/DatasetBrowser.md`  
**Status:** Normative

## Purpose

The Dataset Browser allows users to discover scientifically compatible data without requiring knowledge of provider-specific filenames.

## Hierarchy

    Provider
      → Product
      → Dataset or model run
      → Variable group
      → Variable
      → Time and depth availability

## Variable groups

- Physical Ocean.
- Biogeochemistry.
- Surface and Atmosphere.
- Observations.
- Bathymetry and Geography.
- Climatology.
- Derived Analysis.

## Search and filters

Support filtering by:

- Text.
- Provider.
- Product.
- Scientific role.
- Variable.
- Topology.
- Spatial coverage.
- Time coverage.
- Resolution.
- Observation platform.
- Access class.
- Publication state.

## Dataset card

Each result shows:

- Title.
- Provider.
- Product ID.
- Model or observation role.
- Spatial and temporal coverage.
- Resolution.
- Available variables.
- Last update.
- Access status.
- Validation status.

## Variable row

Display:

- Scientific display name.
- Source name on demand.
- Units.
- Topology icon.
- Depth availability.
- Time availability.
- Source or derived badge.
- Render modes.
- Availability reason if disabled.

Surface-only variables shall carry a visible surface badge.

## Selection flow

1. Select provider/product.
2. Select dataset or run.
3. Select variable.
4. Select valid time.
5. Select ROI or use current ROI.
6. Choose **Open in Overview** or **Open in Volume Lab**.

The browser estimates data size and warns when the requested region exceeds client or processing limits.

## Metadata drawer

Provides:

- Scientific definition.
- CF standard name.
- Grid.
- Vertical coordinate.
- Units.
- Time semantics.
- QC.
- Licence.
- Attribution.
- Provenance.
- Known limitations.

## States

Support loading, no results, unavailable source, restricted data, failed validation, processing, and published states. Unavailable data shall never appear silently selectable.
