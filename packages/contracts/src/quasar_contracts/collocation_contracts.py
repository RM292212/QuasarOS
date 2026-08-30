"""
QuasarOS Collocation Readiness Contracts (TASK-02D)

Defines authoritative metadata models for validating observation-to-model collocation readiness,
pre-flight compatibility checks, spatial/temporal domain overlap, variable and unit matching,
and explicit blocking reason codes without performing runtime mathematical interpolation.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class CollocationBlockingReason(str, Enum):
    """Specific scientific reason codes preventing valid observation-to-model collocation."""
    OUTSIDE_SPATIAL_BOUNDS = "OUTSIDE_SPATIAL_BOUNDS"
    OUTSIDE_TEMPORAL_BOUNDS = "OUTSIDE_TEMPORAL_BOUNDS"
    INCOMPATIBLE_VERTICAL_DATUM = "INCOMPATIBLE_VERTICAL_DATUM"
    INCOMPATIBLE_PHYSICAL_QUANTITY = "INCOMPATIBLE_PHYSICAL_QUANTITY"
    UNIT_CONVERSION_BLOCKED = "UNIT_CONVERSION_BLOCKED"
    FAILED_OBSERVATION_QC = "FAILED_OBSERVATION_QC"
    MISSING_MODEL_GRID_INFORMATION = "MISSING_MODEL_GRID_INFORMATION"
    LAND_MASK_OCCLUSION = "LAND_MASK_OCCLUSION"
    EXCEEDS_MAX_TIME_WINDOW = "EXCEEDS_MAX_TIME_WINDOW"
    EXCEEDS_MAX_SPATIAL_RADIUS = "EXCEEDS_MAX_SPATIAL_RADIUS"
    NO_BLOCKING_REASON = "NO_BLOCKING_REASON"


class CollocationReadinessContract(BaseModel):
    """
    Authoritative contract defining whether an observation entity (profile or trajectory cast)
    can be scientifically collocated with a target 3D model volume or 2D grid field.
    """
    collocation_id: str = Field(
        ...,
        description="Unique identifier for this collocation readiness evaluation."
    )
    observation_id: str = Field(
        ...,
        description="Identifier of the observation entity (e.g. 'incois_argo_7902250_042_A')."
    )
    model_dataset_id: str = Field(
        ...,
        description="Identifier of the candidate model dataset (e.g. 'copernicus_phy_thetao')."
    )
    observation_variable: str = Field(
        ...,
        description="Observation variable name (e.g. 'TEMP' or 'sea_water_temperature')."
    )
    model_variable: str = Field(
        ...,
        description="Target model variable name (e.g. 'thetao' or 'sea_water_potential_temperature')."
    )
    is_collocation_ready: bool = Field(
        ...,
        description="True if all spatial, temporal, physical unit, and QC checks pass with zero blockers."
    )
    blocking_reasons: List[CollocationBlockingReason] = Field(
        default_factory=list,
        description="List of blocking reasons if is_collocation_ready is False. Empty or [NO_BLOCKING_REASON] if ready."
    )
    spatial_distance_to_model_domain_km: float = Field(
        default=0.0,
        ge=0.0,
        description="Distance from observation location to nearest model valid grid boundary (0 if inside)."
    )
    temporal_offset_seconds: float = Field(
        default=0.0,
        ge=0.0,
        description="Absolute time difference between observation timestamp and nearest model timestep in seconds."
    )
    max_allowed_time_window_seconds: float = Field(
        default=86400.0,
        ge=0.0,
        description="Configured maximum allowable temporal tolerance for collocation (e.g. 24 hours = 86400s)."
    )
    max_allowed_spatial_radius_km: float = Field(
        default=50.0,
        ge=0.0,
        description="Configured maximum allowable spatial search radius in kilometers."
    )
    unit_conversion_required: bool = Field(
        default=False,
        description="Whether a mathematical or affine unit conversion is required prior to comparison."
    )
    qc_passed: bool = Field(
        default=True,
        description="Whether the observation record satisfies minimum QC quality filters."
    )
    notes: Optional[str] = Field(
        default=None,
        description="Human-readable diagnostics or notes regarding the collocation readiness check."
    )

    @classmethod
    def evaluate_readiness(
        cls,
        collocation_id: str,
        observation_id: str,
        model_dataset_id: str,
        observation_variable: str,
        model_variable: str,
        is_inside_spatial_domain: bool,
        temporal_offset_seconds: float,
        max_allowed_time_window_seconds: float,
        qc_passed: bool,
        unit_compatible: bool,
        unit_conversion_required: bool = False,
        spatial_distance_km: float = 0.0,
        notes: Optional[str] = None,
    ) -> "CollocationReadinessContract":
        """
        Factory helper to compute collocation readiness and automatically populate blocking reasons.
        """
        blockers: List[CollocationBlockingReason] = []

        if not is_inside_spatial_domain:
            blockers.append(CollocationBlockingReason.OUTSIDE_SPATIAL_BOUNDS)
        if temporal_offset_seconds > max_allowed_time_window_seconds:
            blockers.append(CollocationBlockingReason.EXCEEDS_MAX_TIME_WINDOW)
        if not qc_passed:
            blockers.append(CollocationBlockingReason.FAILED_OBSERVATION_QC)
        if not unit_compatible:
            blockers.append(CollocationBlockingReason.UNIT_CONVERSION_BLOCKED)

        ready = (len(blockers) == 0)
        if ready:
            blockers = [CollocationBlockingReason.NO_BLOCKING_REASON]

        return cls(
            collocation_id=collocation_id,
            observation_id=observation_id,
            model_dataset_id=model_dataset_id,
            observation_variable=observation_variable,
            model_variable=model_variable,
            is_collocation_ready=ready,
            blocking_reasons=blockers,
            spatial_distance_to_model_domain_km=spatial_distance_km,
            temporal_offset_seconds=temporal_offset_seconds,
            max_allowed_time_window_seconds=max_allowed_time_window_seconds,
            unit_conversion_required=unit_conversion_required,
            qc_passed=qc_passed,
            notes=notes,
        )
