"""
QuasarOS Scientific Diagnostics & Error Contracts

Conforms to docs/02-architecture/ErrorModel.md providing machine-readable error codes,
warning categories, and actionable scientific diagnostics.
"""

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ErrorCategory(str, Enum):
    """Categorical prefix conforming to ErrorModel.md."""
    AUTH = "AUTH"
    VALIDATION = "VALIDATION"
    CATALOG = "CATALOG"
    SOURCE = "SOURCE"
    DATA = "DATA"
    RENDER = "RENDER"
    ANALYSIS = "ANALYSIS"
    STORAGE = "STORAGE"
    JOB = "JOB"
    RATE = "RATE"
    INTERNAL = "INTERNAL"


class ErrorSeverity(str, Enum):
    """Severity classification."""
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class ScientificErrorCode(str, Enum):
    """Standardized machine-readable error codes."""
    # DATA prefix
    DATA_NON_MONOTONIC_COORDINATES = "DATA_NON_MONOTONIC_COORDINATES"
    DATA_SILENT_UNIT_CONVERSION_BLOCKED = "DATA_SILENT_UNIT_CONVERSION_BLOCKED"
    DATA_MISSING_VALUE_AS_ZERO_PROHIBITED = "DATA_MISSING_VALUE_AS_ZERO_PROHIBITED"
    DATA_INVALID_CRS = "DATA_INVALID_CRS"
    DATA_SYNTHETIC_IN_PRODUCTION_PROHIBITED = "DATA_SYNTHETIC_IN_PRODUCTION_PROHIBITED"
    DATA_TEOS10_CONTEXT_MISSING = "DATA_TEOS10_CONTEXT_MISSING"
    DATA_CORRUPTED_PAYLOAD = "DATA_CORRUPTED_PAYLOAD"
    
    # VALIDATION prefix
    VALIDATION_SCHEMA_VIOLATION = "VALIDATION_SCHEMA_VIOLATION"
    VALIDATION_MISSING_METADATA = "VALIDATION_MISSING_METADATA"
    VALIDATION_BARE_MODEL_NAME_PROHIBITED = "VALIDATION_BARE_MODEL_NAME_PROHIBITED"
    
    # RENDER prefix
    RENDER_UNSUPPORTED_TOPOLOGY = "RENDER_UNSUPPORTED_TOPOLOGY"
    RENDER_DIMENSION_MISMATCH = "RENDER_DIMENSION_MISMATCH"
    RENDER_INVALID_TEXTURE_PACKING = "RENDER_INVALID_TEXTURE_PACKING"
    
    # SOURCE prefix
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    SOURCE_CHECKSUM_MISMATCH = "SOURCE_CHECKSUM_MISMATCH"
    SOURCE_ACCESS_RESTRICTED = "SOURCE_ACCESS_RESTRICTED"
    
    # ANALYSIS prefix
    ANALYSIS_UNSUPPORTED_COORDINATE_SYSTEM = "ANALYSIS_UNSUPPORTED_COORDINATE_SYSTEM"
    ANALYSIS_INCOMPATIBLE_GRIDS = "ANALYSIS_INCOMPATIBLE_GRIDS"


class ScientificDiagnostic(BaseModel):
    """Structured diagnostic message for validation reports and API error responses."""
    code: str = Field(
        ...,
        description="Machine-readable error or warning code."
    )
    category: ErrorCategory = Field(
        ...,
        description="Functional category."
    )
    severity: ErrorSeverity = Field(
        default=ErrorSeverity.ERROR,
        description="Severity level."
    )
    message: str = Field(
        ...,
        description="Human-readable explanation safe for UI display."
    )
    dataset_id: Optional[str] = Field(
        default=None,
        description="Dataset identifier related to this diagnostic."
    )
    variable_id: Optional[str] = Field(
        default=None,
        description="Variable identifier related to this diagnostic."
    )
    suggested_action: Optional[str] = Field(
        default=None,
        description="Actionable suggestion for operator or researcher."
    )
    details: Dict[str, Any] = Field(
        default_factory=dict,
        description="Safe structured context attributes."
    )
