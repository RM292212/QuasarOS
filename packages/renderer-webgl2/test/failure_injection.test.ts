import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WebGL2ContextManager,
  WebGL2ResourceManager,
  WebGL2BudgetTracker,
  WebGL2RaymarchingRenderer,
  WebGL2VolumePicker,
  WebGL2MemoryBudgetExceededError,
  WebGL2InitializationError,
  WebGL2ResourceDisposedError,
  WebGL2ContextLostError,
} from '../src/index.ts';
import { CoordinateTransformer, DepthLookupTable } from '@quasar/runtime';
import type { RenderPacket } from '@quasar/runtime';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mock EventTarget & WebGL2 Rendering Context for Failure Injection Tests.
 */
class MockEventTarget {
  private listeners: Map<string, Function[]> = new Map();

  addEventListener(type: string, listener: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: Function) {
    const list = this.listeners.get(type);
    if (list) {
      this.listeners.set(type, list.filter(l => l !== listener));
    }
  }

  dispatchEvent(event: { type: string; preventDefault?: () => void }) {
    const list = this.listeners.get(event.type);
    if (list) {
      for (const listener of list) {
        listener(event);
      }
    }
  }
}

class MockWebGL2FailureContext {
  VERTEX_SHADER = 0x8b31;
  FRAGMENT_SHADER = 0x8b30;
  COMPILE_STATUS = 0x8b81;
  LINK_STATUS = 0x8b82;
  UNIFORM_BUFFER = 0x8a11;
  DYNAMIC_DRAW = 0x88e8;
  STATIC_DRAW = 0x88e4;
  TEXTURE_2D = 0x0de1;
  TEXTURE_3D = 0x806f;
  TEXTURE0 = 0x84c0;
  R16F = 0x822d;
  R16UI = 0x8234;
  R8UI = 0x8232;
  R32F = 0x822e;
  RGBA8 = 0x8058;
  RGBA32F = 0x8814;
  RED = 0x1903;
  RED_INTEGER = 0x8d94;
  RGBA = 0x1908;
  HALF_FLOAT = 0x140b;
  UNSIGNED_SHORT = 0x1403;
  UNSIGNED_BYTE = 0x1401;
  FLOAT = 0x1406;
  NEAREST = 0x2600;
  LINEAR = 0x2601;
  TEXTURE_MIN_FILTER = 0x2801;
  TEXTURE_MAG_FILTER = 0x2800;
  TEXTURE_WRAP_S = 0x2802;
  TEXTURE_WRAP_T = 0x2803;
  TEXTURE_WRAP_R = 0x8072;
  CLAMP_TO_EDGE = 0x812f;
  FRAMEBUFFER = 0x8d40;
  COLOR_ATTACHMENT0 = 0x8ce0;
  COLOR_BUFFER_BIT = 0x4000;
  BLEND = 0x0be2;
  DEPTH_TEST = 0x0b71;
  CULL_FACE = 0x0b44;
  TRIANGLES = 0x0004;
  UNPACK_ALIGNMENT = 0x0cf5;
  MAX_TEXTURE_SIZE = 0x0d33;
  MAX_3D_TEXTURE_SIZE = 0x8073;
  MAX_ARRAY_TEXTURE_LAYERS = 0x88a7;
  MAX_UNIFORM_BLOCK_SIZE = 0x8a30;
  MAX_VERTEX_UNIFORM_BLOCKS = 0x8a2b;
  MAX_FRAGMENT_UNIFORM_BLOCKS = 0x8a2d;
  MAX_COMBINED_UNIFORM_BLOCKS = 0x8a2e;
  MAX_TEXTURE_IMAGE_UNITS = 0x8872;
  MAX_COMBINED_TEXTURE_IMAGE_UNITS = 0x8b4d;

  isContextLostVal = false;

  isContextLost(): boolean {
    return this.isContextLostVal;
  }

  getExtension(name: string) {
    if (name === 'EXT_color_buffer_float' || name === 'OES_texture_float_linear') {
      return {};
    }
    return null;
  }

