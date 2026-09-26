import React, { useState } from 'react';
import { DeliveryNote } from '../types';
import { COMPANY_PROFILE } from '../data/initialData';
import { CompanyLogo } from './CompanyHeader';
import { DocumentFooter } from './DocumentFooter';
import { Printer, ArrowRight, CheckCircle2, Truck, Copy, Download, Share2, Trash2, AlertTriangle, Receipt, Pencil, X } from 'lucide-react';
import { executePrint } from '../utils/printUtils';

interface DeliveryNoteDocumentProps {
  deliveryNote: DeliveryNote;
  onClose?: () => void;
  onPrint?: () => void;
  onDeleteDeliveryNote?: (deliveryNoteId: string) => void;
  onOpenInvoiceForDN?: (deliveryNote: DeliveryNote) => void;
  onUpdateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
}

export const DeliveryNoteDocument: React.FC<DeliveryNoteDocumentProps> = ({
  deliveryNote,
  onClose,
  onPrint,
  onDeleteDeliveryNote,
  onOpenInvoiceForDN,
  onUpdateDeliveryNote,
}) => {
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Quick Edit modal state
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [editDeliveryLocation, setEditDeliveryLocation] = useState(deliveryNote.deliveryLocation || '');
  const [editRecipientName, setEditRecipientName] = useState(deliveryNote.recipientName || '');
  const [editRecipientPhone, setEditRecipientPhone] = useState(deliveryNote.recipientPhone || '');
  const [editNotes, setEditNotes] = useState(deliveryNote.notes || '');
  const [editItems, setEditItems] = useState(deliveryNote.items || []);

  const handleSaveQuickEdit = () => {
    const updatedDN: DeliveryNote = {
      ...deliveryNote,
      deliveryLocation: editDeliveryLocation,
      recipientName: editRecipientName,
      recipientPhone: editRecipientPhone,
      notes: editNotes,
      items: editItems,
    };
    if (onUpdateDeliveryNote) {
      onUpdateDeliveryNote(updatedDN);
    }
    setShowQuickEditModal(false);
  };

  const handleCopy = () => {
    const summary = `سند تسليم: ${deliveryNote.dnNumber}\nالمشروع: ${deliveryNote.projectName}\nالعميل: ${deliveryNote.customerName}\nالتاريخ: ${deliveryNote.date}\nعدد الأصناف: ${deliveryNote.items.length}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      executePrint('printable-delivery-note', {
        documentTitle: `سند تسليم بضاعة - ${deliveryNote.dnNumber} - ${deliveryNote.customerName}`,
      });
    }
  };

  const totalDeliveredUnits = deliveryNote.items.reduce((sum, it) => sum + (it.deliveredQty || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Action Bar (No-Print) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="الرجوع للقائمة"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-[#007A5A]">
                {deliveryNote.dnNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                سند تسليم رسمي (Delivery Note)
              </span>

              {/* Interactive Invoicing Badge */}
              {onOpenInvoiceForDN ? (
                <button
                  type="button"
                  onClick={() => onOpenInvoiceForDN(deliveryNote)}
                  className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                    deliveryNote.invoicedStatus === 'Fully Invoiced'
                      ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300'
                      : deliveryNote.invoicedStatus === 'Partially Invoiced'
                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                      : 'bg-[#1e3a8a] hover:bg-[#152e6f] text-white border border-blue-900 animate-pulse'
                  }`}
                  title="اضغط هنا للانتقال مباشرة لإنشاء الفاتورة الضريبية بالأسعار والكميات المعتمدة"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>
                    {deliveryNote.invoicedStatus === 'Fully Invoiced'
                      ? 'تمت الفوترة بالكامل ✓'
                      : deliveryNote.invoicedStatus === 'Partially Invoiced'
                      ? 'مفوتر جزئياً'
                      : 'جاهز للفوترة - اضغط لإنشاء الفاتورة ⚡'}
                  </span>
                </button>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  {deliveryNote.invoicedStatus === 'Fully Invoiced'
                    ? 'تمت الفوترة بالكامل'
                    : deliveryNote.invoicedStatus === 'Partially Invoiced'
                    ? 'مفوتر جزئياً'
                    : 'جاهز للفوترة (Uninvoiced)'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مشروع: <span className="font-semibold text-slate-700">{deliveryNote.projectName}</span> | العميل: <span className="font-semibold text-slate-700">{deliveryNote.customerName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onUpdateDeliveryNote && (
            <button
              type="button"
              onClick={() => {
                setEditDeliveryLocation(deliveryNote.deliveryLocation || '');
                setEditRecipientName(deliveryNote.recipientName || '');
                setEditRecipientPhone(deliveryNote.recipientPhone || '');
                setEditNotes(deliveryNote.notes || '');
                setEditItems(deliveryNote.items || []);
                setShowQuickEditModal(true);
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
              title="وضع التعديل المباشر لتعديل الكميات وموقع التسليم والملاحظات واعتمادها فوراً"
            >
              <Pencil className="w-4 h-4 text-amber-400" />
              <span>وضع التعديل المباشر (Live Edit)</span>
            </button>
          )}

          {/* Issue Invoice Direct Action */}
          {onOpenInvoiceForDN && (
            <button
              type="button"
              onClick={() => onOpenInvoiceForDN(deliveryNote)}
              className="px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              title="إصدار فاتورة ضريبية رسمية لهذا السند بالأسعار المعتمدة"
            >
              <Receipt className="w-4 h-4" />
              <span>
                {deliveryNote.invoicedStatus === 'Fully Invoiced'
                  ? 'عرض / إعادة الفوترة'
                  : 'إصدار فاتورة ضريبية للسند'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم النسخ' : 'نسخ البيانات'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة سند التسليم (PDF)</span>
          </button>

          {onDeleteDeliveryNote && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="حذف سند التسليم وإلغاء تسجيل توريد هذه الأصناف"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>حذف سند التسليم</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Delivery Note Document Template */}
      <div
        id="printable-delivery-note"
        className="bg-white border border-slate-300 rounded-lg shadow-md max-w-4xl mx-auto p-6 sm:p-10 text-slate-800 text-[12px] font-sans antialiased select-text"
        dir="rtl"
      >
        {/* Document Header: Company Details on RIGHT (يمين), Logo & DN Info on LEFT (يسار) */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4 gap-4">
          {/* Right (يمين): Company Name & Details */}
          <div className="text-right space-y-1">
            <h2 className="font-bold text-base text-[#174A84] font-cairo">
              {COMPANY_PROFILE.nameAr}
            </h2>
            <p className="text-[11px] text-slate-600 uppercase font-semibold">
              {COMPANY_PROFILE.nameEn}
            </p>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5 space-y-0.5">
              <p>
                سجل تجاري C.R: <strong className="text-slate-800">{COMPANY_PROFILE.crNumber}</strong>
                &nbsp;&nbsp;|&nbsp;&nbsp;الرقم الضريبي VAT:{' '}
                <strong className="text-[#007A5A]">{COMPANY_PROFILE.vatNumber}</strong>
              </p>
              <p>{COMPANY_PROFILE.addressAr}</p>
            </div>
          </div>

          {/* Left (يسار): Logo + Delivery Note Badge */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-left font-mono space-y-0.5">
              <div className="inline-block bg-[#007A5A] text-white px-3 py-1 font-bold text-xs uppercase tracking-wider rounded-xs mb-1">
                DELIVERY NOTE / سند تسليم بضاعة
              </div>
              <div className="font-mono text-sm font-extrabold text-slate-900 text-right">
                #{deliveryNote.dnNumber}
              </div>
              <div className="text-xs text-slate-500 font-mono text-right">
                التاريخ: <strong>{deliveryNote.date}</strong>
              </div>
            </div>
            <CompanyLogo className="h-16 w-auto" />
          </div>
        </div>

        {/* Client & Delivery Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-5 text-xs break-inside-avoid">
          {/* Client Info */}
          <div className="border border-slate-200 rounded p-3 bg-slate-50/50 space-y-1.5">
            <div className="font-bold text-[#1e3a8a] text-[11px] uppercase border-b border-slate-200 pb-1 mb-1">
              بيانات العميل والمشروع (Client & Project)
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">اسم العميل:</span>
              <strong className="text-slate-900">{deliveryNote.customerName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">اسم المشروع:</span>
              <strong className="text-slate-900">{deliveryNote.projectName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">رقم المشروع:</span>
              <span className="font-mono text-slate-700">{deliveryNote.projectNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">موقع التسليم:</span>
              <span className="text-slate-800">{deliveryNote.deliveryLocation}</span>
            </div>
          </div>

          {/* Logistics & Recipient */}
          <div className="border border-slate-200 rounded p-3 bg-slate-50/50 space-y-1.5">
            <div className="font-bold text-[#007A5A] text-[11px] uppercase border-b border-slate-200 pb-1 mb-1">
              بيانات المستلم والنقل (Logistics & Receiver)
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المستلم بالموقع:</span>
              <strong className="text-slate-900">{deliveryNote.recipientName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">جوال المستلم:</span>
              <span className="font-mono text-slate-700">{deliveryNote.recipientPhone || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">السائق / الناقل:</span>
              <span className="text-slate-800">{deliveryNote.driverOrCarrier || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">رقم اللوحة:</span>
              <span className="font-mono text-slate-800">{deliveryNote.vehiclePlateNo || '-'}</span>
            </div>
          </div>
        </div>

        {/* Delivered Items Table */}
        <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm mb-5">
          <table className="w-full text-[11px] border-collapse text-right">
            <thead>
              <tr className="bg-[#007A5A] text-white">
                <th className="py-2 px-2 text-center w-10 font-bold border-l border-emerald-800">#</th>
                <th className="py-2 px-3 font-bold border-l border-emerald-800">وصف المواد المسلمة / Description</th>
                <th className="py-2 px-2 text-center w-16 font-bold border-l border-emerald-800">الوحدة</th>
                <th className="py-2 px-2 text-center w-24 font-bold border-l border-emerald-800">إجمالي الطلب</th>
                <th className="py-2 px-2 text-center w-28 font-bold bg-[#0c6b4f]">الكمية المسلمة</th>
                <th className="py-2 px-2 text-center w-24 font-bold">المتبقي للتوريد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(deliveryNote.items || []).map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-slate-50 transition break-inside-avoid">
                  <td className="py-2.5 px-2 text-center font-bold text-slate-500 border-l border-slate-200">
                    {it.itemNo || idx + 1}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-pre-line border-l border-slate-200">
                    {it.description}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-600 font-mono border-l border-slate-200">
                    {it.unit}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-600 border-l border-slate-200">
                    {it.orderedQty}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-extrabold text-emerald-900 bg-emerald-50/70 border-l border-slate-200 text-xs">
                    {it.deliveredQty}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                    {it.remainingQty}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t border-slate-300">
                <td colSpan={4} className="py-2 px-3 text-left">إجمالي الوحدات المسلمة في هذا السند:</td>
                <td className="py-2 px-2 text-center font-mono text-emerald-800 text-xs font-extrabold">
                  {totalDeliveredUnits}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Dedicated 2-Role Delivery Note Document Footer (Dispatcher + Client Receiver) */}
        <DocumentFooter
          variant="delivery_note"
          clientRecipientName={deliveryNote.recipientName || 'المستلم المفوض / العميل'}
          clientRecipientTitle="Authorized Site Representative"
          clientRoleKey={`receiver_${deliveryNote.id}`}
          dispatcherName={
            deliveryNote.dispatchedByName && deliveryNote.dispatchedByName !== 'مؤسسة صناع الموارد التجارية'
              ? deliveryNote.dispatchedByName
              : 'Medhat Al Brahim'
          }
          dispatcherTitle="Logistics & Dispatch Lead"
          dispatcherRoleKey="dispatcher_medhat"
          notes={deliveryNote.notes}
          className="mt-6"
        />
      </div>

      {/* Delete Delivery Note Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف سند تسليم البضاعة</h3>
                <p className="text-xs text-rose-600 font-mono font-bold">{deliveryNote.dnNumber}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5">
              <div className="flex justify-between">
                <span>المشروع:</span>
                <strong className="text-slate-800">{deliveryNote.projectName}</strong>
              </div>
              <div className="flex justify-between">
                <span>العميل:</span>
                <strong className="text-slate-800">{deliveryNote.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>موقع التسليم:</span>
                <strong className="text-slate-800">{deliveryNote.deliveryLocation}</strong>
              </div>
              <div className="flex justify-between">
                <span>عدد الأصناف المسلمة:</span>
                <strong className="font-mono text-slate-900 font-bold">{deliveryNote.items.length} صنف</strong>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                ⚠️ سيؤدي حذف سند التسليم إلى إلغاء تسجيل توريد هذه الأصناف، وإعادة الكميات المسلمة للصفر ليتسنى لك تصحيح أي أخطاء أو إعادة إصدار سند تسليم سليم.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  if (onDeleteDeliveryNote) onDeleteDeliveryNote(deliveryNote.id);
                  if (onClose) onClose();
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد حذف سند التسليم نهائياً</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick Edit Modal */}
      {showQuickEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">وضع التعديل المباشر واعتماد سند التسليم (Live Edit & Re-Approve)</h3>
                <p className="text-xs text-slate-500 font-mono">سند تسليم رقم: {deliveryNote.dnNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">موقع التسليم (Delivery Location)</label>
                  <input
                    type="text"
                    value={editDeliveryLocation}
                    onChange={(e) => setEditDeliveryLocation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المستلم (Recipient Name)</label>
                  <input
                    type="text"
                    value={editRecipientName}
                    onChange={(e) => setEditRecipientName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم هاتف المستلم (Phone)</label>
                  <input
                    type="text"
                    value={editRecipientPhone}
                    onChange={(e) => setEditRecipientPhone(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الأصناف والكميات المسلمة (Delivered Quantities)</label>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-slate-800">{item.itemNo}. {item.description}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 block">الكمية المسلمة (Delivered Qty):</span>
                          <input
                            type="number"
                            value={item.deliveredQty}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, deliveredQty: val } : it));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات السند (Notes)</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowQuickEditModal(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveQuickEdit}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ التعديلات والاعتماد الفوري (Save & Re-Approve)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
