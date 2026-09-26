/**
 * Master Enterprise Store (SSOT)
 * Centralized Reactive Global Store & Single Source of Truth for RMT ERP Ecosystem.
 *
 * Governs:
 * - Corporate Official Identity & Banking Info
 * - Financial Policies, Target Margins & VAT Regulations (ZATCA Compliant)
 * - Auto-Numbering Engine & Dynamic Prefix Sequencing
 * - Dynamic Navigation & Pillar Customization
 * - Visual Identity, Theming & Typography
 * - RBAC & User Access Matrix
 *
 * Zero-Lag Synchronization: Dispatches system-wide broadcast events on every commit.
 */

import { User } from '../types';
import { COMPANY_PROFILE } from '../data/initialData';
import { getNavigationLabels, NavigationLabels } from '../utils/navigationConfig';
import { getAllUsers, INITIAL_USERS } from '../utils/authService';
import { sanitizeUsersList } from './userSlice';
import React, { useState, useEffect, useSyncExternalStore } from 'react';

export interface CompanyIdentitySchema {
  officialArabicName: string;
  officialEnglishName: string;
  crNumber: string;
  vatNumber: string;
  bankName: string;
  iban: string;
  autoSealAndSignature: boolean;
  autoSignatures?: boolean;
  logoUrl: string;
  bankSwift?: string;
  poBox?: string;
  addressEn?: string;
  addressAr?: string;
  phone?: string;
  mobiles?: string[];
  email?: string;
  website?: string;
  engineerName?: string;
  engineerTitle?: string;
  engineerEmail?: string;
  financeDirector?: string;
  financeDirectorAr?: string;
  financeDirectorTitle?: string;
}

export interface FinancialPoliciesSchema {
  defaultVatRate: number; // 15
  overheadPercentage: number; // 10
  profitMarginPercentage: number; // 15
  retentionRate: number; // 5
  defaultAdvance?: number;
  decimalPrecision?: number;
  currencyDisplay?: string;
}

export interface AutoNumberingSchema {
  projectPrefix: string; // PRJ-
  quotationPrefix: string; // CQ-
  invoicePrefix: string; // INV-
  purchaseOrderPrefix: string; // PO-
  deliveryNotePrefix: string; // DN-
  sequenceDigits: number; // 4
  seqQuote?: number;
  seqPO?: number;
  seqInvoice?: number;
  seqDN?: number;
  seqProject?: number;
}

export interface NavigationPillarsSchema {
  p1_label: string; // Default: "الرقابة التنفيذية والسيولة"
  p2_label: string; // Default: "عروض الأسعار والتسعير"
  p3_label: string; // Default: "المشاريع والعمليات"
  p4_label: string; // Default: "المشتريات والتوريد"
  p5_label: string; // Default: "المالية والفواتير"
  p6_label: string; // Default: "الحوكمة والسيادة السحابية"
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  entityType?: string;
  entityId?: string;
  details?: string;
}

export const DEFAULT_NAVIGATION_PILLARS: NavigationPillarsSchema = {
  p1_label: "الرقابة التنفيذية والسيولة",
  p2_label: "عروض الأسعار والتسعير",
  p3_label: "المشاريع والعمليات",
  p4_label: "المشتريات والتوريد",
  p5_label: "المالية والفواتير",
  p6_label: "الحوكمة والسيادة السحابية",
};

export interface MenuCustomizationSchema {
  projectsLabel: string; // "المشاريع والعمليات"
  quotationsLabel: string; // "عروض الأسعار والتسعير"
  procurementLabel: string; // "المشتريات والتوريد"
  financeLabel: string; // "المالية والفواتير"
  siteExecutionLabel: string; // "التنفيذ والمتابعة الميدانية"
  labels?: NavigationLabels;
}

export interface CorporateIdentity extends CompanyIdentitySchema {
  nameAr: string;
  nameEn: string;
  tradeNameEn: string;
  bankIban: string;
  bankAccountName: string;
}

export interface FinancialPolicies extends FinancialPoliciesSchema {
  defaultMarkup: number;
  defaultGrossMargin: number;
  defaultRetention: number;
  defaultAdvance: number;
  defaultVat: number;
  decimalPrecision: number;
  currencyDisplay: string;
}

