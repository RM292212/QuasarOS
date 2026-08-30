/**
 * QuasarOS Priority Queue and Request Scheduler.
 *
 * Implements:
 * - 6-tier distance-weighted priority queue (LOD level, viewport visibility, camera distance, temporal distance).
 * - Bounded concurrency pool (default max 6 active concurrent HTTP downloads).
 * - Inflight request deduplication (coalesces parallel requests for identical brick cache keys).
 * - Epoch-based and signal-based AbortController cancellation (cleans up obsolete requests on camera movement or time scrubbing).
 */

import { NetworkAbortError } from '../errors.ts';
import type { DecodedBrick, QueuedBrickRequest, RequestPriorityScore, StreamingRequestTarget } from './types.ts';

export const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 6;

export class RequestScheduler {
  private readonly _maxConcurrency: number;
  private _activeCount = 0;
  private _currentEpoch = 0;

  private _queue: QueuedBrickRequest[] = [];
  /** Map of cacheKey -> active / pending Promise sharing the same inflight work */
  private _inflightPromises = new Map<string, Promise<DecodedBrick>>();
  private _inflightAbortControllers = new Map<string, AbortController>();

  private _inflightDeduplicatedCount = 0;
  private _completedRequestsCount = 0;
  private _abortedRequestsCount = 0;

  private readonly _workerFn: (target: StreamingRequestTarget, signal: AbortSignal) => Promise<DecodedBrick>;

  constructor(
    workerFn: (target: StreamingRequestTarget, signal: AbortSignal) => Promise<DecodedBrick>,
    maxConcurrency = DEFAULT_MAX_CONCURRENT_DOWNLOADS
  ) {
    this._workerFn = workerFn;
    this._maxConcurrency = Math.max(1, maxConcurrency);
  }

  /**
   * Computes deterministic composite priority score.
   * Higher score = higher priority in queue.
   */
  static calculatePriorityScore(
    lodLevel: number,
    isVisibleInViewport: boolean,
    cameraDistance: number,
    temporalDistance: number
  ): RequestPriorityScore {
    // Priority weights:
    // 1. Viewport visibility (+10000)
    // 2. LOD level (finer LOD = lower number, weight: (10 - lod) * 1000)
    // 3. Temporal distance (closer in time = higher priority: - temporalDistance * 500)
    // 4. Camera distance (closer in space = higher priority: - cameraDistance * 10)
    let score = 0;
    if (isVisibleInViewport) {
      score += 10000;
    }
    score += Math.max(0, 10 - lodLevel) * 1000;
    score -= Math.max(0, temporalDistance) * 500;
    score -= Math.max(0, cameraDistance) * 10;

    return {
      lodLevel,
      isVisibleInViewport,
      cameraDistance,
      temporalDistance,
      compositeScore: score,
    };
  }

  /**
   * Generates a request cache key for inflight deduplication.
   */
  private _makeInflightKey(target: StreamingRequestTarget): string {
    return `${target.snapshotId}:${target.visualizationProductId}:${target.productVersion}:${target.brickKey}:${target.representation}`;
  }

