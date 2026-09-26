import React from 'react';
import {
  Trophy,
  Clock,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  DollarSign,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { User } from '../types';
import { isManagementOrSuperAdmin } from '../utils/financialMasking';

export interface DashboardMetricsProps {
  currentUser?: User | null;
  wonProjectsCount?: number;
  totalProjectsCount?: number;
  wonProjectsTotalValue?: number;
  pricingQuotationsCount?: number;
  pricingQuotationsValue?: number;
  wonProjectsTotalProfit?: number;
  wonProjectsAvgMargin?: number;
  totalInvoiced?: number;
  totalCollected?: number;
  collectionRate?: number;
  totalReceivables?: number;
  projects?: any[];
  customerQuotations?: any[];
  purchaseOrders?: any[];
  invoices?: any[];
  onOpenStatusBreakdown?: (filter: 'Won' | 'Under Pricing' | 'Lost' | 'all') => void;
  onOpenWonProjectsDetail?: () => void;
  onOpenProfitDetail?: () => void;
  onOpenCashCollectionDetail?: () => void;
  onNavigateTab?: (tab: string) => void;
  onFilterWonProjects?: () => void;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({
  currentUser,
  wonProjectsCount: pWonCount,
  totalProjectsCount: pTotalCount,
  wonProjectsTotalValue: pWonTotalValue,
  pricingQuotationsCount: pPricingCount,
  pricingQuotationsValue: pPricingValue,
  wonProjectsTotalProfit: pProfit,
  wonProjectsAvgMargin: pMargin,
  totalInvoiced: pInvoiced,
  totalCollected: pCollected,
  collectionRate: pCollectionRate,
  totalReceivables: pReceivables,
  projects = [],
  customerQuotations = [],
  invoices = [],
  onOpenStatusBreakdown,
  onOpenWonProjectsDetail,
  onOpenProfitDetail,
  onOpenCashCollectionDetail,
  onNavigateTab,
  onFilterWonProjects,
}) => {
  const { t, settings } = useSettings();
  const isEn = settings?.language === 'en';
  const canSeeFinancials = isManagementOrSuperAdmin(currentUser ?? null);

  // Compute metrics with intelligent fallback
  const wonCount = pWonCount ?? projects.filter((p: any) => p.status === 'Won' || p.status === 'In Progress' || p.status === 'Completed').length;
  const totalCount = pTotalCount ?? projects.length;
  const wonTotalValue = pWonTotalValue ?? projects
    .filter((p: any) => p.status === 'Won' || p.status === 'In Progress' || p.status === 'Completed')
    .reduce((sum: number, p: any) => sum + (Number(p.contractValue || p.sellingPrice || 0) * 1.15), 0);

  const pricingCount = pPricingCount ?? customerQuotations.filter((q: any) => q.status === 'Draft' || q.status === 'Sent' || q.status === 'Under Review').length;
  const pricingValue = pPricingValue ?? customerQuotations
    .filter((q: any) => q.status === 'Draft' || q.status === 'Sent' || q.status === 'Under Review')
    .reduce((sum: number, q: any) => sum + Number(q.totalAmount || q.subtotal || 0), 0);

  const profit = pProfit ?? projects
    .filter((p: any) => p.status === 'Won' || p.status === 'In Progress' || p.status === 'Completed')
    .reduce((sum: number, p: any) => sum + (Number(p.sellingPrice || 0) - Number(p.budgetCost || p.actualCost || 0)), 0);

  const avgMargin = pMargin ?? (wonTotalValue > 0 ? (profit / wonTotalValue) * 100 : 0);

  const totalInv = pInvoiced ?? invoices.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0);
  const totalCol = pCollected ?? invoices.reduce((sum: number, inv: any) => sum + Number(inv.paidAmount || 0), 0);
  const colRate = pCollectionRate ?? (totalInv > 0 ? (totalCol / totalInv) * 100 : 0);
  const receivables = pReceivables ?? Math.max(0, totalInv - totalCol);

  const handleWonClick = () => {
    if (!canSeeFinancials) return;
    if (onOpenWonProjectsDetail) onOpenWonProjectsDetail();
    else if (onFilterWonProjects) onFilterWonProjects();
    else if (onOpenStatusBreakdown) onOpenStatusBreakdown('Won');
  };

  const handleProfitClick = () => {
    if (!canSeeFinancials) return;
    if (onOpenProfitDetail) onOpenProfitDetail();
    else if (onFilterWonProjects) onFilterWonProjects();
  };

  const handleCashClick = () => {
    if (!canSeeFinancials) return;
    if (onOpenCashCollectionDetail) onOpenCashCollectionDetail();
    else if (onNavigateTab) onNavigateTab('invoices');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
      {/* ============================================================== */}
      {/* KPI 1: Active & Won Projects (Emerald Luxury Gradient & Glow)   */}
      {/* ============================================================== */}
      <div
        onClick={handleWonClick}
        className="group relative rounded-2xl p-5 border border-emerald-500/40 dark:border-emerald-500/50 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 dark:from-[#061A1E] dark:via-[#0B1528] dark:to-[#040F13] text-slate-900 dark:text-white shadow-sm hover:shadow-md dark:shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-teal-500/5 dark:bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {t?.activeProjects || 'المشاريع الفائزة والنشطة'}
          </span>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
            <Trophy className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10 mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-mono tabular-nums drop-shadow-xs">
            {wonCount}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? `of ${totalCount} projects` : `من أصل ${totalCount} مشاريع`}
          </span>
        </div>

        <div className="relative z-10 mt-4 text-[11px] text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-between border-t border-emerald-200/60 dark:border-slate-700/60 pt-3">
          <span className="truncate">
            {isEn ? 'Contract Value: ' : 'قيمة العقود: '}
            <span className="font-mono font-black tabular-nums">
              {canSeeFinancials ? Math.round(wonTotalValue).toLocaleString() : '***'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mx-1">SAR</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">{t?.inclVat || '[شامل 15% ضريبة]'}</span>
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition text-emerald-700 dark:text-emerald-300" />
        </div>
      </div>

      {/* ============================================================== */}
      {/* KPI 2: Quotations Pipeline (Warm Amber Luxury Glow)            */}
      {/* ============================================================== */}
      <div
        onClick={() => onOpenStatusBreakdown?.('Under Pricing')}
        className="group relative rounded-2xl p-5 border border-amber-500/40 dark:border-amber-500/50 bg-gradient-to-br from-amber-50/70 via-white to-yellow-50/40 dark:from-[#1E1705] dark:via-[#0B1528] dark:to-[#0F0D04] text-slate-900 dark:text-white shadow-sm hover:shadow-md dark:shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/10 dark:bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-yellow-500/5 dark:bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {t?.quotationsPipeline || 'عروض أسعار قيد المتابعة'}
          </span>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10 mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-mono tabular-nums drop-shadow-xs">
            {pricingCount}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'bids under estimation' : 'عطاءات ومشاريع تحت الدراسة'}
          </span>
        </div>

        <div className="relative z-10 mt-4 text-[11px] text-amber-800 dark:text-amber-300 font-bold flex items-center justify-between border-t border-amber-200/60 dark:border-slate-700/60 pt-3">
          <span className="truncate">
            {isEn ? 'Estimated Pipeline: ' : 'قيمة التسعير: '}
            <span className="font-mono font-black tabular-nums">
              {canSeeFinancials ? Math.round(pricingValue).toLocaleString() : '***'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mx-1">SAR</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">{t?.exclVat || '[قبل الضريبة]'}</span>
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition text-amber-700 dark:text-amber-300" />
        </div>
      </div>

      {/* ============================================================== */}
      {/* KPI 3: Margin & Profit (Deep Corporate Navy / Teal Accent Glow) */}
      {/* ============================================================== */}
      <div
        onClick={handleProfitClick}
        className="group relative rounded-2xl p-5 border border-[#174A84]/40 dark:border-sky-500/50 bg-gradient-to-br from-blue-50/70 via-white to-sky-50/40 dark:from-[#0B172E] dark:via-[#0B1528] dark:to-[#060D1A] text-slate-900 dark:text-white shadow-sm hover:shadow-md dark:shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
      >
        {/* Subtle Ambient Radial Glow with corporate Navy & Teal */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-sky-500/10 dark:bg-[#174A84]/40 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-[#007A5A]/10 dark:bg-[#007A5A]/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {t?.marginProfit || 'أرباح وهوامش المشاريع'}
          </span>
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-[#174A84] dark:text-sky-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10 mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#174A84] dark:text-sky-400 tracking-tight font-mono tabular-nums drop-shadow-xs">
            {canSeeFinancials ? `${avgMargin.toFixed(1)}%` : '**.*%'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'weighted margin' : 'متوسط هامش الربح'}
          </span>
        </div>

        <div className="relative z-10 mt-4 text-[11px] text-[#174A84] dark:text-sky-300 font-bold flex items-center justify-between border-t border-blue-200/60 dark:border-slate-700/60 pt-3">
          <span className="truncate">
            {isEn ? 'Net Profit: ' : 'صافي الأرباح: '}
            <span className="font-mono font-black tabular-nums">
              {canSeeFinancials ? Math.round(profit).toLocaleString() : '***'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mx-1">SAR</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">{t?.exclVat || '[قبل الضريبة]'}</span>
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition text-[#174A84] dark:text-sky-300" />
        </div>
      </div>

      {/* ============================================================== */}
      {/* KPI 4: Collection Rate (Indigo / Cyan Accent Glow & Typography) */}
      {/* ============================================================== */}
      <div
        onClick={handleCashClick}
        className="group relative rounded-2xl p-5 border border-indigo-500/40 dark:border-cyan-500/50 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 dark:from-[#121233] dark:via-[#0B1528] dark:to-[#07071A] text-slate-900 dark:text-white shadow-sm hover:shadow-md dark:shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-10 -right-10 w-36 h-36 bg-indigo-500/10 dark:bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-cyan-500/5 dark:bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {t?.collectionRate || 'نسبة التحصيل من الفواتير'}
          </span>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-cyan-400 border border-indigo-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10 mt-3 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-indigo-700 dark:text-cyan-400 tracking-tight font-mono tabular-nums drop-shadow-xs">
            {canSeeFinancials ? `${colRate.toFixed(1)}%` : '**.*%'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isEn ? 'collected' : 'معدل التحصيل'}
          </span>
        </div>

        <div className="relative z-10 mt-4 text-[11px] text-indigo-800 dark:text-cyan-300 font-bold flex items-center justify-between border-t border-indigo-200/60 dark:border-slate-700/60 pt-3">
          <span className="truncate">
            {isEn ? 'Receivables: ' : 'متبقي الذمم: '}
            <span className="font-mono font-black tabular-nums">
              {canSeeFinancials ? Math.round(receivables).toLocaleString() : '***'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mx-1">SAR</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-normal">{t?.inclVat || '[شامل 15% ضريبة]'}</span>
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition text-indigo-700 dark:text-cyan-300" />
        </div>
      </div>
    </div>
  );
};
