import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_ICONS, CATEGORY_COLORS, TALUK_COLORS } from '../utils/constants';

export default function PlaceCard({ place, score, reason, highlight }) {
  const nav = useNavigate();
  const [imgErr, setImgErr] = useState(false);
  const icon = CATEGORY_ICONS[place.category] || '📍';
  const color = CATEGORY_COLORS[place.category] || '#888';
  const talukColor = TALUK_COLORS[place.taluk] || '#888';

  return (
    <div
      className={`place-card fade-in ${highlight ? 'highlight-card' : ''}`}
      onClick={() => nav(`/place/${place.place_id}`)}
      style={{ borderColor: highlight ? '#95d5b2' : undefined }}
    >
      {place.photo_url && !imgErr ? (
        <img
          src={place.photo_url}
          alt={place.name}
          className="place-card-img"
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className="place-card-img-placeholder">{icon}</div>
      )}

      <div className="place-card-body">
        {place.is_isolated && (
          <div className="isolated-banner" style={{ marginBottom: '0.5rem' }}>
            🌿 Remote Gem
          </div>
        )}

        <div className="place-card-name">{place.name}</div>

        <div className="place-card-meta" style={{ marginTop: '0.4rem' }}>
          <span className="badge" style={{ background: `${color}22`, color }}>
            {icon} {place.category}
          </span>
          <span className="badge" style={{ background: `${talukColor}22`, color: talukColor }}>
            {place.taluk}
          </span>
        </div>

        {reason && (
          <div style={{ fontSize: '0.75rem', color: '#8b949e', marginTop: '0.4rem', lineHeight: 1.4 }}>
            {reason}
          </div>
        )}

        <div className="place-card-stats">
          <div className="place-stat">
            ⭐ <span>{place.rating?.toFixed ? place.rating.toFixed(1) : place.rating || 'N/A'}</span>
          </div>
          <div className="place-stat">
            👥 <span>{place.popularity || 0}</span> reviews
          </div>
          <div className="place-stat">
            🔗 <span>{place.degree || 0}</span> links
          </div>
          {score !== undefined && (
            <div className="place-stat">
              🎯 <span>{(score * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
