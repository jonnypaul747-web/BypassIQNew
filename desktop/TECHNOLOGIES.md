# Technologies Used in JustCilledAI

This document provides an overview of all technologies used in the JustCilledAI project and their compatibility with Windows and macOS.

**Status:** Now fully cross-platform compatible for both macOS and Windows!

## Core Framework

| Technology | Version | Windows | macOS | Notes |
|------------|---------|---------|-------|-------|
| **Electron** | 33.2.0 | ✅ Full Support | ✅ Full Support | Cross-platform desktop framework. Works identically on both platforms. |
| **Node.js** | >= 18 | ✅ Full Support | ✅ Full Support | Required runtime. Tested on Node v22.17.0. |
| **TypeScript** | 5.7.2 | ✅ Full Support | ✅ Full Support | Type-safe JavaScript superset. Platform-agnostic. |

## Frontend & UI

| Technology | Version | Windows | macOS | Notes |
|------------|---------|---------|-------|-------|
| **React** | 18.3.1 | ✅ Full Support | ✅ Full Support | UI library. Works identically on both platforms. |
| **React DOM** | 18.3.1 | ✅ Full Support | ✅ Full Support | React renderer for web. Platform-agnostic. |
| **Vite** | 6.0.0 | ✅ Full Support | ✅ Full Support | Build tool and dev server. Cross-platform. |
| **Tailwind CSS** | 3.4.17 | ✅ Full Support | ✅ Full Support | Utility-first CSS framework. Platform-agnostic. |
| **PostCSS** | 8.4.49 | ✅ Full Support | ✅ Full Support | CSS transformation tool. Platform-agnostic. |
| **Autoprefixer** | 10.4.20 | ✅ Full Support | ✅ Full Support | CSS vendor prefixing. Platform-agnostic. |
| **Lucide React** | 0.468.0 | ✅ Full Support | ✅ Full Support | Icon library. Platform-agnostic. |a
| **clsx** | 2.1.1 | ✅ Full Support | ✅ Full Support | Utility for constructing className strings. Platform-agnostic. |
| **tailwind-merge** | 2.5.5 | ✅ Full Support | ✅ Full Support | Utility for merging Tailwind classes. Platform-agnostic. |

## AI/ML Providers

| Technology | Version | Windows | macOS | Notes |
|------------|---------|---------|-------|-------|
| **OpenAI SDK** | 4.73.0 | ✅ Full Support | ✅ Full Support | For GPT-4o, GPT-4o-mini, Whisper. Pure JS SDK. |
| **Anthropic SDK** | 0.32.1 | ✅ Full Support | ✅ Full Support | For Claude 3.5 Sonnet, Haiku. Pure JS SDK. |
| **Google Generative AI** | 0.21.0 | ✅ Full Support | ✅ Full Support | For Gemini 1.5/2.0. Pure JS SDK. |
| **DeepSeek** | (OpenAI-compatible API) | ✅ Full Support | ✅ Full Support | `deepseek-chat` / `deepseek-reasoner` via the OpenAI SDK with a custom base URL. |
| **Ollama** | (via API) | ✅ Full Support | ✅ Full Support | Local models via HTTP API. Platform-agnostic. |

## Speech-to-Text (STT)

| Technology | Windows | macOS | Notes |
|------------|---------|-------|-------|
| **Web Speech API** | ✅ Full Support | ✅ Full Support | Built-in browser API. Free, zero-config. Works on both platforms. |
| **Deepgram WebSocket** | ✅ Full Support | ✅ Full Support | Third-party API via WebSocket. Pure JS implementation. |
| **OpenAI Whisper API** | ✅ Full Support | ✅ Full Support | Third-party API. Pure JS implementation. |
| **Mock STT** | ✅ Full Support | ✅ Full Support | Local testing mode. Platform-agnostic. |

## Document Parsing

| Technology | Version | Windows | macOS | Notes |
|------------|---------|---------|-------|-------|
| **pdf-parse** | 1.1.1 | ✅ Full Support | ✅ Full Support | PDF text extraction. Pure JS library. |
| **mammoth** | 1.8.0 | ✅ Full Support | ✅ Full Support | DOCX text extraction. Pure JS library. |
| **tesseract.js** | 7.0.0 | ✅ Full Support | ✅ Full Support | OCR engine for image text extraction. Cross-platform. |

## Native Components

| Technology | Windows | macOS | Notes |
|------------|---------|-------|-------|
| **Tesseract.js OCR** | ✅ Full Support | ✅ Full Support | Cross-platform JavaScript OCR engine. Works on both platforms without native dependencies. Pure JS implementation. |

## Development Tools

| Technology | Version | Windows | macOS | Notes |
|------------|---------|---------|-------|-------|
| **electron-builder** | 25.1.8 | ✅ Full Support | ✅ Full Support | Packaging tool. Supports both platforms. |
| **concurrently** | 9.1.0 | ✅ Full Support | ✅ Full Support | Run multiple commands concurrently. Platform-agnostic. |
| **wait-on** | 8.0.1 | ✅ Full Support | ✅ Full Support | Wait for resources to be ready. Platform-agnostic. |
| **cross-env** | 7.0.3 | ✅ Full Support | ✅ Full Support | Set environment variables across platforms. Platform-agnostic. |
| **Vitest** | 2.1.8 | ✅ Full Support | ✅ Full Support | Testing framework. Platform-agnostic. |

## WebSocket & Networking

| Technology | Version | Windows | macOS | Notes |
|------------|---------|---------|-------|-------|
| **ws** | 8.18.0 | ✅ Full Support | ✅ Full Support | WebSocket client/server library. Platform-agnostic. |

## Cross-Platform Compatibility Summary

### ✅ Fully Cross-Platform (Windows & macOS)
- Electron application framework
- React frontend and all UI components
- All AI provider SDKs (OpenAI, Anthropic, Google)
- All STT providers (Web Speech API, Deepgram, OpenAI Whisper)
- Document parsing (PDF, DOCX)
- OCR via Tesseract.js (cross-platform)
- WebSocket communication
- Build and packaging tools

### ✅ Complete Feature Parity
- All features work identically on both platforms
- No platform-specific adaptations needed
- Single codebase for both Windows and macOS

## Installation by Platform

### macOS
```bash
npm install
npm run build
npm run dev
```

### Windows
```bash
npm install
npm run build
npm run dev
```

## Packaging for Distribution

### macOS
```bash
npm run package:mac
```
- Creates .dmg installer
- Supports both Apple Silicon (arm64) and Intel (x64)

### Windows
```bash
npm run package:win
```
- Creates .exe installer (NSIS)
- Creates portable version
- Supports x64 architecture

## Conclusion

**JustCilledAI is now 100% cross-platform compatible.** All components including OCR have been migrated to use cross-platform solutions (Tesseract.js). The application works identically on both Windows and macOS with full feature parity.

**Key Changes Made:**
1. Replaced Swift Vision OCR with Tesseract.js (cross-platform)
2. Removed native build dependencies
3. Added Windows packaging configuration
4. Updated build scripts for both platforms

No further platform-specific work is needed. The same codebase builds and runs on both operating systems.
