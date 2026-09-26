import {
  Project,
  CustomerQuotation,
  SupplierQuotation,
  PurchaseOrder,
  DeliveryNote,
  Invoice,
  ProjectPlan,
  ProjectPlanTask,
} from '../types';

export type ProjectOutcome = 'Won' | 'Under Pricing' | 'Lost';
export type ProjectStatus = ProjectOutcome | Project['status'];

export interface ProjectStatusInfo {
  key: ProjectOutcome;
  labelAr: string;
  labelEn: string;
  shortLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  badgeClass: string;
  iconName: string;
  colorHex: string;
}

export const PROJECT_STATUS_CONFIG: Record<ProjectOutcome, ProjectStatusInfo> = {
  Won: {
    key: 'Won',
    labelAr: 'فزت فيه (مشروع فائز)',
    labelEn: 'Won Project',
    shortLabel: 'فزت فيه',
    bgClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-300',
    ringClass: 'ring-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconName: 'Trophy',
    colorHex: '#007A5A',
  },
  'Under Pricing': {
    key: 'Under Pricing',
    labelAr: 'قيد التسعير (مرحلة العروض)',
    labelEn: 'Under Pricing',
    shortLabel: 'قيد التسعير',
    bgClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
    ringClass: 'ring-amber-500',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    iconName: 'Clock',
    colorHex: '#D97706',
  },
  Lost: {
    key: 'Lost',
    labelAr: 'خسرته (مشروع خاسر)',
    labelEn: 'Lost Project',
    shortLabel: 'خسرته',
    bgClass: 'bg-red-500',
    textClass: 'text-red-700',
    borderClass: 'border-red-300',
    ringClass: 'ring-red-500',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    iconName: 'XCircle',
    colorHex: '#DC2626',
  },
};

export const STATUS_CONFIG = PROJECT_STATUS_CONFIG;

export const COMMON_LOSS_REASONS = [
  'السعر كان أعلى من المنافسين في السوق',
  'تأخر في تقديم العرض الفني/المالي المطلوب',
  'قام العميل بإلغاء أو تجميد المشروع بالكامل',
  'تفضيل العميل لماركة أو موزع محدد حصرياً',
  'عدم الاتفاق على شروط الدفع والضمانات البنكية',
  'تغيير نطاق الأعمال أو تقليص الميزانية المخصصة',
  'منافس محلي قدم شروط تسليم أسرع',
];

/**
 * Normalizes any legacy or free-text project status to one of the 3 outcomes
 */
export function getNormalizedProjectStatus(status?: string): ProjectOutcome {
  if (!status) return 'Under Pricing';
  const s = status.toLowerCase().trim();

  if (
    s === 'won' ||
    s === 'فزت فيه' ||
    s === 'awarded' ||
    s === 'in progress' ||
    s === 'in_progress' ||
    s === 'completed' ||
    s === 'approved'
  ) {
    return 'Won';
  }

  if (
    s === 'lost' ||
    s === 'خسرته' ||
    s === 'rejected' ||
    s === 'cancelled'
  ) {
    return 'Lost';
  }

  return 'Under Pricing';
}

/**
 * Project Lifecycle Context for fully automated status & progress derivation
 */
export interface ProjectLifecycleContext {
  customerQuotations?: CustomerQuotation[];
  quotations?: CustomerQuotation[];
  supplierQuotations?: SupplierQuotation[];
  purchaseOrders?: PurchaseOrder[];
  deliveryNotes?: DeliveryNote[];
  invoices?: Invoice[];
  projectPlan?: ProjectPlan;
  projectPlans?: Record<string, ProjectPlan>;
}

/**
 * 1. Automated Award Status Derivation (أتمتة حالة الترسية)
 * - 'قيد التسعير': تُفعل تلقائياً فور إنشاء المشروع وطالما أن جداول الكميات (BOQ) أو عروض الأسعار تحت الإعداد ولم تُعتمد.
 * - 'فزت فيه': تُفعل تلقائياً بمجرد رفع أمر الشراء (PO)، توقيع العقد، أو انتقال المشروع لمرحلة التجهيز والتنفيذ.
 * - 'خسرته': تُفعل تلقائياً عند إغلاق الترسية لصالح طرف آخر أو إلغاء المناقصة.
 */
