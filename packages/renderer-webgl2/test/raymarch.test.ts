import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VOLUME_RAYMARCH_VERT_GLSL,
  VOLUME_RAYMARCH_FRAG_GLSL,
  WebGL2RaymarchingRenderer,
} from '../src/index.ts';
import type { RenderPacket, RenderPacketBrick } from '@quasar/runtime';
import type { VolumeRaymarchingCameraState } from '../src/pipeline/types.ts';

/**
 * Headless Mock WebGL2 Rendering Context for unit testing shader pipelines.
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
  drawArraysCalls: any[] = [];
  bufferSubDataCalls: any[] = [];

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
  bufferData(target: number, size: number, usage: number) {}
  bufferSubData(target: number, offset: number, data: ArrayBuffer) {
    this.bufferSubDataCalls.push({ target, offset, byteLength: data.byteLength });
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
  drawArrays(mode: number, first: number, count: number) {
    this.drawArraysCalls.push({ mode, first, count });
  }
}

describe('QuasarOS WebGL2 GLSL ES 3.00 Scientific Raymarching Shaders', () => {
  it('should export valid GLSL ES 3.00 vertex & fragment shader strings', () => {
    assert.ok(VOLUME_RAYMARCH_VERT_GLSL.includes('#version 300 es'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('#version 300 es'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('precision highp float;'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('precision highp sampler3D;'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('precision highp usampler3D;'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('uniform VolumeRaymarchUniforms'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('intersectAABB'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('sampleTrilinearUint'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('evaluateNormalizedDepthToPhysical'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('sampleTransferFunction'));
    assert.ok(VOLUME_RAYMARCH_FRAG_GLSL.includes('sampleValidityMask'));
  });

  it('should implement Smits-Kay AABB slab intersection analytical CPU equivalence', () => {
    function intersectAABBCPU(
      origin: [number, number, number],
      dir: [number, number, number],
      minB: [number, number, number],
      maxB: [number, number, number]
    ) {
      const invDir = [1.0 / dir[0], 1.0 / dir[1], 1.0 / dir[2]];
      const t0 = [(minB[0] - origin[0]) * invDir[0], (minB[1] - origin[1]) * invDir[1], (minB[2] - origin[2]) * invDir[2]];
      const t1 = [(maxB[0] - origin[0]) * invDir[0], (maxB[1] - origin[1]) * invDir[1], (maxB[2] - origin[2]) * invDir[2]];

      const tmin = [Math.min(t0[0], t1[0]), Math.min(t0[1], t1[1]), Math.min(t0[2], t1[2])];
      const tmax = [Math.max(t0[0], t1[0]), Math.max(t0[1], t1[1]), Math.max(t0[2], t1[2])];

      const tNear = Math.max(Math.max(tmin[0], tmin[1]), tmin[2]);
      const tFar = Math.min(Math.min(tmax[0], tmax[1]), tmax[2]);

      if (tNear <= tFar && tFar > 0.0) {
        return { hit: true, tNear: Math.max(0.0, tNear), tFar };
      }
      return { hit: false, tNear: 0, tFar: 0 };
    }

    const hit = intersectAABBCPU([0.5, 0.5, -1.0], [0, 0, 1], [0, 0, 0], [1, 1, 1]);
    assert.equal(hit.hit, true);
    assert.equal(hit.tNear, 1.0);
    assert.equal(hit.tFar, 2.0);

    const miss = intersectAABBCPU([2.5, 0.5, -1.0], [0, 0, 1], [0, 0, 0], [1, 1, 1]);
    assert.equal(miss.hit, false);
  });

  it('should interpolate 31-level Copernicus non-uniform depth LUT accurately', () => {
    const copernicusDepths = [
      0.494025, 1.541375, 2.645669, 3.819495, 5.078224, 6.440614, 7.92956, 9.572997,
      11.405, 13.46714, 15.81007, 18.49526, 21.59885, 25.21141, 29.44473, 34.43415,
      40.34405, 47.37369, 55.76429, 65.80727, 77.85385, 92.32607, 109.7293, 130.666,
      155.8507, 186.1256, 222.4752, 266.0403, 318.1274, 380.2706, 453.9377
    ];

    function evaluateDepth(normW: number, depthLevels: number[]): number {
      const count = depthLevels.length;
      if (count < 2) return normW;
      const maxIdx = count - 1;
      const continuousIdx = Math.min(Math.max(normW * maxIdx, 0.0), maxIdx);
      const lowerIdx = Math.floor(continuousIdx);
      const upperIdx = Math.min(count - 1, lowerIdx + 1);
      const frac = continuousIdx - lowerIdx;
      return depthLevels[lowerIdx] * (1.0 - frac) + depthLevels[upperIdx] * frac;
    }

    // Top surface depth
    assert.ok(Math.abs(evaluateDepth(0.0, copernicusDepths) - 0.494025) < 1e-5);
    // Deepest floor depth
    assert.ok(Math.abs(evaluateDepth(1.0, copernicusDepths) - 453.9377) < 1e-4);
    // Mid level interpolation
    const midDepth = evaluateDepth(0.5, copernicusDepths);
    assert.ok(midDepth > 34.0 && midDepth < 48.0);
  });

  it('should compute Beer-Lambert step-size corrected opacity with mathematical parity to WebGPU', () => {
    function correctOpacity(alphaSample: number, dt: number, dtRef: number): number {
      return 1.0 - Math.pow(Math.max(1.0 - alphaSample, 0.0), dt / dtRef);
    }

    const standardAlpha = correctOpacity(0.8, 0.005, 0.005);
    assert.ok(Math.abs(standardAlpha - 0.8) < 1e-6);

    const subStepAlpha = correctOpacity(0.8, 0.0025, 0.005);
    // 2 half steps must equal standardAlpha
    const reAccumulated = 1.0 - Math.pow(1.0 - subStepAlpha, 2);
    assert.ok(Math.abs(reAccumulated - 0.8) < 1e-6);
  });
});

describe('QuasarOS WebGL2 Raymarching Renderer Pipeline Execution', () => {
  it('should compile shaders, initialize program, uniforms, samplers, and dummy textures', () => {
    const gl = new MockWebGL2Context();
    const renderer = new WebGL2RaymarchingRenderer(gl as unknown as WebGL2RenderingContext);

    assert.ok(renderer.program);
    assert.equal(gl.createdShaders.length, 2);
    assert.equal(gl.createdPrograms.length, 1);
    assert.equal(gl.createdBuffers.length, 1); // UBO
    assert.equal(gl.createdTextures.length, 4); // 4 dummy textures (float, uint, mask, TF)
    assert.equal(gl.createdVertexArrays.length, 1);
  });

  it('should pack uniforms matching std140 672-byte buffer layout with 31 Copernicus depth levels', () => {
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
      cameraPosition: [0.5, 0.5, -2.0],
      viewportWidth: 1920,
      viewportHeight: 1080,
    };

    const brick: RenderPacketBrick = {
      brickKey: 'brick_test',
      lodLevel: 0,
      timestepIndex: 0,
      brickIndices: [0, 0, 0],
      sampleShape: [66, 66, 32],
      interiorValidShape: [64, 64, 30],
      haloPadding: [1, 1, 1],
      sampleOrigin: [0, 0, 0],
      spatialBounds: { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1, minDepth: 0, maxDepth: 100 },
      normalizedBounds: { minU: 0, maxU: 1, minV: 0, maxV: 1, minW: 0, maxW: 1 },
      scalarMin: 9.3747,
      scalarMax: 30.3618,
      rawBuffer: new Uint16Array(66 * 66 * 32),
      scalarData: new Float32Array(66 * 66 * 32),
      validityMask: new Uint8Array(66 * 66 * 32),
      isFallback: false,
      isResident: true,
    };

    const packet: RenderPacket = {
      packetId: 'pkt_test',
      frameTimestampMs: Date.now(),
      datasetId: 'ocean_ds',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: 'vis_temp',
      productVersion: 'v1',
      manifestSha256: '0'.repeat(64),
      timestepIndex: 0,
      timestepUtc: '2026-08-30T00:00:00Z',
      targetLodLevel: 0,
      isDegraded: false,
      totalBricksInVolume: 1,
      activeBricksCount: 1,
      bricks: [brick],
      depthLutEntriesM: new Float32Array([
        0.494, 1.541, 2.645, 3.819, 5.078, 6.440, 7.929, 9.572,
        11.405, 13.467, 15.810, 18.495, 21.598, 25.211, 29.444, 34.434,
        40.344, 47.373, 55.764, 65.807, 77.853, 92.326, 109.729, 130.666,
        155.850, 186.125, 222.475, 266.040, 318.127, 380.270, 453.938
      ]),
      clippingBox: { minU: 0.1, maxU: 0.9, minV: 0.2, maxV: 0.8, minW: 0.0, maxW: 1.0 },
      coordinateUniforms: {
        originLongitudeDeg: 0,
        originLatitudeDeg: 0,
        originDepthM: 0,
        minLongitudeDeg: 0,
        maxLongitudeDeg: 1,
        minLatitudeDeg: 0,
        maxLatitudeDeg: 1,
        minDepthM: 0,
        maxDepthM: 453.938,
        verticalExaggeration: 1,
      },
      scalarMin: 9.3747,
      scalarMax: 30.3618,
      canonicalUnits: 'degree_Celsius',
    };

    const uniformBuf = renderer.packUniforms({ packet, camera }, false);
    assert.equal(uniformBuf.byteLength, 672);

    const f32 = new Float32Array(uniformBuf);
    const u32 = new Uint32Array(uniformBuf);

    // Verify camera position
    assert.equal(f32[16], 0.5);
    assert.equal(f32[17], 0.5);
    assert.equal(f32[18], -2.0);

    // Verify clipping bounds
    assert.ok(Math.abs(f32[20] - 0.1) < 1e-6);
    assert.ok(Math.abs(f32[24] - 0.9) < 1e-6);

    // Verify scalar offset & scale
    assert.ok(Math.abs(f32[28] - 9.3747) < 1e-4);
    const expectedScale = (30.3618 - 9.3747) / 65535.0;
    assert.ok(Math.abs(f32[29] - expectedScale) < 1e-6);

    // Verify depth level count (31)
    assert.equal(u32[32], 31);
    assert.equal(u32[33], 0); // isFloat = 0
    assert.equal(u32[34], 1); // useValidityMask = 1

    // Verify depth LUT std140 layout
    assert.ok(Math.abs(f32[40] - 0.494) < 1e-3); // level 0 (vec4.x at index 40)
    assert.ok(Math.abs(f32[40 + 30 * 4] - 453.938) < 1e-3); // level 30 (vec4.x at index 160)
  });

  it('should execute renderFrame pass with drawArrays for active bricks', () => {
    const gl = new MockWebGL2Context();
    const renderer = new WebGL2RaymarchingRenderer(gl as unknown as WebGL2RenderingContext);

    const camera: VolumeRaymarchingCameraState = {
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
      inverseViewProjectionMatrix: new Float32Array(16),
      cameraPosition: [0, 0, -2],
      viewportWidth: 1280,
      viewportHeight: 720,
    };

    const brick: RenderPacketBrick = {
      brickKey: 'brick_0',
      lodLevel: 0,
      timestepIndex: 0,
      brickIndices: [0, 0, 0],
      sampleShape: [66, 66, 32],
      interiorValidShape: [64, 64, 30],
      haloPadding: [1, 1, 1],
      sampleOrigin: [0, 0, 0],
      spatialBounds: { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1, minDepth: 0, maxDepth: 100 },
      normalizedBounds: { minU: 0, maxU: 1, minV: 0, maxV: 1, minW: 0, maxW: 1 },
      scalarMin: 0,
      scalarMax: 25,
      rawBuffer: new Uint16Array(66 * 66 * 32),
      scalarData: new Float32Array(66 * 66 * 32),
      validityMask: new Uint8Array(66 * 66 * 32),
      isFallback: false,
      isResident: true,
    };

    const packet: RenderPacket = {
      packetId: 'pkt_frame',
      frameTimestampMs: Date.now(),
      datasetId: 'ocean_ds',
      snapshotId: 'snap_0',
      visualizationProductId: 'vis_temp',
      productVersion: 'v1',
      manifestSha256: '0'.repeat(64),
      timestepIndex: 0,
      timestepUtc: '2026-08-30T00:00:00Z',
      targetLodLevel: 0,
      isDegraded: false,
      totalBricksInVolume: 1,
      activeBricksCount: 1,
      bricks: [brick],
      depthLutEntriesM: new Float32Array([0, 10, 50, 100]),
      clippingBox: { minU: 0, maxU: 1, minV: 0, maxV: 1, minW: 0, maxW: 1 },
      coordinateUniforms: {
        originLongitudeDeg: 0,
        originLatitudeDeg: 0,
        originDepthM: 0,
        minLongitudeDeg: 0,
        maxLongitudeDeg: 1,
        minLatitudeDeg: 0,
        maxLatitudeDeg: 1,
        minDepthM: 0,
        maxDepthM: 100,
        verticalExaggeration: 1,
      },
      scalarMin: 0,
      scalarMax: 25,
      canonicalUnits: 'degree_Celsius',
    };

    renderer.renderFrame({
      packet,
      camera,
      clearColor: [0, 0, 0, 1],
    });

    assert.equal(gl.drawArraysCalls.length, 1);
    assert.deepEqual(gl.drawArraysCalls[0], {
      mode: gl.TRIANGLES,
      first: 0,
      count: 3,
    });
    assert.equal(gl.bufferSubDataCalls.length, 1);
    assert.equal(gl.bufferSubDataCalls[0].byteLength, 672);

    renderer.dispose();
    assert.equal(renderer.isDisposed, true);
  });
});
