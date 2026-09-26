import React, { useState, useRef, useEffect } from 'react';
import { User, NotificationItem, ROLE_CONFIGS, UserRole } from '../types';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  Bell,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Search,
  Sparkles,
  Database,
  PenTool,
  CheckCheck,
  ExternalLink,
  AlertTriangle,
  Clock,
  DollarSign,
  Truck,
  Building,
  LogOut,
  ChevronDown,
  Menu,
  Cloud,
  Activity,
  Bot,
  Radio,
} from 'lucide-react';

interface TopHeaderNavProps {
  currentUser: User;
  notifications: NotificationItem[];
  onNotificationClick: (notif: NotificationItem) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenProfile: () => void;
  onOpenAdminRoles: () => void;
  onOpenAiPriceSearch: () => void;
  onOpenBackup: () => void;
  onOpenGoogleDrive?: () => void;
  onOpenSignatures: () => void;
  onOpenPreFlight?: () => void;
  onOpenAutonomousAgents?: () => void;
  onLogout: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopHeaderNav: React.FC<TopHeaderNavProps> = ({
  currentUser,
  notifications,
  onNotificationClick,
  onMarkAllNotificationsRead,
  onOpenProfile,
  onOpenAdminRoles,
  onOpenAiPriceSearch,
  onOpenBackup,
  onOpenGoogleDrive,
  onOpenSignatures,
  onOpenPreFlight,
  onOpenAutonomousAgents,
  onLogout,
  onToggleMobileMenu,
}) => {
  const { store } = useMasterEnterpriseStore();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<'all' | 'invoices' | 'milestones' | 'procurement'>('all');
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const roleConfig = ROLE_CONFIGS[currentUser.role] || ROLE_CONFIGS.viewer;
  const isExecutiveAdmin = currentUser.role === 'admin' || currentUser.role === 'pm';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredNotifs = notifications.filter((n) => {
    if (notifCategoryFilter === 'all') return true;
    return n.category === notifCategoryFilter;
  });

  return (
    <header
      dir="rtl"
      className="no-print top-header-nav bg-[#080E1A] border-b border-slate-800/90 text-slate-100 sticky top-0 z-50 backdrop-blur-md px-3 sm:px-6 py-2.5 shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Side (RTL Start) - Branding & Mobile Toggle */}
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              {store.companyIdentity?.logoUrl ? (
                <img
                  src={store.companyIdentity.logoUrl}
                  alt="Company Logo"
                  className="w-full h-full object-contain p-0.5"
                />
              ) : (
                <Building className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-white font-cairo truncate">
                  {store.companyIdentity?.officialArabicName || 'شركة صناع الموارد التجاريه'} - RMT
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  MEP OS
                </span>
              </div>
              <p className="hidden md:block text-[10px] text-slate-400 truncate">
                منظومة المتابعة الذكية وإدارة المشاريع والمشتريات
              </p>
            </div>
          </div>
        </div>

        {/* Right Side (RTL End) - Actions, Smart Notifications, Admin Gateway & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Utility Tools */}
          <div className="hidden xl:flex items-center gap-1.5 border-l border-slate-800 pl-3">
            {onOpenAutonomousAgents && (
              <button
                type="button"
                onClick={onOpenAutonomousAgents}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="الوكلاء المستقلون وبوت التليجرام (Telegram Autonomous AI)"
              >
                <Bot className="w-3.5 h-3.5 text-amber-400" />
                <span>بوت التليجرام والوكلاء</span>
              </button>
            )}
            {onOpenGoogleDrive && (
              <button
                type="button"
                onClick={onOpenGoogleDrive}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="مزامنة وتخزين سحابي مباشر على Google Drive"
              >
                <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Google Drive</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenBackup}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="النسخ الاحتياطي والاستعادة"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>النسخ الاحتياطي</span>
            </button>
            {onOpenPreFlight && (
              <button
                type="button"
                onClick={onOpenPreFlight}
                className="px-2.5 py-1.5 rounded-lg bg-teal-950/40 hover:bg-teal-900/60 border border-teal-500/40 text-teal-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="فحص سلامة النظام والتحقق قبل النشر (Pre-Flight Audit & Self-Healing)"
              >
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                <span>فحص النظام</span>
              </button>
            )}
          </div>

          {/* 1. Smart Notifications Bell */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              type="button"
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 text-slate-300 hover:text-white transition relative cursor-pointer"
              title="مركز التنبيهات والمواعيد الذكية"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-[#080E1A] animate-pulse shadow-md">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Smart Notifications Rich Dropdown Menu */}
            {showNotifDropdown && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-[#0B1329] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 text-right">
                {/* Header */}
                <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#0F2338] to-[#0B1329]">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black text-white">مركز التنبيهات الذكي</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-2 py-0.2 bg-red-500/20 text-red-300 rounded-full font-bold border border-red-500/30">
                        {unreadCount} غير مقروء
                      </span>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>تحديد الكل كمقروء</span>
                    </button>
                  )}
                </div>

                {/* Category Filters */}
                <div className="p-2 border-b border-slate-800 bg-slate-900/50 flex items-center gap-1 overflow-x-auto text-[11px]">
                  <button
                    type="button"
                    onClick={() => setNotifCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                      notifCategoryFilter === 'all'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    الكل ({notifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifCategoryFilter('invoices')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                      notifCategoryFilter === 'invoices'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    الفواتير
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifCategoryFilter('procurement')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                      notifCategoryFilter === 'procurement'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    المشتريات والتوريد
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifCategoryFilter('milestones')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                      notifCategoryFilter === 'milestones'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    المواعيد والتسليم
                  </button>
                </div>

                {/* Notification Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                  {filteredNotifs.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      لا توجد تنبيهات جديدة في هذا القسم
                    </div>
                  ) : (
                    filteredNotifs.map((notif) => {
                      const isCritical = notif.severity === 'critical';
                      const isWarning = notif.severity === 'warning';

                      return (
                        <div
                          key={notif.id}
                          onClick={() => {
                            onNotificationClick(notif);
                            setShowNotifDropdown(false);
                          }}
                          className={`p-3 hover:bg-slate-900/90 transition cursor-pointer flex items-start gap-2.5 ${
                            !notif.isRead ? 'bg-slate-900/40' : ''
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {notif.category === 'invoices' ? (
                              <DollarSign className={`w-4 h-4 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
                            ) : notif.category === 'procurement' ? (
                              <Truck className={`w-4 h-4 ${isCritical ? 'text-red-400' : 'text-blue-400'}`} />
                            ) : (
                              <Clock className={`w-4 h-4 ${isCritical ? 'text-red-400' : 'text-teal-400'}`} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-xs font-bold text-white truncate">
                                {notif.title}
                              </span>
                              {!notif.isRead && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                              {notif.message}
                            </p>
                            <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 font-mono">
                              <span>{notif.timestamp}</span>
                              <span className="text-emerald-400 font-bold hover:underline flex items-center gap-0.5">
                                عرض التفاصيل
                                <ExternalLink className="w-2.5 h-2.5" />
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

          {/* 2. Admin Permissions & Pre-Flight Gateway Icon (Strictly for admin and pm) */}
          {isExecutiveAdmin && (
            <>
              {onOpenPreFlight && (
                <button
                  type="button"
                  onClick={onOpenPreFlight}
                  className="xl:hidden p-2 rounded-xl bg-slate-900/90 hover:bg-teal-950/50 border border-slate-700/80 hover:border-teal-500/60 text-teal-400 hover:text-teal-300 transition cursor-pointer"
                  title="فحص سلامة النظام والتحقق قبل النشر (Pre-Flight Audit)"
                >
                  <Activity className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAdminRoles}
                className="p-2 rounded-xl bg-slate-900/90 hover:bg-emerald-950/50 border border-slate-700/80 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 transition cursor-pointer relative group flex items-center gap-1.5"
                title="إدارة الصلاحيات والمستخدمين (Super Admin Gateway)"
              >
                <ShieldCheck className="w-5 h-5" />
                <span className="hidden md:inline-block text-xs font-bold">الصلاحيات</span>
              </button>
            </>
          )}

          {/* 3. User Profile Icon & Details */}
          <div
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition cursor-pointer"
          >
            <div className="relative">
              <img
                src={
                  currentUser.avatarUrl ||
                  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
                }
                alt={currentUser.fullName}
                className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#080E1A]" />
            </div>

            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-white max-w-[130px] truncate">
                {currentUser.fullName}
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${roleConfig.badgeClass}`}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
          </div>
        </div>
      </div>
    </header>
  );
};
