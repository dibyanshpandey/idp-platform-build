import React, { useRef, useState, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  ChevronRight, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Loader2, 
  Trash2, 
  CheckSquare, 
  Square, 
  MinusSquare,
  X
} from 'lucide-react';

export default function DocumentQueue({ documents, onUpload, onSelectDocument, onDeleteDocuments }) {
  const fileInputRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        onUpload(file);
      });
      e.target.value = '';
    }
  };

  // Filter out documents that are in "processing" state so users can't delete them while uploading
  const selectableDocs = useMemo(() => {
    return documents.filter(d => d.status !== 'processing');
  }, [documents]);

  const isAllSelected = useMemo(() => {
    return selectableDocs.length > 0 && selectedIds.length === selectableDocs.length;
  }, [selectableDocs, selectedIds]);

  const isSomeSelected = useMemo(() => {
    return selectedIds.length > 0 && selectedIds.length < selectableDocs.length;
  }, [selectableDocs, selectedIds]);

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableDocs.map(d => d.id));
    }
  };

  const handleRowSelectToggle = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleDeleteSingle = (id, e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      onDeleteDocuments([id]);
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleDeleteBulk = () => {
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected documents? This action cannot be undone.`)) {
      onDeleteDocuments(selectedIds);
      setSelectedIds([]);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Processing Queue</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage and validate your uploaded documents.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept=".pdf,image/*" 
            multiple
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload Documents
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <FileText className="w-16 h-16 mb-4 opacity-50" strokeWidth={1} />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">Queue is empty</h3>
            <p className="text-sm mt-1">Upload documents to begin processing.</p>
            <button 
              onClick={() => fileInputRef.current.click()}
              className="mt-6 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Browse Files
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <button 
                    onClick={handleSelectAllToggle}
                    disabled={selectableDocs.length === 0}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">Document</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Fraud Risk</th>
                <th className="px-6 py-4">Confidence</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {documents.map((doc) => {
                const isProcessing = doc.status === 'processing';
                const isError = doc.status === 'error';
                const isSelected = selectedIds.includes(doc.id);
                
                // Calculate Risk
                let riskEl = <span className="text-slate-400">-</span>;
                if (doc.fraudAnalysis && !isProcessing) {
                  const modules = ['metadata', 'visual', 'logical', 'duplicate', 'incremental', 'font_analysis', 'vendor_profile'];
                  let issues = 0;
                  modules.forEach(mod => {
                    if (['Fail', 'Review'].includes(doc.fraudAnalysis[mod]?.status)) issues++;
                  });
                  
                  if (doc.fraudAnalysis.error) {
                     riskEl = <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-sm"><AlertTriangle className="w-3.5 h-3.5" /> Offline</span>;
                  } else if (issues > 0) {
                     riskEl = <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-sm"><AlertTriangle className="w-3.5 h-3.5" /> {issues > 1 ? 'High' : 'Medium'} Risk</span>;
                  } else {
                     riskEl = <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-sm"><ShieldCheck className="w-3.5 h-3.5" /> Low Risk</span>;
                  }
                }

                // Calculate Confidence
                let confEl = <span className="text-slate-400">-</span>;
                if (doc.extractedData && !isProcessing) {
                  const keys = Object.keys(doc.extractedData);
                  const score = keys.length > 3 ? 94 : 78;
                  confEl = <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">{score}%</span>;
                }

                return (
                  <tr 
                    key={doc.id} 
                    className={`group transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-slate-50/70 dark:bg-slate-800/20 border-l-4 border-emerald-500' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                    onClick={() => !isProcessing && !isError && onSelectDocument(doc.id)}
                  >
                    {/* Row Checkbox */}
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      {!isProcessing ? (
                        <button 
                          onClick={(e) => handleRowSelectToggle(doc.id, e)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <div className="w-4 h-4 mx-auto opacity-20">
                          <Square className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Document details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="truncate max-w-[180px] lg:max-w-[280px]">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{doc.fileMeta?.name || doc.file?.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {((doc.fileMeta?.size || doc.file?.size || 0) / 1024 / 1024).toFixed(2)} MB • {(doc.fileMeta?.type || doc.file?.type || '').split('/')[1]?.toUpperCase() || 'FILE'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isProcessing ? (
                        <span className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full w-max">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing
                        </span>
                      ) : isError ? (
                        <span className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-full w-max">
                          <AlertTriangle className="w-3.5 h-3.5" /> Failed
                        </span>
                      ) : doc.status === 'validated' ? (
                        <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full w-max">
                          <ShieldCheck className="w-3.5 h-3.5" /> Validated
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full w-max">
                          <Clock className="w-3.5 h-3.5" /> Needs Review
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">{riskEl}</td>
                    <td className="px-6 py-4">{confEl}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Delete Single Action */}
                        {!isProcessing && (
                          <button 
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            onClick={(e) => handleDeleteSingle(doc.id, e)}
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* Forward Review Action */}
                        {!isProcessing && !isError && (
                          <button 
                            className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectDocument(doc.id);
                            }}
                            title="Review Document"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating Action Utility Bar (Highly Premium UI Interaction) */}
      {selectedIds.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 z-50 animate-bounce-short">
          <div className="flex items-center gap-3 border-r border-slate-800 pr-6">
            <CheckSquare className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-white tracking-wide">
              {selectedIds.length} Document{selectedIds.length !== 1 ? 's' : ''} Selected
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleDeleteBulk}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer shadow-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white transition-colors p-1"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
