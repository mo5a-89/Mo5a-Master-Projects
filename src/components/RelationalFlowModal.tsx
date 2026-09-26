import React from 'react';
import { Project, PurchaseOrder, DeliveryNote, Invoice, CustomerQuotation, SupplierQuotation } from '../types';
import {
  Layers,
  ShoppingBag,
  Truck,
  Receipt,
  CreditCard,
  X,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  Building,
  UserCheck,
  Lock,
  FileText,
  DollarSign,
  Package,
} from 'lucide-react';

interface RelationalFlowModalProps {
  isOpen: boolean;
  project: Project;
  purchaseOrders: PurchaseOrder[];
  deliveryNotes: DeliveryNote[];
  invoices: Invoice[];
  customerQuotations?: CustomerQuotation[];
  supplierQuotations?: SupplierQuotation[];
  onClose: () => void;
  onViewPO?: (po: PurchaseOrder) => void;
  onViewDN?: (dn: DeliveryNote) => void;
  onViewInvoice?: (inv: Invoice) => void;
  onViewSupplierQuote?: (sq: SupplierQuotation) => void;
}

export const RelationalFlowModal: React.FC<RelationalFlowModalProps> = ({
  isOpen,
  project,
  purchaseOrders = [],
  deliveryNotes = [],
  invoices = [],
  customerQuotations = [],
  supplierQuotations = [],
  onClose,
  onViewPO,
  onViewDN,
  onViewInvoice,
  onViewSupplierQuote,
}) => {
  if (!isOpen) return null;

  const projectPOs = purchaseOrders.filter((po) => po.projectId === project.id);
  const projectDNs = deliveryNotes.filter((dn) => dn.projectId === project.id);
  const projectInvoices = invoices.filter((inv) => inv.projectId === project.id);
  const projectSupplierQuotes = supplierQuotations.filter((sq) => sq.projectId === project.id);
  const primaryQuote = customerQuotations.find((q) => q.projectId === project.id);

  // Extract receipts & payments
  const allReceipts = projectPOs.flatMap((po) =>
    (po.materialReceipts || []).map((mr) => ({ ...mr, poNumber: po.poNumber, vendorName: po.vendorName }))
  );

  const allPayments = projectInvoices.flatMap((inv) =>
    (inv.payments || []).map((p) => ({ ...p, invoiceNumber: inv.invoiceNumber }))
  );
  if (project.advancePaymentAmount && project.advancePaymentAmount > 0) {
    allPayments.unshift({
      id: 'adv-pay-0',
      invoiceNumber: 'دفعة مقدمة للمشروع',
      amount: project.advancePaymentAmount,
      date: project.advancePaymentDate || 'عند التثبيت',
      method: project.advancePaymentMethod || 'Bank Transfer',
      receiptNo: project.advancePaymentReceiptNo || 'ADV-001',
      recordedAt: project.advancePaymentDate || new Date().toISOString(),
    } as any);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  سلسلة الإمداد والتدفق المالي والتشغيلي (End-to-End Operational Lineage)
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-mono font-bold">
                  {project.projectNumber}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                المشروع: <strong className="text-white">{project.name}</strong> | العميل: <strong className="text-white">{project.customerName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6-Stage Connected Lifecycle Pipeline */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Supplier Quote */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  <span>1. تسعيرات الموردين</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded-full">
                  {projectSupplierQuotes.length}
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {projectSupplierQuotes.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">لا توجد تسعيرات</p>
                ) : (
                  projectSupplierQuotes.map((sq) => (
                    <div
                      key={sq.id}
                      onClick={() => onViewSupplierQuote?.(sq)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition text-[11px] space-y-0.5"
                    >
                      <div className="font-bold text-slate-800 truncate">{sq.supplierName}</div>
                      <div className="font-mono text-[10px] text-slate-500">#{sq.quotationNumber}</div>
                      <div className="font-mono font-bold text-[#007A5A] text-right">
                        {sq.totalAmount.toLocaleString()} SAR
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Procurement & POs */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-700" />
                  <span>2. أوامر الشراء (PO)</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded-full">
                  {projectPOs.length}
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {projectPOs.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">لم تصدر أوامر شراء</p>
                ) : (
                  projectPOs.map((po) => (
                    <div
                      key={po.id}
                      onClick={() => onViewPO?.(po)}
                      className="p-2 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 rounded-lg cursor-pointer transition text-[11px] space-y-0.5"
                    >
                      <div className="flex justify-between font-mono font-bold text-[#1e3a8a]">
                        <span>{po.poNumber}</span>
                        <span>{po.grandTotal.toLocaleString()} SAR</span>
                      </div>
                      <div className="text-[10px] text-slate-600 truncate">{po.vendorName}</div>
                      <div className="text-[9px] text-emerald-700 font-bold">{po.status}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. Material Receipts & Inventory (GRN) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                  <span>3. استلام المواد (GRN)</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-800 rounded-full">
                  {allReceipts.length}
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {allReceipts.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">لا توجد إيصالات</p>
                ) : (
                  allReceipts.map((mr, idx) => (
                    <div
                      key={mr.id || idx}
                      className="p-2 bg-indigo-50/40 border border-indigo-100 rounded-lg text-[11px] space-y-0.5"
                    >
                      <div className="flex justify-between font-mono font-bold text-indigo-900">
                        <span>{mr.receiptNumber}</span>
                        <span className="text-[9px] text-slate-500">{mr.receiptDate}</span>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {mr.receivedItems?.length || 0} بنود ({mr.vendorName})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. Delivery Notes to Client (DN) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-teal-700" />
                  <span>4. سندات التسليم (DN)</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-teal-50 text-teal-800 rounded-full">
                  {projectDNs.length}
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {projectDNs.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">لم تصدر سندات تسليم</p>
                ) : (
                  projectDNs.map((dn) => (
                    <div
                      key={dn.id}
                      onClick={() => onViewDN?.(dn)}
                      className="p-2 bg-slate-50 hover:bg-teal-50/60 border border-slate-200 rounded-lg cursor-pointer transition text-[11px] space-y-0.5"
                    >
                      <div className="flex justify-between font-mono font-bold text-teal-900">
                        <span>{dn.dnNumber}</span>
                        <span className="text-[9px] font-normal text-slate-500">{dn.date}</span>
                      </div>
                      <div className="text-[10px] text-slate-600 truncate">
                        {dn.items?.length || 0} أصناف | {dn.recipientName || 'الموقع'}
                      </div>
                      <div className="text-[9px] font-bold text-emerald-700">
                        {dn.invoicedStatus === 'Fully Invoiced' ? 'مفوتر 🔒' : 'جاهز للفوترة ⚡'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 5. Client Tax Invoices */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-purple-700" />
                  <span>5. الفواتير الضريبية</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-purple-50 text-purple-800 rounded-full">
                  {projectInvoices.length}
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {projectInvoices.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">لم تصدر فواتير</p>
                ) : (
                  projectInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => onViewInvoice?.(inv)}
                      className="p-2 bg-slate-50 hover:bg-purple-50/60 border border-slate-200 rounded-lg cursor-pointer transition text-[11px] space-y-0.5"
                    >
                      <div className="flex justify-between font-mono font-bold text-purple-900">
                        <span>{inv.invoiceNumber}</span>
                        <span>{inv.grandTotal.toLocaleString()} SAR</span>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        استحقاق: {inv.dueDate || inv.date}
                      </div>
                      <div className="text-[9px] font-bold text-emerald-700">
                        مسدد: {(inv.paidAmount || 0).toLocaleString()} SAR
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6. Collection / Payments */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                  <span>6. سندات التحصيل</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded-full">
                  {allPayments.length}
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {allPayments.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">لا توجد سندات تحصيل</p>
                ) : (
                  allPayments.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="p-2 bg-emerald-50/40 border border-emerald-100 rounded-lg text-[11px] space-y-0.5"
                    >
                      <div className="flex justify-between font-mono font-bold text-emerald-900">
                        <span>{p.receiptNumber || (p as any).receiptNo || 'REC'}</span>
                        <span>{p.amount.toLocaleString()} SAR</span>
                      </div>
                      <div className="text-[10px] text-slate-600 truncate">
                        {p.invoiceNumber} ({(p as any).paymentMethod || (p as any).method || 'Bank'})
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">{p.date}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>نظام ترابط متكامل يمنع ازدواجية الفوترة ويضمن سلامة التدفق المالي بين المشتريات والمبيعات.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
