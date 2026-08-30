"""
QuasarOS Exact-Value Scientific Query & Streaming Contracts (TASK-02E)

Establishes the strict boundary between provisional visual raymarching picks (approximate)
and authoritative scientific value queries, as well as chunk streaming envelopes.

Governance Rules:
- Rendered visual textures NEVER serve exact scientific queries.
- Discriminated responses: ProvisionalRenderPickResponse (`approximate_render_sample`)
  vs ExactValueQueryResponse (`authoritative_scientific_value`).
- Exact queries retain full provenance, source NetCDF/Zarr asset IDs and SHA-256 checksums,
  evaluated physical coordinates vs requested coordinates, and interpolation methods.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from quasar_contracts.missing_values import PhysicalCellState


class SelectionMethod(str, Enum):
    """Scientific coordinate resolution and selection method."""
    NEAREST_NATIVE_SAMPLE = "nearest_native_sample"
    EXACT_GRID_INDEX = "exact_grid_index"
    TRILINEAR_INTERPOLATION = "trilinear_interpolation"
    BILINEAR_HORIZONTAL_NEAREST_VERTICAL = "bilinear_horizontal_nearest_vertical"
    NATIVE_LEVEL_HORIZONTAL_INTERPOLATION = "native_level_horizontal_interpolation"


class VerticalSelectorType(str, Enum):
    """Vertical coordinate selection mode."""
    PHYSICAL_DEPTH_METERS = "physical_depth_meters"
    PRESSURE_DBAR = "pressure_dbar"
    GRID_LEVEL_INDEX = "grid_level_index"
    SEA_SURFACE = "sea_surface"
    SEA_FLOOR = "sea_floor"


class TimeSelectorMode(str, Enum):
    """Time selection mode."""
    EXACT_UTC_TIMESTAMP = "exact_utc_timestamp"
    NEAREST_AVAILABLE_TIMESTEP = "nearest_available_timestep"
    FORECAST_REFERENCE_AND_LEAD = "forecast_reference_and_lead"


class SelectionInterpolationContract(BaseModel):
    """
    Formal specification of mathematical selection and spatial/temporal interpolation methods.
    """
    method: SelectionMethod = Field(
        default=SelectionMethod.NEAREST_NATIVE_SAMPLE,
        description="Governing coordinate selection/interpolation algorithm."
    )
    allows_extrapolation: bool = Field(
        default=False,
        description="Whether extrapolation beyond the convex hull of valid native grid points is permitted."
    )
    max_horizontal_extrapolation_deg: float = Field(
        default=0.0,
        ge=0.0,
        description="Maximum allowed distance in degrees for horizontal extrapolation (0.0 = none)."
    )
    max_vertical_extrapolation_m: float = Field(
        default=0.0,
        ge=0.0,
        description="Maximum allowed vertical extrapolation in meters (0.0 = none)."
    )
    interpolation_weights_provenance: Optional[Dict[str, float]] = Field(
        default=None,
        description="Recorded weights of surrounding grid points used during interpolation."
    )


class ProvisionalRenderPickResponse(BaseModel):
    """
    Discriminator: 'approximate_render_sample'.
    Returned during live 3D viewport raycast hover/click interactions.
    Explicitly carries an approximation warning and error confidence bounds.
    """
    response_type: str = Field(
        default="approximate_render_sample",
        description="Discriminator identifying this as an approximate rendering texture sample."
    )
    visualization_product_id: str = Field(
        ...,
        description="ID of the visual product under the raycast cursor."
    )
    lod_level: int = Field(
        ...,
        description="LOD level of the sampled brick."
    )
    approximate_value: float = Field(
        ...,
        description="Value sampled from GPU texture or quantized buffer."
    )
    display_units: str = Field(
        ...,
        description="Display units corresponding to the current transfer function."
    )
    world_ray_hit_position: List[float] = Field(
        ...,
        description="[x, y, z] position in 3D Volume Lab world space where ray intersection occurred."
    )
    estimated_sample_error_bound: float = Field(
        ...,
        description="Theoretical error bound based on LOD downsampling and texture quantization."
    )
    approximation_notice: str = Field(
        default="PROVISIONAL VALUE: Interpolated from GPU rendering volume. Query /queries/value for authoritative scientific data.",
        description="Mandatory user-facing scientific notice."
    )

    @field_validator("response_type")
    @classmethod
    def validate_discriminator(cls, v: str) -> str:
        if v != "approximate_render_sample":
            raise ValueError("ProvisionalRenderPickResponse must have response_type = 'approximate_render_sample'")
        return v


class ExactValueQueryRequest(BaseModel):
    """
    Authoritative request contract for point or profile scientific queries.
    Bypasses visual GPU buffers and directly targets canonical gridded data.
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
        description="Specific snapshot ID for immutable reproducible queries."
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
    vertical_selector_type: VerticalSelectorType = Field(
        default=VerticalSelectorType.PHYSICAL_DEPTH_METERS,
        description="Mode of vertical coordinate specification."
    )
    vertical_target_value: Optional[float] = Field(
        default=0.0,
        description="Target vertical coordinate value (e.g. 50.0 meters depth, 100.0 dbar pressure, or level index)."
    )
    time_selector_mode: TimeSelectorMode = Field(
        default=TimeSelectorMode.EXACT_UTC_TIMESTAMP,
        description="Temporal selection mode."
    )
    target_time_utc: Optional[str] = Field(
        default=None,
        description="ISO 8601 UTC timestamp."
    )
    forecast_lead_time_seconds: Optional[int] = Field(
        default=None,
        description="Lead time seconds from cycle reference time if querying forecast cycle."
    )
    selection_interpolation: SelectionInterpolationContract = Field(
        default_factory=SelectionInterpolationContract,
        description="Interpolation policy and tolerances."
    )
    requested_units: Optional[str] = Field(
        default=None,
        description="Preferred scientific units (if conversion requested)."
    )


