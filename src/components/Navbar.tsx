import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  CloudUpload,
  RefreshCw,
  Sparkles,
  Sun,
  Moon,
  Globe,
  Bell,
  Menu,
  Shield,
  ExternalLink,
  CheckCheck,
  Filter,
  DollarSign,
  Truck,
  FolderKanban,
  Check,
  AlertTriangle,
  Info,
  Clock,
  ChevronRight,
  ChevronDown,
  User as UserIcon,
  X,
} from 'lucide-react';
import { User, NotificationItem } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  filterNotificationsByCategory,
  saveReadNotificationIds,
  getReadNotificationIds,
} from '../services/notificationSentinel';

interface NavbarProps {
  currentUser: User | null;
  notifications?: NotificationItem[];
  onOpenNotifications?: () => void;
  onNavigateTab?: (tab: string, targetId?: string) => void;
  onNotificationClick?: (notif: NotificationItem) => void;
  onMarkAllNotificationsRead?: () => void;
  onOpenCopilot: () => void;
  onOpenGoogleDrive: () => void;
  onSystemRefresh: () => void;
  isRefreshingSystem?: boolean;
  onOpenAiPriceSearch: () => void;
  onToggleMobileMenu?: () => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  onOpenProfile?: () => void;
}

/**
 * Official RMT Monogram / Custom Uploaded Logo
 */
