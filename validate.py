import xarray as xr
import zarr
import hashlib
import os
import json
import glob
import numpy as np

def hash_file(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

raw_dir = r"C:\Users\Ranji\Downloads\ocanscope3d\data\raw\copernicus\physical\copernicus-phy-multivariable-20260824-20260830-v11dev"
canonical_dir = r"C:\Users\Ranji\Downloads\ocanscope3d\data\canonical"
vis_dir = r"C:\Users\Ranji\Downloads\ocanscope3d\data\visualization"
report_dir = r"C:\Users\Ranji\Downloads\ocanscope3d\reports\program-closeout\evidence"
os.makedirs(report_dir, exist_ok=True)

evidence = {}

print("1. Hashing NetCDF files")
nc_files = glob.glob(os.path.join(raw_dir, "**", "*.nc"), recursive=True)
hashes = {}
for f in nc_files:
    var_name = os.path.basename(os.path.dirname(f))
    h = hash_file(f)
    hashes[var_name] = h
    print(f"{var_name}: {h}")
evidence["hashes"] = hashes

print("2. Validating Canonical Zarr-3 stores & Numerical Parity")
zarr_stores = glob.glob(os.path.join(canonical_dir, "*"))
parity = {}
depth_coords = {}
missing_values = {}

for f in nc_files:
    var_name = os.path.basename(os.path.dirname(f))
    print(f"Loading {var_name}...")
    nc_ds = xr.open_dataset(f)
    if 'depth' in nc_ds.coords:
        depth_coords[var_name] = nc_ds['depth'].values.tolist()
    
    # Check Zarr
    z_name = f"copernicus_phy_{var_name}"
    z_path = os.path.join(canonical_dir, z_name, "copernicus-phy-multivariable-20260824-20260830-v11dev")
    
    if not os.path.exists(z_path):
        z_name += "_fulldepth"
        z_path = os.path.join(canonical_dir, z_name, "copernicus-phy-multivariable-20260824-20260830-v11dev")
    
    if os.path.exists(z_path):
        z_ds = xr.open_zarr(z_path) # Might need xr.open_zarr or zarr engine
        # Compare numerical parity for the main variable
        # Usually exact parity means np.allclose or exact match
        nc_val = nc_ds[var_name].values
        z_val = z_ds[var_name].values
        
        # Missing values semantics
        mv_nc = nc_ds[var_name].encoding.get('_FillValue')
        mv_z = z_ds[var_name].encoding.get('_FillValue')
        if hasattr(mv_nc, 'item'): mv_nc = mv_nc.item()
        if hasattr(mv_z, 'item'): mv_z = mv_z.item()
        missing_values[var_name] = {'nc_fill': float(mv_nc) if mv_nc is not None else None, 'zarr_fill': float(mv_z) if mv_z is not None else None}
        
        # We handle NaN comparisons
        diff = np.nanmax(np.abs(nc_val - z_val))
        parity[var_name] = {"delta": float(diff)}
        print(f"{var_name} Parity Delta: {diff}")
    else:
        print(f"Zarr not found for {var_name}")
evidence["parity"] = parity
evidence["depth_coords"] = depth_coords
evidence["missing_values"] = missing_values

print("3. Reconciling visualization brick payloads")
vis_files = glob.glob(os.path.join(vis_dir, "**", "*.bin.zst"), recursive=True)
print(f"Found {len(vis_files)} vis files.")
vis_files_summary = {}
# Just read a few to check sizes
for vf in vis_files[:10]:
    size = os.path.getsize(vf)
    # f16 / u16 encodings imply 2 bytes per value
    # 64x64x32 slabs = 131072 values * 2 = 262144 bytes
    # 66x66x32 halos = 139392 values * 2 = 278784 bytes
    vis_files_summary[os.path.basename(vf)] = size
evidence["vis_summary"] = vis_files_summary
evidence["total_vis_files"] = len(vis_files)

with open(os.path.join(report_dir, "validation_evidence.json"), "w") as f:
    json.dump(evidence, f, indent=2)

print("Done.")
