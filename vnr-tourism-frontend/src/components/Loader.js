import React from 'react';

export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="loader-wrap">
      <div className="spinner" />
      <div style={{ color: '#8b949e', fontSize: '0.95rem' }}>{text}</div>
    </div>
  );
}
