import React from 'react';
import { Invoice, InvoicePayment } from '../types';
import { CompanyHeader } from './CompanyHeader';
import { SignatureBox } from './SignatureBox';
import { tafqeetSAR } from '../utils/tafqeet';
import {
  Printer,
  X,
  FileText,
  CreditCard,
  Building,
  CheckCircle2,
  Calendar,
  Download,
  Paperclip,
} from 'lucide-react';
import { executePrint } from '../utils/printUtils';

interface PaymentReceiptDocumentProps {
  payment: InvoicePayment;
  invoice: Invoice;
  onClose: () => void;
}

export const PaymentReceiptDocument: React.FC<PaymentReceiptDocumentProps> = ({
  payment,
  invoice,
  onClose,
}) => {
  const receiptNo = payment.receiptNumber || `RCP-${(invoice.invoiceNumber || '').replace(/^INV-/, '')}-${payment.id ? String(payment.id).slice(-4) : '01'}`;
  const amountWords = tafqeetSAR(payment.amount);

  const handlePrint = () => {
    executePrint('official-payment-receipt', {
      documentTitle: `سند قبض مالي رسمي - ${receiptNo} - ${invoice.customerName}`,
    });
  };

  const handleDownloadAttachment = () => {
    if (!payment.attachmentData) return;
    const a = document.createElement('a');
    a.href = payment.attachmentData;
    a.download = payment.attachmentName || `payment-voucher-${receiptNo}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">
              سند قبض مالي رسمي (Official Payment Receipt Voucher) - {receiptNo}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {payment.attachmentData && (
              <button
                type="button"
                onClick={handleDownloadAttachment}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل السند المرفق</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة سند القبض (PDF / Print)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <div className="p-8 sm:p-10 bg-white text-slate-900 font-sans" dir="rtl" id="official-payment-receipt">
          {/* Company Official Letterhead Header */}
          <CompanyHeader showDivider={true} />

          {/* Receipt Title & Identification Badge */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pb-4 border-b-2 border-slate-900">
            <div>
              <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md text-xs font-bold font-mono">
                رسمي / معتمد (Official Receipt)
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                سند قبض مالي رسمي
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Payment Receipt Voucher
              </p>
            </div>

            <div className="text-left font-mono">
              <div className="text-xs text-slate-500">رقم السند (Receipt No.):</div>
              <div className="text-base font-black text-[#007A5A]">{receiptNo}</div>
              <div className="text-xs text-slate-500 mt-1">تاريخ الاستلام (Date):</div>
              <div className="text-xs font-bold text-slate-800">{payment.date}</div>
            </div>
          </div>

          {/* Beneficiary & Payer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">استلمنا من السادة (Received From):</span>
              <span className="font-bold text-slate-900 text-sm">{invoice.customerName}</span>
              {(invoice.customerVatNo || invoice.customerVatNumber) && (
                <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                  الرقم الضريبي: {invoice.customerVatNo || invoice.customerVatNumber}
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">اسم المشروع (Project Name):</span>
              <span className="font-bold text-slate-900 text-sm">{invoice.projectName}</span>
              <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                رقم المشروع: {invoice.projectNumber}
              </div>
            </div>
          </div>

          {/* Amount Box */}
          <div className="my-6 p-5 bg-emerald-50/70 border-2 border-emerald-500 rounded-xl text-center">
            <span className="text-xs font-bold text-emerald-800 block mb-1">
              المبلغ المستلم (Received Amount)
            </span>
            <div className="text-3xl font-black text-emerald-700 font-mono">
              {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
            </div>
            <div className="text-xs font-bold text-slate-800 mt-2 font-cairo">
              مبلغاً وقدره: <span className="underline decoration-emerald-500 underline-offset-4">{amountWords}</span>
            </div>
          </div>

          {/* Payment Details & Breakdown */}
          <div className="space-y-2 text-xs border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">طريقة السداد (Payment Method):</span>
              <span className="font-bold text-slate-900">
                {payment.paymentMethod === 'Bank Transfer'
                  ? 'تحويل بنكي (Bank Transfer)'
                  : payment.paymentMethod === 'Cheque'
                  ? 'شيك مصرفي (Cheque)'
                  : 'نقداً (Cash)'}
              </span>
            </div>

            {payment.referenceNo && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">رقم الحوالة / المرجع البنكي (Reference No.):</span>
                <span className="font-mono font-bold text-slate-900">{payment.referenceNo}</span>
              </div>
            )}

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">وذلك عن الفاتورة الضريبية رقم (For Invoice No.):</span>
              <span className="font-mono font-bold text-[#007A5A]">{invoice.invoiceNumber}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">إجمالي قيمة الفاتورة الأصلية (Invoice Grand Total):</span>
              <span className="font-mono text-slate-800">
                {invoice.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">إجمالي المبالغ المسددة حتى الآن (Total Paid to Date):</span>
              <span className="font-mono font-bold text-emerald-700">
                {invoice.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            <div className="flex justify-between py-1.5 font-bold">
              <span className="text-slate-700">الرصيد المتبقي على الفاتورة (Remaining Balance):</span>
              <span className={`font-mono text-sm ${invoice.remainingAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {invoice.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            {payment.notes && (
              <div className="pt-2 border-t border-slate-100 text-slate-600">
                <span className="font-bold block text-slate-700">ملاحظات:</span>
                <span>{payment.notes}</span>
              </div>
            )}

            {payment.attachmentName && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-emerald-800 bg-emerald-50/50 p-2 rounded">
                <div className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>تم إرفاق سند السداد البنكي: <strong>{payment.attachmentName}</strong></span>
                </div>
                {payment.attachmentData && (
                  <button
                    type="button"
                    onClick={handleDownloadAttachment}
                    className="text-[11px] underline font-bold"
                  >
                    فتح / تنزيل
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Official Seals and Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t-2 border-slate-200 text-xs text-center">
            <div>
              <SignatureBox
                roleKey="finance_accounts"
                label="قسم الحسابات والمالية (Accounts Department)"
                personName="Abdulrahman Al Moaili"
                personTitle="Finance & Accounts Lead"
                placeholderText="توقيع مسؤول الحسابات"
                heightClass="h-16"
              />
            </div>

            <div>
              <SignatureBox
                roleKey="general_manager"
                label="توقيع المستلم المعتمد (Authorized Signatory)"
                personName="مؤسسة صناع الموارد التجاريه"
                placeholderText="توقيع المستلم المعتمد"
                heightClass="h-16"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
