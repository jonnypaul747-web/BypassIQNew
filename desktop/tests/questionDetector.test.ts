import { describe, it, expect } from 'vitest';
import { QuestionDetector } from '../services/ai/questionDetector.js';

describe('QuestionDetector', () => {
  it('detects direct questions with question marks', () => {
    const res = QuestionDetector.analyze('What is the difference between BFS and DFS?');
    expect(res.isQuestion).toBe(true);
    expect(res.type).toBe('direct_question');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects interrogative sentences without question marks', () => {
    const res = QuestionDetector.analyze('How would you implement an LRU cache');
    expect(res.isQuestion).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects technical prompts and coding instructions', () => {
    const res = QuestionDetector.analyze('Write a function to reverse a linked list');
    expect(res.isQuestion).toBe(true);
    expect(res.type).toBe('technical_prompt');
  });

  it('filters out casual filler phrases', () => {
    const res1 = QuestionDetector.analyze('yeah cool');
    expect(res1.isQuestion).toBe(false);

    const res2 = QuestionDetector.analyze('um let me see');
    expect(res2.isQuestion).toBe(false);
  });

  it('extracts latest question from a stream of segments', () => {
    const segments = [
      { text: 'Hello everyone thanks for joining today.', isFinal: true },
      { text: 'Yeah so we are discussing the system architecture.', isFinal: true },
      { text: 'Can you explain how the data pipeline handles backpressure?', isFinal: true },
    ];
    const latest = QuestionDetector.extractLatestQuestion(segments);
    expect(latest).toBe('Can you explain how the data pipeline handles backpressure?');
  });
});

