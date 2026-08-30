/**
 * QuasarOS Authoritative Canonical Scientific Contracts
 * Auto-generated from Pydantic V2 canonical models. Do not edit manually.
 */

export type ChangeClassification = 'PATCH' | 'ADDITIVE' | 'BREAKING';

export interface SchemaVersionMetadata {
  schema_version: string;
  min_compatible_version: string;
  change_classification: ChangeClassification;
  schema_target: string;
}

export type DataClassDiscriminator =
  | 'model_volume'
  | 'wave_grid'
  | 'satellite_grid'
  | 'profile_observations'
  | 'trajectory_observations'
  | 'time_series_observations'
  | 'bathymetry_grid'
  | 'climatology_grid'
  | 'visualization_product'
  | 'derived_product';

export type ScientificRole =
  | 'model'
  | 'observation'
  | 'climatology'
  | 'bathymetry'
  | 'satellite'
  | 'derived'
  | 'rendering_acceleration'
  | 'test_fixture';

export type ProcessingLevel =
  | 'L0'
  | 'L1'
  | 'L2'
  | 'L3'
  | 'L4'
  | 'ANALYSIS_FORECAST'
  | 'REANALYSIS'
  | 'CLIMATOLOGY'
  | 'TERRAIN_MODEL'
  | 'DERIVED_DIAGNOSTIC';

export type OperationalStatus =
  | 'operational'
  | 'pre_operational'
  | 'research'
  | 'demonstration'
  | 'retired'
  | 'synthetic';

export type AccessRestriction =
  | 'open_unrestricted'
  | 'attribution_required'
  | 'non_commercial'
  | 'restricted_registration_required'
  | 'institutional_only';

export interface Citation {
  citation_text: string;
  doi?: string;
  bibtex?: string;
  url?: string;
}

export interface LicenceContract {
  licence_id: string;
  licence_name: string;
  terms_url: string;
  attribution_statement: string;
  access_restriction: AccessRestriction;
  commercial_use_allowed: boolean;
}

export type ValidationState =
  | 'valid'
  | 'valid_with_warnings'
  | 'invalid'
  | 'catalog_only'
  | 'discovery_only'
  | 'blocked';

export interface ValidationCheckResult {
  check_name: string;
  passed: boolean;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  timestamp_utc: string;
}

export interface ValidationReport {
  state: ValidationState;
  validator_version: string;
  validated_at_utc: string;
  checks: ValidationCheckResult[];
  readonly is_publication_ready: boolean;
}

export interface ProviderIdentity {
  provider_id: string;
  name: string;
  country: string;
  institution_url: string;
}

export interface DatasetIdentity {
  dataset_id: string;
  dataset_version: string;
  snapshot_id: string;
  title: string;
  description: string;
  provider: ProviderIdentity;
  product_id: string;
  scientific_role: ScientificRole;
  data_class: DataClassDiscriminator;
  processing_level: ProcessingLevel;
  operational_status: OperationalStatus;
  licence: LicenceContract;
  citations: Citation[];
  validation_report: ValidationReport;
}

export type AssetFormat =
  | 'netcdf4_classic'
  | 'netcdf4_enhanced'
  | 'netcdf3_64bit_offset'
  | 'netcdf3_classic'
  | 'parquet'
  | 'json_manifest'
  | 'zarr_v2'
  | 'zarr_v3'
  | 'geotiff'
  | 'dhi_dfsu'
  | 'dhi_dfs2';

export type ArtifactClassification =
  | 'raw_source'
  | 'intermediate_normalized'
  | 'canonical_zarr'
  | 'rendering_brick'
  | 'observation_index'
  | 'metadata_manifest';

export interface ImmutableSourceAsset {
  asset_id: string;
  dataset_id: string;
  provider_filename: string;
  local_relative_path: string;
  media_type: string;
  format: AssetFormat;
  artifact_classification: ArtifactClassification;
  size_bytes: number;
  sha256_checksum: string;
  retrieval_timestamp_utc: string;
  source_url?: string;
  is_immutable: boolean;
}

export interface SpatialBoundingBox {
  min_longitude: number;
  min_latitude: number;
  max_longitude: number;
  max_latitude: number;
}

export type GridType =
  | 'rectilinear'
  | 'curvilinear'
  | 'staggered'
  | 'unstructured'
  | 'point_collection'
  | 'trajectory';

