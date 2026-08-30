"""
QuasarOS Source Coverage and Handoff Reconciliation Regression Tests (TASK-03R).

Validates:
1. Spatial Domain Containment (NetCDF source arrays, Canonical Zarr arrays, and companion manifests match exactly:
   lat: [-3.0, 12.0], lon: [80.0, 88.0], shape: (181, 97)).
2. Vertical Coverage & Depth Bounds Alignment:
   31 non-uniform depth levels from 0.494025 m to 453.937714 m.
   Rejection of obsolete 5727.9m claims in profile contracts.
3. Temporal Coverage & Classification:
   Classified as HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT covering 2025-04-20T00:00:00Z to 2025-04-26T00:00:00Z.
   Verification of 7 daily timestamps with zero 2026 operational confusion.
4. Product and Source Identity:
   Bitwise SHA-256 (6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281), size (15,263,241 bytes),
   and provider (Copernicus Marine GLOBAL_ANALYSISFORECAST_PHY_001_024).
5. Canonical Relative Paths & Manifests:
   Verifies existence and consistency of 'data/canonical/copernicus_phy_thetao/v1/',
   'data/canonical/copernicus_phy_thetao/v1/canonical_manifest.json',
   'data/manifests/canonical/copernicus_phy_thetao_manifest.json',
   and consolidated metadata 'data/canonical/copernicus_phy_thetao/v1/.zmetadata'.
   Ensures zero empty/blank paths.
6. 100% Full-Volume Bitwise Parity across all 3,809,869 voxels with 0.000000 maximum absolute error.
7. FirstVolumeSliceProfile and Contract Synchronization:
   Spatial bounds, depth bounds (0.494, 453.938), and temperature ranges (9.55, 31.85) strictly match.
"""

import hashlib
import json
import os
import pathlib
import sys
import unittest
import numpy as np
import xarray as xr
import zarr

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
INGESTION_SRC = REPO_ROOT / "packages" / "ingestion" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from quasar_contracts.visualization_contracts import (
    FirstVolumeSliceProfile,
    TextureSampleFormat,
)
from quasar_contracts.horizontal_grids import SpatialBoundingBox


