import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  COLORMAP_REGISTRY,
  sampleColormap,
  colorToHex,
  TransferFunctionModel,
  ScientificLegendFormatter,
  PhysicalClippingModel,
  VolumeQualityModel,
} from '../src/components/controls/index.ts';

import {
  ClippingController,
  CoordinateTransformer,
  DepthLookupTable,
  ClippingRangeError,
} from '../../../packages/runtime/src/index.ts';

describe('TASK-10C: Scientific Colormaps & Interpolation', () => {
  it('should register all required scientific colormaps: Viridis, Plasma, Turbo, Thermal, Coolwarm', () => {
    const keys = Object.keys(COLORMAP_REGISTRY);
    assert.ok(keys.includes('viridis'));
    assert.ok(keys.includes('plasma'));
    assert.ok(keys.includes('turbo'));
    assert.ok(keys.includes('thermal'));
    assert.ok(keys.includes('coolwarm'));
  });

  it('should interpolate colormaps smoothly in normalized [0.0, 1.0] domain', () => {
    for (const key of ['viridis', 'plasma', 'turbo', 'thermal', 'coolwarm']) {
      const cStart = sampleColormap(key, 0.0);
      const cMid = sampleColormap(key, 0.5);
      const cEnd = sampleColormap(key, 1.0);

      // Components must be within [0, 1]
      assert.ok(cStart.r >= 0 && cStart.r <= 1);
      assert.ok(cStart.g >= 0 && cStart.g <= 1);
      assert.ok(cStart.b >= 0 && cStart.b <= 1);

      assert.ok(cMid.r >= 0 && cMid.r <= 1);
      assert.ok(cMid.g >= 0 && cMid.g <= 1);
      assert.ok(cMid.b >= 0 && cMid.b <= 1);

      assert.ok(cEnd.r >= 0 && cEnd.r <= 1);
      assert.ok(cEnd.g >= 0 && cEnd.g <= 1);
      assert.ok(cEnd.b >= 0 && cEnd.b <= 1);

      // Start and end must not be identical for non-degenerate colormaps
      const diff = Math.abs(cStart.r - cEnd.r) + Math.abs(cStart.g - cEnd.g) + Math.abs(cStart.b - cEnd.b);
      assert.ok(diff > 0.1);
    }
  });

  it('should clamp out-of-bounds sample positions to [0.0, 1.0]', () => {
    const cNeg = sampleColormap('viridis', -0.5);
    const c0 = sampleColormap('viridis', 0.0);
    assert.equal(cNeg.r, c0.r);
    assert.equal(cNeg.g, c0.g);
    assert.equal(cNeg.b, c0.b);

    const cOver = sampleColormap('viridis', 1.5);
    const c1 = sampleColormap('viridis', 1.0);
    assert.equal(cOver.r, c1.r);
    assert.equal(cOver.g, c1.g);
    assert.equal(cOver.b, c1.b);
  });

  it('should auto-configure transfer function presets for ocean variables thetao, so, uo, vo, speed, zos', () => {
    const model = new TransferFunctionModel();

    // Thetao (Temperature)
    model.configureForVariable('thetao');
    assert.equal(model.colormapName, 'thermal');
    assert.equal(model.unit, '°C');
    assert.ok(model.domainMin <= 1.0);
    assert.ok(model.domainMax >= 30.0);
    assert.ok(model.state.opacityControlPoints.length >= 4);
    assert.ok(model.evaluateOpacity(0.0) <= 0.05); // Low temperature transparency

    // So (Salinity)
    model.configureForVariable('so');
    assert.equal(model.colormapName, 'coolwarm');
    assert.equal(model.unit, 'PSU');
    assert.equal(model.domainMin, 34.5);
    assert.equal(model.domainMax, 36.8);

    // Speed / Velocity Magnitude (Paper-aligned Yu et al. 2025)
    model.configureForVariable('speed');
    assert.equal(model.colormapName, 'turbo');
    assert.equal(model.unit, 'm/s');
    assert.equal(model.domainMin, 0.0);
    assert.equal(model.domainMax, 1.5);
    // Quiescent water (< 0.1 m/s, i.e. normalized < 0.0667) opacity <= 0.02
    assert.ok(model.evaluateOpacity(0.0) <= 0.02);
    assert.ok(model.evaluateOpacity(0.05 / 1.5) <= 0.02);
    assert.ok(model.evaluateOpacity(0.10 / 1.5) <= 0.02);
    // Jet core (> 0.7 m/s, i.e. normalized > 0.4667) opacity >= 0.85
    assert.ok(model.evaluateOpacity(0.70 / 1.5) >= 0.85);
    assert.ok(model.evaluateOpacity(1.0 / 1.5) >= 0.85);
    assert.ok(model.evaluateOpacity(1.5 / 1.5) >= 0.85);

    // Current velocity (uo / vo)
    model.configureForVariable('uo');
    assert.equal(model.colormapName, 'turbo');
    assert.equal(model.unit, 'm/s');
    assert.ok(model.evaluateOpacity(0.5) <= 0.10); // Quiescent velocity near 0 is transparent

    // Sea Surface Height (zos)
    model.configureForVariable('zos');
    assert.equal(model.colormapName, 'plasma');
    assert.equal(model.unit, 'm');
  });
});

