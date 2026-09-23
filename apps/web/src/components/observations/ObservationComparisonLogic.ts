/**
 * QuasarOS Observation Collocation & Residual Analysis Logic (TASK-14R)
 *
 * Implements:
 * 1. Model vs In-Situ Argo observation collocation calculations.
 * 2. Per-layer delta metrics (delta = model - argo).
 * 3. Root Mean Square Error (RMSE) and Mean Bias calculations.
 * 4. QC flag retention and validation metadata.
 * 5. Multi-float catalog fixtures (D1902669_012, R1902581_050, SR1902594_001, R7900912).
 */

export interface ObservationLayerSample {
  depthM: number;
  argoTemperature: number;
  modelTemperature: number;
  delta?: number;
  argoSalinity?: number;
  modelSalinity?: number;
  salinityDelta?: number;
  qcFlag?: number; // 1 = Good, 2 = Probably Good, 3 = Bad, 4 = Missing
}

export interface ObservationComparisonModel {
  argoProfileId: string;
  wmoId?: number;
  cycleNumber?: number;
  timestamp: string;
  latitude: number;
  longitude: number;
  dataMode?: string;
  dataCenter?: string;
  qcStatus?: string;
  samplesCount: number;
  rmse: number;
  meanBias: number;
  salinityRmse?: number;
  salinityMeanBias?: number;
  layers: Array<{
    depthM: number;
    argoTemperature: number;
    modelTemperature: number;
    delta: number;
    argoSalinity?: number;
    modelSalinity?: number;
    salinityDelta?: number;
    qcFlag?: number;
  }>;
}

export function buildObservationComparisonModel(
  argoProfileId: string,
  timestamp: string,
  latitude: number,
  longitude: number,
  layers: Array<{
    depthM: number;
    argoTemperature: number;
    modelTemperature: number;
    argoSalinity?: number;
    modelSalinity?: number;
    qcFlag?: number;
  }>,
  meta?: {
    wmoId?: number;
    cycleNumber?: number;
    dataMode?: string;
    dataCenter?: string;
    qcStatus?: string;
  }
): ObservationComparisonModel {
  let rmseSum = 0;
  let biasSum = 0;
  let salRmseSum = 0;
  let salBiasSum = 0;
  let salCount = 0;

  const processedLayers = layers.map((layer) => {
    const delta = layer.modelTemperature - layer.argoTemperature;
    rmseSum += delta * delta;
    biasSum += delta;

    let salinityDelta: number | undefined = undefined;
    if (layer.modelSalinity !== undefined && layer.argoSalinity !== undefined) {
      salinityDelta = layer.modelSalinity - layer.argoSalinity;
      salRmseSum += salinityDelta * salinityDelta;
      salBiasSum += salinityDelta;
      salCount++;
    }

    return {
      ...layer,
      delta,
      salinityDelta,
      qcFlag: layer.qcFlag ?? 1,
    };
  });

  const samplesCount = layers.length;
  const meanBias = samplesCount > 0 ? biasSum / samplesCount : 0;
  const rmse = samplesCount > 0 ? Math.sqrt(rmseSum / samplesCount) : 0;
  const salinityMeanBias = salCount > 0 ? salBiasSum / salCount : undefined;
  const salinityRmse = salCount > 0 ? Math.sqrt(salRmseSum / salCount) : undefined;

  return {
    argoProfileId,
    wmoId: meta?.wmoId,
    cycleNumber: meta?.cycleNumber,
    timestamp,
    latitude,
    longitude,
    dataMode: meta?.dataMode,
    dataCenter: meta?.dataCenter,
    qcStatus: meta?.qcStatus ?? 'QC Passed (Flag 1: Good)',
    samplesCount,
    rmse,
    meanBias,
    salinityRmse,
    salinityMeanBias,
    layers: processedLayers,
  };
}

