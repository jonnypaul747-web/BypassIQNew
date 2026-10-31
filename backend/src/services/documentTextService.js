const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { ocr } = require('../config');
const { renderPdfPagesToPng } = require('./pdfRenderService');
const { recognizeImage } = require('./ocrService');

const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown'];

/**
 * Removes the whitespace noise PDF/DOCX/OCR extraction leaves behind, so the same
 * text costs far fewer tokens.
 */
function normalizeText(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Scanned PDFs have no text layer, so the pages are rendered to images and OCR'd.
 * Only the first `OCR_MAX_PAGES` pages are read to keep the request fast.
 */
async function ocrPdfPages(pdfBuffer) {
  const { images, totalPages, renderedPages } = await renderPdfPagesToPng(pdfBuffer, {
    maxPages: ocr.maxPages,
    scale: ocr.scale,
  });

  if (renderedPages < totalPages) {
    console.log(`[Backend] OCR read ${renderedPages}/${totalPages} pages (OCR_MAX_PAGES cap)`);
  }

  const parts = [];
  for (const image of images) {
    const text = await recognizeImage(image);
    if (text) {
      parts.push(text);
    }
  }

  return parts.join('\n\n');
}

/**
 * Extracts text from an uploaded file. PDFs with (almost) no text layer fall back to
 * OCR, which is why the result reports `usedOcr`.
 * Returns `{ text, usedOcr }`.
 */
async function extractDocument(buffer, fileName) {
  const extension = path.extname(fileName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Unsupported file type "${extension || 'unknown'}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  let raw;
  if (extension === '.pdf') {
    try {
      const parsed = await pdf(buffer);
      raw = parsed.text || '';
    } catch (err) {
      // PDF parsing failed (e.g., Bad XRef entry, corrupted PDF)
      console.error('[Backend] PDF parsing failed:', err.message);
      // If OCR is enabled, fall back to OCR. Otherwise, rethrow the error.
      if (!ocr.enabled) {
        throw new Error(`PDF parsing failed: ${err.message}. Enable OCR for scanned/corrupted PDFs.`);
      }
      // Clear raw text so OCR fallback will be triggered
      raw = '';
    }
  } else if (extension === '.docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    raw = parsed.value || '';
  } else {
    raw = buffer.toString('utf8');
  }

  let text = normalizeText(raw);
  let usedOcr = false;

  if (extension === '.pdf' && ocr.enabled && (!text || text.length < ocr.minTextChars)) {
    const reason = !text ? 'no text layer (parsing failed or empty)' : `text layer has ${text.length} chars`;
    console.log(`[Backend] PDF ${reason} — falling back to OCR`);
    try {
      const ocrText = await ocrPdfPages(buffer);
      const merged = normalizeText([text, ocrText].filter(Boolean).join('\n\n'));
      if (merged.length > text.length) {
        text = merged;
        usedOcr = true;
      }
    } catch (err) {
      console.error('[Backend] OCR fallback failed:', err.message);
      if (!text) {
        throw new Error(`This PDF has no text layer and OCR failed: ${err.message}`);
      }
    }
  }

  if (!text) {
    throw new Error(
      'No readable text found in the document. Scanned PDFs need OCR, which is disabled or found nothing.'
    );
  }

  return { text, usedOcr };
}

/**
 * Text-only wrapper, kept for callers that do not care whether OCR was used.
 */
async function extractText(buffer, fileName) {
  const { text } = await extractDocument(buffer, fileName);
  return text;
}

/**
 * Keeps the prompt inside a fixed character budget: the start of the document
 * (name, summary, contact, skills) plus its end (recent experience, education).
 * This is what keeps each request at ~1.5k input tokens instead of the whole file.
 */
function truncateForPrompt(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }

  const headLength = Math.floor(maxChars * 0.6);
  const tailLength = maxChars - headLength;

  return `${text.slice(0, headLength).trimEnd()}\n\n[... middle of document omitted to save tokens ...]\n\n${text
    .slice(-tailLength)
    .trimStart()}`;
}

module.exports = { extractDocument, extractText, truncateForPrompt, SUPPORTED_EXTENSIONS };
