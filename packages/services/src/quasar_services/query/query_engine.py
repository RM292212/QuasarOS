"""
QuasarOS Authoritative Exact-Value Query Engine (TASK-05C).

Governing Directives (ADR-0005 & AGENTS.md):
- Sole Scientific Authority: Evaluates exact queries directly from the immutable native NetCDF-4 file.
- Strict isolation: NEVER accesses Float16 or Uint16 visualization brick payloads (.bin.zst) for exact queries.
- Strict missing-value preservation: Missing values and land masks are NEVER converted to physical 0.0 deg C.
- Complete lineage tracking: Returns source asset ID, SHA-256 digest, evaluated coordinates, and grid indices.
- Provisional Pick Reconciliation: Computes empirical numerical delta and validates against theoretical error bounds.
"""

from datetime import datetime
import math
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional, Tuple, Union
import netCDF4
import numpy as np

from quasar_contracts.exact_value_contracts import (
    ExactValueQueryRequest,
    ExactValueQueryResponse,
    ProvisionalRenderPickResponse,
    SelectionInterpolationContract,
    SelectionMethod,
    TimeSelectorMode,
    VerticalSelectorType,
)
from quasar_contracts.missing_values import PhysicalCellState
from quasar_services.catalog.errors import DatasetNotFoundException, SecurityValidationException
from quasar_services.catalog.manifest_loader import ManifestLoader, sanitize_path
from quasar_services.query.cache import QueryCache
from quasar_services.query.coordinate_resolver import CoordinateResolver
from quasar_services.query.errors import (
    QueryExecutionException,
    VariableNotFoundException,
)
from quasar_services.query.models import (
    ReconcilePickRequest,
    ReconcilePickResponse,
    VerticalProfileLevelSample,
    VerticalProfileQueryRequest,
    VerticalProfileQueryResponse,
)

# Standard metadata constants for Copernicus PHY Thetao
DEFAULT_DATASET_ID = "copernicus_phy_thetao"
DEFAULT_SNAPSHOT_ID = "copernicus-phy-thetao-20260824-20260830-ca826087"
DEFAULT_VARIABLE_ID = "sea_water_potential_temperature"
RAW_NC_VARIABLE_NAME = "thetao"
SOURCE_ASSET_ID = "copernicus_phy_thetao_20260824_20260830.nc"
SOURCE_ASSET_SHA256 = "ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c"
CANONICAL_UNITS = "degree_Celsius"
NC_FILL_VALUE = 9.96921e+36


def convert_units(val_celsius: Optional[float], requested_units: Optional[str]) -> Tuple[Optional[float], str]:
    """Convert Celsius value to requested scientific units."""
    if val_celsius is None:
        return None, CANONICAL_UNITS

    if not requested_units:
        return float(val_celsius), CANONICAL_UNITS

    norm_units = requested_units.strip().lower()
    if norm_units in ["degc", "degrees_c", "celsius", "degree_celsius"]:
        return float(val_celsius), CANONICAL_UNITS
    elif norm_units in ["degk", "k", "kelvin"]:
        return float(val_celsius + 273.15), "kelvin"
    elif norm_units in ["degf", "f", "fahrenheit"]:
        return float(val_celsius * 1.8 + 32.0), "fahrenheit"
    else:
        # Default unchanged
        return float(val_celsius), CANONICAL_UNITS


