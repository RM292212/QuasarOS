"""
Canonicalize all 5 real NetCDF files to lossless Zarr stores and verify bitwise parity.
"""
import xarray as xr, zarr, numpy as np, os, json, datetime

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
RAW_BASE = f"data/raw/copernicus/physical/{FAMILY_ID}"
CANONICAL_BASE = "data/canonical"
MANIFEST_BASE = f"data/manifests/copernicus-physical/{FAMILY_ID}"

VARS = [
    {"var": "thetao", "store": f"{CANONICAL_BASE}/copernicus_phy_thetao_fulldepth/{FAMILY_ID}"},
    {"var": "so",     "store": f"{CANONICAL_BASE}/copernicus_phy_so/{FAMILY_ID}"},
    {"var": "uo",     "store": f"{CANONICAL_BASE}/copernicus_phy_uo/{FAMILY_ID}"},
    {"var": "vo",     "store": f"{CANONICAL_BASE}/copernicus_phy_vo/{FAMILY_ID}"},
    {"var": "zos",    "store": f"{CANONICAL_BASE}/copernicus_phy_zos/{FAMILY_ID}"},
]

parity_results = {}

for item in VARS:
    var = item["var"]
    store_path = item["store"]
    nc_path = f"{RAW_BASE}/{var}/copernicus_phy_{var}_20260824_20260830.nc"
    
    os.makedirs(os.path.dirname(store_path), exist_ok=True)
    print(f"\n[CANONICALIZE] {var} -> {store_path}")
    
    ds = xr.open_dataset(nc_path)
    
    # Add CF-1.8 & ADR-0005 lineage attributes
    ds.attrs["quasar_family_id"] = FAMILY_ID
    ds.attrs["quasar_version"] = "1.1.0-dev"
    ds.attrs["quasar_canonical_lossless"] = "true"
    ds.attrs["quasar_authority_statement"] = "Authoritative native-source value under ADR-0005"
    ds.attrs["quasar_canonicalized_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # Write to Zarr store
    ds.to_zarr(store_path, mode="w", consolidated=True)
    ds.close()
    
    # Parity verification: Read back and compare every single float/NaN
    ds_nc = xr.open_dataset(nc_path)
    ds_zarr = xr.open_zarr(store_path, consolidated=True)
    
    arr_nc = ds_nc[var].values
    arr_zarr = ds_zarr[var].values
    
    # Verify shape & dtype
    assert arr_nc.shape == arr_zarr.shape, f"Shape mismatch for {var}"
    assert arr_nc.dtype == arr_zarr.dtype, f"Dtype mismatch for {var}"
    
    # Check NaN mask parity
    nan_nc = np.isnan(arr_nc)
    nan_zarr = np.isnan(arr_zarr)
    assert np.array_equal(nan_nc, nan_zarr), f"NaN mask mismatch for {var}"
    
    # Check valid values parity
    valid_mask = ~nan_nc
    if np.any(valid_mask):
        max_abs_diff = float(np.max(np.abs(arr_nc[valid_mask] - arr_zarr[valid_mask])))
        assert max_abs_diff == 0.0, f"Non-zero diff in valid voxels for {var}: {max_abs_diff}"
    else:
        max_abs_diff = 0.0
        
    total_voxels = int(arr_nc.size)
    valid_voxels = int(np.sum(valid_mask))
    masked_voxels = total_voxels - valid_voxels
    
    parity_results[var] = {
        "netcdf_path": nc_path,
        "zarr_store_path": store_path,
        "shape": list(arr_nc.shape),
        "dtype": str(arr_nc.dtype),
        "total_voxels": total_voxels,
        "valid_voxels": valid_voxels,
        "masked_voxels": masked_voxels,
        "max_abs_difference": max_abs_diff,
        "nan_mask_identical": True,
        "lossless_parity_verified": True
    }
    
    print(f"  -> Total: {total_voxels:,} | Valid: {valid_voxels:,} | Masked: {masked_voxels:,} | MaxDiff: {max_abs_diff}")
    ds_nc.close()
    ds_zarr.close()

with open(f"{MANIFEST_BASE}/task_12b_canonical_parity_results.json", "w") as f:
    json.dump(parity_results, f, indent=2)

with open("task_12b_canonical_parity_results.json", "w") as f:
    json.dump(parity_results, f, indent=2)

print("\nAll 5 real variables successfully canonicalized with ZERO numerical loss!")