export type StaggeringType =
  | 'none'
  | 'arakawa_a'
  | 'arakawa_b'
  | 'arakawa_c_rho'
  | 'arakawa_c_u'
  | 'arakawa_c_v'
  | 'arakawa_c_psi';

export interface HorizontalGridContract {
  grid_id: string;
  grid_type: GridType;
  crs: string;
  spatial_bounds: SpatialBoundingBox;
  resolution_x_deg?: number;
  resolution_y_deg?: number;
  resolution_description: string;
  shape: number[];
  dimension_names: string[];
  staggering: StaggeringType;
  is_periodic_longitude: boolean;
  node_count?: number;
  element_count?: number;
}

export type VerticalCoordinateType =
  | 'depth'
  | 'pressure'
  | 'height'
  | 'z_level'
  | 'sigma'
  | 'hybrid_sigma'
  | 'terrain_following_s_coordinate'
  | 'surface_only';

export interface ROMSSCoordinateParameters {
  Vtransform: 1 | 2;
  Vstretching: 1 | 2 | 4 | 5;
  theta_s: number;
  theta_b: number;
  hc: number;
  N: number;
  s_rho: number[];
  Cs_r: number[];
  s_w?: number[];
  Cs_w?: number[];
}

export interface VerticalCoordinateContract {
  coordinate_type: VerticalCoordinateType;
  units: string;
  positive_direction: 'down' | 'up';
  datum: 'mean_sea_level' | 'sea_surface' | 'geoid' | 'wgs84_ellipsoid';
  min_depth_m?: number;
  max_depth_m?: number;
  levels?: number[];
  level_count: number;
  is_uniform: boolean;
  is_time_varying: boolean;
  is_space_varying: boolean;
  roms_params?: ROMSSCoordinateParameters;
}

export type CalendarType =
  | 'gregorian'
  | 'standard'
  | 'proleptic_gregorian'
  | 'julian'
  | 'noleap'
  | '360_day'
  | 'all_leap';

export interface TimeSemanticsContract {
  calendar: CalendarType;
  reference_time_utc?: string;
  valid_time_utc: string;
  lead_time_seconds?: number;
  observation_time_utc?: string;
  climatology_period?: string;
  timestep_index: number;
  time_bounds_utc?: string[];
  source_time_string?: string;
}

export type PhysicalCellState =
  | 'valid'
  | 'missing'
  | 'masked'
  | 'outside_domain'
  | 'below_seafloor'
  | 'not_evaluated'
  | 'rejected_by_qc';

export interface PackingMetadata {
  scale_factor: number;
  add_offset: number;
  packed_data_type: string;
  unpacked_data_type: string;
}

export interface MissingValueContract {
  fill_value?: number;
  missing_value?: number;
  has_nan: boolean;
  valid_min?: number;
  valid_max?: number;
  stored_data_type?: string;
  is_fill_value_raw: boolean;
  diagnostics?: ScientificDiagnostic[];
}

export type PhysicalQuantity =
  | 'temperature'
  | 'practical_salinity'
  | 'absolute_salinity'
  | 'velocity_component'
  | 'velocity_vector'
  | 'speed'
  | 'surface_elevation'
  | 'wave_height'
  | 'wave_direction'
  | 'wave_period'
  | 'bathymetry_elevation'
  | 'dissolved_oxygen'
  | 'chlorophyll_concentration'
  | 'nitrate'
  | 'phosphate'
  | 'silicate'
  | 'density'
  | 'sound_speed'
  | 'mixed_layer_depth'
  | 'quality_flag'
  | 'dimensionless';

export type Topology =
  | 'volume_scalar'
  | 'volume_vector'
  | 'surface_scalar'
  | 'surface_vector'
  | 'terrain'
  | 'profile'
  | 'trajectory'
  | 'point_timeseries'
  | 'mesh'
  | 'mask'
  | 'uncertainty';

export type VectorConvention =
  | 'oceanographic_to'
  | 'meteorological_from'
  | 'none';

export interface DisplayRange {
  min_value: number;
  max_value: number;
  colormap: string;
  unit: string;
  scale: 'linear' | 'logarithmic' | 'diverging';
}