export interface NumberingEngine extends AutoNumberingSchema {
  prefixQuote: string;
  prefixPO: string;
  prefixInvoice: string;
  prefixDN: string;
  prefixProject: string;
  seqQuote: number;
  seqPO: number;
  seqInvoice: number;
  seqDN: number;
  seqProject: number;
}

export interface MasterEnterpriseState {
  companyIdentity: CompanyIdentitySchema;
  financialPolicies: FinancialPoliciesSchema;
  autoNumbering: AutoNumberingSchema;
  navigationPillars: NavigationPillarsSchema;
  menuCustomization: MenuCustomizationSchema;
  corporate: CorporateIdentity;
  financial: FinancialPolicies;
  numbering: NumberingEngine;
  navigation: {
    labels: NavigationLabels;
  };
  appearance: {
    themeMode: 'light' | 'dark' | 'high_contrast';
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    uiDensity: 'compact' | 'normal' | 'large';
    language: 'ar' | 'en';
  };
  rbac: {
    users: User[];
  };
  auditLogs: AuditLogRecord[];
  lastCommittedAt: string;
}

const MASTER_STORE_STORAGE_KEY = 'rmt_master_enterprise_store_v1';
const AUDIT_LOG_STORAGE_KEY = 'rmt_enterprise_audit_trail_v1';
const STORE_UPDATE_EVENT = 'rmt_master_store_updated';

function getStoredAuditLogs(): AuditLogRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Initializes default state by hydrating from initial data and durable localStorage
 */
