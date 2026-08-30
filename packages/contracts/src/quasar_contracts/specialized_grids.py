"""
QuasarOS Specialized Grids Contracts

Authoritative schemas for complex numerical model grids: curvilinear coordinate meshes,
Arakawa staggering representations (A, B, C-rho, C-u, C-v, C-psi), cell edge metrics,
and curvilinear rotation angle fields (angle between grid xi-axis and true East).
"""

from enum import Enum
from typing import List, Literal, Optional, Tuple
import numpy as np
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.horizontal_grids import CRS, GridType, SpatialBoundingBox, StaggeringType


class CurvilinearGridContract(BaseModel):
    """
    Contract for 2D curvilinear coordinate horizontal grids (ROMS, NEMO ORCA, HYCOM bipolar/tripolar).
    Coordinates are 2D arrays: lon(eta, xi) and lat(eta, xi).
    """
    grid_id: str = Field(..., description="Unique identifier for the curvilinear grid.")
    eta_dimension_name: str = Field(default="eta_rho", description="Name of the along-grid meridional dimension (Y / eta).")
    xi_dimension_name: str = Field(default="xi_rho", description="Name of the along-grid zonal dimension (X / xi).")
    eta_size: int = Field(..., gt=0, description="Dimension size along eta.")
    xi_size: int = Field(..., gt=0, description="Dimension size along xi.")
    lon_variable_name: str = Field(default="lon_rho", description="Variable name of 2D longitude array.")
    lat_variable_name: str = Field(default="lat_rho", description="Variable name of 2D latitude array.")
    angle_variable_name: Optional[str] = Field(
        default="angle",
        description="Variable name of the grid rotation angle field (radians between xi axis and true East)."
    )
    spatial_bounds: SpatialBoundingBox = Field(..., description="Geographic bounding box enclosing all valid cells.")
    has_curvilinear_metrics: bool = Field(
        default=True,
        description="Whether metric scale factors (pm, pn / dx, dy) are present in the dataset."
    )
    pm_variable_name: Optional[str] = Field(default="pm", description="Reciprocal of grid spacing in XI-direction (1/m).")
    pn_variable_name: Optional[str] = Field(default="pn", description="Reciprocal of grid spacing in ETA-direction (1/m).")


class ArakawaStaggeringContract(BaseModel):
    """
    Contract defining Arakawa grid staggering geometry and spatial alignment of variables.
    """
    staggering_type: StaggeringType = Field(..., description="Arakawa staggering classification (A, B, C-rho, C-u, C-v, C-psi).")
    rho_grid_name: str = Field(default="rho_grid", description="Identifier for scalar / density / tracer center points.")
    u_grid_name: Optional[str] = Field(default="u_grid", description="Identifier for u-momentum western/eastern face points.")
    v_grid_name: Optional[str] = Field(default="v_grid", description="Identifier for v-momentum southern/northern face points.")
    psi_grid_name: Optional[str] = Field(default="psi_grid", description="Identifier for psi / vorticity corner points.")
    u_offset_xi: float = Field(default=-0.5, description="Offset in xi-index for u relative to rho (-0.5 cell face).")
    u_offset_eta: float = Field(default=0.0, description="Offset in eta-index for u relative to rho.")
    v_offset_xi: float = Field(default=0.0, description="Offset in xi-index for v relative to rho.")
    v_offset_eta: float = Field(default=-0.5, description="Offset in eta-index for v relative to rho (-0.5 cell face).")
    psi_offset_xi: float = Field(default=-0.5, description="Offset in xi-index for psi corner relative to rho.")
    psi_offset_eta: float = Field(default=-0.5, description="Offset in eta-index for psi corner relative to rho.")


class GridMetricsContract(BaseModel):
    """
    Differential geometry metrics for horizontal grid cells (cell widths dx, dy, areas, Coriolis f).
    """
    dx_min_meters: float = Field(..., gt=0.0, description="Minimum horizontal grid cell width in meters.")
    dx_max_meters: float = Field(..., gt=0.0, description="Maximum horizontal grid cell width in meters.")
    dy_min_meters: float = Field(..., gt=0.0, description="Minimum horizontal grid cell height in meters.")
    dy_max_meters: float = Field(..., gt=0.0, description="Maximum horizontal grid cell height in meters.")
    coriolis_parameter_variable: Optional[str] = Field(default="f", description="Variable name of Coriolis parameter f = 2*omega*sin(phi) (1/s).")

    @model_validator(mode="after")
    def validate_metrics(self) -> "GridMetricsContract":
        if self.dx_min_meters > self.dx_max_meters:
            raise ValueError("dx_min_meters cannot exceed dx_max_meters.")
        if self.dy_min_meters > self.dy_max_meters:
            raise ValueError("dy_min_meters cannot exceed dy_max_meters.")
        return self
