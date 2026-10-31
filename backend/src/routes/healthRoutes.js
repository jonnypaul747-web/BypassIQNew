const express = require('express');

const router = express.Router();

// Liveness probe for the host (Railway/Fly/Render health checks, uptime monitors).
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
