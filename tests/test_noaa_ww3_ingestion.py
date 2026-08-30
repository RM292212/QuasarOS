"""
Test suite for NOAA WAVEWATCH III (WW3) Global Wave Model data ingestion (TASK-01X-C).
Validates raw NetCDF-4 dataset, coordinate grids, variable standards, checksums, physical wave bounds, and manifest metadata.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestNOAAWW3Ingestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_nc_path = os.path.join(
            cls.repo_root, "data", "raw", "noaa", "ww3", "noaa_ww3_regional_20250420_20250426.nc"
        )
        cls.manifest_path = os.path.join(
            cls.repo_root, "data", "manifests", "noaa-ww3", "noaa_ww3_manifest.json"
        )

    def test_raw_file_exists(self):
        self.assertTrue(os.path.exists(self.raw_nc_path), f"NetCDF file missing: {self.raw_nc_path}")
        file_size = os.path.getsize(self.raw_nc_path)
        self.assertGreater(file_size, 1_000_000, f"NetCDF file unexpectedly small: {file_size} bytes")

    def test_manifest_file_exists_and_metadata(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest file missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest.get("manifest_schema_version"), "1.0.0")
        self.assertEqual(manifest.get("task_id"), "TASK-01X-C")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertIn("provider", manifest)
        self.assertIn("dataset_id", manifest)
        self.assertIn("product_title", manifest)
        self.assertIn("source_url", manifest)
        self.assertIn("spatial_coverage", manifest)
        self.assertIn("temporal_coverage", manifest)
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
            self.assertIn("depth", ds.dimensions)
            self.assertIn("latitude", ds.dimensions)
            self.assertIn("longitude", ds.dimensions)

            self.assertEqual(len(ds.dimensions["time"]), 28)
            self.assertEqual(len(ds.dimensions["depth"]), 1)
            self.assertEqual(len(ds.dimensions["latitude"]), 61)
            self.assertEqual(len(ds.dimensions["longitude"]), 121)

            lats = ds.variables["latitude"][:]
            lons = ds.variables["longitude"][:]
            depths = ds.variables["depth"][:]

            self.assertAlmostEqual(float(lats.min()), 0.0, places=4)
            self.assertAlmostEqual(float(lats.max()), 30.0, places=4)
            self.assertTrue(np.all(np.diff(lats) > 0), "Latitudes must be strictly monotonically increasing")

            self.assertAlmostEqual(float(lons.min()), 40.0, places=4)
            self.assertAlmostEqual(float(lons.max()), 100.0, places=4)
            self.assertTrue(np.all(np.diff(lons) > 0), "Longitudes must be strictly monotonically increasing")

            self.assertAlmostEqual(float(depths[0]), 0.0, places=4)
        finally:
            ds.close()

    def test_temporal_coverage(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            times = ds.variables["time"][:]
            self.assertEqual(len(times), 28)
            time_diffs = np.diff(times)
            # 6-hourly interval = 21600 seconds
            self.assertTrue(
                np.all(time_diffs == 21600.0),
                f"Expected 6-hourly time intervals (21600s), got {time_diffs[:5]}"
            )
        finally:
            ds.close()

    def test_wave_variables_presence_and_attributes(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            # Check variable presence
            self.assertIn("Thgt", ds.variables, "Significant wave height variable (Thgt) missing")
            self.assertIn("Tdir", ds.variables, "Peak wave direction variable (Tdir) missing")
            self.assertIn("Tper", ds.variables, "Peak wave period variable (Tper) missing")

            # Check significant wave height (swh / Thgt) attributes
            thgt = ds.variables["Thgt"]
            self.assertEqual(thgt.dimensions, ("time", "depth", "latitude", "longitude"))
            self.assertEqual(thgt.shape, (28, 1, 61, 121))
            self.assertEqual(thgt.standard_name, "sea_surface_wave_significant_height")
            self.assertEqual(thgt.units, "meters")

            # Check peak wave direction (dirpw / Tdir) attributes
            tdir = ds.variables["Tdir"]
            self.assertEqual(tdir.dimensions, ("time", "depth", "latitude", "longitude"))
            self.assertEqual(tdir.shape, (28, 1, 61, 121))
            self.assertIn("direction", tdir.standard_name)
            self.assertEqual(tdir.units, "degrees")

            # Check peak wave period (perpw / Tper) attributes
            tper = ds.variables["Tper"]
            self.assertEqual(tper.dimensions, ("time", "depth", "latitude", "longitude"))
            self.assertEqual(tper.shape, (28, 1, 61, 121))
            self.assertEqual(tper.standard_name, "sea_surface_wave_period_at_variance_spectral_density_maximum")
            self.assertIn(tper.units, ["second", "seconds", "s"])
        finally:
            ds.close()

    def test_wave_variables_physical_validity(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            thgt = ds.variables["Thgt"][:]
            tdir = ds.variables["Tdir"][:]
            tper = ds.variables["Tper"][:]

            # Ensure all variables have valid ocean masks
            self.assertTrue(np.ma.is_masked(thgt), "Thgt array should have masked land cells")
            self.assertTrue(np.ma.is_masked(tdir), "Tdir array should have masked land cells")
            self.assertTrue(np.ma.is_masked(tper), "Tper array should have masked land cells")

            # Mask alignment: ocean mask must be identical across wave parameters
            np.testing.assert_array_equal(thgt.mask, tdir.mask, "Land mask mismatch between Thgt and Tdir")
            np.testing.assert_array_equal(thgt.mask, tper.mask, "Land mask mismatch between Thgt and Tper")

            valid_thgt = thgt.compressed()
            valid_tdir = tdir.compressed()
            valid_tper = tper.compressed()

            self.assertGreater(len(valid_thgt), 50_000, "Too few unmasked ocean cells")

            # No NaNs or Infs in valid ocean data
            self.assertFalse(np.isnan(valid_thgt).any(), "Found NaNs in unmasked significant wave height")
            self.assertFalse(np.isinf(valid_thgt).any(), "Found Infs in unmasked significant wave height")
            self.assertFalse(np.isnan(valid_tdir).any(), "Found NaNs in unmasked peak wave direction")
            self.assertFalse(np.isinf(valid_tdir).any(), "Found Infs in unmasked peak wave direction")
            self.assertFalse(np.isnan(valid_tper).any(), "Found NaNs in unmasked peak wave period")
            self.assertFalse(np.isinf(valid_tper).any(), "Found Infs in unmasked peak wave period")

            # Physical ranges:
            # Significant wave height (swh): 0.0m to 15.0m in North Indian Ocean (April non-cyclonic conditions)
            self.assertGreaterEqual(float(valid_thgt.min()), 0.0)
            self.assertLessEqual(float(valid_thgt.max()), 15.0)
            self.assertGreater(float(valid_thgt.mean()), 0.5)
            self.assertLess(float(valid_thgt.mean()), 3.0)

            # Peak wave direction (dirpw): 0 to 360 degrees
            self.assertGreaterEqual(float(valid_tdir.min()), 0.0)
            self.assertLessEqual(float(valid_tdir.max()), 360.0)

            # Peak wave period (perpw): 0.5s to 30.0s
            self.assertGreaterEqual(float(valid_tper.min()), 0.5)
            self.assertLessEqual(float(valid_tper.max()), 30.0)
            self.assertGreater(float(valid_tper.mean()), 5.0)
            self.assertLess(float(valid_tper.mean()), 20.0)
        finally:
            ds.close()


if __name__ == "__main__":
    unittest.main()
