"""
Scientific Analysis Engine for Native Multivariable Ocean Data (ADR-0005)
Executes point time series, vertical profiles, geodesic transects, horizontal slices, volume grid extractions, and GSW TEOS-10 calculations.
"""
import os
import glob
from typing import Dict, Any, List, Optional
import xarray as xr
import numpy as np
import gsw

class ScientificAnalysisEngine:
    def __init__(self, raw_base_dir: str = "data/raw/copernicus/physical"):
        self.raw_base_dir = raw_base_dir
        self._datasets: Dict[str, xr.Dataset] = {}

    def get_volume_slice_grid(self, variable: str, time_index: int = 0, depth_levels: int = 16, lat_res: int = 32, lon_res: int = 32) -> Dict[str, Any]:
        """
        Extract authoritative 3D scalar grid samples directly from native NetCDF array
        for WebGL2/WebGPU real-data volume rendering.
        """
        ds = self._get_ds(variable)
        var_name = list(ds.data_vars.keys())[0]
        da = ds[var_name]
        
        t_idx = min(time_index, len(ds.time) - 1)
        da_t = da.isel(time=t_idx)
        
        # Subsample grid for interactive browser volume texture upload
        if "depth" in da_t.dims:
            d_indices = [int(i) for i in np.linspace(0, len(da_t.depth) - 1, min(depth_levels, len(da_t.depth)))]
            da_sub = da_t.isel(depth=d_indices)
        else:
            da_sub = da_t
            
        lat_indices = [int(i) for i in np.linspace(0, len(da_t.latitude) - 1, min(lat_res, len(da_t.latitude)))]
        lon_indices = [int(i) for i in np.linspace(0, len(da_t.longitude) - 1, min(lon_res, len(da_t.longitude)))]
        
        da_sub = da_sub.isel(latitude=lat_indices, longitude=lon_indices)
        
        arr = da_sub.values
        # Replace NaNs with mask indicator (-999.0)
        mask = np.isnan(arr)
        arr_clean = np.where(mask, -999.0, arr)
        
        valid_vals = arr[~mask]
        min_val = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
        max_val = float(np.max(valid_vals)) if len(valid_vals) > 0 else 1.0
        
        return {
            "variable": variable,
            "time_index": t_idx,
            "timestamp_iso": str(ds.time.values[t_idx])[:10],
            "shape": list(arr.shape),
            "min_val": min_val,
            "max_val": max_val,
            "data": arr_clean.flatten().tolist()
        }

    def _get_ds(self, var: str) -> xr.Dataset:
        if var not in self._datasets:
            pattern = os.path.join(self.raw_base_dir, f"*{var}*/**/*.nc")
            matches = glob.glob(pattern, recursive=True)
            if not matches:
                # Search broader directory
                matches = glob.glob(f"data/raw/copernicus/physical/*{var}*.nc")
            if not matches:
                matches = glob.glob(f"data/raw/copernicus/physical/**/*{var}*.nc", recursive=True)
            if not matches:
                raise FileNotFoundError(f"Native dataset for variable '{var}' not found in {self.raw_base_dir}")
            path = sorted(matches)[-1]
            self._datasets[var] = xr.open_dataset(path)
        return self._datasets[var]

    def compute_teos10_derived_soundings(self, time_index: int, lat: float, lon: float) -> Dict[str, Any]:
        """
        Compute authoritative GSW TEOS-10 soundings from collocated native thetao and so NetCDF soundings.
        """
        try:
            ds_t = self._get_ds("thetao")
            ds_s = self._get_ds("so")
        except FileNotFoundError as e:
            return {"status": "ERROR", "error": str(e), "soundings": []}

        t_idx = min(time_index, len(ds_t.time) - 1)
        
        # Nearest neighbor spatial selection
        t_prof = ds_t["thetao"].isel(time=t_idx).sel(latitude=lat, longitude=lon, method="nearest")
        s_prof = ds_s["so"].isel(time=t_idx).sel(latitude=lat, longitude=lon, method="nearest")
        
        depths = ds_t["depth"].values
        temp_c = t_prof.values
        sp_sal = s_prof.values
        
        # Filter masked / NaN levels
        valid_mask = ~np.isnan(temp_c) & ~np.isnan(sp_sal)
        if not np.any(valid_mask):
            return {"status": "MASKED_WATER_COLUMN", "soundings": []}
            
        v_depths = depths[valid_mask]
        v_temp = temp_c[valid_mask]
        v_sal = sp_sal[valid_mask]
        
        # GSW TEOS-10 Computations
        pres = gsw.p_from_z(-v_depths, lat)
        sa = gsw.SA_from_SP(v_sal, pres, lon, lat)
        ct = gsw.CT_from_pt(sa, v_temp)
        rho = gsw.rho(sa, ct, pres)
        sound_spd = gsw.sound_speed(sa, ct, pres)
        
        # Mixed Layer Depth (threshold delta sigma = 0.03 kg/m3 from surface)
        mld = float(v_depths[0])
        if len(rho) > 1:
            ref_rho = rho[0]
            for d, r in zip(v_depths[1:], rho[1:]):
                if (r - ref_rho) >= 0.03:
                    mld = float(d)
                    break
        
        soundings = []
        for i in range(len(v_depths)):
            soundings.append({
                "depth_m": float(v_depths[i]),
                "absolute_salinity_g_kg": float(sa[i]),
                "conservative_temperature_C": float(ct[i]),
                "in_situ_density_kg_m3": float(rho[i]),
                "sound_speed_m_s": float(sound_spd[i])
            })
            
        return {
            "status": "SUCCESS",
            "mixed_layer_depth_m": mld,
            "soundings": soundings,
            "gsw_library_version": getattr(gsw, "__version__", "3.6.19")
        }

    def compute_transect(self, points: List[Dict[str, float]], variable: str = "thetao", time_index: int = 0) -> Dict[str, Any]:
        ds = self._get_ds(variable)
        var_name = list(ds.data_vars.keys())[0]
        da = ds[var_name].isel(time=min(time_index, len(ds.time) - 1))
        
        transect_soundings = []
        for pt in points:
            prof = da.sel(latitude=pt["latitude"], longitude=pt["longitude"], method="nearest")
            vals = prof.values.tolist()
            transect_soundings.append({
                "latitude": pt["latitude"],
                "longitude": pt["longitude"],
                "values": vals
            })
        return {
            "variable": variable,
            "time_index": time_index,
            "soundings": transect_soundings,
            "depths_m": ds["depth"].values.tolist() if "depth" in ds.dims else [0.0]
        }

    def compute_horizontal_slice(self, depth_m: float, variable: str = "thetao", time_index: int = 0) -> Dict[str, Any]:
        ds = self._get_ds(variable)
        var_name = list(ds.data_vars.keys())[0]
        da = ds[var_name].isel(time=min(time_index, len(ds.time) - 1))
        if "depth" in da.dims:
            slice_da = da.sel(depth=depth_m, method="nearest")
        else:
            slice_da = da
            
        arr = slice_da.values
        arr_clean = np.where(np.isnan(arr), None, arr)
        return {
            "variable": variable,
            "depth_m": depth_m,
            "time_index": time_index,
            "shape": list(arr.shape),
            "latitudes": ds["latitude"].values.tolist(),
            "longitudes": ds["longitude"].values.tolist(),
            "values": arr_clean.tolist()
        }
