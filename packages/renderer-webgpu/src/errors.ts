/**
 * @quasar/renderer-webgpu Domain and Runtime Errors
 * Conforms to docs/02-architecture/ErrorModel.md (RENDER_* namespace)
 */

export interface QuasarErrorDetails {
  [key: string]: unknown;
}

export class QuasarWebGPUError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: QuasarErrorDetails;

  constructor(code: string, message: string, retryable: boolean = false, details: QuasarErrorDetails = {}) {
    super(`[${code}] ${message}`);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WebGPUInitializationError extends QuasarWebGPUError {
  constructor(message: string, details: QuasarErrorDetails = {}) {
    super('RENDER_WEBGPU_INIT_FAILED', message, false, details);
  }
}

export class WebGPUDeviceLostError extends QuasarWebGPUError {
  readonly reason: string;

  constructor(reason: string, message: string, details: QuasarErrorDetails = {}) {
    super('RENDER_WEBGPU_DEVICE_LOST', message, true, { ...details, reason });
    this.reason = reason;
  }
}

export class GPUResourceAllocationError extends QuasarWebGPUError {
  constructor(message: string, details: QuasarErrorDetails = {}) {
    super('RENDER_GPU_ALLOCATION_FAILED', message, false, details);
  }
}

export class GPUUploadLayoutError extends QuasarWebGPUError {
  constructor(message: string, details: QuasarErrorDetails = {}) {
    super('RENDER_GPU_UPLOAD_LAYOUT_INVALID', message, false, details);
  }
}

export class GPUMemoryBudgetExceededError extends QuasarWebGPUError {
  constructor(allocatedBytes: number, budgetBytes: number, details: QuasarErrorDetails = {}) {
    super(
      'RENDER_GPU_MEMORY_BUDGET_EXCEEDED',
      `GPU memory allocation (${allocatedBytes} bytes) exceeded budget (${budgetBytes} bytes).`,
      false,
      { ...details, allocatedBytes, budgetBytes }
    );
  }
}

export class GPUResourceDisposedError extends QuasarWebGPUError {
  constructor(resourceName: string, details: QuasarErrorDetails = {}) {
    super(
      'RENDER_GPU_RESOURCE_DISPOSED',
      `Attempted to use disposed GPU resource: ${resourceName}`,
      false,
      { ...details, resourceName }
    );
  }
}
