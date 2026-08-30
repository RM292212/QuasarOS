import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  VolumeSession,
  DepthLookupTable,
  CoordinateTransformer,
  LodSelector,
  BrickPlanner,
  ResidentBrickLedger,
  RenderPacketSynthesizer,
  ProvisionalPickMapper,
  isBoundingBoxInFrustum,
  createIdentityMatrix,
  type AbstractViewState,
  type FrustumPlane,
} from '../src/index.ts';

// Resolve real baseline assets
const REPO_ROOT = path.resolve(process.cwd(), '../..');
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

// Standard unit frustum planes enclosing [0, 1]^3 with generous margins
function createTestFrustumPlanes(): readonly [
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
  FrustumPlane,
] {
  return [
    { normal: { x: 1, y: 0, z: 0 }, distance: 0.1 }, // Left plane: x >= -0.1
    { normal: { x: -1, y: 0, z: 0 }, distance: 1.1 }, // Right plane: x <= 1.1
    { normal: { x: 0, y: 1, z: 0 }, distance: 0.1 }, // Bottom plane: y >= -0.1
    { normal: { x: 0, y: -1, z: 0 }, distance: 1.1 }, // Top plane: y <= 1.1
    { normal: { x: 0, y: 0, z: 1 }, distance: 0.1 }, // Near plane: z >= -0.1
    { normal: { x: 0, y: 0, z: -1 }, distance: 1.1 }, // Far plane: z <= 1.1
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

describe('TASK-07C: Abstract View State & Frustum Culling', () => {
  it('should test bounding box frustum intersection correctly', () => {
    const planes = createTestFrustumPlanes();

    // Inside box
    const insideBox = {
      min: { x: 0.2, y: 0.2, z: 0.2 },
      max: { x: 0.8, y: 0.8, z: 0.8 },
    };
    assert.equal(isBoundingBoxInFrustum(insideBox, planes), true);

    // Completely outside box (x > 2.0)
    const outsideBox = {
      min: { x: 2.0, y: 0.2, z: 0.2 },
      max: { x: 3.0, y: 0.8, z: 0.8 },
    };
    assert.equal(isBoundingBoxInFrustum(outsideBox, planes), false);
  });
});

describe('TASK-07C: LOD Selector with Hysteresis Stability', () => {
  it('should evaluate projected voxel sizes and select finest LOD 0 when camera is close', () => {
    const selector = new LodSelector(availableLods, { targetScreenErrorPx: 2.0, hysteresisMarginFactor: 1.25 });

    // Camera very close: distance = 0.5 in volume units
    const closeViewState = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 0.6 },
    });

    const result = selector.selectLod(closeViewState);
    assert.equal(result.selectedLodLevel, 0);
    assert.equal(result.levelProjections.length, 3);
    assert.equal(result.hysteresisApplied, false);
  });

  it('should select coarsest LOD 2 when camera is distant', () => {
    const selector = new LodSelector(availableLods, { targetScreenErrorPx: 2.0, hysteresisMarginFactor: 1.25 });

    // Camera distant: distance = 100.0 in volume units
    const farViewState = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 100.0 },
    });

    const result = selector.selectLod(farViewState);
    assert.equal(result.selectedLodLevel, 2);
  });

  it('should apply hysteresis to prevent rapid oscillation across boundaries', () => {
    const selector = new LodSelector(availableLods, { targetScreenErrorPx: 2.0, hysteresisMarginFactor: 1.5 });

    // 1. Initial selection at distance = 10.0 -> LOD 1 or 2
    const viewState1 = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 10.0 },
    });
    const res1 = selector.selectLod(viewState1);
    const initialLod = res1.selectedLodLevel;

    // 2. Small perturbance that would border between LODs
    const viewState2 = createMockViewState({
      cameraPositionVolume: { x: 0.5, y: 0.5, z: 9.8 },
    });
    const res2 = selector.selectLod(viewState2);
    // Should preserve initial LOD due to hysteresis margin
    assert.equal(res2.selectedLodLevel, initialLod);
  });
});

describe('TASK-07C: Visibility & Required-Brick Planner', () => {
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

  it('should plan required bricks for LOD 0 and resolve fallback parent bricks', () => {
    const planner = new BrickPlanner(manifestBricks, availableLods, transformer);
    const viewState = createMockViewState();

    const plan = planner.plan(0, 0, viewState);
    assert.equal(plan.targetLodLevel, 0);
    assert.equal(plan.timestepIndex, 0);
    assert.equal(plan.totalBricksEvaluated, 6); // 6 bricks at LOD 0
    assert.equal(plan.visibleBricksCount, 6);

    // Verify fallback resolutions
    assert.equal(plan.fallbackResolutions.size, 6);
    for (const [fineKey, parentKey] of plan.fallbackResolutions) {
      assert.ok(parentKey.includes('lod1') || parentKey.includes('lod2'));
    }

    // Verify priority scoring
    for (const brick of plan.requiredBricks) {
      assert.ok(brick.priority.compositeScore > 0);
      assert.equal(brick.priority.isVisibleInViewport, true);
    }
  });

  it('should cull bricks outside clipping box', () => {
    const planner = new BrickPlanner(manifestBricks, availableLods, transformer);
    const viewState = createMockViewState();

    // Clip box tightly around south region (v: [0, 0.3])
    const clipping = {
      minU: 0.0,
      maxU: 1.0,
      minV: 0.0,
      maxV: 0.3,
      minW: 0.0,
      maxW: 1.0,
    };

    const plan = planner.plan(0, 0, viewState, clipping);
    assert.ok(plan.visibleBricksCount < plan.totalBricksEvaluated);
    assert.ok(plan.culledBricks.length > 0);
  });
});

