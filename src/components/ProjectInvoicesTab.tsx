import React, { useState } from 'react';
import { Project, CustomerQuotation, Invoice, DeliveryNote, InvoicePayment, PurchaseOrder, ItemDeliveryStatus } from '../types';
import { analyzeProjectInvoicing } from '../utils/invoiceUtils';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import { CompanyHeader } from './CompanyHeader';
import { TaxInvoiceDocument } from './TaxInvoiceDocument';
import { DeliveryNoteDocument } from './DeliveryNoteDocument';
import { CreateProjectInvoiceModal } from './CreateProjectInvoiceModal';
import { CreateDeliveryNoteModal } from './CreateDeliveryNoteModal';
import {
  Receipt,
  Truck,
  Plus,
  FileText,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  Eye,
  CreditCard,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface ProjectInvoicesTabProps {
  project: Project;
  activeQuotation?: CustomerQuotation;
  quotation?: CustomerQuotation;
  purchaseOrders?: PurchaseOrder[];
  invoices?: Invoice[];
  deliveryNotes?: DeliveryNote[];
  onOpenCreateInvoice?: () => void;
  onOpenCreateDeliveryNote?: () => void;
  onCreateInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onCreateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onUpdateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onDeleteDeliveryNote?: (deliveryNoteId: string) => void;
  onRecordPayment: (invoiceId: string, payment: InvoicePayment) => void;
  onDeletePayment?: (invoiceId: string, paymentId: string) => void;
  onUpdateItemDeliveryStatus?: (poId: string, itemId: string, newStatus: ItemDeliveryStatus, deliveredQty?: number) => void;
}

export const ProjectInvoicesTab: React.FC<ProjectInvoicesTabProps> = ({
  project,
  activeQuotation,
  quotation,
  purchaseOrders = [],
  invoices = [],
  deliveryNotes = [],
  onOpenCreateInvoice,
  onOpenCreateDeliveryNote,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onCreateDeliveryNote,
  onUpdateDeliveryNote,
  onDeleteDeliveryNote,
  onRecordPayment,
  onDeletePayment,
  onUpdateItemDeliveryStatus,
}) => {
  const currentQuote = activeQuotation || quotation;
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'items_breakdown' | 'delivery_notes' | 'statement'>('invoices');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewingDeliveryNote, setViewingDeliveryNote] = useState<DeliveryNote | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deliveryNoteToDelete, setDeliveryNoteToDelete] = useState<DeliveryNote | null>(null);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showCreateDeliveryNoteModal, setShowCreateDeliveryNoteModal] = useState(false);
  const [selectedDnIdsForInvoice, setSelectedDnIdsForInvoice] = useState<string[]>([]);

  const projectInvoices = (invoices || []).filter((inv) => inv.projectId === project.id);
  const projectDeliveryNotes = (deliveryNotes || []).filter((dn) => dn.projectId === project.id);

  const analysis = analyzeProjectInvoicing(project, currentQuote, invoices, deliveryNotes);

  const handleDNBillingClick = (dn: DeliveryNote) => {
    if (dn.invoicedStatus === 'Fully Invoiced') {
      const matchingInvoice = projectInvoices.find(
        (inv) =>
          inv.id === dn.linkedInvoiceId ||
          inv.invoiceNumber === dn.linkedInvoiceNumber ||
          (inv.poReference && inv.poReference.includes(dn.dnNumber)) ||
          (inv.items || []).some((it) => it.deliveryNoteRef === dn.dnNumber)
      );
      if (matchingInvoice) {
        setViewingInvoice(matchingInvoice);
        return;
      }
    }
    setSelectedDnIdsForInvoice([dn.id]);
    setShowCreateInvoiceModal(true);
  };

  if (viewingInvoice) {
    return (
      <TaxInvoiceDocument
        invoice={viewingInvoice}
        onClose={() => setViewingInvoice(null)}
        onRecordPayment={(id, pay) => {
          onRecordPayment(id, pay);
          // update viewing invoice in state
          const updated = invoices.find((inv) => inv.id === id);
          if (updated) setViewingInvoice(updated);
        }}
        onDeletePayment={(invId, payId) => {
          if (onDeletePayment) onDeletePayment(invId, payId);
          const updated = invoices.find((inv) => inv.id === invId);
          if (updated) setViewingInvoice(updated);
        }}
        onDeleteInvoice={(id) => {
          if (onDeleteInvoice) onDeleteInvoice(id);
          setViewingInvoice(null);
        }}
        onUpdateInvoice={(updatedInv) => {
          if (onUpdateInvoice) {
            onUpdateInvoice(updatedInv);
          }
          setViewingInvoice(updatedInv);
        }}
      />
    );
  }

  if (viewingDeliveryNote) {
    return (
      <DeliveryNoteDocument
        deliveryNote={viewingDeliveryNote}
        onClose={() => setViewingDeliveryNote(null)}
        onOpenInvoiceForDN={(dn) => {
          setViewingDeliveryNote(null);
          setSelectedDnIdsForInvoice([dn.id]);
          setShowCreateInvoiceModal(true);
        }}
        onDeleteDeliveryNote={(id) => {
          if (onDeleteDeliveryNote) onDeleteDeliveryNote(id);
          setViewingDeliveryNote(null);
        }}
        onUpdateDeliveryNote={(updatedDN) => {
          if (onUpdateDeliveryNote) {
            onUpdateDeliveryNote(updatedDN);
          }
          setViewingDeliveryNote(updatedDN);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Financial Dashboard KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>قيمة المشروع التعاقدية</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="font-mono text-lg font-bold text-slate-900">
            {analysis.totalProjectValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            إجمالي قيمة عرض السعر المعتمد
          </p>
        </div>

        {/* Billed */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800 text-xs mb-1">
            <span className="font-bold">المبالغ المفوترة (Billed)</span>
            <Receipt className="w-4 h-4 text-[#007A5A]" />
          </div>
          <div className="font-mono text-lg font-bold text-[#007A5A]">
            {analysis.totalBilledAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-emerald-100 rounded-full h-1.5 overflow-hidden">
              <div
                style={{ width: `${analysis.billingProgressPercent}%` }}
                className="bg-[#007A5A] h-full"
              />
            </div>
            <span className="text-[11px] font-mono font-bold text-[#007A5A]">
              {analysis.billingProgressPercent}%
            </span>
          </div>
        </div>

        {/* Unbilled */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-800 text-xs mb-1">
            <span className="font-bold">غير مفوتر (Unbilled)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-mono text-lg font-bold text-amber-700">
            {analysis.totalUnbilledAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <p className="text-[11px] text-amber-600/80 mt-1">
            متبقي للفوترة بعد إتمام التوريد
          </p>
        </div>

        {/* Collections */}
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-xs bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-800 text-xs mb-1">
            <span className="font-bold">المبالغ المحصلة (Collected)</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-mono text-lg font-bold text-blue-900">
            {analysis.totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>متبقي مستحق:</span>
            <span className="font-mono font-bold text-rose-600">
              {analysis.totalRemainingAmount.toLocaleString()} SAR
            </span>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Navigation Tabs */}
        <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'invoices'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-[#007A5A]" />
            <span>الفواتير المصدرة ({projectInvoices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('items_breakdown')}
            className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'items_breakdown'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>تفاصيل فوترة الأصناف (Billed vs Unbilled)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('delivery_notes')}
            className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'delivery_notes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>سندات التسليم ({projectDeliveryNotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('statement')}
            className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'statement'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-purple-600" />
            <span>كشف حساب العميل (Statement of Account)</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (onOpenCreateDeliveryNote) onOpenCreateDeliveryNote();
              else setShowCreateDeliveryNoteModal(true);
            }}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Truck className="w-4 h-4 text-blue-600" />
            <span>+ إذن تسليم بضاعة (Delivery Note)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenCreateInvoice) onOpenCreateInvoice();
              else setShowCreateInvoiceModal(true);
            }}
            className="px-4 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ إصدار فاتورة ضريبية</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Issued Invoices Table */}
      {activeSubTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
          {/* Advance Payment & Retention Engine Dashboard Card */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-blue-50/50 border-b border-emerald-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#007A5A] text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
                  <DollarSign className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>محرك الدفعة المقدمة ومحجوز الضمان (Advance Payment & Retention Engine)</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
                      نشط ومربوط آلياً بالفوترة
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    إدارة استقطاعات الدفعة المقدمة (Advance Deduction) ومحجوزات الضمان التعاقدي (Retention Holdbacks) عبر الفواتير الضريبية.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="bg-white px-3 py-2 rounded-xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">إجمالي الدفعة المقدمة:</span>
                  <span className="font-mono font-bold text-[#007A5A]">
                    {(project.advancePaymentAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                </div>
                <div className="bg-white px-3 py-2 rounded-xl border border-purple-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">نسبة محجوز الضمان:</span>
                  <span className="font-mono font-bold text-purple-800">
                    %{project.retentionPercent || 10} ({project.retentionStatus || 'محتجز لحين الفحص'})
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                قائمة الفواتير الضريبية والدفعات المقدمة للمشروع
              </h4>
              <p className="text-xs text-slate-500">
                سجل الفواتير الضريبية والدفعة الأولى المستلمة وفق بنود التعاقد
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              عدد الفواتير: {projectInvoices.length}
            </span>
          </div>

          {project.advancePaymentAmount && project.advancePaymentAmount > 0 && (
            <div className="bg-emerald-50/70 border-b border-emerald-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                      دفعة أولى مقدمة (Advance Payment)
                    </span>
                    <span className="text-xs font-mono text-slate-600">
                      رقم السند: {project.advancePaymentReceiptNo || 'ADV-RCP-01'}
                    </span>
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-950 mt-0.5">
                    المبلغ المستلم: {project.advancePaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    <span className="text-xs font-normal text-slate-600 mr-2">
                      (تاريخ: {project.advancePaymentDate || project.startDate} | طريقة السداد: {project.advancePaymentMethod || 'Bank Transfer'})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>مسددة بالكامل (مقبوضة)</span>
                </span>
              </div>
            </div>
          )}

          {projectInvoices.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h5 className="text-xs font-bold text-slate-700">
                لم يتم إصدار أي فواتير ضريبية لهذا المشروع حتى الآن
              </h5>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                يمكنك الضغط على زر "إصدار فاتورة ضريبية" بالأعلى لاختيار الأصناف المطلوبة وإصدار الفاتورة فوراً.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (onOpenCreateInvoice) onOpenCreateInvoice();
                  else setShowCreateInvoiceModal(true);
                }}
                className="px-4 py-2 bg-[#007A5A] text-white rounded-lg text-xs font-bold hover:bg-[#00664B] transition cursor-pointer"
              >
                إصدار أول فاتورة الآن
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3 text-center">تاريخ الإصدار</th>
                    <th className="p-3 text-center">الاستحقاق</th>
                    <th className="p-3 text-center">عدد الأصناف</th>
                    <th className="p-3 text-left">الإجمالي شامل الضريبة</th>
                    <th className="p-3 text-left">المبلغ المسدد</th>
                    <th className="p-3 text-left">المتبقي</th>
                    <th className="p-3 text-center">حالة السداد</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectInvoices.map((inv) => {
                    const isFullyPaid = inv.remainingAmount <= 0;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <div className="font-mono font-bold text-[#007A5A] text-sm">
                            {inv.invoiceNumber}
                          </div>
                          {inv.poReference && (
                            <span className="text-[10px] text-slate-400 block">
                              PO: {inv.poReference}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {inv.date}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {inv.dueDate}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-700">
                          {inv.items.length} صنف
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-slate-900 whitespace-nowrap">
                          {inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                        </td>
                        <td className="p-3 text-left font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {inv.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                        </td>
                        <td className="p-3 text-left font-mono font-bold whitespace-nowrap">
                          <span className={inv.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}>
                            {inv.remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                              isFullyPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : inv.paidAmount > 0
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isFullyPaid ? 'bg-emerald-500' : inv.paidAmount > 0 ? 'bg-amber-500' : 'bg-blue-500'
                              }`}
                            />
                            <span>
                              {isFullyPaid
                                ? 'مسددة بالكامل'
                                : inv.paidAmount > 0
                                ? 'مسددة جزئياً'
                                : 'معلقة / غير مسددة'}
                            </span>
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingInvoice(inv)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-[#007A5A] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>عرض وطباعة</span>
                            </button>
                            {onDeleteInvoice && (
                              <button
                                type="button"
                                onClick={() => setInvoiceToDelete(inv)}
                                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                                title="حذف الفاتورة وإلغاء تسجيلها"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Item-by-Item Billed vs Unbilled Breakdown */}
      {activeSubTab === 'items_breakdown' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                تفاصيل فوترة أصناف المشروع (Billed vs Unbilled Items)
              </h4>
              <p className="text-xs text-slate-500">
                متابعة الكميات والمبالغ المفوترة والمتبقية غير المفوترة لكل صنف من أصناف المشروع
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateInvoice}
              className="px-3 py-1.5 bg-[#007A5A] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-[#00664B] transition"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>فوترة الأصناف غير المفوترة</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3 text-center w-10">#</th>
                  <th className="p-3">وصف الصنف والمواصفات</th>
                  <th className="p-3 text-center w-20">إجمالي الكمية</th>
                  <th className="p-3 text-center w-24">الكمية المفوترة</th>
                  <th className="p-3 text-center w-24">الكمية غير المفوترة</th>
                  <th className="p-3 text-left w-28">سعر الوحدة</th>
                  <th className="p-3 text-left w-32">المبلغ المفوتر</th>
                  <th className="p-3 text-left w-32">المبلغ غير المفوتر</th>
                  <th className="p-3 text-center w-28">حالة الفوترة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.itemBillingStatus.map((item, idx) => (
                  <tr key={item.itemId || idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-center font-mono font-bold text-slate-500">
                      {item.itemNo || idx + 1}
                    </td>
                    <td className="p-3 font-medium text-slate-800">
                      <div className="whitespace-pre-line">{item.description}</div>
                      {item.isDelivered && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold mt-0.5">
                          <CheckCircle2 className="w-3 h-3" /> تم توريدها للعميل
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-emerald-800 bg-emerald-50/50">
                      {item.billedQty} {item.unit}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-amber-800 bg-amber-50/50">
                      {item.unbilledQty} {item.unit}
                    </td>
                    <td className="p-3 text-left font-mono text-slate-600 whitespace-nowrap">
                      {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                    <td className="p-3 text-left font-mono font-bold text-[#007A5A] whitespace-nowrap bg-emerald-50/30">
                      {item.billedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                    <td className="p-3 text-left font-mono font-bold text-amber-700 whitespace-nowrap bg-amber-50/30">
                      {item.unbilledAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === 'Fully Billed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : item.status === 'Partially Billed'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.status === 'Fully Billed'
                          ? 'مفوتر بالكامل'
                          : item.status === 'Partially Billed'
                          ? 'مفوتر جزئياً'
                          : 'صنف غير مفوتر (مؤجل)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Delivery Notes Tab */}
      {activeSubTab === 'delivery_notes' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                سندات وأوامر تسليم البضاعة للعميل (Delivery Notes)
              </h4>
              <p className="text-xs text-slate-500">
                أي سند تسليم يصدر يتم ربطه بالمحاسبة لتجهيز الأصناف المسلمة للفوترة التلقائية
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenCreateDeliveryNote}
              className="px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#152e6f] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>إصدار سند تسليم جديد</span>
            </button>
          </div>

          {projectDeliveryNotes.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <Truck className="w-6 h-6" />
              </div>
              <h5 className="text-xs font-bold text-slate-700">
                لم يتم تسجيل أي سندات تسليم لهذا المشروع حتى الآن
              </h5>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                عند توريد مواد للموقع، أصدر سند تسليم ليتم توقيعه من العميل وتجهيز الأصناف للفوترة.
              </p>
              <button
                type="button"
                onClick={onOpenCreateDeliveryNote}
                className="px-4 py-2 bg-[#1e3a8a] text-white rounded-lg text-xs font-bold hover:bg-[#152e6f] transition cursor-pointer"
              >
                إصدار سند تسليم الآن
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-3">رقم سند التسليم</th>
                    <th className="p-3 text-center">تاريخ التسليم</th>
                    <th className="p-3">موقع التسليم</th>
                    <th className="p-3">المستلم بالموقع</th>
                    <th className="p-3 text-center">عدد الأصناف المسلمة</th>
                    <th className="p-3 text-center">حالة السند</th>
                    <th className="p-3 text-center">حالة الفوترة المحاسبية</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectDeliveryNotes.map((dn) => (
                    <tr key={dn.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <span className="font-mono font-bold text-[#007A5A] text-sm">
                          {dn.dnNumber}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {dn.date}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {dn.deliveryLocation}
                      </td>
                      <td className="p-3 text-slate-700 font-semibold">
                        {dn.recipientName} {dn.recipientPhone ? `(${dn.recipientPhone})` : ''}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {dn.items.length} صنف
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {dn.status === 'Delivered' ? 'تم التوريد' : 'توريد جزئي'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDNBillingClick(dn)}
                          className={`px-2.5 py-1 rounded text-[10.5px] font-bold flex items-center justify-center gap-1 mx-auto transition cursor-pointer ${
                            dn.invoicedStatus === 'Fully Invoiced'
                              ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200'
                              : dn.invoicedStatus === 'Partially Invoiced'
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 animate-pulse'
                          }`}
                          title={
                            dn.invoicedStatus === 'Fully Invoiced'
                              ? 'اضغط لعرض الفاتورة الضريبية المرتبطة مباشرة (مقفول لمنع الازدواج المالي)'
                              : 'اضغط للانتقال مباشرة لإنشاء الفاتورة بهذا السند'
                          }
                        >
                          {dn.invoicedStatus === 'Fully Invoiced' ? (
                            <Lock className="w-3 h-3 text-purple-700" />
                          ) : (
                            <Receipt className="w-3 h-3" />
                          )}
                          <span>
                            {dn.invoicedStatus === 'Fully Invoiced'
                              ? 'تمت الفوترة بالكامل (مقفول 🔒)'
                              : dn.invoicedStatus === 'Partially Invoiced'
                              ? 'مفوتر جزئياً'
                              : 'جاهز للفوترة ⚡'}
                          </span>
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDNBillingClick(dn)}
                            className={`px-2.5 py-1 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              dn.invoicedStatus === 'Fully Invoiced'
                                ? 'bg-purple-700 hover:bg-purple-800'
                                : 'bg-blue-700 hover:bg-blue-800'
                            }`}
                            title={
                              dn.invoicedStatus === 'Fully Invoiced'
                                ? 'عرض الفاتورة الضريبية المرتبطة'
                                : 'إصدار فاتورة ضريبية لهذا السند بالأسعار المعتمدة'
                            }
                          >
                            {dn.invoicedStatus === 'Fully Invoiced' ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <Receipt className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {dn.invoicedStatus === 'Fully Invoiced'
                                ? 'عرض الفاتورة المرتبطة'
                                : 'إصدار فاتورة'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingDeliveryNote(dn)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-[#1e3a8a] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض وطباعة</span>
                          </button>
                          {onDeleteDeliveryNote && (
                            <button
                              type="button"
                              onClick={() => setDeliveryNoteToDelete(dn)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                              title="حذف سند التسليم وإلغاء تسجيل التوريد"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 4: Statement of Account (كشف حساب العميل للمشروع) */}
      {activeSubTab === 'statement' && (
        <div id="printable-project-invoices-statement" className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          {/* Printable Letterhead Header */}
          <div className="border-b border-slate-200 pb-4">
            <CompanyHeader />
          </div>

          {/* Statement Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block">
                كشف حساب العميل / Statement of Account
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                {project.customerName}
              </h3>
              <p className="text-xs text-slate-500">
                مشروع: <strong className="text-slate-800">{project.name}</strong> ({project.projectNumber})
              </p>
            </div>

            <div className="flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={() =>
                  executePrint('printable-project-invoices-statement', {
                    documentTitle: `كشف حساب العميل - مشروع ${project.name}`,
                  })
                }
                className="px-4 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="طباعة كشف الحساب مباشرة"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة كشف الحساب (Print / PDF)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openPrintPopup(
                    'printable-project-invoices-statement',
                    `كشف حساب العميل - مشروع ${project.name}`
                  )
                }
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="فتح في نافذة مستقلة للطباعة والتنسيق"
              >
                <span>نافذة مستقلة للطباعة</span>
              </button>
            </div>
          </div>

          {/* Statement Financial Matrix */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">إجمالي الفواتير الصادرة (مدين Debit)</span>
              <strong className="font-mono text-base font-bold text-slate-900">
                {analysis.totalBilledAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </strong>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-xs text-emerald-800 block mb-1">إجمالي السدادات المستلمة (دائن Credit)</span>
              <strong className="font-mono text-base font-bold text-emerald-800">
                {analysis.totalPaidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </strong>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-xs text-rose-800 block mb-1">الرصيد القائم المستحق (Balance Due)</span>
              <strong className="font-mono text-base font-bold text-rose-800">
                {analysis.totalRemainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </strong>
            </div>
          </div>

          {/* Statement Ledger Rows */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                <tr>
                  <th className="p-3 text-center">التاريخ</th>
                  <th className="p-3">نوع الحركة والبيان</th>
                  <th className="p-3 text-center">رقم المرجع</th>
                  <th className="p-3 text-left">مدين (Debit)</th>
                  <th className="p-3 text-left">دائن (Credit)</th>
                  <th className="p-3 text-left">الرصيد التراكمي (Balance)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(projectInvoices || []).map((inv) => (
                  <React.Fragment key={inv.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="p-3 text-center text-slate-600">{inv.date}</td>
                      <td className="p-3 font-sans font-medium text-slate-800">
                        فاتورة ضريبية مستحقة ({(inv.items || []).length} أصناف)
                      </td>
                      <td className="p-3 text-center text-[#007A5A] font-bold">
                        {inv.invoiceNumber}
                      </td>
                      <td className="p-3 text-left font-bold text-slate-900">
                        {inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-left text-slate-400">-</td>
                      <td className="p-3 text-left font-bold text-slate-800">
                        {inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                      </td>
                    </tr>

                    {(inv.payments || []).map((p) => (
                      <tr key={p.id} className="bg-emerald-50/40 hover:bg-emerald-50">
                        <td className="p-3 text-center text-slate-600">{p.date}</td>
                        <td className="p-3 font-sans font-medium text-emerald-900 flex items-center gap-1.5">
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                          <span>سداد دفعة - {p.paymentMethod} {p.referenceNo ? `(${p.referenceNo})` : ''}</span>
                        </td>
                        <td className="p-3 text-center text-slate-600 font-bold">
                          {p.referenceNo || 'PAY'}
                        </td>
                        <td className="p-3 text-left text-slate-400">-</td>
                        <td className="p-3 text-left font-bold text-emerald-700">
                          {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-left font-bold text-slate-800">
                          {(inv.grandTotal - p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Project Invoice Modal */}
      {showCreateInvoiceModal && (
        <CreateProjectInvoiceModal
          project={project}
          activeQuotation={currentQuote}
          existingInvoices={invoices}
          deliveryNotes={deliveryNotes}
          purchaseOrders={purchaseOrders}
          initialSelectedDeliveryNoteIds={selectedDnIdsForInvoice}
          onClose={() => {
            setSelectedDnIdsForInvoice([]);
            setShowCreateInvoiceModal(false);
          }}
          onSaveInvoice={(newInv) => {
            if (onCreateInvoice) onCreateInvoice(newInv);
            setSelectedDnIdsForInvoice([]);
            setShowCreateInvoiceModal(false);
          }}
        />
      )}

      {/* Create Delivery Note Modal */}
      {showCreateDeliveryNoteModal && (
        <CreateDeliveryNoteModal
          project={project}
          activeQuotation={currentQuote}
          existingDeliveryNotes={deliveryNotes}
          onClose={() => setShowCreateDeliveryNoteModal(false)}
          onSaveDeliveryNote={(newDn) => {
            if (onCreateDeliveryNote) onCreateDeliveryNote(newDn);
            setShowCreateDeliveryNoteModal(false);
          }}
        />
      )}

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

      {/* Delivery Note Delete Confirmation Modal */}
      {deliveryNoteToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف سند تسليم المواد</h3>
                <p className="text-xs text-rose-600 font-mono font-bold">{deliveryNoteToDelete.dnNumber}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5">
              <div className="flex justify-between">
                <span>المشروع:</span>
                <strong className="text-slate-800">{deliveryNoteToDelete.projectName}</strong>
              </div>
              <div className="flex justify-between">
                <span>العميل:</span>
                <strong className="text-slate-800">{deliveryNoteToDelete.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>موقع التسليم:</span>
                <strong className="text-slate-800">{deliveryNoteToDelete.deliveryLocation}</strong>
              </div>
              <div className="flex justify-between">
                <span>عدد الأصناف المسلمة:</span>
                <strong className="font-mono text-slate-900 font-bold">{deliveryNoteToDelete.items.length} صنف</strong>
              </div>
              <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                ⚠️ سيؤدي حذف سند التسليم إلى إلغاء تسجيل توريد هذه الأصناف، وإعادة الكميات المسلمة للصفر ليتسنى لك تصحيح أي أخطاء أو إعادة إصدار سند تسليم سليم.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeliveryNoteToDelete(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteDeliveryNote) onDeleteDeliveryNote(deliveryNoteToDelete.id);
                  setDeliveryNoteToDelete(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد حذف سند التسليم</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
