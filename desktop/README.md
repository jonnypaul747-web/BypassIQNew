# JustCilledAI — Real-Time Desktop AI Assistant for macOS & Windows

A real-time desktop AI assistant named **JustCilledAI**, engineered for cross-platform desktop use (macOS and Windows).

The application provides continuous speech transcription, intelligent question detection, context-aware AI answer streaming, Tesseract.js OCR screen understanding (cross-platform), and a lightweight, draggable floating HUD window designed for effortless reference during live calls, technical interviews, and coding sessions.

---

## 📦 This Is the Desktop Half

This folder is one of two independent projects. The license server lives in the sibling [`backend/`](../backend)
project and is deployed on its own host — see the [root README](../README.md) for the split and deployment steps.

- **This project** contains everything the user installs: Electron main/preload, the React UI and all app services.
- **It depends only on its own packages** ([`package.json`](package.json)). Server libraries (`express`, `cors`,
  `sqlite3`) live in [`backend/package.json`](../backend/package.json) and are never bundled into the installer.
- **It connects to the backend through one setting**: [`shared/config.ts`](shared/config.ts) → `LICENSE_BACKEND_URL`
  (overridable with the env var of the same name), defaulting to `http://localhost:3000` for development.

---

## 🌟 Key Features

### 1. Real-Time Audio Engine & Speech-to-Text
- **Low-Latency Streaming Transcription**: Listens to microphone audio with partial results that automatically solidify into finalized segments.
- **Multi-Provider Support**: Supports built-in zero-cost Web Speech API, Deepgram live WebSocket streaming, OpenAI Whisper API, and offline mock STT.
- **Capture Controls**: Start, pause, resume, and stop controls with clean resource teardown and permission verification.
- **Privacy First**: Audio is processed directly in memory; raw audio retention is disabled by default.

### 2. Live AI Answer Engine & Question Detector
- **Automatic Question Detection**: Uses NLP rule-based question and technical prompt detection to automatically detect spoken questions in live conversations without requiring manual submission.
- **Contextual Synthesis**: Injects recent conversation history, user reference documents (resumes, job notes), and visible screen OCR text into the AI context.
- **Streaming Generation**: Answers stream token-by-token directly into the UI in real time.
- **6 Response Styles**:
  - `Short`: 1 to 3 punchy sentences for rapid verbal recall.
  - `Detailed`: Comprehensive multi-layered breakdown.
  - `Bullet Points`: High-impact structured key points.
  - `Step-by-Step`: Sequential execution guide.
  - `Technical`: In-depth systems, concurrency, and complexity explanation.
  - `Code Example`: Clean syntax-highlighted code with time/space complexity analysis.
- **Multi-Provider AI Layer**:
  - OpenAI (GPT-4o, GPT-4o-mini)
  - Anthropic Claude (Claude 3.5 Sonnet, Haiku)
  - Google Gemini (Gemini 1.5 Flash / Pro, Gemini 2.0)
  - Ollama (Local offline models: Llama 3, Mistral, Qwen Coder)
  - Mock Provider (Zero-credential local testing)

### 3. Screen Understanding & Cross-Platform OCR
- **Display & Window Selector**: Interactively choose which desktop screen or application window to inspect.
- **Tesseract.js OCR Engine**: Cross-platform OCR engine using Tesseract.js that works on both macOS and Windows. Provides text extraction from screen captures without platform-specific dependencies.
- **Smart Throttling & De-duplication**: Uses MD5 perceptual hashing to prevent redundant OCR computation or duplicate API uploads when screen content remains static.
- **AI Screen Explainer**: One-click analysis to extract code, error messages, and dialogs directly from the screen and provide immediate bug fixes.

### 4. Floating HUD Answer Window (Parakeet-Style)
- **Always-on-Top Floating Overlay**: Discrete, semi-transparent window that stays above active apps.
- **Global Shortcut**: Press `Cmd + Shift + Space` anywhere on macOS to instantly toggle the HUD.
- **Draggable & Resizable**: Clean title-bar drag handle with custom opacity slider and mini-pill compact mode.
- **Live Ticker**: Shows the latest incoming speech segments alongside the active streaming answer.
- **One-Click Actions**: One-click copy answer to clipboard, style switching, and instant cancellation.

### 5. Personal Context & Document Ingestion (RAG)
- **Supported Formats**: `.txt`, `.md`, `.pdf`, `.docx`.
- **Local Parsing**: Extracted and indexed locally (`pdf-parse`, `mammoth`).
- **Prompt Grounding**: Reference documents (e.g. CV/Resume, interview cheat sheets) are dynamically scored and injected into AI prompts so answers reflect your true experience.

