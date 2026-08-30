"""
QuasarOS Specialized Observation Contracts Test Suite (TASK-02D)

Tests specialized schemas for in-situ profiles, glider trajectories, platform metadata,
observation-level QC, raw vs adjusted modes, duplicate relationships, and collocation readiness.
Validates against real metadata from INCOIS Argo 7902250, Argo GDAC BGC-Argo, and RU29 glider.
"""

import json
import sys
import unittest
from pathlib import Path

# Add contracts source to path
REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))

from quasar_contracts import (
    CollocationBlockingReason,
    CollocationReadinessContract,
    DataMode,
    DeduplicationResolution,
    DiveSegment,
    DuplicateRelationshipContract,
    DuplicateRelationshipType,
    NormalizedQCState,
    ObservationQCReport,
    PlatformMetadataContract,
    PlatformType,
    ProfileCastContract,
    ProfileDirection,
    ProfileQCGrade,
    ProfileVariableEntry,
    QCScheme,
    SensorMetadata,
    TrajectoryContract,
    TrajectoryPhase,
    TrajectoryWaypoint,
    VariableQCRecord,
    export_schemas_to_directory,
    generate_typescript_declarations,
    verify_schemas_in_directory,
)


class TestObservationContracts(unittest.TestCase):
    """Test suite validating all TASK-02D specialized observation contracts."""

    # -------------------------------------------------------------------------
    # 1. Platform Metadata Contract
    # -------------------------------------------------------------------------
    def test_incois_argo_platform_metadata(self):
        """Validates real INCOIS Argo Float 7902250 metadata mapping."""
        sbe_sensor = SensorMetadata(
            sensor_id="sbe41cp_5128",
            sensor_model="SBE41CP",
            sensor_maker="Sea-Bird Scientific",
            measured_variables=["TEMP", "PSAL", "PRES"],
            calibration_date="2021-03-15",
            serial_number="5128",
        )
        optode_sensor = SensorMetadata(
            sensor_id="optode_4330_1204",
            sensor_model="Aanderaa Optode 4330",
            sensor_maker="Aanderaa Data Instruments",
            measured_variables=["DOXY"],
            calibration_date="2021-03-10",
            serial_number="1204",
        )

        platform = PlatformMetadataContract(
            platform_id="incois_argo_7902250",
            platform_type=PlatformType.BGC_ARGO_FLOAT,
            wmo_id="7902250",
            platform_code="APEX_7902250",
            institution="INCOIS",
            institution_country="India",
            pi_name="T. V. S. Udaya Bhaskar",
            project_name="Argo India / INCOIS National Argo Program",
            telemetry_type="Iridium",
            deployment_date_utc="2021-04-10T06:30:00Z",
            deployment_latitude=12.50,
            deployment_longitude=68.20,
            sensors=[sbe_sensor, optode_sensor],
            is_active=True,
        )

        self.assertEqual(platform.wmo_id, "7902250")
        self.assertEqual(platform.platform_type, PlatformType.BGC_ARGO_FLOAT)
        self.assertEqual(len(platform.sensors), 2)
        self.assertEqual(platform.sensors[0].sensor_model, "SBE41CP")

    def test_glider_platform_metadata(self):
        """Validates RU29 Slocum glider platform metadata."""
        ctd_sensor = SensorMetadata(
            sensor_id="glider_ctd_01",
            sensor_model="Glider Payload CTD",
            sensor_maker="Sea-Bird Scientific",
            measured_variables=["temperature", "salinity", "pressure", "density"],
        )
        platform = PlatformMetadataContract(
            platform_id="glider_ru29",
            platform_type=PlatformType.UNDERWATER_GLIDER,
            institution="Rutgers University Center for Ocean Observing Leadership",
            institution_country="USA",
            pi_name="Scott Glenn",
            project_name="Challenger Glider Mission",
            telemetry_type="Iridium",
            deployment_date_utc="2025-01-15T12:00:00Z",
            deployment_latitude=-25.0,
            deployment_longitude=45.0,
            sensors=[ctd_sensor],
            is_active=True,
        )
        self.assertEqual(platform.platform_id, "glider_ru29")
        self.assertEqual(platform.platform_type, PlatformType.UNDERWATER_GLIDER)
        self.assertIsNone(platform.wmo_id)

    def test_platform_metadata_rejection_invalid_wmo(self):
        """Rejects malformed WMO ID (e.g. non-numeric or out-of-range length)."""
        with self.assertRaises(ValueError):
            PlatformMetadataContract(
                platform_id="invalid_float",
                platform_type=PlatformType.ARGO_FLOAT,
                wmo_id="ABCDE",  # Non-numeric
                institution="Test",
            )

        with self.assertRaises(ValueError):
            PlatformMetadataContract(
                platform_id="invalid_float",
                platform_type=PlatformType.ARGO_FLOAT,
                wmo_id="123",  # Too short (< 5 digits)
                institution="Test",
            )

    # -------------------------------------------------------------------------
    # 2. Observation-Level Quality Control Contracts
    # -------------------------------------------------------------------------
    def test_observation_qc_evaluation(self):
        """Tests per-variable and profile-level QC evaluation logic."""
        # 10 levels of TEMP (all flag 1) and PSAL (9 flag 1, 1 flag 4)
        report = ObservationQCReport.evaluate_wmo_profile(
            position_flag=1,
            time_flag=1,
            variables_qc={
                "TEMP": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                "PSAL": [1, 1, 1, 1, 1, 1, 1, 1, 1, 4],
            },
            primary_var="TEMP",
        )

        self.assertEqual(report.position_qc_state, NormalizedQCState.good)
        self.assertEqual(report.time_qc_state, NormalizedQCState.good)
        self.assertEqual(report.profile_grade, ProfileQCGrade.A)
        self.assertTrue(report.is_fully_certified)
        self.assertEqual(report.variable_qc["TEMP"].good_levels_count, 10)
        self.assertEqual(report.variable_qc["PSAL"].good_levels_count, 9)
        self.assertTrue(report.variable_qc["PSAL"].is_valid_for_collocation)

    def test_observation_qc_degraded_grade(self):
        """Tests profile QC grade degradation when flags are suspect/bad."""
        report = ObservationQCReport.evaluate_wmo_profile(
            position_flag=1,
            time_flag=1,
            variables_qc={
                "TEMP": [1, 1, 1, 4, 4, 4, 4, 4, 4, 4],  # 3/10 good = 30% -> Grade D
            },
            primary_var="TEMP",
        )
        self.assertEqual(report.profile_grade, ProfileQCGrade.D)
        self.assertFalse(report.is_fully_certified)
        self.assertFalse(report.variable_qc["TEMP"].is_valid_for_collocation)

    # -------------------------------------------------------------------------
    # 3. Profile Cast Contract & Raw vs Adjusted Separation
    # -------------------------------------------------------------------------
    def test_argo_profile_cast_with_raw_and_adjusted_variables(self):
        """Validates real Argo profile structure preserving raw vs adjusted variables."""
        temp_entry = ProfileVariableEntry(
            canonical_variable_id="sea_water_temperature",
            raw_variable_name="TEMP",
            adjusted_variable_name="TEMP_ADJUSTED",
            error_variable_name="TEMP_ADJUSTED_ERROR",
            qc_variable_name="TEMP_ADJUSTED_QC",
            units="degree_Celsius",
            data_mode=DataMode.DELAYED,
            levels_count=72,
            min_pressure_dbar=4.0,
            max_pressure_dbar=2000.0,
            has_adjusted_values=True,
        )

        psal_entry = ProfileVariableEntry(
            canonical_variable_id="sea_water_salinity",
            raw_variable_name="PSAL",
            adjusted_variable_name="PSAL_ADJUSTED",
            error_variable_name="PSAL_ADJUSTED_ERROR",
            qc_variable_name="PSAL_ADJUSTED_QC",
            units="psu",
            data_mode=DataMode.DELAYED,
            levels_count=72,
            min_pressure_dbar=4.0,
            max_pressure_dbar=2000.0,
            has_adjusted_values=True,
        )

        doxy_entry = ProfileVariableEntry(
            canonical_variable_id="dissolved_oxygen",
            raw_variable_name="DOXY",
            adjusted_variable_name="DOXY_ADJUSTED",
            units="micromole/kg",
            data_mode=DataMode.ADJUSTED,
            levels_count=72,
            min_pressure_dbar=4.0,
            max_pressure_dbar=2000.0,
            has_adjusted_values=True,
        )

        cast = ProfileCastContract(
            profile_id="incois_argo_7902250_cycle_042_A",
            platform_id="incois_argo_7902250",
            platform_type=PlatformType.BGC_ARGO_FLOAT,
            wmo_id="7902250",
            cycle_number=42,
            direction=ProfileDirection.ASCENDING,
            data_mode=DataMode.DELAYED,
            observation_time_utc="2025-04-20T10:15:30Z",
            latitude=12.854,
            longitude=67.312,
            position_qc=1,
            time_qc=1,
            max_depth_m=1985.0,
            max_pressure_dbar=2000.0,
            level_count=72,
            variables={
                "sea_water_temperature": temp_entry,
                "sea_water_salinity": psal_entry,
                "dissolved_oxygen": doxy_entry,
            },
            is_bgc=True,
        )

        self.assertEqual(cast.cycle_number, 42)
        self.assertEqual(cast.direction, ProfileDirection.ASCENDING)
        self.assertEqual(cast.data_mode, DataMode.DELAYED)
        self.assertTrue(cast.is_bgc)
        self.assertTrue(cast.variables["sea_water_temperature"].has_adjusted_values)
        self.assertEqual(cast.variables["sea_water_temperature"].adjusted_variable_name, "TEMP_ADJUSTED")

    # -------------------------------------------------------------------------
    # 4. Trajectory Contract & Yo-Yo Dive Segmentation
    # -------------------------------------------------------------------------
    def test_glider_trajectory_and_dive_segmentation(self):
        """Validates RU29 glider continuous trajectory and discrete dive segmentation."""
        dive_1_down = DiveSegment(
            dive_id="ru29_dive_001_D",
            dive_number=1,
            direction=ProfileDirection.DESCENDING,
            start_time_utc="2025-01-15T12:00:00Z",
            end_time_utc="2025-01-15T13:30:00Z",
            start_latitude=-25.000,
            start_longitude=45.000,
            end_latitude=-25.015,
            end_longitude=45.010,
            max_depth_m=950.0,
            sample_count=180,
            associated_profile_id="ru29_profile_001_D",
        )

        dive_1_up = DiveSegment(
            dive_id="ru29_dive_001_A",
            dive_number=1,
            direction=ProfileDirection.ASCENDING,
            start_time_utc="2025-01-15T13:30:00Z",
            end_time_utc="2025-01-15T15:00:00Z",
            start_latitude=-25.015,
            start_longitude=45.010,
            end_latitude=-25.030,
            end_longitude=45.020,
            max_depth_m=950.0,
            sample_count=180,
            associated_profile_id="ru29_profile_001_A",
        )

        trajectory = TrajectoryContract(
            trajectory_id="glider_ru29_mission_2025",
            platform_id="glider_ru29",
            platform_type=PlatformType.UNDERWATER_GLIDER,
            mission_name="South Indian Ocean Heat Transport Transect",
            start_time_utc="2025-01-15T12:00:00Z",
            end_time_utc="2025-01-20T18:00:00Z",
            min_latitude=-26.50,
            max_latitude=-24.80,
            min_longitude=44.50,
            max_longitude=46.80,
            total_waypoints_count=3600,
            dive_segments=[dive_1_down, dive_1_up],
            variables_measured=["temperature", "salinity", "density", "depth"],
        )

        self.assertEqual(len(trajectory.dive_segments), 2)
        self.assertEqual(trajectory.dive_segments[0].direction, ProfileDirection.DESCENDING)
        self.assertEqual(trajectory.dive_segments[1].direction, ProfileDirection.ASCENDING)
        self.assertEqual(trajectory.dive_segments[0].max_depth_m, 950.0)

    # -------------------------------------------------------------------------
    # 5. Duplicate Relationship Contracts
    # -------------------------------------------------------------------------
    def test_duplicate_relationship_mirror_matching(self):
        """Validates duplicate matching between INCOIS DAC profile and Coriolis GDAC mirror."""
        rel = DuplicateRelationshipContract(
            relationship_id="dup_argo_7902250_042",
            primary_record_id="incois_argo_7902250_042_D",
            secondary_record_id="coriolis_argo_7902250_042_D",
            relationship_type=DuplicateRelationshipType.PROVIDER_MIRROR,
            spatial_distance_km=0.0,
            time_delta_seconds=0.0,
            confidence_score=1.0,
            recommended_resolution=DeduplicationResolution.PREFER_PRIMARY,
            resolution_rationale="Coriolis GDAC copy is a provider mirror of authoritative INCOIS DAC source file.",
            matching_criteria=["wmo_id_match", "cycle_number_match", "exact_timestamp_match", "identical_profile_checksum"],
        )

        self.assertEqual(rel.relationship_type, DuplicateRelationshipType.PROVIDER_MIRROR)
        self.assertEqual(rel.confidence_score, 1.0)
        self.assertEqual(rel.recommended_resolution, DeduplicationResolution.PREFER_PRIMARY)

    def test_duplicate_raw_vs_adjusted_pair(self):
        """Validates duplicate matching between real-time 'R' and delayed-mode 'D' versions."""
        rel = DuplicateRelationshipContract(
            relationship_id="dup_argo_7902250_042_rt_vs_dm",
            primary_record_id="incois_argo_7902250_042_D",
            secondary_record_id="incois_argo_7902250_042_R",
            relationship_type=DuplicateRelationshipType.SAME_PLATFORM_DIFFERENT_PROCESSING,
            spatial_distance_km=0.0,
            time_delta_seconds=0.0,
            confidence_score=0.98,
            recommended_resolution=DeduplicationResolution.PREFER_PRIMARY,
            resolution_rationale="Delayed-mode D has undergone scientific calibration and supersedes real-time R.",
            matching_criteria=["same_platform", "same_cycle"],
        )
        self.assertEqual(rel.relationship_type, DuplicateRelationshipType.SAME_PLATFORM_DIFFERENT_PROCESSING)
        self.assertEqual(rel.recommended_resolution, DeduplicationResolution.PREFER_PRIMARY)

    # -------------------------------------------------------------------------
    # 6. Collocation Readiness Contracts
    # -------------------------------------------------------------------------
    def test_collocation_readiness_ready_scenario(self):
        """Tests successful collocation readiness check between Argo profile and Copernicus 3D model."""
        readiness = CollocationReadinessContract.evaluate_readiness(
            collocation_id="colloc_argo_copernicus_042",
            observation_id="incois_argo_7902250_042_A",
            model_dataset_id="copernicus_phy_thetao",
            observation_variable="TEMP",
            model_variable="thetao",
            is_inside_spatial_domain=True,
            temporal_offset_seconds=3600.0,  # 1 hr offset (within 24 hr limit)
            max_allowed_time_window_seconds=86400.0,
            qc_passed=True,
            unit_compatible=True,
            unit_conversion_required=False,
            spatial_distance_km=0.0,
            notes="Observation point is inside 3D volume domain with certified QC grade A.",
        )

        self.assertTrue(readiness.is_collocation_ready)
        self.assertEqual(readiness.blocking_reasons, [CollocationBlockingReason.NO_BLOCKING_REASON])

    def test_collocation_readiness_blocked_scenario(self):
        """Tests blocked collocation check due to spatial out-of-bounds and failed QC."""
        readiness = CollocationReadinessContract.evaluate_readiness(
            collocation_id="colloc_argo_copernicus_blocked",
            observation_id="incois_argo_7902250_042_bad",
            model_dataset_id="copernicus_phy_thetao",
            observation_variable="TEMP",
            model_variable="thetao",
            is_inside_spatial_domain=False,  # Outside domain!
            temporal_offset_seconds=120000.0,  # > 24 hrs!
            max_allowed_time_window_seconds=86400.0,
            qc_passed=False,  # Failed QC!
            unit_compatible=True,
            spatial_distance_km=150.0,
            notes="Profile is out of bounds and flagged bad.",
        )

        self.assertFalse(readiness.is_collocation_ready)
        self.assertIn(CollocationBlockingReason.OUTSIDE_SPATIAL_BOUNDS, readiness.blocking_reasons)
        self.assertIn(CollocationBlockingReason.EXCEEDS_MAX_TIME_WINDOW, readiness.blocking_reasons)
        self.assertIn(CollocationBlockingReason.FAILED_OBSERVATION_QC, readiness.blocking_reasons)

    # -------------------------------------------------------------------------
    # 7. Schema Export & Zero Drift Verification
    # -------------------------------------------------------------------------
    def test_schema_export_and_zero_drift(self):
        """Verifies deterministic JSON Schema export and zero drift."""
        schemas_dir = REPO_ROOT / "packages" / "contracts" / "schemas"
        types_file = REPO_ROOT / "packages" / "contracts" / "types" / "quasar_contracts.d.ts"
        
        # Export schemas and TypeScript definitions
        exported_paths = export_schemas_to_directory(schemas_dir)
        self.assertGreater(len(exported_paths), 20)
        
        generate_typescript_declarations(types_file)
        self.assertTrue(types_file.exists())

        # Verify zero drift
        is_in_sync, drift_msgs = verify_schemas_in_directory(schemas_dir)
        self.assertTrue(is_in_sync, f"Detected schema drift: {drift_msgs}")


if __name__ == "__main__":
    unittest.main()
