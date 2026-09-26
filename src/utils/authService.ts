import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../data/seedUsers';
import {
  hashPassword,
  generateSessionToken,
  validateSessionToken,
  purgeSession,
  isSuperAdminAccount,
  checkAndAuthenticateMaster,
  SESSION_TOKEN_STORAGE_KEY,
  SESSION_USER_STORAGE_KEY,
  ROLE_SYSTEM_PERMISSIONS,
} from '../security/AuthSecurity';
import { saveToCloudDatabase } from '../services/cloudDriveSync';

export { INITIAL_USERS };

const AUTH_STORAGE_KEY = 'rmt_auth_user';
const TOKEN_STORAGE_KEY = 'rmt_auth_token';
const ALL_USERS_STORAGE_KEY = 'rmt_users';
const USERS_DATA_STORAGE_KEY = 'rmt_master_users';

export function getStoredUser(): User | null {
  try {
    // Validate session token first
    const validation = validateSessionToken();
    if (!validation.isValid) {
      // Session expired or missing - clear stale data
      purgeSession();
      return null;
    }

    const raw = localStorage.getItem(SESSION_USER_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    let user: User = JSON.parse(raw);

    // Auto-harden super admin / master creator accounts
    if (isSuperAdminAccount(user)) {
      user.role = 'admin';
      user.isMasterAdmin = true;
      user.canDeleteAdmins = true;
      user.masterRoleTitle = user.masterRoleTitle || 'Super Admin & Executive Director';
      user.permissions = {
        canAccessAdminPanel: true,
        canManageUsers: true,
        canEditFinancialMargins: true,
        canCreateProject: true,
        canDeleteProject: true,
        canManageQuotations: true,
        canUploadQuotations: true,
        canIssueInvoices: true,
        canManageProcurement: true,
        canApprovePO: true,
        canUpdateFieldExecution: true,
        canExportData: true,
        canDeleteAdmins: true,
      };
    }

    // Verify user ID matches active session token payload
    if (validation.payload && validation.payload.userId !== user.id) {
      purgeSession();
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const secureToken = sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
      if (secureToken) return secureToken;
    }
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveAuthSession(user: User, token?: string) {
  try {
    const sessionToken = token || generateSessionToken(user);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionToken);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionToken);
      localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_STORAGE_KEY, sessionToken);
    }
  } catch (err) {
    console.warn('Failed to save auth session:', err);
  }
}

export function clearAuthSession() {
  purgeSession();
}

let isUsersFetchInFlight = false;

export function getAllUsers(): User[] {
  try {
    const raw = localStorage.getItem(ALL_USERS_STORAGE_KEY) || localStorage.getItem(USERS_DATA_STORAGE_KEY);
    let users: User[] = raw ? JSON.parse(raw) : INITIAL_USERS;

    if (!Array.isArray(users) || users.length === 0) {
      users = INITIAL_USERS;
    }

    const primaryMasterId = 'usr-master-mokhtar';
    const primaryMasterEmail = 'mok7tar.89@gmail.com';

    // Filter out ghost users and duplicate root accounts
    users = users.filter((u) => {
      if (!u) return false;
      const cleanEmail = (u.email || '').toLowerCase().trim();
      const cleanUsername = (u.username || '').toLowerCase().trim();
      // Explicitly purge legacy ghosts and duplicate root accounts
      if (
        u.id === 'usr-master-mok7tar' ||
        u.id === 'usr-admin-mokhtar' ||
        (cleanEmail === primaryMasterEmail && u.id !== primaryMasterId) ||
        cleanUsername === 'a.saeed' ||
        cleanUsername === 'oma.94' ||
        cleanUsername === 'ahmed.pm' ||
        cleanUsername === 'fahad.procurement' ||
        cleanUsername === 'tariq.site' ||
        cleanUsername === 'auditor' ||
        cleanEmail === 'ahmed.pm@rmt-mep.com' ||
        cleanEmail === 'fahad.procurement@rmt-mep.com' ||
        cleanEmail === 'tariq.site@rmt-mep.com' ||
        cleanEmail === 'auditor@rmt-mep.com'
      ) {
        return false;
      }
      return true;
    });

    // Ensure only the single primary root master user is guaranteed
    const rootMaster = INITIAL_USERS[0];
    const hasRootMaster = users.some(
      (u) => u.id === primaryMasterId || (u.email && u.email.toLowerCase().trim() === primaryMasterEmail)
    );
    if (!hasRootMaster && rootMaster) {
      users.unshift(rootMaster);
    }

    // Always sort so usr-master-mokhtar is first
    users.sort((a, b) => (a.id === primaryMasterId ? -1 : b.id === primaryMasterId ? 1 : 0));

    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(users));
    localStorage.setItem(USERS_DATA_STORAGE_KEY, JSON.stringify(users));
    return users;
  } catch {
    return INITIAL_USERS;
  }
}

