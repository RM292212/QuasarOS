/**
 * @quasar/renderer-webgl2 WebGL2 Volume Picker & Readback Engine
 *
 * Implements GPU-accelerated raymarching pick pass using single-pixel offscreen FBO readback:
 * 1. Sets up 1x1 RGBA32F (or float/half-float fallback) framebuffer object (FBO).
 * 2. Uploads ray parameters (uRayOrigin, uRayDir, stepSize, maxSteps, opacityThreshold, clip bounds).
 * 3. Draws 1-triangle fullscreen quad rendering into 1x1 FBO.
 * 4. Reads back 1x1 RGBA pixel via gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixelData).
 * 5. If hit detected ([u, v, w, scalar] with hit != 0 or valid volume), maps the hit coordinate
 *    and approximate scalar value using @quasar/runtime's ProvisionalPickMapper.
 */

import {
  VOLUME_PICKING_VERT_GLSL,
  VOLUME_PICKING_FRAG_GLSL,
} from '../shaders/volume_picking.glsl.ts';
import {
  WebGL2ShaderCompilationError,
  WebGL2ProgramLinkError,
  WebGL2ResourceAllocationError,
  WebGL2ResourceDisposedError,
} from '../errors.ts';
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

export interface WebGL2PickRay {
  origin: [number, number, number]; // [u, v, w] normalized volume start or camera ray origin
  direction: [number, number, number]; // normalized ray direction vector
  stepSize?: number; // default 0.005
  maxSteps?: number; // default 512
  opacityThreshold?: number; // default 0.01
}

export interface WebGL2VolumePickerConfig {
  gl: WebGL2RenderingContext;
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

export interface RawWebGL2PickBufferData {
  hitU: number;
  hitV: number;
  hitW: number;
  scalarValue: number;
  hitFlag: number;
}

export interface WebGL2PickResult {
  hit: boolean;
  rawGpuData: RawWebGL2PickBufferData;
  provisionalPickResult?: ProvisionalPickResult;
  normalizedCoord?: [number, number, number];
  provisionalScalarValue?: number;
}

export interface PickTextureBinding {
  texture: WebGLTexture;
  isFloat?: boolean;
  maskTexture?: WebGLTexture;
}

export class WebGL2VolumePicker {
  readonly gl: WebGL2RenderingContext;
  private readonly _mapper: ProvisionalPickMapper;
  private readonly _config: WebGL2VolumePickerConfig;

  private _program: WebGLProgram | null = null;
  private _vertexShader: WebGLShader | null = null;
  private _fragmentShader: WebGLShader | null = null;
  private _uniformBuffer: WebGLBuffer | null = null;
  private _uniformBlockIndex: number = -1;
  private _vao: WebGLVertexArrayObject | null = null;

  // Offscreen FBO & Color Attachment for 1x1 pick readback
  private _fbo: WebGLFramebuffer | null = null;
  private _pickTargetTexture: WebGLTexture | null = null;
  private _isUsingFloatReadback: boolean = true;

  // Sampler uniform locations
  private _locVolumeTextureFloat: WebGLUniformLocation | null = null;
  private _locVolumeTextureUint: WebGLUniformLocation | null = null;
  private _locMaskTexture: WebGLUniformLocation | null = null;

  // Dummy fallback textures
  private _dummyFloatTex: WebGLTexture | null = null;
  private _dummyUintTex: WebGLTexture | null = null;
  private _dummyMaskTex: WebGLTexture | null = null;

  public static readonly TEXTURE_UNIT_FLOAT = 0;
  public static readonly TEXTURE_UNIT_UINT = 1;
  public static readonly TEXTURE_UNIT_MASK = 2;
  public static readonly UNIFORM_BINDING_POINT = 0;

  private _isDisposed: boolean = false;