function buildInitialMasterState(): MasterEnterpriseState {
  if (typeof window === 'undefined') {
    return createDefaultMasterState();
  }

  try {
    const raw = localStorage.getItem(MASTER_STORE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.corporate || parsed.companyIdentity)) {
        return {
          ...createDefaultMasterState(),
          ...parsed,
          companyIdentity: {
            ...createDefaultMasterState().companyIdentity,
            ...(parsed.companyIdentity || {}),
          },
          navigationPillars: {
            ...DEFAULT_NAVIGATION_PILLARS,
            ...(parsed.navigationPillars || {}),
          },
          menuCustomization: {
            ...createDefaultMasterState().menuCustomization,
            ...(parsed.menuCustomization || {}),
          },
          corporate: {
            ...createDefaultMasterState().corporate,
            ...(parsed.corporate || {}),
          },
          financial: {
            ...createDefaultMasterState().financial,
            ...(parsed.financial || {}),
          },
          numbering: {
            ...createDefaultMasterState().numbering,
            ...(parsed.numbering || {}),
          },
          appearance: {
            ...createDefaultMasterState().appearance,
            ...(parsed.appearance || {}),
          },
          rbac: {
            users: sanitizeUsersList(parsed.rbac?.users || INITIAL_USERS),
          },
        };
      }
    }
  } catch (e) {
    console.warn('[MasterEnterpriseStore] Failed to parse master store from cache, hydrating defaults', e);
  }

  // Fallback hydration from granular keys
  const defaultState = createDefaultMasterState();
  try {
    const nameAr = localStorage.getItem('rmt_company_name_ar');
    if (nameAr) {
      defaultState.corporate.nameAr = nameAr;
      defaultState.companyIdentity.officialArabicName = nameAr;
    }

    const nameEn = localStorage.getItem('rmt_company_name_en');
    if (nameEn) {
      defaultState.corporate.nameEn = nameEn;
      defaultState.companyIdentity.officialEnglishName = nameEn;
    }

    const cr = localStorage.getItem('rmt_cr_number');
    if (cr) {
      defaultState.corporate.crNumber = cr;
      defaultState.companyIdentity.crNumber = cr;
    }

    const vat = localStorage.getItem('rmt_vat_number');
    if (vat) {
      defaultState.corporate.vatNumber = vat;
      defaultState.companyIdentity.vatNumber = vat;
    }

    const bank = localStorage.getItem('rmt_bank_name');
    if (bank) {
      defaultState.corporate.bankName = bank;
      defaultState.companyIdentity.bankName = bank;
    }

    const iban = localStorage.getItem('rmt_bank_iban');
    if (iban) {
      defaultState.corporate.bankIban = iban;
      defaultState.companyIdentity.iban = iban;
    }

    const swift = localStorage.getItem('rmt_bank_swift');
    if (swift) {
      defaultState.corporate.bankSwift = swift;
      defaultState.companyIdentity.bankSwift = swift;
    }

    const logo = localStorage.getItem('rmt_company_logo');
    if (logo) {
      defaultState.corporate.logoUrl = logo;
      defaultState.companyIdentity.logoUrl = logo;
    }

    const autoSig = localStorage.getItem('rmt_auto_signatures');
    if (autoSig !== null) {
      const boolVal = autoSig !== 'false';
      defaultState.corporate.autoSignatures = boolVal;
      defaultState.companyIdentity.autoSealAndSignature = boolVal;
    }

    const pillarsRaw = localStorage.getItem('rmt_navigation_pillars');
    if (pillarsRaw) {
      try {
        const parsedPillars = JSON.parse(pillarsRaw);
        if (parsedPillars && typeof parsedPillars === 'object') {
          defaultState.navigationPillars = {
            ...DEFAULT_NAVIGATION_PILLARS,
            ...parsedPillars,
          };
        }
      } catch {}
    }

    const markup = localStorage.getItem('rmt_default_markup');
    if (markup) defaultState.financial.defaultMarkup = Number(markup);

    const margin = localStorage.getItem('rmt_default_margin');
    if (margin) defaultState.financial.defaultGrossMargin = Number(margin);

    const ret = localStorage.getItem('rmt_default_retention');
    if (ret) defaultState.financial.defaultRetention = Number(ret);

    const adv = localStorage.getItem('rmt_default_advance');
    if (adv) defaultState.financial.defaultAdvance = Number(adv);

    const vatRate = localStorage.getItem('rmt_default_vat');
    if (vatRate) defaultState.financial.defaultVat = Number(vatRate);

    const prec = localStorage.getItem('rmt_decimal_precision');
    if (prec) defaultState.financial.decimalPrecision = Number(prec);

    const curr = localStorage.getItem('rmt_currency_display');
    if (curr) defaultState.financial.currencyDisplay = curr;

    const pQuote = localStorage.getItem('rmt_prefix_quote');
    if (pQuote) defaultState.numbering.prefixQuote = pQuote;

    const pPO = localStorage.getItem('rmt_prefix_po');
    if (pPO) defaultState.numbering.prefixPO = pPO;

    const pInv = localStorage.getItem('rmt_prefix_inv');
    if (pInv) defaultState.numbering.prefixInvoice = pInv;

    const pDN = localStorage.getItem('rmt_prefix_dn');
    if (pDN) defaultState.numbering.prefixDN = pDN;

    const theme = localStorage.getItem('rmt_theme_mode');
    if (theme === 'light' || theme === 'dark' || theme === 'high_contrast') {
      defaultState.appearance.themeMode = theme;
    }

    const primaryColor = localStorage.getItem('rmt_primary_color');
    if (primaryColor) defaultState.appearance.primaryColor = primaryColor;

    const accentColor = localStorage.getItem('rmt_accent_color');
    if (accentColor) defaultState.appearance.accentColor = accentColor;

    const font = localStorage.getItem('rmt_font_family');
    if (font) defaultState.appearance.fontFamily = font;

    const scale = localStorage.getItem('rmt_ui_scale');
    if (scale === 'compact' || scale === 'large' || scale === 'normal') {
      defaultState.appearance.uiDensity = scale;
    }

    const lang = localStorage.getItem('rmt_language');
    if (lang === 'en' || lang === 'ar') defaultState.appearance.language = lang;

    const loadedUsers = getAllUsers();
    if (loadedUsers && loadedUsers.length > 0) defaultState.rbac.users = loadedUsers;

    defaultState.navigation.labels = getNavigationLabels();
  } catch (err) {
    console.error('[MasterEnterpriseStore] Error hydrating granular keys:', err);
  }

  return defaultState;
}

