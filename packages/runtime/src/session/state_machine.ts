/**
 * @quasar/runtime Runtime State Machine (FSM)
 *
 * Implements 11 lifecycle states conforming to task_07a_preflight.json & APIContracts.md:
 * UNINITIALIZED -> DISCOVERING -> SNAPSHOT_PINNED -> MANIFEST_LOADING -> MANIFEST_READY
 * -> STREAMING -> READY / DEGRADED -> ERROR -> DISPOSING -> DISPOSED
 */

import { InvalidStateTransitionError } from '../errors.ts';
import type { RuntimeEvent, RuntimeState, StateChangeListener, StateTransitionDetail } from '../types.ts';

export interface TransitionRule {
  from: RuntimeState | RuntimeState[] | '*';
  to: RuntimeState;
  event: RuntimeEvent;
}

export const VALID_TRANSITIONS: TransitionRule[] = [
  { from: 'UNINITIALIZED', to: 'DISCOVERING', event: 'START_DISCOVERY' },
  { from: 'DISCOVERING', to: 'SNAPSHOT_PINNED', event: 'PIN_SNAPSHOT' },
  { from: 'SNAPSHOT_PINNED', to: 'MANIFEST_LOADING', event: 'LOAD_MANIFEST' },
  { from: 'MANIFEST_LOADING', to: 'MANIFEST_READY', event: 'MANIFEST_PARSED' },
  { from: 'MANIFEST_READY', to: 'STREAMING', event: 'START_STREAMING' },
  { from: 'STREAMING', to: 'READY', event: 'STREAMING_SETTLED' },
  { from: 'STREAMING', to: 'DEGRADED', event: 'FALLBACK_LOD_AVAILABLE' },
  { from: 'DEGRADED', to: 'READY', event: 'LOD_REFINED' },
  { from: ['STREAMING', 'READY', 'DEGRADED'], to: 'STREAMING', event: 'VIEWPORT_CHANGED' },
  { from: ['DISCOVERING', 'MANIFEST_LOADING', 'STREAMING', 'READY', 'DEGRADED'], to: 'ERROR', event: 'FATAL_ERROR' },
  { from: 'ERROR', to: 'MANIFEST_READY', event: 'RETRY_STREAMING' },
  { from: '*', to: 'DISPOSING', event: 'DISPOSE' },
  { from: 'DISPOSING', to: 'DISPOSED', event: 'DISPOSAL_COMPLETE' },
];

export class RuntimeStateMachine {
  private _state: RuntimeState = 'UNINITIALIZED';
  private _listeners: Set<StateChangeListener> = new Set();
  private _history: StateTransitionDetail[] = [];
  private _lastError: Error | null = null;

  get state(): RuntimeState {
    return this._state;
  }

  get history(): readonly StateTransitionDetail[] {
    return this._history;
  }

  get lastError(): Error | null {
    return this._lastError;
  }

  get isTerminal(): boolean {
    return this._state === 'DISPOSED';
  }

  get isReadyOrDegraded(): boolean {
    return this._state === 'READY' || this._state === 'DEGRADED';
  }

  /**
   * Subscribe to state transition events.
   * Returns an unsubscribe function.
   */
  subscribe(listener: StateChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Evaluate whether a transition is valid from current state via event.
   */
  canTransition(event: RuntimeEvent): boolean {
    if (this._state === 'DISPOSED') {
      return false; // Terminal state cannot transition anywhere
    }

    return VALID_TRANSITIONS.some((rule) => {
      if (rule.event !== event) return false;
      if (rule.from === '*') {
        return this._state !== 'DISPOSED' && this._state !== 'DISPOSING';
      }
      if (Array.isArray(rule.from)) {
        return rule.from.includes(this._state);
      }
      return rule.from === this._state;
    });
  }

  /**
   * Execute state transition. Throws InvalidStateTransitionError if illegal.
   */
  transition(event: RuntimeEvent, reason?: string, error?: Error): RuntimeState {
    if (this._state === 'DISPOSED') {
      throw new InvalidStateTransitionError(this._state, 'UNKNOWN', event);
    }

    const matchingRule = VALID_TRANSITIONS.find((rule) => {
      if (rule.event !== event) return false;
      if (rule.from === '*') {
        return this._state !== 'DISPOSED' && this._state !== 'DISPOSING';
      }
      if (Array.isArray(rule.from)) {
        return rule.from.includes(this._state);
      }
      return rule.from === this._state;
    });

    if (!matchingRule) {
      throw new InvalidStateTransitionError(this._state, 'TARGET_UNDEFINED', event);
    }

    const previousState = this._state;
    const targetState = matchingRule.to;

    this._state = targetState;
    if (error) {
      this._lastError = error;
    } else if (targetState !== 'ERROR') {
      this._lastError = null;
    }

    const transitionDetail: StateTransitionDetail = {
      from: previousState,
      to: targetState,
      event,
      timestampMs: Date.now(),
      reason,
      error,
    };

    this._history.push(transitionDetail);

    // Notify all registered subscribers
    for (const listener of this._listeners) {
      try {
        listener(transitionDetail);
      } catch (err) {
        console.error('Error in state machine transition listener:', err);
      }
    }

    return targetState;
  }

  /**
   * Reset state machine to UNINITIALIZED (only if not disposed).
   */
  reset(): void {
    if (this._state === 'DISPOSED') {
      throw new InvalidStateTransitionError(this._state, 'UNINITIALIZED', 'RESET_REJECTED');
    }
    this._state = 'UNINITIALIZED';
    this._lastError = null;
  }
}
