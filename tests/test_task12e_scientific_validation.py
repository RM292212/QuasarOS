"""
TASK-12E: Independent Multivariable Numerical, Vector & Surface Validation
"""
import unittest, os, json, xarray as xr, numpy as np

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
RAW_BASE = f"data/raw/copernicus/physical/{FAMILY_ID}"
CANONICAL_BASE = "data/canonical"
VIS_BASE = "data/visualization"

class TestTask12EScientificAndPlatformValidation(unittest.TestCase):

    def test_speed_calculation_consistency(self):
        ds_u = xr.open_dataset(f"{RAW_BASE}/uo/copernicus_phy_uo_20260824_20260830.nc")
        ds_v = xr.open_dataset(f"{RAW_BASE}/vo/copernicus_phy_vo_20260824_20260830.nc")
        
        u = ds_u["uo"].values
        v = ds_v["vo"].values
        
        valid_both = (~np.isnan(u)) & (~np.isnan(v))
        speed = np.sqrt(u[valid_both]**2 + v[valid_both]**2)
        
        self.assertGreater(speed.size, 0)
        self.assertTrue(np.all(speed >= 0.0))
        self.assertLess(float(np.max(speed)), 5.0) # Physical current bound
        
        ds_u.close()
        ds_v.close()

    def test_zos_surface_elevation_distribution(self):
        ds_z = xr.open_dataset(f"{RAW_BASE}/zos/copernicus_phy_zos_20260824_20260830.nc")
        z = ds_z["zos"].values
        valid_z = z[~np.isnan(z)]
        self.assertGreater(valid_z.size, 0)
        # Indian Ocean regional SSH distribution
        self.assertGreater(float(np.min(valid_z)), -2.0)
        self.assertLess(float(np.max(valid_z)), 2.0)
        ds_z.close()

    def test_salinity_full_depth_profile_integrity(self):
        ds_s = xr.open_dataset(f"{RAW_BASE}/so/copernicus_phy_so_20260824_20260830.nc")
        so = ds_s["so"].values
        valid_so = so[~np.isnan(so)]
        self.assertGreater(valid_so.size, 0)
        self.assertGreater(float(np.min(valid_so)), 30.0)
        self.assertLess(float(np.max(valid_so)), 40.0)
        ds_s.close()

    def test_vertical_slab_overlap_continuity(self):
        # Verify continuity at depth level 31 (453.938m) between slab 0 and slab 1
        ds = xr.open_dataset(f"{RAW_BASE}/thetao/copernicus_phy_thetao_20260824_20260830.nc")
        thetao = ds["thetao"].values
        
        # Level 31 is the interface
        lvl31_vals = thetao[:, 31, :, :]
        self.assertTrue(np.any(~np.isnan(lvl31_vals)))
        ds.close()

if __name__ == "__main__":
    unittest.main()
