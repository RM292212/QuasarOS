/**
 * QuasarOS Browser Brick Streamer Facade.
 *
 * Coordinates:
 * 1. Cache lookups (LRU BrickCache)
 * 2. Multi-tier Priority Request Scheduler
 * 3. Binary payload downloading (BrickDownloader)
 * 4. Cryptographic SHA-256 integrity verification (Web Crypto API)
 * 5. Zstandard payload decompression (fzstd)
 * 6. Float16 / Uint16 decoding into renderer-independent DecodedBrick
 */

import { BrickCache } from './cache.ts';
import { decodeBrickPayload } from './decoder.ts';
import { decompressZstd } from './decompressor.ts';
import { BrickDownloader } from './downloader.ts';
import { RequestScheduler } from './scheduler.ts';
import type {
  BrickStreamerConfig,
  DecodedBrick,
  RequestPriorityScore,
  StreamerStatistics,
  StreamingRequestTarget,
} from './types.ts';
import { verifyPayloadIntegrity } from './verifier.ts';

export class QuasarBrickStreamer {
  private readonly _downloader: BrickDownloader;
  private readonly _cache: BrickCache;
  private readonly _scheduler: RequestScheduler;
  private readonly _maxUncompressedCeiling: number;

  constructor(config: BrickStreamerConfig) {
    this._downloader = new BrickDownloader(config.baseUrl, config.fetch, config.timeoutMs ?? 15000);
    this._cache = new BrickCache(config.maxCacheSizeBytes);
    this._maxUncompressedCeiling = config.maxUncompressedBytesCeiling ?? (1024 * 1024);

    this._scheduler = new RequestScheduler(
      (target, signal) => this._fetchAndDecodePipeline(target, signal),
      config.maxConcurrentDownloads ?? 6
    );
  }

  /**
   * Access the underlying LRU BrickCache instance directly.
   */
  get cache(): BrickCache {
    return this._cache;
  }

  /**
   * Internal pipeline: Download -> Verify SHA-256 -> Decompress -> Decode.
   */
  private async _fetchAndDecodePipeline(
    target: StreamingRequestTarget,
    signal: AbortSignal
  ): Promise<DecodedBrick> {
    const { visualizationProductId, brickKey, representation, geometry, payloadMetadata } = target;

    // 1. Download compressed payload (.bin.zst)
    const compressedBytes = await this._downloader.downloadPayload(
      visualizationProductId,
      brickKey,
      representation,
      { signal }
    );

    // 2. Cryptographic SHA-256 verification
    const expectedSha256 = payloadMetadata.sha256_checksum;
    if (expectedSha256) {
      await verifyPayloadIntegrity(brickKey, compressedBytes, expectedSha256);
    }

    // 3. Zstd decompression
    const decompressed = decompressZstd(brickKey, compressedBytes, {
      expectedBytesLength: payloadMetadata.uncompressed_bytes_length,
      maxBytesCeiling: this._maxUncompressedCeiling,
    });

    // 4. Decode payload into DecodedBrick
    const decoded = decodeBrickPayload(representation, decompressed, geometry, payloadMetadata);

    // 5. Store in LRU cache
    const cacheKey = BrickCache.generateCacheKey(
      target.snapshotId,
      target.visualizationProductId,
      target.productVersion,
      target.brickKey,
      target.representation
    );
    this._cache.set(cacheKey, decoded);

    return decoded;
  }

  /**
   * Requests a brick payload with priority scheduling and caching.
   */
  async requestBrick(
    target: StreamingRequestTarget,
    priority: RequestPriorityScore,
    signal?: AbortSignal
  ): Promise<DecodedBrick> {
    const cacheKey = BrickCache.generateCacheKey(
      target.snapshotId,
      target.visualizationProductId,
      target.productVersion,
      target.brickKey,
      target.representation
    );

    // Check LRU Cache hit
    const cached = this._cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Enqueue via RequestScheduler
    return this._scheduler.schedule(target, priority, signal);
  }

  /**
   * Pre-fetches a brick payload in the background with lower priority.
   */
  prefetchBrick(
    target: StreamingRequestTarget,
    priority: RequestPriorityScore,
    signal?: AbortSignal
  ): Promise<DecodedBrick> {
    return this.requestBrick(target, priority, signal);
  }

  /**
   * Advances the streaming epoch, canceling all pending and inflight requests from previous epochs.
   */
  advanceEpoch(): number {
    return this._scheduler.advanceEpoch();
  }

  /**
   * Gathers comprehensive streaming and cache statistics.
   */
  getStatistics(): StreamerStatistics {
    const sched = this._scheduler.getMetrics();
    const cacheStats = this._cache.getStats();

    return {
      queuedRequestsCount: sched.queuedCount,
      activeDownloadsCount: sched.activeCount,
      inflightDeduplicatedCount: sched.inflightDeduplicatedCount,
      completedRequestsCount: sched.completedCount,
      abortedRequestsCount: sched.abortedCount,
      cacheStats,
    };
  }
}
