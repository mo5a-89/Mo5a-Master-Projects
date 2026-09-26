/**
 * Core General Ledger & Double-Entry Sub-Ledger Engine
 * 
 * Central accounting source of truth for:
 * 1. Accounts Payable (Vendor Sub-Ledger):
 *    - PO Confirmation / Issuance: Posts liability entry (Credit AP, Debit Direct Project Cost / Inventory)
 *    - Vendor Payment: Deducts liability (Debit AP, Credit Bank/Cash)
 *    - Vendor Balance = Total PO Values (inc. VAT) - Total Vendor Payments
 * 
 * 2. Accounts Receivable (Customer Sub-Ledger):
 *    - Posted Tax Invoice: Posts debit entry to customer account (Debit AR, Credit Revenue & VAT Output)
 *    - Customer Receipt: Posts credit entry (Credit AR, Debit Bank/Cash)
 *    - Customer Outstanding = Total Invoiced (inc. VAT) - Total Collections
 * 
 * 3. General Journal / Audit Trail:
 *    - Every financial event creates a timestamped, balanced debit/credit transaction record.
 */

import { PurchaseOrder, Invoice, Project, Customer, Supplier, POPaymentRecord, InvoicePayment } from '../types';

export type AccountCode =
  | '1010-CASH'
  | '1020-BANK'
  | '1200-AR-CUSTOMERS'
  | '1400-PROJECT-INVENTORY'
  | '2010-AP-VENDORS'
  | '2020-VAT-OUTPUT'
  | '2030-RETENTION-WITHHELD'
  | '2040-CUSTOMER-ADVANCES'
  | '4010-PROJECT-REVENUE'
  | '5010-DIRECT-PROJECT-COST';

export interface JournalLine {
  id: string;
  accountCode: AccountCode;
  accountNameAr: string;
  accountNameEn: string;
  debit: number;
  credit: number;
  description: string;
  partnerId?: string;
  partnerName?: string;
  partnerType?: 'customer' | 'supplier';
  projectId?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string; // e.g. JE-2026-0001
  date: string;
  referenceType: 'PO_ISSUED' | 'PO_PAYMENT' | 'INVOICE_POSTED' | 'CUSTOMER_RECEIPT' | 'ADVANCE_RECEIVED' | 'RETENTION_RELEASE';
  referenceId: string;
  referenceNumber: string;
  description: string;
  projectId?: string;
  projectName?: string;
  partnerId?: string;
  partnerName?: string;
  debitTotal: number;
  creditTotal: number;
  lines: JournalLine[];
  createdAt: string;
}

export interface VendorSOATransaction {
  id: string;
  date: string;
  poId: string;
  poNumber: string;
  referenceNo: string;
  type: 'PO' | 'PAYMENT';
  description: string;
  projectName: string;
  poTotal: number;
  paidAmount: number;
  balanceDue: number;
  fulfillmentStatus: string;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Paid in Full';
  rawPO?: PurchaseOrder;
}

export interface VendorSOAReport {
  supplierId: string;
  supplierName: string;
  supplierVatNo?: string;
  reportDate: string;
  totalCommittedPOs: number; // Sum of all PO grand totals (inc. VAT)
  totalPaidToVendor: number;  // Sum of all payments to vendor
  netOutstandingPayables: number; // Balance due to vendor
  poCount: number;
  transactions: VendorSOATransaction[];
}

export interface CustomerSOATransaction {
  id: string;
  date: string;
  type: 'Invoice' | 'Receipt' | 'Advance' | 'Retention';
  referenceNo: string;
  description: string;
  projectName: string;
  debit: number; // Invoiced amount (increases customer debt)
  credit: number; // Payments received (decreases customer debt)
  runningBalance: number;
  invoiceStatus?: string;
  rawInvoice?: Invoice;
}

export interface CustomerSOAReport {
  customerId: string;
  customerName: string;
  customerVatNo?: string;
  reportDate: string;
  totalInvoiced: number; // Gross Invoiced with VAT
  totalCollected: number; // Collections & advance settlements
  netOutstanding: number; // Current collectible balance
  aging: {
    current_0_30: number;
    days_31_60: number;
    days_61_90: number;
    over_90: number;
  };
  transactions: CustomerSOATransaction[];
}

const STORAGE_KEY_JOURNAL = 'rmt_general_ledger_entries';

/**
 * Loads all journal entries from storage safely
 */
export function getJournalEntries(): JournalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_JOURNAL);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[LedgerService] Failed to load journal entries:', err);
    return [];
  }
}

