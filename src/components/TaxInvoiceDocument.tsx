import React, { useState } from 'react';
import { Invoice, InvoicePayment, CustomerQuotation } from '../types';
import { COMPANY_PROFILE } from '../data/initialData';
import { generateZatcaTLVQR, exportInvoiceToPrint } from '../utils/invoiceUtils';
import { openPrintPopup } from '../utils/printUtils';
import { CompanyLogo } from './CompanyHeader';
import { DocumentFooter } from './DocumentFooter';
import { PaymentReceiptDocument } from './PaymentReceiptDocument';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  Printer,
  ArrowRight,
  CheckCircle2,
  Receipt,
  CreditCard,
  Plus,
  Copy,
  Calendar,
  DollarSign,
  AlertCircle,
  Clock,
  X,
  Paperclip,
  FileText,
  Download,
  Trash2,
  AlertTriangle,
  Pencil,
  Eye,
  Building,
  Tag,
} from 'lucide-react';

interface TaxInvoiceDocumentProps {
  invoice: Invoice;
  quotations?: CustomerQuotation[];
  sourceQuotation?: CustomerQuotation;
  onClose?: () => void;
  onRecordPayment?: (invoiceId: string, payment: InvoicePayment) => void;
  onUpdateStatus?: (invoiceId: string, newStatus: Invoice['status']) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onDeletePayment?: (invoiceId: string, paymentId: string) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onOpenQuotation?: (quotationId: string) => void;
}