export function computeAutomatedAwardStatus(
  project: Project,
  context?: ProjectLifecycleContext
): ProjectOutcome {
  // If explicitly recorded as lost or cancelled with a reason
  if (
    project.lossReason ||
    project.status === 'Lost' ||
    project.status === 'خسرته' ||
    project.status === 'rejected' ||
    project.status === 'cancelled'
  ) {
    return 'Lost';
  }

  // Check automated triggers for "Won" (فزت فيه):
  // 1. Client Contract PO uploaded or attached
  const hasClientContract = Boolean(
    project.clientContractPO &&
      (project.clientContractPO.clientPONumber ||
        project.clientContractPO.fileName ||
        (project.clientContractPO.items && project.clientContractPO.items.length > 0) ||
        project.clientContractPO.grandTotal > 0)
  );

  // 2. Approved customer quotation
  const allQuotes = context?.customerQuotations || context?.quotations || [];
  const linkedQuotes = allQuotes.filter((q) => q.projectId === project.id);
  const hasApprovedQuote = linkedQuotes.some(
    (q) =>
      (q.status as string) === 'Approved' ||
      (q.status as string) === 'won' ||
      (q.status as string) === 'Awarded'
  );

  // 3. Purchase Orders (PO) issued for the project
  const linkedPOs = (context?.purchaseOrders || []).filter((po) => po.projectId === project.id);
  const hasIssuedPOs = linkedPOs.length > 0;

  // 4. Delivery Notes (DN) created for the project
  const linkedDNs = (context?.deliveryNotes || []).filter((dn) => dn.projectId === project.id);
  const hasDeliveryNotes = linkedDNs.length > 0;

  // 5. Invoices issued for the project
  const linkedInvoices = (context?.invoices || []).filter((inv) => inv.projectId === project.id);
  const hasInvoices = linkedInvoices.length > 0;

  // 6. Advance payment recorded
  const hasAdvance = (project.advancePaymentAmount || 0) > 0;

  // 7. Execution in progress (> 0%)
  const hasExecutionStarted = (project.completionPercentage || 0) > 0;

  if (
    hasClientContract ||
    hasApprovedQuote ||
    hasIssuedPOs ||
    hasDeliveryNotes ||
    hasInvoices ||
    hasAdvance ||
    hasExecutionStarted
  ) {
    return 'Won';
  }

  // Default initial state: Under Pricing
  return 'Under Pricing';
}

/**
 * 2. Automated Execution & Completion Logic (أتمتة حالة ونسبة الإنجاز)
 * - حساب النسبة المئوية: ربط النسبة المئوية للإنجاز بمتوسط إنجاز المهام/المحطات الفعلية (Milestones & Sub-tasks Weight) تحت المشروع بدلاً من الإدخال الثابت.
 * - قيد التنفيذ: تُفعل تلقائياً إذا كانت نسبة الإنجاز أكبر من 0% وأقل من 100%.
 * - جزئي: تُفعل كحالة فرعية وتُعرض نسبتها بدقة (مثل: جزئي %65) بناءً على المنجز المعتمد في بنود العمل.
 * - تام (100%): تُفعل وتتحول الشارة تلقائياً إلى مكتمل فور اعتماد آخر بند واستلام المشروع بالكامل (Final Handover).
 */
export interface AutomatedProgressResult {
  completionPercentage: number;
  executionStatus: 'تام' | 'جزئي' | 'قيد التنفيذ';
  subLabel: string;
  shortLabel: string;
  badgeClass: string;
  isCompleted: boolean;
  isPartial: boolean;
  isNotStarted: boolean;
}

