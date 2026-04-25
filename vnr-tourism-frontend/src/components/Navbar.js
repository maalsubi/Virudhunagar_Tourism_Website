import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">
        <span className="navbar-logo">🗺️</span>
        <div>
          <div className="navbar-title">VNR Tourism</div>
          <div className="navbar-subtitle">Virudhunagar District</div>
        </div>
      </NavLink>

      <div className="navbar-links">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
          🏠 Home
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          📊 Analytics
        </NavLink>
        <NavLink
          to="/recommendations"
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          🧭 Recommendations
        </NavLink>
      </div>
    </nav>
  );
}
