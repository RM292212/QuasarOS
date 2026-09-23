/**
 * @quasar/renderer-webgl2 Raymarching Renderer
 *
 * Implements hardware WebGL2 GLSL ES 3.00 volume raymarching render pipeline:
 * - Shader compilation & Program linking
 * - Uniform buffer / UBO updates matching GLSL layout (std140)
 * - Texture unit bindings for scalar 3D, mask 3D, and transfer function 2D
 * - Full-screen quad draw call execution
 */

import {
  VOLUME_RAYMARCH_VERT_GLSL,
  VOLUME_RAYMARCH_FRAG_GLSL,
} from '../shaders/index.ts';
import {
  WebGL2ShaderCompilationError,
  WebGL2ProgramLinkError,
  WebGL2ResourceAllocationError,
} from '../errors.ts';
import type {
  VolumeRaymarchingCameraState,
  WebGL2VolumeRaymarchingRenderOptions,
  WebGL2VolumeRaymarchingPipelineConfig,
} from './types.ts';
import type { RenderPacketBrick } from '@quasar/runtime';

export class WebGL2RaymarchingRenderer {
  readonly gl: WebGL2RenderingContext;
  private _program: WebGLProgram | null = null;
  private _vertexShader: WebGLShader | null = null;
  private _fragmentShader: WebGLShader | null = null;
  private _uniformBuffer: WebGLBuffer | null = null;
  private _uniformBlockIndex: number = -1;
  private _vao: WebGLVertexArrayObject | null = null;

  // Sampler uniform locations
  private _locScalarTextureFloat: WebGLUniformLocation | null = null;
  private _locScalarTextureUint: WebGLUniformLocation | null = null;
  private _locMaskTexture: WebGLUniformLocation | null = null;
  private _locTransferFunction: WebGLUniformLocation | null = null;

  // Dummy fallback textures
  private _dummyScalarFloatTex: WebGLTexture | null = null;
  private _dummyScalarUintTex: WebGLTexture | null = null;
  private _dummyMaskTex: WebGLTexture | null = null;
  private _dummyTransferFunctionTex: WebGLTexture | null = null;

  // Active texture unit assignments
  public static readonly TEXTURE_UNIT_SCALAR_FLOAT = 0;
  public static readonly TEXTURE_UNIT_SCALAR_UINT = 1;
  public static readonly TEXTURE_UNIT_MASK = 2;
  public static readonly TEXTURE_UNIT_TRANSFER_FUNCTION = 3;
  public static readonly UNIFORM_BINDING_POINT = 0;

  private _isDisposed: boolean = false;

  constructor(
    gl: WebGL2RenderingContext,
    config: WebGL2VolumeRaymarchingPipelineConfig = {}
  ) {
    this.gl = gl;
    this.initializePipeline();
    this.initializeDummyResources();
  }

