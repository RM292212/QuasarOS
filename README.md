# QuasarOS

QuasarOS is a browser-native scientific visualization and analysis platform. Its first application, **QuasarOceanScope**, integrates three-dimensional numerical ocean-model output, in-situ observations, bathymetry, climatology, and derived oceanographic diagnostics in a single interactive environment.

QuasarOceanScope is intended to function as a genuine scientific tool rather than a visual demonstration. It preserves scientific coordinates, units, time semantics, quality-control information, uncertainty, provenance, and derivation history while providing GPU-accelerated 3D/4D visualization in standard web browsers.

## Project status

**Current target:** QuasarOceanScope V1  
**Primary renderer:** WebGPU through Babylon.js  
**Compatibility renderer:** WebGL 2 through Babylon.js  
**Geospatial overview:** CesiumJS in a separate synchronized workspace  
**Scientific backend:** Python, FastAPI, xarray, Dask, Zarr, NetCDF  
**Observation storage:** PostgreSQL/PostGIS and Parquet  
**Bulk data storage:** S3-compatible object storage, such as MinIO

## Core principles

1. Real scientific data are used for user-facing development and demonstrations.
2. NetCDF and provider products remain authoritative source data.
3. Optimized rendering products never replace authoritative scientific values.
4. Every displayed variable retains units, coordinates, source, version, time semantics, and provenance.
5. Different scientific topologies use appropriate renderers:
   - Scalar volumes use volume ray casting.
   - Vector volumes use particles, vectors, and streamlines.
   - Surface fields use georeferenced surfaces.
   - Bathymetry uses terrain geometry.
   - Profiles and trajectories use observation-specific primitives.
6. WebGPU is the primary GPU path.
7. WebGL 2 remains a complete 3D compatibility renderer, not a 2D fallback.
8. Display quantization must not affect exact scientific queries.
9. Derived quantities must identify their algorithm, inputs, parameters, and software version.
10. Performance claims must be supported by reproducible benchmarks.

## V1 objectives

QuasarOceanScope V1 shall provide:

- Browser-native 3D rendering of real temperature and salinity model fields.
- Visualization of ocean-current magnitude and direction.
- WebGPU volume ray casting with WebGL 2 parity.
- Progressive loading of multiresolution volume bricks.
- Geographic ROI selection through a Cesium overview.
- Bathymetry and ocean-domain clipping.
- Time-step selection and animation.
- Transfer-function, color, opacity, and value-range controls.
- Horizontal and vertical slicing.
- Isosurface extraction for supported scalar fields.
- Real Argo profile visualization.
- Model-versus-observation profile comparison.
- Exact-value inspection from canonical scientific data.
- Provenance, QC, units, and source metadata.
- Automated acquisition of a small, pinned, real-data bootstrap dataset.

## V1 non-goals

The following are not required for the initial V1 release:

- Running an ocean numerical model.
- Replacing INCOIS, Copernicus, Argo GDAC, ERDDAP, or OPeNDAP.
- Supporting every known ocean-grid topology.
- Supporting WebGL 1.
- Maintaining Babylon.js and Three.js as parallel production engines.
- Rendering every available ocean variable in the first release.
- Treating satellite surface products as full-depth volumes.
- Producing operational forecasts independently.
- Using generated or fictional data as operational observations.

## Application structure

QuasarOS contains two synchronized QuasarOceanScope workspaces:

### Ocean Overview

Powered by CesiumJS.

Responsibilities:

- Global and regional geographic context.
- Indian EEZ, Arabian Sea, and Bay of Bengal navigation.
- Dataset footprints.
- Observation locations and trajectories.
- Geographic ROI selection.
- Time and availability context.

### Scientific Volume Lab

Powered by Babylon.js.

Responsibilities:

- 3D and 4D scalar-volume rendering.
- WebGPU and WebGL 2 rendering.
- Slices, clipping, and isosurfaces.
- Current particles and vector glyphs.
- Argo and Glider profile visualization.
- Model-observation comparison.
- Quantitative inspection.

CesiumJS and Babylon.js use separate canvases and render loops. They exchange domain state through the application state layer. They must not attempt to share a GPU context or depth buffer.

## Scientific data layers

QuasarOceanScope distinguishes:

- Authoritative source data.
- Canonical analysis data.
- Visualization acceleration data.
- Observation indexes.
- Derived scientific products.
- Metadata and provenance.

The standard processing flow is:

```text
Authoritative NetCDF/observation source
        ↓
validation and normalization
        ↓
canonical xarray/Zarr representation
        ↓
multiresolution rendering products
        ↓
browser brick cache
        ↓
WebGPU or WebGL 2 renderer
```

Exact queries and exported scientific values must use canonical data. Rendering textures may use bounded quantization for performance.

## Repository documentation

Read documents in this order:

1. `AGENTS.md`
2. `docs/INDEX.md`
3. `docs/Plan.md`
4. `docs/Arc.md`
5. `docs/Tech.md`
6. `docs/DataModeling.md`
7. `docs/DataSources.md`
8. `docs/Implement.md`
9. `docs/Design.md`
10. `docs/Test.md`

## Development policy

Implementation must not begin by independently redefining architecture, schemas, or APIs. Proposed deviations require:

1. A written explanation.
2. Alternatives considered.
3. Effects on scientific correctness.
4. Effects on WebGPU and WebGL 2.
5. Migration implications.
6. Approval by the orchestrator or project maintainer.

## Data policy

User-visible development must start with real data obtained from approved authoritative sources. A small pinned bootstrap dataset must be used for local development and integration testing.

Synthetic data are allowed only in isolated mathematical unit tests where an analytical ground truth is required. Synthetic fixtures must:

- Be stored outside production data paths.
- Be marked as synthetic.
- Never appear in operational or outreach interfaces.
- Never be presented as observations or model output.
- Be excluded from production deployment artifacts where practical.

## Scientific disclaimer

QuasarOceanScope visualizations must not be treated as authoritative measurements unless the displayed source, units, time, QC, interpolation, and derivation have been verified. Rendering is an aid to scientific interpretation; exact values and operational decisions must use the corresponding authoritative data and documented analysis methods.

