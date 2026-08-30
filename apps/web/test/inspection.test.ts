/**
 * Automated Unit Tests for QuasarOS Scientific Inspection & Analysis Subsystem.
 *
 * Tests:
 * 1. Pick Delta Calculation & Reconciliation Logic:
 *    - Absolute delta (|V_prov - V_auth|) and relative error percentage
 *    - Great-circle Haversine coordinate resolution distance
 *    - Error bound verification against estimatedSampleErrorBound
 *    - Missing / non-evaluated / NaN authoritative handling
 * 2. Vertical Profile Sounding Mathematics & Depth Mapping:
 *    - 31-level Copernicus non-uniform depth coordinate mapping (0.494m to 453.938m)
 *    - Monotonic linear and logarithmic depth Y-coordinate projection
 *    - Continuous segment generation with missing/seabed data gap handling
 *    - SVG XML string generation with semantic classes and accessible markup
 * 3. Provenance Drawer Lineage & Metadata Verification:
 *    - Full data lineage metadata, Copernicus product ID, acquisition timestamp
 *    - SHA-256 asset hash and canonical storage paths
 *    - Licence and mandatory attribution formatting
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type {
  ExactValueQueryResponse,
  ProvisionalRenderPickResponse,
  ReconcilePickResponse,
  VerticalProfileQueryResponse,
} from '@quasar/client';

import {
  calculateHaversineDistanceKm,
  computePickDeltaMetrics,
  buildPickReconciliationModel,
  formatPickReconciliationSummary,
} from '../src/components/inspection/PickReconciliationLogic.ts';

import {
  COPERNICUS_31_DEPTH_LEVELS,
  buildVerticalProfileChartModel,
  mapDepthToY,
  mapValueToX,
  generateVerticalProfileSvg,
  DEFAULT_CHART_DIMENSIONS,
} from '../src/components/inspection/VerticalProfileLogic.ts';

import {
  COPERNICUS_THETAO_PROVENANCE_BASELINE,
  formatProvenanceMarkdown,
} from '../src/components/inspection/ProvenanceLogic.ts';

describe('TASK-10D: Pick Delta Calculation & Reconciliation Logic', () => {
  it('should accurately calculate Haversine distance between geodetic coordinates', () => {
    // Distance from (80.0°E, 0.0°N) to (81.0°E, 0.0°N) at Equator is ~111.195 km
    const distEquator = calculateHaversineDistanceKm(80.0, 0.0, 81.0, 0.0);
    assert.ok(Math.abs(distEquator - 111.195) < 0.5, `Expected ~111.2 km, got ${distEquator}`);

    // Identical coordinates should yield 0.0 km
    const distZero = calculateHaversineDistanceKm(84.5, 5.2, 84.5, 5.2);
    assert.strictEqual(distZero, 0.0);
  });

  it('should compute absolute delta, relative error percentage, and error bound flag', () => {
    const provVal = 28.452;
    const authVal = 28.421;
    const errorBound = 0.05;

    const metrics = computePickDeltaMetrics(
      provVal,
      authVal,
      errorBound,
      82.5,
      4.0,
      82.52,
      4.01
    );

    assert.ok(metrics.absoluteDelta !== null);
    assert.ok(Math.abs(metrics.absoluteDelta - 0.031) < 1e-5, `Absolute delta mismatch: ${metrics.absoluteDelta}`);

    assert.ok(metrics.relativeDeltaPercent !== null);
    const expectedRel = (0.031 / 28.421) * 100;
    assert.ok(Math.abs(metrics.relativeDeltaPercent - expectedRel) < 1e-4);

    assert.strictEqual(metrics.withinErrorBound, true);
    assert.ok(metrics.coordinateResolutionDistanceKm > 0);
  });

  it('should flag when absolute delta exceeds estimated sample error bound', () => {
    const provVal = 28.45;
    const authVal = 28.10; // delta = 0.35
    const errorBound = 0.05;

    const metrics = computePickDeltaMetrics(
      provVal,
      authVal,
      errorBound,
      80.0,
      0.0,
      80.0,
      0.0
    );

    assert.ok(metrics.absoluteDelta !== null);
    assert.ok(Math.abs(metrics.absoluteDelta - 0.35) < 1e-5);
    assert.strictEqual(metrics.withinErrorBound, false);
  });

  it('should handle missing / null authoritative values gracefully', () => {
    const metrics = computePickDeltaMetrics(
      28.5,
      null,
      0.05,
      80.0,
      0.0,
      80.0,
      0.0
    );

    assert.strictEqual(metrics.absoluteDelta, null);
    assert.strictEqual(metrics.relativeDeltaPercent, null);
    assert.strictEqual(metrics.withinErrorBound, null);
  });

  it('should build full PickReconciliationModel from server response and format summary', () => {
    const cursor = {
      longitudeDeg: 83.5,
      latitudeDeg: 6.2,
      depthM: 15.81,
      timestampUtc: '2026-08-28T00:00:00Z',
    };

    const prov: ProvisionalRenderPickResponse = {
      response_type: 'approximate_render_sample',
      visualization_product_id: 'vis_copernicus_thetao',
      lod_level: 0,
      approximate_value: 27.854,
      display_units: '°C',
      world_ray_hit_position: [12000, -45000, -15.81],
      estimated_sample_error_bound: 0.05,
      approximation_notice: 'Provisional GPU sample',
    };

    const authResp: ExactValueQueryResponse = {
      response_type: 'authoritative_scientific_value',
      dataset_id: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
      variable_id: 'sea_water_potential_temperature',
      scientific_value: 27.842,
      canonical_units: 'degree_Celsius',
      value_state: 'valid',
      requested_latitude_deg: 6.2,
      requested_longitude_deg: 83.5,
      resolved_latitude_deg: 6.208,
      resolved_longitude_deg: 83.504,
      resolved_depth_m: 15.81007,
      resolved_time_utc: '2026-08-28T00:00:00Z',
      grid_index_evaluated: [4, 10, 110, 42],
      selection_method_used: 'trilinear_interpolation',
      source_asset_id: 'copernicus_phy_thetao_20260824_20260830.nc',
      source_asset_sha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
    };

    const reconcileResp: ReconcilePickResponse = {
      response_type: 'authoritative_reconciled_pick',
      provisional_value: 27.854,
      provisional_lod_level: 0,
      estimated_sample_error_bound: 0.05,
      authoritative_response: authResp,
      absolute_difference_delta: 0.012,
      relative_difference_percent: 0.0431,
      within_estimated_error_bound: true,
      reconciliation_notice: 'Reconciled successfully against native NetCDF.',
    };

    const model = buildPickReconciliationModel(cursor, prov, reconcileResp);
    assert.strictEqual(model.isLoading, false);
    assert.ok(model.authoritative !== null);
    assert.strictEqual(model.authoritative?.scientificValue, 27.842);
    assert.strictEqual(model.delta.withinErrorBound, true);

    const summary = formatPickReconciliationSummary(model);
    assert.ok(summary.includes('SCIENTIFIC PICK RECONCILIATION'));
    assert.ok(summary.includes('Provisional (GPU Render): 27.8540 °C'));
    assert.ok(summary.includes('Authoritative (Native NetCDF): 27.8420 degree_Celsius'));
    assert.ok(summary.includes('ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c'));
  });
});

describe('TASK-10D: Vertical Profile Sounding Mathematics & SVG Rendering', () => {
  it('should verify 31 standard Copernicus depth levels monotonicity and bounds', () => {
    assert.strictEqual(COPERNICUS_31_DEPTH_LEVELS.length, 31);
    assert.strictEqual(COPERNICUS_31_DEPTH_LEVELS[0], 0.494025);
    assert.strictEqual(COPERNICUS_31_DEPTH_LEVELS[30], 453.9377);

    // Verify strict monotonicity
    for (let i = 1; i < COPERNICUS_31_DEPTH_LEVELS.length; i++) {
      assert.ok(
        COPERNICUS_31_DEPTH_LEVELS[i] > COPERNICUS_31_DEPTH_LEVELS[i - 1],
        `Level ${i} (${COPERNICUS_31_DEPTH_LEVELS[i]}m) must be > level ${i - 1} (${COPERNICUS_31_DEPTH_LEVELS[i - 1]}m)`
      );
    }
  });

  it('should correctly map depth and scalar values to chart pixel coordinates', () => {
    const yMin = 20;
    const yMax = 400;
    const minDepth = 0.494;
    const maxDepth = 453.938;

    // Linear mapping
    const yTop = mapDepthToY(0.494, minDepth, maxDepth, yMin, yMax, 'linear');
    const yBottom = mapDepthToY(453.938, minDepth, maxDepth, yMin, yMax, 'linear');
    assert.strictEqual(yTop, yMin);
    assert.strictEqual(yBottom, yMax);

    // Log-depth mapping
    const yMidLog = mapDepthToY(50.0, minDepth, maxDepth, yMin, yMax, 'log');
    assert.ok(yMidLog > yMin && yMidLog < yMax);

    // Value mapping
    const xMin = 50;
    const xMax = 300;
    const xVal = mapValueToX(20.0, 10.0, 30.0, xMin, xMax);
    assert.strictEqual(xVal, 175); // midpoint (50 + 0.5 * 250)
  });

  it('should transform VerticalProfileQueryResponse with missing gaps into chart model', () => {
    const mockResponse: VerticalProfileQueryResponse = {
      response_type: 'authoritative_vertical_profile',
      dataset_id: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
      variable_id: 'sea_water_potential_temperature',
      canonical_units: 'degree_Celsius',
      requested_latitude_deg: 5.0,
      requested_longitude_deg: 84.0,
      resolved_latitude_deg: 5.0,
      resolved_longitude_deg: 84.0,
      horizontal_distance_delta_km: 0.0,
      resolved_time_utc: '2026-08-25T00:00:00Z',
      selection_method_used: 'nearest_native_sample',
      total_levels: 31,
      valid_levels_count: 28,
      source_asset_id: 'copernicus_phy_thetao_20260824_20260830.nc',
      source_asset_sha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
      samples: COPERNICUS_31_DEPTH_LEVELS.map((depth, idx) => ({
        level_index: idx,
        depth_m: depth,
        scientific_value: idx < 28 ? 29.5 - Math.sqrt(depth) * 0.9 : null,
        value_state: idx < 28 ? 'valid' : 'below_seafloor',
      })),
    };

    const chartModel = buildVerticalProfileChartModel(mockResponse);
    assert.strictEqual(chartModel.totalLevels, 31);
    assert.strictEqual(chartModel.validLevelsCount, 28);
    assert.strictEqual(chartModel.dataPoints.length, 31);
    assert.strictEqual(chartModel.dataPoints[0].isGap, false);
    assert.strictEqual(chartModel.dataPoints[30].isGap, true);
    assert.strictEqual(chartModel.dataPoints[30].valueState, 'below_seafloor');

    // Verify SVG generation produces valid markup
    const svg = generateVerticalProfileSvg(chartModel, DEFAULT_CHART_DIMENSIONS);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('class="quasar-profile-chart"'));
    assert.ok(svg.includes('class="profile-line"'));
    assert.ok(svg.includes('class="gap-point"'));
    assert.ok(svg.includes('data-state="below_seafloor"'));
  });
});

describe('TASK-10D: Provenance & Data Lineage Metadata Verification', () => {
  it('should verify authoritative Copernicus baseline provenance constants', () => {
    const prov = COPERNICUS_THETAO_PROVENANCE_BASELINE;
    assert.strictEqual(prov.productId, 'GLOBAL_ANALYSISFORECAST_PHY_001_024');
    assert.strictEqual(prov.datasetId, 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m');
    assert.strictEqual(prov.snapshotId, 'copernicus-phy-thetao-20260824-20260830-ca826087');
    assert.strictEqual(prov.sourceSha256, 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c');
    assert.strictEqual(prov.variableId, 'sea_water_potential_temperature');
  });

  it('should format full provenance markdown with mandatory licence and citation', () => {
    const md = formatProvenanceMarkdown(COPERNICUS_THETAO_PROVENANCE_BASELINE);
    assert.ok(md.includes('# QuasarOS Operational Data Lineage & Provenance Record'));
    assert.ok(md.includes('GLOBAL_ANALYSISFORECAST_PHY_001_024'));
    assert.ok(md.includes('ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c'));
    assert.ok(md.includes('Copernicus Sentinel Data / E.U. Open Data Policy'));
    assert.ok(md.includes('https://doi.org/10.48670/moi-00016'));
  });
});
