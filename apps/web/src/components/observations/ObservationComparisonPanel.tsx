import React from 'react';
import { ObservationComparisonModel } from './ObservationComparisonLogic.ts';

export interface ObservationComparisonPanelProps {
  model: ObservationComparisonModel;
  onClose?: () => void;
}

export const ObservationComparisonPanel: React.FC<ObservationComparisonPanelProps> = ({ model, onClose }) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 text-slate-200 shadow-xl font-sans text-xs flex flex-col" data-testid="observation-comparison-panel">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
        <div>
          <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider">Model vs In-Situ Observation</h3>
          <p className="text-[10px] text-slate-400">Argo Float: {model.argoProfileId}</p>
        </div>
        {onClose && (
          <button aria-label="Close observation comparison panel" onClick={onClose} className="text-slate-500 hover:text-slate-300">âœ•</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-slate-950 p-2 rounded border border-slate-800">
          <div className="text-[10px] text-slate-500">RMSE</div>
          <div className="text-lg font-mono text-amber-300" data-testid="rmse-value">{model.rmse.toFixed(3)} Â°C</div>
        </div>
        <div className="bg-slate-950 p-2 rounded border border-slate-800">
          <div className="text-[10px] text-slate-500">Mean Bias</div>
          <div className="text-lg font-mono text-cyan-300" data-testid="bias-value">{model.meanBias > 0 ? '+' : ''}{model.meanBias.toFixed(3)} Â°C</div>
        </div>
        <div className="col-span-2 text-[10px] text-slate-400 text-center">
          Based on <span className="text-slate-200 font-bold" data-testid="sample-size">{model.samplesCount}</span> collocated depth samples
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-48 border border-slate-800 rounded bg-slate-950/50">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-900 shadow">
            <tr>
              <th className="p-1.5 font-medium text-slate-400 border-b border-slate-800">Depth (m)</th>
              <th className="p-1.5 font-medium text-slate-400 border-b border-slate-800">Argo</th>
              <th className="p-1.5 font-medium text-slate-400 border-b border-slate-800">Model</th>
              <th className="p-1.5 font-medium text-slate-400 border-b border-slate-800">Î”</th>
            </tr>
          </thead>
          <tbody>
            {model.layers.map((layer, idx) => (
              <tr key={idx} className="hover:bg-slate-800/50 border-b border-slate-800/50 last:border-0" data-testid={`layer-row-${idx}`}>
                <td className="p-1.5 font-mono text-slate-300">{layer.depthM.toFixed(1)}</td>
                <td className="p-1.5 font-mono text-emerald-400">{layer.argoTemperature.toFixed(2)}</td>
                <td className="p-1.5 font-mono text-sky-400">{layer.modelTemperature.toFixed(2)}</td>
                <td className={`p-1.5 font-mono ${layer.delta > 0 ? 'text-red-400' : 'text-blue-400'}`} data-testid={`layer-delta-${idx}`}>
                  {layer.delta > 0 ? '+' : ''}{layer.delta.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

