import React, { useState, useMemo, useEffect } from 'react';
import {
  Project,
  CustomerQuotation,
  SupplierQuotation,
  TermsLibraryItem,
  SYSTEM_DEFINITIONS,
  getSystemMeta,
  SystemDiscipline,
} from '../types';
import {
  Briefcase,
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  Building2,
  Layers,
  Sparkles,
  Upload,
  AlertCircle,
  FolderOpen,
  ChevronDown,
  Calendar,
  DollarSign,
  TrendingUp,
  Tag,
  Copy,
  FileSpreadsheet,
  FileCheck,
} from 'lucide-react';
import { CustomerQuotationEditor } from './CustomerQuotationEditor';
import { ErrorBoundary } from './ErrorBoundary';
import { PrepareCustomerQuotationModal } from './PrepareCustomerQuotationModal';
import { CommercialProposalPrint } from './CommercialProposalPrint';
import { getNormalizedProjectStatus } from '../utils/projectStatusUtils';
import { useSettings } from '../context/SettingsContext';

interface QuotationsViewProps {
  projects: Project[];
  customerQuotations: CustomerQuotation[];
  supplierQuotations: SupplierQuotation[];
  termsLibrary: TermsLibraryItem[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  selectedQuotationId: string | null;
  onSelectQuotation: (quotationId: string) => void;
  onSaveQuotation: (updatedQuotation: CustomerQuotation) => void;
  onCreateNewVersion: (updatedQuotation: CustomerQuotation, changeNotes: string) => void;
  onIssueCustomerQuotation: (quotation: CustomerQuotation) => void;
  onDeleteCustomerQuotation?: (quotationId: string) => void;
  onDeleteSupplierQuotation?: (supplierQuoteId: string) => void;
  onOpenUploadSupplierModal?: (projectId: string) => void;
}

export const QuotationsView: React.FC<QuotationsViewProps> = ({
  projects,
  customerQuotations,
  supplierQuotations,
  termsLibrary,
  selectedProjectId,
  onSelectProject,
  selectedQuotationId,
  onSelectQuotation,
  onSaveQuotation,
  onCreateNewVersion,
  onIssueCustomerQuotation,
  onDeleteCustomerQuotation,
  onDeleteSupplierQuotation,
  onOpenUploadSupplierModal,
}) => {
  const { settings } = useSettings();
  const isEn = settings.language === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'with_quotes' | 'pending_quotes'>('all');
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [showProposalPrint, setShowProposalPrint] = useState(false);
  const [deleteTargetQuotation, setDeleteTargetQuotation] = useState<CustomerQuotation | null>(null);
  const [supplierQuoteToDelete, setSupplierQuoteToDelete] = useState<SupplierQuotation | null>(null);

  // Active Project resolution
  const activeProject = useMemo(() => {
    if (selectedProjectId) {
      const found = projects.find((p) => p.id === selectedProjectId);
      if (found) return found;
    }
    // Default to first project if available
    return projects[0] || null;
  }, [projects, selectedProjectId]);

  // Sync selectedProjectId if not set
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      onSelectProject(projects[0].id);
    }
  }, [selectedProjectId, projects, onSelectProject]);

  // Quotations belonging to the active project
  const projectQuotations = useMemo(() => {
    if (!activeProject) return [];
    return customerQuotations.filter((q) => q.projectId === activeProject.id);
  }, [customerQuotations, activeProject]);

  // Active Quotation for the active project
  const activeQuotation = useMemo(() => {
    if (projectQuotations.length === 0) return null;
    if (selectedQuotationId) {
      const match = projectQuotations.find((q) => q.id === selectedQuotationId);
      if (match) return match;
    }
    // If current selectedQuotationId is not in this project, default to the latest/first quote of this project
    return projectQuotations[0];
  }, [projectQuotations, selectedQuotationId]);

  // Supplier quotations linked to active project
  const projectSupplierQuotes = useMemo(() => {
    if (!activeProject) return [];
    return supplierQuotations.filter((sq) => sq.projectId === activeProject.id);
  }, [supplierQuotations, activeProject]);

  // Filtered projects list based on search and status
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (p?.name ?? '').toLowerCase().includes(query) ||
        (p?.projectNumber ?? '').toLowerCase().includes(query) ||
        (p?.customerName ?? '').toLowerCase().includes(query) ||
        (p?.systems ?? []).some((s) => {
          const m = getSystemMeta(s);
          return m?.nameAr?.toLowerCase()?.includes(query) || m?.nameEn?.toLowerCase()?.includes(query);
        });

      const quotesCount = customerQuotations.filter((q) => q.projectId === p.id).length;

      let matchesStatus = true;
      if (statusFilter === 'with_quotes') {
        matchesStatus = quotesCount > 0;
      } else if (statusFilter === 'pending_quotes') {
        matchesStatus = quotesCount === 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [projects, customerQuotations, searchQuery, statusFilter]);

  // Summary Metrics
  const totalProjectsCount = projects.length;
  const projectsWithQuotesCount = useMemo(() => {
    const pIdsWithQuotes = new Set(customerQuotations.map((q) => q.projectId).filter(Boolean));
    return projects.filter((p) => pIdsWithQuotes.has(p.id)).length;
  }, [projects, customerQuotations]);

  const totalQuotedSum = useMemo(() => {
    return customerQuotations.reduce((sum, q) => sum + (q.totals?.customerSellingPrice || 0), 0);
  }, [customerQuotations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Metrics Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#007A5A] flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>{isEn ? 'Customer Quotations & BOQ' : 'عروض الأسعار وجداول الكميات'}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#007A5A] font-bold">
                  {customerQuotations.length} {isEn ? 'Priced Quotes' : 'عروض مسعرة'}
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEn
                  ? 'Select a project to view details, price Bill of Quantities (BOQ), and issue customer quotations.'
                  : 'حدد المشروع من القائمة لعرض تفاصيله، تسعير جداول الكميات (BOQ)، وإصدار وتعديل عروض الأسعار'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeProject && (
              <button
                type="button"
                onClick={() => setShowPrepareModal(true)}
                className="px-4 py-2.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Prepare New Quotation' : 'إعداد عرض سعر جديد للمشروع المحدد'}</span>
              </button>
            )}

            {activeProject && onOpenUploadSupplierModal && (
              <button
                type="button"
                onClick={() => onOpenUploadSupplierModal(activeProject.id)}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>{isEn ? 'Upload Supplier Quote' : 'رفع تسعيرة مورد'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-500 block text-[11px]">{isEn ? 'Total Projects' : 'إجمالي المشاريع'}</span>
            <span className="text-base font-bold text-slate-900 font-mono">{totalProjectsCount}</span>
          </div>
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100/60">
            <span className="text-emerald-700 block text-[11px]">{isEn ? 'Projects with Priced Quotes' : 'مشاريع لها عروض مسعرة'}</span>
            <span className="text-base font-bold text-emerald-800 font-mono">{projectsWithQuotesCount}</span>
          </div>
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100/60">
            <span className="text-amber-700 block text-[11px]">{isEn ? 'Projects Pending Pricing' : 'مشاريع بانتظار التسعير'}</span>
            <span className="text-base font-bold text-amber-800 font-mono">
              {totalProjectsCount - projectsWithQuotesCount}
            </span>
          </div>
          <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-100/60">
            <span className="text-teal-700 block text-[11px]">{isEn ? 'Total Quoted Value' : 'إجمالي قيمة العروض'}</span>
            <span className="text-base font-bold text-teal-800 font-mono">
              {totalQuotedSum.toLocaleString()} SAR
            </span>
          </div>
        </div>
      </div>

      {/* Projects Selection Bar / Carousel */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#007A5A]" />
            <h2 className="text-sm font-bold text-slate-900">
              {isEn ? 'Projects Selection & Overview:' : 'قائمة المشاريع للاختيار والعرض:'}
            </h2>
            <span className="text-[11px] text-slate-500">
              {isEn ? '(Click any project to view its quotations & BOQ)' : '(انقر على أي مشروع لعرض عروضه وجدول كمياته أدناه)'}
            </span>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute rtl:right-3 ltr:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={isEn ? 'Search projects...' : 'بحث في المشاريع...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rtl:pr-8 rtl:pl-3 ltr:pl-8 ltr:pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#007A5A] outline-none w-48 sm:w-60 transition"
              />
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isEn ? `All (${projects.length})` : `الكل (${projects.length})`}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('with_quotes')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  statusFilter === 'with_quotes'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isEn ? `Priced (${projectsWithQuotesCount})` : `مسعرة (${projectsWithQuotesCount})`}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending_quotes')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                  statusFilter === 'pending_quotes'
                    ? 'bg-white text-amber-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isEn ? `Pending (${projects.length - projectsWithQuotesCount})` : `قيد التسعير (${projects.length - projectsWithQuotesCount})`}
              </button>
            </div>
          </div>
        </div>

        {/* Project Cards Selector Grid / Scroll */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
            {isEn ? 'No projects match your current search' : 'لا توجد مشاريع مطابقة لبحثك الحالي'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {filteredProjects.map((p) => {
              const isSelected = activeProject?.id === p.id;
              const quotes = customerQuotations.filter((q) => q.projectId === p.id);
              const outcome = getNormalizedProjectStatus(p.status);

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p.id);
                    if (quotes.length > 0) {
                      onSelectQuotation(quotes[0].id);
                    }
                  }}
                  className={`p-3.5 rounded-xl border rtl:text-right ltr:text-left transition cursor-pointer relative group flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#007A5A] bg-emerald-50/50 shadow-xs ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            outcome === 'Won'
                              ? 'bg-emerald-500'
                              : outcome === 'Lost'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        <span className="text-[11px] font-mono text-slate-400 font-semibold">
                          {p.projectNumber}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          outcome === 'Won'
                            ? 'bg-emerald-100 text-emerald-800'
                            : outcome === 'Lost'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isEn
                          ? (outcome === 'Won' ? 'Won' : outcome === 'Lost' ? 'Lost' : 'Under Pricing')
                          : (outcome === 'Won' ? 'فزت فيه' : outcome === 'Lost' ? 'خسرته' : 'قيد التسعير')}
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`text-sm font-bold truncate transition ${
                          isSelected ? 'text-[#007A5A]' : 'text-slate-800 group-hover:text-[#007A5A]'
                        }`}
                      >
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{p.customerName}</span>
                      </p>
                    </div>

                    {/* Systems Tags */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(p?.systems ?? []).slice(0, 3).map((sys) => {
                        const def = getSystemMeta(sys);
                        return (
                          <span
                            key={sys}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                          >
                            {isEn ? (def?.nameEn ?? sys) : (def?.nameAr ?? sys)}
                          </span>
                        );
                      })}
                      {(p?.systems ?? []).length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                          +{(p?.systems ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quotations Indicator */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    {quotes.length > 0 ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{quotes.length} {isEn ? (quotes.length === 1 ? 'Quote' : 'Quotes') : 'عرض مسعر'}</span>
                        <span className="font-mono text-slate-500 text-[10px]">
                          ({quotes[0].totals?.customerSellingPrice.toLocaleString()} SAR)
                        </span>
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{isEn ? 'No Quote Yet' : 'لا يوجد عرض بعد'}</span>
                      </span>
                    )}

                    {isSelected && (
                      <span className="text-[10px] font-bold text-[#007A5A] bg-emerald-100/70 px-2 py-0.5 rounded">
                        {isEn ? 'Selected' : 'المحدد حالياً'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Project Overview & Data Section */}
      {activeProject ? (
        <div className="space-y-6">
          {/* Active Project Banner */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {activeProject.projectNumber}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      getNormalizedProjectStatus(activeProject.status) === 'Won'
                        ? 'bg-emerald-100 text-emerald-800'
                        : getNormalizedProjectStatus(activeProject.status) === 'Lost'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isEn
                      ? (getNormalizedProjectStatus(activeProject.status) === 'Won'
                          ? 'Won Project'
                          : getNormalizedProjectStatus(activeProject.status) === 'Lost'
                          ? 'Lost Project'
                          : 'Under Pricing Project')
                      : (getNormalizedProjectStatus(activeProject.status) === 'Won'
                          ? 'مشروع فزت فيه'
                          : getNormalizedProjectStatus(activeProject.status) === 'Lost'
                          ? 'مشروع خسرته'
                          : 'مشروع قيد التسعير')}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {isEn ? `Location: ${activeProject.location || 'Unspecified'}` : `الموقع: ${activeProject.location || 'غير محدد'}`}
                  </span>
                </div>

                <h2 className="text-xl font-black text-slate-900">{activeProject.name}</h2>
                <p className="text-xs text-slate-600 flex items-center gap-2">
                  <span>{isEn ? 'Client: ' : 'العميل: '}<strong className="text-slate-800">{activeProject.customerName}</strong></span>
                  {activeProject.projectManager && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>{isEn ? 'Project Manager: ' : 'مسؤول المشروع: '}<strong className="text-slate-800">{activeProject.projectManager}</strong></span>
                    </>
                  )}
                  {activeProject.budget && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>{isEn ? 'Est. Budget: ' : 'الميزانية التقديرية: '}<strong className="text-[#007A5A] font-mono">{activeProject.budget.toLocaleString()} SAR</strong></span>
                    </>
                  )}
                </p>
              </div>

              {/* Version switcher & Action bar for this project */}
              <div className="flex flex-wrap items-center gap-2">
                {projectQuotations.length > 0 && (
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                    <span className="text-[11px] font-bold text-slate-500 px-2">{isEn ? 'Version:' : 'الإصدار:'}</span>
                    {projectQuotations.map((q) => {
                      const isQuoteActive = activeQuotation?.id === q.id;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => onSelectQuotation(q.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            isQuoteActive
                              ? 'bg-[#007A5A] text-white shadow-2xs'
                              : 'bg-white text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <span>{q.quotationNumber}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              isQuoteActive ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            V{q.version}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowProposalPrint(true)}
                  className="px-3.5 py-2 bg-[#102a43] hover:bg-[#1e3a8a] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title={isEn ? 'Print Corporate Proposal (4-Page Official Standard)' : 'طباعة العرض التجاري المعتمد (نموذج الـ 4 صفحات الرسمي)'}
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isEn ? 'Commercial Proposal (4 Pages)' : 'العرض التجاري المعتمد (4 صفحات)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrepareModal(true)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#007A5A] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title={isEn ? 'Create new quotation version or BOQ' : 'إنشاء عرض سعر / تسعير BOQ جديد لهذا المشروع'}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? '+ New Version / Quote' : '+ إصدار / عرض جديد'}</span>
                </button>

                {activeQuotation && onDeleteCustomerQuotation && (
                  <button
                    type="button"
                    onClick={() => setDeleteTargetQuotation(activeQuotation)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title={isEn ? 'Delete this quotation' : 'حذف هذا العرض وأرشفة أصنافه'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Systems badges & Scope */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                {isEn ? 'Required Systems in Project:' : 'الأنظمة المطلوبة بالمشروع:'}
              </span>
              {(activeProject?.systems ?? []).map((sys) => {
                const def = getSystemMeta(sys);
                return (
                  <span
                    key={sys}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium border border-slate-200"
                  >
                    {isEn ? (def?.nameEn ?? sys) : (def?.nameAr ?? sys)}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Main Content Area: Editor or Empty State */}
          {activeQuotation ? (
            <div className="space-y-4">
              {/* Quick Summary Pill Bar */}
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-emerald-900">
                    {isEn
                      ? `Active Quotation: ${activeQuotation.quotationNumber} (V${activeQuotation.version})`
                      : `عرض السعر النشط: ${activeQuotation.quotationNumber} (إصدار V${activeQuotation.version})`}
                  </span>
                  <span className="text-emerald-700 font-mono">
                    {isEn ? 'Date: ' : 'التاريخ: '}
                    {new Date(activeQuotation.date).toLocaleDateString(isEn ? 'en-US' : 'ar-SA')}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-500 rtl:ml-1 ltr:mr-1">{isEn ? 'Total Cost:' : 'إجمالي التكلفة:'}</span>
                    <strong className="font-mono text-slate-800">
                      {activeQuotation.totals.totalProjectCost.toLocaleString()} SAR
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 rtl:ml-1 ltr:mr-1">{isEn ? 'Client Price:' : 'سعر البيع للعميل:'}</span>
                    <strong className="font-mono text-[#007A5A] text-sm">
                      {activeQuotation.totals.customerSellingPrice.toLocaleString()} SAR
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 rtl:ml-1 ltr:mr-1">{isEn ? 'Gross Margin:' : 'هامش الربح:'}</span>
                    <strong className="font-mono text-teal-700">
                      {activeQuotation.totals.grossMarginPercent.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* Comprehensive Quotation Editor with Localized Error Boundary */}
              <ErrorBoundary fallbackTitle={isEn ? 'Quotation Editor Error' : 'خطأ في محرر عروض الأسعار'}>
                <CustomerQuotationEditor
                  key={`${activeProject.id}-${activeQuotation.id}-${activeQuotation.version}`}
                  quotation={activeQuotation}
                  termsLibrary={termsLibrary}
                  onSaveQuotation={onSaveQuotation}
                  onCreateNewVersion={onCreateNewVersion}
                  onBack={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </ErrorBoundary>
            </div>
          ) : (
            /* Empty State: Project has no Customer Quotation yet */
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center space-y-6">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#007A5A] flex items-center justify-center mx-auto shadow-xs">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">
                  {isEn
                    ? `No quotation currently priced for project "${activeProject.name}"`
                    : `لا يوجد عرض سعر مسعر حالياً لمشروع "${activeProject.name}"`}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isEn
                    ? 'You can now price the Bill of Quantities (BOQ), add supply & installation items, set profit margins, and issue the commercial quotation.'
                    : 'يمكنك الآن تسعير جدول الكميات (BOQ)، وإضافة بنود التوريد والتركيب، وتحديد هوامش الربح وإصدار العرض المالي والفني للعميل.'}
                </p>

                {/* Show linked supplier quotes if any */}
                {projectSupplierQuotes.length > 0 && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 rtl:text-right ltr:text-left space-y-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#007A5A]" />
                      {isEn ? 'Supplier Quotations Registered for this Project:' : 'تسعيرات الموردين المسجلة لهذا المشروع:'}
                    </span>
                    <div className="space-y-1.5">
                      {projectSupplierQuotes.map((sq) => (
                        <div
                          key={sq.id}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{sq.supplierName}</span>
                            <span className="text-[10px] text-slate-500 block">({sq.systemType})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[#007A5A] font-bold">
                              {sq.totalAmount.toLocaleString()} SAR
                            </span>
                            {onDeleteSupplierQuotation && (
                              <button
                                type="button"
                                onClick={() => setSupplierQuoteToDelete(sq)}
                                className="p-1 hover:bg-rose-50 text-rose-600 rounded transition cursor-pointer"
                                title={isEn ? 'Delete this quotation' : 'حذف هذه التسعيرة'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPrepareModal(true)}
                    className="px-6 py-3 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isEn ? 'Prepare & Price Quotation (BOQ)' : 'إعداد وتسعير عرض السعر وجدول الكميات (BOQ)'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-bold">{isEn ? 'No project selected' : 'لم يتم تحديد أي مشروع'}</p>
          <p className="text-xs text-slate-400 mt-1">{isEn ? 'Please select a project from the list above' : 'الرجاء اختيار مشروع من القائمة أعلاه'}</p>
        </div>
      )}

      {/* Prepare Customer Quotation Modal */}
      {showPrepareModal && activeProject && (
        <PrepareCustomerQuotationModal
          isOpen={showPrepareModal}
          onClose={() => setShowPrepareModal(false)}
          project={activeProject}
          supplierQuotations={supplierQuotations}
          existingQuotations={customerQuotations}
          termsLibrary={termsLibrary}
          onQuotationIssued={(newQuote) => {
            onIssueCustomerQuotation(newQuote);
            setShowPrepareModal(false);
            onSelectQuotation(newQuote.id);
          }}
        />
      )}

      {/* Delete Quotation Confirmation Modal */}
      {deleteTargetQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isEn ? 'Confirm Delete Quotation & BOQ' : 'تأكيد حذف عرض السعر وجدول الكميات'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEn ? 'Archive items to Priced Items Bank' : 'حذف العرض مع أرشفة أصنافه لبنك الأصناف المسعرة'}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
              <p className="font-bold text-slate-900">
                {isEn ? 'Are you sure you want to delete the following quotation?' : 'هل أنت متأكد من رغبتك في حذف عرض السعر التالي؟'}
              </p>
              <p className="text-sm font-bold text-rose-800 font-mono">
                {deleteTargetQuotation.quotationNumber} — {deleteTargetQuotation.projectName}
              </p>
              <p className="text-slate-600">
                {isEn ? 'Client: ' : 'العميل: '}<span className="font-semibold text-slate-800">{deleteTargetQuotation.customerName || deleteTargetQuotation.clientName}</span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-rose-200/60">
                {isEn
                  ? 'The quotation will be removed from view, and all priced items will be automatically preserved in the Priced Items Bank.'
                  : 'سيتم إخفاء العرض من القائمة، مع حفظ كافة أصنافه المسعرة تلقائياً بصفحة "الأصناف المسعرة" داخل أوامر الشراء.'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetQuotation(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                {isEn ? 'Cancel' : 'تراجع'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCustomerQuotation) {
                    onDeleteCustomerQuotation(deleteTargetQuotation.id);
                  }
                  setDeleteTargetQuotation(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isEn ? 'Yes, Delete Quotation' : 'نعم، حذف العرض'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Supplier Quotation Confirmation Modal */}
      {supplierQuoteToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          dir={isEn ? 'ltr' : 'rtl'}
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isEn ? 'Confirm Delete Supplier Quotation' : 'تأكيد حذف تسعيرة المورد'}
                </h3>
                <p className="text-xs text-slate-500">Delete Supplier Quotation</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{isEn ? 'Supplier Name:' : 'اسم المورد:'}</span>
                <span className="font-bold text-slate-900">{supplierQuoteToDelete.supplierName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{isEn ? 'Quotation Number:' : 'رقم التسعيرة:'}</span>
                <span className="font-mono font-semibold text-slate-700">
                  {supplierQuoteToDelete.quotationNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{isEn ? 'Total Amount:' : 'إجمالي المبلغ:'}</span>
                <span className="font-mono font-bold text-[#007A5A]">
                  {supplierQuoteToDelete.totalAmount.toLocaleString()} SAR
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              {isEn
                ? 'Are you sure you want to delete this supplier quotation? It will be unlinked and all items will be archived in the Priced Items Bank.'
                : 'هل أنت متأكد من رغبتك في حذف تسعيرة المورد هذه؟ سيتم فك ارتباطها عن المشروع وحفظ كافة أصنافه المسعرة تلقائياً في صفحة "الأصناف المسعرة" داخل أوامر الشراء.'}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSupplierQuoteToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                {isEn ? 'Cancel' : 'تراجع (Cancel)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSupplierQuotation) {
                    onDeleteSupplierQuotation(supplierQuoteToDelete.id);
                  }
                  setSupplierQuoteToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isEn ? 'Yes, Delete Quotation' : 'نعم، حذف التسعيرة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Commercial Proposal 4-Page Print Modal */}
      {showProposalPrint && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <CommercialProposalPrint
            quotation={activeQuotation}
            project={activeProject}
            onClose={() => setShowProposalPrint(false)}
          />
        </div>
      )}
    </div>
  );
};
