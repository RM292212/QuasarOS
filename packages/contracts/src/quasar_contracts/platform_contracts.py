"""
QuasarOS Platform Contracts (TASK-02D)

Defines authoritative metadata models for observation platforms, including
profiling floats (Argo, BGC-Argo), underwater gliders, moorings/buoys, research vessels,
and fixed observation stations.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class PlatformType(str, Enum):
    """Taxonomy of ocean observation platform types."""
    ARGO_FLOAT = "argo_float"
    BGC_ARGO_FLOAT = "bgc_argo_float"
    UNDERWATER_GLIDER = "underwater_glider"
    MOORED_BUOY = "moored_buoy"
    DRIFTING_BUOY = "drifting_buoy"
    RESEARCH_VESSEL = "research_vessel"
    COASTAL_STATION = "coastal_station"
    AUTONOMOUS_SURFACE_VEHICLE = "autonomous_surface_vehicle"
    ANIMAL_BORNE_SENSOR = "animal_borne_sensor"
    SUBMERSIBLE = "submersible"
    CUSTOM = "custom"


class SensorMetadata(BaseModel):
    """Metadata describing a sensor payload mounted on an observation platform."""
    sensor_id: str = Field(
        ...,
        description="Unique identifier or serial number for this sensor."
    )
    sensor_model: str = Field(
        ...,
        description="Sensor model name (e.g. SBE41CP, Aanderaa 4330, Wetlabs ECO Puck)."
    )
    sensor_maker: Optional[str] = Field(
        default=None,
        description="Manufacturer name (e.g. Sea-Bird Scientific, Aanderaa, RBR)."
    )
    measured_variables: List[str] = Field(
        ...,
        description="List of canonical or source variable names measured by this sensor."
    )
    calibration_date: Optional[str] = Field(
        default=None,
        description="ISO 8601 UTC date string of the last calibration."
    )
    serial_number: Optional[str] = Field(
        default=None,
        description="Manufacturer serial number of the sensor unit."
    )


class PlatformMetadataContract(BaseModel):
    """
    Authoritative metadata contract for oceanographic observation platforms.
    Captures platform identifiers, WMO numbering, deployment history, telemetry, and sensor payload.
    """
    platform_id: str = Field(
        ...,
        description="Canonical unique platform identifier in QuasarOS (e.g. incois_argo_7902250, glider_ru29)."
    )
    platform_type: PlatformType = Field(
        ...,
        description="Standard classification of the observation platform."
    )
    wmo_id: Optional[str] = Field(
        default=None,
        description="World Meteorological Organization (WMO) numeric identifier (e.g. '7902250')."
    )
    platform_code: Optional[str] = Field(
        default=None,
        description="Platform manufacturer or institutional code / serial number."
    )
    institution: str = Field(
        ...,
        description="Deploying institution or lead scientific organization (e.g. 'INCOIS', 'Rutgers University', 'Coriolis')."
    )
    institution_country: Optional[str] = Field(
        default=None,
        description="Country of the responsible institution."
    )
    pi_name: Optional[str] = Field(
        default=None,
        description="Principal Investigator (PI) responsible for the platform and data stream."
    )
    project_name: Optional[str] = Field(
        default=None,
        description="Associated mission, research program or campaign (e.g. 'Argo India', 'Challenger Glider Mission')."
    )
    telemetry_type: Optional[str] = Field(
        default=None,
        description="Data transmission system (e.g. 'Iridium', 'Argos', 'Cellular')."
    )
    deployment_date_utc: Optional[str] = Field(
        default=None,
        description="ISO 8601 UTC timestamp of deployment."
    )
    deployment_latitude: Optional[float] = Field(
        default=None,
        description="Initial deployment latitude in degrees North [-90, 90]."
    )
    deployment_longitude: Optional[float] = Field(
        default=None,
        description="Initial deployment longitude in degrees East [-180, 180]."
    )
    sensors: List[SensorMetadata] = Field(
        default_factory=list,
        description="List of sensors installed on the platform."
    )
    is_active: bool = Field(
        default=True,
        description="Whether the platform is currently active and reporting observations."
    )

    @field_validator("wmo_id")
    @classmethod
    def validate_wmo_id(cls, v: Optional[str], info) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if not clean:
                return None
            platform_type = info.data.get("platform_type")
            if platform_type in (PlatformType.ARGO_FLOAT, PlatformType.BGC_ARGO_FLOAT):
                if not clean.isdigit() or len(clean) < 5 or len(clean) > 8:
                    raise ValueError(f"WMO ID for Argo profiling float must be 5 to 8 numeric digits, got '{v}'")
            else:
                # For non-Argo platforms (gliders, moorings, ships, buoys, coastal stations),
                # WMO or platform identifiers may be alphanumeric or numeric (e.g., 'RU29', 'RAMA-12', '46001').
                if len(clean) < 1 or len(clean) > 32:
                    raise ValueError(f"Platform identifier/WMO ID length must be between 1 and 32 characters, got '{v}'")
            return clean
        return None

    @field_validator("deployment_latitude")
    @classmethod
    def validate_lat(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-90.0 <= v <= 90.0):
            raise ValueError(f"deployment_latitude must be in range [-90, 90], got {v}")
        return v

    @field_validator("deployment_longitude")
    @classmethod
    def validate_lon(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (-180.0 <= v <= 180.0):
            raise ValueError(f"deployment_longitude must be in range [-180, 180], got {v}")
        return v
