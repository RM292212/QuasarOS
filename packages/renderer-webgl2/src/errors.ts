/**
 * @quasar/renderer-webgl2 Domain and Runtime Errors
 * Conforms to docs/02-architecture/ErrorModel.md (RENDER_* namespace)
 */

export interface QuasarErrorDetails {
  [key: string]: unknown;
}

export class QuasarWebGL2Error extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details: QuasarErrorDetails;

  constructor(
    code: string,
    message: string,
    retryable: boolean = false,
    details: QuasarErrorDetails = {}
  ) {
    super(`[${code}] ${message}`);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WebGL2InitializationError extends QuasarWebGL2Error {
  constructor(message: string, details: QuasarErrorDetails = {}) {
    super('RENDER_WEBGL2_INIT_FAILED', message, false, details);
  }
}

export class WebGL2ContextLostError extends QuasarWebGL2Error {
  readonly statusMessage: string;

  constructor(statusMessage: string = '', details: QuasarErrorDetails = {}) {
    super(
      'RENDER_WEBGL2_CONTEXT_LOST',
      `WebGL2 context was lost: ${statusMessage || 'Unknown reason'}`,
      true,
      { ...details, statusMessage }
    );
    this.statusMessage = statusMessage;
  }
}

export class WebGL2ResourceAllocationError extends QuasarWebGL2Error {
  constructor(message: string, details: QuasarErrorDetails = {}) {
    super('RENDER_GPU_ALLOCATION_FAILED', message, false, details);
  }
}

export class WebGL2UploadLayoutError extends QuasarWebGL2Error {
  constructor(message: string, details: QuasarErrorDetails = {}) {
    super('RENDER_GPU_UPLOAD_LAYOUT_INVALID', message, false, details);
  }
}

export class WebGL2MemoryBudgetExceededError extends QuasarWebGL2Error {
  constructor(
    allocatedBytes: number,
    budgetBytes: number,
    details: QuasarErrorDetails = {}
  ) {
    super(
      'RENDER_GPU_MEMORY_BUDGET_EXCEEDED',
      `GPU memory allocation (${allocatedBytes} bytes) exceeded budget (${budgetBytes} bytes).`,
      false,
      { ...details, allocatedBytes, budgetBytes }
    );
  }
}

export class WebGL2ResourceDisposedError extends QuasarWebGL2Error {
  constructor(resourceName: string, details: QuasarErrorDetails = {}) {
    super(
      'RENDER_GPU_RESOURCE_DISPOSED',
      `Attempted to use disposed WebGL2 resource: ${resourceName}`,
      false,
      { ...details, resourceName }
    );
  }
}

export class WebGL2ShaderCompilationError extends QuasarWebGL2Error {
  readonly shaderType: string;
  readonly shaderLog: string;

  constructor(
    shaderType: string,
    shaderLog: string = '',
    details: QuasarErrorDetails = {}
  ) {
    super(
      'RENDER_SHADER_COMPILE_FAILED',
      `Failed to compile ${shaderType}:\n${shaderLog}`,
      false,
      { ...details, shaderType, shaderLog }
    );
    this.shaderType = shaderType;
    this.shaderLog = shaderLog;
  }
}

export class WebGL2ProgramLinkError extends QuasarWebGL2Error {
  readonly programLog: string;

  constructor(
    message: string = 'WebGL2 Program Link Failed',
    programLog: string = '',
    details: QuasarErrorDetails = {}
  ) {
    super(
      'RENDER_PROGRAM_LINK_FAILED',
      `Failed to link WebGL2 shader program: ${message}\nLog: ${programLog}`,
      false,
      { ...details, programLog }
    );
    this.programLog = programLog;
  }
}
