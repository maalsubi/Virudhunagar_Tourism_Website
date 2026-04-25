import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { recommendAPI } from '../utils/api';
import { CATEGORIES, TALUKS, CATEGORY_ICONS, TALUK_COLORS } from '../utils/constants';
import PlaceCard from '../components/PlaceCard';
import Loader from '../components/Loader';

const TRANSPORT_MODES = [
  { key: 'car', label: '🚗 Car', desc: 'Fastest, most flexible' },
  { key: 'bus', label: '🚌 Bus', desc: 'Affordable, well-connected routes' },
  { key: '2w', label: '🛵 Bike', desc: 'Best for exploring narrow roads' },
];

export default function Recommendations() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('explore');
  const [selectedCats, setSelectedCats] = useState([]);
  const [selectedTaluk, setSelectedTaluk] = useState(searchParams.get('taluk') || '');
  const [transport, setTransport] = useState('car');
  const [maxDist, setMaxDist] = useState(40);
  const [includeIso, setIncludeIso] = useState(true);
  const [results, setResults] = useState(null);
  const [isoGems, setIsoGems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [itiTaluks, setItiTaluks] = useState([]);
  const [itiCats, setItiCats] = useState([]);
  const [itiDays, setItiDays] = useState(2);
  const [itinerary, setItinerary] = useState(null);
  const [itiGems, setItiGems] = useState([]);
  const [itiLoading, setItiLoading] = useState(false);

  const toggleCat = (c) => setSelectedCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const toggleItiCat = (c) => setItiCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const toggleItiTaluk = (t) => setItiTaluks((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  useEffect(() => {
    if (searchParams.get('taluk')) {
      setSelectedTaluk(searchParams.get('taluk'));
      handleSearch([], searchParams.get('taluk'));
    }
  }, []);

  const handleSearch = async (cats, taluk) => {
    const c = cats !== undefined ? cats : selectedCats;
    const t = taluk !== undefined ? taluk : selectedTaluk;
    setLoading(true);
    setResults(null);

    try {
      const res = await recommendAPI.getPersonalized({
        categories: c,
        taluk: t || null,
        mode: transport,
        maxDistance: maxDist,
        includeIsolated: includeIso,
        limit: 15,
      });
      setResults(res.data.recommendations);
      setIsoGems(res.data.isolatedHighlights || []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItinerary = async () => {
    setItiLoading(true);
    setItinerary(null);

    try {
      const res = await recommendAPI.getItinerary({
        taluks: itiTaluks,
        days: itiDays,
        categories: itiCats,
        mode: transport,
      });
      setItinerary(res.data.itinerary);
      setItiGems(res.data.isolatedGems || []);
    } catch (e) {
      setItinerary([]);
    } finally {
      setItiLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">
          🧭 <span className="teal">Personalised</span> Recommendations
        </h1>
        <p className="page-subtitle">
          Discover your perfect Virudhunagar itinerary based on your preferences
        </p>
      </div>

      <div className="tabs" style={{ marginBottom: '2rem' }}>
        <button className={`tab ${tab === 'explore' ? 'active' : ''}`} onClick={() => setTab('explore')}>
          🔍 Explore Places
        </button>
        <button className={`tab ${tab === 'itinerary' ? 'active' : ''}`} onClick={() => setTab('itinerary')}>
          📅 Build Itinerary
        </button>
      </div>

      {tab === 'explore' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: '1.75rem' }}>
            <div className="grid-2" style={{ gap: '2rem' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🎯 What interests you?</div>
                <div className="tag-group">
                  {CATEGORIES.map((c) => (
                    <button key={c} className={`chip ${selectedCats.includes(c) ? 'active' : ''}`} onClick={() => toggleCat(c)}>
                      {CATEGORY_ICONS[c]} {c}
                    </button>
                  ))}
                </div>

                <div style={{ fontWeight: 700, marginBottom: '0.75rem', marginTop: '1.5rem' }}>🏘️ Preferred Taluk</div>
                <select className="select" value={selectedTaluk} onChange={(e) => setSelectedTaluk(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Any Taluk</option>
                  {TALUKS.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🚗 How will you travel?</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  {TRANSPORT_MODES.map((m) => (
                    <button key={m.key} className={`chip ${transport === m.key ? 'active' : ''}`} onClick={() => setTransport(m.key)}>
                      {m.label}
                    </button>
                  ))}
                </div>

                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>📏 Max Distance: {maxDist} km</div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  value={maxDist}
                  onChange={(e) => setMaxDist(+e.target.value)}
                  style={{ width: '100%', accentColor: '#2a9d8f', marginBottom: '1.5rem' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeIso}
                      onChange={(e) => setIncludeIso(e.target.checked)}
                      style={{ accentColor: '#95d5b2', width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: '0.9rem' }}>🌿 Include remote gems (waterfalls, sanctuaries)</span>
                  </label>
                </div>

                <button className="btn btn-teal" style={{ width: '100%' }} onClick={() => handleSearch()}>
                  🔍 Find Recommendations
                </button>
              </div>
            </div>
          </div>

          {loading && <Loader text="Finding the best places for you..." />}

          {results && !loading && (
            <div className="fade-in">
              <div className="section-title">
                ✨ {results.length} Recommendations
                {selectedCats.length > 0 && ` for ${selectedCats.join(', ')}`}
                {selectedTaluk && ` in ${selectedTaluk}`}
              </div>

              {results.length === 0 && (
                <div className="note">No places match your current filters. Try widening your selection.</div>
              )}

              <div className="grid-auto">
                {results.map((p) => (
                  <PlaceCard key={p.place_id} place={p} score={p.score} reason={p.reason} />
                ))}
              </div>

              {isoGems.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <div className="section-title">🌿 Remote Gems Worth the Journey</div>
                  <div className="note" style={{ marginBottom: '1rem' }}>
                    These places are geographically isolated from the main network but are highly rated.
                  </div>
                  <div className="grid-auto">
                    {isoGems.map((p) => (
                      <PlaceCard key={p.place_id} place={p} reason={p.reason} highlight />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'itinerary' && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: '1.75rem' }}>
            <div className="grid-2" style={{ gap: '2rem' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>📅 Trip Duration</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {[1, 2, 3].map((d) => (
                    <button key={d} className={`chip ${itiDays === d ? 'active' : ''}`} onClick={() => setItiDays(d)}>
                      {d} Day{d > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>

                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🏘️ Which Taluks? (multi-select)</div>
                <div className="tag-group">
                  {TALUKS.map((t) => (
                    <button
                      key={t.name}
                      className={`chip ${itiTaluks.includes(t.name) ? 'active' : ''}`}
                      style={
                        itiTaluks.includes(t.name)
                          ? {
                              borderColor: TALUK_COLORS[t.name],
                              background: `${TALUK_COLORS[t.name]}18`,
                              color: TALUK_COLORS[t.name],
                            }
                          : {}
                      }
                      onClick={() => toggleItiTaluk(t.name)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🎯 Categories of Interest</div>
                <div className="tag-group" style={{ marginBottom: '1.5rem' }}>
                  {CATEGORIES.map((c) => (
                    <button key={c} className={`chip ${itiCats.includes(c) ? 'active' : ''}`} onClick={() => toggleItiCat(c)}>
                      {CATEGORY_ICONS[c]} {c}
                    </button>
                  ))}
                </div>

                <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>🚗 Transport</div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  {TRANSPORT_MODES.map((m) => (
                    <button key={m.key} className={`chip ${transport === m.key ? 'active' : ''}`} onClick={() => setTransport(m.key)}>
                      {m.label}
                    </button>
                  ))}
                </div>

                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleItinerary}>
                  📅 Generate Itinerary
                </button>
              </div>
            </div>
          </div>

          {itiLoading && <Loader text="Building your itinerary..." />}

          {itinerary && !itiLoading && (
            <div className="fade-in">
              <div className="section-title">📅 Your {itiDays}-Day Itinerary</div>

              {itinerary.map((day) => (
                <div key={day.day} style={{ marginBottom: '2rem' }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      padding: '0.6rem 1rem',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #e63946, #f4a261)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                    }}
                  >
                    Day {day.day}
                  </div>

                  <div className="grid-auto">
                    {day.places.map((p, idx) => (
                      <div key={p.place_id} style={{ position: 'relative' }}>
                        <div
                          style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            zIndex: 2,
                            background: '#e63946',
                            color: '#fff',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <PlaceCard place={p} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {itiGems.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="section-title">🌿 Special Remote Stops to Consider</div>
                  <div className="note" style={{ marginBottom: '1rem' }}>
                    These gems are off the main network but highly rated - consider adding a dedicated half-day for them.
                  </div>
                  <div className="grid-3">
                    {itiGems.map((p) => (
                      <PlaceCard key={p.place_id} place={p} highlight />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