export function saveAllUsers(users: User[]) {
  try {
    // Preserve custom credentials and ensure passwords & hashes are retained
    const sanitized = users.map((u) => {
      const copy = { ...u };
      if (!copy.passwordHash && copy.password) {
        // will be hashed on demand
      }
      return copy;
    });
    localStorage.setItem(ALL_USERS_STORAGE_KEY, JSON.stringify(sanitized));
    localStorage.setItem(USERS_DATA_STORAGE_KEY, JSON.stringify(sanitized));

    // 1. Broadcast immediate synchronization across all open views and modals
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rmt_users_updated', { detail: sanitized }));
      window.dispatchEvent(new Event('storage'));
    }

    // 2. Synchronize directly to backend server persistence
    if (typeof fetch !== 'undefined') {
      fetch('/api/admin/sync-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: sanitized }),
      }).catch(() => {});
    }

    // 3. Immediate synchronous cloud broadcast to Google Apps Script production database
    saveToCloudDatabase(undefined, true, { entity: 'users', priority: 'high' }).catch(() => {});
  } catch (err) {
    console.warn('Failed to save all users:', err);
  }
}

/**
 * Cryptographic Enterprise Login with SHA-256 and PBAC Token Generation
 */
export async function apiLogin(
  identifier: string,
  password?: string
): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  if (!identifier || !identifier.trim()) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني المعتمد' };
  }
  if (!password) {
    return { success: false, error: 'يرجى إدخال كلمة المرور' };
  }

  // 1. Instant Root Super Admin Check & Auto-Repair
  const masterAuth = checkAndAuthenticateMaster(identifier, password);
  if (masterAuth.isMaster && masterAuth.user && masterAuth.token) {
    return { success: true, user: masterAuth.user, token: masterAuth.token };
  }

  const cleanId = identifier.trim().toLowerCase();
  const users = getAllUsers();
  const matched = users.find(
    (u) =>
      (u.email || '').toLowerCase().trim() === cleanId ||
      (u.username || '').toLowerCase().trim() === cleanId
  );

  if (!matched) {
    return { success: false, error: 'اسم المستخدم أو البريد الإلكتروني غير مسجل في المنظومة' };
  }

  // Cryptographic hash check using Web Crypto SHA-256
  const inputHash = await hashPassword(password);
  let isPasswordValid = false;

  if (matched && matched.isActive) {
    if (matched.passwordHash) {
      isPasswordValid = matched.passwordHash === inputHash || matched.password === password;
    } else if (matched.password) {
      isPasswordValid = matched.password === password;
      if (isPasswordValid) {
        matched.passwordHash = inputHash;
        saveAllUsers(users);
      }
    }
  }

  // If local authentication succeeded:
  if (matched && matched.isActive && isPasswordValid) {
    const token = generateSessionToken(matched);
    const updatedUser: User = {
      ...matched,
      lastLogin: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    saveAuthSession(updatedUser, token);

    // Update in user list
    const updatedUsers = users.map((u) => (u.id === matched.id ? updatedUser : u));
    saveAllUsers(updatedUsers);

    return { success: true, user: updatedUser, token };
  }

  // 2. Centralized Backend Authentication Fallback
  try {
    const serverRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId, password }),
    });

    if (serverRes.ok) {
      const serverData = await serverRes.json();
      if (serverData.success && serverData.user) {
        const authedUser: User = serverData.user;
        const sessionToken = serverData.token || generateSessionToken(authedUser);

        // Synchronize this user into local device storage
        const currentUsers = getAllUsers();
        const existingIdx = currentUsers.findIndex(
          (u) => u.id === authedUser.id || u.email.toLowerCase() === authedUser.email.toLowerCase()
        );
        let nextUsers = [...currentUsers];
        if (existingIdx !== -1) {
          nextUsers[existingIdx] = authedUser;
        } else {
          nextUsers.push(authedUser);
        }
        saveAllUsers(nextUsers);
        saveAuthSession(authedUser, sessionToken);

        return { success: true, user: authedUser, token: sessionToken };
      }
    } else {
      const errJson = await serverRes.json().catch(() => null);
      if (errJson?.error) {
        return { success: false, error: errJson.error };
      }
    }
  } catch (networkErr) {
    console.warn('Backend login fallback error:', networkErr);
  }

  if (matched && !matched.isActive) {
    return { success: false, error: 'تم تعطيل هذا الحساب من قبل إدارة المنظومة' };
  }

  if (matched && !isPasswordValid) {
    return { success: false, error: 'كلمة المرور غير صحيحة، يرجى التحقق وإعادة المحاولة' };
  }

  return { success: false, error: 'بيانات الاعتماد غير مطابقة، يرجى التأكد من اسم المستخدم أو البريد الإلكتروني' };
}

export async function updateMasterAdminPrivileges() {
  const masterAdmins = [
    { email: 'Mok7tar.89@gmail.com', role: 'Master Creator', canDeleteAdmins: true },
  ];
  return masterAdmins;
}

