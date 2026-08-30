"""
TASK-12B Automated Verification Suite
"""
import unittest, os, json, xarray as xr, numpy as np

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
RAW_BASE = f"data/raw/copernicus/physical/{FAMILY_ID}"
CANONICAL_BASE = "data/canonical"
MANIFEST_BASE = f"data/manifests/copernicus-physical/{FAMILY_ID}"

class TestTask12BRealAcquisitionAndCanonical(unittest.TestCase):

    def test_all_5_native_netcdf_files_exist_and_non_empty(self):
        for v in ["thetao", "so", "uo", "vo", "zos"]:
            path = f"{RAW_BASE}/{v}/copernicus_phy_{v}_20260824_20260830.nc"
            self.assertTrue(os.path.exists(path), f"Missing {path}")
            self.assertGreater(os.path.getsize(path), 500000, f"File too small {path}")

    def test_full_depth_50_levels_monotonic(self):
        path = f"{RAW_BASE}/thetao/copernicus_phy_thetao_20260824_20260830.nc"
        ds = xr.open_dataset(path)
        depths = ds["depth"].values
        self.assertEqual(len(depths), 50, "Expected exactly 50 depth levels")
        self.assertTrue(np.all(np.diff(depths) > 0), "Depth must be monotonically strictly increasing")
        self.assertAlmostEqual(float(depths[0]), 0.494025, places=3)
        self.assertAlmostEqual(float(depths[-1]), 5727.917, places=1)
        ds.close()

    def test_salinity_units_conform_to_provider_documentation(self):
        path = f"{RAW_BASE}/so/copernicus_phy_so_20260824_20260830.nc"
        ds = xr.open_dataset(path)
        units = ds["so"].attrs.get("units")
        self.assertEqual(units, "1e-3", f"Expected provider units '1e-3', got {units}")
        ds.close()

    def test_uo_and_vo_identical_grid_and_mask(self):
        ds_u = xr.open_dataset(f"{RAW_BASE}/uo/copernicus_phy_uo_20260824_20260830.nc")
        ds_v = xr.open_dataset(f"{RAW_BASE}/vo/copernicus_phy_vo_20260824_20260830.nc")
        np.testing.assert_array_equal(ds_u["depth"].values, ds_v["depth"].values)
        np.testing.assert_array_equal(ds_u["latitude"].values, ds_v["latitude"].values)
        np.testing.assert_array_equal(ds_u["longitude"].values, ds_v["longitude"].values)
        
        # Check identical land/sea mask
        nan_u = np.isnan(ds_u["uo"].values)
        nan_v = np.isnan(ds_v["vo"].values)
        self.assertTrue(np.array_equal(nan_u, nan_v), "uo and vo must share identical validity mask")
        ds_u.close()
        ds_v.close()

    def test_zos_is_strictly_2d_surface_field(self):
        ds_z = xr.open_dataset(f"{RAW_BASE}/zos/copernicus_phy_zos_20260824_20260830.nc")
        self.assertEqual(len(ds_z["zos"].dims), 3, "zos must have exactly 3 dimensions (time, lat, lon)")
        self.assertNotIn("depth", ds_z["zos"].dims, "zos must not have a depth dimension")
        ds_z.close()

    def test_lossless_zarr_parity(self):
        with open("task_12b_canonical_parity_results.json", "r") as f:
            parity = json.load(f)
        for var in ["thetao", "so", "uo", "vo", "zos"]:
            self.assertIn(var, parity)
            self.assertTrue(parity[var]["lossless_parity_verified"])
            self.assertEqual(parity[var]["max_abs_difference"], 0.0)

    def test_snapshot_family_manifest(self):
        with open(f"{MANIFEST_BASE}/snapshot_family_manifest.json", "r") as f:
            fam = json.load(f)
        self.assertEqual(fam["family_id"], FAMILY_ID)
        self.assertEqual(fam["depth_coverage"]["levels_count"], 50)
        self.assertEqual(len(fam["variables"]), 5)
        self.assertTrue(fam["is_real_data"])

if __name__ == "__main__":
    unittest.main()
