"""
QuasarOS Vertical Coordinate Base Contracts

Defines vertical coordinate representations across geometric depth z-levels, pressure,
sigma levels, hybrid systems, and ROMS generalized terrain-following s-coordinates.
"""

from enum import Enum
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.coordinates import VerticalDatum, VerticalDirection


class VerticalCoordinateType(str, Enum):
    """Classification of vertical coordinate system."""
    depth = "depth"                                           # Geometric depth in meters (z > 0 down)
    pressure = "pressure"                                     # Sea water pressure in dbar
    height = "height"                                         # Geometric height / elevation in meters (up > 0)
    z_level = "z_level"                                       # Discrete standard depth z-levels
    sigma = "sigma"                                           # Classical sigma terrain-following (-1 <= sigma <= 0)
    hybrid_sigma = "hybrid_sigma"                             # Hybrid sigma-pressure / sigma-z
    terrain_following_s_coordinate = "terrain_following_s_coordinate"  # ROMS generalized s-coordinate
    surface_only = "surface_only"                             # 2D surface fields (depth = 0.0m)


class ROMSSCoordinateParameters(BaseModel):
    """
    Theoretical formulation parameters for ROMS terrain-following s-coordinates.
    Supports Vtransform 1 (Song & Haidvogel 1994) and Vtransform 2 (Shchepetkin & McWilliams 2005).
    """
    Vtransform: Literal[1, 2] = Field(
        default=1,
        description="Vertical transformation equation (1: Song & Haidvogel 1994; 2: Shchepetkin & McWilliams 2005)."
    )
    Vstretching: Literal[1, 2, 4, 5] = Field(
        default=1,
        description="Vertical stretching function (1: Song/Haidvogel, 2: A. Shchepetkin 2005, 4: UCLA, 5: Souza)."
    )
    theta_s: float = Field(
        ...,
        ge=0.0,
        description="Surface stretching parameter (theta_s >= 0.0)."
    )
    theta_b: float = Field(
        ...,
        ge=0.0,
        description="Bottom stretching parameter (theta_b >= 0.0)."
    )
    hc: float = Field(
        ...,
        gt=0.0,
        description="Critical depth / thermocline parameter in meters (hc > 0.0)."
    )
    N: int = Field(
        ...,
        gt=0,
        description="Number of vertical terrain-following s-levels."
    )
    s_rho: List[float] = Field(
        ...,
        description="Fractional non-dimensional vertical coordinates at RHO points (in [-1.0, 0.0])."
    )
    Cs_r: List[float] = Field(
        ...,
        description="Non-dimensional stretching curves C(s) at RHO points (in [-1.0, 0.0])."
    )
    s_w: Optional[List[float]] = Field(
        default=None,
        description="Fractional vertical coordinates at W points (in [-1.0, 0.0])."
    )
    Cs_w: Optional[List[float]] = Field(
        default=None,
        description="Stretching curves C(s) at W points (in [-1.0, 0.0])."
    )

    @model_validator(mode="after")
    def validate_roms_arrays(self) -> "ROMSSCoordinateParameters":
        if len(self.s_rho) != self.N:
            raise ValueError(f"s_rho length ({len(self.s_rho)}) must equal N ({self.N}).")
        if len(self.Cs_r) != self.N:
            raise ValueError(f"Cs_r length ({len(self.Cs_r)}) must equal N ({self.N}).")
        if any(s < -1.0001 or s > 0.0001 for s in self.s_rho):
            raise ValueError("All s_rho values must reside within [-1.0, 0.0].")
        if any(c < -1.0001 or c > 0.0001 for c in self.Cs_r):
            raise ValueError("All Cs_r values must reside within [-1.0, 0.0].")
        return self


class VerticalCoordinateContract(BaseModel):
    """Authoritative contract specifying vertical coordinate definition."""
    coordinate_type: VerticalCoordinateType = Field(
        ...,
        description="Type of vertical coordinate."
    )
    units: str = Field(
        default="m",
        description="Vertical unit string ('m', 'dbar', '1', 'level')."
    )
    positive_direction: VerticalDirection = Field(
        default=VerticalDirection.down,
        description="Direction of increasing coordinate value."
    )
    datum: VerticalDatum = Field(
        default=VerticalDatum.mean_sea_level,
        description="Reference physical datum."
    )
    min_depth_m: Optional[float] = Field(
        default=None,
        description="Minimum geometric depth in meters."
    )
    max_depth_m: Optional[float] = Field(
        default=None,
        description="Maximum geometric depth in meters."
    )
    levels: Optional[List[float]] = Field(
        default=None,
        description="Discrete nominal coordinate levels (e.g. standard 31 z-levels)."
    )
    level_count: int = Field(
        ...,
        gt=0,
        description="Number of vertical levels."
    )
    is_uniform: bool = Field(
        default=False,
        description="Whether geometric spacing between levels is uniform."
    )
    is_time_varying: bool = Field(
        default=False,
        description="Whether vertical coordinate physical positions shift with time (e.g. s-coords with sea surface height)."
    )
    is_space_varying: bool = Field(
        default=False,
        description="Whether vertical coordinate physical positions vary horizontally (e.g. s-coords with bathymetry)."
    )
    roms_params: Optional[ROMSSCoordinateParameters] = Field(
        default=None,
        description="ROMS s-coordinate formulation parameters if coordinate_type is terrain_following_s_coordinate."
    )

    @model_validator(mode="after")
    def validate_vertical_invariants(self) -> "VerticalCoordinateContract":
        if self.coordinate_type == VerticalCoordinateType.terrain_following_s_coordinate:
            if self.roms_params is None:
                raise ValueError("roms_params must be supplied when coordinate_type is 'terrain_following_s_coordinate'.")
        
        if self.coordinate_type == VerticalCoordinateType.surface_only:
            if self.level_count != 1:
                raise ValueError("surface_only vertical coordinate must have level_count=1.")

        if self.levels is not None and len(self.levels) > 1:
            # Validate levels count matches
            if len(self.levels) != self.level_count:
                raise ValueError(f"levels array length ({len(self.levels)}) != level_count ({self.level_count}).")
            # Verify monotonicity of discrete level sequence
            diffs = [self.levels[i+1] - self.levels[i] for i in range(len(self.levels)-1)]
            if not (all(d > 0 for d in diffs) or all(d < 0 for d in diffs)):
                raise ValueError(f"Vertical levels array must be strictly monotonic: {self.levels}")

        return self
