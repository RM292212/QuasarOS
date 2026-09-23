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
import netCDF4
import gsw

logger = logging.getLogger(__name__)

# Allowlisted variables. Surface-only variables have no depth dimension.
_ALLOWED_VARIABLES = {"thetao", "so", "uo", "vo", "zos", "speed"}
_SURFACE_ONLY_VARIABLES = {"zos"}

_VARIABLE_UNITS: Dict[str, str] = {
    "thetao": "degrees_C",
    "so": "1e-3",
    "uo": "m/s",
    "vo": "m/s",
    "zos": "m",
    "speed": "m/s",
}

# Path cache: maps variable name → resolved absolute file path (immutable str).
# Only the path string is cached — never the open dataset handle.
_path_cache: Dict[str, str] = {}
_path_cache_lock = threading.Lock()
_netcdf_io_lock = threading.RLock()

# In-Memory Immutable NumPy Array Cache:
# Caches materialized full-domain NumPy arrays and georeferencing metadata:
# var_name -> {"data": np.ndarray (T, [D], H, W), "times": list[str], "depths": list[float], "lats": np.ndarray, "lons": np.ndarray}
# Pure in-memory NumPy arrays have zero open C-handles and are 100% thread-safe for concurrent read access.
_memory_grid_cache: Dict[str, Dict[str, Any]] = {}
_memory_grid_cache_lock = threading.Lock()



