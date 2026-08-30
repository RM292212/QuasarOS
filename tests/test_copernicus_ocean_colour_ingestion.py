"""
Test suite for Copernicus Ocean Colour L4 Chlorophyll-a Data Ingestion (TASK-01D).
Validates raw NetCDF-4 dataset, coordinates, chlorophyll-a variable, physical bounds,
checksums, and manifest metadata for the North Indian Ocean / Arabian Sea.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestCopernicusOceanColourIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_nc_path = os.path.join(
            cls.repo_root, "data", "raw", "copernicus", "ocean-colour", "copernicus_ocean_colour_chl_l4_7day.nc"
        )
        cls.manifest_path = os.path.join(
            cls.repo_root, "data", "manifests", "copernicus-ocean-colour", "copernicus_ocean_colour_manifest.json"
        )

    def test_raw_file_exists(self):
        self.assertTrue(os.path.exists(self.raw_nc_path), f"NetCDF file missing: {self.raw_nc_path}")
        file_size = os.path.getsize(self.raw_nc_path)
        self.assertGreater(file_size, 10_000_000, f"NetCDF file unexpectedly small: {file_size} bytes")

    def test_manifest_file_exists(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest file missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest.get("task_id"), "TASK-01D")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertEqual(manifest.get("product_id"), "OCEANCOLOUR_GLO_BGC_L4_NRT_009_102")
        self.assertEqual(manifest.get("dataset_id"), "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D")
        self.assertIn("licence", manifest)
        self.assertIn("attribution", manifest)
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
            self.assertIn("latitude", ds.dimensions)
            self.assertIn("longitude", ds.dimensions)

            self.assertEqual(len(ds.dimensions["time"]), 7)
            self.assertEqual(len(ds.dimensions["latitude"]), 720)
            self.assertEqual(len(ds.dimensions["longitude"]), 1440)
        finally:
            ds.close()

    def test_coordinate_values_and_ranges(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            lats = ds.variables["latitude"][:]
            lons = ds.variables["longitude"][:]
            times = ds.variables["time"][:]

            # Lat range check: 0.0 to 30.0 deg N
            self.assertGreaterEqual(float(lats.min()), 0.0)
            self.assertLessEqual(float(lats.max()), 30.0)
            self.assertTrue(np.all(np.diff(lats) > 0), "Latitudes must be strictly monotonically increasing")

            # Lon range check: 40.0 to 100.0 deg E
            self.assertGreaterEqual(float(lons.min()), 40.0)
            self.assertLessEqual(float(lons.max()), 100.0)
            self.assertTrue(np.all(np.diff(lons) > 0), "Longitudes must be strictly monotonically increasing")

            # Time range check: 7 daily steps
            self.assertEqual(len(times), 7)
            self.assertTrue(np.all(np.diff(times) == 1.0), "Time steps must have a daily step interval (1 day)")
        finally:
            ds.close()

    def test_chlorophyll_variable_and_attributes(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            chl_key = "CHL" if "CHL" in ds.variables else "CHLA"
            self.assertIn(chl_key, ds.variables)
            v = ds.variables[chl_key]
            self.assertEqual(v.dimensions, ("time", "latitude", "longitude"))
            self.assertEqual(v.shape, (7, 720, 1440))
            self.assertEqual(v.units, "milligram m-3")
            self.assertEqual(v.standard_name, "mass_concentration_of_chlorophyll_a_in_sea_water")
            self.assertEqual(float(v._FillValue), -999.0)
        finally:
            ds.close()

    def test_chlorophyll_physical_validity(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            chl_key = "CHL" if "CHL" in ds.variables else "CHLA"
            v = ds.variables[chl_key]
            chl_data = v[:]

            if isinstance(chl_data, np.ma.MaskedArray):
                valid_chl = chl_data.compressed()
            else:
                valid_chl = chl_data[~np.isnan(chl_data)]

            # Check presence of valid points
            self.assertGreater(len(valid_chl), 1_000_000, "Too few valid chlorophyll observations")

            min_chl = float(valid_chl.min())
            max_chl = float(valid_chl.max())
            mean_chl = float(valid_chl.mean())

            # Non-negativity check
            self.assertGreaterEqual(min_chl, 0.0, f"Found negative chlorophyll-a concentration: {min_chl}")
            self.assertTrue(bool((valid_chl >= 0.0).all()), "All chlorophyll values must be non-negative")

            # Physical range checks for surface ocean chlorophyll-a
            self.assertLess(max_chl, 100.0, f"Chlorophyll-a maximum {max_chl} mg/m3 exceeds plausible ocean upper bound")
            self.assertGreater(mean_chl, 0.1, f"Mean chlorophyll-a {mean_chl} mg/m3 is suspiciously low")
            self.assertLess(mean_chl, 5.0, f"Mean chlorophyll-a {mean_chl} mg/m3 is suspiciously high for basin-scale mean")
        finally:
            ds.close()


if __name__ == "__main__":
    unittest.main()
