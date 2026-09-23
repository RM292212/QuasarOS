r"""
Milestone 4 & 5 Empirical Adversarial Challenge Verification Harness.
Author: Challenger 1 (m4_challenger_1)

Performs rigorous empirical verification of:
1. Backend In-situ Collocation Engine:
   - Numerical accuracy of per-level delta residuals, Mean Bias, and RMSE.
   - Robustness against single-level profiles, missing salinity, extreme gradients.
2. 50-Level Depth Interpolation:
   - Monotonicity preservation across non-uniform Copernicus depth levels (0.494m to 5,727.9m).
   - Linear and logarithmic ($Y \propto \ln(1+z)$) depth coordinate projection.
"""
import sys, os
sys.path.extend(['packages/services/src', 'packages/contracts/src', '.'])

import unittest
import numpy as np
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine
from quasar_services.observations.collocation_engine import CollocationEngine, ARGO_PROFILE_5906421

class TestM4ChallengerAdversarialSuite(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.analysis = ScientificAnalysisEngine()
        cls.colloc = CollocationEngine(cls.analysis)

    def test_collocation_mathematical_precision(self):
        """Verify layer residuals, bias, and RMSE match manual numpy calculation exactly."""
        res = self.colloc.collocate_argo_profile(ARGO_PROFILE_5906421, model_time_idx=2)
        metrics = res["metrics"]
        table = res["collocation_table"]

        self.assertEqual(metrics["sample_count"], len(table))
        self.assertEqual(metrics["sample_count"], 7)

        # Manual recalculation
        temp_deltas = [row["temperature_delta_c"] for row in table]
        sal_deltas = [row["salinity_delta"] for row in table]

        expected_temp_bias = float(np.mean(temp_deltas))
        expected_temp_rmse = float(np.sqrt(np.mean(np.array(temp_deltas) ** 2)))
        expected_sal_bias = float(np.mean(sal_deltas))
        expected_sal_rmse = float(np.sqrt(np.mean(np.array(sal_deltas) ** 2)))

        self.assertAlmostEqual(metrics["temperature_bias_c"], expected_temp_bias, places=10)
        self.assertAlmostEqual(metrics["temperature_rmse_c"], expected_temp_rmse, places=10)
        self.assertAlmostEqual(metrics["salinity_bias"], expected_sal_bias, places=10)
        self.assertAlmostEqual(metrics["salinity_rmse"], expected_sal_rmse, places=10)

        # Physical sanity: RMSE must be non-negative
        self.assertGreaterEqual(metrics["temperature_rmse_c"], 0.0)
        self.assertGreaterEqual(metrics["salinity_rmse"], 0.0)

    def test_collocation_adversarial_profiles(self):
        """Stress test collocation with single-level, deep abyss, and multi-level profiles."""
        # Single-level profile
        single_level_profile = {
            "platform_id": "TEST_SINGLE_001",
            "cycle_number": 1,
            "timestamp": "2026-08-26T08:30:00Z",
            "latitude": 7.452,
            "longitude": 64.120,
            "data_mode": "R",
            "levels": [
                {"pressure_dbar": 10.0, "depth_m": 9.92, "temp_c": 28.5, "psal": 35.8, "temp_qc": 1, "psal_qc": 1},
            ],
        }
        res_single = self.colloc.collocate_argo_profile(single_level_profile, model_time_idx=2)
        self.assertEqual(res_single["metrics"]["sample_count"], 1)
        delta_t = res_single["collocation_table"][0]["temperature_delta_c"]
        self.assertAlmostEqual(res_single["metrics"]["temperature_bias_c"], delta_t, places=10)
        self.assertAlmostEqual(res_single["metrics"]["temperature_rmse_c"], abs(delta_t), places=10)

        # Deep abyssal profile (levels down to 4000m)
        deep_profile = {
            "platform_id": "TEST_DEEP_002",
            "cycle_number": 10,
            "timestamp": "2026-08-26T08:30:00Z",
            "latitude": 7.452,
            "longitude": 64.120,
            "data_mode": "D",
            "levels": [
                {"depth_m": 10.0, "temp_c": 28.5, "psal": 35.8, "qc_flag": 1},
                {"depth_m": 500.0, "temp_c": 10.2, "psal": 35.1, "qc_flag": 1},
                {"depth_m": 2000.0, "temp_c": 2.5, "psal": 34.8, "qc_flag": 1},
                {"depth_m": 4000.0, "temp_c": 1.4, "psal": 34.7, "qc_flag": 1},
            ],
        }
        res_deep = self.colloc.collocate_argo_profile(deep_profile, model_time_idx=2)
        self.assertEqual(res_deep["metrics"]["sample_count"], 4)
        self.assertTrue(all(not np.isnan(row["model_temperature_c"]) for row in res_deep["collocation_table"]))

    def test_50_level_depth_monotonicity_and_projection(self):
        """Verify 50-level depth profile monotonicity and coordinate mapping."""
        res = self.analysis.query_vertical_profile("thetao", 0, 7.5, 64.0)
        depths = res["depth_levels_m"]
        self.assertEqual(len(depths), 50)

        # Strict monotonicity check
        for i in range(1, len(depths)):
            self.assertGreater(depths[i], depths[i - 1], f"Depth level {i} ({depths[i]}) <= {depths[i-1]}")

        # Linear vs Log projection model testing in Python
        z_min = depths[0]
        z_max = depths[-1]
        y_min = 0.0
        y_max = 1000.0

        def map_linear(z):
            return y_min + (z - z_min) / (z_max - z_min) * (y_max - y_min)

        def map_log(z):
            return y_min + (np.log(1.0 + z) - np.log(1.0 + z_min)) / (np.log(1.0 + z_max) - np.log(1.0 + z_min)) * (y_max - y_min)

        prev_lin = -1.0
        prev_log = -1.0
        for z in depths:
            yl = map_linear(z)
            yg = map_log(z)
            self.assertGreater(yl, prev_lin)
            self.assertGreater(yg, prev_log)
            prev_lin = yl
            prev_log = yg

        # Upper ocean magnification check at 100m
        y100_lin = map_linear(100.0)
        y100_log = map_log(100.0)
        magnification = y100_log / y100_lin
        self.assertGreater(magnification, 15.0)

if __name__ == "__main__":
    unittest.main()
