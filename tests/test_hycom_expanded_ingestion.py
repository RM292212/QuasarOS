"""
Test suite for HYCOM ESPC-D-V02 Expanded Physical Fields ingestion (TASK-01X-F).
Validates raw NetCDF-4 datasets, coordinates, packing parameters, checksums, physical ranges,
and historical baseline preservation in the manifest.
"""

import os
import json
import hashlib
import unittest
from pathlib import Path
import numpy as np
import netCDF4


class TestHYCOMExpandedIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = Path(__file__).resolve().parent.parent
        cls.raw_dir = cls.repo_root / "data" / "raw" / "hycom" / "expanded-physical"
        cls.manifest_path = cls.repo_root / "data" / "manifests" / "hycom-expanded" / "hycom_expanded_manifest.json"
        cls.baseline_nc_path = cls.repo_root / "data" / "raw" / "hycom" / "hycom_espc_d_v02_temp3d_7day.nc"

        cls.expected_files = {
            "salinity": "hycom_espc_d_v02_salinity3d_7day.nc",
            "water_u": "hycom_espc_d_v02_water_u3d_7day.nc",
            "water_v": "hycom_espc_d_v02_water_v3d_7day.nc",
            "surf_el": "hycom_espc_d_v02_ssh_7day.nc"
        }

    def test_manifest_structure_and_metadata(self):
        """Validates manifest existence and mandatory metadata fields."""
        self.assertTrue(self.manifest_path.exists(), f"Manifest file missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01X-F")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertEqual(manifest.get("manifest_schema_version"), "1.0.0")
        self.assertIn("provider", manifest)
        self.assertIn("licence", manifest)
        self.assertIn("attribution", manifest)
        self.assertIn("files", manifest)
        self.assertEqual(len(manifest["files"]), 4)
        self.assertIn("variables", manifest)
        self.assertEqual(len(manifest["variables"]), 4)

    def test_raw_files_exist_and_non_empty(self):
        """Verifies that all 4 raw NetCDF files exist and have reasonable sizes."""
        for var_name, filename in self.expected_files.items():
            filepath = self.raw_dir / filename
            self.assertTrue(filepath.exists(), f"Raw NetCDF file missing: {filepath}")
            file_size = filepath.stat().st_size
            if var_name == "surf_el":
                self.assertGreater(file_size, 50_000, f"SSH NetCDF file unexpectedly small: {file_size} bytes")
            else:
                self.assertGreater(file_size, 1_000_000, f"3D NetCDF file {filename} unexpectedly small: {file_size} bytes")

    def test_sha256_checksums_and_bytes_match_manifest(self):
        """Verifies that computed SHA-256 and byte sizes strictly match manifest entries."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        manifest_file_map = {f["filename"]: f for f in manifest["files"]}

        for var_name, filename in self.expected_files.items():
            self.assertIn(filename, manifest_file_map, f"Filename {filename} not listed in manifest")
            entry = manifest_file_map[filename]

            filepath = self.raw_dir / filename
            actual_size = filepath.stat().st_size
            self.assertEqual(actual_size, entry["byte_size"], f"Byte size mismatch for {filename}")

            hasher = hashlib.sha256()
            with open(filepath, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            actual_sha256 = hasher.hexdigest()
            self.assertEqual(actual_sha256, entry["sha256"], f"SHA256 mismatch for {filename}")

    def test_coordinate_dimensions_and_alignment(self):
        """Verifies dimensions and coordinates match baseline across all 4 files."""
        # Load baseline coordinates
        self.assertTrue(self.baseline_nc_path.exists(), f"Baseline temperature file missing: {self.baseline_nc_path}")
        base_ds = netCDF4.Dataset(self.baseline_nc_path, "r")
        try:
            base_lats = base_ds.variables["lat"][:]
            base_lons = base_ds.variables["lon"][:]
            base_depths = base_ds.variables["depth"][:]
            base_times = base_ds.variables["time"][:]
            base_taus = base_ds.variables["tau"][:]
        finally:
            base_ds.close()

        for var_name, filename in self.expected_files.items():
            filepath = self.raw_dir / filename
            ds = netCDF4.Dataset(filepath, "r")
            try:
                self.assertIn("time", ds.dimensions)
                self.assertIn("lat", ds.dimensions)
                self.assertIn("lon", ds.dimensions)
                self.assertEqual(len(ds.dimensions["time"]), 7)
                self.assertEqual(len(ds.dimensions["lat"]), 63)
                self.assertEqual(len(ds.dimensions["lon"]), 63)

                lats = ds.variables["lat"][:]
                lons = ds.variables["lon"][:]
                times = ds.variables["time"][:]
                taus = ds.variables["tau"][:]

                # Exact coordinate match with baseline
                np.testing.assert_allclose(lats, base_lats, err_msg=f"Lats mismatch in {filename}")
                np.testing.assert_allclose(lons, base_lons, err_msg=f"Lons mismatch in {filename}")
                np.testing.assert_allclose(times, base_times, err_msg=f"Times mismatch in {filename}")
                np.testing.assert_allclose(taus, base_taus, err_msg=f"Taus mismatch in {filename}")

                # Monotonicity
                self.assertTrue(np.all(np.diff(lats) > 0), f"Lats not monotonic in {filename}")
                self.assertTrue(np.all(np.diff(lons) > 0), f"Lons not monotonic in {filename}")
                self.assertTrue(np.all(np.diff(times) == 24.0), f"Times not daily in {filename}")

                if var_name in ["salinity", "water_u", "water_v"]:
                    self.assertIn("depth", ds.dimensions)
                    self.assertEqual(len(ds.dimensions["depth"]), 32)
                    depths = ds.variables["depth"][:]
                    np.testing.assert_allclose(depths, base_depths, err_msg=f"Depths mismatch in {filename}")
                    self.assertTrue(np.all(np.diff(depths) > 0), f"Depths not monotonic in {filename}")
                    self.assertEqual(float(depths[0]), 0.0)
                    self.assertEqual(float(depths[-1]), 900.0)
                else:
                    self.assertNotIn("depth", ds.dimensions, f"2D surface elevation {filename} should not have depth dimension")
            finally:
                ds.close()

    def test_variable_packing_and_cf_attributes(self):
        """Verifies CF attributes and scale_factor/add_offset packings for all variables."""
        specs = {
            "salinity": {
                "file": "hycom_espc_d_v02_salinity3d_7day.nc",
                "units": "psu",
                "standard_name": "sea_water_salinity",
                "long_name": "Salinity",
                "scale_factor": 0.001,
                "add_offset": 20.0,
                "navo_code": 16,
                "shape": (7, 32, 63, 63)
            },
            "water_u": {
                "file": "hycom_espc_d_v02_water_u3d_7day.nc",
                "units": "m/s",
                "standard_name": "eastward_sea_water_velocity",
                "long_name": "Eastward Water Velocity",
                "scale_factor": 0.001,
                "add_offset": 0.0,
                "navo_code": 17,
                "shape": (7, 32, 63, 63)
            },
            "water_v": {
                "file": "hycom_espc_d_v02_water_v3d_7day.nc",
                "units": "m/s",
                "standard_name": "northward_sea_water_velocity",
                "long_name": "Northward Water Velocity",
                "scale_factor": 0.001,
                "add_offset": 0.0,
                "navo_code": 18,
                "shape": (7, 32, 63, 63)
            },
            "surf_el": {
                "file": "hycom_espc_d_v02_ssh_7day.nc",
                "units": "m",
                "standard_name": "sea_surface_elevation",
                "long_name": "Water Surface Elevation",
                "scale_factor": 0.001,
                "add_offset": 0.0,
                "navo_code": 32,
                "shape": (7, 63, 63)
            }
        }

        for var_name, spec in specs.items():
            filepath = self.raw_dir / spec["file"]
            ds = netCDF4.Dataset(filepath, "r")
            try:
                self.assertIn(var_name, ds.variables, f"Variable {var_name} missing in {spec['file']}")
                v = ds.variables[var_name]
                self.assertEqual(v.shape, spec["shape"])
                self.assertEqual(v.units, spec["units"])
                self.assertEqual(v.standard_name, spec["standard_name"])
                self.assertEqual(v.long_name, spec["long_name"])
                self.assertAlmostEqual(float(v.scale_factor), spec["scale_factor"], places=5)
                self.assertAlmostEqual(float(v.add_offset), spec["add_offset"], places=5)
                self.assertEqual(int(v.missing_value), -30000)
                self.assertEqual(int(v._FillValue), -30000)
                self.assertEqual(int(v.NAVO_code), spec["navo_code"])
            finally:
                ds.close()

    def test_salinity_physical_validity(self):
        """Validates that salinity values are oceanographically sound in Arabian Sea upper 900m."""
        filepath = self.raw_dir / self.expected_files["salinity"]
        ds = netCDF4.Dataset(filepath, "r")
        try:
            ds.set_auto_maskandscale(True)
            sal = ds.variables["salinity"][:]
            self.assertFalse(np.isnan(sal).any(), "Found NaNs in salinity")
            self.assertFalse(np.isinf(sal).any(), "Found Infs in salinity")

            min_sal = float(sal.min())
            max_sal = float(sal.max())
            mean_sal = float(sal.mean())

            # Arabian Sea salinity typical range 34.0 to 37.0 psu
            self.assertGreater(min_sal, 33.0, f"Salinity min {min_sal} psu is unrealistically low")
            self.assertLess(max_sal, 38.0, f"Salinity max {max_sal} psu is unrealistically high")
            self.assertGreater(mean_sal, 35.0, f"Salinity mean {mean_sal} psu outside expected range")
            self.assertLess(mean_sal, 36.5, f"Salinity mean {mean_sal} psu outside expected range")
        finally:
            ds.close()

    def test_current_velocities_physical_validity(self):
        """Validates eastward and northward velocities and current speeds."""
        u_ds = netCDF4.Dataset(self.raw_dir / self.expected_files["water_u"], "r")
        v_ds = netCDF4.Dataset(self.raw_dir / self.expected_files["water_v"], "r")
        try:
            u_ds.set_auto_maskandscale(True)
            v_ds.set_auto_maskandscale(True)

            u = u_ds.variables["water_u"][:]
            v = v_ds.variables["water_v"][:]

            self.assertFalse(np.isnan(u).any(), "Found NaNs in water_u")
            self.assertFalse(np.isinf(u).any(), "Found Infs in water_u")
            self.assertFalse(np.isnan(v).any(), "Found NaNs in water_v")
            self.assertFalse(np.isinf(v).any(), "Found Infs in water_v")

            # Physical velocity range: realistic ocean currents are within [-2.5, 2.5] m/s
            self.assertGreater(float(u.min()), -2.0, "U velocity unrealistically negative")
            self.assertLess(float(u.max()), 2.0, "U velocity unrealistically positive")
            self.assertGreater(float(v.min()), -2.0, "V velocity unrealistically negative")
            self.assertLess(float(v.max()), 2.0, "V velocity unrealistically positive")

            # Current magnitude: sqrt(u^2 + v^2)
            speed = np.sqrt(u**2 + v**2)
            max_speed = float(speed.max())
            mean_speed = float(speed.mean())

            self.assertLess(max_speed, 2.5, f"Maximum ocean current speed {max_speed:.3f} m/s is unphysically high")
            self.assertGreater(mean_speed, 0.01, f"Mean current speed {mean_speed:.3f} m/s is unrealistically stagnant")
        finally:
            u_ds.close()
            v_ds.close()

    def test_sea_surface_height_physical_validity(self):
        """Validates sea surface height (surf_el) physical range."""
        filepath = self.raw_dir / self.expected_files["surf_el"]
        ds = netCDF4.Dataset(filepath, "r")
        try:
            ds.set_auto_maskandscale(True)
            ssh = ds.variables["surf_el"][:]
            self.assertFalse(np.isnan(ssh).any(), "Found NaNs in surf_el")
            self.assertFalse(np.isinf(ssh).any(), "Found Infs in surf_el")

            min_ssh = float(ssh.min())
            max_ssh = float(ssh.max())
            mean_ssh = float(ssh.mean())

            # SSH in Arabian Sea upper bounds typically between -1.5m and 1.5m
            self.assertGreater(min_ssh, -1.5, f"SSH min {min_ssh} m is unrealistically low")
            self.assertLess(max_ssh, 1.5, f"SSH max {max_ssh} m is unrealistically high")
            self.assertGreater(mean_ssh, 0.1, f"SSH mean {mean_ssh} m outside expected range")
            self.assertLess(mean_ssh, 1.0, f"SSH mean {mean_ssh} m outside expected range")
        finally:
            ds.close()

    def test_historical_baseline_preservation(self):
        """Verifies manifest includes historical baseline linking to TASK-01H temperature dataset."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertIn("historical_baseline", manifest, "Manifest missing historical_baseline key")
        baseline = manifest["historical_baseline"]
        self.assertEqual(baseline.get("baseline_task_id"), "TASK-01H")
        self.assertEqual(baseline.get("alignment_status"), "IDENTICAL_TEMPORAL_AND_SPATIAL_COORDINATES_CONFIRMED")
        self.assertIn("baseline_files", baseline)
        self.assertEqual(len(baseline["baseline_files"]), 1)
        self.assertEqual(baseline["baseline_files"][0]["relative_path"], "data/raw/hycom/hycom_espc_d_v02_temp3d_7day.nc")


if __name__ == "__main__":
    unittest.main()
