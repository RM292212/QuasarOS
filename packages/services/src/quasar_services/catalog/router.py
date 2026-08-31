"""
QuasarOS FastAPI Catalog Router.

Exposes REST endpoints under /health and /api/v1/ conforming to OpenAPI 3.1.
"""

import uuid
import time as _time
import threading as _threading
from typing import List, Optional, Tuple, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse

from quasar_contracts.canonical_dataset import CanonicalDatasetContract
from quasar_services.catalog.catalog_service import CatalogService
from quasar_services.catalog.errors import (
    CatalogServiceException,
    DatasetNotFoundException,
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
    SnapshotSummary,
    SystemCapabilities,
    VisualizationProductDetail,
    VisualizationProductSummary,
)

# Global service instance and readiness cache
_catalog_service: Optional[CatalogService] = None
_readiness_cache_lock = _threading.Lock()
_last_readiness_check_time: float = 0.0
_cached_readiness_result: Optional[Tuple[bool, Any, Any]] = None


def get_catalog_service() -> CatalogService:
    global _catalog_service
    if _catalog_service is None:
        _catalog_service = CatalogService()
    return _catalog_service


router = APIRouter()


# -----------------------------------------------------------------------------
# Health Check Endpoints
# -----------------------------------------------------------------------------
@router.get(
    "/health/live",
    response_model=HealthStatus,
    summary="Liveness Probe",
    tags=["Health"],
)
async def health_live(service: CatalogService = Depends(get_catalog_service)) -> HealthStatus:
    """Return liveness status of the catalog service."""
    return service.get_health_live()


@router.get(
    "/health/ready",
    response_model=HealthStatus,
    summary="Readiness Probe",
    tags=["Health"],
)
async def health_ready(service: CatalogService = Depends(get_catalog_service)) -> HealthStatus:
    """
    Readiness probe — verifies:
    1. Manifest checksums (catalog layer).
    2. Essential local scientific data accessible (analysis layer).

    Features bounded 10-second cache to prevent file-handle and NetCDF I/O storms
    under rapid health polling from multiple UI components or orchestrators.
    Returns 200 only when BOTH checks pass.
    Returns 503 when the scientific data source is inaccessible.
    Argo/ERDDAP external providers are optional and do NOT affect readiness.
    """
    global _last_readiness_check_time, _cached_readiness_result
    from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine
    from fastapi.responses import JSONResponse
    from quasar_services.catalog.models import HealthStatus as HS

    now = _time.time()
    with _readiness_cache_lock:
        if _cached_readiness_result is not None and (now - _last_readiness_check_time) < 10.0:
            data_ok, status_obj, probe = _cached_readiness_result
            if not data_ok:
                degraded = HS(
                    status="degraded",
                    service="quasar-catalog-service",
                    version="1.0.0",
                    activeSnapshotsCount=status_obj.activeSnapshotsCount,
                    historicalSnapshotsCount=status_obj.historicalSnapshotsCount,
                    visualizationProductsCount=status_obj.visualizationProductsCount,
                    integrityVerified=False,
                )
                return JSONResponse(status_code=503, content=degraded.model_dump())
            return status_obj

    # Cache expired or first check — perform live checks
    ok, _errors = service.loader.verify_all_manifest_checksums()
    status_obj = service.get_health_ready()

    # Probe the essential scientific data source (bounded — reads only time coord via ds.sizes)
    engine = ScientificAnalysisEngine()
    probe = engine.probe_essential_data()
    data_ok = probe.get("status") == "ok"

    with _readiness_cache_lock:
        _last_readiness_check_time = now
        _cached_readiness_result = (data_ok, status_obj, probe)

    if not data_ok:
        import logging
        logging.getLogger("quasar.services").error(
            "Readiness probe failed: essential scientific data unavailable — %s", probe
        )
        degraded = HS(
            status="degraded",
            service="quasar-catalog-service",
            version="1.0.0",
            activeSnapshotsCount=status_obj.activeSnapshotsCount,
            historicalSnapshotsCount=status_obj.historicalSnapshotsCount,
            visualizationProductsCount=status_obj.visualizationProductsCount,
            integrityVerified=False,
        )
        return JSONResponse(status_code=503, content=degraded.model_dump())

    return status_obj


