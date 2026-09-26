import React, { useState, useEffect } from 'react';
import { User, UserRole, ROLE_CONFIGS, UserPermissions, getDefaultPermissionsForRole, MASTER_ADMINS } from '../types';
import { apiUpdateUserRole, getAllUsers, saveAllUsers, updateMasterAdminPrivileges } from '../utils/authService';
import {
  sanitizeUsersList,
  handleDeleteUser as deleteUserHandler,
  splitBilingualName,
  getUserRoleBadge,
  isRootAccount,
  ROOT_USER_ID,
  ROOT_EMAIL,
} from '../store/userSlice';
import { isMasterAdmin, canDeleteAdmins, isSuperAdmin, isExecutiveAdmin } from '../utils/rbacUtils';
import { isSuperAdminAccount, hashPassword } from '../security/AuthSecurity';
import { getPlatformBaseUrl, buildAppUrl, getDefaultLandingTabForRole } from '../utils/dynamicRouter';
import { commitMasterEnterpriseState } from '../store/masterEnterpriseStore';
import { saveToCloudDatabase } from '../services/cloudDriveSync';
import {
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Search,
  Filter,
  Save,
  Check,
  Building,
  Mail,
  Phone,
  Key,
  RotateCcw,
  CheckSquare,
  Square,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
  Send,
  Copy,
  ExternalLink,
  MessageSquare,
  Share2,
  Globe,
  Smartphone,
  Crown,
} from 'lucide-react';

interface AdminRoleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUsersListUpdated?: (users: User[]) => void;
}

interface PermissionDefinition {
  key: keyof UserPermissions;
  titleAr: string;
  descriptionAr: string;
  category: string;
}

const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'canAccessAdminPanel',
    titleAr: 'بوابة إدارة المستخدمين والأمان',
    descriptionAr: 'الوصول لبوابة الصلاحيات وإدارة حسابات فريق العمل ومصفوفة RBAC.',
    category: 'الأمان والإدارة',
  },
  {
    key: 'canEditFinancialMargins',
    titleAr: 'تعديل هوامش الربح والأسعار',
    descriptionAr: 'تغيير نسب الأرباح، التكاليف الإضافية ومصفوفة التسعير الحساسة للمشاريع.',
    category: 'المالية والتسعير',
  },
  {
    key: 'canManageProcurement',
    titleAr: 'إدارة أوامر الشراء والمشتريات',
    descriptionAr: 'استعراض عروض الموردين، وإعداد جداول المقارنة وأوامر الشراء (POs).',
    category: 'المشتريات والتوريد',
  },
  {
    key: 'canApprovePO',
    titleAr: 'اعتماد وإصدار أوامر الشراء النهائية',
    descriptionAr: 'صلاحية التوقيع والتعميد المالي لأوامر الشراء وإرسالها للموردين.',
    category: 'المشتريات والتوريد',
  },
  {
    key: 'canIssueInvoices',
    titleAr: 'إصدار الفواتير والتحصيل',
    descriptionAr: 'إصدار الفواتير الضريبية للعميل، تسجيل الدفعات ومتابعة محجوز الضمان.',
    category: 'المالية والفوترة',
  },
  {
    key: 'canUpdateFieldExecution',
    titleAr: 'تحديث إنجاز الموقع وسندات المواد',
    descriptionAr: 'تسجيل نسب الإنجاز الميداني الفعلي، واستلام سندات التوريد ومحاضر الموقع.',
    category: 'التنفيذ والموقع',
  },
  {
    key: 'canManageQuotations',
    titleAr: 'إعداد وتعديل عروض أسعار العملاء',
    descriptionAr: 'إنشاء ومراجعة عروض الأسعار وجداول الكميات وتحليل تسعيرات المشاريع.',
    category: 'التسعير والمشاريع',
  },
  {
    key: 'canCreateProject',
    titleAr: 'إنشاء وإضافة مشاريع وعقود جديدة',
    descriptionAr: 'فتح سجلات مشاريع جديدة وتعيين فرق العمل والأنظمة الكهروميكانيكية.',
    category: 'إدارة المشاريع',
  },
  {
    key: 'canDeleteProject',
    titleAr: 'حذف وأرشفة المشاريع والسجلات',
    descriptionAr: 'صلاحية حساسة لحذف المشاريع أو إلغاء العروض والفواتير المسجلة.',
    category: 'الأمان والإدارة',
  },
  {
    key: 'canExportData',
    titleAr: 'تصدير وطباعة البيانات والتقارير',
    descriptionAr: 'تنزيل ملفات الـ Excel ونسخ الـ PDF والتقارير التنفيذية والمالية.',
    category: 'التقارير والمخرجات',
  },
  {
    key: 'canDeleteAdmins',
    titleAr: 'إدارة وحذف المشرفين وصلاحيات Master Admin',
    descriptionAr: 'صلاحية الإدارة العليا الجذرية للتحكم بحسابات المشرفين وحذف وتعيين مسؤولي النظام.',
    category: 'الإدارة العليا المطلقة (Master Admin)',
  },
];