  /**
   * Enqueues or joins an existing request for a brick payload.
   */
  schedule(
    target: StreamingRequestTarget,
    priority: RequestPriorityScore,
    parentSignal?: AbortSignal
  ): Promise<DecodedBrick> {
    const inflightKey = this._makeInflightKey(target);

    // Inflight deduplication: return existing inflight promise if active
    if (this._inflightPromises.has(inflightKey)) {
      this._inflightDeduplicatedCount++;
      return this._inflightPromises.get(inflightKey)!;
    }

    const abortController = new AbortController();
    const currentEpoch = this._currentEpoch;

    if (parentSignal) {
      if (parentSignal.aborted) {
        return Promise.reject(new NetworkAbortError(`Request for brick '${target.brickKey}' was already aborted.`));
      }
      parentSignal.addEventListener('abort', () => {
        abortController.abort();
        this._removeQueuedRequest(target.brickKey, currentEpoch);
      });
    }

    const promise = new Promise<DecodedBrick>((resolve, reject) => {
      const queuedItem: QueuedBrickRequest = {
        id: `${target.brickKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        target,
        priority,
        epoch: currentEpoch,
        createdAtMs: Date.now(),
        abortController,
        resolve: (brick) => {
          this._inflightPromises.delete(inflightKey);
          this._inflightAbortControllers.delete(inflightKey);
          this._completedRequestsCount++;
          resolve(brick);
        },
        reject: (reason) => {
          this._inflightPromises.delete(inflightKey);
          this._inflightAbortControllers.delete(inflightKey);
          if (reason instanceof NetworkAbortError || (reason && (reason as { name?: string }).name === 'AbortError')) {
            this._abortedRequestsCount++;
          }
          reject(reason);
        },
      };

      this._queue.push(queuedItem);
      this._sortQueue();
      this._processNext();
    });

    this._inflightPromises.set(inflightKey, promise);
    this._inflightAbortControllers.set(inflightKey, abortController);

    return promise;
  }

  /**
   * Sorts queue in descending order of composite priority score.
   */
  private _sortQueue(): void {
    this._queue.sort((a, b) => b.priority.compositeScore - a.priority.compositeScore);
  }

  /**
   * Dispatches next requests from queue up to max concurrency.
   */
  private _processNext(): void {
    while (this._activeCount < this._maxConcurrency && this._queue.length > 0) {
      const item = this._queue.shift();
      if (!item) break;

      // Check if item was already aborted while in queue
      if (item.abortController.signal.aborted) {
        item.reject(new NetworkAbortError(`Request for brick '${item.target.brickKey}' was aborted in queue.`));
        continue;
      }

      this._activeCount++;
      this._workerFn(item.target, item.abortController.signal)
        .then((brick) => {
          this._activeCount--;
          item.resolve(brick);
          this._processNext();
        })
        .catch((err) => {
          this._activeCount--;
          item.reject(err);
          this._processNext();
        });
    }
  }

  /**
   * Removes a queued request if aborted before execution.
   */
  private _removeQueuedRequest(brickKey: string, epoch: number): void {
    const idx = this._queue.findIndex((item) => item.target.brickKey === brickKey && item.epoch === epoch);
    if (idx !== -1) {
      const [item] = this._queue.splice(idx, 1);
      item.reject(new NetworkAbortError(`Request for brick '${brickKey}' was canceled.`));
    }
  }

  /**
   * Advances the scheduler epoch, canceling all pending and inflight requests from previous epochs.
   * Useful when user fast-scrubs time or flies camera to an entirely different ROI.
   */
  advanceEpoch(): number {
    this._currentEpoch++;
    const oldEpoch = this._currentEpoch - 1;

    // Abort all queued items from old epochs
    const remainingQueue: QueuedBrickRequest[] = [];
    for (const item of this._queue) {
      if (item.epoch <= oldEpoch) {
        item.abortController.abort();
        item.reject(new NetworkAbortError(`Request for brick '${item.target.brickKey}' superseded by epoch advance.`));
      } else {
        remainingQueue.push(item);
      }
    }
    this._queue = remainingQueue;

    // Abort all inflight requests
    for (const [, controller] of this._inflightAbortControllers.entries()) {
      controller.abort();
    }
    this._inflightAbortControllers.clear();
    this._inflightPromises.clear();

    return this._currentEpoch;
  }

  /**
   * Returns current scheduler queue and pool metrics.
   */
  getMetrics() {
    return {
      queuedCount: this._queue.length,
      activeCount: this._activeCount,
      inflightDeduplicatedCount: this._inflightDeduplicatedCount,
      completedCount: this._completedRequestsCount,
      abortedCount: this._abortedRequestsCount,
      currentEpoch: this._currentEpoch,
    };
  }
}
