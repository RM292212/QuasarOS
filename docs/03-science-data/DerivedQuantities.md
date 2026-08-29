# Derived Quantities

**File:** `docs/03-science-data/DerivedQuantities.md`  
**Status:** Normative

## Policy

A derived quantity is never treated as a source measurement. Every derived product shall record inputs, units, algorithm, parameters, software version, validity rules, and uncertainty treatment.

## Initial approved quantities

### Horizontal current speed

    speed_horizontal = sqrt(u_east² + v_north²)

### Three-dimensional current speed

    speed_3d = sqrt(u_east² + v_north² + w_up²)

Use only components transformed into a common basis and compatible units.

### Current direction

Direction convention shall be declared explicitly:

- Direction toward which water moves.
- Degrees clockwise from true north.

### Model-observation residual

    residual = model - observation

### Bias

    bias = mean(model - observation)

### Mean absolute error

    MAE = mean(abs(model - observation))

### Root-mean-square error

    RMSE = sqrt(mean((model - observation)²))

Only valid collocated pairs contribute.

### Climatological anomaly

    anomaly = target - matched_climatology

The baseline version, compositing period, interpolation, and sign convention are mandatory metadata.

## TEOS-10 quantities

Density, Absolute Salinity, Conservative Temperature, sound speed, and related thermodynamic quantities shall use an approved GSW implementation.

Practical Salinity and Absolute Salinity shall remain distinct. Required longitude, latitude, pressure, and temperature definitions shall be validated before calculation.

## Future derived quantities

- Potential density.
- Brunt–Väisälä frequency.
- Stratification.
- Vertical gradients.
- Thermocline depth.
- Halocline depth.
- Mixed-layer diagnostics.
- Barrier-layer thickness.
- Apparent oxygen utilization.
- Oxygen saturation.

Each requires an approved specification and independent validation before publication.

## Derived-product identity

Identity includes:

- Input dataset versions.
- Input variables.
- QC policy.
- Spatial and temporal selection.
- Algorithm ID and version.
- Parameters.
- Software environment.
- Output units.
- Creation timestamp.

Changing any identity component creates a new product.
