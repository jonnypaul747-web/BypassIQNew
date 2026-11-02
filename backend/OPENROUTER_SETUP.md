# OpenRouter API Integration Setup Guide

This document explains how to set up and use the OpenRouter API integration in BypassIQ.

## Overview

The backend now uses OpenRouter for AI-powered features:
- **Interview Questions Generation**: Generate interview questions from resumes/job descriptions
- **Resume Analysis**: Analyze and structure resume data
- **Automatic Key Management**: Optional automatic API key generation using Management API

## Hindi-English Voice Agent

The live voice flow sends 16 kHz mono PCM from the desktop to the authenticated backend WebSocket at `/api/live/stream`. The backend batches the stream into short WAV windows and calls OpenRouter's Speech-to-Text endpoint with `deepgram/nova-3`; the same OpenRouter key is used for answer generation. The desktop uses its built-in speech synthesis for audio replies; no separate Deepgram or TTS provider key is needed.

Keep `OPENROUTER_API_KEY` and `DEEPGRAM_API_KEY` only in the backend environment. `LIVE_CLASS_ACCESS_KEY` is a separate client-to-backend access secret and must match the value entered in the desktop app's Settings.

1. Copy `backend/.env.example` to `backend/.env` and set `OPENROUTER_API_KEY`, `LIVE_CLASS_ACCESS_KEY`, `AI_PROVIDER=openrouter`, and a supported `AI_MODEL`.
2. Install and start the backend with `cd backend && npm install && npm start`. The existing PostgreSQL database configuration is still required by backend startup.
3. In the desktop app Settings, enter the matching Live Class Access Key and choose **Secure backend Voice Agent** as the transcription provider.
4. Start Live Interview, select the system-audio source, and allow microphone access if microphone capture is enabled. Toggle **Speak replies** to enable local Hindi-English voice output.

For local development, set `LICENSE_BACKEND_URL=http://localhost:3000` when launching the desktop app. The deployed default backend URL is used otherwise.

## Features

### 1. OpenRouter Chat Completion Service
- Automatic retry with exponential backoff
- Timeout handling (default: 30 seconds)
- Rate limit handling with `Retry-After` header support
- Network error recovery
- JSON response format support

### 2. API Key Management
- **Static API Key**: Use a pre-generated OpenRouter API key
- **Dynamic Key Generation**: Use Management API to generate keys on-demand
- In-memory caching (24-hour TTL) to avoid duplicate key generation
- Secure key storage (never logged or exposed to frontend)

### 3. Usage Tracking & Rate Limiting
- User-wise request tracking (daily/monthly limits)
- Database-backed usage statistics
- Configurable limits per user
- Token usage tracking

### 4. PDF Resume Analysis
- Structured resume analysis with skills, experience, education
- Uses `openrouter/free` model by default (configurable)
- JSON-structured output

## Setup Instructions

### Step 1: Get OpenRouter API Key

#### Option A: Static API Key (Recommended for Development)

