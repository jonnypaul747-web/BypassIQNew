import React, { useState, useEffect } from 'react';
import {
  FileText,
  Trash2,
  CheckCircle2,
  XCircle,
  FileCode,
  AlertCircle,
} from 'lucide-react';
import { ContextDocument } from '../../shared/types/index.js';
import { FileUpload } from '../components/FileUpload';

export const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<ContextDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<ContextDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    if (!window.electronAPI) return;
    try {
      const list = await window.electronAPI.listDocuments();
      setDocuments(list);
      if (list.length > 0 && !selectedDoc) {
        setSelectedDoc(list[0]);
      }
    } catch (err: any) {
      console.error('[DocumentsView] Error loading docs:', err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!window.electronAPI) return;

    setSelectedFile(file);
    setIsImporting(true);
    setError(null);
    try {
      const filePath = (file as any).path;
      if (!filePath) {
        throw new Error('Unable to resolve native file path.');
      }
      const res = await window.electronAPI.importDocument(filePath);

      if (res.success && res.document) {
        setDocuments((prev) => [res.document!, ...prev]);
        setSelectedDoc(res.document);
        setSelectedFile(null);
      } else {
        setError(res.error || 'Failed to import document');
        setSelectedFile(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error importing file');
      setSelectedFile(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    if (!window.electronAPI) return;
    const next = !current;
    await window.electronAPI.toggleDocument(id, next);
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, enabled: next } : d))
    );
    if (selectedDoc?.id === id) {
      setSelectedDoc({ ...selectedDoc, enabled: next });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.removeDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (selectedDoc?.id === id) {
      setSelectedDoc(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex gap-4 p-4 overflow-hidden h-full">
      {/* Left Column: Document List & Import */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm gap-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm text-slate-200">Personal Context & Resumes</span>
          </div>

          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClear={() => setSelectedFile(null)}
            isUploading={isImporting}
            buttonText="Add Document"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-2 py-8">
              <FileText className="w-8 h-8 text-slate-600" />
              <p className="text-sm">No context documents yet</p>
              <p className="text-xs text-slate-600 max-w-xs">
                Upload your resume, job description, or technical cheat sheet (.pdf, .docx, .md, .txt) to personalize AI answers.
              </p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDoc(doc)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                  selectedDoc?.id === doc.id
                    ? 'bg-slate-800/90 border-emerald-500/60 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                    {doc.fileType}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-200 truncate">{doc.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {formatBytes(doc.sizeBytes)} • {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(doc.id, doc.enabled);
                    }}
                    title={doc.enabled ? 'Included in AI context' : 'Excluded from AI context'}
                    className={`p-1 rounded transition-colors ${
                      doc.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {doc.enabled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(doc.id);
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Document Content Preview */}
      <div className="w-1/2 flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-4 overflow-hidden shadow-lg backdrop-blur-sm gap-3">
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-200 truncate">
            {selectedDoc ? `Extracted Content: ${selectedDoc.name}` : 'Document Preview'}
          </span>
          {selectedDoc && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                selectedDoc.enabled
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {selectedDoc.enabled ? 'Active In Prompt Context' : 'Disabled'}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed pr-1">
          {selectedDoc ? (
            selectedDoc.extractedText || 'No readable text content extracted.'
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-1 py-12">
              <FileCode className="w-6 h-6 text-slate-600" />
              <p>Select a document on the left to preview its extracted text.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

