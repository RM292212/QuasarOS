"""
QuasarOS Visualization & Volume Rendering Contracts (TASK-02E)

Defines authoritative, versioned metadata models and structural contracts for
multiresolution 3D volume rendering products, sub-volume bricks, GPU texture payloads,
coordinate space transforms, linear integer quantization, render statistics, and transfer functions.

Governance Rules:
- Renderer-independent: Zero imports from Babylon.js, WebGPU, WebGL2, Three.js, React.
- Physical units preserved; missing values never treated as physical zero.
- Quantized textures are strictly marked with `is_eligible_for_exact_query = False`
  to guarantee that GPU-interpolated texture samples are never confused with authoritative scientific values.
"""

from enum import Enum
import re
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field, field_validator

from quasar_contracts.horizontal_grids import SpatialBoundingBox
from quasar_contracts.missing_values import PhysicalCellState


class VolumeRenderingBackend(str, Enum):
    """Supported 3D volume rendering backend targets."""
    WEBGPU_WGSL = "webgpu_wgsl"
    WEBGL2_GLSL = "webgl2_glsl"


class BackendCompatibility(str, Enum):
    """Renderer support status for visual products."""
    WEBGPU_RECOMMENDED = "webgpu_recommended"
    WEBGL2_FALLBACK = "webgl2_fallback"
    BOTH_SUPPORTED = "both_supported"


class CompressionCodec(str, Enum):
    """Approved binary compression codecs for sub-volume brick payloads."""
    RAW = "raw"
    ZSTD = "zstd"
    BLOSC = "blosc"
    LZ4 = "lz4"


class TextureSampleFormat(str, Enum):
    """GPU texture and buffer storage sample formats."""
    R16_FLOAT = "r16float"
    R32_FLOAT = "r32float"
    RGBA8_UNORM = "rgba8unorm"
    R8_UNORM = "r8unorm"
    R16_UNORM = "r16unorm"
    R16_UINT = "r16uint"


class AggregationMethod(str, Enum):
    """Statistical aggregation applied to construct multiresolution LOD levels."""
    AVERAGE_2X2X2 = "average_2x2x2"
    SUBSAMPLE_STRIDE_2 = "subsample_stride_2"
    AREA_WEIGHTED_AVERAGE = "area_weighted_average"
    MAX_MAGNITUDE = "max_magnitude"
    MEDIAN = "median"


class InterpolationPolicy(str, Enum):
    """Approved spatial/temporal interpolation policies."""
    NEAREST_NEIGHBOR = "nearest_neighbor"
    TRILINEAR = "trilinear"
    BILINEAR_HORIZONTAL_NEAREST_VERTICAL = "bilinear_horizontal_nearest_vertical"
    CUBIC_SPLINE = "cubic_spline"
    DISALLOWED_DISCRETE = "disallowed_discrete"


class OutOfRangeRenderingPolicy(str, Enum):
    """Behavior when physical values fall outside transfer function bounds."""
    CLAMP_TO_EDGE_COLOR = "clamp_to_edge_color"
    DISCARD_TRANSPARENT = "discard_transparent"
    RENDER_ALERT_COLOR = "render_alert_color"


class CoordinateSpace(str, Enum):
    """Coordinate frames across the scientific and visualization pipeline."""
    NATIVE_GRID_INDICES = "native_grid_indices"
    GEOGRAPHIC_WGS84 = "geographic_wgs84"
    LOCAL_ENU = "local_enu"
    NORMALIZED_TEXTURE_COORDINATES = "normalized_texture_coordinates"
    BRICK_LOCAL_SAMPLE_SPACE = "brick_local_sample_space"
    DISPLAY_VOLUME_LAB = "display_volume_lab"


