"""
TASK-13 REST API Router
Mounts:
- POST /api/v1/analysis/timeseries
- POST /api/v1/analysis/profile
- POST /api/v1/analysis/transect
- POST /api/v1/analysis/slice
- POST /api/v1/analysis/teos10-soundings
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine

router = APIRouter(prefix="/api/v1/analysis", tags=["Scientific Analysis"])
_engine = None

def get_engine() -> ScientificAnalysisEngine:
    global _engine
    if _engine is None:
        _engine = ScientificAnalysisEngine()
    return _engine

class PointTimeseriesRequest(BaseModel):
    variable: str = Field(..., description="Variable identifier: thetao, so, uo, vo, zos")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    depth_m: Optional[float] = Field(None, ge=0.0, le=6000.0)

class VerticalProfileRequest(BaseModel):
    variable: str = Field(..., description="Variable identifier: thetao, so, uo, vo")
    time_index: int = Field(0, ge=0, le=6)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

class TransectRequest(BaseModel):
    variable: str = Field(..., description="Variable identifier: thetao, so, uo, vo, zos")
    time_index: int = Field(0, ge=0, le=6)
    start_latitude: float = Field(..., ge=-90.0, le=90.0)
    start_longitude: float = Field(..., ge=-180.0, le=180.0)
    end_latitude: float = Field(..., ge=-90.0, le=90.0)
    end_longitude: float = Field(..., ge=-180.0, le=180.0)
    num_samples: int = Field(10, ge=2, le=100)

class SliceRequest(BaseModel):
    variable: str = Field(..., description="Variable identifier: thetao, so, uo, vo, zos")
    time_index: int = Field(0, ge=0, le=6)
    depth_m: float = Field(0.494, ge=0.0, le=6000.0)

class TEOS10Request(BaseModel):
    time_index: int = Field(0, ge=0, le=6)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

@router.post("/timeseries")
async def get_timeseries(req: PointTimeseriesRequest, engine: ScientificAnalysisEngine = Depends(get_engine)):
    try:
        return engine.query_point_timeseries(req.variable, req.latitude, req.longitude, req.depth_m)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/profile")
async def get_profile(req: VerticalProfileRequest, engine: ScientificAnalysisEngine = Depends(get_engine)):
    try:
        return engine.query_vertical_profile(req.variable, req.time_index, req.latitude, req.longitude)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/transect")
async def get_transect(req: TransectRequest, engine: ScientificAnalysisEngine = Depends(get_engine)):
    try:
        return engine.query_transect(req.variable, req.time_index, req.start_latitude, req.start_longitude, req.end_latitude, req.end_longitude, req.num_samples)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/slice")
async def get_slice(req: SliceRequest, engine: ScientificAnalysisEngine = Depends(get_engine)):
    try:
        return engine.query_horizontal_slice(req.variable, req.time_index, req.depth_m)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/teos10-soundings")
async def get_teos10(req: TEOS10Request, engine: ScientificAnalysisEngine = Depends(get_engine)):
    try:
        return engine.compute_teos10_derived_soundings(req.time_index, req.latitude, req.longitude)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/volume-grid")
def get_volume_grid(
    variable: str = "thetao",
    time_index: int = 0,
    depth_levels: int = 16,
    lat_res: int = 32,
    lon_res: int = 32,
    engine: ScientificAnalysisEngine = Depends(get_engine)
) -> Dict[str, Any]:
    return engine.get_volume_slice_grid(variable, time_index, depth_levels, lat_res, lon_res)
