import React, { useState } from 'react';
import {
  PackageMinus,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Building2,
  UserCheck,
  FileText
} from 'lucide-react';
import { StockBatch, InventoryItem, Department, User as UserType } from '../types';
import { SignatureCanvas } from '../components/SignatureCanvas';

interface StockOutViewProps {
  batches: StockBatch[];
  inventoryItems: InventoryItem[];
  departments: Department[];
  currentUser: UserType;
  onDispatchStock: (dispatchPayload: any) => Promise<void>;
}

export const StockOutView: React.FC<StockOutViewProps> = ({
  batches,
  inventoryItems,
  departments,
  currentUser,
  onDispatchStock
}) => {
  const activeBatches = batches.filter(b => {
    if (b.availableQuantity <= 0) return false;
    if (currentUser.role !== 'ADMIN' && currentUser.departmentId) {
      return String(b.departmentId) === String(currentUser.departmentId);
    }
    return true;
  });

  const [selectedBatchId, setSelectedBatchId] = useState<string | number>(activeBatches[0]?.id || '');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [receiverName, setReceiverName] = useState('Sarah Jenkins');
  const [receiverDepartmentId, setReceiverDepartmentId] = useState(departments[0]?.id || '');
  const [remarks, setRemarks] = useState('Department Hardware Issuance');

  // Signatures State
  const [issuerSignatureBase64, setIssuerSignatureBase64] = useState('');
  const [issuerName, setIssuerName] = useState(currentUser.fullName);
  const [receiverSignatureBase64, setReceiverSignatureBase64] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync selectedBatchId when batches load or change
  React.useEffect(() => {
    if (activeBatches.length > 0) {
      const exists = activeBatches.some(b => String(b.id) === String(selectedBatchId));
      if (!exists || !selectedBatchId) {
        setSelectedBatchId(activeBatches[0].id);
      }
    }
  }, [batches, currentUser]);

  const selectedBatch = batches.find(b => String(b.id) === String(selectedBatchId));
  const availableItemsForBatch = inventoryItems.filter(i => String(i.batchId) === String(selectedBatchId) && i.status === 'IN_STOCK');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!selectedBatch) {
      setFeedback({ type: 'error', message: 'Please select a stock batch' });
      return;
    }

    if (!receiverName) {
      setFeedback({ type: 'error', message: 'Please enter the receiver full name' });
      return;
    }

    // Check dual signatures
    if (!issuerSignatureBase64 || !receiverSignatureBase64) {
      setFeedback({
        type: 'error',
        message: 'Dual signatures required! Both Store Keeper and Receiver must sign digital authorization pads.'
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        batchId: selectedBatch.id,
        financialYearId: selectedBatch.financialYearId,
        departmentId: selectedBatch.departmentId,
        itemId: selectedBatch.isSerialized ? selectedItemId || availableItemsForBatch[0]?.id : undefined,
        quantity: selectedBatch.isSerialized ? 1 : Number(quantity) || 1,
        receiverName,
        receiverDepartmentId,
        remarks,
        issuerUserId: currentUser.id,
        signatures: {
          issuerSignatureBase64,
          issuerBase64: issuerSignatureBase64,
          issuerName,
          receiverSignatureBase64,
          receiverBase64: receiverSignatureBase64,
          receiverName
        }
      };

      await onDispatchStock(payload);

      setFeedback({
        type: 'success',
        message: `Stock out dispatched successfully with dual-signature audit record!`
      });

      // Reset signature pads
      setIssuerSignatureBase64('');
      setReceiverSignatureBase64('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Dispatch failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Title Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
            <PackageMinus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Stock Out & Dual Signature Dispatch</h1>
            <p className="text-xs text-slate-400">
              Authorized inventory issuance with non-repudiation digital signature audit capture
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1.5 rounded-lg font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Non-Repudiation Audit Enforced</span>
        </div>
      </div>

      {/* Feedback Alert */}
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
        
        {/* Step 1: Select Stock Batch & Item */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            1. Inventory Item Selection
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Select Stock Batch *</label>
              <select
                value={selectedBatchId}
                onChange={(e) => {
                  setSelectedBatchId(e.target.value);
                  setSelectedItemId('');
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {activeBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber} - {b.categoryName} ({b.availableQuantity} available)
                  </option>
                ))}
              </select>
            </div>

            {selectedBatch && selectedBatch.isSerialized ? (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Select Specific Serialized Item</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Auto-select First Available Item</option>
                  {availableItemsForBatch.map((item) => (
                    <option key={item.id} value={item.id}>
                      Serial No: {item.serialNumber} ({item.itemCode})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Quantity to Issue</label>
                <input
                  type="number"
                  min="1"
                  max={selectedBatch?.availableQuantity || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || '')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

          </div>
        </div>

        {/* Step 2: Receiver & Department Details */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
            2. Recipient Authorization Details
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Person Receiving Stock (Full Name) *</label>
              <input
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">Receiving Department *</label>
              <select
                value={receiverDepartmentId}
                onChange={(e) => setReceiverDepartmentId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Dispatch Remarks / Purpose</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Hardware replacement for finance department senior auditor"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Step 3: Dual Signature Authorization Pads */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>3. Dual Signature Non-Repudiation Authorization</span>
            </div>
            <span className="text-[10px] text-slate-500">IP & Device Timestamp Logged</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Signature 1: Store Keeper / Issuer */}
            <SignatureCanvas
              label="Signature 1: Person Giving Stock (Store Keeper / Issuer)"
              roleTitle="STORE KEEPER / ISSUER"
              signerName={issuerName}
              onSignerNameChange={setIssuerName}
              onSignatureCapture={setIssuerSignatureBase64}
              initialSignature={issuerSignatureBase64}
            />

            {/* Signature 2: Receiver */}
            <SignatureCanvas
              label="Signature 2: Person Receiving Stock (Recipient / Staff)"
              roleTitle="STAFF / RECEIVER"
              signerName={receiverName}
              onSignerNameChange={setReceiverName}
              onSignatureCapture={setReceiverSignatureBase64}
              initialSignature={receiverSignatureBase64}
            />

          </div>
        </div>

        {/* Submit Dispatch Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !issuerSignatureBase64 || !receiverSignatureBase64}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <PackageMinus className="w-4 h-4" />
            <span>{isSubmitting ? 'Verifying & Dispatched...' : 'Authorize & Dispatch Stock Out'}</span>
          </button>
        </div>

      </form>
    </div>
  );
};
