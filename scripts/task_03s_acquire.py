#!/usr/bin/env python3
"""
TASK-03S-B: Secure acquisition of the current seven-day Copernicus thetao snapshot.

Credentials are loaded from environment / .env file.
No credentials are printed, logged, or stored in manifests.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import sys
import tempfile
import shutil
from datetime import datetime, timezone

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / ".env")
except ImportError:
    pass  # dotenv optional; env vars must already be set

# Acquisition parameters from TASK-03S-A preflight
PRODUCT_ID = "GLOBAL_ANALYSISFORECAST_PHY_001_024"
DATASET_ID = "cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m"
VARIABLE = "thetao"

# Reconciled first-volume domain
MINIMUM_LONGITUDE = 80.0
MAXIMUM_LONGITUDE = 88.0
MINIMUM_LATITUDE = -3.0
MAXIMUM_LATITUDE = 12.0
MINIMUM_DEPTH = 0.494
MAXIMUM_DEPTH = 453.938

# Seven-day window (from preflight)
START_DATETIME = "2026-08-24T00:00:00"
END_DATETIME   = "2026-08-30T23:59:59"

# Snapshot identity
SNAPSHOT_START = "20260824"
SNAPSHOT_END   = "20260830"


def sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    import copernicusmarine

    acquisition_time_utc = datetime.now(timezone.utc).isoformat()
    print(f"[TASK-03S-B] Acquisition time UTC: {acquisition_time_utc}")
    print(f"[TASK-03S-B] Product:  {PRODUCT_ID}")
    print(f"[TASK-03S-B] Dataset:  {DATASET_ID}")
    print(f"[TASK-03S-B] Variable: {VARIABLE}")
    print(f"[TASK-03S-B] Window:   {START_DATETIME} -> {END_DATETIME}")
    print(f"[TASK-03S-B] Domain:   lon=[{MINIMUM_LONGITUDE},{MAXIMUM_LONGITUDE}] lat=[{MINIMUM_LATITUDE},{MAXIMUM_LATITUDE}]")
    print(f"[TASK-03S-B] Depth:    [{MINIMUM_DEPTH}, {MAXIMUM_DEPTH}] m")

    # Compute short snapshot ID (will be filled once SHA known)
    # Use a temp name first, rename after SHA computed
    tmp_dir = REPO_ROOT / "data" / "raw" / "copernicus" / "physical" / f"_tmp_task03s_{SNAPSHOT_START}_{SNAPSHOT_END}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_nc = tmp_dir / f"copernicus_phy_thetao_{SNAPSHOT_START}_{SNAPSHOT_END}.nc"

    print(f"[TASK-03S-B] Downloading to temp: {tmp_nc}")

    # Submit subset request
    copernicusmarine.subset(
        dataset_id=DATASET_ID,
        variables=[VARIABLE],
        minimum_longitude=MINIMUM_LONGITUDE,
        maximum_longitude=MAXIMUM_LONGITUDE,
        minimum_latitude=MINIMUM_LATITUDE,
        maximum_latitude=MAXIMUM_LATITUDE,
        minimum_depth=MINIMUM_DEPTH,
        maximum_depth=MAXIMUM_DEPTH,
        start_datetime=START_DATETIME,
        end_datetime=END_DATETIME,
        output_directory=str(tmp_dir),
        output_filename=tmp_nc.name,
        overwrite=True,
        force_download=True,
    )

    if not tmp_nc.exists():
        # copernicusmarine may use a slightly different filename
        nc_files = list(tmp_dir.glob("*.nc"))
        if not nc_files:
            print("[TASK-03S-B] ERROR: No .nc file found after download.")
            return 1
        tmp_nc = nc_files[0]

    file_size = tmp_nc.stat().st_size
    print(f"[TASK-03S-B] Downloaded: {tmp_nc.name} ({file_size:,} bytes)")

    # Compute SHA-256
    sha256 = sha256_file(tmp_nc)
    short_sha = sha256[:8]
    print(f"[TASK-03S-B] SHA-256: {sha256}")

    # Build snapshot ID and final paths
    snapshot_id = f"copernicus-phy-thetao-{SNAPSHOT_START}-{SNAPSHOT_END}-{short_sha}"
    final_raw_dir = REPO_ROOT / "data" / "raw" / "copernicus" / "physical" / snapshot_id
    final_nc = final_raw_dir / f"copernicus_phy_thetao_{SNAPSHOT_START}_{SNAPSHOT_END}.nc"
    manifest_dir = REPO_ROOT / "data" / "manifests" / "copernicus-physical" / snapshot_id
    canonical_zarr_dir = REPO_ROOT / "data" / "canonical" / "copernicus_phy_thetao" / snapshot_id

    # Quick open validation
    import xarray as xr
    ds = xr.open_dataset(str(tmp_nc))
    print(f"[TASK-03S-B] Dimensions: {dict(ds.sizes)}")
    assert "thetao" in ds, "thetao variable missing!"
    actual_times = [str(t)[:10] for t in ds.time.values]
    print(f"[TASK-03S-B] Timestamps: {actual_times}")
    ds.close()

    # Atomic publish: rename tmp dir to final snapshot dir
    if final_raw_dir.exists():
        shutil.rmtree(final_raw_dir)
    tmp_dir.rename(final_raw_dir)
    # Rename the nc file if needed
    actual_nc = list(final_raw_dir.glob("*.nc"))[0]
    if actual_nc.name != final_nc.name:
        actual_nc.rename(final_nc)
    print(f"[TASK-03S-B] Published to: {final_raw_dir}")

    # Write acquisition manifest
    manifest_dir.mkdir(parents=True, exist_ok=True)
    acquisition_manifest = {
        "manifest_schema_version": "1.0.0",
        "task_id": "TASK-03S-B",
        "snapshot_id": snapshot_id,
        "acquisition_time_utc": acquisition_time_utc,
        "provider": "Copernicus Marine Service (E.U. Copernicus Programme)",
        "product_id": PRODUCT_ID,
        "dataset_id": DATASET_ID,
        "variable": VARIABLE,
        "temporal_classification": "OPERATIONAL_CURRENT_SNAPSHOT",
        "source_classification": "api_generated_netcdf_subset",
        "start_datetime_utc": START_DATETIME,
        "end_datetime_utc": END_DATETIME,
        "timestamps_requested": [
            "2026-08-24T00:00:00Z", "2026-08-25T00:00:00Z",
            "2026-08-26T00:00:00Z", "2026-08-27T00:00:00Z",
            "2026-08-28T00:00:00Z", "2026-08-29T00:00:00Z",
            "2026-08-30T00:00:00Z"
        ],
        "timestamps_returned": [f"{d}T00:00:00Z" for d in actual_times],
        "geographic_bounds": {
            "minimum_longitude": MINIMUM_LONGITUDE,
            "maximum_longitude": MAXIMUM_LONGITUDE,
            "minimum_latitude": MINIMUM_LATITUDE,
            "maximum_latitude": MAXIMUM_LATITUDE,
        },
        "vertical_bounds": {
            "minimum_depth_meters": MINIMUM_DEPTH,
            "maximum_depth_meters": MAXIMUM_DEPTH,
            "classification": "UPPER_OCEAN_OPERATIONAL_VOLUME",
        },
        "file": {
            "filename": final_nc.name,
            "relative_path": str(final_nc.relative_to(REPO_ROOT)).replace("\\", "/"),
            "byte_size": file_size,
            "sha256": sha256,
        },
        "canonical_store_path": str(canonical_zarr_dir.relative_to(REPO_ROOT)).replace("\\", "/"),
        "authentication_method": "COPERNICUSMARINE_SERVICE credentials via environment variables",
        "authentication_success": True,
        "licence": "Copernicus Sentinel Data / E.U. Open Data Policy",
        "attribution": "E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00016",
    }
    manifest_path = manifest_dir / "acquisition_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(acquisition_manifest, f, indent=2)
    print(f"[TASK-03S-B] Acquisition manifest: {manifest_path}")

    # Write snapshot ID file for downstream scripts
    snapshot_id_file = REPO_ROOT / "data" / "manifests" / "copernicus-physical" / "current_snapshot_id.txt"
    snapshot_id_file.write_text(snapshot_id, encoding="utf-8")
    print(f"[TASK-03S-B] Snapshot ID: {snapshot_id}")
    print(f"[TASK-03S-B] NC file: {final_nc.relative_to(REPO_ROOT)}")
    print(f"[TASK-03S-B] TASK-03S-B COMPLETE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
