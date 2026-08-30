/**
 * @quasar/renderer-webgl2 Context Management & Capabilities
 * Probes extensions, queries limits, and wraps WebGL2RenderingContext lifecycle.
 */

import {
  WebGL2InitializationError,
  WebGL2ContextLostError,
} from '../errors.ts';
import type {
  WebGL2ContextConfig,
  WebGL2ExtensionRegistry,
  WebGL2Capabilities,
} from '../types.ts';

export class WebGL2ContextManager {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly gl: WebGL2RenderingContext;
  readonly extensions: WebGL2ExtensionRegistry;
  readonly capabilities: WebGL2Capabilities;

  private _isLost: boolean = false;
  private readonly _config: WebGL2ContextConfig;
  private readonly _contextLostListener: (event: Event) => void;
  private readonly _contextRestoredListener: (event: Event) => void;

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    gl: WebGL2RenderingContext,
    config: WebGL2ContextConfig = {}
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this._config = config;

    // Probe extensions
    this.extensions = WebGL2ContextManager.probeExtensions(gl);

    // Query hardware limits
    this.capabilities = WebGL2ContextManager.queryCapabilities(gl, this.extensions);

    // Event listeners
    this._contextLostListener = (event: Event) => {
      this._isLost = true;
      if (event.preventDefault) {
        event.preventDefault();
      }
      if (this._config.onContextLost) {
        this._config.onContextLost(event);
      }
    };

    this._contextRestoredListener = (event: Event) => {
      this._isLost = false;
      if (this._config.onContextRestored) {
        this._config.onContextRestored(event);
      }
    };

    if ('addEventListener' in canvas) {
      canvas.addEventListener('webglcontextlost', this._contextLostListener as EventListener, false);
      canvas.addEventListener('webglcontextrestored', this._contextRestoredListener as EventListener, false);
    }
  }

  get isLost(): boolean {
    return this._isLost;
  }

  /**
   * Acquire a WebGL2RenderingContext from an HTMLCanvasElement or OffscreenCanvas.
   */
  static acquire(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    config: WebGL2ContextConfig = {}
  ): WebGL2ContextManager {
    const glAttributes: WebGLContextAttributes = {
      alpha: config.alpha ?? true,
      depth: config.depth ?? false,
      stencil: config.stencil ?? false,
      antialias: config.antialias ?? false,
      premultipliedAlpha: config.premultipliedAlpha ?? true,
      preserveDrawingBuffer: config.preserveDrawingBuffer ?? false,
      powerPreference: config.powerPreference ?? 'high-performance',
      failIfMajorPerformanceCaveat: config.failIfMajorPerformanceCaveat ?? false,
    };

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', glAttributes) as WebGL2RenderingContext | null;
    } catch (err: unknown) {
      throw new WebGL2InitializationError(
        `Failed to acquire WebGL2 context: ${err instanceof Error ? err.message : String(err)}`,
        { originalError: String(err) }
      );
    }

    if (!gl) {
      throw new WebGL2InitializationError(
        'WebGL2 is not supported or context could not be created on the canvas.'
      );
    }

    return new WebGL2ContextManager(canvas, gl, config);
  }

  /**
   * Probe WebGL2 extensions required or optional for volume rendering.
   */
  static probeExtensions(gl: WebGL2RenderingContext): WebGL2ExtensionRegistry {
    const colorBufferFloat = gl.getExtension('EXT_color_buffer_float') as EXT_color_buffer_float | null;
    const colorBufferHalfFloat =
      gl.getExtension('EXT_color_buffer_half_float') ||
      gl.getExtension('OES_texture_half_float') ||
      null;
    const textureFloatLinear = gl.getExtension('OES_texture_float_linear') as OES_texture_float_linear | null;
    const textureHalfFloatLinear =
      gl.getExtension('OES_texture_half_float_linear') ||
      null;
    const parallelShaderCompile = gl.getExtension('KHR_parallel_shader_compile') as KHR_parallel_shader_compile | null;

    return {
      colorBufferFloat,
      colorBufferHalfFloat,
      textureFloatLinear,
      textureHalfFloatLinear,
      parallelShaderCompile,
    };
  }

  /**
   * Query limits and capabilities from WebGL2RenderingContext.
   */
  static queryCapabilities(
    gl: WebGL2RenderingContext,
    extensions: WebGL2ExtensionRegistry
  ): WebGL2Capabilities {
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const max3DTextureSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) || 256;
    const maxArrayTextureLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) || 256;
    const maxTextureImageUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 16;
    const maxUniformBufferBindings = gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS) || 24;
    const maxUniformBlockSize = gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE) || 65536;
    const uniformBufferOffsetAlignment = gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT) || 256;

    return {
      maxTextureSize,
      max3DTextureSize,
      maxArrayTextureLayers,
      maxTextureImageUnits,
      maxUniformBufferBindings,
      maxUniformBlockSize,
      uniformBufferOffsetAlignment,
      supportsColorBufferFloat: extensions.colorBufferFloat !== null,
      supportsColorBufferHalfFloat: extensions.colorBufferHalfFloat !== null || extensions.colorBufferFloat !== null,
      supportsFloatLinear: extensions.textureFloatLinear !== null,
      supportsHalfFloatLinear: extensions.textureHalfFloatLinear !== null || extensions.textureFloatLinear !== null,
    };
  }

  dispose(): void {
    if ('removeEventListener' in this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this._contextLostListener as EventListener, false);
      this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredListener as EventListener, false);
    }
    this._isLost = true;
  }
}
