#!/usr/bin/env python3
"""
QuasarOS Deterministic JSON Schema & Consumer Type Generation Tool

Usage:
    python scripts/generate_schemas.py --export
    python scripts/generate_schemas.py --verify
"""

import sys
import argparse
from pathlib import Path

# Ensure quasar_contracts can be imported
REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACTS_SRC = REPO_ROOT / "packages" / "contracts" / "src"
if str(CONTRACTS_SRC) not in sys.path:
    sys.path.insert(0, str(CONTRACTS_SRC))

from quasar_contracts.export import (
    export_schemas_to_directory,
    verify_schemas_in_directory,
    generate_typescript_declarations,
)


def main():
    parser = argparse.ArgumentParser(description="QuasarOS Schema Generation & Drift Verification CLI")
    parser.add_argument("--export", action="store_true", help="Generate all JSON Schemas and TypeScript definitions")
    parser.add_argument("--verify", action="store_true", help="Verify that disk schemas have zero drift from Pydantic models")
    args = parser.parse_args()

    canonical_schema_dir = REPO_ROOT / "schemas" / "canonical"
    contracts_schema_dir = REPO_ROOT / "packages" / "contracts" / "schemas"
    ts_output_file = REPO_ROOT / "packages" / "contracts" / "types" / "quasar_contracts.d.ts"

    if args.verify:
        print(f"[*] Verifying JSON Schemas against Pydantic models in {canonical_schema_dir}...")
        ok_canonical, drift_canonical = verify_schemas_in_directory(canonical_schema_dir)
        ok_contracts, drift_contracts = verify_schemas_in_directory(contracts_schema_dir)

        if not ok_canonical or not ok_contracts:
            print("[!] SCHEMA DRIFT DETECTED:")
            for msg in drift_canonical + drift_contracts:
                print(f"    - {msg}")
            print("\n[!] Please run 'python scripts/generate_schemas.py --export' to sync schema definitions.")
            sys.exit(1)
        else:
            print("[+] Zero schema drift detected. All schemas are 100% synchronized with Pydantic contracts.")
            sys.exit(0)

    # Default or explicit --export
    print(f"[*] Exporting JSON Schemas to {canonical_schema_dir} and {contracts_schema_dir}...")
    files1 = export_schemas_to_directory(canonical_schema_dir)
    files2 = export_schemas_to_directory(contracts_schema_dir)
    print(f"[+] Generated {len(files1)} JSON Schemas in schemas/canonical/")
    print(f"[+] Generated {len(files2)} JSON Schemas in packages/contracts/schemas/")

    print(f"[*] Generating TypeScript declarations in {ts_output_file}...")
    generate_typescript_declarations(ts_output_file)
    print(f"[+] Exported TypeScript contracts: {ts_output_file}")


if __name__ == "__main__":
    main()
