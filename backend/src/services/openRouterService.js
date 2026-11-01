const { ai } = require('../config');
const { getOrCreateApiKey } = require('./openRouterKeyService');

/**
 * Exponential backoff delay helper
 * @param {number} attempt - Current attempt number
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<void>}
 */
function delay(attempt, baseDelay = 1000) {
  const delayTime = baseDelay * Math.pow(2, attempt);
  return new Promise(resolve => setTimeout(resolve, delayTime));
}

/**
 * Checks if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
function isRetryableError(error) {
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  const statusCode = error.status || error.statusCode;

  // Retry on rate limits, timeouts, and server errors
  if (retryableStatuses.includes(statusCode)) {
    return true;
  }

  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  return false;
}

/**
 * Makes a chat completion request to OpenRouter with retry logic
 * @param {Object} options - Request options
 * @param {string} options.model - Model to use (e.g., 'openrouter/free', 'openai/gpt-4o')
 * @param {Array} options.messages - Chat messages array
 * @param {number} options.temperature - Temperature (0-1)
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {string} options.responseFormat - Response format (e.g., 'json_object')
 * @param {number} options.timeout - Request timeout in milliseconds
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {AbortSignal} options.signal - Abort signal for cancellation
 * @returns {Promise<{content: string, usage?: Object, error?: string}>}
 */
async function chatCompletion({
  model = 'openrouter/free',
  messages = [],
  temperature = 0.3,
  maxTokens = 2048,
  responseFormat = null,
  timeout = 30000,
  maxRetries = 3,
  signal,
}) {
  const lastError = new Error();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Get or create API key (or use existing API key from config)
      let apiKey;
      if (ai.managementApiKey) {
        const { key, error: keyError } = await getOrCreateApiKey();
        if (keyError) {
          return { error: keyError };
        }
        apiKey = key;
      } else if (ai.apiKey) {
        // Use the existing API key from config
        apiKey = ai.apiKey;
      } else {
        return { error: 'No API key available. Set OPENROUTER_API_KEY or OPENROUTER_MANAGEMENT_API_KEY.' };
      }

      // Build request body
      const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (responseFormat) {
        body.response_format = { type: responseFormat };
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Combine with external signal if provided
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://bypassiq.com',
            'X-Title': 'BypassIQ',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
          error.status = response.status;
          error.responseBody = errorText;

          // Check for rate limit
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            console.warn(`[OpenRouter] Rate limited. Waiting ${waitTime}ms before retry...`);
            await delay(attempt, waitTime);
            continue;
          }

          throw error;
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
          return { error: 'No choices returned from OpenRouter API' };
        }

        const content = data.choices[0].message?.content || '';
        const usage = data.usage ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : null;

        return { content, usage };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          const error = new Error('Request timeout');
          error.code = 'ETIMEDOUT';
          throw error;
        }
        throw fetchError;
      }
    } catch (error) {
      console.error(`[OpenRouter] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);

      // Check if error is retryable
      if (!isRetryableError(error) || attempt === maxRetries) {
        return {
          error: `Failed after ${attempt + 1} attempts: ${error.message}`,
        };
      }

      // Wait before retrying with exponential backoff
      const waitTime = 1000 * Math.pow(2, attempt);
      console.log(`[OpenRouter] Retrying in ${waitTime}ms...`);
      await delay(attempt);
    }
  }

  return { error: lastError.message };
}

/**
 * Makes a streaming chat completion request to OpenRouter
 * @param {Object} options - Request options
 * @param {Function} options.onChunk - Callback for each chunk
 * @returns {Promise<{content: string, usage?: Object, error?: string}>}
 */
async function streamChatCompletion({
  model = 'openrouter/free',
  messages = [],
  temperature = 0.3,
  maxTokens = 2048,
  onChunk,
  timeout = 30000,
  maxRetries = 3,
  signal,
}) {
  const lastError = new Error();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let apiKey;
      if (ai.managementApiKey) {
        const { key, error: keyError } = await getOrCreateApiKey();
        if (keyError) {
          return { error: keyError };
        }
        apiKey = key;
      } else if (ai.apiKey) {
        apiKey = ai.apiKey;
      } else {
        return { error: 'No API key available. Set OPENROUTER_API_KEY or OPENROUTER_MANAGEMENT_API_KEY.' };
      }

      const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://bypassiq.com',
            'X-Title': 'BypassIQ',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
          error.status = response.status;
          throw error;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  if (onChunk) onChunk(content);
                }
              } catch (e) {
                // Ignore parse errors for SSE
              }
            }
          }
        }

        return { content: fullContent };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          const error = new Error('Request timeout');
          error.code = 'ETIMEDOUT';
          throw error;
        }
        throw fetchError;
      }
    } catch (error) {
      if (!isRetryableError(error) || attempt === maxRetries) {
        return { error: error.message };
      }

      await delay(attempt);
    }
  }

  return { error: lastError.message };
}

module.exports = {
  chatCompletion,
  streamChatCompletion,
};
