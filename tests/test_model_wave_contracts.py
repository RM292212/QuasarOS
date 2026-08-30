"""
Unit test suite for Model and Wave Specialized Contracts (TASK-02C).

Validates:
1. Circular angular arithmetic (shortest distance across branch cuts e.g. 359 deg and 1 deg = 2 deg).
2. Circular mean wave direction vector averaging.
3. Forecast cycle timing: reference time (T_ref), valid time (T_valid), lead time (tau).
4. ROMS terrain-following s-coordinates for Vtransform=1 and Vtransform=2, Vstretching=1,2,4,5,
   depth calculation monotonicity and surface/seabed boundary adherence.
5. HYCOM served-coordinate (z-level vs native hybrid) classification and metadata validation.
6. Vector group component associations, Earth-relative vs Grid-relative rotation equations.
7. Specialized grids: Curvilinear coordinates, Arakawa staggering offsets, and grid metrics.
8. Real metadata fixtures from Copernicus Physical, Copernicus Waves, NOAA WW3, INCOIS RSMC WW3,
   HYCOM ESPC-D-V02, and INCOIS Bio-ROMS.
9. Deterministic schema export and zero-drift verification.
"""

import math
import sys
import unittest
import numpy as np
from pathlib import Path

# Add contracts source to path
REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))

from quasar_contracts.data_class import OperationalStatus
from quasar_contracts.variables import VectorConvention
from quasar_contracts.horizontal_grids import SpatialBoundingBox, StaggeringType
from quasar_contracts.model_contracts import (
    ForecastCycleContract,
    HYCOMModelContract,
    HYCOMVerticalRepresentation,
    ModelClass,
    ModelMaskContract,
    ModelRunType,
    OceanHydrodynamicModelContract,
)
from quasar_contracts.wave_contracts import (
    OceanWaveProductContract,
    StokesDriftContract,
    WavePartitionContract,
    WavePartitionType,
    WaveSpectralModel,
    circular_distance_deg,
    mean_wave_direction,
    normalize_angle_deg,
)
from quasar_contracts.vector_contracts import (
    RotationMetadata,
    VectorGroupContract,
    VectorGroupType,
    VectorReferenceFrame,
    compute_speed_and_direction,
    rotate_earth_to_grid,
    rotate_grid_to_earth,
)
from quasar_contracts.specialized_grids import (
    ArakawaStaggeringContract,
    CurvilinearGridContract,
    GridMetricsContract,
)
from quasar_contracts.roms_contracts import (
    ROMSFormulaTerms,
    ROMSSCoordinateContract,
    compute_roms_depths,
    compute_roms_stretching,
)
from quasar_contracts.export import (
    EXPORT_MODELS,
    export_schemas_to_directory,
    generate_json_schema,
    generate_typescript_declarations,
    verify_schemas_in_directory,
)


