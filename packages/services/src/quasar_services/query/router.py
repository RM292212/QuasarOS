"""
QuasarOS Scientific Query Service FastAPI Router.

Exposes REST endpoints under /api/v1/queries/ conforming to OpenAPI 3.1 & APIContracts.md:
- POST /api/v1/queries/value: Point voxel query against native NetCDF source.
- POST /api/v1/queries/profile: 1D vertical column cast query across all 31 levels.
- POST /api/v1/queries/reconcile-pick: Reconciles provisional GPU raymarch pick against native NetCDF truth.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Request

from quasar_contracts.exact_value_contracts import (
    ExactValueQueryRequest,
    ExactValueQueryResponse,
)
from quasar_services.catalog.models import ApiResponse
from quasar_services.query.models import (
    ReconcilePickRequest,
    ReconcilePickResponse,
    VerticalProfileQueryRequest,
    VerticalProfileQueryResponse,
)
from quasar_services.query.query_engine import ExactQueryEngine

# Global singleton query engine instance
_query_engine: Optional[ExactQueryEngine] = None


def get_query_engine() -> ExactQueryEngine:
    global _query_engine
    if _query_engine is None:
        _query_engine = ExactQueryEngine()
    return _query_engine


router = APIRouter(prefix="/api/v1/queries", tags=["Scientific Queries"])


@router.post(
    "/value",
    response_model=ApiResponse[ExactValueQueryResponse],
    summary="Exact Scientific Point Query",
    description="Execute an authoritative exact-value point query directly from native NetCDF arrays, resolving geodetic coordinates, depth LUT, and exact numerical value.",
)
async def query_exact_value(
    request: ExactValueQueryRequest,
    engine: ExactQueryEngine = Depends(get_query_engine),
) -> ApiResponse[ExactValueQueryResponse]:
    """Execute authoritative point query against native NetCDF arrays."""
    result = engine.execute_exact_point_query(request)
    return ApiResponse(data=result)


@router.post(
    "/profile",
    response_model=ApiResponse[VerticalProfileQueryResponse],
    summary="Authoritative Vertical Profile Cast Query",
    description="Execute an authoritative vertical profile query extracting an exact 1D column cast across all 31 depth levels at target lat/lon and timestep.",
)
async def query_vertical_profile(
    request: VerticalProfileQueryRequest,
    engine: ExactQueryEngine = Depends(get_query_engine),
) -> ApiResponse[VerticalProfileQueryResponse]:
    """Execute authoritative vertical column query across all 31 vertical levels."""
    result = engine.execute_vertical_profile_query(request)
    return ApiResponse(data=result)


@router.post(
    "/reconcile-pick",
    response_model=ApiResponse[ReconcilePickResponse],
    summary="Reconcile Provisional GPU Render Pick",
    description="Reconcile a provisional GPU raymarch pick by mapping coordinates and evaluating native NetCDF ground truth, reporting exact difference delta and confidence bounds.",
)
async def reconcile_provisional_pick(
    request: ReconcilePickRequest,
    engine: ExactQueryEngine = Depends(get_query_engine),
) -> ApiResponse[ReconcilePickResponse]:
    """Reconcile provisional GPU pick against native NetCDF ground truth."""
    result = engine.execute_reconcile_pick(request)
    return ApiResponse(data=result)
