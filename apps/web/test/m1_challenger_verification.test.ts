/**
 * Milestone 1 Challenger Adversarial Verification Suite
 * Author: Challenger 1 (m1_challenger_1)
 * Role: EMPIRICAL CHALLENGER (critic, specialist)
 *
 * Empirical verification of Milestone 1:
 * Elimination of Unexplained Green Floating Lines in Scientific Viewport
 *
 * Requirements challenged:
 * 1. ZERO green line primitives can be generated or rendered in Scientific Volume Mode.
 * 2. Search all shader code (WebGL2 and WebGPU) and viewport components for potential
 *    secondary green line sources or debug curves.
 * 3. Verify that when 3D bounding wireframe is toggled on/off, only the 12 box edges
 *    toggle and no stray out-of-domain vertices appear.
 * 4. Verify architectural isolation between Scientific Volume Lab and Cesium Overview.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { VolumeQualityModel } from '../src/components/controls/volume_quality_controls.ts';
import { CoastlineVectorModel } from '../../../packages/runtime/src/geology/coastline_vectors.ts';

describe('Milestone 1 Challenger 1: Adversarial Verification of Green Line Elimination', () => {
  const projectRoot = process.cwd();
  const viewportPath = path.join(projectRoot, 'apps/web/src/components/viewport/OceanVolumeViewport.tsx');
  const overviewPath = path.join(projectRoot, 'apps/web/src/components/viewport/CesiumOverviewViewport.tsx');
  const webglShaderPath = path.join(projectRoot, 'packages/renderer-webgl2/src/shaders/volume_raymarch.glsl.ts');
  const webgpuShaderPath = path.join(projectRoot, 'packages/renderer-webgpu/src/shaders/volume_raymarch.wgsl.ts');

  describe('Challenge 1: Code-Level & AST Verification of OceanVolumeViewport.tsx', () => {
    const viewportCode = fs.readFileSync(viewportPath, 'utf-8');

    it('should confirm zero imports of CoastlineVectorModel in OceanVolumeViewport.tsx', () => {
      assert.ok(
        !viewportCode.includes('CoastlineVectorModel'),
        'OceanVolumeViewport.tsx must not import or reference CoastlineVectorModel'
      );
    });

    it('should confirm zero coastline VAO/VBO/Count references in OceanVolumeViewport.tsx', () => {
      assert.ok(!viewportCode.includes('coastlineVaoRef'), 'coastlineVaoRef must be completely removed');
      assert.ok(!viewportCode.includes('coastlineVboRef'), 'coastlineVboRef must be completely removed');
      assert.ok(!viewportCode.includes('coastlineCountRef'), 'coastlineCountRef must be completely removed');
    });

    it('should confirm zero emerald green color uniform4f calls in OceanVolumeViewport.tsx', () => {
      // The original bug used uniform4f(..., 0.38, 0.82, 0.55, 0.75) for emerald green coastlines
      assert.ok(
        !viewportCode.includes('0.38, 0.82'),
        'Found legacy emerald green uniform4f color definition in OceanVolumeViewport.tsx'
      );
      assert.ok(
        !viewportCode.includes('0.55, 0.75'),
        'Found legacy emerald green uniform4f alpha/blue parameters in OceanVolumeViewport.tsx'
      );
    });

    it('should confirm the ONLY line draw calls in OceanVolumeViewport.tsx are the 24-vertex bounding and clipping boxes', () => {
      // Find all occurrences of drawArrays
      const drawArraysMatches = [...viewportCode.matchAll(/currentGl\.drawArrays\([^)]+\)/g)].map((m) => m[0]);
      assert.equal(drawArraysMatches.length, 2, 'There must be exactly 2 drawArrays calls in OceanVolumeViewport.tsx');

      // Both calls must be for 24 vertices (12 edges * 2 vertices)
      for (const call of drawArraysMatches) {
        assert.ok(
          call.includes('currentGl.LINES, 0, 24'),
          `Draw call must draw exactly 24 line vertices, got: ${call}`
        );
      }
    });

    it('should confirm the only uniform4f colors in wireframe passes are subtle cyan and amber', () => {
      const colorMatches = [...viewportCode.matchAll(/currentGl\.uniform4f\(wireframeUColorLocRef\.current,\s*([^)]+)\)/g)];
      assert.equal(colorMatches.length, 2, 'There must be exactly 2 wireframe color uniform assignments');

      const colors = colorMatches.map((m) => m[1].replace(/\s+/g, ''));
      // Subtle cyan: (0.22, 0.65, 0.95, 0.45)
      assert.ok(colors[0].includes('0.22,0.65,0.95,0.45'), `Expected subtle cyan bounding box, got: ${colors[0]}`);
      // Amber clipping: (0.95, 0.65, 0.15, 0.85)
      assert.ok(colors[1].includes('0.95,0.65,0.15,0.85'), `Expected amber clipping box, got: ${colors[1]}`);
    });
  });

  describe('Challenge 2: Shader Code Audit for Unintended Green Colors or Debug Lines', () => {
    const webglShader = fs.readFileSync(webglShaderPath, 'utf-8');
    const webgpuShader = fs.readFileSync(webgpuShaderPath, 'utf-8');

    it('should verify WebGL2 volume raymarch shader has zero line primitives and zero green debug outputs', () => {
      assert.ok(!webglShader.includes('gl.LINES'), 'WebGL2 shader must not define line primitives');
      assert.ok(!webglShader.includes('vec4(0.0, 1.0, 0.0'), 'WebGL2 shader must not output pure green');
      assert.ok(!webglShader.includes('vec4(0.38, 0.82'), 'WebGL2 shader must not output emerald green');
      // Fragment shader outputs accumulatedColor (or un-premultiplied straight color) or discards
      assert.ok(webglShader.includes('fragColor = accumulatedColor;') || webglShader.includes('fragColor = vec4(straightColor, accumulatedColor.a);'), 'WebGL2 must output front-to-back accumulated color');
    });

    it('should verify WebGPU volume raymarch shader has zero line primitives and zero green debug outputs', () => {
      assert.ok(!webgpuShader.includes('line-list'), 'WebGPU shader must not use line-list');
      assert.ok(!webgpuShader.includes('line-strip'), 'WebGPU shader must not use line-strip');
      assert.ok(!webgpuShader.includes('vec4<f32>(0.0, 1.0, 0.0'), 'WebGPU shader must not output pure green');
      assert.ok(!webgpuShader.includes('vec4<f32>(0.38, 0.82'), 'WebGPU shader must not output emerald green');
      // Returns accumulatedColor (or un-premultiplied straight color) or discards
      assert.ok(webgpuShader.includes('return accumulatedColor;') || webgpuShader.includes('return vec4<f32>(straightColor, accumulatedColor.a);'), 'WebGPU must return front-to-back accumulated color');
    });
  });

  describe('Challenge 3: Empirical Bounding Box Geometry & Strict Domain Invariance', () => {
    // Reconstruct boxLines geometry generator exactly as implemented in OceanVolumeViewport.tsx
    function generateBoxLines(sx: number, sy: number, sz: number): Float32Array {
      const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
      return new Float32Array([
        // Top Surface (Y = +hy)
        -hx, hy, -hz,   hx, hy, -hz,
         hx, hy, -hz,   hx, hy,  hz,
         hx, hy,  hz,  -hx, hy,  hz,
        -hx, hy,  hz,  -hx, hy, -hz,
        // Bottom Seafloor (Y = -hy)
        -hx,-hy, -hz,   hx,-hy, -hz,
         hx,-hy, -hz,   hx,-hy,  hz,
         hx,-hy,  hz,  -hx,-hy,  hz,
        -hx,-hy,  hz,  -hx,-hy, -hz,
        // Vertical Corner Struts (Depth Column)
        -hx, hy, -hz,  -hx,-hy, -hz,
         hx, hy, -hz,   hx,-hy, -hz,
         hx, hy,  hz,   hx,-hy,  hz,
        -hx, hy,  hz,  -hx,-hy,  hz,
      ]);
    }

    it('should verify bounding box produces exactly 12 edges (24 vertices, 72 floats)', () => {
      const lines = generateBoxLines(0.534, 0.172, 1.0);
      assert.equal(lines.length, 72, 'Must contain 72 float values');
      assert.equal(lines.length / 3, 24, 'Must contain exactly 24 3D vertices');
      assert.equal(lines.length / 6, 12, 'Must represent exactly 12 line segments');
    });

    it('should verify every vertex of the bounding box lies strictly on domain extrema with ZERO stray vertices', () => {
      const testExaggerations = [1.0, 10.0, 25.0, 50.0];

      for (const ve of testExaggerations) {
        const sx = 0.534;
        const sy = 0.172 * (ve / 50.0);
        const sz = 1.000;
        const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;

        const lines = generateBoxLines(sx, sy, sz);

        for (let i = 0; i < lines.length; i += 3) {
          const x = lines[i];
          const y = lines[i + 1];
          const z = lines[i + 2];

          // Every coordinate must be exactly either -half or +half extent
          assert.ok(
            Math.abs(Math.abs(x) - hx) < 1e-6,
            `Vertex X ${x} is out of domain bounds [-${hx}, +${hx}]`
          );
          assert.ok(
            Math.abs(Math.abs(y) - hy) < 1e-6,
            `Vertex Y ${y} is out of domain bounds [-${hy}, +${hy}]`
          );
          assert.ok(
            Math.abs(Math.abs(z) - hz) < 1e-6,
            `Vertex Z ${z} is out of domain bounds [-${hz}, +${hz}]`
          );
        }
      }
    });

    it('should empirically verify that CoastlineVectorModel generated 118 out-of-domain vertices that are now eliminated', () => {
      const coastlineModel = new CoastlineVectorModel();
      const legacyVerts = coastlineModel.generateLineVertexBuffer(0.0);

      // Verify legacy model generated 118 vertices (59 line segments)
      assert.equal(legacyVerts.length / 3, 118, 'Legacy coastline model produces 118 vertices (59 line segments)');

      // Verify that the legacy vertices extend far outside [-0.5, +0.5] (normalized domain)
      let minX = Infinity, maxX = -Infinity;
      for (let i = 0; i < legacyVerts.length; i += 3) {
        const x = legacyVerts[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }

      // Legacy x spans from -2.68 to +2.22 (5.37x wider than the ocean volume domain!)
      assert.ok(minX < -2.0, `Legacy minX was ${minX}, proving severe negative overflow outside domain`);
      assert.ok(maxX > 2.0, `Legacy maxX was ${maxX}, proving severe positive overflow outside domain`);

      // And prove that in OceanVolumeViewport.tsx, legacyVerts is NEVER called or buffered
      const viewportCode = fs.readFileSync(viewportPath, 'utf-8');
      assert.ok(
        !viewportCode.includes('generateLineVertexBuffer'),
        'generateLineVertexBuffer must not be called in OceanVolumeViewport.tsx'
      );
    });
  });

  describe('Challenge 4: Active Clipping Wireframe Bounds Oracle', () => {
    function generateClipLines(
      sx: number, sy: number, sz: number,
      u0: number, u1: number,
      v0: number, v1: number,
      w0: number, w1: number
    ): Float32Array {
      const cx0 = sx * (u0 - 0.5), cx1 = sx * (u1 - 0.5);
      const cy0 = sy * (0.5 - w1), cy1 = sy * (0.5 - w0);
      const cz0 = sz * (v0 - 0.5), cz1 = sz * (v1 - 0.5);

      return new Float32Array([
        cx0, cy1, cz0,  cx1, cy1, cz0,   cx1, cy1, cz0,  cx1, cy1, cz1,
        cx1, cy1, cz1,  cx0, cy1, cz1,   cx0, cy1, cz1,  cx0, cy1, cz0,
        cx0, cy0, cz0,  cx1, cy0, cz0,   cx1, cy0, cz0,  cx1, cy0, cz1,
        cx1, cy0, cz1,  cx0, cy0, cz1,   cx0, cy0, cz1,  cx0, cy0, cz0,
        cx0, cy1, cz0,  cx0, cy0, cz0,   cx1, cy1, cz0,  cx1, cy0, cz0,
        cx1, cy1, cz1,  cx1, cy0, cz1,   cx0, cy1, cz1,  cx0, cy0, cz1,
      ]);
    }

    it('should verify clipping wireframe produces exactly 12 edges strictly inside domain', () => {
      const sx = 0.534, sy = 0.172, sz = 1.0;
      const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;

      const clipLines = generateClipLines(sx, sy, sz, 0.2, 0.8, 0.1, 0.9, 0.05, 0.95);
      assert.equal(clipLines.length, 72, 'Clipping lines must contain 72 floats');
      assert.equal(clipLines.length / 6, 12, 'Clipping lines must contain exactly 12 edges');

      for (let i = 0; i < clipLines.length; i += 3) {
        const x = clipLines[i];
        const y = clipLines[i + 1];
        const z = clipLines[i + 2];

        // Must be strictly inside domain boundaries
        assert.ok(x >= -hx - 1e-6 && x <= hx + 1e-6, `Clip X ${x} exceeded domain`);
        assert.ok(y >= -hy - 1e-6 && y <= hy + 1e-6, `Clip Y ${y} exceeded domain`);
        assert.ok(z >= -hz - 1e-6 && z <= hz + 1e-6, `Clip Z ${z} exceeded domain`);
      }
    });
  });

  describe('Challenge 5: Wireframe Toggle & Quality Controls FSM', () => {
    it('should correctly toggle showBoundingBox in VolumeQualityModel', () => {
      const qualityModel = new VolumeQualityModel();
      assert.equal(qualityModel.settings.showBoundingBox, true, 'Default must be true');

      let notified = false;
      const unsub = qualityModel.subscribe(() => {
        notified = true;
      });

      qualityModel.setBoundingBoxVisible(false);
      assert.equal(qualityModel.settings.showBoundingBox, false, 'Should be toggled to false');
      assert.equal(notified, true, 'Subscriber should be notified on toggle');

      notified = false;
      qualityModel.setBoundingBoxVisible(true);
      assert.equal(qualityModel.settings.showBoundingBox, true, 'Should be toggled back to true');
      assert.equal(notified, true, 'Subscriber should be notified on re-enable');

      unsub();
    });
  });

  describe('Challenge 6: Viewport & Overview Architectural Isolation', () => {
    const viewportCode = fs.readFileSync(viewportPath, 'utf-8');
    const overviewCode = fs.readFileSync(overviewPath, 'utf-8');

    it('should verify OceanVolumeViewport does not import or instantiate CesiumOverviewViewport', () => {
      assert.ok(
        !viewportCode.includes('CesiumOverviewViewport'),
        'OceanVolumeViewport must have zero coupling to CesiumOverviewViewport'
      );
    });

    it('should verify coastlines are preserved exclusively in CesiumOverviewViewport via SVG landmasses', () => {
      assert.ok(
        overviewCode.includes('landmasses'),
        'CesiumOverviewViewport must render SVG landmasses for georeferenced coastlines'
      );
    });
  });
});
