import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TransectDraw, HorizontalSlice, TSDiagram } from '../src/components/analysis/index.ts';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Analysis Controls Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders TransectDraw and fetches data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success' })
    });

    render(<TransectDraw />);
    expect(screen.getByText('Transect Draw')).toBeInTheDocument();
    
    const button = screen.getByText('Draw Transect');
    fireEvent.click(button);

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/analysis/transect', expect.any(Object));
    expect(await screen.findByText('Transect data loaded.')).toBeInTheDocument();
  });

  it('renders HorizontalSlice and fetches data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success' })
    });

    render(<HorizontalSlice />);
    expect(screen.getByText('Horizontal Slice')).toBeInTheDocument();
    
    const button = screen.getByText('Extract Slice');
    fireEvent.click(button);

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/analysis/slice', expect.any(Object));
    expect(await screen.findByText('Slice data loaded.')).toBeInTheDocument();
  });

  it('renders TSDiagram and fetches data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ levels_count: 50 })
    });

    render(<TSDiagram />);
    expect(screen.getByText('T-S Diagram')).toBeInTheDocument();
    
    const button = screen.getByText('View T-S Diagram');
    fireEvent.click(button);

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/analysis/teos10-soundings', expect.any(Object));
    expect(await screen.findByText('T-S data loaded. Levels: 50')).toBeInTheDocument();
  });
});
