import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptionSegment, AudioCaptureState } from '../../shared/types/index.js';

// Deepgram's linear16 stream is opened at 16 kHz mono, so audio is converted to that.
const TARGET_SAMPLE_RATE = 16000;

/** Averages samples down to the target rate (cheap, good enough for speech). */
function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return input;
  }
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j];
    }
    output[i] = sum / Math.max(1, end - start);
  }
  return output;
}

function toPcm16(samples: Float32Array): ArrayBuffer {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm.buffer;
}

/**
 * Captures the computer's OUTPUT audio (the teacher / interviewer in Google Meet, Zoom,
 * an online class tab) instead of the microphone, and streams it as 16 kHz PCM to the
 * main process for transcription.
 *
 * The physical microphone is deliberately never opened here — that is the stream the
 * interview mode ignores, so only the other side of the call reaches the AI.
 */
export function useSystemAudioCapture() {
  const [state, setState] = useState<AudioCaptureState>('idle');
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unbindState = window.electronAPI.onAudioStateChange((newState) => {
      setState((prev) => (prev === 'error' ? prev : (newState as AudioCaptureState)));
    });

    const unbindSegment = window.electronAPI.onTranscriptionSegment((segment) => {
      setSegments((prev) => {
        if (segment.isFinal) {
          return [...prev.filter((s) => s.isFinal), segment];
        }
        const partialIndex = prev.findIndex((s) => !s.isFinal);
        if (partialIndex === -1) {
          return [...prev, segment];
        }
        const next = [...prev];
        next[partialIndex] = segment;
        return next;
      });
    });

    return () => {
      unbindState();
      unbindSegment();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setVolumeLevel(0);
  }, []);

  const stop = useCallback(async () => {
    cleanup();
    setState('idle');
    if (window.electronAPI) {
      await window.electronAPI.stopAudio();
    }
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setState('recording');

    try {
      // getDisplayMedia with audio gives the system output track (loopback). The video
      // track is stopped immediately — only the sound is needed.
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      displayStream.getVideoTracks().forEach((track) => track.stop());

      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach((track) => track.stop());
        setError(
          'No system audio track was shared. On macOS 13+ tick "Share system audio" in the picker; on Windows enable "Share system audio" as well.'
        );
        setState('error');
        return;
      }

      const audioStream = new MediaStream(audioTracks);
      streamRef.current = audioStream;

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(audioStream);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (!window.electronAPI) return;
        const input = event.inputBuffer.getChannelData(0);
        const resampled = downsample(input, audioContext.sampleRate, TARGET_SAMPLE_RATE);
        window.electronAPI.sendAudioChunk(toPcm16(resampled));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const meter = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          sum += data[i];
        }
        setVolumeLevel(Math.min(100, Math.round((sum / data.length / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(meter);
      };
      meter();

      await window.electronAPI?.startAudio();
      setState('recording');
    } catch (err: any) {
      cleanup();
      setError(
        `Could not capture system audio: ${err?.message || 'unknown error'}. Check Screen Recording permission for JustCilledAI.`
      );
      setState('error');
    }
  }, [cleanup]);

  const clearSegments = useCallback(() => setSegments([]), []);

  return { state, segments, volumeLevel, error, start, stop, clearSegments };
}
