/**
 * RMT Live Excel Costing Sheets (.xlsx) Generator
 * Formula-driven cells for direct cost base, configurable markups, VAT 15%,
 * and corporate RMT branding.
 */

import * as XLSX from 'xlsx';
import { CustomerQuotation, QuotationEstimate, User } from '../types';
import { isManagementOrSuperAdmin } from './financialMasking';

export function generateCostingExcel(
  quotationOrEstimate: CustomerQuotation | QuotationEstimate,
  companyDetails = {
    nameAr: 'مؤسسة صناع الموارد التجارية',
    nameEn: 'RESOURCE MAKERS TRADING EST.',
    crNumber: '2050167793',
    vatNumber: '311552664400003',
    bankIban: 'SA71 8000 0450 6080 1000 1399',
  },
  currentUser?: User | null
): { blob: Blob; fileName: string } {
  const isAuthorized = currentUser ? isManagementOrSuperAdmin(currentUser) : true;
  const wb = XLSX.utils.book_new();

  const isEstimate = 'estimateNumber' in quotationOrEstimate;
  const docNumber = isEstimate
    ? (quotationOrEstimate as QuotationEstimate).estimateNumber
    : (quotationOrEstimate as CustomerQuotation).quotationNumber;
  const clientName = isEstimate
    ? (quotationOrEstimate as QuotationEstimate).clientCompanyName
    : (quotationOrEstimate as CustomerQuotation).clientName;
  const projectName = quotationOrEstimate.projectName;

  const rows: any[][] = [];

  // Header Rows
  rows.push([companyDetails.nameAr, '', '', '', '', '', '', companyDetails.nameEn]);
  rows.push([`س.ت: ${companyDetails.crNumber}`, '', '', '', '', '', '', `الرقم الضريبي: ${companyDetails.vatNumber}`]);
  rows.push([`الحساب البنكي (مصرف الراجحي): ${companyDetails.bankIban}`]);
  rows.push([]);
  rows.push(['جدول التكاليف والكميات المعتمدة (MEP COSTING & BOQ WORKBENCH)']);
  rows.push([`رقم الوثيقة: ${docNumber}`, '', `العميل: ${clientName}`, '', '', `المشروع: ${projectName}`]);
  rows.push([`تاريخ الإصدار: ${new Date().toLocaleDateString('en-GB')}`]);
  rows.push([]);

  // Table Headers
  rows.push([
    'م (Item)',
    'الوصف الفني للمواد والمعدات (Technical Description & Specs)',
    'الكمية (Qty)',
    'الوحدة (Unit)',
    isAuthorized ? 'سعر تكلفة المورد (Unit Cost SAR)' : 'حالة التسعير',
    isAuthorized ? 'إجمالي التكلفة (Total Cost SAR)' : 'التكلفة الإجمالية',
    isAuthorized ? 'هامش الربح % (Markup %)' : 'الهامش %',
    'سعر البيع للوحدة (Selling Unit SAR)',
    'إجمالي البيع (Selling Total SAR)',
  ]);

  const items = quotationOrEstimate.items || [];
  const startRow = 10; // 1-based row index where items start

  items.forEach((item: any, idx: number) => {
    const rIdx = startRow + idx;
    const qty = Number(item.quantity) || 1;
    const cost = isAuthorized
      ? Number(item.supplierUnitPrice || item.selectedVendorPrice || item.targetBudgetUnitPrice) || 0
      : 0;
    const markup = isAuthorized ? Number(item.markupPercent || item.targetMarkupPercent) || 25 : 0;
    const sellPrice = Number(item.sellingUnitPrice || item.customerSellingPrice) || (cost * (1 + markup / 100));

    rows.push([
      idx + 1,
      item.description || item.descriptionAr || '',
      qty,
      item.unit || 'بند',
      isAuthorized ? cost : '***',
      isAuthorized ? { t: 'n', f: `C${rIdx}*E${rIdx}` } : '***',
      isAuthorized ? markup : '***',
      isAuthorized ? { t: 'n', f: `E${rIdx}*(1+G${rIdx}/100)` } : sellPrice,
      isAuthorized ? { t: 'n', f: `C${rIdx}*H${rIdx}` } : qty * sellPrice,
    ]);
  });

  const lastItemRow = startRow + items.length - 1;
  rows.push([]);
  rows.push([
    '',
    'الإجمالي الفرعي المباشر (Direct Subtotal):',
    '',
    '',
    '',
    { t: 'n', f: `SUM(F${startRow}:F${lastItemRow})` },
    '',
    '',
    { t: 'n', f: `SUM(I${startRow}:I${lastItemRow})` },
  ]);

  const subtotalRow = lastItemRow + 2;
  const vatRow = subtotalRow + 1;
  const grandTotalRow = vatRow + 1;

  rows.push([
    '',
    'ضريبة القيمة المضافة (KSA VAT 15%):',
    '',
    '',
    '',
    { t: 'n', f: `F${subtotalRow}*0.15` },
    '',
    '',
    { t: 'n', f: `I${subtotalRow}*0.15` },
  ]);

  rows.push([
    '',
    'الإجمالي الكلي النهائي شامل الضريبة (Grand Total incl. VAT):',
    '',
    '',
    '',
    { t: 'n', f: `F${subtotalRow}+F${vatRow}` },
    '',
    '',
    { t: 'n', f: `I${subtotalRow}+I${vatRow}` },
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // Item No
    { wch: 45 }, // Description
    { wch: 10 }, // Qty
    { wch: 10 }, // Unit
    { wch: 18 }, // Unit Cost
    { wch: 20 }, // Total Cost
    { wch: 14 }, // Markup %
    { wch: 18 }, // Selling Unit
    { wch: 20 }, // Selling Total
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Costing & BOQ');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `RMT_Costing_${docNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;

  return { blob, fileName };
}
