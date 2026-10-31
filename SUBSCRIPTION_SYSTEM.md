# Subscription & Licensing System for JustCilledAI

This document describes the complete subscription-based licensing system for the JustCilledAI desktop application. The system ensures users pay monthly to access the software, with automatic license validation and feature blocking when expired.

## Overview

**Business Model:**
- Monthly subscription (user pays for access)
- Software uses developer's OpenAI API key (embedded)
- License validation via backend server
- Automatic logout/block when subscription expires
- Payment handled via Stripe/LemonSqueezy

**Architecture Flow:**
```
User Download → Enter License Key → Validate with Backend → Access Granted
                                                    ↓
                                        Check Every 1 Hour
                                                    ↓
                                    If Expired → Block All Features → Show Subscribe Screen
```

## System Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                          │
├─────────────────────────────────────────────────────────────────┤
│  1. License Manager Service                                     │
│     - Stores license key locally (encrypted)                     │
│     - Validates license on startup                             │
│     - Periodic validation (every 1 hour)                        │
│     - Triggers auto-logout on expiry                            │
│                                                                 │
│  2. API Key Management                                          │
│     - Developer's OpenAI key (embedded/obfuscated)             │
│     - No user API key required                                  │
│     - Key rotated via backend if needed                         │
│                                                                 │
│  3. Feature Gate                                                │
│     - Blocks all AI features when license invalid               │
│     - Shows subscription screen                                 │
│     - Prevents unauthorized access                             │
│                                                                 │
│  4. UI Components                                               │
│     - License input screen                                      │
│     - Payment redirect button                                   │
│     - Expiry warning notifications                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Backend Server (Node.js/Express)                │
├─────────────────────────────────────────────────────────────────┤
│  1. License Validation API                                      │
│     - POST /api/validate-license                                │
│     - Checks license key against database                       │
│     - Returns expiry date and status                             │
│                                                                 │
│  2. Subscription Management                                     │
│     - Stripe/LemonSqueezy webhooks                              │
│     - Handle payment success/failure                            │
│     - Generate license keys                                     │
│     - Renew/expire subscriptions                                │
│                                                                 │
│  3. Database (SQLite/PostgreSQL)                                │
│     - User subscriptions table                                  │
│     - License keys table                                         │
│     - Payment history                                           │
│                                                                 │
│  4. Admin Dashboard (Optional)                                  │
│     - View active subscribers                                   │
│     - Manual license management                                 │
│     - Revenue analytics                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Webhooks
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Payment Gateway (Stripe/LemonSqueezy)            │
├─────────────────────────────────────────────────────────────────┤
│  - Monthly subscription billing                                 │
│  - Automatic renewal                                             │
│  - Payment failure handling                                      │
│  - Tax compliance                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);
```

### Subscriptions Table
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(50), -- active, past_due, canceled, expired
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### License Keys Table
```sql
CREATE TABLE license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of license key
  user_id UUID REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Details

### 1. Electron App - License Manager

**File:** `services/license/licenseManager.ts`

