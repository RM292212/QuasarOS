"""
Scientific Analysis Engine for Native Multivariable Ocean Data (ADR-0005)

Thread-Safety Policy (RUNTIME-HOTFIX-03 — Strategy A):
  Every public method opens a fresh xr.Dataset context for the required file,
  materialises the needed subset into an ordinary in-memory NumPy array, and
  closes the dataset before returning.  No xr.Dataset, xr.DataArray, or
  netCDF4.Dataset object is stored in instance or class state, cached, or
  allowed to escape the open block.  This eliminates "NetCDF: Not a valid ID"
  errors caused by closed-handle reuse across AnyIO thread-pool workers.

Root cause that was fixed:
  The previous implementation cached `xr.Dataset` objects in self._datasets.
  Because FastAPI runs synchronous route handlers in thread-pool workers, one
  worker thread could trigger garbage collection or explicit closure of a shared
  handle while another worker thread held a lazy DataArray still backed by that
  same handle.  Calling .values on such an orphaned DataArray raises
  RuntimeError("NetCDF: Not a valid ID").

Scientific authority: native NetCDF-4 files in data/raw/copernicus/physical/.
Files are opened read-only and never mutated.
"""

import os
import glob
import logging
import threading
from typing import Dict, Any, List, Optional

import xarray as xr
import numpy as np
import gsw

logger = logging.getLogger(__name__)

# Allowlisted variables. Surface-only variables have no depth dimension.
_ALLOWED_VARIABLES = {"thetao", "so", "uo", "vo", "zos"}
_SURFACE_ONLY_VARIABLES = {"zos"}

# Path cache: maps variable name → resolved absolute file path (immutable str).
# Only the path string is cached — never the open dataset handle.
_path_cache: Dict[str, str] = {}
_path_cache_lock = threading.Lock()


def _resolve_nc_path(variable: str, raw_base_dir: str = "data/raw/copernicus/physical") -> str:
    """
    Resolve the native NetCDF-4 file path for *variable*, caching the path
    (not the open handle) for subsequent calls.  Raises FileNotFoundError if
    no matching file exists.
    """
    with _path_cache_lock:
        if variable in _path_cache:
            return _path_cache[variable]

    # Search patterns in priority order
    search_roots = [raw_base_dir, "data/raw/copernicus/physical"]
    matches: List[str] = []
    for root in search_roots:
        for pattern in [
            os.path.join(root, f"*{variable}*", "**", "*.nc"),
            os.path.join(root, f"*{variable}*.nc"),
            os.path.join(root, "**", f"*{variable}*.nc"),
        ]:
            found = glob.glob(pattern, recursive=True)
            if found:
                matches.extend(found)
                break
        if matches:
            break

    if not matches:
        raise FileNotFoundError(
            f"Native NetCDF-4 file for variable '{variable}' not found under '{raw_base_dir}'"
        )

    path = sorted(set(matches))[-1]  # latest lexicographically
    with _path_cache_lock:
        _path_cache[variable] = path

    logger.debug("Resolved %s → %s", variable, path)
    return path


