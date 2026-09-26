import React, { useState, useMemo } from 'react';
import { Invoice, Project, CustomerQuotation, DeliveryNote, InvoicePayment, Customer } from '../types';
import { TaxInvoiceDocument } from './TaxInvoiceDocument';
import { StatementOfAccountModal } from './StatementOfAccountModal';
import { AccountingReportModal } from './AccountingReportModal';
import { CreateProjectInvoiceModal } from './CreateProjectInvoiceModal';
import {
  Receipt,
  DollarSign,
  TrendingUp,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Plus,
  Printer,
  FileText,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  AlertTriangle,
  X,
  Lock,
  Pencil,
} from 'lucide-react';

interface InvoicesAccountingViewProps {
  invoices?: Invoice[];
  projects?: Project[];
  quotations?: CustomerQuotation[];
  deliveryNotes?: DeliveryNote[];
  customers?: Customer[];
  purchaseOrders?: any[];
  onSelectProject?: (projectId: string) => void;
  onOpenCreateInvoiceForProject?: (project: Project) => void;
  onCreateInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onRecordPayment: (invoiceId: string, payment: InvoicePayment) => void;
  onDeletePayment?: (invoiceId: string, paymentId: string) => void;
}

export const InvoicesAccountingView: React.FC<InvoicesAccountingViewProps> = ({
  invoices = [],
  projects = [],
  quotations = [],
  deliveryNotes = [],
  customers = [],
  purchaseOrders = [],
  onSelectProject,
  onOpenCreateInvoiceForProject,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onRecordPayment,
  onDeletePayment,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Partially Paid' | 'Issued'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [selectedStatementCustomer, setSelectedStatementCustomer] = useState<string | null>(null);
  const [showSOA, setShowSOA] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showProjectSelectModal, setShowProjectSelectModal] = useState(false);
  const [selectedProjectForInvoice, setSelectedProjectForInvoice] = useState<Project | null>(null);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);

  // Overall Financial Calculations with strict non-overlapping accuracy
  const metrics = useMemo(() => {
    // Invoices breakdown
    const totalBilledWithVat = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalBilledExclVat = invoices.reduce((sum, inv) => sum + Math.max(0, (inv.subtotal || 0) - (inv.discount || 0)), 0);
    const totalVatBilled = invoices.reduce((sum, inv) => sum + (inv.vatAmount || 0), 0);
    const totalInvoiceReceived = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => {
      const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, (inv.netPayableAmount || inv.grandTotal) - (inv.paidAmount || 0));
      return sum + rem;
    }, 0);

    // Project advance payments tracked strictly separately (no overlapping)
    const totalAdvanceReceived = projects.reduce((sum, p) => sum + (p.advancePaymentAmount || 0), 0);

    // Sum of all approved project quotations contract value
    const totalContractValue = quotations.reduce(
      (sum, q) => sum + (q.totals?.grandTotalWithVat || q.totals?.customerSellingPrice || 0),
      0
    );
    const totalUnbilled = Math.max(0, totalContractValue - totalBilledWithVat);

    const paidCount = invoices.filter((inv) => (inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.grandTotal - inv.paidAmount)) <= 0).length;
    const partialCount = invoices.filter((inv) => inv.paidAmount > 0 && (inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.grandTotal - inv.paidAmount)) > 0).length;
    const unpaidCount = invoices.filter((inv) => (inv.paidAmount || 0) === 0).length;

    const collectionRate = totalBilledWithVat > 0 ? Math.round((totalInvoiceReceived / totalBilledWithVat) * 100) : 0;
    const billingRate = totalContractValue > 0 ? Math.round((totalBilledWithVat / totalContractValue) * 100) : 0;

    return {
      totalBilled: totalBilledWithVat,
      totalBilledWithVat,
      totalBilledExclVat,
      totalVatBilled,
      totalReceived: totalInvoiceReceived,
      totalInvoiceReceived,
      totalOutstanding,
      totalAdvanceReceived,
      totalContractValue,
      totalUnbilled,
      paidCount,
      partialCount,
      unpaidCount,
      collectionRate,
      billingRate,
    };
  }, [invoices, quotations, projects]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.poReference && inv.poReference.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'Paid') matchesStatus = inv.remainingAmount <= 0;
      else if (statusFilter === 'Partially Paid') matchesStatus = inv.paidAmount > 0 && inv.remainingAmount > 0;
      else if (statusFilter === 'Issued') matchesStatus = inv.paidAmount === 0;

      const matchesCustomer =
        selectedCustomerId === 'all' || inv.customerId === selectedCustomerId || inv.customerName === selectedCustomerId;

      return matchesSearch && matchesStatus && matchesCustomer;
    });
  }, [invoices, searchTerm, statusFilter, selectedCustomerId]);

  if (viewingInvoice) {
    const sourceQuote = quotations.find(
      (q) =>
        q.id === viewingInvoice.sourceQuotationId ||
        q.id === 'cust-quote-1' ||
        (viewingInvoice.projectId && q.projectId === viewingInvoice.projectId) ||
        (viewingInvoice.projectName && q.projectName?.toLowerCase() === viewingInvoice.projectName?.toLowerCase())
    );

    return (
      <div className="p-6">
        <TaxInvoiceDocument
          invoice={viewingInvoice}
          quotations={quotations}
          sourceQuotation={sourceQuote}
          onClose={() => setViewingInvoice(null)}
          onUpdateInvoice={(updated) => {
            if (onUpdateInvoice) onUpdateInvoice(updated);
            setViewingInvoice(updated);
          }}
          onRecordPayment={(id, pay) => {
            onRecordPayment(id, pay);
            const updated = invoices.find((i) => i.id === id);
            if (updated) setViewingInvoice(updated);
          }}
          onDeletePayment={(invId, payId) => {
            if (onDeletePayment) onDeletePayment(invId, payId);
            const updated = invoices.find((i) => i.id === invId);
            if (updated) setViewingInvoice(updated);
          }}
          onDeleteInvoice={(id) => {
            if (onDeleteInvoice) onDeleteInvoice(id);
            setViewingInvoice(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Page Title & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#007A5A] text-white flex items-center justify-center font-bold shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-cairo">
                الفواتير والمحاسبة المالية (Invoicing & Accounting)
              </h1>
              <p className="text-xs text-slate-500">
                منظومة الفوترة الضريبية الشاملة، متابعة التحصيلات، والمبالغ المفوترة وغير المفوترة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProjectSelectModal(true)}
              className="min-h-[44px] px-4 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إصدار فاتورة ضريبية جديدة</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSOA(true)}
              className="min-h-[44px] px-3.5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>كشف حساب (SOA)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="min-h-[44px] px-3.5 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة تقرير المحاسبة</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Professional KPI Cards with Tax Transparency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        {/* Total Billed */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span className="font-bold">إجمالي الفواتير الصادرة</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#007A5A] dark:text-emerald-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold block mb-1">
            (شامل ضريبة القيمة المضافة 15% / VAT Inclusive)
          </span>
          <div className="font-mono text-lg sm:text-xl lg:text-2xl font-bold text-[#007A5A] dark:text-emerald-400">
            {metrics.totalBilledWithVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            المبلغ قبل الضريبة: {metrics.totalBilledExclVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
            <span className="text-[10px] text-slate-400 block">(غير شامل الضريبة / VAT Exclusive)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>نسبة إنجاز الفوترة:</span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{metrics.billingRate}%</span>
          </div>
        </div>

        {/* Received Collections */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/10 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs mb-1">
            <span className="font-bold">المبالغ المستلمة والمحصلة</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block mb-1">
            (شامل الضريبة / VAT Inclusive)
          </span>
          <div className="font-mono text-lg sm:text-xl lg:text-2xl font-bold text-emerald-700 dark:text-emerald-400">
            {metrics.totalInvoiceReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            دفعات المشاريع المقدمة: {metrics.totalAdvanceReceived.toLocaleString()} SAR
            <span className="text-[10px] text-slate-400 block">(شامل الضريبة / VAT Inclusive)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 mt-2 pt-2 border-t border-emerald-100 dark:border-emerald-800">
            <span>نسبة التحصيل من المفوتر:</span>
            <span className="font-mono font-bold">{metrics.collectionRate}%</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/10 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 text-xs mb-1">
            <span className="font-bold">المبالغ المعلقة غير المحصلة</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block mb-1">
            (شامل الضريبة / VAT Inclusive)
          </span>
          <div className="font-mono text-lg sm:text-xl lg:text-2xl font-bold text-rose-700 dark:text-rose-400">
            {metrics.totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            مستحقات ذمم مدينة جارية
            <span className="text-[10px] text-slate-400 block">(شامل الضريبة / VAT Inclusive)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-rose-700 dark:text-rose-300 mt-2 pt-2 border-t border-rose-100 dark:border-rose-800">
            <span>فواتير معلقة السداد:</span>
            <span className="font-mono font-bold">{metrics.unpaidCount + metrics.partialCount} فاتورة</span>
          </div>
        </div>

        {/* Unbilled Value */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/10 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-xs mb-1">
            <span className="font-bold">المبالغ غير المفوترة بالعقود</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block mb-1">
            (شامل الضريبة / VAT Inclusive)
          </span>
          <div className="font-mono text-lg sm:text-xl lg:text-2xl font-bold text-amber-700 dark:text-amber-400">
            {metrics.totalUnbilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
            إجمالي العقود المعتمدة: {metrics.totalContractValue.toLocaleString()} SAR
            <span className="text-[10px] text-slate-400 block">(شامل الضريبة / VAT Inclusive)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300 mt-2 pt-2 border-t border-amber-100 dark:border-amber-800">
            <span>المتبقي غير المطالب به بعد:</span>
            <span className="font-mono font-bold">{100 - metrics.billingRate}%</span>
          </div>
        </div>
      </div>

      {/* Interactive Financial Visualization Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              توزيع السيولة والفوترة المحاسبية (Invoicing & Cash Flow Matrix)
            </h3>
            <p className="text-xs text-slate-500">
              انقر على أي مؤشر لتصفية قائمة الفواتير التابعة له
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({invoices.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'Paid'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              مسددة ({metrics.paidCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Partially Paid')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'Partially Paid'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              مسددة جزئياً ({metrics.partialCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Issued')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                statusFilter === 'Issued'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              معلقة وغير مسددة ({metrics.unpaidCount})
            </button>
          </div>
        </div>

        {/* Visual Progress Composition */}
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 p-0.5">
          {metrics.totalBilled > 0 && (
            <>
              <div
                style={{ width: `${(metrics.totalReceived / metrics.totalBilled) * 100}%` }}
                className="bg-emerald-500 h-full rounded-l-full transition-all"
                title={`مسدد مستلم: ${metrics.totalReceived.toLocaleString()} SAR`}
              />
              <div
                style={{ width: `${(metrics.totalOutstanding / metrics.totalBilled) * 100}%` }}
                className="bg-rose-400 h-full rounded-r-full transition-all"
                title={`معلق غير مستلم: ${metrics.totalOutstanding.toLocaleString()} SAR`}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs pt-1 text-slate-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>مبالغ مستلمة: {metrics.totalReceived.toLocaleString()} SAR ({metrics.collectionRate}%)</span>
            </span>

            <span className="flex items-center gap-1.5 text-rose-800 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>مبالغ معلقة غير مستلمة: {metrics.totalOutstanding.toLocaleString()} SAR ({100 - metrics.collectionRate}%)</span>
            </span>
          </div>

          <span className="text-[11px] text-slate-400">
            إجمالي الفواتير الصادرة بالمنظومة: <strong className="font-mono text-slate-700">{invoices.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث برقم الفاتورة، اسم المشروع، العميل، أو مرجع أمر الشراء..."
              className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#007A5A]"
            />
          </div>

          {/* Customer Filter */}
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="p-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 bg-white"
          >
            <option value="all">جميع العملاء</option>
            {(customers || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.companyNameAr || (c as any).name || c.id}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500">
          عدد الفواتير المطابقة: <strong className="font-mono text-[#007A5A]">{filteredInvoices.length}</strong>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
              <tr>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">المشروع والعميل</th>
                <th className="p-3.5 text-center">تاريخ الإصدار</th>
                <th className="p-3.5 text-center">الاستحقاق</th>
                <th className="p-3.5 text-left">
                  <div>الإجمالي مع الضريبة 15%</div>
                  <div className="text-[9.5px] text-slate-400 font-normal">(شامل الضريبة / VAT Inclusive)</div>
                </th>
                <th className="p-3.5 text-left">
                  <div>المبلغ المسدد</div>
                  <div className="text-[9.5px] text-slate-400 font-normal">(شامل الضريبة / VAT Inclusive)</div>
                </th>
                <th className="p-3.5 text-left">
                  <div>الرصيد المتبقي</div>
                  <div className="text-[9.5px] text-slate-400 font-normal">(شامل الضريبة / VAT Inclusive)</div>
                </th>
                <th className="p-3.5 text-center">حالة السداد</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const isPaid = inv.remainingAmount <= 0;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-[#007A5A] text-sm">
                        {inv.invoiceNumber}
                      </div>
                      {inv.poReference && (
                        <span className="text-[10.5px] text-slate-400 block mt-0.5">
                          PO: {inv.poReference}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{inv.projectName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        العميل: <strong className="text-slate-700">{inv.customerName}</strong>
                      </div>
                    </td>

                    <td className="p-3.5 text-center font-mono text-slate-600">
                      {inv.date}
                    </td>

                    <td className="p-3.5 text-center font-mono text-slate-600">
                      {inv.dueDate}
                    </td>

                    <td className="p-3.5 text-left font-mono font-bold text-slate-900 whitespace-nowrap">
                      {inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>

                    <td className="p-3.5 text-left font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {inv.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>

                    <td className="p-3.5 text-left font-mono font-bold whitespace-nowrap">
                      <span className={inv.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        {inv.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : inv.paidAmount > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isPaid ? 'bg-emerald-500' : inv.paidAmount > 0 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                        <span>
                          {isPaid
                            ? 'مسددة بالكامل'
                            : inv.paidAmount > 0
                            ? 'مسددة جزئياً'
                            : 'معلقة وغير مسددة'}
                        </span>
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingInvoice(inv)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#007A5A] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="معاينة الفاتورة والطباعة والسداد"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض / معاينة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewingInvoice(inv)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="تعديل بيانات الفاتورة والأصناف والمبالغ بالصلاحية الإدارية"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-500" />
                          <span>تعديل</span>
                        </button>
                        {onDeleteInvoice && (
                          isPaid || inv.paidAmount > 0 ? (
                            <span
                              className="p-1.5 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed inline-flex items-center justify-center"
                              title="المستند مقفل نظامياً ولا يمكن حذفه لوجود سدادات مالية مسجلة عليه"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInvoiceToDelete(inv)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              title="حذف الفاتورة وإلغاء تسجيلها"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredInvoices.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              لا توجد فواتير تطابق معايير البحث والفلترة.
            </div>
          )}
        </div>

      {/* Invoice Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف الفاتورة الضريبية</h3>
                <p className="text-xs text-rose-600 font-mono font-bold">{invoiceToDelete.invoiceNumber}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5">
              <div className="flex justify-between">
                <span>المشروع:</span>
                <strong className="text-slate-800">{invoiceToDelete.projectName}</strong>
              </div>
              <div className="flex justify-between">
                <span>العميل:</span>
                <strong className="text-slate-800">{invoiceToDelete.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>إجمالي الفاتورة:</span>
                <strong className="font-mono text-slate-900 font-bold">
                  {invoiceToDelete.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </strong>
              </div>
              {invoiceToDelete.paidAmount > 0 && (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>المبلغ المسدد المسجل:</span>
                  <span className="font-mono">{invoiceToDelete.paidAmount.toLocaleString()} SAR</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                ⚠️ سيؤدي حذف الفاتورة إلى إزالتها نهائياً، وإلغاء أي سندات قبض مسجلة عليها، وإعادة الأصناف إلى حالة غير مفوترة في المشروع لتمكينك من إعادة فوترتها وتصحيحها.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteInvoice) onDeleteInvoice(invoiceToDelete.id);
                  setInvoiceToDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد حذف الفاتورة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showSOA && (
        <StatementOfAccountModal
          isOpen={true}
          onClose={() => setShowSOA(false)}
          customers={customers}
          invoices={invoices}
          projects={projects}
        />
      )}
      {showReport && (
        <AccountingReportModal
          isOpen={true}
          onClose={() => setShowReport(false)}
          invoices={invoices}
          projects={projects}
        />
      )}

      {/* Project Selection Modal for New Invoice */}
      {showProjectSelectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#007A5A] flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">اختيار المشروع لإصدار فاتورة ضريبية</h3>
                  <p className="text-[11px] text-slate-500">اختر المشروع المطلوب إصدار فاتورة له (دفعة أولى، نهائية، أو مستخلص)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectSelectModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {projects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">لا توجد مشاريع مسجلة حالياً.</div>
              ) : (
                projects.map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setSelectedProjectForInvoice(proj);
                      setShowProjectSelectModal(false);
                      setShowCreateInvoiceModal(true);
                    }}
                    className="p-3.5 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{proj.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        العميل: <span className="font-medium text-slate-700">{proj.customerName}</span> | المرجع: <span className="font-mono">{proj.projectNumber}</span>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 bg-[#007A5A] text-white rounded-lg text-xs font-bold shrink-0">
                      اختيار وإصدار فاتورة
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Project Invoice Modal */}
      {showCreateInvoiceModal && selectedProjectForInvoice && (
        <CreateProjectInvoiceModal
          project={selectedProjectForInvoice}
          activeQuotation={quotations.find((q) => q.projectId === selectedProjectForInvoice.id || q.id === (selectedProjectForInvoice.activeCustomerQuotationId || selectedProjectForInvoice.activeQuotationId))}
          existingInvoices={invoices.filter((i) => i.projectId === selectedProjectForInvoice.id)}
          deliveryNotes={deliveryNotes.filter((dn) => dn.projectId === selectedProjectForInvoice.id)}
          onClose={() => {
            setShowCreateInvoiceModal(false);
            setSelectedProjectForInvoice(null);
          }}
          onSaveInvoice={(newInv) => {
            if (onCreateInvoice) onCreateInvoice(newInv);
            setShowCreateInvoiceModal(false);
            setSelectedProjectForInvoice(null);
          }}
        />
      )}

      {/* Tax Invoice Document Viewer & Payment Modal */}
      {viewingInvoice && (
        <TaxInvoiceDocument
          invoice={viewingInvoice}
          quotations={quotations}
          sourceQuotation={quotations.find((q) => q.id === viewingInvoice.sourceQuotationId || q.projectId === viewingInvoice.projectId)}
          onClose={() => setViewingInvoice(null)}
          onRecordPayment={(invId, payment) => {
            onRecordPayment(invId, payment);
            setViewingInvoice((prev) => {
              if (!prev) return null;
              const newPaid = (prev.paidAmount || 0) + payment.amount;
              const newRem = Math.max(0, (prev.grandTotal || 0) - newPaid);
              return {
                ...prev,
                paidAmount: newPaid,
                remainingAmount: newRem,
                status: newRem <= 0 ? 'Paid' : 'Partially Paid',
                payments: [...(prev.payments || []), payment],
              };
            });
          }}
          onDeletePayment={onDeletePayment}
          onUpdateInvoice={onUpdateInvoice}
        />
      )}
    </div>
  );
};