export interface CanonicalVariableContract {
  variable_id: string;
  canonical_name: string;
  source_name: string;
  standard_name: string;
  long_name: string;
  physical_quantity: PhysicalQuantity;
  canonical_units: string;
  source_units: string;
  topology: Topology;
  data_type: string;
  dimensions: string[];
  is_vector: boolean;
  vector_components?: string[];
  vector_convention: VectorConvention;
  reference_north?: string;
  packing?: PackingMetadata;
  missing_value_contract: MissingValueContract;
  display_range?: DisplayRange;
  qc_scheme?: string;
}

export interface DatasetCapabilitiesContract {
  can_volume_render_3d: boolean;
  can_surface_render_2d: boolean;
  can_render_vector_glyphs: boolean;
  can_render_streamlines: boolean;
  can_render_observation_profiles: boolean;
  can_render_observation_trajectories: boolean;
  can_render_bathymetry_terrain: boolean;
  can_exact_query: boolean;
  can_horizontal_slice: boolean;
  can_vertical_slice: boolean;
  can_extract_isosurface: boolean;
  can_collocate_with_profiles: boolean;
}

export interface LineageRecord {
  lineage_id: string;
  dataset_id: string;
  operation: string;
  software_name: string;
  software_version: string;
  source_asset_ids: string[];
  source_checksums: Record<string, string>;
  target_asset_ids: string[];
  parameters: Record<string, any>;
  operator: string;
  started_at_utc: string;
  completed_at_utc: string;
  validation_passed: boolean;
  comments?: string;
}

export interface CanonicalDatasetContract {
  schema_version_metadata: SchemaVersionMetadata;
  identity: DatasetIdentity;
  grid: HorizontalGridContract;
  vertical: VerticalCoordinateContract;
  time_semantics: TimeSemanticsContract;
  variables: Record<string, CanonicalVariableContract>;
  capabilities: DatasetCapabilitiesContract;
  source_assets: ImmutableSourceAsset[];
  provenance?: LineageRecord[];
  spatial_coverage_description: string;
  temporal_coverage_description: string;
}

// ----------------------------------------------------------------------------
// Specialized Model & Wave Contracts (TASK-02C)
// ----------------------------------------------------------------------------

export type ModelClass =
  | 'ROMS'
  | 'HYCOM'
  | 'MOM'
  | 'NEMO'
  | 'WW3'
  | 'WAM'
  | 'MIKE21'
  | 'unspecified';

export type ModelRunType =
  | 'forecast'
  | 'reanalysis'
  | 'hindcast'
  | 'analysis'
  | 'climatology';

export type HYCOMVerticalRepresentation =
  | 'served_z_level'
  | 'native_hybrid'
  | 'surface_2d';

export interface ModelMaskContract {
  has_land_mask: boolean;
  has_dynamic_wetting_drying: boolean;
  mask_variable_name?: string;
  land_value: number;
  sea_value: number;
  wet_dry_threshold_meters?: number;
}

export interface ForecastCycleContract {
  model_class: ModelClass;
  run_type: ModelRunType;
  cycle_reference_time_utc: string;
  valid_time_utc: string;
  lead_time_hours: number;
  forecast_horizon_hours?: number;
  assimilation_method?: string;
  ensemble_member_id?: string;
}

export interface HYCOMModelContract {
  vertical_representation: HYCOMVerticalRepresentation;
  experiment_id: string;
  native_layer_count: number;
  served_depth_levels_count?: number;
  surface_salinity_reference: number;
  uses_fast_thermodynamics: boolean;
}

export interface OceanHydrodynamicModelContract {
  model_name: string;
  model_class: ModelClass;
  operational_status: OperationalStatus;
  forecast_cycle?: ForecastCycleContract;
  hycom_metadata?: HYCOMModelContract;
  mask_contract?: ModelMaskContract;
  atmospheric_forcing_source?: string;
  tidal_forcing_included: boolean;
  bathymetry_source?: string;
}

export type WavePartitionType =
  | 'total_sea'
  | 'wind_sea'
  | 'primary_swell'
  | 'secondary_swell'
  | 'tertiary_swell'
  | 'infragravity';

export type WaveSpectralModel =
  | 'WW3'
  | 'WAM'
  | 'SWAN'
  | 'MIKE21_SW'
  | 'unspecified';

export interface WavePartitionContract {
  partition_type: WavePartitionType;
  partition_index: number;
  significant_wave_height_var: string;
  peak_or_mean_period_var: string;
  direction_var: string;
  directional_spreading_var?: string;
  directional_convention: VectorConvention;
}

