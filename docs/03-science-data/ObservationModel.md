# Observation Model

**File:** `docs/03-science-data/ObservationModel.md`  
**Status:** Normative

## Entities

### Platform

Represents an instrument-bearing system:

- Argo float.
- BGC-Argo float.
- Glider.
- Drifter.
- Mooring.
- Buoy.
- Ship.
- CTD/XBT/XCTD cast.
- ADCP.
- HF-radar station or network.

### Deployment

Connects a platform to a mission, owner, deployment time, recovery state, and instrument configuration.

### Profile

A vertical sequence of measurements with profile time, location, cycle, direction, data mode, and vertical coordinate.

### Trajectory

Time-ordered platform positions with optional depth and mission state.

### Time series

Measurements associated with a fixed or moving platform over time.

### Measurement

Required fields:

- Observation ID.
- Variable registry ID.
- Source variable.
- Value.
- Source and canonical units.
- Time.
- Horizontal position.
- Vertical coordinate.
- Source QC flag.
- Normalized QC category.
- Uncertainty where available.
- Adjustment state.
- Provenance ID.

## Argo requirements

Preserve where present:

- Platform number.
- Cycle number.
- Direction.
- Data mode.
- Latitude and longitude.
- JULD/time.
- PRES, TEMP, PSAL.
- Adjusted values.
- Error estimates.
- Per-variable QC.
- Profile QC.
- Calibration metadata.
- Data-center and processing history.

Adjusted and raw values shall not be merged silently.

## Storage

- Searchable metadata: PostgreSQL/PostGIS.
- Bulk measurements: Parquet.
- Browser delivery: Arrow IPC or bounded JSON.
- Original NetCDF: authoritative source storage when permitted.

## Identity

Observation identity shall be stable and include provider, platform, deployment, profile/cycle, measurement level, and source version.

## Rendering

- Platforms: points or symbols.
- Trajectories: time-aware lines.
- Profiles: vertical lines, curtains, or charts.
- Measurements: selectable points or chart samples.

Observation profiles shall not be converted into continuous 3-D volumes unless explicitly published as a separate derived product.
