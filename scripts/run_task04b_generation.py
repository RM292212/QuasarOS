#!/usr/bin/env python3
"""
TASK-04B: Deterministic Multiresolution Generation Runner.

Executes multiresolution pyramid generation and brick extraction for the active operational
Copernicus physical oceanography snapshot.
"""

import json
import logging
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "packages" / "contracts" / "src"))
sys.path.insert(0, str(REPO_ROOT / "packages" / "ingestion" / "src"))

from quasar_ingestion.visualization.multiresolution_generator import MultiresolutionGenerator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("run_task04b")


def main():
    catalog_path = REPO_ROOT / "data" / "manifests" / "active_snapshot_catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Active snapshot catalog not found: {catalog_path}")

    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    active_entry = catalog["active_operational_snapshot"]
    snapshot_id = active_entry["snapshot_id"]
    canonical_zarr_path = REPO_ROOT / active_entry["canonical_zarr_path"]

    staging_dir = (
        REPO_ROOT
        / "data"
        / "visualization"
        / "copernicus_phy_thetao"
        / snapshot_id
        / ".staging_v1"
    )

    logger.info(f"Source Canonical Zarr: {canonical_zarr_path}")
    logger.info(f"Target Staging Dir: {staging_dir}")

    generator = MultiresolutionGenerator(
        canonical_zarr_path=canonical_zarr_path,
        variable_id="sea_water_potential_temperature",
        mask_id="validity_mask",
        visualization_product_id=f"vis_copernicus_phy_thetao_{snapshot_id}",
        product_version="v1",
    )

    result = generator.generate_all(output_staging_dir=staging_dir)

    print("==================================================")
    print("TASK-04B GENERATION SUMMARY:")
    print(f"Product ID: {result.visualization_product_id}")
    print(f"Staging Path: {result.staging_directory}")
    print(f"Timesteps: {result.timesteps_count}")
    print(f"LOD Levels: {result.lod_levels_count}")
    print(f"Total Bricks: {result.total_bricks_count}")
    print(f"Global Scalar Range: {result.global_scalar_range}")
    print(f"Manifest SHA-256: {result.manifest_sha256}")
    print("==================================================")


if __name__ == "__main__":
    main()
