import React, { useEffect } from 'react';
import { Invoice, Project } from '../types';
import { CompanyHeader } from './CompanyHeader';
import { DocumentFooter } from './DocumentFooter';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import { COMPANY_PROFILE } from '../data/initialData';
import { Printer, X, FileText, CheckCircle2, Clock, DollarSign, ArrowDownLeft } from 'lucide-react';

interface AccountingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  projects?: Project[];
}

export const AccountingReportModal: React.FC<AccountingReportModalProps> = ({
  isOpen,
  onClose,
  invoices,
  projects = [],
}) => {
  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalInvoiced = (invoices ?? []).reduce((sum, inv) => sum + (inv?.grandTotal ?? 0), 0);
  const totalAdvanceDeductions = (invoices ?? []).reduce((sum, inv) => sum + (inv?.advanceDeduction ?? 0), 0);
  const totalRetentionWithheld = (invoices ?? []).reduce((sum, inv) => sum + (inv?.retentionDeduction ?? 0), 0);
  
  const totalNetBilled = (invoices ?? []).reduce((sum, inv) => {
    const net = inv?.netPayableAmount ?? (inv.grandTotal - (inv?.advanceDeduction || 0) - (inv?.retentionDeduction || 0));
    return sum + net;
  }, 0);

  const totalCollected = (invoices ?? []).reduce((sum, inv) => sum + (inv?.paidAmount ?? 0), 0);
  const totalRemaining = Math.max(0, totalNetBilled - totalCollected);
  const collectionRate = totalNetBilled > 0 ? Math.min(100, Math.round((totalCollected / totalNetBilled) * 100)) : 0;

  const fullyPaidCount = (invoices ?? []).filter((i) => {
    const net = i.netPayableAmount ?? (i.grandTotal - (i.advanceDeduction || 0) - (i.retentionDeduction || 0));
    return (i.paidAmount ?? 0) >= net;
  }).length;

  const partiallyPaidCount = (invoices ?? []).filter((i) => {
    const net = i.netPayableAmount ?? (i.grandTotal - (i.advanceDeduction || 0) - (i.retentionDeduction || 0));
    return (i.paidAmount ?? 0) > 0 && (i.paidAmount ?? 0) < net;
  }).length;

  const unpaidCount = (invoices ?? []).filter((i) => (i?.paidAmount ?? 0) === 0).length;

  const handlePrint = () => {
    executePrint('printable-accounting-report', {
      documentTitle: 'تقرير المحاسبة والفوترة والتحصيل المالي - مؤسسة صناع الموارد التجاريه',
    });
  };

  const handleOpenPrintPopup = () => {
    openPrintPopup(
      'printable-accounting-report',
      'تقرير المحاسبة والفوترة والتحصيل المالي - مؤسسة صناع الموارد التجاريه'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs print-modal-container overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-2xl shadow-2xl report-container max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 print-modal-content">
        {/* Top Control Bar (Sticky & Always Accessible) */}
        <div className="no-print shrink-0 bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                تقرير المحاسبة والفوترة والتحصيل المالي الشامل
              </h2>
              <p className="text-[11px] text-slate-400">
                Invoices & Financial Collection Statement Report
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-[#007A5A] hover:bg-[#00664B] active:bg-[#00523C] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="طباعة التقرير أو تصديره إلى PDF"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير (Print / PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintPopup}
              className="hidden sm:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium items-center gap-1 transition cursor-pointer"
              title="فتح في نافذة مستقلة للطباعة الخارجية"
            >
              <span>نافذة مستقلة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 rounded-xl transition cursor-pointer"
              title="إغلاق النافذة (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Body with Clean Scrollable View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-white text-slate-900 font-sans report-container max-w-full" id="printable-accounting-report">
          {/* Company Official Letterhead */}
          <CompanyHeader showDivider={true} />

          {/* Title Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-3 pb-3 border-b-2 border-slate-900">
            <div>
              <div className="inline-block px-2.5 py-0.5 bg-[#1E3A8A] text-white rounded text-[10px] font-black tracking-wider uppercase mb-1">
                FINANCIAL ACCOUNTING & BILLING AUDIT
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                تقرير المبيعات والفوترة والتحصيل المالي الشامل
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                مؤسسة صناع الموارد التجاريه (RMT) - إدارة الحسابات المالية والفوترة الضريبية
              </p>
            </div>

            <div className="text-right sm:text-left font-mono text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">تاريخ التقرير: </span>
                <span className="font-bold text-slate-800">{new Date().toISOString().split('T')[0]}</span>
              </div>
              <div>
                <span className="text-slate-500">إجمالي عدد الفواتير: </span>
                <span className="font-bold text-[#007A5A]">{invoices.length} فاتورة</span>
              </div>
            </div>
          </div>

          {/* Financial KPI Summary Cards with Clear VAT Transparency */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
            <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/80">
              <div className="text-xs text-slate-500 font-bold mb-1">إجمالي الفواتير الصادرة (Gross)</div>
              <div className="text-[10px] text-slate-600 font-semibold mb-0.5">(شامل ضريبة القيمة المضافة 15% / VAT Incl.)</div>
              <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                {totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                استقطاعات معتمدة: {(totalAdvanceDeductions + totalRetentionWithheld).toLocaleString()} SAR
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-blue-300 bg-blue-50/60">
              <div className="text-xs text-[#1e3a8a] font-bold mb-1">صافي المطالبات المفوترة (Net Collectible)</div>
              <div className="text-[10px] text-blue-800 font-semibold mb-0.5">(شامل ضريبة القيمة المضافة / VAT Incl.)</div>
              <div className="text-lg sm:text-xl font-black text-[#1e3a8a] font-mono">
                {totalNetBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">
                بعد حسم الدفعة المقدمة والضمان
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/60">
              <div className="text-xs text-emerald-800 font-bold mb-1">إجمالي النقد المحصل الفعلي</div>
              <div className="text-[10px] text-emerald-800 font-semibold mb-0.5">(مقبوضات فعلية / Actual Collected)</div>
              <div className="text-lg sm:text-xl font-black text-emerald-700 font-mono">
                {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5 font-bold">
                نسبة التحصيل الفعلية: %{collectionRate}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/60">
              <div className="text-xs text-rose-800 font-bold mb-1">صافي الرصيد المستحق (ذمم العملاء)</div>
              <div className="text-[10px] text-rose-800 font-semibold mb-0.5">(شامل ضريبة القيمة المضافة / VAT Incl.)</div>
              <div className="text-lg sm:text-xl font-black text-rose-700 font-mono">
                {totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5 font-mono">
                {unpaidCount} غير مسددة | {partiallyPaidCount} جزئي
              </div>
            </div>
          </div>

          {/* Project Advance Payments Table */}
          {projects.some((p) => p.advancePaymentAmount && p.advancePaymentAmount > 0) && (
            <div className="mb-6">
              <h4 className="text-xs font-bold text-slate-800 mb-2">الدفعات المقدمة الأولى (Advance Payments) المسجلة للمشاريع</h4>
              <div className="border border-slate-300 rounded-xl overflow-hidden report-container">
                <div className="report-table-scroll overflow-x-auto max-w-full">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-emerald-50 text-emerald-900 font-bold border-b border-slate-300">
                        <th className="p-2.5">رقم السند</th>
                        <th className="p-2.5">التاريخ</th>
                        <th className="p-2.5">اسم المشروع</th>
                        <th className="p-2.5">طريقة السداد</th>
                        <th className="p-2.5 text-left font-mono">المبلغ المستلم (شامل الضريبة / SAR)</th>
                        <th className="p-2.5 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {projects.filter((p) => p.advancePaymentAmount && p.advancePaymentAmount > 0).map((proj) => (
                        <tr key={proj.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono font-bold text-emerald-800">{proj.advancePaymentReceiptNo || 'ADV-RCP-01'}</td>
                          <td className="p-2.5 font-mono text-slate-600">{proj.advancePaymentDate || proj.startDate}</td>
                          <td className="p-2.5 font-bold text-slate-800">{proj.name}</td>
                          <td className="p-2.5 text-slate-600">{proj.advancePaymentMethod || 'Bank Transfer'}</td>
                          <td className="p-2.5 font-mono font-bold text-emerald-700 text-left">
                            {(proj.advancePaymentAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                              مقبوضة بالكامل
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Invoices Ledger Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-5 report-container">
            <div className="report-table-scroll overflow-x-auto max-w-full">
              <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2.5">رقم الفاتورة</th>
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5">اسم العميل</th>
                  <th className="p-2.5">المشروع</th>
                  <th className="p-2.5 text-left font-mono">الإجمالي (شامل الضريبة 15%)</th>
                  <th className="p-2.5 text-left font-mono">الاستقطاعات المعتمدة</th>
                  <th className="p-2.5 text-left font-mono">الصافي المطالب (شامل الضريبة)</th>
                  <th className="p-2.5 text-left font-mono">المسدد الفعلي</th>
                  <th className="p-2.5 text-left font-mono">المتبقي المستحق</th>
                  <th className="p-2.5 text-center">حالة السداد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-400">
                      لا توجد فواتير مسجلة في النظام حتى الآن.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const net = inv.netPayableAmount ?? (inv.grandTotal - (inv.advanceDeduction || 0) - (inv.retentionDeduction || 0));
                    const deductions = (inv.advanceDeduction || 0) + (inv.retentionDeduction || 0);
                    const isPaid = (inv.paidAmount || 0) >= net;
                    const isPartial = !isPaid && (inv.paidAmount || 0) > 0;
                    const rem = Math.max(0, net - (inv.paidAmount || 0));

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                        <td className="p-2.5 font-mono text-slate-600">{inv.date}</td>
                        <td className="p-2.5 font-bold text-slate-800">{inv.customerName}</td>
                        <td className="p-2.5 text-slate-600">{inv.projectName}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-900 text-left">
                          {(inv.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 font-mono text-blue-700 text-left">
                          {deductions > 0 ? `-${deductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-[#1e3a8a] text-left">
                          {net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700 text-left">
                          {(inv.paidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-left text-rose-700">
                          {rem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPartial
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isPaid ? 'مسددة' : isPartial ? 'سداد جزئي' : 'مستحقة'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {invoices.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-400">
                    <td colSpan={4} className="p-2.5 text-left">
                      المجموع الكلي:
                    </td>
                    <td className="p-2.5 font-mono text-left text-slate-900">
                      {totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 font-mono text-left text-blue-700">
                      -{(totalAdvanceDeductions + totalRetentionWithheld).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 font-mono text-left text-[#1e3a8a]">
                      {totalNetBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 font-mono text-left text-emerald-700">
                      {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 font-mono text-left text-rose-700 font-black">
                      {totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>

          {/* Dedicated 2-Role Report Footer (Accountant / Projects Director + CFO) */}
          <DocumentFooter
            variant="report"
            projectManagerName={COMPANY_PROFILE.engineerName || ''}
            projectManagerTitle="Project Cost & Billing Manager (مدير التكاليف والفوترة)"
            projectManagerRoleKey="projects_manager"
            financeName={COMPANY_PROFILE.financeDirector || ''}
            financeTitle="Finance & Accounts Lead (CFO)"
            financeRoleKey="finance_accounts"
            className="mt-6"
          />
        </div>

        {/* Bottom Control Bar */}
        <div className="no-print shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            يمكنك طباعة التقرير كـ PDF مباشرة أو حفظه في أرشيف الحسابات
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق التقرير
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
