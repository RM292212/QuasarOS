/**
 * @quasar/runtime GEBCO Bathymetry Mesh and Sub-Seafloor Model
 *
 * Implements:
 * 1. Georeferenced seafloor heightfield mesh generation aligned to Copernicus domain.
 * 2. Per-vertex lighting normals and depth-based color tinting.
 * 3. Continuous sub-seafloor raymarcher clipping evaluation in normalized coordinates [0, 1]^3.
 * 4. Land vs Ocean wet-mask elevation categorization.
 */

export interface BathymetryGridData {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
  shape: [number, number]; // [latRes, lonRes]
  latitudes: number[];
  longitudes: number[];
  elevationsM: number[]; // Positive for land, negative for ocean
  depthsM: number[];     // Positive downwards (0 at surface, >0 below)
  minElevationM: number;
  maxElevationM: number;
  minDepthM: number;
  maxDepthM: number;
}

export interface BathymetryMeshData {
  positions: Float32Array; // 3 floats per vertex (x, y, z)
  normals: Float32Array;   // 3 floats per vertex (nx, ny, nz)
  uvs: Float32Array;       // 2 floats per vertex (u, v)
  colors: Float32Array;    // 4 floats per vertex (r, g, b, a)
  indices: Uint32Array;    // Triangle indices
  vertexCount: number;
  triangleCount: number;
}

export interface DepthColorStop {
  depthM: number;
  color: [number, number, number]; // RGB in [0, 1]
}

// Oceanographic Bathymetric Palette (Deep Abyssal -> Slope -> Shelf -> Coast -> Land)
export const DEFAULT_BATHYMETRY_PALETTE: DepthColorStop[] = [
  { depthM: 6000.0, color: [0.015, 0.04, 0.12] }, // Deep Abyssal Trench
  { depthM: 4000.0, color: [0.03, 0.09, 0.24] },  // Abyssal Plain
  { depthM: 2500.0, color: [0.06, 0.18, 0.38] },  // Continental Rise
  { depthM: 1000.0, color: [0.08, 0.32, 0.52] },  // Continental Slope
  { depthM: 200.0,  color: [0.12, 0.55, 0.62] },  // Continental Shelf
  { depthM: 50.0,   color: [0.22, 0.76, 0.72] },  // Shallow Coastal
  { depthM: 0.0,    color: [0.78, 0.72, 0.55] },  // Shoreline / Sand
  { depthM: -100.0, color: [0.28, 0.45, 0.22] },  // Land Topography
  { depthM: -4000.0,color: [0.55, 0.48, 0.40] },  // High Mountain
];

export class BathymetryMeshModel {
  private readonly _grid: BathymetryGridData;
  private _verticalExaggeration: number;
  private readonly _maxDomainDepthM: number;

  constructor(grid: BathymetryGridData, verticalExaggeration = 25.0, maxDomainDepthM = 5727.917) {
    this._grid = grid;
    this._verticalExaggeration = Math.max(1.0, Math.min(100.0, verticalExaggeration));
    this._maxDomainDepthM = maxDomainDepthM;
  }

  get grid(): BathymetryGridData {
    return this._grid;
  }

  get verticalExaggeration(): number {
    return this._verticalExaggeration;
  }

  set verticalExaggeration(val: number) {
    this._verticalExaggeration = Math.max(1.0, Math.min(100.0, val));
  }

  get maxDomainDepthM(): number {
    return this._maxDomainDepthM;
  }

  /**
   * Evaluate seafloor normalized depth w in [0, 1] at normalized horizontal coordinates (u, v) in [0, 1]^2.
   * u: Longitude [0 = minLon, 1 = maxLon]
   * v: Latitude [0 = minLat, 1 = maxLat]
   */
  getNormalizedSeafloorDepth(u: number, v: number): number {
    const clampedU = Math.max(0.0, Math.min(1.0, u));
    const clampedV = Math.max(0.0, Math.min(1.0, v));

    const [latRes, lonRes] = this._grid.shape;
    const colFloat = clampedU * (lonRes - 1);
    const rowFloat = clampedV * (latRes - 1);

    const col0 = Math.floor(colFloat);
    const col1 = Math.min(lonRes - 1, col0 + 1);
    const row0 = Math.floor(rowFloat);
    const row1 = Math.min(latRes - 1, row0 + 1);

    const fracU = colFloat - col0;
    const fracV = rowFloat - row0;

    const d00 = this._grid.depthsM[row0 * lonRes + col0];
    const d10 = this._grid.depthsM[row0 * lonRes + col1];
    const d01 = this._grid.depthsM[row1 * lonRes + col0];
    const d11 = this._grid.depthsM[row1 * lonRes + col1];

    const d0 = d00 * (1.0 - fracU) + d10 * fracU;
    const d1 = d01 * (1.0 - fracU) + d11 * fracU;
    const depth = d0 * (1.0 - fracV) + d1 * fracV;

    return Math.max(0.0, Math.min(1.0, depth / this._maxDomainDepthM));
  }

  /**
   * Check if a 3D normalized point (u, v, w) is below the seafloor (sub-seafloor).
   * In normalized volume coordinates, w = 0.0 is sea surface and w = 1.0 is maximum abyssal depth.
   */
  isSubSeafloor(u: number, v: number, w: number): boolean {
    const seafloorW = this.getNormalizedSeafloorDepth(u, v);
    return w > seafloorW;
  }

