/**
 * server.js - Virudhunagar Tourism API
 * Express + Neo4j backend
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { verifyConnection } = require('./db');

const placesRouter = require('./routes/places');
const analyticsRouter = require('./routes/analytics');
const recommendRouter = require('./routes/recommendations');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/places', placesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/recommendations', recommendRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  try {
    await verifyConnection();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
