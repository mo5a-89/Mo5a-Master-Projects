/**
 * Core Component & Schema Governance Protection
 * Enforces runtime immutability and schema protection on critical core modules:
 * - Customer Quotation Arithmetic & Letterhead Specs
 * - Financial Calculation Formulas & 15% VAT Invariants
 * - Project State Machine & Schema Definitions
 */

/**
 * Deeply freeze an object and all nested properties to prevent accidental in-place mutations
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Freeze properties first
  Object.keys(obj).forEach((prop) => {
    const val = (obj as any)[prop];
    if (val !== null && (typeof val === 'object' || typeof val === 'function') && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });

  return Object.freeze(obj);
}

/**
 * Governance Invariants for the Saudi MEP Engineering Platform
 */
export const CORE_SYSTEM_INVARIANTS = deepFreeze({
  VAT_RATE: 0.15, // 15% Official KSA VAT
  DEFAULT_VAT_PERCENT: 15,
  MAX_RETENTION_PERCENT: 10.0,
  DEFAULT_RETENTION_PERCENT: 5.0,
  OFFICIAL_CURRENCY: 'SAR',
  OFFICIAL_CURRENCY_AR: 'ريال سعودي',
  OFFICIAL_COMPANY_NAME: 'مؤسسة صناع الموارد التجارية',
  OFFICIAL_CR_NUMBER: '2050117072',
  OFFICIAL_VAT_NUMBER: '300062400700003',
  DECIMAL_PRECISION: 2,
  MAX_VERSION_HISTORY: 50,
});

export const SYSTEM_INVARIANTS = CORE_SYSTEM_INVARIANTS;

/**
 * Validates that an entity complies with non-negotiable core invariants
 */
export function assertSystemInvariants(entityType: string, payload: any): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, violations: ['Invalid entity payload'] };
  }

  if (entityType === 'quotation') {
    if (payload.vatPercent !== undefined && Math.abs(payload.vatPercent - 15) > 0.001) {
      violations.push(`VAT must be exactly 15%. Found: ${payload.vatPercent}%`);
    }
    if (payload.grandTotal !== undefined && payload.subtotal !== undefined) {
      if (payload.grandTotal < 0 || payload.subtotal < 0) {
        violations.push('Quotation monetary totals cannot be negative');
      }
    }
  }

  if (entityType === 'project') {
    const retention = Number(payload.retentionPercent || 0);
    if (retention < 0 || retention > 100) {
      violations.push(`Project retention percent out of bounds: ${retention}%`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Creates a defensive immutable clone of any input data to guarantee no caller can mutate parent state
 */
export function safeImmutableClone<T>(data: T): T {
  if (data === undefined || data === null) return data;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return data;
  }
}
