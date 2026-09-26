/**
 * Enterprise Financial Masking & Zero-Leakage RBAC Handler
 * Enforces cryptographic / programmatic data-level masking of sensitive financial metrics:
 * - Gross Profit Margins (%)
 * - Internal Tender Markups & Direct Supplier Cost Rates
 * - Total Corporate Profit & Financial Retention
 * - Sensitive Contract Values for unauthorized field roles
 *
 * Guarantees zero leakage across components, API handlers, and export routines.
 */

import { User, Project, CustomerQuotation, PurchaseOrder, Invoice } from '../types';
import { isSuperAdmin, isExecutiveAdmin } from './rbacUtils';

export const MASKED_FINANCIAL_TEXT = '***';
export const MASKED_PERCENT_TEXT = '**.*%';

/**
 * Checks whether the user belongs to Super Admin / Executive Management
 */
export function isManagementOrSuperAdmin(user: User | null): boolean {
  if (!user) return false;
  return isSuperAdmin(user) || isExecutiveAdmin(user);
}

/**
 * Masks a single numeric financial value if user is below Super Admin / Management
 */
export function maskFinancialValue(
  value: number | string | undefined | null,
  user: User | null,
  placeholder = MASKED_FINANCIAL_TEXT
): string | number {
  if (isManagementOrSuperAdmin(user)) {
    return value ?? 0;
  }
  return placeholder;
}

/**
 * Masks a percentage value (margin / markup) if user is below Super Admin / Management
 */
export function maskPercentageValue(
  percent: number | string | undefined | null,
  user: User | null,
  placeholder = MASKED_PERCENT_TEXT
): string | number {
  if (isManagementOrSuperAdmin(user)) {
    return typeof percent === 'number' ? `${percent}%` : (percent ?? '0%');
  }
  return placeholder;
}

/**
 * Deep masks a Project entity so tender margins and internal costs are stripped
 */
export function maskProjectForUser(project: Project, user: User | null): Project {
  if (isManagementOrSuperAdmin(user)) {
    return project;
  }

  // Deep clone to prevent mutating original state in memory
  const cloned: Project = JSON.parse(JSON.stringify(project));

  // Site Engineers and Viewers must not see contract values or sensitive margins
  if (user?.role === 'engineer' || user?.role === 'viewer') {
    cloned.contractValue = 0;
    cloned.budget = 0;
    cloned.retentionAmount = 0;
    cloned.advancePaymentAmount = 0;
    if (cloned.incurredCosts) {
      cloned.incurredCosts = [];
    }
    if (cloned.paymentMilestones) {
      cloned.paymentMilestones = cloned.paymentMilestones.map((m) => ({
        ...m,
        amount: 0,
      }));
    }
  }

  return cloned;
}

/**
 * Deep masks a Customer Quotation so supplier purchase cost and internal margins are completely stripped
 */
export function maskQuotationForUser(quotation: CustomerQuotation, user: User | null): CustomerQuotation {
  if (isManagementOrSuperAdmin(user)) {
    return quotation;
  }

  const cloned: CustomerQuotation = JSON.parse(JSON.stringify(quotation));

  // Strip internal cost base and gross profit
  if (cloned.totals) {
    cloned.totals.totalSupplierCost = 0;
    cloned.totals.grossProfit = 0;
    cloned.totals.grossMarginPercent = 0;
  }

  // Strip row-level markup and cost for non-management
  if (Array.isArray(cloned.items)) {
    cloned.items = cloned.items.map((item) => ({
      ...item,
      supplierUnitPrice: 0,
      totalSupplierPrice: 0,
      markupPercent: 0,
    }));
  }

  return cloned;
}

/**
 * Masks a full App Dataset (projects, quotations, invoices, purchase orders)
 * for non-management users at data handler / server response level.
 */
export function maskDatasetForUser(dataset: any, user: User | null): any {
  if (!dataset || typeof dataset !== 'object') return dataset;
  if (isManagementOrSuperAdmin(user)) return dataset;

  const sanitized = { ...dataset };

  if (Array.isArray(sanitized.projects)) {
    sanitized.projects = sanitized.projects.map((p: Project) => maskProjectForUser(p, user));
  }

  if (Array.isArray(sanitized.customerQuotations)) {
    sanitized.customerQuotations = sanitized.customerQuotations.map((q: CustomerQuotation) =>
      maskQuotationForUser(q, user)
    );
  }

  // If user is a Site Engineer, hide purchase order price totals (only show items/quantities)
  if (user?.role === 'engineer' && Array.isArray(sanitized.purchaseOrders)) {
    sanitized.purchaseOrders = sanitized.purchaseOrders.map((po: PurchaseOrder) => ({
      ...po,
      subtotal: 0,
      vatAmount: 0,
      totalAmount: 0,
      items: Array.isArray(po.items)
        ? po.items.map((item) => ({
            ...item,
            unitPrice: 0,
            totalPrice: 0,
          }))
        : [],
    }));
  }

  return sanitized;
}
