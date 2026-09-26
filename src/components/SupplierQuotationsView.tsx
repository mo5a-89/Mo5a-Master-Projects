import React, { useState, useMemo, useEffect } from 'react';
import { SupplierQuotation, Supplier, Project, QuotationItem } from '../types';
import { SupplierQuoteDetailModal } from './SupplierQuoteDetailModal';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Building,
  Calendar,
  DollarSign,
  Edit3,
  Trash2,
  ShoppingBag,
  Upload,
  ExternalLink,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
  Sliders,
  Sparkles,
  TrendingUp,
  Save,
  Printer,
  Cloud,
  RefreshCw,
  LayoutGrid,
  ShieldCheck,
  Check,
  ChevronDown,
  Info,
  Tag,
} from 'lucide-react';
import { executePrint } from '../utils/printUtils';

interface SupplierQuotationsViewProps {
  supplierQuotations: SupplierQuotation[];
  suppliers: Supplier[];
  projects: Project[];
  onUpdateSupplierQuoteItems: (quoteId: string, updatedItems: QuotationItem[]) => void;
  onDeleteSupplierQuotation: (quoteId: string) => void;
  onOpenNewPOModal: (projectId?: string, supplierQuoteId?: string) => void;
  onOpenUploadSupplierModal: () => void;
  onConvertToCustomerQuote?: (supplierQuoteId: string, tunedItems: QuotationItem[]) => void;
  onOpenGoogleDriveSync?: () => void;
}

