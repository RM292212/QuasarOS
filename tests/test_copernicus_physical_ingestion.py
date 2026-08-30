"""
Test suite for Copernicus Marine Physical Model Ingestion (TASK-01C).
Validates raw NetCDF-4 physical model datasets (currents, temperature, salinity, surface fields),
coordinate systems, dimensions, physical bounds, SHA-256 checksums, and manifest metadata.
"""

import os
import json
import hashlib
import unittest
import numpy as np
import netCDF4


class TestCopernicusPhysicalIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.raw_dir = os.path.join(cls.repo_root, "data", "raw", "copernicus", "physical")
        cls.manifest_path = os.path.join(cls.repo_root, "data", "manifests", "copernicus-physical", "copernicus_physical_manifest.json")
        
        cls.expected_nc_files = [
            "copernicus_phy_cur_20250420_20250426.nc",
            "copernicus_phy_thetao_20250420_20250426.nc",
            "copernicus_phy_so_20250420_20250426.nc",
            "copernicus_phy_surf_20250420_20250426.nc"
        ]

    def test_raw_files_exist(self):
        for fname in self.expected_nc_files:
            fpath = os.path.join(self.raw_dir, fname)
            self.assertTrue(os.path.exists(fpath), f"NetCDF file missing: {fpath}")
            size = os.path.getsize(fpath)
            self.assertGreater(size, 500_000, f"NetCDF file unexpectedly small: {size} bytes ({fname})")

    def test_manifest_structure_and_task_id(self):
        self.assertTrue(os.path.exists(self.manifest_path), f"Manifest missing: {self.manifest_path}")
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest.get("task_id"), "TASK-01C")
        self.assertEqual(manifest.get("validation_status"), "VALIDATED")
        self.assertEqual(manifest.get("product_id"), "GLOBAL_ANALYSISFORECAST_PHY_001_024")
        self.assertIn("licence", manifest)
        self.assertIn("provider", manifest)
        self.assertIn("geographic_bounds", manifest)
        self.assertIn("vertical_bounds", manifest)
        self.assertIn("temporal_bounds", manifest)
        self.assertIn("files", manifest)
        self.assertEqual(len(manifest["files"]), 4)

    def test_sha256_checksums_match_manifest(self):
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        for file_entry in manifest["files"]:
            rel_p = file_entry["relative_path"].replace("/", os.sep)
            abs_p = os.path.join(self.repo_root, rel_p)
            self.assertTrue(os.path.exists(abs_p), f"File in manifest does not exist: {abs_p}")

            expected_size = file_entry["byte_size"]
            expected_sha = file_entry["sha256"]

            actual_size = os.path.getsize(abs_p)
            hasher = hashlib.sha256()
            with open(abs_p, "rb") as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            actual_sha = hasher.hexdigest()

            self.assertEqual(actual_size, expected_size, f"Byte size mismatch for {file_entry['filename']}")
            self.assertEqual(actual_sha, expected_sha, f"SHA-256 checksum mismatch for {file_entry['filename']}")

    def test_netcdf_dimensions_and_variables(self):
        # 1. Currents (uo, vo)
        cur_path = os.path.join(self.raw_dir, "copernicus_phy_cur_20250420_20250426.nc")
        with netCDF4.Dataset(cur_path, "r") as ds:
            self.assertIn("uo", ds.variables)
            self.assertIn("vo", ds.variables)
            self.assertIn("depth", ds.variables)
            self.assertIn("latitude", ds.variables)
            self.assertIn("longitude", ds.variables)
            self.assertIn("time", ds.variables)
            self.assertEqual(len(ds.dimensions["time"]), 7)
            self.assertEqual(len(ds.dimensions["depth"]), 31)

        # 2. Temperature (thetao)
        tem_path = os.path.join(self.raw_dir, "copernicus_phy_thetao_20250420_20250426.nc")
        with netCDF4.Dataset(tem_path, "r") as ds:
            self.assertIn("thetao", ds.variables)
            self.assertIn("depth", ds.variables)
            self.assertEqual(len(ds.dimensions["time"]), 7)
            self.assertEqual(len(ds.dimensions["depth"]), 31)

        # 3. Salinity (so)
        sal_path = os.path.join(self.raw_dir, "copernicus_phy_so_20250420_20250426.nc")
        with netCDF4.Dataset(sal_path, "r") as ds:
            self.assertIn("so", ds.variables)
            self.assertIn("depth", ds.variables)
            self.assertEqual(len(ds.dimensions["time"]), 7)
            self.assertEqual(len(ds.dimensions["depth"]), 31)

        # 4. Surface fields (zos, mlotst)
        surf_path = os.path.join(self.raw_dir, "copernicus_phy_surf_20250420_20250426.nc")
        with netCDF4.Dataset(surf_path, "r") as ds:
            self.assertIn("zos", ds.variables)
            self.assertIn("mlotst", ds.variables)
            self.assertEqual(len(ds.dimensions["time"]), 7)

    def test_physical_variable_bounds_and_validity(self):
        # Test temperature bounds in tropical Indian Ocean (4C to 35C)
        tem_path = os.path.join(self.raw_dir, "copernicus_phy_thetao_20250420_20250426.nc")
        with netCDF4.Dataset(tem_path, "r") as ds:
            thetao = ds.variables["thetao"][:]
            valid_thetao = thetao.compressed() if np.ma.is_masked(thetao) else thetao[~np.isnan(thetao)]
            self.assertGreater(len(valid_thetao), 1000)
            self.assertGreater(float(valid_thetao.min()), 3.0)
            self.assertLess(float(valid_thetao.max()), 35.0)

        # Test salinity bounds (30 PSU to 38 PSU)
        sal_path = os.path.join(self.raw_dir, "copernicus_phy_so_20250420_20250426.nc")
        with netCDF4.Dataset(sal_path, "r") as ds:
            so = ds.variables["so"][:]
            valid_so = so.compressed() if np.ma.is_masked(so) else so[~np.isnan(so)]
            self.assertGreater(len(valid_so), 1000)
            self.assertGreater(float(valid_so.min()), 28.0)
            self.assertLess(float(valid_so.max()), 38.0)

        # Test current velocity bounds (-3.0 m/s to 3.0 m/s)
        cur_path = os.path.join(self.raw_dir, "copernicus_phy_cur_20250420_20250426.nc")
        with netCDF4.Dataset(cur_path, "r") as ds:
            uo = ds.variables["uo"][:]
            vo = ds.variables["vo"][:]
            valid_uo = uo.compressed() if np.ma.is_masked(uo) else uo[~np.isnan(uo)]
            valid_vo = vo.compressed() if np.ma.is_masked(vo) else vo[~np.isnan(vo)]
            self.assertGreater(len(valid_uo), 1000)
            self.assertGreater(len(valid_vo), 1000)
            self.assertGreater(float(valid_uo.min()), -3.0)
            self.assertLess(float(valid_uo.max()), 3.0)
            self.assertGreater(float(valid_vo.min()), -3.0)
            self.assertLess(float(valid_vo.max()), 3.0)

        # Test sea surface height bounds (-2.0 m to 2.0 m) and mixed layer depth (0 to 300 m)
        surf_path = os.path.join(self.raw_dir, "copernicus_phy_surf_20250420_20250426.nc")
        with netCDF4.Dataset(surf_path, "r") as ds:
            zos = ds.variables["zos"][:]
            mlotst = ds.variables["mlotst"][:]
            valid_zos = zos.compressed() if np.ma.is_masked(zos) else zos[~np.isnan(zos)]
            valid_mlotst = mlotst.compressed() if np.ma.is_masked(mlotst) else mlotst[~np.isnan(mlotst)]
            self.assertGreater(len(valid_zos), 500)
            self.assertGreater(len(valid_mlotst), 500)
            self.assertGreater(float(valid_zos.min()), -2.0)
            self.assertLess(float(valid_zos.max()), 2.0)
            self.assertGreaterEqual(float(valid_mlotst.min()), 0.0)
            self.assertLessEqual(float(valid_mlotst.max()), 300.0)


if __name__ == "__main__":
    unittest.main()
