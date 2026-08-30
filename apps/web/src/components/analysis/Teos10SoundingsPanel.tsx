import React, { useState, useEffect } from 'react';

export interface Teos10SoundingsPanelProps {
  latitude?: number;
  longitude?: number;
  timeIndex?: number;
}

export const Teos10SoundingsPanel: React.FC<Teos10SoundingsPanelProps> = ({
  latitude = 6.0,
  longitude = 64.0,
  timeIndex = 0,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/v1/analysis/teos10-soundings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude,
            longitude,
            time_index: timeIndex,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch TEOS-10 soundings');
        }

        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [latitude, longitude, timeIndex]);

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-3 text-slate-200 shadow-xl font-sans text-xs flex flex-col mt-3" data-testid="teos10-soundings-panel">
      <div className="border-b border-slate-800 pb-2 mb-2">
        <h3 className="font-semibold text-sm text-slate-100 uppercase tracking-wider">
          TEOS-10 Derived Soundings
        </h3>
        <p className="text-[10px] text-cyan-300 mt-1 uppercase">
          Scientifically Derived Result from GSW TEOS-10
        </p>
      </div>

      {loading && <div className="text-slate-400 p-2">Computing thermodynamic properties...</div>}
      
      {error && <div className="text-red-400 p-2 border border-red-900/50 rounded bg-red-950/20">{error}</div>}

      {data && !loading && !error && data.status === 'MASKED_WATER_COLUMN' && (
        <div className="text-amber-400 p-2">Masked water column at this location.</div>
      )}

      {data && !loading && !error && data.soundings && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between bg-slate-950/50 p-2 rounded border border-slate-800">
            <span className="text-slate-400">Mixed Layer Depth (MLD)</span>
            <span className="font-mono text-emerald-300 font-semibold" data-testid="teos10-mld">{data.mixed_layer_depth_m.toFixed(2)} m</span>
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
                    <td className="p-1.5 font-mono text-slate-300">{s.conservative_temp_c ? s.conservative_temp_c.toFixed(3) : (s.conservative_temperature_C?.toFixed(3) ?? '-')}</td>
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
