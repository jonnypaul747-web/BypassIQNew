const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ai } = require('../config');

const CATEGORIES = ['Technical', 'Behavioral', 'Situational', 'Leadership', 'Role-specific'];

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
    inputTokens: usage.promptTokenCount ?? null,
    outputTokens: usage.candidatesTokenCount ?? null,
    totalTokens: usage.totalTokenCount ?? null,
  };
}

async function generateQuestions({ text, documentName, count }) {
  if (!ai.apiKey) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'AI is not configured on the server. Set GEMINI_API_KEY and restart the backend.',
      },
    };
  }

  const genAI = new GoogleGenerativeAI(ai.apiKey);
  const model = genAI.getGenerativeModel({ model: ai.model });
  const prompt = buildPrompt({ text, documentName, count });

  let result;
  try {
    result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: ai.maxOutputTokens,
        responseMimeType: 'application/json',
      },
    });
  } catch (err) {
    console.error('[Backend] AI request failed:', err);
    const reason = (err && err.message) || 'AI request failed';
    return { status: 502, body: { success: false, error: reason } };
  }

  const content = result.response.text() || '';

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
      provider: 'gemini',
      model: ai.model,
      questionCount: questions.length,
      usage: usageBody(result.response.usageMetadata),
      questions,
    },
  };
}

module.exports = { generateQuestions, CATEGORIES };
