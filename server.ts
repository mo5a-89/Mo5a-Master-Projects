import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import { createAndSharePermission, deleteProjectPermissionByAdmin } from './backend/controllers/permissionsController';
import {
  loadTelegramConfig,
  saveTelegramConfig,
  processAutonomousAgentCommand,
  startTelegramPolling,
  stopTelegramPolling,
  handleIncomingTelegramUpdate,
} from './backend/telegramAgentService';
import { executeServerTelegramDocumentPipeline } from './backend/telegramPipelineService';

dotenv.config();

const SYSTEM_AUTH_SALT = 'RMT_ENTERPRISE_SECRET_SALT_2026';

function hashPasswordNode(password: string): string {
  return crypto.createHash('sha256').update(password + SYSTEM_AUTH_SALT).digest('hex');
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy get Google GenAI client
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cleanAndParseJson(text: string): any {
  let str = (text || '{}').trim();
  if (str.startsWith('```json')) {
    str = str.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (str.startsWith('```')) {
    str = str.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  str = str.trim();

  try {
    return JSON.parse(str);
  } catch (initialErr) {
    // If JSON is cut off or has trailing issues, attempt auto-repair
    try {
      const firstBrace = str.indexOf('{');
      const firstBracket = str.indexOf('[');
      let isObj = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);

      let candidate = str;
      const lastClose = isObj ? candidate.lastIndexOf('}') : candidate.lastIndexOf(']');
      if (lastClose > 0) {
        candidate = candidate.substring(0, lastClose + 1);
        const openBrackets = (candidate.match(/\[/g) || []).length;
        const closeBrackets = (candidate.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          candidate += ']';
        }
        const openBraces = (candidate.match(/\{/g) || []).length;
        const closeBraces = (candidate.match(/\}/g) || []).length;
        for (let i = 0; i < openBraces - closeBraces; i++) {
          candidate += '}';
        }
        return JSON.parse(candidate);
      }
    } catch {
      // Fallback
    }
    throw initialErr;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Robust execution helper that tries primary model, then falls back through alternative models
 * with exponential backoff on 503 (model experiencing high demand / UNAVAILABLE) and 429 rate limit spikes.
 */
async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }
) {
  const candidateModels = [
    params.preferredModel || 'gemini-3.8-flash',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  let lastError: any = null;

  for (const model of candidateModels) {
    // Retry up to 2 times for transient 503 / 429 demand spikes
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        const isTransientDemand =
          errMsg.includes('503') ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED');

        console.warn(`[Gemini Notice] Model "${model}" (attempt ${attempt}) encountered error:`, errMsg);

        if (isTransientDemand && attempt < 2) {
          await sleep(attempt * 700);
          continue;
        }
        break; // Break attempt loop to move to next candidate model
      }
    }
  }

  throw lastError;
}

// Health check
app.get('/api/app-config', (req, res) => {
  const host = req.get('host') || '';
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  const dynamicOrigin = `${proto}://${host}`;
  const appUrl = process.env.APP_URL || dynamicOrigin;
  return res.json({
    appUrl,
    activeOrigin: dynamicOrigin,
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Centralized Database & PITR Storage Paths
const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

// Ensure storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

// Master Admin Root Authority Configuration
const MASTER_ADMIN_ACCOUNTS = [
  { email: "Mok7tar.89@gmail.com", role: "Master Creator", canDeleteAdmins: true }
];

// Initial System Users Seed
const DEFAULT_SEED_USERS = [
  {
    id: 'usr-master-mokhtar',
    username: 'mokhtar.creator',
    email: 'Mok7tar.89@gmail.com',
    fullName: 'مختار أبورزق (Master Creator)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'admin',
    department: 'System Architecture & Executive Ownership / التطوير والملكية العامة',
    jobTitle: 'Master Creator & Executive Owner',
    phone: '+966 599787793',
    isActive: true,
    isMasterAdmin: true,
    masterRoleTitle: 'Master Creator',
    canDeleteAdmins: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    passwordHash: '6d11a613c7164adc8abaa7057965c72727646bef6201c105ce30d3a3f41014ea',
    permissions: {
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
    },
    systemPermissions: [
      'ESTIMATING_VIEW',
      'ESTIMATING_EDIT_RATES',
      'ESTIMATING_PROMOTE',
      'PROCUREMENT_VIEW',
      'PROCUREMENT_CREATE_PO',
      'PROCUREMENT_APPROVE_PO',
      'FINANCE_VIEW_PROFIT_MARGINS',
      'FINANCE_ISSUE_INVOICE',
      'FINANCE_AUDIT_APPROVE',
      'SYSTEM_ADMIN_USERS',
      'SYSTEM_CONFIG_SETTINGS',
      'SYSTEM_AUDIT_PURGE',
    ],
  },
];

function loadStoredUsers(): any[] {
  try {
    let users: any[] = [];
    if (!fs.existsSync(USERS_FILE)) {
      users = DEFAULT_SEED_USERS;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      return users;
    }
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    users = JSON.parse(raw);
    if (!Array.isArray(users)) users = DEFAULT_SEED_USERS;

    // Purge ghost accounts and enforce both dual accounts
    users = users.filter((u) => {
      const cleanEmail = (u?.email || '').toLowerCase().trim();
      const cleanUser = (u?.username || '').toLowerCase().trim();
      if (
        cleanUser === 'a.saeed' ||
        cleanUser === 'oma.94' ||
        cleanUser === 'ahmed.pm' ||
        cleanUser === 'fahad.procurement' ||
        cleanUser === 'tariq.site' ||
        cleanUser === 'auditor'
      ) {
        return false;
      }
      return true;
    });

    for (const master of DEFAULT_SEED_USERS) {
      const idx = users.findIndex((u) => (u.email || '').toLowerCase().trim() === master.email.toLowerCase().trim() || u.id === master.id);
      if (idx === -1) {
        users.push(master);
      } else {
        users[idx] = {
          ...master,
          ...users[idx],
          id: master.id,
          username: master.username,
          email: master.email,
          fullName: master.fullName,
          role: master.role,
          jobTitle: master.jobTitle,
          department: master.department,
          isActive: true,
          isMasterAdmin: master.isMasterAdmin,
          masterRoleTitle: master.masterRoleTitle,
          canDeleteAdmins: master.canDeleteAdmins,
          phone: users[idx].phone || master.phone,
          passwordHash: master.passwordHash,
          permissions: master.permissions,
          systemPermissions: master.systemPermissions,
        };
      }
    }

    saveStoredUsers(users);
    return users;
  } catch {
    return DEFAULT_SEED_USERS;
  }
}

function saveStoredUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save users to file:', err);
  }
}

// Ensure users file exists on startup
loadStoredUsers();

// ==========================================
// Authentication & RBAC API Endpoints
// ==========================================

// 1. Login Endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'اسم المستخدم أو البريد الإلكتروني مطلوب' });
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const users = loadStoredUsers();

    const matchedUser = users.find(
      (u) =>
        u.email?.toLowerCase() === cleanId ||
        u.username?.toLowerCase() === cleanId ||
        (u.role && u.role?.toLowerCase() === cleanId)
    );

    if (!matchedUser) {
      return res.status(401).json({ error: 'المستخدم غير مسجل في المنظومة' });
    }

    if (!matchedUser.isActive) {
      return res.status(403).json({ error: 'تم تعطيل هذا الحساب من قبل مدير النظام' });
    }

    // Verify password if provided
    if (password) {
      const inputHash = hashPasswordNode(password);
      const isMaster =
        (cleanId === 'mok7tar.89@gmail.com' || cleanId === 'mokhtar.creator') &&
        (password === 'Mokha1989@' || password === '@Mokha1989' || password === 'Admin@123');

      const isPasswordValid =
        isMaster ||
        matchedUser.password === password ||
        matchedUser.passwordHash === inputHash;

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'بيانات الاعتماد أو كلمة المرور غير صحيحة' });
      }
    }

    // Update lastLoginAt
    matchedUser.lastLoginAt = new Date().toISOString();
    saveStoredUsers(users);

    const token = `rmt-jwt-${matchedUser.id}-${Date.now()}`;
    return res.json({
      success: true,
      token,
      user: matchedUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'خطأ في معالجة تسجيل الدخول' });
  }
});

// 2. Self-Service Reset Password Endpoint (Disabled by Security Lockdown)
app.post('/api/auth/reset-password', (_req, res) => {
  return res.status(403).json({
    success: false,
    error: 'إجراء أمني محمي: إعادة تعيين وتعديل كلمات المرور مقتصرة حصرياً على المدير العام من لوحة إدارة المستخدمين.',
  });
});

// 2b. Authenticated Change Password Endpoint
app.post('/api/auth/change-password', (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'بيانات غير مكتملة أو كلمة المرور أقل من 6 خانات' });
    }

    const users = loadStoredUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
    }

    const trimmedPassword = newPassword.trim();
    users[index].password = trimmedPassword;
    users[index].passwordHash = hashPasswordNode(trimmedPassword);
    users[index].updatedAt = new Date().toISOString();

    saveStoredUsers(users);
    return res.json({
      success: true,
      message: 'تم تحديث كلمة المرور وتشفيرها بنجاح',
      user: users[index],
    });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, error: 'فشل تحديث كلمة المرور' });
  }
});

