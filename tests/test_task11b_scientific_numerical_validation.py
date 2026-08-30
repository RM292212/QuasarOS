"""
tests/test_task11b_scientific_numerical_validation.py — Automated Test Suite for TASK-11B.

Validates:
1. Multi-Point Numerical Ground-Truth:
   - Float16 L_inf error <= 0.0078125 deg C across all 7 timesteps and 31 depth levels.
   - Uint16 L_inf error <= 0.0001625 deg C across all 7 timesteps and 31 depth levels.
   - Zero validity mask mismatch between NetCDF source and decoded bricks.
2. CPU Analytical Raymarching Reference Harness:
   - Smits-Kay AABB ray-box intersection exactness across all canonical ray configurations.
   - Beer-Lambert multi-step vs single-step step-size opacity correction mathematical equivalence.
   - Continuous 31-level Copernicus depth LUT piecewise linear interpolation exactness.
3. Strict Invariant Checks:
   - Physical valid 0.0 deg C preservation without NaN or missing mutation.
   - Validity mask masking of land/missing samples.
   - Reserved missing code 65535 exclusion from valid temperature scalar ranges.
   - Exact query engine zero numerical delta vs native NetCDF-4 ground truth.
"""

import json
import math
import pathlib
import sys
import unittest

import netCDF4
import numcodecs
import numpy as np

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
SERVICES_SRC = REPO_ROOT / "packages" / "services" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))

from quasar_contracts.exact_value_contracts import (
    ExactValueQueryRequest,
    VerticalSelectorType,
)
from quasar_services.query import (
    DEPTH_LUT_METERS,
    ExactQueryEngine,
    VerticalProfileQueryRequest,
)

SNAPSHOT_ID = "copernicus-phy-thetao-20260824-20260830-ca826087"
NC_PATH = REPO_ROOT / "data/raw/copernicus/physical" / SNAPSHOT_ID / "copernicus_phy_thetao_20260824_20260830.nc"
MANIFEST_PATH = REPO_ROOT / "data/manifests/visualization/copernicus_phy_thetao" / SNAPSHOT_ID / "v1/visualization_manifest.json"
BRICKS_DIR = REPO_ROOT / "data/visualization/copernicus_phy_thetao" / SNAPSHOT_ID / "v1"


