"""
NOAA NCEI WOA23 Multivariable Regional Ingestion and Validation Script (TASK-01X-J)

Fetches regional North Indian Ocean (Lat 0-30N, Lon 40-100E) subsets for August climatology
from NOAA NCEI THREDDS OPeNDAP:
- Salinity (s_an, 0.25 deg)
- Dissolved Oxygen (o_an, 1.00 deg)
- Nitrate (n_an, 1.00 deg)
- Phosphate (p_an, 1.00 deg)
- Silicate (i_an, 1.00 deg)

Saves raw NetCDF-4 regional subsets, calculates SHA-256 checksums, validates physical bounds,
and writes data/manifests/woa23-multivariable/woa23_multivariable_manifest.json.
"""

import os
import sys
import json
import hashlib
import datetime
from pathlib import Path
import numpy as np
import netCDF4 as nc

DATASETS = [
    {
        "name": "salinity",
        "var_name": "s_an",
        "resolution": "0.25 degree",
        "climatological_period": "August (decav 1991-2020)",
        "dataset_id": "woa23_decav_s08_04",
        "url": "https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/salinity/netcdf/decav/0.25/woa23_decav_s08_04.nc",
        "output_filename": "woa23_august_salinity_north_indian_ocean.nc",
        "units": "1",
        "standard_name": "sea_water_practical_salinity",
        "min_valid_range": (0.0, 50.0),
    },
    {
        "name": "oxygen",
        "var_name": "o_an",
        "resolution": "1.00 degree",
        "climatological_period": "August (all 1965-2020)",
        "dataset_id": "woa23_all_o08_01",
        "url": "https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/oxygen/netcdf/all/1.00/woa23_all_o08_01.nc",
        "output_filename": "woa23_august_oxygen_north_indian_ocean.nc",
        "units": "micromoles_per_kilogram",
        "standard_name": "moles_of_oxygen_per_unit_mass_in_sea_water",
        "min_valid_range": (0.0, 500.0),
    },
    {
        "name": "nitrate",
        "var_name": "n_an",
        "resolution": "1.00 degree",
        "climatological_period": "August (all 1965-2020)",
        "dataset_id": "woa23_all_n08_01",
        "url": "https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/nitrate/netcdf/all/1.00/woa23_all_n08_01.nc",
        "output_filename": "woa23_august_nitrate_north_indian_ocean.nc",
        "units": "micromoles_per_kilogram",
        "standard_name": "moles_of_nitrate_per_unit_mass_in_sea_water",
        "min_valid_range": (0.0, 100.0),
    },
    {
        "name": "phosphate",
        "var_name": "p_an",
        "resolution": "1.00 degree",
        "climatological_period": "August (all 1965-2020)",
        "dataset_id": "woa23_all_p08_01",
        "url": "https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/phosphate/netcdf/all/1.00/woa23_all_p08_01.nc",
        "output_filename": "woa23_august_phosphate_north_indian_ocean.nc",
        "units": "micromoles_per_kilogram",
        "standard_name": "moles_of_phosphate_per_unit_mass_in_sea_water",
        "min_valid_range": (0.0, 10.0),
    },
    {
        "name": "silicate",
        "var_name": "i_an",
        "resolution": "1.00 degree",
        "climatological_period": "August (all 1965-2020)",
        "dataset_id": "woa23_all_i08_01",
        "url": "https://www.ncei.noaa.gov/thredds-ocean/dodsC/woa23/DATA/silicate/netcdf/all/1.00/woa23_all_i08_01.nc",
        "output_filename": "woa23_august_silicate_north_indian_ocean.nc",
        "units": "micromoles_per_kilogram",
        "standard_name": "moles_of_silicate_per_unit_mass_in_sea_water",
        "min_valid_range": (0.0, 250.0),
    },
]

