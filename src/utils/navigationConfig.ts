export interface NavigationLabels {
  pillars: {
    pillar1: string; // الرقابة العليا والسيولة
    pillar2: string; // الهندسة ودراسة العطاءات
    pillar3: string; // المشاريع والتنفيذ الميداني
    pillar4: string; // سلاسل الإمداد والمشتريات
    pillar5: string; // المالية ومراقبة التكاليف
    pillar6: string; // الحوكمة والسيادة السحابية
  };
  tabs: {
    dashboard: string;
    cash_flow_sentinel: string;
    status_breakdown: string;
    estimating_workbench: string;
    quotations: string;
    supplier_quotations: string;
    terms: string;
    projects: string;
    procurement_mgmt: string;
    purchase_orders: string;
    invoices: string;
    directory: string;
    settings: string;
    site_logistics?: string;
    autonomous_agents?: string;
  };
}

export const DEFAULT_NAVIGATION_LABELS: NavigationLabels = {
  pillars: {
    pillar1: '1. الرقابة العليا والسيولة',
    pillar2: '2. الهندسة ودراسة العطاءات',
    pillar3: '3. المشاريع والتنفيذ الميداني',
    pillar4: '4. سلاسل الإمداد والمشتريات',
    pillar5: '5. المالية ومراقبة التكاليف',
    pillar6: '6. الحوكمة والسيادة السحابية',
  },
  tabs: {
    dashboard: 'لوحة التحكم التنفيذية',
    cash_flow_sentinel: 'حارس السيولة وتدفقات النقد 30 يوماً',
    status_breakdown: 'حالات وترسيات المشاريع',
    estimating_workbench: 'منصة دراسة العطاءات والمقارنة السعرية',
    quotations: 'عروض أسعار العملاء وجداول الكميات',
    supplier_quotations: 'عروض الموردين ومقارنة الأسعار',
    terms: 'مكتبة الشروط والمواصفات',
    projects: 'إدارة المشاريع والعقود',
    procurement_mgmt: 'إدارة المشتريات وأوامر الشراء',
    purchase_orders: 'أوامر الشراء الصادرة للموردين',
    invoices: 'الفواتير والمستخلصات الضريبية',
    directory: 'دليل الشركاء والموردين',
    settings: 'إعدادات المنظومة وتخصيص بيئة العمل',
    site_logistics: 'التنفيذ والمتابعة الميدانية',
    autonomous_agents: 'الوكلاء المستقلون وبوت التليجرام (Telegram AI)',
  },
};

export const DEFAULT_NAVIGATION_LABELS_EN: NavigationLabels = {
  pillars: {
    pillar1: '1. Executive Oversight & Liquidity',
    pillar2: '2. Engineering & Tenders',
    pillar3: '3. Projects & Field Execution',
    pillar4: '4. Supply Chain & Procurement',
    pillar5: '5. Finance & Cost Control',
    pillar6: '6. Cloud Governance & RBAC',
  },
  tabs: {
    dashboard: 'Executive Dashboard',
    cash_flow_sentinel: 'Cash Flow Sentinel (30 Days)',
    status_breakdown: 'Tender Win / Loss Analysis',
    estimating_workbench: 'Tender Estimation & Costing',
    quotations: 'Customer Quotations & BOQ',
    supplier_quotations: 'Supplier Quotes & Comparison',
    terms: 'Specifications & Terms Library',
    projects: 'Projects & Contracts Registry',
    procurement_mgmt: 'Procurement & PO Hub',
    purchase_orders: 'Issued Purchase Orders',
    invoices: 'Tax Invoices & Billing',
    directory: 'Partners & Suppliers Master',
    settings: 'System Settings & Branding',
    site_logistics: 'Site Execution & Delivery Logs',
    autonomous_agents: 'Autonomous Agents & Telegram Bot',
  },
};

const STORAGE_KEY = 'rmt_navigation_labels';

export function getNavigationLabels(lang?: 'ar' | 'en'): NavigationLabels {
  const isEn = lang === 'en';
  const defaults = isEn ? DEFAULT_NAVIGATION_LABELS_EN : DEFAULT_NAVIGATION_LABELS;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${isEn ? 'en' : 'ar'}`);
    if (!raw) {
      // Fallback to legacy single key only for Arabic
      if (!isEn) {
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (parsed && typeof parsed === 'object') {
            return {
              pillars: { ...defaults.pillars, ...(typeof parsed.pillars === 'object' ? parsed.pillars : {}) },
              tabs: { ...defaults.tabs, ...(typeof parsed.tabs === 'object' ? parsed.tabs : {}) },
            };
          }
        }
      }
      return defaults;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        pillars: { ...defaults.pillars, ...(typeof parsed.pillars === 'object' ? parsed.pillars : {}) },
        tabs: { ...defaults.tabs, ...(typeof parsed.tabs === 'object' ? parsed.tabs : {}) },
      };
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export function saveNavigationLabels(labels: NavigationLabels, lang?: 'ar' | 'en'): void {
  const isEn = lang === 'en';
  try {
    localStorage.setItem(`${STORAGE_KEY}_${isEn ? 'en' : 'ar'}`, JSON.stringify(labels));
    if (!isEn) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    }
    window.dispatchEvent(new CustomEvent('rmt_navigation_labels_updated', { detail: { labels, lang } }));
  } catch (e) {
    console.error('Failed to save navigation labels:', e);
  }
}

export function resetNavigationLabels(lang?: 'ar' | 'en'): NavigationLabels {
  const isEn = lang === 'en';
  const defaults = isEn ? DEFAULT_NAVIGATION_LABELS_EN : DEFAULT_NAVIGATION_LABELS;
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${isEn ? 'en' : 'ar'}`);
    if (!isEn) localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('rmt_navigation_labels_updated', { detail: { labels: defaults, lang } }));
  } catch (e) {
    console.error('Failed to reset navigation labels:', e);
  }
  return defaults;
}

