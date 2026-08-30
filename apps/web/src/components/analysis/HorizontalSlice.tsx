import React, { useState } from 'react';

export const HorizontalSlice: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlice = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/analysis/slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depth_m: 50.0,
          variable: 'thetao',
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
    <div className="p-4 border border-slate-700 bg-slate-900 rounded mt-2" data-testid="horizontal-slice">
      <h3 className="text-sm font-bold text-white mb-2">Horizontal Slice</h3>
      <button 
        onClick={fetchSlice}
        disabled={loading}
        className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs rounded disabled:opacity-50"
      >
        {loading ? 'Slicing...' : 'Extract Slice'}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {data && (
        <div className="mt-2 text-xs text-slate-300">
          <p>Slice data loaded.</p>
        </div>
      )}
    </div>
  );
};
