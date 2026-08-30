"""
QuasarOS Observation-Level Quality Control Contracts (TASK-02D)

Extends the base QC schemes (WMO Argo, IOOS QARTOD) with typed models for
per-variable QC flag arrays, profile-level QC evaluation, position QC, time QC,
and QC summary metrics.
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from quasar_contracts.quality_control import (
    NormalizedQCState,
    QCScheme,
    WMO_ARGO_QC_SCHEME,
    IOOS_QARTOD_QC_SCHEME,
)


class ProfileQCGrade(str, Enum):
    """Overall profile quality grade (e.g. Argo profile-level flag 'A', 'B', 'C', 'D', 'E', 'F')."""
    A = "A"  # 100% of levels have good/probably-good QC (flags 1 or 2)
    B = "B"  # 75% - 99% of levels have good QC
    C = "C"  # 50% - 74% of levels have good QC
    D = "D"  # 25% - 49% of levels have good QC
    E = "E"  # > 0% and < 25% of levels have good QC
    F = "F"  # 0% good levels or no data
    NOT_RATED = "NOT_RATED"


class QCDerivationSource(str, Enum):
    """Source of the quality control flags and evaluation."""
    PROVIDER_SUPPLIED = "provider_supplied"
    LOCALLY_DERIVED_QUASAR = "locally_derived_quasar"


class VariableQCRecord(BaseModel):
    """
    Quality control record for a single variable along a vertical profile or trajectory segment.
    Stores raw integer QC flags, normalized QC states, and statistical summary.
    """
    variable_name: str = Field(
        ...,
        description="Canonical or source variable identifier (e.g. 'TEMP', 'PSAL', 'DOXY')."
    )
    qc_scheme: QCScheme = Field(
        default=QCScheme.wmo_argo,
        description="Governing QC scheme standard."
    )
    qc_derivation_source: QCDerivationSource = Field(
        default=QCDerivationSource.PROVIDER_SUPPLIED,
        description="Provenance of the QC flags: provider-supplied or locally derived by QuasarOS."
    )
    derivation_method_version: Optional[str] = Field(
        default=None,
        description="Version/identifier of the QC derivation pipeline or algorithm applied (e.g. 'Argo-QC-Manual-v3.4', 'Quasar-QARTOD-v1.0.0')."
    )
    profile_qc_flag: Optional[int] = Field(
        default=None,
        description="Profile-level aggregate QC flag for this specific variable (e.g. WMO Argo 1=good, 4=bad)."
    )
    level_qc_flags: List[int] = Field(
        default_factory=list,
        description="Per-level raw integer QC flags along the vertical axis."
    )
    good_levels_count: int = Field(
        default=0,
        description="Number of levels classified as good / probably_good."
    )
    total_levels_count: int = Field(
        default=0,
        description="Total number of levels evaluated."
    )
    is_valid_for_collocation: bool = Field(
        default=True,
        description="Whether this variable profile meets QC thresholds to be collocated with model fields."
    )

    @field_validator("total_levels_count")
    @classmethod
    def validate_counts(cls, v: int, info) -> int:
        good = info.data.get("good_levels_count", 0)
        if good > v and v > 0:
            raise ValueError(f"good_levels_count ({good}) cannot exceed total_levels_count ({v})")
        return v


class ObservationQCReport(BaseModel):
    """
    Comprehensive QC evaluation report for an individual observation cast or trajectory segment.
    """
    qc_scheme: QCScheme = Field(
        default=QCScheme.wmo_argo,
        description="Governing QC scheme."
    )
    qc_derivation_source: QCDerivationSource = Field(
        default=QCDerivationSource.PROVIDER_SUPPLIED,
        description="Provenance of the QC evaluation: provider-supplied or locally derived by QuasarOS."
    )
    derivation_method_version: Optional[str] = Field(
        default=None,
        description="Version/name of the QC evaluation algorithm."
    )
    position_qc_flag: int = Field(
        default=1,
        description="Position QC flag (1=good, 2=probably good, 3=suspect, 4=bad, 9=missing)."
    )
    position_qc_state: NormalizedQCState = Field(
        default=NormalizedQCState.good,
        description="Normalized position QC state."
    )
    time_qc_flag: int = Field(
        default=1,
        description="Time QC flag (1=good, 2=probably good, 3=suspect, 4=bad, 9=missing)."
    )
    time_qc_state: NormalizedQCState = Field(
        default=NormalizedQCState.good,
        description="Normalized time QC state."
    )
    profile_grade: ProfileQCGrade = Field(
        default=ProfileQCGrade.A,
        description="Overall profile QC grade."
    )
    variable_qc: Dict[str, VariableQCRecord] = Field(
        default_factory=dict,
        description="QC records keyed by variable name."
    )
    qartod_tests_executed: List[str] = Field(
        default_factory=list,
        description="List of specific QARTOD or Argo automated tests executed (e.g. 'syntax_check', 'gross_range_test', 'spike_test', 'density_inversion_test')."
    )
    is_fully_certified: bool = Field(
        default=True,
        description="True if position, time, and all primary variables have passed quality standards."
    )

    @classmethod
    def evaluate_wmo_profile(
        cls,
        position_flag: int,
        time_flag: int,
        variables_qc: Dict[str, List[int]],
        primary_var: Optional[str] = None,
    ) -> "ObservationQCReport":
        """
        Factory to construct and evaluate an ObservationQCReport from raw WMO Argo QC flags.
        Computes normalized states, good level percentages, and profile grade.
        """
        pos_state = WMO_ARGO_QC_SCHEME.normalize_flag(position_flag)
        time_state = WMO_ARGO_QC_SCHEME.normalize_flag(time_flag)

        var_records: Dict[str, VariableQCRecord] = {}
        all_good = (pos_state in (NormalizedQCState.good, NormalizedQCState.probably_good)) and \
                   (time_state in (NormalizedQCState.good, NormalizedQCState.probably_good))

        target_for_grade = primary_var if primary_var and primary_var in variables_qc else next(iter(variables_qc.keys()), None)
        grade = ProfileQCGrade.NOT_RATED

        for vname, flags in variables_qc.items():
            tot = len(flags)
            good_cnt = sum(1 for f in flags if WMO_ARGO_QC_SCHEME.is_accepted(f))
            valid_colloc = (good_cnt > 0 and (good_cnt / tot >= 0.5)) if tot > 0 else False
            
            var_records[vname] = VariableQCRecord(
                variable_name=vname,
                qc_scheme=QCScheme.wmo_argo,
                level_qc_flags=flags,
                good_levels_count=good_cnt,
                total_levels_count=tot,
                is_valid_for_collocation=valid_colloc,
            )

            if vname == target_for_grade and tot > 0:
                pct = (good_cnt / tot) * 100.0
                if pct == 100.0:
                    grade = ProfileQCGrade.A
                elif pct >= 75.0:
                    grade = ProfileQCGrade.B
                elif pct >= 50.0:
                    grade = ProfileQCGrade.C
                elif pct >= 25.0:
                    grade = ProfileQCGrade.D
                elif pct > 0.0:
                    grade = ProfileQCGrade.E
                else:
                    grade = ProfileQCGrade.F

        return cls(
            qc_scheme=QCScheme.wmo_argo,
            position_qc_flag=position_flag,
            position_qc_state=pos_state,
            time_qc_flag=time_flag,
            time_qc_state=time_state,
            profile_grade=grade,
            variable_qc=var_records,
            is_fully_certified=all_good and (grade in (ProfileQCGrade.A, ProfileQCGrade.B)),
        )
