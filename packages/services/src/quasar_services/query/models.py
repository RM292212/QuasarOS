"""
QuasarOS Scientific Query Service Models and DTOs.

Defines Pydantic V2 models for exact value point queries, vertical profile cast queries,
and provisional GPU render pick reconciliation conforming to OpenAPI 3.1 & APIContracts.md.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from quasar_contracts.exact_value_contracts import (
    ExactValueQueryRequest,
    ExactValueQueryResponse,
    ProvisionalRenderPickResponse,
    SelectionInterpolationContract,
    SelectionMethod,
    TimeSelectorMode,
    VerticalSelectorType,
)
from quasar_contracts.missing_values import PhysicalCellState


class VerticalProfileQueryRequest(BaseModel):
    """
    Authoritative request contract for a vertical 1D profile column query across all depth levels.
    """
    dataset_id: str = Field(
        ...,
        description="Canonical dataset identifier (e.g. 'copernicus_phy_thetao')."
    )
    dataset_version: Optional[str] = Field(
        default="1.0.0",
        description="Semantic version of the dataset."
    )
    snapshot_id: Optional[str] = Field(
        default=None,
        description="Specific snapshot ID for reproducible queries."
    )
    variable_id: str = Field(
        ...,
        description="Canonical variable identifier (e.g. 'sea_water_potential_temperature')."
    )
    latitude_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Target latitude in degrees North [-90, 90]."
    )
    longitude_deg: float = Field(
        ...,
        ge=-180.0,
        le=360.0,
        description="Target longitude in degrees East [-180, 180] or [0, 360]."
    )
    target_time_utc: Optional[str] = Field(
        default=None,
        description="ISO 8601 UTC timestamp."
    )
    time_selector_mode: TimeSelectorMode = Field(
        default=TimeSelectorMode.EXACT_UTC_TIMESTAMP,
        description="Temporal selection mode."
    )
    selection_interpolation: SelectionInterpolationContract = Field(
        default_factory=SelectionInterpolationContract,
        description="Horizontal selection and interpolation policy."
    )
    requested_units: Optional[str] = Field(
        default=None,
        description="Preferred scientific units (if conversion requested)."
    )


class VerticalProfileLevelSample(BaseModel):
    """Single level measurement sample in a vertical profile cast."""
    level_index: int = Field(..., ge=0, description="0-based vertical grid index.")
    depth_m: float = Field(..., description="Physical depth in meters (positive downward).")
    scientific_value: Optional[float] = Field(
        default=None,
        description="Authoritative numerical value (null if cell state is missing/masked/below seafloor)."
    )
    value_state: PhysicalCellState = Field(
        default=PhysicalCellState.valid,
        description="Categorical validity state."
    )


class VerticalProfileQueryResponse(BaseModel):
    """
    Authoritative response contract for a vertical profile cast query across all native levels.
    """
    response_type: str = Field(
        default="authoritative_vertical_profile",
        description="Discriminator identifying this as an authoritative vertical profile."
    )
    dataset_id: str = Field(..., description="Canonical dataset identifier.")
    variable_id: str = Field(..., description="Canonical variable identifier.")
    canonical_units: str = Field(..., description="Scientific measurement units.")
    requested_latitude_deg: float = Field(..., description="Originally requested latitude.")
    requested_longitude_deg: float = Field(..., description="Originally requested longitude.")
    resolved_latitude_deg: float = Field(..., description="Actual resolved/evaluated latitude.")
    resolved_longitude_deg: float = Field(..., description="Actual resolved/evaluated longitude.")
    horizontal_distance_delta_km: float = Field(
        ...,
        description="Geodetic distance between requested and resolved horizontal location in kilometers."
    )
    resolved_time_utc: str = Field(..., description="Actual valid ISO 8601 UTC timestamp evaluated.")
    grid_index_evaluated: Optional[List[int]] = Field(
        default=None,
        description="Native [time_idx, lat_idx, lon_idx] array index evaluated."
    )
    selection_method_used: SelectionMethod = Field(
        default=SelectionMethod.NEAREST_NATIVE_SAMPLE,
        description="Selection method used for horizontal resolution."
    )
    total_levels: int = Field(..., ge=1, description="Total vertical depth levels evaluated.")
    valid_levels_count: int = Field(..., ge=0, description="Count of physically valid numeric levels.")
    samples: List[VerticalProfileLevelSample] = Field(
        ...,
        description="Ordered array of samples from sea surface to deepest level."
    )
    source_asset_id: str = Field(..., description="Immutable ID of underlying native NetCDF asset.")
    source_asset_sha256: str = Field(..., description="SHA-256 hash of the immutable source asset.")
    provenance_details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Lineage and processing details."
    )

    @field_validator("response_type")
    @classmethod
    def validate_discriminator(cls, v: str) -> str:
        if v != "authoritative_vertical_profile":
            raise ValueError("VerticalProfileQueryResponse must have response_type = 'authoritative_vertical_profile'")
        return v


class ReconcilePickRequest(BaseModel):
    """
    Request payload to reconcile a provisional GPU raymarch pick against authoritative native NetCDF ground truth.
    """
    provisional_pick: ProvisionalRenderPickResponse = Field(
        ...,
        description="The approximate GPU rendering pick received during 3D viewport raycast."
    )
    dataset_id: Optional[str] = Field(
        default=None,
        description="Dataset identifier override (if omitted, extracted from visual product metadata or default)."
    )
    variable_id: Optional[str] = Field(
        default=None,
        description="Variable identifier override (if omitted, extracted from visual product metadata or default)."
    )
    snapshot_id: Optional[str] = Field(
        default=None,
        description="Snapshot identifier override."
    )
    target_time_utc: Optional[str] = Field(
        default=None,
        description="Target UTC timestamp override."
    )
    latitude_deg: Optional[float] = Field(
        default=None,
        ge=-90.0,
        le=90.0,
        description="Explicit latitude coordinate (if omitted, mapped from world_ray_hit_position)."
    )
    longitude_deg: Optional[float] = Field(
        default=None,
        ge=-180.0,
        le=360.0,
        description="Explicit longitude coordinate (if omitted, mapped from world_ray_hit_position)."
    )
    depth_m: Optional[float] = Field(
        default=None,
        description="Explicit physical depth in meters (if omitted, mapped from world_ray_hit_position)."
    )
    selection_method: SelectionMethod = Field(
        default=SelectionMethod.NEAREST_NATIVE_SAMPLE,
        description="Selection method to use for authoritative ground truth."
    )


class ReconcilePickResponse(BaseModel):
    """
    Response contract reconciling approximate GPU texture sample against authoritative native NetCDF ground truth.
    """
    response_type: str = Field(
        default="authoritative_reconciled_pick",
        description="Discriminator identifying this as an authoritative reconciled pick."
    )
    provisional_value: float = Field(
        ...,
        description="Approximate scalar value sampled from GPU rendering texture."
    )
    provisional_lod_level: int = Field(
        ...,
        description="LOD level of the sampled brick."
    )
    estimated_sample_error_bound: float = Field(
        ...,
        description="Theoretical error bound based on texture quantization and LOD downsampling."
    )
    authoritative_response: ExactValueQueryResponse = Field(
        ...,
        description="Authoritative exact scientific response evaluated directly from native NetCDF source."
    )
    absolute_difference_delta: Optional[float] = Field(
        default=None,
        description="Absolute numerical error: |provisional_value - authoritative_scientific_value|."
    )
    relative_difference_percent: Optional[float] = Field(
        default=None,
        description="Relative error percentage: (|delta| / |exact|) * 100."
    )
    within_estimated_error_bound: Optional[bool] = Field(
        default=None,
        description="Whether the empirical difference is strictly within the estimated sample error bound."
    )
    reconciliation_notice: str = Field(
        default="PROVISIONAL PICK RECONCILED: Authoritative native NetCDF ground truth evaluated directly from immutable source.",
        description="Scientific reconciliation notice."
    )

    @field_validator("response_type")
    @classmethod
    def validate_discriminator(cls, v: str) -> str:
        if v != "authoritative_reconciled_pick":
            raise ValueError("ReconcilePickResponse must have response_type = 'authoritative_reconciled_pick'")
        return v
