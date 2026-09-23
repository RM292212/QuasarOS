import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VOLUME_RAYMARCH_VERT_GLSL,
  VOLUME_RAYMARCH_FRAG_GLSL,
  WebGL2RaymarchingRenderer,
} from '../src/index.ts';
import type { RenderPacket, RenderPacketBrick } from '@quasar/runtime';
import type { VolumeRaymarchingCameraState } from '../src/pipeline/types.ts';
import { TransferFunctionModel } from '../../../apps/web/src/components/controls/transfer_function_model.ts';
import { DepthLookupTable } from '../../../packages/runtime/src/coordinates/depth_lut.ts';

/**
 * Headless Mock WebGL2 Context for empirical Challenger 1 test harness.
 */
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

  createdShaders: any[] = [];
  createdPrograms: any[] = [];
  createdBuffers: any[] = [];
  createdTextures: any[] = [];
  createdVertexArrays: any[] = [];
  bufferSubDataCalls: any[] = [];
  bufferDataCalls: any[] = [];

  createShader(type: number) {
    const s = { type, source: '', compiled: true };
    this.createdShaders.push(s);
    return s as any;
  }
  shaderSource(shader: any, source: string) {
    shader.source = source;
  }
  compileShader(shader: any) {}
  getShaderParameter(shader: any, param: number) {
    return true;
  }
  getShaderInfoLog(shader: any) {
    return '';
  }
  deleteShader(shader: any) {}

  createProgram() {
    const p = { attached: [], linked: true };
    this.createdPrograms.push(p);
    return p as any;
  }
  attachShader(program: any, shader: any) {
    program.attached.push(shader);
  }
  linkProgram(program: any) {}
  getProgramParameter(program: any, param: number) {
    return true;
  }
  getProgramInfoLog(program: any) {
    return '';
  }
  deleteProgram(program: any) {}

  getUniformBlockIndex(program: any, name: string) {
    return 0;
  }
  uniformBlockBinding(program: any, blockIndex: number, bindingPoint: number) {}
  getUniformLocation(program: any, name: string) {
    return { name };
  }
  uniform1i(loc: any, val: number) {}

  createBuffer() {
    const b = { data: null };
    this.createdBuffers.push(b);
    return b as any;
  }
  bindBuffer(target: number, buffer: any) {}
  bufferData(target: number, size: number, usage: number) {
    this.bufferDataCalls.push({ target, size, usage });
  }
  bufferSubData(target: number, offset: number, data: ArrayBuffer) {
    this.bufferSubDataCalls.push({ target, offset, byteLength: data.byteLength, buffer: data });
  }
  bindBufferBase(target: number, index: number, buffer: any) {}
  deleteBuffer(buffer: any) {}

  createVertexArray() {
    const va = {};
    this.createdVertexArrays.push(va);
    return va as any;
  }
  bindVertexArray(va: any) {}
  deleteVertexArray(va: any) {}

  createTexture() {
    const t = {};
    this.createdTextures.push(t);
    return t as any;
  }
  bindTexture(target: number, tex: any) {}
  texImage3D() {}
  texImage2D() {}
  texParameteri() {}
  deleteTexture(tex: any) {}
  activeTexture(unit: number) {}

  useProgram(p: any) {}
  bindFramebuffer(target: number, fb: any) {}
  viewport(x: number, y: number, w: number, h: number) {}
  clearColor(r: number, g: number, b: number, a: number) {}
  clear(mask: number) {}
  enable(cap: number) {}
  disable(cap: number) {}
  blendFuncSeparate() {}
  drawArrays(mode: number, first: number, count: number) {}
}

const COPERNICUS_50_DEPTHS = [
  0.494025, 1.541375, 2.645669, 3.819495, 5.078224, 6.440614, 7.92956, 9.572997,
  11.405, 13.46714, 15.81007, 18.49556, 21.59882, 25.21141, 29.44473, 34.43415,
  40.34405, 47.37369, 55.76429, 65.80727, 77.85385, 92.32607, 109.7293, 130.666,
  155.8507, 186.1256, 222.4752, 266.0403, 318.1274, 380.213, 453.9377, 541.0889,
  643.5668, 763.3331, 902.3393, 1062.44, 1245.291, 1452.251, 1684.284, 1941.893,
  2225.078, 2533.336, 2865.703, 3220.82, 3597.032, 3992.484, 4405.224, 4833.291,
  5274.784, 5727.917
];

