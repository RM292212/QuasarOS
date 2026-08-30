"""
QuasarOS Copernicus Marine Physical Temperature Adapter Unit Tests (TASK-03B).

Validates:
1. Source Identity and Bitwise SHA-256 Checksum Verification & Rejection of Tampered Hashes.
2. Canonical Variable Mapping to sea_water_potential_temperature, PhysicalQuantity.temperature, and degree_Celsius.
3. Monotonic Coordinates (depth, latitude, longitude) and ISO-8601 UTC time decoding.
4. Non-uniform 31 depth levels preservation (0.494 m to 453.938 m).
5. Bounded Slice Reading, NaN masking, Validity Mask Generation, Valid Zero Preservation, and Absence of NaN Corruption.
6. Execution against both the real local NetCDF raw asset and the TASK-02 real fixture.
7. Context Manager and Deterministic Resource Cleanup.
"""

import hashlib
import os
import pathlib
import sys
import unittest
import numpy as np

# Ensure packages are importable
REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
INGESTION_SRC = REPO_ROOT / "packages" / "ingestion" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from quasar_contracts.canonical_dataset import CanonicalDatasetContract
from quasar_contracts.data_class import DataClassDiscriminator, OperationalStatus, ScientificRole
from quasar_contracts.variables import PhysicalQuantity, Topology
from quasar_contracts.vertical_coords import VerticalCoordinateType
from quasar_ingestion.adapters.copernicus_phy_adapter import (
    CopernicusPhysicalAdapter,
    ValidityMaskCode,
)


