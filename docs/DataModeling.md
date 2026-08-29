# QuasarOceanScope Scientific Data Model

## 1. Purpose

This document defines how QuasarOceanScope represents model fields, observations, coordinates, derived quantities, rendering products, quality, uncertainty, and provenance.

The data model must prevent visual convenience from changing scientific meaning.

## 2. Foundational distinction

Every asset has both:

### Scientific role

```text
model
observation
climatology
bathymetry
derived
rendering_acceleration
test_fixture
```

### Topology

```text
volume_scalar
volume_vector
surface_scalar
surface_vector
terrain
profile
trajectory
point_timeseries
mesh
mask
uncertainty
```

Scientific role and topology are independent.

For example:

- Model temperature: `model + volume_scalar`.
- Satellite chlorophyll: `observation + surface_scalar`.
- BGC-Argo chlorophyll: `observation + profile`.
- GEBCO: `bathymetry + terrain`.
- WOA oxygen: `climatology + volume_scalar`.

## 3. Dataset identity

Every dataset must have:

```text
dataset_id
title
description
provider
product_id
source_type
operational_status
version
processing_level
access_class
licence
citation
source_urls
spatial_extent
vertical_extent
time_extent
update_frequency
ingestion_version
```

Identifiers must remain stable across display-name changes.

## 4. Variable identity

Every variable must have:

```text
variable_id
source_variable_name
canonical_name
standard_name
long_name
symbol
source_units
canonical_units
display_units
data_type
topology
dimensions
coordinates
valid_range
missing_value
fill_value
scale_factor
add_offset
precision
```

Do not discard the source variable name.

## 5. Canonical variables

Initial canonical identifiers:

```text
sea_water_temperature
sea_water_potential_temperature
sea_water_conservative_temperature
sea_water_practical_salinity
sea_water_absolute_salinity
eastward_sea_water_velocity
northward_sea_water_velocity
upward_sea_water_velocity
sea_water_speed
sea_surface_height
mixed_layer_depth
sea_floor_depth
dissolved_oxygen
chlorophyll_a
nitrate
phosphate
silicate
sea_water_density
potential_density_anomaly
sound_speed
```

Different temperature or salinity definitions must not be collapsed without a documented conversion.

## 6. Dimensions and axes

Do not assume every field is ordered:

```text
time, depth, latitude, longitude
```

Represent dimensions explicitly.

Possible axes:

```text
T — time
Z — vertical
Y — horizontal/grid-y
X — horizontal/grid-x
N — unstructured node
F — unstructured face
P — profile
L — profile level
O — observation/sample
C — vector component
E — ensemble member
```

Source dimension order and canonical logical axis must both be retained.

## 7. Time model

Represent:

```text
reference_time
forecast_period
valid_time
observation_time
climatology_period
ingestion_time
processing_time
```

Relationship for forecasts:


\[
\text{valid time}=\text{reference time}+\text{forecast period}
\]

Time records must include:

- Calendar.
- timezone/UTC semantics.
- source encoding.
- resolution.
- bounds where provided.

Do not substitute ingestion time for observation or valid time.

## 8. Horizontal grids

Supported classifications:

```text
regular_lat_lon
projected_regular
curvilinear
rotated
staggered
unstructured
local_cartesian
```

Each grid must define:

- Coordinate variables.
- cell bounds where available.
- CRS/grid mapping.
- mask.
- orientation.
- periodicity.
- staggering.
- geographic extent.
- resolution description.

## 9. Vertical coordinates

Supported classifications:

```text
depth
height
pressure
z_level
sigma
hybrid_sigma
terrain_following
model_level
```

Every vertical coordinate must define:

- Positive direction.
- Units.
- datum/reference.
- formula terms.
- bounds.
- whether it varies horizontally.
- whether it varies with time.

A model level is not automatically equivalent to physical depth.

## 10. Vector fields

A vector field must record:

- Components.
- component grids.
- orientation.
- units.
- rotation required to geographic east/north/up.
- vertical sign convention.
- staggered-grid relation.

Current speed:


\[
|\vec{v}|=\sqrt{u^2+v^2+w^2}
\]

If vertical velocity is unavailable or intentionally excluded:


\[
|\vec{v}_h|=\sqrt{u^2+v^2}
\]

The UI must distinguish total and horizontal speed.

## 11. Observation model

### Platform

```text
platform_id
platform_type
provider
programme
institution
deployment
status
metadata_source
```

### Profile

```text
profile_id
platform_id
cycle_or_cast
direction
latitude
longitude
position_time
profile_time
data_mode
source_file
variables
qc_summary
```

### Measurement

