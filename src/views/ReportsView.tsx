import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Building2,
  Download,
  Printer,
  DollarSign,
  Package,
  TrendingDown,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  ExternalLink,
  FileText
} from 'lucide-react';
import { FinancialYear, Department, ReportSummary, StockBatch, StockTransaction, User as UserType } from '../types';
import { formatCurrency } from '../utils/format';

interface ReportsViewProps {
  financialYears: FinancialYear[];
  departments: Department[];
  activeFyId: string;
  currentUser: UserType;
  currencySymbol?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  financialYears,
  departments,
  activeFyId,
  currentUser,
  currencySymbol = 'E'
}) => {
  const [selectedFyId, setSelectedFyId] = useState(activeFyId);
  const [selectedDeptId, setSelectedDeptId] = useState(() => {
    if (currentUser.role !== 'ADMIN' && currentUser.departmentId) {
      return currentUser.departmentId;
    }
    return '';
  });
  const [reportData, setReportData] = useState<ReportSummary | null>(null);
  const [batchesList, setBatchesList] = useState<StockBatch[]>([]);
  const [txsList, setTxsList] = useState<StockTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentUser.role !== 'ADMIN' && currentUser.departmentId) {
      setSelectedDeptId(currentUser.departmentId);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchReport();
  }, [selectedFyId, selectedDeptId, currentUser?.id]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const deptFilter = currentUser.role !== 'ADMIN' && currentUser.departmentId ? currentUser.departmentId : selectedDeptId;
      const url = `/api/reports/valuation?financialYearId=${selectedFyId}&departmentId=${deptFilter}`;
      const res = await fetch(url, {
        headers: {
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'ADMIN',
          'x-user-department-id': currentUser?.departmentId || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReportData(data.summary);
        setBatchesList(data.batches || []);
        setTxsList(data.transactions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const generateStandaloneReportHtml = () => {
    if (!reportData) return '';
    const rowsHtml = batchesList.map(b => `
      <tr>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${b.batchNumber}</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${b.supplierName}</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${currencySymbol} ${b.unitCost.toLocaleString()}</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">${b.totalQuantity}</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #1e293b;">${b.availableQuantity}</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; text-align: right;">${currencySymbol} ${(b.availableQuantity * b.unitCost).toLocaleString()}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>StockVault Enterprise - Official Valuation Report ${reportData.financialYearCode}</title>
  <style>
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; padding: 0; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 40px; background: #ffffff; }
    .no-print-bar { background: #0f172a; color: #ffffff; padding: 12px 24px; margin: -40px -40px 30px -40px; display: flex; justify-content: space-between; align-items: center; }
    .btn-print { background: #0284c7; color: #ffffff; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
    .btn-print:hover { background: #0369a1; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 800; tracking-tight; color: #0f172a; }
    .subtitle { font-size: 13px; color: #475569; margin-top: 4px; }
    .meta { text-align: right; font-size: 12px; color: #334155; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; }
    .card-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; tracking: 0.05em; }
    .card-val { font-size: 20px; font-weight: 800; margin-top: 6px; color: #0f172a; }
    .card-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th { background: #f1f5f9; text-align: left; padding: 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #1e293b; text-transform: uppercase; font-size: 10px; }
    .section-title { font-size: 14px; font-weight: 700; margin-top: 24px; color: #0f172a; }
    .footer { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; font-size: 12px; }
    .sig-box { border-top: 1px solid #94a3b8; pt: 8px; font-weight: 600; color: #334155; }
  </style>
</head>
<body>
  <div class="no-print-bar no-print">
    <div style="font-size: 13px; font-weight: 600;">StockVault Official Print Viewer</div>
    <button class="btn-print" onclick="window.print()">🖨️ Click Here to Print Report</button>
  </div>

  <div class="header">
    <div>
      <div class="title">StockVault Enterprise Systems</div>
      <div class="subtitle">Official Financial Year Stock Valuation & Audit Document</div>
    </div>
    <div class="meta">
      <div><strong>FY Code:</strong> ${reportData.financialYearCode}</div>
      <div><strong>Department:</strong> ${reportData.departmentName}</div>
      <div><strong>Generated:</strong> ${new Date(reportData.generatedAt).toLocaleString()}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-label">Total Incoming Stock</div>
      <div class="card-val">${currencySymbol} ${reportData.totalIncomingValue.toLocaleString()}</div>
      <div class="card-sub">${reportData.totalIncomingQuantity} Units Received</div>
    </div>
    <div class="card">
      <div class="card-label">Dispatched / Stock Out</div>
      <div class="card-val">${currencySymbol} ${reportData.totalOutgoingValue.toLocaleString()}</div>
      <div class="card-sub">${reportData.totalOutgoingQuantity} Units Issued</div>
    </div>
    <div class="card">
      <div class="card-label">Remaining Balance</div>
      <div class="card-val">${currencySymbol} ${reportData.remainingStockValue.toLocaleString()}</div>
      <div class="card-sub">${reportData.remainingStockCount} Units Remaining</div>
    </div>
    <div class="card">
      <div class="card-label">Maintenance / Scrapped</div>
      <div class="card-val">${reportData.itemsUnderMaintenance} / ${reportData.decommissionedItems}</div>
      <div class="card-sub">Non-Active Items</div>
    </div>
  </div>

  <div class="section-title">Stock Batches Valuation Ledger</div>
  <table>
    <thead>
      <tr>
        <th>Batch Ref</th>
        <th>Supplier Name</th>
        <th>Unit Cost</th>
        <th style="text-align: center;">Total Qty</th>
        <th style="text-align: center;">Available Qty</th>
        <th style="text-align: right;">Remaining Value</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <div class="sig-box" style="margin-top: 40px; border-top: 1px solid #94a3b8; padding-top: 6px;">
        Prepared By: Store Keeper / Warehouse Director
      </div>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Signature Stamp & Date</div>
    </div>

    <div>
      <div class="sig-box" style="margin-top: 40px; border-top: 1px solid #94a3b8; padding-top: 6px;">
        Approved By: Internal Financial Auditor
      </div>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Signature Stamp & Date</div>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    // 1. Trigger browser window.print() directly
    try {
      window.print();
    } catch (e) {
      console.error('Direct print failed, attempting popup window print', e);
      handleOpenPrintTab();
    }
  };

  const handleOpenPrintTab = () => {
    const htmlContent = generateStandaloneReportHtml();
    if (!htmlContent) return;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      setTimeout(() => {
        printWin.print();
      }, 300);
    } else {
      alert('Pop-up was blocked by browser. Downloading report file instead.');
      handleDownloadReportHtml();
    }
  };

  const handleDownloadReportHtml = () => {
    const htmlContent = generateStandaloneReportHtml();
    if (!htmlContent) return;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StockVault_Official_Report_${selectedFyId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fmtVal = (val: number = 0) => {
    return formatCurrency(val, currencySymbol, 0);
  };

  return (
    <div className="space-y-6">
      
      {/* Printable Header Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Financial Year Stock Valuation Report</h1>
            <p className="text-xs text-slate-400">
              Department-wise inventory valuation, usage ledger, and asset audit summary
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
            title="Print report using direct browser dialog"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Report</span>
          </button>

          <button
            onClick={handleOpenPrintTab}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
            title="Open clean print window in a new tab"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span>Open Print Tab</span>
          </button>

          <button
            onClick={handleDownloadReportHtml}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
            title="Download printable HTML/PDF report file"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download HTML/PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Options */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Select Financial Year *</label>
            <select
              value={selectedFyId}
              onChange={(e) => setSelectedFyId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  Financial Year {fy.yearCode} {fy.isActive ? '(Active FY)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Select Department Filter
              {currentUser.role !== 'ADMIN' && (
                <span className="ml-1.5 text-[10px] text-amber-400 font-normal">(Locked to Registered Dept)</span>
              )}
            </label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              disabled={currentUser.role !== 'ADMIN'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {currentUser.role === 'ADMIN' && <option value="">All Organization Departments</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Official Printable Report Document View */}
      {reportData && (
        <div className="printable-document bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-8 shadow-2xl text-slate-200 print:bg-white print:text-slate-900 print:border-none print:shadow-none">
          
          {/* Letterhead Header */}
          <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-6">
            <div>
              <div className="text-xl font-bold tracking-tight text-white print:text-slate-900">
                StockVault Enterprise Systems
              </div>
              <div className="text-xs text-slate-400 print:text-slate-600 mt-0.5">
                Financial Audit & Inventory Valuation Document
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <div className="font-bold text-amber-400 print:text-slate-800">
                FY Code: {reportData.financialYearCode}
              </div>
              <div className="text-slate-400 print:text-slate-600">
                Department: {reportData.departmentName}
              </div>
              <div className="text-[10px] text-slate-500 print:text-slate-500">
                Generated: {new Date(reportData.generatedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-1 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 font-medium block">Total Incoming Stock</span>
              <div className="text-lg font-bold text-sky-400 print:text-sky-700">
                {fmtVal(reportData.totalIncomingValue)}
              </div>
              <span className="text-[10px] text-slate-400 print:text-slate-600">
                {reportData.totalIncomingQuantity} Units Received
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-1 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 font-medium block">Dispatched / Stock Out</span>
              <div className="text-lg font-bold text-emerald-400 print:text-emerald-700">
                {fmtVal(reportData.totalOutgoingValue)}
              </div>
              <span className="text-[10px] text-slate-400 print:text-slate-600">
                {reportData.totalOutgoingQuantity} Units Issued
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-1 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 font-medium block">Remaining Current Balance</span>
              <div className="text-lg font-bold text-amber-400 print:text-slate-900">
                {fmtVal(reportData.remainingStockValue)}
              </div>
              <span className="text-[10px] text-slate-400 print:text-slate-600">
                {reportData.remainingStockCount} Units Remaining
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-1 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 font-medium block">Maintenance & Scrapped</span>
              <div className="text-lg font-bold text-purple-400 print:text-purple-700">
                {reportData.itemsUnderMaintenance} Repair / {reportData.decommissionedItems} Scrap
              </div>
              <span className="text-[10px] text-slate-400 print:text-slate-600">
                Non-Active Inventory Items
              </span>
            </div>

          </div>

          {/* Breakdown Ledger Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white print:text-slate-900 flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-sky-400 print:text-sky-600" />
              <span>Financial Year Stock Batches Ledger</span>
            </h3>

            <div className="overflow-x-auto border border-slate-800 print:border-slate-300 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 print:bg-slate-200 text-slate-300 print:text-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Batch Ref</th>
                    <th className="px-3 py-2.5">Supplier</th>
                    <th className="px-3 py-2.5">Unit Cost</th>
                    <th className="px-3 py-2.5">Total Qty</th>
                    <th className="px-3 py-2.5">Available Qty</th>
                    <th className="px-3 py-2.5">Remaining Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-slate-300 print:text-slate-800">
                  {batchesList.map((batch) => (
                    <tr key={batch.id}>
                      <td className="px-3 py-2.5 font-mono font-medium">{batch.batchNumber}</td>
                      <td className="px-3 py-2.5">{batch.supplierName}</td>
                      <td className="px-3 py-2.5 font-mono">{formatCurrency(batch.unitCost, currencySymbol)}</td>
                      <td className="px-3 py-2.5">{batch.totalQuantity}</td>
                      <td className="px-3 py-2.5 font-bold text-amber-400 print:text-slate-900">{batch.availableQuantity}</td>
                      <td className="px-3 py-2.5 font-semibold font-mono">{formatCurrency(batch.availableQuantity * batch.unitCost, currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures & Certification Footer */}
          <div className="pt-8 border-t border-slate-800 print:border-slate-300 grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-8">
              <div className="border-b border-slate-700 print:border-slate-400 pb-1 font-semibold text-slate-300 print:text-slate-800">
                Prepared By: Store Keeper / Warehouse Director
              </div>
              <div className="text-[10px] text-slate-500">Signature Stamp & Date</div>
            </div>

            <div className="space-y-8">
              <div className="border-b border-slate-700 print:border-slate-400 pb-1 font-semibold text-slate-300 print:text-slate-800">
                Approved By: Internal Financial Auditor
              </div>
              <div className="text-[10px] text-slate-500">Signature Stamp & Date</div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

