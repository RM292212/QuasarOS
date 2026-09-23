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
  InvalidStateTransitionError,
  CoordinateBoundsError,
  SessionIntegrityError,
  StaleTemporalRequestError,
  ClippingRangeError,
} from '../src/index.ts';

// Resolve real baseline assets
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

describe('QuasarOS Volume Session & FSM Subsystems', () => {
  it('should enforce 11 lifecycle states and valid transitions', () => {
    const fsm = new RuntimeStateMachine();
    assert.equal(fsm.state, 'UNINITIALIZED');

    // UNINITIALIZED -> DISCOVERING
    assert.equal(fsm.canTransition('START_DISCOVERY'), true);
    fsm.transition('START_DISCOVERY', 'Begin discovery');
    assert.equal(fsm.state, 'DISCOVERING');

    // DISCOVERING -> SNAPSHOT_PINNED
    fsm.transition('PIN_SNAPSHOT', 'Pinned snapshot');
    assert.equal(fsm.state, 'SNAPSHOT_PINNED');

    // SNAPSHOT_PINNED -> MANIFEST_LOADING
    fsm.transition('LOAD_MANIFEST', 'Loading manifest');
    assert.equal(fsm.state, 'MANIFEST_LOADING');

    // MANIFEST_LOADING -> MANIFEST_READY
    fsm.transition('MANIFEST_PARSED', 'Parsed manifest');
    assert.equal(fsm.state, 'MANIFEST_READY');

    // MANIFEST_READY -> STREAMING
    fsm.transition('START_STREAMING', 'Start streaming');
    assert.equal(fsm.state, 'STREAMING');

    // STREAMING -> DEGRADED
    fsm.transition('FALLBACK_LOD_AVAILABLE', 'Fallback LOD');
    assert.equal(fsm.state, 'DEGRADED');

    // DEGRADED -> READY
    fsm.transition('LOD_REFINED', 'Refined LOD');
    assert.equal(fsm.state, 'READY');

    // READY -> STREAMING (viewport change)
    fsm.transition('VIEWPORT_CHANGED', 'Camera rotated');
    assert.equal(fsm.state, 'STREAMING');

    // STREAMING -> ERROR
    fsm.transition('FATAL_ERROR', 'Network outage', new Error('Network timeout'));
    assert.equal(fsm.state, 'ERROR');
    assert.ok(fsm.lastError);

    // ERROR -> MANIFEST_READY (retry)
    fsm.transition('RETRY_STREAMING', 'Retrying streaming');
    assert.equal(fsm.state, 'MANIFEST_READY');

    // MANIFEST_READY -> DISPOSING -> DISPOSED
    fsm.transition('DISPOSE', 'Tearing down');
    assert.equal(fsm.state, 'DISPOSING');
    fsm.transition('DISPOSAL_COMPLETE', 'Disposed');
    assert.equal(fsm.state, 'DISPOSED');
    assert.equal(fsm.isTerminal, true);

    // Any transition from DISPOSED must throw InvalidStateTransitionError
    assert.throws(() => {
      fsm.transition('START_DISCOVERY');
    }, InvalidStateTransitionError);
  });

  it('should pin session identity and reject mutation or manifest mismatch', () => {
    const session = new VolumeSession();
    assert.equal(session.state, 'UNINITIALIZED');

    const pinned = session.pinSession({
      datasetId: 'copernicus_phy_thetao',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      productId: 'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087',
      productVersion: 'v1',
      manifestSha256: 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c',
    });

    assert.equal(pinned.snapshotId, 'copernicus-phy-thetao-20260824-20260830-ca826087');
    assert.equal(session.state, 'SNAPSHOT_PINNED');

    // Re-pinning different snapshot must throw SessionIntegrityError
    assert.throws(() => {
      session.pinSession({
        datasetId: 'copernicus_phy_thetao',
        snapshotId: 'copernicus-phy-thetao-drifted-snapshot',
        productId: 'vis_drifted',
        manifestSha256: 'deadbeef',
      });
    }, SessionIntegrityError);

    // Setting manifest with mismatching digest or dataset must throw SessionIntegrityError
    assert.throws(() => {
      session.setManifest({
        ...visProduct,
        source_dataset_id: 'wrong_dataset_id',
      }, 'deadbeef');
    }, SessionIntegrityError);

    // Valid manifest acceptance
    session.setManifest(visProduct, 'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c');
    assert.equal(session.state, 'MANIFEST_READY');
    assert.ok(session.manifest);
  });
});

