import React, { useState } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  Download,
  PackagePlus,
  ArrowUpRight,
  ShieldAlert,
  Building2,
  Boxes,
  FileSpreadsheet,
  Printer,
  ExternalLink,
  CheckCircle2,
  TrendingDown
} from 'lucide-react';
import { StockBatch, Category, Department, FinancialYear, User as UserType } from '../types';

interface LowStockViewProps {
  batches: StockBatch[];
  categories: Category[];
  departments: Department[];
  financialYears: FinancialYear[];
  activeFyId: string;
  currentUser: UserType;
  currencySymbol?: string;
  globalThreshold?: number;
  onNavigateToStockIn?: () => void;
}

export const LowStockView: React.FC<LowStockViewProps> = ({
  batches,
  categories,
  departments,
  financialYears,
  activeFyId,
  currentUser,
  currencySymbol = 'E',
  globalThreshold = 5,
  onNavigateToStockIn
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFyId, setSelectedFyId] = useState(activeFyId);
  const [selectedDeptId, setSelectedDeptId] = useState(() => {
    if (currentUser.role !== 'ADMIN' && currentUser.departmentId) {
      return currentUser.departmentId;
    }
    return '';
  });
  const [selectedCatId, setSelectedCatId] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'CRITICAL' | 'WARNING'>('ALL');

  // Helper to get threshold for a category
  const getCategoryThreshold = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.lowStockThreshold : globalThreshold;
  };

  // Filter batches that are at or below threshold
  const lowStockBatches = batches.filter((batch) => {
    const threshold = getCategoryThreshold(batch.categoryId);
    const isLow = batch.availableQuantity <= threshold;
    if (!isLow) return false;

    // User department security check
    const isUserAdmin = currentUser.role === 'ADMIN';
    const matchesUserDept = isUserAdmin || !currentUser.departmentId || batch.departmentId === currentUser.departmentId;

    const matchesSearch =
      !searchTerm ||
      batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (batch.categoryName && batch.categoryName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (batch.supplierName && batch.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (batch.departmentName && batch.departmentName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFy = !selectedFyId || batch.financialYearId === selectedFyId;
    const matchesDept = !selectedDeptId || batch.departmentId === selectedDeptId;
    const matchesCat = !selectedCatId || batch.categoryId === selectedCatId;

    let matchesUrgency = true;
    if (urgencyFilter === 'OUT_OF_STOCK') {
      matchesUrgency = batch.availableQuantity === 0;
    } else if (urgencyFilter === 'CRITICAL') {
      matchesUrgency = batch.availableQuantity > 0 && batch.availableQuantity <= Math.ceil(threshold / 2);
    } else if (urgencyFilter === 'WARNING') {
      matchesUrgency = batch.availableQuantity > Math.ceil(threshold / 2) && batch.availableQuantity <= threshold;
    }

    return matchesUserDept && matchesSearch && matchesFy && matchesDept && matchesCat && matchesUrgency;
  });

  // Calculate Metrics
  const totalLowCount = lowStockBatches.length;
  const outOfStockCount = lowStockBatches.filter(b => b.availableQuantity === 0).length;
  const criticalCount = lowStockBatches.filter(b => b.availableQuantity > 0 && b.availableQuantity <= Math.ceil(getCategoryThreshold(b.categoryId) / 2)).length;
  const warningCount = totalLowCount - outOfStockCount - criticalCount;

  // Estimated Reorder Cost
  const totalReorderEstimatedCost = lowStockBatches.reduce((sum, b) => {
    const threshold = getCategoryThreshold(b.categoryId);
    const deficit = Math.max(0, threshold - b.availableQuantity);
    return sum + (deficit * b.unitCost);
  }, 0);

  // Category summary calculation
  const categorySummaryMap = new Map<string, {
    categoryId: string;
    categoryName: string;
    totalAvailable: number;
    threshold: number;
    batchesCount: number;
    estimatedCost: number;
  }>();

  batches.forEach(b => {
    const threshold = getCategoryThreshold(b.categoryId);
    const catName = b.categoryName || 'General';
    const existing = categorySummaryMap.get(b.categoryId) || {
      categoryId: b.categoryId,
      categoryName: catName,
      totalAvailable: 0,
      threshold,
      batchesCount: 0,
      estimatedCost: 0
    };

    const deficit = Math.max(0, threshold - b.availableQuantity);
    categorySummaryMap.set(b.categoryId, {
      ...existing,
      totalAvailable: existing.totalAvailable + b.availableQuantity,
      batchesCount: existing.batchesCount + 1,
      estimatedCost: existing.estimatedCost + (deficit * b.unitCost)
    });
  });

  const lowCategoriesSummary = Array.from(categorySummaryMap.values()).filter(c => c.totalAvailable <= c.threshold);

  // Export CSV
  const handleExportCSV = () => {
    if (lowStockBatches.length === 0) return;

    const headers = ['Batch Number', 'Category', 'Department', 'Supplier', 'Current Stock', 'Threshold', 'Deficit', 'Unit Cost', 'Est Replenishment Cost'];
    const rows = lowStockBatches.map(b => {
      const threshold = getCategoryThreshold(b.categoryId);
      const deficit = Math.max(0, threshold - b.availableQuantity);
      return [
        `"${b.batchNumber}"`,
        `"${b.categoryName || ''}"`,
        `"${b.departmentName || ''}"`,
        `"${b.supplierName || ''}"`,
        b.availableQuantity,
        threshold,
        deficit,
        b.unitCost,
        deficit * b.unitCost
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Low_Stock_Reorder_Request_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print Reorder Form
  const handlePrintReorderRequest = () => {
    const rowsHtml = lowStockBatches.map(b => {
      const threshold = getCategoryThreshold(b.categoryId);
      const deficit = Math.max(0, threshold - b.availableQuantity);
      return `
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${b.batchNumber}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${b.categoryName || '-'}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${b.departmentName || '-'}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${b.supplierName || '-'}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${b.availableQuantity === 0 ? '#dc2626' : '#d97706'};">${b.availableQuantity}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${threshold}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0284c7;">${deficit}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; text-align: right;">${currencySymbol} ${b.unitCost.toLocaleString()}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; text-align: right;">${currencySymbol} ${(deficit * b.unitCost).toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>StockVault - Stock Requisition & Reorder Request</title>
  <style>
    @media print { .no-print { display: none !important; } body { margin: 0; padding: 0; } }
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 30px; }
    .no-print-bar { background: #0f172a; color: #fff; padding: 10px 20px; margin: -30px -30px 20px -30px; flex; justify-content: space-between; align-items: center; }
    .btn-p { background: #0284c7; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; font-weight: 600; cursor: pointer; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
    .title { font-size: 20px; font-weight: 800; }
    .meta { font-size: 11px; text-align: right; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; font-weight: 700; text-transform: uppercase; font-size: 10px; }
    .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 20px; display: flex; gap: 30px; font-size: 12px; }
    .footer { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; font-size: 11px; }
    .sig { border-top: 1px solid #94a3b8; padding-top: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="no-print-bar no-print flex" style="display: flex; justify-content: space-between; align-items: center;">
    <div><strong>StockVault Reorder Request Printer</strong></div>
    <button class="btn-p" onclick="window.print()">Print Requisition Document</button>
  </div>

  <div class="header">
    <div>
      <div class="title">StockVault Enterprise - Low Stock Requisition</div>
      <div style="font-size: 12px; color: #475569; margin-top: 2px;">Official Purchasing & Restock Request Notice</div>
    </div>
    <div class="meta">
      <div><strong>Generated Date:</strong> ${new Date().toLocaleString()}</div>
      <div><strong>Total Low Items:</strong> ${totalLowCount} Batches</div>
      <div><strong>Est. Reorder Budget:</strong> ${currencySymbol} ${totalReorderEstimatedCost.toLocaleString()}</div>
    </div>
  </div>

  <div class="summary-box">
    <div><strong>Out of Stock Batches:</strong> <span style="color: #dc2626;">${outOfStockCount}</span></div>
    <div><strong>Critical Warning Batches:</strong> <span style="color: #d97706;">${criticalCount}</span></div>
    <div><strong>Target Financial Year:</strong> ${selectedFyId || activeFyId}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Batch Ref</th>
        <th>Category</th>
        <th>Department</th>
        <th>Supplier</th>
        <th style="text-align: center;">Stock</th>
        <th style="text-align: center;">Min Threshold</th>
        <th style="text-align: center;">Deficit Qty</th>
        <th style="text-align: right;">Unit Cost</th>
        <th style="text-align: right;">Est Reorder Cost</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <div class="sig" style="margin-top: 30px;">Store Keeper / Inventory Manager</div>
      <div style="font-size: 9px; color: #64748b;">Signature & Date</div>
    </div>
    <div>
      <div class="sig" style="margin-top: 30px;">Finance / Procurement Director</div>
      <div style="font-size: 9px; color: #64748b;">Approval Signature & Date</div>
    </div>
  </div>
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      setTimeout(() => printWin.print(), 300);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
                <span>Low Stock & Reorder Center</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time inventory depletion monitoring, reorder threshold alerts, and restocking budget estimates.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {onNavigateToStockIn && (
            <button
              onClick={onNavigateToStockIn}
              className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Stock In New Batch</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={lowStockBatches.length === 0}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            title="Download CSV for Procurement"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV Notice</span>
          </button>

          <button
            onClick={handlePrintReorderRequest}
            disabled={lowStockBatches.length === 0}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs px-3.5 py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
            title="Print printable purchase requisition"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>Print Reorder Request</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Low Stock Batches */}
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Low Stock Batches</span>
            <Boxes className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {totalLowCount} <span className="text-xs font-normal text-slate-400">Batches</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Below defined threshold level
          </div>
        </div>

        {/* Card 2: Out of Stock Count */}
        <div className="bg-slate-900/60 border border-red-500/30 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Depleted (0 Quantity)</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">
            {outOfStockCount} <span className="text-xs font-normal text-slate-400">Batches</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Immediate replenishment required
          </div>
        </div>

        {/* Card 3: Critical Level Batches */}
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Critical Warning</span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300">
            {criticalCount} <span className="text-xs font-normal text-slate-400">Batches</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Stock at &lt;50% of threshold
          </div>
        </div>

        {/* Card 4: Estimated Reorder Budget */}
        <div className="bg-slate-900/60 border border-sky-500/30 rounded-2xl p-4 space-y-2 relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Est. Reorder Cost</span>
            <FileSpreadsheet className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 font-mono">
            {currencySymbol} {totalReorderEstimatedCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            To restore all stock to threshold
          </div>
        </div>

      </div>

      {/* Filter and Search Controls Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4 backdrop-blur-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Field */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search batch ref, category, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              disabled={currentUser.role !== 'ADMIN'}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 disabled:opacity-75"
            >
              {currentUser.role === 'ADMIN' && <option value="">All Departments</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Min: {c.lowStockThreshold})
                </option>
              ))}
            </select>
          </div>

          {/* Severity / Urgency Filter */}
          <div>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value as any)}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="ALL">All Severity Levels</option>
              <option value="OUT_OF_STOCK">🚨 Out of Stock (0)</option>
              <option value="CRITICAL">⚠️ Critical (&lt;50% threshold)</option>
              <option value="WARNING">⚡ Warning (Below threshold)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Table: Low Stock Items & Batches */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Boxes className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">Low-Stock Batch Inventory Ledger</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Showing {lowStockBatches.length} depleted or low batches
          </span>
        </div>

        {lowStockBatches.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
            <h3 className="text-base font-semibold text-slate-200">No Low Stock Items Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All stock batches for the selected filters are currently above their minimum required thresholds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-3.5">Batch Ref & Category</th>
                  <th className="p-3.5">Department</th>
                  <th className="p-3.5">Supplier Details</th>
                  <th className="p-3.5 text-center">Available Stock</th>
                  <th className="p-3.5 text-center">Min Threshold</th>
                  <th className="p-3.5 text-center">Deficit Qty</th>
                  <th className="p-3.5 text-right">Unit Cost</th>
                  <th className="p-3.5 text-right">Est Reorder Cost</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {lowStockBatches.map((batch) => {
                  const threshold = getCategoryThreshold(batch.categoryId);
                  const deficit = Math.max(0, threshold - batch.availableQuantity);
                  const isOutOfStock = batch.availableQuantity === 0;
                  const isCritical = batch.availableQuantity > 0 && batch.availableQuantity <= Math.ceil(threshold / 2);
                  const pct = Math.min(100, Math.round((batch.availableQuantity / (threshold || 1)) * 100));

                  return (
                    <tr key={batch.id} className="hover:bg-slate-800/40 transition-colors">
                      
                      {/* Batch Ref & Category */}
                      <td className="p-3.5">
                        <div className="font-bold font-mono text-white flex items-center space-x-1.5">
                          <span>{batch.batchNumber}</span>
                          {isOutOfStock ? (
                            <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-sans font-bold">
                              DEPLETED
                            </span>
                          ) : isCritical ? (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-sans font-bold">
                              CRITICAL
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {batch.categoryName || 'General Category'}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="p-3.5">
                        <div className="flex items-center space-x-1.5 text-slate-200 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{batch.departmentName || 'Organization Wide'}</span>
                        </div>
                      </td>

                      {/* Supplier Details */}
                      <td className="p-3.5">
                        <div className="text-slate-200 font-medium">{batch.supplierName || 'N/A'}</div>
                        {batch.remarks && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                            {batch.remarks}
                          </div>
                        )}
                      </td>

                      {/* Available Stock Progress */}
                      <td className="p-3.5 text-center">
                        <div className={`font-bold font-mono text-sm ${
                          isOutOfStock ? 'text-red-400' : isCritical ? 'text-amber-400' : 'text-amber-300'
                        }`}>
                          {batch.availableQuantity} / {batch.totalQuantity}
                        </div>
                        <div className="w-20 bg-slate-800 rounded-full h-1.5 mx-auto mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOutOfStock ? 'bg-red-500' : isCritical ? 'bg-amber-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      {/* Min Threshold */}
                      <td className="p-3.5 text-center font-mono font-bold text-slate-300">
                        {threshold}
                      </td>

                      {/* Deficit Quantity */}
                      <td className="p-3.5 text-center">
                        <span className="font-bold font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-lg">
                          +{deficit} Units
                        </span>
                      </td>

                      {/* Unit Cost */}
                      <td className="p-3.5 text-right font-mono text-slate-300">
                        {currencySymbol} {batch.unitCost.toLocaleString()}
                      </td>

                      {/* Est Reorder Cost */}
                      <td className="p-3.5 text-right font-mono font-bold text-slate-100">
                        {currencySymbol} {(deficit * batch.unitCost).toLocaleString()}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center">
                        {onNavigateToStockIn ? (
                          <button
                            onClick={onNavigateToStockIn}
                            className="inline-flex items-center space-x-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold px-2.5 py-1.5 rounded-xl transition-all cursor-pointer text-[11px]"
                            title="Restock this batch"
                          >
                            <span>Restock</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No Perms</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Level Aggregation Table */}
      {lowCategoriesSummary.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-amber-400" />
              <span>Category Level Stock Deficit Summary</span>
            </h3>
            <span className="text-xs text-slate-400">Aggregated stock threshold levels</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowCategoriesSummary.map((cat) => {
              const deficit = Math.max(0, cat.threshold - cat.totalAvailable);
              return (
                <div key={cat.categoryId} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs">{cat.categoryName}</span>
                    <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                      Threshold: {cat.threshold}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-400">Current Aggregated Stock:</span>
                    <span className="font-bold text-white font-mono">{cat.totalAvailable} Units</span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-400">Restock Deficit:</span>
                    <span className="font-bold text-sky-400 font-mono">+{deficit} Units</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Est Restock Budget:</span>
                    <span className="font-bold font-mono text-emerald-400">{currencySymbol} {cat.estimatedCost.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
