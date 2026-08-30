"""
Test suite for HYCOM ESPC-D-V02 3D Model data ingestion (TASK-01H).
Validates raw NetCDF-4 dataset, coordinates, packing parameters, checksums, and manifest metadata.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestHYCOMIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_nc_path = os.path.join(cls.repo_root, "data", "raw", "hycom", "hycom_espc_d_v02_temp3d_7day.nc")
        cls.manifest_path = os.path.join(cls.repo_root, "data", "manifests", "hycom", "hycom_manifest.json")

    def test_raw_file_exists(self):
        self.assertTrue(os.path.exists(self.raw_nc_path), f"NetCDF file missing: {self.raw_nc_path}")
        file_size = os.path.getsize(self.raw_nc_path)
        self.assertGreater(file_size, 1_000_000, f"NetCDF file unexpectedly small: {file_size} bytes")

    def test_manifest_file_exists(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest file missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest.get("task_id"), "TASK-01H")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertIn("licence", manifest)
        self.assertIn("provider", manifest)
        self.assertIn("files", manifest)
        self.assertEqual(len(manifest["files"]), 1)

    def test_sha256_checksum(self):
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

    def test_netcdf_dimensions(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            self.assertIn("time", ds.dimensions)
            self.assertIn("depth", ds.dimensions)
            self.assertIn("lat", ds.dimensions)
            self.assertIn("lon", ds.dimensions)

            self.assertEqual(len(ds.dimensions["time"]), 7)
            self.assertEqual(len(ds.dimensions["depth"]), 32)
            self.assertEqual(len(ds.dimensions["lat"]), 63)
            self.assertEqual(len(ds.dimensions["lon"]), 63)
        finally:
            ds.close()

    def test_coordinate_values_and_ranges(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            lats = ds.variables["lat"][:]
            lons = ds.variables["lon"][:]
            depths = ds.variables["depth"][:]
            times = ds.variables["time"][:]

            # Lat range check: 5.0 to 7.5 deg N
            self.assertGreaterEqual(float(lats.min()), 5.0)
            self.assertLessEqual(float(lats.max()), 7.5)
            self.assertTrue(np.all(np.diff(lats) > 0), "Latitudes must be strictly monotonically increasing")

            # Lon range check: 65.0 to 70.0 deg E
            self.assertGreaterEqual(float(lons.min()), 65.0)
            self.assertLessEqual(float(lons.max()), 70.0)
            self.assertTrue(np.all(np.diff(lons) > 0), "Longitudes must be strictly monotonically increasing")

            # Depth range check: 0.0 to 900.0 m, 32 levels
            self.assertEqual(float(depths[0]), 0.0)
            self.assertEqual(float(depths[-1]), 900.0)
            self.assertEqual(len(depths), 32)
            self.assertTrue(np.all(np.diff(depths) > 0), "Depths must be strictly monotonically increasing")

            # Time range check: 7 daily steps
            self.assertEqual(len(times), 7)
            self.assertTrue(np.all(np.diff(times) == 24.0), "Time steps must have a daily step interval (24 hours)")
        finally:
            ds.close()

    def test_water_temp_variable_and_packing_attributes(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            self.assertIn("water_temp", ds.variables)
            v = ds.variables["water_temp"]
            self.assertEqual(v.dimensions, ("time", "depth", "lat", "lon"))
            self.assertEqual(v.shape, (7, 32, 63, 63))
            self.assertEqual(v.units, "degC")
            self.assertEqual(v.standard_name, "sea_water_temperature")

            # Verify packing attributes
            self.assertAlmostEqual(float(v.scale_factor), 0.001, places=5)
            self.assertAlmostEqual(float(v.add_offset), 20.0, places=5)
            self.assertEqual(int(v.missing_value), -30000)
            self.assertEqual(int(v._FillValue), -30000)
        finally:
            ds.close()

    def test_temperature_physical_validity(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            ds.set_auto_maskandscale(True)
            wt = ds.variables["water_temp"][:]

            # Check for no invalid NaN / Inf
            self.assertFalse(np.isnan(wt).any(), "Found unexpected NaNs in water temperature data")
            self.assertFalse(np.isinf(wt).any(), "Found unexpected Infs in water temperature data")

            # Physical temperature bounds in Arabian Sea upper 900m
            min_temp = float(wt.min())
            max_temp = float(wt.max())
            mean_temp = float(wt.mean())

            self.assertGreater(min_temp, 5.0, f"Minimum temperature {min_temp} C is unrealistically low for upper 900m")
            self.assertLess(max_temp, 35.0, f"Maximum temperature {max_temp} C is unrealistically high for Arabian Sea")
            self.assertGreater(mean_temp, 15.0, f"Mean temperature {mean_temp} C is outside expected range")
            self.assertLess(mean_temp, 28.0, f"Mean temperature {mean_temp} C is outside expected range")

            # Vertical stratification sanity check: Surface layer (depth=0) must be warmer than deep layer (depth=900m)
            surface_mean = float(wt[:, 0, :, :].mean())
            deep_mean = float(wt[:, -1, :, :].mean())
            self.assertGreater(surface_mean, deep_mean + 10.0,
                               f"Physical ocean thermocline violated: surface ({surface_mean:.2f} C) should be significantly warmer than 900m ({deep_mean:.2f} C)")
        finally:
            ds.close()


if __name__ == "__main__":
    unittest.main()
