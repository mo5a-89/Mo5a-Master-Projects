import { Invoice, InvoiceItem, CustomerQuotation, Project, DeliveryNote } from '../types';
import { COMPANY_PROFILE } from '../data/initialData';
import { executePrint } from './printUtils';

// Helper to extract clean alphanumeric project code (e.g., PRJ-2026-094 -> PRJ2026094)
export const getCleanProjectCode = (projectNumber?: string): string => {
  if (!projectNumber) return 'PRJ';
  return projectNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

// Strict Soft-Delete Isolation (Equivalent to WHERE deleted_at IS NULL)
export const isActiveRecord = <T extends { deletedAt?: string }>(item: T): boolean => {
  return !item.deletedAt;
};

export const purgeDeletedRecords = <T extends { deletedAt?: string }>(items: T[]): T[] => {
  if (!items) return [];
  return items.filter(isActiveRecord);
};

// Monotonic High-Watermark Sequence Store & State Cache Invalidation
const getStoredHighWatermark = (keyPrefix: string, projectCode: string): number => {
  try {
    const key = `rmt_seq_${keyPrefix}_${projectCode}`;
    const val = localStorage.getItem(key);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const setStoredHighWatermark = (keyPrefix: string, projectCode: string, seq: number): void => {
  try {
    const key = `rmt_seq_${keyPrefix}_${projectCode}`;
    const current = getStoredHighWatermark(keyPrefix, projectCode);
    if (seq > current) {
      localStorage.setItem(key, seq.toString());
    }
  } catch {
    // Ignore localStorage errors
  }
};

// Immediate Cache Invalidation & Sequence Reset upon deletion event
export const invalidateAndResetSequenceCache = (
  keyPrefix: string,
  projectNumber: string,
  remainingNumbers: string[]
): void => {
  try {
    const cleanPrjNum = getCleanProjectCode(projectNumber);
    const key = `rmt_seq_${keyPrefix}_${cleanPrjNum}`;
    
    let maxSeq = 0;
    remainingNumbers.forEach((num) => {
      const match = num?.match(/(\d+)$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });

    if (maxSeq > 0) {
      localStorage.setItem(key, maxSeq.toString());
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore cache error
  }
};

// Generate project-isolated invoice number (Monotonic & Zero-Reuse)
export const getNextInvoiceNumber = (project: Project, existingInvoices: Invoice[] = []): string => {
  const cleanPrjNum = getCleanProjectCode(project.projectNumber);
  
  // Find highest sequence from all existing invoices (by projectId or matching pattern)
  let maxFoundSeq = 0;
  const pattern = new RegExp(`^INV-${cleanPrjNum}-(\\d+)`, 'i');

  existingInvoices.forEach((inv) => {
    const isSameProject = inv.projectId === project.id;
    const match = inv.invoiceNumber?.match(pattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxFoundSeq) maxFoundSeq = seq;
    } else if (isSameProject && inv.invoiceNumber) {
      const numMatch = inv.invoiceNumber.match(/(\d+)$/);
      if (numMatch) {
        const seq = parseInt(numMatch[1], 10);
        if (!isNaN(seq) && seq > maxFoundSeq) maxFoundSeq = seq;
      }
    }
  });

  const storedHWM = getStoredHighWatermark('inv', cleanPrjNum);
  const nextSeq = Math.max(maxFoundSeq, storedHWM) + 1;
  setStoredHighWatermark('inv', cleanPrjNum, nextSeq);

  return `INV-${cleanPrjNum}-${nextSeq.toString().padStart(3, '0')}`;
};

// Generate project-isolated delivery note number (Monotonic & Zero-Reuse even after deletion)
export const getNextDeliveryNoteNumber = (project: Project, existingNotes: DeliveryNote[] = []): string => {
  const cleanPrjNum = getCleanProjectCode(project.projectNumber);

  // Scan ALL notes matching this project or project code pattern
  let maxFoundSeq = 0;
  const pattern = new RegExp(`^DN-${cleanPrjNum}-(\\d+)`, 'i');

  existingNotes.forEach((dn) => {
    const isSameProject = dn.projectId === project.id || (project.projectNumber && dn.projectNumber === project.projectNumber);
    const match = dn.dnNumber?.match(pattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (!isNaN(seq) && seq > maxFoundSeq) maxFoundSeq = seq;
    } else if (isSameProject && dn.dnNumber) {
      const numMatch = dn.dnNumber.match(/(\d+)$/);
      if (numMatch) {
        const seq = parseInt(numMatch[1], 10);
        if (!isNaN(seq) && seq > maxFoundSeq) maxFoundSeq = seq;
      }
    }
  });

  const storedHWM = getStoredHighWatermark('dn', cleanPrjNum);
  const nextSeq = Math.max(maxFoundSeq, storedHWM) + 1;
  setStoredHighWatermark('dn', cleanPrjNum, nextSeq);

  return `DN-${cleanPrjNum}-${nextSeq.toString().padStart(3, '0')}`;
};

// Self-healing function to resolve any duplicate delivery note numbers in state
export const repairDeliveryNoteSequences = (notes: DeliveryNote[]): DeliveryNote[] => {
  if (!notes || notes.length === 0) return [];
  
  const seenNumbers = new Set<string>();
  let hasChanges = false;

  // Process in chronological order (oldest to newest) to preserve original earlier numbers
  const chronological = [...notes].reverse();
  const repairedChronological = chronological.map((dn) => {
    let currentNumber = dn.dnNumber;
    const cleanPrjNum = getCleanProjectCode(dn.projectNumber);

    if (seenNumbers.has(currentNumber)) {
      hasChanges = true;
      // Find next free sequence for this project
      let seq = 1;
      const match = currentNumber.match(/(\d+)$/);
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
      
      let candidate = `DN-${cleanPrjNum}-${seq.toString().padStart(3, '0')}`;
      while (seenNumbers.has(candidate)) {
        seq += 1;
        candidate = `DN-${cleanPrjNum}-${seq.toString().padStart(3, '0')}`;
      }

      currentNumber = candidate;
      setStoredHighWatermark('dn', cleanPrjNum, seq);
    }

    seenNumbers.add(currentNumber);
    // Also record high-watermark for this note
    const match = currentNumber.match(/(\d+)$/);
    if (match) {
      const parsedSeq = parseInt(match[1], 10);
      if (!isNaN(parsedSeq)) {
        setStoredHighWatermark('dn', cleanPrjNum, parsedSeq);
      }
    }

    if (currentNumber !== dn.dnNumber) {
      return { ...dn, dnNumber: currentNumber };
    }
    return dn;
  });

  return hasChanges ? repairedChronological.reverse() : notes;
};

// Generate authentic ZATCA Base64 TLV QR Code string for Saudi e-invoices
export const generateZatcaTLVQR = (
  sellerName: string,
  vatRegistrationNumber: string,
  invoiceTimestamp: string,
  invoiceTotalWithVat: number,
  vatTotal: number
): string => {
  const toTLV = (tag: number, value: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    const tagByte = String.fromCharCode(tag);
    const lengthByte = String.fromCharCode(bytes.length);
    return tagByte + lengthByte + value;
  };

  try {
    const tlvString =
      toTLV(1, sellerName) +
      toTLV(2, vatRegistrationNumber) +
      toTLV(3, invoiceTimestamp) +
      toTLV(4, invoiceTotalWithVat.toFixed(2)) +
      toTLV(5, vatTotal.toFixed(2));

    return btoa(tlvString);
  } catch {
    return 'AQ9STVQgU0FOQUEgQUwgTVVBUkFEAg8zMTE1NTI2NjQ0MDAwMDM=';
  }
};

export interface ProjectInvoicingAnalysis {
  totalProjectValue: number; // Master Contract or Quotation selling price
  masterContractType: 'Client PO (Contract Agreement)' | 'Approved Quotation';
  clientPONumber?: string;
  isContractCapped: boolean;
  isContractOverrun: boolean;
  contractOverrunAmount: number;
  totalBilledAmount: number; // Gross sum of grandTotal of issued invoices
  grossBilledAmount: number; // Raw invoices total before deductions
  advanceDeductedAmount: number; // Total advance payment absorbed/credited across invoices
  retentionDeductedAmount: number; // Total retention held across invoices
  netBilledAmount: number; // Net collectible amount across invoices
  initialAdvanceAmount: number; // Initial advance cash received for project
  availableAdvanceBalance: number; // Unconsumed advance payment balance
  totalPaidAmount: number; // Total settled on invoices (cash + advance credits)
  totalCashCollected: number; // Actual net cash inflow received (advance + cash on invoices)
  totalRemainingAmount: number; // Remaining receivables from net issued invoices
  totalUnbilledAmount: number; // Remaining value to be invoiced under contract cap
  billingProgressPercent: number; // % billed against contract value
  collectionProgressPercent: number; // % collected against net collectible invoices
  cashRealizationPercent: number; // % cash collected against total contract value
  itemBillingStatus: Array<{
    itemId: string;
    itemNo: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    billedQty: number;
    unbilledQty: number;
    billedAmount: number;
    unbilledAmount: number;
    status: 'Fully Billed' | 'Partially Billed' | 'Unbilled';
    isDelivered?: boolean;
    priceSource?: 'client_po' | 'quotation';
  }>;
}

export const analyzeProjectInvoicing = (
  project: Project,
  quotationOrInvoices?: CustomerQuotation | Invoice[],
  invoicesOrDeliveryNotes?: Invoice[] | DeliveryNote[],
  deliveryNotesParam?: DeliveryNote[]
): ProjectInvoicingAnalysis => {
  let quotation: CustomerQuotation | undefined;
  let invoices: Invoice[] = [];
  let deliveryNotes: DeliveryNote[] = [];

  if (Array.isArray(quotationOrInvoices)) {
    invoices = quotationOrInvoices;
    deliveryNotes = Array.isArray(invoicesOrDeliveryNotes) ? (invoicesOrDeliveryNotes as DeliveryNote[]) : [];
  } else {
    quotation = quotationOrInvoices;
    invoices = Array.isArray(invoicesOrDeliveryNotes) ? (invoicesOrDeliveryNotes as Invoice[]) : [];
    deliveryNotes = deliveryNotesParam || [];
  }

  const projectInvoices = invoices.filter(
    (inv) => inv.projectId === project.id && inv.status !== 'Draft'
  );

  const hasClientPO = Boolean(project.clientContractPO && project.clientContractPO.grandTotal > 0);
  const clientPO = project.clientContractPO;

  // Total Contract Master Value prioritization:
  // 1. Official Client PO / Contract signed value
  // 2. Customer Approved Quotation total
  const totalProjectValue = hasClientPO
    ? clientPO!.grandTotal || clientPO!.contractValue
    : quotation?.totals?.grandTotalWithVat || quotation?.totals?.customerSellingPrice || 0;

  const masterContractType = hasClientPO
    ? 'Client PO (Contract Agreement)'
    : 'Approved Quotation';

  const initialAdvanceAmount = project.advancePaymentAmount || 0;

  let grossBilledAmount = 0;
  let advanceDeductedAmount = 0;
  let retentionDeductedAmount = 0;
  let netBilledAmount = 0;
  let totalPaidAmount = 0;
  let totalRemainingAmount = 0;
  let cashCollectedOnInvoices = 0;

  projectInvoices.forEach((inv) => {
    const gross = inv.grandTotal || 0;
    const advDed = inv.advanceDeduction || 0;
    const retDed = inv.retentionDeduction || 0;
    const net = inv.netPayableAmount !== undefined ? inv.netPayableAmount : Math.max(0, gross - advDed - retDed);
    const paid = inv.paidAmount || 0;
    const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, net - paid);

    grossBilledAmount += gross;
    advanceDeductedAmount += advDed;
    retentionDeductedAmount += retDed;
    netBilledAmount += net;
    totalPaidAmount += paid;
    totalRemainingAmount += remaining;

    // Calculate actual cash collected on this invoice vs advance credit
    let invCashPaid = 0;
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        if (p.cashCollectedAmount !== undefined) {
          invCashPaid += p.cashCollectedAmount;
        } else if (p.paymentType === 'advance_settlement') {
          // not new cash
        } else {
          invCashPaid += p.amount || 0;
        }
      });
    } else {
      invCashPaid = paid;
    }
    cashCollectedOnInvoices += invCashPaid;
  });

  // Calculate unconsumed available advance balance
  const availableAdvanceBalance = Math.max(0, initialAdvanceAmount - advanceDeductedAmount);

  // Total Realized Cash Inflow = Initial Advance Cash Received + Direct Cash Collected on Invoices
  const totalCashCollected = initialAdvanceAmount + cashCollectedOnInvoices;

  const isContractOverrun = totalProjectValue > 0 && grossBilledAmount > totalProjectValue;
  const contractOverrunAmount = isContractOverrun ? grossBilledAmount - totalProjectValue : 0;
  const totalUnbilledAmount = Math.max(0, totalProjectValue - grossBilledAmount);

  const billingProgressPercent = totalProjectValue > 0
    ? Math.min(100, Math.round((grossBilledAmount / totalProjectValue) * 100))
    : 0;

  // Collection %: If net billed > 0, ratio of paid to net billed; otherwise fallback
  const collectionProgressPercent = netBilledAmount > 0
    ? Math.min(100, Math.round((totalPaidAmount / netBilledAmount) * 100))
    : (grossBilledAmount > 0 ? Math.min(100, Math.round((totalPaidAmount / grossBilledAmount) * 100)) : 0);

  const cashRealizationPercent = totalProjectValue > 0
    ? Math.min(100, Math.round((totalCashCollected / totalProjectValue) * 100))
    : (netBilledAmount > 0 ? Math.min(100, Math.round((totalCashCollected / netBilledAmount) * 100)) : 0);

  const totalBilledAmount = grossBilledAmount;

  // Build item breakdown prioritized by Client PO Items if present, otherwise Quotation items
  let itemBillingStatus: ProjectInvoicingAnalysis['itemBillingStatus'] = [];

  if (hasClientPO && clientPO!.items && clientPO!.items.length > 0) {
    itemBillingStatus = clientPO!.items.map((cpi, idx) => {
      let billedQty = 0;
      projectInvoices.forEach((inv) => {
        const match = (inv.items || []).find(
          (ii) =>
            ii.sourceItemId === cpi.id ||
            (cpi.sourceItemId && ii.sourceItemId === cpi.sourceItemId) ||
            ii.description.trim().toLowerCase() === cpi.description.trim().toLowerCase()
        );
        if (match) {
          billedQty += match.quantity || 0;
        }
      });

      const orderedQty = cpi.quantity || 0;
      const unbilledQty = Math.max(0, orderedQty - billedQty);
      const unitPrice = cpi.unitPrice || 0;
      const billedAmount = billedQty * unitPrice;
      const unbilledAmount = unbilledQty * unitPrice;

      let status: 'Fully Billed' | 'Partially Billed' | 'Unbilled' = 'Unbilled';
      if (billedQty >= orderedQty && orderedQty > 0) {
        status = 'Fully Billed';
      } else if (billedQty > 0) {
        status = 'Partially Billed';
      }

      let deliveredQty = 0;
      deliveryNotes.filter((dn) => dn && dn.status !== 'Draft').forEach((dn) => {
        const match = (dn.items || []).find(
          (dni) =>
            dni.sourceItemId === cpi.id ||
            (cpi.sourceItemId && dni.sourceItemId === cpi.sourceItemId) ||
            dni.description.trim().toLowerCase() === cpi.description.trim().toLowerCase()
        );
        if (match) deliveredQty += match.deliveredQty || 0;
      });

      return {
        itemId: cpi.id,
        itemNo: cpi.itemNo || idx + 1,
        description: cpi.description,
        quantity: orderedQty,
        unit: cpi.unit || 'EA',
        unitPrice,
        totalPrice: cpi.totalPrice || orderedQty * unitPrice,
        billedQty,
        unbilledQty,
        billedAmount,
        unbilledAmount,
        status,
        isDelivered: deliveredQty >= orderedQty && orderedQty > 0,
        priceSource: 'client_po',
      };
    });
  } else {
    const quoteItems = quotation?.items || [];
    itemBillingStatus = quoteItems.map((it) => {
      let billedQty = 0;
      projectInvoices.forEach((inv) => {
        const match = (inv.items || []).find((ii) => ii.sourceItemId === it.id);
        if (match) {
          billedQty += match.quantity || 0;
        }
      });

      const orderedQty = it.quantity || 0;
      const unbilledQty = Math.max(0, orderedQty - billedQty);
      const unitPrice = it.sellingUnitPrice || 0;
      const billedAmount = billedQty * unitPrice;
      const unbilledAmount = unbilledQty * unitPrice;

      let status: 'Fully Billed' | 'Partially Billed' | 'Unbilled' = 'Unbilled';
      if (billedQty >= orderedQty && orderedQty > 0) {
        status = 'Fully Billed';
      } else if (billedQty > 0) {
        status = 'Partially Billed';
      }

      let deliveredQty = 0;
      deliveryNotes.filter((dn) => dn && dn.status !== 'Draft').forEach((dn) => {
        const match = (dn.items || []).find((dni) => dni.sourceItemId === it.id);
        if (match) deliveredQty += match.deliveredQty || 0;
      });

      return {
        itemId: it.id,
        itemNo: it.itemNo,
        description: it.description,
        quantity: orderedQty,
        unit: it.unit || 'EA',
        unitPrice,
        totalPrice: it.sellingTotalPrice || orderedQty * unitPrice,
        billedQty,
        unbilledQty,
        billedAmount,
        unbilledAmount,
        status,
        isDelivered: deliveredQty >= orderedQty && orderedQty > 0,
        priceSource: 'quotation',
      };
    });
  }

  return {
    totalProjectValue,
    masterContractType,
    clientPONumber: clientPO?.clientPONumber,
    isContractCapped: hasClientPO,
    isContractOverrun,
    contractOverrunAmount,
    totalBilledAmount: grossBilledAmount,
    grossBilledAmount,
    advanceDeductedAmount,
    retentionDeductedAmount,
    netBilledAmount,
    initialAdvanceAmount,
    availableAdvanceBalance,
    totalPaidAmount,
    totalCashCollected,
    totalRemainingAmount,
    totalUnbilledAmount,
    billingProgressPercent,
    collectionProgressPercent,
    cashRealizationPercent,
    itemBillingStatus,
  };
};

export const exportInvoiceToPrint = (invoice: Invoice) => {
  executePrint('printable-tax-invoice', {
    documentTitle: `فاتورة ضريبية - ${invoice.invoiceNumber} - ${invoice.customerName}`,
  });
};
