import { User, UserRole, UserPermissions, MASTER_ADMINS } from '../types';
import {
  SystemPermission,
  hasPermission as checkEnterprisePermission,
  isSuperAdminAccount,
  ROLE_SYSTEM_PERMISSIONS,
} from '../security/AuthSecurity';

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
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
  pm: {
    canAccessAdminPanel: true,
    canManageUsers: false,
    canEditFinancialMargins: true,
    canCreateProject: true,
    canDeleteProject: false,
    canManageQuotations: true,
    canUploadQuotations: true,
    canIssueInvoices: true,
    canManageProcurement: true,
    canApprovePO: true,
    canUpdateFieldExecution: true,
    canExportData: true,
  },
  estimator: {
    canAccessAdminPanel: false,
    canManageUsers: false,
    canEditFinancialMargins: true,
    canCreateProject: false,
    canDeleteProject: false,
    canManageQuotations: true,
    canUploadQuotations: true,
    canIssueInvoices: false,
    canManageProcurement: false,
    canApprovePO: false,
    canUpdateFieldExecution: false,
    canExportData: true,
  },
  accountant: {
    canAccessAdminPanel: false,
    canManageUsers: false,
    canEditFinancialMargins: false,
    canCreateProject: false,
    canDeleteProject: false,
    canManageQuotations: false,
    canUploadQuotations: false,
    canIssueInvoices: true,
    canManageProcurement: true,
    canApprovePO: false,
    canUpdateFieldExecution: false,
    canExportData: true,
  },
  procurement: {
    canAccessAdminPanel: false,
    canManageUsers: false,
    canEditFinancialMargins: false,
    canCreateProject: false,
    canDeleteProject: false,
    canManageQuotations: false,
    canUploadQuotations: true,
    canIssueInvoices: false,
    canManageProcurement: true,
    canApprovePO: false,
    canUpdateFieldExecution: false,
    canExportData: true,
  },
  engineer: {
    canAccessAdminPanel: false,
    canManageUsers: false,
    canEditFinancialMargins: false,
    canCreateProject: false,
    canDeleteProject: false,
    canManageQuotations: false,
    canUploadQuotations: false,
    canIssueInvoices: false,
    canManageProcurement: false,
    canApprovePO: false,
    canUpdateFieldExecution: true,
    canExportData: false,
  },
  viewer: {
    canAccessAdminPanel: false,
    canManageUsers: false,
    canEditFinancialMargins: false,
    canCreateProject: false,
    canDeleteProject: false,
    canManageQuotations: false,
    canUploadQuotations: false,
    canIssueInvoices: false,
    canManageProcurement: false,
    canApprovePO: false,
    canUpdateFieldExecution: false,
    canExportData: true,
  },
};

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  return ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.viewer;
}

export function getUserPermissions(user: User | null): UserPermissions {
  if (!user) {
    return ROLE_DEFAULT_PERMISSIONS.viewer;
  }
  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.viewer;
  return {
    ...defaultPerms,
    ...(typeof user.permissions === 'object' && !Array.isArray(user.permissions) ? user.permissions : {}),
  };
}

export function isSuperAdmin(user: User | null): boolean {
  if (!user) return false;
  return isSuperAdminAccount(user);
}

export function isExecutiveAdmin(user: User | null): boolean {
  if (!user) return false;
  return isSuperAdmin(user) || user.role === 'admin' || user.role === 'pm';
}

export function isMasterAdmin(user: User | null | string): boolean {
  if (!user) return false;
  if (typeof user === 'string') {
    const clean = user.toLowerCase().trim();
    return MASTER_ADMINS.some((m) => m.email.toLowerCase() === clean);
  }
  return isSuperAdminAccount(user);
}

export function canDeleteAdmins(user: User | null): boolean {
  if (!user) return false;
  return isSuperAdmin(user);
}

/**
 * Enterprise Scoped PBAC Permission Check
 */
export function hasSystemPermission(user: User | null, permission: SystemPermission): boolean {
  return checkEnterprisePermission(user, permission);
}

export function canViewProfitMargins(user: User | null): boolean {
  if (!user) return false;
  return checkEnterprisePermission(user, 'FINANCE_VIEW_PROFIT_MARGINS');
}

export function canApprovePO(user: User | null): boolean {
  if (!user) return false;
  return checkEnterprisePermission(user, 'PROCUREMENT_APPROVE_PO');
}

export function canPromoteEstimates(user: User | null): boolean {
  if (!user) return false;
  return checkEnterprisePermission(user, 'ESTIMATING_PROMOTE');
}

/**
 * Strict Role-Based Access Isolation for Field Engineers
 * Site Engineers are strictly prohibited from viewing financial figures, tender pricing,
 * profit margins, and procurement costs.
 */
export function isFieldEngineer(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'engineer';
}

