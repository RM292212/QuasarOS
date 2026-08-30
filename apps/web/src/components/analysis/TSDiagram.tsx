import React, { useState } from 'react';

export const TSDiagram: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTS = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/analysis/teos10-soundings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: 5.0,
          longitude: 80.0,
          time_index: 0
        })
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border border-slate-700 bg-slate-900 rounded mt-2" data-testid="ts-diagram">
      <h3 className="text-sm font-bold text-white mb-2">T-S Diagram</h3>
      <button 
        onClick={fetchTS}
        disabled={loading}
        className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded disabled:opacity-50"
      >
        {loading ? 'Loading T-S...' : 'View T-S Diagram'}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {data && (
        <div className="mt-2 text-xs text-slate-300">
          <p>T-S data loaded. Levels: {data.levels_count}</p>
        </div>
      )}
    </div>
  );
};