def _resolve_nc_path(variable: str, raw_base_dir: str = "data/raw/copernicus/physical") -> str:
    """
    Resolve the native NetCDF-4 file path for *variable*, caching the path
    (not the open handle) for subsequent calls.  Raises FileNotFoundError if
    no matching file exists.
    """
    with _path_cache_lock:
        if variable in _path_cache:
            return _path_cache[variable]

    # Search patterns in priority order (multivariable 5-variable dataset first)
    search_roots = [raw_base_dir, "data/raw/copernicus/physical"]
    matches: List[str] = []
    for root in search_roots:
        for pattern in [
            os.path.join(root, "*multivariable*", "**", variable, f"*{variable}*.nc"),
            os.path.join(root, "*multivariable*", "**", f"*{variable}*.nc"),
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

    def _get_variable_full_array(self, variable: str) -> Dict[str, Any]:
        """
        Thread-safely fetch materialized NumPy arrays and coordinates for *variable*.
        Caches materialized pure-NumPy data in RAM so that xr.open_dataset is called only once.
        Pure NumPy arrays hold no open C-handles and are thread-safe for parallel slicing.
        """
        with _memory_grid_cache_lock:
            if variable in _memory_grid_cache:
                return _memory_grid_cache[variable]

        # Materialize under I/O lock
        with _netcdf_io_lock:
            with _memory_grid_cache_lock:
                if variable in _memory_grid_cache:
                    return _memory_grid_cache[variable]

            path = _resolve_nc_path(variable, self.raw_base_dir)
            with xr.open_dataset(path, mask_and_scale=True, decode_times=True) as ds:
                var_name = next(iter(ds.data_vars))
                da = ds[var_name]

                times_iso = [str(t)[:10] for t in ds.time.values]
                lats = np.array([float(lat) for lat in ds.latitude.values], dtype=np.float32)
                lons = np.array([float(lon) for lon in ds.longitude.values], dtype=np.float32)

                is_surface = variable in _SURFACE_ONLY_VARIABLES or "depth" not in da.dims
                depths = [float(d) for d in ds.depth.values] if not is_surface else [0.0]

                # Materialize full multidimensional array into RAM
                arr = np.asarray(da.values, dtype=np.float32)

                entry = {
                    "variable": variable,
                    "data": arr,
                    "times": times_iso,
                    "depths": depths,
                    "lats": lats,
                    "lons": lons,
                    "is_surface_only": is_surface,
                }

                with _memory_grid_cache_lock:
                    _memory_grid_cache[variable] = entry
                return entry

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
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        return_numpy: bool = False,
    ) -> Dict[str, Any]:
        """
        Extract a resampled 3-D scalar grid from the native NetCDF-4 file for
        WebGL2/WebGPU volume rendering. Supports georeferenced spatial bounding box slicing.
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

        if variable == "speed":
            entry_u = self._get_variable_full_array("uo")
            entry_v = self._get_variable_full_array("vo")

            t_idx = min(time_index, len(entry_u["times"]) - 1)
            timestamp_iso = entry_u["times"][t_idx]

            full_u_t: np.ndarray = entry_u["data"][t_idx] # (depth, lat, lon)
            full_v_t: np.ndarray = entry_v["data"][t_idx]
            lats = entry_u["lats"]
            lons = entry_u["lons"]
            depths_full = entry_u["depths"]
            is_surface_only = False

            # Compute bounding slice indices
            if min_lat is not None and max_lat is not None:
                lat_start = int(np.searchsorted(lats, min(float(min_lat), float(max_lat)), side="left"))
                lat_end = int(np.searchsorted(lats, max(float(min_lat), float(max_lat)), side="right"))
                lat_start = max(0, min(lat_start, len(lats) - 1))
                lat_end = max(lat_start + 1, min(lat_end, len(lats)))
            else:
                lat_start, lat_end = 0, len(lats)

            if min_lon is not None and max_lon is not None:
                lon_start = int(np.searchsorted(lons, min(float(min_lon), float(max_lon)), side="left"))
                lon_end = int(np.searchsorted(lons, max(float(min_lon), float(max_lon)), side="right"))
                lon_start = max(0, min(lon_start, len(lons) - 1))
                lon_end = max(lon_start + 1, min(lon_end, len(lons)))
            else:
                lon_start, lon_end = 0, len(lons)

            n_depth = len(depths_full)
            n_sub_lat = max(1, lat_end - lat_start)
            n_sub_lon = max(1, lon_end - lon_start)

            d_indices = [int(i) for i in np.linspace(0, n_depth - 1, min(depth_levels, n_depth))]
            sub_lat_idx = [lat_start + int(i) for i in np.linspace(0, n_sub_lat - 1, min(lat_res, n_sub_lat))]
            sub_lon_idx = [lon_start + int(i) for i in np.linspace(0, n_sub_lon - 1, min(lon_res, n_sub_lon))]

            arr_u_sub = full_u_t[np.ix_(d_indices, sub_lat_idx, sub_lon_idx)]
            arr_v_sub = full_v_t[np.ix_(d_indices, sub_lat_idx, sub_lon_idx)]

            depths_m = [float(depths_full[i]) for i in d_indices]
            lats_m = [float(lats[i]) for i in sub_lat_idx]
            lons_m = [float(lons[i]) for i in sub_lon_idx]

            arr = np.sqrt(arr_u_sub**2 + arr_v_sub**2)
        else:
            entry = self._get_variable_full_array(variable)

            t_idx = min(time_index, len(entry["times"]) - 1)
            timestamp_iso = entry["times"][t_idx]

            full_arr_t: np.ndarray = entry["data"][t_idx]
            lats = entry["lats"]
            lons = entry["lons"]
            depths_full = entry["depths"]
            is_surface_only = entry["is_surface_only"]

            # Compute bounding slice indices
            if min_lat is not None and max_lat is not None:
                lat_start = int(np.searchsorted(lats, min(float(min_lat), float(max_lat)), side="left"))
                lat_end = int(np.searchsorted(lats, max(float(min_lat), float(max_lat)), side="right"))
                lat_start = max(0, min(lat_start, len(lats) - 1))
                lat_end = max(lat_start + 1, min(lat_end, len(lats)))
            else:
                lat_start, lat_end = 0, len(lats)

            if min_lon is not None and max_lon is not None:
                lon_start = int(np.searchsorted(lons, min(float(min_lon), float(max_lon)), side="left"))
                lon_end = int(np.searchsorted(lons, max(float(min_lon), float(max_lon)), side="right"))
                lon_start = max(0, min(lon_start, len(lons) - 1))
                lon_end = max(lon_start + 1, min(lon_end, len(lons)))
            else:
                lon_start, lon_end = 0, len(lons)

            n_sub_lat = max(1, lat_end - lat_start)
            n_sub_lon = max(1, lon_end - lon_start)
            sub_lat_idx = [lat_start + int(i) for i in np.linspace(0, n_sub_lat - 1, min(lat_res, n_sub_lat))]
            sub_lon_idx = [lon_start + int(i) for i in np.linspace(0, n_sub_lon - 1, min(lon_res, n_sub_lon))]
            lats_m = [float(lats[i]) for i in sub_lat_idx]
            lons_m = [float(lons[i]) for i in sub_lon_idx]

            if not is_surface_only:
                n_depth = len(depths_full)
                d_indices = [int(i) for i in np.linspace(0, n_depth - 1, min(depth_levels, n_depth))]
                depths_m = [float(depths_full[i]) for i in d_indices]
                arr = full_arr_t[np.ix_(d_indices, sub_lat_idx, sub_lon_idx)]
            else:
                depths_m = [0.0]
                arr = full_arr_t[np.ix_(sub_lat_idx, sub_lon_idx)]

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

        res_dict = {
            "variable": variable,
            "units": _VARIABLE_UNITS.get(variable, "m/s"),
            "time_index": t_idx,
            "timestamp_iso": timestamp_iso,
            "shape": list(arr.shape),
            "depth_m": depths_m,
            "latitude_deg": lats_m,
            "longitude_deg": lons_m,
            "bounds": {
                "min_longitude": lons_m[0] if lons_m else 60.0,
                "max_longitude": lons_m[-1] if lons_m else 68.0,
                "min_latitude": lats_m[0] if lats_m else 0.0,
                "max_latitude": lats_m[-1] if lats_m else 15.0,
            },
            "min_val": min_val,
            "max_val": max_val,
            "is_surface_only": is_surface_only,
        }

        if return_numpy:
            res_dict["numpy_array"] = arr_clean.astype(np.float32)
        else:
            flat_list = arr_clean.flatten().tolist()
            res_dict["data"] = flat_list
            res_dict["scalars"] = flat_list

        return res_dict

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

        with _netcdf_io_lock:
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

        # Compute Brunt-Väisälä frequency squared N^2 if levels >= 2
        try:
            if len(sa) >= 2:
                n2, p_mid = gsw.Nsquared(sa, ct, pres, lat)
                # Pad to same length as levels
                n2_list = [float(n2[0])] + [float(x) for x in n2]
            else:
                n2_list = [0.0] * len(v_depths)
        except Exception:
            n2_list = [0.0] * len(v_depths)

        return {
            "status": "SUCCESS",
            "mixed_layer_depth_m": mld,
            "levels_count": len(soundings),
            "soundings": soundings,
            "depth_m": [s["depth_m"] for s in soundings],
            "conservative_temperature_c": [s["conservative_temperature_C"] for s in soundings],
            "absolute_salinity_g_kg": [s["absolute_salinity_g_kg"] for s in soundings],
            "in_situ_density_kg_m3": [s["in_situ_density_kg_m3"] for s in soundings],
            "sound_speed_m_s": [s["sound_speed_m_s"] for s in soundings],
            "brunt_vaisala_n2_s2": n2_list,
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
            raise ValueError(f"Variable '{variable}' not in allowlist {sorted(_ALLOWED_VARIABLES)}")

        with _netcdf_io_lock:
            if variable == "speed":
                path_u = _resolve_nc_path("uo", self.raw_base_dir)
                path_v = _resolve_nc_path("vo", self.raw_base_dir)
                with xr.open_dataset(path_u, mask_and_scale=True, decode_times=True) as ds_u, \
                     xr.open_dataset(path_v, mask_and_scale=True, decode_times=True) as ds_v:
                    t_idx = min(time_index, len(ds_u.time) - 1)
                    da_u = ds_u["uo"].isel(time=t_idx)
                    da_v = ds_v["vo"].isel(time=t_idx)
                    depths = ds_u["depth"].values.copy() if "depth" in ds_u.dims else np.array([0.0])

                    transect_soundings = []
                    for pt in points:
                        prof_u = da_u.sel(latitude=pt["latitude"], longitude=pt["longitude"], method="nearest")
                        prof_v = da_v.sel(latitude=pt["latitude"], longitude=pt["longitude"], method="nearest")
                        vals_u = prof_u.values.copy()
                        vals_v = prof_v.values.copy()
                        spd = np.sqrt(vals_u**2 + vals_v**2)
                        vals = [None if np.isnan(v) else float(v) for v in spd.tolist()]
                        transect_soundings.append(
                            {
                                "latitude": pt["latitude"],
                                "longitude": pt["longitude"],
                                "values": vals,
                            }
                        )
            else:
                path = _resolve_nc_path(variable, self.raw_base_dir)
                with xr.open_dataset(path, mask_and_scale=True, decode_times=True) as ds:
                    var_name = next(iter(ds.data_vars))
                    t_idx = min(time_index, len(ds.time) - 1)
                    da = ds[var_name].isel(time=t_idx)
                    depths = ds["depth"].values.copy() if "depth" in ds.dims else np.array([0.0])

                    transect_soundings = []
                    for pt in points:
                        prof = da.sel(
                            latitude=pt["latitude"], longitude=pt["longitude"], method="nearest"
                        )
                        vals = [None if np.isnan(v) else float(v) for v in prof.values.tolist()]
                        transect_soundings.append(
                            {
                                "latitude": pt["latitude"],
                                "longitude": pt["longitude"],
                                "values": vals,
                            }
                        )

        return {
            "variable": variable,
            "units": _VARIABLE_UNITS.get(variable, "m/s"),
            "time_index": t_idx,
            "num_samples": len(points),
            "samples": transect_soundings,
            "soundings": transect_soundings,
            "depths_m": [float(d) for d in depths.tolist()],
            "authority": "authoritative native-source value under ADR-0005",
        }

    # ------------------------------------------------------------------
    # Point Time Series & Vertical Profile (TASK-13 / TASK-14 compatibility)
    # ------------------------------------------------------------------

    def query_point_timeseries(
        self,
        variable: str,
        lat: float,
        lon: float,
        depth_m: Optional[float] = None,
    ) -> Dict[str, Any]:
        if variable not in _ALLOWED_VARIABLES:
            raise ValueError(f"Variable '{variable}' not in allowlist {sorted(_ALLOWED_VARIABLES)}")
        if err := self._validate_spatial(lat, lon):
            raise ValueError(err)

        with _netcdf_io_lock:
            if variable == "speed":
                path_u = _resolve_nc_path("uo", self.raw_base_dir)
                path_v = _resolve_nc_path("vo", self.raw_base_dir)
                with xr.open_dataset(path_u, mask_and_scale=True, decode_times=True) as ds_u, \
                     xr.open_dataset(path_v, mask_and_scale=True, decode_times=True) as ds_v:
                    da_u = ds_u["uo"]
                    da_v = ds_v["vo"]
                    if "depth" in da_u.dims and depth_m is not None:
                        da_u_pt = da_u.sel(latitude=lat, longitude=lon, depth=depth_m, method="nearest")
                        da_v_pt = da_v.sel(latitude=lat, longitude=lon, depth=depth_m, method="nearest")
                    else:
                        da_u_pt = da_u.sel(latitude=lat, longitude=lon, method="nearest")
                        da_v_pt = da_v.sel(latitude=lat, longitude=lon, method="nearest")

                    times = [str(t)[:10] for t in ds_u.time.values]
                    vals_u = da_u_pt.values.copy()
                    vals_v = da_v_pt.values.copy()
                    vals = np.sqrt(vals_u**2 + vals_v**2)
            else:
                path = _resolve_nc_path(variable, self.raw_base_dir)
                with xr.open_dataset(path, mask_and_scale=True, decode_times=True) as ds:
                    var_name = next(iter(ds.data_vars))
                    da = ds[var_name]
                    if "depth" in da.dims and depth_m is not None:
                        da_pt = da.sel(latitude=lat, longitude=lon, depth=depth_m, method="nearest")
                    else:
                        da_pt = da.sel(latitude=lat, longitude=lon, method="nearest")

                    times = [str(t)[:10] for t in ds.time.values]
                    vals = da_pt.values.copy()

        # Clean NaNs to None for clean JSON serialization
        clean_vals = [None if np.isnan(v) else float(v) for v in vals]
        return {
            "variable": variable,
            "units": _VARIABLE_UNITS.get(variable, "m/s"),
            "latitude": lat,
            "longitude": lon,
            "depth_m": depth_m,
            "timesteps": times,
            "values": clean_vals,
        }

    def query_vertical_profile(
        self,
        variable: str,
        time_index: int,
        lat: float,
        lon: float,
    ) -> Dict[str, Any]:
        if variable not in _ALLOWED_VARIABLES:
            raise ValueError(f"Variable '{variable}' not in allowlist {sorted(_ALLOWED_VARIABLES)}")
        if err := self._validate_spatial(lat, lon):
            raise ValueError(err)

        with _netcdf_io_lock:
            if variable == "speed":
                path_u = _resolve_nc_path("uo", self.raw_base_dir)
                path_v = _resolve_nc_path("vo", self.raw_base_dir)
                with xr.open_dataset(path_u, mask_and_scale=True, decode_times=True) as ds_u, \
                     xr.open_dataset(path_v, mask_and_scale=True, decode_times=True) as ds_v:
                    t_idx = min(time_index, len(ds_u.time) - 1)
                    da_u = ds_u["uo"].isel(time=t_idx).sel(latitude=lat, longitude=lon, method="nearest")
                    da_v = ds_v["vo"].isel(time=t_idx).sel(latitude=lat, longitude=lon, method="nearest")
                    depths = ds_u["depth"].values.copy() if "depth" in ds_u.dims else np.array([0.0])
                    vals_u = da_u.values.copy()
                    vals_v = da_v.values.copy()
                    vals = np.sqrt(vals_u**2 + vals_v**2)
            else:
                path = _resolve_nc_path(variable, self.raw_base_dir)
                with xr.open_dataset(path, mask_and_scale=True, decode_times=True) as ds:
                    var_name = next(iter(ds.data_vars))
                    t_idx = min(time_index, len(ds.time) - 1)
                    da = ds[var_name].isel(time=t_idx).sel(latitude=lat, longitude=lon, method="nearest")
                    depths = ds["depth"].values.copy() if "depth" in ds.dims else np.array([0.0])
                    vals = da.values.copy()

        clean_vals = [None if np.isnan(v) else float(v) for v in vals]
        return {
            "variable": variable,
            "units": _VARIABLE_UNITS.get(variable, "m/s"),
            "time_index": t_idx,
            "latitude": lat,
            "longitude": lon,
            "depth_levels_m": [float(d) for d in depths],
            "values": clean_vals,
        }

    # ------------------------------------------------------------------
    # Horizontal slice
    # ------------------------------------------------------------------

    def compute_horizontal_slice(
        self, depth_m: float, variable: str = "thetao", time_index: int = 0
    ) -> Dict[str, Any]:
        if variable not in _ALLOWED_VARIABLES:
            raise ValueError(f"Variable '{variable}' not in allowlist {sorted(_ALLOWED_VARIABLES)}")

        with _netcdf_io_lock:
            if variable == "speed":
                path_u = _resolve_nc_path("uo", self.raw_base_dir)
                path_v = _resolve_nc_path("vo", self.raw_base_dir)
                with xr.open_dataset(path_u, mask_and_scale=True, decode_times=True) as ds_u, \
                     xr.open_dataset(path_v, mask_and_scale=True, decode_times=True) as ds_v:
                    t_idx = min(time_index, len(ds_u.time) - 1)
                    da_u = ds_u["uo"].isel(time=t_idx)
                    da_v = ds_v["vo"].isel(time=t_idx)
                    if "depth" in da_u.dims:
                        slice_u = da_u.sel(depth=depth_m, method="nearest")
                        slice_v = da_v.sel(depth=depth_m, method="nearest")
                    else:
                        slice_u = da_u
                        slice_v = da_v
                    arr_u = slice_u.values.copy()
                    arr_v = slice_v.values.copy()
                    arr = np.sqrt(arr_u**2 + arr_v**2)
                    lats = ds_u["latitude"].values.copy()
                    lons = ds_u["longitude"].values.copy()
            else:
                path = _resolve_nc_path(variable, self.raw_base_dir)
                with xr.open_dataset(path, mask_and_scale=True, decode_times=True) as ds:
                    var_name = next(iter(ds.data_vars))
                    t_idx = min(time_index, len(ds.time) - 1)
                    da = ds[var_name].isel(time=t_idx)
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
            "units": _VARIABLE_UNITS.get(variable, "m/s"),
            "depth_m": depth_m,
            "time_index": t_idx,
            "shape": list(arr.shape),
            "latitudes": lats.tolist(),
            "longitudes": lons.tolist(),
            "values": arr_clean.tolist(),
            "scalars": arr_clean.flatten().tolist(),
        }

    # ------------------------------------------------------------------
    # Bathymetry & Coastlines (Wave VR4)
    # ------------------------------------------------------------------

    def get_bathymetry_grid(
        self,
        min_lon: float = 60.0,
        max_lon: float = 68.0,
        min_lat: float = 0.0,
        max_lat: float = 15.0,
        lat_res: int = 32,
        lon_res: int = 32,
    ) -> Dict[str, Any]:
        """
        Extract georeferenced GEBCO bathymetry heightfield grid for the Arabian Sea domain.
        Returns elevation (meters above sea level) and depth (meters below sea surface).
        """
        if min_lon >= max_lon:
            raise ValueError(f"min_lon ({min_lon}) must be less than max_lon ({max_lon})")
        if min_lat >= max_lat:
            raise ValueError(f"min_lat ({min_lat}) must be less than max_lat ({max_lat})")
        if not (2 <= lat_res <= 301):
            raise ValueError(f"lat_res must be between 2 and 301, got {lat_res}")
        if not (2 <= lon_res <= 601):
            raise ValueError(f"lon_res must be between 2 and 601, got {lon_res}")

        # Resolve GEBCO NetCDF path
        gebco_candidates = [
            os.path.join("data", "raw", "gebco", "gebco-2026", "gebco_2026_north_indian_ocean.nc"),
            os.path.join("data", "raw", "gebco", "gebco_2020_north_indian_ocean.nc"),
        ]
        gebco_path = None
        for p in gebco_candidates:
            if os.path.exists(p):
                gebco_path = p
                break
        if not gebco_path:
            raise FileNotFoundError("GEBCO bathymetry NetCDF dataset not found")

        with _netcdf_io_lock:
            with xr.open_dataset(gebco_path) as ds:
                lat_var = "lat" if "lat" in ds.coords or "lat" in ds.variables else "latitude"
                lon_var = "lon" if "lon" in ds.coords or "lon" in ds.variables else "longitude"

                target_lats = np.linspace(min_lat, max_lat, lat_res)
                target_lons = np.linspace(min_lon, max_lon, lon_res)

                elev_da = ds["elevation"]
                if hasattr(elev_da, "interp"):
                    try:
                        interp_da = elev_da.interp({lat_var: target_lats, lon_var: target_lons}, method="linear")
                        elev_grid = interp_da.values
                    except Exception:
                        elev_grid = elev_da.sel({lat_var: target_lats, lon_var: target_lons}, method="nearest").values
                else:
                    elev_grid = elev_da.sel({lat_var: target_lats, lon_var: target_lons}, method="nearest").values

                elev_arr = np.nan_to_num(elev_grid, nan=-100.0)


        depth_arr = np.maximum(0.0, -elev_arr)
        min_elev = float(np.min(elev_arr))
        max_elev = float(np.max(elev_arr))
        min_depth = float(np.min(depth_arr))
        max_depth = float(np.max(depth_arr))

        max_domain_depth = 5727.917
        normalized_seafloor = np.clip(depth_arr / max_domain_depth, 0.0, 1.0)

        return {
            "source": "GEBCO_2026_North_Indian_Ocean",
            "min_longitude": float(min_lon),
            "max_longitude": float(max_lon),
            "min_latitude": float(min_lat),
            "max_latitude": float(max_lat),
            "shape": [int(lat_res), int(lon_res)],
            "latitudes": [float(x) for x in target_lats],
            "longitudes": [float(x) for x in target_lons],
            "elevations_m": [float(x) for x in elev_arr.flatten()],
            "depths_m": [float(x) for x in depth_arr.flatten()],
            "normalized_seafloor_depths": [float(x) for x in normalized_seafloor.flatten()],
            "min_elevation_m": min_elev,
            "max_elevation_m": max_elev,
            "min_depth_m": min_depth,
            "max_depth_m": max_depth,
            "land_cells_count": int(np.sum(elev_arr >= 0)),
            "ocean_cells_count": int(np.sum(elev_arr < 0)),
        }

    def get_coastlines(
        self,
        min_lon: float = 40.0,
        max_lon: float = 100.0,
        min_lat: float = 0.0,
        max_lat: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Return authoritative vector coastline polyline segments for the Arabian Sea / North Indian Ocean.
        """
        # Arabian Sea regional coastline vectors (India West Coast, Gujarat, Pakistan, Oman, Yemen, Somalia, Sri Lanka, Maldives)
        raw_polylines = [
            # India West Coast: Gujarat -> Mumbai -> Goa -> Kerala -> Cape Comorin
            [
                [68.5, 23.8], [69.2, 23.0], [70.0, 22.8], [70.2, 22.4], [69.0, 22.3],
                [69.5, 21.6], [70.5, 20.8], [72.0, 21.0], [72.8, 21.2], [72.8, 19.0],
                [73.0, 18.0], [73.5, 16.0], [74.5, 14.5], [75.5, 12.0], [76.5, 10.0],
                [77.0, 8.5], [77.5, 8.1]
            ],
            # Sri Lanka outline
            [
                [79.8, 9.8], [80.3, 9.8], [80.6, 9.2], [81.3, 8.6], [81.8, 7.5],
                [81.8, 6.8], [81.3, 6.2], [80.5, 5.9], [80.0, 6.2], [79.8, 7.0],
                [79.8, 8.0], [79.8, 9.8]
            ],
            # Pakistan / Makran Coast -> Indus Delta
            [
                [61.5, 25.2], [62.5, 25.3], [64.0, 25.3], [66.0, 25.2], [66.8, 24.8],
                [67.5, 24.0], [68.2, 23.9]
            ],
            # Arabian Peninsula: Oman & Yemen (Ras al Hadd -> Salalah -> Aden -> Bab-el-Mandeb)
            [
                [59.8, 22.5], [59.0, 21.0], [58.0, 20.2], [56.0, 18.0], [54.0, 16.8],
                [52.5, 15.6], [50.0, 14.8], [48.0, 14.0], [45.0, 12.8], [43.5, 12.6]
            ],
            # Horn of Africa / Somalia Coast
            [
                [43.5, 11.8], [45.0, 10.5], [48.0, 11.2], [51.2, 11.8], [50.8, 9.5],
                [49.0, 7.0], [47.5, 5.0], [45.0, 2.5], [42.5, 0.0]
            ],
            # Maldives Archipelago Ridge & Atolls
            [
                [73.1, 7.1], [72.9, 5.9], [73.5, 4.2], [73.4, 2.0], [73.2, 0.5],
                [73.1, -0.6]
            ],
            # Lakshadweep Islands Chain
            [
                [72.6, 12.4], [72.2, 11.7], [72.8, 10.6], [73.6, 10.1], [73.0, 8.3]
            ],
            # India East Coast: Cape Comorin -> Chennai -> Visakhapatnam -> Odisha -> Sundarbans
            [
                [77.5, 8.1], [78.2, 9.1], [79.2, 9.3], [79.8, 10.3], [80.3, 13.1],
                [80.3, 15.5], [82.3, 16.8], [83.3, 17.7], [85.0, 19.3], [86.9, 20.5],
                [88.0, 21.6], [89.0, 21.9]
            ],
            # Bangladesh / Bengal Delta & Myanmar
            [
                [89.0, 21.9], [90.5, 22.0], [91.8, 22.3], [92.0, 21.0], [92.5, 20.2],
                [94.0, 18.0], [94.5, 16.0], [96.0, 16.0], [98.0, 16.0], [98.5, 12.0],
                [99.0, 8.0]
            ],
            # Andaman and Nicobar Islands Chain
            [
                [92.8, 13.5], [92.9, 12.5], [92.7, 11.5], [92.8, 9.2], [93.8, 7.0], [93.9, 6.8]
            ],
        ]

        clipped_features = []
        for poly in raw_polylines:
            coords = []
            for pt in poly:
                coords.append([float(pt[0]), float(pt[1])])
            clipped_features.append({
                "type": "LineString",
                "coordinates": coords,
            })

        return {
            "type": "FeatureCollection",
            "domain": {
                "min_longitude": min_lon,
                "max_longitude": max_lon,
                "min_latitude": min_lat,
                "max_latitude": max_lat,
            },
            "features_count": len(clipped_features),
            "features": clipped_features,
        }

    # ------------------------------------------------------------------
    # Readiness probe — lightweight metadata read (H2 fix)
    # ------------------------------------------------------------------

    def probe_essential_data(self) -> Dict[str, Any]:
        """
        Perform a bounded lightweight read to confirm the essential scientific
        data source is accessible.  Opens and immediately closes the thetao file,
        reading only the time coordinate via netCDF4.  Returns a status dict.
        Using netCDF4 directly avoids triggering external network calls via xarray backend plugins.
        """
        try:
            path = _resolve_nc_path("thetao", self.raw_base_dir)
            with _netcdf_io_lock:
                with netCDF4.Dataset(path, "r") as ds:
                    time_dim = ds.dimensions.get("time")
                    n_times = len(time_dim) if time_dim is not None else 0
            return {
                "status": "ok",
                "thetao_file": os.path.basename(path),
                "n_times": n_times,
                "timesteps_available": n_times,
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

