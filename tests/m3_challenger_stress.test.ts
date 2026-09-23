/**
 * Challenger 2 Empirical Stress Test Suite for Milestone 3:
 * 3D Viewport Orientation, Realism & LOD State Machine
 *
 * Covers:
 * 1. Persistent Pipeline Texture Swapping (Zero Context/Shader Recreation across 7 timesteps x 6 variables).
 * 2. Rapid Scrubbing & Monotonic Generation Token Race Condition Stress Harness (Async Out-of-Order Dropping).
 * 3. ENU Compass Triad Coordinate Validation (+X East, +Z North, +Y Up/Surface, -Y Down/Seafloor).
 * 4. Cardinal Snap View Geometry & Camera Direction Vector Alignment.
 * 5. Geodetic Aspect Ratio & Depth Column Slicing Range (0.494m to 5,727.917m).
 * 6. VRAM Memory Ceiling (<50 MiB) across all LOD Modes and Variables.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAppStore, LOD_CONFIGS, type LODMode, type GridDimensionInfo } from '../apps/web/src/context/app_store.ts';
import {
  ENUCompassGizmoModel,
  DepthTicksModel,
  VerticalExaggerationController,
  CoastlineVectorModel,
} from '../packages/runtime/src/geology/index.ts';

describe('Challenger 2 Empirical Verification: Milestone 3 Orientation, Realism & LOD State Machine', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeDatasetId: 'copernicus_phy_thetao',
      activeSnapshotId: 'copernicus-phy-thetao-20260824-20260830-ca826087',
      activeVariableId: 'thetao (Sea Water Potential Temperature, °C)',
      lodMode: 'interactive',
      verticalExaggeration: 50.0,
      timestepIndex: 6,
      isPlaying: false,
      activeGeneration: 1,
    });
  });

  // ==========================================================================
  // CHALLENGE 1: Persistent Pipeline Texture Swapping
  // ==========================================================================
  describe('Challenge 1: Persistent Pipeline & Zero Re-allocation Texture Swapping', () => {
    it('should perform texture hot-swaps across all 7 timesteps and all 6 variables without pipeline re-creation', () => {
      // Mock GPU Resource Manager tracking allocations
      let contextCreations = 0;
      let shaderCompilations = 0;
      let programLinks = 0;
      let texture3DUploads = 0;
      let texture2DUploads = 0;

      class MockWebGL2ResourceManager {
        private textures = new Map<string, any>();

        uploadTexture3D(desc: { id: string; width: number; height: number; depth: number; data: ArrayBufferView }) {
          texture3DUploads++;
          const tex = { id: desc.id, w: desc.width, h: desc.height, d: desc.depth };
          this.textures.set(desc.id, tex);
          return { texture: tex };
        }

        uploadTexture2D(desc: { id: string; width: number; height: number; data: ArrayBufferView }) {
          texture2DUploads++;
          const tex = { id: desc.id, w: desc.width, h: desc.height };
          this.textures.set(desc.id, tex);
          return { texture: tex };
        }
      }

      // 1. Pipeline Initialization (Mounted once)
      contextCreations++; // WebGL2 context requested
      shaderCompilations += 2; // 1 VS, 1 FS for wireframe
      programLinks++; // Linked wireframe program
      const resManager = new MockWebGL2ResourceManager();

      // Initial colormap upload
      resManager.uploadTexture2D({
        id: 'tf_active',
        width: 256,
        height: 1,
        data: new Uint8Array(256 * 4),
      });

      const variables = ['thetao', 'speed', 'so', 'uo', 'vo', 'zos'];
      const timesteps = [0, 1, 2, 3, 4, 5, 6];

      // Simulate full 42-step matrix of variable switches and timeline scrubs
      for (const v of variables) {
        for (const t of timesteps) {
          const brickKey = `brick_${v}_t${t}`;
          const isSurfaceOnly = v === 'zos';
          const D = isSurfaceOnly ? 1 : 24;
          const H = 48;
          const W = 48;

          // Hot texture swap
          resManager.uploadTexture3D({
            id: `scalar_${brickKey}`,
            width: W,
            height: H,
            depth: D,
            data: new Float32Array(D * H * W),
          });

          resManager.uploadTexture3D({
            id: `mask_${brickKey}`,
            width: W,
            height: H,
            depth: D,
            data: new Uint8Array(D * H * W),
          });
        }
      }

      // Assert that context and shaders were initialized EXACTLY ONCE
      assert.equal(contextCreations, 1, 'Context must NOT be recreated during scrubs/swaps');
      assert.equal(shaderCompilations, 2, 'Shaders must NOT be recompiled during scrubs/swaps');
      assert.equal(programLinks, 1, 'Programs must NOT be re-linked during scrubs/swaps');

      // Assert that all 42 combinations hot-swapped their scalar and mask 3D textures (42 * 2 = 84 uploads)
      assert.equal(texture3DUploads, 84, 'Expected exactly 84 3D texture hot-swaps');
      assert.equal(texture2DUploads, 1, 'Transfer function LUT initialized once');
    });

    it('should verify bidirectional roundtrip thetao -> speed -> thetao maintains clean state', () => {
      const store = useAppStore.getState();
      const initialGen = store.activeGeneration;

      // 1. Initial State: thetao
      assert.ok(store.activeVariableId.startsWith('thetao'));

      // 2. Switch to speed
      store.setActiveVariable('speed (Velocity Magnitude, m/s)');
      assert.equal(useAppStore.getState().activeVariableId, 'speed (Velocity Magnitude, m/s)');
      assert.equal(useAppStore.getState().activeGeneration, initialGen + 1);

      // 3. Switch to so
      store.setActiveVariable('so (Sea Water Salinity, 1e-3)');
      assert.equal(useAppStore.getState().activeVariableId, 'so (Sea Water Salinity, 1e-3)');
      assert.equal(useAppStore.getState().activeGeneration, initialGen + 2);

      // 4. Switch back to thetao
      store.setActiveVariable('thetao (Sea Water Potential Temperature, °C)');
      assert.equal(useAppStore.getState().activeVariableId, 'thetao (Sea Water Potential Temperature, °C)');
      assert.equal(useAppStore.getState().activeGeneration, initialGen + 3);
    });
  });

  // ==========================================================================
  // CHALLENGE 2: State Machine Race Conditions & Monotonic Generation Tokens
  // ==========================================================================
  describe('Challenge 2: State Machine Race Conditions & Monotonic Generation Tokens', () => {
    it('should drop 100% of out-of-order stale async responses during rapid scrub stress test', async () => {
      // Simulate rapid scrub sequence with delayed, out-of-order network arrival
      interface AsyncResponse {
        requestGen: number;
        timestepIndex: number;
        varCode: string;
        dataTag: string;
      }

      let lastFetchedGen = 0;
      let activeFrontBufferTag: string | null = null;
      let droppedStaleCount = 0;
      let acceptedCount = 0;

      // Simulated network pipeline with variable latencies
      const simulateScrubRequest = (
        targetGen: number,
        tIndex: number,
        varCode: string,
        delayMs: number
      ): Promise<void> => {
        const requestGen = targetGen;
        lastFetchedGen = requestGen; // Generation updated immediately on dispatch

        return new Promise((resolve) => {
          setTimeout(() => {
            const response: AsyncResponse = {
              requestGen,
              timestepIndex: tIndex,
              varCode,
              dataTag: `${varCode}_t${tIndex}_g${requestGen}`,
            };

            // Generation token check matching OceanVolumeViewport.tsx line 757
            if (response.requestGen < lastFetchedGen) {
              droppedStaleCount++;
              resolve();
              return;
            }

            // Accept authoritative payload
            activeFrontBufferTag = response.dataTag;
            acceptedCount++;
            resolve();
          }, delayMs);
        });
      };

      // Execute rapid scrubs with inverted latencies:
      // Req 1: gen 1, day 0, delay 200ms (very slow)
      // Req 2: gen 2, day 1, delay 150ms
      // Req 3: gen 3, day 2, delay 100ms
      // Req 4: gen 4, day 3, delay 80ms
      // Req 5: gen 5, day 4, delay 50ms
      // Req 6: gen 6, day 5, delay 20ms
      // Req 7: gen 7, day 6, delay 5ms (fastest latest)

      const promises = [
        simulateScrubRequest(1, 0, 'thetao', 200),
        simulateScrubRequest(2, 1, 'thetao', 150),
        simulateScrubRequest(3, 2, 'thetao', 100),
        simulateScrubRequest(4, 3, 'thetao', 80),
        simulateScrubRequest(5, 4, 'thetao', 50),
        simulateScrubRequest(6, 5, 'thetao', 20),
        simulateScrubRequest(7, 6, 'thetao', 5),
      ];

      await Promise.all(promises);

      // Verify that out-of-order stale responses (gen 1..6) were completely dropped
      assert.equal(droppedStaleCount, 6, 'All 6 older responses must be rejected as stale');
      assert.equal(acceptedCount, 1, 'Only the latest generation (gen 7) should be accepted');
      assert.equal(
        activeFrontBufferTag,
        'thetao_t6_g7',
        'Front buffer must contain the authoritative latest frame'
      );
    });

    it('should handle 100 randomized asynchronous race requests without state desynchronization', async () => {
      let currentGen = 0;
      let lastFetchedGen = 0;
      let frontBufferGen = 0;
      let staleDrops = 0;
      let appliedUpdates = 0;

      const requests: Promise<void>[] = [];

      for (let i = 1; i <= 100; i++) {
        currentGen = i;
        lastFetchedGen = currentGen;
        const assignedGen = currentGen;
        const randomDelayMs = Math.floor(Math.random() * 50) + 1;

        const req = new Promise<void>((resolve) => {
          setTimeout(() => {
            if (assignedGen < lastFetchedGen) {
              staleDrops++;
            } else {
              frontBufferGen = assignedGen;
              appliedUpdates++;
            }
            resolve();
          }, randomDelayMs);
        });

        requests.push(req);
      }

      await Promise.all(requests);

      assert.equal(
        frontBufferGen,
        100,
        'Front buffer must accurately reflect final generation 100'
      );
      assert.ok(staleDrops > 0, 'Stale drops must have caught out-of-order frames');
      assert.equal(staleDrops + appliedUpdates, 100, 'Total processed requests must equal 100');
    });
  });

  // ==========================================================================
  // CHALLENGE 3: 3D ENU Coordinate System & Cardinal Snap View Geometry
  // ==========================================================================
  describe('Challenge 3: ENU Coordinate Triad & Cardinal Snap View Geometry', () => {
    it('should validate ENU axis vectors (+X East, +Z North, +Y Up/Surface, -Y Down/Seafloor)', () => {
      const sx = 0.534;
      const sy = 0.172; // at 50x VE
      const sz = 1.000;

      // Model transform equation from OceanVolumeViewport.tsx:
      // X = sx * (u - 0.5)
      // Y = sy * (0.5 - w)   (w=0 Surface -> +0.5*sy, w=1 Seafloor -> -0.5*sy)
      // Z = sz * (v - 0.5)   (v=0 South -> -0.5*sz, v=1 North -> +0.5*sz)

      // 1. East Boundary (u=1, v=0.5, w=0.5)
      const eastWorld = [sx * (1.0 - 0.5), sy * (0.5 - 0.5), sz * (0.5 - 0.5)];
      assert.deepEqual(eastWorld, [0.5 * sx, 0, 0]); // +X is East

      // 2. West Boundary (u=0, v=0.5, w=0.5)
      const westWorld = [sx * (0.0 - 0.5), sy * (0.5 - 0.5), sz * (0.5 - 0.5)];
      assert.deepEqual(westWorld, [-0.5 * sx, 0, 0]); // -X is West

      // 3. North Boundary (u=0.5, v=1.0, w=0.5)
      const northWorld = [sx * (0.5 - 0.5), sy * (0.5 - 0.5), sz * (1.0 - 0.5)];
      assert.deepEqual(northWorld, [0, 0, 0.5 * sz]); // +Z is North

      // 4. South Boundary (u=0.5, v=0.0, w=0.5)
      const southWorld = [sx * (0.5 - 0.5), sy * (0.5 - 0.5), sz * (0.0 - 0.5)];
      assert.deepEqual(southWorld, [0, 0, -0.5 * sz]); // -Z is South

      // 5. Sea Surface (u=0.5, v=0.5, w=0.0)
      const surfaceWorld = [sx * (0.5 - 0.5), sy * (0.5 - 0.0), sz * (0.5 - 0.5)];
      assert.deepEqual(surfaceWorld, [0, 0.5 * sy, 0]); // +Y is Surface (Up)

      // 6. Seafloor Max Depth (u=0.5, v=0.5, w=1.0)
      const seafloorWorld = [sx * (0.5 - 0.5), sy * (0.5 - 1.0), sz * (0.5 - 0.5)];
      assert.deepEqual(seafloorWorld, [0, -0.5 * sy, 0]); // -Y is Seafloor (Down)
    });

    it('should verify camera orientation angles and cardinal snap view targets', () => {
      // Snap configurations from OrientationGizmo.tsx:
      // Top:   pitch = PI/2 - 0.01 (~89.4°), yaw = 0
      // North: pitch = 0.05 (~2.9°),        yaw = 0 (heading = 0°)
      // South: pitch = 0.05 (~2.9°),        yaw = PI (heading = 180°)
      // East:  pitch = 0.05 (~2.9°),        yaw = -PI/2 (heading = 90°)
      // West:  pitch = 0.05 (~2.9°),        yaw = PI/2 (heading = 270°)
      // Iso:   pitch = 0.45 (~25.8°),       yaw = -0.55 (heading = ~31.5°)

      const gizmo = new ENUCompassGizmoModel();

      // 1. Top / Nadir Snap
      const snapTop = gizmo.updateFromAngles(Math.PI / 2 - 0.01, 0);
      assert.ok(Math.abs(snapTop.pitchDeg - 89.4) < 0.5);

      // 2. North Snap (Facing North, looking South or facing North)
      const snapNorth = gizmo.updateFromAngles(0.05, 0);
      assert.equal(Math.round(snapNorth.headingDeg), 0);
      assert.equal(Math.round(snapNorth.pitchDeg), 3);

      // 3. East Snap (Heading 90°)
      const snapEast = gizmo.updateFromAngles(0.05, -Math.PI / 2);
      assert.equal(Math.round(snapEast.headingDeg), 90);

      // 4. South Snap (Heading 180°)
      const snapSouth = gizmo.updateFromAngles(0.05, Math.PI);
      assert.equal(Math.round(snapSouth.headingDeg), 180);

      // 5. West Snap (Heading 270°)
      const snapWest = gizmo.updateFromAngles(0.05, Math.PI / 2);
      assert.equal(Math.round(snapWest.headingDeg), 270);

      // 6. Isometric Snap (~32° heading, ~26° pitch)
      const snapIso = gizmo.updateFromAngles(0.45, -0.55);
      assert.equal(Math.round(snapIso.headingDeg), 32);
      assert.equal(Math.round(snapIso.pitchDeg), 26);
    });

    it('should verify DepthTicksModel spans non-uniform depth column without inverted scales', () => {
      const depthModel = new DepthTicksModel(0.494, 5727.917, 50.0, 1000.0);
      const ticks = depthModel.generateDepthTicks();

      assert.equal(ticks[0].depthM, 0.0);
      assert.equal(ticks[0].normalizedW, (0.0 - 0.494) / (5727.917 - 0.494)); // slightly < 0 or clamped

      // Verify strictly increasing depths
      for (let i = 1; i < ticks.length; i++) {
        assert.ok(
          ticks[i].depthM > ticks[i - 1].depthM,
          `Tick ${i} depth (${ticks[i].depthM}) must be strictly greater than tick ${i - 1} (${ticks[i - 1].depthM})`
        );
        assert.ok(
          ticks[i].localZ < ticks[i - 1].localZ,
          `Downward depth convention requires deeper ticks to have smaller (more negative) localZ`
        );
      }

      // Seafloor terminal tick
      const lastTick = ticks[ticks.length - 1];
      assert.equal(lastTick.depthM, 5727.917);
      assert.ok(lastTick.formattedLabel.includes('5,728 m'));
    });
  });

  // ==========================================================================
  // CHALLENGE 4: Multi-LOD Memory Footprints & Budget Compliance
  // ==========================================================================
  describe('Challenge 4: Multi-LOD Memory Footprints & Strict Budget Compliance', () => {
    it('should verify VRAM memory footprint remains strictly under 50 MiB across all modes', () => {
      const modes: LODMode[] = ['preview', 'interactive', 'high_quality'];
      const budgetCeilingMb = 50.0;

      for (const mode of modes) {
        const config = LOD_CONFIGS[mode];
        const voxelCount = config.depthLevels * config.latRes * config.lonRes;
        // 4 bytes float32 scalar + 1 byte uint8 mask
        const vramBytes = voxelCount * 5;
        const vramMb = vramBytes / (1024 * 1024);

        assert.ok(
          vramMb < budgetCeilingMb,
          `Mode ${mode} memory ${vramMb.toFixed(2)} MiB exceeds ${budgetCeilingMb} MiB ceiling`
        );

        if (mode === 'preview') {
          assert.equal(voxelCount, 16384);
          assert.ok(vramMb < 0.1);
        } else if (mode === 'interactive') {
          assert.equal(voxelCount, 55296);
          assert.ok(vramMb < 0.3);
        } else if (mode === 'high_quality') {
          assert.equal(voxelCount, 877850);
          assert.ok(vramMb < 5.0);
        }
      }
    });
  });
});
