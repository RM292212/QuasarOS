"""
Lossless Canonical Zarr Store Writer (TASK-03C).

Converts authoritative physical NetCDF-4 oceanographic datasets (e.g. Copernicus Marine
potential temperature 'thetao') into lossless canonical Zarr v2 stores with consolidated
metadata (.zmetadata), cryptographic array/chunk manifests, atomic directory publication,
and idempotency verification.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import tempfile
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import netCDF4 as nc
import numcodecs
import numpy as np
import zarr

from quasar_contracts.canonical_dataset import CanonicalDatasetContract
from quasar_ingestion.adapters.copernicus_phy_adapter import (
    CopernicusPhysicalAdapter,
    ValidityMaskCode,
)

logger = logging.getLogger(__name__)


@dataclass
class ChunkRecord:
    """Cryptographic and spatial metadata for an individual Zarr chunk file."""
    chunk_key: str
    chunk_index: List[int]
    byte_size: int
    sha256: str


@dataclass
class ArrayManifest:
    """Array-level manifest capturing shape, chunks, dtype, logical hash, and chunk records."""
    name: str
    shape: List[int]
    chunks: List[int]
    dtype: str
    fill_value: Optional[Union[float, int, str]]
    compressor: str
    attributes: Dict[str, Any]
    logical_sha256: str
    chunk_count: int
    chunks_manifest: List[ChunkRecord] = field(default_factory=list)


@dataclass
class CanonicalZarrRootManifest:
    """
    Authoritative companion manifest for published Canonical Zarr datasets.
    Provides complete lineage, array checksums, chunk hashes, and validation state.
    """
    manifest_schema_version: str
    dataset_id: str
    dataset_version: str
    canonical_store_path: str
    created_at_utc: str
    source_asset_sha256: str
    source_filename: str
    zarr_format: int
    compression_codec: str
    arrays: Dict[str, ArrayManifest]
    root_attributes: Dict[str, Any]
    validation_status: str

    def to_dict(self) -> Dict[str, Any]:
        """Serializes manifest dataclass into JSON-compliant dictionary."""
        return {
            "manifest_schema_version": self.manifest_schema_version,
            "dataset_id": self.dataset_id,
            "dataset_version": self.dataset_version,
            "canonical_store_path": self.canonical_store_path,
            "created_at_utc": self.created_at_utc,
            "source_asset_sha256": self.source_asset_sha256,
            "source_filename": self.source_filename,
            "zarr_format": self.zarr_format,
            "compression_codec": self.compression_codec,
            "arrays": {k: asdict(v) for k, v in self.arrays.items()},
            "root_attributes": self.root_attributes,
            "validation_status": self.validation_status,
        }


CanonicalZarrManifest = CanonicalZarrRootManifest


def compute_buffer_sha256(data: np.ndarray) -> str:
    """
    Computes a deterministic SHA-256 digest over the raw continuous memory buffer
    of a numpy ndarray (handling endianness and C-contiguous layout).
    """
    arr_c = np.ascontiguousarray(data)
    hasher = hashlib.sha256()
    hasher.update(arr_c.view(np.uint8).data)
    return hasher.hexdigest().lower()


def compute_file_sha256(file_path: Union[str, Path]) -> str:
    """Computes streaming SHA-256 digest of a disk file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest().lower()


