import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
});

export const placesAPI = {
  getAll: () => API.get('/places'),
  getOverview: () => API.get('/places/overview'),
  getByTaluk: (taluk) => API.get(`/places/taluk/${encodeURIComponent(taluk)}`),
  getByCategory: (category) => API.get(`/places/category/${encodeURIComponent(category)}`),
  getById: (id) => API.get(`/places/${encodeURIComponent(id)}`),
};

export const analyticsAPI = {
  getCentrality: (metric, limit = 20) =>
    API.get(`/analytics/centrality?metric=${encodeURIComponent(metric)}&limit=${limit}`),
  getAllMetrics: () => API.get('/analytics/all-metrics'),
  getNetworkStats: () => API.get('/analytics/network-stats'),
  getCommunities: () => API.get('/analytics/communities'),
  getBridges: () => API.get('/analytics/bridges'),
  getHiddenGems: () => API.get('/analytics/hidden-gems'),
  getTalukMatrix: () => API.get('/analytics/taluk-matrix'),
  getGraph: () => API.get('/analytics/graph'),
  getTopRoutes: () => API.get('/analytics/top-routes'),
};

export const recommendAPI = {
  getPersonalized: (body) => API.post('/recommendations/personalized', body),
  getSimilar: (id) => API.get(`/recommendations/similar/${encodeURIComponent(id)}`),
  getNearby: (id, maxDist = 30) =>
    API.get(`/recommendations/nearby/${encodeURIComponent(id)}?maxDist=${maxDist}`),
  getItinerary: (body) => API.post('/recommendations/itinerary', body),
  getTopByTaluk: () => API.get('/recommendations/top-by-taluk'),
  getShortestPath: (source, target) =>
    API.get(
      `/recommendations/shortest-path?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`
    ),
};

export default API;
