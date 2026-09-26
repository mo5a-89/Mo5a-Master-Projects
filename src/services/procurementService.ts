/**
 * Procurement & Logistics Receiving Service (GRN & Physical Fulfillment Engine)
 * 
 * Strict Distinction between:
 * 1. Physical Hardware & Equipment (physical_material):
 *    - Extinguishers, detectors, panels, valves, cables, pipes, etc.
 *    - Tracked for Warehouse & Site Goods Receiving Progress (GRN).
 * 2. Service & Commissioning Milestones (service_milestone):
 *    - Engineering site days, Testing & Commissioning, Civil Defense approvals.
 *    - EXCLUDED from Physical Warehouse GRN so physical fulfillment reaches 100% upon hardware delivery.
 * 3. On-Site Inventory Ledger:
 *    - When GRN has destinationTag === 'direct_site', items are registered into project.siteInventory.
 */

import { PurchaseOrder, MaterialReceiptRecord, ItemDeliveryStatus, Project } from '../types';

export type ProcurementItemCategory = 'physical_material' | 'service_milestone';

export interface SiteInventoryItem {
  itemId: string;
  description: string;
  quantityOnHand: number;
  unit: string;
  lastReceivedDate: string;
  grnRef: string;
}

export interface CategorizedProcurementItem {
  id: string;
  itemNo: number;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveredQty: number;
  category: ProcurementItemCategory;
  isPhysical: boolean;
  isService: boolean;
}

export interface POPhysicalFulfillmentMetrics {
  poId: string;
  poNumber: string;
  totalItemsCount: number;
  physicalItemsCount: number;
  serviceItemsCount: number;
  totalPhysicalQtyOrdered: number; // e.g. 2,398 ea across 15 hardware items
  totalPhysicalQtyReceived: number;
  physicalFulfillmentPercent: number;
  isPhysicalFullyReceived: boolean;
  serviceMilestonesCount: number;
  physicalItems: CategorizedProcurementItem[];
  serviceItems: CategorizedProcurementItem[];
}

/**
 * Determines whether a line item is a service/commissioning milestone rather than physical material.
 * Filter condition: unit === 'Day' (or 'يوم') or description includes 'Testing and Commissioning' / 'التركيبات والاختبار'
 */
export function isServiceMilestoneItem(item: { unit?: string; description?: string }): boolean {
  const unit = (item.unit || '').trim().toLowerCase();
  const desc = (item.description || '').toLowerCase();

  const isDayUnit = unit === 'day' || unit === 'days' || unit === 'يوم' || unit === 'أيام';
  
  const hasServiceKeyword =
    desc.includes('testing and commissioning') ||
    desc.includes('testing & commissioning') ||
    desc.includes('testing and comissioning') ||
    desc.includes('التركيبات والاختبار') ||
    desc.includes('اختبار وتشغيل') ||
    desc.includes('فحص وتشغيل') ||
    desc.includes('commissioning') ||
    desc.includes('testing') ||
    desc.includes('تركيب واختبار') ||
    desc.includes('أعمال التركيب') ||
    desc.includes('خدمات الموقع') ||
    desc.includes('engineering day');

  return isDayUnit || hasServiceKeyword;
}

/**
 * Returns 'service_milestone' if the item is a service/commissioning milestone, otherwise 'physical_material'.
 */
export function getItemProcurementCategory(item: { unit?: string; description?: string }): ProcurementItemCategory {
  return isServiceMilestoneItem(item) ? 'service_milestone' : 'physical_material';
}

/**
 * Categorizes all items of a Purchase Order or BoQ into physical materials and service milestones.
 */
export function categorizeProcurementItems(items: Array<{
  id?: string;
  itemNo?: number;
  description: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  deliveredQty?: number;
}>): CategorizedProcurementItem[] {
  return items.map((it, idx) => {
    const isService = isServiceMilestoneItem(it);
    const category: ProcurementItemCategory = isService ? 'service_milestone' : 'physical_material';
    const qty = Number(it.quantity || 1);
    const price = Number(it.unitPrice || 0);

    return {
      id: it.id || `item-${idx + 1}`,
      itemNo: it.itemNo || idx + 1,
      description: it.description,
      unit: it.unit || (isService ? 'Day' : 'EA'),
      quantity: qty,
      unitPrice: price,
      totalPrice: it.totalPrice || (qty * price),
      deliveredQty: Number(it.deliveredQty || 0),
      category,
      isPhysical: !isService,
      isService,
    };
  });
}

/**
 * Filters out service lines to leave only physical hardware items for GRN warehouse fulfillment.
 */
export function filterPhysicalHardwareItems<T extends { unit?: string; description?: string }>(items: T[]): T[] {
  return items.filter((item) => !isServiceMilestoneItem(item));
}

