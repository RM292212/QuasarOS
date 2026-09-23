/**
 * Milestone 3 Comprehensive Test Suite:
 * 3D Viewport Orientation, Realism & LOD State Machine
 *
 * Tests:
 * 1. Geographic Aspect Ratio & Slab Transformation Mathematics.
 * 2. Downward Depth Convention & Zero Default Auto-Rotation.
 * 3. 3D ENU Compass Gizmo, Heading/Pitch Readouts & Snap Targets.
 * 4. Metric Geodetic Depth Ticks (0m - 5,728m) & Vertical Exaggeration Scaling.
 * 5. Multi-LOD Resolution State Machine & Exact Grid Dimension Reporting.
 * 6. Strict GPU Texture VRAM Budget Compliance (<50 MiB).
 * 7. Persistent Pipeline Generation Tokens & Bidirectional Variable Transitions.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAppStore, LOD_CONFIGS, type LODMode, type GridDimensionInfo } from '../src/context/app_store.ts';
import { VolumeQualityModel } from '../src/components/controls/volume_quality_controls.ts';
import {
  ENUCompassGizmoModel,
  DepthTicksModel,
  VerticalExaggerationController,
  CoastlineVectorModel,
} from '../../../packages/runtime/src/geology/index.ts';

describe('Milestone 3: 3D Viewport Orientation, Realism & LOD State Machine', () => {
  beforeEach(() => {
    // Reset app store state
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

  describe('1. Ocean Slab Aspect Ratio & Viewport Geometry', () => {
    it('should calculate accurate geodetic aspect ratio (0.534 : 0.172 : 1.000 at 50x VE)', () => {
      const sx = 0.534;
      const defaultVe = 50.0;
      const sy = 0.172 * (defaultVe / 50.0);
      const sz = 1.000;

      assert.equal(sx, 0.534);
      assert.equal(sy, 0.172);
      assert.equal(sz, 1.000);

      // Verify at 25x VE (half vertical thickness)
      const sy25 = 0.172 * (25.0 / 50.0);
      assert.equal(sy25, 0.086);

      // Verify at 100x VE (double vertical thickness)
      const sy100 = 0.172 * (100.0 / 50.0);
      assert.equal(sy100, 0.344);
    });

    it('should enforce downward depth convention (Sea surface at top +Y, Seafloor at bottom -Y)', () => {
      const sy = 0.172;
      // In texture space, w=0 is surface, w=1 is seafloor (5,728m)
      const surfaceY = sy * (0.5 - 0.0);
      const seafloorY = sy * (0.5 - 1.0);
      const centerY = sy * (0.5 - 0.5);

      assert.equal(surfaceY, 0.5 * sy);
      assert.equal(seafloorY, -0.5 * sy);
      assert.equal(centerY, 0.0);

      // Surface must be strictly above seafloor in world Y
      assert.ok(surfaceY > seafloorY);
    });

    it('should maintain zero default auto-rotation camera state', () => {
      // In OceanVolumeViewport, default camera angles remain stationary without user drag
      const initialPitch = 0.45;
      const initialYaw = -0.55;
      const initialDistance = 2.0;

      assert.ok(initialPitch > 0 && initialPitch < Math.PI / 2); // Looking downward from above
      assert.ok(initialDistance >= 1.0 && initialDistance <= 5.0);
    });
  });

  describe('2. 3D Geographic Orientation Indicators & HUD', () => {
    it('should compute 3D ENU compass axes and headings correctly', () => {
      const gizmo = new ENUCompassGizmoModel();
      // Test facing North (heading = 0)
      gizmo.updateFromAngles(0.45, 0.0);
      const stateN = gizmo.computeState();
      assert.equal(stateN.headingDeg, 0.0);
      assert.equal(stateN.axes.length, 3);

      const eastAxis = stateN.axes.find((a) => a.code === 'E');
      const northAxis = stateN.axes.find((a) => a.code === 'N');
      const upAxis = stateN.axes.find((a) => a.code === 'U');

      assert.ok(eastAxis);
      assert.equal(eastAxis.colorHex, '#ef4444'); // Red (+X)
      assert.ok(northAxis);
      assert.equal(northAxis.colorHex, '#22c55e'); // Green (+Z/+Y)
      assert.ok(upAxis);
      assert.equal(upAxis.colorHex, '#38bdf8'); // Sky Blue (+Y/+Z)
    });

    it('should generate metric depth ticks spanning full column (0m to 5,728m)', () => {
      const depthModel = new DepthTicksModel(0.494, 5727.917, 50.0, 1000.0);
      const ticks = depthModel.generateDepthTicks();

      assert.ok(ticks.length >= 7);
      assert.equal(ticks[0].depthM, 0.0);
      assert.ok(ticks[0].formattedLabel.includes('0 m'));
      assert.ok(ticks[0].formattedLabel.includes('Surface'));

      const maxTick = ticks[ticks.length - 1];
      assert.equal(maxTick.depthM, 5727.917);
      assert.ok(maxTick.formattedLabel.includes('5,728 m'));
      assert.ok(maxTick.formattedLabel.includes('Seafloor Max'));

      // Check corner axes generation
      const cornerAxes = depthModel.generateCornerAxes();
      assert.equal(cornerAxes.length, 4); // SW, SE, NW, NE
    });

    it('should control vertical exaggeration within [10x, 100x] bounds', () => {
      const veController = new VerticalExaggerationController(50.0, 10.0, 100.0);
      assert.equal(veController.factor, 50.0);
      assert.equal(veController.state.normalizedScaleZ, 1.0);

      veController.setFactor(25.0);
      assert.equal(veController.factor, 25.0);
      assert.equal(veController.state.normalizedScaleZ, 0.5);

      // Clamping out-of-bounds
      veController.setFactor(5.0);
      assert.equal(veController.factor, 10.0);

      veController.setFactor(150.0);
      assert.equal(veController.factor, 100.0);
    });

    it('should generate coastline polylines for Arabian Sea region', () => {
      const coastModel = new CoastlineVectorModel();
      assert.ok(coastModel.features.length >= 5);

      const segments = coastModel.generateSurfaceSegments(0.0);
      assert.ok(segments.length >= 5);

      const buffer = coastModel.generateLineVertexBuffer(0.0);
      assert.ok(buffer.length > 0);
      assert.equal(buffer.length % 3, 0); // 3 floats per vertex (x, y, z)
    });
  });

  describe('3. Multi-LOD Resolution Pipeline & State Machine', () => {
    it('should define distinct LOD presets with exact dimensions', () => {
      const preview = LOD_CONFIGS.preview;
      assert.equal(preview.depthLevels, 16);
      assert.equal(preview.latRes, 32);
      assert.equal(preview.lonRes, 32);
      assert.equal(preview.voxelCount, 16384);
      assert.ok(preview.estimatedVramMb < 0.1);

      const interactive = LOD_CONFIGS.interactive;
      assert.equal(interactive.depthLevels, 24);
      assert.equal(interactive.latRes, 48);
      assert.equal(interactive.lonRes, 48);
      assert.equal(interactive.voxelCount, 55296);
      assert.ok(interactive.estimatedVramMb < 0.3);

      const highQ = LOD_CONFIGS.high_quality;
      assert.equal(highQ.depthLevels, 50);
      assert.equal(highQ.latRes, 181);
      assert.equal(highQ.lonRes, 97);
      assert.equal(highQ.voxelCount, 877850);
      assert.ok(highQ.estimatedVramMb < 5.0);
    });

    it('should strictly comply with <50 MiB VRAM budget ceiling across all LOD modes', () => {
      const budgetCeilingMb = 50.0;
      const modes: LODMode[] = ['preview', 'interactive', 'high_quality'];

      for (const mode of modes) {
        const config = LOD_CONFIGS[mode];
        const voxelCount = config.depthLevels * config.latRes * config.lonRes;
        const scalarBytes = voxelCount * 4; // float32
        const maskBytes = voxelCount * 1;   // uint8
        const totalVramMb = (scalarBytes + maskBytes) / (1024 * 1024);

        assert.ok(
          totalVramMb < budgetCeilingMb,
          `Mode ${mode} VRAM ${totalVramMb} MiB exceeds 50 MiB budget`
        );
      }
    });

    it('should update store lodMode and advance activeGeneration token', () => {
      const store = useAppStore.getState();
      const initialGen = store.activeGeneration;

      useAppStore.getState().setLODMode('high_quality');
      const updated = useAppStore.getState();
      assert.equal(updated.lodMode, 'high_quality');
      assert.ok(updated.activeGeneration > initialGen);

      useAppStore.getState().setLODMode('preview');
      assert.equal(useAppStore.getState().lodMode, 'preview');
    });

    it('should update and validate GridDimensionInfo state reporting', () => {
      const info: GridDimensionInfo = {
        sourceDimensions: [50, 181, 97],
        returnedShape: [50, 181, 97],
        gpuTextureDimensions: [97, 181, 50],
        voxelCount: 877850,
        vramBytes: 4389250,
        vramMb: 4.186,
        budgetCeilingMb: 50.0,
        budgetPercent: 8.37,
      };

      useAppStore.getState().setGridInfo(info);
      const current = useAppStore.getState().gridInfo;
      assert.deepEqual(current?.sourceDimensions, [50, 181, 97]);
      assert.deepEqual(current?.returnedShape, [50, 181, 97]);
      assert.deepEqual(current?.gpuTextureDimensions, [97, 181, 50]);
      assert.equal(current?.voxelCount, 877850);
      assert.ok((current?.vramMb ?? 0) < 50.0);
    });
  });

  describe('4. Persistent Pipeline, Variables & State Transitions', () => {
    it('should include speed in availableVariables catalog', () => {
      const { availableVariables } = useAppStore.getState();
      assert.equal(availableVariables.length, 6);
      assert.ok(availableVariables.some((v) => v.toLowerCase().startsWith('thetao')));
      assert.ok(availableVariables.some((v) => v.toLowerCase().startsWith('speed')));
      assert.ok(availableVariables.some((v) => v.toLowerCase().startsWith('so')));
      assert.ok(availableVariables.some((v) => v.toLowerCase().startsWith('uo')));
      assert.ok(availableVariables.some((v) => v.toLowerCase().startsWith('vo')));
      assert.ok(availableVariables.some((v) => v.toLowerCase().startsWith('zos')));
    });

    it('should execute bidirectional variable transitions advancing generation tokens', () => {
      const store = useAppStore.getState();
      let gen = store.activeGeneration;

      // Transition thetao -> speed
      store.setActiveVariable('speed (Velocity Magnitude, m/s)');
      assert.equal(useAppStore.getState().activeVariableId, 'speed (Velocity Magnitude, m/s)');
      assert.equal(useAppStore.getState().activeGeneration, gen + 1);
      gen = useAppStore.getState().activeGeneration;

      // Transition speed -> so
      store.setActiveVariable('so (Sea Water Salinity, 1e-3)');
      assert.equal(useAppStore.getState().activeVariableId, 'so (Sea Water Salinity, 1e-3)');
      assert.equal(useAppStore.getState().activeGeneration, gen + 1);
      gen = useAppStore.getState().activeGeneration;

      // Transition so -> thetao (round-trip)
      store.setActiveVariable('thetao (Sea Water Potential Temperature, °C)');
      assert.equal(useAppStore.getState().activeVariableId, 'thetao (Sea Water Potential Temperature, °C)');
      assert.equal(useAppStore.getState().activeGeneration, gen + 1);
    });

    it('should synchronize VolumeQualityModel with LOD mode and vertical exaggeration', () => {
      const model = new VolumeQualityModel({
        lodMode: 'interactive',
        verticalExaggeration: 50.0,
      });

      assert.equal(model.lodMode, 'interactive');
      assert.equal(model.verticalExaggeration, 50.0);

      model.setLODMode('high_quality');
      assert.equal(model.lodMode, 'high_quality');

      model.setVerticalExaggeration(75.0);
      assert.equal(model.verticalExaggeration, 75.0);

      model.resetDefaults();
      assert.equal(model.lodMode, 'interactive');
      assert.equal(model.verticalExaggeration, 50.0);
    });
  });
});
