"""
QuasarOS Licence, Citation, and Data Governance Contracts

Defines formal licensing, access restrictions, DOI tracking, and mandatory attribution schemas.
"""

import re
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


DOI_REGEX = re.compile(r"^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$")


class AccessRestriction(str, Enum):
    """Data access restriction classification."""
    OPEN_UNRESTRICTED = "open_unrestricted"
    ATTRIBUTION_REQUIRED = "attribution_required"
    NON_COMMERCIAL = "non_commercial"
    RESTRICTED_REGISTRATION_REQUIRED = "restricted_registration_required"
    INSTITUTIONAL_ONLY = "institutional_only"


class Citation(BaseModel):
    """Scientific bibliographic citation record."""
    citation_text: str = Field(
        ...,
        description="Full text bibliographic citation string (APA / BibTeX compatible)."
    )
    doi: Optional[str] = Field(
        default=None,
        description="Digital Object Identifier (e.g. '10.5281/zenodo.11670413')."
    )
    bibtex: Optional[str] = Field(
        default=None,
        description="Raw BibTeX citation record."
    )
    url: Optional[str] = Field(
        default=None,
        description="Direct persistent link to publication or data landing page."
    )

    @field_validator("doi")
    @classmethod
    def validate_doi(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().lower().replace("https://doi.org/", "").replace("http://doi.org/", "").replace("doi:", "")
            if not DOI_REGEX.match(clean):
                raise ValueError(f"Invalid DOI format: '{v}'")
            return clean
        return v


class LicenceContract(BaseModel):
    """Authoritative licensing terms and terms-of-use contract."""
    licence_id: str = Field(
        ...,
        description="Standard license identifier (e.g. 'CC-BY-4.0', 'Copernicus-Marine-Data-License', 'GEBCO-2020-Terms')."
    )
    licence_name: str = Field(
        ...,
        description="Full human-readable license name."
    )
    terms_url: str = Field(
        ...,
        description="Official URL specifying complete legal license terms."
    )
    attribution_statement: str = Field(
        ...,
        description="Mandatory user-facing attribution statement that must be rendered in UI."
    )
    access_restriction: AccessRestriction = Field(
        default=AccessRestriction.ATTRIBUTION_REQUIRED,
        description="Access restriction and registration policy."
    )
    commercial_use_allowed: bool = Field(
        default=True,
        description="Whether commercial exploitation of the data is permissible."
    )
