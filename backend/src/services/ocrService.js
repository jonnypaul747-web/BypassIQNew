const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

// Language data is downloaded once by tesseract.js and kept here, so the first OCR
// request is slow and later ones are not.
const CACHE_DIR = path.join(__dirname, '..', '..', '.tesseract-cache');

let workerPromise = null;
// One tesseract worker handles one image at a time, so jobs are queued.
let queue = Promise.resolve();

async function getWorker() {
  if (!workerPromise) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    workerPromise = createWorker('eng', 1, { cachePath: CACHE_DIR }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Runs OCR on a PNG/JPEG buffer and returns the recognised text.
 * Jobs are serialised because a tesseract worker is stateful.
 */
async function recognizeImage(imageBuffer) {
  const worker = await getWorker();
  const job = queue.then(() => worker.recognize(imageBuffer));
  queue = job.then(
    () => undefined,
    () => undefined
  );

  const { data } = await job;
  return (data && data.text ? data.text : '').trim();
}

/**
 * Frees the worker and its WASM memory. Used by tests and graceful shutdown.
 */
async function terminateWorker() {
  if (!workerPromise) {
    return;
  }
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch (err) {
    console.error('[Backend] Could not terminate OCR worker:', err.message);
  }
}

module.exports = { recognizeImage, terminateWorker, CACHE_DIR };
