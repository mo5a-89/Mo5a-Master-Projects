/**
 * Unified Financial and VAT Calculation Utilities
 * Standardizes Net Amount, VAT Amount, and Gross Amount calculations across Projects, Invoices, and POs.
 * Prevents data drift and ensures ZATCA compliance (15% VAT).
 */

export interface TaxCalculationResult {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  vatRate: number; // e.g. 0.15
}

/**
 * Calculates VAT and Gross amount given a Net Amount (Tax-Exclusive).
 */
export function calculateTaxFromNet(netAmount: number, vatRate = 0.15): TaxCalculationResult {
  const cleanNet = Number(netAmount) || 0;
  const vatAmount = cleanNet * vatRate;
  const grossAmount = cleanNet + vatAmount;
  return {
    netAmount: cleanNet,
    vatAmount,
    grossAmount,
    vatRate,
  };
}

/**
 * Calculates Net and VAT amount given a Gross Amount (Tax-Inclusive).
 */
export function calculateTaxFromGross(grossAmount: number, vatRate = 0.15): TaxCalculationResult {
  const cleanGross = Number(grossAmount) || 0;
  const netAmount = cleanGross / (1 + vatRate);
  const vatAmount = cleanGross - netAmount;
  return {
    netAmount,
    vatAmount,
    grossAmount: cleanGross,
    vatRate,
  };
}

/**
 * Formats financial breakdown for reports and UI displays.
 */
export function formatFinancialBreakdown(netAmount: number, vatAmount: number, grossAmount: number): string {
  return `الصافي: ${netAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} | الضريبة (15%): ${vatAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} | الإجمالي: ${grossAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR`;
}
