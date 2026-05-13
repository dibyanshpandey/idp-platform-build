import React, { useState, useMemo, useEffect, useRef } from 'react';
import axios from 'axios';
import { ZoomIn, ZoomOut, Maximize, ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export default function DocumentViewer({ 
  documentId, 
  currentUser, 
  file, 
  fileUrl, 
  isPdf: initialIsPdf, 
  documentName, 
  activeHighlightText, 
  ocrPages,
  pageNumber: propPageNumber,
  setPageNumber: propSetPageNumber,
  numPages: propNumPages,
  setNumPages: propSetNumPages
}) {
  const [zoom, setZoom] = useState(100);
  const [localPageNumber, setLocalPageNumber] = useState(1);
  const [localNumPages, setLocalNumPages] = useState(1);
  const [fetchedFileUrl, setFetchedFileUrl] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fetchedIsPdf, setFetchedIsPdf] = useState(initialIsPdf);

  // Sync up lifted state vs local state
  const pageNumber = propPageNumber !== undefined ? propPageNumber : localPageNumber;
  const setPageNumber = propSetPageNumber !== undefined ? propSetPageNumber : setLocalPageNumber;
  const numPages = propNumPages !== undefined ? propNumPages : localNumPages;
  const setNumPages = propSetNumPages !== undefined ? propSetNumPages : setLocalNumPages;

  const scrollContainerRef = useRef(null);

  // Fetch the file binary from the backend if it's missing (e.g. restored session)
  useEffect(() => {
    if (!fileUrl && documentId && currentUser) {
      let isMounted = true;
      setIsLoadingFile(true);
      
      axios.get(`http://localhost:3001/api/documents/${documentId}/file`, {
        headers: { 'x-user-id': currentUser.id },
        responseType: 'blob'
      })
      .then(response => {
        if (!isMounted) return;
        const blob = response.data;
        const url = URL.createObjectURL(blob);
        setFetchedFileUrl(url);
        // Determine PDF type from content-type header
        const contentType = response.headers['content-type'];
        setFetchedIsPdf(contentType === 'application/pdf');
        setIsLoadingFile(false);
      })
      .catch(err => {
        console.error('Failed to fetch document file:', err);
        if (isMounted) setIsLoadingFile(false);
      });

      return () => {
        isMounted = false;
        if (fetchedFileUrl) URL.revokeObjectURL(fetchedFileUrl);
      };
    }
  }, [fileUrl, documentId, currentUser]);

  const activeFileUrl = fileUrl || fetchedFileUrl;
  const isPdf = file ? file.type === 'application/pdf' : (documentName?.toLowerCase().endsWith('.pdf') || fetchedIsPdf || !!initialIsPdf);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleFit = () => setZoom(100);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Fuzzy match to find the bounding box of the active text specifically on the current page
  const highlightBox = useMemo(() => {
    if (!activeHighlightText || !ocrPages || ocrPages.length === 0) return null;

    // Find the current page data
    const pageData = ocrPages.find(p => p.pageNumber === pageNumber) || ocrPages[0];
    if (!pageData || !pageData.words || pageData.words.length === 0) {
      return null;
    }

    // Strip non-alphanumeric for a more robust match
    const searchTarget = activeHighlightText.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!searchTarget) return null;

    const words = pageData.words;
    let bestBox = null;
    let minBloat = Infinity;

    // Sliding window over words
    for (let i = 0; i < words.length; i++) {
      let combinedText = '';
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let j = i; j < Math.min(words.length, i + 25); j++) {
        combinedText += words[j].text.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        minX = Math.min(minX, words[j].bbox.x0);
        minY = Math.min(minY, words[j].bbox.y0);
        maxX = Math.max(maxX, words[j].bbox.x1);
        maxY = Math.max(maxY, words[j].bbox.y1);

        const isExactMatch = combinedText === searchTarget;
        const isSubstringMatch = combinedText.includes(searchTarget) && searchTarget.length > 3;

        if (isExactMatch || isSubstringMatch) {
           const bloat = combinedText.length - searchTarget.length;
           if (bloat < minBloat && (isExactMatch || bloat <= 3)) {
             minBloat = bloat;
             
             const scaleFactor = isPdf ? (16 / 25.4) : 1.0; 

             bestBox = {
               left: minX * scaleFactor,
               top: minY * scaleFactor,
               width: (maxX - minX) * scaleFactor,
               height: (maxY - minY) * scaleFactor
             };
             
             if (isExactMatch) {
               return bestBox;
             }
           }
        }
      }
    }
    
    return bestBox;
  }, [activeHighlightText, ocrPages, pageNumber, isPdf]);

  // Group redacted boxes by pageNumber
  const redactedBoxesByPage = useMemo(() => {
    const pagesMap = {};
    if (!ocrPages || ocrPages.length === 0) return pagesMap;
    
    const scaleFactor = isPdf ? (16 / 25.4) : 1.0; 
    
    ocrPages.forEach(pageData => {
      if (!pageData.words) return;
      pagesMap[pageData.pageNumber] = pageData.words
        .filter(w => w.isRedacted)
        .map((w, idx) => ({
          id: `redacted-${pageData.pageNumber}-${idx}`,
          left: w.bbox.x0 * scaleFactor,
          top: w.bbox.y0 * scaleFactor,
          width: (w.bbox.x1 - w.bbox.x0) * scaleFactor,
          height: (w.bbox.y1 - w.bbox.y0) * scaleFactor
        }));
    });
    
    return pagesMap;
  }, [ocrPages, isPdf]);

  // Scroll target page into view
  const scrollToPage = (pageNum) => {
    const element = document.getElementById(`page-container-${pageNum}`);
    const container = scrollContainerRef.current;
    if (element && container) {
      const topPos = element.offsetTop - container.offsetTop;
      container.scrollTo({ top: topPos - 10, behavior: 'smooth' });
    }
    setPageNumber(pageNum);
  };

  // Auto-scroll and focus target page when highlight text changes
  useEffect(() => {
    if (!activeHighlightText || !ocrPages || ocrPages.length === 0) return;
    
    const searchTarget = activeHighlightText.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!searchTarget) return;

    // Find first page containing the target text sequence
    const matchedPage = ocrPages.find(pageData => {
      if (!pageData.words || pageData.words.length === 0) return false;
      const fullText = pageData.words.map(w => w.text.toLowerCase().replace(/[^a-z0-9]/g, '')).join('');
      return fullText.includes(searchTarget);
    });

    if (matchedPage) {
      const pageNum = matchedPage.pageNumber;
      setPageNumber(pageNum);
      
      // Give DOM time to update/render
      setTimeout(() => {
        scrollToPage(pageNum);
      }, 50);
    }
  }, [activeHighlightText, ocrPages]);

  // Track page scroll offset inside our scroll container to update pageNumber dynamically and instantly
  useEffect(() => {
    if (!isPdf || numPages <= 1 || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    
    const handleScroll = () => {
      const containerTop = container.scrollTop;
      let activePage = 1;
      let minDiff = Infinity;
      
      for (let i = 1; i <= numPages; i++) {
        const el = document.getElementById(`page-container-${i}`);
        if (el) {
          const elTop = el.offsetTop - container.offsetTop;
          const diff = Math.abs(elTop - containerTop);
          if (diff < minDiff) {
            minDiff = diff;
            activePage = i;
          }
        }
      }
      
      if (activePage !== pageNumber) {
        setPageNumber(activePage);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isPdf, numPages, pageNumber, setPageNumber]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950 relative transition-colors duration-200">
      {/* Top Bar Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 select-none transition-colors duration-200 shrink-0">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-[11px] font-mono truncate max-w-[180px] sm:max-w-[240px] text-slate-700 dark:text-slate-300 font-semibold">{documentName}</span>
        </div>
        
        <div className="flex items-center gap-4">
          {isPdf && numPages > 1 && (
            <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm shadow-sm transition-colors duration-200">
              <button 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-30" 
                onClick={() => scrollToPage(Math.max(1, pageNumber - 1))}
                disabled={pageNumber === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 px-2 min-w-[50px] text-center font-bold">
                {pageNumber} / {numPages}
              </span>
              <button 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-30" 
                onClick={() => scrollToPage(Math.min(numPages, pageNumber + 1))}
                disabled={pageNumber === numPages}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm shadow-sm transition-colors duration-200">
            <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 px-2 min-w-[45px] text-center font-bold">
              {zoom}%
            </span>
            <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors" onClick={handleFit} title="Fit to Screen">
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Viewer Area */}
      <div 
        ref={scrollContainerRef}
        className="scroll-container flex-1 overflow-y-auto bg-slate-100/50 dark:bg-slate-950/50 p-4 flex flex-col items-center justify-start relative transition-colors duration-200 scroll-smooth"
      >
        {isLoadingFile ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 my-auto">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
            <p className="text-sm font-medium">Fetching document securely...</p>
          </div>
        ) : activeFileUrl ? (
          <div 
             className="transition-transform duration-200 origin-top flex flex-col items-center"
             style={{ transform: `scale(${zoom / 100})` }}
          >
            {isPdf ? (
              <Document
                file={activeFileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="p-12 text-slate-400 font-medium">Loading PDF pages...</div>}
              >
                {Array.from(new Array(numPages), (el, index) => {
                  const pNum = index + 1;
                  return (
                    <div 
                      key={`page_${pNum}`} 
                      id={`page-container-${pNum}`} 
                      className="relative mb-6 border border-slate-300 dark:border-slate-700 shadow-md bg-white dark:bg-slate-900 last:mb-0"
                    >
                      <Page 
                        pageNumber={pNum} 
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                      />
                      
                      {/* Page highlight box overlay */}
                      {pageNumber === pNum && highlightBox && (
                        <div 
                          className="absolute border-2 border-emerald-500 bg-emerald-400/30 rounded-sm pointer-events-none transition-all duration-300"
                          style={{
                            left: `${highlightBox.left}px`,
                            top: `${highlightBox.top}px`,
                            width: `${highlightBox.width}px`,
                            height: `${highlightBox.height}px`,
                            boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.2)'
                          }}
                        />
                      )}

                      {/* Page-specific redaction overlays */}
                      {redactedBoxesByPage[pNum]?.map(box => (
                        <div 
                          key={box.id}
                          className="absolute bg-slate-950 dark:bg-slate-900 border border-slate-900 hover:opacity-10 transition-opacity cursor-help flex items-center justify-center rounded-sm pointer-events-auto"
                          style={{
                            left: `${box.left}px`,
                            top: `${box.top}px`,
                            width: `${box.width}px`,
                            height: `${box.height}px`,
                          }}
                          title="REDACTED (PII COMPLIANCE STAMP)"
                        >
                          <span className="text-[6px] font-bold text-slate-400 select-none tracking-tighter scale-75">PII</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Document>
            ) : (
              <div className="relative border border-slate-300 dark:border-slate-700 shadow-md bg-white dark:bg-slate-800">
                <img 
                  src={activeFileUrl} 
                  alt="Document Preview" 
                  className="block"
                  style={{ maxWidth: 'none' }} 
                />
                {highlightBox && (
                  <div 
                    className="absolute border-2 border-emerald-500 bg-emerald-400/30 rounded-sm pointer-events-none transition-all duration-300"
                    style={{
                      left: `${highlightBox.left}px`,
                      top: `${highlightBox.top}px`,
                      width: `${highlightBox.width}px`,
                      height: `${highlightBox.height}px`,
                      boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.2)'
                    }}
                  />
                )}
                {redactedBoxesByPage[1]?.map(box => (
                  <div 
                    key={box.id}
                    className="absolute bg-slate-950 dark:bg-slate-900 border border-slate-900 hover:opacity-10 transition-opacity cursor-help flex items-center justify-center rounded-sm pointer-events-auto"
                    style={{
                      left: `${box.left}px`,
                      top: `${box.top}px`,
                      width: `${box.width}px`,
                      height: `${box.height}px`,
                    }}
                    title="REDACTED (PII COMPLIANCE STAMP)"
                  >
                    <span className="text-[6px] font-bold text-slate-400 select-none tracking-tighter scale-75">PII</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 my-auto">
            <Loader2 className="w-8 h-8 text-slate-300 animate-spin mb-4" />
            <p className="text-sm font-medium">Preparing secure document container...</p>
          </div>
        )}
      </div>
    </div>
  );
}
