import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Shield, User, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function UsersPage({ currentUser }) {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Indexer');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [users, setUsers] = useState([]);

  const roles = ['Org_Admin', 'Developer', 'Indexer'];

  const fetchUsers = async () => {
    try {
      // Since we don't have a GET /api/auth/users yet, we'll just show a success state
      // In a real app, you'd fetch the list here.
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await axios.post('http://localhost:3001/api/auth/register', {
        username,
        role
      });
      setMessage({ type: 'success', text: `User "${username}" created successfully with role ${role}.` });
      setUsername('');
      setRole('Indexer');
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error || 'Failed to create user' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">User Management</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Create and manage access for your team members.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{currentUser.role.replace('_', ' ')} Access</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Create User Form */}
          <div className="md:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-2 mb-6">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Create User</h2>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="e.g. john_doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Assigned Role</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    {roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>

                <div className="pt-2">
                  <button 
                    disabled={isLoading}
                    className="w-full bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Creating...' : 'Register User'}
                  </button>
                </div>

                {message && (
                  <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 border ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-400'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span className="text-xs font-medium">{message.text}</span>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* User List Info (Mock for now) */}
          <div className="md:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Active Users</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">LIVE REGISTRY</span>
              </div>
              
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-violet-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {currentUser.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentUser.username} <span className="ml-2 text-[10px] text-emerald-500 font-bold uppercase tracking-widest">(YOU)</span></p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">System Administrator</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full border border-violet-200 dark:border-violet-800/50">ORG ADMIN</span>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                    <button className="text-slate-300 dark:text-slate-600 cursor-not-allowed"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="p-12 text-center">
                  <p className="text-xs text-slate-400 italic">User list is synchronized with the PostgreSQL database. Create a new user on the left to add to this registry.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Security Note</h3>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-500 leading-relaxed">
                As an <strong>{currentUser.role.replace('_', ' ')}</strong>, you have the authority to provision new users. Note that the system uses a mock authentication header (`x-user-id`) for development. In a production environment, this will be replaced with JWT-based Auth0 or Clerk integration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
