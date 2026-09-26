import {
  CustomerQuotation,
  Project,
  QuotationAdditionalCosts,
  QuotationItem,
  QuotationTotals,
  SystemDiscipline,
  getSystemMeta,
} from '../types';
import { COMPANY_PROFILE } from '../data/initialData';
import { SYSTEM_INVARIANTS } from './governanceProtection';
import * as docx from 'docx';
import * as XLSX from 'xlsx';

/**
 * Snaps any monetary amount to exact quarter increments (.00, .25, .50, .75 SAR).
 * Eliminates minor fractional decimals below 25 halalas as requested.
 */
export function snapToQuarter(val: number): number {
  if (isNaN(val) || val <= 0) return 0;
  return Math.round(val * 4) / 4;
}

/**
 * Generates the next sequential quotation number.
 * e.g., RM012699 -> RM012700, RM012701, etc.
 */
export function getNextQuotationNumber(existingQuotations: CustomerQuotation[]): string {
  const currentYear = new Date().getFullYear();
  let cfg: any = { quotationPrefix: 'QT-RMT-', sequenceDigits: 4, seqQuote: 1 };
  try {
    const raw = localStorage.getItem('rmt_autoNumbering');
    if (raw) cfg = JSON.parse(raw);
  } catch {}
  let highestSeq = (cfg.seqQuote || 1) - 1;
  if (existingQuotations && existingQuotations.length > 0) {
    existingQuotations.forEach((q) => {
      const match = q.quotationNumber?.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > highestSeq) highestSeq = n;
      }
    });
  }
  const nextSeq = highestSeq + 1;
  cfg.seqQuote = nextSeq + 1;
  try {
    localStorage.setItem('rmt_autoNumbering', JSON.stringify(cfg));
  } catch {}
  const prefix = cfg.quotationPrefix || 'QT-RMT-';
  const digits = cfg.sequenceDigits || 4;
  return `${prefix}${currentYear}-${String(nextSeq).padStart(digits, '0')}`;
}

/**
 * Generates the next sequential project number.
 * e.g., PRJ-2026-0001, PRJ-2026-0002, ...
 */
export function getNextProjectNumber(existingProjects: Project[]): string {
  const currentYear = new Date().getFullYear();
  let cfg: any = { projectPrefix: 'PRJ-', sequenceDigits: 4, seqProject: 1 };
  try {
    const raw = localStorage.getItem('rmt_autoNumbering');
    if (raw) cfg = JSON.parse(raw);
  } catch {}
  let highestSeq = (cfg.seqProject || 1) - 1;
  if (existingProjects && existingProjects.length > 0) {
    existingProjects.forEach((p) => {
      const match = p.projectNumber?.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > highestSeq) highestSeq = n;
      }
    });
  }
  const nextSeq = highestSeq + 1;
  cfg.seqProject = nextSeq + 1;
  try {
    localStorage.setItem('rmt_autoNumbering', JSON.stringify(cfg));
  } catch {}
  const prefix = cfg.projectPrefix || 'PRJ-';
  const digits = cfg.sequenceDigits || 4;
  return `${prefix}${currentYear}-${String(nextSeq).padStart(digits, '0')}`;
}

export function calculateQuotationTotals(
  items: QuotationItem[],
  additionalCosts: QuotationAdditionalCosts,
  pricingMode: 'markup' | 'gross_margin' | 'fixed' | 'item_specific',
  markupPercent: number,
  targetMarginPercent: number,
  vatPercent: number = SYSTEM_INVARIANTS.DEFAULT_VAT_PERCENT,
  fixedAddedProfit?: number,
  fixedSellingPrice?: number
): { items: QuotationItem[]; totals: QuotationTotals } {
  // 1. Calculate total supplier cost
  const totalSupplierCost = (items || []).reduce(
    (sum, item) => sum + (Number(item.supplierTotalPrice) || (Number(item.quantity) || 0) * (Number(item.supplierUnitPrice) || 0) || 0),
    0
  );

  // 2. Sum of all additional project direct & indirect costs
  const totalAdditionalCosts = Object.values(additionalCosts || {}).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  // 3. Total Project Cost = Supplier Cost + Additional Costs
  const totalProjectCost = snapToQuarter(totalSupplierCost + totalAdditionalCosts);

  let customerSellingPrice = 0;

  // Compute overall target selling price based on mode
  if (pricingMode === 'fixed') {
    if (fixedAddedProfit !== undefined && fixedAddedProfit > 0) {
      customerSellingPrice = totalProjectCost + Number(fixedAddedProfit);
    } else if (fixedSellingPrice !== undefined && fixedSellingPrice > 0) {
      customerSellingPrice = Number(fixedSellingPrice);
    } else {
      customerSellingPrice = totalProjectCost * (1 + (markupPercent || 25) / 100);
    }
  } else if (pricingMode === 'markup') {
    customerSellingPrice = totalProjectCost * (1 + (markupPercent || 0) / 100);
  } else if (pricingMode === 'gross_margin') {
    const marginRatio = (targetMarginPercent || 0) / 100;
    if (marginRatio >= 0.99) {
      customerSellingPrice = totalProjectCost * 2;
    } else if (marginRatio < 0) {
      customerSellingPrice = totalProjectCost;
    } else {
      customerSellingPrice = totalProjectCost / (1 - marginRatio);
    }
  } else if (pricingMode === 'item_specific') {
    const itemsTotal = (items || []).reduce((sum, item) => {
      const itemMarkup = item.customMarkupPercent !== undefined ? item.customMarkupPercent : markupPercent;
      const itemCost = item.supplierTotalPrice || 0;
      const itemSelling = itemCost * (1 + itemMarkup / 100);
      return sum + itemSelling;
    }, 0);
    customerSellingPrice = itemsTotal + totalAdditionalCosts * (1 + (markupPercent || 0) / 100);
  } else {
    customerSellingPrice = totalProjectCost * (1 + (markupPercent || 25) / 100);
  }

  // Snap customer selling price to quarter
  customerSellingPrice = snapToQuarter(customerSellingPrice);

  // Calculate gross profit and margin %
  const grossProfit = snapToQuarter(customerSellingPrice - totalProjectCost);
  const grossMarginPercent =
    customerSellingPrice > 0 ? (grossProfit / customerSellingPrice) * 100 : 0;

  // Calculate VAT (snapped to quarter)
  const vatAmount = snapToQuarter((customerSellingPrice * (vatPercent || 15)) / 100);
  const grandTotalWithVat = snapToQuarter(customerSellingPrice + vatAmount);

  // Distribute selling prices back to individual items for clean breakdown
  const effectiveMarkupRatio =
    totalSupplierCost > 0
      ? Math.max(0, (customerSellingPrice - totalAdditionalCosts) / totalSupplierCost)
      : 1 + (markupPercent || 25) / 100;

  const updatedItems = items.map((item) => {
    let itemSellingTotal = 0;
    if (pricingMode === 'item_specific' && item.customMarkupPercent !== undefined) {
      itemSellingTotal = item.supplierTotalPrice * (1 + item.customMarkupPercent / 100);
    } else if (item.sellingUnitPrice && item.sellingUnitPrice > 0 && pricingMode === 'fixed') {
      itemSellingTotal = (Number(item.quantity) || 1) * item.sellingUnitPrice;
    } else {
      itemSellingTotal = item.supplierTotalPrice * effectiveMarkupRatio;
    }

    const qty = Number(item.quantity) || 1;
    const itemSellingUnitPrice = snapToQuarter(qty > 0 ? itemSellingTotal / qty : itemSellingTotal);
    const finalItemTotal = snapToQuarter(itemSellingUnitPrice * qty);

    return {
      ...item,
      sellingUnitPrice: itemSellingUnitPrice,
      sellingTotalPrice: finalItemTotal,
    };
  });

  return {
    items: updatedItems,
    totals: {
      totalSupplierCost: snapToQuarter(totalSupplierCost),
      totalAdditionalCosts: snapToQuarter(totalAdditionalCosts),
      totalProjectCost: snapToQuarter(totalProjectCost),
      customerSellingPrice: snapToQuarter(customerSellingPrice),
      grossProfit: snapToQuarter(grossProfit),
      grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
      vatPercent,
      vatAmount: snapToQuarter(vatAmount),
      grandTotalWithVat: snapToQuarter(grandTotalWithVat),
    },
  };
}

// Group items by system discipline
export function groupItemsBySystem(items: QuotationItem[]) {
  const groups: Record<
    string,
    {
      system: SystemDiscipline;
      items: QuotationItem[];
      totalSupplierCost: number;
      totalSellingPrice: number;
      grossProfit: number;
      grossMarginPercent: number;
    }
  > = {};

  items.forEach((item) => {
    const sys = item.system || 'other_mep';
    if (!groups[sys]) {
      groups[sys] = {
        system: sys,
        items: [],
        totalSupplierCost: 0,
        totalSellingPrice: 0,
        grossProfit: 0,
        grossMarginPercent: 0,
      };
    }
    groups[sys].items.push(item);
    groups[sys].totalSupplierCost += item.supplierTotalPrice || 0;
    groups[sys].totalSellingPrice += item.sellingTotalPrice || 0;
  });

  Object.keys(groups).forEach((key) => {
    const g = groups[key];
    g.grossProfit = g.totalSellingPrice - g.totalSupplierCost;
    g.grossMarginPercent =
      g.totalSellingPrice > 0 ? (g.grossProfit / g.totalSellingPrice) * 100 : 0;
  });

  return groups;
}

export interface GroupedSection {
  systemKey: string;
  sectionTitleEn: string;
  sectionTitleAr: string;
  items: QuotationItem[];
  subtotalSellingPrice: number;
}

/**
 * Automatically classifies a line item into its accurate engineering system discipline.
 * Takes into account declared project/quotation systems and keywords across item details.
 */