class QuantizationContract(BaseModel):
    """
    Metadata governing linear integer quantization for GPU texture memory packing.
    Enforces documented error bounds and strictly flags data as non-authoritative.
    """
    scale_factor: float = Field(
        ...,
        description="Multiplicative scale factor applied during quantization: float_val = int_val * scale_factor + add_offset."
    )
    add_offset: float = Field(
        ...,
        description="Additive offset applied during quantization."
    )
    quantized_data_type: str = Field(
        default="uint16",
        description="Quantized integer type (e.g. 'uint8', 'uint16', 'uint32')."
    )
    unquantized_data_type: str = Field(
        default="float32",
        description="Source unquantized floating point type."
    )
    reserved_missing_code: Optional[int] = Field(
        default=65535,
        description="Dedicated discrete integer code reserved for missing / masked / invalid samples."
    )
    theoretical_max_quantization_error: float = Field(
        ...,
        description="Maximum absolute error introduced by quantization: 0.5 * scale_factor."
    )
    is_eligible_for_exact_query: bool = Field(
        default=False,
        description="MANDATORY FALSE: Quantized render textures must NEVER be queried as authoritative scientific values."
    )

    @field_validator("is_eligible_for_exact_query")
    @classmethod
    def validate_never_eligible(cls, v: bool) -> bool:
        if v is not False:
            raise ValueError("is_eligible_for_exact_query must be False; quantized textures cannot serve exact queries.")
        return v


class BrickIdentityContract(BaseModel):
    """
    Deterministic composite key uniquely identifying a sub-volume brick.
    Format: vis_prod_id:v1:lod{level}:t{time}:bx{x}:by{y}:bz{z}:{var_id}
    """
    visualization_product_id: str = Field(
        ...,
        description="ID of the visual product."
    )
    product_version: str = Field(
        default="v1",
        description="Version string of the visualization product."
    )
    lod_level: int = Field(
        ...,
        ge=0,
        description="Multiresolution level of detail (0 = finest full-resolution)."
    )
    timestep_index: int = Field(
        ...,
        ge=0,
        description="Discrete time step index along temporal axis."
    )
    brick_index_x: int = Field(
        ...,
        ge=0,
        description="Spatial brick grid index in X / Longitude dimension."
    )
    brick_index_y: int = Field(
        ...,
        ge=0,
        description="Spatial brick grid index in Y / Latitude dimension."
    )
    brick_index_z: int = Field(
        ...,
        ge=0,
        description="Spatial brick grid index in Z / Depth dimension."
    )
    variable_id: str = Field(
        ...,
        description="Canonical variable identifier."
    )

    @property
    def composite_key(self) -> str:
        """Construct canonical deterministic brick identity key."""
        return (
            f"{self.visualization_product_id}:{self.product_version}:"
            f"lod{self.lod_level}:t{self.timestep_index}:"
            f"bx{self.brick_index_x}:by{self.brick_index_y}:bz{self.brick_index_z}:"
            f"{self.variable_id}"
        )

    @classmethod
    def from_composite_key(cls, key: str) -> "BrickIdentityContract":
        """Parse composite key string into typed BrickIdentityContract."""
        parts = key.split(":")
        if len(parts) != 8:
            raise ValueError(f"Invalid brick composite key format: '{key}'. Expected 8 colon-separated components.")
        
        lod_match = re.match(r"^lod(\d+)$", parts[2])
        time_match = re.match(r"^t(\d+)$", parts[3])
        bx_match = re.match(r"^bx(\d+)$", parts[4])
        by_match = re.match(r"^by(\d+)$", parts[5])
        bz_match = re.match(r"^bz(\d+)$", parts[6])

        if not (lod_match and time_match and bx_match and by_match and bz_match):
            raise ValueError(f"Malformed coordinate indices in composite key: '{key}'")

        return cls(
            visualization_product_id=parts[0],
            product_version=parts[1],
            lod_level=int(lod_match.group(1)),
            timestep_index=int(time_match.group(1)),
            brick_index_x=int(bx_match.group(1)),
            brick_index_y=int(by_match.group(1)),
            brick_index_z=int(bz_match.group(1)),
            variable_id=parts[7],
        )


