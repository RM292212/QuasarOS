# Operational Mode Design

**File:** `docs/06-design/OperationalModeDesign.md`  
**Status:** Normative

## Audience

Researchers, operational analysts, data engineers, and authorized technical users.

## Design priorities

- Dense scientific context.
- Exact time semantics.
- Fast dataset switching.
- Visible data freshness.
- Full rendering controls.
- QC and uncertainty.
- Model-observation comparison.
- Diagnostics and reproducibility.

## Default shell

Operational Mode uses the full four-region layout:

- Dataset/layer panel.
- Main workspace.
- Inspector/analysis panel.
- Timeline.

Panels are resizable and collapsible.

## Persistent scientific header

Display:

- Provider.
- Product.
- Dataset/run.
- Variable and units.
- Valid time.
- Model reference and lead where applicable.
- Renderer.
- LOD/refinement.
- Data freshness.
- Source/derived status.

## Control density

Advanced controls use grouped accordions:

- Scalar styling.
- Volume quality.
- Slices and clipping.
- Bathymetry.
- Currents.
- Observations.
- Analysis.
- Diagnostics.

Frequently used controls remain visible; rarely used controls use progressive disclosure.

## Warnings

Persistent warnings are required for:

- Stale data.
- Coarse-only view.
- Failed bricks.
- Non-default QC.
- Regridded product.
- Derived quantity.
- Large collocation separation.
- Vertical exaggeration.
- Approximate display values.

## Analysis workflow

Operational Mode places profile charts, residuals, metrics, collocation metadata, and provenance in the right analysis panel. Results remain linked to the selected scene and observation.

## Performance behavior

During interaction, the viewport may reduce resolution and sampling. A visible quality badge changes to `Interactive`; after settling it returns to `Balanced` or `Reference`.

## Restrictions

Operational Mode shall not imply official forecast authority unless the deployment has been specifically certified and labelled.
