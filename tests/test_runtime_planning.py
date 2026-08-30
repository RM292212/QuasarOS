"""
TASK-07C: Runtime LOD Planning, Residency, and RenderPacket Integration Test Suite.

Validates that:
1. AbstractViewState and frustum culling mathematics evaluate bounding box intersections.
2. LodSelector with hysteresis selects target LOD levels deterministically without jitter.
3. BrickPlanner evaluates frustum visibility, clipping ROI filtering, fallback parent resolutions,
   and 6-tier request scheduling priority scores.
4. ResidentBrickLedger manages memory footprint, enforces budgets (< 50 MiB), and protects pinned fallback parents.
5. RenderPacketSynthesizer synthesizes complete frame-ready packets containing zero-copy buffer references,
   validity masks, depth LUT entries, and coordinate uniforms.
6. ProvisionalPickMapper converts viewport ray hits into approximate render picks and authoritative ReconcilePickRequests.
7. Node.js native test suite passes 100%.
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


class TestRuntimePlanningAndRenderPacket(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.active_snapshot_id = "copernicus-phy-thetao-20260824-20260830-ca826087"
        cls.active_dataset_id = "copernicus_phy_thetao"
        cls.active_vis_product_id = f"vis_{cls.active_dataset_id}_{cls.active_snapshot_id}"

        cls.manifest = None
        if MANIFEST_PATH.exists():
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                cls.manifest = json.load(f)

    def test_manifest_lod_and_brick_topology(self):
        """Verify that visualization manifest specifies 3 LOD levels and 63 total bricks."""
        self.assertIsNotNone(self.manifest, "Visualization manifest missing")
        vis_product = self.manifest["visualization_product"]
        lod_levels = vis_product["available_lod_levels"]

        self.assertEqual(len(lod_levels), 3)
        self.assertEqual(lod_levels[0]["lod_level"], 0)
        self.assertEqual(lod_levels[0]["grid_shape"], [97, 181, 31])
        self.assertEqual(lod_levels[0]["total_brick_count"], 6)

        self.assertEqual(lod_levels[1]["lod_level"], 1)
        self.assertEqual(lod_levels[1]["grid_shape"], [49, 91, 31])
        self.assertEqual(lod_levels[1]["total_brick_count"], 2)

        self.assertEqual(lod_levels[2]["lod_level"], 2)
        self.assertEqual(lod_levels[2]["grid_shape"], [25, 46, 31])
        self.assertEqual(lod_levels[2]["total_brick_count"], 1)

        # 7 timesteps * (6 + 2 + 1) = 63 total bricks
        total_manifest_bricks = len(self.manifest["bricks"])
        self.assertEqual(total_manifest_bricks, 63)

    def test_run_node_runtime_planning_test_suite(self):
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
        self.assertRegex(proc.stdout, r"pass \d+")
        self.assertIn("fail 0", proc.stdout)


if __name__ == "__main__":
    unittest.main()
