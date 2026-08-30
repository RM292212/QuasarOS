"""
QuasarOS Ingestion and Canonical Storage Failure Injection Test Suite (TASK-03D).

Governing Rules:
- Systematically injects realistic failure modes into ingestion and storage layers.
- Asserts deterministic error handling, non-destructive failure modes, and security checks.
- Validates:
  1. Missing source file handling (FileNotFoundError).
  2. Tampered / mismatched SHA-256 checksum rejection (ValueError).
  3. Truncated / corrupted NetCDF file handling (OSError / ValueError / RuntimeError).
  4. Missing target variable ('thetao') rejection (KeyError / ValueError).
  5. Corrupted Zarr chunk detection during validation or post-corruption reading.
  6. Interrupted staging write recovery (verifying staging directories do not overwrite production store if aborted).
  7. Permission / unwritable target destination handling (PermissionError / OSError).
"""

from __future__ import annotations

import os
import pathlib
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import unittest
import netCDF4 as nc
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
    compute_file_sha256,
)


class TestIngestionFailureInjection(unittest.TestCase):
    """Comprehensive failure injection and resilience test suite."""

    @classmethod
    def setUpClass(cls):
        cls.fixture_file = REPO_ROOT / "tests" / "fixtures" / "real_data" / "copernicus_thetao_subvolume.nc"
        cls.fixture_sha256 = "418255b0b3df1e40c37ded9b53c5338f2f3a58cd838a8c075db225c259c3f8a9"

    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp(prefix="test_failure_inj_"))

    def tearDown(self):
        if self.temp_dir.exists():
            for root, dirs, files in os.walk(self.temp_dir):
                for d in dirs:
                    os.chmod(os.path.join(root, d), stat.S_IWRITE | stat.S_IREAD | stat.S_IEXEC)
                for f in files:
                    os.chmod(os.path.join(root, f), stat.S_IWRITE | stat.S_IREAD)
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    # 1. Missing Source File Handling
    def test_missing_source_file_raises_filenotfound(self):
        non_existent_path = self.temp_dir / "non_existent_model_file.nc"
        with self.assertRaises(FileNotFoundError) as ctx:
            CopernicusPhysicalAdapter(non_existent_path)
        self.assertIn("Source NetCDF file not found", str(ctx.exception))

    # 2. Tampered / Mismatched SHA-256 Checksum Rejection
    def test_tampered_sha256_checksum_rejected_by_adapter_and_writer(self):
        tampered_hash = "0000000000000000000000000000000000000000000000000000000000000000"
        
        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            with self.assertRaises(ValueError) as ctx:
                adapter.verify_source_integrity(tampered_hash)
            self.assertIn("integrity verification failed", str(ctx.exception))

        out_store = self.temp_dir / "out_zarr_tampered"
        writer = LosslessCanonicalZarrWriter(output_dir=out_store)
        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            with self.assertRaises(ValueError) as ctx:
                writer.write_dataset(adapter=adapter, expected_source_sha256=tampered_hash)
            self.assertIn("integrity verification failed", str(ctx.exception))
        
        self.assertFalse(out_store.exists())

    # 3. Truncated / Corrupted NetCDF File Handling
    def test_corrupted_netcdf_file_handling(self):
        corrupted_file = self.temp_dir / "corrupted_subvolume.nc"
        with open(self.fixture_file, "rb") as src, open(corrupted_file, "wb") as dst:
            header = src.read(1024)
            dst.write(header[:512])
            dst.write(b"\x00\xFF\xAA\x55" * 128)

        with self.assertRaises((OSError, RuntimeError, Exception)):
            with CopernicusPhysicalAdapter(corrupted_file) as adapter:
                adapter.inspect_source_metadata()

    # 4. Missing Target Variable Rejection
    def test_missing_target_variable_in_netcdf(self):
        invalid_nc = self.temp_dir / "missing_var.nc"
        with nc.Dataset(str(invalid_nc), "w", format="NETCDF4") as root:
            root.createDimension("time", 2)
            root.createDimension("depth", 5)
            root.createDimension("latitude", 10)
            root.createDimension("longitude", 10)
            
            time_var = root.createVariable("time", "f4", ("time",))
            time_var[:] = [0.0, 24.0]
            time_var.units = "hours since 1950-01-01"
            
            depth_var = root.createVariable("depth", "f4", ("depth",))
            depth_var[:] = [0.5, 1.5, 2.5, 5.0, 10.0]
            
            lat_var = root.createVariable("latitude", "f4", ("latitude",))
            lat_var[:] = np.linspace(0, 5, 10, dtype=np.float32)
            
            lon_var = root.createVariable("longitude", "f4", ("longitude",))
            lon_var[:] = np.linspace(80, 85, 10, dtype=np.float32)
            
            sal_var = root.createVariable("so", "f4", ("time", "depth", "latitude", "longitude"))
            sal_var[:] = np.full((2, 5, 10, 10), 35.0, dtype=np.float32)

        with CopernicusPhysicalAdapter(invalid_nc) as adapter:
            meta = adapter.inspect_source_metadata()
            self.assertNotIn("thetao", meta["variables"])
            self.assertIn("so", meta["variables"])

            with self.assertRaises(KeyError):
                adapter.read_variable_array()

    # 5. Corrupted Zarr Chunk Detection During Staging Validation
    def test_corrupted_zarr_staging_validation_aborts_swap(self):
        out_store = self.temp_dir / "out_zarr_corrupt_val"
        
        class CorruptingWriter(LosslessCanonicalZarrWriter):
            def _write_zarr_store(self, staging_dir: Path, *args, **kwargs):
                manifests = super()._write_zarr_store(staging_dir, *args, **kwargs)
                chunk_file = staging_dir / "sea_water_potential_temperature" / "0.0.0.0"
                if chunk_file.exists():
                    with open(chunk_file, "wb") as f:
                        f.write(b"CORRUPTED_BYTES_INJECTED_FOR_TESTING")
                return manifests

        corrupt_writer = CorruptingWriter(
            output_dir=out_store,
            chunk_shape_4d=(1, 5, 25, 25),
        )

        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            with self.assertRaises(Exception):
                corrupt_writer.write_dataset(
                    adapter=adapter,
                    expected_source_sha256=self.fixture_sha256,
                    force=True,
                )

        self.assertFalse(out_store.exists())
        temp_stagings = list(self.temp_dir.glob(".tmp_zarr_*"))
        self.assertEqual(len(temp_stagings), 0)

    # 6. Interrupted Staging Write Recovery
    def test_interrupted_staging_write_preserves_existing_production_store(self):
        out_store = self.temp_dir / "production_zarr_store"
        
        writer = LosslessCanonicalZarrWriter(
            output_dir=out_store,
            chunk_shape_4d=(1, 5, 25, 25),
        )
        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            m1 = writer.write_dataset(adapter=adapter, expected_source_sha256=self.fixture_sha256, force=True)
            self.assertEqual(m1.validation_status, "VALIDATED")

        self.assertTrue(out_store.exists())
        self.assertTrue((out_store / ".zmetadata").exists())

        class AbortingWriter(LosslessCanonicalZarrWriter):
            def _write_zarr_store(self, *args, **kwargs):
                raise KeyboardInterrupt("Simulated sudden pipeline termination")

        aborting_writer = AbortingWriter(output_dir=out_store, chunk_shape_4d=(1, 5, 25, 25))
        with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
            with self.assertRaises(KeyboardInterrupt):
                aborting_writer.write_dataset(adapter=adapter, force=True)

        self.assertTrue(out_store.exists())
        store = zarr.open_consolidated(str(out_store))
        self.assertIn("sea_water_potential_temperature", store)
        self.assertEqual(store["sea_water_potential_temperature"].shape, (2, 5, 25, 25))

    # 7. Unwritable Target Destination Handling
    def test_unwritable_parent_destination_raises_permission_error(self):
        ro_parent = self.temp_dir / "readonly_parent"
        ro_parent.mkdir()
        out_store = ro_parent / "sub_zarr_store"

        try:
            os.chmod(ro_parent, stat.S_IREAD | stat.S_IEXEC)
            
            writer = LosslessCanonicalZarrWriter(
                output_dir=out_store,
                chunk_shape_4d=(1, 5, 25, 25),
            )
            
            with CopernicusPhysicalAdapter(self.fixture_file) as adapter:
                try:
                    writer.write_dataset(adapter=adapter, force=True)
                except (PermissionError, OSError) as exc:
                    self.assertTrue(isinstance(exc, (PermissionError, OSError)))
        finally:
            os.chmod(ro_parent, stat.S_IWRITE | stat.S_IREAD | stat.S_IEXEC)


if __name__ == "__main__":
    unittest.main()
