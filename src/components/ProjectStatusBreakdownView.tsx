import React, { useState, useMemo } from 'react';
import { Project, CustomerQuotation, PurchaseOrder } from '../types';
import {
  ProjectOutcome,
  PROJECT_STATUS_CONFIG,
  getNormalizedProjectStatus,
  computeAutomatedAwardStatus,
} from '../utils/projectStatusUtils';
import {
  Trophy,
  Clock,
  XCircle,
  ArrowLeft,
  Search,
  AlertCircle,
  ExternalLink,
  Edit3,
  Trash2,
  PieChart,
  Building,
  MapPin,
  Printer,
} from 'lucide-react';
import { ProjectStatusReportModal } from './ProjectStatusReportModal';
import { useSettings } from '../context/SettingsContext';

interface ProjectStatusBreakdownViewProps {
  projects: Project[];
  customerQuotations: CustomerQuotation[];
  purchaseOrders?: PurchaseOrder[];
  initialFilter?: ProjectOutcome | 'all';
  onBack?: () => void;
  onSelectProject: (projectId: string) => void;
  onUpdateProjectStatus: (projectId: string, status: ProjectOutcome, lossReason?: string) => void;
  onRequestEditLossReason?: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectStatusBreakdownView: React.FC<ProjectStatusBreakdownViewProps> = ({
  projects,
  customerQuotations,
  purchaseOrders = [],
  initialFilter = 'all',
  onBack,
  onSelectProject,
  onUpdateProjectStatus,
  onRequestEditLossReason,
  onDeleteProject,
}) => {
  const { settings } = useSettings();
  const isEn = settings.language === 'en';

  const [activeTab, setActiveTab] = useState<ProjectOutcome | 'all'>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [lossModalProject, setLossModalProject] = useState<Project | null>(null);
  const [lossReasonInput, setLossReasonInput] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  // Helper to compute selling price of a project
  const getProjectSellingPrice = (p: Project) => {
    const quotes = customerQuotations.filter((q) => q.projectId === p.id);
    if (quotes.length > 0) {
      return quotes.reduce((sum, q) => sum + (q.totals?.customerSellingPrice || 0), 0);
    }
    return p.budget || 0;
  };

  // Group projects by normalized outcome status
  const stats = useMemo(() => {
    let wonCount = 0;
    let wonValue = 0;
    let underPricingCount = 0;
    let underPricingValue = 0;
    let lostCount = 0;
    let lostValue = 0;

    projects.forEach((p) => {
      const outcome = computeAutomatedAwardStatus(p, { customerQuotations, purchaseOrders });
      const val = getProjectSellingPrice(p);

      if (outcome === 'Won') {
        wonCount++;
        wonValue += val;
      } else if (outcome === 'Lost') {
        lostCount++;
        lostValue += val;
      } else {
        underPricingCount++;
        underPricingValue += val;
      }
    });

    const totalCount = projects.length || 1;
    const totalValue = wonValue + underPricingValue + lostValue;
    const closedProjects = wonCount + lostCount;
    const winRate = closedProjects > 0 ? (wonCount / closedProjects) * 100 : (wonCount / totalCount) * 100;

    return {
      totalCount: projects.length,
      totalValue,
      wonCount,
      wonValue,
      underPricingCount,
      underPricingValue,
      lostCount,
      lostValue,
      winRate,
    };
  }, [projects, customerQuotations]);

  // Filtered projects list
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const outcome = computeAutomatedAwardStatus(p, { customerQuotations, purchaseOrders });
      if (activeTab !== 'all' && outcome !== activeTab) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchNum = p.projectNumber.toLowerCase().includes(q);
        const matchClient = (p.customerName || '').toLowerCase().includes(q);
        const matchLoss = (p.lossReason || '').toLowerCase().includes(q);
        return matchName || matchNum || matchClient || matchLoss;
      }