describe('QuasarOS Coordinates & Non-Uniform Depth LUT Subsystems', () => {
  const depthEntries = visProduct.coordinate_transform.depth_lut_entries_m;

  it('should initialize DepthLookupTable across all 31 non-uniform levels and preserve exact levels', () => {
    assert.equal(depthEntries.length, 31);
    const lut = new DepthLookupTable(depthEntries);

    assert.equal(lut.levelCount, 31);
    assert.equal(lut.minDepthM, depthEntries[0]);
    assert.equal(lut.maxDepthM, depthEntries[30]);

    // Test exact discrete levels
    for (let i = 0; i < depthEntries.length; i++) {
      const z = depthEntries[i];
      assert.equal(lut.getDepthAtLevel(i), z);

      const bracket = lut.findBracketingLevels(z);
      assert.equal(bracket.isExactLevel, true);
      assert.equal(bracket.exactLevelIndex, i);
      assert.equal(bracket.interpolationFraction, 0.0);

      // Normalized conversion round-trip
      const w = lut.physicalToNormalized(z);
      assert.ok(Math.abs(w - i / 30.0) < 1e-7);
      const zRoundTrip = lut.normalizedToPhysical(w);
      assert.ok(Math.abs(zRoundTrip - z) < 1e-5);
    }
  });

  it('should accurately interpolate intermediate continuous depths and compute bracketing fractions', () => {
    const lut = new DepthLookupTable(depthEntries);

    // Intermediate depth between level 0 (0.494m) and level 1 (1.541m)
    const zMid = (depthEntries[0] + depthEntries[1]) * 0.5;
    const bracket = lut.findBracketingLevels(zMid);
    assert.equal(bracket.isExactLevel, false);
    assert.equal(bracket.lowerLevelIndex, 0);
    assert.equal(bracket.upperLevelIndex, 1);
    assert.ok(Math.abs(bracket.interpolationFraction - 0.5) < 1e-6);

    // Out of bounds error checking
    assert.throws(() => {
      lut.findBracketingLevels(-10.0, false);
    }, CoordinateBoundsError);

    assert.throws(() => {
      lut.findBracketingLevels(1000.0, false);
    }, CoordinateBoundsError);

    // Clamped evaluation
    const clampedUpper = lut.findBracketingLevels(1000.0, true);
    assert.equal(clampedUpper.upperLevelIndex, 30);
  });

  it('should perform bidirectional Geodetic <-> Normalized Volume Space transformations', () => {
    const lut = new DepthLookupTable(depthEntries);
    const transformer = new CoordinateTransformer(
      {
        minLongitudeDeg: 80.0,
        maxLongitudeDeg: 88.0,
        minLatitudeDeg: -3.0,
        maxLatitudeDeg: 12.0,
        minDepthM: depthEntries[0],
        maxDepthM: depthEntries[30],
      },
      lut
    );

    // Boundary check
    const minGeodetic = { longitudeDeg: 80.0, latitudeDeg: -3.0, depthM: depthEntries[0] };
    const minNorm = transformer.geodeticToNormalized(minGeodetic);
    assert.ok(Math.abs(minNorm.u - 0.0) < 1e-7);
    assert.ok(Math.abs(minNorm.v - 0.0) < 1e-7);
    assert.ok(Math.abs(minNorm.w - 0.0) < 1e-7);

    const maxGeodetic = { longitudeDeg: 88.0, latitudeDeg: 12.0, depthM: depthEntries[30] };
    const maxNorm = transformer.geodeticToNormalized(maxGeodetic);
    assert.ok(Math.abs(maxNorm.u - 1.0) < 1e-7);
    assert.ok(Math.abs(maxNorm.v - 1.0) < 1e-7);
    assert.ok(Math.abs(maxNorm.w - 1.0) < 1e-7);

    // Center point round-trip
    const centerGeodetic = { longitudeDeg: 84.0, latitudeDeg: 4.5, depthM: depthEntries[15] };
    const centerNorm = transformer.geodeticToNormalized(centerGeodetic);
    assert.ok(Math.abs(centerNorm.u - 0.5) < 1e-7);
    assert.ok(Math.abs(centerNorm.v - 0.5) < 1e-7);
    assert.ok(Math.abs(centerNorm.w - 0.5) < 1e-7);

    const roundTrip = transformer.normalizedToGeodetic(centerNorm);
    assert.ok(Math.abs(roundTrip.longitudeDeg - centerGeodetic.longitudeDeg) < 1e-6);
    assert.ok(Math.abs(roundTrip.latitudeDeg - centerGeodetic.latitudeDeg) < 1e-6);
    assert.ok(Math.abs(roundTrip.depthM - centerGeodetic.depthM) < 1e-4);
  });

  it('should convert Geodetic to Local Cartesian ENU and back', () => {
    const lut = new DepthLookupTable(depthEntries);
    const transformer = new CoordinateTransformer(
      {
        minLongitudeDeg: 80.0,
        maxLongitudeDeg: 88.0,
        minLatitudeDeg: -3.0,
        maxLatitudeDeg: 12.0,
        minDepthM: depthEntries[0],
        maxDepthM: depthEntries[30],
        originLongitudeDeg: 84.0,
        originLatitudeDeg: 4.5,
        originDepthM: 0.0,
        verticalExaggeration: 100.0,
      },
      lut
    );

    const originGeodetic = { longitudeDeg: 84.0, latitudeDeg: 4.5, depthM: 0.0 };
    const originENU = transformer.geodeticToENU(originGeodetic);
    assert.ok(Math.abs(originENU.eastMeters) < 1e-5);
    assert.ok(Math.abs(originENU.northMeters) < 1e-5);
    assert.ok(Math.abs(originENU.upMeters) < 1e-5);

    const testPoint = { longitudeDeg: 85.0, latitudeDeg: 5.5, depthM: 100.0 };
    const enu = transformer.geodeticToENU(testPoint);
    assert.ok(enu.eastMeters > 0);
    assert.ok(enu.northMeters > 0);
    assert.equal(enu.upMeters, -100.0 * 100.0); // -10,000m

    const backToGeo = transformer.enuToGeodetic(enu);
    assert.ok(Math.abs(backToGeo.longitudeDeg - testPoint.longitudeDeg) < 1e-6);
    assert.ok(Math.abs(backToGeo.latitudeDeg - testPoint.latitudeDeg) < 1e-6);
    assert.ok(Math.abs(backToGeo.depthM - testPoint.depthM) < 1e-4);
  });

  it('should map global grid voxel index to brick-local sample index with halo offset', () => {
    const lut = new DepthLookupTable(depthEntries);
    const transformer = new CoordinateTransformer(
      {
        minLongitudeDeg: 80.0,
        maxLongitudeDeg: 88.0,
        minLatitudeDeg: -3.0,
        maxLatitudeDeg: 12.0,
        minDepthM: depthEntries[0],
        maxDepthM: depthEntries[30],
      },
      lut
    );

    // Brick at origin [0, 0, 0] with halo [1, 1, 0]
    const sampleCoord = transformer.globalGridToBrickSample(10, 20, 5, [0, 0, 0], [1, 1, 0]);
    assert.equal(sampleCoord.sampleX, 11);
    assert.equal(sampleCoord.sampleY, 21);
    assert.equal(sampleCoord.sampleZ, 5);

    // Brick at offset origin [64, 64, 0] with halo [1, 1, 0]
    const sampleCoord2 = transformer.globalGridToBrickSample(65, 70, 10, [64, 64, 0], [1, 1, 0]);
    assert.equal(sampleCoord2.sampleX, 1 + 1); // 2
    assert.equal(sampleCoord2.sampleY, 6 + 1); // 7
    assert.equal(sampleCoord2.sampleZ, 10 + 0); // 10
  });
});

