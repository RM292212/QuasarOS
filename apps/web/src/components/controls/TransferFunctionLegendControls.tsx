import React, { useState, useEffect, useMemo } from 'react';
import {
  TransferFunctionModel,
  ScientificLegendFormatter,
  PhysicalClippingModel,
  VolumeQualityModel,
  COLORMAP_REGISTRY,
} from './index.ts';
import { VolumeQualityControls } from './VolumeQualityControls.tsx';
import type { TransferFunctionContract } from '../../../../../packages/contracts/types/quasar_contracts.d.ts';

export interface TransferFunctionLegendControlsProps {
  tfModel: TransferFunctionModel;
  qualityModel: VolumeQualityModel;
  clippingModel?: PhysicalClippingModel;
  className?: string;
  onOpenProvenance?: () => void;
}

export const TransferFunctionLegendControls: React.FC<TransferFunctionLegendControlsProps> = ({
  tfModel,
  qualityModel,
  clippingModel,
  className = '',
  onOpenProvenance,
}) => {
  const [tfContract, setTfContract] = useState<TransferFunctionContract>(() => tfModel.toContract());
  const [tfDomain, setTfDomain] = useState<{ min: number; max: number }>(() => ({
    min: tfModel.domainMin,
    max: tfModel.domainMax,
  }));
  const [qualitySettings, setQualitySettings] = useState(() => qualityModel.settings);
  const [clippingState, setClippingState] = useState(() => clippingModel?.state);
  const [activeTab, setActiveTab] = useState<'tf' | 'clip' | 'quality'>('tf');

  useEffect(() => {
    const unsubTf = tfModel.subscribe((contract) => {
      setTfContract(contract);
      setTfDomain({ min: tfModel.domainMin, max: tfModel.domainMax });
    });
    const unsubQ = qualityModel.subscribe((q) => setQualitySettings(q));
    const unsubClip = clippingModel?.subscribe((c) => setClippingState(c));
    return () => {
      unsubTf();
      unsubQ();
      unsubClip?.();
    };
  }, [tfModel, qualityModel, clippingModel]);

  const legendModel = useMemo(
    () => ScientificLegendFormatter.generateLegendModel(tfContract),
    [tfContract]
  );

  return (
    <div
      data-testid="tf-legend-controls-panel"
      role="region"
      aria-label="Transfer Function, Legend and Volume Controls"
      className={`bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 text-slate-200 shadow-xl font-sans text-xs flex flex-col gap-3 ${className}`}
    >
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded border border-slate-800 text-[11px]" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'tf'}
            onClick={() => setActiveTab('tf')}
            data-testid="tab-tf"
            className={`px-2.5 py-1 rounded transition font-medium ${
              activeTab === 'tf'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Transfer Function
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'clip'}
            onClick={() => setActiveTab('clip')}
            data-testid="tab-clip"
            className={`px-2.5 py-1 rounded transition font-medium ${
              activeTab === 'clip'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            6-Plane Clipping
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'quality'}
            onClick={() => setActiveTab('quality')}
            data-testid="tab-quality"
            className={`px-2.5 py-1 rounded transition font-medium ${
              activeTab === 'quality'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Volume Quality
          </button>
        </div>

        {onOpenProvenance && (
          <button
            onClick={onOpenProvenance}
            data-testid="open-provenance-button"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-mono flex items-center gap-1 transition"
            title="Open Lineage & Provenance Drawer"
          >
            <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Provenance</span>
          </button>
        )}
      </div>

      {/* Tab Content: Transfer Function & Legend */}
      {activeTab === 'tf' && (
        <div className="flex flex-col gap-2.5" data-testid="tab-content-tf">
          {/* Colormap Preset Selector */}
          <div className="flex items-center justify-between">
            <label htmlFor="colormap-select" className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">
              Colormap Preset:
            </label>
            <select
              id="colormap-select"
              data-testid="colormap-select"
              value={tfContract.colormap_preset_name}
              onChange={(e) => tfModel.setColormap(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              {Object.keys(COLORMAP_REGISTRY).map((k) => (
                <option key={k} value={k}>
                  {COLORMAP_REGISTRY[k].name} ({COLORMAP_REGISTRY[k].isPerceptuallyUniform ? 'Uniform' : 'Diverging/Feature'})
                </option>
              ))}
            </select>
          </div>

          {/* Colorbar Visual Ramp */}
          <div className="flex flex-col gap-1">
            <div
              data-testid="colorbar-ramp"
              className="h-4 w-full rounded border border-slate-700 shadow-inner"
              style={{ background: legendModel.gradientCss }}
            />
            {/* Discrete Tick Labels */}
            <div className="flex justify-between text-[10px] font-mono text-slate-400 px-0.5">
              {legendModel.ticks.map((t, idx) => (
                <span key={idx} data-testid={`legend-tick-${idx}`}>
                  {t.formattedLabel}
                </span>
              ))}
            </div>
          </div>

          {/* Domain Clamping Range Sliders */}
          <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Scalar Clamps:</span>
              <span className="font-mono text-sky-300 font-medium">
                {tfContract.physical_domain_min.toFixed(Math.abs(tfDomain.max - tfDomain.min) < 2 ? 3 : 2)} {tfContract.physical_units} — {tfContract.physical_domain_max.toFixed(Math.abs(tfDomain.max - tfDomain.min) < 2 ? 3 : 2)} {tfContract.physical_units}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                data-testid="slider-clamp-min"
                min={tfDomain.min}
                max={Math.max(tfDomain.min, tfContract.physical_domain_max - (tfDomain.max - tfDomain.min) * 0.005)}
                step={Math.max(0.0001, (tfDomain.max - tfDomain.min) / 200)}
                value={tfContract.physical_domain_min}
                aria-label="Scalar clamp minimum"
                onChange={(e) => {
                  const rawVal = parseFloat(e.target.value);
                  const val = Math.max(tfDomain.min, Math.min(rawVal, tfContract.physical_domain_max));
                  tfModel.setClamps(val, tfContract.physical_domain_max);
                }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <input
                type="range"
                data-testid="slider-clamp-max"
                min={Math.min(tfDomain.max, tfContract.physical_domain_min + (tfDomain.max - tfDomain.min) * 0.005)}
                max={tfDomain.max}
                step={Math.max(0.0001, (tfDomain.max - tfDomain.min) / 200)}
                value={tfContract.physical_domain_max}
                aria-label="Scalar clamp maximum"
                onChange={(e) => {
                  const rawVal = parseFloat(e.target.value);
                  const val = Math.min(tfDomain.max, Math.max(rawVal, tfContract.physical_domain_min));
                  tfModel.setClamps(tfContract.physical_domain_min, val);
                }}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Dedicated Non-Data Swatches */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="w-3 h-3 rounded bg-[#222222] border border-slate-700" />
              <div>
                <div className="text-slate-300 font-semibold">{legendModel.landSwatch.label}</div>
                <div className="text-slate-500 text-[9px]">{legendModel.landSwatch.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded border border-slate-800">
              <div className="w-3 h-3 rounded bg-[#888888] border border-slate-700" />
              <div>
                <div className="text-slate-300 font-semibold">{legendModel.missingSwatch.label}</div>
                <div className="text-slate-500 text-[9px]">{legendModel.missingSwatch.description}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: 6-Plane Depth & Geodetic Clipping */}
      {activeTab === 'clip' && clippingModel && clippingState && (
        <div className="flex flex-col gap-2.5" data-testid="tab-content-clip">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-medium uppercase">Depth Clipping Range:</span>
            <span className="font-mono text-amber-300 text-[11px]">
              {clippingState.limits.minDepthM.toFixed(1)}m — {clippingState.limits.maxDepthM.toFixed(1)}m
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-slate-950/60 p-2 rounded border border-slate-800">
            <div className="flex items-center gap-2">
              <input
                type="range"
                data-testid="slider-clip-depth-min"
                min={clippingState.domain.minDepthM}
                max={clippingState.limits.maxDepthM - 1}
                step={1}
                value={clippingState.limits.minDepthM}
                aria-label="Clipping minimum depth in meters"
                onChange={(e) => clippingModel.setDepthRange(parseFloat(e.target.value), clippingState.limits.maxDepthM)}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <input
                type="range"
                data-testid="slider-clip-depth-max"
                min={clippingState.limits.minDepthM + 1}
                max={clippingState.domain.maxDepthM}
                step={1}
                value={clippingState.limits.maxDepthM}
                aria-label="Clipping maximum depth in meters"
                onChange={(e) => clippingModel.setDepthRange(clippingState.limits.minDepthM, parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          </div>

          {/* Longitude Slices */}
          <div className="flex flex-col gap-1 bg-slate-950/60 p-2 rounded border border-slate-800 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Longitude Bounds:</span>
              <span className="font-mono text-sky-300">
                {clippingState.limits.minLonDeg.toFixed(1)}°E — {clippingState.limits.maxLonDeg.toFixed(1)}°E
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                data-testid="slider-clip-lon-min"
                min={clippingState.domain.minLonDeg}
                max={clippingState.limits.maxLonDeg - 0.5}
                step={0.5}
                value={clippingState.limits.minLonDeg}
                aria-label="Clipping minimum longitude"
                onChange={(e) => clippingModel.setLongitudeRange(parseFloat(e.target.value), clippingState.limits.maxLonDeg)}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <input
                type="range"
                data-testid="slider-clip-lon-max"
                min={clippingState.limits.minLonDeg + 0.5}
                max={clippingState.domain.maxLonDeg}
                step={0.5}
                value={clippingState.limits.maxLonDeg}
                aria-label="Clipping maximum longitude"
                onChange={(e) => clippingModel.setLongitudeRange(clippingState.limits.minLonDeg, parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
          </div>

          {/* Latitude Slices */}
          <div className="flex flex-col gap-1 bg-slate-950/60 p-2 rounded border border-slate-800 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Latitude Bounds:</span>
              <span className="font-mono text-emerald-300">
                {clippingState.limits.minLatDeg.toFixed(1)}°N — {clippingState.limits.maxLatDeg.toFixed(1)}°N
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                data-testid="slider-clip-lat-min"
                min={clippingState.domain.minLatDeg}
                max={clippingState.limits.maxLatDeg - 0.5}
                step={0.5}
                value={clippingState.limits.minLatDeg}
                aria-label="Clipping minimum latitude"
                onChange={(e) => clippingModel.setLatitudeRange(parseFloat(e.target.value), clippingState.limits.maxLatDeg)}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <input
                type="range"
                data-testid="slider-clip-lat-max"
                min={clippingState.limits.minLatDeg + 0.5}
                max={clippingState.domain.maxLatDeg}
                step={0.5}
                value={clippingState.limits.maxLatDeg}
                aria-label="Clipping maximum latitude"
                onChange={(e) => clippingModel.setLatitudeRange(clippingState.limits.minLatDeg, parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>

          {/* Reset & Invert Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => clippingModel.resetToFullDomain()}
              data-testid="btn-clip-reset"
              className="flex-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium border border-slate-700 transition"
            >
              Reset Full Domain
            </button>
            <button
              onClick={() => clippingModel.toggleInversion()}
              data-testid="btn-clip-invert"
              className={`flex-1 py-1 px-2 rounded text-[11px] font-medium border transition ${
                clippingState.isInverted
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {clippingState.isInverted ? 'Clipping Inverted' : 'Invert Clip'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Content: Volume Quality & Raymarching Settings */}
      {activeTab === 'quality' && (
        <div className="flex flex-col gap-2.5" data-testid="tab-content-quality">
          <VolumeQualityControls qualityModel={qualityModel} />
        </div>
      )}
    </div>
  );
};
