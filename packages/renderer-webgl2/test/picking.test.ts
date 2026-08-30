import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WebGL2VolumePicker,
  reconcilePickWithBackend,
  VOLUME_PICKING_VERT_GLSL,
  VOLUME_PICKING_FRAG_GLSL,
  WebGL2ResourceDisposedError,
  WebGL2BackendAdapter,
} from '../src/index.ts';
import { CoordinateTransformer, DepthLookupTable } from '@quasar/runtime';
import { QuasarQueryClient } from '@quasar/client';
import type { ReconcilePickRequest, ReconcilePickResponse, ApiResponse } from '@quasar/client';

/** Mock WebGL2 Rendering Context for Picking & Pipeline readback tests */
class MockWebGL2RenderingContext {
  readonly VERTEX_SHADER = 0x8b31;
  readonly FRAGMENT_SHADER = 0x8b30;
  readonly COMPILE_STATUS = 0x8b81;
  readonly LINK_STATUS = 0x8b82;
  readonly UNIFORM_BUFFER = 0x8a11;
  readonly DYNAMIC_DRAW = 0x88e8;
  readonly STATIC_DRAW = 0x88e4;
  readonly TEXTURE_2D = 0x0de1;
  readonly TEXTURE_3D = 0x806f;
  readonly RGBA = 0x1908;
  readonly RGBA32F = 0x8814;
  readonly RGBA8 = 0x8058;
  readonly RED = 0x1903;
  readonly RED_INTEGER = 0x8d94;
  readonly FLOAT = 0x1406;
  readonly HALF_FLOAT = 0x140b;
  readonly UNSIGNED_BYTE = 0x1401;
  readonly UNSIGNED_SHORT = 0x1403;
  readonly FRAMEBUFFER = 0x8d40;
  readonly COLOR_ATTACHMENT0 = 0x8ce0;
  readonly NEAREST = 0x2600;
  readonly LINEAR = 0x2601;
  readonly CLAMP_TO_EDGE = 0x812f;
  readonly COLOR_BUFFER_BIT = 0x4000;
  readonly BLEND = 0x0be2;
  readonly DEPTH_TEST = 0x0b71;
  readonly CULL_FACE = 0x0b44;
  readonly TRIANGLES = 0x0004;
  readonly TEXTURE0 = 0x84c0;

  // Mock readback buffer for gl.readPixels
  mockReadPixelsData: Float32Array = new Float32Array([0, 0, 0, 0]);

  createShader(type: number) {
    return { type, label: 'MockShader' };
  }

  shaderSource(shader: any, source: string) {
    shader.source = source;
  }

  compileShader(shader: any) {}

  getShaderParameter(shader: any, pname: number) {
    return true;
  }

  getShaderInfoLog(shader: any) {
    return '';
  }

  deleteShader(shader: any) {}

  createProgram() {
    return { label: 'MockProgram' };
  }

  attachShader(program: any, shader: any) {}

  linkProgram(program: any) {}

  getProgramParameter(program: any, pname: number) {
    return true;
  }

  getProgramInfoLog(program: any) {
    return '';
  }

  deleteProgram(program: any) {}

  useProgram(program: any) {}

  getUniformBlockIndex(program: any, name: string) {
    return 0;
  }

  uniformBlockBinding(program: any, blockIndex: number, bindingPoint: number) {}

  getUniformLocation(program: any, name: string) {
    return { name };
  }

  uniform1i(location: any, value: number) {}

  createBuffer() {
    return { label: 'MockBuffer' };
  }

  bindBuffer(target: number, buffer: any) {}

  bufferData(target: number, sizeOrData: any, usage: number) {}

  bufferSubData(target: number, offset: number, data: any) {}

  bindBufferBase(target: number, index: number, buffer: any) {}

  deleteBuffer(buffer: any) {}

  createVertexArray() {
    return { label: 'MockVAO' };
  }

  bindVertexArray(vao: any) {}

