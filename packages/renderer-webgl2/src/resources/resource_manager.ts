/**
 * @quasar/renderer-webgl2 WebGL2ResourceManager
 * Manages allocation, uploads, unpack alignments, format mappings, and lifecycle of WebGL2 textures and buffers.
 */

import {
  WebGL2ResourceAllocationError,
  WebGL2ResourceDisposedError,
} from '../errors.ts';
import { WebGL2BudgetTracker } from './budget_tracker.ts';
import type {
  WebGL2AllocatedTexture,
  WebGL2AllocatedBuffer,
  WebGL2ScalarFormat,
  WebGL2TextureUpload3DOptions,
  WebGL2TextureUpload2DOptions,
  WebGL2BufferUploadOptions,
} from '../types.ts';
import type { TransferFunctionContract } from '@quasar/client';

export interface WebGL2FormatMapping {
  internalFormat: number;
  format: number;
  type: number;
  bytesPerElement: number;
}

export interface WebGL2SubTextureUpdate3DOptions {
  id: string;
  xOffset: number;
  yOffset: number;
  zOffset: number;
  width: number;
  height: number;
  depth: number;
  data: ArrayBufferView;
}

export class WebGL2ResourceManager {
  readonly gl: WebGL2RenderingContext;
  readonly budgetTracker: WebGL2BudgetTracker;
  private readonly _allocatedTextures: Map<string, WebGL2AllocatedTexture> = new Map();
  private readonly _allocatedBuffers: Map<string, WebGL2AllocatedBuffer> = new Map();
  private _isDisposed: boolean = false;

  constructor(gl: WebGL2RenderingContext, budgetTracker?: WebGL2BudgetTracker) {
    this.gl = gl;
    this.budgetTracker = budgetTracker ?? new WebGL2BudgetTracker();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  private checkDisposed(): void {
    if (this._isDisposed) {
      throw new WebGL2ResourceDisposedError('WebGL2ResourceManager');
    }
  }

  /**
   * Resolve WebGL2 internalFormat, format, type, and bytesPerElement for given WebGL2ScalarFormat.
   */
  static getFormatMapping(gl: WebGL2RenderingContext, format: WebGL2ScalarFormat): WebGL2FormatMapping {
    switch (format) {
      case 'r16f':
        return {
          internalFormat: gl.R16F,
          format: gl.RED,
          type: gl.HALF_FLOAT,
          bytesPerElement: 2,
        };
      case 'r16ui':
        return {
          internalFormat: gl.R16UI,
          format: gl.RED_INTEGER,
          type: gl.UNSIGNED_SHORT,
          bytesPerElement: 2,
        };
      case 'r8ui':
        return {
          internalFormat: gl.R8UI,
          format: gl.RED_INTEGER,
          type: gl.UNSIGNED_BYTE,
          bytesPerElement: 1,
        };
      case 'r32f':
        return {
          internalFormat: gl.R32F,
          format: gl.RED,
          type: gl.FLOAT,
          bytesPerElement: 4,
        };
      case 'rgba8':
        return {
          internalFormat: gl.RGBA8,
          format: gl.RGBA,
          type: gl.UNSIGNED_BYTE,
          bytesPerElement: 4,
        };
      default:
        throw new WebGL2ResourceAllocationError(`Unsupported scalar format: ${format}`);
    }
  }

  /**
   * Allocate and upload a 3D volume texture via gl.texImage3D.
   * Handles tightly packed textures with gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1).
   */
  uploadTexture3D(options: WebGL2TextureUpload3DOptions): WebGL2AllocatedTexture {
    this.checkDisposed();
    const { id, width, height, depth, format, data, filterMode = 'linear', wrapMode = 'clamp-to-edge' } = options;
    const gl = this.gl;

    if (this._allocatedTextures.has(id)) {
      this.destroyTexture(id);
    }

    const mapping = WebGL2ResourceManager.getFormatMapping(gl, format);
    const textureSizeInBytes = width * height * depth * mapping.bytesPerElement;

    // Check budget
    this.budgetTracker.recordTextureAllocated(textureSizeInBytes);

    const texture = gl.createTexture();
    if (!texture) {
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new WebGL2ResourceAllocationError(`Failed to create WebGL2 3D texture for '${id}'.`);
    }

    try {
      gl.bindTexture(gl.TEXTURE_3D, texture);

      // Set unpack alignment to 1 byte to allow non-multiple-of-4 dimensions (e.g. 66x66x32)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

      // Texture parameters
      const glWrap = wrapMode === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, glWrap);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, glWrap);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, glWrap);