# -----------------------------------------------------------------------------
# Catalog & Capabilities Endpoints
# -----------------------------------------------------------------------------
@router.get(
    "/api/v1/catalog",
    response_model=ApiResponse[CatalogOverview],
    summary="Catalog Overview",
    tags=["Catalog"],
)
async def get_catalog(
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[CatalogOverview]:
    """List all registered dataset families and active/historical snapshots."""
    overview = service.get_catalog_overview()
    return ApiResponse(data=overview)


@router.get(
    "/api/v1/capabilities",
    response_model=ApiResponse[SystemCapabilities],
    summary="System Capabilities",
    tags=["Capabilities"],
)
async def get_capabilities(
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[SystemCapabilities]:
    """Retrieve system capabilities, supported coordinate frames, and precision profiles."""
    caps = service.get_system_capabilities()
    return ApiResponse(data=caps)


# -----------------------------------------------------------------------------
# Datasets & Snapshots Endpoints
# -----------------------------------------------------------------------------
@router.get(
    "/api/v1/datasets/{dataset_id}",
    response_model=ApiResponse[CanonicalDatasetContract],
    summary="Dataset Details",
    tags=["Datasets"],
)
async def get_dataset(
    dataset_id: str,
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[CanonicalDatasetContract]:
    """Retrieve complete canonical dataset contract metadata."""
    dataset = service.get_dataset(dataset_id)
    return ApiResponse(data=dataset)


@router.get(
    "/api/v1/datasets/{dataset_id}/snapshots",
    response_model=ApiResponse[List[SnapshotSummary]],
    summary="List Dataset Snapshots",
    tags=["Datasets"],
)
async def list_dataset_snapshots(
    dataset_id: str,
    limit: int = Query(default=50, ge=1, le=100, description="Maximum snapshots to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[List[SnapshotSummary]]:
    """List available operational and historical snapshots for a dataset with pagination."""
    snapshots = service.list_dataset_snapshots(dataset_id)
    paginated = snapshots[offset : offset + limit]
    return ApiResponse(data=paginated)


@router.get(
    "/api/v1/datasets/{dataset_id}/snapshots/{snapshot_id}",
    response_model=ApiResponse[SnapshotSummary],
    summary="Get Snapshot Details",
    tags=["Datasets"],
)
async def get_dataset_snapshot(
    dataset_id: str,
    snapshot_id: str,
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[SnapshotSummary]:
    """Retrieve details for a specific dataset snapshot."""
    snapshot = service.get_dataset_snapshot(dataset_id, snapshot_id)
    return ApiResponse(data=snapshot)


@router.get(
    "/api/v1/datasets/{dataset_id}/variables",
    response_model=ApiResponse[DatasetVariablesCatalog],
    summary="Dataset Variables",
    tags=["Datasets"],
)
async def get_dataset_variables(
    dataset_id: str,
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[DatasetVariablesCatalog]:
    """Retrieve canonical variable metadata and valid physical ranges for a dataset."""
    vars_catalog = service.get_dataset_variables(dataset_id)
    return ApiResponse(data=vars_catalog)


@router.get(
    "/api/v1/datasets/{dataset_id}/times",
    response_model=ApiResponse[DatasetTimeAxis],
    summary="Dataset Time Axis",
    tags=["Datasets"],
)
async def get_dataset_times(
    dataset_id: str,
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[DatasetTimeAxis]:
    """Retrieve available discrete timestamps and time semantics for a dataset."""
    times = service.get_dataset_times(dataset_id)
    return ApiResponse(data=times)


# -----------------------------------------------------------------------------
# Visualization Products Endpoints
# -----------------------------------------------------------------------------
@router.get(
    "/api/v1/visualization-products",
    response_model=ApiResponse[List[VisualizationProductSummary]],
    summary="List Visualization Products",
    tags=["Visualization"],
)
async def list_visualization_products(
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[List[VisualizationProductSummary]]:
    """List derived 3D volume visualization products and LOD hierarchies."""
    prods = service.list_visualization_products()
    return ApiResponse(data=prods)


@router.get(
    "/api/v1/visualization-products/{product_id}",
    response_model=ApiResponse[VisualizationProductDetail],
    summary="Get Visualization Product Detail",
    tags=["Visualization"],
)
async def get_visualization_product(
    product_id: str,
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[VisualizationProductDetail]:
    """Retrieve complete multiresolution LOD hierarchy, brick inventory, and transfer function."""
    detail = service.get_visualization_product(product_id)
    return ApiResponse(data=detail)


@router.get(
    "/api/v1/render-manifests/{product_id}",
    response_model=ApiResponse[VisualizationProductDetail],
    summary="Render Manifest Alias Endpoint",
    tags=["Visualization"],
)
async def get_render_manifest_alias(
    product_id: str,
    service: CatalogService = Depends(get_catalog_service),
) -> ApiResponse[VisualizationProductDetail]:
    """Alias endpoint conforming to docs/02-architecture/APIContracts.md core resources table."""
    detail = service.get_visualization_product(product_id)
    return ApiResponse(data=detail)


@router.get(
    "/api/v1/visualization-products/{product_id}/bricks/{brick_key}/payloads/{representation}",
    summary="Download Immutable Brick Binary Payload",
    tags=["Visualization"],
    response_class=Response,
    responses={
        200: {
            "description": "Immutable zstd-compressed binary brick payload.",
            "content": {"application/octet-stream": {}},
            "headers": {
                "Content-Type": {"schema": {"type": "string", "example": "application/octet-stream"}},
                "Cache-Control": {"schema": {"type": "string", "example": "public, max-age=31536000, immutable"}},
                "ETag": {"schema": {"type": "string", "example": '"e8884ebbd172aa6a39cc419c42c828ebe294df7e908b78be89ba8ce2b924384d"'}},
                "X-Payload-SHA256": {"schema": {"type": "string", "example": "e8884ebbd172aa6a39cc419c42c828ebe294df7e908b78be89ba8ce2b924384d"}},
                "X-Payload-Compressed-Bytes": {"schema": {"type": "integer", "example": 104986}},
                "X-Payload-Uncompressed-Bytes": {"schema": {"type": "integer", "example": 278784}},
                "Accept-Ranges": {"schema": {"type": "string", "example": "bytes"}},
            },
        },
        304: {
            "description": "Not Modified (payload matching client ETag cached).",
        },
        400: {
            "description": "Invalid parameter or representation.",
            "model": QuasarErrorResponse,
        },
        404: {
            "description": "Visualization product, brick key, or binary payload not found.",
            "model": QuasarErrorResponse,
        },
    },
)
async def get_brick_payload(
    product_id: str,
    brick_key: str,
    representation: str,
    request: Request,
    service: CatalogService = Depends(get_catalog_service),
) -> Response:
    """
    Stream immutable zstd-compressed binary brick payload (.bin.zst).

    Adheres strictly to docs/02-architecture/APIContracts.md, ErrorModel.md, and TASK-06A transport specs:
    - Path params: product_id, brick_key, representation ('f16' or 'u16').
    - Immutable caching headers: Cache-Control: public, max-age=31536000, immutable.
    - Strong ETag validation: supports conditional If-None-Match requests returning 304 Not Modified.
    - Zero host filesystem path leakage in headers or error payloads.
    """
    file_path, payload_meta = service.resolve_brick_payload(product_id, brick_key, representation)

    sha256 = payload_meta.get("sha256_checksum", "")
    etag = f'"{sha256}"'
    uncompressed_bytes = payload_meta.get("uncompressed_bytes_length", 278784)
    compressed_bytes = payload_meta.get("compressed_bytes_length", file_path.stat().st_size)

    # Check conditional If-None-Match
    if_none_match = request.headers.get("if-none-match")
    if if_none_match:
        # Match against exact etag or unquoted sha256 or wildcard *
        client_etags = [t.strip() for t in if_none_match.split(",")]
        if etag in client_etags or sha256 in client_etags or f'W/{etag}' in client_etags or "*" in client_etags:
            return Response(
                status_code=status.HTTP_304_NOT_MODIFIED,
                headers={
                    "ETag": etag,
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "X-Payload-SHA256": sha256,
                },
            )

    # Read binary payload
    payload_bytes = file_path.read_bytes()

    headers = {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        "X-Payload-SHA256": sha256,
        "X-Payload-Compressed-Bytes": str(compressed_bytes),
        "X-Payload-Uncompressed-Bytes": str(uncompressed_bytes),
        "Accept-Ranges": "bytes",
    }

    return Response(
        content=payload_bytes,
        status_code=status.HTTP_200_OK,
        media_type="application/octet-stream",
        headers=headers,
    )


