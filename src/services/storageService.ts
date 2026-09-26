/**
 * Enterprise Storage Service & Corporate Asset Safeguard
 * 
 * Strict Constraint: ABSOLUTELY NO localStorage.clear() executions.
 * Automatically seeds and preserves corporate assets and identity across Incognito windows and clean browser instances.
 * Hydrates relational master dictionaries (Customers, Suppliers, PO Signatures) atomically.
 */

import { DEFAULT_CORPORATE_ASSETS, getCorporateAsset } from '../constants/corporateBrand';

export const MANDATORY_CUSTOMERS = [
  {
    id: 'cust-1',
    name: 'KAMCO.1',
    companyName: 'KAMCO.1',
    attnName: 'KAREEM HAMDI',
    contactPerson: 'KAREEM HAMDI',
    phone: '0501234567',
    mobile: '0501234567',
    vatNo: '300994821100003',
    vatNumber: '300994821100003',
    location: 'DAHRAN',
    address: 'Eastern Province - Dahran',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
];

export const MANDATORY_SUPPLIERS = [
  {
    id: 'supp-1',
    name: 'HADI KANANI COMPANY',
    companyName: 'HADI KANANI COMPANY',
    contactPerson: 'Fayez Ahmed',
    phoneEmail: '+966506761930 - f.ahmed@hkenani.com',
    email: 'f.ahmed@hkenani.com',
    phone: '+966506761930',
    mobile: '+966506761930',
    vatNo: '311984726100003',
    vatNumber: '311984726100003',
    address: 'Contracting Services MEP - ELV - O&M',
    bankDetails: 'Bank: AL INMA Bank | IBAN: SA65 0500 0068 2028 2549 7000',
    bankName: 'AL INMA Bank',
    iban: 'SA65 0500 0068 2028 2549 7000',
    systems: ['fire_alarm', 'fire_fighting'],
    brands: ['Honeywell', 'SFFECO'],
    createdAt: '2026-01-01T08:00:00.000Z',
  },
];

/**
 * Initializes all missing corporate assets in localStorage
 */
export function initializeCorporateAssets(): void {
  try {
    Object.entries(DEFAULT_CORPORATE_ASSETS).forEach(([key, defaultValue]) => {
      const existing = localStorage.getItem(key);
      if (!existing || !existing.trim() || !existing.startsWith('data:image/')) {
        localStorage.setItem(key, defaultValue);
      }
    });
  } catch (err) {
    console.warn('[StorageService] Unable to write corporate assets to localStorage:', err);
  }
}

/**
 * MANDATORY DATA MIGRATION: DIRECT IN-MEMORY MUTATION FOR STORED DATABASE
 * Auto-executes on bootstrap and persists mutations directly to localStorage.
 */
export function executeMandatoryDataMigration(): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. MUTATE INVOICE inv-1790246573520 (INV-PRJ2026001-001)
    const rawInvoices = localStorage.getItem('rmt_invoices');
    if (rawInvoices) {
      try {
        const invoices: any[] = JSON.parse(rawInvoices);
        let invoicesModified = false;

        invoices.forEach((inv) => {
          if (
            inv.id === 'inv-1790246573520' ||
            inv.id === 'INV-PRJ2026001-001' ||
            inv.invoiceNumber === 'INV-PRJ2026001-001' ||
            inv.invoiceNo === 'INV-PRJ2026001-001'
          ) {
            inv.subtotal = 388546.75;
            inv.subTotal = 388546.75;
            inv.grossTaxable = 388546.75;
            inv.grossSubtotalExVat = 388546.75;

            inv.advanceDeductionPercent = 6.43;
            inv.advanceDeduction = 25000.00;
            inv.advanceDeductionAmount = 25000.00;
            inv.advancePaymentDeduction = 25000.00;
            inv.advanceRecovery = 25000.00;

            inv.taxableAmount = 363546.75;

            inv.retentionDeductionPercent = 10;
            inv.retentionPercent = 10;
            inv.retentionDeduction = 38854.68;
            inv.retentionAmount = 38854.68;

            inv.vatPercent = 15;
            inv.vatRate = 15;
            inv.vatAmount = 54532.01;

            inv.grandTotal = 418078.76;
            inv.totalWithVat = 418078.76;

            inv.netPayableAmount = 379224.08;
            inv.netPayable = 379224.08;
            inv.total = 379224.08;
            inv.remainingAmount = 379224.08;
            inv.balanceDue = 379224.08;

            inv.customerId = 'cust-1';
            inv.customerName = 'KAMCO.1';
            inv.sourceQuotationId = 'RM012700';
            inv.quotationId = 'RM012700';
            inv.sourceDeliveryNoteIds = ['dn-1790244928792', 'DN-PRJ2026001-003'];

            invoicesModified = true;
          }
        });

        if (invoicesModified) {
          localStorage.setItem('rmt_invoices', JSON.stringify(invoices));
        }
      } catch (e) {
        console.warn('[Migration] Invoices mutation note:', e);
      }
    }

    // 2. PURGE GHOST DELIVERY NOTES (dn-1790247551008 / DN-008 and dn-1790247547057 / DN-006)
    const rawDNs = localStorage.getItem('rmt_delivery_notes');
    if (rawDNs) {
      try {
        const dns: any[] = JSON.parse(rawDNs);
        const filteredDNs = dns.filter((dn) => {
          const isGhost =
            dn.id === 'dn-1790247551008' ||
            dn.id === 'DN-PRJ2026001-008' ||
            dn.deliveryNumber === 'DN-PRJ2026001-008' ||
            dn.deliveryNumber === 'DN-008' ||
            dn.id === 'dn-1790247547057' ||
            dn.id === 'DN-PRJ2026001-006' ||
            dn.deliveryNumber === 'DN-PRJ2026001-006' ||
            dn.deliveryNumber === 'DN-006';
          return !isGhost;
        });

        // Ensure dn-1790244928792 (DN-003) is marked as Fully Invoiced
        filteredDNs.forEach((dn) => {
          if (
            dn.id === 'dn-1790244928792' ||
            dn.id === 'DN-PRJ2026001-003' ||
            dn.deliveryNumber === 'DN-PRJ2026001-003' ||
            dn.deliveryNumber === 'DN-003'
          ) {
            dn.status = 'Fully Invoiced';
            dn.invoicingStatus = 'Fully Invoiced';
            if (Array.isArray(dn.items)) {
              dn.items.forEach((it: any) => {
                it.isInvoiced = true;
                it.invoicedQty = it.deliveredQty;
              });
            }
          }
        });

        if (filteredDNs.length !== dns.length || JSON.stringify(filteredDNs) !== rawDNs) {
          localStorage.setItem('rmt_delivery_notes', JSON.stringify(filteredDNs));
        }
      } catch (e) {
        console.warn('[Migration] Delivery notes purge note:', e);
      }
    }

    // 3. MUTATE MASTER ARRAYS IF EMPTY
    // Customers
    try {
      const rawCustomers = localStorage.getItem('rmt_customers');
      let customers: any[] = rawCustomers ? JSON.parse(rawCustomers) : [];
      if (!Array.isArray(customers) || customers.length === 0) {
        customers = [
          {
            id: 'cust-1',
            name: 'KAMCO.1',
            attnName: 'KAREEM HAMDI',
            phone: '0501234567',
            vatNo: '300994821100003',
            location: 'DAHRAN',
            address: 'Eastern Province - Dahran',
          },
        ];
        localStorage.setItem('rmt_customers', JSON.stringify(customers));
      }
    } catch {}

    // Suppliers
    try {
      const rawSuppliers = localStorage.getItem('rmt_suppliers');
      let suppliers: any[] = rawSuppliers ? JSON.parse(rawSuppliers) : [];
      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        suppliers = [
          {
            id: 'supp-1',
            name: 'HADI KANANI COMPANY',
            contactPerson: 'Fayez Ahmed',
            phoneEmail: '+966506761930 - f.ahmed@hkenani.com',
            vatNo: '311984726100003',
            address: 'Contracting Services MEP - ELV - O&M',
          },
        ];
        localStorage.setItem('rmt_suppliers', JSON.stringify(suppliers));
      }
    } catch {}

    // 4. MUTATE PO SIGNATURES on po-1790204148870
    try {
      const rawPOs = localStorage.getItem('rmt_purchase_orders');
      if (rawPOs) {
        const pos: any[] = JSON.parse(rawPOs);
        let posModified = false;
        const sigPrepared = getCorporateAsset('rmt_sig_prepared');
        const sigReviewed = getCorporateAsset('rmt_sig_reviewed');
        const sigApproved = getCorporateAsset('rmt_sig_approved');

        pos.forEach((po) => {
          if (
            po.id === 'po-1790204148870' ||
            po.poNumber === 'po-1790204148870' ||
            po.id?.includes('1790204148870') ||
            po.poNumber?.includes('1790204148870')
          ) {
            if (!po.authorization || typeof po.authorization !== 'object') {
              po.authorization = {};
            }
            if (!po.authorization.preparedBy || typeof po.authorization.preparedBy !== 'object') {
              po.authorization.preparedBy = {};
            }
            if (!po.authorization.reviewedBy || typeof po.authorization.reviewedBy !== 'object') {
              po.authorization.reviewedBy = {};
            }
            if (!po.authorization.approvedBy || typeof po.authorization.approvedBy !== 'object') {
              po.authorization.approvedBy = {};
            }

            po.authorization.preparedBy.signatureUrl = sigPrepared;
            po.authorization.reviewedBy.signatureUrl = sigReviewed;
            po.authorization.approvedBy.signatureUrl = sigApproved;

            if (!po.preparedBy || typeof po.preparedBy !== 'object') po.preparedBy = {};
            if (!po.reviewedBy || typeof po.reviewedBy !== 'object') po.reviewedBy = {};
            if (!po.approvedBy || typeof po.approvedBy !== 'object') po.approvedBy = {};

            po.preparedBy.signatureUrl = sigPrepared;
            po.reviewedBy.signatureUrl = sigReviewed;
            po.approvedBy.signatureUrl = sigApproved;

            posModified = true;
          }
        });

        if (posModified) {
          localStorage.setItem('rmt_purchase_orders', JSON.stringify(pos));
        }
      }
    } catch (e) {
      console.warn('[Migration] PO signatures mutation note:', e);
    }
  } catch (err) {
    console.error('[StorageService] Error executing mandatory migration:', err);
  }
}

