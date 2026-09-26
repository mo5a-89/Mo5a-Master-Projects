import React, { useState, useMemo } from 'react';
import {
  PurchaseOrder,
  SupplierQuotation,
  Supplier,
  Project,
  User,
  ThreeWayMatchRecord,
  MasterItemLibraryRecord,
} from '../types';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Building,
  Calendar,
  Eye,
  Printer,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Layers,
  Sparkles,
  X,
  Check,
  Copy,
  Tag,
  Package,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { INITIAL_MASTER_ITEM_LIBRARY } from '../data/initialData';
import { executePrint } from '../utils/printUtils';
import { exportPurchaseOrderToPDF } from '../utils/purchaseOrderUtils';
import { CompanyHeader, CompanyLogo } from './CompanyHeader';
import { useSettings } from '../context/SettingsContext';
import { ProcurementSOA } from './ProcurementSOA';
import { isSuperAdmin, hasPermission } from '../utils/rbacUtils';
import { approveAndDispatchDraftPOs } from '../services/boqParserService';

export interface ProcurementHubProps {
  currentUser: User;
  purchaseOrders: PurchaseOrder[];
  supplierQuotations: SupplierQuotation[];
  suppliers: Supplier[];
  projects: Project[];
  threeWayMatches?: ThreeWayMatchRecord[];
  onOpenNewPO: (projectId?: string, supplierQuoteId?: string) => void;
  onEditPO: (po: PurchaseOrder) => void;
  onUpdatePO?: (updatedPO: PurchaseOrder) => void;
  onDeletePO?: (poId: string) => void;
  onSelectProject?: (projectId: string) => void;
  onOpenUploadSupplierQuote?: () => void;
  onSelectSupplierQuote?: (quoteId: string) => void;
  onOpenThreeWayModal?: () => void;
  onUpdateThreeWayMatch?: (record: ThreeWayMatchRecord) => void;
}

