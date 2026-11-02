const { ai } = require('../config');

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const LIVE_STT_MODEL = 'deepgram/nova-3';

function assertOpenRouterConfigured() {
  if (ai.provider !== 'openrouter' || !ai.apiKey) {
    const error = new Error('Live Voice Agent is not configured. Set AI_PROVIDER=openrouter and OPENROUTER_API_KEY on the backend.');
    error.status = 503;
    throw error;
  }
}

async function transcribeLiveAudio(audioBase64) {
  assertOpenRouterConfigured();

  const response = await fetch(`${OPENROUTER_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LIVE_STT_MODEL,
      input_audio: { data: audioBase64, format: 'wav' },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `OpenRouter transcription failed (${response.status}).`);
    error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw error;
  }

  return { text: String(result.text || '').trim() };
}

async function generateLiveAnswer({ question, transcriptHistory = [], style = 'short' }) {
  assertOpenRouterConfigured();

  const history = transcriptHistory
    .filter((entry) => typeof entry === 'string')
    .slice(-10)
    .map((entry) => entry.slice(0, 1000))
    .join('\n');
  const styleInstructions = {
    short: 'Answer in 1 to 3 concise sentences.',
    detailed: 'Give a clear, structured explanation with the key reasoning.',
    bullet: 'Answer with a concise list of key points.',
    'step-by-step': 'Explain the answer in clear sequential steps.',
    technical: 'Give a technically precise answer and explain relevant trade-offs.',
    code: 'Provide a concise explanation and a code example only if the question asks for code.',
  };
  const context = history ? `Recent live transcript:\n${history}\n\n` : '';

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ai.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ai.model,
      temperature: 0.3,
      max_tokens: Math.min(ai.maxOutputTokens, 700),
      messages: [
        {
          role: 'system',
          content: `You are a clear, accurate Hindi-English live voice assistant. Answer directly in the same language or natural Hindi-English mix used by the speaker. Use recent transcript only as context and do not invent facts. Keep phrasing natural to speak aloud. ${styleInstructions[style] || styleInstructions.short}`,
        },
        { role: 'user', content: `${context}Question:\n${question}` },
      ],
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || `OpenRouter answer request failed (${response.status}).`);
    error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw error;
  }

  const answer = String(result.choices?.[0]?.message?.content || '').trim();
  if (!answer) {
    const error = new Error('OpenRouter returned an empty answer.');
    error.status = 502;
    throw error;
  }

  return { answer, provider: ai.provider, model: ai.model };
}

module.exports = { transcribeLiveAudio, generateLiveAnswer };