/**
 * @quasar/runtime Metric Geodetic Depth Ticks
 *
 * Implements:
 * 1. Metric geodetic depth tick calculations along volume vertical edges (0m to 5728m).
 * 2. 3D tick mark positions along 4 vertical corners of the volume bounding box.
 * 3. Human-readable and scientific tick formatting with units.
 */

export interface GeodeticDepthTick {
  depthM: number;
  normalizedW: number; // [0.0 = surface, 1.0 = 5727.917m]
  localZ: number;       // Scaled Z position in 3D scene [-0.5, 0.5] or downward
  formattedLabel: string;
}

export interface VolumeCornerAxis {
  cornerId: 'SW' | 'SE' | 'NW' | 'NE';
  cornerX: number; // -0.5 or +0.5
  cornerY: number; // -0.5 or +0.5
  ticks: GeodeticDepthTick[];
}

export class DepthTicksModel {
  private readonly _minDepthM: number;
  private readonly _maxDepthM: number;
  private _verticalExaggeration: number;
  private readonly _tickIntervalM: number;

  constructor(
    minDepthM = 0.0,
    maxDepthM = 5727.917,
    verticalExaggeration = 25.0,
    tickIntervalM = 1000.0
  ) {
    this._minDepthM = minDepthM;
    this._maxDepthM = maxDepthM;
    this._verticalExaggeration = Math.max(1.0, Math.min(100.0, verticalExaggeration));
    this._tickIntervalM = tickIntervalM;
  }

  get minDepthM(): number {
    return this._minDepthM;
  }

  get maxDepthM(): number {
    return this._maxDepthM;
  }

  get verticalExaggeration(): number {
    return this._verticalExaggeration;
  }

  set verticalExaggeration(val: number) {
    this._verticalExaggeration = Math.max(1.0, Math.min(100.0, val));
  }

  /**
   * Generates standard discrete metric depth ticks across the full ocean depth column.
   */
  generateDepthTicks(customIntervalM?: number): GeodeticDepthTick[] {
    const interval = customIntervalM ?? this._tickIntervalM;
    const ticks: GeodeticDepthTick[] = [];

    // Surface tick at 0m
    ticks.push(this._createTick(0.0));

    // Intermediate ticks
    let currentDepth = interval;
    while (currentDepth < this._maxDepthM - 200.0) {
      ticks.push(this._createTick(currentDepth));
      currentDepth += interval;
    }

    // Maximum abyssal depth tick
    ticks.push(this._createTick(this._maxDepthM));

    return ticks;
  }

  private _createTick(depthM: number): GeodeticDepthTick {
    const range = this._maxDepthM - this._minDepthM;
    const normalizedW = range > 0 ? (depthM - this._minDepthM) / range : 0.0;
    // Map normalized depth [0, 1] to local Z (surface at Z = 0.5, seabed at Z = -0.5 or scaled by exaggeration)
    const localZ = 0.5 - normalizedW * 1.0;

    let formattedLabel: string;
    if (depthM === 0.0) {
      formattedLabel = '0 m (Surface)';
    } else if (Math.abs(depthM - this._maxDepthM) < 1.0) {
      formattedLabel = `${Math.round(depthM).toLocaleString()} m (Seafloor Max)`;
    } else {
      formattedLabel = `${Math.round(depthM).toLocaleString()} m`;
    }

    return {
      depthM,
      normalizedW,
      localZ,
      formattedLabel,
    };
  }

  /**
   * Computes tick positions and tick tick line segments for all 4 vertical bounding box corners.
   */
  generateCornerAxes(tickLength = 0.03): VolumeCornerAxis[] {
    const ticks = this.generateDepthTicks();
    const corners: Array<{ id: 'SW' | 'SE' | 'NW' | 'NE'; x: number; y: number }> = [
      { id: 'SW', x: -0.5, y: -0.5 },
      { id: 'SE', x:  0.5, y: -0.5 },
      { id: 'NW', x: -0.5, y:  0.5 },
      { id: 'NE', x:  0.5, y:  0.5 },
    ];

    return corners.map((c) => ({
      cornerId: c.id,
      cornerX: c.x,
      cornerY: c.y,
      ticks: ticks.map((t) => ({ ...t })),
    }));
  }
}
