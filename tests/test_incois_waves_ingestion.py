"""
Test suite for INCOIS Operational WAVEWATCH III Wave Forecast Data Ingestion (TASK-01X-D).
Validates raw NetCDF-4 dataset, coordinate grids, wave variables, physical bounds,
SHA-256 checksums, access audit, and manifest metadata for the North Indian Ocean domain.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestINCOISWavesIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_nc_path = os.path.join(
            cls.repo_root, "data", "raw", "incois", "waves", "incois_ww3_nio_20260830_20260905.nc"
        )
        cls.manifest_path = os.path.join(
            cls.repo_root, "data", "manifests", "incois-waves", "incois_waves_manifest.json"
        )

    def test_raw_file_exists(self):
        self.assertTrue(os.path.exists(self.raw_nc_path), f"NetCDF file missing: {self.raw_nc_path}")
        file_size = os.path.getsize(self.raw_nc_path)
        self.assertGreater(file_size, 10_000_000, f"NetCDF file unexpectedly small: {file_size} bytes")

    def test_manifest_file_exists_and_metadata(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest file missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("manifest_schema_version"), "1.0.0")
        self.assertEqual(manifest.get("task_id"), "TASK-01X-D")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertEqual(manifest.get("dataset_id"), "INCOIS_RSMC_NIO_WW3_OPERATIONAL")
        self.assertIn("INCOIS", manifest.get("provider", ""))
        self.assertIn("WAVEWATCH III", manifest.get("product_title", ""))
        self.assertIn("source_catalog_url", manifest)
        self.assertIn("source_opendap_url", manifest)
        self.assertIn("source_fileserver_url", manifest)
        self.assertIn("spatial_coverage", manifest)
        self.assertIn("temporal_coverage", manifest)
        self.assertIn("access_audit", manifest)
        self.assertIn("variables", manifest)
        self.assertIn("files", manifest)
        self.assertEqual(len(manifest["files"]), 1)

    def test_sha256_checksum_and_byte_size(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        expected_sha256 = manifest["files"][0]["sha256"]
        expected_bytes = manifest["files"][0]["byte_size"]

        hasher = hashlib.sha256()
        with open(self.raw_nc_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        actual_sha256 = hasher.hexdigest()
        actual_bytes = os.path.getsize(self.raw_nc_path)

        self.assertEqual(actual_bytes, expected_bytes, "File byte size mismatch with manifest")
        self.assertEqual(actual_sha256, expected_sha256, "SHA256 checksum mismatch with manifest")

    def test_netcdf_dimensions_and_coordinates(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            self.assertIn("time", ds.dimensions)
            self.assertIn("latitude", ds.dimensions)
            self.assertIn("longitude", ds.dimensions)

            self.assertEqual(len(ds.dimensions["time"]), 56)
            self.assertEqual(len(ds.dimensions["latitude"]), 291)
            self.assertEqual(len(ds.dimensions["longitude"]), 601)

            lats = ds.variables["latitude"][:]
            lons = ds.variables["longitude"][:]

            # Check latitude span and monotonic progression
            self.assertAlmostEqual(float(lats.min()), 0.0, places=4)
            self.assertAlmostEqual(float(lats.max()), 29.0, places=4)
            self.assertTrue(np.all(np.diff(lats) > 0), "Latitudes must be strictly monotonically increasing")

            # Check longitude span and monotonic progression
            self.assertAlmostEqual(float(lons.min()), 40.0, places=4)
            self.assertAlmostEqual(float(lons.max()), 100.0, places=4)
            self.assertTrue(np.all(np.diff(lons) > 0), "Longitudes must be strictly monotonically increasing")
        finally:
            ds.close()

    def test_temporal_coverage(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            times = ds.variables["time"][:]
            self.assertEqual(len(times), 56)
            time_diffs = np.diff(times)
            # 3-hourly time interval = 10800 seconds
            self.assertTrue(
                np.all(time_diffs == 10800.0),
                f"Expected 3-hourly intervals (10800s), got diffs: {time_diffs[:5]}"
            )
        finally:
            ds.close()

    def test_wave_variables_presence_and_attributes(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            required_vars = ["HS", "PWP", "MWD", "PWD", "T02", "UWND", "VWND"]
            for v_name in required_vars:
                self.assertIn(v_name, ds.variables, f"Missing required variable: {v_name}")
                v = ds.variables[v_name]
                self.assertEqual(v.dimensions, ("time", "latitude", "longitude"))
                self.assertEqual(v.shape, (56, 291, 601))
                self.assertTrue(hasattr(v, "standard_name"))
                self.assertTrue(hasattr(v, "units"))
                self.assertTrue(hasattr(v, "canonical_identifier"))

            # Specific variable checks
            hs = ds.variables["HS"]
            self.assertEqual(hs.standard_name, "sea_surface_wave_significant_height")
            self.assertEqual(hs.units, "m")
            self.assertEqual(hs.canonical_identifier, "swh")

            pwp = ds.variables["PWP"]
            self.assertEqual(pwp.standard_name, "sea_surface_wave_period_at_variance_spectral_density_maximum")
            self.assertEqual(pwp.units, "s")
            self.assertEqual(pwp.canonical_identifier, "perpw")

            mwd = ds.variables["MWD"]
            self.assertEqual(mwd.standard_name, "sea_surface_wave_mean_from_direction")
            self.assertEqual(mwd.units, "degree")

            pwd = ds.variables["PWD"]
            self.assertEqual(pwd.standard_name, "sea_surface_wave_from_direction_at_variance_spectral_density_maximum")
            self.assertEqual(pwd.units, "degree")
        finally:
            ds.close()

    def test_wave_variables_physical_validity(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            hs = ds.variables["HS"][:]
            pwp = ds.variables["PWP"][:]
            mwd = ds.variables["MWD"][:]
            pwd = ds.variables["PWD"][:]
            t02 = ds.variables["T02"][:]
            uwnd = ds.variables["UWND"][:]
            vwnd = ds.variables["VWND"][:]

            # Land masking check
            self.assertTrue(np.ma.is_masked(hs), "HS array should contain masked land cells")
            self.assertTrue(np.ma.is_masked(mwd), "MWD array should contain masked land cells")

            valid_hs = hs.compressed()
            valid_pwp = pwp.compressed()
            valid_mwd = mwd.compressed()
            valid_pwd = pwd.compressed()
            valid_t02 = t02.compressed()
            valid_uwnd = uwnd.compressed()
            valid_vwnd = vwnd.compressed()

            self.assertGreater(len(valid_hs), 5_000_000, "Too few valid ocean cells")

            # No NaNs or Infs in valid ocean cells
            for name, arr in [("HS", valid_hs), ("PWP", valid_pwp), ("MWD", valid_mwd),
                              ("PWD", valid_pwd), ("T02", valid_t02), ("UWND", valid_uwnd), ("VWND", valid_vwnd)]:
                self.assertFalse(np.isnan(arr).any(), f"Found NaNs in valid {name}")
                self.assertFalse(np.isinf(arr).any(), f"Found Infs in valid {name}")

            # Physical ranges:
            # Significant wave height (HS): 0.0m to 15.0m
            self.assertGreaterEqual(float(valid_hs.min()), 0.0)
            self.assertLessEqual(float(valid_hs.max()), 15.0)
            self.assertGreater(float(valid_hs.mean()), 0.5)
            self.assertLess(float(valid_hs.mean()), 4.0)

            # Peak wave period (PWP): 1.0s to 35.0s
            self.assertGreaterEqual(float(valid_pwp.min()), 1.0)
            self.assertLessEqual(float(valid_pwp.max()), 35.0)
            self.assertGreater(float(valid_pwp.mean()), 5.0)
            self.assertLess(float(valid_pwp.mean()), 20.0)

            # Wave directions (MWD, PWD): 0 to 360 degrees
            self.assertGreaterEqual(float(valid_mwd.min()), 0.0)
            self.assertLessEqual(float(valid_mwd.max()), 360.0)
            self.assertGreaterEqual(float(valid_pwd.min()), 0.0)
            self.assertLessEqual(float(valid_pwd.max()), 360.0)

            # Mean zero-crossing period (T02): 1.0s to 25.0s
            self.assertGreaterEqual(float(valid_t02.min()), 1.0)
            self.assertLessEqual(float(valid_t02.max()), 25.0)

            # 10m Wind speeds (UWND, VWND): -50 to 50 m/s
            self.assertGreaterEqual(float(valid_uwnd.min()), -50.0)
            self.assertLessEqual(float(valid_uwnd.max()), 50.0)
            self.assertGreaterEqual(float(valid_vwnd.min()), -50.0)
            self.assertLessEqual(float(valid_vwnd.max()), 50.0)
        finally:
            ds.close()

    def test_access_audit_and_service_documentation(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        audit = manifest.get("access_audit", {})
        self.assertIn("incois_erddap_status", audit)
        self.assertIn("incois_las_status", audit)
        self.assertIn("incois_thredds_status", audit)
        self.assertIn("download_method", audit)


if __name__ == "__main__":
    unittest.main()
