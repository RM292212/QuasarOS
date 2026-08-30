"""
TASK-06C: Browser Brick Streaming Engine Integration Test Suite.

Validates that:
1. All sub-volume binary brick payloads (.bin.zst) served via FastAPI can be downloaded,
   verified cryptographically (SHA-256), decompressed (zstd), and decoded into Float16 and Uint16.
2. Bitwise / categorical validity masks cleanly distinguish missing/masked voxels from valid 0.0°C zero values.
3. Checksum mismatches, decompression safety ceilings, and invalid payloads are strictly rejected.
4. Concurrency bounds, request priority scheduling, inflight deduplication, and LRU cache eviction work.
5. The Node.js / TypeScript browser streaming test suite (streaming.test.ts) executes and passes 100%.
"""

import hashlib
import json
import subprocess
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

from quasar_services.app import create_app

REPO_ROOT = Path(__file__).resolve().parent.parent
VIS_DATA_ROOT = (
    REPO_ROOT
    / "data"
    / "visualization"
    / "copernicus_phy_thetao"
    / "copernicus-phy-thetao-20260824-20260830-ca826087"
    / "v1"
)
MANIFEST_PATH = VIS_DATA_ROOT / "visualization_manifest.json"


class TestBrowserStreamingIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)
        cls.active_snapshot_id = "copernicus-phy-thetao-20260824-20260830-ca826087"
        cls.active_dataset_id = "copernicus_phy_thetao"
        cls.active_vis_product_id = f"vis_{cls.active_dataset_id}_{cls.active_snapshot_id}"

        cls.manifest = None
        if MANIFEST_PATH.exists():
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                cls.manifest = json.load(f)

    def test_manifest_and_brick_transport_availability(self):
        """Verify visualization product manifest and immutable payload assets are accessible."""
        self.assertIsNotNone(self.manifest, "Visualization manifest missing")
        self.assertGreaterEqual(len(self.manifest["bricks"]), 63)

        first_brick = self.manifest["bricks"][0]
        brick_key = first_brick["brick_key"]

        # Fetch f16 payload via FastAPI
        res_f16 = self.client.get(
            f"/api/v1/visualization-products/{self.active_vis_product_id}/bricks/{brick_key}/payloads/f16"
        )
        self.assertEqual(res_f16.status_code, 200)
        self.assertEqual(res_f16.headers["content-type"], "application/octet-stream")
        self.assertEqual(res_f16.headers["x-payload-uncompressed-bytes"], "278784")

        # Verify SHA-256 checksum from HTTP header matches manifest
        expected_f16_sha = first_brick["payload_f16"]["sha256_checksum"]
        self.assertEqual(res_f16.headers["x-payload-sha256"], expected_f16_sha)
        computed_sha = hashlib.sha256(res_f16.content).hexdigest()
        self.assertEqual(computed_sha, expected_f16_sha)

        # Fetch u16 payload via FastAPI
        res_u16 = self.client.get(
            f"/api/v1/visualization-products/{self.active_vis_product_id}/bricks/{brick_key}/payloads/u16"
        )
        self.assertEqual(res_u16.status_code, 200)
        expected_u16_sha = first_brick["payload_u16"]["sha256_checksum"]
        self.assertEqual(res_u16.headers["x-payload-sha256"], expected_u16_sha)
        computed_u16_sha = hashlib.sha256(res_u16.content).hexdigest()
        self.assertEqual(computed_u16_sha, expected_u16_sha)

    def test_node_streaming_test_suite_execution(self):
        """Execute the Node/TypeScript test suite (streaming.test.ts) to validate full browser streaming engine."""
        test_file = REPO_ROOT / "packages" / "client" / "test" / "streaming.test.ts"
        self.assertTrue(test_file.exists(), f"Missing {test_file}")

        proc = subprocess.run(
            ["node", "--test", "--experimental-strip-types", str(test_file)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            proc.returncode,
            0,
            f"Node streaming test suite failed:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}",
        )
        self.assertIn("pass 10", proc.stdout)

    def test_complete_client_package_test_suite(self):
        """Execute npm test within packages/client to verify 100% test pass across all modules."""
        proc = subprocess.run(
            ["npm", "test"],
            cwd=str(REPO_ROOT / "packages" / "client"),
            capture_output=True,
            text=True,
            shell=True,
        )
        self.assertEqual(
            proc.returncode,
            0,
            f"Full client test suite failed:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}",
        )
        self.assertIn("pass 22", proc.stdout)


if __name__ == "__main__":
    unittest.main()
