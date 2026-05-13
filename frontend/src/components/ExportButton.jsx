import React, { useState } from 'react';
import { DownloadCloud, Send, Loader2, CheckCircle, AlertTriangle, FileImage } from 'lucide-react';
import axios from 'axios';

export default function ExportButton({ data, documentName, documentId, currentUser, onExportComplete, webhookUrl }) {
  const [webhookStatus, setWebhookStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [isDownloadingFile, setIsDownloadingFile] = useState(false);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `validated_${documentName || 'metadata'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    if (onExportComplete) {
      onExportComplete();
    }
  };

  const handleDownloadFile = async () => {
    if (!documentId || !currentUser) return;
    setIsDownloadingFile(true);
    try {
      const response = await axios.get(`http://localhost:3001/api/documents/${documentId}/file`, {
        headers: { 'x-user-id': currentUser.id },
        responseType: 'blob'
      });
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", url);
      downloadAnchorNode.setAttribute("download", `watermarked_${documentName || 'file'}`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download compliance file:', err);
    } finally {
      setIsDownloadingFile(false);
    }
  };

  const handleWebhook = async () => {
    if (!webhookUrl) return;
    setWebhookStatus('sending');
    
    try {
      await axios.post('http://localhost:3001/api/documents/webhook', {
        webhook_url: webhookUrl,
        payload: {
          document_name: documentName,
          exported_at: new Date().toISOString(),
          data: data
        }
      });
      setWebhookStatus('success');
      setTimeout(() => setWebhookStatus(null), 3000);
    } catch (err) {
      console.error('Webhook failed:', err);
      setWebhookStatus('error');
      setTimeout(() => setWebhookStatus(null), 4000);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full">
      <button 
        onClick={handleExport}
        className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-sm shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer"
      >
        <DownloadCloud className="w-4 h-4" strokeWidth={2.5} />
        Export JSON
      </button>

      {documentId && (
        <button 
          onClick={handleDownloadFile}
          disabled={isDownloadingFile}
          className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/35 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-sm shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isDownloadingFile ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
          ) : (
            <><FileImage className="w-4 h-4" /> Download File</>
          )}
        </button>
      )}
      
      {webhookUrl && (
        <button 
          onClick={handleWebhook}
          disabled={webhookStatus === 'sending'}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm transition-colors focus:outline-none focus:ring-2 rounded-sm shadow-sm border ${
            webhookStatus === 'success' 
              ? 'bg-emerald-500 border-emerald-600 text-white' 
              : webhookStatus === 'error'
              ? 'bg-red-500 border-red-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700 text-white focus:ring-indigo-400'
          }`}
        >
          {webhookStatus === 'sending' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
          ) : webhookStatus === 'success' ? (
            <><CheckCircle className="w-4 h-4" /> Delivered</>
          ) : webhookStatus === 'error' ? (
            <><AlertTriangle className="w-4 h-4" /> Failed</>
          ) : (
            <><Send className="w-4 h-4" strokeWidth={2.5} /> Send to Webhook</>
          )}
        </button>
      )}
    </div>
  );
}
