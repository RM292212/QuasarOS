"""
QuasarOS Scientific Query Service Domain Exceptions.

Conforms strictly to docs/02-architecture/ErrorModel.md.
"""

from typing import Any, Dict, Optional
from quasar_services.catalog.errors import CatalogServiceException


class QueryServiceException(CatalogServiceException):
    """Base exception for all query engine domain errors."""
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        retryable: bool = False,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            code=code,
            message=message,
            status_code=status_code,
            retryable=retryable,
            details=details or {},
        )


class CoordinateOutOfBoundsException(QueryServiceException):
    """Raised when spatial coordinates lie outside valid domain bounds without allowed extrapolation."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="VALIDATION_OUT_OF_BOUNDS",
            message=message,
            status_code=422,
            retryable=False,
            details=details or {},
        )


class DepthOutOfBoundsException(QueryServiceException):
    """Raised when depth coordinate lies outside valid vertical bounds without allowed extrapolation."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="VALIDATION_OUT_OF_BOUNDS",
            message=message,
            status_code=422,
            retryable=False,
            details=details or {},
        )


class TemporalOutOfBoundsException(QueryServiceException):
    """Raised when target timestamp lies outside dataset temporal coverage window."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="VALIDATION_OUT_OF_BOUNDS",
            message=message,
            status_code=422,
            retryable=False,
            details=details or {},
        )


class VariableNotFoundException(QueryServiceException):
    """Raised when requested variable identifier is not present in the dataset."""
    def __init__(self, variable_id: str, dataset_id: str, message: Optional[str] = None):
        super().__init__(
            code="DATA_VARIABLE_NOT_FOUND",
            message=message or f"Variable '{variable_id}' not found in dataset '{dataset_id}'.",
            status_code=404,
            retryable=False,
            details={"variable_id": variable_id, "dataset_id": dataset_id},
        )


class UnsupportedSelectionMethodException(QueryServiceException):
    """Raised when requested selection or interpolation method is unsupported."""
    def __init__(self, method: str, message: Optional[str] = None):
        super().__init__(
            code="VALIDATION_UNSUPPORTED_METHOD",
            message=message or f"Selection method '{method}' is not supported for this query.",
            status_code=422,
            retryable=False,
            details={"method": method},
        )


class QueryExecutionException(QueryServiceException):
    """Raised when an internal error occurs during native array extraction."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            code="DATA_PROCESSING_ERROR",
            message=message,
            status_code=500,
            retryable=False,
            details=details or {},
        )
