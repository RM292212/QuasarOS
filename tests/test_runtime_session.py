"""
TASK-07B: Runtime Volume Session and Coordinate Systems Integration Test Suite.

Validates that:
1. Pinned volume session identity, cryptographic digests, and manifest validation are enforced.
2. 11-state FSM lifecycle transitions are strictly validated.
3. Bidirectional coordinate conversions (Geodetic <-> Normalized Volume Space <-> Local ENU <-> Brick-Local Index)
   function across all 31 non-uniform vertical depth levels without floating point divergence.
4. Depth LUT binary search, nearest level, and interpolation fractions match authoritative physical extents.
5. 7-day temporal controller scrubbing advances generation epochs and cancels stale requests.
6. 6-plane bounding-box clipping validates units and rejects inverted or domain-overflowing planes.
7. The Node.js / TypeScript test suite (session_coordinates.test.ts) executes and passes 100%.
"""

import json
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RUNTIME_PACKAGE_DIR = REPO_ROOT / "packages" / "runtime"
VIS_DATA_ROOT = (
    REPO_ROOT
    / "data"
    / "visualization"
    / "copernicus_phy_thetao"
    / "copernicus-phy-thetao-20260824-20260830-ca826087"
    / "v1"
)
MANIFEST_PATH = VIS_DATA_ROOT / "visualization_manifest.json"


class TestRuntimeSessionAndCoordinates(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.active_snapshot_id = "copernicus-phy-thetao-20260824-20260830-ca826087"
        cls.active_dataset_id = "copernicus_phy_thetao"
        cls.active_vis_product_id = f"vis_{cls.active_dataset_id}_{cls.active_snapshot_id}"

        cls.manifest = None
        if MANIFEST_PATH.exists():
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                cls.manifest = json.load(f)

    def test_runtime_manifest_and_depth_lut_baseline(self):
        """Verify that visualization manifest depth LUT contains 31 strictly increasing non-uniform levels."""
        self.assertIsNotNone(self.manifest, "Visualization manifest missing")
        coord_transform = self.manifest["visualization_product"]["coordinate_transform"]
        depth_entries = coord_transform["depth_lut_entries_m"]

        self.assertEqual(len(depth_entries), 31)
        self.assertAlmostEqual(depth_entries[0], 0.494025, places=5)
        self.assertAlmostEqual(depth_entries[-1], 453.93771, places=4)

        # Monotonicity check
        for i in range(1, len(depth_entries)):
            self.assertGreater(depth_entries[i], depth_entries[i - 1])

    def test_run_node_runtime_test_suite(self):
        """Execute Node.js @quasar/runtime automated test suite and ensure 100% pass rate."""
        cmd = ["node", "--test"]
        proc = subprocess.run(
            cmd,
            cwd=str(RUNTIME_PACKAGE_DIR),
            capture_output=True,
            text=True,
            shell=True,
        )
        print("\n--- Node.js @quasar/runtime test output ---")
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr)

        self.assertEqual(
            proc.returncode,
            0,
            f"Node test runner failed with exit code {proc.returncode}.\nOutput: {proc.stdout}\nStderr: {proc.stderr}",
        )
        self.assertIn("fail 0", proc.stdout)
        self.assertRegex(proc.stdout, r"pass \d+")


if __name__ == "__main__":
    unittest.main()
