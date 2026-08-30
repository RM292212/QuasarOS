/**
 * @quasar/runtime Bounding Box & 6-Plane Clipping Controller
 *
 * Implements geodetic (lon/lat/depth) and normalized volume space [0, 1]^3 6-plane clipping.
 * Preserves strict physical unit verification and prevents inverted planes.
 */

import { ClippingRangeError } from '../errors.ts';
import type { CoordinateTransformer } from '../coordinates/transformer.ts';
import type { ClippingPlaneLimits, NormalizedClippingBox } from '../types.ts';

export type ClippingChangeListener = (limits: ClippingPlaneLimits, normalized: NormalizedClippingBox) => void;

export class ClippingController {
  private readonly _transformer: CoordinateTransformer;
  private readonly _maxDomainLimits: ClippingPlaneLimits;
  private _activeLimits: ClippingPlaneLimits;
  private _listeners: Set<ClippingChangeListener> = new Set();

  constructor(transformer: CoordinateTransformer, initialLimits?: Partial<ClippingPlaneLimits>) {
    this._transformer = transformer;
    const bounds = transformer.bounds;

    this._maxDomainLimits = {
      minLonDeg: bounds.minLongitudeDeg,
      maxLonDeg: bounds.maxLongitudeDeg,
      minLatDeg: bounds.minLatitudeDeg,
      maxLatDeg: bounds.maxLatitudeDeg,
      minDepthM: bounds.minDepthM,
      maxDepthM: bounds.maxDepthM,
    };

    this._activeLimits = {
      minLonDeg: initialLimits?.minLonDeg ?? this._maxDomainLimits.minLonDeg,
      maxLonDeg: initialLimits?.maxLonDeg ?? this._maxDomainLimits.maxLonDeg,
      minLatDeg: initialLimits?.minLatDeg ?? this._maxDomainLimits.minLatDeg,
      maxLatDeg: initialLimits?.maxLatDeg ?? this._maxDomainLimits.maxLatDeg,
      minDepthM: initialLimits?.minDepthM ?? this._maxDomainLimits.minDepthM,
      maxDepthM: initialLimits?.maxDepthM ?? this._maxDomainLimits.maxDepthM,
    };

    this._validateLimits(this._activeLimits);
  }

  get domainLimits(): ClippingPlaneLimits {
    return { ...this._maxDomainLimits };
  }

  get activeLimits(): ClippingPlaneLimits {
    return { ...this._activeLimits };
  }

  get normalizedClippingBox(): NormalizedClippingBox {
    const minNorm = this._transformer.geodeticToNormalized({
      longitudeDeg: this._activeLimits.minLonDeg,
      latitudeDeg: this._activeLimits.minLatDeg,
      depthM: this._activeLimits.minDepthM,
    }, true);

    const maxNorm = this._transformer.geodeticToNormalized({
      longitudeDeg: this._activeLimits.maxLonDeg,
      latitudeDeg: this._activeLimits.maxLatDeg,
      depthM: this._activeLimits.maxDepthM,
    }, true);

    return {
      minU: minNorm.u,
      maxU: maxNorm.u,
      minV: minNorm.v,
      maxV: maxNorm.v,
      minW: minNorm.w,
      maxW: maxNorm.w,
    };
  }

  subscribe(listener: ClippingChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  setLimits(newLimits: Partial<ClippingPlaneLimits>): void {
    const updated: ClippingPlaneLimits = {
      minLonDeg: newLimits.minLonDeg ?? this._activeLimits.minLonDeg,
      maxLonDeg: newLimits.maxLonDeg ?? this._activeLimits.maxLonDeg,
      minLatDeg: newLimits.minLatDeg ?? this._activeLimits.minLatDeg,
      maxLatDeg: newLimits.maxLatDeg ?? this._activeLimits.maxLatDeg,
      minDepthM: newLimits.minDepthM ?? this._activeLimits.minDepthM,
      maxDepthM: newLimits.maxDepthM ?? this._activeLimits.maxDepthM,
    };

    this._validateLimits(updated);
    this._activeLimits = updated;
    this._notify();
  }

  setLongitudeRange(minLon: number, maxLon: number): void {
    this.setLimits({ minLonDeg: minLon, maxLonDeg: maxLon });
  }

  setLatitudeRange(minLat: number, maxLat: number): void {
    this.setLimits({ minLatDeg: minLat, maxLatDeg: maxLat });
  }

  setDepthRange(minDepthM: number, maxDepthM: number): void {
    this.setLimits({ minDepthM: minDepthM, maxDepthM: maxDepthM });
  }

  resetToFullDomain(): void {
    this._activeLimits = { ...this._maxDomainLimits };
    this._notify();
  }

  /**
   * Evaluates whether a normalized coordinate [u, v, w] is inside active clipping box.
   */
  isNormalizedPointClipped(u: number, v: number, w: number): boolean {
    const box = this.normalizedClippingBox;
    return u < box.minU || u > box.maxU || v < box.minV || v > box.maxV || w < box.minW || w > box.maxW;
  }

  /**
   * Evaluates whether a geodetic coordinate is inside active clipping limits.
   */
  isGeodeticPointClipped(lon: number, lat: number, depthM: number): boolean {
    return (
      lon < this._activeLimits.minLonDeg ||
      lon > this._activeLimits.maxLonDeg ||
      lat < this._activeLimits.minLatDeg ||
      lat > this._activeLimits.maxLatDeg ||
      depthM < this._activeLimits.minDepthM ||
      depthM > this._activeLimits.maxDepthM
    );
  }

  private _validateLimits(limits: ClippingPlaneLimits): void {
    if (limits.minLonDeg > limits.maxLonDeg) {
      throw new ClippingRangeError('longitude', limits.minLonDeg, limits.maxLonDeg, 'min longitude exceeds max longitude.');
    }
    if (limits.minLatDeg > limits.maxLatDeg) {
      throw new ClippingRangeError('latitude', limits.minLatDeg, limits.maxLatDeg, 'min latitude exceeds max latitude.');
    }
    if (limits.minDepthM > limits.maxDepthM) {
      throw new ClippingRangeError('depth', limits.minDepthM, limits.maxDepthM, 'min depth exceeds max depth.');
    }

    if (limits.minLonDeg < this._maxDomainLimits.minLonDeg || limits.maxLonDeg > this._maxDomainLimits.maxLonDeg) {
      throw new ClippingRangeError('longitude', limits.minLonDeg, limits.maxLonDeg, 'Range exceeds parent domain extents.');
    }
    if (limits.minLatDeg < this._maxDomainLimits.minLatDeg || limits.maxLatDeg > this._maxDomainLimits.maxLatDeg) {
      throw new ClippingRangeError('latitude', limits.minLatDeg, limits.maxLatDeg, 'Range exceeds parent domain extents.');
    }
    if (limits.minDepthM < this._maxDomainLimits.minDepthM || limits.maxDepthM > this._maxDomainLimits.maxDepthM) {
      throw new ClippingRangeError('depth', limits.minDepthM, limits.maxDepthM, 'Range exceeds parent domain extents.');
    }
  }

  private _notify(): void {
    const limits = this.activeLimits;
    const box = this.normalizedClippingBox;
    for (const listener of this._listeners) {
      try {
        listener(limits, box);
      } catch (err) {
        console.error('Error in ClippingController listener:', err);
      }
    }
  }
}