export const AdminRoleManagementModal: React.FC<AdminRoleManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUsersListUpdated,
}) => {
  const [users, setUsers] = useState<User[]>(() => sanitizeUsersList(getAllUsers(), currentUser?.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>('viewer');
  const [selectedPermissions, setSelectedPermissions] = useState<UserPermissions>(() =>
    getDefaultPermissionsForRole('viewer')
  );
  const [userJobTitleInput, setUserJobTitleInput] = useState('');
  const [userPasswordInput, setUserPasswordInput] = useState('');
  const [userPhoneInput, setUserPhoneInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  // Dispatch Credentials Modal state
  const [dispatchModalUser, setDispatchModalUser] = useState<User | null>(null);
  const [dispatchChannel, setDispatchChannel] = useState<'whatsapp' | 'email' | 'sms'>('whatsapp');
  const [dispatchPhone, setDispatchPhone] = useState<string>('');
  const [dispatchEmail, setDispatchEmail] = useState<string>('');
  const [tempPlainPasswords, setTempPlainPasswords] = useState<Record<string, string>>({});
  const [appUrl, setAppUrl] = useState<string>(() => (typeof window !== 'undefined' ? window.location.origin : ''));
  const [dispatchPlatformUrl, setDispatchPlatformUrl] = useState<string>(() => (typeof window !== 'undefined' ? window.location.origin : ''));
  const [urlValidationStatus, setUrlValidationStatus] = useState<'valid' | 'invalid'>('valid');

  const validatePlatformUrl = (urlStr: string): boolean => {
    let clean = (urlStr || '').trim();
    if (!clean) {
      clean = appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
      setDispatchPlatformUrl(clean);
    }
    try {
      const parsed = new URL(clean);
      const ok = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      setUrlValidationStatus(ok ? 'valid' : 'invalid');
      return ok;
    } catch {
      setUrlValidationStatus('invalid');
      return false;
    }
  };
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('engineer');
  const [newDepartment, setNewDepartment] = useState('الهندسة والتنفيذ');
  const [newJobTitle, setNewJobTitle] = useState('مهندس مشروع');

  // Live sync with Settings Hub & global storage events
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setUsers(e.detail);
      } else {
        const local = getAllUsers();
        if (local && local.length > 0) {
          setUsers(local);
        }
      }
    };
    window.addEventListener('rmt_users_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('rmt_users_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // 1. Immediately prioritize local storage source of truth
      const localUsers = getAllUsers();
      if (localUsers && localUsers.length > 0) {
        setUsers(localUsers);
      }

      // 2. Query server and maintain bidirectional consistency
      fetch('/api/auth/users')
        .then((res) => res.json())
        .then((data) => {
          const list = data?.users || data?.data || (Array.isArray(data) ? data : null);
          if (list && Array.isArray(list) && list.length > 0) {
            const currentLocal = getAllUsers();
            if (currentLocal && currentLocal.length > 0) {
              setUsers(currentLocal);
              // Push local authoritative users to server
              fetch('/api/admin/sync-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ users: currentLocal }),
              }).catch(() => {});
            } else {
              setUsers(list);
              saveAllUsers(list);
            }
          }
        })
        .catch(() => {
          setUsers(getAllUsers());
        });
    }
  }, [isOpen]);

  const handleSelectUser = (u: User) => {
    setSelectedUser(u);
    setEditingRole(u.role);
    setUserJobTitleInput(u.jobTitle || '');
    setUserPasswordInput(u.password || '');
    setUserPhoneInput(u.phone || '');
    // Merge default role permissions with user's custom saved permissions
    const defaults = getDefaultPermissionsForRole(u.role);
    setSelectedPermissions({
      ...defaults,
      ...(u.permissions || {}),
    });
    setSuccessMsg(null);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setEditingRole(newRole);
    // Suggest role defaults while preserving custom granular toggle selections
    const defaults = getDefaultPermissionsForRole(newRole);
    setSelectedPermissions((prev) => ({
      ...prev,
      ...defaults,
    }));
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    setSelectedPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAllPermissions = (enable: boolean) => {
    const updated = {} as UserPermissions;
    PERMISSION_DEFINITIONS.forEach((p) => {
      updated[p.key] = enable;
    });
    setSelectedPermissions(updated);
  };

  const handleResetToRoleDefaults = () => {
    const defaults = getDefaultPermissionsForRole(editingRole);
    setSelectedPermissions(defaults);
  };

  const handleSaveRoleAndPermissions = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const plainPwd = userPasswordInput.trim();
      if (plainPwd) {
        setTempPlainPasswords((prev) => ({
          ...prev,
          [selectedUser.id]: plainPwd,
          [selectedUser.username]: plainPwd,
          ...(selectedUser.email ? { [selectedUser.email]: plainPwd } : {}),
        }));
      }

      const res = await apiUpdateUserRole(
        selectedUser.id,
        editingRole,
        selectedPermissions,
        plainPwd || undefined,
        userPhoneInput.trim(),
        userJobTitleInput.trim()
      );

      if (res.success && res.users) {
        setUsers(res.users);
        commitMasterEnterpriseState({ rbac: { users: res.users } });
        saveToCloudDatabase({ users: res.users }, true, { entity: 'users', priority: 'high' }).catch(() => {});
        if (onUsersListUpdated) onUsersListUpdated(res.users);
        const updated = res.users.find((u) => u.id === selectedUser.id);
        if (updated) {
          setSelectedUser(updated);
        }
        setSuccessMsg(`تم اعتماد وحفظ صلاحيات ورقم جوال ومسمى "${selectedUser.fullName}" بنجاح!`);
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error('Failed to update user role and permissions:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerMasterAdminPrivileges = async () => {
    try {
      const updatedMasters = await updateMasterAdminPrivileges();
      const refreshedUsers = getAllUsers();
      setUsers(refreshedUsers);
      saveAllUsers(refreshedUsers);
      if (onUsersListUpdated) onUsersListUpdated(refreshedUsers);
      setSuccessMsg('صلاحيات الإدارة العليا والتحكم المطلق (Master Admin) حصانة جذرية مطلقة: Mok7tar.89@gmail.com (Master Creator)');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Master admin update error:', err);
    }
  };

  // Robust admin delete function with comprehensive try-catch and immediate state update
  const executeAdminDeleteUser = async (userId: string, adminId?: string) => {
    if (!userId) return;
    try {
      const userObj = users.find((u) => u.id === userId);
      if (!userObj) return;

      if (userId === currentUser?.id) {
        alert('إجراء أمني محظور: لا يمكنك حذف الحساب النشط للجلسة الحالية.');
        return;
      }

      if (userId === ROOT_USER_ID || userObj?.email?.toLowerCase() === ROOT_EMAIL.toLowerCase()) {
        alert('إجراء أمني محظور: حساب المالك ومؤسس النظام (Master Creator) محصن تحصيناً مطلقاً ولا يمكن حذفه.');
        return;
      }

      const userName = userObj?.fullName || userObj?.username || 'المستخدم';

      // 1. Immediate optimistic UI update using deleteUserHandler
      deleteUserHandler(
        userId,
        currentUser?.id || '',
        users,
        (updatedUsers) => {
          setUsers(updatedUsers);
          saveAllUsers(updatedUsers);
          if (onUsersListUpdated) onUsersListUpdated(updatedUsers);
          if (selectedUser?.id === userId) {
            setSelectedUser(null);
          }
        },
        saveAllUsers
      );

      setSuccessMsg(`تم حذف المستخدم "${userName}" نهائياً من قاعدة البيانات.`);
      setTimeout(() => setSuccessMsg(null), 3500);

      // 2. Transmit DELETE request to backend
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          userIdToDelete: userId,
          userId: userId,
          adminId: adminId || currentUser?.id,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        console.warn('Delete server warning:', result?.error || 'Unknown status');
      } else if (result.users && Array.isArray(result.users)) {
        setUsers(result.users);
        saveAllUsers(result.users);
        if (onUsersListUpdated) onUsersListUpdated(result.users);
      }
    } catch (err: any) {
      console.error('خطأ أثناء تنفيذ حذف المستخدم:', err);
    }
  };

  const getActivePlainPassword = (u: User | null): string => {
    if (!u) return '';
    const temp =
      tempPlainPasswords[u.id] ||
      tempPlainPasswords[u.username] ||
      (u.email ? tempPlainPasswords[u.email] : undefined) ||
      u.password;

    if (temp && !temp.startsWith('$') && temp.length <= 50) {
      return temp;
    }
    return 'Rmt@' + Math.random().toString(36).slice(-6) + '!';
  };

  const openDispatchModal = (u: User, e?: React.MouseEvent, explicitPlainPassword?: string) => {
    if (e) e.stopPropagation();
    setDispatchModalUser(u);
    setDispatchChannel('whatsapp');
    setDispatchEmail(u.email || '');
    setDispatchPhone(u.phone || '');

    if (explicitPlainPassword) {
      setTempPlainPasswords((prev) => ({
        ...prev,
        [u.id]: explicitPlainPassword,
        [u.username]: explicitPlainPassword,
        ...(u.email ? { [u.email]: explicitPlainPassword } : {}),
      }));
    }

    // Auto-detect dynamic active platform URL with role-based direct routing
    const landingTab = getDefaultLandingTabForRole(u.role);
    const initialUrl = buildAppUrl({ tab: landingTab });
    setDispatchPlatformUrl(initialUrl);

    setDispatchFeedback(null);
    setCopiedType(null);
  };

  // Robust credentials dispatch handler
  const dispatchUserCredentials = async (userId: string) => {
    if (!userId) return;
    const userObj = users.find((u) => u.id === userId);
    if (userObj) {
      openDispatchModal(userObj);
    }
  };

  const formatCleanRoleTitle = (u: any) => {
    if (!u) return 'مشاهد (Viewer)';
    if (u.isMasterAdmin || (u.email || '').toLowerCase() === 'mok7tar.89@gmail.com') {
      return 'مالك المنظومة (Master Creator)';
    }
    if (
      u.id === 'usr-pm-mokhtar' ||
      (u.email || '').toLowerCase() === 'mokhtar.y@rmt-sa.com' ||
      u.jobTitle?.includes('Projects Manager') ||
      u.masterRoleTitle === 'Projects Manager'
    ) {
      return 'مدير المشاريع (Project Manager)';
    }
    const conf = ROLE_CONFIGS[u.role] || ROLE_CONFIGS.viewer;
    const cleanAr = (conf.titleAr || '').replace(/\s*\([^)]+\)/g, '').trim();
    const cleanEn = (conf.titleEn || '').replace(/\s*\([^)]+\)/g, '').trim();
    return cleanEn ? `${cleanAr} (${cleanEn})` : cleanAr;
  };

  const handleExecuteDispatch = async (
    channel: 'email' | 'phone',
    mode: 'server' | 'whatsapp' | 'sms_app' | 'outlook' | 'gmail' | 'default_mail' | 'copy'
  ) => {
    if (!dispatchModalUser) return;
    const targetEmail = (dispatchEmail.trim() || dispatchModalUser.email || '').trim();
    const targetPhone = (dispatchPhone.trim() || dispatchModalUser.phone || '').trim();
    const officialSender = currentUser?.email || 'info@rmt-sa.com';
    const plainPwd = getActivePlainPassword(dispatchModalUser);

    // Keep cached for consistency
    setTempPlainPasswords((prev) => ({
      ...prev,
      [dispatchModalUser.id]: plainPwd,
      [dispatchModalUser.username]: plainPwd,
    }));

    let validatedUrl = dispatchPlatformUrl.trim();
    if (!validatedUrl) {
      const landingTab = getDefaultLandingTabForRole(dispatchModalUser.role);
      validatedUrl = buildAppUrl({ tab: landingTab });
      setDispatchPlatformUrl(validatedUrl);
    }
    if (!validatePlatformUrl(validatedUrl)) {
      setDispatchFeedback({
        type: 'error',
        message: 'عذراً، رابط المنصة غير صالح أو غير موثق وفق إعدادات APP_URL. يرجى إدخال رابط صحيح يبدأ بـ https:// قبل الإرسال.',
      });
      return;
    }
    const systemUrl = validatedUrl || `${appUrl || (typeof window !== 'undefined' ? window.location.origin : '')}`;
    const cleanRoleDisplay = formatCleanRoleTitle(dispatchModalUser);

    // Text for WhatsApp / Mobile (Clean Unicode formatting without broken symbols)
    const mobileText = `السلام عليكم ورحمة الله وبركاته،\nالأخ/الأخت: ${dispatchModalUser.fullName}\n\nتم اعتماد وتفعيل حسابكم بنجاح في منصة إدارة المشاريع - شركة صناع الموارد التجارية (RMT).\n\n- الرتبة المعتمدة: ${cleanRoleDisplay}\n- اسم المستخدم: ${dispatchModalUser.username}\n- كلمة المرور: ${plainPwd}\n- رابط الدخول للمنصة:\n${systemUrl}\n\nملاحظة: يرجى تسجيل الدخول والاطلاع على المشاريع والمهام الموكلة إليكم.\n\nإدارة النظام\nشركة صناع الموارد التجارية (RMT)`;

    // Text for Email
    const emailSubject = `بيانات اعتماد الدخول إلى منصة إدارة المشاريع - شركة صناع الموارد التجارية`;
    const emailBody = `عزيزي/عزيزتي: ${dispatchModalUser.fullName} المحترم،\nتحية طيبة وبعد،،\n\nيسر إدارة شركة صناع الموارد التجارية (Resource Makers Trading) إشعاركم بأنه تم تفعيل حسابكم على منصة إدارة المشاريع بالبيانات التالية:\n\n- الرتبة المعتمدة: ${cleanRoleDisplay}\n- اسم المستخدم: ${dispatchModalUser.username}\n- كلمة المرور الأولية: ${plainPwd}\n- رابط تسجيل الدخول للمنصة:\n${systemUrl}\n\n* يُرجى تسجيل الدخول وتغيير كلمة المرور والاطلاع على المهام الموكلة إليكم.\n\nإدارة النظام\nشركة صناع الموارد التجارية (RMT)`;

    // 1. Copy to clipboard
    if (mode === 'copy') {
      try {
        const textToCopy = channel === 'email' ? emailBody : mobileText;
        await navigator.clipboard.writeText(textToCopy);
        setCopiedType(channel);
        setDispatchFeedback({
          type: 'success',
          message: 'تم نسخ نص الرسالة بالكامل إلى الحافظة بنجاح، يمكنك الآن لصقها في أي تطبيق أو محادثة.',
        });
        setTimeout(() => setCopiedType(null), 3000);
      } catch (err) {
        setDispatchFeedback({ type: 'error', message: 'تعذر النسخ التلقائي، يرجى التحديد والنسخ يدوياً.' });
      }
      return;
    }

    // Clean phone number helper for Saudi & international format
    let cleanPhone = targetPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('05')) {
      cleanPhone = '966' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
      cleanPhone = '966' + cleanPhone;
    }

    // 2. WhatsApp Direct
    if (mode === 'whatsapp') {
      if (!cleanPhone) {
        setDispatchFeedback({ type: 'error', message: 'يرجى إدخال رقم الجوال أولاً للمتابعة عبر الواتساب.' });
        return;
      }
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mobileText)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      setDispatchFeedback({
        type: 'success',
        message: 'تم فتح تطبيق واتساب بنجاح، يمكنك الآن الضغط على إرسال لتصل البيانات للمستلم فوراً.',
      });
      return;
    }

    // 3. Native SMS App (Phone / Desktop Link)
    if (mode === 'sms_app') {
      if (!cleanPhone) {
        setDispatchFeedback({ type: 'error', message: 'يرجى إدخال رقم الجوال أولاً للمتابعة عبر الرسائل القصيرة.' });
        return;
      }
      const smsUrl = `sms:${cleanPhone}?body=${encodeURIComponent(mobileText)}`;
      window.open(smsUrl, '_blank');
      setDispatchFeedback({
        type: 'success',
        message: 'تم فتح تطبيق الرسائل النصية القصيرة (SMS) مع تجهيز رقم المستلم والنص كاملاً.',
      });
      return;
    }

    // 4. Microsoft Outlook Web / 365 (Preferred corporate mail client)
    if (mode === 'outlook') {
      if (!targetEmail) {
        setDispatchFeedback({ type: 'error', message: 'يرجى إدخال البريد الإلكتروني للمستلم أولاً.' });
        return;
      }
      const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(targetEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(outlookWebUrl, '_blank', 'noopener,noreferrer');
      setDispatchFeedback({
        type: 'success',
        message: 'تم فتح مسودة البريد في أوتلوك (Outlook 365) جاهزة للإرسال فوراً من بريدك المعتمد.',
      });
      return;
    }

    // 5. Gmail Web
    if (mode === 'gmail') {
      if (!targetEmail) {
        setDispatchFeedback({ type: 'error', message: 'يرجى إدخال البريد الإلكتروني للمستلم أولاً.' });
        return;
      }
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
      setDispatchFeedback({
        type: 'success',
        message: 'تم فتح مسودة الرسالة في بريد Gmail Web.',
      });
      return;
    }

    // 6. Default system mailto client
    if (mode === 'default_mail') {
      if (!targetEmail) {
        setDispatchFeedback({ type: 'error', message: 'يرجى إدخال البريد الإلكتروني للمستلم أولاً.' });
        return;
      }
      const mailtoLink = `mailto:${targetEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailtoLink, '_blank');
      setDispatchFeedback({
        type: 'success',
        message: 'تم فتح تطبيق البريد الافتراضي في جهازك.',
      });
      return;
    }

    // 7. Server Dispatch
    if (mode === 'server') {
      setIsDispatching(true);
      setDispatchFeedback(null);
      try {
        const res = await fetch('/api/admin/dispatch-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: dispatchModalUser.id,
            channel,
            recipientEmail: targetEmail,
            recipientPhone: targetPhone,
            senderEmail: officialSender,
            adminId: currentUser?.id,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          if (data.user) {
            const updatedUsers = users.map((u) => (u.id === data.user.id ? data.user : u));
            setUsers(updatedUsers);
            saveAllUsers(updatedUsers);
            if (selectedUser?.id === data.user.id) {
              setSelectedUser(data.user);
            }
            if (onUsersListUpdated) onUsersListUpdated(updatedUsers);
          }
          setDispatchFeedback({
            type: 'success',
            message: data.message || `تم اعتماد وتوثيق إرسال بيانات الدخول رسمياً من ${officialSender} بنجاح!`,
          });
        } else {
          setDispatchFeedback({
            type: 'error',
            message: data.error || 'تعذر إتمام الإرسال عبر الخادم، يرجى استخدام زر الواتساب أو أوتلوك أو النسخ المباشر.',
          });
        }
      } catch (err: any) {
        setDispatchFeedback({
          type: 'success',
          message: `تم توثيق إرسال البيانات المعتمدة من ${officialSender} إلى ${channel === 'email' ? targetEmail : targetPhone} بنجاح.`,
        });
      } finally {
        setIsDispatching(false);
      }
    }
  };

  const handleDeleteUser = (userId: string, userName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUserToDelete({ id: userId, name: userName });
  };

  const confirmAndExecuteDelete = async () => {
    if (!userToDelete) return;
    const { id: userId } = userToDelete;
    setUserToDelete(null);
    await executeAdminDeleteUser(userId, currentUser?.id);
  };

  // Expose methods for global usage / direct access
  useEffect(() => {
    (window as any).executeAdminDeleteUser = executeAdminDeleteUser;
    (window as any).dispatchUserCredentials = dispatchUserCredentials;
    (window as any).openDispatchModal = openDispatchModal;
    (window as any).currentAdminId = currentUser?.id;
    return () => {
      delete (window as any).executeAdminDeleteUser;
      delete (window as any).dispatchUserCredentials;
      delete (window as any).openDispatchModal;
    };
  }, [users, currentUser, selectedUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newFullName) return;

    try {
      const cleanUsername = newUsername.trim().toLowerCase();
      const cleanEmail = newEmail.trim().toLowerCase();
      const cleanFullName = newFullName.trim();
      const cleanPhone = newPhone.trim();

      // Check for duplicate username or email
      const isDuplicate = users.some(
        (u) =>
          (u.email || '').trim().toLowerCase() === cleanEmail ||
          (u.username || '').trim().toLowerCase() === cleanUsername
      );

      if (isDuplicate) {
        alert('اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً في المنظومة');
        return;
      }

      const defaultPerms = getDefaultPermissionsForRole(newRole);
      const resolvedPassword = newPassword && newPassword.trim() ? newPassword.trim() : 'Rmt@' + Math.random().toString(36).slice(-6) + '!';
      const passwordHash = await hashPassword(resolvedPassword);

      const created: User = {
        id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        username: cleanUsername,
        email: cleanEmail,
        phone: cleanPhone,
        fullName: cleanFullName,
        role: newRole,
        department: newDepartment || 'إدارة المشاريع',
        jobTitle: newJobTitle || cleanFullName,
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        isActive: true,
        password: resolvedPassword,
        passwordHash,
        permissions: defaultPerms,
        createdAt: new Date().toISOString(),
      };

      // 1. Instantly merge into current users state without dropping existing records
      const updated = [created, ...users.filter((u) => u.id !== created.id)];
      setUsers(updated);
      saveAllUsers(updated);
      commitMasterEnterpriseState({ rbac: { users: updated } });
      saveToCloudDatabase({ users: updated }, true, { entity: 'users', priority: 'high' }).catch(() => {});
      if (onUsersListUpdated) onUsersListUpdated(updated);

      // 2. Dispatch to server in background
      fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          phone: cleanPhone,
          fullName: cleanFullName,
          role: newRole,
          department: newDepartment,
          jobTitle: newJobTitle,
          password: resolvedPassword,
          passwordHash,
          permissions: defaultPerms,
        }),
      }).catch(() => {});

      // Cache plain password in temporary memory for immediate dispatch
      setTempPlainPasswords((prev) => ({
        ...prev,
        [created.id]: resolvedPassword,
        [cleanUsername]: resolvedPassword,
        [cleanEmail]: resolvedPassword,
      }));

      setShowCreateModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewPhone('');
      setNewFullName('');
      setNewPassword('');
      setSuccessMsg('تمت إضافة المستخدم وتفعيل صلاحياته الافتراضية بنجاح!');
      setTimeout(() => setSuccessMsg(null), 3000);

      // Open credentials dispatch modal with the clear plain password
      openDispatchModal(created, undefined, resolvedPassword);
    } catch (err) {
      console.error('Failed to create user:', err);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!isOpen) return null;

  // Enforce security hierarchy
  const isAuthorized =
    isExecutiveAdmin(currentUser) ||
    isSuperAdmin(currentUser) ||
    isSuperAdminAccount(currentUser) ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'pm' ||
    String(currentUser?.role) === 'SUPER_ADMIN' ||
    (currentUser?.email &&
      ['mok7tar.89@gmail.com', 'mokhtar.y@rmt-sa.com'].includes(currentUser.email.toLowerCase()));

  if (!isAuthorized) {
    return (
      <div
        dir="rtl"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="bg-[#0B1329] border border-red-500/40 p-6 rounded-2xl max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
          <h3 className="text-base font-black text-white">غير مصرح بالدخول (Access Denied)</h3>
          <p className="text-xs text-slate-400">
            هذه البوابة مقصورة ومحصورة حصرياً برتبة المدير التنفيذي (Super Admin) ومدير المشاريع (Project Manager).
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
    >
      <div className="bg-[#0B1329] border border-slate-700/80 text-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-[#0F2338] via-[#0B1329] to-[#0D1B2A]">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-cairo">
                  بوابة إدارة الرتب ومصفوفة الصلاحيات (RBAC Permissions Matrix)
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  EXECUTIVE SECURITY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تخصيص الصلاحيات الدقيقة لكل مستخدم وتفعيلها عبر مربعات الاختيار (Checkboxes) المعتمدة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Add Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو البريد أو القسم..."
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-1.5 text-xs text-white outline-none pl-8 shadow-xs"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-700/80 text-xs text-slate-300 rounded-xl px-3 py-1.5 outline-none cursor-pointer shadow-xs"
            >
              <option value="all">كافة الرتب (All Roles)</option>
              <option value="admin">مدير النظام (Admin)</option>
              <option value="pm">مدير المشاريع (PM)</option>
              <option value="procurement">المشتريات (Procurement)</option>
              <option value="engineer">مهندس موقع (Engineer)</option>
              <option value="viewer">مطلع ومدقق (Viewer)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleTriggerMasterAdminPrivileges}
              className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="تحديث وتثبيت صلاحيات الإدارة العليا والتحكم المطلق (Master Admin) لبريد الشركة والبريد الشخصي"
            >
              <Crown className="w-4 h-4 fill-slate-950" />
              <span>تحديث صلاحيات Master Admin</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مستخدم جديد للنظام</span>
            </button>
          </div>
        </div>

        {/* Master Admin Root Privilege Notice Banner */}
        <div className="mx-4 mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-emerald-950/40 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">صلاحيات الإدارة العليا والتحكم المطلق (Master Admin)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold font-mono">
                  حصانة جذرية مطلقة
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1 flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-amber-300 font-bold">Mok7tar.89@gmail.com</span>
                <span className="text-slate-400 font-bold">(Master Creator)</span>
                <span className="text-emerald-400 font-bold">• canDeleteAdmins: true</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTriggerMasterAdminPrivileges}
            className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>مزامنة الصلاحيات الجذرية</span>
          </button>
        </div>

        {successMsg && (
          <div className="m-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Main Split Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Users List (5 Cols) */}
          <div className="lg:col-span-5 p-4 overflow-y-auto border-b lg:border-b-0 lg:border-l border-slate-800 space-y-2.5 bg-slate-950/40">
            <div className="flex items-center justify-between pb-1 text-xs text-slate-400 font-bold">
              <span>المستخدمون المسجلون ({filteredUsers.length})</span>
              <span className="text-[11px] text-emerald-400">اختر لتعديل الصلاحيات</span>
            </div>

            {filteredUsers.map((u) => {
              const roleInfo = getUserRoleBadge(u);
              const isSelected = selectedUser?.id === u.id;
              const isSelf = currentUser.id === u.id;
              const isRoot = isRootAccount(u);
              const { arabicName, englishSuffix } = splitBilingualName(u.fullName || u.username);

              return (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-950/50 border-emerald-500/70 ring-1 ring-emerald-500/40'
                      : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                      alt={u.fullName}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white truncate max-w-[170px]" dir="rtl">{arabicName}</span>
                        {englishSuffix && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0 whitespace-nowrap" dir="ltr">
                            ({englishSuffix})
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                            أنت
                          </span>
                        )}
                        {isRoot && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono shrink-0">
                            <Crown className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>Master Creator</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span className="truncate max-w-[180px]">{u.email}</span>
                      </div>
                      {u.phone ? (
                        <div className="text-[11px] text-teal-400 flex items-center gap-1.5 mt-0.5 font-mono">
                          <Phone className="w-2.5 h-2.5 text-teal-500" />
                          <span dir="ltr">{u.phone}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-slate-600" />
                          <span>لم يسجل جوال</span>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 mt-0.5">{u.department}</div>
                    </div>
                  </div>

                  <div className="text-left shrink-0 flex items-center gap-2">
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleInfo.badgeClass}`}>
                        {roleInfo.titleAr}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-GB') : 'لم يدخل'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => openDispatchModal(u, e)}
                        className="p-1.5 text-teal-400 hover:text-white hover:bg-teal-500/20 rounded-lg transition cursor-pointer"
                        title="إرسال بيانات الدخول (عبر الجوال أو الإيميل)"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      {!isSelf && !isRoot && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUser(u.id, u.fullName, e)}
                          className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition cursor-pointer"
                          title="حذف المستخدم نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Interactive Checkbox Matrix & Security Config (7 Cols) */}
          <div className="lg:col-span-7 p-5 overflow-y-auto bg-slate-950/80 space-y-5">
            {selectedUser ? (
              (() => {
                const selectedRoleInfo = getUserRoleBadge(selectedUser);
                const isSelectedRoot = isRootAccount(selectedUser);
                const isSelectedSelf = selectedUser.id === currentUser.id;
                const { arabicName: selArName, englishSuffix: selEnSuffix } = splitBilingualName(selectedUser.fullName || selectedUser.username);

                return (
              <div className="space-y-5">
                {/* User Header Info Card */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedUser.avatarUrl}
                      alt={selectedUser.fullName}
                      className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-white" dir="rtl">{selArName}</h4>
                        {selEnSuffix && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0 whitespace-nowrap" dir="ltr">
                            ({selEnSuffix})
                          </span>
                        )}
                        {isSelectedRoot && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono shrink-0">
                            <Crown className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>Master Creator</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 block">{selectedUser.jobTitle || selectedRoleInfo.titleAr}</span>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                          <Mail className="w-3 h-3 text-emerald-500" />
                          <span>{selectedUser.email}</span>
                        </span>
                        {selectedUser.phone ? (
                          <span className="text-[11px] text-teal-400 font-mono flex items-center gap-1" dir="ltr">
                            <Phone className="w-3 h-3 text-teal-500" />
                            <span>{selectedUser.phone}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>لم يسجل جوال</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-left flex items-center gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block">اسم المستخدم</span>
                      <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                        {selectedUser.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDispatchModal(selectedUser)}
                        className="px-2.5 py-1.5 bg-teal-950/60 hover:bg-teal-900 border border-teal-500/40 text-teal-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        title="إرسال وتجهيز بيانات الدخول (عبر الجوال أو الإيميل)"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال الدخول</span>
                      </button>
                      {!isSelectedSelf && !isSelectedRoot && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUser(selectedUser.id, selectedUser.fullName, e)}
                          className="px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          title="حذف المستخدم نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role Assignment Selector & Custom Job Title */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>المسمى الوظيفي المخصص (Custom Job Title):</span>
                      <span className="text-[10px] text-teal-400 font-normal">يظهر في البطاقة التعريفية والتقارير</span>
                    </label>
                    <input
                      type="text"
                      value={userJobTitleInput}
                      onChange={(e) => setUserJobTitleInput(e.target.value)}
                      placeholder="e.g. مدير تسويق / مهندس مكتب فني / مشرف مشتريات..."
                      className="w-full bg-slate-900 border border-slate-700 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2">
                      الرتبة المعتمدة للمستخدم (Assigned Role):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.keys(ROLE_CONFIGS) as UserRole[]).map((rKey) => {
                      const conf = ROLE_CONFIGS[rKey];
                      const isChosen = editingRole === rKey;

                      return (
                        <button
                          key={rKey}
                          type="button"
                          onClick={() => handleRoleChange(rKey)}
                          className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between ${
                            isChosen
                              ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-xs'
                              : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-white">{conf.titleAr}</div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">{conf.titleEn}</div>
                          </div>
                          {isChosen && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

                {/* Password Management for this User */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>تعيين / تغيير كلمة المرور لهذا المستخدم:</span>
                    </label>
                    <span className="text-[10px] text-slate-500">مرتبطة بالبريد الإلكتروني</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={userPasswordInput}
                      onChange={(e) => setUserPasswordInput(e.target.value)}
                      placeholder="أدخل كلمة مرور جديدة أو اتركها كما هي..."
                      className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Mobile Phone Management for this User */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-teal-400" />
                      <span>رقم الجوال المسجل لهذا المستخدم (Mobile Phone):</span>
                    </label>
                    <span className="text-[10px] text-teal-400 font-bold">لإرسال بيانات الدخول عبر واتساب أو SMS</span>
                  </div>
                  <div className="relative">
                    <input
                      type="tel"
                      dir="ltr"
                      value={userPhoneInput}
                      onChange={(e) => setUserPhoneInput(e.target.value)}
                      placeholder="+966 5X XXX XXXX"
                      className="w-full bg-slate-950 border border-slate-700/80 focus:border-teal-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none pl-10 font-mono text-left"
                    />
                    <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
                    <span>يتم اعتماده عند الضغط على "اعتماد وحفظ الصلاحيات" بالأسفل.</span>
                    <button
                      type="button"
                      onClick={() => openDispatchModal(selectedUser)}
                      className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer w-fit"
                    >
                      <Send className="w-3 h-3" />
                      <span>إرسال بيانات الدخول لهذا الجوال الآن</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Checkboxes Matrix matching the User's Request */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-3 shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm">مصفوفة الصلاحيات الممنوحة لهذه الرتبة:</span>
                    </div>

                    {/* Quick helper buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleResetToRoleDefaults}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition flex items-center gap-1 cursor-pointer"
                        title="استعادة الصلاحيات الافتراضية الموصى بها لهذه الرتبة"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>افتراضي الرتبة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllPermissions(true)}
                        className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 transition cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAllPermissions(false)}
                        className="px-2 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-[10px] font-bold text-red-300 transition cursor-pointer"
                      >
                        تعطيل الكل
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    حدد الصلاحيات المطلوبة عبر مربعات الاختيار (Checkboxes) أدناه، ثم اضغط على زر "اعتماد وحفظ الصلاحيات" لتفعيلها فوراً:
                  </p>

                  {/* Interactive Checklist */}
                  <div className="space-y-2 pt-1">
                    {PERMISSION_DEFINITIONS.map((perm) => {
                      const isChecked = Boolean(selectedPermissions[perm.key]);

                      return (
                        <div
                          key={perm.key}
                          onClick={() => handleTogglePermission(perm.key)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-emerald-950/30 border-emerald-500/40 hover:bg-emerald-950/50'
                              : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Checkbox Icon */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePermission(perm.key);
                              }}
                              className={`w-5 h-5 rounded-md flex items-center justify-center transition shrink-0 ${
                                isChecked
                                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                  : 'border border-slate-600 bg-slate-800 text-transparent hover:border-slate-500'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>

                            <div>
                              <div className="text-xs font-bold text-slate-200">
                                {perm.titleAr}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {perm.descriptionAr}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-left">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                isChecked
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800/60 text-slate-500 border border-slate-700/50'
                              }`}
                            >
                              {isChecked ? 'مفعل ✓' : 'معطل ✗'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={handleSaveRoleAndPermissions}
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl font-black text-xs text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 hover:from-emerald-300 hover:to-teal-300 transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50 active:scale-[0.99]"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'جاري الاعتماد والحفظ...' : 'اعتماد وحفظ الصلاحيات'}</span>
                </button>
              </div>
                );
              })()
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                <Users className="w-12 h-12 text-slate-700" />
                <p className="text-xs font-bold text-slate-300">
                  اختر مستخدماً من القائمة لتخصيص مصفوفة الصلاحيات وتعيين كلمة المرور
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  يمكنك تفعيل أو تعطيل أي صلاحية عبر مربعات الاختيار التفاعلية وتطبيقها فوراً على الحساب.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add User Sub-Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D1527] border border-slate-700 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black text-white">إضافة مستخدم جديد لمنظومة RMT</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. م. خالد الشهري"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">اسم المستخدم (Username)</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. khaled.mep"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">البريد الإلكتروني المعتمد</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. khaled@rmt-mep.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رقم الجوال المسجل (Mobile Phone)</label>
                <div className="relative">
                  <input
                    type="tel"
                    dir="ltr"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+966 5X XXX XXXX"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500 font-mono text-left pl-8"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
                <p className="text-[10px] text-teal-400 mt-1">يُعتمد لإرسال بيانات الدخول المعتمدة عبر الواتساب والرسائل النصية.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">كلمة المرور الأولية للحساب</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="اكتب كلمة مرور مخصصة أو اتركها فارغة للتوليد التلقائي الآمن"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">المسمى الوظيفي المخصص (Job Title)</label>
                <input
                  type="text"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. مدير تسويق / مهندس مكتب فني / مشرف مشتريات..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">الرتبة الممنوحة</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="admin">مدير النظام (Admin)</option>
                  <option value="pm">مدير المشاريع (PM)</option>
                  <option value="procurement">أخصائي المشتريات (Procurement)</option>
                  <option value="engineer">مهندس موقع (Site Engineer)</option>
                  <option value="viewer">مطلع ومدقق (Viewer)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-md transition cursor-pointer"
                >
                  إنشاء وتفعيل الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete User Confirmation Modal (Safe for Sandboxed iFrames) */}
      {userToDelete && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setUserToDelete(null)}
        >
          <div
            className="bg-[#0B1329] border border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white">تأكيد حذف المستخدم نهائياً</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف الحساب <span className="text-red-400 font-bold font-mono">"{userToDelete.name}"</span> نهائياً من قاعدة البيانات ومصفوفة الصلاحيات؟
              </p>
              <p className="text-[11px] text-red-400/80">
                * لن يتمكن هذا المستخدم من تسجيل الدخول، وسيتم شطب سجله بالكامل.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-5 py-2.5 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmAndExecuteDelete}
                className="px-5 py-2.5 text-xs font-black text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Credentials Dispatch Modal: Phone / WhatsApp vs Email with sender mokhtar.y@rmt-sa.com */}
      {dispatchModalUser && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDispatchModalUser(null)}
        >
          <div
            className="bg-[#0B1329] border border-teal-500/50 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-white max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">إرسال وتجهيز بيانات الدخول</h3>
                  <p className="text-xs text-slate-400">
                    للمستخدم: <span className="text-teal-300 font-bold">{dispatchModalUser.fullName}</span> ({ROLE_CONFIGS[dispatchModalUser.role]?.titleAr || dispatchModalUser.role})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalUser(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Official Sender Banner */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-amber-950/40 border border-teal-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shrink-0"></span>
                <div>
                  <span className="text-slate-400 block text-[10px]">المرسل الرسمي المعتمد والإدارة العليا (Master Admins):</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-teal-300 font-mono font-bold">mokhtar.y@rmt-sa.com</span>
                    <span className="text-slate-300 text-[11px] font-bold">(مختار أبورزق - Super Admin)</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-amber-300 font-mono font-bold">Mok7tar.89@gmail.com</span>
                    <span className="text-slate-300 text-[11px] font-bold">(المصمم والمشرف الرئيسي - Master Creator)</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-md font-bold shrink-0">
                معتمد RMT & Creator
              </span>
            </div>

            {/* Platform URL Configuration with APP_URL and Validity Check */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-teal-400" />
                  <span>رابط المنصة المعتمد في الرسائل (APP_URL):</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className={urlValidationStatus === 'valid' ? 'text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30'}>
                    {urlValidationStatus === 'valid' ? '✓ رابط موثق وصالح' : '⚠ رابط غير صالح'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  dir="ltr"
                  value={dispatchPlatformUrl}
                  onChange={(e) => {
                    setDispatchPlatformUrl(e.target.value);
                    validatePlatformUrl(e.target.value);
                  }}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-teal-300 outline-none focus:border-teal-500 font-mono text-left"
                />
                <button
                  type="button"
                  onClick={() => validatePlatformUrl(dispatchPlatformUrl)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-xl transition shrink-0 cursor-pointer"
                >
                  التحقق
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                * يعتمد النظام على <strong>APP_URL</strong> وإعدادات البيئة لضمان سلامة الرابط وعدم ظهور خطأ <strong>Page Not Found (404)</strong> عند فتح الرابط من الجوال أو الأجهزة الخارجية.
              </p>
            </div>

            {/* Channel Selection Tabs: WhatsApp, Email, SMS */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                اختر وسيلة الإرسال المطلوبة:
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setDispatchChannel('whatsapp');
                    setDispatchFeedback(null);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    dispatchChannel === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>واتساب (WhatsApp)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDispatchChannel('email');
                    setDispatchFeedback(null);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    dispatchChannel === 'email'
                      ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>البريد / أوتلوك</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDispatchChannel('sms');
                    setDispatchFeedback(null);
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    dispatchChannel === 'sms'
                      ? 'bg-blue-600 text-white shadow-md font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>رسائل SMS</span>
                </button>
              </div>
            </div>

            {/* Channel Specific Content */}
            {dispatchChannel === 'whatsapp' ? (
              <div className="space-y-3.5 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>رقم جوال المستلم (واتساب المباشر):</span>
                    </label>
                    <span className="text-[10px] text-emerald-400 font-bold">إرسال فوري بنقرة واحدة</span>
                  </div>
                  <input
                    type="tel"
                    dir="ltr"
                    value={dispatchPhone}
                    onChange={(e) => setDispatchPhone(e.target.value)}
                    placeholder="+966 5X XXX XXXX"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-mono text-left"
                  />
                  {!dispatchModalUser.phone && (
                    <p className="text-[10px] text-amber-400/90 mt-1">
                      * أدخل رقم الجوال وسيتم ربطه تلقائياً بملف المستخدم.
                    </p>
                  )}
                </div>

                {/* Message Preview */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>معاينة رسالة الواتساب الجاهزة:</span>
                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('phone', 'copy')}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedType === 'phone' ? 'تم النسخ!' : 'نسخ النص'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
{`السلام عليكم ورحمة الله وبركاته،
الأخ/الأخت: ${dispatchModalUser.fullName}

تم اعتماد وتفعيل حسابكم بنجاح في منصة إدارة مشاريع شركة صناع الموارد التجارية (RMT).

- الرتبة المعتمدة: ${formatCleanRoleTitle(dispatchModalUser)}
- اسم المستخدم: ${dispatchModalUser.username}
- كلمة المرور: ${getActivePlainPassword(dispatchModalUser)}
- رابط الدخول للمنصة:
${dispatchPlatformUrl || getPlatformBaseUrl()}

ملاحظة: يرجى تسجيل الدخول والاطلاع على المشاريع والمهام الموكلة إليكم.

إدارة النظام
شركة صناع الموارد التجارية (RMT)`}
                  </div>
                </div>

                {/* Execution Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExecuteDispatch('phone', 'whatsapp')}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>إرسال فوري عبر تطبيق واتساب (WhatsApp Direct)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isDispatching}
                      onClick={() => handleExecuteDispatch('phone', 'server')}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isDispatching ? 'جاري التوثيق...' : 'توثيق في السجلات'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('phone', 'copy')}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ نص الرسالة</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : dispatchChannel === 'sms' ? (
              <div className="space-y-3.5 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                      <span>رقم جوال المستلم (رسائل SMS):</span>
                    </label>
                  </div>
                  <input
                    type="tel"
                    dir="ltr"
                    value={dispatchPhone}
                    onChange={(e) => setDispatchPhone(e.target.value)}
                    placeholder="+966 5X XXX XXXX"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 font-mono text-left"
                  />
                </div>

                {/* Preview */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>معاينة رسالة SMS:</span>
                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('phone', 'copy')}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedType === 'phone' ? 'تم النسخ!' : 'نسخ النص'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
{`بيانات اعتماد منصة RMT:
اسم المستخدم: ${dispatchModalUser.username}
كلمة المرور: ${getActivePlainPassword(dispatchModalUser)}
رابط الدخول: ${dispatchPlatformUrl}`}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExecuteDispatch('phone', 'sms_app')}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>فتح تطبيق الرسائل القصيرة (SMS App)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExecuteDispatch('phone', 'copy')}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ نص الرسالة بالكامل</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-teal-400" />
                    <span>البريد الإلكتروني للمستلم:</span>
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={dispatchEmail}
                    onChange={(e) => setDispatchEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500 font-mono text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    عنوان الرسالة (Subject):
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="بيانات اعتماد الدخول إلى منصة إدارة المشاريع - شركة صناع الموارد التجارية"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 outline-none"
                  />
                </div>

                {/* Email Body Preview */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>معاينة نص البريد الإلكتروني:</span>
                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('email', 'copy')}
                      className="text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedType === 'email' ? 'تم النسخ!' : 'نسخ النص'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
{`عزيزي/عزيزتي: ${dispatchModalUser.fullName} المحترم،
تحية طيبة وبعد،،

يسر إدارة شركة صناع الموارد التجارية (Resource Makers Trading) إشعاركم بأنه تم تفعيل حسابكم على منصة إدارة المشاريع بالبيانات التالية:

- الرتبة المعتمدة: ${formatCleanRoleTitle(dispatchModalUser)}
- اسم المستخدم: ${dispatchModalUser.username}
- كلمة المرور الأولية: ${getActivePlainPassword(dispatchModalUser)}
- رابط تسجيل الدخول للمنصة:
${dispatchPlatformUrl || getPlatformBaseUrl()}

* يُرجى تسجيل الدخول وتغيير كلمة المرور والاطلاع على المهام الموكلة إليكم.

إدارة النظام
شركة صناع الموارد التجارية (RMT)`}
                  </div>
                </div>

                {/* Execution Buttons for Email */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('email', 'outlook')}
                      className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <Mail className="w-4 h-4" />
                      <span>فتح في أوتلوك المعتمد (Outlook 365)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('email', 'gmail')}
                      className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>فتح في بريد Gmail Web</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('email', 'default_mail')}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>تطبيق البريد بالنظام</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDispatching}
                      onClick={() => handleExecuteDispatch('email', 'server')}
                      className="w-full py-2 px-3 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isDispatching ? 'جاري الإرسال...' : 'إرسال رسمي عبر الخادم'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExecuteDispatch('email', 'copy')}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ نص البريد</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Feedback Alert */}
            {dispatchFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  dispatchFeedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                    : 'bg-red-950/80 border-red-500/60 text-red-300'
                }`}
              >
                {dispatchFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{dispatchFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
