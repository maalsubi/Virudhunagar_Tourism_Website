import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../utils/api';
import { CATEGORY_COLORS, COMMUNITY_COLORS } from '../utils/constants';
import NetworkGraph from '../components/NetworkGraph';
import MetricBar from '../components/MetricBar';
import Loader from '../components/Loader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';

const METRIC_INFO = {
  degree_centrality: {
    label: 'Degree Centrality',
    color: '#e63946',
    desc: 'Fraction of all places directly connected to this node. High = well-connected hub.',
  },
  closeness_centrality: {
    label: 'Closeness Centrality',
    color: '#2a9d8f',
    desc: 'How quickly a place can reach all others via the tourism network. High = central to the region.',
  },
  betweenness_centrality: {
    label: 'Betweenness Centrality',
    color: '#f4a261',
    desc: 'How often this node lies on the shortest path between others. High = critical bridge / connector.',
  },
  pagerank: {
    label: 'PageRank',
    color: '#e9c46a',
    desc: 'Influence score based on being connected to other important nodes.',
  },
  popularity_score: {
    label: 'Popularity Score',
    color: '#457b9d',
    desc: 'Composite score combining rating, reviews, and connectivity, while still surfacing remote gems.',
  },
};

export default function Analytics() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [allMetrics, setAllMetrics] = useState([]);
  const [graph, setGraph] = useState(null);
  const [communities, setCommunities] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [hiddenGems, setHiddenGems] = useState([]);
  const [talukMatrix, setTalukMatrix] = useState([]);
  const [metric, setMetric] = useState('degree_centrality');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsAPI.getNetworkStats(),
      analyticsAPI.getAllMetrics(),
      analyticsAPI.getGraph(),
      analyticsAPI.getCommunities(),
      analyticsAPI.getBridges(),
      analyticsAPI.getHiddenGems(),
      analyticsAPI.getTalukMatrix(),
    ])
      .then(([s, m, g, c, b, h, tm]) => {
        setStats(s.data);
        setAllMetrics(m.data);
        setGraph(g.data);
        setCommunities(c.data);
        setBridges(b.data);
        setHiddenGems(h.data);
        setTalukMatrix(tm.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader text="Computing network analytics..." />;

  const topByMetric = [...allMetrics]
    .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
    .slice(0, 15);

  const maxMetric = topByMetric[0]?.[metric] || 1;

  const scatterData = allMetrics.map((n) => ({
    x: n.degree,
    y: n.popularity_score,
    name: n.name,
    category: n.category,
    isolated: n.is_isolated,
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">
          📊 <span className="accent">Network</span> Analytics
        </h1>
        <p className="page-subtitle">
          Social Network Analysis of {stats?.nodeCount} tourist places across Virudhunagar district
        </p>
      </div>

      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        {[
          { label: 'Total Places', value: stats?.nodeCount, color: '#e63946', sub: 'nodes in network' },
          { label: 'Connections', value: stats?.edgeCount, color: '#2a9d8f', sub: 'edges' },
          {
            label: 'Network Density',
            value: stats?.density,
            color: '#e9c46a',
            sub: `${((stats?.density || 0) * 100).toFixed(1)}% of max possible`,
          },
          { label: 'Isolated Gems', value: stats?.isolatedCount, color: '#95d5b2', sub: 'remote high-value places' },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="tabs">
        {[
          { id: 'overview', label: '🌐 Network Overview' },
          { id: 'centrality', label: '📈 Centrality' },
          { id: 'communities', label: '🫧 Communities' },
          { id: 'bridges', label: '🌉 Bridges' },
          { id: 'gems', label: '🌿 Hidden Gems' },
          { id: 'graph', label: '🔗 Graph View' },
        ].map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="fade-in">
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="section-title" style={{ fontSize: '1rem' }}>
                Network Health Metrics
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <MetricBar label="Network Density" value={stats?.density} max={1} color="#e63946" />
                <MetricBar
                  label="Avg Degree / Max"
                  value={stats?.avgDegree}
                  max={stats?.maxDegree || 1}
                  color="#2a9d8f"
                />
                <MetricBar
                  label="Isolated Ratio"
                  value={(stats?.isolatedCount || 0) / (stats?.nodeCount || 1)}
                  max={1}
                  color="#95d5b2"
                />
                <MetricBar
                  label="Community Diversity"
                  value={stats?.communityCount}
                  max={20}
                  color="#e9c46a"
                />
              </div>
              <div className="note" style={{ marginTop: '1rem' }}>
                💡 Density of {((stats?.density || 0) * 100).toFixed(1)}% means the network is <strong>sparse</strong> -
                expected for a geographic tourism network where distance limits edges.
              </div>
            </div>

            <div className="card">
              <div className="section-title" style={{ fontSize: '1rem' }}>
                Degree vs Popularity (Scatter)
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis
                    dataKey="x"
                    name="Degree"
                    type="number"
                    tick={{ fontSize: 10, fill: '#8b949e' }}
                    label={{ value: 'Degree', position: 'bottom', fontSize: 10, fill: '#8b949e' }}
                  />
                  <YAxis dataKey="y" name="Pop Score" type="number" tick={{ fontSize: 10, fill: '#8b949e' }} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 11 }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div
                          style={{
                            background: '#161b22',
                            border: '1px solid #30363d',
                            borderRadius: 8,
                            padding: '0.5rem 0.75rem',
                            fontSize: 11,
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{d.name}</div>
                          <div style={{ color: '#8b949e' }}>
                            Degree: {d.x} · Score: {d.y?.toFixed(3)}
                          </div>
                          {d.isolated && <div style={{ color: '#95d5b2' }}>🌿 Remote gem</div>}
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData} name="Places">
                    {scatterData.map((d, i) => (
                      <Cell key={i} fill={d.isolated ? '#95d5b2' : CATEGORY_COLORS[d.category] || '#888'} opacity={0.8} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="note" style={{ marginTop: '0.5rem' }}>
                🟢 Green = isolated remote gems. High-left = valuable but remote.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title" style={{ fontSize: '1rem' }}>
              📐 What is Social Network Analysis in Tourism?
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1rem',
              }}
            >
              {Object.entries(METRIC_INFO).map(([key, info]) => (
                <div
                  key={key}
                  style={{ padding: '1rem', background: '#21262d', borderRadius: 8, borderLeft: `3px solid ${info.color}` }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: info.color }}>{info.label}</div>
                  <div style={{ fontSize: '0.8rem', color: '#8b949e', lineHeight: 1.5 }}>{info.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'centrality' && (
        <div className="fade-in">
          <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>Ranking by:</span>
            {Object.entries(METRIC_INFO).map(([key, info]) => (
              <button key={key} className={`chip ${metric === key ? 'active' : ''}`} onClick={() => setMetric(key)}>
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', background: info.color, display: 'inline-block' }}
                />
                {info.label}
              </button>
            ))}
          </div>

          <div className="note" style={{ marginBottom: '1.5rem' }}>
            📌 <strong>{METRIC_INFO[metric]?.label}:</strong> {METRIC_INFO[metric]?.desc}
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="section-title" style={{ fontSize: '1rem' }}>
                Top 15 Places
              </div>
              <div className="rank-list">
                {topByMetric.map((p, i) => (
                  <div key={p.place_id} className="rank-item">
                    <div className="rank-num">#{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div className="rank-name">{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
                        {p.taluk} · {p.category}
                        {p.is_isolated && ' 🌿'}
                      </div>
                    </div>
                    <div className="rank-bar">
                      <MetricBar
                        label=""
                        value={p[metric] || 0}
                        max={maxMetric}
                        color={METRIC_INFO[metric]?.color}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-title" style={{ fontSize: '1rem' }}>
                Top 10 Chart
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={topByMetric.slice(0, 10)} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#8b949e' }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fontSize: 9, fill: '#e6edf3' }}
                    tickFormatter={(v) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
                  />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 11 }} />
                  <Bar dataKey={metric} radius={[0, 4, 4, 0]} fill={METRIC_INFO[metric]?.color}>
                    {topByMetric.slice(0, 10).map((p, i) => (
                      <Cell key={i} fill={p.is_isolated ? '#95d5b2' : METRIC_INFO[metric]?.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="section-title" style={{ fontSize: '1rem' }}>
              🕸️ Multi-metric Radar (Top 5 by PageRank)
            </div>
            {(() => {
              const top5 = [...allMetrics].sort((a, b) => (b.pagerank || 0) - (a.pagerank || 0)).slice(0, 5);
              const radarData = [
                { metric: 'Degree', ...Object.fromEntries(top5.map((p) => [p.name?.slice(0, 12), p.degree_centrality || 0])) },
                { metric: 'Closeness', ...Object.fromEntries(top5.map((p) => [p.name?.slice(0, 12), p.closeness_centrality || 0])) },
                { metric: 'Betweenness', ...Object.fromEntries(top5.map((p) => [p.name?.slice(0, 12), p.betweenness_centrality || 0])) },
                { metric: 'PageRank', ...Object.fromEntries(top5.map((p) => [p.name?.slice(0, 12), p.pagerank || 0])) },
                { metric: 'Pop Score', ...Object.fromEntries(top5.map((p) => [p.name?.slice(0, 12), p.popularity_score || 0])) },
              ];

              return (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#30363d" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#8b949e' }} />
                    <PolarRadiusAxis tick={{ fontSize: 9, fill: '#8b949e' }} />
                    {top5.map((p, i) => (
                      <Radar
                        key={p.place_id}
                        name={p.name?.slice(0, 14)}
                        dataKey={p.name?.slice(0, 12)}
                        stroke={COMMUNITY_COLORS[i]}
                        fill={COMMUNITY_COLORS[i]}
                        fillOpacity={0.15}
                      />
                    ))}
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      )}

      {tab === 'communities' && (
        <div className="fade-in">
          <div className="note" style={{ marginBottom: '1.5rem' }}>
            🫧 <strong>Community Detection</strong> groups places that are tightly connected to each other.
            Places in the same community are ideal for multi-stop day trips.
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ flex: '0 0 auto' }}>
              <div className="stat-label">Communities Found</div>
              <div className="stat-value accent">{communities.length}</div>
            </div>
            <div className="stat-card" style={{ flex: '0 0 auto' }}>
              <div className="stat-label">Largest Community</div>
              <div className="stat-value" style={{ color: '#2a9d8f' }}>
                {communities[0]?.size} places
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {communities.slice(0, 8).map((comm, ci) => (
              <div
                key={comm.id}
                className="card"
                style={{ borderLeft: `4px solid ${COMMUNITY_COLORS[ci % COMMUNITY_COLORS.length]}` }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: COMMUNITY_COLORS[ci % COMMUNITY_COLORS.length] }}>
                    Community {ci + 1}
                  </div>
                  <div className="badge">{comm.size} places</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {comm.members.map((m) => (
                    <div
                      key={m.place_id}
                      style={{
                        padding: '0.3rem 0.7rem',
                        borderRadius: 20,
                        background: `${COMMUNITY_COLORS[ci % COMMUNITY_COLORS.length]}18`,
                        border: `1px solid ${COMMUNITY_COLORS[ci % COMMUNITY_COLORS.length]}40`,
                        fontSize: '0.8rem',
                      }}
                    >
                      {m.name}
                      {m.rating >= 4.5 && ' ⭐'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'bridges' && (
        <div className="fade-in">
          <div className="note" style={{ marginBottom: '1.5rem' }}>
            🌉 <strong>Bridge nodes</strong> are places with the highest betweenness centrality. They sit on many
            shortest paths between other places.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bridges.map((p, i) => (
              <div key={p.place_id} className="rank-item">
                <div className="rank-num">#{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div className="rank-name">{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>
                    {p.taluk} · {p.category} · ⭐ {p.rating?.toFixed(1)}
                  </div>
                </div>
                <MetricBar
                  label="Betweenness"
                  value={p.betweenness_centrality || 0}
                  max={bridges[0]?.betweenness_centrality || 1}
                  color="#f4a261"
                  width={200}
                />
                <MetricBar label="Degree" value={p.degree_centrality || 0} max={1} color="#e63946" width={140} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'gems' && (
        <div className="fade-in">
          <div className="note" style={{ marginBottom: '1.5rem' }}>
            🌿 <strong>Hidden Gems</strong> are places that are geographically isolated but still have high popularity
            scores.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {hiddenGems.map((p) => (
              <div key={p.place_id} className="card" style={{ borderColor: '#95d5b2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div className="isolated-banner">🌿 Remote Gem</div>
                  <div className="badge" style={{ marginLeft: 'auto' }}>
                    Degree: {p.degree}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#8b949e', marginBottom: '0.75rem' }}>
                  {p.taluk} · {p.category}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                  <MetricBar label="Popularity Score" value={p.popularity_score || 0} max={1} color="#95d5b2" />
                  <MetricBar label="Rating" value={p.rating || 0} max={5} color="#e9c46a" />
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#95d5b2', fontStyle: 'italic' }}>
                  High value · Low connectivity - worth the journey
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'graph' && (
        <div className="fade-in">
          <div className="note" style={{ marginBottom: '1rem' }}>
            🔗 Force-directed graph of all {stats?.nodeCount} tourist places. Node size tracks degree and green border
            marks remote gems.
          </div>
          {graph && <NetworkGraph nodes={graph.nodes} links={graph.links} />}
        </div>
      )}
    </div>
  );
}
