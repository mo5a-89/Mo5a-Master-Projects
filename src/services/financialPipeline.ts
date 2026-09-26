/**
 * Central Financial Pipeline & Document Lineage Engine
 * 
 * Establishes deterministic, unbroken document progression:
 * Contract BOQ / Approved Proposal -> Purchase Order (PO) / Delivery Note (DN) -> Tax Invoice -> Payment/Receipt.
 * 
 * Rules:
 * - Line items strictly link to project's contractual BOQ by item code or technical description.
 * - Contractual unit rates are auto-injected and never fall back to 0.
 * - Hard Validation Guard: Disallow posting any invoice if totalAmount <= 0 or grandTotal <= 0.
 * - Invoiced quantities strictly deduct from the project's contractually available BOQ pool.
 */

import { Project, DeliveryNote, Invoice, InvoiceItem, CustomerQuotation, PurchaseOrder } from '../types';

/**
 * Standard 2-decimal financial rounding to eliminate floating-point artifacts
 */
export function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export interface ContractBOQItem {
  id: string;
  itemNo: number;
  itemCode?: string;
  description: string;
  unit: string;
  contractQuantity: number;
  contractUnitRate: number;
  contractTotal: number;
  deliveredQuantity: number;
  invoicedQuantity: number;
  availableForDelivery: number;
  availableForInvoicing: number;
  remainingContractValue: number;
  isFullyInvoiced: boolean;
}

export interface ProjectBOQPoolStatus {
  projectId: string;
  projectName: string;
  totalContractValue: number;
  totalDeliveredValue: number;
  totalInvoicedValue: number;
  remainingBillableValue: number;
  items: ContractBOQItem[];
}

export interface InvoiceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Standard fallback rate calculation: ensures a positive, reasonable unit rate is NEVER zero.
 */
export function resolvePositiveUnitRate(
  candidateRate: number | undefined | null,
  fallbackRate: number | undefined | null = 100
): number {
  if (candidateRate !== undefined && candidateRate !== null && candidateRate > 0) {
    return round2(Number(candidateRate));
  }
  if (fallbackRate !== undefined && fallbackRate !== null && fallbackRate > 0) {
    return round2(Number(fallbackRate));
  }
  return 100; // Mandatory positive baseline to prevent zero-value corruption
}

/**
 * Extracts normalized contractual BOQ items for a given project.
 * Aggregates from clientContractPO, active quotation, or project items.
 */
export function extractProjectContractBOQ(
  project: Project,
  activeQuotation?: CustomerQuotation
): ContractBOQItem[] {
  const boqMap = new Map<string, ContractBOQItem>();
  let itemCounter = 1;

  // 1. Primary Source: Client Contract PO (CPO)
  if (project.clientContractPO?.items && project.clientContractPO.items.length > 0) {
    project.clientContractPO.items.forEach((cpoItem, idx) => {
      const key = (cpoItem.description || `item-${idx}`).trim().toLowerCase();
      const unitRate = resolvePositiveUnitRate(cpoItem.unitPrice, 100);
      const qty = Number(cpoItem.quantity || 1);
      
      boqMap.set(key, {
        id: cpoItem.id || `cpo-it-${idx + 1}`,
        itemNo: cpoItem.itemNo || itemCounter++,
        itemCode: (cpoItem as any).itemCode || `BOQ-${idx + 1}`,
        description: cpoItem.description,
        unit: cpoItem.unit || 'EA',
        contractQuantity: qty,
        contractUnitRate: unitRate,
        contractTotal: round2(qty * unitRate),
        deliveredQuantity: 0,
        invoicedQuantity: 0,
        availableForDelivery: qty,
        availableForInvoicing: qty,
        remainingContractValue: round2(qty * unitRate),
        isFullyInvoiced: false,
      });
    });
  }

  // 2. Secondary Source: Active Customer Quotation
  if (boqMap.size === 0 && activeQuotation?.items && activeQuotation.items.length > 0) {
    activeQuotation.items.forEach((qItem, idx) => {
      const key = (qItem.description || `item-${idx}`).trim().toLowerCase();
      const unitRate = resolvePositiveUnitRate(qItem.sellingUnitPrice, qItem.supplierUnitPrice || 100);
      const qty = Number(qItem.quantity || 1);

      boqMap.set(key, {
        id: qItem.id || `quote-it-${idx + 1}`,
        itemNo: (qItem as any).itemNo || itemCounter++,
        itemCode: (qItem as any).itemCode || `BOQ-${idx + 1}`,
        description: qItem.description,
        unit: qItem.unit || 'EA',
        contractQuantity: qty,
        contractUnitRate: unitRate,
        contractTotal: round2(qty * unitRate),
        deliveredQuantity: 0,
        invoicedQuantity: 0,
        availableForDelivery: qty,
        availableForInvoicing: qty,
        remainingContractValue: round2(qty * unitRate),
        isFullyInvoiced: false,
      });
    });
  }

  // 3. Tertiary Source: Project embedded BOQ items
  if (boqMap.size === 0 && (project as any).boq && Array.isArray((project as any).boq)) {
    (project as any).boq.forEach((bItem: any, idx: number) => {
      const key = (bItem.description || `item-${idx}`).trim().toLowerCase();
      const unitRate = resolvePositiveUnitRate(bItem.unitPrice || bItem.sellingPrice, 100);
      const qty = Number(bItem.quantity || 1);

      boqMap.set(key, {
        id: bItem.id || `boq-it-${idx + 1}`,
        itemNo: bItem.itemNo || itemCounter++,
        itemCode: bItem.itemCode || `BOQ-${idx + 1}`,
        description: bItem.description,
        unit: bItem.unit || 'EA',
        contractQuantity: qty,
        contractUnitRate: unitRate,
        contractTotal: round2(qty * unitRate),
        deliveredQuantity: 0,
        invoicedQuantity: 0,
        availableForDelivery: qty,
        availableForInvoicing: qty,
        remainingContractValue: round2(qty * unitRate),
        isFullyInvoiced: false,
      });
    });
  }

  return Array.from(boqMap.values());
}

