import React, { useState, useEffect } from 'react';
import { PurchaseOrder } from '../types';
import { Printer, X, Download, ShieldCheck, CheckCircle2, Stamp } from 'lucide-react';
import { executePrint } from '../utils/printUtils';
import { exportPurchaseOrderToWord } from '../utils/purchaseOrderUtils';
import { GovernanceSignatures } from './GovernanceSignatures';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';

interface PurchaseOrderPrintProps {
  po: PurchaseOrder;
  onClose?: () => void;
  showControls?: boolean;
}

export const PurchaseOrderPrint: React.FC<PurchaseOrderPrintProps> = ({
  po,
  onClose,
  showControls = true,
}) => {
  const { companyIdentity } = useMasterEnterpriseStore();
  const companyNameAr = companyIdentity?.officialArabicName || 'مؤسسة صناع الموارد التجارية';
  const companyNameEn = companyIdentity?.officialEnglishName || 'RESOURCE MAKERS TRADING EST.';
  const customLogo = companyIdentity?.logoUrl || (typeof window !== 'undefined' ? localStorage.getItem('rmt_company_logo') : null);
  const [showGovModal, setShowGovModal] = useState(false);

  // Persistent Signatures & Stamp loaded directly from strict enterprise localStorage keys
  const [signatures, setSignatures] = useState({
    prepared: '',
    reviewed: '',
    approved: '',
    seal: '',
  });

  const loadSignatures = () => {
    if (typeof window === 'undefined') return;
    setSignatures({
      prepared: localStorage.getItem('rmt_sig_prepared') || po.authorization?.preparedBy?.signatureUrl || '',
      reviewed: localStorage.getItem('rmt_sig_reviewed') || po.authorization?.reviewedBy?.signatureUrl || '',
      approved: localStorage.getItem('rmt_sig_approved') || po.authorization?.approvedBy?.signatureUrl || '',
      seal: localStorage.getItem('rmt_company_seal') || '',
    });
  };

  useEffect(() => {
    loadSignatures();

    const handleStorageChange = () => {
      loadSignatures();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('rmt_signatures_updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('rmt_signatures_updated', handleStorageChange);
    };
  }, [po]);

  const handlePrint = () => {
    executePrint(`po-print-${po.id || po.poNumber}`, {
      documentTitle: `أمر شراء وتوريد مواد - ${po.poNumber}`,
    });
  };

  const handleExportWord = async () => {
    try {
      await exportPurchaseOrderToWord(po);
    } catch (err) {
      console.error('Word export failed:', err);
    }
  };

  return (
    <div className="w-full">
      {/* Dynamic Print CSS Style Engine */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          html, body {
            height: auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          table {
            page-break-inside: auto;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          .signatures-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 1.5rem;
            display: flex;
            justify-content: space-between;
          }
        }
      `}</style>

      {/* Screen Control Bar */}
      {showControls && (
        <div className="no-print mb-4 p-3 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <span className="font-mono text-emerald-400 font-extrabold text-sm sm:text-base">
              {po.poNumber}
            </span>
            <span className="text-xs text-slate-300 hidden sm:inline">
              أمر شراء وتوريد مواد رسمي معتمد (Official Purchase Order)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGovModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
              title="إدارة ورفع التواقيع المعتمدة والأختام الرسمية"
            >
              <Stamp className="w-3.5 h-3.5 text-amber-400" />
              <span>إدارة التواقيع والختم</span>
            </button>

            <button
              type="button"
              onClick={handleExportWord}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="تصدير أمر الشراء إلى مستند Word (.docx)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير Word</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              title="طباعة أمر الشراء أو حفظ كـ PDF"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة المستند / PDF</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Printable Purchase Order Container */}
      <div
        id={`po-print-${po.id || po.poNumber}`}
        className="print-container bg-white text-slate-900 p-6 sm:p-10 rounded-xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 max-w-4xl mx-auto"
        dir="rtl"
      >
        {/* Official Header */}
        <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
          <div className="text-right">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
              {companyNameAr}
            </h1>
            <p className="text-xs font-bold text-[#1e3a8a] mt-0.5 uppercase">
              {companyNameEn}
            </p>
            <p className="text-[10px] text-slate-600 mt-1">
              {companyIdentity?.addressAr || companyIdentity?.addressEn || 'المملكة العربية السعودية - المنطقة الشرقية - الدمام'}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-mono mt-0.5">
              <span>س.ت: {companyIdentity?.crNumber || '2050167793'}</span>
              <span>الرقم الضريبي: {companyIdentity?.vatNumber || '311552664400003'}</span>
              <span>هاتف: {companyIdentity?.phone || '+966 13 833 2200'}</span>
            </div>
          </div>

          <div className="text-left shrink-0">
            {customLogo ? (
              <img
                src={customLogo}
                alt="RMT Logo"
                className="company-logo-svg max-h-12 max-w-[130px] object-contain inline-block"
              />
            ) : (
              <div className="font-black text-2xl tracking-tighter">
                <span className="text-[#007A5A]">R</span>
                <span className="text-[#1e3a8a]">M</span>
              </div>
            )}
            <div className="mt-1 text-[10px] font-mono text-slate-500 text-left">
              CONTRACTING & MEP
            </div>
          </div>
        </div>

        {/* PO Document Banner */}
        <div className="my-3 py-1.5 px-3 bg-[#1e3a8a] text-white flex items-center justify-between rounded-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase">
              أمر شراء وتوريد مواد (PURCHASE ORDER)
            </span>
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-emerald-300">
            {po.poNumber}
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
          {/* PO Details */}
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50/60 space-y-1">
            <div className="font-bold text-[#1e3a8a] border-b border-slate-200 pb-1 text-[11px]">
              بيانات أمر الشراء والمشروع (Order Information)
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <span className="text-slate-500">رقم الأمر:</span>
              <span className="col-span-2 font-mono font-bold text-slate-900">{po.poNumber}</span>

              <span className="text-slate-500">تاريخ الإصدار:</span>
              <span className="col-span-2 font-mono text-slate-800">{po.date}</span>

              <span className="text-slate-500">المشروع:</span>
              <span className="col-span-2 font-bold text-slate-900">{po.projectName}</span>

              <span className="text-slate-500">مرجع المشروع:</span>
              <span className="col-span-2 font-mono text-slate-700">{po.projectRef || '-'}</span>

              <span className="text-slate-500">موعد التسليم:</span>
              <span className="col-span-2 font-mono text-slate-800">{po.deliveryDate || 'حسب الاتفاق'}</span>
            </div>
          </div>

          {/* Vendor Details */}
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50/60 space-y-1">
            <div className="font-bold text-[#1e3a8a] border-b border-slate-200 pb-1 text-[11px]">
              بيانات المورد / المصنع (Vendor Information)
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <span className="text-slate-500">اسم المورد:</span>
              <span className="col-span-2 font-bold text-slate-900">{po.vendorName}</span>

              <span className="text-slate-500">مسؤول التواصل:</span>
              <span className="col-span-2 text-slate-800">{po.vendorContactPerson || '-'}</span>

              <span className="text-slate-500">الهاتف / البريد:</span>
              <span className="col-span-2 font-mono text-slate-800">{po.vendorPhoneEmail || '-'}</span>

              <span className="text-slate-500">الرقم الضريبي:</span>
              <span className="col-span-2 font-mono font-bold text-[#1e3a8a]">{po.vendorVatNo || '-'}</span>

              <span className="text-slate-500">العنوان:</span>
              <span className="col-span-2 text-slate-700 truncate">{po.vendorAddress || '-'}</span>
            </div>
          </div>
        </div>

        {/* PO Items BOQ Table */}
        <div className="w-full mb-2">
          <table className="w-full text-right border-collapse border border-slate-300 text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <th className="p-1.5 border border-slate-300 text-center w-9">م</th>
                <th className="p-1.5 border border-slate-300">الوصف والمواصفات الفنية للبند</th>
                <th className="p-1.5 border border-slate-300 text-center w-14">الوحدة</th>
                <th className="p-1.5 border border-slate-300 text-center w-14">الكمية</th>
                <th className="p-1.5 border border-slate-300 text-left w-24">سعر الوحدة</th>
                <th className="p-1.5 border border-slate-300 text-left w-28">الإجمالي (ر.س)</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                  <td className="p-1.5 border border-slate-300 text-center font-mono text-slate-500 text-[10px]">
                    {item.itemNo || idx + 1}
                  </td>
                  <td className="p-1.5 border border-slate-300">
                    <div className="font-semibold text-slate-900 leading-snug">{item.description}</div>
                  </td>
                  <td className="p-1.5 border border-slate-300 text-center text-slate-600 font-mono text-[10px]">
                    {item.unit || 'EA'}
                  </td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold font-mono text-slate-800 text-[10.5px]">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="p-1.5 border border-slate-300 text-left font-mono text-slate-700 text-[10.5px]">
                    {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-1.5 border border-slate-300 text-left font-mono font-bold text-slate-900 bg-slate-50/30 text-[10.5px]">
                    {item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="p-2 border border-slate-300 text-right align-top bg-slate-50/40 text-[10px] text-slate-600">
                  <strong className="text-slate-800">تعليمات التوريد والمطابقة:</strong> يجب مطابقة جميع المواد الموردة للمواصفات والاعتمادات الهندسية للمشروع، وإرفاق سند التسليم والفاتورة الضريبية الرسمية.<br />
                  <strong>مكان التسليم:</strong> {po.deliveryTerms?.location || 'موقع المشروع المعتمد'}
                </td>
                <td colSpan={2} className="p-0 border border-slate-300">
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 text-slate-600 font-medium">المجموع الفرعي:</td>
                        <td className="p-1.5 text-left font-mono font-bold text-slate-900">
                          {po.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                        </td>
                      </tr>
                      {po.discount > 0 && (
                        <tr className="border-b border-slate-200 text-rose-700">
                          <td className="p-1.5 font-medium">الخصم الممنوح:</td>
                          <td className="p-1.5 text-left font-mono font-bold">
                            -{po.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 text-slate-600 font-medium">ضريبة القيمة المضافة (15%):</td>
                        <td className="p-1.5 text-left font-mono font-bold text-slate-900">
                          {po.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                        </td>
                      </tr>
                      <tr className="bg-[#007A5A] text-white">
                        <td className="p-1.5 font-black text-xs">المجموع الكلي النهائي:</td>
                        <td className="p-1.5 text-left font-mono font-black text-sm text-white">
                          {po.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Contract & Logistics Terms (Side-by-Side 2 Columns) */}
        <div className="grid grid-cols-2 gap-2 mb-2 text-[10px]">
          <div className="border border-slate-300 rounded p-2 bg-slate-50/40">
            <span className="font-bold text-[#1e3a8a] block mb-1 text-[10.5px]">
              شروط وأحكام العقد والتوريد:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-700">
              <li>البضاعة خاضعة للمعاينة والفحص الفني الموقعي ومطابقة الاعتمادات.</li>
              <li>يلزم إرفاق سند التسليم الأصلي والفاتورة الضريبية الرسمية عند التوريد.</li>
              <li>تلتزم الجهة الموردة بكتالوجات ومواصفات الدفاع المدني والجهات الإشرافية.</li>
            </ul>
          </div>

          <div className="border border-slate-300 rounded p-2 bg-slate-50/40">
            <span className="font-bold text-[#007A5A] block mb-1 text-[10.5px]">
              شروط الدفع واللوجستيات:
            </span>
            <div className="space-y-0.5 text-slate-700">
              <div><strong>طريقة الدفع:</strong> {typeof po.paymentTerms === 'string' ? po.paymentTerms : (po.paymentTerms?.method || 'تحويل بنكي')} - {typeof po.paymentTerms === 'object' ? po.paymentTerms?.schedule : 'حسب الاتفاق'}</div>
              <div><strong>شروط الشحن:</strong> {po.deliveryTerms?.method || 'DDP'} ({po.deliveryTerms?.shipping || 'نقل بري'})</div>
              <div><strong>الحساب البنكي:</strong> {typeof po.paymentTerms === 'object' ? po.paymentTerms?.bankDetails : 'مصرف الإنماء / الراجحي'}</div>
            </div>
          </div>
        </div>

        {/* Executive Signatures Block */}
        <div className="signatures-block border-t-2 border-slate-900 pt-3 mt-4 flex justify-between gap-4 text-xs">
          {/* Prepared By */}
          <div className="border border-slate-300 rounded p-2.5 text-center flex-1 bg-slate-50/30">
            <div className="font-bold text-slate-800 text-[11px] mb-1">
              إعداد مسؤول المشتريات
            </div>
            <div className="text-[10px] text-slate-500 mb-1">
              {po.authorization?.preparedBy?.name || 'مسؤول المشتريات والتسعير'}
            </div>
            <div className="h-16 flex items-center justify-center">
              {signatures.prepared ? (
                <img
                  src={signatures.prepared}
                  alt="توقيع مسؤول المشتريات"
                  className="max-h-16 max-w-[140px] object-contain drop-shadow-xs"
                />
              ) : (
                <div className="text-gray-300 text-xs italic">بانتظار التوقيع المعتمد</div>
              )}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-1">
              التاريخ: {po.date}
            </div>
          </div>

          {/* Reviewed By */}
          <div className="border border-slate-300 rounded p-2.5 text-center flex-1 bg-slate-50/30">
            <div className="font-bold text-slate-800 text-[11px] mb-1">
              مراجعة الإدارة المالية والمشاريع
            </div>
            <div className="text-[10px] text-slate-500 mb-1">
              {po.authorization?.reviewedBy?.name || 'عبدالرحمن المعيلي / م. مختار يوسف'}
            </div>
            <div className="h-16 flex items-center justify-center">
              {signatures.reviewed ? (
                <img
                  src={signatures.reviewed}
                  alt="توقيع المراجعة"
                  className="max-h-16 max-w-[140px] object-contain drop-shadow-xs"
                />
              ) : (
                <div className="text-gray-300 text-xs italic">بانتظار التوقيع المعتمد</div>
              )}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-1">
              التاريخ: {po.date}
            </div>
          </div>

          {/* Approved By & Official Seal */}
          <div className="border border-slate-300 rounded p-2.5 text-center flex-1 bg-slate-50/30 relative overflow-hidden">
            <div className="font-bold text-slate-800 text-[11px] mb-1">
              الاعتماد والختم الرسمي
            </div>
            <div className="text-[10px] text-slate-500 mb-1">
              {po.authorization?.approvedBy?.name || 'عبدالله المعيلي (المدير العام)'}
            </div>
            <div className="h-16 flex items-center justify-center relative">
              {signatures.approved ? (
                <img
                  src={signatures.approved}
                  alt="توقيع الاعتماد النهائي"
                  className="max-h-16 max-w-[140px] object-contain drop-shadow-xs z-10"
                />
              ) : (
                <div className="text-gray-300 text-xs italic z-10">بانتظار التوقيع المعتمد</div>
              )}
              {signatures.seal && (
                <img
                  src={signatures.seal}
                  alt="الختم الرسمي"
                  className="absolute max-h-16 max-w-[100px] object-contain opacity-85 pointer-events-none -right-1"
                />
              )}
            </div>
            <div className="text-[9px] text-slate-400 font-mono mt-1">
              معتمد وصادر رسمياً
            </div>
          </div>
        </div>

        {/* Footer Audit Note */}
        <div className="mt-3 text-center text-[9px] text-slate-400 italic">
          يُعتمد هذا الأمر كوثيقة توريد نظامية ملزمة صادرة عن نظام إدارة المشاريع والمشتريات الإلكتروني لمؤسسة صناع الموارد للتجارة.
        </div>
      </div>

      {/* Governance Signatures Management Modal */}
      {showGovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5">
              <h3 className="font-black text-slate-900 text-base">
                إدارة التواقيع المعتمدة والأختام الرسمية
              </h3>
              <button
                type="button"
                onClick={() => setShowGovModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <GovernanceSignatures
              onSignatureUpdated={() => {
                loadSignatures();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderPrint;
