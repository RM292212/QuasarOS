/**
 * @quasar/renderer-webgpu GPU Budget Tracker
 * Tracks active texture and uniform/storage buffer memory allocations against strict memory budgets (default 50 MiB).
 */

import { GPUMemoryBudgetExceededError } from '../errors.ts';
import type { GPUBudgetTrackerOptions, GPUMemoryStats } from '../types.ts';

export class GPUBudgetTracker {
  readonly maxTextureBudgetBytes: number;
  readonly maxBufferBudgetBytes: number;

  private _textureMemoryBytes: number = 0;
  private _bufferMemoryBytes: number = 0;
  private _allocatedTexturesCount: number = 0;
  private _allocatedBuffersCount: number = 0;

  constructor(options: GPUBudgetTrackerOptions = {}) {
    this.maxTextureBudgetBytes = options.maxTextureMemoryBytes ?? 50 * 1024 * 1024; // 50 MiB
    this.maxBufferBudgetBytes = options.maxBufferMemoryBytes ?? 10 * 1024 * 1024; // 10 MiB
  }

  get stats(): GPUMemoryStats {
    return {
      textureMemoryBytes: this._textureMemoryBytes,
      bufferMemoryBytes: this._bufferMemoryBytes,
      totalAllocatedBytes: this._textureMemoryBytes + this._bufferMemoryBytes,
      maxTextureBudgetBytes: this.maxTextureBudgetBytes,
      maxBufferBudgetBytes: this.maxBufferBudgetBytes,
      allocatedTexturesCount: this._allocatedTexturesCount,
      allocatedBuffersCount: this._allocatedBuffersCount,
    };
  }

  canAllocateTexture(sizeInBytes: number): boolean {
    return this._textureMemoryBytes + sizeInBytes <= this.maxTextureBudgetBytes;
  }

  canAllocateBuffer(sizeInBytes: number): boolean {
    return this._bufferMemoryBytes + sizeInBytes <= this.maxBufferBudgetBytes;
  }

  recordTextureAllocated(sizeInBytes: number): void {
    if (this._textureMemoryBytes + sizeInBytes > this.maxTextureBudgetBytes) {
      throw new GPUMemoryBudgetExceededError(
        this._textureMemoryBytes + sizeInBytes,
        this.maxTextureBudgetBytes,
        { requestedBytes: sizeInBytes, currentTextureBytes: this._textureMemoryBytes }
      );
    }
    this._textureMemoryBytes += sizeInBytes;
    this._allocatedTexturesCount += 1;
  }

  recordTextureDeallocated(sizeInBytes: number): void {
    this._textureMemoryBytes = Math.max(0, this._textureMemoryBytes - sizeInBytes);
    this._allocatedTexturesCount = Math.max(0, this._allocatedTexturesCount - 1);
  }

  recordBufferAllocated(sizeInBytes: number): void {
    if (this._bufferMemoryBytes + sizeInBytes > this.maxBufferBudgetBytes) {
      throw new GPUMemoryBudgetExceededError(
        this._bufferMemoryBytes + sizeInBytes,
        this.maxBufferBudgetBytes,
        { requestedBytes: sizeInBytes, currentBufferBytes: this._bufferMemoryBytes }
      );
    }
    this._bufferMemoryBytes += sizeInBytes;
    this._allocatedBuffersCount += 1;
  }

  recordBufferDeallocated(sizeInBytes: number): void {
    this._bufferMemoryBytes = Math.max(0, this._bufferMemoryBytes - sizeInBytes);
    this._allocatedBuffersCount = Math.max(0, this._allocatedBuffersCount - 1);
  }

  reset(): void {
    this._textureMemoryBytes = 0;
    this._bufferMemoryBytes = 0;
    this._allocatedTexturesCount = 0;
    this._allocatedBuffersCount = 0;
  }
}
