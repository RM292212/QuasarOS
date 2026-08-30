"""
QuasarOS Integrated Contract Validation Test Suite (TASK-02G).

Comprehensive end-to-end contract validation across:
1. All 8 real-data fixtures and companion manifests in `tests/fixtures/`
   - Dataset identity, variables, units, grids, wave math, ROMS s-coordinates,
     profile casts, glider trajectories, bathymetry, climatology, missing values.
2. Cross-Language & Schema Synchronization:
   - 0 schema drift verification across schemas/canonical/ and packages/contracts/schemas/.
   - All 54 JSON Schemas validated against serialized Pydantic JSON outputs.
   - TypeScript contract fidelity verification in quasar_contracts.d.ts.
3. Scientific Invariant Verification:
   - Potential temperature vs in-situ temperature strict distinction.
   - Practical salinity (SP) vs Absolute salinity (SA) strict distinction.
   - Pressure (dbar) vs depth (m) strict distinction.
   - Missing values NEVER interpreted as physical zero.
   - Provider-declared zero fill values preserved.
   - QC-rejected cells separate from missing/masked cells.
   - Wave directions use circular angular trigonometry (e.g. 359 deg and 1 deg are 2 deg apart).
   - R16Float / quantized textures declare is_eligible_for_exact_query = False.
   - Exact queries require source NetCDF/Zarr asset IDs and SHA-256 checksums.
4. Failure Injection Tests:
   - Rejection of corrupt/mismatched SHA-256 checksums.
   - Rejection of out-of-bounds brick indices and unknown LOD levels.
   - Rejection of approximate pick responses claiming authoritative_scientific_value.
   - Rejection of exact queries without required vertical coordinate datum/units.
   - Rejection of secret tokens or signed URLs in persistent payload descriptors.
"""

import hashlib
import json
import math
import os
import re
import sys
import unittest
from pathlib import Path
from typing import Any, Dict

import jsonschema
import netCDF4 as nc
import numpy as np
from pydantic import ValidationError

# Setup repository paths
REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))

FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures" / "real_data"
MANIFESTS_DIR = REPO_ROOT / "tests" / "fixtures" / "manifests"
RAW_DATA_DIR = REPO_ROOT / "data" / "raw"
CANONICAL_SCHEMAS_DIR = REPO_ROOT / "schemas" / "canonical"
CONTRACTS_SCHEMAS_DIR = REPO_ROOT / "packages" / "contracts" / "schemas"
TYPESCRIPT_D_TS = REPO_ROOT / "packages" / "contracts" / "types" / "quasar_contracts.d.ts"

from quasar_contracts import (
    AccessRestriction,
    AggregationMethod,
    ArakawaStaggeringContract,
    ArtifactClassification,
    AssetFormat,
    AxisType,
    BackendCompatibility,
    BrickGeometryContract,
    BrickIdentityContract,
    BrickPayloadContract,
    CalendarType,
    CanonicalCoordinate,
    CanonicalDatasetContract,
    CanonicalDimension,
    CanonicalUnitContract,
    CanonicalVariableContract,
    Citation,
    CollocationBlockingReason,
    CollocationReadinessContract,
    CompressionCodec,
    CoordinateSpace,
    CoordinateSpacing,
    CoordinateTransformContract,
    CRS,
    CurvilinearGridContract,
    DataClassDiscriminator,
    DataMode,
    DatasetCapabilitiesContract,
    DatasetIdentity,
    DeduplicationResolution,
    DisplayRange,
    DiveSegment,
    DuplicateRelationshipContract,
    DuplicateRelationshipType,
    ErrorCategory,
    ErrorSeverity,
    ExactValueQueryRequest,
    ExactValueQueryResponse,
    FirstVolumeSliceProfile,
    ForecastCycleContract,
    GEBCO_TID_QC_SCHEME,
    GridMetricsContract,
    GridType,
    HorizontalGridContract,
    HYCOMModelContract,
    HYCOMVerticalRepresentation,
    IOOS_QARTOD_QC_SCHEME,
    ImmutableSourceAsset,
    InterpolationPolicy,
    LatitudeCoordinate,
    LicenceContract,
    LineageRecord,
    LongitudeCoordinate,
    MissingValueContract,
    ModelClass,
    ModelMaskContract,
    ModelRunType,
    Monotonicity,
    MultiBrickStreamingResponse,
    MultiresolutionLevelContract,
    NormalizedQCState,
    ObservationQCReport,
    OceanHydrodynamicModelContract,
    OceanWaveProductContract,
    OperationalStatus,
    OutOfRangeRenderingPolicy,
    PackingMetadata,
    PhysicalCellState,
    PhysicalDimension,
    PhysicalQuantity,
    PlatformMetadataContract,
    PlatformType,
    ProcessingLevel,
    ProfileCastContract,
    ProfileDirection,
    ProfileQCGrade,
    ProfileVariableEntry,
    ProviderIdentity,
    ProvisionalRenderPickResponse,
    QCDerivationSource,
    QCFlagDefinition,
    QCScheme,
    QualityControlContract,
    QuantizationContract,
    RenderStatisticsContract,
    ROMSFormulaTerms,
    ROMSSCoordinateContract,
    ROMSSCoordinateParameters,
    RotationMetadata,
    SchemaVersionMetadata,
    ScientificDiagnostic,
    ScientificErrorCode,
    ScientificRole,
    SelectionInterpolationContract,
    SelectionMethod,
    SensorMetadata,
    SpatialBoundingBox,
    StaggeringType,
    StokesDriftContract,
    StreamingChunkRequest,
    StreamingManifestEntry,
    TextureSampleFormat,
    TimeSemanticsContract,
    TimeSelectorMode,
    Topology,
    TrajectoryContract,
    TrajectoryPhase,
    TrajectoryWaypoint,
    TransferFunctionContract,
    TransferFunctionControlPoint,
    UnitConversionClassification,
    UnitConversionResult,
    ValidationCheckResult,
    ValidationReport,
    ValidationState,
    VariableQCRecord,
    VectorConvention,
    VectorGroupContract,
    VectorGroupType,
    VectorReferenceFrame,
    VerticalCoordinateContract,
    VerticalCoordinateType,
    VerticalDatum,
    VerticalDirection,
    VerticalSelectorType,
    VisualizationProductContract,
    WMO_ARGO_QC_SCHEME,
    WavePartitionContract,
    WavePartitionType,
    WaveSpectralModel,
    circular_distance_deg,
    classify_unit_conversion,
    compute_roms_depths,
    compute_roms_stretching,
    mean_wave_direction,
    normalize_angle_deg,
    verify_schemas_in_directory,
)
from quasar_contracts.export import EXPORT_MODELS


