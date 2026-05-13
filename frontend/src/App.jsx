import React, { useState } from 'react';
import axios from 'axios';
import ImportModule from './components/ImportModule';
import SplitPaneDashboard from './components/SplitPaneDashboard';
import DocumentQueue from './components/DocumentQueue';
import LoginPage from './components/LoginPage';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { LayoutGrid, Settings, HelpCircle, Bell, Moon, Sun, LogOut, Shield, FileText, Activity } from 'lucide-react';

function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [activeView, setActiveView] = useState('queue'); // 'queue' or 'dashboard'
  const [error, setError] = useState(null);
  const [customSchema, setCustomSchema] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(false);
  React.useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);
  
  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsResponse, setSettingsResponse] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const fetchDocuments = async (userId) => {
    try {
      const response = await axios.get('http://localhost:3001/api/documents', {
        headers: { 'x-user-id': userId }
      });
      // Backend returns rows with: id, original_name, mime_type, file_size, status, extracted_data, fraud_analysis
      const docs = response.data.map(row => ({
        id: row.id,
        file: null,
        fileMeta: { name: row.original_name, size: row.file_size, type: row.mime_type },
        status: row.status,
        extractedData: row.extracted_data,
        fraudAnalysis: row.fraud_analysis,
        ocrPages: [], // we don't fetch full ocrPages for the queue to save bandwidth
        processedAt: row.created_at
      }));
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to fetch user documents:', err);
      setDocuments([]);
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setShowSettings(false);
    setSettingsResponse(null);
    fetchDocuments(user.id);
  };

  const handleLogout = () => {
    // Documents stay in the backend database. State clears locally.
    setCurrentUser(null);
    setDocuments([]);
    setActiveDocumentId(null);
    setError(null);
    setShowSettings(false);
    setSettingsResponse(null);
    setShowUserMenu(false);
    setCustomSchema('');
    setWebhookUrl('');
  };

  // If not logged in, show login page
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} isDarkMode={isDarkMode} />;
  }

  const fetchSettings = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/config', {
        headers: { 'x-user-id': currentUser.id }
      });
      setSettingsResponse(response.data);
    } catch (err) {
      setSettingsResponse({ error: err.response?.data?.error || err.message });
    }
  };

  const handleReset = () => {
    setActiveDocumentId(null);
  };

  const handleFileUpload = async (uploadedFile) => {
    const docId = Date.now().toString() + Math.random().toString(36).substring(7);
    const newDoc = {
      id: docId,
      file: uploadedFile,
      fileMeta: { name: uploadedFile.name, size: uploadedFile.size, type: uploadedFile.type },
      status: 'processing',
      extractedData: null,
      fraudAnalysis: null,
      ocrPages: [],
      processedAt: new Date().toISOString()
    };
    
    setDocuments(prev => [newDoc, ...prev]);
    setError(null);

    const formData = new FormData();
    formData.append('document', uploadedFile);
    if (customSchema.trim() !== '') {
      formData.append('custom_schema', customSchema);
    }

    try {
      const response = await axios.post('http://localhost:3001/api/documents/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'x-user-id': currentUser.id 
        },
      });
      
      const dbDoc = response.data;
      
      setDocuments(prev => prev.map(d => d.id === docId ? {
        id: dbDoc.id, // Update to the real DB UUID
        file: null, // Don't keep the binary in memory
        fileMeta: { name: dbDoc.original_name, size: dbDoc.file_size, type: dbDoc.mime_type },
        status: dbDoc.status,
        extractedData: dbDoc.extracted_data,
        fraudAnalysis: dbDoc.fraud_analysis,
        ocrPages: dbDoc.ocrPages, // Frontend only: temporarily keep ocrPages so highlighting works immediately after upload
        processedAt: dbDoc.updated_at
      } : d));
      
      // Update active document ID if they were viewing the processing state
      if (activeDocumentId === docId) {
        setActiveDocumentId(dbDoc.id);
      }
    } catch (err) {
      console.error(err);
      const backendError = err.response?.data?.details || err.response?.data?.error;
      setDocuments(prev => prev.map(d => d.id === docId ? {
        ...d, status: 'error', error: backendError || err.message
      } : d));
      setError(`Failed to process ${uploadedFile.name}: ` + (backendError || err.message));
    }
  };

  const handleDataChange = async (docId, updatedData, ocrPages) => {
    // Optimistic UI update
    setDocuments(prev => prev.map(d => d.id === docId ? {
      ...d, 
      extractedData: updatedData,
      ocrPages: ocrPages || d.ocrPages
    } : d));

    // Persist to backend
    try {
      await axios.put(`http://localhost:3001/api/documents/${docId}`, {
        extracted_data: updatedData,
        ocrPages: ocrPages
      }, {
        headers: { 'x-user-id': currentUser.id }
      });
    } catch (err) {
      console.error('Failed to save data to backend:', err);
    }
  };

  const handleDeleteDocuments = async (docIds) => {
    try {
      await axios.post('http://localhost:3001/api/documents/bulk-delete', {
        ids: docIds
      }, {
        headers: { 'x-user-id': currentUser.id }
      });
      // Filter out deleted documents locally
      setDocuments(prev => prev.filter(d => !docIds.includes(d.id)));
    } catch (err) {
      console.error('Failed to delete documents:', err);
      setError('Failed to delete documents: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleClassificationChange = (docId, newType, newConf) => {
    setDocuments(prev => prev.map(d => d.id === docId ? {
      ...d, 
      document_type: newType,
      classification_confidence: newConf
    } : d));
  };

  const roleColors = {
    'Org_Admin': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
    'Developer': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    'Indexer': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
  };

  const avatarGradients = {
    'Org_Admin': 'from-violet-500 to-purple-600',
    'Developer': 'from-blue-500 to-cyan-600',
    'Indexer': 'from-emerald-500 to-teal-600'
  };

  // Role-based feature visibility
  const canAccessSettings = ['Org_Admin', 'Developer'].includes(currentUser.role);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 shrink-0 shadow-sm z-10 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-1.5 rounded-sm">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <h1 className="font-bold tracking-tight text-sm text-slate-800 dark:text-slate-100">IDP Enterprise</h1>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          
          {/* Role Badge */}
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${roleColors[currentUser.role]} border-current/20 uppercase tracking-wider`}>
            <Shield className="w-3 h-3 inline mr-1" />
            {currentUser.role.replace('_', ' ')}
          </span>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700"></div>

          <button className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors"><Bell className="w-4 h-4" /></button>
          <button className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors"><HelpCircle className="w-4 h-4" /></button>
          
          {/* Dark Mode Toggle */}
          <button 
            className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          {/* Settings — only for Org_Admin / Developer */}
          {canAccessSettings && (
            <button 
              className="hover:text-slate-800 dark:hover:text-slate-300 transition-colors relative"
              onClick={() => {
                setShowSettings(!showSettings);
                setShowUserMenu(false);
                if (!showSettings) fetchSettings();
              }}
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* User Avatar + Dropdown */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowSettings(false);
              }}
              className={`w-8 h-8 bg-gradient-to-br ${avatarGradients[currentUser.role]} ml-1 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm hover:shadow-md transition-shadow cursor-pointer ring-2 ring-white dark:ring-slate-800`}
            >
              {(currentUser.displayName || currentUser.username).substring(0, 2).toUpperCase()}
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${avatarGradients[currentUser.role]} rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm`}>
                      {(currentUser.displayName || currentUser.username).substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{currentUser.displayName || currentUser.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">@{currentUser.username}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${roleColors[currentUser.role]} border-current/20 uppercase tracking-wider`}>
                      {currentUser.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="p-2">
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Permissions</div>
                  <div className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentUser.role === 'Indexer' ? 'bg-slate-300' : 'bg-emerald-500'}`}></span>
                    Settings & Config {currentUser.role === 'Indexer' ? '(Restricted)' : ''}
                  </div>
                  <div className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Document Processing
                  </div>
                  <div className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentUser.role === 'Indexer' ? 'bg-slate-300' : 'bg-emerald-500'}`}></span>
                    Audit Logs {currentUser.role === 'Indexer' ? '(Restricted)' : ''}
                  </div>
                  <div className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Fraud Detection Reports
                  </div>
                </div>

                <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Settings / Config Modal Overlay */}
      {showSettings && (
        <div className="absolute top-14 right-4 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-md z-50 p-4 transition-colors duration-200">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">Platform Configuration</h2>
          {settingsResponse ? (
            settingsResponse.error ? (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded text-sm font-medium border border-red-200 dark:border-red-800/30">
                ⚠️ {settingsResponse.error}
              </div>
            ) : (
              <div className="text-sm text-slate-700 dark:text-slate-300 space-y-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-2 rounded border border-emerald-200 dark:border-emerald-800/30 font-medium">
                  {settingsResponse.message}
                </div>
                <div>
                  <strong className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Groq API Key</strong>
                  <code className="bg-slate-100 dark:bg-slate-800 p-1 rounded text-xs block text-slate-700 dark:text-slate-300">{settingsResponse.api_keys.groq}</code>
                </div>
                <div>
                  <strong className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Prompt Builder Status</strong>
                  <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-2 py-0.5 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    {settingsResponse.prompt_builder_status}
                  </span>
                </div>
                <div>
                  <strong className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Custom Extraction Schema (JSON)</strong>
                  <textarea 
                    className="w-full h-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder='{"invoice_number": "string", "total": "number"}'
                    value={customSchema}
                    onChange={(e) => setCustomSchema(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">If provided, forces the LLM to extract only these fields.</p>
                </div>
                <div>
                  <strong className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Webhook Endpoint (URL)</strong>
                  <input 
                    type="url"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="https://your-erp.com/api/receive"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Validated data will be POSTed to this URL on export.</p>
                </div>
              </div>
            )
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading configuration...</div>
          )}
        </div>
      )}
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {error && (
          <div className="absolute top-4 right-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-400 px-4 py-3 z-50 text-sm shadow-xl flex items-center gap-3 max-w-md rounded-md">
            <div className="w-1 h-full absolute left-0 top-0 bg-red-500 rounded-l-md"></div>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto underline text-xs font-semibold text-red-600 dark:text-red-400">Dismiss</button>
          </div>
        )}

        {/* Navigation Tabs for Queue & Analytics */}
        {!activeDocumentId && (
          <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center gap-6 shrink-0 transition-colors duration-200">
            <button 
              onClick={() => setActiveView('queue')}
              className={`h-full border-b-2 text-xs font-bold flex items-center gap-2 px-1 transition-all duration-200 ${
                activeView === 'queue' 
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              Ingestion Queue
            </button>
            <button 
              onClick={() => setActiveView('dashboard')}
              className={`h-full border-b-2 text-xs font-bold flex items-center gap-2 px-1 transition-all duration-200 ${
                activeView === 'dashboard' 
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              Analytics Hub
            </button>
          </div>
        )}
 
        {activeDocumentId ? (() => {
          const activeDoc = documents.find(d => d.id === activeDocumentId);
          if (!activeDoc) return null;
          return (
            <SplitPaneDashboard 
              documentId={activeDoc.id}
              file={activeDoc.file} 
              extractedData={activeDoc.extractedData} 
              fraudAnalysis={activeDoc.fraudAnalysis}
              ocrPages={activeDoc.ocrPages}
              onDataChange={(data, pages) => handleDataChange(activeDoc.id, data, pages)}
              documentName={activeDoc.fileMeta?.name || activeDoc.file?.name || 'Unknown'}
              onReset={handleReset}
              currentUser={currentUser}
              webhookUrl={webhookUrl}
              documentType={activeDoc.document_type || 'Structured Form'}
              classificationConfidence={activeDoc.classification_confidence || 100}
              onClassifyChange={(newType, newConf) => handleClassificationChange(activeDoc.id, newType, newConf)}
            />
          );
        })() : (
          activeView === 'queue' ? (
            <DocumentQueue 
              documents={documents}
              onUpload={handleFileUpload}
              onSelectDocument={setActiveDocumentId}
              onDeleteDocuments={handleDeleteDocuments}
            />
          ) : (
            <AnalyticsDashboard documents={documents} />
          )
        )}
      </main>
    </div>
  );
}

export default App;
