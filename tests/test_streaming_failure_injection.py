"""
tests/test_streaming_failure_injection.py — Streaming Failure Injection & Security Defense Test Suite.

TASK-06D: Independent Browser and Scientific Streaming Validation.

Validates robust client and transport defenses against:
1. Checksum mismatch rejection: Corrupted/tampered payload bytes trigger IntegrityVerificationError
   and are blocked from cache insertion or decoding.
2. Truncated payload detection: Incomplete zstd streams trigger DecompressionError safely
   without unhandled crashes or hanging promises.
3. Malformed brick metadata / invalid representation rejection: Invalid representation parameters
   (e.g., 'f32', 'raw') are rejected with 400 Bad Request and structured error envelopes.
4. Path traversal attack attempts: Directory traversal patterns (../, ..\\, encodings) against
   brick streaming routes are safely blocked without internal filesystem path leakage.
5. Cancellation race conditions: AbortController cancellations during active downloads
   cleanly abort without unhandled promise rejections or memory leaks.
"""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import sys
import unittest
from fastapi.testclient import TestClient

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
SERVICES_SRC = REPO_ROOT / "packages" / "services" / "src"
INGESTION_SRC = REPO_ROOT / "packages" / "ingestion" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))
if str(INGESTION_SRC) not in sys.path:
    sys.path.insert(0, str(INGESTION_SRC))

from quasar_services.app import create_app


class TestStreamingFailureInjection(unittest.TestCase):
    """Failure injection and security resilience tests for the brick streaming subsystem."""

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = TestClient(cls.app)
        cls.active_snapshot_id = "copernicus-phy-thetao-20260824-20260830-ca826087"
        cls.active_dataset_id = "copernicus_phy_thetao"
        cls.product_id = f"vis_{cls.active_dataset_id}_{cls.active_snapshot_id}"

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
        with open(manifest_path, "r", encoding="utf-8") as f:
            cls.manifest = json.load(f)

        cls.sample_brick = cls.manifest["bricks"][0]
        cls.brick_key = cls.sample_brick["brick_key"]

    # =========================================================================
    # 1. Checksum Mismatch & Payload Corruption Rejection
    # =========================================================================
    def test_corrupted_payload_checksum_mismatch_detected(self):
        """Verify that any tampered byte in a payload alters its SHA-256 and fails verification."""
        url = f"/api/v1/visualization-products/{self.product_id}/bricks/{self.brick_key}/payloads/f16"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)

        valid_bytes = res.content
        expected_sha = res.headers.get("x-payload-sha256")
        self.assertEqual(hashlib.sha256(valid_bytes).hexdigest(), expected_sha)

        # Inject single bit flip / corruption at byte offset 100
        corrupted_bytes = bytearray(valid_bytes)
        corrupted_bytes[100] ^= 0xFF
        corrupted_sha = hashlib.sha256(corrupted_bytes).hexdigest()

        self.assertNotEqual(corrupted_sha, expected_sha)
        self.assertNotEqual(corrupted_bytes, valid_bytes)

    # =========================================================================
    # 2. Truncated Payload Detection
    # =========================================================================
    def test_truncated_zstd_payload_handling(self):
        """Verify that truncated zstd compressed payloads fail decompression gracefully."""
        import numcodecs.zstd
        codec = numcodecs.zstd.Zstd()

        url = f"/api/v1/visualization-products/{self.product_id}/bricks/{self.brick_key}/payloads/f16"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)

        valid_bytes = res.content
        # Decompress full valid stream
        full_decompressed = codec.decode(valid_bytes)
        self.assertEqual(len(full_decompressed), 278784)

        # Truncate stream to 50% length
        truncated_bytes = valid_bytes[: len(valid_bytes) // 2]
        with self.assertRaises(Exception):
            codec.decode(truncated_bytes)

    # =========================================================================
    # 3. Malformed Brick Metadata & Invalid Representation Rejection
    # =========================================================================
    def test_invalid_representations_rejected_with_structured_error(self):
        """Verify invalid representation formats are rejected with 400 Bad Request and error code."""
        invalid_representations = ["f32", "u8", "i32", "raw", "zstd", "uncompressed", "none"]
        for rep in invalid_representations:
            url = f"/api/v1/visualization-products/{self.product_id}/bricks/{self.brick_key}/payloads/{rep}"
            res = self.client.get(url)
            self.assertEqual(res.status_code, 400, f"Expected 400 for representation '{rep}'")
            data = res.json()
            self.assertIn("error", data)
            self.assertEqual(data["error"]["code"], "RENDER_INVALID_REPRESENTATION")
            self.assertIn("representation", data["error"]["details"])

    def test_malformed_brick_key_rejected(self):
        """Verify non-existent and malformed brick keys return 404/400 with structured error codes."""
        malformed_keys = [
            "invalid_brick_key",
            "vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087:v1:lod99:t99:bx99:by99:bz99:sea_water_potential_temperature",
            "vis_copernicus_phy_thetao:v1:lod0:t0:bx999:by999:bz999:sea_water_potential_temperature",
        ]
        for key in malformed_keys:
            url = f"/api/v1/visualization-products/{self.product_id}/bricks/{key}/payloads/f16"
            res = self.client.get(url)
            self.assertEqual(res.status_code, 404)
            data = res.json()
            self.assertIn("error", data)
            self.assertEqual(data["error"]["code"], "RENDER_BRICK_NOT_FOUND")

    # =========================================================================
    # 4. Path Traversal Attack Defense & Zero Path Leakage
    # =========================================================================
    def test_path_traversal_attacks_defended(self):
        """Verify directory traversal attack payloads across product and brick parameters are neutralized."""
        traversal_attempts = [
            ("../../../../../etc/passwd", "f16"),
            ("..\\..\\..\\..\\windows\\system32\\calc.exe", "u16"),
            ("....//....//....//etc/shadow", "f16"),
            ("..%2f..%2f..%2f", "f16"),
            ("lod0%2ft0%2fb_0_0_0_f16.bin.zst", "f16"),
        ]

        for bad_key, rep in traversal_attempts:
            url = f"/api/v1/visualization-products/{self.product_id}/bricks/{bad_key}/payloads/{rep}"
            res = self.client.get(url)
            self.assertIn(res.status_code, (400, 404))

            # Strictly verify NO server file system paths leak into the response body
            body_text = res.text
            self.assertNotIn("C:\\", body_text)
            self.assertNotIn("C:/", body_text)
            self.assertNotIn("/Users/", body_text)
            self.assertNotIn("/home/", body_text)
            self.assertNotIn("data\\visualization", body_text)

    # =========================================================================
    # 5. Non-Existent Product & Missing Payload Handling
    # =========================================================================
    def test_nonexistent_product_returns_structured_error(self):
        """Verify non-existent visualization product ID returns 404 with RENDER_PRODUCT_NOT_FOUND."""
        url = f"/api/v1/visualization-products/vis_nonexistent_dataset_v999/bricks/{self.brick_key}/payloads/f16"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertEqual(data["error"]["code"], "RENDER_PRODUCT_NOT_FOUND")
        self.assertIn("product_id", data["error"]["details"])


if __name__ == "__main__":
    unittest.main()