  constructor(config: WebGL2VolumePickerConfig) {
    this.gl = config.gl;
    this._config = { ...config };
    this._mapper = new ProvisionalPickMapper(config.transformer);

    this.initializePipeline();
    this.initializeFbo();
    this.initializeDummyResources();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get mapper(): ProvisionalPickMapper {
    return this._mapper;
  }

  get config(): WebGL2VolumePickerConfig {
    return { ...this._config };
  }

  get program(): WebGLProgram {
    if (!this._program) {
      throw new WebGL2ResourceAllocationError('WebGL2 Volume Picking Program not initialized');
    }
    return this._program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new WebGL2ResourceAllocationError('Failed to allocate WebGLShader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
      const log = gl.getShaderInfoLog(shader) || '';
      gl.deleteShader(shader);
      throw new WebGL2ShaderCompilationError(
        type === gl.VERTEX_SHADER ? 'Vertex Shader' : 'Fragment Shader',
        log
      );
    }
    return shader;
  }

  private initializePipeline(): void {
    const gl = this.gl;

    this._vertexShader = this.compileShader(gl.VERTEX_SHADER, VOLUME_PICKING_VERT_GLSL);
    this._fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, VOLUME_PICKING_FRAG_GLSL);

    this._program = gl.createProgram();
    if (!this._program) {
      throw new WebGL2ResourceAllocationError('Failed to allocate WebGLProgram');
    }

    gl.attachShader(this._program, this._vertexShader);
    gl.attachShader(this._program, this._fragmentShader);
    gl.linkProgram(this._program);

    const linked = gl.getProgramParameter(this._program, gl.LINK_STATUS);
    if (!linked) {
      const log = gl.getProgramInfoLog(this._program) || '';
      gl.deleteProgram(this._program);
      this._program = null;
      throw new WebGL2ProgramLinkError('WebGL2 Volume Picking Program Link Failed', log);
    }

    // Bind Uniform Block
    this._uniformBlockIndex = gl.getUniformBlockIndex(this._program, 'VolumePickingUniforms');
    if (this._uniformBlockIndex !== -1 && this._uniformBlockIndex !== 0xffffffff) {
      gl.uniformBlockBinding(
        this._program,
        this._uniformBlockIndex,
        WebGL2VolumePicker.UNIFORM_BINDING_POINT
      );
    }

    // Cache sampler uniform locations
    gl.useProgram(this._program);
    this._locVolumeTextureFloat = gl.getUniformLocation(this._program, 'uVolumeTextureFloat');
    this._locVolumeTextureUint = gl.getUniformLocation(this._program, 'uVolumeTextureUint');
    this._locMaskTexture = gl.getUniformLocation(this._program, 'uMaskTexture');

    if (this._locVolumeTextureFloat) gl.uniform1i(this._locVolumeTextureFloat, WebGL2VolumePicker.TEXTURE_UNIT_FLOAT);
    if (this._locVolumeTextureUint) gl.uniform1i(this._locVolumeTextureUint, WebGL2VolumePicker.TEXTURE_UNIT_UINT);
    if (this._locMaskTexture) gl.uniform1i(this._locMaskTexture, WebGL2VolumePicker.TEXTURE_UNIT_MASK);

    // Uniform buffer (80 bytes total)
    this._uniformBuffer = gl.createBuffer();
    if (!this._uniformBuffer) {
      throw new WebGL2ResourceAllocationError('Failed to allocate UBO buffer for volume picking');
    }
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._uniformBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, 80, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(
      gl.UNIFORM_BUFFER,
      WebGL2VolumePicker.UNIFORM_BINDING_POINT,
      this._uniformBuffer
    );
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // Full-screen triangle VAO
    this._vao = gl.createVertexArray();
  }

