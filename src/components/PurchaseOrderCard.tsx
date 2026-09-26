import React from 'react';
import { PurchaseOrder, MaterialReceiptRecord, Project } from '../types';
import {
  ShoppingBag,
  CheckCircle2,
  PackageCheck,
  CreditCard,
  Truck,
  Eye,
  Edit3,
  Lock,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import { isServiceMilestoneItem } from '../services/procurementService';

interface PurchaseOrderCardProps {
  po: PurchaseOrder;
  project?: Project;
  grnRecords?: MaterialReceiptRecord[];
  onSelectPOForViewing: (poId: string) => void;
  onReceiveMaterials?: (po: PurchaseOrder) => void;
  onOpenLedger?: (po: PurchaseOrder) => void;
  onCreateDeliveryNote?: (po: PurchaseOrder) => void;
  onEditPO?: (po: PurchaseOrder) => void;
  onResetReceipts?: (po: PurchaseOrder) => void;
}

/**
 * Deterministic Line-Item Fulfillment Calculator
 * Excludes service/commissioning milestones from physical warehouse fulfillment calculation
 * so warehouse fulfillment reaches 100% upon physical hardware arrival.
 */
export function calculatePOLineItemFulfillment(
  po: PurchaseOrder,
  grnRecords: MaterialReceiptRecord[] = []
): {
  itemsWithReceipts: Array<{
    id: string;
    description: string;
    orderedQty: number;
    unit: string;
    receivedQty: number;
    remainingQty: number;
    fulfillmentPercent: number;
    isService: boolean;
  }>;
  totalOrderedQty: number;
  totalReceivedQty: number;
  totalPhysicalOrderedQty: number;
  totalPhysicalReceivedQty: number;
  overallFulfillmentPercent: number;
  physicalFulfillmentPercent: number;
  physicalItemsCount: number;
  serviceItemsCount: number;
} {
  const poReceipts = grnRecords.filter(
    (grn) => grn.poId === po.id || (grn as any).purchaseOrderId === po.id
  );

  const items = po.items || [];
  let totalOrderedQty = 0;
  let totalReceivedQty = 0;
  let totalPhysicalOrderedQty = 0;
  let totalPhysicalReceivedQty = 0;
  let physicalItemsCount = 0;
  let serviceItemsCount = 0;

  const itemsWithReceipts = items.map((item) => {
    const isService = isServiceMilestoneItem(item);
    const orderedQty = Number(item.quantity || (item as any).orderedQty || 0);
    totalOrderedQty += orderedQty;

    if (isService) {
      serviceItemsCount++;
    } else {
      physicalItemsCount++;
      totalPhysicalOrderedQty += orderedQty;
    }

    // Strict individual line-item receipt calculation
    const allReceivedItems: any[] = poReceipts.flatMap((grn) => {
      const listA = grn.receivedItems || [];
      const listB = grn.items || [];
      return [...listA, ...listB];
    });

    const receivedFromGRNs = allReceivedItems
      .filter((grnItem: any) => {
        const itemId = grnItem.poItemId || grnItem.itemId || grnItem.id;
        const matchesId = itemId && (itemId === item.id || (item as any).sourceItemId === itemId);
        const matchesDesc = (grnItem.description || '').trim().toLowerCase() === (item.description || '').trim().toLowerCase();
        return matchesId || matchesDesc;
      })
      .reduce((sum: number, grnItem: any) => {
        const qty = grnItem.receivedQty || grnItem.receivedQuantity || grnItem.quantityDelivered || grnItem.quantityReceived || 0;
        return sum + Number(qty);
      }, 0);

    const receivedQty = Math.max(Number(receivedFromGRNs), Number(item.deliveredQty || 0));
    totalReceivedQty += receivedQty;
    if (!isService) {
      totalPhysicalReceivedQty += Math.min(orderedQty, receivedQty);
    }

    const remainingQty = Math.max(0, orderedQty - receivedQty);
    const fulfillmentPercent = orderedQty > 0 ? Math.min(100, Math.round((receivedQty / orderedQty) * 100)) : 0;

    return {
      id: item.id,
      description: item.description,
      orderedQty,
      unit: item.unit || (isService ? 'Day' : 'EA'),
      receivedQty,
      remainingQty,
      fulfillmentPercent,
      isService,
    };
  });

  const physicalFulfillmentPercent = totalPhysicalOrderedQty > 0
    ? Math.min(100, Math.round((totalPhysicalReceivedQty / totalPhysicalOrderedQty) * 100))
    : 100;

  const overallFulfillmentPercent = physicalFulfillmentPercent;

  return {
    itemsWithReceipts,
    totalOrderedQty,
    totalReceivedQty,
    totalPhysicalOrderedQty,
    totalPhysicalReceivedQty,
    overallFulfillmentPercent,
    physicalFulfillmentPercent,
    physicalItemsCount,
    serviceItemsCount,
  };
}

export const PurchaseOrderCard: React.FC<PurchaseOrderCardProps> = ({
  po,
  project,
  grnRecords = po.materialReceipts || [],
  onSelectPOForViewing,
  onReceiveMaterials,
  onOpenLedger,
  onCreateDeliveryNote,
  onEditPO,
  onResetReceipts,
}) => {
  const {
    itemsWithReceipts,
    totalOrderedQty,
    totalReceivedQty,
    totalPhysicalOrderedQty,
    totalPhysicalReceivedQty,
    physicalItemsCount,
    serviceItemsCount,
    overallFulfillmentPercent,
    physicalFulfillmentPercent,
  } = calculatePOLineItemFulfillment(po, grnRecords);

  const poPaidAmount = po.paidAmount ?? (po.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const poGrandTotal = Number(po.grandTotal) || 0;
  const poRemaining = Math.max(0, poGrandTotal - poPaidAmount);
  const isFullyPaid = poPaidAmount >= poGrandTotal && poGrandTotal > 0;
  const isPartiallyPaid = poPaidAmount > 0 && poPaidAmount < poGrandTotal;
  const receiptsCount = (po.materialReceipts || []).length;

  return (
    <div
      key={po.id}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold font-mono">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-black text-[#1e3a8a]">
                {po.poNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                  po.status === 'Approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : po.status === 'Completed'
                    ? 'bg-purple-100 text-purple-800'
                    : po.status === 'Issued'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {po.status === 'Approved'
                  ? 'معتمد رسمياً'
                  : po.status === 'Completed'
                  ? 'مكتمل التوريد'
                  : po.status === 'Issued'
                  ? 'صادر للموزع'
                  : 'مسودة'}
              </span>
              {receiptsCount > 0 && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{receiptsCount} استلام مواد ({overallFulfillmentPercent}%)</span>
                </span>
              )}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                  isFullyPaid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isPartiallyPaid
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {isFullyPaid ? 'مسدد للمورد بالكامل ✓' : isPartiallyPaid ? `مسدد جزئياً (${poPaidAmount.toLocaleString()} SAR)` : 'غير مسدد للمورد'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              المورد: <strong className="text-slate-900">{po.vendorName}</strong> | المشروع: <strong className="text-slate-900">{po.projectName}</strong>
            </p>
          </div>
        </div>

        <div className="text-left font-mono">
          <span className="text-[11px] text-slate-400 block">الإجمالي الشامل (15% VAT)</span>
          <span className="text-base font-black text-[#1e3a8a]">
            {poGrandTotal.toLocaleString()} SAR
          </span>
          {poPaidAmount > 0 && (
            <span className="text-[10px] text-emerald-700 block font-bold">
              المدفوع: {poPaidAmount.toLocaleString()} | المتبقي: {poRemaining.toLocaleString()} SAR
            </span>
          )}
        </div>
      </div>

      {/* Deterministic Fulfillment Progress Bar */}
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-[11px] font-bold text-slate-600 shrink-0">
            نسبة الإنجاز والتوريد:
          </span>
          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                overallFulfillmentPercent >= 100
                  ? 'bg-emerald-600'
                  : overallFulfillmentPercent > 0
                  ? 'bg-blue-600'
                  : 'bg-slate-300'
              }`}
              style={{ width: `${overallFulfillmentPercent}%` }}
            />
          </div>
          <span className="font-mono font-bold text-slate-800 text-xs">
            {overallFulfillmentPercent}%
          </span>
        </div>

        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
          <span>المواد العتادية المستلمة: <strong className="text-slate-800">{totalPhysicalReceivedQty}</strong> من <strong className="text-slate-800">{totalPhysicalOrderedQty}</strong> وحدة ({physicalItemsCount} صنف عتادي)</span>
          {serviceItemsCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200">
              <Wrench className="w-3 h-3" />
              <span>{serviceItemsCount} بند خدمات/تشغيل واختبار (مستثنى من التوريد المخزني)</span>
            </span>
          )}
          <span>تاريخ الأمر: <strong>{po.date}</strong></span>
        </div>
      </div>

      {/* Deterministic Line Item Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 font-medium">الأصناف ({itemsWithReceipts.length}):</span>
          {itemsWithReceipts.slice(0, 3).map((it) => (
            <span
              key={it.id}
              className={`border px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                it.isService 
                  ? 'bg-amber-50 border-amber-200 text-amber-900' 
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {it.isService && <Wrench className="w-3 h-3 text-amber-600" />}
              <span>{it.description}</span>
              <span className="font-mono text-[10px] text-slate-500">
                ({it.receivedQty}/{it.orderedQty} {it.unit})
              </span>
            </span>
          ))}
          {itemsWithReceipts.length > 3 && (
            <span className="text-slate-400 text-[11px]">
              +{itemsWithReceipts.length - 3} أصناف أخرى...
            </span>
          )}
        </div>
      </div>

      {/* Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {onReceiveMaterials && (
            <button
              type="button"
              onClick={() => onReceiveMaterials(po)}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-[#007A5A] hover:from-emerald-700 hover:to-[#00664B] text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <PackageCheck className="w-4 h-4 text-emerald-200" />
              <span>استلام وتوريد المواد (Receive)</span>
            </button>
          )}

          {onOpenLedger && (
            <button
              type="button"
              onClick={() => onOpenLedger(po)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <CreditCard className="w-4 h-4 text-amber-700" />
              <span>سجل دفعات المورد (Ledger)</span>
            </button>
          )}

          {onCreateDeliveryNote && (
            <button
              type="button"
              onClick={() => onCreateDeliveryNote(po)}
              className="px-3 py-1.5 bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-300 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Truck className="w-4 h-4 text-teal-600" />
              <span>إصدار سند تسليم للعميل</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectPOForViewing(po.id)}
            className="px-3 py-1.5 bg-[#1e3a8a] text-white hover:bg-[#152e6f] rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>عرض المستند والطباعة</span>
          </button>

          {totalReceivedQty > 0 || (po.materialReceipts && po.materialReceipts.length > 0) ? (
            <span
              className="px-2.5 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-not-allowed"
              title="المستند مقفل لوجود استلامات مواد فعلية"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>مقفل</span>
            </span>
          ) : (
            onEditPO && (
              <button
                type="button"
                onClick={() => onEditPO(po)}
                className="px-3 py-1.5 bg-blue-50 text-[#1e3a8a] hover:bg-blue-100 border border-blue-200 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>تعديل</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
