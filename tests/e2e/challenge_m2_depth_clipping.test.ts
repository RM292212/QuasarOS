import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DepthLookupTable,
  CoordinateTransformer,
  ClippingController,
  CoordinateBoundsError,
  ClippingRangeError,
} from '../../packages/runtime/src/index.ts';
import { COPERNICUS_50_DEPTH_LEVELS, COPERNICUS_31_DEPTH_LEVELS } from '../../apps/web/src/components/inspection/VerticalProfileLogic.ts';
import { WebGL2RaymarchingRenderer } from '../../packages/renderer-webgl2/src/pipeline/raymarching_renderer.ts';
import type { VolumeRaymarchingCameraState } from '../../packages/renderer-webgl2/src/pipeline/types.ts';
import type { RenderPacket, RenderPacketBrick } from '../../packages/runtime/src/types.ts';

// Mock WebGL2 Context for testing uniform packing and shader consistency
class MockWebGL2Context {
  VERTEX_SHADER = 0x8b31;
  FRAGMENT_SHADER = 0x8b30;
  COMPILE_STATUS = 0x8b81;
  LINK_STATUS = 0x8b82;
  UNIFORM_BUFFER = 0x8a11;
  DYNAMIC_DRAW = 0x88e8;
  TEXTURE_2D = 0x0de1;
  TEXTURE_3D = 0x806f;
  TEXTURE0 = 0x84c0;
  R16F = 0x822d;
  R16UI = 0x8234;
  R8UI = 0x8232;
  RGBA8 = 0x8058;
  RED = 0x1903;
  RED_INTEGER = 0x8d94;
  RGBA = 0x1908;
  HALF_FLOAT = 0x140b;
  UNSIGNED_SHORT = 0x1403;
  UNSIGNED_BYTE = 0x1401;
  NEAREST = 0x2600;
  LINEAR = 0x2601;
  TEXTURE_MIN_FILTER = 0x2801;
  TEXTURE_MAG_FILTER = 0x2800;
  TEXTURE_WRAP_S = 0x2802;
  TEXTURE_WRAP_T = 0x2803;
  TEXTURE_WRAP_R = 0x8072;
  CLAMP_TO_EDGE = 0x812f;
  FRAMEBUFFER = 0x8d40;
  COLOR_BUFFER_BIT = 0x00004000;
  BLEND = 0x0be2;
  SRC_ALPHA = 0x0302;
  ONE_MINUS_SRC_ALPHA = 0x0303;
  ONE = 1;
  DEPTH_TEST = 0x0b71;
  CULL_FACE = 0x0b44;
  TRIANGLES = 0x0004;

  createShader() { return {}; }
  shaderSource() {}
  compileShader() {}
  getShaderParameter() { return true; }
  getShaderInfoLog() { return ''; }
  deleteShader() {}
  createProgram() { return {}; }
  attachShader() {}
  linkProgram() {}
  getProgramParameter() { return true; }
  getProgramInfoLog() { return ''; }
  deleteProgram() {}
  getUniformBlockIndex() { return 0; }
  uniformBlockBinding() {}
  getUniformLocation() { return {}; }
  uniform1i() {}
  createBuffer() { return {}; }
  bindBuffer() {}
  bufferData() {}
  bufferSubData() {}
  bindBufferBase() {}
  deleteBuffer() {}
  createVertexArray() { return {}; }
  bindVertexArray() {}
  deleteVertexArray() {}
  createTexture() { return {}; }
  bindTexture() {}
  texImage3D() {}
  texImage2D() {}
  texParameteri() {}
  deleteTexture() {}
  activeTexture() {}
  useProgram() {}
  bindFramebuffer() {}
  viewport() {}
  clearColor() {}
  clear() {}
  enable() {}
  disable() {}
  blendFuncSeparate() {}
  drawArrays() {}
}

