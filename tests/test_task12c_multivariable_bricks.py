"""
TASK-12C Automated Validation Suite
"""
import unittest, os, json, numpy as np

FAMILY_ID = "copernicus-phy-multivariable-20260824-20260830-v11dev"
VIS_BASE = "data/visualization"
MANIFEST_BASE = "data/manifests/visualization"

class TestTask12CMultivariableBricks(unittest.TestCase):

    def test_3d_visualization_manifests_exist(self):
        for v in ["thetao", "so", "uo", "vo"]:
            var_folder = v if v != "thetao" else "thetao_fulldepth"
            man_path = f"{MANIFEST_BASE}/copernicus_phy_{var_folder}/{FAMILY_ID}/v1/visualization_manifest.json"
            self.assertTrue(os.path.exists(man_path), f"Missing manifest for {v}")
            with open(man_path, "r") as f:
                data = json.load(f)
            self.assertEqual(len(data["bricks"]), 84) # 7 timesteps * 2 slabs * 6 horizontal chunks
            self.assertIn("quantization", data)
            self.assertEqual(data["quantization"]["missing_code"], 65535)

    def test_zos_surface_manifest(self):
        man_path = f"{MANIFEST_BASE}/copernicus_phy_zos/{FAMILY_ID}/v1/visualization_manifest.json"
        self.assertTrue(os.path.exists(man_path))
        with open(man_path, "r") as f:
            data = json.load(f)
        self.assertEqual(len(data["bricks"]), 7) # 7 timesteps
        self.assertFalse(data["is_3d"])

    def test_brick_payload_files_exist(self):
        for v in ["thetao", "so", "uo", "vo"]:
            var_folder = v if v != "thetao" else "thetao_fulldepth"
            f16_path = f"{VIS_BASE}/copernicus_phy_{var_folder}/{FAMILY_ID}/v1/lod0/t0/b_0_0_0_f16.bin.zst"
            u16_path = f"{VIS_BASE}/copernicus_phy_{var_folder}/{FAMILY_ID}/v1/lod0/t0/b_0_0_0_u16.bin.zst"
            self.assertTrue(os.path.exists(f16_path), f"Missing {f16_path}")
            self.assertTrue(os.path.exists(u16_path), f"Missing {u16_path}")
            self.assertGreater(os.path.getsize(f16_path), 5000)
            self.assertGreater(os.path.getsize(u16_path), 5000)

if __name__ == "__main__":
    unittest.main()
