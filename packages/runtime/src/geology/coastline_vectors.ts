/**
 * @quasar/runtime Geological Coastline Vectors
 *
 * Implements:
 * 1. Georeferenced vector outlines for South Asian, Arabian Sea, and North Indian Ocean coastlines.
 * 2. Transformation of geodetic polyline coordinates into normalized volume surface coordinates [u, v, w=0].
 * 3. Surface line strip generation for 3D viewport rendering.
 */

export interface CoastlineFeature {
  id: string;
  name: string;
  coordinates: [number, number][]; // [longitudeDeg, latitudeDeg]
}

// Authoritative Coastline Polylines for the Arabian Sea / North Indian Ocean Region
export const ARABIAN_SEA_COASTLINES: CoastlineFeature[] = [
  {
    id: 'india_west_coast',
    name: 'India West Coast & Gujarat',
    coordinates: [
      [68.5, 23.8], [69.2, 23.0], [70.0, 22.8], [70.2, 22.4], [69.0, 22.3],
      [69.5, 21.6], [70.5, 20.8], [72.0, 21.0], [72.8, 21.2], [72.8, 19.0],
      [73.0, 18.0], [73.5, 16.0], [74.5, 14.5], [75.5, 12.0], [76.5, 10.0],
      [77.0, 8.5], [77.5, 8.1]
    ],
  },
  {
    id: 'sri_lanka',
    name: 'Sri Lanka',
    coordinates: [
      [79.8, 9.8], [80.3, 9.8], [80.6, 9.2], [81.3, 8.6], [81.8, 7.5],
      [81.8, 6.8], [81.3, 6.2], [80.5, 5.9], [80.0, 6.2], [79.8, 7.0],
      [79.8, 8.0], [79.8, 9.8]
    ],
  },
  {
    id: 'pakistan_makran',
    name: 'Pakistan Makran Coast & Indus Delta',
    coordinates: [
      [61.5, 25.2], [62.5, 25.3], [64.0, 25.3], [66.0, 25.2], [66.8, 24.8],
      [67.5, 24.0], [68.2, 23.9]
    ],
  },
  {
    id: 'arabian_peninsula',
    name: 'Oman & Yemen Coastline',
    coordinates: [
      [59.8, 22.5], [59.0, 21.0], [58.0, 20.2], [56.0, 18.0], [54.0, 16.8],
      [52.5, 15.6], [50.0, 14.8], [48.0, 14.0], [45.0, 12.8], [43.5, 12.6]
    ],
  },
  {
    id: 'horn_of_africa',
    name: 'Somalia & Horn of Africa',
    coordinates: [
      [43.5, 11.8], [45.0, 10.5], [48.0, 11.2], [51.2, 11.8], [50.8, 9.5],
      [49.0, 7.0], [47.5, 5.0], [45.0, 2.5], [42.5, 0.0]
    ],
  },
  {
    id: 'maldives',
    name: 'Maldives Archipelago Ridge',
    coordinates: [
      [73.1, 7.1], [72.9, 5.9], [73.5, 4.2], [73.4, 2.0], [73.2, 0.5],
      [73.1, -0.6]
    ],
  },
  {
    id: 'lakshadweep',
    name: 'Lakshadweep Islands Chain',
    coordinates: [
      [72.6, 12.4], [72.2, 11.7], [72.8, 10.6], [73.6, 10.1], [73.0, 8.3]
    ],
  },
];

export interface CoastlineRenderSegment {
  points3D: [number, number, number][]; // 3D coordinates on surface [-0.5, 0.5]^2, z=0.0
}

export class CoastlineVectorModel {
  private readonly _features: CoastlineFeature[];
  private readonly _bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number };

  constructor(
    features = ARABIAN_SEA_COASTLINES,
    bounds = { minLon: 60.0, maxLon: 68.0, minLat: 0.0, maxLat: 15.0 }
  ) {
    this._features = features;
    this._bounds = bounds;
  }

  get features(): CoastlineFeature[] {
    return this._features;
  }

  get bounds(): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
    return this._bounds;
  }

  /**
   * Transforms coastline polylines into 3D line strip vertices in viewport coordinates [-0.5, 0.5]^2 at surface z = 0.0.
   */
  generateSurfaceSegments(surfaceZ = 0.0): CoastlineRenderSegment[] {
    const { minLon, maxLon, minLat, maxLat } = this._bounds;
    const segments: CoastlineRenderSegment[] = [];

    for (const feature of this._features) {
      const pts3D: [number, number, number][] = [];
      for (const [lon, lat] of feature.coordinates) {
        // Normalize coordinates to [0, 1] relative to domain bounds
        const u = (lon - minLon) / (maxLon - minLon);
        const v = (lat - minLat) / (maxLat - minLat);

        // Map to centered [-0.5, 0.5] space
        const x = u - 0.5;
        const y = v - 0.5;
        pts3D.push([x, y, surfaceZ]);
      }
      if (pts3D.length >= 2) {
        segments.push({ points3D: pts3D });
      }
    }

    return segments;
  }

  /**
   * Flattens 3D line strips into Float32Array vertex position buffer for WebGL/WebGPU line rendering.
   */
  generateLineVertexBuffer(surfaceZ = 0.0): Float32Array {
    const segments = this.generateSurfaceSegments(surfaceZ);
    let totalLineVerts = 0;
    for (const seg of segments) {
      totalLineVerts += (seg.points3D.length - 1) * 2;
    }

    const buffer = new Float32Array(totalLineVerts * 3);
    let offset = 0;

    for (const seg of segments) {
      for (let i = 0; i < seg.points3D.length - 1; i++) {
        const p0 = seg.points3D[i];
        const p1 = seg.points3D[i + 1];

        buffer[offset++] = p0[0];
        buffer[offset++] = p0[1];
        buffer[offset++] = p0[2];

        buffer[offset++] = p1[0];
        buffer[offset++] = p1[1];
        buffer[offset++] = p1[2];
      }
    }

    return buffer;
  }
}
