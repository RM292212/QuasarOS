"""
QuasarOS Model & Forecast Specialized Contracts

Defines formal contracts for numerical ocean hydrodynamic models, operational forecast
cycles, reanalysis and hindcast products, HYCOM output classification (native hybrid
isopycnal-sigma-z vs served standard depth z-levels), and land/wet-dry model masks.
"""

from enum import Enum
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from quasar_contracts.data_class import OperationalStatus
from quasar_contracts.time_semantics import CalendarType, parse_iso_utc


class ModelClass(str, Enum):
    """Hydrodynamic ocean model architecture classification."""
    ROMS = "ROMS"                 # Regional Ocean Modeling System (s-coordinate terrain-following)
    HYCOM = "HYCOM"               # Hybrid Coordinate Ocean Model (isopycnal/sigma/z-level)
    MOM = "MOM"                   # Modular Ocean Model (GFDL z-level / z-star)
    NEMO = "NEMO"                 # Nucleus for European Modelling of the Ocean (z-star / partial step)
    WW3 = "WW3"                   # WAVEWATCH III spectral wave model
    WAM = "WAM"                   # Wave Model (ECMWF / Copernicus WAM)
    MIKE21 = "MIKE21"             # DHI MIKE 21 SW spectral wave model
    UNSPECIFIED = "unspecified"


class ModelRunType(str, Enum):
    """Operational simulation cycle type."""
    forecast = "forecast"         # Forward operational forecast with lead time offsets
    reanalysis = "reanalysis"     # Historical data assimilation reanalysis
    hindcast = "hindcast"         # Historical simulation driven by historical forcing
    analysis = "analysis"         # Zero-lead analysis / nowcast assimilation state
    climatology = "climatology"   # Climatological baseline / normal


class HYCOMVerticalRepresentation(str, Enum):
    """HYCOM vertical coordinate output classification."""
    served_z_level = "served_z_level"          # Standard depth interpolated levels (e.g. 40 standard depth levels on OPeNDAP)
    native_hybrid = "native_hybrid"            # Native 41-layer hybrid isopycnal / sigma / pressure / z-level representation
    surface_2d = "surface_2d"                  # 2D diagnostic surface fields (SSH, surface currents, MLD)


class ModelMaskContract(BaseModel):
    """Model land-sea mask and wet/dry boundary definitions."""
    has_land_mask: bool = Field(default=True, description="Whether static land-sea mask is present.")
    has_dynamic_wetting_drying: bool = Field(default=False, description="Whether dynamic wetting and drying is simulated.")
    mask_variable_name: Optional[str] = Field(default=None, description="Name of mask variable in raw dataset (e.g. 'mask_rho', 'land_mask').")
    land_value: float = Field(default=0.0, description="Numerical value representing dry land cells.")
    sea_value: float = Field(default=1.0, description="Numerical value representing active water cells.")
    wet_dry_threshold_meters: Optional[float] = Field(default=None, description="Critical water depth threshold in meters for wet/dry activation.")


