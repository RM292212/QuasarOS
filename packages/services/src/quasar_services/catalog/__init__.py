"""
QuasarOS Catalog Service Module.
"""

from quasar_services.catalog.catalog_service import CatalogService
from quasar_services.catalog.manifest_loader import ManifestLoader, compute_file_sha256, sanitize_path
from quasar_services.catalog.errors import (
    CatalogServiceException,
    DatasetNotFoundException,
    IntegrityValidationException,
    QuasarErrorDetail,
    QuasarErrorResponse,
    SecurityValidationException,
    SnapshotNotFoundException,
    VisualizationProductNotFoundException,
)
from quasar_services.catalog.models import (
    ApiResponse,
    CatalogOverview,
    DatasetFamilySummary,
    DatasetTimeAxis,
    DatasetVariablesCatalog,
    HealthStatus,
    ResponseMeta,
    SnapshotSummary,
    SystemCapabilities,
    VisualizationProductDetail,
    VisualizationProductSummary,
)
from quasar_services.catalog.router import router

__all__ = [
    "CatalogService",
    "ManifestLoader",
    "compute_file_sha256",
    "sanitize_path",
    "CatalogServiceException",
    "DatasetNotFoundException",
    "SnapshotNotFoundException",
    "VisualizationProductNotFoundException",
    "SecurityValidationException",
    "IntegrityValidationException",
    "QuasarErrorDetail",
    "QuasarErrorResponse",
    "ApiResponse",
    "ResponseMeta",
    "HealthStatus",
    "SnapshotSummary",
    "DatasetFamilySummary",
    "CatalogOverview",
    "DatasetTimeAxis",
    "DatasetVariablesCatalog",
    "VisualizationProductSummary",
    "VisualizationProductDetail",
    "SystemCapabilities",
    "router",
]