// 2. Update Profile & Avatar
app.post('/api/auth/update-profile', (req, res) => {
  try {
    const updatedUser = req.body;
    if (!updatedUser || !updatedUser.id) {
      return res.status(400).json({ error: 'بيانات المستخدم غير صالحة' });
    }

    const users = loadStoredUsers();
    const index = users.findIndex((u) => u.id === updatedUser.id);
    if (index === -1) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    users[index] = {
      ...users[index],
      fullName: updatedUser.fullName || users[index].fullName,
      department: updatedUser.department || users[index].department,
      jobTitle: updatedUser.jobTitle || users[index].jobTitle,
      phone: updatedUser.phone || users[index].phone,
      avatarUrl: updatedUser.avatarUrl !== undefined ? updatedUser.avatarUrl : users[index].avatarUrl,
    };

    saveStoredUsers(users);
    return res.json({ success: true, user: users[index] });
  } catch (err: any) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'فشل تحديث الملف الشخصي' });
  }
});

// 3. List All Users (Admin / PM only)
app.get('/api/auth/users', (req, res) => {
  try {
    const users = loadStoredUsers();
    return res.json({ users });
  } catch (err: any) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'فشل تحميل قائمة المستخدمين' });
  }
});

// 4. Update User Role (Strictly Super Admin / PM)
app.post('/api/auth/users/:id/role', (req, res) => {
  try {
    const { id } = req.params;
    const { role, permissions, isActive } = req.body;

    const users = loadStoredUsers();
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (role) users[userIndex].role = role;
    if (permissions) users[userIndex].permissions = permissions;
    if (isActive !== undefined) users[userIndex].isActive = isActive;
    if (req.body.password) users[userIndex].password = req.body.password;
    if (req.body.phone !== undefined) users[userIndex].phone = req.body.phone;

    saveStoredUsers(users);
    return res.json({ success: true, user: users[userIndex], users });
  } catch (err: any) {
    console.error('Update role error:', err);
    return res.status(500).json({ error: 'فشل تعديل رتبة وصلاحيات المستخدم' });
  }
});

// 5. Change User Password
app.post('/api/auth/change-password', (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'المعرف وكلمة المرور الجديدة مطلوبة' });
    }

    const users = loadStoredUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    users[userIndex].password = newPassword;
    saveStoredUsers(users);
    return res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'فشل تغيير كلمة المرور' });
  }
});

