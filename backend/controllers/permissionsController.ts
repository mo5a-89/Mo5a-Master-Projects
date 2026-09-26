import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PERMISSIONS_FILE = path.join(DATA_DIR, 'project_permissions.json');
const SYSTEM_AUTH_SALT = 'RMT_ENTERPRISE_SECRET_SALT_2026';

function hashPasswordNode(password: string): string {
  return crypto.createHash('sha256').update(password + SYSTEM_AUTH_SALT).digest('hex');
}

function loadUsers(): any[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save users:', err);
  }
}

function loadPermissions(): any[] {
  try {
    if (!fs.existsSync(PERMISSIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function savePermissions(perms: any[]) {
  try {
    fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(perms, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save permissions:', err);
  }
}

async function dispatchNotification(params: { email: string; phone?: string; message: string }) {
  console.log(`[Notification Dispatched] To: ${params.email}, Phone: ${params.phone || 'N/A'}\nMessage:\n${params.message}`);
}

// 1. حذف الصلاحية حصرياً لصلاحيات المشرف (Admin)
export async function deleteProjectPermissionByAdmin(req: Request, res: Response) {
  const { permissionId, adminUserId } = res ? req.body : (req as any);
  
  const users = loadUsers();
  const adminUser = users.find((u) => u.id === adminUserId && (u.role?.toLowerCase() === 'admin' || u.role?.toLowerCase() === 'pm'));

  if (!adminUser) {
    return res.status(403).json({ 
      success: false, 
      error: "غير مسموح. صلاحية الحذف مقتصرة حصرياً على حساب المشرف (Admin)." 
    });
  }

  try {
    let permissions = loadPermissions();
    const exists = permissions.some((p) => p.id === permissionId);
    if (!exists) {
      return res.status(404).json({ success: false, error: "الصلاحية غير موجودة" });
    }
    permissions = permissions.filter((p) => p.id !== permissionId);
    savePermissions(permissions);

    return res.status(200).json({ 
      success: true, 
      message: "تم حذف الصلاحية بنجاح بواسطة المشرف." 
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Server error' });
  }
}

// 2. إنشاء وتفعيل الصلاحية للمستخدم وإرسال بيانات الاعتماد المباشرة
export async function createAndSharePermission(req: Request, res: Response) {
  const { projectId, email, phone, role } = req.body;
  if (!email || !projectId || !role) {
    return res.status(400).json({ success: false, error: 'البريد، معرف المشروع، والرتبة مطلوبة' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const username = cleanEmail.split('@')[0] + "_" + Math.floor(1000 + Math.random() * 9000);
  const tempPassword = 'Rmt@' + Math.random().toString(36).slice(-6) + '!';
  const hashedPassword = hashPasswordNode(tempPassword);

  // 1. حفظ في سجل صلاحيات المشروع
  let permissions = loadPermissions();
  const existingIndex = permissions.findIndex(
    (p) => p.project_id === projectId && p.email?.toLowerCase() === cleanEmail
  );

  const record = {
    id: existingIndex !== -1 ? permissions[existingIndex].id : `perm-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    project_id: projectId,
    email: cleanEmail,
    phone: phone ? String(phone).trim() : '',
    role,
    username,
    password: hashedPassword,
    updated_at: new Date().toISOString(),
    created_at: existingIndex !== -1 ? permissions[existingIndex].created_at : new Date().toISOString(),
  };

  if (existingIndex !== -1) {
    permissions[existingIndex] = record;
  } else {
    permissions.push(record);
  }
  savePermissions(permissions);

  // 2. ضمان تسجيل المستخدم فوراً في قاعدة بيانات مستخدمي النظام users.json لتمكينه من تسجيل الدخول
  const users = loadUsers();
  const userIdx = users.findIndex(
    (u) => u.email?.toLowerCase() === cleanEmail || u.username?.toLowerCase() === username.toLowerCase()
  );

  const defaultPerms = {
    canAccessAdminPanel: role === 'admin',
    canManageUsers: role === 'admin',
    canEditFinancialMargins: role === 'admin',
    canCreateProject: role === 'admin' || role === 'pm',
    canDeleteProject: role === 'admin',
    canManageQuotations: role === 'admin' || role === 'pm',
    canUploadQuotations: true,
    canIssueInvoices: role === 'admin' || role === 'pm',
    canManageProcurement: role === 'admin' || role === 'procurement',
    canApprovePO: role === 'admin',
    canUpdateFieldExecution: true,
    canExportData: true,
  };

  if (userIdx !== -1) {
    users[userIdx].role = role;
    users[userIdx].password = tempPassword;
    users[userIdx].passwordHash = hashedPassword;
    users[userIdx].isActive = true;
    if (phone) users[userIdx].phone = String(phone).trim();
  } else {
    users.push({
      id: `usr-perm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      username,
      email: cleanEmail,
      fullName: cleanEmail.split('@')[0],
      role,
      department: role === 'engineer' ? 'Site Execution / التنفيذ الميداني' : 'Project Management / إدارة المشاريع',
      jobTitle: role === 'engineer' ? 'مهندس موقع' : role === 'pm' ? 'مدير مشاريع' : 'عضو فريق المشروع',
      phone: phone ? String(phone).trim() : '',
      password: tempPassword,
      passwordHash: hashedPassword,
      isActive: true,
      permissions: defaultPerms,
      createdAt: new Date().toISOString(),
    });
  }
  saveUsers(users);

  // 3. بناء الرابط الحي المعتمد للمنظومة (الموجه مباشرة للمشروع)
  const host = req.get('host') || '';
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  const dynamicOrigin = `${proto}://${host}`;
  const liveBaseUrl = process.env.APP_URL || dynamicOrigin;
  const directProjectLink = `${liveBaseUrl}/?tab=projects&project=${projectId}`;

  const roleTitles: Record<string, string> = {
    admin: 'مشرف عام (Admin)',
    pm: 'مدير مشاريع (Project Manager)',
    procurement: 'مسؤول مشتريات (Procurement)',
    engineer: 'مهندس موقع (Site Engineer)',
    viewer: 'مشاهد / مدقق (Viewer)',
  };
  const roleTitle = roleTitles[role] || role;

  const welcomeMessage = `السلام عليكم ورحمة الله وبركاته،
الأخ/الأخت المكرم/ة،

تم اعتماد وتفعيل صلاحيتكم بنجاح في منصة إدارة مشاريع مؤسسة صناع الموارد التجارية (RMT).
▪️ الصلاحية المعتمدة: ${roleTitle}
▪️ اسم المستخدم: ${username}
▪️ كلمة المرور المؤقتة: ${tempPassword}

▪️ رابط الدخول المباشر للمنصة والمشروع:
${directProjectLink}

* يرجى الضغط على الرابط أعلاه لتسجيل الدخول مباشرة والمتابعة.
مؤسسة صناع الموارد التجارية (Resource Makers Trading Est.)`;

  await dispatchNotification({ email: cleanEmail, phone, message: welcomeMessage });

  return res.status(200).json({ 
    success: true, 
    data: record, 
    credentials: { 
      username, 
      tempPassword,
      url: directProjectLink,
      welcomeMessage
    } 
  });
}
