import React, { useState, useEffect } from 'react';
import { Project, CustomerQuotation, Invoice, InvoicePayment, ProjectPaymentMilestone } from '../types';
import { CompanyHeader } from './CompanyHeader';
import { SignatureBox } from './SignatureBox';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import { RegisterAdvancePaymentModal } from './RegisterAdvancePaymentModal';
import { getSafeRetentionPercent, calculateRetentionFigures } from '../utils/projectValidation';
import { MobileViewerTopBar, useModalBackDismiss } from './MobileViewerTopBar';
import {
  X,
  Printer,
  FileText,
  DollarSign,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Plus,
  Percent,
  AlertCircle,
  Building,
  Paperclip,
} from 'lucide-react';

interface ProjectCustomerSOAModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  quotation?: CustomerQuotation;
  quotations?: CustomerQuotation[];
  invoices?: Invoice[];
  onRecordPayment?: (invoiceId: string, payment: InvoicePayment) => void;
  onRecordInvoicePayment?: (invoiceId: string, payment: InvoicePayment) => void;
  onUpdateAdvancePayment?: (
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
    } | number,
    date?: string,
    receiptNo?: string
  ) => void;
  onUpdateRetention?: (
    projectIdOrPercent: string | number,
    percentOrAmount: number,
    amountOrStatus?: number | 'Held' | 'Due' | 'Released',
    status?: 'Held' | 'Due' | 'Released'
  ) => void;
}

