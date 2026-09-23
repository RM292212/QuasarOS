/**
 * @quasar/runtime Failure Injection & Negative Constraint Test Suite
 *
 * TASK-07D: Independent Validation and Failure-Injection Testing.
 *
 * Verifies robust validation and rejection of:
 * 1. Non-monotonic, inverted, or insufficient Depth LUT entries.
 * 2. Inverted clipping bounds (min > max) and domain limit overflows.
 * 3. Silent snapshot mutation attempts and cryptographic checksum mismatches.
 * 4. Invalid FSM state transitions and operations on disposed sessions.
 * 5. Out-of-bounds temporal scrubbing and stale request tokens.
 * 6. Corrupted/failed brick registration and budget eviction protection.
 * 7. Strict architectural isolation: Zero DOM, Babylon.js, WebGPU, WebGL2, or Three.js imports.
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
  ResidentBrickLedger,
  BrickPlanner,
  RenderPacketSynthesizer,
  ProvisionalPickMapper,
  InvalidStateTransitionError,
  CoordinateBoundsError,
  SessionIntegrityError,
  StaleTemporalRequestError,
  ClippingRangeError,
} from '../src/index.ts';

const RUNTIME_SRC_DIR = fs.existsSync(path.join(process.cwd(), 'packages', 'runtime', 'src'))
  ? path.join(process.cwd(), 'packages', 'runtime', 'src')
  : path.resolve(process.cwd(), 'src');

describe('TASK-07D Failure Injection: Coordinate & Depth LUT Constraints', () => {
  it('should reject DepthLookupTable with fewer than 2 levels', () => {
    assert.throws(
      () => new DepthLookupTable([]),
      (err: Error) => err instanceof CoordinateBoundsError && err.code === 'COORDINATE_BOUNDS_ERROR'
    );

    assert.throws(
      () => new DepthLookupTable([10.5]),
      (err: Error) => err instanceof CoordinateBoundsError
    );
  });

  it('should reject DepthLookupTable with non-monotonic (decreasing or duplicate) depth levels', () => {
    // Decreasing
    assert.throws(
      () => new DepthLookupTable([0.5, 10.0, 5.0, 30.0]),
      (err: Error) => err instanceof CoordinateBoundsError && err.message.includes('Strict vertical monotonicity violated')
    );

    // Duplicate adjacent
    assert.throws(
      () => new DepthLookupTable([0.5, 10.0, 10.0, 30.0]),
      (err: Error) => err instanceof CoordinateBoundsError && err.message.includes('Strict vertical monotonicity violated')
    );
  });

  it('should throw CoordinateBoundsError on out-of-bounds continuous depth when clamp=false', () => {
    const lut = new DepthLookupTable([0.5, 10.0, 50.0, 100.0, 450.0]);
    assert.throws(
      () => lut.physicalToNormalized(-5.0, false),
      (err: Error) => err instanceof CoordinateBoundsError
    );

    assert.throws(
      () => lut.physicalToNormalized(500.0, false),
      (err: Error) => err instanceof CoordinateBoundsError
    );

    assert.throws(
      () => lut.normalizedToPhysical(1.5, false),
      (err: Error) => err instanceof CoordinateBoundsError
    );
  });

  it('should reject CoordinateTransformer with invalid or inverted domain bounds', () => {
    const depthLut = new DepthLookupTable([0.5, 10.0, 50.0, 450.0]);

    assert.throws(
      () =>
        new CoordinateTransformer(
          {
            minLongitudeDeg: 90.0,
            maxLongitudeDeg: 80.0, // Inverted lon
            minLatitudeDeg: 0.0,
            maxLatitudeDeg: 10.0,
            minDepthM: 0.5,
            maxDepthM: 450.0,
          },
          depthLut
        ),
      (err: Error) => err instanceof CoordinateBoundsError
    );

    assert.throws(
      () =>
        new CoordinateTransformer(
          {
            minLongitudeDeg: 80.0,
            maxLongitudeDeg: 90.0,
            minLatitudeDeg: 15.0,
            maxLatitudeDeg: 5.0, // Inverted lat
            minDepthM: 0.5,
            maxDepthM: 450.0,
          },
          depthLut
        ),
      (err: Error) => err instanceof CoordinateBoundsError
    );
  });
});

describe('TASK-07D Failure Injection: Clipping Plane Constraints', () => {
  const depthLut = new DepthLookupTable([0.5, 50.0, 100.0, 500.0]);
  const transformer = new CoordinateTransformer(
    {
      minLongitudeDeg: 80.0,
      maxLongitudeDeg: 90.0,
      minLatitudeDeg: 0.0,
      maxLatitudeDeg: 10.0,
      minDepthM: 0.5,
      maxDepthM: 500.0,
    },
    depthLut
  );

  it('should reject inverted clipping limits (min > max) on construction and update', () => {
    const controller = new ClippingController(transformer);

    // Inverted Longitude
    assert.throws(
      () => controller.setLimits({ minLonDeg: 88.0, maxLonDeg: 82.0 }),
      (err: Error) => err instanceof ClippingRangeError && err.axis === 'longitude'
    );

    // Inverted Latitude
    assert.throws(
      () => controller.setLimits({ minLatDeg: 8.0, maxLatDeg: 2.0 }),
      (err: Error) => err instanceof ClippingRangeError && err.axis === 'latitude'
    );

    // Inverted Depth
    assert.throws(
      () => controller.setLimits({ minDepthM: 300.0, maxDepthM: 50.0 }),
      (err: Error) => err instanceof ClippingRangeError && err.axis === 'depth'
    );
  });

  it('should reject clipping limits exceeding maximum domain bounds', () => {
    const controller = new ClippingController(transformer);

    assert.throws(
      () => controller.setLimits({ minLonDeg: 75.0 }), // < 80.0
      (err: Error) => err instanceof ClippingRangeError
    );

    assert.throws(
      () => controller.setLimits({ maxLonDeg: 95.0 }), // > 90.0
      (err: Error) => err instanceof ClippingRangeError
    );

    assert.throws(
      () => controller.setLimits({ maxDepthM: 600.0 }), // > 500.0
      (err: Error) => err instanceof ClippingRangeError
    );
  });
});

describe('TASK-07D Failure Injection: Session Integrity & FSM Governance', () => {
  it('should block silent snapshot mutation and manifest hash mismatch', () => {
    const session = new VolumeSession();
    session.startDiscovery();

    session.pinSession({
      datasetId: 'copernicus_phy_thetao',
      snapshotId: 'snap-alpha-1234',
      productId: 'vis_copernicus_phy_thetao_snap-alpha-1234',
      productVersion: 'v1',
      manifestSha256: 'a'.repeat(64),
    });

    // Attempting to pin a different snapshot while pinned must throw SessionIntegrityError
    assert.throws(
      () =>
        session.pinSession({
          datasetId: 'copernicus_phy_thetao',
          snapshotId: 'snap-beta-5678',
          productId: 'vis_copernicus_phy_thetao_snap-beta-5678',
          productVersion: 'v1',
          manifestSha256: 'b'.repeat(64),
        }),
      (err: Error) => err instanceof SessionIntegrityError && err.code === 'SESSION_INTEGRITY_VIOLATION'
    );
  });

  it('should reject invalid FSM lifecycle transitions', () => {
    const session = new VolumeSession();
    assert.equal(session.state, 'UNINITIALIZED');

    // Cannot jump from UNINITIALIZED directly to STREAMING
    assert.throws(
      () => session.startStreaming(),
      (err: Error) => err instanceof InvalidStateTransitionError && err.code === 'INVALID_STATE_TRANSITION'
    );

    // Cannot transition to DISPOSAL_COMPLETE without DISPOSING
    assert.throws(
      () => session.fsm.transition('DISPOSAL_COMPLETE', 'Illegal jump'),
      (err: Error) => err instanceof InvalidStateTransitionError
    );
  });

  it('should reject operations on a disposed session', () => {
    const session = new VolumeSession();
    session.startDiscovery();
    session.dispose();
    assert.equal(session.state, 'DISPOSED');

    // Attempting to transition disposed session must throw InvalidStateTransitionError
    assert.throws(
      () => session.startDiscovery(),
      (err: Error) => err instanceof InvalidStateTransitionError
    );
  });
});

describe('TASK-07D Failure Injection: Temporal Controller Scrubbing Bounds', () => {
  const timesteps = [
    '2026-08-24T12:00:00Z',
    '2026-08-25T12:00:00Z',
    '2026-08-26T12:00:00Z',
  ];

  it('should reject out-of-range timestep indices', () => {
    const temporal = new TemporalController(timesteps);

    assert.throws(
      () => temporal.setTimestepIndex(-1),
      (err: Error) => err instanceof CoordinateBoundsError
    );

    assert.throws(
      () => temporal.setTimestepIndex(3),
      (err: Error) => err instanceof CoordinateBoundsError
    );
  });

  it('should abort in-flight requests and detect stale request generation tokens', () => {
    const temporal = new TemporalController(timesteps);
    const signalGen1 = temporal.setTimestepIndex(0);
    const gen1 = temporal.activeGeneration;

    assert.equal(signalGen1.aborted, false);
    assert.equal(temporal.isGenerationActive(gen1), true);

    // Scrub to next timestep
    const signalGen2 = temporal.setTimestepIndex(1);

    assert.equal(signalGen1.aborted, true);
    assert.equal(temporal.isGenerationActive(gen1), false);
    assert.equal(signalGen2.aborted, false);

    assert.throws(
      () => temporal.assertActiveGeneration(gen1),
      (err: Error) => err instanceof StaleTemporalRequestError
    );
  });
});

describe('TASK-07D Failure Injection: Ledger & Residency Handling', () => {
  it('should record failed brick status without crashing and reflect failed state', () => {
    const ledger = new ResidentBrickLedger({ maxMemoryBudgetBytes: 10 * 1024 * 1024 });
    const brickKey = 'thetao_t0_l0_b0.0.0.0';

    ledger.markRequested(brickKey, 0, 0, 'f16');
    ledger.markStreaming(brickKey, 'f16');

    // Mark as failed
    ledger.markFailed(brickKey, new Error('Network timeout HTTP 504'), 'f16');

    const entry = ledger.getRecord(brickKey, 'f16');
    assert.ok(entry);
    assert.equal(entry.state, 'FAILED');
    assert.equal(entry.error?.message, 'Network timeout HTTP 504');
  });

  it('should protect pinned fallback parent during eviction under budget pressure', () => {
    const ledger = new ResidentBrickLedger({ maxMemoryBudgetBytes: 300000 });
    const pinnedKey = 'brick_parent_lod1';
    const unpinnedKey = 'brick_fine_lod0';

    ledger.registerResident(
      pinnedKey,
      {
        brickKey: pinnedKey,
        representation: 'f16',
        sampleShape: [32, 32, 16],
        interiorValidShape: [32, 32, 16],
        haloPadding: [0, 0, 0],
        sampleOrigin: [0, 0, 0],
        spatialBounds: {} as any,
        minDepthM: 0.5,
        maxDepthM: 450,
        scalarMin: 10,
        scalarMax: 30,
        totalVoxels: 16384,
        validVoxelsCount: 16384,
        missingVoxelsCount: 0,
        isEmptyOrMasked: false,
        scalarData: new Float32Array(16384),
        rawBuffer: new Uint16Array(16384),
        validityMask: new Uint8Array(16384),
        decodedAtMs: Date.now(),
        memorySizeBytes: 150000,
      },
      'f16'
    );
    ledger.setPinnedFallback(pinnedKey, true, 'f16');

    ledger.registerResident(
      unpinnedKey,
      {
        brickKey: unpinnedKey,
        representation: 'f16',
        sampleShape: [32, 32, 16],
        interiorValidShape: [32, 32, 16],
        haloPadding: [0, 0, 0],
        sampleOrigin: [0, 0, 0],
        spatialBounds: {} as any,
        minDepthM: 0.5,
        maxDepthM: 450,
        scalarMin: 10,
        scalarMax: 30,
        totalVoxels: 16384,
        validVoxelsCount: 16384,
        missingVoxelsCount: 0,
        isEmptyOrMasked: false,
        scalarData: new Float32Array(16384),
        rawBuffer: new Uint16Array(16384),
        validityMask: new Uint8Array(16384),
        decodedAtMs: Date.now(),
        memorySizeBytes: 200000,
      },
      'f16'
    );

    const evicted = ledger.evictExcess();
    assert.ok(evicted.includes(unpinnedKey));
    assert.equal(ledger.isResident(pinnedKey, 'f16'), true);
  });
});

describe('TASK-07D Architectural Boundary Check: Strict Zero DOM / WebGPU / Babylon Coupling', () => {
  it('should prove that packages/runtime/src contains zero browser DOM, Babylon, Three, Cesium, WebGPU or WebGL imports', () => {
    const FORBIDDEN_TOKENS = [
      '@babylonjs',
      'babylonjs',
      'three',
      'cesium',
      '@webgpu',
      'HTMLCanvasElement',
      'document.createElement',
      'window.addEventListener',
      'WebGLRenderingContext',
      'WebGL2RenderingContext',
      'GPUDevice',
      'GPUBuffer',
      'GPUTexture',
    ];

    function scanDirectory(dir: string): string[] {
      let files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(scanDirectory(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const srcFiles = scanDirectory(RUNTIME_SRC_DIR);
    assert.ok(srcFiles.length >= 10, `Expected >= 10 source files in runtime/src, found ${srcFiles.length}`);

    const violations: { file: string; token: string; line: number }[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, lineIdx) => {
        // Skip comment lines mentioning these tokens for documentation purposes
        const trimmed = lineText.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          return;
        }

        for (const token of FORBIDDEN_TOKENS) {
          if (lineText.includes(token)) {
            violations.push({
              file: path.relative(RUNTIME_SRC_DIR, file),
              token,
              line: lineIdx + 1,
            });
          }
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Detected architectural boundary violations in @quasar/runtime/src:\n${JSON.stringify(violations, null, 2)}`
    );
  });
});