describe('M2 Challenger 2: Full-Depth Physical Clipping Calibration (0.494m to 5,727.917m)', () => {
  it('should verify COPERNICUS_50_DEPTH_LEVELS exact boundaries and strict monotonicity', () => {
    assert.equal(COPERNICUS_50_DEPTH_LEVELS.length, 50, 'Must have exactly 50 discrete depth levels');
    assert.equal(COPERNICUS_50_DEPTH_LEVELS[0], 0.494025, 'Surface mixed layer minimum depth must be 0.494025m');
    assert.equal(COPERNICUS_50_DEPTH_LEVELS[49], 5727.917, 'Abyssal trench maximum depth must be 5727.917m');

    // Strict vertical monotonicity check
    for (let i = 1; i < COPERNICUS_50_DEPTH_LEVELS.length; i++) {
      const prev = COPERNICUS_50_DEPTH_LEVELS[i - 1];
      const curr = COPERNICUS_50_DEPTH_LEVELS[i];
      assert.ok(curr > prev, `Monotonicity violation at index ${i}: ${curr} <= ${prev}`);
      const delta = curr - prev;
      assert.ok(delta > 0, `Delta between levels ${i - 1} and ${i} must be strictly positive: ${delta}`);
    }
  });

  it('should initialize DepthLookupTable across 50 levels and map boundaries exactly', () => {
    const lut = new DepthLookupTable(COPERNICUS_50_DEPTH_LEVELS);
    assert.equal(lut.levelCount, 50);
    assert.equal(lut.minDepthM, 0.494025);
    assert.equal(lut.maxDepthM, 5727.917);

    // Boundary normalized conversions
    const wMin = lut.physicalToNormalized(0.494025);
    assert.equal(wMin, 0.0, 'Surface depth 0.494025m must map to normalized w = 0.0');

    const wMax = lut.physicalToNormalized(5727.917);
    assert.equal(wMax, 1.0, 'Trench depth 5727.917m must map to normalized w = 1.0');

    // Inverse boundary conversions
    const zMin = lut.normalizedToPhysical(0.0);
    assert.equal(zMin, 0.494025, 'Normalized w = 0.0 must map to depth 0.494025m');

    const zMax = lut.normalizedToPhysical(1.0);
    assert.equal(zMax, 5727.917, 'Normalized w = 1.0 must map to depth 5727.917m');
  });

  it('should preserve strict continuous monotonicity across 10,000 sampled depths', () => {
    const lut = new DepthLookupTable(COPERNICUS_50_DEPTH_LEVELS);
    const numSamples = 10000;
    const minZ = lut.minDepthM;
    const maxZ = lut.maxDepthM;

    let prevW = -1;
    for (let i = 0; i <= numSamples; i++) {
      const z = minZ + (i / numSamples) * (maxZ - minZ);
      const w = lut.physicalToNormalized(z);

      assert.ok(!isNaN(w), `Normalized w for depth ${z}m produced NaN`);
      assert.ok(isFinite(w), `Normalized w for depth ${z}m produced non-finite number`);
      assert.ok(w >= 0.0 && w <= 1.0, `Normalized w = ${w} out of [0, 1] range for depth ${z}m`);
      assert.ok(w >= prevW, `Monotonicity violation: w (${w}) < prevW (${prevW}) at depth ${z}m`);
      prevW = w;
    }
  });

  it('should achieve bidirectional round-trip precision across all 50 discrete levels and 1,000 continuous depths', () => {
    const lut = new DepthLookupTable(COPERNICUS_50_DEPTH_LEVELS);

    // Discrete levels
    for (let i = 0; i < 50; i++) {
      const zOrig = COPERNICUS_50_DEPTH_LEVELS[i];
      const w = lut.physicalToNormalized(zOrig);
      const zRoundTrip = lut.normalizedToPhysical(w);
      assert.ok(
        Math.abs(zRoundTrip - zOrig) < 1e-4,
        `Discrete level ${i} round-trip error too high: orig=${zOrig}, roundtrip=${zRoundTrip}`
      );
    }

    // Continuous random depths
    for (let i = 0; i < 1000; i++) {
      const zOrig = lut.minDepthM + Math.random() * (lut.maxDepthM - lut.minDepthM);
      const w = lut.physicalToNormalized(zOrig);
      const zRoundTrip = lut.normalizedToPhysical(w);
      assert.ok(
        Math.abs(zRoundTrip - zOrig) < 1e-3,
        `Continuous depth round-trip error too high: orig=${zOrig}, roundtrip=${zRoundTrip}`
      );

      const wOrig = Math.random();
      const zFromW = lut.normalizedToPhysical(wOrig);
      const wRoundTrip = lut.physicalToNormalized(zFromW);
      assert.ok(
        Math.abs(wRoundTrip - wOrig) < 1e-6,
        `Continuous w round-trip error too high: orig=${wOrig}, roundtrip=${wRoundTrip}`
      );
    }
  });
});