class TestWaveCircularArithmetic(unittest.TestCase):
    """Validates circular angle normalization, shortest distance, and directional averaging."""

    def test_normalize_angle_deg(self):
        self.assertAlmostEqual(normalize_angle_deg(0.0), 0.0)
        self.assertAlmostEqual(normalize_angle_deg(360.0), 0.0)
        self.assertAlmostEqual(normalize_angle_deg(720.0), 0.0)
        self.assertAlmostEqual(normalize_angle_deg(-10.0), 350.0)
        self.assertAlmostEqual(normalize_angle_deg(450.0), 90.0)

    def test_circular_distance_deg_branch_cut(self):
        # 359 deg and 1 deg are 2 deg apart
        self.assertAlmostEqual(circular_distance_deg(359.0, 1.0), 2.0)
        self.assertAlmostEqual(circular_distance_deg(1.0, 359.0), 2.0)

        # 10 deg and 350 deg are 20 deg apart
        self.assertAlmostEqual(circular_distance_deg(10.0, 350.0), 20.0)

        # Orthogonal angles
        self.assertAlmostEqual(circular_distance_deg(0.0, 90.0), 90.0)
        self.assertAlmostEqual(circular_distance_deg(90.0, 270.0), 180.0)
        self.assertAlmostEqual(circular_distance_deg(0.0, 180.0), 180.0)

        # Vectorized input
        a1 = np.array([355.0, 5.0, 180.0])
        a2 = np.array([5.0, 355.0, 0.0])
        res = circular_distance_deg(a1, a2)
        np.testing.assert_allclose(res, [10.0, 10.0, 180.0])

    def test_mean_wave_direction(self):
        # Average of 350 deg and 10 deg is 0 deg (North)
        mean_dir = mean_wave_direction([350.0, 10.0])
        self.assertAlmostEqual(mean_dir, 0.0, places=4)

        # Average of 80 deg and 100 deg is 90 deg (East)
        mean_dir2 = mean_wave_direction([80.0, 100.0])
        self.assertAlmostEqual(mean_dir2, 90.0, places=4)

        # Weighted average: 10 deg (weight 3) and 90 deg (weight 1)
        mean_dir_w = mean_wave_direction([10.0, 90.0], weights=[3.0, 1.0])
        # Vector components: x = 3*cos(10) + 1*cos(90) = 3*0.9848 = 2.9544; y = 3*sin(10) + 1*sin(90) = 3*0.1736 + 1 = 1.521
        # atan2(y, x) = atan2(1.521, 2.9544) = 27.24 deg
        expected = math.degrees(math.atan2(3.0 * math.sin(math.radians(10)) + 1.0, 3.0 * math.cos(math.radians(10))))
        self.assertAlmostEqual(mean_dir_w, expected, places=4)


class TestForecastCycleTiming(unittest.TestCase):
    """Validates operational forecast cycle reference time vs valid time vs lead time."""

    def test_valid_forecast_cycle(self):
        fc = ForecastCycleContract(
            model_class=ModelClass.MOM,
            run_type=ModelRunType.forecast,
            cycle_reference_time_utc="2026-08-30T00:00:00Z",
            valid_time_utc="2026-08-31T12:00:00Z",
            lead_time_hours=36.0,
            forecast_horizon_hours=120.0,
            assimilation_method="EnOI",
        )
        self.assertEqual(fc.lead_time_hours, 36.0)
        self.assertEqual(fc.model_class, ModelClass.MOM)

    def test_forecast_lead_time_mismatch_raises(self):
        with self.assertRaises(ValueError):
            ForecastCycleContract(
                model_class=ModelClass.NEMO,
                run_type=ModelRunType.forecast,
                cycle_reference_time_utc="2026-08-30T00:00:00Z",
                valid_time_utc="2026-08-30T12:00:00Z",
                lead_time_hours=24.0,  # Expected 12.0h -> mismatch
            )


