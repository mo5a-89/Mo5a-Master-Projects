import { Project, SystemDiscipline, QuotationItem, Invoice } from '../types';

export interface EVMMetrics {
  bac: number; // Budget at Completion (Total Planned Contract Value)
  pv: number;  // Planned Value
  ev: number;  // Earned Value
  ac: number;  // Actual Cost
  cv: number;  // Cost Variance (EV - AC)
  sv: number;  // Schedule Variance (EV - PV)
  cpi: number; // Cost Performance Index (EV / AC)
  spi: number; // Schedule Performance Index (EV / PV)
  eac: number; // Estimate at Completion (BAC / CPI)
  etc: number; // Estimate to Complete (EAC - AC)
  vac: number; // Variance at Completion (BAC - EAC)
  tcpi: number; // To-Complete Performance Index
  isCostOverrun: boolean;
  isBehindSchedule: boolean;
  healthStatus: 'excellent' | 'good' | 'warning' | 'critical';
  healthLabelAr: string;
}

export interface DisciplineCostCenter {
  discipline: SystemDiscipline;
  titleAr: string;
  titleEn: string;
  badgeColor: string;
  allocatedBudget: number; // الميزانية المعتمدة
  actualCost: number;     // التكلفة الفعلية المنفذة
  billedAmount: number;   // المستخلصات المفوترة للعميل
  grossProfit: number;    // صافي الربح المحقق
  marginPercent: number;  // نسبة هامش الربح
  completionPercent: number; // نسبة إنجاز النظام
  itemsCount: number;
}

export interface RetentionDLPSchedule {
  projectId: string;
  projectName: string;
  clientName: string;
  contractValue: number;
  retentionPercent: number; // 5% or 10%
  totalRetentionAmount: number; // المبلغ المحتجز
  retentionAccumulatedSoFar: number; // المحتجز حتى آخر مستخلص
  advancePaymentTotal: number; // إجمالي الدفعة المقدمة
  advancePaymentAmortized: number; // المستهلك من الدفعة المقدمة
  advancePaymentRemaining: number; // المتبقي من الدفعة المقدمة
  handoverDate: string; // تاريخ التسليم الابتدائي (TOC)
  dlpDurationMonths: number; // مدة الضمان والصيانة (12 أو 24 شهراً)
  dlpExpirationDate: string; // تاريخ انتهاء فترة الضمان والاستحقاق النهائي للمحتجز
  daysUntilDlpRelease: number;
  releaseStatus: 'accumulating' | 'active_dlp' | 'ready_for_release' | 'released';
  statusLabelAr: string;
}

/**
 * Calculate EVM metrics for a single project or multi-project portfolio
 */
export function calculateProjectEVM(project: Project): EVMMetrics {
  const pAny = project as any;
  const bac = Number(project.contractValue) || 0;
  const completionFraction = Math.min(100, Math.max(0, Number(project.completionPercentage) || 0)) / 100;
  
  // Planned Value based on timeline or project phase
  const pv = bac * (pAny.plannedProgressPercent ? pAny.plannedProgressPercent / 100 : Math.min(1, completionFraction * 1.05));
  
  // Earned Value = BAC * Actual % Complete
  const ev = bac * completionFraction;
  
  // Actual Cost = project direct expenses or fallback based on margin
  const ac = Number(pAny.totalExpenses) > 0 
    ? Number(pAny.totalExpenses) 
    : ev * 0.78; // Default 78% cost ratio if untracked

  const cv = ev - ac;
  const sv = ev - pv;
  const cpi = ac > 0 ? Math.round((ev / ac) * 100) / 100 : 1.0;
  const spi = pv > 0 ? Math.round((ev / pv) * 100) / 100 : 1.0;
  
  const eac = cpi > 0 ? Math.round(bac / cpi) : bac;
  const etc = Math.max(0, eac - ac);
  const vac = bac - eac;

  const remainingWork = bac - ev;
  const remainingBudget = bac - ac;
  const tcpi = remainingBudget > 0 ? Math.round((remainingWork / remainingBudget) * 100) / 100 : 1.0;

  const isCostOverrun = cpi < 0.95;
  const isBehindSchedule = spi < 0.95;

  let healthStatus: EVMMetrics['healthStatus'] = 'excellent';
  let healthLabelAr = 'أداء مالي وزمني استثنائي (تحت الميزانية ومتقدم)';

  if (cpi < 0.85 || spi < 0.85) {
    healthStatus = 'critical';
    healthLabelAr = 'حرج: انحراف حاد في التكاليف والجدول الزمني';
  } else if (isCostOverrun && isBehindSchedule) {
    healthStatus = 'warning';
    healthLabelAr = 'تحذير: تجاوز تكلفة وتأخر في الإنجاز الميداني';
  } else if (isCostOverrun) {
    healthStatus = 'warning';
    healthLabelAr = 'تجاوز في التكلفة المباشرة (CPI < 1.0)';
  } else if (isBehindSchedule) {
    healthStatus = 'warning';
    healthLabelAr = 'تأخر في الجدول الزمني (SPI < 1.0)';
  } else if (cpi >= 1.05 && spi >= 1.0) {
    healthStatus = 'excellent';
    healthLabelAr = 'ممتاز: وفورات تكلفة وانضباط زمني تام';
  } else {
    healthStatus = 'good';
    healthLabelAr = 'مطابق للتخطيط المالي والزمني المعتمد';
  }

  return {
    bac,
    pv,
    ev,
    ac,
    cv,
    sv,
    cpi,
    spi,
    eac,
    etc,
    vac,
    tcpi,
    isCostOverrun,
    isBehindSchedule,
    healthStatus,
    healthLabelAr,
  };
}

