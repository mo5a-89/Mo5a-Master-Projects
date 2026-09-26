import React, { useState } from 'react';
import { ItemDeliveryStatus } from '../types';
import { calculateDeliveryStats, getDeliveryStatusBadge } from '../utils/deliveryUtils';
import {
  CheckCircle2,
  Clock,
  CircleAlert,
  ChevronRight,
  Package,
  Truck,
  Layers,
  X,
  Edit2,
  Check,
} from 'lucide-react';

export interface DeliveryItemDetail {
  id: string;
  itemNo: number;
  description: string;
  unit: string;
  totalQty: number;
  deliveredQty: number;
  deliveryStatus: ItemDeliveryStatus;
  supplierOrVendor?: string;
  notes?: string;
}

interface DeliveryStatusWidgetProps {
  title: string;
  type: 'incoming_vendor' | 'outgoing_customer'; // PO delivery vs Project Client delivery
  items: DeliveryItemDetail[];
  onUpdateItemStatus?: (itemId: string, newStatus: ItemDeliveryStatus, newDeliveredQty?: number) => void;
  onUpdateAllStatus?: (newStatus: ItemDeliveryStatus) => void;
  canEdit?: boolean;
}

export const DeliveryStatusWidget: React.FC<DeliveryStatusWidgetProps> = ({
  title,
  type,
  items,
  onUpdateItemStatus,
  onUpdateAllStatus,
  canEdit = true,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [filterModalStatus, setFilterModalStatus] = useState<'all' | ItemDeliveryStatus>('all');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempQty, setTempQty] = useState<number>(0);

  const stats = calculateDeliveryStats(
    items.map((it) => ({
      quantity: it.totalQty,
      deliveryStatus: it.deliveryStatus,
      deliveredQty: it.deliveredQty,
    }))
  );

  const overallBadge = getDeliveryStatusBadge(stats.overallStatus);

  const deliveredPct = stats.totalItems > 0 ? (stats.deliveredCount / stats.totalItems) * 100 : 0;
  const partialPct = stats.totalItems > 0 ? (stats.partialCount / stats.totalItems) * 100 : 0;
  const notYetPct = stats.totalItems > 0 ? (stats.notYetCount / stats.totalItems) * 100 : 0;

  const filteredItems = items.filter((it) => {
    if (filterModalStatus === 'all') return true;
    return it.deliveryStatus === filterModalStatus;
  });

  return (
    <>
      {/* Visual Header Delivery Chart Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                type === 'incoming_vendor'
                  ? 'bg-blue-50 text-[#1e3a8a] border border-blue-200'
                  : 'bg-emerald-50 text-[#007A5A] border border-emerald-200'
              }`}
            >
              {type === 'incoming_vendor' ? (
                <Truck className="w-4 h-4" />
              ) : (
                <Package className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900">{title}</h4>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-bold border ${overallBadge.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${overallBadge.dotBg}`} />
                  <span>{overallBadge.labelAr}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {type === 'incoming_vendor'
                  ? 'متابعة استلام أصناف أمر الشراء من المورد إلى مستودعاتنا / الموقع'
                  : 'متابعة توريد وتسليم بنود المشروع للعميل بناءً على سندات التسليم'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && onUpdateAllStatus && (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400 font-medium hidden sm:inline">تحديث الكل:</span>
                <button
                  type="button"
                  onClick={() => onUpdateAllStatus('Delivered')}
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold transition"
                  title="تعيين جميع الأصناف كـ مستلمة بالكامل"
                >
                  تم بالكامل
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateAllStatus('Partial Delivered')}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold transition"
                >
                  جزئي
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateAllStatus('Not yet')}
                  className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold transition"
                >
                  لم يتم
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>عرض تفاصيل الأصناف ({items.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Segmented Progress Bar */}
        <div
          onClick={() => setShowModal(true)}
          className="cursor-pointer group select-none space-y-1.5"
          title="انقر لعرض ومراجعة حالة الأصناف بالتفصيل"
        >
          <div className="h-3.5 bg-slate-100 rounded-full overflow-hidden flex w-full border border-slate-200 p-0.5">
            {deliveredPct > 0 && (
              <div
                style={{ width: `${deliveredPct}%` }}
                className="bg-emerald-500 h-full rounded-l-full transition-all duration-300 relative group-hover:brightness-105"
                title={`تم التوريد / الاستلام: ${stats.deliveredCount} صنف (${deliveredPct.toFixed(0)}%)`}
              />
            )}
            {partialPct > 0 && (
              <div
                style={{ width: `${partialPct}%` }}
                className="bg-amber-400 h-full transition-all duration-300 group-hover:brightness-105"
                title={`استلام / توريد جزئي: ${stats.partialCount} صنف (${partialPct.toFixed(0)}%)`}
              />
            )}
            {notYetPct > 0 && (
              <div
                style={{ width: `${notYetPct}%` }}
                className="bg-slate-200 h-full rounded-r-full transition-all duration-300 group-hover:brightness-95"
                title={`لم يتم بعد: ${stats.notYetCount} صنف (${notYetPct.toFixed(0)}%)`}
              />
            )}
          </div>

          {/* 3 Clickable Metric Pills */}
          <div className="flex flex-wrap items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterModalStatus('Delivered');
                  setShowModal(true);
                }}
                className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 font-medium"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>تم الاستلام / التوريد (Delivered):</span>
                <span className="font-bold font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {stats.deliveredCount} ({stats.totalItems > 0 ? ((stats.deliveredCount / stats.totalItems) * 100).toFixed(0) : 0}%)
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterModalStatus('Partial Delivered');
                  setShowModal(true);
                }}
                className="flex items-center gap-1.5 text-amber-700 hover:text-amber-900 font-medium"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>استلام جزئي (Partial):</span>
                <span className="font-bold font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  {stats.partialCount}
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterModalStatus('Not yet');
                  setShowModal(true);
                }}
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800 font-medium"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span>لم يتم الاستلام (Not yet):</span>
                <span className="font-bold font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {stats.notYetCount}
                </span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400 font-medium group-hover:text-blue-600">
              إجمالي الأصناف: <strong className="font-mono text-slate-700">{stats.totalItems}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Items Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1e3a8a] text-white flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    تفاصيل حالة استلام وتوريد الأصناف ({title})
                  </h3>
                  <p className="text-xs text-slate-500">
                    استعراض وتعديل حالة كل صنف على حدة (Delivered - Partial Delivered - Not yet) والكميات المستلمة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterModalStatus('all')}
                  className={`px-3 py-1 rounded-md font-bold transition ${
                    filterModalStatus === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  جميع الأصناف ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterModalStatus('Delivered')}
                  className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                    filterModalStatus === 'Delivered'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تم الاستلام ({stats.deliveredCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterModalStatus('Partial Delivered')}
                  className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                    filterModalStatus === 'Partial Delivered'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>استلام جزئي ({stats.partialCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterModalStatus('Not yet')}
                  className={`px-3 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                    filterModalStatus === 'Not yet'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CircleAlert className="w-3.5 h-3.5" />
                  <span>لم يتم بعد ({stats.notYetCount})</span>
                </button>
              </div>

              {canEdit && onUpdateAllStatus && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">تطبيق على الكل:</span>
                  <button
                    type="button"
                    onClick={() => onUpdateAllStatus('Delivered')}
                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold transition text-[11px]"
                  >
                    اعتماد الكل مستلم
                  </button>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto p-5">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5 text-center w-12">#</th>
                    <th className="p-2.5">وصف الصنف والمواصفات</th>
                    <th className="p-2.5 text-center w-24">الكمية المطلوبة</th>
                    <th className="p-2.5 text-center w-28">الكمية المستلمة</th>
                    <th className="p-2.5 text-center w-40">حالة التوريد والاستلام</th>
                    {canEdit && onUpdateItemStatus && (
                      <th className="p-2.5 text-center w-32">إجراء سريع</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const badge = getDeliveryStatusBadge(item.deliveryStatus);
                    const isEditing = editingItemId === item.id;

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 transition">
                        <td className="p-2.5 text-center font-mono font-bold text-slate-500">
                          {item.itemNo || idx + 1}
                        </td>
                        <td className="p-2.5 font-medium text-slate-800 leading-snug">
                          <div className="whitespace-pre-line">{item.description}</div>
                          {item.notes && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              ملاحظات: {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold font-mono text-slate-800">
                          {item.totalQty} {item.unit}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={item.totalQty}
                                value={tempQty}
                                onChange={(e) => setTempQty(parseFloat(e.target.value) || 0)}
                                className="w-16 p-1 border border-blue-400 rounded text-center font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  let newStatus: ItemDeliveryStatus = 'Not yet';
                                  if (tempQty >= item.totalQty && item.totalQty > 0) {
                                    newStatus = 'Delivered';
                                  } else if (tempQty > 0) {
                                    newStatus = 'Partial Delivered';
                                  }
                                  onUpdateItemStatus?.(item.id, newStatus, tempQty);
                                  setEditingItemId(null);
                                }}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="font-bold text-slate-900">
                                {item.deliveredQty ?? (item.deliveryStatus === 'Delivered' ? item.totalQty : 0)}
                              </span>
                              <span className="text-slate-400 text-[11px]">/ {item.totalQty}</span>
                              {canEdit && onUpdateItemStatus && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItemId(item.id);
                                    setTempQty(item.deliveredQty ?? (item.deliveryStatus === 'Delivered' ? item.totalQty : 0));
                                  }}
                                  className="text-slate-400 hover:text-blue-600 p-0.5"
                                  title="تعديل الكمية المسلمة"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {canEdit && onUpdateItemStatus ? (
                            <select
                              value={item.deliveryStatus || 'Not yet'}
                              onChange={(e) => {
                                const newSt = e.target.value as ItemDeliveryStatus;
                                const newQty =
                                  newSt === 'Delivered'
                                    ? item.totalQty
                                    : newSt === 'Partial Delivered'
                                    ? Math.round(item.totalQty / 2)
                                    : 0;
                                onUpdateItemStatus(item.id, newSt, newQty);
                              }}
                              className={`text-xs px-2.5 py-1 rounded-full font-bold border cursor-pointer focus:outline-none ${badge.bg}`}
                            >
                              <option value="Delivered">Delivered (تم)</option>
                              <option value="Partial Delivered">Partial Delivered (جزئي)</option>
                              <option value="Not yet">Not yet (لم يتم)</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${badge.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dotBg}`} />
                              <span>{badge.labelEn}</span>
                            </span>
                          )}
                        </td>
                        {canEdit && onUpdateItemStatus && (
                          <td className="p-2.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateItemStatus(item.id, 'Delivered', item.totalQty)
                                }
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] transition"
                                title="تم التوريد بالكامل"
                              >
                                تم التوريد
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateItemStatus(item.id, 'Not yet', 0)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px] transition"
                                title="إلغاء التوريد"
                              >
                                إعادة
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  لا توجد أصناف تطابق الفلتر المحدد.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                يتم تحديث جميع مؤشرات الإنجاز والشاشات المرتبطة بهذا المشروع فورياً.
              </span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2 bg-[#1e3a8a] text-white rounded-xl font-bold hover:bg-[#152e6f] transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
