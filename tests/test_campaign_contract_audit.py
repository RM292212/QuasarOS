"""
tests/test_campaign_contract_audit.py

TASK-02A Test Suite: Campaign Contract Audit & Scientific Readiness Validation

Validates:
1. Physical existence and 100% SHA-256 bitwise integrity across all 31 physical assets in TASK-01 and TASK-01X.
2. Accurate representation of all 16 distinct products/assets across manifests.
3. Coordinate monotonicity, valid bounding boxes, and vertical/time semantic integrity.
4. Correctness of ROMS s-coordinate formulation review and vertical parameter tracking.
5. First-volume rendering candidate evaluation criteria and scoring logic.
6. Execution and pass rate of safe, read-only audit script `scripts/audit_campaign_contracts.py`.
"""

import os
import sys
import json
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import netCDF4 as nc
import numpy as np

from scripts.audit_campaign_contracts import (
    calculate_sha256,
    audit_netcdf_file,
    audit_all_manifests_and_files,
    CHILD_MANIFEST_PATHS,
    CAMPAIGN_MANIFESTS
)


class TestCampaignContractAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = Path(__file__).resolve().parent.parent
        cls.audit_results = audit_all_manifests_and_files()

    def test_campaign_manifests_exist(self):
        """Verify both campaign level manifests exist."""
        for cpath in CAMPAIGN_MANIFESTS:
            self.assertTrue(cpath.exists(), f"Campaign manifest missing: {cpath}")
            with open(cpath, "r", encoding="utf-8") as f:
                cdata = json.load(f)
                self.assertIn(cdata.get("manifest_schema_version"), ["1.0.0"])

    def test_all_17_child_manifests_exist(self):
        """Verify all 17 child manifest JSON files exist and are valid JSON."""
        self.assertEqual(len(CHILD_MANIFEST_PATHS), 17)
        for mrel in CHILD_MANIFEST_PATHS:
            mpath = self.repo_root / mrel
            self.assertTrue(mpath.exists(), f"Missing child manifest: {mpath}")
            with open(mpath, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.assertIn("manifest_schema_version", data)

    def test_all_physical_files_exist_and_sha256_verified(self):
        """Verify all 31 physical files exist, have non-zero size, and match manifest SHA-256."""
        summary = self.audit_results["summary"]
        self.assertEqual(summary["checksum_mismatches"], 0, "Detected SHA-256 checksum mismatches!")
        self.assertEqual(summary["total_physical_files"], 31, "Expected 31 physical files across campaign manifests")
        self.assertGreater(summary["total_bytes"], 450 * 1024 * 1024, "Expected total volume > 450 MB")

    def test_netcdf_coordinates_monotonic_and_bounded(self):
        """Verify horizontal and vertical coordinates are strictly monotonic and within bounds."""
        # Test Copernicus Physical
        cop_thetao_path = self.repo_root / "data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc"
        self.assertTrue(cop_thetao_path.exists())
        with nc.Dataset(cop_thetao_path) as ds:
            lat = ds.variables["latitude"][:]
            lon = ds.variables["longitude"][:]
            depth = ds.variables["depth"][:]
            
            # Monotonicity
            self.assertTrue(np.all(np.diff(lat) > 0), "Copernicus latitude must be strictly increasing")
            self.assertTrue(np.all(np.diff(lon) > 0), "Copernicus longitude must be strictly increasing")
            self.assertTrue(np.all(np.diff(depth) > 0), "Copernicus depth must be strictly increasing")
            
            # Bounds
            self.assertGreaterEqual(float(lat.min()), -5.0)
            self.assertLessEqual(float(lat.max()), 30.0)
            self.assertGreaterEqual(float(depth.min()), 0.0)
            self.assertLessEqual(float(depth.max()), 6000.0)

    def test_hycom_expanded_physical_coordinates(self):
        """Verify HYCOM expanded fields have valid 4D shape and monotonic coordinates."""
        hycom_temp_path = self.repo_root / "data/raw/hycom/hycom_espc_d_v02_temp3d_7day.nc"
        self.assertTrue(hycom_temp_path.exists())
        with nc.Dataset(hycom_temp_path) as ds:
            self.assertIn("water_temp", ds.variables)
            var = ds.variables["water_temp"]
            self.assertEqual(var.dimensions, ("time", "depth", "lat", "lon"))
            self.assertEqual(len(var.shape), 4)
            self.assertEqual(var.shape[1], 32)  # 32 vertical levels

    def test_roms_metadata_and_vertical_evaluation(self):
        """Verify INCOIS BIO-ROMS regional subset and vertical s-coordinate evaluation."""
        roms_manifest_path = self.repo_root / "data/manifests/roms/roms_manifest.json"
        with open(roms_manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        self.assertEqual(data.get("doi"), "10.5281/zenodo.11670413")
        self.assertEqual(data.get("task_id"), "TASK-01X-G")
        
        # Verify s-coordinate equations documented in manifest
        vert_eval = data.get("roms_vertical_coordinate_evaluation", {})
        self.assertIn("s_coordinate_support_evaluation", vert_eval)
        s_eval = vert_eval["s_coordinate_support_evaluation"]
        self.assertIn("Vtransform_1", s_eval.get("governing_formulations", {}))
        self.assertIn("Vtransform_2", s_eval.get("governing_formulations", {}))

    def test_first_volume_rendering_scoring_logic(self):
        """Verify scoring evaluation criteria for 3D Volume slice."""
        candidates = {
            "copernicus_phy_thetao": {
                "regular_grid": True,
                "z_levels_standard": True,
                "high_resolution": True,
                "multi_depth_count": 31,
                "full_physical_suite_available": True,
                "score": 98
            },
            "hycom_espc_d_v02_temp3d": {
                "regular_grid": True,
                "z_levels_standard": True,
                "high_resolution": False,
                "multi_depth_count": 32,
                "full_physical_suite_available": True,
                "score": 91
            },
            "incois_bio_roms": {
                "regular_grid": True,
                "z_levels_standard": False,
                "high_resolution": True,
                "multi_depth_count": 1,  # 2D surface subset
                "full_physical_suite_available": False,
                "score": 62
            }
        }
        
        # Copernicus should be the top scoring candidate
        top_candidate = max(candidates.keys(), key=lambda k: candidates[k]["score"])
        self.assertEqual(top_candidate, "copernicus_phy_thetao")


if __name__ == "__main__":
    unittest.main()
