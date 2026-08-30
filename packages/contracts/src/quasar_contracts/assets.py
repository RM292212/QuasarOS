"""
QuasarOS Immutable Source Asset Contract

Defines the contract for raw, intermediate, and canonical data assets,
mandating bitwise SHA-256 integrity verification and immutable provenance.
"""

import re
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


SHA256_HEX_REGEX = re.compile(r"^[a-f0-9]{64}$")


class AssetFormat(str, Enum):
    """Physical storage and serialization format of the asset."""
    netcdf4_classic = "netcdf4_classic"
    netcdf4_enhanced = "netcdf4_enhanced"
    netcdf3_64bit_offset = "netcdf3_64bit_offset"
    netcdf3_classic = "netcdf3_classic"
    parquet = "parquet"
    json_manifest = "json_manifest"
    zarr_v2 = "zarr_v2"
    zarr_v3 = "zarr_v3"
    geotiff = "geotiff"
    dhi_dfsu = "dhi_dfsu"
    dhi_dfs2 = "dhi_dfs2"


class ArtifactClassification(str, Enum):
    """Functional role of the artifact in the QuasarOS data architecture."""
    raw_source = "raw_source"
    intermediate_normalized = "intermediate_normalized"
    canonical_zarr = "canonical_zarr"
    rendering_brick = "rendering_brick"
    observation_index = "observation_index"
    metadata_manifest = "metadata_manifest"


class ImmutableSourceAsset(BaseModel):
    """Immutable asset record tracking raw or processed file on disk / storage."""
    asset_id: str = Field(
        ...,
        description="Unique identifier for this specific physical file or object."
    )
    dataset_id: str = Field(
        ...,
        description="Reference to the parent dataset identity."
    )
    provider_filename: str = Field(
        ...,
        description="Original authoritative filename as distributed by provider."
    )
    local_relative_path: str = Field(
        ...,
        description="Repository-relative or storage-relative path to the asset."
    )
    media_type: str = Field(
        ...,
        description="Standard MIME type (e.g. 'application/x-netcdf4', 'application/json')."
    )
    format: AssetFormat = Field(
        ...,
        description="Underlying serialization format."
    )
    artifact_classification: ArtifactClassification = Field(
        ...,
        description="Role of this asset in the scientific data plane."
    )
    size_bytes: int = Field(
        ...,
        gt=0,
        description="Exact bitwise file size in bytes (must be > 0)."
    )
    sha256_checksum: str = Field(
        ...,
        description="Bitwise SHA-256 hexadecimal checksum (64 lowercase hex characters)."
    )
    retrieval_timestamp_utc: str = Field(
        ...,
        description="ISO 8601 UTC timestamp recording exact acquisition time."
    )
    source_url: Optional[str] = Field(
        default=None,
        description="Direct upstream download or API endpoint URL where asset was fetched."
    )
    is_immutable: bool = Field(
        default=True,
        description="Flag certifying asset immutability. Overwriting is strictly prohibited."
    )

    @field_validator("sha256_checksum")
    @classmethod
    def validate_sha256(cls, v: str) -> str:
        clean = v.strip().lower()
        if not SHA256_HEX_REGEX.match(clean):
            raise ValueError(f"Checksum '{v}' is not a valid 64-character lowercase SHA-256 hexadecimal hash.")
        return clean
