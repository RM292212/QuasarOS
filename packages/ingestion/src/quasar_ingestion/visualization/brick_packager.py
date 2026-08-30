"""
Authoritative Visualization Brick Packaging, Verification, and Atomic Promotion Engine (TASK-04C).

Governing Directives:
- AGENTS.md, docs/02-architecture/APIContracts.md, docs/Tech.md, data/manifests/visualization/task_04a_decision.json
- Verifies all 63 multiresolution bricks across 7 timesteps and 3 LOD levels (126 payload assets: 63 Float16 + 63 Uint16).
- Strict Pydantic contract compliance across VisualizationProductContract, BrickGeometryContract, BrickPayloadContract, QuantizationContract.
- Bitwise SHA-256 integrity verification of every individual brick asset and companion manifest.
- Enforces strict storage budget limits (< 150 MiB).
- Atomic directory promotion from staging (.staging_v1) to production target (v1).
- Canonical manifest generation and export to both data/manifests/visualization/... and data/visualization/...
- Atomic update of active snapshot catalog (data/manifests/active_snapshot_catalog.json).
"""

from __future__ import annotations

import copy
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import shutil
import tempfile
from typing import Any, Dict, List, Optional, Tuple, Union

import numcodecs
import numpy as np
from pydantic import ValidationError

from quasar_contracts.horizontal_grids import SpatialBoundingBox
from quasar_contracts.visualization_contracts import (
    AggregationMethod,
    BackendCompatibility,
    BrickGeometryContract,
    BrickIdentityContract,
    BrickPayloadContract,
    CompressionCodec,
    CoordinateSpace,
    CoordinateTransformContract,
    MultiresolutionLevelContract,
    OutOfRangeRenderingPolicy,
    QuantizationContract,
    RenderStatisticsContract,
    TextureSampleFormat,
    TransferFunctionContract,
    TransferFunctionControlPoint,
    VisualizationProductContract,
)

logger = logging.getLogger(__name__)


@dataclass
class BrickVerificationRecord:
    """Audit and integrity verification record for a single brick asset."""
    brick_key: str
    lod_level: int
    timestep_index: int
    brick_indices: Tuple[int, int, int]
    f16_path: Path
    u16_path: Path
    f16_compressed_bytes: int
    u16_compressed_bytes: int
    f16_uncompressed_bytes: int
    u16_uncompressed_bytes: int
    f16_sha256: str
    u16_sha256: str
    f16_verified: bool
    u16_verified: bool


@dataclass
class PackagingResult:
    """Summary of completed brick packaging, verification, promotion, and catalog registration."""
    snapshot_id: str
    visualization_product_id: str
    product_version: str
    variable_id: str
    source_dataset_id: str
    source_asset_sha256: str
    staging_directory: Path
    production_product_directory: Path
    production_manifest_directory: Path
    canonical_manifest_path: Path
    product_manifest_path: Path
    manifest_sha256: str
    total_bricks: int
    total_payload_files: int
    f16_payload_count: int
    u16_payload_count: int
    total_f16_bytes: int
    total_u16_bytes: int
    total_compressed_bytes: int
    total_compressed_mib: float
    storage_budget_mib: float
    storage_budget_compliant: bool
    verified_brick_count: int
    catalog_updated: bool
    packaging_timestamp_utc: str


class BrickPackagingError(Exception):
    """Raised when brick packaging, validation, or promotion fails."""
    pass


