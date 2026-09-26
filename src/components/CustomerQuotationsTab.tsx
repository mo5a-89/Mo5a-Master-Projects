import React, { useState, useMemo } from 'react';
import { CustomerQuotation, Project, Customer } from '../types';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  Edit3,
  Trash2,
  TrendingUp,
} from 'lucide-react';

interface CustomerQuotationsTabProps {
  quotations: CustomerQuotation[];
  projects?: Project[];
  customers?: Customer[];
  onOpenNewQuoteModal?: () => void;
  onEditQuote?: (quote: CustomerQuotation) => void;
  onDeleteQuote?: (quoteId: string) => void;
  onViewQuote?: (quote: CustomerQuotation) => void;
  onConvertToProject?: (quote: CustomerQuotation) => void;
}

export const CustomerQuotationsTab: React.FC<CustomerQuotationsTabProps> = ({
  quotations = [],
  projects = [],
  customers = [],
  onOpenNewQuoteModal,
  onEditQuote,
  onDeleteQuote,
  onViewQuote,
  onConvertToProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredQuotes = useMemo(() => {
    return quotations.filter((q) => {
      const qNum = q.quotationNumber || (q as any).quoteNumber || '';
      const cName = q.customerName || (q as any).clientName || '';
      const pName = (q as any).projectName || '';

      const matchesSearch =
        qNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = filterStatus === 'all' || q.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchQuery, filterStatus]);

  const totalValue = quotations.reduce((sum, q) => {
    const val = q.totals?.grandTotalWithVat || q.totalAmount || (q as any).total || 0;
    return sum + Number(val);
  }, 0);

  const approvedCount = quotations.filter((q) => q.status === 'Approved' || q.status === 'won').length;

  return (
    <div className="space-y-6">
      {/* Top Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">إجمالي عروض الأسعار</span>
            <span className="text-2xl font-black text-slate-900 font-mono">{quotations.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">العروض المعتمدة للتعاقد</span>
            <span className="text-2xl font-black text-emerald-700 font-mono">{approvedCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-bold block">إجمالي القيمة المسعرة (شامل الضريبة)</span>
            <span className="text-xl font-black text-[#1e3a8a] font-mono">{totalValue.toLocaleString()} SAR</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action and Search Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم العرض، اسم العميل، أو المشروع..."
              className="w-full pl-4 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-blue-500 outline-none transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">كافة الحالات</option>
            <option value="Draft">مسودة</option>
            <option value="sent_to_customer">مقدم للعميل</option>
            <option value="Approved">معتمد ومقبول</option>
            <option value="won">تمت الترسية</option>
            <option value="Rejected">مرفوض</option>
          </select>
        </div>

        {onOpenNewQuoteModal && (
          <button
            type="button"
            onClick={onOpenNewQuoteModal}
            className="px-4 py-2 bg-gradient-to-r from-blue-700 to-[#1e3a8a] text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md hover:from-blue-800 hover:to-blue-900 transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء عرض سعر جديد</span>
          </button>
        )}
      </div>

      {/* Quotations List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredQuotes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-bold text-slate-700 text-sm">لا توجد عروض أسعار مطابقة لمعايير البحث</p>
            <p className="text-xs text-slate-400 mt-1">يمكنك إنشاء عرض سعر جديد وتحديد البنود وجدول الكميات</p>
          </div>
        ) : (
          filteredQuotes.map((quote) => {
            const quoteTotal = quote.totals?.grandTotalWithVat || quote.totalAmount || (quote as any).total || 0;
            const qNum = quote.quotationNumber || (quote as any).quoteNumber || quote.id;
            const cName = quote.customerName || (quote as any).clientName || 'عميل معتمد';
            const pName = (quote as any).projectName || 'مشروع معتمد';

            return (
              <div
                key={quote.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-mono font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-[#1e3a8a]">
                          {qNum}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            quote.status === 'Approved' || quote.status === 'won'
                              ? 'bg-emerald-100 text-emerald-800'
                              : quote.status === 'sent_to_customer' || quote.status === 'Issued'
                              ? 'bg-blue-100 text-blue-800'
                              : quote.status === 'Rejected' || quote.status === 'lost'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {quote.status === 'Approved' || quote.status === 'won'
                            ? 'معتمد للتعاقد'
                            : quote.status === 'sent_to_customer' || quote.status === 'Issued'
                            ? 'تم تقديمه للعميل'
                            : quote.status === 'Rejected' || quote.status === 'lost'
                            ? 'مرفوض'
                            : 'مسودة'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        العميل: <strong className="text-slate-900">{cName}</strong> | المشروع: <strong className="text-slate-900">{pName}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-[11px] text-slate-400 block">القيمة الإجمالية</span>
                    <span className="text-base font-black text-[#1e3a8a]">
                      {quoteTotal.toLocaleString()} SAR
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      التاريخ: {quote.date || quote.createdAt?.split('T')[0]}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <span className="text-slate-500">
                    عدد البنود المسعرة: <strong>{(quote.items || []).length}</strong> بند
                  </span>

                  <div className="flex items-center gap-2">
                    {onViewQuote && (
                      <button
                        type="button"
                        onClick={() => onViewQuote(quote)}
                        className="px-3 py-1.5 bg-[#1e3a8a] text-white hover:bg-[#152e6f] rounded-lg font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة العرض</span>
                      </button>
                    )}

                    {onEditQuote && (
                      <button
                        type="button"
                        onClick={() => onEditQuote(quote)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                    )}

                    {onConvertToProject && (quote.status === 'Approved' || quote.status === 'won') && (
                      <button
                        type="button"
                        onClick={() => onConvertToProject(quote)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ترحيل إلى مشروع</span>
                      </button>
                    )}

                    {onDeleteQuote && (
                      <button
                        type="button"
                        onClick={() => onDeleteQuote(quote.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition"
                        title="حذف العرض"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
