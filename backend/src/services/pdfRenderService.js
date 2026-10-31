const { createCanvas, DOMMatrix, ImageData, Path2D } = require('@napi-rs/canvas');

// pdf.js expects a few browser globals; @napi-rs/canvas provides the implementations.
if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = DOMMatrix;
if (typeof globalThis.ImageData === 'undefined') globalThis.ImageData = ImageData;
if (typeof globalThis.Path2D === 'undefined') globalThis.Path2D = Path2D;

// pdfjs-dist ships an ESM-only build, so it is loaded lazily from this CommonJS file.
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}

/**
 * Renders the first `maxPages` pages of a PDF to PNG buffers, which OCR can read.
 * Only used for scanned PDFs — text PDFs never reach this code.
 */
async function renderPdfPagesToPng(pdfBuffer, { maxPages = 3, scale = 2 } = {}) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const totalPages = doc.numPages;
  const pageCount = Math.min(totalPages, maxPages);
  const images = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');

      // White background: transparent areas confuse OCR.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toBuffer('image/png'));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return { images, totalPages, renderedPages: pageCount };
}

module.exports = { renderPdfPagesToPng };