export const TaxInvoiceDocument: React.FC<TaxInvoiceDocumentProps> = ({
  invoice,
  quotations = [],
  sourceQuotation: explicitSourceQuotation,
  onClose,
  onRecordPayment,
  onUpdateStatus,
  onDeleteInvoice,
  onDeletePayment,
  onUpdateInvoice,
  onOpenQuotation,
}) => {
  const { corporate, companyIdentity } = useMasterEnterpriseStore();
  const companyNameAr = companyIdentity?.officialArabicName || corporate?.nameAr || COMPANY_PROFILE.nameAr;
  const companyNameEn = companyIdentity?.officialEnglishName || corporate?.nameEn || COMPANY_PROFILE.nameEn;
  const crNumber = companyIdentity?.crNumber || corporate?.crNumber || COMPANY_PROFILE.crNumber;
  const vatNumber = companyIdentity?.vatNumber || corporate?.vatNumber || COMPANY_PROFILE.vatNumber;
  const bankName = companyIdentity?.bankName || corporate?.bankName || 'مصرف الراجحي (Al Rajhi Bank)';
  const bankIban = companyIdentity?.iban || corporate?.bankIban || 'SA71 8000 0450 6080 1000 1399';
  const bankAccountName = corporate?.bankAccountName || companyNameAr;
  const companyAddress = corporate?.addressAr || COMPANY_PROFILE.addressAr;

  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSourceQuotationModal, setShowSourceQuotationModal] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<InvoicePayment | null>(null);

  // Locate the source quotation
  const matchedSourceQuotation =
    explicitSourceQuotation ||
    quotations.find(
      (q) =>
        q.id === invoice.sourceQuotationId ||
        q.id === 'cust-quote-1' ||
        (invoice.projectId && q.projectId === invoice.projectId) ||
        (invoice.projectName && q.projectName?.toLowerCase() === invoice.projectName?.toLowerCase())
    ) ||
    null;

  // Quick Edit Modal state with Authorized Permissions
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [authorizedRole, setAuthorizedRole] = useState<'finance_officer' | 'project_manager' | 'cost_control'>('project_manager');
  const [authorizedByName, setAuthorizedByName] = useState('Eng. Mokhtar Yousef');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState(invoice.invoiceNumber || '');
  const [editDate, setEditDate] = useState(invoice.date || '');
  const [editDueDate, setEditDueDate] = useState(invoice.dueDate || '');
  const [editCustomerName, setEditCustomerName] = useState(invoice.customerName || '');
  const [editCustomerVatNumber, setEditCustomerVatNumber] = useState(invoice.customerVatNumber || '');
  const [editProjectName, setEditProjectName] = useState(invoice.projectName || '');
  const [editPoRef, setEditPoRef] = useState(invoice.poReference || '');
  const [editNotes, setEditNotes] = useState(invoice.notes || '');
  const [editDiscount, setEditDiscount] = useState(invoice.discount || 0);
  const [editAdvanceDeduction, setEditAdvanceDeduction] = useState(invoice.advanceDeduction || 0);
  const [editRetentionDeduction, setEditRetentionDeduction] = useState(invoice.retentionDeduction || 0);
  const [editItems, setEditItems] = useState(invoice.items || []);

  const handleOpenEditModal = () => {
    setEditInvoiceNumber(invoice.invoiceNumber || '');
    setEditDate(invoice.date || '');
    setEditDueDate(invoice.dueDate || '');
    setEditCustomerName(invoice.customerName || '');
    setEditCustomerVatNumber(invoice.customerVatNumber || '');
    setEditProjectName(invoice.projectName || '');
    setEditPoRef(invoice.poReference || '');
    setEditNotes(invoice.notes || '');
    setEditDiscount(invoice.discount || 0);
    setEditAdvanceDeduction(invoice.advanceDeduction || 0);
    setEditRetentionDeduction(invoice.retentionDeduction || 0);
    setEditItems(invoice.items ? JSON.parse(JSON.stringify(invoice.items)) : []);
    setShowQuickEditModal(true);
  };

  const handleSaveQuickEdit = () => {
    const newSubtotal = editItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
    const newTotalAfterDiscount = Math.max(0, newSubtotal - editDiscount);
    const newVatAmount = (newTotalAfterDiscount * (invoice.vatPercent || 15)) / 100;
    const newGrandTotal = newTotalAfterDiscount + newVatAmount;
    const newNetPayable = Math.max(0, newGrandTotal - editAdvanceDeduction - editRetentionDeduction);
    const newRemaining = Math.max(0, newNetPayable - (invoice.paidAmount || 0));

    const roleTitleMap = {
      project_manager: 'مدير المشاريع (Project Director)',
      finance_officer: 'المسؤول المالي (Financial Controller)',
      cost_control: 'مهندس التكاليف والفوترة (Cost Control)',
    };

    const updatedInvoice: Invoice = {
      ...invoice,
      invoiceNumber: editInvoiceNumber.trim() || invoice.invoiceNumber,
      date: editDate || invoice.date,
      dueDate: editDueDate || invoice.dueDate,
      customerName: editCustomerName.trim() || invoice.customerName,
      customerVatNumber: editCustomerVatNumber.trim() || invoice.customerVatNumber,
      projectName: editProjectName.trim() || invoice.projectName,
      poReference: editPoRef,
      notes: editNotes,
      discount: editDiscount,
      advanceDeduction: editAdvanceDeduction,
      retentionDeduction: editRetentionDeduction,
      items: editItems,
      subtotal: newSubtotal,
      totalAfterDiscount: newTotalAfterDiscount,
      vatAmount: newVatAmount,
      grandTotal: newGrandTotal,
      netPayableAmount: newNetPayable,
      remainingAmount: newRemaining,
      updatedAt: new Date().toISOString(),
      authorizedModificationNote: `تم التعديل الإداري والاعتماد بالصلاحية: ${authorizedByName} (${roleTitleMap[authorizedRole]}) بتاريخ ${new Date().toISOString().split('T')[0]}`,
    };

    if (onUpdateInvoice) {
      onUpdateInvoice(updatedInvoice);
    }
    setShowQuickEditModal(false);
  };
  const effectiveNetPayable = invoice.netPayableAmount !== undefined
    ? invoice.netPayableAmount
    : Math.max(0, invoice.grandTotal - (invoice.advanceDeduction || 0) - (invoice.retentionDeduction || 0));

  const effectiveRemaining = invoice.remainingAmount !== undefined
    ? invoice.remainingAmount
    : Math.max(0, effectiveNetPayable - invoice.paidAmount);

  const [paymentType, setPaymentType] = useState<'cash_collection' | 'advance_settlement' | 'combined'>('cash_collection');
  const [paymentAmount, setPaymentAmount] = useState(effectiveRemaining);
  const [cashPart, setCashPart] = useState(effectiveRemaining);
  const [advancePart, setAdvancePart] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Cheque'>('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('دفعة بنكية مسددة بموجب إشعار تحويل.');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentData, setAttachmentData] = useState<string | undefined>(undefined);
  const [attachmentType, setAttachmentType] = useState<string | undefined>(undefined);
  const [attachmentSize, setAttachmentSize] = useState<string | undefined>(undefined);

  const qrBase64 = generateZatcaTLVQR(
    companyNameAr || companyNameEn,
    vatNumber,
    invoice.date,
    invoice.grandTotal,
    invoice.vatAmount
  );

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    qrBase64
  )}`;

  const handleCopy = () => {
    const text = `فاتورة ضريبية: ${invoice.invoiceNumber}\nالمشروع: ${invoice.projectName}\nالعميل: ${invoice.customerName}\nالإجمالي شامل الضريبة: ${invoice.grandTotal.toLocaleString()} SAR\nالصافي المستحق بعد الخصومات: ${effectiveNetPayable.toLocaleString()} SAR\nالمسدد: ${invoice.paidAmount.toLocaleString()} SAR\nالمتبقي: ${effectiveRemaining.toLocaleString()} SAR`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReceiptAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentName(file.name);
    setAttachmentType(file.type);
    setAttachmentSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePayment = () => {
    let totalCredited = 0;
    let actualCash = 0;
    let actualAdvanceCredit = 0;

    if (paymentType === 'cash_collection') {
      totalCredited = paymentAmount;
      actualCash = paymentAmount;
      actualAdvanceCredit = 0;
    } else if (paymentType === 'advance_settlement') {
      totalCredited = paymentAmount;
      actualCash = 0;
      actualAdvanceCredit = paymentAmount;
    } else {
      actualCash = cashPart;
      actualAdvanceCredit = advancePart;
      totalCredited = cashPart + advancePart;
    }

    if (totalCredited <= 0) {
      alert('يرجى إدخال مبلغ دفع أو تسوية صالح.');
      return;
    }

    const receiptSeq = Math.floor(100 + Math.random() * 900);
    const newPayment: InvoicePayment = {
      id: `pay-${Date.now()}`,
      receiptNumber: `RCP-${invoice.invoiceNumber.replace(/^INV-/, '')}-${receiptSeq}`,
      date: paymentDate,
      amount: totalCredited,
      cashCollectedAmount: actualCash,
      advanceDeductionCredited: actualAdvanceCredit,
      paymentType,
      paymentMethod,
      referenceNo,
      notes: paymentNotes,
      attachmentName: attachmentName || undefined,
      attachmentData: attachmentData || undefined,
      attachmentType: attachmentType || undefined,
      attachmentSize: attachmentSize || undefined,
    };

    onRecordPayment?.(invoice.id, newPayment);
    setShowPaymentModal(false);
    // Reset attachment
    setAttachmentName('');
    setAttachmentData(undefined);
    setAttachmentType(undefined);
  };

  const isPaid = invoice.remainingAmount <= 0;

  return (
    <div className="space-y-4">
      {/* Top Action Bar (No-Print) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="الرجوع"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-[#007A5A]">
                {invoice.invoiceNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isPaid
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : invoice.paidAmount > 0
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {isPaid
                  ? 'مدفوعة بالكامل (Paid)'
                  : invoice.paidAmount > 0
                  ? 'مدفوعة جزئياً (Partially Paid)'
                  : 'صادرة للمطالبة (Issued / Unpaid)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مشروع: <span className="font-semibold text-slate-700">{invoice.projectName}</span> | العميل:{' '}
              <span className="font-semibold text-slate-700">{invoice.customerName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {matchedSourceQuotation && (
            <button
              type="button"
              onClick={() => setShowSourceQuotationModal(true)}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="عرض تفاصيل تسعيرة الأساس المرتبطة بهذه الفاتورة"
            >
              <Eye className="w-4 h-4 text-blue-600" />
              <span>عرض تسعيرة الأساس ({matchedSourceQuotation.quotationNumber || 'Source Quote'})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenEditModal}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
            title="تعديل بيانات الفاتورة والأصناف والمبالغ بصلاحيات المستخدم المصرح له"
          >
            <Pencil className="w-4 h-4 text-amber-400" />
            <span>تعديل الفاتورة بالصلاحية (Edit by Permission)</span>
          </button>

          {!isPaid && onRecordPayment && (
            <button
              type="button"
              onClick={() => {
                setPaymentAmount(invoice.remainingAmount);
                setShowPaymentModal(true);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>تسجيل دفعة مستلمة (Record Payment)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم النسخ' : 'نسخ ملخص الفاتورة'}</span>
          </button>

          <button
            type="button"
            onClick={() => exportInvoiceToPrint(invoice)}
            className="px-4 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
            title="طباعة الفاتورة أو حفظها بصيغة PDF"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الفاتورة الضريبية (PDF)</span>
          </button>

          <button
            type="button"
            onClick={() =>
              openPrintPopup(
                'printable-tax-invoice',
                `فاتورة ضريبية - ${invoice.invoiceNumber} - ${invoice.customerName}`
              )
            }
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="فتح في نافذة مستقلة للطباعة والتنسيق"
          >
            <span>نافذة مستقلة للطباعة</span>
          </button>

          {onDeleteInvoice && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="حذف هذه الفاتورة وإلغاء بياناتها وإعادة الأصناف غير مفوترة"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>حذف الفاتورة</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Saudi Tax Invoice Template (ZATCA compliant) */}
      <div
        id="printable-tax-invoice"
        className="bg-white border border-slate-300 rounded-lg shadow-md max-w-4xl mx-auto p-6 sm:p-10 text-slate-800 text-[12px] font-sans antialiased select-text"
        dir="rtl"
      >
        {/* Document Header: Company Details on RIGHT (يمين), Logo & Invoice Info on LEFT (يسار) */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-5 gap-4">
          {/* Right (يمين): Company Name, English Name, CR, VAT, Address */}
          <div className="text-right space-y-1 max-w-md">
            <h2 className="font-bold text-base text-[#174A84] font-cairo leading-tight">
              {companyNameAr}
            </h2>
            <p className="text-[11px] text-slate-600 uppercase font-semibold">
              {companyNameEn}
            </p>
            <div className="text-[10px] text-slate-600 font-mono mt-0.5 space-y-0.5">
              <p>
                سجل تجاري C.R: <strong className="text-slate-800">{crNumber}</strong>
                &nbsp;&nbsp;|&nbsp;&nbsp;الرقم الضريبي VAT:{' '}
                <strong className="text-[#007A5A]">{vatNumber}</strong>
              </p>
              <p>{companyAddress}</p>
            </div>
          </div>

          {/* Left (يسار): Authentic RM Logo + Tax Invoice Details */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-left font-mono space-y-0.5">
              <div className="bg-[#007A5A] text-white px-3 py-1 font-bold text-xs uppercase tracking-wider rounded-xs text-center mb-1">
                فاتورة ضريبية / TAX INVOICE
              </div>
              <div className="font-mono text-sm font-extrabold text-slate-900 text-right">
                #{invoice.invoiceNumber}
              </div>
              <div className="text-[10.5px] text-slate-500 text-right">
                الإصدار: <strong>{invoice.date}</strong>
              </div>
              <div className="text-[10.5px] text-slate-500 text-right">
                الاستحقاق: <strong>{invoice.dueDate}</strong>
              </div>
              {invoice.poReference && (
                <div className="text-[10px] text-blue-800 bg-blue-50 px-2 py-0.5 rounded text-right font-mono">
                  أمر شراء: {invoice.poReference}
                </div>
              )}
            </div>
            <CompanyLogo className="h-16 w-auto" />
          </div>
        </div>

        {/* Client Information Grid */}
        <div className="grid grid-cols-2 gap-4 mb-5 text-xs bg-slate-50/70 p-3.5 rounded-lg border border-slate-200 break-inside-avoid">
          <div className="space-y-1">
            <span className="text-[10.5px] font-bold text-[#007A5A] uppercase block">
              بيانات العميل (Customer / Billed To):
            </span>
            <div className="font-bold text-sm text-slate-900">{invoice.customerName}</div>
            <div className="text-slate-600">
              العنوان / الموقع: <span className="font-medium text-slate-800">{invoice.customerAddress || 'المملكة العربية السعودية'}</span>
            </div>
            <div className="text-slate-600">
              الرقم الضريبي للعميل: <span className="font-mono font-bold text-slate-800">{invoice.customerVatNo || '-'}</span>
            </div>
          </div>

          <div className="space-y-1 text-right">
            <span className="text-[10.5px] font-bold text-[#1e3a8a] uppercase block">
              بيانات المشروع والعقد (Project Reference):
            </span>
            <div className="font-bold text-sm text-slate-900">{invoice.projectName}</div>
            <div className="text-slate-600">
              رقم المشروع: <span className="font-mono font-bold text-slate-800">{invoice.projectNumber}</span>
            </div>
            <div className="text-slate-600">
              حالة الفاتورة:{' '}
              <span className="font-bold text-[#007A5A]">
                {isPaid ? 'خالصة ومسددة' : `متبقي للسداد: ${invoice.remainingAmount.toLocaleString()} SAR`}
              </span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-slate-300 rounded-xs mb-5 overflow-x-auto">
          <table className="w-full text-[11px] border-collapse text-right">
            <thead>
              <tr className="bg-[#007A5A] text-white">
                <th className="py-2 px-2 text-center w-10 font-bold border-l border-emerald-800">#</th>
                <th className="py-2 px-3 font-bold border-l border-emerald-800">بيان البنود والخدمات / Description</th>
                <th className="py-2 px-2 text-center w-16 font-bold border-l border-emerald-800">الكمية</th>
                <th className="py-2 px-2 text-center w-16 font-bold border-l border-emerald-800">الوحدة</th>
                <th className="py-2 px-3 text-left w-28 font-bold border-l border-emerald-800">
                  <span>سعر الوحدة</span>
                </th>
                <th className="py-2 px-3 text-left w-32 font-bold">
                  <span>المجموع الفرعي</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(invoice.items || []).map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-slate-50 transition break-inside-avoid">
                  <td className="py-2.5 px-2 text-center font-bold text-slate-500 border-l border-slate-200">
                    {it.itemNo || idx + 1}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-pre-line border-l border-slate-200">
                    <div>{it.description}</div>
                    {(it.deliveryNoteRef || it.clientPoItemNo) && (
                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono no-print">
                        {it.deliveryNoteRef && (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded border border-blue-200">
                            سند: {it.deliveryNoteRef}
                          </span>
                        )}
                        {it.clientPoItemNo && (
                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200">
                            بند أمر الشراء: #{it.clientPoItemNo}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800 border-l border-slate-200">
                    {it.quantity}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-600 border-l border-slate-200">
                    {it.unit}
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-slate-700 border-l border-slate-200 whitespace-nowrap">
                    {it.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900 whitespace-nowrap bg-slate-50/40">
                    {it.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary & ZATCA QR Code */}
        <div className="flex flex-wrap items-start justify-between gap-6 mb-6 break-inside-avoid">
          {/* ZATCA QR Code & Bank Info */}
          <div className="flex items-start gap-4">
            <div className="p-2 border border-slate-300 rounded bg-white shadow-2xs">
              <img
                src={qrImageUrl}
                alt="ZATCA E-Invoice QR Code"
                className="w-28 h-28 object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="text-[9px] text-slate-400 block text-center mt-1 font-mono">
                ZATCA Phase 1 QR
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-600 max-w-xs">
              <span className="font-bold text-slate-800 block">بيانات الحساب البنكي للسداد:</span>
              <p className="font-medium text-slate-800">{bankName}</p>
              <p className="font-mono text-[10px]">IBAN: {bankIban}</p>
              <p className="text-[10px] text-slate-500">
                باسم: {bankAccountName}
              </p>
            </div>
          </div>

          {/* Totals Table */}
          <div className="w-88 border border-slate-300 rounded-lg overflow-hidden text-xs bg-white shadow-xs">
            <div className="flex justify-between py-1.5 px-3 border-b border-slate-100">
              <div>
                <span className="text-slate-700 font-medium">المجموع الفرعي</span>
                <span className="text-[10px] text-slate-500 block font-normal">(Subtotal)</span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-left">
                {invoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            {invoice.discount > 0 && (
              <div className="flex justify-between py-1.5 px-3 border-b border-slate-100 text-rose-700">
                <div>
                  <span className="font-medium">الخصم التجاري</span>
                  <span className="text-[10px] text-rose-500 block font-normal">(Discount)</span>
                </div>
                <span className="font-mono font-bold text-left">
                  -{invoice.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </span>
              </div>
            )}

            <div className="flex justify-between py-1.5 px-3 border-b border-slate-100 bg-slate-50/50">
              <div>
                <span className="text-slate-700 font-medium">مبلغ ضريبة القيمة المضافة 15%</span>
                <span className="text-[10px] text-slate-500 block font-normal">(مبلغ الضريبة / VAT 15% Amount)</span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-left">
                {invoice.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            <div className="flex justify-between py-2 px-3 bg-slate-100/90 border-b border-slate-200 text-slate-900 font-bold">
              <div>
                <span>إجمالي الفاتورة مع الضريبة</span>
                <span className="text-[10px] text-slate-600 block font-medium">(شامل ضريبة القيمة المضافة 15% / VAT Inclusive)</span>
              </div>
              <span className="font-mono font-black text-sm text-left">
                {invoice.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            {(invoice.advanceDeduction && invoice.advanceDeduction > 0) ? (
              <div className="flex justify-between py-1.5 px-3 border-b border-slate-100 text-blue-700 bg-blue-50/40">
                <div>
                  <span className="font-medium">استقطاع الدفعة المقدمة المستهلكة ({invoice.advanceDeductionPercent || 0}%)</span>
                  <span className="text-[10px] text-blue-600 block font-normal">(شامل الضريبة / VAT Inclusive)</span>
                </div>
                <span className="font-mono font-bold text-left">
                  -{invoice.advanceDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </span>
              </div>
            ) : null}

            {(invoice.retentionDeduction && invoice.retentionDeduction > 0) ? (
              <div className="flex justify-between py-1.5 px-3 border-b border-slate-100 text-amber-700 bg-amber-50/40">
                <div>
                  <span className="font-medium">استقطاع محجوز الضمان ({invoice.retentionDeductionPercent || 0}%)</span>
                  <span className="text-[10px] text-amber-600 block font-normal">(شامل الضريبة / VAT Inclusive)</span>
                </div>
                <span className="font-mono font-bold text-left">
                  -{invoice.retentionDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </span>
              </div>
            ) : null}

            <div className="flex justify-between py-2 px-3 bg-[#007A5A] text-white font-extrabold text-xs">
              <div>
                <span>صافي المستحق للمطالبة والتحصيل</span>
                <span className="text-[10px] text-emerald-100 block font-normal">(شامل ضريبة القيمة المضافة / VAT Inclusive)</span>
              </div>
              <span className="font-mono text-sm text-left">
                {effectiveNetPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            <div className="flex justify-between py-1.5 px-3 border-b border-slate-100 bg-emerald-50/70 text-emerald-900 font-medium">
              <div>
                <span>المبالغ المحصلة والمسددة</span>
                <span className="text-[10px] text-emerald-700 block font-normal">(شامل الضريبة / VAT Inclusive)</span>
              </div>
              <span className="font-mono font-bold text-left">
                {invoice.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            <div className="flex justify-between py-1.5 px-3 bg-slate-50 font-bold text-slate-900">
              <div>
                <span>الرصيد المتبقي للتحصيل</span>
                <span className="text-[10px] text-slate-500 block font-normal">(شامل الضريبة / VAT Inclusive)</span>
              </div>
              <span className={`font-mono text-xs text-left ${effectiveRemaining > 0 ? 'text-rose-700 font-black' : 'text-emerald-700'}`}>
                {effectiveRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>
          </div>
        </div>

        {/* Payments History if any */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="mb-6 p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
            <span className="text-xs font-bold text-emerald-900 block mb-2.5">
              سجل الدفعات والتسويات المسددة بموجب هذه الفاتورة:
            </span>
            <div className="space-y-2 text-[11px]">
              {invoice.payments.map((p, i) => (
                <div
                  key={p.id || i}
                  className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded-lg border border-emerald-100 shadow-2xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-slate-800">
                      بتاريخ <strong className="font-mono">{p.date}</strong> - طريقة السداد: {p.paymentMethod} {p.referenceNo ? `(مرجع: ${p.referenceNo})` : ''}
                      {p.advanceDeductionCredited ? (
                        <span className="text-blue-700 font-medium mr-1.5">
                          [تسوية من رصيد دفعة مقدمة: {p.advanceDeductionCredited.toLocaleString()} SAR]
                        </span>
                      ) : null}
                      {p.cashCollectedAmount ? (
                        <span className="text-emerald-700 font-medium mr-1.5">
                          [تحصيل نقدي/بنكي: {p.cashCollectedAmount.toLocaleString()} SAR]
                        </span>
                      ) : null}
                    </div>
                    {p.attachmentName && (
                      <div className="text-[10.5px] text-emerald-700 flex items-center gap-1 font-medium">
                        <Paperclip className="w-3 h-3" />
                        <span>مرفق سند دفع: {p.attachmentName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-emerald-800 text-xs">
                      {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </span>

                    <button
                      type="button"
                      onClick={() => setSelectedReceiptPayment(p)}
                      className="px-2.5 py-1 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-md text-[10.5px] font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>عرض سند القبض الرسمي</span>
                    </button>

                    {onDeletePayment && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف هذه الدفعة بقيمة ${p.amount.toLocaleString()} SAR؟`)) {
                            onDeletePayment(invoice.id, p.id || String(i));
                          }
                        }}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition cursor-pointer"
                        title="حذف هذه الدفعة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dedicated 2-Role Invoice Document Footer (Accounting & Finance + Project Management) */}
        <DocumentFooter
          variant="invoice"
          projectManagerName={companyIdentity?.engineerName || corporate?.engineerName || COMPANY_PROFILE.engineerName || ''}
          projectManagerTitle="Projects Manager (مدير المشاريع)"
          projectManagerRoleKey="projects_manager"
          financeName={companyIdentity?.financeDirector || corporate?.financeDirector || COMPANY_PROFILE.financeDirector || ''}
          financeTitle="Finance & Accounts Lead"
          financeRoleKey="finance_accounts"
          notes={invoice.notes}
          className="mt-6"
        />
      </div>

      {/* Payment Recording Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>تسجيل دفعة / تسوية للفاتورة #{invoice.invoiceNumber}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نوع عملية السداد / التسوية
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg text-[10.5px] font-semibold text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('cash_collection');
                      setPaymentAmount(effectiveRemaining);
                    }}
                    className={`py-1.5 px-2 rounded-md transition ${
                      paymentType === 'cash_collection'
                        ? 'bg-white text-emerald-800 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تحصيل نقدي/بنكي
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('advance_settlement');
                      setPaymentAmount(effectiveRemaining);
                    }}
                    className={`py-1.5 px-2 rounded-md transition ${
                      paymentType === 'advance_settlement'
                        ? 'bg-white text-blue-800 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تسوية دفعة مقدمة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentType('combined');
                      setCashPart(Math.max(0, effectiveRemaining / 2));
                      setAdvancePart(Math.max(0, effectiveRemaining / 2));
                    }}
                    className={`py-1.5 px-2 rounded-md transition ${
                      paymentType === 'combined'
                        ? 'bg-white text-indigo-800 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    سداد مركب
                  </button>
                </div>
              </div>

              {paymentType !== 'combined' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {paymentType === 'advance_settlement' ? 'المبلغ المسوى من رصيد الدفعة المقدمة (SAR)' : 'المبلغ النقدي / المحول المسدد (SAR)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={effectiveRemaining}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-base text-emerald-700"
                  />
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    الصافي المتبقي للتحصيل: {effectiveRemaining.toLocaleString()} SAR
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                      تحصيل نقدي/بنكي (SAR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={cashPart}
                      onChange={(e) => setCashPart(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                      تسوية دفعة مقدمة (SAR)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={advancePart}
                      onChange={(e) => setAdvancePart(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-blue-700"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  تاريخ السداد / القيد
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  طريقة السداد
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded font-semibold"
                >
                  <option value="Bank Transfer">تحويل بنكي (Bank Transfer)</option>
                  <option value="Cheque">شيك مصرفي (Cheque)</option>
                  <option value="Cash">نقداً (Cash)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  رقم الحوالة / إشعار السداد البنكي
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. TRF-99238411"
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  إرفاق سند الدفع / إشعار السداد البنكي (اختياري - PDF أو صورة)
                </label>
                <div className="border border-dashed border-slate-300 rounded-lg p-2.5 bg-slate-50 text-center hover:bg-slate-100 transition">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReceiptAttachmentChange}
                    className="hidden"
                    id="payment-receipt-upload"
                  />
                  <label
                    htmlFor="payment-receipt-upload"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1 text-slate-600"
                  >
                    <Paperclip className="w-4 h-4 text-[#007A5A]" />
                    <span className="text-[11px] font-semibold text-[#007A5A]">
                      {attachmentName ? `تم اختيار: ${attachmentName}` : 'انقر لاختيار ملف السند أو الإشعار البنكي'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      يتم حفظ السند لإصدار تقرير رسمي بالهيدليتر للعميل
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ملاحظات الدفعة
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 border border-slate-300 rounded text-xs text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSavePayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition"
              >
                حفظ وإثبات الدفعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Payment Receipt Document Modal */}
      {selectedReceiptPayment && (
        <PaymentReceiptDocument
          payment={selectedReceiptPayment}
          invoice={invoice}
          onClose={() => setSelectedReceiptPayment(null)}
        />
      )}

      {/* Delete Invoice Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف الفاتورة الضريبية</h3>
                <p className="text-xs text-rose-600 font-mono font-bold">{invoice.invoiceNumber}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5">
              <div className="flex justify-between">
                <span>المشروع:</span>
                <strong className="text-slate-800">{invoice.projectName}</strong>
              </div>
              <div className="flex justify-between">
                <span>العميل:</span>
                <strong className="text-slate-800">{invoice.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>إجمالي الفاتورة:</span>
                <strong className="font-mono text-slate-900 font-bold">
                  {invoice.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </strong>
              </div>
              {invoice.paidAmount > 0 && (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>المبلغ المسدد المسجل:</span>
                  <span className="font-mono">{invoice.paidAmount.toLocaleString()} SAR</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                ⚠️ سيؤدي حذف الفاتورة إلى إزالتها نهائياً، وإلغاء أي سندات قبض مسجلة عليها، وإعادة الأصناف إلى حالة غير مفوترة (Unbilled) في المشروع لتمكينك من إعادة فوترتها وتصحيحها.
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
                  if (onDeleteInvoice) onDeleteInvoice(invoice.id);
                  if (onClose) onClose();
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد حذف الفاتورة نهائياً</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authorized Permissions Invoice Edit Modal */}
      {showQuickEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-6">
            {/* Header with Permission Badge */}
            <div className="flex flex-wrap items-center justify-between pb-3.5 border-b border-slate-200 mb-4 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">تعديل بيانات الفاتورة بالصلاحية الإدارية المعتمدة</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                    صلاحية تعديل معتمدة (Authorized Permission)
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  رقم الفاتورة: <strong className="text-[#007A5A]">{invoice.invoiceNumber}</strong> | المشروع: {invoice.projectName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Permission & Authorization Identity Banner */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-800">بيانات المستخدم المصرح له بالتعديل والاعتماد:</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  تاريخ الإجراء: {new Date().toISOString().split('T')[0]}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">الصفة والصلاحية المعتمدة:</label>
                  <select
                    value={authorizedRole}
                    onChange={(e) => setAuthorizedRole(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                  >
                    <option value="project_manager">مدير المشاريع والتكاليف (Project Director / Manager)</option>
                    <option value="finance_officer">المدير المالي والاعتمادات (Chief Financial Officer / Controller)</option>
                    <option value="cost_control">المحاسب المعتمد ومهندس التكاليف (Senior Cost Control)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">اسم المسؤول المعتمد:</label>
                  <input
                    type="text"
                    value={authorizedByName}
                    onChange={(e) => setAuthorizedByName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
              {/* Primary Invoice Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الفاتورة الضريبية</label>
                  <input
                    type="text"
                    value={editInvoiceNumber}
                    onChange={(e) => setEditInvoiceNumber(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الإصدار</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              {/* Customer & Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم العميل / الشركة</label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الرقم الضريبي للعميل (VAT No)</label>
                  <input
                    type="text"
                    value={editCustomerVatNumber}
                    onChange={(e) => setEditCustomerVatNumber(e.target.value)}
                    placeholder="e.g. 300000000000003"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المشروع</label>
                  <input
                    type="text"
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">مرجع أمر الشراء (PO Reference)</label>
                  <input
                    type="text"
                    value={editPoRef}
                    onChange={(e) => setEditPoRef(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Deductions & Discounts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">
                    الخصم التجاري (SAR)
                  </label>
                  <span className="text-[10px] text-slate-500 block mb-1 font-normal">(Commercial Discount)</span>
                  <input
                    type="number"
                    min={0}
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(Number(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">
                    استقطاع دفعة مقدمة (SAR)
                  </label>
                  <span className="text-[10px] text-slate-500 block mb-1 font-normal">(شامل الضريبة / VAT Inclusive)</span>
                  <input
                    type="number"
                    min={0}
                    value={editAdvanceDeduction}
                    onChange={(e) => setEditAdvanceDeduction(Number(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono text-blue-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">
                    استقطاع محجوز الضمان (SAR)
                  </label>
                  <span className="text-[10px] text-slate-500 block mb-1 font-normal">(شامل الضريبة / VAT Inclusive)</span>
                  <input
                    type="number"
                    min={0}
                    value={editRetentionDeduction}
                    onChange={(e) => setEditRetentionDeduction(Number(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono text-amber-700 font-bold"
                  />
                </div>
              </div>

              {/* Line Items Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-800">
                    بنود الفاتورة والأسعار (Invoice Items & Quantities)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextNo = editItems.length + 1;
                      setEditItems([
                        ...editItems,
                        {
                          id: `inv-item-${Date.now()}-${nextNo}`,
                          itemNo: nextNo,
                          description: 'بند إضافي / توريد وتركيب',
                          quantity: 1,
                          unit: 'Pcs',
                          unitPrice: 0,
                          totalPrice: 0,
                        },
                      ]);
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#007A5A] rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند جديد للفاتورة</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {editItems.map((item, idx) => (
                    <div key={item.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <span className="text-[10px] text-slate-500 block mb-0.5">وصف البند #{idx + 1}:</span>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const desc = e.target.value;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, description: desc } : it));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs font-medium"
                          />
                        </div>
                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditItems(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition cursor-pointer mt-4"
                            title="حذف هذا البند من الفاتورة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 block">الكمية:</span>
                          <input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val, totalPrice: val * it.unitPrice } : it));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            سعر الوحدة (Unit Price):
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: val, totalPrice: it.quantity * val } : it));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            الإجمالي (Total):
                          </span>
                          <div className="p-1.5 bg-slate-100 rounded border border-slate-200 font-mono font-bold text-slate-800 text-left text-xs">
                            {(item.quantity * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Calculation Summary in Modal */}
              {(() => {
                const sub = editItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
                const afterDisc = Math.max(0, sub - editDiscount);
                const vat = (afterDisc * 15) / 100;
                const grand = afterDisc + vat;
                const net = Math.max(0, grand - editAdvanceDeduction - editRetentionDeduction);
                return (
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs space-y-1">
                    <div className="font-bold text-emerald-900 mb-1.5">معاينة الحسابات الضريبية للفاتورة:</div>
                    <div className="flex justify-between text-slate-600">
                      <span>المجموع الفرعي (Subtotal):</span>
                      <strong className="font-mono">{sub.toLocaleString()} SAR</strong>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>مبلغ ضريبة القيمة المضافة 15% (VAT 15% Amount):</span>
                      <strong className="font-mono">{vat.toLocaleString()} SAR</strong>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-emerald-200 pt-1">
                      <span>الإجمالي شامل ضريبة القيمة المضافة 15% (VAT Inclusive):</span>
                      <strong className="font-mono text-sm">{grand.toLocaleString()} SAR</strong>
                    </div>
                    <div className="flex justify-between font-bold text-[#007A5A] pt-0.5">
                      <span>صافي المطالبة بعد الاستقطاعات (شامل الضريبة / VAT Inclusive):</span>
                      <strong className="font-mono text-sm">{net.toLocaleString()} SAR</strong>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات وشروط الفاتورة (Notes & Terms)</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
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
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>حفظ التعديلات والاعتماد بالصلاحية (Save & Authorize)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Quotation Modal */}
      {showSourceQuotationModal && matchedSourceQuotation && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-slate-900 to-[#0F1B33] text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-2xl border border-blue-400/30 text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>تسعيرة الأساس المعتمدة (Source Quotation)</span>
                    <span className="text-xs bg-blue-500/30 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md font-mono">
                      {matchedSourceQuotation.quotationNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    مشروع: <span className="text-white font-semibold">{matchedSourceQuotation.projectName || invoice.projectName}</span> | العميل: <span className="text-white font-semibold">{matchedSourceQuotation.customerName || invoice.customerName}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSourceQuotationModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">إجمالي القيمة قبل الضريبة</span>
                  <strong className="font-mono text-slate-900 text-sm">
                    {(matchedSourceQuotation.totals?.customerSellingPrice || 0).toLocaleString()} SAR
                  </strong>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">ضريبة القيمة المضافة (15%)</span>
                  <strong className="font-mono text-emerald-700 text-sm">
                    {(matchedSourceQuotation.totals?.vatAmount || (matchedSourceQuotation.totals?.customerSellingPrice || 0) * 0.15).toLocaleString()} SAR
                  </strong>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">الإجمالي النهائي شامل الضريبة</span>
                  <strong className="font-mono text-[#007A5A] text-sm">
                    {(matchedSourceQuotation.totals?.grandTotalWithVat || 0).toLocaleString()} SAR
                  </strong>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-400 block">حالة الاعتماد</span>
                  <strong className="text-emerald-700 font-bold">
                    {matchedSourceQuotation.status === 'Approved' ? 'معتمد رسمياً' : matchedSourceQuotation.status || 'معتمد'}
                  </strong>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-500" />
                  <span>جدول بنود التسعيرة والكميات المعتمدة ({matchedSourceQuotation.items?.length || 0} بنود):</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">بيان الصنف والمواصفات</th>
                        <th className="py-2.5 px-3 text-center">الكمية</th>
                        <th className="py-2.5 px-3 text-center">الوحدة</th>
                        <th className="py-2.5 px-3 text-left">سعر الوحدة للبيع</th>
                        <th className="py-2.5 px-3 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {(matchedSourceQuotation.items || []).map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{item.itemNo || idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <p className="font-medium text-slate-900">{item.description}</p>
                            {item.manufacturer && (
                              <span className="text-[10px] text-slate-500 block">المصنّع: {item.manufacturer} {item.model ? `| الموديل: ${item.model}` : ''}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-center text-slate-500">{item.unit || 'EA'}</td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-700">
                            {(item.sellingUnitPrice || 0).toLocaleString()} SAR
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-black text-slate-900">
                            {(item.sellingTotalPrice || (item.quantity || 0) * (item.sellingUnitPrice || 0)).toLocaleString()} SAR
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes & Payment Terms */}
              {matchedSourceQuotation.terms && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">شروط الدفع والتعاقد الأساسية:</span>
                  <div className="text-[11px] text-slate-600 leading-relaxed space-y-1">
                    {matchedSourceQuotation.terms.paymentTerms?.map((pt, i) => (
                      <p key={i}>• {pt}</p>
                    ))}
                    {matchedSourceQuotation.terms.validity && (
                      <p className="font-medium text-slate-700 mt-1">صلاحية العرض: {matchedSourceQuotation.terms.validity}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                مرجع التسعيرة: <strong className="font-mono text-slate-800">{matchedSourceQuotation.id}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowSourceQuotationModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