class ExactQueryEngine:
    """
    Authoritative scientific query engine reading directly from native NetCDF-4 assets.
    Implements Strategy A: opens fresh dataset context per query and materialises values eagerly,
    leaving zero persistent open file descriptors on Windows.
    """

    def __init__(self, repo_root: Optional[Path] = None):
        self.repo_root = Path(repo_root) if repo_root else ManifestLoader(None).repo_root
        self.cache = QueryCache(max_size=10000)

        self._nc_lock = threading.Lock()
        self._nc_path: Optional[Path] = None
        self.resolver: Optional[CoordinateResolver] = None

        self._initialize_source_dataset()

    def _initialize_source_dataset(self) -> None:
        """Locate native NetCDF source dataset and inspect coordinates using safe context manager."""
        rel_path = f"data/raw/copernicus/physical/{DEFAULT_SNAPSHOT_ID}/copernicus_phy_thetao_20260824_20260830.nc"
        abs_path = self.repo_root / rel_path

        if not abs_path.exists():
            raise FileNotFoundError(f"Authoritative native NetCDF source file missing: {rel_path}")

        self._nc_path = abs_path
        # Inspect coordinates under safe temporary context without keeping handle open
        with netCDF4.Dataset(str(abs_path), mode="r") as ds:
            depth_vals = [float(d) for d in ds.variables["depth"][:]] if "depth" in ds.variables else None
            lat_vals = [float(l) for l in ds.variables["latitude"][:]] if "latitude" in ds.variables else None
            lon_vals = [float(l) for l in ds.variables["longitude"][:]] if "longitude" in ds.variables else None

        if depth_vals and lat_vals and lon_vals:
            self.resolver = CoordinateResolver(
                depth_lut=depth_vals,
                min_lat=float(lat_vals[0]),
                max_lat=float(lat_vals[-1]),
                min_lon=float(lon_vals[0]),
                max_lon=float(lon_vals[-1]),
                lat_points=len(lat_vals),
                lon_points=len(lon_vals),
            )
        else:
            self.resolver = CoordinateResolver()

    def validate_identifier(self, identifier: str, param_name: str = "identifier") -> str:
        """Sanitize identifiers against path traversal attacks."""
        if not identifier:
            raise SecurityValidationException(f"Parameter '{param_name}' cannot be empty.")
        if ".." in identifier or "/" in identifier or "\\" in identifier:
            raise SecurityValidationException(
                f"Path traversal attempt detected in '{param_name}': '{identifier}'",
                details={"parameter": param_name, "value": identifier},
            )
        return identifier

    def execute_exact_point_query(self, request: ExactValueQueryRequest) -> ExactValueQueryResponse:
        """
        Execute an authoritative exact-value point query directly from native NetCDF source array.
        """
        self.validate_identifier(request.dataset_id, "dataset_id")
        self.validate_identifier(request.variable_id, "variable_id")

        if request.dataset_id not in [DEFAULT_DATASET_ID, "GLOBAL_ANALYSISFORECAST_PHY_001_024", DEFAULT_SNAPSHOT_ID]:
            raise DatasetNotFoundException(request.dataset_id)

        valid_var_names = [DEFAULT_VARIABLE_ID, "thetao", "temperature", "sea_water_potential_temperature"]
        if request.variable_id not in valid_var_names:
            raise VariableNotFoundException(request.variable_id, request.dataset_id)

        # Cache key for idempotent point queries
        cache_key = (
            f"pt:{request.dataset_id}:{request.variable_id}:{request.latitude_deg:.5f}:"
            f"{request.longitude_deg:.5f}:{request.vertical_selector_type.value}:{request.vertical_target_value}:"
            f"{request.target_time_utc}:{request.selection_interpolation.method.value}:{request.requested_units}"
        )
        cached_resp = self.cache.get(cache_key)
        if cached_resp is not None:
            return cached_resp

        # 1. Resolve coordinates
        lat_idx, lon_idx, resolved_lat, resolved_lon, dist_km = self.resolver.resolve_horizontal(
            latitude_deg=request.latitude_deg,
            longitude_deg=request.longitude_deg,
            selection=request.selection_interpolation,
        )

        depth_idx, resolved_depth_m, depth_delta_m = self.resolver.resolve_vertical(
            selector_type=request.vertical_selector_type,
            target_value=request.vertical_target_value,
            latitude_deg=request.latitude_deg,
            selection=request.selection_interpolation,
        )

        time_idx, resolved_time_utc = self.resolver.resolve_time(
            target_time_utc=request.target_time_utc,
            time_selector_mode=request.time_selector_mode,
        )

        # 2. Extract authoritative raw scalar from NetCDF using safe context manager
        try:
            with netCDF4.Dataset(str(self._nc_path), mode="r") as ds:
                var = ds.variables[RAW_NC_VARIABLE_NAME]
                raw_cell = var[time_idx, depth_idx, lat_idx, lon_idx]
                if (
                    isinstance(raw_cell, np.ma.core.MaskedConstant)
                    or np.ma.is_masked(raw_cell)
                    or math.isnan(raw_cell)
                    or float(raw_cell) > 1e30
                    or math.isclose(float(raw_cell), NC_FILL_VALUE, rel_tol=1e-3)
                ):
                    is_missing = True
                    raw_val = None
                else:
                    is_missing = False
                    raw_val = float(raw_cell)
        except Exception as e:
            raise QueryExecutionException(
                f"Failed to read native NetCDF voxel at index [{time_idx}, {depth_idx}, {lat_idx}, {lon_idx}]: {str(e)}"
            )

        # 3. Evaluate PhysicalCellState and strict missing value preservation
        if is_missing:
            value_state = PhysicalCellState.masked
        else:
            value_state = PhysicalCellState.valid

        # 4. Units conversion
        converted_val, out_units = convert_units(raw_val, request.requested_units)

        provenance = {
            "source_provider": "Copernicus Marine Service",
            "product_id": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
            "storage_layer": "native_netcdf4_tier1",
            "evaluated_indices": {
                "time_index": time_idx,
                "depth_index": depth_idx,
                "latitude_index": lat_idx,
                "longitude_index": lon_idx,
            },
            "horizontal_distance_delta_km": round(dist_km, 4),
            "depth_delta_m": round(depth_delta_m, 4),
            "native_shape": [7, len(self.resolver.depth_lut), self.resolver.lat_points, self.resolver.lon_points],
            "is_authoritative_source_of_truth": True,
        }

        response = ExactValueQueryResponse(
            response_type="authoritative_scientific_value",
            dataset_id=request.dataset_id,
            variable_id=request.variable_id,
            scientific_value=converted_val,
            canonical_units=out_units,
            value_state=value_state,
            requested_latitude_deg=request.latitude_deg,
            requested_longitude_deg=request.longitude_deg,
            resolved_latitude_deg=resolved_lat,
            resolved_longitude_deg=resolved_lon,
            resolved_depth_m=resolved_depth_m,
            resolved_time_utc=resolved_time_utc,
            grid_index_evaluated=[time_idx, depth_idx, lat_idx, lon_idx],
            selection_method_used=request.selection_interpolation.method,
            source_asset_id=SOURCE_ASSET_ID,
            source_asset_sha256=SOURCE_ASSET_SHA256,
            provenance_details=provenance,
        )

        self.cache.set(cache_key, response)
        return response

    def execute_vertical_profile_query(self, request: VerticalProfileQueryRequest) -> VerticalProfileQueryResponse:
        """
        Execute an authoritative 1D vertical profile query extracting the entire column across all levels.
        """
        self.validate_identifier(request.dataset_id, "dataset_id")
        self.validate_identifier(request.variable_id, "variable_id")

        if request.dataset_id not in [DEFAULT_DATASET_ID, "GLOBAL_ANALYSISFORECAST_PHY_001_024", DEFAULT_SNAPSHOT_ID]:
            raise DatasetNotFoundException(request.dataset_id)

        valid_var_names = [DEFAULT_VARIABLE_ID, "thetao", "temperature", "sea_water_potential_temperature"]
        if request.variable_id not in valid_var_names:
            raise VariableNotFoundException(request.variable_id, request.dataset_id)

        # Cache key for profile queries
        cache_key = (
            f"prof:{request.dataset_id}:{request.variable_id}:{request.latitude_deg:.5f}:"
            f"{request.longitude_deg:.5f}:{request.target_time_utc}:{request.requested_units}"
        )
        cached_resp = self.cache.get(cache_key)
        if cached_resp is not None:
            return cached_resp

        # 1. Resolve horizontal and temporal coordinates
        lat_idx, lon_idx, resolved_lat, resolved_lon, dist_km = self.resolver.resolve_horizontal(
            latitude_deg=request.latitude_deg,
            longitude_deg=request.longitude_deg,
            selection=request.selection_interpolation,
        )

        time_idx, resolved_time_utc = self.resolver.resolve_time(
            target_time_utc=request.target_time_utc,
            time_selector_mode=request.time_selector_mode,
        )

        # 2. Extract complete 1D column from native NetCDF array using safe context manager
        try:
            with netCDF4.Dataset(str(self._nc_path), mode="r") as ds:
                var = ds.variables[RAW_NC_VARIABLE_NAME]
                col_data = np.array(var[time_idx, :, lat_idx, lon_idx])
        except Exception as e:
            raise QueryExecutionException(
                f"Failed to read vertical column at index [{time_idx}, :, {lat_idx}, {lon_idx}]: {str(e)}"
            )

        samples: List[VerticalProfileLevelSample] = []
        valid_count = 0
        depth_lut = self.resolver.depth_lut

        for k in range(len(depth_lut)):
            depth_m = float(depth_lut[k])
            raw_cell = col_data[k]

            is_missing = False
            if (
                isinstance(raw_cell, np.ma.core.MaskedConstant)
                or np.ma.is_masked(raw_cell)
                or math.isnan(raw_cell)
                or float(raw_cell) > 1e30
                or math.isclose(float(raw_cell), NC_FILL_VALUE, rel_tol=1e-3)
            ):
                is_missing = True

            if is_missing:
                val = None
                state = PhysicalCellState.masked
            else:
                raw_val = float(raw_cell)
                val, out_units = convert_units(raw_val, request.requested_units)
                state = PhysicalCellState.valid
                valid_count += 1

            samples.append(
                VerticalProfileLevelSample(
                    level_index=k,
                    depth_m=depth_m,
                    scientific_value=val,
                    value_state=state,
                )
            )

        _, out_units = convert_units(20.0, request.requested_units)

        provenance = {
            "source_provider": "Copernicus Marine Service",
            "product_id": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
            "storage_layer": "native_netcdf4_tier1",
            "evaluated_indices": {
                "time_index": time_idx,
                "latitude_index": lat_idx,
                "longitude_index": lon_idx,
            },
            "horizontal_distance_delta_km": round(dist_km, 4),
            "is_authoritative_source_of_truth": True,
        }

        response = VerticalProfileQueryResponse(
            response_type="authoritative_vertical_profile",
            dataset_id=request.dataset_id,
            variable_id=request.variable_id,
            canonical_units=out_units,
            requested_latitude_deg=request.latitude_deg,
            requested_longitude_deg=request.longitude_deg,
            resolved_latitude_deg=resolved_lat,
            resolved_longitude_deg=resolved_lon,
            horizontal_distance_delta_km=round(dist_km, 4),
            resolved_time_utc=resolved_time_utc,
            grid_index_evaluated=[time_idx, lat_idx, lon_idx],
            selection_method_used=request.selection_interpolation.method,
            total_levels=len(depth_lut),
            valid_levels_count=valid_count,
            samples=samples,
            source_asset_id=SOURCE_ASSET_ID,
            source_asset_sha256=SOURCE_ASSET_SHA256,
            provenance_details=provenance,
        )

        self.cache.set(cache_key, response)
        return response

    def execute_reconcile_pick(self, request: ReconcilePickRequest) -> ReconcilePickResponse:
        """
        Reconcile a provisional GPU raycast pick against authoritative native NetCDF ground truth.
        """
        pick = request.provisional_pick

        # Resolve spatial & vertical coordinates
        lat = request.latitude_deg
        lon = request.longitude_deg
        depth = request.depth_m

        if lat is None or lon is None or depth is None:
            # Extract from pick.world_ray_hit_position: [x, y, z]
            pos = pick.world_ray_hit_position
            if len(pos) >= 3:
                x, y, z = pos[0], pos[1], pos[2]
                # Check whether x is longitude [80..88] or [60..68]
                if (70.0 <= x <= 95.0 or 55.0 <= x <= 75.0) and -10.0 <= y <= 25.0:
                    lon = lon if lon is not None else float(x)
                    lat = lat if lat is not None else float(y)
                    depth = depth if depth is not None else float(abs(z))
                elif (70.0 <= y <= 95.0 or 55.0 <= y <= 75.0) and -10.0 <= x <= 25.0:
                    lat = lat if lat is not None else float(x)
                    lon = lon if lon is not None else float(y)
                    depth = depth if depth is not None else float(abs(z))
                else:
                    # Normalized or default bounds mapping
                    lon = lon if lon is not None else 84.0
                    lat = lat if lat is not None else 4.5
                    depth = depth if depth is not None else float(abs(z))

        lat = lat if lat is not None else 4.5
        lon = lon if lon is not None else 84.0
        depth = depth if depth is not None else 0.494

        dataset_id = request.dataset_id or DEFAULT_DATASET_ID
        variable_id = request.variable_id or DEFAULT_VARIABLE_ID

        exact_req = ExactValueQueryRequest(
            dataset_id=dataset_id,
            variable_id=variable_id,
            snapshot_id=request.snapshot_id,
            latitude_deg=lat,
            longitude_deg=lon,
            vertical_selector_type=VerticalSelectorType.PHYSICAL_DEPTH_METERS,
            vertical_target_value=depth,
            time_selector_mode=TimeSelectorMode.EXACT_UTC_TIMESTAMP,
            target_time_utc=request.target_time_utc,
            selection_interpolation=SelectionInterpolationContract(
                method=request.selection_method,
                allows_extrapolation=False,
            ),
        )

        exact_resp = self.execute_exact_point_query(exact_req)

        # Compute difference delta
        abs_diff: Optional[float] = None
        rel_diff_pct: Optional[float] = None
        within_bounds: Optional[bool] = None

        if exact_resp.scientific_value is not None:
            abs_diff = abs(pick.approximate_value - exact_resp.scientific_value)
            if exact_resp.scientific_value != 0.0:
                rel_diff_pct = (abs_diff / abs(exact_resp.scientific_value)) * 100.0
            else:
                rel_diff_pct = 0.0
            within_bounds = abs_diff <= pick.estimated_sample_error_bound

        return ReconcilePickResponse(
            response_type="authoritative_reconciled_pick",
            provisional_value=pick.approximate_value,
            provisional_lod_level=pick.lod_level,
            estimated_sample_error_bound=pick.estimated_sample_error_bound,
            authoritative_response=exact_resp,
            absolute_difference_delta=round(abs_diff, 5) if abs_diff is not None else None,
            relative_difference_percent=round(rel_diff_pct, 4) if rel_diff_pct is not None else None,
            within_estimated_error_bound=within_bounds,
            reconciliation_notice="PROVISIONAL PICK RECONCILED: Evaluated directly from immutable native NetCDF-4 source arrays.",
        )

    def close(self) -> None:
        """Clear query cache and ensure all resources are released."""
        self.cache.clear()
