import React, { useState } from 'react';
import { PurchaseOrder, POPaymentRecord } from '../types';
import {
  CreditCard,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Calendar,
  AlertCircle,
  Building,
  ArrowDownLeft,
  ShieldCheck,
  Receipt,
  Layers,
} from 'lucide-react';

interface POPaymentLedgerModalProps {
  isOpen: boolean;
  po: PurchaseOrder;
  onClose: () => void;
  onSavePayment: (poId: string, updatedPO: PurchaseOrder) => void;
}

export const POPaymentLedgerModal: React.FC<POPaymentLedgerModalProps> = ({
  isOpen,
  po,
  onClose,
  onSavePayment,
}) => {
  const existingPayments: POPaymentRecord[] = po.payments || [];

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<POPaymentRecord['paymentMethod']>('Bank Transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [recordedBy, setRecordedBy] = useState('المحاسب المالي');
  const [attachmentName, setAttachmentName] = useState<string | undefined>(undefined);
  const [attachmentData, setAttachmentData] = useState<string | undefined>(undefined);

  if (!isOpen) return null;

  // Financial Calculations
  const grandTotal = po.grandTotal || 0;
  const subtotalExVat = po.totalAfterDiscount || po.subtotal || grandTotal / 1.15;
  const vatAmount = po.vatAmount || (grandTotal - subtotalExVat);
  
  const totalPaid = existingPayments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const remainingLiability = Math.max(0, grandTotal - totalPaid);
  const paidPercent = grandTotal > 0 ? Math.min(100, (totalPaid / grandTotal) * 100) : 0;

  const currentPaymentStatus: PurchaseOrder['paymentStatus'] =
    remainingLiability <= 0.01 && totalPaid > 0
      ? 'Paid in Full'
      : totalPaid > 0
      ? 'Partially Paid'
      : 'Unpaid';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachmentData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      alert('يرجى إدخال مبلغ دفعة صحيح أكبر من الصفر.');
      return;
    }

    if (numAmount > remainingLiability + 1) {
      if (
        !window.confirm(
          `المبلغ المدخل (${numAmount.toLocaleString()} SAR) يتجاوز الرصيد المتبقي (${remainingLiability.toLocaleString()} SAR). هل ترغب بالمتابعة؟`
        )
      ) {
        return;
      }
    }

    const newPayment: POPaymentRecord = {
      id: `pay-${Date.now()}`,
      poId: po.id,
      paymentDate,
      amount: numAmount,
      paymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      status: 'Paid',
      notes: notes.trim() || undefined,
      recordedBy: recordedBy.trim() || undefined,
      attachmentName,
      attachmentData,
      createdAt: new Date().toISOString(),
    };

    const updatedPayments = [newPayment, ...existingPayments];
    const newTotalPaid = updatedPayments
      .filter((p) => p.status === 'Paid')
      .reduce((s, p) => s + p.amount, 0);
    const newRemaining = Math.max(0, grandTotal - newTotalPaid);
    const newStatus: PurchaseOrder['paymentStatus'] =
      newRemaining <= 0.01 ? 'Paid in Full' : 'Partially Paid';

    const updatedPO: PurchaseOrder = {
      ...po,
      payments: updatedPayments,
      paidAmount: newTotalPaid,
      remainingBalance: newRemaining,
      paymentStatus: newStatus,
      status:
        newStatus === 'Paid in Full' && po.deliveryStatus === 'Delivered'
          ? 'Completed'
          : po.status,
    };

    onSavePayment(po.id, updatedPO);

    // Reset Form
    setAmount('');
    setReferenceNo('');
    setNotes('');
    setAttachmentName(undefined);
    setAttachmentData(undefined);
    setShowAddForm(false);
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا القيد المالي وسجل الدفعة؟')) return;

    const updatedPayments = existingPayments.filter((p) => p.id !== paymentId);
    const newTotalPaid = updatedPayments
      .filter((p) => p.status === 'Paid')
      .reduce((s, p) => s + p.amount, 0);
    const newRemaining = Math.max(0, grandTotal - newTotalPaid);
    const newStatus: PurchaseOrder['paymentStatus'] =
      newRemaining <= 0.01 && newTotalPaid > 0
        ? 'Paid in Full'
        : newTotalPaid > 0
        ? 'Partially Paid'
        : 'Unpaid';

    const updatedPO: PurchaseOrder = {
      ...po,
      payments: updatedPayments,
      paidAmount: newTotalPaid,
      remainingBalance: newRemaining,
      paymentStatus: newStatus,
    };

    onSavePayment(po.id, updatedPO);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  دفتر سداد دفعات المورد (Accounts Payable Ledger)
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-mono font-bold">
                  {po.poNumber}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                المورد: <strong className="text-white">{po.vendorName}</strong> | المشروع: <strong className="text-white">{po.projectName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Summary KPIs */}
        <div className="bg-slate-50 border-b border-slate-200 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 block">إجمالي أمر الشراء (مع الضريبة)</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {grandTotal.toLocaleString()} <span className="text-xs font-normal">SAR</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                صافي: {subtotalExVat.toLocaleString()} + ض.ق.م {vatAmount.toLocaleString()}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/40">
              <span className="text-[11px] text-emerald-800 font-bold block">إجمالي المسدد حتى الآن</span>
              <span className="text-base font-black text-emerald-700 font-mono">
                {totalPaid.toLocaleString()} <span className="text-xs font-normal">SAR</span>
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">
                نسبة السداد: {paidPercent.toFixed(1)}%
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/40">
              <span className="text-[11px] text-rose-800 font-bold block">الرصيد المتبقي (المستحق)</span>
              <span className="text-base font-black text-rose-700 font-mono">
                {remainingLiability.toLocaleString()} <span className="text-xs font-normal">SAR</span>
              </span>
              <span className="text-[10px] text-rose-600 block mt-0.5">
                {remainingLiability <= 0 ? 'تمت التسوية بالكامل ✓' : 'مستحق للمورد'}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-center">
              <span className="text-[11px] text-slate-500 block">حالة السداد المحاسبي</span>
              <div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                    currentPaymentStatus === 'Paid in Full'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : currentPaymentStatus === 'Partially Paid'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {currentPaymentStatus === 'Paid in Full'
                    ? 'مسدد بالكامل ✓'
                    : currentPaymentStatus === 'Partially Paid'
                    ? 'مسدد جزئياً ⏳'
                    : 'غير مسدد ⚠️'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1 font-mono">
              <span>نسبة الإنجاز المالي للسداد</span>
              <span>{paidPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  paidPercent >= 100
                    ? 'bg-emerald-500'
                    : paidPercent > 0
                    ? 'bg-blue-600'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800">
                سجل الدفعات والحوالات المسجلة ({existingPayments.length})
              </h4>
            </div>

            {!showAddForm && (
              <button
                type="button"
                onClick={() => {
                  setAmount(remainingLiability > 0 ? remainingLiability : '');
                  setShowAddForm(true);
                }}
                className="px-3.5 py-1.5 bg-[#007A5A] hover:bg-[#00664a] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ تسجيل دفعة جديدة للمورد</span>
              </button>
            )}
          </div>

          {/* Add Payment Form */}
          {showAddForm && (
            <form onSubmit={handleAddPayment} className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-700" />
                  <span>بيانات الدفعة المالية المصروفة</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    تاريخ الدفعة <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    المبلغ المسدد (SAR) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500 text-left"
                  />
                  {remainingLiability > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(remainingLiability)}
                      className="text-[10.5px] text-blue-700 hover:underline mt-1 block"
                    >
                      تعيين كامل المتبقي ({remainingLiability.toLocaleString()} SAR)
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    طريقة السداد <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="Bank Transfer">حوالة بنكية (Bank Transfer)</option>
                    <option value="Cheque">شيك بنكي (Cheque)</option>
                    <option value="Cash">نقدي (Cash)</option>
                    <option value="Letter of Credit">اعتماد مستندي (LC)</option>
                    <option value="Credit Card">بطاقة ائتمان</option>
                    <option value="Other">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    رقم المرجع / الشيك / الحوالة
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. TR-998822 / CHQ-1049"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    المسؤول عن التسجيل
                  </label>
                  <input
                    type="text"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    إيصال التحويل / السند (اختياري)
                  </label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                  />
                  {attachmentName && (
                    <span className="text-[10.5px] text-emerald-700 block mt-0.5 truncate">
                      ✓ {attachmentName}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">
                  ملاحظات أو شروط الدفعة
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: دفعة أولى 30% مقدمة حسب الاتفاقية التعاقدية"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-blue-200">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs transition"
                >
                  حفظ الدفعة في الدفتر المحاسبي
                </button>
              </div>
            </form>
          )}

          {/* Payments Table */}
          {existingPayments.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
              <Clock className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                لم يتم تسجيل أي دفعات مسددة لأمر الشراء هذا حتى الآن
              </p>
              <p className="text-[11px] text-slate-400">
                سجل الدفعات المقدمة أو المرحلية لتتبع الرصيد المتبقي بدقة متناهية.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-2.5">تاريخ الدفعة</th>
                    <th className="p-2.5">المبلغ المسدد</th>
                    <th className="p-2.5">طريقة السداد</th>
                    <th className="p-2.5">المرجع / الشيك</th>
                    <th className="p-2.5">الملاحظات</th>
                    <th className="p-2.5 text-center">المستند</th>
                    <th className="p-2.5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {existingPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-mono text-slate-800 font-semibold">
                        {pay.paymentDate}
                      </td>
                      <td className="p-2.5 font-mono font-black text-emerald-800 text-sm">
                        {pay.amount.toLocaleString()} SAR
                      </td>
                      <td className="p-2.5 text-slate-700">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                          {pay.paymentMethod === 'Bank Transfer'
                            ? 'حوالة بنكية'
                            : pay.paymentMethod === 'Cheque'
                            ? 'شيك'
                            : pay.paymentMethod === 'Cash'
                            ? 'نقدي'
                            : pay.paymentMethod}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">
                        {pay.referenceNo || '—'}
                      </td>
                      <td className="p-2.5 text-slate-600 max-w-[200px] truncate">
                        {pay.notes || '—'}
                      </td>
                      <td className="p-2.5 text-center">
                        {pay.attachmentData ? (
                          <a
                            href={pay.attachmentData}
                            download={pay.attachmentName || 'payment_receipt'}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-bold hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>عرض</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(pay.id)}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                          title="حذف القيد"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            تحديث أرصدة الموردين تلقائياً وترحيلها لتقارير التدفق المالي للمشروع.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            إغلاق الدفتر
          </button>
        </div>
      </div>
    </div>
  );
};
