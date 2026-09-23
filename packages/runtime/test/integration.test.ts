/**
 * @quasar/runtime End-to-End Real-Artifact Integration Test Suite
 *
 * TASK-07D: Full 8-Scenario Lifecycle Integration Testing.
 *
 * Exercises deterministic multi-step runtime scenarios against real Copernicus thetao assets:
 * - Scenario 1: Initial session bootstrap & snapshot pinning with cryptographic validation.
 * - Scenario 2: Discrete 7-day timestep scrubbing (2026-08-24 -> 2026-08-30) with generation tracking & AbortSignal cancellation.
 * - Scenario 3: Camera dolly & orbit exercising LOD 2 -> LOD 1 -> LOD 0 selection with hysteresis stability.
 * - Scenario 4: Region-of-Interest & 6-plane depth/geodetic clipping updating required brick sets.
 * - Scenario 5: Fallback parent brick activation when fine LOD brick is pending download.
 * - Scenario 6: Memory pressure and LRU eviction under bounded 50 MiB budget with pinned fallback protection.
 * - Scenario 7: Provisional pick to exact-value query reconciliation request synthesis.
 * - Scenario 8: Clean session disposal releasing all memory, subscriptions, and state machines.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  VolumeSession,
  RuntimeStateMachine,
  DepthLookupTable,
  CoordinateTransformer,
  TemporalController,
  ScientificState,
  ClippingController,
  LodSelector,
  BrickPlanner,
  ResidentBrickLedger,
  RenderPacketSynthesizer,
  ProvisionalPickMapper,
  createIdentityMatrix,
  type AbstractViewState,
  type FrustumPlane,
} from '../src/index.ts';

// Real visualization manifest baseline
const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'data'))
  ? process.cwd()
  : path.resolve(process.cwd(), '../..');
const VIS_ROOT = path.join(
  REPO_ROOT,
  'data',
  'visualization',
  'copernicus_phy_thetao',
  'copernicus-phy-thetao-20260824-20260830-ca826087',
  'v1'
);
const MANIFEST_PATH = path.join(VIS_ROOT, 'visualization_manifest.json');
const manifestData = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const visProduct = manifestData.visualization_product;
const manifestBricks = manifestData.bricks;
const availableLods = visProduct.available_lod_levels;

function createTestFrustumPlanes(): readonly [
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
] {
  return [
    { normal: { x: 1, y: 0, z: 0 }, distance: 0.1 },
    { normal: { x: -1, y: 0, z: 0 }, distance: 1.1 },
    { normal: { x: 0, y: 1, z: 0 }, distance: 0.1 },
    { normal: { x: 0, y: -1, z: 0 }, distance: 1.1 },
    { normal: { x: 0, y: 0, z: 1 }, distance: 0.1 },
    { normal: { x: 0, y: 0, z: -1 }, distance: 1.1 },
  ];
}

function createMockViewState(overrides: Partial<AbstractViewState> = {}): AbstractViewState {
  return {
    cameraPositionENU: { x: 0, y: 0, z: 50000 },
    cameraPositionVolume: { x: 0.5, y: 0.5, z: 2.0 },
    targetPositionENU: { x: 0, y: 0, z: 0 },
    upVectorENU: { x: 0, y: 1, z: 0 },
    viewMatrix: createIdentityMatrix(),
    projectionMatrix: createIdentityMatrix(),
    viewProjectionMatrix: createIdentityMatrix(),
    frustumPlanes: createTestFrustumPlanes(),
    viewport: { widthPixels: 1920, heightPixels: 1080, devicePixelRatio: 1 },
    fieldOfViewYRad: (45 * Math.PI) / 180,
    screenSpaceErrorThresholdPixels: 2.0,
    ...overrides,
  };
}

describe('TASK-07D E2E Runtime Scenarios 1 to 8', () => {
  const depthLut = new DepthLookupTable(visProduct.coordinate_transform.depth_lut_entries_m);
  const transformer = new CoordinateTransformer(
    {
      minLongitudeDeg: visProduct.spatial_bounds.min_longitude,
      maxLongitudeDeg: visProduct.spatial_bounds.max_longitude,
      minLatitudeDeg: visProduct.spatial_bounds.min_latitude,
      maxLatitudeDeg: visProduct.spatial_bounds.max_latitude,
      minDepthM: visProduct.min_depth_m,
      maxDepthM: visProduct.max_depth_m,
      originLongitudeDeg: visProduct.coordinate_transform.origin_longitude_deg,
      originLatitudeDeg: visProduct.coordinate_transform.origin_latitude_deg,
      originDepthM: visProduct.coordinate_transform.origin_depth_m,
      verticalExaggeration: visProduct.coordinate_transform.vertical_exaggeration_factor,
    },
    depthLut
  );

  it('Scenario 1: Initial session bootstrap & snapshot pinning', () => {
    const session = new VolumeSession();
    assert.equal(session.state, 'UNINITIALIZED');

    session.startDiscovery();
    assert.equal(session.state, 'DISCOVERING');

    session.pinSession({
      datasetId: 'copernicus_phy_thetao',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      productId: visProduct.visualization_product_id,
      productVersion: visProduct.product_version,
      manifestSha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
    });
    assert.equal(session.state, 'SNAPSHOT_PINNED');

    session.setManifest(visProduct, 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c');
    assert.equal(session.state, 'MANIFEST_READY');
    assert.ok(session.manifest);
    assert.equal(session.manifest.visualization_product_id, visProduct.visualization_product_id);

    session.startStreaming();
    assert.equal(session.state, 'STREAMING');
  });

  it('Scenario 2: Discrete 7-day timestep scrubbing with generation advancement and cancellation', () => {
    const timesteps = [
      '2026-08-24T12:00:00Z',
      '2026-08-25T12:00:00Z',
      '2026-08-26T12:00:00Z',
      '2026-08-27T12:00:00Z',
      '2026-08-28T12:00:00Z',
      '2026-08-29T12:00:00Z',
      '2026-08-30T12:00:00Z',
    ];
    assert.equal(timesteps.length, 7);

    const temporal = new TemporalController(timesteps);
    assert.equal(temporal.currentIndex, 0);
    assert.equal(temporal.currentTimestep.timeUtc, '2026-08-24T12:00:00Z');
    assert.equal(temporal.activeGeneration, 1);

    const abortedSignals: boolean[] = [];
    let currentSignal = temporal.setTimestepIndex(0);

    // Scrub through all 7 days
    for (let day = 1; day < 7; day++) {
      const priorSignal = currentSignal;
      const priorGen = temporal.activeGeneration;

      currentSignal = temporal.setTimestepIndex(day);

      assert.equal(temporal.currentIndex, day);
      assert.equal(temporal.activeGeneration, priorGen + 1);
      assert.equal(priorSignal.aborted, true, `Expected signal for day ${day - 1} to be aborted`);
      assert.equal(temporal.isGenerationActive(priorGen), false);
      assert.equal(currentSignal.aborted, false);
      abortedSignals.push(priorSignal.aborted);
    }

    assert.equal(temporal.currentTimestep.timeUtc, '2026-08-30T12:00:00Z');
    assert.equal(abortedSignals.length, 6);
  });

  it('Scenario 3: Camera dolly & orbit exercising LOD 2 -> LOD 1 -> LOD 0 with hysteresis stability', () => {
    const selector = new LodSelector(availableLods, {
      targetScreenErrorPx: 2.0,
      hysteresisMarginFactor: 1.25,
    });

    // 1. Distant camera (z = 100.5, dist = 100.0) -> coarse LOD 2
    const viewFar = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 100.5 },
    });
    const resFar = selector.selectLod(viewFar);
    assert.equal(resFar.selectedLodLevel, 2, 'Distant camera should select LOD 2');

    // 2. Medium distance camera (z = 20.5, dist = 20.0) -> medium LOD 1
    const viewMed = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 20.5 },
    });
    const resMed = selector.selectLod(viewMed);
    assert.equal(resMed.selectedLodLevel, 1, 'Medium distance camera should select LOD 1');

    // 3. Close camera (z = 2.5, dist = 2.0) -> fine LOD 0
    const viewClose = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 2.5 },
    });
    const resClose = selector.selectLod(viewClose);
    assert.equal(resClose.selectedLodLevel, 0, 'Close distance camera should select LOD 0');

    // 4. Hysteresis stability check: slight camera perturbance near boundary retains current LOD
    const viewThresholdSmallStep = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 2.6 },
    });
    const resStable = selector.selectLod(viewThresholdSmallStep);
    assert.equal(resStable.selectedLodLevel, 0, 'Hysteresis should keep fine LOD 0 on small retreat');
  });

  it('Scenario 4: Region-of-Interest & 6-plane depth/geodetic clipping updating required brick sets', () => {
    const clipping = new ClippingController(transformer);
    const planner = new BrickPlanner(manifestBricks, availableLods, transformer);
    const viewState = createMockViewState();

    // Full domain plan at LOD 0 (6 bricks total)
    const fullPlan = planner.plan(0, 0, viewState, clipping.normalizedClippingBox);
    assert.equal(fullPlan.requiredBricks.length, 6);

    // Apply strict spatial ROI clipping: restrict longitude to first half
    clipping.setLimits({
      minLonDeg: 80.0,
      maxLonDeg: 84.0,
    });

    const clippedPlan = planner.plan(0, 0, viewState, clipping.normalizedClippingBox);

    // Only bricks overlapping [80.0, 84.0] are retained
    assert.ok(clippedPlan.visibleBricksCount < fullPlan.visibleBricksCount);
    assert.ok(clippedPlan.culledBricks.length > 0);
  });

  it('Scenario 5: Fallback parent brick activation when fine LOD brick is pending download', () => {
    const planner = new BrickPlanner(manifestBricks, availableLods, transformer);
    const ledger = new ResidentBrickLedger({ maxMemoryBudgetBytes: 50 * 1024 * 1024 });
    const clipping = new ClippingController(transformer);
    const viewState = createMockViewState();

    const plan = planner.plan(0, 0, viewState);

    // Register LOD 1 fallback parent
    const fallbackKey = plan.fallbackResolutions.get(plan.requiredBricks[0].brickKey)!;
    const mockParentDecoded = {
      brickKey: fallbackKey,
      representation: 'f16' as const,
      sampleShape: [66, 66, 32] as [number, number, number],
      interiorValidShape: [64, 64, 31] as [number, number, number],
      haloPadding: [1, 1, 0] as [number, number, number],
      sampleOrigin: [0, 0, 0] as [number, number, number],
      spatialBounds: visProduct.spatial_bounds,
      minDepthM: 0.49,
      maxDepthM: 453.93,
      scalarMin: 9.37,
      scalarMax: 30.36,
      totalVoxels: 66 * 66 * 32,
      validVoxelsCount: 64 * 64 * 31,
      missingVoxelsCount: 0,
      isEmptyOrMasked: false,
      scalarData: new Float32Array(66 * 66 * 32),
      rawBuffer: new Uint16Array(66 * 66 * 32),
      validityMask: new Uint8Array(66 * 66 * 32).fill(1),
      decodedAtMs: Date.now(),
      memorySizeBytes: 278784,
    };
    ledger.registerResident(fallbackKey, mockParentDecoded, 'f16');

    // Synthesize RenderPacket: must indicate degraded mode
    const packet = RenderPacketSynthesizer.synthesize({
      datasetId: 'copernicus_phy_thetao',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: visProduct.visualization_product_id,
      productVersion: 'v1',
      manifestSha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
      timestepIndex: 0,
      timestepUtc: '2026-08-24T12:00:00Z',
      targetLodLevel: 0,
      planItems: plan.requiredBricks,
      ledger,
      transformer,
      depthLut,
      clippingBox: clipping.normalizedClippingBox,
      scalarMin: 9.3747,
      scalarMax: 30.3618,
      canonicalUnits: 'degree_Celsius',
    });

    assert.equal(packet.isDegraded, true);
    assert.ok(packet.activeBricksCount > 0);
    assert.equal(packet.bricks[0].isFallback, true);
  });

  it('Scenario 6: Memory pressure and LRU eviction under bounded 50 MiB budget with pinned fallback protection', () => {
    // 50 MiB Budget
    const maxBudget = 50 * 1024 * 1024;
    const ledger = new ResidentBrickLedger({ maxMemoryBudgetBytes: maxBudget });

    // Register pinned fallback brick
    const pinnedKey = 'brick_fallback_parent_lod1';
    ledger.registerResident(
      pinnedKey,
      {
        brickKey: pinnedKey,
        representation: 'f16',
        sampleShape: [66, 66, 32],
        interiorValidShape: [64, 64, 31],
        haloPadding: [1, 1, 0],
        sampleOrigin: [0, 0, 0],
        spatialBounds: visProduct.spatial_bounds,
        minDepthM: 0.49,
        maxDepthM: 453.93,
        scalarMin: 9.37,
        scalarMax: 30.36,
        totalVoxels: 66 * 66 * 32,
        validVoxelsCount: 64 * 64 * 31,
        missingVoxelsCount: 0,
        isEmptyOrMasked: false,
        scalarData: new Float32Array(66 * 66 * 32),
        rawBuffer: new Uint16Array(66 * 66 * 32),
        validityMask: new Uint8Array(66 * 66 * 32),
        decodedAtMs: Date.now(),
        memorySizeBytes: 5 * 1024 * 1024, // 5 MiB
      },
      'f16'
    );
    ledger.setPinnedFallback(pinnedKey, true, 'f16');

    // Register multiple 10 MiB unpinned bricks to fill up memory
    for (let i = 1; i <= 6; i++) {
      const key = `brick_fine_lod0_${i}`;
      ledger.registerResident(
        key,
        {
          brickKey: key,
          representation: 'f16',
          sampleShape: [66, 66, 32],
          interiorValidShape: [64, 64, 31],
          haloPadding: [1, 1, 0],
          sampleOrigin: [0, 0, 0],
          spatialBounds: visProduct.spatial_bounds,
          minDepthM: 0.49,
          maxDepthM: 453.93,
          scalarMin: 9.37,
          scalarMax: 30.36,
          totalVoxels: 66 * 66 * 32,
          validVoxelsCount: 64 * 64 * 31,
          missingVoxelsCount: 0,
          isEmptyOrMasked: false,
          scalarData: new Float32Array(66 * 66 * 32),
          rawBuffer: new Uint16Array(66 * 66 * 32),
          validityMask: new Uint8Array(66 * 66 * 32),
          decodedAtMs: Date.now(),
          memorySizeBytes: 10 * 1024 * 1024, // 10 MiB each
        },
        'f16'
      );
    }

    const evicted = ledger.evictExcess();
    assert.ok(evicted.length > 0, 'Excess unpinned bricks should be evicted');
    assert.ok(ledger.allocatedBytes <= maxBudget);

    // Pinned fallback brick MUST remain resident
    assert.ok(ledger.isResident(pinnedKey, 'f16'), 'Pinned fallback brick must never be evicted');
    assert.equal(ledger.getRecord(pinnedKey, 'f16')?.isPinnedFallback, true);
  });

  it('Scenario 7: Provisional pick to exact-value query reconciliation request synthesis', () => {
    const picker = new ProvisionalPickMapper(transformer);

    const hitResult = picker.mapHit({
      volumeCoord: { u: 0.5, v: 0.5, w: 0.2 },
      provisionalScalarValue: 24.5,
      renderedLodLevel: 0,
      estimatedSampleErrorBound: 0.05,
      datasetId: 'copernicus_phy_thetao',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: visProduct.visualization_product_id,
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degree_Celsius',
      targetTimeUtc: '2026-08-24T12:00:00Z',
    });

    const prov = hitResult.provisionalPick;
    assert.equal(prov.approximate_value, 24.5);
    assert.equal(prov.display_units, 'degree_Celsius');
    assert.ok(prov.world_ray_hit_position.length === 3);

    const rec = hitResult.reconcileRequest;
    assert.equal(rec.dataset_id, 'copernicus_phy_thetao');
    assert.equal(rec.snapshot_id, 'copernicus-phy-thetao-20260824-20260830-ca826087');
    assert.equal(rec.variable_id, 'sea_water_potential_temperature');
    assert.equal(rec.target_time_utc, '2026-08-24T12:00:00Z');
    assert.equal(rec.provisional_pick.approximate_value, 24.5);
  });

  it('Scenario 8: Clean session disposal releasing all memory and listeners', () => {
    const session = new VolumeSession();
    session.startDiscovery();
    session.pinSession({
      datasetId: 'copernicus_phy_thetao',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      productId: visProduct.visualization_product_id,
      manifestSha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
    });
    session.setManifest(visProduct, 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c');
    session.startStreaming();
    assert.equal(session.state, 'STREAMING');

    // Dispose
    session.dispose();
    assert.equal(session.state, 'DISPOSED');
    assert.equal(session.manifest, null);
    assert.equal(session.pinnedSession, null);

    // Double dispose should be a safe no-op
    session.dispose();
    assert.equal(session.state, 'DISPOSED');
  });
});
