/**
 * @quasar/runtime 3D East-North-Up (ENU) Compass Orientation Gizmo
 *
 * Implements:
 * 1. 3D ENU coordinate axis frame (East = +X, North = +Y, Up = +Z).
 * 2. Real-time synchronization with camera view/rotation matrix.
 * 3. 2D screen projected coordinate calculations for interactive orientation HUD.
 */

export interface ENUAxisVector {
  label: 'East' | 'North' | 'Up';
  code: 'E' | 'N' | 'U';
  colorHex: string;
  vector3D: [number, number, number]; // Unit vector in world space
  projected2D: [number, number];      // Normalized 2D screen coordinates [-1, 1]
  length2D: number;
}

export interface CompassState {
  headingDeg: number; // Angle from North (0° = North, 90° = East, 180° = South, 270° = West)
  pitchDeg: number;   // Camera elevation angle (-90° to +90°)
  rollDeg: number;    // Camera bank/roll angle
  axes: ENUAxisVector[];
}

export class ENUCompassGizmoModel {
  private _headingDeg: number = 0.0;
  private _pitchDeg: number = 25.0;
  private _rollDeg: number = 0.0;

  constructor(initialHeadingDeg = 0.0, initialPitchDeg = 25.0, initialRollDeg = 0.0) {
    this._headingDeg = initialHeadingDeg;
    this._pitchDeg = initialPitchDeg;
    this._rollDeg = initialRollDeg;
  }

  get headingDeg(): number {
    return this._headingDeg;
  }

  get pitchDeg(): number {
    return this._pitchDeg;
  }

  get rollDeg(): number {
    return this._rollDeg;
  }

  /**
   * Update camera orientation angles.
   * angleX: pitch in radians
   * angleY: yaw/heading in radians
   */
  updateFromAngles(angleXRad: number, angleYRad: number, rollRad = 0.0): CompassState {
    this._pitchDeg = (angleXRad * 180.0) / Math.PI;
    // Map yaw to compass heading
    let heading = ((-angleYRad * 180.0) / Math.PI) % 360.0;
    if (heading < 0) heading += 360.0;
    if (Object.is(heading, -0) || Math.abs(heading) < 1e-6) heading = 0.0;
    this._headingDeg = heading;
    this._rollDeg = (rollRad * 180.0) / Math.PI;

    return this.computeState();
  }

  /**
   * Update camera orientation from 4x4 View Matrix (column-major Float32Array).
   */
  updateFromViewMatrix(viewMatrix: Float32Array | number[]): CompassState {
    // Extract camera forward and right vectors from view matrix
    // View Matrix columns: col0 = Right, col1 = Up, col2 = -Forward
    const m = viewMatrix;
    const rX = m[0], rY = m[4], rZ = m[8];
    const uX = m[1], uY = m[5], uZ = m[9];
    const fX = -m[2], fY = -m[6], fZ = -m[10];

    // Compute heading in horizontal plane (East-North)
    let heading = (Math.atan2(rY, rX) * 180.0) / Math.PI;
    if (heading < 0) heading += 360.0;
    this._headingDeg = heading;

    // Pitch: elevation angle from horizontal
    this._pitchDeg = (Math.asin(Math.max(-1.0, Math.min(1.0, uZ))) * 180.0) / Math.PI;

    return this.computeState();
  }

  /**
   * Compute projected 2D coordinates for East, North, and Up axes on the orientation sphere.
   */
  computeState(): CompassState {
    const radHeading = (this._headingDeg * Math.PI) / 180.0;
    const radPitch = (this._pitchDeg * Math.PI) / 180.0;

    const cosH = Math.cos(radHeading);
    const sinH = Math.sin(radHeading);
    const cosP = Math.cos(radPitch);
    const sinP = Math.sin(radPitch);

    // Camera view projection transform for triad
    // East Vector (+X): [1, 0, 0] in world space
    const eastX = cosH;
    const eastY = -sinH * sinP;
    const eastLen = Math.sqrt(eastX * eastX + eastY * eastY) || 1e-4;

    // North Vector (+Y): [0, 1, 0] in world space
    const northX = -sinH;
    const northY = -cosH * sinP;
    const northLen = Math.sqrt(northX * northX + northY * northY) || 1e-4;

    // Up Vector (+Z): [0, 0, 1] in world space
    const upX = 0.0;
    const upY = cosP;
    const upLen = Math.abs(upY) || 1e-4;

    const axes: ENUAxisVector[] = [
      {
        label: 'East',
        code: 'E',
        colorHex: '#ef4444', // Red (+X)
        vector3D: [1, 0, 0],
        projected2D: [eastX, eastY],
        length2D: eastLen,
      },
      {
        label: 'North',
        code: 'N',
        colorHex: '#22c55e', // Green (+Y)
        vector3D: [0, 1, 0],
        projected2D: [northX, northY],
        length2D: northLen,
      },
      {
        label: 'Up',
        code: 'U',
        colorHex: '#38bdf8', // Sky Blue (+Z)
        vector3D: [0, 0, 1],
        projected2D: [upX, upY],
        length2D: upLen,
      },
    ];

    return {
      headingDeg: this._headingDeg,
      pitchDeg: this._pitchDeg,
      rollDeg: this._rollDeg,
      axes,
    };
  }
}
