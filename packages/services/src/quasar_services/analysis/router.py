"""
TASK-13 REST API Router — RUNTIME-HOTFIX-03

Changes from hotfix:
- Structured error responses with machine-readable codes and correlation IDs.
- ValueError from engine → 400 with structured body (not raw exception text).
- FileNotFoundError → 503 (data temporarily unavailable, not a 500).
- Unexpected exceptions → sanitised 500 with correlation ID (no local paths, no tracebacks).
- /volume-grid input validated BEFORE engine call; missing inputs raise 400.
- Readiness endpoint reads essential data through the engine probe.
- Argo/ERDDAP external dependency cannot affect core local data endpoints.
"""

import uuid
import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Header, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from quasar_services.analysis.analysis_engine import (
    ScientificAnalysisEngine,
    _ALLOWED_VARIABLES,
    _SURFACE_ONLY_VARIABLES,
    _netcdf_io_lock,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/analysis", tags=["Scientific Analysis"])

# ---------------------------------------------------------------------------
# Engine dependency — stateless; safe to reuse across requests
# ---------------------------------------------------------------------------
_engine: Optional[ScientificAnalysisEngine] = None


def get_engine() -> ScientificAnalysisEngine:
    global _engine
    if _engine is None:
        _engine = ScientificAnalysisEngine()
    return _engine


# ---------------------------------------------------------------------------
# Structured error helpers
# ---------------------------------------------------------------------------

def _make_error(code: str, message: str, request_id: str, retryable: bool = False, **extra) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "retryable": retryable,
            **extra,
        }
    }


def _validation_error(message: str, request_id: str, field: Optional[str] = None) -> JSONResponse:
    body = _make_error("VALIDATION_ERROR", message, request_id, field=field)
    return JSONResponse(status_code=400, content=body)


def _unavailable_error(message: str, request_id: str) -> JSONResponse:
    body = _make_error("DATA_SOURCE_UNAVAILABLE", message, request_id, retryable=True)
    return JSONResponse(status_code=503, content=body)


def _internal_error(request_id: str) -> JSONResponse:
    body = _make_error(
        "INTERNAL_ERROR",
        "An unexpected error occurred. Refer to request_id for server logs.",
        request_id,
        retryable=False,
    )
    return JSONResponse(status_code=500, content=body)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class PointTimeseriesRequest(BaseModel):
    variable: str = Field(..., description="Variable: thetao, so, uo, vo, zos, speed")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    depth_m: Optional[float] = Field(None, ge=0.0, le=6000.0)


class VerticalProfileRequest(BaseModel):
    variable: str = Field(..., description="Variable: thetao, so, uo, vo, speed")
    time_index: int = Field(0, ge=0, le=6)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)


class TransectRequest(BaseModel):
    variable: str = Field(..., description="Variable: thetao, so, uo, vo, zos, speed")
    time_index: int = Field(0, ge=0, le=6)
    start_latitude: float = Field(..., ge=-90.0, le=90.0)
    start_longitude: float = Field(..., ge=-180.0, le=180.0)
    end_latitude: float = Field(..., ge=-90.0, le=90.0)
    end_longitude: float = Field(..., ge=-180.0, le=180.0)
    num_samples: int = Field(10, ge=2, le=100)


class SliceRequest(BaseModel):
    variable: str = Field(..., description="Variable: thetao, so, uo, vo, zos, speed")
    time_index: int = Field(0, ge=0, le=6)
    depth_m: float = Field(0.494, ge=0.0, le=6000.0)


class TEOS10Request(BaseModel):
    time_index: int = Field(0, ge=0, le=6)
    latitude: float = Field(..., ge=-3.0, le=15.0,
                            description="Latitude within regional domain [-3, 15]°N")
    longitude: float = Field(..., ge=60.0, le=88.0,
                             description="Longitude within regional domain [60, 88]°E")


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

@router.post("/teos10-soundings")
async def get_teos10(
    req: TEOS10Request,
    engine: ScientificAnalysisEngine = Depends(get_engine),
):
    """
    Compute GSW TEOS-10 derived oceanographic soundings.
    Domain: 80–88°E, -3–12°N (Arabian Sea / Copernicus regional domain).
    """
    request_id = str(uuid.uuid4())
    try:
        result = engine.compute_teos10_derived_soundings(req.time_index, req.latitude, req.longitude)
        result["request_id"] = request_id
        return result
    except ValueError as exc:
        return _validation_error(str(exc), request_id)
    except FileNotFoundError as exc:
        logger.error("[%s] Data source unavailable: %s", request_id, exc)
        return _unavailable_error("Scientific data source not accessible.", request_id)
    except Exception as exc:
        logger.error("[%s] Unexpected error in teos10-soundings: %s\n%s",
                     request_id, exc, traceback.format_exc())
        return _internal_error(request_id)


