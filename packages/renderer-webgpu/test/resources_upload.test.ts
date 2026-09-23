import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RowAlignmentRepacker,
  GPUBudgetTracker,
  GPUResourceManager,
  GPUResidencyAdapter,
  DeviceContext,
  QuasarWebGPUError,
  WebGPUInitializationError,
  GPUMemoryBudgetExceededError,
  GPUUploadLayoutError,
} from '../src/index.ts';
import type { RenderPacket, RenderPacketBrick } from '@quasar/runtime';

/**
 * Mock WebGPU Device & Queue implementation for headless Node.js unit testing.
 */
class MockGPUQueue {
  writeTextureCalls: Array<{
    destination: GPUImageCopyTexture;
    data: BufferSource;
    dataLayout: GPUImageDataLayout;
    size: GPUExtent3DStrict;
  }> = [];

  writeBufferCalls: Array<{
    buffer: GPUBuffer;
    bufferOffset: number;
    data: BufferSource;
    dataOffset?: number;
    size?: number;
  }> = [];

  writeTexture(
    destination: GPUImageCopyTexture,
    data: BufferSource,
    dataLayout: GPUImageDataLayout,
    size: GPUExtent3DStrict
  ): void {
    this.writeTextureCalls.push({ destination, data, dataLayout, size });
  }

  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number
  ): void {
    this.writeBufferCalls.push({ buffer, bufferOffset, data, dataOffset, size });
  }
}

class MockGPUTexture {
  readonly label: string;
  readonly size: [number, number, number];
  readonly dimension: string;
  readonly format: string;
  readonly usage: number;
  isDestroyed: boolean = false;

  constructor(descriptor: GPUTextureDescriptor) {
    this.label = descriptor.label || '';
    const s = descriptor.size as [number, number, number];
    this.size = Array.isArray(s) ? s : [Number(s), 1, 1];
    this.dimension = descriptor.dimension || '2d';
    this.format = descriptor.format;
    this.usage = descriptor.usage;
  }

  createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
    return {
      label: descriptor?.label,
    } as unknown as GPUTextureView;
  }

  destroy(): void {
    this.isDestroyed = true;
  }
}

class MockGPUBuffer {
  readonly label: string;
  readonly size: number;
  readonly usage: number;
  isDestroyed: boolean = false;

  constructor(descriptor: GPUBufferDescriptor) {
    this.label = descriptor.label || '';
    this.size = descriptor.size;
    this.usage = descriptor.usage;
  }

  destroy(): void {
    this.isDestroyed = true;
  }
}

class MockGPUDevice {
  readonly queue = new MockGPUQueue();
  readonly lost: Promise<GPUDeviceLostInfo> = new Promise(() => {});
  createdTextures: MockGPUTexture[] = [];
  createdBuffers: MockGPUBuffer[] = [];
  isDestroyed: boolean = false;

  createTexture(descriptor: GPUTextureDescriptor): GPUTexture {
    const tex = new MockGPUTexture(descriptor);
    this.createdTextures.push(tex);
    return tex as unknown as GPUTexture;
  }

  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer {
    const buf = new MockGPUBuffer(descriptor);
    this.createdBuffers.push(buf);
    return buf as unknown as GPUBuffer;
  }

  addEventListener(): void {}
  removeEventListener(): void {}

  destroy(): void {
    this.isDestroyed = true;
  }
}