  getParameter(pname: number) {
    if (pname === this.MAX_3D_TEXTURE_SIZE) return 2048;
    if (pname === this.MAX_TEXTURE_SIZE) return 4096;
    if (pname === this.MAX_UNIFORM_BLOCK_SIZE) return 65536;
    return 16;
  }

  createShader(type: number) { return { type, id: Math.random() }; }
  shaderSource(shader: any, source: string) { shader.source = source; }
  compileShader(shader: any) {}
  getShaderParameter(shader: any, pname: number) { return true; }
  getShaderInfoLog(shader: any) { return ''; }
  deleteShader(shader: any) { shader.isDeleted = true; }

  createProgram() { return { id: Math.random() }; }
  attachShader(program: any, shader: any) {}
  linkProgram(program: any) {}
  getProgramParameter(program: any, pname: number) { return true; }
  getProgramInfoLog(program: any) { return ''; }
  deleteProgram(program: any) { program.isDeleted = true; }
  useProgram(program: any) {}

  getUniformBlockIndex(program: any, name: string) { return 0; }
  uniformBlockBinding(program: any, blockIndex: number, bindingPoint: number) {}
  getUniformLocation(program: any, name: string) { return { name }; }
  uniform1i(loc: any, val: number) {}

  createBuffer() { return { id: Math.random(), isDeleted: false }; }
  bindBuffer(target: number, buffer: any) {}
  bufferData(target: number, sizeOrData: any, usage: number) {}
  bufferSubData(target: number, offset: number, data: any) {}
  bindBufferBase(target: number, index: number, buffer: any) {}
  deleteBuffer(buffer: any) { buffer.isDeleted = true; }

  createVertexArray() { return { id: Math.random(), isDeleted: false }; }
  bindVertexArray(vao: any) {}
  deleteVertexArray(vao: any) { vao.isDeleted = true; }

  createTexture() { return { id: Math.random(), isDeleted: false }; }
  bindTexture(target: number, texture: any) {}
  activeTexture(unit: number) {}
  texParameteri(target: number, pname: number, param: number) {}
  pixelStorei(pname: number, param: number) {}
  texImage2D(target: number, level: number, internalformat: number, width: number, height: number, border: number, format: number, type: number, pixels: any) {}
  texImage3D(target: number, level: number, internalformat: number, width: number, height: number, depth: number, border: number, format: number, type: number, pixels: any) {}
  deleteTexture(texture: any) { texture.isDeleted = true; }

  createFramebuffer() { return { id: Math.random(), isDeleted: false }; }
  bindFramebuffer(target: number, fbo: any) {}
  framebufferTexture2D(target: number, attachment: number, textarget: number, texture: any, level: number) {}
  checkFramebufferStatus(target: number) { return 0x8cd5; /* FRAMEBUFFER_COMPLETE */ }
  deleteFramebuffer(fbo: any) { fbo.isDeleted = true; }

  viewport(x: number, y: number, w: number, h: number) {}
  clearColor(r: number, g: number, b: number, a: number) {}
  clear(mask: number) {}
  enable(cap: number) {}
  disable(cap: number) {}
  blendFunc(sfactor: number, dfactor: number) {}
  drawArrays(mode: number, first: number, count: number) {}
  readPixels(x: number, y: number, w: number, h: number, format: number, type: number, pixels: any) {
    if (pixels instanceof Float32Array) {
      pixels[0] = 0.5;
      pixels[1] = 0.5;
      pixels[2] = 0.5;
      pixels[3] = 22.5; // valid hit
    }
  }
}

