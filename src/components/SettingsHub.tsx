import React, { useState, useEffect } from 'react';
import {
  Building2,
  Percent,
  Hash,
  Users,
  Palette,
  Sliders,
  Check,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  Eye,
  Key,
  Mail,
  User as UserIcon,
  Sun,
  Moon,
  Type,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Truck,
  Receipt,
  Download,
  Upload,
  ShieldAlert,
  Activity,
  Bot,
  Radio,
  Zap,
  Send,
  Loader2,
} from 'lucide-react';
import { telegramBridge } from '../services/TelegramBridge';
import { User, UserRole, UserPermissions } from '../types';
import { COMPANY_PROFILE } from '../data/initialData';
import {
  getNavigationLabels,
  saveNavigationLabels,
  resetNavigationLabels,
  DEFAULT_NAVIGATION_LABELS,
  NavigationLabels,
} from '../utils/navigationConfig';
import { getAllUsers, saveAllUsers, INITIAL_USERS } from '../utils/authService';
import { hashPassword } from '../security/AuthSecurity';
import { saveToCloudDatabase } from '../services/cloudDriveSync';
import { isSuperAdmin, getDefaultPermissionsForRole } from '../utils/rbacUtils';
import { getUserRoleBadge } from '../store/userSlice';
import { createCheckpoint } from '../utils/snapshotManager';
import { resetAllTransactionalDataToZero } from '../services/systemSelfHealing';
import { useSettings } from '../context/SettingsContext';
import {
  commitMasterEnterpriseState,
  useMasterEnterpriseStore,
  DEFAULT_NAVIGATION_PILLARS,
  CompanyIdentitySchema,
} from '../store/masterEnterpriseStore';

interface SettingsHubProps {
  currentUser: User | null;
  onOpenAuditTrail: () => void;
  onOpenBackupModal: () => void;
  onOpenGoogleDriveSync: () => void;
  onOpenPreFlight?: () => void;
  onOpenUserManagement?: () => void;
  onLabelsUpdated?: (newLabels: NavigationLabels) => void;
}

