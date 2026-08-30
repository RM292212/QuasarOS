import unittest
from fastapi.testclient import TestClient
from quasar_services.app import app

class TestAnalysisRouterExtensions(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_transect_endpoint(self):
        payload = {
            "variable": "thetao",
            "time_index": 0,
            "start_latitude": 5.0,
            "start_longitude": 60.0,
            "end_latitude": 10.0,
            "end_longitude": 65.0,
            "num_samples": 5
        }
        res = self.client.post("/api/v1/analysis/transect", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["num_samples"], 5)
        self.assertEqual(len(data["samples"]), 5)
        self.assertEqual(data["authority"], "authoritative native-source value under ADR-0005")

    def test_slice_endpoint(self):
        payload = {
            "variable": "thetao",
            "time_index": 0,
            "depth_m": 0.494
        }
        res = self.client.post("/api/v1/analysis/slice", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["variable"], "thetao")

if __name__ == "__main__":
    unittest.main()
