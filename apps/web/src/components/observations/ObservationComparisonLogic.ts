export interface ObservationComparisonModel {
  argoProfileId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  samplesCount: number;
  rmse: number;
  meanBias: number;
  layers: Array<{
    depthM: number;
    argoTemperature: number;
    modelTemperature: number;
    delta: number;
  }>;
}

export function buildObservationComparisonModel(
  argoProfileId: string,
  timestamp: string,
  latitude: number,
  longitude: number,
  layers: Array<{ depthM: number; argoTemperature: number; modelTemperature: number }>
): ObservationComparisonModel {
  let rmseSum = 0;
  let biasSum = 0;
  const processedLayers = layers.map(layer => {
    const delta = layer.modelTemperature - layer.argoTemperature;
    rmseSum += delta * delta;
    biasSum += delta;
    return { ...layer, delta };
  });

  const samplesCount = layers.length;
  const meanBias = samplesCount > 0 ? biasSum / samplesCount : 0;
  const rmse = samplesCount > 0 ? Math.sqrt(rmseSum / samplesCount) : 0;

  return {
    argoProfileId,
    timestamp,
    latitude,
    longitude,
    samplesCount,
    rmse,
    meanBias,
    layers: processedLayers
  };
}