```text
profile_id
level_index
pressure
depth
variable
raw_value
adjusted_value
raw_qc
adjusted_qc
uncertainty
units
```

Raw and adjusted values must not overwrite each other.

### Trajectory

```text
platform_id
sample_time
latitude
longitude
depth
position_qc
source
```

## 12. QC model

QC must preserve the source scheme.

A normalized QC category may be added:

```text
good
probably_good
suspect
bad
missing
not_evaluated
```

The normalized category must reference the original QC flag and mapping.

Default scientific comparison should use source-recommended acceptable adjusted values where available. The QC policy must be configurable and recorded.

## 13. Missing data

Distinguish:

- Missing.
- Fill value.
- Land.
- Below seabed.
- Outside model domain.
- Not observed.
- Rejected by QC.
- Not loaded.
- Not resident in GPU cache.

These states must not all map to numeric zero.

## 14. Uncertainty

Uncertainty may include:

- Measurement uncertainty.
- standard deviation.
- standard error.
- ensemble spread.
- interpolation error.
- quantization error.
- position uncertainty.
- temporal mismatch.
- horizontal mismatch.

The uncertainty type and units must be retained.

## 15. Derived quantities

Every derived product requires:

```text
derived_id
algorithm
algorithm_version
software
software_version
inputs
input_dataset_versions
parameters
units
validity_rules
processing_time
uncertainty_method
```

### Density and sound speed

Use TEOS-10-compatible processing.

Required distinctions include:

- Practical Salinity.
- Absolute Salinity.
- In-situ temperature.
- potential temperature.
- Conservative Temperature.
- pressure.

### Anomaly

An anomaly must declare:

- Reference dataset.
- climatology period.
- month/season matching.
- regridding method.
- depth matching.
- units.

### MLD

MLD must declare:

- Temperature or density criterion.
- threshold.
- reference depth.
- smoothing.
- interpolation.

### Thermocline/halocline

Declare:

- Gradient definition.
- smoothing.
- search interval.
- threshold/max-gradient rule.

### OMZ

Declare oxygen variable, units, and threshold.

### MHW/MCS

Declare baseline, percentile, seasonal cycle, duration, gap policy, and spatial/depth definition.

## 16. Rendering-product model

A rendering product must reference:

```text
render_product_id
canonical_dataset_id
canonical_variable_id
canonical_version
time
LOD scheme
brick shape
halo
texture format
network encoding
quantization scale
quantization offset
maximum error
mask encoding
occupancy encoding
generation software/version
```

Rendering products are disposable acceleration artifacts.

## 17. Brick model

A brick address includes:

```text
dataset
variable
time
LOD
brick_x
brick_y
brick_z
```

Brick metadata includes:

```text
logical_bounds
physical_bounds
geographic_bounds
depth_bounds
voxel_shape
halo
minimum
maximum
valid_count
occupancy_mask
checksum
byte_range_or_object_url
parent_brick
```

## 18. Precision model

Preferred modes:

```text
source/canonical:
provider precision, commonly float32 or float64

render default:
R16F or bounded 16-bit representation

preview:
optional R8 where approved

high precision:
R32F for selected regions
```

Every quantized representation must declare its maximum expected error.

Exact scientific queries must use canonical values.

## 19. Coordinate mapping to 3D

Scientific position:

```text
longitude
latitude
true depth or height
```

Rendering position:

```text
source/geographic coordinate
    ↓
validated coordinate transform
    ↓
ECEF/local ENU or local model frame
    ↓
floating origin
    ↓
visual vertical exaggeration
```

Vertical exaggeration must never modify stored depth.

## 20. Rendering eligibility

### Volume eligible

Only depth-resolved scalar fields:

- Temperature.
- salinity.
- model oxygen.
- model chlorophyll.
- nutrients.
- density.
- sound speed.
- current speed.
- valid derived volumes.

### Surface only

- SSH.
- MLD.
- satellite chlorophyll.
- SST.
- wave height.
- wind.
- HF-radar currents.

### Terrain

- Bathymetry.

### Profile/trajectory

- Argo.
- Glider.
- CTD.
- XBT/XCTD.
- ADCP.
- mooring profiles.

Sparse observations must not be shown as a continuous volume unless a separate documented analysis/interpolation product has been created.

## 21. Provenance

Every transformation creates a lineage record:

```text
source assets
source checksums
processing operation
parameters
software version
operator/job identity
start/end time
output assets
validation status
```

The UI must make provider, product, time, variable, units, processing level, and derivation discoverable.

## 22. Fixture classification

Synthetic fixtures must use:

```text
source_type: test_fixture
operational_status: synthetic
```

Production registries must reject fixtures unless explicitly running in a test environment.

