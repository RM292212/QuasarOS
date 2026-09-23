/**
 * @quasar/renderer-webgpu Volume Raymarching Renderer
 *
 * Implements hardware WebGPU volume raymarching render pipeline:
 * - BindGroupLayout & Pipeline Creation
 * - Front-to-back raymarching pass recording
 * - Uniform buffer updates matching WGSL layout
 * - Multi-brick compositing support
 */

import { VOLUME_RAYMARCH_WGSL } from '../shaders/volume_raymarch.wgsl.ts';
import { GPUResidencyAdapter } from '../residency/residency_adapter.ts';
import { GPUResourceAllocationError } from '../errors.ts';
import type {
  VolumeRaymarchingCameraState,
  VolumeRaymarchingRenderOptions,
  VolumeRaymarchingPipelineConfig,
} from './types.ts';
import {
  type GPUAllocatedBuffer,
  type GPUAllocatedTexture,
  GPUShaderStageFlags,
} from '../types.ts';

export class VolumeRaymarchingRenderer {
  readonly device: GPUDevice;
  readonly residencyAdapter: GPUResidencyAdapter;
  readonly outputFormat: GPUTextureFormat;

  private _pipeline: GPURenderPipeline | null = null;
  private _bindGroupLayout: GPUBindGroupLayout | null = null;
  private _uniformBuffer: GPUAllocatedBuffer | null = null;
  private _linearSampler: GPUSampler | null = null;
  private _pointSampler: GPUSampler | null = null;

  // Fallback dummy textures for unassigned bindings
  private _dummyScalarFloatTexture: GPUAllocatedTexture | null = null;
  private _dummyScalarUintTexture: GPUAllocatedTexture | null = null;
  private _dummyMaskTexture: GPUAllocatedTexture | null = null;
  private _dummyTransferFunctionTexture: GPUAllocatedTexture | null = null;
  private _dummyDepthLutBuffer: GPUAllocatedBuffer | null = null;

  private _isDisposed: boolean = false;

  constructor(
    device: GPUDevice,
    residencyAdapter: GPUResidencyAdapter,
    config: VolumeRaymarchingPipelineConfig = {}
  ) {
    this.device = device;
    this.residencyAdapter = residencyAdapter;
    this.outputFormat = config.outputFormat ?? 'bgra8unorm';

    this.initializeSamplers();
    this.initializeDummyResources();
    this.initializePipeline();
  }

  get pipeline(): GPURenderPipeline {
    if (!this._pipeline) {
      throw new GPUResourceAllocationError('WebGPU RenderPipeline not initialized');
    }
    return this._pipeline;
  }

