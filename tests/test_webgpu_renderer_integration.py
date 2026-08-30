"""
QuasarOS TASK-08 Integration Tests: WebGPU Renderer & Subsystems Integration
Validates end-to-end integration across packages/renderer-webgpu, packages/runtime,
packages/client, and canonical schemas.
"""

import os
import json
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

class TestWebGPURendererIntegration(unittest.TestCase):

    def test_schema_drift_zero(self):
        """Ensure canonical JSON schemas and Pydantic models are 100% in sync."""
        cmd = ["python", str(REPO_ROOT / "scripts" / "generate_schemas.py"), "--verify"]
        proc = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Schema verification failed: {proc.stdout}\n{proc.stderr}")
        self.assertIn("Zero schema drift detected", proc.stdout)

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
        """Verify strict isolation: renderer-webgpu contains zero WebGL or DOM dependencies."""
        src_dir = REPO_ROOT / "packages" / "renderer-webgpu" / "src"
        forbidden_terms = [
            "WebGLRenderingContext",
            "WebGL2RenderingContext",
            "gl.createShader",
            "gl.createProgram",
            "react",
            "document.createElement",
        ]
        
        for root, _, files in os.walk(src_dir):
            for file in files:
                if file.endswith((".ts", ".js")):
                    path = os.path.join(root, file)
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                        for term in forbidden_terms:
                            self.assertNotIn(
                                term,
                                content,
                                f"Forbidden token '{term}' found in {path}"
                            )

if __name__ == "__main__":
    unittest.main()