class BrickGeometryContract(BaseModel):
    """
    Defines spatial boundaries, sample shapes, padding/halos, and valid ranges for a 3D brick.
    """
    brick_key: str = Field(
        ...,
        description="Deterministic brick composite key."
    )
    sample_origin: List[int] = Field(
        ...,
        description="[x, y, z] origin offset in full-volume sample coordinates."
    )
    sample_shape: List[int] = Field(
        ...,
        description="[nx, ny, nz] sample dimensions including boundary padding/halo."
    )
    interior_valid_shape: List[int] = Field(
        ...,
        description="[nx, ny, nz] dimensions excluding boundary halo/padding."
    )
    halo_padding: List[int] = Field(
        default=[1, 1, 1],
        description="[pad_x, pad_y, pad_z] boundary halo overlap in voxels to eliminate interpolation seams."
    )
    spatial_bounds: SpatialBoundingBox = Field(
        ...,
        description="Geographic bounding box for this sub-volume brick."
    )
    min_depth_m: float = Field(
        ...,
        description="Minimum physical depth in meters for this brick."
    )
    max_depth_m: float = Field(
        ...,
        description="Maximum physical depth in meters for this brick."
    )
    min_value: Optional[float] = Field(
        default=None,
        description="Minimum valid physical value within this brick (excluding missing)."
    )
    max_value: Optional[float] = Field(
        default=None,
        description="Maximum valid physical value within this brick (excluding missing)."
    )
    is_empty_or_masked: bool = Field(
        default=False,
        description="Whether this brick contains 100% missing/masked samples (eligible for empty-space skipping)."
    )
    payload_sha256: str = Field(
        ...,
        description="SHA-256 checksum of the uncompressed brick payload."
    )

    @field_validator("sample_shape", "interior_valid_shape", "sample_origin", "halo_padding")
    @classmethod
    def validate_3d_vectors(cls, v: List[int]) -> List[int]:
        if len(v) != 3:
            raise ValueError(f"Expected 3-element vector [x, y, z], got {len(v)} elements.")
        return v


class BrickPayloadContract(BaseModel):
    """
    Describes the binary payload encoding, compression, and stable storage location.
    Zero signed tokens/credentials permitted in storage keys.
    """
    brick_key: str = Field(
        ...,
        description="Deterministic brick composite key."
    )
    storage_object_key: str = Field(
        ...,
        description="Relative storage path or stable object key (e.g. 'volumes/copernicus_thetao/v1/lod0/b_0_0_0.zst')."
    )
    compression_codec: CompressionCodec = Field(
        default=CompressionCodec.ZSTD,
        description="Compression codec applied to the payload."
    )
    sample_format: TextureSampleFormat = Field(
        default=TextureSampleFormat.R16_FLOAT,
        description="GPU texture buffer format."
    )
    uncompressed_bytes_length: int = Field(
        ...,
        gt=0,
        description="Byte size of uncompressed sample array."
    )
    compressed_bytes_length: int = Field(
        ...,
        gt=0,
        description="Byte size of compressed stored asset."
    )
    sha256_checksum: str = Field(
        ...,
        description="SHA-256 hash of the stored compressed asset."
    )
    quantization: Optional[QuantizationContract] = Field(
        default=None,
        description="Quantization metadata if texture values are integer quantized."
    )

    @field_validator("storage_object_key")
    @classmethod
    def validate_storage_key_no_secrets(cls, v: str) -> str:
        clean = v.strip()
        if "?" in clean or "&" in clean or "AWSAccessKeyId" in clean or "Signature" in clean:
            raise ValueError(f"Storage object key must be stable and cannot contain query parameters or credentials: '{v}'")
        return clean


