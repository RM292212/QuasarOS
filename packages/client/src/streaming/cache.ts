/**
 * QuasarOS Bounded In-Memory LRU Cache for Decoded Bricks.
 *
 * Provides:
 * - Thread-safe synchronous / async access keyed by immutable composite cache key.
 * - Strict memory accounting based on DecodedBrick memory footprint.
 * - Automatic least-recently-used eviction when byte budget is exceeded.
 * - Explicit cache key format: `${snapshotId}:${productId}:${productVersion}:${brickKey}:${representation}`
 */

import type { BrickRepresentation } from '../types.ts';
import type { CacheStatistics, DecodedBrick } from './types.ts';

export const DEFAULT_MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50.0 MiB

export class BrickCache {
  private readonly _maxSizeBytes: number;
  private _currentSizeBytes = 0;
  private readonly _cache = new Map<string, DecodedBrick>();

  private _hitCount = 0;
  private _missCount = 0;
  private _evictionCount = 0;

  constructor(maxSizeBytes: number = DEFAULT_MAX_CACHE_SIZE_BYTES) {
    this._maxSizeBytes = Math.max(1, maxSizeBytes);
  }

  /**
   * Generates deterministic immutable composite cache key.
   */
  static generateCacheKey(
    snapshotId: string,
    productId: string,
    productVersion: string,
    brickKey: string,
    representation: BrickRepresentation
  ): string {
    return `${snapshotId}:${productId}:${productVersion}:${brickKey}:${representation}`;
  }

  /**
   * Checks if a brick exists in cache without updating its LRU position.
   */
  has(key: string): boolean {
    return this._cache.has(key);
  }

  /**
   * Retrieves a decoded brick from the cache and updates its LRU position.
   */
  get(key: string): DecodedBrick | undefined {
    const item = this._cache.get(key);
    if (!item) {
      this._missCount++;
      return undefined;
    }

    // Refresh LRU order by deleting and re-inserting at the end of the Map
    this._cache.delete(key);
    this._cache.set(key, item);
    this._hitCount++;
    return item;
  }

  /**
   * Inserts or updates a decoded brick in the cache, evicting oldest items if necessary.
   */
  set(key: string, brick: DecodedBrick): void {
    // If existing item is being replaced, decrement old memory size
    const existing = this._cache.get(key);
    if (existing) {
      this._currentSizeBytes -= existing.memorySizeBytes;
      this._cache.delete(key);
    }

    const brickSize = brick.memorySizeBytes;

    // If a single brick is larger than max capacity, don't store it
    if (brickSize > this._maxSizeBytes) {
      return;
    }

    // Evict items until enough room is available
    while (this._currentSizeBytes + brickSize > this._maxSizeBytes && this._cache.size > 0) {
      const oldestKey = this._cache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldestItem = this._cache.get(oldestKey);
        if (oldestItem) {
          this._currentSizeBytes -= oldestItem.memorySizeBytes;
        }
        this._cache.delete(oldestKey);
        this._evictionCount++;
      } else {
        break;
      }
    }

    this._cache.set(key, brick);
    this._currentSizeBytes += brickSize;
  }

  /**
   * Deletes a specific brick from cache.
   */
  delete(key: string): boolean {
    const item = this._cache.get(key);
    if (item) {
      this._currentSizeBytes -= item.memorySizeBytes;
      this._cache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this._cache.clear();
    this._currentSizeBytes = 0;
  }

  /**
   * Returns current cache statistics.
   */
  getStats(): CacheStatistics {
    const totalLookups = this._hitCount + this._missCount;
    const hitRatePercent = totalLookups > 0 ? (this._hitCount / totalLookups) * 100 : 0.0;

    return {
      entryCount: this._cache.size,
      currentSizeBytes: this._currentSizeBytes,
      maxSizeBytes: this._maxSizeBytes,
      hitCount: this._hitCount,
      missCount: this._missCount,
      evictionCount: this._evictionCount,
      hitRatePercent,
    };
  }
}
