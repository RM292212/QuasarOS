"""
Quasar Contracts Package Root
"""
import sys
from pathlib import Path

# Ensure src/ is on sys.path for direct imports
_src_dir = str(Path(__file__).resolve().parent / "src")
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from quasar_contracts import *
