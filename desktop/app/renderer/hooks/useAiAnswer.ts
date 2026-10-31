import { useState, useEffect, useCallback } from 'react';
import { ResponseStyle } from '../../shared/types/index.js';

export function useAiAnswer() {
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [codeBlocks, setCodeBlocks] = useState<string[]>([]);
  const [documentsUsed, setDocumentsUsed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unbind = window.electronAPI.onAiStreamChunk((data) => {
      if (data.question) {
        setCurrentQuestion(data.question);
        setAnswer('');
        setError(null);
        setIsStreaming(true);
      }

      if (data.token) {
        setAnswer((prev) => prev + data.token);
      }

      if (data.isComplete) {
        setIsStreaming(false);
        if (data.answer) setAnswer(data.answer);
        if (data.codeBlocks) setCodeBlocks(data.codeBlocks);
        if (data.documentsUsed) setDocumentsUsed(data.documentsUsed);
        if (data.error) setError(data.error);
      }
    });

    return () => unbind();
  }, []);

  const generate = useCallback(
    async (question: string, style?: ResponseStyle, screenContext?: string, documentId?: string) => {
      if (!question.trim()) return;
      setCurrentQuestion(question);
      setAnswer('');
      setError(null);
      setIsStreaming(true);
      setCodeBlocks([]);
      setDocumentsUsed([]);

      try {
        if (window.electronAPI) {
          const res = await window.electronAPI.generateAnswer({
            question,
            style,
            screenContext,
            documentId,
          });
          if (!res.success && res.error) {
            setError(res.error);
            setIsStreaming(false);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Generation failed');
        setIsStreaming(false);
      }
    },
    []
  );

  const cancel = useCallback(async () => {
    setIsStreaming(false);
    if (window.electronAPI) {
      await window.electronAPI.cancelGeneration();
    }
  }, []);

  const clear = useCallback(() => {
    setCurrentQuestion('');
    setAnswer('');
    setCodeBlocks([]);
    setDocumentsUsed([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    currentQuestion,
    answer,
    isStreaming,
    codeBlocks,
    documentsUsed,
    error,
    generate,
    cancel,
    clear,
  };
}

