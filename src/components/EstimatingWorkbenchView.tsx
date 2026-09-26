/**
 * RMT Estimating & Tendering Workbench
 * Multi-Vendor RFQ Comparison Matrix, Dynamic Markup/Margin Modeling,
 * CAD/BOQ Discrepancy Safeguards, Excel Costing Generation, and Project Promotion.
 */

import React, { useState } from 'react';
import {
  QuotationEstimate,
  RFQVendorComparisonItem,
  SYSTEM_DEFINITIONS,
  getSystemMeta,
  User,
} from '../types';
import { INITIAL_MASTER_ITEM_LIBRARY } from '../data/initialData';
import { auditBOQItems, AmbiguityAuditReport } from '../utils/boqAuditor';
import { generateCostingExcel } from '../utils/costingExcelGenerator';
import { recordAuditLog } from '../utils/auditLogger';
import { useSettings } from '../context/SettingsContext';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  Layers,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Plus,
  Building2,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface EstimatingWorkbenchProps {
  currentUser: User | null;
  estimates: QuotationEstimate[];
  onSaveEstimate: (estimate: QuotationEstimate) => void;
  onPromoteToProject: (estimate: QuotationEstimate) => void;
}

export const EstimatingWorkbenchView: React.FC<EstimatingWorkbenchProps> = ({
  currentUser,
  estimates,
  onSaveEstimate,
  onPromoteToProject,
}) => {
  const { settings } = useSettings();
  const { financial, corporate } = useMasterEnterpriseStore();
  const isEn = settings.language === 'en';

  const [activeEstimateId] = useState<string>(estimates[0]?.id || 'est-demo-1');
  const [selectedDisciplineFilter, setSelectedDisciplineFilter] = useState<string>('all');
  const [, setIsAuditingBOQ] = useState(false);
  const [auditReport, setAuditReport] = useState<AmbiguityAuditReport | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Initialize clean empty estimate if list is empty
  const defaultEstimate: QuotationEstimate = estimates.find((e) => e.id === activeEstimateId) || {
    id: 'est-new-1',
    estimateNumber: 'EST-NEW-001',
    clientMasterId: '',
    clientCompanyName: '',
    projectName: '',
    projectLocation: '',
    disciplines: ['fire_fighting', 'fire_alarm', 'hvac'],
    items: [],
    directCostTotal: 0,
    additionalCosts: {
      procurement: 0,
      installation: 0,
      transportation: 0,
      testingAndCommissioning: 0,
      engineering: 0,
      manpower: 0,
      contingency: 0,
      otherDirectCosts: 0,
    },
    totalCostBasis: 0,
    targetMarginPercent: financial.defaultGrossMargin || 20,
    totalSellingPrice: 0,
    vatPercent: financial.defaultVat || 15,
    grandTotalWithVat: 0,
    status: 'Draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const [currentEstimate, setCurrentEstimate] = useState<QuotationEstimate>(defaultEstimate);

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4500);
  };

  const handleRecalculateTotals = (items: RFQVendorComparisonItem[]) => {
    const directCost = items.reduce((sum, item) => sum + item.selectedVendorPrice * item.quantity, 0);
    const addCosts = Object.values(currentEstimate.additionalCosts).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalCostBasis = directCost + addCosts;

    const totalSelling = items.reduce((sum, item) => sum + item.customerSellingPrice * item.quantity, 0);
    const vatRate = currentEstimate.vatPercent || financial.defaultVat || 15;
    const vat = totalSelling * (vatRate / 100);
    const grand = totalSelling + vat;
    const margin = totalSelling > 0 ? ((totalSelling - totalCostBasis) / totalSelling) * 100 : 0;

    const updated: QuotationEstimate = {
      ...currentEstimate,
      items,
      directCostTotal: Number(directCost.toFixed(2)),
      totalCostBasis: Number(totalCostBasis.toFixed(2)),
      targetMarginPercent: Number(margin.toFixed(1)),
      totalSellingPrice: Number(totalSelling.toFixed(2)),
      grandTotalWithVat: Number(grand.toFixed(2)),
      updatedAt: new Date().toISOString(),
    };

    setCurrentEstimate(updated);
    onSaveEstimate(updated);
  };

  const handleVendorSelect = (itemId: string, vendorId: string, vendorPrice: number) => {
    const updatedItems = currentEstimate.items.map((item) => {
      if (item.id === itemId) {
        const selling = Number((vendorPrice * (1 + item.targetMarkupPercent / 100)).toFixed(2));
        return {
          ...item,
          selectedVendorId: vendorId,
          selectedVendorPrice: vendorPrice,
          customerSellingPrice: selling,
        };
      }
      return item;
    });

    handleRecalculateTotals(updatedItems);
    recordAuditLog(
      currentUser,
      'RFQ Vendor Selected',
      'QuotationEstimate',
      currentEstimate.estimateNumber,
      null,
      { itemId, vendorId, vendorPrice }
    );
  };

  const handleMarkupChange = (itemId: string, newMarkup: number) => {
    const updatedItems = currentEstimate.items.map((item) => {
      if (item.id === itemId) {
        const selling = Number((item.selectedVendorPrice * (1 + newMarkup / 100)).toFixed(2));
        return {
          ...item,
          targetMarkupPercent: newMarkup,
          customerSellingPrice: selling,
        };
      }
      return item;
    });

    handleRecalculateTotals(updatedItems);
  };

  const handleApplyGlobalMarkup = (newMarkup: number) => {
    const updatedItems = currentEstimate.items.map((item) => {
      const selling = Number((item.selectedVendorPrice * (1 + newMarkup / 100)).toFixed(2));
      return {
        ...item,
        targetMarkupPercent: newMarkup,
        customerSellingPrice: selling,
      };
    });
    handleRecalculateTotals(updatedItems);
    showNotification(
      isEn
        ? `Applied ${newMarkup}% variable markup to all estimate items.`
        : `تم تطبيق نسبة إضافة ${newMarkup}% على كافة بنود التقدير.`
    );
  };

  const handleRunBOQAudit = () => {
    setIsAuditingBOQ(true);
    const report = auditBOQItems(currentEstimate.items);
    setAuditReport(report);
    setIsAuditingBOQ(false);
    showNotification(
      isEn
        ? `BOQ compliance audit complete: ${report.complianceRatePercent}% compliance rating.`
        : `تم تدقيق بنود المقايسة: نسبة المطابقة الهندسية ${report.complianceRatePercent}%`
    );
  };

  const handleExportExcel = () => {
    const { blob, fileName } = generateCostingExcel(currentEstimate, undefined, currentUser);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(
      isEn
        ? `Costing sheet exported successfully (${fileName}).`
        : `تم تصدير ملف جدول التكاليف الحي (${fileName}) بنجاح.`
    );
  };

  const handleAddItemFromLibrary = (libRecord: typeof INITIAL_MASTER_ITEM_LIBRARY[0]) => {
    const newItem: RFQVendorComparisonItem = {
      id: `it-${Date.now()}`,
      itemNo: currentEstimate.items.length + 1,
      discipline: libRecord.discipline,
      description: isEn ? libRecord.descriptionEn : libRecord.descriptionAr,
      quantity: 1,
      unit: libRecord.unit,
      specRating: libRecord.standardRating,
      targetBudgetUnitPrice: libRecord.baseCostSAR,
      bids: [
        {
          vendorId: 'supp-preferred',
          vendorName: libRecord.preferredBrand,
          unitPrice: libRecord.baseCostSAR,
          deliveryLeadTimeDays: 14,
          warrantyMonths: 24,
          isCompliant: true,
        },
      ],
      selectedVendorId: 'supp-preferred',
      selectedVendorPrice: libRecord.baseCostSAR,
      targetMarkupPercent: libRecord.standardMarkupPercent,
      customerSellingPrice: libRecord.standardSellingPriceSAR,
    };

    const updatedItems = [...currentEstimate.items, newItem];
    handleRecalculateTotals(updatedItems);
    showNotification(
      isEn
        ? `Item ${libRecord.itemCode} added from Master Library.`
        : `تمت إضافة البند ${libRecord.itemCode} من مكتبة الأسعار القياسية.`
    );
  };

  const filteredItems = selectedDisciplineFilter === 'all'
    ? currentEstimate.items
    : currentEstimate.items.filter((i) => i.discipline === selectedDisciplineFilter);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notificationMsg && (
        <div className="bg-emerald-900/90 border border-emerald-500 text-emerald-100 px-4 py-3 rounded-lg flex items-center justify-between text-sm shadow-xl animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notificationMsg}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>{isEn ? 'Tender Estimation & Costing Engine' : 'منظومة التسعير والمناقصات المتقدمة'}</span>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
            <span className="text-slate-800 dark:text-slate-200 font-medium">{currentEstimate.estimateNumber}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#174A84] dark:text-sky-400" />
            {isEn ? 'MEP Estimating & Tendering Workbench' : 'منصة دراسة العطاءات والمقارنة السعرية (MEP Estimating Workbench)'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isEn
              ? 'Multi-vendor RFQ comparison matrix, markup and margin modeling, and UL/FM technical compliance audit.'
              : 'مقارنة عروض الموردين (RFQ Matrix)، ضبط هوامش الربحية، والتدقيق الهندسي لاعتمادات UL/FM'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunBOQAudit}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            {isEn ? 'Audit BOQ Compliance' : 'تدقيق مطابقة BOQ'}
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-emerald-600 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {isEn ? 'Export Costing Sheet (.xlsx)' : 'تصدير Costing Sheet (.xlsx)'}
          </button>

          <button
            onClick={() => {
              onPromoteToProject(currentEstimate);
              showNotification(
                isEn
                  ? `Estimate ${currentEstimate.estimateNumber} successfully promoted to active Project.`
                  : `تم تحويل المقايسة ${currentEstimate.estimateNumber} إلى مشروع تنفيذي معتمد بنجاح.`
              );
            }}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#174A84] text-white hover:bg-[#123866] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            {isEn ? 'Promote to Active Project' : 'اعتماد وترقية إلى مشروع تنفيذي (Promote)'}
          </button>
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Direct Procurement Cost Base' : 'إجمالي تكلفة الموردين المباشرة'}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {currentEstimate.directCostTotal.toLocaleString()} <span className="text-xs font-normal text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Direct Procurement Cost Base</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Target Client Proposal Total (Excl. VAT)' : 'إجمالي سعر البيع للعميل (Excl. VAT)'}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#174A84] dark:text-sky-400 mt-1">
            {currentEstimate.totalSellingPrice.toLocaleString()} <span className="text-xs font-normal text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Target Client Proposal Total</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Target Gross Margin' : 'هامش الربح الإجمالي المستهدف'}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#007A5A] dark:text-emerald-400 mt-1 flex items-center gap-1.5">
            <TrendingUp className="w-5 h-5" />
            {currentEstimate.targetMarginPercent}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isEn
              ? `Net Profit: SAR ${(currentEstimate.totalSellingPrice - currentEstimate.totalCostBasis).toLocaleString()}`
              : `صافي الربح: ${(currentEstimate.totalSellingPrice - currentEstimate.totalCostBasis).toLocaleString()} ر.س`}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Grand Total Inc. VAT (15%)' : 'الإجمالي الكلي شامل الضريبة (15%)'}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {currentEstimate.grandTotalWithVat.toLocaleString()} <span className="text-xs font-normal text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isEn
              ? `15% VAT: SAR ${(currentEstimate.totalSellingPrice * 0.15).toLocaleString()}`
              : `ضريبة 15%: ${(currentEstimate.totalSellingPrice * 0.15).toLocaleString()} ر.س`}
          </div>
        </div>
      </div>

      {/* BOQ Ambiguity Audit Alert Box */}
      {auditReport && (
        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {isEn ? 'CAD / BOQ Ambiguity & Standards Audit Report' : 'تقرير تدقيق المواصفات واعتمادات الدفاع المدني (CAD / BOQ Ambiguity Report)'}
              </h3>
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {isEn ? 'Compliance Rate: ' : 'نسبة المطابقة الهندسية: '}
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{auditReport.complianceRatePercent}%</span>
            </div>
          </div>

          {auditReport.issues.length === 0 ? (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isEn
                ? 'All BOQ items satisfy technical specifications (UL/FM, CFM, Ratings) with zero engineering ambiguity.'
                : 'جميع بنود المقايسة مستوفية للاعتمادات الفنية (UL/FM, CFM, Ratings) بدون أي غموض هندسي.'}
            </div>
          ) : (
            <div className="space-y-2">
              {auditReport.issues.map((issue) => (
                <div
                  key={issue.itemId}
                  className="text-xs p-3 rounded-lg border bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {isEn ? `Item #${issue.itemNo}: ${issue.description}` : `بند #${issue.itemNo}: ${issue.description}`}
                    </span>
                    <div className="text-rose-700 dark:text-rose-400 mt-1">
                      {isEn ? `Missing Standards: ${issue.missingRatings.join(' • ')}` : `نواقص الاعتماد: ${issue.missingRatings.join(' • ')}`}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-amber-200 dark:border-amber-700">
                    {issue.engineeringRecommendation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Add from Master Item Library */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-[#174A84] dark:text-sky-400" />
          {isEn
            ? 'Quick Add from Standard Price Library (11 MEP Disciplines):'
            : 'إضافة سريعة من مكتبة الأسعار القياسية المعتمدة (11 أنظمة كهروميكانيكية):'}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {INITIAL_MASTER_ITEM_LIBRARY.slice(0, 6).map((libItem) => (
            <button
              key={libItem.id}
              onClick={() => handleAddItemFromLibrary(libItem)}
              className="text-xs whitespace-nowrap px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-[#174A84] text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#174A84] dark:text-sky-400" />
              <span>{libItem.itemCode} ({libItem.baseCostSAR} {isEn ? 'SAR' : 'ر.س'})</span>
            </button>
          ))}
        </div>
      </div>

      {/* RFQ Multi-Vendor Comparison Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <span>{isEn ? 'Multi-Vendor RFQ Comparison Matrix' : 'مصفوفة تسعير البنود ومقارنة عروض الموردين (Multi-Vendor RFQ Matrix)'}</span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              ({filteredItems.length} {isEn ? 'items' : 'بند'})
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 px-1.5">
                {isEn ? 'Variable Markup:' : 'هامش متغير:'}
              </span>
              {[10, 15, 20, 25, 30, 35, 40, 50].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleApplyGlobalMarkup(preset)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                    currentEstimate.targetMarginPercent === preset
                      ? 'bg-[#174A84] text-white shadow-xs'
                      : 'hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                  title={`${preset}% Markup`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedDisciplineFilter}
                onChange={(e) => setSelectedDisciplineFilter(e.target.value)}
                className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="all">{isEn ? 'All Disciplines' : 'كافة الأنظمة الهندسية (All Disciplines)'}</option>
                {SYSTEM_DEFINITIONS.map((def) => (
                  <option key={def.id} value={def.id}>
                    {isEn ? def.nameEn : def.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <table className="w-full text-xs rtl:text-right ltr:text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 w-48">{isEn ? 'System & Description' : 'النظام والوصف الفني'}</th>
                <th className="p-3 w-28">{isEn ? 'Specs & Rating' : 'المواصفات والاعتماد'}</th>
                <th className="p-3 w-16 text-center">{isEn ? 'Qty' : 'الكمية'}</th>
                <th className="p-3 w-72">{isEn ? 'Supplier RFQ Bids' : 'مقارنة عروض الموردين (RFQ Bids)'}</th>
                <th className="p-3 w-24 text-center">{isEn ? 'Approved Cost' : 'تكلفة الشراء المعتمدة'}</th>
                <th className="p-3 w-20 text-center">{isEn ? 'Markup %' : 'هامش الربح %'}</th>
                <th className="p-3 w-28 text-center">{isEn ? 'Unit Selling Price' : 'سعر البيع للعميل'}</th>
                <th className="p-3 w-28 text-center">{isEn ? 'Total Selling' : 'إجمالي البيع'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredItems.map((item) => {
                const sysMeta = getSystemMeta(item.discipline);
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="p-3 text-center font-medium text-slate-500 dark:text-slate-400">{item.itemNo}</td>
                    <td className="p-3">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                        {isEn ? sysMeta.nameEn : sysMeta.nameAr}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block mt-0.5">{item.description}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px] block">{item.specRating}</span>
                    </td>
                    <td className="p-3 text-center font-medium text-slate-800 dark:text-slate-200">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1.5">
                        {item.bids.map((bid) => {
                          const isSelected = item.selectedVendorId === bid.vendorId;
                          return (
                            <button
                              key={bid.vendorId}
                              onClick={() => handleVendorSelect(item.id, bid.vendorId, bid.unitPrice)}
                              className={`w-full rtl:text-right ltr:text-left p-2 rounded-lg border text-[11px] transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold ring-1 ring-emerald-500'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span>{bid.vendorName} ({bid.deliveryLeadTimeDays} {isEn ? 'days' : 'يوم'})</span>
                              <span className="font-mono">{bid.unitPrice.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {item.selectedVendorPrice.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={item.targetMarkupPercent}
                        onChange={(e) => handleMarkupChange(item.id, Number(e.target.value) || 0)}
                        className="w-16 text-center border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-1.5 py-1 text-xs font-bold text-[#174A84] dark:text-sky-400"
                      />
                    </td>
                    <td className="p-3 text-center font-bold text-[#174A84] dark:text-sky-400 font-mono">
                      {item.customerSellingPrice.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {(item.customerSellingPrice * item.quantity).toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
