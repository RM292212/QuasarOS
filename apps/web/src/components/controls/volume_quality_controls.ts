/**
 * Volume Quality & Render Options Controls Controller
 *
 * Implements:
 * - Sampling density step size multiplier (e.g. 0.25x to 4.0x, default 1.0x)
 * - Base raymarch step size & reference step size calculation
 * - Opacity multiplier (0.1x to 5.0x, default 1.0x)
 * - Bounding box toggle (show/hide spatial wireframe bounds)
 * - Early ray termination threshold (0.90 to 0.999)
 * - Maximum ray steps clamp (64 to 2048)
 */

export interface VolumeQualitySettings {
  stepSizeMultiplier: number;     // 0.25 to 4.0 (higher = finer step, lower stepSize)
  baseStepSize: number;           // base step in normalized volume space, default 0.005
  referenceStepSize: number;      // reference step for opacity correction, default 0.005
  opacityMultiplier: number;      // 0.1 to 5.0
  showBoundingBox: boolean;       // boolean toggle
  earlyTerminationAlpha: number;  // 0.90 to 0.999, default 0.99
  maxSteps: number;               // 64 to 2048, default 512
}

export type VolumeQualityChangeListener = (settings: VolumeQualitySettings) => void;

export class VolumeQualityModel {
  private _settings: VolumeQualitySettings;
  private _listeners: Set<VolumeQualityChangeListener> = new Set();

  constructor(initialSettings?: Partial<VolumeQualitySettings>) {
    this._settings = {
      stepSizeMultiplier: initialSettings?.stepSizeMultiplier ?? 1.0,
      baseStepSize: initialSettings?.baseStepSize ?? 0.005,
      referenceStepSize: initialSettings?.referenceStepSize ?? 0.005,
      opacityMultiplier: initialSettings?.opacityMultiplier ?? 1.0,
      showBoundingBox: initialSettings?.showBoundingBox ?? true,
      earlyTerminationAlpha: initialSettings?.earlyTerminationAlpha ?? 0.99,
      maxSteps: initialSettings?.maxSteps ?? 512,
    };
    this._validate();
  }

  get settings(): VolumeQualitySettings {
    return { ...this._settings };
  }

  get effectiveStepSize(): number {
    // stepSize is inversely proportional to sampling density multiplier
    return this._settings.baseStepSize / Math.max(0.1, this._settings.stepSizeMultiplier);
  }

  setStepSizeMultiplier(multiplier: number): void {
    if (multiplier <= 0.0) {
      throw new Error(`Step size multiplier must be positive, got ${multiplier}`);
    }
    this._settings.stepSizeMultiplier = Math.max(0.1, Math.min(10.0, multiplier));
    this._notify();
  }

  setOpacityMultiplier(multiplier: number): void {
    if (multiplier <= 0.0) {
      throw new Error(`Opacity multiplier must be positive, got ${multiplier}`);
    }
    this._settings.opacityMultiplier = Math.max(0.05, Math.min(10.0, multiplier));
    this._notify();
  }

  setBoundingBoxVisible(visible: boolean): void {
    this._settings.showBoundingBox = visible;
    this._notify();
  }

  setEarlyTerminationAlpha(alpha: number): void {
    if (alpha <= 0.0 || alpha >= 1.0) {
      throw new Error(`Early termination alpha must be in (0.0, 1.0), got ${alpha}`);
    }
    this._settings.earlyTerminationAlpha = alpha;
    this._notify();
  }

  setMaxSteps(steps: number): void {
    if (steps < 16) {
      throw new Error(`Max steps must be at least 16, got ${steps}`);
    }
    this._settings.maxSteps = Math.round(steps);
    this._notify();
  }

  resetDefaults(): void {
    this._settings = {
      stepSizeMultiplier: 1.0,
      baseStepSize: 0.005,
      referenceStepSize: 0.005,
      opacityMultiplier: 1.0,
      showBoundingBox: true,
      earlyTerminationAlpha: 0.99,
      maxSteps: 512,
    };
    this._notify();
  }

  subscribe(listener: VolumeQualityChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _validate(): void {
    if (this._settings.stepSizeMultiplier <= 0) this._settings.stepSizeMultiplier = 1.0;
    if (this._settings.opacityMultiplier <= 0) this._settings.opacityMultiplier = 1.0;
  }

  private _notify(): void {
    const s = this.settings;
    for (const listener of this._listeners) {
      try {
        listener(s);
      } catch (err) {
        console.error('Error in VolumeQualityModel listener:', err);
      }
    }
  }
}
