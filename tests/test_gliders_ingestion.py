"""
Test suite for Glider Observation Ingestion (TASK-01I).
Validates raw NetCDF trajectory files, extracted summaries, variables, QC arrays,
coordinates, SHA-256 checksums, physical bounds, and manifest metadata for the
North Indian Ocean / Bay of Bengal / Sri Lanka Dome glider mission.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestGlidersIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_dir = os.path.join(cls.repo_root, "data", "raw", "gliders")
        cls.manifest_path = os.path.join(cls.repo_root, "data", "manifests", "gliders", "gliders_manifest.json")
        
        cls.nc_file_name = "ru29_20180812T0220_north_indian_ocean.nc"
        cls.summary_file_name = "ru29_20180812T0220_trajectory_summary.json"
        cls.expected_files = [cls.nc_file_name, cls.summary_file_name]

    def test_raw_files_exist(self):
        for fname in self.expected_files:
            fpath = os.path.join(self.raw_dir, fname)
            self.assertTrue(os.path.exists(fpath), f"Raw glider file missing: {fpath}")
            size = os.path.getsize(fpath)
            self.assertGreater(size, 1000, f"Raw glider file unexpectedly small: {size} bytes ({fname})")

    def test_manifest_structure_and_task_id(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01I")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertEqual(manifest.get("dataset_id"), "ru29-20180812T0220")
        self.assertIn("provider", manifest)
        self.assertIn("platform", manifest)
        self.assertIn("spatial_coverage", manifest)
        self.assertIn("vertical_coverage", manifest)
        self.assertIn("temporal_coverage", manifest)
        self.assertIn("variables", manifest)
        self.assertIn("quality_control", manifest)
        self.assertIn("files", manifest)
        self.assertEqual(len(manifest["files"]), 2)

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

    def test_netcdf_opens_and_contains_required_variables(self):
        nc_path = os.path.join(self.raw_dir, self.nc_file_name)
        ds = netCDF4.Dataset(nc_path, "r")
        try:
            required_vars = [
                "time",
                "latitude",
                "longitude",
                "depth",
                "pressure",
                "temperature",
                "salinity",
                "density",
                "conductivity",
                "profile_id",
                "trajectory",
                "wmo_id",
            ]
            for var in required_vars:
                self.assertIn(var, ds.variables, f"Variable {var} missing from glider NetCDF")

            # Check record counts
            time_len = len(ds.variables["time"])
            self.assertGreaterEqual(time_len, 80000, f"Expected >80,000 observations, got {time_len}")
        finally:
            ds.close()

    def test_netcdf_qc_flags_present(self):
        nc_path = os.path.join(self.raw_dir, self.nc_file_name)
        ds = netCDF4.Dataset(nc_path, "r")
        try:
            qc_vars = [
                "temperature_qc",
                "salinity_qc",
                "pressure_qc",
                "depth_qc",
                "qartod_temperature_primary_flag",
                "qartod_salinity_primary_flag",
                "qartod_pressure_primary_flag",
                "qartod_location_test_flag",
            ]
            for var in qc_vars:
                self.assertIn(var, ds.variables, f"QC Variable {var} missing from glider NetCDF")
        finally:
            ds.close()

    def test_spatial_coordinates_in_north_indian_ocean(self):
        nc_path = os.path.join(self.raw_dir, self.nc_file_name)
        ds = netCDF4.Dataset(nc_path, "r")
        try:
            lats = ds.variables["latitude"][:]
            lons = ds.variables["longitude"][:]

            valid_lats = lats.data[~lats.mask] if hasattr(lats, "mask") else lats[~np.isnan(lats)]
            valid_lons = lons.data[~lons.mask] if hasattr(lons, "mask") else lons[~np.isnan(lons)]

            self.assertGreater(len(valid_lats), 0)
            self.assertGreater(len(valid_lons), 0)

            lat_min, lat_max = float(np.min(valid_lats)), float(np.max(valid_lats))
            lon_min, lon_max = float(np.min(valid_lons)), float(np.max(valid_lons))

            # Verify within North Indian Ocean domain (Lat: 0 to 30N, Lon: 40 to 100E)
            self.assertGreaterEqual(lat_min, 0.0, f"Lat min {lat_min} < 0.0N")
            self.assertLessEqual(lat_max, 30.0, f"Lat max {lat_max} > 30.0N")
            self.assertGreaterEqual(lon_min, 40.0, f"Lon min {lon_min} < 40.0E")
            self.assertLessEqual(lon_max, 100.0, f"Lon max {lon_max} > 100.0E")
        finally:
            ds.close()

    def test_physical_value_bounds(self):
        nc_path = os.path.join(self.raw_dir, self.nc_file_name)
        ds = netCDF4.Dataset(nc_path, "r")
        try:
            temps = ds.variables["temperature"][:]
            salts = ds.variables["salinity"][:]
            depths = ds.variables["depth"][:]
            press = ds.variables["pressure"][:]

            valid_temps = temps.data[~temps.mask] if hasattr(temps, "mask") else temps[~np.isnan(temps)]
            valid_salts = salts.data[~salts.mask] if hasattr(salts, "mask") else salts[~np.isnan(salts)]
            valid_depths = depths.data[~depths.mask] if hasattr(depths, "mask") else depths[~np.isnan(depths)]
            valid_press = press.data[~press.mask] if hasattr(press, "mask") else press[~np.isnan(press)]

            # Temperature: 2.0C - 35.0C
            t_min, t_max = float(np.min(valid_temps)), float(np.max(valid_temps))
            self.assertGreaterEqual(t_min, 2.0, f"Temperature min {t_min} < 2.0C")
            self.assertLessEqual(t_max, 35.0, f"Temperature max {t_max} > 35.0C")

            # Salinity: 30.0 - 39.0 PSU
            s_min, s_max = float(np.min(valid_salts)), float(np.max(valid_salts))
            self.assertGreaterEqual(s_min, 30.0, f"Salinity min {s_min} < 30.0 PSU")
            self.assertLessEqual(s_max, 39.0, f"Salinity max {s_max} > 39.0 PSU")

            # Depth: 0.0 - 1200.0 m
            d_min, d_max = float(np.min(valid_depths)), float(np.max(valid_depths))
            self.assertGreaterEqual(d_min, 0.0, f"Depth min {d_min} < 0.0m")
            self.assertLessEqual(d_max, 1200.0, f"Depth max {d_max} > 1200.0m")

            # Pressure: 0.0 - 1200.0 dbar
            p_min, p_max = float(np.min(valid_press)), float(np.max(valid_press))
            self.assertGreaterEqual(p_min, 0.0, f"Pressure min {p_min} < 0.0 dbar")
            self.assertLessEqual(p_max, 1200.0, f"Pressure max {p_max} > 1200.0 dbar")
        finally:
            ds.close()

    def test_trajectory_summary_json_consistency(self):
        summary_path = os.path.join(self.raw_dir, self.summary_file_name)
        self.assertTrue(os.path.exists(summary_path))
        with open(summary_path, "r", encoding="utf-8") as f:
            summary = json.load(f)

        self.assertEqual(summary["dataset_id"], "ru29-20180812T0220")
        self.assertEqual(summary["wmo_id"], "2801900")
        self.assertGreater(summary["counts"]["total_trajectory_points"], 80000)
        self.assertGreater(summary["counts"]["profile_count"], 900)
        self.assertIn("temperature_celsius", summary["parameter_ranges"])
        self.assertIn("salinity_psu", summary["parameter_ranges"])


if __name__ == "__main__":
    unittest.main()
