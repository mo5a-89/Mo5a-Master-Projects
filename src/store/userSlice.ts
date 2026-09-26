export const ROOT_USER_ID = 'usr-master-mokhtar';
export const ROOT_EMAIL = 'Mok7tar.89@gmail.com';

export const isRootAccount = (user: any): boolean => {
  if (!user) return false;
  const uid = user.id || '';
  const email = (user.email || '').trim().toLowerCase();
  return uid === ROOT_USER_ID || email === ROOT_EMAIL.toLowerCase();
};

/**
 * Split bilingual user names to prevent awkward line breaks and parentheses overlap
 * Example: "مختار أبورزق (Master Creator)" -> arabicName: "مختار أبورزق", englishSuffix: "Master Creator"
 */
export const splitBilingualName = (fullName: string = '') => {
  const cleanName = (fullName || '').trim();
  // Match parenthetical English suffix: (Master Creator), (Projects Manager), etc.
  const match = cleanName.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (match) {
    return {
      arabicName: match[1].trim(),
      englishSuffix: match[2].trim(),
    };
  }
  return {
    arabicName: cleanName,
    englishSuffix: null,
  };
};

/**
 * Align badges with actual user permissions, custom jobTitle and role properties
 */
export const getUserRoleBadge = (u: any) => {
  const isMaster = isRootAccount(u) || Boolean(u?.isMasterAdmin);
  const isPM = u?.id === 'usr-pm-mokhtar' || (u?.email || '').toLowerCase() === 'mokhtar.y@rmt-sa.com' || u?.jobTitle?.includes('Projects Manager') || u?.masterRoleTitle === 'Projects Manager';
  const customTitle = (u?.jobTitle || '').trim();

  if (isMaster) {
    return {
      titleAr: customTitle || 'مالك المنظومة',
      titleEn: 'Master Creator',
      badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40',
      isMaster: true,
    };
  }
  if (isPM) {
    return {
      titleAr: customTitle || 'مدير المشاريع',
      titleEn: 'Projects Manager',
      badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/40',
      isMaster: false,
    };
  }
  if (u?.role === 'admin') {
    return {
      titleAr: customTitle || 'مشرف عمليات',
      titleEn: 'Operational Admin',
      badgeClass: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40',
      isMaster: false,
    };
  }
  if (u?.role === 'pm') {
    return {
      titleAr: customTitle || 'مدير مشاريع',
      titleEn: 'Project Manager',
      badgeClass: 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40',
      isMaster: false,
    };
  }
  if (u?.role === 'procurement') {
    return {
      titleAr: customTitle || 'أخصائي مشتريات',
      titleEn: 'Procurement',
      badgeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40',
      isMaster: false,
    };
  }
  if (u?.role === 'accountant') {
    return {
      titleAr: customTitle || 'محاسب ومدير مالي',
      titleEn: 'Accountant',
      badgeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/40',
      isMaster: false,
    };
  }
  if (u?.role === 'estimator') {
    return {
      titleAr: customTitle || 'مهندس تسعير',
      titleEn: 'Estimator',
      badgeClass: 'bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/40',
      isMaster: false,
    };
  }
  if (u?.role === 'engineer') {
    return {
      titleAr: customTitle || 'مهندس موقع وتنفيذ',
      titleEn: 'Site Engineer',
      badgeClass: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40',
      isMaster: false,
    };
  }
  if (u?.role === 'editor') {
    return {
      titleAr: customTitle || 'محرر ومسؤول بيانات',
      titleEn: 'Editor',
      badgeClass: 'bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/40',
      isMaster: false,
    };
  }

  // Dynamic styling based on granular permissions
  const hasAdminPerms = u?.permissions?.canAccessAdminPanel || u?.permissions?.canDeleteProject;
  const hasOpsPerms = u?.permissions?.canManageQuotations || u?.permissions?.canCreateProject || u?.permissions?.canApprovePO || u?.permissions?.canIssueInvoices;

  const badgeClass = hasAdminPerms
    ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40'
    : hasOpsPerms
    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40'
    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700';

  return {
    titleAr: customTitle || 'مطلع ومدقق',
    titleEn: 'Viewer',
    badgeClass,
    isMaster: false,
  };
};

// 1. تنظيف الحسابات المكررة تلقائياً وفك قفل الحذف مع تحصين حساب المالك
export const sanitizeUsersList = (users: any[], currentUserId?: string) => {
  // الاحتفاظ بالنسخة الأصلية لـ Master Creator و Projects Manager فقط
  const primaryMasterId = ROOT_USER_ID;
  const primaryPmId = 'usr-pm-mokhtar';

  if (!Array.isArray(users)) return [];

  return users.filter(user => {
    if (!user) return false;
    // إزالة الحسابات المكررة الصريحة
    if (user.id === 'usr-master-mok7tar' || user.id === 'usr-admin-mokhtar') {
      return false;
    }
    // إزالة أي حساب مكرر يحمل نفس بريد المالك بخلاف الحساب الرئيسي
    if (user.email && user.email.toLowerCase() === ROOT_EMAIL.toLowerCase() && user.id !== primaryMasterId) {
      return false;
    }
    return true;
  });
};

// 2. منطق زر الحذف (Trash Icon Handler) - تحصين حساب المالك ومنع الحذف الذاتي
export const handleDeleteUser = (
  userIdToDelete: string,
  currentUserId: string,
  users: any[],
  setUsers: (users: any[]) => void,
  saveToStorage: (data: any) => void
) => {
  const targetUser = (users || []).find(u => u.id === userIdToDelete);

  // تحصين حساب الـ Root المالك المطلق
  if (userIdToDelete === ROOT_USER_ID || targetUser?.email?.toLowerCase() === ROOT_EMAIL.toLowerCase()) {
    alert('إجراء أمني محظور: حساب المالك ومؤسس النظام (Master Creator) محصن تحصيناً مطلقاً ولا يمكن حذفه.');
    return;
  }

  // منع المستخدم من حذف الحساب الذي قام بتسجيل الدخول به حالياً
  if (userIdToDelete === currentUserId) {
    alert('إجراء أمني محظور: لا يمكنك حذف الحساب النشط للجلسة الحالية.');
    return;
  }

  const updatedUsers = users.filter(user => user.id !== userIdToDelete);
  const sanitized = sanitizeUsersList(updatedUsers, currentUserId);
  setUsers(sanitized);
  saveToStorage(sanitized);
};

// 3. منطق إضافة مستخدم جديد للنظام (Add User Handler) مع التحديث الفوري
export const handleCreateNewUser = (
  newUserData: any,
  users: any[],
  setUsers: (users: any[]) => void,
  saveToStorage: (data: any) => void
) => {
  const newUser = {
    id: `usr-${Date.now()}`,
    username: (newUserData.username || '').trim(),
    email: (newUserData.email || '').trim(),
    fullName: (newUserData.fullName || newUserData.name || '').trim(),
    name: (newUserData.fullName || newUserData.name || '').trim(),
    role: newUserData.role || 'editor',
    department: newUserData.department || '',
    jobTitle: newUserData.jobTitle || '',
    phone: newUserData.phone || '',
    isActive: true,
    isMasterAdmin: false,
    canDeleteAdmins: false,
    createdAt: new Date().toISOString(),
    permissions: newUserData.permissions || {},
    systemPermissions: newUserData.systemPermissions || []
  };

  const updatedUsers = [...users, newUser];
  const sanitized = sanitizeUsersList(updatedUsers);
  setUsers(sanitized);
  saveToStorage(sanitized);
  return newUser;
};
