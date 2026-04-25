/**
 * routes/recommendations.js
 * Recommendation endpoints backed by the current graph schema + Neo4j GDS.
 */
const express = require('express');

const router = express.Router();
const { getSession } = require('../db');

const GRAPH_NAME = 'places_gds_graph';

function toNum(value) {
  if (value == null) return null;
  if (typeof value === 'object' && value.low !== undefined) return value.low;

  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function round(value, digits = 4) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function ensureMetric(metricsById, placeId) {
  if (!metricsById.has(placeId)) {
    metricsById.set(placeId, {
      degree: 0,
      degree_centrality: 0,
      closeness_centrality: 0,
      betweenness_centrality: 0,
      pagerank: 0,
      community: null,
      is_isolated: true,
    });
  }

  return metricsById.get(placeId);
}

async function ensureGdsProjection(session) {
  const existsResult = await session.run(
    'CALL gds.graph.exists($graphName) YIELD exists RETURN exists',
    { graphName: GRAPH_NAME }
  );

  const exists = Boolean(existsResult.records[0]?.get('exists'));

  if (!exists) {
    await session.run(
      `CALL gds.graph.project(
        $graphName,
        'Place',
        {
          CONNECTED_TO: {
            orientation: 'UNDIRECTED',
            properties: ['distance_km', 'weight_car', 'time_car']
          }
        }
      )
      YIELD graphName
      RETURN graphName`,
      { graphName: GRAPH_NAME }
    );
  }
}

async function getAnalyticsContext(session) {
  const metricsById = new Map();
  let usedGds = true;

  try {
    await ensureGdsProjection(session);

    const degreeResult = await session.run(
      `CALL gds.degree.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score`,
      { graphName: GRAPH_NAME }
    );

    for (const record of degreeResult.records) {
      const placeId = record.get('place_id');
      const score = toNum(record.get('score')) || 0;
      const metric = ensureMetric(metricsById, placeId);
      metric.degree = Math.round(score);
      metric.degree_centrality = round(score, 6);
      metric.is_isolated = score === 0;
    }

    const closenessResult = await session.run(
      `CALL gds.closeness.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score`,
      { graphName: GRAPH_NAME }
    );

    for (const record of closenessResult.records) {
      const metric = ensureMetric(metricsById, record.get('place_id'));
      metric.closeness_centrality = round(toNum(record.get('score')) || 0, 6);
    }

    const betweennessResult = await session.run(
      `CALL gds.betweenness.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score`,
      { graphName: GRAPH_NAME }
    );

    for (const record of betweennessResult.records) {
      const metric = ensureMetric(metricsById, record.get('place_id'));
      metric.betweenness_centrality = round(toNum(record.get('score')) || 0, 6);
    }

    const pageRankResult = await session.run(
      `CALL gds.pageRank.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score`,
      { graphName: GRAPH_NAME }
    );

    for (const record of pageRankResult.records) {
      const metric = ensureMetric(metricsById, record.get('place_id'));
      metric.pagerank = round(toNum(record.get('score')) || 0, 6);
    }

    const communityResult = await session.run(
      `CALL gds.louvain.stream($graphName)
       YIELD nodeId, communityId
       RETURN gds.util.asNode(nodeId).place_id AS place_id, communityId`,
      { graphName: GRAPH_NAME }
    );

    for (const record of communityResult.records) {
      const metric = ensureMetric(metricsById, record.get('place_id'));
      metric.community = toNum(record.get('communityId'));
    }
  } catch (err) {
    if (!String(err.message || '').includes('gds.')) {
      throw err;
    }
    usedGds = false;
    const fallbackDegreeResult = await session.run(
      `MATCH (p:Place)
       OPTIONAL MATCH (p)-[r:CONNECTED_TO]-()
       RETURN p.place_id AS place_id, count(r) AS degree
       ORDER BY degree DESC`
    );

    for (const record of fallbackDegreeResult.records) {
      const placeId = record.get('place_id');
      const degree = toNum(record.get('degree')) || 0;
      const metric = ensureMetric(metricsById, placeId);
      metric.degree = degree;
      metric.degree_centrality = degree;
      metric.closeness_centrality = 0;
      metric.betweenness_centrality = 0;
      metric.pagerank = 0;
      metric.community = null;
      metric.is_isolated = degree === 0;
    }
  }

  const globalResult = await session.run(
    `MATCH (p:Place)
     RETURN
       max(coalesce(p.popularity, 0)) AS maxPopularity,
       max(coalesce(p.rating, 0.0)) AS maxRating`
  );

  const globalRecord = globalResult.records[0];
  let maxDegree = 0;
  let maxPageRank = 0;

  for (const metric of metricsById.values()) {
    maxDegree = Math.max(maxDegree, metric.degree || 0);
    maxPageRank = Math.max(maxPageRank, metric.pagerank || 0);
  }

  return {
    metricsById,
    usedGds,
    globalStats: {
      maxPopularity: toNum(globalRecord.get('maxPopularity')) || 1,
      maxRating: toNum(globalRecord.get('maxRating')) || 1,
      maxDegree: maxDegree || 1,
      maxPageRank: maxPageRank || 1,
    },
  };
}

function computePopularityScore(props, metric, globalStats) {
  const popularity = toNum(props.popularity) || 0;
  const rating = toNum(props.rating) || 0;
  const degree = metric.degree || 0;
  const pagerank = metric.pagerank || 0;

  return round(
    (popularity / globalStats.maxPopularity) * 0.35 +
      (rating / globalStats.maxRating) * 0.2 +
      (degree / globalStats.maxDegree) * 0.2 +
      (pagerank / globalStats.maxPageRank) * 0.25,
    6
  );
}

function formatPlace(node, analyticsContext) {
  const props = node.properties || {};
  const metric = analyticsContext.metricsById.get(props.place_id) || {
    degree: 0,
    degree_centrality: 0,
    closeness_centrality: 0,
    betweenness_centrality: 0,
    pagerank: 0,
    community: null,
    is_isolated: true,
  };

  return {
    place_id: props.place_id,
    name: props.name,
    taluk: props.taluk,
    category: props.category,
    rating: toNum(props.rating),
    popularity: toNum(props.popularity),
    photo_url: props.photo_url,
    description: props.description,
    latitude: toNum(props.latitude),
    longitude: toNum(props.longitude),
    degree: metric.degree,
    pagerank: metric.pagerank,
    closeness_centrality: metric.closeness_centrality,
    betweenness_centrality: metric.betweenness_centrality,
    popularity_score: computePopularityScore(props, metric, analyticsContext.globalStats),
    is_isolated: metric.is_isolated,
    community: metric.community,
    source: props.source,
  };
}

function sortByScore(items, key = 'score') {
  return [...items].sort((a, b) => {
    if ((b[key] || 0) !== (a[key] || 0)) return (b[key] || 0) - (a[key] || 0);
    return (a.name || '').localeCompare(b.name || '');
  });
}

function buildReason(place, categories, taluk) {
  const parts = [];

  if (categories && categories.includes(place.category)) {
    parts.push(`Matches your interest in ${place.category}`);
  }
  if (taluk && place.taluk === taluk) {
    parts.push(`Located in ${taluk}`);
  }
  if (place.is_isolated) {
    parts.push('Remote gem with a more dedicated travel profile');
  }
  if ((place.rating || 0) >= 4.5) {
    parts.push(`Highly rated (${place.rating})`);
  }
  if ((place.pagerank || 0) > 0.05) {
    parts.push('Important place in the tourism network');
  }

  return parts.join(' | ') || 'Strong overall match for the district network';
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function withAnalytics(handler, res) {
  const session = getSession();
  try {
    const analyticsContext = await getAnalyticsContext(session);
    await handler(session, analyticsContext);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      note: 'This route expects the Neo4j Graph Data Science library to be installed and available.',
    });
  } finally {
    await session.close();
  }
}

