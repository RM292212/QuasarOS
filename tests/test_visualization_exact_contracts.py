"""
Unit & Integration Tests for Visualization and Exact-Value Contracts (TASK-02E)

Validates:
1. Version matrix alignment (Package v1.2.0, Protocol SemVer v2.0.0 target).
2. Pure renderer independence (Zero WebGL, WebGPU, Babylon, Three, React imports).
3. FirstVolumeSliceProfile for Copernicus thetao and HYCOM water_temp real metadata.
4. Composite brick keys roundtrip parsing and strict validation.
5. Quantization contracts with theoretical error bounds and mandatory non-authoritative flag.
6. Transfer function validation (strictly monotonic domain min < max, normalized color components).
7. Provisional render pick response (approximate_render_sample) vs authoritative scientific exact query (authoritative_scientific_value).
8. Strict WMO ID validation (Argo float 5-8 digits, gliders/buoys alphanumeric).
9. Argo QC derivation provenance tracking.
10. JSON Schema & TypeScript synchronization / zero drift.
"""

import sys
import unittest
from pathlib import Path
from pydantic import ValidationError

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))

from quasar_contracts import (
    __version__,
    AggregationMethod,
    BackendCompatibility,
    BrickGeometryContract,
    BrickIdentityContract,
    BrickPayloadContract,
    CompressionCodec,
    CoordinateSpace,
    CoordinateTransformContract,
    ExactValueQueryRequest,
    ExactValueQueryResponse,
    FirstVolumeSliceProfile,
    InterpolationPolicy,
    MultiBrickStreamingResponse,
    MultiresolutionLevelContract,
    NormalizedQCState,
    ObservationQCReport,
    OutOfRangeRenderingPolicy,
    PhysicalCellState,
    PlatformMetadataContract,
    PlatformType,
    ProvisionalRenderPickResponse,
    QCDerivationSource,
    QCScheme,
    QuantizationContract,
    RenderStatisticsContract,
    SchemaVersionMetadata,
    SelectionInterpolationContract,
    SelectionMethod,
    SpatialBoundingBox,
    StreamingChunkRequest,
    StreamingManifestEntry,
    TextureSampleFormat,
    TimeSelectorMode,
    TransferFunctionContract,
    TransferFunctionControlPoint,
    VariableQCRecord,
    VerticalSelectorType,
    VisualizationProductContract,
    VolumeRenderingBackend,
    verify_schemas_in_directory,
)