export interface StokesDriftContract {
  u_stokes_var: string;
  v_stokes_var: string;
  w_stokes_var?: string;
  is_surface_only: boolean;
  depth_decay_scale_m?: number;
}

export interface OceanWaveProductContract {
  wave_model: WaveSpectralModel;
  significant_wave_height_total: string;
  peak_period_total?: string;
  mean_period_total?: string;
  mean_direction_total?: string;
  directional_convention: VectorConvention;
  spectral_frequencies_count?: number;
  spectral_directions_count?: number;
  partitions: WavePartitionContract[];
  stokes_drift?: StokesDriftContract;
}

export type VectorReferenceFrame =
  | 'earth_relative'
  | 'grid_relative'
  | 'instrument_relative';

export type VectorGroupType =
  | 'ocean_velocity_3d'
  | 'ocean_surface_velocity_2d'
  | 'wind_stress_2d'
  | 'stokes_drift_3d'
  | 'stokes_drift_2d'
  | 'wave_propagation_vector';

export interface RotationMetadata {
  angle_variable_name: string;
  angle_units: 'radians' | 'degrees';
  source_reference_frame: VectorReferenceFrame;
  target_reference_frame: VectorReferenceFrame;
}

export interface VectorGroupContract {
  group_id: string;
  group_type: VectorGroupType;
  u_component_var: string;
  v_component_var: string;
  w_component_var?: string;
  magnitude_var?: string;
  direction_var?: string;
  reference_frame: VectorReferenceFrame;
  directional_convention: VectorConvention;
  rotation_metadata?: RotationMetadata;
}

export interface CurvilinearGridContract {
  grid_id: string;
  eta_dimension_name: string;
  xi_dimension_name: string;
  eta_size: number;
  xi_size: number;
  lon_variable_name: string;
  lat_variable_name: string;
  angle_variable_name?: string;
  spatial_bounds: SpatialBoundingBox;
  has_curvilinear_metrics: boolean;
  pm_variable_name?: string;
  pn_variable_name?: string;
}

export interface ArakawaStaggeringContract {
  staggering_type: StaggeringType;
  rho_grid_name: string;
  u_grid_name?: string;
  v_grid_name?: string;
  psi_grid_name?: string;
  u_offset_xi: number;
  u_offset_eta: number;
  v_offset_xi: number;
  v_offset_eta: number;
  psi_offset_xi: number;
  psi_offset_eta: number;
}

export interface GridMetricsContract {
  dx_min_meters: number;
  dx_max_meters: number;
  dy_min_meters: number;
  dy_max_meters: number;
  coriolis_parameter_variable?: string;
}

export interface ROMSFormulaTerms {
  s: string;
  eta: string;
  depth: string;
  a?: string;
  b?: string;
  depth_c?: string;
}

export interface ROMSSCoordinateContract {
  Vtransform: 1 | 2;
  Vstretching: 1 | 2 | 4 | 5;
  theta_s: number;
  theta_b: number;
  hc: number;
  N: number;
  s_rho: number[];
  Cs_r: number[];
  s_w?: number[];
  Cs_w?: number[];
  formula_terms?: ROMSFormulaTerms;
}

// ----------------------------------------------------------------------------
// Specialized Observation Contracts (TASK-02D)
// ----------------------------------------------------------------------------

export type PlatformType =
  | 'argo_float'
  | 'bgc_argo_float'
  | 'underwater_glider'
  | 'moored_buoy'
  | 'drifting_buoy'
  | 'research_vessel'
  | 'coastal_station'
  | 'autonomous_surface_vehicle'
  | 'animal_borne_sensor'
  | 'submersible'
  | 'custom';

export interface SensorMetadata {
  sensor_id: string;
  sensor_model: string;
  sensor_maker?: string;
  measured_variables: string[];
  calibration_date?: string;
  serial_number?: string;
}

export interface PlatformMetadataContract {
  platform_id: string;
  platform_type: PlatformType;
  wmo_id?: string;
  platform_code?: string;
  institution: string;
  institution_country?: string;
  pi_name?: string;
  project_name?: string;
  telemetry_type?: string;
  deployment_date_utc?: string;
  deployment_latitude?: number;
  deployment_longitude?: number;
  sensors: SensorMetadata[];
  is_active: boolean;
}

