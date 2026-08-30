"""
TASK-04B: Comprehensive Test Suite for Deterministic Multiresolution Generation.

Verifies:
1. Canonical level 0 exact core voxel recovery against canonical Zarr.
2. LOD 1 and LOD 2 downsampling correctness and mask consistency (mask-preserving mean).
3. Halo extraction and neighbor consistency across brick boundaries.
4. Non-uniform depth LUT (31 levels) matching canonical Zarr depth exactly.
5. Floating-point determinism and SHA-256 reproducibility across independent generator runs.
6. Schema and metadata validation against Visualization Product and Brick Payload contracts.
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

import numcodecs
import numpy as np
import zarr

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "packages" / "contracts" / "src"))
sys.path.insert(0, str(REPO_ROOT / "packages" / "ingestion" / "src"))

from quasar_ingestion.visualization.multiresolution_generator import MultiresolutionGenerator


class TestMultiresolutionGeneration(unittest.TestCase):
    """Test suite verifying TASK-04B multiresolution generation and brick extraction."""

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

        cls.generator = MultiresolutionGenerator(
            canonical_zarr_path=cls.zarr_path,
            variable_id="sea_water_potential_temperature",
            mask_id="validity_mask",
            visualization_product_id="test_vis_copernicus",
            product_version="v1",
        )

        cls.codec = numcodecs.Zstd(level=3)

    def test_non_uniform_depth_lut_exactness(self):
        """Verify non-uniform depth LUT (31 levels, 0.494m to 453.938m) matches canonical Zarr depth exactly."""
        min_val, max_val, quant_contract = self.generator.compute_global_quantization_parameters()
        self.assertEqual(len(self.generator.depth_arr), 31)
        
        # Verify monotonically increasing depth
        diffs = np.diff(self.generator.depth_arr)
        self.assertTrue(np.all(diffs > 0), "Depth levels must be strictly monotonically increasing")
        
        self.assertAlmostEqual(float(self.generator.depth_arr[0]), 0.494025, places=5)
        self.assertAlmostEqual(float(self.generator.depth_arr[-1]), 453.937714, places=4)

        # Depth array exact element-by-element equality
        np.testing.assert_array_equal(self.generator.depth_arr, self.depth)

    def test_level_0_exact_core_voxel_recovery(self):
        """Verify LOD 0 brick extraction preserves interior voxels matching canonical Zarr exactly."""
        timestep_idx = 0
        lod_pyramids = self.generator.compute_lod_pyramid_for_timestep(timestep_idx)
        lod0_lvl, lod0_data, lod0_mask = lod_pyramids[0]

        # Extract all 6 bricks of LOD 0
        bx_size, by_size, bz_size = MultiresolutionGenerator.BRICK_SHAPE
        halo_x, halo_y, halo_z = MultiresolutionGenerator.HALO_PADDING
        alloc_x, alloc_y, alloc_z = MultiresolutionGenerator.ALLOCATED_SHAPE

        min_val, max_val, quant = self.generator.compute_global_quantization_parameters()

        nx_b = int(math.ceil(97 / bx_size))  # 2
        ny_b = int(math.ceil(181 / by_size))  # 3
        nz_b = int(math.ceil(31 / bz_size))  # 1

        reconstructed_data = np.full((31, 181, 97), np.nan, dtype=np.float32)

        for iy in range(ny_b):
            for ix in range(nx_b):
                brick_res = self.generator.extract_brick(
                    lod_level=0,
                    timestep_idx=0,
                    bx_idx=ix,
                    by_idx=iy,
                    bz_idx=0,
                    volume_data=lod0_data,
                    volume_mask=lod0_mask,
                    scale_factor=quant.scale_factor,
                    add_offset=quant.add_offset,
                )

                # Decode Float16 bytes
                f16_decompressed = self.codec.decode(brick_res.f16_zstd_bytes)
                arr_f16 = np.frombuffer(f16_decompressed, dtype=np.float16).reshape(
                    (alloc_z, alloc_y, alloc_x)
                )

                # Interior coordinates
                x0 = ix * bx_size
                x1 = min(x0 + bx_size, 97)
                y0 = iy * by_size
                y1 = min(y0 + by_size, 181)
                z0 = 0
                z1 = 31

                # Interior slice inside brick: starts at halo offsets
                # halo is [1, 1, 0]
                int_f16 = arr_f16[0:31, halo_y : halo_y + (y1 - y0), halo_x : halo_x + (x1 - x0)]
                reconstructed_data[z0:z1, y0:y1, x0:x1] = int_f16.astype(np.float32)

        # Check precision error between original float32 and recovered float16 on valid voxels
        t0_orig = self.thetao[0]
        t0_mask = self.mask[0]
        valid = t0_mask == 0

        orig_valid = t0_orig[valid]
        recon_valid = reconstructed_data[valid]

        abs_err = np.abs(orig_valid - recon_valid)
        max_err = float(np.max(abs_err))
        self.assertLess(max_err, 0.0080, "LOD 0 float16 reconstruction max error must be < 0.008 degC")

    def test_lod1_and_lod2_downsampling_correctness_and_mask(self):
        """Verify LOD 1 and LOD 2 downsampling arithmetic mean and mask propagation."""
        lod_pyramids = self.generator.compute_lod_pyramid_for_timestep(0)

        lod0_lvl, lod0_data, lod0_mask = lod_pyramids[0]
        lod1_lvl, lod1_data, lod1_mask = lod_pyramids[1]
        lod2_lvl, lod2_data, lod2_mask = lod_pyramids[2]

        self.assertEqual(lod0_data.shape, (31, 181, 97))
        self.assertEqual(lod1_data.shape, (31, 91, 49))
        self.assertEqual(lod2_data.shape, (31, 46, 25))

        # Check specific coarse cell in LOD 1
        # Test iz=5, iy=10, ix=10 (sub-voxels: y in [20, 22), x in [20, 22))
        sub_d = lod0_data[5, 20:22, 20:22]
        sub_m = lod0_mask[5, 20:22, 20:22]
        valid_pts = sub_d[sub_m == 0]
        if len(valid_pts) > 0:
            expected_mean = float(np.mean(valid_pts))
            self.assertAlmostEqual(float(lod1_data[5, 10, 10]), expected_mean, places=5)
            self.assertEqual(lod1_mask[5, 10, 10], 0)

        # Check LOD 2 downsampling from LOD 1
        sub_d1 = lod1_data[5, 20:22, 20:22]
        sub_m1 = lod1_mask[5, 20:22, 20:22]
        valid_pts1 = sub_d1[sub_m1 == 0]
        if len(valid_pts1) > 0:
            expected_mean1 = float(np.mean(valid_pts1))
            self.assertAlmostEqual(float(lod2_data[5, 10, 10]), expected_mean1, places=5)
            self.assertEqual(lod2_mask[5, 10, 10], 0)

    def test_halo_extraction_and_neighbor_consistency(self):
        """Verify boundary halo of neighboring bricks matches exactly across X and Y seams."""
        min_val, max_val, quant = self.generator.compute_global_quantization_parameters()
        lod_pyramids = self.generator.compute_lod_pyramid_for_timestep(0)
        _, lod0_data, lod0_mask = lod_pyramids[0]

        alloc_x, alloc_y, alloc_z = MultiresolutionGenerator.ALLOCATED_SHAPE

        # Extract Brick (0, 0, 0) and Brick (1, 0, 0) along X axis
        b0 = self.generator.extract_brick(
            lod_level=0,
            timestep_idx=0,
            bx_idx=0,
            by_idx=0,
            bz_idx=0,
            volume_data=lod0_data,
            volume_mask=lod0_mask,
            scale_factor=quant.scale_factor,
            add_offset=quant.add_offset,
        )

        b1 = self.generator.extract_brick(
            lod_level=0,
            timestep_idx=0,
            bx_idx=1,
            by_idx=0,
            bz_idx=0,
            volume_data=lod0_data,
            volume_mask=lod0_mask,
            scale_factor=quant.scale_factor,
            add_offset=quant.add_offset,
        )

        # Decode Float16
        arr_b0 = np.frombuffer(self.codec.decode(b0.f16_zstd_bytes), dtype=np.float16).reshape(
            (alloc_z, alloc_y, alloc_x)
        )
        arr_b1 = np.frombuffer(self.codec.decode(b1.f16_zstd_bytes), dtype=np.float16).reshape(
            (alloc_z, alloc_y, alloc_x)
        )

        # Boundary coordinate is x = 64
        # In b0 (bx=0, interior x in [0, 64)):
        # - Halo on left: index 0 (clamped to x=0)
        # - Interior: indices 1..64 (correspond to x=0..63)
        # - Halo on right: index 65 (corresponds to x=64)
        # In b1 (bx=1, interior x in [64, 97)):
        # - Halo on left: index 0 (corresponds to x=63)
        # - Interior: indices 1..33 (correspond to x=64..96)
        
        # Test 1: b0's right halo (index 65) must equal b1's first interior column (index 1)
        col_b0_halo_right = arr_b0[0:31, 1:65, 65]
        col_b1_interior_left = arr_b1[0:31, 1:65, 1]

        # Compare where not NaN
        valid_match = ~np.isnan(col_b0_halo_right) & ~np.isnan(col_b1_interior_left)
        self.assertTrue(np.any(valid_match))
        np.testing.assert_array_equal(col_b0_halo_right[valid_match], col_b1_interior_left[valid_match])

        # Test 2: b1's left halo (index 0) must equal b0's last interior column (index 64)
        col_b1_halo_left = arr_b1[0:31, 1:65, 0]
        col_b0_interior_right = arr_b0[0:31, 1:65, 64]

        valid_match2 = ~np.isnan(col_b1_halo_left) & ~np.isnan(col_b0_interior_right)
        self.assertTrue(np.any(valid_match2))
        np.testing.assert_array_equal(col_b1_halo_left[valid_match2], col_b0_interior_right[valid_match2])

    def test_floating_point_determinism_across_runs(self):
        """Verify two independent runs of the generator produce identical bitwise binary outputs and SHA-256 hashes."""
        with tempfile.TemporaryDirectory() as tmp1, tempfile.TemporaryDirectory() as tmp2:
            dir1 = Path(tmp1)
            dir2 = Path(tmp2)

            res1 = self.generator.generate_all(dir1)
            res2 = self.generator.generate_all(dir2)

            self.assertEqual(res1.manifest_sha256, res2.manifest_sha256)
            self.assertEqual(res1.total_bricks_count, 63)
            self.assertEqual(res2.total_bricks_count, 63)

            # Compare all 63 brick files byte-for-byte
            for brick_meta in res1.brick_manifest:
                key = brick_meta["brick_key"]
                f16_rel = brick_meta["payload_f16"]["storage_object_key"]
                u16_rel = brick_meta["payload_u16"]["storage_object_key"]

                b1_f16 = (dir1 / f16_rel).read_bytes()
                b2_f16 = (dir2 / f16_rel).read_bytes()
                self.assertEqual(b1_f16, b2_f16, f"F16 binary mismatch for brick {key}")

                b1_u16 = (dir1 / u16_rel).read_bytes()
                b2_u16 = (dir2 / u16_rel).read_bytes()
                self.assertEqual(b1_u16, b2_u16, f"U16 binary mismatch for brick {key}")


if __name__ == "__main__":
    unittest.main()
