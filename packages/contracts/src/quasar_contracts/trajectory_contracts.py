"""
QuasarOS Trajectory Contracts (TASK-02D)

Defines authoritative metadata models for continuous in-situ moving platforms,
specifically underwater gliders (yo-yo dive profiles), surface drifters, and ship transects.
Supports trajectory sample points, dive segmentation, and linkage to discrete vertical profile casts.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

from quasar_contracts.platform_contracts import PlatformType
from quasar_contracts.profile_contracts import ProfileDirection, ProfileCastContract


class TrajectoryPhase(str, Enum):
    """Phase of an autonomous underwater glider dive cycle."""
    SURFACE_DRIFT = "surface_drift"
    DIVE = "dive"        # Descending limb of yo-yo
    CLIMB = "climb"      # Ascending limb of yo-yo
    APOGEE = "apogee"    # Inflection point at max depth
    INFLECTION = "inflection"
    UNKNOWN = "unknown"


class TrajectoryWaypoint(BaseModel):
    """Individual spatio-temporal sample point along a trajectory track."""
    timestamp_utc: str = Field(
        ...,
        description="ISO 8601 UTC timestamp of sample."
    )
    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Latitude in degrees North."
    )
    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Longitude in degrees East."
    )
    depth_m: Optional[float] = Field(
        default=None,
        description="Depth in meters (positive down)."
    )
    pressure_dbar: Optional[float] = Field(
        default=None,
        description="Pressure in dbar."
    )
    phase: TrajectoryPhase = Field(
        default=TrajectoryPhase.UNKNOWN,
        description="Trajectory flight phase."
    )
    dive_number: Optional[int] = Field(
        default=None,
        description="Associated glider dive / cycle index."
    )


class DiveSegment(BaseModel):
    """
    Metadata for a single glider dive segment (one descending limb or ascending limb of a yo-yo pattern).
    Links continuous trajectory time-series to discrete profile casts.
    """
    dive_id: str = Field(
        ...,
        description="Unique identifier for this dive segment (e.g. 'ru29_dive_012_down')."
    )
    dive_number: int = Field(
        ...,
        ge=0,
        description="Glider dive cycle index."
    )
    direction: ProfileDirection = Field(
        ...,
        description="Descending ('D' for dive) or Ascending ('A' for climb)."
    )
    start_time_utc: str = Field(
        ...,
        description="Start timestamp of the dive limb."
    )
    end_time_utc: str = Field(
        ...,
        description="End timestamp of the dive limb."
    )
    start_latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Start latitude."
    )
    start_longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Start longitude."
    )
    end_latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="End latitude."
    )
    end_longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="End longitude."
    )
    max_depth_m: float = Field(
        ...,
        ge=0.0,
        description="Maximum depth reached during this segment in meters."
    )
    sample_count: int = Field(
        ...,
        ge=1,
        description="Number of sample points in this segment."
    )
    associated_profile_id: Optional[str] = Field(
        default=None,
        description="Identifier of the synthesized ProfileCastContract derived from this segment."
    )


class TrajectoryContract(BaseModel):
    """
    Authoritative scientific contract for an in-situ trajectory mission (e.g. RU29 glider transect).
    Includes platform metadata, spatio-temporal mission bounds, waypoints, and discrete dive segmentation.
    """
    trajectory_id: str = Field(
        ...,
        description="Canonical unique identifier for the trajectory (e.g. 'glider_ru29_mission_2025')."
    )
    platform_id: str = Field(
        ...,
        description="Platform identifier (e.g. 'glider_ru29')."
    )
    platform_type: PlatformType = Field(
        default=PlatformType.UNDERWATER_GLIDER,
        description="Platform type classification."
    )
    mission_name: str = Field(
        ...,
        description="Name of the mission / scientific campaign."
    )
    start_time_utc: str = Field(
        ...,
        description="ISO 8601 UTC start of trajectory track."
    )
    end_time_utc: str = Field(
        ...,
        description="ISO 8601 UTC end of trajectory track."
    )
    min_latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Southernmost latitude bound."
    )
    max_latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Northernmost latitude bound."
    )
    min_longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Westernmost longitude bound."
    )
    max_longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Easternmost longitude bound."
    )
    total_waypoints_count: int = Field(
        ...,
        ge=0,
        description="Total count of trajectory sample points."
    )
    dive_segments: List[DiveSegment] = Field(
        default_factory=list,
        description="List of discrete dive / climb segments comprising the yo-yo mission."
    )
    variables_measured: List[str] = Field(
        ...,
        description="List of measured canonical variables along the track."
    )

    @field_validator("max_latitude")
    @classmethod
    def validate_lat_bounds(cls, v: float, info) -> float:
        min_lat = info.data.get("min_latitude")
        if min_lat is not None and v < min_lat:
            raise ValueError(f"max_latitude ({v}) cannot be less than min_latitude ({min_lat})")
        return v

    @field_validator("max_longitude")
    @classmethod
    def validate_lon_bounds(cls, v: float, info) -> float:
        min_lon = info.data.get("min_longitude")
        if min_lon is not None and v < min_lon:
            raise ValueError(f"max_longitude ({v}) cannot be less than min_longitude ({min_lon})")
        return v
