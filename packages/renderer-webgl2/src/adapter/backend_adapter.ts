/**
 * @quasar/renderer-webgl2 Backend Adapter and Switcher Integration
 *
 * Implements standard backend registration, preflight probing, and backend switching
 * adhering to ADR-0003:
 * - Preferred backend: WebGPU (@quasar/renderer-webgpu)
 * - Required 3D fallback backend: WebGL2 (@quasar/renderer-webgl2)
 * - Fallback sequence: Probe WebGPU -> If unavailable / failed -> Fallback to WebGL2 -> Degraded mode if both fail
 */

import { WebGL2ContextManager } from '../context/gl_context.ts';
import { WebGL2RaymarchingRenderer } from '../pipeline/raymarching_renderer.ts';
import { WebGL2VolumePicker, type WebGL2VolumePickerConfig } from '../picking/webgl2_volume_picker.ts';
import type { WebGL2ContextConfig } from '../types.ts';

export type RenderingBackendType = 'webgpu' | 'webgl2' | 'none';

export interface BackendProbeResult {
  preferredBackend: RenderingBackendType;
  webgpuSupported: boolean;
  webgl2Supported: boolean;
  details?: Record<string, unknown>;
}

export interface BackendSwitcherOptions {
  forceBackend?: RenderingBackendType;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  webgl2Config?: WebGL2ContextConfig;
  webgpuConfig?: Record<string, unknown>;
}

export class WebGL2BackendAdapter {
  readonly backendType: RenderingBackendType = 'webgl2';
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly contextManager: WebGL2ContextManager;
  readonly renderer: WebGL2RaymarchingRenderer;

  private _picker: WebGL2VolumePicker | null = null;
  private _isDisposed: boolean = false;

  constructor(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    config: WebGL2ContextConfig = {}
  ) {
    this.canvas = canvas;
    this.contextManager = WebGL2ContextManager.acquire(canvas, config);
    this.renderer = new WebGL2RaymarchingRenderer(this.contextManager.gl);
  }

  get gl(): WebGL2RenderingContext {
    return this.contextManager.gl;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Create or retrieve active WebGL2VolumePicker for provisional volume picking.
   */
  getOrCreatePicker(pickerConfig: Omit<WebGL2VolumePickerConfig, 'gl'>): WebGL2VolumePicker {
    if (!this._picker || this._picker.isDisposed) {
      this._picker = new WebGL2VolumePicker({
        ...pickerConfig,
        gl: this.gl,
      });
    }
    return this._picker;
  }

  /**
   * Dispose all active WebGL2 pipeline and context resources.
   */
  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;

    if (this._picker) {
      this._picker.dispose();
      this._picker = null;
    }
    this.renderer.dispose();
    this.contextManager.dispose();
  }

  /**
   * Probe system graphics environment to determine supported backends.
   */
  static async probeBackends(): Promise<BackendProbeResult> {
    let webgpuSupported = false;
    let webgl2Supported = false;

    // Probe WebGPU
    if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          webgpuSupported = true;
        }
      } catch {
        webgpuSupported = false;
      }
    }

    // Probe WebGL2
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (gl) {
          webgl2Supported = true;
        }
      } catch {
        webgl2Supported = false;
      }
    } else if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const canvas = new OffscreenCanvas(1, 1);
        const gl = canvas.getContext('webgl2');
        if (gl) {
          webgl2Supported = true;
        }
      } catch {
        webgl2Supported = false;
      }
    }

    const preferredBackend: RenderingBackendType = webgpuSupported
      ? 'webgpu'
      : webgl2Supported
      ? 'webgl2'
      : 'none';

    return {
      preferredBackend,
      webgpuSupported,
      webgl2Supported,
    };
  }
}
