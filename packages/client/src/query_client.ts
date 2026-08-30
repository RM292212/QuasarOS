/**
 * QuasarOS Scientific Query Client.
 *
 * Provides typed methods for authoritative exact-value point queries,
 * vertical profile cast queries, and provisional GPU raymarching pick reconciliation
 * conforming to OpenAPI 3.1 & docs/02-architecture/APIContracts.md.
 */

import { NetworkAbortError, QuasarApiError } from './errors.ts';
import type {
  ApiResponse,
  ExactValueQueryRequest,
  ExactValueQueryResponse,
  QuasarClientConfig,
  ReconcilePickRequest,
  ReconcilePickResponse,
  RequestOptions,
  VerticalProfileQueryRequest,
  VerticalProfileQueryResponse,
} from './types.ts';

export class QuasarQueryClient {
  readonly baseUrl: string;
  private readonly _headers: Record<string, string>;
  private readonly _timeoutMs: number;
  private readonly _fetch: typeof fetch;

  constructor(config: QuasarClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this._headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(config.headers ?? {}),
    };
    this._timeoutMs = config.timeoutMs ?? 30000;
    this._fetch = config.fetch ?? globalThis.fetch?.bind(globalThis);

    if (!this._fetch) {
      throw new Error('No fetch implementation available in environment.');
    }
  }

  /**
   * Internal typed HTTP request helper.
   */
  async request<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const url = path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    const headers: Record<string, string> = {
      ...this._headers,
      ...(options.headers ?? {}),
    };

    const timeout = options.timeoutMs ?? this._timeoutMs;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', () => controller.abort());
      }
    }

    if (timeout > 0) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }

    try {
      const response = await this._fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      let respBody: unknown;
      if (contentType.includes('application/json')) {
        respBody = await response.json().catch(() => null);
      } else {
        respBody = await response.text().catch(() => null);
      }

      if (!response.ok) {
        const reqId = response.headers.get('x-request-id') || 'unknown';
        throw QuasarApiError.fromResponse(response.status, respBody, reqId);
      }

      return respBody as T;
    } catch (err: unknown) {
      if (err instanceof QuasarApiError) {
        throw err;
      }
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        throw new NetworkAbortError(`Query request to '${path}' was aborted or timed out.`);
      }
      throw err;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Point Query (POST /api/v1/queries/value)
  // ---------------------------------------------------------------------------

  /**
   * Execute an authoritative exact-value point query directly against native NetCDF arrays.
   */
  async queryExactValue(
    request: ExactValueQueryRequest,
    options?: RequestOptions
  ): Promise<ApiResponse<ExactValueQueryResponse>> {
    return this.request<ApiResponse<ExactValueQueryResponse>>(
      '/api/v1/queries/value',
      request,
      options
    );
  }

  // ---------------------------------------------------------------------------
  // Vertical Profile Query (POST /api/v1/queries/profile)
  // ---------------------------------------------------------------------------

  /**
   * Execute an authoritative vertical profile column query extracting all depth levels.
   */
  async queryVerticalProfile(
    request: VerticalProfileQueryRequest,
    options?: RequestOptions
  ): Promise<ApiResponse<VerticalProfileQueryResponse>> {
    return this.request<ApiResponse<VerticalProfileQueryResponse>>(
      '/api/v1/queries/profile',
      request,
      options
    );
  }

  // ---------------------------------------------------------------------------
  // Pick Reconciliation (POST /api/v1/queries/reconcile-pick)
  // ---------------------------------------------------------------------------

  /**
   * Reconcile an approximate GPU raymarch texture hit against native NetCDF ground truth.
   */
  async reconcileProvisionalPick(
    request: ReconcilePickRequest,
    options?: RequestOptions
  ): Promise<ApiResponse<ReconcilePickResponse>> {
    return this.request<ApiResponse<ReconcilePickResponse>>(
      '/api/v1/queries/reconcile-pick',
      request,
      options
    );
  }
}
