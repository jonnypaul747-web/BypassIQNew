import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptionSegment, AudioCaptureState } from '../../shared/types/index.js';

export function useAudioCapture() {
  const [state, setState] = useState<AudioCaptureState>('idle');
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const speechDetectedRef = useRef<boolean>(false);

  // Subscribe to Electron audio state and transcription events
  useEffect(() => {
    if (!window.electronAPI) return;

    const unbindState = window.electronAPI.onAudioStateChange((newState) => {
      setState(newState as AudioCaptureState);
    });

    const unbindSegment = window.electronAPI.onTranscriptionSegment((segment) => {
      setSegments((prev) => {
        if (!segment.isFinal) {
          const existingIdx = prev.findIndex((s) => !s.isFinal);
          if (existingIdx !== -1) {
            const next = [...prev];
            next[existingIdx] = segment;
            return next;
          }
          return [...prev, segment];
        } else {
          const filtered = prev.filter((s) => s.isFinal);
          return [...filtered, segment];
        }
      });
    });

    return () => {
      unbindState();
      unbindSegment();
    };
  }, []);

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setVolumeLevel(0);
  };

  const start = useCallback(async () => {
    try {
      setError(null);
      setState('recording');

      // Request real microphone audio stream from browser / Electron
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
      } catch (micErr: any) {
        console.warn('[useAudioCapture] getUserMedia error:', micErr);
        setError(`Microphone access error: ${micErr.message}. Check macOS System Settings > Privacy > Microphone.`);
      }

      // Initialize real-time Web Audio API Analyser for live visual feedback & VAD
      if (stream) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const checkVolume = () => {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
            analyser.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const normalized = Math.min(100, Math.round((average / 128) * 100));
            setVolumeLevel(normalized);

            // Voice activity detection
            if (normalized > 15) {
              speechDetectedRef.current = true;
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
            } else if (speechDetectedRef.current && !silenceTimerRef.current) {
              // Silence detected after speech
              silenceTimerRef.current = setTimeout(() => {
                speechDetectedRef.current = false;
                silenceTimerRef.current = null;
              }, 1200);
            }

            animFrameRef.current = requestAnimationFrame(checkVolume);
          };

          checkVolume();
        } catch (ctxErr) {
          console.warn('[useAudioCapture] AudioContext setup failed:', ctxErr);
        }
      }

      // Initialize Web Speech API if supported by environment
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const text = result[0].transcript;
              const isFinal = result.isFinal;
              if (window.electronAPI) {
                window.electronAPI.sendTranscriptEvent(text, isFinal, 'Speaker');
              }
            }
          };

          recognition.onerror = (evt: any) => {
            console.warn('[SpeechRecognition] error:', evt.error);
            // If offline or network error in standalone Electron, inform user
            if (evt.error === 'network') {
              console.info('[SpeechRecognition] Electron default speech engine needs API keys or local transcription.');
            }
          };

          recognition.onend = () => {
            if (recognitionRef.current && state === 'recording') {
              try {
                recognition.start();
              } catch {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (recErr) {
          console.warn('[SpeechRecognition] initialization failed:', recErr);
        }
      }

      // Notify Electron main process
      if (window.electronAPI) {
        await window.electronAPI.startAudio();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start audio capture');
      setState('error');
    }
  }, [state]);

  const stop = useCallback(async () => {
    stopAudioAnalysis();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    setState('idle');
    if (window.electronAPI) {
      await window.electronAPI.stopAudio();
    }
  }, []);

  const pause = useCallback(async () => {
    setState('paused');
    if (window.electronAPI) {
      await window.electronAPI.pauseAudio();
    }
  }, []);

  const resume = useCallback(async () => {
    setState('recording');
    if (window.electronAPI) {
      await window.electronAPI.resumeAudio();
    }
  }, []);

  const clearSegments = useCallback(() => {
    setSegments([]);
  }, []);

  /**
   * Helper to directly push a spoken voice segment (used for voice testing or external STT models)
   */
  const simulateVoiceInput = useCallback((text: string, isFinal = true) => {
    if (window.electronAPI) {
      window.electronAPI.sendTranscriptEvent(text, isFinal, 'User (Mic)');
    }
  }, []);

  return {
    state,
    segments,
    volumeLevel,
    error,
    start,
    stop,
    pause,
    resume,
    clearSegments,
    simulateVoiceInput,
  };
}
