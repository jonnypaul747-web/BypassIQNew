import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!content) return null;

  // Split content by code blocks: ```lang ... ```
  const parts = content.split(/(```[\s\S]*?```)/g);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-3 text-slate-200 text-sm leading-relaxed font-sans">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstLineBreak = part.indexOf('\n');
          const lang = part.slice(3, firstLineBreak).trim() || 'code';
          const code = part.slice(firstLineBreak + 1, -3);

          return (
            <div key={index} className="rounded-lg border border-slate-800 bg-slate-900/90 overflow-hidden my-3 shadow-md">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 text-xs text-slate-400 font-mono border-b border-slate-800">
                <span>{lang}</span>
                <button
                  onClick={() => copyCode(code, index)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-700/60 text-slate-300 transition-colors"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Render formatted text paragraphs, bullets, bold items
        const lines = part.split('\n');
        return (
          <div key={index} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return null;

              if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-emerald-400 mt-1 text-xs">•</span>
                    <span>{formatInlineMarkdown(trimmed.replace(/^[-*•]\s+/, ''))}</span>
                  </div>
                );
              }

              if (/^\d+\.\s+/.test(trimmed)) {
                const num = trimmed.match(/^(\d+\.)\s+/)?.[1];
                const textWithoutNum = trimmed.replace(/^\d+\.\s+/, '');
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-emerald-400 font-mono text-xs">{num}</span>
                    <span>{formatInlineMarkdown(textWithoutNum)}</span>
                  </div>
                );
              }

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-sm font-semibold text-emerald-400 pt-1">
                    {trimmed.replace('### ', '')}
                  </h4>
                );
              }

              return <p key={lIdx}>{formatInlineMarkdown(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

function formatInlineMarkdown(text: string): React.ReactNode {
  // Bold: **text**
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((bPart, bIdx) => {
    if (bPart.startsWith('**') && bPart.endsWith('**')) {
      return (
        <strong key={bIdx} className="font-semibold text-slate-100">
          {bPart.slice(2, -2)}
        </strong>
      );
    }
    // Inline code: `text`
    const codeParts = bPart.split(/(`.*?`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith('`') && cPart.endsWith('`')) {
        return (
          <code key={cIdx} className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-xs">
            {cPart.slice(1, -1)}
          </code>
        );
      }
      return cPart;
    });
  });
}

