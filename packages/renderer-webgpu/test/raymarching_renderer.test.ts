import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VOLUME_RAYMARCH_WGSL,
  VolumeRaymarchingRenderer,
  GPUResidencyAdapter,
  GPUResourceManager,
} from '../src/index.ts';
import type { RenderPacket, RenderPacketBrick } from '@quasar/runtime';
import type { VolumeRaymarchingCameraState } from '../src/pipeline/types.ts';

/**
 * Mock WebGPU Device, Pipeline, and Command Buffer classes for headless unit testing.
 */
class MockGPUQueue {
  writeTextureCalls: any[] = [];
  writeBufferCalls: any[] = [];

  writeTexture(destination: any, data: any, dataLayout: any, size: any): void {
    this.writeTextureCalls.push({ destination, data, dataLayout, size });
  }

  writeBuffer(buffer: any, bufferOffset: any, data: any, dataOffset?: any, size?: any): void {
    this.writeBufferCalls.push({ buffer, bufferOffset, data, dataOffset, size });
  }
}

class MockGPUTexture {
  label: string;
  size: [number, number, number];
  dimension: string;
  format: string;
  usage: number;
  isDestroyed = false;

  constructor(desc: any) {
    this.label = desc.label || '';
    const s = desc.size;
    this.size = Array.isArray(s) ? s : [Number(s), 1, 1];
    this.dimension = desc.dimension || '2d';
    this.format = desc.format;
    this.usage = desc.usage;
  }

  createView(desc?: any) {
    return { label: desc?.label ?? this.label, texture: this } as any;
  }

  destroy() {
    this.isDestroyed = true;
  }
}

class MockGPUBuffer {
  label: string;
  size: number;
  usage: number;
  isDestroyed = false;

  constructor(desc: any) {
    this.label = desc.label || '';
    this.size = desc.size;
    this.usage = desc.usage;
  }

  destroy() {
    this.isDestroyed = true;
  }
}

class MockGPURenderPassEncoder {
  label: string;
  pipeline: any = null;
  bindGroups: Map<number, any> = new Map();
  drawCalls: any[] = [];
  isEnded = false;

  constructor(desc: any) {
    this.label = desc.label || '';
  }

  setPipeline(pipeline: any) {
    this.pipeline = pipeline;
  }

  setBindGroup(index: number, bindGroup: any) {
    this.bindGroups.set(index, bindGroup);
  }

  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number) {
    this.drawCalls.push({ vertexCount, instanceCount, firstVertex, firstInstance });
  }

  end() {
    this.isEnded = true;
  }
}

class MockGPUCommandEncoder {
  label: string;
  renderPasses: MockGPURenderPassEncoder[] = [];

  constructor(desc: any) {
    this.label = desc.label || '';
  }

  beginRenderPass(desc: any) {
    const pass = new MockGPURenderPassEncoder(desc);
    this.renderPasses.push(pass);
    return pass as any;
  }

  finish() {
    return { label: 'MockGPUCommandBuffer' } as any;
  }
}

class MockGPUDevice {
  queue = new MockGPUQueue();
  createdTextures: MockGPUTexture[] = [];
  createdBuffers: MockGPUBuffer[] = [];
  createdBindGroupLayouts: any[] = [];
  createdPipelineLayouts: any[] = [];
  createdRenderPipelines: any[] = [];
  createdSamplers: any[] = [];
  createdShaderModules: any[] = [];
  createdBindGroups: any[] = [];
  createdCommandEncoders: MockGPUCommandEncoder[] = [];

  createTexture(desc: any) {
    const tex = new MockGPUTexture(desc);
    this.createdTextures.push(tex);
    return tex as any;
  }

  createBuffer(desc: any) {
    const buf = new MockGPUBuffer(desc);
    this.createdBuffers.push(buf);
    return buf as any;
  }

  createSampler(desc: any) {
    this.createdSamplers.push(desc);
    return { label: desc.label } as any;
  }

  createShaderModule(desc: any) {
    this.createdShaderModules.push(desc);
    return { label: desc.label, code: desc.code } as any;
  }

  createBindGroupLayout(desc: any) {
    this.createdBindGroupLayouts.push(desc);
    return { label: desc.label, entries: desc.entries } as any;
  }

  createPipelineLayout(desc: any) {
    this.createdPipelineLayouts.push(desc);
    return { label: desc.label } as any;
  }

  createRenderPipeline(desc: any) {
    this.createdRenderPipelines.push(desc);
    return { label: desc.label } as any;
  }

