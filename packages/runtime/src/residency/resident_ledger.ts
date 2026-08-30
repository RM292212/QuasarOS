/**
 * @quasar/runtime Resident Brick Ledger & Memory Coordinator
 *
 * Tracks fine-grained lifecycle states for sub-volume bricks:
 * - REQUESTED: Enqueued in streaming scheduler
 * - STREAMING: Currently downloading or decompressing
 * - RESIDENT: Fully decoded in LRU cache and ready for GPU texture upload
 * - EVICTED: Pruned from cache due to memory budget or camera divergence
 * - FAILED: Download/integrity/decompression failure
 *
 * Coordinates zero-copy decoded references with `@quasar/client` BrickCache and
 * protects visible fallback parent bricks from premature eviction while fine LOD is pending.
 */

import type { DecodedBrick, BrickRepresentation } from '@quasar/client';

export type BrickResidencyState =
  | 'REQUESTED'
  | 'STREAMING'
  | 'RESIDENT'
  | 'EVICTED'
  | 'FAILED';

export interface ResidentBrickRecord {
  brickKey: string;
  lodLevel: number;
  timestepIndex: number;
  representation: BrickRepresentation;
  state: BrickResidencyState;
  memorySizeBytes: number;
  decodedBrick?: DecodedBrick;
  requestedAtMs: number;
  loadedAtMs?: number;
  lastUsedAtMs: number;
  isPinnedFallback: boolean; // Protects fallback parent from eviction
  error?: Error;
}

export interface ResidencyLedgerConfig {
  /** Maximum memory budget in bytes (default 50.0 MiB = 52,428,800 bytes) */
  maxMemoryBudgetBytes?: number;
}

export interface ResidencyMemoryReport {
  totalBudgetBytes: number;
  allocatedBytes: number;
  availableBytes: number;
  residentBricksCount: number;
  streamingBricksCount: number;
  requestedBricksCount: number;
  pinnedFallbackCount: number;
  utilizationPercent: number;
}

export class ResidentBrickLedger {
  private readonly _maxBudgetBytes: number;
  private _allocatedBytes = 0;
  private readonly _records = new Map<string, ResidentBrickRecord>();

  constructor(config: ResidencyLedgerConfig = {}) {
    this._maxBudgetBytes = Math.max(1, config.maxMemoryBudgetBytes ?? 50 * 1024 * 1024);
  }

  get maxBudgetBytes(): number {
    return this._maxBudgetBytes;
  }

  get allocatedBytes(): number {
    return this._allocatedBytes;
  }

  get records(): ReadonlyMap<string, ResidentBrickRecord> {
    return this._records;
  }

  /**
   * Generates ledger record key.
   */
  static generateRecordKey(brickKey: string, representation: BrickRepresentation): string {
    return `${brickKey}:${representation}`;
  }

  /**
   * Retrieves record if present.
   */
  getRecord(brickKey: string, representation: BrickRepresentation = 'f16'): ResidentBrickRecord | undefined {
    return this._records.get(ResidentBrickLedger.generateRecordKey(brickKey, representation));
  }

  /**
   * Checks if brick is currently resident and decoded.
   */
  isResident(brickKey: string, representation: BrickRepresentation = 'f16'): boolean {
    const rec = this.getRecord(brickKey, representation);
    return rec !== undefined && rec.state === 'RESIDENT' && rec.decodedBrick !== undefined;
  }

  /**
   * Marks a brick as REQUESTED.
   */
  markRequested(
    brickKey: string,
    lodLevel: number,
    timestepIndex: number,
    representation: BrickRepresentation = 'f16'
  ): ResidentBrickRecord {
    const key = ResidentBrickLedger.generateRecordKey(brickKey, representation);
    let rec = this._records.get(key);
    const now = Date.now();

    if (!rec) {
      rec = {
        brickKey,
        lodLevel,
        timestepIndex,
        representation,
        state: 'REQUESTED',
        memorySizeBytes: 0,
        requestedAtMs: now,
        lastUsedAtMs: now,
        isPinnedFallback: false,
      };
      this._records.set(key, rec);
    } else {
      rec.state = 'REQUESTED';
      rec.requestedAtMs = now;
      rec.lastUsedAtMs = now;
      rec.error = undefined;
    }

    return rec;
  }

  /**
   * Marks a brick as STREAMING.
   */
  markStreaming(brickKey: string, representation: BrickRepresentation = 'f16'): void {
    const rec = this.getRecord(brickKey, representation);
    if (rec) {
      rec.state = 'STREAMING';
      rec.lastUsedAtMs = Date.now();
    }
  }

