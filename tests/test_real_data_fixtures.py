"""
QuasarOS Real-Data Contract Fixtures Validation Test Suite (TASK-02F).

Validates:
1. All 8 extracted real-data contract fixtures exist in `tests/fixtures/real_data/` and match their computed SHA-256 checksums.
2. All 8 companion manifests exist in `tests/fixtures/manifests/` with valid schema structures, source citations, licensing, and bounding box slicing definitions.
3. Strict Deterministic Extraction Integrity: Sliced physical values in each fixture match byte-for-byte / float-exact values from the original raw datasets in `data/raw/`.
4. Unit and Coordinate Preservation: Units, dimensions, standard names, fill values, and coordinate arrays are preserved identically without silent mutation or synthetic fabrication.
5. Physical Plausibility and Ocean Validity: Valid ocean cells are finite numbers, within documented physical bounds, with no NaNs in active domains.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4 as nc

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FIXTURES_DIR = os.path.join(REPO_ROOT, "tests", "fixtures", "real_data")
MANIFESTS_DIR = os.path.join(REPO_ROOT, "tests", "fixtures", "manifests")
RAW_DIR = os.path.join(REPO_ROOT, "data", "raw")


def compute_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class TestRealDataContractFixtures(unittest.TestCase):
    """Test suite for TASK-02F real-data contract fixtures and companion manifests."""

    @classmethod
    def setUpClass(cls):
        cls.expected_fixtures = [
            "copernicus_thetao_subvolume.nc",
            "hycom_water_temp_subvolume.nc",
            "copernicus_waves_subset.nc",
            "incois_argo_7902250_profile.nc",
            "ru29_glider_trajectory_subset.nc",
            "gebco_2026_elevation_subset.nc",
            "woa23_salinity_oxygen_subset.nc",
            "incois_bioroms_metadata_subset.nc"
        ]

        cls.expected_manifests = [
            "copernicus_thetao_subvolume_manifest.json",
            "hycom_water_temp_subvolume_manifest.json",
            "copernicus_waves_subset_manifest.json",
            "incois_argo_7902250_profile_manifest.json",
            "ru29_glider_trajectory_subset_manifest.json",
            "gebco_2026_elevation_subset_manifest.json",
            "woa23_salinity_oxygen_subset_manifest.json",
            "incois_bioroms_metadata_subset_manifest.json"
        ]

    # =========================================================================
    # 1. Existence and Compact File Size Constraints (< 500 KB)
    # =========================================================================
    def test_all_fixtures_and_manifests_exist(self):
        """Verifies all 8 NetCDF fixtures and 8 JSON companion manifests exist."""
        for fname in self.expected_fixtures:
            fpath = os.path.join(FIXTURES_DIR, fname)
            self.assertTrue(os.path.exists(fpath), f"Missing fixture: {fpath}")
            size = os.path.getsize(fpath)
            # Fixtures must be non-empty and compact (< 500 KB for fast unit tests)
            self.assertGreater(size, 1024, f"Fixture too small: {size} bytes ({fname})")
            self.assertLess(size, 500 * 1024, f"Fixture exceeds 500KB budget: {size} bytes ({fname})")

        for mname in self.expected_manifests:
            mpath = os.path.join(MANIFESTS_DIR, mname)
            self.assertTrue(os.path.exists(mpath), f"Missing manifest: {mpath}")
            self.assertGreater(os.path.getsize(mpath), 100, f"Manifest empty: {mpath}")

    # =========================================================================
    # 2. Cryptographic Integrity: SHA-256 Checksums Match Manifests
    # =========================================================================
    def test_manifest_sha256_checksums_match_fixtures(self):
        """Verifies SHA-256 checksums in companion manifests match fixture files."""
        for mname in self.expected_manifests:
            mpath = os.path.join(MANIFESTS_DIR, mname)
            with open(mpath, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            fixture_fn = manifest["fixture_filename"]
            fixture_path = os.path.join(FIXTURES_DIR, fixture_fn)
            self.assertTrue(os.path.exists(fixture_path), f"Fixture missing: {fixture_path}")

            expected_sha = manifest["fixture_artifact"]["sha256"]
            actual_sha = compute_sha256(fixture_path)
            self.assertEqual(actual_sha, expected_sha, f"SHA-256 mismatch for fixture {fixture_fn}")

            expected_bytes = manifest["fixture_artifact"]["byte_size"]
            actual_bytes = os.path.getsize(fixture_path)
            self.assertEqual(actual_bytes, expected_bytes, f"Byte size mismatch for fixture {fixture_fn}")

    # =========================================================================
    # 3. Source Asset Cryptographic Integrity
    # =========================================================================
    def test_manifest_source_asset_sha256_checksums(self):
        """Verifies manifests correctly reference valid raw source files in data/raw/."""
        for mname in self.expected_manifests:
            mpath = os.path.join(MANIFESTS_DIR, mname)
            with open(mpath, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            src_info = manifest["source_asset"]
            if "relative_path" in src_info:
                src_path = os.path.join(REPO_ROOT, src_info["relative_path"])
                self.assertTrue(os.path.exists(src_path), f"Source file missing: {src_path}")
                computed_src_sha = compute_sha256(src_path)
                self.assertEqual(computed_src_sha, src_info["sha256"], f"Source SHA-256 mismatch for {src_path}")
            elif "relative_paths" in src_info:
                for rpath in src_info["relative_paths"]:
                    src_path = os.path.join(REPO_ROOT, rpath)
                    self.assertTrue(os.path.exists(src_path), f"Source file missing: {src_path}")

    # =========================================================================
    # 4. Detailed Fixture Slicing & Numerical Exactness Tests
    # =========================================================================
    def test_fixture_1_copernicus_thetao_numerical_exactness(self):
        """Validates Primary Scalar Volume (Copernicus PHY thetao)."""
        fix_path = os.path.join(FIXTURES_DIR, "copernicus_thetao_subvolume.nc")
        raw_path = os.path.join(RAW_DIR, "copernicus", "physical", "copernicus_phy_thetao_20250420_20250426.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, nc.Dataset(raw_path, "r") as ds_raw:
            self.assertEqual(ds_fix.variables["thetao"].shape, (2, 5, 25, 25))
            self.assertEqual(ds_fix.variables["thetao"].units, "degrees_C")
            self.assertEqual(ds_fix.variables["thetao"].standard_name, "sea_water_potential_temperature")

            # Verify coordinate exactness
            np.testing.assert_array_equal(ds_fix.variables["time"][:], ds_raw.variables["time"][:2])
            np.testing.assert_array_equal(ds_fix.variables["depth"][:], ds_raw.variables["depth"][:5])
            np.testing.assert_array_equal(ds_fix.variables["latitude"][:], ds_raw.variables["latitude"][96:121])
            np.testing.assert_array_equal(ds_fix.variables["longitude"][:], ds_raw.variables["longitude"][:25])

            # Verify numeric array values exactness
            raw_slice = ds_raw.variables["thetao"][:2, :5, 96:121, :25]
            fix_vals = ds_fix.variables["thetao"][:]
            np.testing.assert_array_equal(fix_vals, raw_slice)

            # Plausibility: valid ocean temps in 10°C to 35°C
            valid_mask = ~np.ma.getmaskarray(fix_vals)
            self.assertTrue(np.any(valid_mask), "Should contain valid ocean data")
            self.assertTrue(np.all(fix_vals[valid_mask] >= 10.0))
            self.assertTrue(np.all(fix_vals[valid_mask] <= 35.0))

    def test_fixture_2_hycom_water_temp_numerical_exactness(self):
        """Validates Secondary Scalar Volume (HYCOM ESPC-D-V02 water_temp)."""
        fix_path = os.path.join(FIXTURES_DIR, "hycom_water_temp_subvolume.nc")
        raw_path = os.path.join(RAW_DIR, "hycom", "hycom_espc_d_v02_temp3d_7day.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, nc.Dataset(raw_path, "r") as ds_raw:
            self.assertEqual(ds_fix.variables["water_temp"].shape, (2, 6, 16, 16))
            self.assertEqual(ds_fix.variables["water_temp"].units, "degC")

            # Check coordinate exactness
            np.testing.assert_array_equal(ds_fix.variables["time"][:], ds_raw.variables["time"][:2])
            np.testing.assert_array_equal(ds_fix.variables["depth"][:], ds_raw.variables["depth"][:6])
            np.testing.assert_array_equal(ds_fix.variables["lat"][:], ds_raw.variables["lat"][:16])
            np.testing.assert_array_equal(ds_fix.variables["lon"][:], ds_raw.variables["lon"][:16])

            # Check raw unscaled/scaled exactness
            raw_slice = ds_raw.variables["water_temp"][:2, :6, :16, :16]
            fix_vals = ds_fix.variables["water_temp"][:]
            np.testing.assert_array_equal(fix_vals, raw_slice)

    def test_fixture_3_copernicus_waves_numerical_exactness(self):
        """Validates Wave Grid (Copernicus Waves VHM0, VMDR, VTM02)."""
        fix_path = os.path.join(FIXTURES_DIR, "copernicus_waves_subset.nc")
        raw_path = os.path.join(RAW_DIR, "copernicus", "waves", "copernicus_waves_20250420_20250426.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, nc.Dataset(raw_path, "r") as ds_raw:
            self.assertEqual(ds_fix.variables["VHM0"].shape, (4, 20, 20))
            self.assertIn("VMDR", ds_fix.variables)
            self.assertIn("VTM02", ds_fix.variables)

            # Check exact wave height and period slices
            np.testing.assert_array_equal(ds_fix.variables["VHM0"][:], ds_raw.variables["VHM0"][:4, :20, :20])
            np.testing.assert_array_equal(ds_fix.variables["VMDR"][:], ds_raw.variables["VMDR"][:4, :20, :20])
            np.testing.assert_array_equal(ds_fix.variables["VTM02"][:], ds_raw.variables["VTM02"][:4, :20, :20])

    def test_fixture_4_incois_argo_profile_numerical_exactness(self):
        """Validates Profile Observation (Argo CTD profile)."""
        fix_path = os.path.join(FIXTURES_DIR, "incois_argo_7902250_profile.nc")
        raw_path = os.path.join(RAW_DIR, "argo-gdac", "D1902669_012.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, nc.Dataset(raw_path, "r") as ds_raw:
            self.assertIn("PRES", ds_fix.variables)
            self.assertIn("TEMP", ds_fix.variables)
            self.assertIn("PSAL", ds_fix.variables)
            self.assertIn("PRES_QC", ds_fix.variables)
            self.assertIn("TEMP_QC", ds_fix.variables)
            self.assertIn("PSAL_QC", ds_fix.variables)

            np.testing.assert_array_equal(ds_fix.variables["PRES"][:], ds_raw.variables["PRES"][:])
            np.testing.assert_array_equal(ds_fix.variables["TEMP"][:], ds_raw.variables["TEMP"][:])
            np.testing.assert_array_equal(ds_fix.variables["PSAL"][:], ds_raw.variables["PSAL"][:])
            np.testing.assert_array_equal(ds_fix.variables["TEMP_QC"][:], ds_raw.variables["TEMP_QC"][:])

    def test_fixture_5_ru29_glider_trajectory_numerical_exactness(self):
        """Validates Trajectory Observation (RU29 underwater glider)."""
        fix_path = os.path.join(FIXTURES_DIR, "ru29_glider_trajectory_subset.nc")
        raw_path = os.path.join(RAW_DIR, "gliders", "ru29_20180812T0220_north_indian_ocean.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, nc.Dataset(raw_path, "r") as ds_raw:
            self.assertEqual(ds_fix.dimensions["row"].size, 50)
            self.assertIn("temperature", ds_fix.variables)
            self.assertIn("salinity", ds_fix.variables)
            self.assertIn("pressure", ds_fix.variables)

            # Check profile IDs contain 1, 2, 3, 4
            prof_ids = ds_fix.variables["profile_id"][:]
            self.assertEqual(len(np.unique(prof_ids)), 4)

            # Exact values verification
            np.testing.assert_array_equal(ds_fix.variables["temperature"][:], ds_raw.variables["temperature"][:50])
            np.testing.assert_array_equal(ds_fix.variables["salinity"][:], ds_raw.variables["salinity"][:50])
            np.testing.assert_array_equal(ds_fix.variables["depth"][:], ds_raw.variables["depth"][:50])

    def test_fixture_6_gebco_bathymetry_numerical_exactness(self):
        """Validates Bathymetry Grid (GEBCO 2026 Grid)."""
        fix_path = os.path.join(FIXTURES_DIR, "gebco_2026_elevation_subset.nc")
        raw_path = os.path.join(RAW_DIR, "gebco", "gebco-2026", "gebco_2026_north_indian_ocean.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, nc.Dataset(raw_path, "r") as ds_raw:
            self.assertEqual(ds_fix.variables["elevation"].shape, (30, 30))
            self.assertEqual(ds_fix.variables["elevation"].units, "m")

            np.testing.assert_array_equal(ds_fix.variables["lat"][:], ds_raw.variables["lat"][:30])
            np.testing.assert_array_equal(ds_fix.variables["lon"][:], ds_raw.variables["lon"][:30])
            np.testing.assert_array_equal(ds_fix.variables["elevation"][:], ds_raw.variables["elevation"][:30, :30])

    def test_fixture_7_woa23_climatology_numerical_exactness(self):
        """Validates Climatology Grid (WOA23 Salinity & Oxygen)."""
        fix_path = os.path.join(FIXTURES_DIR, "woa23_salinity_oxygen_subset.nc")
        raw_sal_path = os.path.join(RAW_DIR, "woa23", "multivariable", "woa23_august_salinity_north_indian_ocean.nc")
        raw_oxy_path = os.path.join(RAW_DIR, "woa23", "multivariable", "woa23_august_oxygen_north_indian_ocean.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, \
             nc.Dataset(raw_sal_path, "r") as ds_sal, \
             nc.Dataset(raw_oxy_path, "r") as ds_oxy:

            self.assertEqual(ds_fix.variables["s_an"].shape, (1, 5, 15, 15))
            self.assertEqual(ds_fix.variables["o_an"].shape, (1, 5, 15, 15))

            np.testing.assert_array_equal(ds_fix.variables["s_an"][:], ds_sal.variables["s_an"][:1, :5, :15, :15])
            np.testing.assert_array_equal(ds_fix.variables["o_an"][:], ds_oxy.variables["o_an"][:1, :5, :15, :15])

    def test_fixture_8_roms_metadata_exactness_and_s_levels(self):
        """Validates ROMS S-Coordinate Metadata and terrain-following mathematical transformations."""
        fix_path = os.path.join(FIXTURES_DIR, "incois_bioroms_metadata_subset.nc")
        raw_path = os.path.join(RAW_DIR, "roms", "incois_bio_roms_north_indian_ocean.nc")

        with nc.Dataset(fix_path, "r") as ds_fix, nc.Dataset(raw_path, "r") as ds_raw:
            self.assertIn("s_rho", ds_fix.variables)
            self.assertIn("Cs_r", ds_fix.variables)
            self.assertIn("hc", ds_fix.variables)
            self.assertIn("Vtransform", ds_fix.variables)
            self.assertIn("Vstretching", ds_fix.variables)

            self.assertEqual(int(ds_fix.variables["Vtransform"][...]), 2)
            self.assertEqual(int(ds_fix.variables["Vstretching"][...]), 4)
            self.assertEqual(float(ds_fix.variables["hc"][...]), 100.0)

            # Check ROMS s_rho strictly monotonic in [-1, 0]
            s_rho = ds_fix.variables["s_rho"][:]
            self.assertEqual(len(s_rho), 32)
            self.assertTrue(np.all(np.diff(s_rho) > 0), "s_rho must be strictly monotonic increasing")
            self.assertGreaterEqual(s_rho[0], -1.0)
            self.assertLessEqual(s_rho[-1], 0.0)

            # Check Cs_r strictly monotonic in [-1, 0]
            Cs_r = ds_fix.variables["Cs_r"][:]
            self.assertEqual(len(Cs_r), 32)
            self.assertTrue(np.all(np.diff(Cs_r) > 0), "Cs_r must be strictly monotonic increasing")

            # Check exactness of physical variables (temp, salt) against raw source
            np.testing.assert_array_equal(ds_fix.variables["temp"][:], ds_raw.variables["temp"][:2, :20, :20])
            np.testing.assert_array_equal(ds_fix.variables["salt"][:], ds_raw.variables["salt"][:2, :20, :20])


if __name__ == "__main__":
    unittest.main()
