/**
 * Advanced Contractual Billing Engine & Deduction Logic
 * 
 * Implements strict contractual deduction logic:
 * 1. Advance Payment Recovery (الاستقطاع من الدفعة المقدمة): Pro-rata or custom rate deduction from interim invoices.
 * 2. Retention Withholding (محجوز الضمان التعاقدي): Standard 10% (or custom) withheld until project completion/handover.
 * 3. Dynamic recalculation of Project Actual Profit Margin based on Incurred Cost Log & PO Commitments.
 * 4. Zero binary file storage constraint - metadata and cloud drive links only.
 */

import { Project, Invoice, CostRecord, PurchaseOrder, CustomerQuotation, InvoiceItem, DeliveryNote } from '../types';

/**
 * Standard 2-decimal financial rounding to eliminate multi-decimal floating artifacts
 */
export function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Discrete units that must strictly enforce integer quantities (no decimal quantities permitted)
 */
export const DISCRETE_UNITS = ['ea', 'set', 'pcs', 'قطعة', 'طقم', 'وحدة', 'حبة', 'عدد'];

/**
 * Validates line item quantities based on unit type.
 * Throws explicit error if a discrete unit ('ea', 'set', 'pcs', etc.) has a non-integer quantity.
 */
export function validateDiscreteUnitQuantities(items: Array<{ unit?: string; quantity: number | string; description?: string }>): void {
  items.forEach((item, idx) => {
    const u = (item.unit || '').trim().toLowerCase();
    const qty = Number(item.quantity);
    if (DISCRETE_UNITS.includes(u) && !Number.isInteger(qty)) {
      throw new Error(`خطأ: لا يمكن قبول كسور عشرية للوحدة (${item.unit}) للصنف: ${item.description || `بند رقم ${idx + 1}`}`);
    }
  });
}

/**
 * Over-invoicing guard: verifies that line item quantities do not exceed available contract BOQ quantities.
 */
export function validateOverInvoicingGuard(
  invoiceItems: Array<{ sourceItemId?: string; description?: string; quantity: number; unit?: string }>,
  contractItems: Array<{ id?: string; description: string; contractQuantity: number; invoicedQuantity?: number }>
): void {
  // First enforce integer quantities on discrete units
  validateDiscreteUnitQuantities(invoiceItems);

  invoiceItems.forEach((invItem) => {
    const matchedContract = contractItems.find(
      (c) => (invItem.sourceItemId && c.id === invItem.sourceItemId) ||
             (c.description.trim().toLowerCase() === (invItem.description || '').trim().toLowerCase())
    );

    if (matchedContract) {
      const alreadyInvoiced = Number(matchedContract.invoicedQuantity || 0);
      const contractQty = Number(matchedContract.contractQuantity || 0);
      const availableToBill = Math.max(0, contractQty - alreadyInvoiced);

      if (invItem.quantity > availableToBill + 0.0001) {
        throw new Error(
          `خطأ تجاوز تعاقدي (Over-Invoicing): الكمية المطلوبة للفوترة (${invItem.quantity}) للصنف "${invItem.description}" تتجاوز الرصيد المتبقي المتاح في جدول الكميات (${availableToBill}).`
        );
      }
    }
  });
}

export interface ContractualDeductionBreakdown {
  grossSubtotalExVat: number;
  grossTaxable: number;
  advancePaymentDeductionRate: number; // e.g. 10%
  advancePaymentDeductionAmount: number;
  advanceRecovery: number;
  remainingAdvancePaymentBalance: number;
  retentionRate: number; // e.g. 10%
  retentionDeductionAmount: number;
  retentionAmount: number;
  taxableAmount: number;
  netTaxableAmountExVat: number;
  vatRate: number; // 0.15 (15% KSA VAT)
  vatAmount: number;
  totalWithVat: number;
  grandTotalWithVat: number;
  netPayable: number;
}

export interface ProjectMarginAnalysis {
  contractSellingPriceExVat: number;
  totalPOCommittedExVat: number;
  totalIncurredCostsExVat: number;
  totalActualCostsExVat: number;
  actualProfitAmount: number;
  actualProfitMarginPercent: number;
  plannedProfitAmount: number;
  plannedProfitMarginPercent: number;
  costVarianceAmount: number; // (actual - planned)
  healthStatus: 'healthy' | 'caution' | 'critical';
}