function createDefaultMasterState(): MasterEnterpriseState {
  const defaultCompanyIdentity: CompanyIdentitySchema = {
    officialArabicName: "شركة صناع الموارد التجارية",
    officialEnglishName: "RMT - Resource Makers Trading Est.",
    crNumber: "2050167793",
    vatNumber: "311552664400003",
    bankName: "Al Rajhi Bank (مصرف الراجحي)",
    iban: "SA7180000450608010001399",
    autoSealAndSignature: true,
    logoUrl: "",
    bankSwift: COMPANY_PROFILE.bankSwift,
    poBox: COMPANY_PROFILE.poBox,
    addressEn: COMPANY_PROFILE.addressEn,
    addressAr: COMPANY_PROFILE.addressAr,
    phone: COMPANY_PROFILE.phone,
    mobiles: [...COMPANY_PROFILE.mobiles],
    email: COMPANY_PROFILE.email,
    website: COMPANY_PROFILE.website,
    engineerName: COMPANY_PROFILE.engineerName,
    engineerTitle: COMPANY_PROFILE.engineerTitle,
    engineerEmail: COMPANY_PROFILE.engineerEmail,
    financeDirector: COMPANY_PROFILE.financeDirector,
    financeDirectorAr: COMPANY_PROFILE.financeDirectorAr,
    financeDirectorTitle: COMPANY_PROFILE.financeDirectorTitle,
  };

  const defaultCorporate: CorporateIdentity = {
    ...defaultCompanyIdentity,
    nameAr: defaultCompanyIdentity.officialArabicName,
    nameEn: defaultCompanyIdentity.officialEnglishName,
    tradeNameEn: defaultCompanyIdentity.officialEnglishName,
    bankIban: defaultCompanyIdentity.iban,
    bankAccountName: defaultCompanyIdentity.officialArabicName,
  };

  const defaultFinancialPolicies: FinancialPoliciesSchema = {
    defaultVatRate: 15,
    overheadPercentage: 10,
    profitMarginPercentage: 20,
    retentionRate: 10,
    defaultAdvance: 30,
    decimalPrecision: 2,
    currencyDisplay: 'SAR',
  };

  const defaultFinancial: FinancialPolicies = {
    ...defaultFinancialPolicies,
    defaultMarkup: 25,
    defaultGrossMargin: defaultFinancialPolicies.profitMarginPercentage,
    defaultRetention: defaultFinancialPolicies.retentionRate,
    defaultAdvance: 30,
    defaultVat: defaultFinancialPolicies.defaultVatRate,
    decimalPrecision: 2,
    currencyDisplay: 'SAR',
  };

  const defaultAutoNumbering: AutoNumberingSchema = {
    projectPrefix: "PRJ-",
    quotationPrefix: "QT-RMT-",
    invoicePrefix: "INV-",
    purchaseOrderPrefix: "PO-",
    deliveryNotePrefix: "DN-",
    sequenceDigits: 4,
    seqQuote: 1,
    seqPO: 1,
    seqInvoice: 1,
    seqDN: 1,
    seqProject: 1,
  };

  const defaultNumbering: NumberingEngine = {
    ...defaultAutoNumbering,
    prefixQuote: defaultAutoNumbering.quotationPrefix,
    prefixPO: defaultAutoNumbering.purchaseOrderPrefix,
    prefixInvoice: defaultAutoNumbering.invoicePrefix,
    prefixDN: defaultAutoNumbering.deliveryNotePrefix,
    prefixProject: defaultAutoNumbering.projectPrefix,
    seqQuote: 1,
    seqPO: 1,
    seqInvoice: 1,
    seqDN: 1,
    seqProject: 1,
  };

  const navLabels = getNavigationLabels();
  const defaultMenuCustomization: MenuCustomizationSchema = {
    projectsLabel: "المشاريع والعمليات",
    quotationsLabel: "عروض الأسعار والتسعير",
    procurementLabel: "المشتريات والتوريد",
    financeLabel: "المالية والفواتير",
    siteExecutionLabel: "التنفيذ والمتابعة الميدانية",
    labels: navLabels,
  };

  return {
    companyIdentity: defaultCompanyIdentity,
    financialPolicies: defaultFinancialPolicies,
    autoNumbering: defaultAutoNumbering,
    navigationPillars: { ...DEFAULT_NAVIGATION_PILLARS },
    menuCustomization: defaultMenuCustomization,
    corporate: defaultCorporate,
    financial: defaultFinancial,
    numbering: defaultNumbering,
    navigation: {
      labels: navLabels,
    },
    appearance: {
      themeMode: 'light',
      primaryColor: '#174A84',
      accentColor: '#007A5A',
      fontFamily: 'Cairo',
      uiDensity: 'normal',
      language: 'ar',
    },
    rbac: {
      users: sanitizeUsersList(INITIAL_USERS),
    },
    auditLogs: getStoredAuditLogs(),
    lastCommittedAt: new Date().toISOString(),
  };
}