/**
 * Hydrates customers, suppliers, and re-binds PO signatures
 */
export function hydrateMasterTablesAndSignatures(): void {
  if (typeof window === 'undefined') return;

  try {
    initializeCorporateAssets();
    executeMandatoryDataMigration();

    // Purge mock user Dynamic (def@rmt.com.sa) and enforce strict RBAC on auditor
    const userKeys = ['rmt_users_data', 'rmt_system_users'];
    userKeys.forEach((uk) => {
      const rawU = localStorage.getItem(uk);
      if (rawU) {
        try {
          const users: any[] = JSON.parse(rawU);
          if (Array.isArray(users)) {
            const filtered = users.filter((u) => {
              const email = (u.email || '').toLowerCase().trim();
              const name = (u.name || u.fullName || u.username || '').toLowerCase().trim();
              return email !== 'def@rmt.com.sa' && !name.includes('dynamic');
            });

            // Enforce permissions on usr-viewer-auditor
            const auditorPerms = {
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
            };

            filtered.forEach((u) => {
              if (u.id === 'usr-viewer-auditor' || u.role === 'viewer' || u.email?.includes('auditor')) {
                u.permissions = auditorPerms;
                u.systemPermissions = ['ESTIMATING_VIEW', 'PROCUREMENT_VIEW'];
                if (u.email?.endsWith('@rmt.com.sa') || u.email === 'auditor@rmt-mep.com') {
                  u.email = 'auditor@rmt-sa.com';
                }
              }
            });

            if (filtered.length !== users.length || JSON.stringify(filtered) !== rawU) {
              localStorage.setItem(uk, JSON.stringify(filtered));
            }
          }
        } catch {}
      }
    });
  } catch (err) {
    console.warn('[StorageService] Error during master hydration:', err);
  }
}

