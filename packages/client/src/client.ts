/**
 * QuasarOS Unified Browser Client.
 *
 * Combines Catalog discovery, Snapshot Pinning, Multiresolution Render Manifests,
 * and Authoritative Scientific Query clients into a single typed facade.
 */

import { QuasarCatalogClient } from './catalog_client.ts';
import { QuasarQueryClient } from './query_client.ts';
import { SnapshotPinner } from './snapshot_pinner.ts';
import { QuasarBrickStreamer } from './streaming/brick_streamer.ts';
import type {
  BrickRepresentation,
  PinnedSnapshotSession,
  QuasarClientConfig,
  RequestOptions,
} from './types.ts';

export class QuasarClient {
  readonly config: QuasarClientConfig;
  readonly catalog: QuasarCatalogClient;
  readonly query: QuasarQueryClient;
  readonly pinner: SnapshotPinner;
  readonly streamer: QuasarBrickStreamer;

  constructor(config: QuasarClientConfig) {
    this.config = config;
    this.catalog = new QuasarCatalogClient(config);
    this.query = new QuasarQueryClient(config);
    this.pinner = new SnapshotPinner();
    this.streamer = new QuasarBrickStreamer({
      baseUrl: config.baseUrl,
      fetch: config.fetch,
      timeoutMs: config.timeoutMs,
    });
  }

  /**
   * Discovers the operational snapshot via GET /api/v1/catalog and immediately pins
   * the immutable dataset ID, snapshot ID, visualization product ID, and manifest SHA-256.
   *
   * @param datasetId Optional target dataset identifier. If omitted, uses first catalog dataset.
   * @param options Request options including AbortSignal and timeouts.
   */
  async initializeSession(
    datasetId?: string,
    options?: RequestOptions
  ): Promise<PinnedSnapshotSession> {
    return this.catalog.discoverAndPinActiveSnapshot(this.pinner, datasetId, options);
  }

  /**
   * Re-queries catalog and asserts that the pinned snapshot has not mutated mid-session.
   * Throws SnapshotMutationError if the operational active pointer has advanced.
   */
  async verifySessionConsistency(options?: RequestOptions): Promise<void> {
    const catalogResp = await this.catalog.getCatalog(options);
    this.pinner.verifySessionConsistency(catalogResp.data);
  }

  /**
   * Retrieve active pinned snapshot session or null.
   */
  getPinnedSession(): PinnedSnapshotSession | null {
    return this.pinner.getPinnedSession();
  }

  /**
   * Retrieve active pinned snapshot session or throw QuasarClientError.
   */
  requirePinnedSession(): PinnedSnapshotSession {
    return this.pinner.requirePinnedSession();
  }

  /**
   * Construct absolute URL for downloading immutable binary sub-volume brick payload (.bin.zst).
   */
  formatBrickPayloadUrl(
    productId: string,
    brickKey: string,
    representation: BrickRepresentation
  ): string {
    return this.catalog.formatBrickPayloadUrl(productId, brickKey, representation);
  }
}
