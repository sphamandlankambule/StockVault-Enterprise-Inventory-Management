import React from 'react';
import {
  ShieldCheck,
  Calendar,
  User,
  Sun,
  Moon,
  Database,
  Building2,
  PackageCheck,
  KeyRound,
  LogOut,
  Lock,
  Menu,
  X
} from 'lucide-react';
import { UserRole, FinancialYear, User as UserType } from '../types';

interface NavbarProps {
  currentUser: UserType;
  allUsers?: UserType[];
  onSwitchUser?: (user: UserType) => void;
  financialYears: FinancialYear[];
  activeFyId: string;
  onSelectFy: (fyId: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  activeView: string;
  lowStockCount: number;
  onChangePasswordClick?: () => void;
  onLogoutClick?: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  financialYears,
  activeFyId,
  onSelectFy,
  darkMode,
  onToggleDarkMode,
  lowStockCount,
  onChangePasswordClick,
  onLogoutClick,
  isMobileMenuOpen,
  onToggleMobileMenu
}) => {
  const activeFy = financialYears.find(f => f.id === activeFyId) || financialYears.find(f => f.isActive);

  return (
    <header className="bg-[#020617]/80 backdrop-blur-md border-b border-slate-800 text-white sticky top-0 z-40 print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        
        {/* Brand Logo & Name + Mobile Menu Button */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Toggle Mobile Navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-sky-400" /> : <Menu className="w-5 h-5 text-slate-300" />}
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-sky-500 flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.4)] shrink-0">
            <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-bold text-base sm:text-xl tracking-tight text-white">
                IMS <span className="text-sky-400">Pro</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded-md">
                Enterprise
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold hidden sm:block">Inventory & Audit Compliance</p>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          
          {/* Active Financial Year Selector */}
          <div className="flex items-center bg-slate-800/60 border border-slate-700/80 rounded-full px-2.5 py-1 sm:px-4 sm:py-2 text-[11px] sm:text-xs text-slate-200 shadow-inner">
            <Calendar className="w-3.5 h-3.5 text-sky-400 mr-1.5 sm:mr-2 shrink-0" />
            <span className="text-slate-400 mr-1 hidden sm:inline">Current FY:</span>
            <select
              value={activeFyId}
              onChange={(e) => onSelectFy(e.target.value)}
              className="bg-transparent font-bold text-sky-400 tracking-wider focus:outline-none cursor-pointer max-w-[90px] sm:max-w-none text-ellipsis"
            >
              {financialYears.map((fy) => (
                <option key={fy.id} value={fy.id} className="bg-slate-900 text-slate-100 font-mono">
                  {fy.yearCode} {fy.isActive ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* User Profile & Account Actions Dropdown */}
          <div className="relative group">
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-1.5 cursor-pointer text-xs transition-all">
              <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div className="text-left hidden md:block">
                <div className="font-medium text-slate-200 leading-none">{currentUser.fullName}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    currentUser.role === 'ADMIN' ? 'bg-purple-400' : currentUser.role === 'STORE_KEEPER' ? 'bg-sky-400' : 'bg-emerald-400'
                  }`} />
                  <span className="italic">{currentUser.role.replace('_', ' ')}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-sky-300 font-semibold">{currentUser.role === 'ADMIN' ? 'All Depts' : (currentUser.departmentName || 'Dept Scope')}</span>
                </div>
              </div>
            </div>

            {/* Profile Menu Dropdown */}
            <div className="absolute right-0 mt-2 w-60 sm:w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 hidden group-hover:block z-50 backdrop-blur-xl space-y-1">
              <div className="text-[10px] font-bold text-sky-500 uppercase tracking-widest px-2 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between">
                <span>Account Controls</span>
                {currentUser.username && <span className="text-[9px] font-mono text-slate-400">@{currentUser.username}</span>}
              </div>

              {/* Password Action */}
              {onChangePasswordClick && (
                <button
                  onClick={onChangePasswordClick}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center space-x-2 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                  <span>Change Password</span>
                </button>
              )}

              {/* Logout Action */}
              {onLogoutClick && (
                <button
                  onClick={onLogoutClick}
                  className="w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center space-x-2 hover:bg-rose-500/20 text-rose-300 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Lock System / Log Out</span>
                </button>
              )}

            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Toggle Light/Dark Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
          </button>

          {/* Logout Quick Button */}
          {onLogoutClick && (
            <button
              onClick={onLogoutClick}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition-colors cursor-pointer flex items-center space-x-1"
              title="Lock System & Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