1. Go to [OpenRouter](https://openrouter.ai)
2. Sign up or log in
3. Navigate to API Keys page
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-`)

#### Option B: Management API Key (For Production)

1. Go to [OpenRouter Management API Keys](https://openrouter.ai/management-api-keys)
2. Click "Create New Key"
3. Enter a name (e.g., "BypassIQ Backend")
4. Set expiration date (recommended: 1 year)
5. Copy the key (starts with `sk-or-v1-`)
6. **Important**: This key is only for key management, not for chat completions

### Step 2: Configure Environment Variables

Edit `/backend/.env.local` (or create it):

```bash
# Required: OpenRouter API Key (static)
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: OpenRouter Management API Key (for dynamic key generation)
OPENROUTER_MANAGEMENT_API_KEY=sk-or-v1-your-management-key-here

# AI Provider
AI_PROVIDER=openrouter

# Model Selection
AI_MODEL=openrouter/free
OPENROUTER_PDF_MODEL=openrouter/free

# User Limits
AI_USER_DAILY_REQUESTS=100
AI_USER_MONTHLY_REQUESTS=1000
```

### Step 3: Database Setup

The backend will automatically create the `api_usage_tracking` table on startup. Ensure your PostgreSQL database is running:

```bash
# Check database connection
psql postgresql://localhost:5432/justcilledai
```

### Step 4: Install Dependencies

The backend already has required dependencies. No additional installation needed.

### Step 5: Start the Backend

```bash
cd backend
node server.js
```

You should see:
```
[Backend] License server running on port 3000
[Backend] Database initialized
```

## Usage

### Generate Interview Questions

**Endpoint**: `POST /api/documents/questions`

**Headers**:
- `X-File-Name`: Document filename (e.g., `resume.pdf`)
- `X-User-ID`: User identifier for rate limiting (optional, defaults to IP)

**Body**: Raw file bytes (Content-Type: application/octet-stream)

**Query Parameters**:
- `count`: Number of questions to generate (default: 10, max: 15)

**Example**:
```bash
curl -X POST http://localhost:3000/api/documents/questions?count=5 \
  -H "X-File-Name: resume.pdf" \
  -H "X-User-ID: user123" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @resume.pdf
```

**Response**:
```json
{
  "success": true,
  "cached": false,
  "ocrUsed": false,
  "documentName": "resume.pdf",
  "provider": "openrouter",
  "model": "openrouter/free",
  "questionCount": 5,
  "usage": {
    "inputTokens": 1234,
    "outputTokens": 567,
    "totalTokens": 1801
  },
  "questions": [
    {
      "question": "What is your experience with JavaScript?",
      "answer": "I have 5 years of experience with JavaScript...",
      "category": "Technical",
      "difficulty": "Medium"
    }
  ]
}
```

### Analyze Resume

**Endpoint**: `POST /api/documents/analyze`

**Headers**:
- `X-File-Name`: Document filename
- `X-User-ID`: User identifier (optional)

**Body**: Raw file bytes

**Example**:
```bash
curl -X POST http://localhost:3000/api/documents/analyze \
  -H "X-File-Name: resume.pdf" \
  -H "X-User-ID: user123" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @resume.pdf
```

**Response**:
```json
{
  "success": true,
  "documentName": "resume.pdf",
  "provider": "openrouter",
  "model": "openrouter/free",
  "analysis": {
    "summary": "Experienced software engineer with 5 years of experience...",
    "skills": ["JavaScript", "Python", "React", "Node.js"],
    "experience": [
      {
        "role": "Senior Developer",
        "company": "Tech Corp",
        "years": "2020-2023"
      }
    ],
    "education": [
      {
        "degree": "BS Computer Science",
        "institution": "University of Tech"
      }
    ],
    "strengths": ["Strong problem-solving skills", "Team leadership"],
    "improvements": ["Could add more cloud experience"]
  },
  "usage": {
    "inputTokens": 2345,
    "outputTokens": 890,
    "totalTokens": 3235
  }
}
```

## Model Selection

### Free Models
- `openrouter/free`: Rotating free models (recommended for testing)
- `google/gemma-7b-it:free`: Gemma 7B model
- `meta-llama/llama-3-8b-instruct:free`: Llama 3 8B

### Paid Models
- `openai/gpt-4o`: GPT-4 Omni (best quality)
- `openai/gpt-4o-mini`: GPT-4 Mini (good balance)
- `anthropic/claude-3.5-sonnet`: Claude 3.5 Sonnet

Configure models in `.env.local`:
```bash
AI_MODEL=openrouter/free  # For interview questions
OPENROUTER_PDF_MODEL=openrouter/free  # For resume analysis
```

## Rate Limiting

### User Limits
Configure in `.env.local`:
```bash
AI_USER_DAILY_REQUESTS=100
AI_USER_MONTHLY_REQUESTS=1000
```

### API Rate Limits
OpenRouter has its own rate limits. The service automatically:
- Respects `Retry-After` headers
- Implements exponential backoff
- Retries up to 3 times for transient errors

### Error Responses

**Rate Limit Exceeded** (HTTP 429):
```json
{
  "success": false,
  "error": "Daily request limit exceeded (100/100)",
  "dailyUsage": 100,
  "monthlyUsage": 450
}
```

## Security Best Practices

1. **Never commit API keys** to git
2. **Use Management API keys** with expiration dates
3. **Monitor usage** regularly via database queries
4. **Set appropriate limits** for your use case
5. **Rotate keys** periodically (especially for production)

## Troubleshooting

### Error: "No API key available"
**Solution**: Set `OPENROUTER_API_KEY` or `OPENROUTER_MANAGEMENT_API_KEY` in `.env.local`

### Error: "API key expired"
**Solution**: Generate a new key from OpenRouter dashboard and update `.env.local`

### Error: "Daily request limit exceeded"
**Solution**: Increase `AI_USER_DAILY_REQUESTS` or wait until the next day

### Error: "relation api_usage_tracking does not exist"
**Solution**: Restart the backend server to run database migrations

### Slow response times
**Solution**: 
- Use faster models (e.g., `openai/gpt-4o-mini` instead of `openai/gpt-4o`)
- Reduce `maxTokens` in config
- Check network connectivity

## Monitoring

### Check Usage Statistics

Run this SQL query in your database:
```sql
SELECT 
  user_id,
  request_date,
  request_count,
  total_tokens
FROM api_usage_tracking
ORDER BY request_date DESC, request_count DESC
LIMIT 100;
```

### Reset User Usage (Admin)

If you need to reset a user's limits:
```sql
DELETE FROM api_usage_tracking WHERE user_id = 'user123';
```

## Cost Estimation

Using `openrouter/free` model:
- **Approximate cost**: $0.00 (free tier)
- **Rate limits**: May be slower or queue during high demand

Using paid models (e.g., `openai/gpt-4o-mini`):
- **Input**: $0.15 / 1M tokens
- **Output**: $0.60 / 1M tokens
- **Typical interview question generation**: ~2,000 tokens = ~$0.001
- **Typical resume analysis**: ~3,000 tokens = ~$0.002

## Desktop App Integration

The desktop app Settings UI already includes OpenRouter as a provider option:
1. Open Settings in the desktop app
2. Select "OpenRouter (Multi-provider)" from the AI Provider dropdown
3. Enter your OpenRouter API key
4. Set model name (e.g., `openrouter/free` or `openai/gpt-4o`)

## Support

For issues related to:
- **OpenRouter API**: https://openrouter.ai/docs
- **This integration**: Check backend logs for detailed error messages
