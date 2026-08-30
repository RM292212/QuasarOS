#!/usr/bin/env python3
"""
TASK-04C: Visualization Brick Packaging, Verification, and Atomic Promotion Runner.

Executes:
1. Pydantic validation across all contracts (VisualizationProductContract, BrickGeometryContract, BrickPayloadContract, QuantizationContract).
2. Bitwise SHA-256 integrity verification of all 63 multiresolution bricks (126 binary payload files).
3. Storage budget enforcement (< 150 MiB).
4. Atomic directory promotion from staging (.staging_v1) to production target (v1).
5. Canonical manifest generation and export to both data/manifests/visualization/... and data/visualization/...
6. Active snapshot catalog update (data/manifests/active_snapshot_catalog.json).
"""

import json
import logging
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "packages" / "contracts" / "src"))
sys.path.insert(0, str(REPO_ROOT / "packages" / "ingestion" / "src"))

from quasar_ingestion.visualization.brick_packager import BrickPackager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("run_task04c")


def main():
    logger.info("Initializing BrickPackager for active operational snapshot...")
    packager = BrickPackager(repo_root=REPO_ROOT)

    result = packager.run_packaging_pipeline()

    print("\n" + "=" * 60)
    print("TASK-04C PACKAGING & PROMOTION SUMMARY:")
    print(f"Active Snapshot ID:          {result.snapshot_id}")
    print(f"Visualization Product ID:    {result.visualization_product_id}")
    print(f"Production Product Path:     {result.production_product_directory}")
    print(f"Production Manifest Path:    {result.production_manifest_directory}")
    print(f"Total Multiresolution Bricks:{result.total_bricks}")
    print(f"Total Binary Payloads:       {result.total_payload_files} (Float16: {result.f16_payload_count}, Uint16: {result.u16_payload_count})")
    print(f"Total Compressed Size:       {result.total_compressed_mib:.2f} MiB (Float16: {result.total_f16_bytes / 1024 / 1024:.2f} MiB, Uint16: {result.total_u16_bytes / 1024 / 1024:.2f} MiB)")
    print(f"Storage Budget:              {result.storage_budget_mib:.1f} MiB (Compliant: {result.storage_budget_compliant})")
    print(f"Manifest SHA-256:            {result.manifest_sha256}")
    print(f"Catalog Updated:             {result.catalog_updated}")
    print(f"Packaging Timestamp:         {result.packaging_timestamp_utc}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
