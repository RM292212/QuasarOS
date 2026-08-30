/**
 * PickReconciliationPanel Component
 *
 * Displays:
 * 1. Cursor coordinate readout (Lon, Lat, Depth, Time).
 * 2. Approximate Rendered Value vs. Authoritative Native-Source Value.
 * 3. Error delta, relative difference %, coordinate resolution distance, and SHA-256 digest.
 */

import React, { useMemo } from 'react';
import type { PickReconciliationModel } from './types.ts';
import { formatPickReconciliationSummary } from './PickReconciliationLogic.ts';

export interface PickReconciliationPanelProps {
  model: PickReconciliationModel;
  onReconcileRequest?: () => void;
  className?: string;
}

export const PickReconciliationPanel: React.FC<PickReconciliationPanelProps> = ({
  model,
  onReconcileRequest,
  className = '',
}) => {
  const { cursor, provisional, authoritative, delta, isLoading, error } = model;

  const statusBadge = useMemo(() => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-300 border border-amber-500/30 animate-pulse">
          Reconciling...
        </span>
      );
    }
    if (error) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/40 text-red-300 border border-red-500/30">
          Error
        </span>
      );
    }
    if (authoritative) {
      const isWithinBound = delta.withinErrorBound ?? true;
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
            isWithinBound
              ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-900/40 text-amber-300 border-amber-500/30'
          }`}
        >
          {isWithinBound ? 'Reconciled (Verified)' : 'Delta Alert'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        Provisional Only
      </span>
    );
  }, [isLoading, error, authoritative, delta]);

  return (
    <div
      className={`bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-4 text-slate-200 shadow-xl font-sans text-xs ${className}`}
      role="region"
      aria-label="Scientific Pick Reconciliation Panel"
      data-testid="pick-reconciliation-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider">
            Point Pick & Reconciliation
          </h3>
        </div>
        {statusBadge}
      </div>

      {/* Cursor Geodetic Readout */}
      <div className="bg-slate-950/60 rounded p-2.5 mb-3 border border-slate-800/80 space-y-1 font-mono text-[11px]">
        <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">
          Cursor Ray Hit Coordinates
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div>
            <span className="text-slate-500">Lon:</span>{' '}
            <span className="text-cyan-300 font-semibold" data-testid="cursor-lon">
              {cursor.longitudeDeg.toFixed(4)}°E
            </span>
          </div>
          <div>
            <span className="text-slate-500">Lat:</span>{' '}
            <span className="text-cyan-300 font-semibold" data-testid="cursor-lat">
              {cursor.latitudeDeg.toFixed(4)}°N
            </span>
          </div>
          <div>
            <span className="text-slate-500">Depth:</span>{' '}
            <span className="text-cyan-300 font-semibold" data-testid="cursor-depth">
              {cursor.depthM.toFixed(3)} m
            </span>
          </div>
          <div>
            <span className="text-slate-500">UTC:</span>{' '}
            <span className="text-slate-300" data-testid="cursor-time">
              {cursor.timestampUtc.split('T')[0] ?? cursor.timestampUtc}
            </span>
          </div>
        </div>
      </div>

      {/* Value Comparison Cards */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Provisional Render Value */}
        <div className="bg-slate-800/40 rounded p-2 border border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-0.5">
              Provisional (GPU)
            </div>
            <div className="text-lg font-bold text-sky-400 font-mono" data-testid="provisional-value">
              {provisional.approximateValue.toFixed(4)}
              <span className="text-xs font-normal text-slate-400 ml-1">
                {provisional.displayUnits}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span>LOD {provisional.lodLevel}</span>
            <span>±{provisional.estimatedSampleErrorBound.toFixed(3)} bound</span>
          </div>
        </div>

        {/* Authoritative Native Value */}
        <div className="bg-slate-800/40 rounded p-2 border border-slate-700/50 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium mb-0.5">
              Authoritative (NetCDF)
            </div>
            <div
              className="text-lg font-bold font-mono text-emerald-300"
              data-testid="authoritative-value"
            >
              {isLoading ? (
                <span className="text-xs text-amber-400">Querying...</span>
              ) : authoritative && authoritative.scientificValue !== null ? (
                <>
                  {authoritative.scientificValue.toFixed(4)}
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    {authoritative.canonicalUnits}
                  </span>
                </>
              ) : authoritative ? (
                <span className="text-xs text-slate-400 uppercase">
                  [{authoritative.valueState}]
                </span>
              ) : (
                <span className="text-xs text-slate-500">Unreconciled</span>
              )}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
            <span>{authoritative ? authoritative.valueState : 'N/A'}</span>
            <span>{authoritative ? authoritative.selectionMethodUsed : ''}</span>
          </div>
        </div>
      </div>

      {/* Delta Metrics & Verification */}
      {authoritative && (
        <div className="bg-slate-950/40 rounded p-2 mb-3 border border-slate-800/80 font-mono text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Absolute Delta (|ΔV|):</span>
            <span
              className={`font-semibold ${
                delta.withinErrorBound ? 'text-emerald-400' : 'text-amber-400'
              }`}
              data-testid="absolute-delta"
            >
              {delta.absoluteDelta !== null ? `${delta.absoluteDelta.toFixed(6)} °C` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Relative Difference:</span>
            <span className="text-slate-300" data-testid="relative-delta">
              {delta.relativeDeltaPercent !== null
                ? `${delta.relativeDeltaPercent.toFixed(4)}%`
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Resolution Distance:</span>
            <span className="text-slate-300" data-testid="resolution-dist">
              {delta.coordinateResolutionDistanceKm.toFixed(3)} km
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
            <span className="text-slate-400">Source Asset SHA:</span>
            <span
              className="text-[9px] text-slate-500 truncate max-w-[140px]"
              title={authoritative.sourceAssetSha256}
              data-testid="source-sha256"
            >
              {authoritative.sourceAssetSha256.substring(0, 16)}...
            </span>
          </div>
        </div>
      )}

      {/* Reconcile Action Button */}
      {onReconcileRequest && !isLoading && (
        <button
          onClick={onReconcileRequest}
          className="w-full py-1.5 px-3 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded font-medium text-xs transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900 shadow"
          data-testid="reconcile-button"
        >
          Re-reconcile with Authoritative Server
        </button>
      )}
    </div>
  );
};