describe('QuasarOS WebGPU Row Alignment Repacker (256-byte alignment)', () => {
  it('should compute exact bytesPerRow with 256-byte granularity', () => {
    // 66 samples * 2 bytes = 132 bytes -> aligned to 256
    assert.equal(RowAlignmentRepacker.computeBytesPerRow(132), 256);
    // 128 samples * 2 bytes = 256 bytes -> aligned to 256
    assert.equal(RowAlignmentRepacker.computeBytesPerRow(256), 256);
    // 129 samples * 2 bytes = 258 bytes -> aligned to 512
    assert.equal(RowAlignmentRepacker.computeBytesPerRow(258), 512);
    // 66 samples * 1 byte = 66 bytes -> aligned to 256
    assert.equal(RowAlignmentRepacker.computeBytesPerRow(66), 256);
  });

  it('should repack 66x66x32 Uint16 volume into 256-byte aligned staging layout', () => {
    const width = 66;
    const height = 66;
    const depth = 32;
    const totalElements = width * height * depth;
    const sourceData = new Uint16Array(totalElements);

    // Populate with recognizable sequential test patterns
    for (let i = 0; i < totalElements; i++) {
      sourceData[i] = (i % 65530) + 1;
    }

    const repacked = RowAlignmentRepacker.repack3DVolume(sourceData, {
      width,
      height,
      depth,
      bytesPerElement: 2,
    });

    assert.equal(repacked.bytesPerRow, 256);
    assert.equal(repacked.rowsPerImage, 66);
    // bytesPerImage = 256 * 66 = 16896 bytes
    // totalBytes = 16896 * 32 = 540672 bytes
    assert.equal(repacked.totalBytes, 256 * 66 * 32);
    assert.deepEqual(repacked.copySize, [66, 66, 32]);

    // Verify row byte accuracy & zero-padding
    const dstU8 = new Uint8Array(repacked.stagingBuffer);
    const unpaddedRowBytes = 66 * 2; // 132 bytes
    const paddingBytesPerRow = 256 - 132; // 124 bytes

    for (let z = 0; z < depth; z++) {
      const sliceOffset = z * (256 * 66);
      for (let y = 0; y < height; y++) {
        const rowOffset = sliceOffset + y * 256;
        const rowPayload = dstU8.subarray(rowOffset, rowOffset + unpaddedRowBytes);
        const rowPadding = dstU8.subarray(
          rowOffset + unpaddedRowBytes,
          rowOffset + 256
        );

        // Verify payload matches source
        const srcRowOffset = (z * (66 * 66) + y * 66) * 2;
        const srcRowU8 = new Uint8Array(sourceData.buffer, srcRowOffset, unpaddedRowBytes);
        assert.deepEqual(rowPayload, srcRowU8);

        // Verify padding is strictly zeroed
        for (let p = 0; p < paddingBytesPerRow; p++) {
          assert.equal(rowPadding[p], 0, `Padding at index ${p} must be zero`);
        }
      }
    }
  });

  it('should repack 66x66x32 Uint8 validity mask into 256-byte aligned staging layout', () => {
    const width = 66;
    const height = 66;
    const depth = 32;
    const maskData = new Uint8Array(width * height * depth);
    maskData.fill(1); // 1 = valid ocean

    const repacked = RowAlignmentRepacker.repack3DVolume(maskData, {
      width,
      height,
      depth,
      bytesPerElement: 1,
    });

    assert.equal(repacked.bytesPerRow, 256);
    assert.equal(repacked.rowsPerImage, 66);
    assert.equal(repacked.totalBytes, 256 * 66 * 32);

    const dstU8 = new Uint8Array(repacked.stagingBuffer);
    // 66 bytes of 1, followed by 190 bytes of 0
    assert.equal(dstU8[0], 1);
    assert.equal(dstU8[65], 1);
    assert.equal(dstU8[66], 0);
    assert.equal(dstU8[255], 0);
  });

  it('should throw GPUUploadLayoutError on invalid dimensions or undersized buffers', () => {
    assert.throws(
      () =>
        RowAlignmentRepacker.repack3DVolume(new Uint16Array(10), {
          width: 66,
          height: 66,
          depth: 32,
          bytesPerElement: 2,
        }),
      (err) => err instanceof GPUUploadLayoutError
    );
  });
});

