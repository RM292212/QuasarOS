# Observation Model

**File:** `docs/03-science-data/ObservationModel.md`  
**Status:** Normative

## Entities & Canonical Schemas

The observation subsystem models in-situ ocean instruments with strict QC and provenance preservation:

- **Vertical Profiles (`schemas/canonical/observation_profile.json`):**
  - Continuous vertical sounding (Argo floats, CTD casts, XBTs, Glider profiles).
  - Preserves cycle number, direction (Ascending/Descending), data mode (`R` Real-Time, `A` Adjusted, `D` Delayed-Mode).
  - Depth/Pressure monotonically ordered series with companion measurement QC vectors.
- **Platform Trajectories (`schemas/canonical/observation_trajectory.json`):**
  - Lagrangian surface drifters, ship tracks, autonomous glider surfacing paths.
  - Ordered coordinate series $(lon, lat, time, z)$ with platform speed and heading.
- **Point Time Series (`schemas/canonical/observation_timeseries.json`):**
  - Moored buoys (e.g. INCOIS RAMA, NOAA TAO/TRITON), coastal tide gauges, HF-radar current nodes.
- **Directional Wave Spectra (`schemas/canonical/directional_wave_spectrum.json`):**
  - 2D frequency-direction variance density $E(f, \theta)$ in $m^2 / (\text{Hz} \cdot \text{rad})$.
  - Preserves Fourier directional expansion coefficients ($a_1, b_1, a_2, b_2$), peak wave period ($T_p$), mean wave direction ($\theta_m$), and significant wave height ($H_{m0} = 4 \sqrt{m_0}$).

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
