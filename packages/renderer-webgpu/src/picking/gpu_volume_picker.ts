/**
 * @quasar/renderer-webgpu GPU Volume Picker & Readback Engine
 *
 * Dispatches a single-ray compute pick pass at screen/viewport ray (origin, dir),
 * reads back the 32-byte GPU storage result via mapAsync(GPUMapMode.READ),
 * and maps the normalized coordinate and approximate scalar value using ProvisionalPickMapper.
 */

import { VOLUME_PICKING_WGSL } from './volume_picking.wgsl.ts';
import { GPUBufferUsageFlags, GPUMapModeFlags } from '../types.ts';
import { GPUResourceDisposedError } from '../errors.ts';
import {
  ProvisionalPickMapper,
  type CoordinateTransformer,
  type ViewportHitInput,
  type ProvisionalPickResult,
} from '@quasar/runtime';
import type {
  ProvisionalRenderPickResponse,
  ReconcilePickRequest,
  SelectionMethod,
} from '@quasar/client';

export interface PickRay {
  origin: [number, number, number]; // [u, v, w] normalized volume start or camera ray origin
  direction: [number, number, number]; // normalized ray direction vector
  stepSize?: number; // default 0.005
  maxSteps?: number; // default 512
  opacityThreshold?: number; // default 0.01
}

export interface GpuVolumePickerConfig {
  device: GPUDevice;
  transformer: CoordinateTransformer;
  datasetId: string;
  snapshotId: string;
  visualizationProductId: string;
  variableId: string;
  displayUnits: string;
  targetTimeUtc: string;
  lodLevel?: number;
  scalarScale?: number;
  scalarOffset?: number;
  clipMin?: [number, number, number];
  clipMax?: [number, number, number];
  selectionMethod?: SelectionMethod;
  estimatedSampleErrorBound?: number;
}

export interface RawGpuPickBufferData {
  hitU: number;
  hitV: number;
  hitW: number;
  scalarValue: number;
  maskCode: number;
  hitFlag: number;
}

export interface GpuPickResult {
  hit: boolean;
  rawGpuData: RawGpuPickBufferData;
  provisionalPickResult?: ProvisionalPickResult;
  normalizedCoord?: [number, number, number];
  provisionalScalarValue?: number;
}

export class GpuVolumePicker {
  private readonly _device: GPUDevice;
  private readonly _mapper: ProvisionalPickMapper;
  private readonly _config: GpuVolumePickerConfig;
  private _pipeline: GPUComputePipeline | null = null;
  private _uniformBuffer: GPUBuffer | null = null;
  private _storageBuffer: GPUBuffer | null = null;
  private _stagingBuffer: GPUBuffer | null = null;
  private _sampler: GPUSampler | null = null;
  private _isDisposed: boolean = false;