// In-Memory Global Store Instance
let masterState: MasterEnterpriseState = buildInitialMasterState();
const listeners = new Set<() => void>();

/**
 * Global accessor for Master State
 */
export function getMasterEnterpriseState(): MasterEnterpriseState {
  return masterState;
}

/**
 * Returns corporate identity from SSOT
 */
export function getCorporateIdentity(): CorporateIdentity {
  return masterState.corporate;
}

/**
 * Returns financial policies from SSOT
 */
export function getFinancialPolicies(): FinancialPolicies {
  return masterState.financial;
}

/**
 * Returns numbering engine from SSOT
 */
export function getNumberingEngine(): NumberingEngine {
  return masterState.numbering;
}

/**
 * Subscribe to Master Enterprise Store changes
 */
export function subscribeMasterStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Commit & Broadcast changes to the entire enterprise ecosystem
 */
export function commitMasterEnterpriseState(
  updater: Partial<MasterEnterpriseState> | ((prev: MasterEnterpriseState) => MasterEnterpriseState)
): MasterEnterpriseState {
  const prev = masterState;
  const rawNext = typeof updater === 'function' ? updater(prev) : updater;

  // Harmonize companyIdentity & corporate
  const companyIdentity: CompanyIdentitySchema = {
    ...prev.companyIdentity,
    ...(rawNext.companyIdentity || {}),
    ...(rawNext.corporate ? {
      officialArabicName: rawNext.corporate.officialArabicName || rawNext.corporate.nameAr || prev.companyIdentity.officialArabicName,
      officialEnglishName: rawNext.corporate.officialEnglishName || rawNext.corporate.nameEn || prev.companyIdentity.officialEnglishName,
      crNumber: rawNext.corporate.crNumber || prev.companyIdentity.crNumber,
      vatNumber: rawNext.corporate.vatNumber || prev.companyIdentity.vatNumber,
      bankName: rawNext.corporate.bankName || prev.companyIdentity.bankName,
      iban: rawNext.corporate.iban || rawNext.corporate.bankIban || prev.companyIdentity.iban,
      autoSealAndSignature: rawNext.corporate.autoSealAndSignature ?? rawNext.corporate.autoSignatures ?? prev.companyIdentity.autoSealAndSignature,
      logoUrl: rawNext.corporate.logoUrl ?? prev.companyIdentity.logoUrl,
    } : {}),
  };

  const corporate: CorporateIdentity = {
    ...prev.corporate,
    ...(rawNext.corporate || {}),
    ...companyIdentity,
    nameAr: companyIdentity.officialArabicName,
    nameEn: companyIdentity.officialEnglishName,
    tradeNameEn: companyIdentity.officialEnglishName,
    bankIban: companyIdentity.iban,
    bankAccountName: companyIdentity.officialArabicName,
    autoSignatures: companyIdentity.autoSealAndSignature,
  };

  // Harmonize financialPolicies & financial
  const financialPolicies: FinancialPoliciesSchema = {
    ...prev.financialPolicies,
    ...(rawNext.financialPolicies || {}),
    ...(rawNext.financial ? {
      defaultVatRate: rawNext.financial.defaultVatRate ?? rawNext.financial.defaultVat ?? prev.financialPolicies.defaultVatRate,
      profitMarginPercentage: rawNext.financial.profitMarginPercentage ?? rawNext.financial.defaultGrossMargin ?? prev.financialPolicies.profitMarginPercentage,
      retentionRate: rawNext.financial.retentionRate ?? rawNext.financial.defaultRetention ?? prev.financialPolicies.retentionRate,
    } : {}),
  };

  const financial: FinancialPolicies = {
    ...prev.financial,
    ...(rawNext.financial || {}),
    ...financialPolicies,
    defaultVat: financialPolicies.defaultVatRate,
    defaultGrossMargin: financialPolicies.profitMarginPercentage,
    defaultRetention: financialPolicies.retentionRate,
  };

  // Harmonize autoNumbering & numbering
  const autoNumbering: AutoNumberingSchema = {
    ...prev.autoNumbering,
    ...(rawNext.autoNumbering || {}),
    ...(rawNext.numbering ? {
      projectPrefix: rawNext.numbering.projectPrefix || rawNext.numbering.prefixProject || prev.autoNumbering.projectPrefix,
      quotationPrefix: rawNext.numbering.quotationPrefix || rawNext.numbering.prefixQuote || prev.autoNumbering.quotationPrefix,
      invoicePrefix: rawNext.numbering.invoicePrefix || rawNext.numbering.prefixInvoice || prev.autoNumbering.invoicePrefix,
      purchaseOrderPrefix: rawNext.numbering.purchaseOrderPrefix || rawNext.numbering.prefixPO || prev.autoNumbering.purchaseOrderPrefix,
      deliveryNotePrefix: rawNext.numbering.deliveryNotePrefix || rawNext.numbering.prefixDN || prev.autoNumbering.deliveryNotePrefix,
    } : {}),
  };

  const numbering: NumberingEngine = {
    ...prev.numbering,
    ...(rawNext.numbering || {}),
    ...autoNumbering,
    prefixProject: autoNumbering.projectPrefix,
    prefixQuote: autoNumbering.quotationPrefix,
    prefixInvoice: autoNumbering.invoicePrefix,
    prefixPO: autoNumbering.purchaseOrderPrefix,
    prefixDN: autoNumbering.deliveryNotePrefix,
  };

  // Harmonize navigationPillars & menuCustomization
  const navigationPillars: NavigationPillarsSchema = {
    ...prev.navigationPillars,
    ...(rawNext.navigationPillars || {}),
    ...(rawNext.menuCustomization ? {
      p2_label: rawNext.menuCustomization.quotationsLabel || prev.navigationPillars?.p2_label || DEFAULT_NAVIGATION_PILLARS.p2_label,
      p3_label: rawNext.menuCustomization.projectsLabel || prev.navigationPillars?.p3_label || DEFAULT_NAVIGATION_PILLARS.p3_label,
      p4_label: rawNext.menuCustomization.procurementLabel || prev.navigationPillars?.p4_label || DEFAULT_NAVIGATION_PILLARS.p4_label,
      p5_label: rawNext.menuCustomization.financeLabel || prev.navigationPillars?.p5_label || DEFAULT_NAVIGATION_PILLARS.p5_label,
    } : {}),
  };

  // Harmonize menuCustomization & navigation
  const menuCustomization: MenuCustomizationSchema = {
    ...prev.menuCustomization,
    ...(rawNext.menuCustomization || {}),
    ...(rawNext.navigationPillars ? {
      quotationsLabel: rawNext.navigationPillars.p2_label || prev.menuCustomization.quotationsLabel,
      projectsLabel: rawNext.navigationPillars.p3_label || prev.menuCustomization.projectsLabel,
      procurementLabel: rawNext.navigationPillars.p4_label || prev.menuCustomization.procurementLabel,
      financeLabel: rawNext.navigationPillars.p5_label || prev.menuCustomization.financeLabel,
    } : {}),
  };

  const next: MasterEnterpriseState = {
    companyIdentity,
    financialPolicies,
    autoNumbering,
    navigationPillars,
    menuCustomization,
    corporate,
    financial,
    numbering,
    navigation: {
      ...prev.navigation,
      ...(rawNext.navigation || {}),
      labels: rawNext.navigation?.labels || menuCustomization.labels || prev.navigation.labels,
    },
    appearance: {
      ...prev.appearance,
      ...(rawNext.appearance || {}),
    },
    rbac: {
      ...prev.rbac,
      ...(rawNext.rbac || {}),
      users: sanitizeUsersList(rawNext.rbac?.users || prev.rbac?.users || INITIAL_USERS),
    },
    auditLogs: rawNext.auditLogs || prev.auditLogs || [],
    lastCommittedAt: new Date().toISOString(),
  };

  masterState = next;

  // Durable Persistence across all keys
  try {
    localStorage.setItem(MASTER_STORE_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(next.auditLogs || []));
    localStorage.setItem('rmt_navigation_pillars', JSON.stringify(next.navigationPillars));

    // Sync individual keys for backward compatibility and fast access
    localStorage.setItem('rmt_company_name_ar', next.corporate.nameAr);
    localStorage.setItem('rmt_company_name_en', next.corporate.nameEn);
    localStorage.setItem('rmt_cr_number', next.corporate.crNumber);
    localStorage.setItem('rmt_vat_number', next.corporate.vatNumber);
    localStorage.setItem('rmt_bank_name', next.corporate.bankName);
    localStorage.setItem('rmt_bank_iban', next.corporate.bankIban);
    localStorage.setItem('rmt_bank_swift', next.corporate.bankSwift || '');
    localStorage.setItem('rmt_auto_signatures', String(next.corporate.autoSignatures));
    if (next.corporate.logoUrl) {
      localStorage.setItem('rmt_company_logo', next.corporate.logoUrl);
    }

    localStorage.setItem('rmt_default_markup', String(next.financial.defaultMarkup));
    localStorage.setItem('rmt_default_margin', String(next.financial.defaultGrossMargin));
    localStorage.setItem('rmt_default_retention', String(next.financial.defaultRetention));
    localStorage.setItem('rmt_default_advance', String(next.financial.defaultAdvance));
    localStorage.setItem('rmt_default_vat', String(next.financial.defaultVat));
    localStorage.setItem('rmt_decimal_precision', String(next.financial.decimalPrecision));
    localStorage.setItem('rmt_currency_display', next.financial.currencyDisplay);

    localStorage.setItem('rmt_prefix_quote', next.numbering.prefixQuote);
    localStorage.setItem('rmt_prefix_po', next.numbering.prefixPO);
    localStorage.setItem('rmt_prefix_inv', next.numbering.prefixInvoice);
    localStorage.setItem('rmt_prefix_dn', next.numbering.prefixDN);

    localStorage.setItem('rmt_theme_mode', next.appearance.themeMode);
    localStorage.setItem('rmt_primary_color', next.appearance.primaryColor);
    localStorage.setItem('rmt_accent_color', next.appearance.accentColor);
    localStorage.setItem('rmt_font_family', next.appearance.fontFamily);
    localStorage.setItem('rmt_ui_scale', next.appearance.uiDensity);
    localStorage.setItem('rmt_language', next.appearance.language);
  } catch (err) {
    console.error('[MasterEnterpriseStore] Failed to persist state:', err);
  }

  // Notify in-process listeners
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[MasterEnterpriseStore] Listener error:', err);
    }
  });

  // Broadcast system-wide CustomEvents & storage event for cross-tab and cross-module synchronization
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORE_UPDATE_EVENT, { detail: next }));
    window.dispatchEvent(new CustomEvent('rmt_enterprise_settings_updated', { detail: next }));
    window.dispatchEvent(new CustomEvent('rmt_logo_updated', { detail: next.corporate.logoUrl }));
    window.dispatchEvent(new CustomEvent('rmt_users_updated', { detail: next.rbac.users }));
    window.dispatchEvent(new Event('storage'));
  }

  return masterState;
}

