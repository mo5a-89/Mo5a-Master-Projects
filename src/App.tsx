import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Customer,
  CustomerQuotation,
  Project,
  PurchaseOrder,
  Supplier,
  SupplierQuotation,
  TermsLibraryItem,
  Invoice,
  DeliveryNote,
  InvoicePayment,
  ItemDeliveryStatus,
  PricedItemRecord,
  QuotationItem,
  QuotationAdditionalCosts,
  MaterialReceiptRecord,
  ClientContractPO,
  POPaymentRecord,
  User,
  NotificationItem,
  UserRole,
  ROLE_CONFIGS,
  ClientMaster,
  ThreeWayMatchRecord,
  QuotationEstimate,
} from './types';
import {
  COMPANY_PROFILE,
  INITIAL_CUSTOMERS,
  INITIAL_CUSTOMER_QUOTATIONS,
  INITIAL_PROJECTS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_QUOTATIONS,
  INITIAL_TERMS_LIBRARY,
  INITIAL_INVOICES,
  INITIAL_DELIVERY_NOTES,
  INITIAL_CLIENT_MASTERS,
  INITIAL_THREE_WAY_MATCHES,
} from './data/initialData';
import { DashboardView } from './components/DashboardView';
import { ProjectsView } from './components/ProjectsView';
import { InvoicesAccountingView } from './components/InvoicesAccountingView';
import { CustomerQuotationEditor } from './components/CustomerQuotationEditor';
import { useSettings } from './context/SettingsContext';
import { QuotationsView } from './components/QuotationsView';
import { PurchaseOrdersView } from './components/PurchaseOrdersView';
import { PurchaseOrderModal } from './components/PurchaseOrderModal';
import { DirectoryView } from './components/DirectoryView';
import { TermsLibraryView } from './components/TermsLibraryView';
import { UploadSupplierQuotationModal } from './components/UploadSupplierQuotationModal';
import { SupplierQuotationsView } from './components/SupplierQuotationsView';
import { BusinessCardModal } from './components/BusinessCardModal';
import { ProjectStatusBreakdownView } from './components/ProjectStatusBreakdownView';
import { ProcurementHub } from './components/ProcurementHub';
import { SiteLogisticsHub } from './components/SiteLogisticsHub';
import { EstimatingWorkbenchView } from './components/EstimatingWorkbenchView';
import { CashFlowSentinelView } from './components/CashFlowSentinelView';
import { AutonomousAgentsHub } from './components/AutonomousAgentsHub';
import { ThreeWayMatchingModal } from './components/ThreeWayMatchingModal';
import { ClientMasterDirectoryModal } from './components/ClientMasterDirectoryModal';
import { RmtCopilotDrawer } from './components/RmtCopilotDrawer';
import { AuditTrailModal } from './components/AuditTrailModal';
import { SystemSettingsView } from './components/SystemSettingsView';
import { LoginScreen } from './components/LoginScreen';
import { TopHeaderNav } from './components/TopHeaderNav';
import { UserProfileModal } from './components/UserProfileModal';
import { AdminRoleManagementModal } from './components/AdminRoleManagementModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { CompanyLogo } from './components/CompanyHeader';
import { ProjectOutcome } from './utils/projectStatusUtils';
import { calculateQuotationTotals } from './utils/quotationUtils';
import { repairDeliveryNoteSequences, purgeDeletedRecords, invalidateAndResetSequenceCache } from './utils/invoiceUtils';
import {
  loadCentralizedData,
  scheduleCentralizedSync,
  syncCentralizedImmediate,
  subscribeSyncStatus,
  SyncStatus,
  broadcastMultiTabSync,
  subscribeMultiTabSync,
} from './utils/syncService';
import {
  loadArchivedPricedItems,
  saveArchivedPricedItems,
  archiveItemsFromCustomerQuotation,
  archiveItemsFromSupplierQuotation,
} from './utils/pricedItemsUtils';
import {
  getStoredUser,
  saveAuthSession,
  clearAuthSession,
  getAllUsers,
} from './utils/authService';
import { validateSessionToken, purgeSession, hasPermission as hasEnterprisePermission } from './security/AuthSecurity';
import {
  generateSentinelNotifications,
  filterNotificationsByCategory,
  getReadNotificationIds,
  saveReadNotificationIds,
} from './services/notificationSentinel';
import {
  fetchCloudDatabase,
  saveToCloudDatabase,
} from './services/cloudDriveSync';
import { Sidebar } from './components/Sidebar';
import { parseUrlRoute, syncUrlRoute, getDefaultLandingTabForRole, getPlatformBaseUrl } from './utils/dynamicRouter';
import { isSuperAdmin, canAccessTab, canAccessPillar, hasPermission, isExecutiveAdmin } from './utils/rbacUtils';
import { getNavigationLabels, NavigationLabels } from './utils/navigationConfig';
import { getTranslation } from './locales/translations';
import { useMasterEnterpriseStore } from './store/masterEnterpriseStore';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  ShoppingBag,
  Users,
  Building,
  BookOpen,
  Upload,
  CreditCard,
  Plus,
  ShieldCheck,
  CheckCircle,
  Menu,
  X,
  BarChart3,
  Trophy,
  Receipt,
  Tag,
  Sparkles,
  FileSpreadsheet,
  Database,
  PenTool,
  Truck,
  Layers,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Bell,
  DollarSign,
  FolderKanban,
  CheckCheck,
  AlertTriangle,
  Info,
  Clock,
  Filter,
  Bot,
  Sun,
  Moon,
  LogOut,
  CloudUpload,
  History,
  ShieldAlert,
  RefreshCw,
  FolderTree,
  Settings,
  Activity,
} from 'lucide-react';
import { AiPriceSearchModal } from './components/AiPriceSearchModal';
import { DataBackupModal } from './components/DataBackupModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { PreFlightModal } from './components/PreFlightModal';
import { SignaturesManagementModal } from './components/SignaturesManagementModal';
import { CreateProjectInvoiceModal } from './components/CreateProjectInvoiceModal';
import { M5ModeButton } from './components/m5/M5ModeButton';
import { normalizeProject, getSafeRetentionPercent, calculateRetentionFigures } from './utils/projectValidation';
import { autoSanitizeLocalStorage } from './utils/storagePurgeFallback';
import { createCheckpoint } from './utils/snapshotManager';
import { sanitizeAppState } from './utils/dataSanitizer';
import { validateDeliveryNoteStock, reconcileSiteStock } from './services/inventoryLedger';
import {
  initGoogleDriveAuth,
  saveStateToGoogleDrive,
  getGoogleDriveAccessToken,
  autoBootstrapDriveHydration,
  scheduleGoogleDriveAutoSync,
} from './utils/googleDriveSync';
import {
  getMasterEnterpriseState,
  commitMasterEnterpriseState,
} from './store/masterEnterpriseStore';