  constructor(config: GpuVolumePickerConfig) {
    this._device = config.device;
    this._config = { ...config };
    this._mapper = new ProvisionalPickMapper(config.transformer);
    this.initPipeline();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get mapper(): ProvisionalPickMapper {
    return this._mapper;
  }

  get config(): GpuVolumePickerConfig {
    return { ...this._config };
  }

  private initPipeline(): void {
    const shaderModule = this._device.createShaderModule({
      label: 'VolumePickingComputeShader',
      code: VOLUME_PICKING_WGSL,
    });

    this._pipeline = this._device.createComputePipeline({
      label: 'VolumePickingPipeline',
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });

    // Uniform buffer: 80 bytes (20 float32/uint32 words)
    this._uniformBuffer = this._device.createBuffer({
      label: 'VolumePickingUniformBuffer',
      size: 80,
      usage: GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.COPY_DST,
    });

    // 32-byte GPU storage buffer for compute write
    this._storageBuffer = this._device.createBuffer({
      label: 'VolumePickingStorageBuffer',
      size: 32,
      usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_SRC,
    });

    // 32-byte staging buffer with MAP_READ for CPU readback
    this._stagingBuffer = this._device.createBuffer({
      label: 'VolumePickingStagingBuffer',
      size: 32,
      usage: GPUBufferUsageFlags.MAP_READ | GPUBufferUsageFlags.COPY_DST,
    });

    this._sampler = this._device.createSampler({
      label: 'VolumePickingLinearSampler',
      magFilter: 'linear',
      minFilter: 'linear',
    });
  }

  /**
   * Execute GPU raymarching pick pass and read back result asynchronously.
   *
   * @param textureView GPU texture view of the active 3D volume
   * @param ray Ray parameters (origin, direction, stepSize, etc.)
   * @param overrides Dynamic metadata overrides (LOD, time, clip bounds)
   */
  async pick(
    textureView: GPUTextureView,
    ray: PickRay,
    overrides?: Partial<GpuVolumePickerConfig>
  ): Promise<GpuPickResult> {
    if (this._isDisposed) {
      throw new GPUResourceDisposedError('GpuVolumePicker');
    }

    const cfg = { ...this._config, ...overrides };
    const stepSize = ray.stepSize ?? 0.005;
    const maxSteps = ray.maxSteps ?? 512;
    const opacityThreshold = ray.opacityThreshold ?? 0.01;
    const clipMin = cfg.clipMin ?? [0, 0, 0];
    const clipMax = cfg.clipMax ?? [1, 1, 1];
    const scalarScale = cfg.scalarScale ?? 1.0;
    const scalarOffset = cfg.scalarOffset ?? 0.0;
    const lodLevel = cfg.lodLevel ?? 0;

    // 1. Pack Uniforms (80 bytes)
    const uniformData = new ArrayBuffer(80);
    const f32 = new Float32Array(uniformData);
    const u32 = new Uint32Array(uniformData);

    // vec3 ray_origin (0..2), f32 step_size (3)
    f32[0] = ray.origin[0];
    f32[1] = ray.origin[1];
    f32[2] = ray.origin[2];
    f32[3] = stepSize;

    // vec3 ray_dir (4..6), u32 max_steps (7)
    f32[4] = ray.direction[0];
    f32[5] = ray.direction[1];
    f32[6] = ray.direction[2];
    u32[7] = maxSteps;

    // vec3 clip_min (8..10), f32 opacity_threshold (11)
    f32[8] = clipMin[0];
    f32[9] = clipMin[1];
    f32[10] = clipMin[2];
    f32[11] = opacityThreshold;

    // vec3 clip_max (12..14), f32 scalar_scale (15)
    f32[12] = clipMax[0];
    f32[13] = clipMax[1];
    f32[14] = clipMax[2];
    f32[15] = scalarScale;

    // f32 scalar_offset (16), u32 has_validity_mask (17), u32 lod_level (18), f32 padding (19)
    f32[16] = scalarOffset;
    u32[17] = 0;
    u32[18] = lodLevel;
    f32[19] = 0;

    this._device.queue.writeBuffer(this._uniformBuffer!, 0, uniformData);

    // 2. Create Bind Group
    const bindGroup = this._device.createBindGroup({
      label: 'VolumePickingBindGroup',
      layout: this._pipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this._uniformBuffer! } },
        { binding: 1, resource: textureView },
        { binding: 2, resource: this._sampler! },
        { binding: 3, resource: { buffer: this._storageBuffer! } },
      ],
    });

    // 3. Encode & Submit Compute Pass and Staging Copy
    const commandEncoder = this._device.createCommandEncoder({
      label: 'VolumePickingCommandEncoder',
    });

    const computePass = commandEncoder.beginComputePass({
      label: 'VolumePickingComputePass',
    });
    computePass.setPipeline(this._pipeline!);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(1, 1, 1);
    computePass.end();

    commandEncoder.copyBufferToBuffer(
      this._storageBuffer!,
      0,
      this._stagingBuffer!,
      0,
      32
    );

    this._device.queue.submit([commandEncoder.finish()]);

    // 4. Map Staging Buffer and Read Back Result
    await this._stagingBuffer!.mapAsync(GPUMapModeFlags.READ, 0, 32);
    const mappedRange = this._stagingBuffer!.getMappedRange(0, 32);
    const copyBuffer = mappedRange.slice(0);
    this._stagingBuffer!.unmap();

    const readF32 = new Float32Array(copyBuffer);
    const readU32 = new Uint32Array(copyBuffer);

    const hitU = readF32[0];
    const hitV = readF32[1];
    const hitW = readF32[2];
    const scalarValue = readF32[3];
    const maskCode = readU32[4];
    const hitFlag = readU32[5];

    const rawGpuData: RawGpuPickBufferData = {
      hitU,
      hitV,
      hitW,
      scalarValue,
      maskCode,
      hitFlag,
    };

    if (hitFlag === 0) {
      return {
        hit: false,
        rawGpuData,
      };
    }

    // 5. Map hit coordinates using ProvisionalPickMapper
    const volumeCoord = { u: hitU, v: hitV, w: hitW };
    const hitInput: ViewportHitInput = {
      volumeCoord,
      provisionalScalarValue: scalarValue,
      renderedLodLevel: lodLevel,
      estimatedSampleErrorBound: cfg.estimatedSampleErrorBound ?? 0.05,
      datasetId: cfg.datasetId,
      snapshotId: cfg.snapshotId,
      visualizationProductId: cfg.visualizationProductId,
      variableId: cfg.variableId,
      displayUnits: cfg.displayUnits,
      targetTimeUtc: cfg.targetTimeUtc,
      selectionMethod: cfg.selectionMethod,
    };

    const provisionalPickResult = this._mapper.mapHit(hitInput);

    return {
      hit: true,
      rawGpuData,
      provisionalPickResult,
      normalizedCoord: [hitU, hitV, hitW],
      provisionalScalarValue: scalarValue,
    };
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    if (this._uniformBuffer) {
      this._uniformBuffer.destroy();
      this._uniformBuffer = null;
    }
    if (this._storageBuffer) {
      this._storageBuffer.destroy();
      this._storageBuffer = null;
    }
    if (this._stagingBuffer) {
      this._stagingBuffer.destroy();
      this._stagingBuffer = null;
    }
    this._pipeline = null;
    this._sampler = null;
  }
}
