/**
 * @quasar/renderer-webgl2 Core Type Definitions & Interfaces
 */

import type { RenderPacket, RenderPacketBrick } from '@quasar/runtime';
import type { TransferFunctionContract } from '@quasar/client';

export type WebGL2ScalarFormat = 'r16f' | 'r16ui' | 'r8ui' | 'r32f' | 'rgba8';

export interface WebGL2ContextConfig {
  alpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
  antialias?: boolean;
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: 'default' | 'low-power' | 'high-performance';
  failIfMajorPerformanceCaveat?: boolean;
  onContextLost?: (event: Event) => void;
  onContextRestored?: (event: Event) => void;
}

export interface WebGL2ExtensionRegistry {
  colorBufferFloat: any | null;
  colorBufferHalfFloat: any | null;
  textureFloatLinear: any | null;
  textureHalfFloatLinear: any | null;
  parallelShaderCompile: any | null;
}

export interface WebGL2Capabilities {
  maxTextureSize: number;
  max3DTextureSize: number;
  maxArrayTextureLayers: number;
  maxTextureImageUnits: number;
  maxUniformBufferBindings: number;
  maxUniformBlockSize: number;
  uniformBufferOffsetAlignment: number;
  supportsColorBufferFloat: boolean;
  supportsColorBufferHalfFloat: boolean;
  supportsFloatLinear: boolean;
  supportsHalfFloatLinear: boolean;
}

export interface WebGL2BudgetTrackerOptions {
  maxTextureMemoryBytes?: number;
  maxBufferMemoryBytes?: number;
}

export interface WebGL2TextureUpload3DOptions {
  id: string;
  width: number;
  height: number;
  depth: number;
  format: WebGL2ScalarFormat;
  data: ArrayBufferView;
  filterMode?: 'linear' | 'nearest';
  wrapMode?: 'clamp-to-edge' | 'repeat';
}

export interface WebGL2TextureUpload2DOptions {
  id: string;
  width: number;
  height: number;
  format: WebGL2ScalarFormat;
  data: ArrayBufferView;
  filterMode?: 'linear' | 'nearest';
  wrapMode?: 'clamp-to-edge' | 'repeat';
}

export interface WebGL2BufferUploadOptions {
  id: string;
  target: number;
  data: ArrayBufferView;
  usage?: number;
}

export interface WebGL2AllocatedTexture {
  readonly id: string;
  readonly texture: WebGLTexture;
  readonly target: number; // gl.TEXTURE_3D, gl.TEXTURE_2D
  readonly internalFormat: number;
  readonly format: number;
  readonly type: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly sizeInBytes: number;
  destroy(): void;
}

export interface WebGL2AllocatedBuffer {
  readonly id: string;
  readonly buffer: WebGLBuffer;
  readonly target: number;
  readonly sizeInBytes: number;
  readonly usage: number;
  destroy(): void;
}

export interface WebGL2MemoryStats {
  textureMemoryBytes: number;
  bufferMemoryBytes: number;
  totalAllocatedBytes: number;
  maxTextureBudgetBytes: number;
  maxBufferBudgetBytes: number;
  allocatedTexturesCount: number;
  allocatedBuffersCount: number;
}

export interface ResidentWebGL2Brick {
  readonly brickKey: string;
  readonly lodLevel: number;
  readonly timestepIndex: number;
  readonly brickIndices: [number, number, number];
  readonly sampleShape: [number, number, number];
  readonly scalarTexture: WebGL2AllocatedTexture;
  readonly validityMaskTexture?: WebGL2AllocatedTexture;
  lastAccessTimestamp: number;
  isPinned: boolean;
  destroy(): void;
}

export interface VolumeRaymarchingCameraState {
  viewMatrix: Float32Array; // 16 elements column-major
  projectionMatrix: Float32Array; // 16 elements column-major
  inverseViewProjectionMatrix: Float32Array; // 16 elements column-major
  cameraPosition: [number, number, number];
  viewportWidth: number;
  viewportHeight: number;
}

export interface WebGL2VolumeRaymarchingRenderOptions {
  packet: RenderPacket;
  camera: VolumeRaymarchingCameraState;
  targetFramebuffer?: WebGLFramebuffer | null; // null for default canvas framebuffer
  stepSize?: number;
  referenceStepSize?: number;
  maxSteps?: number;
  earlyTerminationAlpha?: number;
  clearColor?: [number, number, number, number];
}

export interface WebGL2VolumeRaymarchingPipelineConfig {
  enableSampleLinear?: boolean;
  maxDepthLevels?: number;
}
