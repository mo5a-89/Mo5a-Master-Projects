/**
 * RMT Cash Flow Sentinel & Financials View
 * 30-Day Forward Rolling Liquidity Forecast, Runway Analysis,
 * 10% Advance & 10% Retention Invariant Auditing, and 5TB Cloud Archival Pipeline.
 */

import React, { useState, useMemo } from 'react';
import { Project, Invoice, PurchaseOrder, User, CustomerQuotation, DeliveryNote } from '../types';
import { generateLiquiditySentinelReport } from '../engines/cashFlowSentinel';
import { executeCloudExportArchival } from '../services/cloudStorageService';
import { useSettings } from '../context/SettingsContext';
import {
  TrendingUp,
  ShieldCheck,
  CloudUpload,
  Calendar,
  Briefcase,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface CashFlowSentinelProps {
  currentUser: User | null;
  projects: Project[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  customerQuotations: CustomerQuotation[];
  deliveryNotes: DeliveryNote[];
}

export const CashFlowSentinelView: React.FC<CashFlowSentinelProps> = ({
  currentUser,
  projects,
  invoices,
  purchaseOrders,
  customerQuotations,
  deliveryNotes,
}) => {
  const { settings } = useSettings();
  const isEn = settings.language === 'en';

  const report = useMemo(
    () => generateLiquiditySentinelReport(projects, invoices, purchaseOrders, 425000, isEn ? 'en' : 'ar'),
    [projects, invoices, purchaseOrders, isEn]
  );

  const [isExportingCloud, setIsExportingCloud] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  const handleTriggerCloudArchival = async () => {
    setIsExportingCloud(true);
    try {
      const result = await executeCloudExportArchival({
        projects,
        customerQuotations,
        supplierQuotations: [],
        purchaseOrders,
        invoices,
        deliveryNotes,
      });

      showToast(
        isEn
          ? `5TB Cloud archive exported successfully (${result.exportFileName} - ${result.fileSizeKB} KB). Cleared ${result.purgedKeysCount} temp keys.`
          : `تم تصدير نسخة الأرشيف السحابي 5TB بنجاح (${result.exportFileName} - ${result.fileSizeKB} KB). تم تطهير ${result.purgedKeysCount} مفاتيح جلسة مؤقتة.`
      );
    } catch (err) {
      showToast(isEn ? 'Error occurred during cloud archive export.' : 'حدث خطأ أثناء تصدير الأرشيف السحابي.');
    } finally {
      setIsExportingCloud(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-900/90 border border-emerald-500 text-emerald-100 px-4 py-3 rounded-lg flex items-center justify-between text-sm shadow-xl animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>{isEn ? 'Financial Liquidity Observatory' : 'المرصد المالي والتدفقات النقدية'}</span>
            <span>•</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">KSA VAT 15% Invariant</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#007A5A]" />
            {isEn ? 'RMT Cash Flow Sentinel (30 Days Forward)' : 'حارس السيولة والتدفقات النقدية (RMT Cash Flow Sentinel)'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isEn
              ? '30-Day forward liquidity forecasting, 10% advance deduction & 10% retention reserve tracking, and cloud archival.'
              : 'التنبؤ بالسيولة لـ 30 يوماً قادمة، ضبط استقطاعات الدفعات المقدمة (10%) ومحجوز الضمان (10%)، والأرشفة السحابية'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTriggerCloudArchival}
            disabled={isExportingCloud}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#174A84] text-white hover:bg-[#123866] shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <CloudUpload className="w-4 h-4 text-amber-300" />
            {isExportingCloud
              ? isEn ? 'Archiving & Purging...' : 'جاري الأرشفة والتطهير...'
              : isEn ? 'Export 5TB Cloud Archive (Google Drive)' : 'تصدير أرشيف سحابي 5TB (Google Drive)'}
          </button>
        </div>
      </div>

      {/* Key Financial Runway Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Current Operating Cash' : 'الرصيد النقدي التشغيلي الحالي'}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {report.currentCashPositionSAR.toLocaleString()} <span className="text-xs font-normal text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Current Liquid Bank Balance</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Projected 30-Day Balance' : 'الرصيد المتوقع بعد 30 يوماً'}
          </div>
          <div className={`text-lg sm:text-xl lg:text-2xl font-bold mt-1 ${report.projected30DayBalanceSAR >= 100000 ? 'text-[#007A5A]' : 'text-amber-600'}`}>
            {report.projected30DayBalanceSAR.toLocaleString()} <span className="text-xs font-normal text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">30-Day Forward Position</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Cash Runway' : 'معدل البقاء النقدي (Cash Runway)'}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-[#174A84] dark:text-sky-400 mt-1 flex items-center gap-2">
            <span>{report.cashRunwayDays} {isEn ? 'Days' : 'يوماً'}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {isEn ? 'Safe & Stable' : 'آمن ومستقر'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isEn ? `Daily Burn: ~SAR ${report.burnRatePerDaySAR.toLocaleString()}/day` : `حرق يومي: ~${report.burnRatePerDaySAR.toLocaleString()} ر.س/يوم`}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'Total Retention Reserve (10%)' : 'إجمالي محجوز الضمان المحتجز (10%)'}
          </div>
          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {report.totalRetentionWithheldSAR.toLocaleString()} <span className="text-xs font-normal text-slate-500">{isEn ? 'SAR' : 'ر.س'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Retention Reserve Held at Clients</div>
        </div>
      </div>

      {/* Recommendations Banner */}
      {report.recommendations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 shadow-sm space-y-2">
          <div className="text-xs font-bold text-[#174A84] dark:text-sky-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#174A84] dark:text-sky-400" />
            {isEn ? 'Financial Governance & Liquidity Directives:' : 'توجيهات الرقابة المالية وإدارة السيولة:'}
          </div>
          <div className="space-y-1">
            {report.recommendations.map((rec, idx) => (
              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-[#174A84] dark:text-sky-400 font-bold">•</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 30-Day Rolling Forecast Timeline Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#174A84] dark:text-sky-400" />
            <span>{isEn ? 'Daily Liquidity Forecast - Next 30 Days' : 'جدول التدفقات النقدية اليومية المتوقعة (Daily Liquidity Forecast - Next 30 Days)'}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isEn ? 'Total Inflows: ' : 'مجموع التحصيلات: '}
            <span className="font-bold text-emerald-700 dark:text-emerald-400">+{report.totalExpectedInflows30d.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}</span>
            {' | '}
            {isEn ? 'Total Outflows: ' : 'مجموع الالتزامات: '}
            <span className="font-bold text-rose-700 dark:text-rose-400">-{report.totalCommittedOutflows30d.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm max-h-96">
          <table className="w-full text-xs rtl:text-right ltr:text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 sticky top-0">
              <tr>
                <th className="p-3 w-32">{isEn ? 'Date & Day' : 'التاريخ واليوم'}</th>
                <th className="p-3 w-36 text-emerald-700 dark:text-emerald-400">{isEn ? 'Inflow' : 'التدفقات الداخلة (Inflow)'}</th>
                <th className="p-3 w-36 text-rose-700 dark:text-rose-400">{isEn ? 'Outflow' : 'التدفقات الخارجة (Outflow)'}</th>
                <th className="p-3 w-28 text-center">{isEn ? 'Net Change' : 'صافي التغير'}</th>
                <th className="p-3 w-36 text-center">{isEn ? 'Projected Balance' : 'الرصيد التراكمي المتوقع'}</th>
                <th className="p-3">{isEn ? 'Financial Events & Detail' : 'تفاصيل العمليات والأحداث المالية'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {report.timeline.map((day) => (
                <tr key={day.date} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/60 ${day.isDeficitRisk ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}`}>
                  <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                    <span className="block font-mono text-[11px] text-slate-500 dark:text-slate-400">{day.date}</span>
                    <span className="block font-semibold text-slate-900 dark:text-slate-100">{day.dayLabel}</span>
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {day.inflowSAR > 0 ? `+${day.inflowSAR.toLocaleString()} ${isEn ? 'SAR' : 'ر.س'}` : '-'}
                  </td>
                  <td className="p-3 font-mono font-bold text-rose-700 dark:text-rose-400">
                    {day.outflowSAR > 0 ? `-${day.outflowSAR.toLocaleString()} ${isEn ? 'SAR' : 'ر.س'}` : '-'}
                  </td>
                  <td className="p-3 text-center font-mono font-bold">
                    <span className={day.netChangeSAR >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                      {day.netChangeSAR >= 0 ? `+${day.netChangeSAR.toLocaleString()}` : day.netChangeSAR.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-900 dark:text-slate-100">
                    {day.projectedBalanceSAR.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {day.inflowEvents.map((evt, idx) => (
                        <div key={idx} className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{evt.title} ({evt.amount.toLocaleString()} {isEn ? 'SAR' : 'ر.س'})</span>
                        </div>
                      ))}
                      {day.outflowEvents.map((evt, idx) => (
                        <div key={idx} className="text-[11px] text-rose-800 dark:text-rose-300 flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{evt.title} ({evt.amount.toLocaleString()} {isEn ? 'SAR' : 'ر.س'})</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Ledgers Breakdown (10% Advance & 10% Retention Invariant) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#174A84] dark:text-sky-400" />
            <span>{isEn ? 'Project Ledgers & 10% Advance / Retention Invariants' : 'سجل أستاذ المشاريع والاحتياطيات (Project Ledgers & 10% Advance / Retention Invariants)'}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs rtl:text-right ltr:text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 w-48">{isEn ? 'Project' : 'المشروع'}</th>
                <th className="p-3 w-32 text-center">{isEn ? 'Contract Value' : 'قيمة العقد الإجمالية'}</th>
                <th className="p-3 w-36 text-center">{isEn ? 'Advance (10%)' : 'دفعة مقدمة (10%)'}</th>
                <th className="p-3 w-36 text-center">{isEn ? 'Retention (10%)' : 'محجوز الضمان (10%)'}</th>
                <th className="p-3 w-32 text-center">{isEn ? 'Total Billed' : 'المفوتر للمستخلصات'}</th>
                <th className="p-3 w-32 text-center">{isEn ? 'Collections' : 'التحصيلات الفعلية'}</th>
                <th className="p-3 w-32 text-center">{isEn ? 'Vendor POs' : 'التزامات الموردين (POs)'}</th>
                <th className="p-3 w-28 text-center">{isEn ? 'Gross Margin %' : 'هامش الربح %'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {report.projectLedgers.map((ledger) => {
                const proj = projects.find((p) => p.id === ledger.projectId);
                return (
                  <tr key={ledger.projectId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
                    <td className="p-3">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{proj?.name || ledger.projectId}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">{proj?.customerName}</span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {ledger.contractValueGross.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 block">{ledger.advancePaymentAmount.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isEn ? `Settled: ${ledger.advancePaymentSettled.toLocaleString()} SAR` : `تم استهلاك: ${ledger.advancePaymentSettled.toLocaleString()} ر.س`}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className="font-bold text-amber-700 dark:text-amber-400 block">{ledger.retentionReserveTotalWithheld.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isEn ? 'Held at Client' : 'محتجز لدى العميل'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {ledger.totalProgressBilled.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </td>
                    <td className="p-3 text-center font-bold text-[#007A5A] dark:text-emerald-400 font-mono">
                      {ledger.totalCollectionsReceived.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </td>
                    <td className="p-3 text-center font-bold text-rose-700 dark:text-rose-400 font-mono">
                      {ledger.totalSupplierCommitmentsPO.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                    </td>
                    <td className="p-3 text-center font-bold text-[#174A84] dark:text-sky-400 font-mono">
                      {ledger.projectGrossMarginPercent}%
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
