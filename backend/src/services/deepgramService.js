const { Deepgram } = require('@deepgram/sdk');
const { deepgramApiKey } = require('../config').ai;

let deepgram;

function initDeepgram() {
  if (!deepgramApiKey) {
    console.warn('[Deepgram] Deepgram API key not found. STT will not work.');
    return;
  }
  deepgram = new Deepgram(deepgramApiKey);
  console.log('[Deepgram] Deepgram client initialized.');
}

function createDeepgramLiveTranscriptionSocket(options = {}) {
  if (!deepgram) {
    throw new Error('[Deepgram] Deepgram not initialized. Call initDeepgram() first.');
  }

  return deepgram.listen.live({
    model: 'nova-3',
    language: 'multi',
    smart_format: true,
    interim_results: true,
    punctuate: true,
    vad_events: true,
    encoding: 'linear16',
    sample_rate: 16000,
    ...options,
  });
}

module.exports = {
  initDeepgram,
  createDeepgramLiveTranscriptionSocket,
};
