import React, { useRef, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';

export default function ImportModule({ onFileUpload, isLoading }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-slate-50 p-6">
      <div 
        className={`w-full max-w-2xl border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-12 transition-colors ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="text-slate-600 text-sm font-medium">Processing document via pipeline...</p>
          </div>
        ) : (
          <>
            <UploadCloud className="w-12 h-12 text-slate-400 mb-4" strokeWidth={1.5} />
            <h3 className="text-slate-800 text-lg font-bold mb-1">Import Document</h3>
            <p className="text-slate-500 text-sm text-center mb-6 max-w-sm">
              Drag and drop your PDF or image here to begin extraction and metadata analysis.
            </p>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".pdf,image/*" 
            />
            <button 
              onClick={() => fileInputRef.current.click()}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-sm"
            >
              Browse Files
            </button>
          </>
        )}
      </div>
    </div>
  );
}
