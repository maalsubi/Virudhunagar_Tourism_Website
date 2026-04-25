import React from 'react';

export default function MetricBar({ label, value, max = 1, color = '#e63946', width }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div style={{ width: width || '100%' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}
      >
        <span style={{ color: '#8b949e' }}>{label}</span>
        <span style={{ color: '#e6edf3', fontWeight: 600 }}>
          {typeof value === 'number' ? value.toFixed(4) : value}
        </span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
