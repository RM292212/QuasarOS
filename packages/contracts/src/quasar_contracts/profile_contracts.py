"""
QuasarOS Profile Contracts (TASK-02D)

Defines authoritative metadata models for vertical observation profiles (Argo casts, CTD casts, XBT),
including cycle numbers, direction (Ascending/Descending), data modes ('R' Real-time, 'A' Adjusted, 'D' Delayed-mode),
raw vs adjusted variable references, and profile-level QC evaluation.
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from quasar_contracts.platform_contracts import PlatformType
from quasar_contracts.observation_qc import ObservationQCReport


class ProfileDirection(str, Enum):
    """Direction of profile cast sampling."""
    ASCENDING = "A"   # Float ascending to surface (standard Argo profile)
    DESCENDING = "D"  # Instrument descending (CTD downcast, glider dive)
    STATIONARY = "S"  # Mooring or fixed depth time-series


class DataMode(str, Enum):
    """
    Argo and oceanographic data processing mode.
    R: Real-Time mode (immediate transmission, automated QC only).
    A: Real-Time Adjusted mode (real-time data with sensor drift correction or automated adjustment applied).
    D: Delayed-Mode (expert scientific validation, rigorous calibration against climatology/reference data).
    """
    REAL_TIME = "R"
    ADJUSTED = "A"
    DELAYED = "D"


class ProfileVariableEntry(BaseModel):
    """
    Metadata describing an individual variable measured along a vertical profile,
    explicitly distinguishing raw vs adjusted variable references and units.
    """
    canonical_variable_id: str = Field(
        ...,
        description="Canonical variable identifier (e.g. 'sea_water_temperature', 'sea_water_salinity', 'dissolved_oxygen')."
    )
    raw_variable_name: str = Field(
        ...,
        description="Raw variable name in source file (e.g. 'TEMP', 'PSAL', 'DOXY')."
    )
    adjusted_variable_name: Optional[str] = Field(
        default=None,
        description="Adjusted variable name in source file if available (e.g. 'TEMP_ADJUSTED', 'PSAL_ADJUSTED')."
    )
    error_variable_name: Optional[str] = Field(
        default=None,
        description="Error/uncertainty variable name in source file (e.g. 'TEMP_ADJUSTED_ERROR')."
    )
    qc_variable_name: Optional[str] = Field(
        default=None,
        description="QC flag variable name in source file (e.g. 'TEMP_QC', 'TEMP_ADJUSTED_QC')."
    )
    units: str = Field(
        ...,
        description="Canonical measurement units (e.g. 'degree_Celsius', 'psu', 'micromole/kg')."
    )
    data_mode: DataMode = Field(
        default=DataMode.REAL_TIME,
        description="Data mode applied to this specific variable ('R', 'A', 'D')."
    )
    levels_count: int = Field(
        ...,
        ge=1,
        description="Number of measured vertical levels."
    )
    min_pressure_dbar: Optional[float] = Field(
        default=None,
        description="Shallowest measured pressure in dbar."
    )
    max_pressure_dbar: Optional[float] = Field(
        default=None,
        description="Deepest measured pressure in dbar."
    )
    has_adjusted_values: bool = Field(
        default=False,
        description="Whether adjusted values are present and should be preferred over raw data."
    )


class ProfileCastContract(BaseModel):
    """
    Authoritative scientific contract for an individual vertical observation cast / profile.
    Captures platform identity, cycle index, spatio-temporal coordinates, direction,
    data modes, raw/adjusted variable references, and QC report.
    """
    profile_id: str = Field(
        ...,
        description="Unique identifier for this profile cast (e.g. 'incois_argo_7902250_cycle_042_A')."
    )
    platform_id: str = Field(
        ...,
        description="Platform identifier (e.g. 'incois_argo_7902250')."
    )
    platform_type: PlatformType = Field(
        default=PlatformType.ARGO_FLOAT,
        description="Type of observation platform."
    )
    wmo_id: Optional[str] = Field(
        default=None,
        description="WMO float identifier."
    )
    cycle_number: int = Field(
        ...,
        ge=0,
        description="Observation cycle number / cast index (0-indexed or 1-indexed according to provider)."
    )
    direction: ProfileDirection = Field(
        default=ProfileDirection.ASCENDING,
        description="Ascending ('A') or Descending ('D') cast."
    )
    data_mode: DataMode = Field(
        default=DataMode.REAL_TIME,
        description="Overall profile data mode ('R', 'A', 'D')."
    )
    observation_time_utc: str = Field(
        ...,
        description="ISO 8601 UTC timestamp of profile observation."
    )
    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Profile latitude in degrees North [-90, 90]."
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Profile longitude in degrees East [-180, 180]."
    )
    position_qc: int = Field(
        default=1,
        description="Raw position QC flag (1=good, 2=probably good, 3=suspect, 4=bad)."
    )
    time_qc: int = Field(
        default=1,
        description="Raw time QC flag (1=good, 2=probably good, 3=suspect, 4=bad)."
    )
    max_depth_m: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Maximum physical depth reached in meters."
    )
    max_pressure_dbar: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Maximum pressure reached in dbar."
    )
    level_count: int = Field(
        ...,
        ge=1,
        description="Number of vertical levels sampled in the profile."
    )
    variables: Dict[str, ProfileVariableEntry] = Field(
        ...,
        description="Dictionary of measured variables keyed by canonical variable id."
    )
    qc_report: Optional[ObservationQCReport] = Field(
        default=None,
        description="Structured quality control report for this profile cast."
    )
    is_bgc: bool = Field(
        default=False,
        description="True if this cast contains Biogeochemical (BGC) variables (e.g. DOXY, CHLA, NITRATE, BBP700, PH_IN_SITU_TOTAL)."
    )

    @field_validator("variables")
    @classmethod
    def validate_variables_non_empty(cls, v: Dict[str, ProfileVariableEntry]) -> Dict[str, ProfileVariableEntry]:
        if not v:
            raise ValueError("Profile must contain at least one measured variable.")
        return v
