"""
Test suite for NOAA NCEI WOA23 Climatology ingestion (TASK-01F)
and GEBCO Bathymetry ingestion (TASK-01E).
"""

import os
import json
import hashlib
import unittest
import netCDF4


class TestWOAAndGEBCOIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.woa_raw = os.path.join(cls.repo_root, "data", "raw", "woa23", "woa23_august_temp_north_indian_ocean.nc")
        cls.woa_manifest = os.path.join(cls.repo_root, "data", "manifests", "woa23", "woa23_manifest.json")
        cls.gebco_raw = os.path.join(cls.repo_root, "data", "raw", "gebco", "gebco_2020_north_indian_ocean.nc")
        cls.gebco_manifest = os.path.join(cls.repo_root, "data", "manifests", "gebco", "gebco_manifest.json")

    def test_woa23_files_and_checksum(self):
        self.assertTrue(os.path.exists(self.woa_raw), "WOA23 raw file missing")
        self.assertTrue(os.path.exists(self.woa_manifest), "WOA23 manifest missing")
        with open(self.woa_manifest, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest.get("task_id"), "TASK-01F")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")

        hasher = hashlib.sha256()
        with open(self.woa_raw, "rb") as f:
            hasher.update(f.read())
        self.assertEqual(hasher.hexdigest(), manifest["files"][0]["sha256"])

    def test_woa23_netcdf_structure(self):
        ds = netCDF4.Dataset(self.woa_raw, "r")
        try:
            self.assertIn("t_an", ds.variables)
            self.assertIn("lat", ds.variables)
            self.assertIn("lon", ds.variables)
            self.assertIn("depth", ds.variables)
            self.assertEqual(len(ds.dimensions["depth"]), 57)
            # Lat is within North Indian Ocean (0 to 30N)
            lats = ds.variables["lat"][:]
            self.assertGreaterEqual(float(lats[0]), 0.0)
            self.assertLessEqual(float(lats[-1]), 30.0)
        finally:
            ds.close()

    def test_gebco_files_and_checksum(self):
        self.assertTrue(os.path.exists(self.gebco_raw), "GEBCO raw file missing")
        self.assertTrue(os.path.exists(self.gebco_manifest), "GEBCO manifest missing")
        with open(self.gebco_manifest, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest.get("task_id"), "TASK-01E")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")

        hasher = hashlib.sha256()
        with open(self.gebco_raw, "rb") as f:
            hasher.update(f.read())
        self.assertEqual(hasher.hexdigest(), manifest["files"][0]["sha256"])

    def test_gebco_netcdf_structure(self):
        ds = netCDF4.Dataset(self.gebco_raw, "r")
        try:
            self.assertIn("elevation", ds.variables)
            elev = ds.variables["elevation"][:]
            self.assertLess(float(elev.min()), -4000.0, "Deep ocean depths should be < -4000m")
            self.assertGreater(float(elev.max()), 5000.0, "Himalayan/land elevations should be > 5000m")
        finally:
            ds.close()


if __name__ == "__main__":
    unittest.main()
