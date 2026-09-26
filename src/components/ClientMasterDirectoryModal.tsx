/**
 * RMT Client Master Directory & Framework Contracts Modal
 * Strict KSA VAT (15 digits), CR (10 digits), Credit Limits, and Active Framework Contracts.
 */

import React, { useState } from 'react';
import { ClientMaster, FrameworkContract, User } from '../types';
import { recordAuditLog } from '../utils/auditLogger';
import {
  Building,
  Plus,
  ShieldCheck,
  FileText,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from 'lucide-react';

interface ClientMasterDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  clients: ClientMaster[];
  onSaveClient: (client: ClientMaster) => void;
}

export const ClientMasterDirectoryModal: React.FC<ClientMasterDirectoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  clients,
  onSaveClient,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.customerId || '');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [newClient, setNewClient] = useState<Partial<ClientMaster>>({
    companyName: '',
    companyNameAr: '',
    taxId: '',
    crNumber: '',
    creditLimit: 1000000,
    currentBalance: 0,
    paymentTerms: '30 Days Net / 10% Advance',
    contactPerson: '',
    phone: '',
    email: '',
    city: 'الدمام / الخبر',
    address: '',
    status: 'Active',
    frameworkContracts: [],
  });

  if (!isOpen) return null;

  const activeClient = clients.find((c) => c.customerId === selectedClientId) || clients[0];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newClient.companyNameAr || !newClient.taxId) {
      alert('يرجى تعبئة اسم المنشأة والرقم الضريبي.');
      return;
    }

    if (newClient.taxId.length !== 15) {
      alert('تنبيه نظام هيئة الزكاة والضريبة: الرقم الضريبي يجب أن يتكون من 15 رقماً.');
      return;
    }

    const created: ClientMaster = {
      customerId: `cust-${Date.now()}`,
      companyName: newClient.companyName || newClient.companyNameAr,
      companyNameAr: newClient.companyNameAr,
      taxId: newClient.taxId,
      crNumber: newClient.crNumber || '2050000000',
      creditLimit: Number(newClient.creditLimit) || 1000000,
      currentBalance: 0,
      paymentTerms: newClient.paymentTerms || '30 Days Net',
      contactPerson: newClient.contactPerson || 'الإدارة التنفيذية',
      phone: newClient.phone || '',
      email: newClient.email || '',
      city: newClient.city || 'الدمام',
      address: newClient.address || '',
      status: 'Active',
      frameworkContracts: [
        {
          id: `fc-${Date.now()}`,
          contractNumber: `FC-${Date.now().toString().slice(-4)}`,
          title: 'اتفاقية توريد وتنفيذ كهروميكانيكي إطارية',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: '2028-12-31',
          creditLimit: Number(newClient.creditLimit) || 1000000,
          paymentTermDays: 30,
          discountRatePercent: 0,
          isActive: true,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveClient(created);
    recordAuditLog(currentUser, 'Create ClientMaster Record', 'ClientMaster', created.customerId, null, created);
    showToast(`تم تسجيل العميل الجديد (${created.companyNameAr}) بنجاح.`);
    setIsCreatingNew(false);
    setSelectedClientId(created.customerId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#174A84]/10 rounded-xl text-[#174A84]">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                دليل العملاء الرئيسي والعقود الإطارية (Client Master Directory)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                إدارة السجلات الضريبية الرسمية، الحدود الائتمانية، والاتفاقيات الإطارية المعتمدة
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Client List Left Column */}
          <div className="space-y-3 border-r md:border-l-0 md:border-r border-slate-200 pr-0 md:pr-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">قائمة كبار العملاء ({clients.length})</span>
              <button
                onClick={() => setIsCreatingNew(true)}
                className="text-xs font-bold text-[#174A84] hover:text-[#123866] flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded border border-blue-200"
              >
                <Plus className="w-3.5 h-3.5" />
                عميل جديد
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {clients.map((client) => {
                const isSelected = client.customerId === activeClient?.customerId && !isCreatingNew;
                return (
                  <div
                    key={client.customerId}
                    onClick={() => {
                      setSelectedClientId(client.customerId);
                      setIsCreatingNew(false);
                    }}
                    className={`p-3.5 rounded-xl border text-right cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#174A84] ring-1 ring-[#174A84]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-xs">{client.companyNameAr}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{client.companyName}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">VAT: {client.taxId}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Client Details / Creation Form Right Column */}
          <div className="md:col-span-2 space-y-5">
            {isCreatingNew ? (
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#174A84]" />
                  <span>تسجيل عميل استراتيجي جديد (Master Client Creation)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">اسم المنشأة باللغة العربية *</label>
                    <input
                      type="text"
                      required
                      value={newClient.companyNameAr || ''}
                      onChange={(e) => setNewClient({ ...newClient, companyNameAr: e.target.value })}
                      placeholder="شركة..."
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">اسم المنشأة باللغة الإنجليزية</label>
                    <input
                      type="text"
                      value={newClient.companyName || ''}
                      onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
                      placeholder="Company Name Ltd."
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">الرقم الضريبي (15 رقم) *</label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      value={newClient.taxId || ''}
                      onChange={(e) => setNewClient({ ...newClient, taxId: e.target.value })}
                      placeholder="300000000000003"
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">رقم السجل التجاري (10 أرقام)</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={newClient.crNumber || ''}
                      onChange={(e) => setNewClient({ ...newClient, crNumber: e.target.value })}
                      placeholder="2050000000"
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">الحد الائتماني (SAR)</label>
                    <input
                      type="number"
                      value={newClient.creditLimit || 1000000}
                      onChange={(e) => setNewClient({ ...newClient, creditLimit: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">شروط الدفع القياسية</label>
                    <input
                      type="text"
                      value={newClient.paymentTerms || ''}
                      onChange={(e) => setNewClient({ ...newClient, paymentTerms: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-4 py-2 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold rounded-lg bg-[#174A84] text-white hover:bg-[#123866]"
                  >
                    حفظ وتسجيل العميل
                  </button>
                </div>
              </form>
            ) : activeClient ? (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{activeClient.companyNameAr}</h4>
                    <div className="text-xs text-slate-500 mt-0.5">{activeClient.companyName}</div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 font-mono mt-2">
                      <span>VAT: {activeClient.taxId}</span>
                      <span>CR: {activeClient.crNumber}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    {activeClient.status}
                  </span>
                </div>

                {/* Financial Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="text-[11px] text-slate-500 font-medium">الحد الائتماني المعتمد</div>
                    <div className="text-base font-bold text-slate-900 font-mono mt-1">
                      {activeClient.creditLimit.toLocaleString()} ر.س
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="text-[11px] text-slate-500 font-medium">الرصيد القائم المستحق</div>
                    <div className="text-base font-bold text-[#174A84] font-mono mt-1">
                      {activeClient.currentBalance.toLocaleString()} ر.س
                    </div>
                  </div>
                </div>

                {/* Framework Contracts */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-[#174A84]" />
                    <span>الاتفاقيات الإطارية السارية (Active Framework Agreements):</span>
                  </div>
                  {activeClient.frameworkContracts?.map((fc) => (
                    <div key={fc.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span>{fc.title}</span>
                        <span className="font-mono text-emerald-700">{fc.contractNumber}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>سريان العقد: {fc.startDate} إلى {fc.endDate}</span>
                        <span>فترة السداد: {fc.paymentTermDays} يوماً</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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