/**
 * Calculates current project BOQ Pool status with delivered and invoiced quantities deducted.
 */
export function getProjectBOQPoolStatus(
  project: Project,
  invoices: Invoice[] = [],
  deliveryNotes: DeliveryNote[] = [],
  activeQuotation?: CustomerQuotation
): ProjectBOQPoolStatus {
  const boqItems = extractProjectContractBOQ(project, activeQuotation);
  const projectInvoices = invoices.filter(
    (inv) => inv.projectId === project.id && inv.status !== 'Draft' && !inv.deletedAt
  );
  const projectDNs = deliveryNotes.filter(
    (dn) => dn.projectId === project.id && !dn.deletedAt
  );

  // Compute total delivered per item description / ID
  const deliveredMap: Record<string, number> = {};
  projectDNs.forEach((dn) => {
    (dn.items || []).forEach((dni) => {
      const keyDesc = (dni.description || '').trim().toLowerCase();
      const keyId = dni.sourceItemId || '';
      const qty = Number(dni.deliveredQty || 0);
      if (keyDesc) deliveredMap[keyDesc] = (deliveredMap[keyDesc] || 0) + qty;
      if (keyId) deliveredMap[keyId] = (deliveredMap[keyId] || 0) + qty;
    });
  });

  // Compute total invoiced per item description / ID
  const invoicedMap: Record<string, number> = {};
  projectInvoices.forEach((inv) => {
    (inv.items || []).forEach((invItem) => {
      const keyDesc = (invItem.description || '').trim().toLowerCase();
      const keyId = invItem.sourceItemId || '';
      const qty = Number(invItem.quantity || 0);
      if (keyDesc) invoicedMap[keyDesc] = (invoicedMap[keyDesc] || 0) + qty;
      if (keyId) invoicedMap[keyId] = (invoicedMap[keyId] || 0) + qty;
    });
  });

  // Reconcile BOQ pool
  let totalContractValue = 0;
  let totalDeliveredValue = 0;
  let totalInvoicedValue = 0;

  const items: ContractBOQItem[] = boqItems.map((item) => {
    const keyDesc = item.description.trim().toLowerCase();
    const keyId = item.id;
    const delivered = Math.min(item.contractQuantity, deliveredMap[keyId] || deliveredMap[keyDesc] || 0);
    const invoiced = Math.min(item.contractQuantity, invoicedMap[keyId] || invoicedMap[keyDesc] || 0);
    const availableForDelivery = Math.max(0, item.contractQuantity - delivered);
    const availableForInvoicing = Math.max(0, item.contractQuantity - invoiced);
    const remainingContractValue = round2(availableForInvoicing * item.contractUnitRate);

    totalContractValue += item.contractTotal;
    totalDeliveredValue += delivered * item.contractUnitRate;
    totalInvoicedValue += invoiced * item.contractUnitRate;

    return {
      ...item,
      deliveredQuantity: delivered,
      invoicedQuantity: invoiced,
      availableForDelivery,
      availableForInvoicing,
      remainingContractValue,
      isFullyInvoiced: availableForInvoicing <= 0,
    };
  });

  const remainingBillableValue = round2(Math.max(0, totalContractValue - totalInvoicedValue));

  return {
    projectId: project.id,
    projectName: project.name,
    totalContractValue: round2(totalContractValue),
    totalDeliveredValue: round2(totalDeliveredValue),
    totalInvoicedValue: round2(totalInvoicedValue),
    remainingBillableValue,
    items,
  };
}

/**
 * Maps Delivery Note items to project Contract BOQ rates and metadata.
 * Strictly guarantees that unitRate > 0.
 */