/**
 * Saves journal entries to persistent storage
 */
export function saveJournalEntries(entries: JournalEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_JOURNAL, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('rmt_ledger_updated'));
  } catch (err) {
    console.error('[LedgerService] Failed to save journal entries:', err);
  }
}

/**
 * Generates sequential Journal Entry Number
 */
export function generateJournalEntryNumber(existingEntries: JournalEntry[]): string {
  const currentYear = new Date().getFullYear();
  const yearEntries = existingEntries.filter((e) => e.entryNumber.startsWith(`JE-${currentYear}`));
  const nextSeq = yearEntries.length + 1;
  return `JE-${currentYear}-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Posts an Accounts Payable Liability Entry when a PO is issued
 */
export function postPurchaseOrderEntry(po: PurchaseOrder): JournalEntry {
  const entries = getJournalEntries();
  const entryNumber = generateJournalEntryNumber(entries);
  const totalAmount = Number(po.grandTotal || po.totalAmount || 0);

  const entry: JournalEntry = {
    id: `je-po-${po.id}-${Date.now()}`,
    entryNumber,
    date: po.date || new Date().toISOString().split('T')[0],
    referenceType: 'PO_ISSUED',
    referenceId: po.id,
    referenceNumber: po.poNumber,
    description: `إثبات التزام أمر شراء مواد - ${po.vendorName || po.supplierName} (${po.projectName})`,
    projectId: po.projectId,
    projectName: po.projectName,
    partnerId: po.supplierId || po.vendorName,
    partnerName: po.vendorName || po.supplierName,
    debitTotal: totalAmount,
    creditTotal: totalAmount,
    lines: [
      {
        id: `line-po-dr-${Date.now()}`,
        accountCode: '5010-DIRECT-PROJECT-COST',
        accountNameAr: 'تكاليف ومشتريات المشاريع المباشرة',
        accountNameEn: 'Direct Project Procurement Cost',
        debit: totalAmount,
        credit: 0,
        description: `أمر شراء ${po.poNumber} - ${po.projectName}`,
        projectId: po.projectId,
      },
      {
        id: `line-po-cr-${Date.now()}`,
        accountCode: '2010-AP-VENDORS',
        accountNameAr: 'حسابات الموردين والدائنون (AP)',
        accountNameEn: 'Accounts Payable - Vendors',
        debit: 0,
        credit: totalAmount,
        description: `استحقاق مورد: ${po.vendorName || po.supplierName}`,
        partnerId: po.supplierId || po.vendorName,
        partnerName: po.vendorName || po.supplierName,
        partnerType: 'supplier',
      },
    ],
    createdAt: new Date().toISOString(),
  };

  entries.push(entry);
  saveJournalEntries(entries);
  return entry;
}

/**
 * Posts a Vendor Payment Entry (Deducts AP liability)
 */
export function postVendorPaymentEntry(
  po: PurchaseOrder,
  payment: POPaymentRecord
): JournalEntry {
  const entries = getJournalEntries();
  const entryNumber = generateJournalEntryNumber(entries);
  const amount = Number(payment.amount || 0);

  const entry: JournalEntry = {
    id: `je-popay-${payment.id}-${Date.now()}`,
    entryNumber,
    date: payment.paymentDate || new Date().toISOString().split('T')[0],
    referenceType: 'PO_PAYMENT',
    referenceId: payment.id,
    referenceNumber: payment.referenceNo || po.poNumber,
    description: `سداد دفعة للمورد: ${po.vendorName || po.supplierName} - أمر شراء ${po.poNumber}`,
    projectId: po.projectId,
    projectName: po.projectName,
    partnerId: po.supplierId || po.vendorName,
    partnerName: po.vendorName || po.supplierName,
    debitTotal: amount,
    creditTotal: amount,
    lines: [
      {
        id: `line-popay-dr-${Date.now()}`,
        accountCode: '2010-AP-VENDORS',
        accountNameAr: 'حسابات الموردين والدائنون (AP)',
        accountNameEn: 'Accounts Payable - Vendors',
        debit: amount,
        credit: 0,
        description: `تخفيض التزام المورد ${po.vendorName} - ${payment.referenceNo || ''}`,
        partnerId: po.supplierId || po.vendorName,
        partnerName: po.vendorName || po.supplierName,
        partnerType: 'supplier',
      },
      {
        id: `line-popay-cr-${Date.now()}`,
        accountCode: payment.paymentMethod === 'Cash' ? '1010-CASH' : '1020-BANK',
        accountNameAr: payment.paymentMethod === 'Cash' ? 'الصندوق / النقدية' : 'البنك والحسابات الجارية',
        accountNameEn: payment.paymentMethod === 'Cash' ? 'Cash on Hand' : 'Bank Account',
        debit: 0,
        credit: amount,
        description: `سداد بموجب ${payment.paymentMethod} - مـرجع: ${payment.referenceNo || po.poNumber}`,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  entries.push(entry);
  saveJournalEntries(entries);
  return entry;
}

/**
 * Posts an Accounts Receivable Debit Entry when a Tax Invoice is posted
 */
export function postInvoiceEntry(invoice: Invoice): JournalEntry {
  const entries = getJournalEntries();
  const entryNumber = generateJournalEntryNumber(entries);
  const grossTotal = Number(invoice.grandTotal || 0);
  const netRevenue = Number(invoice.totalAfterDiscount || invoice.subtotal || 0);
  const vatAmount = Number(invoice.vatAmount || 0);

  const entry: JournalEntry = {
    id: `je-inv-${invoice.id}-${Date.now()}`,
    entryNumber,
    date: invoice.date || new Date().toISOString().split('T')[0],
    referenceType: 'INVOICE_POSTED',
    referenceId: invoice.id,
    referenceNumber: invoice.invoiceNumber,
    description: `إصدار فاتورة ضريبية للعميل: ${invoice.customerName} (${invoice.projectName})`,
    projectId: invoice.projectId,
    projectName: invoice.projectName,
    partnerId: invoice.customerId,
    partnerName: invoice.customerName,
    debitTotal: grossTotal,
    creditTotal: grossTotal,
    lines: [
      {
        id: `line-inv-dr-${Date.now()}`,
        accountCode: '1200-AR-CUSTOMERS',
        accountNameAr: 'حسابات العملاء والمدينون (AR)',
        accountNameEn: 'Accounts Receivable - Customers',
        debit: grossTotal,
        credit: 0,
        description: `فاتورة ضريبية رقم ${invoice.invoiceNumber} - ${invoice.projectName}`,
        partnerId: invoice.customerId,
        partnerName: invoice.customerName,
        partnerType: 'customer',
        projectId: invoice.projectId,
      },
      {
        id: `line-inv-cr-rev-${Date.now()}`,
        accountCode: '4010-PROJECT-REVENUE',
        accountNameAr: 'إيرادات عقود ومشاريع كهروميكانيكية',
        accountNameEn: 'MEP Project Contracting Revenue',
        debit: 0,
        credit: netRevenue,
        description: `إيراد فاتورة ${invoice.invoiceNumber}`,
        projectId: invoice.projectId,
      },
      {
        id: `line-inv-cr-vat-${Date.now()}`,
        accountCode: '2020-VAT-OUTPUT',
        accountNameAr: 'ضريبة القيمة المضافة المستحقة (15%)',
        accountNameEn: 'VAT Output Tax Payable (15%)',
        debit: 0,
        credit: vatAmount,
        description: `ضريبة مخرجات فاتورة ${invoice.invoiceNumber}`,
        projectId: invoice.projectId,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  entries.push(entry);
  saveJournalEntries(entries);
  return entry;
}

/**
 * Posts a Customer Collection Receipt Entry (Credits AR)
 */
export function postCustomerReceiptEntry(
  invoice: Invoice,
  payment: InvoicePayment
): JournalEntry {
  const entries = getJournalEntries();
  const entryNumber = generateJournalEntryNumber(entries);
  const amount = Number(payment.amount || 0);

  const entry: JournalEntry = {
    id: `je-rcp-${payment.id}-${Date.now()}`,
    entryNumber,
    date: payment.date || new Date().toISOString().split('T')[0],
    referenceType: 'CUSTOMER_RECEIPT',
    referenceId: payment.id,
    referenceNumber: payment.receiptNumber || payment.referenceNo || invoice.invoiceNumber,
    description: `تحصيل دفعة من العميل: ${invoice.customerName} - فاتورة ${invoice.invoiceNumber}`,
    projectId: invoice.projectId,
    projectName: invoice.projectName,
    partnerId: invoice.customerId,
    partnerName: invoice.customerName,
    debitTotal: amount,
    creditTotal: amount,
    lines: [
      {
        id: `line-rcp-dr-${Date.now()}`,
        accountCode: payment.paymentMethod === 'Cash' ? '1010-CASH' : '1020-BANK',
        accountNameAr: payment.paymentMethod === 'Cash' ? 'الصندوق / النقدية' : 'البنك والحسابات الجارية',
        accountNameEn: payment.paymentMethod === 'Cash' ? 'Cash on Hand' : 'Bank Account',
        debit: amount,
        credit: 0,
        description: `إيداع تحصيل ${payment.paymentMethod} - سند ${payment.receiptNumber || ''}`,
      },
      {
        id: `line-rcp-cr-${Date.now()}`,
        accountCode: '1200-AR-CUSTOMERS',
        accountNameAr: 'حسابات العملاء والمدينون (AR)',
        accountNameEn: 'Accounts Receivable - Customers',
        debit: 0,
        credit: amount,
        description: `سداد فاتورة ${invoice.invoiceNumber} - العميل ${invoice.customerName}`,
        partnerId: invoice.customerId,
        partnerName: invoice.customerName,
        partnerType: 'customer',
        projectId: invoice.projectId,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  entries.push(entry);
  saveJournalEntries(entries);
  return entry;
}

/**
 * ACCOUNTS PAYABLE: Calculates real Vendor Balance
 * Vendor Balance = Total PO Values (inc. VAT) - Total Vendor Payments
 */
export function calculateVendorBalance(
  supplierIdentifier: string,
  purchaseOrders: PurchaseOrder[]
): {
  totalPOValue: number;
  totalPaid: number;
  balanceDue: number;
} {
  const normTarget = supplierIdentifier.trim().toLowerCase();
  const vendorPOs = purchaseOrders.filter((po) => {
    if (po.deletedAt) return false;
    const sId = (po.supplierId || '').toLowerCase();
    const sName = (po.supplierName || '').toLowerCase();
    const vName = (po.vendorName || '').toLowerCase();
    return sId === normTarget || sName === normTarget || vName === normTarget || sName.includes(normTarget) || vName.includes(normTarget);
  });

  const totalPOValue = vendorPOs.reduce((sum, po) => sum + Number(po.grandTotal || po.totalAmount || 0), 0);
  const totalPaid = vendorPOs.reduce((sum, po) => {
    const directPaid = Number(po.paidAmount || 0);
    const paymentsSum = (po.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    return sum + Math.max(directPaid, paymentsSum);
  }, 0);

  const balanceDue = Math.max(0, totalPOValue - totalPaid);

  return {
    totalPOValue,
    totalPaid,
    balanceDue,
  };
}

/**
 * Generates Real Vendor Statement of Account (Vendor Sub-Ledger)
 */
export function generateVendorSOAReport(
  supplierIdentifier: string,
  purchaseOrders: PurchaseOrder[],
  suppliers: Supplier[] = [],
  startDate?: string,
  endDate?: string
): VendorSOAReport {
  const normTarget = supplierIdentifier.trim().toLowerCase();
  const matchedSupplier = suppliers.find(
    (s) => s.id === supplierIdentifier || s.name.toLowerCase().includes(normTarget)
  );

  const vendorPOs = purchaseOrders.filter((po) => {
    if (po.deletedAt) return false;
    if (supplierIdentifier === 'all') return true;
    const sId = (po.supplierId || '').toLowerCase();
    const sName = (po.supplierName || '').toLowerCase();
    const vName = (po.vendorName || '').toLowerCase();
    return sId === normTarget || sName === normTarget || vName === normTarget || sName.includes(normTarget) || vName.includes(normTarget);
  });

  const transactions: VendorSOATransaction[] = [];
  let totalCommittedPOs = 0;
  let totalPaidToVendor = 0;

  vendorPOs.forEach((po) => {
    const poTotal = Number(po.grandTotal || po.totalAmount || 0);
    const paidSum = (po.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const poPaid = Math.max(Number(po.paidAmount || 0), paidSum);
    const balanceDue = Math.max(0, poTotal - poPaid);

    totalCommittedPOs += poTotal;
    totalPaidToVendor += poPaid;

    // Determine payment status
    let paymentStatus: VendorSOATransaction['paymentStatus'] = 'Unpaid';
    if (poPaid >= poTotal && poTotal > 0) {
      paymentStatus = 'Paid in Full';
    } else if (poPaid > 0) {
      paymentStatus = 'Partially Paid';
    }

    // Determine fulfillment status
    const fulfillmentStatus = po.fulfillmentStatus || po.status || 'Issued';

    transactions.push({
      id: `soa-po-${po.id}`,
      date: po.date || po.createdAt?.slice(0, 10) || new Date().toISOString().split('T')[0],
      poId: po.id,
      poNumber: po.poNumber,
      referenceNo: po.quotationRef || po.poNumber,
      type: 'PO',
      description: `أمر شراء توريد مواد - ${po.projectName} (${po.items?.length || 0} بنود)`,
      projectName: po.projectName,
      poTotal,
      paidAmount: poPaid,
      balanceDue,
      fulfillmentStatus,
      paymentStatus,
      rawPO: po,
    });
  });

  // Sort by date ascending
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Apply optional date filtering
  const filteredTransactions = transactions.filter((tx) => {
    if (startDate && tx.date < startDate) return false;
    if (endDate && tx.date > endDate) return false;
    return true;
  });

  const netOutstandingPayables = Math.max(0, totalCommittedPOs - totalPaidToVendor);

  return {
    supplierId: supplierIdentifier,
    supplierName: matchedSupplier?.name || vendorPOs[0]?.vendorName || vendorPOs[0]?.supplierName || 'كافة الموردين المعتمدين',
    supplierVatNo: matchedSupplier?.vatNumber || vendorPOs[0]?.vendorVatNo,
    reportDate: new Date().toISOString().split('T')[0],
    totalCommittedPOs,
    totalPaidToVendor,
    netOutstandingPayables,
    poCount: vendorPOs.length,
    transactions: filteredTransactions,
  };
}

/**
 * ACCOUNTS RECEIVABLE: Calculates real Customer Balance
 * Customer Outstanding = Total Invoiced (inc. VAT) - Total Collections
 */
export function calculateCustomerBalance(
  customerIdentifier: string,
  invoices: Invoice[],
  projects: Project[] = []
): {
  totalInvoiced: number;
  totalCollected: number;
  netOutstanding: number;
} {
  const normTarget = customerIdentifier.trim().toLowerCase();
  const custInvoices = invoices.filter((inv) => {
    if (inv.deletedAt || inv.status === 'Draft') return false;
    if (customerIdentifier === 'all') return true;
    const cId = (inv.customerId || '').toLowerCase();
    const cName = (inv.customerName || '').toLowerCase();
    return cId === normTarget || cName === normTarget || cName.includes(normTarget);
  });

  const totalInvoiced = custInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);
  const totalCollected = custInvoices.reduce((sum, inv) => {
    const directPaid = Number(inv.paidAmount || 0);
    const paymentsSum = (inv.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    return sum + Math.max(directPaid, paymentsSum);
  }, 0);

  // Include project advance payments
  const custProjects = projects.filter((proj) => {
    if (customerIdentifier === 'all') return true;
    const pCustId = (proj.customerId || '').toLowerCase();
    const pCustName = (proj.customerName || '').toLowerCase();
    return pCustId === normTarget || pCustName === normTarget || pCustName.includes(normTarget);
  });

  const totalAdvances = custProjects.reduce((sum, p) => sum + Number(p.advancePaymentAmount || 0), 0);
  const effectiveCollected = totalCollected + totalAdvances;
  const netOutstanding = Math.max(0, totalInvoiced - totalCollected);

  return {
    totalInvoiced,
    totalCollected: effectiveCollected,
    netOutstanding,
  };
}

/**
 * Generates Real Customer Statement of Account (Customer Sub-Ledger & Running Balance)
 */
export function generateCustomerSOAReport(
  customerIdentifier: string,
  invoices: Invoice[],
  projects: Project[] = [],
  customers: Customer[] = [],
  startDate?: string,
  endDate?: string
): CustomerSOAReport {
  const normTarget = customerIdentifier.trim().toLowerCase();
  const matchedCustomer = customers.find(
    (c) => c.id === customerIdentifier || c.companyName?.toLowerCase().includes(normTarget)
  );

  const rawEvents: Array<{
    date: string;
    type: 'Invoice' | 'Receipt' | 'Advance' | 'Retention';
    referenceNo: string;
    description: string;
    projectName: string;
    debit: number;
    credit: number;
    status?: string;
    rawInvoice?: Invoice;
  }> = [];

  let totalInvoiced = 0;
  let totalCollected = 0;

  // 1. Advance Payments from projects
  projects.forEach((proj) => {
    const matchesCust =
      customerIdentifier === 'all' ||
      (proj.customerId && proj.customerId.toLowerCase() === normTarget) ||
      (proj.customerName && proj.customerName.toLowerCase().includes(normTarget));

    if (matchesCust && proj.advancePaymentAmount && proj.advancePaymentAmount > 0) {
      totalCollected += proj.advancePaymentAmount;
      rawEvents.push({
        date: proj.advancePaymentDate || proj.startDate || '2026-07-25',
        type: 'Advance',
        referenceNo: proj.advancePaymentReceiptNo || 'ADV-RCP-01',
        description: `دفعة أولى مقدمة مستلمة - ${proj.name}`,
        projectName: proj.name,
        debit: 0,
        credit: proj.advancePaymentAmount,
      });
    }
  });

  // 2. Invoices and their individual payment receipts
  invoices.forEach((inv) => {
    if (inv.deletedAt || inv.status === 'Draft') return;
    const matchesCust =
      customerIdentifier === 'all' ||
      (inv.customerId && inv.customerId.toLowerCase() === normTarget) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(normTarget));

    if (!matchesCust) return;

    const invoiceTotal = Number(inv.grandTotal || 0);
    totalInvoiced += invoiceTotal;

    // Post Invoice Debit
    rawEvents.push({
      date: inv.date || inv.createdAt?.slice(0, 10) || new Date().toISOString().split('T')[0],
      type: 'Invoice',
      referenceNo: inv.invoiceNumber,
      description: `فاتورة ضريبية - ${inv.projectName}${inv.notes ? ` (${inv.notes})` : ''}`,
      projectName: inv.projectName,
      debit: invoiceTotal,
      credit: 0,
      status: inv.status,
      rawInvoice: inv,
    });

    // Post Payment Receipts Credit
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((pmt, idx) => {
        const pmtAmount = Number(pmt.amount || 0);
        totalCollected += pmtAmount;
        rawEvents.push({
          date: pmt.date || inv.date || new Date().toISOString().split('T')[0],
          type: 'Receipt',
          referenceNo: pmt.receiptNumber || pmt.referenceNo || `RCP-${inv.invoiceNumber}-${idx + 1}`,
          description: `سداد وتحصيل - فاتورة ${inv.invoiceNumber} (${pmt.paymentMethod})`,
          projectName: inv.projectName,
          debit: 0,
          credit: pmtAmount,
        });
      });
    } else if (inv.paidAmount && inv.paidAmount > 0) {
      totalCollected += inv.paidAmount;
      rawEvents.push({
        date: inv.date || new Date().toISOString().split('T')[0],
        type: 'Receipt',
        referenceNo: `RCP-${inv.invoiceNumber}`,
        description: `سداد مسجل على فاتورة ${inv.invoiceNumber}`,
        projectName: inv.projectName,
        debit: 0,
        credit: inv.paidAmount,
      });
    }
  });

  // Sort events chronologically
  rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute running balance
  let currentRunningBalance = 0;
  const transactions: CustomerSOATransaction[] = rawEvents.map((evt, idx) => {
    currentRunningBalance += evt.debit - evt.credit;
    return {
      id: `soa-tx-${idx + 1}`,
      date: evt.date,
      type: evt.type,
      referenceNo: evt.referenceNo,
      description: evt.description,
      projectName: evt.projectName,
      debit: evt.debit,
      credit: evt.credit,
      runningBalance: currentRunningBalance,
      invoiceStatus: evt.status,
      rawInvoice: evt.rawInvoice,
    };
  });

  // Aging Analysis
  const now = new Date().getTime();
  const aging = {
    current_0_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    over_90: 0,
  };

  invoices.forEach((inv) => {
    if (inv.deletedAt || inv.status === 'Draft' || inv.status === 'Paid') return;
    const rem = Number(inv.remainingAmount ?? (inv.grandTotal - (inv.paidAmount || 0)));
    if (rem <= 0) return;

    const invDate = new Date(inv.date || inv.createdAt).getTime();
    const days = Math.floor((now - invDate) / (1000 * 60 * 60 * 24));

    if (days <= 30) aging.current_0_30 += rem;
    else if (days <= 60) aging.days_31_60 += rem;
    else if (days <= 90) aging.days_61_90 += rem;
    else aging.over_90 += rem;
  });

  const netOutstanding = Math.max(0, currentRunningBalance);

  return {
    customerId: customerIdentifier,
    customerName: matchedCustomer?.companyName || (matchedCustomer as any)?.name || 'كافة العملاء المعتمدين',
    customerVatNo: matchedCustomer?.vatNumber || '300994821100003',
    reportDate: new Date().toISOString().split('T')[0],
    totalInvoiced,
    totalCollected,
    netOutstanding,
    aging,
    transactions,
  };
}
