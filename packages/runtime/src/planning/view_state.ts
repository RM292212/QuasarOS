/**
 * @quasar/runtime Abstract View State
 *
 * Backend-neutral representation of camera parameters, view/projection matrices,
 * frustum clipping planes, and screen-space error metrics.
 *
 * Free of Babylon.js, Three.js, CesiumJS, and browser DOM dependencies.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type Matrix4x4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export interface FrustumPlane {
  /** Normal vector pointing into the half-space (nx, ny, nz) */
  normal: Vector3D;
  /** Plane distance constant d, satisfying nx*x + ny*y + nz*z + d = 0 */
  distance: number;
}

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
}

export interface ScreenViewport {
  widthPixels: number;
  heightPixels: number;
  devicePixelRatio?: number;
}

export interface AbstractViewState {
  /** Camera eye position in Local Cartesian ENU meters */
  cameraPositionENU: Vector3D;
  /** Camera eye position in Normalized Volume coordinates [0, 1]^3 */
  cameraPositionVolume: Vector3D;
  /** Camera look-at target position in ENU meters */
  targetPositionENU: Vector3D;
  /** Camera up vector */
  upVectorENU: Vector3D;
  /** View matrix (column-major or row-major 16-element tuple) */
  viewMatrix: Matrix4x4;
  /** Projection matrix */
  projectionMatrix: Matrix4x4;
  /** Combined View-Projection matrix */
  viewProjectionMatrix: Matrix4x4;
  /** 6 frustum planes in Volume or ENU space (Left, Right, Bottom, Top, Near, Far) */
  frustumPlanes: readonly [FrustumPlane, FrustumPlane, FrustumPlane, FrustumPlane, FrustumPlane, FrustumPlane];
  /** Viewport dimensions */
  viewport: ScreenViewport;
  /** Vertical field of view in radians */
  fieldOfViewYRad: number;
  /** Screen space error tolerance (maximum allowable projected voxel size in pixels before refining LOD) */
  screenSpaceErrorThresholdPixels: number;
}

/**
 * Evaluates whether an axis-aligned 3D bounding box intersects or is inside a set of frustum planes.
 * Returns true if the box is partially or completely inside the frustum.
 */
export function isBoundingBoxInFrustum(
  box: BoundingBox3D,
  planes: readonly FrustumPlane[]
): boolean {
  for (let i = 0; i < planes.length; i++) {
    const plane = planes[i];
    const nx = plane.normal.x;
    const ny = plane.normal.y;
    const nz = plane.normal.z;

    // Identify positive vertex (p-vertex) in direction of normal
    const px = nx >= 0 ? box.max.x : box.min.x;
    const py = ny >= 0 ? box.max.y : box.min.y;
    const pz = nz >= 0 ? box.max.z : box.min.z;

    // If positive vertex is outside the half-space, entire box is outside
    if (nx * px + ny * py + nz * pz + plane.distance < 0) {
      return false;
    }
  }
  return true;
}

/**
 * Helper to construct an identity 4x4 matrix.
 */
export function createIdentityMatrix(): Matrix4x4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}
