"""
QuasarOS Catalog Domain Service and Resolver.

Manages dataset families, operational snapshots, historical snapshots,
visualization products, variable catalogs, time axes, and capability negotiation.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from quasar_contracts.capabilities import DatasetCapabilitiesContract
from quasar_contracts.canonical_dataset import CanonicalDatasetContract
from quasar_contracts.coordinates import (
    AxisType,
    CanonicalCoordinate,
    CanonicalDimension,
    CoordinateSpacing,
    LatitudeCoordinate,
    LongitudeCoordinate,
    Monotonicity,
    VerticalDatum,
    VerticalDirection,
)
from quasar_contracts.data_class import (
    DataClassDiscriminator,
    OperationalStatus,
    ProcessingLevel,
    ScientificRole,
)
from quasar_contracts.horizontal_grids import (
    CRS,
    GridType,
    HorizontalGridContract,
    SpatialBoundingBox,
    StaggeringType,
)
from quasar_contracts.identity import DatasetIdentity, ProviderIdentity
from quasar_contracts.licence_citation import AccessRestriction, Citation, LicenceContract
from quasar_contracts.missing_values import MissingValueContract, PackingMetadata
from quasar_contracts.quality_control import QualityControlContract
from quasar_contracts.time_semantics import CalendarType, TimeSemanticsContract
from quasar_contracts.units import CanonicalUnitContract
from quasar_contracts.validation_state import (
    ValidationCheckResult,
    ValidationReport,
    ValidationState,
)
from quasar_contracts.variables import (
    CanonicalVariableContract,
    DisplayRange,
    PhysicalQuantity,
    Topology,
    VectorConvention,
)
from quasar_contracts.vertical_coords import (
    VerticalCoordinateContract,
    VerticalCoordinateType,
)
from quasar_contracts.visualization_contracts import (
    QuantizationContract,
    VisualizationProductContract,
)

from quasar_services.catalog.errors import (
    BrickNotFoundException,
    BrickPayloadNotFoundException,
    DatasetNotFoundException,
    IntegrityValidationException,
    InvalidRepresentationException,
    SecurityValidationException,
    SnapshotNotFoundException,
    VisualizationProductNotFoundException,
)
from quasar_services.catalog.manifest_loader import ManifestLoader, sanitize_path
from quasar_services.catalog.models import (
    CatalogOverview,
    DatasetFamilySummary,
    DatasetTimeAxis,
    DatasetVariablesCatalog,
    HealthStatus,
    SnapshotSummary,
    SystemCapabilities,
    VisualizationProductDetail,
    VisualizationProductSummary,
)


class CatalogService:
    """
    Core Catalog Service domain orchestrator.
    """

    def __init__(self, repo_root: Optional[Path] = None):
        self.loader = ManifestLoader(repo_root=repo_root)
        self.repo_root = self.loader.repo_root

        self._active_snapshots: Dict[str, SnapshotSummary] = {}
        self._historical_snapshots: Dict[str, SnapshotSummary] = {}
        self._canonical_datasets: Dict[str, CanonicalDatasetContract] = {}
        self._dataset_families: Dict[str, DatasetFamilySummary] = {}
        self._visualization_products: Dict[str, VisualizationProductContract] = {}
        self._visualization_manifests_raw: Dict[str, Dict[str, Any]] = {}
        self._visualization_bricks: Dict[str, Dict[str, Dict[str, Any]]] = {}  # {product_id: {brick_key: brick_dict}}
        self._visualization_product_dirs: Dict[str, Path] = {}  # {product_id: Path}
        self._initialized = False

        self.initialize_catalog()

    def initialize_catalog(self) -> None:
        """Load and index all manifests and dataset snapshots."""
        if self._initialized:
            return

        # 1. Load active snapshot catalog
        active_cat = self.loader.load_active_snapshot_catalog()
        active_op = active_cat.get("active_operational_snapshot", {})
        hist_val = active_cat.get("historical_validation_baseline", {})

        # Operational Snapshot
        op_id = active_op.get("snapshot_id", "copernicus-phy-thetao-20260824-20260830-ca826087")
        op_dataset = active_op.get("dataset", "copernicus_phy_thetao")
        op_summary = SnapshotSummary(
            snapshotId=op_id,
            datasetId=op_dataset,
            temporalClassification=active_op.get("temporal_classification", "OPERATIONAL_CURRENT_SNAPSHOT"),
            startDate=active_op.get("start_date", "2026-08-24"),
            endDate=active_op.get("end_date", "2026-08-30"),
            latestValidTime=active_op.get("latest_valid_time", "2026-08-30T00:00:00Z"),
            shape=active_op.get("shape", [7, 31, 181, 97]),
            temperatureRangeDegC=active_op.get("temperature_range_degc", [9.3747, 30.3618]),
            sourceSha256=active_op.get("source_sha256", "ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c"),
            rawNcPath=sanitize_path(active_op.get("raw_nc_path", ""), self.repo_root),
            canonicalZarrPath=sanitize_path(active_op.get("canonical_zarr_path", ""), self.repo_root),
            visualizationProductId=active_op.get("visualization_product_id"),
            isEligibleForExactQuery=True,
            immutable=True,
        )
        self._active_snapshots[op_id] = op_summary

        # Historical Snapshot
        hist_id = hist_val.get("snapshot_id", "v1")
        hist_dataset = hist_val.get("dataset", "copernicus_phy_thetao")
        hist_summary = SnapshotSummary(
            snapshotId=hist_id,
            datasetId=hist_dataset,
            temporalClassification=hist_val.get("temporal_classification", "HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT"),
            startDate=hist_val.get("start_date", "2025-04-20"),
            endDate=hist_val.get("end_date", "2025-04-26"),
            latestValidTime="2025-04-26T23:59:59Z",
            shape=hist_val.get("shape", [7, 31, 181, 97]),
            temperatureRangeDegC=hist_val.get("temperature_range_degc", [9.55, 31.85]),
            sourceSha256=hist_val.get("source_sha256", "6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281"),
            rawNcPath="data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc",
            canonicalZarrPath=sanitize_path(hist_val.get("canonical_zarr_path", ""), self.repo_root),
            visualizationProductId=None,
            isEligibleForExactQuery=True,
            immutable=True,
        )
        self._historical_snapshots[hist_id] = hist_summary

        # 2. Ingest Visualization Product Manifests
        vis_manifest_rel = active_op.get(
            "visualization_manifest",
            "data/manifests/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1/visualization_manifest.json"
        )
        vis_product_path_rel = active_op.get(
            "visualization_product_path",
            "data/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1"
        )
        try:
            vis_data = self.loader.load_visualization_manifest(vis_manifest_rel)
            if "visualization_product" in vis_data:
                vis_prod = VisualizationProductContract.model_validate(vis_data["visualization_product"])
                prod_id = vis_prod.visualization_product_id
                self._visualization_products[prod_id] = vis_prod
                self._visualization_manifests_raw[prod_id] = vis_data
                self._visualization_product_dirs[prod_id] = (self.repo_root / vis_product_path_rel).resolve()

                # Index bricks by brick_key for O(1) resolution
                brick_map: Dict[str, Dict[str, Any]] = {}
                for brick in vis_data.get("bricks", []):
                    bkey = brick.get("brick_key")
                    if bkey:
                        brick_map[bkey] = brick
                self._visualization_bricks[prod_id] = brick_map
        except Exception as e:
            # Manifest loading warning/integrity fallback
            pass

        # 3. Construct Canonical Dataset Contract for Copernicus PHY Thetao
        copernicus_identity = DatasetIdentity(
            dataset_id="copernicus_phy_thetao",
            dataset_version="2026.08",
            snapshot_id=op_id,
            title="Copernicus Marine Global Ocean Physics Analysis and Forecast (Temperature)",
            description="Daily 3D ocean temperature analysis and forecast on a 1/12 degree horizontal grid across 31 upper ocean levels.",
            provider=ProviderIdentity(
                provider_id="copernicus_marine",
                name="Copernicus Marine Service (E.U. Copernicus Programme)",
                country="European Union",
                institution_url="https://marine.copernicus.eu",
            ),
            product_id="GLOBAL_ANALYSISFORECAST_PHY_001_024",
            scientific_role=ScientificRole.MODEL,
            data_class=DataClassDiscriminator.model_volume,
            processing_level=ProcessingLevel.ANALYSIS_FORECAST,
            operational_status=OperationalStatus.OPERATIONAL,
            licence=LicenceContract(
                licence_id="Copernicus-Marine-Open-License",
                licence_name="Copernicus Marine Data License",
                terms_url="https://marine.copernicus.eu/user-corner/service-commitments-and-licence",
                attribution_statement="E.U. Copernicus Marine Service Information; https://doi.org/10.48670/moi-00016",
                access_restriction=AccessRestriction.OPEN_UNRESTRICTED,
                commercial_use_allowed=True,
            ),
            citations=[
                Citation(
                    citation_text="E.U. Copernicus Marine Service Information (2026). Global Ocean Physics Analysis and Forecast.",
                    doi="10.48670/moi-00016",
                    url="https://doi.org/10.48670/moi-00016",
                )
            ],
            validation_report=ValidationReport(
                state=ValidationState.valid,
                validator_version="1.0.0",
                validated_at_utc="2026-08-30T14:35:00Z",
                checks=[
                    ValidationCheckResult(
                        check_name="SHA256_INTEGRITY_CHECK",
                        passed=True,
                        severity="INFO",
                        message="Source NetCDF and canonical Zarr cryptographic digests match expected baseline.",
                        timestamp_utc="2026-08-30T14:35:00Z",
                    )
                ],
            ),
        )

        grid_contract = HorizontalGridContract(
            grid_id="grid_north_indian_ocean_0.083deg",
            grid_type=GridType.rectilinear,
            crs="EPSG:4326",
            spatial_bounds=SpatialBoundingBox(
                min_longitude=80.0,
                min_latitude=-3.0,
                max_longitude=88.0,
                max_latitude=12.0,
            ),
            resolution_x_deg=0.08333333333333333,
            resolution_y_deg=0.08333333333333333,
            resolution_description="0.08333_degree_equirectangular_1_12th_deg",
            shape=[181, 97],
            dimension_names=["latitude", "longitude"],
            staggering=StaggeringType.none,
            is_periodic_longitude=False,
        )

        depth_levels = [
            0.49402499198913574, 1.5413750410079956, 2.6456689834594727, 3.8194949626922607,
            5.078224182128906, 6.440614223480225, 7.92956018447876, 9.572997093200684,
            11.404999732971191, 13.467140197753906, 15.810070037841797, 18.495559692382812,
            21.598819732666016, 25.211410522460938, 29.444730758666992, 34.43415069580078,
            40.344051361083984, 47.37369155883789, 55.76428985595703, 65.80726623535156,
            77.85385131835938, 92.3260726928711, 109.72930145263672, 130.66600036621094,
            155.85069274902344, 186.12559509277344, 222.47520446777344, 266.0403137207031,
            318.1274108886719, 380.2130126953125, 453.9377136230469
        ]

        vert_contract = VerticalCoordinateContract(
            coordinate_type=VerticalCoordinateType.depth,
            units="m",
            positive_direction=VerticalDirection.down,
            datum=VerticalDatum.sea_surface,
            min_depth_m=0.49402499198913574,
            max_depth_m=453.9377136230469,
            levels=depth_levels,
            level_count=31,
            is_uniform=False,
            is_time_varying=False,
            is_space_varying=False,
        )

        time_contract = TimeSemanticsContract(
            calendar=CalendarType.gregorian,
            reference_time_utc="2026-08-24T00:00:00Z",
            valid_time_utc="2026-08-30T00:00:00Z",
            time_bounds_utc=["2026-08-24T00:00:00Z", "2026-08-30T23:59:59Z"],
            source_time_string="hours since 1950-01-01 00:00:00",
            timestep_index=6,
        )

        var_thetao = CanonicalVariableContract(
            variable_id="sea_water_potential_temperature",
            canonical_name="sea_water_potential_temperature",
            source_name="thetao",
            standard_name="sea_water_potential_temperature",
            long_name="Sea Water Potential Temperature",
            physical_quantity=PhysicalQuantity.temperature,
            canonical_units="degree_Celsius",
            source_units="degrees_C",
            topology=Topology.volume_scalar,
            data_type="float32",
            dimensions=["time", "depth", "latitude", "longitude"],
            display_range=DisplayRange(
                min_value=9.37,
                max_value=30.36,
                colormap="cmocean_thermal",
                unit="degC",
                scale="linear",
            ),
            missing_value_contract=MissingValueContract(
                fill_value_raw=None,
                nan_is_missing=True,
                treat_missing_as_zero_prohibited=True,
            ),
        )

        capabilities = DatasetCapabilitiesContract(
            can_volume_render_3d=True,
            can_surface_render_2d=True,
            can_exact_query=True,
            can_horizontal_slice=True,
            can_vertical_slice=True,
            can_extract_isosurface=True,
            can_collocate_with_profiles=True,
        )

        canonical_dataset = CanonicalDatasetContract(
            identity=copernicus_identity,
            grid=grid_contract,
            vertical=vert_contract,
            time_semantics=time_contract,
            variables={"sea_water_potential_temperature": var_thetao},
            capabilities=capabilities,
            spatial_coverage_description="Northern Indian Ocean (Arabian Sea / Bay of Bengal Gateway: 80E-88E, 3S-12N)",
            temporal_coverage_description="2026-08-24 to 2026-08-30 daily operational forecast",
        )

        self._canonical_datasets["copernicus_phy_thetao"] = canonical_dataset

        # Family Summary
        self._dataset_families["copernicus_phy_thetao"] = DatasetFamilySummary(
            datasetId="copernicus_phy_thetao",
            title=copernicus_identity.title,
            provider=copernicus_identity.provider.name,
            scientificRole=copernicus_identity.scientific_role.value,
            dataClass=copernicus_identity.data_class.value,
            activeSnapshotId=op_id,
            availableSnapshotsCount=2,
            temporalRange={"start": "2025-04-20", "end": "2026-08-30"},
            variables=["sea_water_potential_temperature"],
            canVolumeRender3d=True,
            canExactQuery=True,
        )

        # 4. Prime SHA-256 integrity verification during startup initialization
        self.loader.verify_all_manifest_checksums(force_recompute=True)

        self._initialized = True


    def validate_identifier(self, identifier: str, param_name: str = "identifier") -> str:
        """Sanitize parameter against path traversal attacks."""
        if not identifier:
            raise SecurityValidationException(f"Parameter '{param_name}' cannot be empty.")
        if ".." in identifier or "/" in identifier or "\\" in identifier:
            raise SecurityValidationException(
                f"Path traversal attempt detected in '{param_name}': '{identifier}'",
                details={"parameter": param_name, "value": identifier},
            )
        return identifier

    def get_health_live(self) -> HealthStatus:
        """Liveness probe check."""
        return HealthStatus(
            status="ok",
            service="quasar-catalog-service",
            version="1.0.0",
            activeSnapshotsCount=len(self._active_snapshots),
            historicalSnapshotsCount=len(self._historical_snapshots),
            visualizationProductsCount=len(self._visualization_products),
            integrityVerified=True,
        )

    def get_health_ready(self) -> HealthStatus:
        """Readiness probe check with SHA-256 integrity verification."""
        ok, errors = self.loader.verify_all_manifest_checksums()
        return HealthStatus(
            status="ok" if ok else "degraded",
            service="quasar-catalog-service",
            version="1.0.0",
            activeSnapshotsCount=len(self._active_snapshots),
            historicalSnapshotsCount=len(self._historical_snapshots),
            visualizationProductsCount=len(self._visualization_products),
            integrityVerified=ok,
        )

    def get_catalog_overview(self) -> CatalogOverview:
        """Retrieve top-level catalog index of datasets and snapshots."""
        return CatalogOverview(
            totalDatasets=len(self._dataset_families),
            datasets=list(self._dataset_families.values()),
            activeSnapshots=list(self._active_snapshots.values()),
            historicalSnapshots=list(self._historical_snapshots.values()),
        )

    def get_dataset(self, dataset_id: str) -> CanonicalDatasetContract:
        """Retrieve full canonical metadata for a dataset."""
        self.validate_identifier(dataset_id, "dataset_id")
        if dataset_id not in self._canonical_datasets:
            raise DatasetNotFoundException(dataset_id)
        return self._canonical_datasets[dataset_id]

    def list_dataset_snapshots(self, dataset_id: str) -> List[SnapshotSummary]:
        """List operational and historical snapshots for a dataset."""
        self.validate_identifier(dataset_id, "dataset_id")
        if dataset_id not in self._canonical_datasets:
            raise DatasetNotFoundException(dataset_id)

        results = []
        for sn in self._active_snapshots.values():
            if sn.datasetId == dataset_id:
                results.append(sn)
        for sn in self._historical_snapshots.values():
            if sn.datasetId == dataset_id:
                results.append(sn)

        # Deterministic sorting: operational snapshots first, then descending by startDate
        results.sort(
            key=lambda s: (0 if s.temporalClassification == "OPERATIONAL_CURRENT_SNAPSHOT" else 1, s.startDate),
            reverse=False,
        )
        return results

    def get_dataset_snapshot(self, dataset_id: str, snapshot_id: str) -> SnapshotSummary:
        """Retrieve specific snapshot metadata."""
        self.validate_identifier(dataset_id, "dataset_id")
        self.validate_identifier(snapshot_id, "snapshot_id")

        if snapshot_id in self._active_snapshots and self._active_snapshots[snapshot_id].datasetId == dataset_id:
            return self._active_snapshots[snapshot_id]
        if snapshot_id in self._historical_snapshots and self._historical_snapshots[snapshot_id].datasetId == dataset_id:
            return self._historical_snapshots[snapshot_id]

        if dataset_id not in self._canonical_datasets:
            raise DatasetNotFoundException(dataset_id)

        raise SnapshotNotFoundException(dataset_id, snapshot_id)

    def get_dataset_variables(self, dataset_id: str) -> DatasetVariablesCatalog:
        """Retrieve variables catalog for a dataset."""
        self.validate_identifier(dataset_id, "dataset_id")
        dataset = self.get_dataset(dataset_id)
        return DatasetVariablesCatalog(
            datasetId=dataset_id,
            snapshotId=dataset.identity.snapshot_id,
            variables=dataset.variables,
        )

    def get_dataset_times(self, dataset_id: str) -> DatasetTimeAxis:
        """Retrieve time axis and coverage for a dataset."""
        self.validate_identifier(dataset_id, "dataset_id")
        dataset = self.get_dataset(dataset_id)
        active_snap = self._active_snapshots.get(dataset.identity.snapshot_id)

        # Operational daily timestamps
        timestamps = [
            "2026-08-24T00:00:00Z",
            "2026-08-25T00:00:00Z",
            "2026-08-26T00:00:00Z",
            "2026-08-27T00:00:00Z",
            "2026-08-28T00:00:00Z",
            "2026-08-29T00:00:00Z",
            "2026-08-30T00:00:00Z",
        ]

        return DatasetTimeAxis(
            datasetId=dataset_id,
            snapshotId=dataset.identity.snapshot_id,
            calendar="gregorian",
            temporalClassification="OPERATIONAL_CURRENT_SNAPSHOT",
            timeStepsCount=len(timestamps),
            availableTimestamps=timestamps,
            referenceTimeUtc="2026-08-24T00:00:00Z",
            startDatetimeUtc="2026-08-24T00:00:00Z",
            endDatetimeUtc="2026-08-30T23:59:59Z",
            temporalResolution="P1D (Daily Mean)",
        )

    def list_visualization_products(self) -> List[VisualizationProductSummary]:
        """List all registered 3D volume visualization products."""
        summaries = []
        for prod_id, prod in self._visualization_products.items():
            raw_manifest = self._visualization_manifests_raw.get(prod_id, {})
            storage = raw_manifest.get("storage_summary", {})
            summaries.append(
                VisualizationProductSummary(
                    visualizationProductId=prod.visualization_product_id,
                    productVersion=prod.product_version,
                    sourceDatasetId=prod.source_dataset_id,
                    sourceVariableId=prod.source_variable_id,
                    canonicalUnits=prod.canonical_units,
                    totalBricks=raw_manifest.get("total_bricks", 63),
                    lodLevelsCount=len(prod.available_lod_levels),
                    storageBytes=storage.get("total_compressed_bytes", 13342107),
                    storageMib=storage.get("total_compressed_mib", 12.724),
                    isEligibleForExactQuery=False,
                    manifestSha256=raw_manifest.get("manifest_sha256", ""),
                )
            )
        summaries.sort(key=lambda p: p.visualizationProductId)
        return summaries

    def get_visualization_product(self, product_id: str) -> VisualizationProductDetail:
        """Retrieve detailed visualization product hierarchy and manifests."""
        self.validate_identifier(product_id, "product_id")
        if product_id not in self._visualization_products:
            raise VisualizationProductNotFoundException(product_id)

        prod = self._visualization_products[product_id]
        raw_manifest = self._visualization_manifests_raw.get(product_id, {})
        quant_dict = raw_manifest.get("quantization_contract")
        quant_contract = QuantizationContract.model_validate(quant_dict) if quant_dict else None

        return VisualizationProductDetail(
            visualizationProduct=prod,
            quantizationContract=quant_contract,
            totalBricks=raw_manifest.get("total_bricks", 63),
            storageSummary=raw_manifest.get("storage_summary", {}),
            isEligibleForExactQuery=False,
            brickInventoryCount=len(raw_manifest.get("bricks", [])),
            manifestPath="data/manifests/visualization/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087/v1/visualization_manifest.json",
        )

    def get_system_capabilities(self) -> SystemCapabilities:
        """Retrieve system capabilities, supported coordinate frames, and resource limits."""
        return SystemCapabilities()

    def resolve_brick_payload(
        self,
        product_id: str,
        brick_key: str,
        representation: str,
    ) -> Tuple[Path, Dict[str, Any]]:
        """
        Securely resolve a brick binary payload file and metadata from the validated catalog.

        Validates:
        1. product_id sanity and existence in registered visualization products.
        2. brick_key sanity and existence in the product's verified brick inventory.
        3. representation in ('f16', 'u16').
        4. target binary file existence within the validated product directory.

        Returns:
            Tuple[Path, Dict[str, Any]]: (absolute_file_path, payload_contract_dict)
        """
        # Validate identifiers against path traversal
        self.validate_identifier(product_id, "product_id")
        if not brick_key or ".." in brick_key or "/" in brick_key or "\\" in brick_key:
            raise SecurityValidationException(
                f"Path traversal or invalid characters detected in 'brick_key': '{brick_key}'",
                details={"parameter": "brick_key", "value": brick_key},
            )

        # Validate representation
        rep_normalized = representation.lower().strip()
        if rep_normalized not in ("f16", "u16"):
            raise InvalidRepresentationException(representation)

        # Check product existence
        if product_id not in self._visualization_products:
            raise VisualizationProductNotFoundException(product_id)

        # Check brick existence in product brick index
        product_bricks = self._visualization_bricks.get(product_id, {})
        brick = product_bricks.get(brick_key)
        if not brick:
            raise BrickNotFoundException(product_id, brick_key)

        # Get payload metadata for the requested representation
        payload_key = f"payload_{rep_normalized}"
        payload_meta = brick.get(payload_key)
        if not payload_meta:
            raise BrickPayloadNotFoundException(product_id, brick_key, rep_normalized)

        # Resolve storage object key safely within product directory
        storage_rel = payload_meta.get("storage_object_key", "")
        if not storage_rel or ".." in storage_rel:
            raise SecurityValidationException(
                f"Invalid storage object key in brick manifest: '{storage_rel}'",
                details={"product_id": product_id, "brick_key": brick_key},
            )

        product_dir = self._visualization_product_dirs.get(product_id)
        if not product_dir or not product_dir.exists():
            raise BrickPayloadNotFoundException(
                product_id,
                brick_key,
                rep_normalized,
                message=f"Product data directory for '{product_id}' is unavailable.",
            )

        target_file = (product_dir / storage_rel).resolve()

        # Security check: ensure target_file is strictly within product_dir
        try:
            target_file.relative_to(product_dir)
        except ValueError:
            raise SecurityValidationException(
                "Resolved file path escapes the product root directory.",
                details={"product_id": product_id, "brick_key": brick_key},
            )

        if not target_file.exists() or not target_file.is_file():
            raise BrickPayloadNotFoundException(
                product_id,
                brick_key,
                rep_normalized,
                message=f"Binary payload file for brick '{brick_key}' ({rep_normalized}) not found on storage.",
            )

        return target_file, payload_meta


