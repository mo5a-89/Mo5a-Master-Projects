import { ItemDeliveryStatus, PurchaseOrderItem, DeliveryNote, CustomerQuotation } from '../types';

export interface DeliveryStats {
  totalItems: number;
  deliveredCount: number;
  partialCount: number;
  notYetCount: number;
  deliveredPercent: number;
  overallStatus: ItemDeliveryStatus;
}

export const calculateDeliveryStats = (
  items: Array<{
    quantity: number;
    deliveryStatus?: ItemDeliveryStatus;
    deliveredQty?: number;
  }>
): DeliveryStats => {
  const totalItems = items.length;
  if (totalItems === 0) {
    return {
      totalItems: 0,
      deliveredCount: 0,
      partialCount: 0,
      notYetCount: 0,
      deliveredPercent: 0,
      overallStatus: 'Not yet',
    };
  }

  let deliveredCount = 0;
  let partialCount = 0;
  let notYetCount = 0;

  items.forEach((item) => {
    const status = item.deliveryStatus || 'Not yet';
    if (status === 'Delivered') {
      deliveredCount++;
    } else if (status === 'Partial Delivered') {
      partialCount++;
    } else {
      notYetCount++;
    }
  });

  const deliveredPercent = Math.round(((deliveredCount + partialCount * 0.5) / totalItems) * 100);

  let overallStatus: ItemDeliveryStatus = 'Not yet';
  if (deliveredCount === totalItems) {
    overallStatus = 'Delivered';
  } else if (deliveredCount > 0 || partialCount > 0) {
    overallStatus = 'Partial Delivered';
  }

  return {
    totalItems,
    deliveredCount,
    partialCount,
    notYetCount,
    deliveredPercent,
    overallStatus,
  };
};

export const getDeliveryStatusBadge = (status: ItemDeliveryStatus = 'Not yet') => {
  switch (status) {
    case 'Delivered':
      return {
        labelEn: 'Delivered',
        labelAr: 'تم الاستلام / التوريد',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotBg: 'bg-emerald-500',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'Partial Delivered':
      return {
        labelEn: 'Partial Delivered',
        labelAr: 'استلام / توريد جزئي',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dotBg: 'bg-amber-500',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'Not yet':
    default:
      return {
        labelEn: 'Not yet',
        labelAr: 'لم يتم الاستلام / التوريد',
        bg: 'bg-slate-50 text-slate-600 border-slate-200',
        dotBg: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
};

/**
 * Calculates delivery progress for client project items based on issued Delivery Notes
 */
export interface ClientProjectItemDeliverySummary {
  itemId: string;
  itemNo: number;
  description: string;
  unit: string;
  totalOrderedQty: number;
  totalDeliveredQty: number;
  remainingQty: number;
  deliveryStatus: ItemDeliveryStatus;
  isInvoiced: boolean;
}

export const computeProjectDeliverySummary = (
  quotation?: CustomerQuotation,
  deliveryNotes: DeliveryNote[] = []
): ClientProjectItemDeliverySummary[] => {
  if (!quotation || !quotation.items) return [];

  // Map each quotation item to sum of delivered qty across all non-draft delivery notes
  const activeDNs = deliveryNotes.filter((dn) => dn.status !== 'Draft');

  return quotation.items.map((it) => {
    let deliveredQty = 0;
    activeDNs.forEach((dn) => {
      const match = dn.items.find((dni) => dni.sourceItemId === it.id);
      if (match) {
        deliveredQty += match.deliveredQty || 0;
      }
    });

    const orderedQty = it.quantity || 0;
    const remaining = Math.max(0, orderedQty - deliveredQty);

    let status: ItemDeliveryStatus = 'Not yet';
    if (deliveredQty >= orderedQty && orderedQty > 0) {
      status = 'Delivered';
    } else if (deliveredQty > 0) {
      status = 'Partial Delivered';
    }

    return {
      itemId: it.id,
      itemNo: it.itemNo,
      description: it.description,
      unit: it.unit || 'EA',
      totalOrderedQty: orderedQty,
      totalDeliveredQty: deliveredQty,
      remainingQty: remaining,
      deliveryStatus: status,
      isInvoiced: false, // will be correlated with invoices
    };
  });
};