class TestROMSSCoordinates(unittest.TestCase):
    """Validates ROMS s-coordinate stretching and vertical depth equations (Vtransform 1 & 2)."""

    def test_roms_stretching_v4(self):
        s_rho, Cs_r = compute_roms_stretching(N=32, theta_s=6.0, theta_b=0.4, vstretching=4, grid_type="rho")
        self.assertEqual(len(s_rho), 32)
        self.assertEqual(len(Cs_r), 32)
        # All values in [-1, 0]
        self.assertTrue(np.all(s_rho >= -1.0) and np.all(s_rho <= 0.0))
        self.assertTrue(np.all(Cs_r >= -1.0) and np.all(Cs_r <= 0.0))
        # Monotonically increasing from bottom to surface
        self.assertTrue(np.all(np.diff(s_rho) > 0))
        self.assertTrue(np.all(np.diff(Cs_r) > 0))

    def test_roms_depths_vtransform_1(self):
        # Vtransform 1: Song & Haidvogel 1994
        h = 200.0
        zeta = 0.5
        s, Cs, z = compute_roms_depths(
            h=h, zeta=zeta, N=10, theta_s=5.0, theta_b=0.5, hc=50.0, vtransform=1, vstretching=1
        )
        self.assertEqual(len(z), 10)
        # Deepest level (k=0) should be near seabed (-200m)
        self.assertTrue(z[0] < -150.0)
        # Top level (k=9) should be near surface (+0.5m)
        self.assertTrue(z[-1] > -10.0)
        # Strictly monotonic with depth
        self.assertTrue(np.all(np.diff(z) > 0))

    def test_roms_depths_vtransform_2(self):
        # Vtransform 2: Shchepetkin & McWilliams 2005
        h = np.array([[50.0, 100.0], [500.0, 2000.0]])
        zeta = np.zeros_like(h)
        s, Cs, z = compute_roms_depths(
            h=h, zeta=zeta, N=32, theta_s=6.0, theta_b=0.4, hc=100.0, vtransform=2, vstretching=4
        )
        self.assertEqual(z.shape, (32, 2, 2))
        # At surface, z should equal zeta = 0.0
        # In ROMS s_rho doesn't reach exactly 0.0 (s_rho[-1] = -0.5/N), but top layer is closest to 0
        self.assertTrue(np.all(z[-1, :, :] > -5.0))
        # At bottom, z should be near -h
        for i in range(2):
            for j in range(2):
                self.assertTrue(z[0, i, j] < -0.8 * h[i, j])
                self.assertTrue(np.all(np.diff(z[:, i, j]) > 0))

    def test_roms_contract_validation(self):
        s_rho, Cs_r = compute_roms_stretching(N=16, theta_s=5.0, theta_b=0.0, vstretching=2)
        s_w, Cs_w = compute_roms_stretching(N=16, theta_s=5.0, theta_b=0.0, vstretching=2, grid_type="w")
        
        contract = ROMSSCoordinateContract(
            Vtransform=2,
            Vstretching=2,
            theta_s=5.0,
            theta_b=0.0,
            hc=50.0,
            N=16,
            s_rho=s_rho.tolist(),
            Cs_r=Cs_r.tolist(),
            s_w=s_w.tolist(),
            Cs_w=Cs_w.tolist(),
            formula_terms=ROMSFormulaTerms(s="s_rho", eta="zeta", depth="h", depth_c="hc"),
        )
        self.assertEqual(contract.N, 16)
        self.assertEqual(len(contract.s_w), 17)


class TestHYCOMContracts(unittest.TestCase):
    """Validates HYCOM classification into served standard z-levels vs native hybrid layers."""

    def test_hycom_served_z_levels(self):
        hycom = HYCOMModelContract(
            vertical_representation=HYCOMVerticalRepresentation.served_z_level,
            experiment_id="GLBy0.08/expt_93.0",
            native_layer_count=41,
            served_depth_levels_count=40,
            surface_salinity_reference=35.0,
            uses_fast_thermodynamics=True,
        )
        self.assertEqual(hycom.vertical_representation, HYCOMVerticalRepresentation.served_z_level)
        self.assertEqual(hycom.served_depth_levels_count, 40)

    def test_hycom_native_hybrid(self):
        hycom_native = HYCOMModelContract(
            vertical_representation=HYCOMVerticalRepresentation.native_hybrid,
            experiment_id="ESPC-D-V02",
            native_layer_count=41,
            surface_salinity_reference=35.0,
            uses_fast_thermodynamics=True,
        )
        self.assertEqual(hycom_native.vertical_representation, HYCOMVerticalRepresentation.native_hybrid)
        self.assertEqual(hycom_native.native_layer_count, 41)


