# Product Requirements

**Document:** `docs/01-product/ProductRequirements.md`  
**Product:** QuasarOS  
**Application:** QuasarOceanScope  
**Status:** Normative  
**Target release:** V1

## 1. Product definition

QuasarOS is a modular scientific visualization platform. Its first application, **QuasarOceanScope**, is a browser-native environment for exploring, rendering, comparing, and analyzing three-dimensional and time-varying ocean data.

QuasarOceanScope shall combine:

- Numerical ocean-model outputs.
- In-situ observations.
- Bathymetry and geographic context.
- Climatological references.
- Derived scientific quantities.
- Scientific metadata, quality-control information, uncertainty, and provenance.

The product shall provide:

1. A geographic overview workspace powered by CesiumJS.
2. A scientific 3-D volume workspace powered by Babylon.js.
3. WebGPU as the primary renderer.
4. A fully 3-D WebGL 2.0 fallback.
5. Progressive, out-of-core loading for datasets larger than browser memory.
6. Exact scientific inspection backed by canonical data rather than quantized rendering textures.
7. Reproducible model-observation comparison.

## 2. Product mission

Enable ocean scientists, operational analysts, students, and public users to understand complex ocean structures through scientifically faithful, interactive 3-D and 4-D visualization without requiring a desktop visualization package.

## 3. Product principles

### PR-P01 — Scientific correctness first

Scientific meaning, units, coordinate systems, quality flags, time semantics, and provenance take precedence over visual appearance.

### PR-P02 — Separate data responsibilities

The platform shall distinguish:

1. **Authoritative source data** received from a provider.
2. **Canonical scientific data** normalized for analysis without losing meaning.
3. **Rendering products** optimized for GPU use.
4. **Derived products** calculated from declared algorithms and inputs.

Rendering products shall never silently replace canonical values in scientific inspection or exported analysis.

### PR-P03 — Topology-aware visualization

A field shall be rendered according to its actual topology:

- Volume scalars as volumes, slices, or isosurfaces.
- Vector volumes as glyphs, particles, streamlines, or magnitude fields.
- Surface fields as geographic surfaces.
- Bathymetry as terrain or a seabed mesh.
- Profiles as vertical profiles or profile curtains.
- Trajectories as time-aware paths.
- Point observations as markers and charts.

A surface-only product shall not be presented as a full-depth volume.

### PR-P04 — Progressive operation

The application shall display a useful coarse result before complete high-resolution data are available. Missing high-resolution bricks shall fall back to a lower-resolution representation where possible.

### PR-P05 — Backend parity

WebGPU and WebGL 2.0 shall expose the same essential scientific workflow. The fallback may reduce visual quality, resolution, particle count, or sampling rate, but shall remain interactive and fully 3-D.

### PR-P06 — Reproducibility

Every scientific result shall be traceable to:

- Provider and product identifier.
- Dataset and variable identifiers.
- Source version or retrieval timestamp.
- Valid time and model reference time, where applicable.
- Region and depth selection.
- Quality-control policy.
- Transformation or derivation algorithm.
- Algorithm and software version.
- Relevant visualization settings.

### PR-P07 — Bounded resource use

Browser CPU memory, GPU memory, network activity, and worker activity shall be controlled by explicit budgets. Dataset size shall not determine unbounded browser memory consumption.

### PR-P08 — Real-data foundation

Product demonstrations, acceptance scenarios, and scientific validation shall use pinned subsets of real ocean data. Synthetic fields may be used only for isolated analytical renderer and mathematics tests.

### PR-P09 — Extensibility

New data providers, variables, derived quantities, observation platforms, and visualization layers shall be added through documented contracts rather than modifications to unrelated modules.

### PR-P10 — Honest uncertainty

Approximate rendered values, exact canonical values, missing data, rejected observations, low-resolution fallback, uncertainty, and unavailable data shall be distinguishable in the interface.

## 4. Product goals

The V1 product shall enable users to:

1. Discover available datasets and variables.
2. Select a geographic region and time.
3. Render temperature and salinity as interactive 3-D volumes.
4. visualize model currents as vectors or particles.
5. Display SSH, mixed-layer depth, bathymetry, and other surface layers appropriately.
6. Apply transfer functions, clipping planes, depth limits, and slices.
7. Animate model time steps.
8. Discover and display Argo observations.
9. Inspect Argo profiles and associated QC flags.
10. Collocate model values with observations.
11. Calculate and display comparison statistics.
12. Inspect exact canonical values at selected locations.
13. Export a reproducibility record for a view or analysis.
14. Continue using a fully 3-D experience when WebGPU is unavailable but WebGL 2.0 is supported.

