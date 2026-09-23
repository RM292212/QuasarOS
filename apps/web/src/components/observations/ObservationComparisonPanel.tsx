import React from 'react';
import {
  ObservationComparisonModel,
  ARGO_COLLOCATION_FIXTURES,
  getCollocationModelForFloat,
} from './ObservationComparisonLogic.ts';
import { useAppStore, ARGO_FLOAT_CATALOG } from '../../context/app_store.ts';

export interface ObservationComparisonPanelProps {
  model?: ObservationComparisonModel;
  onClose?: () => void;
  onSelectFloatId?: (floatId: string) => void;
}

export const ObservationComparisonPanel: React.FC<ObservationComparisonPanelProps> = ({
  model: propModel,
  onClose,
  onSelectFloatId,
}) => {
  const { selectedFloatId, setSelectedFloat } = useAppStore();

  const activeModel: ObservationComparisonModel =
    propModel ?? getCollocationModelForFloat(selectedFloatId);

  const handleFloatChange = (floatId: string) => {
    setSelectedFloat(floatId);
    if (onSelectFloatId) {
      onSelectFloatId(floatId);
    }
  };

  return (
    <div
      className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 text-slate-200 shadow-xl font-sans text-xs flex flex-col gap-3"
      data-testid="observation-comparison-panel"
      role="region"
      aria-label="Model vs In-Situ Observation Comparison Panel"
    >
      {/* Header with Title and Close Button */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <div>
          <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Model vs In-Situ Observation
          </h3>
          <p className="text-[10px] text-slate-400 font-mono">
            Platform: {activeModel.argoProfileId} | {activeModel.latitude.toFixed(2)}°N, {activeModel.longitude.toFixed(2)}°E
          </p>
        </div>
        {onClose && (
          <button
            aria-label="Close observation comparison panel"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-bold px-1.5 py-0.5 rounded hover:bg-slate-800 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Float Selector Dropdown */}
      <div className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[11px]">
        <label htmlFor="argo-float-select" className="text-slate-400 font-medium">
          Select Argo Float:
        </label>
        <select
          id="argo-float-select"
          data-testid="float-selector"
          value={activeModel.argoProfileId}
          onChange={(e) => handleFloatChange(e.target.value)}
          className="bg-slate-900 border border-slate-700 text-cyan-300 font-semibold rounded px-2 py-1 text-xs focus:ring-1 focus:ring-cyan-400 focus:outline-none"
        >
          {Object.keys(ARGO_COLLOCATION_FIXTURES).map((id) => (
            <option key={id} value={id}>
              {id} {id.startsWith('D') ? '(Delayed Mode)' : id.startsWith('R') ? '(Real-Time)' : '(BGC)'}
            </option>
          ))}
        </select>
      </div>

      {/* Key Collocation Statistics Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 font-medium">Temperature RMSE</div>
          <div className="text-lg font-mono text-amber-300 font-bold" data-testid="rmse-value">
            {activeModel.rmse.toFixed(3)} °C
          </div>
          <div className="text-[9px] text-slate-500">Root Mean Square Error</div>
        </div>

        <div className="bg-slate-950 p-2 rounded border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 font-medium">Mean Bias</div>
          <div className="text-lg font-mono text-cyan-300 font-bold" data-testid="bias-value">
            {activeModel.meanBias > 0 ? '+' : ''}
            {activeModel.meanBias.toFixed(3)} °C
          </div>
          <div className="text-[9px] text-slate-500">Model - In-Situ Delta</div>
        </div>

        <div className="col-span-2 bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-400">
            Samples: <span className="text-white font-bold" data-testid="sample-size">{activeModel.samplesCount}</span> collocated levels
          </span>
          <span
            data-testid="qc-status-badge"
            className="px-2 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold"
          >
            {activeModel.qcStatus || 'QC: PASSED (Flag 1)'}
          </span>
        </div>
      </div>

      {/* Collocated Layer Table */}
      <div className="flex-1 overflow-y-auto max-h-48 border border-slate-800 rounded bg-slate-950/50">
        <table
          className="w-full text-left border-collapse text-[11px]"
          aria-label="Collocated layer temperature comparison table"
        >
          <thead className="sticky top-0 bg-slate-900 shadow">
            <tr>
              <th scope="col" className="p-1.5 font-medium text-slate-300 border-b border-slate-800">
                Depth (m)
              </th>
              <th scope="col" className="p-1.5 font-medium text-slate-300 border-b border-slate-800">
                Argo (°C)
              </th>
              <th scope="col" className="p-1.5 font-medium text-slate-300 border-b border-slate-800">
                Model (°C)
              </th>
              <th scope="col" className="p-1.5 font-medium text-slate-300 border-b border-slate-800">
                Δ (°C)
              </th>
              <th scope="col" className="p-1.5 font-medium text-slate-300 border-b border-slate-800">
                QC
              </th>
            </tr>
          </thead>
          <tbody>
            {activeModel.layers.map((layer, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-800/50 border-b border-slate-800/50 last:border-0"
                data-testid={`layer-row-${idx}`}
              >
                <td className="p-1.5 font-mono text-slate-200">{layer.depthM.toFixed(1)}</td>
                <td className="p-1.5 font-mono text-emerald-400 font-semibold">
                  {layer.argoTemperature.toFixed(2)}
                </td>
                <td className="p-1.5 font-mono text-sky-400 font-semibold">
                  {layer.modelTemperature.toFixed(2)}
                </td>
                <td
                  className={`p-1.5 font-mono font-semibold ${
                    layer.delta > 0 ? 'text-red-400' : 'text-blue-400'
                  }`}
                  data-testid={`layer-delta-${idx}`}
                >
                  {layer.delta > 0 ? '+' : ''}
                  {layer.delta.toFixed(2)}
                </td>
                <td className="p-1.5 font-mono text-emerald-400 font-bold">
                  {layer.qcFlag ?? 1}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
