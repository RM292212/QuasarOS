"""
QuasarOS Composite Canonical Dataset Contract

The authoritative top-level model integrating dataset identity, horizontal grids,
vertical coordinate definitions, time semantics, variable catalogs, capabilities,
immutable source assets, and provenance.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, model_validator

from quasar_contracts.assets import ImmutableSourceAsset
from quasar_contracts.capabilities import DatasetCapabilitiesContract
from quasar_contracts.horizontal_grids import HorizontalGridContract
from quasar_contracts.identity import DatasetIdentity
from quasar_contracts.provenance import LineageRecord
from quasar_contracts.time_semantics import TimeSemanticsContract
from quasar_contracts.variables import CanonicalVariableContract, Topology
from quasar_contracts.versioning import SchemaVersionMetadata
from quasar_contracts.vertical_coords import VerticalCoordinateContract, VerticalCoordinateType


class CanonicalDatasetContract(BaseModel):
    """Authoritative top-level canonical oceanographic dataset contract."""
    schema_version_metadata: SchemaVersionMetadata = Field(
        default_factory=SchemaVersionMetadata,
        description="Schema version and compatibility tracking."
    )
    identity: DatasetIdentity = Field(
        ...,
        description="Dataset identity, provider metadata, and certification."
    )
    grid: HorizontalGridContract = Field(
        ...,
        description="Horizontal grid topology and spatial bounding box."
    )
    vertical: VerticalCoordinateContract = Field(
        ...,
        description="Vertical coordinate system and depth structure."
    )
    time_semantics: TimeSemanticsContract = Field(
        ...,
        description="Temporal domain, calendar, and forecast lead time definition."
    )
    variables: Dict[str, CanonicalVariableContract] = Field(
        ...,
        description="Catalog of physical variables indexed by canonical variable ID."
    )
    capabilities: DatasetCapabilitiesContract = Field(
        ...,
        description="Renderer routing and analytical capability flags."
    )
    source_assets: List[ImmutableSourceAsset] = Field(
        default_factory=list,
        description="Underlying raw or normalized source assets with SHA-256 integrity."
    )
    provenance: Optional[List[LineageRecord]] = Field(
        default=None,
        description="Lineage transformations linking canonical representation to raw files."
    )
    spatial_coverage_description: str = Field(
        ...,
        description="Geographic region description (e.g. 'North Indian Ocean (Arabian Sea / Bay of Bengal)')."
    )
    temporal_coverage_description: str = Field(
        ...,
        description="Temporal interval description (e.g. '2025-04-20 to 2025-04-26 daily forecast')."
    )

    @model_validator(mode="after")
    def validate_composite_dataset_invariants(self) -> "CanonicalDatasetContract":
        # 1. Ensure at least one variable is defined
        if not self.variables:
            raise ValueError("CanonicalDatasetContract must declare at least one variable.")

        # 2. Volume rendering capability sanity check
        if self.capabilities.can_volume_render_3d:
            if self.vertical.coordinate_type == VerticalCoordinateType.surface_only:
                raise ValueError("can_volume_render_3d cannot be True for surface_only vertical coordinate.")
            has_vol = any(v.topology in (Topology.volume_scalar, Topology.volume_vector) for v in self.variables.values())
            if not has_vol:
                raise ValueError("can_volume_render_3d requires at least one variable with volume_scalar or volume_vector topology.")

        # 3. Source asset dataset_id linkage
        for asset in self.source_assets:
            if asset.dataset_id != self.identity.dataset_id:
                raise ValueError(
                    f"Asset '{asset.asset_id}' has dataset_id '{asset.dataset_id}' which does not match "
                    f"parent dataset identity '{self.identity.dataset_id}'."
                )

        return self
