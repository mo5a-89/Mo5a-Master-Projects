import React from 'react';
import { CompanyHeader } from './CompanyHeader';
import { DocumentFooter } from './DocumentFooter';
import { Printer, ArrowRight, Download } from 'lucide-react';

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => React.ReactNode;
}

export interface PrintReportViewProps {
  title: string;
  subtitle?: string;
  referenceNumber?: string;
  date?: string;
  metadata?: Array<{ label: string; value: string }>;
  columns: ReportColumn[];
  data: any[];
  summaryRows?: Array<{ label: string; value: string | number; isBold?: boolean }>;
  notes?: string[];
  onBack?: () => void;
  preparedBy?: string;
  approvedBy?: string;
  financeName?: string;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  title,
  subtitle,
  referenceNumber,
  date = new Date().toLocaleDateString('ar-SA'),
  metadata = [],
  columns,
  data,
  summaryRows = [],
  notes = [],
  onBack,
  preparedBy,
  approvedBy,
  financeName = '',
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 select-none" dir="rtl">
      {/* Top Action Bar (No-Print) */}
      <div className="no-print max-w-5xl mx-auto mb-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-base font-black text-slate-800">{title}</h2>
            <p className="text-xs text-slate-500">معاينة التقرير التنفيذي للطباعة والأرشفة</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-4 py-2 bg-[#007A5A] hover:bg-[#00654b] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة التقرير (Print / A4)</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-5xl mx-auto bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
        {/* Official Header */}
        <CompanyHeader />

        {/* Report Title & Metadata Banner */}
        <div className="my-6 border-y-2 border-slate-800 py-4 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
          </div>

          <div className="text-left text-xs font-mono space-y-1">
            {referenceNumber && (
              <div className="text-slate-800 font-bold">
                REF: <span className="text-[#174A84]">{referenceNumber}</span>
              </div>
            )}
            <div className="text-slate-500">DATE: {date}</div>
          </div>
        </div>

        {/* Custom Metadata Grid */}
        {metadata.length > 0 && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
            {metadata.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <span className="text-slate-500 text-[11px] block">{item.label}:</span>
                <span className="font-bold text-slate-800 block">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Data Table */}
        <div className="w-full overflow-x-auto mb-6">
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <th className="border border-slate-300 p-2.5 text-center w-12">#</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-slate-300 p-2.5 ${
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'left'
                        ? 'text-left font-mono'
                        : 'text-right'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="p-6 text-center text-slate-400 border border-slate-300"
                  >
                    لا توجد سجلات لعرضها في هذا التقرير
                  </td>
                </tr>
              ) : (
                data.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className={`border-b border-slate-200 ${
                      rowIdx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'
                    }`}
                  >
                    <td className="border border-slate-300 p-2 text-center font-mono text-slate-500">
                      {rowIdx + 1}
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`border border-slate-300 p-2 text-slate-800 ${
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'left'
                            ? 'text-left font-mono'
                            : 'text-right'
                        }`}
                      >
                        {col.format ? col.format(row[col.key], row) : row[col.key] || '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Aggregations */}
        {summaryRows.length > 0 && (
          <div className="max-w-xs ms-auto mb-6 bg-slate-50 p-3 rounded-xl border border-slate-300 space-y-1.5 text-xs">
            {summaryRows.map((sum, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between ${
                  sum.isBold
                    ? 'font-black text-slate-900 border-t border-slate-300 pt-1.5 text-sm'
                    : 'text-slate-600'
                }`}
              >
                <span>{sum.label}:</span>
                <span className="font-mono">
                  {typeof sum.value === 'number'
                    ? `${sum.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`
                    : sum.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 mb-1">ملاحظات واعتمادات:</h4>
            <ul className="list-disc list-inside space-y-0.5">
              {notes.map((n, idx) => (
                <li key={idx}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Official Document Footer Signatures */}
        <DocumentFooter
          variant="report"
          projectManagerName={approvedBy || 'Eng. Mokhtar Yousef'}
          projectManagerTitle="Project Cost & Operations Manager"
          projectManagerRoleKey="projects_manager"
          financeName={financeName}
          financeTitle="Finance & Accounts Lead"
          financeRoleKey="finance_accounts"
          className="mt-8 pt-6 border-t-2 border-slate-300"
        />
      </div>
    </div>
  );
};
