/**
 * @quasar/runtime Vertical Exaggeration Controller
 *
 * Implements:
 * 1. Physical and visual vertical exaggeration scaling (10x to 100x).
 * 2. Synchronized scaling of 3D volume bounding box and seafloor bathymetry elevation.
 * 3. Subscription listener support for UI controls and renderers.
 */

export interface VerticalExaggerationState {
  factor: number;        // e.g. 10.0 to 100.0
  minFactor: number;     // 10.0
  maxFactor: number;     // 100.0
  defaultFactor: number; // 25.0
  normalizedScaleZ: number; // Factor scaled relative to 50x standard
}

export type VerticalExaggerationListener = (state: VerticalExaggerationState) => void;

export class VerticalExaggerationController {
  private _factor: number;
  private readonly _minFactor: number = 10.0;
  private readonly _maxFactor: number = 100.0;
  private readonly _defaultFactor: number = 25.0;
  private _listeners: Set<VerticalExaggerationListener> = new Set();

  constructor(initialFactor = 25.0, minFactor = 10.0, maxFactor = 100.0) {
    this._minFactor = minFactor;
    this._maxFactor = maxFactor;
    this._defaultFactor = initialFactor;
    this._factor = Math.max(minFactor, Math.min(maxFactor, initialFactor));
  }

  get state(): VerticalExaggerationState {
    return {
      factor: this._factor,
      minFactor: this._minFactor,
      maxFactor: this._maxFactor,
      defaultFactor: this._defaultFactor,
      normalizedScaleZ: this._factor / 50.0,
    };
  }

  get factor(): number {
    return this._factor;
  }

  setFactor(val: number): void {
    const clamped = Math.max(this._minFactor, Math.min(this._maxFactor, val));
    if (clamped !== this._factor) {
      this._factor = clamped;
      this._notify();
    }
  }

  resetToDefault(): void {
    this.setFactor(this._defaultFactor);
  }

  subscribe(listener: VerticalExaggerationListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    const s = this.state;
    for (const listener of this._listeners) {
      try {
        listener(s);
      } catch (err) {
        console.error('Error in VerticalExaggeration listener:', err);
      }
    }
  }
}