describe('TASK-07C: Resident Brick Ledger & Memory Coordinator', () => {
  it('should track state transitions and manage memory budget', () => {
    const ledger = new ResidentBrickLedger({ maxMemoryBudgetBytes: 1024 * 1024 }); // 1 MiB budget
    assert.equal(ledger.allocatedBytes, 0);

    const testBrickKey = 'test_brick_0';
    const recReq = ledger.markRequested(testBrickKey, 0, 0, 'f16');
    assert.equal(recReq.state, 'REQUESTED');

    ledger.markStreaming(testBrickKey, 'f16');
    assert.equal(ledger.getRecord(testBrickKey)?.state, 'STREAMING');

    const mockDecoded = {
      brickKey: testBrickKey,
      representation: 'f16' as const,
      sampleShape: [66, 66, 32] as [number, number, number],
      interiorValidShape: [64, 64, 31] as [number, number, number],
      haloPadding: [1, 1, 0] as [number, number, number],
      sampleOrigin: [0, 0, 0] as [number, number, number],
      spatialBounds: visProduct.spatial_bounds,
      minDepthM: 0.49,
      maxDepthM: 453.93,
      scalarMin: 10.0,
      scalarMax: 30.0,
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

    ledger.registerResident(testBrickKey, mockDecoded, 'f16');
    assert.equal(ledger.isResident(testBrickKey), true);
    assert.equal(ledger.allocatedBytes, 278784);

    const report = ledger.getMemoryReport();
    assert.equal(report.residentBricksCount, 1);
    assert.equal(report.allocatedBytes, 278784);
  });

  it('should protect pinned fallback parent bricks during LRU eviction', () => {
    const ledger = new ResidentBrickLedger({ maxMemoryBudgetBytes: 300000 }); // ~300 KB budget

    const mockBrick1 = {
      brickKey: 'brick_parent_lod1',
      memorySizeBytes: 150000,
    } as any;

    const mockBrick2 = {
      brickKey: 'brick_fine_lod0',
      memorySizeBytes: 200000,
    } as any;

    ledger.registerResident('brick_parent_lod1', mockBrick1, 'f16');
    ledger.setPinnedFallback('brick_parent_lod1', true, 'f16');

    // Register second brick causing budget overflow (150KB + 200KB = 350KB > 300KB)
    ledger.registerResident('brick_fine_lod0', mockBrick2, 'f16');

    // Evict excess
    const evicted = ledger.evictExcess();
    // Pinned fallback should NOT be evicted
    assert.equal(ledger.isResident('brick_parent_lod1'), true);
    assert.ok(evicted.includes('brick_fine_lod0'));
  });
});

describe('TASK-07C: RenderPacket Synthesizer & Provisional Pick Mapper', () => {
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

  it('should synthesize frame-ready RenderPacket with fallback fallback degradation indicator', () => {
    const planner = new BrickPlanner(manifestBricks, availableLods, transformer);
    const viewState = createMockViewState();
    const plan = planner.plan(0, 0, viewState);

    const ledger = new ResidentBrickLedger();

    // Register only LOD 1 fallback parent
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
      clippingBox: { minU: 0, maxU: 1, minV: 0, maxV: 1, minW: 0, maxW: 1 },
      scalarMin: 9.3747,
      scalarMax: 30.3618,
      canonicalUnits: 'degree_Celsius',
    });

    assert.ok(packet.packetId.startsWith('pkt_'));
    assert.equal(packet.targetLodLevel, 0);
    assert.equal(packet.isDegraded, true); // Used fallback parent
    assert.equal(packet.depthLutEntriesM.length, 31);
    assert.ok(packet.activeBricksCount > 0);
    assert.equal(packet.bricks.length, packet.activeBricksCount);
    assert.equal(packet.bricks[0].isFallback, true);
    assert.equal(packet.canonicalUnits, 'degree_Celsius');
  });

  it('should map provisional ray hit coordinates and construct ReconcilePickRequest', () => {
    const picker = new ProvisionalPickMapper(transformer);

    const hitResult = picker.mapHit({
      volumeCoord: { u: 0.5, v: 0.5, w: 0.5 },
      provisionalScalarValue: 24.5,
      renderedLodLevel: 1,
      estimatedSampleErrorBound: 0.05,
      datasetId: 'copernicus_phy_thetao',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: visProduct.visualization_product_id,
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degree_Celsius',
      targetTimeUtc: '2026-08-24T12:00:00Z',
    });

    // Verify ProvisionalPick
    const prov = hitResult.provisionalPick;
    assert.equal(prov.response_type, 'approximate_render_sample');
    assert.equal(prov.lod_level, 1);
    assert.equal(prov.approximate_value, 24.5);
    assert.equal(prov.display_units, 'degree_Celsius');
    assert.equal(prov.world_ray_hit_position.length, 3);

    // Verify ReconcilePickRequest
    const rec = hitResult.reconcileRequest;
    assert.equal(rec.dataset_id, 'copernicus_phy_thetao');
    assert.equal(rec.variable_id, 'sea_water_potential_temperature');
    assert.equal(rec.target_time_utc, '2026-08-24T12:00:00Z');
    assert.ok(Math.abs((rec.longitude_deg ?? 0) - 84.0) < 0.05);
    assert.ok(Math.abs((rec.latitude_deg ?? 0) - 4.5) < 0.05);
  });
});
