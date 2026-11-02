const crypto = require('crypto');
const WebSocket = require('ws');
const { liveClassAccessKey } = require('../config');
const { transcribeLiveAudio } = require('./liveClassService');

const STREAM_PATH = '/api/live/stream';
const AUDIO_BATCH_BYTES = 32_000;
const MAX_PENDING_AUDIO_BYTES = 512 * 1024;
const MAX_LIVE_CONNECTIONS = 10;

function hasValidAccessKey(request) {
  if (!liveClassAccessKey) return false;

  const supplied = Buffer.from(request.headers['x-live-class-key'] || '');
  const expected = Buffer.from(liveClassAccessKey);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function rejectUpgrade(socket, status, message) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function hasSpeechEnergy(pcmAudio) {
  const sampleCount = Math.floor(pcmAudio.length / 2);
  if (!sampleCount) return false;

  let sumSquares = 0;
  for (let offset = 0; offset + 1 < pcmAudio.length; offset += 2) {
    const sample = pcmAudio.readInt16LE(offset);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / sampleCount) >= 120;
}

function pcm16MonoToWav(pcmAudio) {
  const wav = Buffer.alloc(44 + pcmAudio.length);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + pcmAudio.length, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcmAudio.length, 40);
  pcmAudio.copy(wav, 44);
  return wav;
}

function initWebSocket(server) {
  const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: 64 * 1024,
    perMessageDeflate: false,
  });

  server.on('upgrade', (request, socket, head) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://localhost').pathname;
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    if (pathname !== STREAM_PATH) {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    if (!hasValidAccessKey(request)) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    if (wss.clients.size >= MAX_LIVE_CONNECTIONS) {
      rejectUpgrade(socket, 503, 'Service Unavailable');
      return;
    }

    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit('connection', client, request);
    });
  });

  wss.on('connection', (client) => {
    let audioChunks = [];
    let audioBytes = 0;
    let queuedAudioBytes = 0;
    let transcriptionQueue = Promise.resolve();
    let isClosing = false;
    let isFlushing = false;

    const send = (payload) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    };

    const queueTranscription = (pcmAudio) => {
      if (!pcmAudio.length || !hasSpeechEnergy(pcmAudio) || (isClosing && !isFlushing)) {
        return transcriptionQueue;
      }
      queuedAudioBytes += pcmAudio.length;
      if (queuedAudioBytes > MAX_PENDING_AUDIO_BYTES) {
        send({ type: 'error', message: 'Live transcription is overloaded. Reconnect and try again.' });
        client.close(1009, 'Transcription queue limit exceeded');
        return transcriptionQueue;
      }

      transcriptionQueue = transcriptionQueue.then(async () => {
        try {
          const wavAudio = pcm16MonoToWav(pcmAudio);
          const result = await transcribeLiveAudio(wavAudio.toString('base64'));
          if (result.text) {
            send({ type: 'transcript', content: result.text, isFinal: true });
          }
        } catch (error) {
          console.error('[Voice Agent] OpenRouter transcription failed:', error.message);
          send({ type: 'error', message: error.message || 'Live transcription failed.' });
          isClosing = true;
          client.close(1011, 'Transcription failed');
        } finally {
          queuedAudioBytes -= pcmAudio.length;
        }
      });
      return transcriptionQueue;
    };

    const takeBufferedAudio = () => {
      if (!audioBytes) return Buffer.alloc(0);
      const pcmAudio = Buffer.concat(audioChunks, audioBytes);
      audioChunks = [];
      audioBytes = 0;
      return pcmAudio;
    };

    const flush = async () => {
      if (isClosing || isFlushing) return;
      isFlushing = true;
      queueTranscription(takeBufferedAudio());
      await transcriptionQueue;
      isClosing = true;
      send({ type: 'flushed' });
      client.close(1000, 'Audio flushed');
    };

    send({ type: 'ready' });

    client.on('message', (message, isBinary) => {
      if (!isBinary) {
        let control;
        try {
          control = JSON.parse(message.toString());
        } catch {
          client.close(1003, 'Binary PCM audio or a flush command is required');
          return;
        }
        if (control.type === 'flush') {
          void flush();
        } else {
          client.close(1003, 'Unsupported voice-agent command');
        }
        return;
      }

      const chunk = Buffer.from(message);
      audioBytes += chunk.length;
      if (audioBytes + queuedAudioBytes > MAX_PENDING_AUDIO_BYTES) {
        send({ type: 'error', message: 'Live transcription is overloaded. Reconnect and try again.' });
        client.close(1009, 'Audio queue limit exceeded');
        return;
      }

      audioChunks.push(chunk);
      if (audioBytes >= AUDIO_BATCH_BYTES) {
        queueTranscription(takeBufferedAudio());
      }
    });

    client.on('close', () => {
      isClosing = true;
      audioChunks = [];
      audioBytes = 0;
    });

    client.on('error', (error) => {
      console.error('[WebSocket] Live client error:', error.message);
      isClosing = true;
    });
  });

  console.log(`[WebSocket] Authenticated voice stream available at ${STREAM_PATH}`);
}

module.exports = { initWebSocket };