export const ProcurementHub: React.FC<ProcurementHubProps> = ({
  currentUser,
  purchaseOrders = [],
  supplierQuotations = [],
  suppliers = [],
  projects = [],
  threeWayMatches = [],
  onOpenNewPO,
  onEditPO,
  onUpdatePO,
  onDeletePO,
  onSelectProject,
  onOpenUploadSupplierQuote,
  onSelectSupplierQuote,
  onOpenThreeWayModal,
  onUpdateThreeWayMatch,
}) => {
  const { t, settings } = useSettings();
  const canApprove = useMemo(() => {
    if (!currentUser) return true;
    if (isSuperAdmin(currentUser)) return true;
    return hasPermission(currentUser, 'canApprovePO');
  }, [currentUser]);
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'supplier_quotes' | 'item_bank' | 'three_way'>('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');

  // Detail Modal States
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<SupplierQuotation | null>(null);
  const [copiedItemCode, setCopiedItemCode] = useState<string | null>(null);
  const [showSOAModal, setShowSOAModal] = useState(false);
  const [soaSupplierId, setSoaSupplierId] = useState<string>('all');

  // Filtered POs
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchesSearch =
        (po.poNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (po.supplierName || po.vendorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (po.projectName || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && (po.status || 'Issued').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (projectFilter !== 'all' && po.projectId !== projectFilter) {
        return false;
      }
      return true;
    });
  }, [purchaseOrders, searchQuery, statusFilter, projectFilter]);

  // Filtered Supplier Quotations
  const filteredQuotes = useMemo(() => {
    return supplierQuotations.filter((sq) => {
      const matchesSearch =
        (sq.quotationNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sq.supplierName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sq.projectName || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (disciplineFilter !== 'all' && sq.systemType !== disciplineFilter) {
        return false;
      }
      return true;
    });
  }, [supplierQuotations, searchQuery, disciplineFilter]);

  // Filtered Priced Items Library
  const filteredMasterItems = useMemo(() => {
    return INITIAL_MASTER_ITEM_LIBRARY.filter((it) => {
      const matchesSearch =
        (it.itemCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.descriptionAr || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.descriptionEn || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.preferredBrand || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (disciplineFilter !== 'all' && it.discipline !== disciplineFilter) {
        return false;
      }
      return true;
    });
  }, [searchQuery, disciplineFilter]);

  // Aggregate Metrics for Procurement
  const totalPOValue = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => sum + (po.grandTotal || po.totalAmount || 0), 0);
  }, [purchaseOrders]);

  const totalPOPaid = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => {
      const paid = po.paidAmount || (po.payments ? po.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0);
      return sum + paid;
    }, 0);
  }, [purchaseOrders]);

  const totalPORemaining = Math.max(0, totalPOValue - totalPOPaid);

  const matchedCount = useMemo(() => {
    return threeWayMatches.filter((m) => m.matchStatus === 'Passed' || m.matchStatus === 'Override Approved').length;
  }, [threeWayMatches]);

  const blockedCount = useMemo(() => {
    return threeWayMatches.filter((m) => m.isDisbursementBlocked || m.matchStatus === 'Discrepancy Blocked').length;
  }, [threeWayMatches]);

  const draftPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const st = String(po.status || '');
      return (
        st === 'DRAFT_PENDING_APPROVAL' ||
        st === 'DRAFT' ||
        st === 'Draft' ||
        (po.notes || '').includes('مسودة أمر شراء منشأة تلقائياً')
      );
    });
  }, [purchaseOrders]);

  const handleApproveDraftPOs = (draftPoIds: string[]) => {
    const res = approveAndDispatchDraftPOs(draftPoIds, currentUser);
    if (res.success) {
      alert(`تم اعتماد وإرسال ${res.updatedCount} أمر شراء للموردين بنجاح!`);
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('rmt_pos_updated', { detail: [] }));
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedItemCode(code);
    setTimeout(() => setCopiedItemCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. MODULE HEADER & EXECUTIVE SUMMARY CARDS                     */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t.procurementTitle || 'إدارة المشتريات وأوامر الشراء'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.procurementSubtitle || 'إدارة علاقات الموردين، أوامر الشراء الصادرة، بنك الأسعار وبوابة المطابقة الثلاثية'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSoaSupplierId('all');
              setShowSOAModal(true);
            }}
            className="h-9 px-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            <span>{t.supplierSOA}</span>
          </button>

          {onOpenUploadSupplierQuote && (
            <button
              type="button"
              onClick={onOpenUploadSupplierQuote}
              className="h-9 px-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.uploadSupplierQuote}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenNewPO()}
            className="h-9 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newPO}</span>
          </button>
        </div>
      </div>

      {/* KPI Micro Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total PO Commitments */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي أوامر الشراء المعتمدة</span>
            <div className="mt-1 text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
              {totalPOValue.toLocaleString()} <span className="text-xs font-sans text-slate-400">SAR</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">[شامل 15% ضريبة] ({purchaseOrders.length} أوامر)</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Total Paid to Vendors */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">المبالغ المسددة للموردين</span>
            <div className="mt-1 text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalPOPaid.toLocaleString()} <span className="text-xs font-sans text-slate-400">SAR</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">
              نسبة السداد: {totalPOValue > 0 ? ((totalPOPaid / totalPOValue) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Remaining Vendor Liabilities */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">مستحقات الموردين المتبقية</span>
            <div className="mt-1 text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tabular-nums">
              {totalPORemaining.toLocaleString()} <span className="text-xs font-sans text-slate-400">SAR</span>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">التزامات توريد جارية ومحجوزة</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: 3-Way Match Clearance */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">سلامة المطابقة الثلاثية</span>
            <div className="mt-1 text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
              {threeWayMatches.length > 0 ? Math.round((matchedCount / threeWayMatches.length) * 100) : 100}%
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">
              {blockedCount > 0 ? `${blockedCount} قيود محجوزة بسبب فروقات` : 'كافة السجلات سليمة ومعتمدة'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Auto-Generated PO Drafts Reactive Summary Card */}
      {draftPOs.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border border-amber-500/40 text-white p-4 sm:p-5 rounded-2xl shadow-lg space-y-3 font-sans">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-amber-300">مسودات أوامر الشراء المنشأة تلقائياً (Auto-Generated PO Drafts)</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {draftPOs.length} مسودة معلقة
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  مستخرجة تلقائياً من تفكيك مقايسات BOQ للمشاريع المعتمدة ومطابقة الموردين
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleApproveDraftPOs(draftPOs.map((p) => p.id))}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>[اعتماد وإرسال للموردين]</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {draftPOs.map((po) => {
              const totalVal = po.totalAmount || po.grandTotal || 0;
              return (
                <div key={po.id} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{po.poNumber}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{po.projectName}</span>
                    </div>
                    <div className="text-slate-300 font-medium truncate max-w-[180px]">{po.supplierName}</div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-emerald-400 font-bold block">{totalVal.toLocaleString()} SAR</span>
                    <span className="text-[9.5px] text-amber-500/80">بانتظار الاعتماد</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. SUB-NAVIGATION TABS                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('pos');
            setSearchQuery('');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'pos'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>أوامر الشراء الصادرة ({purchaseOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('supplier_quotes');
            setSearchQuery('');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'supplier_quotes'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>تسعيرات وعروض الموردين ({supplierQuotations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('item_bank');
            setSearchQuery('');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'item_bank'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>بنك المواد والمواصفات المسعرة ({INITIAL_MASTER_ITEM_LIBRARY.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveSubTab('three_way');
            setSearchQuery('');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'three_way'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>بوابة المطابقة الثلاثية (3-Way Match)</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SUB-TAB VIEWPORT CONTENT                                    */}
      {/* ------------------------------------------------------------- */}

      {/* 3.1: PURCHASE ORDERS (POS) TAB */}
      {activeSubTab === 'pos' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم أمر الشراء، المورد، أو المشروع..."
                className="w-full pr-9 pl-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">المشروع:</span>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all">كافة المشاريع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">الحالة:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="issued">صادر (Issued)</option>
                  <option value="approved">معتمد (Approved)</option>
                  <option value="draft">مسودة (Draft)</option>
                </select>
              </div>
            </div>
          </div>

          {/* POs Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">رقم أمر الشراء (PO#)</th>
                    <th className="py-3.5 px-4">المورد المعتمد</th>
                    <th className="py-3.5 px-4">المشروع المرتبط</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">القيمة الإجمالية [15% ضريبة]</th>
                    <th className="py-3.5 px-4">المدفوع / المتبقي</th>
                    <th className="py-3.5 px-4">حالة التوريد الميداني</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPOs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        لا توجد أوامر شراء تطابق البحث المحدد.
                      </td>
                    </tr>
                  ) : (
                    filteredPOs.map((po) => {
                      const grandTotal = po.grandTotal || po.totalAmount || 0;
                      const paid = po.paidAmount || (po.payments ? po.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0);
                      const remaining = Math.max(0, grandTotal - paid);
                      const isDelivered = po.deliveryStatus === 'Delivered' || po.fulfillmentStatus === 'Fully Received';

                      return (
                        <tr key={po.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => setSelectedPO(po)}
                              className="font-mono font-black text-amber-600 hover:text-amber-700 hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <span>{po.poNumber || `PO-${po.id.slice(0, 6)}`}</span>
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            </button>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {po.supplierName || po.vendorName || 'مورد معتمد'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                            {po.projectName || 'مشروع عام'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {po.date || (po as any).issueDate || '2026-09-15'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-black tabular-nums text-slate-900 dark:text-white">
                            {grandTotal.toLocaleString()} SAR
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">
                            <span className="text-emerald-600 font-bold">{paid.toLocaleString()}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-rose-600 font-bold">{remaining.toLocaleString()}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isDelivered
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
                              }`}
                            >
                              {isDelivered ? 'مستلم بالكامل' : 'قيد التوريد'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {po.status === 'Draft' && canApprove && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onUpdatePO) {
                                      onUpdatePO({
                                        ...po,
                                        status: 'Approved',
                                        approvalStatus: 'Approved',
                                        approvedBy: {
                                          name: currentUser.fullName,
                                          title: currentUser.jobTitle,
                                        },
                                        approvedAt: new Date().toISOString(),
                                      });
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  title="اعتماد أمر الشراء رسمياً وتفعيل التوريد"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>اعتماد</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedPO(po)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="معاينة تفاصيل أمر الشراء"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditPO(po)}
                                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="تعديل أمر الشراء"
                              >
                                <ShoppingBag className="w-4 h-4" />
                              </button>
                               <button
                                type="button"
                                onClick={() => {
                                  setSelectedPO(po);
                                  exportPurchaseOrderToPDF(po);
                                  executePrint('purchase-order-document', {
                                    documentTitle: `أمر شراء معتمد - ${po.poNumber}`,
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="طباعة أمر الشراء الرسمي"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {onDeletePO && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`هل أنت متأكد من رغبتك في حذف أمر الشراء ${po.poNumber}؟`)) {
                                      onDeletePO(po.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                  title="حذف أمر الشراء"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3.2: SUPPLIER QUOTATIONS TAB */}
      {activeSubTab === 'supplier_quotes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم عرض السعر، المورد، أو المشروع..."
                className="w-full pr-9 pl-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">التخصص:</span>
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                <option value="all">كافة الأنظمة</option>
                <option value="fire_fighting">مكافحة الحريق (Fire Fighting)</option>
                <option value="fire_alarm">إنذار الحريق (Fire Alarm)</option>
                <option value="hvac">التكييف والتهوية (HVAC)</option>
                <option value="plumbing">السباكة والصرف (Plumbing)</option>
                <option value="electrical">الأعمال الكهربائية (Electrical)</option>
                <option value="low_current">التيار الخفيف (Low Current)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuotes.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">لا توجد عروض أسعار موردين مطابقة</h3>
                <p className="text-xs text-slate-500 mt-1">يمكنك رفع تسعيرة مورد جديدة بصيغة Excel أو PDF لتحليلها آلياً</p>
                {onOpenUploadSupplierQuote && (
                  <button
                    type="button"
                    onClick={onOpenUploadSupplierQuote}
                    className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    رفع تسعيرة مورد جديدة
                  </button>
                )}
              </div>
            ) : (
              filteredQuotes.map((sq) => (
                <div
                  key={sq.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-amber-400 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                        {sq.quotationNumber || `SQ-${sq.id.slice(0, 6)}`}
                      </span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono">
                        {sq.date || '2026-09-10'}
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                      {sq.supplierName || 'مورد معتمد'}
                    </h3>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {sq.projectName || 'عرض سعر توريد مواد وأنظمة'}
                    </p>

                    <div className="mt-3 flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200/50">
                        {sq.systemType || 'نظام عام'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {sq.items?.length || 0} بنود مسعرة
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400">إجمالي التسعيرة:</span>
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white tabular-nums">
                        {(sq.totalAmount || 0).toLocaleString()} SAR
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectSupplierQuote) onSelectSupplierQuote(sq.id);
                          else setSelectedQuote(sq);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        عرض البنود
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenNewPO(sq.projectId, sq.id)}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        title="تحويل إلى أمر شراء PO فوري"
                      >
                        <Plus className="w-3 h-3" />
                        <span>PO</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3.3: PRICED ITEMS LIBRARY (ITEM BANK) */}
      {activeSubTab === 'item_bank' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>بنك المواد والمواصفات المسعرة (Priced Items Library)</span>
              </h3>
              <p className="text-xs text-slate-500">
                مكتبة المواصفات القياسية المعتمدة للأصناف الكهروميكانيكية وأسعار التوريد التقديرية
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200">
              {filteredMasterItems.length} صنف معتمد
            </span>
          </div>

          {/* Search & Discipline Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الصنف، الكود، أو الماركة..."
                className="w-full pr-9 pl-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">التخصص:</span>
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                <option value="all">كافة الأنظمة الهندسية</option>
                <option value="fire_fighting">إطفاء الحريق (Fire Fighting)</option>
                <option value="fire_alarm">إنذار الحريق (Fire Alarm)</option>
                <option value="hvac">التكييف والتهوية (HVAC)</option>
                <option value="plumbing">السباكة والتغذية (Plumbing)</option>
                <option value="electrical">الأعمال الكهربائية (Electrical)</option>
                <option value="low_current">التيار الخفيف (Low Current)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">كود الصنف</th>
                  <th className="py-3 px-4">الوصف والمواصفات القياسية</th>
                  <th className="py-3 px-4">النظام الهندسـي</th>
                  <th className="py-3 px-4">الوحدة</th>
                  <th className="py-3 px-4">متوسط سعر التوريد [Excl. VAT]</th>
                  <th className="py-3 px-4">المورد / الماركة المفضلة</th>
                  <th className="py-3 px-4 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMasterItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد أصناف مطابقة للبحث المحدد في بنك المواد.
                    </td>
                  </tr>
                ) : (
                  filteredMasterItems.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{it.itemCode}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(it.itemCode)}
                            className="text-slate-400 hover:text-amber-600 cursor-pointer"
                            title="نسخ الكود"
                          >
                            {copiedItemCode === it.itemCode ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100 max-w-sm">
                        <div>{it.descriptionAr}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{it.descriptionEn}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                          {it.discipline}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{it.unit}</td>
                      <td className="py-3 px-4 font-mono font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                        {it.baseCostSAR?.toLocaleString()} SAR
                      </td>
                      <td className="py-3 px-4 text-emerald-700 dark:text-emerald-400 font-medium">
                        {it.preferredBrand || 'مورد معتمد'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onOpenNewPO()}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[11px] font-bold transition cursor-pointer"
                          title="إصدار أمر شراء بهذا البند"
                        >
                          طلب توريد
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3.4: 3-WAY MATCHING GATEKEEPER TAB */}
      {activeSubTab === 'three_way' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    بوابة المطابقة الثلاثية الصارمة (3-Way Matching Gatekeeper)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مقارنة وتدقيق أوامر الشراء (PO) مقابل إشعارات الاستلام الفعلي بالموقع (GRN) وفاتورة المورد الضريبية
                  </p>
                </div>
              </div>

              {onOpenThreeWayModal && (
                <button
                  type="button"
                  onClick={onOpenThreeWayModal}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-2 shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>فتح نافذة التدقيق والمطابقة الكاملة</span>
                </button>
              )}
            </div>

            {/* Micro Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">سجلات مطابقة بالكامل (Passed)</span>
                <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                  {matchedCount}
                </div>
                <span className="text-[10px] text-emerald-600">جاهزة للمصادقة والصرف المالي الآمن</span>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40">
                <span className="text-xs text-rose-800 dark:text-rose-300 font-bold">تناقضات محجوزة (Blocked)</span>
                <div className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400 mt-1">
                  {blockedCount}
                </div>
                <span className="text-[10px] text-rose-600">فروقات سعرية أو كميات لم تصل الموقع</span>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                <span className="text-xs text-amber-800 dark:text-amber-300 font-bold">إجمالي عمليات التدقيق المسجلة</span>
                <div className="text-2xl font-black font-mono text-amber-700 dark:text-amber-400 mt-1">
                  {threeWayMatches.length}
                </div>
                <span className="text-[10px] text-amber-600">سجل تدقيق مالي ولوجستي</span>
              </div>
            </div>

            {/* Records List Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم PO</th>
                    <th className="py-3 px-4">المورد المعتمد</th>
                    <th className="py-3 px-4">قيمة أمر الشراء</th>
                    <th className="py-3 px-4">فاتورة المورد</th>
                    <th className="py-3 px-4">الفارق المالي (Variance)</th>
                    <th className="py-3 px-4">حالة التدقيق</th>
                    <th className="py-3 px-4 text-center">إجراء الصرف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {threeWayMatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        لا توجد سجلات مطابقة ثلاثية مسجلة حالياً. يمكنك تسجيل مطابقة من نافذة أمر الشراء أو إشعار الاستلام.
                      </td>
                    </tr>
                  ) : (
                    threeWayMatches.map((record) => {
                      const isClean = record.matchStatus === 'Passed' || record.matchStatus === 'Override Approved';
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            {record.poNumber}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                            {record.supplierName}
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {record.poTotalAmount?.toLocaleString()} SAR
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {record.supplierInvoiceTotalAmount?.toLocaleString()} SAR
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold tabular-nums">
                            {record.totalVarianceSAR === 0 ? (
                              <span className="text-emerald-600">0.00 SAR</span>
                            ) : (
                              <span className="text-rose-600">
                                {record.totalVarianceSAR > 0 ? `+${record.totalVarianceSAR.toLocaleString()}` : record.totalVarianceSAR.toLocaleString()} SAR
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isClean
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                              }`}
                            >
                              {isClean ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              <span>{record.matchStatus}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {record.isDisbursementBlocked ? (
                              <span className="text-rose-600 font-bold text-[10px] bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded">
                                محجوز الصرف
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded">
                                مسموح بالصرف
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. PO DETAILED PREVIEW / INSPECTION MODAL                      */}
      {/* ------------------------------------------------------------- */}
      {selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>أمر شراء: {selectedPO.poNumber}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {selectedPO.status || 'Issued'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    المورد: {selectedPO.supplierName || selectedPO.vendorName || 'مورد معتمد'} | التاريخ: {selectedPO.date || '2026-09-15'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Project & Vendor Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 font-medium">المشروع المرتبط:</span>
                  <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedPO.projectName || 'مشروع عام'}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  <span className="text-[11px] text-slate-400 font-medium">شروط الدفع والتوريد:</span>
                  <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {typeof selectedPO.paymentTerms === 'string'
                      ? selectedPO.paymentTerms
                      : (selectedPO.paymentTerms?.method || selectedPO.paymentTerms?.schedule || 'حسب شروط التوريد المتفق عليها')}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  جدول بنود ومواد أمر الشراء ({selectedPO.items?.length || 0} بنود):
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">الوصف والمواصفة</th>
                        <th className="py-2.5 px-3">الوحدة</th>
                        <th className="py-2.5 px-3">الكمية المطلوبة</th>
                        <th className="py-2.5 px-3">سعر الوحدة</th>
                        <th className="py-2.5 px-3">الإجمالي [قبل الضريبة]</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedPO.items && selectedPO.items.length > 0 ? (
                        selectedPO.items.map((it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                              {it.description}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500">{it.unit || 'عدد'}</td>
                            <td className="py-2 px-3 font-mono font-bold">{it.quantity}</td>
                            <td className="py-2 px-3 font-mono tabular-nums">{Number(it.unitPrice || 0).toLocaleString()} SAR</td>
                            <td className="py-2 px-3 font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                              {Number(it.totalPrice || (it.quantity * (it.unitPrice || 0))).toLocaleString()} SAR
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400">
                            لا توجد بنود مدخلة في أمر الشراء هذا
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals Block */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-500">حالة التوريد والاستلام الميداني:</span>
                  <div className="mt-1 font-bold text-sm text-slate-800 dark:text-slate-200">
                    {selectedPO.deliveryStatus === 'Delivered' || selectedPO.fulfillmentStatus === 'Fully Received'
                      ? 'مستلم بالكامل في الموقع'
                      : 'قيد التوريد أو استلام جزئي'}
                  </div>
                </div>

                <div className="space-y-1.5 min-w-[220px] text-left">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>المجموع قبل الضريبة:</span>
                    <span className="font-mono font-bold">
                      {Number(selectedPO.subtotal || (selectedPO.grandTotal ? selectedPO.grandTotal / 1.15 : 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>ضريبة القيمة المضافة 15%:</span>
                    <span className="font-mono font-bold">
                      {Number(selectedPO.vatAmount || (selectedPO.grandTotal ? selectedPO.grandTotal - (selectedPO.grandTotal / 1.15) : 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} SAR
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700 pt-1.5">
                    <span>الإجمالي الشامل (15% VAT):</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">
                      {Number(selectedPO.grandTotal || selectedPO.totalAmount || 0).toLocaleString()} SAR
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    exportPurchaseOrderToPDF(selectedPO);
                    executePrint('purchase-order-document', {
                      documentTitle: `أمر شراء - ${selectedPO.poNumber}`,
                    });
                  }}
                  className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة أمر الشراء</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const po = selectedPO;
                    setSelectedPO(null);
                    onEditPO(po);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>تعديل في المحرر</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Container for PO */}
      {selectedPO && (
        <div id="purchase-order-document" className="hidden print:block bg-white text-slate-900 p-8">
          <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-start">
            <CompanyHeader showDivider={false} />
          </div>

          <div className="bg-slate-900 text-white text-center py-2 font-bold text-sm uppercase tracking-wider mb-6">
            PURCHASE ORDER — أمر شراء رسمي
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-6 border border-slate-300 p-4 rounded-lg bg-slate-50">
            <div>
              <div className="font-bold text-slate-700 mb-1">بيانات أمر الشراء:</div>
              <div>رقم أمر الشراء: <strong className="font-mono">{selectedPO.poNumber}</strong></div>
              <div>التاريخ: <span className="font-mono">{selectedPO.date}</span></div>
              <div>المشروع: <strong>{selectedPO.projectName}</strong> ({selectedPO.projectRef || '-'})</div>
              <div>تاريخ التوريد: <span className="font-mono">{selectedPO.deliveryDate || 'حسب الاتفاق'}</span></div>
            </div>
            <div>
              <div className="font-bold text-slate-700 mb-1">بيانات المورد:</div>
              <div>اسم المورد: <strong>{selectedPO.vendorName || selectedPO.supplierName}</strong></div>
              <div>جهة الاتصال: {selectedPO.vendorContactPerson || '-'}</div>
              <div>هاتف / بريد: {selectedPO.vendorPhoneEmail || '-'}</div>
              <div>الرقم الضريبي للمورد: <span className="font-mono">{selectedPO.vendorVatNo || '-'}</span></div>
            </div>
          </div>

          <table className="w-full text-right text-xs border border-slate-300 mb-6">
            <thead className="bg-slate-100 border-b border-slate-300 font-bold">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-10">#</th>
                <th className="p-2 border-r border-slate-300">الوصف والمواصفات الفنية</th>
                <th className="p-2 border-r border-slate-300 text-center w-16">الوحدة</th>
                <th className="p-2 border-r border-slate-300 text-center w-16">الكمية</th>
                <th className="p-2 border-r border-slate-300 text-left w-24">سعر الوحدة</th>
                <th className="p-2 text-left w-28">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(selectedPO.items || []).map((it, idx) => (
                <tr key={it.id || idx}>
                  <td className="p-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                  <td className="p-2 border-r border-slate-300 font-medium">{it.description}</td>
                  <td className="p-2 border-r border-slate-300 text-center">{it.unit || 'عدد'}</td>
                  <td className="p-2 border-r border-slate-300 text-center font-bold font-mono">{it.quantity}</td>
                  <td className="p-2 border-r border-slate-300 text-left font-mono">{Number(it.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                  <td className="p-2 text-left font-mono font-bold">{Number(it.totalPrice || (it.quantity * (it.unitPrice || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div className="w-72 space-y-1.5 text-xs bg-slate-50 border border-slate-300 p-3 rounded-lg">
              <div className="flex justify-between">
                <span>المجموع قبل الضريبة:</span>
                <span className="font-mono font-bold">{Number(selectedPO.subtotal || (selectedPO.grandTotal ? selectedPO.grandTotal / 1.15 : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
              </div>
              <div className="flex justify-between">
                <span>ضريبة القيمة المضافة 15%:</span>
                <span className="font-mono font-bold">{Number(selectedPO.vatAmount || (selectedPO.grandTotal ? selectedPO.grandTotal - (selectedPO.grandTotal / 1.15) : 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-slate-300 pt-1 text-slate-900">
                <span>الإجمالي الشامل (15% VAT):</span>
                <span className="font-mono">{Number(selectedPO.grandTotal || selectedPO.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR</span>
              </div>
            </div>
          </div>

          <div className="text-xs border-t border-slate-300 pt-4 grid grid-cols-3 gap-4 text-center mt-8">
            <div className="border border-slate-200 p-2 rounded">
              <div className="font-bold text-slate-700">إعداد / مهندس المشتريات</div>
              <div className="h-12 flex items-center justify-center font-script text-slate-400">Approved</div>
            </div>
            <div className="border border-slate-200 p-2 rounded">
              <div className="font-bold text-slate-700">مراجعة / الإدارة المالية</div>
              <div className="h-12 flex items-center justify-center font-script text-slate-400">Reviewed</div>
            </div>
            <div className="border border-slate-200 p-2 rounded">
              <div className="font-bold text-slate-700">اعتماد / المدير التنفيذي</div>
              <div className="h-12 flex items-center justify-center font-script text-slate-400">Authorized & Stamped</div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. SUPPLIER QUOTATION DETAILED MODAL                          */}
      {/* ------------------------------------------------------------- */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تسعيرة المورد: {selectedQuote.quotationNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    المورد: {selectedQuote.supplierName} | المشروع: {selectedQuote.projectName || 'مشروع عام'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">الوصف والمواصفات</th>
                      <th className="py-2.5 px-3">الكمية</th>
                      <th className="py-2.5 px-3">سعر الوحدة</th>
                      <th className="py-2.5 px-3">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedQuote.items?.map((it, idx) => {
                      const unitRate = it.supplierUnitPrice ?? (it as any).unitPrice ?? it.sellingUnitPrice ?? 0;
                      const totalAmt = it.supplierTotalPrice ?? (it as any).totalPrice ?? (unitRate * it.quantity);
                      return (
                        <tr key={it.id || idx}>
                          <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{it.description}</td>
                          <td className="py-2 px-3 font-mono">{it.quantity} {it.unit}</td>
                          <td className="py-2 px-3 font-mono tabular-nums">{Number(unitRate).toLocaleString()} SAR</td>
                          <td className="py-2 px-3 font-mono font-bold tabular-nums">{Number(totalAmt).toLocaleString()} SAR</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <span className="text-xs text-slate-500 font-medium">إجمالي عرض السعر [قبل الضريبة]:</span>
                <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                  {(selectedQuote.totalAmount || 0).toLocaleString()} SAR
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const q = selectedQuote;
                  setSelectedQuote(null);
                  onOpenNewPO(q.projectId, q.id);
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>إصدار أمر شراء PO فوري من هذه التسعيرة</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Procurement SOA (Vendor Statement of Account) Modal */}
      {showSOAModal && (
        <ProcurementSOA
          isOpen={showSOAModal}
          onClose={() => setShowSOAModal(false)}
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          projects={projects}
          initialSupplierId={soaSupplierId}
        />
      )}
    </div>
  );
};