function createTestCamera(): VolumeRaymarchingCameraState {
  const invViewProj = new Float32Array(16);
  invViewProj[0] = 1.0;
  invViewProj[5] = 1.0;
  invViewProj[10] = 1.0;
  invViewProj[15] = 1.0;
  return {
    viewMatrix: new Float32Array(16),
    projectionMatrix: new Float32Array(16),
    inverseViewProjectionMatrix: invViewProj,
    cameraPosition: [0.5, 0.5, -2.5],
    viewportWidth: 1920,
    viewportHeight: 1080,
  };
}

function createTestPacket(depthLevels?: number[] | Float32Array): RenderPacket {
  const brick: RenderPacketBrick = {
    brickKey: 'brick_0',
    lodLevel: 0,
    timestepIndex: 0,
    brickIndices: [0, 0, 0],
    sampleShape: [64, 64, 32],
    interiorValidShape: [62, 62, 30],
    haloPadding: [1, 1, 1],
    sampleOrigin: [0, 0, 0],
    spatialBounds: { minLon: 60, maxLon: 70, minLat: 10, maxLat: 20, minDepth: 0.494, maxDepth: 5727.917 },
    normalizedBounds: { minU: 0, maxU: 1, minV: 0, maxV: 1, minW: 0, maxW: 1 },
    scalarMin: 0.0,
    scalarMax: 1.5,
    rawBuffer: new Uint16Array(64 * 64 * 32),
    scalarData: new Float32Array(64 * 64 * 32),
    validityMask: new Uint8Array(64 * 64 * 32),
    isFallback: false,
    isResident: true,
  };

  return {
    packetId: 'pkt_adversarial',
    frameTimestampMs: 1700000000,
    datasetId: 'cmems_mod_glo_phy_my_0.083deg_P1D-m',
    snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
    visualizationProductId: 'vis_speed',
    productVersion: 'v1.0.0',
    manifestSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    timestepIndex: 0,
    timestepUtc: '2026-08-24T00:00:00Z',
    targetLodLevel: 0,
    isDegraded: false,
    totalBricksInVolume: 1,
    activeBricksCount: 1,
    bricks: [brick],
    depthLutEntriesM: depthLevels ? Float32Array.from(depthLevels) : undefined,
    clippingBox: { minU: 0.05, maxU: 0.95, minV: 0.1, maxV: 0.9, minW: 0.0, maxW: 1.0 },
    coordinateUniforms: {
      originLongitudeDeg: 60,
      originLatitudeDeg: 10,
      originDepthM: 0.494,
      minLongitudeDeg: 60,
      maxLongitudeDeg: 70,
      minLatitudeDeg: 10,
      maxLatitudeDeg: 20,
      minDepthM: 0.494,
      maxDepthM: 5727.917,
      verticalExaggeration: 1.0,
    },
    scalarMin: 0.0,
    scalarMax: 1.5,
    canonicalUnits: 'm/s',
  };
}