  private initializeFbo(): void {
    const gl = this.gl;

    // Check extension for float color buffer support
    const extFloat = gl.getExtension('EXT_color_buffer_float');
    const extHalfFloat = gl.getExtension('EXT_color_buffer_half_float');

    this._fbo = gl.createFramebuffer();
    this._pickTargetTexture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, this._pickTargetTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (extFloat || extHalfFloat) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
      this._isUsingFloatReadback = true;
    } else {
      // RGBA8 fallback
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this._isUsingFloatReadback = false;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this._pickTargetTexture,
      0
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private initializeDummyResources(): void {
    const gl = this.gl;

    // 1x1x1 dummy float texture
    this._dummyFloatTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this._dummyFloatTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, 1, 1, 1, 0, gl.RED, gl.HALF_FLOAT, new Uint16Array([0]));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // 1x1x1 dummy uint texture
    this._dummyUintTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this._dummyUintTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16UI, 1, 1, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array([0]));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // 1x1x1 dummy mask texture (1u = valid)
    this._dummyMaskTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this._dummyMaskTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8UI, 1, 1, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array([1]));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_3D, null);
  }

  /**
   * Packs picking uniform buffer (80 bytes, std140):
   * 0..2: uRayOrigin (vec3)
   * 3: uStepSize (f32)
   * 4..6: uRayDir (vec3)
   * 7: uMaxSteps (u32)
   * 8..10: uClipMin (vec3)
   * 11: uOpacityThreshold (f32)
   * 12..14: uClipMax (vec3)
   * 15: uScalarScale (f32)
   * 16: uScalarOffset (f32)
   * 17: uHasValidityMask (u32)
   * 18: uIsFloatScalar (u32)
   * 19: uLodLevel (u32)
   */
  public packUniforms(
    ray: WebGL2PickRay,
    overrides?: Partial<WebGL2VolumePickerConfig>,
    isFloat: boolean = true,
    hasMask: boolean = false
  ): ArrayBuffer {
    const cfg = { ...this._config, ...overrides };
    const buffer = new ArrayBuffer(80);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);

    const stepSize = ray.stepSize ?? 0.005;
    const maxSteps = ray.maxSteps ?? 512;
    const opacityThreshold = ray.opacityThreshold ?? 0.01;
    const clipMin = cfg.clipMin ?? [0, 0, 0];
    const clipMax = cfg.clipMax ?? [1, 1, 1];
    const scalarScale = cfg.scalarScale ?? 1.0;
    const scalarOffset = cfg.scalarOffset ?? 0.0;
    const lodLevel = cfg.lodLevel ?? 0;

    // vec3 uRayOrigin, f32 uStepSize
    f32[0] = ray.origin[0];
    f32[1] = ray.origin[1];
    f32[2] = ray.origin[2];
    f32[3] = stepSize;

    // vec3 uRayDir, u32 uMaxSteps
    f32[4] = ray.direction[0];
    f32[5] = ray.direction[1];
    f32[6] = ray.direction[2];
    u32[7] = maxSteps;

    // vec3 uClipMin, f32 uOpacityThreshold
    f32[8] = clipMin[0];
    f32[9] = clipMin[1];
    f32[10] = clipMin[2];
    f32[11] = opacityThreshold;

    // vec3 uClipMax, f32 uScalarScale
    f32[12] = clipMax[0];
    f32[13] = clipMax[1];
    f32[14] = clipMax[2];
    f32[15] = scalarScale;

    // f32 uScalarOffset, u32 uHasValidityMask, u32 uIsFloatScalar, u32 uLodLevel
    f32[16] = scalarOffset;
    u32[17] = hasMask ? 1 : 0;
    u32[18] = isFloat ? 1 : 0;
    u32[19] = lodLevel;

    return buffer;
  }

  /**
   * Execute GPU raymarching pick pass on WebGL2 and read back result via gl.readPixels.
   *
   * @param binding Texture bindings (scalar texture, mask, isFloat flag)
   * @param ray Ray parameters (origin, direction, stepSize, maxSteps, opacityThreshold)
   * @param overrides Dynamic metadata overrides
   */
  async pick(
    binding: PickTextureBinding | WebGLTexture,
    ray: WebGL2PickRay,
    overrides?: Partial<WebGL2VolumePickerConfig>
  ): Promise<WebGL2PickResult> {
    if (this._isDisposed) {
      throw new WebGL2ResourceDisposedError('WebGL2VolumePicker');
    }

    const gl = this.gl;
    const cfg = { ...this._config, ...overrides };

    const textureBinding: PickTextureBinding =
      binding && typeof binding === 'object' && 'texture' in binding
        ? (binding as PickTextureBinding)
        : { texture: binding as WebGLTexture, isFloat: true };

    const isFloat = textureBinding.isFloat ?? true;
    const hasMask = !!textureBinding.maskTexture;

    // 1. Pack & Upload Uniforms
    const uniformData = this.packUniforms(ray, overrides, isFloat, hasMask);
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._uniformBuffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, uniformData);
    gl.bindBufferBase(
      gl.UNIFORM_BUFFER,
      WebGL2VolumePicker.UNIFORM_BINDING_POINT,
      this._uniformBuffer
    );

    // 2. Bind Offscreen 1x1 FBO & set viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    gl.viewport(0, 0, 1, 1);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 3. Disable blending and depth testing for exact single-pixel write
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    // 4. Bind program and VAO
    gl.useProgram(this.program);
    gl.bindVertexArray(this._vao);

    // 5. Bind textures
    gl.activeTexture(gl.TEXTURE0 + WebGL2VolumePicker.TEXTURE_UNIT_FLOAT);
    gl.bindTexture(
      gl.TEXTURE_3D,
      isFloat ? textureBinding.texture : this._dummyFloatTex
    );

    gl.activeTexture(gl.TEXTURE0 + WebGL2VolumePicker.TEXTURE_UNIT_UINT);
    gl.bindTexture(
      gl.TEXTURE_3D,
      !isFloat ? textureBinding.texture : this._dummyUintTex
    );

    gl.activeTexture(gl.TEXTURE0 + WebGL2VolumePicker.TEXTURE_UNIT_MASK);
    gl.bindTexture(
      gl.TEXTURE_3D,
      textureBinding.maskTexture ?? this._dummyMaskTex
    );

    // 6. Draw 1 fullscreen triangle (3 vertices)
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 7. Read back pixel data
    const readPixel = new Float32Array(4);
    if (this._isUsingFloatReadback) {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, readPixel);
    } else {
      const u8Pixel = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, u8Pixel);
      readPixel[0] = u8Pixel[0] / 255.0;
      readPixel[1] = u8Pixel[1] / 255.0;
      readPixel[2] = u8Pixel[2] / 255.0;
      readPixel[3] = (u8Pixel[3] / 255.0) * (cfg.scalarScale ?? 1.0) + (cfg.scalarOffset ?? 0.0);
    }

    // Cleanup state
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(null);

    const hitU = readPixel[0];
    const hitV = readPixel[1];
    const hitW = readPixel[2];
    const scalarValue = readPixel[3];

    // Hit test: hit occurs when [u, v, w] is within [0, 1]^3 and scalarValue != 0 (or valid hit)
    const isHit =
      (hitU > 0.0 || hitV > 0.0 || hitW > 0.0 || Math.abs(scalarValue) > 1e-6) &&
      hitU >= 0.0 && hitU <= 1.0 &&
      hitV >= 0.0 && hitV <= 1.0 &&
      hitW >= 0.0 && hitW <= 1.0;

    const rawGpuData: RawWebGL2PickBufferData = {
      hitU,
      hitV,
      hitW,
      scalarValue,
      hitFlag: isHit ? 1 : 0,
    };

    if (!isHit) {
      return {
        hit: false,
        rawGpuData,
      };
    }

    // 8. Map hit coordinates using ProvisionalPickMapper
    const volumeCoord = { u: hitU, v: hitV, w: hitW };
    const hitInput: ViewportHitInput = {
      volumeCoord,
      provisionalScalarValue: scalarValue,
      renderedLodLevel: cfg.lodLevel ?? 0,
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
    const gl = this.gl;

    if (this._program) {
      gl.deleteProgram(this._program);
      this._program = null;
    }
    if (this._vertexShader) {
      gl.deleteShader(this._vertexShader);
      this._vertexShader = null;
    }
    if (this._fragmentShader) {
      gl.deleteShader(this._fragmentShader);
      this._fragmentShader = null;
    }
    if (this._uniformBuffer) {
      gl.deleteBuffer(this._uniformBuffer);
      this._uniformBuffer = null;
    }
    if (this._vao) {
      gl.deleteVertexArray(this._vao);
      this._vao = null;
    }
    if (this._fbo) {
      gl.deleteFramebuffer(this._fbo);
      this._fbo = null;
    }
    if (this._pickTargetTexture) {
      gl.deleteTexture(this._pickTargetTexture);
      this._pickTargetTexture = null;
    }
    if (this._dummyFloatTex) {
      gl.deleteTexture(this._dummyFloatTex);
      this._dummyFloatTex = null;
    }
    if (this._dummyUintTex) {
      gl.deleteTexture(this._dummyUintTex);
      this._dummyUintTex = null;
    }
    if (this._dummyMaskTex) {
      gl.deleteTexture(this._dummyMaskTex);
      this._dummyMaskTex = null;
    }
  }
}