      return true;
    });
  }, [projects, activeTab, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#007A5A] dark:text-emerald-400 hover:text-[#0c6b4f] mb-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{isEn ? 'Back to Main Dashboard' : 'العودة إلى لوحة التحكم الرئيسية (Back to Dashboard)'}</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <PieChart className="w-6 h-6 text-[#007A5A] dark:text-emerald-400" />
            <span>{isEn ? 'Projects Status Master Breakdown' : 'تفاصيل حالات كافة المشاريع (Projects Status Master Breakdown)'}</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isEn
              ? 'Comprehensive analysis of all pipeline projects categorized by Won, Under Pricing, and Lost with documented root causes.'
              : 'تحليل شامل ومفصل لجميع المشاريع المقيدة في المنظومة ومصنفة حسب: فزت فيه، قيد التسعير، وخسرته مع توضيح أسباب الخسارة.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="px-4 py-2 text-xs font-bold bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg transition cursor-pointer shadow-xs flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>{isEn ? 'Print Official Award Report' : 'طباعة تقرير الترسية الرسمي (Print Report)'}</span>
          </button>
        </div>
      </div>

      {/* 4 Status KPI Cards with Click-to-Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        {/* All Projects Card */}
        <div
          onClick={() => setActiveTab('all')}
          className={`p-4 rounded-xl border transition cursor-pointer shadow-xs ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20'
              : 'bg-white dark:bg-slate-900 hover:border-slate-400 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {isEn ? 'All Projects (Total)' : 'كافة المشاريع (Total)'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
              100%
            </span>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.totalCount}</div>
          <div className={`text-xs font-mono font-bold mt-1 ${activeTab === 'all' ? 'text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {stats.totalValue.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
          </div>
          <div className={`text-[11px] mt-2 pt-2 border-t ${activeTab === 'all' ? 'border-white/10 text-slate-300' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
            {isEn ? 'Current Win Rate: ' : 'نسبة الفوز الحالية: '}
            <span className="font-bold text-emerald-500">{stats.winRate.toFixed(1)}%</span>
          </div>
        </div>

        {/* Won Projects Card */}
        <div
          onClick={() => setActiveTab('Won')}
          className={`p-4 rounded-xl border transition cursor-pointer shadow-xs ${
            activeTab === 'Won'
              ? 'bg-emerald-800 text-white border-emerald-800 ring-2 ring-emerald-600/30'
              : 'bg-white dark:bg-slate-900 hover:border-emerald-400 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Trophy className={`w-4 h-4 ${activeTab === 'Won' ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={`text-xs font-bold ${activeTab === 'Won' ? 'text-emerald-100' : 'text-emerald-900 dark:text-emerald-300'}`}>
                {isEn ? 'Won / Awarded' : 'فزت فيه (Won)'}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'Won' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'}`}>
              {stats.totalCount ? Math.round((stats.wonCount / stats.totalCount) * 100) : 0}%
            </span>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.wonCount}</div>
          <div className={`text-xs font-mono font-bold mt-1 ${activeTab === 'Won' ? 'text-emerald-200' : 'text-emerald-700 dark:text-emerald-400'}`}>
            {stats.wonValue.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
          </div>
          <div className={`text-[11px] mt-2 pt-2 border-t ${activeTab === 'Won' ? 'border-white/10 text-emerald-200' : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {isEn ? 'Awarded & Contracted Projects' : 'مشاريع تم الفوز بها وتعميدها رسمياً'}
          </div>
        </div>

        {/* Under Pricing Card */}
        <div
          onClick={() => setActiveTab('Under Pricing')}
          className={`p-4 rounded-xl border transition cursor-pointer shadow-xs ${
            activeTab === 'Under Pricing'
              ? 'bg-amber-700 text-white border-amber-700 ring-2 ring-amber-500/30'
              : 'bg-white dark:bg-slate-900 hover:border-amber-400 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className={`w-4 h-4 ${activeTab === 'Under Pricing' ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400'}`} />
              <span className={`text-xs font-bold ${activeTab === 'Under Pricing' ? 'text-amber-100' : 'text-amber-900 dark:text-amber-300'}`}>
                {isEn ? 'Under Pricing' : 'قيد التسعير (Under Pricing)'}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'Under Pricing' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'}`}>
              {stats.totalCount ? Math.round((stats.underPricingCount / stats.totalCount) * 100) : 0}%
            </span>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.underPricingCount}</div>
          <div className={`text-xs font-mono font-bold mt-1 ${activeTab === 'Under Pricing' ? 'text-amber-200' : 'text-amber-700 dark:text-amber-400'}`}>
            {stats.underPricingValue.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
          </div>
          <div className={`text-[11px] mt-2 pt-2 border-t ${activeTab === 'Under Pricing' ? 'border-white/10 text-amber-200' : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {isEn ? 'Active Estimates & Follow-ups' : 'عروض أسعار جارية ومتابعة مع العملاء'}
          </div>
        </div>

        {/* Lost Projects Card */}
        <div
          onClick={() => setActiveTab('Lost')}
          className={`p-4 rounded-xl border transition cursor-pointer shadow-xs ${
            activeTab === 'Lost'
              ? 'bg-red-800 text-white border-red-800 ring-2 ring-red-600/30'
              : 'bg-white dark:bg-slate-900 hover:border-red-400 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <XCircle className={`w-4 h-4 ${activeTab === 'Lost' ? 'text-red-300' : 'text-red-600 dark:text-red-400'}`} />
              <span className={`text-xs font-bold ${activeTab === 'Lost' ? 'text-red-100' : 'text-red-900 dark:text-red-300'}`}>
                {isEn ? 'Lost' : 'خسرته (Lost)'}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'Lost' ? 'bg-white/20 text-white' : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'}`}>
              {stats.totalCount ? Math.round((stats.lostCount / stats.totalCount) * 100) : 0}%
            </span>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">{stats.lostCount}</div>
          <div className={`text-xs font-mono font-bold mt-1 ${activeTab === 'Lost' ? 'text-red-200' : 'text-red-700 dark:text-red-400'}`}>
            {stats.lostValue.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
          </div>
          <div className={`text-[11px] mt-2 pt-2 border-t ${activeTab === 'Lost' ? 'border-white/10 text-red-200' : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {isEn ? 'Lost Projects with Documented Reasons' : 'مشاريع خاسرة مع أسباب مسجلة'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 dark:bg-slate-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {isEn ? `All Projects (${stats.totalCount})` : `كافة المشاريع (${stats.totalCount})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Won')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'Won'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>{isEn ? `Won (${stats.wonCount})` : `فزت فيه (${stats.wonCount})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Under Pricing')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'Under Pricing'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isEn ? `Under Pricing (${stats.underPricingCount})` : `قيد التسعير (${stats.underPricingCount})`}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('Lost')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'Lost'
                ? 'bg-red-700 text-white'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 hover:bg-red-100'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{isEn ? `Lost (${stats.lostCount})` : `خسرته (${stats.lostCount})`}</span>
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute rtl:right-3 ltr:left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEn ? 'Search by project #, client, or reason...' : 'بحث برقم المشروع، العميل، أو سبب الخسارة...'}
            className="w-full rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:border-[#007A5A] focus:bg-white dark:focus:bg-slate-700 text-slate-900 dark:text-white transition"
          />
        </div>
      </div>

      {/* Projects List / Table */}
      <div className="space-y-3">
        {filteredProjects.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {isEn ? 'No projects match this filter' : 'لا توجد مشاريع مطابقة لهذا الفلتر'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isEn ? 'Try changing the filter or search keywords.' : 'جرب تغيير الفلتر أو مسح البحث أعلاه.'}
            </p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const outcome = computeAutomatedAwardStatus(project, { customerQuotations, purchaseOrders });
            const statusConfig = PROJECT_STATUS_CONFIG[outcome];
            const sellingPrice = getProjectSellingPrice(project);

            return (
              <div
                key={project.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition p-5 space-y-4"
              >
                {/* Header line */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                      {project.projectNumber}
                    </span>
                    <div>
                      <h3
                        onClick={() => onSelectProject(project.id)}
                        className="text-base font-bold text-slate-900 dark:text-white hover:text-[#007A5A] dark:hover:text-emerald-400 cursor-pointer transition"
                      >
                        {project.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {project.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {project.location}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Automated Status Badge & Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1 text-xs font-bold">
                      <span className={`flex items-center gap-1 ${statusConfig.badgeClass} px-2.5 py-0.5 rounded-full text-xs font-bold`}>
                        {outcome === 'Won' && <Trophy className="w-3.5 h-3.5" />}
                        {outcome === 'Under Pricing' && <Clock className="w-3.5 h-3.5" />}
                        {outcome === 'Lost' && <XCircle className="w-3.5 h-3.5" />}
                        <span>{statusConfig.labelAr}</span>
                      </span>
                    </div>

                    {outcome !== 'Won' && (
                      <button
                        type="button"
                        onClick={() => {
                          setLossModalProject(project);
                          setLossReasonInput(project.lossReason || '');
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-rose-600 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 transition cursor-pointer"
                        title="إغلاق المناقصة لصالح طرف آخر أو إلغاء الترسية"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500 inline ml-1" />
                        <span>تسجيل خسارة</span>
                      </button>
                    )}

                    <button
                      type="button"
                      title={isEn ? 'Delete Project' : 'حذف المشروع'}
                      onClick={() => setProjectToDelete(project)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Systems & Financials */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(project.systems || project.selectedSystems || []).map((sys, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                      >
                        {sys}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="rtl:text-left ltr:text-right">
                      <span className="text-[10px] text-slate-400 block">
                        {isEn ? 'Selling Value' : 'قيمة العرض / البيع'}
                      </span>
                      <span className="font-mono font-bold text-sm text-[#007A5A] dark:text-emerald-400">
                        {sellingPrice.toLocaleString()} {isEn ? 'SAR' : 'ر.س'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-[#007A5A] hover:text-white rounded-lg text-slate-700 dark:text-slate-300 transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isEn ? 'View Details' : 'عرض تفاصيل المشروع'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Specific Loss Reason Box for Lost Projects */}
                {outcome === 'Lost' && (
                  <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-red-900 dark:text-red-300 block mb-0.5">
                          {isEn ? 'Reason for Loss:' : 'سبب خسارة المشروع (Reason for Loss):'}
                        </span>
                        <p className="text-red-800 dark:text-red-200 leading-relaxed">
                          {project.lossReason ? (
                            project.lossReason
                          ) : (
                            <span className="italic text-red-500">
                              {isEn ? 'No loss reason recorded yet. Click button to document.' : 'لم يتم تدوين سبب الخسارة بعد. اضغط على الزر لكتابة السبب.'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onRequestEditLossReason) {
                          onRequestEditLossReason(project);
                        } else {
                          setLossModalProject(project);
                          setLossReasonInput(project.lossReason || '');
                        }
                      }}
                      className="px-3 py-1 text-xs font-semibold bg-white dark:bg-slate-800 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 rounded-lg shrink-0 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-center"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>
                        {project.lossReason
                          ? (isEn ? 'Edit Loss Reason' : 'تعديل سبب الخسارة')
                          : (isEn ? 'Add Loss Reason' : 'إضافة سبب الخسارة')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Loss Reason Modal */}
      {lossModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? 'Record / Edit Project Loss Reason' : 'تسجيل / تعديل سبب خسارة المشروع'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isEn ? 'Project: ' : 'مشروع: '}
              <strong className="text-slate-900 dark:text-white font-bold">{lossModalProject.name}</strong>
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {isEn ? 'Loss Reason / Post-Mortem Analysis:' : 'سبب الخسارة (Loss Reason / Analysis):'}
              </label>
              <textarea
                rows={3}
                value={lossReasonInput}
                onChange={(e) => setLossReasonInput(e.target.value)}
                placeholder={isEn ? 'Enter loss reason (e.g. price was higher than competitor, payment terms mismatch...)' : 'أدخل سبب خسارة المنافسة (مثل: السعر مرتفع مقارنة بالمنافس، عدم توافق شروط الدفع...)'}
                className="w-full p-2.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg outline-none focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLossModalProject(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                {isEn ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateProjectStatus(lossModalProject.id, 'Lost', lossReasonInput);
                  setLossModalProject(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer shadow-xs"
              >
                {isEn ? 'Save Loss Reason' : 'حفظ وتسجيل سبب الخسارة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div
          id="delete-breakdown-project-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? 'Confirm Project Deletion' : 'تأكيد حذف المشروع نهائياً'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isEn
                ? `Are you sure you want to permanently delete "${projectToDelete.name}" (${projectToDelete.projectNumber})?`
                : `هل أنت متأكد من حذف المشروع "${projectToDelete.name}" (${projectToDelete.projectNumber})؟`}
              <br />
              <span className="text-red-600 font-semibold block mt-1.5">
                {isEn
                  ? 'Warning: All linked quotations and POs will be removed while preserving customer records.'
                  : 'تنبيه: سيتم إلغاء كافة المبالغ وعروض الأسعار وأوامر الشراء المرتبطة بهذا المشروع مع الإبقاء الكامل على بيانات العميل في دليل العملاء.'}
              </span>
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                {isEn ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProject(projectToDelete.id);
                  setProjectToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer shadow-xs"
              >
                {isEn ? 'Confirm Deletion' : 'تأكيد الحذف والإلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Printable Status & Tendering Report Modal */}
      {showReportModal && (
        <ProjectStatusReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          projects={projects}
          customerQuotations={customerQuotations}
        />
      )}
    </div>
  );
};