describe('M2 Challenger Task 1: Empirical Verification of std140 Layout (1,184 Bytes)', () => {
  it('should verify exact byte length and std140 offsets for every struct member in the UBO', () => {
    const gl = new MockWebGL2Context();
    const renderer = new WebGL2RaymarchingRenderer(gl as unknown as WebGL2RenderingContext);

    const camera = createTestCamera();
    const packet = createTestPacket(COPERNICUS_50_DEPTHS);

    const ubo = renderer.packUniforms({
      packet,
      camera,
      stepSize: 0.0035,
      referenceStepSize: 0.005,
      earlyTerminationAlpha: 0.99,
      maxSteps: 512,
    }, true);

    // 1. Total buffer allocation must be strictly 1,184 bytes
    assert.equal(ubo.byteLength, 1184, 'Total UBO buffer size must be exactly 1,184 bytes');

    const f32 = new Float32Array(ubo);
    const u32 = new Uint32Array(ubo);
    const dataView = new DataView(ubo);

    // 2. Member: uInverseViewProjection (mat4, 64 bytes, offset 0..63)
    // 16 floats at indices 0..15
    assert.equal(dataView.getFloat32(0, true), 1.0);
    assert.equal(dataView.getFloat32(5 * 4, true), 1.0);
    assert.equal(dataView.getFloat32(10 * 4, true), 1.0);
    assert.equal(dataView.getFloat32(15 * 4, true), 1.0);

    // 3. Member: uCameraPosition (vec3, 12 bytes, offset 64..75, std140 base alignment 16)
    assert.equal(dataView.getFloat32(64, true), 0.5);  // x
    assert.equal(dataView.getFloat32(68, true), 0.5);  // y
    assert.equal(dataView.getFloat32(72, true), -2.5); // z

    // 4. Member: uStepSize (float, 4 bytes, offset 76..79, base alignment 4)
    assert.ok(Math.abs(dataView.getFloat32(76, true) - 0.0035) < 1e-6);

    // 5. Member: uClipMin (vec3, 12 bytes, offset 80..91, std140 base alignment 16)
    assert.ok(Math.abs(dataView.getFloat32(80, true) - 0.05) < 1e-6); // minU
    assert.ok(Math.abs(dataView.getFloat32(84, true) - 0.1) < 1e-6);  // minV
    assert.ok(Math.abs(dataView.getFloat32(88, true) - 0.0) < 1e-6);  // minW

    // 6. Member: uReferenceStepSize (float, 4 bytes, offset 92..95, base alignment 4)
    assert.ok(Math.abs(dataView.getFloat32(92, true) - 0.005) < 1e-6);

    // 7. Member: uClipMax (vec3, 12 bytes, offset 96..107, std140 base alignment 16)
    assert.ok(Math.abs(dataView.getFloat32(96, true) - 0.95) < 1e-6); // maxU
    assert.ok(Math.abs(dataView.getFloat32(100, true) - 0.9) < 1e-6); // maxV
    assert.ok(Math.abs(dataView.getFloat32(104, true) - 1.0) < 1e-6); // maxW

    // 8. Member: uEarlyTerminationAlpha (float, 4 bytes, offset 108..111, base alignment 4)
    assert.ok(Math.abs(dataView.getFloat32(108, true) - 0.99) < 1e-6);

    // 9. Member: uScalarOffset, uScalarScale, uScalarMin, uScalarMax (4 x float, offset 112..127, base alignment 4)
    assert.equal(dataView.getFloat32(112, true), 0.0); // uScalarOffset
    assert.ok(Math.abs(dataView.getFloat32(116, true) - (1.5 / 65535.0)) < 1e-6); // uScalarScale
    assert.equal(dataView.getFloat32(120, true), 0.0); // uScalarMin
    assert.equal(dataView.getFloat32(124, true), 1.5); // uScalarMax

    // 10. Member: uDepthLevelCount, uIsFloatScalar, uUseValidityMask, uMaxSteps (4 x uint, offset 128..143, base alignment 4)
    assert.equal(dataView.getUint32(128, true), 50); // uDepthLevelCount
    assert.equal(dataView.getUint32(132, true), 1);  // uIsFloatScalar = 1
    assert.equal(dataView.getUint32(136, true), 1);  // uUseValidityMask = 1
    assert.equal(dataView.getUint32(140, true), 512);// uMaxSteps = 512

    // 11. Member: uViewport (vec4, 16 bytes, offset 144..159, std140 base alignment 16)
    assert.equal(dataView.getFloat32(144, true), 1920); // width
    assert.equal(dataView.getFloat32(148, true), 1080); // height
    assert.ok(Math.abs(dataView.getFloat32(152, true) - (1 / 1920)) < 1e-6); // 1/width
    assert.ok(Math.abs(dataView.getFloat32(156, true) - (1 / 1080)) < 1e-6); // 1/height

    // 12. Header total size: exactly 160 bytes (40 32-bit words)
    // 13. Member: uDepthLutEntries[64] (array of 64 vec4, 64 * 16 = 1024 bytes, offset 160..1183)
    for (let i = 0; i < 50; i++) {
      const entryByteOffset = 160 + i * 16;
      const val = dataView.getFloat32(entryByteOffset, true);
      assert.ok(
        Math.abs(val - COPERNICUS_50_DEPTHS[i]) < 1e-3,
        `Depth entry ${i} at byte ${entryByteOffset} must equal ${COPERNICUS_50_DEPTHS[i]}, got ${val}`
      );
      // y, z, w components should remain uncorrupted/zero
      assert.equal(dataView.getFloat32(entryByteOffset + 4, true), 0.0);
      assert.equal(dataView.getFloat32(entryByteOffset + 8, true), 0.0);
      assert.equal(dataView.getFloat32(entryByteOffset + 12, true), 0.0);
    }

    // Unused tail slots (50..63)
    for (let i = 50; i < 64; i++) {
      const entryByteOffset = 160 + i * 16;
      assert.equal(dataView.getFloat32(entryByteOffset, true), 0.0);
    }
  });
});

