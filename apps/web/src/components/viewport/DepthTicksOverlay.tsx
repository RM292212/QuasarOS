/**
 * QuasarOS Depth Ticks & Vertical Exaggeration Overlay Component
 *
 * Implements:
 * 1. Physical metric depth markers (0m to 5,728m).
 * 2. Vertical exaggeration badge with exact geographic aspect ratio scaling.
 * 3. 3D-to-2D projected corner depth scales.
 */

import React from 'react';
import { DepthTicksModel } from '@quasar/runtime';

export interface DepthTicksOverlayProps {
  verticalExaggeration: number;
  minDepthM?: number;
  maxDepthM?: number;
  aspectRatio?: [number, number, number];
  className?: string;
}

export const DepthTicksOverlay: React.FC<DepthTicksOverlayProps> = ({
  verticalExaggeration,
  minDepthM = 0.494,
  maxDepthM = 5727.917,
  aspectRatio = [0.534, 0.172, 1.000],
  className = '',
}) => {
  const depthModel = React.useMemo(
    () => new DepthTicksModel(minDepthM, maxDepthM, verticalExaggeration, 1000.0),
    [minDepthM, maxDepthM, verticalExaggeration]
  );

  const ticks = React.useMemo(() => depthModel.generateDepthTicks(1000.0), [depthModel]);

  const [sx, sy, sz] = aspectRatio;
  const scaledSy = (sy * (verticalExaggeration / 50.0)).toFixed(3);

  return (
    <div
      data-testid="depth-ticks-overlay"
      className={`pointer-events-none flex flex-col gap-2 font-mono ${className}`}
    >
      {/* Vertical Exaggeration Indicator Badge */}
      <div
        data-testid="ve-indicator-badge"
        className="bg-slate-950/85 backdrop-blur border border-slate-800 px-2.5 py-1 rounded-md text-[10px] text-slate-300 shadow-xl flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400" />
        <span className="font-semibold text-cyan-300">VE: {verticalExaggeration}x</span>
        <span className="text-slate-500">|</span>
        <span className="text-slate-400">Ratio: ({sx.toFixed(3)} : {scaledSy} : {sz.toFixed(3)})</span>
      </div>

      {/* Discrete Metric Depth Column Key */}
      <div
        data-testid="depth-ticks-column"
        className="bg-slate-950/80 backdrop-blur border border-slate-800/80 p-2 rounded-md text-[9px] text-slate-300 flex flex-col gap-1 w-fit shadow-xl"
      >
        <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider border-b border-slate-800 pb-0.5">
          Bathymetric Depth Column
        </div>
        <div className="flex flex-col gap-0.5">
          {ticks.map((tick, idx: number) => (
            <div
              key={idx}
              data-testid={`depth-tick-marker-${idx}`}
              className="flex items-center justify-between gap-3 text-slate-300"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      idx === 0
                        ? '#38bdf8'
                        : idx === ticks.length - 1
                        ? '#f59e0b'
                        : '#94a3b8',
                  }}
                />
                <span className={idx === 0 ? 'text-sky-300 font-semibold' : idx === ticks.length - 1 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                  {tick.formattedLabel}
                </span>
              </div>
              <span className="text-slate-500 text-[8px]">
                {((1.0 - tick.normalizedW) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