  /**
   * Evaluate depth color tinting from bathymetric color palette.
   */
  evaluateDepthColor(depthM: number, palette = DEFAULT_BATHYMETRY_PALETTE): [number, number, number, number] {
    if (depthM >= palette[0].depthM) {
      return [...palette[0].color, 1.0];
    }
    const last = palette[palette.length - 1];
    if (depthM <= last.depthM) {
      return [...last.color, 1.0];
    }

    for (let i = 0; i < palette.length - 1; i++) {
      const top = palette[i];
      const bot = palette[i + 1];
      if (depthM <= top.depthM && depthM >= bot.depthM) {
        const span = top.depthM - bot.depthM;
        const frac = span > 0 ? (top.depthM - depthM) / span : 0.0;
        const r = top.color[0] * (1.0 - frac) + bot.color[0] * frac;
        const g = top.color[1] * (1.0 - frac) + bot.color[1] * frac;
        const b = top.color[2] * (1.0 - frac) + bot.color[2] * frac;
        return [r, g, b, 1.0];
      }
    }
    return [0.1, 0.4, 0.6, 1.0];
  }

  /**
   * Generate 3D heightfield mesh geometry.
   * Coordinate space: centered in [-0.5, 0.5]^2 horizontally (X = East-West, Y = North-South),
   * and Z represents elevation (-depth / maxDepth * verticalExaggeration).
   */
  generateMesh(options?: { customPalette?: DepthColorStop[] }): BathymetryMeshData {
    const [latRes, lonRes] = this._grid.shape;
    const vertexCount = latRes * lonRes;
    const quadCount = (latRes - 1) * (lonRes - 1);
    const triangleCount = quadCount * 2;

    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const colors = new Float32Array(vertexCount * 4);
    const indices = new Uint32Array(triangleCount * 3);

    const palette = options?.customPalette ?? DEFAULT_BATHYMETRY_PALETTE;

    // 1. Generate Vertex Positions, UVs, and Colors
    for (let r = 0; r < latRes; r++) {
      const v = r / (latRes - 1);
      const y = v - 0.5; // [-0.5, 0.5]

      for (let c = 0; c < lonRes; c++) {
        const u = c / (lonRes - 1);
        const x = u - 0.5; // [-0.5, 0.5]

        const idx = r * lonRes + c;
        const depthM = this._grid.depthsM[idx];
        const elevM = this._grid.elevationsM[idx];

        // Depth maps downward into negative Z
        const normDepth = depthM / this._maxDomainDepthM;
        const z = -normDepth * (this._verticalExaggeration / 50.0);

        positions[idx * 3 + 0] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        uvs[idx * 2 + 0] = u;
        uvs[idx * 2 + 1] = v;

        const col = this.evaluateDepthColor(depthM, palette);
        colors[idx * 4 + 0] = col[0];
        colors[idx * 4 + 1] = col[1];
        colors[idx * 4 + 2] = col[2];
        colors[idx * 4 + 3] = col[3];
      }
    }

    // 2. Compute Finite-Difference Normals
    for (let r = 0; r < latRes; r++) {
      for (let c = 0; c < lonRes; c++) {
        const idx = r * lonRes + c;

        const cLeft = Math.max(0, c - 1);
        const cRight = Math.min(lonRes - 1, c + 1);
        const rDown = Math.max(0, r - 1);
        const rUp = Math.min(latRes - 1, r + 1);

        const zLeft = positions[(r * lonRes + cLeft) * 3 + 2];
        const zRight = positions[(r * lonRes + cRight) * 3 + 2];
        const zDown = positions[(rDown * lonRes + c) * 3 + 2];
        const zUp = positions[(rUp * lonRes + c) * 3 + 2];

        const dx = (cRight - cLeft) / (lonRes - 1);
        const dy = (rUp - rDown) / (latRes - 1);
        const dzx = zRight - zLeft;
        const dzy = zUp - zDown;

        // Tangent vectors: T_x = (dx, 0, dzx), T_y = (0, dy, dzy)
        // Normal = normalize(T_x cross T_y) = (-dzx * dy, -dx * dzy, dx * dy)
        let nx = -dzx * dy;
        let ny = -dx * dzy;
        let nz = dx * dy;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;

        normals[idx * 3 + 0] = nx / len;
        normals[idx * 3 + 1] = ny / len;
        normals[idx * 3 + 2] = nz / len;
      }
    }

    // 3. Generate Triangle Indices
    let triIdx = 0;
    for (let r = 0; r < latRes - 1; r++) {
      for (let c = 0; c < lonRes - 1; c++) {
        const i00 = r * lonRes + c;
        const i10 = r * lonRes + (c + 1);
        const i01 = (r + 1) * lonRes + c;
        const i11 = (r + 1) * lonRes + (c + 1);

        // Tri 1: (i00, i10, i11)
        indices[triIdx++] = i00;
        indices[triIdx++] = i10;
        indices[triIdx++] = i11;

        // Tri 2: (i00, i11, i01)
        indices[triIdx++] = i00;
        indices[triIdx++] = i11;
        indices[triIdx++] = i01;
      }
    }

    return {
      positions,
      normals,
      uvs,
      colors,
      indices,
      vertexCount,
      triangleCount,
    };
  }
}
