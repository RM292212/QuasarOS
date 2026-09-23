/**
 * Milestone 4 Automated Test Suite:
 * Cesium Explorer Mode & Argo Synchronization in QuasarOS Ocean Digital Twin.
 *
 * Tests:
 * 1. Workspace State Machine & Bidirectional ROI Roundtrip:
 *    - Workspace switching between 'overview' and 'volume'.
 *    - ROI presets (Arabian Sea, Bay of Bengal, Equatorial IO).
 *    - Custom bounding box selection and spatial bounds synchronization.
 *    - Return-to-overview preservation of state, timestamps, and variables.
 * 2. Argo Float Catalog & Platform Synchronization:
 *    - Ingestion and metadata parsing of real Argo profiles (D1902669_012, R1902581_050, SR1902594_001).
 *    - WMO ID, cycle number, geographic coordinates, and QC flag retention.
 *    - Store selection synchronization.
 * 3. Observation Collocation Engine & Residual Analytics:
 *    - Per-layer temperature and salinity residuals (delta = model - argo).
 *    - Mean Bias and Root Mean Square Error (RMSE) calculations.
 *    - Quality control flag validation.
 * 4. 2D Analytical Profile Charts & Depth Scaling:
 *    - 50 non-uniform Copernicus depth levels (0.494m to 5,727.917m).
 *    - Monotonic linear and logarithmic depth Y-coordinate projection.
 *    - TEOS-10 derived soundings (Conservative Temperature, Absolute Salinity, Potential Density Anomaly).
 *    - Model vs. in-situ observation overlays and SVG generation.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  useAppStore,
  ROI_PRESETS,
  ARGO_FLOAT_CATALOG,
  type BoundingBox,
} from '../src/context/app_store.ts';

import {
  buildObservationComparisonModel,
  ARGO_COLLOCATION_FIXTURES,
  getCollocationModelForFloat,
} from '../src/components/observations/ObservationComparisonLogic.ts';

import {
  COPERNICUS_50_DEPTH_LEVELS,
  COPERNICUS_31_DEPTH_LEVELS,
  buildVerticalProfileChartModel,
  buildTEOS10ProfileChartModel,
  mapDepthToY,
  mapValueToX,
  generateVerticalProfileSvg,
  DEFAULT_CHART_DIMENSIONS,
} from '../src/components/inspection/VerticalProfileLogic.ts';

import type { VerticalProfileQueryResponse } from '@quasar/client';

function resetTestStore() {
  const store = useAppStore.getState();
  store.setActiveWorkspace('overview');
  store.applyROIPreset('arabian_sea');
  store.setSelectedFloat('D1902669_012', 12);
  store.setActiveVariable('thetao (Sea Water Potential Temperature, °C)');
  store.setTimestepIndex(6);
  store.setLODMode('interactive');
}

describe('Milestone 4: Cesium Explorer Mode & Argo Synchronization', () => {
  beforeEach(() => {
    resetTestStore();
  });

  describe('1. Workspace State Machine & Bidirectional ROI Roundtrip', () => {
    it('should initialize with Overview workspace and toggle between Overview and Volume modes', () => {
      const store = useAppStore.getState();
      assert.strictEqual(store.activeWorkspace, 'overview');

      // Switch to Volume Mode
      store.setActiveWorkspace('volume');
      assert.strictEqual(useAppStore.getState().activeWorkspace, 'volume');

      // Switch back to Overview Mode
      store.setActiveWorkspace('overview');
      assert.strictEqual(useAppStore.getState().activeWorkspace, 'overview');
    });

    it('should apply ROI presets and synchronize spatialBounds with selectedBoundingBox', () => {
      const store = useAppStore.getState();

      // 1. Arabian Sea preset (60-68°E, 0-15°N)
      store.applyROIPreset('arabian_sea');
      let state = useAppStore.getState();
      assert.strictEqual(state.spatialBounds.minLon, 60.0);
      assert.strictEqual(state.spatialBounds.maxLon, 68.0);
      assert.strictEqual(state.spatialBounds.minLat, 0.0);
      assert.strictEqual(state.spatialBounds.maxLat, 15.0);
      assert.strictEqual(state.selectedBoundingBox?.west, 60.0);
      assert.strictEqual(state.selectedBoundingBox?.east, 68.0);

      // 2. Bay of Bengal preset (80-92°E, 8-22°N)
      store.applyROIPreset('bay_of_bengal');
      state = useAppStore.getState();
      assert.strictEqual(state.spatialBounds.minLon, 80.0);
      assert.strictEqual(state.spatialBounds.maxLon, 92.0);
      assert.strictEqual(state.spatialBounds.minLat, 8.0);
      assert.strictEqual(state.spatialBounds.maxLat, 22.0);
      assert.strictEqual(state.selectedBoundingBox?.west, 80.0);
      assert.strictEqual(state.selectedBoundingBox?.east, 92.0);

      // 3. Equatorial Indian Ocean preset (65-85°E, -5-5°N)
      store.applyROIPreset('equatorial_io');
      state = useAppStore.getState();
      assert.strictEqual(state.spatialBounds.minLon, 65.0);
      assert.strictEqual(state.spatialBounds.maxLon, 85.0);
      assert.strictEqual(state.spatialBounds.minLat, -5.0);
      assert.strictEqual(state.spatialBounds.maxLat, 5.0);
    });

    it('should support custom bounding box selection with lossless roundtrip to Volume mode and back', () => {
      const store = useAppStore.getState();
      const initialGen = store.activeGeneration;

      const customBox: BoundingBox = {
        west: 62.5,
        east: 67.5,
        south: 4.0,
        north: 12.0,
        minDepthM: 0.494,
        maxDepthM: 3500.0,
      };

      store.selectROI(customBox);
      const stateAfterSelect = useAppStore.getState();

      assert.strictEqual(stateAfterSelect.spatialBounds.minLon, 62.5);
      assert.strictEqual(stateAfterSelect.spatialBounds.maxLon, 67.5);
      assert.strictEqual(stateAfterSelect.spatialBounds.minLat, 4.0);
      assert.strictEqual(stateAfterSelect.spatialBounds.maxLat, 12.0);
      assert.strictEqual(stateAfterSelect.spatialBounds.maxDepthM, 3500.0);
      assert.ok(stateAfterSelect.activeGeneration > initialGen, 'Generation token must increment on ROI update');

      // Enter Volume mode
      store.setActiveWorkspace('volume');
      assert.strictEqual(useAppStore.getState().activeWorkspace, 'volume');
      assert.strictEqual(useAppStore.getState().spatialBounds.minLon, 62.5);

      // Return to Overview mode preserving exact spatial bounds
      store.setActiveWorkspace('overview');
      const stateAfterReturn = useAppStore.getState();
      assert.strictEqual(stateAfterReturn.activeWorkspace, 'overview');
      assert.strictEqual(stateAfterReturn.spatialBounds.minLon, 62.5);
      assert.strictEqual(stateAfterReturn.spatialBounds.maxLon, 67.5);
    });
  });

  describe('2. Argo Float Catalog & Platform Synchronization', () => {
    it('should contain all required North Indian Ocean operational Argo float metadata', () => {
      assert.ok(ARGO_FLOAT_CATALOG.length >= 3);

      const d1902669 = ARGO_FLOAT_CATALOG.find((f) => f.id === 'D1902669_012');
      assert.ok(d1902669);
      assert.strictEqual(d1902669.wmoId, 1902669);
      assert.strictEqual(d1902669.cycleNumber, 12);
      assert.strictEqual(d1902669.latitude, 13.317);
      assert.strictEqual(d1902669.longitude, 86.817);
      assert.strictEqual(d1902669.dataMode, 'Delayed-Mode');
      assert.strictEqual(d1902669.tempProfileQc, 1);
      assert.strictEqual(d1902669.psalProfileQc, 1);

      const r1902581 = ARGO_FLOAT_CATALOG.find((f) => f.id === 'R1902581_050');
      assert.ok(r1902581);
      assert.strictEqual(r1902581.wmoId, 1902581);
      assert.strictEqual(r1902581.cycleNumber, 50);
      assert.strictEqual(r1902581.latitude, 1.827);
      assert.strictEqual(r1902581.longitude, 76.830);
      assert.strictEqual(r1902581.dataMode, 'Real-Time');

      const sr1902594 = ARGO_FLOAT_CATALOG.find((f) => f.id === 'SR1902594_001');
      assert.ok(sr1902594);
      assert.strictEqual(sr1902594.wmoId, 1902594);
      assert.strictEqual(sr1902594.cycleNumber, 1);
      assert.strictEqual(sr1902594.dataMode, 'Synthetic BGC');
      assert.ok(sr1902594.parameters.includes('DOXY'));
      assert.ok(sr1902594.parameters.includes('CHLA'));
      assert.ok(sr1902594.parameters.includes('NITRATE'));
      assert.ok(sr1902594.parameters.includes('PH_IN_SITU_TOTAL'));
    });

    it('should synchronize selected float ID and cycle number in application store', () => {
      const store = useAppStore.getState();

      store.setSelectedFloat('SR1902594_001', 1);
      const state = useAppStore.getState();
      assert.strictEqual(state.selectedFloatId, 'SR1902594_001');
      assert.strictEqual(state.selectedCycleNumber, 1);

      // Deselect
      store.setSelectedFloat(null);
      assert.strictEqual(useAppStore.getState().selectedFloatId, null);
      assert.strictEqual(useAppStore.getState().selectedCycleNumber, null);
    });

    it('should expose multi-platform observation catalogs for RU29 Glider and RAMA/OMNI moorings', async () => {
      const { GLIDER_CATALOG, OTHER_OBSERVATIONS_CATALOG } = await import('../src/context/app_store.ts');
      assert.ok(GLIDER_CATALOG.length >= 1);
      const ru29 = GLIDER_CATALOG[0];
      assert.strictEqual(ru29.id, 'RU29_Challenger');
      assert.strictEqual(ru29.wmoId, '2801900');
      assert.strictEqual(ru29.profileCount, 951);
      assert.ok(ru29.trajectoryPolyline.length > 5);

      assert.ok(OTHER_OBSERVATIONS_CATALOG.length >= 3);
      const rama = OTHER_OBSERVATIONS_CATALOG.find((m) => m.id === 'RAMA_67E_0N');
      assert.ok(rama);
      assert.strictEqual(rama.type, 'mooring');
      assert.strictEqual(rama.status, 'operational');

      const bd08 = OTHER_OBSERVATIONS_CATALOG.find((m) => m.id === 'INCOIS_BUOY_BD08');
      assert.ok(bd08);
      assert.strictEqual(bd08.type, 'buoy');
    });
  });

  describe('3. Observation Collocation Engine & Residual Analytics', () => {
    it('should compute exact layer residuals, Mean Bias, and RMSE for collocated profile', () => {
      const layers = [
        { depthM: 10, argoTemperature: 28.5, modelTemperature: 28.6, argoSalinity: 35.0, modelSalinity: 35.1 }, // deltaT = 0.1, deltaS = 0.1
        { depthM: 50, argoTemperature: 26.2, modelTemperature: 26.1, argoSalinity: 35.2, modelSalinity: 35.2 }, // deltaT = -0.1, deltaS = 0.0
        { depthM: 100, argoTemperature: 20.1, modelTemperature: 20.3, argoSalinity: 35.5, modelSalinity: 35.4 }, // deltaT = 0.2, deltaS = -0.1
        { depthM: 200, argoTemperature: 14.5, modelTemperature: 14.2, argoSalinity: 35.2, modelSalinity: 35.1 }, // deltaT = -0.3, deltaS = -0.1
      ];

      const model = buildObservationComparisonModel(
        'D1902669_012',
        '2026-08-28T06:14:00Z',
        13.317,
        86.817,
        layers,
        { wmoId: 1902669, cycleNumber: 12, dataMode: 'Delayed-Mode' }
      );

      assert.strictEqual(model.argoProfileId, 'D1902669_012');
      assert.strictEqual(model.samplesCount, 4);

      // Temperature Bias: (0.1 - 0.1 + 0.2 - 0.3) / 4 = -0.1 / 4 = -0.025
      assert.ok(Math.abs(model.meanBias - (-0.025)) < 1e-6);

      // Temperature RMSE: sqrt((0.01 + 0.01 + 0.04 + 0.09) / 4) = sqrt(0.15 / 4) = sqrt(0.0375) ≈ 0.193649
      assert.ok(Math.abs(model.rmse - Math.sqrt(0.0375)) < 1e-6);

      // Salinity Bias: (0.1 + 0.0 - 0.1 - 0.1) / 4 = -0.1 / 4 = -0.025
      assert.ok(model.salinityMeanBias !== undefined);
      assert.ok(Math.abs(model.salinityMeanBias! - (-0.025)) < 1e-6);

      // Salinity RMSE: sqrt((0.01 + 0.0 + 0.01 + 0.01) / 4) = sqrt(0.03 / 4) = sqrt(0.0075) ≈ 0.0866025
      assert.ok(model.salinityRmse !== undefined);
      assert.ok(Math.abs(model.salinityRmse! - Math.sqrt(0.0075)) < 1e-6);

      // Per-layer delta checks
      assert.strictEqual(model.layers[0].qcFlag, 1);
      assert.ok(Math.abs(model.layers[0].delta - 0.1) < 1e-6);
      assert.ok(Math.abs(model.layers[2].delta - 0.2) < 1e-6);
    });

    it('should retrieve predefined collocation models for all operational floats', () => {
      const d12Model = getCollocationModelForFloat('D1902669_012');
      assert.strictEqual(d12Model.argoProfileId, 'D1902669_012');
      assert.strictEqual(d12Model.samplesCount, 12);
      assert.ok(d12Model.rmse < 0.2, 'Delayed-mode RMSE should be under 0.2°C');

      const r50Model = getCollocationModelForFloat('R1902581_050');
      assert.strictEqual(r50Model.argoProfileId, 'R1902581_050');
      assert.strictEqual(r50Model.samplesCount, 12);

      const sr01Model = getCollocationModelForFloat('SR1902594_001');
      assert.strictEqual(sr01Model.argoProfileId, 'SR1902594_001');
      assert.strictEqual(sr01Model.samplesCount, 12);
    });
  });

  describe('4. 2D Analytical Profile Charts across 50 Copernicus Levels', () => {
    it('should verify 50 standard Copernicus depth levels monotonicity and bounds', () => {
      assert.strictEqual(COPERNICUS_50_DEPTH_LEVELS.length, 50);
      assert.ok(Math.abs(COPERNICUS_50_DEPTH_LEVELS[0] - 0.494025) < 1e-4);
      assert.ok(Math.abs(COPERNICUS_50_DEPTH_LEVELS[49] - 5727.917) < 1e-3);

      for (let i = 1; i < COPERNICUS_50_DEPTH_LEVELS.length; i++) {
        assert.ok(
          COPERNICUS_50_DEPTH_LEVELS[i] > COPERNICUS_50_DEPTH_LEVELS[i - 1],
          `Depth level ${i} (${COPERNICUS_50_DEPTH_LEVELS[i]}) must be strictly greater than level ${i - 1} (${COPERNICUS_50_DEPTH_LEVELS[i - 1]})`
        );
      }
    });

    it('should correctly project depth to Y coordinates with linear and logarithmic depth scaling', () => {
      const minD = 0.494;
      const maxD = 5727.917;
      const yMin = 24;
      const yMax = 432;

      // Surface point (0.494m) maps to yMin
      const ySurfaceLin = mapDepthToY(minD, minD, maxD, yMin, yMax, 'linear');
      assert.ok(Math.abs(ySurfaceLin - yMin) < 1e-4);

      const ySurfaceLog = mapDepthToY(minD, minD, maxD, yMin, yMax, 'log');
      assert.ok(Math.abs(ySurfaceLog - yMin) < 1e-4);

      // Deepest point (5727.917m) maps to yMax
      const yDeepLin = mapDepthToY(maxD, minD, maxD, yMin, yMax, 'linear');
      assert.ok(Math.abs(yDeepLin - yMax) < 1e-4);

      const yDeepLog = mapDepthToY(maxD, minD, maxD, yMin, yMax, 'log');
      assert.ok(Math.abs(yDeepLog - yMax) < 1e-4);

      // Thermocline depth (100m) comparison: Log scale gives more vertical space to upper ocean
      const y100Lin = mapDepthToY(100.0, minD, maxD, yMin, yMax, 'linear');
      const y100Log = mapDepthToY(100.0, minD, maxD, yMin, yMax, 'log');

      // In linear scale, 100m is only 100/5728 = ~1.7% down the page
      // In log scale, ln(101)/ln(5729) ≈ 4.615 / 8.653 ≈ 53.3% down the page
      assert.ok(y100Log > y100Lin, 'Log scale must expand upper ocean thermocline relative to linear scale');
    });

    it('should build TEOS-10 derived soundings for Conservative Temp, Salinity, and Potential Density', () => {
      const ctModel = buildTEOS10ProfileChartModel(10.0, 65.0, '2026-08-30T00:00:00Z', 'CT');
      assert.strictEqual(ctModel.totalLevels, 50);
      assert.strictEqual(ctModel.canonicalUnits, '°C');
      assert.ok(ctModel.maxValue > ctModel.minValue);
      assert.ok(ctModel.dataPoints[0].scientificValue! > 25.0, 'Surface temperature should be warm in NIO');

      const saModel = buildTEOS10ProfileChartModel(10.0, 65.0, '2026-08-30T00:00:00Z', 'SA');
      assert.strictEqual(saModel.canonicalUnits, 'g/kg');
      assert.ok(saModel.dataPoints[0].scientificValue! > 34.0, 'Surface salinity should be > 34 g/kg');

      const sigma0Model = buildTEOS10ProfileChartModel(10.0, 65.0, '2026-08-30T00:00:00Z', 'sigma0');
      assert.strictEqual(sigma0Model.canonicalUnits, 'kg/m³');
      assert.ok(
        sigma0Model.dataPoints[49].scientificValue! > sigma0Model.dataPoints[0].scientificValue!,
        'Water column must be stably stratified (density increases with depth)'
      );
    });

    it('should generate accessible SVG containing model profile line and in-situ observation overlay', () => {
      const mockResp: VerticalProfileQueryResponse = {
        response_type: 'authoritative_vertical_profile',
        dataset_id: 'cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m',
        variable_id: 'sea_water_potential_temperature',
        canonical_units: 'degree_Celsius',
        requested_latitude_deg: 13.317,
        requested_longitude_deg: 86.817,
        resolved_latitude_deg: 13.317,
        resolved_longitude_deg: 86.817,
        horizontal_distance_delta_km: 0.0,
        resolved_time_utc: '2026-08-30T00:00:00Z',
        selection_method_used: 'nearest_native_sample',
        total_levels: 4,
        valid_levels_count: 4,
        source_asset_id: 'copernicus_phy_thetao_20260824_20260830.nc',
        source_asset_sha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
        samples: [
          { level_index: 0, depth_m: 5.0, scientific_value: 29.4, value_state: 'valid' },
          { level_index: 1, depth_m: 50.0, scientific_value: 28.3, value_state: 'valid' },
          { level_index: 2, depth_m: 100.0, scientific_value: 21.9, value_state: 'valid' },
          { level_index: 3, depth_m: 200.0, scientific_value: 14.4, value_state: 'valid' },
        ],
      };

      const observedPoints = [
        { levelIndex: 0, depthM: 5.0, scientificValue: 29.35, valueState: 'valid' as const, isGap: false },
        { levelIndex: 1, depthM: 50.0, scientificValue: 28.45, valueState: 'valid' as const, isGap: false },
        { levelIndex: 2, depthM: 100.0, scientificValue: 21.80, valueState: 'valid' as const, isGap: false },
        { levelIndex: 3, depthM: 200.0, scientificValue: 14.30, valueState: 'valid' as const, isGap: false },
      ];

      const model = buildVerticalProfileChartModel(mockResp, {
        observedPoints,
        observationLabel: 'Argo D1902669_012',
      });

      const svg = generateVerticalProfileSvg(model, DEFAULT_CHART_DIMENSIONS, 'linear');

      assert.ok(svg.includes('<svg'), 'Must produce valid SVG root');
      assert.ok(svg.includes('class="profile-line"'), 'Must contain model profile path');
      assert.ok(svg.includes('class="obs-line"'), 'Must contain observation overlay path');
      assert.ok(svg.includes('class="obs-point"'), 'Must render in-situ observation point circles');
      assert.ok(svg.includes('class="data-point"'), 'Must render model data point circles');
    });
  });
});