export function detectItemSystemDiscipline(
  item: Partial<QuotationItem>,
  declaredSystems?: SystemDiscipline[]
): SystemDiscipline {
  const validDeclared = (declaredSystems || []).filter(Boolean);

  // 1. If item already has a declared system that matches the project's selected systems, respect it directly
  if (item.system) {
    const currentMeta = getSystemMeta(item.system);
    // If validDeclared is provided and contains this system, use it directly
    if (validDeclared.length === 0 || validDeclared.includes(currentMeta.id)) {
      return currentMeta.id;
    }
  }

  // 2. Comprehensive text analysis across description, brand, model, notes, supplier
  const text = `${item.description || ''} ${item.manufacturer || ''} ${item.model || ''} ${item.notes || ''} ${item.sourceSupplierName || ''}`.toLowerCase();

  // HVAC & Ventilation
  if (
    text.includes('duct') || text.includes('hvac') || text.includes('chiller') ||
    text.includes('fcu') || text.includes('ahu') || text.includes('diffuser') ||
    text.includes('grille') || text.includes('damper') || text.includes('package unit') ||
    text.includes('split') || text.includes('تكييف') || text.includes('تهوية') ||
    text.includes('دكت') || text.includes('مكيف') || text.includes('exhaust fan') ||
    text.includes('compressor') || text.includes('vrf') || text.includes('vav') ||
    text.includes('air conditioning') || text.includes('air-conditioning') ||
    text.includes('ventilation') || text.includes('cooling') || text.includes('condenser')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('hvac')) return 'hvac';
  }

  // Drainage (if explicitly declared or keyword matched)
  if (
    text.includes('drain') || text.includes('صرف') || text.includes('gully') ||
    text.includes('manhole') || text.includes('sewage') || text.includes('waste pipe') ||
    text.includes('floor drain') || text.includes('cleanout') || text.includes('trap')
  ) {
    if (validDeclared.includes('drainage')) return 'drainage';
    if (validDeclared.length === 0 || validDeclared.includes('plumbing')) return 'plumbing';
    if (validDeclared.includes('drainage')) return 'drainage';
  }

  // Plumbing & Sanitary
  if (
    text.includes('plumb') || text.includes('sanitary') ||
    text.includes('pipe') || text.includes('ppr') || text.includes('upvc') ||
    text.includes('cpvc') || text.includes('valve') || text.includes('pump') ||
    text.includes('water meter') || text.includes('faucet') || text.includes('mixer') ||
    text.includes('سباك') || text.includes('محبس') || text.includes('ماسورة') ||
    text.includes('مواسير') || text.includes('مضخة مياه') || text.includes('سخان') ||
    text.includes('خزان') || text.includes('toilet') || text.includes('sink') ||
    text.includes('shower') || text.includes('basin') || text.includes('water supply')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('plumbing')) return 'plumbing';
    if (validDeclared.includes('drainage')) return 'drainage';
  }

  // Fire Fighting
  if (
    text.includes('sprinkler') || text.includes('fire pump') || text.includes('fire hose') ||
    text.includes('fm200') || text.includes('deluge') || text.includes('مكافحة') ||
    text.includes('إطفاء') || text.includes('اطفاء') || text.includes('رشاش') ||
    text.includes('صندوق حريق') || text.includes('طفاية') || text.includes('fire fighting') ||
    text.includes('extinguisher') || text.includes('firehydrant') || text.includes('hydrant')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('fire_fighting')) return 'fire_fighting';
  }

  // Fire Alarm
  if (
    text.includes('smoke detector') || text.includes('heat detector') || text.includes('fire alarm') ||
    text.includes('إنذار') || text.includes('انذار') || text.includes('لوحة إنذار') ||
    text.includes('كاشف') || text.includes('manual call point') || text.includes('break glass') ||
    text.includes('strobe') || text.includes('sounder') || text.includes('flasher')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('fire_alarm')) return 'fire_alarm';
  }

  // Electrical
  if (
    text.includes('cable') || text.includes('conduit') || text.includes('panel') ||
    text.includes('breaker') || text.includes('mccb') || text.includes('mcb') ||
    text.includes('db') || text.includes('smdb') || text.includes('switch') ||
    text.includes('socket') || text.includes('light') || text.includes('led') ||
    text.includes('luminaire') || text.includes('كهرب') || text.includes('كابل') ||
    text.includes('قاطع') || text.includes('لوحة توزيع') || text.includes('إنارة') ||
    text.includes('انارة') || text.includes('transformer') || text.includes('ups') ||
    text.includes('generator') || text.includes('busbar')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('electrical')) return 'electrical';
  }

  // PAVA
  if (
    text.includes('pava') || text.includes('speaker') || text.includes('amplifier') ||
    text.includes('microphone') || text.includes('evacuation') || text.includes('نداء') ||
    text.includes('صوت')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('pava')) return 'pava';
  }

  // CCTV
  if (
    text.includes('cctv') || text.includes('camera') || text.includes('nvr') ||
    text.includes('dvr') || text.includes('كامير') || text.includes('مراقبة') ||
    text.includes('access control')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('cctv')) return 'cctv';
  }

  // Civil
  if (
    text.includes('civil') || text.includes('concrete') || text.includes('block') ||
    text.includes('plaster') || text.includes('paint') || text.includes('tile') ||
    text.includes('إنشائ') || text.includes('مدني') || text.includes('خرسانة')
  ) {
    if (validDeclared.length === 0 || validDeclared.includes('civil')) return 'civil';
  }

  // 3. Fallback: If user specified declaredSystems, assign to the first declared system (NOT hardcoded fire_fighting!)
  if (validDeclared.length > 0) {
    return validDeclared[0];
  }

  // 4. Default if no declaredSystems
  if (item.system) {
    return getSystemMeta(item.system).id;
  }
  return 'other_mep';
}

/**
 * Groups quotation items into distinct engineering sections for clean BOQ structuring.
 */
export function getQuotationSections(quotation: CustomerQuotation): GroupedSection[] {
  const items = quotation.items || [];
  if (items.length === 0) {
    return [];
  }

  const declaredSystems: SystemDiscipline[] =
    Array.isArray(quotation.selectedSystems) && quotation.selectedSystems.length > 0
      ? quotation.selectedSystems
      : [];

  const systemMap = new Map<string, QuotationItem[]>();

  items.forEach((item) => {
    const sysDiscipline = detectItemSystemDiscipline(item, declaredSystems);
    if (!systemMap.has(sysDiscipline)) {
      systemMap.set(sysDiscipline, []);
    }
    systemMap.get(sysDiscipline)!.push({
      ...item,
      system: sysDiscipline,
    });
  });

  const sections: GroupedSection[] = [];

  // Order sections according to declaredSystems if present
  const orderedKeys: string[] = [];
  declaredSystems.forEach((ds) => {
    if (systemMap.has(ds) && !orderedKeys.includes(ds)) {
      orderedKeys.push(ds);
    }
  });

  systemMap.forEach((_, k) => {
    if (!orderedKeys.includes(k)) {
      orderedKeys.push(k);
    }
  });

  orderedKeys.forEach((sysKey) => {
    const sectionItems = systemMap.get(sysKey) || [];
    if (sectionItems.length === 0) return;

    const meta = getSystemMeta(sysKey);
    const subtotal = snapToQuarter(
      sectionItems.reduce(
        (sum, it) => sum + (it.sellingTotalPrice || (it.sellingUnitPrice * it.quantity) || 0),
        0
      )
    );

    sections.push({
      systemKey: sysKey,
      sectionTitleEn: meta.nameEn,
      sectionTitleAr: meta.nameAr,
      items: sectionItems,
      subtotalSellingPrice: subtotal,
    });
  });

  return sections;
}