/**
 * Calculates physical warehouse fulfillment (GRN) for a given purchase order,
 * excluding service and commissioning lines so physical fulfillment reaches 100% upon hardware arrival.
 */
export function calculatePOPhysicalFulfillment(po: PurchaseOrder): POPhysicalFulfillmentMetrics {
  const categorized = categorizeProcurementItems(po.items || []);
  const physicalItems = categorized.filter((it) => it.isPhysical);
  const serviceItems = categorized.filter((it) => it.isService);

  const totalPhysicalQtyOrdered = physicalItems.reduce((sum, it) => sum + it.quantity, 0);
  const totalPhysicalQtyReceived = physicalItems.reduce((sum, it) => sum + Math.min(it.quantity, it.deliveredQty), 0);

  const physicalFulfillmentPercent = totalPhysicalQtyOrdered > 0
    ? Math.min(100, Math.round((totalPhysicalQtyReceived / totalPhysicalQtyOrdered) * 100))
    : 100;

  const isPhysicalFullyReceived = totalPhysicalQtyOrdered > 0
    ? totalPhysicalQtyReceived >= totalPhysicalQtyOrdered
    : true;

  return {
    poId: po.id,
    poNumber: po.poNumber,
    totalItemsCount: categorized.length,
    physicalItemsCount: physicalItems.length,
    serviceItemsCount: serviceItems.length,
    totalPhysicalQtyOrdered,
    totalPhysicalQtyReceived,
    physicalFulfillmentPercent,
    isPhysicalFullyReceived,
    serviceMilestonesCount: serviceItems.length,
    physicalItems,
    serviceItems,
  };
}

/**
 * Aggregates project-wide Goods Receiving Progress (GRN) across all purchase orders.
 */
export function calculateProjectPhysicalGRNMetrics(
  projectId: string,
  purchaseOrders: PurchaseOrder[]
): {
  totalPhysicalOrdered: number;
  totalPhysicalReceived: number;
  physicalGRNPercent: number;
  isPhysicalDeliveryComplete: number;
  hardwareItemsTotal: number;
} {
  const projectPOs = purchaseOrders.filter((po) => po.projectId === projectId && !po.deletedAt);
  let totalPhysicalOrdered = 0;
  let totalPhysicalReceived = 0;
  let hardwareItemsTotal = 0;

  projectPOs.forEach((po) => {
    const metrics = calculatePOPhysicalFulfillment(po);
    totalPhysicalOrdered += metrics.totalPhysicalQtyOrdered;
    totalPhysicalReceived += metrics.totalPhysicalQtyReceived;
    hardwareItemsTotal += metrics.physicalItemsCount;
  });

  const physicalGRNPercent = totalPhysicalOrdered > 0
    ? Math.min(100, Math.round((totalPhysicalReceived / totalPhysicalOrdered) * 100))
    : 100;

  return {
    totalPhysicalOrdered,
    totalPhysicalReceived,
    physicalGRNPercent,
    isPhysicalDeliveryComplete: physicalGRNPercent >= 100 ? 1 : 0,
    hardwareItemsTotal,
  };
}

/**
 * Updates or registers site inventory when a Material Receipt (GRN) has destinationTag === 'direct_site'
 */
export function registerSiteInventoryFromGRN(
  project: Project,
  receipt: MaterialReceiptRecord
): SiteInventoryItem[] {
  const currentInventory: SiteInventoryItem[] = [...(project.siteInventory || [])];
  
  if (receipt.destinationTag !== 'direct_site') {
    return currentInventory;
  }

  const items = receipt.receivedItems || receipt.items || [];
  const receiptDate = receipt.receiptDate || receipt.receivedDate || new Date().toISOString().split('T')[0];
  const grnRef = receipt.receiptNumber || receipt.id;

  items.forEach((item: any, idx: number) => {
    const itemId = item.poItemId || item.id || `site-inv-${idx + 1}`;
    const qty = Number(item.receivedQty || item.receivedQuantity || 0);
    const desc = item.description || `Item #${idx + 1}`;
    const unit = item.unit || 'EA';

    if (qty > 0) {
      const existingIdx = currentInventory.findIndex(
        (inv) => inv.itemId === itemId || inv.description.trim().toLowerCase() === desc.trim().toLowerCase()
      );

      if (existingIdx >= 0) {
        currentInventory[existingIdx] = {
          ...currentInventory[existingIdx],
          quantityOnHand: currentInventory[existingIdx].quantityOnHand + qty,
          lastReceivedDate: receiptDate,
          grnRef,
        };
      } else {
        currentInventory.push({
          itemId,
          description: desc,
          quantityOnHand: qty,
          unit,
          lastReceivedDate: receiptDate,
          grnRef,
        });
      }
    }
  });

  return currentInventory;
}
