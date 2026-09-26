import React, { useState } from 'react';
import {
  CostRecord,
  CustomerQuotation,
  Project,
  PurchaseOrder,
  SupplierQuotation,
  Invoice,
  DeliveryNote,
  InvoicePayment,
  ItemDeliveryStatus,
  QuotationItem,
  User,
  ProjectDocument,
  ClientContractPO,
} from '../types';
import {
  Layers,
  Receipt,
  Calendar,
  FolderOpen,
  ChevronLeft,
  Plus,
  Award,
  FileText,
  Shield,
  Trash2,
  Trophy,
  Clock,
  XCircle,
} from 'lucide-react';
import { ProjectOverviewTab } from './ProjectOverviewTab';
import { ProjectDocumentsTab } from './ProjectDocumentsTab';
import { ProjectInvoicesTab } from './ProjectInvoicesTab';
import { ProjectPlanTab } from './ProjectPlanTab';
import { DeliveryNotePrintModal } from './DeliveryNotePrintModal';
import { calculateProjectActualProfitMargin } from '../services/billingService';
import {
  getNormalizedProjectStatus,
  STATUS_CONFIG,
  ProjectStatus,
  getAutomatedCombinedStatus,
} from '../utils/projectStatusUtils';
import { ProjectPlan } from '../types';

