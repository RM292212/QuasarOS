#!/usr/bin/env python3
"""
QuasarOS OpenAPI 3.1 Specification Exporter.

Exports openapi_v1.json from the live FastAPI application to schemas/openapi/openapi_v1.json.
"""

import json
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
SERVICES_SRC = REPO_ROOT / "packages" / "services" / "src"

if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))
if str(SERVICES_SRC) not in sys.path:
    sys.path.insert(0, str(SERVICES_SRC))

from quasar_services.app import app


def export_openapi() -> Path:
    out_dir = REPO_ROOT / "schemas" / "openapi"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "openapi_v1.json"

    openapi_schema = app.openapi()
    out_file.write_text(json.dumps(openapi_schema, indent=2), encoding="utf-8")
    print(f"[+] Exported OpenAPI 3.1 schema to {out_file}")
    print(f"[+] Total routes registered: {len(openapi_schema.get('paths', {}))}")
    return out_file


if __name__ == "__main__":
    export_openapi()
