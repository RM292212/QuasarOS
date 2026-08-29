# QuasarOceanScope Data Sources

## 1. Purpose

This document defines approved real-data sources for QuasarOceanScope V1 and the rules for acquiring, validating, storing, and presenting them.

No agent may replace an authoritative source with generated values for user-facing functionality.

## 2. Source priority

For an INCOIS-oriented deployment:

1. Authorized INCOIS operational products.
2. Argo GDAC and approved national Argo services.
3. Copernicus Marine.
4. HYCOM.
5. NOAA climatology products.
6. GEBCO bathymetry.
7. Other approved institutional sources.

A lower-priority source may be used for public bootstrap development when higher-priority data require restricted access.

## 3. INCOIS

Official holdings:

- https://incois.gov.in/site/dataholdings.jsp
- https://erddap.incois.gov.in/erddap/

Relevant categories may include:

- Argo temperature and salinity profiles.
- drifting buoys.
- moored buoys.
- HF radar.
- coastal ADCP.
- XBT/XCTD.
- ROMS products.
- satellite products.
- wave and sea-state products.
- tide gauges.

Requirements:

- Record the precise INCOIS dataset/service identifier.
- Respect visualization-only, registered, restricted, and download policies.
- Do not automate scraping of visualization-only services.
- Use authenticated institutional feeds only with authorization.
- Preserve INCOIS attribution and metadata.
- Treat access availability as dataset-specific.

## 4. Copernicus Marine physical model

Primary public bootstrap candidate:

```text
GLOBAL_ANALYSISFORECAST_PHY_001_024
```

Official product page:

- https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_PHY_001_024/description

Relevant fields include, depending on the selected dataset within the product:

- Temperature.
- salinity.
- eastward current.
- northward current.
- upward velocity.
- sea-surface height.
- mixed-layer thickness.
- surface fields.
- ice-related fields.
- special surface-current products.

Requirements:

- Discover exact dataset IDs through the current Copernicus catalog/toolbox.
- Do not assume every variable has the same temporal resolution.
- Do not assume every variable is full-depth.
- Record product and dataset identifiers separately.
- Record model run/reference time and valid time.
- Use Copernicus authentication and licences correctly.
- Pin the bootstrap selection by product, dataset, ROI, time, depth, and variables.

Recommended bootstrap variables:

```text
temperature
salinity
eastward current
northward current
sea-surface height
mixed-layer thickness
```

Recommended bootstrap region:

- A bounded Indian Ocean, Arabian Sea, or Bay of Bengal ROI small enough for repeatable development.
- The exact bounds must be frozen in the bootstrap manifest.

## 5. Argo

International authoritative access:

- https://argo.ucsd.edu/data/data-from-gdacs/
- https://www.seanoe.org/data/00311/42182/
- Argo GDAC services and official index files

National access may include:

- INCOIS Argo holdings.
- INCOIS ERDDAP dataset services.

Acquire:

- Profile files.
- trajectory data where needed.
- metadata.
- index information.
- adjusted and raw variables.
- QC flags.
- data mode.
- cycle and direction.

Minimum V1 variables:

```text
PRES
TEMP
PSAL
adjusted forms where available
associated QC fields
```

Rules:

- Prefer adjusted values according to the selected QC policy.
- Preserve raw values.
- Preserve QC.
- Preserve WMO ID, cycle, direction, position, and time.
- Do not assume every profile contains salinity.
- Do not convert pressure to depth without documenting method and latitude.

## 6. BGC-Argo

Official information:

- https://biogeochemical-argo.org/
- Official Argo GDAC BGC files

Potential variables:

- Oxygen.
- nitrate.
- pH.
- chlorophyll-a.
- suspended particles.
- irradiance.

BGC-Argo is not mandatory for the first vertical slice but is an approved extension.

BGC measurements remain profiles. They are not full continuous volumes unless a separate derived interpolation product is generated.

## 7. GEBCO bathymetry

Official current data page:

- https://www.gebco.net/data-products/gridded-bathymetry-data

Use:

- Current GEBCO grid.
- Current matching TID grid where practical.
- NetCDF or another approved source representation.
- User-defined regional download for bootstrap data.

Retain:

- Grid release/version.
- elevation/depth units.
- resolution.
- TID/source type.
- attribution.
- vertical-datum caveats.

GEBCO is rendered as terrain, not a scalar water-column volume.

