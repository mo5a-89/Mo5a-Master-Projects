/**
 * RMT CAD & BOQ Discrepancy Safeguard
 * Audits BOQ line items against MEP engineering standards:
 * - UL/FM certification for fire fighting & fire alarm items
 * - Pressure ratings (PN16, 300 PSI, Class 150) for piping & valves
 * - CFM & Airflow ratings for HVAC equipment & fans
 * - Voltage / Phase / Ingress Protection for electrical items
 * - Isolates unverified / ambiguous lines into an Ambiguity Audit Report
 */

import { QuotationItem, RFQVendorComparisonItem } from '../types';

export interface BOQDiscrepancyIssue {
  itemId: string;
  itemNo: number;
  description: string;
  missingRatings: string[];
  severity: 'high' | 'medium' | 'low';
  engineeringRecommendation: string;
}

export interface AmbiguityAuditReport {
  totalItemsAudited: number;
  compliantItemsCount: number;
  ambiguousItemsCount: number;
  complianceRatePercent: number;
  highRiskCount: number;
  issues: BOQDiscrepancyIssue[];
  reportTimestamp: string;
}

export function auditBOQItems(
  items: (QuotationItem | RFQVendorComparisonItem)[]
): AmbiguityAuditReport {
  const issues: BOQDiscrepancyIssue[] = [];

  items.forEach((item, index) => {
    const desc = (item.description || '').toLowerCase();
    const missing: string[] = [];
    let severity: 'high' | 'medium' | 'low' = 'low';
    let recommendation = '';

    // Check Fire Fighting & Alarm items
    if (desc.includes('extinguisher') || desc.includes('طفاية') || desc.includes('sprinkler') || desc.includes('رشاش') || desc.includes('cabinet') || desc.includes('كابينة') || desc.includes('fire')) {
      if (!desc.includes('ul') && !desc.includes('fm') && !desc.includes('qcd') && !desc.includes('civil defense')) {
        missing.push('شهادة الاعتماد الدولية UL/FM أو اعتماد الدفاع المدني');
        severity = 'high';
        recommendation = 'إلزام المورد بتحديد شهادة UL/FM Listing ورقم الشهادة لتفادي رفض الدفاع المدني.';
      }
    }

    // Check Piping and Valves
    if (desc.includes('pipe') || desc.includes('أنبوب') || desc.includes('ماسورة') || desc.includes('valve') || desc.includes('محبس')) {
      if (!desc.includes('psi') && !desc.includes('pn') && !desc.includes('class') && !desc.includes('sch') && !desc.includes('schedule')) {
        missing.push('فئة الضغط والجدول (Pressure Rating / Pipe Schedule e.g. Sch 40, PN16, 300 PSI)');
        if (severity !== 'high') severity = 'medium';
        recommendation = (recommendation ? recommendation + ' ' : '') + 'تحديد جدول الأنبوب (Sch 40) وتصنيف الضغط الاسمي (300 PSI).';
      }
    }

    // Check HVAC Equipment
    if (desc.includes('hvac') || desc.includes('fan') || desc.includes('مروحة') || desc.includes('تكييف') || desc.includes('fcu') || desc.includes('ahu') || desc.includes('chiller')) {
      if (!desc.includes('cfm') && !desc.includes('ton') && !desc.includes('btu') && !desc.includes('م/س') && !desc.includes('m3/h')) {
        missing.push('سعة التبريد ومعدل تدفق الهواء (Airflow Capacity CFM / Tons)');
        if (severity !== 'high') severity = 'medium';
        recommendation = (recommendation ? recommendation + ' ' : '') + 'إدراج السعة التبريدية بالأطنان والتدفق بوحدة CFM.';
      }
    }

    // Check Electrical & Pumps
    if (desc.includes('pump') || desc.includes('مضخة') || desc.includes('motor') || desc.includes('panel') || desc.includes('لوحة') || desc.includes('breaker') || desc.includes('قاطع')) {
      if (!desc.includes('volt') && !desc.includes('v') && !desc.includes('phase') && !desc.includes('ph') && !desc.includes('kw') && !desc.includes('hp')) {
        missing.push('مواصفات الجهد والقدرة (Voltage / Phase / Power Rating e.g. 380V/3Ph/60Hz)');
        if (severity !== 'high') severity = 'medium';
        recommendation = (recommendation ? recommendation + ' ' : '') + 'تحديد الجهد الكهربائي وعدد الأطوار والتردد (380V / 3Ph / 60Hz).';
      }
    }

    if (missing.length > 0) {
      issues.push({
        itemId: item.id || `it-${index}`,
        itemNo: (item as any).itemNo || index + 1,
        description: item.description,
        missingRatings: missing,
        severity,
        engineeringRecommendation: recommendation || 'مراجعة المواصفات الفنية وتثبيت اعتمادات المواد (Material Submittal).',
      });
    }
  });

  const total = items.length;
  const ambiguous = issues.length;
  const compliant = Math.max(0, total - ambiguous);
  const complianceRatePercent = total > 0 ? Number(((compliant / total) * 100).toFixed(1)) : 100;
  const highRiskCount = issues.filter((i) => i.severity === 'high').length;

  return {
    totalItemsAudited: total,
    compliantItemsCount: compliant,
    ambiguousItemsCount: ambiguous,
    complianceRatePercent,
    highRiskCount,
    issues,
    reportTimestamp: new Date().toISOString(),
  };
}
