"""
QuasarOS Catalog Service Response Models and DTOs.

Conforms to OpenAPI 3.1, docs/02-architecture/APIContracts.md and Pydantic V2 schemas.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Generic, List, Optional, TypeVar
import uuid
from pydantic import BaseModel, Field

from quasar_contracts.capabilities import DatasetCapabilitiesContract
from quasar_contracts.canonical_dataset import CanonicalDatasetContract
from quasar_contracts.identity import DatasetIdentity
from quasar_contracts.variables import CanonicalVariableContract
from quasar_contracts.visualization_contracts import (
    MultiresolutionLevelContract,
    QuantizationContract,
    RenderStatisticsContract,
    TransferFunctionContract,
    VisualizationProductContract,
)

T = TypeVar("T")


class ResponseMeta(BaseModel):
    """Authoritative response envelope metadata."""
    requestId: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique request tracing identifier")
    schemaVersion: str = Field(default="1.0.0", description="API contract schema version")
    timestampUtc: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC response generation timestamp"
    )


class ApiResponse(BaseModel, Generic[T]):
    """Standard response envelope conforming to docs/02-architecture/APIContracts.md."""
    data: T
    meta: ResponseMeta = Field(default_factory=ResponseMeta)


class HealthStatus(BaseModel):
    """Service health check model."""
    status: str = Field(..., description="Health state: 'ok', 'degraded', 'unavailable'")
    service: str = Field(default="quasar-catalog-service", description="Service identifier")
    version: str = Field(default="1.0.0", description="Service release version")
    activeSnapshotsCount: int = Field(default=0, description="Number of loaded active snapshots")
    historicalSnapshotsCount: int = Field(default=0, description="Number of loaded historical snapshots")
    visualizationProductsCount: int = Field(default=0, description="Number of loaded visualization products")
    integrityVerified: bool = Field(default=True, description="Whether all SHA-256 integrity checks passed")


class SnapshotSummary(BaseModel):
    """Summary of an individual operational or historical snapshot."""
    snapshotId: str = Field(..., description="Immutable snapshot identifier")
    datasetId: str = Field(..., description="Parent dataset identifier")
    temporalClassification: str = Field(..., description="OPERATIONAL_CURRENT_SNAPSHOT or HISTORICAL_SEVEN_DAY_VALIDATION_SNAPSHOT")
    startDate: str = Field(..., description="Start date (ISO 8601 string)")
    endDate: str = Field(..., description="End date (ISO 8601 string)")
    latestValidTime: Optional[str] = Field(default=None, description="Latest valid timestamp ISO 8601 UTC")
    shape: List[int] = Field(..., description="Array shape [time, depth, lat, lon]")
    temperatureRangeDegC: Optional[List[float]] = Field(default=None, description="Valid physical temperature range")
    sourceSha256: str = Field(..., description="Bitwise SHA-256 digest of source NetCDF or canonical baseline")
    rawNcPath: Optional[str] = Field(default=None, description="Repository-relative safe path to raw NetCDF")
    canonicalZarrPath: Optional[str] = Field(default=None, description="Repository-relative safe path to canonical Zarr store")
    visualizationProductId: Optional[str] = Field(default=None, description="Associated visualization product ID if available")
    isEligibleForExactQuery: bool = Field(default=True, description="True for native NetCDF / canonical arrays")
    immutable: bool = Field(default=True, description="Immutability certification")


class DatasetFamilySummary(BaseModel):
    """Summary of a dataset family in the catalog."""
    datasetId: str = Field(..., description="Unique dataset identifier")
    title: str = Field(..., description="Dataset title")
    provider: str = Field(..., description="Provider organization")
    scientificRole: str = Field(..., description="Scientific role (model, observation, etc.)")
    dataClass: str = Field(..., description="Data class discriminator")
    activeSnapshotId: str = Field(..., description="Active operational snapshot ID")
    availableSnapshotsCount: int = Field(default=1, description="Total number of registered snapshots")
    temporalRange: Dict[str, str] = Field(..., description="{'start': ..., 'end': ...}")
    variables: List[str] = Field(default_factory=list, description="Available canonical variable IDs")
    canVolumeRender3d: bool = Field(default=False, description="3D volume rendering capability")
    canExactQuery: bool = Field(default=True, description="Exact query capability")


class CatalogOverview(BaseModel):
    """Catalog search and overview model."""
    totalDatasets: int = Field(..., description="Total number of registered dataset families")
    datasets: List[DatasetFamilySummary] = Field(default_factory=list, description="List of dataset families")
    activeSnapshots: List[SnapshotSummary] = Field(default_factory=list, description="List of active operational snapshots")
    historicalSnapshots: List[SnapshotSummary] = Field(default_factory=list, description="List of historical validation snapshots")


class DatasetTimeAxis(BaseModel):
    """Detailed temporal axis representation for a dataset."""
    datasetId: str = Field(..., description="Dataset identifier")
    snapshotId: str = Field(..., description="Snapshot identifier")
    calendar: str = Field(default="gregorian", description="CF calendar type")
    temporalClassification: str = Field(..., description="Temporal classification of this snapshot")
    timeStepsCount: int = Field(..., description="Number of available discrete timesteps")
    availableTimestamps: List[str] = Field(..., description="List of ISO 8601 UTC timestamps")
    referenceTimeUtc: Optional[str] = Field(default=None, description="Forecast cycle reference time if applicable")
    startDatetimeUtc: str = Field(..., description="Start timestamp ISO 8601 UTC")
    endDatetimeUtc: str = Field(..., description="End timestamp ISO 8601 UTC")
    temporalResolution: str = Field(default="P1D (Daily Mean)", description="Temporal resolution description")


class DatasetVariablesCatalog(BaseModel):
    """Catalog of variables for a dataset."""
    datasetId: str = Field(..., description="Dataset identifier")
    snapshotId: str = Field(..., description="Snapshot identifier")
    variables: Dict[str, CanonicalVariableContract] = Field(..., description="Canonical variable specifications indexed by variable ID")


class VisualizationProductSummary(BaseModel):
    """Summary of a derived 3D visualization product."""
    visualizationProductId: str = Field(..., description="Visualization product identifier")
    productVersion: str = Field(default="v1", description="Product version")
    sourceDatasetId: str = Field(..., description="Authoritative source dataset identifier")
    sourceVariableId: str = Field(..., description="Target variable identifier visualized")
    canonicalUnits: str = Field(..., description="Authoritative scientific units")
    totalBricks: int = Field(..., description="Total number of 3D bricks across all LODs")
    lodLevelsCount: int = Field(..., description="Number of LOD levels available")
    storageBytes: int = Field(..., description="Total storage size in bytes")
    storageMib: float = Field(..., description="Total storage size in MiB")
    isEligibleForExactQuery: bool = Field(default=False, description="Strictly False for visualization bricks")
    manifestSha256: str = Field(..., description="SHA-256 checksum of visualization manifest")


class VisualizationProductDetail(BaseModel):
    """Comprehensive visualization product detail including LODs, bricks inventory, and contracts."""
    visualizationProduct: VisualizationProductContract = Field(..., description="Authoritative VisualizationProductContract")
    quantizationContract: Optional[QuantizationContract] = Field(default=None, description="Quantization contract applied")
    totalBricks: int = Field(..., description="Total number of bricks in product")
    storageSummary: Dict[str, Any] = Field(default_factory=dict, description="Compressed storage summary")
    isEligibleForExactQuery: bool = Field(default=False, description="Strictly False")
    brickInventoryCount: int = Field(..., description="Number of bricks declared in manifest")
    manifestPath: str = Field(..., description="Safe repository-relative path to manifest")


class SystemCapabilities(BaseModel):
    """System and dataset capabilities model."""
    serverVersion: str = Field(default="1.0.0", description="Catalog service server version")
    supportedRenderingBackends: List[str] = Field(
        default_factory=lambda: ["webgpu_wgsl", "webgl2_glsl"],
        description="Supported 3D volume rendering backend targets"
    )
    supportedCoordinateSpaces: List[str] = Field(
        default_factory=lambda: ["geographic_wgs84", "local_enu", "display_volume_lab", "native_grid_indices"],
        description="Supported coordinate reference frames"
    )
    supportedSelectionMethods: List[str] = Field(
        default_factory=lambda: ["nearest_native_sample", "exact_grid_index", "trilinear_interpolation", "bilinear_horizontal_nearest_vertical"],
        description="Supported interpolation algorithms for exact queries"
    )
    exactQueryPrecision: str = Field(default="float32/float64 (Native Provider Array Full Precision)", description="Numerical precision of exact queries")
    gpuVisualizationPrecision: str = Field(default="r16float / r16uint (Lossy / Quantized with Documented Bounds)", description="Precision of GPU textures")
    resourceLimits: Dict[str, Any] = Field(
        default_factory=lambda: {
            "maxQueryPoints": 1000,
            "maxProfileLevels": 200,
            "maxStreamingChunks": 64,
            "maxBrickLodLevel": 2
        },
        description="Resource constraints and safety bounds"
    )