describe('TASK-10C: Transfer Function Model & Evaluation', () => {
  it('should enforce scalar domain clamps from 9.3747°C to 30.3618°C', () => {
    const model = new TransferFunctionModel({
      domainMin: 9.374713,
      domainMax: 30.361834,
      unit: '°C',
    });

    assert.equal(model.domainMin, 9.374713);
    assert.equal(model.domainMax, 30.361834);
    assert.equal(model.clampedMin, 9.374713);
    assert.equal(model.clampedMax, 30.361834);

    // Setting valid clamps
    model.setClamps(15.0, 28.0);
    assert.equal(model.clampedMin, 15.0);
    assert.equal(model.clampedMax, 28.0);

    // Inverted clamps should throw
    assert.throws(() => {
      model.setClamps(28.0, 15.0);
    });

    // Out of domain clamps should throw
    assert.throws(() => {
      model.setClamps(5.0, 25.0);
    });
    assert.throws(() => {
      model.setClamps(15.0, 35.0);
    });
  });

  it('should support scalar clamps for non-temperature variables (speed, so, uo, zos) without errors', () => {
    const model = new TransferFunctionModel();

    // 1. Test Speed Clamps (0.0 to 1.5 m/s)
    model.configureForVariable('speed (Velocity Magnitude, m/s)', 0.05, 1.25);
    assert.equal(model.varCode, 'speed');
    assert.equal(model.unit, 'm/s');
    assert.equal(model.clampedMin, 0.05);
    assert.equal(model.clampedMax, 1.25);
    // User adjusts clamp to highlight high-velocity currents between 0.4 m/s and 1.1 m/s
    model.setClamps(0.40, 1.10);
    assert.equal(model.clampedMin, 0.40);
    assert.equal(model.clampedMax, 1.10);

    // 2. Test Salinity Clamps (34.0 to 37.0 PSU)
    model.configureForVariable('so (Sea Water Salinity, 1e-3)', 33.5, 37.2);
    assert.equal(model.varCode, 'so');
    assert.equal(model.unit, 'PSU');
    model.setClamps(34.2, 36.5);
    assert.equal(model.clampedMin, 34.2);
    assert.equal(model.clampedMax, 36.5);

    // 3. Test Sea Surface Height Clamps (0.2 to 0.8 m)
    model.configureForVariable('zos (Sea Surface Height Above Geoid, m)', 0.25, 0.75);
    assert.equal(model.varCode, 'zos');
    assert.equal(model.unit, 'm');
    model.setClamps(0.30, 0.70);
    assert.equal(model.clampedMin, 0.30);
    assert.equal(model.clampedMax, 0.70);
  });

  it('should evaluate piecewise linear opacity and colormap along physical values', () => {
    const model = new TransferFunctionModel({
      colormapName: 'thermal',
      domainMin: 10.0,
      domainMax: 30.0,
      clampedMin: 10.0,
      clampedMax: 30.0,
      opacityControlPoints: [
        { id: 'p0', normalizedScalar: 0.0, opacity: 0.0 },
        { id: 'p1', normalizedScalar: 0.5, opacity: 0.5 },
        { id: 'p2', normalizedScalar: 1.0, opacity: 1.0 },
      ],
    });

    // Midpoint (20.0 °C -> norm 0.5)
    const evalMid = model.evaluateScalar(20.0);
    assert.equal(evalMid.isOutOfRange, false);
    assert.ok(Math.abs(evalMid.opacity - 0.5) < 1e-4);

    // Low point (10.0 °C -> norm 0.0)
    const evalLow = model.evaluateScalar(10.0);
    assert.equal(evalLow.isOutOfRange, false);
    assert.equal(evalLow.opacity, 0.0);

    // High point (30.0 °C -> norm 1.0)
    const evalHigh = model.evaluateScalar(30.0);
    assert.equal(evalHigh.isOutOfRange, false);
    assert.equal(evalHigh.opacity, 1.0);

    // Out of range evaluation with discard_transparent policy
    const evalOut = model.evaluateScalar(5.0);
    assert.equal(evalOut.isOutOfRange, true);
    assert.equal(evalOut.opacity, 0.0);
  });

  it('should generate valid canonical TransferFunctionContract and 256-entry GPU LUT', () => {
    const model = new TransferFunctionModel({
      colormapName: 'viridis',
      domainMin: 9.374713,
      domainMax: 30.361834,
    });

    const contract = model.toContract();
    assert.equal(contract.colormap_preset_name, 'viridis');
    assert.equal(contract.physical_domain_min, 9.374713);
    assert.equal(contract.physical_domain_max, 30.361834);
    assert.equal(contract.physical_units, '°C');
    assert.ok(contract.control_points.length >= 2);

    const lut = model.generateLUT(256);
    assert.equal(lut.byteLength, 256 * 4);
    // Ensure first RGBA entry matches normalized position 0.0
    const firstCol = sampleColormap('viridis', 0.0);
    assert.equal(lut[0], Math.round(firstCol.r * 255));
    assert.equal(lut[1], Math.round(firstCol.g * 255));
    assert.equal(lut[2], Math.round(firstCol.b * 255));
  });

  it('should support adding, updating, and removing control points', () => {
    const model = new TransferFunctionModel();
    const initCount = model.state.opacityControlPoints.length;

    const newId = model.addControlPoint(0.35, 0.8);
    assert.equal(model.state.opacityControlPoints.length, initCount + 1);

    model.updateControlPoint(newId, { opacity: 0.9 });
    const updated = model.state.opacityControlPoints.find((p) => p.id === newId);
    assert.ok(updated);
    assert.equal(updated.opacity, 0.9);

    model.removeControlPoint(newId);
    assert.equal(model.state.opacityControlPoints.length, initCount);
  });
});

