import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  Lock,
  UserCheck,
  Building2,
  Mail,
  KeyRound,
  RefreshCw,
  X,
  ShieldCheck
} from 'lucide-react';
import { User, UserRole, Department } from '../types';

interface UserManagementViewProps {
  users: User[];
  departments: Department[];
  currentUser: User;
  onCreateUser: (userData: any) => Promise<void>;
  onToggleUserStatus: (userId: string) => Promise<void>;
  onResetUserPassword?: (userId: string, newPassword: string) => Promise<void>;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  departments,
  currentUser,
  onCreateUser,
  onToggleUserStatus,
  onResetUserPassword
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('STORE_KEEPER');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [password, setPassword] = useState('StockVault@2025');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Admin Reset Password State
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('StockVault@2026');
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (currentUser.role !== 'ADMIN') {
      setFeedback({ type: 'error', message: 'Forbidden: Admin access required to create user accounts.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await onCreateUser({
        fullName,
        email,
        username,
        role,
        departmentId,
        password
      });

      setFeedback({
        type: 'success',
        message: `User account '${fullName}' provisioned successfully!`
      });

      // Reset form
      setFullName('');
      setEmail('');
      setUsername('');
      setPassword('StockVault@2025');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create user' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !onResetUserPassword) return;

    if (resetPasswordInput.length < 6) {
      setFeedback({ type: 'error', message: 'New password must be at least 6 characters long.' });
      return;
    }

    try {
      setIsResetting(true);
      await onResetUserPassword(resetTargetUser.id, resetPasswordInput);
      setFeedback({
        type: 'success',
        message: `Password for ${resetTargetUser.fullName} reset successfully!`
      });
      setResetTargetUser(null);
      setResetPasswordInput('StockVault@2026');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reset password' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin User Provisioning & RBAC</h1>
            <p className="text-xs text-slate-400">
              Role-Based Access Control (Admin, Store Keeper, Staff Receiver). Strictly Admin-Managed Provisioning.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs px-3 py-1.5 rounded-lg font-semibold">
          <Lock className="w-4 h-4" />
          <span>Strict Admin-Only Provisioning</span>
        </div>
      </div>

      {/* Mandatory Policy Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-amber-400 block">System Access Policy (Zero Self-Registration):</span>
          <p className="text-amber-200/90 leading-relaxed">
            In compliance with enterprise audit security standards, public self-registration is strictly disabled. All user accounts must be provisioned directly by the System Administrator and assigned to an authorized department and role.
          </p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-4 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertOctagon className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Create User Form (Admin Only) */}
      {currentUser.role === 'ADMIN' ? (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-purple-400" />
            <span>Provision New User Account</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alexmorgan"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex.m@stockvault.com"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Assigned Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="STORE_KEEPER">STORE KEEPER (Stock In & Out Ops)</option>
                <option value="STAFF_RECEIVER">STAFF / RECEIVER (Department Goods Receiver)</option>
                <option value="ADMIN">ADMINISTRATOR (Full Master Access)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Department *</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Initial Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-end lg:col-span-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center space-x-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Provisioning Account...' : 'Provision User Account'}</span>
              </button>
            </div>

          </div>
        </form>
      ) : (
        <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl text-xs text-slate-400">
          You are currently viewing as <span className="text-blue-400 font-semibold">{currentUser.role}</span>. Switch to Admin role in the top header to provision new accounts.
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 font-bold text-xs text-white flex items-center justify-between">
          <span>Active System Users Directory ({users.length})</span>
          <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
            Admin Password Control Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Full Name & Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created Date</th>
                <th className="px-4 py-3 text-right">Admin Control Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-100 flex items-center space-x-2">
                      <span>{u.fullName}</span>
                      {u.username && (
                        <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                          @{u.username}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">{u.email}</div>
                  </td>

                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      u.role === 'ADMIN'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : u.role === 'STORE_KEEPER'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {u.role}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-slate-300 font-medium">
                    {u.departmentName}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {u.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-slate-400 text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {currentUser.role === 'ADMIN' ? (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setResetTargetUser(u);
                            setResetPasswordInput('StockVault@2026');
                          }}
                          className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-all cursor-pointer flex items-center space-x-1"
                          title="Reset User Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset Password</span>
                        </button>

                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => onToggleUserStatus(u.id)}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                              u.status === 'ACTIVE'
                                ? 'text-rose-400 hover:text-rose-300 border-rose-500/30 bg-rose-500/10'
                                : 'text-emerald-400 hover:text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                            }`}
                          >
                            {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500">Read-Only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Reset Password Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <span>Admin Password Reset</span>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteResetPassword} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-400">Target Account:</div>
                <div className="font-bold text-white text-sm">{resetTargetUser.fullName}</div>
                <div className="text-slate-400 font-mono text-[11px]">{resetTargetUser.email}</div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">New Temporary / Reset Password *</label>
                <input
                  type="text"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-500">The user will be able to log in with this new password immediately.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-purple-600/30"
                >
                  <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Resetting Password...' : 'Reset Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
