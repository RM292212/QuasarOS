"""
QuasarOS Duplicate & Collocation Relationship Contracts (TASK-02D)

Defines authoritative models for cross-dataset duplicate identification,
provider mirrors, raw vs adjusted relationships, and deduplication confidence scoring.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class DuplicateRelationshipType(str, Enum):
    """Classification of duplicate or mirror relationships between observation records."""
    EXACT_MIRROR = "exact_mirror"  # Bit-for-bit or numerically identical data from alternate mirrors/GDACs
    PROVIDER_MIRROR = "provider_mirror"  # Same data mirrored by different national DACs (e.g. INCOIS DAC vs Coriolis GDAC)
    PROBABLE_DUPLICATE = "probable_duplicate"  # Close spatio-temporal match (< 1km, < 1hr) from same or different platform
    SAME_PLATFORM_DIFFERENT_PROCESSING = "same_platform_different_processing"  # Real-time 'R' vs Delayed-mode 'D' versions of the same cast
    RAW_AND_ADJUSTED_PAIR = "raw_and_adjusted_pair"  # Raw vs Adjusted variable channels within or across files
    DISTINCT_OBSERVATION = "distinct_observation"  # Confirmed distinct observation


class DeduplicationResolution(str, Enum):
    """Policy action for handling duplicates during ingestion and rendering."""
    PREFER_PRIMARY = "prefer_primary"  # Keep primary (e.g. authoritative provider or higher processing level)
    PREFER_SECONDARY = "prefer_secondary"
    MERGE_PROVENANCE = "merge_provenance"  # Combine lineage and store reference to mirror
    REJECT_DUPLICATE = "reject_duplicate"  # Drop duplicate completely
    RETAIN_BOTH = "retain_both"  # Keep both with explicit cross-link


class DuplicateRelationshipContract(BaseModel):
    """
    Authoritative relationship contract between two observation records (e.g. profiles or trajectories).
    Quantifies spatio-temporal delta, relationship type, and match confidence score.
    """
    relationship_id: str = Field(
        ...,
        description="Unique identifier for this duplicate match relation."
    )
    primary_record_id: str = Field(
        ...,
        description="Identifier of the primary authoritative record (e.g. 'incois_argo_7902250_042_D')."
    )
    secondary_record_id: str = Field(
        ...,
        description="Identifier of the duplicate or secondary candidate record (e.g. 'coriolis_argo_7902250_042_R')."
    )
    relationship_type: DuplicateRelationshipType = Field(
        ...,
        description="Classification of the relationship."
    )
    spatial_distance_km: float = Field(
        ...,
        ge=0.0,
        description="Calculated great-circle spatial separation in kilometers."
    )
    time_delta_seconds: float = Field(
        ...,
        ge=0.0,
        description="Absolute time difference between the two observations in seconds."
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Calculated match confidence score in range [0.0, 1.0]."
    )
    recommended_resolution: DeduplicationResolution = Field(
        default=DeduplicationResolution.PREFER_PRIMARY,
        description="Recommended resolution strategy for data ingestion and rendering."
    )
    resolution_rationale: str = Field(
        ...,
        description="Human-readable scientific rationale for the classification and resolution."
    )
    matching_criteria: List[str] = Field(
        default_factory=list,
        description="List of criteria that matched (e.g. 'wmo_id_match', 'cycle_number_match', 'exact_timestamp_match', 'identical_profile_checksum')."
    )

    @field_validator("confidence_score")
    @classmethod
    def validate_confidence_for_exact(cls, v: float, info) -> float:
        rtype = info.data.get("relationship_type")
        if rtype == DuplicateRelationshipType.EXACT_MIRROR and v < 0.99:
            raise ValueError(f"Confidence score for exact_mirror must be >= 0.99, got {v}")
        return v