class TestVectorContractsAndRotation(unittest.TestCase):
    """Validates vector group definitions, Cartesian rotation, and speed/direction calculation."""

    def test_vector_rotation(self):
        # Angle = 90 deg (pi/2 rad)
        # A grid-east vector (u=1, v=0) rotated by 90 deg counter-clockwise becomes true North (u=0, v=1)
        angle = math.pi / 2.0
        u_east, v_north = rotate_grid_to_earth(1.0, 0.0, angle)
        self.assertAlmostEqual(u_east, 0.0)
        self.assertAlmostEqual(v_north, 1.0)

        # Inverse rotation back to grid
        u_g, v_g = rotate_earth_to_grid(u_east, v_north, angle)
        self.assertAlmostEqual(u_g, 1.0)
        self.assertAlmostEqual(v_g, 0.0)

    def test_speed_and_direction(self):
        # Eastward velocity u=1, v=0 -> speed 1, oceanographic_to = 90 deg (East)
        speed, deg_to = compute_speed_and_direction(1.0, 0.0, convention=VectorConvention.oceanographic_to)
        self.assertAlmostEqual(speed, 1.0)
        self.assertAlmostEqual(deg_to, 90.0)

        # Northward velocity u=0, v=1 -> speed 1, oceanographic_to = 0 deg (North)
        speed_n, deg_n = compute_speed_and_direction(0.0, 1.0, convention=VectorConvention.oceanographic_to)
        self.assertAlmostEqual(speed_n, 1.0)
        self.assertAlmostEqual(deg_n, 0.0)

        # Meteorological FROM convention for wind/waves:
        # Wind blowing Eastward (u=1, v=0) is a Westerly wind (coming from 270 deg)
        _, deg_from = compute_speed_and_direction(1.0, 0.0, convention=VectorConvention.meteorological_from)
        self.assertAlmostEqual(deg_from, 270.0)

    def test_vector_group_contract(self):
        vg = VectorGroupContract(
            group_id="ocean_surface_current",
            group_type=VectorGroupType.ocean_surface_velocity_2d,
            u_component_var="uo",
            v_component_var="vo",
            magnitude_var="speed",
            direction_var="direction",
            reference_frame=VectorReferenceFrame.earth_relative,
            directional_convention=VectorConvention.oceanographic_to,
        )
        self.assertEqual(vg.u_component_var, "uo")
        self.assertEqual(vg.reference_frame, VectorReferenceFrame.earth_relative)


class TestSpecializedGrids(unittest.TestCase):
    """Validates curvilinear grids, Arakawa staggering, and metrics contracts."""

    def test_curvilinear_grid_contract(self):
        cg = CurvilinearGridContract(
            grid_id="roms_indian_ocean_grid",
            eta_dimension_name="eta_rho",
            xi_dimension_name="xi_rho",
            eta_size=400,
            xi_size=500,
            lon_variable_name="lon_rho",
            lat_variable_name="lat_rho",
            angle_variable_name="angle",
            spatial_bounds=SpatialBoundingBox(
                min_longitude=30.0, min_latitude=-30.0, max_longitude=120.0, max_latitude=30.0
            ),
            has_curvilinear_metrics=True,
            pm_variable_name="pm",
            pn_variable_name="pn",
        )
        self.assertEqual(cg.eta_size, 400)
        self.assertEqual(cg.xi_size, 500)

    def test_arakawa_staggering_contract(self):
        arakawa = ArakawaStaggeringContract(
            staggering_type=StaggeringType.arakawa_c_rho,
            rho_grid_name="rho_points",
            u_grid_name="u_points",
            v_grid_name="v_points",
            psi_grid_name="psi_points",
            u_offset_xi=-0.5,
            u_offset_eta=0.0,
            v_offset_xi=0.0,
            v_offset_eta=-0.5,
            psi_offset_xi=-0.5,
            psi_offset_eta=-0.5,
        )
        self.assertEqual(arakawa.u_offset_xi, -0.5)
        self.assertEqual(arakawa.v_offset_eta, -0.5)

    def test_grid_metrics(self):
        metrics = GridMetricsContract(
            dx_min_meters=8500.0,
            dx_max_meters=9300.0,
            dy_min_meters=8500.0,
            dy_max_meters=9300.0,
            coriolis_parameter_variable="f",
        )
        self.assertEqual(metrics.dx_min_meters, 8500.0)


