import React, { useState } from 'react';
import {
  CostRecord,
  CustomerQuotation,
  Project,
  PurchaseOrder,
  SupplierQuotation,
  Invoice,
  DeliveryNote,
  QuotationItem,
  User,
} from '../types';
import {
  Award,
  Upload,
  Sparkles,
  FileText,
  Plus,
  Eye,
  Trash2,
  ShoppingBag,
  Truck,
  DollarSign,
  Receipt,
  CheckCircle2,
  Clock,
  Layers,
  ChevronLeft,
  Calendar,
  AlertCircle,
  FileCheck,
  Building,
  MapPin,
  BadgePercent,
  Percent,
} from 'lucide-react';
import { calculateProjectFinancialAudit } from '../utils/financialCalculations';
import { getSafeRetentionPercent, calculateRetentionFigures } from '../utils/projectValidation';
import { canViewFinancialData, isFieldEngineer } from '../utils/rbacUtils';

export interface ProjectOverviewTabProps {
  project: Project;
  quotations: CustomerQuotation[];
  supplierQuotations: SupplierQuotation[];
  purchaseOrders: PurchaseOrder[];
  deliveryNotes: DeliveryNote[];
  invoices: Invoice[];
  currentUser?: User;
  onSelectQuotation?: (quotationId: string) => void;
  onOpenUploadClientContractModal: () => void;
  onOpenPrepareQuoteModal: (supplierQuoteId?: string) => void;
  onViewSupplierQuote: (quote: SupplierQuotation) => void;
  onDeleteSupplierQuote?: (quote: SupplierQuotation) => void;
  onOpenNewPOModal: (projectId?: string, supplierQuoteId?: string) => void;
  onGenerateProjectPOs?: (projectId: string) => void;
  onSelectPO?: (poId: string) => void;
  onViewDN: (dn: DeliveryNote) => void;
  onCreateDNFromPOs: () => void;
  onConvertDNToInvoice: (dn: DeliveryNote) => void;
  onOpenAddCostModal: () => void;
  onOpenAdvanceModal?: () => void;
  onOpenRetentionModal?: () => void;
}

