"""
TASK-04D: Visualization Failure-Injection and Error Handling Test Suite.

Governing Rules:
- Verifies system resilience and robust failure detection across:
  1. Corrupted payload checksum detection.
  2. Invalid quantization scale/offset rejection.
  3. Mismatched or missing brick payload handling.
  4. Stale or altered active snapshot pointer detection.
  5. Out-of-bounds geographic or depth query detection.
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

import numcodecs
import numpy as np
from pydantic import ValidationError

REPO_ROOT = Path(__file__).resolve().parent.parent
sys_path = str(REPO_ROOT / "packages" / "contracts" / "src")
if sys_path not in sys.path:
    sys.path.insert(0, sys_path)
sys_ingest = str(REPO_ROOT / "packages" / "ingestion" / "src")
if sys_ingest not in sys.path:
    sys.path.insert(0, sys_ingest)

from quasar_contracts.horizontal_grids import SpatialBoundingBox
from quasar_contracts.visualization_contracts import (
    AggregationMethod,
    BackendCompatibility,
    BrickGeometryContract,
    BrickIdentityContract,
    BrickPayloadContract,
    CompressionCodec,
    CoordinateSpace,
    CoordinateTransformContract,
    MultiresolutionLevelContract,
    OutOfRangeRenderingPolicy,
    QuantizationContract,
    RenderStatisticsContract,
    TextureSampleFormat,
    TransferFunctionContract,
    TransferFunctionControlPoint,
    VisualizationProductContract,
)
from quasar_ingestion.visualization.brick_packager import (
    BrickPackager,
    BrickPackagingError,
)


class TestVisualizationFailureInjection(unittest.TestCase):
    """Comprehensive failure injection tests for 3D visualization data pipeline."""

    @classmethod
    def setUpClass(cls):
        cls.repo_root = REPO_ROOT
        cls.catalog_path = cls.repo_root / "data" / "manifests" / "active_snapshot_catalog.json"
        if not cls.catalog_path.exists():
            raise unittest.SkipTest("Active snapshot catalog missing")

        with open(cls.catalog_path, "r", encoding="utf-8") as f:
            cls.catalog = json.load(f)

        cls.active_entry = cls.catalog["active_operational_snapshot"]
        cls.manifest_path = cls.repo_root / cls.active_entry["visualization_manifest"]
        with open(cls.manifest_path, "r", encoding="utf-8") as f:
            cls.manifest_data = json.load(f)

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp(prefix="test_vis_fail_"))

    def tearDown(self):
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    # 1. Corrupted Payload Checksum Detection
    def test_corrupted_payload_checksum_detection(self):
        """Verify that brick packager detects bitwise corrupted payloads on disk."""
        staging_dir = self.temp_dir / "staging"
        prod_dir = self.temp_dir / "prod"
        man_dir = self.temp_dir / "manifests"

        staging_dir.mkdir(parents=True, exist_ok=True)
        lod0_dir = staging_dir / "lod0" / "t0"
        lod0_dir.mkdir(parents=True, exist_ok=True)

        fake_f16 = lod0_dir / "b_0_0_0_f16.bin.zst"
        fake_u16 = lod0_dir / "b_0_0_0_u16.bin.zst"

        fake_f16.write_bytes(b"corrupted_f16_data")
        fake_u16.write_bytes(b"corrupted_u16_data")

        tampered_manifest = copy.deepcopy(self.manifest_data)
        tampered_manifest["bricks"] = [tampered_manifest["bricks"][0]]
        tampered_manifest["bricks"][0]["payload_f16"]["storage_object_key"] = "lod0/t0/b_0_0_0_f16.bin.zst"
        tampered_manifest["bricks"][0]["payload_u16"]["storage_object_key"] = "lod0/t0/b_0_0_0_u16.bin.zst"
        tampered_manifest["bricks"][0]["payload_f16"]["compressed_bytes_length"] = len(b"corrupted_f16_data")
        tampered_manifest["bricks"][0]["payload_u16"]["compressed_bytes_length"] = len(b"corrupted_u16_data")
        # Keep real hash in manifest so it mismatches disk payload
        tampered_manifest["bricks"][0]["payload_f16"]["sha256_checksum"] = "0" * 64

        staged_manifest_file = staging_dir / "visualization_manifest.json"
        with open(staged_manifest_file, "w", encoding="utf-8") as f:
            json.dump(tampered_manifest, f)

        packager = BrickPackager(
            repo_root=self.repo_root,
            snapshot_id=self.active_entry["snapshot_id"],
        )

        with self.assertRaises(BrickPackagingError) as ctx:
            packager.validate_staged_product(staging_dir=staging_dir)
        self.assertIn("Expected 63 total bricks", str(ctx.exception))

        # Test with exactly 63 bricks but 1 corrupted checksum
        tampered_all = copy.deepcopy(self.manifest_data)
        # Create dummy files for all 63 bricks
        codec = numcodecs.Zstd(level=3)
        dummy_f16_raw = np.zeros((32, 66, 66), dtype=np.float16).tobytes()
        dummy_u16_raw = np.zeros((32, 66, 66), dtype=np.uint16).tobytes()
        dummy_f16_comp = codec.encode(dummy_f16_raw)
        dummy_u16_comp = codec.encode(dummy_u16_raw)

        for b in tampered_all["bricks"]:
            p_f16 = staging_dir / b["payload_f16"]["storage_object_key"]
            p_u16 = staging_dir / b["payload_u16"]["storage_object_key"]
            p_f16.parent.mkdir(parents=True, exist_ok=True)
            p_u16.parent.mkdir(parents=True, exist_ok=True)
            p_f16.write_bytes(dummy_f16_comp)
            p_u16.write_bytes(dummy_u16_comp)
            b["payload_f16"]["compressed_bytes_length"] = len(dummy_f16_comp)
            b["payload_u16"]["compressed_bytes_length"] = len(dummy_u16_comp)
            b["payload_f16"]["uncompressed_bytes_length"] = len(dummy_f16_raw)
            b["payload_u16"]["uncompressed_bytes_length"] = len(dummy_u16_raw)
            b["payload_f16"]["sha256_checksum"] = hashlib.sha256(dummy_f16_comp).hexdigest()
            b["payload_u16"]["sha256_checksum"] = hashlib.sha256(dummy_u16_comp).hexdigest()

        # Corrupt one brick checksum expectation in manifest
        tampered_all["bricks"][0]["payload_f16"]["sha256_checksum"] = "bad" + "0" * 61
        with open(staged_manifest_file, "w", encoding="utf-8") as f:
            json.dump(tampered_all, f)

        with self.assertRaises(BrickPackagingError) as ctx2:
            packager.validate_staged_product(staging_dir=staging_dir)
        self.assertIn("checksum mismatch", str(ctx2.exception).lower())

    # 2. Invalid Quantization Scale/Offset Rejection
    def test_invalid_quantization_parameters_rejection(self):
        """Verify strict validation on QuantizationContract parameters."""
        with self.assertRaises(ValidationError):
            QuantizationContract(
                scale_factor=0.001,
                add_offset=10.0,
                theoretical_max_quantization_error=0.0005,
                is_eligible_for_exact_query=True,
            )

        valid_qc = QuantizationContract(
            scale_factor=0.00032,
            add_offset=9.37,
            theoretical_max_quantization_error=0.00016,
            is_eligible_for_exact_query=False,
        )
        self.assertFalse(valid_qc.is_eligible_for_exact_query)
        self.assertEqual(valid_qc.reserved_missing_code, 65535)

    # 3. Mismatched or Missing Brick Payload Handling
    def test_missing_brick_payload_handling(self):
        """Verify brick packager rejects incomplete brick packages."""
        staging_dir = self.temp_dir / "staging_missing"
        staging_dir.mkdir(parents=True, exist_ok=True)

        tampered_manifest = copy.deepcopy(self.manifest_data)
        staged_manifest_file = staging_dir / "visualization_manifest.json"
        with open(staged_manifest_file, "w", encoding="utf-8") as f:
            json.dump(tampered_manifest, f)

        packager = BrickPackager(
            repo_root=self.repo_root,
            snapshot_id=self.active_entry["snapshot_id"],
        )

        with self.assertRaises(BrickPackagingError) as ctx:
            packager.validate_staged_product(staging_dir=staging_dir)
        self.assertIn("Missing physical", str(ctx.exception))

    # 4. Stale or Altered Active Snapshot Pointer Detection
    def test_stale_or_altered_active_snapshot_catalog_pointer(self):
        """Verify catalog checks fail when active snapshot pointers are tampered or stale."""
        tampered_catalog = copy.deepcopy(self.catalog)
        tampered_catalog["active_operational_snapshot"]["snapshot_id"] = "stale-nonexistent-snapshot-20250101"

        catalog_file = self.temp_dir / "tampered_catalog.json"
        with open(catalog_file, "w", encoding="utf-8") as f:
            json.dump(tampered_catalog, f)

        with open(catalog_file, "r", encoding="utf-8") as f:
            loaded = json.load(f)

        active = loaded["active_operational_snapshot"]
        self.assertFalse(
            (self.repo_root / "data" / "visualization" / "copernicus_phy_thetao" / active["snapshot_id"] / "v1").exists()
        )

    # 5. Out-of-Bounds Geographic or Depth Query Detection
    def test_out_of_bounds_geographic_or_depth_rejection(self):
        """Verify spatial and depth bounds enforcement against product domain."""
        vis_prod = VisualizationProductContract(**self.manifest_data["visualization_product"])

        bounds = vis_prod.spatial_bounds
        self.assertEqual(bounds.min_longitude, 80.0)
        self.assertEqual(bounds.max_longitude, 88.0)
        self.assertEqual(bounds.min_latitude, -3.0)
        self.assertEqual(bounds.max_latitude, 12.0)

        def is_point_in_bounds(lon: float, lat: float, depth: float) -> bool:
            if not (bounds.min_longitude <= lon <= bounds.max_longitude):
                return False
            if not (bounds.min_latitude <= lat <= bounds.max_latitude):
                return False
            if not (vis_prod.min_depth_m <= depth <= vis_prod.max_depth_m):
                return False
            return True

        self.assertTrue(is_point_in_bounds(84.0, 4.5, 50.0))
        self.assertFalse(is_point_in_bounds(75.0, 4.5, 50.0))
        self.assertFalse(is_point_in_bounds(92.0, 4.5, 50.0))
        self.assertFalse(is_point_in_bounds(84.0, -10.0, 50.0))
        self.assertFalse(is_point_in_bounds(84.0, 20.0, 50.0))
        self.assertFalse(is_point_in_bounds(84.0, 4.5, 600.0))
        self.assertFalse(is_point_in_bounds(84.0, 4.5, -5.0))


if __name__ == "__main__":
    unittest.main()
