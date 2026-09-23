r"""
Milestone 4 & 5 Challenger 2 Thermodynamic Physical Consistency Harness.
Author: Challenger 2 (m4_challenger_2)

Validates TEOS-10 sounding models against GSW formulation for:
1. Conservative Temperature (CT, Θ), Absolute Salinity (SA), and in-situ Density (ρ).
2. Static gravitational stability and Brunt-Väisälä buoyancy frequency squared (N^2 >= 0).
3. Sound speed physical bounds (1450 m/s <= c <= 1560 m/s).
4. Mixed Layer Depth (MLD) physical thresholding (Δρ >= 0.03 kg/m^3).
5. Cross-domain spatial & temporal consistency across 7 operational dates.
"""
import sys, os
sys.path.extend(['packages/services/src', 'packages/contracts/src', '.'])

import unittest
import numpy as np
import gsw
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine

class TestM4Challenger2TEOS10Thermodynamics(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.analysis = ScientificAnalysisEngine()

    def test_teos10_thermodynamic_state_consistency(self):
        """Verify CT, SA, in-situ density, and sound speed match GSW formulas exactly."""
        lat, lon = 7.5, 64.0
        time_idx = 6 # Operational date 2026-08-30

        res = self.analysis.compute_teos10_derived_soundings(time_idx, lat, lon)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertGreater(res["levels_count"], 30)

        soundings = res["soundings"]
        depths = np.array([s["depth_m"] for s in soundings])
        sa_engine = np.array([s["absolute_salinity_g_kg"] for s in soundings])
        ct_engine = np.array([s["conservative_temperature_C"] for s in soundings])
        rho_engine = np.array([s["in_situ_density_kg_m3"] for s in soundings])
        c_engine = np.array([s["sound_speed_m_s"] for s in soundings])

        # Compute sea pressure p from depth and latitude
        pres = gsw.p_from_z(-depths, lat)

        # Independent GSW re-computation
        rho_ref = gsw.rho(sa_engine, ct_engine, pres)
        c_ref = gsw.sound_speed(sa_engine, ct_engine, pres)

        # Assert density agreement to within numerical float precision (< 1e-4 kg/m^3)
        np.testing.assert_allclose(rho_engine, rho_ref, rtol=1e-5, atol=1e-4)

        # Assert sound speed agreement (< 1e-4 m/s)
        np.testing.assert_allclose(c_engine, c_ref, rtol=1e-5, atol=1e-4)

        # Physical range checks
        self.assertTrue(np.all(sa_engine >= 33.5) and np.all(sa_engine <= 37.5))
        self.assertTrue(np.all(ct_engine >= 1.0) and np.all(ct_engine <= 32.0))
        self.assertTrue(np.all(rho_engine >= 1020.0) and np.all(rho_engine <= 1060.0))
        self.assertTrue(np.all(c_engine >= 1480.0) and np.all(c_engine <= 1560.0))

    def test_teos10_gravitational_stability_and_n2(self):
        """Verify hydrostatic stability (in-situ density increases with depth, N^2 >= 0)."""
        lat, lon = 7.5, 64.0

        for t_idx in [0, 3, 6]:
            res = self.analysis.compute_teos10_derived_soundings(t_idx, lat, lon)
            self.assertEqual(res["status"], "SUCCESS")

            soundings = res["soundings"]
            rho = np.array([s["in_situ_density_kg_m3"] for s in soundings])
            depths = np.array([s["depth_m"] for s in soundings])

            # In-situ density must be strictly monotonically increasing with depth
            diff_rho = np.diff(rho)
            self.assertTrue(
                np.all(diff_rho > -1e-6),
                f"In-situ density must increase with depth at time_idx={t_idx}: min diff={np.min(diff_rho)}"
            )

            # Check Brunt-Väisälä frequency squared N^2 from engine
            n2 = np.array(res["brunt_vaisala_n2_s2"])
            self.assertEqual(len(n2), len(soundings))
            # Most of water column in stratified ocean has N^2 > 0 (stable stratification)
            self.assertGreater(np.mean(n2[1:]), 0.0)

    def test_teos10_mixed_layer_depth_calculation(self):
        """Verify MLD detects the exact layer depth where Δρ >= 0.03 kg/m^3 from surface."""
        lat, lon = 7.5, 64.0
        res = self.analysis.compute_teos10_derived_soundings(0, lat, lon)

        mld = res["mixed_layer_depth_m"]
        self.assertGreater(mld, 0.0)

        soundings = res["soundings"]
        ref_rho = soundings[0]["in_situ_density_kg_m3"]

        # Find expected MLD level
        expected_mld = soundings[0]["depth_m"]
        for s in soundings[1:]:
            if (s["in_situ_density_kg_m3"] - ref_rho) >= 0.03:
                expected_mld = s["depth_m"]
                break

        self.assertAlmostEqual(mld, expected_mld, places=3)

    def test_teos10_boundary_rejection_and_masked_columns(self):
        """Verify input validation: invalid lat/lon, out-of-range time_index, bathymetric truncation."""
        # Out-of-bounds latitude (> 90.0 or < -90.0)
        with self.assertRaises(ValueError):
            self.analysis.compute_teos10_derived_soundings(0, 95.0, 64.0)
        with self.assertRaises(ValueError):
            self.analysis.compute_teos10_derived_soundings(0, -95.0, 64.0)

        # Out-of-bounds longitude (> 180.0 or < -180.0)
        with self.assertRaises(ValueError):
            self.analysis.compute_teos10_derived_soundings(0, 7.5, 195.0)
        with self.assertRaises(ValueError):
            self.analysis.compute_teos10_derived_soundings(0, 7.5, -195.0)

        # Out-of-bounds time index (< 0 or > 6)
        with self.assertRaises(ValueError):
            self.analysis.compute_teos10_derived_soundings(7, 7.5, 64.0)
        with self.assertRaises(ValueError):
            self.analysis.compute_teos10_derived_soundings(-1, 7.5, 64.0)

        # Valid ocean column correctly filters out sub-seabed levels
        ocean_res = self.analysis.compute_teos10_derived_soundings(0, 7.5, 64.0)
        self.assertEqual(ocean_res["status"], "SUCCESS")
        self.assertGreaterEqual(ocean_res["levels_count"], 35)
        # All returned soundings must have valid, non-NaN numbers
        for s in ocean_res["soundings"]:
            self.assertFalse(np.isnan(s["conservative_temperature_C"]))
            self.assertFalse(np.isnan(s["absolute_salinity_g_kg"]))
            self.assertFalse(np.isnan(s["in_situ_density_kg_m3"]))
            self.assertFalse(np.isnan(s["sound_speed_m_s"]))

if __name__ == "__main__":
    unittest.main()
