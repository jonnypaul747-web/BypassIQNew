const express = require('express');
const { validateLicenseKey } = require('../services/licenseService');
const { createSubscription, getLatestSubscription } = require('../services/subscriptionService');

const router = express.Router();

// The desktop app calls this on activation and then once an hour.
router.post('/validate-license', async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ valid: false, error: 'License key required' });
  }

  const result = await validateLicenseKey(licenseKey);
  res.status(result.status).json(result.body);
});

// Manual/admin endpoint today. Stripe Checkout should call this once payments exist.
router.post('/create-subscription', async (req, res) => {
  const { email, durationDays = 30 } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  const result = await createSubscription(email, durationDays);
  res.status(result.status).json(result.body);
});

router.get('/subscription/:userId', async (req, res) => {
  const result = await getLatestSubscription(req.params.userId);
  res.status(result.status).json(result.body);
});

module.exports = router;
