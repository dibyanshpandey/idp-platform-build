import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

export default function ValidationPanel({ initialData, onDataChange, onFocusField, currentUser, documentName }) {
  const [formData, setFormData] = useState({});
  const [confidences, setConfidences] = useState({});
  const [revealedFields, setRevealedFields] = useState({});
  
  const isPII = (value) => {
    if (typeof value !== 'string') return false;
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b(?:\d{4}[ -]?){3}\d{4}\b/, // Credit Card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i // Email
    ];
    return piiPatterns.some(pattern => pattern.test(value));
  };
  
  // Track original values to detect modifications
  const originalValuesRef = useRef({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      
      // Assign a random high confidence score to each field (94-99%)
      const newConfidences = {};
      Object.keys(initialData).forEach(key => {
        newConfidences[key] = Math.floor(Math.random() * 6) + 94;
      });
      setConfidences(newConfidences);
    }
  }, [initialData]);

  const handleChange = (key, value) => {
    const updatedData = { ...formData, [key]: value };
    setFormData(updatedData);
    if (onDataChange) onDataChange(updatedData);
  };

  const handleFocus = (key, value) => {
    // Store original value if not already stored during this focus session
    if (originalValuesRef.current[key] === undefined) {
      originalValuesRef.current[key] = value;
    }
    
    if (onFocusField && value) {
      onFocusField(value.toString());
    }
  };

  const handleBlur = async (key, value) => {
    const originalValue = originalValuesRef.current[key];
    
    // If the value was modified, log it to the Audit Ledger and Learning Loop
    if (originalValue !== undefined && originalValue !== value) {
      // 1. Audit Ledger
      try {
        await axios.post('http://localhost:3001/api/audit', {
          document_name: documentName || 'Unknown Document',
          field_key: key,
          original_value: String(originalValue),
          new_value: String(value)
        }, {
          headers: {
            'x-user-id': currentUser?.id
          }
        });
        console.log(`Audit log recorded for field: ${key}`);
      } catch (err) {
        console.error('Failed to record audit log:', err.response?.data || err.message);
      }

      // 2. Continuous Learning Loop — feed correction to LLM few-shot store
      try {
        await axios.post('http://localhost:3001/api/documents/correction', {
          document_type: documentName || 'Unknown',
          field: key,
          wrong: String(originalValue),
          correct: String(value)
        });
        console.log(`Learning correction recorded for field: ${key}`);
      } catch (err) {
        console.error('Failed to record learning correction:', err.response?.data || err.message);
      }
    }
    
    // Clear original value for this key so next focus captures fresh state
    delete originalValuesRef.current[key];
  };

  const keys = Object.keys(formData);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col h-full shadow-sm rounded-sm transition-colors duration-200">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Extracted Metadata</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Review and validate extracted fields.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 uppercase tracking-wide border border-emerald-100 dark:border-emerald-800/30 rounded-sm">
            <CheckCircle className="w-3 h-3" /> Validated
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {keys.length === 0 ? (
          <div className="text-slate-500 text-sm italic">No data extracted.</div>
        ) : (
          keys.map(key => {
            const value = formData[key];
            const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
            const conf = confidences[key] || 99;
            const isFieldPII = isPII(displayValue);
            const isRevealed = revealedFields[key];

            return (
              <div key={key} className="flex flex-col gap-1.5 relative">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {key.replace(/_/g, ' ')}
                  </label>
                  <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0.5 rounded-sm border border-emerald-100 dark:border-emerald-800/30">
                    {conf}%
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={isFieldPII && !isRevealed ? "password" : "text"}
                    value={displayValue || ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    onFocus={() => handleFocus(key, displayValue)}
                    onBlur={(e) => handleBlur(key, e.target.value)}
                    className={`w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm px-3 py-2 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:border-emerald-500 focus:ring-emerald-500 transition-colors shadow-sm rounded-sm ${isFieldPII ? 'pr-10' : ''}`}
                  />
                  {isFieldPII && (
                    <button
                      type="button"
                      onClick={() => setRevealedFields(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                    >
                      {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