  /**
   * Registers a decoded brick as RESIDENT, updating byte allocation and LRU timestamp.
   */
  registerResident(
    brickKey: string,
    decoded: DecodedBrick,
    representation: BrickRepresentation = 'f16'
  ): ResidentBrickRecord {
    const key = ResidentBrickLedger.generateRecordKey(brickKey, representation);
    let rec = this._records.get(key);
    const now = Date.now();

    if (rec && rec.state === 'RESIDENT' && rec.decodedBrick) {
      // Re-registering existing resident brick
      this._allocatedBytes -= rec.memorySizeBytes;
    }

    const brickBytes = decoded.memorySizeBytes;

    if (!rec) {
      rec = {
        brickKey,
        lodLevel: 0,
        timestepIndex: 0,
        representation,
        state: 'RESIDENT',
        memorySizeBytes: brickBytes,
        decodedBrick: decoded,
        requestedAtMs: now,
        loadedAtMs: now,
        lastUsedAtMs: now,
        isPinnedFallback: false,
      };
      this._records.set(key, rec);
    } else {
      rec.state = 'RESIDENT';
      rec.memorySizeBytes = brickBytes;
      rec.decodedBrick = decoded;
      rec.loadedAtMs = now;
      rec.lastUsedAtMs = now;
      rec.error = undefined;
    }

    this._allocatedBytes += brickBytes;
    return rec;
  }

  /**
   * Marks a brick as FAILED with the encountered error.
   */
  markFailed(brickKey: string, error: Error, representation: BrickRepresentation = 'f16'): void {
    const rec = this.getRecord(brickKey, representation);
    if (rec) {
      if (rec.state === 'RESIDENT' && rec.decodedBrick) {
        this._allocatedBytes -= rec.memorySizeBytes;
        rec.decodedBrick = undefined;
        rec.memorySizeBytes = 0;
      }
      rec.state = 'FAILED';
      rec.error = error;
      rec.lastUsedAtMs = Date.now();
    }
  }

  /**
   * Pins or unpins a coarser fallback parent brick to protect it from LRU eviction.
   */
  setPinnedFallback(brickKey: string, isPinned: boolean, representation: BrickRepresentation = 'f16'): void {
    const rec = this.getRecord(brickKey, representation);
    if (rec) {
      rec.isPinnedFallback = isPinned;
    }
  }

  /**
   * Evicts unpinned resident bricks to stay within maximum budget.
   * Returns list of evicted brick keys.
   */
  evictExcess(targetExtraBytes = 0): string[] {
    const requiredFree = Math.max(0, this._allocatedBytes + targetExtraBytes - this._maxBudgetBytes);
    if (requiredFree <= 0) {
      return [];
    }

    // Collect candidate unpinned resident records sorted by lastUsedAtMs ascending (LRU)
    const candidates: ResidentBrickRecord[] = [];
    for (const rec of this._records.values()) {
      if (rec.state === 'RESIDENT' && !rec.isPinnedFallback && rec.decodedBrick) {
        candidates.push(rec);
      }
    }

    candidates.sort((a, b) => a.lastUsedAtMs - b.lastUsedAtMs);

    let freed = 0;
    const evictedKeys: string[] = [];

    for (const cand of candidates) {
      if (freed >= requiredFree) {
        break;
      }
      freed += cand.memorySizeBytes;
      this._allocatedBytes -= cand.memorySizeBytes;
      cand.state = 'EVICTED';
      cand.decodedBrick = undefined;
      cand.memorySizeBytes = 0;
      evictedKeys.push(cand.brickKey);
    }

    return evictedKeys;
  }

  /**
   * Produces a diagnostic summary of memory consumption and brick states.
   */
  getMemoryReport(): ResidencyMemoryReport {
    let residentCount = 0;
    let streamingCount = 0;
    let requestedCount = 0;
    let pinnedCount = 0;

    for (const rec of this._records.values()) {
      if (rec.state === 'RESIDENT') residentCount++;
      else if (rec.state === 'STREAMING') streamingCount++;
      else if (rec.state === 'REQUESTED') requestedCount++;

      if (rec.isPinnedFallback) pinnedCount++;
    }

    const availableBytes = Math.max(0, this._maxBudgetBytes - this._allocatedBytes);
    const utilizationPercent = (this._allocatedBytes / this._maxBudgetBytes) * 100.0;

    return {
      totalBudgetBytes: this._maxBudgetBytes,
      allocatedBytes: this._allocatedBytes,
      availableBytes,
      residentBricksCount: residentCount,
      streamingBricksCount: streamingCount,
      requestedBricksCount: requestedCount,
      pinnedFallbackCount: pinnedCount,
      utilizationPercent,
    };
  }
}
