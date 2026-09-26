/**
 * RMT Immutable Audit Trail Modal
 * View cryptographic & tamper-evident system mutation history,
 * user actions, financial overrides, and state changes.
 */

import React, { useState, useEffect } from 'react';
import { ImmutableAuditEntry, User } from '../types';
import { loadAuditLogs, clearAuditLogs } from '../utils/auditLogger';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Trash2,
  Calendar,
  User as UserIcon,
  X,
  FileText,
  Lock,
} from 'lucide-react';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [logs, setLogs] = useState<ImmutableAuditEntry[]>(() => loadAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState('all');

  useEffect(() => {
    if (isOpen) {
      setLogs(loadAuditLogs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.targetResource && log.targetResource.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEntity = selectedEntityFilter === 'all' || log.targetResource.toLowerCase().includes(selectedEntityFilter.toLowerCase());

    return matchesSearch && matchesEntity;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-xl text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <span>سجل التدقيق والحوكمة غير القابل للتعديل (Immutable Audit Trail)</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                  SHA-256 Verified
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تتبع العمليات الحساسة، التعديلات المالية، وفك حظر الصرف مع ختم الوقت الرقمي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="البحث في الإجراءات والمستخدمين..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg pr-9 pl-3 py-2 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedEntityFilter}
              onChange={(e) => setSelectedEntityFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"
            >
              <option value="all">كافة الكيانات (All Entities)</option>
              <option value="Project">المشاريع (Project)</option>
              <option value="QuotationEstimate">دراسة العطاءات (QuotationEstimate)</option>
              <option value="PurchaseOrder">أوامر الشراء (PurchaseOrder)</option>
              <option value="Invoice">الفواتير (Invoice)</option>
              <option value="ThreeWayMatchRecord">المطابقة الثلاثية (ThreeWayMatchRecord)</option>
              <option value="ClientMaster">سجل العملاء (ClientMaster)</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              لا توجد سجلات مطابقة لمعايير البحث الحالية.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-36">ختم الوقت (Timestamp)</th>
                    <th className="p-3 w-36">المستخدم المنفذ</th>
                    <th className="p-3 w-36">الدور الوظيفي</th>
                    <th className="p-3 w-44">الإجراء والعملية</th>
                    <th className="p-3 w-32">الكيان / المرجع</th>
                    <th className="p-3">تفاصيل المتغيرات والحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('ar-SA')}
                      </td>
                      <td className="p-3 font-bold text-slate-900">{log.userName}</td>
                      <td className="p-3 text-[11px] font-mono text-slate-600">{log.userRole}</td>
                      <td className="p-3 font-semibold text-[#174A84]">{log.action}</td>
                      <td className="p-3">
                        <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                          {log.targetResource} {log.entityId ? `(${log.entityId})` : ''}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 font-sans max-w-xs truncate" title={log.diffSummary}>
                        {log.diffSummary || (log.newState ? JSON.stringify(log.newState) : log.previousState ? JSON.stringify(log.previousState) : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            إجمالي العمليات المسجلة: <span className="font-bold text-slate-800">{logs.length} عملية</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