// Window Event Listeners for cross-tab or external mutations
if (typeof window !== 'undefined') {
  window.addEventListener(STORE_UPDATE_EVENT, (e: any) => {
    if (e.detail && e.detail !== masterState) {
      masterState = e.detail;
      listeners.forEach((l) => l());
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === MASTER_STORE_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        masterState = parsed;
        listeners.forEach((l) => l());
      } catch {}
    }
  });
}

/**
 * Dynamic Document Number Generator based on SSOT Numbering Configuration
 */
export function generateDocumentNumber(
  type: 'quote' | 'po' | 'invoice' | 'dn' | 'project',
  customSeq?: number
): string {
  const numbering = masterState.numbering;
  const currentYear = new Date().getFullYear();

  switch (type) {
    case 'quote': {
      const seq = customSeq ?? numbering.seqQuote;
      const digits = numbering.sequenceDigits || 4;
      const padded = String(seq).padStart(digits, '0');
      return `${numbering.quotationPrefix || numbering.prefixQuote}${currentYear}-${padded}`;
    }
    case 'po': {
      const seq = customSeq ?? numbering.seqPO;
      const digits = numbering.sequenceDigits || 4;
      const padded = String(seq).padStart(digits, '0');
      return `${numbering.purchaseOrderPrefix || numbering.prefixPO}${currentYear}-${padded}`;
    }
    case 'invoice': {
      const seq = customSeq ?? numbering.seqInvoice;
      const digits = numbering.sequenceDigits || 4;
      const padded = String(seq).padStart(digits, '0');
      return `${numbering.invoicePrefix || numbering.prefixInvoice}${currentYear}-${padded}`;
    }
    case 'dn': {
      const seq = customSeq ?? numbering.seqDN;
      const digits = numbering.sequenceDigits || 4;
      const padded = String(seq).padStart(digits, '0');
      return `${numbering.deliveryNotePrefix || numbering.prefixDN}${currentYear}-${padded}`;
    }
    case 'project': {
      const seq = customSeq ?? numbering.seqProject;
      const digits = numbering.sequenceDigits || 4;
      const padded = String(seq).padStart(digits, '0');
      return `${numbering.projectPrefix || numbering.prefixProject}${currentYear}-${padded}`;
    }
  }
}