  deleteVertexArray(vao: any) {}

  createFramebuffer() {
    return { label: 'MockFBO' };
  }

  bindFramebuffer(target: number, fbo: any) {}

  framebufferTexture2D(target: number, attachment: number, textarget: number, texture: any, level: number) {}

  deleteFramebuffer(fbo: any) {}

  createTexture() {
    return { label: 'MockTexture' };
  }

  bindTexture(target: number, texture: any) {}

  texParameteri(target: number, pname: number, param: number) {}

  texImage2D(target: number, level: number, internalformat: number, width: number, height: number, border: number, format: number, type: number, pixels: any) {}

  texImage3D(target: number, level: number, internalformat: number, width: number, height: number, depth: number, border: number, format: number, type: number, pixels: any) {}

  deleteTexture(texture: any) {}

  activeTexture(textureUnit: number) {}

  viewport(x: number, y: number, width: number, height: number) {}

  clearColor(r: number, g: number, b: number, a: number) {}

  clear(mask: number) {}

  enable(cap: number) {}

  disable(cap: number) {}

  drawArrays(mode: number, first: number, count: number) {}

  getExtension(name: string) {
    if (name === 'EXT_color_buffer_float') return {};
    if (name === 'OES_texture_float_linear') return {};
    return null;
  }

  readPixels(x: number, y: number, width: number, height: number, format: number, type: number, pixels: ArrayBufferView) {
    if (pixels instanceof Float32Array) {
      pixels.set(this.mockReadPixelsData);
    } else if (pixels instanceof Uint8Array) {
      pixels[0] = Math.round(this.mockReadPixelsData[0] * 255);
      pixels[1] = Math.round(this.mockReadPixelsData[1] * 255);
      pixels[2] = Math.round(this.mockReadPixelsData[2] * 255);
      pixels[3] = Math.round(this.mockReadPixelsData[3] * 255);
    }
  }
}