export const RmtMonogramLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('rmt_company_logo');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleLogoUpdate = () => {
      try {
        setCustomLogo(localStorage.getItem('rmt_company_logo'));
      } catch {}
    };
    window.addEventListener('rmt_logo_updated', handleLogoUpdate);
    window.addEventListener('storage', handleLogoUpdate);
    return () => {
      window.removeEventListener('rmt_logo_updated', handleLogoUpdate);
      window.removeEventListener('storage', handleLogoUpdate);
    };
  }, []);

  if (customLogo) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs ${className}`}>
        <img src={customLogo} alt="Logo" className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs ${className}`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="rmtBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#174A84" />
            <stop offset="100%" stopColor="#007A5A" />
          </linearGradient>
          <linearGradient id="rmtMonogramGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <linearGradient id="rmtAccentGlow" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer Shield Rounded Surface */}
        <rect width="48" height="48" rx="12" fill="url(#rmtBgGrad)" />
        <rect x="1" y="1" width="46" height="46" rx="11" stroke="url(#rmtAccentGlow)" strokeWidth="1.5" />

        {/* Stylized "RM" Monogram Geometric Architecture */}
        <path
          d="M 12 36 V 12 H 22 C 26.5 12 28.5 14.5 28.5 18 C 28.5 21.5 26 23.5 22 23.5 H 12"
          stroke="url(#rmtMonogramGrad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 19 23.5 L 28 36"
          stroke="url(#rmtMonogramGrad)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M 28 36 V 16.5 L 34 26 L 40 16.5 V 36"
          stroke="#FFFFFF"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23.5" cy="18" r="1.5" fill="#38BDF8" />
      </svg>
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  notifications = [],
  onOpenNotifications,
  onNavigateTab,
  onNotificationClick,
  onMarkAllNotificationsRead,
  onOpenCopilot,
  onOpenGoogleDrive,
  onSystemRefresh,
  isRefreshingSystem = false,
  onOpenAiPriceSearch,
  onToggleMobileMenu,
  isMobileOpen,
  setIsMobileOpen,
  onOpenProfile,
}) => {
  const { store } = useMasterEnterpriseStore();
  const { settings, toggleTheme: ctxToggleTheme, toggleLanguage: ctxToggleLanguage, t } = useSettings();

  const isEn = settings.language === 'en';
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'finance' | 'logistics' | 'projects'>('all');
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(() => getReadNotificationIds());
  
  const notifDropdownRef = useRef<HTMLDivElement | null>(null);
  const quickActionsRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setIsQuickActionsOpen(false);
      }
    };
    if (isNotifOpen || isQuickActionsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isNotifOpen, isQuickActionsOpen]);

  // Merge read state with props notifications
  const liveNotifications: NotificationItem[] = notifications.map((n) => ({
    ...n,
    isRead: localReadIds.has(n.id) || n.isRead,
  }));

  const unreadCount = liveNotifications.filter((n) => !n.isRead).length;
  const filteredNotifications = filterNotificationsByCategory(liveNotifications, activeCategory);

  const handleItemClick = (item: NotificationItem) => {
    if (!localReadIds.has(item.id)) {
      const updated = new Set(localReadIds);
      updated.add(item.id);
      setLocalReadIds(updated);
      saveReadNotificationIds(Array.from(updated));
    }
    setIsNotifOpen(false);
    setIsQuickActionsOpen(false);
    if (onNotificationClick) {
      onNotificationClick(item);
    } else if (item.targetTab && onNavigateTab) {
      onNavigateTab(item.targetTab, item.targetId);
    }
  };

  const handleMarkAllRead = () => {
    const allIds = liveNotifications.map((n) => n.id);
    const updated = new Set([...Array.from(localReadIds), ...allIds]);
    setLocalReadIds(updated);
    saveReadNotificationIds(Array.from(updated));
    if (onMarkAllNotificationsRead) {
      onMarkAllNotificationsRead();
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 w-full bg-white/95 dark:bg-[#0B1528]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 shadow-xs transition-colors select-none">
      {/* ------------------------------------------------------------- */}
      {/* 1. BRAND ESTABLISHMENT BLOCK (Start Zone)                     */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        {(setIsMobileOpen || onToggleMobileMenu) && (
          <button
            type="button"
            onClick={() => {
              if (setIsMobileOpen) {
                setIsMobileOpen(!isMobileOpen);
              } else if (onToggleMobileMenu) {
                onToggleMobileMenu();
              }
            }}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group min-w-0" onClick={onOpenProfile}>
          <RmtMonogramLogo className="w-8 h-8 sm:w-10 sm:h-10 transform group-hover:scale-105 transition-transform duration-200 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm md:text-base font-black text-[#174A84] dark:text-sky-400 tracking-tight leading-none truncate">
              {store.companyIdentity?.officialArabicName || 'شركة صناع الموارد التجاريه'} - RMT
            </span>
            <span className="hidden xl:inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
              ERP v5.5
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. ACTIONS TOOLBAR (Responsive with Arrow Collapse)            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative" ref={quickActionsRef}>
        {/* Visible on Tablet & Desktop (md:flex), hidden on mobile */}
        <button
          type="button"
          onClick={onOpenCopilot}
          className="hidden md:flex h-9 px-3 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 shadow-xs items-center gap-1.5 transition active:scale-98 cursor-pointer shrink-0 backdrop-blur-xs"
          title={isEn ? 'RMT Copilot' : 'مساعد RMT الذكي لدراسة العطاءات والتدقيق الفوري'}
        >
          <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          <span>{t.copilotBtn}</span>
        </button>

        {/* Visible on Desktop ONLY (lg:flex) */}
        <button
          type="button"
          onClick={onOpenGoogleDrive}
          className="hidden lg:flex h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs items-center gap-1.5 transition active:scale-98 cursor-pointer shrink-0 backdrop-blur-xs"
          title={isEn ? '5TB Cloud Archive' : 'الأرشيف السحابي 5TB Google Drive المعتمد'}
        >
          <CloudUpload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="font-mono">{t.driveSyncedBtn}</span>
        </button>

        <button
          type="button"
          onClick={onSystemRefresh}
          disabled={isRefreshingSystem}
          className={`hidden lg:flex h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs items-center gap-1.5 transition active:scale-98 cursor-pointer shrink-0 backdrop-blur-xs ${
            isRefreshingSystem ? 'opacity-60 cursor-wait' : ''
          }`}
          title={isEn ? 'Refresh System' : 'تحديث المنظومة ومزامنة السجلات فوراً'}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isRefreshingSystem ? 'animate-spin' : ''}`} />
          <span>{t.refreshBtn}</span>
        </button>

        <button
          type="button"
          onClick={onOpenAiPriceSearch}
          className="hidden lg:flex h-9 px-3 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-xs items-center gap-1.5 transition active:scale-98 cursor-pointer shrink-0 backdrop-blur-xs"
          title={isEn ? 'AI Price Search' : 'بحث ذكي في أسعار السوق والموردين'}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>{t.priceSearchBtn}</span>
        </button>

        {/* Dual-Language Switcher [ AR | EN ] - Desktop only */}
        <div
          className="hidden lg:flex h-9 px-1 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg items-center gap-1 shadow-xs shrink-0 backdrop-blur-xs text-xs font-bold"
          role="group"
          aria-label="Language selector"
        >
          <button
            type="button"
            onClick={() => {
              if (settings.language !== 'ar') ctxToggleLanguage();
            }}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
              !isEn
                ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="العربية (RTL)"
          >
            AR
          </button>
          <span className="text-slate-300 dark:text-slate-600 text-xs px-0.5 select-none">|</span>
          <button
            type="button"
            onClick={() => {
              if (settings.language !== 'en') ctxToggleLanguage();
            }}
            className={`px-2 py-1 rounded-md text-xs font-bold transition-all duration-150 cursor-pointer ${
              isEn
                ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="English (LTR)"
          >
            EN
          </button>
        </div>

        {/* Desktop Notification Bell */}
        <div className="hidden lg:block relative" ref={notifDropdownRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="relative h-9 w-9 border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer shadow-xs shrink-0 backdrop-blur-xs"
            title={t.notificationsTitle}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Desktop Sentinel Dropdown Panel */}
          {isNotifOpen && (
            <div
              className={`absolute top-full mt-2 w-80 sm:w-96 max-w-[95vw] bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] ${
                isEn ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
              }`}
            >
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {t.notificationsTitle}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {unreadCount > 0
                        ? `${unreadCount} ${isEn ? 'unread alert(s)' : 'تنبيه جديد بحاجة للمتابعة'}`
                        : t.noNotifications}
                    </p>
                  </div>
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-[#174A84] dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{t.markAllRead}</span>
                  </button>
                )}
              </div>

              {/* Notification Filter Pills */}
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 bg-slate-50/40 dark:bg-slate-900/40 overflow-x-auto text-[11px] font-bold">
                {[
                  { id: 'all', label: t.allNotifications, icon: Filter },
                  { id: 'finance', label: t.financeAlerts, icon: DollarSign },
                  { id: 'logistics', label: t.logisticsAlerts, icon: Truck },
                  { id: 'projects', label: t.projectsAlerts, icon: FolderKanban },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = activeCategory === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCategory(tab.id as any)}
                      className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-[#174A84] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Notification Items List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto max-h-[50vh]">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                    <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                    <p className="text-xs font-semibold">{t.noNotifications}</p>
                  </div>
                ) : (
                  filteredNotifications.map((item) => {
                    const isRead = item.isRead;
                    const isCritical = item.severity === 'critical';
                    const isWarning = item.severity === 'warning';

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`p-3 text-start transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2.5 ${
                          !isRead ? 'bg-sky-50/30 dark:bg-sky-950/20' : 'opacity-85'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isCritical
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                              : isWarning
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                              : 'bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {isCritical ? <AlertTriangle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className={`text-xs truncate ${!isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                              {isEn ? item.titleEn || item.title : item.title}
                            </h4>
                            {!isRead && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                            {isEn ? item.messageEn || item.message : item.message}
                          </p>
                          <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.timestamp}
                            </span>
                            <span className="text-[#174A84] dark:text-sky-400 font-bold flex items-center gap-0.5 hover:underline">
                              {isEn ? 'Open' : 'فتح'}
                              <ChevronRight className="w-3 h-3 rtl:rotate-180" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Theme Toggle */}
        <button
          type="button"
          onClick={ctxToggleTheme}
          className="hidden lg:flex h-9 w-9 border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer shadow-xs shrink-0 backdrop-blur-xs"
          title={settings.themeMode === 'dark' ? t.lightMode : t.darkMode}
          aria-label="Toggle theme mode"
        >
          {settings.themeMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
        </button>

        {/* ----------------------------------------------------------- */}
        {/* 3. MOBILE & TABLET EXPANDABLE ARROW TOGGLE BUTTON (lg:hidden) */}
        {/* ----------------------------------------------------------- */}
        <button
          type="button"
          onClick={() => setIsQuickActionsOpen((prev) => !prev)}
          className={`lg:hidden h-9 px-2.5 sm:px-3 rounded-lg border transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
            isQuickActionsOpen
              ? 'bg-emerald-500 text-white border-emerald-600'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
          title="القائمة السريعة والأدوات"
          aria-label="Toggle quick actions menu"
        >
          <span className="text-xs font-bold hidden sm:inline">أدوات</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isQuickActionsOpen ? 'rotate-180 text-white' : 'text-slate-600 dark:text-slate-300'}`} />
          {unreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
          )}
        </button>

        {/* ----------------------------------------------------------- */}
        {/* 4. MOBILE / TABLET FLOATING DROPDOWN SHEET                  */}
        {/* ----------------------------------------------------------- */}
        {isQuickActionsOpen && (
          <div
            className={`lg:hidden absolute top-full mt-2 w-72 sm:w-80 max-w-[92vw] bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in duration-150 ${
              isEn ? 'right-0' : 'left-0'
            }`}
          >
            {/* Mobile Copilot (shown on mobile, since hidden on < md) */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  onOpenCopilot();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-bold flex items-center justify-between shadow-xs cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>{t.copilotBtn}</span>
                </div>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  onOpenGoogleDrive();
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <CloudUpload className="w-4 h-4 text-blue-500" />
                <span className="truncate">{t.driveSyncedBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  onSystemRefresh();
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 text-emerald-500 ${isRefreshingSystem ? 'animate-spin' : ''}`} />
                <span className="truncate">{t.refreshBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  onOpenAiPriceSearch();
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="truncate">{t.priceSearchBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  if (onOpenNotifications) onOpenNotifications();
                }}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-500" />
                  <span className="truncate">{t.notificationsTitle}</span>
                </div>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Bottom Controls Row: Language Switcher & Theme Toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div
                className="h-8 px-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 text-xs font-bold"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (settings.language !== 'ar') ctxToggleLanguage();
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    !isEn ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  AR
                </button>
                <span className="text-slate-300 dark:text-slate-600 text-xs select-none">|</span>
                <button
                  type="button"
                  onClick={() => {
                    if (settings.language !== 'en') ctxToggleLanguage();
                  }}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                    isEn ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  EN
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={ctxToggleTheme}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {settings.themeMode === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t.lightMode}</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-600" />
                      <span>{t.darkMode}</span>
                    </>
                  )}
                </button>

                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickActionsOpen(false);
                      onOpenProfile();
                    }}
                    className="h-8 px-2.5 rounded-lg bg-[#174A84] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>الملف</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
