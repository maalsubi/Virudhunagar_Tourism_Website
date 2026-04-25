/**
 * routes/places.js
 * General place queries: overview, by taluk, by category, detail
 *
 * This version matches the current starterDBLoad.js schema:
 * - Place node properties are loaded directly from places_cleaned_new.json
 * - CONNECTED_TO relationships store edge properties
 * - Centrality/community metrics are computed live with Neo4j GDS
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

function buildAnalyticsMap() {
  return new Map();
}

function upsertAnalytics(metricsById, placeId) {
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

async function fetchGraphAnalytics(session) {
  const metricsById = buildAnalyticsMap();
  let usedGds = true;

  try {
    await ensureGdsProjection(session);

    const degreeResult = await session.run(
      `CALL gds.degree.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score
       ORDER BY score DESC`,
      { graphName: GRAPH_NAME }
    );

    for (const record of degreeResult.records) {
      const placeId = record.get('place_id');
      const score = toNum(record.get('score')) || 0;
      const analytics = upsertAnalytics(metricsById, placeId);
      analytics.degree = Math.round(score);
      analytics.degree_centrality = round(score, 4);
      analytics.is_isolated = score === 0;
    }

    const closenessResult = await session.run(
      `CALL gds.closeness.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score`,
      { graphName: GRAPH_NAME }
    );

    for (const record of closenessResult.records) {
      const placeId = record.get('place_id');
      const analytics = upsertAnalytics(metricsById, placeId);
      analytics.closeness_centrality = round(toNum(record.get('score')) || 0, 6);
    }

    const betweennessResult = await session.run(
      `CALL gds.betweenness.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score`,
      { graphName: GRAPH_NAME }
    );

    for (const record of betweennessResult.records) {
      const placeId = record.get('place_id');
      const analytics = upsertAnalytics(metricsById, placeId);
      analytics.betweenness_centrality = round(toNum(record.get('score')) || 0, 6);
    }

    const pageRankResult = await session.run(
      `CALL gds.pageRank.stream($graphName)
       YIELD nodeId, score
       RETURN gds.util.asNode(nodeId).place_id AS place_id, score`,
      { graphName: GRAPH_NAME }
    );

    for (const record of pageRankResult.records) {
      const placeId = record.get('place_id');
      const analytics = upsertAnalytics(metricsById, placeId);
      analytics.pagerank = round(toNum(record.get('score')) || 0, 6);
    }

    const communityResult = await session.run(
      `CALL gds.louvain.stream($graphName)
       YIELD nodeId, communityId
       RETURN gds.util.asNode(nodeId).place_id AS place_id, communityId`,
      { graphName: GRAPH_NAME }
    );

    for (const record of communityResult.records) {
      const placeId = record.get('place_id');
      const analytics = upsertAnalytics(metricsById, placeId);
      analytics.community = toNum(record.get('communityId'));
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
      const analytics = upsertAnalytics(metricsById, placeId);
      analytics.degree = degree;
      analytics.degree_centrality = degree;
      analytics.closeness_centrality = 0;
      analytics.betweenness_centrality = 0;
      analytics.pagerank = 0;
      analytics.community = null;
      analytics.is_isolated = degree === 0;
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

  for (const analytics of metricsById.values()) {
    maxDegree = Math.max(maxDegree, analytics.degree || 0);
    maxPageRank = Math.max(maxPageRank, analytics.pagerank || 0);
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

function computePopularityScore(props, analytics, globalStats) {
  const popularity = toNum(props.popularity) || 0;
  const rating = toNum(props.rating) || 0;
  const degree = analytics.degree || 0;
  const pagerank = analytics.pagerank || 0;

  const popularityPart = popularity / globalStats.maxPopularity;
  const ratingPart = rating / globalStats.maxRating;
  const degreePart = degree / globalStats.maxDegree;
  const pageRankPart = pagerank / globalStats.maxPageRank;

  return round(
    popularityPart * 0.35 +
      ratingPart * 0.2 +
      degreePart * 0.2 +
      pageRankPart * 0.25,
    6
  );
}

function formatPlaceNode(node, analyticsContext) {
  const props = node.properties || {};
  const analytics = analyticsContext.metricsById.get(props.place_id) || {
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
    latitude: toNum(props.latitude),
    longitude: toNum(props.longitude),
    address: props.address,
    rating: toNum(props.rating),
    popularity: toNum(props.popularity),
    photo_url: props.photo_url,
    description: props.description,
    source: props.source,
    degree: analytics.degree,
    degree_centrality: analytics.degree_centrality,
    closeness_centrality: analytics.closeness_centrality,
    betweenness_centrality: analytics.betweenness_centrality,
    pagerank: analytics.pagerank,
    community: analytics.community,
    popularity_score: computePopularityScore(props, analytics, analyticsContext.globalStats),
    is_isolated: analytics.is_isolated,
  };
}

function sortPlacesByScore(places) {
  return places.sort((a, b) => {
    if ((b.popularity_score || 0) !== (a.popularity_score || 0)) {
      return (b.popularity_score || 0) - (a.popularity_score || 0);
    }
    if ((b.popularity || 0) !== (a.popularity || 0)) {
      return (b.popularity || 0) - (a.popularity || 0);
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

async function runWithAnalytics(handler, res) {
  const session = getSession();
  try {
    const analyticsContext = await fetchGraphAnalytics(session);
    await handler(session, analyticsContext);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      note: 'This route expects the Neo4j Graph Data Science library to be available.',
    });
  } finally {
    await session.close();
  }
}

// GET /api/places  - all places
router.get('/', async (req, res) => {
  await runWithAnalytics(async (session, analyticsContext) => {
    const result = await session.run('MATCH (p:Place) RETURN p');
    const places = sortPlacesByScore(
      result.records.map((record) => formatPlaceNode(record.get('p'), analyticsContext))
    );

    res.json(places);
  }, res);
});

// GET /api/places/overview - district summary stats
router.get('/overview', async (req, res) => {
  await runWithAnalytics(async (session, analyticsContext) => {
    const placeResult = await session.run('MATCH (p:Place) RETURN p');
    const relationResult = await session.run('MATCH ()-[r:CONNECTED_TO]->() RETURN count(r) AS totalEdges');

    const places = sortPlacesByScore(
      placeResult.records.map((record) => formatPlaceNode(record.get('p'), analyticsContext))
    );

    const total = places.length;
    const totalEdges = toNum(relationResult.records[0].get('totalEdges')) || 0;
    const avgRating =
      total === 0
        ? 0
        : round(
            places.reduce((sum, place) => sum + (place.rating || 0), 0) / total,
            2
          );
    const totalPop = places.reduce((sum, place) => sum + (place.popularity || 0), 0);

    const byCategory = Object.values(
      places.reduce((acc, place) => {
        const key = place.category || 'Unknown';
        if (!acc[key]) acc[key] = { category: key, count: 0 };
        acc[key].count += 1;
        return acc;
      }, {})
    ).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    const byTaluk = Object.values(
      places.reduce((acc, place) => {
        const key = place.taluk || 'Unknown';
        if (!acc[key]) {
          acc[key] = {
            taluk: key,
            total: 0,
            ratingSum: 0,
            categories: new Set(),
          };
        }

        acc[key].total += 1;
        acc[key].ratingSum += place.rating || 0;
        acc[key].categories.add(place.category || 'Unknown');
        return acc;
      }, {})
    )
      .map((entry) => ({
        taluk: entry.taluk,
        total: entry.total,
        avgRating: round(entry.ratingSum / entry.total, 2),
        categories: [...entry.categories].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => b.total - a.total || a.taluk.localeCompare(b.taluk));

    const centralitySummary = {
      topByDegree: [...places]
        .sort((a, b) => (b.degree || 0) - (a.degree || 0))
        .slice(0, 6),
      topByPageRank: [...places]
        .sort((a, b) => (b.pagerank || 0) - (a.pagerank || 0))
        .slice(0, 6),
      topByBetweenness: [...places]
        .sort((a, b) => (b.betweenness_centrality || 0) - (a.betweenness_centrality || 0))
        .slice(0, 6),
      isolatedPlaces: places.filter((place) => place.is_isolated).length,
    };

    res.json({
      total,
      totalEdges,
      avgRating,
      totalPop,
      byCategory,
      byTaluk,
      topPlaces: places.slice(0, 6),
      centralitySummary,
    });
  }, res);
});

// GET /api/places/taluk/:taluk - places in a taluk
router.get('/taluk/:taluk', async (req, res) => {
  await runWithAnalytics(async (session, analyticsContext) => {
    const result = await session.run(
      'MATCH (p:Place {taluk: $taluk}) RETURN p',
      { taluk: req.params.taluk }
    );

    const places = sortPlacesByScore(
      result.records.map((record) => formatPlaceNode(record.get('p'), analyticsContext))
    );

    res.json(places);
  }, res);
});

// GET /api/places/category/:category - places in a category
router.get('/category/:category', async (req, res) => {
  await runWithAnalytics(async (session, analyticsContext) => {
    const result = await session.run(
      'MATCH (p:Place {category: $category}) RETURN p',
      { category: req.params.category }
    );

    const places = sortPlacesByScore(
      result.records.map((record) => formatPlaceNode(record.get('p'), analyticsContext))
    );

    res.json(places);
  }, res);
});

// GET /api/places/:id - single place + neighbours
router.get('/:id', async (req, res) => {
  await runWithAnalytics(async (session, analyticsContext) => {
    const placeResult = await session.run(
      'MATCH (p:Place {place_id: $id}) RETURN p',
      { id: req.params.id }
    );

    if (!placeResult.records.length) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const neighbourResult = await session.run(
      `MATCH (p:Place {place_id: $id})-[r:CONNECTED_TO]-(n:Place)
       RETURN n, r
       ORDER BY coalesce(r.distance_km, 999999) ASC
       LIMIT 10`,
      { id: req.params.id }
    );

    const neighbours = neighbourResult.records.map((record) => {
      const neighbour = formatPlaceNode(record.get('n'), analyticsContext);
      const rel = record.get('r').properties || {};

      return {
        ...neighbour,
        edge_id: rel.edge_id,
        distance_km: toNum(rel.distance_km),
        time_car: toNum(rel.time_car),
        time_bus: toNum(rel.time_bus),
        time_2w: toNum(rel.time_2w),
        time_cycle: toNum(rel.time_cycle),
        weight_car: toNum(rel.weight_car),
        strength: rel.strength || null,
        same_taluk: rel.same_taluk,
        connection_type: rel.connection_type || null,
      };
    });

    res.json({
      place: formatPlaceNode(placeResult.records[0].get('p'), analyticsContext),
      neighbours,
    });
  }, res);
});

module.exports = router;
