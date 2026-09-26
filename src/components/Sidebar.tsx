import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Layers,
  BookOpen,
  Briefcase,
  Truck,
  ShoppingBag,
  ShieldAlert,
  Receipt,
  Building,
  Users,
  ShieldCheck,
  PenTool,
  CloudUpload,
  History,
  Database,
  Settings,
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Bot,
  Radio,
} from 'lucide-react';
import { User } from '../types';
import { canAccessTab, canAccessPillar, isSuperAdmin } from '../utils/rbacUtils';
import {
  NavigationLabels,
  DEFAULT_NAVIGATION_LABELS,
  DEFAULT_NAVIGATION_LABELS_EN,
} from '../utils/navigationConfig';
import { ProjectOutcome } from '../utils/projectStatusUtils';
import { CompanyLogo } from './CompanyHeader';
import { useSettings } from '../context/SettingsContext';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';

export interface SidebarProps {
  currentUser: User | null;
  activeTab: string;
  onNavigateTab: (tab: string) => void;
  navLabels?: NavigationLabels;
  onOpenThreeWayMatch: () => void;
  onOpenClientMaster: () => void;
  onOpenAdminRoles: () => void;
  onOpenSignatures: () => void;
  onOpenGoogleDrive: () => void;
  onOpenAuditTrail: () => void;
  onOpenBackup: () => void;
  onOpenPreFlight?: () => void;
  onOpenCopilot: () => void;
  onSelectProject?: (id: string | null) => void;
  onSetStatusBreakdownFilter?: (filter: ProjectOutcome | 'all') => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type PillarId = 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6';

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  onNavigateTab,
  navLabels,
  onOpenThreeWayMatch,
  onOpenClientMaster,
  onOpenAdminRoles,
  onOpenSignatures,
  onOpenGoogleDrive,
  onOpenAuditTrail,
  onOpenBackup,
  onOpenPreFlight,
  onOpenCopilot,
  onSelectProject,
  onSetStatusBreakdownFilter,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { settings } = useSettings();
  const { store } = useMasterEnterpriseStore();
  const mc = store.menuCustomization;
  const np = store.navigationPillars || {
    p1_label: "الرقابة التنفيذية والسيولة",
    p2_label: "عروض الأسعار والتسعير",
    p3_label: "المشاريع والعمليات",
    p4_label: "المشتريات والتوريد",
    p5_label: "المالية والفواتير",
    p6_label: "الحوكمة والسيادة السحابية",
  };
  const isEn = settings.language === 'en';

  const formatPillar = (num: number, label: string) => {
    if (!label) return `${num}. الركن ${num}`;
    const trimmed = label.trim();
    return /^\d+\./.test(trimmed) ? trimmed : `${num}. ${trimmed}`;
  };

  const defaultNav = isEn ? DEFAULT_NAVIGATION_LABELS_EN : DEFAULT_NAVIGATION_LABELS;
  const safeNavLabels: NavigationLabels = {
    pillars: {
      ...defaultNav.pillars,
      ...(navLabels?.pillars || {}),
      ...(store.navigation?.labels?.pillars || {}),
    },
    tabs: {
      ...defaultNav.tabs,
      ...(navLabels?.tabs || {}),
      ...(store.navigation?.labels?.tabs || {}),
    },
  };

  // Determine active pillar based on active tab
  const getPillarForTab = (tab: string): PillarId => {
    if (['dashboard', 'cash_flow_sentinel', 'autonomous_agents'].includes(tab)) return 'p1';
    if (['estimating_workbench', 'quotations', 'terms', 'customers', 'crm_clients'].includes(tab)) return 'p2';
    if (['projects'].includes(tab)) return 'p3';
    if (['purchase_orders', 'procurement_mgmt', 'site_logistics', 'suppliers', 'directory', 'supplier_quotations'].includes(tab)) return 'p4';
    if (['invoices', 'status_breakdown'].includes(tab)) return 'p5';
    if (['settings', 'admin_roles', 'audit_trail', 'system_settings'].includes(tab)) return 'p6';
    return 'p1';
  };

  // Accordion State: Only one pillar open at a time
  const [openPillarId, setOpenPillarId] = useState<PillarId | null>(() => getPillarForTab(activeTab));

