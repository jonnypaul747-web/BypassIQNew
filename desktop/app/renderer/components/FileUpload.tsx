import React from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear?: () => void;
  accept?: string;
  isUploading?: boolean;
  label?: string;
  buttonText?: string;
  className?: string;
  variant?: 'button' | 'dashed';
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  selectedFile,
  onClear,
  accept = '.pdf,.docx,.txt,.md',
  isUploading = false,
  label = 'Upload Document',
  buttonText = 'Select File',
  className = '',
  variant = 'button',
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  if (variant === 'dashed') {
    return (
      <div className={className}>
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          id="file-upload-input"
          disabled={isUploading}
        />
        <label
          htmlFor="file-upload-input"
          className="flex flex-col items-center gap-3 cursor-pointer w-full"
        >
          <Upload className="w-12 h-12 text-slate-400" />
          <div className="text-slate-300">
            {selectedFile ? (
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">{selectedFile.name}</span>
                {onClear && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onClear();
                    }}
                    className="text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="font-medium">Click to select a file</p>
                <p className="text-sm text-slate-400">PDF, DOCX, TXT, or MD files</p>
              </>
            )}
          </div>
        </label>
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id="file-upload-input"
        disabled={isUploading}
      />
      <label
        htmlFor="file-upload-input"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
          isUploading
            ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-emerald-300'
        }`}
      >
        <Upload className="w-3.5 h-3.5" />
        <span>{isUploading ? 'Uploading...' : buttonText}</span>
      </label>

      {selectedFile && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate max-w-xs">{selectedFile.name}</span>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="text-slate-400 hover:text-red-400 transition-colors"
              title="Remove file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
