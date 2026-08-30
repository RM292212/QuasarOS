import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GpuVolumePicker,
  reconcilePickWithBackend,
  VOLUME_PICKING_WGSL,
  GPUResourceDisposedError,
} from '../src/index.ts';
import { CoordinateTransformer, DepthLookupTable } from '@quasar/runtime';
import { QuasarQueryClient } from '@quasar/client';
import type { ReconcilePickRequest, ReconcilePickResponse, ApiResponse } from '@quasar/client';

/** Mock WebGPU infrastructure for Picking tests */
class MockGPUBuffer {
  readonly label: string;
  readonly size: number;
  readonly usage: number;
  private _mappedData: ArrayBuffer | null = null;
  isDestroyed = false;

  constructor(descriptor: GPUBufferDescriptor) {
    this.label = descriptor.label || '';
    this.size = descriptor.size;
    this.usage = descriptor.usage;
    this._mappedData = new ArrayBuffer(this.size);
  }

  setBufferData(buffer: ArrayBuffer): void {
    new Uint8Array(this._mappedData!).set(new Uint8Array(buffer));
  }

  async mapAsync(mode: number, offset = 0, size?: number): Promise<void> {
    if (this.isDestroyed) throw new Error('Buffer destroyed');
  }

  getMappedRange(offset = 0, size?: number): ArrayBuffer {
    return this._mappedData!.slice(offset, size ? offset + size : undefined);
  }

  unmap(): void {}

  destroy(): void {
    this.isDestroyed = true;
  }
}

class MockGPUQueue {
  writtenBuffers: Array<{ buffer: MockGPUBuffer; offset: number; data: ArrayBuffer }> = [];

  writeBuffer(buffer: any, bufferOffset: number, data: BufferSource): void {
    const ab = data instanceof ArrayBuffer ? data : (data as ArrayBufferView).buffer;
    this.writtenBuffers.push({ buffer, offset: bufferOffset, data: ab });
  }

  submit(commandBuffers: any[]): void {}
}

class MockGPUDevice {
  readonly queue = new MockGPUQueue();
  readonly createdBuffers: MockGPUBuffer[] = [];
  stagingBufferRef: MockGPUBuffer | null = null;
  storageBufferRef: MockGPUBuffer | null = null;

  createShaderModule(descriptor: any) {
    return { label: descriptor.label, code: descriptor.code };
  }

  createComputePipeline(descriptor: any) {
    return {
      label: descriptor.label,
      getBindGroupLayout: () => ({}),
    };
  }

  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer {
    const buf = new MockGPUBuffer(descriptor);
    this.createdBuffers.push(buf);
    if (descriptor.label === 'VolumePickingStagingBuffer') {
      this.stagingBufferRef = buf;
    }
    if (descriptor.label === 'VolumePickingStorageBuffer') {
      this.storageBufferRef = buf;
    }
    return buf as unknown as GPUBuffer;
  }

  createSampler(descriptor: any) {
    return { label: descriptor.label };
  }

  createBindGroup(descriptor: any) {
    return { label: descriptor.label };
  }

  createCommandEncoder(descriptor: any) {
    const dev = this;
    return {
      beginComputePass: () => ({
        setPipeline: () => {},
        setBindGroup: () => {},
        dispatchWorkgroups: () => {},
        end: () => {},
      }),
      copyBufferToBuffer: (src: any, srcOffset: number, dst: any, dstOffset: number, size: number) => {
        if (dev.storageBufferRef && dev.stagingBufferRef) {
          dev.stagingBufferRef.setBufferData(dev.storageBufferRef.getMappedRange());
        }
      },
      finish: () => ({ label: 'CommandBuffer' }),
    };
  }
}

