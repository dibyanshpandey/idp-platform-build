import React, { useState, useEffect } from 'react';
import { FileSearch, Sparkles } from 'lucide-react';

export default function ClassificationPanel({ documentId, documentType, confidenceScore }) {
  const [currentType, setCurrentType] = useState('');

  useEffect(() => {
    if (documentType) {
      setCurrentType(documentType);
    }
  }, [documentType]);

  const type = currentType || "Unclassified Document";
  const conf = confidenceScore || 92;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm rounded-sm transition-colors duration-200">
      <div className="flex items-center gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-sm transition-colors duration-200">
          <FileSearch className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
            AI Classification
            <span className="text-emerald-500 dark:text-emerald-400 font-bold flex items-center gap-0.5 normal-case tracking-normal">
              <Sparkles className="w-3 h-3" /> Auto-Detected
            </span>
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded px-3 py-1 font-sans shadow-sm inline-block">
              {type}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Confidence</p>
        <div className="flex items-center gap-2 justify-end">
          <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">{conf}%</span>
          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${conf}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