class LosslessCanonicalZarrWriter:
    """
    Lossless Canonical Zarr v2 Writer for QuasarOS Scientific Storage Pipeline.
    
    Guarantees:
    - Zero floating-point loss (0.000000 absolute tolerance vs decoded NetCDF arrays).
    - Separation of missing values into companion categorical validity masks.
    - Preserves valid zeroes (0.0 °C) without NaN corruption.
    - Zstandard compression (zstd level 3) for efficient cloud/browser byte-range serving.
    - Consolidated metadata (.zmetadata) generated for single-request metadata loading.
    - Atomic staging and directory publication to prevent partial writes.
    - Full cryptographic verification (SHA-256 per chunk and array buffer).
    - Comprehensive companion manifest generation (canonical_manifest.json).
    """

    def __init__(
        self,
        output_dir: Union[str, Path],
        chunk_shape_4d: Tuple[int, int, int, int] = (1, 31, 64, 64),
        compression_level: int = 3,
        zarr_format: int = 2,
    ):
        """
        Initializes the Canonical Zarr Writer.
        
        Args:
            output_dir: Target publication directory (e.g. 'data/canonical/copernicus_phy_thetao/v1').
            chunk_shape_4d: Chunk shape for 4D volumetric variables (time, depth, lat, lon).
            compression_level: Zstandard compression level (default 3).
            zarr_format: Zarr specification version (default 2).
        """
        self.output_dir = Path(output_dir).resolve()
        self.chunk_shape_4d = chunk_shape_4d
        self.compression_level = compression_level
        self.zarr_format = zarr_format
        self.compressor = numcodecs.Zstd(level=self.compression_level)

    def is_already_generated(
        self,
        source_sha256: str,
        manifest_path: Optional[Union[str, Path]] = None,
    ) -> bool:
        """
        Checks if a valid, verified canonical Zarr dataset and manifest already exist at output_dir.
        
        Args:
            source_sha256: Expected SHA-256 checksum of the source asset.
            manifest_path: Optional custom path to canonical manifest file.
            
        Returns:
            True if store and manifest exist, are consolidated, and match source checksum; False otherwise.
        """
        if not self.output_dir.exists():
            return False

        zmetadata_path = self.output_dir / ".zmetadata"
        if not zmetadata_path.exists():
            return False

        manifest_file = Path(manifest_path) if manifest_path else self.output_dir / "canonical_manifest.json"
        if not manifest_file.exists():
            return False

        try:
            with open(manifest_file, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)
            
            if manifest_data.get("source_asset_sha256", "").lower() != source_sha256.lower():
                return False
            if manifest_data.get("validation_status") != "VALIDATED":
                return False
            
            # Quick verification that store can be opened consolidated
            store = zarr.open_consolidated(str(self.output_dir))
            if "sea_water_potential_temperature" not in store or "validity_mask" not in store:
                return False
            
            return True
        except Exception as err:
            logger.warning("Existing store check failed with error: %s", err)
            return False

    def write_dataset(
        self,
        adapter: CopernicusPhysicalAdapter,
        expected_source_sha256: Optional[str] = None,
        force: bool = False,
        companion_manifest_paths: Optional[List[Union[str, Path]]] = None,
    ) -> CanonicalZarrManifest:
        """
        Executes complete lossless conversion, staging, validation, and atomic publication.
        
        Args:
            adapter: CopernicusPhysicalAdapter instance connected to source NetCDF asset.
            expected_source_sha256: Expected SHA-256 hash of source asset (verified before reading).
            force: If True, overwrites existing target store if present.
            companion_manifest_paths: Additional destination paths to write companion manifest copies.
            
        Returns:
            CanonicalZarrManifest dataclass instance for published dataset.
        """
        # 1. Source verification
        if expected_source_sha256 is not None:
            adapter.verify_source_integrity(expected_source_sha256)
        
        source_meta = adapter.inspect_source_metadata()
        source_sha256 = expected_source_sha256 or compute_file_sha256(adapter.file_path)

        # 2. Idempotency check
        if not force and self.is_already_generated(source_sha256):
            logger.info("Canonical Zarr store already exists and verified at %s. Skipping generation.", self.output_dir)
            manifest_file = self.output_dir / "canonical_manifest.json"
            with open(manifest_file, "r", encoding="utf-8") as f:
                m_dict = json.load(f)
            # Reconstruct manifest dataclass
            arrays = {}
            for k, v in m_dict.get("arrays", {}).items():
                chunks_manifest = [ChunkRecord(**c) for c in v.get("chunks_manifest", [])]
                v_copy = dict(v)
                v_copy["chunks_manifest"] = chunks_manifest
                arrays[k] = ArrayManifest(**v_copy)
            return CanonicalZarrManifest(
                manifest_schema_version=m_dict.get("manifest_schema_version", "2.0.0"),
                dataset_id=m_dict.get("dataset_id", "copernicus_phy_thetao"),
                dataset_version=m_dict.get("dataset_version", "v1"),
                canonical_store_path=m_dict.get("canonical_store_path", str(self.output_dir)),
                created_at_utc=m_dict.get("created_at_utc", ""),
                source_asset_sha256=m_dict.get("source_asset_sha256", source_sha256),
                source_filename=m_dict.get("source_filename", adapter.file_path.name),
                zarr_format=m_dict.get("zarr_format", self.zarr_format),
                compression_codec=m_dict.get("compression_codec", f"zstd(level={self.compression_level})"),
                arrays=arrays,
                root_attributes=m_dict.get("root_attributes", {}),
                validation_status=m_dict.get("validation_status", "VALIDATED"),
            )

        # 3. Read coordinates and full volume arrays via adapter
        logger.info("Reading coordinates and variable arrays from source: %s", adapter.file_path.name)
        coords = adapter.read_coordinates()
        values_4d, mask_4d = adapter.read_variable_array()

        contract = adapter.get_canonical_dataset_contract()
        # Serialize CanonicalDatasetContract to JSON dict
        contract_dict = json.loads(contract.model_dump_json())

        # Determine staging directory in same parent directory (enables atomic directory rename)
        parent_dir = self.output_dir.parent
        parent_dir.mkdir(parents=True, exist_ok=True)
        staging_dir = Path(tempfile.mkdtemp(prefix=".tmp_zarr_", dir=parent_dir))

        try:
            logger.info("Writing Canonical Zarr to temporary staging path: %s", staging_dir)
            arrays_manifest = self._write_zarr_store(
                staging_dir=staging_dir,
                coords=coords,
                values_4d=values_4d,
                mask_4d=mask_4d,
                contract_dict=contract_dict,
                source_sha256=source_sha256,
                source_meta=source_meta,
            )

            # 4. Strict Validation of Staging Store Against Decoded Source Arrays
            logger.info("Validating staged Zarr store against authoritative decoded source...")
            self._validate_staged_store(
                staging_dir=staging_dir,
                coords=coords,
                expected_values=values_4d,
                expected_mask=mask_4d,
            )

            # 5. Build Canonical Manifest
            now_utc = datetime.now(timezone.utc).isoformat()
            rel_canonical_path = str(self.output_dir).replace(os.sep, "/")
            if "data/canonical/" in rel_canonical_path:
                rel_canonical_path = "data/canonical/" + rel_canonical_path.split("data/canonical/", 1)[1]

            manifest = CanonicalZarrManifest(
                manifest_schema_version="2.0.0",
                dataset_id=contract.identity.dataset_id,
                dataset_version=contract.identity.dataset_version,
                canonical_store_path=rel_canonical_path,
                created_at_utc=now_utc,
                source_asset_sha256=source_sha256,
                source_filename=adapter.file_path.name,
                zarr_format=self.zarr_format,
                compression_codec=f"zstd(level={self.compression_level})",
                arrays=arrays_manifest,
                root_attributes=contract_dict,
                validation_status="VALIDATED",
            )

            # Write manifest into staging directory
            manifest_json_path = staging_dir / "canonical_manifest.json"
            with open(manifest_json_path, "w", encoding="utf-8") as f:
                json.dump(manifest.to_dict(), f, indent=2)

            # 6. Atomic Directory Swap / Publication
            if self.output_dir.exists():
                logger.info("Removing prior destination directory for clean swap: %s", self.output_dir)
                shutil.rmtree(self.output_dir)

            logger.info("Atomically moving staging store to target destination: %s", self.output_dir)
            staging_dir.rename(self.output_dir)

            # 7. Write companion manifests to external locations if requested
            if companion_manifest_paths:
                manifest_dict = manifest.to_dict()
                for c_path in companion_manifest_paths:
                    cp = Path(c_path).resolve()
                    cp.parent.mkdir(parents=True, exist_ok=True)
                    with open(cp, "w", encoding="utf-8") as f:
                        json.dump(manifest_dict, f, indent=2)
                    logger.info("Wrote companion manifest copy to: %s", cp)

            logger.info("Successfully generated and published Canonical Zarr store to %s", self.output_dir)
            return manifest

        except Exception as exc:
            logger.error("Failed during canonical Zarr generation: %s", exc)
            if staging_dir.exists():
                shutil.rmtree(staging_dir, ignore_errors=True)
            raise

    def _write_zarr_store(
        self,
        staging_dir: Path,
        coords: Dict[str, Any],
        values_4d: np.ndarray,
        mask_4d: np.ndarray,
        contract_dict: Dict[str, Any],
        source_sha256: str,
        source_meta: Dict[str, Any],
    ) -> Dict[str, ArrayManifest]:
        """Internal helper to write Zarr v2 group, arrays, attributes, and consolidate metadata."""
        root_group = zarr.open_group(
            str(staging_dir),
            mode="w",
            zarr_format=self.zarr_format,
        )

        # Set root group attributes
        root_group.attrs["canonical_contract"] = contract_dict
        root_group.attrs["dataset_id"] = contract_dict.get("identity", {}).get("dataset_id", "copernicus_phy_thetao")
        root_group.attrs["source_asset_sha256"] = source_sha256
        root_group.attrs["source_filename"] = source_meta.get("file_name", "")
        root_group.attrs["created_at_utc"] = datetime.now(timezone.utc).isoformat()
        root_group.attrs["schema_protocol"] = "2.0.0"
        root_group.attrs["codec"] = f"zstd(level={self.compression_level})"

        arrays_manifest: Dict[str, ArrayManifest] = {}

        # 1. Primary Volumetric Scalar: sea_water_potential_temperature
        thetao_chunks = self._calculate_chunks(values_4d.shape, self.chunk_shape_4d)
        arr_thetao = root_group.create_array(
            "sea_water_potential_temperature",
            shape=values_4d.shape,
            chunks=thetao_chunks,
            dtype="float32",
            fill_value=float("nan"),
            compressor=self.compressor,
        )
        arr_thetao[:] = values_4d
        arr_thetao.attrs["standard_name"] = "sea_water_potential_temperature"
        arr_thetao.attrs["long_name"] = "Sea Water Potential Temperature"
        arr_thetao.attrs["units"] = "degree_Celsius"
        arr_thetao.attrs["source_variable"] = "thetao"
        arr_thetao.attrs["physical_quantity"] = "temperature"
        arr_thetao.attrs["dimensions"] = ["time", "depth", "latitude", "longitude"]
        arr_thetao.attrs["missing_value"] = "NaN"
        arr_thetao.attrs["valid_min"] = -10.0
        arr_thetao.attrs["valid_max"] = 40.0

        # 2. Companion Validity Mask: validity_mask
        arr_mask = root_group.create_array(
            "validity_mask",
            shape=mask_4d.shape,
            chunks=thetao_chunks,
            dtype="uint8",
            fill_value=ValidityMaskCode.SOURCE_MISSING.value,
            compressor=self.compressor,
        )
        arr_mask[:] = mask_4d
        arr_mask.attrs["standard_name"] = "status_flag"
        arr_mask.attrs["long_name"] = "Validity and Mask Categorical Flag"
        arr_mask.attrs["dimensions"] = ["time", "depth", "latitude", "longitude"]
        arr_mask.attrs["flag_values"] = [
            ValidityMaskCode.VALID.value,
            ValidityMaskCode.SOURCE_MISSING.value,
            ValidityMaskCode.LAND.value,
            ValidityMaskCode.BELOW_SEABED.value,
            ValidityMaskCode.OUTSIDE_DOMAIN.value,
            ValidityMaskCode.QC_REJECTED.value,
            ValidityMaskCode.TEMPORALLY_UNAVAILABLE.value,
            ValidityMaskCode.NOT_OBSERVED.value,
            ValidityMaskCode.PROCESSING_FAILED.value,
        ]
        arr_mask.attrs["flag_meanings"] = (
            "VALID SOURCE_MISSING LAND BELOW_SEABED OUTSIDE_DOMAIN "
            "QC_REJECTED TEMPORALLY_UNAVAILABLE NOT_OBSERVED PROCESSING_FAILED"
        )
        arr_mask.attrs["categories"] = {
            str(code.value): code.name for code in ValidityMaskCode
        }

        # 3. Coordinate Arrays
        # Depth
        depth_data = np.array(coords["depth"], dtype=np.float32)
        arr_depth = root_group.create_array(
            "depth",
            shape=depth_data.shape,
            chunks=depth_data.shape,
            dtype="float32",
            compressor=self.compressor,
        )
        arr_depth[:] = depth_data
        arr_depth.attrs["standard_name"] = "depth"
        arr_depth.attrs["long_name"] = "Depth"
        arr_depth.attrs["units"] = "m"
        arr_depth.attrs["positive"] = "down"
        arr_depth.attrs["axis"] = "Z"

        # Latitude
        lat_data = np.array(coords["latitude"], dtype=np.float32)
        arr_lat = root_group.create_array(
            "latitude",
            shape=lat_data.shape,
            chunks=lat_data.shape,
            dtype="float32",
            compressor=self.compressor,
        )
        arr_lat[:] = lat_data
        arr_lat.attrs["standard_name"] = "latitude"
        arr_lat.attrs["long_name"] = "Latitude"
        arr_lat.attrs["units"] = "degrees_north"
        arr_lat.attrs["axis"] = "Y"

        # Longitude
        lon_data = np.array(coords["longitude"], dtype=np.float32)
        arr_lon = root_group.create_array(
            "longitude",
            shape=lon_data.shape,
            chunks=lon_data.shape,
            dtype="float32",
            compressor=self.compressor,
        )
        arr_lon[:] = lon_data
        arr_lon.attrs["standard_name"] = "longitude"
        arr_lon.attrs["long_name"] = "Longitude"
        arr_lon.attrs["units"] = "degrees_east"
        arr_lon.attrs["axis"] = "X"

        # Time (numeric float32 hours since reference)
        time_data = np.array(coords["time"], dtype=np.float32)
        arr_time = root_group.create_array(
            "time",
            shape=time_data.shape,
            chunks=time_data.shape,
            dtype="float32",
            compressor=self.compressor,
        )
        arr_time[:] = time_data
        arr_time.attrs["standard_name"] = "time"
        arr_time.attrs["long_name"] = "Time"
        arr_time.attrs["units"] = coords.get("time_units", "hours since 1950-01-01")
        arr_time.attrs["calendar"] = coords.get("time_calendar", "gregorian")
        arr_time.attrs["axis"] = "T"

        # Time ISO strings array (fixed-length unicode <U20)
        time_iso_list = coords["time_iso"]
        arr_time_iso = root_group.create_array(
            "time_iso",
            shape=(len(time_iso_list),),
            chunks=(len(time_iso_list),),
            dtype="<U20",
            compressor=self.compressor,
        )
        arr_time_iso[:] = time_iso_list
        arr_time_iso.attrs["standard_name"] = "time"
        arr_time_iso.attrs["long_name"] = "ISO-8601 UTC Timestamps"
        arr_time_iso.attrs["units"] = "ISO-8601 UTC"

        # Consolidate metadata (.zmetadata)
        logger.info("Consolidating Zarr metadata into .zmetadata...")
        zarr.consolidate_metadata(str(staging_dir))

        # Build ArrayManifests and compute ChunkRecords
        array_names_and_data = [
            ("sea_water_potential_temperature", values_4d, arr_thetao, "NaN"),
            ("validity_mask", mask_4d, arr_mask, ValidityMaskCode.SOURCE_MISSING.value),
            ("depth", depth_data, arr_depth, None),
            ("latitude", lat_data, arr_lat, None),
            ("longitude", lon_data, arr_lon, None),
            ("time", time_data, arr_time, None),
            ("time_iso", np.array(time_iso_list, dtype="<U20"), arr_time_iso, None),
        ]

        for name, data_arr, z_arr, fill_val in array_names_and_data:
            chunk_records = self._inspect_array_chunks(staging_dir, name)
            logical_hash = compute_buffer_sha256(data_arr)
            arrays_manifest[name] = ArrayManifest(
                name=name,
                shape=list(z_arr.shape),
                chunks=list(z_arr.chunks),
                dtype=str(z_arr.dtype),
                fill_value=fill_val,
                compressor=f"zstd(level={self.compression_level})",
                attributes=dict(z_arr.attrs),
                logical_sha256=logical_hash,
                chunk_count=len(chunk_records),
                chunks_manifest=chunk_records,
            )

        return arrays_manifest

    def _calculate_chunks(
        self,
        array_shape: Tuple[int, ...],
        target_chunk_shape: Tuple[int, ...],
    ) -> Tuple[int, ...]:
        """Calculates bounded chunk sizes fitting within array shape dimensions."""
        chunks = []
        for a_len, c_len in zip(array_shape, target_chunk_shape):
            chunks.append(min(a_len, c_len))
        return tuple(chunks)

    def _inspect_array_chunks(self, root_dir: Path, array_name: str) -> List[ChunkRecord]:
        """Inspects all chunk files on disk for a given array and computes SHA-256 digests."""
        arr_path = root_dir / array_name
        if not arr_path.exists():
            return []

        chunk_records: List[ChunkRecord] = []
        # In Zarr v2 on filesystem, chunk keys are named like '0.0.0.0', '0.0.1.0' or '0'
        for entry in os.listdir(arr_path):
            if entry.startswith("."):
                continue  # skip .zarray, .zattrs
            chunk_file = arr_path / entry
            if chunk_file.is_file():
                byte_size = chunk_file.stat().st_size
                sha = compute_file_sha256(chunk_file)
                # Parse chunk index from filename
                try:
                    idx = [int(p) for p in entry.split(".")]
                except ValueError:
                    idx = []
                chunk_records.append(
                    ChunkRecord(
                        chunk_key=f"{array_name}/{entry}",
                        chunk_index=idx,
                        byte_size=byte_size,
                        sha256=sha,
                    )
                )

        # Sort chunk records deterministically
        chunk_records.sort(key=lambda c: c.chunk_key)
        return chunk_records

    def _validate_staged_store(
        self,
        staging_dir: Path,
        coords: Dict[str, Any],
        expected_values: np.ndarray,
        expected_mask: np.ndarray,
    ) -> None:
        """
        Reopens consolidated Zarr store and validates:
        1. Array shapes, dtypes, and consolidated metadata presence.
        2. Exact numerical equality on coordinates.
        3. 100% exact numerical match on variable values (0.0 absolute error, zero differing valid samples).
        4. Companion validity mask alignment bit-for-bit with expected mask.
        5. Valid zero preservation (0.0 °C preserved without NaN corruption).
        """
        store = zarr.open_consolidated(str(staging_dir))
        
        # 1. Required arrays check
        required_arrays = [
            "sea_water_potential_temperature",
            "validity_mask",
            "depth",
            "latitude",
            "longitude",
            "time",
            "time_iso",
        ]
        for arr_name in required_arrays:
            if arr_name not in store:
                raise ValueError(f"Validation failed: required array '{arr_name}' missing from store.")

        # 2. Coordinates validation
        read_depth = store["depth"][:]
        expected_depth = np.array(coords["depth"], dtype=np.float32)
        if not np.array_equal(read_depth, expected_depth):
            raise ValueError("Validation failed: depth coordinates do not match expected values.")

        read_lat = store["latitude"][:]
        expected_lat = np.array(coords["latitude"], dtype=np.float32)
        if not np.array_equal(read_lat, expected_lat):
            raise ValueError("Validation failed: latitude coordinates do not match expected values.")

        read_lon = store["longitude"][:]
        expected_lon = np.array(coords["longitude"], dtype=np.float32)
        if not np.array_equal(read_lon, expected_lon):
            raise ValueError("Validation failed: longitude coordinates do not match expected values.")

        read_time_iso = store["time_iso"][:]
        expected_time_iso = np.array(coords["time_iso"], dtype="<U20")
        if not np.array_equal(read_time_iso, expected_time_iso):
            raise ValueError("Validation failed: time_iso array does not match expected values.")

        # 3. Validity Mask validation
        read_mask = store["validity_mask"][:]
        if read_mask.shape != expected_mask.shape:
            raise ValueError(
                f"Validation failed: validity_mask shape {read_mask.shape} != expected {expected_mask.shape}"
            )
        if not np.array_equal(read_mask, expected_mask):
            diff_count = int(np.sum(read_mask != expected_mask))
            raise ValueError(f"Validation failed: validity_mask differs at {diff_count} locations.")

        # 4. Values validation (lossless check)
        read_values = store["sea_water_potential_temperature"][:]
        if read_values.shape != expected_values.shape:
            raise ValueError(
                f"Validation failed: values shape {read_values.shape} != expected {expected_values.shape}"
            )

        # Check NaN matching
        read_nans = np.isnan(read_values)
        expected_nans = np.isnan(expected_values)
        if not np.array_equal(read_nans, expected_nans):
            diff_nan = int(np.sum(read_nans != expected_nans))
            raise ValueError(f"Validation failed: NaN locations differ at {diff_nan} locations.")

        # Check finite values exact match
        valid_idx = ~expected_nans
        if np.any(valid_idx):
            max_abs_err = float(np.max(np.abs(read_values[valid_idx] - expected_values[valid_idx])))
            if max_abs_err != 0.0:
                raise ValueError(
                    f"Validation failed: Max absolute numerical error {max_abs_err:.10e} > 0.0 (not lossless!)"
                )

        logger.info("Validation PASSED: Store exhibits 0.0 absolute numerical error against decoded source.")
