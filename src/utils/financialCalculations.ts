import { Project, CustomerQuotation, PurchaseOrder, CostRecord } from '../types';

export interface ProjectFinancialAuditSummary {
  // Revenue (Client Selling Baseline)
  clientRevenueExVat: number; // Tax-exclusive contract / quotation revenue
  clientOutputVat15: number; // 15% VAT on sales
  clientRevenueIncVat: number; // Grand total revenue

  // Committed & Incurred Costs (Supplier & Expenses)
  totalPoCommittedExVat: number; // Clean supplier PO base without VAT
  totalPoCommittedVat: number; // 15% VAT on POs
  totalPoCommittedIncVat: number; // POs grand total
  
  recordedActualExpensesExVat: number; // Additional logged expenses without VAT
  totalEffectiveCostExVat: number; // Combined total cost base (PO committed + logged expenses or planned baseline)
  
  // Profitability Metrics
  grossProfitExVat: number; // Clean net gross profit = revenueExVat - costExVat
  grossMarginPercent: number; // (grossProfit / revenueExVat) * 100
  costToRevenueRatio: number; // (costExVat / revenueExVat) * 100
  
  // ZATCA VAT Reconciliation
  netVatPayableToZatca: number; // Output VAT - Input VAT
  
  // Cost Source Breakdown
  costSource: 'committed_pos' | 'planned_quote' | 'logged_actuals';
}

/**
 * Normalizes and audits project financial metrics with strict Tax-Exclusive vs. Tax-Inclusive baseline reconciliation.
 */
export function calculateProjectFinancialAudit(
  project: Project,
  customerQuotations: CustomerQuotation[] = [],
  purchaseOrders: PurchaseOrder[] = []
): ProjectFinancialAuditSummary {
  // 1. Determine Tax-Exclusive Client Revenue
  const linkedQuotes = customerQuotations.filter((q) => q.projectId === project.id);
  const primaryQuote = linkedQuotes[0];

  let clientRevenueExVat = 0;
  if (project.clientContractPO?.contractValue && project.clientContractPO.contractValue > 0) {
    const rawVal = project.clientContractPO.contractValue;
    if (project.clientContractPO.vatAmount && project.clientContractPO.vatAmount > 0) {
      clientRevenueExVat = rawVal;
    } else if (project.clientContractPO.vatIncluded) {
      clientRevenueExVat = rawVal / 1.15;
    } else {
      clientRevenueExVat = rawVal;
    }
  } else if (project.contractValue && project.contractValue > 0) {
    clientRevenueExVat = project.contractValue;
  } else if (primaryQuote?.totals?.customerSellingPrice) {
    clientRevenueExVat = primaryQuote.totals.customerSellingPrice;
  }

  const clientOutputVat15 = clientRevenueExVat * 0.15;
  const clientRevenueIncVat = clientRevenueExVat + clientOutputVat15;

  // 2. Normalize Committed Supplier Purchase Orders
  const projectPOs = purchaseOrders.filter((po) => po.projectId === project.id && po.status !== 'Cancelled');
  
  let totalPoCommittedExVat = 0;
  let totalPoCommittedVat = 0;
  let totalPoCommittedIncVat = 0;

  projectPOs.forEach((po) => {
    // Prefer subtotal or totalAfterDiscount for tax-exclusive cost
    const exVat = po.totalAfterDiscount || po.subtotal || (po.grandTotal ? po.grandTotal / 1.15 : 0);
    const vat = po.vatAmount || (po.grandTotal ? po.grandTotal - exVat : exVat * 0.15);
    const incVat = po.grandTotal || exVat + vat;

    totalPoCommittedExVat += exVat;
    totalPoCommittedVat += vat;
    totalPoCommittedIncVat += incVat;
  });

  // 3. Logged Actual Expenses
  const actualCosts: CostRecord[] = project.incurredCosts || [];
  let recordedActualExpensesExVat = 0;
  actualCosts.forEach((ac) => {
    recordedActualExpensesExVat += ac.amount || 0;
  });

  // 4. Effective Cost Baseline
  let totalEffectiveCostExVat = 0;
  let costSource: ProjectFinancialAuditSummary['costSource'] = 'planned_quote';

  if (totalPoCommittedExVat > 0) {
    totalEffectiveCostExVat = totalPoCommittedExVat + recordedActualExpensesExVat;
    costSource = 'committed_pos';
  } else if (recordedActualExpensesExVat > 0) {
    totalEffectiveCostExVat = recordedActualExpensesExVat;
    costSource = 'logged_actuals';
  } else if (primaryQuote?.totals?.totalProjectCost) {
    totalEffectiveCostExVat = primaryQuote.totals.totalProjectCost;
    costSource = 'planned_quote';
  }

  // 5. Profitability Calculations
  const grossProfitExVat = clientRevenueExVat - totalEffectiveCostExVat;
  const grossMarginPercent = clientRevenueExVat > 0 ? (grossProfitExVat / clientRevenueExVat) * 100 : 0;
  const costToRevenueRatio = clientRevenueExVat > 0 ? (totalEffectiveCostExVat / clientRevenueExVat) * 100 : 0;
  const netVatPayableToZatca = clientOutputVat15 - totalPoCommittedVat;

  return {
    clientRevenueExVat,
    clientOutputVat15,
    clientRevenueIncVat,
    totalPoCommittedExVat,
    totalPoCommittedVat,
    totalPoCommittedIncVat,
    recordedActualExpensesExVat,
    totalEffectiveCostExVat,
    grossProfitExVat,
    grossMarginPercent,
    costToRevenueRatio,
    netVatPayableToZatca,
    costSource,
  };
}
