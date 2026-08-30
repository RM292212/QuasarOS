"""
QuasarOS Canonical Scientific Contracts Test Suite (TASK-02B)

Comprehensive test suite verifying all 17 canonical scientific schema contracts,
Pydantic V2 validations, thermodynamic safeguards, real campaign product metadata mappings,
negative rejection invariants, and deterministic JSON Schema generation drift tests.
"""

import json
import math
import sys
import unittest
from pathlib import Path

# Add contracts source to path
REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))

from quasar_contracts import (
    AccessRestriction,
    ArtifactClassification,
    AssetFormat,
    AxisType,
    CalendarType,
    CanonicalCoordinate,
    CanonicalDatasetContract,
    CanonicalDimension,
    CanonicalUnitContract,
    CanonicalVariableContract,
    ChangeClassification,
    Citation,
    CoordinateSpacing,
    CRS,
    DataClassDiscriminator,
    DatasetCapabilitiesContract,
    DatasetIdentity,
    DisplayRange,
    ErrorCategory,
    ErrorSeverity,
    GEBCO_TID_QC_SCHEME,
    GridType,
    HorizontalGridContract,
    IOOS_QARTOD_QC_SCHEME,
    ImmutableSourceAsset,
    LatitudeCoordinate,
    LicenceContract,
    LineageRecord,
    LongitudeCoordinate,
    MissingValueContract,
    Monotonicity,
    NormalizedQCState,
    OperationalStatus,
    PackingMetadata,
    PhysicalCellState,
    PhysicalDimension,
    PhysicalQuantity,
    ProcessingLevel,
    ProviderIdentity,
    QCFlagDefinition,
    QCScheme,
    QualityControlContract,
    ROMSSCoordinateParameters,
    SchemaVersionMetadata,
    ScientificDiagnostic,
    ScientificErrorCode,
    ScientificRole,
    SpatialBoundingBox,
    StaggeringType,
    TimeSemanticsContract,
    Topology,
    UnitConversionClassification,
    UnitConversionResult,
    ValidationCheckResult,
    ValidationReport,
    ValidationState,
    VectorConvention,
    VerticalCoordinateContract,
    VerticalCoordinateType,
    VerticalDatum,
    VerticalDirection,
    WMO_ARGO_QC_SCHEME,
    classify_schema_change,
    classify_unit_conversion,
    is_backwards_compatible,
    parse_semver,
    verify_schemas_in_directory,
)


