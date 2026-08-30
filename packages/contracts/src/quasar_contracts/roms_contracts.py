"""
QuasarOS ROMS S-Coordinate Specialized Contracts & Mathematical Utilities

Authoritative schemas and transformation equations for ROMS terrain-following
generalized s-coordinates (Vtransform=1 Song & Haidvogel 1994, Vtransform=2 Shchepetkin & McWilliams 2005)
and vertical stretching formulations (Vstretching=1, 2, 4, 5).
"""

from enum import Enum
from typing import Any, List, Literal, Optional, Tuple, Union
import numpy as np
from pydantic import BaseModel, Field, field_validator, model_validator


class ROMSVtransformType(int, Enum):
    """ROMS vertical transformation equation formulation."""
    SONG_HAIDVOGEL_1994 = 1       # Vtransform = 1 (Song & Haidvogel 1994)
    SHCHEPETKIN_2005 = 2          # Vtransform = 2 (Shchepetkin & McWilliams 2005)


class ROMSVstretchingType(int, Enum):
    """ROMS vertical stretching function formulation."""
    SONG_HAIDVOGEL_1994 = 1       # Vstretching = 1 (Song & Haidvogel 1994)
    SHCHEPETKIN_2005 = 2          # Vstretching = 2 (Shchepetkin 2005)
    UCLA_2009 = 4                 # Vstretching = 4 (Shchepetkin 2005 / UCLA default)
    SOUZA_2015 = 5                # Vstretching = 5 (Souza 2015)


class ROMSFormulaTerms(BaseModel):
    """CF-compliant formula_terms metadata referencing standard variables in NetCDF."""
    s: str = Field(default="s_rho", description="Name of fractional vertical coordinate variable.")
    eta: str = Field(default="zeta", description="Name of free sea surface elevation variable.")
    depth: str = Field(default="h", description="Name of resting bathymetry variable.")
    a: Optional[str] = Field(default=None, description="Critical depth hc parameter variable or constant.")
    b: Optional[str] = Field(default=None, description="Stretching function Cs_r variable.")
    depth_c: Optional[str] = Field(default="hc", description="Critical depth hc parameter variable.")


class ROMSSCoordinateContract(BaseModel):
    """
    Authoritative scientific contract for ROMS generalized terrain-following s-coordinates.
    Encapsulates stretching parameters, grid layer counts, non-dimensional curves, and formula terms.
    """
    Vtransform: Literal[1, 2] = Field(
        default=2,
        description="Vertical transformation equation (1: Song & Haidvogel 1994, 2: Shchepetkin & McWilliams 2005)."
    )
    Vstretching: Literal[1, 2, 4, 5] = Field(
        default=4,
        description="Vertical stretching function (1: Song/Haidvogel, 2: Shchepetkin, 4: UCLA, 5: Souza)."
    )
    theta_s: float = Field(
        ...,
        ge=0.0,
        le=10.0,
        description="Surface stretching control parameter theta_s in [0.0, 10.0]."
    )
    theta_b: float = Field(
        ...,
        ge=0.0,
        le=4.0,
        description="Bottom stretching control parameter theta_b in [0.0, 4.0]."
    )
    hc: float = Field(
        ...,
        gt=0.0,
        description="Critical depth / thermocline scale parameter hc in meters (hc > 0.0)."
    )
    N: int = Field(
        ...,
        gt=0,
        description="Number of vertical terrain-following layers (N >= 1)."
    )
    s_rho: List[float] = Field(
        ...,
        description="Non-dimensional vertical coordinate at RHO points in [-1.0, 0.0]."
    )
    Cs_r: List[float] = Field(
        ...,
        description="Non-dimensional stretching function C(s) at RHO points in [-1.0, 0.0]."
    )
    s_w: Optional[List[float]] = Field(
        default=None,
        description="Non-dimensional vertical coordinate at W points in [-1.0, 0.0]."
    )
    Cs_w: Optional[List[float]] = Field(
        default=None,
        description="Non-dimensional stretching function C(s) at W points in [-1.0, 0.0]."
    )
    formula_terms: Optional[ROMSFormulaTerms] = Field(
        default_factory=ROMSFormulaTerms,
        description="CF standard formula_terms mapping for ocean_s_coordinate."
    )

    @model_validator(mode="after")
    def validate_roms_arrays(self) -> "ROMSSCoordinateContract":
        if len(self.s_rho) != self.N:
            raise ValueError(f"s_rho length ({len(self.s_rho)}) must equal N ({self.N}).")
        if len(self.Cs_r) != self.N:
            raise ValueError(f"Cs_r length ({len(self.Cs_r)}) must equal N ({self.N}).")
        if any(s < -1.0001 or s > 0.0001 for s in self.s_rho):
            raise ValueError("All s_rho values must reside within [-1.0, 0.0].")
        if any(c < -1.0001 or c > 0.0001 for c in self.Cs_r):
            raise ValueError("All Cs_r values must reside within [-1.0, 0.0].")
        if self.s_w is not None and len(self.s_w) != self.N + 1:
            raise ValueError(f"s_w length ({len(self.s_w)}) must equal N+1 ({self.N + 1}).")
        if self.Cs_w is not None and len(self.Cs_w) != self.N + 1:
            raise ValueError(f"Cs_w length ({len(self.Cs_w)}) must equal N+1 ({self.N + 1}).")
        return self