  // Auto-expand pillar when active route changes
  useEffect(() => {
    const parentPillar = getPillarForTab(activeTab);
    setOpenPillarId(parentPillar);
  }, [activeTab]);

  const togglePillar = (pillarId: PillarId) => {
    setOpenPillarId((prev) => (prev === pillarId ? null : pillarId));
  };

  const handlePillarHover = (pillarId: PillarId, isMobile: boolean) => {
    if (!isMobile) {
      setOpenPillarId(pillarId);
    }
  };

  const handleSidebarMouseLeave = () => {
    if (!isMobileOpen) {
      const parentPillar = getPillarForTab(activeTab);
      setOpenPillarId(parentPillar);
    }
  };

  const handleMobileItemClick = (action: () => void) => {
    action();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  /**
   * Reusable Navigation Content Tree with Hover-To-Open Collapsible Accordions
   */
  const renderNavTree = (collapsed: boolean, isMobile: boolean = false) => {
    const wrapClick = (fn: () => void) => () => {
      if (isMobile) {
        handleMobileItemClick(fn);
      } else {
        fn();
      }
    };

    return (
      <div
        className="flex-1 overflow-y-auto px-2.5 py-3 space-y-2 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.2)_transparent]"
        onMouseLeave={!isMobile ? handleSidebarMouseLeave : undefined}
      >
        {/* P1: الرقابة التنفيذية والسيولة (Executive Oversight) */}
        {canAccessPillar(currentUser, 1) && (
          <div
            onMouseEnter={() => handlePillarHover('p1', isMobile)}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              openPillarId === 'p1'
                ? 'border-emerald-500/50 bg-slate-900/90 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/20'
                : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700/80 hover:bg-slate-800/40'
            }`}
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => togglePillar('p1')}
              className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                openPillarId === 'p1'
                  ? 'bg-slate-800/90 text-emerald-400 border-s-4 border-emerald-500 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title={safeNavLabels.pillars.pillar1}
            >
              <div className="flex items-center gap-2 min-w-0">
                <LayoutDashboard className="w-4 h-4 text-emerald-400 shrink-0" />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">
                    {isEn ? '1. Executive Oversight' : formatPillar(1, store.navigationPillars?.p1_label || '1. الرقابة التنفيذية والسيولة')}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold border border-emerald-800/40">
                    P1
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      openPillarId === 'p1' ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Accordion Items */}
            {(openPillarId === 'p1' || collapsed) && (
              <div className="p-1.5 space-y-1 transition-all duration-200 ease-in-out border-t border-slate-800/50 bg-slate-950/40 animate-in fade-in-50 duration-200">
                {canAccessTab(currentUser, 'dashboard') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('dashboard'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'dashboard'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'dashboard'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Executive KPI & Projects Overview' : 'لوحة التحكم التنفيذية'}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Executive KPI & Overview' : 'لوحة التحكم التنفيذية'}
                      </span>
                    )}
                  </button>
                )}

                {canAccessTab(currentUser, 'cash_flow_sentinel') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('cash_flow_sentinel'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'cash_flow_sentinel'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'cash_flow_sentinel'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Cash Flow & Working Capital' : 'حارس السيولة وتدفقات النقد'}
                  >
                    <TrendingUp className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Cash Flow & Sentinel' : 'حارس السيولة وتدفقات النقد'}
                      </span>
                    )}
                  </button>
                )}

                {canAccessTab(currentUser, 'autonomous_agents') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('autonomous_agents'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'autonomous_agents'
                            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                            : 'text-amber-400 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between ' +
                          (activeTab === 'autonomous_agents'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black shadow-sm'
                            : 'text-amber-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Autonomous Agents & Telegram Bot' : 'الوكلاء المستقلون وبوت التليجرام'}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Bot className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      {!collapsed && (
                        <span className="leading-snug truncate">
                          {isEn ? 'Autonomous Agents & Telegram' : 'الوكلاء وبوت التليجرام'}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-400/30">
                        AI Bot
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* P2: الهندسة ودراسة العطاءات (Tendering & BoQ) */}
        {canAccessPillar(currentUser, 2) && (
          <div
            onMouseEnter={() => handlePillarHover('p2', isMobile)}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              openPillarId === 'p2'
                ? 'border-cyan-500/50 bg-slate-900/90 shadow-md shadow-cyan-950/20 ring-1 ring-cyan-500/20'
                : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700/80 hover:bg-slate-800/40'
            }`}
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => togglePillar('p2')}
              className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                openPillarId === 'p2'
                  ? 'bg-slate-800/90 text-cyan-400 border-s-4 border-cyan-500 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title={safeNavLabels.pillars.pillar2}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">
                    {isEn ? '2. Tendering & BoQ' : formatPillar(2, store.navigationPillars?.p2_label || '2. عروض الأسعار والتسعير')}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] bg-cyan-950/60 text-cyan-400 px-1.5 py-0.5 rounded font-mono font-bold border border-cyan-800/40">
                    P2
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      openPillarId === 'p2' ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Accordion Items */}
            {(openPillarId === 'p2' || collapsed) && (
              <div className="p-1.5 space-y-1 transition-all duration-200 ease-in-out border-t border-slate-800/50 bg-slate-950/40 animate-in fade-in-50 duration-200">
                {canAccessTab(currentUser, 'estimating_workbench') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('estimating_workbench'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'estimating_workbench' || activeTab === 'quotations'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'estimating_workbench' || activeTab === 'quotations'
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Unified Estimating, BoQ & RFQ Matrix' : (np.p2_label || mc?.quotationsLabel || 'ورشة تسعير العطاءات و BoQ')}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Estimating & BoQ Workbench' : (np.p2_label || mc?.quotationsLabel || safeNavLabels.tabs.estimating_workbench || 'ورشة تسعير العطاءات و BoQ')}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={wrapClick(onOpenClientMaster)}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center text-cyan-300 hover:bg-cyan-950/40'
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title={isEn ? 'VIP Clients Master Directory' : 'دليل كبار العملاء'}
                >
                  <Building className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  {!collapsed && (
                    <span className="leading-snug truncate">
                      {isEn ? 'Clients Master Directory' : 'دليل كبار العملاء'}
                    </span>
                  )}
                </button>

                {canAccessTab(currentUser, 'terms') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('terms'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'terms'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'terms'
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Specifications & Approved Standards' : 'مكتبة المواصفات والأنظمة المعتمدة'}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Specs & Standards Library' : 'مكتبة المواصفات والأنظمة'}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* P3: إدارة المشاريع والتنفيذ (Projects Delivery) */}
        {canAccessPillar(currentUser, 3) && (
          <div
            onMouseEnter={() => handlePillarHover('p3', isMobile)}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              openPillarId === 'p3'
                ? 'border-emerald-500/50 bg-slate-900/90 shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/20'
                : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700/80 hover:bg-slate-800/40'
            }`}
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => togglePillar('p3')}
              className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                openPillarId === 'p3'
                  ? 'bg-slate-800/90 text-emerald-400 border-s-4 border-emerald-500 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title={safeNavLabels.pillars.pillar3}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Briefcase className="w-4 h-4 text-emerald-400 shrink-0" />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">
                    {isEn ? '3. Projects Delivery' : formatPillar(3, store.navigationPillars?.p3_label || '3. المشاريع والعمليات')}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold border border-emerald-800/40">
                    P3
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      openPillarId === 'p3' ? 'rotate-180 text-emerald-400' : ''
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Accordion Items */}
            {(openPillarId === 'p3' || collapsed) && (
              <div className="p-1.5 space-y-1 transition-all duration-200 ease-in-out border-t border-slate-800/50 bg-slate-950/40 animate-in fade-in-50 duration-200">
                {canAccessTab(currentUser, 'projects') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => {
                      onSelectProject?.(null);
                      onNavigateTab('projects');
                    })}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'projects'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'projects'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Active Projects & Contracts' : (np.p3_label || mc?.projectsLabel || 'المشاريع والعمليات')}
                  >
                    <Briefcase className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Active Projects & Contracts' : (np.p3_label || mc?.projectsLabel || safeNavLabels.tabs.projects || 'المشاريع والعمليات')}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* P4: سلاسل الإمداد والمشتريات (Procurement & SCM) */}
        {canAccessPillar(currentUser, 4) && (
          <div
            onMouseEnter={() => handlePillarHover('p4', isMobile)}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              openPillarId === 'p4'
                ? 'border-amber-500/50 bg-slate-900/90 shadow-md shadow-amber-950/20 ring-1 ring-amber-500/20'
                : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700/80 hover:bg-slate-800/40'
            }`}
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => togglePillar('p4')}
              className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                openPillarId === 'p4'
                  ? 'bg-slate-800/90 text-amber-400 border-s-4 border-amber-500 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title={safeNavLabels.pillars.pillar4}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag className="w-4 h-4 text-amber-400 shrink-0" />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">
                    {isEn ? '4. Procurement & SCM' : formatPillar(4, store.navigationPillars?.p4_label || '4. المشتريات والتوريد')}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] bg-amber-950/60 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold border border-amber-800/40">
                    P4
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      openPillarId === 'p4' ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Accordion Items */}
            {(openPillarId === 'p4' || collapsed) && (
              <div className="p-1.5 space-y-1 transition-all duration-200 ease-in-out border-t border-slate-800/50 bg-slate-950/40 animate-in fade-in-50 duration-200">
                <button
                  type="button"
                  onClick={wrapClick(() => onNavigateTab('purchase_orders'))}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center ' +
                        (activeTab === 'purchase_orders' || activeTab === 'procurement_mgmt'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800')
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                        (activeTab === 'purchase_orders' || activeTab === 'procurement_mgmt'
                          ? 'bg-gradient-to-r from-amber-600 to-yellow-700 text-white font-bold shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                  }`}
                  title={isEn ? 'Purchase Orders & Procurement Management' : (np.p4_label || mc?.procurementLabel || 'المشتريات والتوريد')}
                >
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  {!collapsed && (
                    <span className="leading-snug truncate">
                      {isEn ? 'Purchase Orders (POs)' : (np.p4_label || mc?.procurementLabel || safeNavLabels.tabs.purchase_orders || 'المشتريات والتوريد')}
                    </span>
                  )}
                </button>

                {canAccessTab(currentUser, 'site_logistics') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('site_logistics'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'site_logistics'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'site_logistics'
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'GRN & Site Delivery Logs' : (mc?.siteExecutionLabel || 'التنفيذ والمتابعة الميدانية')}
                  >
                    <Truck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'GRN & Site Logs' : (mc?.siteExecutionLabel || safeNavLabels.tabs.site_logistics || 'التنفيذ والمتابعة الميدانية')}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={wrapClick(onOpenThreeWayMatch)}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center text-amber-300 hover:bg-amber-950/40'
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 text-amber-300 hover:bg-amber-950/40 border border-amber-500/20'
                  }`}
                  title={isEn ? '3-Way Match Gatekeeper (PO vs GRN vs Invoice)' : 'بوابة المطابقة الثلاثية'}
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  {!collapsed && (
                    <span className="leading-snug truncate">
                      {isEn ? '3-Way Match Gatekeeper' : 'بوابة المطابقة الثلاثية'}
                    </span>
                  )}
                </button>

                {canAccessTab(currentUser, 'directory') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('suppliers'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'suppliers' || activeTab === 'directory'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'suppliers' || activeTab === 'directory'
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Vendors & Factories Directory' : 'دليل الشركاء والمصانع والموردين'}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Vendors Master Directory' : 'دليل الشركاء والموردين'}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* P5: المالية ومراقبة التكاليف (Finance & Controlling) */}
        {canAccessPillar(currentUser, 5) && (
          <div
            onMouseEnter={() => handlePillarHover('p5', isMobile)}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              openPillarId === 'p5'
                ? 'border-sky-500/50 bg-slate-900/90 shadow-md shadow-sky-950/20 ring-1 ring-sky-500/20'
                : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700/80 hover:bg-slate-800/40'
            }`}
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => togglePillar('p5')}
              className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                openPillarId === 'p5'
                  ? 'bg-slate-800/90 text-sky-400 border-s-4 border-sky-500 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title={safeNavLabels.pillars.pillar5}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Receipt className="w-4 h-4 text-sky-400 shrink-0" />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">
                    {isEn ? '5. Finance & Controlling' : formatPillar(5, store.navigationPillars?.p5_label || '5. المالية والفواتير')}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] bg-sky-950/60 text-sky-400 px-1.5 py-0.5 rounded font-mono font-bold border border-sky-800/40">
                    P5
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      openPillarId === 'p5' ? 'rotate-180 text-sky-400' : ''
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Accordion Items */}
            {(openPillarId === 'p5' || collapsed) && (
              <div className="p-1.5 space-y-1 transition-all duration-200 ease-in-out border-t border-slate-800/50 bg-slate-950/40 animate-in fade-in-50 duration-200">
                {canAccessTab(currentUser, 'invoices') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => onNavigateTab('invoices'))}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'invoices'
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'invoices'
                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Tax Invoices & Billing' : (np.p5_label || mc?.financeLabel || 'المالية والفواتير')}
                  >
                    <Receipt className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Tax Invoices & Billing' : (np.p5_label || mc?.financeLabel || safeNavLabels.tabs.invoices || 'المالية والفواتير')}
                      </span>
                    )}
                  </button>
                )}

                {canAccessTab(currentUser, 'status_breakdown') && (
                  <button
                    type="button"
                    onClick={wrapClick(() => {
                      onSetStatusBreakdownFilter?.('all');
                      onNavigateTab('status_breakdown');
                    })}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center ' +
                          (activeTab === 'status_breakdown'
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'text-slate-300 hover:bg-slate-800')
                        : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                          (activeTab === 'status_breakdown'
                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                    }`}
                    title={isEn ? 'Margin & Cost Control' : 'مراقبة هوامش الربح والتكاليف'}
                  >
                    <BarChart3 className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Margin & Cost Control' : 'مراقبة هوامش الربح والتكاليف'}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* P6: الحوكمة والسيادة السحابية (System Admin & Governance) - STRICTLY SUPER-ADMIN */}
        {isSuperAdmin(currentUser) && (
          <div
            onMouseEnter={() => handlePillarHover('p6', isMobile)}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              openPillarId === 'p6'
                ? 'border-purple-500/50 bg-slate-900/90 shadow-md shadow-purple-950/20 ring-1 ring-purple-500/20'
                : 'border-purple-800/50 bg-slate-900/40 hover:border-purple-700/80 hover:bg-purple-950/30'
            }`}
          >
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => togglePillar('p6')}
              className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                openPillarId === 'p6'
                  ? 'bg-purple-950/80 text-purple-300 border-s-4 border-purple-500 font-bold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
              title={safeNavLabels.pillars.pillar6}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                {!collapsed && (
                  <span className="text-xs font-bold truncate">
                    {isEn ? '6. Governance & Cloud' : formatPillar(6, store.navigationPillars?.p6_label || '6. الحوكمة والسيادة السحابية')}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold border border-purple-700/50">
                    Root
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      openPillarId === 'p6' ? 'rotate-180 text-purple-400' : ''
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Accordion Items */}
            {(openPillarId === 'p6' || collapsed) && (
              <div className="p-1.5 space-y-1 transition-all duration-200 ease-in-out border-t border-purple-800/40 bg-purple-950/30 animate-in fade-in-50 duration-200">
                <button
                  type="button"
                  onClick={wrapClick(onOpenAdminRoles)}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white'
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                  title={isEn ? 'RBAC & PBAC Permissions Matrix' : 'إدارة الصلاحيات والمستخدمين (RBAC & PBAC)'}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                  {!collapsed && (
                    <span className="leading-snug truncate">
                      {isEn ? 'Users & PBAC Matrix' : 'إدارة الصلاحيات والمستخدمين'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={wrapClick(onOpenSignatures)}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white'
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                  title={isEn ? 'Signatures & Official Approvals' : 'التواقيع والأختام الرسمية'}
                >
                  <PenTool className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  {!collapsed && (
                    <span className="leading-snug truncate">
                      {isEn ? 'Signatures & Approvals' : 'التواقيع والأختام الرسمية'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={wrapClick(onOpenGoogleDrive)}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white'
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                  title={isEn ? '5TB Google Drive Cloud Storage' : 'أرشيف 5TB السحابي (Google Drive)'}
                >
                  <CloudUpload className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  {!collapsed && (
                    <span className="leading-snug truncate">
                      {isEn ? '5TB Cloud Drive' : 'أرشيف 5TB السحابي'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={wrapClick(onOpenAuditTrail)}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center text-slate-300 hover:bg-slate-800 hover:text-white'
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                  title={isEn ? 'Financial & Operational Audit Trail' : 'سجل التدقيق المالي والتشغيلي'}
                >
                  <History className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  {!collapsed && (
                    <span className="leading-snug truncate">
                      {isEn ? 'Audit Trail' : 'سجل التدقيق (Audit Trail)'}
                    </span>
                  )}
                </button>

                {onOpenPreFlight && (
                  <button
                    type="button"
                    onClick={wrapClick(onOpenPreFlight)}
                    className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                      collapsed
                        ? 'p-2 rounded-lg flex items-center justify-center text-teal-400 hover:bg-teal-950/60 hover:text-white'
                        : 'px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2.5 text-teal-300 hover:bg-teal-950/60 hover:text-white'
                    }`}
                    title={isEn ? 'Pre-Flight System Health & Self-Healing' : 'فحص سلامة النظام والتحقق قبل النشر (Self-Healing)'}
                  >
                    <Activity className="w-3.5 h-3.5 shrink-0 text-teal-400 animate-pulse" />
                    {!collapsed && (
                      <span className="leading-snug truncate">
                        {isEn ? 'Pre-Flight Audit & Heal' : 'فحص سلامة النظام والإصلاح الذاتي'}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={wrapClick(() => onNavigateTab('settings'))}
                  className={`w-full rtl:text-right ltr:text-left transition-all cursor-pointer ${
                    collapsed
                      ? 'p-2 rounded-lg flex items-center justify-center ' +
                        (activeTab === 'settings'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800')
                      : 'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 ' +
                        (activeTab === 'settings'
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white font-bold shadow-md border border-purple-400/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60')
                  }`}
                  title={isEn ? 'System Core Settings & RMT Identity' : 'إعدادات المنظومة وهوية RMT'}
                >
                  <Settings className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                  {!collapsed && (
                    <span className="leading-snug font-bold truncate">
                      {isEn ? 'System Core Settings' : 'إعدادات المنظومة وهوية RMT'}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        dir="rtl"
        className={`hidden md:flex flex-col bg-[#0b1324] border-l border-slate-800 text-slate-200 transition-all duration-300 ease-in-out z-30 shrink-0 select-none ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
        style={{ height: '100vh', maxHeight: '100vh' }}
      >
        {/* Sidebar Header with Brand */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-[#080e1c]">
          {!isCollapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <CompanyLogo className="h-9 w-auto drop-shadow-sm" />
              <div className="min-w-0">
                <div className="font-extrabold text-xs text-white truncate leading-tight tracking-tight">
                  {store.companyIdentity?.officialArabicName || 'صناع الموارد'}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono font-bold truncate">
                  RMT Enterprise ERP
                </div>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="mx-auto">
              <CompanyLogo className="h-7 w-auto drop-shadow-sm" />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
            title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Content Tree with Hover-To-Open */}
        {renderNavTree(isCollapsed, false)}

        {/* AI Copilot Quick Trigger at Bottom */}
        <div className="p-2.5 border-t border-slate-800/80 bg-[#080e1c]/80 shrink-0">
          <button
            type="button"
            onClick={onOpenCopilot}
            className={`w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-emerald-600/30 hover:to-teal-600/30 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-2 transition cursor-pointer text-xs font-bold shadow-xs ${
              isCollapsed ? 'p-2' : ''
            }`}
            title="مساعد RMT الذكي"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            {!isCollapsed && <span>مساعد المهندس الذكي (AI)</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" dir="rtl">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Body */}
          <div className="relative flex flex-col w-4/5 max-w-xs bg-[#0b1324] border-l border-slate-800 text-slate-200 z-10 shadow-2xl h-full">
            <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between bg-[#080e1c]">
              <div className="flex items-center gap-3">
                <CompanyLogo className="h-8 w-auto" />
                <div>
                  <div className="font-extrabold text-xs text-white">
                    {store.companyIdentity?.officialArabicName || 'صناع الموارد'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">RMT Enterprise</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderNavTree(false, true)}

            <div className="p-3 border-t border-slate-800 bg-[#080e1c]">
              <button
                type="button"
                onClick={() => {
                  handleMobileItemClick(onOpenCopilot);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-center gap-2 text-xs font-bold shadow-md cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>مساعد المهندس الذكي (AI)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
