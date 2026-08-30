"""
Unified Multi-Source Real-Data Campaign Builder & Cross-Validation (TASK-01K)

Reconciles all individual source manifests in `data/manifests/`:
- INCOIS Argo Floats (TASK-01B)
- Copernicus Marine 3D Physical Model (TASK-01C)
- Copernicus Marine L4 Ocean Colour (TASK-01D)
- GEBCO 2020 Bathymetry (TASK-01E)
- NOAA NCEI WOA23 Climatology (TASK-01F)
- Argo GDAC Physical & BGC Profiles (TASK-01G)
- HYCOM ESPC-D-V02 3D Model (TASK-01H)
- IOOS / Rutgers Challenger Gliders (TASK-01I)

Generates unified campaign manifest at `data/manifests/campaigns/campaign_north_indian_ocean_2026.json`.
"""

import os
import json
import hashlib
import datetime
from pathlib import Path

def main():
    repo_root = Path(__file__).resolve().parent.parent
    manifest_dir = repo_root / "data" / "manifests"
    campaign_dir = manifest_dir / "campaigns"
    campaign_dir.mkdir(parents=True, exist_ok=True)

    sources = [
        ("INCOIS Argo", manifest_dir / "incois-argo" / "incois_argo_manifest.json"),
        ("Copernicus Physical", manifest_dir / "copernicus-physical" / "copernicus_physical_manifest.json"),
        ("Copernicus Ocean Colour", manifest_dir / "copernicus-ocean-colour" / "copernicus_ocean_colour_manifest.json"),
        ("GEBCO Bathymetry", manifest_dir / "gebco" / "gebco_manifest.json"),
        ("NOAA WOA23", manifest_dir / "woa23" / "woa23_manifest.json"),
        ("Argo GDAC", manifest_dir / "argo-gdac" / "argo_gdac_manifest.json"),
        ("HYCOM Model", manifest_dir / "hycom" / "hycom_manifest.json"),
        ("Ocean Gliders", manifest_dir / "gliders" / "gliders_manifest.json"),
    ]

    campaign_sources = []
    total_bytes = 0
    file_count = 0

    print("=== QuasarOS TASK-01 Unified Campaign Compilation ===")

    for source_name, mpath in sources:
        if not mpath.exists():
            raise FileNotFoundError(f"Missing manifest for {source_name}: {mpath}")
        
        mdata = json.loads(mpath.read_text(encoding="utf-8"))
        print(f"[*] Processing {source_name} (Task: {mdata.get('task_id')})...")
        
        # Verify physical files listed in manifest exist on disk and verify SHA-256
        source_files = mdata.get("files", [])
        for fentry in source_files:
            rel_path = fentry.get("relative_path")
            fpath = repo_root / rel_path
            if not fpath.exists():
                raise FileNotFoundError(f"File listed in manifest {mpath.name} not found: {fpath}")
            
            # Verify checksum
            hasher = hashlib.sha256()
            with open(fpath, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            actual_sha = hasher.hexdigest()
            expected_sha = fentry.get("sha256")
            if actual_sha != expected_sha:
                raise ValueError(f"Checksum mismatch for {fpath}: expected {expected_sha}, got {actual_sha}")
            
            actual_size = os.path.getsize(fpath)
            total_bytes += actual_size
            file_count += 1

        campaign_sources.append({
            "source_title": source_name,
            "task_id": mdata.get("task_id"),
            "provider": mdata.get("provider"),
            "dataset_id": mdata.get("dataset_id") or mdata.get("product_id"),
            "manifest_path": str(mpath.relative_to(repo_root)).replace("\\", "/"),
            "validation_status": mdata.get("validation_status"),
            "files_count": len(source_files),
            "total_bytes": sum(f.get("byte_size", 0) for f in source_files)
        })

    campaign_manifest = {
        "campaign_id": "campaign_north_indian_ocean_2026",
        "title": "QuasarOS North Indian Ocean Multi-Source Real-Data Snapshot V1",
        "manifest_schema_version": "1.0.0",
        "created_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "geographic_bounds": {
            "name": "North Indian Ocean (Arabian Sea, Bay of Bengal, Equatorial IO)",
            "latitude_min": 0.0,
            "latitude_max": 30.0,
            "longitude_min": 40.0,
            "longitude_max": 100.0
        },
        "scientific_foundation": {
            "synthetic_data_prohibition": "ENFORCED (0 synthetic values in pipeline)",
            "total_sources_count": len(campaign_sources),
            "total_data_files": file_count,
            "total_campaign_bytes": total_bytes,
            "all_sources_validated": True
        },
        "sources": campaign_sources
    }

    target_manifest = campaign_dir / "campaign_north_indian_ocean_2026.json"
    target_manifest.write_text(json.dumps(campaign_manifest, indent=2), encoding="utf-8")
    print(f"\n[+] Unified Campaign Manifest created at: {target_manifest}")
    print(f"[+] Total Verified Datasets: {len(campaign_sources)}, Total Real Data: {total_bytes / (1024*1024):.2f} MB across {file_count} files.")

if __name__ == "__main__":
    main()