describe('M2 Challenger 2: Boundary Extremes, Out-of-Bounds & Pycnocline Testing', () => {
  const lut = new DepthLookupTable(COPERNICUS_50_DEPTH_LEVELS);

  it('should handle shallowest mixed layer and deep pycnocline/thermocline transitions', () => {
    // Mixed layer (0.494m to 10m): 8 levels in first 10m
    const bracket1m = lut.findBracketingLevels(1.0);
    assert.equal(bracket1m.lowerLevelIndex, 0);
    assert.equal(bracket1m.upperLevelIndex, 1);
    assert.ok(bracket1m.lowerDepthM <= 1.0 && bracket1m.upperDepthM >= 1.0);

    // Main Thermocline / Pycnocline (100m to 300m)
    const bracket200m = lut.findBracketingLevels(200.0);
    assert.ok(bracket200m.lowerDepthM < 200.0 && bracket200m.upperDepthM > 200.0);
    assert.ok(bracket200m.interpolationFraction > 0.0 && bracket200m.interpolationFraction < 1.0);

    // Deep Abyss (5000m)
    const bracket5000m = lut.findBracketingLevels(5000.0);
    assert.equal(bracket5000m.lowerLevelIndex, 47);
    assert.equal(bracket5000m.upperLevelIndex, 48);
  });

  it('should handle out-of-bounds inputs with clamp=true without NaN or exception', () => {
    // Above sea level
    assert.equal(lut.physicalToNormalized(-50.0, true), 0.0);
    assert.equal(lut.physicalToNormalized(0.0, true), 0.0);
    assert.equal(lut.normalizedToPhysical(-0.5, true), 0.494025);

    // Below trench floor
    assert.equal(lut.physicalToNormalized(6000.0, true), 1.0);
    assert.equal(lut.physicalToNormalized(1e9, true), 1.0);
    assert.equal(lut.normalizedToPhysical(1.5, true), 5727.917);
  });

  it('should throw CoordinateBoundsError for out-of-bounds inputs with clamp=false', () => {
    assert.throws(() => lut.physicalToNormalized(-10.0, false), CoordinateBoundsError);
    assert.throws(() => lut.physicalToNormalized(6000.0, false), CoordinateBoundsError);
    assert.throws(() => lut.normalizedToPhysical(-0.1, false), CoordinateBoundsError);
    assert.throws(() => lut.normalizedToPhysical(1.1, false), CoordinateBoundsError);
    assert.throws(() => lut.findBracketingLevels(-1.0, false), CoordinateBoundsError);
    assert.throws(() => lut.findBracketingLevels(6000.0, false), CoordinateBoundsError);
  });

  it('should reject non-monotonic or insufficient depth levels during construction', () => {
    // Insufficient levels (< 2)
    assert.throws(() => new DepthLookupTable([10.0]), CoordinateBoundsError);
    assert.throws(() => new DepthLookupTable([]), CoordinateBoundsError);

    // Non-monotonic levels
    assert.throws(() => new DepthLookupTable([10.0, 5.0, 20.0]), CoordinateBoundsError);
    assert.throws(() => new DepthLookupTable([10.0, 10.0, 20.0]), CoordinateBoundsError);
  });
});

describe('M2 Challenger 2: Shader Depth LUT Evaluation & GLSL/WGSL Parity', () => {
  // GLSL / WGSL shader emulation of evaluateNormalizedDepthToPhysical
  function shaderEvaluateDepth(normW: number, depthLevels: number[] | Float32Array): number {
    const uDepthLevelCount = depthLevels.length;
    if (uDepthLevelCount < 2) {
      return normW;
    }
    const maxIdx = uDepthLevelCount - 1;
    const continuousIndex = Math.min(Math.max(normW * maxIdx, 0.0), maxIdx);
    const lowerIdx = Math.floor(continuousIndex);
    const upperIdx = Math.min(uDepthLevelCount - 1, lowerIdx + 1);
    const frac = continuousIndex - lowerIdx;

    const zLower = depthLevels[lowerIdx];
    const zUpper = depthLevels[upperIdx];
    return zLower * (1.0 - frac) + zUpper * frac;
  }

  it('should verify exact mathematical parity between shader piecewise interpolation and CPU DepthLookupTable', () => {
    const lut = new DepthLookupTable(COPERNICUS_50_DEPTH_LEVELS);
    const levels = COPERNICUS_50_DEPTH_LEVELS;

    // Test across 1,000 normalized sampling positions w in [0, 1]
    for (let i = 0; i <= 1000; i++) {
      const w = i / 1000.0;
      const cpuZ = lut.normalizedToPhysical(w);
      const shaderZ = shaderEvaluateDepth(w, levels);

      assert.ok(
        Math.abs(cpuZ - shaderZ) < 1e-4,
        `Shader parity discrepancy at w=${w}: CPU=${cpuZ}, Shader=${shaderZ}`
      );
    }
  });

  it('should verify GLSL and WGSL shader parity on edge case boundaries (w=0, w=1, w<0, w>1)', () => {
    const levels = COPERNICUS_50_DEPTH_LEVELS;

    // Exact surface
    assert.ok(Math.abs(shaderEvaluateDepth(0.0, levels) - 0.494025) < 1e-5);
    // Exact bottom
    assert.ok(Math.abs(shaderEvaluateDepth(1.0, levels) - 5727.917) < 1e-3);
    // Sub-surface clamp
    assert.ok(Math.abs(shaderEvaluateDepth(-0.5, levels) - 0.494025) < 1e-5);
    // Deep clamp
    assert.ok(Math.abs(shaderEvaluateDepth(1.5, levels) - 5727.917) < 1e-3);
  });
});