/**
 * Breakdown project costs and profitability into specific MEP Disciplines (Cost Centers)
 */
export function calculateDisciplineCostCenters(
  project: Project,
  boqItems?: QuotationItem[]
): DisciplineCostCenter[] {
  const disciplinesConfig: Array<{ id: SystemDiscipline; titleAr: string; titleEn: string; badgeColor: string; defaultShare: number }> = [
    { id: 'fire_fighting', titleAr: 'مكافحة الحريق والشبكات الرطبة (UL/FM)', titleEn: 'Fire Fighting', badgeColor: 'bg-red-500 text-white', defaultShare: 0.35 },
    { id: 'fire_alarm', titleAr: 'إنذار الحريق المعنون والتحكم المبكر', titleEn: 'Fire Alarm', badgeColor: 'bg-amber-500 text-white', defaultShare: 0.20 },
    { id: 'hvac', titleAr: 'أنظمة التكييف والتهوية والدكت (HVAC)', titleEn: 'HVAC & Duct', badgeColor: 'bg-teal-500 text-white', defaultShare: 0.20 },
    { id: 'electrical', titleAr: 'الأعمال الكهربائية واللوحات (LV)', titleEn: 'Electrical & LV', badgeColor: 'bg-indigo-500 text-white', defaultShare: 0.12 },
    { id: 'plumbing', titleAr: 'السباكة والمضخات والتغذية المائية', titleEn: 'Plumbing & Water', badgeColor: 'bg-cyan-500 text-white', defaultShare: 0.08 },
    { id: 'bms', titleAr: 'التحكم والمراقبة وإدارة المباني (BMS)', titleEn: 'BMS & Low Current', badgeColor: 'bg-emerald-500 text-white', defaultShare: 0.05 },
  ];

  const contractVal = Number(project.contractValue) || 1000000;
  const completion = Math.min(100, Math.max(0, Number(project.completionPercentage) || 0));

  // If we have actual BOQ items tagged by system
  if (boqItems && boqItems.length > 0) {
    const centersMap = new Map<SystemDiscipline, { budget: number; cost: number; count: number }>();
    
    boqItems.forEach((item) => {
      const disc = item.system || 'fire_fighting';
      const existing = centersMap.get(disc) || { budget: 0, cost: 0, count: 0 };
      existing.budget += Number(item.sellingTotalPrice) || 0;
      existing.cost += Number(item.supplierTotalPrice) || (Number(item.sellingTotalPrice) * 0.75);
      existing.count += 1;
      centersMap.set(disc, existing);
    });

    return disciplinesConfig.map((dc) => {
      const data = centersMap.get(dc.id) || {
        budget: contractVal * dc.defaultShare,
        cost: contractVal * dc.defaultShare * 0.76,
        count: 0,
      };

      const billed = data.budget * (completion / 100);
      const actualCost = data.cost * (completion / 100);
      const grossProfit = billed - actualCost;
      const marginPercent = billed > 0 ? Math.round((grossProfit / billed) * 1000) / 10 : 24.0;

      return {
        discipline: dc.id,
        titleAr: dc.titleAr,
        titleEn: dc.titleEn,
        badgeColor: dc.badgeColor,
        allocatedBudget: Math.round(data.budget),
        actualCost: Math.round(actualCost),
        billedAmount: Math.round(billed),
        grossProfit: Math.round(grossProfit),
        marginPercent,
        completionPercent: completion,
        itemsCount: data.count,
      };
    });
  }

  // Calculated model based on discipline standard distributions
  return disciplinesConfig.map((dc) => {
    const budget = Math.round(contractVal * dc.defaultShare);
    const billed = Math.round(budget * (completion / 100));
    const costRatio = dc.id === 'fire_fighting' ? 0.74 : dc.id === 'fire_alarm' ? 0.70 : 0.78;
    const actualCost = Math.round(billed * costRatio);
    const grossProfit = billed - actualCost;
    const marginPercent = billed > 0 ? Math.round((grossProfit / billed) * 1000) / 10 : 26.0;

    return {
      discipline: dc.id,
      titleAr: dc.titleAr,
      titleEn: dc.titleEn,
      badgeColor: dc.badgeColor,
      allocatedBudget: budget,
      actualCost,
      billedAmount: billed,
      grossProfit,
      marginPercent,
      completionPercent: completion,
      itemsCount: dc.id === 'fire_fighting' ? 14 : 8,
    };
  });
}

