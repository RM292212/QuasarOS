/**
 * QuasarOS Immutable Binary Payload Downloader.
 *
 * Fetches .bin.zst payloads from the backend brick transport endpoint conforming to TASK-05T:
 * `GET /api/v1/visualization-products/{product_id}/bricks/{brick_key}/payloads/{representation}`
 * Supports first-class cancellation via AbortSignal and timeout bounds.
 */

import { NetworkAbortError, QuasarApiError } from '../errors.ts';
import type { BrickRepresentation } from '../types.ts';

export interface DownloaderOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export class BrickDownloader {
  private readonly _baseUrl: string;
  private readonly _fetch: typeof fetch;
  private readonly _timeoutMs: number;

  constructor(baseUrl: string, customFetch?: typeof fetch, defaultTimeoutMs = 15000) {
    this._baseUrl = baseUrl.replace(/\/+$/, '');
    this._fetch = customFetch ?? globalThis.fetch?.bind(globalThis);
    this._timeoutMs = defaultTimeoutMs;

    if (!this._fetch) {
      throw new Error('No fetch implementation available in environment.');
    }
  }

  /**
   * Formats the standard immutable brick payload URL.
   */
  formatPayloadUrl(productId: string, brickKey: string, representation: BrickRepresentation): string {
    return `${this._baseUrl}/api/v1/visualization-products/${encodeURIComponent(productId)}/bricks/${encodeURIComponent(brickKey)}/payloads/${representation}`;
  }

  /**
   * Downloads immutable binary payload bytes.
   */
  async downloadPayload(
    productId: string,
    brickKey: string,
    representation: BrickRepresentation,
    options: DownloaderOptions = {}
  ): Promise<Uint8Array> {
    const url = this.formatPayloadUrl(productId, brickKey, representation);
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
        method: 'GET',
        headers: {
          'Accept': 'application/octet-stream',
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const reqId = response.headers.get('x-request-id') || 'unknown';
        let body: unknown;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          body = await response.json().catch(() => null);
        } else {
          body = await response.text().catch(() => null);
        }
        throw QuasarApiError.fromResponse(response.status, body, reqId);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (err: unknown) {
      if (err instanceof QuasarApiError) {
        throw err;
      }
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        throw new NetworkAbortError(`Download of brick '${brickKey}' was aborted or timed out.`);
      }
      throw err;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
