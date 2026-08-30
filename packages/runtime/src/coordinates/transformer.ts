/**
 * @quasar/runtime Coordinate Transformer
 *
 * Implements bidirectional mappings between:
 * 1. Geodetic (WGS84 lon [deg], lat [deg], depth [m])
 * 2. Normalized Volume Space [u, v, w] in [0, 1]^3
 * 3. Local Cartesian ENU (East, North, Up meters) relative to ROI origin
 * 4. Brick-Local Sample Index Space with halo offsets
 */

import { CoordinateBoundsError } from '../errors.ts';
import { DepthLookupTable } from './depth_lut.ts';
import type {
  BrickLocalIndexCoordinate,
  GeodeticCoordinate,
  LocalCartesianENU,
  NormalizedVolumeCoordinate,
} from '../types.ts';

export interface CoordinateDomainBounds {
  minLongitudeDeg: number;
  maxLongitudeDeg: number;
  minLatitudeDeg: number;
  maxLatitudeDeg: number;
  minDepthM: number;
  maxDepthM: number;
  originLongitudeDeg?: number;
  originLatitudeDeg?: number;
  originDepthM?: number;
  verticalExaggeration?: number;
}

// WGS84 Ellipsoid constants
const WGS84_A = 6378137.0; // semi-major axis (meters)
const WGS84_F = 1.0 / 298.257223563; // flattening
const WGS84_B = WGS84_A * (1.0 - WGS84_F); // semi-minor axis
const WGS84_E2 = 1.0 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A); // first eccentricity squared

export class CoordinateTransformer {
  private readonly _bounds: CoordinateDomainBounds;
  private readonly _depthLut: DepthLookupTable;
  private readonly _originLon: number;
  private readonly _originLat: number;
  private readonly _originDepth: number;
  private readonly _verticalExaggeration: number;

  constructor(bounds: CoordinateDomainBounds, depthLut: DepthLookupTable) {
    if (bounds.maxLongitudeDeg <= bounds.minLongitudeDeg) {
      throw new CoordinateBoundsError('longitude_bounds', [bounds.minLongitudeDeg, bounds.maxLongitudeDeg], [bounds.minLongitudeDeg, Infinity]);
    }
    if (bounds.maxLatitudeDeg <= bounds.minLatitudeDeg) {
      throw new CoordinateBoundsError('latitude_bounds', [bounds.minLatitudeDeg, bounds.maxLatitudeDeg], [bounds.minLatitudeDeg, Infinity]);
    }

    this._bounds = { ...bounds };
    this._depthLut = depthLut;
    this._originLon = bounds.originLongitudeDeg ?? (bounds.minLongitudeDeg + bounds.maxLongitudeDeg) * 0.5;
    this._originLat = bounds.originLatitudeDeg ?? (bounds.minLatitudeDeg + bounds.maxLatitudeDeg) * 0.5;
    this._originDepth = bounds.originDepthM ?? bounds.minDepthM;
    this._verticalExaggeration = bounds.verticalExaggeration ?? 1.0;
  }

  get bounds(): CoordinateDomainBounds {
    return this._bounds;
  }

  get depthLut(): DepthLookupTable {
    return this._depthLut;
  }

  get verticalExaggeration(): number {
    return this._verticalExaggeration;
  }

  /**
   * Geodetic (lon, lat, depth) -> Normalized Volume Space [0, 1]^3
   */
  geodeticToNormalized(coord: GeodeticCoordinate, clamp = false): NormalizedVolumeCoordinate {
    let lon = coord.longitudeDeg;
    let lat = coord.latitudeDeg;
    let depth = coord.depthM;

    if (clamp) {
      lon = Math.max(this._bounds.minLongitudeDeg, Math.min(this._bounds.maxLongitudeDeg, lon));
      lat = Math.max(this._bounds.minLatitudeDeg, Math.min(this._bounds.maxLatitudeDeg, lat));
    } else {
      if (lon < this._bounds.minLongitudeDeg || lon > this._bounds.maxLongitudeDeg) {
        throw new CoordinateBoundsError('longitudeDeg', lon, [this._bounds.minLongitudeDeg, this._bounds.maxLongitudeDeg]);
      }
      if (lat < this._bounds.minLatitudeDeg || lat > this._bounds.maxLatitudeDeg) {
        throw new CoordinateBoundsError('latitudeDeg', lat, [this._bounds.minLatitudeDeg, this._bounds.maxLatitudeDeg]);
      }
    }

    const u = (lon - this._bounds.minLongitudeDeg) / (this._bounds.maxLongitudeDeg - this._bounds.minLongitudeDeg);
    const v = (lat - this._bounds.minLatitudeDeg) / (this._bounds.maxLatitudeDeg - this._bounds.minLatitudeDeg);
    const w = this._depthLut.physicalToNormalized(depth, clamp);

    return { u, v, w };
  }

