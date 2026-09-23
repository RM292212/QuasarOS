/**
 * QuasarOS Volume Quality, LOD Resolution & Geological Exaggeration Controls
 *
 * Implements:
 * 1. 3-Tier LOD Mode selector: Preview (16x32x32), Interactive (24x48x48), High Quality (50x181x97).
 * 2. Exact Grid Dimensions & GPU VRAM Footprint readout with <50 MiB budget compliance gauge.
 * 3. Sampling step size, opacity density, and bounding wireframe toggles.
 * 4. Vertical Exaggeration slider (10x to 100x) with real-time aspect ratio calculation.
 */

import React, { useState, useEffect } from 'react';
import { VolumeQualityModel } from './volume_quality_controls.ts';
import { useAppStore, LOD_CONFIGS, LODMode } from '../../context/app_store.ts';

export interface VolumeQualityControlsProps {
  qualityModel: VolumeQualityModel;
  className?: string;
}

export const VolumeQualityControls: React.FC<VolumeQualityControlsProps> = ({
  qualityModel,
  className = '',
}) => {
  const [settings, setSettings] = useState(() => qualityModel.settings);
  const { lodMode, setLODMode, gridInfo, verticalExaggeration, setVerticalExaggeration } = useAppStore();

  useEffect(() => {
    const unsub = qualityModel.subscribe((s) => setSettings(s));
    return unsub;
  }, [qualityModel]);

  const handleLODChange = (mode: LODMode) => {
    qualityModel.setLODMode(mode);
    setLODMode(mode);
  };

  const handleVEChange = (ve: number) => {
    qualityModel.setVerticalExaggeration(ve);
    setVerticalExaggeration(ve);
  };

  const sx = 0.534;
  const sz = 1.000;
  const sy = (0.172 * (verticalExaggeration / 50.0)).toFixed(3);

  return (
    <div
      data-testid="volume-quality-controls"
      className={`flex flex-col gap-3 font-sans text-xs ${className}`}
    >
      {/* 1. Multi-LOD Resolution Mode Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-slate-400 text-[11px] font-medium uppercase tracking-wider">
          Resolution / LOD Mode:
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          {(['preview', 'interactive', 'high_quality'] as LODMode[]).map((mode) => {
            const config = LOD_CONFIGS[mode];
            const isSelected = lodMode === mode;
            return (
              <button
                key={mode}
                data-testid={`lod-select-${mode}`}
                onClick={() => handleLODChange(mode)}
                className={`py-1.5 px-2 rounded-md text-[10px] font-mono flex flex-col items-center gap-0.5 transition ${
                  isSelected
                    ? 'bg-cyan-600 text-white font-bold shadow-md ring-1 ring-cyan-400'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{config.shortLabel}</span>
                <span className="text-[9px] opacity-80">
                  {config.depthLevels}×{config.latRes}×{config.lonRes}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Exact Grid Dimensions & VRAM Footprint Gauge */}
      <div
        data-testid="grid-dimensions-report-card"
        className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5 text-[11px] font-mono"
      >
        <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800 pb-1">
          <span className="text-cyan-300">GPU Grid & Memory Footprint</span>
          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-600 text-emerald-300 rounded">
            &lt; 50 MiB Budget
          </span>
        </div>

        <div className="flex justify-between text-slate-400 text-[10px]">
          <span>Source Grid:</span>
          <span className="text-slate-200">50 × 181 × 97 (D×Lat×Lon)</span>
        </div>

        <div className="flex justify-between text-slate-400 text-[10px]">
          <span>Returned Shape:</span>
          <span className="text-amber-300">
            {gridInfo ? `[${gridInfo.returnedShape.join(' × ')}]` : 'Calculating...'}
          </span>
        </div>

        <div className="flex justify-between text-slate-400 text-[10px]">
          <span>GPU Texture 3D:</span>
          <span className="text-sky-300">
            {gridInfo ? `[${gridInfo.gpuTextureDimensions.join(' × ')}]` : 'Allocating...'}
          </span>
        </div>

        <div className="flex justify-between text-slate-400 text-[10px]">
          <span>Voxel Count:</span>
          <span className="text-white font-bold">
            {gridInfo ? gridInfo.voxelCount.toLocaleString() : '0'} voxels
          </span>
        </div>

        <div className="flex justify-between text-slate-400 text-[10px] border-t border-slate-800/80 pt-1">
          <span>Texture VRAM:</span>
          <span className="text-emerald-400 font-bold">
            {gridInfo ? `${gridInfo.vramMb.toFixed(2)} MiB / 50.00 MiB (${gridInfo.budgetPercent.toFixed(1)}%)` : '0.00 MiB'}
          </span>
        </div>

        {/* VRAM Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(1, (gridInfo?.vramMb ?? 0) / 0.5))}%` }}
          />
        </div>
      </div>

      {/* 3. Sampling Density Step Size Multiplier */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] font-medium uppercase">Sampling Step Multiplier:</span>
          <span className="font-mono text-cyan-300 text-[11px]">
            {settings.stepSizeMultiplier.toFixed(2)}x (Step: {qualityModel.effectiveStepSize.toFixed(4)})
          </span>
        </div>
        <input
          type="range"
          data-testid="slider-quality-step"
          min={0.25}
          max={4.0}
          step={0.25}
          value={settings.stepSizeMultiplier}
          aria-label="Sampling density step multiplier"
          onChange={(e) => qualityModel.setStepSizeMultiplier(parseFloat(e.target.value))}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
      </div>

      {/* 4. Opacity Density Multiplier */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] font-medium uppercase">Opacity Multiplier:</span>
          <span className="font-mono text-cyan-300 text-[11px]">{settings.opacityMultiplier.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          data-testid="slider-quality-opacity"
          min={0.1}
          max={5.0}
          step={0.1}
          value={settings.opacityMultiplier}
          aria-label="Opacity density multiplier"
          onChange={(e) => qualityModel.setOpacityMultiplier(parseFloat(e.target.value))}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />
      </div>

      {/* 5. Vertical Exaggeration Controller */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px] font-medium uppercase">Vertical Exaggeration:</span>
          <span className="font-mono text-amber-300 text-[11px]">
            {verticalExaggeration}x ({sx} : {sy} : {sz})
          </span>
        </div>
        <input
          type="range"
          data-testid="slider-quality-ve"
          min={10}
          max={100}
          step={5}
          value={verticalExaggeration}
          aria-label="Vertical Exaggeration Factor"
          onChange={(e) => handleVEChange(parseFloat(e.target.value))}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
        />
      </div>

      {/* 6. Bounding Wireframe & Reset */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
          <input
            type="checkbox"
            data-testid="checkbox-bounding-box"
            checked={settings.showBoundingBox}
            onChange={(e) => qualityModel.setBoundingBoxVisible(e.target.checked)}
            className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
          />
          Show 3D Bounding Wireframe
        </label>
        <button
          onClick={() => {
            qualityModel.resetDefaults();
            setVerticalExaggeration(50.0);
            setLODMode('interactive');
          }}
          data-testid="btn-quality-reset"
          className="text-[10px] text-slate-400 hover:text-slate-200 underline"
        >
          Reset Defaults
        </button>
      </div>
    </div>
  );
};