/**
 * Append an immutable audit log record to the central store
 */
export function appendAuditLogRecord(
  entry: Omit<AuditLogRecord, 'id' | 'timestamp'>
): AuditLogRecord {
  const newRecord: AuditLogRecord = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const existingLogs = masterState.auditLogs || [];
  const updatedLogs = [newRecord, ...existingLogs].slice(0, 500); // keep last 500 records

  commitMasterEnterpriseState({
    auditLogs: updatedLogs,
  });

  return newRecord;
}

/**
 * React Hook for consuming the Master Enterprise Store
 */
export function useMasterEnterpriseStore(): {
  store: MasterEnterpriseState;
  companyIdentity: CompanyIdentitySchema;
  financialPolicies: FinancialPoliciesSchema;
  autoNumbering: AutoNumberingSchema;
  navigationPillars: NavigationPillarsSchema;
  menuCustomization: MenuCustomizationSchema;
  corporate: CorporateIdentity;
  financial: FinancialPolicies;
  numbering: NumberingEngine;
  navigation: { labels: NavigationLabels };
  appearance: MasterEnterpriseState['appearance'];
  auditLogs: AuditLogRecord[];
  appendAuditLog: typeof appendAuditLogRecord;
  commitStore: typeof commitMasterEnterpriseState;
} {
  const store = useSyncExternalStore(
    subscribeMasterStore,
    getMasterEnterpriseState,
    getMasterEnterpriseState
  );

  return {
    store,
    companyIdentity: store.companyIdentity || store.corporate,
    financialPolicies: store.financialPolicies || store.financial,
    autoNumbering: store.autoNumbering || store.numbering,
    navigationPillars: store.navigationPillars || DEFAULT_NAVIGATION_PILLARS,
    menuCustomization: store.menuCustomization || {
      projectsLabel: "المشاريع والعمليات",
      quotationsLabel: "عروض الأسعار والتسعير",
      procurementLabel: "المشتريات والتوريد",
      financeLabel: "المالية والفواتير",
      siteExecutionLabel: "التنفيذ والمتابعة الميدانية",
      labels: store.navigation.labels,
    },
    corporate: store.corporate,
    financial: store.financial,
    numbering: store.numbering,
    navigation: store.navigation,
    appearance: store.appearance,
    auditLogs: store.auditLogs || [],
    appendAuditLog: appendAuditLogRecord,
    commitStore: commitMasterEnterpriseState,
  };
}
