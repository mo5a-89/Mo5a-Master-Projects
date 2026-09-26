import { Project, CostRecord, ProjectPaymentMilestone, ProjectDocument } from '../types';

/**
 * Safely parses and normalizes a retention percentage value.
 * Guards against corrupted strings, template strings, or project IDs inadvertently passed as percentage.
 */
export function getSafeRetentionPercent(val: any, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0 && val <= 100) {
    return Number(val.toFixed(2));
  }
  if (typeof val === 'string') {
    // If string contains '%' or numbers, parse it out, but reject IDs like 'proj-...'
    if (val.trim().startsWith('proj-') || val.trim().startsWith('id-')) {
      return fallback;
    }
    const sanitized = val.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return Number(parsed.toFixed(2));
    }
  }
  return fallback;
}

/**
 * Accurately calculates the withheld retention amount against the total contract value.
 */
export function calculateRetentionFigures(
  contractValue: number,
  retentionPercent: any,
  storedAmount?: any,
  mode: 'percent' | 'fixed' = 'percent'
): { percent: number; amount: number } {
  const safeContract = Math.max(0, Number(contractValue) || 0);
  const safePercent = getSafeRetentionPercent(retentionPercent, 0);

  if (mode === 'fixed' && storedAmount !== undefined) {
    const rawAmt = typeof storedAmount === 'number' ? storedAmount : parseFloat(String(storedAmount));
    if (!isNaN(rawAmt) && isFinite(rawAmt) && rawAmt >= 0) {
      const calcPercent = safeContract > 0 ? Number(((rawAmt / safeContract) * 100).toFixed(2)) : safePercent;
      return { percent: calcPercent, amount: Number(rawAmt.toFixed(2)) };
    }
  }

  const calculatedAmount = Number(((safeContract * safePercent) / 100).toFixed(2));
  return { percent: safePercent, amount: calculatedAmount };
}

/**
 * Thoroughly validates and normalizes a Project object, ensuring NO nested fields
 * (costs, documents, milestones, systems, IDs) are dropped or corrupted.
 */
export function normalizeProject(p: any): Project {
  if (!p || typeof p !== 'object') {
    return {
      id: `proj-${Date.now()}`,
      projectNumber: `PRJ-${Date.now().toString().slice(-4)}`,
      name: 'مشروع جديد',
      customerName: '',
      location: 'المملكة العربية السعودية',
      status: 'In Progress',
      createdAt: new Date().toISOString(),
      budget: 0,
      retentionPercent: 10,
      retentionAmount: 0,
      retentionStatus: 'Held',
      systems: [],
      selectedSystems: [],
      incurredCosts: [],
      documents: [],
      paymentMilestones: [],
      supplierQuotationIds: [],
      customerQuotationIds: [],
      purchaseOrderIds: [],
    };
  }

  const budget = Number(p.budget) || 0;
  const safePercent = getSafeRetentionPercent(p.retentionPercent, 10);
  const { amount: safeAmount } = calculateRetentionFigures(
    budget,
    safePercent,
    p.retentionAmount,
    p.retentionAmount && p.retentionAmount > 0 && !p.retentionPercent ? 'fixed' : 'percent'
  );

  // Normalize systems
  const systems = Array.isArray(p.systems)
    ? p.systems
    : Array.isArray(p.selectedSystems)
    ? p.selectedSystems
    : [];

  // Deep clone and validate incurred costs
  const incurredCosts: CostRecord[] = Array.isArray(p.incurredCosts)
    ? p.incurredCosts.map((c: any) => ({
        id: c.id || `cost-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        category: c.category || 'Materials',
        description: c.description || '',
        amount: Number(c.amount) || 0,
        date: c.date || new Date().toISOString().slice(0, 10),
        supplierId: c.supplierId,
        supplierName: c.supplierName,
        invoiceNumber: c.invoiceNumber,
        notes: c.notes,
      }))
    : [];

  // Deep clone and validate documents
  const documents: ProjectDocument[] = Array.isArray(p.documents)
    ? p.documents.map((d: any) => ({
        id: d.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: d.name || 'مستند',
        type: d.type || 'other',
        uploadDate: d.uploadDate || new Date().toISOString().slice(0, 10),
        size: d.size || 0,
        fileData: d.fileData,
      }))
    : [];

  // Deep clone and validate payment milestones
  const paymentMilestones: ProjectPaymentMilestone[] = Array.isArray(p.paymentMilestones)
    ? p.paymentMilestones.map((m: any) => ({
        id: m.id || `ms-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: m.name || '',
        percentage: Number(m.percentage) || 0,
        amount: Number(m.amount) || 0,
        status: m.status || 'Pending',
        isRetention: Boolean(m.isRetention),
        invoiceId: m.invoiceId,
        paymentDate: m.paymentDate,
        notes: m.notes,
      }))
    : [];

  return {
    ...p,
    id: String(p.id || `proj-${Date.now()}`),
    projectNumber: String(p.projectNumber || p.projectNo || `PRJ-${String(p.id || Date.now()).slice(-4)}`),
    name: String(p.name || ''),
    customerName: String(p.customerName || ''),
    location: String(p.location || 'المملكة العربية السعودية'),
    status: p.status || 'In Progress',
    budget,
    retentionPercent: safePercent,
    retentionAmount: safeAmount,
    retentionStatus:
      p.retentionStatus === 'Released' || p.retentionStatus === 'Due' ? p.retentionStatus : 'Held',
    advancePaymentAmount: p.advancePaymentAmount !== undefined ? Number(p.advancePaymentAmount) : undefined,
    advancePaymentDate: p.advancePaymentDate,
    advancePaymentReceiptNo: p.advancePaymentReceiptNo,
    advancePaymentMethod: p.advancePaymentMethod,
    advancePaymentReferenceNo: p.advancePaymentReferenceNo,
    advancePaymentNotes: p.advancePaymentNotes,
    advancePaymentAttachmentName: p.advancePaymentAttachmentName,
    advancePaymentAttachmentData: p.advancePaymentAttachmentData,
    systems,
    selectedSystems: systems,
    incurredCosts,
    documents,
    paymentMilestones,
    supplierQuotationIds: Array.isArray(p.supplierQuotationIds) ? [...p.supplierQuotationIds] : [],
    customerQuotationIds: Array.isArray(p.customerQuotationIds) ? [...p.customerQuotationIds] : [],
    purchaseOrderIds: Array.isArray(p.purchaseOrderIds) ? [...p.purchaseOrderIds] : [],
    createdAt: p.createdAt || new Date().toISOString(),
  };
}
