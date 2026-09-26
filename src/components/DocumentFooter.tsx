import React from 'react';
import { SignatureBox } from './SignatureBox';
import { COMPANY_PROFILE } from '../data/initialData';
import { ShieldCheck, FileCheck, Truck, Receipt, FileText } from 'lucide-react';

export interface SignatoryDefinition {
  roleTitleAr: string;
  roleTitleEn?: string;
  personName: string;
  personTitle?: string;
  roleKey?: string;
  signatureUrl?: string;
  placeholderText?: string;
  accentColorClass?: string;
}

export interface DocumentFooterProps {
  // Variant selection for document-specific layout segregation
  variant?: 'delivery_note' | 'invoice' | 'purchase_order' | 'report' | 'custom' | 'standard_4';

  // Custom signatories list (used for report / custom variants)
  customSignatories?: SignatoryDefinition[];
  headerTitle?: string;
  protocolBadge?: string;

  // Signatory overrides
  clientRecipientName?: string;
  clientRecipientTitle?: string;
  clientRoleKey?: string;
  clientSignatureUrl?: string;

  projectManagerName?: string;
  projectManagerTitle?: string;
  projectManagerRoleKey?: string;
  projectManagerSignatureUrl?: string;

  financeName?: string;
  financeTitle?: string;
  financeRoleKey?: string;
  financeSignatureUrl?: string;

  dispatcherName?: string;
  dispatcherTitle?: string;
  dispatcherRoleKey?: string;
  dispatcherSignatureUrl?: string;

  // Optional display controls
  showStampBox?: boolean;
  notes?: string;
  className?: string;
  editable?: boolean;
}