describe('QuasarOS Temporal Controller & Epoch Management', () => {
  const timesteps = [
    '2026-08-24T12:00:00Z',
    '2026-08-25T12:00:00Z',
    '2026-08-26T12:00:00Z',
    '2026-08-27T12:00:00Z',
    '2026-08-28T12:00:00Z',
    '2026-08-29T12:00:00Z',
    '2026-08-30T12:00:00Z',
  ];

  it('should manage discrete 7-day timestep scrubbing and generation advancement', () => {
    const temporal = new TemporalController(timesteps);
    assert.equal(temporal.totalTimesteps, 7);
    assert.equal(temporal.currentIndex, 0);
    assert.equal(temporal.activeGeneration, 1);
    assert.equal(temporal.currentTimestep.timeUtc, '2026-08-24T12:00:00Z');

    // Advance timestep
    const signal1 = temporal.setTimestepIndex(1);
    assert.equal(temporal.currentIndex, 1);
    assert.equal(temporal.activeGeneration, 2);
    assert.equal(signal1.aborted, false);

    // Next step -> Generation 3, signal1 aborted
    const signal2 = temporal.next();
    assert.equal(temporal.currentIndex, 2);
    assert.equal(temporal.activeGeneration, 3);
    assert.equal(signal1.aborted, true);
    assert.equal(signal2.aborted, false);

    // Stale generation assertion
    assert.throws(() => {
      temporal.assertActiveGeneration(2);
    }, StaleTemporalRequestError);

    // Out of bounds error
    assert.throws(() => {
      temporal.setTimestepIndex(10);
    }, CoordinateBoundsError);
  });
});

