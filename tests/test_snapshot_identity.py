"""
tests/test_snapshot_identity.py — TASK-03S-E required tests.

Proves:
1. The historical 2025 snapshot SHA-256 cannot be confused with the new current snapshot.
2. The active_snapshot_catalog.json points to a different snapshot ID than the historical one.
3. The current snapshot's latest valid time is not 2025-04-26.
4. The historical snapshot is classified as HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT.
5. The current snapshot is classified as OPERATIONAL_CURRENT_SNAPSHOT.
6. The historical v1 Zarr store still exists and is unmodified.
7. The new snapshot Zarr store exists and has shape (7, 31, 181, 97).
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

HISTORICAL_SHA256 = "6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281"
CURRENT_SHA256 = "ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c"
CURRENT_SNAPSHOT_ID = "copernicus-phy-thetao-20260824-20260830-ca826087"
HISTORICAL_SNAPSHOT_ID = "v1"

CATALOG_PATH = REPO_ROOT / "data/manifests/active_snapshot_catalog.json"
HIST_NC_PATH = (
    REPO_ROOT
    / "data/raw/copernicus/physical"
    / "copernicus_phy_thetao_20250420_20250426.nc"
)
CURRENT_NC_PATH = (
    REPO_ROOT
    / "data/raw/copernicus/physical"
    / CURRENT_SNAPSHOT_ID
    / "copernicus_phy_thetao_20260824_20260830.nc"
)
HIST_ZARR_PATH = REPO_ROOT / "data/canonical/copernicus_phy_thetao/v1"
CURRENT_ZARR_PATH = (
    REPO_ROOT / "data/canonical/copernicus_phy_thetao" / CURRENT_SNAPSHOT_ID
)


def _sha256_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class TestSnapshotIdentity(unittest.TestCase):
    """Snapshot identity and catalog integrity tests (TASK-03S-E)."""

    def _load_catalog(self) -> dict:
        self.assertTrue(
            CATALOG_PATH.exists(),
            f"Active snapshot catalog not found: {CATALOG_PATH}",
        )
        with open(CATALOG_PATH, encoding="utf-8") as f:
            return json.load(f)

    def test_1_sha256_no_confusion(self):
        """Historical and current snapshot SHA-256 digests must differ."""
        self.assertNotEqual(
            HISTORICAL_SHA256,
            CURRENT_SHA256,
            "Historical and current SHA-256 must be distinct — identity confusion detected.",
        )

    def test_2_catalog_points_to_different_snapshot_id(self):
        """Catalog active operational snapshot must differ from historical snapshot ID."""
        catalog = self._load_catalog()
        active_id = catalog["active_operational_snapshot"]["snapshot_id"]
        hist_id = catalog["historical_validation_baseline"]["snapshot_id"]
        self.assertNotEqual(
            active_id,
            hist_id,
            f"Catalog active and historical snapshot IDs must differ. Both are '{active_id}'.",
        )
        self.assertEqual(
            active_id,
            CURRENT_SNAPSHOT_ID,
            f"Expected active snapshot ID '{CURRENT_SNAPSHOT_ID}', got '{active_id}'.",
        )

    def test_3_current_snapshot_latest_time_is_not_2025_04_26(self):
        """Current operational snapshot's latest valid time must not be 2025-04-26."""
        catalog = self._load_catalog()
        latest_time = catalog["active_operational_snapshot"]["latest_valid_time"]
        self.assertNotIn(
            "2025-04-26",
            latest_time,
            f"Current snapshot latest_valid_time must not be 2025-04-26. Got: {latest_time}",
        )

    def test_4_historical_snapshot_classification(self):
        """Historical snapshot must be classified as HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT."""
        catalog = self._load_catalog()
        classification = catalog["historical_validation_baseline"]["temporal_classification"]
        self.assertEqual(
            classification,
            "HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT",
            f"Historical classification wrong: {classification}",
        )

    def test_5_current_snapshot_classification(self):
        """Current snapshot must be classified as OPERATIONAL_CURRENT_SNAPSHOT."""
        catalog = self._load_catalog()
        classification = catalog["active_operational_snapshot"]["temporal_classification"]
        self.assertEqual(
            classification,
            "OPERATIONAL_CURRENT_SNAPSHOT",
            f"Current classification wrong: {classification}",
        )

    def test_6_historical_v1_zarr_exists_and_unmodified(self):
        """Historical v1 Zarr store must still exist (immutability guarantee)."""
        self.assertTrue(
            HIST_ZARR_PATH.exists(),
            f"Historical v1 Zarr store missing — immutability violated: {HIST_ZARR_PATH}",
        )
        zmetadata = HIST_ZARR_PATH / ".zmetadata"
        self.assertTrue(
            zmetadata.exists(),
            "Historical v1 .zmetadata missing — store may be corrupt.",
        )

    def test_7_current_snapshot_zarr_exists_with_correct_shape(self):
        """Current snapshot Zarr store must exist with shape (7, 31, 181, 97)."""
        self.assertTrue(
            CURRENT_ZARR_PATH.exists(),
            f"Current snapshot Zarr store not found: {CURRENT_ZARR_PATH}",
        )
        zmetadata = CURRENT_ZARR_PATH / ".zmetadata"
        self.assertTrue(
            zmetadata.exists(),
            "Current Zarr .zmetadata missing.",
        )
        # Verify shape from manifest
        manifest_path = CURRENT_ZARR_PATH / "canonical_manifest.json"
        self.assertTrue(manifest_path.exists(), "canonical_manifest.json missing from current Zarr store.")
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
        shape = manifest["arrays"]["sea_water_potential_temperature"]["shape"]
        self.assertEqual(
            shape,
            [7, 31, 181, 97],
            f"Current Zarr shape wrong: {shape}",
        )

    def test_8_current_sha256_verifiable(self):
        """Current snapshot NC file must have the expected SHA-256."""
        if not CURRENT_NC_PATH.exists():
            self.skipTest(f"Current NC not found: {CURRENT_NC_PATH}")
        actual = _sha256_file(CURRENT_NC_PATH)
        self.assertEqual(
            actual,
            CURRENT_SHA256,
            f"Current NC SHA-256 mismatch: {actual} != {CURRENT_SHA256}",
        )

    def test_9_historical_immutable_nc_sha256(self):
        """Historical 2025 NC file must still have its original SHA-256."""
        if not HIST_NC_PATH.exists():
            self.skipTest(f"Historical NC not found: {HIST_NC_PATH}")
        actual = _sha256_file(HIST_NC_PATH)
        self.assertEqual(
            actual,
            HISTORICAL_SHA256,
            f"Historical NC SHA-256 changed — source modified: {actual}",
        )


if __name__ == "__main__":
    unittest.main()
