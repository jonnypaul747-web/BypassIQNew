import { describe, it, expect } from 'vitest';
import { TranscriptionService } from '../services/transcription/transcriptionService.js';
import { TranscriptionSegment } from '../shared/types/index.js';

describe('TranscriptionService', () => {
  it('handles partial and final transcript segments properly', () => {
    const service = new TranscriptionService('mock');
    const received: TranscriptionSegment[] = [];

    service.start({
      onSegment: (seg) => received.push(seg),
      onError: () => {},
      onStateChange: () => {},
    });

    // 1. Partial segment
    service.handleTranscriptSegment('Hello, can you', false);
    expect(received.length).toBe(1);
    expect(received[0].isFinal).toBe(false);
    expect(received[0].text).toBe('Hello, can you');

    // 2. Updated partial
    service.handleTranscriptSegment('Hello, can you hear me', false);
    expect(received.length).toBe(2);
    expect(received[1].isFinal).toBe(false);
    expect(received[1].id).toBe(received[0].id); // same partial ID

    // 3. Finalized segment
    service.handleTranscriptSegment('Hello, can you hear me properly?', true);
    expect(received.length).toBe(3);
    expect(received[2].isFinal).toBe(true);
    expect(received[2].text).toBe('Hello, can you hear me properly?');
    expect(received[2].confidence).toBeGreaterThan(0.9);

    service.stop();
  });
});

