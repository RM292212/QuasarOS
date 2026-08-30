/**
 * @quasar/renderer-webgpu Device Acquisition & Lifecycle Context
 * Handles WebGPU device acquisition, capability checks, uncaptured error & device-loss handling.
 */

import { WebGPUInitializationError, WebGPUDeviceLostError } from '../errors.ts';
import type { WebGPUDeviceContext, WebGPUDeviceContextConfig } from '../types.ts';

export class DeviceContext implements WebGPUDeviceContext {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  readonly queue: GPUQueue;
  private _isLost: boolean = false;
  private readonly _config: WebGPUDeviceContextConfig;

  private constructor(adapter: GPUAdapter, device: GPUDevice, config: WebGPUDeviceContextConfig) {
    this.adapter = adapter;
    this.device = device;
    this.queue = device.queue;
    this._config = config;

    // Attach device lost handler
    this.device.lost.then((info: GPUDeviceLostInfo) => {
      this._isLost = true;
      const reason = info.reason || 'unknown';
      const message = info.message || 'GPU Device connection was lost';
      if (this._config.onDeviceLost) {
        this._config.onDeviceLost(reason, message);
      }
    });

    // Attach uncaptured error handler
    this.device.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
      if (this._config.onUncapturedError) {
        this._config.onUncapturedError(event.error);
      }
    });
  }

  get isLost(): boolean {
    return this._isLost;
  }

  /**
   * Acquire a WebGPU device context.
   */
  static async acquire(
    navigatorGpu?: GPU,
    config: WebGPUDeviceContextConfig = {}
  ): Promise<DeviceContext> {
    const gpu = navigatorGpu || (typeof navigator !== 'undefined' ? navigator.gpu : undefined);
    if (!gpu) {
      throw new WebGPUInitializationError(
        'WebGPU is not supported in this environment (navigator.gpu is undefined).'
      );
    }

    let adapter: GPUAdapter | null = null;
    try {
      adapter = await gpu.requestAdapter({
        powerPreference: config.powerPreference ?? 'high-performance',
        forceFallbackAdapter: config.forceFallbackAdapter ?? false,
      });
    } catch (err: unknown) {
      throw new WebGPUInitializationError(
        `Failed to request WebGPU adapter: ${err instanceof Error ? err.message : String(err)}`,
        { originalError: String(err) }
      );
    }

    if (!adapter) {
      throw new WebGPUInitializationError(
        'No suitable WebGPU adapter found for the requested parameters.'
      );
    }

    // Check required features if specified
    const requiredFeatures: GPUFeatureName[] = [];
    if (config.requiredFeatures) {
      for (const feature of config.requiredFeatures) {
        if (!adapter.features.has(feature)) {
          throw new WebGPUInitializationError(
            `Required WebGPU feature '${feature}' is not supported by the adapter.`
          );
        }
        requiredFeatures.push(feature);
      }
    }

    // Optional f16 support check (shader-f16)
    if (adapter.features.has('shader-f16') && !requiredFeatures.includes('shader-f16')) {
      requiredFeatures.push('shader-f16');
    }

    // Device request
    let device: GPUDevice;
    try {
      device = await adapter.requestDevice({
        requiredFeatures,
        requiredLimits: config.requiredLimits,
      });
    } catch (err: unknown) {
      throw new WebGPUInitializationError(
        `Failed to request GPUDevice from adapter: ${err instanceof Error ? err.message : String(err)}`,
        { originalError: String(err) }
      );
    }

    return new DeviceContext(adapter, device, config);
  }

  dispose(): void {
    if (!this._isLost) {
      try {
        this.device.destroy();
      } catch {
        // Device may already be closed
      }
      this._isLost = true;
    }
  }
}