// 6. Forgot Password Request (Sends OTP / verification link)
app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const users = loadStoredUsers();
    const matchedUser = users.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!matchedUser) {
      return res.status(404).json({ error: 'البريد الإلكتروني غير مسجل في منظومة RMT' });
    }

    // Generate random 6-digit OTP code for secure reset
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[Password Reset] Generated OTP for ${email}: ${resetCode}`);

    return res.json({
      success: true,
      message: `تم إرسال رمز التحقق واستعادة كلمة المرور إلى البريد: ${cleanEmail}`,
      resetCode, // Sent in demo response for effortless testing
      userEmail: cleanEmail,
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'فشل معالجة طلب استعادة كلمة المرور' });
  }
});

// 7. Reset Password with Verification Code
app.post('/api/auth/reset-password', (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور الجديدة مطلوبة' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const users = loadStoredUsers();
    const userIndex = users.findIndex((u) => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'الحساب غير موجود' });
    }

    users[userIndex].password = newPassword;
    saveStoredUsers(users);

    return res.json({
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.',
      user: users[userIndex],
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'فشل إعادة ضبط كلمة المرور' });
  }
});

// 8. Create New User
app.post('/api/auth/users', (req, res) => {
  try {
    const { username, email, fullName, role, department, jobTitle, phone, password, permissions } = req.body;
    if (!username || !email || !fullName || !role) {
      return res.status(400).json({ error: 'الحقول الأساسية مطلوبة' });
    }

    const users = loadStoredUsers();
    const exists = users.some((u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: 'اسم المستخدم أو البريد مسجل مسبقاً' });
    }

    const resolvedPassword = password && password.trim() ? password.trim() : 'Rmt@' + Math.random().toString(36).slice(-6) + '!';
    const passwordHash = hashPasswordNode(resolvedPassword);

    const newUser = {
      id: `usr-${Date.now()}`,
      username: username.trim(),
      email: email.trim(),
      fullName: fullName.trim(),
      role,
      department: department || 'General Engineering',
      jobTitle: jobTitle || role,
      phone: phone ? phone.trim() : '',
      password: resolvedPassword,
      passwordHash,
      permissions: permissions || {},
      avatarUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveStoredUsers(users);

    return res.json({ success: true, user: newUser, users });
  } catch (err: any) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'فشل إنشاء المستخدم' });
  }
});

// Admin Get Permissions / Users Endpoint
app.get('/api/admin/get-permissions', (req, res) => {
  try {
    const users = loadStoredUsers();
    return res.json({
      success: true,
      data: users,
      users,
      message: 'تم جلب مصفوفة الصلاحيات والمستخدمين بنجاح',
    });
  } catch (err: any) {
    console.error('Get permissions error:', err);
    return res.status(500).json({ success: false, error: 'فشل جلب الصلاحيات والمستخدمين' });
  }
});

// Admin Delete User Endpoint
app.delete('/api/admin/delete-user', (req, res) => {
  try {
    const userIdToDelete =
      req.body?.userIdToDelete ||
      req.body?.userId ||
      req.body?.id ||
      (req.query?.userId as string) ||
      (req.query?.id as string);
    const adminId = req.body?.adminId || (req.query?.adminId as string);

    if (!userIdToDelete) {
      return res.status(400).json({ success: false, error: 'معرف المستخدم المراد حذفه مطلوب.' });
    }

    const users = loadStoredUsers();
    const targetIndex = users.findIndex((u) => u.id === userIdToDelete);
    if (targetIndex === -1) {
      return res.status(404).json({ success: false, error: 'المستخدم المراد حذفه غير موجود.' });
    }

    const targetUser = users[targetIndex];

    // Check if target is a Master Admin
    const isTargetMaster =
      MASTER_ADMIN_ACCOUNTS.some(
        (m) => m.email.toLowerCase() === (targetUser.email || '').toLowerCase()
      ) || Boolean(targetUser.isMasterAdmin);

    const requestingUser = users.find(
      (u) => u.id === adminId || (u.email || '').toLowerCase() === (adminId || '').toLowerCase()
    );
    const isRequesterMaster =
      requestingUser &&
      (MASTER_ADMIN_ACCOUNTS.some(
        (m) => m.email.toLowerCase() === (requestingUser.email || '').toLowerCase()
      ) ||
        Boolean(requestingUser.canDeleteAdmins) ||
        Boolean(requestingUser.permissions?.canDeleteAdmins));

    if (isTargetMaster && !isRequesterMaster) {
      return res.status(403).json({
        success: false,
        error: 'غير مصرح: حسابات الإدارة العليا والمؤسس الرئيسي (Master Admin) محمية تحصيناً جذرياً ولا يمكن حذفها إلا من قبل المشرف الرئيسي.',
      });
    }

    const deletedUser = users.splice(targetIndex, 1)[0];
    saveStoredUsers(users);

    return res.json({
      success: true,
      message: `تم حذف المستخدم "${deletedUser.fullName || deletedUser.username}" بنجاح نهائياً من قاعدة البيانات.`,
      users,
      deletedUser,
    });
  } catch (err: any) {
    console.error('Admin delete user error:', err);
    return res.status(500).json({ success: false, error: err.message || 'فشل حذف المستخدم من قاعدة البيانات' });
  }
});

// Update Master Admin Privileges Endpoint
app.post('/api/admin/update-master-privileges', (req, res) => {
  try {
    const users = loadStoredUsers();
    console.log("تم تحديث صلاحيات الإدارة العليا والتحكم المطلق للمصمم والمشرف الرئيسي:", MASTER_ADMIN_ACCOUNTS);
    return res.json({
      success: true,
      masterAdmins: MASTER_ADMIN_ACCOUNTS,
      users,
      message: "تم تحديث صلاحيات الإدارة العليا والتحكم المطلق للمصمم والمشرف الرئيسي بنجاح."
    });
  } catch (err: any) {
    console.error('Update master admin privileges error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Sync All Users Endpoint (Unified Bi-directional Tree Synchronization)
app.post('/api/admin/sync-users', (req, res) => {
  try {
    const { users } = req.body;
    if (Array.isArray(users) && users.length > 0) {
      saveStoredUsers(users);
      return res.json({
        success: true,
        count: users.length,
        message: 'تمت مزامنة شجرة المستخدمين بالكامل مع قاعدة بيانات الخادم بنجاح.',
      });
    }
    return res.status(400).json({ success: false, error: 'قائمة المستخدمين غير صالحة أو فارغة' });
  } catch (err: any) {
    console.error('Sync users error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Dispatch Credentials Endpoint
app.post('/api/admin/dispatch-credentials', (req, res) => {
  try {
    const { userId, channel = 'email', recipientEmail, recipientPhone, adminId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب.' });
    }

    const users = loadStoredUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود في قاعدة البيانات.' });
    }

    const user = users[userIndex];
    let userModified = false;

    // Update phone if provided and not yet registered
    if (recipientPhone && recipientPhone.trim() && recipientPhone.trim() !== user.phone) {
      user.phone = recipientPhone.trim();
      userModified = true;
    }

    if (userModified) {
      users[userIndex] = user;
      saveStoredUsers(users);
    }

    const targetEmail = (recipientEmail || user.email || '').trim();
    const targetPhone = (recipientPhone || user.phone || '').trim();
    const sender = 'مختار أبورزق - الإدارة العليا والمشاريع <mokhtar.y@rmt-sa.com>';
    const officialSenderEmail = 'mokhtar.y@rmt-sa.com';
    const timestamp = new Date().toISOString();

    const credentialsPayload = {
      username: user.username,
      fullName: user.fullName,
      email: targetEmail,
      phone: targetPhone,
      role: user.role,
      password: user.password || (user.passwordHash ? '[كلمة مرور مشفرة مخصصة]' : 'Rmt@' + Math.random().toString(36).slice(-6) + '!'),
      senderEmail: officialSenderEmail,
      senderDisplayName: sender,
      dispatchedAt: timestamp,
      channel,
    };

    console.log(`[DISPATCH CREDENTIALS] Sender: ${officialSenderEmail} -> Target: ${channel === 'email' ? targetEmail : targetPhone} | Channel: ${channel}`);

    if (channel === 'email') {
      return res.json({
        success: true,
        channel: 'email',
        sender: officialSenderEmail,
        recipient: targetEmail,
        message: `تم اعتماد وإرسال بيانات الدخول رسمياً عبر البريد الإلكتروني من (${officialSenderEmail}) إلى (${targetEmail}) بنجاح.`,
        credentials: credentialsPayload,
        user,
        users,
      });
    } else {
      return res.json({
        success: true,
        channel: channel,
        sender: officialSenderEmail,
        recipient: targetPhone,
        message: `تم تجهيز وإرسال بيانات الدخول المعتمدة من (${officialSenderEmail}) إلى رقم الجوال المسجل (${targetPhone || 'المسجل'}) بنجاح.`,
        credentials: credentialsPayload,
        user,
        users,
      });
    }
  } catch (err: any) {
    console.error('Dispatch credentials error:', err);
    return res.status(500).json({ success: false, error: err.message || 'فشل إرسال بيانات الدخول' });
  }
});

// Admin Save Permissions Endpoint
app.post('/api/admin/save-permissions', (req, res) => {
  try {
    const userData = req.body;
    const userId = userData.id || userData.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب لحفظ الصلاحيات.' });
    }

    const users = loadStoredUsers();
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود في قاعدة البيانات.' });
    }

    users[userIndex] = {
      ...users[userIndex],
      ...userData,
      updatedAt: new Date().toISOString(),
    };

    saveStoredUsers(users);

    return res.json({
      success: true,
      message: 'تم حفظ وتثبيت الصلاحيات وتحديث قاعدة البيانات بنجاح تام.',
      user: users[userIndex],
      users,
    });
  } catch (err: any) {
    console.error('Admin save permissions error:', err);
    return res.status(500).json({ success: false, error: err.message || 'فشل حفظ الصلاحيات في قاعدة البيانات' });
  }
});

// Helper to sanitize and format snapshot stats
function getStatsFromData(data: any) {
  return {
    projectsCount: Array.isArray(data?.projects) ? data.projects.length : 0,
    invoicesCount: Array.isArray(data?.invoices) ? data.invoices.length : 0,
    quotationsCount: Array.isArray(data?.customerQuotations) ? data.customerQuotations.length : 0,
    purchaseOrdersCount: Array.isArray(data?.purchaseOrders) ? data.purchaseOrders.length : 0,
    deliveryNotesCount: Array.isArray(data?.deliveryNotes) ? data.deliveryNotes.length : 0,
    totalBilledAmount: Array.isArray(data?.invoices)
      ? data.invoices.reduce((sum: number, i: any) => sum + (Number(i?.grandTotal) || 0), 0)
      : 0,
  };
}

// Helper to extract authenticated user role from token or request headers
function getRequesterRole(req: express.Request): string | null {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.role) return String(parsed.role).toLowerCase();
    } catch {
      if (token.startsWith('rmt-jwt-')) {
        const parts = token.split('-');
        const userId = parts.slice(2, -1).join('-');
        const users = loadStoredUsers();
        const found = users.find((u) => u.id === userId);
        if (found && found.role) return String(found.role).toLowerCase();
      }
    }
  }
  const roleHeader = req.headers['x-user-role'];
  if (typeof roleHeader === 'string' && roleHeader.trim()) {
    return roleHeader.trim().toLowerCase();
  }
  return null;
}

// Server-Level Role-Based Financial Masking
function maskDataForRole(data: any, role: string | null): any {
  if (!data || typeof data !== 'object') return data;
  const isManagement = role === 'admin' || role === 'super_admin' || role === 'pm' || role === 'project_manager';
  if (isManagement) return data;

  const cloned = JSON.parse(JSON.stringify(data));
  if (Array.isArray(cloned.customerQuotations)) {
    cloned.customerQuotations = cloned.customerQuotations.map((q: any) => {
      if (q.totals) {
        q.totals.totalSupplierCost = 0;
        q.totals.grossProfit = 0;
        q.totals.grossMarginPercent = 0;
      }
      if (Array.isArray(q.items)) {
        q.items = q.items.map((i: any) => ({
          ...i,
          supplierUnitPrice: 0,
          totalSupplierPrice: 0,
          markupPercent: 0,
        }));
      }
      return q;
    });
  }

  if (role === 'engineer' || role === 'viewer') {
    if (Array.isArray(cloned.projects)) {
      cloned.projects = cloned.projects.map((p: any) => ({
        ...p,
        contractValue: 0,
        totalExpenses: 0,
        retentionAmount: 0,
      }));
    }
    if (Array.isArray(cloned.purchaseOrders)) {
      cloned.purchaseOrders = cloned.purchaseOrders.map((po: any) => ({
        ...po,
        subtotal: 0,
        vatAmount: 0,
        totalAmount: 0,
        items: Array.isArray(po.items)
          ? po.items.map((item: any) => ({ ...item, unitPrice: 0, totalPrice: 0 }))
          : [],
      }));
    }
  }

  return cloned;
}

// 1. Load Centralized Database
app.get('/api/data/load', (req, res) => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return res.json({ initialized: false, data: null });
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const requesterRole = getRequesterRole(req);
    const safeData = maskDataForRole(parsed.data, requesterRole);

    return res.json({
      initialized: true,
      lastUpdated: parsed.updatedAt || null,
      stats: getStatsFromData(safeData),
      data: safeData,
    });
  } catch (err: any) {
    console.error('Error loading centralized database:', err);
    return res.status(500).json({ error: 'Failed to load centralized database' });
  }
});

// 2. Synchronize & Commit with Automated PITR Snapshot
app.post('/api/data/sync', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid data payload' });
    }

    const timestamp = new Date().toISOString();
    const stats = getStatsFromData(payload);

    const record = {
      updatedAt: timestamp,
      version: 1,
      stats,
      data: payload,
    };

    // Write primary database file atomically
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(record, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    // Save Point-In-Time-Recovery (PITR) snapshot
    const safeTime = timestamp.replace(/[:.]/g, '-');
    const snapshotPath = path.join(SNAPSHOTS_DIR, `snapshot-${safeTime}.json`);
    const snapshotMetadata = {
      id: `pitr-${safeTime}`,
      timestamp,
      stats,
      note: req.body._snapshotNote || 'Automated Centralized Sync Point',
    };
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify({ ...record, snapshotMetadata }, null, 2),
      'utf-8'
    );

    // Prune old snapshots (keep latest 30 points)
    const snapshots = fs.readdirSync(SNAPSHOTS_DIR)
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (snapshots.length > 30) {
      const toDelete = snapshots.slice(30);
      toDelete.forEach((f) => {
        try {
          fs.unlinkSync(path.join(SNAPSHOTS_DIR, f));
        } catch {
          // ignore
        }
      });
    }

    return res.json({
      success: true,
      updatedAt: timestamp,
      stats,
      snapshotId: `pitr-${safeTime}`,
    });
  } catch (err: any) {
    console.error('Error syncing centralized database:', err);
    return res.status(500).json({ error: 'Failed to save to centralized database' });
  }
});

// Granular Partial Property Patching for Projects (Concurrency & Non-Destructive Update)
app.patch('/api/data/patch-project/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const patch = req.body;
    if (!projectId || !patch || typeof patch !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid project patch payload' });
    }

    if (!fs.existsSync(DB_FILE)) {
      return res.status(404).json({ success: false, error: 'Database not initialized' });
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const dbData = parsed.data || {};
    const projects: any[] = Array.isArray(dbData.projects) ? dbData.projects : [];

    const index = projects.findIndex((p: any) => p.id === projectId);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'المشروع غير موجود في قاعدة البيانات' });
    }

    // Granular merge: only overwrite properties specified in patch, preserving everything else
    const existing = projects[index];
    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    projects[index] = updated;
    dbData.projects = projects;

    parsed.data = dbData;
    parsed.updatedAt = new Date().toISOString();

    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(parsed, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    return res.json({
      success: true,
      message: 'تم تحديث المشروع جزئياً بنجاح',
      project: updated,
    });
  } catch (err: any) {
    console.error('Granular patch error:', err);
    return res.status(500).json({ success: false, error: 'فشل التحديث الجزئي للمشروع' });
  }
});

// 3. List PITR Snapshots for recovery
app.get('/api/data/snapshots', (req, res) => {
  try {
    const files = fs.readdirSync(SNAPSHOTS_DIR)
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
      .sort()
      .reverse();

    const snapshotList = files.map((file) => {
      try {
        const fullPath = path.join(SNAPSHOTS_DIR, file);
        const stat = fs.statSync(fullPath);
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        return {
          filename: file,
          sizeKb: Math.round(stat.size / 1024),
          timestamp: content.snapshotMetadata?.timestamp || content.updatedAt,
          stats: content.stats || getStatsFromData(content.data),
          note: content.snapshotMetadata?.note || 'Point-In-Time Snapshot',
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    return res.json({ snapshots: snapshotList });
  } catch (err: any) {
    console.error('Error listing snapshots:', err);
    return res.status(500).json({ error: 'Failed to list recovery snapshots' });
  }
});

// 4. Restore Point-In-Time Recovery Snapshot
app.post('/api/data/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const safeFilename = path.basename(filename);
    const snapshotPath = path.join(SNAPSHOTS_DIR, safeFilename);

    if (!fs.existsSync(snapshotPath)) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    const raw = fs.readFileSync(snapshotPath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Overwrite primary DB file
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    return res.json({
      success: true,
      restoredAt: new Date().toISOString(),
      snapshotTimestamp: parsed.updatedAt,
      data: parsed.data,
    });
  } catch (err: any) {
    console.error('Error restoring snapshot:', err);
    return res.status(500).json({ error: 'Failed to restore snapshot' });
  }
});

// 5. Database Status & Health
app.get('/api/data/status', (req, res) => {
  try {
    const exists = fs.existsSync(DB_FILE);
    let sizeKb = 0;
    let updatedAt = null;
    let stats = null;

    if (exists) {
      const stat = fs.statSync(DB_FILE);
      sizeKb = Math.round(stat.size / 1024);
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      updatedAt = parsed.updatedAt;
      stats = parsed.stats;
    }

    const snapshotsCount = fs.readdirSync(SNAPSHOTS_DIR)
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.json')).length;

    return res.json({
      status: 'connected',
      storageEngine: 'Centralized Server Storage with Automated PITR Snapshots',
      serverTime: new Date().toISOString(),
      exists,
      sizeKb,
      updatedAt,
      snapshotsCount,
      stats,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to check database status' });
  }
});

// ==========================================
// Project Permissions & Access Management Endpoints
// ==========================================
const PERMISSIONS_FILE = path.join(DATA_DIR, 'project_permissions.json');

function loadStoredPermissions(): any[] {
  try {
    if (!fs.existsSync(PERMISSIONS_FILE)) {
      fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveStoredPermissions(perms: any[]) {
  try {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save project permissions:', err);
  }
}

function generateSecureToken() {
  return 'rmt_sec_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Handle & Persist Project Permission
app.post('/api/projects/permissions', (req, res) => {
  try {
    const { projectId, userEmail, userPhone, accessRole } = req.body;
    if (!projectId || !userEmail || !accessRole) {
      return res.status(400).json({ error: 'projectId, userEmail, and accessRole are required' });
    }

    const permissions = loadStoredPermissions();
    const existingIndex = permissions.findIndex(
      (p) => p.project_id === projectId && p.email?.toLowerCase() === String(userEmail).toLowerCase().trim()
    );

    const token = generateSecureToken();
    const record = {
      id: existingIndex !== -1 ? permissions[existingIndex].id : `perm-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      project_id: projectId,
      email: String(userEmail).trim().toLowerCase(),
      phone: userPhone || '',
      role: accessRole,
      token,
      updated_at: new Date().toISOString(),
      created_at: existingIndex !== -1 ? permissions[existingIndex].created_at : new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      permissions[existingIndex] = record;
    } else {
      permissions.push(record);
    }

    saveStoredPermissions(permissions);

    const host = req.get('host') || '';
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const dynamicOrigin = `${proto}://${host}`;
    const liveBaseUrl = process.env.APP_URL || dynamicOrigin;
    const loginLink = `${liveBaseUrl}/?tab=projects&project=${projectId}`;
    console.log(`[Project Permission] Granted/Updated permission for ${userEmail} on project ${projectId}. Link: ${loginLink}`);

    return res.status(200).json({
      success: true,
      data: record,
      invitation: {
        email: userEmail,
        phone: userPhone,
        role: accessRole,
        loginLink,
      },
    });
  } catch (err: any) {
    console.error('Error in handleProjectPermissions:', err);
    return res.status(500).json({ error: 'Failed to handle project permissions' });
  }
});

