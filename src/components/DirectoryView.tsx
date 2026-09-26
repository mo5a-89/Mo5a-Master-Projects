import React, { useState } from 'react';
import { Customer, Supplier, SystemDiscipline, SYSTEM_DEFINITIONS } from '../types';
import {
  Users,
  Building,
  CreditCard,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Globe,
  Tag,
  Briefcase,
  X,
  ExternalLink,
  Edit2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface DirectoryViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  initialTab?: 'suppliers' | 'customers';
  onOpenBusinessCardModal: () => void;
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onAddSupplier: (supplier: Supplier) => void;
  onUpdateSupplier?: (supplier: Supplier) => void;
  onDeleteSupplier?: (supplierId: string) => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  customers,
  suppliers,
  initialTab,
  onOpenBusinessCardModal,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}) => {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'customers'>(initialTab || 'suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Sync with initialTab if it changes from external navigation
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Customer Edit & Delete States
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  // Supplier Edit & Delete States
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [position, setPosition] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [notes, setNotes] = useState('');

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.nameAr && s.nameAr.includes(searchQuery)) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.mobile.includes(searchQuery) ||
      (s.bankName && s.bankName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.iban && s.iban.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredCustomers = customers.filter(
    (c) =>
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.companyNameAr && c.companyNameAr.includes(searchQuery)) ||
      c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mobile.includes(searchQuery) ||
      (c.bankName && c.bankName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.iban && c.iban.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSaveEntity = () => {
    if (!name.trim()) return;

    if (activeTab === 'customers') {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        companyName: name,
        companyNameAr: nameAr,
        contactPerson: contactPerson || 'Authorized Representative',
        position: position || 'Procurement Manager',
        mobile,
        email,
        address,
        website,
        bankName,
        iban,
        swiftCode,
        accountName: accountName || name,
        notes,
        createdAt: new Date().toISOString(),
      };
      onAddCustomer(newCust);
    } else {
      const newSupp: Supplier = {
        id: `supp-${Date.now()}`,
        name,
        nameAr,
        contactPerson: contactPerson || 'Sales Engineer',
        position: position || 'Sales & Technical Support',
        mobile,
        email,
        address,
        website,
        bankName,
        iban,
        swiftCode,
        accountName: accountName || name,
        systems: ['fire_fighting', 'mechanical'],
        brands: [],
        notes,
        createdAt: new Date().toISOString(),
      };
      onAddSupplier(newSupp);
    }

    setShowAddModal(false);
    setName('');
    setNameAr('');
    setContactPerson('');
    setPosition('');
    setMobile('');
    setEmail('');
    setAddress('');
    setWebsite('');
    setBankName('');
    setIban('');
    setSwiftCode('');
    setAccountName('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">
            دليل العملاء والموردين (Customers & Suppliers Directory)
          </h2>
          <p className="text-xs text-slate-500">
            إدارة بيانات الاتصال، البطاقات التعريفية، والأنظمة التخصصية المعتمدة
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenBusinessCardModal}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>مسح بطاقة عمل (Scan Business Card)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة {activeTab === 'suppliers' ? 'مورد' : 'عميل'} جديد</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'bg-[#007A5A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>الموردون (Suppliers)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
              {suppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`py-2 px-4 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'customers'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>العملاء (Customers)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
              {customers.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Search ${activeTab} by name, contact, mobile...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#007A5A]"
          />
        </div>
      </div>

      {/* Cards Grid */}
      {activeTab === 'suppliers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSuppliers.map((supp) => (
            <div
              key={supp.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#007A5A] transition space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{supp.name}</h3>
                  {supp.nameAr && (
                    <p className="text-xs text-slate-500 font-cairo">{supp.nameAr}</p>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-[#007A5A] font-semibold">
                  Supplier
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="font-medium text-slate-800">
                  {supp.contactPerson} {supp.position && <span className="text-slate-400 text-[11px]">({supp.position})</span>}
                </div>
                <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{supp.mobile}</span>
                </div>
                {supp.email && (
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sky-700">{supp.email}</span>
                  </div>
                )}
                {supp.address && (
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{supp.address}</span>
                  </div>
                )}
                {supp.bankName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-100 font-mono">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold">{supp.bankName}:</span>
                    <span className="truncate">{supp.iban || supp.accountNumber}</span>
                  </div>
                )}
              </div>

              {/* Brands & Systems Tags */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                {(supp.systems || []).map((sys) => {
                  const def = SYSTEM_DEFINITIONS.find((s) => s.id === sys);
                  return (
                    <span
                      key={sys}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                    >
                      {def?.nameEn || sys}
                    </span>
                  );
                })}
                {supp.brands?.map((b) => (
                  <span
                    key={b}
                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium"
                  >
                    🏷️ {b}
                  </span>
                ))}
              </div>

              {/* Action Buttons for Supplier (Edit / Delete) */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(supp)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  title="تعديل بيانات المورد"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>تعديل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingSupplier(supp)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  title="حذف المورد وتحديث النظام"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-[#1E3A8A] transition space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{cust.companyName}</h3>
                  {cust.companyNameAr && (
                    <p className="text-xs text-slate-500 font-cairo">{cust.companyNameAr}</p>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold">
                  Customer
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="font-medium text-slate-800">
                  {cust.contactPerson} {cust.position && <span className="text-slate-400 text-[11px]">({cust.position})</span>}
                </div>
                <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{cust.mobile}</span>
                </div>
                {cust.email && (
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sky-700">{cust.email}</span>
                  </div>
                )}
                {cust.address && (
                  <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cust.address}</span>
                  </div>
                )}
                {cust.bankName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-blue-800 bg-blue-50/70 p-1.5 rounded-lg border border-blue-100 font-mono">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-semibold">{cust.bankName}:</span>
                    <span className="truncate">{cust.iban || cust.accountNumber}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons for Customer (Edit / Delete) */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(cust)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-1 transition"
                  title="تعديل بيانات العميل وتحديثها في كافة صفحات النظام"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>تعديل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingCustomer(cust)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition"
                  title="حذف العميل وتحديث النظام"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Add Entity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                إضافة {activeTab === 'suppliers' ? 'مورد (Supplier)' : 'عميل (Customer)'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    اسم الشركة (EN)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SFFECO Global"
                    className="w-full p-2 border border-slate-300 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    الاسم بالعربي (AR)
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="سفيكو العالمية"
                    className="w-full p-2 border border-slate-300 rounded outline-none font-cairo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    الشخص المسؤول
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Eng. Mohammad"
                    className="w-full p-2 border border-slate-300 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Sales Manager"
                    className="w-full p-2 border border-slate-300 rounded outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    رقم الجوال
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+966 50 000 0000"
                    className="w-full p-2 border border-slate-300 rounded outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@company.sa"
                    className="w-full p-2 border border-slate-300 rounded outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  العنوان والموقع
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dammam, Saudi Arabia"
                  className="w-full p-2 border border-slate-300 rounded outline-none"
                />
              </div>

              {/* Bank Details Section */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 border-b border-slate-200/80 pb-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>البيانات المصرفية والحساب البنكي (Bank Details)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">اسم البنك</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Al Rajhi Bank (مصرف الراجحي)"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">اسم صاحب الحساب</label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="اسم المؤسسة / الشركة"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">رقم الآيبان (IBAN)</label>
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder="SA..."
                      className="w-full p-1.5 text-xs border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">رمز السويفت (Swift Code)</label>
                    <input
                      type="text"
                      value={swiftCode}
                      onChange={(e) => setSwiftCode(e.target.value)}
                      placeholder="e.g. RJHISARI"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEntity}
                className="px-5 py-2 text-xs font-bold bg-[#007A5A] text-white rounded hover:bg-[#0c6b4f]"
              >
                حفظ البيانات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تعديل بيانات العميل (Edit Customer)
                </h3>
                <p className="text-xs text-slate-500">
                  سيتم تحديث هذه البيانات تلقائياً في كافة صفحات ومستندات وفواتير النظام
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    اسم الشركة (EN)
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.companyName}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, companyName: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    الاسم بالعربي (AR)
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.companyNameAr || ''}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, companyNameAr: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-cairo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    الشخص المسؤول
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.contactPerson}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, contactPerson: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.position || ''}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, position: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    رقم الجوال
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.mobile}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, mobile: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={(e) =>
                      setEditingCustomer({ ...editingCustomer, email: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  العنوان والموقع
                </label>
                <input
                  type="text"
                  value={editingCustomer.address || ''}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, address: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              {/* Customer Bank Details */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 border-b border-blue-200/80 pb-1">
                  <CreditCard className="w-3.5 h-3.5 text-blue-700" />
                  <span>البيانات المصرفية للعميل (Client Bank & IBAN)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">اسم البنك</label>
                    <input
                      type="text"
                      value={editingCustomer.bankName || ''}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, bankName: e.target.value })
                      }
                      placeholder="e.g. Al Rajhi Bank"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">اسم صاحب الحساب</label>
                    <input
                      type="text"
                      value={editingCustomer.accountName || ''}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, accountName: e.target.value })
                      }
                      placeholder="اسم الحساب الرسمي"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">رقم الآيبان (IBAN)</label>
                    <input
                      type="text"
                      value={editingCustomer.iban || ''}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, iban: e.target.value })
                      }
                      placeholder="SA..."
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">رمز السويفت (Swift Code)</label>
                    <input
                      type="text"
                      value={editingCustomer.swiftCode || ''}
                      onChange={(e) =>
                        setEditingCustomer({ ...editingCustomer, swiftCode: e.target.value })
                      }
                      placeholder="e.g. RJHISARI"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingCustomer && onUpdateCustomer) {
                    onUpdateCustomer(editingCustomer);
                  }
                  setEditingCustomer(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-[#1E3A8A] text-white rounded-lg hover:bg-blue-900 transition shadow-xs"
              >
                حفظ التعديلات وتحديث المنظومة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تأكيد حذف العميل
                </h3>
                <p className="text-xs text-slate-500">
                  تحذير: سيتم حذف العميل وتحديث السجلات المرتبطة به
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
              <p className="font-bold text-slate-900">
                هل أنت متأكد من رغبتك في حذف العميل التالي؟
              </p>
              <p className="text-sm font-bold text-rose-800">
                {deletingCustomer.companyName} {deletingCustomer.companyNameAr ? `(${deletingCustomer.companyNameAr})` : ''}
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                سيتم إزالة العميل من دليل العملاء، وتحديث كافة المشاريع وأوامر العمل لتعكس هذا التغيير عبر النظام.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingCustomer && onDeleteCustomer) {
                    onDeleteCustomer(deletingCustomer.id);
                  }
                  setDeletingCustomer(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>نعم، حذف وتحديث النظام</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تعديل بيانات المورد (Edit Supplier)
                </h3>
                <p className="text-xs text-slate-500">
                  تحديث بيانات المورد والاتصال والأنظمة المعتمدة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    اسم المورد (EN)
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.name}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, name: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    الاسم بالعربي (AR)
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.nameAr || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, nameAr: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-cairo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    الشخص المسؤول
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.contactPerson}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, contactPerson: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.position || ''}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, position: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    رقم الجوال / الهاتف
                  </label>
                  <input
                    type="text"
                    value={editingSupplier.mobile}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, mobile: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={editingSupplier.email}
                    onChange={(e) =>
                      setEditingSupplier({ ...editingSupplier, email: e.target.value })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  العنوان / الفرع
                </label>
                <input
                  type="text"
                  value={editingSupplier.address || ''}
                  onChange={(e) =>
                    setEditingSupplier({ ...editingSupplier, address: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              {/* Supplier Bank Details */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 border-b border-emerald-200/80 pb-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                  <span>البيانات المصرفية للمورد (Supplier Bank & IBAN)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">اسم البنك</label>
                    <input
                      type="text"
                      value={editingSupplier.bankName || ''}
                      onChange={(e) =>
                        setEditingSupplier({ ...editingSupplier, bankName: e.target.value })
                      }
                      placeholder="e.g. SNB / Al Rajhi"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">اسم صاحب الحساب</label>
                    <input
                      type="text"
                      value={editingSupplier.accountName || ''}
                      onChange={(e) =>
                        setEditingSupplier({ ...editingSupplier, accountName: e.target.value })
                      }
                      placeholder="اسم الحساب البنكي"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">رقم الآيبان (IBAN)</label>
                    <input
                      type="text"
                      value={editingSupplier.iban || ''}
                      onChange={(e) =>
                        setEditingSupplier({ ...editingSupplier, iban: e.target.value })
                      }
                      placeholder="SA..."
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">رمز السويفت (Swift Code)</label>
                    <input
                      type="text"
                      value={editingSupplier.swiftCode || ''}
                      onChange={(e) =>
                        setEditingSupplier({ ...editingSupplier, swiftCode: e.target.value })
                      }
                      placeholder="e.g. NCBISARI"
                      className="w-full p-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingSupplier && onUpdateSupplier) {
                    onUpdateSupplier(editingSupplier);
                  }
                  setEditingSupplier(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-[#007A5A] text-white rounded-lg hover:bg-[#00664B] transition shadow-xs"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تأكيد حذف المورد
                </h3>
                <p className="text-xs text-slate-500">
                  تحذير: سيتم إزالة المورد من قائمة الموردين
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
              <p className="font-bold text-slate-900">
                هل أنت متأكد من رغبتك في حذف المورد التالي؟
              </p>
              <p className="text-sm font-bold text-rose-800">
                {deletingSupplier.name} {deletingSupplier.nameAr ? `(${deletingSupplier.nameAr})` : ''}
              </p>
              <p className="text-[11px] text-slate-500 pt-1">
                سيتم حذف المورد من الدليل مع بقاء أوامر الشراء التاريخية المسجلة مسبقاً.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSupplier(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingSupplier && onDeleteSupplier) {
                    onDeleteSupplier(deletingSupplier.id);
                  }
                  setDeletingSupplier(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>نعم، حذف المورد</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
