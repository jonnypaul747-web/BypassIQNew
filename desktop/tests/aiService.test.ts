import { describe, it, expect } from 'vitest';
import { AiService } from '../services/ai/aiService.js';
import { ContextDocument } from '../shared/types/index.js';

describe('AiService', () => {
  const service = new AiService({
    provider: 'mock',
    modelName: 'mock-gpt',
    apiKey: '',
    temperature: 0.3,
    responseStyle: 'short',
    autoDetectQuestions: true,
    maxContextTokens: 4000,
    customInstructions: 'Act as expert technical assistant.',
  });

  it('assembles contextual prompt with documents and screen OCR', () => {
    const mockDoc: ContextDocument = {
      id: 'doc1',
      name: 'Resume.pdf',
      fileType: 'pdf',
      extractedText: 'Senior Software Engineer with 7 years of distributed systems experience in Go and TypeScript.',
      sizeBytes: 1024,
      createdAt: Date.now(),
      enabled: true,
    };

    const promptObj = service.buildPrompt({
      question: 'What is your background in distributed systems?',
      style: 'short',
      transcriptHistory: ['Interviewer: Welcome to the interview.'],
      screenOcrContext: 'Code editor: class DistributedMap {}',
      activeDocuments: [mockDoc],
    });

    expect(promptObj.userPrompt).toContain('Resume.pdf');
    expect(promptObj.userPrompt).toContain('distributed systems experience');
    expect(promptObj.userPrompt).toContain('DistributedMap');
    expect(promptObj.userPrompt).toContain('What is your background in distributed systems?');
    expect(promptObj.documentsUsed).toEqual(['Resume.pdf']);
  });

  it('streams tokens and produces correct response for code style', async () => {
    const tokens: string[] = [];
    const result = await service.generateAnswer({
      question: 'two sum algorithm',
      style: 'code',
      onToken: (tok) => tokens.push(tok),
    });

    expect(tokens.length).toBeGreaterThan(0);
    expect(result.answer).toContain('```typescript');
    expect(result.codeBlocks.length).toBeGreaterThan(0);
    expect(result.codeBlocks[0]).toContain('solveProblem');
  });

  it('supports request cancellation via AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await service.generateAnswer({
      question: 'Explain quicksort',
      style: 'short',
      signal: controller.signal,
    });

    expect(result).toBeDefined();
  });
});