class MultiresolutionLevelContract(BaseModel):
    """
    Contract defining a specific Level of Detail (LOD) in the multiresolution hierarchy.
    LOD 0 is the finest native grid resolution.
    """
    lod_level: int = Field(
        ...,
        ge=0,
        description="LOD index (0 = native/finest, higher indices = coarser resolutions)."
    )
    grid_shape: List[int] = Field(
        ...,
        description="[nx, ny, nz] spatial dimensions at this LOD."
    )
    brick_shape: List[int] = Field(
        default=[32, 32, 32],
        description="[bx, by, bz] standard sub-volume brick dimensions."
    )
    brick_grid_shape: List[int] = Field(
        ...,
        description="[num_bricks_x, num_bricks_y, num_bricks_z] grid layout of bricks."
    )
    total_brick_count: int = Field(
        ...,
        gt=0,
        description="Total number of sub-volume bricks in this LOD."
    )
    aggregation_method: AggregationMethod = Field(
        default=AggregationMethod.AVERAGE_2X2X2,
        description="Method used to compute coarser LOD levels from finer levels."
    )
    sample_data_type: str = Field(
        default="float32",
        description="Data type of uncompressed voxels at this LOD."
    )
    voxel_resolution_x_deg: float = Field(
        ...,
        gt=0.0,
        description="Effective spatial voxel resolution in longitude (degrees)."
    )
    voxel_resolution_y_deg: float = Field(
        ...,
        gt=0.0,
        description="Effective spatial voxel resolution in latitude (degrees)."
    )


class RenderStatisticsContract(BaseModel):
    """
    Comprehensive statistical summaries used for dynamic transfer function histogramming,
    contrast stretching, and empty-space skipping bounds.
    """
    valid_min: float = Field(
        ...,
        description="Global minimum physical value across valid (non-missing) samples."
    )
    valid_max: float = Field(
        ...,
        description="Global maximum physical value across valid (non-missing) samples."
    )
    percentile_01: float = Field(
        ...,
        description="1st percentile physical value for robust visual contrast scaling."
    )
    percentile_50: float = Field(
        ...,
        description="50th percentile (median) physical value."
    )
    percentile_99: float = Field(
        ...,
        description="99th percentile physical value for robust visual contrast scaling."
    )
    mean_value: float = Field(
        ...,
        description="Mean physical value across valid ocean samples."
    )
    std_dev_value: float = Field(
        ...,
        description="Standard deviation of valid ocean samples."
    )
    histogram_bin_edges: List[float] = Field(
        default_factory=list,
        description="List of N+1 bin edge values defining the histogram partition."
    )
    histogram_counts: List[int] = Field(
        default_factory=list,
        description="List of N sample counts per bin."
    )
    missing_sample_fraction: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Fraction of total voxels classified as missing, land, or QC-rejected [0.0, 1.0]."
    )


class CoordinateTransformContract(BaseModel):
    """
    Formal mapping contract between native source coordinates, WGS84 geographic,
    local East-North-Up (ENU), Volume Lab rendering space, and GPU texture coordinates.
    """
    source_coordinate_space: CoordinateSpace = Field(
        default=CoordinateSpace.GEOGRAPHIC_WGS84,
        description="Starting coordinate frame."
    )
    target_coordinate_space: CoordinateSpace = Field(
        default=CoordinateSpace.DISPLAY_VOLUME_LAB,
        description="Destination coordinate frame."
    )
    origin_longitude_deg: float = Field(
        ...,
        description="Center longitude of the volume rendering domain."
    )
    origin_latitude_deg: float = Field(
        ...,
        description="Center latitude of the volume rendering domain."
    )
    origin_depth_m: float = Field(
        default=0.0,
        description="Reference vertical depth in meters (positive down)."
    )
    scale_x_meters: float = Field(
        default=1.0,
        description="Scaling factor along X axis."
    )
    scale_y_meters: float = Field(
        default=1.0,
        description="Scaling factor along Y axis."
    )
    scale_z_meters: float = Field(
        default=1.0,
        description="Scaling factor along Z axis."
    )
    vertical_exaggeration_factor: float = Field(
        default=100.0,
        gt=0.0,
        description="Visual vertical exaggeration multiplier applied ONLY in display space."
    )
    uses_non_uniform_depth_lut: bool = Field(
        default=True,
        description="Whether non-uniform vertical z-levels require a 1D lookup texture/LUT."
    )
    depth_lut_entries_m: List[float] = Field(
        default_factory=list,
        description="Discrete vertical depth values in meters for non-uniform level lookup."
    )