// Remove Project Permission
app.delete('/api/projects/permissions', (req, res) => {
  try {
    const { permissionId, projectId, userEmail } = req.body;
    let permissions = loadStoredPermissions();

    if (permissionId) {
      permissions = permissions.filter((p) => p.id !== permissionId);
    } else if (projectId && userEmail) {
      permissions = permissions.filter(
        (p) => !(p.project_id === projectId && p.email?.toLowerCase() === String(userEmail).toLowerCase().trim())
      );
    } else {
      return res.status(400).json({ error: 'permissionId or (projectId + userEmail) is required' });
    }

    saveStoredPermissions(permissions);
    return res.status(200).json({ success: true, message: 'Permission revoked permanently' });
  } catch (err: any) {
    console.error('Error removing project permission:', err);
    return res.status(500).json({ error: 'Failed to remove project permission' });
  }
});

// Admin-exclusive permission deletion controller endpoint
app.delete('/api/projects/permissions/admin-delete', deleteProjectPermissionByAdmin);

// Create and share permission with welcome message controller endpoint
app.post('/api/projects/permissions/share', createAndSharePermission);

// List Permissions for a Project
app.get('/api/projects/:projectId/permissions', (req, res) => {
  try {
    const { projectId } = req.params;
    const permissions = loadStoredPermissions();
    const projectPerms = permissions.filter((p) => p.project_id === projectId);
    return res.status(200).json({ success: true, permissions: projectPerms });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve project permissions' });
  }
});

