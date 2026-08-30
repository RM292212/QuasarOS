/**
 * Comprehensive Automated Test Suite for QuasarOS Typed Browser API Client.
 *
 * Tests:
 * - Health and system capability discovery
 * - Catalog querying and active snapshot resolution
 * - Immutable snapshot pinning and silent mutation prevention
 * - Visualization product render manifest retrieval and brick URL formatting
 * - Authoritative point query (POST /api/v1/queries/value)
 * - Vertical profile column query (POST /api/v1/queries/profile)
 * - Provisional GPU pick reconciliation (POST /api/v1/queries/reconcile-pick)
 * - Error model conformance (404, 400, 422 parsing)
 * - AbortSignal network cancellation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  QuasarClient,
  QuasarCatalogClient,
  QuasarQueryClient,
  SnapshotPinner,
  QuasarApiError,
  SnapshotMutationError,
  NetworkAbortError,
} from '../src/index.ts';
import type {
  CatalogOverview,
  ExactValueQueryRequest,
  ReconcilePickRequest,
  VerticalProfileQueryRequest,
} from '../src/types.ts';

// Sample fixture data conforming to active baseline
const MOCK_BASELINE = {
  datasetId: 'copernicus_phy_thetao',
  snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
  visProductId: 'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087',
  productVersion: 'v1',
  sourceSha256: 'ca826087094254f15d861f678ef4036a43f885e33d3215beab4e68e4ee0cecd7',
  variableId: 'sea_water_potential_temperature',
};

const MOCK_CATALOG: CatalogOverview = {
  totalDatasets: 1,
  datasets: [
    {
      datasetId: MOCK_BASELINE.datasetId,
      title: 'Copernicus Global Ocean Physics Analysis and Forecast (thetao)',
      provider: 'Copernicus Marine Service (CMEMS)',
      scientificRole: 'model',
      dataClass: 'model_volume',
      activeSnapshotId: MOCK_BASELINE.snapshotId,
      availableSnapshotsCount: 2,
      temporalRange: {
        start: '2026-08-24T00:00:00Z',
        end: '2026-08-30T00:00:00Z',
      },
      variables: ['sea_water_potential_temperature'],
      canVolumeRender3d: true,
      canExactQuery: true,
    },
  ],
  activeSnapshots: [
    {
      snapshotId: MOCK_BASELINE.snapshotId,
      datasetId: MOCK_BASELINE.datasetId,
      temporalClassification: 'OPERATIONAL_CURRENT_SNAPSHOT',
      startDate: '2026-08-24',
      endDate: '2026-08-30',
      latestValidTime: '2026-08-30T00:00:00Z',
      shape: [7, 31, 201, 201],
      temperatureRangeDegC: [-2.0, 35.0],
      sourceSha256: MOCK_BASELINE.sourceSha256,
      rawNcPath: 'data/raw/copernicus/copernicus-phy-thetao-20260824-20260830.nc',
      canonicalZarrPath: 'data/canonical/copernicus_phy_thetao/copernicus-phy-thetao-20260824-20260830-ca826087.zarr',
      visualizationProductId: MOCK_BASELINE.visProductId,
      isEligibleForExactQuery: true,
      immutable: true,
    },
  ],
  historicalSnapshots: [],
};

// Create a simulated fetch router for unit testing browser client
function createMockFetch() {
  return async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(urlStr);
    const pathname = url.pathname;
    const method = init?.method ?? 'GET';

    // Check abort signal
    if (init?.signal?.aborted) {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }

    // Delayed abort simulation support
    if (pathname === '/api/v1/slow-endpoint') {
      return new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Should have been aborted'));
        }, 1000);

        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timeout);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }

    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Request-ID': 'test-request-id-1234',
    });

    // Health
    if (pathname === '/health/live') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'quasar-catalog-service',
          version: '1.0.0',
          activeSnapshotsCount: 1,
          historicalSnapshotsCount: 0,
          visualizationProductsCount: 1,
          integrityVerified: true,
        }),
        { status: 200, headers }
      );
    }

    if (pathname === '/health/ready') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'quasar-catalog-service',
          version: '1.0.0',
          activeSnapshotsCount: 1,
          historicalSnapshotsCount: 0,
          visualizationProductsCount: 1,
          integrityVerified: true,
        }),
        { status: 200, headers }
      );
    }

    // Catalog & Capabilities
    if (pathname === '/api/v1/catalog') {
      return new Response(
        JSON.stringify({
          data: MOCK_CATALOG,
          meta: {
            requestId: 'test-catalog-req',
            schemaVersion: '1.0.0',
            timestampUtc: '2026-08-30T12:00:00Z',
          },
        }),
        { status: 200, headers }
      );
    }

    if (pathname === '/api/v1/capabilities') {
      return new Response(
        JSON.stringify({
          data: {
            serverVersion: '1.0.0',
            supportedRenderingBackends: ['webgpu_wgsl', 'webgl2_glsl'],
            supportedCoordinateSpaces: ['geographic_wgs84', 'local_enu', 'display_volume_lab', 'native_grid_indices'],
            supportedSelectionMethods: ['nearest_native_sample', 'exact_grid_index', 'trilinear_interpolation'],
            exactQueryPrecision: 'float32/float64',
            gpuVisualizationPrecision: 'r16float / r16uint',
            resourceLimits: {
              maxQueryPoints: 1000,
              maxProfileLevels: 200,
              maxStreamingChunks: 64,
              maxBrickLodLevel: 2,
            },
          },
          meta: { requestId: 'test-caps-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    // Datasets
    if (pathname === `/api/v1/datasets/${MOCK_BASELINE.datasetId}`) {
      return new Response(
        JSON.stringify({
          data: {
            schema_version_metadata: {
              schema_version: '1.0.0',
              min_compatible_version: '1.0.0',
              change_classification: 'PATCH',
              schema_target: 'canonical_dataset',
            },
            identity: {
              dataset_id: MOCK_BASELINE.datasetId,
              dataset_version: '1.0.0',
              snapshot_id: MOCK_BASELINE.snapshotId,
              title: 'Copernicus Global Ocean Physics',
              description: 'Ocean physics dataset',
              provider: { provider_id: 'cmems', name: 'Copernicus', country: 'EU', institution_url: 'https://marine.copernicus.eu' },
              product_id: 'GLOBAL_ANALYSISFORECAST_PHY_001_024',
              scientific_role: 'model',
              data_class: 'model_volume',
              processing_level: 'ANALYSIS_FORECAST',
              operational_status: 'operational',
              licence: { licence_id: 'cmems-standard', licence_name: 'Copernicus Open Licence', terms_url: 'https://marine.copernicus.eu', attribution_statement: 'CMEMS', access_restriction: 'open_unrestricted', commercial_use_allowed: true },
              citations: [],
              validation_report: { state: 'valid', validator_version: '1.0.0', validated_at_utc: '2026-08-30T00:00:00Z', checks: [], is_publication_ready: true },
            },
            grid: {
              grid_id: 'grid_cmems_025',
              grid_type: 'rectilinear',
              crs: 'EPSG:4326',
              spatial_bounds: { min_longitude: -80, min_latitude: 20, max_longitude: -60, max_latitude: 40 },
              resolution_description: '0.083 deg',
              shape: [201, 201],
              dimension_names: ['latitude', 'longitude'],
              staggering: 'none',
              is_periodic_longitude: false,
            },
            vertical: {
              coordinate_type: 'depth',
              units: 'm',
              positive_direction: 'down',
              datum: 'mean_sea_level',
              level_count: 31,
              is_uniform: false,
              is_time_varying: false,
              is_space_varying: false,
            },
            time_semantics: {
              calendar: 'gregorian',
              valid_time_utc: '2026-08-30T00:00:00Z',
              timestep_index: 6,
            },
            variables: {},
            capabilities: {
              can_volume_render_3d: true,
              can_surface_render_2d: true,
              can_render_vector_glyphs: false,
              can_render_streamlines: false,
              can_render_observation_profiles: true,
              can_render_observation_trajectories: false,
              can_render_bathymetry_terrain: true,
              can_exact_query: true,
              can_horizontal_slice: true,
              can_vertical_slice: true,
              can_extract_isosurface: true,
              can_collocate_with_profiles: true,
            },
            source_assets: [],
            spatial_coverage_description: 'Northwest Atlantic',
            temporal_coverage_description: '7-day daily mean',
          },
          meta: { requestId: 'test-dataset-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    // Dataset snapshots
    if (pathname === `/api/v1/datasets/${MOCK_BASELINE.datasetId}/snapshots`) {
      return new Response(
        JSON.stringify({
          data: MOCK_CATALOG.activeSnapshots,
          meta: { requestId: 'test-snapshots-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    if (pathname === `/api/v1/datasets/${MOCK_BASELINE.datasetId}/snapshots/${MOCK_BASELINE.snapshotId}`) {
      return new Response(
        JSON.stringify({
          data: MOCK_CATALOG.activeSnapshots[0],
          meta: { requestId: 'test-snapshot-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    // Visualization products & Render manifests
    if (
      pathname === `/api/v1/visualization-products/${MOCK_BASELINE.visProductId}` ||
      pathname === `/api/v1/render-manifests/${MOCK_BASELINE.visProductId}`
    ) {
      return new Response(
        JSON.stringify({
          data: {
            visualizationProduct: {
              visualization_product_id: MOCK_BASELINE.visProductId,
              product_version: 'v1',
              source_dataset_id: MOCK_BASELINE.datasetId,
              source_variable_id: MOCK_BASELINE.variableId,
              canonical_units: 'degC',
              source_asset_ids: ['asset_copernicus_nc'],
              source_asset_checksums: { asset_copernicus_nc: MOCK_BASELINE.sourceSha256 },
              processing_pipeline_version: '1.0.0',
              backend_compatibility: 'both_supported',
              spatial_bounds: { min_longitude: -80, min_latitude: 20, max_longitude: -60, max_latitude: 40 },
              min_depth_m: 0.0,
              max_depth_m: 5500.0,
              timestep_count: 7,
              available_lod_levels: [
                {
                  lod_level: 0,
                  grid_shape: [31, 201, 201],
                  brick_shape: [64, 64, 64],
                  brick_grid_shape: [1, 4, 4],
                  total_brick_count: 16,
                  aggregation_method: 'average_2x2x2',
                  sample_data_type: 'f16',
                  voxel_resolution_x_deg: 0.083,
                  voxel_resolution_y_deg: 0.083,
                },
              ],
              coordinate_transform: {
                source_coordinate_space: 'geographic_wgs84',
                target_coordinate_space: 'local_enu',
                origin_longitude_deg: -70.0,
                origin_latitude_deg: 30.0,
                origin_depth_m: 0.0,
                scale_x_meters: 1.0,
                scale_y_meters: 1.0,
                scale_z_meters: 1.0,
                vertical_exaggeration_factor: 100.0,
                uses_non_uniform_depth_lut: true,
                depth_lut_entries_m: [0, 5, 10, 20, 50, 100, 500, 1000, 5000],
              },
              render_statistics: {
                valid_min: 2.15,
                valid_max: 29.84,
                percentile_01: 3.1,
                percentile_50: 18.2,
                percentile_99: 28.5,
                mean_value: 17.8,
                std_dev_value: 6.4,
                histogram_bin_edges: [0, 10, 20, 30],
                histogram_counts: [100, 500, 400],
                missing_sample_fraction: 0.12,
              },
              default_transfer_function: {
                colormap_preset_name: 'cividis',
                physical_domain_min: 2.0,
                physical_domain_max: 30.0,
                physical_units: 'degC',
                control_points: [],
                out_of_range_policy: 'clamp_to_edge_color',
                missing_value_color_rgba: [0, 0, 0, 0],
              },
              brick_template_url: '/api/v1/visualization-products/{productId}/bricks/{brickKey}/payloads/{representation}',
            },
            totalBricks: 63,
            storageSummary: { totalCompressedBytes: 13342000, totalMiB: 12.724 },
            isEligibleForExactQuery: false,
            brickInventoryCount: 63,
            manifestPath: 'data/visualization/copernicus_phy_thetao/manifest.json',
          },
          meta: { requestId: 'test-render-manifest-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    if (pathname === '/api/v1/visualization-products') {
      return new Response(
        JSON.stringify({
          data: [
            {
              visualizationProductId: MOCK_BASELINE.visProductId,
              productVersion: 'v1',
              sourceDatasetId: MOCK_BASELINE.datasetId,
              sourceVariableId: MOCK_BASELINE.variableId,
              canonicalUnits: 'degC',
              totalBricks: 63,
              lodLevelsCount: 3,
              storageBytes: 13342000,
              storageMib: 12.724,
              isEligibleForExactQuery: false,
              manifestSha256: 'manifest_sha256_mock',
            },
          ],
          meta: { requestId: 'test-vis-list-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    // Queries: Point query (POST /api/v1/queries/value)
    if (pathname === '/api/v1/queries/value' && method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}') as ExactValueQueryRequest;
      return new Response(
        JSON.stringify({
          data: {
            response_type: 'authoritative_scientific_value',
            dataset_id: body.dataset_id,
            variable_id: body.variable_id,
            scientific_value: 24.87654,
            canonical_units: 'degC',
            value_state: 'valid',
            requested_latitude_deg: body.latitude_deg,
            requested_longitude_deg: body.longitude_deg,
            resolved_latitude_deg: 25.0,
            resolved_longitude_deg: -70.0,
            resolved_depth_m: 10.0,
            resolved_time_utc: '2026-08-30T00:00:00Z',
            grid_index_evaluated: [6, 2, 60, 120],
            selection_method_used: 'nearest_native_sample',
            source_asset_id: 'copernicus_phy_thetao_nc',
            source_asset_sha256: MOCK_BASELINE.sourceSha256,
            provenance_details: { provider: 'CMEMS' },
          },
          meta: { requestId: 'test-exact-query-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    // Queries: Vertical Profile Query (POST /api/v1/queries/profile)
    if (pathname === '/api/v1/queries/profile' && method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}') as VerticalProfileQueryRequest;
      const samples = [
        { level_index: 0, depth_m: 0.0, scientific_value: 28.5, value_state: 'valid' },
        { level_index: 1, depth_m: 10.0, scientific_value: 26.2, value_state: 'valid' },
        { level_index: 2, depth_m: 50.0, scientific_value: 20.1, value_state: 'valid' },
        { level_index: 3, depth_m: 100.0, scientific_value: 15.4, value_state: 'valid' },
        { level_index: 4, depth_m: 500.0, scientific_value: 7.2, value_state: 'valid' },
        { level_index: 5, depth_m: 1000.0, scientific_value: 4.1, value_state: 'valid' },
        { level_index: 6, depth_m: 5000.0, scientific_value: 2.3, value_state: 'valid' },
      ];
      return new Response(
        JSON.stringify({
          data: {
            response_type: 'authoritative_vertical_profile',
            dataset_id: body.dataset_id,
            variable_id: body.variable_id,
            canonical_units: 'degC',
            requested_latitude_deg: body.latitude_deg,
            requested_longitude_deg: body.longitude_deg,
            resolved_latitude_deg: 25.0,
            resolved_longitude_deg: -70.0,
            horizontal_distance_delta_km: 2.14,
            resolved_time_utc: '2026-08-30T00:00:00Z',
            grid_index_evaluated: [6, 60, 120],
            selection_method_used: 'nearest_native_sample',
            total_levels: 7,
            valid_levels_count: 7,
            samples,
            source_asset_id: 'copernicus_phy_thetao_nc',
            source_asset_sha256: MOCK_BASELINE.sourceSha256,
            provenance_details: { levels_profile: 'full_column' },
          },
          meta: { requestId: 'test-profile-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    // Queries: Reconcile Pick (POST /api/v1/queries/reconcile-pick)
    if (pathname === '/api/v1/queries/reconcile-pick' && method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}') as ReconcilePickRequest;
      return new Response(
        JSON.stringify({
          data: {
            response_type: 'authoritative_reconciled_pick',
            provisional_value: body.provisional_pick.approximate_value,
            provisional_lod_level: body.provisional_pick.lod_level,
            estimated_sample_error_bound: body.provisional_pick.estimated_sample_error_bound,
            authoritative_response: {
              response_type: 'authoritative_scientific_value',
              dataset_id: MOCK_BASELINE.datasetId,
              variable_id: MOCK_BASELINE.variableId,
              scientific_value: 24.87654,
              canonical_units: 'degC',
              value_state: 'valid',
              requested_latitude_deg: 25.0,
              requested_longitude_deg: -70.0,
              resolved_latitude_deg: 25.0,
              resolved_longitude_deg: -70.0,
              resolved_depth_m: 10.0,
              resolved_time_utc: '2026-08-30T00:00:00Z',
              grid_index_evaluated: [6, 2, 60, 120],
              selection_method_used: 'nearest_native_sample',
              source_asset_id: 'copernicus_phy_thetao_nc',
              source_asset_sha256: MOCK_BASELINE.sourceSha256,
            },
            absolute_difference_delta: 0.02654,
            relative_difference_percent: 0.106,
            within_estimated_error_bound: true,
            reconciliation_notice: 'PROVISIONAL PICK RECONCILED: Evaluated directly from NetCDF source.',
          },
          meta: { requestId: 'test-reconcile-req', schemaVersion: '1.0.0', timestampUtc: '2026-08-30T12:00:00Z' },
        }),
        { status: 200, headers }
      );
    }

    // Error simulation endpoints
    if (pathname === '/api/v1/datasets/unknown_dataset') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'CATALOG_DATASET_NOT_FOUND',
            message: "The requested dataset 'unknown_dataset' is unavailable.",
            requestId: 'req-err-404',
            retryable: false,
            details: { dataset_id: 'unknown_dataset' },
          },
        }),
        { status: 404, headers }
      );
    }

    if (pathname === '/api/v1/invalid-request') {
      return new Response(
        JSON.stringify({
          error: {
            code: 'VALIDATION_SCHEMA_VIOLATION',
            message: 'The request payload failed schema validation.',
            requestId: 'req-err-422',
            retryable: false,
            details: { validationErrors: [{ loc: ['body', 'latitude'], msg: 'field required' }] },
          },
        }),
        { status: 422, headers }
      );
    }

    // Default 404
    return new Response(
      JSON.stringify({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Endpoint ${pathname} not found.`,
          requestId: 'req-err-default-404',
          retryable: false,
          details: {},
        },
      }),
      { status: 404, headers }
    );
  };
}

describe('QuasarOS Typed Browser Client (TASK-06B)', () => {
  const mockFetch = createMockFetch();
  const client = new QuasarClient({
    baseUrl: 'http://localhost:8000',
    fetch: mockFetch as typeof fetch,
  });

  it('should discover service health and capabilities', async () => {
    const health = await client.catalog.getHealthLive();
    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'quasar-catalog-service');
    assert.equal(health.integrityVerified, true);

    const caps = await client.catalog.getCapabilities();
    assert.equal(caps.data.serverVersion, '1.0.0');
    assert.ok(caps.data.supportedRenderingBackends.includes('webgpu_wgsl'));
    assert.ok(caps.data.supportedRenderingBackends.includes('webgl2_glsl'));
    assert.ok(caps.data.supportedCoordinateSpaces.includes('geographic_wgs84'));
    assert.ok(caps.data.resourceLimits.maxQueryPoints >= 1000);
  });

  it('should fetch catalog overview and discover active datasets', async () => {
    const catalogResp = await client.catalog.getCatalog();
    assert.equal(catalogResp.data.totalDatasets, 1);
    assert.equal(catalogResp.data.datasets[0].datasetId, MOCK_BASELINE.datasetId);
    assert.equal(catalogResp.data.datasets[0].activeSnapshotId, MOCK_BASELINE.snapshotId);
    assert.equal(catalogResp.data.activeSnapshots.length, 1);
    assert.deepEqual(catalogResp.data.activeSnapshots[0].shape, [7, 31, 201, 201]);
  });

  it('should discover and pin active snapshot session (SnapshotPinner)', async () => {
    const session = await client.initializeSession(MOCK_BASELINE.datasetId);
    assert.equal(session.datasetId, MOCK_BASELINE.datasetId);
    assert.equal(session.snapshotId, MOCK_BASELINE.snapshotId);
    assert.equal(session.visualizationProductId, MOCK_BASELINE.visProductId);
    assert.equal(session.productVersion, 'v1');
    assert.equal(session.sourceSha256, MOCK_BASELINE.sourceSha256);
    assert.deepEqual(session.shape, [7, 31, 201, 201]);

    const activeSession = client.getPinnedSession();
    assert.ok(activeSession !== null);
    assert.equal(activeSession.snapshotId, MOCK_BASELINE.snapshotId);

    // Consistency verification should pass
    await client.verifySessionConsistency();
  });

  it('should detect mid-session snapshot mutation and prevent silent dataset drift', async () => {
    const pinner = new SnapshotPinner();
    pinner.pinFromCatalog(MOCK_CATALOG, MOCK_BASELINE.datasetId);

    // Mutate catalog active snapshot pointer (simulate operational day rollover)
    const mutatedCatalog: CatalogOverview = {
      ...MOCK_CATALOG,
      datasets: [
        {
          ...MOCK_CATALOG.datasets[0],
          activeSnapshotId: 'copernicus-phy-thetao-20260831-new-snapshot',
        },
      ],
    };

    assert.throws(
      () => {
        pinner.verifySessionConsistency(mutatedCatalog);
      },
      (err: unknown) => {
        assert.ok(err instanceof SnapshotMutationError);
        assert.equal(err.datasetId, MOCK_BASELINE.datasetId);
        assert.equal(err.pinnedSnapshotId, MOCK_BASELINE.snapshotId);
        assert.equal(err.observedSnapshotId, 'copernicus-phy-thetao-20260831-new-snapshot');
        return true;
      }
    );
  });

  it('should retrieve dataset metadata and snapshots list', async () => {
    const dataset = await client.catalog.getDataset(MOCK_BASELINE.datasetId);
    assert.equal(dataset.data.identity.dataset_id, MOCK_BASELINE.datasetId);
    assert.equal(dataset.data.grid.crs, 'EPSG:4326');
    assert.equal(dataset.data.vertical.level_count, 31);
    assert.equal(dataset.data.capabilities.can_volume_render_3d, true);

    const snapshots = await client.catalog.listDatasetSnapshots(MOCK_BASELINE.datasetId, { limit: 10 });
    assert.equal(snapshots.data.length, 1);
    assert.equal(snapshots.data[0].snapshotId, MOCK_BASELINE.snapshotId);
  });

  it('should retrieve visualization product detail and render manifest alias', async () => {
    const visDetail = await client.catalog.getVisualizationProduct(MOCK_BASELINE.visProductId);
    assert.equal(visDetail.data.visualizationProduct.visualization_product_id, MOCK_BASELINE.visProductId);
    assert.equal(visDetail.data.totalBricks, 63);
    assert.equal(visDetail.data.isEligibleForExactQuery, false);

    // Test alias endpoint GET /api/v1/render-manifests/{product_id}
    const manifestDetail = await client.catalog.getRenderManifest(MOCK_BASELINE.visProductId);
    assert.equal(manifestDetail.data.visualizationProduct.visualization_product_id, MOCK_BASELINE.visProductId);
    assert.equal(manifestDetail.data.visualizationProduct.processing_pipeline_version, '1.0.0');
    assert.equal(manifestDetail.data.visualizationProduct.canonical_units, 'degC');
  });

  it('should format brick download URLs conforming to TASK-05T', () => {
    const brickKey = 'vis_copernicus_phy_thetao_...:v1:lod0:t0:bx0:by0:bz0:sea_water_potential_temperature';
    const urlF16 = client.formatBrickPayloadUrl(MOCK_BASELINE.visProductId, brickKey, 'f16');
    const urlU16 = client.formatBrickPayloadUrl(MOCK_BASELINE.visProductId, brickKey, 'u16');

    assert.equal(
      urlF16,
      `http://localhost:8000/api/v1/visualization-products/${encodeURIComponent(MOCK_BASELINE.visProductId)}/bricks/${encodeURIComponent(brickKey)}/payloads/f16`
    );
    assert.equal(
      urlU16,
      `http://localhost:8000/api/v1/visualization-products/${encodeURIComponent(MOCK_BASELINE.visProductId)}/bricks/${encodeURIComponent(brickKey)}/payloads/u16`
    );
  });

  it('should execute authoritative point queries (POST /api/v1/queries/value)', async () => {
    const queryReq: ExactValueQueryRequest = {
      dataset_id: MOCK_BASELINE.datasetId,
      snapshot_id: MOCK_BASELINE.snapshotId,
      variable_id: MOCK_BASELINE.variableId,
      latitude_deg: 25.0,
      longitude_deg: -70.0,
      vertical_selector_type: 'physical_depth_meters',
      vertical_target_value: 10.0,
      time_selector_mode: 'exact_utc_timestamp',
      target_time_utc: '2026-08-30T00:00:00Z',
      selection_interpolation: {
        method: 'nearest_native_sample',
        allows_extrapolation: false,
        max_horizontal_extrapolation_deg: 0.1,
        max_vertical_extrapolation_m: 5.0,
      },
    };

    const resp = await client.query.queryExactValue(queryReq);
    assert.equal(resp.data.response_type, 'authoritative_scientific_value');
    assert.equal(resp.data.dataset_id, MOCK_BASELINE.datasetId);
    assert.equal(resp.data.variable_id, MOCK_BASELINE.variableId);
    assert.equal(resp.data.canonical_units, 'degC');
    assert.equal(resp.data.scientific_value, 24.87654);
    assert.equal(resp.data.value_state, 'valid');
    assert.equal(resp.data.source_asset_sha256, MOCK_BASELINE.sourceSha256);
  });

  it('should execute authoritative vertical profile column queries (POST /api/v1/queries/profile)', async () => {
    const profileReq: VerticalProfileQueryRequest = {
      dataset_id: MOCK_BASELINE.datasetId,
      snapshot_id: MOCK_BASELINE.snapshotId,
      variable_id: MOCK_BASELINE.variableId,
      latitude_deg: 25.0,
      longitude_deg: -70.0,
      target_time_utc: '2026-08-30T00:00:00Z',
    };

    const resp = await client.query.queryVerticalProfile(profileReq);
    assert.equal(resp.data.response_type, 'authoritative_vertical_profile');
    assert.equal(resp.data.total_levels, 7);
    assert.equal(resp.data.valid_levels_count, 7);
    assert.equal(resp.data.samples.length, 7);
    assert.equal(resp.data.samples[0].depth_m, 0.0);
    assert.equal(resp.data.samples[0].scientific_value, 28.5);
    assert.equal(resp.data.samples[6].depth_m, 5000.0);
    assert.equal(resp.data.samples[6].scientific_value, 2.3);
  });

  it('should execute provisional GPU pick reconciliation (POST /api/v1/queries/reconcile-pick)', async () => {
    const reconcileReq: ReconcilePickRequest = {
      provisional_pick: {
        response_type: 'approximate_render_sample',
        visualization_product_id: MOCK_BASELINE.visProductId,
        lod_level: 0,
        approximate_value: 24.85,
        display_units: 'degC',
        world_ray_hit_position: [-70.0, 25.0, 10.0],
        estimated_sample_error_bound: 0.05,
        approximation_notice: 'Provisional GPU raymarch sample',
      },
      latitude_deg: 25.0,
      longitude_deg: -70.0,
      depth_m: 10.0,
    };

    const resp = await client.query.reconcileProvisionalPick(reconcileReq);
    assert.equal(resp.data.response_type, 'authoritative_reconciled_pick');
    assert.equal(resp.data.provisional_value, 24.85);
    assert.equal(resp.data.authoritative_response.scientific_value, 24.87654);
    assert.equal(resp.data.within_estimated_error_bound, true);
    assert.ok(resp.data.absolute_difference_delta! <= 0.05);
  });

  it('should parse structured errors conforming to ErrorModel.md on HTTP 404 and 422', async () => {
    // Test 404 translation
    await assert.rejects(
      async () => {
        await client.catalog.getDataset('unknown_dataset');
      },
      (err: unknown) => {
        assert.ok(err instanceof QuasarApiError);
        assert.equal(err.status, 404);
        assert.equal(err.code, 'CATALOG_DATASET_NOT_FOUND');
        assert.equal(err.requestId, 'req-err-404');
        assert.equal(err.retryable, false);
        return true;
      }
    );

    // Test 422 translation
    await assert.rejects(
      async () => {
        await client.catalog.request('/api/v1/invalid-request');
      },
      (err: unknown) => {
        assert.ok(err instanceof QuasarApiError);
        assert.equal(err.status, 422);
        assert.equal(err.code, 'VALIDATION_SCHEMA_VIOLATION');
        assert.equal(err.requestId, 'req-err-422');
        assert.ok('validationErrors' in err.details);
        return true;
      }
    );
  });

  it('should support request cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort(); // Immediately aborted

    await assert.rejects(
      async () => {
        await client.catalog.getCatalog({ signal: controller.signal });
      },
      (err: unknown) => {
        assert.ok(err instanceof NetworkAbortError);
        return true;
      }
    );

    // Test timed abort
    const slowController = new AbortController();
    const promise = client.catalog.request('/api/v1/slow-endpoint', { signal: slowController.signal });
    slowController.abort();

    await assert.rejects(
      async () => {
        await promise;
      },
      (err: unknown) => {
        assert.ok(err instanceof NetworkAbortError);
        return true;
      }
    );
  });
});