  createBindGroup(desc: any) {
    this.createdBindGroups.push(desc);
    return { label: desc.label, entries: desc.entries } as any;
  }

  createCommandEncoder(desc: any) {
    const enc = new MockGPUCommandEncoder(desc);
    this.createdCommandEncoders.push(enc);
    return enc as any;
  }
}

describe('QuasarOS WebGPU WGSL Volume Raymarching Shaders', () => {
  it('should export valid WGSL source containing entrypoints, uniforms, and samplers', () => {
    assert.ok(VOLUME_RAYMARCH_WGSL);
    assert.ok(VOLUME_RAYMARCH_WGSL.includes('@vertex\nfn vs_main'));
    assert.ok(VOLUME_RAYMARCH_WGSL.includes('@fragment\nfn fs_main'));
    assert.ok(VOLUME_RAYMARCH_WGSL.includes('struct VolumeRaymarchUniforms'));
    assert.ok(VOLUME_RAYMARCH_WGSL.includes('fn intersectAABB'));
    assert.ok(VOLUME_RAYMARCH_WGSL.includes('fn sampleTransferFunction'));
    assert.ok(VOLUME_RAYMARCH_WGSL.includes('fn sampleValidityMask'));
  });

  it('should implement Smits-Kay AABB slab intersection correctly on CPU analytical model', () => {
    // CPU reference test matching intersectAABB in WGSL
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

    // Ray starting at (0.5, 0.5, -1.0) pointing along +Z into box [0, 1]^3
    const hitRes = intersectAABBCPU([0.5, 0.5, -1.0], [0, 0, 1], [0, 0, 0], [1, 1, 1]);
    assert.equal(hitRes.hit, true);
    assert.equal(hitRes.tNear, 1.0);
    assert.equal(hitRes.tFar, 2.0);

    // Ray missing the box
    const missRes = intersectAABBCPU([2.0, 2.0, -1.0], [0, 0, 1], [0, 0, 0], [1, 1, 1]);
    assert.equal(missRes.hit, false);
  });

  it('should compute step-size-corrected opacity correctly matching WGSL formulation', () => {
    // Formula: alpha_corr = 1.0 - (1.0 - alpha)^(dt / dt_ref)
    function correctOpacity(alphaSample: number, dt: number, dtRef: number): number {
      return 1.0 - Math.pow(Math.max(1.0 - alphaSample, 0.0), dt / dtRef);
    }

    // If dt == dtRef, alpha_corr == alphaSample
    assert.ok(Math.abs(correctOpacity(0.5, 0.01, 0.01) - 0.5) < 1e-6);

    // If dt is halved (finer steps), per-step alpha should be smaller
    const halfStep = correctOpacity(0.5, 0.005, 0.01);
    assert.ok(halfStep < 0.5);
    // Two half-steps composited: 1 - (1 - a1)*(1 - a2) == 1 - (1 - halfStep)^2 == 0.5
    const composited = 1.0 - Math.pow(1.0 - halfStep, 2);
    assert.ok(Math.abs(composited - 0.5) < 1e-6);
  });
});

