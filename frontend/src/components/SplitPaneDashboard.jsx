import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ClassificationPanel from './ClassificationPanel';
import ValidationPanel from './ValidationPanel';
import FraudDetectionAccordion from './FraudDetectionAccordion';
import DocumentViewer from './DocumentViewer';
import ExportButton from './ExportButton';
import { X, FileJson, TableProperties, ShieldCheck, Loader2 } from 'lucide-react';

export default function SplitPaneDashboard({ 
  documentId,
  file, 
  extractedData, 
  fraudAnalysis, 
  ocrPages: propOcrPages,
  onDataChange, 
  documentName, 
  onReset,
  currentUser,
  webhookUrl,
  documentType,
  classificationConfidence,
  onClassifyChange
}) {
  const [activeTab, setActiveTab] = useState('fields');
  const [activeHighlightText, setActiveHighlightText] = useState(null);
  
  // Shared Page Navigation States
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);

  // Local OCR Pages state for historical doc loading and page-level editing
  const [localOcrPages, setLocalOcrPages] = useState(propOcrPages || []);
  const [isLoadingOcr, setIsLoadingOcr] = useState(false);
  
  const fileUrl = file ? URL.createObjectURL(file) : null;
  const isPdf = file ? file.type === 'application/pdf' : (documentName?.toLowerCase().endsWith('.pdf'));

  // Dynamically load OCR pages structure from the backend if empty (historical items)
  useEffect(() => {
    if ((!localOcrPages || localOcrPages.length === 0) && documentId && currentUser) {
      let isMounted = true;
      setIsLoadingOcr(true);
      axios.get(`http://localhost:3001/api/documents/${documentId}/ocr`, {
        headers: { 'x-user-id': currentUser.id }
      })
      .then(res => {
        if (isMounted) {
          const pages = res.data?.ocrPages || [];
          setLocalOcrPages(pages);
          setIsLoadingOcr(false);
        }
      })
      .catch(err => {
        console.error('Failed to retrieve document OCR mapping:', err);
        if (isMounted) setIsLoadingOcr(false);
      });
      return () => { isMounted = false; };
    } else if (propOcrPages && propOcrPages.length > 0) {
      setLocalOcrPages(propOcrPages);
    }
  }, [documentId, propOcrPages, currentUser]);

  // Isolate structured data matching the CURRENT page
  const activePageData = localOcrPages?.find(p => p.pageNumber === pageNumber);
  const activePageExtracted = activePageData?.structuredData || {};

  // If we are still loading, fallback gracefully to global extractedData
  const displayedValidationData = isLoadingOcr ? (extractedData || {}) : (activePageExtracted && Object.keys(activePageExtracted).length > 0 ? activePageExtracted : extractedData || {});

  // Group fields per page for separated display in the JSON tab
  const pageSeparatedJson = useMemo(() => {
    const separated = {};
    if (localOcrPages && localOcrPages.length > 0) {
      localOcrPages.forEach(p => {
        separated[`page_${p.pageNumber}`] = p.structuredData || {};
      });
    } else {
      separated[`page_1`] = extractedData || {};
    }
    return separated;
  }, [localOcrPages, extractedData]);

  // Handle page-isolated validation modifications
  const handlePageDataChange = (updatedFields) => {
    if (localOcrPages && localOcrPages.length > 0) {
      // 1. Update fields specifically for the active page
      const updatedOcrPages = localOcrPages.map(p => {
        if (p.pageNumber === pageNumber) {
          return {
            ...p,
            structuredData: { ...p.structuredData, ...updatedFields }
          };
        }
        return p;
      });
      
      setLocalOcrPages(updatedOcrPages);
      
      // 2. Compute a merged/flattened dictionary for global compliance/webhooks
      let mergedData = {};
      updatedOcrPages.forEach(p => {
        if (p.structuredData) {
          mergedData = { ...mergedData, ...p.structuredData };
        }
      });
      
      // 3. Propagate up to App.jsx to persist both DB record and output JSON
      onDataChange(mergedData, updatedOcrPages);
    } else {
      // Fallback for single-page files or missing structures
      onDataChange({ ...extractedData, ...updatedFields });
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      {/* Left Pane - Continuous Scroll Document Viewer */}
      <div className="w-1/2 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col relative transition-colors duration-200">
        <DocumentViewer 
          documentId={documentId}
          currentUser={currentUser}
          file={file} 
          fileUrl={fileUrl} 
          isPdf={isPdf} 
          documentName={documentName} 
          activeHighlightText={activeHighlightText}
          ocrPages={localOcrPages}
          pageNumber={pageNumber}
          setPageNumber={setPageNumber}
          numPages={numPages}
          setNumPages={setNumPages}
        />
      </div>

      {/* Right Pane - Tabbed Interface */}
      <div className="w-1/2 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-200">
        <div className="p-4 flex-none animate-fade-in">
          <ClassificationPanel 
            documentId={documentId}
            documentType={documentType} 
            confidenceScore={classificationConfidence} 
            onClassifyChange={onClassifyChange}
            currentUser={currentUser}
          />
        </div>
        
        {/* Tab Navigation */}
        <div className="px-4 flex items-center border-b border-slate-200 dark:border-slate-800 gap-6 flex-none bg-white dark:bg-slate-900 pt-2 transition-colors duration-200">
          <button 
            onClick={() => setActiveTab('fields')}
            className={`pb-3 text-xs font-bold uppercase tracking-wide flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'fields' ? 'border-emerald-600 text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <TableProperties className="w-4 h-4" /> 
            Fields
          </button>
          <button 
            onClick={() => setActiveTab('json')}
            className={`pb-3 text-xs font-bold uppercase tracking-wide flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'json' ? 'border-emerald-600 text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <FileJson className="w-4 h-4" /> JSON
          </button>
          <button 
            onClick={() => setActiveTab('fraud')}
            className={`pb-3 text-xs font-bold uppercase tracking-wide flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'fraud' ? 'border-emerald-600 text-slate-900 dark:text-slate-100' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <ShieldCheck className="w-4 h-4" /> Fraud Audit
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-hidden px-4 py-4 flex flex-col relative">
          {activeTab === 'fields' && (
            isLoadingOcr ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center h-full w-full rounded-sm">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                <p className="text-xs text-slate-500 font-medium">Loading page metadata structure...</p>
              </div>
            ) : (
              <ValidationPanel 
                initialData={displayedValidationData} 
                onDataChange={handlePageDataChange} 
                onFocusField={setActiveHighlightText}
                currentUser={currentUser}
                documentName={documentName}
              />
            )
          )}
          {activeTab === 'json' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 overflow-auto h-full w-full shadow-sm rounded-sm transition-colors duration-200">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 select-none tracking-wide">Page-Separated Document Schema</div>
              <pre className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 leading-relaxed">
                {JSON.stringify(pageSeparatedJson, null, 2)}
              </pre>
            </div>
          )}
          {activeTab === 'fraud' && (
            <FraudDetectionAccordion fraudAnalysis={fraudAnalysis} />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-none p-4 pt-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 mt-auto transition-colors duration-200">
          <button 
            onClick={onReset}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-sm shadow-sm cursor-pointer"
          >
            <X className="w-4 h-4" />
            Back to Queue
          </button>
          <div className="flex-1">
            <ExportButton 
              data={extractedData} 
              documentName={documentName} 
              documentId={documentId} 
              currentUser={currentUser} 
              onExportComplete={onReset} 
              webhookUrl={webhookUrl} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