## 8. NOAA World Ocean Atlas

Official source:

- https://www.ncei.noaa.gov/products/world-ocean-atlas

WOA23 includes:

- Temperature.
- salinity.
- dissolved oxygen.
- apparent oxygen utilization.
- oxygen saturation.
- nitrate.
- phosphate.
- silicate.
- statistical and objectively analysed fields.

Use WOA as:

- Climatology.
- anomaly baseline.
- broad scientific context.
- reference/validation aid.

Do not present WOA as:

- Real-time observation.
- current operational forecast.
- exact local measurement.

Anomalies must match the appropriate climatological month/season and depth.

## 9. HYCOM

Official source:

- https://www.hycom.org/dataserver

Use as:

- Secondary physical-model source.
- comparison source.
- fallback development source where approved.

Retain:

- Experiment identifier.
- analysis/forecast status.
- grid.
- reference/valid time.
- variables.
- vertical coordinates.
- licence/attribution.

Do not merge HYCOM and Copernicus fields without explicitly identifying the source of every layer.

## 10. Copernicus Ocean Colour

Official catalog:

- https://data.marine.copernicus.eu/

Potential surface fields:

- Chlorophyll-a.
- chlorophyll gradient.
- suspended particulate matter.
- diffuse attenuation.
- Secchi depth.
- optical properties.

These are normally surface satellite products.

They must be represented as surface fields unless the selected product explicitly contains a physical vertical dimension.

Do not interpret a variable named `ZSD` as a dataset depth coordinate. It commonly represents Secchi depth.

## 11. Glider data

Glider data must come from an approved institutional source, GDAC-compatible source, or ERDDAP service.

Retain:

- Platform and mission ID.
- trajectory.
- timestamp.
- latitude/longitude.
- depth/pressure.
- temperature.
- salinity.
- BGC variables where present.
- QC.
- processing level.
- provider.
- source-file identity.

Gliders are represented as trajectories, profiles, and vertical curtains.

## 12. Other approved observations

Future adapters may support:

- CTD.
- XBT/XCTD.
- ADCP.
- HF radar.
- drifting buoys.
- moored buoys.
- tide gauges.
- tsunami buoys.
- satellite SST.
- wave products.

Each source requires a registry entry before production use.

## 13. Bootstrap dataset requirements

The V1 bootstrap manifest must specify:

```text
manifest version
source/provider
product
dataset
variables
ROI bounds
time range
depth range
expected coordinate names
expected units
expected dimensions
acquisition method
authentication requirement
licence
destination
validation checks
known source limitations
```

The bootstrap should be small enough for development while containing:

- Multiple depths.
- Multiple time steps.
- Land or seabed masks.
- Temperature.
- salinity.
- U/V currents.
- At least one real Argo profile within or near the ROI.
- Bathymetry.
- A climatology subset if anomaly work is enabled.

## 14. Acquisition rules

Acquisition must:

- Use provider-supported clients or protocols.
- identify the application appropriately where required.
- respect rate limits.
- support retries with backoff.
- support resumption where possible.
- validate downloaded content.
- avoid repeated downloads when the correct version exists.
- record acquisition metadata.
- never commit credentials.
- never bypass provider access controls.

## 15. Source registry

Every source entry must include:

```text
source_id
provider
official_url
service_type
access_class
authentication
licence
citation
variables
spatial_coverage
vertical_coverage
time_coverage
update_frequency
format
adapter
status
last_verified
```

## 16. Integrity and versioning

Where stable checksums are available, verify them.

Where source files are generated dynamically:

- Record request parameters.
- record response headers.
- calculate a local checksum.
- record acquisition time.
- record provider product metadata.
- retain immutable acquired copies where policy permits.

## 17. Real-data enforcement

User-facing layers must have:

```text
source_type != test_fixture
```

The application must reject test fixtures in production configuration.

Screenshots, demonstrations, and outreach material must identify their real provider and valid time.

## 18. Licensing and attribution

Every dataset must record:

- Licence.
- required attribution.
- redistribution restrictions.
- access restrictions.
- citation.
- expiry or token requirements.

Public availability does not automatically imply unrestricted redistribution.

## 19. Source-change handling

Provider products may change:

- Dataset identifiers.
- variable names.
- endpoints.
- dimensions.
- calendars.
- metadata.
- authentication.

Adapters must fail clearly when an expected contract changes. They must not silently reinterpret incompatible source data.

