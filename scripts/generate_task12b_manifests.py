"""
Generate complete per-variable acquisition manifests and master SnapshotFamilyManifest
"""
import json, hashlib, os, datetime

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
MANIFEST_BASE = f"data/manifests/copernicus-physical/{FAMILY_ID}"
RAW_BASE = f"data/raw/copernicus/physical/{FAMILY_ID}"

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

vars_meta = {
    "thetao": {
        "dataset_id": "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
        "units": "degrees_C",
        "standard_name": "sea_water_potential_temperature",
        "long_name": "Temperature",
        "has_depth": True
    },
    "so": {
        "dataset_id": "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
        "units": "1e-3",
        "standard_name": "sea_water_salinity",
        "long_name": "Salinity",
        "has_depth": True
    },
    "uo": {
        "dataset_id": "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
        "units": "m s-1",
        "standard_name": "eastward_sea_water_velocity",
        "long_name": "Eastward velocity",
        "has_depth": True
    },
    "vo": {
        "dataset_id": "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
        "units": "m s-1",
        "standard_name": "northward_sea_water_velocity",
        "long_name": "Northward velocity",
        "has_depth": True
    },
    "zos": {
        "dataset_id": "cmems_mod_glo_phy_anfc_0.083deg_P1D-m",
        "units": "m",
        "standard_name": "sea_surface_height_above_geoid",
        "long_name": "Sea surface height",
        "has_depth": False
    }
}

family_manifest = {
    "manifest_schema_version": "1.1.0",
    "family_id": FAMILY_ID,
    "product_id": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
    "provider": "Copernicus Marine Service (E.U. Copernicus Programme)",
    "temporal_coverage": {
        "start": "2026-08-24T00:00:00Z",
        "end": "2026-08-30T23:59:59Z",
        "timesteps_count": 7
    },
    "spatial_domain": {
        "lon_min": 60.0,
        "lon_max": 68.0,
        "lat_min": 0.0,
        "lat_max": 15.0
    },
    "depth_coverage": {
        "levels_count": 50,
        "depth_min_m": 0.494025,
        "depth_max_m": 5727.917
    },
    "authority": "authoritative native-source value under ADR-0005",
    "is_real_data": True,
    "is_synthetic_for_development": False,
    "variables": {}
}

for var, meta in vars_meta.items():
    nc_path = f"{RAW_BASE}/{var}/copernicus_phy_{var}_20260824_20260830.nc"
    sha = sha256_file(nc_path)
    size = os.path.getsize(nc_path)
    
    var_manifest = {
        "manifest_schema_version": "1.1.0",
        "family_id": FAMILY_ID,
        "variable": var,
        "product_id": "GLOBAL_ANALYSISFORECAST_PHY_001_024",
        "dataset_id": meta["dataset_id"],
        "standard_name": meta["standard_name"],
        "long_name": meta["long_name"],
        "units": meta["units"],
        "has_depth": meta["has_depth"],
        "source_file": {
            "relative_path": nc_path,
            "byte_size": size,
            "sha256": sha
        },
        "canonical_zarr_path": f"data/canonical/copernicus_phy_{var if var != 'thetao' else 'thetao_fulldepth'}/{FAMILY_ID}",
        "authority": "authoritative native-source value under ADR-0005"
    }
    
    with open(f"{MANIFEST_BASE}/{var}_acquisition_manifest.json", "w") as f:
        json.dump(var_manifest, f, indent=2)
        
    family_manifest["variables"][var] = {
        "dataset_id": meta["dataset_id"],
        "units": meta["units"],
        "standard_name": meta["standard_name"],
        "sha256": sha,
        "byte_size": size,
        "relative_path": nc_path
    }

with open(f"{MANIFEST_BASE}/snapshot_family_manifest.json", "w") as f:
    json.dump(family_manifest, f, indent=2)

print("Master Snapshot Family Manifest and per-variable manifests successfully generated!")
