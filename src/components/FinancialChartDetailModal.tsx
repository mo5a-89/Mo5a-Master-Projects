import React from 'react';
import {
  X,
  Trophy,
  TrendingUp,
  Layers,
  ShoppingBag,
  PieChart as PieChartIcon,
  ChevronLeft,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  CreditCard,
  Building2,
  Briefcase,
  FileText,
  Boxes,
} from 'lucide-react';

export type FinancialCategoryType =
  | 'tender_status'
  | 'won_projects'
  | 'all_projects'
  | 'systems'
  | 'procurement';

export interface FinancialMetricItem {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: 'emerald' | 'amber' | 'rose' | 'blue' | 'teal' | 'purple' | 'slate';
}

export interface FinancialBreakdownRow {
  title: string;
  subtitle?: string;
  value: string | number;
  subValue?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate';
  onClick?: () => void;
}

export interface FinancialDetailModalData {
  category: FinancialCategoryType;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate';
  };
  metrics: FinancialMetricItem[];
  progressInfo?: {
    title: string;
    percentage: number;
    color: string;
    detail: string;
  };
  breakdownTitle?: string;
  breakdownItems?: FinancialBreakdownRow[];
  actionButton?: {
    label: string;
    icon?: 'project' | 'purchase' | 'quotation' | 'filter';
    onClick: () => void;
  };
}

interface FinancialChartDetailModalProps {
  data: FinancialDetailModalData | null;
  onClose: () => void;
}

export const FinancialChartDetailModal: React.FC<FinancialChartDetailModalProps> = ({
  data,
  onClose,
}) => {
  if (!data) return null;

  const getCategoryIcon = () => {
    switch (data.category) {
      case 'tender_status':
        return <PieChartIcon className="w-5 h-5 text-amber-400" />;
      case 'won_projects':
        return <Trophy className="w-5 h-5 text-emerald-400" />;
      case 'all_projects':
        return <TrendingUp className="w-5 h-5 text-blue-400" />;
      case 'systems':
        return <Layers className="w-5 h-5 text-purple-400" />;
      case 'procurement':
        return <ShoppingBag className="w-5 h-5 text-teal-400" />;
      default:
        return <PieChartIcon className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getBadgeClass = (variant?: string) => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'amber':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'rose':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'blue':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'purple':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  const getMetricColor = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'text-emerald-400';
      case 'teal':
        return 'text-teal-400';
      case 'amber':
        return 'text-amber-400';
      case 'rose':
        return 'text-rose-400';
      case 'blue':
        return 'text-blue-400';
      case 'purple':
        return 'text-purple-400';
      default:
        return 'text-white';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-[#0b1329] text-slate-100 rounded-3xl border border-slate-700/80 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center shrink-0 shadow-md">
              {getCategoryIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white font-cairo">
                  {data.title}
                </h3>
                {data.badge && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getBadgeClass(
                      data.badge.variant
                    )}`}
                  >
                    {data.badge.text}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{data.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* 4-Card / 2-Card Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.metrics.map((metric, idx) => (
              <div
                key={idx}
                className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/90 shadow-inner flex flex-col justify-between space-y-1 hover:border-slate-700 transition"
              >
                <span className="text-xs font-semibold text-slate-300">
                  {metric.label}
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-mono font-black text-base sm:text-lg ${getMetricColor(
                      metric.color
                    )}`}
                  >
                    {typeof metric.value === 'number'
                      ? metric.value.toLocaleString()
                      : metric.value}
                  </span>
                  {metric.sublabel && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {metric.sublabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Progress / Ratio Bar (if provided) */}
          {data.progressInfo && (
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-200">
                  {data.progressInfo.title}
                </span>
                <span className="font-mono font-black text-emerald-400">
                  {data.progressInfo.percentage}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, data.progressInfo.percentage))}%`,
                    backgroundColor: data.progressInfo.color || '#10B981',
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {data.progressInfo.detail}
              </p>
            </div>
          )}

          {/* Itemized Breakdown List */}
          {data.breakdownItems && data.breakdownItems.length > 0 && (
            <div className="space-y-2 pt-1">
              {data.breakdownTitle && (
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                  <span>{data.breakdownTitle}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {data.breakdownItems.length} سجل
                  </span>
                </div>
              )}

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.breakdownItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={item.onClick}
                    className={`p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 transition ${
                      item.onClick
                        ? 'hover:border-emerald-500/50 hover:bg-slate-800/80 cursor-pointer group'
                        : ''
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs truncate">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getBadgeClass(
                              item.badgeColor
                            )}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-400 truncate">
                          {item.subtitle}
                        </p>
                      )}
                      {item.subValue && (
                        <p className="text-[10px] text-emerald-400/90 font-mono">
                          {item.subValue}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {typeof item.value === 'number'
                          ? item.value.toLocaleString()
                          : item.value}
                      </span>
                      {item.onClick && (
                        <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:-translate-x-0.5 transition" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800 shrink-0">
          {data.actionButton ? (
            <button
              type="button"
              onClick={data.actionButton.onClick}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black text-xs shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {data.actionButton.icon === 'purchase' && (
                <ShoppingBag className="w-4 h-4" />
              )}
              {data.actionButton.icon === 'project' && (
                <Briefcase className="w-4 h-4" />
              )}
              {data.actionButton.icon === 'quotation' && (
                <FileText className="w-4 h-4" />
              )}
              {data.actionButton.icon === 'filter' && (
                <Layers className="w-4 h-4" />
              )}
              <span>{data.actionButton.label}</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
