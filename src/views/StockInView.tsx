import React, { useState, useEffect } from 'react';
import {
  PackagePlus,
  QrCode,
  CheckCircle2,
  AlertOctagon,
  Layers,
  Building2,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { Category, Department, FinancialYear, User as UserType } from '../types';

interface StockInViewProps {
  categories: Category[];
  departments: Department[];
  financialYears: FinancialYear[];
  activeFyId: string;
  currentUser: UserType;
  currencySymbol?: string;
  currencyCode?: string;
  onStockInSuccess: (batchData: any) => Promise<void>;
}

export const StockInView: React.FC<StockInViewProps> = ({
  categories,
  departments,
  financialYears,
  activeFyId,
  currentUser,
  currencySymbol = 'E',
  currencyCode = 'SZL',
  onStockInSuccess
}) => {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [departmentId, setDepartmentId] = useState(() => {
    if (currentUser.role !== 'ADMIN' && currentUser.departmentId) {
      return currentUser.departmentId;
    }
    return departments[0]?.id || '';
  });
  const [financialYearId, setFinancialYearId] = useState(activeFyId);
  const [supplierName, setSupplierName] = useState('');
  const [unitCost, setUnitCost] = useState<number | ''>(100);
  const [isSerialized, setIsSerialized] = useState(true);
  const [quantity, setQuantity] = useState<number | ''>(5);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (currentUser.role !== 'ADMIN' && currentUser.departmentId) {
      setDepartmentId(currentUser.departmentId);
    }
  }, [currentUser]);

  // Serialized Items Input
  const [serialInputText, setSerialInputText] = useState('');
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Parsed serial numbers array
  const serialList = serialInputText
    .split(/\n|,/)
    .map(s => s.trim())
    .filter(Boolean);

  // Real-time Serial Number Duplication Check against API
  useEffect(() => {
    if (!isSerialized || serialList.length === 0) {
      setDuplicateWarnings([]);
      return;
    }

    const checkDuplicates = async () => {
      const warnings: string[] = [];
      for (const serial of serialList) {
        try {
          const res = await fetch(`/api/stock/check-serial?serial=${encodeURIComponent(serial)}`);
          if (res.ok) {
            const text = await res.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch {}
            if (data.exists) {
              warnings.push(`${serial} (${data.warning || 'Already in DB'})`);
            }
          }
        } catch (e) {
          console.error('Serial check error:', e);
        }
      }
      setDuplicateWarnings(warnings);
    };

    const timer = setTimeout(checkDuplicates, 400);
    return () => clearTimeout(timer);
  }, [serialInputText, isSerialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!supplierName) {
      setFeedback({ type: 'error', message: 'Please specify the vendor/supplier name' });
      return;
    }

    if (isSerialized && serialList.length === 0) {
      setFeedback({ type: 'error', message: 'Please enter at least one unique serial number' });
      return;
    }

    if (duplicateWarnings.length > 0) {
      setFeedback({ type: 'error', message: 'Cannot register stock with duplicate serial numbers in database!' });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        categoryId,
        departmentId,
        financialYearId,
        supplierName,
        unitCost: Number(unitCost) || 0,
        isSerialized,
        quantity: isSerialized ? serialList.length : Number(quantity) || 1,
        serials: isSerialized ? serialList : [],
        remarks,
        receivedByUserId: currentUser.id
      };

      await onStockInSuccess(payload);

      setFeedback({
        type: 'success',
        message: `Successfully registered stock batch from ${supplierName}!`
      });

      // Reset form
      setSupplierName('');
      setSerialInputText('');
      setRemarks('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to process stock in' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Title Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <PackagePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Incoming Stock Batch Wizard</h1>
            <p className="text-xs text-slate-400">
              Register incoming serialized or non-serialized inventory linked to Financial Year & Department
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>Financial Year Tagged</span>
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

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
        
        {/* Step 1: Financial & Department Tagging */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            1. Classification & Financial Year Links
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Financial Year</label>
              <select
                value={financialYearId}
                onChange={(e) => setFinancialYearId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {financialYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.yearCode} {fy.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Department Owner
                {currentUser.role !== 'ADMIN' && (
                  <span className="ml-1 text-[10px] text-amber-400 font-semibold">(Registered Dept)</span>
                )}
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={currentUser.role !== 'ADMIN'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Item Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Step 2: Vendor & Costing */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            2. Vendor Delivery & Valuation
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Supplier / Vendor Name *</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Dell Enterprise, Cisco Systems, Staples..."
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Unit Cost ({currencySymbol} {currencyCode})</label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(parseFloat(e.target.value) || '')}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

          </div>
        </div>

        {/* Step 3: Serialized vs Non-Serialized Choice */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            3. Stock Tracking Mode (Serialized vs Non-Serialized)
          </div>

          <div className="flex items-center space-x-4 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="serializedChoice"
                checked={isSerialized}
                onChange={() => setIsSerialized(true)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-200 flex items-center">
                <QrCode className="w-3.5 h-3.5 text-indigo-400 mr-1" />
                Serialized Items
              </span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="serializedChoice"
                checked={!isSerialized}
                onChange={() => setIsSerialized(false)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-200 flex items-center">
                <Layers className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                Non-Serialized (Bulk Quantity)
              </span>
            </label>
          </div>

          {/* Conditional Input based on mode */}
          {isSerialized ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  Enter Serial Numbers (One per line or comma-separated)
                </label>
                <span className="text-xs text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
                  {serialList.length} Serial(s) Recognized
                </span>
              </div>

              <textarea
                value={serialInputText}
                onChange={(e) => setSerialInputText(e.target.value)}
                rows={4}
                placeholder="SN-DELL-2025-001&#10;SN-DELL-2025-002&#10;SN-DELL-2025-003"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />

              {/* Real-time Duplication Warnings */}
              {duplicateWarnings.length > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-rose-400 flex items-center space-x-1">
                    <AlertOctagon className="w-4 h-4" />
                    <span>Real-Time Database Duplication Warning:</span>
                  </div>
                  <ul className="text-[11px] text-rose-300 list-disc list-inside space-y-0.5">
                    {duplicateWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Batch Total Quantity</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || '')}
                placeholder="e.g. 50"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Step 4: Remarks */}
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1">Batch Remarks / PO Details</label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Purchase Order #PO-9912, Warranty until 2028"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || duplicateWarnings.length > 0}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>{isSubmitting ? 'Registering Batch...' : 'Register Stock In Batch'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