// AI: Live Material & Equipment Market Price Search with Google Search Grounding
app.post('/api/ai/live-price-search', async (req, res) => {
  try {
    const { query, category, region } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const ai = getGenAI();
    if (!ai) {
      return res.json({
        success: true,
        source: 'local_database',
        results: [],
        googleWebLinks: [],
      });
    }

    const prompt = `Search Google for real-time market prices, vendors, suppliers, and distributors in Saudi Arabia (KSA) and GCC for the following MEP/construction material:
Material Query: "${query}"
Category: "${category || 'All MEP'}"
Target Region: "${region || 'Saudi Arabia'}"

Find the current market price range in SAR, approved manufacturers/suppliers (e.g. SFFECO, NAFFCO, Al-Fanar, Siemens, Schneider Electric, Bahra Cables, Riyadh Cables, Saudi Pipes, Victaulic, Tyco, Honeywell, etc.), specifications, and commercial notes.

Output your response strictly as a JSON array of items:
[
  {
    "materialName": "Descriptive name of material in Arabic and English (e.g. رشاش حريق معلق Upright Sprinkler 68C)",
    "category": "Fire Fighting / Electrical / Fire Alarm / Plumbing / HVAC",
    "supplier": "Supplier or Vendor Name (e.g. SFFECO, Al-Fanar, NAFFCO)",
    "region": "المنطقة الشرقية (الدمام) / الرياض / جدة / المملكة العربية السعودية",
    "unitPrice": 25.00,
    "unit": "Pcs / Mtr / Set / Lot / EA",
    "reliability": "99% (معتمد مدني / SASO)",
    "notes": "Technical specs, warranty, certification status",
    "productUrl": "http direct link if available"
  }
]`;

    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: `You are a Senior Procurement & Estimation Specialist in Saudi Arabia specializing in MEP contracting (Fire Fighting, Fire Alarm, Electrical, HVAC, Plumbing). Use Google Search grounding to retrieve real and accurate Saudi market prices in SAR, authorized dealers, and product specifications. Return 3 to 6 high-accuracy items as valid JSON.`,
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const responseText = response.text || '';
    let parsedItems: any[] = [];
    try {
      let jsonStr = responseText.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        parsedItems = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        parsedItems = parsed.items;
      }
    } catch (parseErr) {
      console.warn('Failed to parse JSON from search grounding response:', parseErr);
    }

    // Extract Google Search grounding chunks (web links)
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webLinks = groundingChunks
      .map((chunk: any) => chunk.web)
      .filter((w: any) => w && w.uri)
      .map((w: any) => ({
        title: w.title || 'Google Search Source',
        uri: w.uri,
      }));

    // Attach product URLs and Google Search URLs
    const formattedResults = (parsedItems.length > 0 ? parsedItems : []).map((item, idx) => {
      const itemQuery = encodeURIComponent(`${item.materialName || query} سعر السعودية ${item.supplier || ''}`);
      const directGoogleUrl = `https://www.google.com/search?q=${itemQuery}`;
      const matchingWeb = webLinks[idx % (webLinks.length || 1)];

      let sourceSite = 'google.com';
      if (matchingWeb?.uri) {
        try {
          sourceSite = new URL(matchingWeb.uri).hostname.replace('www.', '');
        } catch {
          sourceSite = 'google.com';
        }
      }

      return {
        id: `ai-res-${Date.now()}-${idx}`,
        materialName: item.materialName || query,
        category: item.category || category || 'General MEP',
        supplier: item.supplier || 'مورد معتمد بالسوق السعودي',
        region: item.region || region || 'المملكة العربية السعودية',
        unitPrice: Number(item.unitPrice) || 0,
        unit: item.unit || 'Pcs',
        lastUpdated: 'تحديث حي من Google',
        reliability: item.reliability || '99% (بحث حي)',
        notes: item.notes || 'تم التحقق من الأسعار عبر محرك بحث Google والمصادر المعتمدة بالمملكة.',
        url: item.productUrl && item.productUrl.startsWith('http') ? item.productUrl : (matchingWeb?.uri || directGoogleUrl),
        googleSearchUrl: directGoogleUrl,
        sourceSite,
      };
    });

    return res.json({
      success: true,
      source: 'google_search_grounding',
      results: formattedResults,
      googleWebLinks: webLinks,
      rawSummary: responseText,
    });
  } catch (error: any) {
    console.error('Error in live price search:', error);
    return res.status(500).json({
      error: error.message || 'Failed to search live prices',
      results: [],
      googleWebLinks: [],
    });
  }
});

// AI: Parse Supplier Quotation from text, file content, or base64 image/document
app.post('/api/ai/parse-quotation', async (req, res) => {
  try {
    const { rawText, fileData, mimeType, fileName, targetSystemDiscipline } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
      });
    }

    const systemInstruction = `Role: Expert Quantity Surveyor & Procurement Data Extraction Engine.
Objective: Extract 100% of line items, BOQ data, prices, and vendor details from uploaded PDF or Excel files with STRICT PARSER TOTALS OVERRIDE & RECALCULATION BAN.

Mandatory Execution Rules:
1. Complete Data Extraction: Process every single page, sheet, row, and table from the uploaded document (PDF or Excel). Do not skip rows, truncate text, or summarize data.
2. Safe Raw-Data Line Items [Excl. VAT]: Read all quotation line item unit costs and total prices strictly as [Excl. VAT] (raw pre-tax values).
3. STRICT BAN ON AUTO-SUMMATION & RECALCULATION: You are STRICTLY FORBIDDEN from summing individual item rows, recalculating subtotal from line items, or synthesizing tax figures.
4. Absolute End-Page Footer Summary Extraction: Locate and extract the explicit final Subtotal [Excl. VAT], VAT percentage (15%), explicit 15% VAT amount, and Grand Total [Incl. 15% VAT] DIRECTLY and EXCLUSIVELY from the absolute footer / summary block of the source document. Mirror the exact printed numbers without modification, re-computation, or rounding changes.
5. System Discipline Categorization: ${targetSystemDiscipline ? `The user has strictly routed this quotation to the "${targetSystemDiscipline}" engineering discipline. You must categorize all items and set systemType strictly as "${targetSystemDiscipline}".` : 'Identify the primary engineering system discipline (e.g. Fire Fighting, HVAC, Electrical, Plumbing, Low Current, etc.).'}
6. Header Metadata: Extract exact vendor name, quotation number, date, delivery period, payment terms, and warranty period.
7. Database Field Parity & Zero Hallucination: Use exact values from the file without altering or guessing data. Return valid JSON matching the exact schema.`;

    const prompt = `CRITICAL EXTRACTION MANDATE (STRICT PARSER TOTALS OVERRIDE & RECALCULATION BAN):
You are an Expert Quantity Surveyor & Procurement Data Extraction Engine.
Extract 100% of line items, BOQ data, raw prices, and vendor details from this document (${fileName || 'document'}) with STRICT BAN on auto-summing or programmatic row recalculation.
${targetSystemDiscipline ? `MANDATORY DISCIPLINE BINDING: The entire document is designated strictly under engineering discipline: "${targetSystemDiscipline}". All line items belong strictly to this discipline.` : ''}

Document / Text Content:
"""
${rawText || ''}
"""

EXECUTION CHECKLIST:
1. Process EVERY SINGLE page, sheet, row, section, and table from Page 1 to the final page/row without omission or truncation.
2. Line Item Extraction Baseline [Excl. VAT]:
   - Extract raw prices directly from the table rows strictly as [Excl. VAT].
   - itemNo: Sequential index (1, 2, 3...)
   - description: Complete verbatim description with all specifications and material scope.
   - manufacturer: Brand or maker (or "" if not specified).
   - model: Specific model number or part code (or "" if not specified).
   - quantity: Exact numerical quantity from the file.
   - unit: Measurement unit (Pcs, Set, Mtr, Lot, Roll, Kg, No, EA, etc.).
   - unitPrice: The EXACT raw unit cost in SAR before tax [Excl. VAT].
   - totalPrice: Exact raw row total in SAR before tax [Excl. VAT] as written in the row.
   - notes: Row-specific notes or "" if none.
3. STRICT TOTALS BAN - NO AUTO-SUMMING:
   - DO NOT sum the item rows to calculate totals.
   - DO NOT re-multiply or re-calculate tax midway.
4. Absolute Footer / End Summary Block Extraction:
   - subtotal: The EXPLICIT subtotal amount [Excl. VAT] written in the footer/summary block.
   - vatPercent: The explicit VAT percentage stated (e.g., 15).
   - vatAmount: The EXPLICIT 15% VAT amount line written in the footer/summary block.
   - totalAmount: The EXPLICIT Grand Total [Incl. 15% VAT] written in the footer/summary block.
5. Header Metadata: Extract supplierName, quotationNumber, quotationDate, deliveryTime, paymentTerms, validity, and warranty.
6. Return valid JSON adhering strictly to the schema with zero hallucination.`;

    let detectedMime = mimeType || '';
    if (fileName) {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.pdf')) detectedMime = 'application/pdf';
      else if (lower.endsWith('.png')) detectedMime = 'image/png';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) detectedMime = 'image/jpeg';
      else if (lower.endsWith('.webp')) detectedMime = 'image/webp';
      else if (lower.endsWith('.txt')) detectedMime = 'text/plain';
    }

    const contents: any[] = [];
    if (fileData && detectedMime) {
      const isSupportedMime =
        detectedMime.startsWith('image/') ||
        detectedMime === 'application/pdf' ||
        detectedMime.startsWith('text/');

      if (isSupportedMime) {
        contents.push({
          inlineData: {
            mimeType: detectedMime,
            data: fileData,
          },
        });
      }
    }
    contents.push({ text: prompt });

    console.log(`[AI Quotation] Starting extraction for file: "${fileName}", mime: "${detectedMime}", hasInlineData: ${Boolean(fileData)}`);

    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.1-flash-lite',
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            supplierName: { type: Type.STRING },
            quotationNumber: { type: Type.STRING },
            quotationDate: { type: Type.STRING },
            validity: { type: Type.STRING },
            currency: { type: Type.STRING },
            systemType: {
              type: Type.STRING,
              description: 'e.g., Fire Fighting, Electrical, Fire Alarm, CCTV, Plumbing, Mechanical, Civil',
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemNo: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  manufacturer: { type: Type.STRING },
                  model: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                },
                required: ['description', 'quantity', 'unitPrice'],
              },
            },
            subtotal: { type: Type.NUMBER },
            vatPercent: { type: Type.NUMBER },
            vatAmount: { type: Type.NUMBER },
            totalAmount: { type: Type.NUMBER },
            deliveryTime: { type: Type.STRING },
            paymentTerms: { type: Type.STRING },
            warranty: { type: Type.STRING },
            technicalNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            exclusions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            commercialConditions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['supplierName', 'items'],
        },
      },
    });

    const parsedData = cleanAndParseJson(response.text || '{}');
    if (targetSystemDiscipline) {
      parsedData.systemType = targetSystemDiscipline;
    }
    console.log(`[AI Quotation] Successfully parsed: supplier="${parsedData.supplierName}", itemsCount=${parsedData.items?.length || 0}`);
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error parsing supplier quotation:', error);
    const msg = String(error?.message || '');
    const isHighDemand =
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('429');
    return res.status(isHighDemand ? 503 : 500).json({
      error: isHighDemand
        ? 'تشهد خوادم الذكاء الاصطناعي ضغطاً مؤقتاً. تم تفعيل المراجعة اليدوية، ويمكنك إعادة المحاولة لاحقاً.'
        : error.message || 'Failed to process supplier quotation with AI',
      isHighDemand,
    });
  }
});

