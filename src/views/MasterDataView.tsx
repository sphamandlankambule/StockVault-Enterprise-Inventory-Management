import React, { useState, useEffect } from 'react';
import {
  Settings2,
  Calendar,
  Building2,
  Boxes,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Coins,
  Globe,
  Save,
  ShieldCheck,
  Edit2,
  Trash2,
  CalendarPlus,
  X,
  Check,
  Database,
  Download,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { FinancialYear, Department, Category, SystemSettings, User as UserType } from '../types';

interface MasterDataViewProps {
  financialYears: FinancialYear[];
  departments: Department[];
  categories: Category[];
  settings: SystemSettings;
  currentUser: UserType;
  onActivateFy: (fyId: string) => Promise<void>;
  onCreateFinancialYear?: (fyData: any) => Promise<void>;
  onUpdateFinancialYear?: (fyId: string, fyData: any) => Promise<void>;
  onDeleteFinancialYear?: (fyId: string) => Promise<void>;
  onCreateDepartment: (deptData: any) => Promise<void>;
  onUpdateDepartment?: (deptId: string, deptData: any) => Promise<void>;
  onDeleteDepartment?: (deptId: string) => Promise<void>;
  onCreateCategory: (catData: any) => Promise<void>;
  onUpdateCategory?: (catId: string, catData: any) => Promise<void>;
  onDeleteCategory?: (catId: string) => Promise<void>;
  onUpdateSettings: (settings: Partial<SystemSettings>) => Promise<void>;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  financialYears,
  departments,
  categories,
  settings,
  currentUser,
  onActivateFy,
  onCreateFinancialYear,
  onUpdateFinancialYear,
  onDeleteFinancialYear,
  onCreateDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onUpdateSettings
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  // Financial Year Form State
  const [fyYearCode, setFyYearCode] = useState('');
  const [fyStartDate, setFyStartDate] = useState('');
  const [fyEndDate, setFyEndDate] = useState('');
  const [fySetAsActive, setFySetAsActive] = useState(false);
  const [isCreatingFy, setIsCreatingFy] = useState(false);

  // Edit FY State
  const [editingFyId, setEditingFyId] = useState<string | null>(null);
  const [editYearCode, setEditYearCode] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [isUpdatingFy, setIsUpdatingFy] = useState(false);

  // Department Form State
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptBudget, setDeptBudget] = useState('');

  // Edit Department State
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editDeptCode, setEditDeptCode] = useState('');
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptBudget, setEditDeptBudget] = useState('');
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);

  // Category Form State
  const [catCode, setCatCode] = useState('');
  const [catName, setCatName] = useState('');
  const [catThreshold, setCatThreshold] = useState<number>(5);

  // Edit Category State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatCode, setEditCatCode] = useState('');
  const [editCatName, setEditCatName] = useState('');
  const [editCatThreshold, setEditCatThreshold] = useState<number>(5);
  const [isUpdatingCat, setIsUpdatingCat] = useState(false);

  // System & Currency Settings State
  const [companyName, setCompanyName] = useState(settings?.companyName || 'StockVault Enterprise Global');
  const [currencyCode, setCurrencyCode] = useState(settings?.currencyCode || 'SZL');
  const [currencySymbol, setCurrencySymbol] = useState(settings?.currencySymbol || 'E');
  const [currencyName, setCurrencyName] = useState(settings?.currencyName || 'Eswatini Lilangeni');
  const [lowStockGlobalThreshold, setLowStockGlobalThreshold] = useState(settings?.lowStockGlobalThreshold || 5);
  const [requireDualSignatures, setRequireDualSignatures] = useState(settings?.requireDualSignatures ?? true);

  // Database Persistence Status State
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isLoadingDbStatus, setIsLoadingDbStatus] = useState(false);

  const fetchDbStatus = async () => {
    setIsLoadingDbStatus(true);
    try {
      const res = await fetch('/api/db/status');
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: 'Database status endpoint returned HTML / non-JSON output' };
      }
      setDbStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch DB status:', err);
      setDbStatus({ success: false, error: err?.message || 'Network error' });
    } finally {
      setIsLoadingDbStatus(false);
    }
  };

  useEffect(() => {
    fetchDbStatus();
  }, [financialYears.length, departments.length, categories.length]);

  useEffect(() => {
    if (settings) {
      if (settings.companyName) setCompanyName(settings.companyName);
      if (settings.currencyCode) setCurrencyCode(settings.currencyCode);
      if (settings.currencySymbol) setCurrencySymbol(settings.currencySymbol);
      if (settings.currencyName) setCurrencyName(settings.currencyName);
      if (settings.lowStockGlobalThreshold !== undefined) setLowStockGlobalThreshold(settings.lowStockGlobalThreshold);
      if (settings.requireDualSignatures !== undefined) setRequireDualSignatures(settings.requireDualSignatures);
    }
  }, [settings]);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleCreateFy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fyYearCode || !fyStartDate || !fyEndDate) {
      setErrorMsg('Year code, start date, and end date are required.');
      return;
    }
    setIsCreatingFy(true);
    setErrorMsg(null);
    try {
      if (onCreateFinancialYear) {
        await onCreateFinancialYear({
          yearCode: fyYearCode,
          startDate: fyStartDate,
          endDate: fyEndDate,
          setAsActive: fySetAsActive
        });
        setFyYearCode('');
        setFyStartDate('');
        setFyEndDate('');
        setFySetAsActive(false);
        setFeedback(`Financial Year ${fyYearCode} configured and added successfully!`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to create financial year');
    } finally {
      setIsCreatingFy(false);
    }
  };

  const handleStartEditFy = (fy: FinancialYear) => {
    setEditingFyId(fy.id);
    setEditYearCode(fy.yearCode);
    setEditStartDate(fy.startDate);
    setEditEndDate(fy.endDate);
  };

  const handleCancelEditFy = () => {
    setEditingFyId(null);
    setEditYearCode('');
    setEditStartDate('');
    setEditEndDate('');
  };

  const handleSaveEditFy = async (fyId: string) => {
    if (!editYearCode || !editStartDate || !editEndDate) return;
    setIsUpdatingFy(true);
    setErrorMsg(null);
    try {
      if (onUpdateFinancialYear) {
        await onUpdateFinancialYear(fyId, {
          yearCode: editYearCode,
          startDate: editStartDate,
          endDate: editEndDate
        });
        setEditingFyId(null);
        setFeedback(`Financial Year details updated successfully!`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to update financial year');
    } finally {
      setIsUpdatingFy(false);
    }
  };

  const handleDeleteFy = async (fy: FinancialYear) => {
    if (fy.isActive) {
      setErrorMsg('Cannot delete the currently active Financial Year. Activate another FY first.');
      return;
    }
    if (!confirm(`Are you sure you want to delete Financial Year FY ${fy.yearCode}?`)) return;

    setErrorMsg(null);
    try {
      if (onDeleteFinancialYear) {
        await onDeleteFinancialYear(fy.id);
        setFeedback(`Financial Year FY ${fy.yearCode} deleted successfully.`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to delete financial year');
    }
  };

  const CURRENCY_PRESETS = [
    { code: 'SZL', symbol: 'E', name: 'Eswatini Lilangeni (E)' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand (R)' },
    { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
    { code: 'EUR', symbol: '€', name: 'Euro (€)' },
    { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' }
  ];

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'CUSTOM') return;
    const found = CURRENCY_PRESETS.find(p => p.code === val);
    if (found) {
      setCurrencyCode(found.code);
      setCurrencySymbol(found.symbol);
      setCurrencyName(found.name.split(' (')[0]);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        companyName,
        currencyCode,
        currencySymbol,
        currencyName,
        lowStockGlobalThreshold: Number(lowStockGlobalThreshold),
        requireDualSignatures
      });
      setFeedback('System settings and default currency updated successfully!');
    } catch (err) {
      console.error(err);
      setFeedback('Failed to update system settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode || !deptName) return;
    setErrorMsg(null);
    try {
      await onCreateDepartment({ code: deptCode, name: deptName, budgetCode: deptBudget });
      setDeptCode('');
      setDeptName('');
      setDeptBudget('');
      setFeedback('Department added successfully!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to create department');
    }
  };

  const handleStartEditDept = (dept: Department) => {
    setEditingDeptId(dept.id);
    setEditDeptCode(dept.code);
    setEditDeptName(dept.name);
    setEditDeptBudget(dept.budgetCode || '');
  };

  const handleCancelEditDept = () => {
    setEditingDeptId(null);
    setEditDeptCode('');
    setEditDeptName('');
    setEditDeptBudget('');
  };

  const handleSaveEditDept = async (deptId: string) => {
    if (!editDeptCode || !editDeptName) return;
    setIsUpdatingDept(true);
    setErrorMsg(null);
    try {
      if (onUpdateDepartment) {
        await onUpdateDepartment(deptId, {
          code: editDeptCode,
          name: editDeptName,
          budgetCode: editDeptBudget
        });
        setEditingDeptId(null);
        setFeedback('Department details updated successfully!');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to update department');
    } finally {
      setIsUpdatingDept(false);
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    if (!confirm(`Are you sure you want to delete Department '${dept.name}' (${dept.code})?`)) return;
    setErrorMsg(null);
    try {
      if (onDeleteDepartment) {
        await onDeleteDepartment(dept.id);
        setFeedback(`Department '${dept.name}' deleted successfully.`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to delete department');
    }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCode || !catName) return;
    setErrorMsg(null);
    try {
      await onCreateCategory({ code: catCode, name: catName, lowStockThreshold: catThreshold });
      setCatCode('');
      setCatName('');
      setCatThreshold(5);
      setFeedback('Category created successfully!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to create category');
    }
  };

  const handleStartEditCat = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatCode(cat.code);
    setEditCatName(cat.name);
    setEditCatThreshold(cat.lowStockThreshold || 5);
  };

  const handleCancelEditCat = () => {
    setEditingCatId(null);
    setEditCatCode('');
    setEditCatName('');
    setEditCatThreshold(5);
  };

  const handleSaveEditCat = async (catId: string) => {
    if (!editCatCode || !editCatName) return;
    setIsUpdatingCat(true);
    setErrorMsg(null);
    try {
      if (onUpdateCategory) {
        await onUpdateCategory(catId, {
          code: editCatCode,
          name: editCatName,
          lowStockThreshold: editCatThreshold
        });
        setEditingCatId(null);
        setFeedback('Category details updated successfully!');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to update category');
    } finally {
      setIsUpdatingCat(false);
    }
  };

  const handleDeleteCat = async (cat: Category) => {
    if (!confirm(`Are you sure you want to delete Category '${cat.name}' (${cat.code})?`)) return;
    setErrorMsg(null);
    try {
      if (onDeleteCategory) {
        await onDeleteCategory(cat.id);
        setFeedback(`Category '${cat.name}' deleted successfully.`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-400">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Master System Fields & Financial Years</h1>
            <p className="text-xs text-slate-400">
              Manage active Financial Years, Department organizational units, Categories, and Low-Stock thresholds
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid Section 1: Financial Years Configuration & Add Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-white font-bold text-sm">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Financial Year & Range Configuration</span>
          </div>
          <span className="text-xs text-amber-400/90 font-medium bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
            Admin Management
          </span>
        </div>

        {/* Add New Financial Year Form */}
        <form onSubmit={handleCreateFy} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
            <CalendarPlus className="w-4 h-4 text-amber-400" />
            <span>Add New Financial Year</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                FY Code / Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 2026-2027"
                value={fyYearCode}
                onChange={(e) => setFyYearCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Start Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                value={fyStartDate}
                onChange={(e) => setFyStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                End Date <span className="text-amber-400">*</span>
              </label>
              <input
                type="date"
                value={fyEndDate}
                onChange={(e) => setFyEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="flex items-end justify-between space-x-2">
              <label className="flex items-center space-x-2 text-slate-300 text-xs pb-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={fySetAsActive}
                  onChange={(e) => setFySetAsActive(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
                />
                <span className="font-medium text-slate-200">Set as Active FY</span>
              </label>

              <button
                type="submit"
                disabled={isCreatingFy}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-amber-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>{isCreatingFy ? 'Adding...' : 'Add FY'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Existing Financial Years Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {financialYears.map((fy) => {
            const isEditingThis = editingFyId === fy.id;

            return (
              <div
                key={fy.id}
                className={`p-4 rounded-xl border space-y-3 transition-all ${
                  fy.isActive
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                }`}
              >
                {isEditingThis ? (
                  /* Edit Mode Form */
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-700 pb-1.5">
                      <span>Edit FY Configuration</span>
                      <button onClick={handleCancelEditFy} className="text-slate-400 hover:text-white cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-300 block mb-0.5">Year Code</label>
                      <input
                        type="text"
                        value={editYearCode}
                        onChange={(e) => setEditYearCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Start Date</label>
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">End Date</label>
                        <input
                          type="date"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        onClick={handleCancelEditFy}
                        className="px-2.5 py-1 bg-slate-700 text-slate-200 rounded text-xs hover:bg-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEditFy(fy.id)}
                        disabled={isUpdatingFy}
                        className="px-3 py-1 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-500 cursor-pointer flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode Card */
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-white font-mono">FY {fy.yearCode}</span>
                        {fy.isActive && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                            ACTIVE FY
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleStartEditFy(fy)}
                          title="Edit FY & Date Range"
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-700/50 rounded transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!fy.isActive && (
                          <button
                            onClick={() => handleDeleteFy(fy)}
                            title="Delete Financial Year"
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800/80 font-mono space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Start Date:</span>
                        <span className="text-slate-200">{fy.startDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">End Date:</span>
                        <span className="text-slate-200">{fy.endDate}</span>
                      </div>
                    </div>

                    {!fy.isActive && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => onActivateFy(fy.id)}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-md transition-all cursor-pointer"
                        >
                          Set as Active FY
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Section 2: Departments & Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Departments Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-white font-bold text-sm border-b border-slate-800 pb-3">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span>Departments ({departments.length})</span>
          </div>

          <form onSubmit={handleCreateDept} className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Dept Code (e.g. MKT)"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
              <input
                type="text"
                placeholder="Dept Name (e.g. Marketing)"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Add Department
            </button>
          </form>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {departments.map((d) => (
              editingDeptId === d.id ? (
                <div key={d.id} className="p-2.5 bg-slate-800 rounded-lg space-y-2 text-xs border border-blue-500/50">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Code</label>
                      <input
                        type="text"
                        value={editDeptCode}
                        onChange={(e) => setEditDeptCode(e.target.value)}
                        placeholder="Code"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Name</label>
                      <input
                        type="text"
                        value={editDeptName}
                        onChange={(e) => setEditDeptName(e.target.value)}
                        placeholder="Name"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Budget Code</label>
                      <input
                        type="text"
                        value={editDeptBudget}
                        onChange={(e) => setEditDeptBudget(e.target.value)}
                        placeholder="Budget Code"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelEditDept}
                      className="px-2.5 py-1 bg-slate-700 text-slate-200 rounded hover:bg-slate-600 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingDept}
                      onClick={() => handleSaveEditDept(d.id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div key={d.id} className="p-2.5 bg-slate-800/80 rounded-lg text-xs flex justify-between items-center group hover:bg-slate-800 transition-colors">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-200">{d.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({d.code})</span>
                    {d.budgetCode && (
                      <span className="text-[10px] text-slate-500 font-mono">[{d.budgetCode}]</span>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleStartEditDept(d)}
                        title="Edit Department"
                        className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(d)}
                        title="Delete Department"
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>

        {/* Categories Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-white font-bold text-sm border-b border-slate-800 pb-3">
            <Boxes className="w-4 h-4 text-indigo-400" />
            <span>Categories & Low-Stock Thresholds</span>
          </div>

          <form onSubmit={handleCreateCat} className="space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Code"
                value={catCode}
                onChange={(e) => setCatCode(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
              <input
                type="text"
                placeholder="Category Name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
              <input
                type="number"
                placeholder="Threshold"
                value={catThreshold}
                onChange={(e) => setCatThreshold(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Create Category
            </button>
          </form>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {categories.map((c) => (
              editingCatId === c.id ? (
                <div key={c.id} className="p-2.5 bg-slate-800 rounded-lg space-y-2 text-xs border border-indigo-500/50">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Code</label>
                      <input
                        type="text"
                        value={editCatCode}
                        onChange={(e) => setEditCatCode(e.target.value)}
                        placeholder="Code"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Name</label>
                      <input
                        type="text"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        placeholder="Name"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Threshold</label>
                      <input
                        type="number"
                        value={editCatThreshold}
                        onChange={(e) => setEditCatThreshold(Number(e.target.value))}
                        placeholder="Threshold"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelEditCat}
                      className="px-2.5 py-1 bg-slate-700 text-slate-200 rounded hover:bg-slate-600 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingCat}
                      onClick={() => handleSaveEditCat(c.id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="p-2.5 bg-slate-800/80 rounded-lg text-xs flex justify-between items-center group hover:bg-slate-800 transition-colors">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-200">{c.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({c.code})</span>
                    <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Alert &lt;= {c.lowStockThreshold} units
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleStartEditCat(c)}
                        title="Edit Category"
                        className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCat(c)}
                        title="Delete Category"
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>

      </div>

      {/* Grid Section 3: System & Default Currency Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-white font-bold text-sm">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Organization & Default Currency Settings</span>
          </div>
          <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 font-semibold">
            System Admin Configuration
          </span>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Organization Name */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Organization / Enterprise Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* Currency Preset Selector */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Select Currency Preset</label>
              <select
                value={currencyCode}
                onChange={handleSelectPreset}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                {CURRENCY_PRESETS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
                <option value="CUSTOM">Custom Currency...</option>
              </select>
            </div>

            {/* Currency Symbol */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Currency Symbol <span className="text-amber-400 font-normal">(e.g. E)</span>
              </label>
              <input
                type="text"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="e.g. E"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* Currency Code */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                ISO Code <span className="text-amber-400 font-normal">(e.g. SZL)</span>
              </label>
              <input
                type="text"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                placeholder="e.g. SZL"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                required
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            
            {/* Global Low Stock Threshold */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Global Low Stock Alert Threshold</label>
              <input
                type="number"
                value={lowStockGlobalThreshold}
                onChange={(e) => setLowStockGlobalThreshold(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Require Dual Signatures Checkbox */}
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700">
              <div>
                <span className="font-bold text-slate-200 block">Enforce Dual Signature Dispatches</span>
                <span className="text-[10px] text-slate-400">Require digital signatures from store keeper and receiver officer</span>
              </div>
              <input
                type="checkbox"
                checked={requireDualSignatures}
                onChange={(e) => setRequireDualSignatures(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 cursor-pointer"
              />
            </div>

          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSettings ? 'Saving Settings...' : 'Save Currency & System Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Grid Section 4: Live Database Connection & Persistence Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-white font-bold text-sm">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Database Storage & Persistent Writer Status</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 font-semibold flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Active Database Persistence</span>
            </span>
            <button
              onClick={fetchDbStatus}
              disabled={isLoadingDbStatus}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
              title="Refresh DB Status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDbStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Database Storage Path</span>
            <span className="text-xs text-emerald-300 font-mono font-bold block truncate" title={dbStatus?.dbFilePath || 'db_store.json'}>
              {dbStatus?.dbFilePath || 'db_store.json'}
            </span>
            <span className="text-[10px] text-slate-400 block">Automatic File Commit Engine</span>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Write Status</span>
            <span className="text-xs text-emerald-400 font-bold block flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Realtime Writes Active</span>
            </span>
            <span className="text-[10px] text-slate-400 block">All mutations committed to disk</span>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Total Database Records</span>
            <span className="text-xs text-white font-mono font-bold block">
              {dbStatus?.counts ? (
                Object.values(dbStatus.counts as Record<string, number>).reduce((a, b) => a + b, 0)
              ) : 'Loaded'} Records
            </span>
            <span className="text-[10px] text-slate-400 block">Users, Stock, Depts, FYs & Logs</span>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Database Backup & Export</span>
            <a
              href="/api/db/export"
              download="stockvault_database.json"
              className="mt-0.5 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Database JSON</span>
            </a>
          </div>
        </div>

        {dbStatus?.counts && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Users</span>
              <span className="text-white font-bold">{dbStatus.counts.users}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Departments</span>
              <span className="text-white font-bold">{dbStatus.counts.departments}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Categories</span>
              <span className="text-white font-bold">{dbStatus.counts.categories}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Fin Years</span>
              <span className="text-white font-bold">{dbStatus.counts.financialYears}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Batches</span>
              <span className="text-white font-bold">{dbStatus.counts.stockBatches}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Serial Items</span>
              <span className="text-white font-bold">{dbStatus.counts.inventoryItems}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Dispatches</span>
              <span className="text-white font-bold">{dbStatus.counts.stockTransactions}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 text-center">
              <span className="text-slate-400 block text-[9px]">Audit Logs</span>
              <span className="text-white font-bold">{dbStatus.counts.auditLogs}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
