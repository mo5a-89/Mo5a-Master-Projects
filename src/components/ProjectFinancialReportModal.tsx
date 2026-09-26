import React from 'react';
import { Project, CustomerQuotation, PurchaseOrder, CostRecord, Invoice } from '../types';
import { CompanyHeader } from './CompanyHeader';
import { DocumentFooter } from './DocumentFooter';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import { analyzeProjectInvoicing } from '../utils/invoiceUtils';
import { COMPANY_PROFILE } from '../data/initialData';
import {
  X,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  Percent,
  DollarSign,
  Briefcase,
  ShoppingBag,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  ArrowDownLeft,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';

interface ProjectFinancialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  quotations: CustomerQuotation[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  onUpdateExecutionStatus?: (projectId: string, status: 'تام' | 'جزئي' | 'قيد التنفيذ') => void;
}

export const ProjectFinancialReportModal: React.FC<ProjectFinancialReportModalProps> = ({
  isOpen,
  onClose,
  project,
  quotations,
  purchaseOrders,
  invoices,
  onUpdateExecutionStatus,
}) => {
  if (!isOpen) return null;

  // Filter linked records for this project
  const linkedQuotes = (quotations ?? []).filter((q) => q?.projectId === project?.id);
  const primaryQuote = linkedQuotes[0];
  const linkedPOs = (purchaseOrders ?? []).filter((po) => po?.projectId === project?.id);
  const linkedInvoices = (invoices ?? []).filter((inv) => inv?.projectId === project?.id);
  const operationalCosts = project?.incurredCosts ?? [];

  // Deep financial & collections analysis
  const financialAnalysis = analyzeProjectInvoicing(project, primaryQuote, linkedInvoices);

  // Financial calculations
  const contractSellingPrice =
    primaryQuote?.totals?.customerSellingPrice ?? project?.budget ?? financialAnalysis.totalProjectValue;

  // Supplier purchase orders committed (before VAT or total net material cost)
  const totalMaterialPOCost = linkedPOs.reduce(
    (sum, po) => sum + (Number(po?.totalAmount ?? po?.grandTotal ?? po?.subtotal ?? 0) || 0),
    0
  );

  // Operational costs (labor, transport, equipment, testing, etc.)
  const totalOperationalCost = operationalCosts.reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );

  // Total actual cost from start to finish
  const totalActualCost = totalMaterialPOCost + totalOperationalCost;

  // Profit & Margin
  const netActualProfit = contractSellingPrice - totalActualCost;
  const actualMarginPercent =
    contractSellingPrice > 0 ? (netActualProfit / contractSellingPrice) * 100 : 0;

  // Invoicing & Collections
  const totalInvoiced = financialAnalysis.grossBilledAmount;
  const advanceDeductedTotal = financialAnalysis.advanceDeductedAmount;
  const retentionDeductedTotal = financialAnalysis.retentionDeductedAmount;
  const netBilledTotal = financialAnalysis.netBilledAmount;
  const totalCollected = financialAnalysis.totalCashCollected;
  const uncollectedNetBilled = financialAnalysis.totalRemainingAmount;
  const collectionRate = financialAnalysis.collectionProgressPercent;

  const currentExecution = project.executionStatus || 'قيد التنفيذ';

  const handlePrint = () => {
    executePrint('printable-project-financial-report', {
      documentTitle: `التقرير المالي والتكلفة الشاملة - ${project.projectNumber} - ${project.name}`,
    });
  };

  const handleOpenPrintPopup = () => {
    openPrintPopup(
      'printable-project-financial-report',
      `التقرير المالي والتكلفة الشاملة - ${project.projectNumber} - ${project.name}`
    );
  };

  return (
    <div
      id="project-financial-report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print-modal-container"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-2xl report-container max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 print-modal-content">
        {/* Top Action Toolbar (No Print) */}
        <div className="no-print p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>التقرير المالي والتكلفة الشاملة للمشروع</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  {project.projectNumber}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                مقارنة سعر البيع التعاقدي بكافة تكاليف أوامر الشراء الفعلية والتكاليف التشغيلية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Execution status switcher */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <span className="text-slate-400 font-medium">مؤشر الإنجاز:</span>
              <select
                value={currentExecution}
                onChange={(e) =>
                  onUpdateExecutionStatus?.(project.id, e.target.value as any)
                }
                className="bg-slate-900 text-white font-bold px-2 py-0.5 rounded outline-none border border-slate-600 cursor-pointer"
              >
                <option value="قيد التنفيذ">⏳ قيد التنفيذ</option>
                <option value="جزئي">🔄 جزئي</option>
                <option value="تام">✅ تام ومكتمل</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير الرسمي</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintPopup}
              className="hidden sm:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium items-center gap-1 transition cursor-pointer"
              title="فتح في نافذة مستقلة للطباعة الخارجية"
            >
              <span>نافذة مستقلة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          id="printable-project-financial-report"
          className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 report-container max-w-full print:p-0 print:m-0"
        >
          {/* Official Letterhead Header */}
          <CompanyHeader />

          {/* Report Title */}
          <div className="text-center py-2 border-b-2 border-[#007A5A] mb-4">
            <h1 className="text-lg font-black text-[#174A84] tracking-wide">
              تقرير التكاليف والأرباح الفعلية للمشروع (PROJECT FINANCIAL & COST BREAKDOWN REPORT)
            </h1>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              تاريخ استخراج التقرير:{' '}
              <span className="font-mono font-bold text-slate-700">
                {new Date().toLocaleDateString('ar-SA')} ({new Date().toISOString().split('T')[0]})
              </span>
            </div>
          </div>

          {/* Project Summary Information Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 block text-[10.5px]">اسم المشروع:</span>
              <strong className="text-slate-900 font-bold text-sm block mt-0.5">{project.name}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">رقم المشروع:</span>
              <strong className="font-mono font-bold text-slate-800 block mt-0.5">{project.projectNumber}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">العميل:</span>
              <strong className="text-slate-800 font-bold block mt-0.5">{project.customerName}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10.5px]">مؤشر حالة الإنجاز:</span>
              <span
                className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  currentExecution === 'تام'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : currentExecution === 'جزئي'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {currentExecution}
              </span>
            </div>
          </div>

          {/* Key Financial KPIs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Contract Value */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-bold block mb-1">
                سعر البيع المعتمد (Selling Price)
              </span>
              <div className="font-mono text-lg font-black text-[#007A5A]">
                {contractSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs font-sans">SAR</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                بموجب العرض: {primaryQuote?.quotationNumber || 'الميزانية'}
              </span>
            </div>

            {/* Total Actual Costs */}
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-bold block mb-1">
                إجمالي التكاليف الفعلية (Total Cost)
              </span>
              <div className="font-mono text-lg font-black text-rose-700">
                {totalActualCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs font-sans">SAR</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                أوامر شراء ({totalMaterialPOCost.toLocaleString()} SAR) + تشغيلية
              </span>
            </div>

            {/* Actual Profit */}
            <div className="p-4 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
              <span className="text-[11px] text-emerald-800 font-bold block mb-1">
                صافي الربح الفعلي (Net Profit)
              </span>
              <div
                className={`font-mono text-lg font-black ${
                  netActualProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {netActualProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs font-sans">SAR</span>
              </div>
              <span className="text-[10px] text-emerald-600 mt-1 block">
                الفارق المالي المباشر
              </span>
            </div>

            {/* Actual Profit Margin */}
            <div className="p-4 bg-white rounded-xl border border-blue-200 bg-blue-50/20 shadow-2xs">
              <span className="text-[11px] text-[#1e3a8a] font-bold block mb-1">
                نسبة هامش الربح الفعلي (Margin %)
              </span>
              <div
                className={`font-mono text-lg font-black ${
                  actualMarginPercent >= 20
                    ? 'text-emerald-700'
                    : actualMarginPercent >= 10
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {actualMarginPercent.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                المخطط بالعرض: {(primaryQuote?.totals?.grossMarginPercent || 0).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Section 1: Detailed Supplier Purchase Orders (Material & Equipment Costs) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-[#1e3a8a]" />
                <span>أولاً: أوامر شراء وتوريد المواد والمعدات (Supplier Purchase Orders)</span>
              </h3>
              <span className="font-mono font-bold text-xs text-[#1e3a8a]">
                المجموع: {totalMaterialPOCost.toLocaleString()} SAR
              </span>
            </div>

            {linkedPOs.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400">
                لم يتم إصدار أوامر شراء موردين مقيدة بهذا المشروع حتى الآن.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-x-auto report-table-scroll max-w-full">
                <table className="w-full text-[11px] text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2 px-3">رقم الأمر (PO#)</th>
                      <th className="py-2 px-3">المورد (Supplier)</th>
                      <th className="py-2 px-3">التاريخ</th>
                      <th className="py-2 px-3 text-center">عدد الأصناف</th>
                      <th className="py-2 px-3 text-center">حالة التوريد</th>
                      <th className="py-2 px-3 text-left">قيمة الأمر (SAR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linkedPOs.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{po.poNumber}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{po.supplierName || po.vendorName || '-'}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{po.date}</td>
                        <td className="py-2 px-3 text-center font-mono">{po.items?.length || 0}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {po.deliveryStatus || po.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                          {(po.totalAmount ?? po.grandTotal ?? po.subtotal ?? 0).toLocaleString()} SAR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Detailed Incurred Operational Costs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#007A5A]" />
                <span>ثانياً: التكاليف التشغيلية المباشرة (Operational & Field Expenses)</span>
              </h3>
              <span className="font-mono font-bold text-xs text-[#007A5A]">
                المجموع: {totalOperationalCost.toLocaleString()} SAR
              </span>
            </div>

            {operationalCosts.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400">
                لا توجد مصروفات تشغيلية إضافية مسجلة مباشرة على هذا المشروع.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-x-auto report-table-scroll max-w-full">
                <table className="w-full text-[11px] text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2 px-3">التصنيف</th>
                      <th className="py-2 px-3">البيان والوصف</th>
                      <th className="py-2 px-3">التاريخ</th>
                      <th className="py-2 px-3">رقم الفاتورة / السند</th>
                      <th className="py-2 px-3 text-left">المبلغ (SAR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {operationalCosts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-700">{c.category}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{c.description}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{c.date}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{c.invoiceNumber || '-'}</td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                          {c.amount.toLocaleString()} SAR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Invoicing & Payment Status with Accurate Net Realization */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>ثالثاً: الفوترة والتحصيل المالي والتسويات (Billing, Deductions & Net Collections)</span>
              </h3>
              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  إجمالي المفوتر: <strong>{totalInvoiced.toLocaleString()} SAR</strong>
                </span>
                {advanceDeductedTotal > 0 && (
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    خصم دفعة مقدمة: <strong>-{advanceDeductedTotal.toLocaleString()} SAR</strong>
                  </span>
                )}
                {retentionDeductedTotal > 0 && (
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    محجوز ضمان: <strong>-{retentionDeductedTotal.toLocaleString()} SAR</strong>
                  </span>
                )}
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                  المحصل فعلياً: <strong>{totalCollected.toLocaleString()} SAR</strong>
                </span>
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold">
                  المتبقي للتحصيل: <strong>{uncollectedNetBilled.toLocaleString()} SAR</strong>
                </span>
                <span className="text-teal-800 bg-teal-100 px-2 py-0.5 rounded font-bold">
                  نسبة التحصيل: <strong>{collectionRate}%</strong>
                </span>
              </div>
            </div>

            {linkedInvoices.length === 0 ? (
              <div className="p-3 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400">
                لم يتم إصدار فواتير ضريبية لهذا المشروع حتى الآن.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {linkedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1.5 shadow-2xs"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                      <span className="font-mono font-bold text-slate-800">{inv.invoiceNumber}</span>
                      <span className="text-[10px] text-slate-500">{inv.date}</span>
                    </div>
                    <div className="space-y-0.5 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>إجمالي الفاتورة:</span>
                        <span className="font-mono font-bold">{inv.grandTotal.toLocaleString()} SAR</span>
                      </div>
                      {((inv.advanceDeduction && inv.advanceDeduction > 0) || (inv.retentionDeduction && inv.retentionDeduction > 0)) && (
                        <div className="flex justify-between text-blue-700 text-[10.5px]">
                          <span>استقطاعات (دفعة/ضمان):</span>
                          <span className="font-mono">
                            -{( (inv.advanceDeduction || 0) + (inv.retentionDeduction || 0) ).toLocaleString()} SAR
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[#007A5A] font-bold">
                        <span>الصافي المطالب:</span>
                        <span className="font-mono">{(inv.netPayableAmount ?? inv.grandTotal).toLocaleString()} SAR</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-semibold pt-0.5 border-t border-slate-100">
                        <span>المسدد:</span>
                        <span className="font-mono">{inv.paidAmount.toLocaleString()} SAR</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dedicated 2-Role Report Footer (Project & Cost Engineer + Financial Directorate) */}
          <DocumentFooter
            variant="report"
            projectManagerName={COMPANY_PROFILE.engineerName || ''}
            projectManagerTitle="Project & Cost Engineer (مهندس المشاريع والتكاليف)"
            projectManagerRoleKey="projects_manager"
            financeName={COMPANY_PROFILE.financeDirector || ''}
            financeTitle="Finance & Accounts Lead"
            financeRoleKey="finance_accounts"
            className="mt-6"
          />
        </div>
      </div>
    </div>
  );
};