describe('M2 Challenger Task 2: Depth LUT Boundary Cases (0, 1, 31, 50, 64, >64 Levels)', () => {
  const gl = new MockWebGL2Context();
  const renderer = new WebGL2RaymarchingRenderer(gl as unknown as WebGL2RenderingContext);
  const camera = createTestCamera();

  // GLSL depth evaluation function emulation matching volume_raymarch.glsl.ts
  function evaluateNormalizedDepthToPhysicalShader(normW: number, levelCount: number, lutEntries: Float32Array): number {
    if (levelCount < 2) {
      return normW;
    }
    const maxIdx = levelCount - 1;
    const continuousIndex = Math.min(Math.max(normW * maxIdx, 0.0), maxIdx);
    const lowerIdx = Math.floor(continuousIndex);
    const upperIdx = Math.min(levelCount - 1, lowerIdx + 1);
    const frac = continuousIndex - lowerIdx;

    const zLower = lutEntries[lowerIdx];
    const zUpper = lutEntries[upperIdx];
    return zLower * (1.0 - frac) + zUpper * frac;
  }

  it('Boundary Case 1: 0 levels (empty/null/undefined depth array)', () => {
    // 1a. undefined depth array
    const pktUndef = createTestPacket(undefined);
    const uboUndef = renderer.packUniforms({ packet: pktUndef, camera }, false);
    const u32Undef = new Uint32Array(uboUndef);
    assert.equal(u32Undef[32], 0, 'Level count must be 0 for undefined depth array');

    // Shader behavior for 0 levels: passes through normalized coordinate
    const depthShader0 = evaluateNormalizedDepthToPhysicalShader(0.42, 0, new Float32Array(64));
    assert.equal(depthShader0, 0.42, 'Shader must return normalized coordinate normW when levelCount < 2');

    // 1b. empty array []
    const pktEmpty = createTestPacket([]);
    const uboEmpty = renderer.packUniforms({ packet: pktEmpty, camera }, false);
    const u32Empty = new Uint32Array(uboEmpty);
    assert.equal(u32Empty[32], 0, 'Level count must be 0 for empty depth array');
  });

  it('Boundary Case 2: 1 level ([100.0 m])', () => {
    const pkt1 = createTestPacket([100.0]);
    const ubo1 = renderer.packUniforms({ packet: pkt1, camera }, false);
    const u32_1 = new Uint32Array(ubo1);
    const f32_1 = new Float32Array(ubo1);

    assert.equal(u32_1[32], 1, 'Level count must be 1');
    assert.equal(f32_1[40], 100.0, 'Slot 0 must store 100.0 m');

    // Shader fallback: levelCount < 2 -> returns normW without division by zero
    const depthShader1 = evaluateNormalizedDepthToPhysicalShader(0.75, 1, new Float32Array([100.0]));
    assert.equal(depthShader1, 0.75, 'Shader must return normalized coordinate normW when levelCount < 2');
  });

  it('Boundary Case 3: 31 levels (standard 31-level ocean depth grid)', () => {
    const depths31 = COPERNICUS_50_DEPTHS.slice(0, 31);
    const pkt31 = createTestPacket(depths31);
    const ubo31 = renderer.packUniforms({ packet: pkt31, camera }, false);
    const u32_31 = new Uint32Array(ubo31);
    const f32_31 = new Float32Array(ubo31);

    assert.equal(u32_31[32], 31, 'Level count must be 31');
    assert.ok(Math.abs(f32_31[40] - depths31[0]) < 1e-4);
    assert.ok(Math.abs(f32_31[40 + 30 * 4] - depths31[30]) < 1e-4);

    // Verify CPU depth lookup table vs Shader implementation parity
    const lut31 = new DepthLookupTable(depths31);
    for (let i = 0; i <= 100; i++) {
      const w = i / 100.0;
      const cpuPhysical = lut31.normalizedToPhysical(w);
      const shaderPhysical = evaluateNormalizedDepthToPhysicalShader(w, 31, Float32Array.from(depths31));
      assert.ok(
        Math.abs(cpuPhysical - shaderPhysical) < 1e-4,
        `Parity mismatch at normalized depth w=${w}: CPU=${cpuPhysical}, Shader=${shaderPhysical}`
      );
    }
  });

  it('Boundary Case 4: 50 levels (all Copernicus physics layers: 0.494m to 5727.917m)', () => {
    const pkt50 = createTestPacket(COPERNICUS_50_DEPTHS);
    const ubo50 = renderer.packUniforms({ packet: pkt50, camera }, false);
    const u32_50 = new Uint32Array(ubo50);
    const f32_50 = new Float32Array(ubo50);

    assert.equal(u32_50[32], 50, 'Level count must be 50');

    // Surface layer
    assert.ok(Math.abs(f32_50[40] - 0.494025) < 1e-4);
    // Deepest abyssal layer
    assert.ok(Math.abs(f32_50[40 + 49 * 4] - 5727.917) < 1e-3);

    // Verify strict monotonic mapping across full vertical column
    const lut50 = new DepthLookupTable(COPERNICUS_50_DEPTHS);
    let prevDepth = -Infinity;
    for (let i = 0; i <= 500; i++) {
      const w = i / 500.0;
      const depthM = lut50.normalizedToPhysical(w);
      assert.ok(depthM >= prevDepth, `Monotonicity violated at w=${w}: ${depthM} < ${prevDepth}`);
      prevDepth = depthM;
    }
  });

  it('Boundary Case 5: 64 levels (exact maximum capacity)', () => {
    const depths64 = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      depths64[i] = i * 100.0;
    }

    const pkt64 = createTestPacket(depths64);
    const ubo64 = renderer.packUniforms({ packet: pkt64, camera }, false);
    const u32_64 = new Uint32Array(ubo64);
    const f32_64 = new Float32Array(ubo64);

    assert.equal(u32_64[32], 64, 'Level count must be 64');
    assert.equal(f32_64[40], 0.0);
    assert.equal(f32_64[40 + 63 * 4], 6300.0, 'Slot 63 must contain 6300.0');

    // Word 292 is the 64th entry .x
    // Total float words = 296 (1184 bytes)
    assert.equal(ubo64.byteLength, 1184);

    // Verify shader bounds checking at exact endpoints
    const top = evaluateNormalizedDepthToPhysicalShader(0.0, 64, depths64);
    assert.equal(top, 0.0);
    const bottom = evaluateNormalizedDepthToPhysicalShader(1.0, 64, depths64);
    assert.equal(bottom, 6300.0);
  });

  it('Boundary Case 6: >64 levels (75 and 128 levels: safe clamping to 64 without buffer overflow)', () => {
    const depths75 = new Float32Array(75);
    for (let i = 0; i < 75; i++) {
      depths75[i] = i * 50.0;
    }

    const pkt75 = createTestPacket(depths75);
    const ubo75 = renderer.packUniforms({ packet: pkt75, camera }, false);
    const u32_75 = new Uint32Array(ubo75);
    const f32_75 = new Float32Array(ubo75);

    // Must be clamped to 64
    assert.equal(u32_75[32], 64, 'Level count must clamp to 64 when input > 64');
    assert.equal(ubo75.byteLength, 1184, 'Buffer size must remain strictly 1,184 bytes');
    assert.equal(f32_75[40 + 63 * 4], 63 * 50.0, 'Slot 63 must contain depth level 63');

    // 128 levels
    const depths128 = new Float32Array(128);
    for (let i = 0; i < 128; i++) depths128[i] = i * 25.0;
    const pkt128 = createTestPacket(depths128);
    const ubo128 = renderer.packUniforms({ packet: pkt128, camera }, false);
    const u32_128 = new Uint32Array(ubo128);
    assert.equal(u32_128[32], 64, 'Level count must clamp to 64 for 128 levels');
    assert.equal(ubo128.byteLength, 1184);
  });
});