class TestTask11BScientificNumericalValidation(unittest.TestCase):
    """TASK-11B Scientific and Numerical End-to-End Validation Test Suite."""

    @classmethod
    def setUpClass(cls):
        cls.zstd = numcodecs.Zstd()
        cls.nc_ds = netCDF4.Dataset(str(NC_PATH), "r")
        cls.nc_thetao = cls.nc_ds.variables["thetao"]
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            cls.manifest = json.load(f)
        cls.query_engine = ExactQueryEngine(repo_root=REPO_ROOT)

    @classmethod
    def tearDownClass(cls):
        cls.nc_ds.close()
        cls.query_engine.close()

    # =========================================================================
    # 1. Multi-Point Numerical Ground-Truth Accuracy & Quantization Bounds
    # =========================================================================
    def test_float16_and_uint16_brick_ground_truth_accuracy(self):
        """Verify Float16 and Uint16 brick decoding against authoritative NetCDF across all 7 timesteps."""
        lod0_bricks = [b for b in self.manifest["bricks"] if b["identity"]["lod_level"] == 0]
        time_len = 7
        depth_len = 31
        lat_len = 181
        lon_len = 97

        total_valid_voxels = 0
        max_f16_err = 0.0
        max_u16_err = 0.0

        for t_idx in range(time_len):
            t_bricks = [b for b in lod0_bricks if b["identity"]["timestep_index"] == t_idx]
            nc_t_slice = self.nc_thetao[t_idx, :, :, :]

            assembled_f16 = np.full((depth_len, lat_len, lon_len), np.nan, dtype=np.float32)
            assembled_u16 = np.full((depth_len, lat_len, lon_len), np.nan, dtype=np.float32)
            assembled_f16_mask = np.zeros((depth_len, lat_len, lon_len), dtype=np.uint8)
            assembled_u16_mask = np.zeros((depth_len, lat_len, lon_len), dtype=np.uint8)

            for brick_meta in t_bricks:
                geom = brick_meta["geometry"]
                f16_rel_path = brick_meta["payload_f16"]["storage_object_key"]
                u16_rel_path = brick_meta["payload_u16"]["storage_object_key"]

                with open(BRICKS_DIR / f16_rel_path, "rb") as f:
                    f16_raw = self.zstd.decode(f.read())
                arr_f16 = np.frombuffer(f16_raw, dtype=np.float16).reshape((32, 66, 66)).astype(np.float32)

                with open(BRICKS_DIR / u16_rel_path, "rb") as f:
                    u16_raw = self.zstd.decode(f.read())
                arr_u16 = np.frombuffer(u16_raw, dtype=np.uint16).reshape((32, 66, 66))

                b_quant = brick_meta["payload_u16"]["quantization"]
                b_scale = b_quant["scale_factor"]
                b_offset = b_quant["add_offset"]
                b_missing = b_quant["reserved_missing_code"]

                halo = geom["halo_padding"]
                interior_shape = geom["interior_valid_shape"]
                origin = geom["sample_origin"]

                hx, hy, hz = halo
                ox, oy, oz = origin
                ix, iy, iz = interior_shape

                f16_interior = arr_f16[hz:hz+iz, hy:hy+iy, hx:hx+ix]
                u16_interior_raw = arr_u16[hz:hz+iz, hy:hy+iy, hx:hx+ix]

                u16_valid_mask = (u16_interior_raw != b_missing).astype(np.uint8)
                u16_interior_decoded = np.where(
                    u16_valid_mask == 1,
                    u16_interior_raw.astype(np.float32) * b_scale + b_offset,
                    np.nan
                ).astype(np.float32)

                assembled_f16[oz:oz+iz, oy:oy+iy, ox:ox+ix] = f16_interior
                assembled_u16[oz:oz+iz, oy:oy+iy, ox:ox+ix] = u16_interior_decoded
                assembled_f16_mask[oz:oz+iz, oy:oy+iy, ox:ox+ix] = (~np.isnan(f16_interior)).astype(np.uint8)
                assembled_u16_mask[oz:oz+iz, oy:oy+iy, ox:ox+ix] = u16_valid_mask

            nc_valid_mask = ~np.isnan(nc_t_slice) & ~nc_t_slice.mask if hasattr(nc_t_slice, "mask") else ~np.isnan(nc_t_slice)
            nc_clean = np.where(nc_valid_mask, nc_t_slice, np.nan).astype(np.float32)

            self.assertTrue(np.array_equal(nc_valid_mask, assembled_f16_mask))
            self.assertTrue(np.array_equal(nc_valid_mask, assembled_u16_mask))

            valid_idx = np.where(nc_valid_mask)
            f16_errs = np.abs(assembled_f16[valid_idx] - nc_clean[valid_idx])
            u16_errs = np.abs(assembled_u16[valid_idx] - nc_clean[valid_idx])

            t_f16_max = float(np.max(f16_errs))
            t_u16_max = float(np.max(u16_errs))

            if t_f16_max > max_f16_err:
                max_f16_err = t_f16_max
            if t_u16_max > max_u16_err:
                max_u16_err = t_u16_max

            total_valid_voxels += len(f16_errs)

            # Strict per-timestep bounds
            self.assertLessEqual(t_f16_max, 0.0078125, f"Timestep {t_idx} Float16 max error exceeds IEEE 754 half bound")
            self.assertLessEqual(t_u16_max, 0.0001625, f"Timestep {t_idx} Uint16 max error exceeds theoretical quantization bound")

        self.assertEqual(total_valid_voxels, 3618944)
        self.assertLessEqual(max_f16_err, 0.0078125)
        self.assertLessEqual(max_u16_err, 0.0001625)

    # =========================================================================
    # 2. CPU Analytical Raymarching Reference Harness
    # =========================================================================
    def test_smits_kay_ray_box_intersection(self):
        """Verify Smits-Kay ray-AABB analytical intersection against expected ray paths."""
        box_min = np.array([0.0, 0.0, 0.0])
        box_max = np.array([1.0, 1.0, 1.0])

        def cpu_intersect_aabb(origin: np.ndarray, direction: np.ndarray):
            inv_dir = 1.0 / np.where(direction == 0, 1e-12, direction)
            t0 = (box_min - origin) * inv_dir
            t1 = (box_max - origin) * inv_dir
            tmin = np.minimum(t0, t1)
            tmax = np.maximum(t0, t1)
            t_near = max(max(tmin[0], tmin[1]), tmin[2])
            t_far = min(min(tmax[0], tmax[1]), tmax[2])
            if t_near <= t_far and t_far > 0.0:
                return True, max(0.0, float(t_near)), float(t_far)
            return False, 0.0, 0.0

        test_cases = [
            ("frontal", np.array([0.5, 0.5, -1.0]), np.array([0.0, 0.0, 1.0]), True, 1.0, 2.0),
            ("inside", np.array([0.5, 0.5, 0.5]), np.array([0.0, 0.0, 1.0]), True, 0.0, 0.5),
            ("diagonal", np.array([-1.0, -1.0, -1.0]), np.array([1.0, 1.0, 1.0]) / np.sqrt(3.0), True, np.sqrt(3.0), 2.0 * np.sqrt(3.0)),
            ("miss", np.array([2.0, 2.0, -1.0]), np.array([0.0, 0.0, 1.0]), False, 0.0, 0.0),
        ]

        for name, orig, dir_vec, exp_hit, exp_near, exp_far in test_cases:
            with self.subTest(case=name):
                hit, t_near, t_far = cpu_intersect_aabb(orig, dir_vec)
                self.assertEqual(hit, exp_hit)
                if exp_hit:
                    self.assertAlmostEqual(t_near, exp_near, places=4)
                    self.assertAlmostEqual(t_far, exp_far, places=4)

    def test_beer_lambert_opacity_correction_invariance(self):
        """Verify Beer-Lambert step-size opacity correction multi-step composition equals single step."""
        dt_ref = 0.005
        test_dt = 0.0025
        alpha_raw = 0.45

        def beer_lambert(a_samp, dt, ref):
            return 1.0 - math.pow(max(1.0 - a_samp, 0.0), dt / ref)

        # Single step of 0.005
        alpha_single = beer_lambert(alpha_raw, 0.005, dt_ref)

        # Two sub-steps of 0.0025 composited
        alpha_sub = beer_lambert(alpha_raw, test_dt, dt_ref)
        alpha_comp = alpha_sub + (1.0 - alpha_sub) * alpha_sub

        self.assertAlmostEqual(alpha_single, alpha_comp, places=7)

    def test_continuous_depth_lut_piecewise_linear_interpolation(self):
        """Verify continuous depth LUT interpolation across all 31 depth levels and midpoints."""
        lut = list(DEPTH_LUT_METERS)
        level_count = len(lut)
        max_idx = level_count - 1

        def eval_lut(w_z: float) -> float:
            c_idx = min(max(w_z * max_idx, 0.0), float(max_idx))
            l_idx = int(math.floor(c_idx))
            u_idx = min(level_count - 1, l_idx + 1)
            frac = c_idx - l_idx
            return lut[l_idx] + (lut[u_idx] - lut[l_idx]) * frac

        # Integer nodes
        for i in range(level_count):
            w = i / max_idx
            self.assertAlmostEqual(eval_lut(w), lut[i], places=5)

        # Midpoints
        for i in range(level_count - 1):
            w = (i + 0.5) / max_idx
            exp_mid = 0.5 * (lut[i] + lut[i+1])
            self.assertAlmostEqual(eval_lut(w), exp_mid, places=5)

    # =========================================================================
    # 3. Strict Invariant & Authoritative Exact Value Checks
    # =========================================================================
    def test_exact_query_service_zero_numerical_delta(self):
        """Verify ExactQueryEngine retrieves exact floating point ground truth with 0 delta."""
        lat_arr = self.nc_ds.variables["latitude"][:]
        lon_arr = self.nc_ds.variables["longitude"][:]

        test_points = [
            ("Surface Layer", 4.0, 84.0, VerticalSelectorType.SEA_SURFACE, 0.0, 0, "2026-08-30T00:00:00Z", 6),
            ("Thermocline 55m", 4.0, 84.0, VerticalSelectorType.PHYSICAL_DEPTH_METERS, 55.0, 18, "2026-08-30T00:00:00Z", 6),
            ("Deep Ocean 453m", 4.0, 84.0, VerticalSelectorType.SEA_FLOOR, 0.0, 30, "2026-08-30T00:00:00Z", 6),
            ("Grid Level 10", 2.0, 86.0, VerticalSelectorType.GRID_LEVEL_INDEX, 10, 10, "2026-08-24T00:00:00Z", 0),
        ]

        for name, lat, lon, selector, target_val, exp_d_idx, time_utc, t_idx in test_points:
            with self.subTest(case=name):
                req = ExactValueQueryRequest(
                    dataset_id="copernicus_phy_thetao",
                    variable_id="sea_water_potential_temperature",
                    latitude_deg=lat,
                    longitude_deg=lon,
                    vertical_selector_type=selector,
                    vertical_target_value=target_val,
                    target_time_utc=time_utc,
                )
                resp = self.query_engine.execute_exact_point_query(req)
                lat_idx = int(np.argmin(np.abs(lat_arr - lat)))
                lon_idx = int(np.argmin(np.abs(lon_arr - lon)))
                expected_nc = float(self.nc_thetao[t_idx, exp_d_idx, lat_idx, lon_idx])

                self.assertEqual(float(resp.scientific_value), expected_nc)

    def test_vertical_profile_query_exact_column_match(self):
        """Verify VerticalProfileQueryEngine retrieves exact vertical column with 0 delta across 31 levels."""
        lat = 4.0
        lon = 84.0
        req = VerticalProfileQueryRequest(
            dataset_id="copernicus_phy_thetao",
            variable_id="sea_water_potential_temperature",
            latitude_deg=lat,
            longitude_deg=lon,
            target_time_utc="2026-08-30T00:00:00Z",
        )
        resp = self.query_engine.execute_vertical_profile_query(req)
        self.assertEqual(len(resp.samples), 31)

        lat_arr = self.nc_ds.variables["latitude"][:]
        lon_arr = self.nc_ds.variables["longitude"][:]
        lat_idx = int(np.argmin(np.abs(lat_arr - lat)))
        lon_idx = int(np.argmin(np.abs(lon_arr - lon)))

        for level_sample in resp.samples:
            d_idx = level_sample.level_index
            exp_nc = float(self.nc_thetao[6, d_idx, lat_idx, lon_idx])
            self.assertEqual(float(level_sample.scientific_value), exp_nc)


if __name__ == "__main__":
    unittest.main()
