import React, { useState } from 'react';
import { User, UserRole, ROLE_CONFIGS } from '../types';
import { getAllUsers, saveAllUsers, apiCreateUser } from '../utils/authService';
import {
  sanitizeUsersList,
  handleDeleteUser as deleteUserHandler,
  handleCreateNewUser,
  splitBilingualName,
  getUserRoleBadge,
  isRootAccount,
  ROOT_USER_ID,
  ROOT_EMAIL,
} from '../store/userSlice';
import { isSuperAdmin } from '../utils/rbacUtils';
import {
  SystemPermission,
  PERMISSION_DEFINITIONS,
  ROLE_SYSTEM_PERMISSIONS,
  hashPassword,
  purgeSession,
  SESSION_TOKEN_STORAGE_KEY,
  validateSessionToken,
} from '../security/AuthSecurity';
import {
  Users,
  Trash2,
  Plus,
  Shield,
  Check,
  Lock,
  Mail,
  Phone,
  Key,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Edit2,
  UserCheck,
  UserX,
  Sliders,
} from 'lucide-react';
import { createCheckpoint } from '../utils/snapshotManager';
import { useSettings } from '../context/SettingsContext';

interface UserManagementProps {
  currentUser?: User | null;
  onUsersUpdated?: (users: User[]) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  currentUser,
  onUsersUpdated,
}) => {
  const { t, settings } = useSettings();
  const isEn = settings.language === 'en';
  const [users, setUsers] = useState<User[]>(() => sanitizeUsersList(getAllUsers(), currentUser?.id));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // New user form state
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    jobTitle: '',
    department: 'الهندسة والمشاريع',
    phone: '',
    passwordPlain: '',
    role: 'engineer' as UserRole,
    selectedPermissions: [...ROLE_SYSTEM_PERMISSIONS.engineer],
    isActive: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRoleChangeInForm = (newRole: UserRole) => {
    const defaultPerms = ROLE_SYSTEM_PERMISSIONS[newRole] || ['ESTIMATING_VIEW'];
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      selectedPermissions: [...defaultPerms],
    }));
  };

  const togglePermissionInForm = (perm: SystemPermission) => {
    setFormData((prev) => {
      const exists = prev.selectedPermissions.includes(perm);
      return {
        ...prev,
        selectedPermissions: exists
          ? prev.selectedPermissions.filter((p) => p !== perm)
          : [...prev.selectedPermissions, perm],
      };
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.username.trim() || !formData.email.trim()) {
      showToast('يرجى تعبئة الحقول الأساسية: الاسم، اسم المستخدم، والبريد');
      return;
    }

    const res = await apiCreateUser({
      fullName: formData.fullName,
      name: formData.fullName,
      username: formData.username,
      email: formData.email,
      jobTitle: formData.jobTitle || 'مهندس مشاريع',
      department: formData.department,
      phone: formData.phone || '+966 50 000 0000',
      role: formData.role,
      isActive: formData.isActive,
      systemPermissions: formData.selectedPermissions,
      permissions: formData.selectedPermissions,
      passwordPlain: formData.passwordPlain || '123456',
    });

    if (res.success && res.user) {
      const updated = getAllUsers();
      setUsers(updated);
      createCheckpoint(`إضافة مستخدم جديد: ${res.user.fullName}`, updated);
      if (onUsersUpdated) onUsersUpdated(updated);
      setShowAddModal(false);
      showToast(`تم إنشاء حساب (${res.user.fullName}) وتشفير بيانات الاعتماد بنجاح`);
      // Reset form
      setFormData({
        fullName: '',
        username: '',
        email: '',
        jobTitle: '',
        department: 'الهندسة والمشاريع',
        phone: '',
        passwordPlain: '',
        role: 'engineer',
        selectedPermissions: [...ROLE_SYSTEM_PERMISSIONS.engineer],
        isActive: true,
      });
    } else {
      showToast(res.error || 'فشل إنشاء الحساب');
    }
  };

  const handleToggleUserStatus = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    if (isSuperAdmin(target)) {
      showToast('لا يمكن تعطيل حساب المشرف العام الأعلى');
      return;
    }

    const updated = users.map((u) => {
      if (u.id === userId) {
        return { ...u, isActive: !u.isActive };
      }
      return u;
    });

    setUsers(updated);
    saveAllUsers(updated);
    createCheckpoint(`تغيير حالة مستخدم: ${target.fullName}`, updated);
    if (onUsersUpdated) onUsersUpdated(updated);

    // If disabled user had an active session, invalidate it
    const activeSession = validateSessionToken();
    if (activeSession.payload?.userId === userId && !target.isActive) {
      purgeSession();
    }

    showToast(`تم ${target.isActive ? 'تعطيل' : 'تفعيل'} حساب (${target.fullName})`);
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    if (!confirm(`هل أنت متأكد من رغبتك في حذف حساب (${target.fullName}) نهائياً؟ سيتم إبطال أي جلسات نشطة له.`)) {
      return;
    }

    deleteUserHandler(
      userId,
      currentUser?.id || '',
      users,
      (updatedUsers) => {
        setUsers(updatedUsers);
        createCheckpoint(`حذف مستخدم: ${target.fullName}`, updatedUsers);
        if (onUsersUpdated) {
          onUsersUpdated(updatedUsers);
        }
        showToast(`تم حذف المستخدم (${target.fullName}) بنجاح`);
      },
      saveAllUsers
    );

    // Invalidate session if deleted user was active
    const activeSession = validateSessionToken();
    if (activeSession.payload?.userId === userId) {
      purgeSession();
    }
  };

  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updated = users.map((u) => (u.id === editingUser.id ? editingUser : u));
    setUsers(updated);
    saveAllUsers(updated);
    createCheckpoint(`تحديث صلاحيات مستخدم: ${editingUser.fullName}`, updated);
    if (onUsersUpdated) onUsersUpdated(updated);
    setEditingUser(null);
    showToast(`تم حفظ صلاحيات المستخدم (${editingUser.fullName}) بنجاح`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              {isEn ? 'Users & RBAC Access Matrix' : 'إدارة الصلاحيات والمستخدمين (PBAC Security Matrix)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEn ? 'Access control governance, SHA-256 encryption, margin control, and authorizations' : 'حوكمة صلاحيات الوصول، تشفير كلمات المرور SHA-256، والتحكم بالهوامش والاعتمادات'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{isEn ? 'Add New System User' : 'إضافة مستخدم جديد'}</span>
        </button>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
              <th className="pb-3 px-3">المستخدم</th>
              <th className="pb-3 px-3">الدور / الرتبة</th>
              <th className="pb-3 px-3">الصلاحيات الحساسة المفعلة</th>
              <th className="pb-3 px-3">البريد الإلكتروني</th>
              <th className="pb-3 px-3 text-center">الحالة</th>
              <th className="pb-3 px-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => {
              const roleInfo = getUserRoleBadge(u);
              const isRoot = isRootAccount(u);
              const isSelf = u.id === currentUser?.id;
              const { arabicName, englishSuffix } = splitBilingualName(u.fullName || u.name);

              const userPerms: SystemPermission[] = isRoot
                ? PERMISSION_DEFINITIONS.map((p) => p.key)
                : Array.isArray(u.systemPermissions)
                ? u.systemPermissions
                : Array.isArray(u.permissions)
                ? (u.permissions as any)
                : ROLE_SYSTEM_PERMISSIONS[u.role] || [];

              const hasMarginAccess = userPerms.includes('FINANCE_VIEW_PROFIT_MARGINS') || isRoot;
              const hasPOApprove = userPerms.includes('PROCUREMENT_APPROVE_PO') || isRoot;
              const hasPromote = userPerms.includes('ESTIMATING_PROMOTE') || isRoot;

              return (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span className="truncate max-w-[220px]" dir="rtl">{arabicName}</span>
                      {englishSuffix && (
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] rounded-md font-mono shrink-0 whitespace-nowrap" dir="ltr">
                          ({englishSuffix})
                        </span>
                      )}
                      {isRoot && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-[9px] rounded-md font-mono font-bold shrink-0">
                          Root (*)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.username} • {u.jobTitle || u.department}</div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${roleInfo.badgeClass}`}>
                      {roleInfo.titleAr}
                    </span>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {hasMarginAccess && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-semibold" title="الاطلاع على هوامش الأرباح">
                          هوامش الربح
                        </span>
                      )}
                      {hasPOApprove && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-semibold" title="اعتماد أوامر الشراء الرسمية">
                          اعتماد PO
                        </span>
                      )}
                      {hasPromote && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-semibold" title="ترقية العطاءات إلى مشاريع">
                          ترقية العطاءات
                        </span>
                      )}
                      {!hasMarginAccess && !hasPOApprove && !hasPromote && (
                        <span className="text-[10px] text-slate-400">صلاحيات تشغيلية محددة</span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                    {u.email}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <button
                      type="button"
                      disabled={isRoot}
                      onClick={() => handleToggleUserStatus(u.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                        u.isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 hover:bg-rose-200'
                      }`}
                    >
                      {u.isActive ? 'نشط' : 'معطل'}
                    </button>
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingUser(u)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition cursor-pointer"
                        title="تعديل الصلاحيات والمصفوفة"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {!isRoot && !isSelf && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                          title="حذف المستخدم وإبطال جلسته"
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

      {/* Add New User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  إنشاء حساب مستخدم جديد وتحديد مصفوفة الصلاحيات (PBAC)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: م. سلطان الدوسري"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اسم المستخدم (Username)</label>
                  <input
                    type="text"
                    required
                    placeholder="sultan.mep"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    placeholder="sultan@rmt-mep.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور الأولية</label>
                  <input
                    type="password"
                    placeholder="افتراضياً 123456"
                    value={formData.passwordPlain}
                    onChange={(e) => setFormData({ ...formData, passwordPlain: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    placeholder="مهندس مشاريع أول"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الرتبة / الدور الرئيسي</label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChangeInForm(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-emerald-500 font-bold"
                  >
                    <option value="pm">مدير مشاريع (Project Manager)</option>
                    <option value="estimator">مهندس تسعير ومناقصات (Estimator)</option>
                    <option value="procurement">مسؤول مشتريات وتوريد (Procurement)</option>
                    <option value="engineer">مهندس موقع وتنفيذ (Site Engineer)</option>
                    <option value="accountant">محاسب ومسؤول مالي (Accountant)</option>
                    <option value="viewer">مدقق ومطلع (Auditor / Viewer)</option>
                  </select>
                </div>
              </div>

              {/* PBAC Granular Operational Rights Matrix */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    مصفوفة تفويض الصلاحيات الدقيقة (PBAC Claims Matrix)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    حدد الصلاحيات التشغيلية والحساسة الممنوحة لهذا الحساب
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {PERMISSION_DEFINITIONS.map((perm) => {
                    const isChecked = formData.selectedPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2 p-2.5 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermissionInForm(perm.key)}
                          className="mt-0.5 rounded text-emerald-600 accent-emerald-600"
                        />
                        <div className="text-[11px] leading-tight">
                          <div className="font-bold flex items-center gap-1">
                            <span>{perm.labelAr}</span>
                            {perm.isSensitive && (
                              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                                حساس
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {perm.descriptionAr}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm cursor-pointer"
                >
                  إنشاء الحساب وتشفير المفاتيح
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Matrix Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  تعديل مصفوفة الصلاحيات للمستخدم ({editingUser.fullName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الرتبة والدور</label>
                  <select
                    value={editingUser.role}
                    disabled={isSuperAdmin(editingUser)}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      const defaults = ROLE_SYSTEM_PERMISSIONS[newRole] || [];
                      setEditingUser({
                        ...editingUser,
                        role: newRole,
                        systemPermissions: defaults,
                        permissions: defaults,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-blue-500 font-bold"
                  >
                    <option value="admin">مدير عام / مسؤول أعلى (Admin)</option>
                    <option value="pm">مدير مشاريع (Project Manager)</option>
                    <option value="estimator">مهندس تسعير ومناقصات (Estimator)</option>
                    <option value="procurement">مسؤول مشتريات وتوريد (Procurement)</option>
                    <option value="engineer">مهندس موقع وتنفيذ (Site Engineer)</option>
                    <option value="accountant">محاسب ومسؤول مالي (Accountant)</option>
                    <option value="viewer">مدقق ومطلع (Auditor / Viewer)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الحالة</label>
                  <select
                    value={editingUser.isActive ? 'active' : 'inactive'}
                    disabled={isSuperAdmin(editingUser)}
                    onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.value === 'active' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-blue-500 font-bold"
                  >
                    <option value="active">حساب نشط (Active)</option>
                    <option value="inactive">حساب معطل (Disabled)</option>
                  </select>
                </div>
              </div>

              {/* PBAC Matrix Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="font-extrabold text-slate-900 dark:text-white block">
                  تعديل الصلاحيات المباشرة (PBAC Scoped Permissions):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
                  {PERMISSION_DEFINITIONS.map((perm) => {
                    const currentPerms: SystemPermission[] = isSuperAdmin(editingUser)
                      ? PERMISSION_DEFINITIONS.map((p) => p.key)
                      : Array.isArray(editingUser.systemPermissions)
                      ? editingUser.systemPermissions
                      : Array.isArray(editingUser.permissions)
                      ? (editingUser.permissions as any)
                      : ROLE_SYSTEM_PERMISSIONS[editingUser.role] || [];

                    const isChecked = currentPerms.includes(perm.key);

                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2 p-2.5 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-200'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isSuperAdmin(editingUser)}
                          checked={isChecked}
                          onChange={() => {
                            if (isSuperAdmin(editingUser)) return;
                            const nextPerms = isChecked
                              ? currentPerms.filter((p) => p !== perm.key)
                              : [...currentPerms, perm.key];
                            setEditingUser({
                              ...editingUser,
                              systemPermissions: nextPerms,
                              permissions: nextPerms,
                            });
                          }}
                          className="mt-0.5 rounded text-blue-600 accent-blue-600"
                        />
                        <div className="text-[11px] leading-tight">
                          <div className="font-bold flex items-center gap-1">
                            <span>{perm.labelAr}</span>
                            {perm.isSensitive && (
                              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold">
                                حساس
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {perm.descriptionAr}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
