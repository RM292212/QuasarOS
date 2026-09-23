import sys
import os
from pathlib import Path
import json

# Add packages/services/src to sys.path to import app
sys.path.insert(0, str(Path("packages/services/src").resolve()))
sys.path.insert(0, str(Path("packages/contracts/src").resolve()))
sys.path.insert(0, str(Path("packages/runtime/src").resolve()))

from fastapi.testclient import TestClient
from quasar_services.app import app

client = TestClient(app)

reports_dir = Path("reports/program-closeout/evidence")
reports_dir.mkdir(parents=True, exist_ok=True)
evidence_file = reports_dir / "backend_live_api_evidence.json"

evidence = []

def run_test(name, func):
    print(f"Running {name}...")
    try:
        res = func()
        evidence.append({"test": name, "status": "pass", "details": res})
        print(f"  -> PASS")
    except Exception as e:
        evidence.append({"test": name, "status": "fail", "error": str(e)})
        print(f"  -> FAIL: {e}")

def test_health_live():
    response = client.get("/health/live")
    assert response.status_code == 200
    return response.json()

def test_health_ready():
    response = client.get("/health/ready")
    assert response.status_code == 200
    return response.json()

def test_timeseries():
    response = client.post("/api/v1/analysis/timeseries", json={
        "variable": "thetao",
        "latitude": 0.0,
        "longitude": 0.0,
        "depth_m": 10.0
    })
    assert response.status_code == 200
    return response.json()

def test_profile():
    response = client.post("/api/v1/analysis/profile", json={
        "variable": "thetao",
        "time_index": 0,
        "latitude": 0.0,
        "longitude": 0.0
    })
    assert response.status_code == 200
    return response.json()

def test_transect():
    response = client.post("/api/v1/analysis/transect", json={
        "variable": "thetao",
        "time_index": 0,
        "start_latitude": 0.0,
        "start_longitude": 0.0,
        "end_latitude": 10.0,
        "end_longitude": 10.0,
        "num_samples": 10
    })
    assert response.status_code == 200
    return response.json()

def test_slice():
    response = client.post("/api/v1/analysis/slice", json={
        "variable": "thetao",
        "time_index": 0,
        "depth_m": 0.494
    })
    assert response.status_code == 200
    return response.json()

def test_teos10():
    response = client.post("/api/v1/analysis/teos10-soundings", json={
        "time_index": 0,
        "latitude": 0.0,
        "longitude": 0.0
    })
    assert response.status_code == 200
    return response.json()

run_test("health_live", test_health_live)
run_test("health_ready", test_health_ready)
run_test("timeseries", test_timeseries)
run_test("profile", test_profile)
run_test("transect", test_transect)
run_test("slice", test_slice)
run_test("teos10_soundings", test_teos10)

with open(evidence_file, "w") as f:
    json.dump(evidence, f, indent=2)

print(f"Evidence written to {evidence_file}")
