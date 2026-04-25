/**
 * routes/analytics.js
 * Full Social Network Analysis endpoints backed by Neo4j GDS.
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

function formatNode(node, analyticsContext) {
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
    degree: metric.degree,
    degree_centrality: metric.degree_centrality,
    closeness_centrality: metric.closeness_centrality,
    betweenness_centrality: metric.betweenness_centrality,
    pagerank: metric.pagerank,
    community: metric.community,
    popularity_score: computePopularityScore(props, metric, analyticsContext.globalStats),
    is_isolated: metric.is_isolated,
    latitude: toNum(props.latitude),
    longitude: toNum(props.longitude),
    photo_url: props.photo_url,
    source: props.source,
  };
}

function sortNodes(nodes, metric, limit) {
  return [...nodes]
    .sort((a, b) => {
      if ((b[metric] || 0) !== (a[metric] || 0)) {
        return (b[metric] || 0) - (a[metric] || 0);
      }
      return (a.name || '').localeCompare(b.name || '');
    })
    .slice(0, limit);
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

// GET /api/analytics/centrality?metric=degree_centrality&limit=20
router.get('/centrality', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const allowed = [
      'degree',
      'degree_centrality',
      'closeness_centrality',
      'betweenness_centrality',
      'pagerank',
      'popularity_score',
    ];
    const metric = allowed.includes(req.query.metric) ? req.query.metric : 'degree_centrality';
    const limit = Math.max(1, parseInt(req.query.limit || 20, 10));

    const result = await session.run('MATCH (p:Place) RETURN p');
    const nodes = result.records.map((record) => formatNode(record.get('p'), analyticsContext));

    res.json({
      metric,
      limit,
      results: sortNodes(nodes, metric, limit),
    });
  }, res);
});

// GET /api/analytics/all-metrics
router.get('/all-metrics', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const result = await session.run('MATCH (p:Place) RETURN p');
    const nodes = result.records.map((record) => formatNode(record.get('p'), analyticsContext));

    res.json(sortNodes(nodes, 'pagerank', nodes.length));
  }, res);
});

// GET /api/analytics/network-stats
router.get('/network-stats', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const nodeResult = await session.run('MATCH (p:Place) RETURN count(p) AS count');
    const edgeResult = await session.run('MATCH ()-[r:CONNECTED_TO]->() RETURN count(r) AS count');
    const placeResult = await session.run('MATCH (p:Place) RETURN p');

    const nodeCount = toNum(nodeResult.records[0].get('count')) || 0;
    const edgeCount = toNum(edgeResult.records[0].get('count')) || 0;
    const maxPossible = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 0;
    const density = maxPossible > 0 ? round(edgeCount / maxPossible, 4) : 0;

    const nodes = placeResult.records.map((record) => formatNode(record.get('p'), analyticsContext));
    const degrees = nodes.map((node) => node.degree || 0);
    const avgDegree =
      degrees.length > 0 ? round(degrees.reduce((sum, value) => sum + value, 0) / degrees.length, 2) : 0;
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;
    const minDegree = degrees.length > 0 ? Math.min(...degrees) : 0;
    const isolatedCount = nodes.filter((node) => node.is_isolated).length;

    const communityMap = new Map();
    const categoryMap = new Map();

    for (const node of nodes) {
      const communityId = node.community == null ? -1 : node.community;
      communityMap.set(communityId, (communityMap.get(communityId) || 0) + 1);

      const category = node.category || 'Unknown';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, count: 0, ratingSum: 0 });
      }
      const entry = categoryMap.get(category);
      entry.count += 1;
      entry.ratingSum += node.rating || 0;
    }

    const communities = [...communityMap.entries()]
      .map(([id, size]) => ({ id, size }))
      .sort((a, b) => b.size - a.size || a.id - b.id);

    const categoryStats = [...categoryMap.values()]
      .map((entry) => ({
        category: entry.category,
        count: entry.count,
        avgRating: round(entry.ratingSum / entry.count, 2),
      }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    let clusteringCoefficient = null;
    try {
      const triangleResult = await session.run(
        `CALL gds.localClusteringCoefficient.stats($graphName)
         YIELD averageClusteringCoefficient
         RETURN averageClusteringCoefficient`,
        { graphName: GRAPH_NAME }
      );
      clusteringCoefficient = round(
        toNum(triangleResult.records[0].get('averageClusteringCoefficient')) || 0,
        6
      );
    } catch (_) {
      clusteringCoefficient = null;
    }

    res.json({
      nodeCount,
      edgeCount,
      density,
      avgDegree,
      maxDegree,
      minDegree,
      isolatedCount,
      communityCount: communities.length,
      communities,
      clusteringCoefficient,
      categoryStats,
    });
  }, res);
});

// GET /api/analytics/communities
router.get('/communities', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const result = await session.run('MATCH (p:Place) RETURN p');
    const nodes = result.records.map((record) => formatNode(record.get('p'), analyticsContext));

    const communityMap = new Map();

    for (const node of nodes) {
      const communityId = node.community == null ? -1 : node.community;
      if (!communityMap.has(communityId)) {
        communityMap.set(communityId, []);
      }
      communityMap.get(communityId).push(node);
    }

    const communities = [...communityMap.entries()]
      .map(([id, members]) => ({
        id,
        size: members.length,
        members: sortNodes(members, 'pagerank', members.length),
      }))
      .sort((a, b) => b.size - a.size || a.id - b.id);

    res.json(communities);
  }, res);
});

// GET /api/analytics/bridges
router.get('/bridges', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const result = await session.run('MATCH (p:Place) RETURN p');
    const nodes = result.records
      .map((record) => formatNode(record.get('p'), analyticsContext))
      .filter((node) => (node.betweenness_centrality || 0) > 0);

    res.json(sortNodes(nodes, 'betweenness_centrality', 15));
  }, res);
});

// GET /api/analytics/hidden-gems
router.get('/hidden-gems', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const result = await session.run('MATCH (p:Place) RETURN p');
    const nodes = result.records
      .map((record) => formatNode(record.get('p'), analyticsContext))
      .filter((node) => node.is_isolated && (node.popularity || 0) > 150);

    res.json(sortNodes(nodes, 'popularity', nodes.length));
  }, res);
});

// GET /api/analytics/taluk-matrix
router.get('/taluk-matrix', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (a:Place)-[r:CONNECTED_TO]->(b:Place)
       WHERE a.taluk <> b.taluk
       RETURN a.taluk AS src, b.taluk AS tgt, count(r) AS cnt
       ORDER BY cnt DESC`
    );

    res.json(
      result.records.map((record) => ({
        source: record.get('src'),
        target: record.get('tgt'),
        count: toNum(record.get('cnt')),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// GET /api/analytics/graph
router.get('/graph', async (req, res) => {
  await withAnalytics(async (session, analyticsContext) => {
    const nodeResult = await session.run('MATCH (p:Place) RETURN p');
    const edgeResult = await session.run(
      `MATCH (a:Place)-[r:CONNECTED_TO]->(b:Place)
       RETURN a.place_id AS src, b.place_id AS tgt, r`
    );

    const nodes = nodeResult.records.map((record) => formatNode(record.get('p'), analyticsContext));
    const links = edgeResult.records.map((record) => {
      const rel = record.get('r').properties || {};
      return {
        source: record.get('src'),
        target: record.get('tgt'),
        edge_id: rel.edge_id || null,
        distance: toNum(rel.distance_km),
        time_car: toNum(rel.time_car),
        strength: rel.strength || null,
        same_taluk: rel.same_taluk,
        connection_type: rel.connection_type || null,
      };
    });

    res.json({ nodes, links });
  }, res);
});

// GET /api/analytics/top-routes
router.get('/top-routes', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (a:Place)-[r:CONNECTED_TO]->(b:Place)
       WHERE r.strength = 'strong'
       RETURN a.name AS from, b.name AS to,
              a.taluk AS fromTaluk, b.taluk AS toTaluk,
              r.distance_km AS dist, r.time_car AS time, r.edge_id AS edge_id
       ORDER BY dist ASC
       LIMIT 20`
    );

    res.json(
      result.records.map((record) => ({
        edge_id: record.get('edge_id'),
        from: record.get('from'),
        to: record.get('to'),
        fromTaluk: record.get('fromTaluk'),
        toTaluk: record.get('toTaluk'),
        distance: toNum(record.get('dist')),
        time: toNum(record.get('time')),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

module.exports = router;
