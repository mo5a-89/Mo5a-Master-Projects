import React, { useState } from 'react';
import {
  CostRecord,
  CustomerQuotation,
  Project,
  PurchaseOrder,
  SupplierQuotation,
  SystemDiscipline,
  SYSTEM_DEFINITIONS,
  getSystemMeta,
  TermsLibraryItem,
  Invoice,
  DeliveryNote,
  InvoicePayment,
  ItemDeliveryStatus,
  QuotationItem,
  User,
} from '../types';
import {
  Briefcase,
  FileText,
  DollarSign,
  TrendingUp,
  Plus,
  Sparkles,
  Send,
  Calendar,
  MapPin,
  Building,
  User as UserIcon,
  ShieldCheck,
  ChevronLeft,
  X,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShoppingBag,
  Trash2,
  Trophy,
  Clock,
  XCircle,
  AlertCircle,
  Edit2,
  Receipt,
  Truck,
  CheckCircle2,
  Award,
  BadgePercent,
  Eye,
  Sliders,
  Paperclip,
  Upload,
  Shield,
  FolderOpen,
} from 'lucide-react';
import { ProjectOverviewTab } from './ProjectOverviewTab';
import { ProjectDocumentsTab } from './ProjectDocumentsTab';
import { StatementOfAccountModal } from './StatementOfAccountModal';
import { CreateDeliveryNoteModal } from './CreateDeliveryNoteModal';
import { DeliveryNoteDocument } from './DeliveryNoteDocument';
import { DeliveryNotePrintModal } from './DeliveryNotePrintModal';
import { CreateProjectInvoiceModal } from './CreateProjectInvoiceModal';
import { PrepareCustomerQuotationModal } from './PrepareCustomerQuotationModal';
import { ProjectLossReasonModal } from './ProjectLossReasonModal';
import { ProjectInvoicesTab } from './ProjectInvoicesTab';
import { ProjectExecutionFinalReportModal } from './ProjectExecutionFinalReportModal';
import { ProjectCustomerSOAModal } from './ProjectCustomerSOAModal';
import { SupplierQuoteDetailModal } from './SupplierQuoteDetailModal';
import { RegisterAdvancePaymentModal } from './RegisterAdvancePaymentModal';
import { ClientContractPOModal } from './ClientContractPOModal';
import { RelationalFlowModal } from './RelationalFlowModal';
import { ProjectPlanTab } from './ProjectPlanTab';
import { ProjectPermissionsModal } from './ProjectPermissionsModal';
import { calculateProjectFinancialAudit } from '../utils/financialCalculations';
import { getNextProjectNumber } from '../utils/quotationUtils';
import {
  ProjectOutcome,
  ProjectStatus,
  getNormalizedProjectStatus,
  STATUS_CONFIG,
  getAutomatedCombinedStatus,
  computeAutomatedAwardStatus,
  computeAutomatedExecutionProgress,
} from '../utils/projectStatusUtils';
import { getSafeRetentionPercent } from '../utils/projectValidation';
import { canViewFinancialData, isFieldEngineer } from '../utils/rbacUtils';
import { ClientContractPO, ProjectDocument, ProjectPlan } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  customerQuotations: CustomerQuotation[];
  supplierQuotations: SupplierQuotation[];
  purchaseOrders?: PurchaseOrder[];
  invoices?: Invoice[];
  deliveryNotes?: DeliveryNote[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onSelectQuotation: (quotationId: string) => void;
  onCreateProject: (project: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  onUpdateProjectStatus?: (projectId: string, newStatus: ProjectStatus, lossReason?: string) => void;
  onSaveClientContractPO?: (projectId: string, contractPO: ClientContractPO) => void;
  onUpdateProjectPlan?: (plan: ProjectPlan) => void;
  onUpdateProjectExecutionStatus?: (
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
    projectId: string,
    percent: number,
    amount?: number,
    status?: 'Held' | 'Due' | 'Released'
  ) => void;
  onAddCostRecord: (projectId: string, record: CostRecord) => void;
  termsLibrary?: TermsLibraryItem[];
  onIssueCustomerQuotation?: (quotation: CustomerQuotation) => void;
  onOpenUploadSupplierModal?: (projectId: string) => void;
  onOpenNewPOModal?: (projectId?: string, supplierQuoteId?: string) => void;
  onGenerateProjectPOs?: (projectId: string) => void;
  onSelectPO?: (poId: string) => void;
  onCreateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onCreateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onUpdateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onDeleteDeliveryNote?: (deliveryNoteId: string) => void;
  onRecordPayment?: (invoiceId: string, payment: InvoicePayment) => void;
  onDeletePayment?: (invoiceId: string, paymentId: string) => void;
  onUpdateItemDeliveryStatus?: (poId: string, itemId: string, newStatus: ItemDeliveryStatus, deliveredQty?: number) => void;
  onUpdateSupplierQuoteItems?: (quoteId: string, updatedItems: QuotationItem[]) => void;
  onDeleteSupplierQuotation?: (supplierQuoteId: string) => void;
  onUpdateProjectName?: (projectId: string, newName: string) => void;
  onPatchProject?: (projectId: string, patch: Partial<Project>) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onUpdateProjectDocuments?: (projectId: string, documents: ProjectDocument[]) => void;
  onUpdateMasterDriveUrl?: (projectId: string, url: string) => void;
  currentUser?: User;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  customerQuotations,
  supplierQuotations,
  purchaseOrders = [],
  invoices = [],
  deliveryNotes = [],
  selectedProjectId,
  onSelectProject,
  onSelectQuotation,
  onCreateProject,
  onDeleteProject,
  onUpdateProjectStatus,
  onSaveClientContractPO,
  onUpdateProjectPlan: onUpdateProjectPlanProp,
  onUpdateProjectExecutionStatus,
  onUpdateAdvancePayment,
  onUpdateRetention,
  onAddCostRecord,
  termsLibrary = [],
  onIssueCustomerQuotation,
  onOpenUploadSupplierModal,
  onOpenNewPOModal,
  onGenerateProjectPOs,
  onSelectPO,
  onCreateInvoice = () => {},
  onDeleteInvoice,
  onCreateDeliveryNote = () => {},
  onUpdateDeliveryNote,
  onDeleteDeliveryNote,
  onRecordPayment = () => {},
  onDeletePayment,
  onUpdateItemDeliveryStatus = () => {},
  onUpdateSupplierQuoteItems,
  onDeleteSupplierQuotation,
  onUpdateProjectName,
  onPatchProject,
  onUpdateInvoice,
  onUpdateProjectDocuments,
  onUpdateMasterDriveUrl,
  currentUser,
}) => {
  const canSeeFinancials = canViewFinancialData(currentUser ?? null);
  const isEngineer = isFieldEngineer(currentUser ?? null);
  const [projectSubTab, setProjectSubTab] = useState<'overview' | 'invoices' | 'plan' | 'documents'>('overview');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showAddCostModal, setShowAddCostModal] = useState(false);
  const [showPrepareQuoteModal, setShowPrepareQuoteModal] = useState(false);
  const [showClientContractModal, setShowClientContractModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [preselectedSupplierQuoteId, setPreselectedSupplierQuoteId] = useState<string | undefined>(undefined);
  const [preselectedSupplierQuoteIds, setPreselectedSupplierQuoteIds] = useState<string[] | undefined>(undefined);
  const [viewingSupplierQuote, setViewingSupplierQuote] = useState<SupplierQuotation | null>(null);
  const [supplierQuoteToDelete, setSupplierQuoteToDelete] = useState<SupplierQuotation | null>(null);

  // SOA & Final Handover Reports Modal State
  const [showExecutionReportModal, setShowExecutionReportModal] = useState(false);
  const [showCustomerSOAModal, setShowCustomerSOAModal] = useState(false);
  const [showAdvancePaymentModal, setShowAdvancePaymentModal] = useState(false);
  const [showRelationalFlowModal, setShowRelationalFlowModal] = useState(false);
  const [showFinancialAuditModal, setShowFinancialAuditModal] = useState(false);
  const [showProjectPermissionsModal, setShowProjectPermissionsModal] = useState(false);
  const [viewingDN, setViewingDN] = useState<DeliveryNote | null>(null);
  const [showCreateDNModal, setShowCreateDNModal] = useState(false);
  const [showCreateProjectInvoiceModal, setShowCreateProjectInvoiceModal] = useState(false);
  const [invoicePrefillDNIds, setInvoicePrefillDNIds] = useState<string[]>([]);
  const [modalTargetProject, setModalTargetProject] = useState<Project | null>(null);
  const [executionFilter, setExecutionFilter] = useState<'all' | 'تام' | 'جزئي' | 'قيد التنفيذ'>('all');

  // New Project Form State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLocation, setNewProjectLocation] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newAttnName, setNewAttnName] = useState('');
  const [newBudget, setNewBudget] = useState<number>(0);
  const [newSystems, setNewSystems] = useState<SystemDiscipline[]>([]);
  const [newProjectStatus, setNewProjectStatus] = useState<ProjectStatus>('Under Pricing');
  const [newProjectLossReason, setNewProjectLossReason] = useState<string>('');
  const [lossModalProject, setLossModalProject] = useState<Project | null>(null);

  // New Cost Record Form State
  const [costCategory, setCostCategory] = useState<CostRecord['category']>('materials');
  const [costDescription, setCostDescription] = useState('');
  const [costAmount, setCostAmount] = useState<number>(0);
  const [costInvoiceNumber, setCostInvoiceNumber] = useState('');

  // AI Assistant Chat State
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Inline Project Name Editing State
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectNameValue, setEditingProjectNameValue] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'user' | 'assistant'; text: string }>
  >([
    {
      sender: 'assistant',
      text: 'مرحباً مهندس مختار، أنا مساعد المشروع الذكي. يمكنك سؤالي عن: هامش ربح المشروع، تكاليف أنظمة MEP، أو مقارنة أسعار الموردين والتكاليف الفعلية.',
    },
  ]);

  // Project Plans & Tasks State (Auto-Lifecycle linkage)
  const [projectPlans, setProjectPlans] = useState<Record<string, ProjectPlan>>(() => {
    try {
      const saved = localStorage.getItem('rmt_project_plans_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateProjectPlan = (plan: ProjectPlan) => {
    setProjectPlans((prev) => {
      const next = { ...prev, [plan.projectId]: plan };
      try {
        localStorage.setItem('rmt_project_plans_map', JSON.stringify(next));
        localStorage.setItem(`rmt_project_plan_${plan.projectId}`, JSON.stringify(plan));
      } catch {}
      return next;
    });

    if (activeProject && onUpdateProjectExecutionStatus) {
      const progress = computeAutomatedExecutionProgress(activeProject, { projectPlan: plan });
      onUpdateProjectExecutionStatus(activeProject.id, progress.executionStatus, {
        completionPercentage: progress.completionPercentage,
      });
    }

    if (onUpdateProjectPlanProp) {
      onUpdateProjectPlanProp(plan);
    }
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  // Filter linked quotations & supplier quotes
  const linkedCustomerQuotes = customerQuotations.filter(
    (q) => q.projectId === selectedProjectId
  );
  const linkedSupplierQuotes = supplierQuotations.filter(
    (sq) => sq.projectId === selectedProjectId
  );
  const linkedPurchaseOrders = (purchaseOrders || []).filter(
    (po) => po.projectId === selectedProjectId
  );
  const totalPOCommitted = linkedPurchaseOrders.reduce(
    (sum, po) => sum + (Number(po.grandTotal) || 0),
    0
  );

  // Sum incurred actual costs
  const totalActualCost = (activeProject?.incurredCosts || []).reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );

  // Active customer quotation for project financials
  const primaryQuote = linkedCustomerQuotes[0];
  const plannedSellingPrice = primaryQuote?.totals.customerSellingPrice || 0;
  const plannedProjectCost = primaryQuote?.totals.totalProjectCost || 0;
  const plannedProfit = primaryQuote?.totals.grossProfit || 0;
  const plannedMarginPercent = primaryQuote?.totals.grossMarginPercent || 0;

  // Normalized Financial Audit & Margin Calculation
  const financialAudit = activeProject
    ? calculateProjectFinancialAudit(activeProject, customerQuotations, purchaseOrders || [])
    : null;

  const currentRevenueExVat = financialAudit ? financialAudit.clientRevenueExVat : plannedSellingPrice;
  const currentEffectiveCostExVat = financialAudit ? financialAudit.totalEffectiveCostExVat : (totalPOCommitted > 0 ? totalPOCommitted / 1.15 : plannedProjectCost);
  const currentActualProfit = financialAudit ? financialAudit.grossProfitExVat : (currentRevenueExVat - currentEffectiveCostExVat);
  const currentActualMargin = financialAudit ? financialAudit.grossMarginPercent : (currentRevenueExVat > 0 ? (currentActualProfit / currentRevenueExVat) * 100 : 0);

  const handleCreateNewProject = () => {
    if (!newProjectName.trim()) return;

    const resolvedSystems: SystemDiscipline[] = newSystems.length > 0 ? newSystems : ['hvac'];
    const p: Project = {
      id: `proj-${Date.now()}`,
      projectNumber: getNextProjectNumber(projects),
      name: newProjectName,
      customerName: newCustomerName || 'Client Est.',
      attnName: newAttnName || 'Projects Director',
      location: newProjectLocation || 'Eastern Province',
      systems: resolvedSystems,
      selectedSystems: resolvedSystems,
      status: newProjectStatus,
      lossReason: newProjectStatus === 'Lost' ? newProjectLossReason : undefined,
      budget: Number(newBudget) || 0,
      createdAt: new Date().toISOString(),
      incurredCosts: [],
    };

    onCreateProject(p);
    setShowNewProjectModal(false);
    setNewProjectName('');
    setNewCustomerName('');
    setNewAttnName('');
    setNewProjectLocation('');
    setNewSystems([]);
    setNewBudget(0);
    setNewProjectStatus('Under Pricing');
    setNewProjectLossReason('');
    onSelectProject(p.id);
  };

  const handleAddCost = () => {
    if (!selectedProjectId || !costAmount) return;

    const record: CostRecord = {
      id: `cost-${Date.now()}`,
      projectId: selectedProjectId,
      category: costCategory,
      description: costDescription || 'Site Expense',
      amount: Number(costAmount),
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: costInvoiceNumber,
    };

    onAddCostRecord(selectedProjectId, record);
    setShowAddCostModal(false);
    setCostDescription('');
    setCostAmount(0);
    setCostInvoiceNumber('');
  };

  const handleConfirmDelete = () => {
    if (!projectToDelete) return;
    if (onDeleteProject) {
      onDeleteProject(projectToDelete.id);
    }
    if (selectedProjectId === projectToDelete.id) {
      onSelectProject(null);
    }
    setProjectToDelete(null);
  };

  const handleAskAssistant = async () => {
    if (!assistantPrompt.trim() || !activeProject) return;

    const question = assistantPrompt;
    setAssistantPrompt('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: question }]);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai/project-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectData: {
            ...activeProject,
            linkedCustomerQuotes,
            linkedSupplierQuotes,
            plannedSellingPrice,
            plannedProjectCost,
            totalActualCost,
            currentActualMargin,
          },
          question,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setChatMessages((prev) => [
          ...prev,
          { sender: 'assistant', text: json.data?.answer || 'تم تحليل بيانات المشروع.' },
        ]);
      } else {
        // Fallback intelligent response based on project data
        let answer = `بناءً على سجلات مشروع "${activeProject.name}":\n`;
        if (question.includes('هامش') || question.includes('ربح')) {
          answer += `• هامش الربح المخطط في عرض السعر: ${plannedMarginPercent.toFixed(1)}% (صافي ربح متوقع ${plannedProfit.toLocaleString()} SAR).\n• إجمالي التكاليف المسجلة فعلياً حتى الآن: ${totalActualCost.toLocaleString()} SAR.`;
        } else if (question.includes('تكلفة') || question.includes('مورد')) {
          answer += `• تكلفة تسعيرة المورد (SFFECO): ${primaryQuote?.totals.totalSupplierCost.toLocaleString()} SAR.\n• إجمالي التكاليف الإضافية المجدولة: ${primaryQuote?.totals.totalAdditionalCosts.toLocaleString()} SAR (تركيب، شحن، فحص واختبار).`;
        } else {
          const projectSystems = activeProject.systems || activeProject.selectedSystems || [];
          answer += `• سعر البيع للعميل: ${plannedSellingPrice.toLocaleString()} SAR شامل الأنظمة المحددة (${projectSystems.join(', ')}).\n• الحالة الحالية: المشروع تحت السيطرة المالية وضمن الميزانية.`;
        }
        setChatMessages((prev) => [...prev, { sender: 'assistant', text: answer }]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `المشروع: ${activeProject.name}. إجمالي سعر البيع للعميل ${plannedSellingPrice.toLocaleString()} SAR، التكلفة الفعلية المسجلة ${totalActualCost.toLocaleString()} SAR.`,
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* If No Project Selected: Show All Projects Grid */}
      {!selectedProjectId ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                قائمة المشاريع وعمليات التنفيذ (Projects & Cost Control)
              </h2>
              <p className="text-xs text-slate-500">
                تتبع المشاريع، عروض الأسعار المرتبطة، حالة الإنجاز الميداني، ومحجوزات الضمان والفوترة
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="px-4 py-2 bg-[#007A5A] hover:bg-[#0c6b4f] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>مشروع جديد (New Project)</span>
              </button>
            </div>
          </div>

          {/* Execution Status Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-bold px-2">تصفية حسب حالة الإنجاز:</span>
            <button
              type="button"
              onClick={() => setExecutionFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                executionFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              كافة المشاريع ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setExecutionFilter('تام')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                executionFilter === 'تام'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>منجز بشكل تام ({projects.filter((p) => p.executionStatus === 'تام').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setExecutionFilter('جزئي')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                executionFilter === 'جزئي'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>منجز جزئياً ({projects.filter((p) => p.executionStatus === 'جزئي').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setExecutionFilter('قيد التنفيذ')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                executionFilter === 'قيد التنفيذ'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-800 hover:bg-blue-50 border border-blue-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>قيد التنفيذ ({projects.filter((p) => (p.executionStatus || 'قيد التنفيذ') === 'قيد التنفيذ').length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects
              .filter((p) => {
                if (executionFilter === 'all') return true;
                return (p.executionStatus || 'قيد التنفيذ') === executionFilter;
              })
              .map((p) => {
                const quotes = customerQuotations.filter((q) => q.projectId === p.id);
                const quote = quotes[0];
                const sellingPrice = quote?.totals.customerSellingPrice || 0;
                const margin = quote?.totals.grossMarginPercent || 0;
                const cardStatus = getAutomatedCombinedStatus(p, {
                  customerQuotations,
                  purchaseOrders,
                  deliveryNotes,
                  invoices,
                  projectPlans,
                });

                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#007A5A] hover:shadow-md cursor-pointer transition flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-xs text-slate-400 font-semibold">
                          {p.projectNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {/* Automated Combined Status Badge */}
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5 text-[11px] font-bold">
                            <span className={`flex items-center gap-1 ${cardStatus.awardConfig.badgeClass} px-2 py-0.5 rounded-full text-[10px]`}>
                              {cardStatus.awardOutcome === 'Won' && <Trophy className="w-3 h-3" />}
                              {cardStatus.awardOutcome === 'Under Pricing' && <Clock className="w-3 h-3" />}
                              {cardStatus.awardOutcome === 'Lost' && <XCircle className="w-3 h-3" />}
                              <span>{cardStatus.awardConfig.shortLabel}</span>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] border ${cardStatus.executionBadgeClass}`}>
                              {cardStatus.executionSubLabel}
                            </span>
                          </div>

                          <button
                            type="button"
                            id={`delete-project-btn-${p.id}`}
                            title="حذف المشروع (Delete Project)"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(p);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition opacity-80 hover:opacity-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        {editingProjectId === p.id ? (
                          <div className="flex items-center gap-1.5 w-full my-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              value={editingProjectNameValue}
                              onChange={(e) => setEditingProjectNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.stopPropagation();
                                  if (onUpdateProjectName && editingProjectNameValue.trim()) {
                                    onUpdateProjectName(p.id, editingProjectNameValue.trim());
                                  }
                                  setEditingProjectId(null);
                                } else if (e.key === 'Escape') {
                                  e.stopPropagation();
                                  setEditingProjectId(null);
                                }
                              }}
                              className="text-sm font-bold px-2 py-1 bg-white border border-[#007A5A] rounded-lg shadow-sm focus:outline-none w-full text-slate-900 font-sans"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onUpdateProjectName && editingProjectNameValue.trim()) {
                                  onUpdateProjectName(p.id, editingProjectNameValue.trim());
                                }
                                setEditingProjectId(null);
                              }}
                              className="px-2.5 py-1 bg-[#007A5A] text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition"
                              title="حفظ"
                            >
                              حفظ
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/title">
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#007A5A] transition">
                              {p.name}
                            </h3>
                            {onUpdateProjectName && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProjectId(p.id);
                                  setEditingProjectNameValue(p.name);
                                }}
                                className="p-1 text-slate-400 hover:text-[#007A5A] hover:bg-emerald-50 rounded-md transition opacity-0 group-hover/title:opacity-100 cursor-pointer"
                                title="تعديل اسم المشروع"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-slate-500 mt-0.5">
                          Client: <span className="font-medium text-slate-700">{p.customerName}</span>
                        </p>
                        {cardStatus.awardOutcome === 'Lost' && p.lossReason && (
                          <div className="mt-2 bg-rose-50 border border-rose-200/80 rounded-md p-2 text-[11px] text-rose-800 flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-relaxed">
                              <strong className="font-bold">سبب الخسارة:</strong> {p.lossReason}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Execution Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">نسبة الإنجاز المحسوبة آلياً:</span>
                          <span className="font-mono font-bold text-slate-800">%{cardStatus.completionPercentage}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              cardStatus.executionStatus === 'تام'
                                ? 'bg-emerald-600'
                                : cardStatus.executionStatus === 'جزئي'
                                ? 'bg-amber-500'
                                : 'bg-blue-600'
                            }`}
                            style={{ width: `${cardStatus.completionPercentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.location}</span>
                      </div>

                      {/* Systems Tags */}
                      <div className="flex flex-wrap gap-1">
                        {(p?.systems || p?.selectedSystems || []).map((sys) => {
                          const def = getSystemMeta(sys);
                          return (
                            <span
                              key={sys}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium"
                            >
                              {def?.nameEn ?? sys}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        {canSeeFinancials ? (
                          <>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Selling Price</span>
                              <span className="font-mono font-bold text-[#007A5A]">
                                {sellingPrice.toLocaleString()} SAR
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block">Retention (ضمان)</span>
                              <span className="font-mono font-bold text-purple-700">
                                %{getSafeRetentionPercent(p.retentionPercent)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-[10px] text-slate-500 block">سندات التسليم</span>
                              <span className="font-mono font-bold text-blue-700">
                                {(deliveryNotes || []).filter((dn) => dn.projectId === p.id).length} سندات
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">المرحلة الميدانية</span>
                              <span className="text-xs font-bold text-emerald-800">
                                {p.executionStatus || 'قيد التنفيذ'}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Card Quick Actions: SOA & Handover Report */}
                      <div className="flex items-center gap-1.5 pt-1">
                        {canSeeFinancials && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalTargetProject(p);
                              setShowCustomerSOAModal(true);
                            }}
                            className="flex-1 py-1 px-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-[10.5px] font-bold border border-purple-200 flex items-center justify-center gap-1 transition cursor-pointer"
                            title="كشف حساب العميل والفوترة والدفعات"
                          >
                            <FileText className="w-3 h-3 text-purple-600" />
                            <span>كشف الحساب</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalTargetProject(p);
                            setShowExecutionReportModal(true);
                          }}
                          className="flex-1 py-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10.5px] font-bold border border-emerald-200 flex items-center justify-center gap-1 transition cursor-pointer"
                          title="تقرير الإنجاز والتسليم النهائي للمشروع"
                        >
                          <Award className="w-3 h-3 text-emerald-600" />
                          <span>تقرير الإنجاز</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ) : activeProject ? (
        /* Selected Project Detailed View */
        <div className="space-y-6">
          {/* Back Navigation & Unified Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => onSelectProject(null)}
              className="text-xs font-bold text-slate-700 hover:text-[#007A5A] bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>← العودة إلى قائمة المشاريع</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddCostModal(true)}
                className="px-3.5 py-2 text-xs font-bold bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>تسجيل تكلفة (Log Cost)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTargetProject(activeProject);
                  setShowExecutionReportModal(true);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Award className="w-4 h-4 text-emerald-600" />
                <span>تقرير الإنجاز (Progress Report)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTargetProject(activeProject);
                  setShowCustomerSOAModal(true);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-purple-600" />
                <span>كشف الحساب (Customer SOA)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRelationalFlowModal(true)}
                className="px-3.5 py-2 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Layers className="w-4 h-4 text-indigo-700" />
                <span>سلسلة الإمداد (Lineage)</span>
              </button>

              <button
                type="button"
                onClick={() => setShowProjectPermissionsModal(true)}
                className="px-3.5 py-2 text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Shield className="w-4 h-4 text-teal-600" />
                <span>صلاحيات وفريق المشروع</span>
              </button>

              {/* Isolate destructive action */}
              <button
                type="button"
                id={`detail-delete-project-btn-${activeProject.id}`}
                onClick={() => setProjectToDelete(activeProject)}
                className="px-3 py-2 text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1.5 transition cursor-pointer mr-2"
                title="حذف المشروع"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف المشروع</span>
              </button>
            </div>
          </div>

          {/* Project Header Banner & Consolidated Status Tracker */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                {(() => {
                  const automated = getAutomatedCombinedStatus(activeProject, {
                    customerQuotations,
                    purchaseOrders,
                    deliveryNotes,
                    invoices,
                    projectPlans,
                  });
                  return (
                    <>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                          {activeProject.projectNumber}
                        </span>

                        {/* Automated Combined Status Tracker Pill: [فزت فيه (مشروع فائز) | جزئي (65%)] */}
                        <div
                          className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-full px-3 py-1 text-xs font-bold shadow-2xs"
                          title="حالة الترسية ونسبة الإنجاز مربوطة آلياً بدورة حياة المشروع والمحطات المنجزة"
                        >
                          <span className={`flex items-center gap-1.5 ${automated.awardConfig.badgeClass} px-2.5 py-0.5 rounded-full text-xs font-bold shadow-2xs`}>
                            {automated.awardOutcome === 'Won' && <Trophy className="w-3.5 h-3.5" />}
                            {automated.awardOutcome === 'Under Pricing' && <Clock className="w-3.5 h-3.5" />}
                            {automated.awardOutcome === 'Lost' && <XCircle className="w-3.5 h-3.5" />}
                            <span>{automated.awardConfig.labelAr}</span>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${automated.executionBadgeClass}`}>
                            {automated.executionSubLabel}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>أتمتة برمجية نشطة</span>
                        </span>
                      </div>

                      <h1 className="text-xl font-bold text-slate-900 mt-2">
                        {activeProject.name}
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Client: <span className="font-semibold text-slate-700">{activeProject.customerName}</span> | Location: {activeProject.location}
                      </p>

                      {/* Optional Tender Closure to competitor / cancellation declaration */}
                      {automated.awardOutcome !== 'Won' && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLossModalProject(activeProject)}
                            className="text-xs font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 transition cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>إغلاق الترسية لصالح طرف آخر أو إلغاء المناقصة (تسجيل خسارة)</span>
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Financial KPI Cards vs Site Engineer Execution KPI Cards */}
              {!canSeeFinancials ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 w-full lg:w-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-bold">الإنجاز الميداني</span>
                    <span className="text-base font-black font-mono text-[#007A5A]">
                      {activeProject.completionPercentage || 0}%
                    </span>
                    <span className="text-[9px] text-slate-500 block">نسبة الإنجاز الفعلي</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-bold">سندات التسليم (DN)</span>
                    <span className="text-base font-bold font-mono text-blue-700">
                      {(deliveryNotes || []).filter((dn) => dn.projectId === activeProject.id).length}
                    </span>
                    <span className="text-[9px] text-slate-500 block">سندات صادرة للموقع</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-bold">حالة التنفيذ</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 inline-block mt-0.5">
                      {activeProject.executionStatus || 'قيد التنفيذ'}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">المرحلة الميدانية</span>
                  </div>

                  <div className="text-right bg-white p-2 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-slate-500 block font-bold">الوثائق والمخططات</span>
                    <span className="text-base font-bold font-mono text-slate-800">
                      {(activeProject.documents || []).length}
                    </span>
                    <span className="text-[9px] text-slate-400 block">مخطط ومستند معتمد</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 w-full lg:w-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-bold">قيمة العقد</span>
                    <span className="text-base font-bold font-mono text-[#007A5A]">
                      {currentRevenueExVat.toLocaleString()} <span className="text-[10px]">SAR</span>
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      شامل الضريبة / صافي بدون ضريبة
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-bold">تكاليف التوريد (PO)</span>
                    <span className="text-base font-bold font-mono text-blue-700">
                      {(financialAudit?.totalPoCommittedExVat || totalPOCommitted).toLocaleString()} <span className="text-[10px]">SAR</span>
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      شامل الضريبة 15%
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-bold">التكاليف الفعلية</span>
                    <span className="text-base font-bold font-mono text-slate-900">
                      {totalActualCost.toLocaleString()} <span className="text-[10px]">SAR</span>
                    </span>
                    <span className="text-[9px] text-slate-400 block">المصروفات المسجلة</span>
                  </div>

                  <div className="text-right bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block font-bold">هامش الربح</span>
                    <span
                      className={`text-base font-black font-mono ${
                        currentActualMargin >= 20 ? 'text-emerald-600' : currentActualMargin > 0 ? 'text-blue-600' : 'text-rose-600'
                      }`}
                    >
                      {currentActualMargin.toFixed(1)}%
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      صافي: {currentActualProfit.toLocaleString()} SAR
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Harmonized Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setProjectSubTab('overview')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
                projectSubTab === 'overview'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>نظرة عامة والتكاليف والتسعيرات</span>
            </button>

            <button
              type="button"
              onClick={() => setProjectSubTab('documents')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
                projectSubTab === 'documents'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-blue-500" />
              <span>مستودع الوثائق والمخططات السحابية (Drive Documents)</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                {(activeProject.documents || []).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProjectSubTab('invoices')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
                projectSubTab === 'invoices'
                  ? 'bg-[#007A5A] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>الفواتير الضريبية وسندات التسليم (Invoices & Delivery)</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono font-bold">
                {(invoices || []).filter((inv) => inv.projectId === activeProject.id).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProjectSubTab('plan')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer h-10 ${
                projectSubTab === 'plan'
                  ? 'bg-[#007A5A] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>تخطيط وجدولة المشروع (Project Plan & WBS)</span>
            </button>
          </div>

          {projectSubTab === 'documents' ? (
            <ProjectDocumentsTab
              project={activeProject}
              supplierQuotations={supplierQuotations.filter((sq) => sq.projectId === activeProject.id)}
              onUpdateProjectDocuments={onUpdateProjectDocuments}
              onUpdateMasterDriveUrl={onUpdateMasterDriveUrl}
              onViewSupplierQuote={(sq) => setViewingSupplierQuote(sq)}
              onOpenUploadSupplierModal={onOpenUploadSupplierModal}
            />
          ) : projectSubTab === 'invoices' ? (
            <ProjectInvoicesTab
              project={activeProject}
              quotation={primaryQuote}
              purchaseOrders={linkedPurchaseOrders}
              invoices={(invoices || []).filter((inv) => inv.projectId === activeProject.id)}
              deliveryNotes={(deliveryNotes || []).filter((dn) => dn.projectId === activeProject.id)}
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
          ) : projectSubTab === 'plan' ? (
            <ProjectPlanTab
              project={activeProject}
              projectPlan={projectPlans[activeProject.id]}
              onUpdateProjectPlan={handleUpdateProjectPlan}
            />
          ) : (
            <ProjectOverviewTab
              project={activeProject}
              quotations={customerQuotations}
              supplierQuotations={supplierQuotations}
              purchaseOrders={purchaseOrders}
              deliveryNotes={deliveryNotes}
              invoices={invoices}
              currentUser={currentUser}
              onSelectQuotation={onSelectQuotation}
              onOpenUploadClientContractModal={() => setShowClientContractModal(true)}
              onOpenPrepareQuoteModal={(sqId) => {
                setPreselectedSupplierQuoteId(sqId);
                setShowPrepareQuoteModal(true);
              }}
              onViewSupplierQuote={(sq) => setViewingSupplierQuote(sq)}
              onDeleteSupplierQuote={onDeleteSupplierQuotation ? (sq) => setSupplierQuoteToDelete(sq) : undefined}
              onOpenNewPOModal={(pId, sqId) => onOpenNewPOModal?.(pId, sqId)}
              onGenerateProjectPOs={onGenerateProjectPOs}
              onSelectPO={onSelectPO}
              onViewDN={(dn) => setViewingDN(dn)}
              onCreateDNFromPOs={() => setShowCreateDNModal(true)}
              onConvertDNToInvoice={(dn) => {
                setInvoicePrefillDNIds([dn.id]);
                setShowCreateProjectInvoiceModal(true);
              }}
              onOpenAddCostModal={() => setShowAddCostModal(true)}
              onOpenAdvanceModal={() => {
                setModalTargetProject(activeProject);
                setShowAdvancePaymentModal(true);
              }}
              onOpenRetentionModal={() => {
                setModalTargetProject(activeProject);
                setShowCustomerSOAModal(true);
              }}
            />
          )}
      </div>
    ) : null}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                إنشاء مشروع جديد (New Project)
              </h3>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  اسم المشروع (Project Name)
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Al-Khobar Warehouse Fire Protection"
                  className="w-full p-2 border border-slate-300 rounded focus:border-[#007A5A] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  الموقع (Project Location)
                </label>
                <input
                  type="text"
                  value={newProjectLocation}
                  onChange={(e) => setNewProjectLocation(e.target.value)}
                  placeholder="e.g. Al-Khobar / Dammam / Dahran"
                  className="w-full p-2 border border-slate-300 rounded outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    اسم العميل (Client)
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Advanced Contracting Co."
                    className="w-full p-2 border border-slate-300 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    المسؤول (Attn)
                  </label>
                  <input
                    type="text"
                    value={newAttnName}
                    onChange={(e) => setNewAttnName(e.target.value)}
                    placeholder="e.g. Eng. Fahad Al-Otaibi"
                    className="w-full p-2 border border-slate-300 rounded outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  الأنظمة المطلوبة (Required Systems)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SYSTEM_DEFINITIONS.map((sys) => {
                    const checked = newSystems.includes(sys.id);
                    return (
                      <label
                        key={sys.id}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${
                          checked ? 'bg-emerald-50 border-[#007A5A]' : 'border-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSystems([...newSystems, sys.id]);
                            } else {
                              setNewSystems(newSystems.filter((s) => s !== sys.id));
                            }
                          }}
                          className="accent-[#007A5A]"
                        />
                        <span className="text-[11px] font-medium">{sys.nameEn}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Project Initial Status Automated Banner */}
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-900 block">حالة الترسية الابتدائية: قيد التسعير (Under Pricing)</span>
                    <span className="text-[11px] text-amber-700">تُفعل تلقائياً عند إنشاء المشروع، وتتحول آلياً إلى "فزت فيه" فور رفع أمر الشراء (PO) أو اعتماد العقد.</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-200/70 text-amber-900 text-[10px] font-bold border border-amber-300 shrink-0">
                  أتمتة برمجية
                </span>
              </div>

              {newProjectStatus === 'Lost' && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-1.5 animate-in fade-in">
                  <label className="block text-[11px] font-bold text-rose-900">
                    سبب خسارة المشروع (Reason for Loss) *
                  </label>
                  <textarea
                    rows={2}
                    value={newProjectLossReason}
                    onChange={(e) => setNewProjectLossReason(e.target.value)}
                    placeholder="مثال: فارق في السعر مع المنافس بنسبة 5%، تفضيل المقاول العام لمورد آخر..."
                    className="w-full p-2 text-xs border border-rose-300 rounded-lg outline-none bg-white focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewProjectModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateNewProject}
                className="px-5 py-2 text-xs font-bold bg-[#007A5A] text-white rounded hover:bg-[#0c6b4f]"
              >
                إنشاء المشروع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Cost Modal */}
      {showAddCostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              تسجيل تكلفة أو مصروف فعلي (Log Incurred Expense)
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  تصنيف التكلفة (Category)
                </label>
                <select
                  value={costCategory}
                  onChange={(e) =>
                    setCostCategory(e.target.value as CostRecord['category'])
                  }
                  className="w-full p-2 border border-slate-300 rounded outline-none"
                >
                  <option value="materials">Materials & Equipment (مواد ومعدات)</option>
                  <option value="labor">Installation Labor (أجور تركيب وعمالة)</option>
                  <option value="transportation">Transportation (شحن ونقل)</option>
                  <option value="testing">Testing & Commissioning (فحص وتشغيل)</option>
                  <option value="subcontractor">Subcontractor (مقاول باطن)</option>
                  <option value="engineering">Engineering Supervision (إشراف هندسي)</option>
                  <option value="other">Other Direct Expense (أخرى)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  المبلغ (Amount in SAR)
                </label>
                <input
                  type="number"
                  value={costAmount || ''}
                  onChange={(e) => setCostAmount(Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full p-2 border border-slate-300 rounded font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  الوصف والبيان (Description)
                </label>
                <input
                  type="text"
                  value={costDescription}
                  onChange={(e) => setCostDescription(e.target.value)}
                  placeholder="e.g. Pipe fittings & hanger brackets delivered"
                  className="w-full p-2 border border-slate-300 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  رقم الفاتورة / سند الصرف (Invoice #)
                </label>
                <input
                  type="text"
                  value={costInvoiceNumber}
                  onChange={(e) => setCostInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-8834"
                  className="w-full p-2 border border-slate-300 rounded font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCostModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddCost}
                className="px-4 py-2 text-xs font-bold bg-[#007A5A] text-white rounded hover:bg-[#0c6b4f] cursor-pointer"
              >
                تسجيل التكلفة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prepare Customer Quotation Modal */}
      {showPrepareQuoteModal && activeProject && (
        <PrepareCustomerQuotationModal
          isOpen={showPrepareQuoteModal}
          onClose={() => setShowPrepareQuoteModal(false)}
          project={activeProject}
          supplierQuotations={supplierQuotations}
          existingQuotations={customerQuotations}
          termsLibrary={termsLibrary}
          initialSupplierQuoteId={preselectedSupplierQuoteId}
          initialSupplierQuoteIds={preselectedSupplierQuoteIds}
          onQuotationIssued={(newQuote) => {
            if (onIssueCustomerQuotation) {
              onIssueCustomerQuotation(newQuote);
            }
            setShowPrepareQuoteModal(false);
            onSelectQuotation(newQuote.id);
          }}
        />
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div
          id="delete-project-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تأكيد حذف المشروع
                </h3>
                <p className="text-xs text-slate-500">Delete Project Confirmation</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">اسم المشروع:</span>
                <span className="font-bold text-slate-900">{projectToDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">رقم المشروع:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {projectToDelete.projectNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">العميل:</span>
                <span className="text-slate-800">{projectToDelete.customerName}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذا المشروع؟ سيتم إزالة المشروع وإلغاء كافة عروض الأسعار وأوامر الشراء والتكاليف والمبالغ المرتبطة به في كافة صفحات المنظومة، مع الاحتفاظ ببيانات العميل في قائمة العملاء.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="cancel-delete-project-btn"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                إلغاء (Cancel)
              </button>
              <button
                type="button"
                id="confirm-delete-project-btn"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف والإلغاء الشامل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loss Reason Modal */}
      {lossModalProject && (
        <ProjectLossReasonModal
          isOpen={!!lossModalProject}
          project={lossModalProject}
          onClose={() => setLossModalProject(null)}
          onSave={(projId, reason) => {
            onUpdateProjectStatus?.(projId, 'Lost', reason);
            setLossModalProject(null);
          }}
        />
      )}

      {/* Customer Statement of Account (SOA) & Payment Tracking Modal */}
      {showCustomerSOAModal && (modalTargetProject || activeProject) && (
        <ProjectCustomerSOAModal
          isOpen={showCustomerSOAModal}
          onClose={() => {
            setShowCustomerSOAModal(false);
            setModalTargetProject(null);
          }}
          project={modalTargetProject || activeProject!}
          quotations={customerQuotations}
          invoices={invoices}
          onUpdateAdvancePayment={(...args: any[]) => {
            const targetP = modalTargetProject || activeProject!;
            if (typeof args[0] === 'string') {
              onUpdateAdvancePayment?.(args[0], args[1], args[2], args[3]);
            } else {
              onUpdateAdvancePayment?.(targetP.id, args[0], args[1], args[2]);
            }
          }}
          onUpdateRetention={(...args: any[]) => {
            const targetP = modalTargetProject || activeProject!;
            if (!targetP) return;
            if (typeof args[0] === 'string' && (args[0] === targetP.id || args.length >= 4)) {
              // Called as (projectId, percent, amount, status)
              const safeP = getSafeRetentionPercent(args[1], 10);
              const safeAmt = typeof args[2] === 'number' ? args[2] : parseFloat(String(args[2])) || undefined;
              onUpdateRetention?.(args[0], safeP, safeAmt, args[3]);
            } else {
              // Called as (percent, amount, status)
              const safeP = getSafeRetentionPercent(args[0], 10);
              const safeAmt = typeof args[1] === 'number' ? args[1] : parseFloat(String(args[1])) || undefined;
              onUpdateRetention?.(targetP.id, safeP, safeAmt, args[2]);
            }
          }}
          onRecordInvoicePayment={onRecordPayment}
        />
      )}

      {/* Register Advance Payment Modal Dialog */}
      {showAdvancePaymentModal && (modalTargetProject || activeProject) && (
        <RegisterAdvancePaymentModal
          isOpen={showAdvancePaymentModal}
          onClose={() => {
            setShowAdvancePaymentModal(false);
            setModalTargetProject(null);
          }}
          project={modalTargetProject || activeProject!}
          contractValue={
            customerQuotations.find((q) => q.projectId === (modalTargetProject || activeProject!).id)?.totalAmount ||
            (modalTargetProject || activeProject!).contractValue ||
            (modalTargetProject || activeProject!).budget ||
            0
          }
          onSaveAdvancePayment={(projId, data) => {
            onUpdateAdvancePayment?.(projId, data);
            setShowAdvancePaymentModal(false);
            setModalTargetProject(null);
          }}
        />
      )}

      {/* Project Final Execution & Handover Report Modal */}
      {showExecutionReportModal && (modalTargetProject || activeProject) && (
        <ProjectExecutionFinalReportModal
          isOpen={showExecutionReportModal}
          onClose={() => {
            setShowExecutionReportModal(false);
            setModalTargetProject(null);
          }}
          project={modalTargetProject || activeProject!}
          quotations={customerQuotations}
          supplierQuotations={supplierQuotations}
          purchaseOrders={purchaseOrders}
          invoices={invoices}
          deliveryNotes={deliveryNotes}
          onUpdateExecutionStatus={(arg1, arg2, arg3) => {
            const targetP = modalTargetProject || activeProject!;
            if (arg1 === targetP?.id) {
              onUpdateProjectExecutionStatus?.(targetP.id, arg2 as any, arg3);
            } else {
              onUpdateProjectExecutionStatus?.(targetP.id, arg1 as any, arg2 as any);
            }
          }}
        />
      )}

      {/* Supplier Quotation Detail & Margin/Pricing Tuner Modal */}
      {viewingSupplierQuote && (
        <SupplierQuoteDetailModal
          isOpen={!!viewingSupplierQuote}
          onClose={() => setViewingSupplierQuote(null)}
          supplierQuote={viewingSupplierQuote}
          project={activeProject}
          onSaveQuoteItems={onUpdateSupplierQuoteItems}
          onConvertToCustomerQuote={(sqId, tunedItems) => {
            setPreselectedSupplierQuoteId(sqId);
            setShowPrepareQuoteModal(true);
          }}
          onDeleteSupplierQuote={(sqId) => {
            if (onDeleteSupplierQuotation) {
              onDeleteSupplierQuotation(sqId);
            }
            setViewingSupplierQuote(null);
          }}
        />
      )}

      {/* Client Contract / PO Upload & Extraction Modal */}
      {showClientContractModal && activeProject && (
        <ClientContractPOModal
          isOpen={true}
          project={activeProject}
          quotation={primaryQuote}
          onClose={() => setShowClientContractModal(false)}
          onSaveContractPO={(projId, contractPO) => {
            if (onSaveClientContractPO) {
              onSaveClientContractPO(projId, contractPO);
            }
            setShowClientContractModal(false);
          }}
        />
      )}

      {/* Delete Supplier Quotation Confirmation Modal */}
      {supplierQuoteToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تأكيد حذف تسعيرة المورد
                </h3>
                <p className="text-xs text-slate-500">Delete Supplier Quotation</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">اسم المورد:</span>
                <span className="font-bold text-slate-900">{supplierQuoteToDelete.supplierName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">رقم التسعيرة:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {supplierQuoteToDelete.quotationNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">إجمالي المبلغ:</span>
                <span className="font-mono font-bold text-[#007A5A]">
                  {supplierQuoteToDelete.totalAmount.toLocaleString()} SAR
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف تسعيرة المورد هذه؟ سيتم فك ارتباطها عن المشروع وحفظ كافة أصنافه المسعرة تلقائياً في صفحة "الأصناف المسعرة" داخل أوامر الشراء.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSupplierQuoteToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                تراجع (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSupplierQuotation) {
                    onDeleteSupplierQuotation(supplierQuoteToDelete.id);
                  }
                  setSupplierQuoteToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>نعم، حذف التسعيرة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relational Flow & Lineage Modal */}
      {showRelationalFlowModal && activeProject && (
        <RelationalFlowModal
          isOpen={showRelationalFlowModal}
          project={activeProject}
          purchaseOrders={purchaseOrders || []}
          deliveryNotes={deliveryNotes || []}
          invoices={invoices || []}
          customerQuotations={customerQuotations || []}
          onClose={() => setShowRelationalFlowModal(false)}
          onViewPO={(po) => {
            setShowRelationalFlowModal(false);
            if (onSelectPO) onSelectPO(po.id);
          }}
        />
      )}

      {showProjectPermissionsModal && activeProject && currentUser && (
        <ProjectPermissionsModal
          isOpen={showProjectPermissionsModal}
          onClose={() => setShowProjectPermissionsModal(false)}
          projectId={activeProject.id}
          projectName={activeProject.name}
          currentUser={currentUser}
        />
      )}

      {/* View Delivery Note Document Modal */}
      {viewingDN && (
        <DeliveryNotePrintModal
          isOpen={!!viewingDN}
          deliveryNote={viewingDN}
          onClose={() => setViewingDN(null)}
          onUpdateDeliveryNote={onUpdateDeliveryNote}
          onDeleteDeliveryNote={onDeleteDeliveryNote}
          onOpenInvoiceForDN={(dn) => {
            setViewingDN(null);
            setInvoicePrefillDNIds([dn.id]);
            setShowCreateProjectInvoiceModal(true);
          }}
        />
      )}

      {/* Create Delivery Note Modal */}
      {showCreateDNModal && activeProject && onCreateDeliveryNote && (
        <CreateDeliveryNoteModal
          project={activeProject}
          allProjects={projects}
          activeQuotation={primaryQuote}
          existingDeliveryNotes={deliveryNotes || []}
          onClose={() => setShowCreateDNModal(false)}
          onSaveDeliveryNote={(dn) => {
            onCreateDeliveryNote(dn);
            setShowCreateDNModal(false);
          }}
        />
      )}

      {/* Create Project Invoice from DN Modal */}
      {showCreateProjectInvoiceModal && activeProject && onCreateInvoice && (
        <CreateProjectInvoiceModal
          project={activeProject}
          activeQuotation={primaryQuote}
          deliveryNotes={deliveryNotes || []}
          existingInvoices={invoices || []}
          purchaseOrders={purchaseOrders || []}
          initialSelectedDeliveryNoteIds={invoicePrefillDNIds}
          onClose={() => {
            setShowCreateProjectInvoiceModal(false);
            setInvoicePrefillDNIds([]);
          }}
          onSaveInvoice={(inv) => {
            onCreateInvoice(inv);
            setShowCreateProjectInvoiceModal(false);
            setInvoicePrefillDNIds([]);
          }}
        />
      )}
    </div>
  );
};
