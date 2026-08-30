import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  WebGL2ContextManager,
  WebGL2ResourceManager,
  WebGL2BudgetTracker,
  WebGL2InitializationError,
  WebGL2MemoryBudgetExceededError,
  WebGL2ResourceDisposedError,
} from '../src/index.ts';

/**
 * Mock WebGL2 Rendering Context for headless unit tests.
 */
class MockWebGLTexture {
  isDeleted: boolean = false;
}

class MockWebGLBuffer {
  isDeleted: boolean = false;
}

class MockWebGL2RenderingContext {
  // WebGL Constants
  readonly TEXTURE_2D = 0x0de1;
  readonly TEXTURE_3D = 0x806f;
  readonly UNIFORM_BUFFER = 0x8a11;
  readonly ARRAY_BUFFER = 0x8892;
  readonly STATIC_DRAW = 0x88e4;
  readonly DYNAMIC_DRAW = 0x88e8;

  readonly RED = 0x1903;
  readonly RED_INTEGER = 0x8d94;
  readonly RGBA = 0x1908;
  readonly RGBA_INTEGER = 0x8d99;

  readonly R16F = 0x822d;
  readonly R16UI = 0x8234;
  readonly R8UI = 0x8232;
  readonly R32F = 0x822e;
  readonly RGBA8 = 0x8058;

  readonly HALF_FLOAT = 0x140b;
  readonly UNSIGNED_SHORT = 0x1403;
  readonly UNSIGNED_BYTE = 0x1401;
  readonly FLOAT = 0x1406;

  readonly UNPACK_ALIGNMENT = 0x0cf5;
  readonly TEXTURE_WRAP_S = 0x2802;
  readonly TEXTURE_WRAP_T = 0x2803;
  readonly TEXTURE_WRAP_R = 0x8072;
  readonly TEXTURE_MIN_FILTER = 0x2801;
  readonly TEXTURE_MAG_FILTER = 0x2800;
  readonly NEAREST = 0x2600;
  readonly LINEAR = 0x2601;
  readonly CLAMP_TO_EDGE = 0x812f;
  readonly REPEAT = 0x2901;

  readonly MAX_TEXTURE_SIZE = 0x0d33;
  readonly MAX_3D_TEXTURE_SIZE = 0x8073;
  readonly MAX_ARRAY_TEXTURE_LAYERS = 0x88ff;
  readonly MAX_TEXTURE_IMAGE_UNITS = 0x8872;
  readonly MAX_UNIFORM_BUFFER_BINDINGS = 0x8a2f;
  readonly MAX_UNIFORM_BLOCK_SIZE = 0x8a30;
  readonly UNIFORM_BUFFER_OFFSET_ALIGNMENT = 0x8a34;

  // State recording
  pixelStoreSettings: Map<number, number> = new Map();
  boundTextures: Map<number, MockWebGLTexture | null> = new Map();
  boundBuffers: Map<number, MockWebGLBuffer | null> = new Map();
  texParameters: Array<{ target: number; pname: number; param: number }> = [];
  texImage3DCalls: Array<{
    target: number;
    level: number;
    internalformat: number;
    width: number;
    height: number;
    depth: number;
    border: number;
    format: number;
    type: number;
    data: ArrayBufferView | null;
  }> = [];
  texSubImage3DCalls: Array<{
    target: number;
    level: number;
    xoffset: number;
    yoffset: number;
    zoffset: number;
    width: number;
    height: number;
    depth: number;
    format: number;
    type: number;
    data: ArrayBufferView | null;
  }> = [];
  texImage2DCalls: Array<{
    target: number;
    level: number;
    internalformat: number;
    width: number;
    height: number;
    border: number;
    format: number;
    type: number;
    data: ArrayBufferView | null;
  }> = [];
  bufferDataCalls: Array<{
    target: number;
    data: ArrayBufferView;
    usage: number;
  }> = [];

  createdTextures: MockWebGLTexture[] = [];
  createdBuffers: MockWebGLBuffer[] = [];

  createTexture(): WebGLTexture | null {
    const tex = new MockWebGLTexture();
    this.createdTextures.push(tex);
    return tex as unknown as WebGLTexture;
  }

  deleteTexture(texture: WebGLTexture | null): void {
    if (texture) {
      (texture as unknown as MockWebGLTexture).isDeleted = true;
    }
  }

  createBuffer(): WebGLBuffer | null {
    const buf = new MockWebGLBuffer();
    this.createdBuffers.push(buf);
    return buf as unknown as WebGLBuffer;
  }

  deleteBuffer(buffer: WebGLBuffer | null): void {
    if (buffer) {
      (buffer as unknown as MockWebGLBuffer).isDeleted = true;
    }
  }

  bindTexture(target: number, texture: WebGLTexture | null): void {
    this.boundTextures.set(target, texture as unknown as MockWebGLTexture | null);
  }