/**
 * Calculates contractual deductions for an interim or final invoice following ZATCA rules:
 * 1. Retention deduction computed from gross taxable.
 * 2. Advance recovery deducted from gross taxable before applying VAT.
 * 3. VAT (15%) applied on net taxable amount.
 * 4. Net payable = totalWithVat - retentionAmount.
 */
export function calculateContractualInvoiceDeductions(params: {
  grossSubtotalExVat: number;
  project: Project;
  customAdvanceRate?: number;
  customRetentionRate?: number;
  totalPriorAdvanceDeductions?: number;
  items?: Array<{ quantity: number; unitPrice: number }>;
}): ContractualDeductionBreakdown {
  const {
    grossSubtotalExVat,
    project,
    customAdvanceRate,
    customRetentionRate,
    totalPriorAdvanceDeductions = 0,
    items,
  } = params;

  // 1. Gross Taxable Subtotal
  const grossTaxable = round2(
    items && items.length > 0
      ? items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
      : Math.max(0, Number(grossSubtotalExVat) || 0)
  );

  // 2. Retention deduction rate & amount
  const retRate = customRetentionRate !== undefined
    ? customRetentionRate
    : (project.retentionRate !== undefined ? project.retentionRate : (project.retentionPercent || 10));

  const retentionAmount = round2((grossTaxable * retRate) / 100);

  // 3. Advance recovery capped strictly at actual advance balance
  const totalAdvanceReceived = round2(project.advancePaymentAmount || 0);
  const remainingAdvancePool = round2(Math.max(0, totalAdvanceReceived - totalPriorAdvanceDeductions));

  const advRate = customAdvanceRate !== undefined
    ? customAdvanceRate
    : (project.advancePaymentDeductionRate !== undefined ? project.advancePaymentDeductionRate : 10);

  let rawAdvanceRecovery = round2((grossTaxable * advRate) / 100);
  if (totalAdvanceReceived > 0 && rawAdvanceRecovery > remainingAdvancePool) {
    rawAdvanceRecovery = remainingAdvancePool;
  }
  if (remainingAdvancePool <= 0 && advRate > 0 && totalAdvanceReceived > 0) {
    rawAdvanceRecovery = 0;
  }
  const advanceRecovery = rawAdvanceRecovery;

  // 4. Taxable Amount (Advance recovery deducted before VAT)
  const taxableAmount = round2(Math.max(0, grossTaxable - advanceRecovery));

  // 5. KSA VAT 15%
  const vatRate = 0.15;
  const vatAmount = round2(taxableAmount * vatRate);
  const totalWithVat = round2(taxableAmount + vatAmount);

  // 6. Net Payable after retention deduction
  const netPayable = round2(Math.max(0, totalWithVat - retentionAmount));
  const remainingAdvanceBalance = round2(Math.max(0, remainingAdvancePool - advanceRecovery));

  return {
    grossSubtotalExVat: grossTaxable,
    grossTaxable,
    advancePaymentDeductionRate: advRate,
    advancePaymentDeductionAmount: advanceRecovery,
    advanceRecovery,
    remainingAdvancePaymentBalance: remainingAdvanceBalance,
    retentionRate: retRate,
    retentionDeductionAmount: retentionAmount,
    retentionAmount,
    taxableAmount,
    netTaxableAmountExVat: taxableAmount,
    vatRate,
    vatAmount,
    totalWithVat,
    grandTotalWithVat: totalWithVat,
    netPayable,
  };
}

/**
 * Reconciles stored invoice INV-PRJ2026001-001 and purges ghost Delivery Notes (DN-PRJ2026001-006, DN-PRJ2026001-008)
 */
