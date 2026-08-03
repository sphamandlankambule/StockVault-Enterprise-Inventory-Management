/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DashboardView } from './views/DashboardView';
import { StockInView } from './views/StockInView';
import { StockOutView } from './views/StockOutView';
import { InventoryView } from './views/InventoryView';
import { LowStockView } from './views/LowStockView';
import { ReportsView } from './views/ReportsView';
import { UserManagementView } from './views/UserManagementView';
import { MasterDataView } from './views/MasterDataView';
import { AuditLogsView } from './views/AuditLogsView';

import {
  User,
  Department,
  Category,
  FinancialYear,
  StockBatch,
  InventoryItem,
  StockTransaction,
  AuditLog,
  SystemSettings,
  DashboardMetrics,
  ItemStatus
} from './types';

export default function App() {
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Users & Auth State
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);

  // Master Data State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [activeFyId, setActiveFyId] = useState<string>('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Operational State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const getAuthHeaders = (user = currentUser) => ({
    'x-user-id': user?.id || '',
    'x-user-role': user?.role || 'ADMIN',
    'x-user-department-id': user?.departmentId || ''
  });

  const safeFetchJson = async (url: string, options?: RequestInit): Promise<any> => {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return {
          ok: false,
          success: false,
          error: 'Database Connection Failed: Backend returned HTML or non-JSON response instead of database data. Ensure php_apis/db_connection.php is properly configured.'
        };
      }
      if (typeof data === 'object' && data !== null) {
        return { ok: res.ok, ...data };
      }
      return { ok: res.ok, success: res.ok, data };
    } catch (err: any) {
      return {
        ok: false,
        success: false,
        error: `Database Connection Failed: ${err?.message || 'Network request failed'}`
      };
    }
  };

  // Initial Data Load
  useEffect(() => {
    loadAllData();
  }, []);

  // Re-fetch data when currentUser changes so metrics, batches, and items update for their department scope
  useEffect(() => {
    if (currentUser) {
      refreshMetricsAndData(activeFyId, currentUser);
    }
  }, [currentUser?.id]);

  // Restore Session on Mount
  useEffect(() => {
    const saved = localStorage.getItem('stockvault_active_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && u.id) {
          setCurrentUser(u);
        }
      } catch (e) {
        console.error('Failed to parse saved user session', e);
      }
    }
  }, []);

  const handleLogin = async (usernameInput: string, passwordInput: string) => {
    setIsAuthenticating(true);
    try {
      const data = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      if (!data.ok || !data.success) {
        throw new Error(data.error || 'Invalid username or password');
      }

      const { password: _, ...safeUser } = data.user;
      setCurrentUser(safeUser as User);
      localStorage.setItem('stockvault_active_user', JSON.stringify(safeUser));
      await refreshMetricsAndData(activeFyId, safeUser as User);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stockvault_active_user');
    setCurrentUser(null);
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser) return;
    const data = await safeFetchJson('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(currentUser)
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (!data.ok || !data.success) {
      throw new Error(data.error || 'Failed to change password');
    }

    // Update stored session securely without plain password
    const { password: _, ...safeUser } = currentUser;
    setCurrentUser(safeUser as User);
    localStorage.setItem('stockvault_active_user', JSON.stringify(safeUser));
  };

  const handleResetUserPassword = async (targetUserId: string, newPassword: string) => {
    if (!currentUser || currentUser.role !== 'ADMIN') return;
    const data = await safeFetchJson(`/api/users/${targetUserId}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(currentUser)
      },
      body: JSON.stringify({ newPassword })
    });

    if (!data.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset user password');
    }

    // Refresh users
    const usersRes = await safeFetchJson('/api/users');
    if (usersRes.success) {
      setUsers(usersRes.users);
    }
  };

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      const [
        usersRes,
        deptRes,
        catRes,
        fyRes,
        settRes,
        auditRes
      ] = await Promise.all([
        safeFetchJson('/api/users'),
        safeFetchJson('/api/departments'),
        safeFetchJson('/api/categories'),
        safeFetchJson('/api/financial-years'),
        safeFetchJson('/api/settings'),
        safeFetchJson('/api/audit-logs')
      ]);

      if (!usersRes.success || !deptRes.success || !catRes.success || !fyRes.success) {
        const errorDetail =
          usersRes.error ||
          deptRes.error ||
          catRes.error ||
          fyRes.error ||
          settRes.error ||
          auditRes.error ||
          'Database Connection Failed: Unable to connect to MySQL database via php_apis/db_connection.php';
        setDbError(errorDetail);
        return;
      } else {
        setDbError(null);
      }

      if (usersRes.success) setUsers(usersRes.users);
      if (deptRes.success) setDepartments(deptRes.departments);
      if (catRes.success) setCategories(catRes.categories);
      if (fyRes.success) {
        setFinancialYears(fyRes.financialYears);
        const activeFy = fyRes.financialYears.find((f: FinancialYear) => f.isActive);
        if (activeFy) setActiveFyId(activeFy.id);
      }
      if (settRes.success) setSettings(settRes.settings);
      if (auditRes.success) setAuditLogs(auditRes.logs);

      // Load Department-Scoped Batches, Items, Transactions, and Metrics if authenticated
      const activeFy = fyRes.financialYears?.find((f: FinancialYear) => f.isActive);
      const targetFyId = activeFy ? activeFy.id : '';
      const headers = getAuthHeaders(currentUser);

      const [batchesRes, itemsRes, txRes, metricsRes] = await Promise.all([
        safeFetchJson(`/api/stock/batches?financialYearId=${targetFyId}`, { headers }),
        safeFetchJson(`/api/stock/items?financialYearId=${targetFyId}`, { headers }),
        safeFetchJson('/api/transactions', { headers }),
        safeFetchJson(`/api/dashboard/metrics?financialYearId=${targetFyId}`, { headers })
      ]);

      if (batchesRes.success) setBatches(batchesRes.batches);
      if (itemsRes.success) setInventoryItems(itemsRes.items);
      if (txRes.success) setTransactions(txRes.transactions);
      if (metricsRes.success) setMetrics(metricsRes.metrics);

    } catch (error: any) {
      console.error('Failed to load initial data:', error);
      setDbError(error?.message || "Database Connection Failed: Unable to connect to MySQL database");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMetricsAndData = async (fyId = activeFyId, user = currentUser) => {
    try {
      const headers = getAuthHeaders(user);
      const [mRes, bRes, iRes, tRes, aRes, dRes] = await Promise.all([
        safeFetchJson(`/api/dashboard/metrics?financialYearId=${fyId}`, { headers }),
        safeFetchJson(`/api/stock/batches?financialYearId=${fyId}`, { headers }),
        safeFetchJson(`/api/stock/items?financialYearId=${fyId}`, { headers }),
        safeFetchJson('/api/transactions', { headers }),
        safeFetchJson('/api/audit-logs', { headers }),
        safeFetchJson('/api/departments', { headers })
      ]);

      if (mRes.success) setMetrics(mRes.metrics);
      if (bRes.success) setBatches(bRes.batches);
      if (iRes.success) setInventoryItems(iRes.items);
      if (tRes.success) setTransactions(tRes.transactions);
      if (aRes.success) setAuditLogs(aRes.logs);
      if (dRes.success) setDepartments(dRes.departments);
    } catch (e) {
      console.error(e);
    }
  };

  // Stock In Batch Creation
  const handleStockInSuccess = async (payload: any) => {
    const data = await safeFetchJson('/api/stock/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || 'user-keeper',
        'x-user-role': currentUser?.role || 'STORE_KEEPER'
      },
      body: JSON.stringify(payload)
    });

    if (!data.ok || !data.success) {
      throw new Error(data.error || 'Failed to register stock batch');
    }

    await refreshMetricsAndData();
  };

  // Stock Out Dispatch
  const handleDispatchStock = async (payload: any) => {
    const data = await safeFetchJson('/api/stock/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || 'user-keeper',
        'x-user-role': currentUser?.role || 'STORE_KEEPER'
      },
      body: JSON.stringify(payload)
    });

    if (!data.ok || !data.success) {
      throw new Error(data.error || 'Failed to dispatch stock');
    }

    await refreshMetricsAndData();
  };

  // Update Item Status
  const handleUpdateItemStatus = async (itemId: string, status: ItemStatus, notes: string) => {
    const data = await safeFetchJson(`/api/stock/items/${itemId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || 'user-keeper',
        'x-user-role': currentUser?.role || 'STORE_KEEPER'
      },
      body: JSON.stringify({ status, notes })
    });

    if (!data.ok || !data.success) {
      throw new Error(data.error || 'Failed to update item status');
    }

    await refreshMetricsAndData();
  };

  // Create User (Admin Only)
  const handleCreateUser = async (userData: any) => {
    const data = await safeFetchJson('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || 'user-admin',
        'x-user-role': currentUser?.role || 'ADMIN'
      },
      body: JSON.stringify(userData)
    });

    if (!data.ok || !data.success) {
      throw new Error(data.error || 'Failed to create user');
    }

    const uRes = await safeFetchJson('/api/users');
    if (uRes.success) setUsers(uRes.users);
  };

  // Toggle User Status
  const handleToggleUserStatus = async (userId: string) => {
    const data = await safeFetchJson(`/api/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'x-user-id': currentUser?.id || 'user-admin',
        'x-user-role': currentUser?.role || 'ADMIN'
      }
    });

    if (data.success) {
      const uRes = await safeFetchJson('/api/users');
      if (uRes.success) setUsers(uRes.users);
    }
  };

  // Activate FY
  const handleActivateFy = async (fyId: string) => {
    const data = await safeFetchJson(`/api/financial-years/${fyId}/activate`, { method: 'PUT' });
    if (data.success) {
      setActiveFyId(fyId);
      const fyRes = await safeFetchJson('/api/financial-years');
      if (fyRes.success) setFinancialYears(fyRes.financialYears);
      await refreshMetricsAndData(fyId);
    }
  };

  // Create Financial Year
  const handleCreateFinancialYear = async (fyData: any) => {
    const data = await safeFetchJson('/api/financial-years', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      },
      body: JSON.stringify(fyData)
    });
    if (data.success) {
      const fyRes = await safeFetchJson('/api/financial-years');
      if (fyRes.success) setFinancialYears(fyRes.financialYears);
      if (data.financialYear?.isActive) {
        setActiveFyId(data.financialYear.id);
      }
      await refreshMetricsAndData(activeFyId);
    } else {
      throw new Error(data.error || 'Failed to create financial year');
    }
  };

  // Update Financial Year
  const handleUpdateFinancialYear = async (fyId: string, fyData: any) => {
    const data = await safeFetchJson(`/api/financial-years/${fyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      },
      body: JSON.stringify(fyData)
    });
    if (data.success) {
      const fyRes = await safeFetchJson('/api/financial-years');
      if (fyRes.success) setFinancialYears(fyRes.financialYears);
      if (data.financialYear?.isActive) {
        setActiveFyId(data.financialYear.id);
      }
      await refreshMetricsAndData(activeFyId);
    } else {
      throw new Error(data.error || 'Failed to update financial year');
    }
  };

  // Delete Financial Year
  const handleDeleteFinancialYear = async (fyId: string) => {
    const data = await safeFetchJson(`/api/financial-years/${fyId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      }
    });
    if (data.success) {
      const fyRes = await safeFetchJson('/api/financial-years');
      if (fyRes.success) setFinancialYears(fyRes.financialYears);
      await refreshMetricsAndData(activeFyId);
    } else {
      throw new Error(data.error || 'Failed to delete financial year');
    }
  };

  // Create Dept
  const handleCreateDepartment = async (deptData: any) => {
    const data = await safeFetchJson('/api/departments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      },
      body: JSON.stringify(deptData)
    });
    if (data.success) {
      const dRes = await safeFetchJson('/api/departments');
      if (dRes.success) setDepartments(dRes.departments);
    } else {
      throw new Error(data.error || 'Failed to create department');
    }
  };

  // Update Dept
  const handleUpdateDepartment = async (deptId: string, deptData: any) => {
    const data = await safeFetchJson(`/api/departments/${deptId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      },
      body: JSON.stringify(deptData)
    });
    if (data.success) {
      const dRes = await safeFetchJson('/api/departments');
      if (dRes.success) setDepartments(dRes.departments);
    } else {
      throw new Error(data.error || 'Failed to update department');
    }
  };

  // Delete Dept
  const handleDeleteDepartment = async (deptId: string) => {
    const data = await safeFetchJson(`/api/departments/${deptId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      }
    });
    if (data.success) {
      const dRes = await safeFetchJson('/api/departments');
      if (dRes.success) setDepartments(dRes.departments);
    } else {
      throw new Error(data.error || 'Failed to delete department');
    }
  };

  // Create Cat
  const handleCreateCategory = async (catData: any) => {
    const data = await safeFetchJson('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      },
      body: JSON.stringify(catData)
    });
    if (data.success) {
      const cRes = await safeFetchJson('/api/categories');
      if (cRes.success) setCategories(cRes.categories);
    } else {
      throw new Error(data.error || 'Failed to create category');
    }
  };

  // Update Cat
  const handleUpdateCategory = async (catId: string, catData: any) => {
    const data = await safeFetchJson(`/api/categories/${catId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      },
      body: JSON.stringify(catData)
    });
    if (data.success) {
      const cRes = await safeFetchJson('/api/categories');
      if (cRes.success) setCategories(cRes.categories);
    } else {
      throw new Error(data.error || 'Failed to update category');
    }
  };

  // Delete Cat
  const handleDeleteCategory = async (catId: string) => {
    const data = await safeFetchJson(`/api/categories/${catId}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': currentUser?.id || '',
        'x-user-role': currentUser?.role || 'ADMIN'
      }
    });
    if (data.success) {
      const cRes = await safeFetchJson('/api/categories');
      if (cRes.success) setCategories(cRes.categories);
    } else {
      throw new Error(data.error || 'Failed to delete category');
    }
  };

  // Update System Settings
  const handleUpdateSettings = async (newSettings: Partial<SystemSettings>) => {
    try {
      const data = await safeFetchJson('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || '',
          'x-user-role': currentUser?.role || 'ADMIN',
          'x-user-department-id': currentUser?.departmentId || ''
        },
        body: JSON.stringify(newSettings)
      });
      if (data.success) {
        setSettings(data.settings);
        // Refresh metrics to update total valuation display if needed
        refreshMetricsAndData();
      }
    } catch (e) {
      console.error('Error updating settings:', e);
    }
  };

  if (dbError) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden select-none">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6 sm:p-8 max-w-lg w-full text-center space-y-6 shadow-2xl relative z-10">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl w-fit mx-auto text-red-400">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Database Connection Failed</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Database connection is managed strictly via <code className="text-amber-300 font-mono">php_apis/db_connection.php</code> using PDO. All static fallback data has been removed, and connection could not be established.
            </p>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-left font-mono text-xs text-red-400 font-semibold space-y-1 overflow-x-auto">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">PHP PDO / MySQL Connection Error</div>
            <div className="break-words">{dbError}</div>
          </div>
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 text-left space-y-1.5 text-xs text-slate-300">
            <div className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider">PHP Database Connection Script:</div>
            <div className="font-mono text-[11px] text-slate-400 space-y-0.5">
              <div>File: <span className="text-slate-200">php_apis/db_connection.php</span></div>
              <div>Connection Mode: <span className="text-emerald-400">PDO MySQL</span></div>
              <div>Host Config: <span className="text-slate-300">$db_host (DB_HOST / MYSQL_HOST)</span></div>
            </div>
          </div>
          <button
            onClick={() => {
              setDbError(null);
              loadAllData();
            }}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-red-600/30 active:scale-95"
          >
            Retry Database Connection
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Initializing StockVault Enterprise Engine...</span>
      </div>
    );
  }

  // System Lock: If no user is authenticated, force render Login Screen ONLY
  if (!currentUser) {
    return <LoginView onLogin={handleLogin} isLoading={isAuthenticating} />;
  }

  const activeFy = financialYears.find(f => f.id === activeFyId);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-[#020617] text-slate-100' : 'bg-slate-900 text-slate-100'} transition-colors font-sans antialiased relative overflow-hidden flex flex-col justify-between`}>
      
      {/* Top Ambient Glow Effect */}
      <div className="absolute top-[-200px] left-[50%] translate-x-[-50%] w-[800px] h-[500px] bg-sky-600/10 rounded-full blur-[140px] pointer-events-none z-0 print:hidden" />

      <div className="z-10 flex flex-col flex-1 print:block print:w-full">
        {/* Top Navbar */}
        <Navbar
          currentUser={currentUser}
          financialYears={financialYears}
          activeFyId={activeFyId}
          onSelectFy={(fyId) => {
            setActiveFyId(fyId);
            refreshMetricsAndData(fyId);
          }}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          activeView={activeView}
          lowStockCount={metrics?.lowStockAlertsCount || 0}
          onChangePasswordClick={() => setIsChangePasswordOpen(true)}
          onLogoutClick={handleLogout}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Main Workspace Body */}
        <div className="flex max-w-7xl mx-auto w-full flex-1 print:block print:w-full print:max-w-none">
          
          {/* Left Sidebar */}
          <Sidebar
            activeView={activeView}
            onSelectView={(view) => {
              setActiveView(view);
              setIsMobileMenuOpen(false);
            }}
            userRole={currentUser.role}
            lowStockCount={metrics?.lowStockAlertsCount || 0}
            isOpenMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          {/* Content View Container */}
          <main className="flex-1 p-3.5 sm:p-6 overflow-y-auto print:overflow-visible print:p-0 print:m-0 print:w-full">
            {activeView === 'dashboard' && (
              <DashboardView
                metrics={metrics}
                transactions={transactions}
                activeFy={activeFy}
                currencySymbol={settings?.currencySymbol || 'E'}
                onNavigate={setActiveView}
              />
            )}

            {activeView === 'stock-in' && (
              <StockInView
                categories={categories}
                departments={departments}
                financialYears={financialYears}
                activeFyId={activeFyId}
                currentUser={currentUser}
                currencySymbol={settings?.currencySymbol || 'E'}
                currencyCode={settings?.currencyCode || 'SZL'}
                onStockInSuccess={handleStockInSuccess}
              />
            )}

            {activeView === 'stock-out' && (
              <StockOutView
                batches={batches}
                inventoryItems={inventoryItems}
                departments={departments}
                currentUser={currentUser}
                onDispatchStock={handleDispatchStock}
              />
            )}

            {activeView === 'inventory' && (
              <InventoryView
                items={inventoryItems}
                batches={batches}
                departments={departments}
                categories={categories}
                financialYears={financialYears}
                activeFyId={activeFyId}
                currentUser={currentUser}
                currencySymbol={settings?.currencySymbol || 'E'}
                onUpdateItemStatus={handleUpdateItemStatus}
              />
            )}

            {activeView === 'low-stock' && (
              <LowStockView
                batches={batches}
                categories={categories}
                departments={departments}
                financialYears={financialYears}
                activeFyId={activeFyId}
                currentUser={currentUser}
                currencySymbol={settings?.currencySymbol || 'E'}
                globalThreshold={settings?.lowStockGlobalThreshold || 5}
                onNavigateToStockIn={() => setActiveView('stock-in')}
              />
            )}

            {activeView === 'reports' && (
              <ReportsView
                financialYears={financialYears}
                departments={departments}
                activeFyId={activeFyId}
                currentUser={currentUser}
                currencySymbol={settings?.currencySymbol || 'E'}
              />
            )}

            {activeView === 'users' && (
              <UserManagementView
                users={users}
                departments={departments}
                currentUser={currentUser}
                onCreateUser={handleCreateUser}
                onToggleUserStatus={handleToggleUserStatus}
                onResetUserPassword={handleResetUserPassword}
              />
            )}

            {activeView === 'master-data' && (
              <MasterDataView
                financialYears={financialYears}
                departments={departments}
                categories={categories}
                settings={settings || { lowStockGlobalThreshold: 5, activeFinancialYearId: activeFyId, companyName: 'StockVault', requireDualSignatures: true, currencyCode: 'SZL', currencySymbol: 'E', currencyName: 'Eswatini Lilangeni', phpApiBaseUrl: '', phpBridgeMode: false }}
                currentUser={currentUser}
                onActivateFy={handleActivateFy}
                onCreateFinancialYear={handleCreateFinancialYear}
                onUpdateFinancialYear={handleUpdateFinancialYear}
                onDeleteFinancialYear={handleDeleteFinancialYear}
                onCreateDepartment={handleCreateDepartment}
                onUpdateDepartment={handleUpdateDepartment}
                onDeleteDepartment={handleDeleteDepartment}
                onCreateCategory={handleCreateCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

            {activeView === 'audit-logs' && (
              <AuditLogsView logs={auditLogs} />
            )}
          </main>

        </div>
      </div>

      {/* Bottom Telemetry Footer Bar */}
      <footer className="h-12 border-t border-slate-800/80 px-8 flex items-center justify-between bg-slate-900/40 backdrop-blur-md text-[10px] text-slate-500 font-mono z-10 max-w-7xl mx-auto w-full print:hidden">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5 text-sky-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            <span>CORE_ENGINE_V2.5</span>
          </span>
          <span className="hidden sm:inline">DATABASE: MYSQL / INNODB</span>
          <span className="hidden md:inline">ROLE_SESSION: {currentUser.role}</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>ACTIVE_FY: {activeFy?.yearCode || 'FY-2025-26'}</span>
          <span>LATENCY: 12ms</span>
          <span className="text-emerald-400 font-bold">SECURE_AUDIT_LOG_ACTIVE</span>
        </div>
      </footer>

      {/* Change Password Modal */}
      {currentUser && (
        <ChangePasswordModal
          currentUser={currentUser}
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          onChangePassword={handleChangePassword}
        />
      )}

    </div>
  );
}