class ScientificAnalysisEngine:
    """
    Stateless scientific analysis engine.

    Each method independently opens the required NetCDF-4 file(s), materialises
    the needed data into in-memory NumPy arrays, and closes the file(s) before
    returning.  Instance state holds only configuration strings.
    """

    def __init__(self, raw_base_dir: str = "data/raw/copernicus/physical"):
        self.raw_base_dir = raw_base_dir

    # ------------------------------------------------------------------
    # Volume grid endpoint (H1 fix: per-request open + eager materialise)
    # ------------------------------------------------------------------

    def get_volume_slice_grid(
        self,
        variable: str,
        time_index: int = 0,
        depth_levels: int = 16,
        lat_res: int = 32,
        lon_res: int = 32,
    ) -> Dict[str, Any]:
        """
        Extract a resampled 3-D scalar grid from the native NetCDF-4 file for
        WebGL2/WebGPU volume rendering.

        Access pattern (Strategy A):
          1. Validate inputs before opening any file.
          2. Resolve path (cached as an immutable string).
          3. Open dataset with xr.open_dataset() inside a context manager.
          4. Select and materialise the required subset with .load() or .values
             while the file is still open.
          5. Close the dataset (context manager exit).
          6. Serialise the already-in-memory NumPy array.

        No lazy DataArray escapes this method.
        """
        # --- Input validation (400 before touching filesystem) ---
        if variable not in _ALLOWED_VARIABLES:
            raise ValueError(
                f"Variable '{variable}' not in allowlist {sorted(_ALLOWED_VARIABLES)}"
            )
        if not (0 <= time_index <= 6):
            raise ValueError(f"time_index must be 0–6, got {time_index}")
        if not (1 <= depth_levels <= 50):
            raise ValueError(f"depth_levels must be 1–50, got {depth_levels}")
        if not (2 <= lat_res <= 181):
            raise ValueError(f"lat_res must be 2–181, got {lat_res}")
        if not (2 <= lon_res <= 97):
            raise ValueError(f"lon_res must be 2–97, got {lon_res}")
        max_voxels = 50 * 181 * 97  # full-resolution ceiling
        if depth_levels * lat_res * lon_res > max_voxels:
            raise ValueError(
                f"Requested grid ({depth_levels}×{lat_res}×{lon_res}) "
                f"exceeds maximum {max_voxels} voxels"
            )

        path = _resolve_nc_path(variable, self.raw_base_dir)

        # Per-request open → materialise → close
        with xr.open_dataset(path, mask_and_scale=True, decode_times=True) as ds:
            var_name = next(iter(ds.data_vars))
            da = ds[var_name]

            t_idx = min(time_index, len(ds.time) - 1)
            timestamp_iso = str(ds.time.values[t_idx])[:10]
            da_t = da.isel(time=t_idx)

            is_surface_only = variable in _SURFACE_ONLY_VARIABLES or "depth" not in da_t.dims

            if not is_surface_only:
                n_depth = len(da_t.depth)
                d_indices = [
                    int(i)
                    for i in np.linspace(0, n_depth - 1, min(depth_levels, n_depth))
                ]
                da_sub = da_t.isel(depth=d_indices)
            else:
                da_sub = da_t

            n_lat = len(da_t.latitude)
            n_lon = len(da_t.longitude)
            lat_indices = [
                int(i) for i in np.linspace(0, n_lat - 1, min(lat_res, n_lat))
            ]
            lon_indices = [
                int(i) for i in np.linspace(0, n_lon - 1, min(lon_res, n_lon))
            ]
            da_sub = da_sub.isel(latitude=lat_indices, longitude=lon_indices)

            # Materialise NOW while the file handle is open
            arr: np.ndarray = da_sub.values  # blocking NumPy materialisation
            # arr is now a plain in-memory NumPy array — no NetCDF4 reference

        # Dataset is closed here.  All operations below use ordinary NumPy.
        mask = np.isnan(arr)
        arr_clean = np.where(mask, -999.0, arr)
        valid_vals = arr[~mask]
        min_val = float(np.nanmin(valid_vals)) if valid_vals.size > 0 else 0.0
        max_val = float(np.nanmax(valid_vals)) if valid_vals.size > 0 else 1.0

        logger.info(
            "volume-grid: var=%s t=%d shape=%s min=%.4f max=%.4f surface_only=%s",
            variable, t_idx, arr.shape, min_val, max_val, is_surface_only,
        )

        return {
            "variable": variable,
            "time_index": t_idx,
            "timestamp_iso": timestamp_iso,
            "shape": list(arr.shape),
            "min_val": min_val,
            "max_val": max_val,
            "is_surface_only": is_surface_only,
            "data": arr_clean.flatten().tolist(),
        }

    # ------------------------------------------------------------------
    # TEOS-10 soundings (H2 fix: per-request open + eager materialise)
    # ------------------------------------------------------------------

    def compute_teos10_derived_soundings(
        self, time_index: int, lat: float, lon: float
    ) -> Dict[str, Any]:
        """
        Compute GSW TEOS-10 derived quantities from collocated native thetao/so profiles.
        """
        if variable_errs := self._validate_spatial(lat, lon):
            raise ValueError(variable_errs)
        if not (0 <= time_index <= 6):
            raise ValueError(f"time_index must be 0–6, got {time_index}")

        path_t = _resolve_nc_path("thetao", self.raw_base_dir)
        path_s = _resolve_nc_path("so", self.raw_base_dir)

        with xr.open_dataset(path_t, mask_and_scale=True) as ds_t, \
             xr.open_dataset(path_s, mask_and_scale=True) as ds_s:

            t_idx = min(time_index, len(ds_t.time) - 1)
            da_t_prof = ds_t["thetao"].isel(time=t_idx).sel(
                latitude=lat, longitude=lon, method="nearest"
            )
            da_s_prof = ds_s["so"].isel(time=t_idx).sel(
                latitude=lat, longitude=lon, method="nearest"
            )

            depths = ds_t["depth"].values.copy()   # materialise coords
            temp_c = da_t_prof.values.copy()        # materialise data
            sp_sal = da_s_prof.values.copy()        # materialise data

        # File handles are closed here.
        valid_mask = ~np.isnan(temp_c) & ~np.isnan(sp_sal)
        if not np.any(valid_mask):
            return {"status": "MASKED_WATER_COLUMN", "soundings": []}

        v_depths = depths[valid_mask]
        v_temp = temp_c[valid_mask]
        v_sal = sp_sal[valid_mask]

        pres = gsw.p_from_z(-v_depths, lat)
        sa = gsw.SA_from_SP(v_sal, pres, lon, lat)
        ct = gsw.CT_from_pt(sa, v_temp)
        rho = gsw.rho(sa, ct, pres)
        sound_spd = gsw.sound_speed(sa, ct, pres)

        mld = float(v_depths[0])
        if len(rho) > 1:
            ref_rho = rho[0]
            for d, r in zip(v_depths[1:], rho[1:]):
                if (r - ref_rho) >= 0.03:
                    mld = float(d)
                    break

        soundings = [
            {
                "depth_m": float(v_depths[i]),
                "absolute_salinity_g_kg": float(sa[i]),
                "conservative_temperature_C": float(ct[i]),
                "in_situ_density_kg_m3": float(rho[i]),
                "sound_speed_m_s": float(sound_spd[i]),
            }
            for i in range(len(v_depths))
        ]

        return {
            "status": "SUCCESS",
            "mixed_layer_depth_m": mld,
            "soundings": soundings,
            "gsw_library_version": getattr(gsw, "__version__", "3.6.19"),
        }

    # ------------------------------------------------------------------
    # Transect
    # ------------------------------------------------------------------

    def compute_transect(
        self,
        points: List[Dict[str, float]],
        variable: str = "thetao",
        time_index: int = 0,
    ) -> Dict[str, Any]:
        if variable not in _ALLOWED_VARIABLES:
            raise ValueError(f"Variable '{variable}' not in allowlist")

        path = _resolve_nc_path(variable, self.raw_base_dir)

        with xr.open_dataset(path, mask_and_scale=True) as ds:
            var_name = next(iter(ds.data_vars))
            da = ds[var_name].isel(time=min(time_index, len(ds.time) - 1))
            depths = ds["depth"].values.copy() if "depth" in ds.dims else np.array([0.0])

            transect_soundings = []
            for pt in points:
                prof = da.sel(
                    latitude=pt["latitude"], longitude=pt["longitude"], method="nearest"
                )
                vals = prof.values.tolist()
                transect_soundings.append(
                    {
                        "latitude": pt["latitude"],
                        "longitude": pt["longitude"],
                        "values": vals,
                    }
                )

        return {
            "variable": variable,
            "time_index": time_index,
            "soundings": transect_soundings,
            "depths_m": depths.tolist(),
        }

    # ------------------------------------------------------------------
    # Horizontal slice
    # ------------------------------------------------------------------

    def compute_horizontal_slice(
        self, depth_m: float, variable: str = "thetao", time_index: int = 0
    ) -> Dict[str, Any]:
        if variable not in _ALLOWED_VARIABLES:
            raise ValueError(f"Variable '{variable}' not in allowlist")

        path = _resolve_nc_path(variable, self.raw_base_dir)

        with xr.open_dataset(path, mask_and_scale=True) as ds:
            var_name = next(iter(ds.data_vars))
            da = ds[var_name].isel(time=min(time_index, len(ds.time) - 1))
            if "depth" in da.dims:
                slice_da = da.sel(depth=depth_m, method="nearest")
            else:
                slice_da = da
            arr = slice_da.values.copy()
            lats = ds["latitude"].values.copy()
            lons = ds["longitude"].values.copy()

        arr_clean = np.where(np.isnan(arr), None, arr)
        return {
            "variable": variable,
            "depth_m": depth_m,
            "time_index": time_index,
            "shape": list(arr.shape),
            "latitudes": lats.tolist(),
            "longitudes": lons.tolist(),
            "values": arr_clean.tolist(),
        }

    # ------------------------------------------------------------------
    # Readiness probe — lightweight metadata read (H2 fix)
    # ------------------------------------------------------------------

    def probe_essential_data(self) -> Dict[str, Any]:
        """
        Perform a bounded lightweight read to confirm the essential scientific
        data source is accessible.  Opens and immediately closes the thetao file,
        reading only the time coordinate.  Returns a status dict.
        """
        try:
            path = _resolve_nc_path("thetao", self.raw_base_dir)
            with xr.open_dataset(path, mask_and_scale=False, decode_times=False) as ds:
                n_times = int(ds.dims.get("time", 0))
            return {
                "status": "ok",
                "thetao_file": os.path.basename(path),
                "n_times": n_times,
            }
        except Exception as exc:
            return {"status": "error", "detail": str(exc)}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_spatial(lat: float, lon: float) -> Optional[str]:
        if not (-90.0 <= lat <= 90.0):
            return f"latitude {lat} out of range [-90, 90]"
        if not (-180.0 <= lon <= 180.0):
            return f"longitude {lon} out of range [-180, 180]"
        return None
