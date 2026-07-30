import React, { useState } from 'react';
import {
  Boxes,
  Search,
  Filter,
  Download,
  QrCode,
  ShieldAlert,
  Wrench,
  XCircle,
  CheckCircle,
  Building2,
  Calendar,
  Layers,
  Edit3
} from 'lucide-react';
import { InventoryItem, StockBatch, Department, Category, FinancialYear, ItemStatus, User as UserType } from '../types';
import { formatCurrency } from '../utils/format';

interface InventoryViewProps {
  items: InventoryItem[];
  batches: StockBatch[];
  departments: Department[];
  categories: Category[];
  financialYears: FinancialYear[];
  activeFyId: string;
  currentUser: UserType;
  currencySymbol?: string;
  onUpdateItemStatus: (itemId: string, status: ItemStatus, notes: string) => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  batches,
  departments,
  categories,
  financialYears,
  activeFyId,
  currentUser,
  currencySymbol = 'E',
  onUpdateItemStatus
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
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Item Status Modal state
  const [activeModalItem, setActiveModalItem] = useState<InventoryItem | null>(null);
  const [newStatus, setNewStatus] = useState<ItemStatus>('UNDER_MAINTENANCE');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter Items
  const filteredItems = items.filter((item) => {
    const isUserAdmin = currentUser.role === 'ADMIN';
    const matchesUserDept = isUserAdmin || !currentUser.departmentId || item.departmentId === currentUser.departmentId;

    const matchesSearch =
      !searchTerm ||
      item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.batchNumber && item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFy = !selectedFyId || item.financialYearId === selectedFyId;
    const matchesDept = !selectedDeptId || item.departmentId === selectedDeptId;
    const matchesCat = !selectedCatId || item.categoryId === selectedCatId;
    const matchesStatus = !selectedStatus || item.status === selectedStatus;

    return matchesUserDept && matchesSearch && matchesFy && matchesDept && matchesCat && matchesStatus;
  });

  const handleOpenModal = (item: InventoryItem) => {
    setActiveModalItem(item);
    setNewStatus(item.status === 'UNDER_MAINTENANCE' ? 'IN_STOCK' : 'UNDER_MAINTENANCE');
    setStatusNotes('');
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalItem) return;

    try {
      setIsUpdating(true);
      await onUpdateItemStatus(activeModalItem.id, newStatus, statusNotes);
      setActiveModalItem(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const exportCsv = () => {
    const headers = ['Item Code', 'Serial Number', 'Batch Ref', 'Category', 'Department', 'Financial Year', 'Status', 'Unit Cost', 'Notes'];
    const rows = filteredItems.map(i => [
      i.itemCode,
      i.serialNumber || 'N/A',
      i.batchNumber || 'N/A',
      i.categoryName || 'N/A',
      i.departmentName || 'N/A',
      i.financialYearCode || 'N/A',
      i.status,
      i.unitCost,
      `"${(i.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `StockVault_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Inventory Items & Serial Lifecycle</h1>
            <p className="text-xs text-slate-400">
              Track individual item status (*In Stock*, *Issued*, *Under Maintenance*, *Decommissioned*) across Financial Years
            </p>
          </div>
        </div>

        <button
          onClick={exportCsv}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer w-fit"
        >
          <Download className="w-4 h-4 text-blue-400" />
          <span>Export Inventory CSV</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          
          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search serial number, item code, batch..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* FY Filter */}
          <div>
            <select
              value={selectedFyId}
              onChange={(e) => setSelectedFyId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Financial Years</option>
              {financialYears.map(fy => (
                <option key={fy.id} value={fy.id}>{fy.yearCode}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              disabled={currentUser.role !== 'ADMIN'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {currentUser.role === 'ADMIN' && <option value="">All Departments</option>}
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="IN_STOCK">IN STOCK</option>
              <option value="ISSUED">ISSUED</option>
              <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
              <option value="DECOMMISSIONED">DECOMMISSIONED</option>
            </select>
          </div>

        </div>
      </div>

      {/* Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Item Ref / Serial No</th>
                <th className="px-4 py-3">Category & Batch</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Financial Year</th>
                <th className="px-4 py-3">Lifecycle Status</th>
                <th className="px-4 py-3">Unit Cost</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                  
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-slate-200">{item.itemCode}</div>
                    {item.serialNumber ? (
                      <div className="text-[11px] font-mono text-indigo-400 flex items-center space-x-1 mt-0.5">
                        <QrCode className="w-3 h-3" />
                        <span>SN: {item.serialNumber}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500">Non-Serialized Bulk Item</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-200">{item.categoryName || 'General'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.batchNumber}</div>
                  </td>

                  <td className="px-4 py-3 font-medium text-slate-300">
                    {item.departmentName}
                  </td>

                  <td className="px-4 py-3 font-mono text-amber-300">
                    {item.financialYearCode}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center space-x-1 w-fit border ${
                      item.status === 'IN_STOCK'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : item.status === 'ISSUED'
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : item.status === 'UNDER_MAINTENANCE'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}>
                      {item.status === 'IN_STOCK' && <CheckCircle className="w-3 h-3" />}
                      {item.status === 'UNDER_MAINTENANCE' && <Wrench className="w-3 h-3" />}
                      {item.status === 'DECOMMISSIONED' && <XCircle className="w-3 h-3" />}
                      <span>{item.status.replace('_', ' ')}</span>
                    </span>
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-100 font-mono">
                    {formatCurrency(item.unitCost, currencySymbol)}
                  </td>

                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Update Status</span>
                    </button>
                  </td>

                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                    No inventory items match your selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lifecycle Status Change Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-blue-400" />
                <span>Transition Item Lifecycle Status</span>
              </h3>
              <button onClick={() => setActiveModalItem(null)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1 bg-slate-800/60 p-3 rounded-xl border border-slate-700">
              <div><span className="text-slate-400">Item Code:</span> <span className="font-mono text-white font-semibold">{activeModalItem.itemCode}</span></div>
              {activeModalItem.serialNumber && (
                <div><span className="text-slate-400">Serial No:</span> <span className="font-mono text-indigo-400">{activeModalItem.serialNumber}</span></div>
              )}
              <div><span className="text-slate-400">Current Status:</span> <span className="font-semibold text-amber-400">{activeModalItem.status}</span></div>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">New Target Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ItemStatus)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="IN_STOCK">IN STOCK (Return to Active Pool)</option>
                  <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE (Repair Bench)</option>
                  <option value="DECOMMISSIONED">DECOMMISSIONED / SCRAPPED (Write-off)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Audit Justification Notes *</label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Explain why this status change is occurring (e.g. Broken motherboard, scheduled repair)..."
                  required
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/30"
                >
                  {isUpdating ? 'Saving...' : 'Confirm Status Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