      // For integer formats (r16ui, r8ui), filtering MUST be NEAREST
      const isIntegerFormat = format === 'r16ui' || format === 'r8ui';
      const glFilter = isIntegerFormat || filterMode === 'nearest' ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, glFilter);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, glFilter);

      // Upload data
      gl.texImage3D(
        gl.TEXTURE_3D,
        0, // level
        mapping.internalFormat,
        width,
        height,
        depth,
        0, // border
        mapping.format,
        mapping.type,
        data
      );

      gl.bindTexture(gl.TEXTURE_3D, null);
    } catch (err: unknown) {
      gl.deleteTexture(texture);
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new WebGL2ResourceAllocationError(
        `Failed to upload 3D texture '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const allocated: WebGL2AllocatedTexture = {
      id,
      texture,
      target: gl.TEXTURE_3D,
      internalFormat: mapping.internalFormat,
      format: mapping.format,
      type: mapping.type,
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
   * Update a sub-region of an existing 3D texture via gl.texSubImage3D.
   */
  updateSubTexture3D(options: WebGL2SubTextureUpdate3DOptions): void {
    this.checkDisposed();
    const { id, xOffset, yOffset, zOffset, width, height, depth, data } = options;
    const allocated = this._allocatedTextures.get(id);
    if (!allocated) {
      throw new WebGL2ResourceAllocationError(`Cannot update subtexture: 3D texture '${id}' not found.`);
    }

    const gl = this.gl;
    try {
      gl.bindTexture(gl.TEXTURE_3D, allocated.texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage3D(
        gl.TEXTURE_3D,
        0,
        xOffset,
        yOffset,
        zOffset,
        width,
        height,
        depth,
        allocated.format,
        allocated.type,
        data
      );
      gl.bindTexture(gl.TEXTURE_3D, null);
    } catch (err: unknown) {
      throw new WebGL2ResourceAllocationError(
        `Failed to update 3D subtexture '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Allocate and upload a 2D texture (e.g. Transfer function 256x1, colormap, etc.).
   */
  uploadTexture2D(options: WebGL2TextureUpload2DOptions): WebGL2AllocatedTexture {
    this.checkDisposed();
    const { id, width, height, format, data, filterMode = 'linear', wrapMode = 'clamp-to-edge' } = options;
    const gl = this.gl;

    if (this._allocatedTextures.has(id)) {
      this.destroyTexture(id);
    }

    const mapping = WebGL2ResourceManager.getFormatMapping(gl, format);
    const textureSizeInBytes = width * height * mapping.bytesPerElement;

    this.budgetTracker.recordTextureAllocated(textureSizeInBytes);

    const texture = gl.createTexture();
    if (!texture) {
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new WebGL2ResourceAllocationError(`Failed to create WebGL2 2D texture for '${id}'.`);
    }

    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

      const glWrap = wrapMode === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, glWrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, glWrap);

      const isIntegerFormat = format === 'r16ui' || format === 'r8ui';
      const glFilter = isIntegerFormat || filterMode === 'nearest' ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        mapping.internalFormat,
        width,
        height,
        0,
        mapping.format,
        mapping.type,
        data
      );

      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (err: unknown) {
      gl.deleteTexture(texture);
      this.budgetTracker.recordTextureDeallocated(textureSizeInBytes);
      throw new WebGL2ResourceAllocationError(
        `Failed to upload 2D texture '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const allocated: WebGL2AllocatedTexture = {
      id,
      texture,
      target: gl.TEXTURE_2D,
      internalFormat: mapping.internalFormat,
      format: mapping.format,
      type: mapping.type,
      width,
      height,
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
   * Upload 256x1 RGBA Colormap Transfer Function LUT texture.
   */
  uploadTransferFunctionLUT(
    id: string,
    transferFunction: TransferFunctionContract
  ): WebGL2AllocatedTexture {
    this.checkDisposed();
    const lutSize = 256;
    const rgbaData = new Uint8Array(lutSize * 4);

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

    return this.uploadTexture2D({
      id,
      width: lutSize,
      height: 1,
      format: 'rgba8',
      data: rgbaData,
      filterMode: 'linear',
      wrapMode: 'clamp-to-edge',
    });
  }

  /**
   * Upload 31-level Copernicus Depth LUT as a 2D 1D-like texture (depthCount x 1 R32F).
   */
  uploadDepthLUTTexture(id: string, depthEntriesM: Float32Array): WebGL2AllocatedTexture {
    return this.uploadTexture2D({
      id,
      width: depthEntriesM.length,
      height: 1,
      format: 'r32f',
      data: depthEntriesM,
      filterMode: 'nearest',
      wrapMode: 'clamp-to-edge',
    });
  }

  /**
   * Allocate and upload generic WebGLBuffer (Uniform buffer, Array buffer, etc.).
   */
  uploadBuffer(options: WebGL2BufferUploadOptions): WebGL2AllocatedBuffer {
    this.checkDisposed();
    const { id, target, data, usage } = options;
    const gl = this.gl;

    if (this._allocatedBuffers.has(id)) {
      this.destroyBuffer(id);
    }

    const sizeInBytes = data.byteLength;
    this.budgetTracker.recordBufferAllocated(sizeInBytes);

    const buffer = gl.createBuffer();
    if (!buffer) {
      this.budgetTracker.recordBufferDeallocated(sizeInBytes);
      throw new WebGL2ResourceAllocationError(`Failed to create WebGLBuffer for '${id}'.`);
    }

    const glUsage = usage ?? gl.DYNAMIC_DRAW;
    try {
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, data, glUsage);
      gl.bindBuffer(target, null);
    } catch (err: unknown) {
      gl.deleteBuffer(buffer);
      this.budgetTracker.recordBufferDeallocated(sizeInBytes);
      throw new WebGL2ResourceAllocationError(
        `Failed to write WebGLBuffer data for '${id}': ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const allocated: WebGL2AllocatedBuffer = {
      id,
      buffer,
      target,
      sizeInBytes,
      usage: glUsage,
      destroy: () => {
        this.destroyBuffer(id);
      },
    };

    this._allocatedBuffers.set(id, allocated);
    return allocated;
  }

  getTexture(id: string): WebGL2AllocatedTexture | undefined {
    return this._allocatedTextures.get(id);
  }

  getBuffer(id: string): WebGL2AllocatedBuffer | undefined {
    return this._allocatedBuffers.get(id);
  }

  destroyTexture(id: string): boolean {
    const allocated = this._allocatedTextures.get(id);
    if (!allocated) {
      return false;
    }
    try {
      this.gl.deleteTexture(allocated.texture);
    } catch {
      // Ignore if already deleted
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
      this.gl.deleteBuffer(allocated.buffer);
    } catch {
      // Ignore if already deleted
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