/**
 * POST /api/recommendations/personalized
 */
router.post('/personalized', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const {
      categories = [],
      taluk = null,
      mode = 'car',
      maxDistance = 50,
      includeIsolated = true,
      limit = 12,
    } = req.body || {};

    const modeWeightField = {
      car: 'weight_car',
      bus: 'weight_bus',
      '2w': 'weight_2w',
      cycle: 'weight_cycle',
      walk: 'weight_walk',
    }[mode] || 'weight_car';

    const result = await session.run('MATCH (p:Place) RETURN p');
    const places = result.records.map((record) => formatPlace(record.get('p'), analyticsContext));

    const filtered = places.filter((place) => {
      if (categories.length > 0 && !categories.includes(place.category)) return false;
      if (taluk && place.taluk !== taluk) return false;
      if (!includeIsolated && place.is_isolated) return false;
      return true;
    });

    const routeStatsResult = await session.run(
      `MATCH ()-[r:CONNECTED_TO]->()
       WHERE r.distance_km <= $maxDistance
       RETURN
         avg(coalesce(r.${modeWeightField}, 0.0)) AS avgWeight,
         avg(coalesce(r.distance_km, 0.0)) AS avgDistance`,
      { maxDistance: Number(maxDistance) }
    );

    const routeStats = routeStatsResult.records[0];
    const routeBoost = round((toNum(routeStats.get('avgWeight')) || 0) * 0.15, 6);
    const distanceBias = toNum(routeStats.get('avgDistance')) || 0;

    const recommendations = sortByScore(
      filtered.map((place) => {
        const score = round(
          (place.popularity_score || 0) * 0.55 +
            (place.pagerank || 0) * 0.2 +
            (place.closeness_centrality || 0) * 0.1 +
            ((categories.includes(place.category) ? 1 : 0) * 0.1) +
            ((taluk && place.taluk === taluk ? 1 : 0) * 0.05) +
            routeBoost,
          6
        );

        return {
          ...place,
          score,
          travel_mode: mode,
          planning_hint:
            distanceBias > 0 && distanceBias <= maxDistance
              ? `Fits typical ${mode} travel patterns in this network`
              : `Better as a longer ${mode} trip`,
          reason: buildReason(place, categories, taluk),
        };
      })
    ).slice(0, Math.max(1, Number(limit) || 12));

    let isolatedHighlights = [];
    if (!includeIsolated && recommendations.length < limit) {
      isolatedHighlights = sortByScore(
        places
          .filter((place) => place.is_isolated)
          .map((place) => ({
            ...place,
            score: round(place.popularity_score || 0, 6),
            reason: 'Standalone high-value destination for a dedicated trip',
            highlight: true,
          })),
        'score'
      ).slice(0, 3);
    }

    res.json({
      recommendations,
      isolatedHighlights,
      totalFound: recommendations.length,
    });
  }, res);
});

