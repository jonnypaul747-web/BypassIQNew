const { pool, get, run } = require('../db');
const { ai } = require('../config');

/**
 * Records API usage for a user
 * @param {string} userId - User identifier (can be IP address or user ID)
 * @param {number} tokensUsed - Number of tokens used in the request
 * @returns {Promise<void>}
 */
async function recordUsage(userId, tokensUsed = 0) {
  const ipAddress = userId || 'anonymous';
  const today = new Date().toISOString().split('T')[0];

  try {
    // Use UPSERT to insert or update
    await pool.query(
      `INSERT INTO api_usage_tracking (user_id, ip_address, request_date, request_count, total_tokens, updated_at)
       VALUES ($1, $2, $3, 1, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, request_date)
       DO UPDATE SET
         request_count = api_usage_tracking.request_count + 1,
         total_tokens = api_usage_tracking.total_tokens + $4,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, ipAddress, today, tokensUsed]
    );
  } catch (error) {
    console.error('[UsageTracking] Failed to record usage:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Gets usage statistics for a user for the current day
 * @param {string} userId - User identifier
 * @returns {Promise<{requestCount: number, totalTokens: number}>}
 */
async function getDailyUsage(userId) {
  const today = new Date().toISOString().split('T')[0];

  try {
    const result = await pool.query(
      `SELECT request_count, total_tokens
       FROM api_usage_tracking
       WHERE user_id = $1 AND request_date = $2`,
      [userId, today]
    );

    if (result.rows.length === 0) {
      return { requestCount: 0, totalTokens: 0 };
    }

    return {
      requestCount: result.rows[0].request_count,
      totalTokens: result.rows[0].total_tokens,
    };
  } catch (error) {
    console.error('[UsageTracking] Failed to get daily usage:', error);
    return { requestCount: 0, totalTokens: 0 };
  }
}

/**
 * Gets usage statistics for a user for the current month
 * @param {string} userId - User identifier
 * @returns {Promise<{requestCount: number, totalTokens: number}>}
 */
async function getMonthlyUsage(userId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  try {
    const result = await pool.query(
      `SELECT SUM(request_count) as request_count, SUM(total_tokens) as total_tokens
       FROM api_usage_tracking
       WHERE user_id = $1 AND request_date >= $2`,
      [userId, startOfMonth.toISOString().split('T')[0]]
    );

    return {
      requestCount: parseInt(result.rows[0].request_count) || 0,
      totalTokens: parseInt(result.rows[0].total_tokens) || 0,
    };
  } catch (error) {
    console.error('[UsageTracking] Failed to get monthly usage:', error);
    return { requestCount: 0, totalTokens: 0 };
  }
}

/**
 * Checks if a user has exceeded their request limits
 * @param {string} userId - User identifier
 * @returns {Promise<{allowed: boolean, reason?: string, dailyUsage?: number, monthlyUsage?: number}>}
 */
async function checkUserLimits(userId) {
  const [dailyUsage, monthlyUsage] = await Promise.all([
    getDailyUsage(userId),
    getMonthlyUsage(userId),
  ]);

  const dailyLimit = ai.userLimits.dailyRequests;
  const monthlyLimit = ai.userLimits.monthlyRequests;

  // Check daily limit
  if (dailyUsage.requestCount >= dailyLimit) {
    return {
      allowed: false,
      reason: `Daily request limit exceeded (${dailyUsage.requestCount}/${dailyLimit})`,
      dailyUsage: dailyUsage.requestCount,
      monthlyUsage: monthlyUsage.requestCount,
    };
  }

  // Check monthly limit
  if (monthlyUsage.requestCount >= monthlyLimit) {
    return {
      allowed: false,
      reason: `Monthly request limit exceeded (${monthlyUsage.requestCount}/${monthlyLimit})`,
      dailyUsage: dailyUsage.requestCount,
      monthlyUsage: monthlyUsage.requestCount,
    };
  }

  return {
    allowed: true,
    dailyUsage: dailyUsage.requestCount,
    monthlyUsage: monthlyUsage.requestCount,
  };
}

/**
 * Resets usage tracking for a user (admin function)
 * @param {string} userId - User identifier
 * @returns {Promise<void>}
 */
async function resetUserUsage(userId) {
  try {
    await pool.query(
      `DELETE FROM api_usage_tracking WHERE user_id = $1`,
      [userId]
    );
  } catch (error) {
    console.error('[UsageTracking] Failed to reset usage:', error);
    throw error;
  }
}

/**
 * Gets overall usage statistics (admin function)
 * @returns {Promise<{totalRequests: number, totalTokens: number, uniqueUsers: number}>}
 */
async function getOverallStats() {
  try {
    const result = await pool.query(
      `SELECT
         SUM(request_count) as total_requests,
         SUM(total_tokens) as total_tokens,
         COUNT(DISTINCT user_id) as unique_users
       FROM api_usage_tracking`
    );

    return {
      totalRequests: parseInt(result.rows[0].total_requests) || 0,
      totalTokens: parseInt(result.rows[0].total_tokens) || 0,
      uniqueUsers: parseInt(result.rows[0].unique_users) || 0,
    };
  } catch (error) {
    console.error('[UsageTracking] Failed to get overall stats:', error);
    return { totalRequests: 0, totalTokens: 0, uniqueUsers: 0 };
  }
}

module.exports = {
  recordUsage,
  getDailyUsage,
  getMonthlyUsage,
  checkUserLimits,
  resetUserUsage,
  getOverallStats,
};
