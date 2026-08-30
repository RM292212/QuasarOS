import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildObservationComparisonModel } from '../src/components/observations/ObservationComparisonLogic.ts';

describe('TASK-14R: Observation Comparison Panel', () => {
  it('should build observation comparison model correctly calculating RMSE, mean bias and deltas', () => {
    const model = buildObservationComparisonModel(
      'R7900912',
      '2026-08-30T12:00:00Z',
      6.2,
      83.5,
      [
        { depthM: 10, argoTemperature: 28.5, modelTemperature: 28.6 },
        { depthM: 50, argoTemperature: 26.2, modelTemperature: 26.1 },
        { depthM: 100, argoTemperature: 20.1, modelTemperature: 20.3 },
        { depthM: 200, argoTemperature: 14.5, modelTemperature: 14.2 }
      ]
    );

    assert.equal(model.argoProfileId, 'R7900912');
    assert.equal(model.samplesCount, 4);
    
    // Deltas: 0.1, -0.1, 0.2, -0.3
    // biasSum = -0.1, meanBias = -0.025
    assert.ok(Math.abs(model.meanBias - (-0.025)) < 1e-6, 'Mean bias should be -0.025');
    
    // rmseSum = 0.01 + 0.01 + 0.04 + 0.09 = 0.15
    // rmse = sqrt(0.15 / 4) = sqrt(0.0375) ≈ 0.193649...
    assert.ok(Math.abs(model.rmse - Math.sqrt(0.15 / 4)) < 1e-6, 'RMSE should be ~0.1936');

    assert.ok(Math.abs(model.layers[0].delta - 0.1) < 1e-6);
  });
});

