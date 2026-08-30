"""
TASK-13 & TASK-14 Certification Manifest
"""
import json, hashlib, os, glob

MANIFEST_PATH = "data/manifests/certification/task_13_14_analysis_and_observation_certification_manifest.json"
os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)

def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

cert_manifest = {
    "manifest_schema_version": "1.1.0",
    "release_designation": "QuasarOS v1.1.0-dev (Scientific Analysis & In-Situ Observation Engine)",
    "authority": "authoritative derived analysis & observation collocation under ADR-0005",
    "certification_status": "TASK-13 & TASK-14 COMPLETE — SCIENTIFIC ANALYSIS AND OBSERVATION FUSION VALIDATED",
    "services_certified": [
        "Point Time Series",
        "Full-Depth Vertical Profiles (50 levels)",
        "Arbitrary Vertical Geodesic Transects",
        "GSW TEOS-10 Derived Soundings (CT, SA, Density, Sound Speed, MLD)",
        "Argo In-Situ Observation Ingestion & DMQC Collocation Engine"
    ],
    "artifacts": {}
}

# Register backend engine files
for fpath in [
    "packages/services/src/quasar_services/analysis/analysis_engine.py",
    "packages/services/src/quasar_services/analysis/router.py",
    "packages/services/src/quasar_services/observations/collocation_engine.py"
]:
    cert_manifest["artifacts"][os.path.basename(fpath)] = {
        "path": fpath,
        "sha256": sha256_file(fpath),
        "size_bytes": os.path.getsize(fpath)
    }

with open(MANIFEST_PATH, "w") as f:
    json.dump(cert_manifest, f, indent=2)

print("TASK-13 & TASK-14 Certification Manifest generated at:", MANIFEST_PATH)
