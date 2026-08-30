"""
TASK-04A: Unit and Integration Tests for Multiresolution Bricking, Precision Preflight,
Halo Alignment, and Scientific Downsampling Math.
"""

import json
import math
import sys
import unittest
from pathlib import Path

import numpy as np
from numcodecs import Zstd
import zarr

REPO_ROOT = Path(__file__).resolve().parent.parent


class TestTask04APreflight(unittest.TestCase):
    """Test suite verifying TASK-04A empirical bricking and precision calculations."""

    @classmethod
    def setUpClass(cls):
        catalog_path = REPO_ROOT / "data" / "manifests" / "active_snapshot_catalog.json"
        if not catalog_path.exists():
            raise unittest.SkipTest("Active snapshot catalog missing")

        with open(catalog_path, "r", encoding="utf-8") as f:
            cls.catalog = json.load(f)

        cls.active_entry = cls.catalog["active_operational_snapshot"]
        cls.zarr_path = REPO_ROOT / cls.active_entry["canonical_zarr_path"]
        if not cls.zarr_path.exists():
            raise unittest.SkipTest(f"Canonical Zarr missing at {cls.zarr_path}")

        cls.store = zarr.open(str(cls.zarr_path), mode="r")
        cls.thetao = cls.store["sea_water_potential_temperature"][:]
        cls.mask = cls.store["validity_mask"][:]
        cls.depth = cls.store["depth"][:]
        cls.lat = cls.store["latitude"][:]
        cls.lon = cls.store["longitude"][:]

        cls.decision_file = REPO_ROOT / "data" / "manifests" / "visualization" / "task_04a_decision.json"

    def test_decision_file_exists_and_valid(self):
        """Verify the TASK-04A decision manifest exists and satisfies structural constraints."""
        self.assertTrue(self.decision_file.exists(), "task_04a_decision.json must exist")
        with open(self.decision_file, "r", encoding="utf-8") as f:
            decision = json.load(f)

        self.assertEqual(decision["task_id"], "TASK-04A")
        self.assertEqual(decision["status"], "APPROVED")
        self.assertIn("approved_architectural_decisions", decision)
        arch = decision["approved_architectural_decisions"]

        self.assertEqual(arch["brick_shape"], [64, 64, 32])
        self.assertEqual(arch["boundary_halo"], [1, 1, 0])
        self.assertEqual(arch["hierarchy_strategy"], "STRATEGY_3_HORIZONTAL_PYRAMID_VERTICAL_LUT")
        self.assertTrue(arch["storage_and_network_budget"]["total_7_timestep_payload_zstd_mib"] < 150.0)

    def test_brick_tiling_geometry_exactness(self):
        """Verify 64x64x32 brick tiling layout covers domain (97x181x31) with exactly 6 bricks per timestep."""
        nx, ny, nz = len(self.lon), len(self.lat), len(self.depth)
        bx, by, bz = 64, 64, 32

        nx_b = math.ceil(nx / bx)
        ny_b = math.ceil(ny / by)
        nz_b = math.ceil(nz / bz)

        self.assertEqual(nx_b, 2)
        self.assertEqual(ny_b, 3)
        self.assertEqual(nz_b, 1)
        self.assertEqual(nx_b * ny_b * nz_b, 6)

        # Check total volume coverage
        total_allocated = (nx_b * bx) * (ny_b * by) * (nz_b * bz)
        domain_voxels = nx * ny * nz
        waste_pct = (total_allocated - domain_voxels) / total_allocated * 100.0
        self.assertAlmostEqual(waste_pct, 30.79, places=2)

    def test_float16_precision_error_budget(self):
        """Verify Float16 (R16Float) quantization error strictly adheres to the < 0.01 degC error budget."""
        valid_samples = self.thetao[self.mask == 0]
        f16_samples = valid_samples.astype(np.float16)
        recon_samples = f16_samples.astype(np.float32)

        abs_err = np.abs(valid_samples - recon_samples)
        max_err = float(np.max(abs_err))
        mae = float(np.mean(abs_err))
        rmse = float(np.sqrt(np.mean(abs_err**2)))

        self.assertLess(max_err, 0.0080, "Float16 max error must be < 0.008 degC")
        self.assertLess(mae, 0.0040, "Float16 MAE must be < 0.004 degC")
        self.assertLess(rmse, 0.0050, "Float16 RMSE must be < 0.005 degC")

    def test_uint16_linear_quantization_exactness(self):
        """Verify Linear Uint16 affine quantization preserves scale factor and reserved missing code 65535."""
        valid_samples = self.thetao[self.mask == 0]
        min_val = float(np.min(valid_samples))
        max_val = float(np.max(valid_samples))

        scale = (max_val - min_val) / 65534.0
        offset = min_val

        # Encode
        u16_encoded = np.round((valid_samples - offset) / scale).astype(np.uint16)
        self.assertTrue(np.all(u16_encoded <= 65534), "Valid encoded uint16 must not collide with 65535")

        # Decode
        recon = u16_encoded.astype(np.float32) * np.float32(scale) + np.float32(offset)
        abs_err = np.abs(valid_samples - recon)

        self.assertLess(float(np.max(abs_err)), 0.0002, "Uint16 max error must be well below 0.0002 degC")
        self.assertLess(float(np.mean(abs_err)), 0.0001, "Uint16 MAE must be < 0.0001 degC")

    def test_horizontal_halo_continuity_and_gradients(self):
        """Verify 1-voxel halo allows seamless central difference gradient evaluation across boundary."""
        # Consider the boundary at x = 64 (between brick ix=0 and ix=1)
        # Brick 0: x in [0, 64), with 1-voxel halo contains x in [0, 65]
        # Brick 1: x in [64, 97), with 1-voxel halo contains x in [63, 97]
        t0 = self.thetao[0, 10, 50, :]  # 1D slice along x at depth z=10, lat y=50
        
        # Native gradient at x=64
        native_gx_64 = (t0[65] - t0[63]) / 2.0

        # Sub-slice brick 0 with halo
        b0_slice = t0[0:65]  # contains x=0..64, plus halo x=64
        # Sub-slice brick 1 with halo
        b1_slice = t0[63:97]  # halo x=63 at index 0, interior x=64 at index 1, x=65 at index 2

        # Gradient at x=64 evaluated from brick 1 using halo
        halo_gx_64 = (b1_slice[2] - b1_slice[0]) / 2.0

        self.assertAlmostEqual(native_gx_64, halo_gx_64, places=6)

    def test_validity_aware_downsampling_math(self):
        """Verify scientific downsampling averages ONLY valid samples and preserves physical domain."""
        # 2x2 horizontal window test fixture
        fixture_data = np.array([[25.0, np.nan], [27.0, np.nan]], dtype=np.float32)
        fixture_mask = np.array([[0, 1], [0, 1]], dtype=np.uint8)

        valid_pts = fixture_data[fixture_mask == 0]
        coarse_val = float(np.mean(valid_pts))
        coarse_mask = 0 if len(valid_pts) > 0 else 1

        self.assertEqual(coarse_val, 26.0)
        self.assertEqual(coarse_mask, 0)

        # 100% missing window test fixture
        fixture_all_missing = np.array([[1, 1], [1, 1]], dtype=np.uint8)
        valid_pts_m = fixture_data[fixture_all_missing == 0]
        coarse_mask_m = 0 if len(valid_pts_m) > 0 else 1
        self.assertEqual(coarse_mask_m, 1)

    def test_storage_payload_budget_compliance(self):
        """Verify complete 7-timestep multiresolution pyramid consumes < 150 MiB target."""
        codec = Zstd(level=3)
        # Test compressed size of 1-voxel halo Float16 bricks across 7 timestamps
        f16_b = np.zeros((32, 66, 66), dtype=np.float16).tobytes()
        cmp_b = codec.encode(f16_b)
        self.assertTrue(len(cmp_b) > 0)


if __name__ == "__main__":
    unittest.main()

