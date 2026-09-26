import { generateAutoProcurementDrafts } from '../services/boqParserService';

// 1. زيادة العدادات وحساب الأرقام التسلسلية المونوطونية المتتالية
export const generateNextDocumentNumber = (
  docType: 'quote' | 'po' | 'invoice' | 'dn' | 'project',
  store?: any,
  commit: boolean = true
) => {
  let cfg = store?.autoNumbering;
  if (!cfg) {
    try {
      const raw = localStorage.getItem('rmt_autoNumbering');
      if (raw) {
        cfg = JSON.parse(raw);
      }
    } catch {}
  }

  cfg = cfg || {
    projectPrefix: 'PRJ-',
    quotationPrefix: 'QT-RMT-',
    invoicePrefix: 'INV-',
    purchaseOrderPrefix: 'PO-',
    deliveryNotePrefix: 'DN-',
    sequenceDigits: 4,
    seqQuote: 1,
    seqPO: 1,
    seqInvoice: 1,
    seqDN: 1,
    seqProject: 1,
  };

  const keyMap = {
    quote: 'rmt_customer_quotations',
    po: 'rmt_purchase_orders',
    invoice: 'rmt_invoices',
    dn: 'rmt_delivery_notes',
    project: 'rmt_projects',
  };

  let nextSeq = 1;
  try {
    const storedRaw = localStorage.getItem(keyMap[docType]);
    if (storedRaw) {
      const storedItems = JSON.parse(storedRaw);
      if (Array.isArray(storedItems) && storedItems.length > 0) {
        const numbers = storedItems.map((it: any) => {
          const numStr = String(it.poNumber || it.quotationNumber || it.invoiceNumber || it.projectNumber || it.id || '');
          const parts = numStr.split('-');
          const lastPart = parts[parts.length - 1];
          const parsed = parseInt(lastPart, 10);
          return isNaN(parsed) ? 0 : parsed;
        });
        nextSeq = Math.max(...numbers, 0) + 1;
      } else {
        nextSeq = 1;
      }
    } else {
      nextSeq = 1;
    }
  } catch {
    nextSeq = 1;
  }

  const digits = cfg.sequenceDigits || 4;
  let prefix = '';

  switch (docType) {
    case 'quote':
      prefix = cfg.quotationPrefix || cfg.prefixQuote || 'QT-RMT-';
      break;
    case 'po':
      prefix = cfg.purchaseOrderPrefix || cfg.prefixPO || 'PO-';
      break;
    case 'invoice':
      prefix = cfg.invoicePrefix || cfg.prefixInvoice || 'INV-';
      break;
    case 'dn':
      prefix = cfg.deliveryNotePrefix || cfg.prefixDN || 'DN-';
      break;
    case 'project':
      prefix = cfg.projectPrefix || cfg.prefixProject || 'PRJ-';
      break;
  }

  const paddedSeq = String(nextSeq).padStart(digits, '0');
  return `${prefix}${new Date().getFullYear()}-${paddedSeq}`;
};

// 2. مزامنة ميزانية المشروع التلقائية عند تعميد العميل
export const syncProjectFinancialBudget = (project: any, clientContractPO: any) => {
  if (clientContractPO && Number(clientContractPO.contractValue) > 0) {
    project.budget = Number(clientContractPO.contractValue);
  }
  return project;
};

// 3. توحيد القوائم وتطهير النصوص الثابتة
export const getPillarLabel = (store: any, pillarKey: 'p1_label' | 'p2_label' | 'p3_label' | 'p4_label' | 'p5_label' | 'p6_label') => {
  return store?.navigationPillars?.[pillarKey] || '';
};

export const getSanitizedCompanyName = (companyIdentity: any) => {
  return (companyIdentity?.officialArabicName || 'شركة صناع الموارد التجارية').trim();
};

export const triggerAutoProcurementForProject = (project: any) => {
  try {
    const suppliers = JSON.parse(localStorage.getItem('rmt_suppliers') || '[]');
    return generateAutoProcurementDrafts(project, suppliers);
  } catch (err) {
    console.warn('[SystemStore] Auto procurement trigger warning:', err);
    return null;
  }
};
