"""
tests/test_runtime_failure_injection.py — Runtime Failure Injection & Boundary Validation Test Suite.

TASK-07D: Independent Runtime and Scientific Validation.

Validates robust defenses and error contracts:
1. Coordinate & Depth LUT failure injection: non-monotonic depth LUT, out-of-range depths.
2. 6-plane clipping failure injection: inverted bounds, domain overflows.
3. Session integrity & FSM governance: snapshot mutation rejection, invalid lifecycle transitions.
4. Temporal scrubbing boundaries: out-of-range index rejection, stale generation abort detection.
5. Architectural boundary integrity: strict verification that @quasar/runtime has ZERO dependencies
   or imports of Babylon.js, WebGPU, WebGL2, Three.js, CesiumJS, or DOM manipulation.
6. Real end-to-end provisional pick to exact-query reconciliation against live FastAPI backend.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import unittest
from fastapi.testclient import TestClient

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
SERVICES_SRC = REPO_ROOT / "packages" / "services" / "src"
INGESTION_SRC = REPO_ROOT / "packages" / "ingestion" / "src"
RUNTIME_PACKAGE_DIR = REPO_ROOT / "packages" / "runtime"
RUNTIME_SRC_DIR = RUNTIME_PACKAGE_DIR / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from quasar_services.app import create_app


class TestRuntimeFailureInjectionAndValidation(unittest.TestCase):
    """Failure injection and independent validation tests for the renderer-independent volume runtime."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)
        cls.active_snapshot_id = "copernicus-phy-thetao-20260824-20260830-ca826087"
        cls.active_dataset_id = "copernicus_phy_thetao"
        cls.active_vis_product_id = f"vis_{cls.active_dataset_id}_{cls.active_snapshot_id}"

        # Load authoritative manifest
        manifest_path = (
            REPO_ROOT
            / "data"
            / "visualization"
            / cls.active_dataset_id
            / cls.active_snapshot_id
            / "v1"
            / "visualization_manifest.json"
        )
        cls.manifest = None
        if manifest_path.exists():
            with open(manifest_path, "r", encoding="utf-8") as f:
                cls.manifest = json.load(f)

    def test_run_node_runtime_failure_injection_suite(self):
        """Execute Node.js native failure injection and architectural boundary test suite."""
        cmd = ["node", "--test", "test/failure_injection.test.ts"]
        proc = subprocess.run(
            cmd,
            cwd=str(RUNTIME_PACKAGE_DIR),
            capture_output=True,
            text=True,
            shell=True,
        )
        print("\n--- Node.js failure_injection.test.ts output ---")
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr)

        self.assertEqual(
            proc.returncode,
            0,
            f"Failure injection test failed with exit code {proc.returncode}.\nOutput: {proc.stdout}\nStderr: {proc.stderr}",
        )
        self.assertIn("fail 0", proc.stdout)

    def test_run_node_runtime_e2e_integration_suite(self):
        """Execute Node.js 8-scenario end-to-end integration test suite."""
        cmd = ["node", "--test", "test/integration.test.ts"]
        proc = subprocess.run(
            cmd,
            cwd=str(RUNTIME_PACKAGE_DIR),
            capture_output=True,
            text=True,
            shell=True,
        )
        print("\n--- Node.js integration.test.ts output ---")
        print(proc.stdout)
        if proc.stderr:
            print(proc.stderr)

        self.assertEqual(
            proc.returncode,
            0,
            f"Integration test failed with exit code {proc.returncode}.\nOutput: {proc.stdout}\nStderr: {proc.stderr}",
        )
        self.assertIn("fail 0", proc.stdout)

    def test_python_side_architectural_boundary_check(self):
        """Verify that packages/runtime/src has ZERO forbidden imports or browser engine dependencies."""
        forbidden_tokens = [
            "@babylonjs",
            "babylonjs",
            "three",
            "cesium",
            "@webgpu",
            "HTMLCanvasElement",
            "document.createElement",
            "window.addEventListener",
            "WebGLRenderingContext",
            "WebGL2RenderingContext",
            "GPUDevice",
            "GPUBuffer",
            "GPUTexture",
        ]

        violations = []
        for root, _, files in os.walk(RUNTIME_SRC_DIR):
            for file in files:
                if file.endswith(".ts"):
                    file_path = pathlib.Path(root) / file
                    with open(file_path, "r", encoding="utf-8") as f:
                        lines = f.readlines()
                    for idx, line in enumerate(lines, 1):
                        stripped = line.strip()
                        if stripped.startswith("*") or stripped.startswith("//") or stripped.startswith("/*"):
                            continue
                        for token in forbidden_tokens:
                            if token in line:
                                violations.append(
                                    {
                                        "file": str(file_path.relative_to(RUNTIME_SRC_DIR)),
                                        "token": token,
                                        "line": idx,
                                    }
                                )

        self.assertEqual(
            len(violations),
            0,
            f"Found architectural boundary violations in runtime/src:\n{json.dumps(violations, indent=2)}",
        )

    def test_reconcile_pick_query_end_to_end_against_fastapi(self):
        """Verify that a runtime ReconcilePickRequest resolves accurately via FastAPI /api/v1/queries/reconcile-pick."""
        # Provisional pick parameters from runtime
        request_body = {
            "dataset_id": self.active_dataset_id,
            "snapshot_id": self.active_snapshot_id,
            "variable_id": "sea_water_potential_temperature",
            "target_time_utc": "2026-08-30T00:00:00Z",
            "longitude_deg": 84.0,
            "latitude_deg": 4.0,
            "depth_m": 0.494025,
            "selection_method": "nearest_native_sample",
            "provisional_pick": {
                "response_type": "approximate_render_sample",
                "visualization_product_id": self.active_vis_product_id,
                "lod_level": 0,
                "approximate_value": 28.5,
                "display_units": "degree_Celsius",
                "world_ray_hit_position": [84.0, 4.0, -0.494],
                "estimated_sample_error_bound": 0.05,
                "approximation_notice": "Provisional rendered value.",
            },
        }

        response = self.client.post("/api/v1/queries/reconcile-pick", json=request_body)
        self.assertEqual(response.status_code, 200, f"Error: {response.text}")
        payload = response.json()
        data = payload.get("data", payload)

        self.assertEqual(data["response_type"], "authoritative_reconciled_pick")
        self.assertIn("authoritative_response", data)
        auth_resp = data["authoritative_response"]
        self.assertEqual(auth_resp["canonical_units"], "degree_Celsius")
        self.assertIsInstance(auth_resp["scientific_value"], float)

        # Scientific temperature sanity in equatorial Indian Ocean
        self.assertGreater(auth_resp["scientific_value"], 20.0)
        self.assertLess(auth_resp["scientific_value"], 35.0)

    def test_reconcile_pick_query_rejects_corrupted_dataset(self):
        """Verify that invalid payload returns 422 with structured error envelope."""
        bad_request = {
            "invalid_payload": True,
        }

        response = self.client.post("/api/v1/queries/reconcile-pick", json=bad_request)
        self.assertEqual(response.status_code, 422)
        err = response.json()
        self.assertIn("error", err)
        self.assertEqual(err["error"]["code"], "VALIDATION_SCHEMA_VIOLATION")


if __name__ == "__main__":
    unittest.main()