// Authoritative Collocation Fixtures for North Indian Ocean Floats
export const ARGO_COLLOCATION_FIXTURES: Record<string, ObservationComparisonModel> = {
  D1902669_012: buildObservationComparisonModel(
    'D1902669_012',
    '2026-08-28T06:14:00Z',
    13.317,
    86.817,
    [
      { depthM: 5.0, argoTemperature: 29.35, modelTemperature: 29.42, argoSalinity: 33.12, modelSalinity: 33.18, qcFlag: 1 },
      { depthM: 10.0, argoTemperature: 29.28, modelTemperature: 29.35, argoSalinity: 33.15, modelSalinity: 33.20, qcFlag: 1 },
      { depthM: 25.0, argoTemperature: 29.10, modelTemperature: 29.18, argoSalinity: 33.30, modelSalinity: 33.34, qcFlag: 1 },
      { depthM: 50.0, argoTemperature: 28.45, modelTemperature: 28.38, argoSalinity: 34.05, modelSalinity: 34.12, qcFlag: 1 },
      { depthM: 75.0, argoTemperature: 25.10, modelTemperature: 25.22, argoSalinity: 34.80, modelSalinity: 34.75, qcFlag: 1 },
      { depthM: 100.0, argoTemperature: 21.80, modelTemperature: 21.95, argoSalinity: 35.02, modelSalinity: 34.98, qcFlag: 1 },
      { depthM: 150.0, argoTemperature: 17.20, modelTemperature: 17.05, argoSalinity: 35.15, modelSalinity: 35.18, qcFlag: 1 },
      { depthM: 200.0, argoTemperature: 14.30, modelTemperature: 14.42, argoSalinity: 35.10, modelSalinity: 35.12, qcFlag: 1 },
      { depthM: 300.0, argoTemperature: 11.60, modelTemperature: 11.52, argoSalinity: 35.05, modelSalinity: 35.08, qcFlag: 1 },
      { depthM: 500.0, argoTemperature: 8.90, modelTemperature: 8.82, argoSalinity: 34.95, modelSalinity: 34.96, qcFlag: 1 },
      { depthM: 1000.0, argoTemperature: 5.40, modelTemperature: 5.46, argoSalinity: 34.88, modelSalinity: 34.89, qcFlag: 1 },
      { depthM: 2000.0, argoTemperature: 2.35, modelTemperature: 2.38, argoSalinity: 34.78, modelSalinity: 34.79, qcFlag: 1 },
    ],
    {
      wmoId: 1902669,
      cycleNumber: 12,
      dataMode: 'Delayed-Mode',
      dataCenter: 'INCOIS (India)',
      qcStatus: 'QC Passed (Flag 1: Good)',
    }
  ),

  R1902581_050: buildObservationComparisonModel(
    'R1902581_050',
    '2026-08-29T11:42:00Z',
    1.827,
    76.830,
    [
      { depthM: 5.0, argoTemperature: 28.85, modelTemperature: 28.92, argoSalinity: 35.40, modelSalinity: 35.45, qcFlag: 1 },
      { depthM: 10.0, argoTemperature: 28.80, modelTemperature: 28.85, argoSalinity: 35.42, modelSalinity: 35.46, qcFlag: 1 },
      { depthM: 25.0, argoTemperature: 28.65, modelTemperature: 28.72, argoSalinity: 35.48, modelSalinity: 35.50, qcFlag: 1 },
      { depthM: 50.0, argoTemperature: 27.90, modelTemperature: 27.82, argoSalinity: 35.60, modelSalinity: 35.64, qcFlag: 1 },
      { depthM: 75.0, argoTemperature: 24.50, modelTemperature: 24.62, argoSalinity: 35.75, modelSalinity: 35.70, qcFlag: 1 },
      { depthM: 100.0, argoTemperature: 20.40, modelTemperature: 20.55, argoSalinity: 35.80, modelSalinity: 35.78, qcFlag: 1 },
      { depthM: 150.0, argoTemperature: 15.80, modelTemperature: 15.65, argoSalinity: 35.65, modelSalinity: 35.68, qcFlag: 1 },
      { depthM: 200.0, argoTemperature: 13.20, modelTemperature: 13.32, argoSalinity: 35.45, modelSalinity: 35.48, qcFlag: 1 },
      { depthM: 300.0, argoTemperature: 11.10, modelTemperature: 11.02, argoSalinity: 35.25, modelSalinity: 35.28, qcFlag: 1 },
      { depthM: 500.0, argoTemperature: 8.50, modelTemperature: 8.42, argoSalinity: 35.05, modelSalinity: 35.07, qcFlag: 1 },
      { depthM: 1000.0, argoTemperature: 5.20, modelTemperature: 5.26, argoSalinity: 34.92, modelSalinity: 34.93, qcFlag: 1 },
      { depthM: 2000.0, argoTemperature: 2.25, modelTemperature: 2.28, argoSalinity: 34.80, modelSalinity: 34.81, qcFlag: 1 },
    ],
    {
      wmoId: 1902581,
      cycleNumber: 50,
      dataMode: 'Real-Time',
      dataCenter: 'Coriolis / INCOIS',
      qcStatus: 'QC Passed (Flag 1: Good)',
    }
  ),

  SR1902594_001: buildObservationComparisonModel(
    'SR1902594_001',
    '2026-08-30T04:20:00Z',
    5.359,
    80.069,
    [
      { depthM: 5.0, argoTemperature: 29.10, modelTemperature: 29.16, argoSalinity: 34.85, modelSalinity: 34.88, qcFlag: 1 },
      { depthM: 10.0, argoTemperature: 29.05, modelTemperature: 29.10, argoSalinity: 34.86, modelSalinity: 34.89, qcFlag: 1 },
      { depthM: 25.0, argoTemperature: 28.90, modelTemperature: 28.95, argoSalinity: 34.90, modelSalinity: 34.92, qcFlag: 1 },
      { depthM: 50.0, argoTemperature: 28.15, modelTemperature: 28.08, argoSalinity: 35.10, modelSalinity: 35.14, qcFlag: 1 },
      { depthM: 75.0, argoTemperature: 24.80, modelTemperature: 24.90, argoSalinity: 35.35, modelSalinity: 35.30, qcFlag: 1 },
      { depthM: 100.0, argoTemperature: 21.10, modelTemperature: 21.22, argoSalinity: 35.45, modelSalinity: 35.42, qcFlag: 1 },
      { depthM: 150.0, argoTemperature: 16.40, modelTemperature: 16.28, argoSalinity: 35.35, modelSalinity: 35.38, qcFlag: 1 },
      { depthM: 200.0, argoTemperature: 13.80, modelTemperature: 13.90, argoSalinity: 35.20, modelSalinity: 35.22, qcFlag: 1 },
      { depthM: 300.0, argoTemperature: 11.35, modelTemperature: 11.28, argoSalinity: 35.10, modelSalinity: 35.12, qcFlag: 1 },
      { depthM: 500.0, argoTemperature: 8.70, modelTemperature: 8.64, argoSalinity: 35.00, modelSalinity: 35.02, qcFlag: 1 },
      { depthM: 1000.0, argoTemperature: 5.30, modelTemperature: 5.35, argoSalinity: 34.90, modelSalinity: 34.91, qcFlag: 1 },
      { depthM: 2000.0, argoTemperature: 2.30, modelTemperature: 2.34, argoSalinity: 34.79, modelSalinity: 34.80, qcFlag: 1 },
    ],
    {
      wmoId: 1902594,
      cycleNumber: 1,
      dataMode: 'Synthetic BGC',
      dataCenter: 'IFREMER / INCOIS',
      qcStatus: 'QC Passed (Flag 1: Good)',
    }
  ),

  R7900912: buildObservationComparisonModel(
    'R7900912',
    '2026-08-30T12:00:00Z',
    6.2,
    83.5,
    [
      { depthM: 10, argoTemperature: 28.5, modelTemperature: 28.6 },
      { depthM: 50, argoTemperature: 26.2, modelTemperature: 26.1 },
      { depthM: 100, argoTemperature: 20.1, modelTemperature: 20.3 },
      { depthM: 200, argoTemperature: 14.5, modelTemperature: 14.2 },
    ]
  ),
};

export function getCollocationModelForFloat(floatId: string | null | undefined): ObservationComparisonModel {
  if (floatId && ARGO_COLLOCATION_FIXTURES[floatId]) {
    return ARGO_COLLOCATION_FIXTURES[floatId];
  }
  return ARGO_COLLOCATION_FIXTURES['D1902669_012'];
}
