import React, { useState, useMemo } from 'react';
import { PurchaseOrder, Supplier, Project } from '../types';
import { generateVendorSOAReport, VendorSOAReport } from '../services/ledgerService';
import { CompanyHeader } from './CompanyHeader';
import { SignatureBox } from './SignatureBox';
import { executePrint } from '../utils/printUtils';
import {
  X,
  Printer,
  FileSpreadsheet,
  Building2,
  Calendar,
  Layers,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  Filter,
  Download,
  ShieldCheck,
} from 'lucide-react';

export interface ProcurementSOAProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  projects: Project[];
  initialSupplierId?: string;
}

export const ProcurementSOA: React.FC<ProcurementSOAProps> = ({
  isOpen,
  onClose,
  purchaseOrders = [],
  suppliers = [],
  projects = [],
  initialSupplierId,
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSupplierId || 'all'
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Extract unique suppliers list
  const supplierList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    (suppliers || []).forEach((s) => {
      map.set(s.id, { id: s.id, name: s.name });
    });
    (purchaseOrders || []).forEach((po) => {
      const id = po.supplierId || po.vendorName;
      if (id && !map.has(id)) {
        map.set(id, { id, name: po.vendorName || po.supplierName || id });
      }
    });
    return Array.from(map.values());
  }, [suppliers, purchaseOrders]);

  // Filter purchase orders by project if selected
  const scopedPOs = useMemo(() => {
    if (selectedProjectId === 'all') return purchaseOrders;
    return purchaseOrders.filter((po) => po.projectId === selectedProjectId);
  }, [purchaseOrders, selectedProjectId]);

  // Generate Vendor Statement of Account from Central Ledger
  const report: VendorSOAReport = useMemo(() => {
    return generateVendorSOAReport(
      selectedSupplierId,
      scopedPOs,
      suppliers,
      startDate || undefined,
      endDate || undefined
    );
  }, [selectedSupplierId, scopedPOs, suppliers, startDate, endDate]);

  if (!isOpen) return null;

  const handlePrint = () => {
    executePrint('vendor-soa-print-content', {
      documentTitle: `كشف حساب المورد - ${report.supplierName}`,
    });
  };

  const handleExportCSV = () => {
    const headers = [
      'رقم أمر الشراء (PO)',
      'التاريخ',
      'المشروع',
      'البيان',
      'قيمة أمر الشراء شامل الضريبة (SAR)',
      'المبلغ المسدد (SAR)',
      'المتبقي المستحق (SAR)',
      'حالة التوريد',
      'حالة السداد',
    ];

    const rows = report.transactions.map((tx) => [
      tx.poNumber,
      tx.date,
      `"${tx.projectName}"`,
      `"${tx.description}"`,
      tx.poTotal.toFixed(2),
      tx.paidAmount.toFixed(2),
      tx.balanceDue.toFixed(2),
      `"${tx.fulfillmentStatus}"`,
      `"${tx.paymentStatus}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Vendor_SOA_${report.supplierName.replace(/\s+/g, '_')}_${report.reportDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-6 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Action & Control Bar (Non-Printable) */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                <span>كشف حساب الموردين والالتزامات (Vendor Statement of Account)</span>
                <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-bold">
                  AP Sub-Ledger
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                متابعة مديونيات أوامر الشراء، الدفعات المسددة، والرصيد المتبقي المستحق للموردين
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>تصدير Excel (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة كشف الحساب</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls (Non-Printable) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Supplier Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              المورد المعتمد:
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
              >
                <option value="all">-- كافة الموردين (المحفظة الكاملة) --</option>
                {supplierList.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              المشروع:
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 absolute right-2.5 top-2.5 text-slate-400" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
              >
                <option value="all">-- كافة المشاريع --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Start Date */}
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
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>
          </div>

          {/* End Date */}
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
                className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Printable Viewport Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60" id="vendor-soa-print-content">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200/80 space-y-6 max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none">
            {/* Corporate Letterhead */}
            <CompanyHeader />

            {/* Document Title & Meta Box */}
            <div className="border-t-2 border-b-2 border-amber-600 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900">
                  كشف حساب المورد والالتزامات المالية
                </h1>
                <p className="text-xs text-slate-500 font-bold">
                  VENDOR STATEMENT OF ACCOUNT & AP COMMITMENTS
                </p>
              </div>

              <div className="text-xs text-slate-600 space-y-1 text-center sm:text-left">
                <div>
                  <span className="text-slate-400 font-medium">اسم المورد: </span>
                  <span className="font-black text-slate-900">{report.supplierName}</span>
                </div>
                {report.supplierVatNo && (
                  <div>
                    <span className="text-slate-400 font-medium">الرقم الضريبي للمورد: </span>
                    <span className="font-mono font-bold text-slate-800">{report.supplierVatNo}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 font-medium">تاريخ إصدار الكشف: </span>
                  <span className="font-mono font-bold text-slate-800">{report.reportDate}</span>
                </div>
              </div>
            </div>

            {/* Real KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Total Committed POs */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                <span className="text-xs text-amber-800 font-bold block mb-1">
                  إجمالي أوامر الشراء الصادرة
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-950">
                  {report.totalCommittedPOs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-sans text-amber-700">SAR</span>
                </div>
                <span className="text-[10px] text-amber-600 font-semibold mt-1 block">
                  شامل 15% ضريبة ({report.poCount} أوامر شراء)
                </span>
              </div>

              {/* Card 2: Total Paid to Vendor */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <span className="text-xs text-emerald-800 font-bold block mb-1">
                  إجمالي المبالغ المسددة للمورد
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-950">
                  {report.totalPaidToVendor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-sans text-emerald-700">SAR</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                  نسبة السداد:{' '}
                  {report.totalCommittedPOs > 0
                    ? ((report.totalPaidToVendor / report.totalCommittedPOs) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>

              {/* Card 3: Net Outstanding Payables */}
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl">
                <span className="text-xs text-rose-800 font-bold block mb-1">
                  صافي الرصيد المتبقي المستحق
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-rose-950">
                  {report.netOutstandingPayables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-sans text-rose-700">SAR</span>
                </div>
                <span className="text-[10px] text-rose-600 font-semibold mt-1 block">
                  التزامات مستحقة الأداء للمورد
                </span>
              </div>
            </div>

            {/* Real PO Ledger Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-3">أمر الشراء (PO)</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المشروع</th>
                    <th className="p-3 text-left">قيمة الأمر (SAR)</th>
                    <th className="p-3 text-left">المسدد (SAR)</th>
                    <th className="p-3 text-left">المتبقي (SAR)</th>
                    <th className="p-3 text-center">حالة السداد</th>
                    <th className="p-3 text-center">حالة التوريد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد أوامر شراء مسجلة لهذا المورد في النطاق المحدد.
                      </td>
                    </tr>
                  ) : (
                    report.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-bold text-amber-700">
                          {tx.poNumber}
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {tx.date}
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {tx.projectName}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 text-left">
                          {tx.poTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 text-left">
                          {tx.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-600 text-left">
                          {tx.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.paymentStatus === 'Paid in Full'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.paymentStatus === 'Partially Paid'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {tx.paymentStatus === 'Paid in Full'
                              ? 'مسدد بالكامل'
                              : tx.paymentStatus === 'Partially Paid'
                              ? 'سداد جزئي'
                              : 'غير مسدد'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px] font-semibold">
                            {tx.fulfillmentStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="p-3 text-slate-900">
                      الإجمالي العام لكشف الحساب
                    </td>
                    <td className="p-3 font-mono font-black text-slate-900 text-left">
                      {report.totalCommittedPOs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono font-black text-emerald-700 text-left">
                      {report.totalPaidToVendor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono font-black text-rose-700 text-left">
                      {report.netOutstandingPayables.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={2} className="p-3 text-center text-slate-500 font-mono text-[11px]">
                      SAR (شامل ضريبة 15%)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Official Governance Signatures */}
            <div className="pt-4">
              <SignatureBox />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
