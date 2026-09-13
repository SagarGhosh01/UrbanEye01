import React, { useState } from 'react';
import { User, Role } from '../types';
import { Bus, LogOut, Radio, ChevronRight, MapPin, Menu, X, ShieldAlert, Activity, AlertTriangle, School, Sparkles } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export type ActiveTabType = 'DEFECTS' | 'TRAFFIC' | 'INCIDENTS' | 'SAFETY' | 'PREDICTIVE';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onOpenPairing: () => void;
  onSwitchUser?: (email: string) => void;
  activeBusCount?: number;
  currentBreadcrumbs?: { label: string; onClick?: () => void }[];
  activeTab?: ActiveTabType;
  onTabChange?: (tab: ActiveTabType) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenPairing,
  onSwitchUser,
  activeBusCount = 0,
  currentBreadcrumbs = [],
  activeTab = 'DEFECTS',
  onTabChange,
}) => {
  const { isDark } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [breadcrumbSheetOpen, setBreadcrumbSheetOpen] = useState(false);

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case 'NATIONAL_ADMIN':
        return 'Ministry Directorate';
      case 'STATE_ADMIN':
        return `State Command (${user.stateName || 'State'})`;
      case 'DISTRICT_HEAD':
        return `District Authority (${user.districtName || 'District'})`;
    }
  };

  const currentJurisdictionLabel = currentBreadcrumbs.length > 0
    ? currentBreadcrumbs[currentBreadcrumbs.length - 1].label
    : 'Overview';

  return (
    <header className={`text-white border-b sticky top-0 z-40 shadow-sm transition-colors duration-300 ${
      isDark ? 'bg-[#10233D] border-slate-800' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-5 py-2 flex items-center justify-between gap-2.5">
        {/* Left: Brandmark */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-2 shrink-0">
            <div className={`w-8 h-8 rounded-full overflow-hidden border flex items-center justify-center p-0.5 shadow-sm transition ${
              isDark ? 'bg-[#081325] border-[#2dd4bf]/40 shadow-[#1E7F73]/20' : 'bg-white border-teal-500/30 shadow-teal-500/10'
            }`}>
              <img src="/logo.png" alt="UrbanEye" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <span className={`font-bold text-sm sm:text-base tracking-tight ${
                isDark ? 'text-white' : 'text-slate-800'
              }`}>
                UrbanEye
              </span>
              <span className={`hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase transition ${
                isDark
                  ? 'text-[#2dd4bf] bg-[#1E7F73]/20 border border-[#2dd4bf]/30 shadow-[0_0_8px_rgba(45,212,191,0.15)]'
                  : 'text-teal-700 bg-teal-50 border border-teal-200'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E7F73] animate-pulse" />
                Live Mesh
              </span>
            </div>
          </div>
        </div>

        {/* Center: Sleek Segmented View Navigation Tabs */}
        {onTabChange && (
          <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs shrink min-w-0 overflow-x-auto scrollbar-none max-w-full">
            <button
              type="button"
              onClick={() => onTabChange('DEFECTS')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] xl:text-xs whitespace-nowrap shrink-0 transition ${
                activeTab === 'DEFECTS' ? 'bg-[#1E7F73] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Road Defects</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('TRAFFIC')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] xl:text-xs whitespace-nowrap shrink-0 transition ${
                activeTab === 'TRAFFIC' ? 'bg-[#1E7F73] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-teal-300 animate-pulse shrink-0" />
              <span>Traffic Flow</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('INCIDENTS')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] xl:text-xs whitespace-nowrap shrink-0 transition ${
                activeTab === 'INCIDENTS' ? 'bg-[#1E7F73] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>Incidents & ANPR</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('SAFETY')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] xl:text-xs whitespace-nowrap shrink-0 transition ${
                activeTab === 'SAFETY' ? 'bg-[#1E7F73] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <School className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span>VRU Safety</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('PREDICTIVE')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] xl:text-xs whitespace-nowrap shrink-0 transition ${
                activeTab === 'PREDICTIVE' ? 'bg-[#1E7F73] text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300 shrink-0" />
              <span>Predictive AI</span>
            </button>
          </div>
        )}

        {/* Right Side: Jurisdiction & User Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Desktop Jurisdiction Scope */}
          <div className={`hidden 2xl:flex items-center space-x-1 text-xs shrink-0 ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <MapPin className="w-3.5 h-3.5 text-[#1E7F73] shrink-0" />
            <span className="font-semibold text-slate-200 truncate max-w-[140px]">
              {currentJurisdictionLabel}
            </span>
          </div>

          {/* Primary Action: Pair Bus (PIN) */}
          <button
            type="button"
            onClick={onOpenPairing}
            className="flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#1E7F73] hover:bg-[#186a60] text-white shadow-sm transition active:scale-95 shrink-0"
            title="Pair a bus-mounted phone sensor using 6-digit PIN"
            aria-label="Pair Bus using 6-digit PIN"
          >
            <Bus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Pair Bus (PIN)</span>
          </button>

          {/* Persona Switcher Dropdown */}
          {onSwitchUser && (
            <div className="relative hidden xl:block">
              <select
                onChange={(e) => onSwitchUser(e.target.value)}
                value={user.email}
                className="text-[11px] font-medium rounded-lg px-2 py-1.5 border focus:outline-none focus:ring-1 focus:ring-[#1E7F73] cursor-pointer max-w-[170px] truncate"
                style={{ backgroundColor: '#1e293b', color: '#e2e8f0', borderColor: '#334155' }}
                title="Switch test persona"
                aria-label="Switch test persona"
              >
                <option value="admin@urbaneye.gov.in">National Admin</option>
                <option value="admin.pb@urbaneye.gov.in">State Admin (Punjab)</option>
                <option value="head.kapurthala@urbaneye.gov.in">★ District Head (Kapurthala)</option>
                <option value="head.jalandhar@urbaneye.gov.in">District Head (Jalandhar)</option>
                <option value="head.mumbai@urbaneye.gov.in">District Head (Mumbai)</option>
                <option value="head.bengaluru@urbaneye.gov.in">District Head (Bengaluru)</option>
              </select>
            </div>
          )}

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className={`hidden md:flex items-center justify-center p-1.5 rounded-lg transition ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`md:hidden flex items-center justify-center p-1.5 rounded-lg border transition ${
              isDark
                ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="Open mobile navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-red-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Breadcrumb Expandable Popover */}
      {breadcrumbSheetOpen && (
        <div className={`md:hidden px-4 py-2.5 border-t text-xs space-y-1.5 shadow-inner transition-all ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <MapPin className="w-3 h-3 text-[#1E7F73]" />
              <span>Jurisdiction Hierarchy</span>
            </span>
            <button
              onClick={() => setBreadcrumbSheetOpen(false)}
              className="text-slate-400 hover:text-white text-[11px] underline"
            >
              Close
            </button>
          </div>
          <div className="flex flex-col space-y-1">
            {currentBreadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center space-x-2 py-1">
                <span className="text-[10px] text-slate-500 font-mono w-4">L{idx + 1}</span>
                {crumb.onClick ? (
                  <button
                    onClick={() => {
                      crumb.onClick?.();
                      setBreadcrumbSheetOpen(false);
                    }}
                    className="text-[#1E7F73] font-semibold hover:underline text-left"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="font-bold text-white">{crumb.label} (Current)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Slide-Down Drawer Menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden border-t px-4 py-4 space-y-4 shadow-2xl animate-fade-in ${
          isDark ? 'bg-[#0f1f38] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          {/* User & Role Information */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className="text-xs font-bold truncate max-w-[200px]">{user.email}</div>
              <div className="text-[11px] text-[#1E7F73] font-semibold mt-0.5">{getRoleLabel(user.role)}</div>
            </div>
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
              isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}>
              <Radio className="w-3.5 h-3.5 text-[#1E7F73] animate-pulse" />
              <span>{activeBusCount} Sensors</span>
            </div>
          </div>

          {/* Quick Persona Switcher for Field Review */}
          {onSwitchUser && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Switch Officer Persona
              </label>
              <select
                onChange={(e) => {
                  onSwitchUser(e.target.value);
                  setMobileMenuOpen(false);
                }}
                value={user.email}
                className="w-full text-xs rounded-xl px-3 py-2.5 border focus:outline-none focus:ring-2 focus:ring-[#1E7F73] min-h-[44px] cursor-pointer"
                style={{ backgroundColor: '#1e293b', color: '#e2e8f0', borderColor: '#334155' }}
              >
                <option value="admin@urbaneye.gov.in">National Admin (All India)</option>
                <option value="admin.pb@urbaneye.gov.in">State Admin (Punjab)</option>
                <option value="head.kapurthala@urbaneye.gov.in">★ District Head (Kapurthala Demo)</option>
                <option value="head.jalandhar@urbaneye.gov.in">District Head (Jalandhar)</option>
                <option value="head.mumbai@urbaneye.gov.in">District Head (Mumbai Suburban)</option>
                <option value="head.bengaluru@urbaneye.gov.in">District Head (Bengaluru)</option>
              </select>
            </div>
          )}

          {/* Logout Button (Full-width, 44px height) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onLogout();
            }}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs min-h-[44px] transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of UrbanEye</span>
          </button>
        </div>
      )}
    </header>
  );
};
