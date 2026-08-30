/**
 * Scientific Colormap Presets and Interpolation Utilities
 *
 * Implements standard perceptually uniform colormaps:
 * - Viridis (Sequential, perceptual uniform)
 * - Plasma (Sequential, high luminance contrast)
 * - Turbo (Rainbow alternative, perceptual smoothness)
 * - Thermal (cmocean thermal, sea surface temperature)
 * - Coolwarm (Diverging, blue to red)
 *
 * All RGB components are in normalized [0.0, 1.0].
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ColormapDefinition {
  name: string;
  presetKey: 'viridis' | 'plasma' | 'turbo' | 'thermal' | 'coolwarm';
  description: string;
  isPerceptuallyUniform: boolean;
  samples: Array<[number, number, number]>; // normalized RGB tuples [0.0, 1.0]
}

export const VIRIDIS_SAMPLES: Array<[number, number, number]> = [
  [0.267004, 0.004874, 0.329415],
  [0.282623, 0.140926, 0.457517],
  [0.253935, 0.265254, 0.529983],
  [0.206756, 0.371758, 0.553117],
  [0.163625, 0.471133, 0.558114],
  [0.127568, 0.566949, 0.550556],
  [0.134692, 0.658636, 0.517649],
  [0.266941, 0.748751, 0.440573],
  [0.477504, 0.821444, 0.318195],
  [0.741388, 0.873449, 0.149561],
  [0.993248, 0.906157, 0.143936],
];

export const PLASMA_SAMPLES: Array<[number, number, number]> = [
  [0.050383, 0.029803, 0.527975],
  [0.254627, 0.013882, 0.615419],
  [0.417642, 0.000564, 0.658390],
  [0.562738, 0.051545, 0.641509],
  [0.692840, 0.165141, 0.564528],
  [0.798216, 0.280197, 0.469538],
  [0.881443, 0.392529, 0.383114],
  [0.944876, 0.526118, 0.298647],
  [0.983868, 0.676667, 0.203237],
  [0.989258, 0.835840, 0.178652],
  [0.940015, 0.975158, 0.131326],
];

export const TURBO_SAMPLES: Array<[number, number, number]> = [
  [0.18995, 0.07176, 0.23217],
  [0.15583, 0.23493, 0.58784],
  [0.10929, 0.41872, 0.84074],
  [0.10091, 0.59858, 0.94318],
  [0.19830, 0.74833, 0.85241],
  [0.41168, 0.87063, 0.58344],
  [0.66226, 0.93855, 0.27645],
  [0.87103, 0.89975, 0.14556],
  [0.98595, 0.73713, 0.13886],
  [0.96349, 0.49079, 0.15248],
  [0.74567, 0.17700, 0.08830],
];

export const THERMAL_SAMPLES: Array<[number, number, number]> = [
  [0.015693, 0.091380, 0.339243],
  [0.149187, 0.164805, 0.540118],
  [0.370335, 0.183424, 0.627254],
  [0.584166, 0.174092, 0.575647],
  [0.767852, 0.213271, 0.443907],
  [0.892429, 0.337775, 0.323533],
  [0.960241, 0.510340, 0.244302],
  [0.977464, 0.697410, 0.231264],
  [0.960417, 0.854298, 0.333290],
  [0.977598, 0.957589, 0.593740],
  [0.999984, 0.999978, 0.900012],
];

export const COOLWARM_SAMPLES: Array<[number, number, number]> = [
  [0.2298057, 0.29871797, 0.75368315],
  [0.38383454, 0.5094141, 0.89873796],
  [0.56926017, 0.69262888, 0.96688946],
  [0.75337799, 0.83515024, 0.95929298],
  [0.8654438, 0.8654438, 0.8654438],
  [0.95929298, 0.75337799, 0.65824987],
  [0.96688946, 0.56926017, 0.44520779],
  [0.89873796, 0.38383454, 0.26620023],
  [0.70567316, 0.01555616, 0.15023281],
];

export const COLORMAP_REGISTRY: Record<string, ColormapDefinition> = {
  viridis: {
    name: 'Viridis',
    presetKey: 'viridis',
    description: 'Perceptually uniform sequential colormap (default oceanographic standard)',
    isPerceptuallyUniform: true,
    samples: VIRIDIS_SAMPLES,
  },
  plasma: {
    name: 'Plasma',
    presetKey: 'plasma',
    description: 'Perceptually uniform sequential colormap with vivid violet-orange gradient',
    isPerceptuallyUniform: true,
    samples: PLASMA_SAMPLES,
  },
  turbo: {
    name: 'Turbo',
    presetKey: 'turbo',
    description: 'High-contrast smoothed rainbow alternative for fine thermal structures',
    isPerceptuallyUniform: false,
    samples: TURBO_SAMPLES,
  },
  thermal: {
    name: 'Thermal',
    presetKey: 'thermal',
    description: 'cmocean thermal colormap optimized for sea water potential temperature',
    isPerceptuallyUniform: true,
    samples: THERMAL_SAMPLES,
  },
  coolwarm: {
    name: 'Coolwarm',
    presetKey: 'coolwarm',
    description: 'Diverging colormap centered around physical anomalies',
    isPerceptuallyUniform: false,
    samples: COOLWARM_SAMPLES,
  },
};

/**
 * Sample a colormap at a normalized position t in [0.0, 1.0].
 */
export function sampleColormap(presetKey: string, t: number): ColorRGB {
  const normT = Math.max(0.0, Math.min(1.0, Number.isNaN(t) ? 0.0 : t));
  const cmap = COLORMAP_REGISTRY[presetKey.toLowerCase()] ?? COLORMAP_REGISTRY.viridis;
  const samples = cmap.samples;
  const count = samples.length;

  if (count === 0) {
    return { r: normT, g: normT, b: normT };
  }
  if (count === 1 || normT <= 0.0) {
    return { r: samples[0][0], g: samples[0][1], b: samples[0][2] };
  }
  if (normT >= 1.0) {
    const last = samples[count - 1];
    return { r: last[0], g: last[1], b: last[2] };
  }

  const scaled = normT * (count - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;

  const c0 = samples[idx];
  const c1 = samples[Math.min(idx + 1, count - 1)];

  return {
    r: c0[0] + frac * (c1[0] - c0[0]),
    g: c0[1] + frac * (c1[1] - c0[1]),
    b: c0[2] + frac * (c1[2] - c0[2]),
  };
}

/**
 * Format a ColorRGB as a CSS rgb/hex string.
 */
export function colorToRgbString(c: ColorRGB, alpha: number = 1.0): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  if (alpha >= 1.0) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

export function colorToHex(c: ColorRGB): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n * 255))).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}
