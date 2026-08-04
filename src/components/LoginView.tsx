import React, { useState } from 'react';
import {
  Lock,
  UserCheck,
  PackageCheck,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Building2,
  Sparkles
} from 'lucide-react';
import { User } from '../types';

interface LoginViewProps {
  onLogin: (usernameInput: string, passwordInput: string) => Promise<void>;
  isLoading: boolean;
  onLaunchSetup?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, isLoading, onLaunchSetup }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    try {
      await onLogin(username.trim(), password);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none">
      
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        
        {/* Top Enterprise Logo Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-xl shadow-sky-500/20 mb-1 border border-sky-400/30">
            <PackageCheck className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-2">
              <span>StockVault</span>
              <span className="text-sky-400">Pro</span>
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-1">
              Enterprise Inventory & Audit Control
            </p>
          </div>
        </div>

        {/* Main Glass Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          
          <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>System Authentication</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>System Locked</span>
            </span>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* Username / Email field */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">
                Username or Email <span className="text-sky-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Admin or admin@stockvault.com"
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                />
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">
                Password <span className="text-sky-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoading ? 'Authenticating System...' : 'Log In to Enterprise Console'}</span>
            </button>

            {onLaunchSetup && (
              <button
                type="button"
                onClick={onLaunchSetup}
                className="w-full text-center text-xs text-slate-400 hover:text-sky-400 pt-2 transition-colors flex items-center justify-center gap-1 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Need First-Time Database Setup? Click Here
              </button>
            )}

          </form>

        </div>

        {/* Footer info */}
        <div className="text-center text-[10px] text-slate-500 space-y-1">
          <p>© 2026 StockVault Enterprise System. All Rights Reserved.</p>
          <p>Dual-Signature & Role-Based Access Control Enforced.</p>
        </div>

      </div>
    </div>
  );
};
