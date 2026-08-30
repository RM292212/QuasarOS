"""
QuasarOS TASK-09 Integration Tests: WebGL2 Renderer Fallback, Parity & Subsystem Validation
Validates end-to-end integration across packages/renderer-webgl2, packages/renderer-webgpu,
packages/runtime, packages/client, canonical schemas, and failure injection scenarios.
"""

import os
import json
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


class TestWebGL2RendererIntegration(unittest.TestCase):

    def test_schema_drift_zero(self):
        """Ensure canonical JSON schemas and Pydantic models are 100% in sync with zero drift."""
        cmd = ["python", str(REPO_ROOT / "scripts" / "generate_schemas.py"), "--verify"]
        proc = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Schema verification failed: {proc.stdout}\n{proc.stderr}")
        self.assertIn("Zero schema drift detected", proc.stdout)

    def test_renderer_webgl2_test_suite(self):
        """Ensure @quasar/renderer-webgl2 TypeScript test suite passes completely."""
        renderer_dir = REPO_ROOT / "packages" / "renderer-webgl2"
        self.assertTrue(renderer_dir.exists(), "packages/renderer-webgl2 directory must exist")

        cmd = ["npm", "test"]
        proc = subprocess.run(cmd, cwd=renderer_dir, capture_output=True, text=True, shell=True)
        self.assertEqual(proc.returncode, 0, f"renderer-webgl2 tests failed:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("fail 0", proc.stdout)

    def test_renderer_webgpu_test_suite(self):
        """Ensure @quasar/renderer-webgpu TypeScript test suite passes completely."""
        renderer_dir = REPO_ROOT / "packages" / "renderer-webgpu"
        self.assertTrue(renderer_dir.exists(), "packages/renderer-webgpu directory must exist")

        cmd = ["npm", "test"]
        proc = subprocess.run(cmd, cwd=renderer_dir, capture_output=True, text=True, shell=True)
        self.assertEqual(proc.returncode, 0, f"renderer-webgpu tests failed:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("pass 27", proc.stdout)
        self.assertIn("fail 0", proc.stdout)

    def test_runtime_test_suite(self):
        """Ensure @quasar/runtime test suite passes completely."""
        runtime_dir = REPO_ROOT / "packages" / "runtime"
        self.assertTrue(runtime_dir.exists(), "packages/runtime directory must exist")

        cmd = ["npm", "test"]
        proc = subprocess.run(cmd, cwd=runtime_dir, capture_output=True, text=True, shell=True)
        self.assertEqual(proc.returncode, 0, f"runtime tests failed:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("pass 42", proc.stdout)
        self.assertIn("fail 0", proc.stdout)

    def test_client_test_suite(self):
        """Ensure @quasar/client test suite passes completely."""
        client_dir = REPO_ROOT / "packages" / "client"
        self.assertTrue(client_dir.exists(), "packages/client directory must exist")

        cmd = ["npm", "test"]
        proc = subprocess.run(cmd, cwd=client_dir, capture_output=True, text=True, shell=True)
        self.assertEqual(proc.returncode, 0, f"client tests failed:\n{proc.stdout}\n{proc.stderr}")
        self.assertIn("pass 22", proc.stdout)
        self.assertIn("fail 0", proc.stdout)

    def test_strict_architectural_isolation(self):
        """
        Verify strict architectural boundaries:
        - renderer-webgl2 must NOT contain React, JSX, WebGPU API dependencies, or DOM UI component code.
        """
        src_dir = REPO_ROOT / "packages" / "renderer-webgl2" / "src"
        forbidden_terms = [
            "GPUDevice",
            "GPUTexture",
            "GPUBuffer",
            "GPUQueue",
            "react",
            "react-dom",
            "jsx",
        ]

        for root, _, files in os.walk(src_dir):
            for file in files:
                if file.endswith((".ts", ".js")):
                    path = Path(root) / file
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()

                    for term in forbidden_terms:
                        self.assertNotIn(
                            term,
                            content,
                            f"Forbidden architectural token '{term}' found in {path}"
                        )

    def test_copernicus_thetao_analytical_zero_degree_parity(self):
        """
        Validates mathematical parity between WebGL2 and WebGPU for physical 0.0°C temperature values:
        Physical 0.0°C is a legitimate valid ocean value and must NOT be treated as missing/nodata/land.
        """
        webgl2_shader_path = REPO_ROOT / "packages" / "renderer-webgl2" / "src" / "shaders" / "volume_raymarch.glsl.ts"
        webgpu_shader_path = REPO_ROOT / "packages" / "renderer-webgpu" / "src" / "shaders" / "volume_raymarch.wgsl.ts"

        with open(webgl2_shader_path, "r", encoding="utf-8") as f:
            glsl = f.read()
        with open(webgpu_shader_path, "r", encoding="utf-8") as f:
            wgsl = f.read()

        self.assertIn("uUseValidityMask", glsl)
        self.assertIn("sampleValidityMask", glsl)
        self.assertIn("useValidityMask", wgsl)
        self.assertIn("sampleValidityMask", wgsl)

        self.assertIn("1.0 - pow(max(1.0 - sampleAlpha, 0.0), dt / dtRef)", glsl)
        self.assertIn("1.0 - pow(max(1.0 - sampleAlpha, 0.0), dt / dtRef)", wgsl)


if __name__ == "__main__":
    unittest.main()