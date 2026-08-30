"""
TASK-12C: Multivariable Visualization Brick Generation Pipeline
Uses numcodecs.Zstd to generate standard Zstandard-compressed Float16 and Uint16 payloads.
"""
import xarray as xr, numpy as np, zarr, os, json, hashlib, numcodecs

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
RAW_BASE = f"data/raw/copernicus/physical/{FAMILY_ID}"
VIS_BASE = "data/visualization"
MANIFEST_BASE = "data/manifests/visualization"

codec = numcodecs.Zstd(level=3)

def sha256_bytes(b):
    return hashlib.sha256(b).hexdigest()

def generate_bricks_for_variable(var_name, is_3d=True):
    print(f"\n=======================================================")
    print(f"Generating Visualization Bricks for: {var_name}")
    print(f"=======================================================")
    
    nc_path = f"{RAW_BASE}/{var_name}/copernicus_phy_{var_name}_20260824_20260830.nc"
    ds = xr.open_dataset(nc_path)
    da = ds[var_name]
    
    vis_dir = f"{VIS_BASE}/copernicus_phy_{var_name if var_name != 'thetao' else 'thetao_fulldepth'}/{FAMILY_ID}/v1"
    man_dir = f"{MANIFEST_BASE}/copernicus_phy_{var_name if var_name != 'thetao' else 'thetao_fulldepth'}/{FAMILY_ID}/v1"
    os.makedirs(vis_dir, exist_ok=True)
    os.makedirs(man_dir, exist_ok=True)
    
    arr = da.values # shape: (7, 50, 181, 97) or (7, 181, 97)
    
    # Quantization parameters
    valid_mask = ~np.isnan(arr)
    v_min = float(np.min(arr[valid_mask]))
    v_max = float(np.max(arr[valid_mask]))
    scale_factor = (v_max - v_min) / 65534.0 if v_max > v_min else 1.0
    offset = v_min
    
    manifest = {
        "manifest_schema_version": "1.1.0",
        "family_id": FAMILY_ID,
        "variable": var_name,
        "is_3d": is_3d,
        "quantization": {
            "scale_factor": scale_factor,
            "offset": offset,
            "missing_code": 65535,
            "valid_min": v_min,
            "valid_max": v_max,
            "theoretical_max_error": scale_factor / 2.0
        },
        "bricks": []
    }
    
    num_timesteps = arr.shape[0]
    
    if is_3d:
        # 3D Variable: 2 Vertical Slabs (0:32, 31:50) to preserve non-uniform depth
        slabs = [(0, 32, 0), (31, 50, 1)] # Overlapping level 31 for seamless C0 continuity
        
        for t in range(num_timesteps):
            for z_start, z_end, slab_idx in slabs:
                sub_arr = arr[t, z_start:z_end, :, :] # shape (dz, 181, 97)
                
                # Halo-padded 64x64 sub-volumes
                for bx in range(3):
                    for by in range(2):
                        x_s, x_e = bx * 64, min((bx + 1) * 64, 181)
                        y_s, y_e = by * 64, min((by + 1) * 64, 97)
                        
                        # Extract with 1-voxel halo
                        hx_s, hx_e = max(0, x_s - 1), min(181, x_e + 1)
                        hy_s, hy_e = max(0, y_s - 1), min(97, y_e + 1)
                        
                        core_slice = sub_arr[:, hx_s:hx_e, hy_s:hy_e] # shape (dz, dx_halo, dy_halo)
                        
                        # Pad to fixed chunk 32x66x66 if needed
                        pad_dz = 32 - core_slice.shape[0]
                        pad_dx = 66 - core_slice.shape[1]
                        pad_dy = 66 - core_slice.shape[2]
                        
                        chunk = np.pad(core_slice, ((0, pad_dz), (0, pad_dx), (0, pad_dy)), mode='constant', constant_values=np.nan)
                        
                        # Float16 Payload
                        f16_data = chunk.astype(np.float16).tobytes()
                        f16_compressed = bytes(codec.encode(f16_data))
                        f16_key = f"lod0/t{t}/b_{bx}_{by}_{slab_idx}_f16.bin.zst"
                        f16_path = f"{vis_dir}/{f16_key}"
                        os.makedirs(os.path.dirname(f16_path), exist_ok=True)
                        with open(f16_path, "wb") as f:
                            f.write(f16_compressed)
                            
                        # Uint16 Payload
                        u16_chunk = np.full(chunk.shape, 65535, dtype=np.uint16)
                        valid_c = ~np.isnan(chunk)
                        u16_chunk[valid_c] = np.clip(np.round((chunk[valid_c] - offset) / scale_factor), 0, 65534).astype(np.uint16)
                        u16_data = u16_chunk.tobytes()
                        u16_compressed = bytes(codec.encode(u16_data))
                        u16_key = f"lod0/t{t}/b_{bx}_{by}_{slab_idx}_u16.bin.zst"
                        u16_path = f"{vis_dir}/{u16_key}"
                        with open(u16_path, "wb") as f:
                            f.write(u16_compressed)
                            
                        manifest["bricks"].append({
                            "brick_key": f"vis_{var_name}:{FAMILY_ID}:lod0:t{t}:b{bx}_{by}_{slab_idx}",
                            "time_index": t,
                            "slab_index": slab_idx,
                            "lod": 0,
                            "bx": bx, "by": by,
                            "f16_payload": {
                                "storage_key": f16_key,
                                "sha256": sha256_bytes(f16_compressed),
                                "compressed_bytes": len(f16_compressed)
                            },
                            "u16_payload": {
                                "storage_key": u16_key,
                                "sha256": sha256_bytes(u16_compressed),
                                "compressed_bytes": len(u16_compressed)
                            }
                        })
    else:
        # 2D Surface Field (zos)
        for t in range(num_timesteps):
            sub_arr = arr[t, :, :]
            f16_data = sub_arr.astype(np.float16).tobytes()
            f16_compressed = bytes(codec.encode(f16_data))
            f16_key = f"surface/t{t}/surface_f16.bin.zst"
            f16_path = f"{vis_dir}/{f16_key}"
            os.makedirs(os.path.dirname(f16_path), exist_ok=True)
            with open(f16_path, "wb") as f:
                f.write(f16_compressed)
                
            u16_chunk = np.full(sub_arr.shape, 65535, dtype=np.uint16)
            valid_c = ~np.isnan(sub_arr)
            u16_chunk[valid_c] = np.clip(np.round((sub_arr[valid_c] - offset) / scale_factor), 0, 65534).astype(np.uint16)
            u16_data = u16_chunk.tobytes()
            u16_compressed = bytes(codec.encode(u16_data))
            u16_key = f"surface/t{t}/surface_u16.bin.zst"
            u16_path = f"{vis_dir}/{u16_key}"
            with open(u16_path, "wb") as f:
                f.write(u16_compressed)
                
            manifest["bricks"].append({
                "brick_key": f"vis_{var_name}:{FAMILY_ID}:surface:t{t}",
                "time_index": t,
                "is_surface": True,
                "f16_payload": {
                    "storage_key": f16_key,
                    "sha256": sha256_bytes(f16_compressed),
                    "compressed_bytes": len(f16_compressed)
                },
                "u16_payload": {
                    "storage_key": u16_key,
                    "sha256": sha256_bytes(u16_compressed),
                    "compressed_bytes": len(u16_compressed)
                }
            })

    with open(f"{man_dir}/visualization_manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Generated {len(manifest['bricks'])} brick entries for {var_name}")
    ds.close()

for v in ["thetao", "so", "uo", "vo"]:
    generate_bricks_for_variable(v, is_3d=True)

generate_bricks_for_variable("zos", is_3d=False)

print("\nTASK-12C Visualization Bricking Complete for ALL Variables!")