/**
 * GET /api/recommendations/similar/:placeId
 */
router.get('/similar/:placeId', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const result = await session.run('MATCH (p:Place) RETURN p');
    const places = result.records.map((record) => formatPlace(record.get('p'), analyticsContext));
    const basePlace = places.find((place) => place.place_id === req.params.placeId);

    if (!basePlace) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const similar = sortByScore(
      places
        .filter((place) => place.place_id !== req.params.placeId)
        .map((place) => {
          const sameCommunity = place.community != null && place.community === basePlace.community ? 0.4 : 0;
          const sameCategory = place.category === basePlace.category ? 0.3 : 0;
          const sameTaluk = place.taluk === basePlace.taluk ? 0.1 : 0;
          const score = round(
            sameCommunity +
              sameCategory +
              sameTaluk +
              (place.pagerank || 0) * 0.15 +
              (place.popularity_score || 0) * 0.05,
            6
          );

          return {
            ...place,
            score,
          };
        })
        .filter((place) => place.score > 0)
    ).slice(0, 8);

    res.json(similar);
  }, res);
});

/**
 * GET /api/recommendations/nearby/:placeId?maxDist=20
 */
router.get('/nearby/:placeId', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const maxDist = Number(req.query.maxDist || 30);
    const placeResult = await session.run(
      'MATCH (p:Place {place_id: $id}) RETURN p',
      { id: req.params.placeId }
    );

    if (!placeResult.records.length) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const basePlace = formatPlace(placeResult.records[0].get('p'), analyticsContext);

    const connectedResult = await session.run(
      `MATCH (p:Place {place_id: $id})-[r:CONNECTED_TO]-(n:Place)
       WHERE coalesce(r.distance_km, 999999) <= $maxDist
       RETURN n, r
       ORDER BY coalesce(r.distance_km, 999999) ASC`,
      { id: req.params.placeId, maxDist }
    );

    const connected = connectedResult.records.map((record) => {
      const neighbour = formatPlace(record.get('n'), analyticsContext);
      const rel = record.get('r').properties || {};

      return {
        ...neighbour,
        distance_km: toNum(rel.distance_km),
        time_car: toNum(rel.time_car),
        time_bus: toNum(rel.time_bus),
        time_2w: toNum(rel.time_2w),
        time_cycle: toNum(rel.time_cycle),
        strength: rel.strength || null,
        connection: 'graph',
      };
    });

    const allPlacesResult = await session.run('MATCH (p:Place) RETURN p');
    const nearbyIsolated = allPlacesResult.records
      .map((record) => formatPlace(record.get('p'), analyticsContext))
      .filter((place) => place.is_isolated && place.place_id !== req.params.placeId)
      .map((place) => ({
        ...place,
        distance_km: round(
          haversineKm(basePlace.latitude, basePlace.longitude, place.latitude, place.longitude),
          1
        ),
        connection: 'proximity',
        note: 'Remote attraction suited to a dedicated side trip',
      }))
      .filter((place) => (place.distance_km || 0) <= maxDist)
      .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));

    res.json({ connected, nearbyIsolated });
  }, res);
});