class TransferFunctionControlPoint(BaseModel):
    """A single normalized control point on a 1D color/opacity transfer function."""
    normalized_position: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Position along normalized domain [0.0, 1.0]."
    )
    red: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized Red component [0.0, 1.0]."
    )
    green: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized Green component [0.0, 1.0]."
    )
    blue: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized Blue component [0.0, 1.0]."
    )
    opacity: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized Opacity/Alpha component [0.0, 1.0]."
    )


class TransferFunctionContract(BaseModel):
    """
    Contract defining scientific transfer function curves, colormaps, opacity mappings,
    and out-of-bounds/missing value policies.
    """
    colormap_preset_name: str = Field(
        ...,
        description="Standard ocean colormap preset name (e.g. 'cmocean_thermal', 'cmocean_haline', 'viridis', 'turbo')."
    )
    physical_domain_min: float = Field(
        ...,
        description="Physical quantity value corresponding to normalized position 0.0."
    )
    physical_domain_max: float = Field(
        ...,
        description="Physical quantity value corresponding to normalized position 1.0."
    )
    physical_units: str = Field(
        ...,
        description="Physical units of the transfer function domain (e.g. 'degree_Celsius', 'PSU')."
    )
    control_points: List[TransferFunctionControlPoint] = Field(
        ...,
        description="Ordered sequence of color and opacity control points."
    )
    out_of_range_policy: OutOfRangeRenderingPolicy = Field(
        default=OutOfRangeRenderingPolicy.DISCARD_TRANSPARENT,
        description="Visual behavior when physical values fall outside [min, max]."
    )
    missing_value_color_rgba: List[float] = Field(
        default=[0.0, 0.0, 0.0, 0.0],
        description="RGBA color assigned to missing, land, or QC-rejected samples."
    )

    @field_validator("physical_domain_max")
    @classmethod
    def validate_domain_span(cls, v: float, info) -> float:
        min_val = info.data.get("physical_domain_min")
        if min_val is not None and v <= min_val:
            raise ValueError(f"physical_domain_max ({v}) must be strictly greater than physical_domain_min ({min_val}).")
        return v

    @field_validator("missing_value_color_rgba")
    @classmethod
    def validate_rgba_vector(cls, v: List[float]) -> List[float]:
        if len(v) != 4:
            raise ValueError("missing_value_color_rgba must contain exactly 4 normalized floats [R, G, B, A].")
        for val in v:
            if not (0.0 <= val <= 1.0):
                raise ValueError(f"RGBA component values must be in [0.0, 1.0], got {val}")
        return v