describe('QuasarOS WebGPU Memory Budget Tracker', () => {
  it('should enforce 50 MiB texture budget ceiling', () => {
    const budget = new GPUBudgetTracker({
      maxTextureMemoryBytes: 50 * 1024 * 1024,
      maxBufferMemoryBytes: 10 * 1024 * 1024,
    });

    const brickBytes = 66 * 66 * 32 * 2; // ~278.784 KiB
    budget.recordTextureAllocated(brickBytes);
    assert.equal(budget.stats.textureMemoryBytes, brickBytes);
    assert.equal(budget.stats.allocatedTexturesCount, 1);

    budget.recordTextureDeallocated(brickBytes);
    assert.equal(budget.stats.textureMemoryBytes, 0);
    assert.equal(budget.stats.allocatedTexturesCount, 0);

    // Attempting to exceed budget throws GPUMemoryBudgetExceededError
    assert.throws(
      () => budget.recordTextureAllocated(60 * 1024 * 1024),
      (err) => err instanceof GPUMemoryBudgetExceededError
    );
  });
});

describe('QuasarOS WebGPU Resource Manager & Uploads', () => {
  it('should allocate 3D texture and write repacked data via queue.writeTexture', () => {
    const mockDevice = new MockGPUDevice();
    const manager = new GPUResourceManager(mockDevice as unknown as GPUDevice);

    const width = 66;
    const height = 66;
    const depth = 32;
    const sourceData = new Uint16Array(width * height * depth);
    sourceData[0] = 19022; // ~0.0°C physical temperature code

    const allocated = manager.uploadTexture3D({
      id: 'brick_0_0_0',
      width,
      height,
      depth,
      format: 'r16uint',
      data: sourceData,
    });

    assert.equal(allocated.id, 'brick_0_0_0');
    assert.equal(allocated.width, 66);
    assert.equal(allocated.height, 66);
    assert.equal(allocated.depth, 32);
    assert.equal(allocated.format, 'r16uint');
    assert.equal(allocated.sizeInBytes, 66 * 66 * 32 * 2);

    assert.equal(mockDevice.createdTextures.length, 1);
    assert.equal(mockDevice.queue.writeTextureCalls.length, 1);

    const call = mockDevice.queue.writeTextureCalls[0];
    assert.equal(call.dataLayout.bytesPerRow, 256);
    assert.equal(call.dataLayout.rowsPerImage, 66);
    assert.deepEqual(call.size, { width: 66, height: 66, depthOrArrayLayers: 32 });

    // Destroy texture
    manager.destroyTexture('brick_0_0_0');
    assert.equal(manager.getTexture('brick_0_0_0'), undefined);
    assert.equal(manager.budgetTracker.stats.textureMemoryBytes, 0);
  });

  it('should upload 256x1 RGBA Colormap Transfer Function LUT texture', () => {
    const mockDevice = new MockGPUDevice();
    const manager = new GPUResourceManager(mockDevice as unknown as GPUDevice);

    const tfTexture = manager.uploadTransferFunctionLUT('tf_cividis', {
      colormap_name: 'cividis',
      canonical_variable: 'sea_water_potential_temperature',
      range_min: -2.0,
      range_max: 32.0,
      opacity_mapping: 'linear',
      control_points: [
        { normalized_scalar: 0.0, color: [0.0, 0.1, 0.3], opacity: 0.0 },
        { normalized_scalar: 1.0, color: [0.9, 0.9, 0.2], opacity: 0.8 },
      ],
    });

    assert.equal(tfTexture.id, 'tf_cividis');
    assert.equal(tfTexture.width, 256);
    assert.equal(tfTexture.height, 1);
    assert.equal(tfTexture.format, 'rgba8unorm');
    assert.equal(tfTexture.sizeInBytes, 256 * 4); // 1024 bytes (multiple of 256)
    assert.equal(mockDevice.createdTextures[0].dimension, '2d');

    assert.equal(mockDevice.queue.writeTextureCalls.length, 1);
    const call = mockDevice.queue.writeTextureCalls[0];
    assert.equal(call.dataLayout.bytesPerRow, 1024);
  });

  it('should upload 31-level Depth LUT buffer to GPU', () => {
    const mockDevice = new MockGPUDevice();
    const manager = new GPUResourceManager(mockDevice as unknown as GPUDevice);

    const depthEntries = new Float32Array([
      0.0, 5.0, 10.0, 20.0, 30.0, 50.0, 75.0, 100.0, 150.0, 200.0, 300.0, 500.0,
      1000.0, 1500.0, 2000.0, 3000.0, 4000.0, 5000.0,
    ]);

    const buf = manager.uploadDepthLUTBuffer('depth_lut_copernicus', depthEntries);

    assert.equal(buf.id, 'depth_lut_copernicus');
    assert.equal(buf.sizeInBytes, Math.ceil((depthEntries.length * 4) / 16) * 16);
    assert.equal(mockDevice.createdBuffers.length, 1);
    assert.equal(mockDevice.queue.writeBufferCalls.length, 1);
  });
});

