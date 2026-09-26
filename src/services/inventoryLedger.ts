import { PurchaseOrder, DeliveryNote, Project, MaterialReceiptRecord } from '../types';

export interface SiteItemStock {
  itemId: string;
  description: string;
  unit: string;
  totalReceived: number; // From vendor receipts & opening balances
  totalDelivered: number; // Delivered to client via approved DNs
  currentPhysicalStock: number; // Available on site
  unitPrice: number;
}

export interface ProjectStockSummary {
  projectId: string;
  projectName: string;
  items: SiteItemStock[];
  totalStockItemsCount: number;
  hasSufficientStock: boolean;
}

export interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  itemShortages: Array<{
    description: string;
    requestedQty: number;
    availableStock: number;
    shortage: number;
  }>;
}

/**
 * Normalizes item descriptions for fuzzy-matching across quotes, POs, receipts, and DNs
 */
function normalizeItemKey(desc: string): string {
  return (desc || '')
    .toLowerCase()
    .replace(/[^\w\d\u0600-\u06FF]/g, '')
    .trim();
}

/**
 * Calculates real-time verified physical stock on site for a given project
 */
export function calculateProjectPhysicalStock(
  projectId: string,
  purchaseOrders: PurchaseOrder[],
  deliveryNotes: DeliveryNote[],
  excludeDeliveryNoteId?: string
): ProjectStockSummary {
  const stockMap: Map<string, SiteItemStock> = new Map();

  // 1. Gather all received quantities from purchase orders for this project
  const projectPOs = purchaseOrders.filter((po) => po.projectId === projectId);

  projectPOs.forEach((po) => {
    // Check direct receipts
    const receipts = po.materialReceipts || [];
    receipts.forEach((rcpt) => {
      const items = rcpt.receivedItems || rcpt.items || [];
      items.forEach((it: any) => {
        const desc = it.description || 'بند مجهول';
        const key = normalizeItemKey(desc);
        const qty = Number(it.receivedQty ?? it.receivedQuantity ?? 0);
        const unit = it.unit || 'EA';
        const price = Number(it.unitPrice || 0);

        if (!stockMap.has(key)) {
          stockMap.set(key, {
            itemId: it.poItemId || key,
            description: desc,
            unit,
            totalReceived: 0,
            totalDelivered: 0,
            currentPhysicalStock: 0,
            unitPrice: price,
          });
        }

        const current = stockMap.get(key)!;
        current.totalReceived += qty;
        current.currentPhysicalStock += qty;
      });
    });

    // Also check item deliveredQty if no detailed receipts were recorded yet
    if (receipts.length === 0 && Array.isArray(po.items)) {
      po.items.forEach((it) => {
        const received = Number(it.deliveredQty || (po.deliveryStatus === 'Delivered' ? it.quantity : 0));
        if (received > 0) {
          const desc = it.description || '';
          const key = normalizeItemKey(desc);
          if (!stockMap.has(key)) {
            stockMap.set(key, {
              itemId: it.id,
              description: desc,
              unit: it.unit || 'EA',
              totalReceived: 0,
              totalDelivered: 0,
              currentPhysicalStock: 0,
              unitPrice: it.unitPrice || 0,
            });
          }
          const current = stockMap.get(key)!;
          current.totalReceived += received;
          current.currentPhysicalStock += received;
        }
      });
    }
  });

  // 2. Deplete verified stock by all active Delivery Notes for this project
  const projectDNs = deliveryNotes.filter(
    (dn) => dn.projectId === projectId && !dn.deletedAt && dn.id !== excludeDeliveryNoteId
  );

  projectDNs.forEach((dn) => {
    (dn.items || []).forEach((item) => {
      const desc = item.description || '';
      const key = normalizeItemKey(desc);
      const deliveredQty = Number(item.deliveredQty || 0);

      if (stockMap.has(key)) {
        const current = stockMap.get(key)!;
        current.totalDelivered += deliveredQty;
        current.currentPhysicalStock = Math.max(0, current.totalReceived - current.totalDelivered);
      } else {
        // Unmatched delivered item without receipt - recorded with 0 received
        stockMap.set(key, {
          itemId: item.sourceItemId || item.id,
          description: desc,
          unit: item.unit || 'EA',
          totalReceived: 0,
          totalDelivered: deliveredQty,
          currentPhysicalStock: 0,
          unitPrice: item.unitPrice || 0,
        });
      }
    });
  });

  const items = Array.from(stockMap.values());
  const hasSufficientStock = items.every((it) => it.currentPhysicalStock >= 0);

  return {
    projectId,
    projectName: projectPOs[0]?.projectName || projectId,
    items,
    totalStockItemsCount: items.length,
    hasSufficientStock,
  };
}

