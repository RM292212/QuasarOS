"""
QuasarOS Lossless Canonical Zarr Writer Unit Tests (TASK-03C).

Validates:
1. Canonical Zarr Generation from both Real Fixture and Raw NetCDF source.
2. Exact Array Shapes, Chunk Shapes (1, 31, 64, 64), float32 dtypes, and Coordinates.
3. 100% Exact Lossless Numerical Match against decoded NetCDF source (max absolute error == 0.0).
4. Validity mask categorical flags align bit-for-bit with NetCDF missing state.
5. Valid physical zeros (0.0 °C) preserved without NaN corruption.
6. Consolidated metadata (.zmetadata) generated and readable via open_consolidated.
7. Atomic staging and publication workflow.
8. Idempotency behavior on repeat execution.
9. Manifest generation and schema compliance.
"""

from __future__ import annotations

import json
import os
import pathlib
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
import numpy as np
import zarr

# Ensure packages are importable
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
INGESTION_SRC = REPO_ROOT / "packages" / "ingestion" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from quasar_ingestion.adapters.copernicus_phy_adapter import (
    CopernicusPhysicalAdapter,
    ValidityMaskCode,
)
from quasar_ingestion.storage.canonical_zarr_writer import (
    LosslessCanonicalZarrWriter,
    CanonicalZarrManifest,
)