## 5. Target data categories

### 5.1 Directly rendered model data

- Sea-water temperature.
- Sea-water salinity.
- Eastward, northward, and vertical current components where available.
- Current speed derived from vector components.
- Sea-surface height.
- Mixed-layer depth or thickness.
- Bathymetry.
- Dissolved oxygen and chlorophyll-a where depth-resolved products are available.

### 5.2 Observation overlays

- Argo profiles and trajectories.
- BGC-Argo profiles where available.
- Glider profiles and trajectories in later V1 increments if source access is available.
- Platform metadata, timestamps, variables, QC flags, and uncertainty.

### 5.3 Derived analysis

- Current speed and direction.
- Density and other TEOS-10 quantities.
- Model-observation residuals.
- Bias, mean absolute error, and RMSE.
- Climatological anomaly when a compatible reference is available.
- Vertical gradients and stratification metrics after scientific validation.

### 5.4 Metadata retained but not necessarily rendered

- Source and normalized QC flags.
- Uncertainty.
- Grid topology.
- Coordinate reference system.
- Vertical datum and positive direction.
- Fill-value meaning.
- Processing history.
- Licensing and attribution.
- Retrieval timestamps and checksums.

## 6. Primary product workspaces

### 6.1 Ocean Overview

The Ocean Overview shall provide:

- Global and regional geographic context.
- Dataset footprints.
- Model-domain boundaries.
- Observation positions and trajectories.
- Region-of-interest creation.
- Time-aware layer discovery.
- Selection synchronization with the Scientific Volume Lab.

### 6.2 Scientific Volume Lab

The Scientific Volume Lab shall provide:

- Scalar volume ray casting.
- Slices and clipping.
- Bathymetry and geographic reference geometry.
- Vector-field visualization.
- Observation overlays.
- Profile charts.
- Exact-value inspection.
- Model-observation comparison.
- Time animation.
- Progressive-resolution status.
- Renderer and resource diagnostics.

CesiumJS and Babylon.js shall use separate rendering contexts. They shall synchronize domain state, not engine or GPU objects.

## 7. Product boundaries

### Included in V1

- One pinned real model dataset and region.
- Temperature, salinity, currents, SSH, and mixed-layer depth where available.
- GEBCO bathymetry.
- Argo profile integration.
- WOA climatological comparison where compatible.
- WebGPU and WebGL 2.0 rendering.
- Progressive multiresolution volume delivery.
- Exact inspection and profile extraction.
- Basic model-observation collocation.
- Reproducibility export.

### Excluded from V1

- Running an ocean circulation model.
- Producing independent operational forecasts.
- Replacing provider archives or scientific repositories.
- Supporting every unstructured or terrain-following grid.
- WebGL 1 support.
- Native desktop or mobile applications.
- Collaborative editing.
- Full acoustic propagation simulation.
- Machine-learning forecasting.
- Multi-user real-time synchronization.
- Unrestricted arbitrary code execution.
- Treating satellite ocean-colour data as full-depth volumes.

## 8. Product success indicators

V1 is successful when:

- A first-time user can acquire the documented bootstrap dataset and launch the stack using the published workflow.
- A supported browser displays a coarse temperature volume before full-resolution loading completes.
- WebGPU and WebGL 2.0 complete the same essential scientific journey.
- Exact inspection values match canonical source-derived values within declared numerical tolerances.
- Argo profiles can be selected and compared with collocated model profiles.
- Missing, masked, and QC-rejected values are not displayed as valid measurements.
- The application remains within configured CPU and GPU memory budgets.
- A user can export sufficient metadata to reproduce a view and comparison.
- Required accessibility and release gates pass.

## 9. Scientific disclaimer

QuasarOceanScope is a scientific visualization and analysis environment. Visual interpretation depends on the selected dataset, processing level, transfer function, interpolation method, resolution, and quality-control policy. Unless separately certified by an authorized organization, the product shall not claim to provide official navigation, safety-of-life, emergency, or operational forecast guidance.