/**
 * Strict Invariant Rule:
 * Validates that requested items in a new/updated Delivery Note do NOT exceed verified physical stock on site.
 */
export function validateDeliveryNoteStock(
  deliveryNote: {
    projectId: string;
    id?: string;
    items: Array<{ description: string; deliveredQty: number; unit?: string }>;
  },
  purchaseOrders: PurchaseOrder[],
  deliveryNotes: DeliveryNote[]
): StockValidationResult {
  const stockSummary = calculateProjectPhysicalStock(
    deliveryNote.projectId,
    purchaseOrders,
    deliveryNotes,
    deliveryNote.id
  );

  const errors: string[] = [];
  const shortages: StockValidationResult['itemShortages'] = [];

  (deliveryNote.items || []).forEach((reqItem) => {
    const requestedQty = Number(reqItem.deliveredQty || 0);
    if (requestedQty <= 0) return;

    const key = normalizeItemKey(reqItem.description);
    const matchedStock = stockSummary.items.find(
      (s) => normalizeItemKey(s.description) === key
    );

    const availableStock = matchedStock ? matchedStock.currentPhysicalStock : 0;

    if (requestedQty > availableStock) {
      const shortage = requestedQty - availableStock;
      shortages.push({
        description: reqItem.description,
        requestedQty,
        availableStock,
        shortage,
      });

      errors.push(
        `الكمية المطلوبة للبند "${reqItem.description.slice(0, 45)}..." (${requestedQty}) تتجاوز الرصيد الفعلي المتوفر بالموقع (${availableStock}). العجز: ${shortage}`
      );
    }
  });

  return {
    isValid: shortages.length === 0,
    errors,
    itemShortages: shortages,
  };
}

/**
 * Site Stock Reconciliation & Auto-Opening Balance Generator
 * Automatically reconciles initial physical stock: If legacy delivery notes (e.g. dn-1)
 * exist without prior vendor receipts (mr-1), generates an auto-balanced system opening balance.
 */
export function reconcileSiteStock(
  projects: Project[],
  purchaseOrders: PurchaseOrder[],
  deliveryNotes: DeliveryNote[]
): {
  reconciledPurchaseOrders: PurchaseOrder[];
  openingBalancesCreated: number;
} {
  let openingBalancesCreated = 0;
  const posCopy: PurchaseOrder[] = JSON.parse(JSON.stringify(purchaseOrders));

  projects.forEach((proj) => {
    const projDNs = deliveryNotes.filter((d) => d.projectId === proj.id && !d.deletedAt);
    if (projDNs.length === 0) return;

    // Find POs for this project
    const projPOs = posCopy.filter((p) => p.projectId === proj.id);
    if (projPOs.length === 0) return;

    const primaryPO = projPOs[0];
    if (!Array.isArray(primaryPO.materialReceipts)) {
      primaryPO.materialReceipts = [];
    }

    // Check if there are any receipts
    const totalReceivedCount = primaryPO.materialReceipts.reduce(
      (sum, r) => sum + (r.receivedItems?.length || r.items?.length || 0),
      0
    );

    if (totalReceivedCount === 0 || primaryPO.materialReceipts.length === 0) {
      // Build auto-balanced opening balance from the legacy DNs and PO items
      const openingItems = (primaryPO.items || []).map((poIt, idx) => ({
        poItemId: poIt.id,
        itemNo: poIt.itemNo || idx + 1,
        description: poIt.description,
        orderedQty: poIt.quantity,
        receivedQty: poIt.quantity,
        unitPrice: poIt.unitPrice,
        unit: poIt.unit || 'EA',
      }));

      const openingReceipt: MaterialReceiptRecord = {
        id: `mr-ob-${proj.id}`,
        receiptNumber: `OB-${proj.projectNumber || proj.id}-001`,
        receiptDate: proj.startDate || '2026-08-01',
        receivedDate: proj.startDate || '2026-08-01',
        poId: primaryPO.id,
        poNumber: primaryPO.poNumber,
        projectId: proj.id,
        projectName: proj.name,
        vendorName: primaryPO.vendorName || 'المورد المعتمد',
        receivedBy: 'Eng. Mokhtar Yousef',
        receivedItems: openingItems,
        notes: 'رصيد افتتاحي معتمد للمشروع (Site Opening Balance Reconciliation)',
        createdAt: new Date().toISOString(),
      };

      primaryPO.materialReceipts.unshift(openingReceipt);
      openingBalancesCreated++;
    }
  });

  return {
    reconciledPurchaseOrders: posCopy,
    openingBalancesCreated,
  };
}
