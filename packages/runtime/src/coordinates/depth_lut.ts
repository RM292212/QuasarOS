/**
 * @quasar/runtime Depth Lookup Table (LUT)
 *
 * Implements exact binary search, monotonic piece-wise linear interpolation,
 * bracketing bounds, and normalized [0, 1] <-> physical depth (meters) bidirectional conversion
 * across non-uniform vertical coordinate systems (e.g. 31 Copernicus ocean levels).
 */

import { CoordinateBoundsError } from '../errors.ts';
import type { DepthBracket } from '../types.ts';

export class DepthLookupTable {
  private readonly _depthLevels: Float64Array;
  private readonly _minDepthM: number;
  private readonly _maxDepthM: number;
  private readonly _levelCount: number;

  constructor(depthLevels: number[] | Float64Array | Float32Array) {
    if (!depthLevels || depthLevels.length < 2) {
      throw new CoordinateBoundsError('depth_levels', depthLevels ? depthLevels.length : 0, [2, Infinity], 'Depth lookup table requires at least 2 discrete depth levels.');
    }

    // Verify strict monotonicity (depth increases with index)
    for (let i = 1; i < depthLevels.length; i++) {
      if (depthLevels[i] <= depthLevels[i - 1]) {
        throw new CoordinateBoundsError(
          `depth_levels[${i}]`,
          depthLevels[i],
          [depthLevels[i - 1], Infinity],
          `Strict vertical monotonicity violated: level ${i} (${depthLevels[i]}m) <= level ${i - 1} (${depthLevels[i - 1]}m).`
        );
      }
    }

    this._depthLevels = new Float64Array(depthLevels);
    this._levelCount = this._depthLevels.length;
    this._minDepthM = this._depthLevels[0];
    this._maxDepthM = this._depthLevels[this._levelCount - 1];
  }

  get levelCount(): number {
    return this._levelCount;
  }

  get minDepthM(): number {
    return this._minDepthM;
  }

  get maxDepthM(): number {
    return this._maxDepthM;
  }

  get levels(): Float64Array {
    return this._depthLevels;
  }

  /**
   * Get exact depth at discrete level index k.
   */
  getDepthAtLevel(levelIndex: number): number {
    if (levelIndex < 0 || levelIndex >= this._levelCount) {
      throw new CoordinateBoundsError('levelIndex', levelIndex, [0, this._levelCount - 1]);
    }
    return this._depthLevels[levelIndex];
  }

  /**
   * Find bracketing depth levels for a continuous physical depth in meters.
   * Performs exact binary search (O(log K)).
   */
  findBracketingLevels(depthM: number, clamp = false): DepthBracket {
    if (clamp) {
      depthM = Math.max(this._minDepthM, Math.min(this._maxDepthM, depthM));
    } else if (depthM < this._minDepthM || depthM > this._maxDepthM) {
      throw new CoordinateBoundsError('depthM', depthM, [this._minDepthM, this._maxDepthM]);
    }

    // Binary search
    let low = 0;
    let high = this._levelCount - 1;

    // Check exact matches at boundaries
    if (Math.abs(depthM - this._depthLevels[0]) < 1e-7) {
      return {
        lowerLevelIndex: 0,
        upperLevelIndex: 0,
        lowerDepthM: this._depthLevels[0],
        upperDepthM: this._depthLevels[0],
        interpolationFraction: 0.0,
        isExactLevel: true,
        exactLevelIndex: 0,
      };
    }

    if (Math.abs(depthM - this._depthLevels[high]) < 1e-7) {
      return {
        lowerLevelIndex: high,
        upperLevelIndex: high,
        lowerDepthM: this._depthLevels[high],
        upperDepthM: this._depthLevels[high],
        interpolationFraction: 0.0,
        isExactLevel: true,
        exactLevelIndex: high,
      };
    }

    while (low <= high) {
      const mid = (low + high) >> 1;
      const midVal = this._depthLevels[mid];

      if (Math.abs(midVal - depthM) < 1e-7) {
        return {
          lowerLevelIndex: mid,
          upperLevelIndex: mid,
          lowerDepthM: midVal,
          upperDepthM: midVal,
          interpolationFraction: 0.0,
          isExactLevel: true,
          exactLevelIndex: mid,
        };
      }

      if (midVal < depthM) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // low is upper bound index, high is lower bound index
    const lowerIdx = high;
    const upperIdx = low;
    const lowerZ = this._depthLevels[lowerIdx];
    const upperZ = this._depthLevels[upperIdx];
    const fraction = (depthM - lowerZ) / (upperZ - lowerZ);

    return {
      lowerLevelIndex: lowerIdx,
      upperLevelIndex: upperIdx,
      lowerDepthM: lowerZ,
      upperDepthM: upperZ,
      interpolationFraction: fraction,
      isExactLevel: false,
    };
  }

  /**
   * Find nearest discrete level index for a continuous physical depth in meters.
   */
  findNearestLevelIndex(depthM: number, clamp = true): number {
    const bracket = this.findBracketingLevels(depthM, clamp);
    if (bracket.isExactLevel) {
      return bracket.exactLevelIndex!;
    }
    return bracket.interpolationFraction <= 0.5 ? bracket.lowerLevelIndex : bracket.upperLevelIndex;
  }

  /**
   * Convert physical depth (meters) to continuous normalized depth w in [0, 1].
   * Uses piece-wise index mapping: w = (k + fraction) / (K - 1)
   */
  physicalToNormalized(depthM: number, clamp = false): number {
    const bracket = this.findBracketingLevels(depthM, clamp);
    if (bracket.isExactLevel) {
      return bracket.exactLevelIndex! / (this._levelCount - 1);
    }
    const continuousIndex = bracket.lowerLevelIndex + bracket.interpolationFraction;
    return continuousIndex / (this._levelCount - 1);
  }

  /**
   * Convert continuous normalized depth w in [0, 1] to physical depth (meters).
   * Inverse piece-wise mapping: continuousIndex = w * (K - 1)
   */
  normalizedToPhysical(w: number, clamp = false): number {
    if (clamp) {
      w = Math.max(0.0, Math.min(1.0, w));
    } else if (w < 0.0 || w > 1.0) {
      throw new CoordinateBoundsError('normalized_w', w, [0.0, 1.0]);
    }

    const continuousIndex = w * (this._levelCount - 1);
    const lowerIdx = Math.floor(continuousIndex);
    const upperIdx = Math.min(this._levelCount - 1, Math.ceil(continuousIndex));

    if (lowerIdx === upperIdx) {
      return this._depthLevels[lowerIdx];
    }

    const fraction = continuousIndex - lowerIdx;
    const lowerZ = this._depthLevels[lowerIdx];
    const upperZ = this._depthLevels[upperIdx];
    return lowerZ + fraction * (upperZ - lowerZ);
  }

  /**
   * Export the LUT as a Float32Array suitable for WebGPU / WebGL 1D/2D texture upload or uniform buffer.
   */
  toTextureArray(): Float32Array {
    return Float32Array.from(this._depthLevels);
  }
}
