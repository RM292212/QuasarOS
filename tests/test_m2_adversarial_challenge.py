"""
Milestone 2 Empirical Adversarial Challenge Verification Harness.
Author: Challenger 1 (m2_challenger_remediation_1)
Role: EMPIRICAL CHALLENGER (critic, specialist)

Direct empirical verification of Milestone 2:
Seven-Day Timeline Temporal Integrity & Stale State Prevention

Verification targets:
1. Exact file presence, dimensionality, and time coordinates across all 7 operational dates
   (2026-08-24 through 2026-08-30) for Copernicus physical variables (thetao, so, uo, vo, zos).
2. Cryptographic SHA-256 uniqueness across all 7 daily time slices:
   ensuring non-identical data arrays, unique hashes, and genuine oceanographic time-evolution.
3. Analysis engine get_volume_slice_grid integrity across all 7 days for thetao and derived speed:
   verifying valid timestamps, dimensions, scalar range sanity, and pairwise distinct digests.
4. TEOS-10 thermodynamic sounding API endpoint across all 7 days:
   verifying dynamic profile variation, status codes, and thermodynamic consistency.
"""

import hashlib
import os
import sys
import numpy as np
import pytest
import xarray as xr
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath("packages/services/src"))
sys.path.insert(0, os.path.abspath("packages/contracts/src"))

from quasar_services.analysis.analysis_engine import ScientificAnalysisEngine, _resolve_nc_path
from quasar_services.app import app

EXPECTED_DATES = [
    "2026-08-24",
    "2026-08-25",
    "2026-08-26",
    "2026-08-27",
    "2026-08-28",
    "2026-08-29",
    "2026-08-30",
]

OPERATIONAL_VARIABLES = ["thetao", "so", "uo", "vo", "zos"]