describe('TASK-09D: WebGL2 Provisional Volume Picking Subsystem', () => {
  const depthLut = new DepthLookupTable([0, 10, 50, 100, 500, 1000, 5000]);
  const transformer = new CoordinateTransformer(
    {
      minLongitudeDeg: -80,
      minLatitudeDeg: 20,
      maxLongitudeDeg: -60,
      maxLatitudeDeg: 40,
      minDepthM: 0,
      maxDepthM: 5000,
      originLongitudeDeg: -70,
      originLatitudeDeg: 30,
      originDepthM: 0,
      verticalExaggeration: 100,
    },
    depthLut
  );

  it('should compile GLSL ES 3.00 volume picking shader strings', () => {
    assert.ok(VOLUME_PICKING_VERT_GLSL.includes('#version 300 es'));
    assert.ok(VOLUME_PICKING_VERT_GLSL.includes('gl_VertexID'));
    assert.ok(VOLUME_PICKING_FRAG_GLSL.includes('#version 300 es'));
    assert.ok(VOLUME_PICKING_FRAG_GLSL.includes('layout(std140) uniform VolumePickingUniforms'));
    assert.ok(VOLUME_PICKING_FRAG_GLSL.includes('intersectAABB'));
    assert.ok(VOLUME_PICKING_FRAG_GLSL.includes('sampleTrilinearUint'));
  });

  it('should execute WebGL2 picking pass, read back FBO pixel, and map hit to ProvisionalRenderPickResponse', async () => {
    const mockGl = new MockWebGL2RenderingContext();
    const picker = new WebGL2VolumePicker({
      gl: mockGl as unknown as WebGL2RenderingContext,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: 'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degree_Celsius',
      targetTimeUtc: '2026-08-30T00:00:00Z',
      lodLevel: 0,
      scalarScale: 34.0,
      scalarOffset: -2.0,
    });

    // Simulate WebGL2 FBO pixel readback: hit at u=0.5, v=0.5, w=0.25 (depth ~100m, lon -70, lat 30), scalar=24.85 degC
    mockGl.mockReadPixelsData = new Float32Array([0.5, 0.5, 0.25, 24.85]);

    const mockTexture = {} as WebGLTexture;
    const result = await picker.pick(mockTexture, {
      origin: [0.5, 0.5, -0.5],
      direction: [0.0, 0.0, 1.0],
    });

    assert.equal(result.hit, true);
    assert.equal(result.rawGpuData.hitFlag, 1);
    assert.ok(Math.abs(result.rawGpuData.scalarValue - 24.85) < 1e-4);
    assert.deepEqual(result.normalizedCoord, [0.5, 0.5, 0.25]);

    const prov = result.provisionalPickResult!.provisionalPick;
    assert.equal(prov.response_type, 'approximate_render_sample');
    assert.equal(
      prov.visualization_product_id,
      'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087'
    );
    assert.ok(Math.abs(prov.approximate_value - 24.85) < 1e-4);
    assert.equal(prov.display_units, 'degree_Celsius');
    assert.ok(prov.approximation_notice.includes('Provisional rendered value'));

    const req = result.provisionalPickResult!.reconcileRequest;
    assert.equal(req.dataset_id, 'copernicus_ocean_physics');
    assert.equal(req.variable_id, 'sea_water_potential_temperature');
    assert.equal(req.longitude_deg, -70.0);
    assert.equal(req.latitude_deg, 30.0);
  });

  it('should return hit=false when ray misses volume (all zero pixel output)', async () => {
    const mockGl = new MockWebGL2RenderingContext();
    const picker = new WebGL2VolumePicker({
      gl: mockGl as unknown as WebGL2RenderingContext,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: 'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degree_Celsius',
      targetTimeUtc: '2026-08-30T00:00:00Z',
    });

    // Empty pixel data
    mockGl.mockReadPixelsData = new Float32Array([0.0, 0.0, 0.0, 0.0]);

    const mockTexture = {} as WebGLTexture;
    const result = await picker.pick(mockTexture, {
      origin: [2.0, 2.0, 2.0],
      direction: [1.0, 0.0, 0.0],
    });

    assert.equal(result.hit, false);
    assert.equal(result.rawGpuData.hitFlag, 0);
    assert.equal(result.provisionalPickResult, undefined);
  });

  it('should throw WebGL2ResourceDisposedError when picking after dispose', async () => {
    const mockGl = new MockWebGL2RenderingContext();
    const picker = new WebGL2VolumePicker({
      gl: mockGl as unknown as WebGL2RenderingContext,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: 'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degree_Celsius',
      targetTimeUtc: '2026-08-30T00:00:00Z',
    });

    picker.dispose();
    assert.equal(picker.isDisposed, true);

    await assert.rejects(
      async () => picker.pick({} as any, { origin: [0, 0, 0], direction: [0, 0, 1] }),
      (err) => err instanceof WebGL2ResourceDisposedError
    );
  });
});

