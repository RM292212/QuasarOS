"""
QuasarOS Canonical Variable Contract

Defines formal variable representations, physical quantities, CF standard names,
packing specifications, physical validity bounds, display colormaps, and vector conventions.
"""

from enum import Enum
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.missing_values import MissingValueContract, PackingMetadata
from quasar_contracts.quality_control import QCScheme


class PhysicalQuantity(str, Enum):
    """Authoritative physical quantity taxonomy."""
    temperature = "temperature"
    practical_salinity = "practical_salinity"
    absolute_salinity = "absolute_salinity"
    velocity_component = "velocity_component"
    velocity_vector = "velocity_vector"
    speed = "speed"
    surface_elevation = "surface_elevation"
    wave_height = "wave_height"
    wave_direction = "wave_direction"
    wave_period = "wave_period"
    bathymetry_elevation = "bathymetry_elevation"
    dissolved_oxygen = "dissolved_oxygen"
    chlorophyll_concentration = "chlorophyll_concentration"
    nitrate = "nitrate"
    phosphate = "phosphate"
    silicate = "silicate"
    density = "density"
    sound_speed = "sound_speed"
    mixed_layer_depth = "mixed_layer_depth"
    quality_flag = "quality_flag"
    dimensionless = "dimensionless"


class Topology(str, Enum):
    """Geometric topology of the variable array."""
    volume_scalar = "volume_scalar"
    volume_vector = "volume_vector"
    surface_scalar = "surface_scalar"
    surface_vector = "surface_vector"
    terrain = "terrain"
    profile = "profile"
    trajectory = "trajectory"
    point_timeseries = "point_timeseries"
    mesh = "mesh"
    mask = "mask"
    uncertainty = "uncertainty"


class VectorConvention(str, Enum):
    """Directional convention for vector fields."""
    oceanographic_to = "oceanographic_to"          # Cartesian velocity direction flowing TO (ocean currents)
    meteorological_from = "meteorological_from"    # Meteorological direction coming FROM (wave direction, wind)
    none = "none"


class DisplayRange(BaseModel):
    """Default visual range and colormap configuration for rendering."""
    min_value: float = Field(
        ...,
        description="Lower bound of default transfer function or colorbar."
    )
    max_value: float = Field(
        ...,
        description="Upper bound of default transfer function or colorbar."
    )
    colormap: str = Field(
        default="turbo",
        description="Scientific colormap name ('turbo', 'viridis', 'cmocean_thermal', 'cmocean_haline', 'cmocean_speed')."
    )
    unit: str = Field(
        ...,
        description="Display unit label rendered in UI colorbar."
    )
    scale: Literal["linear", "logarithmic", "diverging"] = Field(
        default="linear",
        description="Color scale transfer function shape."
    )

    @model_validator(mode="after")
    def validate_display_range(self) -> "DisplayRange":
        if self.min_value >= self.max_value:
            raise ValueError(f"Display range min ({self.min_value}) must be strictly less than max ({self.max_value}).")
        return self


class CanonicalVariableContract(BaseModel):
    """Authoritative scientific variable contract."""
    variable_id: str = Field(
        ...,
        description="Canonical unique variable identifier (e.g. 'sea_water_potential_temperature')."
    )
    canonical_name: str = Field(
        ...,
        description="Standardized name across all providers."
    )
    source_name: str = Field(
        ...,
        description="Original variable name in source file (e.g. 'thetao', 'water_temp', 'so', 'VHM0')."
    )
    standard_name: str = Field(
        ...,
        description="CF standard name (e.g. 'sea_water_potential_temperature', 'sea_surface_wave_significant_height')."
    )
    long_name: str = Field(
        ...,
        description="Human-readable descriptive title."
    )
    physical_quantity: PhysicalQuantity = Field(
        ...,
        description="Physical quantity classification."
    )
    canonical_units: str = Field(
        ...,
        description="Standard canonical unit (e.g. 'degree_Celsius', 'm s-1', 'dbar', '1e-3')."
    )
    source_units: str = Field(
        ...,
        description="Original unit string recorded in raw source metadata."
    )
    topology: Topology = Field(
        ...,
        description="Geometric rendering topology."
    )
    data_type: str = Field(
        default="float32",
        description="Canonical storage floating point precision ('float32', 'float64', 'int16')."
    )
    dimensions: List[str] = Field(
        ...,
        description="Ordered list of dimension names (e.g. ['time', 'depth', 'latitude', 'longitude'])."
    )
    is_vector: bool = Field(
        default=False,
        description="Whether this variable forms part of a multi-component vector field."
    )
    vector_components: Optional[List[str]] = Field(
        default=None,
        description="List of component variable IDs if this is a composite vector."
    )
    vector_convention: VectorConvention = Field(
        default=VectorConvention.none,
        description="Direction convention if directional/vector variable."
    )
    reference_north: Optional[str] = Field(
        default="geographic_true_north",
        description="Reference North datum for directional angles."
    )
    packing: Optional[PackingMetadata] = Field(
        default=None,
        description="Scale factor and add offset packing metadata if packed in raw source."
    )
    missing_value_contract: MissingValueContract = Field(
        default_factory=MissingValueContract,
        description="Missing and fill value specifications."
    )
    display_range: Optional[DisplayRange] = Field(
        default=None,
        description="Recommended default visual color mapping."
    )
    qc_scheme: Optional[QCScheme] = Field(
        default=None,
        description="Quality control standard associated with this variable."
    )

    @model_validator(mode="after")
    def validate_variable_invariants(self) -> "CanonicalVariableContract":
        if self.is_vector and not self.vector_components:
            raise ValueError(f"Vector variable '{self.variable_id}' must define vector_components.")
        return self
