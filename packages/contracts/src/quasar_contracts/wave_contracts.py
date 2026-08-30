"""
QuasarOS Wave & Spectral Partition Specialized Contracts

Authoritative schemas for ocean surface wave products (significant wave height, peak & mean
periods, directional spread, Stokes drift, wave partitions) and circular angular arithmetic utilities.
"""

import math
from enum import Enum
from typing import List, Literal, Optional, Sequence, Union
import numpy as np
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.variables import VectorConvention


class WavePartitionType(str, Enum):
    """Spectral wave partition classification."""
    total_sea = "total_sea"             # Integrated total sea state (wind sea + all swells)
    wind_sea = "wind_sea"               # Locally generated wind wave partition
    primary_swell = "primary_swell"     # Swell partition 1 (highest energy / primary swell)
    secondary_swell = "secondary_swell" # Swell partition 2 (secondary swell)
    tertiary_swell = "tertiary_swell"   # Swell partition 3 (tertiary swell)
    infragravity = "infragravity"       # Low-frequency infragravity wave energy (< 0.04 Hz)


class WaveSpectralModel(str, Enum):
    """Numerical wave action balance model family."""
    WW3 = "WW3"                         # NOAA/NCEP WAVEWATCH III
    WAM = "WAM"                         # WAM (Wave Model / Copernicus ECMWF)
    SWAN = "SWAN"                       # Simulating WAves Nearshore
    MIKE21_SW = "MIKE21_SW"             # DHI MIKE 21 Spectral Wave
    UNSPECIFIED = "unspecified"


class WavePartitionContract(BaseModel):
    """Contract for a single resolved wave partition (wind sea or swell system)."""
    partition_type: WavePartitionType = Field(..., description="Partition identity (wind_sea, primary_swell, etc.).")
    partition_index: int = Field(default=0, ge=0, description="Zero-based index of the partition (0 for total/primary).")
    significant_wave_height_var: str = Field(..., description="Variable name for significant wave height Hs (m).")
    peak_or_mean_period_var: str = Field(..., description="Variable name for wave period (s) (peak Tp or mean Tm).")
    direction_var: str = Field(..., description="Variable name for wave propagation direction in degrees [0, 360).")
    directional_spreading_var: Optional[str] = Field(default=None, description="Variable name for directional spreading width in degrees.")
    directional_convention: VectorConvention = Field(
        default=VectorConvention.meteorological_from,
        description="Directional convention: 'meteorological_from' (degrees coming from, 0=N, 90=E) or 'oceanographic_to'."
    )


class StokesDriftContract(BaseModel):
    """Contract for 3D or surface wave-induced Stokes drift velocity vector."""
    u_stokes_var: str = Field(..., description="Zonal eastward Stokes drift velocity variable name (m/s).")
    v_stokes_var: str = Field(..., description="Meridional northward Stokes drift velocity variable name (m/s).")
    w_stokes_var: Optional[str] = Field(default=None, description="Vertical Stokes drift velocity variable name (m/s).")
    is_surface_only: bool = Field(default=True, description="Whether Stokes drift represents surface value (z=0) or full 3D profile.")
    depth_decay_scale_m: Optional[float] = Field(default=None, description="Characteristic exponential decay depth scale in meters (2 * k_p).")


class OceanWaveProductContract(BaseModel):
    """
    Comprehensive authoritative contract for ocean wave products (Copernicus Waves, NOAA WW3, INCOIS RSMC WW3).
    """
    wave_model: WaveSpectralModel = Field(default=WaveSpectralModel.WW3, description="Spectral wave model architecture.")
    significant_wave_height_total: str = Field(default="VHM0", description="Integrated significant wave height variable name (e.g. 'VHM0', 'hs', 'swh').")
    peak_period_total: Optional[str] = Field(default="VTPK", description="Peak wave period variable name (e.g. 'VTPK', 'tp').")
    mean_period_total: Optional[str] = Field(default="VTM02", description="Mean wave period variable name (e.g. 'VTM02', 'tm02').")
    mean_direction_total: Optional[str] = Field(default="VMDR", description="Mean wave direction variable name in degrees [0, 360).")
    directional_convention: VectorConvention = Field(
        default=VectorConvention.meteorological_from,
        description="Directional convention for wave angles (standard meteorological 'from')."
    )
    spectral_frequencies_count: Optional[int] = Field(default=None, ge=1, description="Number of discrete frequency bins (e.g. 25-36).")
    spectral_directions_count: Optional[int] = Field(default=None, ge=1, description="Number of discrete directional bins (e.g. 24-36).")
    partitions: List[WavePartitionContract] = Field(default_factory=list, description="Resolved wave partition contracts.")
    stokes_drift: Optional[StokesDriftContract] = Field(default=None, description="Stokes drift velocity contract.")


# ---------------------------------------------------------------------------
# Circular Angular Arithmetic Utilities
# ---------------------------------------------------------------------------

def normalize_angle_deg(deg: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """
    Normalize angle(s) in degrees into standard compass range [0.0, 360.0).
    """
    return np.mod(deg, 360.0)


def circular_distance_deg(deg1: Union[float, np.ndarray], deg2: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """
    Computes the shortest angular difference (geodesic distance on circle) between two angles in degrees.
    The result is strictly within [0.0, 180.0].
    
    Example:
    circular_distance_deg(359.0, 1.0) == 2.0
    circular_distance_deg(10.0, 350.0) == 20.0
    circular_distance_deg(90.0, 270.0) == 180.0
    """
    diff = np.abs(np.asarray(deg1, dtype=np.float64) - np.asarray(deg2, dtype=np.float64)) % 360.0
    dist = np.minimum(diff, 360.0 - diff)
    if isinstance(deg1, (int, float)) and isinstance(deg2, (int, float)):
        return float(dist)
    return dist


def mean_wave_direction(
    directions_deg: Union[Sequence[float], np.ndarray],
    weights: Optional[Union[Sequence[float], np.ndarray]] = None
) -> float:
    """
    Computes the circular weighted mean direction in degrees [0.0, 360.0) using vector averaging.
    Avoids branch-cut errors at the 0/360 degree boundary.
    
    Parameters:
    - directions_deg: directional angles in degrees (e.g. wave propagation directions).
    - weights: optional non-negative weights (e.g. wave energy density or significant wave height squared).
    
    Returns:
    - mean_direction: float in [0.0, 360.0).
    """
    rad = np.deg2rad(directions_deg)
    sin_vals = np.sin(rad)
    cos_vals = np.cos(rad)

    if weights is not None:
        w = np.asarray(weights, dtype=np.float64)
        if np.all(w == 0):
            return 0.0
        s = np.sum(w * sin_vals)
        c = np.sum(w * cos_vals)
    else:
        s = np.mean(sin_vals)
        c = np.mean(cos_vals)

    mean_rad = math.atan2(float(s), float(c))
    mean_deg = math.degrees(mean_rad) % 360.0
    if abs(mean_deg - 360.0) < 1e-10:
        mean_deg = 0.0
    return float(mean_deg)
