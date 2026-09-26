import React from 'react';
import { PurchaseOrder, MaterialReceiptRecord } from '../types';
import { exportPurchaseOrderToPDF } from '../utils/purchaseOrderUtils';
import { CompanyHeader } from './CompanyHeader';
import { DocumentFooter } from './DocumentFooter';
import { COMPANY_PROFILE } from '../data/initialData';
import {
  Printer,
  Edit3,
  CheckCircle,
  ArrowRight,
  Share2,
  Copy,
  FileSpreadsheet,
  Download,
  PackageCheck,
  Receipt,
  Truck,
  CheckCircle2,
  Layers,
  ChevronLeft,
  RotateCcw,
  MessageCircle,
} from 'lucide-react';

interface PurchaseOrderDocumentProps {
  po: PurchaseOrder;
  onEdit?: (po: PurchaseOrder) => void;
  onClose?: () => void;
  onUpdateStatus?: (poId: string, newStatus: PurchaseOrder['status']) => void;
  onOpenReceiveMaterials?: (po: PurchaseOrder) => void;
  onOpenCreateDeliveryNote?: (po: PurchaseOrder, receipt?: MaterialReceiptRecord) => void;
  onDeleteMaterialReceipt?: (poId: string, receiptId: string) => void;
  onResetPOReceipts?: (poId: string) => void;
}

