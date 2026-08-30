"""
QuasarOS Canonical Dimensions and Coordinates Contracts

Defines formal representations for horizontal, vertical, and temporal axes,
including bounds, monotonicity, spacing, and coordinate datum conventions.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class AxisType(str, Enum):
    """CF-aligned logical axis type for multidimensional ocean data."""
    T = "T"  # Time axis
    Z = "Z"  # Vertical depth/pressure/height axis
    Y = "Y"  # Horizontal latitude / grid-y axis
    X = "X"  # Horizontal longitude / grid-x axis
    N = "N"  # Unstructured mesh node axis
    F = "F"  # Unstructured mesh face / element axis
    P = "P"  # Profile / cast identifier axis
    L = "L"  # Profile level / sample index axis
    O = "O"  # Discrete observation / trajectory sample axis
    C = "C"  # Vector component axis (u, v, w)
    E = "E"  # Ensemble member axis


class Monotonicity(str, Enum):
    """Monotonicity classification of a coordinate axis."""
    increasing = "increasing"
    decreasing = "decreasing"
    non_monotonic = "non_monotonic"


class CoordinateSpacing(str, Enum):
    """Geometric spacing regularity along an axis."""
    uniform = "uniform"          # Identical step size across all cells
    regular = "regular"          # Uniform step within small numeric epsilon
    non_uniform = "non_uniform"  # Variable standard levels (e.g. geometric z-levels)
    irregular = "irregular"      # Arbitrary sensor sampling intervals
    discrete = "discrete"        # Categorical or index-based coordinate


class VerticalDatum(str, Enum):
    """Reference vertical datum."""
    mean_sea_level = "mean_sea_level"
    sea_surface = "sea_surface"
    geoid = "geoid"
    wgs84_ellipsoid = "wgs84_ellipsoid"


class VerticalDirection(str, Enum):
    """Direction of positive vertical coordinate."""
    down = "down"  # Oceanographic depth standard (0 at surface, increasing downwards)
    up = "up"      # Elevation standard (0 at surface, increasing upwards)


class CanonicalDimension(BaseModel):
    """Definition of a logical array dimension."""
    name: str = Field(
        ...,
        description="Dimension name as stored in canonical dataset (e.g. 'time', 'depth', 'lat', 'lon')."
    )
    axis: AxisType = Field(
        ...,
        description="Logical CF axis mapping (T, Z, Y, X, etc.)."
    )
    size: int = Field(
        ...,
        gt=0,
        description="Length of the dimension (must be > 0)."
    )
    is_unlimited: bool = Field(
        default=False,
        description="Whether this dimension can be appended dynamically."
    )
    chunk_size: Optional[int] = Field(
        default=None,
        description="Recommended Zarr / chunking block size along this dimension."
    )


class CanonicalCoordinate(BaseModel):
    """Specification of a 1D or discrete coordinate variable."""
    name: str = Field(
        ...,
        description="Coordinate name."
    )
    axis: AxisType = Field(
        ...,
        description="Associated logical axis."
    )
    units: str = Field(
        ...,
        description="Canonical coordinate units (e.g. 'degrees_east', 'degrees_north', 'm', 'seconds since ...')."
    )
    standard_name: Optional[str] = Field(
        default=None,
        description="CF standard name (e.g. 'longitude', 'latitude', 'depth', 'time')."
    )
    data_type: str = Field(
        default="float64",
        description="Coordinate numeric storage type."
    )
    min_value: float = Field(
        ...,
        description="Minimum coordinate value."
    )
    max_value: float = Field(
        ...,
        description="Maximum coordinate value."
    )
    monotonicity: Monotonicity = Field(
        default=Monotonicity.increasing,
        description="Direction of coordinate values."
    )
    spacing: CoordinateSpacing = Field(
        default=CoordinateSpacing.regular,
        description="Regularity of cell spacing."
    )
    values_count: int = Field(
        ...,
        gt=0,
        description="Number of coordinate points."
    )
    step_size: Optional[float] = Field(
        default=None,
        description="Step size for uniform/regular coordinates."
    )
    values_sample: Optional[List[float]] = Field(
        default=None,
        description="Sample or complete discrete level values (e.g. depth levels)."
    )

    @model_validator(mode="after")
    def validate_bounds(self) -> "CanonicalCoordinate":
        if self.min_value > self.max_value:
            raise ValueError(
                f"Invalid coordinate bounds for '{self.name}': min_value ({self.min_value}) > max_value ({self.max_value})."
            )
        return self


class LongitudeCoordinate(CanonicalCoordinate):
    """Specialized coordinate for Longitude with WGS84 bounds validation."""
    axis: AxisType = AxisType.X
    standard_name: str = "longitude"
    units: str = "degrees_east"

    @model_validator(mode="after")
    def validate_longitude_domain(self) -> "LongitudeCoordinate":
        if self.min_value < -180.0 or self.max_value > 360.0:
            raise ValueError(
                f"Longitude bounds [{self.min_value}, {self.max_value}] exceed valid planetary range [-180, 360]."
            )
        return self


class LatitudeCoordinate(CanonicalCoordinate):
    """Specialized coordinate for Latitude with [-90, 90] bounds validation."""
    axis: AxisType = AxisType.Y
    standard_name: str = "latitude"
    units: str = "degrees_north"

    @model_validator(mode="after")
    def validate_latitude_domain(self) -> "LatitudeCoordinate":
        if self.min_value < -90.0 or self.max_value > 90.0:
            raise ValueError(
                f"Latitude bounds [{self.min_value}, {self.max_value}] exceed valid geographic range [-90, 90]."
            )
        return self
