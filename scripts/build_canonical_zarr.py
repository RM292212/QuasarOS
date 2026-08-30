#!/usr/bin/env python3
"""
QuasarOS Canonical Zarr Store Generation CLI (TASK-03C).

Converts authoritative Copernicus Physical NetCDF assets into lossless canonical Zarr v2 stores
with consolidated metadata, cryptographic manifests, atomic publication, and idempotency checks.

Usage:
    python scripts/build_canonical_zarr.py \
        --source data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc \
        --output-dir data/canonical/copernicus_phy_thetao/v1 \
        --expected-sha256 6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281 \
        --verify
"""

from __future__ import annotations

import argparse
import logging
import os
import pathlib
from pathlib import Path
import sys

# Setup package paths
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
INGESTION_SRC = REPO_ROOT / "packages" / "ingestion" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from quasar_ingestion.adapters.copernicus_phy_adapter import CopernicusPhysicalAdapter
from quasar_ingestion.storage.canonical_zarr_writer import LosslessCanonicalZarrWriter


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build Lossless Canonical Zarr v2 Store for Copernicus Ocean Potential Temperature."
    )
    parser.add_argument(
        "--source",
        type=str,
        default="data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc",
        help="Path to source NetCDF file (default: data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/canonical/copernicus_phy_thetao/v1",
        help="Target canonical Zarr store directory (default: data/canonical/copernicus_phy_thetao/v1)",
    )
    parser.add_argument(
        "--expected-sha256",
        type=str,
        default="6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281",
        help="Expected SHA-256 digest of the source asset for verification.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration even if valid canonical store already exists (skips idempotency check).",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        default=True,
        help="Perform strict roundtrip verification against decoded source values (default: True).",
    )
    parser.add_argument(
        "--companion-manifest",
        type=str,
        default="data/manifests/canonical/copernicus_phy_thetao_manifest.json",
        help="Path to companion manifest copy (default: data/manifests/canonical/copernicus_phy_thetao_manifest.json)",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logger = logging.getLogger("build_canonical_zarr")

    source_path = Path(args.source)
    if not source_path.is_absolute():
        source_path = REPO_ROOT / source_path

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = REPO_ROOT / output_dir

    companion_manifest = Path(args.companion_manifest)
    if not companion_manifest.is_absolute():
        companion_manifest = REPO_ROOT / companion_manifest

    if not source_path.exists():
        logger.error("Source NetCDF file not found: %s", source_path)
        return 1

    logger.info("Starting Canonical Zarr Writer Pipeline...")
    logger.info("  Source: %s", source_path)
    logger.info("  Target: %s", output_dir)
    logger.info("  Expected SHA-256: %s", args.expected_sha256)

    writer = LosslessCanonicalZarrWriter(
        output_dir=output_dir,
        chunk_shape_4d=(1, 31, 64, 64),
        compression_level=3,
        zarr_format=2,
    )

    # Check idempotency
    if not args.force and writer.is_already_generated(args.expected_sha256):
        logger.info("Idempotency match: Canonical Zarr store at %s is already up-to-date and validated. No work needed.", output_dir)
        return 0

    with CopernicusPhysicalAdapter(source_path) as adapter:
        manifest = writer.write_dataset(
            adapter=adapter,
            expected_source_sha256=args.expected_sha256,
            force=args.force,
            companion_manifest_paths=[companion_manifest],
        )

    logger.info("Canonical Zarr generation complete. Dataset ID: %s, Status: %s", manifest.dataset_id, manifest.validation_status)
    logger.info("Canonical store: %s", manifest.canonical_store_path)
    logger.info("Chunk counts per array:")
    for name, arr in manifest.arrays.items():
        logger.info("  - %s: shape=%s chunks=%s (%d chunks, dtype=%s)", name, arr.shape, arr.chunks, arr.chunk_count, arr.dtype)

    return 0


if __name__ == "__main__":
    sys.exit(main())