export async function apiUpdateUserRole(
  userId: string,
  newRole: UserRole,
  targetPermissions?: any,
  password?: string,
  phone?: string,
  jobTitle?: string
): Promise<{ success: boolean; users?: User[] }> {
  const users = getAllUsers();
  const passwordHash = password ? await hashPassword(password) : undefined;
  const updatedList = users.map((u) => {
    if (u.id === userId) {
      const copy: User = {
        ...u,
        role: newRole,
        ...(jobTitle !== undefined ? { jobTitle: jobTitle.trim() } : {}),
        permissions: targetPermissions !== undefined ? targetPermissions : u.permissions,
        systemPermissions: Array.isArray(targetPermissions) ? targetPermissions : u.systemPermissions,
        ...(phone !== undefined ? { phone } : {}),
      };
      if (passwordHash) {
        copy.passwordHash = passwordHash;
      }
      delete copy.password;
      return copy;
    }
    return u;
  });
  saveAllUsers(updatedList);
  return { success: true, users: updatedList };
}

export async function apiUpdateProfile(user: User): Promise<{ success: boolean; user?: User }> {
  const users = getAllUsers();
  const updatedList = users.map((u) => (u.id === user.id ? user : u));
  saveAllUsers(updatedList);
  saveAuthSession(user);
  return { success: true, user };
}

export async function apiCreateUser(
  newUser: Omit<User, 'id' | 'createdAt'> & { passwordPlain?: string }
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const users = getAllUsers();
    const cleanEmail = (newUser.email || '').trim().toLowerCase();
    const cleanUsername = (newUser.username || '').trim().toLowerCase();

    if (!cleanEmail.endsWith('@rmt-sa.com')) {
      return { success: false, error: 'خطأ أمني: التسجيل مقيد حصرياً بالنطاق المؤسسي الرسمي (@rmt-sa.com)' };
    }

    const exists = users.some(
      (u) => u.email.toLowerCase() === cleanEmail || u.username.toLowerCase() === cleanUsername
    );

    if (exists) {
      return { success: false, error: 'اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً' };
    }

    const passwordHash = newUser.passwordPlain
      ? await hashPassword(newUser.passwordPlain)
      : await hashPassword('123456');

    const created: User = {
      ...newUser,
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    delete (created as any).passwordPlain;
    delete created.password;

    const updated = [created, ...users];
    saveAllUsers(updated);
    return { success: true, user: created };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل إنشاء المستخدم' };
  }
}

export async function apiChangePassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; user?: User; message?: string; error?: string }> {
  if (!newPassword || newPassword.trim().length < 6) {
    return { success: false, error: 'يجب ألا تقل كلمة المرور عن 6 خانات' };
  }

  const trimmed = newPassword.trim();
  const passwordHash = await hashPassword(trimmed);
  const users = getAllUsers();
  let updatedUser: User | undefined;

  const updated = users.map((u) => {
    if (u.id === userId) {
      const copy: User = { ...u, password: trimmed, passwordHash };
      updatedUser = copy;
      return copy;
    }
    return u;
  });

  saveAllUsers(updated);

  // Sync to server
  try {
    await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword: trimmed }),
    });
  } catch (err) {
    console.warn('Backend change password sync:', err);
  }

  // If this is the active session user, update their auth session immediately
  const activeUser = getStoredUser();
  if (activeUser && activeUser.id === userId && updatedUser) {
    saveAuthSession(updatedUser);
  }

  return { success: true, user: updatedUser, message: 'تم تحديث كلمة المرور وتشفيرها بنجاح' };
}

export async function apiResetPassword(
  identifier: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  // Security Lockdown: Unauthenticated self-service reset is strictly disabled.
  const activeUser = getStoredUser();
  if (!activeUser || !isSuperAdminAccount(activeUser)) {
    return {
      success: false,
      error: 'إجراء أمني محمي: إعادة تعيين وتعديل كلمات المرور مقتصرة حصرياً على المدير العام (Super Admin) من لوحة إدارة المستخدمين.',
    };
  }

  if (!identifier || !identifier.trim()) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني المسجل' };
  }
  if (!newPassword || newPassword.trim().length < 6) {
    return { success: false, error: 'يجب ألا تقل كلمة المرور عن 6 خانات' };
  }

  const cleanId = identifier.trim().toLowerCase();
  const trimmed = newPassword.trim();
  const passwordHash = await hashPassword(trimmed);
  const users = getAllUsers();
  const matchedIdx = users.findIndex(
    (u) =>
      u.email.toLowerCase() === cleanId ||
      u.username.toLowerCase() === cleanId
  );

  if (matchedIdx !== -1) {
    users[matchedIdx] = {
      ...users[matchedIdx],
      password: trimmed,
      passwordHash,
    };
    saveAllUsers(users);
    return { success: true, message: 'تم تحديث كلمة المرور للمستخدم بنجاح بواسطة المشرف العام.' };
  }

  return { success: false, error: 'المستخدم غير موجود' };
}

export async function apiForgotPasswordRequest(
  email: string
): Promise<{ success: boolean; message?: string; resetCode?: string; error?: string }> {
  return {
    success: false,
    error: 'إجراء أمني: خدمة استعادة كلمة المرور الذاتية معطلة لحماية المنظومة. يرجى مراجعة المشرف العام لتحديث بيانات الاعتماد.',
  };
}

export async function apiResetPasswordWithEmail(
  email: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  return apiResetPassword(email, newPassword);
}
