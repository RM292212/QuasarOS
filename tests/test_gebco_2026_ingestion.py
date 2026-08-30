"""
Unit test suite for GEBCO 2026 Bathymetry & Type Identifier (TID) Grid Ingestion (TASK-01X-I).

Validates:
1. Physical raw NetCDF files and manifest existence.
2. SHA-256 checksums and byte size integrity.
3. NetCDF-4 variable schema, CRS metadata, and coordinate grids.
4. Elevation bounds, ocean depths, and land topography.
5. TID flag values, flag meanings, and sensor lineage.
6. Supersession link to historical GEBCO 2020 baseline while preserving GEBCO 2020 immutability.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestGEBCO2026Ingestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.manifest_path = os.path.join(cls.repo_root, "data", "manifests", "gebco-2026", "gebco_2026_manifest.json")
        cls.elev_raw_path = os.path.join(cls.repo_root, "data", "raw", "gebco", "gebco-2026", "gebco_2026_north_indian_ocean.nc")
        cls.tid_raw_path = os.path.join(cls.repo_root, "data", "raw", "gebco", "gebco-2026", "gebco_2026_tid_north_indian_ocean.nc")
        cls.gebco_2020_manifest_path = os.path.join(cls.repo_root, "data", "manifests", "gebco", "gebco_manifest.json")
        cls.gebco_2020_raw_path = os.path.join(cls.repo_root, "data", "raw", "gebco", "gebco_2020_north_indian_ocean.nc")

    def test_files_and_manifest_exist(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest missing: {self.manifest_path}")
        self.assertTrue(os.path.exists(self.elev_raw_path), f"Elevation file missing: {self.elev_raw_path}")
        self.assertTrue(os.path.exists(self.tid_raw_path), f"TID file missing: {self.tid_raw_path}")

    def test_manifest_metadata_and_checksums(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01X-I")
        self.assertEqual(manifest.get("dataset_id"), "GEBCO_2026")
        self.assertEqual(manifest.get("scientific_role"), "BATHYMETRY")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertIn("doi", manifest)
        self.assertEqual(manifest["doi"], "10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa")

        # Verify checksums for all listed files
        files_list = manifest.get("files", [])
        self.assertEqual(len(files_list), 2)

        for file_entry in files_list:
            full_path = os.path.join(self.repo_root, file_entry["relative_path"])
            self.assertTrue(os.path.exists(full_path), f"File in manifest missing on disk: {full_path}")
            self.assertEqual(os.path.getsize(full_path), file_entry["byte_size"])

            hasher = hashlib.sha256()
            with open(full_path, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            self.assertEqual(hasher.hexdigest(), file_entry["sha256"])

    def test_elevation_netcdf_structure_and_bounds(self):
        ds = netCDF4.Dataset(self.elev_raw_path, "r")
        try:
            self.assertIn("lat", ds.variables)
            self.assertIn("lon", ds.variables)
            self.assertIn("crs", ds.variables)
            self.assertIn("elevation", ds.variables)

            lats = ds.variables["lat"][:]
            lons = ds.variables["lon"][:]
            elev = ds.variables["elevation"][:]

            self.assertEqual(len(lats), 301)
            self.assertEqual(len(lons), 601)
            self.assertEqual(elev.shape, (301, 601))

            # Geographic bounds verification (0 to 30N, 40 to 100E)
            self.assertGreaterEqual(float(lats.min()), 0.0)
            self.assertLessEqual(float(lats.max()), 30.1)
            self.assertGreaterEqual(float(lons.min()), 40.0)
            self.assertLessEqual(float(lons.max()), 100.1)

            # Plausible scientific depth and topography bounds
            self.assertLess(float(elev.min()), -5000.0, "Deep ocean trenches/basins in North Indian Ocean should exceed -5000m")
            self.assertGreater(float(elev.max()), 6000.0, "Himalayan/Tibetan land topography should exceed 6000m")

            # CRS attributes
            crs_var = ds.variables["crs"]
            self.assertEqual(crs_var.epsg_code, "EPSG:4326")
            self.assertEqual(crs_var.grid_mapping_name, "latitude_longitude")
        finally:
            ds.close()

    def test_tid_netcdf_structure_and_codes(self):
        ds_tid = netCDF4.Dataset(self.tid_raw_path, "r")
        try:
            self.assertIn("lat", ds_tid.variables)
            self.assertIn("lon", ds_tid.variables)
            self.assertIn("crs", ds_tid.variables)
            self.assertIn("tid", ds_tid.variables)

            tid_var = ds_tid.variables["tid"]
            tid_data = tid_var[:]
            self.assertEqual(tid_data.shape, (301, 601))

            # Check flag meanings and flag values
            self.assertTrue(hasattr(tid_var, "flag_values"))
            self.assertTrue(hasattr(tid_var, "flag_meanings"))
            self.assertIn("Multibeam", tid_var.flag_meanings)
            self.assertIn("Singlebeam", tid_var.flag_meanings)

            unique_tids = set(np.unique(tid_data))
            # Verify presence of land (0), multibeam (11), and satellite gravity predictions (40)
            self.assertIn(0, unique_tids, "Land cells (TID 0) must be present")
            self.assertIn(11, unique_tids, "Direct multibeam acoustic sounding cells (TID 11) must be present")
            self.assertIn(40, unique_tids, "Predicted altimetry bathymetry cells (TID 40) must be present")
        finally:
            ds_tid.close()

    def test_elevation_and_tid_land_sea_consistency(self):
        ds_elev = netCDF4.Dataset(self.elev_raw_path, "r")
        ds_tid = netCDF4.Dataset(self.tid_raw_path, "r")
        try:
            elev = ds_elev.variables["elevation"][:]
            tid = ds_tid.variables["tid"][:]

            # Where TID == 0 (Land), elevation is >= 0 for >99.9% of cells, with valid exceptions for
            # sub-sea-level terrestrial depressions (e.g. Afar / Danakil Depression in Horn of Africa near Lat 14-18N, Lon 40-42E)
            land_elev = elev[tid == 0]
            non_negative_land_ratio = float(np.count_nonzero(land_elev >= 0)) / float(len(land_elev))
            self.assertGreater(non_negative_land_ratio, 0.999, "Over 99.9% of TID=0 (Land) cells must be >= 0m")
            # All sub-sea-level land depressions in this domain must be within plausible terrestrial depression range (elev >= -200m)
            self.assertTrue(np.all(land_elev >= -200), "Terrestrial land depressions must not exceed -200m in this domain")

            # Where TID == 11 (Multibeam sonar), elevations should be underwater (<= 0m)
            multibeam_elev = elev[tid == 11]
            self.assertTrue(np.all(multibeam_elev <= 0), "All multibeam sonar sounding cells must have ocean depths (<= 0m)")
        finally:
            ds_elev.close()
            ds_tid.close()

    def test_supersession_link_and_historical_preservation(self):
        # 1. Verify GEBCO 2026 manifest has explicit supersession link
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest_2026 = json.load(f)

        self.assertIn("supersession", manifest_2026)
        supersession = manifest_2026["supersession"]
        self.assertEqual(supersession.get("status"), "ACTIVE_SUPERSEDING")
        self.assertEqual(supersession.get("supersedes_dataset_id"), "GEBCO_2020")
        self.assertTrue(supersession.get("historical_baseline_preserved"))
        self.assertIn("supersession_rationale", supersession)

        # 2. Verify historical GEBCO 2020 files remain preserved and intact
        self.assertTrue(os.path.exists(self.gebco_2020_raw_path), "GEBCO 2020 baseline raw file must be preserved")
        self.assertTrue(os.path.exists(self.gebco_2020_manifest_path), "GEBCO 2020 baseline manifest must be preserved")

        with open(self.gebco_2020_manifest_path, "r", encoding="utf-8") as f:
            manifest_2020 = json.load(f)
        self.assertEqual(manifest_2020.get("dataset_id"), "GEBCO_2020")

        # 3. Verify spatial compatibility between 2020 baseline and 2026 upgrade for differential analyses
        ds_2020 = netCDF4.Dataset(self.gebco_2020_raw_path, "r")
        ds_2026 = netCDF4.Dataset(self.elev_raw_path, "r")
        try:
            lats_2020 = ds_2020.variables["latitude"][:]
            lats_2026 = ds_2026.variables["lat"][:]
            lons_2020 = ds_2020.variables["longitude"][:]
            lons_2026 = ds_2026.variables["lon"][:]

            np.testing.assert_allclose(lats_2020, lats_2026, rtol=1e-5, err_msg="Latitude grids must match between 2020 and 2026")
            np.testing.assert_allclose(lons_2020, lons_2026, rtol=1e-5, err_msg="Longitude grids must match between 2020 and 2026")
        finally:
            ds_2020.close()
            ds_2026.close()


if __name__ == "__main__":
    unittest.main()
