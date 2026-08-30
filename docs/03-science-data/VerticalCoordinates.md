# Vertical Coordinates

**File:** `docs/03-science-data/VerticalCoordinates.md`  
**Status:** Normative

## Supported types

- Geometric depth.
- Height.
- Pressure.
- Fixed model level.
- Sigma coordinate.
- Hybrid coordinate.
- Terrain-following coordinate.
- Isopycnal coordinate.
- Provider-specific dimensionless coordinate with documented formula terms.

## Required metadata

Every vertical axis shall declare:

- Coordinate variable.
- Type.
- Units.
- Positive direction.
- Datum or reference surface.
- Bounds where available.
- Time dependence.
- Horizontal dependence.
- Formula terms for dimensionless coordinates.
- Cell-center or interface location.
- Monotonicity.
- Relationship to bathymetry and sea-surface height.

## Canonical depth

Where needed for visualization, physical depth is represented as meters positive downward. The source coordinate and conversion method remain preserved.

Conversion to depth may require:

- Latitude.
- Pressure.
- Sea-surface height.
- Bathymetry.
- Model coefficients.
- Time-dependent free surface.

## Pressure

Pressure is not interchangeable with depth. Pressure-to-depth conversion shall use a documented approved method and required latitude information.

## ROMS Terrain-Following S-Coordinate Transforms

ROMS vertical s-coordinates are computed from dimensionless stretching curves $C(s)$, bathymetry $h(x,y)$, free surface $\zeta(x,y,t)$, and stretching parameters ($\theta_s, \theta_b, h_c, N$).

- **Stretching Curves ($C(s)$):**
  - For $Vstretching = 1$ (Song and Haidvogel, 1994):
    $$C(s) = (1 - \theta_b) \frac{\sinh(\theta_s s)}{\sinh(\theta_s)} + \theta_b \left[ \frac{\tanh(\theta_s (s + 0.5))}{2 \tanh(0.5 \theta_s)} - 0.5 \right]$$
  - For $Vstretching = 4$ (Shchepetkin and O'Kane, 2005):
    $$C(s) = \frac{1 - \cosh(\theta_s s)}{\cosh(\theta_s) - 1} \quad \text{for } s \in [-1, 0]$$

- **Vertical Transformation Formulas:**
  - **ROMS Vtransform = 1:**
    $$z_0(x, y, s) = h_c s + (h(x, y) - h_c) C(s)$$
    $$z(x, y, s, t) = z_0 + \zeta(x, y, t) \left( 1 + \frac{z_0}{h(x, y)} \right)$$
  - **ROMS Vtransform = 2 (Shchepetkin 2005, recommended for steep topography):**
    $$z_0(x, y, s) = \frac{h_c s + h(x, y) C(s)}{h_c + h(x, y)}$$
    $$z(x, y, s, t) = \zeta(x, y, t) + (\zeta(x, y, t) + h(x, y)) z_0(x, y, s)$$

Canonical schema `schemas/canonical/roms_vertical_coordinate.json` and `schemas/canonical/vertical_coordinate.json` require validation of $h > 0$, $h_c \le \min(h)$, $\theta_s \ge 0$, and strict vertical monotonicity $z(k+1) > z(k)$.

## Pressure-to-Depth Transformation

Ocean pressure $P$ (dbar) is converted to depth $z$ (m) using the TEOS-10 GSW formulation `gsw.z_from_p(p, lat)` incorporating latitude-dependent gravitational acceleration $g(\phi)$. Simple hydrostatic approximation $z \approx -P$ is forbidden for canonical profile collocation.

- Coordinate lookup textures.
- Per-column depth metadata.
- Curvilinear geometry.

The selected strategy shall record interpolation and approximation errors.

## Vertical exaggeration

Vertical exaggeration affects display geometry only. Exact queries, profiles, exports, and statistics use true vertical coordinates.

## Validation

Verify:

- Positive direction.
- Units.
- Monotonicity per column.
- Surface and seabed consistency.
- Formula-term completeness.
- No invalid inversion.
- Pressure/depth reference values.
- Time dependence.
- Correct handling of dry or below-seabed cells.

Ambiguous vertical coordinates block scientific publication and volume-product generation.