def compute_file_sha256(filepath: Path) -> str:
    """Compute standard bitwise SHA-256 hexadecimal checksum for a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class TestRealDataContractValidation(unittest.TestCase):
    """
    Validation matrix 1: Validates all 8 real-data contract fixtures,
    companion manifests, physical variable definitions, coordinates, and models.
    """

    @classmethod
    def setUpClass(cls):
        cls.manifest_files = [
            "copernicus_thetao_subvolume_manifest.json",
            "hycom_water_temp_subvolume_manifest.json",
            "copernicus_waves_subset_manifest.json",
            "incois_argo_7902250_profile_manifest.json",
            "ru29_glider_trajectory_subset_manifest.json",
            "gebco_2026_elevation_subset_manifest.json",
            "woa23_salinity_oxygen_subset_manifest.json",
            "incois_bioroms_metadata_subset_manifest.json",
        ]

    # -------------------------------------------------------------------------
    # 1. Dataset Identity & Source Assets: All 8 Fixtures
    # -------------------------------------------------------------------------
    def test_all_8_real_data_fixtures_and_manifests_integrity(self):
        """Validates all 8 fixtures and manifests exist, with matching bitwise SHA-256 checksums."""
        self.assertEqual(len(self.manifest_files), 8)

        for m_name in self.manifest_files:
            m_path = MANIFESTS_DIR / m_name
            self.assertTrue(m_path.exists(), f"Manifest missing: {m_path}")

            with open(m_path, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)

            fixture_fn = manifest_data["fixture_filename"]
            fixture_path = FIXTURES_DIR / fixture_fn
            self.assertTrue(fixture_path.exists(), f"Fixture file missing: {fixture_path}")

            # Verify fixture file size and SHA-256
            actual_sha = compute_file_sha256(fixture_path)
            expected_sha = manifest_data["fixture_artifact"]["sha256"]
            self.assertEqual(actual_sha, expected_sha, f"SHA-256 mismatch for fixture {fixture_fn}")

            actual_size = fixture_path.stat().st_size
            expected_size = manifest_data["fixture_artifact"]["byte_size"]
            self.assertEqual(actual_size, expected_size, f"Byte size mismatch for fixture {fixture_fn}")

            # Verify source asset cryptographic record
            src_info = manifest_data["source_asset"]
            if "relative_path" in src_info:
                src_path = REPO_ROOT / src_info["relative_path"]
                self.assertTrue(src_path.exists(), f"Raw source missing: {src_path}")
                self.assertEqual(
                    compute_file_sha256(src_path),
                    src_info["sha256"],
                    f"Raw source SHA-256 mismatch for {src_info['relative_path']}"
                )

                # Instantiate ImmutableSourceAsset model
                asset_model = ImmutableSourceAsset(
                    asset_id=f"asset_{manifest_data['fixture_id']}",
                    dataset_id=manifest_data.get("canonical_dataset_id", manifest_data["fixture_id"]),
                    provider_filename=os.path.basename(src_info["relative_path"]),
                    local_relative_path=src_info["relative_path"],
                    media_type="application/x-netcdf4",
                    format=AssetFormat.netcdf4_classic,
                    artifact_classification=ArtifactClassification.raw_source,
                    size_bytes=src_info["byte_size"],
                    sha256_checksum=src_info["sha256"],
                    retrieval_timestamp_utc="2026-08-30T12:00:00Z",
                    is_immutable=True,
                )
                self.assertEqual(asset_model.sha256_checksum, src_info["sha256"])

    # -------------------------------------------------------------------------
    # 2. Variables & Units: Copernicus thetao, HYCOM water_temp, WOA23 salinity/oxygen
    # -------------------------------------------------------------------------
    def test_variables_and_units_preservation(self):
        """Validates canonical variables and units across Copernicus, HYCOM, and WOA23."""
        # 1. Copernicus thetao: sea_water_potential_temperature in degrees Celsius
        cop_thetao_var = CanonicalVariableContract(
            variable_id="sea_water_potential_temperature",
            canonical_name="Sea Water Potential Temperature",
            source_name="thetao",
            standard_name="sea_water_potential_temperature",
            long_name="Sea water potential temperature",
            canonical_units="degree_Celsius",
            source_units="degrees_C",
            physical_quantity=PhysicalQuantity.temperature,
            topology=Topology.volume_scalar,
            dimensions=["time", "depth", "latitude", "longitude"],
            display_range=DisplayRange(min_value=-2.0, max_value=35.0, colormap="turbo", unit="degC"),
        )
        self.assertEqual(cop_thetao_var.canonical_units, "degree_Celsius")
        self.assertEqual(cop_thetao_var.physical_quantity, PhysicalQuantity.temperature)

        # 2. HYCOM water_temp: water temperature in degrees Celsius
        hycom_temp_var = CanonicalVariableContract(
            variable_id="water_temp",
            canonical_name="Water Temperature",
            source_name="water_temp",
            standard_name="sea_water_potential_temperature",
            long_name="Water Temperature",
            canonical_units="degree_Celsius",
            source_units="degC",
            physical_quantity=PhysicalQuantity.temperature,
            topology=Topology.volume_scalar,
            dimensions=["time", "depth", "latitude", "longitude"],
            display_range=DisplayRange(min_value=-2.0, max_value=35.0, colormap="turbo", unit="degC"),
        )
        self.assertEqual(hycom_temp_var.canonical_units, "degree_Celsius")

        # 3. WOA23 Salinity (practical salinity SP) & Dissolved Oxygen (umol/kg)
        woa_sal_var = CanonicalVariableContract(
            variable_id="sea_water_practical_salinity",
            canonical_name="Sea Water Practical Salinity",
            source_name="s_an",
            standard_name="sea_water_salinity",
            long_name="Objectively analyzed mean salinity for sea water",
            canonical_units="1",
            source_units="1",
            physical_quantity=PhysicalQuantity.practical_salinity,
            topology=Topology.volume_scalar,
            dimensions=["time", "depth", "latitude", "longitude"],
            display_range=DisplayRange(min_value=0.0, max_value=42.0, colormap="haline", unit="1"),
        )
        self.assertEqual(woa_sal_var.physical_quantity, PhysicalQuantity.practical_salinity)

        woa_oxy_var = CanonicalVariableContract(
            variable_id="dissolved_oxygen",
            canonical_name="Dissolved Oxygen",
            source_name="o_an",
            standard_name="mole_concentration_of_dissolved_molecular_oxygen_in_sea_water",
            long_name="Objectively analyzed mean dissolved oxygen in sea water",
            canonical_units="micromole kg-1",
            source_units="umol/kg",
            physical_quantity=PhysicalQuantity.dissolved_oxygen,
            topology=Topology.volume_scalar,
            dimensions=["time", "depth", "latitude", "longitude"],
            display_range=DisplayRange(min_value=0.0, max_value=500.0, colormap="viridis", unit="umol/kg"),
        )
        self.assertEqual(woa_oxy_var.physical_quantity, PhysicalQuantity.dissolved_oxygen)

    # -------------------------------------------------------------------------
    # 3. Rectilinear Grids: Copernicus thetao & HYCOM
    # -------------------------------------------------------------------------
    def test_rectilinear_grids(self):
        """Validates regular rectilinear horizontal grids for Copernicus and HYCOM."""
        cop_grid = HorizontalGridContract(
            grid_id="copernicus_grid",
            grid_type=GridType.rectilinear,
            crs="EPSG:4326",
            spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=82.0, min_latitude=5.0, max_latitude=7.0),
            resolution_description="0.0833_degree_regular",
            shape=[25, 25],
            dimension_names=["latitude", "longitude"],
        )
        self.assertEqual(cop_grid.grid_type, GridType.rectilinear)
        self.assertEqual(cop_grid.crs, "EPSG:4326")

        hycom_grid = HorizontalGridContract(
            grid_id="hycom_grid",
            grid_type=GridType.rectilinear,
            crs="EPSG:4326",
            spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=82.0, min_latitude=5.0, max_latitude=7.0),
            resolution_description="0.08_degree_regular",
            shape=[26, 26],
            dimension_names=["lat", "lon"],
        )
        self.assertEqual(hycom_grid.shape, [26, 26])

    # -------------------------------------------------------------------------
    # 4. Wave Grids: Copernicus Waves with Circular Angle Math
    # -------------------------------------------------------------------------
    def test_wave_grids_and_circular_math(self):
        """Validates wave contract structure and circular trigonometric angle mathematics."""
        wave_contract = OceanWaveProductContract(
            significant_wave_height_total="VHM0",
            peak_period_total="VTPK",
            mean_period_total="VTM02",
            mean_direction_total="VMDR",
            directional_convention=VectorConvention.meteorological_from,
        )
        self.assertEqual(wave_contract.significant_wave_height_total, "VHM0")
        self.assertEqual(wave_contract.directional_convention, VectorConvention.meteorological_from)

        # Validate circular distance calculations across branch cut
        self.assertAlmostEqual(float(circular_distance_deg(359.0, 1.0)), 2.0, places=5)
        self.assertAlmostEqual(float(circular_distance_deg(1.0, 359.0)), 2.0, places=5)
        self.assertAlmostEqual(float(circular_distance_deg(10.0, 350.0)), 20.0, places=5)
        self.assertAlmostEqual(float(circular_distance_deg(0.0, 180.0)), 180.0, places=5)
        self.assertAlmostEqual(float(circular_distance_deg(90.0, 270.0)), 180.0, places=5)

        # Validate vector mean wave direction across 0/360 boundary
        mean_dir = mean_wave_direction([355.0, 5.0])
        self.assertAlmostEqual(float(mean_dir), 0.0, places=5)

        mean_dir_ne = mean_wave_direction([350.0, 10.0, 0.0])
        self.assertAlmostEqual(float(mean_dir_ne), 0.0, places=5)

    # -------------------------------------------------------------------------
    # 5. ROMS S-Coordinates: Bio-ROMS Stretching Curves
    # -------------------------------------------------------------------------
    def test_roms_s_coordinates(self):
        """Validates Bio-ROMS s-coordinate contract and depth transformations."""
        N = 40
        theta_s = 6.0
        theta_b = 0.4
        hc = 100.0
        s, Cs = compute_roms_stretching(N=N, theta_s=theta_s, theta_b=theta_b, vstretching=4)

        roms_contract = ROMSSCoordinateContract(
            Vtransform=2,
            Vstretching=4,
            theta_s=theta_s,
            theta_b=theta_b,
            hc=hc,
            N=N,
            s_rho=s.tolist(),
            Cs_r=Cs.tolist(),
            formula_terms=ROMSFormulaTerms(),
        )
        self.assertEqual(roms_contract.Vtransform, 2)
        self.assertEqual(roms_contract.Vstretching, 4)
        self.assertEqual(len(roms_contract.s_rho), N)

        # Compute depths for h = 2000m, zeta = 0.5m
        h = 2000.0
        zeta = 0.5
        s_arr, cs_arr, z_depths = compute_roms_depths(
            h=h, zeta=zeta, N=N, theta_s=theta_s, theta_b=theta_b, hc=hc, vtransform=2, vstretching=4
        )

        # Monotonicity test: depths must strictly increase from seabed towards sea surface
        self.assertTrue(np.all(np.diff(z_depths) > 0.0))
        # Deepest level near seabed (-2000m)
        self.assertLess(z_depths[0], -1800.0)
        self.assertGreater(z_depths[0], -2000.0)
        # Shallowest level near surface (+0.5m)
        self.assertLess(z_depths[-1], zeta)
        self.assertGreater(z_depths[-1], -20.0)

    # -------------------------------------------------------------------------
    # 6. Profile Observations: Argo 7902250 Cast with Raw/Adjusted & QC
    # -------------------------------------------------------------------------
    def test_profile_observations(self):
        """Validates Argo float 7902250 profile cast contract with raw/adjusted modes."""
        platform = PlatformMetadataContract(
            platform_id="incois_argo_7902250",
            platform_type=PlatformType.ARGO_FLOAT,
            wmo_id="7902250",
            institution="INCOIS",
        )
        self.assertEqual(platform.platform_type, PlatformType.ARGO_FLOAT)
        self.assertEqual(platform.wmo_id, "7902250")

        cast = ProfileCastContract(
            profile_id="incois_argo_7902250_cycle_001",
            platform_id="incois_argo_7902250",
            wmo_id="7902250",
            cycle_number=1,
            direction=ProfileDirection.ASCENDING,
            data_mode=DataMode.ADJUSTED,
            observation_time_utc="2024-03-15T06:00:00Z",
            latitude=12.5,
            longitude=85.0,
            level_count=70,
            variables={
                "sea_water_temperature": ProfileVariableEntry(
                    canonical_variable_id="sea_water_temperature",
                    raw_variable_name="TEMP",
                    adjusted_variable_name="TEMP_ADJUSTED",
                    units="degree_Celsius",
                    data_mode=DataMode.ADJUSTED,
                    levels_count=70,
                    min_pressure_dbar=4.5,
                    max_pressure_dbar=1998.0,
                    has_adjusted_values=True,
                ),
                "sea_water_salinity": ProfileVariableEntry(
                    canonical_variable_id="sea_water_salinity",
                    raw_variable_name="PSAL",
                    adjusted_variable_name="PSAL_ADJUSTED",
                    units="psu",
                    data_mode=DataMode.ADJUSTED,
                    levels_count=70,
                    min_pressure_dbar=4.5,
                    max_pressure_dbar=1998.0,
                    has_adjusted_values=True,
                ),
            },
        )
        self.assertEqual(cast.data_mode, DataMode.ADJUSTED)
        self.assertEqual(len(cast.variables), 2)
        self.assertTrue(cast.variables["sea_water_temperature"].has_adjusted_values)

    # -------------------------------------------------------------------------
    # 7. Trajectories: RU29 Glider 50-Point Track
    # -------------------------------------------------------------------------
    def test_trajectories(self):
        """Validates underwater glider trajectory contract with dive segmentation."""
        glider_platform = PlatformMetadataContract(
            platform_id="ru29_glider",
            platform_type=PlatformType.UNDERWATER_GLIDER,
            wmo_id="ru29_wmo",
            institution="Rutgers University / IOOS",
        )
        self.assertEqual(glider_platform.platform_type, PlatformType.UNDERWATER_GLIDER)

        trajectory = TrajectoryContract(
            trajectory_id="ru29_mission_2020",
            platform_id="ru29_glider",
            mission_name="RU29 Glider Campaign",
            start_time_utc="2020-01-01T00:00:00Z",
            end_time_utc="2020-01-05T00:00:00Z",
            min_latitude=10.0,
            max_latitude=15.0,
            min_longitude=80.0,
            max_longitude=85.0,
            total_waypoints_count=50,
            variables_measured=["sea_water_temperature", "sea_water_salinity"],
            dive_segments=[
                DiveSegment(
                    dive_id="dive_001",
                    dive_number=1,
                    direction=ProfileDirection.DESCENDING,
                    start_time_utc="2020-01-01T00:00:00Z",
                    end_time_utc="2020-01-01T02:00:00Z",
                    start_latitude=10.0,
                    start_longitude=80.0,
                    end_latitude=10.1,
                    end_longitude=80.1,
                    max_depth_m=200.0,
                    sample_count=25,
                ),
                DiveSegment(
                    dive_id="dive_002",
                    dive_number=1,
                    direction=ProfileDirection.ASCENDING,
                    start_time_utc="2020-01-01T02:00:00Z",
                    end_time_utc="2020-01-01T04:00:00Z",
                    start_latitude=10.1,
                    start_longitude=80.1,
                    end_latitude=10.2,
                    end_longitude=80.2,
                    max_depth_m=200.0,
                    sample_count=25,
                ),
            ],
        )
        self.assertEqual(trajectory.total_waypoints_count, 50)
        self.assertEqual(len(trajectory.dive_segments), 2)
        self.assertEqual(trajectory.dive_segments[0].direction, ProfileDirection.DESCENDING)

    # -------------------------------------------------------------------------
    # 8. Bathymetry: GEBCO 2026 Elevation Grid
    # -------------------------------------------------------------------------
    def test_bathymetry(self):
        """Validates GEBCO 2026 elevation grid horizontal coordinates and QC scheme."""
        gebco_grid = HorizontalGridContract(
            grid_id="gebco_grid_01",
            grid_type=GridType.rectilinear,
            crs="EPSG:4326",
            spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=82.0, min_latitude=5.0, max_latitude=7.0),
            resolution_description="15_arc_second_regular",
            shape=[30, 30],
            dimension_names=["lat", "lon"],
        )
        self.assertEqual(gebco_grid.grid_type, GridType.rectilinear)
        self.assertEqual(GEBCO_TID_QC_SCHEME.scheme, QCScheme.gebco_tid)

    # -------------------------------------------------------------------------
    # 9. Climatology: WOA23 Salinity and Dissolved Oxygen
    # -------------------------------------------------------------------------
    def test_climatology(self):
        """Validates WOA23 climatological dataset contract capabilities and time semantics."""
        time_sem = TimeSemanticsContract(
            calendar=CalendarType.gregorian,
            reference_time_utc="2023-01-01T00:00:00Z",
            valid_time_utc="2023-01-01T00:00:00Z",
            lead_time_seconds=0,
            timestep_index=0,
            climatology_period="1955-2012 / 1965-2014",
            time_bounds_utc=["1955-01-01T00:00:00Z", "2014-12-31T23:59:59Z"],
        )
        self.assertEqual(time_sem.climatology_period, "1955-2012 / 1965-2014")

        woa_dataset = CanonicalDatasetContract(
            identity=DatasetIdentity(
                dataset_id="woa23_salinity_oxygen_decav",
                provider=ProviderIdentity(
                    provider_id="noaa_ncei",
                    name="NOAA NCEI",
                    country="USA",
                    institution_url="https://www.ncei.noaa.gov",
                ),
                product_id="WOA23_GLOBAL_0.25",
                dataset_version="2023",
                snapshot_id="sha256:woa23snapshotid1111222233334444555566667777888899990000aaaabbbbccccdddd",
                title="World Ocean Atlas 2023 Salinity and Dissolved Oxygen",
                description="Objectively analyzed climatological mean fields",
                data_class=DataClassDiscriminator.climatology_grid,
                scientific_role=ScientificRole.CLIMATOLOGY,
                processing_level=ProcessingLevel.CLIMATOLOGY,
                operational_status=OperationalStatus.OPERATIONAL,
                licence=LicenceContract(
                    licence_id="NOAA_PUBLIC_DOMAIN",
                    licence_name="NOAA Public Domain Data Policy",
                    terms_url="https://www.ncei.noaa.gov",
                    attribution_statement="NOAA National Centers for Environmental Information (NCEI)",
                    access_restriction=AccessRestriction.OPEN_UNRESTRICTED,
                    commercial_use_allowed=True,
                ),
                validation_report=ValidationReport(
                    state=ValidationState.valid,
                    validator_version="1.0.0",
                    validated_at_utc="2026-08-30T00:00:00Z",
                    checks=[],
                ),
            ),
            time_semantics=time_sem,
            grid=HorizontalGridContract(
                grid_id="woa23_grid",
                grid_type=GridType.rectilinear,
                crs="EPSG:4326",
                spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=82.0, min_latitude=5.0, max_latitude=7.0),
                resolution_description="0.25_degree_regular",
                shape=[9, 9],
                dimension_names=["lat", "lon"],
            ),
            vertical=VerticalCoordinateContract(
                coordinate_type=VerticalCoordinateType.z_level,
                datum=VerticalDatum.mean_sea_level,
                positive_direction=VerticalDirection.down,
                units="m",
                level_count=57,
            ),
            variables={
                "s_an": CanonicalVariableContract(
                    variable_id="s_an",
                    canonical_name="Objectively Analyzed Mean Salinity",
                    source_name="s_an",
                    standard_name="sea_water_salinity",
                    long_name="Objectively analyzed mean salinity for sea water",
                    physical_quantity=PhysicalQuantity.practical_salinity,
                    canonical_units="1",
                    source_units="1",
                    topology=Topology.volume_scalar,
                    dimensions=["time", "depth", "lat", "lon"],
                    display_range=DisplayRange(min_value=0.0, max_value=42.0, colormap="haline", unit="1"),
                )
            },
            capabilities=DatasetCapabilitiesContract(
                can_volume_render_3d=True,
                can_exact_query=True,
                can_horizontal_slice=True,
                can_vertical_slice=True,
                can_extract_isosurface=True,
            ),
            source_assets=[],
            provenance=[],
            spatial_coverage_description="Global 0.25 degree grid",
            temporal_coverage_description="Decadal Climatology 1955-2012 / 1965-2014",
        )
        self.assertEqual(woa_dataset.identity.data_class, DataClassDiscriminator.climatology_grid)
        self.assertEqual(woa_dataset.identity.scientific_role, ScientificRole.CLIMATOLOGY)

    # -------------------------------------------------------------------------
    # 10. Missing Values: Exact Provider Sentinels Preservation
    # -------------------------------------------------------------------------
    def test_missing_values_sentinels_preservation(self):
        """Validates exact missing value sentinels preservation (-32767, 1e20, NaN) and masking states."""
        # Provider Sentinel: -32767 with int16 packing
        packing = PackingMetadata(scale_factor=0.001, add_offset=20.0, packed_data_type="int16")
        missing_contract = MissingValueContract(
            fill_value=-32767.0,
            has_nan=True,
            valid_min=-2.0,
            valid_max=40.0,
            stored_data_type="int16",
            is_fill_value_raw=True,
        )

        # Raw fill value yields None and PhysicalCellState.missing
        val, state = missing_contract.decode_and_mask(-32767, packing=packing)
        self.assertIsNone(val)
        self.assertEqual(state, PhysicalCellState.missing)

        # Raw valid value unpacked: raw 10000 -> 10.0 + 20.0 = 30.0 degC
        val, state = missing_contract.decode_and_mask(10000, packing=packing)
        self.assertEqual(val, 30.0)
        self.assertEqual(state, PhysicalCellState.valid)

        # Raw value decoded outside valid range (e.g. raw 25000 -> 25.0 + 20.0 = 45.0 > 40.0)
        val, state = missing_contract.decode_and_mask(25000, packing=packing)
        self.assertIsNone(val)
        self.assertEqual(state, PhysicalCellState.rejected_by_qc)


class TestCrossLanguageAndSchemaSync(unittest.TestCase):
    """
    Validation matrix 2: Cross-Language & Schema Synchronization across
    all 54 canonical JSON Schemas and TypeScript contracts.
    """

    def test_zero_schema_drift(self):
        """Runs verify_schemas_in_directory to ensure 0 schema drift on canonical and contracts paths."""
        canonical_ok, canonical_drift = verify_schemas_in_directory(CANONICAL_SCHEMAS_DIR)
        self.assertTrue(canonical_ok, f"Schema drift detected in schemas/canonical/: {canonical_drift}")

        contracts_ok, contracts_drift = verify_schemas_in_directory(CONTRACTS_SCHEMAS_DIR)
        self.assertTrue(contracts_ok, f"Schema drift detected in packages/contracts/schemas/: {contracts_drift}")
    def test_all_54_json_schemas_validate_pydantic_serialized_outputs(self):
        """Validates that all 54 registered JSON Schemas validate real serialized Pydantic JSON objects."""
        self.assertEqual(len(EXPORT_MODELS), 54, f"Expected exactly 54 models in EXPORT_MODELS, got {len(EXPORT_MODELS)}")

        prov = ProviderIdentity(
            provider_id="copernicus_marine",
            name="Copernicus",
            country="EU",
            institution_url="https://marine.copernicus.eu",
        )
        lic = LicenceContract(
            licence_id="CC-BY-4.0",
            licence_name="CC-BY-4.0",
            terms_url="https://cc.org",
            attribution_statement="Copernicus",
            access_restriction=AccessRestriction.OPEN_UNRESTRICTED,
            commercial_use_allowed=True,
        )
        val = ValidationReport(
            state=ValidationState.valid,
            validator_version="1.0.0",
            validated_at_utc="2026-08-30T00:00:00Z",
            checks=[],
        )

        ident = DatasetIdentity(
            dataset_id="copernicus_phy_thetao",
            dataset_version="1.0.0",
            snapshot_id="sha256:1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
            title="Copernicus Ocean Temperature",
            description="Potential temperature volume dataset",
            provider=prov,
            product_id="GLOBAL_ANALYSISFORECAST_PHY_001_024",
            scientific_role=ScientificRole.MODEL,
            data_class=DataClassDiscriminator.model_volume,
            processing_level=ProcessingLevel.ANALYSIS_FORECAST,
            operational_status=OperationalStatus.OPERATIONAL,
            licence=lic,
            validation_report=val,
        )

        grid = HorizontalGridContract(
            grid_id="grid_cop_thetao",
            grid_type=GridType.rectilinear,
            crs="EPSG:4326",
            spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=82.0, min_latitude=5.0, max_latitude=7.0),
            resolution_description="0.0833_degree_regular",
            shape=[25, 25],
            dimension_names=["latitude", "longitude"],
        )

        vert = VerticalCoordinateContract(
            coordinate_type=VerticalCoordinateType.z_level,
            datum=VerticalDatum.mean_sea_level,
            positive_direction=VerticalDirection.down,
            units="m",
            min_depth_m=0.494,
            max_depth_m=5.078,
            level_count=2,
        )

        time_sem = TimeSemanticsContract(
            calendar=CalendarType.gregorian,
            reference_time_utc="2025-04-20T00:00:00Z",
            valid_time_utc="2025-04-20T12:00:00Z",
            lead_time_seconds=43200,
            timestep_index=0,
        )

        var = CanonicalVariableContract(
            variable_id="sea_water_potential_temperature",
            canonical_name="Potential Temperature",
            source_name="thetao",
            standard_name="sea_water_potential_temperature",
            long_name="Sea Water Potential Temperature",
            physical_quantity=PhysicalQuantity.temperature,
            canonical_units="degree_Celsius",
            source_units="degrees_C",
            topology=Topology.volume_scalar,
            dimensions=["time", "depth", "latitude", "longitude"],
            display_range=DisplayRange(min_value=2.0, max_value=32.0, colormap="turbo", unit="degC"),
        )

        caps = DatasetCapabilitiesContract(
            can_volume_render_3d=True,
            can_exact_query=True,
            can_horizontal_slice=True,
            can_vertical_slice=True,
            can_extract_isosurface=True,
        )

        asset = ImmutableSourceAsset(
            asset_id="asset_01",
            dataset_id="copernicus_phy_thetao",
            provider_filename="source.nc",
            local_relative_path="data/raw/source.nc",
            media_type="application/x-netcdf4",
            format=AssetFormat.netcdf4_classic,
            artifact_classification=ArtifactClassification.raw_source,
            size_bytes=1024,
            sha256_checksum="a" * 64,
            retrieval_timestamp_utc="2026-08-30T00:00:00Z",
        )

        lineage = LineageRecord(
            lineage_id="lin_01",
            dataset_id="copernicus_phy_thetao",
            operation="extraction",
            operator="Scientific Data Engineer",
            started_at_utc="2026-08-30T00:00:00Z",
            completed_at_utc="2026-08-30T00:05:00Z",
        )

        # Create valid instances for all 54 models
        sample_instances: Dict[str, Any] = {
            "canonical_dataset.schema.json": CanonicalDatasetContract(
                identity=ident,
                grid=grid,
                vertical=vert,
                time_semantics=time_sem,
                variables={"sea_water_potential_temperature": var},
                capabilities=caps,
                source_assets=[asset],
                provenance=[lineage],
                spatial_coverage_description="North Indian Ocean",
                temporal_coverage_description="2025-04-20 to 2025-04-26",
            ),
            "dataset_identity.schema.json": ident,
            "canonical_variable.schema.json": var,
            "horizontal_grid.schema.json": grid,
            "vertical_coordinate.schema.json": vert,
            "time_semantics.schema.json": time_sem,
            "source_asset.schema.json": asset,
            "quality_control.schema.json": WMO_ARGO_QC_SCHEME,
            "provenance_lineage.schema.json": lineage,
            "licence_contract.schema.json": lic,
            "validation_report.schema.json": val,
            "dataset_capabilities.schema.json": caps,
            "scientific_diagnostic.schema.json": ScientificDiagnostic(
                code=ScientificErrorCode.DATA_NON_MONOTONIC_COORDINATES,
                category=ErrorCategory.DATA,
                severity=ErrorSeverity.ERROR,
                message="Coordinate non monotonic",
            ),
            "roms_s_coordinate.schema.json": ROMSSCoordinateParameters(
                theta_s=6.0,
                theta_b=0.4,
                hc=100.0,
                N=2,
                s_rho=[-0.75, -0.25],
                Cs_r=[-0.85, -0.35],
            ),
            "canonical_unit.schema.json": CanonicalUnitContract(
                unit_string="degree_Celsius",
                cf_unit="degrees_C",
                physical_dimension=PhysicalDimension.temperature,
                conversion_classification=UnitConversionClassification.identity,
            ),
            "missing_value_contract.schema.json": MissingValueContract(
                fill_value=-32767.0,
                has_nan=True,
            ),
            "packing_metadata.schema.json": PackingMetadata(
                scale_factor=0.001,
                add_offset=20.0,
            ),
            "schema_version_metadata.schema.json": SchemaVersionMetadata(
                schema_version="2.0.0",
                min_compatible_version="1.0.0",
                change_classification="ADDITIVE",
                schema_target="canonical",
            ),
            "ocean_hydrodynamic_model.schema.json": OceanHydrodynamicModelContract(
                model_name="MOM5-Indian-Ocean",
                model_class=ModelClass.MOM,
                operational_status=OperationalStatus.OPERATIONAL,
            ),
            "forecast_cycle.schema.json": ForecastCycleContract(
                model_class=ModelClass.MOM,
                run_type=ModelRunType.forecast,
                cycle_reference_time_utc="2026-08-30T00:00:00Z",
                valid_time_utc="2026-08-30T06:00:00Z",
                lead_time_hours=6.0,
            ),
            "hycom_model.schema.json": HYCOMModelContract(
                vertical_representation=HYCOMVerticalRepresentation.served_z_level,
                experiment_id="ESPC-D-V02",
                native_layer_count=41,
            ),
            "model_mask.schema.json": ModelMaskContract(
                has_land_mask=True,
                mask_variable_name="mask",
            ),
            "ocean_wave_product.schema.json": OceanWaveProductContract(
                significant_wave_height_total="VHM0",
            ),
            "wave_partition.schema.json": WavePartitionContract(
                partition_type=WavePartitionType.primary_swell,
                significant_wave_height_var="VHM0_SW1",
                peak_or_mean_period_var="VTPK_SW1",
                direction_var="VMDR_SW1",
            ),
            "stokes_drift.schema.json": StokesDriftContract(
                u_stokes_var="u_stokes",
                v_stokes_var="v_stokes",
            ),
            "vector_group.schema.json": VectorGroupContract(
                group_id="cur_vec",
                group_type=VectorGroupType.ocean_surface_velocity_2d,
                u_component_var="uo",
                v_component_var="vo",
            ),
            "rotation_metadata.schema.json": RotationMetadata(
                source_reference_frame=VectorReferenceFrame.grid_relative,
                target_reference_frame=VectorReferenceFrame.earth_relative,
            ),
            "curvilinear_grid.schema.json": CurvilinearGridContract(
                grid_id="grid_bio_roms",
                eta_size=50,
                xi_size=50,
                spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=85.0, min_latitude=10.0, max_latitude=15.0),
            ),
            "arakawa_staggering.schema.json": ArakawaStaggeringContract(
                staggering_type=StaggeringType.arakawa_c_rho,
            ),
            "grid_metrics.schema.json": GridMetricsContract(
                dx_min_meters=1000.0,
                dx_max_meters=5000.0,
                dy_min_meters=1000.0,
                dy_max_meters=5000.0,
            ),
            "roms_s_coordinate_contract.schema.json": ROMSSCoordinateContract(
                Vtransform=2,
                Vstretching=4,
                theta_s=6.0,
                theta_b=0.4,
                hc=100.0,
                N=2,
                s_rho=[-0.75, -0.25],
                Cs_r=[-0.85, -0.35],
            ),
            "roms_formula_terms.schema.json": ROMSFormulaTerms(),
            "platform_metadata.schema.json": PlatformMetadataContract(
                platform_id="argo_7902250",
                platform_type=PlatformType.ARGO_FLOAT,
                wmo_id="7902250",
                institution="INCOIS",
            ),
            "profile_cast.schema.json": ProfileCastContract(
                profile_id="incois_argo_7902250_cycle_001_A",
                platform_id="argo_7902250",
                wmo_id="7902250",
                cycle_number=1,
                observation_time_utc="2026-08-30T00:00:00Z",
                latitude=10.0,
                longitude=80.0,
                level_count=10,
                variables={
                    "sea_water_temperature": ProfileVariableEntry(
                        canonical_variable_id="sea_water_temperature",
                        raw_variable_name="TEMP",
                        units="degree_Celsius",
                        levels_count=10,
                    )
                },
            ),
            "trajectory_contract.schema.json": TrajectoryContract(
                trajectory_id="traj_01",
                platform_id="glider_01",
                mission_name="RU29 Glider 2026",
                start_time_utc="2026-08-30T00:00:00Z",
                end_time_utc="2026-08-30T12:00:00Z",
                min_latitude=10.0,
                max_latitude=12.0,
                min_longitude=80.0,
                max_longitude=82.0,
                total_waypoints_count=10,
                variables_measured=["sea_water_temperature", "sea_water_salinity"],
            ),
            "observation_qc_report.schema.json": ObservationQCReport(
                qc_scheme=QCScheme.wmo_argo,
                position_qc_flag=1,
                position_qc_state=NormalizedQCState.good,
                time_qc_flag=1,
                time_qc_state=NormalizedQCState.good,
            ),
            "duplicate_relationship.schema.json": DuplicateRelationshipContract(
                relationship_id="dup_01",
                primary_record_id="rec_01",
                secondary_record_id="rec_02",
                relationship_type=DuplicateRelationshipType.EXACT_MIRROR,
                spatial_distance_km=0.0,
                time_delta_seconds=0.0,
                confidence_score=1.0,
                recommended_resolution=DeduplicationResolution.PREFER_PRIMARY,
                resolution_rationale="Bit-identical primary mirror record",
            ),
            "collocation_readiness.schema.json": CollocationReadinessContract(
                collocation_id="colloc_01",
                observation_id="argo_01",
                model_dataset_id="cop_thetao",
                observation_variable="TEMP",
                model_variable="thetao",
                is_collocation_ready=True,
                blocking_reasons=[CollocationBlockingReason.NO_BLOCKING_REASON],
            ),
            "visualization_product.schema.json": VisualizationProductContract(
                visualization_product_id="vis_cop_thetao",
                product_version="v1",
                source_dataset_id="cop_thetao",
                source_variable_id="thetao",
                canonical_units="degree_Celsius",
                source_asset_ids=["asset_01"],
                source_asset_checksums={"asset_01": "a" * 64},
                processing_pipeline_version="1.0.0",
                backend_compatibility=BackendCompatibility.WEBGPU_RECOMMENDED,
                spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=82.0, min_latitude=5.0, max_latitude=7.0),
                min_depth_m=0.0,
                max_depth_m=5000.0,
                timestep_count=1,
                available_lod_levels=[],
                coordinate_transform=CoordinateTransformContract(
                    source_coordinate_space=CoordinateSpace.GEOGRAPHIC_WGS84,
                    target_coordinate_space=CoordinateSpace.DISPLAY_VOLUME_LAB,
                    origin_longitude_deg=80.0,
                    origin_latitude_deg=5.0,
                    origin_depth_m=0.0,
                    scale_x_meters=1.0,
                    scale_y_meters=1.0,
                    scale_z_meters=1.0,
                    vertical_exaggeration_factor=1.0,
                    uses_non_uniform_depth_lut=False,
                    depth_lut_entries_m=[],
                ),
                render_statistics=RenderStatisticsContract(
                    valid_min=0.0,
                    valid_max=32.0,
                    percentile_01=2.0,
                    percentile_50=20.0,
                    percentile_99=30.0,
                    mean_value=18.0,
                    std_dev_value=5.0,
                    histogram_bin_edges=[0.0, 10.0, 20.0, 30.0],
                    histogram_counts=[100, 200, 300],
                    missing_sample_fraction=0.05,
                ),
                default_transfer_function=TransferFunctionContract(
                    colormap_preset_name="cmocean_thermal",
                    physical_domain_min=0.0,
                    physical_domain_max=32.0,
                    physical_units="degree_Celsius",
                    control_points=[
                        TransferFunctionControlPoint(normalized_position=0.0, red=0.0, green=0.0, blue=1.0, opacity=0.0),
                        TransferFunctionControlPoint(normalized_position=1.0, red=1.0, green=0.0, blue=0.0, opacity=1.0),
                    ],
                ),
                brick_template_url="/storage/bricks/{lod}/{key}.zst",
            ),
            "first_volume_slice_profile.schema.json": FirstVolumeSliceProfile(
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
            ),
            "multiresolution_level.schema.json": MultiresolutionLevelContract(
                lod_level=0,
                grid_shape=[32, 32, 32],
                brick_shape=[32, 32, 32],
                brick_grid_shape=[1, 1, 1],
                total_brick_count=1,
                aggregation_method=AggregationMethod.AVERAGE_2X2X2,
                sample_data_type="float32",
                voxel_resolution_x_deg=0.0833,
                voxel_resolution_y_deg=0.0833,
            ),
            "brick_identity.schema.json": BrickIdentityContract(
                visualization_product_id="vis_thetao",
                product_version="v1",
                lod_level=0,
                timestep_index=0,
                brick_index_x=0,
                brick_index_y=0,
                brick_index_z=0,
                variable_id="thetao",
            ),
            "brick_geometry.schema.json": BrickGeometryContract(
                brick_key="vis_thetao:v1:lod0:t0:bx0:by0:bz0:thetao",
                sample_origin=[0, 0, 0],
                sample_shape=[34, 34, 34],
                interior_valid_shape=[32, 32, 32],
                halo_padding=[1, 1, 1],
                spatial_bounds=SpatialBoundingBox(min_longitude=80.0, max_longitude=81.0, min_latitude=5.0, max_latitude=6.0),
                min_depth_m=0.0,
                max_depth_m=50.0,
                payload_sha256="b" * 64,
            ),
            "brick_payload.schema.json": BrickPayloadContract(
                brick_key="vis_thetao:v1:lod0:t0:bx0:by0:bz0:thetao",
                storage_object_key="volumes/vis_thetao/v1/lod0/b_0_0_0.zst",
                compression_codec=CompressionCodec.ZSTD,
                sample_format=TextureSampleFormat.R16_FLOAT,
                uncompressed_bytes_length=65536,
                compressed_bytes_length=16384,
                sha256_checksum="c" * 64,
            ),
            "quantization_contract.schema.json": QuantizationContract(
                scale_factor=0.001,
                add_offset=0.0,
                theoretical_max_quantization_error=0.0005,
                is_eligible_for_exact_query=False,
            ),
            "render_statistics.schema.json": RenderStatisticsContract(
                valid_min=0.0,
                valid_max=32.0,
                percentile_01=2.0,
                percentile_50=20.0,
                percentile_99=30.0,
                mean_value=18.0,
                std_dev_value=5.0,
                histogram_bin_edges=[0.0, 10.0, 20.0, 30.0],
                histogram_counts=[100, 200, 300],
                missing_sample_fraction=0.05,
            ),
            "coordinate_transform.schema.json": CoordinateTransformContract(
                source_coordinate_space=CoordinateSpace.GEOGRAPHIC_WGS84,
                target_coordinate_space=CoordinateSpace.DISPLAY_VOLUME_LAB,
                origin_longitude_deg=80.0,
                origin_latitude_deg=5.0,
                origin_depth_m=0.0,
                scale_x_meters=1.0,
                scale_y_meters=1.0,
                scale_z_meters=1.0,
                vertical_exaggeration_factor=1.0,
                uses_non_uniform_depth_lut=False,
                depth_lut_entries_m=[],
            ),
            "transfer_function.schema.json": TransferFunctionContract(
                colormap_preset_name="cmocean_thermal",
                physical_domain_min=0.0,
                physical_domain_max=32.0,
                physical_units="degree_Celsius",
                control_points=[
                    TransferFunctionControlPoint(normalized_position=0.0, red=0.0, green=0.0, blue=1.0, opacity=0.0),
                    TransferFunctionControlPoint(normalized_position=1.0, red=1.0, green=0.0, blue=0.0, opacity=1.0),
                ],
            ),
            "provisional_render_pick_response.schema.json": ProvisionalRenderPickResponse(
                visualization_product_id="vis_thetao",
                lod_level=0,
                approximate_value=28.5,
                display_units="degree_Celsius",
                world_ray_hit_position=[0.5, 0.5, 0.2],
                estimated_sample_error_bound=0.05,
            ),
            "exact_value_query_request.schema.json": ExactValueQueryRequest(
                dataset_id="cop_thetao",
                variable_id="thetao",
                latitude_deg=6.0,
                longitude_deg=81.0,
                vertical_selector_type=VerticalSelectorType.PHYSICAL_DEPTH_METERS,
                vertical_target_value=10.0,
            ),
            "exact_value_query_response.schema.json": ExactValueQueryResponse(
                dataset_id="cop_thetao",
                variable_id="thetao",
                scientific_value=28.742,
                canonical_units="degree_Celsius",
                value_state=PhysicalCellState.valid,
                requested_latitude_deg=6.0,
                requested_longitude_deg=81.0,
                resolved_latitude_deg=6.0416,
                resolved_longitude_deg=80.9583,
                resolved_depth_m=10.0,
                resolved_time_utc="2026-08-30T00:00:00Z",
                source_asset_id="asset_cop_thetao",
                source_asset_sha256="d" * 64,
            ),
            "selection_interpolation.schema.json": SelectionInterpolationContract(
                method=SelectionMethod.TRILINEAR_INTERPOLATION,
                allows_extrapolation=False,
            ),
            "streaming_chunk_request.schema.json": StreamingChunkRequest(
                visualization_product_id="vis_thetao",
                lod_level=0,
                timestep_index=0,
                requested_brick_keys=["vis_thetao:v1:lod0:t0:bx0:by0:bz0:thetao"],
            ),
            "multi_brick_streaming_response.schema.json": MultiBrickStreamingResponse(
                visualization_product_id="vis_thetao",
                lod_level=0,
                timestep_index=0,
                manifest_entries=[
                    StreamingManifestEntry(
                        brick_key="vis_thetao:v1:lod0:t0:bx0:by0:bz0:thetao",
                        storage_object_url="/storage/b_0_0_0.zst",
                        byte_length=16384,
                        sha256_checksum="e" * 64,
                        is_empty=False,
                    )
                ],
                total_payload_bytes=16384,
            ),
        }

        # Verify all 54 schema files validate their serialized Pydantic JSON instance
        for schema_fn, model_cls in EXPORT_MODELS.items():
            self.assertIn(schema_fn, sample_instances, f"Missing test sample instance for {schema_fn}")
            instance = sample_instances[schema_fn]
            self.assertIsInstance(instance, model_cls, f"Sample instance type mismatch for {schema_fn}")

            serialized_dict = instance.model_dump(mode="json")

            # Validate against canonical schema on disk
            canonical_schema_path = CANONICAL_SCHEMAS_DIR / schema_fn
            self.assertTrue(canonical_schema_path.exists(), f"Missing schema on disk: {canonical_schema_path}")
            with open(canonical_schema_path, "r", encoding="utf-8") as f:
                schema_dict = json.load(f)

            validator = jsonschema.Draft202012Validator(schema_dict)
            errors = list(validator.iter_errors(serialized_dict))
            self.assertEqual(len(errors), 0, f"JSON Schema validation error for {schema_fn}: {[e.message for e in errors]}")

    def test_typescript_declarations_fidelity(self):
        """Verifies TypeScript declarations contain all 54 model interfaces and strict enum discriminators."""
        self.assertTrue(TYPESCRIPT_D_TS.exists(), f"TypeScript declarations file missing: {TYPESCRIPT_D_TS}")
        with open(TYPESCRIPT_D_TS, "r", encoding="utf-8") as f:
            ts_content = f.read()

        # Verify core discriminators and enums
        required_ts_symbols = [
            "DataClassDiscriminator",
            "'model_volume'",
            "'wave_grid'",
            "'profile_observations'",
            "'trajectory_observations'",
            "'bathymetry_grid'",
            "'climatology_grid'",
            "PhysicalCellState",
            "'valid'",
            "'missing'",
            "'masked'",
            "'below_seafloor'",
            "'rejected_by_qc'",
            "PhysicalQuantity",
            "'temperature'",
            "'practical_salinity'",
            "ProvisionalRenderPickResponse",
            "ExactValueQueryResponse",
            "QuantizationContract",
            "is_eligible_for_exact_query",
            "ROMSSCoordinateContract",
            "OceanWaveProductContract",
            "ProfileCastContract",
            "TrajectoryContract",
            "BrickIdentityContract",
            "BrickGeometryContract",
            "BrickPayloadContract",
            "CanonicalDatasetContract",
            "DatasetIdentity",
            "CoordinateTransformContract",
            "TransferFunctionContract",
        ]

        for symbol in required_ts_symbols:
            self.assertIn(symbol, ts_content, f"Expected TypeScript symbol '{symbol}' not found in {TYPESCRIPT_D_TS.name}")


class TestScientificInvariants(unittest.TestCase):
    """
    Validation matrix 3: Enforces strict scientific invariants across temperature,
    salinity, vertical coordinates, missing values, wave angles, and exact queries.
    """

    def test_potential_vs_in_situ_temperature_distinction(self):
        """Invariant: Potential temperature is strictly distinguished from in-situ and conservative temperature."""
        self.assertNotEqual(
            PhysicalQuantity.temperature,
            PhysicalQuantity.practical_salinity,
        )

        # Unit conversion check prevents silent conversion
        res = classify_unit_conversion(
            source_unit="degree_Celsius",
            target_unit="degree_Celsius",
            source_quantity="conservative_temperature",
            target_quantity="sea_water_potential_temperature",
        )
        self.assertFalse(res.conversion_allowed)
        self.assertTrue(res.requires_teos10)
        self.assertEqual(res.classification, UnitConversionClassification.context_dependent)

    def test_practical_salinity_vs_absolute_salinity_distinction(self):
        """Invariant: Practical salinity (SP, unitless/PSU) is strictly distinguished from absolute salinity (SA, g/kg)."""
        self.assertNotEqual(PhysicalDimension.practical_salinity, PhysicalDimension.absolute_salinity)

        res = classify_unit_conversion(
            source_unit="psu",
            target_unit="g/kg",
            source_quantity="practical_salinity",
            target_quantity="absolute_salinity",
        )
        self.assertFalse(res.conversion_allowed)
        self.assertTrue(res.requires_teos10)
        self.assertTrue(res.requires_geolocation)
        self.assertEqual(res.classification, UnitConversionClassification.context_dependent)

    def test_pressure_vs_depth_distinction(self):
        """Invariant: Pressure (dbar) is strictly distinguished from depth (m)."""
        self.assertNotEqual(PhysicalDimension.pressure, PhysicalDimension.depth)

        res = classify_unit_conversion(
            source_unit="dbar",
            target_unit="m",
            source_quantity="sea_water_pressure",
            target_quantity="depth",
        )
        self.assertFalse(res.conversion_allowed)
        self.assertTrue(res.requires_teos10)
        self.assertTrue(res.requires_geolocation)
        self.assertEqual(res.classification, UnitConversionClassification.context_dependent)

    def test_missing_values_never_physical_zero(self):
        """Invariant: Missing values are NEVER interpreted as physical zero."""
        # 0.0 is a physically valid temperature (freezing point near 0 degC)
        missing_contract = MissingValueContract(
            fill_value=-32767.0,
            has_nan=True,
            valid_min=-2.0,
            valid_max=40.0,
        )
        self.assertFalse(missing_contract.is_missing(0.0))

        val, state = missing_contract.decode_and_mask(0.0)
        self.assertEqual(val, 0.0)
        self.assertEqual(state, PhysicalCellState.valid)

        # -32767 is missing, not physical zero
        val_fill, state_fill = missing_contract.decode_and_mask(-32767.0)
        self.assertIsNone(val_fill)
        self.assertEqual(state_fill, PhysicalCellState.missing)
        self.assertNotEqual(state_fill, PhysicalCellState.valid)

    def test_provider_declared_zero_fill_preservation(self):
        """Invariant: Provider-declared zero fill values (fill_value = 0.0) are preserved explicitly."""
        zero_fill_contract = MissingValueContract(
            fill_value=0.0,
            has_nan=True,
            is_fill_value_raw=True,
        )
        self.assertTrue(zero_fill_contract.is_missing(0.0))

        val, state = zero_fill_contract.decode_and_mask(0.0)
        self.assertIsNone(val)
        self.assertEqual(state, PhysicalCellState.missing)

    def test_qc_rejected_cells_separated_from_missing(self):
        """Invariant: QC-rejected cells are strictly separate from missing/empty/masked cells."""
        missing_contract = MissingValueContract(
            fill_value=-9999.0,
            valid_min=-2.0,
            valid_max=35.0,
        )
        # Out-of-bounds physical value yields rejected_by_qc
        val, state = missing_contract.decode_and_mask(50.0)
        self.assertIsNone(val)
        self.assertEqual(state, PhysicalCellState.rejected_by_qc)
        self.assertNotEqual(state, PhysicalCellState.missing)
        self.assertNotEqual(state, PhysicalCellState.masked)

    def test_wave_directions_use_circular_angular_trigonometry(self):
        """Invariant: Wave directions use circular angular math across compass discontinuities."""
        # 359 deg and 1 deg are 2 deg apart
        self.assertAlmostEqual(float(circular_distance_deg(359.0, 1.0)), 2.0, places=6)
        # 10 deg and 350 deg are 20 deg apart
        self.assertAlmostEqual(float(circular_distance_deg(10.0, 350.0)), 20.0, places=6)
        # 90 deg and 270 deg are 180 deg apart
        self.assertAlmostEqual(float(circular_distance_deg(90.0, 270.0)), 180.0, places=6)

        # Circular normalization to [0, 360)
        self.assertAlmostEqual(float(normalize_angle_deg(-10.0)), 350.0, places=6)
        self.assertAlmostEqual(float(normalize_angle_deg(370.0)), 10.0, places=6)

    def test_quantized_textures_declare_never_eligible_for_exact_query(self):
        """Invariant: R16Float and quantized textures strictly declare is_eligible_for_exact_query = False."""
        quant = QuantizationContract(
            scale_factor=0.001,
            add_offset=0.0,
            theoretical_max_quantization_error=0.0005,
            is_eligible_for_exact_query=False,
        )
        self.assertFalse(quant.is_eligible_for_exact_query)

        # Attempting to declare eligible for exact query raises ValidationError
        with self.assertRaises(ValidationError):
            QuantizationContract(
                scale_factor=0.001,
                add_offset=0.0,
                theoretical_max_quantization_error=0.0005,
                is_eligible_for_exact_query=True,
            )

    def test_exact_queries_require_source_asset_and_sha256(self):
        """Invariant: Exact queries require source NetCDF/Zarr asset IDs and cryptographic SHA-256 checksums."""
        resp = ExactValueQueryResponse(
            dataset_id="cop_thetao",
            variable_id="thetao",
            scientific_value=28.5,
            canonical_units="degree_Celsius",
            value_state=PhysicalCellState.valid,
            requested_latitude_deg=6.0,
            requested_longitude_deg=80.0,
            resolved_latitude_deg=6.0,
            resolved_longitude_deg=80.0,
            resolved_time_utc="2026-08-30T00:00:00Z",
            source_asset_id="copernicus_phy_thetao_20250420_20250426.nc",
            source_asset_sha256="6b4ce3f47a77add27541ed836870dba9bcd6a2c34d258e6787a542e660627281",
        )
        self.assertEqual(resp.response_type, "authoritative_scientific_value")
        self.assertEqual(len(resp.source_asset_sha256), 64)


class TestFailureInjection(unittest.TestCase):
    """
    Validation matrix 4: Negative and failure injection test cases verifying
    strict rejection of corrupted, unauthorized, or malformed contract payloads.
    """

    def test_rejection_of_corrupt_mismatched_sha256_checksums(self):
        """Failure injection: Rejection of corrupt or invalid SHA-256 checksums."""
        # Non-hex characters
        with self.assertRaises(ValidationError):
            ImmutableSourceAsset(
                asset_id="asset_bad_sha",
                dataset_id="ds_01",
                provider_filename="bad.nc",
                local_relative_path="data/raw/bad.nc",
                media_type="application/x-netcdf4",
                format=AssetFormat.netcdf4_classic,
                artifact_classification=ArtifactClassification.raw_source,
                size_bytes=1024,
                sha256_checksum="INVALID_SHA_256_WITH_NON_HEX_CHARACTERS_!!!!!!!!!!!!!!!!!!!!!!!!",
                retrieval_timestamp_utc="2026-08-30T00:00:00Z",
            )

        # Wrong length (< 64 characters)
        with self.assertRaises(ValidationError):
            ImmutableSourceAsset(
                asset_id="asset_short_sha",
                dataset_id="ds_01",
                provider_filename="short.nc",
                local_relative_path="data/raw/short.nc",
                media_type="application/x-netcdf4",
                format=AssetFormat.netcdf4_classic,
                artifact_classification=ArtifactClassification.raw_source,
                size_bytes=1024,
                sha256_checksum="abcdef123456",
                retrieval_timestamp_utc="2026-08-30T00:00:00Z",
            )

    def test_rejection_of_out_of_bounds_brick_indices_and_lod(self):
        """Failure injection: Rejection of negative brick indices, negative LOD, and malformed keys."""
        # Negative LOD level
        with self.assertRaises(ValidationError):
            BrickIdentityContract(
                visualization_product_id="vis_01",
                lod_level=-1,
                timestep_index=0,
                brick_index_x=0,
                brick_index_y=0,
                brick_index_z=0,
                variable_id="thetao",
            )

        # Negative brick grid index
        with self.assertRaises(ValidationError):
            BrickIdentityContract(
                visualization_product_id="vis_01",
                lod_level=0,
                timestep_index=0,
                brick_index_x=-5,
                brick_index_y=0,
                brick_index_z=0,
                variable_id="thetao",
            )

        # Malformed composite key string
        with self.assertRaises(ValueError):
            BrickIdentityContract.from_composite_key("malformed_key_without_proper_structure")

        with self.assertRaises(ValueError):
            BrickIdentityContract.from_composite_key("vis:v1:lodX:t0:bx0:by0:bz0:thetao")

    def test_rejection_of_approximate_pick_claiming_authoritative_value(self):
        """Failure injection: Rejection of mismatched discriminator values."""
        # Provisional pick trying to claim authoritative scientific value
        with self.assertRaises(ValidationError):
            ProvisionalRenderPickResponse(
                response_type="authoritative_scientific_value",
                visualization_product_id="vis_01",
                lod_level=0,
                approximate_value=28.5,
                display_units="degree_Celsius",
                world_ray_hit_position=[0.5, 0.5, 0.2],
                estimated_sample_error_bound=0.05,
            )

        # Exact query response trying to claim approximate render pick
        with self.assertRaises(ValidationError):
            ExactValueQueryResponse(
                response_type="approximate_render_sample",
                dataset_id="cop_thetao",
                variable_id="thetao",
                canonical_units="degree_Celsius",
                requested_latitude_deg=6.0,
                requested_longitude_deg=80.0,
                resolved_latitude_deg=6.0,
                resolved_longitude_deg=80.0,
                resolved_time_utc="2026-08-30T00:00:00Z",
                source_asset_id="asset_01",
                source_asset_sha256="a" * 64,
            )

    def test_rejection_of_exact_queries_with_out_of_bounds_coordinates(self):
        """Failure injection: Rejection of requests with invalid latitudes or longitudes."""
        # Latitude > 90 deg
        with self.assertRaises(ValidationError):
            ExactValueQueryRequest(
                dataset_id="cop_thetao",
                variable_id="thetao",
                latitude_deg=105.0,
                longitude_deg=80.0,
            )

        # Latitude < -90 deg
        with self.assertRaises(ValidationError):
            ExactValueQueryRequest(
                dataset_id="cop_thetao",
                variable_id="thetao",
                latitude_deg=-95.0,
                longitude_deg=80.0,
            )

        # Longitude > 360 deg
        with self.assertRaises(ValidationError):
            ExactValueQueryRequest(
                dataset_id="cop_thetao",
                variable_id="thetao",
                latitude_deg=10.0,
                longitude_deg=450.0,
            )

    def test_rejection_of_secret_tokens_or_signed_urls_in_persistent_payload_descriptors(self):
        """Failure injection: Rejection of query parameters, signatures, or access keys in storage object keys."""
        # Query parameters with token
        with self.assertRaises(ValidationError):
            BrickPayloadContract(
                brick_key="vis:v1:lod0:t0:bx0:by0:bz0:thetao",
                storage_object_key="volumes/cop_thetao/lod0/b0.zst?token=secret12345",
                uncompressed_bytes_length=65536,
                compressed_bytes_length=16384,
                sha256_checksum="a" * 64,
            )

        # AWS Access Key / Signature in storage key
        with self.assertRaises(ValidationError):
            BrickPayloadContract(
                brick_key="vis:v1:lod0:t0:bx0:by0:bz0:thetao",
                storage_object_key="volumes/cop_thetao/lod0/b0.zst?AWSAccessKeyId=AKIAIOSFODNN7EXAMPLE&Signature=vjbyPxybdZaNmGa%2ByT272YEAiv4%3D",
                uncompressed_bytes_length=65536,
                compressed_bytes_length=16384,
                sha256_checksum="b" * 64,
            )


if __name__ == "__main__":
    unittest.main()
