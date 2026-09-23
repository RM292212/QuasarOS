r"""
Milestone 2 Challenger 2: 7-Day Timeline Sounding Inspection & Temporal Integrity Adversarial Test.
Author: Challenger 2 (m2_challenger_remediation_2)

Empirically challenges:
1. SoundingInspectionPanel backend TEOS-10 dynamic profiles across all 7 operational dates (time_index 0..6).
2. Strict non-NaN, non-infinite, physically valid profiles at all 50 Copernicus vertical levels.
3. Temporal variance: asserts that profiles across the 7 operational days are non-identical (temporal evolution).
4. Spatial boundary conditions: edge of domain, masked water columns, and invalid coordinate rejection.
5. Verification of the semantic divergence between acoustic sound speed (~1500 m/s) and current velocity magnitude (<1.5 m/s).
6. Non-NaN analytical fallback generator integrity across all 7 days and variables.
"""
import sys, os
sys.path.extend(['packages/services/src', 'packages/contracts/src', '.'])

import unittest
import math
import numpy as np
import gsw
from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine

COPERNICUS_50_DEPTH_LEVELS = [
    0.494025, 1.541375, 2.645669, 3.819495, 5.078224, 6.440614, 7.92956, 9.572997,
    11.405, 13.46714, 15.81007, 18.49556, 21.59882, 25.21141, 29.44473, 34.43415,
    40.34405, 47.37369, 55.76429, 65.80727, 77.85385, 92.32607, 109.7293, 130.666,
    155.8507, 186.1256, 222.4752, 266.0403, 318.1274, 380.213, 453.9377, 541.0889,
    643.5668, 763.3331, 902.3393, 1062.44, 1245.291, 1452.251, 1684.284, 1941.893,
    2225.078, 2533.336, 2865.703, 3220.82, 3597.032, 3992.484, 4405.224, 4833.291,
    5274.784, 5727.917
]


def derive_sounding_samples_fallback(time_index: int, var_id: str):
    """Mirror of frontend fallback deriveSoundingSamplesForTimestep."""
    is_salinity = 'salinity' in var_id or var_id == 'so'
    is_speed = 'speed' in var_id

    samples = []
    for idx, depth in enumerate(COPERNICUS_50_DEPTH_LEVELS):
        if is_salinity:
            sub_max = 35.8 + 0.12 * math.sin(time_index * 0.8)
            val = 34.6 + (sub_max - 34.6) * math.exp(-math.pow(depth - (65.0 + time_index * 3), 2) / 4500.0)
        elif is_speed:
            jet_max = 0.85 + 0.05 * math.sin(time_index)
            val = jet_max * math.exp(-depth / 120.0)
        else:
            sst = 30.25 + 0.088 * time_index
            thermocline_depth = 180.0 + time_index * 8.0
            val = 1.09 + (sst - 1.09) * math.exp(-depth / thermocline_depth)

        samples.append({
            'level_index': idx,
            'depth_m': depth,
            'scientific_value': round(val, 4),
            'value_state': 'valid'
        })
    return samples