class TestCanonicalContracts(unittest.TestCase):
    """Authoritative test suite for QuasarOS canonical schema definitions."""

    # -------------------------------------------------------------------------
    # 1. Versioning & SemVer Compatibility
    # -------------------------------------------------------------------------
    def test_semver_parsing_and_compatibility(self):
        maj, min_v, pat = parse_semver("1.2.3")
        self.assertEqual((maj, min_v, pat), (1, 2, 3))
        
        self.assertTrue(is_backwards_compatible("1.3.0", "1.2.0"))
        self.assertTrue(is_backwards_compatible("1.2.1", "1.2.0"))
        self.assertFalse(is_backwards_compatible("1.1.0", "1.2.0"))
        self.assertFalse(is_backwards_compatible("2.0.0", "1.2.0"))

    def test_schema_change_classification(self):
        self.assertEqual(classify_schema_change("1.0.0", "1.0.1"), ChangeClassification.PATCH)
        self.assertEqual(classify_schema_change("1.0.0", "1.1.0"), ChangeClassification.ADDITIVE)
        self.assertEqual(classify_schema_change("1.0.0", "2.0.0"), ChangeClassification.BREAKING)

    def test_schema_version_metadata_model(self):
        meta = SchemaVersionMetadata(
            schema_version="1.0.0",
            min_compatible_version="1.0.0",
            change_classification=ChangeClassification.PATCH,
        )
        self.assertTrue(meta.check_compatibility("1.0.0"))
        self.assertTrue(meta.check_compatibility("1.1.0"))
        self.assertFalse(meta.check_compatibility("2.0.0"))

    # -------------------------------------------------------------------------
    # 2. Dataset Identity & Data Class Discriminators
    # -------------------------------------------------------------------------
    def test_dataset_identity_creation(self):
        prov = ProviderIdentity(
            provider_id="copernicus_marine",
            name="Copernicus Marine Service",
            country="European Union",
            institution_url="https://marine.copernicus.eu",
        )
        lic = LicenceContract(
            licence_id="Copernicus-Marine-Data-License",
            licence_name="Copernicus Marine Data License",
            terms_url="https://marine.copernicus.eu/user-corner/service-commitments-and-licence",
            attribution_statement="E.U. Copernicus Marine Service Information",
            access_restriction=AccessRestriction.ATTRIBUTION_REQUIRED,
        )
        val = ValidationReport(
            state=ValidationState.valid,
            validated_at_utc="2026-08-30T12:00:00Z",
            checks=[
                ValidationCheckResult(
                    check_name="sha256_verification",
                    passed=True,
                    message="All assets verified",
                    timestamp_utc="2026-08-30T12:00:00Z"
                )
            ]
        )
        ident = DatasetIdentity(
            dataset_id="copernicus_phy_thetao",
            dataset_version="2025.04",
            snapshot_id="sha256:abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
            title="Copernicus Marine Physical 3D Potential Temperature",
            description="Operational daily physical analysis for Arabian Sea and Bay of Bengal",
            provider=prov,
            product_id="GLOBAL_ANALYSISFORECAST_PHY_001_024",
            scientific_role=ScientificRole.MODEL,
            data_class=DataClassDiscriminator.model_volume,
            processing_level=ProcessingLevel.ANALYSIS_FORECAST,
            operational_status=OperationalStatus.OPERATIONAL,
            licence=lic,
            validation_report=val,
        )
        self.assertEqual(ident.dataset_id, "copernicus_phy_thetao")
        self.assertTrue(ident.validation_report.is_publication_ready)

    def test_bare_model_name_rejection(self):
        prov = ProviderIdentity(
            provider_id="hycom_consortium",
            name="HYCOM Consortium",
            country="USA",
            institution_url="https://hycom.org",
        )
        lic = LicenceContract(
            licence_id="Open-Access",
            licence_name="Open Access",
            terms_url="https://hycom.org/data",
            attribution_statement="HYCOM Consortium",
        )
        val = ValidationReport(state=ValidationState.valid, validated_at_utc="2026-08-30T12:00:00Z")
        
        with self.assertRaises(ValueError):
            DatasetIdentity(
                dataset_id="hycom",  # Bare model name prohibited!
                dataset_version="v1",
                snapshot_id="snap1",
                title="HYCOM Run",
                description="Raw run",
                provider=prov,
                product_id="ESPC",
                scientific_role=ScientificRole.MODEL,
                data_class=DataClassDiscriminator.model_volume,
                processing_level=ProcessingLevel.ANALYSIS_FORECAST,
                operational_status=OperationalStatus.OPERATIONAL,
                licence=lic,
                validation_report=val,
            )

    def test_synthetic_data_segregation(self):
        prov = ProviderIdentity(
            provider_id="quasar_core",
            name="Quasar Internal",
            country="Global",
            institution_url="https://quasar.internal",
        )
        lic = LicenceContract(
            licence_id="Internal",
            licence_name="Internal",
            terms_url="https://quasar.internal",
            attribution_statement="QuasarOS Test",
        )
        val = ValidationReport(state=ValidationState.valid, validated_at_utc="2026-08-30T12:00:00Z")

        # Operational status synthetic must have scientific_role test_fixture
        with self.assertRaises(ValueError):
            DatasetIdentity(
                dataset_id="synthetic_ocean_volume",
                dataset_version="v1",
                snapshot_id="snap_synth",
                title="Synthetic Ocean Volume",
                description="Synthetic fixture",
                provider=prov,
                product_id="SYNTH-01",
                scientific_role=ScientificRole.MODEL,  # Mismatch: must be TEST_FIXTURE
                data_class=DataClassDiscriminator.model_volume,
                processing_level=ProcessingLevel.ANALYSIS_FORECAST,
                operational_status=OperationalStatus.SYNTHETIC,
                licence=lic,
                validation_report=val,
            )

    # -------------------------------------------------------------------------
    # 3. Immutable Source Asset Contract
    # -------------------------------------------------------------------------
    def test_immutable_source_asset_contract(self):
        asset = ImmutableSourceAsset(
            asset_id="asset_copernicus_thetao_20250420",
            dataset_id="copernicus_phy_thetao",
            provider_filename="copernicus_phy_thetao_20250420_20250426.nc",
            local_relative_path="data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc",
            media_type="application/x-netcdf4",
            format=AssetFormat.netcdf4_classic,
            artifact_classification=ArtifactClassification.raw_source,
            size_bytes=15764052,
            sha256_checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            retrieval_timestamp_utc="2026-08-30T10:00:00Z",
            is_immutable=True,
        )
        self.assertEqual(asset.size_bytes, 15764052)
        self.assertEqual(asset.sha256_checksum, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")

    def test_asset_checksum_negative_validation(self):
        with self.assertRaises(ValueError):
            ImmutableSourceAsset(
                asset_id="asset_invalid_hash",
                dataset_id="copernicus_phy_thetao",
                provider_filename="file.nc",
                local_relative_path="data/file.nc",
                media_type="application/x-netcdf4",
                format=AssetFormat.netcdf4_classic,
                artifact_classification=ArtifactClassification.raw_source,
                size_bytes=100,
                sha256_checksum="INVALID_SHORT_HASH",  # Fails 64-hex regex
                retrieval_timestamp_utc="2026-08-30T10:00:00Z",
            )

    # -------------------------------------------------------------------------
    # 4. Canonical Unit Contract & Thermodynamic Safeguards
    # -------------------------------------------------------------------------
    def test_unit_conversion_safeguards(self):
        # 1. Identity conversions
        res1 = classify_unit_conversion("degree_Celsius", "degrees_C")
        self.assertEqual(res1.classification, UnitConversionClassification.identity)
        self.assertTrue(res1.conversion_allowed)

        # 2. Affine Celsius to Kelvin
        res2 = classify_unit_conversion("degree_Celsius", "kelvin")
        self.assertEqual(res2.classification, UnitConversionClassification.affine)
        self.assertTrue(res2.conversion_allowed)

        # 3. Safeguard: Practical Salinity (PSU / unitless) to Absolute Salinity (g/kg) is CONTEXT_DEPENDENT and BLOCKED
        res3 = classify_unit_conversion("psu", "g/kg", source_quantity="practical_salinity", target_quantity="absolute_salinity")
        self.assertEqual(res3.classification, UnitConversionClassification.context_dependent)
        self.assertFalse(res3.conversion_allowed)
        self.assertTrue(res3.requires_teos10)

        # 4. Safeguard: Pressure (dbar) to Depth (m) is CONTEXT_DEPENDENT and BLOCKED
        res4 = classify_unit_conversion("dbar", "m")
        self.assertEqual(res4.classification, UnitConversionClassification.context_dependent)
        self.assertFalse(res4.conversion_allowed)
        self.assertTrue(res4.requires_teos10)

        # 5. Incompatible dimensions
        res5 = classify_unit_conversion("m", "degree_Celsius")
        self.assertEqual(res5.classification, UnitConversionClassification.not_convertible)
        self.assertFalse(res5.conversion_allowed)

    # -------------------------------------------------------------------------
    # 5. Canonical Dimensions & Coordinates
    # -------------------------------------------------------------------------
    def test_dimensions_and_coordinates(self):
        lon_coord = LongitudeCoordinate(
            name="longitude",
            units="degrees_east",
            min_value=60.0,
            max_value=68.0,
            values_count=97,
            step_size=0.08333,
            spacing=CoordinateSpacing.regular,
        )
        lat_coord = LatitudeCoordinate(
            name="latitude",
            units="degrees_north",
            min_value=0.0,
            max_value=15.0,
            values_count=181,
            step_size=0.08333,
            spacing=CoordinateSpacing.regular,
        )
        self.assertEqual(lon_coord.axis, AxisType.X)
        self.assertEqual(lat_coord.axis, AxisType.Y)

    def test_coordinate_bounds_negative_validation(self):
        with self.assertRaises(ValueError):
            LongitudeCoordinate(
                name="longitude",
                min_value=100.0,
                max_value=50.0,  # min > max
                values_count=50,
            )

        with self.assertRaises(ValueError):
            LatitudeCoordinate(
                name="latitude",
                min_value=-95.0,  # < -90
                max_value=10.0,
                values_count=50,
            )

    # -------------------------------------------------------------------------
    # 6. Horizontal Grid Contract
    # -------------------------------------------------------------------------
    def test_horizontal_grid_contract(self):
        grid = HorizontalGridContract(
            grid_id="copernicus_reg_0083deg",
            grid_type=GridType.rectilinear,
            crs="EPSG:4326",
            spatial_bounds=SpatialBoundingBox(
                min_longitude=60.0,
                min_latitude=0.0,
                max_longitude=68.0,
                max_latitude=15.0,
            ),
            resolution_x_deg=0.08333,
            resolution_y_deg=0.08333,
            resolution_description="0.08333_degree_equirectangular",
            shape=[181, 97],
            dimension_names=["latitude", "longitude"],
            staggering=StaggeringType.none,
        )
        self.assertEqual(grid.shape, [181, 97])
        self.assertEqual(grid.grid_type, GridType.rectilinear)

    # -------------------------------------------------------------------------
    # 7. Vertical Coordinate Contract & ROMS S-Coordinates
    # -------------------------------------------------------------------------
    def test_standard_z_level_vertical_coordinate(self):
        levels_31 = [
            0.494, 1.541, 2.646, 3.819, 5.078, 6.443, 7.929, 9.560,
            11.360, 13.358, 15.585, 18.080, 20.893, 24.083, 27.720, 31.884,
            36.677, 42.224, 48.673, 56.196, 65.006, 75.362, 87.587, 102.053,
            119.206, 139.578, 163.790, 192.570, 226.755, 267.310, 315.328
        ]
        vert = VerticalCoordinateContract(
            coordinate_type=VerticalCoordinateType.z_level,
            units="m",
            positive_direction=VerticalDirection.down,
            datum=VerticalDatum.mean_sea_level,
            min_depth_m=0.494,
            max_depth_m=315.328,
            levels=levels_31,
            level_count=31,
            is_uniform=False,
        )
        self.assertEqual(vert.level_count, 31)
        self.assertFalse(vert.is_uniform)

    def test_roms_s_coordinate_parameters(self):
        N = 10
        s_rho = [-(i + 0.5) / N for i in range(N)]
        Cs_r = [-math.tanh(7.0 * (i + 0.5) / N) / math.tanh(7.0) for i in range(N)]
        
        roms_p = ROMSSCoordinateParameters(
            Vtransform=1,
            Vstretching=1,
            theta_s=7.0,
            theta_b=0.1,
            hc=10.0,
            N=N,
            s_rho=s_rho,
            Cs_r=Cs_r,
        )
        self.assertEqual(roms_p.Vtransform, 1)

        vert_roms = VerticalCoordinateContract(
            coordinate_type=VerticalCoordinateType.terrain_following_s_coordinate,
            units="1",
            level_count=N,
            is_time_varying=True,
            is_space_varying=True,
            roms_params=roms_p,
        )
        self.assertEqual(vert_roms.coordinate_type, VerticalCoordinateType.terrain_following_s_coordinate)

    def test_roms_missing_parameters_rejection(self):
        with self.assertRaises(ValueError):
            VerticalCoordinateContract(
                coordinate_type=VerticalCoordinateType.terrain_following_s_coordinate,
                level_count=10,
                # roms_params missing!
            )

    # -------------------------------------------------------------------------
    # 8. Time Semantics Contract
    # -------------------------------------------------------------------------
    def test_time_semantics_and_forecast_lead_time(self):
        time_contract = TimeSemanticsContract(
            calendar=CalendarType.gregorian,
            reference_time_utc="2026-08-30T00:00:00Z",
            valid_time_utc="2026-08-30T06:00:00Z",
            lead_time_seconds=21600,  # 6 hours = 21600 seconds
            timestep_index=2,
            source_time_string="hours since 1950-01-01 00:00:00",
        )
        self.assertEqual(time_contract.lead_time_seconds, 21600)
        self.assertEqual(time_contract.valid_time_utc, "2026-08-30T06:00:00Z")

    def test_time_inconsistency_rejection(self):
        with self.assertRaises(ValueError):
            TimeSemanticsContract(
                calendar=CalendarType.gregorian,
                reference_time_utc="2026-08-30T00:00:00Z",
                valid_time_utc="2026-08-30T06:00:00Z",
                lead_time_seconds=3600,  # Discrepancy: 1 hr != 6 hrs!
            )

    # -------------------------------------------------------------------------
    # 9. Missing-Value & Packing Contracts
    # -------------------------------------------------------------------------
    def test_packing_metadata_and_missing_values(self):
        pack = PackingMetadata(
            scale_factor=0.001,
            add_offset=20.0,
            packed_data_type="int16",
            unpacked_data_type="float32",
        )
        # Test unpack: packed 5000 -> 5000 * 0.001 + 20.0 = 25.0
        self.assertAlmostEqual(pack.unpack_value(5000), 25.0)
        # Test pack: 25.0 -> (25.0 - 20.0) / 0.001 = 5000
        self.assertEqual(pack.pack_value(25.0), 5000)

        missing = MissingValueContract(
            fill_value=-32767.0,
            has_nan=True,
            valid_min=-5.0,
            valid_max=45.0,
        )
        self.assertTrue(missing.is_missing(-32767.0))
        self.assertTrue(missing.is_missing(float("nan")))
        self.assertTrue(missing.is_missing(-10.0))  # < valid_min
        self.assertFalse(missing.is_missing(28.4))

    def test_float_fill_value_zero_explicitly_declared(self):
        """Float _FillValue = 0.0 explicitly declared is valid and recognized as missing sentinel."""
        contract = MissingValueContract(fill_value=0.0, stored_data_type="float32")
        self.assertTrue(contract.is_missing(0.0))
        self.assertFalse(contract.is_missing(1.0))
        self.assertFalse(contract.is_missing(-0.5))

    def test_integer_fill_value_zero_explicitly_declared(self):
        """Integer _FillValue = 0 explicitly declared is valid."""
        contract = MissingValueContract(fill_value=0.0, stored_data_type="int16")
        self.assertTrue(contract.is_raw_missing(0))
        self.assertFalse(contract.is_raw_missing(100))

    def test_zero_as_valid_scientific_value_with_no_fill_declaration(self):
        """Zero is treated as a valid scientific value when no fill value is declared or fill value is non-zero."""
        # 1. No fill value declared
        contract1 = MissingValueContract()
        val1, state1 = contract1.decode_and_mask(0.0)
        self.assertEqual(val1, 0.0)
        self.assertEqual(state1, PhysicalCellState.valid)
        self.assertFalse(contract1.is_missing(0.0))

        # 2. Non-zero fill value declared (-9999.0)
        contract2 = MissingValueContract(fill_value=-9999.0)
        val2, state2 = contract2.decode_and_mask(0.0)
        self.assertEqual(val2, 0.0)
        self.assertEqual(state2, PhysicalCellState.valid)
        self.assertFalse(contract2.is_missing(0.0))

    def test_non_zero_integer_sentinel(self):
        """Non-zero integer sentinels like -32767 for int16."""
        contract = MissingValueContract(fill_value=-32767.0, stored_data_type="int16")
        self.assertTrue(contract.is_raw_missing(-32767))
        self.assertFalse(contract.is_raw_missing(0))
        self.assertFalse(contract.is_raw_missing(1234))

    def test_nan_fill_value(self):
        """NaN fill value for floating point data."""
        contract = MissingValueContract(fill_value=float("nan"), stored_data_type="float32")
        self.assertTrue(contract.is_missing(float("nan")))
        self.assertFalse(contract.is_missing(0.0))
        self.assertFalse(contract.is_missing(25.5))

    def test_fill_value_plus_scale_factor_and_add_offset(self):
        """
        _FillValue comparison occurs BEFORE scale/offset decoding when raw comparison is active (CF standard).
        Raw packed -32767 with scale 0.001 and offset 20.0 should decode to None and missing state,
        NOT (-32767 * 0.001 + 20.0 = -12.767).
        """
        pack = PackingMetadata(scale_factor=0.001, add_offset=20.0, packed_data_type="int16")
        contract = MissingValueContract(fill_value=-32767.0, stored_data_type="int16", is_fill_value_raw=True)
        
        # Raw missing value
        val_missing, state_missing = contract.decode_and_mask(-32767, packing=pack)
        self.assertIsNone(val_missing)
        self.assertEqual(state_missing, PhysicalCellState.missing)

        # Raw valid value 5000 -> decoded 25.0
        val_valid, state_valid = contract.decode_and_mask(5000, packing=pack)
        self.assertAlmostEqual(val_valid, 25.0)
        self.assertEqual(state_valid, PhysicalCellState.valid)

        # Raw 0 with fill_value=0.0 -> missing
        contract_zero_fill = MissingValueContract(fill_value=0.0, stored_data_type="int16", is_fill_value_raw=True)
        val_zero_missing, state_zero_missing = contract_zero_fill.decode_and_mask(0, packing=pack)
        self.assertIsNone(val_zero_missing)
        self.assertEqual(state_zero_missing, PhysicalCellState.missing)

    def test_different_fill_value_and_missing_value_diagnostic(self):
        """Emits structured warning diagnostic when _FillValue and missing_value differ."""
        contract = MissingValueContract(fill_value=-32767.0, missing_value=-9999.0)
        self.assertEqual(len(contract.diagnostics), 1)
        diag = contract.diagnostics[0]
        self.assertEqual(diag.code, "DATA_FILL_VALUE_DISCREPANCY")
        self.assertEqual(diag.severity, ErrorSeverity.WARNING)
        # Both values should be identified as missing
        self.assertTrue(contract.is_missing(-32767.0))
        self.assertTrue(contract.is_missing(-9999.0))
        self.assertFalse(contract.is_missing(10.0))

    def test_datatype_bounds_rejection(self):
        """Rejects fill values that cannot fit in declared integer datatype."""
        # int16 bounds [-32768, 32767], 999999 is out of range
        with self.assertRaises(ValueError):
            MissingValueContract(fill_value=999999.0, stored_data_type="int16")

        # int8 bounds [-128, 127], -32767 is out of range
        with self.assertRaises(ValueError):
            MissingValueContract(fill_value=-32767.0, stored_data_type="int8")

        # NaN cannot be stored in integer type
        with self.assertRaises(ValueError):
            MissingValueContract(fill_value=float("nan"), stored_data_type="int16")

    def test_missing_value_mask_strictly_separated_from_scientific_values(self):
        """
        Missing values must never be returned as 0.0 in physical decoded value;
        missing states are kept strictly as PhysicalCellState.
        """
        contract = MissingValueContract(fill_value=-999.0, valid_min=0.0, valid_max=40.0)
        
        # 1. Fill value
        val1, state1 = contract.decode_and_mask(-999.0)
        self.assertIsNone(val1)
        self.assertNotEqual(val1, 0.0)
        self.assertEqual(state1, PhysicalCellState.missing)

        # 2. Out-of-bounds value (< valid_min)
        val2, state2 = contract.decode_and_mask(-5.0)
        self.assertIsNone(val2)
        self.assertNotEqual(val2, 0.0)
        self.assertEqual(state2, PhysicalCellState.rejected_by_qc)

        # 3. Legitimate physical zero (0.0 °C, elevation 0.0 m)
        val3, state3 = contract.decode_and_mask(0.0)
        self.assertEqual(val3, 0.0)
        self.assertEqual(state3, PhysicalCellState.valid)

    def test_missing_value_serialization_and_deserialization(self):
        """MissingValueContract round-trips through JSON accurately."""
        contract = MissingValueContract(
            fill_value=0.0,
            missing_value=-9999.0,
            has_nan=True,
            valid_min=-2.0,
            valid_max=35.0,
            stored_data_type="float32",
            is_fill_value_raw=True,
        )
        json_str = contract.model_dump_json()
        deserialized = MissingValueContract.model_validate_json(json_str)
        self.assertEqual(deserialized.fill_value, 0.0)
        self.assertEqual(deserialized.missing_value, -9999.0)
        self.assertEqual(deserialized.valid_min, -2.0)
        self.assertEqual(deserialized.valid_max, 35.0)
        self.assertEqual(deserialized.stored_data_type, "float32")
        self.assertTrue(deserialized.is_fill_value_raw)
        self.assertEqual(len(deserialized.diagnostics), 1)

    # -------------------------------------------------------------------------
    # 10. Quality Control Contracts
    # -------------------------------------------------------------------------
    def test_quality_control_contracts(self):
        # WMO Argo
        self.assertEqual(WMO_ARGO_QC_SCHEME.normalize_flag(1), NormalizedQCState.good)
        self.assertEqual(WMO_ARGO_QC_SCHEME.normalize_flag(4), NormalizedQCState.bad)
        self.assertTrue(WMO_ARGO_QC_SCHEME.is_accepted(1))
        self.assertFalse(WMO_ARGO_QC_SCHEME.is_accepted(4))

        # IOOS QARTOD
        self.assertEqual(IOOS_QARTOD_QC_SCHEME.normalize_flag(1), NormalizedQCState.good)
        self.assertEqual(IOOS_QARTOD_QC_SCHEME.normalize_flag(3), NormalizedQCState.suspect)

        # GEBCO TID
        self.assertEqual(GEBCO_TID_QC_SCHEME.normalize_flag(0), NormalizedQCState.good)
        self.assertEqual(GEBCO_TID_QC_SCHEME.normalize_flag(50), NormalizedQCState.probably_good)

    # -------------------------------------------------------------------------
    # 11. Canonical Variable Contract
    # -------------------------------------------------------------------------
    def test_canonical_variable_contract(self):
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
            packing=PackingMetadata(scale_factor=0.001, add_offset=20.0),
            missing_value_contract=MissingValueContract(fill_value=-32767.0),
            display_range=DisplayRange(min_value=2.0, max_value=32.0, colormap="turbo", unit="°C"),
        )
        self.assertEqual(var.canonical_name, "Potential Temperature")
        self.assertEqual(var.topology, Topology.volume_scalar)

    # -------------------------------------------------------------------------
    # 12. Composite Canonical Dataset Contract (Copernicus 3D Volume)
    # -------------------------------------------------------------------------
    def test_composite_canonical_dataset_copernicus_thetao(self):
        prov = ProviderIdentity(
            provider_id="copernicus_marine",
            name="Copernicus Marine Service",
            country="European Union",
            institution_url="https://marine.copernicus.eu",
        )
        lic = LicenceContract(
            licence_id="Copernicus-Marine-Data-License",
            licence_name="Copernicus Marine Data License",
            terms_url="https://marine.copernicus.eu/user-corner/service-commitments-and-licence",
            attribution_statement="E.U. Copernicus Marine Service Information",
            access_restriction=AccessRestriction.ATTRIBUTION_REQUIRED,
        )
        val = ValidationReport(
            state=ValidationState.valid,
            validated_at_utc="2026-08-30T12:00:00Z",
            checks=[ValidationCheckResult(check_name="all_checks", passed=True, message="Certified", timestamp_utc="2026-08-30T12:00:00Z")]
        )
        ident = DatasetIdentity(
            dataset_id="copernicus_phy_thetao",
            dataset_version="2025.04",
            snapshot_id="sha256:abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
            title="Copernicus Marine Physical 3D Potential Temperature",
            description="3D ocean temperature volume in Arabian Sea",
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
            grid_id="copernicus_reg_0083deg",
            grid_type=GridType.rectilinear,
            crs="EPSG:4326",
            spatial_bounds=SpatialBoundingBox(min_longitude=60.0, min_latitude=0.0, max_longitude=68.0, max_latitude=15.0),
            resolution_x_deg=0.08333,
            resolution_y_deg=0.08333,
            resolution_description="0.08333_degree_equirectangular",
            shape=[181, 97],
            dimension_names=["latitude", "longitude"],
        )
        vert = VerticalCoordinateContract(
            coordinate_type=VerticalCoordinateType.z_level,
            units="m",
            min_depth_m=0.494,
            max_depth_m=5727.9,
            levels=[0.494, 1.541, 2.646, 5727.9],
            level_count=4,
        )
        time_c = TimeSemanticsContract(
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
            display_range=DisplayRange(min_value=2.0, max_value=32.0, colormap="turbo", unit="°C"),
        )
        caps = DatasetCapabilitiesContract(
            can_volume_render_3d=True,
            can_exact_query=True,
            can_horizontal_slice=True,
            can_vertical_slice=True,
            can_extract_isosurface=True,
        )
        asset = ImmutableSourceAsset(
            asset_id="copernicus_phy_thetao_nc",
            dataset_id="copernicus_phy_thetao",
            provider_filename="copernicus_phy_thetao_20250420_20250426.nc",
            local_relative_path="data/raw/copernicus/physical/copernicus_phy_thetao_20250420_20250426.nc",
            media_type="application/x-netcdf4",
            format=AssetFormat.netcdf4_classic,
            artifact_classification=ArtifactClassification.raw_source,
            size_bytes=15764052,
            sha256_checksum="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            retrieval_timestamp_utc="2026-08-30T10:00:00Z",
        )
        lineage = LineageRecord(
            lineage_id="lin_001",
            dataset_id="copernicus_phy_thetao",
            operation="canonical_contract_audit",
            operator="Scientific Data Architect",
            started_at_utc="2026-08-30T10:00:00Z",
            completed_at_utc="2026-08-30T10:05:00Z",
        )

        dataset = CanonicalDatasetContract(
            identity=ident,
            grid=grid,
            vertical=vert,
            time_semantics=time_c,
            variables={"sea_water_potential_temperature": var},
            capabilities=caps,
            source_assets=[asset],
            provenance=[lineage],
            spatial_coverage_description="Arabian Sea (0 to 15N, 60 to 68E)",
            temporal_coverage_description="2025-04-20 to 2025-04-26 daily",
        )

        # Serialization round-trip test
        json_str = dataset.model_dump_json()
        data_dict = json.loads(json_str)
        reloaded = CanonicalDatasetContract.model_validate(data_dict)
        self.assertEqual(reloaded.identity.dataset_id, "copernicus_phy_thetao")
        self.assertEqual(len(reloaded.variables), 1)
        self.assertTrue(reloaded.capabilities.can_volume_render_3d)

    # -------------------------------------------------------------------------
    # 13. Campaign Inventory Real Metadata Validation (All 16 Products)
    # -------------------------------------------------------------------------
    def test_real_campaign_all_products_validity(self):
        """Validates that all 16 campaign products can be modeled with zero ambiguity."""
        product_configs = [
            ("incois_argo_7902250", DataClassDiscriminator.profile_observations, ScientificRole.OBSERVATION, ProcessingLevel.L2),
            ("copernicus_phy_thetao", DataClassDiscriminator.model_volume, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("copernicus_chlorophyll_l4", DataClassDiscriminator.satellite_grid, ScientificRole.OBSERVATION, ProcessingLevel.L4),
            ("gebco_2020_bathymetry", DataClassDiscriminator.bathymetry_grid, ScientificRole.BATHYMETRY, ProcessingLevel.TERRAIN_MODEL),
            ("woa23_temp_climatology", DataClassDiscriminator.climatology_grid, ScientificRole.CLIMATOLOGY, ProcessingLevel.CLIMATOLOGY),
            ("argo_gdac_north_indian_ocean", DataClassDiscriminator.profile_observations, ScientificRole.OBSERVATION, ProcessingLevel.L2),
            ("hycom_espc_t3z", DataClassDiscriminator.model_volume, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("glider_ru29_trajectory", DataClassDiscriminator.trajectory_observations, ScientificRole.OBSERVATION, ProcessingLevel.L2),
            ("copernicus_waves_vhm0", DataClassDiscriminator.wave_grid, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("noaa_pacioos_nww3", DataClassDiscriminator.wave_grid, ScientificRole.MODEL, ProcessingLevel.REANALYSIS),
            ("incois_rsmc_ww3", DataClassDiscriminator.wave_grid, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("incois_godas_mom_suite", DataClassDiscriminator.model_volume, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("hycom_espc_expanded_suite", DataClassDiscriminator.model_volume, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("incois_bio_roms_nio", DataClassDiscriminator.model_volume, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("mike21_sw_spectral_wave", DataClassDiscriminator.wave_grid, ScientificRole.MODEL, ProcessingLevel.ANALYSIS_FORECAST),
            ("gebco_2026_tid_bathymetry", DataClassDiscriminator.bathymetry_grid, ScientificRole.BATHYMETRY, ProcessingLevel.TERRAIN_MODEL),
        ]

        prov = ProviderIdentity(provider_id="generic_provider", name="Generic Provider", country="Global", institution_url="https://generic.org")
        lic = LicenceContract(licence_id="Open", licence_name="Open", terms_url="https://open.org", attribution_statement="Attribution")
        val = ValidationReport(state=ValidationState.valid, validated_at_utc="2026-08-30T12:00:00Z")

        for ds_id, d_class, role, plevel in product_configs:
            ident = DatasetIdentity(
                dataset_id=ds_id,
                dataset_version="v1.0",
                snapshot_id="sha256:1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
                title=f"Dataset {ds_id}",
                description=f"Description for {ds_id}",
                provider=prov,
                product_id=f"PROD-{ds_id.upper()}",
                scientific_role=role,
                data_class=d_class,
                processing_level=plevel,
                operational_status=OperationalStatus.OPERATIONAL,
                licence=lic,
                validation_report=val,
            )
            self.assertEqual(ident.data_class, d_class)
            self.assertEqual(ident.scientific_role, role)

    # -------------------------------------------------------------------------
    # 14. JSON Schema Verification & Zero-Drift
    # -------------------------------------------------------------------------
    def test_schema_zero_drift(self):
        canonical_dir = REPO_ROOT / "schemas" / "canonical"
        contracts_dir = REPO_ROOT / "packages" / "contracts" / "schemas"
        
        ok1, drift1 = verify_schemas_in_directory(canonical_dir)
        ok2, drift2 = verify_schemas_in_directory(contracts_dir)
        
        self.assertTrue(ok1, f"Canonical schemas drifted: {drift1}")
        self.assertTrue(ok2, f"Contracts schemas drifted: {drift2}")


if __name__ == "__main__":
    unittest.main()
