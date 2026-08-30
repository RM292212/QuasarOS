/**
 * QuasarOS Catalog and Metadata Client.
 *
 * Provides typed methods for control-plane endpoints under /health and /api/v1/
 * conforming to OpenAPI 3.1 & docs/02-architecture/APIContracts.md.
 */

import { NetworkAbortError, QuasarApiError } from './errors.ts';
import type { SnapshotPinner } from './snapshot_pinner.ts';
import type {
  ApiResponse,
  BrickRepresentation,
  CanonicalDatasetContract,
  CatalogOverview,
  DatasetTimeAxis,
  DatasetVariablesCatalog,
  HealthStatus,
  ListSnapshotsOptions,
  PinnedSnapshotSession,
  QuasarClientConfig,
  RequestOptions,
  SnapshotSummary,
  SystemCapabilities,
  VisualizationProductDetail,
  VisualizationProductSummary,
} from './types.ts';

export class QuasarCatalogClient {
  readonly baseUrl: string;
  private readonly _headers: Record<string, string>;
  private readonly _timeoutMs: number;
  private readonly _fetch: typeof fetch;

  constructor(config: QuasarClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this._headers = {
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
  async request<T>(path: string, options: RequestInit & RequestOptions = {}): Promise<T> {
    const url = path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    const headers: Record<string, string> = {
      ...this._headers,
      ...(options.headers as Record<string, string> | undefined),
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
        ...options,
        headers,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      let body: unknown;
      if (contentType.includes('application/json')) {
        body = await response.json().catch(() => null);
      } else {
        body = await response.text().catch(() => null);
      }

      if (!response.ok) {
        const reqId = response.headers.get('x-request-id') || 'unknown';
        throw QuasarApiError.fromResponse(response.status, body, reqId);
      }

      return body as T;
    } catch (err: unknown) {
      if (err instanceof QuasarApiError) {
        throw err;
      }
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        throw new NetworkAbortError(`Request to '${path}' was aborted or timed out.`);
      }
      throw err;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Health Probes
  // ---------------------------------------------------------------------------

  async getHealthLive(options?: RequestOptions): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health/live', { method: 'GET', ...options });
  }

  async getHealthReady(options?: RequestOptions): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health/ready', { method: 'GET', ...options });
  }

  // ---------------------------------------------------------------------------
  // Catalog & Capabilities
  // ---------------------------------------------------------------------------

  async getCatalog(options?: RequestOptions): Promise<ApiResponse<CatalogOverview>> {
    return this.request<ApiResponse<CatalogOverview>>('/api/v1/catalog', { method: 'GET', ...options });
  }

  async getCapabilities(options?: RequestOptions): Promise<ApiResponse<SystemCapabilities>> {
    return this.request<ApiResponse<SystemCapabilities>>('/api/v1/capabilities', { method: 'GET', ...options });
  }

  // ---------------------------------------------------------------------------
  // Datasets & Snapshots
  // ---------------------------------------------------------------------------

  async getDataset(datasetId: string, options?: RequestOptions): Promise<ApiResponse<CanonicalDatasetContract>> {
    return this.request<ApiResponse<CanonicalDatasetContract>>(
      `/api/v1/datasets/${encodeURIComponent(datasetId)}`,
      { method: 'GET', ...options }
    );
  }

  async listDatasetSnapshots(
    datasetId: string,
    listOptions?: ListSnapshotsOptions
  ): Promise<ApiResponse<SnapshotSummary[]>> {
    const params = new URLSearchParams();
    if (listOptions?.limit !== undefined) {
      params.set('limit', String(listOptions.limit));
    }
    if (listOptions?.offset !== undefined) {
      params.set('offset', String(listOptions.offset));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ApiResponse<SnapshotSummary[]>>(
      `/api/v1/datasets/${encodeURIComponent(datasetId)}/snapshots${query}`,
      { method: 'GET', ...listOptions }
    );
  }

  async getDatasetSnapshot(
    datasetId: string,
    snapshotId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<SnapshotSummary>> {
    return this.request<ApiResponse<SnapshotSummary>>(
      `/api/v1/datasets/${encodeURIComponent(datasetId)}/snapshots/${encodeURIComponent(snapshotId)}`,
      { method: 'GET', ...options }
    );
  }

  async getDatasetVariables(
    datasetId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<DatasetVariablesCatalog>> {
    return this.request<ApiResponse<DatasetVariablesCatalog>>(
      `/api/v1/datasets/${encodeURIComponent(datasetId)}/variables`,
      { method: 'GET', ...options }
    );
  }

  async getDatasetTimes(
    datasetId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<DatasetTimeAxis>> {
    return this.request<ApiResponse<DatasetTimeAxis>>(
      `/api/v1/datasets/${encodeURIComponent(datasetId)}/times`,
      { method: 'GET', ...options }
    );
  }

  // ---------------------------------------------------------------------------
  // Visualization Products & Render Manifests
  // ---------------------------------------------------------------------------

  async listVisualizationProducts(
    options?: RequestOptions
  ): Promise<ApiResponse<VisualizationProductSummary[]>> {
    return this.request<ApiResponse<VisualizationProductSummary[]>>(
      '/api/v1/visualization-products',
      { method: 'GET', ...options }
    );
  }

  async getVisualizationProduct(
    productId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<VisualizationProductDetail>> {
    return this.request<ApiResponse<VisualizationProductDetail>>(
      `/api/v1/visualization-products/${encodeURIComponent(productId)}`,
      { method: 'GET', ...options }
    );
  }

  async getRenderManifest(
    productId: string,
    options?: RequestOptions
  ): Promise<ApiResponse<VisualizationProductDetail>> {
    return this.request<ApiResponse<VisualizationProductDetail>>(
      `/api/v1/render-manifests/${encodeURIComponent(productId)}`,
      { method: 'GET', ...options }
    );
  }

  // ---------------------------------------------------------------------------
  // Brick Download URL Formatter
  // ---------------------------------------------------------------------------

  /**
   * Construct absolute URL for downloading immutable binary sub-volume brick payload (.bin.zst).
   * Conforms to TASK-05T and docs/02-architecture/APIContracts.md.
   */
  formatBrickPayloadUrl(
    productId: string,
    brickKey: string,
    representation: BrickRepresentation
  ): string {
    return `${this.baseUrl}/api/v1/visualization-products/${encodeURIComponent(productId)}/bricks/${encodeURIComponent(brickKey)}/payloads/${representation}`;
  }

  // ---------------------------------------------------------------------------
  // Discovery & Snapshot Pinning Integration
  // ---------------------------------------------------------------------------

  /**
   * Discovers active operational snapshot from catalog and pins it to the provided SnapshotPinner.
   */
  async discoverAndPinActiveSnapshot(
    pinner: SnapshotPinner,
    datasetId?: string,
    options?: RequestOptions
  ): Promise<PinnedSnapshotSession> {
    const catalogResp = await this.getCatalog(options);
    return pinner.pinFromCatalog(catalogResp.data, datasetId);
  }
}
