/**
 * TypeScript E2E Test Suite - UI State Machine, Timeline & Rendering Integration (VISUALIZATION-REMEDIATION-03)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useAppStore } from '../../apps/web/src/context/app_store.ts';
import {
  TransferFunctionModel,
  ScientificLegendFormatter,
  PhysicalClippingModel,
  VolumeQualityModel,
} from '../../apps/web/src/components/controls/index.ts';
import {
  buildPickReconciliationModel,
  computePickDeltaMetrics,
} from '../../apps/web/src/components/inspection/PickReconciliationLogic.ts';
import {
  buildVerticalProfileChartModel,
  COPERNICUS_31_DEPTH_LEVELS,
} from '../../apps/web/src/components/inspection/VerticalProfileLogic.ts';
import {
  ClippingController,
  CoordinateTransformer,
  DepthLookupTable,
} from '../../packages/runtime/src/index.ts';

function resetTestStore() {
  const store = useAppStore.getState();
  store.setHealthStatus(null, 'healthy');
  store.setBackendChoice('auto');
  store.setActiveBackend('webgpu', 'Apple M3 Pro');
  store.setDeviceLost(false);
  store.setActiveDataset('copernicus_phy_thetao', 'copernicus-phy-thetao-20260824-20260830-ca826087');
  store.setActiveVariable('sea_water_potential_temperature');
  store.setTimestepIndex(0);
  store.setPlaying(false);
}

describe('UI State Machine, Timeline & Rendering E2E Integration', () => {
  beforeEach(() => {
    resetTestStore();
  });

  it('should initialize and maintain active 7-day dataset session', () => {
    const store = useAppStore.getState();
    assert.strictEqual(store.activeDatasetId, 'copernicus_phy_thetao');
    assert.strictEqual(store.pinnedSession?.snapshotId, 'copernicus-phy-thetao-20260824-20260830-ca826087');
    assert.strictEqual(store.timestepIndex, 0);
    assert.strictEqual(store.currentDateIso, '2026-08-24');
    assert.strictEqual(store.activeBackend, 'webgpu');
  });

  it('should scrub timeline across all 7 days with generation token advancement', () => {
    const g0 = useAppStore.getState().activeGeneration;
    for (let day = 1; day < 7; day++) {
      useAppStore.getState().setTimestepIndex(day);
      assert.strictEqual(useAppStore.getState().timestepIndex, day);
      assert.strictEqual(useAppStore.getState().currentDateIso, `2026-08-${24 + day}`);
    }
    assert.strictEqual(useAppStore.getState().activeGeneration, g0 + 6);
  });

  it('should configure colormaps and generate 256-level transfer function LUT', () => {
    const tf = new TransferFunctionModel({
      colormapName: 'viridis',
      domainMin: 9.3747,
      domainMax: 30.3618,
      unit: '°C',
    });
    const lut = tf.generateLUT(256);
    assert.strictEqual(lut.length, 256 * 4);
    assert.strictEqual(tf.unit, '°C');
  });

  it('should integrate 6-plane depth, longitude, and latitude clipping', () => {
    const store = useAppStore.getState();
    const lut = new DepthLookupTable(COPERNICUS_31_DEPTH_LEVELS);
    const transformer = new CoordinateTransformer(
      {
        minLongitudeDeg: store.spatialBounds.minLon,
        maxLongitudeDeg: store.spatialBounds.maxLon,
        minLatitudeDeg: store.spatialBounds.minLat,
        maxLatitudeDeg: store.spatialBounds.maxLat,
        minDepthM: store.spatialBounds.minDepthM,
        maxDepthM: store.spatialBounds.maxDepthM,
      },
      lut
    );
    const ctrl = new ClippingController(transformer);
    const model = new PhysicalClippingModel(ctrl);

    model.setDepthRange(10.0, 300.0);
    assert.strictEqual(model.state.limits.minDepthM, 10.0);
    assert.strictEqual(model.state.limits.maxDepthM, 300.0);

    const box = ctrl.normalizedClippingBox;
    assert.ok(box.minU >= 0.0 && box.maxU <= 1.0);
    assert.ok(box.minV >= 0.0 && box.maxV <= 1.0);
    assert.ok(box.minW >= 0.0 && box.maxW <= 1.0);
  });

  it('should compute pick reconciliation delta metrics and model', () => {
    const metrics = computePickDeltaMetrics(28.45, 28.50, 0.1, 64.0, 7.5, 64.0, 7.5);
    assert.ok(Math.abs((metrics.absoluteDelta ?? 0) - 0.05) < 1e-4);
    assert.strictEqual(metrics.withinErrorBound, true);

    const cursor = {
      longitudeDeg: 64.0,
      latitudeDeg: 7.5,
      depthM: 10.0,
      timestampUtc: '2026-08-24T00:00:00Z',
    };
    const prov = {
      approximate_value: 28.45,
      display_units: '°C',
      lod_level: 0,
      estimated_sample_error_bound: 0.1,
    };
    const reconcile = {
      provisional_value: 28.45,
      provisional_lod_level: 0,
      estimated_sample_error_bound: 0.1,
      authoritative_response: {
        scientific_value: 28.50,
        canonical_units: '°C',
        value_state: 'valid' as const,
        source_asset_id: 'snap1',
        source_asset_sha256: 'sha1',
        selection_method_used: 'trilinear' as const,
      },
    };
    const model = buildPickReconciliationModel(cursor as any, prov as any, reconcile as any);
    assert.strictEqual(model.provisional.displayUnits, '°C');
    assert.strictEqual(model.delta.withinErrorBound, true);
  });

  it('should generate 31-level vertical profile chart coordinate points', () => {
    const response = {
      dataset_id: 'copernicus_phy_thetao',
      variable_id: 'thetao',
      canonical_units: '°C',
      requested_longitude_deg: 64.0,
      requested_latitude_deg: 7.5,
      resolved_longitude_deg: 64.0,
      resolved_latitude_deg: 7.5,
      horizontal_distance_delta_km: 0.0,
      resolved_time_utc: '2026-08-24T00:00:00Z',
      source_asset_id: 'asset1',
      source_asset_sha256: 'sha1',
      total_levels: 31,
      valid_levels_count: 31,
      samples: COPERNICUS_31_DEPTH_LEVELS.map((d, i) => ({
        depth_m: d,
        scientific_value: 28.0 - i * 0.8,
        value_state: 'valid' as const,
        quality_flag: 1,
        uncertainty_estimate: 0.05,
      })),
    };

    const chartModel = buildVerticalProfileChartModel(response as any);
    assert.strictEqual(chartModel.dataPoints.length, 31);
    assert.strictEqual(chartModel.validLevelsCount, 31);
  });
});
