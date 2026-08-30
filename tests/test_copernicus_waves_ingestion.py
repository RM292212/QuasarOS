"""
Test suite for Copernicus Marine Global Wave Analysis and Forecast data ingestion (TASK-01X-B).
Validates raw NetCDF-4 dataset, coordinate grids, wave variables (VHM0, VTM02, VTPK, VMDR, VPED, VHM0_WW, VHM0_SW1, VSDX, VSDY),
directional conventions, checksums, physical wave bounds, and manifest metadata for the North Indian Ocean / Arabian Sea.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestCopernicusWavesIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_nc_path = os.path.join(
            cls.repo_root, "data", "raw", "copernicus", "waves", "copernicus_waves_20250420_20250426.nc"
        )
        cls.manifest_path = os.path.join(
            cls.repo_root, "data", "manifests", "copernicus-waves", "copernicus_waves_manifest.json"
        )

    def test_raw_file_exists(self):
        self.assertTrue(os.path.exists(self.raw_nc_path), f"NetCDF file missing: {self.raw_nc_path}")
        file_size = os.path.getsize(self.raw_nc_path)
        self.assertGreater(file_size, 50_000_000, f"NetCDF file unexpectedly small: {file_size} bytes")

    def test_manifest_file_exists_and_metadata(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest file missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest.get("manifest_schema_version"), "1.0.0")
        self.assertEqual(manifest.get("task_id"), "TASK-01X-B")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertEqual(manifest.get("product_id"), "GLOBAL_ANALYSISFORECAST_WAV_001_027")
        self.assertEqual(manifest.get("dataset_id"), "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i")
        self.assertIn("provider", manifest)
        self.assertIn("licence", manifest)
        self.assertIn("attribution", manifest)
        self.assertIn("directional_conventions", manifest)
        self.assertIn("geographic_bounds", manifest)
        self.assertIn("temporal_bounds", manifest)
        self.assertIn("variables", manifest)
        self.assertEqual(len(manifest["variables"]), 9)
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
            self.assertEqual(len(ds.dimensions["latitude"]), 361)
            self.assertEqual(len(ds.dimensions["longitude"]), 721)

            lats = ds.variables["latitude"][:]
            lons = ds.variables["longitude"][:]
            times = ds.variables["time"][:]

            self.assertAlmostEqual(float(lats.min()), 0.0, places=4)
            self.assertAlmostEqual(float(lats.max()), 30.0, places=4)
            self.assertTrue(np.all(np.diff(lats) > 0), "Latitudes must be strictly monotonically increasing")

            self.assertAlmostEqual(float(lons.min()), 40.0, places=4)
            self.assertAlmostEqual(float(lons.max()), 100.0, places=4)
            self.assertTrue(np.all(np.diff(lons) > 0), "Longitudes must be strictly monotonically increasing")

            self.assertEqual(len(times), 56)
            time_diffs = np.diff(times)
            self.assertTrue(np.all(time_diffs == 3.0), f"Expected 3-hourly time steps (3.0 hours), got {time_diffs[:5]}")
        finally:
            ds.close()

    def test_wave_variables_presence_and_attributes(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            required_vars = [
                ("VHM0", "sea_surface_wave_significant_height", "m"),
                ("VTM02", "sea_surface_wave_mean_period_from_variance_spectral_density_second_frequency_moment", "s"),
                ("VTPK", "sea_surface_wave_period_at_variance_spectral_density_maximum", "s"),
                ("VMDR", "sea_surface_wave_from_direction", "degree"),
                ("VPED", "sea_surface_wave_from_direction_at_variance_spectral_density_maximum", "degree"),
                ("VHM0_WW", "sea_surface_wind_wave_significant_height", "m"),
                ("VHM0_SW1", "sea_surface_primary_swell_wave_significant_height", "m"),
                ("VSDX", "sea_surface_wave_stokes_drift_x_velocity", "m s-1"),
                ("VSDY", "sea_surface_wave_stokes_drift_y_velocity", "m s-1")
            ]

            for var_name, std_name, unit in required_vars:
                self.assertIn(var_name, ds.variables, f"Wave variable '{var_name}' missing from NetCDF")
                v = ds.variables[var_name]
                self.assertEqual(v.dimensions, ("time", "latitude", "longitude"))
                self.assertEqual(v.shape, (56, 361, 721))
                self.assertEqual(v.standard_name, std_name)
                self.assertEqual(v.units, unit)
        finally:
            ds.close()

    def test_wave_variables_physical_validity(self):
        ds = netCDF4.Dataset(self.raw_nc_path, "r")
        try:
            vhm0 = ds.variables["VHM0"][:]
            vtm02 = ds.variables["VTM02"][:]
            vtpk = ds.variables["VTPK"][:]
            vmdr = ds.variables["VMDR"][:]
            vped = ds.variables["VPED"][:]
            vhm0_ww = ds.variables["VHM0_WW"][:]
            vhm0_sw1 = ds.variables["VHM0_SW1"][:]
            vsdx = ds.variables["VSDX"][:]
            vsdy = ds.variables["VSDY"][:]

            # Ensure all variables have valid ocean masks
            self.assertTrue(np.ma.is_masked(vhm0), "VHM0 array should have masked land cells")
            self.assertTrue(np.ma.is_masked(vmdr), "VMDR array should have masked land cells")

            valid_vhm0 = vhm0.compressed()
            valid_vtm02 = vtm02.compressed()
            valid_vtpk = vtpk.compressed()
            valid_vmdr = vmdr.compressed()
            valid_vped = vped.compressed()
            valid_vhm0_ww = vhm0_ww.compressed()
            valid_vhm0_sw1 = vhm0_sw1.compressed()
            valid_vsdx = vsdx.compressed()
            valid_vsdy = vsdy.compressed()

            self.assertGreater(len(valid_vhm0), 5_000_000, "Too few unmasked ocean cells in VHM0")

            # No NaNs or Infs in valid ocean data
            for arr_valid, name in [
                (valid_vhm0, "VHM0"), (valid_vtm02, "VTM02"), (valid_vtpk, "VTPK"),
                (valid_vmdr, "VMDR"), (valid_vped, "VPED"), (valid_vhm0_ww, "VHM0_WW"),
                (valid_vhm0_sw1, "VHM0_SW1"), (valid_vsdx, "VSDX"), (valid_vsdy, "VSDY")
            ]:
                self.assertFalse(np.isnan(arr_valid).any(), f"Found NaNs in unmasked {name}")
                self.assertFalse(np.isinf(arr_valid).any(), f"Found Infs in unmasked {name}")

            # Significant wave height (VHM0): 0.0m to 15.0m
            self.assertGreaterEqual(float(valid_vhm0.min()), 0.0)
            self.assertLessEqual(float(valid_vhm0.max()), 15.0)
            self.assertGreater(float(valid_vhm0.mean()), 0.3)
            self.assertLess(float(valid_vhm0.mean()), 3.0)

            # Wave periods (VTM02, VTPK): 0.5s to 30.0s
            self.assertGreaterEqual(float(valid_vtm02.min()), 0.5)
            self.assertLessEqual(float(valid_vtm02.max()), 25.0)
            self.assertGreaterEqual(float(valid_vtpk.min()), 0.5)
            self.assertLessEqual(float(valid_vtpk.max()), 30.0)

            # Wave directions (VMDR, VPED): 0.0 to 360.0 degrees
            self.assertGreaterEqual(float(valid_vmdr.min()), 0.0)
            self.assertLessEqual(float(valid_vmdr.max()), 360.0)
            self.assertGreaterEqual(float(valid_vped.min()), 0.0)
            self.assertLessEqual(float(valid_vped.max()), 360.0)

            # Partition wave heights: 0.0m to 15.0m
            self.assertGreaterEqual(float(valid_vhm0_ww.min()), 0.0)
            self.assertLessEqual(float(valid_vhm0_ww.max()), 15.0)
            self.assertGreaterEqual(float(valid_vhm0_sw1.min()), 0.0)
            self.assertLessEqual(float(valid_vhm0_sw1.max()), 15.0)

            # Stokes drift velocities: -1.0 m/s to 1.0 m/s
            self.assertGreaterEqual(float(valid_vsdx.min()), -1.0)
            self.assertLessEqual(float(valid_vsdx.max()), 1.0)
            self.assertGreaterEqual(float(valid_vsdy.min()), -1.0)
            self.assertLessEqual(float(valid_vsdy.max()), 1.0)
        finally:
            ds.close()


if __name__ == "__main__":
    unittest.main()