// ==========================================
// EXPORT TO EXCEL (.xlsx) - PROFESSIONAL MEP FORMAT
// ==========================================
export function exportQuotationToExcel(quotation: CustomerQuotation) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Customer Commercial Proposal BOQ
  const boqData: (string | number)[][] = [
    ['مؤسسة صناع الموارد التجاريه - RESOURCE MAKERS TRADING EST.'],
    ['COMMERCIAL & TECHNICAL PROPOSAL'],
    [`C.R: ${COMPANY_PROFILE.crNumber} | VAT: ${COMPANY_PROFILE.vatNumber} | Dammam / Al Khobar, Saudi Arabia`],
    [''],
    ['Proposal #:', quotation.quotationNumber, '', 'Date:', quotation.date],
    ['Project Name:', quotation.projectName, '', 'Location:', quotation.projectLocation],
    ['Client Name:', quotation.clientName, '', 'Attn:', quotation.attnName],
    ['Scope of Work:', quotation.scopeOfWork, '', 'System Definition:', quotation.systemDefinition],
    ['Validity:', quotation.validity || '15 Days', '', 'Prepared By:', quotation.initiatedBy || COMPANY_PROFILE.engineerName],
    [''],
    ['Item #', 'Description & Specifications', 'Qty', 'Unit', 'Unit Price (SAR)', 'Total Price (SAR)'],
  ];

  quotation.items.forEach((item, idx) => {
    const specs = [
      item.description,
      item.manufacturer ? `Brand: ${item.manufacturer}` : '',
      item.model ? `Model: ${item.model}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    boqData.push([
      idx + 1,
      specs,
      item.quantity,
      item.unit || 'Pcs',
      snapToQuarter(item.sellingUnitPrice).toFixed(2),
      snapToQuarter(item.sellingTotalPrice).toFixed(2),
    ]);
  });

  boqData.push(['']);
  boqData.push(['', '', '', '', 'Subtotal Excl. VAT (SAR):', snapToQuarter(quotation.totals.customerSellingPrice).toFixed(2)]);
  boqData.push(['', '', '', '', `VAT (${quotation.totals.vatPercent}%):`, snapToQuarter(quotation.totals.vatAmount).toFixed(2)]);
  boqData.push(['', '', '', '', 'Grand Total with VAT (SAR):', snapToQuarter(quotation.totals.grandTotalWithVat).toFixed(2)]);
  boqData.push(['']);
  boqData.push(['TERMS & CONDITIONS:']);
  boqData.push(['1.1 The above Price Includes (by RM):']);
  (quotation.terms?.includes || []).forEach((inc) => boqData.push(['', `- ${inc}`]));
  boqData.push(['1.2 The above Price Excludes (by Client):']);
  (quotation.terms?.excludes || []).forEach((exc) => boqData.push(['', `- ${exc}`]));
  boqData.push(['2.0 Payment Terms:']);
  (quotation.terms?.paymentTerms || []).forEach((pt) => boqData.push(['', `- ${pt}`]));
  boqData.push(['2.1 Proposal Validity:', quotation.terms?.validity || '15 days']);
  boqData.push(['2.2 Notes & Assumptions:']);
  (quotation.terms?.notes || []).forEach((n) => boqData.push(['', `- ${n}`]));

  const wsBOQ = XLSX.utils.aoa_to_sheet(boqData);

  // Set professional column widths
  wsBOQ['!cols'] = [
    { wch: 8 },  // Item #
    { wch: 58 }, // Description
    { wch: 10 }, // Qty
    { wch: 10 }, // Unit
    { wch: 20 }, // Unit Price
    { wch: 22 }, // Total Price
  ];

  XLSX.utils.book_append_sheet(wb, wsBOQ, 'Commercial Proposal');

  // Sheet 2: Internal Cost & Profitability Analysis (Confidential)
  const costData: (string | number)[][] = [
    ['TRADE RESOURCE MAKERS - INTERNAL COST & PROFITABILITY ANALYSIS (CONFIDENTIAL)'],
    ['Proposal Ref:', quotation.quotationNumber, '', 'Project:', quotation.projectName],
    ['Client:', quotation.clientName, '', 'Date:', quotation.date],
    [''],
    ['Cost Breakdown Summary:'],
    ['Total Equipment & Supplier Cost:', snapToQuarter(quotation.totals.totalSupplierCost).toFixed(2), 'SAR'],
    ['Installation & Labor Direct Cost:', snapToQuarter(quotation.additionalCosts?.installation || 0).toFixed(2), 'SAR'],
    ['Transportation & Logistics Cost:', snapToQuarter(quotation.additionalCosts?.transportation || 0).toFixed(2), 'SAR'],
    ['Testing & Commissioning Cost:', snapToQuarter(quotation.additionalCosts?.testingAndCommissioning || 0).toFixed(2), 'SAR'],
    ['Engineering & Supervision:', snapToQuarter(quotation.additionalCosts?.engineering || 0).toFixed(2), 'SAR'],
    ['Contingency Reserve:', snapToQuarter(quotation.additionalCosts?.contingency || 0).toFixed(2), 'SAR'],
    ['Other Project Costs:', snapToQuarter(quotation.additionalCosts?.otherDirectCosts || 0).toFixed(2), 'SAR'],
    ['--------------------------------------------------'],
    ['TOTAL PROJECT COST:', snapToQuarter(quotation.totals.totalProjectCost).toFixed(2), 'SAR'],
    ['CUSTOMER SELLING PRICE (EX. VAT):', snapToQuarter(quotation.totals.customerSellingPrice).toFixed(2), 'SAR'],
    ['GROSS PROFIT:', snapToQuarter(quotation.totals.grossProfit).toFixed(2), 'SAR'],
    ['GROSS MARGIN %:', `${quotation.totals.grossMarginPercent.toFixed(2)}%`],
    [''],
    ['Item Level Cost vs. Selling Price Breakdown:'],
    ['Item #', 'Description', 'Qty', 'Unit Cost (SAR)', 'Total Cost (SAR)', 'Selling Unit (SAR)', 'Selling Total (SAR)', 'Profit (SAR)', 'Margin %'],
  ];

  quotation.items.forEach((item, idx) => {
    const cost = snapToQuarter(item.supplierTotalPrice || (item.quantity * (item.supplierUnitPrice || 0)));
    const sell = snapToQuarter(item.sellingTotalPrice);
    const profit = snapToQuarter(sell - cost);
    const margin = sell > 0 ? (profit / sell) * 100 : 0;

    costData.push([
      idx + 1,
      item.description,
      item.quantity,
      snapToQuarter(item.supplierUnitPrice).toFixed(2),
      cost.toFixed(2),
      snapToQuarter(item.sellingUnitPrice).toFixed(2),
      sell.toFixed(2),
      profit.toFixed(2),
      `${margin.toFixed(1)}%`,
    ]);
  });

  const wsCost = XLSX.utils.aoa_to_sheet(costData);
  wsCost['!cols'] = [
    { wch: 8 },  // Item #
    { wch: 45 }, // Description
    { wch: 8 },  // Qty
    { wch: 16 }, // Unit Cost
    { wch: 18 }, // Total Cost
    { wch: 18 }, // Selling Unit
    { wch: 18 }, // Selling Total
    { wch: 16 }, // Profit
    { wch: 12 }, // Margin %
  ];

  XLSX.utils.book_append_sheet(wb, wsCost, 'Cost & Margin Analysis');

  const fileName = `Proposal_${quotation.quotationNumber}_${quotation.clientName.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ==========================================
// EXPORT TO PDF / HIGH-FIDELITY PRINT DELEGATE
// ==========================================
function internalLegacyQuotationPDF(quotation: CustomerQuotation) {
  exportQuotationPrintWindow(quotation);
}

// ==========================================
// EXPORT TO WORD (.DOCX & FORMATTED WORD DOCUMENT)
// ==========================================
export async function exportQuotationToWord(quotation: CustomerQuotation) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    HeadingLevel,
  } = docx;

  const tealGreen = '007A5A';
  const navyBlue = '1E3A8A';
  const slateGray = '475569';
  const lightBg = 'F8FAFC';
  const headerBg = 'F1F5F9';
  const borderGray = 'CBD5E1';

  // Standard table border style
  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
    left: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
    right: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
  };

  // Company Official Header in Word Table
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 16, color: '00A859' }, // Solid Green Line
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'RMT',
                    bold: true,
                    size: 40,
                    color: '00A859',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' Resource Makers',
                    size: 19,
                    bold: true,
                    color: '174A84',
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Contracting & MEP Engineering Solutions',
                    size: 15,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'مؤسسة صناع الموارد التجارية (RMT)',
                    bold: true,
                    size: 21,
                    color: '174A84',
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'RESOURCE MAKERS TRADING Est.',
                    bold: true,
                    size: 17,
                    color: '00A859',
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Kingdom of Saudi Arabia, Dammam, Al Shate Al gharbi',
                    size: 14,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Phone: +966 549220606 | Email: info@rmt-sa.com',
                    size: 14,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'CR. NO. 2050167793   VAT NO. 311552664400003',
                    bold: true,
                    size: 15,
                    color: '1E293B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Proposal Meta Table (2 columns, clean borders & margins)
  const issuerName = quotation.issuerDetails?.name || quotation.initiatedBy || COMPANY_PROFILE.engineerName;
  const issuerTitle = quotation.issuerDetails?.title || COMPANY_PROFILE.engineerTitle;
  const issuerEmail = quotation.issuerDetails?.email || COMPANY_PROFILE.engineerEmail;
  const issuerPhone = quotation.issuerDetails?.phone || COMPANY_PROFILE.phone;
  const issuerMobile = quotation.issuerDetails?.mobile || COMPANY_PROFILE.mobiles?.[0] || '';

  const sections = getQuotationSections(quotation);
  const sanitizedTerms = standardizeQuotationTermsToEnglish(quotation.terms);

  const declaredSystems = (quotation.selectedSystems && quotation.selectedSystems.length > 0)
    ? quotation.selectedSystems
    : sections.map((s) => s.systemKey as SystemDiscipline);

  const systemNamesEn = declaredSystems.map((s) => getSystemMeta(s).nameEn).join(', ') || 'MEP & Specialized Engineering Systems';

  const isFireFightingHallucinated = (!declaredSystems.includes('fire_fighting')) &&
    ((quotation.systemDefinition && quotation.systemDefinition.toLowerCase().includes('fire')) ||
     (quotation.scopeOfWork && (quotation.scopeOfWork.includes('مكافحة') || quotation.scopeOfWork.toLowerCase().includes('fire'))));

  const cleanSystemDefinition = (isFireFightingHallucinated || !quotation.systemDefinition || quotation.systemDefinition.includes('مكافحة'))
    ? systemNamesEn
    : quotation.systemDefinition;

  const cleanScopeOfWork = (isFireFightingHallucinated || !quotation.scopeOfWork || quotation.scopeOfWork.startsWith('توريد'))
    ? `Supply, Installation, Testing & Commissioning of ${systemNamesEn}`
    : quotation.scopeOfWork;

  const metaRows = [
    ['Scope of Work', cleanScopeOfWork],
    ['System Definition', cleanSystemDefinition],
    ['Project Name', quotation.projectName],
    ['Project Location', quotation.projectLocation],
    ["Client's Name", quotation.clientName],
    ['Attn. Name', quotation.attnName],
    ['Proposal #', quotation.quotationNumber],
    ['Initiated By', issuerName],
    ['Date', quotation.date],
    ['Validity', sanitizedTerms.validity || quotation.validity || '15 Days'],
  ].map(
    ([label, val]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: val || '', size: 19, font: 'Calibri' })] })],
          }),
        ],
      })
  );

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: metaRows,
  });

  // Centered Contact Info Box (in table format)
  const contactTable = new Table({
    width: { size: 70, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: thinBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Name', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: issuerName, bold: true, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Position', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: issuerTitle, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'E-mail', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: issuerEmail, size: 18, color: '0284C7', font: 'Calibri' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Mob', bold: true, size: 18, font: 'Calibri' })] })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: issuerMobile || issuerPhone, size: 18, font: 'Calibri' })] })],
          }),
        ],
      }),
    ],
  });

  // BOQ Table Header
  const boqHeader = new TableRow({
    children: [
      new TableCell({
        width: { size: 6, type: WidthType.PERCENTAGE },
        shading: { fill: headerBg },
        margins: { top: 120, bottom: 120, left: 80, right: 80 },
        borders: thinBorder,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Item', bold: true, size: 18, font: 'Calibri' })] })],
      }),
      new TableCell({
        width: { size: 48, type: WidthType.PERCENTAGE },
        shading: { fill: headerBg },
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
        borders: thinBorder,
        children: [new Paragraph({ children: [new TextRun({ text: 'Description & Technical Specifications', bold: true, size: 18, font: 'Calibri' })] })],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { fill: headerBg },
        margins: { top: 120, bottom: 120, left: 60, right: 60 },
        borders: thinBorder,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Qty', bold: true, size: 18, font: 'Calibri' })] })],
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        shading: { fill: headerBg },
        margins: { top: 120, bottom: 120, left: 60, right: 60 },
        borders: thinBorder,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Unit', bold: true, size: 18, font: 'Calibri' })] })],
      }),
      new TableCell({
        width: { size: 14, type: WidthType.PERCENTAGE },
        shading: { fill: headerBg },
        margins: { top: 120, bottom: 120, left: 80, right: 80 },
        borders: thinBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'Unit Price (SAR)', bold: true, size: 18, font: 'Calibri' }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 14, type: WidthType.PERCENTAGE },
        shading: { fill: headerBg },
        margins: { top: 120, bottom: 120, left: 80, right: 80 },
        borders: thinBorder,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'Total Price (SAR)', bold: true, size: 18, font: 'Calibri' }),
            ],
          }),
        ],
      }),
    ],
  });

  const boqTableRows: any[] = [boqHeader];

  sections.forEach((sec, sIdx) => {
    // Section Header Banner Row
    boqTableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 6,
            shading: { fill: 'E2E8F0' },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            borders: thinBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Section ${sIdx + 1}: ${sec.sectionTitleEn}`,
                    bold: true,
                    size: 19,
                    color: tealGreen,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ` (${sec.sectionTitleAr})`,
                    size: 16,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    // Section Items with isolated sequential line numbering per section
    sec.items.forEach((item, itemIdx) => {
      const currentNo = itemIdx + 1;
      const descChildren: any[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: item.description,
              bold: true,
              size: 18,
              font: 'Calibri',
            }),
          ],
        }),
      ];

      if (item.manufacturer || item.model) {
        const specRuns: any[] = [];
        if (item.manufacturer) {
          specRuns.push(new TextRun({ text: `Brand: ${item.manufacturer}`, size: 15, color: slateGray, font: 'Calibri' }));
        }
        if (item.manufacturer && item.model) {
          specRuns.push(new TextRun({ text: '  |  ', size: 15, color: '94A3B8', font: 'Calibri' }));
        }
        if (item.model) {
          specRuns.push(new TextRun({ text: `Model: ${item.model}`, size: 15, color: slateGray, font: 'Calibri' }));
        }
        descChildren.push(new Paragraph({ children: specRuns }));
      }

      boqTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 90, bottom: 90, left: 60, right: 60 },
              borders: thinBorder,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(currentNo), size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              margins: { top: 90, bottom: 90, left: 100, right: 100 },
              borders: thinBorder,
              children: descChildren,
            }),
            new TableCell({
              margins: { top: 90, bottom: 90, left: 60, right: 60 },
              borders: thinBorder,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.quantity), size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              margins: { top: 90, bottom: 90, left: 60, right: 60 },
              borders: thinBorder,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.unit || 'Pcs', size: 18, font: 'Calibri' })] })],
            }),
            new TableCell({
              margins: { top: 90, bottom: 90, left: 80, right: 80 },
              borders: thinBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: snapToQuarter(item.sellingUnitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }), size: 18, font: 'Calibri' })],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 90, bottom: 90, left: 80, right: 80 },
              borders: thinBorder,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: snapToQuarter(item.sellingTotalPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }), bold: true, size: 18, font: 'Calibri' })],
                }),
              ],
            }),
          ],
        })
      );
    });

    // Section Subtotal Row
    boqTableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            shading: { fill: lightBg },
            margins: { top: 90, bottom: 90, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Subtotal - ${sec.sectionTitleEn} (SAR):`,
                    bold: true,
                    size: 18,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { fill: lightBg },
            margins: { top: 90, bottom: 90, left: 80, right: 80 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: snapToQuarter(sec.subtotalSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    bold: true,
                    size: 18,
                    color: tealGreen,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  const boqTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: boqTableRows,
  });

  // Single Consolidated Financial Summary Table (EXCLUSIVELY at the absolute end of the pricing schedule)
  const consolidatedFinancialTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: headerBg },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            borders: thinBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Executive Financial Summary & Section Breakdown', bold: true, size: 19, font: 'Calibri' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: headerBg },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'Amount (SAR)', bold: true, size: 19, font: 'Calibri' })],
              }),
            ],
          }),
        ],
      }),
      ...sections.map(
        (sec, idx) =>
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                borders: thinBorder,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Section ${idx + 1}: ${sec.sectionTitleEn}`, bold: true, size: 18, font: 'Calibri' }),
                      new TextRun({ text: ` (${sec.sectionTitleAr})`, size: 15, color: slateGray, font: 'Calibri' }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                margins: { top: 80, bottom: 80, left: 100, right: 100 },
                borders: thinBorder,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: snapToQuarter(sec.subtotalSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                        bold: true,
                        size: 18,
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
      ),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'Total Subtotal (SAR):', bold: true, size: 19, font: 'Calibri' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: snapToQuarter(quotation.totals.customerSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    bold: true,
                    size: 19,
                    color: tealGreen,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'Value Added Tax (15% VAT):', bold: true, size: 19, font: 'Calibri' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: lightBg },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: snapToQuarter(quotation.totals.vatAmount).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    bold: true,
                    size: 19,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            shading: { fill: 'E6F4EA' },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'Grand Total (SAR):', bold: true, size: 21, color: tealGreen, font: 'Calibri' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: 'E6F4EA' },
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: snapToQuarter(quotation.totals.grandTotalWithVat).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                    bold: true,
                    size: 21,
                    color: tealGreen,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Build document sections with unified cover and page flow
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
          },
        },
        children: [
          headerTable,
          new Paragraph({ text: '', spacing: { before: 180 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: 'Commercial Proposal',
                bold: true,
                size: 32,
                color: '0F172A',
                underline: {},
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 160 } }),
          metaTable,
          new Paragraph({ text: '', spacing: { before: 200 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Proposal Confidentiality:',
                bold: true,
                size: 20,
                underline: {},
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: 'THIS DOCUMENT CONTAINS TRADE RESOURCE MAKERS - RESOURCE MAKERS TRADING EST. (مؤسسة صناع الموارد التجاريه) CONFIDENTIAL AND PROPRIETARY INFORMATION AND IS SUPPLIED TO ALLOW THE CLIENT/CONCERNED PARTIES TO MAKE AN EVALUATION OF RESOURCE MAKERS AS A CANDIDATE FOR THE DELIVERY OF PREVIOUSLY MENTIONED SERVICES. THIS DOCUMENT (INCLUDING ANY PART THEREOF) IS NOT TO BE DISCLOSED OR REPRODUCED OR DISTRIBUTED IN ANY FORM OR BY ANY MEANS, OR STORED IN A DATABASE OR RETRIEVAL SYSTEM, OR TRANSFERRED OUTSIDE YOUR ORGANIZATION WITHOUT PRIOR WRITTEN CONSENT FROM THE AUTHORIZED REPRESENTATIVE AT RESOURCE MAKERS C.',
                size: 15,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: '© ALL RIGHTS RESERVED TO TRADE RESOURCE MAKERS – AL KHOBAR / SAUDI ARABIA',
                bold: true,
                size: 15,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 200 } }),
          // Centered Engineer Contact Table
          contactTable,

          // Pricing & BOQ Section (flows smoothly without artificial gap)
          new Paragraph({ text: '', spacing: { before: 300 } }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: '1.0 Total System Price:', bold: true, size: 26, font: 'Calibri' })],
          }),
          new Paragraph({
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({ text: `Dear ${quotation.attnName || quotation.clientName || 'Valued Client'},\n`, bold: true, size: 20, font: 'Calibri' }),
              new TextRun({
                text: `Thank you for reaching out with your inquiry. Referring to your request for the ${cleanScopeOfWork} at the project located in ${quotation.projectLocation}, we are pleased to provide you with our quotation. It includes our best pricing, terms, and all required details as listed below.`,
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          boqTable,
          new Paragraph({ text: '', spacing: { before: 200 } }),
          consolidatedFinancialTable,

          // Terms & Conditions
          new Paragraph({ text: '', spacing: { before: 300 } }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Terms & Conditions:', bold: true, size: 26, underline: {}, font: 'Calibri' })],
          }),
          new Paragraph({
            spacing: { before: 150 },
            children: [new TextRun({ text: '1.1 The above Price Includes (by RM):', bold: true, size: 22, font: 'Calibri' })],
          }),
          ...((sanitizedTerms.includes || []).map(
            (inc) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: inc, size: 20, font: 'Calibri' })],
              })
          )),
          new Paragraph({
            spacing: { before: 150 },
            children: [new TextRun({ text: '1.2 The above Price Excludes (by Client):', bold: true, size: 22, font: 'Calibri' })],
          }),
          ...((sanitizedTerms.excludes || []).map(
            (exc) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: exc, size: 20, font: 'Calibri' })],
              })
          )),
          new Paragraph({
            spacing: { before: 150 },
            children: [new TextRun({ text: '2.0 Payment Terms:', bold: true, size: 22, font: 'Calibri' })],
          }),
          ...((sanitizedTerms.paymentTerms || []).map(
            (pt) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: pt, size: 20, font: 'Calibri' })],
              })
          )),
          new Paragraph({
            spacing: { before: 150 },
            children: [new TextRun({ text: '2.1 Proposal Validity:', bold: true, size: 22, font: 'Calibri' })],
          }),
          new Paragraph({
            children: [new TextRun({ text: sanitizedTerms.validity || '15 days from issuance date', size: 20, font: 'Calibri' })],
          }),
          new Paragraph({
            spacing: { before: 150 },
            children: [new TextRun({ text: '2.2 Notes & Assumptions:', bold: true, size: 22, font: 'Calibri' })],
          }),
          ...((sanitizedTerms.notes || []).map(
            (n) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: n, size: 20, font: 'Calibri' })],
              })
          )),
          new Paragraph({
            spacing: { before: 300 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Please don't hesitate to contact us for any clarification.\nBest Regards,\nTrade Resource Makers",
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Proposal_${quotation.quotationNumber}_${quotation.clientName.replace(/\s+/g, '_')}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Dictionary to convert common Arabic terms & condition lines to professional engineering English.
 */
export function convertTermToEnglish(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();

  // Payment terms
  if (trimmed.includes('دفعة مقدمة') || trimmed.includes('توقيع العقد') || trimmed.includes('أمر الشراء') || trimmed.includes('Down payment')) {
    if (trimmed.includes('30%') || trimmed.includes('30 %') || trimmed.includes('٣٠')) return '30% Advance payment upon order confirmation & contract signing.';
    if (trimmed.includes('40%') || trimmed.includes('40 %') || trimmed.includes('٤٠')) return '40% Advance payment upon order confirmation & contract signing.';
    if (trimmed.includes('50%') || trimmed.includes('50 %') || trimmed.includes('٥٠')) return '50% Advance payment upon order confirmation & contract signing.';
    if (trimmed.includes('20%') || trimmed.includes('20 %') || trimmed.includes('٢٠')) return '20% Advance payment upon order confirmation & contract signing.';
    return '30% Advance payment upon order confirmation & contract signing.';
  }
  if (trimmed.includes('توريد المواد') || trimmed.includes('موقع المشروع') || trimmed.includes('توريد المهمات')) {
    if (trimmed.includes('50%') || trimmed.includes('50 %') || trimmed.includes('٥٠')) return '50% Upon delivery of materials to project site.';
    if (trimmed.includes('60%') || trimmed.includes('60 %') || trimmed.includes('٦٠')) return '60% Upon delivery of materials to project site.';
    if (trimmed.includes('70%') || trimmed.includes('70 %') || trimmed.includes('٧٠')) return '70% Upon delivery of materials to project site.';
    return '50% Upon delivery of materials to project site.';
  }
  if (trimmed.includes('إنهاء التركيبات') || trimmed.includes('الاختبار') || trimmed.includes('التشغيل') || trimmed.includes('التسليم الابتدائي')) {
    if (trimmed.includes('20%') || trimmed.includes('20 %') || trimmed.includes('٢٠')) return '20% Upon completion of installation, testing, commissioning & initial handover.';
    if (trimmed.includes('10%') || trimmed.includes('10 %') || trimmed.includes('١٠')) return '10% Upon completion of installation, testing, commissioning & initial handover.';
    return '20% Upon completion of installation, testing, commissioning & initial handover.';
  }

  // Validity
  if (trimmed.includes('يوماً من تاريخ') || trimmed.includes('تاريخ إصدار العرض') || trimmed.includes('صلاحية العرض')) {
    return 'This proposal is valid for 15 days from the date of issuance.';
  }

  // Warranty
  if (trimmed.includes('شهراً ضد عيوب الصناعة') || trimmed.includes('الضمان') || trimmed.includes('عيوب الصناعة')) {
    return '12 Months warranty against manufacturing defects from the date of testing, commissioning & handover.';
  }

  // Delivery
  if (trimmed.includes('أسابيع من تاريخ') || trimmed.includes('اعتماد المخططات') || trimmed.includes('استلام الدفعة')) {
    return 'Within 4 to 6 weeks from approval of technical submittals and receipt of advance payment.';
  }

  // Notes
  if (trimmed.includes('الريال السعودي') || trimmed.includes('القيمة المضافة') || trimmed.includes('15%')) {
    return 'Prices are quoted in Saudi Riyals (SAR) and are subject to 15% VAT.';
  }
  if (trimmed.includes('الكميات المذكورة') || trimmed.includes('جدول كميات') || trimmed.includes('مخططات المشروع')) {
    return 'Quantities are estimated based on provided project BOQ and approved engineering drawings.';
  }
  if (trimmed.includes('الأعمال المدنية') || trimmed.includes('قواعد الخرسانة') || trimmed.includes('فتح الفتحات')) {
    return 'Civil works, wall/slab penetrations, scaffolding, and concrete equipment pads are excluded (by Client).';
  }
  if (trimmed.includes('الكابلات الكهربائية') || trimmed.includes('لوحة التوزيع')) {
    return 'Main electrical power cabling from MDB to equipment isolators is client scope.';
  }
  if (trimmed.includes('الدفاع المدني') || trimmed.includes('تصاريح')) {
    return 'Civil Defense and government authority licensing and inspection fees are excluded.';
  }

  return trimmed;
}

export function standardizeQuotationTermsToEnglish(terms?: CustomerQuotation['terms']): NonNullable<CustomerQuotation['terms']> {
  if (!terms) {
    return {
      includes: [
        'Supply scope of work as per approved technical submittal and proposal BOQ.',
        'Delivery of material to site at project location.',
        'UL/FM Listed equipment and manufacturer test certificates.',
        'Standard manufacturer warranty for 12 months from delivery/handover.',
      ],
      excludes: [
        '15% VAT of the total project price (unless stated as inclusive).',
        'Quantities are indicative and estimated based on client BOQ. Any variation shall be treated as a variation order.',
        'Civil works, core drilling, scaffolding, lifting cranes, and electric power supply on site.',
        'Civil Defense inspection and final government approval fees.',
      ],
      paymentTerms: [
        '30% Advance payment upon order confirmation & contract signing.',
        '50% Upon delivery of materials to project site.',
        '20% Upon completion of installation, testing, commissioning & initial handover.',
      ],
      validity: '15 Days from the date of quotation issuance.',
      notes: [
        'Prices are quoted in Saudi Riyals (SAR) and are subject to 15% VAT.',
        'Quantities are estimated based on provided project BOQ and engineering drawings.',
        'Storage of delivered items at site in a secure sheltered area is client responsibility.',
      ],
    };
  }

  const rawIncludes = terms.includes?.length ? terms.includes : [
    'Supply scope of work as per approved technical submittal and proposal BOQ.',
    'Delivery of material to site at project location.',
    'UL/FM Listed equipment and manufacturer test certificates.',
  ];
  const rawExcludes = terms.excludes?.length ? terms.excludes : [
    '15% VAT of the total project price (unless stated as inclusive).',
    'Quantities are indicative and estimated based on client BOQ.',
    'Civil works, core drilling, scaffolding, and electric power supply on site.',
    'Civil Defense inspection and final government approval fees.',
  ];
  const rawPaymentTerms = terms.paymentTerms?.length ? terms.paymentTerms : [
    '30% Advance payment upon order confirmation & contract signing.',
    '50% Upon delivery of materials to project site.',
    '20% Upon completion of installation, testing, commissioning & initial handover.',
  ];
  const rawNotes = terms.notes?.length ? terms.notes : [
    'Prices are quoted in Saudi Riyals (SAR) and are subject to 15% VAT.',
    'Quantities are estimated based on provided project BOQ and engineering drawings.',
  ];

  const includes = rawIncludes.map(convertTermToEnglish);
  const excludes = rawExcludes.map(convertTermToEnglish);
  const paymentTerms = rawPaymentTerms.map(convertTermToEnglish);
  const validity = /[\u0600-\u06FF]/.test(terms.validity || '')
    ? '15 Days from the date of quotation issuance.'
    : terms.validity || '15 Days from the date of quotation issuance.';
  const notes = rawNotes.map(convertTermToEnglish);

  return {
    includes,
    excludes,
    paymentTerms,
    validity,
    notes,
  };
}

/**
 * High-fidelity PDF export / print generator.
 * Opens a pristine, fully-styled print window for saving as PDF or direct printing.
 * Guarantees executive typography, centered engineer card, clean English terms,
 * and page-break isolation to prevent cramped or split bullet blocks.
 */
export function exportQuotationPrintWindow(quotation: CustomerQuotation): void {
  const printWindow = window.open('', '_blank', 'width=1000,height=900');
  if (!printWindow) {
    alert('Please allow popups to export the PDF quotation.');
    return;
  }

  const sanitizedTerms = standardizeQuotationTermsToEnglish(quotation.terms);
  const sections = getQuotationSections(quotation);

  const declaredSystems = (quotation.selectedSystems && quotation.selectedSystems.length > 0)
    ? quotation.selectedSystems
    : sections.map((s) => s.systemKey as SystemDiscipline);

  const systemNamesEn = declaredSystems.map((s) => getSystemMeta(s).nameEn).join(', ') || 'MEP & Specialized Engineering Systems';

  const isFireFightingHallucinated = (!declaredSystems.includes('fire_fighting')) &&
    ((quotation.systemDefinition && quotation.systemDefinition.toLowerCase().includes('fire')) ||
     (quotation.scopeOfWork && (quotation.scopeOfWork.includes('مكافحة') || quotation.scopeOfWork.toLowerCase().includes('fire'))));

  const cleanSystemDefinition = (isFireFightingHallucinated || !quotation.systemDefinition || quotation.systemDefinition.includes('مكافحة'))
    ? systemNamesEn
    : quotation.systemDefinition;

  const cleanScopeOfWork = (isFireFightingHallucinated || !quotation.scopeOfWork || quotation.scopeOfWork.startsWith('توريد'))
    ? `Supply, Installation, Testing & Commissioning of ${systemNamesEn}`
    : quotation.scopeOfWork;

  let boqSectionsHtml = '';

  sections.forEach((section, sIdx) => {
    const rowsHtml = section.items
      .map((item, itemIdx) => {
        const currentIdx = itemIdx + 1;
        const specsBadges: string[] = [];
        if (item.manufacturer) {
          specsBadges.push(`<span class="spec-badge"><strong>Brand:</strong> ${item.manufacturer}</span>`);
        }
        if (item.model) {
          specsBadges.push(`<span class="spec-badge"><strong>Model:</strong> ${item.model}</span>`);
        }

        return `
        <tr class="boq-item-row">
          <td class="cell-center font-bold text-muted">${currentIdx}</td>
          <td class="cell-desc">
            <div class="item-title">${item.description}</div>
            ${specsBadges.length > 0 ? `<div class="specs-wrapper">${specsBadges.join(' ')}</div>` : ''}
            ${item.pictureUrl ? `<div class="item-img-box"><img src="${item.pictureUrl}" alt="Item image" /></div>` : ''}
          </td>
          <td class="cell-center font-mono">${item.quantity}</td>
          <td class="cell-center font-muted">${item.unit || 'Pcs'}</td>
          <td class="cell-right font-mono">${snapToQuarter(item.sellingUnitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="cell-right font-mono font-bold text-dark">${snapToQuarter(item.sellingTotalPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>`;
      })
      .join('');

    boqSectionsHtml += `
      <!-- SECTION ${sIdx + 1}: ${section.sectionTitleEn} -->
      <tr class="section-divider-row">
        <td colspan="6">
          <div class="section-banner-content">
            <span class="sec-title-en">Section ${sIdx + 1}: ${section.sectionTitleEn}</span>
            <span class="sec-title-ar">${section.sectionTitleAr}</span>
          </div>
        </td>
      </tr>
      ${rowsHtml}
      <tr class="section-subtotal-row">
        <td colspan="5" class="cell-right font-bold text-muted">
          Subtotal - ${section.sectionTitleEn} [Excl. VAT] (SAR):
        </td>
        <td class="cell-right font-mono font-bold text-teal">
          ${snapToQuarter(section.subtotalSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    `;
  });

  const includesList = (sanitizedTerms.includes && sanitizedTerms.includes.length > 0)
    ? sanitizedTerms.includes
    : [
        'Supply and delivery of all materials to project site as per agreed technical proposal.',
        'Professional installation, mounting, and containment works according to approved drawings.',
        'Complete system programming, configuration, testing, and commissioning.',
        'Standard comprehensive manufacturer warranty for 2 years (24 months) against defects.',
      ];

  const excludesList = (sanitizedTerms.excludes && sanitizedTerms.excludes.length > 0)
    ? sanitizedTerms.excludes
    : [
        'Civil works, core drilling, trenching, scaffolding, lifting cranes, and electric power supply on site.',
        'Civil Defense inspection and final government approval fees unless explicitly stated.',
        'Any variations, additions, or work outside the agreed engineering scope of work.',
      ];

  const paymentTermsList = (sanitizedTerms.paymentTerms && sanitizedTerms.paymentTerms.length > 0)
    ? sanitizedTerms.paymentTerms
    : [
        '50% Advance payment upon order confirmation & contract signing / with PO.',
        '45% Upon delivery of materials to project site.',
        '5% Upon completion of installation, testing, commissioning & initial handover.',
      ];

  const notesList = (sanitizedTerms.notes && sanitizedTerms.notes.length > 0)
    ? sanitizedTerms.notes
    : [
        'All works shall strictly comply with Saudi Civil Defense and international engineering standards.',
        'Testing & commissioning shall be executed jointly in presence of client engineering representative.',
      ];

  const includesHtml = includesList
    .map((inc) => `<li class="term-item">${inc}</li>`)
    .join('');

  const excludesHtml = excludesList
    .map((exc) => `<li class="term-item">${exc}</li>`)
    .join('');

  const paymentTermsHtml = paymentTermsList
    .map((pt) => `<li class="term-item">${pt}</li>`)
    .join('');

  const notesHtml = notesList
    .map((n) => `<li class="term-item">${n}</li>`)
    .join('');

  // Persistent Signatures & Stamp loaded directly from strict enterprise localStorage keys
  const sigPrepared = typeof window !== 'undefined' ? localStorage.getItem('rmt_sig_prepared') || '' : '';
  const sigReviewed = typeof window !== 'undefined' ? localStorage.getItem('rmt_sig_reviewed') || '' : '';
  const sigApproved = typeof window !== 'undefined' ? localStorage.getItem('rmt_sig_approved') || '' : '';
  const companySeal = typeof window !== 'undefined' ? localStorage.getItem('rmt_company_seal') || '' : '';

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>Commercial Proposal - ${quotation.quotationNumber} - ${quotation.clientName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 18mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      margin: 0;
      padding: 20px 0;
      font-size: 11pt;
      line-height: 1.45;
      direction: ltr;
      text-align: left;
    }
    .page-break,
    .page-break-before {
      page-break-before: always !important;
      break-before: page !important;
    }
    .page-break-after {
      page-break-after: always !important;
      break-after: page !important;
    }
    .doc-page {
      background: #ffffff;
      max-width: 210mm;
      min-height: 297mm;
      margin: 16px auto;
      padding: 12mm 14mm 16mm 14mm;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      position: relative;
    }
    .screen-only-footer {
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      font-size: 8pt;
      color: #64748b;
      text-align: center;
      font-family: 'Calibri', monospace, sans-serif;
      line-height: 1.35;
    }
    .print-running-footer {
      display: none;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #007A5A;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .company-title {
      font-size: 14pt;
      font-weight: 800;
      color: #007A5A;
      letter-spacing: -0.2px;
      line-height: 1.2;
    }
    .company-sub {
      font-size: 9pt;
      color: #475569;
      margin-top: 2px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      table-layout: fixed;
    }
    .meta-table td {
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      font-size: 10pt;
    }
    .meta-label {
      background-color: #f8fafc;
      font-weight: 700;
      color: #334155;
      width: 28%;
    }
    .meta-value {
      background-color: #ffffff;
      color: #0f172a;
      font-weight: 600;
      width: 72%;
    }
    .confidentiality-box {
      border: 1px solid #cbd5e1;
      background: #fafaf9;
      padding: 9px 12px;
      border-radius: 4px;
      margin: 14px 0;
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.4;
    }
    /* CENTERED ENGINEER CONTACT BOX */
    .engineer-card {
      margin: 16px auto;
      max-width: 480px;
      border: 1.5px solid #007A5A;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .engineer-table {
      width: 100%;
      border-collapse: collapse;
    }
    .engineer-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10pt;
    }
    .eng-label {
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
      width: 32%;
      border-right: 1px solid #e2e8f0;
    }
    .eng-value {
      color: #0f172a;
      font-weight: 600;
    }

    /* BOQ TABLE STYLING */
    .boq-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-bottom: 16px;
    }
    .boq-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      padding: 8px 6px;
      font-size: 10pt;
      text-align: left;
    }
    .boq-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 6px;
      font-size: 10pt;
      vertical-align: middle;
      word-wrap: break-word;
    }
    .cell-center { text-align: center; }
    .cell-right { text-align: right; }
    .cell-desc { text-align: left; }
    .font-bold { font-weight: 700; }
    .font-mono { font-family: 'Calibri', monospace; font-variant-numeric: tabular-nums; }
    .text-muted { color: #64748b; }
    .text-dark { color: #0f172a; }
    .text-teal { color: #007A5A; }
    .font-muted { color: #475569; font-size: 9.5pt; }

    .item-title {
      font-weight: 700;
      color: #0f172a;
      line-height: 1.35;
    }
    .specs-wrapper {
      margin-top: 3px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .spec-badge {
      display: inline-block;
      font-size: 8.5pt;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 1px 5px;
      border-radius: 3px;
      color: #334155;
    }
    .item-img-box {
      margin-top: 4px;
    }
    .item-img-box img {
      max-height: 45px;
      max-width: 80px;
      object-fit: contain;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 2px;
      background: #fff;
    }

    /* SECTION BANNER & SUBTOTAL ROWS */
    .section-divider-row td {
      background: #e2e8f0;
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
    }
    .section-banner-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sec-title-en {
      font-weight: 800;
      color: #007A5A;
      font-size: 10.5pt;
    }
    .sec-title-ar {
      color: #475569;
      font-size: 9.5pt;
      font-weight: 600;
    }
    .section-subtotal-row td {
      background: #f8fafc;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      font-size: 10pt;
    }

    /* SECTIONAL SUMMARY BREAKDOWN */
    .sectional-summary-box {
      margin: 16px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .summary-title {
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .sectional-summary-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .sectional-summary-table th {
      background: #f1f5f9;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      font-size: 9.5pt;
    }
    .sectional-summary-table td {
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      font-size: 9.5pt;
    }

    /* GRAND TOTAL SUMMARY TABLE */
    .totals-summary-container {
      margin-top: 14px;
      margin-bottom: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .totals-table td {
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
      font-size: 10.5pt;
    }
    .totals-label {
      width: 70%;
      text-align: right;
      font-weight: 700;
      background: #f8fafc;
      color: #334155;
    }
    .totals-val {
      width: 30%;
      text-align: right;
      font-family: 'Calibri', monospace;
      font-weight: 700;
      color: #0f172a;
      background: #ffffff;
    }
    .grand-total-highlight td {
      background: #E6F4EA !important;
      border: 1.5px solid #007A5A !important;
      font-size: 12pt;
      padding: 9px 10px;
    }
    .grand-text {
      color: #007A5A !important;
      font-weight: 800 !important;
    }
    .grand-val {
      color: #007A5A !important;
      font-weight: 800 !important;
      font-size: 12.5pt;
    }

    h1 {
      text-align: center;
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      text-decoration: underline;
      margin: 10px 0 16px 0;
    }
    h2 {
      font-size: 12pt;
      font-weight: 700;
      color: #0f172a;
      margin: 12px 0 6px 0;
    }

    /* TERMS & CONDITIONS CARDS */
    .terms-wrapper {
      margin-top: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .terms-card {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-bottom: 10px;
      padding: 9px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .terms-card-title {
      margin: 0 0 6px 0;
      font-size: 10.5pt;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .terms-card-title::before {
      content: "";
      display: inline-block;
      width: 6px;
      height: 6px;
      background-color: #007A5A;
      border-radius: 50%;
    }
    .terms-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .term-item {
      position: relative;
      padding-left: 14px;
      margin-bottom: 4px;
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.45;
    }
    .term-item::before {
      content: "•";
      position: absolute;
      left: 2px;
      color: #007A5A;
      font-weight: bold;
      font-size: 12pt;
      line-height: 1;
      top: -1px;
    }
    .terms-validity-text {
      font-size: 9.5pt;
      color: #334155;
      font-weight: 600;
      padding-left: 14px;
      margin: 2px 0 0 0;
    }

    /* SIGNATURE BLOCK */
    .signature-container {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 0 6px;
    }
    .signature-box {
      text-align: center;
      flex: 1;
      border-top: 1.5px solid #94a3b8;
      padding-top: 6px;
      font-size: 9pt;
      color: #1e293b;
      line-height: 1.35;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    .signature-img-slot {
      height: 70px;
      max-height: 70px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 4px 0;
      overflow: hidden;
    }
    .signature-img-slot img {
      max-height: 65px !important;
      max-width: 160px !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
      display: block;
      margin: 0 auto;
    }

    .no-print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .print-btn {
      background: #007A5A;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #0c6b4f;
    }
    @media print {
      .no-print-bar, .no-print-spacer, .screen-only-footer {
        display: none !important;
      }
      body {
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
      }
      .doc-page {
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
        min-height: auto !important;
        display: block !important;
      }
      .page-break,
      .page-break-before {
        page-break-before: always !important;
        break-before: page !important;
        border-top: none !important;
      }
      .page-break-after {
        page-break-after: always !important;
        break-after: page !important;
      }
      tr, .boq-item-row, .section-divider-row, .section-subtotal-row, .terms-card, .signature-container, .engineer-card, .meta-table, .boq-table, .sectional-summary-box, .totals-summary-container {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .print-running-footer {
        display: block !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100% !important;
        text-align: center !important;
        font-size: 7.5pt !important;
        color: #475569 !important;
        border-top: 1px solid #cbd5e1 !important;
        padding-top: 4px !important;
        padding-bottom: 2px !important;
        background: #ffffff !important;
        font-family: 'Calibri', monospace, sans-serif !important;
        line-height: 1.3 !important;
        z-index: 99999 !important;
      }
    }
  </style>
</head>
<body>
  <!-- PERSISTENT MOBILE-FRIENDLY TOP ACTION BAR -->
  <div class="no-print-bar">
    <button onclick="window.close()" style="display: flex; align-items: center; gap: 6px; padding: 7px 12px; font-size: 12px; font-weight: 600; color: white; background: #1e293b; border: 1px solid #334155; border-radius: 6px; cursor: pointer;">
      <span style="font-size: 15px; line-height: 1;">←</span>
      <span>رجوع / إغلاق</span>
    </button>
    <div style="font-weight: bold; font-size: 11.5px; color: #38bdf8;">
      Commercial Proposal: ${quotation.quotationNumber} (${quotation.clientName})
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" aria-label="Close" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(30, 41, 59, 0.8); border: none; color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px;">✕</button>
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- PAGE 1: EXECUTIVE COVER                                 -->
  <!-- ======================================================== -->
  <div class="doc-page page-break-after">
    <div>
      <!-- Dual Masthead -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <svg viewBox="0 0 160 110" style="height: 48px; width: auto;" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="rmt-p-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#22C55E" />
                <stop offset="45%" stop-color="#10B981" />
                <stop offset="100%" stop-color="#0D9488" />
              </linearGradient>
            </defs>
            <path d="M 18 16 L 31 16 L 31 92 L 18 92 Z" fill="#22C55E" />
            <path d="M 31 16 L 68 16 L 68 28 L 31 28 Z" fill="url(#rmt-p-grad)" />
            <path d="M 56 28 L 68 28 L 68 44 L 56 44 Z" fill="#0D9488" />
            <polygon points="31,28 56,28 31,52" fill="#FFFFFF" />
            <polygon points="31,52 68,44 56,58 31,58" fill="#0D9488" />
            <polygon points="31,58 45,58 68,92 52,92" fill="#0D9488" />
            <polygon points="69,44 82,44 104,92 91,92" fill="#1E40AF" />
            <polygon points="91,92 104,92 124,44 111,44" fill="#1E40AF" />
            <polygon points="121,44 135,44 135,92 121,92" fill="#1E40AF" />
          </svg>
          <div>
            <div style="font-weight: 800; font-size: 12pt; color: #174A84; letter-spacing: 0.5px;">RMT - RESOURCE MAKERS TRADING Est.</div>
            <div style="font-size: 9pt; color: #007A5A; font-weight: 600;">Contracting & MEP Engineering Solutions</div>
          </div>
        </div>
        <div style="text-align: right; font-size: 9pt; color: #334155; line-height: 1.35;">
          <div style="font-size: 11pt; font-weight: 800; color: #174A84;">مؤسسة صناع الموارد التجارية (RMT)</div>
          <div style="font-size: 8pt; color: #64748b;">Kingdom of Saudi Arabia, Dammam, Al Shate Al gharbi</div>
          <div style="font-size: 8pt; color: #475569;">Phone: <strong>+966 549220606</strong> | Email: <strong>info@rmt-sa.com</strong></div>
          <div style="font-size: 8pt; font-family: monospace; font-weight: 700; color: #0f172a;">CR. NO. 2050167793 &nbsp;|&nbsp; VAT NO. 311552664400003</div>
        </div>
      </div>
      <div style="height: 3px; background: #00A859; border-radius: 9999px; margin-bottom: 12px;"></div>

      <h1 style="text-align: center; font-size: 18pt; margin: 10px 0; color: #0f172a; text-decoration: underline; text-underline-offset: 6px;">COMMERCIAL PROPOSAL</h1>

      <!-- META TABLE -->
      <table class="meta-table">
        <tr>
          <td class="meta-label">Scope of Work</td>
          <td class="meta-value">${cleanScopeOfWork}</td>
        </tr>
        <tr>
          <td class="meta-label">System Definition</td>
          <td class="meta-value">${cleanSystemDefinition}</td>
        </tr>
        <tr>
          <td class="meta-label">Project Name</td>
          <td class="meta-value">${quotation.projectName}</td>
        </tr>
        <tr>
          <td class="meta-label">Project Location</td>
          <td class="meta-value">${quotation.projectLocation}</td>
        </tr>
        <tr>
          <td class="meta-label">Client's Name</td>
          <td class="meta-value">${quotation.clientName}</td>
        </tr>
        <tr>
          <td class="meta-label">Attn. Name</td>
          <td class="meta-value">${quotation.attnName || 'Procurement & Estimation Dept.'}</td>
        </tr>
        <tr>
          <td class="meta-label">Proposal Ref. #</td>
          <td class="meta-value">${quotation.quotationNumber} (Rev ${quotation.version || 1})</td>
        </tr>
        <tr>
          <td class="meta-label">Initiated By</td>
          <td class="meta-value">${quotation.initiatedBy || quotation.issuerDetails?.name || 'Eng. Mokhtar Yousef'}</td>
        </tr>
        <tr>
          <td class="meta-label">Date</td>
          <td class="meta-value">${quotation.date}</td>
        </tr>
        <tr>
          <td class="meta-label">Validity</td>
          <td class="meta-value">${sanitizedTerms.validity || '15 Days from the date of quotation issuance.'}</td>
        </tr>
      </table>

      <!-- CONFIDENTIALITY STATEMENT -->
      <div class="confidentiality-box">
        <strong>Commercial Notice:</strong> The information contained in this proposal is proprietary and intended solely for the use of the client named above. No part of this document may be reproduced or distributed without prior written permission from Trade Resource Makers Est.
      </div>

      <!-- CENTERED ENGINEER CONTACT BOX -->
      <div class="engineer-card">
        <table class="engineer-table">
          <tr>
            <td class="eng-label">Estimation Eng.</td>
            <td class="eng-value">${quotation.issuerDetails?.name || quotation.initiatedBy || 'Sales & Estimation Department'}</td>
          </tr>
          <tr>
            <td class="eng-label">Position</td>
            <td class="eng-value">${quotation.issuerDetails?.title || 'Projects Manager'}</td>
          </tr>
          <tr>
            <td class="eng-label">Email</td>
            <td class="eng-value" style="color: #0284c7;">${quotation.issuerDetails?.email || 'info@rmt-sa.com'}</td>
          </tr>
          <tr>
            <td class="eng-label">Mobile / Tel</td>
            <td class="eng-value">+966 549220606</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Page 1 Universal Running Footer (Screen View) -->
    <div class="screen-only-footer">
      ID C.R 2050167793 &nbsp;|&nbsp; PO BOX 32511 - Saudi Arabia &nbsp;|&nbsp; +966 54 922 0606 &nbsp;|&nbsp; Info@rmt-sa.com &nbsp;|&nbsp; www.rmt.com.sa
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- PAGE 2: BOQ & PRICING SCHEDULE                           -->
  <!-- ======================================================== -->
  <div class="doc-page page-break-before page-break-after">
    <div>
      <div class="header-bar">
        <div style="font-weight: bold; color: #007A5A; font-size: 11pt;">TRADE RESOURCE MAKERS EST.</div>
        <div style="font-size: 9pt; color: #64748b;">Ref: <strong>${quotation.quotationNumber}</strong> | Project: <strong>${quotation.projectName}</strong></div>
      </div>

      <h2 style="font-size: 12pt; margin: 4px 0 10px 0; color: #0f172a;">1.0 Bill of Quantities (BOQ) & Pricing Schedule:</h2>
      <div style="font-size: 9.5pt; color: #334155; margin-bottom: 12px; line-height: 1.45;">
        <p style="margin: 0 0 4px 0;"><strong>Dear ${quotation.attnName || quotation.clientName || 'Valued Client'},</strong></p>
        <p style="margin: 0;">In reference to your inquiry for the <strong>${cleanScopeOfWork}</strong> at <strong>${quotation.projectLocation || 'Saudi Arabia'}</strong>, we are pleased to submit our commercial proposal with detailed technical specifications and competitive pricing below:</p>
      </div>

      <!-- BOQ TABLE -->
      <table class="boq-table">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">Item</th>
            <th>Description & Technical Specifications</th>
            <th style="width: 45px; text-align: center;">Qty</th>
            <th style="width: 40px; text-align: center;">Unit</th>
            <th style="width: 115px; text-align: right;">Unit Price (SAR)</th>
            <th style="width: 120px; text-align: right;">Total Price (SAR)</th>
          </tr>
        </thead>
        <tbody>
          ${boqSectionsHtml}
        </tbody>
      </table>

      <!-- CONSOLIDATED FINANCIAL SUMMARY TABLE -->
      <div class="totals-summary-container">
        <table class="totals-table">
          <thead>
            <tr>
              <th colspan="2" style="background: #e2e8f0; color: #0f172a; text-align: left; padding: 8px 12px; font-size: 9.5pt; font-weight: 700; border-bottom: 1.5px solid #cbd5e1;">
                Executive Financial Summary & Section Breakdown
              </th>
            </tr>
          </thead>
          <tbody>
            ${sections.map((sec, idx) => `
            <tr>
              <td class="totals-label" style="text-align: left; font-weight: 600; color: #334155; font-size: 9pt;">
                Section ${idx + 1}: ${sec.sectionTitleEn} <span style="color: #64748b; font-size: 8pt;">(${sec.sectionTitleAr})</span>
              </td>
              <td class="totals-val font-mono" style="font-weight: 600;">
                ${snapToQuarter(sec.subtotalSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
            `).join('')}
            <tr style="border-top: 1.5px solid #cbd5e1;">
              <td class="totals-label" style="text-align: right; font-weight: 700;">Total Subtotal (SAR):</td>
              <td class="totals-val text-teal font-mono font-bold">${snapToQuarter(quotation.totals.customerSellingPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="totals-label" style="text-align: right; font-weight: 700;">Value Added Tax (15% VAT):</td>
              <td class="totals-val font-mono">${snapToQuarter(quotation.totals.vatAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr class="grand-total-highlight">
              <td class="totals-label grand-text" style="text-align: right;">Grand Total (SAR):</td>
              <td class="totals-val grand-val font-mono">${snapToQuarter(quotation.totals.grandTotalWithVat).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size: 8pt; color: #64748b; margin-top: 5px; text-align: right;">* All prices are subject to 15% Value Added Tax (VAT) in accordance with Saudi ZATCA regulations.</div>
      </div>
    </div>

    <!-- Page 2 Universal Running Footer (Screen View) -->
    <div class="screen-only-footer">
      ID C.R 2050167793 &nbsp;|&nbsp; PO BOX 32511 - Saudi Arabia &nbsp;|&nbsp; +966 54 922 0606 &nbsp;|&nbsp; Info@rmt-sa.com &nbsp;|&nbsp; www.rmt.com.sa
    </div>
  </div>

  <!-- ======================================================== -->
  <!-- PAGE 3 & 4: SCOPE, CONTRACT TERMS & SIGNATURES           -->
  <!-- ======================================================== -->
  <div class="doc-page page-break-before">
    <div>
      <div class="header-bar">
        <div style="font-weight: bold; color: #007A5A; font-size: 11pt;">TRADE RESOURCE MAKERS EST.</div>
        <div style="font-size: 9pt; color: #64748b;">Ref: <strong>${quotation.quotationNumber}</strong> | Project: <strong>${quotation.projectName}</strong></div>
      </div>

      <h2 style="text-decoration: underline; margin: 4px 0 10px 0; font-size: 12pt; color: #0f172a;">Terms & Conditions:</h2>

      <!-- 1.1 Includes -->
      <div class="terms-card">
        <div class="terms-card-title">1.1 The above Price Includes (by RM):</div>
        <ul class="terms-list">${includesHtml}</ul>
      </div>

      <!-- 1.2 Excludes -->
      <div class="terms-card">
        <div class="terms-card-title">1.2 The above Price Excludes (by Client):</div>
        <ul class="terms-list">${excludesHtml}</ul>
      </div>

      <!-- 2.0 Payment Terms -->
      <div class="terms-card">
        <div class="terms-card-title">2.0 Payment Terms:</div>
        <ul class="terms-list">${paymentTermsHtml}</ul>
      </div>

      <!-- 2.1 Proposal Validity -->
      <div class="terms-card">
        <div class="terms-card-title">2.1 Proposal Validity:</div>
        <p class="terms-validity-text">${sanitizedTerms.validity || '15 Days from the date of quotation issuance.'}</p>
      </div>

      <!-- 2.2 Notes & Assumptions -->
      <div class="terms-card">
        <div class="terms-card-title">2.2 Notes & Technical Assumptions:</div>
        <ul class="terms-list">${notesHtml}</ul>
      </div>

      <div style="margin-top: 18px; text-align: center; color: #1e293b; font-weight: 600; font-size: 9.5pt; page-break-inside: avoid; break-inside: avoid;">
        <p style="margin: 0 0 3px 0;">Please do not hesitate to contact us should you have any questions or require further technical clarification.</p>
        <p style="margin: 0; font-size: 10.5pt; color: #007A5A; font-weight: 700;">Best Regards,<br>Trade Resource Makers Est. (RMT)</p>
      </div>

      <!-- SIGNATURES CONTAINER -->
      <div class="signature-container">
        <div class="signature-box">
          <div style="font-weight: bold; margin-bottom: 2px;">Prepared By:</div>
          <div class="signature-img-slot">
            ${sigPrepared ? `<img src="${sigPrepared}" alt="Signature" />` : `<span style="color: #94a3b8; font-size: 8pt; font-style: italic;">بانتظار التوقيع المعتمد</span>`}
          </div>
          <div style="font-weight: 700; color: #0f172a;">${quotation.issuerDetails?.name || quotation.initiatedBy || 'Eng. Mokhtar Yousef'}</div>
          <div style="color: #64748b; font-size: 8pt;">Estimation & Procurement Engineer</div>
        </div>

        <div class="signature-box">
          <div style="font-weight: bold; margin-bottom: 2px;">Reviewed & Approved By:</div>
          <div class="signature-img-slot">
            ${sigReviewed || sigApproved ? `<img src="${sigApproved || sigReviewed}" alt="Signature" />` : `<span style="color: #94a3b8; font-size: 8pt; font-style: italic;">بانتظار التوقيع المعتمد</span>`}
          </div>
          <div style="font-weight: 700; color: #0f172a;">Projects & Engineering Manager</div>
          <div style="color: #64748b; font-size: 8pt;">Trade Resource Makers Est. (RMT)</div>
        </div>

        <div class="signature-box">
          <div style="font-weight: bold; margin-bottom: 2px;">Client Acceptance & Seal:</div>
          <div class="signature-img-slot">
            ${companySeal ? `<img src="${companySeal}" alt="Seal" />` : `<span style="color: #94a3b8; font-size: 8pt; font-style: italic;">(الختم الرسمي للمؤسسة)</span>`}
          </div>
          <div style="font-weight: 700; color: #0f172a;">${quotation.attnName || quotation.clientName || 'Authorized Signatory'}</div>
          <div style="color: #64748b; font-size: 8pt;">Stamp & Signature</div>
        </div>
      </div>
    </div>

    <!-- Page 4 Universal Running Footer (Screen View) -->
    <div class="screen-only-footer">
      ID C.R 2050167793 &nbsp;|&nbsp; PO BOX 32511 - Saudi Arabia &nbsp;|&nbsp; +966 54 922 0606 &nbsp;|&nbsp; Info@rmt-sa.com &nbsp;|&nbsp; www.rmt.com.sa
    </div>
  </div>

  <!-- Universal Fixed Running Footer in Print (Automatically pinned to the bottom of EVERY printed page) -->
  <div class="print-running-footer">
    ID C.R 2050167793 &nbsp;|&nbsp; PO BOX 32511 - Saudi Arabia &nbsp;|&nbsp; +966 54 922 0606 &nbsp;|&nbsp; Info@rmt-sa.com &nbsp;|&nbsp; www.rmt.com.sa
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Backwards compatibility alias for exportQuotationPrintWindow.
 */
export const exportQuotationToPDF = exportQuotationPrintWindow;
