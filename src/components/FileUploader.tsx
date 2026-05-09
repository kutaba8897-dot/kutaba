import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileUploaderProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export default function FileUploader({ onUpload, isLoading }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        onUpload(file);
        setError(null);
      } else {
        setError("يرجى رفع ملف PDF فقط.");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
      setError(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6" id="uploader-container">
      <div
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 transition-all duration-200 ease-in-out flex flex-col items-center justify-center text-center",
          dragActive ? "border-blue-500 bg-blue-50/50" : "border-slate-200 bg-white",
          isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-slate-300",
          error ? "border-red-200 bg-red-50/10" : ""
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleChange}
          accept="application/pdf"
          disabled={isLoading}
          id="file-input"
        />
        
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-slate-600 font-medium">جاري معالجة الملف وتحويله إلى اختبار...</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">ارفع المواد الدراسية</h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              اسحب وأفلت ملف PDF الخاص بك هنا، أو انقر لاختياره من جهازك.
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> PDF فقط</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> سريع وذكي</span>
            </div>
          </>
        )}
        
        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