export const PurchaseOrderDocument: React.FC<PurchaseOrderDocumentProps> = ({
  po,
  onEdit,
  onClose,
  onUpdateStatus,
  onOpenReceiveMaterials,
  onOpenCreateDeliveryNote,
  onDeleteMaterialReceipt,
  onResetPOReceipts,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopySummary = () => {
    const text = `Purchase Order: ${po.poNumber}\nVendor: ${po.vendorName}\nProject: ${po.projectName} (${po.projectRef})\nDate: ${po.date}\nDelivery: ${po.deliveryDate}\nTotal: ${po.grandTotal.toLocaleString()} SAR (Incl. 15% VAT)\nStatus: ${po.status}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppSend = () => {
    const rawPhone = (po as any).vendorPhone || po.vendorPhoneEmail || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('05')) {
      cleanPhone = '966' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
      cleanPhone = '966' + cleanPhone;
    }

    let msg = `*${COMPANY_PROFILE.nameAr || 'شركة صناع الموارد التجاريه'}*\n*RMT COMMERCE & CONTRACTING*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📦 *أمر شراء وتوريد معتمد:* ${po.poNumber}\n`;
    msg += `🏢 *السادة المورد:* ${po.vendorName}\n`;
    msg += `🏗️ *المشروع:* ${po.projectName} (${po.projectRef || ''})\n`;
    msg += `📅 *تاريخ الإصدار:* ${po.date}\n`;
    msg += `🚚 *تاريخ التوريد المطلوب:* ${po.deliveryDate || 'حسب الاتفاق'}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 *عدد بنود التوريد:* ${(po.items || []).length} بند\n`;
    msg += `💰 *الإجمالي النهائي شامل ضريبة 15%:* ${po.grandTotal.toLocaleString()} ر.س\n`;
    msg += `📌 *شروط الدفع والتسليم:* ${po.paymentTerms || 'حسب الشروط المعتمدة بأمر الشراء'}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `نرجو التكرم بتأكيد استلام أمر الشراء والبدء في إجراءات التجهيز والتوريد.\n`;
    msg += `للتواصل والمتابعة: info@rmt-sa.com`;

    const encoded = encodeURIComponent(msg);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    exportPurchaseOrderToPDF(po);
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar (No-Print) */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-[#1e3a8a] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="العودة إلى أوامر الشراء"
            >
              <span>← العودة إلى أوامر الشراء</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-[#1e3a8a]">
                {po.poNumber}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  po.status === 'Issued'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : po.status === 'Approved'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : po.status === 'Completed'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {po.status === 'Issued'
                  ? 'صادر للموزع (Issued)'
                  : po.status === 'Approved'
                  ? 'معتمد (Approved)'
                  : po.status === 'Completed'
                  ? 'مكتمل التوريد (Delivered)'
                  : 'مسودة (Draft)'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مشروع: <span className="font-semibold text-slate-700">{po.projectName}</span> | الموزع: <span className="font-semibold text-slate-700">{po.vendorName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Receive Materials Action Button */}
          {onOpenReceiveMaterials && (
            <button
              type="button"
              onClick={() => onOpenReceiveMaterials(po)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-[#007A5A] hover:from-emerald-700 hover:to-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
              title="استلام وتوريد المواد وتسجيل الكميات والفوترة للعميل"
            >
              <PackageCheck className="w-4 h-4 text-emerald-200" />
              <span>استلام وتوريد المواد (Receive Materials)</span>
            </button>
          )}

          {/* Delivery Note Action Button (Activated Trigger) */}
          {onOpenCreateDeliveryNote && (
            <button
              type="button"
              onClick={() => onOpenCreateDeliveryNote(po)}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
              title="إصدار سند تسليم بضاعة للعميل مباشرة"
            >
              <Truck className="w-4 h-4 text-teal-200" />
              <span>إصدار سند تسليم للعميل (Delivery Note)</span>
            </button>
          )}

          {/* Status Changer */}
          {onUpdateStatus && (
            <select
              value={po.status}
              onChange={(e) => onUpdateStatus(po.id, e.target.value as PurchaseOrder['status'])}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Draft">مسودة (Draft)</option>
              <option value="Issued">صادر للموزع (Issued)</option>
              <option value="Approved">معتمد رسمياً (Approved)</option>
              <option value="Completed">مكتمل التوريد (Delivered)</option>
              <option value="Cancelled">ملغى (Cancelled)</option>
            </select>
          )}

          {po.attachedExcelFile && po.attachedExcelFile.dataUrl && (
            <a
              href={po.attachedExcelFile.dataUrl}
              download={po.attachedExcelFile.name}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
              title="تحميل ملف الإكسل المرفق بأمر الشراء"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">مرفق الإكسل ({po.attachedExcelFile.name})</span>
              <span className="sm:hidden">الإكسل</span>
              <Download className="w-3.5 h-3.5" />
            </a>
          )}

          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="نسخ ملخص أمر الشراء"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ الملخص'}</span>
          </button>

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(po)}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="تعديل أمر الشراء والبنود والأسعار والكميات"
            >
              <Edit3 className="w-4 h-4 text-[#1e3a8a]" />
              <span className="hidden sm:inline">تعديل الأمر (Edit)</span>
            </button>
          )}

          {onResetPOReceipts && (
            <button
              type="button"
              onClick={() => {
                onResetPOReceipts(po.id);
              }}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="إعادة ضبط الاستلام وتصفير الكميات لإعادة التعديل"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">إعادة ضبط الاستلام</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleWhatsAppSend}
            className="px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            title="إرسال ملخص أمر الشراء إلى المورد عبر الواتساب"
          >
            <MessageCircle className="w-4 h-4 fill-white/20" />
            <span>إرسال واتساب (WhatsApp)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#152e6f] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة أمر الشراء (Print PO)</span>
          </button>
        </div>
      </div>

      {/* Printable PO Document Canvas */}
      <div className="print-container bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 max-w-5xl mx-auto text-slate-800 text-xs">
        {/* Standard Company Header */}
        <CompanyHeader />

        {/* PO Document Header Bar */}
        <div className="my-4 bg-gradient-to-r from-[#1e3a8a] to-[#152e6f] text-white p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-extrabold uppercase tracking-wide">
              Purchase Order / أمر شراء وتوريد مواد
            </h2>
          </div>
          <div className="text-right font-mono">
            <span className="text-xs text-blue-200 block">PO Serial Number</span>
            <span className="text-sm font-black">{po.poNumber}</span>
          </div>
        </div>

        {/* 2-Column Vendor & Project Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
          {/* Vendor Details */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="font-bold text-[#1e3a8a] border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>Vendor / Supplier Details (بيانات المورد)</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500 font-medium">Name:</span>
              <span className="col-span-2 font-bold text-slate-900">{po.vendorName}</span>

              {(po.vendorContactPerson || (po as any).vendorContact) && (
                <>
                  <span className="text-slate-500 font-medium">Contact:</span>
                  <span className="col-span-2 text-slate-800">{po.vendorContactPerson || (po as any).vendorContact}</span>
                </>
              )}

              {po.vendorAddress && (
                <>
                  <span className="text-slate-500 font-medium">Address:</span>
                  <span className="col-span-2 text-slate-800">{po.vendorAddress}</span>
                </>
              )}

              {(po.vendorPhoneEmail || (po as any).vendorPhone) && (
                <>
                  <span className="text-slate-500 font-medium">Phone / Email:</span>
                  <span className="col-span-2 font-mono text-slate-800">{po.vendorPhoneEmail || (po as any).vendorPhone}</span>
                </>
              )}

              {(po.vendorVatNo || (po as any).vendorTaxNumber) && (
                <>
                  <span className="text-slate-500 font-medium">VAT / Tax No:</span>
                  <span className="col-span-2 font-mono font-bold text-[#1e3a8a]">{po.vendorVatNo || (po as any).vendorTaxNumber}</span>
                </>
              )}
            </div>
          </div>

          {/* Project & Order Details */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="font-bold text-[#1e3a8a] border-b border-slate-200 pb-1 flex items-center justify-between">
              <span>Order & Project Reference (بيانات المشروع والطلب)</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-slate-500 font-medium">PO Date:</span>
              <span className="col-span-2 font-mono font-bold text-slate-900">{po.date}</span>

              <span className="text-slate-500 font-medium">Project Name:</span>
              <span className="col-span-2 font-bold text-slate-900">{po.projectName}</span>

              <span className="text-slate-500 font-medium">Project Ref:</span>
              <span className="col-span-2 font-mono text-slate-800">{po.projectRef || 'N/A'}</span>

              <span className="text-slate-500 font-medium">Delivery Date:</span>
              <span className="col-span-2 font-mono text-slate-800">{po.deliveryDate || 'ASAP'}</span>

              <span className="text-slate-500 font-medium">Delivery Location:</span>
              <span className="col-span-2 text-slate-800">{po.deliveryTerms?.location || (po as any).deliveryLocation || 'موقع المشروع'}</span>

              <span className="text-slate-500 font-medium">Payment Terms:</span>
              <span className="col-span-2 text-slate-800">
                {typeof po.paymentTerms === 'string'
                  ? po.paymentTerms
                  : (po.paymentTerms?.schedule || po.paymentTerms?.method || '30 Days Net')}
              </span>
            </div>
          </div>
        </div>

        {/* PO Line Items Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-2.5 text-center w-10">#</th>
                <th className="p-2.5">Item Description (وصف البند والمواصفات)</th>
                <th className="p-2.5 text-center w-16">Unit</th>
                <th className="p-2.5 text-center w-16">Qty</th>
                <th className="p-2.5 text-left w-28">
                  <span>Unit Price</span>
                  <span className="block text-[9px] font-semibold text-teal-700">[Excl. VAT]</span>
                </th>
                <th className="p-2.5 text-left w-24 text-rose-700">
                  <span>Discount</span>
                  <span className="block text-[9px] font-normal text-rose-500">[Excl. VAT]</span>
                </th>
                <th className="p-2.5 text-left w-32 font-extrabold">
                  <span>Total (SAR)</span>
                  <span className="block text-[9px] font-semibold text-teal-700">[Excl. VAT]</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {po.items.map((item, idx) => {
                const lineGross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const lineDiscount = Number(item.discount) || (item.discountPercent ? (lineGross * item.discountPercent) / 100 : 0);
                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50 break-inside-avoid">
                    <td className="p-2.5 text-center font-bold text-slate-500">
                      {item.itemNo || idx + 1}
                    </td>
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900 whitespace-pre-line">{item.description}</div>
                    </td>
                    <td className="p-2.5 text-center text-slate-600 font-medium">
                      {item.unit || 'EA'}
                    </td>
                    <td className="p-2.5 text-center font-bold font-mono text-slate-800">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-left font-mono font-medium text-slate-700">
                      {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-left font-mono font-bold text-rose-600">
                      {lineDiscount > 0
                        ? `-${lineDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="p-2.5 text-left font-mono font-bold text-slate-900 bg-slate-50/50">
                      {item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals and Terms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 break-inside-avoid">
          {/* Terms & Notes */}
          <div className="border border-slate-200 rounded-lg p-3 text-xs space-y-2 bg-slate-50/30">
            <span className="font-bold text-[#1e3a8a] block border-b border-slate-200 pb-1">
              Terms & Conditions (الشروط والأحكام)
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
              <li>All materials must comply with standard project specifications and approved submittals.</li>
              <li>Official delivery note and original tax invoice are strictly required upon delivery.</li>
              <li>Payment will be processed according to agreed contract payment schedules.</li>
            </ul>
            {po.notes && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-700 block text-[11px]">Special Instructions:</span>
                <p className="text-slate-600 text-[11px] italic mt-0.5">{po.notes}</p>
              </div>
            )}
          </div>

          {/* Calculations Summary Card */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Gross Subtotal [Excl. VAT] (إجمالي البنود قبل الخصم):</span>
              <span className="font-mono font-bold text-slate-800">
                {po.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            {po.discount > 0 && (
              <div className="flex justify-between items-center text-rose-700">
                <span>Total Discount [Excl. VAT] (إجمالي الخصومات الممنوحة):</span>
                <span className="font-mono font-bold">
                  -{po.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-800 font-semibold pt-1 border-t border-slate-200">
              <span>Taxable Baseline [Excl. VAT] (المبلغ الخاضع للضريبة):</span>
              <span className="font-mono font-bold text-emerald-800">
                {po.totalAfterDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>VAT 15% [15% Tax Value] (ضريبة القيمة المضافة):</span>
              <span className="font-mono font-bold text-slate-800">
                {po.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>

            <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center text-[#1e3a8a]">
              <span className="font-extrabold text-sm">Grand Total [Incl. 15% VAT] (المجموع الإجمالي الشامل):</span>
              <span className="font-mono font-black text-base">
                {po.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </span>
            </div>
          </div>
        </div>

        {/* Procurement 4-Tier Protocol Document Footer */}
        <div className="signatures-block w-full">
          <DocumentFooter
            variant="purchase_order"
            projectManagerName={po.authorization?.preparedBy?.name || 'مسؤول المشتريات والتسعير'}
            projectManagerTitle={po.authorization?.preparedBy?.title || 'Procurement Specialist'}
            projectManagerRoleKey="procurement_officer"
            projectManagerSignatureUrl={po.authorization?.preparedBy?.signatureUrl}
            financeName={po.authorization?.reviewedBy?.name || ''}
            financeTitle={po.authorization?.reviewedBy?.title || 'Finance & Accounts Lead'}
            financeRoleKey="finance_accounts"
            financeSignatureUrl={po.authorization?.reviewedBy?.signatureUrl}
            dispatcherName={po.authorization?.approvedBy?.name || COMPANY_PROFILE.engineerName || ''}
            dispatcherTitle={po.authorization?.approvedBy?.title || 'General Manager'}
            dispatcherRoleKey="general_manager"
            dispatcherSignatureUrl={po.authorization?.approvedBy?.signatureUrl}
            className="mt-4 w-full"
          />
        </div>
      </div>

      {/* Material Receipts History section */}
      {po.materialReceipts && po.materialReceipts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 print:hidden" dir="rtl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                سجل حركات استلام المواد وتوريدات المورد (Material Receipts Log)
              </h3>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full font-mono">
                {po.materialReceipts.length} حركة استلام
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onOpenCreateDeliveryNote && (
                <button
                  type="button"
                  onClick={() => onOpenCreateDeliveryNote(po)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-[#007A5A] hover:from-teal-700 hover:to-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Truck className="w-4 h-4 text-emerald-200" />
                  <span>إصدار سند تسليم للعميل</span>
                </button>
              )}
              {onOpenReceiveMaterials && (
                <button
                  type="button"
                  onClick={() => onOpenReceiveMaterials(po)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>+ تسجيل استلام جديد</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {po.materialReceipts.map((rec) => (
              <div key={rec.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      #{rec.receiptNumber}
                    </span>
                    <span className="text-slate-600">بتاريخ: {rec.receiptDate || rec.createdAt?.split('T')[0] || 'اليوم'}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600">المستلم: <strong className="text-slate-800">{rec.receiverName || 'مستلم المواد'}</strong></span>
                    {rec.supplierDeliveryNoteNo && (
                      <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded border border-blue-200">
                        إشعار تسليم مورد: {rec.supplierDeliveryNoteNo}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenCreateDeliveryNote && (
                      <button
                        type="button"
                        onClick={() => onOpenCreateDeliveryNote(po, rec)}
                        className="px-3 py-1 bg-white hover:bg-emerald-50 text-[#007A5A] border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>إصدار سند تسليم بهذا الإشعار</span>
                      </button>
                    )}
                    {onDeleteMaterialReceipt && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMaterialReceipt(po.id, rec.id);
                        }}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="تراجع عن الاستلام وإلغاء الكميات"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>تراجع (Rollback)</span>
                      </button>
                    )}
                  </div>
                </div>

                {rec.receivedItems && rec.receivedItems.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden text-xs">
                    {rec.receivedItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5">
                        <span className="text-slate-800 font-semibold">{item.description}</span>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            الكمية المستلمة: {item.receivedQty} {item.unit || 'EA'}
                          </span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-500">
                            الكمية الأصلية: {item.orderedQty} {item.unit || 'EA'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {rec.notes && (
                  <p className="text-[11px] text-slate-500 italic">ملاحظات الفحص: {rec.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
