import React, { useState, useMemo } from 'react';
import { Invoice, Project, Customer } from '../types';
import { generateCustomerSOAReport, CustomerSOAReport } from '../services/ledgerService';
import { CompanyHeader } from './CompanyHeader';
import { SignatureBox } from './SignatureBox';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import {
  X,
  Printer,
  FileSpreadsheet,
  Building2,
  Calendar,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Download,
  Filter,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface StatementOfAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: Invoice[];
  projects: Project[];
  customers: Customer[];
  initialCustomerId?: string;
  initialProjectId?: string;
}

export const StatementOfAccountModal: React.FC<StatementOfAccountModalProps> = ({
  isOpen,
  onClose,
  invoices = [],
  projects = [],
  customers = [],
  initialCustomerId,
  initialProjectId,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomerId || 'all'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || 'all'
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sync selection when initial props change
  React.useEffect(() => {
    if (isOpen) {
      if (initialCustomerId) setSelectedCustomerId(initialCustomerId);
      if (initialProjectId) setSelectedProjectId(initialProjectId);
    }
  }, [isOpen, initialCustomerId, initialProjectId]);

  // Derive unique customer list from invoices, projects and customers prop
  const customerList = useMemo(() => {
    if (!isOpen) return [];
    const map = new Map<string, { id: string; name: string }>();
    (customers || []).forEach((c) => {
      map.set(c.id, { id: c.id, name: c.companyName || (c as any).name || 'عميل' });
    });
    (invoices || []).forEach((inv) => {
      const id = inv?.customerId || inv?.customerName;
      if (id && !map.has(id)) {
        map.set(id, { id, name: inv?.customerName || id });
      }
    });
    return Array.from(map.values());
  }, [customers, invoices, isOpen]);

  // Filter invoices and projects by project if selected
  const scopedInvoices = useMemo(() => {
    if (selectedProjectId === 'all') return invoices;
    return invoices.filter((inv) => inv.projectId === selectedProjectId);
  }, [invoices, selectedProjectId]);

  const scopedProjects = useMemo(() => {
    if (selectedProjectId === 'all') return projects;
    return projects.filter((p) => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  // Generate Customer Statement of Account report from Central Ledger
  const report: CustomerSOAReport = useMemo(() => {
    return generateCustomerSOAReport(
      selectedCustomerId,
      scopedInvoices,
      scopedProjects,
      customers,
      startDate || undefined,
      endDate || undefined
    );
  }, [selectedCustomerId, scopedInvoices, scopedProjects, customers, startDate, endDate]);

  if (!isOpen) return null;

  const handlePrint = () => {
    executePrint('printable-statement-soa', {
      documentTitle: `كشف حساب رسمي للعميل - ${report.customerName}`,
    });
  };

  const handleOpenPrintPopup = () => {
    openPrintPopup(
      'printable-statement-soa',
      `كشف حساب رسمي للعميل - ${report.customerName}`
    );
  };

  const handleExportCSV = () => {
    const headers = [
      'التاريخ',
      'النوع',
      'المرجع',
      'المشروع',
      'البيان',
      'مدين شامل الضريبة (SAR)',
      'دائن مسدد (SAR)',
      'الرصيد التراكمي (SAR)',
    ];

    const rows = report.transactions.map((tx) => [
      tx.date,
      tx.type,
      tx.referenceNo,
      `"${tx.projectName}"`,
      `"${tx.description}"`,
      tx.debit.toFixed(2),
      tx.credit.toFixed(2),
      tx.runningBalance.toFixed(2),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Customer_SOA_${report.customerName.replace(/\s+/g, '_')}_${report.reportDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 print-modal-container"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 print-modal-content">
        {/* Top Control Bar (Hidden when Printing) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
              AR
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>كشف حساب العميل الشامل (Customer Statement of Account - SOA)</span>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-bold">
                  AR Sub-Ledger
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                سجل الحركات المالية المفوترة والدفعات المسددة والأرصدة المستحقة وأعمار الديون
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير Excel (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة كشف الحساب (Print / PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPrintPopup}
              className="hidden sm:flex px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium items-center gap-1 transition cursor-pointer"
              title="فتح في نافذة مستقلة للطباعة الخارجية"
            >
              <span>نافذة مستقلة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar (No-Print) */}
        <div className="no-print bg-slate-50 p-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              العميل المعتمد:
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full pr-8 pl-2 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs"
              >
                <option value="all">كافة العملاء (All Customers)</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              المشروع:
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full pr-8 pl-2 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs"
              >
                <option value="all">كافة المشاريع (All Projects)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              من تاريخ:
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pr-8 pl-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              إلى تاريخ:
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pr-8 pl-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Printable SOA Document */}
        <div className="p-8 sm:p-12 bg-white text-slate-900 font-sans" dir="rtl" id="printable-statement-soa">
          {/* Company Official Letterhead */}
          <CompanyHeader showDivider={true} />

          {/* Statement Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pb-4 border-t-2 border-b-2 border-slate-900">
            <div>
              <div className="inline-block px-3 py-1 bg-[#007A5A] text-white rounded text-xs font-black tracking-wider uppercase mb-1">
                STATEMENT OF ACCOUNT
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                كشف حساب مالي رسمي للعميل (AR Ledger)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Customer Financial Ledger & Statement of Invoices & Collections
              </p>
            </div>

            <div className="text-left font-mono text-xs space-y-1">
              <div>
                <span className="text-slate-500 font-sans">تاريخ الإصدار: </span>
                <span className="font-bold text-slate-800">{report.reportDate}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">العميل المحدد: </span>
                <span className="font-bold text-[#007A5A]">{report.customerName}</span>
              </div>
              {report.customerVatNo && (
                <div>
                  <span className="text-slate-500 font-sans">الرقم الضريبي: </span>
                  <span className="font-bold text-slate-700">{report.customerVatNo}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3 Real KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-bold">إجمالي المفوتر (شامل الضريبة 15%)</span>
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono">
                {report.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                Gross Invoiced Revenue with 15% VAT
              </span>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
              <div className="flex items-center justify-between text-xs text-emerald-800 mb-1">
                <span className="font-bold">إجمالي المحصل والمقبوض</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xl font-black text-emerald-700 font-mono">
                {report.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
                نسبة التحصيل:{' '}
                {report.totalInvoiced > 0
                  ? ((report.totalCollected / report.totalInvoiced) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40">
              <div className="flex items-center justify-between text-xs text-rose-800 mb-1">
                <span className="font-bold">صافي الرصيد المستحق (Balance Due)</span>
                <Receipt className="w-4 h-4 text-rose-700" />
              </div>
              <div className="text-xl font-black text-rose-700 font-mono">
                {report.netOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
              </div>
              <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block">
                مستحقات واجبة السداد على العميل
              </span>
            </div>
          </div>

          {/* Aging Breakdown (0-30, 31-60, 61-90, 90+ Days) */}
          <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>تحليل أعمار الديون (AR Aging):</span>
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              <span className="text-emerald-700">
                0-30 يوم: <b>{report.aging.current_0_30.toLocaleString()} SAR</b>
              </span>
              <span className="text-blue-700">
                31-60 يوم: <b>{report.aging.days_31_60.toLocaleString()} SAR</b>
              </span>
              <span className="text-amber-700">
                61-90 يوم: <b>{report.aging.days_61_90.toLocaleString()} SAR</b>
              </span>
              <span className="text-rose-700">
                +90 يوم: <b>{report.aging.over_90.toLocaleString()} SAR</b>
              </span>
            </div>
          </div>

          {/* Transactions Ledger Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6 shadow-2xs">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="p-3 w-24">التاريخ</th>
                  <th className="p-3 w-28">النوع</th>
                  <th className="p-3 w-36">المرجع</th>
                  <th className="p-3">المشروع والبيان</th>
                  <th className="p-3 w-28 text-left font-mono">مدين (SAR)</th>
                  <th className="p-3 w-28 text-left font-mono">دائن (SAR)</th>
                  <th className="p-3 w-32 text-left font-mono bg-slate-800 text-emerald-400">الرصيد التراكمي (SAR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {report.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                      لا توجد حركات مالية مسجلة وفقاً لمعايير البحث المحددة.
                    </td>
                  </tr>
                ) : (
                  report.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-slate-600">{tx.date}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                            tx.type === 'Invoice'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.type === 'Advance'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tx.type === 'Invoice'
                            ? 'فاتورة ضريبية'
                            : tx.type === 'Advance'
                            ? 'دفعة مقدمة'
                            : 'سند تحصيل'}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{tx.referenceNo}</td>
                      <td className="p-3 text-slate-700 font-medium">
                        <div className="font-bold text-slate-900">{tx.projectName}</div>
                        <div className="text-[11px] text-slate-500">{tx.description}</div>
                      </td>
                      <td className="p-3 font-mono text-left font-semibold text-slate-900">
                        {tx.debit > 0
                          ? tx.debit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>
                      <td className="p-3 font-mono text-left font-bold text-emerald-700">
                        {tx.credit > 0
                          ? tx.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '-'}
                      </td>
                      <td className="p-3 font-mono text-left font-black text-slate-900 bg-slate-50">
                        {tx.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-400">
                  <td colSpan={4} className="p-3 text-left">
                    الإجمالي النهائي (Grand Totals):
                  </td>
                  <td className="p-3 font-mono text-left text-slate-900">
                    {report.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 font-mono text-left text-emerald-800">
                    {report.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 font-mono text-left text-base font-black text-rose-700 bg-slate-200">
                    {report.netOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-300 text-xs text-center">
            <div>
              <SignatureBox
                roleKey="finance_accounts"
                label="إعداد الحسابات والمراجعة المالية"
                personName="Abdulrahman Al Moaili"
                personTitle="Finance & Accounts Lead"
                placeholderText="توقيع الإدارة المالية"
                heightClass="h-16"
              />
            </div>

            <div>
              <SignatureBox
                roleKey="projects_manager"
                label="اعتماد الإدارة العامة والمشاريع"
                personName="إدارة المشاريع — RMT"
                placeholderText="توقيع الاعتماد الإداري"
                heightClass="h-16"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