describe('TASK-10C: Scientific Legend & Colorbar Formatting', () => {
  it('should generate discrete colorbar ticks with explicit °C units', () => {
    const model = new TransferFunctionModel({
      colormapName: 'turbo',
      domainMin: 10.0,
      domainMax: 30.0,
      unit: '°C',
    });

    const legendModel = ScientificLegendFormatter.generateLegendModel(model.toContract(), {
      tickCount: 5,
      decimalPrecision: 1,
    });

    assert.equal(legendModel.ticks.length, 5);
    assert.equal(legendModel.ticks[0].formattedLabel, '10.0 °C');
    assert.equal(legendModel.ticks[1].formattedLabel, '15.0 °C');
    assert.equal(legendModel.ticks[2].formattedLabel, '20.0 °C');
    assert.equal(legendModel.ticks[3].formattedLabel, '25.0 °C');
    assert.equal(legendModel.ticks[4].formattedLabel, '30.0 °C');
  });

  it('should identify valid physical 0.0°C marker when domain crosses zero', () => {
    const model = new TransferFunctionModel({
      colormapName: 'coolwarm',
      domainMin: -5.0,
      domainMax: 15.0,
      unit: '°C',
    });

    const legendModel = ScientificLegendFormatter.generateLegendModel(model.toContract());
    assert.equal(legendModel.hasZeroMarker, true);
    assert.ok(legendModel.zeroMarkerNormalizedPosition !== undefined);
    // 0.0 in [-5.0, 15.0] is at fraction (0 - (-5)) / 20 = 5/20 = 0.25
    assert.ok(Math.abs(legendModel.zeroMarkerNormalizedPosition! - 0.25) < 1e-4);
  });

  it('should provide distinct land swatch (#222222) and missing data swatch (#888888)', () => {
    const model = new TransferFunctionModel();
    const legendModel = ScientificLegendFormatter.generateLegendModel(model.toContract());

    assert.equal(legendModel.landSwatch.colorHex, '#222222');
    assert.equal(legendModel.missingSwatch.colorHex, '#888888');
    assert.ok(legendModel.landSwatch.label.includes('Land'));
    assert.ok(legendModel.missingSwatch.label.includes('Missing'));
  });

  it('should render accessible SVG markup containing colorbar gradient and tick labels', () => {
    const model = new TransferFunctionModel({ colormapName: 'viridis' });
    const legendModel = ScientificLegendFormatter.generateLegendModel(model.toContract());
    const svg = ScientificLegendFormatter.renderSvgColorbar(legendModel, 300, 50);

    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('role="img"'));
    assert.ok(svg.includes('Scientific Scalar Colorbar'));
    assert.ok(svg.includes('linearGradient'));
    assert.ok(svg.includes('°C'));
  });
});

