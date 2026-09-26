import React, { useState } from 'react';
import {
  CreditCard,
  Building,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  CheckCircle,
  Sparkles,
  X,
  Upload,
} from 'lucide-react';
import { Customer, Supplier, SystemDiscipline } from '../types';

interface BusinessCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomer: (customer: Customer) => void;
  onAddSupplier: (supplier: Supplier) => void;
}

export const BusinessCardModal: React.FC<BusinessCardModalProps> = ({
  isOpen,
  onClose,
  onAddCustomer,
  onAddSupplier,
}) => {
  const [targetType, setTargetType] = useState<'Supplier' | 'Customer'>('Supplier');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Extracted fields
  const [companyName, setCompanyName] = useState('German Technical Services Co. (GTS)');
  const [companyNameAr, setCompanyNameAr] = useState('الشركة الألمانية للخدمات التقنية');
  const [contactPerson, setContactPerson] = useState('Eng. Mohammad Ali Dabliz');
  const [contactPersonAr, setContactPersonAr] = useState('م. محمد علي دبليز');
  const [position, setPosition] = useState('Sr. Mechanical Engineer Technical & Procurement');
  const [mobile, setMobile] = useState('+966 50 07 32 928');
  const [telephone, setTelephone] = useState('+966 11 293 53 23 Ext. 501');
  const [email, setEmail] = useState('procurement@gts.sa');
  const [website, setWebsite] = useState('www.gts.sa');
  const [address, setAddress] = useState('Contracting Services MEP - ELV - O&M');
  const [shortAddress, setShortAddress] = useState('RHOB7094');
  const [notes, setNotes] = useState('Scanned from business card.');

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreviewImage(dataUrl);
      setIsProcessing(true);

      try {
        const base64 = dataUrl.split(',')[1];
        const res = await fetch('/api/ai/parse-business-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            entityType: targetType,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            const d = json.data;
            if (d.companyName) setCompanyName(d.companyName);
            if (d.companyNameArabic) setCompanyNameAr(d.companyNameArabic);
            if (d.contactPerson) setContactPerson(d.contactPerson);
            if (d.contactPersonArabic) setContactPersonAr(d.contactPersonArabic);
            if (d.position) setPosition(d.position);
            if (d.mobile) setMobile(d.mobile);
            if (d.telephone) setTelephone(d.telephone);
            if (d.email) setEmail(d.email);
            if (d.website) setWebsite(d.website);
            if (d.address) setAddress(d.address);
            if (d.shortAddress) setShortAddress(d.shortAddress);
            if (d.suggestedType) {
              setTargetType(d.suggestedType === 'Customer' ? 'Customer' : 'Supplier');
            }
          }
        }
      } catch (err) {
        console.warn('AI card parse notice:', err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleCard = () => {
    setCompanyName('German Technical Services Co. (GTS)');
    setCompanyNameAr('الشركة الألمانية للخدمات التقنية');
    setContactPerson('Eng. Mohammad Ali Dabliz');
    setContactPersonAr('م. محمد علي دبليز');
    setPosition('Sr. Mechanical Engineer Technical & Procurement');
    setMobile('+966 50 07 32 928');
    setTelephone('+966 11 293 53 23 Ext. 501');
    setEmail('procurement@gts.sa');
    setWebsite('www.gts.sa');
    setAddress('Contracting Services MEP - ELV - O&M');
    setShortAddress('RHOB7094');
    setTargetType('Supplier');
  };

  const handleSave = () => {
    if (targetType === 'Customer') {
      const newCust: Customer = {
        id: `cust-${Date.now()}`,
        companyName,
        companyNameAr,
        contactPerson,
        contactPersonAr,
        position,
        mobile,
        telephone,
        email,
        address,
        shortAddress,
        website,
        notes,
        createdAt: new Date().toISOString(),
      };
      onAddCustomer(newCust);
    } else {
      const newSupp: Supplier = {
        id: `supp-${Date.now()}`,
        name: companyName,
        nameAr: companyNameAr,
        contactPerson,
        position,
        mobile,
        telephone,
        email,
        address,
        shortAddress,
        systems: ['mechanical', 'plumbing', 'fire_fighting'],
        brands: ['Wilo', 'Grundfos', 'Siemens'],
        notes,
        createdAt: new Date().toISOString(),
      };
      onAddSupplier(newSupp);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">
              مسح واستيراد بطاقة عمل (Business Card Import)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Target Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              نوع جهة الاتصال (Record Destination)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetType('Customer')}
                className={`py-2 px-4 rounded-lg text-xs font-bold border transition ${
                  targetType === 'Customer'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🔵 إضافة كـ عميل (Customer)
              </button>
              <button
                type="button"
                onClick={() => setTargetType('Supplier')}
                className={`py-2 px-4 rounded-lg text-xs font-bold border transition ${
                  targetType === 'Supplier'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🟢 إضافة كـ مورد (Supplier)
              </button>
            </div>
          </div>

          {/* Upload Box */}
          <div className="border-2 border-dashed border-slate-300 hover:border-[#007A5A] rounded-xl p-5 text-center relative group bg-slate-50">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-[#007A5A] mb-1" />
              <p className="text-xs font-semibold text-slate-700">
                Upload business card image (صورة بطاقة العمل)
              </p>
              <p className="text-[11px] text-slate-400">
                Camera snapshot, photo, or scan (.jpg, .png)
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Need a quick test?</span>
            <button
              type="button"
              onClick={handleLoadSampleCard}
              className="text-[#007A5A] font-semibold hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Load German Technical Services (GTS) Card
            </button>
          </div>

          {isProcessing && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>AI is analyzing Arabic & English card details...</span>
            </div>
          )}

          {/* Extracted Form for Confirmation */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Confirm & Edit Extracted Information (تأكيد وتعديل البيانات):</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  اسم الشركة (Company Name EN)
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#007A5A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  الاسم بالعربي (Company Name AR)
                </label>
                <input
                  type="text"
                  value={companyNameAr}
                  onChange={(e) => setCompanyNameAr(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#007A5A] outline-none font-cairo"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  الشخص المسؤول (Contact Person EN)
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#007A5A] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  المسؤول بالعربي (Contact Person AR)
                </label>
                <input
                  type="text"
                  value={contactPersonAr}
                  onChange={(e) => setContactPersonAr(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-[#007A5A] outline-none font-cairo"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  المسمى الوظيفي (Position)
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  الجوال (Mobile)
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  هاتف المكتب (Office Telephone)
                </label>
                <input
                  type="text"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  البريد الإلكتروني (Email)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  الموقع الإلكتروني (Website)
                </label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  العنوان الوطني المختصر (Short Address)
                </label>
                <input
                  type="text"
                  value={shortAddress}
                  onChange={(e) => setShortAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  العنوان ونطاق الأعمال (Address / Scope)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
          >
            إلغاء (Cancel)
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 text-xs font-bold bg-[#007A5A] hover:bg-[#0b644b] text-white rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <CheckCircle className="w-4 h-4" />
            <span>حفظ في قاعدة البيانات (Save Record)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
