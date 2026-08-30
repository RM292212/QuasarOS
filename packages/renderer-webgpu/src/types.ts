/**
 * @quasar/renderer-webgpu Core Type Definitions & Interfaces
 */

import type { RenderPacket, RenderPacketBrick } from '@quasar/runtime';
import type { TransferFunctionContract } from '@quasar/client';

export type TextureScalarFormat = 'r16float' | 'r16uint' | 'r8uint' | 'r32float' | 'rgba8unorm';

export const GPUTextureUsageFlags = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
} as const;

export const GPUBufferUsageFlags = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
} as const;

export const GPUMapModeFlags = {
  READ: 0x0001,
  WRITE: 0x0002,
} as const;

export const GPUShaderStageFlags = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
} as const;

export interface WebGPUDeviceContextConfig {
  powerPreference?: 'low-power' | 'high-performance';
  forceFallbackAdapter?: boolean;
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
  onDeviceLost?: (reason: string, message: string) => void;
  onUncapturedError?: (error: GPUError) => void;
}

export interface WebGPUDeviceContext {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly queue: GPUQueue;
  readonly isLost: boolean;
  dispose(): void;
}

export interface StagingRepackResult {
  readonly stagingBuffer: ArrayBuffer;
  readonly bytesPerRow: number;
  readonly rowsPerImage: number;
  readonly totalBytes: number;
  readonly copySize: [number, number, number]; // [width, height, depth]
}

export interface RepackerOptions {
  width: number;
  height: number;
  depth: number;
  bytesPerElement: number; // e.g. 2 for u16/f16, 1 for u8, 4 for f32
  alignmentRequirement?: number; // default 256 for WebGPU
}

export interface GPUAllocatedTexture {
  readonly id: string;
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  readonly format: GPUTextureFormat;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly sizeInBytes: number;
  destroy(): void;
}

export interface GPUAllocatedBuffer {
  readonly id: string;
  readonly buffer: GPUBuffer;
  readonly sizeInBytes: number;
  readonly usage: GPUBufferUsageFlags;
  destroy(): void;
}

export interface GPUBudgetTrackerOptions {
  maxTextureMemoryBytes?: number; // default 50 MiB
  maxBufferMemoryBytes?: number; // default 10 MiB
}

export interface GPUMemoryStats {
  textureMemoryBytes: number;
  bufferMemoryBytes: number;
  totalAllocatedBytes: number;
  maxTextureBudgetBytes: number;
  maxBufferBudgetBytes: number;
  allocatedTexturesCount: number;
  allocatedBuffersCount: number;
}

export interface ResidentGPUBrick {
  readonly brickKey: string;
  readonly lodLevel: number;
  readonly timestepIndex: number;
  readonly brickIndices: [number, number, number];
  readonly sampleShape: [number, number, number];
  readonly scalarTexture: GPUAllocatedTexture;
  readonly validityMaskTexture?: GPUAllocatedTexture;
  lastAccessTimestamp: number;
  isPinned: boolean;
  destroy(): void;
}

export interface ResidencyAdapterConfig {
  maxTextureBudgetBytes?: number; // default 50 * 1024 * 1024 (50 MiB)
  enableValidityMasks?: boolean;
}