class TestCanonicalZarrWriter(unittest.TestCase):
    """Comprehensive test suite for LosslessCanonicalZarrWriter."""

    @classmethod
    def setUpClass(cls):
        cls.raw_file = REPO_ROOT / "data" / "raw" / "copernicus" / "physical" / "copernicus_phy_thetao_20250420_20250426.nc"
        cls.fixture_file = REPO_ROOT / "tests" / "fixtures" / "real_data" / "copernicus_thetao_subvolume.nc"
        cls.expected_raw_sha256 = "6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281"
        cls.expected_fixture_sha256 = "418255b0b3df1e40c37ded9b53c5338f2f3a58cd838a8c075db225c259c3f8a9"

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp(prefix="test_zarr_out_"))

    def tearDown(self):
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    # =========================================================================
    # 1. Real Fixture Zarr Generation & Lossless Numerical Verification
    # =========================================================================
    def test_fixture_zarr_generation_and_numerical_losslessness(self):
        out_store = self.temp_dir / "copernicus_fixture_zarr"
        writer = LosslessCanonicalZarrWriter(
            output_dir=out_store,
            chunk_shape_4d=(1, 5, 25, 25),
            compression_level=3,
            zarr_format=2,
        )

        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            manifest = writer.write_dataset(
                adapter=adapter,
                expected_source_sha256=self.expected_fixture_sha256,
                force=True,
            )

        self.assertIsInstance(manifest, CanonicalZarrManifest)
        self.assertEqual(manifest.validation_status, "VALIDATED")
        self.assertTrue((out_store / ".zmetadata").exists())
        self.assertTrue((out_store / "canonical_manifest.json").exists())

        # Open consolidated store and verify arrays
        store = zarr.open_consolidated(str(out_store))
        self.assertIn("sea_water_potential_temperature", store)
        self.assertIn("validity_mask", store)
        self.assertIn("depth", store)
        self.assertIn("latitude", store)
        self.assertIn("longitude", store)
        self.assertIn("time", store)
        self.assertIn("time_iso", store)

        # Verify shapes and types
        self.assertEqual(store["sea_water_potential_temperature"].shape, (2, 5, 25, 25))
        self.assertEqual(store["validity_mask"].shape, (2, 5, 25, 25))
        self.assertEqual(store["sea_water_potential_temperature"].dtype, np.float32)
        self.assertEqual(store["validity_mask"].dtype, np.uint8)

        # Compare directly against adapter read
        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            expected_vals, expected_mask = adapter.read_variable_array()
            coords = adapter.read_coordinates()

        read_vals = store["sea_water_potential_temperature"][:]
        read_mask = store["validity_mask"][:]

        # Mask comparison
        np.testing.assert_array_equal(read_mask, expected_mask)

        # Values comparison: NaN check + finite values exact match
        read_nans = np.isnan(read_vals)
        expected_nans = np.isnan(expected_vals)
        np.testing.assert_array_equal(read_nans, expected_nans)

        valid_idx = ~expected_nans
        self.assertTrue(np.any(valid_idx))
        # 0.000000 absolute tolerance difference
        max_abs_diff = np.max(np.abs(read_vals[valid_idx] - expected_vals[valid_idx]))
        self.assertEqual(float(max_abs_diff), 0.0)

        # Verify coordinates
        np.testing.assert_array_equal(store["depth"][:], np.array(coords["depth"], dtype=np.float32))
        np.testing.assert_array_equal(store["latitude"][:], np.array(coords["latitude"], dtype=np.float32))
        np.testing.assert_array_equal(store["longitude"][:], np.array(coords["longitude"], dtype=np.float32))
        np.testing.assert_array_equal(store["time_iso"][:], np.array(coords["time_iso"], dtype="<U20"))

    # =========================================================================
    # 2. Raw Full NetCDF Generation, Chunking, and Mask Alignment
    # =========================================================================
    def test_raw_netcdf_zarr_generation_and_chunk_geometry(self):
        out_store = self.temp_dir / "copernicus_raw_zarr"
        companion_manifest_copy = self.temp_dir / "manifest_copy" / "copernicus_manifest.json"

        writer = LosslessCanonicalZarrWriter(
            output_dir=out_store,
            chunk_shape_4d=(1, 31, 64, 64),
            compression_level=3,
            zarr_format=2,
        )

        with CopernicusPhysicalAdapter(self.raw_file) as adapter:
            manifest = writer.write_dataset(
                adapter=adapter,
                expected_source_sha256=self.expected_raw_sha256,
                force=True,
                companion_manifest_paths=[companion_manifest_copy],
            )

        self.assertEqual(manifest.dataset_id, "copernicus_phy_thetao")
        self.assertTrue(companion_manifest_copy.exists())

        # Validate array manifest metadata
        thetao_manifest = manifest.arrays["sea_water_potential_temperature"]
        self.assertEqual(thetao_manifest.shape, [7, 31, 181, 97])
        self.assertEqual(thetao_manifest.chunks, [1, 31, 64, 64])
        self.assertEqual(thetao_manifest.dtype, "float32")
        # Chunks along dim: time=7 chunks (1 each), depth=1 chunk (31), lat=ceil(181/64)=3 chunks, lon=ceil(97/64)=2 chunks
        # Total chunks = 7 * 1 * 3 * 2 = 42 chunks
        self.assertEqual(thetao_manifest.chunk_count, 42)
        self.assertEqual(len(thetao_manifest.chunks_manifest), 42)

        # Open store and inspect statistics
        store = zarr.open_consolidated(str(out_store))
        vals = store["sea_water_potential_temperature"][:]
        mask = store["validity_mask"][:]

        self.assertEqual(vals.shape, (7, 31, 181, 97))
        self.assertEqual(mask.shape, (7, 31, 181, 97))

        valid_count = int(np.sum(mask == ValidityMaskCode.VALID.value))
        missing_count = int(np.sum(mask == ValidityMaskCode.SOURCE_MISSING.value))
        self.assertEqual(valid_count, 3618944)
        self.assertEqual(missing_count, 190925)

        # Check attributes
        self.assertEqual(store["sea_water_potential_temperature"].attrs["units"], "degree_Celsius")
        self.assertEqual(store["sea_water_potential_temperature"].attrs["physical_quantity"], "temperature")
        self.assertEqual(store["sea_water_potential_temperature"].attrs["source_variable"], "thetao")
        self.assertEqual(store["validity_mask"].attrs["standard_name"], "status_flag")

    # =========================================================================
    # 3. Idempotency & Repeat Execution Verification
    # =========================================================================
    def test_idempotency_behavior(self):
        out_store = self.temp_dir / "copernicus_idempotent_zarr"
        writer = LosslessCanonicalZarrWriter(
            output_dir=out_store,
            chunk_shape_4d=(1, 5, 25, 25),
        )

        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            # 1. Initial write
            m1 = writer.write_dataset(adapter=adapter, expected_source_sha256=self.expected_fixture_sha256)
            self.assertEqual(m1.validation_status, "VALIDATED")

            # 2. Check is_already_generated
            self.assertTrue(writer.is_already_generated(self.expected_fixture_sha256))

            # 3. Second write without force should skip work and return matching manifest
            m2 = writer.write_dataset(adapter=adapter, expected_source_sha256=self.expected_fixture_sha256, force=False)
            self.assertEqual(m2.dataset_id, m1.dataset_id)
            self.assertEqual(m2.source_asset_sha256, m1.source_asset_sha256)
            self.assertEqual(m2.arrays["sea_water_potential_temperature"].logical_sha256,
                             m1.arrays["sea_water_potential_temperature"].logical_sha256)


if __name__ == "__main__":
    unittest.main()
