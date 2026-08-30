"""
QuasarOS Validation State & Gate Evaluation Contracts

Defines validation states, validation check results, and publication-ready evaluation.
"""

from enum import Enum
from typing import List, Literal
from pydantic import BaseModel, Field, computed_field


class ValidationState(str, Enum):
    """Lifecycle validation status of a dataset or canonical product."""
    valid = "valid"
    valid_with_warnings = "valid_with_warnings"
    invalid = "invalid"
    catalog_only = "catalog_only"
    discovery_only = "discovery_only"
    blocked = "blocked"


class ValidationCheckResult(BaseModel):
    """Result of an individual scientific, coordinate, or metadata check."""
    check_name: str = Field(
        ...,
        description="Machine-readable name of the validation check."
    )
    passed: bool = Field(
        ...,
        description="True if check passed; False if failed."
    )
    severity: Literal["INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Severity level if check triggered."
    )
    message: str = Field(
        ...,
        description="Human-readable diagnostics explaining the check result."
    )
    timestamp_utc: str = Field(
        ...,
        description="ISO 8601 UTC timestamp when check executed."
    )


class ValidationReport(BaseModel):
    """Comprehensive validation report certifying contract compliance."""
    state: ValidationState = Field(
        ...,
        description="Overall validation state certification."
    )
    validator_version: str = Field(
        default="1.0.0",
        description="Version of validation engine executing rules."
    )
    validated_at_utc: str = Field(
        ...,
        description="ISO 8601 UTC timestamp of certification."
    )
    checks: List[ValidationCheckResult] = Field(
        default_factory=list,
        description="Detailed list of check results."
    )

    @computed_field
    @property
    def is_publication_ready(self) -> bool:
        """Only valid or valid_with_warnings datasets may be published for user visualization."""
        return self.state in (ValidationState.valid, ValidationState.valid_with_warnings)
