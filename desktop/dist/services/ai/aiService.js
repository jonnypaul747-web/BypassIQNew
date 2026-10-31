import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
export class AiService {
    settings;
    constructor(settings) {
        this.settings = settings;
    }
    // Helper to get API key from settings or env
    getApiKey() {
        return this.settings.apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    }
    updateSettings(settings) {
        this.settings = settings;
    }
    /**
     * Builds an optimized system and contextual prompt based on conversation history,
     * OCR screen text, and enabled context documents (resumes, job notes, etc.)
     */
    buildPrompt(options) {
        const { question, style, transcriptHistory = [], screenOcrContext, activeDocuments = [] } = options;
        let styleInstruction = '';
        switch (style) {
            case 'short':
                styleInstruction = 'Provide a razor-sharp, ultra-concise answer in 1 to 3 sentences maximum. Get straight to the key point.';
                break;
            case 'detailed':
                styleInstruction = 'Provide a comprehensive, well-structured explanation covering nuances, trade-offs, and deep insights.';
                break;
            case 'bullet':
                styleInstruction = 'Provide a structured bullet-point list highlighting the most critical talking points or facts.';
                break;
            case 'step-by-step':
                styleInstruction = 'Provide a numbered, sequential step-by-step walkthrough or resolution guide.';
                break;
            case 'technical':
                styleInstruction = 'Provide a senior-level technical explanation including architecture, data flow, time/space complexity, and systems internals.';
                break;
            case 'code':
                styleInstruction = 'Provide a clean, production-ready, idiomatic code solution in fenced markdown blocks with brief inline comments and explanation of time/space complexity.';
                break;
        }
        const systemPrompt = [
            this.settings.customInstructions || 'You are an ultra-fast, helpful real-time desktop AI copilot.',
            `Desired Style: ${style.toUpperCase()}`,
            styleInstruction,
            'Maintain extreme clarity and do not hallucinate. If the context contains relevant information, prioritize it directly.',
        ].join('\n\n');
        const promptSections = [];
        // 1. Relevant Document context (RAG)
        const documentsUsed = [];
        if (activeDocuments && activeDocuments.length > 0) {
            const docSnippets = activeDocuments
                .filter((d) => d.enabled && d.extractedText)
                .map((doc) => {
                documentsUsed.push(doc.name);
                // Limit individual doc snippet length to 2500 chars for prompt balance
                const textSnippet = doc.extractedText.slice(0, 2500);
                return `--- DOCUMENT: ${doc.name} ---\n${textSnippet}`;
            });
            if (docSnippets.length > 0) {
                promptSections.push(`### USER REFERENCE DOCUMENTS (Resume/Notes):\n${docSnippets.join('\n\n')}`);
            }
        }
        // 2. Screen OCR context
        if (screenOcrContext && screenOcrContext.trim()) {
            promptSections.push(`### CURRENT SCREEN VISIBLE CONTENT (OCR):\n${screenOcrContext.trim()}`);
        }
        // 3. Recent conversation / audio context
        if (transcriptHistory && transcriptHistory.length > 0) {
            const recentHistory = transcriptHistory.slice(-10).join('\n');
            promptSections.push(`### RECENT CONVERSATION CONTEXT:\n${recentHistory}`);
        }
        // 4. The direct question / prompt
        promptSections.push(`### CURRENT QUESTION / DIRECTIVE:\n${question}`);
        const userPrompt = promptSections.join('\n\n');
        return { systemPrompt, userPrompt, documentsUsed };
    }
    /**
     * Generates a streaming or buffered response across configured AI providers
     */
    async generateAnswer(options) {
        const { systemPrompt, userPrompt, documentsUsed } = this.buildPrompt(options);
        switch (this.settings.provider) {
            case 'openai':
                return this.generateOpenAI(systemPrompt, userPrompt, documentsUsed, options);
            case 'anthropic':
                return this.generateAnthropic(systemPrompt, userPrompt, documentsUsed, options);
            case 'gemini':
                return this.generateGemini(systemPrompt, userPrompt, documentsUsed, options);
            case 'deepseek':
                return this.generateDeepSeek(systemPrompt, userPrompt, documentsUsed, options);
            case 'ollama':
                return this.generateOllama(systemPrompt, userPrompt, documentsUsed, options);
            case 'mock':
            default:
                return this.generateMock(systemPrompt, userPrompt, documentsUsed, options);
        }
    }
    async generateOpenAI(systemPrompt, userPrompt, documentsUsed, options) {
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API Key is missing. Please set your API key in Settings.');
        }
        const client = new OpenAI({ apiKey: this.settings.apiKey });
        let fullAnswer = '';
        const stream = await client.chat.completions.create({
            model: this.settings.modelName || 'gpt-4o',
            temperature: this.settings.temperature ?? 0.3,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            stream: true,
        }, { signal: options.signal });
        for await (const chunk of stream) {
            if (options.signal?.aborted)
                break;
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullAnswer += content;
                options.onToken?.(content);
            }
        }
        return {
            answer: fullAnswer,
            codeBlocks: this.extractCodeBlocks(fullAnswer),
            documentsUsed,
        };
    }
    async generateDeepSeek(systemPrompt, userPrompt, documentsUsed, options) {
        if (!this.settings.apiKey) {
            throw new Error('DeepSeek API Key is missing. Please set your API key in Settings.');
        }
        // DeepSeek exposes an OpenAI-compatible API, so the OpenAI SDK works as-is.
        const client = new OpenAI({
            apiKey: this.settings.apiKey,
            baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        });
        let fullAnswer = '';
        const stream = await client.chat.completions.create({
            model: this.settings.modelName || 'deepseek-chat',
            temperature: this.settings.temperature ?? 0.3,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            stream: true,
        }, { signal: options.signal });
        for await (const chunk of stream) {
            if (options.signal?.aborted)
                break;
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullAnswer += content;
                options.onToken?.(content);
            }
        }
        return {
            answer: fullAnswer,
            codeBlocks: this.extractCodeBlocks(fullAnswer),
            documentsUsed,
        };
    }
    async generateAnthropic(systemPrompt, userPrompt, documentsUsed, options) {
        if (!this.settings.apiKey) {
            throw new Error('Anthropic API Key is missing. Please set your API key in Settings.');
        }
        const client = new Anthropic({ apiKey: this.settings.apiKey });
        let fullAnswer = '';
        const stream = await client.messages.stream({
            model: this.settings.modelName || 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            temperature: this.settings.temperature ?? 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        }, { signal: options.signal });
        for await (const event of stream) {
            if (options.signal?.aborted)
                break;
            if (event.type === 'content_block_delta' && event.delta.text) {
                const text = event.delta.text;
                fullAnswer += text;
                options.onToken?.(text);
            }
        }
        return {
            answer: fullAnswer,
            codeBlocks: this.extractCodeBlocks(fullAnswer),
            documentsUsed,
        };
    }
    async generateGemini(systemPrompt, userPrompt, documentsUsed, options) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('Google Gemini API Key is missing. Please set your API key in Settings.');
        }
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: this.settings.modelName || 'gemini-1.5-flash',
            systemInstruction: systemPrompt,
            generationConfig: {
                temperature: this.settings.temperature ?? 0.3,
            },
        });
        const result = await model.generateContentStream(userPrompt);
        let fullAnswer = '';
        for await (const chunk of result.stream) {
            if (options.signal?.aborted)
                break;
            const text = chunk.text();
            if (text) {
                fullAnswer += text;
                options.onToken?.(text);
            }
        }
        return {
            answer: fullAnswer,
            codeBlocks: this.extractCodeBlocks(fullAnswer),
            documentsUsed,
        };
    }
    async generateOllama(systemPrompt, userPrompt, documentsUsed, options) {
        const baseUrl = 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.settings.modelName || 'llama3',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                stream: true,
            }),
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(`Ollama error (${response.status}): ${response.statusText}. Ensure Ollama is running locally on port 11434.`);
        }
        let fullAnswer = '';
        const reader = response.body?.getReader();
        if (!reader)
            throw new Error('No readable stream from Ollama.');
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done || options.signal?.aborted)
                break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((l) => l.trim());
            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    const text = json.message?.content || '';
                    if (text) {
                        fullAnswer += text;
                        options.onToken?.(text);
                    }
                }
                catch {
                    // ignore partial json
                }
            }
        }
        return {
            answer: fullAnswer,
            codeBlocks: this.extractCodeBlocks(fullAnswer),
            documentsUsed,
        };
    }
    async generateMock(_systemPrompt, _userPrompt, documentsUsed, options) {
        const { question, style } = options;
        const mockResponses = {
            short: `To address "${question}": Focus on the core objective, isolate state mutations, and leverage memoization for optimal O(1) retrieval.`,
            detailed: `When approaching "${question}", consider both system architecture and operational characteristics.\n\n1. Primary Concept: Decompose into independent functional layers.\n2. Trade-offs: Memory locality vs asymptotic complexity.\n3. Recommendation: Implement an event-driven observer pattern to decouple transcription and LLM inference.`,
            bullet: `Key points for "${question}":\n• Fast response latency (< 300ms)\n• Zero hallucination through context grounding\n• Structured token streaming\n• Resilient fallback across multiple AI providers`,
            'step-by-step': `Resolution for "${question}":\n1. Inspect incoming audio frame buffer.\n2. Stream PCM chunks to transcription engine.\n3. Filter out conversational fillers using the Question Detector.\n4. Synthesize contextual prompt and dispatch to streaming LLM.`,
            technical: `Technical Architecture for "${question}":\n- Complexity: O(N) where N is token stream length.\n- Concurrency: Managed via Node.js Event Loop with AbortController for instantaneous cancellation.\n- IPC Serialization: Zero-copy ArrayBuffer transfer for audio frames.`,
            code: `Here is the solution for "${question}":\n\n\`\`\`typescript\n// Optimized solution\nexport function solveProblem<T>(input: T[]): T[] {\n  const seen = new Set<T>();\n  return input.filter((item) => {\n    if (seen.has(item)) return false;\n    seen.add(item);\n    return true;\n  });\n}\n\`\`\`\n*Time Complexity: O(N) | Space Complexity: O(N)*`,
        };
        const answer = mockResponses[style] || mockResponses.short;
        const tokens = answer.split(' ');
        for (let i = 0; i < tokens.length; i++) {
            if (options.signal?.aborted)
                break;
            const part = tokens[i] + (i < tokens.length - 1 ? ' ' : '');
            options.onToken?.(part);
            await new Promise((r) => setTimeout(r, 20)); // realistic streaming cadence
        }
        return {
            answer,
            codeBlocks: this.extractCodeBlocks(answer),
            documentsUsed,
        };
    }
    extractCodeBlocks(text) {
        const blocks = [];
        const regex = /```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            blocks.push(match[1].trim());
        }
        return blocks;
    }
}
