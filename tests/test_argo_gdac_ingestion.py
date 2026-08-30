"""
Test suite for Argo GDAC Physical & BGC Profiles Ingestion (TASK-01G).
Validates raw NetCDF-3/NetCDF-4 profile datasets, variables, QC arrays, coordinates,
checksums, physical bounds, and manifest metadata for the North Indian Ocean.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestArgoGDACIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_dir = os.path.join(cls.repo_root, "data", "raw", "argo-gdac")
        cls.manifest_path = os.path.join(cls.repo_root, "data", "manifests", "argo-gdac", "argo_gdac_manifest.json")
        
        cls.expected_nc_files = ["D1902669_012.nc", "R1902581_050.nc", "SR1902594_001.nc"]
        cls.expected_idx_files = [
            "ar_index_north_indian_ocean_prof.txt",
            "argo_synthetic_north_indian_ocean_prof.txt"
        ]

    def test_raw_files_exist(self):
        for fname in self.expected_nc_files:
            fpath = os.path.join(self.raw_dir, fname)
            self.assertTrue(os.path.exists(fpath), f"NetCDF file missing: {fpath}")
            size = os.path.getsize(fpath)
            self.assertGreater(size, 5_000, f"NetCDF file unexpectedly small: {size} bytes ({fname})")

    def test_index_files_exist_and_populated(self):
        for fname in self.expected_idx_files:
            fpath = os.path.join(self.raw_dir, fname)
            self.assertTrue(os.path.exists(fpath), f"Index file missing: {fpath}")
            size = os.path.getsize(fpath)
            self.assertGreater(size, 100_000, f"Index file suspiciously small: {size} bytes ({fname})")

    def test_manifest_structure_and_task_id(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01G")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertIn("licence", manifest)
        self.assertIn("provider", manifest)
        self.assertIn("profiles", manifest)
        self.assertIn("files", manifest)
        self.assertEqual(len(manifest["profiles"]), 3)
        self.assertEqual(len(manifest["files"]), 5)  # 2 index files + 3 nc files

    def test_sha256_checksums_match_manifest(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        for file_entry in manifest["files"]:
            rel_p = file_entry["relative_path"].replace("/", os.sep)
            abs_p = os.path.join(self.repo_root, rel_p)
            self.assertTrue(os.path.exists(abs_p), f"File in manifest does not exist: {abs_p}")

            expected_size = file_entry["byte_size"]
            expected_sha = file_entry["sha256"]

            actual_size = os.path.getsize(abs_p)
            hasher = hashlib.sha256()
            with open(abs_p, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            actual_sha = hasher.hexdigest()

            self.assertEqual(actual_size, expected_size, f"Byte size mismatch for {file_entry['file_name']}")
            self.assertEqual(actual_sha, expected_sha, f"SHA-256 checksum mismatch for {file_entry['file_name']}")

    def test_netcdf_opens_and_contains_pres_temp_psal(self):
        for fname in self.expected_nc_files:
            fpath = os.path.join(self.raw_dir, fname)
            ds = netCDF4.Dataset(fpath, "r")
            try:
                self.assertIn("PRES", ds.variables, f"PRES missing in {fname}")
                self.assertIn("TEMP", ds.variables, f"TEMP missing in {fname}")
                self.assertIn("PSAL", ds.variables, f"PSAL missing in {fname}")

                # Check QC variables
                self.assertIn("PRES_QC", ds.variables, f"PRES_QC missing in {fname}")
                self.assertIn("TEMP_QC", ds.variables, f"TEMP_QC missing in {fname}")
                self.assertIn("PSAL_QC", ds.variables, f"PSAL_QC missing in {fname}")

                # Check Profile-level QC
                self.assertIn("PROFILE_PRES_QC", ds.variables, f"PROFILE_PRES_QC missing in {fname}")
                self.assertIn("PROFILE_TEMP_QC", ds.variables, f"PROFILE_TEMP_QC missing in {fname}")
                self.assertIn("PROFILE_PSAL_QC", ds.variables, f"PROFILE_PSAL_QC missing in {fname}")
            finally:
                ds.close()

    def test_spatial_coordinates_in_north_indian_ocean(self):
        for fname in self.expected_nc_files:
            fpath = os.path.join(self.raw_dir, fname)
            ds = netCDF4.Dataset(fpath, "r")
            try:
                lat = float(ds.variables["LATITUDE"][0])
                lon = float(ds.variables["LONGITUDE"][0])

                self.assertGreaterEqual(lat, 0.0, f"Latitude {lat} < 0N in {fname}")
                self.assertLessEqual(lat, 30.0, f"Latitude {lat} > 30N in {fname}")
                self.assertGreaterEqual(lon, 40.0, f"Longitude {lon} < 40E in {fname}")
                self.assertLessEqual(lon, 100.0, f"Longitude {lon} > 100E in {fname}")
            finally:
                ds.close()

    def test_physical_variable_bounds_and_thermocline(self):
        for fname in self.expected_nc_files:
            fpath = os.path.join(self.raw_dir, fname)
            ds = netCDF4.Dataset(fpath, "r")
            try:
                # Compressed array extracts non-masked valid measurements
                pres = ds.variables["PRES"][:]
                temp = ds.variables["TEMP"][:]
                psal = ds.variables["PSAL"][:]

                valid_pres = pres.compressed() if np.ma.is_masked(pres) else pres[~np.isnan(pres)]
                valid_temp = temp.compressed() if np.ma.is_masked(temp) else temp[~np.isnan(temp)]
                valid_psal = psal.compressed() if np.ma.is_masked(psal) else psal[~np.isnan(psal)]

                self.assertGreater(len(valid_pres), 0, f"No valid PRES points in {fname}")
                self.assertGreater(len(valid_temp), 0, f"No valid TEMP points in {fname}")
                self.assertGreater(len(valid_psal), 0, f"No valid PSAL points in {fname}")

                # Pressure check (0 to 2100 dbar)
                self.assertGreaterEqual(float(valid_pres.min()), 0.0)
                self.assertLessEqual(float(valid_pres.max()), 2100.0)

                # Temperature check in North Indian Ocean (2.0C deep to 32.0C surface)
                self.assertGreater(float(valid_temp.min()), 2.0, f"Temperature too low in {fname}")
                self.assertLess(float(valid_temp.max()), 32.0, f"Temperature too high in {fname}")

                # Salinity check (30.0 to 38.0 PSU)
                self.assertGreater(float(valid_psal.min()), 30.0, f"Salinity too low in {fname}")
                self.assertLess(float(valid_psal.max()), 38.0, f"Salinity too high in {fname}")

                # Thermocline verification for first profile (surface vs deep)
                p0_pres = pres[0].compressed() if np.ma.is_masked(pres[0]) else pres[0]
                p0_temp = temp[0].compressed() if np.ma.is_masked(temp[0]) else temp[0]
                
                if len(p0_temp) > 10:
                    surface_temp = float(p0_temp[0])
                    deep_temp = float(p0_temp[-1])
                    self.assertGreater(surface_temp, deep_temp + 5.0,
                                       f"Physical stratification violated: surface ({surface_temp:.2f}C) not warmer than deep ({deep_temp:.2f}C) in {fname}")
            finally:
                ds.close()

    def test_bgc_synthetic_profile_parameters(self):
        bgc_file = os.path.join(self.raw_dir, "SR1902594_001.nc")
        ds = netCDF4.Dataset(bgc_file, "r")
        try:
            expected_bgc_vars = ["DOXY", "CHLA", "BBP700", "CDOM", "DOWNWELLING_PAR"]
            for v in expected_bgc_vars:
                self.assertIn(v, ds.variables, f"BGC parameter {v} missing in {bgc_file}")

            # Verify DOXY (Dissolved Oxygen) range in micromole/kg
            doxy = ds.variables["DOXY"][:]
            valid_doxy = doxy.compressed() if np.ma.is_masked(doxy) else doxy[~np.isnan(doxy)]
            self.assertGreater(len(valid_doxy), 0, "No valid DOXY points")
            self.assertGreater(float(valid_doxy.min()), 0.0)
            self.assertLess(float(valid_doxy.max()), 400.0)

            # Verify Chlorophyll-a range in mg/m3
            chla = ds.variables["CHLA"][:]
            valid_chla = chla.compressed() if np.ma.is_masked(chla) else chla[~np.isnan(chla)]
            self.assertGreater(len(valid_chla), 0, "No valid CHLA points")
            self.assertGreater(float(valid_chla.min()), 0.0)
            self.assertLess(float(valid_chla.max()), 10.0)
        finally:
            ds.close()


if __name__ == "__main__":
    unittest.main()