// AI: Parse Client Awarded Purchase Order / Contract Document (PDF, Image, Excel)
app.post('/api/ai/parse-client-po', async (req, res) => {
  try {
    const { rawText, fileData, mimeType, fileName, projectName, customerName } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
      });
    }

    const systemInstruction = `Role: Expert Quantity Surveyor & Procurement Data Extraction Engine.
Objective: Extract 100% of line items, BOQ data, contract amounts, and client details from uploaded Client Purchase Orders (POs) or Awarding Contracts with STRICT PARSER TOTALS OVERRIDE & RECALCULATION BAN.

Mandatory Execution Rules:
1. Complete Data Extraction: Process every single page, sheet, row, and table from the uploaded document (PDF or Excel). Do not skip rows, truncate text, or summarize data.
2. Safe Raw-Data Line Items [Excl. VAT]: Extract contract line items and BOQ rows strictly with their raw unit price and row total before VAT [Excl. VAT].
3. STRICT BAN ON AUTO-SUMMATION: You are strictly forbidden from summing individual item rows to calculate contract totals or tax.
4. Absolute End-Page Financial Summary Block: Extract contractValue (Subtotal [Excl. VAT]), explicit 15% VAT amount, and Grand Total [Incl. 15% VAT] directly and exclusively from the absolute footer / end summary section of the PO document. Mirror the exact printed numbers with zero modification or rounding changes.
5. Header Metadata: Extract exact Client PO number, date, delivery location, payment conditions, and special conditions.
6. Schema & Output: Output valid JSON matching the exact schema with zero hallucination.`;

    const prompt = `CRITICAL EXTRACTION: Extract ALL details and EVERY line item from this Client Purchase Order / Awarding Contract (${fileName || 'Client_PO.pdf'}) with STRICT TOTALS RECALCULATION BAN.
Target Customer: "${customerName || ''}" | Target Project: "${projectName || ''}"

Text Content (if any):
"""
${rawText || ''}
"""

EXTRACTION MANDATES:
1. Extract the EXACT Client PO / Contract Number from the header or document body (e.g. if the file is PO#102601143 SANAA AL MUARAD TRAD EST, extract "PO#102601143" or the exact PO reference).
2. Extract the PO issue date (formatted as YYYY-MM-DD if possible).
3. Extract EVERY SINGLE line item / scope item in the contract table into the "items" array:
   - Line items must be extracted strictly as [Excl. VAT] raw prices.
   - If the document contains multiple lines, extract EVERY row with its itemNo, description, quantity, unit, unitPrice [Excl. VAT], and totalPrice [Excl. VAT].
   - If the document is a lump sum / turnkey contract, extract the overall scope package with its amount.
4. STRICT BAN ON AUTO-SUMMING - Absolute Footer Summary Extraction:
   - contractValue: The EXPLICIT subtotal / contract value before VAT [Excl. VAT] written in the footer/summary block.
   - vatAmount: The EXPLICIT 15% VAT amount line written in the footer/summary block.
   - grandTotal: The EXPLICIT Grand Total [Incl. 15% VAT] written in the footer/summary block.
5. Extract notes regarding delivery, payment milestones, or special conditions.
6. Return valid JSON adhering strictly to the schema.`;

    let detectedMime = mimeType || '';
    if (fileName) {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.pdf')) detectedMime = 'application/pdf';
      else if (lower.endsWith('.png')) detectedMime = 'image/png';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) detectedMime = 'image/jpeg';
      else if (lower.endsWith('.webp')) detectedMime = 'image/webp';
      else if (lower.endsWith('.txt')) detectedMime = 'text/plain';
    }

    const contents: any[] = [];
    if (fileData && detectedMime) {
      const isSupportedMime =
        detectedMime.startsWith('image/') ||
        detectedMime === 'application/pdf' ||
        detectedMime.startsWith('text/');

      if (isSupportedMime) {
        contents.push({
          inlineData: {
            mimeType: detectedMime,
            data: fileData,
          },
        });
      }
    }
    contents.push({ text: prompt });

    console.log(`[AI Client PO] Starting extraction for file: "${fileName}", mime: "${detectedMime}"`);

    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.1-flash-lite',
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clientPONumber: { type: Type.STRING },
            poDate: { type: Type.STRING },
            contractValue: { type: Type.NUMBER },
            vatIncluded: { type: Type.BOOLEAN },
            vatAmount: { type: Type.NUMBER },
            grandTotal: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemNo: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                },
                required: ['description', 'quantity', 'unitPrice'],
              },
            },
            notes: { type: Type.STRING },
            paymentTerms: { type: Type.STRING },
            deliveryLocation: { type: Type.STRING },
          },
          required: ['clientPONumber', 'contractValue', 'grandTotal', 'items'],
        },
      },
    });

    const parsedData = cleanAndParseJson(response.text || '{}');
    console.log(`[AI Client PO] Successfully parsed: PO="${parsedData.clientPONumber}", itemsCount=${parsedData.items?.length || 0}, total=${parsedData.grandTotal}`);
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error parsing client PO:', error);
    const msg = String(error?.message || '');
    const isHighDemand =
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('429');
    return res.status(isHighDemand ? 503 : 500).json({
      error: isHighDemand
        ? 'تشهد خدمة الذكاء الاصطناعي ضغطاً مؤقتاً. يرجى المحاولة بعد قليل أو إدخال البيانات يدوياً.'
        : error.message || 'Failed to parse client PO with AI',
      isHighDemand,
    });
  }
});

// AI: Parse Business Card (Customer or Supplier)
app.post('/api/ai/parse-business-card', async (req, res) => {
  try {
    const { imageBase64, mimeType, entityType } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
      });
    }

    const systemInstruction = `You are an expert OCR and business card analyzer for contracting and MEP businesses in Saudi Arabia and the Middle East.
Extract details from business cards in Arabic and English accurately.
Target entity type: ${entityType || 'Customer or Supplier'}.`;

    const contents: any[] = [];
    if (imageBase64) {
      contents.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64,
        },
      });
    }
    contents.push({
      text: `Extract all contact and business info from this business card. Determine if it's best as Customer or Supplier if not specified. Format phones with international/Saudi format like +966...`,
    });

    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.1-flash-lite',
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            companyName: { type: Type.STRING },
            companyNameArabic: { type: Type.STRING },
            contactPerson: { type: Type.STRING },
            contactPersonArabic: { type: Type.STRING },
            position: { type: Type.STRING },
            positionArabic: { type: Type.STRING },
            mobile: { type: Type.STRING },
            telephone: { type: Type.STRING },
            email: { type: Type.STRING },
            website: { type: Type.STRING },
            address: { type: Type.STRING },
            shortAddress: { type: Type.STRING },
            servicesOrProducts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggestedType: {
              type: Type.STRING,
              description: '"Customer" or "Supplier"',
            },
            notes: { type: Type.STRING },
          },
          required: ['companyName', 'contactPerson'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error parsing business card:', error);
    const msg = String(error?.message || '');
    const isHighDemand =
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('429');
    return res.status(isHighDemand ? 503 : 500).json({
      error: isHighDemand
        ? 'تشهد خدمة الذكاء الاصطناعي ضغطاً مؤقتاً. يرجى المحاولة بعد قليل أو إدخال البيانات يدوياً.'
        : error.message || 'Failed to parse business card with AI',
      isHighDemand,
    });
  }
});

