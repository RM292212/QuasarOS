# Information Architecture

**File:** `docs/06-design/InformationArchitecture.md`  
**Status:** Normative

## Primary navigation

- Ocean Overview.
- Scientific Volume Lab.
- Data Catalog.
- Analysis Results.
- Documentation and Help.
- Administration when authorized.

## Workspace hierarchy

### Ocean Overview

- Geographic context.
- Dataset footprints.
- ROI.
- Observation discovery.
- Surface products.
- Entry into detailed volume analysis.

### Scientific Volume Lab

- 3-D volume.
- Bathymetry.
- Current fields.
- Observations.
- Slices and clipping.
- Exact inspection.
- Profile analysis.

## Panel hierarchy

### Left panel

- Dataset browser.
- Layer tree.
- Observation filters.
- Saved configurations.

### Right panel

- Inspector.
- Visualization properties.
- Transfer function.
- Clipping.
- Analysis.
- Provenance.

### Bottom region

- Timeline.
- Playback.
- Time availability.
- Processing and refinement status.

## Layer tree

Recommended order:

1. Analysis annotations.
2. Observations.
3. Vector fields.
4. Scalar volume and isosurfaces.
5. Surface fields.
6. Bathymetry.
7. Geographic context.

Layer order controls drawing and organization but does not imply scientific vertical order.

## Object naming

Use user-facing scientific names first. Provider IDs and source variable names appear in metadata details.

Examples:

- “Sea-water temperature”
- “Practical Salinity”
- “Eastward current”
- “Mixed-layer depth”
- “Argo profile”

## Deep links

Shareable state may contain:

- Dataset and variable IDs.
- Valid time.
- ROI.
- Workspace.
- Camera.
- Layer visibility.
- Transfer-function preset.
- Selected public observation.

Credentials, signed URLs, and private data shall not be embedded.

## Search

Global search may return datasets, variables, providers, observations, saved views, and documentation. Results shall show their type and access state.
