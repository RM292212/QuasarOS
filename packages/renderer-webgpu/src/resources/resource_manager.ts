/**
 * @quasar/renderer-webgpu GPU Texture & Buffer Resource Manager
 * Manages allocation, staging repacks, writeTexture/writeBuffer uploads, and disposal of GPU resources.
 */

import { GPUResourceAllocationError, GPUResourceDisposedError } from '../errors.ts';
import { RowAlignmentRepacker } from './repacker.ts';
import { GPUBudgetTracker } from './budget_tracker.ts';
import {
  type GPUAllocatedTexture,
  type GPUAllocatedBuffer,
  type TextureScalarFormat,
  GPUTextureUsageFlags,
  GPUBufferUsageFlags,
} from '../types.ts';
import type { TransferFunctionContract } from '@quasar/client';

export interface TextureUpload3DOptions {
  id: string;
  width: number;
  height: number;
  depth: number;
  format: TextureScalarFormat;
  data: ArrayBufferView;
  usage?: GPUTextureUsageFlags;
}

export interface BufferUploadOptions {
  id: string;
  data: ArrayBufferView;
  usage: GPUBufferUsageFlags;
}

export class GPUResourceManager {
  readonly device: GPUDevice;
  readonly budgetTracker: GPUBudgetTracker;
  private readonly _allocatedTextures: Map<string, GPUAllocatedTexture> = new Map();
  private readonly _allocatedBuffers: Map<string, GPUAllocatedBuffer> = new Map();
  private _isDisposed: boolean = false;

