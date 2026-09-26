import React, { useEffect } from 'react';
import { Project, CustomerQuotation, PurchaseOrder, DeliveryNote, Invoice } from '../types';
import { CompanyHeader } from './CompanyHeader';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import { getSafeRetentionPercent, calculateRetentionFigures } from '../utils/projectValidation';
import { MobileViewerTopBar, useModalBackDismiss } from './MobileViewerTopBar';
import {
  X,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ShieldCheck,
  Calendar,
  Building,
  User,
  Truck,
  Layers,
  Award,
  BadgePercent,
} from 'lucide-react';

interface ProjectExecutionFinalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  quotation?: CustomerQuotation;
  quotations?: CustomerQuotation[];
  supplierQuotations?: any[];
  purchaseOrders?: PurchaseOrder[];
  deliveryNotes?: DeliveryNote[];
  invoices?: Invoice[];
  onUpdateExecutionStatus?: (
    projectId: string,
    status: 'تام' | 'جزئي' | 'قيد التنفيذ',
    details?: {
      completionPercentage?: number;
      completionDate?: string;
      handoverNotes?: string;
      retentionPercent?: number;
      retentionAmount?: number;
      retentionStatus?: 'Held' | 'Due' | 'Released';
    }
  ) => void;
}

export const ProjectExecutionFinalReportModal: React.FC<ProjectExecutionFinalReportModalProps> = ({
  isOpen,
  onClose,
  project,
  quotation,
  quotations = [],
  supplierQuotations = [],
  purchaseOrders = [],
  deliveryNotes = [],
  invoices = [],
  onUpdateExecutionStatus,
}) => {
  // Mobile & hardware back button dismiss support
  useModalBackDismiss(onClose);

  const activeQuote = quotation || quotations.find((q) => q.projectId === project?.id);
  // Listen for Escape key
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

  const projectInvoices = invoices.filter((inv) => inv.projectId === project.id);
  const projectDNs = deliveryNotes.filter((dn) => dn.projectId === project.id);
  const projectPOs = purchaseOrders.filter((po) => po.projectId === project.id);

  // Financial calculations
  const contractValue =
    activeQuote?.totals?.grandTotalWithVat ||
    activeQuote?.totals?.customerSellingPrice ||
    project.budget ||
    0;

  const totalInvoiced = projectInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalInvoicePayments = projectInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const advancePaymentAmount = project.advancePaymentAmount || 0;
  const totalCollected = advancePaymentAmount + totalInvoicePayments;
  const totalRemaining = Math.max(0, contractValue - totalCollected);

  // Retention (حجز الضمان لحين الفحص والاختبار والتسليم النهائي)
  const { percent: retentionPercent, amount: retentionAmount } = calculateRetentionFigures(
    contractValue,
    project.retentionPercent,
    project.retentionAmount,
    project.retentionAmount && project.retentionAmount > 0 && !project.retentionPercent ? 'fixed' : 'percent'
  );
  const retentionStatus = project.retentionStatus || 'Held';

  // Completion calculation
  const executionStatus = project.executionStatus || 'قيد التنفيذ';
  const completionPercentage =
    project.completionPercentage !== undefined
      ? project.completionPercentage
      : executionStatus === 'تام'
      ? 100
      : executionStatus === 'جزئي'
      ? 65
      : 25;

  const completionDate =
    project.completionDate ||
    (executionStatus === 'تام' ? new Date().toISOString().split('T')[0] : 'قيد المتابعة');

  const handlePrint = () => {
    executePrint('printable-final-handover-report', {
      documentTitle: `تقرير إنجاز وتسليم المشروع النهائي - ${project.name}`,
    });
  };

  const handleOpenPrintPopup = () => {
    openPrintPopup(
      'printable-final-handover-report',
      `تقرير إنجاز وتسليم المشروع النهائي - ${project.name}`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs print-modal-container overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl report-container max-w-5xl w-full min-h-screen sm:min-h-0 sm:max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 print-modal-content">
        {/* Sticky Mobile-Friendly Top Action Bar */}
        <MobileViewerTopBar
          title={`تقرير الإنجاز والتسليم النهائي: ${project.name}`}
          subtitle={`المشروع: ${project.customerName} • ${executionStatus === 'تام' ? 'منجز بشكل تام' : executionStatus === 'جزئي' ? 'منجز جزئياً' : 'قيد التنفيذ'}`}
          onClose={onClose}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 sm:px-3.5 py-1.5 bg-[#007A5A] hover:bg-[#00664B] active:bg-[#00523C] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                title="طباعة التقرير النهائي أو حفظه كـ PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">طباعة التقرير / PDF</span>
                <span className="sm:hidden">طباعة</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPrintPopup}
                className="hidden md:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium items-center gap-1 transition cursor-pointer"
                title="فتح في نافذة مستقلة للطباعة الخارجية"
              >
                <span>نافذة مستقلة</span>
              </button>
            </div>
          }
        />

        {/* Printable Report Body */}
        <div
          className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white text-slate-900 font-sans"
          id="printable-final-handover-report"
        >
          {/* Company Official Letterhead */}
          <CompanyHeader showDivider={true} />

          {/* Title Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-3 pb-3 border-b-2 border-slate-900">
            <div>
              <div className="inline-block px-2.5 py-0.5 bg-[#174A84] text-white rounded text-[10px] font-black tracking-wider uppercase mb-1">
                FINAL PROJECT HANDOVER & COMPLETION CERTIFICATE
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                تقرير الإنجاز والتسليم النهائي للمشروع والتحاسب التعاقدي
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                مؤسسة صناع الموارد التجاريه (RMT) - قسم إدارة المشاريع والتسليم الميداني
              </p>
            </div>

            <div className="text-right sm:text-left font-mono text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">رقم المشروع: </span>
                <span className="font-bold text-[#174A84]">{project.projectNumber}</span>
              </div>
              <div>
                <span className="text-slate-500">تاريخ التقرير: </span>
                <span className="font-bold text-slate-800">{new Date().toISOString().split('T')[0]}</span>
              </div>
            </div>
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">اسم المشروع:</span>
              <strong className="text-slate-900 font-bold block">{project.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">العميل المستفيد:</span>
              <strong className="text-slate-900 font-bold block">{project.customerName}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">موقع العمل:</span>
              <span className="text-slate-800 font-medium block">{project.location}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">مدير المشروع:</span>
              <span className="text-slate-800 font-medium block">
                {project.projectManager || 'م. مختار يوسف'}
              </span>
            </div>
          </div>

          {/* Execution Status & Progress Box */}
          <div className="p-4 rounded-xl border border-slate-300 bg-linear-to-r from-slate-50 to-emerald-50/30 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">حالة إنجاز المشروع:</span>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${
                    executionStatus === 'تام'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : executionStatus === 'جزئي'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-blue-100 text-blue-800 border border-blue-300'
                  }`}
                >
                  {executionStatus === 'تام' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  {executionStatus === 'جزئي' && <Clock className="w-4 h-4 text-amber-600" />}
                  {executionStatus === 'قيد التنفيذ' && <Layers className="w-4 h-4 text-blue-600" />}
                  <span>
                    {executionStatus === 'تام'
                      ? 'منجز بشكل تام (100% Fully Completed)'
                      : executionStatus === 'جزئي'
                      ? 'منجز جزئياً (Partially Completed)'
                      : 'ما زال قيد التنفيذ (Under Execution)'}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div>
                  <span className="text-slate-500">نسبة الإنجاز الفعلي: </span>
                  <strong className="font-mono text-emerald-700 font-bold text-sm">
                    %{completionPercentage}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">تاريخ التسليم: </span>
                  <strong className="font-mono text-slate-800">{completionDate}</strong>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  executionStatus === 'تام'
                    ? 'bg-emerald-600'
                    : executionStatus === 'جزئي'
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, completionPercentage)}%` }}
              />
            </div>
          </div>

          {/* Financial & Retention Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50">
              <div className="text-[11px] text-slate-500 font-bold mb-1">إجمالي قيمة العقد المعتمد</div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {contractValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">SAR (Contract Value)</div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50">
              <div className="text-[11px] text-emerald-800 font-bold mb-1">المبالغ المسددة والمستلمة</div>
              <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                دفعة أولى: {advancePaymentAmount.toLocaleString()} SAR
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-purple-300 bg-purple-50/50">
              <div className="text-[11px] text-purple-800 font-bold mb-1 flex items-center justify-between">
                <span>محجوز الضمان (Retention)</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-purple-200 text-purple-900 rounded font-bold">
                  %{retentionPercent}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-purple-800 font-mono">
                {retentionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-purple-700 mt-0.5 font-bold">
                الحالة: {retentionStatus === 'Held' ? 'محتجز لحين الفحص' : retentionStatus === 'Due' ? 'مستحق الصرف' : 'تم الإفراج'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/50">
              <div className="text-[11px] text-rose-800 font-bold mb-1">صافي الرصيد المتبقي لدى العميل</div>
              <div className="text-base sm:text-lg font-black text-rose-700 font-mono">
                {totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5 font-mono">
                SAR (الذمة الجارية القائمة)
              </div>
            </div>
          </div>

          {/* Retention & Testing Milestone Explanation Box */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 mb-5 text-xs text-amber-950">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-900 block mb-0.5">
                  بند محجوز الضمان النهائي (Retention Guarantee & Handover Condition):
                </strong>
                <p className="leading-relaxed text-amber-800 text-[11px]">
                  وفقاً للشروط التعاقدية للمشروع، تم حجز نسبة{' '}
                  <span className="font-bold font-mono">%{retentionPercent}</span> من إجمالي قيمة العقد بمبلغ قدره{' '}
                  <span className="font-bold font-mono">
                    {retentionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                  ، وتستحق الإفراج والصرف لصالح مؤسسة صناع الموارد التجاريه فور إتمام الفحص والاختبار التشغيلي (Testing & Commissioning) واعتماد الدفاع المدني والاستلام النهائي.
                </p>
              </div>
            </div>
          </div>

          {/* Delivery Notes & Handover Material Logs */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-5">
            <div className="bg-slate-100 p-2.5 border-b border-slate-300 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-700" />
                <span>سندات التسليم والتوريد الموقعي المعتمدة للمشروع (Delivery Notes)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                عدد السندات: {projectDNs.length}
              </span>
            </div>
            <div className="report-table-scroll overflow-x-auto max-w-full">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2">رقم سند التسليم</th>
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">موقع التسليم</th>
                    <th className="p-2">المستلم المعتمد</th>
                    <th className="p-2 text-center">عدد الأصناف</th>
                    <th className="p-2 text-center">حالة التوريد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {projectDNs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        لم يتم إصدار سندات تسليم موقعية مسجلة بعد لهذا المشروع.
                      </td>
                    </tr>
                  ) : (
                    projectDNs.map((dn) => (
                      <tr key={dn.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-bold text-slate-900">{dn.dnNumber}</td>
                        <td className="p-2 font-mono text-slate-600">{dn.date}</td>
                        <td className="p-2 text-slate-700">{dn.deliveryLocation}</td>
                        <td className="p-2 font-medium text-slate-800">{dn.recipientName}</td>
                        <td className="p-2 font-mono text-center">{dn.items.length} صنف</td>
                        <td className="p-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {dn.status === 'Delivered' ? 'تم التسليم' : dn.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Technical Handover & Commissioning Declaration */}
          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 mb-5 text-xs text-slate-800 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>إقرار الفحص الفني والاختبار والاستلام المبدئي / النهائي:</span>
            </h4>
            <p className="leading-relaxed text-[11px] text-slate-600">
              يقر الطرفان بأن الأعمال والمواد الموضحة أعلاه قد خضعت للمعاينة والفحص الفني الموقعي وفقاً للمخططات المعتمدة، كود البناء السعودي (SBC)، ومعايير الدفاع المدني وأنظمة السلامة الوطنية.
              {project.handoverNotes && (
                <span className="block mt-1 font-semibold text-slate-900">
                  ملاحظات الاستلام: {project.handoverNotes}
                </span>
              )}
            </p>
          </div>

          {/* Official Signatures Grid */}
          <div className="grid grid-cols-3 gap-4 pt-6 mt-3 border-t-2 border-slate-300 text-xs text-center">
            <div className="space-y-4">
              <div className="font-bold text-slate-800">
                مهندس المشروع والتنفيذ (RMT)
              </div>
              <div className="h-14 border-b border-dashed border-slate-400 mx-4 flex items-center justify-center text-slate-400 text-[10px]">
                {project.projectManager || 'م. مختار يوسف'}
              </div>
            </div>

            <div className="space-y-4">
              <div className="font-bold text-slate-800">
                الإدارة المالية ومراقبة العقود
              </div>
              <div className="h-14 border-b border-dashed border-slate-400 mx-4 flex items-center justify-center text-slate-400 text-[10px]">
                (التوقيع والختم المالي)
              </div>
            </div>

            <div className="space-y-4">
              <div className="font-bold text-slate-800">
                استشاري المالك / ممثل العميل المستلم
              </div>
              <div className="h-14 border-b border-dashed border-slate-400 mx-4 flex items-center justify-center text-slate-400 text-[10px]">
                {project.customerName}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="no-print shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Quick status updater inside the report */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">تحديث حالة الإنجاز:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200 border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() =>
                  onUpdateExecutionStatus?.(project.id, 'تام', {
                    completionPercentage: 100,
                    completionDate: new Date().toISOString().split('T')[0],
                  })
                }
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  executionStatus === 'تام'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                تام (100%)
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateExecutionStatus?.(project.id, 'جزئي', {
                    completionPercentage: 65,
                  })
                }
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  executionStatus === 'جزئي'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                جزئي
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateExecutionStatus?.(project.id, 'قيد التنفيذ', {
                    completionPercentage: 25,
                  })
                }
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  executionStatus === 'قيد التنفيذ'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                قيد التنفيذ
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير النهائي</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