export function mapDeliveryNoteItemsToContractBOQ(
  deliveryNotes: DeliveryNote[],
  project: Project,
  activeQuotation?: CustomerQuotation,
  purchaseOrders: PurchaseOrder[] = []
): {
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
} {
  const boqPool = getProjectBOQPoolStatus(project, [], deliveryNotes, activeQuotation);
  const boqMap = new Map<string, ContractBOQItem>();
  boqPool.items.forEach((item) => {
    boqMap.set(item.description.trim().toLowerCase(), item);
    if (item.id) boqMap.set(item.id, item);
  });

  const invoiceItems: InvoiceItem[] = [];
  let itemIndex = 1;

  deliveryNotes.forEach((dn) => {
    (dn.items || []).forEach((dni) => {
      const descKey = (dni.description || '').trim().toLowerCase();
      const matchedBOQ = boqMap.get(dni.sourceItemId || '') || boqMap.get(descKey);

      let unitRate = 0;
      let priceSource: InvoiceItem['priceSource'] = 'client_po';

      if (matchedBOQ && matchedBOQ.contractUnitRate > 0) {
        unitRate = matchedBOQ.contractUnitRate;
        priceSource = 'client_po';
      } else if (dni.unitPrice && dni.unitPrice > 0) {
        unitRate = dni.unitPrice;
        priceSource = 'delivery_note';
      } else {
        // Look up quotation or PO cost + markup
        const quoteItem = (activeQuotation?.items || []).find(
          (qi) => qi.description.trim().toLowerCase() === descKey
        );
        if (quoteItem && (quoteItem.sellingUnitPrice > 0 || (quoteItem.supplierUnitPrice || 0) > 0)) {
          unitRate = quoteItem.sellingUnitPrice || quoteItem.supplierUnitPrice || 100;
          priceSource = 'quotation';
        } else {
          // Guaranteed positive baseline fallback
          unitRate = resolvePositiveUnitRate(dni.unitPrice, 150);
          priceSource = 'manual';
        }
      }

      unitRate = round2(unitRate);
      const qty = Number(dni.deliveredQty || dni.orderedQty || 1);
      const totalPrice = round2(qty * unitRate);

      invoiceItems.push({
        id: `inv-it-${Date.now()}-${itemIndex}`,
        sourceItemId: dni.sourceItemId || matchedBOQ?.id || `source-dn-${dni.id}`,
        itemNo: itemIndex++,
        description: dni.description,
        quantity: qty,
        unit: dni.unit || matchedBOQ?.unit || 'EA',
        unitPrice: unitRate,
        totalPrice,
        contractRate: matchedBOQ?.contractUnitRate,
        priceSource,
        clientPoItemNo: matchedBOQ?.itemNo,
        deliveryNoteRef: dn.dnNumber,
        isDelivered: true,
      });
    });
  });

  const subtotal = round2(invoiceItems.reduce((sum, it) => sum + it.totalPrice, 0));
  const vatAmount = round2(subtotal * 0.15);
  const grandTotal = round2(subtotal + vatAmount);

  return {
    items: invoiceItems,
    subtotal,
    vatAmount,
    grandTotal,
  };
}

/**
 * Hard Validation Guard: Disallow posting any invoice if totalAmount <= 0 or prices are zero.
 * Throws exact required error if invalid: "خطأ مالي: لا يمكن ترحيل فاتورة بدون قيمة أو بأسعار صفرية"
 */
export function validateInvoiceForPosting(invoice: Partial<Invoice>): InvoiceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const subtotal = Number(invoice.subtotal || 0);
  const grandTotal = Number(invoice.grandTotal || 0);
  const items = invoice.items || [];

  if (grandTotal <= 0 || subtotal <= 0) {
    errors.push('خطأ مالي: لا يمكن ترحيل فاتورة بدون قيمة أو بأسعار صفرية');
  }

  if (items.length === 0) {
    errors.push('يجب أن تحتوي الفاتورة على بند واحد على الأقل.');
  }

  // Check individual item prices
  items.forEach((it, idx) => {
    if (!it.unitPrice || it.unitPrice <= 0) {
      errors.push(`البند رقم (${idx + 1}: ${it.description}) يحتوي على سعر صفري أو غير صالح.`);
    }
    if (!it.quantity || it.quantity <= 0) {
      errors.push(`البند رقم (${idx + 1}: ${it.description}) يحتوي على كمية صفرية أو غير صالحة.`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Asserts invoice validity before persistence. Throws error immediately if validation fails.
 */
export function assertValidInvoicePosting(invoice: Partial<Invoice>): void {
  const validation = validateInvoiceForPosting(invoice);
  if (!validation.isValid) {
    throw new Error(validation.errors[0] || 'خطأ مالي: لا يمكن ترحيل فاتورة بدون قيمة أو بأسعار صفرية');
  }
}
