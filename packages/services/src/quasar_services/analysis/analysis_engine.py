"""
Scientific Analysis Engine for Native Multivariable Ocean Data (ADR-0005)
Executes point time series, vertical profiles, geodesic transects, horizontal slices, and GSW TEOS-10 calculations.
"""
import xarray as xr, numpy as np, gsw, os, glob

class ScientificAnalysisEngine:
    def __init__(self, raw_base_dir: str = "data/raw/copernicus/physical"):
        self.raw_base_dir = raw_base_dir
        self._datasets = {}

    def _get_ds(self, var: str):
        if var in self._datasets:
            return self._datasets[var]
        pattern = f"{self.raw_base_dir}/*/{var}/*.nc"
        files = glob.glob(pattern)
        if not files:
            pattern2 = f"{self.raw_base_dir}/copernicus-phy-multivariable-20260824-20260830-v11dev/{var}/*.nc"
            files = glob.glob(pattern2)
        if not files:
            raise FileNotFoundError(f"Native NetCDF-4 source file for variable '{var}' not found in {self.raw_base_dir}")
        path = files[0]
        self._datasets[var] = xr.open_dataset(path)
        return self._datasets[var]

    def query_point_timeseries(self, var: str, lat: float, lon: float, depth_m: float = None):
        ds = self._get_ds(var)
        sub = ds.sel(latitude=lat, longitude=lon, method="nearest")
        if depth_m is not None and "depth" in sub.coords:
            sub = sub.sel(depth=depth_m, method="nearest")
            actual_depth = float(sub.depth.values)
        else:
            actual_depth = 0.494 if "depth" in sub.coords else 0.0

        times = [str(t)[:10] for t in ds.time.values]
        raw_vals = sub[var].values
        if raw_vals.ndim > 1:
            raw_vals = raw_vals[:, 0] if raw_vals.shape[1] > 0 else raw_vals.flatten()
        vals = [None if np.isnan(v) else float(v) for v in raw_vals.flatten()]

        return {
            "variable": var,
            "units": ds[var].attrs.get("units", ""),
            "latitude_query": lat,
            "longitude_query": lon,
            "depth_query_m": depth_m,
            "actual_depth_m": actual_depth,
            "timesteps": times,
            "values": vals,
            "authority": "authoritative native-source value under ADR-0005"
        }

    def query_vertical_profile(self, var: str, time_idx: int, lat: float, lon: float):
        ds = self._get_ds(var)
        if "depth" not in ds.coords:
            raise ValueError(f"Variable '{var}' is a 2D surface variable without depth levels.")
        sub = ds.isel(time=time_idx).sel(latitude=lat, longitude=lon, method="nearest")
        depths = [float(d) for d in ds.depth.values]
        vals = [None if np.isnan(v) else float(v) for v in sub[var].values]

        return {
            "variable": var,
            "units": ds[var].attrs.get("units", ""),
            "time_index": time_idx,
            "time_iso": str(ds.time.values[time_idx])[:19] + "Z",
            "latitude_query": lat,
            "longitude_query": lon,
            "depth_levels_m": depths,
            "values": vals,
            "authority": "authoritative native-source value under ADR-0005"
        }

    def query_transect(self, var: str, time_idx: int, start_lat: float, start_lon: float, end_lat: float, end_lon: float, num_samples: int = 10):
        ds = self._get_ds(var)
        lats = np.linspace(start_lat, end_lat, num_samples)
        lons = np.linspace(start_lon, end_lon, num_samples)
        depths = [float(d) for d in ds.depth.values] if "depth" in ds.coords else [0.0]

        samples = []
        for i in range(num_samples):
            sub = ds.isel(time=time_idx).sel(latitude=lats[i], longitude=lons[i], method="nearest")
            if "depth" in ds.coords:
                v = [None if np.isnan(x) else float(x) for x in sub[var].values]
            else:
                raw_v = sub[var].values.item()
                v = [None if np.isnan(raw_v) else float(raw_v)]
            samples.append({
                "latitude": float(lats[i]),
                "longitude": float(lons[i]),
                "values": v
            })

        return {
            "variable": var,
            "time_index": time_idx,
            "start": {"latitude": start_lat, "longitude": start_lon},
            "end": {"latitude": end_lat, "longitude": end_lon},
            "num_samples": num_samples,
            "depth_levels_m": depths,
            "samples": samples,
            "authority": "authoritative native-source value under ADR-0005"
        }

    def query_horizontal_slice(self, var: str, time_idx: int, depth_m: float = 0.494):
        ds = self._get_ds(var)
        sub = ds.isel(time=time_idx)
        if "depth" in ds.coords:
            sub = sub.sel(depth=depth_m, method="nearest")
            act_depth = float(sub.depth.values)
        else:
            act_depth = 0.0

        return {
            "variable": var,
            "time_index": time_idx,
            "depth_m": act_depth,
            "shape": list(sub[var].shape),
            "authority": "authoritative native-source value under ADR-0005"
        }

    def compute_teos10_derived_soundings(self, time_idx: int, lat: float, lon: float):
        ds_t = self._get_ds("thetao")
        ds_s = self._get_ds("so")
        sub_t = ds_t.isel(time=time_idx).sel(latitude=lat, longitude=lon, method="nearest")
        sub_s = ds_s.isel(time=time_idx).sel(latitude=lat, longitude=lon, method="nearest")

        depths = ds_t.depth.values
        pt = sub_t["thetao"].values
        sp = sub_s["so"].values

        valid_mask = (~np.isnan(pt)) & (~np.isnan(sp))
        if not np.any(valid_mask):
            return {
                "latitude": lat, "longitude": lon, "time_index": time_idx,
                "error": "Selected coordinate is over land or missing data",
                "authority": "scientifically derived result from GSW TEOS-10"
            }

        z = -depths[valid_mask]
        p = gsw.p_from_z(z, lat)
        sa = gsw.SA_from_SP(sp[valid_mask], p, lon, lat)
        ct = gsw.CT_from_pt(sa, pt[valid_mask])
        rho = gsw.rho(sa, ct, p)
        sigma0 = gsw.sigma0(sa, ct)
        cs = gsw.sound_speed(sa, ct, p)

        d_sigma = sigma0 - sigma0[0]
        mld_candidates = np.where(d_sigma >= 0.03)[0]
        mld = float(depths[valid_mask][mld_candidates[0]]) if len(mld_candidates) > 0 else float(depths[valid_mask][-1])

        levels_out = []
        valid_indices = np.where(valid_mask)[0]
        for idx_in_valid, orig_idx in enumerate(valid_indices):
            levels_out.append({
                "depth_m": float(depths[orig_idx]),
                "pressure_dbar": float(p[idx_in_valid]),
                "potential_temp_c": float(pt[orig_idx]),
                "practical_salinity": float(sp[orig_idx]),
                "absolute_salinity_g_kg": float(sa[idx_in_valid]),
                "conservative_temp_c": float(ct[idx_in_valid]),
                "in_situ_density_kg_m3": float(rho[idx_in_valid]),
                "sound_speed_m_s": float(cs[idx_in_valid])
            })

        return {
            "latitude": lat,
            "longitude": lon,
            "time_index": time_idx,
            "gsw_library_version": gsw.__version__,
            "mixed_layer_depth_m": mld,
            "soundings": levels_out,
            "authority": "scientifically derived result from GSW TEOS-10"
        }