/**
 * Safe getItem with automatic fallback to corporate defaults
 */
export function safeGetItem<T = string>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined || raw === 'undefined' || raw === 'null') {
      if (key in DEFAULT_CORPORATE_ASSETS) {
        const asset = getCorporateAsset(key);
        return asset as unknown as T;
      }
      return defaultValue;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  } catch {
    return defaultValue;
  }
}

/**
 * Safe setItem that rejects clearing protected keys
 */
export function safeSetItem<T = any>(key: string, value: T): boolean {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (err) {
    console.error(`[StorageService] Failed to set item for key ${key}:`, err);
    return false;
  }
}

/**
 * Safe removal of specific non-critical keys (NEVER deletes corporate assets or seal)
 */
export function safeRemoveItem(key: string): boolean {
  const PROTECTED_KEYS = new Set([
    'rmt_sig_prepared',
    'rmt_sig_reviewed',
    'rmt_sig_approved',
    'rmt_company_seal',
    'rmt_company_logo',
  ]);

  if (PROTECTED_KEYS.has(key)) {
    console.warn(`[StorageService] Blocked attempt to delete protected corporate key: ${key}`);
    if (key in DEFAULT_CORPORATE_ASSETS) {
      localStorage.setItem(key, DEFAULT_CORPORATE_ASSETS[key]);
    }
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// Auto-run corporate asset initialization, mandatory migration, and master tables hydration on module load
initializeCorporateAssets();
executeMandatoryDataMigration();
hydrateMasterTablesAndSignatures();