describe('M2 Challenger 2: Coordinate Inversion, Clipping Planes & Transformer Alignment', () => {
  const lut = new DepthLookupTable(COPERNICUS_50_DEPTH_LEVELS);
  const bounds = {
    minLongitudeDeg: 60.0,
    maxLongitudeDeg: 68.0,
    minLatitudeDeg: 0.0,
    maxLatitudeDeg: 15.0,
    minDepthM: 0.494025,
    maxDepthM: 5727.917,
  };
  const transformer = new CoordinateTransformer(bounds, lut);
  const clippingCtrl = new ClippingController(transformer);

  it('should reject inverted clipping limits across depth, longitude, and latitude', () => {
    // Inverted depth
    assert.throws(
      () => clippingCtrl.setDepthRange(1000.0, 500.0),
      ClippingRangeError,
      'Must reject minDepth > maxDepth'
    );

    // Inverted longitude
    assert.throws(
      () => clippingCtrl.setLongitudeRange(65.0, 62.0),
      ClippingRangeError,
      'Must reject minLon > maxLon'
    );

    // Inverted latitude
    assert.throws(
      () => clippingCtrl.setLatitudeRange(10.0, 5.0),
      ClippingRangeError,
      'Must reject minLat > maxLat'
    );

    // Out of domain limits
    assert.throws(
      () => clippingCtrl.setDepthRange(-10.0, 1000.0),
      ClippingRangeError,
      'Must reject depth exceeding domain min'
    );
    assert.throws(
      () => clippingCtrl.setDepthRange(0.494025, 6000.0),
      ClippingRangeError,
      'Must reject depth exceeding domain max'
    );
  });

  it('should correctly compute normalized clipping box without coordinate inversion', () => {
    clippingCtrl.resetToFullDomain();
    const fullBox = clippingCtrl.normalizedClippingBox;
    assert.equal(fullBox.minU, 0.0);
    assert.equal(fullBox.maxU, 1.0);
    assert.equal(fullBox.minV, 0.0);
    assert.equal(fullBox.maxV, 1.0);
    assert.equal(fullBox.minW, 0.0);
    assert.equal(fullBox.maxW, 1.0);

    // Clip depth to [100m, 2000m]
    clippingCtrl.setDepthRange(100.0, 2000.0);
    const subBox = clippingCtrl.normalizedClippingBox;
    assert.ok(subBox.minW > 0.0 && subBox.minW < subBox.maxW);
    assert.ok(subBox.maxW > subBox.minW && subBox.maxW < 1.0);
    assert.ok(!isNaN(subBox.minW) && !isNaN(subBox.maxW));

    // Evaluate point clipping
    assert.equal(clippingCtrl.isGeodeticPointClipped(64.0, 7.5, 50.0), true, 'Depth 50m < minDepth 100m should be clipped');
    assert.equal(clippingCtrl.isGeodeticPointClipped(64.0, 7.5, 500.0), false, 'Depth 500m in [100, 2000] should not be clipped');
    assert.equal(clippingCtrl.isGeodeticPointClipped(64.0, 7.5, 3000.0), true, 'Depth 3000m > maxDepth 2000m should be clipped');
  });

  it('should preserve geodetic to ENU vertical direction (Up is negative for ocean depth)', () => {
    const enuTransformer = new CoordinateTransformer(
      {
        ...bounds,
        originLongitudeDeg: 64.0,
        originLatitudeDeg: 7.5,
        originDepthM: 0.0,
        verticalExaggeration: 10.0,
      },
      lut
    );

    // Point at sea surface (depth = 0)
    const surfaceENU = enuTransformer.geodeticToENU({ longitudeDeg: 64.0, latitudeDeg: 7.5, depthM: 0.0 });
    assert.ok(Math.abs(surfaceENU.upMeters) < 1e-6);

    // Point at 1000m depth
    const deepENU = enuTransformer.geodeticToENU({ longitudeDeg: 64.0, latitudeDeg: 7.5, depthM: 1000.0 });
    assert.equal(deepENU.upMeters, -10000.0, 'Depth 1000m with 10x VE must have upMeters = -10,000m');

    // Round-trip back to geodetic
    const backToGeo = enuTransformer.enuToGeodetic(deepENU);
    assert.ok(Math.abs(backToGeo.depthM - 1000.0) < 1e-4);
  });
});