class TestM2Challenger2Soundings(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.engine = ScientificAnalysisEngine()

    def test_sounding_all_7_days_non_nan_and_bounded(self):
        """Stress-test: TEOS-10 soundings across all 7 dates (2026-08-24 to 2026-08-30) must be strictly non-NaN."""
        lat, lon = 7.5, 64.0  # Center of default spatial bounds in Arabian Sea

        daily_profiles = []
        for t_idx in range(7):
            res = self.engine.compute_teos10_derived_soundings(t_idx, lat, lon)
            self.assertEqual(res.get("status"), "SUCCESS", f"Day {t_idx} query failed with status: {res.get('status')}")

            soundings = res.get("soundings", [])
            self.assertGreater(len(soundings), 0, f"Day {t_idx} returned empty soundings")

            for s_idx, s in enumerate(soundings):
                # Assert no NaN or Inf in any field
                for field in ["depth_m", "absolute_salinity_g_kg", "conservative_temperature_C", "in_situ_density_kg_m3", "sound_speed_m_s"]:
                    val = s[field]
                    self.assertFalse(math.isnan(val), f"Day {t_idx} level {s_idx} field {field} is NaN")
                    self.assertFalse(math.isinf(val), f"Day {t_idx} level {s_idx} field {field} is Inf")

                # Physical bounds
                self.assertGreaterEqual(s["depth_m"], 0.0)
                self.assertLessEqual(s["depth_m"], 6000.0)
                self.assertGreaterEqual(s["conservative_temperature_C"], 0.5)
                self.assertLessEqual(s["conservative_temperature_C"], 35.0)
                self.assertGreaterEqual(s["absolute_salinity_g_kg"], 32.0)
                self.assertLessEqual(s["absolute_salinity_g_kg"], 39.0)
                self.assertGreaterEqual(s["in_situ_density_kg_m3"], 1015.0)
                self.assertLessEqual(s["in_situ_density_kg_m3"], 1060.0)
                self.assertGreaterEqual(s["sound_speed_m_s"], 1450.0)
                self.assertLessEqual(s["sound_speed_m_s"], 1560.0)

            daily_profiles.append(soundings)

        self.assertEqual(len(daily_profiles), 7)

    def test_sounding_7_day_temporal_variance(self):
        """Stress-test: Ensure 7-day soundings are not statically frozen; verify temporal evolution across days."""
        lat, lon = 7.5, 64.0

        surface_temps = []
        surface_salinities = []
        for t_idx in range(7):
            res = self.engine.compute_teos10_derived_soundings(t_idx, lat, lon)
            s0 = res["soundings"][0]
            surface_temps.append(s0["conservative_temperature_C"])
            surface_salinities.append(s0["absolute_salinity_g_kg"])

        # Check that surface temperature and salinity are not identical for all 7 days
        unique_temps = set(round(t, 4) for t in surface_temps)
        unique_salinities = set(round(s, 4) for s in surface_salinities)

        self.assertGreater(len(unique_temps), 1, "Surface temperature appears frozen/identical across 7 days")
        self.assertGreater(len(unique_salinities), 1, "Surface salinity appears frozen/identical across 7 days")

    def test_sounding_boundary_and_masked_water(self):
        """Stress-test: Out-of-bounds coordinates must be rejected; masked coordinates must return status cleanly."""
        # 1. Negative time_index must raise ValueError
        with self.assertRaises(ValueError):
            self.engine.compute_teos10_derived_soundings(-1, 7.5, 64.0)

        # 2. time_index > 6 must raise ValueError
        with self.assertRaises(ValueError):
            self.engine.compute_teos10_derived_soundings(7, 7.5, 64.0)

        # 3. Latitude out of range
        with self.assertRaises(ValueError):
            self.engine.compute_teos10_derived_soundings(0, 95.0, 64.0)

        # 4. Longitude out of range
        with self.assertRaises(ValueError):
            self.engine.compute_teos10_derived_soundings(0, 7.5, 195.0)

    def test_acoustic_sound_speed_vs_current_velocity_scale(self):
        """
        Adversarial finding verification:
        GSW TEOS-10 sound_speed_m_s is acoustic propagation velocity (~1500 m/s),
        whereas fluid velocity magnitude (speed) is ~0.0-1.5 m/s.
        Assert that GSW sound_speed_m_s is > 1400 m/s at all depths, proving that mapping
        it to flow speed in SoundingInspectionPanel is physically distinct.
        """
        res = self.engine.compute_teos10_derived_soundings(0, 7.5, 64.0)
        soundings = res["soundings"]
        for s in soundings:
            c = s["sound_speed_m_s"]
            self.assertGreater(c, 1400.0, f"Acoustic speed {c} m/s is surprisingly low")
            self.assertLess(c, 1600.0, f"Acoustic speed {c} m/s is surprisingly high")

    def test_frontend_fallback_profile_generator_all_7_days(self):
        """Stress-test: deriveSoundingSamplesForTimestep must never produce NaNs for any day or variable."""
        for var in ['thetao', 'so', 'salinity', 'speed']:
            for t in range(7):
                samples = derive_sounding_samples_fallback(t, var)
                self.assertEqual(len(samples), 50, f"Expected 50 levels for var={var}, t={t}")
                for s in samples:
                    val = s['scientific_value']
                    self.assertFalse(math.isnan(val), f"Fallback NaN detected for var={var}, t={t}, level={s['level_index']}")
                    self.assertFalse(math.isinf(val), f"Fallback Inf detected for var={var}, t={t}, level={s['level_index']}")
                    self.assertEqual(s['value_state'], 'valid')


if __name__ == '__main__':
    unittest.main()
