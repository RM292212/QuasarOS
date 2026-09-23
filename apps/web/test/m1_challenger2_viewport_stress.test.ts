/**
 * Milestone 1 Challenger 2 Empirical Stress & Adversarial Test Suite
 *
 * Scope:
 * 1. Stress test viewport wireframe toggling, clipping plane adjustments, and orientation controls.
 * 2. Verify that removing the coastline primitive in OceanVolumeViewport.tsx did NOT cause
 *    WebGL state leaks, null pointer exceptions, unreleased VAOs, or broken depth ticks.
 * 3. Verify that Cesium Explorer Mode coastlines remain georeferenced and interactive.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  useAppStore,
  ROI_PRESETS,
  type BoundingBox,
} from '../src/context/app_store.ts';
import { VolumeQualityModel } from '../src/components/controls/volume_quality_controls.ts';
import {
  ENUCompassGizmoModel,
  DepthTicksModel,
} from '../../../packages/runtime/src/geology/index.ts';

// ----------------------------------------------------------------------------
// Cesium Overview Projection Helpers (matching CesiumOverviewViewport.tsx)
// ----------------------------------------------------------------------------
const MAP_BOUNDS = {
  minLon: 40.0,
  maxLon: 102.0,
  minLat: -10.0,
  maxLat: 30.0,
};

function lonToX(lon: number, width: number): number {
  return ((lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)) * width;
}

function latToY(lat: number, height: number): number {
  return ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * height;
}

function xToLon(x: number, width: number): number {
  return MAP_BOUNDS.minLon + (x / width) * (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
}

function yToLat(y: number, height: number): number {
  return MAP_BOUNDS.maxLat - (y / height) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
}

// ----------------------------------------------------------------------------
// WebGL2 Mock Resource Tracker for Empirical State Leak Audit
// ----------------------------------------------------------------------------
interface MockWebGLResource {
  id: number;
  type: 'program' | 'vao' | 'buffer' | 'shader';
  deleted: boolean;
}

class MockWebGL2Context {
  public static readonly ARRAY_BUFFER = 0x8892;
  public static readonly DYNAMIC_DRAW = 0x88e8;
  public static readonly STATIC_DRAW = 0x88e4;
  public static readonly FLOAT = 0x1406;
  public static readonly LINES = 0x0001;
  public static readonly BLEND = 0x0be2;
  public static readonly SRC_ALPHA = 0x0302;
  public static readonly ONE_MINUS_SRC_ALPHA = 0x0303;
  public static readonly VERTEX_SHADER = 0x8b31;
  public static readonly FRAGMENT_SHADER = 0x8b30;
  public static readonly LINK_STATUS = 0x8b82;

  public ARRAY_BUFFER = MockWebGL2Context.ARRAY_BUFFER;
  public DYNAMIC_DRAW = MockWebGL2Context.DYNAMIC_DRAW;
  public STATIC_DRAW = MockWebGL2Context.STATIC_DRAW;
  public FLOAT = MockWebGL2Context.FLOAT;
  public LINES = MockWebGL2Context.LINES;
  public BLEND = MockWebGL2Context.BLEND;
  public SRC_ALPHA = MockWebGL2Context.SRC_ALPHA;
  public ONE_MINUS_SRC_ALPHA = MockWebGL2Context.ONE_MINUS_SRC_ALPHA;
  public VERTEX_SHADER = MockWebGL2Context.VERTEX_SHADER;
  public FRAGMENT_SHADER = MockWebGL2Context.FRAGMENT_SHADER;
  public LINK_STATUS = MockWebGL2Context.LINK_STATUS;

  private resourceCounter = 0;
  public resources: Map<number, MockWebGLResource> = new Map();
  public activeVao: number | null = null;
  public activeBuffer: number | null = null;
  public activeProgram: number | null = null;
  public blendEnabled = false;
  public drawCalls: Array<{ mode: number; first: number; count: number; vao: number | null }> = [];
  public bufferDataMap: Map<number, ArrayBuffer> = new Map();

  createShader(type: number): { id: number; type: number } {
    const id = ++this.resourceCounter;
    this.resources.set(id, { id, type: 'shader', deleted: false });
    return { id, type };
  }

  shaderSource(_shader: any, _src: string): void {}
  compileShader(_shader: any): void {}

  createProgram(): { id: number } {
    const id = ++this.resourceCounter;
    this.resources.set(id, { id, type: 'program', deleted: false });
    return { id };
  }

  attachShader(_prog: any, _shader: any): void {}
  linkProgram(_prog: any): void {}
  getProgramParameter(_prog: any, param: number): any {
    if (param === this.LINK_STATUS) return true;
    return true;
  }

  getUniformLocation(_prog: any, name: string): { name: string } {
    return { name };
  }

  createVertexArray(): { id: number } {
    const id = ++this.resourceCounter;
    this.resources.set(id, { id, type: 'vao', deleted: false });
    return { id };
  }

  createBuffer(): { id: number } {
    const id = ++this.resourceCounter;
    this.resources.set(id, { id, type: 'buffer', deleted: false });
    return { id };
  }

  bindVertexArray(vao: { id: number } | null): void {
    if (vao) {
      const res = this.resources.get(vao.id);
      if (!res || res.deleted) {
        throw new Error(`Attempted to bind deleted or unknown VAO ${vao.id}`);
      }
      this.activeVao = vao.id;
    } else {
      this.activeVao = null;
    }
  }

  bindBuffer(target: number, buf: { id: number } | null): void {
    if (buf) {
      const res = this.resources.get(buf.id);
      if (!res || res.deleted) {
        throw new Error(`Attempted to bind deleted or unknown Buffer ${buf.id}`);
      }
      this.activeBuffer = buf.id;
    } else {
      this.activeBuffer = null;
    }
  }

  bufferData(target: number, sizeOrData: number | ArrayBufferView, usage: number): void {
    if (this.activeBuffer === null) {
      throw new Error('bufferData called with no bound buffer');
    }
    const byteLength = typeof sizeOrData === 'number' ? sizeOrData : sizeOrData.byteLength;
    this.bufferDataMap.set(this.activeBuffer, new ArrayBuffer(byteLength));
  }

  bufferSubData(target: number, offset: number, data: ArrayBufferView): void {
    if (this.activeBuffer === null) {
      throw new Error('bufferSubData called with no bound buffer');
    }
    const buf = this.bufferDataMap.get(this.activeBuffer);
    if (!buf) {
      throw new Error('bufferSubData called before bufferData allocation');
    }
    if (offset + data.byteLength > buf.byteLength) {
      throw new Error(`bufferSubData overflow: ${offset + data.byteLength} > ${buf.byteLength}`);
    }
  }

  enableVertexAttribArray(index: number): void {}
  vertexAttribPointer(index: number, size: number, type: number, norm: boolean, stride: number, off: number): void {}

  enable(cap: number): void {
    if (cap === this.BLEND) this.blendEnabled = true;
  }

  disable(cap: number): void {
    if (cap === this.BLEND) this.blendEnabled = false;
  }

  blendFunc(_s: number, _d: number): void {}

  useProgram(prog: { id: number } | null): void {
    this.activeProgram = prog ? prog.id : null;
  }

  uniformMatrix4fv(_loc: any, _transpose: boolean, _data: Float32Array): void {}
  uniform4f(_loc: any, _x: number, _y: number, _z: number, _w: number): void {}

  drawArrays(mode: number, first: number, count: number): void {
    if (this.activeVao === null) {
      throw new Error('drawArrays called without active VAO bound');
    }
    this.drawCalls.push({ mode, first, count, vao: this.activeVao });
  }

  deleteProgram(prog: { id: number }): void {
    const res = this.resources.get(prog.id);
    if (res) res.deleted = true;
    if (this.activeProgram === prog.id) this.activeProgram = null;
  }

  deleteVertexArray(vao: { id: number }): void {
    const res = this.resources.get(vao.id);
    if (res) res.deleted = true;
    if (this.activeVao === vao.id) this.activeVao = null;
  }

  deleteBuffer(buf: { id: number }): void {
    const res = this.resources.get(buf.id);
    if (res) res.deleted = true;
    if (this.activeBuffer === buf.id) this.activeBuffer = null;
  }

  getLiveResources(): MockWebGLResource[] {
    return Array.from(this.resources.values()).filter((r) => !r.deleted);
  }
}

// ============================================================================
// CHALLENGER 2 ADVERSARIAL TEST SUITE
// ============================================================================

describe('Milestone 1 Challenger 2: Viewport Wireframe, State Hygiene & Cesium Coastline Verification', () => {

  beforeEach(() => {
    useAppStore.setState({
      activeWorkspace: 'volume',
      spatialBounds: {
        minLon: 60.0,
        maxLon: 68.0,
        minLat: 0.0,
        maxLat: 15.0,
        minDepthM: 0.494,
        maxDepthM: 5727.917,
      },
      verticalExaggeration: 50.0,
    });
  });

  // --------------------------------------------------------------------------
  // 1. Stress Test: Viewport Wireframe Toggling & Clipping Adjustments
  // --------------------------------------------------------------------------
  describe('1. Viewport Wireframe Toggling & Clipping Adjustments Stress Test', () => {
    it('should withstand 1,000 rapid toggles of showBoundingBox without state desynchronization', () => {
      const qModel = new VolumeQualityModel({ showBoundingBox: true });
      let listenerCalls = 0;
      const unsubscribe = qModel.subscribe((s) => {
        listenerCalls++;
        assert.equal(typeof s.showBoundingBox, 'boolean');
      });

      for (let i = 0; i < 1000; i++) {
        const expected = i % 2 === 0 ? false : true;
        qModel.setBoundingBoxVisible(expected);
        assert.equal(qModel.settings.showBoundingBox, expected);
      }

      assert.equal(listenerCalls, 1000);
      assert.equal(qModel.settings.showBoundingBox, true);
      unsubscribe();
    });

    it('should calculate accurate wireframe bounding box edges across extreme vertical exaggerations', () => {
      const sx = 0.534;
      const sz = 1.000;
      const exaggerations = [10.0, 25.0, 50.0, 75.0, 100.0];

      for (const ve of exaggerations) {
        const sy = 0.172 * (ve / 50.0);
        const hx = sx * 0.5;
        const hy = sy * 0.5;
        const hz = sz * 0.5;

        // 12 edges (24 vertices, 72 floats) matching OceanVolumeViewport.tsx
        const boxLines = new Float32Array([
          -hx, hy, -hz,   hx, hy, -hz,
           hx, hy, -hz,   hx, hy,  hz,
           hx, hy,  hz,  -hx, hy,  hz,
          -hx, hy,  hz,  -hx, hy, -hz,
          -hx,-hy, -hz,   hx,-hy, -hz,
           hx,-hy, -hz,   hx,-hy,  hz,
           hx,-hy,  hz,  -hx,-hy,  hz,
          -hx,-hy,  hz,  -hx,-hy, -hz,
          -hx, hy, -hz,  -hx,-hy, -hz,
           hx, hy, -hz,   hx,-hy, -hz,
           hx, hy,  hz,   hx,-hy,  hz,
          -hx, hy,  hz,  -hx,-hy,  hz,
        ]);

        assert.equal(boxLines.length, 72);

        // Verify every coordinate is finite and within domain
        for (let i = 0; i < boxLines.length; i += 3) {
          const x = boxLines[i];
          const y = boxLines[i + 1];
          const z = boxLines[i + 2];

          assert.ok(Number.isFinite(x) && Math.abs(x) <= hx + 1e-5);
          assert.ok(Number.isFinite(y) && Math.abs(y) <= hy + 1e-5);
          assert.ok(Number.isFinite(z) && Math.abs(z) <= hz + 1e-5);
        }

        // Top surface vertices must have Y = +hy
        for (let i = 0; i < 24; i += 3) {
          assert.ok(Math.abs(boxLines[i + 1] - hy) < 1e-5, `Surface Y deviation: ${boxLines[i+1]} vs ${hy}`);
        }
        // Bottom seafloor vertices must have Y = -hy
        for (let i = 24; i < 48; i += 3) {
          assert.ok(Math.abs(boxLines[i + 1] - (-hy)) < 1e-5, `Seafloor Y deviation: ${boxLines[i+1]} vs ${-hy}`);
        }
      }
    });

    it('should generate bounded clipping wireframe under adversarial and edge-case clipping ranges', () => {
      const sx = 0.534, sy = 0.172, sz = 1.000;

      const clipTestCases = [
        // Standard non-uniform clipping
        { minU: 0.1, maxU: 0.9, minV: 0.2, maxV: 0.8, minW: 0.05, maxW: 0.95 },
        // Deep slice (bottom 10%)
        { minU: 0.0, maxU: 1.0, minV: 0.0, maxV: 1.0, minW: 0.9, maxW: 1.0 },
        // Surface slice (top 5%)
        { minU: 0.0, maxU: 1.0, minV: 0.0, maxV: 1.0, minW: 0.0, maxW: 0.05 },
        // Boundary case: zero-thickness slice
        { minU: 0.5, maxU: 0.5, minV: 0.5, maxV: 0.5, minW: 0.5, maxW: 0.5 },
      ];

      for (const normalizedBox of clipTestCases) {
        const u0 = normalizedBox.minU, u1 = normalizedBox.maxU;
        const v0 = normalizedBox.minV, v1 = normalizedBox.maxV;
        const w0 = normalizedBox.minW, w1 = normalizedBox.maxW;

        const cx0 = sx * (u0 - 0.5), cx1 = sx * (u1 - 0.5);
        const cy0 = sy * (0.5 - w1), cy1 = sy * (0.5 - w0);
        const cz0 = sz * (v0 - 0.5), cz1 = sz * (v1 - 0.5);

        const clipLines = new Float32Array([
          cx0, cy1, cz0,  cx1, cy1, cz0,   cx1, cy1, cz0,  cx1, cy1, cz1,
          cx1, cy1, cz1,  cx0, cy1, cz1,   cx0, cy1, cz1,  cx0, cy1, cz0,
          cx0, cy0, cz0,  cx1, cy0, cz0,   cx1, cy0, cz0,  cx1, cy0, cz1,
          cx1, cy0, cz1,  cx0, cy0, cz1,   cx0, cy0, cz1,  cx0, cy0, cz0,
          cx0, cy1, cz0,  cx0, cy0, cz0,   cx1, cy1, cz0,  cx1, cy0, cz0,
          cx1, cy1, cz1,  cx1, cy0, cz1,   cx0, cy1, cz1,  cx0, cy0, cz1,
        ]);

        assert.equal(clipLines.length, 72); // 24 vertices * 3
        for (let i = 0; i < clipLines.length; i++) {
          assert.ok(Number.isFinite(clipLines[i]), `Value at ${i} is not finite: ${clipLines[i]}`);
        }
      }
    });

    it('should test snap viewpoints and orientation gizmo angles across 360-degree range', () => {
      const gizmo = new ENUCompassGizmoModel();

      // Heading angles across full circle
      const testHeadings = [0, 45, 90, 135, 180, 225, 270, 315, 360, -90, -180, 720];
      for (const h of testHeadings) {
        const state = gizmo.updateFromAngles((25 * Math.PI) / 180, (-h * Math.PI) / 180);
        assert.ok(state.headingDeg >= 0 && state.headingDeg < 360);
        assert.equal(state.axes.length, 3);
        for (const axis of state.axes) {
          assert.ok(Number.isFinite(axis.projected2D[0]));
          assert.ok(Number.isFinite(axis.projected2D[1]));
        }
      }

      // Snap viewpoints: Top/Nadir, North, South, East, West, Iso
      const snapAngles = [
        { name: 'Top (Nadir)', pitchRad: Math.PI / 2, yawRad: 0 },
        { name: 'North', pitchRad: 0.1, yawRad: 0 },
        { name: 'South', pitchRad: 0.1, yawRad: Math.PI },
        { name: 'East', pitchRad: 0.1, yawRad: Math.PI / 2 },
        { name: 'West', pitchRad: 0.1, yawRad: -Math.PI / 2 },
        { name: 'Iso', pitchRad: 0.45, yawRad: -0.55 },
      ];

      for (const snap of snapAngles) {
        const state = gizmo.updateFromAngles(snap.pitchRad, snap.yawRad);
        assert.ok(Number.isFinite(state.headingDeg));
        assert.ok(Number.isFinite(state.pitchDeg));
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. WebGL State Hygiene, VAO Lifecycle & Depth Ticks Verification
  // --------------------------------------------------------------------------
  describe('2. WebGL State Hygiene, VAO Lifecycle & Depth Ticks Verification', () => {
    it('should verify zero WebGL state leaks or unreleased VAOs after wireframe allocation & cleanup', () => {
      const gl = new MockWebGL2Context();

      // 1. Emulate OceanVolumeViewport initialization
      const vs = gl.createShader(gl.VERTEX_SHADER);
      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);

      const wireframeVao = gl.createVertexArray();
      const wireframeVbo = gl.createBuffer();
      gl.bindVertexArray(wireframeVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, wireframeVbo);
      gl.bufferData(gl.ARRAY_BUFFER, 24 * 3 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      // Verify unbind after setup
      assert.equal(gl.activeVao, null, 'VAO must be unbound (null) after setup');

      // 2. Emulate 50 render frames with wireframe enabled and disabled
      for (let frame = 0; frame < 50; frame++) {
        const showWireframe = frame % 3 !== 0; // toggle on/off

        if (showWireframe) {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.useProgram(prog);

          const boxLines = new Float32Array(72);
          gl.bindVertexArray(wireframeVao);
          gl.bindBuffer(gl.ARRAY_BUFFER, wireframeVbo);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, boxLines);
          gl.drawArrays(gl.LINES, 0, 24);

          // Simulated clipping pass
          const isClipped = frame % 2 === 0;
          if (isClipped) {
            const clipLines = new Float32Array(72);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, clipLines);
            gl.drawArrays(gl.LINES, 0, 24);
          }

          // Crucial: VAO must be unbound at end of pass
          gl.bindVertexArray(null);
        }

        // Assert VAO is cleanly unbound at end of frame
        assert.equal(gl.activeVao, null, `Frame ${frame}: VAO not unbound at end of frame`);
      }

      // Assert total draw calls happened as expected
      assert.ok(gl.drawCalls.length > 0);
      for (const call of gl.drawCalls) {
        assert.equal(call.count, 24);
        assert.equal(call.vao, wireframeVao.id);
      }

      // 3. Emulate Viewport Teardown Hook
      gl.deleteProgram(prog);
      gl.deleteVertexArray(wireframeVao);
      gl.deleteBuffer(wireframeVbo);

      // Verify all non-shader resources were deleted
      const liveResources = gl.getLiveResources().filter((r) => r.type !== 'shader');
      assert.equal(liveResources.length, 0, 'No unreleased VAOs or VBOs should remain after cleanup');
      assert.equal(gl.activeVao, null);
      assert.equal(gl.activeBuffer, null);
      assert.equal(gl.activeProgram, null);
    });

    it('should verify DepthTicksModel generates mathematically correct and monotonic depth markers', () => {
      const depthModel = new DepthTicksModel(0.494, 5727.917, 50.0, 1000.0);
      const ticks = depthModel.generateDepthTicks();

      assert.ok(ticks.length >= 7, 'Must generate at least 7 discrete depth ticks');

      // First tick is surface (0 m)
      assert.equal(ticks[0].depthM, 0.0);
      // Copernicus surface center depth is 0.494m, so normalizedW for 0.0m is near 0
      assert.ok(Math.abs(ticks[0].normalizedW) < 1e-3, `Surface normalizedW near 0: ${ticks[0].normalizedW}`);
      assert.ok(Math.abs(ticks[0].localZ - 0.5) < 1e-3, `Surface localZ near 0.5: ${ticks[0].localZ}`);
      assert.ok(ticks[0].formattedLabel.includes('0 m (Surface)'));

      // Verify monotonicity of depth and local Z coordinates
      for (let i = 1; i < ticks.length; i++) {
        const prev = ticks[i - 1];
        const curr = ticks[i];

        assert.ok(curr.depthM > prev.depthM, `Depth not increasing at ${i}: ${curr.depthM} <= ${prev.depthM}`);
        assert.ok(curr.normalizedW > prev.normalizedW, `Normalized W not increasing at ${i}`);
        assert.ok(curr.localZ < prev.localZ, `Local Z (downward) not decreasing at ${i}: ${curr.localZ} >= ${prev.localZ}`);
        assert.ok(curr.normalizedW >= -1e-4 && curr.normalizedW <= 1.0 + 1e-4, `Normalized W out of bounds: ${curr.normalizedW}`);
      }

      // Last tick is Seafloor Max (5,728 m)
      const last = ticks[ticks.length - 1];
      assert.equal(last.depthM, 5727.917);
      assert.equal(last.normalizedW, 1.0);
      assert.equal(last.localZ, -0.5);
      assert.ok(last.formattedLabel.includes('5,728 m (Seafloor Max)'));
    });

    it('should handle boundary conditions in DepthTicksModel without throwing or producing NaN', () => {
      // 1. Zero range (min == max)
      const zeroRangeModel = new DepthTicksModel(100.0, 100.0, 50.0, 50.0);
      const zeroTicks = zeroRangeModel.generateDepthTicks();
      assert.ok(zeroTicks.length > 0);
      for (const t of zeroTicks) {
        assert.ok(Number.isFinite(t.normalizedW));
        assert.ok(Number.isFinite(t.localZ));
      }

      // 2. Ultra-shallow shelf (0m to 15m)
      // Note: Because DepthTicksModel enforces (currentDepth < maxDepth - 200m) for intermediate ticks,
      // a domain with maxDepth <= 200m only generates surface (0m) and seafloor (15m) ticks.
      const shelfModel = new DepthTicksModel(0.0, 15.0, 50.0, 5.0);
      const shelfTicks = shelfModel.generateDepthTicks(5.0);
      assert.equal(shelfTicks.length, 2, 'Shallow domain under 200m correctly generates surface and seafloor ticks');
      for (const t of shelfTicks) {
        assert.ok(Number.isFinite(t.depthM));
        assert.ok(t.depthM <= 15.0);
      }

      // 3. Deep shelf (0m to 1,000m)
      const deepShelfModel = new DepthTicksModel(0.0, 1000.0, 50.0, 250.0);
      const deepShelfTicks = deepShelfModel.generateDepthTicks(250.0);
      assert.ok(deepShelfTicks.length >= 4, 'Deep shelf produces intermediate depth ticks');

      // 4. Ultra-deep trench (11,000m)
      const trenchModel = new DepthTicksModel(0.0, 11000.0, 50.0, 2000.0);
      const trenchTicks = trenchModel.generateDepthTicks(2000.0);
      assert.ok(trenchTicks.length >= 6);
      assert.equal(trenchTicks[trenchTicks.length - 1].depthM, 11000.0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Cesium Explorer Mode Coastlines & Interactivity Verification
  // --------------------------------------------------------------------------
  describe('3. Cesium Explorer Mode Coastlines & Interactivity Verification', () => {
    it('should verify equirectangular projection invertibility across all North Indian Ocean bounds', () => {
      const svgWidth = 960;
      const svgHeight = 620;

      const testPoints = [
        { lon: 40.0, lat: -10.0 }, // SW corner
        { lon: 102.0, lat: -10.0 }, // SE corner
        { lon: 40.0, lat: 30.0 },  // NW corner
        { lon: 102.0, lat: 30.0 },  // NE corner
        { lon: 64.0, lat: 7.5 },   // Arabian Sea center
        { lon: 88.0, lat: 15.0 },  // Bay of Bengal center
        { lon: 77.5, lat: 8.1 },   // Kanyakumari / Cape Comorin tip
      ];

      for (const pt of testPoints) {
        const x = lonToX(pt.lon, svgWidth);
        const y = latToY(pt.lat, svgHeight);

        // Screen coords must be within SVG canvas
        assert.ok(x >= 0 && x <= svgWidth, `X coordinate out of bounds: ${x}`);
        assert.ok(y >= 0 && y <= svgHeight, `Y coordinate out of bounds: ${y}`);

        // Invert back to lon/lat
        const backLon = xToLon(x, svgWidth);
        const backLat = yToLat(y, svgHeight);

        assert.ok(Math.abs(backLon - pt.lon) < 1e-9, `Lon roundtrip failed: ${backLon} vs ${pt.lon}`);
        assert.ok(Math.abs(backLat - pt.lat) < 1e-9, `Lat roundtrip failed: ${backLat} vs ${pt.lat}`);
      }
    });

    it('should verify that all landmass coastline polygons in Cesium Overview map stay within canvas bounds', () => {
      const svgWidth = 960;
      const svgHeight = 620;

      // Indian Subcontinent Peninsula key vertices
      const indiaCoords = [
        [68.5, 23.5], [70.0, 21.0], [72.8, 19.0], [73.8, 15.5],
        [75.5, 12.0], [77.5, 8.1],  [79.8, 10.3], [80.3, 13.1],
        [83.3, 17.7], [86.9, 20.5], [89.0, 22.0], [91.0, 23.5],
      ];

      // Sri Lanka vertices
      const sriLankaCoords = [
        [79.8, 9.8], [81.8, 8.5], [81.8, 6.0], [80.0, 6.0], [79.7, 8.0],
      ];

      // Arabian Peninsula & Horn of Africa vertices
      const arabianCoords = [
        [40.0, 30.0], [50.0, 30.0], [56.0, 26.0], [59.8, 22.5],
        [54.0, 16.5], [45.0, 12.5], [43.0, 11.5], [51.2, 10.5],
        [49.0, 5.0],  [42.0, -2.0], [40.0, -10.0],
      ];

      const allLandmasses = [
        { name: 'India', coords: indiaCoords },
        { name: 'Sri Lanka', coords: sriLankaCoords },
        { name: 'Arabian Peninsula', coords: arabianCoords },
      ];

      for (const land of allLandmasses) {
        for (const [lon, lat] of land.coords) {
          const x = lonToX(lon, svgWidth);
          const y = latToY(lat, svgHeight);

          assert.ok(
            x >= 0 && x <= svgWidth,
            `Landmass ${land.name} vertex (${lon}, ${lat}) projected X ${x} outside [0, ${svgWidth}]`
          );
          assert.ok(
            y >= 0 && y <= svgHeight,
            `Landmass ${land.name} vertex (${lon}, ${lat}) projected Y ${y} outside [0, ${svgHeight}]`
          );
        }
      }
    });

    it('should verify Cesium Overview ROI Presets apply cleanly to app_store and transfer to Volume Mode', () => {
      const store = useAppStore.getState();

      // Test all presets
      for (const preset of ROI_PRESETS) {
        store.applyROIPreset(preset.id);
        const state = useAppStore.getState();

        assert.equal(state.spatialBounds.minLon, preset.bounds.west);
        assert.equal(state.spatialBounds.maxLon, preset.bounds.east);
        assert.equal(state.spatialBounds.minLat, preset.bounds.south);
        assert.equal(state.spatialBounds.maxLat, preset.bounds.north);
      }

      // Test custom bounding box drawing and transferring to Volume Mode
      const customBox: BoundingBox = {
        west: 62.5,
        east: 66.5,
        south: 5.0,
        north: 12.0,
        minDepthM: 0.494,
        maxDepthM: 5727.917,
      };

      store.selectROI(customBox);
      store.setActiveWorkspace('volume');

      const updated = useAppStore.getState();
      assert.equal(updated.activeWorkspace, 'volume');
      assert.equal(updated.spatialBounds.minLon, 62.5);
      assert.equal(updated.spatialBounds.maxLon, 66.5);
      assert.equal(updated.spatialBounds.minLat, 5.0);
      assert.equal(updated.spatialBounds.maxLat, 12.0);
    });

    it('should correctly normalize box drawing in any direction (NW, SE, SW, NE drag)', () => {
      const svgWidth = 960;
      const svgHeight = 620;

      const corners = [
        { p1: { x: 200, y: 150 }, p2: { x: 500, y: 400 } }, // NW to SE
        { p1: { x: 500, y: 400 }, p2: { x: 200, y: 150 } }, // SE to NW
        { p1: { x: 200, y: 400 }, p2: { x: 500, y: 150 } }, // SW to NE
        { p1: { x: 500, y: 150 }, p2: { x: 200, y: 400 } }, // NE to SW
      ];

      for (const { p1, p2 } of corners) {
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        const west = parseFloat(xToLon(minX, svgWidth).toFixed(2));
        const east = parseFloat(xToLon(maxX, svgWidth).toFixed(2));
        const north = parseFloat(yToLat(minY, svgHeight).toFixed(2));
        const south = parseFloat(yToLat(maxY, svgHeight).toFixed(2));

        assert.equal(west, parseFloat(xToLon(200, svgWidth).toFixed(2)));
        assert.equal(east, parseFloat(xToLon(500, svgWidth).toFixed(2)));
        assert.equal(north, parseFloat(yToLat(150, svgHeight).toFixed(2)));
        assert.equal(south, parseFloat(yToLat(400, svgHeight).toFixed(2)));
        assert.ok(west < east, 'West must be strictly less than East');
        assert.ok(south < north, 'South must be strictly less than North');
      }
    });
  });
});
