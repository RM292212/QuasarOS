/**
 * ProvenanceDrawer Component
 *
 * Provides a slide-over / expandable drawer revealing full data lineage,
 * cryptographic verification hashes, Copernicus Marine Service attributions, and licences.
 */

import React, { useState } from 'react';
import type { ProvenanceMetadataModel } from './types.ts';
import { COPERNICUS_THETAO_PROVENANCE_BASELINE, formatProvenanceMarkdown } from './ProvenanceLogic.ts';

export interface ProvenanceDrawerProps {
  provenance?: ProvenanceMetadataModel;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const ProvenanceDrawer: React.FC<ProvenanceDrawerProps> = ({
  provenance = COPERNICUS_THETAO_PROVENANCE_BASELINE,
  isOpen,
  onClose,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyMarkdown = () => {
    const md = formatProvenanceMarkdown(provenance);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-slate-700 shadow-2xl p-6 text-slate-200 overflow-y-auto font-sans flex flex-col justify-between ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="provenance-drawer-title"
      data-testid="provenance-drawer"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2
              id="provenance-drawer-title"
              className="text-base font-bold text-slate-100 uppercase tracking-wider"
            >
              Data Lineage & Provenance
            </h2>
            <p className="text-xs text-slate-400">
              Certified Operational Product Traceability
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 rounded-md hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label="Close Provenance Drawer"
            data-testid="provenance-close-button"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Product Identity */}
        <div className="space-y-4">
          <section className="bg-slate-950/60 rounded-lg p-3 border border-slate-800">
            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
              Dataset Identification
            </h3>
            <dl className="grid grid-cols-3 gap-y-2 text-xs font-mono">
              <dt className="text-slate-500 col-span-1">Product ID:</dt>
              <dd className="text-slate-200 col-span-2 break-all" data-testid="prov-product-id">
                {provenance.productId}
              </dd>

              <dt className="text-slate-500 col-span-1">Dataset ID:</dt>
              <dd className="text-slate-200 col-span-2 break-all" data-testid="prov-dataset-id">
                {provenance.datasetId}
              </dd>

              <dt className="text-slate-500 col-span-1">Variable:</dt>
              <dd className="text-slate-200 col-span-2" data-testid="prov-variable-id">
                {provenance.variableId}
              </dd>

              <dt className="text-slate-500 col-span-1">Version:</dt>
              <dd className="text-slate-200 col-span-2">{provenance.datasetVersion}</dd>

              <dt className="text-slate-500 col-span-1">Provider:</dt>
              <dd className="text-slate-300 col-span-2 font-sans">{provenance.provider}</dd>
            </dl>
          </section>

          {/* Cryptographic Integrity */}
          <section className="bg-slate-950/60 rounded-lg p-3 border border-slate-800">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              Cryptographic Lineage
            </h3>
            <dl className="space-y-2 text-xs font-mono">
              <div>
                <dt className="text-slate-500 text-[10px] uppercase">Source NetCDF File:</dt>
                <dd className="text-slate-300 break-all">{provenance.sourceFilename}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-[10px] uppercase">Source SHA-256 Digest:</dt>
                <dd
                  className="text-emerald-300 text-[11px] break-all bg-emerald-950/30 p-1.5 rounded border border-emerald-900/50"
                  data-testid="prov-source-sha256"
                >
                  {provenance.sourceSha256}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-[10px] uppercase">Acquisition Timestamp:</dt>
                <dd className="text-slate-300" data-testid="prov-acquisition-time">
                  {provenance.acquisitionTimestampUtc}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-[10px] uppercase">Processing Pipeline:</dt>
                <dd className="text-slate-400">
                  {provenance.processingPipelineVersion ?? 'QuasarOS v1.0 Canonical Ingest'}
                </dd>
              </div>
            </dl>
          </section>

          {/* Legal Attribution */}
          <section className="bg-slate-950/60 rounded-lg p-3 border border-slate-800">
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
              Licence & Attribution
            </h3>
            <div className="text-xs space-y-2">
              <div>
                <div className="text-slate-500 text-[10px] uppercase font-mono">Licence:</div>
                <p className="text-slate-300 text-[11px]">{provenance.licence}</p>
              </div>
              <div>
                <div className="text-slate-500 text-[10px] uppercase font-mono">
                  Mandatory Citation:
                </div>
                <p
                  className="text-slate-300 text-[11px] italic bg-slate-900/80 p-2 rounded border border-slate-800"
                  data-testid="prov-attribution"
                >
                  {provenance.attribution}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer / Actions */}
      <div className="border-t border-slate-800 pt-4 mt-6 flex gap-2">
        <button
          onClick={handleCopyMarkdown}
          className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded font-medium text-xs transition focus:outline-none focus:ring-2 focus:ring-slate-400"
          data-testid="copy-provenance-button"
        >
          {copied ? '✓ Copied Lineage Markdown' : 'Copy Provenance Record'}
        </button>
        <button
          onClick={onClose}
          className="py-2 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded font-medium text-xs transition focus:outline-none focus:ring-2 focus:ring-cyan-400"
        >
          Done
        </button>
      </div>
    </div>
  );
};
