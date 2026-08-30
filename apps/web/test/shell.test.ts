/**
 * Automated Unit Test Suite for TASK-10B (App Shell & Dataset Navigation).
 *
 * Tests:
 * 1. Health probe badge state transitions (healthy / degraded / offline).
 * 2. Backend capability selector & hardware state (Auto / WebGPU / WebGL2).
 * 3. Dataset navigation: active dataset, snapshot pinning, and variable selector.
 * 4. Spatial bounding box & depth extents indicator formatting.
 * 5. Discrete 7-day timeline scrubbing, step navigation, playback toggle, and generation tagging.
 * 6. Session consistency & mutation prevention contract adherence.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useAppStore } from '../src/context/app_store.ts';

describe('QuasarOS Web App Shell & Control Plane (TASK-10B)', () => {
  beforeEach(() => {
    // Reset store state to baseline
    const store = useAppStore.getState();
    store.setHealthStatus(null, 'healthy');
    store.setBackendChoice('auto');
    store.setActiveBackend('webgpu', 'Hardware WebGPU Adapter');
    store.setDeviceLost(false);
    store.setActiveDataset('copernicus_phy_thetao', 'copernicus-phy-thetao-20260824-20260830-ca826087');
    store.setActiveVariable('thetao (Sea Water Potential Temperature, °C)');
    store.setTimestepIndex(6);
    store.setPlaying(false);
  });

  it('should maintain service health probe states and transition cleanly', () => {
    const store = useAppStore.getState();

    // Verify initial healthy state
    assert.equal(store.healthProbeState, 'healthy');

    // Simulate degraded probe
    store.setHealthStatus(null, 'degraded');
    assert.equal(useAppStore.getState().healthProbeState, 'degraded');

    // Simulate offline probe
    store.setHealthStatus(null, 'offline');
    assert.equal(useAppStore.getState().healthProbeState, 'offline');

    // Restore healthy probe with payload
    store.setHealthStatus(
      {
        status: 'ok',
        service: 'quasar-catalog-service',
        version: '1.0.0',
        activeSnapshotsCount: 1,
        historicalSnapshotsCount: 0,
        visualizationProductsCount: 1,
        integrityVerified: true,
      },
      'healthy'
    );
    assert.equal(useAppStore.getState().healthProbeState, 'healthy');
    assert.equal(useAppStore.getState().healthStatus?.integrityVerified, true);
  });

  it('should toggle rendering backend options and manage GPU device lost state', () => {
    const store = useAppStore.getState();
    assert.equal(store.backendChoice, 'auto');
    assert.equal(store.activeBackend, 'webgpu');
    assert.equal(store.isDeviceLost, false);

    // Switch to explicit WebGPU
    store.setBackendChoice('webgpu');
    assert.equal(useAppStore.getState().backendChoice, 'webgpu');

    // Switch to WebGL2 fallback
    store.setBackendChoice('webgl2');
    store.setActiveBackend('webgl2', 'OpenGL ES 3.0 (WebGL 2)');
    assert.equal(useAppStore.getState().backendChoice, 'webgl2');
    assert.equal(useAppStore.getState().activeBackend, 'webgl2');
    assert.equal(useAppStore.getState().gpuAdapterName, 'OpenGL ES 3.0 (WebGL 2)');

    // Simulate WebGPU context/device loss event
    store.setDeviceLost(true);
    assert.equal(useAppStore.getState().isDeviceLost, true);

    // Context recovery
    store.setDeviceLost(false);
    assert.equal(useAppStore.getState().isDeviceLost, false);
  });

  it('should verify pinned operational snapshot identity and variable selection', () => {
    const store = useAppStore.getState();
    assert.equal(store.activeDatasetId, 'copernicus_phy_thetao');
    assert.equal(store.activeSnapshotId, 'copernicus-phy-thetao-20260824-20260830-ca826087');
    assert.ok(store.activeVariableId.includes('thetao'));
    assert.equal(store.availableVariables.length, 5);

    // Pinned session validation
    assert.ok(store.pinnedSession !== null);
    assert.equal(store.pinnedSession?.snapshotId, 'copernicus-phy-thetao-20260824-20260830-ca826087');
    assert.equal(
      store.pinnedSession?.manifestSha256,
      'ca8260876715bebea2da013b532bef0014692d345555c5e6fd175809bded158c'
    );
  });

  it('should correctly represent geodetic spatial domain bounds and depth extents', () => {
    const { spatialBounds } = useAppStore.getState();
    assert.equal(spatialBounds.minLon, 80.0);
    assert.equal(spatialBounds.maxLon, 88.0);
    assert.equal(spatialBounds.minLat, -3.0);
    assert.equal(spatialBounds.maxLat, 12.0);
    assert.equal(spatialBounds.minDepthM, 0.494);
    assert.equal(spatialBounds.maxDepthM, 453.938);

    // Update ROI bounds
    useAppStore.getState().setSpatialBounds({ minLon: 82.0, maxLon: 86.0 });
    const updated = useAppStore.getState().spatialBounds;
    assert.equal(updated.minLon, 82.0);
    assert.equal(updated.maxLon, 86.0);
    assert.equal(updated.minLat, -3.0);
  });

  it('should scrub discrete 7-day timesteps, advance generations, and manage playback controls', () => {
    const store = useAppStore.getState();
    assert.equal(store.totalTimesteps, 7);
    assert.equal(store.timestepIndex, 6);
    assert.equal(store.currentDateIso, '2026-08-30');
    const initialGen = store.activeGeneration;

    // Step previous (t6 -> t5)
    store.prevTimestep();
    let state = useAppStore.getState();
    assert.equal(state.timestepIndex, 5);
    assert.equal(state.currentDateIso, '2026-08-29');
    assert.equal(state.activeGeneration, initialGen + 1);

    // Step previous (t5 -> t4)
    store.prevTimestep();
    state = useAppStore.getState();
    assert.equal(state.timestepIndex, 4);
    assert.equal(state.currentDateIso, '2026-08-28');
    assert.equal(state.activeGeneration, initialGen + 2);

    // Jump to start (t0)
    store.setTimestepIndex(0);
    state = useAppStore.getState();
    assert.equal(state.timestepIndex, 0);
    assert.equal(state.currentDateIso, '2026-08-24');
    assert.equal(state.activeGeneration, initialGen + 3);

    // Step next (t0 -> t1)
    store.nextTimestep();
    state = useAppStore.getState();
    assert.equal(state.timestepIndex, 1);
    assert.equal(state.currentDateIso, '2026-08-25');
    assert.equal(state.activeGeneration, initialGen + 4);

    // Playback toggle
    assert.equal(state.isPlaying, false);
    store.togglePlayback();
    assert.equal(useAppStore.getState().isPlaying, true);
    store.togglePlayback();
    assert.equal(useAppStore.getState().isPlaying, false);
  });

  it('should prevent out-of-bounds timestep scrubbing', () => {
    const store = useAppStore.getState();
    const currentIdx = store.timestepIndex;
    const currentGen = store.activeGeneration;

    // Attempt index -1 (must be ignored)
    store.setTimestepIndex(-1);
    assert.equal(useAppStore.getState().timestepIndex, currentIdx);
    assert.equal(useAppStore.getState().activeGeneration, currentGen);

    // Attempt index 10 (out of bounds for 7 days)
    store.setTimestepIndex(10);
    assert.equal(useAppStore.getState().timestepIndex, currentIdx);
    assert.equal(useAppStore.getState().activeGeneration, currentGen);
  });
});