describe('TASK-09D: WebGL2 Authoritative Reconciliation Client Integration', () => {
  const depthLut = new DepthLookupTable([0, 10, 50, 100, 500, 1000, 5000]);
  const transformer = new CoordinateTransformer(
    {
      minLongitudeDeg: -80,
      minLatitudeDeg: 20,
      maxLongitudeDeg: -60,
      maxLatitudeDeg: 40,
      minDepthM: 0,
      maxDepthM: 5000,
      originLongitudeDeg: -70,
      originLatitudeDeg: 30,
      originDepthM: 0,
      verticalExaggeration: 100,
    },
    depthLut
  );

  it('should dispatch reconcile-pick query and synthesize unified reconciliation result for WebGL2 hit', async () => {
    let interceptedRequest: ReconcilePickRequest | null = null;

    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      interceptedRequest = JSON.parse(init?.body as string) as ReconcilePickRequest;
      const mockResponse: ApiResponse<ReconcilePickResponse> = {
        data: {
          response_type: 'authoritative_reconciled_pick',
          provisional_value: interceptedRequest.provisional_pick.approximate_value,
          provisional_lod_level: interceptedRequest.provisional_pick.lod_level,
          estimated_sample_error_bound: interceptedRequest.provisional_pick.estimated_sample_error_bound,
          authoritative_response: {
            response_type: 'authoritative_scientific_value',
            dataset_id: interceptedRequest.dataset_id || 'copernicus_ocean_physics',
            variable_id: interceptedRequest.variable_id || 'sea_water_potential_temperature',
            scientific_value: 24.87654,
            canonical_units: 'degree_Celsius',
            value_state: 'valid',
            requested_latitude_deg: interceptedRequest.latitude_deg || 30.0,
            requested_longitude_deg: interceptedRequest.longitude_deg || -70.0,
            resolved_latitude_deg: 30.0,
            resolved_longitude_deg: -70.0,
            resolved_depth_m: 10.0,
            resolved_time_utc: '2026-08-30T00:00:00Z',
            grid_index_evaluated: [6, 2, 60, 120],
            selection_method_used: 'trilinear_interpolation',
            source_asset_id: 'copernicus_phy_thetao_nc',
            source_asset_sha256: 'sha256_mock_asset_copernicus',
            provenance_details: { provider: 'CMEMS' },
          },
          absolute_difference_delta: 0.02654,
          relative_difference_percent: 0.106,
          within_estimated_error_bound: true,
          reconciliation_notice: 'PROVISIONAL PICK RECONCILED: Evaluated directly from NetCDF source.',
        },
        meta: {
          requestId: 'req_reconcile_test_09d',
          schemaVersion: '1.0.0',
          timestampUtc: '2026-08-30T12:00:00Z',
        },
      };

      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const queryClient = new QuasarQueryClient({
      baseUrl: 'http://localhost:8000',
      fetch: mockFetch as typeof fetch,
    });

    const mockGl = new MockWebGL2RenderingContext();
    const picker = new WebGL2VolumePicker({
      gl: mockGl as unknown as WebGL2RenderingContext,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      visualizationProductId: 'vis_copernicus_phy_thetao_copernicus-phy-thetao-20260824-20260830-ca826087',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degree_Celsius',
      targetTimeUtc: '2026-08-30T00:00:00Z',
    });

    mockGl.mockReadPixelsData = new Float32Array([0.5, 0.5, 0.25, 24.85]);

    const pickResult = await picker.pick({} as any, {
      origin: [0.5, 0.5, 0],
      direction: [0, 0, 1],
    });

    const unified = await reconcilePickWithBackend(pickResult, queryClient);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.dataset_id, 'copernicus_ocean_physics');
    assert.equal(interceptedRequest.variable_id, 'sea_water_potential_temperature');
    assert.ok(Math.abs(interceptedRequest.provisional_pick.approximate_value - 24.85) < 1e-4);

    // Verify dual provisional / authoritative values
    assert.ok(Math.abs(unified.provisional.approximateValue - 24.85) < 1e-4);
    assert.equal(unified.provisional.displayUnits, 'degree_Celsius');
    assert.equal(unified.authoritative.scientificValue, 24.87654);
    assert.equal(unified.authoritative.canonicalUnits, 'degree_Celsius');
    assert.equal(unified.authoritative.sourceAssetId, 'copernicus_phy_thetao_nc');
    assert.equal(unified.comparison.withinEstimatedErrorBound, true);
    assert.equal(unified.comparison.absoluteDifferenceDelta, 0.02654);
  });

  it('should probe backends in environment via WebGL2BackendAdapter', async () => {
    const probe = await WebGL2BackendAdapter.probeBackends();
    assert.ok('preferredBackend' in probe);
    assert.ok('webgpuSupported' in probe);
    assert.ok('webgl2Supported' in probe);
  });
});
