import math
from enum import Enum
from typing import Any, List, Optional, Tuple, Union
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.errors_warnings import (
    ErrorCategory,
    ErrorSeverity,
    ScientificDiagnostic,
    ScientificErrorCode,
)


class PhysicalCellState(str, Enum):
    """Authoritative physical validity state of an individual voxel / cell."""
    valid = "valid"                      # Valid numeric physical observation or model value
    missing = "missing"                  # Explicit fill value or null in source data
    masked = "masked"                    # Land or coastline boundary mask
    outside_domain = "outside_domain"    # Cell outside bounding volume or temporal window
    below_seafloor = "below_seafloor"    # Depth level located below bathymetric seafloor
    not_evaluated = "not_evaluated"      # Computational cell skipped or uncomputed
    rejected_by_qc = "rejected_by_qc"    # Value rejected due to failing QC flags


# Standard integer type bounds for validation
INTEGER_TYPE_BOUNDS = {
    "int8": (-128, 127),
    "uint8": (0, 255),
    "int16": (-32768, 32767),
    "uint16": (0, 65535),
    "int32": (-2147483648, 2147483647),
    "uint32": (0, 4294967295),
    "int64": (-9223372036854775808, 9223372036854775807),
    "uint64": (0, 18446744073709551615),
}


class PackingMetadata(BaseModel):
    """
    CF-compliant scale_factor and add_offset packing specification.
    Formula: unpacked_value = (packed_value * scale_factor) + add_offset
    """
    scale_factor: float = Field(
        default=1.0,
        description="Linear scale factor multiplier."
    )
    add_offset: float = Field(
        default=0.0,
        description="Linear add offset translation."
    )
    packed_data_type: str = Field(
        default="int16",
        description="Packed raw integer data type ('int16', 'int32', 'int8', 'uint16', etc.)."
    )
    unpacked_data_type: str = Field(
        default="float32",
        description="Unpacked floating point data type ('float32', 'float64')."
    )

    def unpack_value(self, packed_val: Union[int, float]) -> float:
        """De-quantize packed integer to physical float value."""
        return float(packed_val * self.scale_factor + self.add_offset)

    def pack_value(self, unpacked_val: float) -> int:
        """Quantize physical float value into packed integer."""
        return int(round((unpacked_val - self.add_offset) / self.scale_factor))