/**
 * POST /api/recommendations/itinerary
 */
router.post('/itinerary', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const { taluks = [], days = 2, categories = [], mode = 'car' } = req.body || {};
    const dayCount = Math.max(1, Number(days) || 2);

    const result = await session.run('MATCH (p:Place) RETURN p');
    const candidates = sortByScore(
      result.records
        .map((record) => formatPlace(record.get('p'), analyticsContext))
        .filter((place) => (taluks.length ? taluks.includes(place.taluk) : true))
        .filter((place) => (categories.length ? categories.includes(place.category) : true))
        .map((place) => ({
          ...place,
          score: round(
            (place.popularity_score || 0) * 0.6 +
              (place.pagerank || 0) * 0.2 +
              (place.closeness_centrality || 0) * 0.2,
            6
          ),
        })),
      'score'
    ).slice(0, 40);

    const communityBuckets = new Map();
    for (const place of candidates) {
      const key = place.community == null ? `isolated:${place.place_id}` : `community:${place.community}`;
      if (!communityBuckets.has(key)) {
        communityBuckets.set(key, []);
      }
      communityBuckets.get(key).push(place);
    }

    const bucketList = [...communityBuckets.values()].sort(
      (a, b) => (b[0]?.score || 0) - (a[0]?.score || 0)
    );

    const itinerary = Array.from({ length: dayCount }, (_, index) => ({
      day: index + 1,
      mode,
      places: [],
    }));

    let cursor = 0;
    for (const bucket of bucketList) {
      itinerary[cursor].places.push(...bucket.slice(0, 4));
      cursor = (cursor + 1) % dayCount;
    }

    const cleanedItinerary = itinerary.map((dayPlan) => ({
      ...dayPlan,
      places: sortByScore(
        dayPlan.places.filter(
          (place, index, list) => list.findIndex((item) => item.place_id === place.place_id) === index
        ),
        'score'
      ).slice(0, Math.max(3, Math.ceil(candidates.length / dayCount) || 3)),
    }));

    const isolatedGems = sortByScore(
      candidates
        .filter((place) => place.is_isolated && (place.popularity_score || 0) >= 0.35)
        .map((place) => ({ ...place, score: place.popularity_score })),
      'score'
    ).slice(0, 3);

    res.json({
      itinerary: cleanedItinerary,
      isolatedGems,
      totalDays: dayCount,
    });
  }, res);
});