describe('QuasarOS WebGPU Volume Raymarching Pipeline & Renderer', () => {
  it('should construct pipeline, bind group layout, samplers, and dummy resources', () => {
    const mockDevice = new MockGPUDevice();
    const adapter = new GPUResidencyAdapter(mockDevice as unknown as GPUDevice);
    const renderer = new VolumeRaymarchingRenderer(
      mockDevice as unknown as GPUDevice,
      adapter,
      { outputFormat: 'bgra8unorm' }
    );

    assert.equal(renderer.outputFormat, 'bgra8unorm');
    assert.ok(renderer.pipeline);
    assert.ok(renderer.bindGroupLayout);
    assert.equal(mockDevice.createdSamplers.length, 2); // linear + point
    assert.equal(mockDevice.createdBindGroupLayouts.length, 1);
    assert.equal(mockDevice.createdRenderPipelines.length, 1);
  });

  it('should pack uniforms matching 160-byte VolumeRaymarchUniforms layout', () => {
    const mockDevice = new MockGPUDevice();
    const adapter = new GPUResidencyAdapter(mockDevice as unknown as GPUDevice);
    const renderer = new VolumeRaymarchingRenderer(
      mockDevice as unknown as GPUDevice,
      adapter
    );

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

    const dummyBrick: RenderPacketBrick = {
      brickKey: 'brick_0_0_0',
      lodLevel: 0,
      timestepIndex: 0,
      brickIndices: [0, 0, 0],
      sampleShape: [66, 66, 32],
      interiorValidShape: [64, 64, 30],
      haloPadding: [1, 1, 1],
      sampleOrigin: [0, 0, 0],
      spatialBounds: { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1, minDepth: 0, maxDepth: 100 },
      normalizedBounds: { minU: 0, maxU: 1, minV: 0, maxV: 1, minW: 0, maxW: 1 },
      scalarMin: -2.0,
      scalarMax: 32.0,
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
      bricks: [dummyBrick],
      depthLutEntriesM: new Float32Array([0.494, 5.0, 10.0, 453.938]),
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
        maxDepthM: 100,
        verticalExaggeration: 1,
      },
      scalarMin: -2.0,
      scalarMax: 32.0,
      canonicalUnits: 'degree_Celsius',
    };

    const uniformBuf = renderer.packUniforms({ packet, camera, targetView: {} as any }, false);
    assert.equal(uniformBuf.byteLength, 160);

    const f32 = new Float32Array(uniformBuf);
    const u32 = new Uint32Array(uniformBuf);

    // Verify camera position
    assert.equal(f32[16], 0.5);
    assert.equal(f32[17], 0.5);
    assert.equal(f32[18], -2.0);

    // Verify clipping bounds
    assert.ok(Math.abs(f32[20] - 0.1) < 1e-6); // clipMin.x
    assert.ok(Math.abs(f32[21] - 0.2) < 1e-6); // clipMin.y
    assert.ok(Math.abs(f32[22] - 0.0) < 1e-6); // clipMin.z
    assert.ok(Math.abs(f32[24] - 0.9) < 1e-6); // clipMax.x
    assert.ok(Math.abs(f32[25] - 0.8) < 1e-6); // clipMax.y
    assert.ok(Math.abs(f32[26] - 1.0) < 1e-6); // clipMax.z

    // Verify scalar decoding parameters
    assert.equal(f32[28], -2.0); // scalarOffset
    assert.ok(Math.abs(f32[29] - 34.0 / 65535.0) < 1e-6); // scalarScale

    // Verify depth level count & flag
    assert.equal(u32[32], 4); // 4 depth levels
    assert.equal(u32[33], 0); // isFloat = 0 (uint quantized)
    assert.equal(u32[34], 1); // useValidityMask = 1

    // Verify viewport
    assert.equal(f32[36], 1920);
    assert.equal(f32[37], 1080);
  });

  it('should record renderFrame pass with draw call for active brick', () => {
    const mockDevice = new MockGPUDevice();
    const adapter = new GPUResidencyAdapter(mockDevice as unknown as GPUDevice);
    const renderer = new VolumeRaymarchingRenderer(
      mockDevice as unknown as GPUDevice,
      adapter
    );

    const camera: VolumeRaymarchingCameraState = {
      viewMatrix: new Float32Array(16),
      projectionMatrix: new Float32Array(16),
      inverseViewProjectionMatrix: new Float32Array(16),
      cameraPosition: [0, 0, -2],
      viewportWidth: 800,
      viewportHeight: 600,
    };

    const brick: RenderPacketBrick = {
      brickKey: 'brick_active',
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
      scalarMax: 20,
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
      scalarMax: 20,
      canonicalUnits: 'degree_Celsius',
      transferFunction: {
        colormap_name: 'viridis',
        canonical_variable: 'sea_water_potential_temperature',
        range_min: 0,
        range_max: 20,
        opacity_mapping: 'linear',
        control_points: [],
      },
    };

    const mockTargetView = { label: 'TargetView' } as GPUTextureView;

    const cmdBuffer = renderer.renderFrame({
      packet,
      camera,
      targetView: mockTargetView,
    });

    assert.ok(cmdBuffer);
    assert.equal(mockDevice.createdCommandEncoders.length, 1);
    const enc = mockDevice.createdCommandEncoders[0];
    assert.equal(enc.renderPasses.length, 1);

    const pass = enc.renderPasses[0];
    assert.equal(pass.isEnded, true);
    assert.equal(pass.drawCalls.length, 1);
    assert.deepEqual(pass.drawCalls[0], {
      vertexCount: 3,
      instanceCount: 1,
      firstVertex: 0,
      firstInstance: 0,
    });

    // Verify cleanup
    renderer.dispose();
    assert.equal(renderer.isDisposed, true);
  });
});