export type ProfileDirection = 'A' | 'D' | 'S';
export type DataMode = 'R' | 'A' | 'D';
export type ProfileQCGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'NOT_RATED';

export interface VariableQCRecord {
  variable_name: string;
  qc_scheme: string;
  profile_qc_flag?: number;
  level_qc_flags: number[];
  good_levels_count: number;
  total_levels_count: number;
  is_valid_for_collocation: boolean;
}

export interface ObservationQCReport {
  qc_scheme: string;
  position_qc_flag: number;
  position_qc_state: string;
  time_qc_flag: number;
  time_qc_state: string;
  profile_grade: ProfileQCGrade;
  variable_qc: Record<string, VariableQCRecord>;
  qartod_tests_executed: string[];
  is_fully_certified: boolean;
}

export interface ProfileVariableEntry {
  canonical_variable_id: string;
  raw_variable_name: string;
  adjusted_variable_name?: string;
  error_variable_name?: string;
  qc_variable_name?: string;
  units: string;
  data_mode: DataMode;
  levels_count: number;
  min_pressure_dbar?: number;
  max_pressure_dbar?: number;
  has_adjusted_values: boolean;
}

export interface ProfileCastContract {
  profile_id: string;
  platform_id: string;
  platform_type: PlatformType;
  wmo_id?: string;
  cycle_number: number;
  direction: ProfileDirection;
  data_mode: DataMode;
  observation_time_utc: string;
  latitude: number;
  longitude: number;
  position_qc: number;
  time_qc: number;
  max_depth_m?: number;
  max_pressure_dbar?: number;
  level_count: number;
  variables: Record<string, ProfileVariableEntry>;
  qc_report?: ObservationQCReport;
  is_bgc: boolean;
}

export type TrajectoryPhase =
  | 'surface_drift'
  | 'dive'
  | 'climb'
  | 'apogee'
  | 'inflection'
  | 'unknown';

export interface TrajectoryWaypoint {
  timestamp_utc: string;
  latitude: number;
  longitude: number;
  depth_m?: number;
  pressure_dbar?: number;
  phase: TrajectoryPhase;
  dive_number?: number;
}

export interface DiveSegment {
  dive_id: string;
  dive_number: number;
  direction: ProfileDirection;
  start_time_utc: string;
  end_time_utc: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  max_depth_m: number;
  sample_count: number;
  associated_profile_id?: string;
}

export interface TrajectoryContract {
  trajectory_id: string;
  platform_id: string;
  platform_type: PlatformType;
  mission_name: string;
  start_time_utc: string;
  end_time_utc: string;
  min_latitude: number;
  max_latitude: number;
  min_longitude: number;
  max_longitude: number;
  total_waypoints_count: number;
  dive_segments: DiveSegment[];
  variables_measured: string[];
}

export type DuplicateRelationshipType =
  | 'exact_mirror'
  | 'provider_mirror'
  | 'probable_duplicate'
  | 'same_platform_different_processing'
  | 'raw_and_adjusted_pair'
  | 'distinct_observation';

export type DeduplicationResolution =
  | 'prefer_primary'
  | 'prefer_secondary'
  | 'merge_provenance'
  | 'reject_duplicate'
  | 'retain_both';

export interface DuplicateRelationshipContract {
  relationship_id: string;
  primary_record_id: string;
  secondary_record_id: string;
  relationship_type: DuplicateRelationshipType;
  spatial_distance_km: number;
  time_delta_seconds: number;
  confidence_score: number;
  recommended_resolution: DeduplicationResolution;
  resolution_rationale: string;
  matching_criteria: string[];
}

export type CollocationBlockingReason =
  | 'OUTSIDE_SPATIAL_BOUNDS'
  | 'OUTSIDE_TEMPORAL_BOUNDS'
  | 'INCOMPATIBLE_VERTICAL_DATUM'
  | 'INCOMPATIBLE_PHYSICAL_QUANTITY'
  | 'UNIT_CONVERSION_BLOCKED'
  | 'FAILED_OBSERVATION_QC'
  | 'MISSING_MODEL_GRID_INFORMATION'
  | 'LAND_MASK_OCCLUSION'
  | 'EXCEEDS_MAX_TIME_WINDOW'
  | 'EXCEEDS_MAX_SPATIAL_RADIUS'
  | 'NO_BLOCKING_REASON';

