import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { placesAPI, recommendAPI } from '../utils/api';
import { TALUKS, TALUK_COLORS, CATEGORY_COLORS } from '../utils/constants';
import PlaceCard from '../components/PlaceCard';
import Loader from '../components/Loader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function Home() {
  const [overview, setOverview] = useState(null);
  const [topByTaluk, setTopByTaluk] = useState({});
  const [activeTaluk, setActiveTaluk] = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([placesAPI.getOverview(), recommendAPI.getTopByTaluk()])
      .then(([o, t]) => {
        setOverview(o.data);
        setTopByTaluk(t.data);
        setActiveTaluk(Object.keys(t.data)[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Loading district data..." />;
  if (!overview) return <div className="page"><p>Failed to load data.</p></div>;

  const catColors = overview.byCategory.map((c) => CATEGORY_COLORS[c.category] || '#888');

  return (
    <div>
      <div className="hero">
        <div className="hero-content">
          <div className="hero-badge">🗺️ Tamil Nadu · Southern District</div>
          <h1 className="hero-title">
            Explore <span className="accent">Virudhunagar</span>
            <br />
            District Tourism
          </h1>
          <p className="hero-desc">
            Discover temples, waterfalls, dams, wildlife sanctuaries and cultural landmarks spread
            across 7 taluks of this vibrant district.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-val accent">{overview.total}</div>
              <div className="hero-stat-lbl">Tourist Places</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-val" style={{ color: '#2a9d8f' }}>7</div>
              <div className="hero-stat-lbl">Taluks</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-val" style={{ color: '#e9c46a' }}>
                {overview.avgRating?.toFixed(1)}⭐
              </div>
              <div className="hero-stat-lbl">Avg Rating</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-val" style={{ color: '#f4a261' }}>
                {overview.byCategory.length}
              </div>
              <div className="hero-stat-lbl">Categories</div>
            </div>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>
                About <span className="accent">Virudhunagar District</span>
              </h2>
              <p style={{ color: '#8b949e', lineHeight: 1.8, fontSize: '0.95rem' }}>
                Virudhunagar (VNR) district in southern Tamil Nadu is a rich tapestry of culture,
                spirituality, and natural beauty. Known globally as the{' '}
                <strong style={{ color: '#e6edf3' }}>Fireworks Capital of India</strong>, it is
                home to the Sivakasi printing and pyrotechnic industries. The district stretches
                across diverse landscapes from the lush forests of the Western Ghats to the sacred
                temple corridors of Srivilliputhur.
              </p>
              <p style={{ color: '#8b949e', lineHeight: 1.8, fontSize: '0.95rem', marginTop: '0.75rem' }}>
                The district spans <strong style={{ color: '#e6edf3' }}>7 taluks</strong> and
                boasts ancient Shaivite and Vaishnavite temples, scenic waterfalls in remote
                hills, wildlife sanctuaries, historic memorials, and scenic dams.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#8b949e' }}>
                PLACES BY CATEGORY
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={overview.byCategory} margin={{ left: -10 }}>
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 10, fill: '#8b949e' }}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {overview.byCategory.map((c, i) => (
                      <Cell key={i} fill={catColors[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="section-title">🏘️ Places Per Taluk</div>
        <div className="grid-4" style={{ marginBottom: '2.5rem' }}>
          {overview.byTaluk.map((t) => {
            const info = TALUKS.find((tk) => tk.name === t.taluk) || {};
            return (
              <div
                key={t.taluk}
                className="stat-card"
                style={{
                  borderLeft: `3px solid ${TALUK_COLORS[t.taluk] || '#888'}`,
                  cursor: 'pointer',
                  border: activeTaluk === t.taluk ? `1px solid ${TALUK_COLORS[t.taluk]}` : undefined,
                }}
                onClick={() => setActiveTaluk(t.taluk)}
              >
                <div className="stat-label">{t.taluk}</div>
                <div className="stat-value" style={{ color: TALUK_COLORS[t.taluk] }}>
                  {t.total}
                </div>
                <div className="stat-sub">⭐ {t.avgRating} avg</div>
                <div style={{ fontSize: '0.72rem', color: '#8b949e', marginTop: '0.25rem' }}>
                  {info.desc || ''}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: '2.5rem' }}>
          <div className="section-title">📍 Prominent Places by Taluk</div>

          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            {TALUKS.map((t) => (
              <button
                key={t.name}
                className={`tab ${activeTaluk === t.name ? 'active' : ''}`}
                style={activeTaluk === t.name ? { background: TALUK_COLORS[t.name], borderColor: TALUK_COLORS[t.name] } : {}}
                onClick={() => setActiveTaluk(t.name)}
              >
                {t.name}
              </button>
            ))}
          </div>

          {activeTaluk && topByTaluk[activeTaluk] && (
            <div>
              <div className="note" style={{ marginBottom: '1rem' }}>
                <strong>{activeTaluk}</strong> - {TALUKS.find((t) => t.name === activeTaluk)?.desc}
              </div>
              <div className="grid-3">
                {topByTaluk[activeTaluk].map((place) => (
                  <PlaceCard key={place.place_id} place={place} />
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => nav(`/recommendations?taluk=${activeTaluk}`)}>
                  See all in {activeTaluk} →
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="section-title">🌟 Top Attractions District-Wide</div>
        <div className="grid-3" style={{ marginBottom: '2.5rem' }}>
          {overview.topPlaces.map((p) => (
            <PlaceCard key={p.place_id} place={p} />
          ))}
        </div>

        <div className="grid-2" style={{ marginBottom: '2.5rem' }}>
          <div className="card">
            <div className="section-title" style={{ fontSize: '1rem' }}>🗂️ Category Distribution</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={overview.byCategory}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={3}
                  label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {overview.byCategory.map((c, i) => (
                    <Cell key={i} fill={catColors[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title" style={{ fontSize: '1rem' }}>🏘️ Taluk Ratings Comparison</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={overview.byTaluk} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: '#8b949e' }} />
                <YAxis dataKey="taluk" type="category" tick={{ fontSize: 10, fill: '#8b949e' }} width={90} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 12 }}
                />
                <Bar dataKey="avgRating" radius={[0, 4, 4, 0]}>
                  {overview.byTaluk.map((t, i) => (
                    <Cell key={i} fill={TALUK_COLORS[t.taluk] || '#888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-2">
          <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => nav('/analytics')}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.4rem' }}>Network Analytics</div>
            <div style={{ color: '#8b949e', fontSize: '0.9rem' }}>
              Explore SNA metrics: centrality, communities, bridges, and hidden gems
            </div>
          </div>
          <div
            className="card"
            style={{ textAlign: 'center', cursor: 'pointer' }}
            onClick={() => nav('/recommendations')}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧭</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.4rem' }}>
              Personalised Recommendations
            </div>
            <div style={{ color: '#8b949e', fontSize: '0.9rem' }}>
              Get tailored place suggestions and custom multi-day itineraries
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
