import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DocumentService } from '../services/documents/documentService.js';
import { ContextDocument } from '../shared/types/index.js';

describe('DocumentService', () => {
  const service = new DocumentService();

  it('imports and parses markdown files', async () => {
    const tempFile = path.join(os.tmpdir(), `test_${Date.now()}.md`);
    fs.writeFileSync(tempFile, '# Title\n\nThis is a sample document for testing context injection.');

    const doc = await service.importDocument(tempFile);
    expect(doc.name).toBe(path.basename(tempFile));
    expect(doc.fileType).toBe('md');
    expect(doc.extractedText).toContain('This is a sample document');

    fs.unlinkSync(tempFile);
  });

  it('ranks relevant snippets for a search query', () => {
    const docs: ContextDocument[] = [
      {
        id: '1',
        name: 'Distributed.md',
        fileType: 'md',
        extractedText: 'Raft consensus algorithm ensures state machine replication across a cluster of nodes.\n\nCSS flexbox layouts align items along main and cross axes.',
        sizeBytes: 100,
        createdAt: Date.now(),
        enabled: true,
      },
    ];

    const snippets = service.searchRelevantSnippets(docs, 'How does Raft consensus work?');
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets[0]).toContain('Raft consensus algorithm');
  });
});

