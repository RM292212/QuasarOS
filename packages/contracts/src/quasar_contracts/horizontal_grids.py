"""
QuasarOS Horizontal Grid Base Contracts

Defines formal representations for rectilinear, curvilinear, staggered (Arakawa),
unstructured mesh, point collection, and trajectory horizontal grids.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class GridType(str, Enum):
    """Classification of the horizontal grid topology."""
    rectilinear = "rectilinear"          # Regular 1D lat/lon coordinates
    curvilinear = "curvilinear"          # 2D lat(y, x) and lon(y, x) coordinate arrays
    staggered = "staggered"              # Arakawa staggered grid (u, v, rho, psi points)
    unstructured = "unstructured"        # Flexible triangular/quad element mesh
    point_collection = "point_collection"# Discrete point observation locations
    trajectory = "trajectory"            # Continuous 1D path with track coordinates


class CRS(str, Enum):
    """Authoritative coordinate reference system."""
    EPSG_4326 = "EPSG:4326"        # WGS 84 Geographic Latitude/Longitude
    EPSG_3857 = "EPSG:3857"        # WGS 84 Pseudo-Mercator
    LOCAL_CARTESIAN = "local_cartesian"


class StaggeringType(str, Enum):
    """Arakawa grid staggering convention."""
    none = "none"
    arakawa_a = "arakawa_a"          # All variables collocated at cell centers
    arakawa_b = "arakawa_b"          # Velocities at cell corners, scalars at center
    arakawa_c_rho = "arakawa_c_rho"  # Tracers / density at cell centers
    arakawa_c_u = "arakawa_c_u"      # East-west velocity at western/eastern cell faces
    arakawa_c_v = "arakawa_c_v"      # North-south velocity at southern/northern cell faces
    arakawa_c_psi = "arakawa_c_psi"  # Vorticity / streamfunction at cell vertices


class SpatialBoundingBox(BaseModel):
    """2D spatial bounding box in geographic coordinates."""
    min_longitude: float = Field(
        ...,
        description="Westernmost longitude in degrees."
    )
    min_latitude: float = Field(
        ...,
        description="Southernmost latitude in degrees."
    )
    max_longitude: float = Field(
        ...,
        description="Easternmost longitude in degrees."
    )
    max_latitude: float = Field(
        ...,
        description="Northernmost latitude in degrees."
    )

    @model_validator(mode="after")
    def validate_bounds(self) -> "SpatialBoundingBox":
        if self.min_latitude < -90.0 or self.max_latitude > 90.0:
            raise ValueError(f"Latitude bounds [{self.min_latitude}, {self.max_latitude}] exceed [-90, 90].")
        if self.min_latitude > self.max_latitude:
            raise ValueError(f"min_latitude ({self.min_latitude}) > max_latitude ({self.max_latitude}).")
        if self.min_longitude > self.max_longitude:
            raise ValueError(f"min_longitude ({self.min_longitude}) > max_longitude ({self.max_longitude}).")
        return self


class HorizontalGridContract(BaseModel):
    """Authoritative contract specifying the horizontal grid representation."""
    grid_id: str = Field(
        ...,
        description="Unique identifier for the horizontal grid configuration."
    )
    grid_type: GridType = Field(
        ...,
        description="Fundamental topology of the horizontal grid."
    )
    crs: str = Field(
        default="EPSG:4326",
        description="Coordinate Reference System string (e.g. 'EPSG:4326')."
    )
    spatial_bounds: SpatialBoundingBox = Field(
        ...,
        description="Geographic bounding box enclosing all valid grid cells."
    )
    resolution_x_deg: Optional[float] = Field(
        default=None,
        description="Zonal grid resolution in degrees (for rectilinear grids)."
    )
    resolution_y_deg: Optional[float] = Field(
        default=None,
        description="Meridional grid resolution in degrees (for rectilinear grids)."
    )
    resolution_description: str = Field(
        ...,
        description="Human-readable description of grid resolution (e.g. '0.08333_degree_equirectangular')."
    )
    shape: List[int] = Field(
        ...,
        description="Array shape along horizontal dimensions [ny, nx] or [n_points]."
    )
    dimension_names: List[str] = Field(
        ...,
        description="Names of the horizontal dimensions (e.g. ['latitude', 'longitude'])."
    )
    staggering: StaggeringType = Field(
        default=StaggeringType.none,
        description="Grid staggering classification if Arakawa staggered."
    )
    is_periodic_longitude: bool = Field(
        default=False,
        description="Whether the grid wraps 360 degrees around the globe."
    )
    node_count: Optional[int] = Field(
        default=None,
        description="Number of nodes (for unstructured mesh)."
    )
    element_count: Optional[int] = Field(
        default=None,
        description="Number of polygonal elements (for unstructured mesh)."
    )

    @model_validator(mode="after")
    def validate_grid_invariants(self) -> "HorizontalGridContract":
        if any(s <= 0 for s in self.shape):
            raise ValueError(f"All shape dimensions must be positive, got {self.shape}.")
        return self
