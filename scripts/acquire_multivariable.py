"""
QuasarOS PROGRAM-02 TASK-12B — Real Multivariable Acquisition Script with Exact Dataset IDs
Dataset IDs:
- thetao: cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m
- so:     cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m
- uo:     cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m (or uo/vo)
- vo:     cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m
- zos:    cmems_mod_glo_phy_anfc_0.083deg_P1D-m
"""
import os, sys, hashlib, json, datetime
import copernicusmarine

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
OUTPUT_BASE = f"data/raw/copernicus/physical/{FAMILY_ID}"
MANIFEST_BASE = f"data/manifests/copernicus-physical/{FAMILY_ID}"

VARIABLES = [
    {
        "var": "thetao",
        "dataset_id": "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m",
        "desc": "Sea Water Potential Temperature (full depth)",
        "has_depth": True
    },
    {
        "var": "so",
        "dataset_id": "cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
        "desc": "Sea Water Salinity (full depth)",
        "has_depth": True
    },
    {
        "var": "uo",
        "dataset_id": "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
        "desc": "Eastward Sea Water Velocity (full depth)",
        "has_depth": True
    },
    {
        "var": "vo",
        "dataset_id": "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m",
        "desc": "Northward Sea Water Velocity (full depth)",
        "has_depth": True
    },
    {
        "var": "zos",
        "dataset_id": "cmems_mod_glo_phy_anfc_0.083deg_P1D-m",
        "desc": "Sea Surface Height Above Geoid (2D surface)",
        "has_depth": False
    }
]

os.makedirs(MANIFEST_BASE, exist_ok=True)

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

results = {}

for v in VARIABLES:
    var = v["var"]
    out_dir = f"{OUTPUT_BASE}/{var}"
    os.makedirs(out_dir, exist_ok=True)
    out_file = f"{out_dir}/copernicus_phy_{var}_20260824_20260830.nc"

    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        print(f"[SKIP] {var} already exists at {out_file}")
        digest = sha256_file(out_file)
        results[var] = {"path": out_file, "sha256": digest, "size_bytes": os.path.getsize(out_file), "status": "ok"}
        continue

    print(f"\n[DOWNLOAD] {var} from {v['dataset_id']}: {v['desc']}")
    kwargs = dict(
        dataset_id=v["dataset_id"],
        variables=[var],
        minimum_longitude=60.0,
        maximum_longitude=68.0,
        minimum_latitude=0.0,
        maximum_latitude=15.0,
        start_datetime="2026-08-24T00:00:00",
        end_datetime="2026-08-30T23:59:59",
        output_filename=f"copernicus_phy_{var}_20260824_20260830.nc",
        output_directory=out_dir,
        overwrite=True,
        disable_progress_bar=False,
    )
    if v["has_depth"]:
        kwargs["minimum_depth"] = 0.0
        kwargs["maximum_depth"] = 5728.0

    try:
        copernicusmarine.subset(**kwargs)
        if os.path.exists(out_file):
            digest = sha256_file(out_file)
            size = os.path.getsize(out_file)
            results[var] = {"path": out_file, "sha256": digest, "size_bytes": size, "status": "ok"}
            print(f"  -> OK | size={size:,} bytes | sha256={digest}")
        else:
            results[var] = {"path": out_file, "sha256": None, "status": "ERROR: file not created"}
    except Exception as e:
        results[var] = {"path": out_file, "sha256": None, "status": f"ERROR: {e}"}
        print(f"  -> ERROR: {e}")

print("\n=== Real Data Acquisition Summary ===")
all_ok = True
for var, r in results.items():
    status = r.get("status", "?")
    sha = r.get("sha256", "")
    print(f"  {var}: {status}" + (f" | sha256={sha}" if sha else ""))
    if "ERROR" in status:
        all_ok = False

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
with open(f"{MANIFEST_BASE}/acquisition_results.json", "w") as f:
    json.dump({
        "acquired_at": now,
        "family_id": FAMILY_ID,
        "is_real_data": True,
        "variables": results,
        "all_ok": all_ok
    }, f, indent=2)

sys.exit(0 if all_ok else 1)