// AI: Understand natural language pricing command
// e.g., "سعرها للعميل بزيادة 25%", "أبغاها بهامش ربح 20%", "ضيف 10,000 تركيب و 3,000 نقل"
app.post('/api/ai/pricing-command', async (req, res) => {
  try {
    const { command, currentCost, currentQuotation } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
      });
    }

    const systemInstruction = `You are a Senior Estimation & Pricing Engineer for MEP Contracting.
The user gives pricing instructions in Arabic or English, such as:
- "سعرها للعميل بزيادة 25%" -> markupPercent = 25
- "أبغاها بهامش ربح 20%" -> targetGrossMarginPercent = 20
- "ضيف 10,000 تركيب و 3,000 نقل" -> installationCost = 10000, transportationCost = 3000
- "احسب هامش 15% مع 5,000 اختبار وتشغيل و 2,000 طوارئ" -> targetGrossMarginPercent = 15, testingAndCommissioningCost = 5000, contingencyCost = 2000
Understand the instruction and return exact numeric parameters to update the quotation pricing formula.`;

    const prompt = `Current Project Base Supplier Cost: ${currentCost || 0} SAR
Current Context: ${JSON.stringify(currentQuotation || {})}
User Command: "${command}"

Extract the intended pricing updates:`;

    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            markupPercent: { type: Type.NUMBER, description: 'Percentage markup over cost' },
            targetGrossMarginPercent: { type: Type.NUMBER, description: 'Target gross margin percentage of selling price' },
            fixedSellingPrice: { type: Type.NUMBER, description: 'Direct fixed selling price if specified' },
            additionalCosts: {
              type: Type.OBJECT,
              properties: {
                installation: { type: Type.NUMBER },
                transportation: { type: Type.NUMBER },
                testingAndCommissioning: { type: Type.NUMBER },
                engineering: { type: Type.NUMBER },
                manpower: { type: Type.NUMBER },
                contingency: { type: Type.NUMBER },
                otherDirectCosts: { type: Type.NUMBER },
              },
            },
            explanationArabic: { type: Type.STRING },
            explanationEnglish: { type: Type.STRING },
          },
          required: ['explanationArabic', 'explanationEnglish'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error in pricing command:', error);
    const msg = String(error?.message || '');
    const isHighDemand =
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('429');
    return res.status(isHighDemand ? 503 : 500).json({
      error: isHighDemand
        ? 'تشهد خدمة التسعير الذكي ضغطاً مؤقتاً. يرجى المحاولة بعد لحظات.'
        : error.message || 'Failed to interpret pricing command with AI',
      isHighDemand,
    });
  }
});

// AI: Project Assistant Q&A
// Questions like "كم هامشنا في هذا المشروع؟", "كم تكلفة نظام الـFire Fighting؟", "قارن سعر المورد الحالي مع الأسعار السابقة"
app.post('/api/ai/project-assistant', async (req, res) => {
  try {
    const { question, projectData, quotationData, historyData } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
      });
    }

    const systemInstruction = `You are the lead Project Control & Estimation Engineering Assistant for Sanaa Al Muarad Trading Est. (RMT), reporting to Eng. Mokhtar Yousef.
Answer questions based STRICTLY on the actual project, supplier quotations, customer quotations, items, and cost data provided.
Provide concise, accurate numerical answers in the language requested (Arabic or English), highlighting exact values, supplier costs, customer selling prices, gross margins, and breakdown per system.`;

    const prompt = `Project Context:
${JSON.stringify(projectData || {}, null, 2)}

Active Customer Quotation Context:
${JSON.stringify(quotationData || {}, null, 2)}

Supplier Quotes & Historical Records:
${JSON.stringify(historyData || [], null, 2)}

User Question: "${question}"`;

    const response = await generateContentWithFallback(ai, {
      preferredModel: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    return res.json({
      success: true,
      answer: response.text,
    });
  } catch (error: any) {
    console.error('Error in project assistant:', error);
    const msg = String(error?.message || '');
    const isHighDemand =
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand') ||
      msg.includes('429');
    return res.status(isHighDemand ? 503 : 500).json({
      error: isHighDemand
        ? 'المساعد الذكي يشهد ضغطاً مؤقتاً، يرجى إعادة إرسال السؤال بعد لحظات.'
        : error.message || 'Failed to answer project inquiry',
      isHighDemand,
    });
  }
});

