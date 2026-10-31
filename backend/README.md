# JustCilledAI License Server

This folder is the **server half** of JustCilledAI. It is deployed on a host (VPS, Railway, Fly.io, Render, etc.)
and is the only part of the project that runs in the cloud. The desktop app is built and shipped separately as an
installer — see the [root README](../README.md).

Keeping them apart is intentional: the desktop app talks to OpenAI / Anthropic / Gemini / Deepgram **directly from
the user's machine**, so audio, transcripts, screenshots and AI traffic never pass through this server. The only
traffic that hits this server is a small JSON license check, which keeps hosting bandwidth negligible.

## What it does

| Endpoint | Purpose |
| :--- | :--- |
| `POST /api/validate-license` | Called by the app on activation and every hour. Body: `{ "licenseKey": "..." }`. Returns `{ valid, expiresAt, userId }` or `{ valid: false, error }`. |
| `POST /api/create-subscription` | Creates a user + subscription + license key. Body: `{ "email": "...", "durationDays": 30 }`. Returns the **plaintext** key once. |
| `GET /api/subscription/:userId` | Latest subscription for a user. |
| `POST /api/documents/questions` | Uploads a document, extracts its text and returns AI-generated question/answer pairs. Requires `X-API-Key`, rate limited per client. See [below](#document--qa-generation). |
| `GET /api/health` | Liveness probe. |

License keys are stored **SHA-256 hashed** — the plaintext key is only returned at creation time, so capture it then
(or wire up email delivery before going live).

## Code layout

Each concern lives in its own file — start at `server.js` and follow the imports down.

| File | What it holds |
| :--- | :--- |
| [`server.js`](server.js) | Entry point: initializes the database, then starts listening on `PORT`. |
| [`src/app.js`](src/app.js) | The Express app: CORS, JSON body parsing, and where route files are mounted under `/api`. |
| [`src/config.js`](src/config.js) | `PORT` and the absolute path of `subscriptions.db`. |
| [`src/db.js`](src/db.js) | SQLite connection, the three `CREATE TABLE` statements, and promise wrappers over the driver. |
| [`src/routes/licenseRoutes.js`](src/routes/licenseRoutes.js) | HTTP handlers for validate / create / lookup — input checks and status codes only. |
| [`src/routes/healthRoutes.js`](src/routes/healthRoutes.js) | `GET /api/health` liveness probe. |
| [`src/routes/documentRoutes.js`](src/routes/documentRoutes.js) | Document upload endpoint: raw body, file name header, count limit, error mapping. |
| [`src/middleware/apiKeyAuth.js`](src/middleware/apiKeyAuth.js) | Requires `X-API-Key` on AI routes and resolves it to a user or the master key. |
| [`src/middleware/rateLimit.js`](src/middleware/rateLimit.js) | Per-client fixed-window request cap for AI routes. |
| [`src/services/licenseService.js`](src/services/licenseService.js) | Key generation, SHA-256 hashing, and the key → subscription checks. |
| [`src/services/subscriptionService.js`](src/services/subscriptionService.js) | User find/create, subscription + license key creation, latest-subscription lookup. |
| [`src/services/documentTextService.js`](src/services/documentTextService.js) | Extracts text from PDF/DOCX/TXT/MD and trims it to a fixed character budget. |
| [`src/services/questionAnswerService.js`](src/services/questionAnswerService.js) | Builds the compact prompt, calls OpenAI, and parses the JSON questions. |
| [`src/services/qaCacheService.js`](src/services/qaCacheService.js) | SQLite cache of generated Q&A, keyed by document hash + count + model. |
| [`src/services/pdfRenderService.js`](src/services/pdfRenderService.js) | Renders PDF pages to PNG with pdf.js + a canvas, used only for scanned PDFs. |
| [`src/services/ocrService.js`](src/services/ocrService.js) | Tesseract worker (lazily started, reused, jobs queued) that turns page images into text. |

Routes validate input and pick the status code; services own the SQL and the business rules; `db.js` is the only
file that touches the driver.

## Document → Q&A generation

`POST /api/documents/questions?count=10`

```bash
curl -X POST "http://localhost:3000/api/documents/questions?count=10" \
  -H "Content-Type: application/octet-stream" \
  -H "X-File-Name: resume.pdf" \
  -H "X-API-Key: $LICENSE_KEY" \
  --data-binary @resume.pdf
```

### Auth and rate limit

This is the only endpoint that spends money, so it is the only one that requires a key. Send
`X-API-Key: <value>` where the value is **either**:

- a customer **license key** from the `license_keys` table (what the desktop app sends), or
- the server's shared secret `API_KEY`, for server-to-server or manual calls.

Every request is also counted per client: a user (all their devices share one bucket) or the master key, with
`AI_RATE_LIMIT_MAX` requests per `AI_RATE_LIMIT_WINDOW_MINUTES`. Responses carry `X-RateLimit-Limit`,
`X-RateLimit-Remaining` and `X-RateLimit-Reset`; when the cap is hit you get `429` plus `Retry-After`.
Counters live in memory: they reset on restart and are per process (fine for one instance, not for several).
The license, health and document-free endpoints stay open.

The file is posted as **raw bytes** (no multipart), so the desktop app can send it with a single `fetch`. Accepted
types: `.pdf`, `.docx`, `.txt`, `.md`, up to 15 MB. Response:

```json
{
  "success": true,
  "cached": false,
  "documentName": "resume.pdf",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "questionCount": 10,
  "usage": { "inputTokens": 1487, "outputTokens": 860, "totalTokens": 2347 },
  "questions": [
    { "question": "...", "answer": "1-2 sentences", "category": "Technical", "difficulty": "Medium" }
  ]
}
```

Errors: `401` missing or invalid API key, `429` rate limit, `400` bad file type / empty body / missing
`X-File-Name`, `503` server has no AI key, `502` provider or parsing failure.

### Keeping tokens low

- The document is **trimmed before the AI call**: `AI_MAX_DOCUMENT_CHARS` (default `6000`, ≈1.5k input tokens) —
  the head and the tail are kept, the middle is dropped with a marker.
- One short system prompt, no few-shot examples, `response_format: json_object` so the model cannot pad with prose.
- Answers are capped at 30 words, and `AI_MAX_OUTPUT_TOKENS` (default `1400`) bounds the response.
- `count` is clamped to `AI_MAX_QUESTIONS` (default `15`).
- The response reports `usage`, and the desktop UI shows the total tokens used.

### Scanned PDFs (OCR fallback)

Resumes exported from phones or scanners often have **no text layer** — `pdf-parse` returns nothing for them. When a PDF
yields fewer than `OCR_MIN_TEXT_CHARS` characters, the backend:

1. renders up to `OCR_MAX_PAGES` pages to PNG with pdf.js + `@napi-rs/canvas` (scale `OCR_SCALE`),
2. OCRs each page with Tesseract (`eng`), reusing one worker across requests,
3. merges the result with any text layer it did find.

Freshly generated responses from that path include `"ocrUsed": true` (the desktop UI then shows "OCR (scanned PDF)");
cache hits report `"cached": true` instead and skip both OCR and the AI call.

Notes for deployment:

- The first OCR request is slow (worker start) and downloads ~15 MB of language data into `backend/.tesseract-cache`,
  which must be **writable and persistent** so it is only downloaded once. Outbound network is needed for that first
  download; bake the folder into your image if the host has no egress.
- OCR costs CPU and a few seconds per page, so only the first pages are read. Increase `OCR_MAX_PAGES` if your
  documents carry key details further down.
- Set `OCR_ENABLED=0` to disable the fallback (scanned PDFs then return `400`).
- OCR output is compared against the document hash cache too, so rescanning the same file costs no CPU or tokens.

### Caching (no tokens on re-upload)

Generated answers are stored in the `document_qa_cache` table, so uploading the same file again never calls the AI:

- **Key:** `sha256(file bytes) : count : model : prompt version`. Same bytes, same question count, same model → hit.
  Asking for a different number of questions, or changing `AI_MODEL` / the prompt, generates a fresh set.
- **Hit:** the response comes back with `cached: true` and `usage: { 0, 0, 0 }`; extraction and the AI call are both
  skipped. The UI shows "cached (no tokens used)".
- **Persistent:** the cache lives in `subscriptions.db`, so it survives restarts. Each row tracks `hits` and
  `last_used_at` for inspection.
- **Safe:** a cache read/write failure is logged and ignored — the request still works.
- Cached requests still count against the rate limit (they are cheap, but not free to serve).
- Nothing is evicted automatically. To reclaim space, run
  `DELETE FROM document_qa_cache WHERE created_at < date('now','-90 day');` on the database.

### Environment variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | — | **Required** for document Q&A. Without it the endpoint returns `503`. |
| `AI_MODEL` | `gpt-4o-mini` | Any chat model the key can access. |
| `AI_MAX_DOCUMENT_CHARS` | `6000` | Character budget sent to the model. |
| `AI_MAX_OUTPUT_TOKENS` | `1400` | Hard cap on the generated JSON. |
| `AI_MAX_QUESTIONS` | `15` | Upper bound for the `count` parameter. |
| `API_KEY` | — | Optional shared secret accepted as an `X-API-Key` for server-to-server calls. |
| `AI_RATE_LIMIT_MAX` | `10` | AI requests allowed per client per window. `0` disables the limit. |
| `AI_RATE_LIMIT_WINDOW_MINUTES` | `60` | Length of the rate-limit window. |
| `OCR_ENABLED` | `1` | Set to `0` to disable the OCR fallback. |
| `OCR_MAX_PAGES` | `3` | How many pages of a scanned PDF are OCR'd. |
| `OCR_SCALE` | `2` | Render scale (higher = sharper text, slower). |
| `OCR_MIN_TEXT_CHARS` | `80` | Below this many characters, a PDF is treated as scanned. |

Only this endpoint spends AI tokens on the server; transcription and live answers still run on the user's machine
with their own key.

## Run locally

```bash
cd backend
npm install
npm start          # http://localhost:3000
```

Smoke test:

```bash
curl http://localhost:3000/api/health
```

The SQLite database (`subscriptions.db`) is created in this folder, next to `server.js`, on first boot. Existing installs of the
desktop app already point here (`http://localhost:3000`) by default.

## Deploy

The server is a single Node process plus one SQLite file, so any Node host works:

1. Upload just this `backend/` folder (not the whole repo).
2. `npm install --omit=dev`
3. Set `PORT` if the host requires it (defaults to `3000`).
4. Start with `npm start`.
5. Make sure the data directory is a **persistent volume** — `subscriptions.db` holds every license key. A host
   with an ephemeral filesystem will silently wipe all licenses on redeploy.

Then point the desktop build at the public URL before packaging (see [Pointing the app at this server](#pointing-the-app-at-this-server)).

## Pointing the app at this server

The app reads `LICENSE_BACKEND_URL` at runtime, and falls back to the value in
[`desktop/shared/config.ts`](../desktop/shared/config.ts) (`http://localhost:3000` by default). For a packaged build
either:

- set the environment variable before launching, or
- change that one constant to your deployed HTTPS URL, then rebuild the app (`cd desktop && npm run package:mac`).

The URL must be reachable over HTTPS in production; plain `http://` works only for local development.

## Not implemented yet

- **Only the AI endpoint is authenticated.** `/api/create-subscription` and `/api/subscription/:userId` are still
  open — protect them (admin secret or network rule) before exposing the server publicly.
- **Payments.** `/api/create-subscription` is called manually today; Stripe Checkout integration is designed in
  [`SUBSCRIPTION_SYSTEM.md`](../SUBSCRIPTION_SYSTEM.md) but not wired up.
- **Admin tooling.** No UI to list users, revoke keys, or refund. Use SQL against `subscriptions.db` for now.
- **Auth.** No request signing, so anyone who learns a valid key can validate it. Treat `/api/create-subscription`
  as an admin-only endpoint.