describe('QuasarOS Scientific State & Clipping Controller', () => {
  const depthEntries = visProduct.coordinate_transform.depth_lut_entries_m;

  it('should maintain canonical variable metadata and scalar domain bounds', () => {
    const sciState = new ScientificState({
      variableId: 'sea_water_potential_temperature',
      canonicalUnits: 'degree_Celsius',
      cfStandardName: 'sea_water_potential_temperature',
      minValue: 9.3747,
      maxValue: 30.3618,
      classification: 'ANALYSIS_FORECAST',
      isEligibleForExactQuery: true,
    });

    assert.equal(sciState.variableId, 'sea_water_potential_temperature');
    assert.equal(sciState.canonicalUnits, 'degree_Celsius');
    assert.equal(sciState.isInDomain(25.0), true);
    assert.equal(sciState.isInDomain(5.0), false);
    assert.equal(sciState.isInDomain(35.0), false);
    assert.equal(sciState.isInDomain(NaN), false);
  });

  it('should enforce 6-plane bounding-box clipping and compute normalized clipping planes', () => {
    const lut = new DepthLookupTable(depthEntries);
    const transformer = new CoordinateTransformer(
      {
        minLongitudeDeg: 80.0,
        maxLongitudeDeg: 88.0,
        minLatitudeDeg: -3.0,
        maxLatitudeDeg: 12.0,
        minDepthM: depthEntries[0],
        maxDepthM: depthEntries[30],
      },
      lut
    );

    const clipping = new ClippingController(transformer);
    assert.equal(clipping.isGeodeticPointClipped(84.0, 4.5, 100.0), false);

    // Clip latitude range to [0.0, 10.0]
    clipping.setLatitudeRange(0.0, 10.0);
    assert.equal(clipping.isGeodeticPointClipped(84.0, 4.5, 100.0), false);
    assert.equal(clipping.isGeodeticPointClipped(84.0, -1.0, 100.0), true); // Below 0.0

    // Check normalized box
    const normBox = clipping.normalizedClippingBox;
    assert.ok(normBox.minV > 0.0);
    assert.ok(normBox.maxV < 1.0);
    assert.equal(clipping.isNormalizedPointClipped(0.5, 0.5, 0.5), false);

    // Inverted plane rejection
    assert.throws(() => {
      clipping.setLongitudeRange(85.0, 82.0);
    }, ClippingRangeError);

    // Domain overflow rejection
    assert.throws(() => {
      clipping.setDepthRange(0.0, 1000.0);
    }, ClippingRangeError);
  });
});
