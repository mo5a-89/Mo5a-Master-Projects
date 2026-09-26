import React, { useState, useMemo } from 'react';
import { PricedItemRecord, Project, Supplier, SYSTEM_DEFINITIONS } from '../types';
import {
  Search,
  Filter,
  Tag,
  Building,
  Calendar,
  DollarSign,
  User,
  ShoppingBag,
  Copy,
  CheckCircle2,
  Archive,
  FileText,
  Percent,
  Sparkles,
  ArrowUpDown,
  ExternalLink,
  Layers,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface PricedItemsLibraryViewProps {
  items: PricedItemRecord[];
  projects: Project[];
  suppliers: Supplier[];
  onIssuePOWithItem?: (item: PricedItemRecord) => void;
  onClearArchivedItem?: (itemId: string) => void;
}

export const PricedItemsLibraryView: React.FC<PricedItemsLibraryViewProps> = ({
  items,
  projects,
  suppliers,
  onIssuePOWithItem,
  onClearArchivedItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'archived' | 'active'>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Distinct suppliers and projects from items
  const uniqueSuppliers = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => {
      if (it.supplierName && it.supplierName.trim()) s.add(it.supplierName.trim());
    });
    return Array.from(s).sort();
  }, [items]);

  const uniqueProjects = useMemo(() => {
    const p = new Set<string>();
    items.forEach((it) => {
      if (it.projectName && it.projectName.trim()) p.add(it.projectName.trim());
    });
    return Array.from(p).sort();
  }, [items]);

  // Filtered Items Logic
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter((it) => {
      // Search match
      const matchesSearch =
        !query ||
        it.description.toLowerCase().includes(query) ||
        it.supplierName.toLowerCase().includes(query) ||
        it.projectName.toLowerCase().includes(query) ||
        (it.clientName && it.clientName.toLowerCase().includes(query)) ||
        (it.quotationNumber && it.quotationNumber.toLowerCase().includes(query)) ||
        (it.notes && it.notes.toLowerCase().includes(query));

      // System filter
      const matchesSystem = selectedSystem === 'all' || it.system === selectedSystem;

      // Status filter (active vs archived from deleted quote)
      const matchesStatus = selectedStatus === 'all' || it.status === selectedStatus;

      // Supplier filter
      const matchesSupplier =
        selectedSupplier === 'all' || it.supplierName === selectedSupplier;

      // Project filter
      const matchesProject =
        selectedProject === 'all' || it.projectName === selectedProject;

      return matchesSearch && matchesSystem && matchesStatus && matchesSupplier && matchesProject;
    });
  }, [items, searchQuery, selectedSystem, selectedStatus, selectedSupplier, selectedProject]);

  // Copy handler
  const handleCopy = (it: PricedItemRecord) => {
    const text = `الصنف: ${it.description}\nسعر التوريد: ${it.supplierUnitPrice.toLocaleString()} SAR\nالمورد: ${it.supplierName}\nالمشروع: ${it.projectName}\nتاريخ التسعير: ${it.pricingDate}`;
    navigator.clipboard.writeText(text);
    setCopiedId(it.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // KPIs
  const totalCount = items.length;
  const archivedCount = items.filter((it) => it.status === 'archived').length;
  const activeCount = items.filter((it) => it.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Search Engine */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1E3A8A] to-[#007A5A] text-white p-6 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl text-emerald-400">
                <Tag className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                سجل وبنك الأصناف المسعرة (Priced Items Library)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/20 text-white">
                {items.length} صنف مسعر
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
              أرشيف متكامل يضم بيانات كافة الأصناف المسعرة عبر جميع المشاريع وعروض الأسعار (بما فيها العروض المحذوفة). 
              ابحث فوراً باسم الصنف لمعرفة بكم تم تسعيره وتاريخه ومن هو المورد الخاص به لاستدعائه في أي وقت.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <div className="px-3.5 py-1.5 rounded-xl bg-white/10 text-xs font-mono backdrop-blur-sm border border-white/10 flex items-center gap-2">
              <span className="text-emerald-300 font-bold">● {activeCount}</span>
              <span className="text-slate-300">مشاريع قائمة</span>
              <span className="text-amber-300 font-bold ml-2">● {archivedCount}</span>
              <span className="text-slate-300">محفوظة من عروض سابقة</span>
            </div>
          </div>
        </div>

        {/* Big Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute right-4 top-3.5" />
          <input
            type="text"
            placeholder="اكتب اسم الصنف، المواصفة، الماركة، اسم المورد، أو اسم المشروع لمعرفة السعر وتفاصيله..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-white text-slate-900 rounded-xl text-sm font-medium shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-3 text-xs text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1.5 rounded-md font-bold transition ${
                selectedStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('archived')}
              className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
                selectedStatus === 'archived'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5 text-amber-600" />
              <span>محفوظ من عروض محذوفة ({archivedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('active')}
              className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
                selectedStatus === 'active'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>مشاريع قائمة ({activeCount})</span>
            </button>
          </div>

          {/* Supplier Dropdown Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">المورد:</span>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-[#007A5A]"
            >
              <option value="all">كافة الموردين ({uniqueSuppliers.length})</option>
              {uniqueSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>

            {/* Project Dropdown Filter */}
            <span className="text-slate-500 font-medium mr-2">المشروع:</span>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-[#007A5A]"
            >
              <option value="all">كافة المشاريع ({uniqueProjects.length})</option>
              {uniqueProjects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* System Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap ml-1">النظام:</span>
          <button
            type="button"
            onClick={() => setSelectedSystem('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
              selectedSystem === 'all'
                ? 'bg-[#007A5A] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل
          </button>
          {SYSTEM_DEFINITIONS.map((sys) => (
            <button
              key={sys.id}
              type="button"
              onClick={() => setSelectedSystem(sys.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition ${
                selectedSystem === sys.id
                  ? 'bg-[#007A5A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sys.nameEn}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>
          تم العثور على <strong className="text-slate-900 font-mono">{filteredItems.length}</strong> صنف مسعر
          {searchQuery && (
            <span>
              {' '}
              يطابق البحث "<span className="text-[#007A5A] font-bold">{searchQuery}</span>"
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          يتم حفظ أسعار التوريد والبيع التاريخية للرجوع إليها عند تسعير أي أمر شراء جديد
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">لم يتم العثور على أصناف مسعرة</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            لم نجد أصنافاً تطابق معايير البحث الحالية. يمكنك تعديل كلمات البحث أو اختيار نظام آخر.
          </p>
          {(searchQuery || selectedSystem !== 'all' || selectedStatus !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedSystem('all');
                setSelectedStatus('all');
                setSelectedSupplier('all');
                setSelectedProject('all');
              }}
              className="text-xs font-bold text-[#007A5A] hover:underline"
            >
              إعادة تعيين الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((it) => {
            const isArchived = it.status === 'archived';

            return (
              <div
                key={it.id}
                className={`bg-white rounded-xl border p-4 shadow-xs transition hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isArchived
                    ? 'border-amber-200/80 hover:border-amber-400 bg-amber-50/20'
                    : 'border-slate-200 hover:border-[#007A5A]'
                }`}
              >
                {/* Left Side: Item Specs & Context */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Badge */}
                    {isArchived ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Archive className="w-3 h-3 text-amber-600" />
                        <span>محفوظ من عرض سعر محذوف</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>مشروع قائم</span>
                      </span>
                    )}

                    {/* System Badge */}
                    {it.system && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#1E3A8A]">
                        {it.system}
                      </span>
                    )}

                    {/* Quotation Reference */}
                    {it.quotationNumber && (
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        {it.quotationNumber}
                      </span>
                    )}

                    {/* Pricing Date */}
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {it.pricingDate}
                    </span>
                  </div>

                  {/* Description */}
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {it.description}
                  </h3>

                  {/* Context: Supplier, Project, Client */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">المورد:</span>
                      <strong className="text-slate-900 font-semibold">{it.supplierName}</strong>
                    </div>

                    <div className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">المشروع:</span>
                      <strong className="text-slate-800">{it.projectName}</strong>
                    </div>

                    {it.clientName && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-slate-400">العميل:</span>
                        <span className="text-slate-700">{it.clientName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Pricing & Actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 gap-3">
                  <div className="text-right space-y-0.5">
                    <div className="text-[11px] text-slate-500 font-medium">سعر التكلفة / التوريد:</div>
                    <div className="text-lg font-black font-mono text-[#007A5A]">
                      {it.supplierUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-xs font-sans">SAR / {it.unit}</span>
                    </div>

                    {it.customerUnitPrice && it.customerUnitPrice > 0 && it.customerUnitPrice !== it.supplierUnitPrice && (
                      <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1.5 font-mono">
                        <span>سعر البيع: {it.customerUnitPrice.toLocaleString()} SAR</span>
                        {it.marginPercent !== undefined && it.marginPercent > 0 && (
                          <span className="text-teal-700 font-bold">({it.marginPercent}% هامش)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(it)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                      title="نسخ تفاصيل الصنف والسعر"
                    >
                      {copiedId === it.id ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {onIssuePOWithItem && (
                      <button
                        type="button"
                        onClick={() => onIssuePOWithItem(it)}
                        className="px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#152e6f] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                        title="إصدار أمر شراء رسمي بهذا الصنف والمورد"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>إصدار أمر شراء (Issue PO)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
