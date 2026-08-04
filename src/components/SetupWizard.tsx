import React, { useState } from 'react';
import { Database, ShieldCheck, Building, Calendar, DollarSign, ArrowRight, CheckCircle2, Lock, User, Mail, Sparkles, KeyRound } from 'lucide-react';
import { User as UserType } from '../types';

interface SetupWizardProps {
  onSetupComplete: (user: UserType) => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onSetupComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [adminFullName, setAdminFullName] = useState('System Director');
  const [adminUsername, setAdminUsername] = useState('Admin');
  const [adminEmail, setAdminEmail] = useState('admin@stockvault.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [departmentCode, setDepartmentCode] = useState('DEP-HQ');
  const [departmentName, setDepartmentName] = useState('Corporate HQ Store Vault');

  const [companyName, setCompanyName] = useState('StockVault Enterprise Warehouse');
  const [currencySymbol, setCurrencySymbol] = useState('E');
  const [currencyCode, setCurrencyCode] = useState('SZL');

  const [fyLabel, setFyLabel] = useState('2025-2026');
  const [startDate, setStartDate] = useState('2025-04-01');
  const [endDate, setEndDate] = useState('2026-03-31');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your administrator password.');
      return;
    }
    if (adminPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/setup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminFullName,
          adminUsername,
          adminEmail,
          adminPassword,
          departmentCode,
          departmentName,
          companyName,
          currencySymbol,
          currencyCode,
          fyLabel,
          startDate,
          endDate
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        onSetupComplete(data.user);
      } else {
        setErrorMsg(data.error || 'Failed to complete system initialization.');
      }
    } catch (err: any) {
      setErrorMsg(`System Setup Error: ${err.message || 'Server connection failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 sm:p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Database className="w-64 h-64 text-white" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold tracking-wide uppercase text-blue-200 border border-white/20 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> First-Time System Initialization
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">StockVault Enterprise Setup</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Welcome! Database tables have been detected as uninitialized or empty. Complete this quick setup to configure your primary System Administrator account, corporate vault department, and default currency settings.
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between text-xs font-medium">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= 1 ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-slate-700 text-slate-500'}`}>1</span>
            Admin Account
          </div>
          <div className="w-8 h-px bg-slate-800" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= 2 ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-slate-700 text-slate-500'}`}>2</span>
            Store Vault & Settings
          </div>
          <div className="w-8 h-px bg-slate-800" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs ${step >= 3 ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-slate-700 text-slate-500'}`}>3</span>
            Review & Deploy
          </div>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-6 p-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-sm flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Setup Action Required</p>
              <p className="mt-0.5 opacity-90">{errorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* STEP 1: Administrator User Setup */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-400" /> Primary System Director
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Configure the root administrator account with full control over users, stock in/out, and system rules.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="e.g. David Sterling"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Username *</label>
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="e.g. Admin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@stockvault.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Password *</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!adminFullName || !adminUsername || !adminEmail || !adminPassword) {
                      setErrorMsg('Please fill in all administrator details to proceed.');
                      return;
                    }
                    if (adminPassword !== confirmPassword) {
                      setErrorMsg('Passwords do not match.');
                      return;
                    }
                    setErrorMsg(null);
                    setStep(2);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                  Next Step: Store Vault & Currency <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Store Vault, Currency & Financial Year */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-400" /> Department Store Vault & Currency Configuration
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Define your central distribution store vault and default system currency settings.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Central Department Code *</label>
                  <input
                    type="text"
                    required
                    value={departmentCode}
                    onChange={(e) => setDepartmentCode(e.target.value)}
                    placeholder="e.g. DEP-HQ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Central Store Vault Name *</label>
                  <input
                    type="text"
                    required
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="e.g. Corporate HQ Store Vault"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Organization / Enterprise Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. StockVault Enterprise Warehouse"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Currency Symbol *</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      placeholder="e.g. E or $"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Currency Code *</label>
                  <input
                    type="text"
                    required
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    placeholder="e.g. SZL or USD"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 border-t border-slate-800/80 pt-4 mt-1">
                  <label className="block text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-400" /> Active Initial Financial Year
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1">FY Label</span>
                      <input
                        type="text"
                        required
                        value={fyLabel}
                        onChange={(e) => setFyLabel(e.target.value)}
                        placeholder="2025-2026"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1">Start Date</span>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1">End Date</span>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm font-medium transition-all"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!departmentCode || !departmentName || !companyName) {
                      setErrorMsg('Please complete store vault and organization details.');
                      return;
                    }
                    setErrorMsg(null);
                    setStep(3);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                >
                  Next Step: Final Review <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Finalize Initialization */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Confirm & Initialize Database
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Verify your configuration parameters before writing initial records to the SQL database.</p>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 sm:p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">Admin Full Name</span>
                    <p className="text-slate-100 font-medium text-sm">{adminFullName}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">Admin Username</span>
                    <p className="text-blue-400 font-medium text-sm">@{adminUsername}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">Admin Email</span>
                    <p className="text-slate-200 font-medium">{adminEmail}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">Default Role</span>
                    <p className="text-purple-400 font-bold">ADMIN (System Director)</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">Primary Department</span>
                    <p className="text-slate-100 font-medium">{departmentName} ({departmentCode})</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">Organization & Currency</span>
                    <p className="text-slate-100 font-medium">{companyName} ({currencySymbol} - {currencyCode})</p>
                  </div>
                  <div className="sm:col-span-2 space-y-1 border-t border-slate-800/60 pt-2">
                    <span className="text-slate-500 uppercase font-semibold text-[10px]">Initial Financial Year</span>
                    <p className="text-slate-100 font-medium">{fyLabel} ({startDate} to {endDate})</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm font-medium transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>Initializing System...</>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> Create Admin & Launch System
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
};