  get program(): WebGLProgram {
    if (!this._program) {
      throw new WebGL2ResourceAllocationError('WebGL2 Program not initialized');
    }
    return this._program;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
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

    this._vertexShader = this.compileShader(gl.VERTEX_SHADER, VOLUME_RAYMARCH_VERT_GLSL);
    this._fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, VOLUME_RAYMARCH_FRAG_GLSL);

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
      throw new WebGL2ProgramLinkError('WebGL2 Program Link Failed', log);
    }

    // Bind Uniform Block to binding point 0
    this._uniformBlockIndex = gl.getUniformBlockIndex(this._program, 'VolumeRaymarchUniforms');
    if (this._uniformBlockIndex !== -1 && this._uniformBlockIndex !== 0xffffffff) {
      gl.uniformBlockBinding(
        this._program,
        this._uniformBlockIndex,
        WebGL2RaymarchingRenderer.UNIFORM_BINDING_POINT
      );
    }

    // Cache texture sampler uniform locations
    gl.useProgram(this._program);
    this._locScalarTextureFloat = gl.getUniformLocation(this._program, 'uScalarTextureFloat');
    this._locScalarTextureUint = gl.getUniformLocation(this._program, 'uScalarTextureUint');
    this._locMaskTexture = gl.getUniformLocation(this._program, 'uMaskTexture');
    this._locTransferFunction = gl.getUniformLocation(this._program, 'uTransferFunction');

    if (this._locScalarTextureFloat) gl.uniform1i(this._locScalarTextureFloat, WebGL2RaymarchingRenderer.TEXTURE_UNIT_SCALAR_FLOAT);
    if (this._locScalarTextureUint) gl.uniform1i(this._locScalarTextureUint, WebGL2RaymarchingRenderer.TEXTURE_UNIT_SCALAR_UINT);
    if (this._locMaskTexture) gl.uniform1i(this._locMaskTexture, WebGL2RaymarchingRenderer.TEXTURE_UNIT_MASK);
    if (this._locTransferFunction) gl.uniform1i(this._locTransferFunction, WebGL2RaymarchingRenderer.TEXTURE_UNIT_TRANSFER_FUNCTION);

    // Uniform buffer (std140: 160 bytes header + 64 * 16 bytes depth LUT = 1184 bytes total)
    this._uniformBuffer = gl.createBuffer();
    if (!this._uniformBuffer) {
      throw new WebGL2ResourceAllocationError('Failed to allocate UBO buffer');
    }
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._uniformBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, 1184, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(
      gl.UNIFORM_BUFFER,
      WebGL2RaymarchingRenderer.UNIFORM_BINDING_POINT,
      this._uniformBuffer
    );
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // Full-screen triangle VAO
    this._vao = gl.createVertexArray();
  }

  private initializeDummyResources(): void {
    const gl = this.gl;

    // 1x1x1 dummy float 3D texture
    this._dummyScalarFloatTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this._dummyScalarFloatTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, 1, 1, 1, 0, gl.RED, gl.HALF_FLOAT, new Uint16Array([0]));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 1x1x1 dummy uint 3D texture
    this._dummyScalarUintTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this._dummyScalarUintTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16UI, 1, 1, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array([0]));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 1x1x1 dummy mask 3D texture (1u = valid)
    this._dummyMaskTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this._dummyMaskTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8UI, 1, 1, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array([1]));
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 256x1 dummy transfer function 2D texture (transparent)
    this._dummyTransferFunctionTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._dummyTransferFunctionTex);
    const dummyTF = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      dummyTF[i * 4 + 0] = i;
      dummyTF[i * 4 + 1] = i;
      dummyTF[i * 4 + 2] = i;
      dummyTF[i * 4 + 3] = i;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, dummyTF);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_3D, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Packs uniform buffer matching std140 layout:
   * 0..15 (0..63 bytes): uInverseViewProjection (mat4)
   * 16..18 (64..75 bytes): uCameraPosition (vec3)
   * 19 (76..79 bytes): uStepSize (float)
   * 20..22 (80..91 bytes): uClipMin (vec3)
   * 23 (92..95 bytes): uReferenceStepSize (float)
   * 24..26 (96..107 bytes): uClipMax (vec3)
   * 27 (108..111 bytes): uEarlyTerminationAlpha (float)
   * 28..31 (112..127 bytes): uScalarOffset, uScalarScale, uScalarMin, uScalarMax (4 x float)
   * 32..35 (128..143 bytes): uDepthLevelCount, uIsFloatScalar, uUseValidityMask, uMaxSteps (4 x uint)
   * 36..39 (144..159 bytes): uViewport (vec4)
   * 40..295 (160..1183 bytes): uDepthLutEntries (64 x vec4)
   */
  public packUniforms(options: WebGL2VolumeRaymarchingRenderOptions, isFloat: boolean): ArrayBuffer {
    const buffer = new ArrayBuffer(1184);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);

    const cam = options.camera;
    const pkt = options.packet;

    // 0..15: uInverseViewProjection
    f32.set(cam.inverseViewProjectionMatrix, 0);

    // 16..18: uCameraPosition
    f32[16] = cam.cameraPosition[0];
    f32[17] = cam.cameraPosition[1];
    f32[18] = cam.cameraPosition[2];

    // 19: uStepSize
    f32[19] = options.stepSize ?? 0.005;

    // 20..22: uClipMin
    f32[20] = pkt.clippingBox.minU;
    f32[21] = pkt.clippingBox.minV;
    f32[22] = pkt.clippingBox.minW;

    // 23: uReferenceStepSize
    f32[23] = options.referenceStepSize ?? 0.005;

    // 24..26: uClipMax
    f32[24] = pkt.clippingBox.maxU;
    f32[25] = pkt.clippingBox.maxV;
    f32[26] = pkt.clippingBox.maxW;

    // 27: uEarlyTerminationAlpha
    f32[27] = options.earlyTerminationAlpha ?? 0.98;

    // 28..31: scalar parameters
    const scalarRange = pkt.scalarMax - pkt.scalarMin;
    f32[28] = pkt.scalarMin; // uScalarOffset
    f32[29] = scalarRange > 0 ? scalarRange / 65535.0 : 1.0; // uScalarScale
    f32[30] = pkt.scalarMin;
    f32[31] = pkt.scalarMax;

    // 32..35: depth count & flags
    const depthLevels = pkt.depthLutEntriesM;
    const levelCount = depthLevels ? Math.min(depthLevels.length, 64) : 0;
    u32[32] = levelCount;
    u32[33] = isFloat ? 1 : 0;
    u32[34] = 1; // uUseValidityMask
    u32[35] = options.maxSteps ?? 512;

    // 36..39: uViewport [w, h, 1/w, 1/h]
    f32[36] = cam.viewportWidth;
    f32[37] = cam.viewportHeight;
    f32[38] = 1.0 / Math.max(cam.viewportWidth, 1);
    f32[39] = 1.0 / Math.max(cam.viewportHeight, 1);

    // 40..295: uDepthLutEntries (each depth level stored in .x of vec4, std140 alignment)
    if (depthLevels) {
      for (let i = 0; i < levelCount; i++) {
        f32[40 + i * 4] = depthLevels[i];
      }
    }

    return buffer;
  }

  /**
   * Renders the volume raymarching pass for all active bricks in the packet.
   */
  public renderFrame(
    options: WebGL2VolumeRaymarchingRenderOptions,
    brickTextures?: Map<string, { scalarTex: WebGLTexture; isFloat: boolean; maskTex?: WebGLTexture }>,
    tfTexture?: WebGLTexture
  ): void {
    const gl = this.gl;

    // 1. Setup Framebuffer and Viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, options.targetFramebuffer ?? null);
    gl.viewport(0, 0, options.camera.viewportWidth, options.camera.viewportHeight);

    // 2. Clear buffers if needed
    if (options.clearColor) {
      gl.clearColor(
        options.clearColor[0],
        options.clearColor[1],
        options.clearColor[2],
        options.clearColor[3]
      );
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // 3. Enable standard front-to-back alpha blending
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    // 4. Bind program and VAO
    gl.useProgram(this.program);
    gl.bindVertexArray(this._vao);

    // 5. Bind Transfer Function Texture
    gl.activeTexture(gl.TEXTURE0 + WebGL2RaymarchingRenderer.TEXTURE_UNIT_TRANSFER_FUNCTION);
    gl.bindTexture(gl.TEXTURE_2D, tfTexture ?? this._dummyTransferFunctionTex);

    // 6. Draw each active brick
    for (const brick of options.packet.bricks) {
      const texEntry = brickTextures?.get(brick.brickKey);
      const isFloat = texEntry ? texEntry.isFloat : false;

      // Pack and upload UBO
      const uniformBufferData = this.packUniforms(options, isFloat);
      gl.bindBuffer(gl.UNIFORM_BUFFER, this._uniformBuffer);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, uniformBufferData);
      gl.bindBufferBase(
        gl.UNIFORM_BUFFER,
        WebGL2RaymarchingRenderer.UNIFORM_BINDING_POINT,
        this._uniformBuffer
      );

      // Bind Scalar Float Texture
      gl.activeTexture(gl.TEXTURE0 + WebGL2RaymarchingRenderer.TEXTURE_UNIT_SCALAR_FLOAT);
      gl.bindTexture(
        gl.TEXTURE_3D,
        texEntry && isFloat ? texEntry.scalarTex : this._dummyScalarFloatTex
      );

      // Bind Scalar Uint Texture
      gl.activeTexture(gl.TEXTURE0 + WebGL2RaymarchingRenderer.TEXTURE_UNIT_SCALAR_UINT);
      gl.bindTexture(
        gl.TEXTURE_3D,
        texEntry && !isFloat ? texEntry.scalarTex : this._dummyScalarUintTex
      );

      // Bind Mask Texture
      gl.activeTexture(gl.TEXTURE0 + WebGL2RaymarchingRenderer.TEXTURE_UNIT_MASK);
      gl.bindTexture(
        gl.TEXTURE_3D,
        texEntry?.maskTex ?? this._dummyMaskTex
      );

      // Draw 1 full-screen triangle (3 vertices, no VBO)
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // Cleanup state
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
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
    if (this._dummyScalarFloatTex) {
      gl.deleteTexture(this._dummyScalarFloatTex);
      this._dummyScalarFloatTex = null;
    }
    if (this._dummyScalarUintTex) {
      gl.deleteTexture(this._dummyScalarUintTex);
      this._dummyScalarUintTex = null;
    }
    if (this._dummyMaskTex) {
      gl.deleteTexture(this._dummyMaskTex);
      this._dummyMaskTex = null;
    }
    if (this._dummyTransferFunctionTex) {
      gl.deleteTexture(this._dummyTransferFunctionTex);
      this._dummyTransferFunctionTex = null;
    }
  }
}
