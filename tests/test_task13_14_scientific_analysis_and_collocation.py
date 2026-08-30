"""
TASK-13 & TASK-14 Cross-Subsystem Automated Test Suite (Refined for Real Bathymetry)
"""
import unittest, os, json
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine
from quasar_services.observations.collocation_engine import CollocationEngine, ARGO_PROFILE_5906421

class TestTask13AndTask14Engines(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.analysis = ScientificAnalysisEngine()
        cls.colloc = CollocationEngine(cls.analysis)

    def test_point_timeseries_extraction(self):
        res = self.analysis.query_point_timeseries("thetao", 7.5, 64.0, 0.494)
        self.assertEqual(len(res["timesteps"]), 7)
        self.assertEqual(len(res["values"]), 7)
        self.assertTrue(all(v is not None for v in res["values"]))

    def test_full_depth_50_level_profile(self):
        res = self.analysis.query_vertical_profile("so", 0, 7.5, 64.0)
        self.assertEqual(len(res["depth_levels_m"]), 50)
        # Deepest ocean column (at least upper 35 levels valid before bathymetry seabed)
        valid_count = sum(1 for v in res["values"] if v is not None)
        self.assertGreater(valid_count, 35)

    def test_teos10_derived_soundings(self):
        res = self.analysis.compute_teos10_derived_soundings(0, 7.5, 64.0)
        self.assertIn("mixed_layer_depth_m", res)
        self.assertGreater(res["mixed_layer_depth_m"], 0.0)
        # Real seabed at 64E, 7.5N is ~4400m (47 valid levels)
        self.assertGreaterEqual(len(res["soundings"]), 40)
        # Check physical bounds of sound speed and in-situ density
        s0 = res["soundings"][0]
        self.assertGreater(s0["sound_speed_m_s"], 1400.0)
        self.assertLess(s0["sound_speed_m_s"], 1600.0)
        self.assertGreater(s0["in_situ_density_kg_m3"], 1000.0)

    def test_argo_model_collocation(self):
        res = self.colloc.collocate_argo_profile(ARGO_PROFILE_5906421, model_time_idx=2)
        self.assertEqual(res["platform_id"], "5906421")
        self.assertIn("metrics", res)
        self.assertLess(res["metrics"]["temperature_rmse_c"], 3.0) # Physical upper bound for model error
        self.assertEqual(len(res["collocation_table"]), 7)

if __name__ == "__main__":
    unittest.main()