class VisualizationProductContract(BaseModel):
    """
    Top-level authoritative contract for a derived 3D visualization product.
    Maintains complete lineage to immutable source assets, multiresolution LOD manifests,
    coordinate transformations, and backend compatibility profiles.
    """
    visualization_product_id: str = Field(
        ...,
        description="Unique product identifier (e.g. 'vis_copernicus_phy_thetao_arabian_sea_20250420')."
    )
    product_version: str = Field(
        default="1.0.0",
        description="Semantic version of the visual product."
    )
    source_dataset_id: str = Field(
        ...,
        description="Identifier of the authoritative source dataset."
    )
    source_variable_id: str = Field(
        ...,
        description="Canonical variable identifier visualized."
    )
    canonical_units: str = Field(
        ...,
        description="Authoritative scientific units of the underlying quantity."
    )
    source_asset_ids: List[str] = Field(
        ...,
        description="List of immutable NetCDF / Zarr source asset IDs used to generate this product."
    )
    source_asset_checksums: Dict[str, str] = Field(
        ...,
        description="SHA-256 checksums of source assets to guarantee lineage integrity."
    )
    processing_pipeline_version: str = Field(
        ...,
        description="Version string of the volume processing pipeline software."
    )
    backend_compatibility: BackendCompatibility = Field(
        default=BackendCompatibility.BOTH_SUPPORTED,
        description="Renderer backend support status."
    )
    spatial_bounds: SpatialBoundingBox = Field(
        ...,
        description="Geographic bounding box covering the entire visual volume."
    )
    min_depth_m: float = Field(
        ...,
        description="Surface or shallowest depth in meters."
    )
    max_depth_m: float = Field(
        ...,
        description="Deepest depth in meters."
    )
    timestep_count: int = Field(
        default=1,
        gt=0,
        description="Number of available time steps in this visual product."
    )
    available_lod_levels: List[MultiresolutionLevelContract] = Field(
        ...,
        description="Array of available Level-of-Detail manifests from LOD 0 (finest) to LOD N."
    )
    coordinate_transform: CoordinateTransformContract = Field(
        ...,
        description="Coordinate mapping specification from geographic/depth space to Volume Lab space."
    )
    render_statistics: RenderStatisticsContract = Field(
        ...,
        description="Global valid value ranges, percentiles, and histogram."
    )
    default_transfer_function: TransferFunctionContract = Field(
        ...,
        description="Default calibrated transfer function for this ocean variable."
    )
    brick_template_url: str = Field(
        ...,
        description="Relative URL template for fetching bricks (e.g. 'volumes/{prod_id}/lod{lod}/t{time}/b_{bx}_{by}_{bz}.bin')."
    )


class FirstVolumeSliceProfile(BaseModel):
    """
    Profile definition for the canonical First 3D Volume Rendering Slice
    as decided in TASK-02A (Copernicus PHY `thetao` and HYCOM `water_temp`).
    """
    profile_name: str = Field(
        ...,
        description="Name of first slice profile (e.g. 'copernicus_first_volume_slice_thetao')."
    )
    is_primary_selection: bool = Field(
        default=True,
        description="Whether this is the primary selected slice (Copernicus) or secondary benchmark (HYCOM)."
    )
    dataset_identifier: str = Field(
        ...,
        description="Dataset identifier (e.g. 'GLOBAL_ANALYSISFORECAST_PHY_001_024')."
    )
    target_variable: str = Field(
        ...,
        description="Canonical variable visualized (e.g. 'sea_water_potential_temperature')."
    )
    grid_dimensions: List[int] = Field(
        ...,
        description="[n_lon, n_lat, n_depth] logical grid dimensions (e.g. [97, 181, 31])."
    )
    z_levels_count: int = Field(
        ...,
        description="Number of standard vertical levels (e.g. 31)."
    )
    spatial_resolution_deg: float = Field(
        ...,
        description="Nominal horizontal grid spacing in degrees (e.g. 0.0833 for 1/12 deg)."
    )
    depth_extent_m: Tuple[float, float] = Field(
        ...,
        description="Tuple of (min_depth, max_depth) in meters (e.g. (0.494, 453.938) for 31 upper levels, or (0.494, 5727.9) for full 50-level ocean depth)."
    )
    physical_range_deg_c: Tuple[float, float] = Field(
        ...,
        description="Expected valid physical temperature range in degrees Celsius (e.g. (9.55, 31.85))."
    )
    recommended_texture_format: TextureSampleFormat = Field(
        default=TextureSampleFormat.R16_FLOAT,
        description="GPU texture format for raymarching."
    )