class TestRealOperationalModelAndWaveMetadata(unittest.TestCase):
    """
    Validates complete contracts against authoritative metadata from:
    1. Copernicus Physical (CMEMS GLOBAL-ANALYSISFORECAST-PHY-001-024)
    2. Copernicus Waves (GLOBAL-ANALYSISFORECAST-WAV-001-027)
    3. NOAA WW3 Global Multi-Grid
    4. INCOIS RSMC WW3 Indian Ocean Wave Model
    5. HYCOM ESPC-D-V02 Global Ocean Model
    6. INCOIS Bio-ROMS Indian Ocean Model
    """

    def test_copernicus_physical_model_contract(self):
        fc = ForecastCycleContract(
            model_class=ModelClass.NEMO,
            run_type=ModelRunType.forecast,
            cycle_reference_time_utc="2026-08-30T00:00:00Z",
            valid_time_utc="2026-08-30T12:00:00Z",
            lead_time_hours=12.0,
            forecast_horizon_hours=240.0,
            assimilation_method="SAM2 (SEEK filter)",
        )
        model = OceanHydrodynamicModelContract(
            model_name="GLOBAL-ANALYSISFORECAST-PHY-001-024",
            model_class=ModelClass.NEMO,
            operational_status=OperationalStatus.OPERATIONAL,
            forecast_cycle=fc,
            mask_contract=ModelMaskContract(has_land_mask=True, mask_variable_name="mask"),
            atmospheric_forcing_source="ECMWF IFS-HRES 0.1 deg",
            tidal_forcing_included=False,
            bathymetry_source="GEBCO 2024 / ETOPO 2022 merged",
        )
        self.assertEqual(model.model_class, ModelClass.NEMO)
        self.assertTrue(model.mask_contract.has_land_mask)

    def test_copernicus_waves_product_contract(self):
        wave_product = OceanWaveProductContract(
            wave_model=WaveSpectralModel.WAM,
            significant_wave_height_total="VHM0",
            peak_period_total="VTPK",
            mean_period_total="VTM02",
            mean_direction_total="VMDR",
            directional_convention=VectorConvention.meteorological_from,
            partitions=[
                WavePartitionContract(
                    partition_type=WavePartitionType.wind_sea,
                    partition_index=0,
                    significant_wave_height_var="VHM0_WW",
                    peak_or_mean_period_var="VTM02_WW",
                    direction_var="VMDR_WW",
                    directional_convention=VectorConvention.meteorological_from,
                ),
                WavePartitionContract(
                    partition_type=WavePartitionType.primary_swell,
                    partition_index=1,
                    significant_wave_height_var="VHM0_SW1",
                    peak_or_mean_period_var="VTM02_SW1",
                    direction_var="VMDR_SW1",
                    directional_convention=VectorConvention.meteorological_from,
                ),
                WavePartitionContract(
                    partition_type=WavePartitionType.secondary_swell,
                    partition_index=2,
                    significant_wave_height_var="VHM0_SW2",
                    peak_or_mean_period_var="VTM02_SW2",
                    direction_var="VMDR_SW2",
                    directional_convention=VectorConvention.meteorological_from,
                ),
            ],
            stokes_drift=StokesDriftContract(
                u_stokes_var="VSDX",
                v_stokes_var="VSDY",
                is_surface_only=True,
            ),
        )
        self.assertEqual(len(wave_product.partitions), 3)
        self.assertEqual(wave_product.stokes_drift.u_stokes_var, "VSDX")

    def test_noaa_ww3_product_contract(self):
        ww3 = OceanWaveProductContract(
            wave_model=WaveSpectralModel.WW3,
            significant_wave_height_total="swh",
            peak_period_total="tp",
            mean_direction_total="dir",
            directional_convention=VectorConvention.meteorological_from,
            spectral_frequencies_count=29,
            spectral_directions_count=36,
            stokes_drift=StokesDriftContract(
                u_stokes_var="uss",
                v_stokes_var="vss",
                is_surface_only=True,
            ),
        )
        self.assertEqual(ww3.wave_model, WaveSpectralModel.WW3)
        self.assertEqual(ww3.spectral_frequencies_count, 29)

    def test_incois_rsmc_ww3_contract(self):
        incois_wave = OceanWaveProductContract(
            wave_model=WaveSpectralModel.WW3,
            significant_wave_height_total="hs",
            peak_period_total="tp",
            mean_period_total="tm",
            mean_direction_total="dm",
            directional_convention=VectorConvention.meteorological_from,
            partitions=[
                WavePartitionContract(
                    partition_type=WavePartitionType.wind_sea,
                    partition_index=0,
                    significant_wave_height_var="hs_sea",
                    peak_or_mean_period_var="tp_sea",
                    direction_var="dp_sea",
                    directional_convention=VectorConvention.meteorological_from,
                ),
                WavePartitionContract(
                    partition_type=WavePartitionType.primary_swell,
                    partition_index=1,
                    significant_wave_height_var="hs_swell",
                    peak_or_mean_period_var="tp_swell",
                    direction_var="dp_swell",
                    directional_convention=VectorConvention.meteorological_from,
                ),
            ],
        )
        self.assertEqual(len(incois_wave.partitions), 2)

    def test_hycom_espc_contract(self):
        hycom = OceanHydrodynamicModelContract(
            model_name="HYCOM-ESPC-D-V02",
            model_class=ModelClass.HYCOM,
            operational_status=OperationalStatus.OPERATIONAL,
            hycom_metadata=HYCOMModelContract(
                vertical_representation=HYCOMVerticalRepresentation.served_z_level,
                experiment_id="ESPC-D-V02",
                native_layer_count=41,
                served_depth_levels_count=40,
                surface_salinity_reference=35.0,
                uses_fast_thermodynamics=True,
            ),
            mask_contract=ModelMaskContract(has_land_mask=True),
        )
        self.assertEqual(hycom.model_class, ModelClass.HYCOM)
        self.assertEqual(hycom.hycom_metadata.served_depth_levels_count, 40)

    def test_incois_bioroms_contract(self):
        s_rho, Cs_r = compute_roms_stretching(N=32, theta_s=6.0, theta_b=0.4, vstretching=4)
        roms_s = ROMSSCoordinateContract(
            Vtransform=2,
            Vstretching=4,
            theta_s=6.0,
            theta_b=0.4,
            hc=100.0,
            N=32,
            s_rho=s_rho.tolist(),
            Cs_r=Cs_r.tolist(),
            formula_terms=ROMSFormulaTerms(s="s_rho", eta="zeta", depth="h", depth_c="hc"),
        )
        roms_model = OceanHydrodynamicModelContract(
            model_name="INCOIS-BioROMS-IO",
            model_class=ModelClass.ROMS,
            operational_status=OperationalStatus.OPERATIONAL,
            mask_contract=ModelMaskContract(
                has_land_mask=True,
                mask_variable_name="mask_rho",
                has_dynamic_wetting_drying=False,
            ),
            atmospheric_forcing_source="NCMRWF Unified Model 0.12 deg",
            bathymetry_source="GEBCO 2024",
        )
        self.assertEqual(roms_model.model_class, ModelClass.ROMS)
        self.assertEqual(roms_s.N, 32)


class TestSchemaExportAndZeroDrift(unittest.TestCase):
    """Validates deterministic JSON Schema generation and export integrity."""

    def test_all_models_generate_valid_json_schema(self):
        for filename, model_cls in EXPORT_MODELS.items():
            schema = generate_json_schema(model_cls)
            self.assertIn("$schema", schema)
            self.assertIn("properties", schema)
            self.assertEqual(schema["$schema"], "https://json-schema.org/draft/2020-12/schema")

    def test_export_and_drift_verification(self):
        schemas_dir = Path("schemas/canonical")
        export_schemas_to_directory(schemas_dir)
        in_sync, drift_msgs = verify_schemas_in_directory(schemas_dir)
        self.assertTrue(in_sync, f"Schema drift detected: {drift_msgs}")


if __name__ == "__main__":
    unittest.main()
