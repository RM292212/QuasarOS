/**
 * @quasar/runtime Temporal Controller
 *
 * Implements discrete multi-day (e.g. 7-day) timestep scrubbing,
 * active generation tracking, stale request cancellation tokens (AbortController),
 * and generation epoch tagging to prevent race conditions on fast scrubbing.
 */

import { CoordinateBoundsError, StaleTemporalRequestError } from '../errors.ts';
import type { TemporalState, TimestepMetadata } from '../types.ts';

export type TemporalChangeListener = (state: TemporalState) => void;

export class TemporalController {
  private readonly _timesteps: TimestepMetadata[];
  private _currentIndex: number = 0;
  private _activeGeneration: number = 1;
  private _activeAbortController: AbortController | null = null;
  private _listeners: Set<TemporalChangeListener> = new Set();
  private _isScrubbing: boolean = false;

  constructor(timesteps: TimestepMetadata[] | string[]) {
    if (!timesteps || timesteps.length === 0) {
      throw new CoordinateBoundsError('timesteps', 0, [1, Infinity], 'TemporalController requires at least 1 timestep.');
    }

    if (typeof timesteps[0] === 'string') {
      this._timesteps = (timesteps as string[]).map((timeUtc, index) => ({
        index,
        timeUtc,
        epochMs: new Date(timeUtc).getTime(),
        stepName: `t${index}`,
      }));
    } else {
      this._timesteps = [...(timesteps as TimestepMetadata[])];
    }
  }

  get totalTimesteps(): number {
    return this._timesteps.length;
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get currentTimestep(): TimestepMetadata {
    return this._timesteps[this._currentIndex];
  }

  get activeGeneration(): number {
    return this._activeGeneration;
  }

  get isScrubbing(): boolean {
    return this._isScrubbing;
  }

  get timesteps(): readonly TimestepMetadata[] {
    return this._timesteps;
  }

  getState(): TemporalState {
    return {
      currentIndex: this._currentIndex,
      currentTimeUtc: this._timesteps[this._currentIndex].timeUtc,
      activeGeneration: this._activeGeneration,
      totalTimesteps: this._timesteps.length,
      timesteps: this._timesteps,
      isScrubbing: this._isScrubbing,
    };
  }

  /**
   * Subscribe to temporal state changes.
   */
  subscribe(listener: TemporalChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Select a timestep index (0 to totalTimesteps - 1).
   * Advances generation, cancels inflight stale streaming requests, and notifies listeners.
   *
   * @param index Target timestep index
   * @returns The newly created AbortSignal for this generation
   */
  setTimestepIndex(index: number): AbortSignal {
    if (index < 0 || index >= this._timesteps.length) {
      throw new CoordinateBoundsError('timestepIndex', index, [0, this._timesteps.length - 1]);
    }

    // Cancel existing inflight requests from previous generation
    if (this._activeAbortController) {
      this._activeAbortController.abort(`Superseded by temporal generation ${this._activeGeneration + 1}`);
    }

    this._currentIndex = index;
    this._activeGeneration += 1;
    this._activeAbortController = new AbortController();

    this._notify();
    return this._activeAbortController.signal;
  }

  /**
   * Begin interactive scrubbing.
   */
  beginScrubbing(): void {
    this._isScrubbing = true;
    this._notify();
  }

  /**
   * End interactive scrubbing.
   */
  endScrubbing(): void {
    this._isScrubbing = false;
    this._notify();
  }

  /**
   * Step to next timestep.
   */
  next(): AbortSignal {
    const nextIdx = (this._currentIndex + 1) % this._timesteps.length;
    return this.setTimestepIndex(nextIdx);
  }

  /**
   * Step to previous timestep.
   */
  previous(): AbortSignal {
    const prevIdx = (this._currentIndex - 1 + this._timesteps.length) % this._timesteps.length;
    return this.setTimestepIndex(prevIdx);
  }

  /**
   * Validate if a request generation matches current active generation.
   * Throws StaleTemporalRequestError if mismatched.
   */
  assertActiveGeneration(generation: number): void {
    if (generation !== this._activeGeneration) {
      throw new StaleTemporalRequestError(generation, this._activeGeneration);
    }
  }

  /**
   * Check if a generation is still active without throwing.
   */
  isGenerationActive(generation: number): boolean {
    return generation === this._activeGeneration;
  }

  private _notify(): void {
    const state = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in TemporalController listener:', err);
      }
    }
  }
}