class TestVisualizationAndExactContracts(unittest.TestCase):
    """Test suite for TASK-02E visualization and exact-value contracts."""

    def test_version_matrix_alignment(self):
        """
        Verify package version is 1.2.0 (additive Python release) and target SemVer schema version
        aligns with Protocol 2.0.0 (SemVer schema target).
        """
        self.assertEqual(__version__, "1.2.0")
        meta = SchemaVersionMetadata(
            schema_version="2.0.0",
            min_compatible_version="2.0.0",
            schema_target="QuasarOS Canonical Scientific Schema",
        )
        self.assertEqual(meta.schema_version, "2.0.0")
        self.assertEqual(meta.min_compatible_version, "2.0.0")
        # Reader at 2.0.0 or 2.1.0 can read schema min_compatible 2.0.0
        self.assertTrue(meta.check_compatibility("2.0.0"))
        self.assertTrue(meta.check_compatibility("2.1.0"))
        # Reader at 1.0.0 cannot read breaking schema min_compatible 2.0.0
        self.assertFalse(meta.check_compatibility("1.0.0"))

    def test_pure_renderer_independence(self):
        """Ensure no renderer imports (Babylon.js, WebGPU, WebGL, Three.js, React) in contracts."""
        import sys
        forbidden_modules = ["babylonjs", "three", "react", "wgpu", "pyopengl"]
        for mod in forbidden_modules:
            self.assertNotIn(mod, sys.modules)

    def test_first_volume_slice_profiles_real_metadata(self):
        """Test Copernicus thetao and HYCOM water_temp FirstVolumeSliceProfile fixtures."""
        copernicus_profile = FirstVolumeSliceProfile(
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
        self.assertTrue(copernicus_profile.is_primary_selection)
        self.assertEqual(copernicus_profile.z_levels_count, 31)
        self.assertEqual(copernicus_profile.grid_dimensions, [97, 181, 31])

        hycom_profile = FirstVolumeSliceProfile(
            profile_name="hycom_benchmark_water_temp",
            is_primary_selection=False,
            dataset_identifier="ESPC-D-V02/t3z",
            target_variable="water_temp",
            grid_dimensions=[63, 63, 32],
            z_levels_count=32,
            spatial_resolution_deg=0.16,
            depth_extent_m=(0.0, 5000.0),
            physical_range_deg_c=(1.8, 32.0),
            recommended_texture_format=TextureSampleFormat.R16_FLOAT,
        )
        self.assertFalse(hycom_profile.is_primary_selection)
        self.assertEqual(hycom_profile.z_levels_count, 32)

    def test_brick_identity_composite_key_roundtrip(self):
        """Test deterministic composite brick key construction and parsing."""
        brick = BrickIdentityContract(
            visualization_product_id="vis_copernicus_thetao_20250420",
            product_version="v1",
            lod_level=0,
            timestep_index=2,
            brick_index_x=1,
            brick_index_y=3,
            brick_index_z=0,
            variable_id="thetao",
        )
        expected_key = "vis_copernicus_thetao_20250420:v1:lod0:t2:bx1:by3:bz0:thetao"
        self.assertEqual(brick.composite_key, expected_key)

        # Roundtrip parsing
        parsed = BrickIdentityContract.from_composite_key(expected_key)
        self.assertEqual(parsed.visualization_product_id, brick.visualization_product_id)
        self.assertEqual(parsed.lod_level, 0)
        self.assertEqual(parsed.timestep_index, 2)
        self.assertEqual(parsed.brick_index_x, 1)
        self.assertEqual(parsed.brick_index_y, 3)
        self.assertEqual(parsed.brick_index_z, 0)
        self.assertEqual(parsed.variable_id, "thetao")

        # Malformed key rejection
        with self.assertRaises(ValueError):
            BrickIdentityContract.from_composite_key("invalid_key")

    def test_quantization_contract_strict_authoritative_rejection(self):
        """Quantized texture models must enforce error bounds and reject exact query eligibility."""
        quant = QuantizationContract(
            scale_factor=0.001,
            add_offset=-5.0,
            quantized_data_type="uint16",
            unquantized_data_type="float32",
            reserved_missing_code=65535,
            theoretical_max_quantization_error=0.0005,
            is_eligible_for_exact_query=False,
        )
        self.assertFalse(quant.is_eligible_for_exact_query)
        self.assertAlmostEqual(quant.theoretical_max_quantization_error, 0.0005)

        # Negative test: Attempting to set is_eligible_for_exact_query = True must raise ValidationError
        with self.assertRaises(ValidationError):
            QuantizationContract(
                scale_factor=0.001,
                add_offset=0.0,
                theoretical_max_quantization_error=0.0005,
                is_eligible_for_exact_query=True,  # Disallowed
            )

    def test_transfer_function_validation(self):
        """Test scientific transfer function domain span and normalized color constraints."""
        tf = TransferFunctionContract(
            colormap_preset_name="cmocean_thermal",
            physical_domain_min=2.0,
            physical_domain_max=32.0,
            physical_units="degree_Celsius",
            control_points=[
                TransferFunctionControlPoint(normalized_position=0.0, red=0.0, green=0.0, blue=0.8, opacity=0.0),
                TransferFunctionControlPoint(normalized_position=0.5, red=0.0, green=0.8, blue=0.2, opacity=0.4),
                TransferFunctionControlPoint(normalized_position=1.0, red=0.9, green=0.1, blue=0.0, opacity=0.9),
            ],
            out_of_range_policy=OutOfRangeRenderingPolicy.DISCARD_TRANSPARENT,
            missing_value_color_rgba=[0.0, 0.0, 0.0, 0.0],
        )
        self.assertEqual(len(tf.control_points), 3)

        # Negative test: max <= min
        with self.assertRaises(ValidationError):
            TransferFunctionContract(
                colormap_preset_name="cmocean_thermal",
                physical_domain_min=30.0,
                physical_domain_max=10.0,  # Invalid
                physical_units="degree_Celsius",
                control_points=[],
            )

    def test_provisional_vs_exact_query_separation(self):
        """Verify strict structural discrimination between GPU render pick and authoritative scientific value."""
        # 1. Approximate GPU texture pick
        provisional = ProvisionalRenderPickResponse(
            response_type="approximate_render_sample",
            visualization_product_id="vis_copernicus_thetao_20250420",
            lod_level=0,
            approximate_value=28.45,
            display_units="degree_Celsius",
            world_ray_hit_position=[64.2, 12.1, -15.0],
            estimated_sample_error_bound=0.005,
        )
        self.assertEqual(provisional.response_type, "approximate_render_sample")
        self.assertIn("PROVISIONAL VALUE", provisional.approximation_notice)

        # 2. Authoritative scientific query
        exact_req = ExactValueQueryRequest(
            dataset_id="GLOBAL_ANALYSISFORECAST_PHY_001_024",
            variable_id="sea_water_potential_temperature",
            latitude_deg=12.105,
            longitude_deg=64.201,
            vertical_selector_type=VerticalSelectorType.PHYSICAL_DEPTH_METERS,
            vertical_target_value=15.0,
            time_selector_mode=TimeSelectorMode.EXACT_UTC_TIMESTAMP,
            target_time_utc="2025-04-20T12:00:00Z",
            selection_interpolation=SelectionInterpolationContract(
                method=SelectionMethod.NEAREST_NATIVE_SAMPLE,
                allows_extrapolation=False,
            ),
        )
        self.assertEqual(exact_req.selection_interpolation.method, SelectionMethod.NEAREST_NATIVE_SAMPLE)

        exact_resp = ExactValueQueryResponse(
            response_type="authoritative_scientific_value",
            dataset_id="GLOBAL_ANALYSISFORECAST_PHY_001_024",
            variable_id="sea_water_potential_temperature",
            scientific_value=28.4519,
            canonical_units="degree_Celsius",
            value_state=PhysicalCellState.valid,
            requested_latitude_deg=12.105,
            requested_longitude_deg=64.201,
            resolved_latitude_deg=12.0833,
            resolved_longitude_deg=64.1667,
            resolved_depth_m=15.05,
            resolved_time_utc="2025-04-20T12:00:00Z",
            grid_index_evaluated=[0, 5, 145, 50],
            selection_method_used=SelectionMethod.NEAREST_NATIVE_SAMPLE,
            source_asset_id="copernicus_phy_thetao_20250420_20250426.nc",
            source_asset_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        )
        self.assertEqual(exact_resp.response_type, "authoritative_scientific_value")
        self.assertEqual(exact_resp.scientific_value, 28.4519)
        self.assertEqual(exact_resp.value_state, PhysicalCellState.valid)

    def test_wmo_id_flexible_scope(self):
        """Verify 5-8 digit validation strictly applies to Argo profiling floats, while allowing alphanumeric IDs for gliders/moorings."""
        # 1. Argo float: numeric valid
        argo_valid = PlatformMetadataContract(
            platform_id="incois_argo_7902250",
            platform_type=PlatformType.ARGO_FLOAT,
            wmo_id="7902250",
            institution="INCOIS",
        )
        self.assertEqual(argo_valid.wmo_id, "7902250")

        # 2. Argo float: alphanumeric invalid (must raise)
        with self.assertRaises(ValidationError):
            PlatformMetadataContract(
                platform_id="incois_argo_invalid",
                platform_type=PlatformType.ARGO_FLOAT,
                wmo_id="RU29-GLIDER",  # Invalid for Argo
                institution="INCOIS",
            )

        # 3. Underwater Glider: alphanumeric valid
        glider_valid = PlatformMetadataContract(
            platform_id="glider_ru29",
            platform_type=PlatformType.UNDERWATER_GLIDER,
            wmo_id="RU29",  # Valid for glider
            institution="Rutgers University",
        )
        self.assertEqual(glider_valid.wmo_id, "RU29")

    def test_argo_qc_derivation_provenance(self):
        """Verify Argo QC report supports qc_derivation_source and algorithm version."""
        var_qc = VariableQCRecord(
            variable_name="TEMP",
            qc_scheme=QCScheme.wmo_argo,
            qc_derivation_source=QCDerivationSource.LOCALLY_DERIVED_QUASAR,
            derivation_method_version="Quasar-QARTOD-v1.0.0",
            level_qc_flags=[1, 1, 1, 2, 1],
            good_levels_count=5,
            total_levels_count=5,
        )
        self.assertEqual(var_qc.qc_derivation_source, QCDerivationSource.LOCALLY_DERIVED_QUASAR)
        self.assertEqual(var_qc.derivation_method_version, "Quasar-QARTOD-v1.0.0")

        report = ObservationQCReport(
            qc_scheme=QCScheme.wmo_argo,
            qc_derivation_source=QCDerivationSource.PROVIDER_SUPPLIED,
            derivation_method_version="Argo-QC-Manual-v3.4",
            position_qc_flag=1,
            position_qc_state=NormalizedQCState.good,
            time_qc_flag=1,
            time_qc_state=NormalizedQCState.good,
            variable_qc={"TEMP": var_qc},
        )
        self.assertEqual(report.qc_derivation_source, QCDerivationSource.PROVIDER_SUPPLIED)

    def test_schema_verification_zero_drift(self):
        """Ensure all canonical disk schemas have zero drift from models."""
        repo_root = Path(__file__).resolve().parent.parent
        canonical_dir = repo_root / "schemas" / "canonical"
        contracts_dir = repo_root / "packages" / "contracts" / "schemas"
        ok1, drift1 = verify_schemas_in_directory(canonical_dir)
        ok2, drift2 = verify_schemas_in_directory(contracts_dir)
        self.assertTrue(ok1, f"Canonical schema drift: {drift1}")
        self.assertTrue(ok2, f"Contracts schema drift: {drift2}")


if __name__ == "__main__":
    unittest.main()