class ExactValueQueryResponse(BaseModel):
    """
    Discriminator: 'authoritative_scientific_value'.
    Authoritative scientific value resolved directly from source NetCDF / canonical Zarr arrays.
    Carries complete lineage, evaluated coordinates, and physical validity state.
    """
    response_type: str = Field(
        default="authoritative_scientific_value",
        description="Discriminator identifying this as an authoritative scientific evaluation."
    )
    dataset_id: str = Field(
        ...,
        description="Canonical dataset identifier."
    )
    variable_id: str = Field(
        ...,
        description="Canonical variable identifier."
    )
    scientific_value: Optional[float] = Field(
        default=None,
        description="Authoritative numerical value (null if cell state is missing/masked/outside domain)."
    )
    canonical_units: str = Field(
        ...,
        description="Scientific units of the returned value."
    )
    value_state: PhysicalCellState = Field(
        default=PhysicalCellState.valid,
        description="Validity state (valid, missing, masked, outside_domain, below_seafloor, rejected_by_qc)."
    )
    requested_latitude_deg: float = Field(
        ...,
        description="Originally requested latitude."
    )
    requested_longitude_deg: float = Field(
        ...,
        description="Originally requested longitude."
    )
    resolved_latitude_deg: float = Field(
        ...,
        description="Actual resolved/evaluated latitude."
    )
    resolved_longitude_deg: float = Field(
        ...,
        description="Actual resolved/evaluated longitude."
    )
    resolved_depth_m: Optional[float] = Field(
        default=None,
        description="Actual physical depth evaluated in meters."
    )
    resolved_time_utc: str = Field(
        ...,
        description="Actual valid ISO 8601 UTC timestamp evaluated."
    )
    grid_index_evaluated: Optional[List[int]] = Field(
        default=None,
        description="Discrete [time_idx, depth_idx, lat_idx, lon_idx] native array index evaluated."
    )
    selection_method_used: SelectionMethod = Field(
        default=SelectionMethod.NEAREST_NATIVE_SAMPLE,
        description="Mathematical selection/interpolation algorithm used."
    )
    source_asset_id: str = Field(
        ...,
        description="Immutable ID of the underlying NetCDF/Zarr asset from which the value was extracted."
    )
    source_asset_sha256: str = Field(
        ...,
        description="SHA-256 hash of the immutable source asset."
    )
    provenance_details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional lineage or computation details (e.g. TEOS-10 parameters if derived)."
    )

    @field_validator("response_type")
    @classmethod
    def validate_discriminator(cls, v: str) -> str:
        if v != "authoritative_scientific_value":
            raise ValueError("ExactValueQueryResponse must have response_type = 'authoritative_scientific_value'")
        return v


class StreamingChunkRequest(BaseModel):
    """
    Contract for requesting a batch of multiresolution sub-volume bricks
    for dynamic progressive raymarching streaming.
    """
    visualization_product_id: str = Field(
        ...,
        description="ID of the visual volume product."
    )
    lod_level: int = Field(
        ...,
        ge=0,
        description="LOD level requested."
    )
    timestep_index: int = Field(
        ...,
        ge=0,
        description="Temporal timestep index requested."
    )
    requested_brick_keys: List[str] = Field(
        ...,
        description="Array of deterministic brick composite keys requested."
    )
    priority: int = Field(
        default=1,
        ge=0,
        le=10,
        description="Request priority (10 = immediate camera frustum, 1 = speculative prefetch)."
    )


class StreamingManifestEntry(BaseModel):
    """Manifest item for a single streaming brick payload."""
    brick_key: str = Field(
        ...,
        description="Deterministic brick composite key."
    )
    storage_object_url: str = Field(
        ...,
        description="Relative or CDN URL path to download the compressed brick payload."
    )
    byte_offset: Optional[int] = Field(
        default=None,
        description="Byte range start if chunk is part of a bundled container."
    )
    byte_length: int = Field(
        ...,
        gt=0,
        description="Byte size of the chunk payload."
    )
    sha256_checksum: str = Field(
        ...,
        description="Payload SHA-256 checksum."
    )
    is_empty: bool = Field(
        default=False,
        description="If True, brick is completely empty/masked and does not need network transfer."
    )


class MultiBrickStreamingResponse(BaseModel):
    """
    Response contract delivering a manifest of available sub-volume bricks
    matching a StreamingChunkRequest.
    """
    visualization_product_id: str = Field(
        ...,
        description="Visual product identifier."
    )
    lod_level: int = Field(
        ...,
        description="LOD level."
    )
    timestep_index: int = Field(
        ...,
        description="Timestep index."
    )
    manifest_entries: List[StreamingManifestEntry] = Field(
        ...,
        description="List of manifest entries for all requested bricks."
    )
    total_payload_bytes: int = Field(
        ...,
        ge=0,
        description="Total transfer byte size across all non-empty bricks in this manifest."
    )