export function computeAutomatedExecutionProgress(
  project: Project,
  context?: ProjectLifecycleContext
): AutomatedProgressResult {
  // Try retrieving tasks from context or localStorage
  let tasks: ProjectPlanTask[] = [];

  if (context?.projectPlan && context.projectPlan.projectId === project.id) {
    tasks = context.projectPlan.tasks || [];
  } else if (context?.projectPlans?.[project.id]) {
    tasks = context.projectPlans[project.id].tasks || [];
  } else {
    try {
      const storedPlan = localStorage.getItem(`rmt_project_plan_${project.id}`);
      if (storedPlan) {
        const parsed = JSON.parse(storedPlan);
        if (parsed?.tasks && Array.isArray(parsed.tasks)) {
          tasks = parsed.tasks;
        }
      }
    } catch {
      // fallback
    }
  }

  let calculatedPercent = 0;

  if (tasks.length > 0) {
    // Weighted progress if weights / durations are set, otherwise simple arithmetic average
    const totalWeight = tasks.reduce(
      (sum, t) => sum + (t.durationDays && t.durationDays > 0 ? t.durationDays : 1),
      0
    );
    const weightedProgress = tasks.reduce(
      (sum, t) =>
        sum +
        (t.progressPercent || 0) * (t.durationDays && t.durationDays > 0 ? t.durationDays : 1),
      0
    );
    calculatedPercent = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  } else if (project.completionPercentage !== undefined && project.completionPercentage !== null) {
    calculatedPercent = project.completionPercentage;
  } else {
    // Check if delivery notes or invoices exist to deduce delivery ratio
    const linkedDNs = (context?.deliveryNotes || []).filter((dn) => dn.projectId === project.id);
    const linkedInvoices = (context?.invoices || []).filter((inv) => inv.projectId === project.id);

    if (project.completionDate || project.handoverNotes) {
      calculatedPercent = 100;
    } else if (linkedInvoices.some((inv) => (inv.status as string) === 'Paid')) {
      calculatedPercent = 75;
    } else if (linkedDNs.length > 0) {
      calculatedPercent = 50;
    } else if ((project.advancePaymentAmount || 0) > 0) {
      calculatedPercent = 15;
    } else {
      calculatedPercent = 0;
    }
  }

  calculatedPercent = Math.max(0, Math.min(100, calculatedPercent));

  let executionStatus: 'تام' | 'جزئي' | 'قيد التنفيذ';
  let subLabel = '';
  let shortLabel = '';
  let badgeClass = '';

  if (calculatedPercent === 100) {
    executionStatus = 'تام';
    subLabel = 'تام (100%)';
    shortLabel = 'مكتمل (100%)';
    badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (calculatedPercent > 0) {
    executionStatus = 'جزئي';
    subLabel = `جزئي (${calculatedPercent}%)`;
    shortLabel = `قيد التنفيذ (${calculatedPercent}%)`;
    badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
  } else {
    executionStatus = 'قيد التنفيذ';
    subLabel = 'لم يبدأ (0%)';
    shortLabel = 'لم يبدأ (0%)';
    badgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
  }

  return {
    completionPercentage: calculatedPercent,
    executionStatus,
    subLabel,
    shortLabel,
    badgeClass,
    isCompleted: calculatedPercent === 100,
    isPartial: calculatedPercent > 0 && calculatedPercent < 100,
    isNotStarted: calculatedPercent === 0,
  };
}

/**
 * 3. Combined Header Badge Details (تحديث شارة الملخص العلوية تلقائياً)
 * يعكس دمج الحالة العامة ونسبة الإنجاز المحسوبة ديناميكياً:
 * مثال: [فزت فيه (مشروع فائز) | جزئي (65%)]
 */
export interface CombinedProjectStatus {
  awardOutcome: ProjectOutcome;
  awardConfig: ProjectStatusInfo;
  completionPercentage: number;
  executionStatus: 'تام' | 'جزئي' | 'قيد التنفيذ';
  executionSubLabel: string;
  executionShortLabel: string;
  executionBadgeClass: string;
  combinedBadgeText: string; // e.g. "[فزت فيه (مشروع فائز) | جزئي (65%)]"
}

export function getAutomatedCombinedStatus(
  project: Project,
  context?: ProjectLifecycleContext
): CombinedProjectStatus {
  const awardOutcome = computeAutomatedAwardStatus(project, context);
  const awardConfig = PROJECT_STATUS_CONFIG[awardOutcome];
  const progressInfo = computeAutomatedExecutionProgress(project, context);

  // Formatting per requirement: [فزت فيه (مشروع فائز) | جزئي (65%)]
  const combinedBadgeText = `[${awardConfig.labelAr} | ${progressInfo.subLabel}]`;

  return {
    awardOutcome,
    awardConfig,
    completionPercentage: progressInfo.completionPercentage,
    executionStatus: progressInfo.executionStatus,
    executionSubLabel: progressInfo.subLabel,
    executionShortLabel: progressInfo.shortLabel,
    executionBadgeClass: progressInfo.badgeClass,
    combinedBadgeText,
  };
}

/**
 * Synchronizes project object with automatically computed lifecycle status & percentage
 */
export function syncProjectLifecycle(
  project: Project,
  context?: ProjectLifecycleContext
): Project {
  const combined = getAutomatedCombinedStatus(project, context);
  return {
    ...project,
    status: combined.awardOutcome,
    executionStatus: combined.executionStatus,
    completionPercentage: combined.completionPercentage,
  };
}
