import React from 'react';
import {
  DollarSign,
  Package,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Boxes,
  TrendingUp,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { DashboardMetrics, StockTransaction, FinancialYear } from '../types';
import { formatCurrency } from '../utils/format';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  transactions: StockTransaction[];
  activeFy: FinancialYear | undefined;
  currencySymbol?: string;
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  transactions,
  activeFy,
  currencySymbol = 'E',
  onNavigate
}) => {
  const fmt = (val: number) => formatCurrency(val, currencySymbol, 0);

  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Active FY Header Banner */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between shadow-2xl relative overflow-hidden backdrop-blur-md hover:border-sky-500/30 transition-all">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="z-10 space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-3 py-1 rounded-full">
              Financial Year {metrics?.activeFinancialYear || activeFy?.yearCode || '2025-2026'}
            </span>
            <span className="text-xs text-slate-500 font-mono">• REALTIME_VALUATION_LEDGER</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Enterprise Inventory Command
          </h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Live monitoring of stock valuation, department allocations, low-stock thresholds, and dual-signature verified dispatches.
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center space-x-3 z-10">
          <button
            onClick={() => onNavigate('stock-in')}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase tracking-[0.15em] px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Stock In Batch</span>
          </button>
          <button
            onClick={() => onNavigate('stock-out')}
            className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-[0.15em] px-4 py-2.5 rounded-xl transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            <span>Dispatch Stock</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Valuation */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-sky-500/50 transition-all backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Total Stock Valuation</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-light text-white tracking-tight italic">
              {fmt(metrics?.totalInventoryValuation ?? 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
              <span className="text-sky-400 font-medium">FY {metrics?.activeFinancialYear || activeFy?.yearCode || '2025-2026'}</span>
              <span>• Total Ledger Asset Value</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Total Units & Serialized */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-sky-500/50 transition-all backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Available Stock Units</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-light text-white tracking-tight italic">
              {(metrics?.totalItemsCount ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">Units</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              <span className="text-indigo-400 font-medium">{metrics?.totalSerializedCount ?? 0}</span> Serialized Items Tracked
            </div>
          </div>
        </div>

        {/* Metric 3: Low Stock Warnings */}
        <div
          onClick={() => onNavigate && onNavigate('low-stock')}
          className={`bg-slate-900/40 border rounded-2xl p-5 space-y-3 relative overflow-hidden group transition-all backdrop-blur-sm shadow-xl cursor-pointer ${
            (metrics?.lowStockAlertsCount ?? 0) > 0 ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500 hover:scale-[1.01]' : 'border-slate-800 hover:border-sky-500/50 hover:scale-[1.01]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Low-Stock Alerts</span>
            <div className={`p-2 rounded-xl border ${
              (metrics?.lowStockAlertsCount ?? 0) > 0 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-800/80 text-slate-400 border-slate-700'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-3xl font-light tracking-tight italic ${(metrics?.lowStockAlertsCount ?? 0) > 0 ? 'text-amber-400 font-semibold' : 'text-white'}`}>
              {metrics?.lowStockAlertsCount ?? 0} <span className="text-xs font-normal text-slate-500">Batches</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Below threshold level</span>
              <span className="text-amber-400 group-hover:underline text-[10px] font-semibold">View All →</span>
            </div>
          </div>
        </div>

        {/* Metric 4: In vs Out Volume */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-sky-500/50 transition-all backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Dispatched Value</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-light text-emerald-400 tracking-tight italic">
              {fmt(metrics?.monthlyStockOutValue ?? 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Out of {fmt(metrics?.monthlyStockInValue ?? 0)} total incoming
            </div>
          </div>
        </div>

      </div>

      {/* Breakdown Charts & Progress Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Department Stock Breakdown */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Department Stock Allocation</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono uppercase">Valuation & Units</span>
          </div>

          <div className="space-y-3">
            {(metrics?.departmentBreakdown || []).map((dept, idx) => {
              const maxVal = Math.max(...(metrics?.departmentBreakdown || []).map(d => d.value), 1);
              const percentage = Math.round((dept.value / maxVal) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{dept.departmentName}</span>
                    <span className="font-semibold text-slate-300">
                      {fmt(dept.value)} <span className="text-slate-500 font-normal">({dept.count} units)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Stock Distribution */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Category Distribution</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono uppercase">Units in Stock</span>
          </div>

          <div className="space-y-3">
            {(metrics?.categoryBreakdown || []).map((cat, idx) => {
              const maxCount = Math.max(...(metrics?.categoryBreakdown || []).map(c => c.count), 1);
              const percentage = Math.round((cat.count / maxCount) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{cat.categoryName}</span>
                    <span className="font-semibold text-slate-300">
                      {cat.count} units <span className="text-slate-500 font-normal">({fmt(cat.value)})</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Recent Transactions Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Recent Stock Transactions & Dispatches</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Linked to Financial Year {metrics.activeFinancialYear}</p>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-xs text-sky-400 hover:text-sky-300 font-bold uppercase tracking-wider flex items-center space-x-1"
          >
            <span>View Full Audit Ledger</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/30 text-slate-500 uppercase text-[10px] tracking-[0.1em] font-semibold border-b border-slate-800/80">
              <tr>
                <th className="px-3 py-3">Transaction Ref</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Category / Item</th>
                <th className="px-3 py-3">Recipient Dept</th>
                <th className="px-3 py-3">Valuation</th>
                <th className="px-3 py-3">Signature Audit</th>
                <th className="px-3 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {transactions.slice(0, 6).map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 py-3 font-mono text-sky-400 font-semibold">
                    {tx.transactionCode}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                      tx.type === 'STOCK_IN'
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        : tx.type === 'STOCK_OUT'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-200">{tx.categoryName || 'Stock Item'}</div>
                    {tx.serialNumber && (
                      <div className="text-[10px] text-indigo-400 font-mono">SN: {tx.serialNumber}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-300">
                    {tx.receiverDepartmentName || tx.receivedByName}
                  </td>
                  <td className="px-3 py-3 font-mono font-semibold text-slate-100">
                    {fmt(tx.totalValue)}
                  </td>
                  <td className="px-3 py-3">
                    {tx.signatures ? (
                      <span className="flex items-center space-x-1 text-emerald-400 text-[10px] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 w-fit">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Dual Signed</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px] font-mono">SYSTEM_LOG</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-[11px] font-mono">
                    {new Date(tx.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