/**
 * GET /api/recommendations/top-by-taluk
 */
router.get('/top-by-taluk', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const result = await session.run('MATCH (p:Place) RETURN p');
    const places = result.records.map((record) => formatPlace(record.get('p'), analyticsContext));
    const byTaluk = {};

    for (const place of sortByScore(
      places.map((place) => ({ ...place, score: place.popularity_score })),
      'score'
    )) {
      const taluk = place.taluk || 'Unknown';
      if (!byTaluk[taluk]) {
        byTaluk[taluk] = [];
      }
      if (byTaluk[taluk].length < 3) {
        byTaluk[taluk].push(place);
      }
    }

    res.json(byTaluk);
  }, res);
});

/**
 * GET /api/recommendations/shortest-path?source=...&target=...&mode=car
 * Uses Dijkstra's algorithm with weighted edges (distance_km or travel time)
 */
router.get('/shortest-path', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const { source, target, mode = 'car' } = req.query;

    if (!source || !target) {
      res.status(400).json({ error: 'source and target are required' });
      return;
    }

    const weightProperty = {
      car: 'weight_car',
      bus: 'weight_bus',
      '2w': 'weight_2w',
      cycle: 'weight_cycle',
      walk: 'weight_walk',
    }[mode] || 'weight_car';

    // Use Dijkstra to find shortest weighted path
    const pathResult = await session.run(
      `CALL gds.shortestPath.dijkstra.stream(
        $graphName,
        {
          sourceNode: {plane_id: $source},
          targetNode: {place_id: $target},
          relationshipWeightProperty: $weightProperty
        }
      )
      YIELD path, cost
      RETURN path, cost`,
      {
        graphName: GRAPH_NAME,
        source,
        target,
        weightProperty,
      }
    );

    if (!pathResult.records.length) {
      res.status(404).json({ error: 'No path found between source and target' });
      return;
    }

    const record = pathResult.records[0];
    const path = record.get('path');
    const cost = toNum(record.get('cost'));

    // Extract node details from path
    const nodes = path.map((node) => {
      const props = node.properties || {};
      return {
        place_id: props.place_id,
        name: props.name,
        taluk: props.taluk,
        category: props.category,
      };
    });

    // Calculate total distance and time from edges
    let totalDistance = 0;
    let totalTime = 0;

    const edgeQuery = await session.run(
      `MATCH (start:Place {place_id: $source}), (end:Place {place_id: $target})
       MATCH path = shortestPath((start)-[:CONNECTED_TO*]-(end))
       UNWIND relationships(path) AS rel
       RETURN
         sum(coalesce(rel.distance_km, 0)) AS totalDist,
         sum(coalesce(rel.${`time_${mode === '2w' ? '2w' : mode}`}, 0)) AS totalTravelTime`,
      { source, target }
    );

    if (edgeQuery.records.length > 0) {
      const edgeRecord = edgeQuery.records[0];
      totalDistance = toNum(edgeRecord.get('totalDist')) || 0;
      totalTime = toNum(edgeRecord.get('totalTravelTime')) || 0;
    }

    res.json({
      path: nodes,
      hops: nodes.length - 1,
      totalDistance: round(totalDistance, 1),
      totalTime: round(totalTime, 2),
      travelMode: mode,
      cost: round(cost, 6),
    });
  }, res);
});

module.exports = router;