class TestM2SevenDayTemporalIntegrity:
    """Empirical challenge tests for 7-day timeline temporal integrity."""

    def test_copernicus_7day_netcdf_files_presence_and_integrity(self):
        """Verify each operational variable NetCDF file exists, resolves, and has full 7-day time dimension."""
        for var_name in OPERATIONAL_VARIABLES:
            path = _resolve_nc_path(var_name)
            assert os.path.exists(path), f"Resolved file path does not exist for {var_name}: {path}"
            file_size = os.path.getsize(path)
            assert file_size > 100_000, f"File for {var_name} is unexpectedly small ({file_size} bytes): {path}"

            with xr.open_dataset(path) as ds:
                assert "time" in ds.dims, f"Dataset for {var_name} lacks 'time' dimension: {list(ds.dims)}"
                assert len(ds.time) == 7, f"Dataset for {var_name} must have exactly 7 time slices, found {len(ds.time)}"
                assert var_name in ds.data_vars, f"Dataset lacks variable {var_name}: {list(ds.data_vars)}"

                # Check time coordinates
                times_iso = [str(t)[:10] for t in ds.time.values]
                assert times_iso == EXPECTED_DATES, (
                    f"Variable {var_name} time steps mismatch:\nExpected: {EXPECTED_DATES}\nFound: {times_iso}"
                )

                # Check spatial dimensions
                if var_name != "zos":
                    assert ds[var_name].ndim == 4, f"3D variable {var_name} must have 4 dimensions (time, depth, lat, lon)"
                    assert ds.sizes["depth"] == 50, f"Variable {var_name} must have 50 Copernicus depth levels, found {ds.sizes['depth']}"
                else:
                    assert ds[var_name].ndim == 3, f"2D surface variable zos must have 3 dimensions (time, lat, lon)"

    def test_copernicus_7day_raw_arrays_cryptographic_uniqueness(self):
        """Compute SHA-256 for all 7 raw time slices and assert all are strictly pairwise distinct."""
        for var_name in OPERATIONAL_VARIABLES:
            path = _resolve_nc_path(var_name)
            daily_hashes = []
            daily_stats = []

            with xr.open_dataset(path) as ds:
                data_var = ds[var_name]
                for t_idx in range(7):
                    slice_data = data_var.isel(time=t_idx).values
                    valid_mask = np.isfinite(slice_data)
                    assert np.any(valid_mask), f"{var_name} at t={t_idx} contains no valid finite values"

                    # Canonical byte hash of slice
                    slice_bytes = np.ascontiguousarray(slice_data, dtype=np.float32).tobytes()
                    sha256_digest = hashlib.sha256(slice_bytes).hexdigest()
                    daily_hashes.append(sha256_digest)

                    min_val = float(np.nanmin(slice_data))
                    max_val = float(np.nanmax(slice_data))
                    mean_val = float(np.nanmean(slice_data))
                    daily_stats.append((min_val, max_val, mean_val))

            # Challenge: Assert 7 unique digests
            unique_hashes = set(daily_hashes)
            assert len(unique_hashes) == 7, (
                f"Temporal integrity violation for {var_name}! Expected 7 distinct SHA-256 digests, but got {len(unique_hashes)} unique values:\n"
                f"Hashes: {daily_hashes}"
            )

            # Challenge: Assert day-to-day physical variance exists
            for i in range(len(daily_stats) - 1):
                assert daily_stats[i] != daily_stats[i + 1], (
                    f"Day {i} and Day {i+1} have identical min/max/mean for {var_name}: {daily_stats[i]}"
                )

    def test_analysis_engine_7day_volume_grid_thetao(self):
        """Verify ScientificAnalysisEngine returns distinct volume grids across all 7 dates for thetao."""
        engine = ScientificAnalysisEngine()
        thetao_hashes = []
        timestamps = []

        for t in range(7):
            res = engine.get_volume_slice_grid(
                "thetao",
                time_index=t,
                depth_levels=16,
                lat_res=32,
                lon_res=32,
                min_lon=60.0,
                max_lon=68.0,
                min_lat=0.0,
                max_lat=15.0,
            )

            assert res["variable"] == "thetao"
            assert res["shape"] == [16, 32, 32]
            assert len(res["data"]) == 16 * 32 * 32
            assert res["min_val"] >= 0.5, f"Thetao min ({res['min_val']}) unrealistically low"
            assert res["max_val"] <= 35.0, f"Thetao max ({res['max_val']}) unrealistically high"
            assert res["timestamp_iso"] == EXPECTED_DATES[t], (
                f"Timestamp mismatch at t={t}: expected {EXPECTED_DATES[t]}, got {res['timestamp_iso']}"
            )

            timestamps.append(res["timestamp_iso"])
            data_arr = np.array(res["data"], dtype=np.float32)
            sha = hashlib.sha256(data_arr.tobytes()).hexdigest()
            thetao_hashes.append(sha)

        assert len(set(thetao_hashes)) == 7, (
            f"Expected 7 unique thetao volume grid hashes, but found {len(set(thetao_hashes))}:\n{thetao_hashes}"
        )
        assert timestamps == EXPECTED_DATES

    def test_analysis_engine_7day_volume_grid_speed(self):
        """Verify derived velocity magnitude speed (sqrt(uo^2 + vo^2)) produces valid distinct 7-day volumes."""
        engine = ScientificAnalysisEngine()
        speed_hashes = []

        for t in range(7):
            res = engine.get_volume_slice_grid(
                "speed",
                time_index=t,
                depth_levels=16,
                lat_res=32,
                lon_res=32,
                min_lon=60.0,
                max_lon=68.0,
                min_lat=0.0,
                max_lat=15.0,
            )

            assert res["variable"] == "speed"
            assert res["shape"] == [16, 32, 32]
            assert len(res["data"]) == 16 * 32 * 32
            # Physical velocity magnitude must be non-negative
            assert res["min_val"] >= 0.0, f"Speed min cannot be negative, got {res['min_val']}"
            assert res["max_val"] > 0.1, f"Speed max should reflect dynamic ocean currents, got {res['max_val']}"
            assert res["max_val"] < 5.0, f"Speed max unrealistically high, got {res['max_val']}"
            assert res["timestamp_iso"] == EXPECTED_DATES[t]

            data_arr = np.array(res["data"], dtype=np.float32)
            # Mask out any fill values (-999.0) before testing speed non-negativity
            valid_speeds = data_arr[data_arr > -500.0]
            assert np.all(valid_speeds >= 0.0), "Found negative speed values in valid ocean domain!"

            sha = hashlib.sha256(data_arr.tobytes()).hexdigest()
            speed_hashes.append(sha)

        assert len(set(speed_hashes)) == 7, (
            f"Expected 7 unique speed volume grid hashes, but found {len(set(speed_hashes))}:\n{speed_hashes}"
        )

    def test_teos10_soundings_api_across_7_days(self):
        """Verify TEOS-10 soundings endpoint responds across all 7 operational dates with distinct profiles."""
        client = TestClient(app)
        daily_profiles = []

        for t in range(7):
            payload = {
                "time_index": t,
                "latitude": 7.5,
                "longitude": 64.0,
            }
            res = client.post("/api/v1/analysis/teos10-soundings", json=payload)
            assert res.status_code == 200, f"TEOS-10 soundings failed at t={t}: {res.text}"
            data = res.json()

            assert "soundings" in data
            assert len(data["soundings"]) > 0
            assert "conservative_temperature_C" in data["soundings"][0]
            assert "absolute_salinity_g_kg" in data["soundings"][0]
            assert "in_situ_density_kg_m3" in data["soundings"][0]

            # Collect surface conservative temperature and in-situ density
            surf_ct = data["soundings"][0]["conservative_temperature_C"]
            surf_rho = data["soundings"][0]["in_situ_density_kg_m3"]
            daily_profiles.append((surf_ct, surf_rho))

        # Assert Day 0 and Day 6 profiles reflect distinct ocean conditions
        assert daily_profiles[0] != daily_profiles[6], (
            f"Day 0 and Day 6 returned identical TEOS-10 sounding profiles: {daily_profiles[0]}"
        )