describe('QuasarOS WebGPU Residency Adapter & RenderPacket Synchronization', () => {
  it('should synchronize RenderPacket resident bricks and manage LRU eviction', () => {
    const mockDevice = new MockGPUDevice();
    const adapter = new GPUResidencyAdapter(mockDevice as unknown as GPUDevice, {
      maxTextureBudgetBytes: 1 * 1024 * 1024, // 1 MiB budget for testing LRU
      enableValidityMasks: true,
    });

    const createDummyBrick = (id: string, bx: number): RenderPacketBrick => ({
      brickKey: `brick_${id}`,
      lodLevel: 0,
      timestepIndex: 0,
      brickIndices: [bx, 0, 0],
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
    });

    const b0 = createDummyBrick('0', 0);
    const b1 = createDummyBrick('1', 1);

    const packet1: RenderPacket = {
      packetId: 'packet_1',
      frameTimestampMs: 1000,
      datasetId: 'dataset_1',
      snapshotId: 'snap_1',
      visualizationProductId: 'vis_1',
      productVersion: 'v1',
      manifestSha256: 'a'.repeat(64),
      timestepIndex: 0,
      timestepUtc: '2026-08-24T00:00:00Z',
      targetLodLevel: 0,
      isDegraded: false,
      totalBricksInVolume: 10,
      activeBricksCount: 2,
      bricks: [b0, b1],
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
      scalarMin: -2.0,
      scalarMax: 32.0,
      canonicalUnits: 'degree_Celsius',
      transferFunction: {
        colormap_name: 'viridis',
        canonical_variable: 'sea_water_potential_temperature',
        range_min: -2,
        range_max: 32,
        opacity_mapping: 'linear',
        control_points: [],
      },
    };

    adapter.synchronizePacket(packet1);

    assert.equal(adapter.residentBricksCount, 2);
    assert.equal(adapter.hasBrick('brick_0'), true);
    assert.equal(adapter.hasBrick('brick_1'), true);
    assert.notEqual(adapter.depthLutBuffer, null);
    assert.notEqual(adapter.transferFunctionTexture, null);

    // Frame 2: b0 leaves view, b2 enters. Total 1 MiB budget accommodates 2 bricks.
    const b2 = createDummyBrick('2', 2);
    const packet2: RenderPacket = {
      ...packet1,
      packetId: 'packet_2',
      bricks: [b1, b2],
    };

    adapter.synchronizePacket(packet2);
    // b0 is unpinned, b1 and b2 are pinned
    assert.equal(adapter.residentBricksCount, 2); // b0 was evicted because 3 bricks exceed 1 MiB
    assert.equal(adapter.hasBrick('brick_0'), false);
    assert.equal(adapter.hasBrick('brick_1'), true);
    assert.equal(adapter.hasBrick('brick_2'), true);

    // Clear and dispose
    adapter.dispose();
    assert.equal(adapter.residentBricksCount, 0);
    assert.equal(adapter.resourceManager.isDisposed, true);
  });
});