# ---------------------------------------------------------------------------
# Mathematical Transformation Utilities
# ---------------------------------------------------------------------------

def compute_roms_stretching(
    N: int,
    theta_s: float,
    theta_b: float,
    vstretching: int = 4,
    grid_type: Literal["rho", "w"] = "rho"
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Computes non-dimensional vertical coordinates s and stretching curve C(s)
    for RHO points (size N) or W points (size N+1).
    """
    if grid_type == "rho":
        k = np.arange(N, dtype=np.float64)
        s = (k - N + 0.5) / float(N)
    elif grid_type == "w":
        k = np.arange(N + 1, dtype=np.float64)
        s = (k - N) / float(N)
    else:
        raise ValueError(f"Invalid grid_type '{grid_type}', must be 'rho' or 'w'.")

    if vstretching == 1:
        # Song and Haidvogel (1994)
        if theta_s > 0.0:
            c_sur = np.sinh(theta_s * s) / np.sinh(theta_s)
            c_bot = (np.tanh(theta_s * (s + 0.5)) - np.tanh(0.5 * theta_s)) / (2.0 * np.tanh(0.5 * theta_s))
            Cs = (1.0 - theta_b) * c_sur + theta_b * c_bot
        else:
            Cs = s
    elif vstretching == 2:
        # A. Shchepetkin (2005)
        if theta_s > 0.0:
            c_sur = (1.0 - np.cosh(theta_s * s)) / (np.cosh(theta_s) - 1.0)
        else:
            c_sur = -s ** 2
        if theta_b > 0.0:
            c_bot = (np.exp(theta_b * c_sur) - 1.0) / (1.0 - np.exp(-theta_b))
            Cs = c_bot
        else:
            Cs = c_sur
    elif vstretching == 4:
        # Shchepetkin (2005) default / UCLA
        if theta_s > 0.0:
            c_sur = (1.0 - np.cosh(theta_s * s)) / (np.cosh(theta_s) - 1.0)
        else:
            c_sur = -s ** 2
        if theta_b > 0.0:
            c_bot = (np.exp(theta_b * c_sur) - 1.0) / (1.0 - np.exp(-theta_b))
            Cs = (np.exp(theta_s * c_bot) - 1.0) / (1.0 - np.exp(-theta_s))
        else:
            Cs = c_sur
    elif vstretching == 5:
        # Souza (2015)
        if theta_s > 0.0:
            c_sur = (1.0 - np.cosh(theta_s * s)) / (np.cosh(theta_s) - 1.0)
        else:
            c_sur = -s ** 2
        if theta_b > 0.0:
            c_bot = (np.exp(theta_b * c_sur) - 1.0) / (1.0 - np.exp(-theta_b))
            Cs = c_bot
        else:
            Cs = c_sur
    else:
        # Linear fallback
        Cs = s

    return s, Cs


def compute_roms_depths(
    h: Union[float, np.ndarray],
    zeta: Union[float, np.ndarray],
    N: int = 32,
    theta_s: float = 6.0,
    theta_b: float = 0.4,
    hc: float = 100.0,
    vtransform: int = 2,
    vstretching: int = 4,
    grid_type: Literal["rho", "w"] = "rho"
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Computes 3D/1D vertical physical depths z in meters (z < 0 below sea surface)
    for given bathymetry h (m, positive down) and free-surface zeta (m, positive up).

    Returns:
    - s: non-dimensional coordinate array (length N for rho, N+1 for w)
    - Cs: stretching curve array
    - z: physical depth array with shape (N, ...) or (N+1, ...)
    """
    s, Cs = compute_roms_stretching(
        N=N,
        theta_s=theta_s,
        theta_b=theta_b,
        vstretching=vstretching,
        grid_type=grid_type
    )

    h_arr = np.asarray(h, dtype=np.float64)
    zeta_arr = np.asarray(zeta, dtype=np.float64)
    n_levels = len(s)

    if vtransform == 1:
        # Song and Haidvogel (1994)
        # S(s) = hc * s + (h - hc) * C(s)
        # z(s) = S(s) + zeta * (1 + S(s) / h)
        # hc is bounded by min(h) in practice
        hc_eff = np.minimum(hc, h_arr)
        z = np.empty((n_levels,) + h_arr.shape, dtype=np.float64)
        for k in range(n_levels):
            S_k = hc_eff * s[k] + (h_arr - hc_eff) * Cs[k]
            with np.errstate(divide="ignore", invalid="ignore"):
                ratio = np.where(h_arr > 0, S_k / h_arr, 0.0)
            z[k] = S_k + zeta_arr * (1.0 + ratio)

    elif vtransform == 2:
        # Shchepetkin and McWilliams (2005)
        # S0(s) = (hc * s + h * C(s)) / (hc + h)
        # z(s) = zeta + (zeta + h) * S0(s)
        z = np.empty((n_levels,) + h_arr.shape, dtype=np.float64)
        for k in range(n_levels):
            S0_k = (hc * s[k] + h_arr * Cs[k]) / (hc + h_arr)
            z[k] = zeta_arr + (zeta_arr + h_arr) * S0_k

    else:
        raise ValueError(f"Unsupported ROMS Vtransform: {vtransform}. Must be 1 or 2.")

    # Flatten if input was scalar
    if h_arr.ndim == 0 and zeta_arr.ndim == 0:
        z = z.squeeze()

    return s, Cs, z
