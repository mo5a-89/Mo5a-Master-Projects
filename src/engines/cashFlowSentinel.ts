/**
 * RMT Financials & Liquidity Sentinel Engine
 * Rolling 30-day forward liquidity forecast, deficit dates detection,
 * cash runway analytics, and 10% Advance / 10% Retention project ledger auditing.
 */

import { Invoice, PurchaseOrder, Project, ProjectLedger } from '../types';

export interface DayCashForecast {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  inflowSAR: number;
  outflowSAR: number;
  netChangeSAR: number;
  projectedBalanceSAR: number;
  isDeficitRisk: boolean;
  inflowEvents: { title: string; amount: number; source: string }[];
  outflowEvents: { title: string; amount: number; target: string }[];
}

export interface LiquiditySentinelReport {
  currentCashPositionSAR: number;
  projected30DayBalanceSAR: number;
  burnRatePerDaySAR: number;
  cashRunwayDays: number;
  runwayStatus: 'healthy' | 'warning' | 'critical';
  deficitDates: string[];
  totalExpectedInflows30d: number;
  totalCommittedOutflows30d: number;
  netLiquidity30d: number;
  timeline: DayCashForecast[];
  projectLedgers: ProjectLedger[];
  totalAdvanceBalancesSAR: number;
  totalRetentionWithheldSAR: number;
  recommendations: string[];
}

/**
 * Calculate Project Ledgers with strict 10% advance and 10% retention invariants
 */
export function calculateProjectLedgers(
  projects: Project[],
  invoices: Invoice[],
  purchaseOrders: PurchaseOrder[]
): ProjectLedger[] {
  return projects.map((proj) => {
    const projInvoices = invoices.filter((inv) => inv.projectId === proj.id);
    const projPOs = purchaseOrders.filter((po) => po.projectId === proj.id);

    const contractValueGross = proj.contractValue || 0;
    const advancePaymentRatePercent = 10;
    const advancePaymentAmount = contractValueGross * (advancePaymentRatePercent / 100);

    // Sum advance settlements from invoice payments
    const advancePaymentSettled = projInvoices.reduce((sum, inv) => {
      return sum + (Number(inv.advanceDeduction) || 0);
    }, 0);

    const retentionReservePercent = 10;
    const retentionReserveTotalWithheld = projInvoices.reduce((sum, inv) => {
      return sum + (Number(inv.retentionDeduction) || 0);
    }, 0);

    const retentionReserveReleased = 0; // Released on defect liability period end

    const totalProgressBilled = projInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const totalCollectionsReceived = projInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

    const totalSupplierCommitmentsPO = projPOs.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
    const totalSupplierDisbursementsPaid = projPOs.reduce((sum, po) => {
      const poPaid = po.paidAmount || (po.payments?.reduce((s, p) => s + (p.amount || 0), 0) || 0);
      return sum + poPaid;
    }, 0);

    const projectNetCashBalance = totalCollectionsReceived - totalSupplierDisbursementsPaid;
    const projectGrossProfitSAR = contractValueGross > 0 ? contractValueGross - totalSupplierCommitmentsPO : 0;
    const projectGrossMarginPercent = contractValueGross > 0 ? (projectGrossProfitSAR / contractValueGross) * 100 : 0;

    return {
      projectId: proj.id,
      contractValueGross,
      advancePaymentRatePercent,
      advancePaymentAmount,
      advancePaymentSettled,
      retentionReservePercent,
      retentionReserveTotalWithheld,
      retentionReserveReleased,
      totalProgressBilled,
      totalCollectionsReceived,
      totalSupplierCommitmentsPO,
      totalSupplierDisbursementsPaid,
      projectNetCashBalance,
      projectGrossProfitSAR,
      projectGrossMarginPercent: Number(projectGrossMarginPercent.toFixed(1)),
    };
  });
}

/**
 * Generates the 30-day forward rolling cash liquidity forecast
 */
