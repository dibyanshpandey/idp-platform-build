import React, { useState, useEffect } from 'react';
import { FileSearch, Sparkles, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function ClassificationPanel({ documentId, documentType, confidenceScore, onClassifyChange, currentUser }) {
  const [currentType, setCurrentType] = useState('');
  const [learningState, setLearningState] = useState('idle'); // 'idle' | 'learning' | 'learned' | 'error'

  useEffect(() => {
    if (documentType) {
      setCurrentType(documentType);
    }
  }, [documentType]);

  const handleTypeChange = async (e) => {
    const newType = e.target.value;
    const oldType = currentType;
    setCurrentType(newType);
    setLearningState('learning');

    try {
      const response = await axios.post(`http://localhost:3001/api/documents/${documentId}/classify`, {
        document_type: newType
      }, {
        headers: {
          'x-user-id': currentUser?.id
        }
      });

      if (onClassifyChange) {
        onClassifyChange(newType, 100); // Confidence is 100 on manual correction
      }
      setLearningState('learned');
      setTimeout(() => setLearningState('idle'), 4000);
    } catch (err) {
      console.error('Failed to update classification learning loop:', err);
      setCurrentType(oldType);
      setLearningState('error');
      setTimeout(() => setLearningState('idle'), 4000);
    }
  };

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
            Classification 
            {learningState === 'learning' && (
              <span className="text-blue-500 dark:text-blue-400 font-bold flex items-center gap-0.5 animate-pulse normal-case tracking-normal">
                <Sparkles className="w-3 h-3 animate-spin" /> Learning...
              </span>
            )}
            {learningState === 'learned' && (
              <span className="text-emerald-500 dark:text-emerald-400 font-bold flex items-center gap-0.5 normal-case tracking-normal animate-bounce-short">
                <Sparkles className="w-3 h-3" /> AI Learned Pattern!
              </span>
            )}
            {learningState === 'error' && (
              <span className="text-red-500 dark:text-red-400 font-bold flex items-center gap-0.5 normal-case tracking-normal">
                <AlertCircle className="w-3 h-3" /> Update failed
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={type}
              onChange={handleTypeChange}
              className="text-sm font-bold text-slate-800 dark:text-slate-100 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer transition-all font-sans"
            >
              <option value="Invoice">Invoice</option>
              <option value="Drivers License">Drivers License</option>
              <option value="Resume">Resume / CV</option>
              <option value="Structured Form">Structured Form</option>
              <option value="Unclassified Document">Unclassified Document</option>
            </select>
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
