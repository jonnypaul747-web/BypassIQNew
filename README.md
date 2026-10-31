# JustCilledAI — Two Separate Projects

This repository contains two **independent** projects. They are built, installed and hosted separately, so you can
deploy only the backend to a server while users install the desktop app on their own machines.

| | [`desktop/`](desktop) | [`backend/`](backend) |
| :--- | :--- | :--- |
| **What it is** | Electron + React AI assistant with mic transcription, screen OCR and a floating HUD | Express + SQLite license/subscription API |
| **Who runs it** | The end user, from a packaged `.dmg` / `.exe` installer | You, on a VPS / Railway / Fly.io / Render host |
| **Own dependencies** | [`desktop/package.json`](desktop/package.json) — client + AI SDKs only | [`backend/package.json`](backend/package.json) — `express`, `cors`, `sqlite3` |
| **Install** | `cd desktop && npm ci` | `cd backend && npm install --omit=dev` |
| **Run** | `cd desktop && npm run dev` (or the packaged app) | `cd backend && npm start` |
| **Build / ship** | `npm run package:mac` / `npm run package:win` | Just deploy the folder |

Nothing is shared between the two at build time: the desktop project does not import backend code, and the backend
does not serve the UI. They talk only over HTTP.

## Why the split matters

The desktop app talks to OpenAI / Anthropic / Gemini / Deepgram **directly from the user's machine**. Audio,
transcripts, screenshots and AI traffic never pass through your server — the only request that hits it is a small
JSON license check (on activation, then hourly). That keeps hosting bandwidth, CPU and storage near zero, and means
a user's AI usage costs them, not your server.

The one exception is **document → Q&A generation**: the document is uploaded to the backend, which extracts the text
and calls the AI with that server's `OPENAI_API_KEY` (trimmed to a ~6k character budget so it stays cheap). Results are
cached per document hash, so re-uploading the same file costs no tokens. See
[backend/README.md](backend/README.md#document--qa-generation).

## How they connect

One setting on the desktop side points the app at your deployed backend:

```
desktop/shared/config.ts  →  LICENSE_BACKEND_URL
```

It defaults to `http://localhost:3000` for local development and can be overridden with the `LICENSE_BACKEND_URL`
environment variable. The backend accepts requests from any origin (`cors()` with defaults), which is what a
packaged desktop client needs.

Endpoints and deployment steps: [`backend/README.md`](backend/README.md). A licence is required before the app will
generate answers, and there is currently no in-app activation screen — see [Known gaps](#known-gaps).

## Run both locally

```bash
# terminal 1 — license server
cd backend
npm install
npm start                      # http://localhost:3000

# terminal 2 — desktop app
cd desktop
npm ci
npm run dev                    # Vite on :5173 + Electron
```

The app starts with `LICENSE_BACKEND_URL` unset, which means it looks for the license server on
`http://localhost:3000` — exactly the process started in terminal 1.

## Deploy only the backend

1. Upload the `backend/` folder alone to your host (not the repo root — `desktop/node_modules` is ~800 MB).
2. `npm install --omit=dev`
3. Set `PORT` if your host requires it (defaults to `3000`).
4. Set `OPENAI_API_KEY` if you want document → Q&A generation (without it that endpoint returns `503`; the rest of
the API works fine). Optionally set `API_KEY` as a shared secret for server-to-server calls — desktop clients send
their license key instead, and each client is limited to `AI_RATE_LIMIT_MAX` requests per window.
5. `npm start`
6. Give the process a **persistent volume** — `subscriptions.db` holds every license key and lives next to
   `server.js`.
7. Put an HTTPS URL in front of it, then set that URL in `desktop/shared/config.ts` and rebuild the installer.

## Package the desktop app

```bash
cd desktop
npm run build                  # renderer (Vite) + main/preload (tsc)
npm run package:mac            # .dmg + .app  → desktop/release/
npm run package:win            # NSIS + portable → desktop/release/
npm test                       # Vitest suite
```

Only `desktop/dist` and `desktop/package.json` are packaged, so backend code and server libraries can never leak
into an installer.

## Docs

- [`desktop/README.md`](desktop/README.md) — app features, usage, keyboard shortcuts, provider costs
- [`desktop/TECHNOLOGIES.md`](desktop/TECHNOLOGIES.md) — stack and cross-platform notes
- [`backend/README.md`](backend/README.md) — API, deployment, persistence and what is not implemented
- [`SUBSCRIPTION_SYSTEM.md`](SUBSCRIPTION_SYSTEM.md) — full licensing/subscription design, including Stripe plans

## Known gaps

- **No license activation UI.** `handleGenerateAnswer` refuses to run without a stored license, and document → Q&A
  now needs one too (the backend rejects unlicensed clients), but the renderer has no screen to enter a key. A fresh
  install therefore cannot generate answers until a license is activated.
- **Payments are not wired up.** `/api/create-subscription` is called by hand; Stripe is only designed, not built.
- **No request auth on the backend.** Anyone holding a valid key can validate it, and key creation has no auth at
  all — treat it as an admin endpoint until that is added.
