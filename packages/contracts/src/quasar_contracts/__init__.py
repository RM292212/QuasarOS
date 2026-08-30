"""
QuasarOS Canonical Scientific Contracts Package

Authoritative, versioned, renderer-independent scientific data schemas and validation rules.
"""

from quasar_contracts.assets import (
    ArtifactClassification,
    AssetFormat,
    ImmutableSourceAsset,
)
from quasar_contracts.canonical_dataset import CanonicalDatasetContract
from quasar_contracts.capabilities import DatasetCapabilitiesContract
from quasar_contracts.coordinates import (
    AxisType,
    CanonicalCoordinate,
    CanonicalDimension,
    CoordinateSpacing,
    LatitudeCoordinate,
    LongitudeCoordinate,
    Monotonicity,
    VerticalDatum,
    VerticalDirection,
)
from quasar_contracts.data_class import (
    DataClassDiscriminator,
    OperationalStatus,
    ProcessingLevel,
    ScientificRole,
)
from quasar_contracts.errors_warnings import (
    ErrorCategory,
    ErrorSeverity,
    ScientificDiagnostic,
    ScientificErrorCode,
)
from quasar_contracts.export import (
    EXPORT_MODELS,
    export_schemas_to_directory,
    generate_json_schema,
    generate_typescript_declarations,
    verify_schemas_in_directory,
)
from quasar_contracts.horizontal_grids import (
    CRS,
    GridType,
    HorizontalGridContract,
    SpatialBoundingBox,
    StaggeringType,
)
from quasar_contracts.identity import (
    DatasetIdentity,
    ProviderIdentity,
)
from quasar_contracts.licence_citation import (
    AccessRestriction,
    Citation,
    LicenceContract,
)
from quasar_contracts.missing_values import (
    MissingValueContract,
    PackingMetadata,
    PhysicalCellState,
)
from quasar_contracts.provenance import LineageRecord
from quasar_contracts.quality_control import (
    GEBCO_TID_QC_SCHEME,
    IOOS_QARTOD_QC_SCHEME,
    WMO_ARGO_QC_SCHEME,
    NormalizedQCState,
    QCFlagDefinition,
    QCScheme,
    QualityControlContract,
)
from quasar_contracts.time_semantics import (
    CalendarType,
    TimeSemanticsContract,
)
from quasar_contracts.units import (
    CanonicalUnitContract,
    PhysicalDimension,
    UnitConversionClassification,
    UnitConversionResult,
    classify_unit_conversion,
)
from quasar_contracts.validation_state import (
    ValidationCheckResult,
    ValidationReport,
    ValidationState,
)
from quasar_contracts.variables import (
    CanonicalVariableContract,
    DisplayRange,
    PhysicalQuantity,
    Topology,
    VectorConvention,
)
from quasar_contracts.versioning import (
    ChangeClassification,
    SchemaVersionMetadata,
    classify_schema_change,
    is_backwards_compatible,
    parse_semver,
)
from quasar_contracts.vertical_coords import (
    ROMSSCoordinateParameters,
    VerticalCoordinateContract,
    VerticalCoordinateType,
)
from quasar_contracts.model_contracts import (
    ForecastCycleContract,
    HYCOMModelContract,
    HYCOMVerticalRepresentation,
    ModelClass,
    ModelMaskContract,
    ModelRunType,
    OceanHydrodynamicModelContract,
)
from quasar_contracts.wave_contracts import (
    OceanWaveProductContract,
    StokesDriftContract,
    WavePartitionContract,
    WavePartitionType,
    WaveSpectralModel,
    circular_distance_deg,
    mean_wave_direction,
    normalize_angle_deg,
)
from quasar_contracts.vector_contracts import (
    RotationMetadata,
    VectorGroupContract,
    VectorGroupType,
    VectorReferenceFrame,
    compute_speed_and_direction,
    rotate_earth_to_grid,
    rotate_grid_to_earth,
)
from quasar_contracts.specialized_grids import (
    ArakawaStaggeringContract,
    CurvilinearGridContract,
    GridMetricsContract,
)
from quasar_contracts.roms_contracts import (
    ROMSFormulaTerms,
    ROMSSCoordinateContract,
    ROMSVstretchingType,
    ROMSVtransformType,
    compute_roms_depths,
    compute_roms_stretching,
)
from quasar_contracts.platform_contracts import (
    PlatformMetadataContract,
    PlatformType,
    SensorMetadata,
)
from quasar_contracts.profile_contracts import (
    DataMode,
    ProfileCastContract,
    ProfileDirection,
    ProfileVariableEntry,
)
from quasar_contracts.trajectory_contracts import (
    DiveSegment,
    TrajectoryContract,
    TrajectoryPhase,
    TrajectoryWaypoint,
)
from quasar_contracts.observation_qc import (
    ObservationQCReport,
    ProfileQCGrade,
    QCDerivationSource,
    VariableQCRecord,
)
from quasar_contracts.duplicate_contracts import (
    DeduplicationResolution,
    DuplicateRelationshipContract,
    DuplicateRelationshipType,
)
from quasar_contracts.collocation_contracts import (
    CollocationBlockingReason,
    CollocationReadinessContract,
)
from quasar_contracts.visualization_contracts import (
    AggregationMethod,
    BackendCompatibility,
    BrickGeometryContract,
    BrickIdentityContract,
    BrickPayloadContract,
    CompressionCodec,
    CoordinateSpace,
    CoordinateTransformContract,
    FirstVolumeSliceProfile,
    InterpolationPolicy,
    MultiresolutionLevelContract,
    OutOfRangeRenderingPolicy,
    QuantizationContract,
    RenderStatisticsContract,
    TextureSampleFormat,
    TransferFunctionContract,
    TransferFunctionControlPoint,
    VisualizationProductContract,
    VolumeRenderingBackend,
)
from quasar_contracts.exact_value_contracts import (
    ExactValueQueryRequest,
    ExactValueQueryResponse,
    MultiBrickStreamingResponse,
    ProvisionalRenderPickResponse,
    SelectionInterpolationContract,
    SelectionMethod,
    StreamingChunkRequest,
    StreamingManifestEntry,
    TimeSelectorMode,
    VerticalSelectorType,
)

