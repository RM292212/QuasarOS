"""
QuasarOS Scientific Query Module.

Provides authoritative exact-value point queries, vertical profiles,
and provisional pick reconciliation directly from native NetCDF-4 assets.
"""

from quasar_services.query.coordinate_resolver import (
    CoordinateResolver,
    DEPTH_LUT_METERS,
    haversine_distance_km,
    pressure_to_depth_m,
)
from quasar_services.query.errors import (
    CoordinateOutOfBoundsException,
    DepthOutOfBoundsException,
    QueryExecutionException,
    QueryServiceException,
    TemporalOutOfBoundsException,
    UnsupportedSelectionMethodException,
    VariableNotFoundException,
)
from quasar_services.query.models import (
    ExactValueQueryRequest,
    ExactValueQueryResponse,
    ProvisionalRenderPickResponse,
    ReconcilePickRequest,
    ReconcilePickResponse,
    VerticalProfileLevelSample,
    VerticalProfileQueryRequest,
    VerticalProfileQueryResponse,
)
from quasar_services.query.query_engine import ExactQueryEngine
from quasar_services.query.router import get_query_engine, router

__all__ = [
    "CoordinateResolver",
    "DEPTH_LUT_METERS",
    "haversine_distance_km",
    "pressure_to_depth_m",
    "QueryServiceException",
    "CoordinateOutOfBoundsException",
    "DepthOutOfBoundsException",
    "TemporalOutOfBoundsException",
    "VariableNotFoundException",
    "UnsupportedSelectionMethodException",
    "QueryExecutionException",
    "ExactValueQueryRequest",
    "ExactValueQueryResponse",
    "ProvisionalRenderPickResponse",
    "VerticalProfileQueryRequest",
    "VerticalProfileQueryResponse",
    "VerticalProfileLevelSample",
    "ReconcilePickRequest",
    "ReconcilePickResponse",
    "ExactQueryEngine",
    "get_query_engine",
    "router",
]
