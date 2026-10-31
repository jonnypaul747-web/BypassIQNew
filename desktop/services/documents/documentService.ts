import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { ContextDocument } from '../../shared/types/index.js';

export class DocumentService {
  /**
   * Reads and extracts readable text from supported document types: TXT, MD, PDF, DOCX
   */
  public async extractText(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.txt':
      case '.md':
      case '.markdown':
        return fs.readFileSync(filePath, 'utf-8');

      case '.pdf': {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await (pdf as any)(dataBuffer);
        return data.text || '';
      }

      case '.docx': {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || '';
      }

      default:
        throw new Error(`Unsupported document format: ${ext}. Supported formats are .txt, .md, .pdf, .docx`);
    }
  }

  /**
   * Imports a document file from path, parses its content, and creates a ContextDocument object
   */
  public async importDocument(filePath: string): Promise<ContextDocument> {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const validExts: ContextDocument['fileType'][] = ['txt', 'md', 'pdf', 'docx'];
    const fileType = validExts.includes(ext as any) ? (ext as ContextDocument['fileType']) : 'txt';

    const extractedText = await this.extractText(filePath);
    const cleanedText = extractedText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: path.basename(filePath),
      fileType,
      extractedText: cleanedText,
      sizeBytes: stats.size,
      createdAt: Date.now(),
      enabled: true,
    };
  }

  /**
   * Scores and finds the most relevant excerpts across enabled documents for a given query
   */
  public searchRelevantSnippets(documents: ContextDocument[], query: string, maxSnippets = 5): string[] {
    const queryTokens = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    if (queryTokens.length === 0) return [];

    const snippets: { text: string; score: number }[] = [];

    for (const doc of documents) {
      if (!doc.enabled || !doc.extractedText) continue;

      // Split into paragraphs / logical sections
      const paragraphs = doc.extractedText.split(/\n\s*\n/).filter((p) => p.trim().length > 30);

      for (const para of paragraphs) {
        const lowerPara = para.toLowerCase();
        let score = 0;
        for (const token of queryTokens) {
          if (lowerPara.includes(token)) {
            score += 1;
          }
        }

        if (score > 0) {
          snippets.push({
            text: `[${doc.name}]: ${para.trim()}`,
            score,
          });
        }
      }
    }

    snippets.sort((a, b) => b.score - a.score);
    return snippets.slice(0, maxSnippets).map((s) => s.text);
  }
}

