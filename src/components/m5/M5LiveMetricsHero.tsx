import React from 'react';
import {
  Activity,
  Plus,
  Sparkles,
  Upload,
  Trophy,
  TrendingUp,
  Receipt,
  ShoppingBag,
  ArrowUpRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { M5CircularProgressRing } from './M5CircularProgressRing';

interface M5LiveMetricsHeroProps {
  // Key Stats
  winRatePct: number;
  wonProjectsCount: number;
  wonProjectsTotalValue: number;
  wonProjectsTotalProfit: number;
  wonProjectsAvgMargin: number;
  collectionRatePct: number;
  totalCollected: number;
  totalInvoiced: number;
  totalPOValue: number;
  pendingPipelineValue: number;
  pendingPipelineCount: number;
  totalProjectsCount: number;
  // Handlers
  onCreateNewProject: () => void;
  onOpenUploadSupplierModal: () => void;
  onOpenAiPriceSearch?: () => void;
  onOpenStatusBreakdown?: (filter?: any) => void;
  onNavigateTab?: (tab: string) => void;
}

export const M5LiveMetricsHero: React.FC<M5LiveMetricsHeroProps> = ({
  winRatePct,
  wonProjectsCount,
  wonProjectsTotalValue,
  wonProjectsTotalProfit,
  wonProjectsAvgMargin,
  collectionRatePct,
  totalCollected,
  totalInvoiced,
  totalPOValue,
  pendingPipelineValue,
  pendingPipelineCount,
  totalProjectsCount,
  onCreateNewProject,
  onOpenUploadSupplierModal,
  onOpenAiPriceSearch,
  onOpenStatusBreakdown,
  onNavigateTab,
}) => {
  return (
    <div className="relative w-full rounded-3xl overflow-hidden p-1 shadow-[0_25px_60px_-15px_rgba(3,7,18,0.7)] transition-all duration-500">
      {/* 
        Horizontal Gradient Canvas:
        Transitioning smoothly from Deep Navy Blue (#070E20, #0B1736) 
        through Dark Olive Green (#1E2B19, #25391F) 
        to Vibrant Light Green (#0D5C3E, #10B981)
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#070D1E] via-[#1A2E1D] via-65% to-[#0A543A] pointer-events-none" />

      {/* Futuristic 3D Grid & Ambient Lighting Edges */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:28px_28px] opacity-60 pointer-events-none" />
      
      {/* Subtle Golden & Blue Light Cones */}
      <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#1E3A8A]/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-[#10B981]/25 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-64 h-64 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />

      {/* 
        Glossy, Translucent Glass Surface:
        Gives the authentic perception of floating on high-end crystal surface 
      */}
      <div className="relative z-10 rounded-[22px] backdrop-blur-2xl bg-white/[0.06] border border-white/20 p-5 sm:p-7 xl:p-8 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(0,0,0,0.3)] space-y-6">
        
        {/* Top Bar: Live Status & Executive Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/10 pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.35)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                M5 MODE ACTIVATED
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#142247]/80 text-sky-300 border border-sky-400/30">
                <Activity className="w-3 h-3 text-sky-400" />
                LIVE METRICS ENGINE
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-400/30">
                <Zap className="w-3 h-3 text-amber-400" />
                3D NEUMORPHIC HUD
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-cairo tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              Master Projects Tracking System
            </h1>
            <p className="text-xs sm:text-sm text-slate-200/90 max-w-3xl leading-relaxed">
              منظومة الرقابة الهندسية والمتابعة المالية الحية للمشاريع الكهروميكانيكية، تسعير جداول الكميات (BOQ)، والتدفقات النقدية
            </p>
          </div>

          {/* Quick 3D Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCreateNewProject}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#22C55E] to-[#10B981] hover:from-[#16A34A] hover:to-[#059669] text-slate-950 font-black text-xs sm:text-sm shadow-[0_8px_24px_rgba(34,197,94,0.4),inset_0_1px_1px_rgba(255,255,255,0.6)] border border-emerald-300/60 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-black/15 flex items-center justify-center">
                <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
              </div>
              <span>مشروع جديد</span>
            </button>

            {onOpenAiPriceSearch && (
              <button
                type="button"
                onClick={onOpenAiPriceSearch}
                className="px-4 py-3 rounded-2xl backdrop-blur-xl bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-100 font-bold text-xs sm:text-sm border border-indigo-400/30 shadow-[0_8px_20px_rgba(79,70,229,0.25),inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span className="hidden sm:inline">تسعير الذكاء الاصطناعي</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenUploadSupplierModal}
              className="px-4 py-3 rounded-2xl backdrop-blur-xl bg-slate-900/70 hover:bg-slate-800/80 text-white font-bold text-xs sm:text-sm border border-white/20 shadow-[0_8px_20px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>رفع تسعيرة</span>
            </button>
          </div>
        </div>

        {/* 
          Middle Area: Floating 3D Elements & Glowing Circular Progress Rings
          Data presented with deep glassmorphism and glossy illuminated edges
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left / Middle: 4 Glowing Circular Progress Rings */}
          <div className="lg:col-span-7 xl:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-3xl backdrop-blur-md bg-white/[0.04] border border-white/10 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_12px_30px_rgba(0,0,0,0.3)]">
            {/* Ring 1: Win Rate */}
            <div
              onClick={() => onOpenStatusBreakdown?.('Won')}
              className="cursor-pointer"
              title="معدل الترسية للمشاريع الفائزة"
            >
              <M5CircularProgressRing
                percentage={winRatePct}
                label="معدل الترسية"
                sublabel={`${wonProjectsCount}/${totalProjectsCount}`}
                colorType="green"
                glowId="win-rate"
              />
            </div>

            {/* Ring 2: Collection Rate */}
            <div
              onClick={() => onNavigateTab && onNavigateTab('invoices')}
              className="cursor-pointer"
              title="نسبة تحصيل المبالغ من الفواتير المعتمدة"
            >
              <M5CircularProgressRing
                percentage={collectionRatePct}
                label="نسبة التحصيل"
                sublabel="فواتير العملاء"
                colorType="blue"
                glowId="collection-rate"
              />
            </div>

            {/* Ring 3: Average Profit Margin */}
            <div
              onClick={() => onOpenStatusBreakdown?.('Won')}
              className="cursor-pointer"
              title="متوسط هامش الربح للمشاريع الفائزة"
            >
              <M5CircularProgressRing
                percentage={wonProjectsAvgMargin}
                label="هامش الربح"
                sublabel="متوسط محقق"
                colorType="gold"
                glowId="profit-margin"
              />
            </div>

            {/* Ring 4: Pipeline / Delivery Status */}
            <div
              onClick={() => onNavigateTab && onNavigateTab('purchase_orders')}
              className="cursor-pointer"
              title="أوامر الشراء الملتزم بها"
            >
              <M5CircularProgressRing
                percentage={Math.min(Math.round((totalCollected / (totalInvoiced || 1)) * 100), 100)}
                label="كفاءة التوريد"
                sublabel="أوامر الشراء"
                colorType="olive"
                glowId="supply-efficiency"
              />
            </div>
          </div>

          {/* Right: Floating 3D Vital Metric Pedestals (Glossy Translucent Glass) */}
          <div className="lg:col-span-5 xl:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* Floating Metric 1: Total Won Contracts Value */}
            <div
              onClick={() => onOpenStatusBreakdown?.('Won')}
              className="group relative p-4 rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/[0.12] to-white/[0.02] border border-white/25 shadow-[0_12px_28px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_16px_36px_rgba(34,197,94,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:border-emerald-400/50 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            >
              {/* Subtle Gold illuminated top edge */}
              <div className="absolute top-0 inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-70" />
              
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  قيمة المشاريع الفائزة [Incl. 15% VAT]
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shadow-xs">
                  <Trophy className="w-4 h-4 text-emerald-300" />
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
                  {wonProjectsTotalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs font-bold font-mono text-[#D4AF37]">SAR [Incl. 15% VAT]</span>
              </div>

              <div className="mt-2 text-[11px] text-emerald-300/90 font-medium flex items-center justify-between border-t border-white/10 pt-1.5">
                <span>{wonProjectsCount} مشاريع معتمدة [Incl. 15% VAT]</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* Floating Metric 2: Net Project Profits */}
            <div
              onClick={() => onOpenStatusBreakdown?.('Won')}
              className="group relative p-4 rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/[0.12] to-white/[0.02] border border-white/25 shadow-[0_12px_28px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_16px_36px_rgba(34,197,94,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:border-emerald-400/50 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            >
              {/* Vibrant Light Green illuminated top edge */}
              <div className="absolute top-0 inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-[#22C55E] to-transparent opacity-80" />

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  صافي أرباح المشاريع [Excl. VAT]
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shadow-xs">
                  <TrendingUp className="w-4 h-4 text-[#22C55E]" />
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#22C55E] drop-shadow-[0_0_12px_rgba(34,197,94,0.5)]">
                  {wonProjectsTotalProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs font-bold font-mono text-emerald-300">SAR [Excl. VAT]</span>
              </div>

              <div className="mt-2 text-[11px] text-emerald-200 font-medium flex items-center justify-between border-t border-white/10 pt-1.5">
                <span>هامش متوسط: <strong className="text-[#D4AF37]">{wonProjectsAvgMargin.toFixed(1)}%</strong></span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition" />
              </div>
            </div>

            {/* Floating Metric 3: Invoiced vs Collected */}
            <div
              onClick={() => onNavigateTab && onNavigateTab('invoices')}
              className="group relative p-4 rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/[0.12] to-white/[0.02] border border-white/25 shadow-[0_12px_28px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_16px_36px_rgba(56,189,248,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:border-sky-400/50 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            >
              <div className="absolute top-0 inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-[#38BDF8] to-transparent opacity-70" />

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  المحصل من الفواتير [Incl. 15% VAT]
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center shadow-xs">
                  <Receipt className="w-4 h-4 text-sky-300" />
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-sky-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
                  {totalCollected.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs font-bold font-mono text-sky-400">SAR [Incl. 15% VAT]</span>
              </div>

              <div className="mt-2 text-[11px] text-sky-200/90 font-medium flex items-center justify-between border-t border-white/10 pt-1.5">
                <span>من إجمالي {totalInvoiced.toLocaleString()} SAR [Incl. 15% VAT]</span>
                <span className="font-mono text-xs font-bold text-emerald-400">{collectionRatePct.toFixed(1)}%</span>
              </div>
            </div>

            {/* Floating Metric 4: Committed Purchase Orders */}
            <div
              onClick={() => onNavigateTab && onNavigateTab('purchase_orders')}
              className="group relative p-4 rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/[0.12] to-white/[0.02] border border-white/25 shadow-[0_12px_28px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] hover:shadow-[0_16px_36px_rgba(212,175,55,0.3),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:border-amber-400/50 transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
            >
              <div className="absolute top-0 inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-80" />

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  أوامر الشراء والتوريد [Incl. 15% VAT]
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shadow-xs">
                  <ShoppingBag className="w-4 h-4 text-amber-300" />
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-[#FBBF24] drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">
                  {totalPOValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs font-bold font-mono text-amber-200">SAR [Incl. 15% VAT]</span>
              </div>

              <div className="mt-2 text-[11px] text-amber-200/90 font-medium flex items-center justify-between border-t border-white/10 pt-1.5">
                <span>عقود وتوريدات جارية [Incl. 15% VAT]</span>
                <span className="font-mono text-slate-300 text-[10px]">PO & Supplies</span>
              </div>
            </div>

          </div>
        </div>

        {/* Real-time Sub-metrics HUD Tape */}
        <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/10">
            <span className="text-slate-300 block text-[11px]">معدل الترسية الحقيقي</span>
            <span className="text-base font-black font-mono text-[#22C55E]">
              {winRatePct}%
            </span>
          </div>
          <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/10">
            <span className="text-slate-300 block text-[11px]">تسعيرات قيد المتابعة [Excl. VAT]</span>
            <span className="text-base font-bold font-mono text-amber-300">
              {pendingPipelineValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-[10px] text-slate-400">SAR [Excl. VAT]</span>
            </span>
          </div>
          <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/10">
            <span className="text-slate-300 block text-[11px]">نسبة التحصيل الفعلي</span>
            <span className="text-base font-bold font-mono text-sky-300">
              {collectionRatePct.toFixed(1)}%
            </span>
          </div>
          <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/10">
            <span className="text-slate-300 block text-[11px]">أوامر الشراء الملتزمة (POs) [Incl. 15% VAT]</span>
            <span className="text-base font-bold font-mono text-[#D4AF37]">
              {totalPOValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-[10px] text-slate-400">SAR [Incl. 15% VAT]</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