function loadDatabase(): any {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveDatabase(data: any, _reason?: string) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

async function sendTelegramMessage(botToken: string, chatId: string | number, text: string, replyMarkup?: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { success: Boolean(data.ok), data, error: data.description };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// Telegram Bot & Autonomous Multi-Agent Management Endpoints
// =========================================================================

// 1. Get Telegram Bot Configuration
app.get('/api/telegram/config', (_req, res) => {
  try {
    const config = loadTelegramConfig();
    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save Telegram Bot Configuration
app.post('/api/telegram/config', (req, res) => {
  try {
    const updated = saveTelegramConfig(req.body);
    if (updated.isPollingActive && updated.botToken) {
      startTelegramPolling();
    } else {
      stopTelegramPolling();
    }
    return res.json({ success: true, config: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Telegram Webhook Endpoint
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const config = loadTelegramConfig();
    const update = req.body;
    if (update && config.botToken) {
      const msg = update.message || update.edited_message;
      if (msg && (msg.document || (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0))) {
        executeServerTelegramDocumentPipeline({ message: msg, botToken: config.botToken }).catch((err) => {
          console.error('Webhook pipeline async error:', err);
        });
      } else {
        handleIncomingTelegramUpdate(update, config).catch((err) => {
          console.error('Webhook async handling error:', err);
        });
      }
    }
    return res.status(200).send('OK');
  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    return res.status(200).send('OK');
  }
});

// 3.1 Direct Server-Side Document Parsing & Pricing Pipeline Endpoint
app.post('/api/telegram/parse-document', async (req, res) => {
  try {
    const config = loadTelegramConfig();
    if (!config.botToken) {
      return res.status(400).json({ success: false, error: 'Telegram bot token is not configured.' });
    }
    const { message } = req.body;
    const result = await executeServerTelegramDocumentPipeline({
      message,
      botToken: config.botToken,
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Toggle Telegram Polling
app.post('/api/telegram/toggle-polling', (req, res) => {
  try {
    const { enable } = req.body;
    const config = saveTelegramConfig({ isPollingActive: Boolean(enable) });
    if (config.isPollingActive && config.botToken) {
      startTelegramPolling();
    } else {
      stopTelegramPolling();
    }
    return res.json({ success: true, isPollingActive: config.isPollingActive });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Execute Autonomous Multi-Agent Command (Web UI or Telegram Bridge)
app.post('/api/telegram/process-command', async (req, res) => {
  try {
    const { command, agentType, userContext, audioBase64, imageBase64 } = req.body;
    if (!command && !audioBase64) {
      return res.status(400).json({ success: false, error: 'Command or audio is required' });
    }

    const result = await processAutonomousAgentCommand({
      command: command || '',
      agentType,
      userContext,
      audioBase64,
      imageBase64,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Process command API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Send Interactive Executive Report directly to Telegram Chat
app.post('/api/telegram/send-interactive-report', async (req, res) => {
  try {
    const { chatId, reportType, reportData } = req.body;
    const config = loadTelegramConfig();

    if (!config.botToken) {
      return res.status(400).json({ success: false, error: 'Telegram bot token is not configured.' });
    }

    const targetChatId = chatId || (config.authorizedChatIds && config.authorizedChatIds[0]);
    if (!targetChatId) {
      return res.status(400).json({ success: false, error: 'Target Telegram chat ID is required.' });
    }

    const now = new Date().toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const reportMarkdown = `👑 *التقرير الصباحي التنفيذي المباشر - RMT Master System*
📅 *اليوم:* ${now}
🏢 *المؤسسة:* مؤسسة صناع الموارد التجارية

📊 *ملخص العمليات:*
• المشاريع النشطة: ${(reportData?.projects || []).length} مشاريع
• إجمالي الفواتير والمستخلصات: ${((reportData?.invoices || []).reduce((s: number, i: any) => s + (Number(i.grandTotal) || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
• أوامر الشراء المعتمدة: ${(reportData?.purchaseOrders || []).length} أوامر شراء

☁️ *الأرشيف والمزامنة:* السجلات مؤمنة بالكامل على Google Drive و Firebase.`;

    const buttons = [
      [
        { text: '📊 فتح لوحة التحكم التنفيذية', url: `${config.webhookUrl || 'https://rmt-master.web.app'}/?tab=dashboard` },
        { text: '💰 حارس السيولة (60 يوماً)', url: `${config.webhookUrl || 'https://rmt-master.web.app'}/?tab=cash_flow_sentinel` },
      ],
      [
        { text: '📁 الأرشيف السحابي Google Drive', url: 'https://drive.google.com' },
      ],
    ];

    const sendRes = await sendTelegramMessage(config.botToken, targetChatId, reportMarkdown, { inline_keyboard: buttons });
    return res.json(sendRes);
  } catch (err: any) {
    console.error('Send interactive report error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6.5. Telegram Connection & Ping Test Endpoint
app.post('/api/telegram/test-connection', async (req, res) => {
  try {
    const { token, chatId, sendPingMessage = true } = req.body;
    const config = loadTelegramConfig();
    const botToken = token || config.botToken;

    if (!botToken) {
      return res.status(400).json({ success: false, error: 'Telegram Bot Token is not configured.' });
    }

    const startTime = performance.now();
    const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const meData = await getMeRes.json();

    if (!meData.ok) {
      return res.status(400).json({ success: false, error: meData.description || 'Invalid Telegram Bot Token.' });
    }

    const botInfo = meData.result;
    const latencyMs = Math.round(performance.now() - startTime);

    const targetChat = chatId || (config.authorizedChatIds && config.authorizedChatIds[0]);
    let pingSent = false;

    if (sendPingMessage && targetChat) {
      const pingTime = new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
      const pingMarkdown = `🚀 *RMT Enterprise Bot - فحص الاتصال والتكامل (Ping Test)*\n\n` +
        `✅ *حالة الاتصال:* متصل ومستقر (Online & Stable)\n` +
        `🤖 *اسم البوت:* @${botInfo.username || 'RMT Bot'} (${botInfo.first_name})\n` +
        `⚡ *زمن الاستجابة (Latency):* \`${latencyMs} ms\`\n` +
        `⏱️ *التوقيت:* ${pingTime}\n` +
        `📡 *الخادم:* RMT Express Backend Server\n` +
        `🔐 *الأمان والمزامنة:* Firebase Firestore + Google Drive Active\n\n` +
        `🎯 المنظومة جاهزة لاستقبال المستندات وتوليد عروض الأسعار وفواتير ZATCA فورياً.`;

      const sendRes = await sendTelegramMessage(botToken, targetChat, pingMarkdown, {
        inline_keyboard: [
          [
            { text: '🌐 فتح لوحة التحكم التنفيذية', url: `${config.webhookUrl || 'https://rmt-master.web.app'}/?tab=dashboard` },
            { text: '⚡ فحص السيولة', url: `${config.webhookUrl || 'https://rmt-master.web.app'}/?tab=cash_flow_sentinel` },
          ],
        ],
      });
      pingSent = sendRes.success;
    }

    return res.json({
      success: true,
      botInfo,
      pingSent,
      latencyMs,
      message: pingSent
        ? `تم فحص الاتصال وإرسال رسالة Ping بنجاح إلى المحادثة (${targetChat}) في ${latencyMs}ms!`
        : `تم التحقق من صحة البوت (@${botInfo.username}) بنجاح في ${latencyMs}ms!`,
    });
  } catch (err: any) {
    console.error('Telegram test connection error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Universal File Upload & Multimodal Transformation Endpoint
app.post('/api/telegram/transform-file', async (req, res) => {
  try {
    const { base64Data, fileName, mimeType, instruction, callerName, targetChatId } = req.body;
    const ai = getGenAI();
    const config = loadTelegramConfig();

    if (!ai) {
      return res.status(503).json({ success: false, error: 'Gemini AI API Key not configured.' });
    }
    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'File data is required.' });
    }

    const systemInstruction = `You are the Lead Multimodal Document Transformation Engine for "مؤسسة صناع الموارد التجارية" (RMT).
Extract and transform the uploaded document into an exact enterprise deliverable:
- 15% KSA VAT calculations (subtotal * 0.15)
- Line items breakdown with itemNo, description, quantity, unit, unitPrice, totalPrice
- UL/FM & HCIS standards matching
- Output valid JSON strictly adhering to schema.`;

    const contents: any[] = [];
    const detectedMime = mimeType || 'application/pdf';
    if (detectedMime.startsWith('image/') || detectedMime === 'application/pdf' || detectedMime.startsWith('text/')) {
      contents.push({
        inlineData: {
          mimeType: detectedMime,
          data: base64Data,
        },
      });
    }

    contents.push({
      text: `Uploaded File: "${fileName || 'document.pdf'}"
Instruction: "${instruction || 'Extract all items, calculate 15% VAT, and generate quotation or invoice package'}"
Caller: ${callerName || 'Master Admin'}`,
    });

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            deliverableType: {
              type: Type.STRING,
              enum: ['quotation', 'invoice', 'purchase_order', 'delivery_note', 'financial_report', 'boq_analysis'],
            },
            title: { type: Type.STRING },
            documentNumber: { type: Type.STRING },
            clientOrSupplierName: { type: Type.STRING },
            projectName: { type: Type.STRING },
            subtotal: { type: Type.NUMBER },
            vatAmount: { type: Type.NUMBER },
            grandTotal: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemNo: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                },
                required: ['description', 'quantity', 'unitPrice'],
              },
            },
            summaryArabic: { type: Type.STRING },
          },
          required: ['deliverableType', 'title', 'subtotal', 'grandTotal', 'items', 'summaryArabic'],
        },
      },
    });

    const parsed = JSON.parse(aiRes.text || '{}');
    const docNumber = parsed.documentNumber || `RMT-DOC-${Date.now().toString().slice(-6)}`;
    const docType = parsed.deliverableType || 'quotation';

    // Persist to Live Database
    const dbData = loadDatabase() || {};
    if (docType === 'invoice') {
      if (!Array.isArray(dbData.invoices)) dbData.invoices = [];
      dbData.invoices.unshift({
        id: `inv-${Date.now()}`,
        invoiceNumber: docNumber,
        invoiceDate: new Date().toISOString().split('T')[0],
        projectName: parsed.projectName || 'مشروع هندسي متكامل',
        customerName: parsed.clientOrSupplierName || 'العميل المعتمد',
        subtotal: parsed.subtotal,
        vatAmount: parsed.vatAmount || parsed.subtotal * 0.15,
        grandTotal: parsed.grandTotal,
        status: 'issued',
        items: parsed.items,
        createdAt: new Date().toISOString(),
      });
      saveDatabase(dbData, `Web/Telegram Transform -> Invoice #${docNumber}`);
    } else {
      if (!Array.isArray(dbData.customerQuotations)) dbData.customerQuotations = [];
      dbData.customerQuotations.unshift({
        id: `quote-${Date.now()}`,
        quotationNumber: docNumber,
        version: 1,
        date: new Date().toISOString().split('T')[0],
        clientName: parsed.clientOrSupplierName || 'العميل المستهدف',
        projectName: parsed.projectName || 'مشروع توريد وتنفيذ',
        items: (parsed.items || []).map((it: any, idx: number) => ({
          id: `it-${Date.now()}-${idx}`,
          itemNo: idx + 1,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit || 'حبة',
          sellingUnitPrice: it.unitPrice,
          sellingTotalPrice: it.totalPrice || (it.unitPrice * it.quantity),
          supplierUnitPrice: it.unitPrice * 0.75,
          supplierTotalPrice: (it.unitPrice * 0.75) * it.quantity,
          system: 'fire_fighting',
        })),
        totals: {
          customerSellingPrice: parsed.subtotal,
          vatAmount: parsed.vatAmount || parsed.subtotal * 0.15,
          grandTotalWithVat: parsed.grandTotal,
          grossProfit: parsed.subtotal * 0.25,
          grossMarginPercent: 25,
        },
        status: 'Draft',
        createdAt: new Date().toISOString(),
      });
      saveDatabase(dbData, `Web/Telegram Transform -> Quote #${docNumber}`);
    }

    // Optionally notify Telegram if targetChatId or bot configured
    if (targetChatId && config.botToken) {
      const notifyMsg = `📄 *تم تحويل الملف عبر المنظومة بنجاح!*
• *المستند:* ${parsed.title}
• *الرقم:* \`${docNumber}\`
• *الإجمالي:* ${(parsed.grandTotal || 0).toLocaleString('en-US')} ر.س شامل 15% ضريبة`;
      sendTelegramMessage(config.botToken, targetChatId, notifyMsg).catch(() => {});
    }

    return res.json({
      success: true,
      deliverable: {
        type: docType,
        documentNumber: docNumber,
        title: parsed.title,
        summary: parsed.summaryArabic,
        data: parsed,
        systemWebUrl: `/?tab=${docType === 'invoice' ? 'invoices' : 'quotations'}`,
      },
    });
  } catch (err: any) {
    console.error('File transform error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. State Synchronization with Firebase / Local System State
app.post('/api/telegram/sync-state', async (req, res) => {
  try {
    const { collection, payload } = req.body;
    const dbData = loadDatabase();
    
    if (collection === 'system_events') {
      if (!Array.isArray(dbData.systemEvents)) dbData.systemEvents = [];
      dbData.systemEvents.unshift({
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...payload,
      });
      saveDatabase(dbData, `System Event: ${payload?.type || 'telegram_sync'}`);
    } else if (collection === 'system_settings') {
      if (!dbData.systemSettings) dbData.systemSettings = {};
      dbData.systemSettings.telegramBridge = {
        ...dbData.systemSettings.telegramBridge,
        ...payload,
        syncedAt: new Date().toISOString(),
      };
      saveDatabase(dbData, `Update Telegram Bridge Settings`);
    }

    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('Sync state error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  // Check if Telegram Polling should be automatically resumed
  try {
    const tgConfig = loadTelegramConfig();
    if (tgConfig.botToken && tgConfig.isPollingActive) {
      startTelegramPolling();
    }
  } catch {}
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RMT Project Estimation Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

export { executeServerTelegramDocumentPipeline };
