"""
QuasarOS Quality Control (QC) Base Contracts

Defines formal QC normalization across WMO Argo, IOOS QARTOD, and GEBCO TID schemes,
preserving raw provider flags while exposing normalized states.
"""

from enum import Enum
from typing import Dict, List
from pydantic import BaseModel, Field


class QCScheme(str, Enum):
    """Quality control standard taxonomy."""
    wmo_argo = "wmo_argo"        # WMO Argo profiling float standard flags (1-9)
    ioos_qartod = "ioos_qartod"  # IOOS QARTOD real-time QA/QC flags (1-9)
    gebco_tid = "gebco_tid"      # GEBCO Type Identifier measurement lineage codes (0-100)
    custom = "custom"            # Custom dataset QC flags


class NormalizedQCState(str, Enum):
    """Canonical normalized QC category."""
    good = "good"                      # Certified good / passed quality checks
    probably_good = "probably_good"    # Probably good / minor caution
    suspect = "suspect"                # Suspect / warning
    bad = "bad"                        # Failed / bad measurement
    missing = "missing"                # Value not present or unobserved
    not_evaluated = "not_evaluated"    # Not evaluated / raw unchecked data


class QCFlagDefinition(BaseModel):
    """Individual QC flag mapping rule."""
    flag_value: int = Field(
        ...,
        description="Raw integer flag value in source file."
    )
    meaning: str = Field(
        ...,
        description="Human-readable description according to governing standard."
    )
    normalized_state: NormalizedQCState = Field(
        ...,
        description="Canonical normalized QC classification."
    )
    accepted_for_analysis: bool = Field(
        ...,
        description="Whether this flag is admitted for scientific calculations by default."
    )


class QualityControlContract(BaseModel):
    """Authoritative quality control scheme contract."""
    scheme: QCScheme = Field(
        ...,
        description="QC standard governing the flags."
    )
    description: str = Field(
        ...,
        description="Detailed description of the QC scheme and application rules."
    )
    flag_mappings: List[QCFlagDefinition] = Field(
        ...,
        description="Complete list of flag mappings from raw integers to normalized states."
    )
    default_accepted_states: List[NormalizedQCState] = Field(
        default=[NormalizedQCState.good, NormalizedQCState.probably_good],
        description="Normalized states accepted by default in scientific comparison."
    )

    def normalize_flag(self, flag: int) -> NormalizedQCState:
        """Map raw integer flag to canonical normalized QC state."""
        for m in self.flag_mappings:
            if m.flag_value == flag:
                return m.normalized_state
        return NormalizedQCState.not_evaluated

    def is_accepted(self, flag: int) -> bool:
        """Evaluate if raw integer flag is acceptable under default policy."""
        state = self.normalize_flag(flag)
        return state in self.default_accepted_states


# Predefined standard contracts
WMO_ARGO_QC_SCHEME = QualityControlContract(
    scheme=QCScheme.wmo_argo,
    description="WMO Argo Quality Control Manual for Real-Time and Delayed-Mode Data",
    flag_mappings=[
        QCFlagDefinition(flag_value=1, meaning="Good data", normalized_state=NormalizedQCState.good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=2, meaning="Probably good data", normalized_state=NormalizedQCState.probably_good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=3, meaning="Bad data that are potentially correctable", normalized_state=NormalizedQCState.suspect, accepted_for_analysis=False),
        QCFlagDefinition(flag_value=4, meaning="Bad data", normalized_state=NormalizedQCState.bad, accepted_for_analysis=False),
        QCFlagDefinition(flag_value=5, meaning="Value changed", normalized_state=NormalizedQCState.probably_good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=8, meaning="Estimated value", normalized_state=NormalizedQCState.suspect, accepted_for_analysis=False),
        QCFlagDefinition(flag_value=9, meaning="Missing value", normalized_state=NormalizedQCState.missing, accepted_for_analysis=False),
    ]
)

IOOS_QARTOD_QC_SCHEME = QualityControlContract(
    scheme=QCScheme.ioos_qartod,
    description="US IOOS QARTOD Manual for Real-Time Quality Control of Oceanographic Observations",
    flag_mappings=[
        QCFlagDefinition(flag_value=1, meaning="Pass", normalized_state=NormalizedQCState.good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=2, meaning="Not Evaluated", normalized_state=NormalizedQCState.not_evaluated, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=3, meaning="Suspect or High Interest", normalized_state=NormalizedQCState.suspect, accepted_for_analysis=False),
        QCFlagDefinition(flag_value=4, meaning="Fail", normalized_state=NormalizedQCState.bad, accepted_for_analysis=False),
        QCFlagDefinition(flag_value=9, meaning="Missing Data", normalized_state=NormalizedQCState.missing, accepted_for_analysis=False),
    ]
)

GEBCO_TID_QC_SCHEME = QualityControlContract(
    scheme=QCScheme.gebco_tid,
    description="GEBCO Type Identifier (TID) Measurement Lineage Scheme",
    flag_mappings=[
        QCFlagDefinition(flag_value=0, meaning="Direct measurement: multibeam", normalized_state=NormalizedQCState.good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=10, meaning="Direct measurement: singlebeam", normalized_state=NormalizedQCState.good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=20, meaning="Direct measurement: sounding lines", normalized_state=NormalizedQCState.probably_good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=30, meaning="Direct measurement: ENC sounding", normalized_state=NormalizedQCState.probably_good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=40, meaning="Indirect measurement: satellite altimetry derived", normalized_state=NormalizedQCState.probably_good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=50, meaning="Interpolated based on pre-existing grid", normalized_state=NormalizedQCState.probably_good, accepted_for_analysis=True),
        QCFlagDefinition(flag_value=60, meaning="Interpolation: computer algorithm", normalized_state=NormalizedQCState.probably_good, accepted_for_analysis=True),
    ]
)