export const SupplierQuotationsView: React.FC<SupplierQuotationsViewProps> = ({
  supplierQuotations,
  suppliers,
  projects,
  onUpdateSupplierQuoteItems,
  onDeleteSupplierQuotation,
  onOpenNewPOModal,
  onOpenUploadSupplierModal,
  onConvertToCustomerQuote,
  onOpenGoogleDriveSync,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'control_deck' | 'cards_grid'>('control_deck');
  
  // Active selected quote in the control deck
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(() => {
    return supplierQuotations.length > 0 ? supplierQuotations[0].id : null;
  });

  const [viewingQuote, setViewingQuote] = useState<SupplierQuotation | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<SupplierQuotation | null>(null);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Filter supplier quotations
  const filteredQuotations = useMemo(() => {
    return supplierQuotations.filter((sq) => {
      const matchesSearch =
        sq.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sq.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sq.items.some((it) => it.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSupplier =
        selectedSupplierFilter === 'all' || sq.supplierId === selectedSupplierFilter || sq.supplierName === selectedSupplierFilter;

      const matchesProject =
        selectedProjectFilter === 'all' || sq.projectId === selectedProjectFilter;

      return matchesSearch && matchesSupplier && matchesProject;
    });
  }, [supplierQuotations, searchQuery, selectedSupplierFilter, selectedProjectFilter]);

  // Keep activeQuoteId valid
  useEffect(() => {
    if (!activeQuoteId && filteredQuotations.length > 0) {
      setActiveQuoteId(filteredQuotations[0].id);
    } else if (activeQuoteId && !filteredQuotations.some((q) => q.id === activeQuoteId)) {
      if (filteredQuotations.length > 0) {
        setActiveQuoteId(filteredQuotations[0].id);
      } else {
        setActiveQuoteId(null);
      }
    }
  }, [filteredQuotations, activeQuoteId]);

  const activeQuote = useMemo(() => {
    return supplierQuotations.find((q) => q.id === activeQuoteId) || null;
  }, [supplierQuotations, activeQuoteId]);

  const activeProject = useMemo(() => {
    if (!activeQuote) return null;
    return projects.find((p) => p.id === activeQuote.projectId) || null;
  }, [activeQuote, projects]);

  // Working copy of items for real-time margin & markup tuning
  const [activeItems, setActiveItems] = useState<QuotationItem[]>([]);
  const [pricingMode, setPricingMode] = useState<'margin' | 'markup'>('margin');
  const [globalRate, setGlobalRate] = useState<number>(20); // 20% margin default

  // Master Pricing Switcher: Selling Prices vs Supplier Cost
  const [controlFocus, setControlFocus] = useState<'selling' | 'supplier'>('selling');
  const [supplierAdjustmentRate, setSupplierAdjustmentRate] = useState<number>(0);
  const [keepSellingFixedOnCostChange, setKeepSellingFixedOnCostChange] = useState<boolean>(true);

  // Sync active items whenever active quote changes
  useEffect(() => {
    if (activeQuote?.items) {
      setActiveItems(
        activeQuote.items.map((it) => {
          const supPrice = Number(it.supplierUnitPrice) || 0;
          const origSupPrice = Number(it.originalSupplierUnitPrice) > 0 ? Number(it.originalSupplierUnitPrice) : supPrice;
          const sellPrice =
            Number(it.sellingUnitPrice) > 0
              ? Number(it.sellingUnitPrice)
              : Number((supPrice * 1.25).toFixed(2));
          const qty = Number(it.quantity) || 1;
          return {
            ...it,
            supplierUnitPrice: supPrice,
            originalSupplierUnitPrice: origSupPrice,
            supplierTotalPrice: Number((qty * supPrice).toFixed(2)),
            sellingUnitPrice: sellPrice,
            sellingTotalPrice: Number((qty * sellPrice).toFixed(2)),
          };
        })
      );
      setSupplierAdjustmentRate(0);
    } else {
      setActiveItems([]);
    }
  }, [activeQuote?.id, activeQuote?.totalAmount]);

  // Apply uniform margin or markup across all items of active supplier
  const applyUniformRate = (rate: number, mode: 'margin' | 'markup') => {
    setGlobalRate(rate);
    setPricingMode(mode);
    const updated = activeItems.map((it) => {
      const cost = Number(it.supplierUnitPrice) || 0;
      let newSellingUnit = 0;
      if (mode === 'margin') {
        const safeMargin = Math.min(Math.max(rate, 0), 90);
        newSellingUnit = safeMargin >= 100 ? cost : cost / (1 - safeMargin / 100);
      } else {
        newSellingUnit = cost * (1 + rate / 100);
      }
      const qty = Number(it.quantity) || 1;
      const roundedSell = Number(newSellingUnit.toFixed(2));
      return {
        ...it,
        sellingUnitPrice: roundedSell,
        sellingTotalPrice: Number((qty * roundedSell).toFixed(2)),
      };
    });
    setActiveItems(updated);
  };

  // Handle individual line item selling price edit
  const handleItemSellingPriceChange = (index: number, val: number) => {
    const updated = [...activeItems];
    const it = { ...updated[index] };
    const qty = Number(it.quantity) || 1;
    it.sellingUnitPrice = val;
    it.sellingTotalPrice = Number((qty * val).toFixed(2));
    updated[index] = it;
    setActiveItems(updated);
  };

  // Handle individual line item supplier cost edit
  const handleItemSupplierPriceChange = (index: number, val: number) => {
    const updated = [...activeItems];
    const it = { ...updated[index] };
    const qty = Number(it.quantity) || 1;
    const sanitizedVal = Math.max(0, val);
    it.supplierUnitPrice = sanitizedVal;
    it.supplierTotalPrice = Number((qty * sanitizedVal).toFixed(2));

    if (!keepSellingFixedOnCostChange) {
      let newSellingUnit = 0;
      if (pricingMode === 'margin') {
        const safeMargin = Math.min(Math.max(globalRate, 0), 90);
        newSellingUnit = safeMargin >= 100 ? sanitizedVal : sanitizedVal / (1 - safeMargin / 100);
      } else {
        newSellingUnit = sanitizedVal * (1 + globalRate / 100);
      }
      it.sellingUnitPrice = Number(newSellingUnit.toFixed(2));
      it.sellingTotalPrice = Number((qty * it.sellingUnitPrice).toFixed(2));
    }

    updated[index] = it;
    setActiveItems(updated);
  };

  // Apply uniform discount or adjustment across all supplier items
  const applySupplierCostAdjustment = (ratePercent: number) => {
    setSupplierAdjustmentRate(ratePercent);
    const multiplier = 1 + ratePercent / 100;

    const updated = activeItems.map((it) => {
      const baseCost = Number(it.originalSupplierUnitPrice) > 0 ? Number(it.originalSupplierUnitPrice) : Number(it.supplierUnitPrice) || 0;
      const newSupUnit = Math.max(0, Number((baseCost * multiplier).toFixed(2)));
      const qty = Number(it.quantity) || 1;
      const newSupTotal = Number((qty * newSupUnit).toFixed(2));

      let newSellUnit = it.sellingUnitPrice;
      let newSellTotal = it.sellingTotalPrice;

      if (!keepSellingFixedOnCostChange) {
        if (pricingMode === 'margin') {
          const safeMargin = Math.min(Math.max(globalRate, 0), 90);
          newSellUnit = safeMargin >= 100 ? newSupUnit : newSupUnit / (1 - safeMargin / 100);
        } else {
          newSellUnit = newSupUnit * (1 + globalRate / 100);
        }
        newSellUnit = Number(newSellUnit.toFixed(2));
        newSellTotal = Number((qty * newSellUnit).toFixed(2));
      }

      return {
        ...it,
        originalSupplierUnitPrice: baseCost,
        supplierUnitPrice: newSupUnit,
        supplierTotalPrice: newSupTotal,
        sellingUnitPrice: newSellUnit,
        sellingTotalPrice: newSellTotal,
      };
    });

    setActiveItems(updated);
  };

  // Reset all items to their original quote supplier price
  const resetSupplierCostsToOriginal = () => {
    setSupplierAdjustmentRate(0);
    const updated = activeItems.map((it) => {
      const orig = Number(it.originalSupplierUnitPrice) > 0 ? Number(it.originalSupplierUnitPrice) : Number(it.supplierUnitPrice) || 0;
      const qty = Number(it.quantity) || 1;
      return {
        ...it,
        supplierUnitPrice: orig,
        supplierTotalPrice: Number((qty * orig).toFixed(2)),
      };
    });
    setActiveItems(updated);
  };

  // Live financial metrics of active supplier quote
  const activeCost = useMemo(
    () => activeItems.reduce((sum, it) => sum + (Number(it.supplierTotalPrice) || 0), 0),
    [activeItems]
  );
  const activeSelling = useMemo(
    () => activeItems.reduce((sum, it) => sum + (Number(it.sellingTotalPrice) || 0), 0),
    [activeItems]
  );
  const activeProfit = activeSelling - activeCost;
  const activeMarginPercent = activeSelling > 0 ? (activeProfit / activeSelling) * 100 : 0;
  const activeMarkupPercent = activeCost > 0 ? (activeProfit / activeCost) * 100 : 0;

  // Save tuned prices and persist
  const handleSaveActivePrices = () => {
    if (activeQuote) {
      onUpdateSupplierQuoteItems(activeQuote.id, activeItems);
      setSavedSuccessMsg(`تم تثبيت وحفظ أسعار ${activeQuote.supplierName} سحابياً ومحلياً`);
      setTimeout(() => setSavedSuccessMsg(null), 3500);
    }
  };

  const handlePrintActiveQuote = () => {
    if (!activeQuote) return;
    executePrint('printable-supplier-active-deck', {
      documentTitle: `تسعيرة المورد - ${activeQuote.supplierName} - ${activeQuote.quotationNumber}`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-[#1e3a8a] to-[#007A5A] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 bg-white/10 rounded-xl backdrop-blur-xs">
                <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
              </span>
              <h1 className="text-2xl font-black tracking-tight font-cairo">
                إدارة وتسعير عروض الموردين
              </h1>
              <span className="px-2.5 py-1 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 rounded-lg text-xs font-mono font-bold">
                NAFFCO / AL-FANAR ENGINE
              </span>
            </div>
            <p className="text-sm text-slate-200 max-w-2xl leading-relaxed">
              لوحة تحكم حية وهوامش ربح متقدمة لكل مورد على حدة؛ ضبط دقيق للأسعار الفردية، استدعاء فوري لأوامر الشراء، وحفظ سحابي مباشر ومستمر على Google Drive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {onOpenGoogleDriveSync && (
              <button
                type="button"
                onClick={onOpenGoogleDriveSync}
                className="px-4 py-2.5 bg-emerald-900/60 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/40 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                title="مزامنة فورية مع Google Drive الشخصي"
              >
                <Cloud className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>مزامنة Google Drive</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenUploadSupplierModal}
              className="px-5 py-2.5 bg-white text-[#1e3a8a] hover:bg-slate-100 font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#007A5A]" />
              <span>رفع تسعيرة مورد جديدة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters & View Mode Toolbar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث برقم التسعيرة، اسم المورد، أو البند..."
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007A5A]/30 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Supplier Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Building className="w-4 h-4 text-slate-500" />
            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">جميع الموردين ({suppliers.length})</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Layers className="w-4 h-4 text-slate-500" />
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">جميع المشاريع ({projects.length})</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('control_deck')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'control_deck'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#007A5A]" />
              <span>لوحة التحكم وهوامش الأسعار</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards_grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'cards_grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[#1e3a8a]" />
              <span>شبكة البطاقات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredQuotations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">لا توجد عروض أسعار للموردين</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            لم يتم العثور على أي عروض مطابقة لمعايير البحث، أو لم تقم برفع تسعيرات بعد.
          </p>
          <button
            type="button"
            onClick={onOpenUploadSupplierModal}
            className="px-4 py-2 bg-[#007A5A] text-white hover:bg-[#00654b] text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>رفع أول تسعيرة مورد</span>
          </button>
        </div>
      ) : viewMode === 'control_deck' && activeQuote ? (
        <div className="space-y-4">
          {/* 1. Horizontal Per-Supplier Selection Tabs */}
          <div className="bg-white rounded-2xl p-2.5 border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-slate-400 px-2 shrink-0">الموردون:</span>
            {filteredQuotations.map((sq) => {
              const isSelected = sq.id === activeQuote.id;
              const itemCount = sq.items?.length || 0;
              return (
                <button
                  key={sq.id}
                  type="button"
                  onClick={() => setActiveQuoteId(sq.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-slate-900 to-[#1e3a8a] text-white shadow-md'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Building className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{sq.supplierName}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {itemCount} بند
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. Comprehensive Per-Supplier Control Deck & Live Margin Tuning Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="printable-supplier-active-deck">
            {/* Active Supplier Header Bar */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-[#0F2942] text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-base shadow-sm">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white font-cairo">
                      {activeQuote.supplierName}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                      {activeQuote.quotationNumber || 'بدون رقم'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {activeQuote.items?.length || 0} بنود معتمدة
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
                    <span>المشروع: <strong className="text-emerald-300">{activeProject?.name || 'مشروع عام'}</strong></span>
                    <span>•</span>
                    <span>تاريخ العرض: <strong className="text-slate-200 font-mono">{activeQuote.date || '—'}</strong></span>
                  </p>
                </div>
              </div>

              {/* Action Buttons for Active Supplier */}
              <div className="flex flex-wrap items-center gap-2 no-print">
                {savedSuccessMsg && (
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{savedSuccessMsg}</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleSaveActivePrices}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  title="تثبيت وحفظ الأسعار سحابياً"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ وتثبيت الأسعار</span>
                </button>

                {onConvertToCustomerQuote && (
                  <button
                    type="button"
                    onClick={() => onConvertToCustomerQuote(activeQuote.id, activeItems)}
                    className="px-4 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                    title="تحويل هذه التسعيرة بأسعار البيع المضبوطة إلى عرض سعر عميل رسمي"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>تحويل لعرض سعر عميل</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenNewPOModal(activeQuote.projectId, activeQuote.id)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  title="إصدار أمر شراء من تسعيرة هذا المورد"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>إصدار PO</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintActiveQuote}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer"
                  title="طباعة جدول التسعيرة"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Real-time Margin & Supplier Cost Tuning Panel */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 via-slate-100/60 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 no-print space-y-4">
              {/* 1. MASTER PRICING SWITCHER: أسعار البيع vs أسعار المورد */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    جهة التحكم في الأسعار:
                  </span>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setControlFocus('selling')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                        controlFocus === 'selling'
                          ? 'bg-[#007A5A] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>أسعار البيع (Selling Prices)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setControlFocus('supplier')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                        controlFocus === 'supplier'
                          ? 'bg-[#174A84] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>أسعار المورد / التكلفة (Supplier Cost)</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-bold px-3 py-1 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700">
                    {controlFocus === 'selling' ? (
                      <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span>التحكم في هامش الربح وأسعار بيع العميل (تعديل فردي وجماعي)</span>
                      </span>
                    ) : (
                      <span className="text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-sky-500" />
                        <span>التحكم في تكاليف شراء المورد والتفاوض والخصومات (تعديل فردي وجماعي)</span>
                      </span>
                    )}
                  </div>

                  {controlFocus === 'supplier' && (
                    <button
                      type="button"
                      onClick={resetSupplierCostsToOriginal}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="استعادة أسعار المورد الأصلية المسجلة بالتسعيرة"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>استعادة التكلفة الأصلية</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Interactive Tuning Controls & Bento Metrics */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* A. If Selling Price Mode is active */}
                {controlFocus === 'selling' ? (
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-[#007A5A]" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          ضبط هامش الربح وأسعار البيع للعميل (Selling Margin & Markup Tuning)
                        </span>
                      </div>

                      {/* Mode Toggle: Margin vs Markup */}
                      <div className="flex items-center bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => applyUniformRate(globalRate, 'margin')}
                          className={`px-3 py-1 rounded-md transition cursor-pointer ${
                            pricingMode === 'margin'
                              ? 'bg-[#007A5A] text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                          }`}
                        >
                          هامش الربح (Margin %)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyUniformRate(globalRate, 'markup')}
                          className={`px-3 py-1 rounded-md transition cursor-pointer ${
                            pricingMode === 'markup'
                              ? 'bg-[#1e3a8a] text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                          }`}
                        >
                          نسبة الإضافة (Markup %)
                        </button>
                      </div>
                    </div>

                    {/* Slider & Presets */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                        <input
                          type="range"
                          min="0"
                          max="60"
                          step="1"
                          value={globalRate}
                          onChange={(e) => applyUniformRate(Number(e.target.value), pricingMode)}
                          className="w-full accent-[#007A5A] cursor-pointer"
                        />
                        <span className="font-mono font-black text-sm px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 min-w-14 text-center shadow-xs">
                          {globalRate}%
                        </span>
                      </div>

                      {/* Quick Preset Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[10, 15, 20, 25, 30, 35, 40].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => applyUniformRate(rate, pricingMode)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                              globalRate === rate
                                ? 'bg-slate-900 text-white dark:bg-emerald-600 shadow-xs'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {rate}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* B. If Supplier Cost Mode is active */
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-[#174A84]" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          ضبط تكلفة وأسعار شراء المورد (Supplier Cost & Negotiation Tuning)
                        </span>
                      </div>

                      {/* Policy toggle: Keep selling fixed vs recalculate selling */}
                      <button
                        type="button"
                        onClick={() => setKeepSellingFixedOnCostChange(!keepSellingFixedOnCostChange)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          keepSellingFixedOnCostChange
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                        }`}
                        title="اختر هل يؤثر تغيير تكلفة المورد على صافي الربح أم يعاد احتساب سعر البيع تلقائياً"
                      >
                        <span>
                          {keepSellingFixedOnCostChange
                            ? '🔒 تثبيت سعر البيع (تغير الربح والهامش)'
                            : '🔄 تحديث سعر البيع تلقائياً للحفاظ على الهامش'}
                        </span>
                      </button>
                    </div>

                    {/* Cost Adjustment Slider & Presets */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                        <input
                          type="range"
                          min="-30"
                          max="30"
                          step="1"
                          value={supplierAdjustmentRate}
                          onChange={(e) => applySupplierCostAdjustment(Number(e.target.value))}
                          className="w-full accent-[#174A84] cursor-pointer"
                        />
                        <span
                          className={`font-mono font-black text-sm px-2.5 py-1 bg-white dark:bg-slate-800 border rounded-lg min-w-16 text-center shadow-xs ${
                            supplierAdjustmentRate < 0
                              ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400'
                              : supplierAdjustmentRate > 0
                              ? 'border-amber-400 text-amber-700 dark:text-amber-400'
                              : 'border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {supplierAdjustmentRate > 0 ? `+${supplierAdjustmentRate}%` : `${supplierAdjustmentRate}%`}
                        </span>
                      </div>

                      {/* Quick Cost Presets */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applySupplierCostAdjustment(0)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                            supplierAdjustmentRate === 0
                              ? 'bg-slate-900 text-white dark:bg-sky-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                          title="التكلفة الأصلية للمورد 0%"
                        >
                          الأصلية 0%
                        </button>
                        {[-15, -10, -5, 5, 10, 15].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => applySupplierCostAdjustment(rate)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                              supplierAdjustmentRate === rate
                                ? rate < 0
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                            }`}
                            title={rate < 0 ? `خصم ${Math.abs(rate)}% من المورد` : `زيادة ${rate}% على التكلفة`}
                          >
                            {rate > 0 ? `+${rate}%` : `${rate}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Bento Financial Metrics for this supplier */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 lg:w-[480px]">
                  <div
                    onClick={() => setControlFocus('supplier')}
                    className={`p-3 rounded-xl border shadow-2xs transition cursor-pointer ${
                      controlFocus === 'supplier'
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 ring-2 ring-sky-500/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                    title="انقر للتحكم في تكلفة وأسعار المورد"
                  >
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium flex items-center justify-between">
                      <span>تكلفة المورد</span>
                      {controlFocus === 'supplier' && <span className="text-[9px] text-sky-600 font-bold">نشط ✏️</span>}
                    </span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                      {Math.round(activeCost).toLocaleString()} <span className="text-[9px]">SAR</span>
                    </span>
                  </div>

                  <div
                    onClick={() => setControlFocus('selling')}
                    className={`p-3 rounded-xl border shadow-2xs transition cursor-pointer ${
                      controlFocus === 'selling'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                    title="انقر للتحكم في أسعار البيع وهوامش الربح"
                  >
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium flex items-center justify-between">
                      <span>سعر البيع المقترح</span>
                      {controlFocus === 'selling' && <span className="text-[9px] text-emerald-600 font-bold">نشط ✏️</span>}
                    </span>
                    <span className="font-mono font-black text-[#007A5A] dark:text-emerald-400 text-xs sm:text-sm">
                      {Math.round(activeSelling).toLocaleString()} <span className="text-[9px]">SAR</span>
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 shadow-2xs">
                    <span className="text-[10px] text-blue-700 dark:text-blue-400 block font-medium">الربح الصافي</span>
                    <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-xs sm:text-sm">
                      +{Math.round(activeProfit).toLocaleString()} <span className="text-[9px]">SAR</span>
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20 shadow-2xs">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">الهامش الفعلي</span>
                    <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-xs sm:text-sm">
                      {activeMarginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Granular Item-by-Item Breakdown Table (Al-Fanar / NAFFCO-style) */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[11px] border-b border-slate-800">
                    <th className="py-3 px-3 text-center w-10">#</th>
                    <th className="py-3 px-4 min-w-[240px]">بيان البند والمواصفات الفنية</th>
                    <th className="py-3 px-2 text-center w-16">الكمية</th>
                    <th className="py-3 px-2 text-center w-16">الوحدة</th>
                    <th
                      onClick={() => setControlFocus('supplier')}
                      className={`py-3 px-3 text-left transition cursor-pointer ${
                        controlFocus === 'supplier'
                          ? 'w-36 bg-sky-900 text-sky-200 font-black border-l-2 border-sky-400'
                          : 'w-28 bg-slate-800/80 hover:bg-slate-800'
                      }`}
                      title="انقر لتفعيل التعديل المباشر لتكلفة المورد"
                    >
                      <span>تكلفة شراء المورد</span>
                      {controlFocus === 'supplier' && <span className="mr-1 text-[9px]">✏️ (تعديل)</span>}
                    </th>
                    <th className="py-3 px-3 text-left w-32 bg-slate-800/80">إجمالي تكلفة المورد</th>
                    <th
                      onClick={() => setControlFocus('selling')}
                      className={`py-3 px-3 text-left transition cursor-pointer ${
                        controlFocus === 'selling'
                          ? 'w-36 bg-emerald-900/90 text-emerald-200 font-black border-l-2 border-emerald-400'
                          : 'w-32 bg-slate-800/80 hover:bg-slate-800'
                      }`}
                      title="انقر لتفعيل التعديل المباشر لسعر البيع"
                    >
                      <span>سعر بيع الوحدة</span>
                      {controlFocus === 'selling' && <span className="mr-1 text-[9px]">✏️ (تعديل)</span>}
                    </th>
                    <th className="py-3 px-3 text-left w-32 bg-emerald-950 text-emerald-200">
                      إجمالي سعر البيع
                    </th>
                    <th className="py-3 px-3 text-left w-24">الربح المتوقع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  {activeItems.map((item, idx) => {
                    const supUnit = Number(item.supplierUnitPrice) || 0;
                    const supTotal = Number(item.supplierTotalPrice) || 0;
                    const sellUnit = Number(item.sellingUnitPrice) || 0;
                    const sellTotal = Number(item.sellingTotalPrice) || 0;
                    const profit = sellTotal - supTotal;
                    const profitMargin = sellTotal > 0 ? (profit / sellTotal) * 100 : 0;

                    return (
                      <tr
                        key={item.id || idx}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition group"
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                          <div>{item.description}</div>
                          {item.model && (
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                              كود/موديل: {item.model}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 font-medium">
                          {item.unit || 'بند'}
                        </td>

                        {/* Supplier Unit Price Cell */}
                        {controlFocus === 'supplier' ? (
                          <td className="py-1.5 px-2 text-left bg-sky-50/50 dark:bg-sky-950/20">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={supUnit}
                                onChange={(e) =>
                                  handleItemSupplierPriceChange(idx, Number(e.target.value) || 0)
                                }
                                className="w-full p-1.5 text-left font-mono font-bold text-xs bg-white dark:bg-slate-800 border-2 border-sky-400 dark:border-sky-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-sky-900 dark:text-sky-200 shadow-2xs"
                              />
                              {item.originalSupplierUnitPrice !== undefined &&
                                Math.abs(item.originalSupplierUnitPrice - supUnit) > 0.01 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleItemSupplierPriceChange(idx, item.originalSupplierUnitPrice || supUnit)
                                    }
                                    className="p-1 text-[10px] text-slate-400 hover:text-sky-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shrink-0 cursor-pointer"
                                    title={`استعادة سعر المورد الأصلي: ${item.originalSupplierUnitPrice}`}
                                  >
                                    ↺
                                  </button>
                                )}
                            </div>
                          </td>
                        ) : (
                          <td
                            onClick={() => setControlFocus('supplier')}
                            className="py-2.5 px-3 text-left font-mono font-semibold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer hover:bg-sky-50"
                            title="انقر لتعديل تكلفة المورد"
                          >
                            {supUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}

                        {/* Supplier Total Price Cell */}
                        <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                          {supTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Selling Unit Price Cell */}
                        {controlFocus === 'selling' ? (
                          <td className="py-1.5 px-2 text-left bg-emerald-50/40 dark:bg-emerald-950/20">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={sellUnit}
                              onChange={(e) =>
                                handleItemSellingPriceChange(idx, Number(e.target.value) || 0)
                              }
                              className="w-full p-1.5 text-left font-mono font-bold text-xs bg-white dark:bg-slate-800 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-[#007A5A] dark:text-emerald-300 shadow-2xs"
                            />
                          </td>
                        ) : (
                          <td
                            onClick={() => setControlFocus('selling')}
                            className="py-2.5 px-3 text-left font-mono font-semibold text-[#007A5A] dark:text-emerald-400 bg-emerald-50/20 cursor-pointer hover:bg-emerald-50"
                            title="انقر لتعديل سعر البيع"
                          >
                            {sellUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-left font-mono font-black text-[#007A5A] dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40">
                          {sellTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-left">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              profit >= 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            +{profitMargin.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700 text-xs">
                    <td colSpan={4} className="py-3 px-4 text-right">
                      الإجمالي الكلي للتسعيرة (Total Summary):
                    </td>
                    <td className="py-3 px-3 text-left font-mono bg-slate-800 text-slate-300">
                      —
                    </td>
                    <td className="py-3 px-3 text-left font-mono text-amber-300 bg-slate-800">
                      {activeCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                    <td className="py-3 px-3 text-left font-mono bg-emerald-950 text-emerald-300">
                      —
                    </td>
                    <td className="py-3 px-3 text-left font-mono text-emerald-300 bg-emerald-950 text-sm">
                      {activeSelling.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                    <td className="py-3 px-3 text-left font-mono text-emerald-400">
                      +{activeMarginPercent.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Footer Actions & Metadata */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  كافة الحسابات وهوامش الربح محتسبة ومحفوظة بدقة رياضية متكاملة لـ {activeQuote.supplierName}.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveActivePrices}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تثبيت التغييرات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Cards Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuotations.map((sq) => {
            const proj = projects.find((p) => p.id === sq.projectId);
            const isReviewed = sq.originalStatus === 'reviewed';

            return (
              <div
                key={sq.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#1e3a8a] transition">
                          {sq.supplierName}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500">
                          {sq.quotationNumber || 'بدون رقم تسعيرة'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                        isReviewed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isReviewed ? 'تم التعديل والمراجعة' : 'أصل مرفق'}
                    </span>
                  </div>

                  <div className="space-y-2 bg-slate-50 rounded-xl p-3 mb-4 text-xs text-slate-600 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">المشروع المرتبط:</span>
                      <span className="font-bold text-slate-800 truncate max-w-[180px]">
                        {proj ? proj.name : 'غير محدد'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">تاريخ التسعيرة:</span>
                      <span className="font-mono text-slate-700">{sq.date || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">عدد البنود:</span>
                      <span className="font-bold font-mono text-slate-800">
                        {sq.items?.length || 0} بند
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-slate-500 font-bold">الإجمالي:</span>
                      <span className="font-bold font-mono text-[#007A5A] text-sm">
                        {(sq.totalAmount || 0).toLocaleString()} SAR
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuoteId(sq.id);
                      setViewMode('control_deck');
                    }}
                    className="flex-1 py-2 px-3 bg-slate-900 hover:bg-[#1e3a8a] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ضبط الهوامش والأسعار</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenNewPOModal(sq.projectId, sq.id)}
                    className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#007A5A] border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="إصدار أمر شراء من هذه التسعيرة"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>PO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuoteToDelete(sq)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-200 transition cursor-pointer"
                    title="حذف التسعيرة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {quoteToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف تسعيرة المورد</h3>
                <p className="text-xs text-slate-500">Delete Supplier Quotation</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">اسم المورد:</span>
                <span className="font-bold text-slate-900">{quoteToDelete.supplierName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">رقم التسعيرة:</span>
                <span className="font-mono font-semibold text-slate-700">
                  {quoteToDelete.quotationNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الإجمالي:</span>
                <span className="font-mono font-bold text-[#007A5A]">
                  {(quoteToDelete.totalAmount || 0).toLocaleString()} SAR
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف تسعيرة المورد هذه نهائياً من النظام؟
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setQuoteToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSupplierQuotation(quoteToDelete.id);
                  setQuoteToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>نعم، حذف التسعيرة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
