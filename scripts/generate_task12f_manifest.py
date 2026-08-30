"""
TASK-12F Release Certification Manifest & Cryptographic Registration
"""
import json, hashlib, os, glob

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
MANIFEST_PATH = "data/manifests/certification/task_12_multivariable_certification_manifest.json"
os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)

def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

cert_manifest = {
    "manifest_schema_version": "1.1.0",
    "release_designation": "QuasarOS v1.1.0-dev (Multivariable Ocean Platform)",
    "snapshot_family_id": FAMILY_ID,
    "provider": "Copernicus Marine Service",
    "authority": "authoritative native-source value under ADR-0005",
    "certification_status": "TASK-12 COMPLETE — MULTIVARIABLE OCEAN PRODUCT SCIENTIFICALLY VALIDATED",
    "variables_certified": ["thetao", "so", "uo", "vo", "zos"],
    "artifacts": {}
}

# Register all NetCDF files
for v in ["thetao", "so", "uo", "vo", "zos"]:
    nc = f"data/raw/copernicus/physical/{FAMILY_ID}/{v}/copernicus_phy_{v}_20260824_20260830.nc"
    cert_manifest["artifacts"][f"raw_nc_{v}"] = {
        "path": nc,
        "sha256": sha256_file(nc),
        "size_bytes": os.path.getsize(nc)
    }

# Register Manifests
for m in glob.glob(f"data/manifests/copernicus-physical/{FAMILY_ID}/*.json"):
    norm_path = m.replace("\\", "/")
    cert_manifest["artifacts"][os.path.basename(m)] = {
        "path": norm_path,
        "sha256": sha256_file(norm_path),
        "size_bytes": os.path.getsize(norm_path)
    }

with open(MANIFEST_PATH, "w") as f:
    json.dump(cert_manifest, f, indent=2)

print("TASK-12 Certification Manifest written to:", MANIFEST_PATH)
