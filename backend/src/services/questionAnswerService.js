const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const CATEGORIES = ['Technical', 'Behavioral', 'Situational', 'Leadership', 'Role-specific'];

const { ai } = require('../config');

/**
 * Generate interview questions using the configured AI provider.
 * Supports Gemini (via @google/generative-ai) and OpenAI.
 */
async function generateQuestions({ text, documentName, count }) {
  if (!ai.apiKey) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'AI is not configured on the server. Set OPENROUTER_API_KEY for OpenRouter, OPENAI_API_KEY for OpenAI, or GEMINI_API_KEY for Gemini, then restart the backend.',
      },
    };
  }

  const prompt = buildPrompt({ text, documentName, count });

  let content, usage;
  if (ai.provider === 'openai' || ai.provider === 'openrouter') {
    // OpenRouter is OpenAI-compatible: same SDK, different baseURL.
    const openai = new OpenAI({
      apiKey: ai.apiKey,
      baseURL: ai.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined,
    });
    try {
      const response = await openai.chat.completions.create({
        model: ai.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: ai.maxOutputTokens,
        response_format: { type: 'json_object' },
      });
      content = response.choices?.[0]?.message?.content || '';
      usage = response.usage;
    } catch (err) {
      console.error('[Backend] OpenAI request failed:', err);
      const reason = (err && err.message) || 'AI request failed';
      return { status: 502, body: { success: false, error: reason } };
    }
  } else {
    // Default to Gemini
    const genAI = new GoogleGenerativeAI(ai.apiKey);
    const model = genAI.getGenerativeModel({ model: ai.model });
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: ai.maxOutputTokens,
          responseMimeType: 'application/json',
        },
      });
      content = result.response.text() || '';
      usage = result.response.usageMetadata;
    } catch (err) {
      console.error('[Backend] Gemini AI request failed:', err);
      const reason = (err && err.message) || 'AI request failed';
      return { status: 502, body: { success: false, error: reason } };
    }
  }

  let questions;
  try {
    questions = parseQuestions(content, count);
  } catch (err) {
    console.error('[Backend] Could not parse AI response:', content.slice(0, 300));
    return {
      status: 502,
      body: { success: false, error: 'AI returned an invalid response. Please try again.' },
    };
  }

  if (questions.length === 0) {
    return {
      status: 502,
      body: { success: false, error: 'AI returned no usable questions. Try a document with more detail.' },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      documentName,
      provider: ai.provider,
      model: ai.model,
      questionCount: questions.length,
      usage: usageBody(usage),
      questions,
    },
  };
}

module.exports = { generateQuestions, CATEGORIES };


/**
 * The whole prompt is deliberately small: short instructions, no examples, no
 * markdown, and answers capped by length. That is what keeps the token count low.
 */
function buildPrompt({ text, documentName, count }) {
  return [
    'You turn a candidate document (resume, CV or job description) into interview Q&A.',
    'Reply with STRICT JSON only, no markdown and no commentary.',
    'Shape: {"questions":[{"question":"...","answer":"...","category":"...","difficulty":"Easy|Medium|Hard"}]}',
    'Rules: exactly the requested number of questions, specific to the document, no duplicates,',
    `each answer 1-2 sentences (max 30 words), category one of: ${CATEGORIES.join(', ')}.`,
    `Create exactly ${count} interview questions with short answers from this document.\n\nDOCUMENT (${documentName}):\n${text}`,
  ].join(' ');
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  const match = CATEGORIES.find((category) => category.toLowerCase() === raw);
  return match || 'Technical';
}

/**
 * Parses the model output defensively — it must survive a stray array wrapper
 * or extra prose around the JSON.
 */
function parseQuestions(content, limit) {
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  const arrayStart = content.indexOf('[');
  const arrayEnd = content.lastIndexOf(']');

  let parsed;
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
  } else if (arrayStart !== -1 && arrayEnd > arrayStart) {
    parsed = JSON.parse(content.slice(arrayStart, arrayEnd + 1));
  } else {
    throw new Error('No JSON found in AI response');
  }

  const list = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(list)) {
    throw new Error('AI response has no questions array');
  }

  return list
    .map((item) => ({
      question: String(item.question || '').trim(),
      answer: String(item.answer || '').trim(),
      category: normalizeCategory(item.category),
      difficulty: ['Easy', 'Medium', 'Hard'].includes(item.difficulty) ? item.difficulty : 'Medium',
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, limit);
}

function usageBody(usage = {}) {
  return {
    inputTokens: usage.prompt_tokens ?? usage.promptTokenCount ?? null,
    outputTokens: usage.completion_tokens ?? usage.candidatesTokenCount ?? null,
    totalTokens: usage.total_tokens ?? usage.totalTokenCount ?? null,
  };
}


