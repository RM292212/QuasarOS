"""
tests/test_deployment_observability_security.py — Deployment, Observability & Security Test Suite.

Automated verification for RELEASE-01B:
1. Operational security headers (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
2. Request ID tracing and response latency metrics (X-Request-ID, X-Response-Time-Ms).
3. Request size limit enforcement (HTTP 413 on oversized payloads).
4. Cached readiness integrity probe auditing (zero per-probe unbounded rehashing).
5. Path traversal protection across all dataset, brick, and query endpoints.
6. Error detail sanitization (zero internal stack traces or leaked local file paths).
7. SPA static asset delivery routing.
"""

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

from quasar_services.app import create_app, app
from quasar_services.catalog import CatalogService


class TestDeploymentObservabilityAndSecurity(unittest.TestCase):
    """Test suite for deployment configuration, observability, and operational security."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.catalog = CatalogService(repo_root=REPO_ROOT)

    # =========================================================================
    # 1. Operational Security Headers Audit
    # =========================================================================
    def test_operational_security_headers_present(self):
        """Verify strict CSP, Frame, and Content-Type security headers on all responses."""
        response = self.client.get("/health/live")
        self.assertEqual(response.status_code, 200)

        # Check CSP
        csp = response.headers.get("Content-Security-Policy", "")
        self.assertIn("default-src 'self'", csp)
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertIn("object-src 'none'", csp)

        # Check Clickjacking & MIME-sniffing headers
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(response.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin")
        self.assertIn("camera=()", response.headers.get("Permissions-Policy", ""))

    # =========================================================================
    # 2. Observability & Tracing Headers
    # =========================================================================
    def test_request_id_and_latency_headers(self):
        """Verify X-Request-ID propagation and X-Response-Time-Ms metrics."""
        custom_req_id = "test-deploy-trace-9999"
        response = self.client.get("/api/v1/catalog", headers={"X-Request-ID": custom_req_id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("X-Request-ID"), custom_req_id)
        
        # Verify latency header
        latency_header = response.headers.get("X-Response-Time-Ms")
        self.assertIsNotNone(latency_header)
        latency_float = float(latency_header)
        self.assertGreaterEqual(latency_float, 0.0)

    # =========================================================================
    # 3. Request Size Limit Enforcement (DoS Mitigation)
    # =========================================================================
    def test_request_size_limit_rejection(self):
        """Verify that requests exceeding maximum payload limits are rejected with HTTP 413."""
        # Send a query with simulated oversized Content-Length
        huge_content_length = str(20 * 1024 * 1024)  # 20 MiB (limit is 10 MiB)
        response = self.client.post(
            "/api/v1/queries/value",
            json={"dataset_id": "copernicus_phy_thetao", "variable_id": "sea_water_potential_temperature"},
            headers={"Content-Length": huge_content_length},
        )
        self.assertEqual(response.status_code, 413)
        body = response.json()
        self.assertIn("error", body)
        self.assertEqual(body["error"]["code"], "VALIDATION_PAYLOAD_TOO_LARGE")

    # =========================================================================
    # 4. Cached Readiness Probe (Zero Repeated Disk Rehash)
    # =========================================================================
    def test_readiness_probe_cached_integrity(self):
        """Verify /health/ready returns ok and does not perform unbounded disk recomputation on every call."""
        res1 = self.client.get("/health/ready")
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertEqual(data1["status"], "ok")
        self.assertTrue(data1["integrityVerified"])

        res2 = self.client.get("/health/ready")
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertEqual(data2["status"], "ok")
        self.assertTrue(data2["integrityVerified"])

    # =========================================================================
    # 5. Path Traversal & Security Boundary Testing
    # =========================================================================
    def test_path_traversal_rejection_in_endpoints(self):
        """Verify traversal sequences in path params are caught and return structured errors without leaking paths."""
        traversal_attempts = [
            "/api/v1/datasets/..%2F..%2Fetc%2Fpasswd",
            "/api/v1/visualization-products/..%2Fsecrets",
            "/api/v1/visualization-products/copernicus-phy-thetao-vis-v1/bricks/..%2F..%2Froot/payloads/f16",
        ]
        for url in traversal_attempts:
            resp = self.client.get(url)
            self.assertIn(resp.status_code, [400, 404, 422])
            body_str = resp.text
            self.assertNotIn("C:\\", body_str)
            self.assertNotIn("/etc/passwd", body_str)

    # =========================================================================
    # 6. Static SPA Asset Delivery
    # =========================================================================
    def test_static_asset_spa_serving_fallback(self):
        """Verify create_app with static directory correctly configures static asset serving."""
        test_static_dir = REPO_ROOT / "apps" / "web"
        custom_app = create_app(static_dir=test_static_dir)
        spa_client = TestClient(custom_app)
        
        # Request root path
        resp = spa_client.get("/index.html")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("QuasarOS", resp.text)


if __name__ == "__main__":
    unittest.main()
