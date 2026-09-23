/**
 * TransferFunctionEditor Controller & State Model
 *
 * Implements:
 * - Colormap selector (Viridis, Plasma, Turbo, Thermal, Coolwarm)
 * - Interactive control points for piecewise linear opacity & color curves
 * - Scalar domain clamps (9.3747°C to 30.3618°C)
 * - Generation of TransferFunctionContract conforming to schemas/canonical/transfer_function.schema.json
 * - Pre-generation of 256-entry lookup tables for GPU upload
 */

import type {
  TransferFunctionContract,
  TransferFunctionControlPoint,
  OutOfRangeRenderingPolicy,
} from '../../../../../packages/contracts/types/quasar_contracts.d.ts';
import { sampleColormap, COLORMAP_REGISTRY, type ColorRGB } from './colormaps.ts';

export interface OpacityControlPoint {
  id: string;
  normalizedScalar: number; // [0.0, 1.0]
  opacity: number;          // [0.0, 1.0]
}

export interface TransferFunctionEditorState {
  colormapName: string;
  domainMin: number; // e.g. 9.3747
  domainMax: number; // e.g. 30.3618
  unit: string;      // e.g. '°C'
  clampedMin: number;
  clampedMax: number;
  outOfRangePolicy: OutOfRangeRenderingPolicy;
  missingValueColorRgba: [number, number, number, number];
  opacityControlPoints: OpacityControlPoint[];
}

export type TransferFunctionChangeListener = (tf: TransferFunctionContract) => void;

export function extractCanonicalVarCode(variable: string): 'thetao' | 'so' | 'speed' | 'uo' | 'vo' | 'zos' | 'unknown' {
  const v = (variable || '').toLowerCase().trim();
  if (v.includes('thetao') || v.includes('temp')) return 'thetao';
  if (v.includes('so') || v.includes('salin')) return 'so';
  if (v.includes('speed') || v.includes('magnitude') || v === 'velocity') return 'speed';
  if (v.includes('uo')) return 'uo';
  if (v.includes('vo')) return 'vo';
  if (v.includes('zos') || v.includes('ssh') || v.includes('height')) return 'zos';
  return 'unknown';
}

export class TransferFunctionModel {
  private _state: TransferFunctionEditorState;
  private _varCode: string = 'thetao';
  private _userCustomizedClamps: boolean = false;
  private _listeners: Set<TransferFunctionChangeListener> = new Set();

  constructor(initialState?: Partial<TransferFunctionEditorState>) {
    const domainMin = initialState?.domainMin ?? 9.374713;
    const domainMax = initialState?.domainMax ?? 30.361834;
    const clampedMin = initialState?.clampedMin ?? domainMin;
    const clampedMax = initialState?.clampedMax ?? domainMax;

    this._state = {
      colormapName: initialState?.colormapName ?? 'viridis',
      domainMin,
      domainMax,
      unit: initialState?.unit ?? '°C',
      clampedMin: Math.max(domainMin, Math.min(domainMax, clampedMin)),
      clampedMax: Math.min(domainMax, Math.max(domainMin, clampedMax)),
      outOfRangePolicy: initialState?.outOfRangePolicy ?? 'discard_transparent',
      missingValueColorRgba: initialState?.missingValueColorRgba ?? [0, 0, 0, 0],
      opacityControlPoints: initialState?.opacityControlPoints ?? [
        { id: 'cp-0', normalizedScalar: 0.0, opacity: 0.0 },
        { id: 'cp-1', normalizedScalar: 0.25, opacity: 0.15 },
        { id: 'cp-2', normalizedScalar: 0.5, opacity: 0.4 },
        { id: 'cp-3', normalizedScalar: 0.75, opacity: 0.7 },
        { id: 'cp-4', normalizedScalar: 1.0, opacity: 0.95 },
      ],
    };

    this._sortAndValidatePoints();
  }

  get state(): TransferFunctionEditorState {
    return {
      ...this._state,
      opacityControlPoints: this._state.opacityControlPoints.map((cp) => ({ ...cp })),
      missingValueColorRgba: [...this._state.missingValueColorRgba],
    };
  }

