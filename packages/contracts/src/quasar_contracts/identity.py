"""
QuasarOS Dataset Identity Contract

Enforces authoritative dataset identity, provider taxonomy, snapshot IDs,
and strict validation against bare model name confusion and synthetic data leakage.
"""

import re
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.data_class import (
    DataClassDiscriminator,
    OperationalStatus,
    ProcessingLevel,
    ScientificRole,
)
from quasar_contracts.licence_citation import Citation, LicenceContract
from quasar_contracts.validation_state import ValidationReport


DATASET_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-\./:]+$")
BARE_MODEL_NAMES = {"hycom", "ww3", "wavewatch", "wavewatch3", "roms", "mom", "mom4", "mom5", "mike21", "gebco", "argo"}


class ProviderIdentity(BaseModel):
    """Authoritative provider and institution identity."""
    provider_id: str = Field(
        ...,
        description="Machine-readable provider identifier (e.g. 'copernicus_marine', 'incois', 'noaa_ncei', 'argo_gdac')."
    )
    name: str = Field(
        ...,
        description="Full organizational or programme name."
    )
    country: str = Field(
        ...,
        description="Country or international jurisdiction code/name."
    )
    institution_url: str = Field(
        ...,
        description="Primary official portal URL."
    )


class DatasetIdentity(BaseModel):
    """Authoritative scientific dataset identity specification."""
    dataset_id: str = Field(
        ...,
        description="Unique, stable machine-readable identifier for this dataset product."
    )
    dataset_version: str = Field(
        ...,
        description="Version string of the provider product or canonical snapshot."
    )
    snapshot_id: str = Field(
        ...,
        description="Immutable snapshot identifier or cryptographic hash ensuring dataset reproducibility."
    )
    title: str = Field(
        ...,
        description="Human-readable title of the scientific product."
    )
    description: str = Field(
        ...,
        description="Detailed oceanographic and technical description of the product."
    )
    provider: ProviderIdentity = Field(
        ...,
        description="Authoritative data provider and origin."
    )
    product_id: str = Field(
        ...,
        description="Provider-specific product or catalog identifier."
    )
    scientific_role: ScientificRole = Field(
        ...,
        description="Scientific role (model, observation, climatology, bathymetry, etc.)."
    )
    data_class: DataClassDiscriminator = Field(
        ...,
        description="Core scientific data class discriminator for rendering and analysis."
    )
    processing_level: ProcessingLevel = Field(
        ...,
        description="Processing level (L0 to L4, ANALYSIS_FORECAST, CLIMATOLOGY, etc.)."
    )
    operational_status: OperationalStatus = Field(
        ...,
        description="Operational maturity status."
    )
    licence: LicenceContract = Field(
        ...,
        description="Licence terms and attribution obligations."
    )
    citations: List[Citation] = Field(
        default_factory=list,
        description="Bibliographic citations and persistent DOIs."
    )
    validation_report: ValidationReport = Field(
        ...,
        description="Formal validation and certification report."
    )

    @model_validator(mode="after")
    def validate_identity_invariants(self) -> "DatasetIdentity":
        # 1. Dataset ID regex check
        if not DATASET_ID_REGEX.match(self.dataset_id):
            raise ValueError(f"dataset_id '{self.dataset_id}' contains invalid characters.")

        # 2. Bare model name policy enforcement: dataset_id and title cannot be bare model framework name
        cleaned_id = self.dataset_id.strip().lower()
        if cleaned_id in BARE_MODEL_NAMES:
            raise ValueError(
                f"Policy violation: dataset_id '{self.dataset_id}' uses bare model framework name. "
                "Must include dataset/provider qualifier (e.g. 'copernicus_phy_thetao' or 'hycom_espc_t3z')."
            )

        # 3. Synthetic fixture segregation rule
        if self.scientific_role == ScientificRole.TEST_FIXTURE and self.operational_status != OperationalStatus.SYNTHETIC:
            raise ValueError("Datasets with scientific_role='test_fixture' must have operational_status='synthetic'.")
        if self.operational_status == OperationalStatus.SYNTHETIC and self.scientific_role != ScientificRole.TEST_FIXTURE:
            raise ValueError("Datasets with operational_status='synthetic' must have scientific_role='test_fixture'.")

        return self
