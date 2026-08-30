"""
QuasarOS Time & Forecast Semantics Contracts

Defines formal temporal contracts distinguishing model reference time, forecast lead time,
valid time, observation time, climatology periods, and CF calendars.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class CalendarType(str, Enum):
    """CF-compliant calendar taxonomy."""
    gregorian = "gregorian"
    standard = "standard"
    proleptic_gregorian = "proleptic_gregorian"
    julian = "julian"
    noleap = "noleap"
    _360_day = "360_day"
    all_leap = "all_leap"


def parse_iso_utc(time_str: str) -> datetime:
    """Parse an ISO 8601 string into a timezone-aware UTC datetime."""
    clean = time_str.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(clean)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class TimeSemanticsContract(BaseModel):
    """Authoritative time and forecast semantics specification."""
    calendar: CalendarType = Field(
        default=CalendarType.gregorian,
        description="Underlying CF calendar type."
    )
    reference_time_utc: Optional[str] = Field(
        default=None,
        description="Forecast analysis / model cycle initialization time (ISO 8601 UTC e.g. '2026-08-30T00:00:00Z')."
    )
    valid_time_utc: str = Field(
        ...,
        description="Authoritative physical valid time of the field state (ISO 8601 UTC)."
    )
    lead_time_seconds: Optional[int] = Field(
        default=None,
        ge=0,
        description="Forecast lead time offset tau in seconds (>= 0)."
    )
    observation_time_utc: Optional[str] = Field(
        default=None,
        description="Exact in-situ measurement or satellite pass timestamp (ISO 8601 UTC)."
    )
    climatology_period: Optional[str] = Field(
        default=None,
        description="Climatological baseline period description (e.g. '1991-2020 August decadal mean')."
    )
    timestep_index: int = Field(
        default=0,
        ge=0,
        description="Zero-based timestep index in the temporal sequence."
    )
    time_bounds_utc: Optional[List[str]] = Field(
        default=None,
        description="[start_time_utc, end_time_utc] interval bounds for time-averaged data (e.g. daily mean)."
    )
    source_time_string: Optional[str] = Field(
        default=None,
        description="Original provider time encoding string (e.g. 'hours since 1950-01-01 00:00:00')."
    )

    @field_validator("valid_time_utc", "reference_time_utc", "observation_time_utc")
    @classmethod
    def validate_utc_timestamps(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                parse_iso_utc(v)
            except Exception as e:
                raise ValueError(f"Timestamp '{v}' is not a valid ISO 8601 UTC string: {e}")
        return v

    @model_validator(mode="after")
    def validate_forecast_temporal_relation(self) -> "TimeSemanticsContract":
        if self.reference_time_utc is not None and self.lead_time_seconds is not None:
            ref_dt = parse_iso_utc(self.reference_time_utc)
            val_dt = parse_iso_utc(self.valid_time_utc)
            calculated_val_dt = datetime.fromtimestamp(ref_dt.timestamp() + self.lead_time_seconds, tz=timezone.utc)
            
            # Allow up to 1 second float discrepancy
            if abs((val_dt - calculated_val_dt).total_seconds()) > 1.0:
                raise ValueError(
                    f"Temporal inconsistency: valid_time_utc ({self.valid_time_utc}) does not match "
                    f"reference_time_utc ({self.reference_time_utc}) + lead_time_seconds ({self.lead_time_seconds}s). "
                    f"Expected: {calculated_val_dt.isoformat()}"
                )
        return self
