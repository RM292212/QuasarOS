"""
Unit test suite for INCOIS-GODAS / MOM Operational Model Evaluation & Manifest (TASK-01X-E).
Validates manifest schema, operational model runs, grid topologies, variable axes, access gap documentation, and technical documentation.
"""

import os
import json
import unittest


class TestINCOISGODASMOMIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.manifest_path = os.path.join(
            cls.repo_root, "data", "manifests", "incois-godas-mom", "incois_godas_mom_manifest.json"
        )
        cls.readme_path = os.path.join(
            cls.repo_root, "data", "raw", "incois", "godas-mom", "README.md"
        )

    def test_manifest_file_exists_and_valid_json(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest file missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest.get("task_id"), "TASK-01X-E")
        self.assertEqual(manifest.get("manifest_schema_version"), "1.0.0")
        self.assertEqual(manifest.get("product_id"), "INCOIS-GODAS-MOM")

    def test_access_gap_documentation(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        eval_info = manifest.get("access_evaluation", {})
        self.assertEqual(eval_info.get("status"), "COMPLETE WITH DOCUMENTED ACCESS GAP")
        self.assertIn("https://las.incois.gov.in/las/", eval_info.get("las_endpoint", ""))
        self.assertIn("https://las.incois.gov.in/thredds/catalog/las/catalog.xml", eval_info.get("thredds_catalog_endpoint", ""))
        formal_pathway = eval_info.get("formal_request_pathway", {})
        self.assertIn("contact_email", formal_pathway)
        self.assertIn("data_policy_url", formal_pathway)

    def test_operational_runs_registry(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        runs = manifest.get("operational_runs", [])
        self.assertGreaterEqual(len(runs), 4, "Expected at least 4 operational annual runs (2022-2025)")

        run_names = [r["name"] for r in runs]
        for expected_year in ["2022", "2023", "2024", "2025"]:
            self.assertTrue(
                any(expected_year in name for name in run_names),
                f"Missing operational run for year {expected_year}"
            )

        for r in runs:
            self.assertTrue(r["dataset_id"].startswith("id-"))
            self.assertIn("catalog_url", r)
            self.assertIn("opendap_url", r)
            self.assertIn("time_range", r)
            self.assertGreater(r["time_range"]["timesteps_count"], 0)

    def test_grid_topology_and_vertical_levels(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        grid = manifest.get("model_grid_topology", {})
        
        # X-axis
        x_axis = grid.get("x_axis", {})
        self.assertEqual(x_axis.get("size"), 720)
        self.assertEqual(x_axis.get("step"), 0.5)
        self.assertEqual(x_axis.get("span_deg"), 360.0)

        # Y-axis
        y_axis = grid.get("y_axis", {})
        self.assertLessEqual(y_axis.get("latitude_min"), -80.0)
        self.assertGreaterEqual(y_axis.get("latitude_max"), 80.0)

        # Z-axis (40 vertical levels)
        z_axis = grid.get("z_axis", {})
        self.assertEqual(z_axis.get("levels_count"), 40)
        depths = z_axis.get("depth_levels_m", [])
        self.assertEqual(len(depths), 40)
        self.assertEqual(depths[0], 5.0)
        self.assertAlmostEqual(depths[-1], 4478.478, places=2)
        # Check strictly monotonic increasing depth
        for i in range(len(depths) - 1):
            self.assertLess(depths[i], depths[i + 1], "Depths must be strictly monotonically increasing")

    def test_model_variables_schema(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        variables = manifest.get("model_variables", [])
        var_names = [v["name"] for v in variables]

        required_vars = ["TEMP", "SALT", "U", "V", "WT", "MLD", "SSH"]
        for rv in required_vars:
            self.assertIn(rv, var_names, f"Required variable '{rv}' missing from manifest schema")

        for v in variables:
            self.assertIn("standard_name", v)
            self.assertIn("units", v)
            self.assertIn("dimensions", v)
            self.assertIn("grid_intervals", v)

    def test_readme_technical_documentation(self):
        self.assertTrue(os.path.exists(self.readme_path), f"README missing: {self.readme_path}")
        with open(self.readme_path, "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("TASK-01X-E", content)
        self.assertIn("INCOIS-GODAS / MOM", content)
        self.assertIn("COMPLETE WITH DOCUMENTED ACCESS GAP", content)
        self.assertIn("Live Access Server", content)
        self.assertIn("MOM4p1 / MOM5", content)


if __name__ == "__main__":
    unittest.main()
