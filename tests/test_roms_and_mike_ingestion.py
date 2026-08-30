"""
Unit test suite for Indian Ocean ROMS Output Evaluation (TASK-01X-G)
and DHI MIKE 21 SW Discovery (TASK-01X-H).

Validates:
1. TASK-01X-G: ROMS raw NetCDF dataset, variables (TEMP, SALT, pH, pCO2, ALK, DIC),
   CF conventions, physical plausibility bounds, checksums, and terrain-following
   vertical s-coordinate mathematical transformations (Song & Haidvogel 1994,
   Shchepetkin & McWilliams 2005).
2. TASK-01X-H: MIKE 21 SW discovery manifest, non-redistributability status,
   format taxonomy (.dfsu, .mesh, .dfs2), open tooling (mikeio), and operational alternative linkage.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


def compute_roms_s_levels(
    h: np.ndarray,
    zeta: np.ndarray,
    N: int = 32,
    theta_s: float = 6.0,
    theta_b: float = 0.4,
    hc: float = 100.0,
    vtransform: int = 2,
    vstretching: int = 4
):
    """
    Computes ROMS 3D terrain-following vertical depth coordinates z(x,y,s,t).
    
    Parameters:
    - h: resting water depth (bathymetry, positive down, shape (Ny, Nx) or scalar)
    - zeta: sea surface elevation (positive up, shape (Ny, Nx) or scalar)
    - N: number of vertical s-levels
    - theta_s: surface stretching parameter (e.g. 5.0 - 7.0)
    - theta_b: bottom stretching parameter (e.g. 0.0 - 2.0)
    - hc: critical thermocline depth parameter (m)
    - vtransform: 1 (Song & Haidvogel 1994) or 2 (Shchepetkin & McWilliams 2005)
    - vstretching: 1 (Song & Haidvogel 1994) or 4 (Shchepetkin 2005 default)
    
    Returns:
    - s_rho: non-dimensional vertical coordinates at rho points in [-1, 0]
    - Cs_r: stretching function values at rho points in [-1, 0]
    - z_rho: vertical depth coordinates in meters (negative below sea surface)
    """
    # 1. Non-dimensional vertical coordinate at rho-points
    # k ranges from 0 to N-1 (index 0 is bottom, index N-1 is surface)
    k = np.arange(N, dtype=np.float64)
    s_rho = (k - N + 0.5) / N  # s in (-1, 0)

    # 2. Vertical stretching function C(s)
    if vstretching == 1:
        # Song and Haidvogel (1994)
        c_sur = np.sinh(theta_s * s_rho) / np.sinh(theta_s)
        c_bot = (np.tanh(theta_s * (s_rho + 0.5)) - np.tanh(0.5 * theta_s)) / (2.0 * np.tanh(0.5 * theta_s))
        Cs_r = (1.0 - theta_b) * c_sur + theta_b * c_bot
    elif vstretching == 4:
        # Shchepetkin (2005)
        c_sur = (1.0 - np.cosh(theta_s * s_rho)) / (np.cosh(theta_s) - 1.0)
        c_bot = (np.exp(theta_b * c_sur) - 1.0) / (1.0 - np.exp(-theta_b)) if theta_b > 0 else c_sur
        Cs_r = (np.exp(theta_s * c_bot) - 1.0) / (1.0 - np.exp(-theta_s))
    else:
        # Linear default
        Cs_r = s_rho

    # 3. Vertical depth transformation z(s)
    h_arr = np.asarray(h, dtype=np.float64)
    zeta_arr = np.asarray(zeta, dtype=np.float64)

    if vtransform == 1:
        # Song and Haidvogel (1994)
        # S(s) = hc * s + (h - hc) * C(s)
        # Note: ROMS formulation requires hc <= min(h) to prevent coordinate folding
        hc_eff = np.minimum(hc, h_arr)
        z_rho = np.empty((N,) + h_arr.shape, dtype=np.float64)
        for i in range(N):
            s = s_rho[i]
            c = Cs_r[i]
            S = hc_eff * s + (h_arr - hc_eff) * c
            z_rho[i] = S + zeta_arr * (1.0 + S / h_arr)
    elif vtransform == 2:
        # Shchepetkin and McWilliams (2005)
        # S0(s) = (hc * s + h * C(s)) / (hc + h)
        # z(s) = zeta + (zeta + h) * S0(s)
        z_rho = np.empty((N,) + h_arr.shape, dtype=np.float64)
        for i in range(N):
            s = s_rho[i]
            c = Cs_r[i]
            S0 = (hc * s + h_arr * c) / (hc + h_arr)
            z_rho[i] = zeta_arr + (zeta_arr + h_arr) * S0
    else:
        raise ValueError(f"Unsupported Vtransform: {vtransform}")

    return s_rho, Cs_r, z_rho


class TestROMSIngestion(unittest.TestCase):
    """Test suite for Indian Ocean ROMS Output Evaluation (TASK-01X-G)."""

    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.roms_nc_path = os.path.join(cls.repo_root, "data", "raw", "roms", "incois_bio_roms_north_indian_ocean.nc")
        cls.roms_manifest_path = os.path.join(cls.repo_root, "data", "manifests", "roms", "roms_manifest.json")

    def test_roms_raw_file_exists(self):
        self.assertTrue(os.path.exists(self.roms_nc_path), f"ROMS NetCDF file missing: {self.roms_nc_path}")
        file_size = os.path.getsize(self.roms_nc_path)
        self.assertGreater(file_size, 100_000, f"ROMS NetCDF file unexpectedly small: {file_size} bytes")

    def test_roms_manifest_metadata(self):
        self.assertTrue(os.path.exists(self.roms_manifest_path), f"ROMS manifest missing: {self.roms_manifest_path}")
        with open(self.roms_manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01X-G")
        self.assertEqual(manifest.get("provider"), "Indian National Centre for Ocean Information Services (INCOIS)")
        self.assertEqual(manifest.get("model_framework"), "Regional Ocean Modeling System (ROMS)")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertIn("10.5281/zenodo.11670413", manifest.get("doi", ""))
        self.assertIn("CC-BY-4.0", manifest.get("licence", ""))
        self.assertIn("roms_vertical_coordinate_evaluation", manifest)
        self.assertIn("variables", manifest)
        self.assertEqual(len(manifest["files"]), 1)

    def test_roms_sha256_checksum(self):
        with open(self.roms_manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        expected_sha256 = manifest["files"][0]["sha256"]
        expected_bytes = manifest["files"][0]["byte_size"]

        hasher = hashlib.sha256()
        with open(self.roms_nc_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        actual_sha256 = hasher.hexdigest()
        actual_bytes = os.path.getsize(self.roms_nc_path)

        self.assertEqual(actual_bytes, expected_bytes, "File byte size mismatch with manifest")
        self.assertEqual(actual_sha256, expected_sha256, "SHA256 checksum mismatch with manifest")

    def test_roms_dimensions_and_coordinates(self):
        ds = netCDF4.Dataset(self.roms_nc_path, "r")
        try:
            self.assertIn("time", ds.dimensions)
            self.assertIn("lat", ds.dimensions)
            self.assertIn("lon", ds.dimensions)

            lats = ds.variables["lat"][:]
            lons = ds.variables["lon"][:]
            times = ds.variables["time"][:]

            self.assertGreater(len(lats), 10)
            self.assertGreater(len(lons), 10)
            self.assertGreater(len(times), 0)

            # Spatial coverage in Indian Ocean
            self.assertGreaterEqual(float(lats.min()), 0.0)
            self.assertLessEqual(float(lats.max()), 30.0)
            self.assertTrue(np.all(np.diff(lats) > 0), "Latitudes must be strictly monotonically increasing")

            self.assertGreaterEqual(float(lons.min()), 40.0)
            self.assertLessEqual(float(lons.max()), 100.0)
            self.assertTrue(np.all(np.diff(lons) > 0), "Longitudes must be strictly monotonically increasing")

            self.assertTrue(np.all(np.diff(times) >= 0), "Timestamps must be monotonically non-decreasing")
        finally:
            ds.close()

    def test_roms_physical_variable_bounds(self):
        ds = netCDF4.Dataset(self.roms_nc_path, "r")
        try:
            expected_vars = ["temp", "salt", "pH", "pCO2", "alk", "dic"]
            for var_name in expected_vars:
                self.assertIn(var_name, ds.variables, f"Expected variable '{var_name}' missing from ROMS dataset")
                v = ds.variables[var_name]
                self.assertEqual(v.dimensions, ("time", "lat", "lon"))
                data = v[:]
                valid_mask = (data > -1e30) & (~np.isnan(data))
                self.assertGreater(np.count_nonzero(valid_mask), 0, f"No valid ocean cells for '{var_name}'")

                valid_vals = data[valid_mask]
                min_val = float(valid_vals.min())
                max_val = float(valid_vals.max())
                mean_val = float(valid_vals.mean())

                if var_name == "temp":
                    self.assertGreater(min_val, 20.0, f"SST minimum {min_val} C is unrealistically low for tropical surface")
                    self.assertLess(max_val, 36.0, f"SST maximum {max_val} C is unrealistically high")
                    self.assertGreater(mean_val, 25.0, f"Mean SST {mean_val} C is outside expected tropical range")
                elif var_name == "salt":
                    self.assertGreater(min_val, 28.0, f"SSS minimum {min_val} PSU is unrealistically low")
                    self.assertLess(max_val, 40.0, f"SSS maximum {max_val} PSU is unrealistically high")
                elif var_name == "pH":
                    self.assertGreater(min_val, 7.8, f"Surface pH {min_val} is unrealistically low")
                    self.assertLess(max_val, 8.4, f"Surface pH {max_val} is unrealistically high")
                elif var_name == "pCO2":
                    self.assertGreater(min_val, 250.0, f"Surface pCO2 {min_val} uatm is unrealistically low")
                    self.assertLess(max_val, 600.0, f"Surface pCO2 {max_val} uatm is unrealistically high")
                elif var_name in ["alk", "dic"]:
                    self.assertGreater(min_val, 1500.0, f"{var_name} {min_val} mmol/m3 is unrealistically low")
                    self.assertLess(max_val, 2600.0, f"{var_name} {max_val} mmol/m3 is unrealistically high")
        finally:
            ds.close()

    def test_roms_vertical_s_coordinate_formulation_vtransform1(self):
        """Validates Song & Haidvogel (1994) Vtransform=1 vertical coordinate transformation."""
        bathymetries = np.array([20.0, 100.0, 500.0, 2500.0, 4500.0])
        elevations = np.array([-1.5, 0.0, 1.2])

        for h_val in bathymetries:
            for zeta_val in elevations:
                s_rho, Cs_r, z_rho = compute_roms_s_levels(
                    h=h_val,
                    zeta=zeta_val,
                    N=32,
                    theta_s=6.0,
                    theta_b=0.4,
                    hc=100.0,
                    vtransform=1,
                    vstretching=1
                )

                # Strict vertical monotonicity: z(k+1) > z(k)
                self.assertTrue(np.all(np.diff(z_rho) > 0), f"Vtransform=1 failed vertical monotonicity for h={h_val}, zeta={zeta_val}")

                # Surface layer (k=N-1) must be close to zeta, deep layer (k=0) close to -h
                self.assertLessEqual(float(z_rho[-1]), zeta_val)
                self.assertGreaterEqual(float(z_rho[0]), -h_val)

    def test_roms_vertical_s_coordinate_formulation_vtransform2(self):
        """Validates Shchepetkin & McWilliams (2005) Vtransform=2 vertical coordinate transformation."""
        bathymetries = np.array([15.0, 50.0, 250.0, 1500.0, 4000.0])
        elevations = np.array([-1.0, 0.0, 2.0])

        for h_val in bathymetries:
            for zeta_val in elevations:
                s_rho, Cs_r, z_rho = compute_roms_s_levels(
                    h=h_val,
                    zeta=zeta_val,
                    N=32,
                    theta_s=6.5,
                    theta_b=0.5,
                    hc=150.0,
                    vtransform=2,
                    vstretching=4
                )

                # Strict vertical monotonicity: z(k+1) > z(k)
                self.assertTrue(np.all(np.diff(z_rho) > 0), f"Vtransform=2 failed vertical monotonicity for h={h_val}, zeta={zeta_val}")

                # Surface layer (k=N-1) must be close to zeta, deep layer (k=0) close to -h
                self.assertLessEqual(float(z_rho[-1]), zeta_val)
                self.assertGreaterEqual(float(z_rho[0]), -h_val)

    def test_roms_s_coordinate_exact_boundary_limits(self):
        """Tests exact mathematical boundary conditions at sigma=0 (surface) and sigma=-1 (bottom)."""
        h = 3000.0
        zeta = 1.5
        hc = 100.0

        # At surface (s=0, C=0):
        # Vtransform 1: S = 0 => z = 0 + zeta*(1+0) = zeta
        # Vtransform 2: S0 = 0 => z = zeta + (zeta+h)*0 = zeta
        s_surf = 0.0
        c_surf = 0.0
        z_v1_surf = (hc * s_surf + (h - hc) * c_surf) + zeta * (1.0 + (hc * s_surf + (h - hc) * c_surf) / h)
        z_v2_surf = zeta + (zeta + h) * ((hc * s_surf + h * c_surf) / (hc + h))

        self.assertAlmostEqual(z_v1_surf, zeta, places=6)
        self.assertAlmostEqual(z_v2_surf, zeta, places=6)

        # At bottom (s=-1, C=-1):
        # Vtransform 1: S = -hc - (h-hc) = -h => z = -h + zeta*(1 - h/h) = -h
        # Vtransform 2: S0 = (-hc - h)/(hc+h) = -1 => z = zeta + (zeta+h)*(-1) = -h
        s_bot = -1.0
        c_bot = -1.0
        S_bot = hc * s_bot + (h - hc) * c_bot
        z_v1_bot = S_bot + zeta * (1.0 + S_bot / h)
        S0_bot = (hc * s_bot + h * c_bot) / (hc + h)
        z_v2_bot = zeta + (zeta + h) * S0_bot

        self.assertAlmostEqual(z_v1_bot, -h, places=6)
        self.assertAlmostEqual(z_v2_bot, -h, places=6)


class TestMIKE21SWDiscovery(unittest.TestCase):
    """Test suite for DHI MIKE 21 SW Discovery & Evaluation (TASK-01X-H)."""

    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.manifest_path = os.path.join(cls.repo_root, "data", "manifests", "mike21sw", "mike21sw_manifest.json")
        cls.readme_path = os.path.join(cls.repo_root, "data", "raw", "mike21sw", "README.md")

    def test_mike21sw_manifest_exists(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"MIKE 21 SW manifest missing: {self.manifest_path}")

    def test_mike21sw_manifest_structure_and_status(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01X-H")
        self.assertEqual(manifest.get("status"), "COMPLETE — NO PUBLIC REDISTRIBUTABLE MIKE 21 SW DATASET IDENTIFIED")
        self.assertEqual(manifest.get("evaluation_verdict"), "NO_PUBLIC_REDISTRIBUTABLE_DATASET")
        self.assertIn("DHI", manifest.get("provider", ""))
        self.assertIn("MIKE 21 Spectral Wave", manifest.get("model_name", ""))
        self.assertIn("licensing_model", manifest)

    def test_mike21sw_formats_and_tooling(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        formats = manifest.get("data_formats_evaluated", [])
        exts = [fmt["format_extension"] for fmt in formats]
        self.assertIn(".dfsu", exts)
        self.assertIn(".mesh", exts)
        self.assertIn(".dfs2", exts)

        tooling = manifest.get("open_access_tooling", {})
        self.assertEqual(tooling.get("library"), "mikeio")
        self.assertEqual(tooling.get("license"), "BSD-3-Clause")

        alt = manifest.get("operational_alternative", {})
        self.assertEqual(alt.get("approved_operational_wave_model"), "NOAA WAVEWATCH III (WW3)")
        self.assertEqual(alt.get("task_reference"), "TASK-01X-C")

    def test_mike21sw_readme_report_exists_and_detailed(self):
        self.assertTrue(os.path.exists(self.readme_path), f"MIKE 21 SW README missing: {self.readme_path}")
        with open(self.readme_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("TASK-01X-H", content)
        self.assertIn("COMPLETE — NO PUBLIC REDISTRIBUTABLE MIKE 21 SW DATASET IDENTIFIED", content)
        self.assertIn("DHI", content)
        self.assertIn("dfsu", content)
        self.assertIn("mesh", content)
        self.assertIn("mikeio", content)
        self.assertIn("WAVEWATCH", content)


if __name__ == "__main__":
    unittest.main()