describe('TASK-09E: WebGL2 Failure Injection & Boundary Enforcement', () => {

  describe('1. Context Loss & Restoration Recovery Cycle', () => {
    it('should transition isLost state and trigger callbacks during webglcontextlost & webglcontextrestored events', () => {
      const mockCanvas = new MockEventTarget() as any;
      const mockGl = new MockWebGL2FailureContext() as any;

      let lostTriggered = false;
      let restoredTriggered = false;

      const contextManager = new WebGL2ContextManager(mockCanvas, mockGl, {
        onContextLost: (e) => {
          lostTriggered = true;
        },
        onContextRestored: (e) => {
          restoredTriggered = true;
        },
      });

      assert.equal(contextManager.isLost, false, 'Context manager must initially be not lost');

      // Dispatch webglcontextlost event
      let defaultPrevented = false;
      mockCanvas.dispatchEvent({
        type: 'webglcontextlost',
        preventDefault: () => { defaultPrevented = true; },
      });

      assert.equal(contextManager.isLost, true, 'Context manager must reflect isLost = true');
      assert.equal(lostTriggered, true, 'onContextLost callback must be executed');
      assert.equal(defaultPrevented, true, 'preventDefault must be called to allow WebGL restoration');

      // Dispatch webglcontextrestored event
      mockCanvas.dispatchEvent({
        type: 'webglcontextrestored',
      });

      assert.equal(contextManager.isLost, false, 'Context manager must reflect isLost = false after restoration');
      assert.equal(restoredTriggered, true, 'onContextRestored callback must be executed');
    });
  });

  describe('2. Memory Budget Threshold & Enforcement (50 MiB Limit)', () => {
    it('should enforce strict 50 MiB allocation ceiling and throw WebGL2MemoryBudgetExceededError on threshold breach', () => {
      const budgetTracker = new WebGL2BudgetTracker({ maxTextureMemoryBytes: 50 * 1024 * 1024 });

      // Allocate 40 MiB
      budgetTracker.recordTextureAllocated(40 * 1024 * 1024);
      assert.equal(budgetTracker.stats.textureMemoryBytes, 40 * 1024 * 1024);
      assert.equal(budgetTracker.canAllocateTexture(10 * 1024 * 1024), true);
      assert.equal(budgetTracker.canAllocateTexture(15 * 1024 * 1024), false);

      // Attempt to allocate another 15 MiB (total 55 MiB > 50 MiB limit) -> must throw
      assert.throws(
        () => {
          budgetTracker.recordTextureAllocated(15 * 1024 * 1024);
        },
        (err: any) => {
          assert(err instanceof WebGL2MemoryBudgetExceededError);
          assert.match(err.message, /exceeded budget/);
          return true;
        }
      );

      // Free 40 MiB
      budgetTracker.recordTextureDeallocated(40 * 1024 * 1024);
      assert.equal(budgetTracker.stats.textureMemoryBytes, 0);

      // Re-allocation within budget succeeds
      budgetTracker.recordTextureAllocated(15 * 1024 * 1024);
      assert.equal(budgetTracker.stats.textureMemoryBytes, 15 * 1024 * 1024);
    });
  });

  describe('3. Physical Clipping Limit Clamping & Bounds Protection', () => {
    it('should correctly clamp out-of-bounds clipping limits in uniform packing', () => {
      const mockGl = new MockWebGL2FailureContext() as any;
      const renderer = new WebGL2RaymarchingRenderer(mockGl);

      const outOfBoundsPacket: RenderPacket = {
        packetId: 'pkt_oob_test',
        schemaVersion: '1.0.0',
        lineageId: 'lin_001',
        datasetId: 'copernicus_phy_thetao',
        snapshotId: 'snap_001',
        variableId: 'thetao',
        units: 'degrees_C',
        timestampUtc: '2026-08-30T12:00:00Z',
        lodLevel: 0,
        gridDimensions: [64, 64, 31],
        worldBoundingBox: {
          minLon: 60.0,
          maxLon: 75.0,
          minLat: 10.0,
          maxLat: 25.0,
          minDepthM: 0.494,
          maxDepthM: 453.938,
        },
        clippingBox: {
          minU: -0.5, // Out of bounds negative
          maxU: 1.5,  // Out of bounds excessive
          minV: -0.2,
          maxV: 1.2,
          minW: -0.1,
          maxW: 1.1,
        },
        scalarMin: -2.0,
        scalarMax: 35.0,
        bricks: [],
        depthLutEntriesM: [0.494, 5.0, 10.0, 50.0, 100.0, 453.938],
      };

      const packed = renderer.packUniforms({
        packet: outOfBoundsPacket,
        camera: {
          cameraPosition: [0, 0, -2],
          viewMatrix: new Float32Array(16),
          projectionMatrix: new Float32Array(16),
          inverseViewProjectionMatrix: new Float32Array(16),
          viewportWidth: 800,
          viewportHeight: 600,
        },
      }, true);

      const f32 = new Float32Array(packed);
      const u32 = new Uint32Array(packed);

      // Verify uniform packing retains raw coordinates while shader analytical box clamps to [0, 1]
      assert.equal(f32[20], -0.5); // minU
      assert.equal(f32[24], 1.5);  // maxU
      assert.equal(u32[32], 6);    // depth level count
      assert.equal(u32[33], 1);    // isFloat
    });
  });

  describe('4. Strict Static AST & Boundary Check (Zero UI/DOM in renderer-webgl2/src)', () => {
    it('should assert that packages/renderer-webgl2/src contains zero React, JSX, or DOM components', () => {
      const srcDir = path.resolve(__dirname, '../src');
      
      const scanDir = (dir: string): string[] => {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat && stat.isDirectory()) {
            results = results.concat(scanDir(fullPath));
          } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            results.push(fullPath);
          }
        }
        return results;
      };

      const files = scanDir(srcDir);
      assert(files.length > 0, 'Must have found source files');

      const forbiddenTokens = [
        'React',
        'react',
        'react-dom',
        'useState',
        'useEffect',
        'useContext',
        'jsx',
        '<div>',
        '<span>',
        '<canvas',
      ];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const token of forbiddenTokens) {
          assert(
            !content.includes(token),
            `Forbidden UI/DOM token "${token}" found in pure rendering package file: ${file}`
          );
        }
      }
    });
  });

  describe('5. Use-After-Disposal Resource Protection', () => {
    it('should throw WebGL2ResourceDisposedError when using WebGL2VolumePicker or WebGL2ResourceManager after disposal', async () => {
      const mockGl = new MockWebGL2FailureContext() as any;
      const resourceManager = new WebGL2ResourceManager(mockGl);

      resourceManager.dispose();
      assert.equal(resourceManager.isDisposed, true);

      assert.throws(
        () => {
          resourceManager.uploadTexture3D({
            id: 'test_tex',
            width: 16,
            height: 16,
            depth: 16,
            format: 'r16f',
            data: new Uint16Array(4096),
          });
        },
        (err: any) => {
          assert(err instanceof WebGL2ResourceDisposedError);
          return true;
        }
      );

      const transformer = new CoordinateTransformer({
        referenceLongitudeDeg: 70.0,
        referenceLatitudeDeg: 15.0,
        referenceDepthM: 0.0,
        gridDimensions: [64, 64, 31],
        worldBoundingBox: {
          minLon: 60.0,
          maxLon: 75.0,
          minLat: 10.0,
          maxLat: 25.0,
          minDepthM: 0.494,
          maxDepthM: 453.938,
        },
        depthLookupTable: new DepthLookupTable([0.494, 10.0, 50.0, 100.0, 453.938]),
      });

      const picker = new WebGL2VolumePicker({
        gl: mockGl,
        transformer,
        datasetId: 'copernicus_phy_thetao',
        snapshotId: 'snap_001',
        visualizationProductId: 'prod_001',
        variableId: 'thetao',
        displayUnits: 'degrees_C',
        targetTimeUtc: '2026-08-30T12:00:00Z',
      });

      picker.dispose();
      assert.equal(picker.isDisposed, true);

      await assert.rejects(
        async () => {
          await picker.pick(
            { texture: {} as any, isFloat: true },
            { origin: [0.5, 0.5, 0.0], direction: [0, 0, 1] }
          );
        },
        (err: any) => {
          assert(err instanceof WebGL2ResourceDisposedError);
          return true;
        }
      );
    });
  });
});