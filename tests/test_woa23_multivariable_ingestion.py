"""
Unit tests for NOAA NCEI WOA23 Multivariable Climatology Ingestion (TASK-01X-J).

Validates raw NetCDF-4 files and manifest for North Indian Ocean climatological fields:
- Salinity (s_an)
- Dissolved Oxygen (o_an)
- Nitrate (n_an)
- Phosphate (p_an)
- Silicate (i_an)
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4 as nc


class TestWOA23MultivariableIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.manifest_path = os.path.join(
            cls.repo_root, "data", "manifests", "woa23-multivariable", "woa23_multivariable_manifest.json"
        )
        cls.raw_dir = os.path.join(cls.repo_root, "data", "raw", "woa23", "multivariable")

    def test_manifest_existence_and_schema(self):
        self.assertTrue(os.path.exists(self.manifest_path), "WOA23 multivariable manifest does not exist.")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01X-J")
        self.assertEqual(manifest.get("product_id"), "WOA23-MULTIVARIABLE")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertIn("files", manifest)
        self.assertEqual(len(manifest["files"]), 5)
        self.assertEqual(
            set(manifest.get("variables_included", [])),
            {"s_an", "o_an", "n_an", "p_an", "i_an"}
        )

    def test_raw_files_exist_and_checksums_match(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        for file_entry in manifest["files"]:
            rel_path = file_entry["relative_path"]
            abs_path = os.path.join(self.repo_root, *rel_path.split("/"))
            self.assertTrue(os.path.exists(abs_path), f"Raw NetCDF file missing: {rel_path}")

            # Verify byte size
            actual_size = os.path.getsize(abs_path)
            self.assertEqual(actual_size, file_entry["byte_size"], f"Size mismatch for {rel_path}")

            # Verify SHA-256
            hasher = hashlib.sha256()
            with open(abs_path, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            self.assertEqual(hasher.hexdigest(), file_entry["sha256"], f"SHA256 mismatch for {rel_path}")

    def test_salinity_netcdf_structure_and_values(self):
        sal_file = os.path.join(self.raw_dir, "woa23_august_salinity_north_indian_ocean.nc")
        self.assertTrue(os.path.exists(sal_file))
        
        with nc.Dataset(sal_file, "r") as ds:
            self.assertIn("s_an", ds.variables)
            self.assertIn("lat", ds.variables)
            self.assertIn("lon", ds.variables)
            self.assertIn("depth", ds.variables)
            self.assertIn("time", ds.variables)

            # Salinity is 0.25 deg grid -> 120 lats (0-30N), 240 lons (40-100E), 57 depths
            self.assertEqual(len(ds.dimensions["lat"]), 120)
            self.assertEqual(len(ds.dimensions["lon"]), 240)
            self.assertEqual(len(ds.dimensions["depth"]), 57)
            self.assertEqual(len(ds.dimensions["time"]), 1)

            lats = ds.variables["lat"][:]
            lons = ds.variables["lon"][:]
            self.assertGreaterEqual(float(lats[0]), 0.0)
            self.assertLessEqual(float(lats[-1]), 30.0)
            self.assertGreaterEqual(float(lons[0]), 40.0)
            self.assertLessEqual(float(lons[-1]), 100.0)

            # Physical salinity range
            sal = ds.variables["s_an"][:]
            valid_mask = ~np.isnan(sal)
            if hasattr(sal, "mask"):
                valid_mask = valid_mask & (~sal.mask)
            valid_vals = np.asarray(sal)[valid_mask]
            self.assertGreater(len(valid_vals), 0)
            self.assertGreater(float(valid_vals.min()), 20.0)
            self.assertLess(float(valid_vals.max()), 45.0)

    def test_oxygen_netcdf_structure_and_values(self):
        oxy_file = os.path.join(self.raw_dir, "woa23_august_oxygen_north_indian_ocean.nc")
        self.assertTrue(os.path.exists(oxy_file))
        
        with nc.Dataset(oxy_file, "r") as ds:
            self.assertIn("o_an", ds.variables)
            self.assertEqual(len(ds.dimensions["lat"]), 30)
            self.assertEqual(len(ds.dimensions["lon"]), 60)
            self.assertEqual(len(ds.dimensions["depth"]), 57)

            oxy = ds.variables["o_an"][:]
            valid_mask = ~np.isnan(oxy)
            if hasattr(oxy, "mask"):
                valid_mask = valid_mask & (~oxy.mask)
            valid_vals = np.asarray(oxy)[valid_mask]
            self.assertGreater(len(valid_vals), 0)
            self.assertGreaterEqual(float(valid_vals.min()), 0.0)
            self.assertLessEqual(float(valid_vals.max()), 350.0)

    def test_nutrients_netcdf_structure_and_values(self):
        nutrients = [
            ("woa23_august_nitrate_north_indian_ocean.nc", "n_an", 0.0, 60.0),
            ("woa23_august_phosphate_north_indian_ocean.nc", "p_an", 0.0, 5.0),
            ("woa23_august_silicate_north_indian_ocean.nc", "i_an", 0.0, 150.0),
        ]

        for fname, var_name, min_exp, max_exp in nutrients:
            fpath = os.path.join(self.raw_dir, fname)
            self.assertTrue(os.path.exists(fpath), f"Nutrient file {fname} not found")
            
            with nc.Dataset(fpath, "r") as ds:
                self.assertIn(var_name, ds.variables)
                self.assertEqual(len(ds.dimensions["lat"]), 30)
                self.assertEqual(len(ds.dimensions["lon"]), 60)
                self.assertEqual(len(ds.dimensions["depth"]), 43)

                data = ds.variables[var_name][:]
                valid_mask = ~np.isnan(data)
                if hasattr(data, "mask"):
                    valid_mask = valid_mask & (~data.mask)
                valid_vals = np.asarray(data)[valid_mask]
                self.assertGreater(len(valid_vals), 0, f"No valid values for {var_name}")
                self.assertGreaterEqual(float(valid_vals.min()), min_exp, f"Min below {min_exp} for {var_name}")
                self.assertLessEqual(float(valid_vals.max()), max_exp, f"Max above {max_exp} for {var_name}")


if __name__ == "__main__":
    unittest.main()