export function canViewFinancialData(user: User | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user) || user.role === 'admin' || user.role === 'pm' || user.role === 'accountant') {
    return true;
  }
  // Site Engineers and Viewers have zero access to financial figures, tender pricing, and sensitive margins
  if (user.role === 'engineer' || user.role === 'viewer') {
    return false;
  }
  return Boolean(getUserPermissions(user).canEditFinancialMargins);
}

export function hasPermission(user: User | null, permission: keyof UserPermissions | SystemPermission): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  // Strict engineer block on all financial permissions
  if (user.role === 'engineer' && (
    permission === 'canEditFinancialMargins' ||
    permission === 'canManageQuotations' ||
    permission === 'canIssueInvoices' ||
    permission === 'canManageProcurement' ||
    permission === 'canApprovePO' ||
    permission === 'FINANCE_VIEW_PROFIT_MARGINS' ||
    permission === 'FINANCE_ISSUE_INVOICE' ||
    permission === 'PROCUREMENT_APPROVE_PO' ||
    permission === 'ESTIMATING_PROMOTE' ||
    permission === 'ESTIMATING_EDIT_RATES'
  )) {
    return false;
  }

  // If passed an Enterprise SystemPermission string
  if (typeof permission === 'string' && (permission.startsWith('ESTIMATING_') || permission.startsWith('PROCUREMENT_') || permission.startsWith('FINANCE_') || permission.startsWith('SYSTEM_'))) {
    return checkEnterprisePermission(user, permission as SystemPermission);
  }

  // Legacy UserPermissions check
  if (permission === 'canAccessAdminPanel' || permission === 'canManageUsers' || permission === 'canDeleteAdmins') {
    return isSuperAdmin(user);
  }
  if (user.role === 'pm') {
    return true;
  }
  const perms = getUserPermissions(user);
  return Boolean(perms[permission as keyof UserPermissions]);
}

export function canAccessTab(user: User | null, tab: string): boolean {
  if (!user) return false;

  // Settings, Admin panel and Governance are strictly reserved for Super-Admin
  if (tab === 'settings' || tab === 'admin_roles' || tab === 'system_settings' || tab === 'audit_trail') {
    return isSuperAdmin(user);
  }

  if (isSuperAdmin(user) || user.role === 'pm') return true;

  const perms = getUserPermissions(user);
  const role: UserRole = user.role;

  // Strict Site Engineer Isolation: Only site execution, project tasks/milestones, delivery notes & status breakdown
  if (role === 'engineer') {
    if (
      tab === 'projects' ||
      tab === 'status_breakdown' ||
      tab === 'dashboard' ||
      tab === 'site_logistics' ||
      tab === 'autonomous_agents'
    ) {
      return true;
    }
    return false;
  }

  switch (tab) {
    case 'dashboard':
    case 'status_breakdown':
    case 'autonomous_agents':
      return true; // General view
    case 'cash_flow_sentinel':
      return Boolean(checkEnterprisePermission(user, 'FINANCE_VIEW_PROFIT_MARGINS') || perms.canIssueInvoices || role === 'accountant');
    case 'estimating_workbench':
      return Boolean(checkEnterprisePermission(user, 'ESTIMATING_VIEW') || perms.canManageQuotations || role === 'estimator' || role === 'procurement');
    case 'quotations':
      return Boolean(checkEnterprisePermission(user, 'ESTIMATING_VIEW') || perms.canManageQuotations || perms.canUploadQuotations || role === 'estimator');
    case 'supplier_quotations':
      return Boolean(checkEnterprisePermission(user, 'PROCUREMENT_VIEW') || perms.canManageProcurement || role === 'estimator' || role === 'procurement');
    case 'terms':
      return Boolean(perms.canManageQuotations || perms.canCreateProject || role === 'estimator');
    case 'projects':
      return Boolean(perms.canCreateProject || perms.canUpdateFieldExecution || perms.canDeleteProject);
    case 'procurement_mgmt':
    case 'purchase_orders':
    case 'site_logistics':
      return Boolean(checkEnterprisePermission(user, 'PROCUREMENT_VIEW') || perms.canManageProcurement || perms.canApprovePO || role === 'procurement' || role === 'accountant');
    case 'invoices':
      return Boolean(checkEnterprisePermission(user, 'FINANCE_ISSUE_INVOICE') || perms.canIssueInvoices || role === 'accountant');
    case 'directory':
    case 'suppliers':
    case 'customers':
    case 'crm_clients':
      return Boolean(perms.canManageProcurement || perms.canManageQuotations || perms.canIssueInvoices || role === 'accountant' || role === 'procurement');
    default:
      return true;
  }
}

