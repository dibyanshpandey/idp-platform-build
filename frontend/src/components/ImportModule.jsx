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

  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('llama-3.3-70b-versatile');

  const providers = {
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    anthropic: ['claude-3-5-sonnet-latest', 'claude-3-haiku-20240307']
  };

  const handleProviderChange = (e) => {
    const p = e.target.value;
    setProvider(p);
    setModel(providers[p][0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0], { provider, model });
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0], { provider, model });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Settings className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">LLM Configuration</h3>
              <p className="text-[10px] text-slate-500">Choose the brain for this extraction</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Provider</label>
              <select 
                value={provider} 
                onChange={handleProviderChange}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="groq">Groq (Fastest)</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Model</label>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {providers[provider].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div 
          className={`relative border-2 border-dashed m-6 rounded-lg flex flex-col items-center justify-center p-12 transition-all ${isDragging ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isLoading ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-emerald-600 rounded-full animate-spin"></div>
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Processing document via Agentic Chain...</p>
            </div>
          ) : (
            <>
              <UploadCloud className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" strokeWidth={1} />
              <h3 className="text-slate-800 dark:text-slate-100 text-lg font-bold mb-1 text-center">Ready for Ingestion</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-6 max-w-sm">
                Drag and drop your PDF or image here. Our **Agentic Auditor** will verify the results using **{model}**.
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
              >
                Select Files
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