describe('M2 Challenger 2: WebGL2 UBO Packing & Parity Stress Testing', () => {
  it('should pack 1,184-byte UBO buffer consistently under extreme parameters', () => {
    const gl = new MockWebGL2Context();
    const renderer = new WebGL2RaymarchingRenderer(gl as unknown as WebGL2RenderingContext);

    const camera: VolumeRaymarchingCameraState = {
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
      inverseViewProjectionMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]),
      cameraPosition: [100.0, -200.0, 500.0],
      viewportWidth: 3840,
      viewportHeight: 2160,
    };

    const packet: RenderPacket = {
      packetId: 'pkt_extreme',
      frameTimestampMs: Date.now(),
      datasetId: 'ocean_ds',
      snapshotId: 'snap_extreme',
      visualizationProductId: 'vis_temp',
      productVersion: 'v1',
      manifestSha256: '0'.repeat(64),
      timestepIndex: 0,
      timestepUtc: '2026-08-30T00:00:00Z',
      targetLodLevel: 0,
      isDegraded: false,
      totalBricksInVolume: 1,
      activeBricksCount: 1,
      bricks: [],
      depthLutEntriesM: new Float32Array(COPERNICUS_50_DEPTH_LEVELS),
      clippingBox: { minU: 0.001, maxU: 0.999, minV: 0.001, maxV: 0.999, minW: 0.001, maxW: 0.999 },
      coordinateUniforms: {
        originLongitudeDeg: 60,
        originLatitudeDeg: 0,
        originDepthM: 0.494025,
        minLongitudeDeg: 60,
        maxLongitudeDeg: 68,
        minLatitudeDeg: 0,
        maxLatitudeDeg: 15,
        minDepthM: 0.494025,
        maxDepthM: 5727.917,
        verticalExaggeration: 1,
      },
      scalarMin: -2.0,
      scalarMax: 35.0,
      canonicalUnits: 'degree_Celsius',
    };

    const buf = renderer.packUniforms({ packet, camera, stepSize: 0.002, referenceStepSize: 0.005, earlyTerminationAlpha: 0.99, maxSteps: 1024 }, true);
    assert.equal(buf.byteLength, 1184);

    const f32 = new Float32Array(buf);
    const u32 = new Uint32Array(buf);

    // Check camera
    assert.equal(f32[16], 100.0);
    assert.equal(f32[17], -200.0);
    assert.equal(f32[18], 500.0);
    assert.ok(Math.abs(f32[19] - 0.002) < 1e-6); // stepSize

    // Check clipping
    assert.ok(Math.abs(f32[20] - 0.001) < 1e-6);
    assert.ok(Math.abs(f32[24] - 0.999) < 1e-6);

    // Check flags
    assert.equal(u32[32], 50); // depth count
    assert.equal(u32[33], 1);  // isFloat
    assert.equal(u32[35], 1024); // maxSteps

    // Check viewport
    assert.equal(f32[36], 3840);
    assert.equal(f32[37], 2160);
    assert.ok(Math.abs(f32[38] - 1.0 / 3840) < 1e-8);
    assert.ok(Math.abs(f32[39] - 1.0 / 2160) < 1e-8);

    // Check Depth LUT entries in UBO
    assert.ok(Math.abs(f32[40] - 0.494025) < 1e-4);
    assert.ok(Math.abs(f32[40 + 49 * 4] - 5727.917) < 1e-3);
  });
});