### 6. Interview Live Class Mode
- **Two separate audio streams**: the AI listens only to **system output audio** (the teacher/interviewer in Google Meet, Zoom or an online class tab), captured through Electron's loopback display-media handler.
- **Microphone is ignored by design**: in this mode the physical mic is never opened, so your own voice and room noise cannot reach the AI pipeline.
- **Same answer engine**: system audio is converted to 16 kHz PCM, streamed to the transcription provider, question-detected and answered with the configured AI provider (OpenAI, Anthropic, Gemini, DeepSeek, Ollama or Mock).
- **Where**: Interview → *Live Class* tab.

### 7. Local Storage & Security
- **Security Safeguards**: Strict Electron `contextIsolation: true`, `nodeIntegration: false`, parameterized IPC channel allowlist.
- **Zero Secret Leakage**: API keys stored in local application support storage and never exposed to client bundles.
- **History Management**: Searchable past questions and answers with JSON export and complete deletion controls.

---

## 🛠️ Tech Stack & Architecture

- **Desktop Framework**: Electron 33+ (ESM architecture)
- **UI & Frontend**: React 18, TypeScript 5.7, Vite 6, Tailwind CSS
- **OCR Engine**: Tesseract.js 7.0 (Cross-platform OCR for macOS & Windows)
- **Parsers**: `pdf-parse`, `mammoth`, `ws`
- **Testing**: Vitest 2.1 automated unit and integration suite

---

## 🚀 Getting Started

### Prerequisites
- macOS (Intel or Apple Silicon) or Windows (x64)
- Node.js >= 18 (Tested on Node v22.17.0)

### Installation

```bash
# From the repo root, enter the desktop project
cd desktop

# Install dependencies
npm ci

# Build the Vite React frontend
npm run build:renderer

# Compile the Electron main process and services
npm run build:electron
```

### Running in Development Mode

```bash
# Start Vite and Electron concurrently
npm run dev
```

### Running the Automated Test Suite

```bash
# Run Vitest test suite
npm run test
```

### Packaging for Distribution

**macOS (Apple Silicon & Intel):**
```bash
# Compile and package application bundle in release/
npm run package:mac
```

**Windows (x64):**
```bash
# Compile and package application bundle in release/
npm run package:win
```

---

## ⌨️ Keyboard Shortcuts & Usage Guide

| Shortcut / Control | Action |
| :--- | :--- |
| `Cmd + Shift + Space` | Toggle Floating HUD window from anywhere on macOS |
| `Pin / Unpin Icon` | Toggle Always-On-Top behavior for floating overlay |
| `Expand / Collapse` | Toggle between full HUD and mini-pill compact view |
| `Start Listening` | Request microphone permission and start continuous audio capture |
| `Capture & Extract OCR` | Grab current screen/window and extract visible text with Apple Vision |

---

## 💰 External API Cost Analysis

| Service / Provider | Recommended Model | Pricing (Approx.) | Typical Cost per 1-Hour Session |
| :--- | :--- | :--- | :--- |
| **Local Mock Mode** | Built-in | Free ($0.00) | $0.00 |
| **Local Ollama** | Llama 3 / Qwen 2.5 | Free ($0.00, runs locally) | $0.00 |
| **Tesseract.js OCR** | Cross-platform JavaScript | Free ($0.00, runs locally) | $0.00 |
| **Web Speech API** | Built-in Chromium Engine | Free ($0.00) | $0.00 |
| **OpenAI GPT-4o-mini** | `gpt-4o-mini` | $0.15 / 1M input, $0.60 / 1M output | ~ $0.01 – $0.03 |
| **OpenAI GPT-4o** | `gpt-4o` | $2.50 / 1M input, $10.00 / 1M output | ~ $0.15 – $0.40 |
| **Deepgram STT** | Nova-2 Live WebSocket | $0.0043 / min | ~ $0.25 / hour |
| **Google Gemini 1.5 Flash** | `gemini-1.5-flash` | Free tier or $0.075 / 1M tokens | < $0.01 |

*Recommendation for Personal Use*: Use **Web Speech API** (or Deepgram free credits) + **Gemini 1.5 Flash** or **GPT-4o-mini** + **Tesseract.js OCR** for negligible costs (< $0.05 per multi-hour session).