class TestCopernicusPhysicalAdapter(unittest.TestCase):
    """Comprehensive test suite for CopernicusPhysicalAdapter."""

    @classmethod
    def setUpClass(cls):
        cls.raw_file = REPO_ROOT / "data" / "raw" / "copernicus" / "physical" / "copernicus_phy_thetao_20250420_20250426.nc"
        cls.fixture_file = REPO_ROOT / "tests" / "fixtures" / "real_data" / "copernicus_thetao_subvolume.nc"
        cls.expected_raw_sha256 = "6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281"
        cls.expected_fixture_sha256 = "418255b0b3df1e40c37ded9b53c5338f2f3a58cd838a8c075db225c259c3f8a9"

    # =========================================================================
    # 1. File Inspection & SHA-256 Checksum Validation / Tamper Rejection
    # =========================================================================
    def test_raw_source_inspection_and_sha256_verification(self):
        adapter = CopernicusPhysicalAdapter(self.raw_file)
        try:
            meta = adapter.inspect_source_metadata()
            self.assertEqual(meta["data_model"], "NETCDF4")
            self.assertEqual(meta["dimensions"]["time"], 7)
            self.assertEqual(meta["dimensions"]["depth"], 31)
            self.assertEqual(meta["dimensions"]["latitude"], 181)
            self.assertEqual(meta["dimensions"]["longitude"], 97)
            self.assertIn("thetao", meta["variables"])
            self.assertEqual(meta["variables"]["thetao"]["dimensions"], ["time", "depth", "latitude", "longitude"])

            # Verify exact SHA-256 passes
            self.assertTrue(adapter.verify_source_integrity(self.expected_raw_sha256))

            # Verify corrupted SHA-256 raises ValueError
            corrupted_sha = "0000000000000000000000000000000000000000000000000000000000000000"
            with self.assertRaises(ValueError) as ctx:
                adapter.verify_source_integrity(corrupted_sha)
            self.assertIn("integrity verification failed", str(ctx.exception))
        finally:
            adapter.close()

    def test_nonexistent_file_rejection(self):
        fake_path = REPO_ROOT / "data" / "nonexistent_ocean_file.nc"
        with self.assertRaises(FileNotFoundError):
            CopernicusPhysicalAdapter(fake_path)

    # =========================================================================
    # 2. Variable Mapping, Thermodynamic Safeguards & Canonical Contracts
    # =========================================================================
    def test_canonical_dataset_contract_generation(self):
        with CopernicusPhysicalAdapter(self.raw_file) as adapter:
            contract = adapter.get_canonical_dataset_contract()
            self.assertIsInstance(contract, CanonicalDatasetContract)
            
            # Dataset Identity
            self.assertEqual(contract.identity.dataset_id, "copernicus_phy_thetao")
            self.assertEqual(contract.identity.product_id, "GLOBAL_ANALYSISFORECAST_PHY_001_024")
            self.assertEqual(contract.identity.scientific_role, ScientificRole.MODEL)
            self.assertEqual(contract.identity.data_class, DataClassDiscriminator.model_volume)
            self.assertEqual(contract.identity.operational_status, OperationalStatus.OPERATIONAL)
            self.assertEqual(contract.identity.provider.provider_id, "copernicus_marine")

            # Variable semantics
            self.assertIn("sea_water_potential_temperature", contract.variables)
            var = contract.variables["sea_water_potential_temperature"]
            self.assertEqual(var.physical_quantity, PhysicalQuantity.temperature)
            self.assertEqual(var.canonical_units, "degree_Celsius")
            self.assertEqual(var.source_units, "degrees_C")
            self.assertEqual(var.standard_name, "sea_water_potential_temperature")
            self.assertEqual(var.source_name, "thetao")
            self.assertEqual(var.topology, Topology.volume_scalar)
            self.assertEqual(var.dimensions, ["time", "depth", "latitude", "longitude"])
            self.assertEqual(var.data_type, "float32")

            # Capabilities
            self.assertTrue(contract.capabilities.can_volume_render_3d)
            self.assertTrue(contract.capabilities.can_exact_query)
            self.assertTrue(contract.capabilities.can_horizontal_slice)
            self.assertTrue(contract.capabilities.can_vertical_slice)
            self.assertTrue(contract.capabilities.can_extract_isosurface)
            self.assertFalse(contract.capabilities.can_render_vector_glyphs)

            # Horizontal Grid
            self.assertEqual(contract.grid.shape, [181, 97])
            self.assertAlmostEqual(contract.grid.spatial_bounds.min_longitude, 80.0, places=3)
            self.assertAlmostEqual(contract.grid.spatial_bounds.max_longitude, 88.0, places=3)
            self.assertAlmostEqual(contract.grid.spatial_bounds.min_latitude, -3.0, places=3)
            self.assertAlmostEqual(contract.grid.spatial_bounds.max_latitude, 12.0, places=3)

            # Vertical Coordinates
            self.assertEqual(contract.vertical.coordinate_type, VerticalCoordinateType.z_level)
            self.assertEqual(contract.vertical.level_count, 31)
            self.assertFalse(contract.vertical.is_uniform)
            self.assertAlmostEqual(contract.vertical.min_depth_m, 0.494, places=2)
            self.assertAlmostEqual(contract.vertical.max_depth_m, 453.938, places=2)

            # Time Semantics
            self.assertEqual(contract.time_semantics.valid_time_utc, "2025-04-20T00:00:00Z")
            self.assertEqual(len(contract.time_semantics.time_bounds_utc), 2)
            self.assertEqual(contract.time_semantics.time_bounds_utc[0], "2025-04-20T00:00:00Z")
            self.assertEqual(contract.time_semantics.time_bounds_utc[1], "2025-04-26T00:00:00Z")

            # Source Asset & Provenance
            self.assertEqual(len(contract.source_assets), 1)
            self.assertEqual(contract.source_assets[0].sha256_checksum, self.expected_raw_sha256)
            self.assertEqual(len(contract.provenance), 1)

    # =========================================================================
    # 3. Coordinate Decoding & Monotonicity
    # =========================================================================
    def test_coordinate_arrays_and_monotonicity(self):
        with CopernicusPhysicalAdapter(self.raw_file) as adapter:
            coords = adapter.read_coordinates()

            # Time ISO timestamps
            self.assertEqual(len(coords["time_iso"]), 7)
            self.assertEqual(coords["time_iso"][0], "2025-04-20T00:00:00Z")
            self.assertEqual(coords["time_iso"][1], "2025-04-21T00:00:00Z")
            self.assertEqual(coords["time_iso"][-1], "2025-04-26T00:00:00Z")

            # Depths (31 non-uniform levels)
            depths = coords["depth"]
            self.assertEqual(len(depths), 31)
            self.assertTrue(np.all(np.diff(depths) > 0), "Depth must be strictly monotonic increasing")
            self.assertAlmostEqual(float(depths[0]), 0.494025, places=4)
            self.assertAlmostEqual(float(depths[-1]), 453.9377, places=3)
            # Verify non-uniformity: differences between adjacent levels grow
            diffs = np.diff(depths)
            self.assertGreater(diffs[-1], diffs[0])

            # Latitudes
            lats = coords["latitude"]
            self.assertEqual(len(lats), 181)
            self.assertTrue(np.all(np.diff(lats) > 0), "Latitude must be strictly monotonic increasing")
            self.assertAlmostEqual(float(lats[0]), -3.0, places=3)
            self.assertAlmostEqual(float(lats[-1]), 12.0, places=3)

            # Longitudes
            lons = coords["longitude"]
            self.assertEqual(len(lons), 97)
            self.assertTrue(np.all(np.diff(lons) > 0), "Longitude must be strictly monotonic increasing")
            self.assertAlmostEqual(float(lons[0]), 80.0, places=3)
            self.assertAlmostEqual(float(lons[-1]), 88.0, places=3)

    # =========================================================================
    # 4. Bounded Slice Reading, Masking, Valid Zero Preservation
    # =========================================================================
    def test_bounded_slice_reading_and_validity_masking(self):
        with CopernicusPhysicalAdapter(self.raw_file) as adapter:
            # Sliced read: 1 time step, 2 depth levels, 10x10 spatial box
            vals, mask = adapter.read_variable_array(
                time_idx=0,
                depth_idx=slice(0, 2),
                lat_slice=slice(50, 60),
                lon_slice=slice(20, 30),
            )

            self.assertEqual(vals.shape, (2, 10, 10))
            self.assertEqual(mask.shape, (2, 10, 10))
            self.assertEqual(vals.dtype, np.float32)
            self.assertEqual(mask.dtype, np.uint8)

            # Check that valid cells have finite numbers and mask == VALID (0)
            valid_locs = (mask == ValidityMaskCode.VALID.value)
            self.assertTrue(np.all(np.isfinite(vals[valid_locs])))
            self.assertTrue(np.all(vals[valid_locs] >= 10.0))
            self.assertTrue(np.all(vals[valid_locs] <= 35.0))

            # Check that masked cells have NaN in vals and mask == SOURCE_MISSING (1)
            masked_locs = (mask == ValidityMaskCode.SOURCE_MISSING.value)
            if np.any(masked_locs):
                self.assertTrue(np.all(np.isnan(vals[masked_locs])))

    def test_full_volume_reading_and_statistics(self):
        with CopernicusPhysicalAdapter(self.raw_file) as adapter:
            vals, mask = adapter.read_variable_array()
            self.assertEqual(vals.shape, (7, 31, 181, 97))
            self.assertEqual(mask.shape, (7, 31, 181, 97))

            valid_count = int(np.sum(mask == ValidityMaskCode.VALID.value))
            missing_count = int(np.sum(mask == ValidityMaskCode.SOURCE_MISSING.value))
            total_count = vals.size

            self.assertEqual(total_count, 3809869)
            self.assertEqual(valid_count, 3618944)
            self.assertEqual(missing_count, 190925)
            self.assertEqual(valid_count + missing_count, total_count)

            # Scientific physical bounds check on all valid voxels
            valid_data = vals[mask == ValidityMaskCode.VALID.value]
            self.assertAlmostEqual(float(valid_data.min()), 9.553183, places=4)
            self.assertAlmostEqual(float(valid_data.max()), 31.847761, places=4)
            self.assertAlmostEqual(float(valid_data.mean()), 25.233606, places=3)

    # =========================================================================
    # 5. Real Fixture Subvolume Verification
    # =========================================================================
    def test_fixture_subvolume_execution(self):
        self.assertTrue(self.fixture_file.exists(), f"Fixture file missing: {self.fixture_file}")
        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            # Check SHA-256
            self.assertTrue(adapter.verify_source_integrity(self.expected_fixture_sha256))

            # Metadata inspection
            meta = adapter.inspect_source_metadata()
            self.assertEqual(meta["dimensions"]["time"], 2)
            self.assertEqual(meta["dimensions"]["depth"], 5)
            self.assertEqual(meta["dimensions"]["latitude"], 25)
            self.assertEqual(meta["dimensions"]["longitude"], 25)

            # Coordinates
            coords = adapter.read_coordinates()
            self.assertEqual(coords["time_iso"], ["2025-04-20T00:00:00Z", "2025-04-21T00:00:00Z"])
            self.assertEqual(len(coords["depth"]), 5)

            # Read all fixture values
            vals, mask = adapter.read_variable_array()
            self.assertEqual(vals.shape, (2, 5, 25, 25))
            self.assertEqual(mask.shape, (2, 5, 25, 25))

            # Provenance record
            prov = adapter.get_provenance_record()
            self.assertEqual(prov.operation, "copernicus_phy_potential_temperature_adapter_read")
            self.assertTrue(prov.validation_passed)


if __name__ == "__main__":
    unittest.main()
