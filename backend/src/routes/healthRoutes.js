const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// Liveness probe for the host (Railway/Fly/Render health checks, uptime monitors).
router.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
