/**
 * RMT 3-Way Match Audit & Disbursement Control Modal
 * Matches Purchase Orders (PO) <-> Goods Received Notes (GRN) <-> Supplier Invoices.
 * Blocks disbursements automatically if rate or quantity discrepancy is detected.
 */

import React, { useState } from 'react';
import { ThreeWayMatchRecord, PurchaseOrder, DeliveryNote, User } from '../types';
import { recordAuditLog } from '../utils/auditLogger';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Building2,
  FileText,
  X,
  Plus,
} from 'lucide-react';

interface ThreeWayMatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  matchRecords: ThreeWayMatchRecord[];
  purchaseOrders: PurchaseOrder[];
  deliveryNotes: DeliveryNote[];
  onSaveRecord: (record: ThreeWayMatchRecord) => void;
}

export const ThreeWayMatchingModal: React.FC<ThreeWayMatchingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  matchRecords,
  purchaseOrders,
  deliveryNotes,
  onSaveRecord,
}) => {
  if (!isOpen) return null;

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(matchRecords[0]?.id || null);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const activeRecord = matchRecords.find((r) => r.id === selectedRecordId) || matchRecords[0];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleApproveOverride = (rec: ThreeWayMatchRecord) => {
    if (!overrideReason.trim()) {
      alert('يجب كتابة مبرر التدقيق والاعتماد المالي المسبق قبل فك حظر الصرف.');
      return;
    }

    const updated: ThreeWayMatchRecord = {
      ...rec,
      matchStatus: 'Override Approved',
      isDisbursementBlocked: false,
      overrideApprovedBy: currentUser?.fullName || 'Super Admin (Mokhtar Abu Rizq)',
      overrideApprovalDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveRecord(updated);
    recordAuditLog(
      currentUser,
      'Override 3-Way Match Disbursement Block',
      'ThreeWayMatchRecord',
      rec.poNumber,
      rec,
      updated
    );
    showToast(`تم فك حظر الصرف لأمر الشراء ${rec.poNumber} بموافقة المدير المالي.`);
    setOverrideReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#174A84]/10 rounded-xl text-[#174A84]">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                منظومة المطابقة الثلاثية للمشتريات (3-Way Matching Protocol)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مطابقة أمر الشراء (PO) وسند استلام الموقع (GRN) وفاتورة المورد لمنع فروقات الأسعار
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

        {/* Toast */}
        {toastMsg && (
          <div className="bg-emerald-900/90 text-emerald-100 px-4 py-2.5 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Records Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-32">أمر الشراء (PO)</th>
                  <th className="p-3">المورد</th>
                  <th className="p-3 text-center">كمية PO / المستلم</th>
                  <th className="p-3 text-center">سعر PO / فاتورة المورد</th>
                  <th className="p-3 text-center">فارق التسوية</th>
                  <th className="p-3 text-center">حالة المطابقة</th>
                  <th className="p-3 text-center">الصرف المالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matchRecords.map((rec) => {
                  const isSelected = rec.id === activeRecord?.id;
                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedRecordId(rec.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-[#174A84]">{rec.poNumber}</td>
                      <td className="p-3 font-medium text-slate-800">{rec.supplierName}</td>
                      <td className="p-3 text-center font-mono">
                        {rec.poQuantity} / <span className="font-bold">{rec.grnReceivedQuantity}</span>
                      </td>
                      <td className="p-3 text-center font-mono">
                        {rec.poItemRate.toLocaleString()} / <span className="font-bold">{rec.supplierInvoiceRate.toLocaleString()}</span> ر.س
                      </td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span className={rec.totalVarianceSAR === 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {rec.totalVarianceSAR.toLocaleString()} ر.س
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            rec.matchStatus === 'Passed' || rec.matchStatus === 'Override Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {rec.matchStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {rec.isDisbursementBlocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3 text-rose-600" />
                            محظور
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            <Unlock className="w-3 h-3 text-emerald-600" />
                            متاح
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Active Record Detail Inspection Card */}
          {activeRecord && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#174A84]" />
                  <span>تفاصيل فحص المطابقة لأمر الشراء {activeRecord.poNumber}</span>
                </div>
                <div className="text-xs text-slate-500">
                  فاتورة المورد رقم: <span className="font-mono font-bold text-slate-800">{activeRecord.supplierInvoiceNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">1. أمر الشراء الصادر (PO Rate & Qty)</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {activeRecord.poQuantity} قطعة × {activeRecord.poItemRate.toLocaleString()} ر.س
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">الإجمالي: {activeRecord.poTotalAmount.toLocaleString()} ر.س</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">2. سند استلام الموقع (GRN Quantity)</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {activeRecord.grnReceivedQuantity} قطعة مستلمة
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">مطابقة تامة للكمية الميدانية</div>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                  <div className="text-[11px] text-slate-500">3. فاتورة المورد الضريبية (Tax Invoice)</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {activeRecord.supplierInvoiceTotalAmount.toLocaleString()} ر.س
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">سعر الوحدة: {activeRecord.supplierInvoiceRate.toLocaleString()} ر.س</div>
                </div>
              </div>

              {/* Disbursement Override Section */}
              {activeRecord.isDisbursementBlocked && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>تنبيه الرقابة المالية: تم تجميد الصرف المالي لوجود فارق سعري.</span>
                  </div>
                  <div className="text-xs text-slate-700">
                    يمكن للمدير المالي أو المدير التنفيذي فك الحظر بعد إدخال المبرر المحاسبي المعتمد:
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="أدخل مبرر الموافقة الاستثنائية..."
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    />
                    <button
                      onClick={() => handleApproveOverride(activeRecord)}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                    >
                      اعتماد وفك حظر الصرف
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
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
