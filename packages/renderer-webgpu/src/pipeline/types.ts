/**
 * @quasar/renderer-webgpu Raymarching Pipeline Types
 */

import type { RenderPacket } from '@quasar/runtime';

export interface VolumeRaymarchingCameraState {
  viewMatrix: Float32Array; // 16 elements column-major
  projectionMatrix: Float32Array; // 16 elements column-major
  inverseViewProjectionMatrix: Float32Array; // 16 elements column-major
  cameraPosition: [number, number, number];
  viewportWidth: number;
  viewportHeight: number;
}

export interface VolumeRaymarchingRenderOptions {
  packet: RenderPacket;
  camera: VolumeRaymarchingCameraState;
  targetView: GPUTextureView;
  depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
  stepSize?: number;
  referenceStepSize?: number;
  maxSteps?: number;
  earlyTerminationAlpha?: number;
  clearColor?: GPUColor;
}

export interface VolumeRaymarchingPipelineConfig {
  outputFormat?: GPUTextureFormat; // default 'bgra8unorm' or 'rgba8unorm'
  depthFormat?: GPUTextureFormat;
  enableSampleLinear?: boolean;
}