  get colormapName(): string {
    return this._state.colormapName;
  }

  get domainMin(): number {
    return this._state.domainMin;
  }

  get domainMax(): number {
    return this._state.domainMax;
  }

  get clampedMin(): number {
    return this._state.clampedMin;
  }

  get clampedMax(): number {
    return this._state.clampedMax;
  }

  get unit(): string {
    return this._state.unit;
  }

  get varCode(): string {
    return this._varCode;
  }

  setColormap(presetKey: string): void {
    const key = presetKey.toLowerCase();
    if (!COLORMAP_REGISTRY[key]) {
      throw new Error(`Unsupported colormap preset: ${presetKey}. Supported: ${Object.keys(COLORMAP_REGISTRY).join(', ')}`);
    }
    this._state.colormapName = key;
    this._notify();
  }

  setClamps(min: number, max: number): void {
    if (min > max) {
      throw new Error(`Clamped min (${min}) cannot exceed clamped max (${max}).`);
    }
    const EPS = 1e-4;
    if (min < this._state.domainMin - EPS || max > this._state.domainMax + EPS) {
      throw new Error(
        `Clamps [${min}, ${max}] exceed valid physical domain [${this._state.domainMin}, ${this._state.domainMax}].`
      );
    }
    this._state.clampedMin = Math.max(this._state.domainMin, min);
    this._state.clampedMax = Math.min(this._state.domainMax, max);
    this._userCustomizedClamps = true;
    this._notify();
  }

  setDomain(min: number, max: number, unit: string = '°C'): void {
    if (min >= max) {
      throw new Error(`Domain min (${min}) must be strictly less than domain max (${max}).`);
    }
    this._state.domainMin = min;
    this._state.domainMax = max;
    this._state.unit = unit;
    this._state.clampedMin = Math.max(min, this._state.clampedMin);
    this._state.clampedMax = Math.min(max, this._state.clampedMax);
    this._notify();
  }

  setOutOfRangePolicy(policy: OutOfRangeRenderingPolicy): void {
    this._state.outOfRangePolicy = policy;
    this._notify();
  }