export const SettingsHub: React.FC<SettingsHubProps> = ({
  currentUser,
  onOpenAuditTrail,
  onOpenBackupModal,
  onOpenGoogleDriveSync,
  onOpenPreFlight,
  onLabelsUpdated,
}) => {
  const {
    store,
    companyIdentity: storeCompanyIdentity,
    navigationPillars: storeNavigationPillars,
    menuCustomization: storeMenuCustomization,
  } = useMasterEnterpriseStore();
  const { t, settings } = useSettings();
  const isEn = settings.language === 'en';
  const [activeTab, setActiveTab] = useState<'identity' | 'financial' | 'numbering' | 'rbac' | 'theme' | 'navigation' | 'telegram' | 'maintenance'>('identity');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Tab: Telegram Bot & Connection Ping Test
  const [telegramToken, setTelegramToken] = useState(() => {
    try {
      const cfg = localStorage.getItem('rmt_telegram_config');
      if (cfg) return JSON.parse(cfg).botToken || '';
      return localStorage.getItem('rmt_telegram_bot_token') || '';
    } catch {
      return '';
    }
  });
  const [telegramChatId, setTelegramChatId] = useState(() => {
    try {
      const cfg = localStorage.getItem('rmt_telegram_config');
      if (cfg) return (JSON.parse(cfg).authorizedChatIds && JSON.parse(cfg).authorizedChatIds[0]) || '';
      return localStorage.getItem('rmt_telegram_chat_id') || '';
    } catch {
      return '';
    }
  });
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{
    success: boolean;
    message: string;
    botInfo?: any;
    latencyMs?: number;
    pingSent?: boolean;
    error?: string;
  } | null>(null);

  const handleTestTelegramConnection = async () => {
    if (!telegramToken.trim()) {
      setTelegramTestResult({
        success: false,
        message: 'يرجى إدخال رمز بوت التليجرام (Telegram Bot Token) للبدء.',
      });
      return;
    }
    setIsTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      telegramBridge.updateToken(telegramToken.trim());
      const cfg = telegramBridge.getConfig();
      cfg.botToken = telegramToken.trim();
      if (telegramChatId.trim()) cfg.authorizedChatIds = [telegramChatId.trim()];
      telegramBridge.saveConfigToStorage(cfg);
      localStorage.setItem('rmt_telegram_bot_token', telegramToken.trim());
      if (telegramChatId.trim()) localStorage.setItem('rmt_telegram_chat_id', telegramChatId.trim());

      const res = await telegramBridge.testConnection({
        customToken: telegramToken.trim(),
        chatId: telegramChatId.trim() || undefined,
        sendPingMessage: Boolean(telegramChatId.trim()),
      });
      setTelegramTestResult(res);
    } catch (err: any) {
      setTelegramTestResult({
        success: false,
        message: `فشل فحص الاتصال: ${err.message}`,
        error: err.message,
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // Tab A: Company Official Identity
  const [companyNameAr, setCompanyNameAr] = useState(() => storeCompanyIdentity?.officialArabicName || store.corporate?.nameAr || localStorage.getItem('rmt_company_name_ar') || COMPANY_PROFILE.nameAr);
  const [companyNameEn, setCompanyNameEn] = useState(() => storeCompanyIdentity?.officialEnglishName || store.corporate?.nameEn || localStorage.getItem('rmt_company_name_en') || COMPANY_PROFILE.nameEn);
  const [crNumber, setCrNumber] = useState(() => storeCompanyIdentity?.crNumber || store.corporate?.crNumber || localStorage.getItem('rmt_cr_number') || COMPANY_PROFILE.crNumber);
  const [vatNumber, setVatNumber] = useState(() => storeCompanyIdentity?.vatNumber || store.corporate?.vatNumber || localStorage.getItem('rmt_vat_number') || COMPANY_PROFILE.vatNumber);
  const [bankName, setBankName] = useState(() => storeCompanyIdentity?.bankName || store.corporate?.bankName || localStorage.getItem('rmt_bank_name') || COMPANY_PROFILE.bankName);
  const [bankIban, setBankIban] = useState(() => storeCompanyIdentity?.iban || store.corporate?.bankIban || localStorage.getItem('rmt_bank_iban') || COMPANY_PROFILE.bankIban);
  const [bankSwift, setBankSwift] = useState(() => storeCompanyIdentity?.bankSwift || store.corporate?.bankSwift || localStorage.getItem('rmt_bank_swift') || COMPANY_PROFILE.bankSwift);
  const [autoSignatures, setAutoSignatures] = useState(() => storeCompanyIdentity?.autoSealAndSignature ?? store.corporate?.autoSignatures ?? (localStorage.getItem('rmt_auto_signatures') !== 'false'));
  const [companyLogoUrl, setCompanyLogoUrl] = useState(() => storeCompanyIdentity?.logoUrl || store.corporate?.logoUrl || localStorage.getItem('rmt_company_logo') || '');

  // Tab F: 6 Navigation Pillars (SSOT Standardized Architecture)
  const [p1Label, setP1Label] = useState(() => storeNavigationPillars?.p1_label || DEFAULT_NAVIGATION_PILLARS.p1_label);
  const [p2Label, setP2Label] = useState(() => storeNavigationPillars?.p2_label || DEFAULT_NAVIGATION_PILLARS.p2_label);
  const [p3Label, setP3Label] = useState(() => storeNavigationPillars?.p3_label || DEFAULT_NAVIGATION_PILLARS.p3_label);
  const [p4Label, setP4Label] = useState(() => storeNavigationPillars?.p4_label || DEFAULT_NAVIGATION_PILLARS.p4_label);
  const [p5Label, setP5Label] = useState(() => storeNavigationPillars?.p5_label || DEFAULT_NAVIGATION_PILLARS.p5_label);
  const [p6Label, setP6Label] = useState(() => storeNavigationPillars?.p6_label || DEFAULT_NAVIGATION_PILLARS.p6_label);

  // Tab F: Menu Customization (Sub-labels)
  const [projectsLabel, setProjectsLabel] = useState(() => storeMenuCustomization?.projectsLabel || "المشاريع والعمليات");
  const [quotationsLabel, setQuotationsLabel] = useState(() => storeMenuCustomization?.quotationsLabel || "عروض الأسعار والتسعير");
  const [procurementLabel, setProcurementLabel] = useState(() => storeMenuCustomization?.procurementLabel || "المشتريات والتوريد");
  const [financeLabel, setFinanceLabel] = useState(() => storeMenuCustomization?.financeLabel || "المالية والفواتير");
  const [siteExecutionLabel, setSiteExecutionLabel] = useState(() => storeMenuCustomization?.siteExecutionLabel || "التنفيذ والمتابعة الميدانية");
  const [navLabels, setNavLabels] = useState<NavigationLabels>(() => store.navigation?.labels || getNavigationLabels());

  // Reactively hydrate from store whenever store updates (e.g., from backup import, reset, or cross-tab sync)
  useEffect(() => {
    if (storeCompanyIdentity) {
      setCompanyNameAr(storeCompanyIdentity.officialArabicName || store.corporate?.nameAr || COMPANY_PROFILE.nameAr);
      setCompanyNameEn(storeCompanyIdentity.officialEnglishName || store.corporate?.nameEn || COMPANY_PROFILE.nameEn);
      setCrNumber(storeCompanyIdentity.crNumber || store.corporate?.crNumber || COMPANY_PROFILE.crNumber);
      setVatNumber(storeCompanyIdentity.vatNumber || store.corporate?.vatNumber || COMPANY_PROFILE.vatNumber);
      setBankName(storeCompanyIdentity.bankName || store.corporate?.bankName || COMPANY_PROFILE.bankName);
      setBankIban(storeCompanyIdentity.iban || store.corporate?.bankIban || COMPANY_PROFILE.bankIban);
      setBankSwift(storeCompanyIdentity.bankSwift || store.corporate?.bankSwift || COMPANY_PROFILE.bankSwift);
      setAutoSignatures(storeCompanyIdentity.autoSealAndSignature ?? store.corporate?.autoSignatures ?? true);
      setCompanyLogoUrl(storeCompanyIdentity.logoUrl || store.corporate?.logoUrl || '');
    }
    if (store.navigationPillars) {
      setP1Label(store.navigationPillars.p1_label || DEFAULT_NAVIGATION_PILLARS.p1_label);
      setP2Label(store.navigationPillars.p2_label || DEFAULT_NAVIGATION_PILLARS.p2_label);
      setP3Label(store.navigationPillars.p3_label || DEFAULT_NAVIGATION_PILLARS.p3_label);
      setP4Label(store.navigationPillars.p4_label || DEFAULT_NAVIGATION_PILLARS.p4_label);
      setP5Label(store.navigationPillars.p5_label || DEFAULT_NAVIGATION_PILLARS.p5_label);
      setP6Label(store.navigationPillars.p6_label || DEFAULT_NAVIGATION_PILLARS.p6_label);
    }
    if (storeMenuCustomization) {
      setProjectsLabel(storeMenuCustomization.projectsLabel || "المشاريع والعمليات");
      setQuotationsLabel(storeMenuCustomization.quotationsLabel || "عروض الأسعار والتسعير");
      setProcurementLabel(storeMenuCustomization.procurementLabel || "المشتريات والتوريد");
      setFinanceLabel(storeMenuCustomization.financeLabel || "المالية والفواتير");
      setSiteExecutionLabel(storeMenuCustomization.siteExecutionLabel || "التنفيذ والمتابعة الميدانية");
    }
    if (store.navigation?.labels) {
      setNavLabels(store.navigation.labels);
    }
  }, [store.lastCommittedAt, storeCompanyIdentity, store.navigationPillars, storeMenuCustomization, store.navigation]);

  // Two-way controlled helper for Company Identity: commits directly to SSOT store on every input change
  const updateCompanyIdentityField = (field: keyof CompanyIdentitySchema, value: any) => {
    if (field === 'officialArabicName') setCompanyNameAr(value);
    if (field === 'officialEnglishName') setCompanyNameEn(value);
    if (field === 'crNumber') setCrNumber(value);
    if (field === 'vatNumber') setVatNumber(value);
    if (field === 'bankName') setBankName(value);
    if (field === 'iban') setBankIban(value);
    if (field === 'bankSwift') setBankSwift(value);
    if (field === 'autoSealAndSignature') setAutoSignatures(value);
    if (field === 'logoUrl') setCompanyLogoUrl(value);

    const updatedIdentity: Partial<CompanyIdentitySchema> = {
      officialArabicName: field === 'officialArabicName' ? value : companyNameAr,
      officialEnglishName: field === 'officialEnglishName' ? value : companyNameEn,
      crNumber: field === 'crNumber' ? value : crNumber,
      vatNumber: field === 'vatNumber' ? value : vatNumber,
      bankName: field === 'bankName' ? value : bankName,
      iban: field === 'iban' ? value : bankIban,
      bankSwift: field === 'bankSwift' ? value : bankSwift,
      autoSealAndSignature: field === 'autoSealAndSignature' ? value : autoSignatures,
      logoUrl: field === 'logoUrl' ? value : companyLogoUrl,
    };

    commitMasterEnterpriseState({
      companyIdentity: {
        ...store.companyIdentity,
        ...updatedIdentity,
      },
      corporate: {
        ...store.corporate,
        nameAr: updatedIdentity.officialArabicName || store.corporate.nameAr,
        nameEn: updatedIdentity.officialEnglishName || store.corporate.nameEn,
        tradeNameEn: updatedIdentity.officialEnglishName || store.corporate.tradeNameEn,
        officialArabicName: updatedIdentity.officialArabicName || store.corporate.officialArabicName,
        officialEnglishName: updatedIdentity.officialEnglishName || store.corporate.officialEnglishName,
        crNumber: updatedIdentity.crNumber || store.corporate.crNumber,
        vatNumber: updatedIdentity.vatNumber || store.corporate.vatNumber,
        bankName: updatedIdentity.bankName || store.corporate.bankName,
        iban: updatedIdentity.iban || store.corporate.iban,
        bankIban: updatedIdentity.iban || store.corporate.bankIban,
        bankSwift: updatedIdentity.bankSwift || store.corporate.bankSwift,
        autoSealAndSignature: updatedIdentity.autoSealAndSignature ?? store.corporate.autoSealAndSignature,
        autoSignatures: updatedIdentity.autoSealAndSignature ?? store.corporate.autoSignatures,
        logoUrl: updatedIdentity.logoUrl ?? store.corporate.logoUrl,
      },
    });
  };

  // Two-way controlled helper for 6 Pillars: commits directly to SSOT store on every input change
  const updateNavigationPillar = (pillarKey: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6', val: string) => {
    if (pillarKey === 'p1') setP1Label(val);
    if (pillarKey === 'p2') { setP2Label(val); setQuotationsLabel(val); }
    if (pillarKey === 'p3') { setP3Label(val); setProjectsLabel(val); }
    if (pillarKey === 'p4') { setP4Label(val); setProcurementLabel(val); }
    if (pillarKey === 'p5') { setP5Label(val); setFinanceLabel(val); }
    if (pillarKey === 'p6') setP6Label(val);

    const updatedPillars = {
      p1_label: pillarKey === 'p1' ? val : p1Label,
      p2_label: pillarKey === 'p2' ? val : p2Label,
      p3_label: pillarKey === 'p3' ? val : p3Label,
      p4_label: pillarKey === 'p4' ? val : p4Label,
      p5_label: pillarKey === 'p5' ? val : p5Label,
      p6_label: pillarKey === 'p6' ? val : p6Label,
    };

    commitMasterEnterpriseState({
      navigationPillars: updatedPillars,
      menuCustomization: {
        projectsLabel: updatedPillars.p3_label,
        quotationsLabel: updatedPillars.p2_label,
        procurementLabel: updatedPillars.p4_label,
        financeLabel: updatedPillars.p5_label,
        siteExecutionLabel,
        labels: navLabels,
      },
    });
  };

  // Tab B: Financial Policies & Margins
  const [defaultMarkup, setDefaultMarkup] = useState(() => Number(localStorage.getItem('rmt_default_markup') || '25'));
  const [defaultGrossMargin, setDefaultGrossMargin] = useState(() => Number(localStorage.getItem('rmt_default_margin') || '20'));
  const [defaultRetention, setDefaultRetention] = useState(() => Number(localStorage.getItem('rmt_default_retention') || '10'));
  const [defaultAdvance, setDefaultAdvance] = useState(() => Number(localStorage.getItem('rmt_default_advance') || '30'));
  const [defaultVat, setDefaultVat] = useState(() => Number(localStorage.getItem('rmt_default_vat') || '15'));
  const [decimalPrecision, setDecimalPrecision] = useState(() => Number(localStorage.getItem('rmt_decimal_precision') || '2'));
  const [currencyDisplay, setCurrencyDisplay] = useState(() => localStorage.getItem('rmt_currency_display') || 'SAR');

  // Tab C: Sequence & Auto-Numbering
  const [prefixQuote, setPrefixQuote] = useState(() => localStorage.getItem('rmt_prefix_quote') || 'QT-RMT-');
  const [prefixPO, setPrefixPO] = useState(() => localStorage.getItem('rmt_prefix_po') || 'PO-');
  const [prefixInvoice, setPrefixInvoice] = useState(() => localStorage.getItem('rmt_prefix_inv') || 'INV-');
  const [prefixDN, setPrefixDN] = useState(() => localStorage.getItem('rmt_prefix_dn') || 'DN-');

  // Tab D: RBAC & Users
  const [usersList, setUsersList] = useState<User[]>(() => {
    const loaded = getAllUsers();
    return loaded && loaded.length > 0 ? loaded : INITIAL_USERS;
  });

  useEffect(() => {
    const handleUsersChange = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setUsersList(e.detail);
      } else {
        const loaded = getAllUsers();
        if (loaded && loaded.length > 0) {
          setUsersList(loaded);
        }
      }
    };
    window.addEventListener('rmt_users_updated', handleUsersChange);
    window.addEventListener('storage', handleUsersChange);
    return () => {
      window.removeEventListener('rmt_users_updated', handleUsersChange);
      window.removeEventListener('storage', handleUsersChange);
    };
  }, []);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserJobTitle, setEditUserJobTitle] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('engineer');
  const [editUserPillars, setEditUserPillars] = useState<Record<number, boolean>>({
    1: false,
    2: true,
    3: true,
    4: false,
    5: false,
    6: false,
  });
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showZeroResetModal, setShowZeroResetModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserJobTitle, setNewUserJobTitle] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('engineer');
  const [newUserPillars, setNewUserPillars] = useState<Record<number, boolean>>({
    1: false,
    2: true,
    3: true,
    4: false,
    5: false,
    6: false,
  });

  // Tab E: Appearance & Typography
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'high_contrast'>(() => {
    return (localStorage.getItem('rmt_theme_mode') as any) || 'light';
  });
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('rmt_primary_color') || '#174A84');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('rmt_accent_color') || '#007A5A');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('rmt_font_family') || 'Cairo');
  const [uiScale, setUiScale] = useState<'compact' | 'normal' | 'large'>(() => {
    return (localStorage.getItem('rmt_ui_scale') as any) || 'normal';
  });

  // Apply visual styling dynamically to DOM
  const applyVisualSettingsToDOM = (
    mode: string,
    prim: string,
    acc: string,
    font: string,
    scale: string
  ) => {
    const root = document.documentElement;
    const rootEl = document.getElementById('root');

    root.style.setProperty('--primary', prim);
    root.style.setProperty('--accent', acc);
    root.style.setProperty('--color-primary', prim);
    root.style.setProperty('--color-accent', acc);
    root.style.setProperty('--app-font-family', `'${font}', 'Plus Jakarta Sans', system-ui, sans-serif`);

    root.style.fontFamily = `'${font}', 'Plus Jakarta Sans', system-ui, sans-serif`;
    document.body.style.fontFamily = `'${font}', 'Plus Jakarta Sans', system-ui, sans-serif`;

    if (scale === 'compact') {
      root.style.fontSize = '14px';
      root.style.setProperty('--app-scale', '0.933');
      if (rootEl) {
        rootEl.classList.remove('scale-100', 'scale-105');
        rootEl.classList.add('scale-95', 'origin-top');
      }
    } else if (scale === 'large') {
      root.style.fontSize = '16.5px';
      root.style.setProperty('--app-scale', '1.1');
      if (rootEl) {
        rootEl.classList.remove('scale-95', 'scale-100');
        rootEl.classList.add('scale-105', 'origin-top');
      }
    } else {
      root.style.fontSize = '15px';
      root.style.setProperty('--app-scale', '1');
      if (rootEl) {
        rootEl.classList.remove('scale-95', 'scale-105');
        rootEl.classList.add('scale-100');
      }
    }

    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('high-contrast');
    } else if (mode === 'high_contrast') {
      root.classList.add('high-contrast');
      root.classList.remove('dark');
    } else {
      root.classList.remove('dark');
      root.classList.remove('high-contrast');
    }
  };

  useEffect(() => {
    applyVisualSettingsToDOM(themeMode, primaryColor, accentColor, fontFamily, uiScale);
  }, [themeMode, primaryColor, accentColor, fontFamily, uiScale]);

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setCompanyLogoUrl(dataUrl);
      try {
        localStorage.setItem('rmt_company_logo', dataUrl);
        window.dispatchEvent(new Event('rmt_logo_updated'));
      } catch (err) {
        console.error('Failed to save logo in localStorage:', err);
      }
      setSavedToast('تم رفع شعار المؤسسة وتحديثه بنجاح!');
      setTimeout(() => setSavedToast(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  // Add User to RBAC
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const cleanEmail = newUserEmail.trim().toLowerCase();
    const cleanUsername = (cleanEmail.split('@')[0] || `user_${Date.now()}`).trim().toLowerCase();

    // Prevent duplicate email or username
    const isDuplicate = usersList.some(
      (u) =>
        (u.email || '').trim().toLowerCase() === cleanEmail ||
        (u.username || '').trim().toLowerCase() === cleanUsername
    );

    if (isDuplicate) {
      alert('اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً في المنظومة');
      return;
    }

    const defaultPerms = getDefaultPermissionsForRole(newUserRole);
    const passwordHash = await hashPassword(newUserPassword.trim());

    const newUserObj: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      fullName: newUserName.trim(),
      name: newUserName.trim(),
      email: cleanEmail,
      password: newUserPassword.trim(),
      passwordHash,
      role: newUserRole,
      department: newUserRole === 'pm' ? 'إدارة المشاريع' : newUserRole === 'accountant' ? 'الإدارة المالية' : newUserRole === 'estimator' ? 'العطاءات والتسعير' : 'الهندسة والتنفيذ',
      jobTitle: newUserJobTitle.trim() || (newUserRole === 'pm' ? 'مدير مشاريع' : newUserRole === 'accountant' ? 'محاسب مالي' : newUserRole === 'estimator' ? 'مهندس تسعير' : 'مهندس موقع'),
      isActive: true,
      createdAt: new Date().toISOString(),
      permissions: {
        ...defaultPerms,
        canManageQuotations: newUserPillars[2] || defaultPerms.canManageQuotations,
        canCreateProject: newUserPillars[3] || defaultPerms.canCreateProject,
        canManageProcurement: newUserPillars[4] || defaultPerms.canManageProcurement,
        canIssueInvoices: newUserPillars[5] || defaultPerms.canIssueInvoices,
        canAccessAdminPanel: newUserPillars[6] ? true : false,
      },
    };

    const displayName = newUserObj.fullName || newUserObj.name || newUserObj.username || 'مستخدم جديد';
    const updated = [newUserObj, ...usersList.filter((u) => u.id !== newUserObj.id)];
    setUsersList(updated);
    saveAllUsers(updated);
    commitMasterEnterpriseState({ rbac: { users: updated } });
    saveToCloudDatabase({ users: updated }, true, { entity: 'users', priority: 'high' }).catch(() => {});
    createCheckpoint(`إضافة مستخدم جديد: ${displayName}`, updated);

    setNewUserName('');
    setNewUserEmail('');
    setNewUserJobTitle('');
    setNewUserPassword('');
    setIsAddUserOpen(false);
    setSavedToast(`تم إنشاء حساب المستخدم (${displayName}) بنجاح.`);
    setTimeout(() => setSavedToast(null), 3500);
  };

  // Open Edit User Modal
  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setEditUserName(u.fullName || u.name || u.username || '');
    setEditUserEmail(u.email || '');
    setEditUserJobTitle(u.jobTitle || '');
    setEditUserRole(u.role || 'engineer');
    setEditUserPhone(u.phone || '');
    setEditUserPassword('');
    const perms = u.permissions as UserPermissions | undefined;
    setEditUserPillars({
      1: Boolean(perms?.canAccessAdminPanel || isSuperAdmin(u)),
      2: Boolean(perms?.canManageQuotations),
      3: Boolean(perms?.canCreateProject || perms?.canUpdateFieldExecution),
      4: Boolean(perms?.canManageProcurement || perms?.canApprovePO),
      5: Boolean(perms?.canIssueInvoices),
      6: Boolean(perms?.canAccessAdminPanel || perms?.canManageUsers),
    });
  };

  // Save Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    let nextPasswordHash = editingUser.passwordHash;
    if (editUserPassword.trim()) {
      nextPasswordHash = await hashPassword(editUserPassword.trim());
    }

    const defaultPerms = getDefaultPermissionsForRole(editUserRole);
    const updatedUserObj: User = {
      ...editingUser,
      fullName: editUserName.trim() || editingUser.fullName,
      name: editUserName.trim() || editingUser.fullName,
      email: editUserEmail.trim().toLowerCase(),
      phone: editUserPhone.trim(),
      role: editUserRole,
      jobTitle: editUserJobTitle.trim() || editingUser.jobTitle || '',
      passwordHash: nextPasswordHash,
      permissions: {
        ...defaultPerms,
        canManageQuotations: editUserPillars[2] ?? defaultPerms.canManageQuotations,
        canCreateProject: editUserPillars[3] ?? defaultPerms.canCreateProject,
        canUpdateFieldExecution: editUserPillars[3] ?? defaultPerms.canUpdateFieldExecution,
        canManageProcurement: editUserPillars[4] ?? defaultPerms.canManageProcurement,
        canApprovePO: editUserPillars[4] ?? defaultPerms.canApprovePO,
        canIssueInvoices: editUserPillars[5] ?? defaultPerms.canIssueInvoices,
        canAccessAdminPanel: editUserPillars[6] || editUserPillars[1] ? true : false,
      },
    };
    if (editUserPassword.trim()) {
      updatedUserObj.password = editUserPassword.trim();
    }

    const updated = usersList.map((u) => (u.id === editingUser.id ? updatedUserObj : u));
    setUsersList(updated);
    saveAllUsers(updated);
    commitMasterEnterpriseState({ rbac: { users: updated } });
    saveToCloudDatabase({ users: updated }, true, { entity: 'users', priority: 'high' }).catch(() => {});
    createCheckpoint(`تعديل بيانات المستخدم: ${updatedUserObj.fullName}`, updated);

    // Notify all app components & listeners
    window.dispatchEvent(new CustomEvent('rmt_users_updated', { detail: updated }));
    window.dispatchEvent(new Event('storage'));

    setEditingUser(null);
    setSavedToast(`تم تحديث بيانات وصلاحيات (${updatedUserObj.fullName}) بنجاح.`);
    setTimeout(() => setSavedToast(null), 3500);
  };

  // Delete User Dialog Trigger
  const handleDeleteUser = (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (!target) return;
    if (isSuperAdmin(target)) {
      setErrorMessage('لا يمكن حذف حساب المدير التنفيذي العام (Super Admin)');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }
    setUserToDelete(target);
  };

  // Confirm Delete User (No native browser popups)
  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    if (isSuperAdmin(userToDelete)) {
      setErrorMessage('لا يمكن حذف حساب المدير التنفيذي العام (Super Admin)');
      setTimeout(() => setErrorMessage(null), 3500);
      setUserToDelete(null);
      return;
    }

    const displayName = userToDelete.fullName || userToDelete.name || userToDelete.username || 'المستخدم';
    const updated = usersList.filter((u) => u.id !== userToDelete.id);
    setUsersList(updated);
    saveAllUsers(updated);
    createCheckpoint(`حذف مستخدم: ${displayName}`, updated);

    // Notify all app components & listeners
    window.dispatchEvent(new CustomEvent('rmt_users_updated', { detail: updated }));
    window.dispatchEvent(new Event('storage'));

    setUserToDelete(null);
    setSavedToast(`تم حذف المستخدم (${displayName}) بنجاح.`);
    setTimeout(() => setSavedToast(null), 3500);
  };

  // Dedicated Save Tab A: Company Identity
  const handleSaveCompanyIdentity = () => {
    localStorage.setItem('rmt_company_name_ar', companyNameAr);
    localStorage.setItem('rmt_company_name_en', companyNameEn);
    localStorage.setItem('rmt_cr_number', crNumber);
    localStorage.setItem('rmt_vat_number', vatNumber);
    localStorage.setItem('rmt_bank_name', bankName);
    localStorage.setItem('rmt_bank_iban', bankIban);
    localStorage.setItem('rmt_bank_swift', bankSwift);
    localStorage.setItem('rmt_auto_signatures', String(autoSignatures));
    if (companyLogoUrl) {
      localStorage.setItem('rmt_company_logo', companyLogoUrl);
      window.dispatchEvent(new Event('rmt_logo_updated'));
    }

    commitMasterEnterpriseState({
      companyIdentity: {
        officialArabicName: companyNameAr,
        officialEnglishName: companyNameEn,
        crNumber,
        vatNumber,
        bankName,
        iban: bankIban,
        autoSealAndSignature: autoSignatures,
        logoUrl: companyLogoUrl,
        bankSwift,
      },
      corporate: {
        ...store.corporate,
        nameAr: companyNameAr,
        nameEn: companyNameEn,
        tradeNameEn: companyNameEn,
        officialArabicName: companyNameAr,
        officialEnglishName: companyNameEn,
        crNumber,
        vatNumber,
        bankName,
        bankIban,
        iban: bankIban,
        bankSwift,
        bankAccountName: companyNameAr,
        logoUrl: companyLogoUrl,
        autoSignatures,
        autoSealAndSignature: autoSignatures,
      },
    });

    createCheckpoint('حفظ وتحديث الهوية المؤسسية والبيانات الرسمية', {
      companyNameAr,
      companyNameEn,
      crNumber,
      vatNumber,
      bankName,
      bankIban,
    });

    setSavedToast('تم حفظ وتطبيق إعدادات الهوية المؤسسية والبيانات البنكية بنجاح!');
    setTimeout(() => setSavedToast(null), 3500);
  };

  // Dedicated Save Tab F: Menu Customization & 6 Pillars
  const handleSaveMenuCustomization = () => {
    const updatedPillars = {
      p1_label: p1Label,
      p2_label: p2Label,
      p3_label: p3Label,
      p4_label: p4Label,
      p5_label: p5Label,
      p6_label: p6Label,
    };

    localStorage.setItem('rmt_navigation_pillars', JSON.stringify(updatedPillars));

    commitMasterEnterpriseState({
      navigationPillars: updatedPillars,
      menuCustomization: {
        projectsLabel,
        quotationsLabel,
        procurementLabel,
        financeLabel,
        siteExecutionLabel,
        labels: navLabels,
      },
      navigation: {
        labels: navLabels,
      },
    });

    saveNavigationLabels(navLabels);
    if (onLabelsUpdated) {
      onLabelsUpdated(navLabels);
    }

    createCheckpoint('تخصيص مسميات القوائم والأركان الستة', {
      navigationPillars: updatedPillars,
      projectsLabel,
      quotationsLabel,
      procurementLabel,
      financeLabel,
      siteExecutionLabel,
      navLabels,
    });

    setSavedToast('تم حفظ وتطبيق مسميات القوائم والأركان وتحديث شريط التنقل بنجاح!');
    setTimeout(() => setSavedToast(null), 3500);
  };

  // Master Save All Settings
  const handleSaveAllSettings = () => {
    // Save Tab A
    localStorage.setItem('rmt_company_name_ar', companyNameAr);
    localStorage.setItem('rmt_company_name_en', companyNameEn);
    localStorage.setItem('rmt_cr_number', crNumber);
    localStorage.setItem('rmt_vat_number', vatNumber);
    localStorage.setItem('rmt_bank_name', bankName);
    localStorage.setItem('rmt_bank_iban', bankIban);
    localStorage.setItem('rmt_bank_swift', bankSwift);
    localStorage.setItem('rmt_auto_signatures', String(autoSignatures));
    if (companyLogoUrl) {
      localStorage.setItem('rmt_company_logo', companyLogoUrl);
      window.dispatchEvent(new Event('rmt_logo_updated'));
    }

    // Save Tab B
    localStorage.setItem('rmt_default_markup', String(defaultMarkup));
    localStorage.setItem('rmt_default_margin', String(defaultGrossMargin));
    localStorage.setItem('rmt_default_retention', String(defaultRetention));
    localStorage.setItem('rmt_default_advance', String(defaultAdvance));
    localStorage.setItem('rmt_default_vat', String(defaultVat));
    localStorage.setItem('rmt_decimal_precision', String(decimalPrecision));
    localStorage.setItem('rmt_currency_display', currencyDisplay);

    // Save Tab C
    localStorage.setItem('rmt_prefix_quote', prefixQuote);
    localStorage.setItem('rmt_prefix_po', prefixPO);
    localStorage.setItem('rmt_prefix_inv', prefixInvoice);
    localStorage.setItem('rmt_prefix_dn', prefixDN);

    // Save Tab E
    localStorage.setItem('rmt_theme_mode', themeMode);
    localStorage.setItem('rmt_primary_color', primaryColor);
    localStorage.setItem('rmt_accent_color', accentColor);
    localStorage.setItem('rmt_font_family', fontFamily);
    localStorage.setItem('rmt_ui_scale', uiScale);
    applyVisualSettingsToDOM(themeMode, primaryColor, accentColor, fontFamily, uiScale);

    // Save Unified Enterprise Settings Object & SSOT Commit
    commitMasterEnterpriseState({
      companyIdentity: {
        officialArabicName: companyNameAr,
        officialEnglishName: companyNameEn,
        crNumber,
        vatNumber,
        bankName,
        iban: bankIban,
        autoSealAndSignature: autoSignatures,
        logoUrl: companyLogoUrl,
        bankSwift,
      },
      financialPolicies: {
        defaultVatRate: defaultVat,
        overheadPercentage: 10,
        profitMarginPercentage: defaultGrossMargin,
        retentionRate: defaultRetention,
        defaultAdvance,
        decimalPrecision,
        currencyDisplay,
      },
      autoNumbering: {
        projectPrefix: "PRJ-",
        quotationPrefix: prefixQuote,
        invoicePrefix: prefixInvoice,
        purchaseOrderPrefix: prefixPO,
        deliveryNotePrefix: prefixDN,
        sequenceDigits: 4,
        seqQuote: 1,
        seqPO: 1,
        seqInvoice: 1,
        seqDN: 1,
        seqProject: 1,
      },
      menuCustomization: {
        projectsLabel: projectsLabel || "المشاريع والعمليات",
        quotationsLabel: quotationsLabel || "عروض الأسعار والتسعير",
        procurementLabel: procurementLabel || "المشتريات والتوريد",
        financeLabel: financeLabel || "المالية والفواتير",
        siteExecutionLabel: siteExecutionLabel || "التنفيذ والمتابعة الميدانية",
        labels: navLabels,
      },
      corporate: {
        nameAr: companyNameAr,
        nameEn: companyNameEn,
        tradeNameEn: companyNameEn,
        crNumber,
        vatNumber,
        bankName,
        bankIban,
        bankSwift,
        bankAccountName: companyNameAr,
        logoUrl: companyLogoUrl,
        autoSignatures,
        officialArabicName: companyNameAr,
        officialEnglishName: companyNameEn,
        iban: bankIban,
        autoSealAndSignature: autoSignatures,
        poBox: 'PO BOX 32511 - Saudi Arabia',
        addressEn: 'Kingdom of Saudi Arabia, Dammam, Al Shate Al gharbi',
        addressAr: 'حي الشاطئ الغربي - الدمام - المملكة العربية السعودية',
        phone: '+966 549220606',
        mobiles: ['+966 549220606', '+966 599 7877 93', '+966 573 5080 33'],
        email: 'info@rmt-sa.com',
        website: 'www.rmt-sa.com',
        engineerName: '',
        engineerTitle: 'Projects Manager',
        engineerEmail: '',
        financeDirector: '',
        financeDirectorAr: '',
        financeDirectorTitle: 'Financial Controller & Auditor (المدير المالي والتدقيق)',
      },
      financial: {
        defaultMarkup,
        defaultGrossMargin,
        defaultRetention,
        defaultAdvance,
        defaultVat,
        decimalPrecision,
        currencyDisplay,
        defaultVatRate: defaultVat,
        overheadPercentage: 10,
        profitMarginPercentage: defaultGrossMargin,
        retentionRate: defaultRetention,
      },
      numbering: {
        prefixQuote,
        prefixPO,
        prefixInvoice,
        prefixDN,
        prefixProject: 'PRJ-',
        projectPrefix: 'PRJ-',
        quotationPrefix: prefixQuote,
        invoicePrefix: prefixInvoice,
        purchaseOrderPrefix: prefixPO,
        deliveryNotePrefix: prefixDN,
        sequenceDigits: 4,
        seqQuote: 1,
        seqPO: 1,
        seqInvoice: 1,
        seqDN: 1,
        seqProject: 1,
      },
      navigation: {
        labels: navLabels,
      },
      appearance: {
        themeMode,
        primaryColor,
        accentColor,
        fontFamily,
        uiDensity: uiScale,
        language: 'ar',
      },
      rbac: {
        users: usersList,
      },
    });

    saveToCloudDatabase({ users: usersList }, true, { entity: 'users', priority: 'high' }).catch(() => {});

    // Save Tab F
    saveNavigationLabels(navLabels);
    if (onLabelsUpdated) {
      onLabelsUpdated(navLabels);
    }

    // Create a safety checkpoint
    createCheckpoint('حفظ وتطبيق إعدادات المنظومة الشاملة', {
      companyNameAr,
      companyNameEn,
      crNumber,
      vatNumber,
      defaultMarkup,
      defaultVat,
      themeMode,
      primaryColor,
      accentColor,
      fontFamily,
      projectsLabel,
      quotationsLabel,
      procurementLabel,
      financeLabel,
      siteExecutionLabel,
      navLabels,
    });

    setSavedToast('تم حفظ وتطبيق كافة إعدادات المنظومة والسياسات المالية ومسميات الأركان بنجاح تام!');
    setTimeout(() => setSavedToast(null), 4000);
  };

  const handleResetNavigation = () => {
    const defaultNav = resetNavigationLabels();
    setP1Label(DEFAULT_NAVIGATION_PILLARS.p1_label);
    setP2Label(DEFAULT_NAVIGATION_PILLARS.p2_label);
    setP3Label(DEFAULT_NAVIGATION_PILLARS.p3_label);
    setP4Label(DEFAULT_NAVIGATION_PILLARS.p4_label);
    setP5Label(DEFAULT_NAVIGATION_PILLARS.p5_label);
    setP6Label(DEFAULT_NAVIGATION_PILLARS.p6_label);

    const defProjects = "المشاريع والعمليات";
    const defQuotes = "عروض الأسعار والتسعير";
    const defProc = "المشتريات والتوريد";
    const defFin = "المالية والفواتير";
    const defSite = "التنفيذ والمتابعة الميدانية";

    setProjectsLabel(defProjects);
    setQuotationsLabel(defQuotes);
    setProcurementLabel(defProc);
    setFinanceLabel(defFin);
    setSiteExecutionLabel(defSite);
    setNavLabels(defaultNav);

    localStorage.setItem('rmt_navigation_pillars', JSON.stringify(DEFAULT_NAVIGATION_PILLARS));

    commitMasterEnterpriseState({
      navigationPillars: { ...DEFAULT_NAVIGATION_PILLARS },
      menuCustomization: {
        projectsLabel: defProjects,
        quotationsLabel: defQuotes,
        procurementLabel: defProc,
        financeLabel: defFin,
        siteExecutionLabel: defSite,
        labels: defaultNav,
      },
      navigation: {
        labels: defaultNav,
      },
    });

    if (onLabelsUpdated) onLabelsUpdated(defaultNav);
    setSavedToast('تمت استعادة مسميات القوائم والأركان الافتراضية.');
    setTimeout(() => setSavedToast(null), 3000);
  };

  // Super-Admin Shield: Restrict Settings Hub strictly to "مختار أبورزق"
  const isSuperAdminAuthorized = Boolean(
    currentUser && (
      (currentUser.fullName || currentUser.name || '').includes('مختار') ||
      currentUser.email?.toLowerCase().includes('mokhtar') ||
      currentUser.email?.toLowerCase() === 'mok7tar.89@gmail.com' ||
      currentUser.role === 'admin' ||
      isSuperAdmin(currentUser)
    )
  );

  if (!isSuperAdminAuthorized) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 p-8 text-center shadow-lg">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          درع الأمان الفائق (Super-Admin Shield)
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          تم قفل هذا القسم وتأمينه بالكامل. إعدادات المنظومة وتخصيص الهوية والسياسات المالية وحوكمة النظام مخصصة حصرياً للمدير العام: <strong className="text-rose-600 dark:text-rose-400 font-bold">مختار أبورزق</strong>.
        </p>
        <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 font-mono">
          User: {currentUser?.fullName || currentUser?.name || 'Unknown'} | Role: {currentUser?.role}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Settings Top Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#174A84] to-[#007A5A] text-white flex items-center justify-center shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>{t.systemSettingsTitle || 'مركز إعدادات المنظومة والسيادة المؤسسية'}</span>
              <span className="text-[11px] bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200 font-mono font-bold">
                Super Admin Only
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.systemSettingsSubtitle || 'إدارة الهوية الرسمية، السياسات المالية، الترقيم التلقائي، الصلاحيات RBAC، محرك المظهر والخطوط'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {onOpenPreFlight && (
            <button
              type="button"
              onClick={onOpenPreFlight}
              className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-teal-200 transition cursor-pointer"
              title={isEn ? 'Pre-Flight System Health Check' : 'فحص سلامة النظام والتحقق قبل النشر'}
            >
              <Activity className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
              <span>{t.systemHealthCheck || 'فحص سلامة النظام'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenBackupModal}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isEn ? 'PITR Backup' : 'النسخ الاحتياطي PITR'}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAllSettings}
            className="px-5 py-2 bg-gradient-to-r from-[#007A5A] to-[#174A84] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t.saveAndApply || 'حفظ وتطبيق التغييرات'}</span>
          </button>
        </div>
      </div>

      {savedToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 6 Tabs Navigation Strip */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'identity', label: isEn ? '1. Corporate Identity & Banking' : '1. الهوية والبيانات الرسمية', icon: Building2 },
          { id: 'financial', label: isEn ? '2. Financial Policies & Margins (%)' : '2. السياسات المالية والهوامش (%)', icon: Percent },
          { id: 'numbering', label: isEn ? '3. Auto-Numbering Engine' : '3. الترقيم التلقائي', icon: Hash },
          { id: 'rbac', label: isEn ? '4. Users & RBAC Security' : '4. المستخدمين والصلاحيات RBAC', icon: Users },
          { id: 'theme', label: isEn ? '5. Appearance & Themes' : '5. المظهر ومحرك الخطوط', icon: Palette },
          { id: 'navigation', label: isEn ? '6. Navigation & Pillars' : '6. تخصيص مسميات القوائم', icon: Sliders },
          { id: 'telegram', label: isEn ? '7. Telegram Bot & Connection Test' : '7. ربط التليجرام وفحص الاتصال (Ping Test)', icon: Bot },
          { id: 'maintenance', label: isEn ? '8. Production Reset & Initialization' : '8. تصفير وبدء التشغيل الفعلي', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#174A84] text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB A: الهوية والبيانات الرسمية */}
      {activeTab === 'identity' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#174A84]" />
              <span>الهوية المؤسسية والبيانات الضريبية والمصرفية</span>
            </h2>
            <span className="text-[11px] text-slate-500">تنعكس فوراً على الترويسة ومستندات الفواتير وعروض الأسعار</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">اسم المنشأة باللغة العربية (Official Arabic Name)</label>
              <input
                type="text"
                value={companyNameAr}
                onChange={(e) => updateCompanyIdentityField('officialArabicName', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">اسم المنشأة باللغة الإنجليزية (Official English Name)</label>
              <input
                type="text"
                value={companyNameEn}
                onChange={(e) => updateCompanyIdentityField('officialEnglishName', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">رقم السجل التجاري (Commercial Registration - CR)</label>
              <input
                type="text"
                value={crNumber}
                onChange={(e) => updateCompanyIdentityField('crNumber', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">الرقم الضريبي للمنشأة (VAT Number - 15 Digits)</label>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => updateCompanyIdentityField('vatNumber', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">اسم البنك المعتمد (Authorized Bank Name)</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => updateCompanyIdentityField('bankName', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">رقم الآيبان البنكي المعتمد (IBAN Number)</label>
              <input
                type="text"
                value={bankIban}
                onChange={(e) => updateCompanyIdentityField('iban', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">رمز السويفت للبنك (Bank SWIFT / BIC Code)</label>
              <input
                type="text"
                value={bankSwift}
                onChange={(e) => updateCompanyIdentityField('bankSwift', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                placeholder="RJHI SA RI"
              />
            </div>
          </div>

          {/* Logo & Auto-Signatures Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <label className="block font-bold text-slate-800">شعار المؤسسة الرسمي (Company Logo Upload)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#174A84] file:text-white hover:file:bg-[#123866] cursor-pointer"
                />
                {companyLogoUrl && (
                  <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> شعار مخصص محفوظ
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <label className="block font-bold text-slate-800">التوقيع والختم التلقائي على المستندات</label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  إدراج خاتم المؤسسة وتوقيع المدير التنفيذي آلياً في مخرجات PDF والطباعة الرسمية
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoSignatures}
                onChange={(e) => updateCompanyIdentityField('autoSealAndSignature', e.target.checked)}
                className="w-5 h-5 accent-[#007A5A] rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSaveCompanyIdentity}
              className="px-6 py-2.5 bg-gradient-to-r from-[#007A5A] to-[#174A84] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتطبيق إعدادات الهوية المؤسسية والبيانات البنكية</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB B: السياسات المالية والهوامش */}
      {activeTab === 'financial' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#007A5A]" />
              <span>السياسات المالية، هوامش الربح الافتراضية، ونسب الدفعات</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
              <label className="block font-bold text-emerald-900 mb-1">هامش الربح الإجمالي الافتراضي (Gross Margin %)</label>
              <p className="text-[10px] text-emerald-700 mb-2">Cost / (1 - Margin %)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="0.5"
                  value={defaultGrossMargin}
                  onChange={(e) => setDefaultGrossMargin(Number(e.target.value))}
                  className="w-full border border-emerald-300 rounded-lg px-3 py-2 bg-white text-emerald-950 font-bold font-mono"
                />
                <span className="font-bold text-emerald-800">%</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1">نسبة الإضافة على التكلفة (Markup %)</label>
              <p className="text-[10px] text-slate-500 mb-2">Cost × (1 + Markup %)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="150"
                  step="0.5"
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-bold font-mono"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1.5">نسبة الدفعة المقدمة (Advance %)</label>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultAdvance}
                  onChange={(e) => setDefaultAdvance(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-bold font-mono"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1.5">نسبة الاستقطاع والضمان (Retention %)</label>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultRetention}
                  onChange={(e) => setDefaultRetention(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-bold font-mono"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block font-semibold text-slate-700 mb-1.5">نسبة ضريبة القيمة المضافة (VAT %)</label>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={defaultVat}
                  onChange={(e) => setDefaultVat(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 font-bold font-mono"
                />
                <span className="font-bold text-slate-600">%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                دقة التقريب والمنازل العشرية (Decimal Precision: {decimalPrecision} أرقام)
              </label>
              <input
                type="range"
                min="2"
                max="4"
                step="1"
                value={decimalPrecision}
                onChange={(e) => setDecimalPrecision(Number(e.target.value))}
                className="w-full accent-[#174A84] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                <span>منزلتين (0.00 SAR - Standard)</span>
                <span>3 منازل (0.000)</span>
                <span>4 منازل (0.0000 - Accurate)</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">عملة العرض والتعامل (Currency Display)</label>
              <select
                value={currencyDisplay}
                onChange={(e) => setCurrencyDisplay(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              >
                <option value="SAR">الريال السعودي (SAR - Saudi Riyal)</option>
                <option value="USD">الدولار الأمريكي (USD - US Dollar)</option>
                <option value="EUR">اليورو الأوروبي (EUR - Euro)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB C: الترقيم التلقائي للمستندات */}
      {activeTab === 'numbering' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-600" />
              <span>قواعد وبادئات الترقيم التلقائي للسلاسل المستندية</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">بادئة عروض الأسعار (Quotations)</label>
              <input
                type="text"
                value={prefixQuote}
                onChange={(e) => setPrefixQuote(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">مثال: {prefixQuote}2026-001</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">بادئة أوامر الشراء (Purchase Orders)</label>
              <input
                type="text"
                value={prefixPO}
                onChange={(e) => setPrefixPO(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">مثال: {prefixPO}2026-509</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">بادئة الفواتير الضريبية (Tax Invoices)</label>
              <input
                type="text"
                value={prefixInvoice}
                onChange={(e) => setPrefixInvoice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">مثال: {prefixInvoice}2026-010</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">بادئة سندات التسليم (Delivery Notes)</label>
              <input
                type="text"
                value={prefixDN}
                onChange={(e) => setPrefixDN(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 font-mono font-bold"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">مثال: {prefixDN}PRJ088-001</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB D: دليل المستخدمين والصلاحيات RBAC */}
      {activeTab === 'rbac' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>إدارة المستخدمين ومصفوفة صلاحيات الأركان الستة (RBAC)</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تحديد الأدوار الوظيفية وعزل الوصول للأركان الستة والمستندات الحساسة
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddUserOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة مستخدم جديد</span>
            </button>
          </div>

          {/* Add User Modal / Inline Form */}
          {isAddUserOpen && (
            <form onSubmit={handleCreateUser} className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                <h3 className="font-bold text-xs text-indigo-950 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-600" />
                  <span>تسجيل مستخدم جديد وضبط صلاحيات الأركان الستة</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: م. أحمد السعيد"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المسمى الوظيفي المخصص (Job Title)</label>
                  <input
                    type="text"
                    placeholder="مثال: مدير تسويق / مهندس مكتب فني..."
                    value={newUserJobTitle}
                    onChange={(e) => setNewUserJobTitle(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    placeholder="name@rmt-sa.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">كلمة المرور</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الرتبة الوظيفية</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs font-semibold"
                  >
                    <option value="pm">مدير مشاريع (Project Manager)</option>
                    <option value="estimator">مهندس تسعير (Estimator)</option>
                    <option value="accountant">محاسب ومدير مالي (Accountant)</option>
                    <option value="procurement">أخصائي مشتريات (Procurement)</option>
                    <option value="engineer">مهندس موقع وتنفيذ (Site Engineer)</option>
                    <option value="viewer">مطلع ومدقق (Viewer)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 text-xs mb-2">
                  صلاحيات الوصول للأركان الستة (Pillars 1 to 6 Permissions):
                </label>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                  {[
                    { num: 1, label: 'ركن 1: الرقابة والسيولة' },
                    { num: 2, label: 'ركن 2: الهندسة والتسعير' },
                    { num: 3, label: 'ركن 3: المشاريع والميدان' },
                    { num: 4, label: 'ركن 4: سلاسل الإمداد' },
                    { num: 5, label: 'ركن 5: المالية والفوترة' },
                    { num: 6, label: 'ركن 6: الحوكمة (Admin)' },
                  ].map((p) => (
                    <label key={p.num} className="flex items-center gap-1.5 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(newUserPillars[p.num])}
                        onChange={(e) =>
                          setNewUserPillars((prev) => ({ ...prev, [p.num]: e.target.checked }))
                        }
                        className="accent-indigo-600 rounded"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  حفظ وتأكيد إضافة المستخدم
                </button>
              </div>
            </form>
          )}

          {/* Edit User Modal / Form */}
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="bg-amber-50/80 border border-amber-300 rounded-2xl p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <h3 className="font-bold text-xs text-amber-950 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-amber-600" />
                  <span>تعديل بيانات المستخدم: <strong className="text-indigo-900">{editingUser.fullName}</strong></span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">المسمى الوظيفي المخصص (Job Title)</label>
                  <input
                    type="text"
                    placeholder="e.g. مدير تسويق / مهندس مكتب فني..."
                    value={editUserJobTitle}
                    onChange={(e) => setEditUserJobTitle(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">رقم الجوال (اختياري)</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="+966 5X XXX XXXX"
                    value={editUserPhone}
                    onChange={(e) => setEditUserPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">الرتبة الوظيفية</label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs font-semibold"
                  >
                    <option value="admin">مدير النظام (Super Admin)</option>
                    <option value="pm">مدير مشاريع (Project Manager)</option>
                    <option value="estimator">مهندس تسعير (Estimator)</option>
                    <option value="accountant">محاسب ومدير مالي (Accountant)</option>
                    <option value="procurement">أخصائي مشتريات (Procurement)</option>
                    <option value="engineer">مهندس موقع وتنفيذ (Site Engineer)</option>
                    <option value="viewer">مطلع ومدقق (Viewer)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تغيير كلمة المرور (اختياري)</label>
                  <input
                    type="password"
                    placeholder="اتركها فارغة للإبقاء على كلمة المرور الحالية"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 text-xs mb-2">
                  صلاحيات الوصول للأركان الستة (Pillars 1 to 6 Permissions):
                </label>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                  {[
                    { num: 1, label: 'ركن 1: الرقابة والسيولة' },
                    { num: 2, label: 'ركن 2: الهندسة والتسعير' },
                    { num: 3, label: 'ركن 3: المشاريع والميدان' },
                    { num: 4, label: 'ركن 4: سلاسل الإمداد' },
                    { num: 5, label: 'ركن 5: المالية والفوترة' },
                    { num: 6, label: 'ركن 6: الحوكمة (Admin)' },
                  ].map((p) => (
                    <label key={p.num} className="flex items-center gap-1.5 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editUserPillars[p.num])}
                        onChange={(e) =>
                          setEditUserPillars((prev) => ({ ...prev, [p.num]: e.target.checked }))
                        }
                        className="accent-amber-600 rounded"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  حفظ وتطبيق تعديلات المستخدم
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">المستخدم</th>
                  <th className="py-3 px-4">البريد الإلكتروني</th>
                  <th className="py-3 px-4">الدور الوظيفي</th>
                  <th className="py-3 px-4">الأركان المصرحة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {usersList.map((usr) => {
                  const displayName = usr.fullName || usr.name || usr.username || 'مستخدم';
                  const initial = (displayName.trim()[0] || 'U').toUpperCase();
                  const roleBadge = getUserRoleBadge(usr);

                  return (
                    <tr key={usr.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                            {initial}
                          </div>
                          <div>
                            <strong className="text-slate-900 block">{displayName}</strong>
                            <span className="text-[10px] text-slate-400">{usr.department || 'العمليات'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{usr.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleBadge.badgeClass}`}>
                          {roleBadge.titleAr}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                          {isSuperAdmin(usr) ? (
                            <span className="text-purple-700 font-bold">جميع الأركان (1-6) كاملة</span>
                          ) : (
                            <span>أركان العمليات المعتمدة</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(usr)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="تعديل المستخدم والمسمى والصلاحيات"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!isSuperAdmin(usr) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(usr.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="حذف المستخدم"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB E: المظهر ومحرك الخطوط */}
      {activeTab === 'theme' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#174A84]" />
              <span>المظهر، الألوان المؤسسية، ومحرك الخطوط الطباعية</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Theme Mode */}
            <div>
              <label className="block font-semibold text-slate-700 mb-2">وضع العرض البصري (Theme Mode)</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition cursor-pointer ${
                    themeMode === 'light'
                      ? 'border-[#007A5A] bg-emerald-50/60 text-[#007A5A] font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                  <span>فاتح رسمي (Light)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition cursor-pointer ${
                    themeMode === 'dark'
                      ? 'border-[#174A84] bg-blue-50/60 text-[#174A84] font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                  <span>داكن ليلي (Dark)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('high_contrast')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition cursor-pointer ${
                    themeMode === 'high_contrast'
                      ? 'border-slate-900 bg-slate-900 text-white font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Eye className="w-5 h-5" />
                  <span>تباين فائق (Contrast)</span>
                </button>
              </div>
            </div>

            {/* Typography */}
            <div>
              <label className="block font-semibold text-slate-700 mb-2">الخط العربي المعتمد (Typography)</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
              >
                <option value="Cairo">خط القاهرة (Cairo - الأساسي والرسمي لمخططات MEP)</option>
                <option value="Tajawal">خط تجوال (Tajawal - الهندسي الناعم المريح)</option>
                <option value="IBM Plex Sans Arabic">آي بي إم بلكس (IBM Plex - التقني الهندسي)</option>
                <option value="Almarai">خط المراعي (Almarai - المؤسسي المتوازن للأرقام)</option>
                <option value="Alexandria">خط ألكسندريا (Alexandria - العصري الفاخر SaaS)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                ينعكس تغيير الخط فوراً على كافة صفحات النظام ونوافذ الطباعة الرسمية ومخرجات PDF.
              </p>
            </div>

            {/* Colors */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">اللون الأساسي (Primary Color)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-300 p-1 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 font-mono text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-900 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">لون التمييز (Accent Color)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-300 p-1 cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 font-mono text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-slate-50 text-slate-900 font-bold"
                />
              </div>
            </div>

            {/* UI Scale */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-2">مقياس كثافة الواجهة (UI Scale)</label>
              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'normal', 'large'] as const).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setUiScale(scale)}
                    className={`py-2 px-3 rounded-xl border text-center transition cursor-pointer ${
                      uiScale === scale
                        ? 'border-[#007A5A] bg-emerald-50 text-[#007A5A] font-bold shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {scale === 'compact' && 'مضغوط (Compact - 95%)'}
                    {scale === 'normal' && 'افتراضي (Normal - 100%)'}
                    {scale === 'large' && 'كبير (Large - 105%)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB F: تخصيص مسميات القوائم */}
      {activeTab === 'navigation' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>تخصيص مسميات الأركان الستة وروابط القوائم (Navigation Config)</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تعديل عناوين الأركان والتبويبات لتتوافق مع المصطلح الداخلي لمنشأتك وتحديث شريط التنقل فورياً
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetNavigation}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة التسميات الأصلية</span>
              </button>
              <button
                type="button"
                onClick={handleSaveMenuCustomization}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ التسميات</span>
              </button>
            </div>
          </div>

          <div className="space-y-6 text-xs">
            {/* 1. The 6 Enterprise Pillars Architecture (SSOT navigationPillars) */}
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-emerald-200 pb-2">
                <Sliders className="w-4 h-4 text-emerald-700" />
                <span>هندسة الأركان الستة الرئيسية (6-Pillar Navigation Architecture)</span>
              </h3>
              <p className="text-[11px] text-slate-600">
                المسميات الموحدة للأركان الستة وفق النموذج المؤسسي (تحديث فوري للقائمة وشريط التنقل بدون إعادة تحميل)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الركن الأول: الرقابة التنفيذية والسيولة (Pillar 1)
                  </label>
                  <input
                    type="text"
                    value={p1Label}
                    onChange={(e) => updateNavigationPillar('p1', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="الرقابة التنفيذية والسيولة"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الركن الثاني: عروض الأسعار والتسعير (Pillar 2)
                  </label>
                  <input
                    type="text"
                    value={p2Label}
                    onChange={(e) => updateNavigationPillar('p2', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="عروض الأسعار والتسعير"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الركن الثالث: المشاريع والعمليات (Pillar 3)
                  </label>
                  <input
                    type="text"
                    value={p3Label}
                    onChange={(e) => updateNavigationPillar('p3', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="المشاريع والعمليات"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الركن الرابع: المشتريات والتوريد (Pillar 4)
                  </label>
                  <input
                    type="text"
                    value={p4Label}
                    onChange={(e) => updateNavigationPillar('p4', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="المشتريات والتوريد"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الركن الخامس: المالية والفواتير (Pillar 5)
                  </label>
                  <input
                    type="text"
                    value={p5Label}
                    onChange={(e) => updateNavigationPillar('p5', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="المالية والفواتير"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    الركن السادس: الحوكمة والسيادة السحابية (Pillar 6)
                  </label>
                  <input
                    type="text"
                    value={p6Label}
                    onChange={(e) => updateNavigationPillar('p6', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="الحوكمة والسيادة السحابية"
                  />
                </div>
              </div>
            </div>

            {/* 2. Sub-labels (SSOT Menu Customization) */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <Sliders className="w-4 h-4 text-[#174A84]" />
                <span>المسميات الفرعية للتبويبات والقوائم (Menu Labels Customization)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                تخصيص مسميات القوائم الفرعية والتنفيذ الميداني
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    قائمة المشاريع والعمليات (Projects Label)
                  </label>
                  <input
                    type="text"
                    value={projectsLabel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProjectsLabel(val);
                      updateNavigationPillar('p3', val);
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="المشاريع والعمليات"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    قائمة عروض الأسعار والتسعير (Quotations Label)
                  </label>
                  <input
                    type="text"
                    value={quotationsLabel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuotationsLabel(val);
                      updateNavigationPillar('p2', val);
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="عروض الأسعار والتسعير"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    قائمة المشتريات والتوريد (Procurement Label)
                  </label>
                  <input
                    type="text"
                    value={procurementLabel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProcurementLabel(val);
                      updateNavigationPillar('p4', val);
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="المشتريات والتوريد"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    قائمة المالية والفواتير (Finance Label)
                  </label>
                  <input
                    type="text"
                    value={financeLabel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFinanceLabel(val);
                      updateNavigationPillar('p5', val);
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="المالية والفواتير"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    قائمة التنفيذ والمتابعة الميدانية (Site Execution Label)
                  </label>
                  <input
                    type="text"
                    value={siteExecutionLabel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSiteExecutionLabel(val);
                      commitMasterEnterpriseState({
                        menuCustomization: {
                          projectsLabel,
                          quotationsLabel,
                          procurementLabel,
                          financeLabel,
                          siteExecutionLabel: val,
                          labels: navLabels,
                        },
                      });
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-[#174A84] outline-none"
                    placeholder="التنفيذ والمتابعة الميدانية"
                  />
                </div>
              </div>
            </div>

            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 pt-4">مسميات التبويبات الفرعية (Tabs):</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(navLabels.tabs).map(([tabKey, tabLabel]) => (
                <div key={tabKey}>
                  <label className="block font-semibold text-slate-600 mb-1 text-[11px] font-mono">{tabKey}</label>
                  <input
                    type="text"
                    value={tabLabel}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = { ...navLabels.tabs, [tabKey]: val };
                      setNavLabels((prev) => ({
                        ...prev,
                        tabs: updated,
                      }));
                      commitMasterEnterpriseState({
                        navigation: {
                          labels: { ...navLabels, tabs: updated },
                        },
                      });
                    }}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-900 text-xs font-medium"
                  />
                </div>
              ))}
            </div>

            {/* Action Row */}
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveMenuCustomization}
                className="px-6 py-2.5 bg-gradient-to-r from-[#007A5A] to-[#174A84] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>حفظ وتطبيق مسميات القوائم والأركان</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB G: تكامل البوت التنفيذي وفحص الاتصال (Telegram & Connection Test) */}
      {activeTab === 'telegram' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-sky-950 flex items-center gap-2">
                <Bot className="w-5 h-5 text-sky-600" />
                <span>إعدادات وتكامل البوت التنفيذي Telegram API & Ping Test</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                فحص الاتصال الفوري، إرسال تقارير الإدارة المباشرة، واستقبال المستندات وتحويلها ذكياً
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
              <span>Telegram Bridge v2026</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Box: Credentials Configuration */}
            <div className="space-y-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>بيانات الاعتماد والربط الأمني</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    رمز البوت (Telegram Bot Token):
                  </label>
                  <input
                    type="password"
                    value={telegramToken}
                    onChange={(e) => setTelegramToken(e.target.value)}
                    placeholder="مثال: 7891234567:AAFl0zVv798..."
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white text-slate-900 font-mono text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    يتم استخراجه من محادثة @BotFather الرسمية على Telegram.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    معرف محادثة الإدارة (Target Chat ID / Channel ID):
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="مثال: 123456789 أو -100123456789"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 bg-white text-slate-900 font-mono text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    معرف حساب Telegram للإدارة العليا لاستقبال إشعارات وفحوصات الـ Ping.
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestTelegramConnection}
                  disabled={isTestingTelegram}
                  className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isTestingTelegram ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري فحص الاتصال وإرسال Ping...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300" />
                      <span>فحص الاتصال وإرسال رسالة Ping تجريبية</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Box: Live Status & Telemetry */}
            <div className="space-y-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <Radio className="w-4 h-4 text-sky-600" />
                  <span>نتائج فحص الاتصال ومؤشرات الأداء</span>
                </h3>

                {telegramTestResult ? (
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      telegramTestResult.success
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {telegramTestResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-2 flex-1 text-xs">
                        <div className="font-bold flex items-center justify-between">
                          <span>{telegramTestResult.success ? 'تم الاتصال والتكامل بنجاح ✅' : 'فشل الاتصال ⚠️'}</span>
                          {telegramTestResult.latencyMs !== undefined && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                              ⚡ {telegramTestResult.latencyMs} ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed">{telegramTestResult.message}</p>

                        {telegramTestResult.botInfo && (
                          <div className="mt-3 p-3 rounded-xl bg-white/90 border border-emerald-200 grid grid-cols-2 gap-2 text-[11px] font-mono">
                            <div>
                              <span className="text-slate-400 block text-[10px]">يوزر البوت:</span>
                              <span className="font-bold text-slate-900">@{telegramTestResult.botInfo.username}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">الاسم:</span>
                              <span className="font-bold text-slate-900">{telegramTestResult.botInfo.first_name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">البوت ID:</span>
                              <span className="font-bold text-slate-900">{telegramTestResult.botInfo.id}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">إرسال Ping:</span>
                              <span className="font-bold text-emerald-700">{telegramTestResult.pingSent ? 'تم الإرسال بنجاح' : 'تم التحقق من الرمز'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-white text-center text-xs text-slate-500 space-y-2">
                    <Bot className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700">لم يتم تنفيذ فحص اتصال مؤخراً</p>
                    <p className="text-[11px] text-slate-400">
                      اضغط على زر "فحص الاتصال وإرسال رسالة Ping" للتأكد من استقرار الربط مع خوادم Telegram.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <span>🔐 التشفير: TLS 1.3 مع شهادات HTTPS رسمية</span>
                <span className="text-emerald-700 font-bold">ZATCA & Google Drive Ready</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB H: تصفير وبدء التشغيل الفعلي للمنظومة */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6 animate-in fade-in">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>إدارة صيانة المنظومة وتصفير المشاريع لبدء الإنتاج الفعلي</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تجهيز المنظومة للعمل الميداني وتصفير كافة السجلات والمعاملات التجريبية مع الحفاظ على الأصول المؤسسية
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Action 1: Zero Reset */}
            <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-rose-950">تصفير السجلات وبدء أول مشروع حقيقي</h3>
                  <p className="text-[11px] text-slate-500">حذف كافة المشاريع التجريبية والبدء من الرقم 1</p>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1.5 bg-white/80 p-3 rounded-xl border border-rose-100">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>يحافظ بالكامل على: الهوية الرسمية، الأختام، التواقيع، دليل العملاء والموردين، ومكتبة الشروط.</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>يقوم بحذف: المشاريع المسجلة، عروض الأسعار، فواتير المبيعات، سندات التسليم، وأوامر الشراء التجريبية.</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowZeroResetModal(true)}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تأكيد تصفير المنظومة والبدء الفعلي (Zero Reset)</span>
              </button>
            </div>

            {/* Action 2: Diagnostic & Verification */}
            <div className="p-5 rounded-2xl border border-teal-200 bg-teal-50/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-teal-950">الفحص والتدقيق المسبق قبل التصدير</h3>
                  <p className="text-[11px] text-slate-500">فحص سلامة الذاكرة، الأختام، المعادلات، والتكامل</p>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1.5 bg-white/80 p-3 rounded-xl border border-teal-100">
                <p>تشغيل محرك الفحص السداسي الشامل (Pre-Flight Diagnostics) للتحقق من:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>جاهزية وتشفير التواقيع والأختام الرسمية المعتمدة.</li>
                  <li>تطابق المحرك المالي مع لوائح هيئة الزكاة والضريبة والجمارك ZATCA.</li>
                  <li>سلامة قوالب التخزين المحلي وخلوها من السجلات المعطوبة.</li>
                </ul>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {onOpenPreFlight && (
                  <button
                    type="button"
                    onClick={onOpenPreFlight}
                    className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    <span>تشغيل التدقيق الشامل</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenBackupModal}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير PITR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: In-App User Deletion Confirmation (No browser alert/confirm) */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">تأكيد حذف حساب المستخدم</h3>
                <p className="text-xs text-slate-500">إجراء أمني نهائي لا يمكن التراجع عنه بعد الحذف</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100 text-xs text-slate-700 space-y-2">
              <div>
                <span className="text-slate-500">اسم المستخدم: </span>
                <strong className="text-slate-900">{userToDelete.fullName || userToDelete.name || userToDelete.username}</strong>
              </div>
              <div>
                <span className="text-slate-500">البريد الإلكتروني: </span>
                <span className="font-mono text-slate-800 font-semibold">{userToDelete.email}</span>
              </div>
              <div>
                <span className="text-slate-500">الدور الوظيفي: </span>
                <span className="font-bold text-[#174A84]">{userToDelete.role.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي</span>
              </button>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: In-App Zero Reset Confirmation (No browser alert/confirm) */}
      {showZeroResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">تأكيد تصفير المنظومة وبدء التشغيل الفعلي</h3>
                <p className="text-xs text-slate-500">تطهير كافة المعاملات التجريبية وبدء المشروع رقم 1</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 space-y-2">
              <p className="font-bold text-amber-950">تنبيه هام ومحكم:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>سيتم حذف كافة المشاريع المسجلة، عروض الأسعار، فواتير المبيعات، وسندات التسليم.</li>
                <li>سيتم إعادة تعيين أرقام التسلسل لتبدأ من 1 (مثل QT-001 و PO-001).</li>
                <li>سيتم حفظ نسخة احتياطية (Checkpoint Snapshot) تلقائياً قبل تنفيذ التصفير.</li>
                <li>ستبقى الهوية الرسمية، الأختام، التواقيع، ودليل العملاء والموردين محفوظة بالكامل.</li>
              </ul>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const res = resetAllTransactionalDataToZero();
                  setShowZeroResetModal(false);
                  if (res.success) {
                    setSavedToast(res.message);
                    setTimeout(() => setSavedToast(null), 4000);
                  } else {
                    setErrorMessage(res.message);
                    setTimeout(() => setErrorMessage(null), 4000);
                  }
                }}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>نعم، نفّذ التصفير الشامل الآن</span>
              </button>
              <button
                type="button"
                onClick={() => setShowZeroResetModal(false)}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