export function reconcileInvoicePRJ2026001(): {
  reconciledInvoice: boolean;
  purgedGhostDNsCount: number;
  fixedDN003: boolean;
} {
  if (typeof window === 'undefined') {
    return { reconciledInvoice: false, purgedGhostDNsCount: 0, fixedDN003: false };
  }

  let reconciledInvoice = false;
  let purgedGhostDNsCount = 0;
  let fixedDN003 = false;

  try {
    // 1. Reconcile Invoice INV-PRJ2026001-001
    const rawInvoices = localStorage.getItem('rmt_invoices');
    let invoices: any[] = rawInvoices ? JSON.parse(rawInvoices) : [];

    const targetIndex = invoices.findIndex(
      (inv) => inv.id === 'INV-PRJ2026001-001' || inv.invoiceNumber === 'INV-PRJ2026001-001'
    );

    const reconciledItems = [
      {
        id: 'inv-item-1',
        itemNo: 1,
        description: 'Addressable Optical Smoke Detector with Base',
        quantity: 583,
        unit: 'EA',
        unitPrice: 268.50,
        totalPrice: 156535.50,
      },
      {
        id: 'inv-item-2',
        itemNo: 2,
        description: 'Addressable Heat Detector with Base',
        quantity: 459,
        unit: 'EA',
        unitPrice: 241.50,
        totalPrice: 110848.50,
      },
      {
        id: 'inv-item-3',
        itemNo: 3,
        description: 'Addressable Manual Call Point / Break Glass',
        quantity: 112,
        unit: 'EA',
        unitPrice: 423.25,
        totalPrice: 47404.00,
      },
      {
        id: 'inv-item-4',
        itemNo: 4,
        description: 'Fire Alarm Horn Strobe / Sounder Beacon Weatherproof',
        quantity: 85,
        unit: 'EA',
        unitPrice: 867.75,
        totalPrice: 73758.75,
      },
    ];

    const reconciledInvoiceObj: Partial<Invoice> & Record<string, any> = {
      id: 'INV-PRJ2026001-001',
      invoiceNumber: 'INV-PRJ2026001-001',
      invoiceDate: '2026-03-15',
      dueDate: '2026-04-15',
      projectId: 'PRJ-2026-001',
      projectName: 'مشروع أنظمة الإنذار والإطفاء المتكاملة - كامكو (KAMCO.1)',
      projectNumber: 'PRJ-2026-001',
      customerName: 'KAMCO.1',
      customerId: 'cust-1',
      status: 'Issued',
      sourceDeliveryNoteIds: ['DN-PRJ2026001-003', 'dn-1790244843792'],
      sourceQuotationId: 'RM012700',
      items: reconciledItems,
      // Exact Financial Ledger Values (ZATCA Compliant)
      subtotal: 388546.75,
      subTotal: 388546.75,
      grossSubtotalExVat: 388546.75,
      grossTaxable: 388546.75,
      advanceDeduction: 25000.00,
      advanceDeductionAmount: 25000.00,
      advancePaymentDeduction: 25000.00,
      advanceRecovery: 25000.00,
      taxableAmount: 363546.75,
      netTaxableAmountExVat: 363546.75,
      vatPercent: 15,
      vatRate: 0.15,
      taxRate: 15,
      vatAmount: 54532.01,
      taxAmount: 54532.01,
      totalWithVat: 418078.76,
      grandTotal: 418078.76,
      totalAmount: 418078.76,
      retentionPercent: 10,
      retentionDeductionPercent: 10,
      retentionRate: 10,
      retentionAmount: 38854.68,
      retentionDeduction: 38854.68,
      retentionDeductionAmount: 38854.68,
      netPayable: 379224.08,
      netPayableAmount: 379224.08,
      currency: 'SAR',
      notes: 'فاتورة مستخلص توريد مواد الإنذار ضد الحريق - معتمدة ومطابقة لسند التسليم DN-PRJ2026001-003',
      createdAt: '2026-03-15T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };

    if (targetIndex >= 0) {
      invoices[targetIndex] = { ...invoices[targetIndex], ...reconciledInvoiceObj };
    } else {
      invoices.push(reconciledInvoiceObj as Invoice);
    }
    localStorage.setItem('rmt_invoices', JSON.stringify(invoices));
    reconciledInvoice = true;

    // 2. Purge Ghost Delivery Notes (DN-PRJ2026001-006, DN-PRJ2026001-008) and lock DN-PRJ2026001-003
    const rawDNs = localStorage.getItem('rmt_delivery_notes');
    if (rawDNs) {
      let dns: any[] = JSON.parse(rawDNs);
      const initialLength = dns.length;

      // Filter out ghost delivery notes
      dns = dns.filter((dn) => {
        const isGhost =
          dn.id === 'DN-PRJ2026001-006' ||
          dn.dnNumber === 'DN-PRJ2026001-006' ||
          dn.id === 'DN-PRJ2026001-008' ||
          dn.dnNumber === 'DN-PRJ2026001-008' ||
          dn.dnNumber?.includes('006') ||
          dn.dnNumber?.includes('008');
        return !isGhost;
      });

      purgedGhostDNsCount = initialLength - dns.length;

      // Lock DN-PRJ2026001-003 as Fully Invoiced
      dns.forEach((dn) => {
        if (
          dn.id === 'DN-PRJ2026001-003' ||
          dn.dnNumber === 'DN-PRJ2026001-003' ||
          dn.dnNumber?.includes('003')
        ) {
          dn.invoicedStatus = 'Fully Invoiced';
          dn.status = 'Delivered';
          dn.linkedInvoiceId = 'INV-PRJ2026001-001';
          dn.invoiceNumber = 'INV-PRJ2026001-001';
          fixedDN003 = true;
        }
      });

      localStorage.setItem('rmt_delivery_notes', JSON.stringify(dns));
    }
  } catch (err) {
    console.error('[BillingService] Reconcile error:', err);
  }

  return { reconciledInvoice, purgedGhostDNsCount, fixedDN003 };
}

/**
 * Dynamic recalculation of Project Actual Profit Margin based on Incurred Cost Log, PO Commitments, and Contract Value.
 */
export function calculateProjectActualProfitMargin(
  project: Project,
  quotations: CustomerQuotation[] = [],
  purchaseOrders: PurchaseOrder[] = [],
  incurredCosts: CostRecord[] = []
): ProjectMarginAnalysis {
  // 1. Contract Selling Price (Ex VAT)
  const activeQuote = quotations.find((q) => q.projectId === project.id && !q.deletedAt) ||
    quotations.find((q) => q.id === project.activeQuotationId);

  const contractSellingPriceExVat = round2(
    project.clientContractPO?.contractValue ||
    activeQuote?.totals?.customerSellingPrice ||
    project.contractValue ||
    project.budget ||
    0
  );

  // 2. PO Committed Costs (Ex VAT)
  const linkedPOs = purchaseOrders.filter((po) => po.projectId === project.id && !po.deletedAt);
  const totalPOCommittedExVat = round2(
    linkedPOs.reduce((sum, po) => {
      // Deduct 15% VAT if grandTotal has VAT
      const poNet = (po.subtotal && po.subtotal > 0) 
        ? po.subtotal 
        : (po.grandTotal ? po.grandTotal / 1.15 : 0);
      return sum + poNet;
    }, 0)
  );

  // 3. Incurred Costs Log (Site expenses, labor, transport, testing, subcontractors)
  const projectCosts = incurredCosts.length > 0 
    ? incurredCosts.filter((c) => c.projectId === project.id)
    : (project.incurredCosts || []);

  const totalIncurredCostsExVat = round2(
    projectCosts.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0)
  );

  // 4. Total Actual Costs
  const totalActualCostsExVat = round2(totalPOCommittedExVat + totalIncurredCostsExVat);

  // 5. Actual Profit and Margin
  const actualProfitAmount = round2(contractSellingPriceExVat - totalActualCostsExVat);
  const actualProfitMarginPercent = round2(
    contractSellingPriceExVat > 0 
      ? (actualProfitAmount / contractSellingPriceExVat) * 100 
      : 0
  );

  // 6. Planned Profit from active quote
  const rawPlannedProfit = activeQuote?.totals?.grossProfit || (contractSellingPriceExVat * 0.25);
  const plannedProfitAmount = round2(rawPlannedProfit);
  const plannedProfitMarginPercent = round2(activeQuote?.totals?.grossMarginPercent || 25);
  const plannedCosts = round2(contractSellingPriceExVat - plannedProfitAmount);

  // 7. Cost Variance
  const costVarianceAmount = round2(totalActualCostsExVat - plannedCosts);

  let healthStatus: 'healthy' | 'caution' | 'critical' = 'healthy';
  if (actualProfitMarginPercent < 10 && actualProfitMarginPercent >= 0) {
    healthStatus = 'caution';
  } else if (actualProfitMarginPercent < 0) {
    healthStatus = 'critical';
  }

  return {
    contractSellingPriceExVat,
    totalPOCommittedExVat,
    totalIncurredCostsExVat,
    totalActualCostsExVat,
    actualProfitAmount,
    actualProfitMarginPercent,
    plannedProfitAmount,
    plannedProfitMarginPercent,
    costVarianceAmount,
    healthStatus,
  };
}