  /**
   * Configures colormap, physical domain, unit, and non-saturating opacity curves
   * for a specific oceanographic variable matching scientific standards and Yu et al. (2025).
   */
  configureForVariable(variable: string, minVal?: number, maxVal?: number): void {
    const prevCanonical = extractCanonicalVarCode(this._varCode);
    const newCanonical = extractCanonicalVarCode(variable);
    const varChanged = prevCanonical !== newCanonical;
    this._varCode = newCanonical !== 'unknown' ? newCanonical : variable.toLowerCase().trim();

    if (varChanged) {
      this._userCustomizedClamps = false;
    }

    const varCode = this._varCode;
    if (varCode === 'thetao') {
      const dMin = minVal !== undefined ? minVal : 1.0;
      const dMax = maxVal !== undefined ? maxVal : 30.5;
      this._state.colormapName = 'thermal';
      this._state.domainMin = dMin;
      this._state.domainMax = dMax;
      if (!this._userCustomizedClamps) {
        this._state.clampedMin = dMin;
        this._state.clampedMax = dMax;
      } else {
        this._state.clampedMin = Math.max(dMin, Math.min(dMax, this._state.clampedMin));
        this._state.clampedMax = Math.min(dMax, Math.max(dMin, this._state.clampedMax));
      }
      this._state.unit = '°C';
      // Scientifically calibrated thermocline transparency:
      // Deep abyssal water (cold < 10°C) is subtly translucent to prevent occluding upper thermal fronts;
      // Thermocline (15°C - 24°C) has distinct gradient opacity;
      // Warm surface mixed layer (>28°C) is prominent and luminous.
      this._state.opacityControlPoints = [
        { id: 'cp-0', normalizedScalar: 0.0, opacity: 0.02 },  // 1.0°C Abyssal cold
        { id: 'cp-1', normalizedScalar: 0.25, opacity: 0.08 }, // ~8.5°C Intermediate deep
        { id: 'cp-2', normalizedScalar: 0.55, opacity: 0.32 }, // ~17.5°C Thermocline
        { id: 'cp-3', normalizedScalar: 0.80, opacity: 0.65 }, // ~25.0°C Subsurface warm
        { id: 'cp-4', normalizedScalar: 1.0, opacity: 0.85 },  // ~31.0°C Tropical surface
      ];
    } else if (varCode === 'so') {
      const dMin = minVal !== undefined ? minVal : 34.5;
      const dMax = maxVal !== undefined ? maxVal : 36.8;
      this._state.colormapName = 'coolwarm';
      this._state.domainMin = dMin;
      this._state.domainMax = dMax;
      if (!this._userCustomizedClamps) {
        this._state.clampedMin = dMin;
        this._state.clampedMax = dMax;
      } else {
        this._state.clampedMin = Math.max(dMin, Math.min(dMax, this._state.clampedMin));
        this._state.clampedMax = Math.min(dMax, Math.max(dMin, this._state.clampedMax));
      }
      this._state.unit = 'PSU';
      this._state.opacityControlPoints = [
        { id: 'cp-0', normalizedScalar: 0.0, opacity: 0.02 },
        { id: 'cp-1', normalizedScalar: 0.3, opacity: 0.15 },
        { id: 'cp-2', normalizedScalar: 0.6, opacity: 0.45 },
        { id: 'cp-3', normalizedScalar: 1.0, opacity: 0.80 },
      ];
    } else if (varCode === 'speed') {
      const dMin = minVal !== undefined ? minVal : 0.0;
      const dMax = maxVal !== undefined ? maxVal : 1.5;
      this._state.colormapName = 'turbo';
      this._state.domainMin = dMin;
      this._state.domainMax = dMax;
      if (!this._userCustomizedClamps) {
        this._state.clampedMin = dMin;
        this._state.clampedMax = dMax;
      } else {
        this._state.clampedMin = Math.max(dMin, Math.min(dMax, this._state.clampedMin));
        this._state.clampedMax = Math.min(dMax, Math.max(dMin, this._state.clampedMax));
      }
      this._state.unit = 'm/s';
      // Current jet prominence curve (Yu et al. 2025):
      // Quiescent ocean water (< 0.12 m/s) is near completely transparent so it never occludes volume
      // Intermediate flows (0.15 - 0.45 m/s) show translucent structure
      // High-speed jet cores (> 0.60 m/s) stand out crisply
      this._state.opacityControlPoints = [
        { id: 'cp-0', normalizedScalar: 0.0, opacity: 0.00 },
        { id: 'cp-1', normalizedScalar: 0.08, opacity: 0.02 },
        { id: 'cp-2', normalizedScalar: 0.25, opacity: 0.20 },
        { id: 'cp-3', normalizedScalar: 0.46, opacity: 0.85 },
        { id: 'cp-4', normalizedScalar: 1.0, opacity: 0.98 },
      ];
    } else if (varCode === 'uo' || varCode === 'vo') {
      const dMin = minVal !== undefined ? minVal : -1.0;
      const dMax = maxVal !== undefined ? maxVal : 1.2;
      this._state.colormapName = 'turbo';
      this._state.domainMin = dMin;
      this._state.domainMax = dMax;
      if (!this._userCustomizedClamps) {
        this._state.clampedMin = dMin;
        this._state.clampedMax = dMax;
      } else {
        this._state.clampedMin = Math.max(dMin, Math.min(dMax, this._state.clampedMin));
        this._state.clampedMax = Math.min(dMax, Math.max(dMin, this._state.clampedMax));
      }
      this._state.unit = 'm/s';
      // High-velocity jet prominence curve (quiescent water near 0 m/s is translucent, strong currents stand out)
      this._state.opacityControlPoints = [
        { id: 'cp-0', normalizedScalar: 0.0, opacity: 0.35 },
        { id: 'cp-1', normalizedScalar: 0.35, opacity: 0.05 },
        { id: 'cp-2', normalizedScalar: 0.50, opacity: 0.02 }, // ~0 m/s quiescent water
        { id: 'cp-3', normalizedScalar: 0.65, opacity: 0.08 },
        { id: 'cp-4', normalizedScalar: 0.85, opacity: 0.55 },
        { id: 'cp-5', normalizedScalar: 1.0, opacity: 0.80 },
      ];
    } else if (varCode === 'zos') {
      const dMin = minVal !== undefined ? minVal : 0.3;
      const dMax = maxVal !== undefined ? maxVal : 0.7;
      this._state.colormapName = 'plasma';
      this._state.domainMin = dMin;
      this._state.domainMax = dMax;
      if (!this._userCustomizedClamps) {
        this._state.clampedMin = dMin;
        this._state.clampedMax = dMax;
      } else {
        this._state.clampedMin = Math.max(dMin, Math.min(dMax, this._state.clampedMin));
        this._state.clampedMax = Math.min(dMax, Math.max(dMin, this._state.clampedMax));
      }
      this._state.unit = 'm';
      this._state.opacityControlPoints = [
        { id: 'cp-0', normalizedScalar: 0.0, opacity: 0.05 },
        { id: 'cp-1', normalizedScalar: 0.5, opacity: 0.40 },
        { id: 'cp-2', normalizedScalar: 1.0, opacity: 0.85 },
      ];
    } else {
      const dMin = minVal !== undefined ? minVal : 0.0;
      const dMax = maxVal !== undefined ? maxVal : 1.0;
      this._state.colormapName = 'viridis';
      this._state.domainMin = dMin;
      this._state.domainMax = dMax;
      if (!this._userCustomizedClamps) {
        this._state.clampedMin = dMin;
        this._state.clampedMax = dMax;
      } else {
        this._state.clampedMin = Math.max(dMin, Math.min(dMax, this._state.clampedMin));
        this._state.clampedMax = Math.min(dMax, Math.max(dMin, this._state.clampedMax));
      }
      this._state.unit = 'units';
      this._state.opacityControlPoints = [
        { id: 'cp-0', normalizedScalar: 0.0, opacity: 0.02 },
        { id: 'cp-1', normalizedScalar: 0.5, opacity: 0.35 },
        { id: 'cp-2', normalizedScalar: 1.0, opacity: 0.80 },
      ];
    }
    this._sortAndValidatePoints();
    this._notify();
  }