__version__ = "1.2.0"

__all__ = [
    # Versioning
    "ChangeClassification",
    "SchemaVersionMetadata",
    "parse_semver",
    "is_backwards_compatible",
    "classify_schema_change",
    # Identity
    "ProviderIdentity",
    "DatasetIdentity",
    # Data Class
    "DataClassDiscriminator",
    "ScientificRole",
    "ProcessingLevel",
    "OperationalStatus",
    # Licence & Citation
    "AccessRestriction",
    "Citation",
    "LicenceContract",
    # Validation State
    "ValidationState",
    "ValidationCheckResult",
    "ValidationReport",
    # Assets
    "AssetFormat",
    "ArtifactClassification",
    "ImmutableSourceAsset",
    # Units
    "PhysicalDimension",
    "UnitConversionClassification",
    "CanonicalUnitContract",
    "UnitConversionResult",
    "classify_unit_conversion",
    # Coordinates & Dimensions
    "AxisType",
    "Monotonicity",
    "CoordinateSpacing",
    "VerticalDatum",
    "VerticalDirection",
    "CanonicalDimension",
    "CanonicalCoordinate",
    "LongitudeCoordinate",
    "LatitudeCoordinate",
    # Horizontal Grids
    "GridType",
    "CRS",
    "StaggeringType",
    "SpatialBoundingBox",
    "HorizontalGridContract",
    # Vertical Coordinates
    "VerticalCoordinateType",
    "ROMSSCoordinateParameters",
    "VerticalCoordinateContract",
    # Time Semantics
    "CalendarType",
    "TimeSemanticsContract",
    # Missing Values & Packing
    "PhysicalCellState",
    "PackingMetadata",
    "MissingValueContract",
    # Quality Control
    "QCScheme",
    "NormalizedQCState",
    "QCFlagDefinition",
    "QualityControlContract",
    "WMO_ARGO_QC_SCHEME",
    "IOOS_QARTOD_QC_SCHEME",
    "GEBCO_TID_QC_SCHEME",
    # Provenance
    "LineageRecord",
    # Capabilities
    "DatasetCapabilitiesContract",
    # Errors & Diagnostics
    "ErrorCategory",
    "ErrorSeverity",
    "ScientificErrorCode",
    "ScientificDiagnostic",
    # Variables
    "PhysicalQuantity",
    "Topology",
    "VectorConvention",
    "DisplayRange",
    "CanonicalVariableContract",
    # Composite Dataset
    "CanonicalDatasetContract",
    # Specialized Model & Wave Contracts (TASK-02C)
    "ModelClass",
    "ModelRunType",
    "HYCOMVerticalRepresentation",
    "ModelMaskContract",
    "ForecastCycleContract",
    "HYCOMModelContract",
    "OceanHydrodynamicModelContract",
    "WavePartitionType",
    "WaveSpectralModel",
    "WavePartitionContract",
    "StokesDriftContract",
    "OceanWaveProductContract",
    "normalize_angle_deg",
    "circular_distance_deg",
    "mean_wave_direction",
    "VectorReferenceFrame",
    "VectorGroupType",
    "RotationMetadata",
    "VectorGroupContract",
    "rotate_grid_to_earth",
    "rotate_earth_to_grid",
    "compute_speed_and_direction",
    "CurvilinearGridContract",
    "ArakawaStaggeringContract",
    "GridMetricsContract",
    "ROMSVtransformType",
    "ROMSVstretchingType",
    "ROMSFormulaTerms",
    "ROMSSCoordinateContract",
    "compute_roms_stretching",
    "compute_roms_depths",
    # Specialized Observation Contracts (TASK-02D)
    "PlatformType",
    "SensorMetadata",
    "PlatformMetadataContract",
    "ProfileDirection",
    "DataMode",
    "ProfileVariableEntry",
    "ProfileCastContract",
    "TrajectoryPhase",
    "TrajectoryWaypoint",
    "DiveSegment",
    "TrajectoryContract",
    "ProfileQCGrade",
    "VariableQCRecord",
    "QCDerivationSource",
    "ObservationQCReport",
    "DuplicateRelationshipType",
    "DeduplicationResolution",
    "DuplicateRelationshipContract",
    "CollocationBlockingReason",
    "CollocationReadinessContract",
    # Visualization & Exact Value Contracts (TASK-02E)
    "VolumeRenderingBackend",
    "BackendCompatibility",
    "CompressionCodec",
    "TextureSampleFormat",
    "AggregationMethod",
    "InterpolationPolicy",
    "OutOfRangeRenderingPolicy",
    "CoordinateSpace",
    "QuantizationContract",
    "BrickIdentityContract",
    "BrickGeometryContract",
    "BrickPayloadContract",
    "MultiresolutionLevelContract",
    "RenderStatisticsContract",
    "CoordinateTransformContract",
    "TransferFunctionControlPoint",
    "TransferFunctionContract",
    "VisualizationProductContract",
    "FirstVolumeSliceProfile",
    "SelectionMethod",
    "VerticalSelectorType",
    "TimeSelectorMode",
    "SelectionInterpolationContract",
    "ProvisionalRenderPickResponse",
    "ExactValueQueryRequest",
    "ExactValueQueryResponse",
    "StreamingChunkRequest",
    "StreamingManifestEntry",
    "MultiBrickStreamingResponse",
    # Export & Verification
    "EXPORT_MODELS",
    "generate_json_schema",
    "export_schemas_to_directory",
    "verify_schemas_in_directory",
    "generate_typescript_declarations",
]