export const DocumentFooter: React.FC<DocumentFooterProps> = ({
  variant = 'standard_4',
  customSignatories,
  headerTitle,
  protocolBadge,

  clientRecipientName = 'المستلم المفوض / العميل',
  clientRecipientTitle = 'Authorized Client Representative',
  clientRoleKey = 'client_acceptance',
  clientSignatureUrl,

  projectManagerName = COMPANY_PROFILE.engineerName || '',
  projectManagerTitle = 'Projects Manager (مدير المشاريع)',
  projectManagerRoleKey = 'projects_manager',
  projectManagerSignatureUrl,

  financeName = '',
  financeTitle = 'Finance & Accounts Lead',
  financeRoleKey = 'finance_accounts',
  financeSignatureUrl,

  dispatcherName = '',
  dispatcherTitle = 'Logistics & Dispatch Officer',
  dispatcherRoleKey = 'dispatcher_medhat',
  dispatcherSignatureUrl,

  notes,
  className = '',
  editable = true,
}) => {
  // Render signature columns depending on document variant
  const renderSignatureBlocks = () => {
    // 1. DELIVERY NOTES: Strictly 2 columns (Dispatcher / Preparer + Client / Receiver)
    if (variant === 'delivery_note') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          {/* Col 1: Dispatcher / Preparer */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-slate-900 leading-tight">
                المسؤول عن التجهيز والتسليم
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (Prepared & Dispatched By)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {dispatcherName}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                {dispatcherTitle}
              </div>
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-slate-100">
              <SignatureBox
                roleKey={dispatcherRoleKey}
                personName={dispatcherName}
                personTitle={dispatcherTitle}
                signatureUrl={dispatcherSignatureUrl}
                heightClass="h-14"
                showPersonInfo={false}
                placeholderText="توقيع مسؤول التسليم"
                editable={editable}
                align="center"
              />
            </div>
          </div>

          {/* Col 2: Client / Site Receiver */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-emerald-800 leading-tight">
                إقرار استلام العميل / الموقع
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (Received & Accepted By Client)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {clientRecipientName}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                {clientRecipientTitle}
              </div>
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-slate-100">
              <SignatureBox
                roleKey={clientRoleKey}
                personName={clientRecipientName}
                personTitle={clientRecipientTitle}
                signatureUrl={clientSignatureUrl}
                heightClass="h-14"
                showPersonInfo={false}
                placeholderText="توقيع وختم استلام العميل"
                editable={editable}
                align="center"
              />
            </div>
          </div>
        </div>
      );
    }

    // 2. INVOICES: Strictly 2 columns (Accounting & Finance + Project Management Approval)
    if (variant === 'invoice') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          {/* Col 1: Finance & Accounting */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-[#1e3a8a] leading-tight">
                المحاسبة والإدارة المالية
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (Finance & Accounting Management)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {financeName}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                {financeTitle}
              </div>
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-slate-100">
              <SignatureBox
                roleKey={financeRoleKey}
                personName={financeName}
                personTitle={financeTitle}
                signatureUrl={financeSignatureUrl}
                heightClass="h-14"
                showPersonInfo={false}
                placeholderText="توقيع الإدارة المالية"
                editable={editable}
                align="center"
              />
            </div>
          </div>

          {/* Col 2: Project Management Approval */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-[#007A5A] leading-tight">
                الاعتماد الإداري للمشاريع
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (Project Management Approval)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {projectManagerName}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                {projectManagerTitle}
              </div>
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-slate-100">
              <SignatureBox
                roleKey={projectManagerRoleKey}
                personName={projectManagerName}
                personTitle={projectManagerTitle}
                signatureUrl={projectManagerSignatureUrl}
                heightClass="h-14"
                showPersonInfo={false}
                placeholderText="توقيع مدير المشاريع"
                editable={editable}
                align="center"
              />
            </div>
          </div>
        </div>
      );
    }

    // 3. PURCHASE ORDERS: 4-Tier Internal Procurement Segregation
    if (variant === 'purchase_order') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
          {/* Col 1: Procurement / Preparer */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-slate-900 leading-tight">
                إعداد مسؤول المشتريات
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (Prepared By / Procurement)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {projectManagerName}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                {projectManagerTitle}
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-slate-100">
              <SignatureBox
                roleKey={projectManagerRoleKey}
                personName={projectManagerName}
                personTitle={projectManagerTitle}
                signatureUrl={projectManagerSignatureUrl}
                heightClass="h-12"
                showPersonInfo={false}
                placeholderText="توقيع مسؤول الإعداد"
                editable={editable}
                align="center"
              />
            </div>
          </div>

          {/* Col 2: Projects Management */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-[#007A5A] leading-tight">
                مدير المشاريع والتنفيذ
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (Projects Management)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {COMPANY_PROFILE.engineerName || 'Eng. Mokhtar Yousef'}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                Director of Projects
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-slate-100">
              <SignatureBox
                roleKey="projects_director"
                personName={COMPANY_PROFILE.engineerName || 'Eng. Mokhtar Yousef'}
                personTitle="Director of Projects"
                heightClass="h-12"
                showPersonInfo={false}
                placeholderText="توقيع مدير المشاريع"
                editable={editable}
                align="center"
              />
            </div>
          </div>

          {/* Col 3: Finance & Accounts */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-[#1e3a8a] leading-tight">
                المراجعة المالية والمحاسبة
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (Finance & Accounts Review)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {financeName}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                {financeTitle}
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-slate-100">
              <SignatureBox
                roleKey={financeRoleKey}
                personName={financeName}
                personTitle={financeTitle}
                signatureUrl={financeSignatureUrl}
                heightClass="h-12"
                showPersonInfo={false}
                placeholderText="توقيع المراجعة المالية"
                editable={editable}
                align="center"
              />
            </div>
          </div>

          {/* Col 4: Managing Director / General Manager */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="font-bold text-xs text-indigo-900 leading-tight">
                الاعتماد النهائي / الإدارة العامة
              </div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                (General Manager Approval)
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                {dispatcherName}
              </div>
              <div className="text-[9.5px] text-slate-500 truncate">
                {dispatcherTitle}
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-slate-100">
              <SignatureBox
                roleKey={dispatcherRoleKey}
                personName={dispatcherName}
                personTitle={dispatcherTitle}
                signatureUrl={dispatcherSignatureUrl}
                heightClass="h-12"
                showPersonInfo={false}
                placeholderText="توقيع الاعتماد النهائي"
                editable={editable}
                align="center"
              />
            </div>
          </div>
        </div>
      );
    }

    // 4. REPORTS & CUSTOM DOCUMENTS: Dynamically rendered based on issuing entity / signatories
    if (variant === 'report' || variant === 'custom') {
      const signers: SignatoryDefinition[] = customSignatories && customSignatories.length > 0
        ? customSignatories
        : [
            {
              roleTitleAr: 'إعداد وتدقيق التقرير',
              roleTitleEn: 'Prepared & Audited By',
              personName: financeName || 'قسم المحاسبة والمالية',
              personTitle: financeTitle || 'Financial Auditor',
              roleKey: financeRoleKey || 'finance_accounts',
              signatureUrl: financeSignatureUrl,
              placeholderText: 'توقيع مدقق التقرير',
              accentColorClass: 'text-[#1e3a8a]',
            },
            {
              roleTitleAr: 'الاعتماد والمصادقة الإدارية',
              roleTitleEn: 'Management Approval',
              personName: projectManagerName || 'إدارة المشاريع والتنفيذ',
              personTitle: projectManagerTitle || 'Director of Operations',
              roleKey: projectManagerRoleKey || 'projects_manager',
              signatureUrl: projectManagerSignatureUrl,
              placeholderText: 'توقيع الاعتماد الإداري',
              accentColorClass: 'text-[#007A5A]',
            },
          ];

      const gridColsClass =
        signers.length === 1
          ? 'grid-cols-1 max-w-sm mx-auto'
          : signers.length === 2
          ? 'grid-cols-1 sm:grid-cols-2'
          : signers.length === 3
          ? 'grid-cols-1 sm:grid-cols-3'
          : 'grid-cols-2 md:grid-cols-4';

      return (
        <div className={`grid ${gridColsClass} gap-4 text-center`}>
          {signers.map((sig, idx) => (
            <div
              key={sig.roleKey || idx}
              className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className={`font-bold text-xs leading-tight ${sig.accentColorClass || 'text-slate-900'}`}>
                  {sig.roleTitleAr}
                </div>
                {sig.roleTitleEn && (
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
                    ({sig.roleTitleEn})
                  </div>
                )}
                <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
                  {sig.personName}
                </div>
                {sig.personTitle && (
                  <div className="text-[9.5px] text-slate-500 truncate">
                    {sig.personTitle}
                  </div>
                )}
              </div>

              <div className="mt-2.5 pt-1.5 border-t border-slate-100">
                <SignatureBox
                  roleKey={sig.roleKey}
                  personName={sig.personName}
                  personTitle={sig.personTitle}
                  signatureUrl={sig.signatureUrl}
                  heightClass="h-14"
                  showPersonInfo={false}
                  placeholderText={sig.placeholderText || 'توقيع المعتمد'}
                  editable={editable}
                  align="center"
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // 4. STANDARD 4-COLUMN UNIVERSAL PROTOCOL (Default fallback)
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
        {/* Col 1: Client Receipt */}
        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="font-bold text-xs text-slate-900 leading-tight">
              استلام العميل / الموقع
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
              (Received By / Client)
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
              {clientRecipientName}
            </div>
            <div className="text-[9.5px] text-slate-500 truncate">
              {clientRecipientTitle}
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-slate-100">
            <SignatureBox
              roleKey={clientRoleKey}
              personName={clientRecipientName}
              personTitle={clientRecipientTitle}
              signatureUrl={clientSignatureUrl}
              heightClass="h-12"
              showPersonInfo={false}
              placeholderText="توقيع واستلام العميل"
              editable={editable}
              align="center"
            />
          </div>
        </div>

        {/* Col 2: Project Management */}
        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="font-bold text-xs text-[#007A5A] leading-tight">
              الاعتماد الإداري للمشاريع
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
              (Project Management)
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
              {projectManagerName}
            </div>
            <div className="text-[9.5px] text-slate-500 truncate">
              {projectManagerTitle}
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-slate-100">
            <SignatureBox
              roleKey={projectManagerRoleKey}
              personName={projectManagerName}
              personTitle={projectManagerTitle}
              signatureUrl={projectManagerSignatureUrl}
              heightClass="h-12"
              showPersonInfo={false}
              placeholderText="توقيع مدير المشاريع"
              editable={editable}
              align="center"
            />
          </div>
        </div>

        {/* Col 3: Finance & Accounting */}
        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="font-bold text-xs text-[#1e3a8a] leading-tight">
              المحاسبة والإدارة المالية
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
              (Finance & Accounting)
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
              {financeName}
            </div>
            <div className="text-[9.5px] text-slate-500 truncate">
              {financeTitle}
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-slate-100">
            <SignatureBox
              roleKey={financeRoleKey}
              personName={financeName}
              personTitle={financeTitle}
              signatureUrl={financeSignatureUrl}
              heightClass="h-12"
              showPersonInfo={false}
              placeholderText="توقيع الإدارة المالية"
              editable={editable}
              align="center"
            />
          </div>
        </div>

        {/* Col 4: Dispatch & Logistics */}
        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="font-bold text-xs text-slate-900 leading-tight">
              المسؤول عن التجهيز والتسليم
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 font-sans">
              (Dispatch & Delivery)
            </div>
            <div className="mt-1.5 text-[11px] font-bold text-slate-800 truncate">
              {dispatcherName}
            </div>
            <div className="text-[9.5px] text-slate-500 truncate">
              {dispatcherTitle}
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-slate-100">
            <SignatureBox
              roleKey={dispatcherRoleKey}
              personName={dispatcherName}
              personTitle={dispatcherTitle}
              signatureUrl={dispatcherSignatureUrl}
              heightClass="h-12"
              showPersonInfo={false}
              placeholderText="توقيع مسؤول التسليم"
              editable={editable}
              align="center"
            />
          </div>
        </div>
      </div>
    );
  };

  const getHeaderIcon = () => {
    if (variant === 'delivery_note') return <Truck className="w-3.5 h-3.5 text-emerald-600" />;
    if (variant === 'invoice') return <Receipt className="w-3.5 h-3.5 text-blue-600" />;
    if (variant === 'report') return <FileText className="w-3.5 h-3.5 text-indigo-600" />;
    return <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />;
  };

  const getDefaultHeaderTitle = () => {
    if (headerTitle) return headerTitle;
    if (variant === 'delivery_note') return 'اعتمادات وتواقيع التسليم والاستلام (Delivery Signatures)';
    if (variant === 'invoice') return 'الاعتماد المالي وإدارة المشاريع للفاتورة (Invoice Approval)';
    if (variant === 'report') return 'اعتماد ومصادقة التقرير المالي (Report Verification)';
    return 'اعتمادات وتواقيع المستند الرسمية (Official Approvals & Signatures)';
  };

  const getDefaultBadge = () => {
    if (protocolBadge) return protocolBadge;
    if (variant === 'delivery_note') return '2-ROLE LOGISTICS VERIFICATION';
    if (variant === 'invoice') return 'FINANCIAL & MANAGEMENT DUAL SIGN-OFF';
    if (variant === 'report') return 'ISSUING ENTITY VERIFICATION';
    return '4-POINT VERIFICATION PROTOCOL';
  };

  return (
    <footer className={`document-footer-standardized mt-6 pt-4 border-t-2 border-slate-300 ${className}`} dir="rtl">
      {/* Optional Document Notes or Conditions */}
      {notes && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 mb-4">
          <span className="font-bold block mb-0.5 text-slate-900">ملاحظات وشروط الاعتماد:</span>
          <span className="leading-relaxed">{notes}</span>
        </div>
      )}

      {/* Signature Grid */}
      <div className="bg-slate-50/50 rounded-xl border border-slate-200/80 p-3.5 mb-4">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200/60 text-[11px] font-bold text-slate-700">
          <span className="flex items-center gap-1.5">
            {getHeaderIcon()}
            <span>{getDefaultHeaderTitle()}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
            {getDefaultBadge()}
          </span>
        </div>

        {renderSignatureBlocks()}
      </div>

      {/* Standard Centered Company Address Line (Metadata & Clean Alignment) */}
      <div className="text-center pt-2 border-t border-slate-200 text-[10px] text-slate-600 space-y-1">
        <div className="font-bold text-slate-700">
          مؤسسة صناع الموارد التجاريه • RESOURCE MAKERS TRADING EST.
        </div>
        <div className="font-mono text-slate-500 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
          <span>المملكة العربية السعودية - الدمام - الشاطئ الغربي</span>
          <span>•</span>
          <span>هاتف: 0549220606</span>
          <span>•</span>
          <span>س.ت: 2050167793</span>
          <span>•</span>
          <span>الرقم الضريبي: 311552664400003</span>
        </div>
        <div className="text-[9px] text-slate-400 italic">
          This document is authentic and legally binding when signed by authorized signatories and stamped with official seal.
        </div>
      </div>
    </footer>
  );
};