export const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({
  project,
  quotations = [],
  supplierQuotations = [],
  purchaseOrders = [],
  deliveryNotes = [],
  invoices = [],
  currentUser,
  onSelectQuotation,
  onOpenUploadClientContractModal,
  onOpenPrepareQuoteModal,
  onViewSupplierQuote,
  onDeleteSupplierQuote,
  onOpenNewPOModal,
  onGenerateProjectPOs,
  onSelectPO,
  onViewDN,
  onCreateDNFromPOs,
  onConvertDNToInvoice,
  onOpenAddCostModal,
  onOpenAdvanceModal,
  onOpenRetentionModal,
}) => {
  // Scoped lists
  const linkedCustomerQuotes = quotations.filter((q) => q.projectId === project.id);
  const primaryQuote = linkedCustomerQuotes[0];
  const linkedSupplierQuotes = supplierQuotations.filter((sq) => sq.projectId === project.id);
  const linkedPurchaseOrders = purchaseOrders.filter((po) => po.projectId === project.id);
  const linkedDeliveryNotes = deliveryNotes.filter((dn) => dn.projectId === project.id);
  const linkedInvoices = invoices.filter((inv) => inv.projectId === project.id);

  // Financial Audit Calculations
  const financialAudit = calculateProjectFinancialAudit(
    project,
    quotations,
    purchaseOrders
  );

  const contractValue =
    project.clientContractPO?.grandTotal ||
    primaryQuote?.totals?.grandTotalWithVat ||
    project.budget ||
    0;

  const totalInvoiced = linkedInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalCollected = linkedInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0) + (project.advancePaymentAmount || 0);

  // Retention
  const { percent: retentionPercent, amount: retentionAmount } = calculateRetentionFigures(
    contractValue,
    project.retentionPercent,
    project.retentionAmount,
    project.retentionAmount && project.retentionAmount > 0 && !project.retentionPercent ? 'fixed' : 'percent'
  );

  // Strict Field Engineer RBAC Financial Isolation
  const canSeeFinancials = canViewFinancialData(currentUser ?? null);
  const isEngineer = isFieldEngineer(currentUser ?? null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" dir="rtl">
      {/* Left 2 Cols: Linked Quotations, POs, Delivery Notes, Cost Control */}
      <div className="lg:col-span-2 space-y-6">
        {/* 1. Client Awarded PO / Contract Section */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">
                عقد وأمر شراء العميل للمشروع (Client PO / Contract)
              </h3>
              {project.clientContractPO && (
                <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                  معتمد ومثبت
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenUploadClientContractModal}
              className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{project.clientContractPO ? 'تعديل / إعادة رفع أمر الشراء' : 'رفع وتثبيت أمر شراء العميل (AI)'}</span>
            </button>
          </div>

          {project.clientContractPO ? (
            <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-900">
                      {project.clientContractPO.clientPONumber}
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      عقد معتمد
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    تاريخ أمر الشراء: {project.clientContractPO.poDate}
                    {project.clientContractPO.fileName && (
                      <span className="text-slate-500 mr-2">| الملف: {project.clientContractPO.fileName}</span>
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">قيمة العقد المعتمد</span>
                  {canSeeFinancials ? (
                    <span className="font-mono text-base font-extrabold text-[#007A5A]">
                      {project.clientContractPO.grandTotal.toLocaleString()} SAR
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      محمي / الإدارة المالية
                    </span>
                  )}
                </div>
              </div>

              {project.clientContractPO.items && project.clientContractPO.items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-100/80">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1">
                    جدول بنود وكميات أمر الشراء للتنفيذ الميداني ({project.clientContractPO.items.length} بنود):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
                    {project.clientContractPO.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white/80 p-2 rounded border border-blue-100">
                        <span className="font-medium text-slate-800 truncate max-w-md">{it.description}</span>
                        <div className="flex items-center gap-3 shrink-0 font-mono text-slate-600">
                          <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">{it.quantity} {it.unit}</span>
                          {canSeeFinancials && (
                            <span className="font-bold text-slate-900">{it.totalPrice.toLocaleString()} SAR</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 border-2 border-dashed border-blue-200 bg-blue-50/30 rounded-xl text-center space-y-2">
              <Award className="w-8 h-8 text-blue-500 mx-auto opacity-80" />
              <p className="text-xs font-bold text-slate-800">
                لم يتم رفع أمر شراء العميل (Client PO) أو العقد المعتمد بعد
              </p>
              <p className="text-[11px] text-slate-600 max-w-md mx-auto">
                يمكنك رفع مستند أمر الشراء / العقد بصيغة PDF أو صورة وسيقوم النظام باستخراج رقم التعميد، المبالغ، والكميات تلقائياً وتثبيتها بالمشروع.
              </p>
              <button
                type="button"
                onClick={onOpenUploadClientContractModal}
                className="mt-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm inline-flex items-center gap-2 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>رفع أمر شراء العميل عبر الذكاء الاصطناعي</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Linked Customer Quotations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#007A5A]" />
              <h3 className="text-sm font-bold text-slate-800">
                عروض أسعار العملاء للمشروع (Customer Quotations)
              </h3>
              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {linkedCustomerQuotes.length}
              </span>
            </div>

            {canSeeFinancials && (
              <button
                type="button"
                onClick={() => onOpenPrepareQuoteModal(linkedSupplierQuotes[0]?.id)}
                className="px-3.5 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>تجهيز تسعيرة عميل (Prepare Customer Quote)</span>
              </button>
            )}
          </div>

          {linkedCustomerQuotes.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-teal-200 bg-teal-50/40 rounded-xl text-center space-y-2">
              <FileText className="w-8 h-8 text-[#007A5A] mx-auto opacity-80" />
              <p className="text-xs font-bold text-slate-800">
                لا يوجد عرض سعر عميل صادر لهذا المشروع حتى الآن
              </p>
              <p className="text-[11px] text-slate-600 max-w-md mx-auto">
                يمكنك الآن تجهيز تسعيرة عميل معتمدة بناءً على جدول الكميات وتكاليف الموردين، تحديد هامش الربح وشروط العقد وإصدارها مباشرة.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedCustomerQuotes.map((q) => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#007A5A]">
                        #{q.customerQuotationId || q.quotationNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          (q.status as string) === 'Approved' || (q.status as string) === 'won'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (q.status as string) === 'sent_to_customer' || (q.status as string) === 'Sent'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {(q.status as string) === 'Approved' || (q.status as string) === 'won'
                          ? 'معتمد من العميل'
                          : (q.status as string) === 'sent_to_customer' || (q.status as string) === 'Sent'
                          ? 'مرسل للعميل'
                          : 'مسودة'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      التاريخ: {q.date} | {q.items?.length || 0} بنود
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {canSeeFinancials ? (
                        <>
                          <span className="font-mono text-xs font-bold text-slate-900 block">
                            {(q.totals?.grandTotalWithVat || q.totals?.customerSellingPrice || 0).toLocaleString()} SAR
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            شامل 15% ضريبة
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          التسعير خاص بالإدارة
                        </span>
                      )}
                    </div>

                    {onSelectQuotation && (
                      <button
                        type="button"
                        onClick={() => onSelectQuotation(q.id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-[#007A5A] to-[#0c6b4f] hover:opacity-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>فتح عرض السعر</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Linked Supplier Quotations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#1e3a8a]" />
              <h3 className="text-sm font-bold text-slate-800">
                تسعيرات الموردين المستلمة للمشروع (Supplier Quotations)
              </h3>
              <span className="text-xs font-mono bg-blue-50 text-[#1e3a8a] border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                {linkedSupplierQuotes.length}
              </span>
            </div>
          </div>

          {linkedSupplierQuotes.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl text-center space-y-1.5">
              <FileText className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                لا توجد تسعيرات موردين مرتبطة بهذا المشروع
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedSupplierQuotes.map((sq) => (
                <div
                  key={sq.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{sq.supplierName}</span>
                      <span className="font-mono text-xs text-slate-500">#{sq.quotationNumber}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      الملف: {sq.rawFileName} ({sq.items.length} بنود مستخرجة)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canSeeFinancials ? (
                      <span className="font-mono text-xs font-bold text-slate-900 ml-2">
                        {sq.totalAmount.toLocaleString()} SAR
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded ml-2">
                        تسعيرة مورد معتمدة
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onViewSupplierQuote(sq)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-700" />
                      <span>معاينة</span>
                    </button>

                    {canSeeFinancials && (
                      <button
                        type="button"
                        onClick={() => onOpenPrepareQuoteModal(sq.id)}
                        className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-[#007A5A] border border-teal-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#007A5A]" />
                        <span>تسعيرة عميل</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenNewPOModal(project.id, sq.id)}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-[#1e3a8a]" />
                      <span>أمر شراء (PO)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Project Purchase Orders Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#1e3a8a]" />
              <h3 className="text-sm font-bold text-slate-800">
                أوامر الشراء الصادرة للمشروع (Project Purchase Orders)
              </h3>
              <span className="text-xs font-mono bg-blue-50 text-[#1e3a8a] border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                {linkedPurchaseOrders.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onGenerateProjectPOs && (
                <button
                  type="button"
                  onClick={() => onGenerateProjectPOs(project.id)}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-95 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>إصدار أوامر شراء للمشروع (Generate POs)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenNewPOModal(project.id)}
                className="px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#152e6f] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إصدار أمر شراء مخصص</span>
              </button>
            </div>
          </div>

          {linkedPurchaseOrders.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-blue-200 bg-blue-50/20 rounded-xl text-center space-y-2">
              <ShoppingBag className="w-8 h-8 text-[#1e3a8a] mx-auto opacity-70" />
              <p className="text-xs font-semibold text-slate-700">
                لم يتم إصدار أمر شراء للموزعين في هذا المشروع حتى الآن
              </p>
              <button
                type="button"
                onClick={() => onOpenNewPOModal(project.id)}
                className="mt-1 px-3 py-1.5 bg-[#1e3a8a] text-white rounded-lg text-xs font-bold hover:bg-[#152e6f] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إصدار أمر شراء الآن</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedPurchaseOrders.map((po) => (
                <div
                  key={po.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#1e3a8a]">
                        {po.poNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          po.status === 'Issued'
                            ? 'bg-blue-100 text-blue-800'
                            : po.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : po.status === 'Completed'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {po.status === 'Issued'
                          ? 'صادر للموزع'
                          : po.status === 'Approved'
                          ? 'معتمد'
                          : po.status === 'Completed'
                          ? 'مكتمل'
                          : 'مسودة'}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {po.vendorName}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      التاريخ: {po.date} | التوريد: {po.deliveryDate} | {po.items.length} بنود
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {canSeeFinancials ? (
                        <>
                          <span className="font-mono text-xs font-bold text-slate-900 block">
                            {po.grandTotal.toLocaleString()} SAR
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            شامل 15% ضريبة
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          أمر شراء معتمد
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectPO && onSelectPO(po.id)}
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-50 text-[#1e3a8a] border border-slate-300 hover:border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <span>عرض النموذج</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 5. DEDICATED SECTION: DELIVERY NOTES TO CLIENT (سندات التسليم) */}
        {/* Directly below POs and above Incurred Cost Log               */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    سندات التسليم الصادرة للعميل (Client Delivery Notes - DN)
                  </h3>
                  <span className="text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    {linkedDeliveryNotes.length} سندات
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  إدارة وثائق تسليم المواد الميدانية للعميل والمطابقة مع أوامر الشراء والترحيل للفواتير
                </p>
              </div>
            </div>

            {/* Quick Action Header Button */}
            <button
              type="button"
              onClick={onCreateDNFromPOs}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ إنشاء سند تسليم جديد من أوامر الشراء المستلمة</span>
            </button>
          </div>

          {linkedDeliveryNotes.length === 0 ? (
            <div className="p-5 border-2 border-dashed border-emerald-200 bg-emerald-50/20 rounded-xl text-center space-y-2">
              <Truck className="w-8 h-8 text-emerald-600 mx-auto opacity-70" />
              <p className="text-xs font-bold text-slate-800">
                لم يتم إصدار أي سند تسليم (DN) للعميل في هذا المشروع حتى الآن
              </p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                عند استلام المواد من الموردين، يمكنك تحويلها مباشرة إلى سند تسليم معتمد وموقع للعميل وترحيلها للفاتورة الضريبية.
              </p>
              <button
                type="button"
                onClick={onCreateDNFromPOs}
                className="mt-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إصدار أول سند تسليم للعميل</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedDeliveryNotes.map((dn) => {
                const isFullyInvoiced = dn.invoicedStatus === 'Fully Invoiced';
                const isPartiallyInvoiced = dn.invoicedStatus === 'Partially Invoiced';
                const isDeliveredAndSigned = dn.status === 'Delivered' || Boolean((dn as any).recipientSignature || dn.recipientName);

                return (
                  <div
                    key={dn.id}
                    className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 hover:border-emerald-300 transition shadow-2xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                          {dn.dnNumber}
                        </span>

                        {/* Status Badges */}
                        {isFullyInvoiced ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                            <Receipt className="w-3 h-3" />
                            <span>تمت الفوترة</span>
                          </span>
                        ) : isDeliveredAndSigned ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>مسلمة وموقعة</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>قيد التوريد والتسليم</span>
                          </span>
                        )}

                        <span className="text-xs font-bold text-slate-800">
                          المستلم: {dn.recipientName || project.customerName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-500">
                          التاريخ: {dn.date}
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {dn.items?.length || 0} أصناف مسلمة
                        </span>
                      </div>
                    </div>

                    {/* Metadata Sub-Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-100/60 p-2.5 rounded-lg border border-slate-200/60">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>الموقع: {dn.deliveryLocation || project.location || 'موقع المشروع المعتمد'}</span>
                        </div>
                        {(dn.sourcePONumber || (dn as any).purchaseOrderId || (dn as any).poNumber) && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            مرتبط بأمر شراء: {dn.sourcePONumber || (dn as any).purchaseOrderId || (dn as any).poNumber}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons per DN */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewDN(dn)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>معاينة وطباعة سند التسليم (View/Print DN)</span>
                        </button>

                        {!isFullyInvoiced && (
                          <button
                            type="button"
                            onClick={() => onConvertDNToInvoice(dn)}
                            className="px-3 py-1.5 bg-gradient-to-r from-[#007A5A] to-[#0c6b4f] hover:opacity-95 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-200" />
                            <span>ترحيل إلى فاتورة ضريبية (Convert to Tax Invoice)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. Incurred Cost Log - Strictly hidden for Field Engineers */}
        {canSeeFinancials && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-600" />
                <span>سجل التكاليف والمصروفات الفعلية (Incurred Cost Log)</span>
              </h3>
              <button
                type="button"
                onClick={onOpenAddCostModal}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ تسجيل مصروف</span>
              </button>
            </div>

            {(!project.incurredCosts || project.incurredCosts.length === 0) ? (
              <div className="p-4 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl text-center space-y-1.5">
                <DollarSign className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">
                  لم يتم تسجيل مصروفات أو تكاليف إضافية حتى الآن
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">التاريخ</th>
                      <th className="py-2.5 px-3">الوصف والتفاصيل</th>
                      <th className="py-2.5 px-3">التصنيف</th>
                      <th className="py-2.5 px-3">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(project.incurredCosts || []).map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{c.date}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{c.description}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                            {c.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-700 tabular-nums">
                          {c.amount.toLocaleString()} SAR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Col: Quick Financial & Execution Overview */}
      <div className="space-y-6">
        {canSeeFinancials ? (
          <>
            {/* Financial Summary Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#007A5A]" />
                <span>ملخص الإيرادات والتحصيل المالي</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">قيمة العقد المعتمد:</span>
                  <span className="font-mono font-bold text-slate-900">{contractValue.toLocaleString()} SAR</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">المفوتر حتى الآن:</span>
                  <span className="font-mono font-bold text-blue-700">{totalInvoiced.toLocaleString()} SAR</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">المحصل الفعلي:</span>
                  <span className="font-mono font-bold text-emerald-700">{totalCollected.toLocaleString()} SAR</span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">المتبقي للتحصيل:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {Math.max(0, contractValue - totalCollected).toLocaleString()} SAR
                  </span>
                </div>
              </div>
            </div>

            {/* Advance Payment & Retention Management */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BadgePercent className="w-4 h-4 text-purple-600" />
                <span>الدفعة المقدمة وحجز الضمان</span>
              </h3>

              <div className="space-y-3 text-xs">
                {/* Advance Payment */}
                <div className="p-3 rounded-lg border border-purple-100 bg-purple-50/40 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-900">الدفعة المقدمة (Advance Payment):</span>
                    {onOpenAdvanceModal && (
                      <button
                        type="button"
                        onClick={onOpenAdvanceModal}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                      >
                        تعديل / تسجيل
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-slate-600">المبلغ المسجل:</span>
                    <span className="font-bold text-purple-800">
                      {(project.advancePaymentAmount || 0).toLocaleString()} SAR
                    </span>
                  </div>
                </div>

                {/* Retention */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">حجز الضمان (Retention):</span>
                    {onOpenRetentionModal && (
                      <button
                        type="button"
                        onClick={onOpenRetentionModal}
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                      >
                        ضبط الضمان
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-slate-600">النسبة / القيمة:</span>
                    <span className="font-bold text-slate-900">
                      %{retentionPercent} ({retentionAmount.toLocaleString()} SAR)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">حالة الإفراج:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        project.retentionStatus === 'Released'
                          ? 'bg-emerald-100 text-emerald-800'
                          : project.retentionStatus === 'Due'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {project.retentionStatus === 'Released' ? 'تم الإفراج' : project.retentionStatus === 'Due' ? 'مستحق الإفراج' : 'محتجز'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Field Execution & Site Progress Card for Field Engineers */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#007A5A]" />
                <span>مؤشرات التنفيذ والإنجاز الميداني</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200/70">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-bold">نسبة الإنجاز الفعلي للمشروع:</span>
                    <span className="font-mono text-base font-extrabold text-[#007A5A]">
                      {project.completionPercentage || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-[#007A5A] h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, project.completionPercentage || 0))}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">حالة التنفيذ المعتمدة:</span>
                  <span className="font-bold bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded text-[11px]">
                    {project.executionStatus || 'قيد التنفيذ'}
                  </span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">سندات التسليم الميدانية:</span>
                  <span className="font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                    {linkedDeliveryNotes.length} سندات تسليم
                  </span>
                </div>

                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-600 font-medium">أوامر التوريد الصادرة:</span>
                  <span className="font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded text-[11px]">
                    {linkedPurchaseOrders.length} أوامر شراء
                  </span>
                </div>
              </div>
            </div>

            {/* Site Execution Guidelines & Submittals Card */}
            <div className="bg-gradient-to-br from-teal-50/70 to-emerald-50/50 p-5 rounded-xl border border-teal-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-[#007A5A] flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#007A5A]" />
                <span>ضوابط الاعتماد والتسليم الميداني</span>
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                بصفتك مهندس موقع وتنفيذ، تركز الصلاحيات الميدانية على مطابقة جداول الكميات (BOQ)، فحص المواد الموردة بموجب سندات التسليم، ورفع تقارير الإنجاز اليومية للإدارة.
              </p>
              <div className="pt-2 border-t border-teal-100 flex items-center gap-2 text-[10px] text-teal-800 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>البيانات المالية وعروض الأسعار مشفرة ومخصصة للإدارة المركزية</span>
              </div>
            </div>
          </>
        )}

        {/* Project Location & Team Quick Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-600" />
            <span>بيانات المشروع والتنفيذ</span>
          </h3>

          <div className="space-y-2 text-slate-600">
            <div className="flex justify-between">
              <span>العميل:</span>
              <strong className="text-slate-900">{project.customerName}</strong>
            </div>
            <div className="flex justify-between">
              <span>الموقع الميداني:</span>
              <span className="text-slate-800">{project.location || 'غير محدد'}</span>
            </div>
            <div className="flex justify-between">
              <span>مدير المشروع:</span>
              <span className="text-slate-800">{project.projectManager || 'م. مختار يوسف'}</span>
            </div>
            <div className="flex justify-between">
              <span>التصنيف الهندسي:</span>
              <span className="text-slate-800">{(project as any).systemCategory || (project as any).category || 'General MEP'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
