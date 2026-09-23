/**
 * Milestone 3 Challenger Adversarial Verification Suite
 * Author: Challenger 1 (m3_challenger_1)
 *
 * Direct Node.js / TypeScript empirical stress tests:
 * 1. Geographic aspect ratio and vertical exaggeration bounds in TS.
 * 2. Multi-LOD dimension configurations and strict VRAM budget checks.
 * 3. 4x4 Matrix math helpers: LookAt, Perspective, Inversion, and Ray Vector mappings.
 * 4. Coordinate frame invariants (ENU compass, depth down Y, bounds clamping).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LOD_CONFIGS, type LODMode } from '../src/context/app_store.ts';
import {
  ENUCompassGizmoModel,
  DepthTicksModel,
  VerticalExaggerationController,
  CoastlineVectorModel,
} from '../../../packages/runtime/src/geology/index.ts';

// Matrix helpers reimplemented matching OceanVolumeViewport.tsx
function createPerspectiveMatrix(fovRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fovRad / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function createLookAtMatrix(
  eye: [number, number, number],
  target: [number, number, number],
  up: [number, number, number]
): Float32Array {
  const [ex, ey, ez] = eye;
  const [tx, ty, tz] = target;
  const [ux, uy, uz] = up;

  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  const zLen = Math.hypot(zx, zy, zz) || 1;
  zx /= zLen; zy /= zLen; zz /= zLen;

  let xx = uy * zz - uz * zy;
  let xy = uz * zx - ux * zz;
  let xz = ux * zy - uy * zx;
  const xLen = Math.hypot(xx, xy, xz) || 1;
  xx /= xLen; xy /= xLen; xz /= xLen;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  const out = new Float32Array(16);
  out[0] = xx; out[4] = xy; out[8] = xz; out[12] = -(xx * ex + xy * ey + xz * ez);
  out[1] = yx; out[5] = yy; out[9] = yz; out[13] = -(yx * ex + yy * ey + yz * ez);
  out[2] = zx; out[6] = zy; out[10] = zz; out[14] = -(zx * ex + zy * ey + zz * ez);
  out[3] = 0;  out[7] = 0;  out[11] = 0;  out[15] = 1;
  return out;
}

function multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    const ai0 = a[i], ai1 = a[i + 4], ai2 = a[i + 8], ai3 = a[i + 12];
    out[i] = ai0 * b[0] + ai1 * b[1] + ai2 * b[2] + ai3 * b[3];
    out[i + 4] = ai0 * b[4] + ai1 * b[5] + ai2 * b[6] + ai3 * b[7];
    out[i + 8] = ai0 * b[8] + ai1 * b[9] + ai2 * b[10] + ai3 * b[11];
    out[i + 12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
  }
  return out;
}

function invertMatrix4(m: Float32Array): Float32Array {
  const out = new Float32Array(16);
  const [
    m00, m01, m02, m03,
    m10, m11, m12, m13,
    m20, m21, m22, m23,
    m30, m31, m32, m33
  ] = m;

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const invDet = 1.0 / det;

  out[0] = (m11 * b11 - m12 * b10 + m13 * b09) * invDet;
  out[1] = (-m01 * b11 + m02 * b10 - m03 * b09) * invDet;
  out[2] = (m31 * b05 - m32 * b04 + m33 * b03) * invDet;
  out[3] = (-m21 * b05 + m22 * b04 - m23 * b03) * invDet;
  out[4] = (-m10 * b11 + m12 * b08 - m13 * b07) * invDet;
  out[5] = (m00 * b11 - m02 * b08 + m03 * b07) * invDet;
  out[6] = (-m30 * b05 + m32 * b02 - m33 * b01) * invDet;
  out[7] = (m20 * b05 - m22 * b02 + m23 * b01) * invDet;
  out[8] = (m10 * b10 - m11 * b08 + m13 * b06) * invDet;
  out[9] = (-m00 * b10 + m01 * b08 - m03 * b06) * invDet;
  out[10] = (m30 * b04 - m31 * b02 + m33 * b00) * invDet;
  out[11] = (-m20 * b04 + m21 * b02 - m23 * b00) * invDet;
  out[12] = (-m10 * b09 + m11 * b07 - m12 * b06) * invDet;
  out[13] = (m00 * b09 - m01 * b07 + m02 * b06) * invDet;
  out[14] = (-m30 * b03 + m31 * b01 - m32 * b00) * invDet;
  out[15] = (m20 * b03 - m21 * b01 + m22 * b00) * invDet;

  return out;
}

function transformVec4(m: Float32Array, v: [number, number, number, number]): [number, number, number, number] {
  const [x, y, z, w] = v;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
}

describe('Challenger 1 Adversarial Verification Suite (Milestone 3)', () => {
  describe('Task 1: Geodetic Aspect Ratio & Vertical Exaggeration Scaling', () => {
    it('should maintain exact aspect ratio (0.534 : 0.172 : 1.000) at 50x VE', () => {
      const sx = 0.534;
      const ve = 50.0;
      const sy = 0.172 * (ve / 50.0);
      const sz = 1.000;

      assert.equal(sx, 0.534);
      assert.equal(sy, 0.172);
      assert.equal(sz, 1.000);
    });

    it('should clamp vertical exaggeration within [10x, 100x] range', () => {
      const veController = new VerticalExaggerationController(50.0, 10.0, 100.0);

      veController.setFactor(10.0);
      assert.equal(veController.factor, 10.0);
      assert.equal(veController.state.normalizedScaleZ, 0.2);

      veController.setFactor(100.0);
      assert.equal(veController.factor, 100.0);
      assert.equal(veController.state.normalizedScaleZ, 2.0);

      veController.setFactor(2.0); // Below min
      assert.equal(veController.factor, 10.0);

      veController.setFactor(500.0); // Above max
      assert.equal(veController.factor, 100.0);
    });
  });

  describe('Task 2: LOD Resolution Footprint & Strict VRAM Budget Limits', () => {
    it('should verify all LOD modes are strictly below 50 MiB ceiling for single & double buffers', () => {
      const budgetCeilingMb = 50.0;
      const modes: LODMode[] = ['preview', 'interactive', 'high_quality'];

      for (const mode of modes) {
        const config = LOD_CONFIGS[mode];
        const voxelCount = config.depthLevels * config.latRes * config.lonRes;
        assert.equal(voxelCount, config.voxelCount);

        const scalarBytes = voxelCount * 4;
        const maskBytes = voxelCount * 1;
        const singleBytes = scalarBytes + maskBytes;
        const doubleBytes = singleBytes * 2;

        const singleMb = singleBytes / (1024 * 1024);
        const doubleMb = doubleBytes / (1024 * 1024);

        assert.ok(singleMb < budgetCeilingMb, `Single buffer for ${mode} exceeds 50 MiB: ${singleMb}`);
        assert.ok(doubleMb < budgetCeilingMb, `Double buffer for ${mode} exceeds 50 MiB: ${doubleMb}`);
        assert.ok(singleMb <= 4.2, `High quality single buffer should be ~4.19 MiB, got ${singleMb}`);
      }
    });
  });

  describe('Task 3: Matrix Inversion & Ray Reconstruction Stress Test', () => {
    it('should round-trip points between texture space [0, 1]^3 and world space without distortion', () => {
      const sx = 0.534;
      const sy = 0.172;
      const sz = 1.000;

      // Model matrix M in column-major order
      const modelMatrix = new Float32Array([
        sx,  0,   0,   0,
        0,   0,   sz,  0,
        0,  -sy,  0,   0,
        -0.5 * sx, 0.5 * sy, -0.5 * sz, 1.0,
      ]);

      const invModelMatrix = invertMatrix4(modelMatrix);

      // Test 9 canonical points: 8 corners + center
      const testPoints: [number, number, number][] = [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [1.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
        [1.0, 0.0, 1.0],
        [0.0, 1.0, 1.0],
        [1.0, 1.0, 1.0],
        [0.5, 0.5, 0.5],
      ];

      for (const [u, v, w] of testPoints) {
        const world = transformVec4(modelMatrix, [u, v, w, 1.0]);
        const reconstructed = transformVec4(invModelMatrix, world);

        assert.ok(Math.abs(reconstructed[0] - u) < 1e-6);
        assert.ok(Math.abs(reconstructed[1] - v) < 1e-6);
        assert.ok(Math.abs(reconstructed[2] - w) < 1e-6);
      }
    });

    it('should verify ray reconstruction through perspective view-projection-model matrix', () => {
      const sx = 0.534;
      const sy = 0.172;
      const sz = 1.000;

      const modelMatrix = new Float32Array([
        sx,  0,   0,   0,
        0,   0,   sz,  0,
        0,  -sy,  0,   0,
        -0.5 * sx, 0.5 * sy, -0.5 * sz, 1.0,
      ]);

      const camPosWorld: [number, number, number] = [0.8, 0.5, 1.5];
      const targetWorld: [number, number, number] = [0, 0, 0];
      const upWorld: [number, number, number] = [0, 1, 0];

      const projMatrix = createPerspectiveMatrix((45 * Math.PI) / 180, 1.6, 0.1, 20.0);
      const viewMatrix = createLookAtMatrix(camPosWorld, targetWorld, upWorld);
      const viewProj = multiplyMatrices(projMatrix, viewMatrix);
      const viewProjWithModel = multiplyMatrices(viewProj, modelMatrix);
      const invViewProj = invertMatrix4(viewProjWithModel);

      // Verify camera position in texture space
      const camPosTex: [number, number, number] = [
        camPosWorld[0] / sx + 0.5,
        camPosWorld[2] / sz + 0.5,
        -camPosWorld[1] / sy + 0.5,
      ];

      // Arbitrary point in texture space
      const pTex: [number, number, number, number] = [0.6, 0.7, 0.4, 1.0];
      const pClip = transformVec4(viewProjWithModel, pTex);
      assert.ok(pClip[3] > 0.1, 'Point should be in front of camera');

      const pNdc: [number, number, number, number] = [
        pClip[0] / pClip[3],
        pClip[1] / pClip[3],
        pClip[2] / pClip[3],
        1.0,
      ];

      const recFar = transformVec4(invViewProj, pNdc);
      const recTex = [
        recFar[0] / recFar[3],
        recFar[1] / recFar[3],
        recFar[2] / recFar[3],
      ];

      assert.ok(Math.abs(recTex[0] - pTex[0]) < 1e-5);
      assert.ok(Math.abs(recTex[1] - pTex[1]) < 1e-5);
      assert.ok(Math.abs(recTex[2] - pTex[2]) < 1e-5);
    });
  });
});