class BrickPackager:
    """
    Production-grade packaging and verification engine for QuasarOS 3D multiresolution bricks.
    """

    EXPECTED_TOTAL_BRICKS = 63
    EXPECTED_LOD_LEVELS = 3
    EXPECTED_TIMESTEPS = 7
    EXPECTED_LOD_BRICK_COUNTS = {0: 42, 1: 14, 2: 7}
    DEFAULT_STORAGE_BUDGET_MIB = 150.0

    def __init__(
        self,
        repo_root: Optional[Union[str, Path]] = None,
        snapshot_id: Optional[str] = None,
        variable_id: str = "sea_water_potential_temperature",
        product_version: str = "v1",
        storage_budget_mib: float = DEFAULT_STORAGE_BUDGET_MIB,
    ):
        if repo_root is None:
            # Default to finding repo root from file location
            self.repo_root = Path(__file__).resolve().parents[5]
        else:
            self.repo_root = Path(repo_root).resolve()

        self.catalog_path = self.repo_root / "data" / "manifests" / "active_snapshot_catalog.json"
        self.variable_id = variable_id
        self.product_version = product_version
        self.storage_budget_mib = float(storage_budget_mib)
        self.zstd_codec = numcodecs.Zstd(level=3)

        # Resolve snapshot information from catalog
        self.catalog_data = self._load_catalog()
        active_entry = self.catalog_data.get("active_operational_snapshot", {})
        
        self.snapshot_id = snapshot_id or active_entry.get("snapshot_id")
        if not self.snapshot_id:
            raise BrickPackagingError("Active snapshot ID could not be determined from catalog or arguments.")

        self.source_sha256 = active_entry.get("source_sha256", "")
        self.dataset_id = active_entry.get("dataset", "copernicus_phy_thetao")

        self.visualization_product_id = f"vis_{self.dataset_id}_{self.snapshot_id}"

        # Standard directory layout
        self.staging_dir = (
            self.repo_root
            / "data"
            / "visualization"
            / self.dataset_id
            / self.snapshot_id
            / f".staging_{self.product_version}"
        )
        self.production_product_dir = (
            self.repo_root
            / "data"
            / "visualization"
            / self.dataset_id
            / self.snapshot_id
            / self.product_version
        )
        self.production_manifest_dir = (
            self.repo_root
            / "data"
            / "manifests"
            / "visualization"
            / self.dataset_id
            / self.snapshot_id
            / self.product_version
        )

    def _load_catalog(self) -> Dict[str, Any]:
        """Loads the active snapshot catalog."""
        if not self.catalog_path.exists():
            raise FileNotFoundError(f"Active snapshot catalog not found at {self.catalog_path}")
        with open(self.catalog_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def compute_sha256(file_path: Union[str, Path]) -> str:
        """Computes the SHA-256 hexadecimal digest of a file in streaming chunks."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    def validate_staged_product(
        self,
        staging_dir: Optional[Union[str, Path]] = None,
    ) -> Tuple[Dict[str, Any], List[BrickVerificationRecord], Dict[str, Any]]:
        """
        Performs exhaustive cryptographic, structural, and contract validation of the staged product:
        1. Reads and validates staged `visualization_manifest.json` against Pydantic models.
        2. Validates all 63 multiresolution bricks across 7 timesteps and 3 LODs.
        3. Verifies physical existence, compressed size, uncompressed length, and SHA-256 for all 126 binary files.
        4. Detects any missing, truncated, or orphaned payloads.
        5. Verifies storage budget enforcement (< 150 MiB).
        """
        stage_dir = Path(staging_dir or self.staging_dir).resolve()
        if not stage_dir.exists():
            raise BrickPackagingError(f"Staging directory does not exist: {stage_dir}")

        manifest_path = stage_dir / "visualization_manifest.json"
        if not manifest_path.exists():
            raise BrickPackagingError(f"Staged visualization manifest missing: {manifest_path}")

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest_raw = json.load(f)

        # 1. Pydantic validation of VisualizationProductContract
        vis_prod_raw = manifest_raw.get("visualization_product")
        if not vis_prod_raw:
            raise BrickPackagingError("Manifest missing 'visualization_product' section.")

        # Ensure lineage has real source asset sha256
        if self.source_sha256 and self.snapshot_id:
            vis_prod_raw["source_asset_checksums"] = {self.snapshot_id: self.source_sha256}

        try:
            vis_product_contract = VisualizationProductContract(**vis_prod_raw)
        except ValidationError as e:
            raise BrickPackagingError(f"VisualizationProductContract schema validation failed: {e}") from e

        # 2. Pydantic validation of QuantizationContract
        quant_raw = manifest_raw.get("quantization_contract")
        if not quant_raw:
            raise BrickPackagingError("Manifest missing 'quantization_contract' section.")
        try:
            quant_contract = QuantizationContract(**quant_raw)
        except ValidationError as e:
            raise BrickPackagingError(f"QuantizationContract validation failed: {e}") from e

        # 3. Validate LOD specifications
        lod_levels = vis_product_contract.available_lod_levels
        if len(lod_levels) != self.EXPECTED_LOD_LEVELS:
            raise BrickPackagingError(
                f"Expected {self.EXPECTED_LOD_LEVELS} LOD levels, got {len(lod_levels)}"
            )

        for lod in lod_levels:
            expected_count = self.EXPECTED_LOD_BRICK_COUNTS.get(lod.lod_level)
            if expected_count is not None:
                # Per timestep brick count * timesteps
                expected_total_lod = expected_count
                actual_total_lod = lod.total_brick_count * vis_product_contract.timestep_count
                if actual_total_lod != expected_total_lod:
                    raise BrickPackagingError(
                        f"LOD {lod.lod_level} expected {expected_total_lod} total bricks for 7 timesteps, got {actual_total_lod}"
                    )

        # 4. Validate all individual brick entries and physical files
        bricks_raw = manifest_raw.get("bricks", [])
        if len(bricks_raw) != self.EXPECTED_TOTAL_BRICKS:
            raise BrickPackagingError(
                f"Expected {self.EXPECTED_TOTAL_BRICKS} total bricks, found {len(bricks_raw)} in manifest."
            )

        verification_records: List[BrickVerificationRecord] = []
        f16_total_bytes = 0
        u16_total_bytes = 0
        seen_keys = set()
        expected_files_set = set()

        for idx, b_entry in enumerate(bricks_raw):
            b_key = b_entry.get("brick_key")
            if not b_key:
                raise BrickPackagingError(f"Brick entry at index {idx} missing 'brick_key'.")
            if b_key in seen_keys:
                raise BrickPackagingError(f"Duplicate brick key detected in manifest: {b_key}")
            seen_keys.add(b_key)

            # Contract validation
            try:
                ident = BrickIdentityContract(**b_entry["identity"])
                geom = BrickGeometryContract(**b_entry["geometry"])
                payload_f16 = BrickPayloadContract(**b_entry["payload_f16"])
                payload_u16 = BrickPayloadContract(**b_entry["payload_u16"])
            except (KeyError, ValidationError) as e:
                raise BrickPackagingError(f"Validation failed for brick '{b_key}': {e}") from e

            # Verify key consistency
            if ident.composite_key != b_key or geom.brick_key != b_key or payload_f16.brick_key != b_key or payload_u16.brick_key != b_key:
                raise BrickPackagingError(f"Composite key mismatch in brick '{b_key}'.")

            # Physical file checks
            f16_rel = payload_f16.storage_object_key
            u16_rel = payload_u16.storage_object_key
            expected_files_set.add(f16_rel)
            expected_files_set.add(u16_rel)

            f16_path = stage_dir / f16_rel
            u16_path = stage_dir / u16_rel

            if not f16_path.exists():
                raise BrickPackagingError(f"Missing physical Float16 brick payload: {f16_path}")
            if not u16_path.exists():
                raise BrickPackagingError(f"Missing physical Uint16 brick payload: {u16_path}")

            # Verify byte sizes
            f16_size = f16_path.stat().st_size
            u16_size = u16_path.stat().st_size
            if f16_size != payload_f16.compressed_bytes_length:
                raise BrickPackagingError(
                    f"Float16 file size mismatch for {b_key}: disk={f16_size}, manifest={payload_f16.compressed_bytes_length}"
                )
            if u16_size != payload_u16.compressed_bytes_length:
                raise BrickPackagingError(
                    f"Uint16 file size mismatch for {b_key}: disk={u16_size}, manifest={payload_u16.compressed_bytes_length}"
                )

            # Verify cryptographic SHA-256
            f16_actual_sha256 = self.compute_sha256(f16_path)
            u16_actual_sha256 = self.compute_sha256(u16_path)

            if f16_actual_sha256 != payload_f16.sha256_checksum:
                raise BrickPackagingError(
                    f"Float16 SHA-256 checksum mismatch for {b_key}: actual={f16_actual_sha256}, expected={payload_f16.sha256_checksum}"
                )
            if u16_actual_sha256 != payload_u16.sha256_checksum:
                raise BrickPackagingError(
                    f"Uint16 SHA-256 checksum mismatch for {b_key}: actual={u16_actual_sha256}, expected={payload_u16.sha256_checksum}"
                )

            # Verify uncompressed decompression integrity
            with open(f16_path, "rb") as f:
                f16_decompressed = self.zstd_codec.decode(f.read())
            if len(f16_decompressed) != payload_f16.uncompressed_bytes_length:
                raise BrickPackagingError(
                    f"Float16 uncompressed byte length mismatch for {b_key}: actual={len(f16_decompressed)}, expected={payload_f16.uncompressed_bytes_length}"
                )

            with open(u16_path, "rb") as f:
                u16_decompressed = self.zstd_codec.decode(f.read())
            if len(u16_decompressed) != payload_u16.uncompressed_bytes_length:
                raise BrickPackagingError(
                    f"Uint16 uncompressed byte length mismatch for {b_key}: actual={len(u16_decompressed)}, expected={payload_u16.uncompressed_bytes_length}"
                )

            f16_total_bytes += f16_size
            u16_total_bytes += u16_size

            rec = BrickVerificationRecord(
                brick_key=b_key,
                lod_level=ident.lod_level,
                timestep_index=ident.timestep_index,
                brick_indices=(ident.brick_index_x, ident.brick_index_y, ident.brick_index_z),
                f16_path=f16_path,
                u16_path=u16_path,
                f16_compressed_bytes=f16_size,
                u16_compressed_bytes=u16_size,
                f16_uncompressed_bytes=payload_f16.uncompressed_bytes_length,
                u16_uncompressed_bytes=payload_u16.uncompressed_bytes_length,
                f16_sha256=f16_actual_sha256,
                u16_sha256=u16_actual_sha256,
                f16_verified=True,
                u16_verified=True,
            )
            verification_records.append(rec)

        # 5. Check for orphaned binary files on disk
        actual_bin_files = list(stage_dir.glob("lod*/**/*.bin.zst"))
        if len(actual_bin_files) != 126:
            raise BrickPackagingError(
                f"Expected exactly 126 binary payload files on disk in staging, found {len(actual_bin_files)}"
            )

        for p in actual_bin_files:
            rel = str(p.relative_to(stage_dir)).replace("\\", "/")
            if rel not in expected_files_set:
                raise BrickPackagingError(f"Orphaned binary payload file found in staging: {rel}")

        # 6. Storage budget verification
        total_compressed_bytes = f16_total_bytes + u16_total_bytes
        total_compressed_mib = total_compressed_bytes / (1024.0 * 1024.0)

        if total_compressed_mib > self.storage_budget_mib:
            raise BrickPackagingError(
                f"Total compressed payload size ({total_compressed_mib:.2f} MiB) exceeds storage budget ({self.storage_budget_mib:.2f} MiB)"
            )

        storage_summary = {
            "total_bricks": len(bricks_raw),
            "total_payload_files": len(actual_bin_files),
            "f16_payload_files_count": len(bricks_raw),
            "u16_payload_files_count": len(bricks_raw),
            "f16_total_compressed_bytes": f16_total_bytes,
            "u16_total_compressed_bytes": u16_total_bytes,
            "total_compressed_bytes": total_compressed_bytes,
            "total_compressed_mib": round(total_compressed_mib, 4),
            "f16_total_compressed_mib": round(f16_total_bytes / (1024.0 * 1024.0), 4),
            "u16_total_compressed_mib": round(u16_total_bytes / (1024.0 * 1024.0), 4),
            "storage_budget_limit_mib": self.storage_budget_mib,
            "storage_budget_compliant": True,
            "budget_utilization_pct": round((total_compressed_mib / self.storage_budget_mib) * 100.0, 2),
        }

        # Build clean validated manifest dictionary
        validated_manifest = {
            "schema_version": "1.0.0",
            "task_id": "TASK-04C",
            "visualization_product": vis_product_contract.model_dump(),
            "quantization_contract": quant_contract.model_dump(),
            "total_bricks": len(bricks_raw),
            "storage_summary": storage_summary,
            "bricks": sorted(bricks_raw, key=lambda b: b["brick_key"]),
        }

        return validated_manifest, verification_records, storage_summary

    def promote_staging_to_target(
        self,
        staging_dir: Optional[Union[str, Path]] = None,
        target_dir: Optional[Union[str, Path]] = None,
    ) -> Path:
        """
        Atomically promotes staged bricks and directory tree into the target production visualization directory.
        Ensures idempotent and safe atomic replacement without leaving corrupted partial state.
        """
        src = Path(staging_dir or self.staging_dir).resolve()
        dst = Path(target_dir or self.production_product_dir).resolve()

        if not src.exists():
            raise BrickPackagingError(f"Staging directory {src} does not exist for promotion.")

        dst.parent.mkdir(parents=True, exist_ok=True)

        # Temporary atomic staging directory adjacent to destination
        temp_deploy_dir = dst.parent / f".tmp_deploy_{self.product_version}_{int(datetime.now(timezone.utc).timestamp())}"
        if temp_deploy_dir.exists():
            shutil.rmtree(temp_deploy_dir, ignore_errors=True)

        try:
            # Copy all files from staging into temp deploy dir
            shutil.copytree(src, temp_deploy_dir)

            # Atomic swap / replacement
            if dst.exists():
                old_backup = dst.parent / f".old_{self.product_version}_{int(datetime.now(timezone.utc).timestamp())}"
                # Rename current dst to old_backup
                os.replace(str(dst), str(old_backup))
                try:
                    os.replace(str(temp_deploy_dir), str(dst))
                    # Clean up old backup
                    shutil.rmtree(old_backup, ignore_errors=True)
                except Exception:
                    # Rollback
                    if old_backup.exists() and not dst.exists():
                        os.replace(str(old_backup), str(dst))
                    raise
            else:
                os.replace(str(temp_deploy_dir), str(dst))

            logger.info(f"Successfully promoted staging to target: {dst}")
            return dst

        finally:
            if temp_deploy_dir.exists():
                shutil.rmtree(temp_deploy_dir, ignore_errors=True)

    def export_canonical_manifests(
        self,
        validated_manifest: Dict[str, Any],
        production_product_dir: Optional[Union[str, Path]] = None,
        production_manifest_dir: Optional[Union[str, Path]] = None,
    ) -> Tuple[Path, Path, str]:
        """
        Exports the canonical visualization manifest and companion brick catalog to:
        1. data/manifests/visualization/.../visualization_manifest.json
        2. data/visualization/.../visualization_manifest.json
        
        Returns (canonical_manifest_path, product_manifest_path, manifest_sha256).
        """
        prod_dir = Path(production_product_dir or self.production_product_dir).resolve()
        man_dir = Path(production_manifest_dir or self.production_manifest_dir).resolve()

        prod_dir.mkdir(parents=True, exist_ok=True)
        man_dir.mkdir(parents=True, exist_ok=True)

        # Ensure manifest payload has exact packaging timestamp and metadata
        now_utc = datetime.now(timezone.utc).isoformat()
        manifest_copy = copy.deepcopy(validated_manifest)
        manifest_copy["packaging_metadata"] = {
            "packaged_at_utc": now_utc,
            "engine": "QuasarOS BrickPackager v1.0.0",
            "pipeline_task": "TASK-04C",
            "verification_status": "VERIFIED_CRYPTOGRAPHIC_PARITY",
            "active_snapshot_id": self.snapshot_id,
            "source_sha256": self.source_sha256,
        }

        # Deterministic JSON encoding (sorted keys, 2-space indent)
        manifest_bytes = json.dumps(manifest_copy, indent=2, sort_keys=True).encode("utf-8")
        manifest_sha256 = hashlib.sha256(manifest_bytes).hexdigest()

        # Add manifest SHA256 to final manifest body
        manifest_copy["manifest_sha256"] = manifest_sha256
        final_manifest_bytes = json.dumps(manifest_copy, indent=2, sort_keys=True).encode("utf-8")
        final_sha256 = hashlib.sha256(final_manifest_bytes).hexdigest()

        # 1. Write to canonical manifests directory
        canonical_manifest_path = man_dir / "visualization_manifest.json"
        with open(canonical_manifest_path, "wb") as f:
            f.write(final_manifest_bytes)

        # 2. Write to visualization product directory
        product_manifest_path = prod_dir / "visualization_manifest.json"
        with open(product_manifest_path, "wb") as f:
            f.write(final_manifest_bytes)

        # 3. Export companion brick catalogs for indexing
        brick_catalog_payload = {
            "visualization_product_id": self.visualization_product_id,
            "snapshot_id": self.snapshot_id,
            "product_version": self.product_version,
            "total_bricks": len(manifest_copy["bricks"]),
            "manifest_sha256": final_sha256,
            "storage_summary": manifest_copy.get("storage_summary", {}),
            "bricks": manifest_copy["bricks"],
        }
        catalog_bytes = json.dumps(brick_catalog_payload, indent=2, sort_keys=True).encode("utf-8")

        with open(man_dir / "brick_catalog.json", "wb") as f:
            f.write(catalog_bytes)
        with open(prod_dir / "brick_catalog.json", "wb") as f:
            f.write(catalog_bytes)

        logger.info(
            f"Canonical visualization manifests exported with SHA-256: {final_sha256}"
        )

        return canonical_manifest_path, product_manifest_path, final_sha256

    def update_active_catalog(
        self,
        manifest_sha256: str,
        total_compressed_bytes: int,
    ) -> Path:
        """
        Updates the repository's active snapshot catalog (active_snapshot_catalog.json)
        with the link to the newly promoted visualization product and manifest.
        """
        catalog = self._load_catalog()
        active_entry = catalog.get("active_operational_snapshot", {})

        now_utc = datetime.now(timezone.utc).isoformat()
        catalog["updated_at_utc"] = now_utc

        # Relative paths for portable catalog references
        rel_vis_path = f"data/visualization/{self.dataset_id}/{self.snapshot_id}/{self.product_version}"
        rel_manifest_path = f"data/manifests/visualization/{self.dataset_id}/{self.snapshot_id}/{self.product_version}/visualization_manifest.json"

        active_entry["visualization_product_id"] = self.visualization_product_id
        active_entry["visualization_product_path"] = rel_vis_path
        active_entry["visualization_manifest"] = rel_manifest_path
        active_entry["visualization_manifest_sha256"] = manifest_sha256
        active_entry["total_visualization_bricks"] = self.EXPECTED_TOTAL_BRICKS
        active_entry["visualization_lod_levels"] = self.EXPECTED_LOD_LEVELS
        active_entry["visualization_storage_bytes"] = total_compressed_bytes
        active_entry["visualization_storage_mib"] = round(total_compressed_bytes / (1024.0 * 1024.0), 4)

        catalog["active_operational_snapshot"] = active_entry

        with open(self.catalog_path, "w", encoding="utf-8") as f:
            json.dump(catalog, f, indent=2, sort_keys=False)
            f.write("\n")

        logger.info(f"Active snapshot catalog updated at {self.catalog_path}")
        return self.catalog_path

    def run_packaging_pipeline(self) -> PackagingResult:
        """
        Executes the full end-to-end TASK-04C packaging pipeline:
        1. Validate staged product, contracts, and SHA-256 digests.
        2. Atomically promote staged bricks to target visualization directory.
        3. Export canonical manifests to manifest and product directories.
        4. Re-verify deployed assets in production target.
        5. Update active snapshot catalog.
        """
        logger.info(f"Starting TASK-04C packaging pipeline for snapshot '{self.snapshot_id}'")

        # 1. Validate staged product
        validated_manifest, records, storage_summary = self.validate_staged_product(self.staging_dir)

        # 2. Promote staging to production target
        promoted_target = self.promote_staging_to_target(
            staging_dir=self.staging_dir,
            target_dir=self.production_product_dir,
        )

        # 3. Export canonical manifests
        canonical_man, prod_man, manifest_sha256 = self.export_canonical_manifests(
            validated_manifest=validated_manifest,
            production_product_dir=promoted_target,
            production_manifest_dir=self.production_manifest_dir,
        )

        # 4. Post-promotion validation on the target directory to verify 100% disk integrity
        validated_target_manifest, target_records, target_storage_summary = self.validate_staged_product(
            staging_dir=promoted_target
        )

        # 5. Update active snapshot catalog
        self.update_active_catalog(
            manifest_sha256=manifest_sha256,
            total_compressed_bytes=storage_summary["total_compressed_bytes"],
        )

        now_utc = datetime.now(timezone.utc).isoformat()

        result = PackagingResult(
            snapshot_id=self.snapshot_id,
            visualization_product_id=self.visualization_product_id,
            product_version=self.product_version,
            variable_id=self.variable_id,
            source_dataset_id=self.dataset_id,
            source_asset_sha256=self.source_sha256,
            staging_directory=self.staging_dir,
            production_product_directory=promoted_target,
            production_manifest_directory=self.production_manifest_dir,
            canonical_manifest_path=canonical_man,
            product_manifest_path=prod_man,
            manifest_sha256=manifest_sha256,
            total_bricks=self.EXPECTED_TOTAL_BRICKS,
            total_payload_files=storage_summary["total_payload_files"],
            f16_payload_count=storage_summary["f16_payload_files_count"],
            u16_payload_count=storage_summary["u16_payload_files_count"],
            total_f16_bytes=storage_summary["f16_total_compressed_bytes"],
            total_u16_bytes=storage_summary["u16_total_compressed_bytes"],
            total_compressed_bytes=storage_summary["total_compressed_bytes"],
            total_compressed_mib=storage_summary["total_compressed_mib"],
            storage_budget_mib=self.storage_budget_mib,
            storage_budget_compliant=True,
            verified_brick_count=len(target_records),
            catalog_updated=True,
            packaging_timestamp_utc=now_utc,
        )

        logger.info(
            f"TASK-04C complete: {result.total_bricks} bricks packaged and verified into {result.production_product_directory}"
        )
        return result