  constructor(device: GPUDevice, budgetTracker?: GPUBudgetTracker) {
    this.device = device;
    this.budgetTracker = budgetTracker ?? new GPUBudgetTracker();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new GPUResourceDisposedError('GPUResourceManager');
    }
  }

  /**
   * Determine bytes per element for a supported texture format.
   */
  static getBytesPerElement(format: TextureScalarFormat): number {
    switch (format) {
      case 'r8uint':
        return 1;
      case 'r16float':
      case 'r16uint':
        return 2;
      case 'r32float':
      case 'rgba8unorm':
        return 4;
      default:
        throw new GPUResourceAllocationError(`Unsupported texture format: ${format}`);
    }
  }

  /**
   * Allocate and upload a 3D volume texture with 256-byte row alignment.
   */
  uploadTexture3D(options: TextureUpload3DOptions): GPUAllocatedTexture {
    this.checkDisposed();
    const { id, width, height, depth, format, data, usage } = options;

    if (this._allocatedTextures.has(id)) {
      this.destroyTexture(id);
    }

    const bpe = GPUResourceManager.getBytesPerElement(format);
    const textureSizeInBytes = width * height * depth * bpe;

    // Check budget
    this.budgetTracker.recordTextureAllocated(textureSizeInBytes);

    let texture: GPUTexture;
    try {
      texture = this.device.createTexture({
        label: id,
        size: [width, height, depth],
        dimension: '3d',
        format: format as GPUTextureFormat,
        usage:
          usage ??
          (GPUTextureUsageFlags.TEXTURE_BINDING |
            GPUTextureUsageFlags.COPY_DST |
            GPUTextureUsageFlags.COPY_SRC),
      });
    } catch (err: unknown) {
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new GPUResourceAllocationError(
        `Failed to create GPUTexture3D '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Repack data with 256-byte alignment
    const repacked = RowAlignmentRepacker.repack3DVolume(data, {
      width,
      height,
      depth,
      bytesPerElement: bpe,
    });

    // Write texture to GPU
    try {
      this.device.queue.writeTexture(
        { texture },
        repacked.stagingBuffer,
        {
          bytesPerRow: repacked.bytesPerRow,
          rowsPerImage: repacked.rowsPerImage,
        },
        {
          width,
          height,
          depthOrArrayLayers: depth,
        }
      );
    } catch (err: unknown) {
      texture.destroy();
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new GPUResourceAllocationError(
        `Failed to write texture data for '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const view = texture.createView({
      label: `${id}_view`,
      dimension: '3d',
    });

    const allocated: GPUAllocatedTexture = {
      id,
      texture,
      view,
      format: format as GPUTextureFormat,
      width,
      height,
      depth,
      sizeInBytes: textureSizeInBytes,
      destroy: () => {
        this.destroyTexture(id);
      },
    };

    this._allocatedTextures.set(id, allocated);
    return allocated;
  }

  /**
   * Upload a 256x1 RGBA colormap transfer function texture.
   */
  uploadTransferFunctionLUT(
    id: string,
    transferFunction: TransferFunctionContract
  ): GPUAllocatedTexture {
    this.checkDisposed();
    const lutSize = 256;
    const rgbaData = new Uint8Array(lutSize * 4);

    // Populate LUT from control points
    const controlPoints = transferFunction.control_points;
    if (!controlPoints || controlPoints.length === 0) {
      // Fallback grayscale ramp
      for (let i = 0; i < lutSize; i++) {
        const val = i;
        rgbaData[i * 4 + 0] = val;
        rgbaData[i * 4 + 1] = val;
        rgbaData[i * 4 + 2] = val;
        rgbaData[i * 4 + 3] = val;
      }
    } else {
      // Linear piecewise interpolation of color and opacity
      const sorted = [...controlPoints].sort((a, b) => a.normalized_scalar - b.normalized_scalar);

      for (let i = 0; i < lutSize; i++) {
        const norm = i / (lutSize - 1);
        let lower = sorted[0];
        let upper = sorted[sorted.length - 1];

        for (let cpIdx = 0; cpIdx < sorted.length - 1; cpIdx++) {
          if (
            norm >= sorted[cpIdx].normalized_scalar &&
            norm <= sorted[cpIdx + 1].normalized_scalar
          ) {
            lower = sorted[cpIdx];
            upper = sorted[cpIdx + 1];
            break;
          }
        }

        const span = upper.normalized_scalar - lower.normalized_scalar;
        const factor = span > 1e-6 ? (norm - lower.normalized_scalar) / span : 0;

        // RGBA interpolation
        const r = lower.color[0] + factor * (upper.color[0] - lower.color[0]);
        const g = lower.color[1] + factor * (upper.color[1] - lower.color[1]);
        const b = lower.color[2] + factor * (upper.color[2] - lower.color[2]);
        const a = lower.opacity + factor * (upper.opacity - lower.opacity);

        rgbaData[i * 4 + 0] = Math.max(0, Math.min(255, Math.round(r * 255)));
        rgbaData[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
        rgbaData[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
        rgbaData[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
      }
    }

    if (this._allocatedTextures.has(id)) {
      this.destroyTexture(id);
    }

    const bpe = 4; // RGBA8
    const textureSizeInBytes = lutSize * 1 * bpe; // 1024 bytes (multiple of 256)
    this.budgetTracker.recordTextureAllocated(textureSizeInBytes);

    let texture: GPUTexture;
    try {
      texture = this.device.createTexture({
        label: id,
        size: [lutSize, 1, 1],
        dimension: '1d',
        format: 'rgba8unorm',
        usage:
          GPUTextureUsageFlags.TEXTURE_BINDING |
          GPUTextureUsageFlags.COPY_DST,
      });
    } catch (err: unknown) {
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new GPUResourceAllocationError(
        `Failed to create 1D TF LUT GPUTexture '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    try {
      this.device.queue.writeTexture(
        { texture },
        rgbaData.buffer,
        {
          bytesPerRow: lutSize * bpe, // 1024 (256-byte aligned)
          rowsPerImage: 1,
        },
        {
          width: lutSize,
          height: 1,
          depthOrArrayLayers: 1,
        }
      );
    } catch (err: unknown) {
      texture.destroy();
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new GPUResourceAllocationError(
        `Failed to write TF LUT texture data for '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const view = texture.createView({
      label: `${id}_view`,
      dimension: '1d',
    });

    const allocated: GPUAllocatedTexture = {
      id,
      texture,
      view,
      format: 'rgba8unorm',
      width: lutSize,
      height: 1,
      depth: 1,
      sizeInBytes: textureSizeInBytes,
      destroy: () => {
        this.destroyTexture(id);
      },
    };

    this._allocatedTextures.set(id, allocated);
    return allocated;
  }

  /**
   * Upload Depth LUT to GPU (Uniform or Storage Buffer & 1D Texture).
   */
  uploadDepthLUTBuffer(id: string, depthEntriesM: Float32Array): GPUAllocatedBuffer {
    this.checkDisposed();

    if (this._allocatedBuffers.has(id)) {
      this.destroyBuffer(id);
    }

    // Align buffer byte length to 16 bytes for WebGPU uniform/storage alignment
    const rawByteLength = depthEntriesM.byteLength;
    const alignedByteLength = Math.max(16, Math.ceil(rawByteLength / 16) * 16);

    this.budgetTracker.recordBufferAllocated(alignedByteLength);

    let buffer: GPUBuffer;
    try {
      buffer = this.device.createBuffer({
        label: id,
        size: alignedByteLength,
        usage:
          GPUBufferUsageFlags.UNIFORM |
          GPUBufferUsageFlags.STORAGE |
          GPUBufferUsageFlags.COPY_DST,
      });
    } catch (err: unknown) {
      this.budgetTracker.recordBufferDeallocated(alignedByteLength);
      throw new GPUResourceAllocationError(
        `Failed to create Depth LUT GPUBuffer '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    try {
      this.device.queue.writeBuffer(
        buffer,
        0,
        depthEntriesM.buffer,
        depthEntriesM.byteOffset,
        depthEntriesM.byteLength
      );
    } catch (err: unknown) {
      buffer.destroy();
      this.budgetTracker.recordBufferDeallocated(alignedByteLength);
      throw new GPUResourceAllocationError(
        `Failed to write Depth LUT data for '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const allocated: GPUAllocatedBuffer = {
      id,
      buffer,
      sizeInBytes: alignedByteLength,
      usage: buffer.usage,
      destroy: () => {
        this.destroyBuffer(id);
      },
    };

    this._allocatedBuffers.set(id, allocated);
    return allocated;
  }

  /**
   * Allocate and upload generic GPUBuffer.
   */
  uploadBuffer(options: {
    id: string;
    sizeInBytes: number;
    usage: GPUBufferUsageFlags | number;
    data?: BufferSource;
  }): GPUAllocatedBuffer {
    this.checkDisposed();
    const { id, sizeInBytes, usage, data } = options;

    if (this._allocatedBuffers.has(id)) {
      this.destroyBuffer(id);
    }

    const alignedByteLength = Math.max(16, Math.ceil(sizeInBytes / 16) * 16);
    this.budgetTracker.recordBufferAllocated(alignedByteLength);

    let buffer: GPUBuffer;
    try {
      buffer = this.device.createBuffer({
        label: id,
        size: alignedByteLength,
        usage: usage as number,
      });
    } catch (err: unknown) {
      this.budgetTracker.recordBufferDeallocated(alignedByteLength);
      throw new GPUResourceAllocationError(
        `Failed to create GPUBuffer '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (data) {
      try {
        this.device.queue.writeBuffer(buffer, 0, data);
      } catch (err: unknown) {
        buffer.destroy();
        this.budgetTracker.recordBufferDeallocated(alignedByteLength);
        throw new GPUResourceAllocationError(
          `Failed to write GPUBuffer data for '${id}': ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const allocated: GPUAllocatedBuffer = {
      id,
      buffer,
      sizeInBytes: alignedByteLength,
      usage: buffer.usage as unknown as GPUBufferUsageFlags,
      destroy: () => {
        this.destroyBuffer(id);
      },
    };

    this._allocatedBuffers.set(id, allocated);
    return allocated;
  }

  getTexture(id: string): GPUAllocatedTexture | undefined {
    return this._allocatedTextures.get(id);
  }

  getBuffer(id: string): GPUAllocatedBuffer | undefined {
    return this._allocatedBuffers.get(id);
  }

  destroyTexture(id: string): boolean {
    const allocated = this._allocatedTextures.get(id);
    if (!allocated) {
      return false;
    }
    try {
      allocated.texture.destroy();
    } catch {
      // Ignore if already destroyed
    }
    this.budgetTracker.recordTextureDeallocated(allocated.sizeInBytes);
    this._allocatedTextures.delete(id);
    return true;
  }

  destroyBuffer(id: string): boolean {
    const allocated = this._allocatedBuffers.get(id);
    if (!allocated) {
      return false;
    }
    try {
      allocated.buffer.destroy();
    } catch {
      // Ignore if already destroyed
    }
    this.budgetTracker.recordBufferDeallocated(allocated.sizeInBytes);
    this._allocatedBuffers.delete(id);
    return true;
  }

  destroyAll(): void {
    for (const id of Array.from(this._allocatedTextures.keys())) {
      this.destroyTexture(id);
    }
    for (const id of Array.from(this._allocatedBuffers.keys())) {
      this.destroyBuffer(id);
    }
    this.budgetTracker.reset();
  }

  dispose(): void {
    if (!this._isDisposed) {
      this.destroyAll();
      this._isDisposed = true;
    }
  }
}