class ForecastCycleContract(BaseModel):
    """Authoritative operational model forecast cycle contract."""
    model_class: ModelClass = Field(..., description="Underlying hydrodynamic model family.")
    run_type: ModelRunType = Field(..., description="Operational run mode (forecast, reanalysis, hindcast, etc.).")
    cycle_reference_time_utc: str = Field(..., description="Model initialization / cycle reference time T_ref (ISO 8601 UTC).")
    valid_time_utc: str = Field(..., description="Physical validity time T_valid (ISO 8601 UTC).")
    lead_time_hours: float = Field(..., ge=0.0, description="Forecast lead time offset tau in hours (tau = T_valid - T_ref >= 0).")
    forecast_horizon_hours: Optional[float] = Field(default=None, ge=0.0, description="Maximum operational forecast horizon in hours (e.g. 120h / 5 days).")
    assimilation_method: Optional[str] = Field(default=None, description="Data assimilation scheme (e.g. '3DVar', '4DVar', 'EnOI', 'NCODA').")
    ensemble_member_id: Optional[str] = Field(default=None, description="Ensemble member identifier if ensemble run (e.g. 'ctrl', 'mem01').")

    @field_validator("cycle_reference_time_utc", "valid_time_utc")
    @classmethod
    def validate_utc_iso(cls, v: str) -> str:
        try:
            parse_iso_utc(v)
        except Exception as e:
            raise ValueError(f"Invalid ISO 8601 UTC timestamp: {v}, error: {e}")
        return v

    @model_validator(mode="after")
    def validate_lead_time_consistency(self) -> "ForecastCycleContract":
        ref_dt = parse_iso_utc(self.cycle_reference_time_utc)
        val_dt = parse_iso_utc(self.valid_time_utc)
        expected_diff_hours = (val_dt - ref_dt).total_seconds() / 3600.0
        
        # Allow tolerance of up to 1 minute (0.0167 hours)
        if abs(expected_diff_hours - self.lead_time_hours) > 0.02:
            raise ValueError(
                f"Lead time mismatch: valid_time ({self.valid_time_utc}) - cycle_reference_time ({self.cycle_reference_time_utc}) "
                f"= {expected_diff_hours:.3f}h, but lead_time_hours is declared as {self.lead_time_hours}h."
            )
        return self


class HYCOMModelContract(BaseModel):
    """
    Specialized contract for HYCOM (Hybrid Coordinate Ocean Model) datasets.
    Distinguishes OPeNDAP-served z-levels vs native hybrid coordinate layers.
    """
    vertical_representation: HYCOMVerticalRepresentation = Field(
        ...,
        description="Classification of vertical coordinate output structure."
    )
    experiment_id: str = Field(
        ...,
        description="HYCOM operational experiment ID (e.g. 'GLBy0.08/expt_93.0', 'ESPC-D-V02', 'GOFS3.1')."
    )
    native_layer_count: int = Field(
        default=41,
        ge=1,
        description="Number of vertical coordinate layers in native hybrid system (default 41 for modern GOFS/ESPC)."
    )
    served_depth_levels_count: Optional[int] = Field(
        default=None,
        ge=1,
        description="Number of standard depth levels if served as interpolated z-levels (e.g. 40 levels)."
    )
    surface_salinity_reference: float = Field(
        default=35.0,
        description="Reference salinity for equation of state."
    )
    uses_fast_thermodynamics: bool = Field(
        default=True,
        description="Indicates whether 17-term polynomial equation of state is employed."
    )


class OceanHydrodynamicModelContract(BaseModel):
    """
    Comprehensive authoritative contract for general ocean hydrodynamic models.
    """
    model_name: str = Field(..., description="Operational model name (e.g. 'INCOIS-BioROMS', 'HYCOM-ESPC-D-V02', 'CMEMS-GLOBAL-ANALYSIS-FORECAST-PHY-001-024').")
    model_class: ModelClass = Field(..., description="Underlying model numerical architecture.")
    operational_status: OperationalStatus = Field(default=OperationalStatus.OPERATIONAL, description="Operational service status.")
    forecast_cycle: Optional[ForecastCycleContract] = Field(default=None, description="Forecast cycle timing parameters if operational forecast.")
    hycom_metadata: Optional[HYCOMModelContract] = Field(default=None, description="HYCOM-specific vertical coordinate metadata.")
    mask_contract: Optional[ModelMaskContract] = Field(default_factory=ModelMaskContract, description="Model land/sea masking contract.")
    atmospheric_forcing_source: Optional[str] = Field(default=None, description="Source of atmospheric forcing (e.g. 'ECMWF IFS 0.1 deg', 'GFS 0.25 deg', 'NCMRWF Unified Model').")
    tidal_forcing_included: bool = Field(default=False, description="Whether explicit tidal constituent forcing is applied.")
    bathymetry_source: Optional[str] = Field(default=None, description="Source of model bathymetry (e.g. 'GEBCO 2024', 'ETOPO 2022', 'SRTM30_PLUS').")
