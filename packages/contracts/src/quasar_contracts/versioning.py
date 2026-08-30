"""
QuasarOS Schema Versioning & Change Classification Module

Defines semantic versioning, schema version metadata, and backward/forward compatibility rules.
Change classifications:
- PATCH: Non-breaking additions (e.g. metadata description updates, added documentation)
- ADDITIVE: Backwards-compatible feature additions (e.g. optional fields, new enum variants)
- BREAKING: Non-backwards-compatible schema changes (e.g. field removals, renamed fields, altered types)
"""

import re
from enum import Enum
from typing import Tuple
from pydantic import BaseModel, Field, field_validator


SEMVER_REGEX = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)


class ChangeClassification(str, Enum):
    """Classification of changes between canonical schema versions."""
    PATCH = "PATCH"
    ADDITIVE = "ADDITIVE"
    BREAKING = "BREAKING"


def parse_semver(version_str: str) -> Tuple[int, int, int]:
    """Parse a semantic version string into (major, minor, patch)."""
    match = SEMVER_REGEX.match(version_str.strip())
    if not match:
        raise ValueError(f"Invalid semantic version string: '{version_str}'")
    major = int(match.group(1))
    minor = int(match.group(2))
    patch = int(match.group(3))
    return (major, minor, patch)


def is_backwards_compatible(current_version: str, target_version: str) -> bool:
    """
    Check if current_version is backward-compatible with target_version.
    In SemVer:
    - Major versions must match (unless major is 0).
    - current_version must be >= target_version.
    """
    cur_maj, cur_min, cur_pat = parse_semver(current_version)
    tgt_maj, tgt_min, tgt_pat = parse_semver(target_version)

    if cur_maj != tgt_maj:
        return False
    
    if (cur_maj, cur_min, cur_pat) < (tgt_maj, tgt_min, tgt_pat):
        return False

    return True


def classify_schema_change(old_version: str, new_version: str) -> ChangeClassification:
    """Classify the change level between two semantic versions."""
    old_maj, old_min, old_pat = parse_semver(old_version)
    new_maj, new_min, new_pat = parse_semver(new_version)

    if new_maj > old_maj:
        return ChangeClassification.BREAKING
    elif new_min > old_min:
        return ChangeClassification.ADDITIVE
    elif new_pat > old_pat:
        return ChangeClassification.PATCH
    elif (new_maj, new_min, new_pat) == (old_maj, old_min, old_pat):
        return ChangeClassification.PATCH
    else:
        return ChangeClassification.BREAKING


class SchemaVersionMetadata(BaseModel):
    """Metadata tracking schema version and compatibility classification."""
    schema_version: str = Field(
        default="1.0.0",
        description="Authoritative semantic version of this canonical contract."
    )
    min_compatible_version: str = Field(
        default="1.0.0",
        description="Minimum client / reader schema version required to deserialize this contract."
    )
    change_classification: ChangeClassification = Field(
        default=ChangeClassification.PATCH,
        description="Change classification relative to preceding schema iteration."
    )
    schema_target: str = Field(
        default="QuasarOS Canonical Scientific Schema",
        description="Target domain and scope of the schema."
    )

    @field_validator("schema_version", "min_compatible_version")
    @classmethod
    def validate_semver(cls, v: str) -> str:
        if not SEMVER_REGEX.match(v.strip()):
            raise ValueError(f"Version string '{v}' violates SemVer 2.0.0 format.")
        return v.strip()

    def check_compatibility(self, reader_version: str) -> bool:
        """Verify if a reader at reader_version can safely process this contract."""
        return is_backwards_compatible(reader_version, self.min_compatible_version)
