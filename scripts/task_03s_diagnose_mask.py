"""Diagnose validity mask mismatch between NetCDF and Zarr store."""
import pathlib
import numpy as np
import zarr
import xarray as xr

REPO_ROOT = pathlib.Path("C:/Users/Ranji/Downloads/ocanscope3d")
SNAPSHOT_ID = "copernicus-phy-thetao-20260824-20260830-ca826087"
NC_PATH = REPO_ROOT / "data/raw/copernicus/physical" / SNAPSHOT_ID / "copernicus_phy_thetao_20260824_20260830.nc"
ZARR_PATH = REPO_ROOT / "data/canonical/copernicus_phy_thetao" / SNAPSHOT_ID

# Open raw (mask_and_scale=False) to see stored values
ds_raw = xr.open_dataset(str(NC_PATH), mask_and_scale=False)
thetao_raw = ds_raw["thetao"]
fill_attr = thetao_raw.attrs.get("_FillValue", "NOT SET")
missing_attr = thetao_raw.attrs.get("missing_value", "NOT SET")
print(f"Raw _FillValue: {fill_attr}")
print(f"Raw missing_value: {missing_attr}")
print(f"Raw dtype: {thetao_raw.dtype}")
raw_vals = thetao_raw.values
print(f"Raw global min: {np.nanmin(raw_vals)}")
print(f"Raw global max: {np.nanmax(raw_vals)}")

# Count fill values if known
std_fill = 9.96921e+36
count_std_fill = int(np.sum(raw_vals >= 1e36))
print(f"Voxels >= 1e36 (standard fill): {count_std_fill}")
ds_raw.close()

# Open decoded
ds = xr.open_dataset(str(NC_PATH))
decoded_vals = ds["thetao"].values.astype("float32")
nc_nan = ~np.isfinite(decoded_vals)
print(f"NaN in decoded NetCDF: {int(np.sum(nc_nan))}")
ds.close()

# Check Zarr mask
store = zarr.open(str(ZARR_PATH), mode="r")
mask = store["validity_mask"][:]
zarr_invalid = (mask == 0)
print(f"Zarr invalid (mask=0): {int(np.sum(zarr_invalid))}")
print(f"Zarr valid   (mask=1): {int(np.sum(mask == 1))}")

# Mismatch analysis
mismatch = (nc_nan != zarr_invalid)
n_mismatch = int(np.sum(mismatch))
print(f"Mismatch voxels: {n_mismatch}")
if n_mismatch > 0:
    nc_nan_not_zarr = nc_nan & ~zarr_invalid
    zarr_not_nc_nan = zarr_invalid & ~nc_nan
    print(f"  NaN in NC but valid in Zarr: {int(np.sum(nc_nan_not_zarr))}")
    print(f"  Invalid in Zarr but finite in NC: {int(np.sum(zarr_not_nc_nan))}")
    # Sample mismatch
    idx = np.argwhere(mismatch)[:5]
    zarr_thetao = store["sea_water_potential_temperature"][:]
    for i in idx:
        t = tuple(i)
        print(f"  idx={t}: nc_nan={nc_nan[t]}, zarr_invalid={zarr_invalid[t]}, decoded={decoded_vals[t]:.4f}, zarr_val={zarr_thetao[t]:.4f}")
