"""
QuasarOS Error Contracts and Handlers.

Conforms to docs/02-architecture/ErrorModel.md.
"""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from fastapi import Request
from fastapi.responses import JSONResponse

from quasar_contracts.errors_warnings import ErrorCategory


class QuasarErrorDetail(BaseModel):
    """Structured error payload conforming to docs/02-architecture/ErrorModel.md."""
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Safe, human-readable error message")
    requestId: str = Field(..., description="Unique request identifier for tracing")
    retryable: bool = Field(default=False, description="Whether the request may be retried")
    details: Dict[str, Any] = Field(default_factory=dict, description="Safe structured metadata (no absolute paths or secrets)")


class QuasarErrorResponse(BaseModel):
    """Top-level standardized error envelope."""
    error: QuasarErrorDetail


class CatalogServiceException(Exception):
    """Base domain exception for catalog service operations."""
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        retryable: bool = False,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.details = details or {}


class DatasetNotFoundException(CatalogServiceException):
    def __init__(self, dataset_id: str, message: Optional[str] = None):
        super().__init__(
            code="CATALOG_DATASET_NOT_FOUND",
            message=message or f"The requested dataset '{dataset_id}' is unavailable.",
            status_code=404,
            retryable=False,
            details={"dataset_id": dataset_id},
        )


class SnapshotNotFoundException(CatalogServiceException):
    def __init__(self, dataset_id: str, snapshot_id: str, message: Optional[str] = None):
        super().__init__(
            code="CATALOG_SNAPSHOT_NOT_FOUND",
            message=message or f"Snapshot '{snapshot_id}' for dataset '{dataset_id}' was not found.",
            status_code=404,
            retryable=False,
            details={"dataset_id": dataset_id, "snapshot_id": snapshot_id},
        )


class VisualizationProductNotFoundException(CatalogServiceException):
    def __init__(self, product_id: str, message: Optional[str] = None):
        super().__init__(
            code="RENDER_PRODUCT_NOT_FOUND",
            message=message or f"Visualization product '{product_id}' was not found.",
            status_code=404,
            retryable=False,
            details={"product_id": product_id},
        )


class SecurityValidationException(CatalogServiceException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="VALIDATION_INVALID_INPUT",
            message=message,
            status_code=400,
            retryable=False,
            details=details or {},
        )


class IntegrityValidationException(CatalogServiceException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="DATA_INTEGRITY_MISMATCH",
            message=message,
            status_code=500,
            retryable=False,
            details=details or {},
        )


class BrickNotFoundException(CatalogServiceException):
    def __init__(self, product_id: str, brick_key: str, message: Optional[str] = None):
        super().__init__(
            code="RENDER_BRICK_NOT_FOUND",
            message=message or f"Brick '{brick_key}' was not found in visualization product '{product_id}'.",
            status_code=404,
            retryable=False,
            details={"product_id": product_id, "brick_key": brick_key},
        )


class InvalidRepresentationException(CatalogServiceException):
    def __init__(self, representation: str, message: Optional[str] = None):
        super().__init__(
            code="RENDER_INVALID_REPRESENTATION",
            message=message or f"Representation '{representation}' is invalid. Allowed values are 'f16' and 'u16'.",
            status_code=400,
            retryable=False,
            details={"representation": representation, "allowed_values": ["f16", "u16"]},
        )


class BrickPayloadNotFoundException(CatalogServiceException):
    def __init__(self, product_id: str, brick_key: str, representation: str, message: Optional[str] = None):
        super().__init__(
            code="RENDER_PAYLOAD_NOT_FOUND",
            message=message or f"Payload for brick '{brick_key}' ({representation}) is unavailable on storage.",
            status_code=404,
            retryable=False,
            details={"product_id": product_id, "brick_key": brick_key, "representation": representation},
        )


