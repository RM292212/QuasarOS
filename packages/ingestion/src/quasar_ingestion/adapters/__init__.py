"""
QuasarOS Data Ingestion Provider Adapters.
"""

from quasar_ingestion.adapters.copernicus_phy_adapter import (
    CopernicusPhysicalAdapter,
    ValidityMaskCode,
)

__all__ = [
    "CopernicusPhysicalAdapter",
    "ValidityMaskCode",
]
