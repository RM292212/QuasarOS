"""
QuasarOS Vector Groups & Coordinate Rotation Contracts

Authoritative schemas for ocean vector field groupings (velocities, wind stress, wave direction,
Stokes drift), 2D/3D component associations, Earth-relative vs Grid-relative conventions,
and curvilinear / map-projection rotation transformations.
"""

from enum import Enum
from typing import List, Literal, Optional, Tuple, Union
import numpy as np
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.variables import VectorConvention


class VectorReferenceFrame(str, Enum):
    """Reference coordinate frame for vector components."""
    earth_relative = "earth_relative"        # Eastward (true East) and Northward (true North)
    grid_relative = "grid_relative"          # Along-grid XI (curvilinear i) and ETA (curvilinear j)
    instrument_relative = "instrument_relative" # Acoustic ADCP beam coordinates / ship heading relative


class VectorGroupType(str, Enum):
    """Taxonomy of scientific vector fields."""
    ocean_velocity_3d = "ocean_velocity_3d"        # (u, v, w) 3D ocean velocity
    ocean_surface_velocity_2d = "ocean_surface_velocity_2d" # (u, v) horizontal ocean current
    wind_stress_2d = "wind_stress_2d"              # (tau_x, tau_y) surface wind stress
    stokes_drift_3d = "stokes_drift_3d"            # (u_stokes, v_stokes, w_stokes)
    stokes_drift_2d = "stokes_drift_2d"            # Surface Stokes drift
    wave_propagation_vector = "wave_propagation_vector" # Wave wavenumber or directional vector


class RotationMetadata(BaseModel):
    """
    Metadata required for converting between grid-relative and true Earth-relative vector components.
    Formula:
      u_earth = u_grid * cos(angle) - v_grid * sin(angle)
      v_earth = u_grid * sin(angle) + v_grid * cos(angle)
    """
    angle_variable_name: str = Field(
        default="angle",
        description="Dataset variable name containing grid rotation angle in radians between xi-axis and true East."
    )
    angle_units: Literal["radians", "degrees"] = Field(
        default="radians",
        description="Units of the rotation angle array."
    )
    source_reference_frame: VectorReferenceFrame = Field(
        default=VectorReferenceFrame.grid_relative,
        description="Original frame in the source dataset."
    )
    target_reference_frame: VectorReferenceFrame = Field(
        default=VectorReferenceFrame.earth_relative,
        description="Target reference frame for scientific visualization and analysis."
    )


class VectorGroupContract(BaseModel):
    """
    Authoritative contract defining a grouped physical vector field and its components.
    """
    group_id: str = Field(..., description="Unique identifier for the vector group (e.g. 'ocean_current_vector').")
    group_type: VectorGroupType = Field(..., description="Taxonomy classification of the vector field.")
    u_component_var: str = Field(..., description="Zonal / along-xi component variable name (e.g. 'u', 'uo', 'u_eastward').")
    v_component_var: str = Field(..., description="Meridional / along-eta component variable name (e.g. 'v', 'vo', 'v_northward').")
    w_component_var: Optional[str] = Field(default=None, description="Vertical component variable name (e.g. 'w', 'wo') if 3D vector.")
    magnitude_var: Optional[str] = Field(default=None, description="Precomputed scalar magnitude / speed variable name (e.g. 'speed').")
    direction_var: Optional[str] = Field(default=None, description="Precomputed direction variable name in degrees.")
    reference_frame: VectorReferenceFrame = Field(
        default=VectorReferenceFrame.earth_relative,
        description="Reference frame convention of the stored components."
    )
    directional_convention: VectorConvention = Field(
        default=VectorConvention.oceanographic_to,
        description="Directional convention: 'oceanographic_to' (currents) or 'meteorological_from' (waves/wind)."
    )
    rotation_metadata: Optional[RotationMetadata] = Field(
        default=None,
        description="Rotation parameters if components require grid-to-earth transformation."
    )

    @model_validator(mode="after")
    def validate_reference_frame_rotation(self) -> "VectorGroupContract":
        if self.reference_frame == VectorReferenceFrame.grid_relative and self.rotation_metadata is None:
            # Set default rotation metadata
            self.rotation_metadata = RotationMetadata()
        return self


# ---------------------------------------------------------------------------
# Vector Rotation & Arithmetic Utilities
# ---------------------------------------------------------------------------

def rotate_grid_to_earth(
    u_grid: Union[float, np.ndarray],
    v_grid: Union[float, np.ndarray],
    angle_rad: Union[float, np.ndarray]
) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray]]:
    """
    Rotate grid-relative velocity components (u_grid, v_grid) to true Earth-relative (u_east, v_north).
    
    Formula:
      u_east  =  u_grid * cos(angle) - v_grid * sin(angle)
      v_north =  u_grid * sin(angle) + v_grid * cos(angle)
    """
    cos_a = np.cos(angle_rad)
    sin_a = np.sin(angle_rad)
    u_east = u_grid * cos_a - v_grid * sin_a
    v_north = u_grid * sin_a + v_grid * cos_a
    return u_east, v_north


def rotate_earth_to_grid(
    u_east: Union[float, np.ndarray],
    v_north: Union[float, np.ndarray],
    angle_rad: Union[float, np.ndarray]
) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray]]:
    """
    Rotate true Earth-relative velocity components (u_east, v_north) to grid-relative (u_grid, v_grid).
    
    Formula:
      u_grid =  u_east * cos(angle) + v_north * sin(angle)
      v_grid = -u_east * sin(angle) + v_north * cos(angle)
    """
    cos_a = np.cos(angle_rad)
    sin_a = np.sin(angle_rad)
    u_grid = u_east * cos_a + v_north * sin_a
    v_grid = -u_east * sin_a + v_north * cos_a
    return u_grid, v_grid


def compute_speed_and_direction(
    u_east: Union[float, np.ndarray],
    v_north: Union[float, np.ndarray],
    convention: VectorConvention = VectorConvention.oceanographic_to
) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray]]:
    """
    Compute scalar speed and directional angle in degrees [0.0, 360.0) from Cartesian (u_east, v_north).
    
    - oceanographic_to: direction the vector flows towards (0=North, 90=East, 180=South, 270=West).
    - meteorological_from: direction the vector comes from (standard wind / wave convention).
    """
    speed = np.sqrt(np.square(u_east) + np.square(v_north))
    
    # Standard math angle from East counter-clockwise is atan2(v, u)
    # Oceanographic compass direction TO (clockwise from North):
    # deg_to = (90 - deg_math) % 360 = (atan2(u, v) in deg) % 360
    rad_dir = np.arctan2(u_east, v_north)
    deg = np.mod(np.rad2deg(rad_dir), 360.0)

    if convention == VectorConvention.meteorological_from:
        deg = np.mod(deg + 180.0, 360.0)

    if isinstance(u_east, (int, float)) and isinstance(v_north, (int, float)):
        return float(speed), float(deg)

    return speed, deg