export const ProjectCustomerSOAModal: React.FC<ProjectCustomerSOAModalProps> = ({
  isOpen,
  onClose,
  project,
  quotation,
  quotations = [],
  invoices = [],
  onRecordPayment,
  onRecordInvoicePayment,
  onUpdateAdvancePayment,
  onUpdateRetention,
}) => {
  // Mobile & hardware back button dismiss support
  useModalBackDismiss(onClose);

  // Listen for Escape key (always hook at top)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Advance Payment Modal State
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  // Retention Edit State
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [retentionMode, setRetentionMode] = useState<'percent' | 'fixed'>('percent');
  const [retentionPercentInput, setRetentionPercentInput] = useState('10');
  const [retentionAmountInput, setRetentionAmountInput] = useState('0');
  const [retentionStatusInput, setRetentionStatusInput] = useState<'Held' | 'Due' | 'Released'>('Held');

  // Sync state whenever project or contract value changes
  useEffect(() => {
    if (project) {
      const mode =
        project.retentionAmount !== undefined &&
        project.retentionAmount > 0 &&
        !project.retentionPercent
          ? 'fixed'
          : 'percent';
      setRetentionMode(mode);

      const safeP = getSafeRetentionPercent(project.retentionPercent, 10);
      setRetentionPercentInput(String(safeP));

      const rawA = typeof project.retentionAmount === 'number' ? project.retentionAmount : parseFloat(String(project.retentionAmount));
      setRetentionAmountInput(String(!isNaN(rawA) && rawA > 0 ? rawA : 0));

      setRetentionStatusInput(project.retentionStatus || 'Held');
    }
  }, [project?.id, project?.retentionPercent, project?.retentionAmount, project?.retentionStatus, isOpen]);

  // Unconditionally evaluate hooks; return null safely AFTER all hooks
  if (!isOpen || !project) return null;

  const handleRecordPayment = onRecordInvoicePayment || onRecordPayment;

  const projectInvoices = (invoices || []).filter((inv) => inv?.projectId === project?.id);

  const linkedQuote =
    quotation || (quotations || []).find((q) => q?.projectId === project?.id);

  // Financial Figures (Base amount before VAT / Purchase Order value before tax)
  const contractValue =
    linkedQuote?.totals?.customerSellingPrice ||
    project?.budget ||
    0;

  const totalInvoiced = projectInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalInvoicePayments = projectInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

  // If advance payment was recorded outside direct invoices, include it
  const advancePaymentAmount = project.advancePaymentAmount || 0;
  const totalCollected = Math.max(totalInvoicePayments, advancePaymentAmount + totalInvoicePayments);

  // Retention calculation accurately bound against contract value
  const { percent: retentionPercent, amount: retentionAmount } = calculateRetentionFigures(
    contractValue,
    project.retentionPercent,
    project.retentionAmount,
    retentionMode
  );
  const retentionStatus = project.retentionStatus || 'Held';

  // Outstanding
  const totalOutstanding = Math.max(0, totalInvoiced - totalInvoicePayments);
  // Net Due now (excluding retention if not due yet)
  const currentClaimableDue = Math.max(
    0,
    retentionStatus === 'Held' ? totalOutstanding - retentionAmount : totalOutstanding
  );

  // Build Chronological Transactions Ledger
  interface LedgerRow {
    id: string;
    date: string;
    type: 'Advance' | 'Invoice' | 'Payment';
    referenceNo: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    attachmentName?: string;
    attachmentData?: string;
  }

  const rawEvents: Array<{
    date: string;
    type: 'Advance' | 'Invoice' | 'Payment';
    referenceNo: string;
    description: string;
    debit: number;
    credit: number;
    attachmentName?: string;
    attachmentData?: string;
  }> = [];

  // 1. Advance payment if registered
  if (advancePaymentAmount > 0) {
    rawEvents.push({
      date: project.advancePaymentDate || project.startDate || '2026-07-25',
      type: 'Advance',
      referenceNo: project.advancePaymentReceiptNo || 'ADV-RCP-01',
      description: `دفعة أولى مقدمة مستلمة (Advance Payment - ${project.name})${
        project.advancePaymentMethod
          ? ` - ${
              project.advancePaymentMethod === 'Bank Transfer'
                ? 'تحويل بنكي'
                : project.advancePaymentMethod === 'Cheque'
                ? 'شيك'
                : 'نقداً'
            }`
          : ''
      }${project.advancePaymentReferenceNo ? ` (مرجع: ${project.advancePaymentReferenceNo})` : ''}`,
      debit: 0,
      credit: advancePaymentAmount,
      attachmentName: project.advancePaymentAttachmentName,
      attachmentData: project.advancePaymentAttachmentData,
    });
  }

  // 2. Invoices & Payments
  projectInvoices.forEach((inv) => {
    rawEvents.push({
      date: inv.date,
      type: 'Invoice',
      referenceNo: inv.invoiceNumber,
      description: `فاتورة ضريبية مستحقة - ${inv.projectName} ${inv.poReference ? `(PO: ${inv.poReference})` : ''}`,
      debit: inv.grandTotal || 0,
      credit: 0,
    });

    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p) => {
        rawEvents.push({
          date: p.date,
          type: 'Payment',
          referenceNo: p.receiptNumber || p.referenceNo || `RCP-${p.id ? String(p.id).slice(-5) : '01'}`,
          description: `سداد دفعة بموجب الفاتورة #${inv.invoiceNumber} (${p.paymentMethod})`,
          debit: 0,
          credit: p.amount || 0,
          attachmentName: p.attachmentName,
          attachmentData: p.attachmentData,
        });
      });
    }
  });

  // Sort by date ascending
  rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const ledgerRows: LedgerRow[] = rawEvents.map((ev, index) => {
    runningBalance += ev.debit - ev.credit;
    return {
      id: `row-${index}`,
      date: ev.date,
      type: ev.type,
      referenceNo: ev.referenceNo,
      description: ev.description,
      debit: ev.debit,
      credit: ev.credit,
      balance: runningBalance,
      attachmentName: ev.attachmentName,
      attachmentData: ev.attachmentData,
    };
  });

  // Milestones list
  const defaultMilestones: ProjectPaymentMilestone[] = project.paymentMilestones || [
    {
      id: 'ms-adv',
      name: 'دفعة أولى مقدمة (Advance Payment)',
      percentage: 20,
      amount: (contractValue * 20) / 100,
      status: advancePaymentAmount > 0 ? 'Paid' : 'Pending',
    },
    {
      id: 'ms-sup',
      name: 'دفعة توريد المواد والأصناف (Supply Milestone)',
      percentage: 50,
      amount: (contractValue * 50) / 100,
      status: totalInvoiced > 0 ? 'Invoiced' : 'Pending',
    },
    {
      id: 'ms-ins',
      name: 'دفعة التركيب والإنجاز الموقعي (Installation)',
      percentage: 20,
      amount: (contractValue * 20) / 100,
      status: 'Pending',
    },
    {
      id: 'ms-ret',
      name: `محجوز الضمان لحين الفحص والاختبار (Retention ${retentionPercent}%)`,
      percentage: retentionPercent,
      amount: retentionAmount,
      isRetention: true,
      status: retentionStatus === 'Released' ? 'Paid' : 'Pending',
    },
  ];

  const handlePrint = () => {
    executePrint('printable-customer-soa', {
      documentTitle: `كشف حساب العميل والفوترة - ${project.customerName} - ${project.name}`,
    });
  };

  const handleOpenPrintPopup = () => {
    openPrintPopup(
      'printable-customer-soa',
      `كشف حساب العميل والفوترة - ${project.customerName} - ${project.name}`
    );
  };

  const handleSaveRetention = (e: React.FormEvent) => {
    e.preventDefault();
    if (retentionMode === 'percent') {
      const { percent: safeP, amount: calcAmt } = calculateRetentionFigures(
        contractValue,
        retentionPercentInput,
        undefined,
        'percent'
      );
      if (onUpdateRetention) {
        onUpdateRetention(project.id, safeP, calcAmt, retentionStatusInput);
      }
    } else {
      const fixedAmt = parseFloat(retentionAmountInput) || 0;
      const { percent: calcP, amount: safeAmt } = calculateRetentionFigures(
        contractValue,
        undefined,
        fixedAmt,
        'fixed'
      );
      if (onUpdateRetention) {
        onUpdateRetention(project.id, calcP, safeAmt, retentionStatusInput);
      }
    }
    setShowRetentionModal(false);
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
          title={`كشف حساب العميل: ${project.customerName}`}
          subtitle={`المشروع: ${project.name} • متابعة التحصيلات ومحجوز الضمان`}
          onClose={onClose}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 sm:px-3.5 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
                title="طباعة كشف الحساب مباشرة أو حفظه كـ PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">طباعة كشف الحساب</span>
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

        {/* Printable Statement Body */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-white text-slate-900 font-sans report-container max-w-full"
          id="printable-customer-soa"
        >
          {/* Company Official Letterhead */}
          <CompanyHeader showDivider={true} />

          {/* Statement Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-3 pb-3 border-b-2 border-slate-900">
            <div>
              <div className="inline-block px-2.5 py-0.5 bg-purple-800 text-white rounded text-[10px] font-black tracking-wider uppercase mb-1">
                STATEMENT OF ACCOUNT & PROGRESS INVOICING
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                كشف حساب العميل والفوترة والتحصيلات للمشروع
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                مؤسسة صناع الموارد التجاريه (RMT) - الحسابات المدينة وإدارة الفوترة
              </p>
            </div>

            <div className="text-right sm:text-left font-mono text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">رقم المشروع: </span>
                <span className="font-bold text-[#007A5A]">{project.projectNumber}</span>
              </div>
              <div>
                <span className="text-slate-500">تاريخ الكشف: </span>
                <span className="font-bold text-slate-800">{new Date().toISOString().split('T')[0]}</span>
              </div>
            </div>
          </div>

          {/* Client & Project Overview Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">العميل المحترم:</span>
              <strong className="text-slate-900 font-bold block">{project.customerName}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">المشروع المتعاقد عليه:</span>
              <strong className="text-slate-900 font-bold block">{project.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">موقع العمل:</span>
              <span className="text-slate-800 font-medium block">{project.location}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5 font-medium">حالة المشروع:</span>
              <span className="text-slate-800 font-bold block">
                {project.executionStatus || 'قيد التنفيذ'}
              </span>
            </div>
          </div>

          {/* Financial KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50">
              <div className="text-[11px] text-slate-500 font-bold mb-1">إجمالي قيمة العقد المعتمد</div>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {contractValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">SAR (Contract Value)</div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/50">
              <div className="text-[11px] text-emerald-800 font-bold mb-1 flex items-center justify-between">
                <span>إجمالي المسدد والمستلم</span>
                {advancePaymentAmount > 0 && (
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                    يشمل دفعة أولى
                  </span>
                )}
              </div>
              <div className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                الدفعة الأولى: {advancePaymentAmount.toLocaleString()} SAR
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
              <div className="text-[11px] text-rose-800 font-bold mb-1">الرصيد القائم المتبقي (ذمة)</div>
              <div className="text-base sm:text-lg font-black text-rose-700 font-mono">
                {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5 font-mono">
                SAR (إجمالي المتبقي)
              </div>
            </div>
          </div>

          {/* Contract Payment Milestones (نظام الدفعات المقسم على نسب) */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-5">
            <div className="bg-slate-100 p-2.5 border-b border-slate-300 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-purple-700" />
                <span>جدول الدفعات التعاقدية ونسب السداد (Contract Milestones & Retention)</span>
              </span>
              <div className="no-print flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(true)}
                  className="px-2.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{advancePaymentAmount > 0 ? 'تعديل الدفعة الأولى' : '+ تسجيل دفعة أولى'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRetentionModal(true)}
                  className="px-2.5 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>تعديل نسبة Retention</span>
                </button>
              </div>
            </div>

            <div className="report-table-scroll overflow-x-auto max-w-full">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2">المرحلة والبيان التعاقدي</th>
                    <th className="p-2 text-center">النسبة (%)</th>
                    <th className="p-2 text-left">المبلغ المستحق (SAR)</th>
                    <th className="p-2 text-center">حالة الدفعة</th>
                    <th className="p-2 text-slate-500">ملاحظات وشروط الاستحقاق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {defaultMilestones.map((ms) => (
                    <tr key={ms.id} className="hover:bg-slate-50">
                      <td className="p-2 font-medium text-slate-900">
                        {ms.name}
                        {ms.isRetention && (
                          <span className="mr-1.5 px-1.5 py-0.2 bg-purple-100 text-purple-800 rounded text-[10px] font-bold">
                            ضمان نهائي
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-center font-bold text-slate-700">
                        %{ms.percentage}
                      </td>
                      <td className="p-2 font-mono text-left font-bold text-slate-900">
                        {ms.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            ms.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ms.status === 'Invoiced'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ms.status === 'Paid'
                            ? 'مسددة'
                            : ms.status === 'Invoiced'
                            ? 'مفوترة'
                            : 'مستحقة لاحقاً'}
                        </span>
                      </td>
                      <td className="p-2 text-slate-500 text-[11px]">
                        {ms.isRetention
                          ? 'محتجز لحين الفحص والاختبار والاستلام النهائي (Testing & Commissioning)'
                          : ms.name.includes('أولى')
                          ? 'دفعة مقدمة عند توقيع العقد أو إصدار أمر الشراء'
                          : 'حسب سير الأعمال وشهادات الإنجاز'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statement Chronological Ledger Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-5 report-container">
            <div className="bg-slate-100 p-2.5 border-b border-slate-300 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-[#007A5A]" />
                <span>سجل الحركات المالية المباشرة (فواتير، دفعات مقدمة، وسدادات)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                عدد الحركات: {ledgerRows.length}
              </span>
            </div>

            <div className="report-table-scroll overflow-x-auto max-w-full">
              <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 text-center">التاريخ</th>
                  <th className="p-2.5">نوع الحركة والبيان</th>
                  <th className="p-2.5 text-center">رقم المرجع / الإيصال</th>
                  <th className="p-2.5 text-left font-mono">مدين (Debit - SAR)</th>
                  <th className="p-2.5 text-left font-mono">دائن (Credit - SAR)</th>
                  <th className="p-2.5 text-left font-mono">الرصيد التراكمي (SAR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {ledgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-400 font-sans">
                      لم يتم تسجيل أي فواتير أو دفعات بعد لهذا المشروع.
                    </td>
                  </tr>
                ) : (
                  ledgerRows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.type === 'Payment' || row.type === 'Advance' ? 'bg-emerald-50/40 hover:bg-emerald-50' : 'hover:bg-slate-50'}
                    >
                      <td className="p-2.5 text-center text-slate-600">{row.date}</td>
                      <td className="p-2.5 font-sans font-medium text-slate-900 flex items-center gap-1.5">
                        {row.type === 'Advance' && <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {row.type === 'Payment' && <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        {row.type === 'Invoice' && <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        <span>{row.description}</span>
                        {row.attachmentName && (
                          <button
                            type="button"
                            onClick={() => {
                              if (row.attachmentData) {
                                const a = document.createElement('a');
                                a.href = row.attachmentData;
                                a.download = row.attachmentName || 'payment-voucher';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-semibold border border-emerald-300 transition cursor-pointer mr-1.5"
                            title={`تحميل المرفق: ${row.attachmentName}`}
                          >
                            <Paperclip className="w-3 h-3 text-emerald-700" />
                            <span>سند مرفق</span>
                          </button>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-700">
                        {row.referenceNo}
                      </td>
                      <td className="p-2.5 text-left font-bold text-slate-900">
                        {row.debit > 0 ? row.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="p-2.5 text-left font-bold text-emerald-700">
                        {row.credit > 0 ? row.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="p-2.5 text-left font-bold text-slate-800">
                        {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-400">
                  <td colSpan={3} className="p-2.5 text-left font-sans">
                    صافي الرصيد القائم المستحق على العميل:
                  </td>
                  <td className="p-2.5 text-left font-mono text-slate-900">
                    {totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-left font-mono text-emerald-700">
                    {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-left font-mono text-rose-700 font-black">
                    {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          {/* Retention Clause Note */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-purple-900 block mb-0.5">
                توضيح مالي لمحجوز الضمان (Retention Breakdown):
              </span>
              <span className="text-purple-800 text-[11px] leading-relaxed block">
                مبلغ <strong className="font-mono font-bold">{retentionAmount.toLocaleString()} SAR</strong> محتجز كضمان نهائي بنسبة %{retentionPercent} لحين الفحص والاختبار وإصدار محضر الاستلام النهائي.
                صافي المطالبة الجارية المستحقة فورياً قبل محجوز الضمان هي:{' '}
                <strong className="font-mono font-bold text-emerald-800">{currentClaimableDue.toLocaleString()} SAR</strong>.
              </span>
            </div>
          </div>

          {/* Official Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 mt-3 border-t-2 border-slate-300 text-xs text-center">
            <div>
              <SignatureBox
                roleKey="finance_accounts"
                label="المحاسب المالي (Senior Accountant)"
                personName="Abdulrahman Al Moaili"
                personTitle="Finance & Accounts Lead"
                placeholderText="توقيع المحاسب المالي"
                heightClass="h-14"
              />
            </div>

            <div>
              <SignatureBox
                roleKey="general_manager"
                label="المدير المالي والمدير التنفيذي (CFO / CEO)"
                personName="مؤسسة صناع الموارد التجاريه (RMT)"
                placeholderText="توقيع المدير التنفيذي"
                heightClass="h-14"
              />
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="no-print shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanceModal(true)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#007A5A] border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>تسجيل / تعديل دفعة أولى مقدمة</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRetentionModal(true)}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>إعدادات محجوز الضمان (Retention)</span>
            </button>
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
              <span>طباعة كشف الحساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* Advance Payment Modal Dialog with Attachments & Official Receipt */}
      {showAdvanceModal && (
        <RegisterAdvancePaymentModal
          isOpen={showAdvanceModal}
          onClose={() => setShowAdvanceModal(false)}
          project={project}
          contractValue={contractValue}
          onSaveAdvancePayment={(projId, data) => {
            if (onUpdateAdvancePayment) {
              onUpdateAdvancePayment(projId, data);
            }
            setShowAdvanceModal(false);
          }}
        />
      )}

      {/* Retention Config Modal Dialog */}
      {showRetentionModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRetentionModal(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>ضبط محجوز الضمان (Retention Settings)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRetentionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRetention} className="space-y-3 text-xs">
              {/* Mode Selection Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setRetentionMode('percent')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-center cursor-pointer ${
                    retentionMode === 'percent'
                      ? 'bg-white text-purple-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نسبة مئوية (%)
                </button>
                <button
                  type="button"
                  onClick={() => setRetentionMode('fixed')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-center cursor-pointer ${
                    retentionMode === 'fixed'
                      ? 'bg-white text-purple-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مبلغ مقطوع (SAR)
                </button>
              </div>

              {retentionMode === 'percent' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نسبة محجوز الضمان (%):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    required
                    value={retentionPercentInput}
                    onChange={(e) => setRetentionPercentInput(e.target.value)}
                    placeholder="مثال: 10"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    المبلغ المحسوب بناء على العقد:{' '}
                    <strong className="font-mono text-purple-800">
                      {(
                        (contractValue * (parseFloat(retentionPercentInput) || 0)) /
                        100
                      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      SAR
                    </strong>
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">مبلغ محجوز الضمان الثابت (SAR):</label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    required
                    value={retentionAmountInput}
                    onChange={(e) => setRetentionAmountInput(e.target.value)}
                    placeholder="مثال: 50000"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    يمثل نسبة تعاقدية تقريبية من قيمة العقد:{' '}
                    <strong className="font-mono text-purple-800">
                      {contractValue > 0
                        ? ((parseFloat(retentionAmountInput) || 0) / contractValue * 100).toFixed(2)
                        : '0'}
                      %
                    </strong>
                  </span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">حالة محجوز الضمان:</label>
                <select
                  value={retentionStatusInput}
                  onChange={(e) => setRetentionStatusInput(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                >
                  <option value="Held">محتجز لحين الفحص والاستلام النهائي (Held)</option>
                  <option value="Due">مستحق الإفراج والصرف (Due for Release)</option>
                  <option value="Released">تم الإفراج والصرف بالكامل (Released)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRetentionModal(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold transition shadow-xs"
                >
                  تحديث بند الضمان
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