export interface CollocationReadinessContract {
  collocation_id: string;
  observation_id: string;
  model_dataset_id: string;
  observation_variable: string;
  model_variable: string;
  is_collocation_ready: boolean;
  blocking_reasons: CollocationBlockingReason[];
  spatial_distance_to_model_domain_km: number;
  temporal_offset_seconds: number;
  max_allowed_time_window_seconds: number;
  max_allowed_spatial_radius_km: number;
  unit_conversion_required: boolean;
  qc_passed: boolean;
  notes?: string;
}

// ----------------------------------------------------------------------------
// Visualization & Exact-Value Contracts (TASK-02E)
// ----------------------------------------------------------------------------

export type VolumeRenderingBackend = 'webgpu_wgsl' | 'webgl2_glsl';
export type BackendCompatibility = 'webgpu_recommended' | 'webgl2_fallback' | 'both_supported';
export type CompressionCodec = 'raw' | 'zstd' | 'blosc' | 'lz4';
export type TextureSampleFormat =
  | 'r16float'
  | 'r32float'
  | 'rgba8unorm'
  | 'r8unorm'
  | 'r16unorm'
  | 'r16uint';

export type AggregationMethod =
  | 'average_2x2x2'
  | 'subsample_stride_2'
  | 'area_weighted_average'
  | 'max_magnitude'
  | 'median';

export type InterpolationPolicy =
  | 'nearest_neighbor'
  | 'trilinear'
  | 'bilinear_horizontal_nearest_vertical'
  | 'cubic_spline'
  | 'disallowed_discrete';

export type OutOfRangeRenderingPolicy =
  | 'clamp_to_edge_color'
  | 'discard_transparent'
  | 'render_alert_color';

export type CoordinateSpace =
  | 'native_grid_indices'
  | 'geographic_wgs84'
  | 'local_enu'
  | 'normalized_texture_coordinates'
  | 'brick_local_sample_space'
  | 'display_volume_lab';

export interface QuantizationContract {
  scale_factor: number;
  add_offset: number;
  quantized_data_type: string;
  unquantized_data_type: string;
  reserved_missing_code?: number;
  theoretical_max_quantization_error: number;
  is_eligible_for_exact_query: boolean;
}

export interface BrickIdentityContract {
  visualization_product_id: string;
  product_version: string;
  lod_level: number;
  timestep_index: number;
  brick_index_x: number;
  brick_index_y: number;
  brick_index_z: number;
  variable_id: string;
}

export interface BrickGeometryContract {
  brick_key: string;
  sample_origin: number[];
  sample_shape: number[];
  interior_valid_shape: number[];
  halo_padding: number[];
  spatial_bounds: SpatialBoundingBox;
  min_depth_m: number;
  max_depth_m: number;
  min_value?: number;
  max_value?: number;
  is_empty_or_masked: boolean;
  payload_sha256: string;
}

export interface BrickPayloadContract {
  brick_key: string;
  storage_object_key: string;
  compression_codec: CompressionCodec;
  sample_format: TextureSampleFormat;
  uncompressed_bytes_length: number;
  compressed_bytes_length: number;
  sha256_checksum: string;
  quantization?: QuantizationContract;
}

export interface MultiresolutionLevelContract {
  lod_level: number;
  grid_shape: number[];
  brick_shape: number[];
  brick_grid_shape: number[];
  total_brick_count: number;
  aggregation_method: AggregationMethod;
  sample_data_type: string;
  voxel_resolution_x_deg: number;
  voxel_resolution_y_deg: number;
}

export interface RenderStatisticsContract {
  valid_min: number;
  valid_max: number;
  percentile_01: number;
  percentile_50: number;
  percentile_99: number;
  mean_value: number;
  std_dev_value: number;
  histogram_bin_edges: number[];
  histogram_counts: number[];
  missing_sample_fraction: number;
}

export interface CoordinateTransformContract {
  source_coordinate_space: CoordinateSpace;
  target_coordinate_space: CoordinateSpace;
  origin_longitude_deg: number;
  origin_latitude_deg: number;
  origin_depth_m: number;
  scale_x_meters: number;
  scale_y_meters: number;
  scale_z_meters: number;
  vertical_exaggeration_factor: number;
  uses_non_uniform_depth_lut: boolean;
  depth_lut_entries_m: number[];
}

export interface TransferFunctionControlPoint {
  normalized_position: number;
  red: number;
  green: number;
  blue: number;
  opacity: number;
}

