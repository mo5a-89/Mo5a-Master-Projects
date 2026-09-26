import { CustomerQuotation, SupplierQuotation, Project, PricedItemRecord } from '../types';

const ARCHIVED_PRICED_ITEMS_KEY = 'rmt_archived_priced_items';

/**
 * Load archived priced items from localStorage
 */
export const loadArchivedPricedItems = (): PricedItemRecord[] => {
  try {
    const raw = localStorage.getItem(ARCHIVED_PRICED_ITEMS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load archived priced items:', err);
  }
  return [];
};

/**
 * Save archived priced items to localStorage
 */
export const saveArchivedPricedItems = (items: PricedItemRecord[]): void => {
  try {
    localStorage.setItem(ARCHIVED_PRICED_ITEMS_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save archived priced items:', err);
  }
};

/**
 * Extract priced items from a Customer Quotation before deletion
 */
export const archiveItemsFromCustomerQuotation = (
  quotation: CustomerQuotation,
  project?: Project
): PricedItemRecord[] => {
  const dateStr = quotation.date || new Date().toISOString().split('T')[0];
  const projectName = project?.name || quotation.projectName || 'مشروع غير محدد';
  const clientName = project?.customerName || quotation.clientName || 'عميل غير محدد';

  return (quotation.items || []).map((it, idx) => {
    const cost = it.supplierUnitPrice || 0;
    const sell = it.sellingUnitPrice || cost;
    const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;

    return {
      id: `archived-cq-${quotation.id}-${it.id || idx}-${Date.now()}`,
      sourceItemId: it.id || `cq-item-${idx}`,
      itemNo: it.itemNo || idx + 1,
      description: it.description,
      quantity: it.quantity || 1,
      unit: it.unit || 'EA',
      system: it.system,
      supplierUnitPrice: cost,
      supplierTotalPrice: it.supplierTotalPrice || cost * (it.quantity || 1),
      customerUnitPrice: sell,
      customerTotalPrice: it.sellingTotalPrice || sell * (it.quantity || 1),
      marginPercent: margin,
      supplierName: (it as any).supplierName || 'مورد معتمد',
      supplierQuoteNo: quotation.quotationNumber,
      projectId: quotation.projectId,
      projectName,
      projectCode: project?.projectNumber,
      clientName,
      quotationId: quotation.id,
      quotationNumber: quotation.quotationNumber,
      pricingDate: dateStr,
      sourceType: 'archived_deleted_quotation',
      status: 'archived',
      notes: it.notes || 'صنف محفوظ من عرض سعر عميل محذوف',
      deletedAt: new Date().toISOString(),
    };
  });
};

/**
 * Extract priced items from a Supplier Quotation before deletion
 */
export const archiveItemsFromSupplierQuotation = (
  sq: SupplierQuotation,
  project?: Project
): PricedItemRecord[] => {
  const dateStr = sq.date || new Date().toISOString().split('T')[0];
  const projectName = project?.name || 'مشروع غير محدد';

  return (sq.items || []).map((it, idx) => {
    const cost = it.supplierUnitPrice || 0;
    const sell = it.sellingUnitPrice || cost;

    return {
      id: `archived-sq-${sq.id}-${it.id || idx}-${Date.now()}`,
      sourceItemId: it.id || `sq-item-${idx}`,
      itemNo: it.itemNo || idx + 1,
      description: it.description,
      quantity: it.quantity || 1,
      unit: it.unit || 'EA',
      system: it.system || sq.systemType,
      supplierUnitPrice: cost,
      supplierTotalPrice: it.supplierTotalPrice || cost * (it.quantity || 1),
      customerUnitPrice: sell,
      customerTotalPrice: it.sellingTotalPrice || sell * (it.quantity || 1),
      marginPercent: 0,
      supplierName: sq.supplierName,
      supplierQuoteNo: sq.quotationNumber,
      projectId: sq.projectId,
      projectName,
      projectCode: project?.projectNumber,
      clientName: project?.customerName,
      quotationId: sq.id,
      quotationNumber: sq.quotationNumber,
      pricingDate: dateStr,
      sourceType: 'archived_deleted_quotation',
      status: 'archived',
      notes: it.notes || `تسعيرة مورد أصلية: ${sq.supplierName}`,
      deletedAt: new Date().toISOString(),
    };
  });
};

/**
 * Consolidate all priced items (Active from current quotes + Archived from deleted quotes)
 * into a single unified library for fast searching and price lookup.
 */
export const getAllPricedItems = (
  customerQuotations: CustomerQuotation[] = [],
  supplierQuotations: SupplierQuotation[] = [],
  projects: Project[] = [],
  archivedItems: PricedItemRecord[] = []
): PricedItemRecord[] => {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const list: PricedItemRecord[] = [];

  // 1. Items from active Customer Quotations
  customerQuotations.forEach((q) => {
    const proj = projectMap.get(q.projectId);
    const projectName = proj?.name || q.projectName || 'مشروع';
    const clientName = proj?.customerName || q.clientName || 'عميل';

    (q.items || []).forEach((it, idx) => {
      const cost = it.supplierUnitPrice || 0;
      const sell = it.sellingUnitPrice || cost;
      const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;

      list.push({
        id: `active-cq-${q.id}-${it.id || idx}`,
        sourceItemId: it.id || `it-${idx}`,
        itemNo: it.itemNo || idx + 1,
        description: it.description,
        quantity: it.quantity || 1,
        unit: it.unit || 'EA',
        system: it.system,
        supplierUnitPrice: cost,
        supplierTotalPrice: it.supplierTotalPrice || cost * (it.quantity || 1),
        customerUnitPrice: sell,
        customerTotalPrice: it.sellingTotalPrice || sell * (it.quantity || 1),
        marginPercent: margin,
        supplierName: (it as any).supplierName || 'مورد معتمد',
        supplierQuoteNo: q.quotationNumber,
        projectId: q.projectId,
        projectName,
        projectCode: proj?.projectNumber,
        clientName,
        quotationId: q.id,
        quotationNumber: q.quotationNumber,
        pricingDate: q.date,
        sourceType: 'customer_quotation',
        status: 'active',
        notes: it.notes,
      });
    });
  });

  // 2. Items from active Supplier Quotations (if not duplicate of quote items)
  supplierQuotations.forEach((sq) => {
    const proj = projectMap.get(sq.projectId);
    const projectName = proj?.name || 'مشروع';

    (sq.items || []).forEach((it, idx) => {
      list.push({
        id: `active-sq-${sq.id}-${it.id || idx}`,
        sourceItemId: it.id || `sq-it-${idx}`,
        itemNo: it.itemNo || idx + 1,
        description: it.description,
        quantity: it.quantity || 1,
        unit: it.unit || 'EA',
        system: it.system || sq.systemType,
        supplierUnitPrice: it.supplierUnitPrice || 0,
        supplierTotalPrice: it.supplierTotalPrice || (it.supplierUnitPrice || 0) * (it.quantity || 1),
        customerUnitPrice: it.sellingUnitPrice || it.supplierUnitPrice || 0,
        customerTotalPrice: it.sellingTotalPrice || 0,
        marginPercent: 0,
        supplierName: sq.supplierName,
        supplierQuoteNo: sq.quotationNumber,
        projectId: sq.projectId,
        projectName,
        projectCode: proj?.projectNumber,
        clientName: proj?.customerName,
        quotationId: sq.id,
        quotationNumber: sq.quotationNumber,
        pricingDate: sq.date,
        sourceType: 'supplier_quotation',
        status: 'active',
        notes: `تسعيرة مورد أصلية: ${sq.supplierName}`,
      });
    });
  });

  // 3. Add all archived items (items from deleted quotations)
  archivedItems.forEach((it) => {
    list.push(it);
  });

  return list;
};
