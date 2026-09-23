import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
package_sources = [
    REPO_ROOT / "packages" / "contracts" / "src",
    REPO_ROOT / "packages" / "services" / "src",
    REPO_ROOT / "packages" / "ingestion" / "src",
    REPO_ROOT / "packages" / "runtime" / "src",
]

for src_path in package_sources:
    if src_path.exists() and str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))
