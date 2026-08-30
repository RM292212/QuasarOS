/**
 * Physical Clipping Panel Controller
 *
 * Integrates with @quasar/runtime's ClippingController:
 * - 6-plane physical depth (0.494m -> 453.938m)
 * - Longitude (80.0°E -> 88.0°E) and Latitude (-3.0°N -> 12.0°N) sliders
 * - Inversion toggle and reset to full parent domain
 * - Strict physical range validation preventing inverted or out-of-domain planes
 */

import {
  ClippingController,
  CoordinateTransformer,
  DepthLookupTable,
  ClippingRangeError,
  type ClippingPlaneLimits,
  type NormalizedClippingBox,
} from '../../../../../packages/runtime/src/index.ts';

export interface PhysicalClippingState {
  limits: ClippingPlaneLimits;
  normalizedBox: NormalizedClippingBox;
  domain: ClippingPlaneLimits;
  isInverted: boolean;
}

export type PhysicalClippingListener = (state: PhysicalClippingState) => void;

export class PhysicalClippingModel {
  private readonly _controller: ClippingController;
  private _isInverted: boolean = false;
  private _listeners: Set<PhysicalClippingListener> = new Set();

  constructor(controller: ClippingController) {
    this._controller = controller;
    this._controller.subscribe(() => {
      this._notify();
    });
  }

  get state(): PhysicalClippingState {
    return {
      limits: this._controller.activeLimits,
      normalizedBox: this._controller.normalizedClippingBox,
      domain: this._controller.domainLimits,
      isInverted: this._isInverted,
    };
  }

  get controller(): ClippingController {
    return this._controller;
  }

  setLongitudeRange(minLon: number, maxLon: number): void {
    this._controller.setLongitudeRange(minLon, maxLon);
  }

  setLatitudeRange(minLat: number, maxLat: number): void {
    this._controller.setLatitudeRange(minLat, maxLat);
  }

  setDepthRange(minDepthM: number, maxDepthM: number): void {
    this._controller.setDepthRange(minDepthM, maxDepthM);
  }

  resetToFullDomain(): void {
    this._isInverted = false;
    this._controller.resetToFullDomain();
  }

  toggleInversion(): void {
    this._isInverted = !this._isInverted;
    this._notify();
  }

  subscribe(listener: PhysicalClippingListener): () => void {
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
        console.error('Error in PhysicalClippingModel listener:', err);
      }
    }
  }
}