  get bindGroupLayout(): GPUBindGroupLayout {
    if (!this._bindGroupLayout) {
      throw new GPUResourceAllocationError('WebGPU BindGroupLayout not initialized');
    }
    return this._bindGroupLayout;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  private initializeSamplers(): void {
    this._linearSampler = this.device.createSampler({
      label: 'VolumeRaymarch_LinearSampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });

    this._pointSampler = this.device.createSampler({
      label: 'VolumeRaymarch_PointSampler',
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });
  }

  private initializeDummyResources(): void {
    const resManager = this.residencyAdapter.resourceManager;

    // 1x1x1 dummy float texture
    this._dummyScalarFloatTexture = resManager.uploadTexture3D({
      id: 'dummy_scalar_float',
      width: 1,
      height: 1,
      depth: 1,
      format: 'r16float',
      data: new Uint16Array([0]),
    });

    // 1x1x1 dummy uint texture
    this._dummyScalarUintTexture = resManager.uploadTexture3D({
      id: 'dummy_scalar_uint',
      width: 1,
      height: 1,
      depth: 1,
      format: 'r16uint',
      data: new Uint16Array([0]),
    });

    // 1x1x1 dummy mask texture (1 = valid)
    this._dummyMaskTexture = resManager.uploadTexture3D({
      id: 'dummy_mask',
      width: 1,
      height: 1,
      depth: 1,
      format: 'r8uint',
      data: new Uint8Array([1]),
    });

    // 256x1 dummy TF LUT texture (transparent)
    this._dummyTransferFunctionTexture = resManager.uploadTransferFunctionLUT('dummy_tf', {
      colormap_name: 'dummy',
      canonical_variable: 'dummy',
      range_min: 0,
      range_max: 1,
      control_points: [
        { normalized_position: 0, red: 0, green: 0, blue: 0, opacity: 0 },
        { normalized_position: 1, red: 1, green: 1, blue: 1, opacity: 1 },
      ],
    } as any);

    // 2-level dummy depth LUT
    this._dummyDepthLutBuffer = resManager.uploadDepthLUTBuffer(
      'dummy_depth_lut',
      new Float32Array([0, 100])
    );

    // Uniform buffer (256 bytes allocated to safely accommodate 128-byte struct + alignment)
    this._uniformBuffer = resManager.uploadBuffer({
      id: 'raymarch_uniform_buffer',
      sizeInBytes: 256,
      usage: 0x0040 | 0x0008, // UNIFORM | COPY_DST
      data: new ArrayBuffer(256),
    });
  }

  private initializePipeline(): void {
    const shaderModule = this.device.createShaderModule({
      label: 'VolumeRaymarching_ShaderModule',
      code: VOLUME_RAYMARCH_WGSL,
    });

    this._bindGroupLayout = this.device.createBindGroupLayout({
      label: 'VolumeRaymarch_BindGroupLayout',
      entries: [
        {
          binding: 0, // Uniforms
          visibility: GPUShaderStageFlags.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1, // scalarTexture (Float)
          visibility: GPUShaderStageFlags.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '3d' },
        },
        {
          binding: 2, // scalarTextureUint (Uint)
          visibility: GPUShaderStageFlags.FRAGMENT,
          texture: { sampleType: 'uint', viewDimension: '3d' },
        },
        {
          binding: 3, // maskTexture (Uint)
          visibility: GPUShaderStageFlags.FRAGMENT,
          texture: { sampleType: 'uint', viewDimension: '3d' },
        },
        {
          binding: 4, // depthLut (Storage Buffer read-only)
          visibility: GPUShaderStageFlags.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 5, // transferFunctionTexture (2D Float)
          visibility: GPUShaderStageFlags.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '2d' },
        },
        {
          binding: 6, // linearSampler
          visibility: GPUShaderStageFlags.FRAGMENT,
          sampler: { type: 'filtering' },
        },
        {
          binding: 7, // pointSampler
          visibility: GPUShaderStageFlags.FRAGMENT,
          sampler: { type: 'non-filtering' },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: 'VolumeRaymarch_PipelineLayout',
      bindGroupLayouts: [this._bindGroupLayout],
    });

    this._pipeline = this.device.createRenderPipeline({
      label: 'VolumeRaymarch_RenderPipeline',
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.outputFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
    });
  }

  /**
   * Pack uniform buffer array according to VolumeRaymarchUniforms WGSL struct alignment.
   * Offset mapping (128 bytes total):
   * 0..63: inverseViewProjection (16 x f32)
   * 64..75: cameraPosition (3 x f32)
   * 76..79: stepSize (1 x f32)
   * 80..91: clipMin (3 x f32)
   * 92..95: referenceStepSize (1 x f32)
   * 96..107: clipMax (3 x f32)
   * 108..111: earlyTerminationAlpha (1 x f32)
   * 112..115: scalarOffset (1 x f32)
   * 116..119: scalarScale (1 x f32)
   * 120..123: scalarMin (1 x f32)
   * 124..127: scalarMax (1 x f32)
   * 128..131: depthLevelCount (1 x u32)
   * 132..135: isFloatScalar (1 x u32)
   * 136..139: useValidityMask (1 x u32)
   * 140..143: maxSteps (1 x u32)
   * 144..159: viewport (4 x f32)
   */
  public packUniforms(options: VolumeRaymarchingRenderOptions, isFloat: boolean): ArrayBuffer {
    const buffer = new ArrayBuffer(160);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);

    const cam = options.camera;
    const pkt = options.packet;

    // 0..15 (0..63 bytes): inverseViewProjection
    f32.set(cam.inverseViewProjectionMatrix, 0);

    // 16..18 (64..75 bytes): cameraPosition
    f32[16] = cam.cameraPosition[0];
    f32[17] = cam.cameraPosition[1];
    f32[18] = cam.cameraPosition[2];

    // 19 (76..79 bytes): stepSize
    f32[19] = options.stepSize ?? 0.005;

    // 20..22 (80..91 bytes): clipMin
    f32[20] = pkt.clippingBox.minU;
    f32[21] = pkt.clippingBox.minV;
    f32[22] = pkt.clippingBox.minW;

    // 23 (92..95 bytes): referenceStepSize
    f32[23] = options.referenceStepSize ?? 0.005;

    // 24..26 (96..107 bytes): clipMax
    f32[24] = pkt.clippingBox.maxU;
    f32[25] = pkt.clippingBox.maxV;
    f32[26] = pkt.clippingBox.maxW;

    // 27 (108..111 bytes): earlyTerminationAlpha
    f32[27] = options.earlyTerminationAlpha ?? 0.98;

    // 28..31 (112..127 bytes): scalarOffset, scalarScale, scalarMin, scalarMax
    // For raw quantized uint16: scale = (max - min) / 65535, offset = min
    const scalarRange = pkt.scalarMax - pkt.scalarMin;
    f32[28] = pkt.scalarMin; // scalarOffset
    f32[29] = scalarRange > 0 ? scalarRange / 65535.0 : 1.0; // scalarScale
    f32[30] = pkt.scalarMin;
    f32[31] = pkt.scalarMax;

    // 32..35 (128..143 bytes): depthLevelCount, isFloatScalar, useValidityMask, maxSteps
    u32[32] = pkt.depthLutEntriesM ? pkt.depthLutEntriesM.length : 0;
    u32[33] = isFloat ? 1 : 0;
    u32[34] = 1; // enable validity mask
    u32[35] = options.maxSteps ?? 512;

    // 36..39 (144..159 bytes): viewport [width, height, 1/w, 1/h]
    f32[36] = cam.viewportWidth;
    f32[37] = cam.viewportHeight;
    f32[38] = 1.0 / Math.max(cam.viewportWidth, 1);
    f32[39] = 1.0 / Math.max(cam.viewportHeight, 1);

    return buffer;
  }

  /**
   * Records and submits volume raymarching render pass for active resident packet bricks.
   */
  renderFrame(options: VolumeRaymarchingRenderOptions): GPUCommandBuffer {
    // 1. Sync packet residency with GPU resources
    this.residencyAdapter.synchronizePacket(options.packet);

    // 2. Prepare Command Encoder
    const commandEncoder = this.device.createCommandEncoder({
      label: 'VolumeRaymarch_CommandEncoder',
    });

    const clearColor = options.clearColor ?? { r: 0.0, g: 0.0, b: 0.0, a: 0.0 };

    const renderPass = commandEncoder.beginRenderPass({
      label: 'VolumeRaymarch_RenderPass',
      colorAttachments: [
        {
          view: options.targetView,
          clearValue: clearColor,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: options.depthStencilAttachment,
    });

    renderPass.setPipeline(this.pipeline);

    // 3. Render each active resident brick in RenderPacket
    const tfTexture = this.residencyAdapter.transferFunctionTexture ?? this._dummyTransferFunctionTexture!;
    const depthLutBuf = this.residencyAdapter.depthLutBuffer ?? this._dummyDepthLutBuffer!;

    for (const brick of options.packet.bricks) {
      const gpuBrick = this.residencyAdapter.getBrick(brick.brickKey);
      if (!gpuBrick) {
        continue;
      }

      const isFloat = gpuBrick.scalarTexture.format.includes('float');
      const uniformData = this.packUniforms(options, isFloat);

      // Upload uniforms for current brick
      this.device.queue.writeBuffer(this._uniformBuffer!.buffer, 0, uniformData);

      const scalarFloatView = isFloat
        ? gpuBrick.scalarTexture.view
        : this._dummyScalarFloatTexture!.view;

      const scalarUintView = !isFloat
        ? gpuBrick.scalarTexture.view
        : this._dummyScalarUintTexture!.view;

      const maskView = gpuBrick.validityMaskTexture
        ? gpuBrick.validityMaskTexture.view
        : this._dummyMaskTexture!.view;

      // Create dynamic BindGroup for the current brick draw
      const bindGroup = this.device.createBindGroup({
        label: `Raymarch_BindGroup_${brick.brickKey}`,
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this._uniformBuffer!.buffer } },
          { binding: 1, resource: scalarFloatView },
          { binding: 2, resource: scalarUintView },
          { binding: 3, resource: maskView },
          { binding: 4, resource: { buffer: depthLutBuf.buffer } },
          { binding: 5, resource: tfTexture.view },
          { binding: 6, resource: this._linearSampler! },
          { binding: 7, resource: this._pointSampler! },
        ],
      });

      renderPass.setBindGroup(0, bindGroup);
      // Draw 1 full-screen triangle (3 vertices, no vertex buffer)
      renderPass.draw(3, 1, 0, 0);
    }

    renderPass.end();
    return commandEncoder.finish();
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.residencyAdapter.dispose();
  }
}
