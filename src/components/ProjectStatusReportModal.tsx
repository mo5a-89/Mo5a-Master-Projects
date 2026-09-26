import React from 'react';
import { Project, CustomerQuotation } from '../types';
import { CompanyHeader } from './CompanyHeader';
import { getNormalizedProjectStatus } from '../utils/projectStatusUtils';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import { MobileViewerTopBar, useModalBackDismiss } from './MobileViewerTopBar';
import {
  X,
  Printer,
  Trophy,
  Clock,
  XCircle,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface ProjectStatusReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  customerQuotations: CustomerQuotation[];
}

export const ProjectStatusReportModal: React.FC<ProjectStatusReportModalProps> = ({
  isOpen,
  onClose,
  projects,
  customerQuotations,
}) => {
  // Mobile & hardware back button dismiss support
  useModalBackDismiss(onClose);

  if (!isOpen) return null;

  const wonProjects = projects.filter((p) => getNormalizedProjectStatus(p.status) === 'Won');
  const underPricingProjects = projects.filter((p) => getNormalizedProjectStatus(p.status) === 'Under Pricing');
  const lostProjects = projects.filter((p) => getNormalizedProjectStatus(p.status) === 'Lost');

  const getProjectQuoteTotal = (projectId: string) => {
    const quotes = customerQuotations.filter((q) => q.projectId === projectId);
    return quotes.reduce((sum, q) => sum + (q.totals?.customerSellingPrice || 0), 0);
  };

  const wonTotalValue = wonProjects.reduce((sum, p) => sum + (getProjectQuoteTotal(p.id) || p.budget || 0), 0);
  const underPricingTotalValue = underPricingProjects.reduce((sum, p) => sum + (getProjectQuoteTotal(p.id) || p.budget || 0), 0);
  const lostTotalValue = lostProjects.reduce((sum, p) => sum + (getProjectQuoteTotal(p.id) || p.budget || 0), 0);

  const winRate = projects.length > 0 ? (wonProjects.length / projects.length) * 100 : 0;

  const handlePrint = () => {
    executePrint('printable-status-report', {
      documentTitle: 'تقرير حالات الترسية والمناقصات الرسمي',
    });
  };

  const handleOpenPrintPopup = () => {
    openPrintPopup('printable-status-report', 'تقرير حالات الترسية والمناقصات الرسمي');
  };

  return (
    <div
      id="project-status-report-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto print-modal-container"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-none sm:rounded-2xl max-w-5xl w-full min-h-screen sm:min-h-0 sm:max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 print-modal-content">
        {/* Sticky Mobile-Friendly Top Action Bar */}
        <MobileViewerTopBar
          title="تقرير حالات الترسية والمناقصات الرسمي"
          subtitle={`مشاريع فائزة: ${wonProjects.length} • قيد التسعير: ${underPricingProjects.length} • مفقودة: ${lostProjects.length}`}
          onClose={onClose}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 sm:px-3.5 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">طباعة التقرير</span>
                <span className="sm:hidden">طباعة</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPrintPopup}
                className="hidden md:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium items-center gap-1 transition cursor-pointer"
                title="فتح في نافذة مستقلة للطباعة الخارجية"
              >
                <span>نافذة مستقلة</span>
              </button>
            </div>
          }
        />

        {/* Printable Body */}
        <div
          id="printable-status-report"
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:m-0"
        >
          <CompanyHeader />

          <div className="text-center py-2 border-b-2 border-[#007A5A] mb-4">
            <h1 className="text-lg font-black text-[#174A84] tracking-wide">
              تقرير مؤشرات الترسية ومتابعة المشاريع (TENDERING & PROJECT OUTCOME AUDIT)
            </h1>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              تاريخ التقرير: <span className="font-mono font-bold text-slate-700">{new Date().toLocaleDateString('ar-SA')}</span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] text-emerald-800 font-bold block">مشاريع فزت بها (Won)</span>
              <div className="text-xl font-mono font-black text-emerald-700 mt-1">
                {wonProjects.length}{' '}
                <span className="text-xs font-sans font-normal text-emerald-600">مشروع</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-mono block mt-1">
                {wonTotalValue.toLocaleString()} SAR
              </span>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[11px] text-amber-800 font-bold block">قيد التسعير (In Review)</span>
              <div className="text-xl font-mono font-black text-amber-700 mt-1">
                {underPricingProjects.length}{' '}
                <span className="text-xs font-sans font-normal text-amber-600">عرض مفتوح</span>
              </div>
              <span className="text-[10px] text-amber-600 font-mono block mt-1">
                {underPricingTotalValue.toLocaleString()} SAR
              </span>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[11px] text-rose-800 font-bold block">خسرته (Lost)</span>
              <div className="text-xl font-mono font-black text-rose-700 mt-1">
                {lostProjects.length}{' '}
                <span className="text-xs font-sans font-normal text-rose-600">مشروع</span>
              </div>
              <span className="text-[10px] text-rose-600 font-mono block mt-1">
                {lostTotalValue.toLocaleString()} SAR
              </span>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[11px] text-blue-800 font-bold block">معدل الترسية (Win Rate)</span>
              <div className="text-xl font-mono font-black text-[#1e3a8a] mt-1">
                {winRate.toFixed(1)}%
              </div>
              <span className="text-[10px] text-blue-600 block mt-1">
                من إجمالي {projects.length} مشروع مسجل
              </span>
            </div>
          </div>

          {/* Won Projects Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 pb-1 border-b border-emerald-200">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <span>المشاريع المعتمدة والفائزة (Awarded & Active Projects)</span>
            </h3>
            <table className="w-full text-[11px] text-right border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-2 border border-slate-200">رقم المشروع</th>
                  <th className="p-2 border border-slate-200">اسم المشروع</th>
                  <th className="p-2 border border-slate-200">العميل</th>
                  <th className="p-2 border border-slate-200 text-center">مؤشر الإنجاز</th>
                  <th className="p-2 border border-slate-200 text-left">قيمة المشروع (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {wonProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-2 border border-slate-200 font-mono font-bold">{p.projectNumber}</td>
                    <td className="p-2 border border-slate-200 font-bold">{p.name}</td>
                    <td className="p-2 border border-slate-200">{p.customerName}</td>
                    <td className="p-2 border border-slate-200 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {p.executionStatus || 'قيد التنفيذ'}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-200 text-left font-mono font-bold text-[#007A5A]">
                      {(getProjectQuoteTotal(p.id) || p.budget || 0).toLocaleString()} SAR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Under Pricing Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 pb-1 border-b border-amber-200">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>العروض المفتوحة وقيد الدراسة (Open Quotations Under Review)</span>
            </h3>
            <table className="w-full text-[11px] text-right border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-2 border border-slate-200">رقم المشروع</th>
                  <th className="p-2 border border-slate-200">اسم المشروع</th>
                  <th className="p-2 border border-slate-200">العميل</th>
                  <th className="p-2 border border-slate-200 text-left">قيمة العرض المبدئي (SAR)</th>
                </tr>
              </thead>
              <tbody>
                {underPricingProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-2 border border-slate-200 font-mono font-bold">{p.projectNumber}</td>
                    <td className="p-2 border border-slate-200 font-bold">{p.name}</td>
                    <td className="p-2 border border-slate-200">{p.customerName}</td>
                    <td className="p-2 border border-slate-200 text-left font-mono font-bold text-amber-700">
                      {(getProjectQuoteTotal(p.id) || p.budget || 0).toLocaleString()} SAR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lost Projects with Reasons */}
          {lostProjects.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-rose-800 flex items-center gap-1.5 pb-1 border-b border-rose-200">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>المشاريع غير المرساة مع بيان الأسباب (Lost Projects & Analysis)</span>
              </h3>
              <table className="w-full text-[11px] text-right border-collapse border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="p-2 border border-slate-200">رقم المشروع</th>
                    <th className="p-2 border border-slate-200">اسم المشروع</th>
                    <th className="p-2 border border-slate-200">العميل</th>
                    <th className="p-2 border border-slate-200">سبب عدم الترسية (Loss Reason)</th>
                    <th className="p-2 border border-slate-200 text-left">قيمة العرض (SAR)</th>
                  </tr>
                </thead>
                <tbody>
                  {lostProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2 border border-slate-200 font-mono font-bold">{p.projectNumber}</td>
                      <td className="p-2 border border-slate-200 font-bold">{p.name}</td>
                      <td className="p-2 border border-slate-200">{p.customerName}</td>
                      <td className="p-2 border border-slate-200 text-rose-700 font-medium">
                        {p.lossReason || 'لم يحدد سبب'}
                      </td>
                      <td className="p-2 border border-slate-200 text-left font-mono font-bold text-slate-600">
                        {(getProjectQuoteTotal(p.id) || p.budget || 0).toLocaleString()} SAR
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs text-center">
            <div className="space-y-4">
              <span className="font-bold text-slate-800 block">إعداد / مهندس التسعير والمناقصات</span>
              <div className="h-10 border-b border-dashed border-slate-400 mx-12 flex items-center justify-center text-slate-400 text-[11px]">
                Eng. Estimation
              </div>
            </div>
            <div className="space-y-4">
              <span className="font-bold text-slate-800 block">اعتماد المدير العام / إدارة المؤسسة</span>
              <div className="h-10 border-b border-dashed border-slate-400 mx-12 flex items-center justify-center text-slate-400 text-[11px]">
                (مؤسسة صناع الموارد للتجارة RMT)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