@router.get("/volume-grid", response_model=None)
def get_volume_grid(
    variable: str = Query("thetao", description="Variable: thetao, so, uo, vo, zos, speed"),
    time_index: int = Query(0, ge=0, le=6),
    depth_levels: int = Query(16, ge=1, le=50),
    lat_res: int = Query(32, ge=2, le=181),
    lon_res: int = Query(32, ge=2, le=97),
    min_lon: Optional[float] = Query(None, ge=-180.0, le=180.0),
    max_lon: Optional[float] = Query(None, ge=-180.0, le=180.0),
    min_lat: Optional[float] = Query(None, ge=-90.0, le=90.0),
    max_lat: Optional[float] = Query(None, ge=-90.0, le=90.0),
    format: Optional[str] = Query("json", description="Output format: 'json' or 'binary' (Float32Array octet-stream)"),
    traceparent: Optional[str] = Header(None, description="W3C Traceparent Header"),
    engine: ScientificAnalysisEngine = Depends(get_engine),
) -> Union[Dict[str, Any], Response]:
    """
    Return a resampled 3-D scalar grid for volume rendering with spatial bounding box subsetting.
    Supports binary streaming (Float32Array) for ultra-fast browser rendering and low latency.
    """
    request_id = str(uuid.uuid4())
    trace_id = traceparent.split("-")[1] if (traceparent and len(traceparent.split("-")) >= 2) else request_id
    try:
        result = engine.get_volume_slice_grid(
            variable=variable,
            time_index=time_index,
            depth_levels=depth_levels,
            lat_res=lat_res,
            lon_res=lon_res,
            min_lon=min_lon,
            max_lon=max_lon,
            min_lat=min_lat,
            max_lat=max_lat,
            return_numpy=(format == "binary"),
        )
        result["request_id"] = request_id
        result["trace_id"] = trace_id

        if format == "binary":
            # Direct binary memory view without Python float allocations
            numpy_arr = result.get("numpy_array")
            if numpy_arr is not None:
                raw_bytes = numpy_arr.tobytes()
            else:
                import numpy as np
                raw_bytes = np.array(result["data"], dtype=np.float32).tobytes()

            meta = {
                "variable": result["variable"],
                "units": result["units"],
                "time_index": result["time_index"],
                "timestamp_iso": result["timestamp_iso"],
                "shape": result["shape"],
                "depth_m": result["depth_m"],
                "min_val": result["min_val"],
                "max_val": result["max_val"],
                "is_surface_only": result["is_surface_only"],
                "bounds": result["bounds"],
                "request_id": request_id,
                "trace_id": trace_id,
            }

            headers = {
                "x-volume-metadata": json.dumps(meta),
                "Content-Type": "application/octet-stream",
                "x-request-id": request_id,
                "x-trace-id": trace_id,
            }
            return Response(content=raw_bytes, media_type="application/octet-stream", headers=headers)

        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=_make_error("VALIDATION_ERROR", str(exc), request_id),
        )
    except FileNotFoundError as exc:
        logger.error("[%s] Data source not found: %s", request_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_make_error(
                "DATA_SOURCE_UNAVAILABLE",
                "Scientific data source not accessible.",
                request_id,
                retryable=True,
            ),
        )
    except Exception as exc:
        logger.error("[%s] Unexpected error in volume-grid: %s\n%s",
                     request_id, exc, traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=_make_error(
                "INTERNAL_ERROR",
                "An unexpected error occurred. Refer to request_id for server logs.",
                request_id,
            ),
        )


@router.post("/timeseries")
@router.post("/point-timeseries")
async def get_point_timeseries(
    req: PointTimeseriesRequest,
    engine: ScientificAnalysisEngine = Depends(get_engine),
):
    request_id = str(uuid.uuid4())
    try:
        if req.variable not in _ALLOWED_VARIABLES:
            return _validation_error(f"Variable '{req.variable}' not in allowlist", request_id)
        result = engine.query_point_timeseries(
            req.variable,
            req.latitude,
            req.longitude,
            req.depth_m,
        )
        result["request_id"] = request_id
        return result
    except ValueError as exc:
        return _validation_error(str(exc), request_id)
    except FileNotFoundError as exc:
        logger.error("[%s] %s", request_id, exc)
        return _unavailable_error("Scientific data source not accessible.", request_id)
    except Exception as exc:
        logger.error("[%s] %s\n%s", request_id, exc, traceback.format_exc())
        return _internal_error(request_id)


@router.post("/profile")
@router.post("/vertical-profile")
async def get_profile(
    req: VerticalProfileRequest,
    engine: ScientificAnalysisEngine = Depends(get_engine),
):
    request_id = str(uuid.uuid4())
    try:
        if req.variable not in _ALLOWED_VARIABLES:
            return _validation_error(f"Variable '{req.variable}' not in allowlist", request_id)
        result = engine.query_vertical_profile(
            req.variable,
            req.time_index,
            req.latitude,
            req.longitude,
        )
        result["samples"] = [
            {"depth_m": d, "value": v}
            for d, v in zip(result["depth_levels_m"], result["values"])
        ]
        result["soundings"] = result["samples"]
        result["request_id"] = request_id
        return result
    except ValueError as exc:
        return _validation_error(str(exc), request_id)
    except FileNotFoundError as exc:
        logger.error("[%s] %s", request_id, exc)
        return _unavailable_error("Scientific data source not accessible.", request_id)
    except Exception as exc:
        logger.error("[%s] %s\n%s", request_id, exc, traceback.format_exc())
        return _internal_error(request_id)