def compute_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def fetch_and_save_subset(item: dict, output_dir: Path) -> Path:
    out_file = output_dir / item["output_filename"]
    print(f"\n[+] Fetching {item['name']} ({item['var_name']}) from {item['url']}...")
    
    src_ds = nc.Dataset(item["url"], "r")
    try:
        lats = src_ds.variables["lat"][:]
        lons = src_ds.variables["lon"][:]
        depths = src_ds.variables["depth"][:]
        times = src_ds.variables["time"][:]
        
        # Slicing indices for North Indian Ocean (Lat: 0 to 30N, Lon: 40 to 100E)
        lat_idx = np.where((lats >= 0.0) & (lats <= 30.0))[0]
        lon_idx = np.where((lons >= 40.0) & (lons <= 100.0))[0]
        
        lat_slice = slice(lat_idx[0], lat_idx[-1] + 1)
        lon_slice = slice(lon_idx[0], lon_idx[-1] + 1)
        
        sub_lats = lats[lat_slice]
        sub_lons = lons[lon_slice]
        
        print(f"    Subset shape: Lat {len(sub_lats)} ({sub_lats[0]:.3f} to {sub_lats[-1]:.3f}), Lon {len(sub_lons)} ({sub_lons[0]:.3f} to {sub_lons[-1]:.3f}), Depths {len(depths)}")
        
        # Read primary variable
        var_src = src_ds.variables[item["var_name"]]
        # Shape: (time, depth, lat, lon)
        print(f"    Extracting {item['var_name']} data slice...")
        data_slice = var_src[:, :, lat_slice, lon_slice]
        
        # Create output NetCDF-4
        if out_file.exists():
            out_file.unlink()
            
        dst_ds = nc.Dataset(out_file, "w", format="NETCDF4")
        try:
            # Create dimensions
            dst_ds.createDimension("time", len(times))
            dst_ds.createDimension("depth", len(depths))
            dst_ds.createDimension("lat", len(sub_lats))
            dst_ds.createDimension("lon", len(sub_lons))
            
            # Create coordinate variables
            var_time = dst_ds.createVariable("time", "f4", ("time",))
            var_depth = dst_ds.createVariable("depth", "f4", ("depth",))
            var_lat = dst_ds.createVariable("lat", "f4", ("lat",))
            var_lon = dst_ds.createVariable("lon", "f4", ("lon",))
            
            # Copy coordinate attributes
            for attr in src_ds.variables["time"].ncattrs():
                if attr not in ["_FillValue"]:
                    var_time.setncattr(attr, src_ds.variables["time"].getncattr(attr))
            for attr in src_ds.variables["depth"].ncattrs():
                if attr not in ["_FillValue"]:
                    var_depth.setncattr(attr, src_ds.variables["depth"].getncattr(attr))
            for attr in src_ds.variables["lat"].ncattrs():
                if attr not in ["_FillValue"]:
                    var_lat.setncattr(attr, src_ds.variables["lat"].getncattr(attr))
            for attr in src_ds.variables["lon"].ncattrs():
                if attr not in ["_FillValue"]:
                    var_lon.setncattr(attr, src_ds.variables["lon"].getncattr(attr))
            
            var_time[:] = times
            var_depth[:] = depths
            var_lat[:] = sub_lats
            var_lon[:] = sub_lons
            
            # Create main variable
            fill_val = var_src.getncattr("_FillValue") if "_FillValue" in var_src.ncattrs() else 9.96921e+36
            var_dst = dst_ds.createVariable(item["var_name"], "f4", ("time", "depth", "lat", "lon"), fill_value=fill_val, zlib=True, complevel=4)
            
            for attr in var_src.ncattrs():
                if attr not in ["_FillValue", "_ChunkSizes"]:
                    var_dst.setncattr(attr, var_src.getncattr(attr))
            
            var_dst[:] = data_slice
            
            # Copy global attributes
            dst_ds.title = f"World Ocean Atlas 2023 (WOA23) August Climatology - {item['name'].capitalize()} - Regional North Indian Ocean"
            dst_ds.institution = "National Centers for Environmental Information (NCEI) / NOAA"
            dst_ds.source = item["url"]
            dst_ds.product_id = "WOA23"
            dst_ds.dataset_id = item["dataset_id"]
            dst_ds.climatological_period = item["climatological_period"]
            dst_ds.spatial_resolution = item["resolution"]
            dst_ds.task_id = "TASK-01X-J"
            dst_ds.creation_date_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
        finally:
            dst_ds.close()
            
    finally:
        src_ds.close()
        
    print(f"    Saved {out_file.name} ({out_file.stat().st_size} bytes)")
    return out_file

def validate_subset(filepath: Path, item: dict) -> dict:
    print(f"[*] Validating {filepath.name}...")
    ds = nc.Dataset(filepath, "r")
    try:
        assert item["var_name"] in ds.variables, f"Missing variable {item['var_name']}"
        assert "lat" in ds.variables, "Missing lat"
        assert "lon" in ds.variables, "Missing lon"
        assert "depth" in ds.variables, "Missing depth"
        assert "time" in ds.variables, "Missing time"
        
        lats = ds.variables["lat"][:]
        lons = ds.variables["lon"][:]
        depths = ds.variables["depth"][:]
        data = ds.variables[item["var_name"]][:]
        
        assert 0.0 <= float(lats.min()) <= float(lats.max()) <= 30.0, f"Lat out of bounds: {lats.min()} to {lats.max()}"
        assert 40.0 <= float(lons.min()) <= float(lons.max()) <= 100.0, f"Lon out of bounds: {lons.min()} to {lons.max()}"
        
        # Check physical range of non-fill values
        valid_mask = ~np.isnan(data)
        if hasattr(data, "mask"):
            valid_mask = valid_mask & (~data.mask)
        valid_values = np.asarray(data)[valid_mask]
        
        assert len(valid_values) > 0, f"No valid physical values found in {filepath.name}"
        min_v = float(valid_values.min())
        max_v = float(valid_values.max())
        mean_v = float(valid_values.mean())
        print(f"    Valid points: {len(valid_values)}, Range: [{min_v:.4f}, {max_v:.4f}], Mean: {mean_v:.4f} {item['units']}")
        
        # Verify physical sanity
        min_expected, max_expected = item["min_valid_range"]
        assert min_v >= min_expected, f"Min value {min_v} below physical expectation {min_expected}"
        assert max_v <= max_expected, f"Max value {max_v} above physical expectation {max_expected}"
        
        var_obj = ds.variables[item["var_name"]]
        attrs = {a: str(var_obj.getncattr(a)) for a in var_obj.ncattrs() if a != "_FillValue"}
        fill_val = var_obj.getncattr("_FillValue") if "_FillValue" in var_obj.ncattrs() else None
        
        meta = {
            "dimensions": {k: len(v) for k, v in ds.dimensions.items()},
            "shape": list(data.shape),
            "dtype": str(data.dtype),
            "units": attrs.get("units", item["units"]),
            "standard_name": attrs.get("standard_name", item["standard_name"]),
            "long_name": attrs.get("long_name", ""),
            "fill_value": float(fill_val) if fill_val is not None else None,
            "min_val": min_v,
            "max_val": max_v,
            "mean_val": mean_v,
            "valid_count": int(len(valid_values)),
            "depth_range_m": [float(depths.min()), float(depths.max())],
            "latitude_range_deg": [float(lats.min()), float(lats.max())],
            "longitude_range_deg": [float(lons.min()), float(lons.max())],
        }
        return meta
    finally:
        ds.close()