  bindBuffer(target: number, buffer: WebGLBuffer | null): void {
    this.boundBuffers.set(target, buffer as unknown as MockWebGLBuffer | null);
  }

  pixelStorei(pname: number, param: number): void {
    this.pixelStoreSettings.set(pname, param);
  }

  texParameteri(target: number, pname: number, param: number): void {
    this.texParameters.push({ target, pname, param });
  }

  texImage3D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    depth: number,
    border: number,
    format: number,
    type: number,
    data: ArrayBufferView | null
  ): void {
    this.texImage3DCalls.push({
      target,
      level,
      internalformat,
      width,
      height,
      depth,
      border,
      format,
      type,
      data,
    });
  }

  texSubImage3D(
    target: number,
    level: number,
    xoffset: number,
    yoffset: number,
    zoffset: number,
    width: number,
    height: number,
    depth: number,
    format: number,
    type: number,
    data: ArrayBufferView | null
  ): void {
    this.texSubImage3DCalls.push({
      target,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format,
      type,
      data,
    });
  }

  texImage2D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    border: number,
    format: number,
    type: number,
    data: ArrayBufferView | null
  ): void {
    this.texImage2DCalls.push({
      target,
      level,
      internalformat,
      width,
      height,
      border,
      format,
      type,
      data,
    });
  }

  bufferData(target: number, data: ArrayBufferView, usage: number): void {
    this.bufferDataCalls.push({ target, data, usage });
  }

  getExtension(name: string): any {
    if (
      name === 'EXT_color_buffer_float' ||
      name === 'EXT_color_buffer_half_float' ||
      name === 'OES_texture_float_linear' ||
      name === 'OES_texture_half_float_linear' ||
      name === 'KHR_parallel_shader_compile'
    ) {
      return {};
    }
    return null;
  }

  getParameter(pname: number): any {
    switch (pname) {
      case this.MAX_TEXTURE_SIZE:
        return 4096;
      case this.MAX_3D_TEXTURE_SIZE:
        return 2048;
      case this.MAX_ARRAY_TEXTURE_LAYERS:
        return 512;
      case this.MAX_TEXTURE_IMAGE_UNITS:
        return 32;
      case this.MAX_UNIFORM_BUFFER_BINDINGS:
        return 36;
      case this.MAX_UNIFORM_BLOCK_SIZE:
        return 65536;
      case this.UNIFORM_BUFFER_OFFSET_ALIGNMENT:
        return 256;
      default:
        return 0;
    }
  }
}

class MockCanvas {
  listeners: Map<string, Array<(event: Event) => void>> = new Map();
  mockGL: MockWebGL2RenderingContext;

  constructor(mockGL: MockWebGL2RenderingContext) {
    this.mockGL = mockGL;
  }

  getContext(type: string, _options?: any): any {
    if (type === 'webgl2') {
      return this.mockGL;
    }
    return null;
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    const list = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      list.filter((l) => l !== listener)
    );
  }

  dispatchEvent(type: string, event: Event): void {
    const list = this.listeners.get(type) || [];
    for (const l of list) {
      l(event);
    }
  }
}

describe('WebGL2 Context Management & Capability Probing', () => {
  it('should acquire WebGL2 context, probe extensions, and query capabilities', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const canvas = new MockCanvas(mockGL);

    let contextLostFired = false;
    let contextRestoredFired = false;

    const manager = WebGL2ContextManager.acquire(canvas as unknown as HTMLCanvasElement, {
      onContextLost: () => {
        contextLostFired = true;
      },
      onContextRestored: () => {
        contextRestoredFired = true;
      },
    });

    assert.equal(manager.isLost, false);
    assert.equal(manager.capabilities.max3DTextureSize, 2048);
    assert.equal(manager.capabilities.supportsFloatLinear, true);
    assert.equal(manager.capabilities.supportsHalfFloatLinear, true);
    assert.equal(manager.capabilities.supportsColorBufferFloat, true);

    // Test context loss event dispatch
    const fakeLostEvent = {
      preventDefault: () => {},
    } as unknown as Event;
    canvas.dispatchEvent('webglcontextlost', fakeLostEvent);

    assert.equal(manager.isLost, true);
    assert.equal(contextLostFired, true);

    // Test context restored event dispatch
    const fakeRestoredEvent = {} as unknown as Event;
    canvas.dispatchEvent('webglcontextrestored', fakeRestoredEvent);

    assert.equal(manager.isLost, false);
    assert.equal(contextRestoredFired, true);

    manager.dispose();
  });

  it('should throw WebGL2InitializationError when context acquisition fails', () => {
    const canvas = {
      getContext: () => null,
    };

    assert.throws(
      () => WebGL2ContextManager.acquire(canvas as unknown as HTMLCanvasElement),
      (err) => err instanceof WebGL2InitializationError
    );
  });
});

