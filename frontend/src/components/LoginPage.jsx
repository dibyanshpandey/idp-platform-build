import React, { useState } from 'react';
import { LayoutGrid, Lock, User, ShieldCheck, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

const USERS = [
  { id: 1, username: 'admin_user', password: 'admin123', role: 'Org_Admin', displayName: 'Sarah Chen' },
  { id: 2, username: 'dev_user', password: 'dev123', role: 'Developer', displayName: 'Marcus Rivera' },
  { id: 3, username: 'indexer_user', password: 'index123', role: 'Indexer', displayName: 'Priya Sharma' },
];

export default function LoginPage({ onLogin, isDarkMode }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    const user = USERS.find(u => u.username === username && u.password === password);
    
    if (user) {
      onLogin({ id: user.id, username: user.username, role: user.role, displayName: user.displayName });
    } else {
      setError('Invalid credentials. Please check your username and password.');
    }
    setIsLoading(false);
  };

  const handleQuickLogin = (user) => {
    setUsername(user.username);
    setPassword(user.password);
  };

  const roleDescriptions = {
    'Org_Admin': 'Full system access, settings, audit logs, and user management.',
    'Developer': 'Access to documents, extraction config, and audit logs.',
    'Indexer': 'Document processing and field validation only.'
  };

  const roleColors = {
    'Org_Admin': 'from-violet-500 to-purple-600',
    'Developer': 'from-blue-500 to-cyan-600',
    'Indexer': 'from-emerald-500 to-teal-600'
  };

  const roleBadgeColors = {
    'Org_Admin': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/30',
    'Developer': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
    'Indexer': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300 p-4">
      
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/10 dark:bg-violet-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/3 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-900 dark:bg-white rounded-xl shadow-lg mb-4">
            <LayoutGrid className="w-7 h-7 text-white dark:text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">IDP Enterprise</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Intelligent Document Processing Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-800 p-8 transition-colors duration-200">
          
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Sign In</h2>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm font-medium animate-pulse">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-12 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-lg text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Quick Login Cards */}
        <div className="mt-6">
          <p className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Quick Access — Demo Accounts</p>
          <div className="grid grid-cols-3 gap-3">
            {USERS.map(user => (
              <button 
                key={user.id}
                onClick={() => handleQuickLogin(user)}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <div className={`w-9 h-9 mx-auto mb-2 rounded-lg bg-gradient-to-br ${roleColors[user.role]} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {user.displayName.split(' ').map(n => n[0]).join('')}
                </div>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">{user.displayName}</p>
                <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${roleBadgeColors[user.role]}`}>
                  {user.role.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-6">
          © 2026 IDP Enterprise • Secure Document Intelligence
        </p>
      </div>
    </div>
  );
}