// Complete Clean Slate Migration: Wipe all demo transactions & operational logs
if (typeof window !== 'undefined') {
  const IS_CLEANED = localStorage.getItem('rmt_clean_slate_v1');
  if (!IS_CLEANED) {
    const keysToRemove = [
      'rmt_projects',
      'rmt_pos',
      'rmt_purchase_orders',
      'rmt_invoices',
      'rmt_delivery_notes',
      'rmt_boq_items',
      'rmt_quotations',
      'rmt_customer_quotations',
      'rmt_supplier_quotations',
      'rmt_audit_logs',
      'rmt_activity_logs',
      'rmt_client_masters',
      'rmt_three_way_matches',
      'rmt_quotation_estimates',
      'rmt_payments',
      'rmt_customers',
      'rmt_suppliers',
      'rmt_project_plans',
      'rmt_stock_transfers',
      'rmt_transactions',
      'rmt_cash_flows',
      'rmt_grns',
      'rmt_payment_receipts',
      'rmt_m5_data',
      'rmt_execution_logs',
      'rmt_rfqs',
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('rmt_clean_slate_v1', 'true');
  }
}

export function App() {
  const { store } = useMasterEnterpriseStore();
  // Authentication & RBAC User State
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isAdminRolesOpen, setIsAdminRolesOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_read_notifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Navigation State - Defaults to 'dashboard' (لوحة التحكم) on any refresh or reload
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'projects'
    | 'procurement_mgmt'
    | 'estimating_workbench'
    | 'cash_flow_sentinel'
    | 'invoices'
    | 'quotations'
    | 'purchase_orders'
    | 'suppliers'
    | 'customers'
    | 'directory'
    | 'terms'
    | 'status_breakdown'
    | 'supplier_quotations'
    | 'site_logistics'
    | 'autonomous_agents'
    | 'settings'
  >('dashboard');

  // Client Master Records (SAP-grade Foreign Key References)
  const [clientMasters, setClientMasters] = useState<ClientMaster[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_client_masters');
      return saved ? JSON.parse(saved) : INITIAL_CLIENT_MASTERS;
    } catch {
      return INITIAL_CLIENT_MASTERS;
    }
  });

  // 3-Way Match Audit Records
  const [threeWayMatches, setThreeWayMatches] = useState<ThreeWayMatchRecord[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_three_way_matches');
      return saved ? JSON.parse(saved) : INITIAL_THREE_WAY_MATCHES;
    } catch {
      return INITIAL_THREE_WAY_MATCHES;
    }
  });

  // Quotation Estimates (Multi-vendor RFQ Matrix)
  const [estimates, setEstimates] = useState<QuotationEstimate[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_quotation_estimates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isThreeWayModalOpen, setIsThreeWayModalOpen] = useState(false);
  const [isClientMasterModalOpen, setIsClientMasterModalOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { settings, toggleTheme, toggleLanguage, setLanguage: ctxSetLanguage } = useSettings();
  const isDarkMode = settings.themeMode === 'dark';
  const currentLang = settings.language;
  const t = useMemo(() => getTranslation(currentLang), [currentLang]);

  const [navLabels, setNavLabels] = useState<NavigationLabels>(() => getNavigationLabels(settings.language));
  const [statusBreakdownInitialFilter, setStatusBreakdownInitialFilter] = useState<ProjectOutcome | 'all'>('all');
  const [isModernView, setIsModernView] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rmt_m5_mode');
      return saved !== null ? saved === 'true' : false; // Standard theme by default
    } catch {
      return false;
    }
  });

  const setLanguage = (lang: 'ar' | 'en') => {
    ctxSetLanguage(lang);
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isRefreshingSystem, setIsRefreshingSystem] = useState(false);
  const [isHeaderNotifOpen, setIsHeaderNotifOpen] = useState(false);
  const [isHeaderControlsOpen, setIsHeaderControlsOpen] = useState(false);
  const [headerNotifCategory, setHeaderNotifCategory] = useState<'all' | 'finance' | 'logistics' | 'projects'>('all');
  const headerNotifRef = useRef<HTMLDivElement | null>(null);
  const headerControlsRef = useRef<HTMLDivElement | null>(null);

  // Dynamic font engine initialization on app mount
  useEffect(() => {
    try {
      const savedFont = localStorage.getItem('rmt_font_family') || 'Cairo';
      let fontCSS = "'Cairo', sans-serif";
      if (savedFont === 'Alexandria') fontCSS = "'Alexandria', sans-serif";
      else if (savedFont === 'Almarai') fontCSS = "'Almarai', sans-serif";
      else if (savedFont === 'Tajawal') fontCSS = "'Tajawal', sans-serif";
      else if (savedFont === 'IBM Plex Sans Arabic') fontCSS = "'IBM Plex Sans Arabic', sans-serif";
      else if (savedFont === 'Cairo') fontCSS = "'Cairo', sans-serif";

      document.documentElement.style.fontFamily = fontCSS;
      document.body.style.fontFamily = fontCSS;
      document.documentElement.style.setProperty('--app-font-family', fontCSS);
    } catch (e) {
      console.warn('Font initialization error:', e);
    }
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (headerNotifRef.current && !headerNotifRef.current.contains(e.target as Node)) {
        setIsHeaderNotifOpen(false);
      }
      if (headerControlsRef.current && !headerControlsRef.current.contains(e.target as Node)) {
        setIsHeaderControlsOpen(false);
      }
    };
    if (isHeaderNotifOpen || isHeaderControlsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isHeaderNotifOpen, isHeaderControlsOpen]);

  // Sync navigation labels live from custom events, storage, or language change
  useEffect(() => {
    const handleNavUpdate = (e?: any) => {
      if (e?.detail?.labels) {
        setNavLabels(e.detail.labels);
      } else if (e?.detail && !e.detail.labels && typeof e.detail === 'object' && 'pillars' in e.detail) {
        setNavLabels(e.detail);
      } else {
        setNavLabels(getNavigationLabels(settings.language));
      }
    };
    window.addEventListener('rmt_navigation_labels_updated', handleNavUpdate);
    window.addEventListener('storage', handleNavUpdate);

    const handleSystemResetToZero = () => {
      setProjects([]);
      setCustomerQuotations([]);
      setSupplierQuotations([]);
      setPurchaseOrders([]);
      setInvoices([]);
      setDeliveryNotes([]);
      setClientMasters([]);
      setThreeWayMatches([]);
      setEstimates([]);
      setSelectedProjectId(null);
      setSelectedQuotationId(null);
    };
    window.addEventListener('rmt_system_reset_to_zero', handleSystemResetToZero);

    setNavLabels(getNavigationLabels(settings.language));
    return () => {
      window.removeEventListener('rmt_navigation_labels_updated', handleNavUpdate);
      window.removeEventListener('storage', handleNavUpdate);
      window.removeEventListener('rmt_system_reset_to_zero', handleSystemResetToZero);
    };
  }, [settings.language]);

  // Multi-Tab Real-Time State Synchronization and Snapshot Listener
  useEffect(() => {
    const handleSnapshotImported = (e: any) => {
      if (e?.detail) {
        const d = e.detail;
        if (Array.isArray(d.projects)) setProjects(d.projects);
        if (Array.isArray(d.customerQuotations)) setCustomerQuotations(d.customerQuotations);
        if (Array.isArray(d.supplierQuotations)) setSupplierQuotations(d.supplierQuotations);
        if (Array.isArray(d.purchaseOrders)) setPurchaseOrders(d.purchaseOrders);
        if (Array.isArray(d.invoices)) setInvoices(d.invoices);
        if (Array.isArray(d.deliveryNotes)) setDeliveryNotes(d.deliveryNotes);
        if (Array.isArray(d.customers)) setCustomers(d.customers);
        if (Array.isArray(d.suppliers)) setSuppliers(d.suppliers);
        if (Array.isArray(d.termsLibrary)) setTermsLibrary(d.termsLibrary);
        showToast('تمت استعادة ومزامنة بيانات النسخة الاحتياطية بنجاح!');
      }
    };
    window.addEventListener('rmt_snapshot_imported', handleSnapshotImported);

    const unsubscribeMultiTab = subscribeMultiTabSync((msg) => {
      if (msg.type === 'USER_UPDATED' && msg.data) {
        setCurrentUser(msg.data);
      } else if (msg.type === 'AUTH_LOGOUT') {
        setCurrentUser(null);
      } else if (msg.type === 'PROJECT_PATCHED' && msg.data?.id && msg.data?.patch) {
        const { id, patch } = msg.data;
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p))
        );
      } else if (msg.type === 'SNAPSHOT_IMPORTED' && msg.data) {
        handleSnapshotImported({ detail: msg.data });
      }
    });

    return () => {
      window.removeEventListener('rmt_snapshot_imported', handleSnapshotImported);
      unsubscribeMultiTab();
    };
  }, []);

  // Strict RBAC route protection: redirect unauthorized tabs to allowed role home
  useEffect(() => {
    if (currentUser && !canAccessTab(currentUser, activeTab)) {
      const safeTab = getDefaultLandingTabForRole(currentUser.role);
      setActiveTab(safeTab as any);
      showToast(
        currentLang === 'en'
          ? "Redirected to authorized portal based on your role."
          : "تم توجيهك تلقائياً إلى بوابتك المصرح بها وفق صلاحيات رتبتك."
      );
    }
  }, [currentUser, activeTab, currentLang]);



  useEffect(() => {
    try {
      localStorage.setItem('rmt_m5_mode', String(isModernView));
    } catch {}
  }, [isModernView]);

  const handleSystemRefresh = async () => {
    setIsRefreshingSystem(true);
    showToast('جاري تحديث بيانات المنظومة والمزامنة مع السحابة...');
    try {
      await syncCentralizedImmediate(
        {
          projects,
          customerQuotations,
          supplierQuotations,
          purchaseOrders,
          invoices,
          deliveryNotes,
          customers,
          suppliers,
          termsLibrary,
        },
        'تحديث يدوي للمنظومة'
      );
    } catch (e) {
      console.warn('Manual refresh notice:', e);
    }
    setTimeout(() => {
      setIsRefreshingSystem(false);
      showToast('تم تحديث المنظومة ومزامنة السجلات بنجاح');
    }, 700);
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
    setIsUserProfileOpen(false);
  };

  const handleLoginSuccess = (user: User, token: string) => {
    saveAuthSession(user, token);
    setCurrentUser(user);
    // Dynamic Role-based direct routing
    const requestedRoute = parseUrlRoute();
    if (requestedRoute.tab && canAccessTab(user, requestedRoute.tab)) {
      setActiveTab(requestedRoute.tab as any);
      if (requestedRoute.projectId) setSelectedProjectId(requestedRoute.projectId);
      if (requestedRoute.quotationId) setSelectedQuotationId(requestedRoute.quotationId);
    } else {
      const defaultLanding = getDefaultLandingTabForRole(user.role);
      setActiveTab(defaultLanding as any);
    }
  };

  // Enterprise Session Expiry & State Mutation Guard
  useEffect(() => {
    if (!currentUser) return;

    const checkSessionIntegrity = () => {
      const validation = validateSessionToken();
      if (!validation.isValid) {
        clearAuthSession();
        setCurrentUser(null);
        showToast(
          currentLang === 'en'
            ? 'Security session expired or invalidated. Please log in again.'
            : 'انتهت صلاحية جلسة العمل الأمنية أو تم إبطال الرمز، يرجى تسجيل الدخول مجدداً.'
        );
      }
    };

    // Immediate check on activeTab change / mount
    checkSessionIntegrity();

    // Periodic watchdog timer
    const watchdog = setInterval(checkSessionIntegrity, 30000);
    return () => clearInterval(watchdog);
  }, [activeTab, currentUser, currentLang]);

  // Selected Entities State - starts clean as null to view all projects/quotations list
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  // Keep browser URL synchronized with active view and selected entity without reload
  useEffect(() => {
    if (!currentUser) return;
    syncUrlRoute({
      tab: activeTab,
      projectId: selectedProjectId,
      quotationId: selectedQuotationId,
    });
  }, [activeTab, selectedProjectId, selectedQuotationId, currentUser]);

  // Handle browser navigation back/forward (PopState & HashChange)
  useEffect(() => {
    const handleBrowserNav = () => {
      if (!currentUser) return;
      const route = parseUrlRoute();
      if (route.tab && canAccessTab(currentUser, route.tab)) {
        setActiveTab(route.tab as any);
        if (route.projectId !== undefined) setSelectedProjectId(route.projectId);
        if (route.quotationId !== undefined) setSelectedQuotationId(route.quotationId);
      }
    };
    window.addEventListener('popstate', handleBrowserNav);
    window.addEventListener('hashchange', handleBrowserNav);
    return () => {
      window.removeEventListener('popstate', handleBrowserNav);
      window.removeEventListener('hashchange', handleBrowserNav);
    };
  }, [currentUser]);

  // On initial mount / session restore: inspect deep link
  useEffect(() => {
    if (!currentUser) return;
    const initialRoute = parseUrlRoute();
    if (initialRoute.tab && canAccessTab(currentUser, initialRoute.tab)) {
      setActiveTab(initialRoute.tab as any);
      if (initialRoute.projectId) setSelectedProjectId(initialRoute.projectId);
      if (initialRoute.quotationId) setSelectedQuotationId(initialRoute.quotationId);
    } else if (!canAccessTab(currentUser, activeTab)) {
      setActiveTab(getDefaultLandingTabForRole(currentUser.role) as any);
    }
  }, [currentUser]);

  // Modals
  const [isUploadSupplierOpen, setIsUploadSupplierOpen] = useState(false);
  const [isAiPriceSearchOpen, setIsAiPriceSearchOpen] = useState(false);
  const [isBusinessCardOpen, setIsBusinessCardOpen] = useState(false);
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState(false);
  const [isSignaturesModalOpen, setIsSignaturesModalOpen] = useState(false);
  const [isPreFlightOpen, setIsPreFlightOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [poTargetProjectId, setPoTargetProjectId] = useState<string | undefined>(undefined);
  const [poSourceSupplierQuoteId, setPoSourceSupplierQuoteId] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<string | null>(null);

  // Core Data State (Loaded with initial contracting records and normalized)
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_projects');
      const loaded: Project[] = saved ? JSON.parse(saved) : INITIAL_PROJECTS;
      return (loaded || []).map((p) => normalizeProject(p));
    } catch {
      return INITIAL_PROJECTS.map((p) => normalizeProject(p));
    }
  });

  const [customerQuotations, setCustomerQuotations] = useState<CustomerQuotation[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_customer_quotations');
      const loaded: CustomerQuotation[] = saved ? JSON.parse(saved) : INITIAL_CUSTOMER_QUOTATIONS;
      return (loaded || []).map((q) => ({
        ...q,
        items: q.items || [],
        selectedSystems: q.selectedSystems || [],
        terms: {
          includes: q.terms?.includes || [],
          excludes: q.terms?.excludes || [],
          paymentTerms: q.terms?.paymentTerms || [],
          validity: q.terms?.validity || '15 days',
          notes: q.terms?.notes || [],
        },
        additionalCosts: q.additionalCosts || {
          procurement: 0,
          installation: 0,
          transportation: 0,
          testingAndCommissioning: 0,
          engineering: 0,
          manpower: 0,
          contingency: 0,
          otherDirectCosts: 0,
        },
        totals: q.totals || {
          totalSupplierCost: 0,
          totalAdditionalCosts: 0,
          totalProjectCost: 0,
          customerSellingPrice: 0,
          grossProfit: 0,
          grossMarginPercent: 0,
          vatPercent: 15,
          vatAmount: 0,
          grandTotalWithVat: 0,
        },
      }));
    } catch {
      return INITIAL_CUSTOMER_QUOTATIONS;
    }
  });

  const [supplierQuotations, setSupplierQuotations] = useState<SupplierQuotation[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_supplier_quotations');
      const loaded: SupplierQuotation[] = saved ? JSON.parse(saved) : INITIAL_SUPPLIER_QUOTATIONS;
      return (loaded || []).map((sq) => ({
        ...sq,
        items: sq.items || [],
        exclusions: sq.exclusions || [],
        technicalNotes: sq.technicalNotes || [],
        commercialConditions: sq.commercialConditions || [],
      }));
    } catch {
      return INITIAL_SUPPLIER_QUOTATIONS;
    }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_customers');
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    } catch {
      return INITIAL_CUSTOMERS;
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_suppliers');
      const loaded: Supplier[] = saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
      return (loaded || []).map((s) => ({
        ...s,
        systems: s.systems || [],
        brands: s.brands || [],
      }));
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [termsLibrary, setTermsLibrary] = useState<TermsLibraryItem[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_terms_library');
      const loaded: TermsLibraryItem[] = saved ? JSON.parse(saved) : INITIAL_TERMS_LIBRARY;
      return (loaded || []).map((t) => ({
        ...t,
        includes: t.includes || [],
        excludes: t.excludes || [],
      }));
    } catch {
      return INITIAL_TERMS_LIBRARY;
    }
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_purchase_orders');
      const loaded: PurchaseOrder[] = saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
      return loaded || INITIAL_PURCHASE_ORDERS;
    } catch {
      return INITIAL_PURCHASE_ORDERS;
    }
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_invoices');
      const loaded: Invoice[] = saved ? JSON.parse(saved) : INITIAL_INVOICES;
      return loaded || INITIAL_INVOICES;
    } catch {
      return INITIAL_INVOICES;
    }
  });

  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>(() => {
    try {
      const saved = localStorage.getItem('rmt_delivery_notes');
      const loaded: DeliveryNote[] = saved ? JSON.parse(saved) : INITIAL_DELIVERY_NOTES;
      const normalized = (loaded || INITIAL_DELIVERY_NOTES).map((dn) => ({
        ...dn,
        dispatchedByName:
          dn.dispatchedByName && dn.dispatchedByName !== 'مؤسسة صناع الموارد التجارية'
            ? dn.dispatchedByName
            : 'Medhat Al Brahim',
      }));
      return repairDeliveryNoteSequences(normalized);
    } catch {
      return repairDeliveryNoteSequences(INITIAL_DELIVERY_NOTES);
    }
  });

  // Preserved Priced Items History (archived upon quotation/project deletion)
  const [archivedPricedItems, setArchivedPricedItems] = useState<PricedItemRecord[]>(() =>
    loadArchivedPricedItems()
  );

  // Active item when issuing a PO directly from Priced Items library
  const [prefillPricedItem, setPrefillPricedItem] = useState<PricedItemRecord | null>(null);

  // Global Invoice Modal Config (for triggering invoice creation from anywhere, e.g. Delivery Notes)
  const [invoiceModalConfig, setInvoiceModalConfig] = useState<{
    isOpen: boolean;
    project?: Project;
    initialSelectedDeliveryNoteIds?: string[];
  }>({ isOpen: false });

  // Live Centralized Database Connection Status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: true,
    lastSyncedAt: null,
    syncing: false,
    error: null,
    snapshotsCount: 0,
  });

  // Generate Smart System Notifications (State-Reactive Notification Sentinel)
  const smartNotifications = useMemo(() => {
    const generated = generateSentinelNotifications({
      projects,
      invoices,
      purchaseOrders,
      deliveryNotes,
    });
    return generated.map((n) => ({
      ...n,
      isRead: readNotifIds.includes(n.id) || n.isRead,
    }));
  }, [projects, invoices, purchaseOrders, deliveryNotes, readNotifIds]);

  // Subscribe to live sync connection status & Run automated storage sanitation
  useEffect(() => {
    const handleStorageUpdate = () => {
      try {
        const rawProj = localStorage.getItem('rmt_projects');
        if (rawProj) {
          const loadedProj = JSON.parse(rawProj);
          if (Array.isArray(loadedProj)) {
            setProjects(loadedProj.map((p) => normalizeProject(p)));
          }
        }
        const rawQuotes = localStorage.getItem('rmt_customer_quotations');
        if (rawQuotes) {
          const loadedQuotes = JSON.parse(rawQuotes);
          if (Array.isArray(loadedQuotes)) {
            setCustomerQuotations(loadedQuotes);
          }
        }
        const rawPOs = localStorage.getItem('rmt_purchase_orders');
        if (rawPOs) {
          const loadedPOs = JSON.parse(rawPOs);
          if (Array.isArray(loadedPOs)) {
            setPurchaseOrders(loadedPOs);
          }
        }
      } catch (e) {
        console.warn('Error reloading storage state in App.tsx:', e);
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('rmt_projects_updated', handleStorageUpdate);
    window.addEventListener('rmt_quotations_updated', handleStorageUpdate);
    window.addEventListener('rmt_pos_updated', handleStorageUpdate);
    window.addEventListener('rmt_store_updated', handleStorageUpdate);
    window.addEventListener('rmt_cloud_sync_merged', handleStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('rmt_projects_updated', handleStorageUpdate);
      window.removeEventListener('rmt_quotations_updated', handleStorageUpdate);
      window.removeEventListener('rmt_pos_updated', handleStorageUpdate);
      window.removeEventListener('rmt_store_updated', handleStorageUpdate);
      window.removeEventListener('rmt_cloud_sync_merged', handleStorageUpdate);
    };
  }, []);
  useEffect(() => {
    try {
      autoSanitizeLocalStorage();
      // Execute Root Relational Data Sanitization & Self-Healing on local storage
      const rawProjects = localStorage.getItem('rmt_projects');
      const rawQuotes = localStorage.getItem('rmt_customer_quotations');
      const rawSuppQuotes = localStorage.getItem('rmt_supplier_quotations');
      const rawPOs = localStorage.getItem('rmt_purchase_orders');
      const rawInvoices = localStorage.getItem('rmt_invoices');
      const rawDNs = localStorage.getItem('rmt_delivery_notes');

      const appData = {
        projects: rawProjects ? JSON.parse(rawProjects) : projects,
        customerQuotations: rawQuotes ? JSON.parse(rawQuotes) : customerQuotations,
        supplierQuotations: rawSuppQuotes ? JSON.parse(rawSuppQuotes) : supplierQuotations,
        purchaseOrders: rawPOs ? JSON.parse(rawPOs) : purchaseOrders,
        invoices: rawInvoices ? JSON.parse(rawInvoices) : invoices,
        deliveryNotes: rawDNs ? JSON.parse(rawDNs) : deliveryNotes,
      };

      const { sanitizedData, report } = sanitizeAppState(appData);
      if (!report.isClean) {
        setProjects(sanitizedData.projects.map((p) => normalizeProject(p)));
        setCustomerQuotations(sanitizedData.customerQuotations);
        setSupplierQuotations(sanitizedData.supplierQuotations);
        setPurchaseOrders(sanitizedData.purchaseOrders);
        setInvoices(sanitizedData.invoices);
        setDeliveryNotes(repairDeliveryNoteSequences(sanitizedData.deliveryNotes));
      }
    } catch (e) {
      console.warn('Storage auto-sanitize notice:', e);
    }
    return subscribeSyncStatus((st) => setSyncStatus(st));
  }, []);

  // Initial Load from Centralized Server Database
  useEffect(() => {
    let isMounted = true;
    loadCentralizedData().then((centralized) => {
      if (!isMounted || !centralized) return;
      // Sanitize centralized payload
      const sanitizedCentral = sanitizeAppState(centralized).sanitizedData;

      if (sanitizedCentral.projects && Array.isArray(sanitizedCentral.projects)) {
        setProjects(sanitizedCentral.projects.map((p: any) => normalizeProject(p)));
      }
      if (sanitizedCentral.customerQuotations && Array.isArray(sanitizedCentral.customerQuotations)) {
        setCustomerQuotations(sanitizedCentral.customerQuotations);
      }
      if (sanitizedCentral.supplierQuotations && Array.isArray(sanitizedCentral.supplierQuotations)) {
        setSupplierQuotations(sanitizedCentral.supplierQuotations);
      }
      if (sanitizedCentral.purchaseOrders && Array.isArray(sanitizedCentral.purchaseOrders)) {
        setPurchaseOrders(sanitizedCentral.purchaseOrders);
      }
      if (sanitizedCentral.invoices && Array.isArray(sanitizedCentral.invoices)) {
        setInvoices(sanitizedCentral.invoices);
      }
      if (sanitizedCentral.deliveryNotes && Array.isArray(sanitizedCentral.deliveryNotes)) {
        setDeliveryNotes(repairDeliveryNoteSequences(sanitizedCentral.deliveryNotes));
      }
      if (sanitizedCentral.customers && Array.isArray(sanitizedCentral.customers)) {
        setCustomers(sanitizedCentral.customers);
      }
      if (sanitizedCentral.suppliers && Array.isArray(sanitizedCentral.suppliers)) {
        setSuppliers(sanitizedCentral.suppliers);
      }
      if (sanitizedCentral.termsLibrary && Array.isArray(sanitizedCentral.termsLibrary)) {
        setTermsLibrary(sanitizedCentral.termsLibrary);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync to LocalStorage for offline cache & Schedule Centralized Sync to Server
  useEffect(() => {
    saveArchivedPricedItems(archivedPricedItems);
  }, [archivedPricedItems]);

  useEffect(() => {
    localStorage.setItem('rmt_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('rmt_customer_quotations', JSON.stringify(customerQuotations));
  }, [customerQuotations]);

  useEffect(() => {
    localStorage.setItem('rmt_supplier_quotations', JSON.stringify(supplierQuotations));
  }, [supplierQuotations]);

  useEffect(() => {
    localStorage.setItem('rmt_purchase_orders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  useEffect(() => {
    localStorage.setItem('rmt_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('rmt_delivery_notes', JSON.stringify(deliveryNotes));
  }, [deliveryNotes]);

  useEffect(() => {
    localStorage.setItem('rmt_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('rmt_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('rmt_terms_library', JSON.stringify(termsLibrary));
  }, [termsLibrary]);

  // Push to Centralized Database with automated PITR snapshotting & Multi-User Cloud Sync
  useEffect(() => {
    const masterSettings = getMasterEnterpriseState();
    const payload = {
      projects,
      customerQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
      clientMasters,
      threeWayMatches,
      estimates,
      users: masterSettings.rbac.users,
      systemSettings: masterSettings,
    };
    scheduleCentralizedSync(payload);
    saveToCloudDatabase(payload, false);
  }, [
    projects,
    customerQuotations,
    supplierQuotations,
    purchaseOrders,
    invoices,
    deliveryNotes,
    customers,
    suppliers,
    termsLibrary,
    clientMasters,
    threeWayMatches,
    estimates,
  ]);

  // Multi-Device Cloud Database Initial Boot Hydration
  useEffect(() => {
    fetchCloudDatabase().then((res) => {
      if (res.success && res.data) {
        const d = res.data;
        if (Array.isArray(d.projects) && d.projects.length > 0) {
          setProjects(d.projects.map((p: any) => normalizeProject(p)));
        }
        if (Array.isArray(d.customerQuotations) && d.customerQuotations.length > 0) {
          setCustomerQuotations(d.customerQuotations);
        }
        if (Array.isArray(d.supplierQuotations) && d.supplierQuotations.length > 0) {
          setSupplierQuotations(d.supplierQuotations);
        }
        if (Array.isArray(d.purchaseOrders) && d.purchaseOrders.length > 0) {
          setPurchaseOrders(d.purchaseOrders);
        }
        if (Array.isArray(d.invoices) && d.invoices.length > 0) {
          setInvoices(d.invoices);
        }
        if (Array.isArray(d.deliveryNotes) && d.deliveryNotes.length > 0) {
          setDeliveryNotes(repairDeliveryNoteSequences(d.deliveryNotes));
        }
        if (Array.isArray(d.customers) && d.customers.length > 0) {
          setCustomers(d.customers);
        }
        if (Array.isArray(d.suppliers) && d.suppliers.length > 0) {
          setSuppliers(d.suppliers);
        }
        if (Array.isArray(d.termsLibrary) && d.termsLibrary.length > 0) {
          setTermsLibrary(d.termsLibrary);
        }
        if (Array.isArray(d.clientMasters) && d.clientMasters.length > 0) {
          setClientMasters(d.clientMasters);
        }
        if (Array.isArray(d.threeWayMatches) && d.threeWayMatches.length > 0) {
          setThreeWayMatches(d.threeWayMatches);
        }
        if (Array.isArray(d.estimates) && d.estimates.length > 0) {
          setEstimates(d.estimates);
        }
        console.info('☁️ [App] Multi-Device Boot: Initialized state from production cloud database.');
      }
    });
  }, []);

  // Google Drive Authentication Initialization & Automatic Bootstrap Cloud Hydration
  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(async (_googleUser, _token) => {
      // Automatic Bootstrap Hydration: Silently query latest snapshot from Google Drive on startup
      try {
        const res = await autoBootstrapDriveHydration();
        if (res.hydrated && res.data) {
          const sanitized = sanitizeAppState(res.data).sanitizedData;
          if (Array.isArray(sanitized.projects) && sanitized.projects.length > 0) {
            setProjects(sanitized.projects.map((p: any) => normalizeProject(p)));
          }
          if (Array.isArray(sanitized.customerQuotations) && sanitized.customerQuotations.length > 0) {
            setCustomerQuotations(sanitized.customerQuotations);
          }
          if (Array.isArray(sanitized.supplierQuotations) && sanitized.supplierQuotations.length > 0) {
            setSupplierQuotations(sanitized.supplierQuotations);
          }
          if (Array.isArray(sanitized.purchaseOrders) && sanitized.purchaseOrders.length > 0) {
            setPurchaseOrders(sanitized.purchaseOrders);
          }
          if (Array.isArray(sanitized.invoices) && sanitized.invoices.length > 0) {
            setInvoices(sanitized.invoices);
          }
          if (Array.isArray(sanitized.deliveryNotes) && sanitized.deliveryNotes.length > 0) {
            setDeliveryNotes(repairDeliveryNoteSequences(sanitized.deliveryNotes));
          }
          if (Array.isArray(sanitized.customers) && sanitized.customers.length > 0) {
            setCustomers(sanitized.customers);
          }
          if (Array.isArray(sanitized.suppliers) && sanitized.suppliers.length > 0) {
            setSuppliers(sanitized.suppliers);
          }
          if (Array.isArray(sanitized.termsLibrary) && sanitized.termsLibrary.length > 0) {
            setTermsLibrary(sanitized.termsLibrary);
          }
          if (Array.isArray(res.data.clientMasters) && res.data.clientMasters.length > 0) {
            setClientMasters(res.data.clientMasters);
          }
          if (Array.isArray(res.data.threeWayMatches) && res.data.threeWayMatches.length > 0) {
            setThreeWayMatches(res.data.threeWayMatches);
          }
          if (Array.isArray(res.data.estimates) && res.data.estimates.length > 0) {
            setEstimates(res.data.estimates);
          }
          if (res.data.systemSettings) {
            commitMasterEnterpriseState(res.data.systemSettings);
          }
          console.info('☁️ [GoogleDrive] Hydrated latest cloud backup on startup:', res.exportedAt);
        }
      } catch (err) {
        console.warn('☁️ [GoogleDrive] Startup bootstrap hydration notice:', err);
      }
    });
    return () => unsubscribe();
  }, []);

  // Continuous Data Retention & Production Backend Cloud Synchronization
  useEffect(() => {
    const masterSettings = getMasterEnterpriseState();
    const payload = {
      projects,
      customerQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
      clientMasters,
      threeWayMatches,
      estimates,
      users: masterSettings.rbac.users,
      systemSettings: masterSettings,
    };

    saveToCloudDatabase(payload);

    scheduleGoogleDriveAutoSync(
      payload,
      'مزامنة سحابية تلقائية فورية (Google Drive Continuous Retention)',
      2500
    );
  }, [
    projects,
    customerQuotations,
    supplierQuotations,
    purchaseOrders,
    invoices,
    deliveryNotes,
    customers,
    suppliers,
    termsLibrary,
    clientMasters,
    threeWayMatches,
    estimates,
  ]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Supplier Quotation Extracted Handler
  const handleQuotationExtracted = (
    supplierQuote: SupplierQuotation,
    targetProjectId: string,
    proceedToCustomerQuote: boolean
  ) => {
    setSupplierQuotations((prev) => [supplierQuote, ...prev]);

    // Link supplier quotation to target project
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === targetProjectId) {
          const currentSupplierIds = p.supplierQuotationIds || [];
          return {
            ...p,
            supplierQuotationIds: currentSupplierIds.includes(supplierQuote.id)
              ? currentSupplierIds
              : [...currentSupplierIds, supplierQuote.id],
          };
        }
        return p;
      })
    );

    if (proceedToCustomerQuote) {
      const proj = projects.find((p) => p.id === targetProjectId) || projects[0];

      // Default Additional Costs
      const initialAdditionalCosts = {
        procurement: 0,
        installation: 10000,
        transportation: 3000,
        testingAndCommissioning: 4000,
        engineering: 2500,
        manpower: 0,
        contingency: 2000,
        otherDirectCosts: 0,
      };

      const { items: pricedItems, totals } = calculateQuotationTotals(
        supplierQuote.items,
        initialAdditionalCosts,
        'markup',
        25, // 25% markup default
        20, // 20% margin default
        15
      );

      const matchingTerms = termsLibrary.find((t) => t.system === supplierQuote.systemType);

      const newCustQuote: CustomerQuotation = {
        id: `cq-${Date.now()}`,
        quotationNumber: `QT-2026-${String(customerQuotations.length + 1).padStart(3, '0')}`,
        projectId: targetProjectId,
        projectName: proj.name,
        projectLocation: proj.location,
        clientName: proj.customerName,
        attnName: proj.attnName,
        scopeOfWork: `Supply, Installation, Testing & Commissioning of ${supplierQuote.systemType.replace('_', ' ').toUpperCase()} System`,
        systemDefinition: `MEP Technical Solution - ${supplierQuote.supplierName}`,
        selectedSystems: [supplierQuote.systemType],
        initiatedBy: COMPANY_PROFILE.engineerName,
        date: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        validity: '15 Days',
        version: 1,
        status: 'Draft',
        items: pricedItems,
        additionalCosts: initialAdditionalCosts,
        pricingMode: 'markup',
        overallMarkupPercent: 25,
        overallTargetMarginPercent: 20,
        totals,
        terms: {
          includes: matchingTerms?.includes || [
            'Supply and delivery of materials to the jobsite.',
            'Installation, testing and commissioning.',
            'Standard one year warranty.',
          ],
          excludes: matchingTerms?.excludes || [
            'All civil works, builders work, cutting and patching.',
            'Electrical power feed and breaker supply.',
            'Government municipality approvals.',
          ],
          paymentTerms: [
            '30% Advance along with official Purchase Order / Contract.',
            '50% Upon Delivery of equipment to project site.',
            '20% Upon Testing, Commissioning & Handover.',
          ],
          validity: '15 Working Days from proposal date.',
          notes: [
            'Prices are in Saudi Riyals (SAR).',
            '15% VAT is applicable and extra.',
          ],
        },
        versionHistory: [
          {
            version: 1,
            modifiedAt: new Date().toLocaleString(),
            customerSellingPrice: totals.customerSellingPrice,
            grossProfit: totals.grossProfit,
            grossMarginPercent: totals.grossMarginPercent,
            totalProjectCost: totals.totalProjectCost,
            changeSummary: `Initial conversion from supplier quotation (${supplierQuote.supplierName})`,
            modifiedBy: COMPANY_PROFILE.engineerName,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCustomerQuotations((prev) => [newCustQuote, ...prev]);

      // Also link customer quote to project and set status to Quoted
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === targetProjectId) {
            const currentCustIds = p.customerQuotationIds || [];
            return {
              ...p,
              status: 'Quoted' as const,
              activeCustomerQuotationId: newCustQuote.id,
              customerQuotationIds: currentCustIds.includes(newCustQuote.id)
                ? currentCustIds
                : [...currentCustIds, newCustQuote.id],
            };
          }
          return p;
        })
      );

      setSelectedQuotationId(newCustQuote.id);
      setActiveTab('quotations');
      showToast(`تم تحويل تسعيرة ${supplierQuote.supplierName} إلى عرض سعر عميل جديد جاهز للتسعير!`);
    } else {
      showToast(`تم حفظ تسعيرة ${supplierQuote.supplierName} في المستندات الأصلية المحفوظة للمشروع.`);
    }
  };

  const handleIssueCustomerQuotationFromProject = (newQuotation: CustomerQuotation) => {
    setCustomerQuotations((prev) => [newQuotation, ...prev]);

    if (newQuotation.projectId) {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === newQuotation.projectId) {
            const currentQuoteIds = p.customerQuotationIds || [];
            return {
              ...p,
              status: 'Quoted' as const,
              activeCustomerQuotationId: newQuotation.id,
              customerQuotationIds: currentQuoteIds.includes(newQuotation.id)
                ? currentQuoteIds
                : [...currentQuoteIds, newQuotation.id],
            };
          }
          return p;
        })
      );
    }

    setSelectedQuotationId(newQuotation.id);
    showToast(
      `تم إصدار تسعيرة العميل رقم ${newQuotation.quotationNumber} وربطها بالمشروع بنجاح!`
    );
  };

  // Handlers for Projects and Directory
  const handleSaveQuotation = (updated: CustomerQuotation) => {
    const nextQuotations = customerQuotations.map((q) => (q.id === updated.id ? updated : q));
    setCustomerQuotations(nextQuotations);
    syncCentralizedImmediate({
      projects,
      customerQuotations: nextQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
    }, `Save Quotation ${updated.quotationNumber}`);
  };

  const handleCreateNewVersion = (updated: CustomerQuotation, changeNotes: string) => {
    const nextQuotations = customerQuotations.map((q) => (q.id === updated.id ? updated : q));
    setCustomerQuotations(nextQuotations);
    syncCentralizedImmediate({
      projects,
      customerQuotations: nextQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
    }, `New Version Quotation ${updated.quotationNumber} V${updated.version}`);
    showToast(`تم حفظ الإصدار الجديد V${updated.version} بنجاح: ${changeNotes}`);
  };

  const handleCreateProject = (project: Project) => {
    const nextProjects = [project, ...projects];
    setProjects(nextProjects);
    syncCentralizedImmediate({
      projects: nextProjects,
      customerQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
    }, `Create Project ${project.name}`);
    showToast(`تم إنشاء المشروع "${project.name}" بنجاح.`);
  };

  const handleDeleteCustomerQuotation = (quotationId: string) => {
    const quote = customerQuotations.find((q) => q.id === quotationId);
    if (!quote) return;
    const proj = projects.find((p) => p.id === quote.projectId);

    // Pre-execution snapshot checkpoint
    createCheckpoint(`قبل حذف عرض السعر: ${quote.quotationNumber}`, {
      projects,
      customerQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
    });

    // 1. Archive items to the priced items library
    const newlyArchived = archiveItemsFromCustomerQuotation(quote, proj);
    setArchivedPricedItems((prev) => [...prev, ...newlyArchived]);

    // 2. Remove quote from customerQuotations
    setCustomerQuotations((prev) => prev.filter((q) => q.id !== quotationId));

    // 3. Remove quote ID from project.customerQuotationIds if present
    setProjects((prev) =>
      prev.map((p) =>
        p.id === quote.projectId
          ? {
              ...p,
              customerQuotationIds: (p.customerQuotationIds || []).filter((id) => id !== quotationId),
            }
          : p
      )
    );

    // 4. Clear selectedQuotationId if active
    if (selectedQuotationId === quotationId) {
      setSelectedQuotationId(null);
      setActiveTab('dashboard');
    }

    showToast(
      `تم حذف عرض السعر ${quote.quotationNumber} بنجاح، وحفظ ${newlyArchived.length} صنف مسعر في صفحة "الأصناف المسعرة" داخل أوامر الشراء.`
    );
  };

  const handleDeleteSupplierQuotation = (supplierQuoteId: string) => {
    const sq = supplierQuotations.find((s) => s.id === supplierQuoteId);
    if (!sq) return;
    const proj = projects.find((p) => p.id === sq.projectId);

    // 1. Archive items to the priced items library
    const newlyArchived = archiveItemsFromSupplierQuotation(sq, proj);
    setArchivedPricedItems((prev) => [...prev, ...newlyArchived]);

    // 2. Remove from supplierQuotations
    setSupplierQuotations((prev) => prev.filter((s) => s.id !== supplierQuoteId));

    // 3. Unlink from project
    setProjects((prev) =>
      prev.map((p) =>
        p.id === sq.projectId
          ? {
              ...p,
              supplierQuotationIds: (p.supplierQuotationIds || []).filter((id) => id !== supplierQuoteId),
            }
          : p
      )
    );

    showToast(
      `تم حذف تسعيرة المورد ${sq.supplierName} بنجاح، وحفظ ${newlyArchived.length} صنف مسعر في صفحة "الأصناف المسعرة" داخل أوامر الشراء.`
    );
  };

  const handleIssuePOWithPricedItem = (item: PricedItemRecord) => {
    setPrefillPricedItem(item);
    setPoTargetProjectId(item.projectId);
    setIsPOModalOpen(true);
  };

  const handleDeleteProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    const projectName = project?.name || 'المشروع';

    // Pre-execution snapshot checkpoint
    createCheckpoint(`قبل حذف المشروع: ${projectName}`, {
      projects,
      customerQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
    });

    // 0. Archive any customer & supplier quotation items to the priced items library before cascading
    const linkedQuotes = customerQuotations.filter((q) => q.projectId === projectId);
    const linkedSQs = supplierQuotations.filter((sq) => sq.projectId === projectId);

    const newlyArchived: PricedItemRecord[] = [];
    linkedQuotes.forEach((q) => {
      newlyArchived.push(...archiveItemsFromCustomerQuotation(q, project));
    });
    linkedSQs.forEach((sq) => {
      newlyArchived.push(...archiveItemsFromSupplierQuotation(sq, project));
    });
    if (newlyArchived.length > 0) {
      setArchivedPricedItems((prev) => [...prev, ...newlyArchived]);
    }

    // 1. Remove project
    setProjects((prev) => prev.filter((p) => p.id !== projectId));

    // 2. Cascade delete all customer quotations belonging to this project
    setCustomerQuotations((prev) => prev.filter((q) => q.projectId !== projectId));

    // 3. Cascade delete all purchase orders belonging to this project
    setPurchaseOrders((prev) => prev.filter((po) => po.projectId !== projectId));

    // 4. Cascade delete or unlink supplier quotations linked to this project
    setSupplierQuotations((prev) => prev.filter((sq) => sq.projectId !== projectId));

    // 5. Cascade delete all invoices and delivery notes belonging to this project
    setInvoices((prev) => prev.filter((inv) => inv.projectId !== projectId));
    setDeliveryNotes((prev) => prev.filter((dn) => dn.projectId !== projectId));

    // 6. Clean up selection states
    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
    }
    setSelectedQuotationId((current) => {
      const wasLinked = customerQuotations.some(
        (q) => q.id === current && q.projectId === projectId
      );
      return wasLinked ? null : current;
    });

    // 7. Note: customers state is kept completely intact as explicitly instructed:
    // "فقط ابقي على بيانات العميل في قائمة العملاء"

    showToast(
      `تم حذف المشروع "${projectName}" وإلغاء كافة عروض الأسعار وأوامر الشراء المرتبطة به مع الاحتفاظ بالأصناف المسعرة في بنك الأصناف المسعرة وبيانات العميل.`
    );
  };

  const handleUpdateProjectStatus = (
    projectId: string,
    newStatus: Project['status'],
    lossReason?: string
  ) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            status: newStatus,
            lossReason:
              newStatus === 'Lost'
                ? lossReason !== undefined
                  ? lossReason
                  : p.lossReason
                : undefined,
          };
        }
        return p;
      })
    );
    showToast(`تم تحديث حالة المشروع إلى: ${newStatus}`);
  };

  const handleUpdateProjectName = (projectId: string, newName: string) => {
    if (!newName.trim()) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name: newName.trim(), updatedAt: new Date().toISOString() } : p))
    );
    broadcastMultiTabSync('PROJECT_PATCHED', { id: projectId, patch: { name: newName.trim() } });
    showToast(`تم تحديث اسم المشروع بنجاح إلى: "${newName.trim()}"`);
  };

  // Concurrency-safe granular partial property patcher
  const handlePatchProject = (projectId: string, patch: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return { ...p, ...patch, updatedAt: new Date().toISOString() };
        }
        return p;
      })
    );
    broadcastMultiTabSync('PROJECT_PATCHED', { id: projectId, patch });
  };

  const handleUpdateProjectExecutionStatus = (
    projectId: string,
    newExecutionStatus: 'تام' | 'جزئي' | 'قيد التنفيذ',
    details?: {
      completionPercentage?: number;
      completionDate?: string;
      handoverNotes?: string;
      retentionPercent?: number;
      retentionAmount?: number;
      retentionStatus?: 'Held' | 'Due' | 'Released';
    }
  ) => {
    let resolvedPatch: Partial<Project> = {};
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const compPct =
            details?.completionPercentage !== undefined
              ? details.completionPercentage
              : newExecutionStatus === 'تام'
              ? 100
              : newExecutionStatus === 'جزئي'
              ? (p.completionPercentage && p.completionPercentage < 100 ? p.completionPercentage : 65)
              : (p.completionPercentage && p.completionPercentage < 100 ? p.completionPercentage : 25);

          const resolvedExecStatus: 'تام' | 'جزئي' | 'قيد التنفيذ' =
            compPct === 100 ? 'تام' : compPct > 0 ? 'جزئي' : 'قيد التنفيذ';

          // Automatic award status: If execution has started (> 0%) and not explicitly lost, it's Won
          const updatedAwardStatus =
            p.status === 'Lost' || p.lossReason
              ? 'Lost'
              : compPct > 0 || p.clientContractPO
              ? 'Won'
              : p.status || 'Under Pricing';

          resolvedPatch = {
            status: updatedAwardStatus,
            executionStatus: resolvedExecStatus,
            completionPercentage: compPct,
            completionDate:
              details?.completionDate !== undefined
                ? details.completionDate
                : resolvedExecStatus === 'تام'
                ? (p.completionDate || new Date().toISOString().split('T')[0])
                : p.completionDate,
            handoverNotes: details?.handoverNotes !== undefined ? details.handoverNotes : p.handoverNotes,
            retentionPercent: details?.retentionPercent !== undefined ? details.retentionPercent : (p.retentionPercent ?? 10),
            retentionAmount: details?.retentionAmount !== undefined ? details.retentionAmount : p.retentionAmount,
            retentionStatus: details?.retentionStatus !== undefined ? details.retentionStatus : (p.retentionStatus || 'Held'),
          };

          return {
            ...p,
            ...resolvedPatch,
          };
        }
        return p;
      })
    );
    if (Object.keys(resolvedPatch).length > 0) {
      broadcastMultiTabSync('PROJECT_PATCHED', { id: projectId, patch: resolvedPatch });
    }
    showToast(`تم تحديث إنجاز المشروع آلياً بنسبة %${details?.completionPercentage ?? (newExecutionStatus === 'تام' ? 100 : newExecutionStatus === 'جزئي' ? 65 : 25)}.`);
  };

  const handleUpdateAdvancePayment = (
    projectId: string,
    data:
      | {
          amount: number;
          date: string;
          receiptNo: string;
          method?: 'Bank Transfer' | 'Cheque' | 'Cash';
          referenceNo?: string;
          notes?: string;
          attachmentName?: string;
          attachmentData?: string;
          attachmentType?: string;
          attachmentSize?: number;
        }
      | number,
    date?: string,
    receiptNo?: string
  ) => {
    let amount = 0;
    let paymentDate = date || new Date().toISOString().split('T')[0];
    let recNo = receiptNo || 'ADV-01';
    let extraFields: Partial<Project> = {};

    if (typeof data === 'object') {
      amount = data.amount;
      paymentDate = data.date;
      recNo = data.receiptNo;
      extraFields = {
        advancePaymentMethod: data.method,
        advancePaymentReferenceNo: data.referenceNo,
        advancePaymentNotes: data.notes,
        advancePaymentAttachmentName: data.attachmentName,
        advancePaymentAttachmentData: data.attachmentData,
        advancePaymentAttachmentType: data.attachmentType,
        advancePaymentAttachmentSize: data.attachmentSize,
      };
    } else {
      amount = data;
    }

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            advancePaymentAmount: amount,
            advancePaymentDate: paymentDate,
            advancePaymentReceiptNo: recNo,
            ...extraFields,
          };
        }
        return p;
      })
    );
    showToast(`تم تسجيل الدفعة الأولى بمبلغ ${amount.toLocaleString()} SAR وسند القبض بنجاح.`);
  };

  const handleUpdateRetention = (
    projectId: string,
    percent: number | string,
    amount?: number,
    status?: 'Held' | 'Due' | 'Released'
  ) => {
    const safePercent = getSafeRetentionPercent(percent, 10);
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const contractVal = p.budget || 0;
          const { percent: finalPercent, amount: finalAmount } = calculateRetentionFigures(
            contractVal,
            safePercent,
            amount,
            amount !== undefined && amount > 0 ? 'fixed' : 'percent'
          );
          return {
            ...p,
            retentionPercent: finalPercent,
            retentionAmount: finalAmount,
            retentionStatus: status || p.retentionStatus || 'Held',
          };
        }
        return p;
      })
    );
    showToast(`تم تحديث بيانات محجوز الضمان (Retention %${safePercent}) بنجاح.`);
  };

  const handleAddCostRecord = (projectId: string, record: any) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const currentCosts = p.incurredCosts || [];
          return { ...p, incurredCosts: [...currentCosts, record] };
        }
        return p;
      })
    );
    showToast(`تم تسجيل التكلفة بقيمة ${record.amount.toLocaleString()} SAR للمشروع.`);
  };

  const handleAddCustomer = (cust: Customer) => {
    setCustomers((prev) => [cust, ...prev]);
    showToast(`تمت إضافة العميل "${cust.companyName}" بنجاح.`);
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setProjects((prev) =>
      prev.map((p) =>
        p.customerId === updated.id || p.customerName === updated.companyName
          ? { ...p, customerName: updated.companyName, customerId: updated.id }
          : p
      )
    );
    setCustomerQuotations((prev) =>
      prev.map((q) =>
        q.customerId === updated.id
          ? { ...q, clientName: updated.companyName }
          : q
      )
    );
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.customerId === updated.id
          ? {
              ...inv,
              customerName: updated.companyName,
              customerVatNo: updated.vatNumber || inv.customerVatNo,
            }
          : inv
      )
    );
    showToast(`تم تحديث بيانات العميل "${updated.companyName}" في كافة سجلات المنظومة.`);
  };

  const handleDeleteCustomer = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    const name = cust?.companyName || 'العميل';
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    showToast(`تم حذف العميل "${name}" من دليل العملاء بنجاح.`);
  };

  const handleAddSupplier = (supp: Supplier) => {
    setSuppliers((prev) => [supp, ...prev]);
    showToast(`تمت إضافة المورد "${supp.name}" بنجاح.`);
  };

  const handleUpdateSupplier = (updated: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setPurchaseOrders((prev) =>
      prev.map((po) =>
        po.supplierId === updated.id
          ? { ...po, supplierName: updated.name }
          : po
      )
    );
    showToast(`تم تحديث بيانات المورد "${updated.name}" بنجاح.`);
  };

  const handleDeleteSupplier = (supplierId: string) => {
    const supp = suppliers.find((s) => s.id === supplierId);
    const name = supp?.name || 'المورد';
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
    showToast(`تم حذف المورد "${name}" من دليل الموردين بنجاح.`);
  };

  // Invoices & Delivery Notes Handlers
  const handleCreateInvoice = (newInv: Invoice) => {
    setInvoices((prev) => [newInv, ...prev]);

    // Automatically mark all linked source delivery notes as Fully Invoiced
    if (newInv.sourceDeliveryNoteIds && newInv.sourceDeliveryNoteIds.length > 0) {
      setDeliveryNotes((prev) =>
        prev.map((dn) =>
          newInv.sourceDeliveryNoteIds!.includes(dn.id)
            ? { ...dn, invoicedStatus: 'Fully Invoiced' as const }
            : dn
        )
      );
    }

    showToast(`تم إصدار الفاتورة الضريبية رقم ${newInv.invoiceNumber} بنجاح!`);
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    const invNum = inv?.invoiceNumber || invoiceId;
    const linkedDnIds = inv?.sourceDeliveryNoteIds || [];

    setInvoices((prev) => {
      const updated = prev.map((i) => (i.id === invoiceId ? { ...i, deletedAt: new Date().toISOString() } : i));
      const remaining = purgeDeletedRecords(updated);
      if (inv) {
        const remainingNumbers = remaining.filter((i) => i.projectId === inv.projectId).map((i) => i.invoiceNumber);
        invalidateAndResetSequenceCache('inv', inv.projectNumber, remainingNumbers);
      }
      return remaining;
    });

    // Reset linked delivery notes back to Uninvoiced
    if (linkedDnIds.length > 0) {
      setDeliveryNotes((prev) =>
        prev.map((dn) =>
          linkedDnIds.includes(dn.id)
            ? { ...dn, invoicedStatus: 'Uninvoiced' as const }
            : dn
        )
      );
    }

    showToast(`تم حذف الفاتورة الضريبية رقم ${invNum} بنجاح وإعادة البنود لحالة غير مفوترة وتحديث السلسلة المالية.`);
  };

  const handleOpenCreateInvoiceForDN = (dn: DeliveryNote) => {
    // 1. Strict lookup by project id
    let proj = projects.find((p) => p.id === dn.projectId);
    // 2. Lookup by projectNumber or name
    if (!proj && dn.projectNumber) {
      proj = projects.find((p) => p.projectNumber === dn.projectNumber);
    }
    if (!proj && dn.projectName) {
      proj = projects.find((p) => p.name === dn.projectName);
    }

    // 3. Isolated fallback strictly bound to this Delivery Note - NEVER use unrelated projects[0]!
    const targetProject: Project = proj || {
      id: dn.projectId,
      projectNumber: dn.projectNumber,
      name: dn.projectName,
      customerName: dn.customerName,
      customerId: dn.customerId,
      location: dn.deliveryLocation,
      status: 'Won',
      createdAt: dn.createdAt,
    };

    setInvoiceModalConfig({
      isOpen: true,
      project: targetProject,
      initialSelectedDeliveryNoteIds: [dn.id],
    });
  };

  const handleOpenCreateInvoiceForDNs = (dns: DeliveryNote[]) => {
    if (dns.length === 0) return;
    const firstDn = dns[0];
    let proj = projects.find((p) => p.id === firstDn.projectId);
    if (!proj && firstDn.projectNumber) {
      proj = projects.find((p) => p.projectNumber === firstDn.projectNumber);
    }
    if (!proj && firstDn.projectName) {
      proj = projects.find((p) => p.name === firstDn.projectName);
    }

    const targetProject: Project = proj || {
      id: firstDn.projectId,
      projectNumber: firstDn.projectNumber,
      name: firstDn.projectName,
      customerName: firstDn.customerName,
      customerId: firstDn.customerId,
      location: firstDn.deliveryLocation,
      status: 'Won',
      createdAt: firstDn.createdAt,
    };

    setInvoiceModalConfig({
      isOpen: true,
      project: targetProject,
      initialSelectedDeliveryNoteIds: dns.map((d) => d.id),
    });
  };

  const handleCreateDeliveryNote = (newDN: DeliveryNote) => {
    setDeliveryNotes((prev) => repairDeliveryNoteSequences([newDN, ...prev.filter((d) => d.id !== newDN.id)]));
    showToast(`تم إصدار سند تسليم المواد رقم ${newDN.dnNumber} بنجاح وتجهيز الأصناف للفوترة!`);
  };

  const handleDeleteDeliveryNote = (deliveryNoteId: string) => {
    const dn = deliveryNotes.find((d) => d.id === deliveryNoteId);
    const dnNum = dn?.dnNumber || deliveryNoteId;

    setDeliveryNotes((prev) => {
      const updated = prev.map((d) => (d.id === deliveryNoteId ? { ...d, deletedAt: new Date().toISOString() } : d));
      const remaining = purgeDeletedRecords(updated);
      if (dn) {
        const remainingNumbers = remaining.filter((d) => d.projectId === dn.projectId).map((d) => d.dnNumber);
        invalidateAndResetSequenceCache('dn', dn.projectNumber, remainingNumbers);
      }
      return repairDeliveryNoteSequences(remaining);
    });

    showToast(`تم حذف سند تسليم البضاعة رقم ${dnNum} بنجاح وإلغاء تسجيل توريد الأصناف وتحديث سلسلة السندات.`);
  };

  const handleUpdateDeliveryNote = (updatedDN: DeliveryNote) => {
    setDeliveryNotes((prev) => prev.map((dn) => (dn.id === updatedDN.id ? updatedDN : dn)));
    showToast(`تم تحديث واعتماد سند التسليم رقم ${updatedDN.dnNumber} بنجاح.`);
  };

  const handleUpdateInvoice = (updatedInvoice: Invoice) => {
    setInvoices((prev) => prev.map((inv) => (inv.id === updatedInvoice.id ? updatedInvoice : inv)));
    showToast(`تم تحديث واعتماد الفاتورة الضريبية رقم ${updatedInvoice.invoiceNumber} بنجاح.`);
  };

  const handleRecordPayment = (invoiceId: string, payment: InvoicePayment) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const payments = [...(inv.payments || []), payment];
          const paidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const remainingAmount = Math.max(0, inv.grandTotal - paidAmount);
          const status = remainingAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Issued';
          return {
            ...inv,
            payments,
            paidAmount,
            remainingAmount,
            status: status as any,
          };
        }
        return inv;
      })
    );
    showToast(`تم تسجيل الدفعة بقيمة ${payment.amount.toLocaleString()} SAR للفاتورة.`);
  };

  const handleDeletePayment = (invoiceId: string, paymentId: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const payments = (inv.payments || []).filter((p) => p.id !== paymentId);
          const paidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const remainingAmount = Math.max(0, inv.grandTotal - paidAmount);
          const status = remainingAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partially Paid' : 'Issued';
          return {
            ...inv,
            payments,
            paidAmount,
            remainingAmount,
            status: status as any,
          };
        }
        return inv;
      })
    );
    showToast(`تم حذف الدفعة المستلمة بنجاح وتحديث أرصدة الفاتورة.`);
  };

  const handleUpdateItemDeliveryStatus = (
    poId: string,
    itemId: string,
    newStatus: ItemDeliveryStatus,
    deliveredQty?: number
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id === poId) {
          const updatedItems = (po.items || []).map((item) => {
            if (item.id === itemId) {
              return {
                ...item,
                deliveryStatus: newStatus,
                deliveredQty: deliveredQty !== undefined ? deliveredQty : item.deliveredQty,
              };
            }
            return item;
          });
          const allDelivered = updatedItems.every((it) => it.deliveryStatus === 'Delivered');
          const someDelivered = updatedItems.some(
            (it) => it.deliveryStatus === 'Delivered' || it.deliveryStatus === 'Partial Delivered'
          );
          const overallStatus: ItemDeliveryStatus = allDelivered
            ? 'Delivered'
            : someDelivered
            ? 'Partial Delivered'
            : 'Pending';
          return { ...po, items: updatedItems, deliveryStatus: overallStatus };
        }
        return po;
      })
    );
    showToast('تم تحديث حالة تسليم بند أمر الشراء بنجاح.');
  };

  const handleUpdateSupplierQuoteItems = (quoteId: string, updatedItems: QuotationItem[]) => {
    setSupplierQuotations((prev) =>
      prev.map((sq) => {
        if (sq.id === quoteId) {
          const subtotal = updatedItems.reduce(
            (sum, it) => sum + (Number(it.supplierTotalPrice) || 0),
            0
          );
          const vat = subtotal * 0.15;
          return {
            ...sq,
            items: updatedItems,
            subtotal,
            vatAmount: vat,
            totalAmount: subtotal + vat,
            originalStatus: 'reviewed',
          };
        }
        return sq;
      })
    );
    showToast('تم تحديث وضبط أسعار بنود تسعيرة المورد بنجاح.');
  };

  const handleConvertSupplierQuoteToCustomerQuote = (supplierQuoteId: string, tunedItems: QuotationItem[]) => {
    const sq = supplierQuotations.find((q) => q.id === supplierQuoteId);
    if (!sq) return;

    handleUpdateSupplierQuoteItems(supplierQuoteId, tunedItems);

    const targetProject = projects.find((p) => p.id === sq.projectId) || projects[0];
    const targetProjId = targetProject ? targetProject.id : 'proj-1';

    const mappedItems: QuotationItem[] = tunedItems.map((it, idx) => {
      const supPrice = Number(it.supplierUnitPrice) || 0;
      const sellPrice = Number(it.sellingUnitPrice) || (supPrice > 0 ? supPrice * 1.25 : 0);
      const qty = Number(it.quantity) || 1;
      return {
        id: it.id || `ci-${Date.now()}-${idx + 1}`,
        itemNo: it.itemNo || idx + 1,
        description: it.description,
        manufacturer: it.manufacturer || sq.supplierName,
        model: it.model || '',
        quantity: qty,
        unit: it.unit || 'بند',
        supplierUnitPrice: supPrice,
        supplierTotalPrice: Number((qty * supPrice).toFixed(2)),
        sellingUnitPrice: sellPrice,
        sellingTotalPrice: Number((qty * sellPrice).toFixed(2)),
        system: it.system || (sq.systemType as any) || 'fire_fighting',
        sourceSupplierQuoteId: sq.id,
        sourceSupplierName: sq.supplierName,
        notes: it.notes || '',
      };
    });

    const initialAdditionalCosts: QuotationAdditionalCosts = {
      procurement: 0,
      installation: 0,
      transportation: 0,
      testingAndCommissioning: 0,
      engineering: 0,
      manpower: 0,
      contingency: 0,
      otherDirectCosts: 0,
    };

    const { items: pricedItems, totals } = calculateQuotationTotals(
      mappedItems,
      initialAdditionalCosts,
      'item_specific',
      25,
      20,
      15
    );

    const newCustQuote: CustomerQuotation = {
      id: `CQ-RMT-${new Date().getFullYear()}-${String(customerQuotations.length + 1).padStart(3, '0')}`,
      quotationNumber: `QT-RMT-${new Date().getFullYear()}-${String(customerQuotations.length + 1).padStart(3, '0')}`,
      projectId: targetProjId,
      projectName: targetProject?.name || `مشروع ${sq.supplierName}`,
      projectLocation: targetProject?.location || 'المملكة العربية السعودية',
      clientName: targetProject?.customerName || 'عميل معتمد',
      attnName: targetProject?.attnName || 'السيد مدير المشاريع',
      scopeOfWork: `توريد وتركيب وتشغيل أنظمة كهروميكانيكية متكاملة - تسعيرة ${sq.supplierName}`,
      systemDefinition: `حلول كهروميكانيكية معتمدة - ${sq.supplierName}`,
      selectedSystems: [sq.systemType || 'fire_fighting'],
      initiatedBy: COMPANY_PROFILE.engineerName,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      validity: '15 Days',
      version: 1,
      status: 'Draft',
      items: pricedItems,
      additionalCosts: initialAdditionalCosts,
      pricingMode: 'markup',
      overallMarkupPercent: 25,
      overallTargetMarginPercent: 20,
      totals,
      terms: {
        includes: [
          'توريد المواد والمعدات المعتمدة إلى موقع المشروع.',
          'التركيب والفحص والاختبار والتشغيل التجريبي.',
          'ضمان قياسي لمدة عام كامل من تاريخ التسليم.',
        ],
        excludes: [
          'الأعمال المدنية والمعمارية والفتحات والتكسير والترميم.',
          'تغذية التيار الكهربائي الرئيسي والقواطع.',
          'رسوم التراخيص والاعتمادات البلدية.',
        ],
        paymentTerms: [
          '30% دفعة مقدمة عند توقيع العقد أو إصدار أمر الشراء.',
          '50% دفعات مرحلية مع توريد المواد إلى الموقع.',
          '20% عند إنهاء أعمال الاختبار والتشغيل والتسليم النهائي.',
        ],
        validity: '15 يوم عمل من تاريخ العرض.',
        notes: [
          'الأسعار بالريال السعودي (SAR).',
          'تضاف ضريبة القيمة المضافة 15% على إجمالي الفاتورة.',
        ],
      },
      versionHistory: [
        {
          version: 1,
          modifiedAt: new Date().toLocaleString(),
          customerSellingPrice: totals.customerSellingPrice,
          grossProfit: totals.grossProfit,
          grossMarginPercent: totals.grossMarginPercent,
          totalProjectCost: totals.totalProjectCost,
          changeSummary: `تحويل مباشر من تسعيرة المورد ${sq.supplierName} بأسعار البيع المضبوطة`,
          modifiedBy: COMPANY_PROFILE.engineerName,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCustomerQuotations((prev) => [newCustQuote, ...prev]);
    setSelectedQuotationId(newCustQuote.id);
    setActiveTab('quotations');
    showToast(`تم تحويل تسعيرة ${sq.supplierName} بنجاح إلى عرض سعر عميل جديد بالأسعار المضبوطة!`);
  };

  // Purchase Order Handlers
  const handleOpenNewPO = (projectId?: string, supplierQuoteId?: string) => {
    setEditingPO(null);
    setPoTargetProjectId(projectId);
    setPoSourceSupplierQuoteId(supplierQuoteId);
    setIsPOModalOpen(true);
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setEditingPO(po);
    setPoTargetProjectId(po.projectId);
    setPoSourceSupplierQuoteId(undefined);
    setIsPOModalOpen(true);
  };

  const handleSavePO = (savedPO: PurchaseOrder) => {
    setPurchaseOrders((prev) => {
      const exists = prev.some((p) => p.id === savedPO.id);
      if (exists) {
        return prev.map((p) => (p.id === savedPO.id ? savedPO : p));
      }
      return [savedPO, ...prev];
    });

    // Ensure project has this PO id linked
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id === savedPO.projectId) {
          const currentPOIds = proj.purchaseOrderIds || [];
          return {
            ...proj,
            purchaseOrderIds: currentPOIds.includes(savedPO.id)
              ? currentPOIds
              : [...currentPOIds, savedPO.id],
          };
        }
        return proj;
      })
    );

    showToast(`تم حفظ وإصدار أمر الشراء ${savedPO.poNumber} بنجاح.`);
  };

  const handleDeletePO = (poId: string) => {
    const poToDelete = purchaseOrders.find((p) => p.id === poId);
    setPurchaseOrders((prev) => prev.filter((p) => p.id !== poId));

    if (poToDelete && poToDelete.projectId) {
      setProjects((prev) =>
        prev.map((proj) =>
          proj.id === poToDelete.projectId
            ? {
                ...proj,
                purchaseOrderIds: (proj.purchaseOrderIds || []).filter((id) => id !== poId),
              }
            : proj
        )
      );
    }

    showToast(`تم حذف أمر الشراء بنجاح وتحديث حسابات المشروع عكسياً.`);
  };

  const handleUpdatePOStatus = (poId: string, newStatus: PurchaseOrder['status']) => {
    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === poId ? { ...p, status: newStatus } : p))
    );
    showToast(`تم تحديث حالة أمر الشراء إلى: ${newStatus}`);
  };

  const handleSaveMaterialReceipt = (
    poId: string,
    receipt: MaterialReceiptRecord,
    updatedItems: PurchaseOrder['items']
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id === poId) {
          const receipts = po.materialReceipts || [];
          const allDelivered = updatedItems.every(
            (it) => (it.deliveredQty || 0) >= it.quantity
          );
          const anyDelivered = updatedItems.some(
            (it) => (it.deliveredQty || 0) > 0
          );
          const newStatus: PurchaseOrder['status'] = allDelivered
            ? 'Completed'
            : po.status;
          const deliveryStatus: PurchaseOrder['deliveryStatus'] = allDelivered
            ? 'Delivered'
            : anyDelivered
            ? 'Partial Delivered'
            : 'Not yet';
          const fulfillmentStatus: PurchaseOrder['fulfillmentStatus'] = allDelivered
            ? 'Fully Received'
            : anyDelivered
            ? 'In Delivery / Partial'
            : 'Not Received';

          return {
            ...po,
            items: updatedItems,
            materialReceipts: [receipt, ...receipts],
            status: newStatus,
            deliveryStatus,
            fulfillmentStatus,
          };
        }
        return po;
      })
    );
    showToast(`تم تسجيل استلام المواد بنجاح وحفظ إشعار الاستلام #${receipt.receiptNumber}`);
  };

  const handleDeleteMaterialReceipt = (poId: string, receiptId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id !== poId) return po;
        const receipts = po.materialReceipts || [];
        const targetReceipt = receipts.find((r) => r.id === receiptId);
        if (!targetReceipt) return po;

        // Rollback delivered quantities for each item in receivedItems
        const updatedItems = po.items.map((it) => {
          const match = (targetReceipt.receivedItems || []).find((ri) => ri.poItemId === it.id);
          if (!match) return it;
          const currentDelivered = it.deliveredQty || 0;
          const revertedDelivered = Math.max(0, currentDelivered - match.receivedQty);
          return {
            ...it,
            deliveredQty: revertedDelivered,
            deliveryStatus: (revertedDelivered >= it.quantity ? 'Delivered' : revertedDelivered > 0 ? 'Partial Delivered' : 'Not yet') as ItemDeliveryStatus,
          };
        });

        const remainingReceipts = receipts.filter((r) => r.id !== receiptId);
        const allDelivered = updatedItems.every((it) => (it.deliveredQty || 0) >= it.quantity);
        const anyDelivered = updatedItems.some((it) => (it.deliveredQty || 0) > 0);

        return {
          ...po,
          items: updatedItems,
          materialReceipts: remainingReceipts,
          status: allDelivered ? 'Completed' : 'Approved',
          deliveryStatus: (allDelivered ? 'Delivered' : anyDelivered ? 'Partial Delivered' : 'Not yet') as ItemDeliveryStatus,
          fulfillmentStatus: allDelivered ? 'Fully Received' : anyDelivered ? 'In Delivery / Partial' : 'Not Received',
        };
      })
    );
    showToast(`تم التراجع عن إيصال الاستلام وإلغاء الكميات المستلمة وإرجاعها للرصيد المتبقي بنجاح.`);
  };

  const handleResetPOReceipts = (poId: string) => {
    const existing = purchaseOrders.find((p) => p.id === poId);
    if (!existing) return;

    // Calculate total previously received quantities to execute exact reverse inventory withdrawal
    let totalWithdrawnUnits = 0;
    const itemReversals: { description: string; qty: number; unit: string }[] = [];

    (existing.items || []).forEach((it) => {
      let receivedForThisItem = 0;
      (existing.materialReceipts || []).forEach((r) => {
        const match = (r.receivedItems || []).find((ri) => ri.poItemId === it.id);
        if (match) receivedForThisItem += (match.receivedQty || 0);
      });
      if (receivedForThisItem === 0 && (it.deliveredQty || 0) > 0) {
        receivedForThisItem = it.deliveredQty || 0;
      }
      if (receivedForThisItem > 0) {
        totalWithdrawnUnits += receivedForThisItem;
        itemReversals.push({
          description: it.description,
          qty: receivedForThisItem,
          unit: it.unit || 'EA',
        });
      }
    });

    const resetItems = (existing.items || []).map((it) => ({
      ...it,
      deliveredQty: 0,
      deliveryStatus: 'Not yet' as ItemDeliveryStatus,
    }));

    const reversalTimestamp = new Date().toLocaleString('ar-SA');
    const withdrawalLogEntry = `\n[حركة عكسية لمخزون المستودع / Automatic Inventory Withdrawal - ${reversalTimestamp}]:\nتم عكس وسحب كميات الأصناف المسجلة سابقاً (${totalWithdrawnUnits} وحدة) وإلغاء استلامها من المستودع الفعلي وتصفير رصيدها ليصبح غير متاح للصرف أو التسليم حتى إصدار وتوثيق محضر استلام جديد.`;

    const resetPO: PurchaseOrder = {
      ...existing,
      items: resetItems,
      materialReceipts: [],
      status: 'Approved',
      deliveryStatus: 'Not yet',
      fulfillmentStatus: 'Not Received',
      notes: existing.notes ? `${existing.notes}\n${withdrawalLogEntry}` : withdrawalLogEntry,
      updatedAt: new Date().toISOString(),
    };

    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === poId ? resetPO : po))
    );

    // Open the edit modal synchronously for the freshly zeroed PO
    setEditingPO(resetPO);
    setPoTargetProjectId(resetPO.projectId);
    setPoSourceSupplierQuoteId(undefined);
    setIsPOModalOpen(true);

    showToast(`تم تنفيذ حركة السحب العكسي للمخزون (${totalWithdrawnUnits} وحدة) وتصفير الكميات بنجاح. المخزون غير متاح للصرف حتى استلام جديد.`);
  };

  const handleUpdatePO = (poId: string, updatedPO: PurchaseOrder) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === poId ? updatedPO : po))
    );
    showToast('تم تحديث القيود والمدفوعات المالية لأمر الشراء بنجاح');
  };

  const handleSaveClientContractPO = (
    projectId: string,
    contractPO: ClientContractPO
  ) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            clientContractPO: contractPO,
            status: 'Won',
            projectOutcome: 'Won',
          };
        }
        return p;
      })
    );
    showToast(`تم تثبيت أمر شراء العميل ${contractPO.clientPONumber} بنجاح وترسية المشروع.`);
  };

  const handleInvoiceReceivedMaterials = (params: {
    projectId: string;
    receipt: MaterialReceiptRecord;
    itemsToInvoice: {
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      sourceItemId: string;
    }[];
  }) => {
    const targetProject = projects.find((p) => p.id === params.projectId);
    if (!targetProject) return;

    // Calculate subtotal & VAT
    const subtotal = params.itemsToInvoice.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const vat = subtotal * 0.15;
    const grandTotal = subtotal + vat;

    const prjCode = (targetProject.projectNumber || targetProject.id || 'PRJ').replace(/[^a-zA-Z0-9]/g, '');
    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${prjCode}-${Date.now().toString().slice(-4)}`,
      projectId: targetProject.id,
      projectName: targetProject.name,
      projectNumber: targetProject.projectNumber,
      customerId: targetProject.customerId || 'cust-1',
      customerName: targetProject.customerName,
      customerVatNumber: '300000000000003',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      poReference: params.receipt.supplierDeliveryNoteNo ? `إشعار تسليم مورد: ${params.receipt.supplierDeliveryNoteNo}` : '',
      status: 'Issued',
      subtotal,
      discount: 0,
      totalAfterDiscount: subtotal,
      vatPercent: 15,
      vatAmount: vat,
      grandTotal,
      paidAmount: 0,
      remainingAmount: grandTotal,
      payments: [],
      items: params.itemsToInvoice.map((item, idx) => ({
        id: `item-${idx + 1}-${Date.now()}`,
        itemNo: idx + 1,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        sourceItemId: item.sourceItemId,
      })),
      notes: `فاتورة مواد وتوريدات مستلمة بموجب إشعار استلام رقم ${params.receipt.receiptNumber}. شاملة الضريبة 15%.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    setActiveTab('invoices');
    showToast(`تم إنشاء مسودة الفاتورة الضريبية للعميل بنجاح بموجب المواد المستلمة.`);
  };

  const handleRestoreData = (restored: {
    projects?: Project[];
    customerQuotations?: CustomerQuotation[];
    supplierQuotations?: SupplierQuotation[];
    purchaseOrders?: PurchaseOrder[];
    invoices?: Invoice[];
    deliveryNotes?: DeliveryNote[];
    customers?: Customer[];
    suppliers?: Supplier[];
    termsLibrary?: TermsLibraryItem[];
    users?: User[];
    systemSettings?: Record<string, any>;
  }) => {
    // Snapshot state before overriding with restore
    createCheckpoint('قبل استرجاع وتطبيق بيانات سابقة', {
      projects,
      customerQuotations,
      supplierQuotations,
      purchaseOrders,
      invoices,
      deliveryNotes,
      customers,
      suppliers,
      termsLibrary,
    });

    // Sanitize and heal restored state
    const { sanitizedData } = sanitizeAppState({
      projects: restored.projects || projects,
      customerQuotations: restored.customerQuotations || customerQuotations,
      supplierQuotations: restored.supplierQuotations || supplierQuotations,
      purchaseOrders: restored.purchaseOrders || purchaseOrders,
      invoices: restored.invoices || invoices,
      deliveryNotes: restored.deliveryNotes || deliveryNotes,
    });

    if (restored.projects && Array.isArray(restored.projects)) {
      const normalized = sanitizedData.projects.map((p) => normalizeProject(p));
      setProjects(normalized);
      localStorage.setItem('rmt_projects', JSON.stringify(normalized));
    }
    if (restored.customerQuotations && Array.isArray(restored.customerQuotations)) {
      setCustomerQuotations(sanitizedData.customerQuotations);
      localStorage.setItem('rmt_customer_quotations', JSON.stringify(sanitizedData.customerQuotations));
    }
    if (restored.supplierQuotations && Array.isArray(restored.supplierQuotations)) {
      setSupplierQuotations(sanitizedData.supplierQuotations);
      localStorage.setItem('rmt_supplier_quotations', JSON.stringify(sanitizedData.supplierQuotations));
    }
    if (restored.purchaseOrders && Array.isArray(restored.purchaseOrders)) {
      setPurchaseOrders(sanitizedData.purchaseOrders);
      localStorage.setItem('rmt_purchase_orders', JSON.stringify(sanitizedData.purchaseOrders));
    }
    if (restored.invoices && Array.isArray(restored.invoices)) {
      setInvoices(sanitizedData.invoices);
      localStorage.setItem('rmt_invoices', JSON.stringify(sanitizedData.invoices));
    }
    if (restored.deliveryNotes && Array.isArray(restored.deliveryNotes)) {
      const repairedDNs = repairDeliveryNoteSequences(sanitizedData.deliveryNotes);
      setDeliveryNotes(repairedDNs);
      localStorage.setItem('rmt_delivery_notes', JSON.stringify(repairedDNs));
    }
    if (restored.customers && Array.isArray(restored.customers)) {
      setCustomers(restored.customers);
      localStorage.setItem('rmt_customers', JSON.stringify(restored.customers));
    }
    if (restored.suppliers && Array.isArray(restored.suppliers)) {
      setSuppliers(restored.suppliers);
      localStorage.setItem('rmt_suppliers', JSON.stringify(restored.suppliers));
    }
    if (restored.termsLibrary && Array.isArray(restored.termsLibrary)) {
      setTermsLibrary(restored.termsLibrary);
      localStorage.setItem('rmt_terms_library', JSON.stringify(restored.termsLibrary));
    }
    if (restored.users && Array.isArray(restored.users)) {
      localStorage.setItem('rmt_users', JSON.stringify(restored.users));
    }
    if (restored.systemSettings && typeof restored.systemSettings === 'object') {
      const s = restored.systemSettings;
      const root = document.documentElement;
      const rootEl = document.getElementById('root');
      if (s.primary_color) {
        root.style.setProperty('--color-primary', s.primary_color);
        localStorage.setItem('rmt_primary_color', s.primary_color);
      }
      if (s.accent_color) {
        root.style.setProperty('--color-accent', s.accent_color);
        localStorage.setItem('rmt_accent_color', s.accent_color);
      }
      if (s.font_family) {
        root.style.setProperty('--app-font-family', `'${s.font_family}', 'Plus Jakarta Sans', system-ui, sans-serif`);
        root.style.fontFamily = `'${s.font_family}', 'Plus Jakarta Sans', system-ui, sans-serif`;
        document.body.style.fontFamily = `'${s.font_family}', 'Plus Jakarta Sans', system-ui, sans-serif`;
        localStorage.setItem('rmt_font_family', s.font_family);
      }
      if (s.theme_mode === 'dark') {
        root.classList.add('dark');
        localStorage.setItem('rmt_theme_mode', 'dark');
      } else if (s.theme_mode === 'light') {
        root.classList.remove('dark');
        localStorage.setItem('rmt_theme_mode', 'light');
      }
      if (s.ui_scale && rootEl) {
        rootEl.classList.remove('scale-95', 'scale-100', 'scale-105');
        if (s.ui_scale === 'compact') rootEl.classList.add('scale-95', 'origin-top');
        else if (s.ui_scale === 'large') rootEl.classList.add('scale-105', 'origin-top');
        else rootEl.classList.add('scale-100');
        localStorage.setItem('rmt_ui_scale', s.ui_scale);
      }
    }
    showToast('تمت استعادة وهدرجة كافة شجرات البيانات والإعدادات بنجاح فوري!');
  };

  const activeQuotation =
    customerQuotations.find((q) => q.id === selectedQuotationId) ||
    customerQuotations[0];

  const handleMarkNotificationRead = (notif: NotificationItem) => {
    if (!readNotifIds.includes(notif.id)) {
      const updated = [...readNotifIds, notif.id];
      setReadNotifIds(updated);
      try {
        localStorage.setItem('rmt_read_notifs', JSON.stringify(updated));
        saveReadNotificationIds(updated);
      } catch {}
    }
    if (notif.targetTab) {
      if (canAccessTab(currentUser, notif.targetTab)) {
        setActiveTab(notif.targetTab as any);
        if (notif.targetTab === 'projects' && notif.targetId) {
          setSelectedProjectId(notif.targetId);
        }
      } else {
        showToast('ليس لديك صلاحية الوصول لهذا القسم بناءً على رتبتك الحالية');
      }
    }
    setIsHeaderNotifOpen(false);
  };

  const handleMarkAllNotificationsRead = () => {
    const allIds = smartNotifications.map((n) => n.id);
    setReadNotifIds(allIds);
    try {
      localStorage.setItem('rmt_read_notifs', JSON.stringify(allIds));
      saveReadNotificationIds(allIds);
    } catch {}
    showToast('تم تحديد كافة التنبيهات كمقروءة');
  };

  // If not logged in, render the secure Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div
      dir={currentLang === 'en' ? 'ltr' : 'rtl'}
      className="flex flex-row min-h-[100dvh] h-[100dvh] overflow-hidden font-sans antialiased selection:bg-[#007A5A]/20 selection:text-[#007A5A] bg-[#F1F5F9] dark:bg-[#070D19] text-slate-800 dark:text-slate-100 transition-colors"
    >
      {/* ------------------------------------------------------------- */}
      {/* RIGHT SIDE: SAP-GRADE 6-PILLAR COLLAPSIBLE NAVIGATION SIDEBAR */}
      {/* ------------------------------------------------------------- */}
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onNavigateTab={(tab) => {
          if (canAccessTab(currentUser, tab)) {
            setActiveTab(tab as any);
          } else {
            showToast('ليس لديك صلاحية الوصول لهذا القسم بناءً على رتبتك الحالية');
          }
        }}
        navLabels={navLabels}
        onOpenThreeWayMatch={() => setIsThreeWayModalOpen(true)}
        onOpenClientMaster={() => setIsClientMasterModalOpen(true)}
        onOpenAdminRoles={() => setIsAdminRolesOpen(true)}
        onOpenSignatures={() => setIsSignaturesModalOpen(true)}
        onOpenGoogleDrive={() => setIsGoogleDriveModalOpen(true)}
        onOpenAuditTrail={() => setIsAuditTrailOpen(true)}
        onOpenBackup={() => setIsBackupModalOpen(true)}
        onOpenPreFlight={() => setIsPreFlightOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setActiveTab('projects');
        }}
        onSetStatusBreakdownFilter={(filter) => {
          setStatusBreakdownInitialFilter(filter);
          setActiveTab('status_breakdown');
        }}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* ------------------------------------------------------------- */}
      {/* LEFT SIDE: MAIN APPLICATION CANVAS & SLIM TOP CONTROL BAR     */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 w-full min-w-0 overflow-x-hidden min-h-[100dvh] transition-all duration-300 ease-in-out flex flex-col overflow-y-auto bg-[#F1F5F9] dark:bg-[#070D19] text-slate-900 dark:text-slate-100">
        {/* TOP CONTROL BAR (Responsive Header with Mobile/Tablet Arrow Collapse & Clean Branding) */}
        <header className="sticky top-0 z-20 h-16 sm:h-20 min-h-[4rem] sm:min-h-[5rem] bg-white/95 dark:bg-[#0B1528]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 shadow-sm transition-colors select-none">
          {/* Brand Header & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm sm:text-base lg:text-lg font-black text-[#174A84] dark:text-sky-300 tracking-normal truncate">
                {store.companyIdentity?.officialArabicName || 'شركة صناع الموارد التجاريه'} - RMT
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                ERP v5.5
              </span>
            </div>
          </div>

          {/* Action Controls & Responsive Collapse Hub */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 relative" ref={headerControlsRef}>
            {/* 1. RMT Smart Copilot Launcher (Visible on Tablet md & Desktop lg; on Mobile hidden into Arrow) */}
            <button
              type="button"
              onClick={() => setIsCopilotOpen(true)}
              className="hidden md:flex h-9 sm:h-10 px-3 sm:px-4 bg-gradient-to-r from-[#174A84] to-[#007A5A] hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm items-center gap-2 transition active:scale-95 cursor-pointer shrink-0"
              title={currentLang === 'en' ? 'RMT Smart Copilot & Tender Auditing' : 'مساعد RMT الذكي لدراسة العطاءات والتدقيق الفوري'}
            >
              <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-300 animate-pulse" />
              <span>{t.copilotBtn}</span>
            </button>

            {/* Desktop-Only Inline Buttons (Hidden on Mobile & Tablet, available in Arrow menu) */}
            {/* 2. AI Price Search */}
            <button
              type="button"
              onClick={() => setIsAiPriceSearchOpen(true)}
              className="hidden lg:flex h-9 sm:h-10 px-3.5 bg-amber-500/10 dark:bg-amber-950/30 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 dark:border-amber-500/40 rounded-xl text-xs font-bold shadow-2xs items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              title={currentLang === 'en' ? 'AI Market & Supplier Price Search' : 'بحث ذكي في أسعار السوق والموردين'}
            >
              <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>{t.priceSearchBtn}</span>
            </button>

            {/* 3. System Refresh Button */}
            <button
              type="button"
              onClick={handleSystemRefresh}
              disabled={isRefreshingSystem}
              className={`hidden lg:flex h-9 sm:h-10 px-4 bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white border border-emerald-300/40 rounded-xl text-xs font-black shadow-md shadow-emerald-700/25 items-center justify-center gap-2 transition active:scale-95 cursor-pointer shrink-0 ${
                isRefreshingSystem ? 'opacity-70 cursor-wait' : ''
              }`}
              title={currentLang === 'en' ? 'Refresh System & Sync Records' : 'تحديث المنظومة ومزامنة السجلات فوراً'}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white ${isRefreshingSystem ? 'animate-spin' : ''}`} />
              <span className="inline tracking-wide">{t.refreshBtn}</span>
            </button>

            {/* 4. Google Drive Sync (5TB Active) */}
            <button
              type="button"
              onClick={() => setIsGoogleDriveModalOpen(true)}
              className="hidden lg:flex h-9 sm:h-10 px-3 bg-slate-50/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-2xs items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              title={currentLang === 'en' ? '5TB Google Drive Cloud Archive' : 'الأرشيف السحابي 5TB Google Drive المعتمد'}
            >
              <CloudUpload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-mono">{t.driveSyncedBtn}</span>
            </button>

            {/* 4.1 Autonomous Agents & Telegram Bot Quick Trigger */}
            <button
              type="button"
              onClick={() => setActiveTab('autonomous_agents')}
              className={`hidden lg:flex h-9 sm:h-10 px-3 rounded-xl text-xs font-bold shadow-2xs items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 border ${
                activeTab === 'autonomous_agents'
                  ? 'bg-amber-500 text-slate-950 font-black border-amber-600 shadow-sm'
                  : 'bg-amber-500/10 dark:bg-amber-950/30 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 dark:border-amber-500/40'
              }`}
              title={currentLang === 'en' ? 'Autonomous AI Agents & Telegram Bot Gateway' : 'الوكلاء المستقلون وبوت التليجرام (Telegram AI)'}
            >
              <Bot className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{currentLang === 'en' ? 'AI Agents & Telegram' : 'بوت التليجرام والوكلاء'}</span>
            </button>

            {/* 4.2 System Pre-Flight & Self-Healing Audit */}
            <button
              type="button"
              onClick={() => setIsPreFlightOpen(true)}
              className="hidden lg:flex h-9 sm:h-10 px-3 bg-teal-500/10 dark:bg-teal-950/30 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 dark:border-teal-500/40 rounded-xl text-xs font-bold shadow-2xs items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              title={currentLang === 'en' ? 'Pre-Flight System Health & Self-Healing Audit' : 'فحص سلامة النظام والتحقق قبل النشر'}
            >
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-pulse" />
              <span>{currentLang === 'en' ? 'Health Check' : 'فحص النظام'}</span>
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 hidden lg:block" />

            {/* 5. Dual-Language Switcher [ AR | EN ] - Desktop */}
            <div
              className="hidden lg:flex h-9 sm:h-10 px-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl items-center gap-1 shadow-2xs shrink-0 text-xs font-bold"
              role="group"
              aria-label="Language selector"
            >
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentLang === 'ar'
                    ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="العربية (RTL)"
              >
                AR
              </button>
              <span className="text-slate-300 dark:text-slate-600 text-xs px-0.5 select-none">|</span>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentLang === 'en'
                    ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs border border-slate-200 dark:border-slate-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="English (LTR)"
              >
                EN
              </button>
            </div>

            {/* 5.1 Real-Time Notification Sentinel Bell - Desktop */}
            <div className="hidden lg:block relative" ref={headerNotifRef}>
              <button
                type="button"
                onClick={() => setIsHeaderNotifOpen((prev) => !prev)}
                className="relative h-9 sm:h-10 w-9 sm:w-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center transition cursor-pointer shadow-2xs shrink-0"
                title={t.notificationsTitle}
                aria-label="Notifications Sentinel"
              >
                <Bell className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                {smartNotifications.filter((n) => !n.isRead).length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#0B1528] animate-pulse">
                    {smartNotifications.filter((n) => !n.isRead).length > 99
                      ? '99+'
                      : smartNotifications.filter((n) => !n.isRead).length}
                  </span>
                )}
              </button>

              {/* Floating Sentinel Dropdown Panel */}
              {isHeaderNotifOpen && (
                <div
                  className={`absolute top-full mt-2 w-80 sm:w-96 max-w-[95vw] bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] ${
                    currentLang === 'en' ? 'right-0 origin-top-right' : 'left-0 sm:right-auto sm:left-0 origin-top-left'
                  }`}
                >
                  {/* Dropdown Header */}
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
                          {smartNotifications.filter((n) => !n.isRead).length > 0
                            ? `${smartNotifications.filter((n) => !n.isRead).length} ${currentLang === 'en' ? 'unread alert(s)' : 'تنبيه جديد بحاجة للمتابعة'}`
                            : t.noNotifications}
                        </p>
                      </div>
                    </div>

                    {smartNotifications.filter((n) => !n.isRead).length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        className="text-[10px] font-bold text-[#174A84] dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>{t.markAllRead}</span>
                      </button>
                    )}
                  </div>

                  {/* Category Filter Pills */}
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1 bg-slate-50/40 dark:bg-slate-900/40 overflow-x-auto text-[11px] font-bold">
                    {[
                      { id: 'all', label: t.allNotifications, icon: Filter },
                      { id: 'finance', label: t.financeAlerts, icon: DollarSign },
                      { id: 'logistics', label: t.logisticsAlerts, icon: Truck },
                      { id: 'projects', label: t.projectsAlerts, icon: FolderKanban },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const isSelected = headerNotifCategory === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setHeaderNotifCategory(tab.id as any)}
                          className={`px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#174A84] text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Notification List */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto max-h-[50vh]">
                    {filterNotificationsByCategory(smartNotifications, headerNotifCategory).length === 0 ? (
                      <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                        <p className="text-xs font-semibold">{t.noNotifications}</p>
                      </div>
                    ) : (
                      filterNotificationsByCategory(smartNotifications, headerNotifCategory).map((item) => {
                        const isRead = item.isRead;
                        const isCritical = item.severity === 'critical';
                        const isWarning = item.severity === 'warning';

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleMarkNotificationRead(item)}
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
                              {isCritical ? (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              ) : (
                                <Info className="w-3.5 h-3.5" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <h4
                                  className={`text-xs truncate ${
                                    !isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {currentLang === 'en' ? item.titleEn || item.title : item.title}
                                </h4>
                                {!isRead && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                                {currentLang === 'en' ? item.messageEn || item.message : item.message}
                              </p>
                              <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] text-slate-400 font-mono">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {item.timestamp}
                                </span>
                                <span className="text-[#174A84] dark:text-sky-400 font-bold flex items-center gap-0.5 hover:underline">
                                  {currentLang === 'en' ? 'Open' : 'فتح'}
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

            {/* 6. Theme Mode Toggle - Desktop */}
            <button
              type="button"
              onClick={toggleTheme}
              className="hidden lg:flex h-9 sm:h-10 w-9 sm:w-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl items-center justify-center transition cursor-pointer shadow-2xs shrink-0"
              title={isDarkMode ? t.lightMode : t.darkMode}
              aria-label="Toggle theme mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
            </button>

            {/* 7. User Badge & Profile Button - Desktop */}
            <button
              type="button"
              onClick={() => setIsUserProfileOpen(true)}
              className="hidden lg:flex h-9 sm:h-10 px-3 sm:px-3.5 bg-slate-50/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 items-center gap-2 transition cursor-pointer shadow-2xs shrink-0"
              title={currentLang === 'en' ? 'User Profile & Account Settings' : 'الملف الشخصي وإعدادات الحساب'}
            >
              <div className="w-6 h-6 rounded-full bg-[#174A84] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {currentUser.fullName ? currentUser.fullName.charAt(0) : 'م'}
              </div>
              <span className="truncate max-w-[120px]">{currentUser.fullName || (currentLang === 'en' ? 'Mokhtar Aburozq' : 'مختار أبورزق')}</span>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-200 dark:border-emerald-800">
                {currentUser.role}
              </span>
            </button>

            {/* 8. Logout Button - Desktop */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden lg:flex h-9 sm:h-10 w-9 sm:w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl items-center justify-center transition cursor-pointer shrink-0"
              title={currentLang === 'en' ? 'Sign Out' : 'تسجيل الخروج'}
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* ------------------------------------------------------- */}
            {/* MOBILE & TABLET ARROW TOGGLE BUTTON (lg:hidden)        */}
            {/* ------------------------------------------------------- */}
            <button
              type="button"
              onClick={() => setIsHeaderControlsOpen((prev) => !prev)}
              className={`lg:hidden h-9 px-2.5 sm:px-3 rounded-xl border transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                isHeaderControlsOpen
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title="أدوات المنظومة"
              aria-label="Toggle header tools menu"
            >
              <span className="text-xs font-bold hidden sm:inline">أدوات</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isHeaderControlsOpen ? 'rotate-180 text-white' : 'text-slate-600 dark:text-slate-300'}`} />
              {smartNotifications.filter((n) => !n.isRead).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
              )}
            </button>

            {/* ------------------------------------------------------- */}
            {/* MOBILE / TABLET FLOATING DROPDOWN SHEET                */}
            {/* ------------------------------------------------------- */}
            {isHeaderControlsOpen && (
              <div
                className={`lg:hidden absolute top-full mt-2 w-72 sm:w-80 max-w-[92vw] bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in duration-150 ${
                  currentLang === 'en' ? 'right-0' : 'left-0'
                }`}
              >
                {/* Mobile Copilot (shown on mobile < md) */}
                <div className="md:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderControlsOpen(false);
                      setIsCopilotOpen(true);
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
                      setIsHeaderControlsOpen(false);
                      setIsGoogleDriveModalOpen(true);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <CloudUpload className="w-4 h-4 text-blue-500" />
                    <span className="truncate">{t.driveSyncedBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderControlsOpen(false);
                      handleSystemRefresh();
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 text-emerald-500 ${isRefreshingSystem ? 'animate-spin' : ''}`} />
                    <span className="truncate">{t.refreshBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderControlsOpen(false);
                      setIsAiPriceSearchOpen(true);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="truncate">{t.priceSearchBtn}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderControlsOpen(false);
                      setIsHeaderNotifOpen(true);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-rose-500" />
                      <span className="truncate">{t.notificationsTitle}</span>
                    </div>
                    {smartNotifications.filter((n) => !n.isRead).length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black">
                        {smartNotifications.filter((n) => !n.isRead).length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderControlsOpen(false);
                      setIsPreFlightOpen(true);
                    }}
                    className="p-2.5 rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/70 dark:bg-teal-950/40 hover:bg-teal-100 text-teal-800 dark:text-teal-200 text-xs font-semibold flex items-center gap-2 transition cursor-pointer col-span-2"
                  >
                    <Activity className="w-4 h-4 text-teal-500 animate-pulse" />
                    <span className="truncate">{currentLang === 'en' ? 'System Health & Pre-Flight Audit' : 'فحص سلامة النظام والتحقق قبل النشر'}</span>
                  </button>
                </div>

                {/* Profile & Logout Row */}
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div
                    onClick={() => {
                      setIsHeaderControlsOpen(false);
                      setIsUserProfileOpen(true);
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#174A84] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {currentUser.fullName ? currentUser.fullName.charAt(0) : 'م'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                        {currentUser.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{currentUser.role}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsHeaderControlsOpen(false);
                      handleLogout();
                    }}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title={currentLang === 'en' ? 'Sign Out' : 'تسجيل الخروج'}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                {/* Language & Theme Controls Row */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="h-8 px-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setLanguage('ar')}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                        currentLang === 'ar' ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      AR
                    </button>
                    <span className="text-slate-300 dark:text-slate-600 text-xs select-none">|</span>
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer ${
                        currentLang === 'en' ? 'bg-white dark:bg-slate-700 text-[#174A84] dark:text-sky-300 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      EN
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {isDarkMode ? (
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
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Global Notification Toast */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Offline Status Indicator */}
        <OfflineIndicator />

        {/* Main Content Area - Full-Width (100%) Layout */}
        <main className="flex-1 w-full min-w-0 overflow-x-hidden transition-all duration-300 ease-in-out p-3 sm:p-5 lg:p-8 xl:p-10">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            projects={projects}
            customerQuotations={customerQuotations}
            supplierQuotations={supplierQuotations}
            invoices={invoices}
            purchaseOrders={purchaseOrders}
            isModernView={isModernView}
            onOpenUploadSupplierModal={() => setIsUploadSupplierOpen(true)}
            onOpenBusinessCardModal={() => setIsBusinessCardOpen(true)}
            onSelectProject={(projId) => {
              setSelectedProjectId(projId);
              setActiveTab('projects');
            }}
            onSelectQuotation={(quoteId) => {
              setSelectedQuotationId(quoteId);
              setActiveTab('quotations');
            }}
            onCreateNewProject={() => {
              setSelectedProjectId(null);
              setActiveTab('projects');
            }}
            onOpenStatusBreakdown={(filter) => {
              setStatusBreakdownInitialFilter(filter || 'all');
              setActiveTab('status_breakdown');
            }}
            onDeleteCustomerQuotation={handleDeleteCustomerQuotation}
            onDeleteSupplierQuotation={handleDeleteSupplierQuotation}
            onDeleteProject={handleDeleteProject}
            onUpdateProjectName={handleUpdateProjectName}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'estimating_workbench' && (
          <EstimatingWorkbenchView
            currentUser={currentUser}
            estimates={estimates}
            onSaveEstimate={(savedEst) => {
              setEstimates((prev) => {
                const idx = prev.findIndex((e) => e.id === savedEst.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = savedEst;
                  return updated;
                }
                return [savedEst, ...prev];
              });
              showToast(`تم حفظ دراسة العطاء ${savedEst.estimateNumber} بنجاح.`);
            }}
            onPromoteToProject={(est) => {
              const newProj: Project = {
                id: `proj-${Date.now()}`,
                projectNumber: `PRJ-${new Date().getFullYear()}-${String(projects.length + 1).padStart(3, '0')}`,
                name: est.projectName,
                customerId: est.clientMasterId,
                customerName: est.clientCompanyName,
                location: est.projectLocation,
                projectType: 'EPC',
                selectedSystems: est.disciplines,
                systems: est.disciplines,
                status: 'Won',
                executionStatus: 'قيد التنفيذ',
                completionPercentage: 0,
                contractValue: est.totalSellingPrice,
                budget: est.totalSellingPrice,
                retentionPercent: 10,
                retentionAmount: est.totalSellingPrice * 0.10,
                retentionStatus: 'Held',
                advancePaymentAmount: est.totalSellingPrice * 0.10,
                startDate: new Date().toISOString().split('T')[0],
                targetCompletionDate: new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
                projectManager: currentUser?.fullName || 'Eng. Mokhtar Abu Rizq',
                supplierQuotationIds: [],
                customerQuotationIds: [],
                timelineProgress: 0,
                incurredCosts: [],
                notes: `تم اعتماد المشروع وترقيته آلياً من دراسة العطاء ${est.estimateNumber}. التكلفة المباشرة: ${est.directCostTotal} SAR`,
                documents: [],
                createdAt: new Date().toISOString(),
              };

              setProjects((prev) => [newProj, ...prev]);
              setSelectedProjectId(newProj.id);
              setActiveTab('projects');
              showToast(`تم إنشاء وترقية المشروع ${newProj.projectNumber} (${newProj.name}) إلى حيز التنفيذ!`);
            }}
          />
        )}

        {activeTab === 'cash_flow_sentinel' && (
          <CashFlowSentinelView
            currentUser={currentUser}
            projects={projects}
            invoices={invoices}
            purchaseOrders={purchaseOrders}
            customerQuotations={customerQuotations}
            deliveryNotes={deliveryNotes}
          />
        )}

        {activeTab === 'autonomous_agents' && (
          <AutonomousAgentsHub
            currentUser={currentUser}
            projects={projects}
            customerQuotations={customerQuotations}
            purchaseOrders={purchaseOrders}
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            onNavigateTab={(tab, paramId) => {
              if (paramId && tab === 'projects') {
                setSelectedProjectId(paramId);
              }
              setActiveTab(tab as any);
            }}
          />
        )}

        {(activeTab === 'procurement_mgmt' || activeTab === 'purchase_orders') && (
          <ProcurementHub
            currentUser={currentUser}
            purchaseOrders={purchaseOrders}
            supplierQuotations={supplierQuotations}
            suppliers={suppliers}
            projects={projects}
            threeWayMatches={threeWayMatches}
            onOpenNewPO={(projId, quoteId) => {
              setPoTargetProjectId(projId);
              setPoSourceSupplierQuoteId(quoteId);
              setEditingPO(null);
              setIsPOModalOpen(true);
            }}
            onEditPO={(po) => {
              setEditingPO(po);
              setPoTargetProjectId(po.projectId);
              setPoSourceSupplierQuoteId(undefined);
              setIsPOModalOpen(true);
            }}
            onUpdatePO={(updatedPO) => {
              setPurchaseOrders((prev) =>
                prev.map((po) => (po.id === updatedPO.id ? updatedPO : po))
              );
            }}
            onDeletePO={(poId) => {
              setPurchaseOrders((prev) => prev.filter((po) => po.id !== poId));
              showToast('تم حذف أمر الشراء بنجاح.');
            }}
            onSelectProject={(projId) => {
              setSelectedProjectId(projId);
              setActiveTab('projects');
            }}
            onOpenUploadSupplierQuote={() => setIsUploadSupplierOpen(true)}
            onSelectSupplierQuote={(quoteId) => {
              setSelectedQuotationId(quoteId);
              setActiveTab('supplier_quotations');
            }}
            onOpenThreeWayModal={() => setIsThreeWayModalOpen(true)}
            onUpdateThreeWayMatch={(record) => {
              setThreeWayMatches((prev) => {
                const next = [record, ...prev.filter((r) => r.id !== record.id && r.poId !== record.poId)];
                localStorage.setItem('rmt_three_way_matches', JSON.stringify(next));
                return next;
              });
            }}
          />
        )}

        {activeTab === 'site_logistics' && (
          <SiteLogisticsHub
            currentUser={currentUser}
            projects={projects}
            purchaseOrders={purchaseOrders}
            deliveryNotes={deliveryNotes}
            customerQuotations={customerQuotations}
            invoices={invoices}
            onSaveDeliveryNote={handleCreateDeliveryNote}
            onUpdateDeliveryNote={handleUpdateDeliveryNote}
            onDeleteDeliveryNote={handleDeleteDeliveryNote}
            onSaveMaterialReceipt={(poId, receipt, updatedPOItems) => {
              setPurchaseOrders((prev) =>
                prev.map((po) => {
                  if (po.id === poId) {
                    return {
                      ...po,
                      items: updatedPOItems,
                      materialReceipts: [...(po.materialReceipts || []), receipt],
                      deliveryStatus: updatedPOItems.every((it) => (it.deliveredQty || 0) >= it.quantity)
                        ? 'Delivered'
                        : 'Partial Delivered',
                      fulfillmentStatus: updatedPOItems.every((it) => (it.deliveredQty || 0) >= it.quantity)
                        ? 'Fully Received'
                        : 'In Delivery / Partial',
                    };
                  }
                  return po;
                })
              );
            }}
            onSelectProject={(projId) => {
              setSelectedProjectId(projId);
              setActiveTab('projects');
            }}
            onOpenCreateInvoiceForDN={handleOpenCreateInvoiceForDN}
            onCreateInvoice={handleCreateInvoice}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onUpdateProject={(p) => setProjects((prev) => prev.map((proj) => (proj.id === p.id ? p : proj)))}
          />
        )}

        {activeTab === 'status_breakdown' && (
          <ProjectStatusBreakdownView
            projects={projects}
            customerQuotations={customerQuotations}
            purchaseOrders={purchaseOrders}
            initialFilter={statusBreakdownInitialFilter}
            onSelectProject={(projId) => {
              setSelectedProjectId(projId);
              setActiveTab('projects');
            }}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onDeleteProject={handleDeleteProject}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesAccountingView
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            projects={projects}
            quotations={customerQuotations}
            purchaseOrders={purchaseOrders}
            customers={customers}
            onSelectProject={(projId) => {
              setSelectedProjectId(projId);
              setActiveTab('projects');
            }}
            onCreateInvoice={handleCreateInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onRecordPayment={handleRecordPayment}
            onDeletePayment={handleDeletePayment}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={projects}
            customerQuotations={customerQuotations}
            supplierQuotations={supplierQuotations}
            purchaseOrders={purchaseOrders}
            invoices={invoices}
            deliveryNotes={deliveryNotes}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onSelectQuotation={(quoteId) => {
              setSelectedQuotationId(quoteId);
              setActiveTab('quotations');
            }}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onUpdateProjectStatus={handleUpdateProjectStatus}
            onSaveClientContractPO={handleSaveClientContractPO}
            onUpdateProjectExecutionStatus={handleUpdateProjectExecutionStatus}
            onUpdateAdvancePayment={handleUpdateAdvancePayment}
            onUpdateRetention={handleUpdateRetention}
            onAddCostRecord={handleAddCostRecord}
            termsLibrary={termsLibrary}
            onIssueCustomerQuotation={handleIssueCustomerQuotationFromProject}
            onOpenUploadSupplierModal={(projId) => {
              setSelectedProjectId(projId);
              setIsUploadSupplierOpen(true);
            }}
            onOpenNewPOModal={handleOpenNewPO}
            onSelectPO={() => {
              setActiveTab('purchase_orders');
            }}
            onCreateInvoice={handleCreateInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onCreateDeliveryNote={handleCreateDeliveryNote}
            onUpdateDeliveryNote={handleUpdateDeliveryNote}
            onDeleteDeliveryNote={handleDeleteDeliveryNote}
            onRecordPayment={handleRecordPayment}
            onDeletePayment={handleDeletePayment}
            onUpdateItemDeliveryStatus={handleUpdateItemDeliveryStatus}
            onUpdateSupplierQuoteItems={handleUpdateSupplierQuoteItems}
            onDeleteSupplierQuotation={handleDeleteSupplierQuotation}
            onUpdateProjectName={handleUpdateProjectName}
            onPatchProject={handlePatchProject}
            onUpdateProjectDocuments={(pId, docs) => {
              setProjects((prev) =>
                prev.map((p) => (p.id === pId ? { ...p, documents: docs } : p))
              );
              showToast('تم تحديث قائمة الوثائق السحابية بنجاح.');
            }}
            onUpdateMasterDriveUrl={(pId, driveUrl) => {
              setProjects((prev) =>
                prev.map((p) => (p.id === pId ? { ...p, masterDriveFolderUrl: driveUrl } : p))
              );
              showToast('تم حفظ رابط مجلد Google Drive بنجاح.');
            }}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'quotations' && (
          <QuotationsView
            projects={projects}
            customerQuotations={customerQuotations}
            supplierQuotations={supplierQuotations}
            termsLibrary={termsLibrary}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            selectedQuotationId={selectedQuotationId}
            onSelectQuotation={setSelectedQuotationId}
            onSaveQuotation={handleSaveQuotation}
            onCreateNewVersion={handleCreateNewVersion}
            onIssueCustomerQuotation={handleIssueCustomerQuotationFromProject}
            onDeleteCustomerQuotation={handleDeleteCustomerQuotation}
            onDeleteSupplierQuotation={handleDeleteSupplierQuotation}
            onOpenUploadSupplierModal={(projId) => {
              setSelectedProjectId(projId);
              setIsUploadSupplierOpen(true);
            }}
          />
        )}

        {activeTab === 'purchase_orders' && (
          <PurchaseOrdersView
            purchaseOrders={purchaseOrders}
            projects={projects}
            supplierQuotations={supplierQuotations}
            suppliers={suppliers}
            customerQuotations={customerQuotations}
            archivedPricedItems={archivedPricedItems}
            deliveryNotes={deliveryNotes}
            onCreateDeliveryNote={handleCreateDeliveryNote}
            onUpdateDeliveryNote={handleUpdateDeliveryNote}
            onDeleteDeliveryNote={handleDeleteDeliveryNote}
            onOpenNewPOModal={handleOpenNewPO}
            onEditPO={handleEditPO}
            onDeletePO={handleDeletePO}
            onUpdateStatus={handleUpdatePOStatus}
            onOpenUploadSupplierModal={() => setIsUploadSupplierOpen(true)}
            onIssuePOWithItem={handleIssuePOWithPricedItem}
            onSaveMaterialReceipt={handleSaveMaterialReceipt}
            onInvoiceToClient={handleInvoiceReceivedMaterials}
            onOpenCreateInvoiceForDN={handleOpenCreateInvoiceForDN}
            onOpenCreateInvoiceForDNs={handleOpenCreateInvoiceForDNs}
            onSavePOPayment={handleUpdatePO}
            onDeleteMaterialReceipt={handleDeleteMaterialReceipt}
            onResetPOReceipts={handleResetPOReceipts}
          />
        )}

        {activeTab === 'supplier_quotations' && (
          <SupplierQuotationsView
            supplierQuotations={supplierQuotations}
            suppliers={suppliers}
            projects={projects}
            onUpdateSupplierQuoteItems={handleUpdateSupplierQuoteItems}
            onDeleteSupplierQuotation={handleDeleteSupplierQuotation}
            onOpenNewPOModal={handleOpenNewPO}
            onOpenUploadSupplierModal={() => setIsUploadSupplierOpen(true)}
            onConvertToCustomerQuote={handleConvertSupplierQuoteToCustomerQuote}
            onOpenGoogleDriveSync={() => setIsGoogleDriveModalOpen(true)}
          />
        )}

        {(activeTab === 'directory' || activeTab === 'suppliers' || activeTab === 'customers') && (
          <DirectoryView
            customers={customers}
            suppliers={suppliers}
            initialTab={activeTab === 'customers' ? 'customers' : 'suppliers'}
            onOpenBusinessCardModal={() => setIsBusinessCardOpen(true)}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
          />
        )}

        {activeTab === 'terms' && (
          <TermsLibraryView
            termsLibrary={termsLibrary}
            onUpdateTermsLibrary={(updated) => {
              setTermsLibrary(updated);
              showToast('تم تحديث مكتبة الشروط والأحكام بنجاح');
            }}
          />
        )}

        {activeTab === 'settings' && isSuperAdmin(currentUser) && (
          <SystemSettingsView
            currentUser={currentUser}
            onOpenAuditTrail={() => setIsAuditTrailOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenGoogleDriveSync={() => setIsGoogleDriveModalOpen(true)}
            onOpenPreFlight={() => setIsPreFlightOpen(true)}
            onOpenUserManagement={() => setIsAdminRolesOpen(true)}
            onLabelsUpdated={(updatedLabels) => setNavLabels(updatedLabels)}
          />
        )}
      </main>
      </div>

      {/* RMT AI Copilot Drawer (Side-Drawer Assistant) */}
      <RmtCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        currentUser={currentUser}
        projects={projects}
        customerQuotations={customerQuotations}
        supplierQuotations={supplierQuotations}
        onNavigateTab={(tab) => {
          if (canAccessTab(currentUser, tab)) {
            setActiveTab(tab as any);
          } else {
            showToast('ليس لديك صلاحية الوصول لهذا القسم بناءً على رتبتك الحالية');
          }
        }}
      />

      {/* Immutable Audit Trail Modal */}
      <AuditTrailModal
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
        currentUser={currentUser}
      />

      {/* Modal 1: Upload Supplier Quotation (Mandated Green Flow) */}
      {isUploadSupplierOpen && (
        <UploadSupplierQuotationModal
          isOpen={isUploadSupplierOpen}
          onClose={() => setIsUploadSupplierOpen(false)}
          projects={projects}
          suppliers={suppliers}
          selectedProjectId={selectedProjectId || undefined}
          onQuotationExtracted={handleQuotationExtracted}
        />
      )}

      {/* Modal 2: Business Card Scanner Modal */}
      {isBusinessCardOpen && (
        <BusinessCardModal
          isOpen={isBusinessCardOpen}
          onClose={() => setIsBusinessCardOpen(false)}
          onAddCustomer={handleAddCustomer}
          onAddSupplier={handleAddSupplier}
        />
      )}

      {/* Modal 3: Purchase Order Management & Issuing Modal */}
      {isPOModalOpen && (
        <PurchaseOrderModal
          isOpen={isPOModalOpen}
          onClose={() => {
            setIsPOModalOpen(false);
            setEditingPO(null);
            setPrefillPricedItem(null);
          }}
          onSave={handleSavePO}
          currentUser={currentUser}
          projects={projects}
          supplierQuotations={supplierQuotations}
          suppliers={suppliers}
          existingPurchaseOrders={purchaseOrders}
          initialPO={editingPO}
          preselectedProjectId={poTargetProjectId}
          preselectedSupplierQuoteId={poSourceSupplierQuoteId}
          prefillPricedItem={prefillPricedItem}
        />
      )}

      {/* AI Price Search Modal */}
      {isAiPriceSearchOpen && (
        <AiPriceSearchModal
          isOpen={isAiPriceSearchOpen}
          onClose={() => setIsAiPriceSearchOpen(false)}
          onAddItemToLibrary={(item) => {
            showToast(`تمت إضافة الصنف "${item.description}" إلى قائمة التسعير بنجاح.`);
          }}
        />
      )}

      {/* Data Backup & Restore Modal */}
      {isBackupModalOpen && (
        <DataBackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          currentData={{
            projects,
            customerQuotations,
            supplierQuotations,
            purchaseOrders,
            invoices,
            deliveryNotes,
            customers,
            suppliers,
            termsLibrary,
            users: getAllUsers(),
          }}
          onRestoreData={handleRestoreData}
        />
      )}

      {/* Google Drive Personal Cloud Storage & Real-Time Sync Modal */}
      {isGoogleDriveModalOpen && (
        <GoogleDriveSyncModal
          isOpen={isGoogleDriveModalOpen}
          onClose={() => setIsGoogleDriveModalOpen(false)}
          currentState={{
            projects,
            customerQuotations,
            supplierQuotations,
            purchaseOrders,
            invoices,
            deliveryNotes,
            customers,
            suppliers,
            termsLibrary,
          }}
          onStateRestored={(restored) => {
            handleRestoreData(restored);
            showToast('تمت استعادة كافة البيانات وعروض الأسعار بنجاح من حساب Google Drive الشخصي!');
          }}
        />
      )}

      {/* Pre-Flight System Health & Self-Healing Diagnostic Modal */}
      {isPreFlightOpen && (
        <PreFlightModal
          isOpen={isPreFlightOpen}
          onClose={() => setIsPreFlightOpen(false)}
          onSystemRepaired={handleSystemRefresh}
        />
      )}

      {/* Signatures Management Modal (Restricted to Admin & PM only) */}
      {isSignaturesModalOpen && isExecutiveAdmin(currentUser) && (
        <SignaturesManagementModal
          isOpen={isSignaturesModalOpen}
          onClose={() => setIsSignaturesModalOpen(false)}
        />
      )}

      {/* User Profile & Account Settings Modal */}
      {isUserProfileOpen && currentUser && (
        <UserProfileModal
          isOpen={isUserProfileOpen}
          user={currentUser}
          onClose={() => setIsUserProfileOpen(false)}
          onUserUpdated={(updated) => {
            setCurrentUser(updated);
            showToast('تم تحديث بيانات الحساب والصورة الشخصية بنجاح');
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Admin Role Management & RBAC Gateway Modal */}
      {isAdminRolesOpen && currentUser && isExecutiveAdmin(currentUser) && (
        <AdminRoleManagementModal
          isOpen={isAdminRolesOpen}
          currentUser={currentUser}
          onClose={() => setIsAdminRolesOpen(false)}
          onUsersListUpdated={() => {
            showToast('تم تحديث أدوار وصلاحيات النظام بنجاح');
          }}
        />
      )}

      {/* Global Create Project Invoice Modal (from Delivery Notes / PO View / etc.) */}
      {invoiceModalConfig.isOpen && invoiceModalConfig.project && (
        <CreateProjectInvoiceModal
          project={invoiceModalConfig.project}
          activeQuotation={customerQuotations.find(
            (q) =>
              q.id === invoiceModalConfig.project?.activeCustomerQuotationId ||
              q.projectId === invoiceModalConfig.project?.id ||
              (invoiceModalConfig.project?.name && q.projectName === invoiceModalConfig.project?.name)
          )}
          existingInvoices={invoices}
          deliveryNotes={deliveryNotes}
          purchaseOrders={purchaseOrders.filter(
            (po) => po.projectId === invoiceModalConfig.project?.id
          )}
          initialSelectedDeliveryNoteIds={invoiceModalConfig.initialSelectedDeliveryNoteIds}
          onClose={() => setInvoiceModalConfig({ isOpen: false })}
          onSaveInvoice={(newInv) => {
            handleCreateInvoice(newInv);
            setInvoiceModalConfig({ isOpen: false });
          }}
        />
      )}

      {/* 3-Way Matching Disbursement Control Modal */}
      {isThreeWayModalOpen && (
        <ThreeWayMatchingModal
          isOpen={isThreeWayModalOpen}
          onClose={() => setIsThreeWayModalOpen(false)}
          currentUser={currentUser}
          matchRecords={threeWayMatches}
          purchaseOrders={purchaseOrders}
          deliveryNotes={deliveryNotes}
          onSaveRecord={(updatedRec) => {
            setThreeWayMatches((prev) =>
              prev.map((r) => (r.id === updatedRec.id ? updatedRec : r))
            );
            localStorage.setItem(
              'rmt_three_way_matches',
              JSON.stringify(
                threeWayMatches.map((r) => (r.id === updatedRec.id ? updatedRec : r))
              )
            );
          }}
        />
      )}

      {/* Client Master Directory & Framework Contracts Modal */}
      {isClientMasterModalOpen && (
        <ClientMasterDirectoryModal
          isOpen={isClientMasterModalOpen}
          onClose={() => setIsClientMasterModalOpen(false)}
          currentUser={currentUser}
          clients={clientMasters}
          onSaveClient={(newClient) => {
            setClientMasters((prev) => {
              const exists = prev.some((c) => c.customerId === newClient.customerId);
              const next = exists
                ? prev.map((c) => (c.customerId === newClient.customerId ? newClient : c))
                : [newClient, ...prev];
              localStorage.setItem('rmt_client_masters', JSON.stringify(next));
              return next;
            });
          }}
        />
      )}
    </div>
  );
}

export default App;