export function canAccessPillar(user: User | null, pillarNum: 1 | 2 | 3 | 4 | 5 | 6): boolean {
  if (!user) return false;

  // Pillar 6 (الحوكمة وإعدادات المنظومة والسيادة السحابية) is strictly for Super-Admin
  if (pillarNum === 6) {
    return isSuperAdmin(user);
  }

  if (isSuperAdmin(user) || user.role === 'pm') return true;

  switch (pillarNum) {
    case 1:
      return canAccessTab(user, 'dashboard') || canAccessTab(user, 'cash_flow_sentinel') || canAccessTab(user, 'status_breakdown');
    case 2:
      return canAccessTab(user, 'estimating_workbench') || canAccessTab(user, 'quotations') || canAccessTab(user, 'supplier_quotations') || canAccessTab(user, 'terms');
    case 3:
      return canAccessTab(user, 'projects');
    case 4:
      return canAccessTab(user, 'procurement_mgmt') || canAccessTab(user, 'purchase_orders') || canAccessTab(user, 'site_logistics') || canAccessTab(user, 'suppliers') || canAccessTab(user, 'directory');
    case 5:
      return canAccessTab(user, 'invoices') || canAccessTab(user, 'directory');
    default:
      return true;
  }
}

export function getDefaultLandingTabForRole(role?: UserRole): string {
  switch (role) {
    case 'admin':
      return 'dashboard';
    case 'pm':
      return 'projects';
    case 'engineer':
      return 'projects';
    case 'accountant':
      return 'invoices';
    case 'procurement':
      return 'procurement_mgmt';
    case 'estimator':
      return 'estimating_workbench';
    case 'viewer':
    default:
      return 'dashboard';
  }
}

/**
 * Hard-capped approval limit for Project Managers (SAR 20,000)
 */
export const MAX_PM_PO_APPROVAL_LIMIT = 20000;

/**
 * Checks if current user is Executive Master Admin (Owner)
 */
export function isExecutiveMasterAdmin(user: User | null): boolean {
  if (!user) return false;
  return (
    user.id === 'usr-master-mokhtar' ||
    user.isMasterAdmin === true ||
    user.canDeleteAdmins === true ||
    user.email?.toLowerCase() === 'mok7tar.89@gmail.com'
  );
}

/**
 * Checks if current user is Project Manager / Engineering Admin
 */
export function isProjectManagerAdmin(user: User | null): boolean {
  if (!user) return false;
  if (isExecutiveMasterAdmin(user)) return false;
  return (
    user.id === 'usr-pm-mokhtar' ||
    user.role === 'pm' ||
    user.jobTitle?.includes('Projects Manager') ||
    user.jobTitle?.includes('مدير المشاريع')
  );
}

/**
 * Checks if current user can view confidential financial margins, markups & bank balances
 */
export function canViewFinancialMargins(user: User | null): boolean {
  return isExecutiveMasterAdmin(user);
}

/**
 * Masks financial values (costs, margins, unit buy rates) for non-executive users
 */
export function maskFinancialValue(
  val: number | string | undefined | null,
  user: User | null,
  fallbackText = '*** ر.س'
): string {
  if (canViewFinancialMargins(user)) {
    if (typeof val === 'number') {
      return val.toLocaleString() + ' ر.س';
    }
    return String(val ?? '');
  }
  return fallbackText;
}

/**
 * Evaluates Purchase Order Approval Authority & Thresholds
 */
export function evaluatePoApprovalAuthority(
  user: User | null,
  poGrandTotal: number
): {
  canApprove: boolean;
  requiresExecutiveApproval: boolean;
  statusOnSave: 'Issued' | 'Approved' | 'Draft' | 'Pending_Executive_Approval';
  reason?: string;
} {
  if (!user) {
    return {
      canApprove: false,
      requiresExecutiveApproval: true,
      statusOnSave: 'Draft',
      reason: 'يجب تسجيل الدخول لإجراء عمليات الاعتماد.',
    };
  }

  // 1. Executive Master Admin -> Unlimited Authority
  if (isExecutiveMasterAdmin(user)) {
    return {
      canApprove: true,
      requiresExecutiveApproval: false,
      statusOnSave: 'Approved',
      reason: 'اعتماد المالك العام (صلاحية مالية غير محدودة).',
    };
  }

  // 2. Project Manager -> Capped at SAR 20,000
  if (isProjectManagerAdmin(user) || user.role === 'pm' || hasPermission(user, 'canApprovePO')) {
    if (poGrandTotal <= MAX_PM_PO_APPROVAL_LIMIT) {
      return {
        canApprove: true,
        requiresExecutiveApproval: false,
        statusOnSave: 'Approved',
        reason: `اعتماد مدير المشاريع (ضمن سقف الصلاحية المحدد: ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س).`,
      };
    } else {
      return {
        canApprove: false,
        requiresExecutiveApproval: true,
        statusOnSave: 'Draft',
        reason: `قيمة أمر الشراء (${poGrandTotal.toLocaleString()} ر.س) تتجاوز سقف اعتماد مدير المشاريع (${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س). يتطلب الأمر تصعيد واعتماد المالك العام.`,
      };
    }
  }

  // 3. Field / Standard User -> No Approval Authority
  return {
    canApprove: false,
    requiresExecutiveApproval: true,
    statusOnSave: 'Draft',
    reason: 'لا تتوفر صلاحية اعتماد أوامر الشراء لحسابك الحالي.',
  };
}