```typescript
import { ipcMain } from 'electron';
import crypto from 'crypto';
import { StorageService } from '../storage/storageService';

interface LicenseInfo {
  key: string;
  expiresAt: number;
  isValid: boolean;
  lastChecked: number;
}

export class LicenseManager {
  private storage: StorageService;
  private validationInterval: NodeJS.Timeout | null = null;
  private backendUrl: string;

  constructor(storage: StorageService, backendUrl: string) {
    this.storage = storage;
    this.backendUrl = backendUrl;
  }

  /**
   * Initialize license manager on app startup
   */
  async initialize(): Promise<boolean> {
    const license = await this.getStoredLicense();

    if (!license) {
      // No license found, show subscription screen
      return false;
    }

    // Validate license with backend
    const isValid = await this.validateLicense(license.key);

    if (isValid) {
      // Start periodic validation
      this.startPeriodicValidation();
      return true;
    }

    // License invalid, clear and show subscription screen
    await this.clearLicense();
    return false;
  }

  /**
   * Store license key locally (encrypted)
   */
  async storeLicense(key: string, expiresAt: number): Promise<void> {
    const licenseInfo: LicenseInfo = {
      key,
      expiresAt,
      isValid: true,
      lastChecked: Date.now()
    };

    await this.storage.set('license', licenseInfo);
  }

  /**
   * Get stored license
   */
  async getStoredLicense(): Promise<LicenseInfo | null> {
    return await this.storage.get('license');
  }

  /**
   * Validate license with backend server
   */
  async validateLicense(key: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/validate-license`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key })
      });

      const data = await response.json();

      if (data.valid) {
        // Update local expiry date
        await this.storeLicense(key, new Date(data.expiresAt).getTime());
        return true;
      }

      return false;
    } catch (error) {
      console.error('License validation failed:', error);
      // If backend is down, allow offline grace period (optional)
      const stored = await this.getStoredLicense();
      if (stored && stored.expiresAt > Date.now()) {
        return true; // Grace period
      }
      return false;
    }
  }

  /**
   * Start periodic validation (every 1 hour)
   */
  private startPeriodicValidation(): void {
    this.validationInterval = setInterval(async () => {
      const license = await this.getStoredLicense();
      if (license) {
        const isValid = await this.validateLicense(license.key);
        if (!isValid) {
          await this.handleLicenseExpiry();
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Handle license expiry
   */
  private async handleLicenseExpiry(): Promise<void> {
    // Stop validation interval
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }

    // Clear license
    await this.clearLicense();

    // Notify renderer to show subscription screen
    // This will be handled via IPC
  }

  /**
   * Clear stored license
   */
  async clearLicense(): Promise<void> {
    await this.storage.delete('license');
  }

  /**
   * Cleanup on app quit
   */
  destroy(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }
  }
}
```

### 2. Electron App - IPC Handlers

**File:** `app/electron/main/ipcHandlers.ts`

```typescript
import { ipcMain } from 'electron';
import { LicenseManager } from '../../services/license/licenseManager';

export function setupLicenseHandlers(licenseManager: LicenseManager) {
  // Validate license
  ipcMain.handle('license:validate', async (event, key: string) => {
    return await licenseManager.validateLicense(key);
  });

  // Store license
  ipcMain.handle('license:store', async (event, key: string, expiresAt: number) => {
    await licenseManager.storeLicense(key, expiresAt);
    return { success: true };
  });

  // Get license status
  ipcMain.handle('license:status', async () => {
    const license = await licenseManager.getStoredLicense();
    return {
      hasLicense: !!license,
      expiresAt: license?.expiresAt,
      isValid: license?.isValid
    };
  });

  // Clear license (logout)
  ipcMain.handle('license:clear', async () => {
    await licenseManager.clearLicense();
    return { success: true };
  });
}
```

### 3. React UI - License Screen

**File:** `app/renderer/components/LicenseScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function LicenseScreen() {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubscribe = () => {
    // Redirect to payment page
    window.open('https://your-domain.com/subscribe', '_blank');
  };

  const handleActivateLicense = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await window.electron.ipcRenderer.invoke('license:validate', licenseKey);

      if (result.valid) {
        // Store license
        await window.electron.ipcRenderer.invoke('license:store', licenseKey, result.expiresAt);
        // Navigate to main app
        navigate('/');
      } else {
        setError('Invalid or expired license key');
      }
    } catch (err) {
      setError('Failed to validate license');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="license-screen">
      <div className="license-card">
        <h1>JustCilledAI Premium</h1>
        <p>Subscribe to unlock all features</p>

        <button onClick={handleSubscribe} className="subscribe-btn">
          Subscribe Now - $9.99/month
        </button>

        <div className="divider">OR</div>

        <input
          type="text"
          placeholder="Enter your license key"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
        />

        <button
          onClick={handleActivateLicense}
          disabled={loading || !licenseKey}
          className="activate-btn"
        >
          {loading ? 'Validating...' : 'Activate License'}
        </button>

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
```

### 4. Backend Server - Express API

**File:** `backend/server.js`

```javascript
const express = require('express');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const db = new sqlite3.Database('./subscriptions.db');

app.use(cors());
app.use(express.json());

// Initialize database
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      stripe_subscription_id TEXT,
      status TEXT,
      current_period_end DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS license_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT UNIQUE,
      user_id TEXT,
      subscription_id TEXT,
      expires_at DATETIME,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )
  `);
});

/**
 * Generate license key
 */
function generateLicenseKey() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/**
 * Hash license key for storage
 */
function hashLicenseKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate license API
 */
app.post('/api/validate-license', async (req, res) => {
  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ valid: false, error: 'License key required' });
  }

  const keyHash = hashLicenseKey(licenseKey);

  db.get(
    'SELECT lk.*, s.status as subscription_status FROM license_keys lk ' +
    'JOIN subscriptions s ON lk.subscription_id = s.id ' +
    'WHERE lk.key_hash = ? AND lk.is_active = 1',
    [keyHash],
    (err, row) => {
      if (err) {
        return res.status(500).json({ valid: false, error: 'Database error' });
      }

      if (!row) {
        return res.json({ valid: false, error: 'License key not found' });
      }

      if (row.subscription_status !== 'active') {
        return res.json({ valid: false, error: 'Subscription not active' });
      }

      const expiresAt = new Date(row.expires_at);
      if (expiresAt < new Date()) {
        return res.json({ valid: false, error: 'License expired' });
      }

      res.json({
        valid: true,
        expiresAt: row.expires_at,
        userId: row.user_id
      });
    }
  );
});

/**
 * Create subscription (Stripe webhook handler)
 */
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await handlePaymentSuccess(session);
      break;
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      await handleSubscriptionCancellation(subscription);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(session) {
  const email = session.customer_details.email;
  const subscriptionId = session.subscription;

  // Create or get user
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return console.error(err);

    let userId;
    if (user) {
      userId = user.id;
    } else {
      userId = crypto.randomUUID();
      db.run('INSERT INTO users (id, email) VALUES (?, ?)', [userId, email]);
    }

    // Create subscription record
    const subId = crypto.randomUUID();
    db.run(
      'INSERT INTO subscriptions (id, user_id, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?, ?)',
      [subId, userId, subscriptionId, 'active', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()]
    );

    // Generate license key
    const licenseKey = generateLicenseKey();
    const keyHash = hashLicenseKey(licenseKey);
    const licenseId = crypto.randomUUID();

    db.run(
      'INSERT INTO license_keys (id, key_hash, user_id, subscription_id, expires_at) VALUES (?, ?, ?, ?, ?)',
      [licenseId, keyHash, userId, subId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()]
    );

    // Send license key to user via email (implement email service)
    console.log(`License key for ${email}: ${licenseKey}`);
  });
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancellation(subscription) {
  db.run(
    'UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?',
    ['canceled', subscription.id]
  );

  db.run(
    'UPDATE license_keys SET is_active = 0 WHERE subscription_id = (SELECT id FROM subscriptions WHERE stripe_subscription_id = ?)',
    [subscription.id]
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`License server running on port ${PORT}`);
});
```

### 5. Payment Integration - Stripe Checkout

**File:** `backend/create-checkout-session.js`

```javascript
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/create-checkout-session', async (req, res) => {
  const { email } = req.body;

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'JustCilledAI Premium',
            description: 'Monthly subscription',
          },
          unit_amount: 999, // $9.99
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: 'https://your-domain.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://your-domain.com/cancel',
  });

  res.json({ url: session.url });
});

module.exports = router;
```

## Security Considerations

### 1. API Key Protection

**Current Issue:** OpenAI key embedded in Electron app can be extracted.

**Solutions:**

**Option A: Backend Proxy (Recommended)**
```
Electron App → Your Backend → OpenAI API
```
- User's app calls your backend
- Your backend adds OpenAI key
- OpenAI never sees the key
- You can track usage and rotate keys

**Option B: Obfuscation**
- Use `javascript-obfuscator` on build
- Makes reverse-engineering harder
- Not 100% secure but better than plain text

**Option C: Key Rotation**
- Rotate OpenAI key regularly
- If leaked, quickly invalidate
- Monitor usage for anomalies

### 2. License Key Security

- Store SHA-256 hash in database (not plain text)
- Use cryptographically secure random generation
- Set reasonable expiry (30 days)
- Implement rate limiting on validation API

### 3. Backend Security

- Use HTTPS only
- Implement rate limiting
- Validate all inputs
- Use environment variables for secrets
- Enable CORS only for your domain

### 4. Offline Grace Period

Allow offline usage for 24-48 hours after last successful validation to improve UX while maintaining security.

## Deployment Steps

### 1. Backend Deployment

**Option A: Railway.app (Free Tier)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL database
railway add postgresql

# Set environment variables
railway variables set STRIPE_SECRET_KEY=sk_live_...
railway variables set STRIPE_WEBHOOK_SECRET=whsec_...
railway variables set DATABASE_URL=postgresql://...

# Deploy
railway up
```

**Option B: Render.com (Free Tier)**
- Connect GitHub repo
- Add PostgreSQL
- Set environment variables
- Auto-deploy on push

**Option C: VPS (DigitalOcean, AWS)**
- Ubuntu server
- Install Node.js
- Setup Nginx reverse proxy
- SSL with Let's Encrypt
- PM2 for process management

### 2. Frontend Website

**Simple Landing Page (Netlify/Vercel):**
```bash
# Create simple React app
npx create-react-app justcilledai-website

# Add payment redirect
# Deploy to Netlify
netlify deploy --prod
```

### 3. Electron App Distribution

**Update package.json:**
```json
{
  "scripts": {
    "package:mac": "npm run build && electron-builder --mac --arm64",
    "package:win": "npm run build && electron-builder --win --x64"
  }
}
```

**Code Signing (Mac):**
```bash
# Get Developer ID from Apple
# Add to electron-builder config
electron-builder --mac --config.mac.identity="Developer ID Application: Your Name"
```

**Code Signing (Windows):**
```bash
# Get code signing certificate
# Add to electron-builder config
electron-builder --win --config.win.certificateFile="cert.pfx"
```

## Monitoring & Maintenance

### 1. Subscription Monitoring

- Track active subscribers
- Monitor churn rate
- Revenue analytics
- Failed payment alerts

### 2. Usage Monitoring

- Track API usage (via backend proxy)
- Detect abnormal usage patterns
- Monitor for potential key leaks

### 3. Customer Support

- Support email
- License reset functionality
- Refund handling
- Troubleshooting guide

## Cost Analysis

### Monthly Costs

**Backend Hosting:**
- Railway/Render Free Tier: $0
- Paid tier (if needed): $5-20/month

**Database:**
- PostgreSQL (included in hosting): $0-10/month

**Payment Processing:**
- Stripe: 2.9% + $0.30 per transaction
- For $9.99 subscription: ~$0.59 per customer

**Code Signing:**
- Apple Developer: $99/year
- Windows Code Signing: ~$100-200/year

**API Costs (OpenAI):**
- GPT-4o-mini: $0.15/1M input, $0.60/1M output
- Estimated per user: $0.01-0.05 per session
- If 100 users using 10 sessions/month: $5-50/month

### Revenue Projection

**At $9.99/month:**
- 10 users: $99.99/month
- 50 users: $499.95/month
- 100 users: $999/month
- 500 users: $4,995/month

**Break-even:** ~10-20 users (depending on usage)

## Implementation Checklist

### Phase 1: Core Licensing (Days 1-2)
- [ ] Implement LicenseManager in Electron app
- [ ] Setup IPC handlers for license validation
- [ ] Create license screen UI in React
- [ ] Implement feature blocking logic
- [ ] Add periodic validation (1 hour)
- [ ] Test expiry flow

### Phase 2: Backend Server (Days 3-4)
- [ ] Setup Express.js server
- [ ] Create database schema
- [ ] Implement license validation API
- [ ] Setup Stripe integration
- [ ] Implement webhook handlers
- [ ] Create license key generation
- [ ] Test payment flow end-to-end

### Phase 3: Deployment (Day 5)
- [ ] Deploy backend to Railway/Render
- [ ] Setup environment variables
- [ ] Create simple landing page
- [ ] Configure Stripe webhook URLs
- [ ] Test production flow
- [ ] Monitor first payment

### Phase 4: Security & Polish (Day 6)
- [ ] Add code obfuscation
- [ ] Implement backend proxy for OpenAI
- [ ] Add rate limiting
- [ ] Setup monitoring
- [ ] Create documentation
- [ ] Beta testing

## Alternative Payment Gateways

### Stripe (Recommended)
- Pros: Industry standard, great docs, wide adoption
- Cons: 2.9% fee, US-based (tax complexity)
- Best for: Global audience, technical users

### LemonSqueezy
- Pros: Handles global taxes, easier setup, merchant of record
- Cons: 5% fee (higher), newer platform
- Best for: Quick setup, non-US developers

### Paddle
- Pros: Handles everything (tax, compliance, payments)
- Cons: Higher fees, less flexibility
- Best for: Hands-off approach

## Testing Plan

### Manual Testing
1. Test license activation flow
2. Test expiry blocking
3. Test periodic validation
4. Test payment success
5. Test payment failure
6. Test offline grace period
7. Test multiple devices (if allowed)

### Automated Testing
- Unit tests for LicenseManager
- Integration tests for API
- E2E tests for payment flow
- Load testing for validation API

## Troubleshooting

### Common Issues

**Issue:** License validation fails
- Check backend server status
- Verify database connection
- Check license key format
- Review logs for errors

**Issue:** Payment webhook not received
- Verify Stripe webhook URL
- Check webhook secret
- Review Stripe dashboard logs
- Test with Stripe CLI

**Issue:** App not blocking after expiry
- Check periodic validation interval
- Verify localStorage is cleared
- Check IPC communication
- Review feature gate logic

## Future Enhancements

### Short-term
- User account management
- Usage analytics dashboard
- Multi-device support
- Family plans

### Long-term
- AI provider selection (user pays for their own key)
- Tiered pricing (Basic, Pro, Enterprise)
- Team/organization plans
- Custom branding

## Conclusion

This subscription system provides a robust foundation for monetizing JustCilledAI while maintaining a good user experience. The architecture balances security with usability, and the implementation can be completed in approximately 5-6 days of focused development.

**Key Success Factors:**
1. Reliable license validation
2. Smooth payment experience
3. Transparent communication about expiry
4. Responsive customer support
5. Continuous monitoring and improvement