describe('M2 Challenger Task 3: Opacity Curve Interpolation for Speed (Yu et al. 2025)', () => {
  it('should validate speed transfer function configuration parameters', () => {
    const tf = new TransferFunctionModel();
    tf.configureForVariable('speed');

    assert.equal(tf.colormapName, 'turbo');
    assert.equal(tf.domainMin, 0.0);
    assert.equal(tf.domainMax, 1.5);
    assert.equal(tf.unit, 'm/s');
    assert.equal(tf.clampedMin, 0.0);
    assert.equal(tf.clampedMax, 1.5);

    const pts = tf.state.opacityControlPoints;
    assert.equal(pts.length, 5);
    assert.deepEqual(
      pts.map((p) => ({ t: p.normalizedScalar, alpha: p.opacity })),
      [
        { t: 0.0, alpha: 0.00 },
        { t: 0.08, alpha: 0.02 },
        { t: 0.25, alpha: 0.20 },
        { t: 0.46, alpha: 0.85 },
        { t: 1.0, alpha: 0.98 },
      ]
    );
  });

  it('should rigorously test Quiescent Zone (<0.1 m/s): opacity must remain <= 0.02', () => {
    const tf = new TransferFunctionModel();
    tf.configureForVariable('speed');

    const quiescentTestPoints = [
      0.0,
      0.01,
      0.025,
      0.05,
      0.075,
      0.09,
      0.099,
      0.10,
    ];

    for (const v of quiescentTestPoints) {
      const res = tf.evaluateScalar(v);
      assert.equal(res.isOutOfRange, false);
      assert.ok(
        res.opacity <= 0.02,
        `Quiescent speed ${v} m/s produced opacity ${res.opacity} > 0.02 (violates quiescent transparency)`
      );
      assert.ok(
        res.opacity >= 0.0,
        `Quiescent speed ${v} m/s produced negative opacity ${res.opacity}`
      );
    }
  });

  it('should rigorously test Transition Zone (0.1 - 0.7 m/s): monotonic ramp from 0.017 to 0.85', () => {
    const tf = new TransferFunctionModel();
    tf.configureForVariable('speed');

    const transitionTestPoints = [
      0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.375, 0.45, 0.50, 0.60, 0.65, 0.69, 0.70
    ];

    let prevOpacity = -1;
    for (const v of transitionTestPoints) {
      const res = tf.evaluateScalar(v);
      assert.equal(res.isOutOfRange, false);
      assert.ok(
        res.opacity >= prevOpacity,
        `Non-monotonic transition at ${v} m/s: opacity ${res.opacity} < previous ${prevOpacity}`
      );
      assert.ok(
        res.opacity >= 0.01 && res.opacity <= 0.90,
        `Transition speed ${v} m/s opacity ${res.opacity} outside expected range [0.01, 0.90]`
      );
      prevOpacity = res.opacity;
    }

    // Exact check at control points:
    // v = 0.12 m/s (t = 0.08) -> alpha = 0.02
    assert.ok(Math.abs(tf.evaluateScalar(0.12).opacity - 0.02) < 1e-4);
    // v = 0.375 m/s (t = 0.25) -> alpha = 0.20
    assert.ok(Math.abs(tf.evaluateScalar(0.375).opacity - 0.20) < 1e-4);
    // v = 0.69 m/s (t = 0.46) -> alpha = 0.85
    assert.ok(Math.abs(tf.evaluateScalar(0.69).opacity - 0.85) < 1e-4);
  });

  it('should rigorously test Jet Core Zone (>0.7 m/s): opacity must remain >= 0.85', () => {
    const tf = new TransferFunctionModel();
    tf.configureForVariable('speed');

    const jetCoreTestPoints = [
      0.70,
      0.75,
      0.80,
      0.90,
      1.00,
      1.10,
      1.25,
      1.40,
      1.50,
    ];

    let prevOpacity = 0.84;
    for (const v of jetCoreTestPoints) {
      const res = tf.evaluateScalar(v);
      assert.equal(res.isOutOfRange, false);
      assert.ok(
        res.opacity >= 0.85,
        `Jet core speed ${v} m/s produced opacity ${res.opacity} < 0.85 (violates jet core prominence)`
      );
      assert.ok(
        res.opacity <= 1.0,
        `Jet core speed ${v} m/s produced opacity ${res.opacity} > 1.0`
      );
      assert.ok(
        res.opacity >= prevOpacity,
        `Non-monotonic jet core at ${v} m/s: opacity ${res.opacity} < previous ${prevOpacity}`
      );
      prevOpacity = res.opacity;
    }

    // Top speed (1.5 m/s)
    assert.ok(Math.abs(tf.evaluateScalar(1.5).opacity - 0.98) < 1e-4);
  });

  it('should challenge out-of-range policies and clamps for speed', () => {
    const tf = new TransferFunctionModel();
    tf.configureForVariable('speed');

    // Policy 1: discard_transparent (default)
    tf.setOutOfRangePolicy('discard_transparent');
    const negRes = tf.evaluateScalar(-0.5);
    assert.equal(negRes.isOutOfRange, true);
    assert.equal(negRes.opacity, 0.0);

    const overRes = tf.evaluateScalar(2.0);
    assert.equal(overRes.isOutOfRange, true);
    assert.equal(overRes.opacity, 0.0);

    // Policy 2: clamp_to_edge_color
    tf.setOutOfRangePolicy('clamp_to_edge_color');
    const clampedNeg = tf.evaluateScalar(-0.5);
    assert.equal(clampedNeg.isOutOfRange, true);
    assert.equal(clampedNeg.opacity, 0.0);

    const clampedOver = tf.evaluateScalar(2.0);
    assert.equal(clampedOver.isOutOfRange, true);
    assert.equal(clampedOver.opacity, 0.98);

    // Policy 3: render_alert_color
    tf.setOutOfRangePolicy('render_alert_color');
    const alertRes = tf.evaluateScalar(2.5);
    assert.equal(alertRes.isOutOfRange, true);
    assert.equal(alertRes.opacity, 1.0);
    assert.deepEqual(alertRes.color, { r: 1.0, g: 0.0, b: 1.0 });
  });

  it('should verify bidirectional variable transitions (thetao -> speed -> thetao) preserve state integrity', () => {
    const tf = new TransferFunctionModel();

    // 1. Initial thetao state
    tf.configureForVariable('thetao');
    assert.equal(tf.colormapName, 'thermal');
    assert.equal(tf.unit, '°C');
    assert.equal(tf.domainMin, 1.0);
    assert.equal(tf.domainMax, 30.5);

    // 2. Transition to speed
    tf.configureForVariable('speed');
    assert.equal(tf.colormapName, 'turbo');
    assert.equal(tf.unit, 'm/s');
    assert.equal(tf.domainMin, 0.0);
    assert.equal(tf.domainMax, 1.5);
    assert.ok(tf.evaluateScalar(0.05).opacity <= 0.02);
    assert.ok(tf.evaluateScalar(1.0).opacity >= 0.85);

    // 3. Transition back to thetao
    tf.configureForVariable('thetao');
    assert.equal(tf.colormapName, 'thermal');
    assert.equal(tf.unit, '°C');
    assert.equal(tf.domainMin, 1.0);
    assert.equal(tf.domainMax, 30.5);
    assert.ok(tf.evaluateScalar(2.0).opacity <= 0.05); // low temp transparency
    assert.ok(tf.evaluateScalar(30.0).opacity >= 0.80); // warm layer prominence
  });
});
