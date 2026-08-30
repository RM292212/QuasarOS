"""
QuasarOS Canonical Unit & Thermodynamic Safeguards Contract

Defines canonical unit representations, physical dimensions, conversion classifications,
and strict safeguards against silent salinity, temperature, and depth conversions.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PhysicalDimension(str, Enum):
    """Authoritative physical dimensions in oceanography."""
    temperature = "temperature"
    practical_salinity = "practical_salinity"
    absolute_salinity = "absolute_salinity"
    velocity = "velocity"
    speed = "speed"
    length = "length"
    depth = "depth"
    pressure = "pressure"
    angle_degrees = "angle_degrees"
    time = "time"
    density = "density"
    mass_concentration = "mass_concentration"
    molar_concentration = "molar_concentration"
    dimensionless = "dimensionless"
    frequency = "frequency"
    wave_period = "wave_period"
    area_per_second = "area_per_second"


class UnitConversionClassification(str, Enum):
    r"""
    Mathematical classification of unit conversions.
    - identity: Exact 1:1 match (e.g. 'm s-1' to 'm/s', 'degree_Celsius' to 'degrees_C')
    - linear: Simple scale factor $y = c \cdot x$ (e.g. 'm' to 'km', 'seconds' to 'hours')
    - affine: Scale and offset $y = c \cdot x + b$ (e.g. 'degree_Celsius' to 'kelvin')
    - context_dependent: Requires geospatial/thermodynamic context (e.g. TEOS-10 SA from SP, depth from pressure)
    - not_convertible: Incompatible physical dimensions (e.g. 'm' to 'degree_Celsius')
    - unknown: Unregistered or unverified unit conversion
    """
    identity = "identity"
    linear = "linear"
    affine = "affine"
    context_dependent = "context_dependent"
    not_convertible = "not_convertible"
    unknown = "unknown"


class CanonicalUnitContract(BaseModel):
    """Authoritative unit contract for a canonical variable."""
    unit_string: str = Field(
        ...,
        description="Standard canonical unit string (e.g. 'degree_Celsius', 'm s-1', 'dbar', '1e-3')."
    )
    cf_unit: str = Field(
        ...,
        description="CF-compliant standard unit representation (e.g. 'degrees_C', 'm s-1', 'decibar', '1')."
    )
    physical_dimension: PhysicalDimension = Field(
        ...,
        description="Physical dimension of the variable."
    )
    conversion_classification: UnitConversionClassification = Field(
        default=UnitConversionClassification.identity,
        description="Conversion class relative to raw provider unit."
    )
    safeguard_notes: Optional[str] = Field(
        default=None,
        description="Scientific advisory regarding conversion limits (e.g. TEOS-10 requirements)."
    )


class UnitConversionResult(BaseModel):
    """Detailed validation output when checking a proposed unit conversion."""
    source_unit: str
    target_unit: str
    classification: UnitConversionClassification
    conversion_allowed: bool
    requires_teos10: bool = False
    requires_geolocation: bool = False
    explanation: str


def classify_unit_conversion(
    source_unit: str,
    target_unit: str,
    source_quantity: Optional[str] = None,
    target_quantity: Optional[str] = None,
) -> UnitConversionResult:
    """
    Strictly validates and classifies unit conversions across scientific domains.
    Enforces safeguards against silent thermodynamic conversions.
    """
    s_u = source_unit.strip().lower()
    t_u = target_unit.strip().lower()
    s_q = (source_quantity or "").strip().lower()
    t_q = (target_quantity or "").strip().lower()

    # Identity equivalents
    temp_units = {"degree_celsius", "degrees_c", "degc", "celsius", "c"}
    sal_prac_units = {"1e-3", "1", "psu", "practical_salinity_unit", "dimensionless", ""}
    pressure_units = {"dbar", "decibar", "decibars", "db"}
    depth_units = {"m", "meter", "meters", "metre", "metres"}
    velocity_units = {"m s-1", "m/s", "meter per second", "meters/second"}
    wave_height_units = {"m", "meter", "meters"}
    wave_period_units = {"s", "sec", "second", "seconds"}
    wave_dir_units = {"degree", "degrees", "deg", "degree_true", "degrees_true"}

    # 1. Cross-temperature quantity conversions (Potential vs In-Situ vs Conservative)
    if ("conservative" in s_q and "potential" in t_q) or ("potential" in s_q and "conservative" in t_q):
        return UnitConversionResult(
            source_unit=source_unit,
            target_unit=target_unit,
            classification=UnitConversionClassification.context_dependent,
            conversion_allowed=False,
            requires_teos10=True,
            explanation="Silent conversion between Conservative Temperature and Potential Temperature is prohibited. Requires TEOS-10."
        )

    # 2. Salinity conversions: Practical Salinity (dimensionless/PSU) vs Absolute Salinity (g/kg)
    is_source_psu = s_u in sal_prac_units or "practical" in s_q
    is_target_abs = t_u in {"g/kg", "g kg-1", "g/kg-1"} or "absolute" in t_q
    if is_source_psu and is_target_abs:
        return UnitConversionResult(
            source_unit=source_unit,
            target_unit=target_unit,
            classification=UnitConversionClassification.context_dependent,
            conversion_allowed=False,
            requires_teos10=True,
            requires_geolocation=True,
            explanation=(
                "Silent conversion between Practical Salinity (unitless/PSU) and Absolute Salinity (g/kg) "
                "is strictly prohibited. Requires TEOS-10 gsw.SA_from_SP(SP, p, lon, lat) with geographic position and pressure."
            )
        )

    # 3. Pressure to Depth conversion (dbar to meters)
    if (s_u in pressure_units and t_u in depth_units) or (s_u in depth_units and t_u in pressure_units):
        return UnitConversionResult(
            source_unit=source_unit,
            target_unit=target_unit,
            classification=UnitConversionClassification.context_dependent,
            conversion_allowed=False,
            requires_teos10=True,
            requires_geolocation=True,
            explanation=(
                "Direct 1:1 conversion between pressure (dbar) and depth (m) is physically inaccurate. "
                "Requires UNESCO / TEOS-10 depth_from_z(z, lat) formulation."
            )
        )

    # 4. Exact string match
    if s_u == t_u:
        return UnitConversionResult(
            source_unit=source_unit,
            target_unit=target_unit,
            classification=UnitConversionClassification.identity,
            conversion_allowed=True,
            explanation="Exact unit match."
        )

    # 5. Temperature identities
    if s_u in temp_units and t_u in temp_units:
        return UnitConversionResult(
            source_unit=source_unit,
            target_unit=target_unit,
            classification=UnitConversionClassification.identity,
            conversion_allowed=True,
            explanation="Direct equivalent Celsius representations."
        )

    # 6. Celsius to Kelvin (Affine)
    if (s_u in temp_units and t_u in {"k", "kelvin"}) or (s_u in {"k", "kelvin"} and t_u in temp_units):
        return UnitConversionResult(
            source_unit=source_unit,
            target_unit=target_unit,
            classification=UnitConversionClassification.affine,
            conversion_allowed=True,
            explanation="Affine temperature transformation (T_K = T_C + 273.15)."
        )

    # 7. Velocity equivalents
    if s_u in velocity_units and t_u in velocity_units:
        return UnitConversionResult(
            source_unit=source_unit,
            target_unit=target_unit,
            classification=UnitConversionClassification.identity,
            conversion_allowed=True,
            explanation="Standard velocity unit representation."
        )

    # 8. Incompatible physical dimensions
    return UnitConversionResult(
        source_unit=source_unit,
        target_unit=target_unit,
        classification=UnitConversionClassification.not_convertible,
        conversion_allowed=False,
        explanation=f"Cannot convert between incompatible units '{source_unit}' and '{target_unit}'."
    )
