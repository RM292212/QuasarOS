"""
QuasarOS Provenance & Lineage Tracking Contracts

Defines immutable lineage records capturing transformation operations, software versions,
input/output cryptographic hashes, and execution parameters.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LineageRecord(BaseModel):
    """Immutable provenance record connecting derived or normalized data to source assets."""
    lineage_id: str = Field(
        ...,
        description="Unique lineage identifier (UUID or hash)."
    )
    dataset_id: str = Field(
        ...,
        description="Dataset identifier associated with this transformation."
    )
    operation: str = Field(
        ...,
        description="Scientific or ingestion operation name (e.g. 'cf_normalization', 'teos10_density')."
    )
    software_name: str = Field(
        default="quasar_contracts",
        description="Name of software package or module executing the operation."
    )
    software_version: str = Field(
        default="1.0.0",
        description="Exact software version."
    )
    source_asset_ids: List[str] = Field(
        default_factory=list,
        description="List of input asset IDs consumed by the operation."
    )
    source_checksums: Dict[str, str] = Field(
        default_factory=dict,
        description="Cryptographic SHA-256 hashes of input assets at execution time."
    )
    target_asset_ids: List[str] = Field(
        default_factory=list,
        description="List of output asset IDs produced by the operation."
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Execution parameters, thresholds, and mathematical settings."
    )
    operator: str = Field(
        ...,
        description="Identity of the service, agent, or researcher initiating the transformation."
    )
    started_at_utc: str = Field(
        ...,
        description="ISO 8601 UTC timestamp of operation start."
    )
    completed_at_utc: str = Field(
        ...,
        description="ISO 8601 UTC timestamp of operation completion."
    )
    validation_passed: bool = Field(
        default=True,
        description="Whether post-operation validation checks succeeded."
    )
    comments: Optional[str] = Field(
        default=None,
        description="Additional scientific context or execution notes."
    )