/**
 * Manage Progress Invoicing, Advance Payment Amortization & Retention linked to DLP
 */
export function calculateRetentionAndDLP(
  project: Project,
  invoices: Invoice[] = []
): RetentionDLPSchedule {
  const pAny = project as any;
  const contractValue = Number(project.contractValue) || 0;
  const retentionPercent = Number(pAny.retentionPercent) || 5; // Standard 5% or 10%
  const totalRetentionAmount = (contractValue * retentionPercent) / 100;

  // Project Invoices
  const projInvoices = invoices.filter((i) => i.projectId === project.id);
  const retentionAccumulatedSoFar = projInvoices.reduce(
    (sum, inv) => sum + (Number((inv as any).retentionAmount) || 0),
    0
  ) || (contractValue * (Number(project.completionPercentage) || 0) / 100 * retentionPercent / 100);

  const advancePaymentTotal = contractValue * (Number(pAny.advancePaymentPercent) || 10) / 100;
  const advancePaymentAmortized = projInvoices.reduce(
    (sum, inv) => sum + (Number((inv as any).advancePaymentDeduction || (inv as any).advanceDeduction) || 0),
    0
  ) || (advancePaymentTotal * (Number(project.completionPercentage) || 0) / 100);
  
  const advancePaymentRemaining = Math.max(0, advancePaymentTotal - advancePaymentAmortized);

  const handoverDate = pAny.endDate || pAny.deadline || new Date().toISOString().split('T')[0];
  const dlpDurationMonths = pAny.dlpDurationMonths || 24; // 24 months standard MEP warranty
  
  const handoverObj = new Date(handoverDate);
  const expirationObj = new Date(handoverObj);
  expirationObj.setMonth(expirationObj.getMonth() + dlpDurationMonths);
  const dlpExpirationDate = expirationObj.toISOString().split('T')[0];

  const now = new Date();
  const diffTime = expirationObj.getTime() - now.getTime();
  const daysUntilDlpRelease = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let releaseStatus: RetentionDLPSchedule['releaseStatus'] = 'accumulating';
  let statusLabelAr = 'جاري تراكم المحتجز عبر المستخلصات الشهرية';

  const comp = Number(project.completionPercentage) || 0;
  if (comp >= 100) {
    if (daysUntilDlpRelease <= 0) {
      releaseStatus = 'ready_for_release';
      statusLabelAr = 'جاهز للإفراج وصرف خطاب الضمان البنكي (انتهت فترة DLP)';
    } else {
      releaseStatus = 'active_dlp';
      statusLabelAr = `تحت فترة الضمان والصيانة (DLP) - متبقي ${daysUntilDlpRelease} يوماً`;
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    clientName: project.customerName || pAny.clientName || 'العميل المعتمد',
    contractValue,
    retentionPercent,
    totalRetentionAmount,
    retentionAccumulatedSoFar,
    advancePaymentTotal,
    advancePaymentAmortized,
    advancePaymentRemaining,
    handoverDate,
    dlpDurationMonths,
    dlpExpirationDate,
    daysUntilDlpRelease,
    releaseStatus,
    statusLabelAr,
  };
}