describe('WebGL2 Memory Budget Tracker', () => {
  it('should track texture & buffer allocations and enforce 50 MiB ceiling', () => {
    const budget = new WebGL2BudgetTracker({
      maxTextureMemoryBytes: 50 * 1024 * 1024,
      maxBufferMemoryBytes: 10 * 1024 * 1024,
    });

    const brickBytes = 66 * 66 * 32 * 2; // ~278.784 KiB
    budget.recordTextureAllocated(brickBytes);
    assert.equal(budget.stats.textureMemoryBytes, brickBytes);
    assert.equal(budget.stats.allocatedTexturesCount, 1);

    budget.recordTextureDeallocated(brickBytes);
    assert.equal(budget.stats.textureMemoryBytes, 0);
    assert.equal(budget.stats.allocatedTexturesCount, 0);

    assert.throws(
      () => budget.recordTextureAllocated(60 * 1024 * 1024),
      (err) => err instanceof WebGL2MemoryBudgetExceededError
    );
  });
});

describe('WebGL2 Resource Manager & Texture Pipeline', () => {
  it('should allocate and upload 3D Float16 texture (R16F, RED, HALF_FLOAT)', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const manager = new WebGL2ResourceManager(mockGL as unknown as WebGL2RenderingContext);

    const width = 66;
    const height = 66;
    const depth = 32;
    const sourceData = new Uint16Array(width * height * depth);
    sourceData[0] = 0x3c00; // Float16 1.0

    const allocated = manager.uploadTexture3D({
      id: 'brick_f16_0',
      width,
      height,
      depth,
      format: 'r16f',
      data: sourceData,
      filterMode: 'linear',
    });

    assert.equal(allocated.id, 'brick_f16_0');
    assert.equal(allocated.width, 66);
    assert.equal(allocated.height, 66);
    assert.equal(allocated.depth, 32);
    assert.equal(allocated.internalFormat, mockGL.R16F);
    assert.equal(allocated.format, mockGL.RED);
    assert.equal(allocated.type, mockGL.HALF_FLOAT);
    assert.equal(allocated.sizeInBytes, 66 * 66 * 32 * 2);

    // Verify UNPACK_ALIGNMENT was set to 1
    assert.equal(mockGL.pixelStoreSettings.get(mockGL.UNPACK_ALIGNMENT), 1);

    // Verify texImage3D was called correctly
    assert.equal(mockGL.texImage3DCalls.length, 1);
    const call = mockGL.texImage3DCalls[0];
    assert.equal(call.width, 66);
    assert.equal(call.height, 66);
    assert.equal(call.depth, 32);
    assert.equal(call.internalformat, mockGL.R16F);
    assert.equal(call.format, mockGL.RED);
    assert.equal(call.type, mockGL.HALF_FLOAT);

    // Test subtexture update (texSubImage3D)
    const updateSlice = new Uint16Array(66 * 66 * 1);
    updateSlice[0] = 0x3c00;
    manager.updateSubTexture3D({
      id: 'brick_f16_0',
      xOffset: 0,
      yOffset: 0,
      zOffset: 0,
      width: 66,
      height: 66,
      depth: 1,
      data: updateSlice,
    });

    assert.equal(mockGL.texSubImage3DCalls.length, 1);
    assert.equal(mockGL.texSubImage3DCalls[0].depth, 1);

    // Cleanup
    manager.destroyTexture('brick_f16_0');
    assert.equal(manager.getTexture('brick_f16_0'), undefined);
    assert.equal(manager.budgetTracker.stats.textureMemoryBytes, 0);
  });

  it('should allocate and upload 3D Quantized Uint16 texture (R16UI, RED_INTEGER, UNSIGNED_SHORT)', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const manager = new WebGL2ResourceManager(mockGL as unknown as WebGL2RenderingContext);

    const width = 66;
    const height = 66;
    const depth = 32;
    const sourceData = new Uint16Array(width * height * depth);
    sourceData[0] = 19022;

    const allocated = manager.uploadTexture3D({
      id: 'brick_u16_0',
      width,
      height,
      depth,
      format: 'r16ui',
      data: sourceData,
    });

    assert.equal(allocated.internalFormat, mockGL.R16UI);
    assert.equal(allocated.format, mockGL.RED_INTEGER);
    assert.equal(allocated.type, mockGL.UNSIGNED_SHORT);
    assert.equal(allocated.sizeInBytes, 66 * 66 * 32 * 2);
  });

  it('should allocate and upload 3D Validity Mask texture (R8UI, RED_INTEGER, UNSIGNED_BYTE)', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const manager = new WebGL2ResourceManager(mockGL as unknown as WebGL2RenderingContext);

    const width = 66;
    const height = 66;
    const depth = 32;
    const maskData = new Uint8Array(width * height * depth);
    maskData.fill(1);

    const allocated = manager.uploadTexture3D({
      id: 'mask_0',
      width,
      height,
      depth,
      format: 'r8ui',
      data: maskData,
    });

    assert.equal(allocated.internalFormat, mockGL.R8UI);
    assert.equal(allocated.format, mockGL.RED_INTEGER);
    assert.equal(allocated.type, mockGL.UNSIGNED_BYTE);
    assert.equal(allocated.sizeInBytes, 66 * 66 * 32 * 1);
  });

  it('should upload 256x1 RGBA Colormap Transfer Function LUT texture (RGBA8)', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const manager = new WebGL2ResourceManager(mockGL as unknown as WebGL2RenderingContext);

    const tfTexture = manager.uploadTransferFunctionLUT('tf_cividis', {
      colormap_name: 'cividis',
      canonical_variable: 'sea_water_potential_temperature',
      range_min: -2.0,
      range_max: 32.0,
      opacity_mapping: 'linear',
      control_points: [
        { normalized_scalar: 0.0, color: [0.0, 0.1, 0.3], opacity: 0.0 },
        { normalized_scalar: 1.0, color: [0.9, 0.9, 0.2], opacity: 0.8 },
      ],
    });

    assert.equal(tfTexture.id, 'tf_cividis');
    assert.equal(tfTexture.width, 256);
    assert.equal(tfTexture.height, 1);
    assert.equal(tfTexture.internalFormat, mockGL.RGBA8);
    assert.equal(tfTexture.format, mockGL.RGBA);
    assert.equal(tfTexture.type, mockGL.UNSIGNED_BYTE);
    assert.equal(tfTexture.sizeInBytes, 256 * 4); // 1024 bytes

    assert.equal(mockGL.texImage2DCalls.length, 1);
    const call = mockGL.texImage2DCalls[0];
    assert.equal(call.width, 256);
    assert.equal(call.height, 1);
    assert.equal(call.internalformat, mockGL.RGBA8);
  });

  it('should upload 31-level Copernicus Depth LUT texture (R32F)', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const manager = new WebGL2ResourceManager(mockGL as unknown as WebGL2RenderingContext);

    const depthEntries = new Float32Array([
      0.494, 1.541, 2.645, 3.819, 5.078, 6.440, 7.929, 9.572, 11.405, 13.467,
      15.810, 18.495, 21.598, 25.211, 29.444, 34.434, 40.344, 47.373, 55.764,
      65.807, 77.853, 92.326, 109.729, 130.666, 155.850, 186.125, 222.475,
      266.040, 318.127, 380.270, 453.938,
    ]);

    const lutTexture = manager.uploadDepthLUTTexture('depth_lut_copernicus', depthEntries);

    assert.equal(lutTexture.id, 'depth_lut_copernicus');
    assert.equal(lutTexture.width, 31);
    assert.equal(lutTexture.height, 1);
    assert.equal(lutTexture.internalFormat, mockGL.R32F);
    assert.equal(lutTexture.format, mockGL.RED);
    assert.equal(lutTexture.type, mockGL.FLOAT);
    assert.equal(lutTexture.sizeInBytes, 31 * 4);
  });

  it('should upload WebGLBuffer and track memory budget', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const manager = new WebGL2ResourceManager(mockGL as unknown as WebGL2RenderingContext);

    const uboData = new Float32Array(40); // 160 bytes
    const buffer = manager.uploadBuffer({
      id: 'uniform_buffer_0',
      target: mockGL.UNIFORM_BUFFER,
      data: uboData,
      usage: mockGL.DYNAMIC_DRAW,
    });

    assert.equal(buffer.id, 'uniform_buffer_0');
    assert.equal(buffer.sizeInBytes, 160);
    assert.equal(manager.budgetTracker.stats.bufferMemoryBytes, 160);

    assert.equal(mockGL.bufferDataCalls.length, 1);
    assert.equal(mockGL.bufferDataCalls[0].usage, mockGL.DYNAMIC_DRAW);

    manager.destroyBuffer('uniform_buffer_0');
    assert.equal(manager.getBuffer('uniform_buffer_0'), undefined);
    assert.equal(manager.budgetTracker.stats.bufferMemoryBytes, 0);
  });

  it('should throw WebGL2ResourceDisposedError when using manager after disposal', () => {
    const mockGL = new MockWebGL2RenderingContext();
    const manager = new WebGL2ResourceManager(mockGL as unknown as WebGL2RenderingContext);

    manager.dispose();
    assert.equal(manager.isDisposed, true);

    assert.throws(
      () =>
        manager.uploadTexture3D({
          id: 'test',
          width: 10,
          height: 10,
          depth: 10,
          format: 'r16f',
          data: new Uint16Array(1000),
        }),
      (err) => err instanceof WebGL2ResourceDisposedError
    );
  });
});
