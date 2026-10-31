import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { desktopCapturer } from 'electron';
import Tesseract from 'tesseract.js';
import { DisplaySource, OcrResult } from '../../shared/types/index.js';

export class ScreenService {
  private lastCapturedHash: string | null = null;
  private lastOcrResult: OcrResult | null = null;
  private tmpDir: string;

  constructor() {
    this.tmpDir = path.join(os.tmpdir(), 'parakeet-screen');
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  /**
   * Retrieves available screens and application windows using Electron desktopCapturer
   */
  public async getAvailableSources(): Promise<DisplaySource[]> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });

      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
        isMain: s.id.startsWith('screen:0'),
      }));
    } catch (err) {
      console.error('[ScreenService] Error listing desktop sources:', err);
      return [];
    }
  }

  /**
   * Executes Tesseract.js OCR on a given image file (Cross-platform for Mac & Windows)
   */
  public async runVisionOcr(imagePath: string): Promise<OcrResult> {
    try {
      console.log('[ScreenService] Starting Tesseract OCR for:', imagePath);

      const result = await Tesseract.recognize(
        imagePath,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[ScreenService] OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        }
      );

      const text = result.data.text;
      const lineTexts = text.split('\n').filter((lineText) => lineText.trim().length > 0);
      const lines = lineTexts.map((lineText) => ({
        text: lineText.trim(),
        confidence: 0.9, // Tesseract.js confidence not easily accessible in simple mode
        box: [0, 0, 0, 0], // Bounding box not available in simple mode
      }));

      console.log('[ScreenService] OCR completed successfully');

      return {
        success: true,
        text: text.trim(),
        lines: lines.filter((l) => l.text.length > 0),
        error: undefined,
      };
    } catch (error) {
      console.error('[ScreenService] Tesseract OCR failed:', error);
      return {
        success: false,
        text: '',
        lines: [],
        error: error instanceof Error ? error.message : 'Unknown OCR error',
      };
    }
  }

  /**
   * Captures the selected window or screen, saves a temporary image, and runs Tesseract.js OCR.
   * Works on both Mac and Windows. If the screenshot is identical to the last one (unchanged),
   * returns the cached OCR result to save CPU.
   */
  public async captureAndOcr(sourceId?: string): Promise<{
    ocrResult: OcrResult;
    imagePath: string;
    isDuplicate: boolean;
  }> {
    const timestamp = Date.now();
    const imagePath = path.join(this.tmpDir, `capture_${timestamp}.png`);

    // Capture using desktopCapturer high-res stream or fallback
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    const targetSource =
      (sourceId && sources.find((s) => s.id === sourceId)) ||
      sources.find((s) => s.id.startsWith('screen:0')) ||
      sources[0];

    if (!targetSource) {
      throw new Error('No capture source available. Ensure screen recording permissions are granted in System Settings.');
    }

    const pngBuffer = targetSource.thumbnail.toPNG();
    fs.writeFileSync(imagePath, pngBuffer);

    // Compute hash to avoid re-processing identical screen frames
    const hash = crypto.createHash('md5').update(pngBuffer).digest('hex');
    if (hash === this.lastCapturedHash && this.lastOcrResult) {
      // Clean up the temp duplicate image
      try { fs.unlinkSync(imagePath); } catch {}
      return {
        ocrResult: this.lastOcrResult,
        imagePath,
        isDuplicate: true,
      };
    }

    this.lastCapturedHash = hash;
    const ocrResult = await this.runVisionOcr(imagePath);
    this.lastOcrResult = ocrResult;

    return {
      ocrResult,
      imagePath,
      isDuplicate: false,
    };
  }

  /**
   * Cleans up temporary screenshot images
   */
  public cleanupTempFiles(): void {
    try {
      if (fs.existsSync(this.tmpDir)) {
        const files = fs.readdirSync(this.tmpDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(this.tmpDir, file));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[ScreenService] Cleanup temp files error:', err);
    }
  }
}

