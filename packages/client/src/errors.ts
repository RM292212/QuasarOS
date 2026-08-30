/**
 * QuasarOS Browser Client Error Classes.
 *
 * Conforms strictly to docs/02-architecture/ErrorModel.md:
 * - Specific, machine-readable error codes
 * - Correlated request IDs
 * - Safe user-facing messages without server path leakage
 * - Clear distinction between transport errors, validation errors, and scientific missing states
 */

import type { QuasarErrorDetail, QuasarErrorResponse } from './types.ts';

/**
 * Base class for all Quasar client-side exceptions.
 */
export class QuasarClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuasarClientError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Exception representing an API error returned by the QuasarOS backend,
 * parsed conforming to docs/02-architecture/ErrorModel.md.
 */
export class QuasarApiError extends QuasarClientError {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;
  readonly rawResponse?: unknown;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    requestId: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
    rawResponse?: unknown;
  }) {
    super(`[${params.code}] (HTTP ${params.status}) ${params.message} (requestId: ${params.requestId})`);
    this.name = 'QuasarApiError';
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
    this.retryable = params.retryable ?? false;
    this.details = params.details ?? {};
    this.rawResponse = params.rawResponse;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Safely instantiate a QuasarApiError from a HTTP response status and parsed JSON body.
   */
  static fromResponse(status: number, body: unknown, defaultRequestId = 'unknown'): QuasarApiError {
    if (body && typeof body === 'object') {
      const errorObj = (body as Partial<QuasarErrorResponse>).error;
      if (errorObj && typeof errorObj === 'object') {
        return new QuasarApiError({
          status,
          code: typeof errorObj.code === 'string' ? errorObj.code : `HTTP_${status}`,
          message: typeof errorObj.message === 'string' ? errorObj.message : `HTTP request failed with status ${status}`,
          requestId: typeof errorObj.requestId === 'string' ? errorObj.requestId : defaultRequestId,
          retryable: Boolean(errorObj.retryable),
          details: (errorObj.details && typeof errorObj.details === 'object') ? (errorObj.details as Record<string, unknown>) : {},
          rawResponse: body,
        });
      }
    }

    return new QuasarApiError({
      status,
      code: status >= 500 ? 'INTERNAL_UNEXPECTED' : status === 404 ? 'RESOURCE_NOT_FOUND' : `HTTP_${status}`,
      message: `HTTP request failed with status ${status}`,
      requestId: defaultRequestId,
      retryable: status >= 500 && status !== 501,
      details: {},
      rawResponse: body,
    });
  }
}

/**
 * Exception thrown when a mid-session dataset mutation or silent snapshot ID drift is detected.
 * Protects 3D rendering and scientific queries from operating on mixed-snapshot state.
 */
export class SnapshotMutationError extends QuasarClientError {
  readonly datasetId: string;
  readonly pinnedSnapshotId: string;
  readonly observedSnapshotId: string;

  constructor(datasetId: string, pinnedSnapshotId: string, observedSnapshotId: string) {
    super(
      `Dataset mutation detected for '${datasetId}'. Pinned session snapshot is '${pinnedSnapshotId}' but catalog returned '${observedSnapshotId}'. Preventing silent mid-session dataset drift.`
    );
    this.name = 'SnapshotMutationError';
    this.datasetId = datasetId;
    this.pinnedSnapshotId = pinnedSnapshotId;
    this.observedSnapshotId = observedSnapshotId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Exception thrown when a network request is canceled via AbortSignal or timeout.
 */
export class NetworkAbortError extends QuasarClientError {
  constructor(message = 'Request was aborted or timed out.') {
    super(message);
    this.name = 'NetworkAbortError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