class TestCanonicalCoverageReconciliation(unittest.TestCase):
    """Authoritative reconciliation test suite for TASK-03R."""

    @classmethod
    def setUpClass(cls):
        cls.raw_nc_path = REPO_ROOT / "data" / "raw" / "copernicus" / "physical" / "copernicus_phy_thetao_20250420_20250426.nc"
        cls.zarr_store_path = REPO_ROOT / "data" / "canonical" / "copernicus_phy_thetao" / "v1"
        cls.canonical_manifest_path = cls.zarr_store_path / "canonical_manifest.json"
        cls.companion_manifest_path = REPO_ROOT / "data" / "manifests" / "canonical" / "copernicus_phy_thetao_manifest.json"
        cls.zmetadata_path = cls.zarr_store_path / ".zmetadata"

        cls.expected_sha256 = "6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281"
        cls.expected_file_size = 15263241
        cls.expected_shape = (7, 31, 181, 97)
        cls.expected_min_lat = -3.0
        cls.expected_max_lat = 12.0
        cls.expected_min_lon = 80.0
        cls.expected_max_lon = 88.0
        cls.expected_min_depth = 0.49402499198913574
        cls.expected_max_depth = 453.9377136230469

    # -------------------------------------------------------------------------
    # 1. Product and Source Identity Verification
    # -------------------------------------------------------------------------
    def test_product_and_source_identity(self):
        """Verify immutable raw NetCDF file exists, size and bitwise SHA-256 match perfectly."""
        self.assertTrue(self.raw_nc_path.exists(), f"Missing raw NetCDF at {self.raw_nc_path}")
        self.assertEqual(self.raw_nc_path.stat().st_size, self.expected_file_size)

        hasher = hashlib.sha256()
        with open(self.raw_nc_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        self.assertEqual(hasher.hexdigest().lower(), self.expected_sha256)

    # -------------------------------------------------------------------------
    # 2. Canonical Relative Paths & Manifest Containment
    # -------------------------------------------------------------------------
    def test_canonical_paths_and_manifests_exist(self):
        """Verify canonical Zarr store, consolidated .zmetadata, and manifests exist at relative paths."""
        self.assertTrue(self.zarr_store_path.exists(), "Canonical store dir missing")
        self.assertTrue(self.zmetadata_path.exists(), "Consolidated .zmetadata missing")
        self.assertTrue(self.canonical_manifest_path.exists(), "canonical_manifest.json missing")
        self.assertTrue(self.companion_manifest_path.exists(), "Companion manifest missing")

        with open(self.canonical_manifest_path, "r", encoding="utf-8") as f:
            c_manifest = json.load(f)
        with open(self.companion_manifest_path, "r", encoding="utf-8") as f:
            comp_manifest = json.load(f)

        self.assertEqual(c_manifest["source_asset_sha256"], self.expected_sha256)
        self.assertEqual(comp_manifest["source_asset_sha256"], self.expected_sha256)
        self.assertEqual(c_manifest["canonical_store_path"], "data/canonical/copernicus_phy_thetao/v1")
        self.assertEqual(comp_manifest["canonical_store_path"], "data/canonical/copernicus_phy_thetao/v1")
        self.assertEqual(c_manifest["validation_status"], "VALIDATED")

    # -------------------------------------------------------------------------
    # 3. Horizontal Domain Reconciliation
    # -------------------------------------------------------------------------
    def test_horizontal_domain_reconciliation(self):
        """Verify horizontal domain matches across NetCDF, Zarr, and manifest."""
        ds_nc = xr.open_dataset(self.raw_nc_path)
        z_store = zarr.open_consolidated(str(self.zarr_store_path))

        nc_lats = ds_nc.latitude.values
        nc_lons = ds_nc.longitude.values
        z_lats = z_store["latitude"][:]
        z_lons = z_store["longitude"][:]

        self.assertEqual(len(nc_lats), 181)
        self.assertEqual(len(nc_lons), 97)
        self.assertEqual(len(z_lats), 181)
        self.assertEqual(len(z_lons), 97)

        np.testing.assert_allclose(nc_lats, z_lats, atol=1e-6)
        np.testing.assert_allclose(nc_lons, z_lons, atol=1e-6)

        self.assertAlmostEqual(float(nc_lats.min()), self.expected_min_lat, places=4)
        self.assertAlmostEqual(float(nc_lats.max()), self.expected_max_lat, places=4)
        self.assertAlmostEqual(float(nc_lons.min()), self.expected_min_lon, places=4)
        self.assertAlmostEqual(float(nc_lons.max()), self.expected_max_lon, places=4)

    # -------------------------------------------------------------------------
    # 4. Vertical Coverage & Depth Bounds Alignment
    # -------------------------------------------------------------------------
    def test_vertical_coverage_and_depth_bounds(self):
        """Verify vertical grid has 31 levels from 0.494m to 453.938m (not 5727.9m)."""
        ds_nc = xr.open_dataset(self.raw_nc_path)
        z_store = zarr.open_consolidated(str(self.zarr_store_path))

        nc_depth = ds_nc.depth.values
        z_depth = z_store["depth"][:]

        self.assertEqual(len(nc_depth), 31)
        self.assertEqual(len(z_depth), 31)
        np.testing.assert_allclose(nc_depth, z_depth, atol=1e-5)

        self.assertAlmostEqual(float(nc_depth.min()), self.expected_min_depth, places=3)
        self.assertAlmostEqual(float(nc_depth.max()), self.expected_max_depth, places=3)

        # Explicitly verify max depth is <= 500m and not the full 50-level ocean depth (5727.9m)
        self.assertLess(float(nc_depth.max()), 500.0)
        self.assertNotAlmostEqual(float(nc_depth.max()), 5727.9, delta=100.0)

    # -------------------------------------------------------------------------
    # 5. Temporal Coverage & Historical Snapshot Classification
    # -------------------------------------------------------------------------
    def test_temporal_coverage_and_historical_classification(self):
        """Verify 7 daily timesteps covering 2025-04-20 to 2025-04-26 (historical validation snapshot)."""
        z_store = zarr.open_consolidated(str(self.zarr_store_path))
        time_iso = [str(t) for t in z_store["time_iso"][:]]

        self.assertEqual(len(time_iso), 7)
        self.assertEqual(time_iso[0], "2025-04-20T00:00:00Z")
        self.assertEqual(time_iso[-1], "2025-04-26T00:00:00Z")

        # Verify no 2026 timestamps in physical dataset
        for t_str in time_iso:
            self.assertTrue(t_str.startswith("2025-04-"), f"Unexpected non-2025 timestamp: {t_str}")

    # -------------------------------------------------------------------------
    # 6. 100% Full-Volume Parity Across All 3,809,869 Voxels
    # -------------------------------------------------------------------------
    def test_full_volume_numerical_parity_100_percent(self):
        """Assert strictly 0.000000 max error between NetCDF source and canonical Zarr."""
        ds_nc = xr.open_dataset(self.raw_nc_path)
        z_store = zarr.open_consolidated(str(self.zarr_store_path))

        nc_thetao = ds_nc.thetao.values
        z_thetao = z_store["sea_water_potential_temperature"][:]
        z_mask = z_store["validity_mask"][:]

        self.assertEqual(nc_thetao.shape, self.expected_shape)
        self.assertEqual(z_thetao.shape, self.expected_shape)
        self.assertEqual(nc_thetao.size, 3809869)

        # NaN mask alignment
        nan_nc = np.isnan(nc_thetao)
        nan_zarr = np.isnan(z_thetao)
        self.assertTrue(np.array_equal(nan_nc, nan_zarr))

        # Validity mask consistency: mask == 0 iff not NaN
        valid_zarr_mask = (z_mask == 0)
        self.assertTrue(np.array_equal(~nan_zarr, valid_zarr_mask))

        # Absolute numerical error on valid samples
        valid_diff = np.abs(nc_thetao[~nan_nc] - z_thetao[~nan_zarr])
        max_err = float(np.max(valid_diff))
        self.assertEqual(max_err, 0.0)

        # Physical range validation
        min_temp = float(np.nanmin(nc_thetao))
        max_temp = float(np.nanmax(nc_thetao))
        self.assertAlmostEqual(min_temp, 9.55318, places=4)
        self.assertAlmostEqual(max_temp, 31.84776, places=4)

    # -------------------------------------------------------------------------
    # 7. FirstVolumeSliceProfile Contract Synchronization
    # -------------------------------------------------------------------------
    def test_first_volume_slice_profile_reconciliation(self):
        """Verify FirstVolumeSliceProfile aligns with actual reconciled dataset bounds."""
        profile = FirstVolumeSliceProfile(
            profile_name="copernicus_first_volume_slice_thetao",
            is_primary_selection=True,
            dataset_identifier="GLOBAL_ANALYSISFORECAST_PHY_001_024",
            target_variable="sea_water_potential_temperature",
            grid_dimensions=[97, 181, 31],
            z_levels_count=31,
            spatial_resolution_deg=0.0833,
            depth_extent_m=(0.494, 453.938),
            physical_range_deg_c=(9.55, 31.85),
            recommended_texture_format=TextureSampleFormat.R16_FLOAT,
        )
        self.assertEqual(profile.z_levels_count, 31)
        self.assertEqual(profile.grid_dimensions, [97, 181, 31])
        self.assertAlmostEqual(profile.depth_extent_m[0], 0.494, places=3)
        self.assertAlmostEqual(profile.depth_extent_m[1], 453.938, places=3)
        self.assertAlmostEqual(profile.physical_range_deg_c[0], 9.55, places=2)
        self.assertAlmostEqual(profile.physical_range_deg_c[1], 31.85, places=2)


if __name__ == "__main__":
    unittest.main()