export interface TransferFunctionContract {
  colormap_preset_name: string;
  physical_domain_min: number;
  physical_domain_max: number;
  physical_units: string;
  control_points: TransferFunctionControlPoint[];
  out_of_range_policy: OutOfRangeRenderingPolicy;
  missing_value_color_rgba: number[];
}

export interface VisualizationProductContract {
  visualization_product_id: string;
  product_version: string;
  source_dataset_id: string;
  source_variable_id: string;
  canonical_units: string;
  source_asset_ids: string[];
  source_asset_checksums: Record<string, string>;
  processing_pipeline_version: string;
  backend_compatibility: BackendCompatibility;
  spatial_bounds: SpatialBoundingBox;
  min_depth_m: number;
  max_depth_m: number;
  timestep_count: number;
  available_lod_levels: MultiresolutionLevelContract[];
  coordinate_transform: CoordinateTransformContract;
  render_statistics: RenderStatisticsContract;
  default_transfer_function: TransferFunctionContract;
  brick_template_url: string;
}

export interface FirstVolumeSliceProfile {
  profile_name: string;
  is_primary_selection: boolean;
  dataset_identifier: string;
  target_variable: string;
  grid_dimensions: number[];
  z_levels_count: number;
  spatial_resolution_deg: number;
  depth_extent_m: [number, number];
  physical_range_deg_c: [number, number];
  recommended_texture_format: TextureSampleFormat;
}

export type SelectionMethod =
  | 'nearest_native_sample'
  | 'exact_grid_index'
  | 'trilinear_interpolation'
  | 'bilinear_horizontal_nearest_vertical'
  | 'native_level_horizontal_interpolation';

export type VerticalSelectorType =
  | 'physical_depth_meters'
  | 'pressure_dbar'
  | 'grid_level_index'
  | 'sea_surface'
  | 'sea_floor';

export type TimeSelectorMode =
  | 'exact_utc_timestamp'
  | 'nearest_available_timestep'
  | 'forecast_reference_and_lead';

export interface SelectionInterpolationContract {
  method: SelectionMethod;
  allows_extrapolation: boolean;
  max_horizontal_extrapolation_deg: number;
  max_vertical_extrapolation_m: number;
  interpolation_weights_provenance?: Record<string, number>;
}

export interface ProvisionalRenderPickResponse {
  response_type: 'approximate_render_sample';
  visualization_product_id: string;
  lod_level: number;
  approximate_value: number;
  display_units: string;
  world_ray_hit_position: number[];
  estimated_sample_error_bound: number;
  approximation_notice: string;
}

export interface ExactValueQueryRequest {
  dataset_id: string;
  dataset_version?: string;
  snapshot_id?: string;
  variable_id: string;
  latitude_deg: number;
  longitude_deg: number;
  vertical_selector_type: VerticalSelectorType;
  vertical_target_value?: number;
  time_selector_mode: TimeSelectorMode;
  target_time_utc?: string;
  forecast_lead_time_seconds?: number;
  selection_interpolation: SelectionInterpolationContract;
  requested_units?: string;
}

export interface ExactValueQueryResponse {
  response_type: 'authoritative_scientific_value';
  dataset_id: string;
  variable_id: string;
  scientific_value?: number;
  canonical_units: string;
  value_state: PhysicalCellState;
  requested_latitude_deg: number;
  requested_longitude_deg: number;
  resolved_latitude_deg: number;
  resolved_longitude_deg: number;
  resolved_depth_m?: number;
  resolved_time_utc: string;
  grid_index_evaluated?: number[];
  selection_method_used: SelectionMethod;
  source_asset_id: string;
  source_asset_sha256: string;
  provenance_details?: Record<string, any>;
}

export interface StreamingChunkRequest {
  visualization_product_id: string;
  lod_level: number;
  timestep_index: number;
  requested_brick_keys: string[];
  priority: number;
}

export interface StreamingManifestEntry {
  brick_key: string;
  storage_object_url: string;
  byte_offset?: number;
  byte_length: number;
  sha256_checksum: string;
  is_empty: boolean;
}

export interface MultiBrickStreamingResponse {
  visualization_product_id: string;
  lod_level: number;
  timestep_index: number;
  manifest_entries: StreamingManifestEntry[];
  total_payload_bytes: number;
}
