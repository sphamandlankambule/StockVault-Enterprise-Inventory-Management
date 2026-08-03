import React, { useState } from 'react';
import { FileSpreadsheet, Search, Filter, ShieldCheck, Terminal, User } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogsViewProps {
  logs: AuditLog[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Extract unique actions for dropdown
  const uniqueActions = Array.from(new Set(logs.map(l => l.action).filter(Boolean)));

  const filteredLogs = logs.filter((log) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (log.action && log.action.toLowerCase().includes(s)) ||
      (log.userName && log.userName.toLowerCase().includes(s)) ||
      (log.ipAddress && log.ipAddress.includes(searchTerm)) ||
      (log.entityId && String(log.entityId).toLowerCase().includes(s)) ||
      (log.entityType && log.entityType.toLowerCase().includes(s));

    const matchesAction = !actionFilter || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">System Audit Trail & Compliance Ledger</h1>
            <p className="text-xs text-slate-400">
              Immutable accountability log capturing user operations, stock movements, IP addresses, and state changes
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs px-3 py-1.5 rounded-lg font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Trail Active</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search action, user name, IP address or entity ID..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Audit Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User & Role</th>
                <th className="px-4 py-3">Action Executed</th>
                <th className="px-4 py-3">Target Entity</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-200">{log.userName}</div>
                    <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                      {log.userRole}
                    </span>
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-200 font-mono text-[11px]">
                    {log.action}
                  </td>

                  <td className="px-4 py-3 font-mono text-slate-400">
                    {log.entityType} ({log.entityId})
                  </td>

                  <td className="px-4 py-3 font-mono text-amber-300">
                    {log.ipAddress}
                  </td>

                  <td className="px-4 py-3">
                    {(log.newValues || log.oldValues) ? (
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/30 cursor-pointer font-medium"
                      >
                        Inspect Payload
                      </button>
                    ) : (
                      <span className="text-slate-500 text-[10px]">No Diff Payload</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Audit Log JSON Payload Inspector</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block mb-1">Old Values Payload:</span>
                <pre className="bg-slate-950 p-3 rounded-xl text-[11px] font-mono text-rose-300 overflow-x-auto border border-slate-800">
                  {selectedLog.oldValues ? JSON.stringify(JSON.parse(selectedLog.oldValues), null, 2) : 'None (Created Entity)'}
                </pre>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">New Values Payload:</span>
                <pre className="bg-slate-950 p-3 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto border border-slate-800">
                  {selectedLog.newValues ? JSON.stringify(JSON.parse(selectedLog.newValues), null, 2) : 'None'}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-4 py-2 rounded-xl"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