def main():
    repo_root = Path(__file__).resolve().parent.parent
    raw_dir = repo_root / "data" / "raw" / "woa23" / "multivariable"
    manifest_dir = repo_root / "data" / "manifests" / "woa23-multivariable"
    
    raw_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)
    
    file_records = []
    
    print("=== QuasarOS WOA23 Multivariable Ingestion (TASK-01X-J) ===")
    
    for item in DATASETS:
        out_file = fetch_and_save_subset(item, raw_dir)
        sha256_hash = compute_sha256(out_file)
        byte_size = out_file.stat().st_size
        meta = validate_subset(out_file, item)
        
        rel_path_posix = str(out_file.relative_to(repo_root)).replace("\\", "/")
        
        file_entry = {
            "relative_path": rel_path_posix,
            "filename": out_file.name,
            "product_id": "WOA23",
            "dataset_id": item["dataset_id"],
            "variable_name": item["var_name"],
            "variable_type": item["name"],
            "standard_name": item["standard_name"],
            "units": item["units"],
            "climatological_period": item["climatological_period"],
            "resolution": item["resolution"],
            "source_url": item["url"],
            "byte_size": byte_size,
            "sha256": sha256_hash,
            "format": "NetCDF-4",
            "dimensions": meta["dimensions"],
            "depth_levels_count": meta["dimensions"]["depth"],
            "depth_range_meters": meta["depth_range_m"],
            "spatial_coverage": {
                "latitude_min": meta["latitude_range_deg"][0],
                "latitude_max": meta["latitude_range_deg"][1],
                "longitude_min": meta["longitude_range_deg"][0],
                "longitude_max": meta["longitude_range_deg"][1]
            },
            "statistics": {
                "min": round(meta["min_val"], 4),
                "max": round(meta["max_val"], 4),
                "mean": round(meta["mean_val"], 4),
                "valid_points": meta["valid_count"]
            }
        }
        file_records.append(file_entry)
        
    manifest_path = manifest_dir / "woa23_multivariable_manifest.json"
    manifest_data = {
        "manifest_schema_version": "1.0.0",
        "task_id": "TASK-01X-J",
        "provider": "NOAA NCEI (National Centers for Environmental Information)",
        "product_id": "WOA23-MULTIVARIABLE",
        "product_title": "World Ocean Atlas 2023 Climatology Multivariable Expansion (North Indian Ocean)",
        "retrieval_timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "region": {
            "description": "North Indian Ocean (Arabian Sea, Bay of Bengal, Equatorial Indian Ocean)",
            "latitude_bounds": [0.0, 30.0],
            "longitude_bounds": [40.0, 100.0]
        },
        "climatological_month": "August (08)",
        "variables_included": ["s_an", "o_an", "n_an", "p_an", "i_an"],
        "variable_descriptions": {
            "s_an": "Sea water practical salinity (0.25 deg, decav 1991-2020)",
            "o_an": "Dissolved oxygen concentration (1.00 deg, all 1965-2020, micromoles/kg)",
            "n_an": "Nitrate concentration (1.00 deg, all 1965-2020, micromoles/kg)",
            "p_an": "Phosphate concentration (1.00 deg, all 1965-2020, micromoles/kg)",
            "i_an": "Silicate concentration (1.00 deg, all 1965-2020, micromoles/kg)"
        },
        "files": file_records,
        "licence": "Open Access / Creative Commons CC0 / US Public Domain (NOAA NCEI)",
        "attribution": "NOAA National Centers for Environmental Information (NCEI) World Ocean Atlas 2023",
        "validation_status": "VALIDATED"
    }
    
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
        
    print(f"\n[SUCCESS] Ingestion and validation complete! Manifest written to {manifest_path}")

if __name__ == "__main__":
    main()