@router.post("/transect")
async def get_transect(
    req: TransectRequest,
    engine: ScientificAnalysisEngine = Depends(get_engine),
):
    request_id = str(uuid.uuid4())
    try:
        import numpy as np_local
        lats = np_local.linspace(req.start_latitude, req.end_latitude, req.num_samples)
        lons = np_local.linspace(req.start_longitude, req.end_longitude, req.num_samples)
        points = [{"latitude": float(la), "longitude": float(lo)} for la, lo in zip(lats, lons)]
        return engine.compute_transect(points, req.variable, req.time_index)
    except ValueError as exc:
        return _validation_error(str(exc), request_id)
    except FileNotFoundError as exc:
        logger.error("[%s] %s", request_id, exc)
        return _unavailable_error("Scientific data source not accessible.", request_id)
    except Exception as exc:
        logger.error("[%s] %s\n%s", request_id, exc, traceback.format_exc())
        return _internal_error(request_id)


@router.post("/slice")
async def get_slice(
    req: SliceRequest,
    engine: ScientificAnalysisEngine = Depends(get_engine),
):
    request_id = str(uuid.uuid4())
    try:
        return engine.compute_horizontal_slice(req.depth_m, req.variable, req.time_index)
    except ValueError as exc:
        return _validation_error(str(exc), request_id)
    except FileNotFoundError as exc:
        logger.error("[%s] %s", request_id, exc)
        return _unavailable_error("Scientific data source not accessible.", request_id)
    except Exception as exc:
        logger.error("[%s] %s\n%s", request_id, exc, traceback.format_exc())
        return _internal_error(request_id)


@router.get("/bathymetry-grid")
def get_bathymetry_grid(
    min_lon: float = Query(60.0, ge=40.0, le=100.0),
    max_lon: float = Query(68.0, ge=40.0, le=100.0),
    min_lat: float = Query(0.0, ge=0.0, le=30.0),
    max_lat: float = Query(15.0, ge=0.0, le=30.0),
    lat_res: int = Query(32, ge=2, le=301),
    lon_res: int = Query(32, ge=2, le=601),
    engine: ScientificAnalysisEngine = Depends(get_engine),
) -> Dict[str, Any]:
    """
    Return resampled GEBCO bathymetry heightfield grid for the 3D scene and sub-seafloor clipping.
    """
    request_id = str(uuid.uuid4())
    try:
        result = engine.get_bathymetry_grid(min_lon, max_lon, min_lat, max_lat, lat_res, lon_res)
        result["request_id"] = request_id
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=_make_error("VALIDATION_ERROR", str(exc), request_id),
        )
    except FileNotFoundError as exc:
        logger.error("[%s] Bathymetry data source not found: %s", request_id, exc)
        raise HTTPException(
            status_code=503,
            detail=_make_error(
                "DATA_SOURCE_UNAVAILABLE",
                "GEBCO Bathymetry dataset not accessible.",
                request_id,
                retryable=True,
            ),
        )
    except Exception as exc:
        logger.error("[%s] Unexpected error in bathymetry-grid: %s\n%s",
                     request_id, exc, traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=_make_error(
                "INTERNAL_ERROR",
                "An unexpected error occurred. Refer to request_id for server logs.",
                request_id,
            ),
        )


@router.get("/coastlines")
def get_coastlines(
    min_lon: float = Query(40.0, ge=-180.0, le=180.0),
    max_lon: float = Query(100.0, ge=-180.0, le=180.0),
    min_lat: float = Query(0.0, ge=-90.0, le=90.0),
    max_lat: float = Query(30.0, ge=-90.0, le=90.0),
    engine: ScientificAnalysisEngine = Depends(get_engine),
) -> Dict[str, Any]:
    """
    Return vector polyline coastline coordinates for the Arabian Sea / North Indian Ocean.
    """
    request_id = str(uuid.uuid4())
    try:
        result = engine.get_coastlines(min_lon, max_lon, min_lat, max_lat)
        result["request_id"] = request_id
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=_make_error("VALIDATION_ERROR", str(exc), request_id),
        )
    except Exception as exc:
        logger.error("[%s] Unexpected error in coastlines: %s\n%s",
                     request_id, exc, traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=_make_error(
                "INTERNAL_ERROR",
                "An unexpected error occurred. Refer to request_id for server logs.",
                request_id,
            ),
        )


@router.get("/essential-data-probe")
async def probe_essential_data(engine: ScientificAnalysisEngine = Depends(get_engine)):
    """
    Lightweight probe: open/close authoritative thetao file, read time metadata.
    Used by /health/ready.
    """
    result = engine.probe_essential_data()
    status_code = 200 if result.get("status") == "ok" else 503
    return JSONResponse(status_code=status_code, content=result)