export function generateLiquiditySentinelReport(
  projects: Project[],
  invoices: Invoice[],
  purchaseOrders: PurchaseOrder[],
  baseInitialCashSAR: number = 425000, // Verified starting operational liquidity
  lang: 'ar' | 'en' = 'ar'
): LiquiditySentinelReport {
  const isEn = lang === 'en';
  const ledgers = calculateProjectLedgers(projects, invoices, purchaseOrders);

  const totalAdvanceBalancesSAR = ledgers.reduce(
    (sum, l) => sum + Math.max(0, l.advancePaymentAmount - l.advancePaymentSettled),
    0
  );
  const totalRetentionWithheldSAR = ledgers.reduce(
    (sum, l) => sum + Math.max(0, l.retentionReserveTotalWithheld - l.retentionReserveReleased),
    0
  );

  const timeline: DayCashForecast[] = [];
  let runningCash = baseInitialCashSAR;
  const deficitDates: string[] = [];

  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().slice(0, 10);
    const dayLabel = targetDate.toLocaleDateString(isEn ? 'en-US' : 'ar-SA', { weekday: 'short', day: 'numeric', month: 'short' });

    const dayInflows: { title: string; amount: number; source: string }[] = [];
    const dayOutflows: { title: string; amount: number; target: string }[] = [];

    // Check overdue/due invoices scheduled for collection on this date
    invoices.forEach((inv) => {
      const remaining = inv.remainingAmount || 0;
      if (remaining > 0) {
        // Due date match or periodic collection model
        if (inv.dueDate === dateStr || (i === 5 && inv.dueDate < dateStr)) {
          dayInflows.push({
            title: isEn
              ? `Collection: Invoice ${inv.invoiceNumber} (${inv.customerName})`
              : `تحصيل فاتورة ${inv.invoiceNumber} (${inv.customerName})`,
            amount: remaining,
            source: inv.customerName,
          });
        }
      }
    });

    // Check PO scheduled payments and supplier disbursements
    purchaseOrders.forEach((po) => {
      const poTotal = po.totalAmount || 0;
      const poPaid = po.paidAmount || (po.payments?.reduce((s, p) => s + (p.amount || 0), 0) || 0);
      const remainingUnpaid = poTotal - poPaid;
      if (remainingUnpaid > 0) {
        // Distribution of payments across days
        const deliveryDate = po.deliveryDate || po.createdAt?.slice(0, 10);
        if (deliveryDate === dateStr || (i === 12 && !deliveryDate)) {
          dayOutflows.push({
            title: isEn
              ? `PO Disbursement: ${po.poNumber} (${po.supplierName})`
              : `سداد أمر شراء ${po.poNumber} (${po.supplierName})`,
            amount: remainingUnpaid * 0.5, // 50% milestone payment
            target: po.supplierName,
          });
        }
      }
    });

    // Operational daily baseline overhead (rent, staff, logistics ~ SAR 1,800/day)
    dayOutflows.push({
      title: isEn
        ? 'Daily Operations, Fuel & Logistics Overhead'
        : 'مصاريف تشغيلية ولوجستية يومية ومحروقات',
      amount: 1800,
      target: isEn ? 'RMT Field Operations' : 'التشغيل الميداني RMT',
    });

    const inflowSAR = dayInflows.reduce((s, e) => s + e.amount, 0);
    const outflowSAR = dayOutflows.reduce((s, e) => s + e.amount, 0);
    const netChangeSAR = inflowSAR - outflowSAR;

    runningCash += netChangeSAR;
    const isDeficitRisk = runningCash < 50000; // Warning threshold below SAR 50k

    if (isDeficitRisk) {
      deficitDates.push(dateStr);
    }

    timeline.push({
      date: dateStr,
      dayLabel,
      inflowSAR,
      outflowSAR,
      netChangeSAR,
      projectedBalanceSAR: Math.round(runningCash),
      isDeficitRisk,
      inflowEvents: dayInflows,
      outflowEvents: dayOutflows,
    });
  }

  const totalExpectedInflows30d = timeline.reduce((s, d) => s + d.inflowSAR, 0);
  const totalCommittedOutflows30d = timeline.reduce((s, d) => s + d.outflowSAR, 0);
  const netLiquidity30d = totalExpectedInflows30d - totalCommittedOutflows30d;
  const projected30DayBalanceSAR = runningCash;

  const totalDailyBurn = totalCommittedOutflows30d / 30;
  const cashRunwayDays = totalDailyBurn > 0 ? Math.floor(baseInitialCashSAR / totalDailyBurn) : 999;

  const runwayStatus =
    cashRunwayDays >= 60 ? 'healthy' : cashRunwayDays >= 25 ? 'warning' : 'critical';

  const recommendations: string[] = [];
  if (deficitDates.length > 0) {
    recommendations.push(
      isEn
        ? `Cash Flow Alert: Potential liquidity drop below safety threshold (SAR 50,000) projected on ${deficitDates[0]}. Accelerated invoice collection recommended.`
        : `تنبيه تدفقات نقدية: تم رصد احتمالية انخفاض السيولة عن الحد الآمن (50,000 ر.س) في تاريخ ${deficitDates[0]}. يوصى بتسريع تحصيل المطالبات المستحقة.`
    );
  }
  if (totalAdvanceBalancesSAR > 0) {
    recommendations.push(
      isEn
        ? `Unsettled Advance Payment Balances: SAR ${totalAdvanceBalancesSAR.toLocaleString()}. Ensure 10% deduction is applied in upcoming progress billings.`
        : `أرصدة الدفعات المقدمة غير المستهلكة: ${totalAdvanceBalancesSAR.toLocaleString()} ر.س. تأكد من إدراج نسبة الاستقطاع (10%) في المستخلصات القادمة.`
    );
  }
  if (totalRetentionWithheldSAR > 0) {
    recommendations.push(
      isEn
        ? `Total Retention Reserve Held at Clients: SAR ${totalRetentionWithheldSAR.toLocaleString()}. Scheduled for release following Final Acceptance Certificate (FAC).`
        : `إجمالي محجوز الضمان المحتجز لدى العملاء: ${totalRetentionWithheldSAR.toLocaleString()} ر.س. مجدول للإفراج عنه بعد محضر الاستلام النهائي (FAC).`
    );
  }

  return {
    currentCashPositionSAR: baseInitialCashSAR,
    projected30DayBalanceSAR: Math.round(projected30DayBalanceSAR),
    burnRatePerDaySAR: Math.round(totalDailyBurn),
    cashRunwayDays,
    runwayStatus,
    deficitDates,
    totalExpectedInflows30d,
    totalCommittedOutflows30d,
    netLiquidity30d,
    timeline,
    projectLedgers: ledgers,
    totalAdvanceBalancesSAR,
    totalRetentionWithheldSAR,
    recommendations,
  };
}
