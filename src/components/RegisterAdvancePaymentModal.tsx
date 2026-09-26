import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  CreditCard,
  Hash,
  Paperclip,
  CheckCircle2,
  FileText,
  Download,
  Eye,
  Trash2,
  Printer,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { Project } from '../types';
import { CompanyHeader } from './CompanyHeader';
import { executePrint } from '../utils/printUtils';

interface RegisterAdvancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  contractValue?: number;
  onSaveAdvancePayment: (
    projectId: string,
    data: {
      amount: number;
      date: string;
      receiptNo: string;
      method?: 'Bank Transfer' | 'Cheque' | 'Cash';
      referenceNo?: string;
      notes?: string;
      attachmentName?: string;
      attachmentData?: string;
      attachmentType?: string;
      attachmentSize?: number;
    }
  ) => void;
}

export const RegisterAdvancePaymentModal: React.FC<RegisterAdvancePaymentModalProps> = ({
  isOpen,
  onClose,
  project,
  contractValue = 0,
  onSaveAdvancePayment,
}) => {
  const [amount, setAmount] = useState<string>(
    project.advancePaymentAmount ? String(project.advancePaymentAmount) : ''
  );
  const [date, setDate] = useState<string>(
    project.advancePaymentDate || new Date().toISOString().split('T')[0]
  );
  const [receiptNo, setReceiptNo] = useState<string>(
    project.advancePaymentReceiptNo || `ADV-RCP-${project.projectNumber.replace(/^PRJ-/, '')}-01`
  );
  const [method, setMethod] = useState<'Bank Transfer' | 'Cheque' | 'Cash'>(
    project.advancePaymentMethod || 'Bank Transfer'
  );
  const [referenceNo, setReferenceNo] = useState<string>(
    project.advancePaymentReferenceNo || ''
  );
  const [notes, setNotes] = useState<string>(
    project.advancePaymentNotes || 'دفعة مقدمة مستلمة وفق بنود التعاقد والاتفاق'
  );

  // Attachment state
  const [attachmentName, setAttachmentName] = useState<string>(
    project.advancePaymentAttachmentName || ''
  );
  const [attachmentData, setAttachmentData] = useState<string | undefined>(
    project.advancePaymentAttachmentData
  );
  const [attachmentType, setAttachmentType] = useState<string | undefined>(
    project.advancePaymentAttachmentType
  );
  const [attachmentSize, setAttachmentSize] = useState<number | undefined>(
    project.advancePaymentAttachmentSize
  );

  const [activeView, setActiveView] = useState<'form' | 'receipt'>('form');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 8MB max
    if (file.size > 8 * 1024 * 1024) {
      alert('حجم الملف كبير جداً، يرجى اختيار ملف بحجم أقل من 8 ميغابايت.');
      return;
    }

    setAttachmentName(file.name);
    setAttachmentType(file.type);
    setAttachmentSize(file.size);

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachmentName('');
    setAttachmentData(undefined);
    setAttachmentType(undefined);
    setAttachmentSize(undefined);
  };

  const handleDownloadAttachment = () => {
    if (!attachmentData) return;
    const a = document.createElement('a');
    a.href = attachmentData;
    a.download = attachmentName || 'advance-payment-receipt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleApplyPreset = (percent: number) => {
    if (contractValue > 0) {
      const calculated = Math.round((contractValue * percent) / 100);
      setAmount(String(calculated));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('يرجى إدخال مبلغ صالح للدفعة الأولى.');
      return;
    }

    onSaveAdvancePayment(project.id, {
      amount: numAmount,
      date,
      receiptNo,
      method,
      referenceNo,
      notes,
      attachmentName: attachmentName || undefined,
      attachmentData: attachmentData || undefined,
      attachmentType: attachmentType || undefined,
      attachmentSize: attachmentSize || undefined,
    });

    onClose();
  };

  const handlePrintReceipt = () => {
    executePrint('printable-advance-receipt', {
      documentTitle: `سند استلام دفعة مقدمة - ${project.customerName} - ${project.name}`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto print-modal-container"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between no-print border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>تسجيل واستلام الدفعة الأولى (Advance Payment)</span>
                <span className="text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">
                  {project.projectNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                مشروع: <span className="font-semibold text-white">{project.name}</span> • العميل:{' '}
                <span className="font-semibold text-white">{project.customerName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {project.advancePaymentAmount && project.advancePaymentAmount > 0 && (
              <button
                type="button"
                onClick={() => setActiveView(activeView === 'form' ? 'receipt' : 'form')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                {activeView === 'form' ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض سند القبض</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>تعديل البيانات</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode: Form or Receipt Preview */}
        {activeView === 'form' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Quick Summary Banner */}
            {contractValue > 0 && (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-600 block text-[11px]">إجمالي قيمة العقد / البيع:</span>
                  <span className="font-mono font-bold text-emerald-950 text-sm">
                    {contractValue.toLocaleString()} SAR
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 text-[11px]">نسب تعاقدية سريعة:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(50)}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold font-mono rounded-md border border-emerald-300 transition shadow-2xs"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(30)}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold font-mono rounded-md border border-emerald-300 transition shadow-2xs"
                  >
                    30%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(20)}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 font-bold font-mono rounded-md border border-emerald-300 transition shadow-2xs"
                  >
                    20%
                  </button>
                </div>
              </div>
            )}

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Amount */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>مبلغ الدفعة الأولى (SAR) *</span>
                  <span className="text-[10.5px] text-slate-400 font-normal">شامل ضريبة القيمة المضافة</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="مثال: 50000"
                    className="w-full pl-12 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#007A5A] focus:border-transparent font-mono font-bold text-slate-900 text-sm shadow-2xs"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    SAR
                  </span>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>تاريخ الاستلام والقبض *</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#007A5A] focus:border-transparent font-mono text-slate-800 shadow-2xs"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>طريقة السداد</span>
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#007A5A] focus:border-transparent text-slate-800 font-medium shadow-2xs cursor-pointer"
                >
                  <option value="Bank Transfer">تحويل بنكي (Bank Transfer)</option>
                  <option value="Cheque">شيك مصرفي (Cheque)</option>
                  <option value="Cash">سداد نقدي (Cash)</option>
                </select>
              </div>

              {/* Receipt / Voucher Number */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-slate-500" />
                  <span>رقم إيصال / سند القبض (Receipt No.)</span>
                </label>
                <input
                  type="text"
                  required
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="ADV-RCP-088-01"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#007A5A] focus:border-transparent font-mono text-slate-800 shadow-2xs"
                />
              </div>

              {/* Reference Number */}
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-800 mb-1.5">
                  رقم الحوالة البنكية / إشعار السداد المصرفي (Reference / Transaction No.)
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="مثال: TRF-99238411 أو رقم الشيك"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#007A5A] focus:border-transparent font-mono text-slate-800 shadow-2xs"
                />
              </div>
            </div>

            {/* Attachment Section (Matching Invoice Payment Voucher) */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-[#007A5A]" />
                  <span>إرفاق سند الدفع / إشعار السداد البنكي (PDF أو صورة) *</span>
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  كحد أقصى 8 ميغابايت
                </span>
              </label>

              {attachmentName ? (
                <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-emerald-950 truncate">{attachmentName}</p>
                      <p className="text-[10.5px] text-emerald-700">
                        {attachmentSize ? `${(attachmentSize / 1024).toFixed(1)} KB` : 'ملف مرفق معتمد'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadAttachment}
                      className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="تحميل المرفق"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">تحميل</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="حذف المرفق"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 hover:border-[#007A5A] rounded-xl p-4 bg-slate-50/70 hover:bg-emerald-50/30 transition text-center cursor-pointer">
                  <input
                    type="file"
                    id="advance-attachment-file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="advance-attachment-file"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-[#007A5A]">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      انقر هنا لاختيار ملف السند المرفق أو إشعار التحويل البنكي
                    </div>
                    <div className="text-[11px] text-slate-500">
                      يقبل ملفات الصور (JPG, PNG) أو مستندات PDF لإثبات الدفعة
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block font-bold text-slate-800 text-xs mb-1.5">
                ملاحظات وبيانات إضافية
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات حول البنك المستلم أو بنود التعاقد"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#007A5A] focus:border-transparent text-xs text-slate-800 shadow-2xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="submit"
                className="px-6 py-2.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ واعتماد الدفعة الأولى</span>
              </button>
            </div>
          </form>
        ) : (
          /* View Mode: Printable Receipt Voucher */
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center no-print">
              <span className="text-xs font-bold text-slate-600">
                معاينة سند القبض المالي المعتمد للدفعة الأولى:
              </span>
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="px-4 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة سند القبض (PDF)</span>
              </button>
            </div>

            {/* Printable Container */}
            <div
              id="printable-advance-receipt"
              className="bg-white border border-slate-200 rounded-xl p-6 text-slate-800 text-xs space-y-4 select-text"
            >
              {/* Header: Details on Right, Logo on Left */}
              <CompanyHeader showDivider={true} compact={true} />

              <div className="text-center py-2 border-b border-slate-200">
                <h4 className="text-base font-black text-slate-900 uppercase tracking-wide">
                  سند قبض مالي رسمي (Advance Payment Receipt Voucher)
                </h4>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  رقم السند: <strong className="text-slate-900">{receiptNo}</strong> • التاريخ:{' '}
                  <strong className="text-slate-900">{date}</strong>
                </p>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 font-sans">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    استلمنا من السادة / العميل:
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {project.customerName}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    مشروع:
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {project.name} ({project.projectNumber})
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    المبلغ المستلم:
                  </span>
                  <div className="font-bold font-mono text-base text-[#007A5A] mt-0.5">
                    {parseFloat(amount || '0').toLocaleString()} SAR
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    طريقة السداد والمرجع:
                  </span>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {method === 'Bank Transfer' ? 'تحويل بنكي' : method === 'Cheque' ? 'شيك' : 'نقداً'}
                    {referenceNo ? ` • مرجع: ${referenceNo}` : ''}
                  </div>
                </div>
              </div>

              {notes && (
                <div className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">البيان والغرض:</span>
                  <p className="text-slate-600">{notes}</p>
                </div>
              )}

              {attachmentName && (
                <div className="text-[11px] text-emerald-800 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-700" />
                  <span>تم إرفاق سند السداد البنكي الرسمي: <strong>{attachmentName}</strong></span>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-center">
                <div>
                  <div className="text-xs font-bold text-slate-700">المحاسب المالي / المستلم</div>
                  <div className="mt-8 text-xs font-bold text-slate-900 border-t border-slate-300 pt-1 inline-block min-w-[150px]">
                    مؤسسة صناع الموارد للتجاره RMT
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700">الختم والاعتماد الرسمي</div>
                  <div className="mt-8 text-xs font-bold text-slate-900 border-t border-slate-300 pt-1 inline-block min-w-[150px]">
                    ختم الإدارة المالية
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveView('form')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                الرجوع لتعديل البيانات
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