  setOpacityControlPoints(points: OpacityControlPoint[]): void {
    if (points.length < 2) {
      throw new Error('Transfer function requires at least 2 control points.');
    }
    this._state.opacityControlPoints = points.map((p) => ({
      id: p.id || `cp-${Math.random().toString(36).slice(2, 7)}`,
      normalizedScalar: Math.max(0.0, Math.min(1.0, p.normalizedScalar)),
      opacity: Math.max(0.0, Math.min(1.0, p.opacity)),
    }));
    this._sortAndValidatePoints();
    this._notify();
  }

  addControlPoint(normalizedScalar: number, opacity: number): string {
    const id = `cp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const point: OpacityControlPoint = {
      id,
      normalizedScalar: Math.max(0.0, Math.min(1.0, normalizedScalar)),
      opacity: Math.max(0.0, Math.min(1.0, opacity)),
    };
    this._state.opacityControlPoints.push(point);
    this._sortAndValidatePoints();
    this._notify();
    return id;
  }

  updateControlPoint(id: string, updates: Partial<Omit<OpacityControlPoint, 'id'>>): void {
    const idx = this._state.opacityControlPoints.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Control point '${id}' not found.`);
    }
    const current = this._state.opacityControlPoints[idx];
    this._state.opacityControlPoints[idx] = {
      id: current.id,
      normalizedScalar: updates.normalizedScalar !== undefined
        ? Math.max(0.0, Math.min(1.0, updates.normalizedScalar))
        : current.normalizedScalar,
      opacity: updates.opacity !== undefined
        ? Math.max(0.0, Math.min(1.0, updates.opacity))
        : current.opacity,
    };
    this._sortAndValidatePoints();
    this._notify();
  }

  removeControlPoint(id: string): void {
    if (this._state.opacityControlPoints.length <= 2) {
      throw new Error('Cannot remove control point: minimum 2 control points required.');
    }
    this._state.opacityControlPoints = this._state.opacityControlPoints.filter((p) => p.id !== id);
    this._sortAndValidatePoints();
    this._notify();
  }

  evaluateScalar(physicalValue: number): { color: ColorRGB; opacity: number; isOutOfRange: boolean } {
    const min = this._state.clampedMin;
    const max = this._state.clampedMax;
    const span = max - min;

    if (physicalValue < min || physicalValue > max) {
      if (this._state.outOfRangePolicy === 'discard_transparent') {
        return { color: { r: 0, g: 0, b: 0 }, opacity: 0.0, isOutOfRange: true };
      }
      if (this._state.outOfRangePolicy === 'clamp_to_edge_color') {
        const edgeT = physicalValue < min ? 0.0 : 1.0;
        const col = sampleColormap(this._state.colormapName, edgeT);
        const op = this.evaluateOpacity(edgeT);
        return { color: col, opacity: op, isOutOfRange: true };
      }
      if (this._state.outOfRangePolicy === 'render_alert_color') {
        return { color: { r: 1.0, g: 0.0, b: 1.0 }, opacity: 1.0, isOutOfRange: true };
      }
    }

    const normT = span > 1e-6 ? (physicalValue - min) / span : 0.0;
    const col = sampleColormap(this._state.colormapName, normT);
    const op = this.evaluateOpacity(normT);
    return { color: col, opacity: op, isOutOfRange: false };
  }

  evaluateOpacity(normalizedScalar: number): number {
    const t = Math.max(0.0, Math.min(1.0, normalizedScalar));
    const pts = this._state.opacityControlPoints;
    if (pts.length === 0) return 0.0;
    if (pts.length === 1 || t <= pts[0].normalizedScalar) return pts[0].opacity;
    if (t >= pts[pts.length - 1].normalizedScalar) return pts[pts.length - 1].opacity;

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      if (t >= p0.normalizedScalar && t <= p1.normalizedScalar) {
        const span = p1.normalizedScalar - p0.normalizedScalar;
        const frac = span > 1e-6 ? (t - p0.normalizedScalar) / span : 0.0;
        return p0.opacity + frac * (p1.opacity - p0.opacity);
      }
    }
    return pts[pts.length - 1].opacity;
  }

  /**
   * Produces canonical TransferFunctionContract.
   */
  toContract(): TransferFunctionContract {
    const control_points: TransferFunctionControlPoint[] = this._state.opacityControlPoints.map((cp) => {
      const color = sampleColormap(this._state.colormapName, cp.normalizedScalar);
      return {
        normalized_position: cp.normalizedScalar,
        red: color.r,
        green: color.g,
        blue: color.b,
        opacity: cp.opacity,
      };
    });

    return {
      colormap_preset_name: this._state.colormapName,
      physical_domain_min: this._state.clampedMin,
      physical_domain_max: this._state.clampedMax,
      physical_units: this._state.unit,
      control_points,
      out_of_range_policy: this._state.outOfRangePolicy,
      missing_value_color_rgba: [...this._state.missingValueColorRgba],
    };
  }

  /**
   * Generates a 256x4 RGBA Uint8Array lookup table.
   */
  generateLUT(size: number = 256): Uint8Array {
    const lut = new Uint8Array(size * 4);
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      const color = sampleColormap(this._state.colormapName, t);
      const opacity = this.evaluateOpacity(t);

      lut[i * 4 + 0] = Math.round(Math.max(0, Math.min(255, color.r * 255)));
      lut[i * 4 + 1] = Math.round(Math.max(0, Math.min(255, color.g * 255)));
      lut[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, color.b * 255)));
      lut[i * 4 + 3] = Math.round(Math.max(0, Math.min(255, opacity * 255)));
    }
    return lut;
  }

  subscribe(listener: TransferFunctionChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _sortAndValidatePoints(): void {
    this._state.opacityControlPoints.sort((a, b) => a.normalizedScalar - b.normalizedScalar);
  }

  private _notify(): void {
    const contract = this.toContract();
    for (const listener of this._listeners) {
      try {
        listener(contract);
      } catch (err) {
        console.error('Error in TransferFunctionModel listener:', err);
      }
    }
  }
}