export interface ProjectDetailViewProps {
  project: Project;
  customerQuotations: CustomerQuotation[];
  supplierQuotations: SupplierQuotation[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  deliveryNotes: DeliveryNote[];
  currentUser?: User;
  onBack: () => void;
  onSelectQuotation: (quotationId: string) => void;
  onSelectPO?: (poId: string) => void;
  onUpdateProjectDocuments?: (projectId: string, documents: ProjectDocument[]) => void;
  onUpdateMasterDriveUrl?: (projectId: string, url: string) => void;
  onUpdateProjectStatus?: (projectId: string, newStatus: ProjectStatus, lossReason?: string) => void;
  onUpdateProjectExecutionStatus?: (
    projectId: string,
    status: 'تام' | 'جزئي' | 'قيد التنفيذ',
    details?: any
  ) => void;
  onUpdateProjectPlan?: (plan: ProjectPlan) => void;
  onOpenUploadClientContractModal: () => void;
  onOpenPrepareQuoteModal: (supplierQuoteId?: string) => void;
  onViewSupplierQuote: (quote: SupplierQuotation) => void;
  onDeleteSupplierQuote?: (quote: SupplierQuotation) => void;
  onOpenNewPOModal: (projectId?: string, supplierQuoteId?: string) => void;
  onGenerateProjectPOs?: (projectId: string) => void;
  onCreateInvoice?: (invoice: Invoice) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onCreateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onUpdateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onDeleteDeliveryNote?: (deliveryNoteId: string) => void;
  onRecordPayment?: (invoiceId: string, payment: InvoicePayment) => void;
  onDeletePayment?: (invoiceId: string, paymentId: string) => void;
  onUpdateItemDeliveryStatus?: (poId: string, itemId: string, newStatus: ItemDeliveryStatus, deliveredQty?: number) => void;
  onOpenAddCostModal: () => void;
  onOpenAdvanceModal: () => void;
  onOpenRetentionModal: () => void;
  onOpenSOA: () => void;
  onOpenHandoverReport: () => void;
  onOpenLineage: () => void;
  onOpenPermissions: () => void;
  onDeleteProject: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  customerQuotations,
  supplierQuotations,
  purchaseOrders,
  invoices,
  deliveryNotes,
  currentUser,
  onBack,
  onSelectQuotation,
  onSelectPO,
  onUpdateProjectDocuments,
  onUpdateMasterDriveUrl,
  onUpdateProjectStatus,
  onUpdateProjectExecutionStatus,
  onUpdateProjectPlan,
  onOpenUploadClientContractModal,
  onOpenPrepareQuoteModal,
  onViewSupplierQuote,
  onDeleteSupplierQuote,
  onOpenNewPOModal,
  onGenerateProjectPOs,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onCreateDeliveryNote,
  onUpdateDeliveryNote,
  onDeleteDeliveryNote,
  onRecordPayment,
  onDeletePayment,
  onUpdateItemDeliveryStatus,
  onOpenAddCostModal,
  onOpenAdvanceModal,
  onOpenRetentionModal,
  onOpenSOA,
  onOpenHandoverReport,
  onOpenLineage,
  onOpenPermissions,
  onDeleteProject,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'documents' | 'invoices' | 'plan'>('overview');
  const [viewingDN, setViewingDN] = useState<DeliveryNote | null>(null);

  // Financial margin calculations via dynamic billing engine
  const marginAnalysis = calculateProjectActualProfitMargin(
    project,
    customerQuotations,
    purchaseOrders,
    project.incurredCosts || []
  );

  // Automated Project Lifecycle Status & Progress Derivation
  const automatedStatus = getAutomatedCombinedStatus(project, {
    customerQuotations,
    purchaseOrders,
    deliveryNotes,
    invoices,
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Unified Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-slate-700 hover:text-[#007A5A] bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
        >
          <span>← العودة إلى قائمة المشاريع / Back to Projects</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddCostModal}
            className="px-3.5 py-2 text-xs font-bold bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل تكلفة (Log Cost)</span>
          </button>

          <button
            type="button"
            onClick={onOpenHandoverReport}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Award className="w-4 h-4 text-emerald-600" />
            <span>تقرير الإنجاز (Progress Report)</span>
          </button>

          <button
            type="button"
            onClick={onOpenSOA}
            className="px-3.5 py-2 text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-purple-600" />
            <span>كشف الحساب (Customer SOA)</span>
          </button>

          <button
            type="button"
            onClick={onOpenLineage}
            className="px-3.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-indigo-700" />
            <span>سلسلة الإمداد (Lineage)</span>
          </button>

          <button
            type="button"
            onClick={onOpenPermissions}
            className="px-3.5 py-2 text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Shield className="w-4 h-4 text-teal-600" />
            <span>فريق المشروع</span>
          </button>

          <button
            type="button"
            onClick={onDeleteProject}
            className="px-3 py-2 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition cursor-pointer mr-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف المشروع</span>
          </button>
        </div>
      </div>

      {/* Project Header Banner & Financial Margin Summary */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-600">
                {project.projectNumber}
              </span>
              {/* Automated Combined Status Badge */}
              <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-xs font-bold shadow-2xs" title="حالة المشروع ونسبة الإنجاز مربوطة آلياً بدورة حياة المشروع">
                <span className={`flex items-center gap-1.5 ${automatedStatus.awardConfig.badgeClass} px-2.5 py-0.5 rounded-full text-xs font-bold`}>
                  {automatedStatus.awardOutcome === 'Won' && <Trophy className="w-3.5 h-3.5" />}
                  {automatedStatus.awardOutcome === 'Under Pricing' && <Clock className="w-3.5 h-3.5" />}
                  {automatedStatus.awardOutcome === 'Lost' && <XCircle className="w-3.5 h-3.5" />}
                  <span>{automatedStatus.awardConfig.labelAr}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${automatedStatus.executionBadgeClass}`}>
                  {automatedStatus.executionSubLabel}
                </span>
              </div>
            </div>

            <h1 className="text-xl font-bold text-slate-900 mt-2">
              {project.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              العميل: <span className="font-semibold text-slate-700">{project.customerName}</span> | الموقع: {project.location}
            </p>
          </div>

          {/* Financial KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 w-full lg:w-auto">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold">قيمة العقد</span>
              <span className="text-base font-bold font-mono text-[#007A5A]">
                {marginAnalysis.contractSellingPriceExVat.toLocaleString()} <span className="text-[10px]">SAR</span>
              </span>
              <span className="text-[9px] text-slate-400 block font-mono">صافي بدون ضريبة</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold">التوريد الملتزم (PO)</span>
              <span className="text-base font-bold font-mono text-blue-700">
                {marginAnalysis.totalPOCommittedExVat.toLocaleString()} <span className="text-[10px]">SAR</span>
              </span>
              <span className="text-[9px] text-slate-400 block font-mono">أوامر الشراء</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold">المصروفات الفعلية</span>
              <span className="text-base font-bold font-mono text-slate-900">
                {marginAnalysis.totalIncurredCostsExVat.toLocaleString()} <span className="text-[10px]">SAR</span>
              </span>
              <span className="text-[9px] text-slate-400 block">سجل التكاليف</span>
            </div>

            <div className="text-right bg-white p-2 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block font-bold">هامش الربح الفعلي</span>
              <span
                className={`text-base font-black font-mono ${
                  marginAnalysis.actualProfitMarginPercent >= 20
                    ? 'text-emerald-600'
                    : marginAnalysis.actualProfitMarginPercent > 0
                    ? 'text-blue-600'
                    : 'text-rose-600'
                }`}
              >
                {marginAnalysis.actualProfitMarginPercent.toFixed(1)}%
              </span>
              <span className="text-[9px] text-slate-400 block font-mono">
                صافي: {marginAnalysis.actualProfitAmount.toLocaleString()} SAR
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
            activeSubTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>نظرة عامة والتكاليف والتسعيرات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('documents')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
            activeSubTab === 'documents'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-blue-500" />
          <span>مستودع الوثائق والمخططات السحابية (Drive Documents)</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
            {(project.documents || []).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('invoices')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
            activeSubTab === 'invoices'
              ? 'bg-[#007A5A] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>الفواتير الضريبية وسندات التسليم (Invoices & Delivery)</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono font-bold">
            {(invoices || []).filter((inv) => inv.projectId === project.id).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('plan')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
            activeSubTab === 'plan'
              ? 'bg-[#007A5A] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>تخطيط وجدولة المشروع (Project Plan & WBS)</span>
        </button>
      </div>

      {/* Tab Content Rendering */}
      {activeSubTab === 'documents' ? (
        <ProjectDocumentsTab
          project={project}
          supplierQuotations={supplierQuotations.filter((sq) => sq.projectId === project.id)}
          onUpdateProjectDocuments={onUpdateProjectDocuments}
          onUpdateMasterDriveUrl={onUpdateMasterDriveUrl}
          onViewSupplierQuote={onViewSupplierQuote}
        />
      ) : activeSubTab === 'invoices' ? (
        <ProjectInvoicesTab
          project={project}
          quotation={customerQuotations.find((q) => q.projectId === project.id)}
          purchaseOrders={purchaseOrders.filter((po) => po.projectId === project.id)}
          invoices={(invoices || []).filter((inv) => inv.projectId === project.id)}
          deliveryNotes={(deliveryNotes || []).filter((dn) => dn.projectId === project.id)}
          onCreateInvoice={onCreateInvoice}
          onUpdateInvoice={onUpdateInvoice}
          onDeleteInvoice={onDeleteInvoice}
          onCreateDeliveryNote={onCreateDeliveryNote}
          onUpdateDeliveryNote={onUpdateDeliveryNote}
          onDeleteDeliveryNote={onDeleteDeliveryNote}
          onRecordPayment={onRecordPayment}
          onDeletePayment={onDeletePayment}
          onUpdateItemDeliveryStatus={onUpdateItemDeliveryStatus}
        />
      ) : activeSubTab === 'plan' ? (
        <ProjectPlanTab
          project={project}
          onUpdateProjectPlan={(plan) => {
            try {
              localStorage.setItem(`rmt_project_plan_${project.id}`, JSON.stringify(plan));
            } catch {}
            if (onUpdateProjectPlan) {
              onUpdateProjectPlan(plan);
            }
          }}
        />
      ) : (
        <ProjectOverviewTab
          project={project}
          quotations={customerQuotations}
          supplierQuotations={supplierQuotations}
          purchaseOrders={purchaseOrders}
          deliveryNotes={deliveryNotes}
          invoices={invoices}
          currentUser={currentUser}
          onSelectQuotation={onSelectQuotation}
          onOpenUploadClientContractModal={onOpenUploadClientContractModal}
          onOpenPrepareQuoteModal={onOpenPrepareQuoteModal}
          onViewSupplierQuote={onViewSupplierQuote}
          onDeleteSupplierQuote={onDeleteSupplierQuote}
          onOpenNewPOModal={onOpenNewPOModal}
          onGenerateProjectPOs={onGenerateProjectPOs}
          onSelectPO={onSelectPO}
          onViewDN={(dn) => setViewingDN(dn)}
          onCreateDNFromPOs={() => {}}
          onConvertDNToInvoice={() => {}}
          onOpenAddCostModal={onOpenAddCostModal}
          onOpenAdvanceModal={onOpenAdvanceModal}
          onOpenRetentionModal={onOpenRetentionModal}
        />
      )}

      {/* Delivery Note Modal Preview & Print */}
      {viewingDN && (
        <DeliveryNotePrintModal
          isOpen={!!viewingDN}
          deliveryNote={viewingDN}
          onClose={() => setViewingDN(null)}
          onUpdateDeliveryNote={onUpdateDeliveryNote}
          onDeleteDeliveryNote={onDeleteDeliveryNote}
        />
      )}
    </div>
  );
};
