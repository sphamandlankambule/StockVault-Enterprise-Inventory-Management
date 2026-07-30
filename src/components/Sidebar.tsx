import React from 'react';
import {
  LayoutDashboard,
  PackagePlus,
  PackageMinus,
  Boxes,
  BarChart3,
  Users,
  Settings2,
  FileSpreadsheet,
  AlertTriangle,
  X
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  activeView: string;
  onSelectView: (view: string) => void;
  userRole: UserRole;
  lowStockCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  userRole,
  lowStockCount,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['ADMIN', 'STORE_KEEPER', 'STAFF_RECEIVER'],
      badge: null
    },
    {
      id: 'stock-in',
      label: 'Stock In (Incoming Batch)',
      icon: PackagePlus,
      roles: ['ADMIN', 'STORE_KEEPER'],
      badge: null
    },
    {
      id: 'stock-out',
      label: 'Stock Out & Signatures',
      icon: PackageMinus,
      roles: ['ADMIN', 'STORE_KEEPER'],
      badge: null
    },
    {
      id: 'inventory',
      label: 'Inventory & Lifecycle',
      icon: Boxes,
      roles: ['ADMIN', 'STORE_KEEPER', 'STAFF_RECEIVER'],
      badge: null
    },
    {
      id: 'low-stock',
      label: 'Low Stock Alerts',
      icon: AlertTriangle,
      roles: ['ADMIN', 'STORE_KEEPER', 'STAFF_RECEIVER'],
      badge: lowStockCount > 0 ? `${lowStockCount} Alert${lowStockCount > 1 ? 's' : ''}` : null,
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    },
    {
      id: 'reports',
      label: 'Valuation & FY Reports',
      icon: BarChart3,
      roles: ['ADMIN', 'STORE_KEEPER', 'STAFF_RECEIVER'],
      badge: null
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      roles: ['ADMIN'],
      adminOnly: true,
      badge: 'Admin'
    },
    {
      id: 'master-data',
      label: 'Master Settings & FY',
      icon: Settings2,
      roles: ['ADMIN'],
      adminOnly: true,
      badge: 'Admin'
    },
    {
      id: 'audit-logs',
      label: 'Audit Trail Logs',
      icon: FileSpreadsheet,
      roles: ['ADMIN', 'STORE_KEEPER'],
      badge: null
    }
  ];

  const handleSelect = (viewId: string) => {
    onSelectView(viewId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full py-2">
      {/* Top Menu Items */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] px-3 py-1.5">
          <span>Enterprise Navigation</span>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {navItems.map((item) => {
          const isAllowed = item.roles.includes(userRole);
          const isActive = activeView === item.id;
          const Icon = item.icon;

          if (!isAllowed) {
            return null;
          }

          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-sky-500/10 border border-sky-500/20 text-sky-400 font-semibold shadow-[0_0_15px_rgba(14,165,233,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  item.badgeColor || (isActive ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-800/80 text-slate-400 border-slate-700')
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Audit Policy Glass Banner */}
      <div className="p-4 m-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2 backdrop-blur-md">
        <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
          <AlertTriangle className="w-3.5 h-3.5 text-sky-400" />
          <span>Audit Policy Enforced</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed italic">
          All stock dispatches mandate dual digital signatures with IP address logging. Zero self-registration.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#020617]/50 backdrop-blur-xl border-r border-slate-800 text-slate-300 flex-col shrink-0 min-h-[calc(100vh-5rem)] print:hidden">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex print:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Slide-out Panel */}
          <aside className="relative w-72 max-w-[80vw] bg-[#020617] border-r border-slate-800 text-slate-300 flex flex-col h-full z-10 shadow-2xl overflow-y-auto">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