describe('TASK-08D: Provisional GPU Volume Picking Subsystem', () => {
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

  it('should compile WGSL volume picking shader string', () => {
    assert.ok(VOLUME_PICKING_WGSL.includes('struct PickUniforms'));
    assert.ok(VOLUME_PICKING_WGSL.includes('struct PickOutput'));
    assert.ok(VOLUME_PICKING_WGSL.includes('textureSampleLevel'));
    assert.ok(VOLUME_PICKING_WGSL.includes('intersect_aabb'));
  });

  it('should execute GPU picking pass and map hit to ProvisionalRenderPickResponse', async () => {
    const mockDevice = new MockGPUDevice();
    const picker = new GpuVolumePicker({
      device: mockDevice as unknown as GPUDevice,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'snap_20260830',
      visualizationProductId: 'vis_thetao_copernicus',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degC',
      targetTimeUtc: '2026-08-30T00:00:00Z',
      lodLevel: 0,
      scalarScale: 34.0,
      scalarOffset: -2.0,
    });

    // Simulate GPU write to storage buffer: hit at u=0.5, v=0.5, w=0.25 (depth ~100m, lon -70, lat 30)
    const gpuOutput = new ArrayBuffer(32);
    const f32 = new Float32Array(gpuOutput);
    const u32 = new Uint32Array(gpuOutput);
    f32[0] = 0.5; // hit_u (-70 deg lon)
    f32[1] = 0.5; // hit_v (30 deg lat)
    f32[2] = 0.25; // hit_w (~100m depth)
    f32[3] = 24.85; // provisional scalar value
    u32[4] = 1; // mask_code = valid ocean
    u32[5] = 1; // hit_flag = 1 (hit)
    mockDevice.storageBufferRef!.setBufferData(gpuOutput);

    const mockTextureView = {} as unknown as GPUTextureView;
    const result = await picker.pick(mockTextureView, {
      origin: [0.5, 0.5, -0.5],
      direction: [0.0, 0.0, 1.0],
    });

    assert.equal(result.hit, true);
    assert.equal(result.rawGpuData.hitFlag, 1);
    assert.ok(Math.abs(result.rawGpuData.scalarValue - 24.85) < 1e-4);
    assert.deepEqual(result.normalizedCoord, [0.5, 0.5, 0.25]);

    const prov = result.provisionalPickResult!.provisionalPick;
    assert.equal(prov.response_type, 'approximate_render_sample');
    assert.equal(prov.visualization_product_id, 'vis_thetao_copernicus');
    assert.ok(Math.abs(prov.approximate_value - 24.85) < 1e-4);
    assert.equal(prov.display_units, 'degC');
    assert.ok(prov.approximation_notice.includes('Provisional rendered value'));

    const req = result.provisionalPickResult!.reconcileRequest;
    assert.equal(req.dataset_id, 'copernicus_ocean_physics');
    assert.equal(req.variable_id, 'sea_water_potential_temperature');
    assert.equal(req.longitude_deg, -70.0);
    assert.equal(req.latitude_deg, 30.0);
  });

  it('should return hit=false when ray misses volume', async () => {
    const mockDevice = new MockGPUDevice();
    const picker = new GpuVolumePicker({
      device: mockDevice as unknown as GPUDevice,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'snap_20260830',
      visualizationProductId: 'vis_thetao_copernicus',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degC',
      targetTimeUtc: '2026-08-30T00:00:00Z',
    });

    // Empty output buffer (hit_flag = 0)
    const gpuOutput = new ArrayBuffer(32);
    mockDevice.storageBufferRef!.setBufferData(gpuOutput);

    const mockTextureView = {} as unknown as GPUTextureView;
    const result = await picker.pick(mockTextureView, {
      origin: [2.0, 2.0, 2.0],
      direction: [1.0, 0.0, 0.0],
    });

    assert.equal(result.hit, false);
    assert.equal(result.rawGpuData.hitFlag, 0);
    assert.equal(result.provisionalPickResult, undefined);
  });

  it('should throw GPUResourceDisposedError when picking after dispose', async () => {
    const mockDevice = new MockGPUDevice();
    const picker = new GpuVolumePicker({
      device: mockDevice as unknown as GPUDevice,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'snap_20260830',
      visualizationProductId: 'vis_thetao_copernicus',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degC',
      targetTimeUtc: '2026-08-30T00:00:00Z',
    });

    picker.dispose();
    assert.equal(picker.isDisposed, true);

    await assert.rejects(
      async () => picker.pick({} as any, { origin: [0, 0, 0], direction: [0, 0, 1] }),
      (err) => err instanceof GPUResourceDisposedError
    );
  });
});

describe('TASK-08D: Authoritative Reconciliation Client Integration', () => {
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

  it('should dispatch reconcile-pick query and synthesize unified reconciliation result', async () => {
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
            canonical_units: 'degC',
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
          requestId: 'req_reconcile_test_08d',
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

    const mockDevice = new MockGPUDevice();
    const picker = new GpuVolumePicker({
      device: mockDevice as unknown as GPUDevice,
      transformer,
      datasetId: 'copernicus_ocean_physics',
      snapshotId: 'snap_20260830',
      visualizationProductId: 'vis_thetao_copernicus',
      variableId: 'sea_water_potential_temperature',
      displayUnits: 'degC',
      targetTimeUtc: '2026-08-30T00:00:00Z',
    });

    const gpuOutput = new ArrayBuffer(32);
    const f32 = new Float32Array(gpuOutput);
    const u32 = new Uint32Array(gpuOutput);
    f32[0] = 0.5;
    f32[1] = 0.5;
    f32[2] = 0.25;
    f32[3] = 24.85;
    u32[4] = 1;
    u32[5] = 1;
    mockDevice.storageBufferRef!.setBufferData(gpuOutput);

    const pickResult = await picker.pick({} as any, {
      origin: [0.5, 0.5, 0],
      direction: [0, 0, 1],
    });

    const unified = await reconcilePickWithBackend(pickResult, queryClient);

    assert.ok(interceptedRequest);
    assert.equal(interceptedRequest.dataset_id, 'copernicus_ocean_physics');
    assert.equal(interceptedRequest.variable_id, 'sea_water_potential_temperature');
    assert.ok(Math.abs(interceptedRequest.provisional_pick.approximate_value - 24.85) < 1e-4);

    // Verify dual provisional/authoritative values
    assert.ok(Math.abs(unified.provisional.approximateValue - 24.85) < 1e-4);
    assert.equal(unified.provisional.displayUnits, 'degC');
    assert.equal(unified.authoritative.scientificValue, 24.87654);
    assert.equal(unified.authoritative.canonicalUnits, 'degC');
    assert.equal(unified.authoritative.sourceAssetId, 'copernicus_phy_thetao_nc');
    assert.equal(unified.comparison.withinEstimatedErrorBound, true);
    assert.equal(unified.comparison.absoluteDifferenceDelta, 0.02654);
  });
});