describe('TASK-10C: Physical Clipping Panel & Integration', () => {
  const depthEntries = [0.494, 1.541, 10.0, 50.0, 100.0, 200.0, 453.938];
  const lut = new DepthLookupTable(depthEntries);
  const transformer = new CoordinateTransformer(
    {
      minLongitudeDeg: 80.0,
      maxLongitudeDeg: 88.0,
      minLatitudeDeg: -3.0,
      maxLatitudeDeg: 12.0,
      minDepthM: depthEntries[0],
      maxDepthM: depthEntries[depthEntries.length - 1],
    },
    lut
  );

  it('should integrate 6-plane depth, longitude, and latitude sliders with ClippingController', () => {
    const clippingCtrl = new ClippingController(transformer);
    const clippingModel = new PhysicalClippingModel(clippingCtrl);

    assert.equal(clippingModel.state.domain.minDepthM, 0.494);
    assert.equal(clippingModel.state.domain.maxDepthM, 453.938);

    // Adjust longitude
    clippingModel.setLongitudeRange(81.0, 87.0);
    assert.equal(clippingModel.state.limits.minLonDeg, 81.0);
    assert.equal(clippingModel.state.limits.maxLonDeg, 87.0);

    // Adjust latitude
    clippingModel.setLatitudeRange(0.0, 10.0);
    assert.equal(clippingModel.state.limits.minLatDeg, 0.0);
    assert.equal(clippingModel.state.limits.maxLatDeg, 10.0);

    // Adjust depth
    clippingModel.setDepthRange(10.0, 200.0);
    assert.equal(clippingModel.state.limits.minDepthM, 10.0);
    assert.equal(clippingModel.state.limits.maxDepthM, 200.0);

    // Verify normalized box update
    const nBox = clippingModel.state.normalizedBox;
    assert.ok(nBox.minU > 0.0);
    assert.ok(nBox.maxU < 1.0);
    assert.ok(nBox.minV > 0.0);
    assert.ok(nBox.maxV < 1.0);
    assert.ok(nBox.minW > 0.0);
    assert.ok(nBox.maxW < 1.0);

    // Toggle inversion
    assert.equal(clippingModel.state.isInverted, false);
    clippingModel.toggleInversion();
    assert.equal(clippingModel.state.isInverted, true);

    // Reset to full domain
    clippingModel.resetToFullDomain();
    assert.equal(clippingModel.state.limits.minLonDeg, 80.0);
    assert.equal(clippingModel.state.limits.maxLonDeg, 88.0);
    assert.equal(clippingModel.state.limits.minDepthM, 0.494);
    assert.equal(clippingModel.state.limits.maxDepthM, 453.938);
    assert.equal(clippingModel.state.isInverted, false);
  });

  it('should reject invalid or inverted physical clipping plane bounds', () => {
    const clippingCtrl = new ClippingController(transformer);
    const clippingModel = new PhysicalClippingModel(clippingCtrl);

    assert.throws(() => {
      clippingModel.setLongitudeRange(87.0, 81.0);
    }, ClippingRangeError);

    assert.throws(() => {
      clippingModel.setDepthRange(-5.0, 200.0);
    }, ClippingRangeError);
  });
});

describe('TASK-10C: Volume Quality & Sampling Controls', () => {
  it('should control sampling density multiplier and compute effective raymarch step sizes', () => {
    const quality = new VolumeQualityModel();
    assert.equal(quality.settings.stepSizeMultiplier, 1.0);
    assert.equal(quality.settings.baseStepSize, 0.005);
    assert.equal(quality.effectiveStepSize, 0.005);

    // Double sampling density (2.0x -> half step size)
    quality.setStepSizeMultiplier(2.0);
    assert.equal(quality.settings.stepSizeMultiplier, 2.0);
    assert.equal(quality.effectiveStepSize, 0.0025);

    // Half sampling density (0.5x -> double step size)
    quality.setStepSizeMultiplier(0.5);
    assert.equal(quality.effectiveStepSize, 0.01);
  });

  it('should adjust opacity multiplier, early termination alpha, and bounding box visibility', () => {
    const quality = new VolumeQualityModel();

    quality.setOpacityMultiplier(2.5);
    assert.equal(quality.settings.opacityMultiplier, 2.5);

    quality.setBoundingBoxVisible(false);
    assert.equal(quality.settings.showBoundingBox, false);

    quality.setEarlyTerminationAlpha(0.95);
    assert.equal(quality.settings.earlyTerminationAlpha, 0.95);

    quality.setMaxSteps(1024);
    assert.equal(quality.settings.maxSteps, 1024);

    // Invalid parameters throw
    assert.throws(() => {
      quality.setStepSizeMultiplier(-1);
    });
    assert.throws(() => {
      quality.setOpacityMultiplier(0);
    });
    assert.throws(() => {
      quality.setEarlyTerminationAlpha(1.5);
    });

    quality.resetDefaults();
    assert.equal(quality.settings.stepSizeMultiplier, 1.0);
    assert.equal(quality.settings.showBoundingBox, true);
    assert.equal(quality.settings.maxSteps, 512);
  });
});
