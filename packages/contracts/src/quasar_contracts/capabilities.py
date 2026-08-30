"""
QuasarOS Dataset Capabilities Contract

Defines explicit capability flags governing allowable visualization modes, slicing,
isosurface extraction, and exact analytical queries for each dataset topology.
"""

from pydantic import BaseModel, Field


class DatasetCapabilitiesContract(BaseModel):
    """Explicit capability declarations for renderer routing and analytical tools."""
    can_volume_render_3d: bool = Field(
        default=False,
        description="Dataset contains 3D/4D depth-resolved scalar field eligible for volume raymarching."
    )
    can_surface_render_2d: bool = Field(
        default=False,
        description="Dataset contains 2D surface raster eligible for georeferenced surface mapping."
    )
    can_render_vector_glyphs: bool = Field(
        default=False,
        description="Dataset contains vector components (u, v, w) eligible for 2D/3D arrow glyph rendering."
    )
    can_render_streamlines: bool = Field(
        default=False,
        description="Dataset supports streamline or particle flow integration."
    )
    can_render_observation_profiles: bool = Field(
        default=False,
        description="Dataset contains in-situ 1D vertical profile casts (Argo, CTD)."
    )
    can_render_observation_trajectories: bool = Field(
        default=False,
        description="Dataset contains 4D moving observation paths (Glider yo-yo dives, drifters)."
    )
    can_render_bathymetry_terrain: bool = Field(
        default=False,
        description="Dataset contains digital bathymetry elevation eligible for 3D seafloor mesh clipping."
    )
    can_exact_query: bool = Field(
        default=True,
        description="Dataset supports exact quantitative cell inspection from canonical arrays."
    )
    can_horizontal_slice: bool = Field(
        default=False,
        description="Dataset supports arbitrary horizontal depth plane slicing."
    )
    can_vertical_slice: bool = Field(
        default=False,
        description="Dataset supports arbitrary vertical transect slicing."
    )
    can_extract_isosurface: bool = Field(
        default=False,
        description="Dataset supports 3D Marching Cubes / GPU isosurface polygonization."
    )
    can_collocate_with_profiles: bool = Field(
        default=False,
        description="Dataset supports automated 4D spatiotemporal collocation with in-situ profiles."
    )
