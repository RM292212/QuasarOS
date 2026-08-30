/**
 * TEOS-10 Soundings Panel — RUNTIME-HOTFIX-03
 *
 * Request gating rules (prevents avoidable 400 errors during page initialisation):
 * - Latitude must be within the Arabian Sea domain: [-3, 12]°N
 * - Longitude must be within the Arabian Sea domain: [80, 88]°E
 * - time_index must be 0-6
 * - All three values must be finite numbers before any request is fired
 * - A new AbortController cancels in-flight requests when props change
 * - Stale responses (from a cancelled fetch) are silently ignored
 *
 * The default coordinates (6.0°N, 84.0°E) are valid ocean cells within the domain.
 * A 500 ms debounce prevents request storms on rapid prop changes.
 */
import React, { useState, useEffect, useRef } from 'react';

// Arabian Sea domain — matches backend TEOS10Request field constraints
const LAT_MIN = -3.0;
const LAT_MAX = 12.0;
const LON_MIN = 80.0;
const LON_MAX = 88.0;

function isValidDomain(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= LAT_MIN && lat <= LAT_MAX &&
    lon >= LON_MIN && lon <= LON_MAX
  );
}

export interface Teos10SoundingsPanelProps {
  latitude?: number;
  longitude?: number;
  timeIndex?: number;
}

export const Teos10SoundingsPanel: React.FC<Teos10SoundingsPanelProps> = ({
  latitude = 6.0,
  longitude = 84.0,  // Default corrected to valid ocean domain
  timeIndex = 0,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // H2 fix: gate the request — never submit if inputs are out of domain
    if (!isValidDomain(latitude, longitude)) {
      setValidationMsg(
        `Location (${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E) is outside ` +
        `the Arabian Sea domain [${LAT_MIN}–${LAT_MAX}°N, ${LON_MIN}–${LON_MAX}°E]. ` +
        `Select a point within the Copernicus regional grid.`
      );
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!Number.isFinite(timeIndex) || timeIndex < 0 || timeIndex > 6) {
      setValidationMsg(`time_index ${timeIndex} is out of range [0, 6].`);
      return;
    }

    setValidationMsg(null);

    // Debounce to avoid request storms on rapid prop changes
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Cancel any previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/v1/analysis/teos10-soundings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude, longitude, time_index: timeIndex }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return; // Stale response — discard

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const msg = errBody?.error?.message ?? `HTTP ${response.status}`;
          throw new Error(msg);
        }

        const result = await response.json();
        if (!controller.signal.aborted) {
          setData(result);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // Cancelled — not an error
        setError(err.message ?? 'Failed to fetch TEOS-10 soundings');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [latitude, longitude, timeIndex]);

  return (
    <div
      className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 text-slate-200 shadow-xl font-sans text-xs flex flex-col mt-3"
      data-testid="teos10-soundings-panel"
    >
      <div className="border-b border-slate-800 pb-2 mb-2">
        <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider">
          TEOS-10 Derived Soundings
        </h3>
        <p className="text-[10px] text-cyan-300 mt-1 uppercase">
          Scientifically Derived from GSW TEOS-10 — Arabian Sea Domain
        </p>
      </div>

      {/* Domain validation warning — shown before any request is fired */}
      {validationMsg && (
        <div className="text-amber-400 p-2 border border-amber-800/50 rounded bg-amber-950/20 text-[10px]">
          {validationMsg}
        </div>
      )}

      {loading && <div className="text-slate-400 p-2">Computing thermodynamic properties...</div>}

      {error && (
        <div className="text-red-400 p-2 border border-red-900/50 rounded bg-red-950/20">
          {error}
        </div>
      )}

      {data && !loading && !error && data.status === 'MASKED_WATER_COLUMN' && (
        <div className="text-amber-400 p-2">Masked water column at this location.</div>
      )}

      {data && !loading && !error && data.soundings && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between bg-slate-950/50 p-2 rounded border border-slate-800">
            <span className="text-slate-400">Mixed Layer Depth (MLD)</span>
            <span className="font-mono text-emerald-300 font-semibold" data-testid="teos10-mld">
              {data.mixed_layer_depth_m.toFixed(2)} m
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-800 rounded">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead className="bg-slate-800 text-slate-300 sticky top-0">
                <tr>
                  <th className="p-1.5 border-b border-slate-700">Depth(m)</th>
                  <th className="p-1.5 border-b border-slate-700">SA(g/kg)</th>
                  <th className="p-1.5 border-b border-slate-700">CT(°C)</th>
                  <th className="p-1.5 border-b border-slate-700">Rho(kg/m³)</th>
                  <th className="p-1.5 border-b border-slate-700">Sound(m/s)</th>
                </tr>
              </thead>
              <tbody>
                {data.soundings.map((s: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-1.5 font-mono text-cyan-300">{s.depth_m.toFixed(1)}</td>
                    <td className="p-1.5 font-mono text-slate-300">{s.absolute_salinity_g_kg.toFixed(3)}</td>
                    <td className="p-1.5 font-mono text-slate-300">
                      {(s.conservative_temperature_C ?? s.conservative_temp_c)?.toFixed(3) ?? '-'}
                    </td>
                    <td className="p-1.5 font-mono text-slate-300">{s.in_situ_density_kg_m3.toFixed(2)}</td>
                    <td className="p-1.5 font-mono text-emerald-300">{s.sound_speed_m_s.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[9px] text-slate-500 text-right mt-1">
            GSW version: {data.gsw_library_version}
          </div>
        </div>
      )}
    </div>
  );
};
