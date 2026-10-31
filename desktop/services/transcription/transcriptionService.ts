import WebSocket from 'ws';
import { TranscriptionSegment, TranscriptionProvider } from '../../shared/types/index.js';

export interface TranscriptionCallbacks {
  onSegment: (segment: TranscriptionSegment) => void;
  onError: (error: string) => void;
  onStateChange: (state: 'connected' | 'disconnected' | 'reconnecting') => void;
}

export class TranscriptionService {
  private provider: TranscriptionProvider;
  private apiKey: string;
  private ws: WebSocket | null = null;
  private callbacks: TranscriptionCallbacks | null = null;
  private isRunning: boolean = false;
  private currentPartialId: string | null = null;
  private segmentCounter: number = 0;

  constructor(provider: TranscriptionProvider = 'mock', apiKey: string = '') {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  public setConfig(provider: TranscriptionProvider, apiKey: string): void {
    this.provider = provider;
    this.apiKey = apiKey;
  }

  public start(callbacks: TranscriptionCallbacks): void {
    this.callbacks = callbacks;
    this.isRunning = true;
    this.segmentCounter = 0;

    if (this.provider === 'deepgram') {
      this.startDeepgramStream();
    } else {
      this.callbacks.onStateChange('connected');
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.callbacks?.onStateChange('disconnected');
    this.currentPartialId = null;
  }

  /**
   * Receives incoming audio chunk (e.g. PCM / webm audio buffer)
   */
  public processAudioChunk(chunk: Buffer): void {
    if (!this.isRunning) return;

    if (this.provider === 'deepgram' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  /**
   * Directly injects a transcript segment (used by Web Speech API in renderer or OpenAI Whisper)
   */
  public handleTranscriptSegment(text: string, isFinal: boolean, speaker?: string): void {
    if (!this.isRunning || !text.trim()) return;

    if (isFinal) {
      const finalId = `seg_${Date.now()}_${++this.segmentCounter}`;
      this.callbacks?.onSegment({
        id: finalId,
        text: text.trim(),
        isFinal: true,
        timestamp: Date.now(),
        speaker: speaker || 'Speaker 1',
        confidence: 0.95,
      });
      this.currentPartialId = null;
    } else {
      if (!this.currentPartialId) {
        this.currentPartialId = `partial_${Date.now()}`;
      }
      this.callbacks?.onSegment({
        id: this.currentPartialId,
        text: text.trim(),
        isFinal: false,
        timestamp: Date.now(),
        speaker: speaker || 'Speaker 1',
        confidence: 0.75,
      });
    }
  }

  private startDeepgramStream(): void {
    if (!this.apiKey) {
      this.callbacks?.onError('Deepgram API Key is missing. Please set your API key in Settings or switch to Web Speech.');
      return;
    }

    const url = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true';
    
    try {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      });

      this.ws.on('open', () => {
        this.callbacks?.onStateChange('connected');
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const response = JSON.parse(data.toString());
          const alt = response.channel?.alternatives?.[0];
          const transcript = alt?.transcript;
          if (transcript && transcript.trim()) {
            const isFinal = response.is_final ?? false;
            this.handleTranscriptSegment(transcript, isFinal);
          }
        } catch (err) {
          console.error('[TranscriptionService] Failed to parse Deepgram message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[TranscriptionService] WebSocket error:', err);
        this.callbacks?.onError(err.message);
      });

      this.ws.on('close', () => {
        this.callbacks?.onStateChange('disconnected');
        if (this.isRunning) {
          // Attempt reconnect after 2s
          setTimeout(() => {
            if (this.isRunning) {
              this.callbacks?.onStateChange('reconnecting');
              this.startDeepgramStream();
            }
          }, 2000);
        }
      });
    } catch (err: any) {
      this.callbacks?.onError(err.message || 'Failed to initialize Deepgram WebSocket');
    }
  }
}

