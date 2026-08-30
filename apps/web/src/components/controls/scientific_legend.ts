/**
 * Scientific Legend Formatter & Component Generator
 *
 * Implements:
 * - Discrete scientific colorbar tick mark generator
 * - Explicit unit labels ('°C')
 * - Physical 0.0°C marker identification when within range
 * - Land mask swatch (#222222, skipped) and missing data swatch (#888888, transparent)
 * - Accessible SVG/HTML markup builder
 */

import { sampleColormap, colorToHex, colorToRgbString, type ColorRGB } from './colormaps.ts';
import type { TransferFunctionContract } from '../../../../../packages/contracts/types/quasar_contracts.d.ts';

export interface LegendTick {
  index: number;
  normalizedPosition: number; // [0.0, 1.0]
  physicalValue: number;
  formattedLabel: string;
  isZeroMarker: boolean;
  colorHex: string;
}

export interface ScientificLegendConfig {
  tickCount?: number;         // default 5
  decimalPrecision?: number;  // default 1
  unit?: string;              // default '°C'
  showZeroMarker?: boolean;   // default true
  landMaskColorHex?: string;  // default '#222222'
  missingDataColorHex?: string; // default '#888888'
}

export interface LegendRenderModel {
  colormapName: string;
  unit: string;
  domainMin: number;
  domainMax: number;
  ticks: LegendTick[];
  hasZeroMarker: boolean;
  zeroMarkerNormalizedPosition?: number;
  landSwatch: {
    label: string;
    description: string;
    colorHex: string;
  };
  missingSwatch: {
    label: string;
    description: string;
    colorHex: string;
  };
  gradientCss: string;
}

export class ScientificLegendFormatter {
  static formatValue(val: number, precision: number = 1, unit: string = '°C'): string {
    const fixed = val.toFixed(precision);
    return `${fixed} ${unit}`;
  }

  static generateLegendModel(
    tf: TransferFunctionContract,
    config: ScientificLegendConfig = {}
  ): LegendRenderModel {
    const tickCount = Math.max(2, config.tickCount ?? 5);
    const precision = config.decimalPrecision ?? 1;
    const unit = config.unit ?? tf.physical_units ?? '°C';
    const min = tf.physical_domain_min;
    const max = tf.physical_domain_max;
    const span = max - min;
    const cmapName = tf.colormap_preset_name;

    const ticks: LegendTick[] = [];
    for (let i = 0; i < tickCount; i++) {
      const normPos = i / (tickCount - 1);
      const val = min + normPos * span;
      const rgb = sampleColormap(cmapName, normPos);
      const hex = colorToHex(rgb);
      const isZero = Math.abs(val) < 1e-4;

      ticks.push({
        index: i,
        normalizedPosition: normPos,
        physicalValue: val,
        formattedLabel: this.formatValue(val, precision, unit),
        isZeroMarker: isZero,
        colorHex: hex,
      });
    }

    // Check if 0.0 is strictly inside (min, max) and not already a tick
    let hasZeroMarker = false;
    let zeroMarkerNormalizedPosition: number | undefined = undefined;

    if (min < 0.0 && max > 0.0) {
      hasZeroMarker = true;
      zeroMarkerNormalizedPosition = span > 1e-6 ? (0.0 - min) / span : 0.0;
    }

    // Construct CSS gradient stops
    const stops: string[] = [];
    const stopCount = 10;
    for (let i = 0; i <= stopCount; i++) {
      const t = i / stopCount;
      const rgb = sampleColormap(cmapName, t);
      stops.push(`${colorToHex(rgb)} ${(t * 100).toFixed(1)}%`);
    }
    const gradientCss = `linear-gradient(to right, ${stops.join(', ')})`;

    return {
      colormapName: cmapName,
      unit,
      domainMin: min,
      domainMax: max,
      ticks,
      hasZeroMarker,
      zeroMarkerNormalizedPosition,
      landSwatch: {
        label: 'Land Mask',
        description: 'Occluded / Skipped (0.0 Opacity)',
        colorHex: config.landMaskColorHex ?? '#222222',
      },
      missingSwatch: {
        label: 'Missing / NaN',
        description: 'Missing Data / Transparent',
        colorHex: config.missingDataColorHex ?? '#888888',
      },
      gradientCss,
    };
  }

  /**
   * Generates accessible SVG markup for the discrete colorbar and legend.
   */
  static renderSvgColorbar(
    model: LegendRenderModel,
    width: number = 320,
    height: number = 60
  ): string {
    const barHeight = 16;
    const barY = 10;
    const paddingX = 10;
    const barWidth = width - 2 * paddingX;

    const tickElements = model.ticks.map((t) => {
      const x = paddingX + t.normalizedPosition * barWidth;
      return `
        <line x1="${x.toFixed(1)}" y1="${barY + barHeight}" x2="${x.toFixed(1)}" y2="${barY + barHeight + 5}" stroke="#94a3b8" stroke-width="1.5" />
        <text x="${x.toFixed(1)}" y="${barY + barHeight + 16}" text-anchor="middle" font-size="10" fill="#cbd5e1" font-family="monospace">${t.formattedLabel}</text>
      `;
    }).join('');

    let zeroMarkerElement = '';
    if (model.hasZeroMarker && model.zeroMarkerNormalizedPosition !== undefined) {
      const x0 = paddingX + model.zeroMarkerNormalizedPosition * barWidth;
      zeroMarkerElement = `
        <line x1="${x0.toFixed(1)}" y1="${barY - 3}" x2="${x0.toFixed(1)}" y2="${barY + barHeight + 3}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="2,2" />
        <text x="${x0.toFixed(1)}" y="${barY - 5}" text-anchor="middle" font-size="9" font-weight="bold" fill="#38bdf8" font-family="monospace">0.0 °C</text>
      `;
    }

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scientific Scalar Colorbar: ${model.colormapName} from ${model.domainMin.toFixed(1)} to ${model.domainMax.toFixed(1)} ${model.unit}">
        <defs>
          <linearGradient id="colorbarGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            ${model.ticks.map((t) => `<stop offset="${(t.normalizedPosition * 100).toFixed(1)}%" stop-color="${t.colorHex}" />`).join('')}
          </linearGradient>
        </defs>
        <rect x="${paddingX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="url(#colorbarGradient)" stroke="#475569" stroke-width="1" />
        ${zeroMarkerElement}
        ${tickElements}
      </svg>
    `.trim();
  }
}