class MissingValueContract(BaseModel):
    """
    Authoritative missing value and valid range specification.
    
    Supports:
    - Provider-declared fill values (int, float, NaN, zero sentinel).
    - Legacy missing_value attribute with structured difference diagnostics.
    - Decoupled missing-value checking on raw stored vs decoded physical values.
    - Explicit type representation checks against stored data types.
    """
    fill_value: Optional[float] = Field(
        default=None,
        description="CF _FillValue (e.g. -32767.0, -9999.0, 9.96921e+36, 0.0, NaN)."
    )
    missing_value: Optional[float] = Field(
        default=None,
        description="CF missing_value legacy attribute."
    )
    has_nan: bool = Field(
        default=True,
        description="Whether IEEE 754 NaN represents missing data."
    )
    valid_min: Optional[float] = Field(
        default=None,
        description="Minimum physical threshold below which data are invalid."
    )
    valid_max: Optional[float] = Field(
        default=None,
        description="Maximum physical threshold above which data are invalid."
    )
    stored_data_type: Optional[str] = Field(
        default=None,
        description="Declared raw storage datatype ('int8', 'int16', 'int32', 'uint16', 'float32', 'float64')."
    )
    is_fill_value_raw: bool = Field(
        default=True,
        description="Whether fill_value is compared against raw packed integers before scale/offset decoding."
    )
    diagnostics: List[ScientificDiagnostic] = Field(
        default_factory=list,
        description="Scientific diagnostics and warnings regarding fill value definitions."
    )

    def _matches_sentinel(self, val: float, sentinel: Optional[float]) -> bool:
        """Helper to match a value against a sentinel, handling NaNs and floating tolerance."""
        if sentinel is None:
            return False
        if math.isnan(sentinel):
            return math.isnan(val)
        if math.isnan(val):
            return False
        return math.isclose(val, sentinel, rel_tol=1e-5, abs_tol=1e-5)

    def is_raw_missing(self, raw_val: Union[int, float]) -> bool:
        """Check if a raw packed value matches declared fill_value or missing_value sentinels."""
        if math.isnan(raw_val):
            return self.has_nan
        if self._matches_sentinel(raw_val, self.fill_value):
            return True
        if self._matches_sentinel(raw_val, self.missing_value):
            return True
        return False

    def is_physical_missing(self, decoded_val: float) -> bool:
        """Check if a decoded physical value is missing or outside valid range."""
        if math.isnan(decoded_val):
            return self.has_nan
        if not self.is_fill_value_raw:
            if self._matches_sentinel(decoded_val, self.fill_value):
                return True
            if self._matches_sentinel(decoded_val, self.missing_value):
                return True
        if self.valid_min is not None and decoded_val < self.valid_min:
            return True
        if self.valid_max is not None and decoded_val > self.valid_max:
            return True
        return False

    def is_missing(self, val: float) -> bool:
        """
        Generic check if a numeric value represents missing or invalid data.
        If no separate raw step is configured, evaluates against sentinels and valid bounds.
        """
        if math.isnan(val):
            return self.has_nan
        if self._matches_sentinel(val, self.fill_value):
            return True
        if self._matches_sentinel(val, self.missing_value):
            return True
        if self.valid_min is not None and val < self.valid_min:
            return True
        if self.valid_max is not None and val > self.valid_max:
            return True
        return False

    def decode_and_mask(
        self,
        raw_val: Union[int, float],
        packing: Optional[PackingMetadata] = None,
    ) -> Tuple[Optional[float], PhysicalCellState]:
        """
        Decode a stored value into a separated decoded scientific value and physical state.
        
        Preserves strict separation:
        - Decoded value is None when missing/invalid (never silently replaced with 0.0).
        - Mask state is authoritatively tracked as PhysicalCellState.
        """
        # Step 1: Check raw fill values if fill_value is raw (CF standard behavior)
        if self.is_fill_value_raw and self.is_raw_missing(raw_val):
            return None, PhysicalCellState.missing

        # Step 2: Scale/offset de-quantization
        if packing is not None:
            decoded = packing.unpack_value(raw_val)
        else:
            decoded = float(raw_val)

        # Step 3: Check decoded value for missing sentinel (if not raw) or valid range bounds
        if math.isnan(decoded) and self.has_nan:
            return None, PhysicalCellState.missing
        if not self.is_fill_value_raw and self.is_raw_missing(decoded):
            return None, PhysicalCellState.missing
        if self.valid_min is not None and decoded < self.valid_min:
            return None, PhysicalCellState.rejected_by_qc
        if self.valid_max is not None and decoded > self.valid_max:
            return None, PhysicalCellState.rejected_by_qc

        return decoded, PhysicalCellState.valid

    @model_validator(mode="after")
    def validate_missing_value_invariants(self) -> "MissingValueContract":
        # 1. Stored datatype representability check
        if self.stored_data_type:
            dtype_key = self.stored_data_type.lower()
            if dtype_key in INTEGER_TYPE_BOUNDS:
                min_b, max_b = INTEGER_TYPE_BOUNDS[dtype_key]
                for name, val in [("fill_value", self.fill_value), ("missing_value", self.missing_value)]:
                    if val is not None:
                        if math.isnan(val):
                            raise ValueError(
                                f"Scientific contract violation: NaN {name} cannot be represented by integer datatype '{self.stored_data_type}'."
                            )
                        if not float(val).is_integer() or val < min_b or val > max_b:
                            raise ValueError(
                                f"Scientific contract violation: {name}={val} exceeds representable range [{min_b}, {max_b}] for datatype '{self.stored_data_type}'."
                            )

        # 2. Structured warning if _FillValue and missing_value differ
        if self.fill_value is not None and self.missing_value is not None:
            differ = False
            if math.isnan(self.fill_value) != math.isnan(self.missing_value):
                differ = True
            elif not math.isnan(self.fill_value) and not math.isclose(self.fill_value, self.missing_value, rel_tol=1e-5, abs_tol=1e-5):
                differ = True
            
            if differ:
                has_diag = any(d.code == "DATA_FILL_VALUE_DISCREPANCY" for d in self.diagnostics)
                if not has_diag:
                    self.diagnostics.append(
                        ScientificDiagnostic(
                            code="DATA_FILL_VALUE_DISCREPANCY",
                            category=ErrorCategory.DATA,
                            severity=ErrorSeverity.WARNING,
                            message=f"_FillValue ({self.fill_value}) differs from legacy missing_value ({self.missing_value}). Both will be treated as missing sentinels.",
                            details={"fill_value": str(self.fill_value), "missing_value": str(self.missing_value)}
                        )
                    )

        return self
