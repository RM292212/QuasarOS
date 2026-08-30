"""
tests/test_brick_transport.py — Unit & Integration Test Suite for TASK-05T.

Verifies:
1. Successful GET requests for Float16 (f16) and Uint16 (u16) binary brick payloads (.bin.zst).
2. Exact byte length, Content-Type, Cache-Control, ETag, and X-Payload-SHA256 headers matching the visualization manifest.
3. HTTP 304 Not Modified behavior on If-None-Match conditional requests.
4. Correct 400 Bad Request error handling on invalid representations (e.g. 'raw', 'f32', 'invalid').
5. Correct 404 Not Found error handling on non-existent visualization products and brick keys.
6. Path traversal rejection with 400 Bad Request across multiple injection vectors (.., slashes, backslashes).
7. Absolute security: zero host filesystem path leakage in error payloads and headers.
"""

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

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))

from quasar_services.app import app
from quasar_services.catalog import CatalogService
from quasar_services.catalog.errors import (
    BrickNotFoundException,
    BrickPayloadNotFoundException,
    InvalidRepresentationException,
    SecurityValidationException,
    VisualizationProductNotFoundException,
)


class TestBrickTransport(unittest.TestCase):
    """Visualization Brick Binary Payload Transport Test Suite."""

    @classmethod
    def setUpClass(cls):
        cls.catalog = CatalogService(repo_root=REPO_ROOT)
        cls.client = TestClient(app)
        cls.product_id = "vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087"

        # Load visualization manifest to fetch authoritative sample bricks
        vis_manifest_path = (
            REPO_ROOT
            / "data"
            / "manifests"
            / "visualization"
            / "copernicus_phy_thetao"
            / "copernicus-phy-thetao-20260824-20260830-ca826087"
            / "v1"
            / "visualization_manifest.json"
        )
        with open(vis_manifest_path, "r", encoding="utf-8") as f:
            cls.manifest_data = json.load(f)

        cls.sample_bricks = cls.manifest_data.get("bricks", [])[:5]

    # =========================================================================
    # 1. Successful Binary Payload Retrieval & Header Conformance
    # =========================================================================
    def test_get_f16_brick_payload_success(self):
        """Verify successful retrieval of Float16 (f16) binary brick payload."""
        sample = self.sample_bricks[0]
        brick_key = sample["brick_key"]
        expected_meta = sample["payload_f16"]

        url = f"/api/v1/visualization-products/{self.product_id}/bricks/{brick_key}/payloads/f16"
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/octet-stream")
        self.assertEqual(res.headers.get("cache-control"), "public, max-age=31536000, immutable")
        self.assertEqual(res.headers.get("accept-ranges"), "bytes")

        # Verify ETag and SHA-256
        expected_sha = expected_meta["sha256_checksum"]
        self.assertEqual(res.headers.get("x-payload-sha256"), expected_sha)
        self.assertEqual(res.headers.get("etag"), f'"{expected_sha}"')

        # Verify payload length and decompressed length headers
        self.assertEqual(
            int(res.headers.get("x-payload-compressed-bytes")),
            expected_meta["compressed_bytes_length"],
        )
        self.assertEqual(
            int(res.headers.get("x-payload-uncompressed-bytes")),
            expected_meta["uncompressed_bytes_length"],
        )

        # Verify exact bytes payload on wire
        payload_bytes = res.content
        self.assertEqual(len(payload_bytes), expected_meta["compressed_bytes_length"])

        # Cryptographic check on actual response body
        computed_sha = hashlib.sha256(payload_bytes).hexdigest()
        self.assertEqual(computed_sha, expected_sha)

    def test_get_u16_brick_payload_success(self):
        """Verify successful retrieval of Uint16 (u16) binary brick payload."""
        sample = self.sample_bricks[0]
        brick_key = sample["brick_key"]
        expected_meta = sample["payload_u16"]

        url = f"/api/v1/visualization-products/{self.product_id}/bricks/{brick_key}/payloads/u16"
        res = self.client.get(url)

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/octet-stream")
        self.assertEqual(res.headers.get("cache-control"), "public, max-age=31536000, immutable")
        self.assertEqual(res.headers.get("accept-ranges"), "bytes")

        expected_sha = expected_meta["sha256_checksum"]
        self.assertEqual(res.headers.get("x-payload-sha256"), expected_sha)
        self.assertEqual(res.headers.get("etag"), f'"{expected_sha}"')

        self.assertEqual(
            int(res.headers.get("x-payload-compressed-bytes")),
            expected_meta["compressed_bytes_length"],
        )
        self.assertEqual(
            int(res.headers.get("x-payload-uncompressed-bytes")),
            expected_meta["uncompressed_bytes_length"],
        )

        payload_bytes = res.content
        self.assertEqual(len(payload_bytes), expected_meta["compressed_bytes_length"])
        computed_sha = hashlib.sha256(payload_bytes).hexdigest()
        self.assertEqual(computed_sha, expected_sha)

    def test_multiple_lod_and_timestep_bricks(self):
        """Verify retrieval across multiple LODs and timesteps in the product."""
        for sample in self.sample_bricks:
            brick_key = sample["brick_key"]
            for rep in ("f16", "u16"):
                url = f"/api/v1/visualization-products/{self.product_id}/bricks/{brick_key}/payloads/{rep}"
                res = self.client.get(url)
                self.assertEqual(res.status_code, 200)
                expected_sha = sample[f"payload_{rep}"]["sha256_checksum"]
                self.assertEqual(res.headers.get("x-payload-sha256"), expected_sha)

    # =========================================================================
    # 2. Conditional Requests & Caching (ETag / If-None-Match)
    # =========================================================================
    def test_if_none_match_conditional_304(self):
        """Verify conditional If-None-Match returning 304 Not Modified."""
        sample = self.sample_bricks[0]
        brick_key = sample["brick_key"]
        expected_sha = sample["payload_f16"]["sha256_checksum"]
        etag = f'"{expected_sha}"'

        url = f"/api/v1/visualization-products/{self.product_id}/bricks/{brick_key}/payloads/f16"

        # 1. Matching quoted ETag
        res_304 = self.client.get(url, headers={"If-None-Match": etag})
        self.assertEqual(res_304.status_code, 304)
        self.assertEqual(len(res_304.content), 0)
        self.assertEqual(res_304.headers.get("etag"), etag)
        self.assertEqual(res_304.headers.get("cache-control"), "public, max-age=31536000, immutable")

        # 2. Matching unquoted SHA
        res_304_unquoted = self.client.get(url, headers={"If-None-Match": expected_sha})
        self.assertEqual(res_304_unquoted.status_code, 304)

        # 3. Wildcard *
        res_304_star = self.client.get(url, headers={"If-None-Match": "*"})
        self.assertEqual(res_304_star.status_code, 304)

        # 4. Non-matching ETag -> returns full 200 payload
        res_200 = self.client.get(url, headers={"If-None-Match": '"different-hash"'})
        self.assertEqual(res_200.status_code, 200)
        self.assertEqual(len(res_200.content), sample["payload_f16"]["compressed_bytes_length"])

    # =========================================================================
    # 3. Error Handling & Validation
    # =========================================================================
    def test_invalid_representation_rejection(self):
        """Verify that invalid representations are rejected with 400 Bad Request."""
        sample = self.sample_bricks[0]
        brick_key = sample["brick_key"]

        invalid_reps = ["f32", "u8", "raw", "zstd", "invalid", "123"]
        for rep in invalid_reps:
            url = f"/api/v1/visualization-products/{self.product_id}/bricks/{brick_key}/payloads/{rep}"
            res = self.client.get(url)
            self.assertEqual(res.status_code, 400)
            data = res.json()
            self.assertIn("error", data)
            self.assertEqual(data["error"]["code"], "RENDER_INVALID_REPRESENTATION")
            self.assertIn("representation", data["error"]["details"])

    def test_nonexistent_product_id(self):
        """Verify that non-existent product_id returns 404 with structured error."""
        sample = self.sample_bricks[0]
        brick_key = sample["brick_key"]

        url = f"/api/v1/visualization-products/vis_nonexistent_product_123/bricks/{brick_key}/payloads/f16"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertEqual(data["error"]["code"], "RENDER_PRODUCT_NOT_FOUND")

    def test_nonexistent_brick_key(self):
        """Verify that non-existent brick_key returns 404 with structured error."""
        fake_brick_key = "vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087:v1:lod99:t99:bx99:by99:bz99:sea_water_potential_temperature"
        url = f"/api/v1/visualization-products/{self.product_id}/bricks/{fake_brick_key}/payloads/f16"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertEqual(data["error"]["code"], "RENDER_BRICK_NOT_FOUND")

    # =========================================================================
    # 4. Security & Path Traversal Guardrails
    # =========================================================================
    def test_path_traversal_attempts_rejected(self):
        """Verify malicious path traversal injections are safely blocked without path leakage."""
        traversal_keys = [
            "../../../../etc/passwd",
            "..\\..\\..\\windows\\win.ini",
            "lod0/t0/b_0_0_0_f16.bin.zst",
            "%2e%2e%2f%2e%2e%2f",
            "brick..key",
        ]

        for bad_key in traversal_keys:
            url = f"/api/v1/visualization-products/{self.product_id}/bricks/{bad_key}/payloads/f16"
            res = self.client.get(url)
            self.assertIn(res.status_code, (400, 404))

            # Inspect error payload for zero absolute filesystem path leakage
            raw_text = res.text
            self.assertNotIn("C:\\", raw_text)
            self.assertNotIn("C:/", raw_text)
            self.assertNotIn("/Users/", raw_text)
            self.assertNotIn("/home/", raw_text)

    def test_zero_filesystem_path_leakage_in_error_detail(self):
        """Verify error models never expose internal directory structures."""
        url = f"/api/v1/visualization-products/{self.product_id}/bricks/nonexistent_key/payloads/f16"
        res = self.client.get(url)
        self.assertEqual(res.status_code, 404)

        error_json = res.json()
        self.assertIn("error", error_json)
        self.assertIn("requestId", error_json["error"])
        # Check details does not contain any absolute file paths
        details_str = json.dumps(error_json["error"]["details"])
        self.assertNotIn("C:", details_str)
        self.assertNotIn("\\Users\\", details_str)


if __name__ == "__main__":
    unittest.main()
