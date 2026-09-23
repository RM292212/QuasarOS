/**
 * VerticalProfileChart Component
 *
 * Visualizes non-uniform Copernicus depth levels (31 or 50 levels, 0.494m to 5,727.917m)
 * with continuous thermocline profiles, linear/log-depth scaling, and model vs in-situ observation overlays.
 */

import React, { useMemo, useState } from 'react';
import type { VerticalProfileChartModel, VerticalProfileDataPoint } from './types.ts';
import {
  mapDepthToY,
  mapValueToX,
  DEFAULT_CHART_DIMENSIONS,
  DepthScaleMode,
} from './VerticalProfileLogic.ts';

export interface VerticalProfileChartProps {
  model: VerticalProfileChartModel;
  width?: number;
  height?: number;
  className?: string;
  onHoverPoint?: (dp: VerticalProfileDataPoint | null) => void;
}

export const VerticalProfileChart: React.FC<VerticalProfileChartProps> = ({
  model,
  width = 320,
  height = 440,
  className = '',
  onHoverPoint,
}) => {
  const [scaleMode, setScaleMode] = useState<DepthScaleMode>('linear');
  const [hoveredPoint, setHoveredPoint] = useState<VerticalProfileDataPoint | null>(null);

  const dims = useMemo(
    () => ({
      ...DEFAULT_CHART_DIMENSIONS,
      width,
      height,
    }),
    [width, height]
  );

  const plotWidth = dims.width - dims.marginLeft - dims.marginRight;
  const plotHeight = dims.height - dims.marginTop - dims.marginBottom;
  const xMin = dims.marginLeft;
  const xMax = dims.marginLeft + plotWidth;
  const yMin = dims.marginTop;
  const yMax = dims.marginTop + plotHeight;

  // Segment lines across gaps for model data
  const segments = useMemo(() => {
    const res: Array<Array<{ x: number; y: number; dp: VerticalProfileDataPoint }>> = [];
    let current: Array<{ x: number; y: number; dp: VerticalProfileDataPoint }> = [];

    for (const dp of model.dataPoints) {
      if (dp.scientificValue !== null && !dp.isGap) {
        const x = mapValueToX(dp.scientificValue, model.minValue, model.maxValue, xMin, xMax);
        const y = mapDepthToY(dp.depthM, model.minDepthM, model.maxDepthM, yMin, yMax, scaleMode);
        current.push({ x, y, dp });
      } else {
        if (current.length > 0) {
          res.push(current);
          current = [];
        }
      }
    }
    if (current.length > 0) res.push(current);
    return res;
  }, [model.dataPoints, model.minValue, model.maxValue, model.minDepthM, model.maxDepthM, xMin, xMax, yMin, yMax, scaleMode]);

  // Segment lines across gaps for observation data
  const obsSegments = useMemo(() => {
    if (!model.observedPoints) return [];
    const res: Array<Array<{ x: number; y: number; dp: VerticalProfileDataPoint }>> = [];
    let current: Array<{ x: number; y: number; dp: VerticalProfileDataPoint }> = [];

    for (const dp of model.observedPoints) {
      if (dp.scientificValue !== null && !dp.isGap) {
        const x = mapValueToX(dp.scientificValue, model.minValue, model.maxValue, xMin, xMax);
        const y = mapDepthToY(dp.depthM, model.minDepthM, model.maxDepthM, yMin, yMax, scaleMode);
        current.push({ x, y, dp });
      } else {
        if (current.length > 0) {
          res.push(current);
          current = [];
        }
      }
    }
    if (current.length > 0) res.push(current);
    return res;
  }, [model.observedPoints, model.minValue, model.maxValue, model.minDepthM, model.maxDepthM, xMin, xMax, yMin, yMax, scaleMode]);

  // X Ticks (Scalar Value)
  const xTicks = useMemo(() => {
    const ticks: Array<{ val: number; x: number }> = [];
    const count = 4;
    for (let i = 0; i <= count; i++) {
      const val = model.minValue + (i / count) * (model.maxValue - model.minValue);
      const x = xMin + (i / count) * plotWidth;
      ticks.push({ val, x });
    }
    return ticks;
  }, [model.minValue, model.maxValue, xMin, plotWidth]);

  // Y Ticks (Depth) — Adapts to 31-level (454m) or 50-level (5728m) vertical spans
  const depthTicks = useMemo(() => {
    const candidateDepths =
      model.maxDepthM > 1000
        ? [0.5, 50, 100, 250, 500, 1000, 2000, 4000, 5728]
        : [0.5, 50, 100, 200, 300, 450];

    return candidateDepths
      .filter((d) => d >= model.minDepthM && d <= model.maxDepthM + 5)
      .map((d) => ({
        depth: d,
        y: mapDepthToY(d, model.minDepthM, model.maxDepthM, yMin, yMax, scaleMode),
      }));
  }, [model.minDepthM, model.maxDepthM, yMin, yMax, scaleMode]);

  const handlePointHover = (dp: VerticalProfileDataPoint | null) => {
    setHoveredPoint(dp);
    if (onHoverPoint) onHoverPoint(dp);
  };

  return (
    <div
      className={`bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 text-slate-200 shadow-xl font-sans text-xs flex flex-col ${className}`}
      role="region"
      aria-label={`${model.totalLevels}-Level Vertical Ocean Profile Chart`}
      data-testid="vertical-profile-chart-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div>
          <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider">
            Vertical Sounding Profile
          </h3>
          <p className="text-[10px] text-slate-400 font-mono">
            {model.totalLevels} Non-Uniform Levels ({model.minDepthM.toFixed(1)}m – {model.maxDepthM.toFixed(1)}m)
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded border border-slate-800 text-[10px]">
          <button
            onClick={() => setScaleMode('linear')}
            className={`px-2 py-0.5 rounded transition ${
              scaleMode === 'linear'
                ? 'bg-cyan-600 text-white font-medium shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="scale-mode-linear"
          >
            Linear
          </button>
          <button
            onClick={() => setScaleMode('log')}
            className={`px-2 py-0.5 rounded transition ${
              scaleMode === 'log'
                ? 'bg-cyan-600 text-white font-medium shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            data-testid="scale-mode-log"
          >
            Log-Depth
          </button>
        </div>
      </div>

      {/* Observation Overlay Legend if Available */}
      {model.observedPoints && (
        <div className="flex items-center justify-between bg-slate-950/80 px-2 py-1 rounded border border-slate-800 text-[10px] font-mono mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-sky-400 inline-block rounded-sm" />
            <span className="text-sky-300">Model Profile</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-emerald-400 inline-block border-dashed border-t border-emerald-400" />
            <span className="text-emerald-300">
              {model.observationLabel || 'Argo In-Situ'}
            </span>
          </div>
        </div>
      )}

      {/* SVG Chart Viewport */}
      <div className="relative flex justify-center items-center overflow-hidden bg-slate-950/50 rounded border border-slate-800/80 my-1">
        <svg
          viewBox={`0 0 ${dims.width} ${dims.height}`}
          width="100%"
          height={height}
          className="select-none"
          role="img"
          aria-label={`Sounding profile at ${model.resolvedLongitudeDeg.toFixed(2)}E, ${model.resolvedLatitudeDeg.toFixed(2)}N`}
          data-testid="vertical-profile-svg"
        >
          {/* Grid lines */}
          {xTicks.map((tick, idx) => (
            <line
              key={`x-grid-${idx}`}
              x1={tick.x}
              y1={yMin}
              x2={tick.x}
              y2={yMax}
              stroke="#1e293b"
              strokeDasharray="2,2"
            />
          ))}
          {depthTicks.map((tick, idx) => (
            <line
              key={`y-grid-${idx}`}
              x1={xMin}
              y1={tick.y}
              x2={xMax}
              y2={tick.y}
              stroke="#1e293b"
              strokeDasharray="2,2"
            />
          ))}

          {/* Axes */}
          <line x1={xMin} y1={yMin} x2={xMin} y2={yMax} stroke="#475569" strokeWidth="1.5" />
          <line x1={xMin} y1={yMax} x2={xMax} y2={yMax} stroke="#475569" strokeWidth="1.5" />

          {/* Tick Labels */}
          {xTicks.map((tick, idx) => (
            <text
              key={`x-tick-${idx}`}
              x={tick.x}
              y={yMax + 14}
              fill="#94a3b8"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {tick.val.toFixed(1)}
            </text>
          ))}
          {depthTicks.map((tick, idx) => (
            <text
              key={`y-tick-${idx}`}
              x={xMin - 6}
              y={tick.y + 3}
              fill="#94a3b8"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="end"
            >
              {tick.depth >= 1000 ? `${(tick.depth / 1000).toFixed(0)}k` : tick.depth.toFixed(0)}m
            </text>
          ))}

          {/* Axis Labels */}
          <text
            x={xMin + plotWidth / 2}
            y={dims.height - 10}
            fill="#cbd5e1"
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
          >
            {model.variableId.includes('(') ? model.variableId : `${model.variableId} (${model.canonicalUnits})`}
          </text>
          <text
            x="14"
            y={yMin + plotHeight / 2}
            fill="#cbd5e1"
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
            transform={`rotate(-90 14 ${yMin + plotHeight / 2})`}
          >
            Depth (m)
          </text>

          {/* Model Profile Curves */}
          {segments.map((seg, sIdx) => {
            if (seg.length <= 1) return null;
            const pathData = seg
              .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
              .join(' ');
            return (
              <path
                key={`seg-${sIdx}`}
                d={pathData}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Observation Curves if Available */}
          {obsSegments.map((seg, sIdx) => {
            if (seg.length <= 1) return null;
            const pathData = seg
              .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
              .join(' ');
            return (
              <path
                key={`obs-seg-${sIdx}`}
                d={pathData}
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="4,3"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Model Data Points */}
          {model.dataPoints.map((dp, idx) => {
            const y = mapDepthToY(
              dp.depthM,
              model.minDepthM,
              model.maxDepthM,
              yMin,
              yMax,
              scaleMode
            );
            if (dp.scientificValue !== null && !dp.isGap) {
              const x = mapValueToX(
                dp.scientificValue,
                model.minValue,
                model.maxValue,
                xMin,
                xMax
              );
              const isHovered = hoveredPoint?.levelIndex === dp.levelIndex;
              return (
                <circle
                  key={`dp-${idx}`}
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3.5}
                  fill={isHovered ? '#38bdf8' : '#0284c7'}
                  stroke="#bae6fd"
                  strokeWidth="1.5"
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => handlePointHover(dp)}
                  onMouseLeave={() => handlePointHover(null)}
                  data-testid={`profile-point-${dp.levelIndex}`}
                />
              );
            } else {
              return (
                <circle
                  key={`gap-${idx}`}
                  cx={xMin}
                  cy={y}
                  r={3}
                  fill="#475569"
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  className="cursor-help"
                  onMouseEnter={() => handlePointHover(dp)}
                  onMouseLeave={() => handlePointHover(null)}
                  data-testid={`profile-gap-${dp.levelIndex}`}
                />
              );
            }
          })}

          {/* Observation Data Points if Available */}
          {model.observedPoints?.map((op, idx) => {
            const y = mapDepthToY(
              op.depthM,
              model.minDepthM,
              model.maxDepthM,
              yMin,
              yMax,
              scaleMode
            );
            if (op.scientificValue !== null && !op.isGap) {
              const x = mapValueToX(
                op.scientificValue,
                model.minValue,
                model.maxValue,
                xMin,
                xMax
              );
              return (
                <circle
                  key={`op-${idx}`}
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill="#10b981"
                  stroke="#d1fae5"
                  strokeWidth="1.5"
                  className="cursor-pointer"
                  onMouseEnter={() => handlePointHover(op)}
                  onMouseLeave={() => handlePointHover(null)}
                  data-testid={`obs-point-${idx}`}
                />
              );
            }
            return null;
          })}
        </svg>
      </div>

      {/* Hover Readout Tooltip Bar */}
      <div className="mt-2 bg-slate-950/60 rounded p-1.5 border border-slate-800 text-[11px] font-mono flex justify-between items-center min-h-[28px]">
        {hoveredPoint ? (
          <>
            <span className="text-slate-400">
              Lvl <strong className="text-slate-200">{hoveredPoint.levelIndex}</strong> (
              <span className="text-cyan-300">{hoveredPoint.depthM.toFixed(3)}m</span>):
            </span>
            <span
              className={
                hoveredPoint.scientificValue !== null
                  ? 'text-emerald-300 font-semibold'
                  : 'text-amber-400 uppercase'
              }
              data-testid="profile-hover-value"
            >
              {hoveredPoint.scientificValue !== null
                ? `${hoveredPoint.scientificValue.toFixed(4)} ${model.canonicalUnits}`
                : `[${hoveredPoint.valueState}]`}
            </span>
          </>
        ) : (
          <span className="text-slate-500 text-[10px]">
            Hover over profile levels to inspect exact layer sounding
          </span>
        )}
      </div>
    </div>
  );
};