  /**
   * Normalized Volume Space [0, 1]^3 -> Geodetic (lon, lat, depth)
   */
  normalizedToGeodetic(norm: NormalizedVolumeCoordinate, clamp = false): GeodeticCoordinate {
    let u = norm.u;
    let v = norm.v;
    let w = norm.w;

    if (clamp) {
      u = Math.max(0.0, Math.min(1.0, u));
      v = Math.max(0.0, Math.min(1.0, v));
      w = Math.max(0.0, Math.min(1.0, w));
    } else {
      if (u < 0.0 || u > 1.0) throw new CoordinateBoundsError('u', u, [0.0, 1.0]);
      if (v < 0.0 || v > 1.0) throw new CoordinateBoundsError('v', v, [0.0, 1.0]);
      if (w < 0.0 || w > 1.0) throw new CoordinateBoundsError('w', w, [0.0, 1.0]);
    }

    const longitudeDeg = this._bounds.minLongitudeDeg + u * (this._bounds.maxLongitudeDeg - this._bounds.minLongitudeDeg);
    const latitudeDeg = this._bounds.minLatitudeDeg + v * (this._bounds.maxLatitudeDeg - this._bounds.minLatitudeDeg);
    const depthM = this._depthLut.normalizedToPhysical(w, clamp);

    return { longitudeDeg, latitudeDeg, depthM };
  }

  /**
   * Geodetic -> Local Cartesian ENU (East-North-Up in meters) relative to ROI origin.
   */
  geodeticToENU(coord: GeodeticCoordinate): LocalCartesianENU {
    const latRad = (coord.latitudeDeg * Math.PI) / 180.0;
    const lonRad = (coord.longitudeDeg * Math.PI) / 180.0;
    const origLatRad = (this._originLat * Math.PI) / 180.0;
    const origLonRad = (this._originLon * Math.PI) / 180.0;

    // Radius of curvature in the prime vertical
    const N = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * Math.sin(origLatRad) * Math.sin(origLatRad));
    const M = (WGS84_A * (1.0 - WGS84_E2)) / Math.pow(1.0 - WGS84_E2 * Math.sin(origLatRad) * Math.sin(origLatRad), 1.5);

    const dLat = latRad - origLatRad;
    const dLon = lonRad - origLonRad;

    const eastMeters = (N * Math.cos(origLatRad)) * dLon;
    const northMeters = M * dLat;
    // Up is positive upward (so decreasing depth = increasing up)
    const upMeters = -(coord.depthM - this._originDepth) * this._verticalExaggeration;

    return { eastMeters, northMeters, upMeters };
  }

  /**
   * Local Cartesian ENU -> Geodetic (lon, lat, depth)
   */
  enuToGeodetic(enu: LocalCartesianENU): GeodeticCoordinate {
    const origLatRad = (this._originLat * Math.PI) / 180.0;
    const N = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * Math.sin(origLatRad) * Math.sin(origLatRad));
    const M = (WGS84_A * (1.0 - WGS84_E2)) / Math.pow(1.0 - WGS84_E2 * Math.sin(origLatRad) * Math.sin(origLatRad), 1.5);

    const dLat = enu.northMeters / M;
    const dLon = enu.eastMeters / (N * Math.cos(origLatRad));

    const latitudeDeg = this._originLat + (dLat * 180.0) / Math.PI;
    const longitudeDeg = this._originLon + (dLon * 180.0) / Math.PI;
    const depthM = this._originDepth - enu.upMeters / this._verticalExaggeration;

    return { longitudeDeg, latitudeDeg, depthM };
  }

  /**
   * Convert global volume grid index to brick-local sample index with halo offset.
   */
  globalGridToBrickSample(
    gridX: number,
    gridY: number,
    gridZ: number,
    brickOrigin: [number, number, number],
    haloPadding: [number, number, number]
  ): BrickLocalIndexCoordinate {
    const haloOffsetX = haloPadding[0];
    const haloOffsetY = haloPadding[1];
    const haloOffsetZ = haloPadding[2];

    const localValidX = gridX - brickOrigin[0];
    const localValidY = gridY - brickOrigin[1];
    const localValidZ = gridZ - brickOrigin[2];

    const sampleX = localValidX + haloOffsetX;
    const sampleY = localValidY + haloOffsetY;
    const sampleZ = localValidZ + haloOffsetZ;

    return {
      gridX,
      gridY,
      gridZ,
      haloOffsetX,
      haloOffsetY,
      haloOffsetZ,
      sampleX,
      sampleY,
      sampleZ,
    };
  }
}
