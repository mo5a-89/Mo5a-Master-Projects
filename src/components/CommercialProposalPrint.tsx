import React, { useState, useEffect } from 'react';
import { CustomerQuotation, Project } from '../types';
import { Printer, Download, X, ArrowLeft, Stamp, FileCheck } from 'lucide-react';
import { executePrint } from '../utils/printUtils';
import { GovernanceSignatures } from './GovernanceSignatures';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';

export interface CommercialProposalPrintProps {
  quotation?: Partial<CustomerQuotation> | any;
  project?: Partial<Project> | any;
  onClose?: () => void;
  showControls?: boolean;
}

export const CommercialProposalPrint: React.FC<CommercialProposalPrintProps> = ({
  quotation,
  project,
  onClose,
  showControls = true,
}) => {
  const [showGovModal, setShowGovModal] = useState(false);

  // Signatures state from strict persistent keys
  const [signatures, setSignatures] = useState({
    reviewed: '',
    approved: '',
    seal: '',
  });

  const loadSignatures = () => {
    if (typeof window === 'undefined') return;
    setSignatures({
      reviewed: localStorage.getItem('rmt_sig_reviewed') || '',
      approved: localStorage.getItem('rmt_sig_approved') || '',
      seal: localStorage.getItem('rmt_company_seal') || '',
    });
  };

  useEffect(() => {
    loadSignatures();

    const handleStorage = () => loadSignatures();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('rmt_signatures_updated', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('rmt_signatures_updated', handleStorage);
    };
  }, []);

  // Compute dynamic or standardized fallback data matching exact RMT template
  const clientName = quotation?.clientName || quotation?.customerName || project?.clientName || 'Maitham Al Wakeel Co.';
  const attnName = quotation?.attnName || quotation?.contactPerson || 'Mr. Tareq';
  const projectName = project?.name || quotation?.projectName || 'Commercial Building';
  const projectLocation = project?.location || quotation?.projectLocation || 'Dammam';
  const proposalNo = quotation?.quotationNumber || quotation?.proposalNo || 'RM012705';
  const proposalDate = quotation?.date || quotation?.createdAt?.slice(0, 10) || '01-Sep-2026';
  const scopeOfWork = quotation?.scopeOfWork || 'Supply, Installation, Programming & Commissioning of CCTV System';
  const systemDefinition = quotation?.systemDefinition || 'Hikvision IP CCTV Surveillance System';
  const initiatedBy = quotation?.initiatedBy || quotation?.preparedBy || 'Mokhtar Yousef';

  // Items List
  const items = (quotation?.items && quotation.items.length > 0)
    ? quotation.items.map((it: any, idx: number) => ({
        itemNo: idx + 1,
        model: it.partNumber || it.model || it.itemCode || `ITEM-${idx + 1}`,
        description: it.description || it.name,
        unit: it.unit || 'pcs',
        quantity: Number(it.quantity || 1),
        unitRate: Number(it.unitPrice || it.sellingUnitPrice || it.rate || 0),
        amount: Number(it.totalPrice || (Number(it.quantity || 1) * Number(it.unitPrice || it.sellingUnitPrice || 0))),
      }))
    : [
        {
          itemNo: 1,
          model: 'DS-2CD2T83G2-2LI (2.8 mm)',
          description: 'Hikvision 8 MP AcuSense Smart Hybrid Light fixed bullet network camera',
          unit: 'pcs',
          quantity: 24,
          unitRate: 495,
          amount: 11880,
        },
        {
          itemNo: 2,
          model: 'DS-7732NXI-K4(D)',
          description: 'Hikvision 32-channel AcuSense NVR with four HDD bays',
          unit: 'pcs',
          quantity: 1,
          unitRate: 1180,
          amount: 1180,
        },
        {
          itemNo: 3,
          model: '8TB WD PURPLE',
          description: 'Western Digital 8 TB Purple surveillance hard disk drive',
          unit: 'pcs',
          quantity: 5,
          unitRate: 1400,
          amount: 7000,
        },
        {
          itemNo: 4,
          model: 'DS-3E1518P-EI/M',
          description: 'Hikvision 16-port Gigabit smart PoE switch',
          unit: 'pcs',
          quantity: 2,
          unitRate: 600,
          amount: 1200,
        },
        {
          itemNo: 5,
          model: 'DS-3E1528P-EI/M',
          description: 'Hikvision 24-port smart managed PoE switch; 230 W PoE budget',
          unit: 'pcs',
          quantity: 2,
          unitRate: 800,
          amount: 1600,
        },
        {
          itemNo: 6,
          model: 'DS-3E1510P-EI/M',
          description: 'Hikvision 8-port Gigabit smart PoE switch',
          unit: 'pcs',
          quantity: 6,
          unitRate: 230,
          amount: 1380,
        },
        {
          itemNo: 7,
          model: '4U 530 x 400 x 240 mm',
          description: 'Unassembled 4U network cabinet',
          unit: 'pcs',
          quantity: 1,
          unitRate: 100,
          amount: 100,
        },
        {
          itemNo: 8,
          model: '9U 600 x 600 x 500 mm',
          description: 'Unassembled 9U network rack cabinet',
          unit: 'pcs',
          quantity: 1,
          unitRate: 360,
          amount: 360,
        },
        {
          itemNo: 9,
          model: 'SERVICES',
          description: 'Installation, programming, configuration, testing and commissioning',
          unit: 'job',
          quantity: 1,
          unitRate: 3800,
          amount: 3800,
        },
      ];

  const subtotal = quotation?.subtotal !== undefined
    ? Number(quotation.subtotal)
    : items.reduce((acc: number, it: any) => acc + it.amount, 0);

  const { corporate, companyIdentity, financial } = useMasterEnterpriseStore();
  const officialLogo = companyIdentity?.logoUrl || corporate?.logoUrl;
  const officialNameAr = companyIdentity?.officialArabicName || corporate?.nameAr || 'مؤسسة صناع الموارد التجارية';
  const officialNameEn = companyIdentity?.officialEnglishName || corporate?.nameEn || 'Sanaa Al Muarad Trading Est. (RMT)';
  const crNumber = companyIdentity?.crNumber || corporate?.crNumber || '2050167793';
  const vatNumber = companyIdentity?.vatNumber || corporate?.vatNumber || '311552664400003';

  const vatRate = quotation?.vatPercent !== undefined ? Number(quotation.vatPercent) : financial.defaultVat;
  const vat = quotation?.vatAmount !== undefined
    ? Number(quotation.vatAmount)
    : Math.round(subtotal * (vatRate / 100) * 100) / 100;

  const grandTotal = quotation?.grandTotal !== undefined
    ? Number(quotation.grandTotal)
    : subtotal + vat;

  const handlePrint = () => {
    executePrint('commercial-proposal-document', {
      documentTitle: `Commercial Proposal - ${proposalNo}`,
    });
  };

  // Reusable Dual Masthead component (LTR dominant English layout)
  const Masthead = () => (
    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-6 gap-4" dir="ltr">
      {/* Left: Monogram / Uploaded Logo + Company Names */}
      <div className="flex items-center gap-3">
        {officialLogo ? (
          <img src={officialLogo} alt="Company Logo" className="max-h-[70px] max-w-[150px] object-contain drop-shadow-xs" />
        ) : (
          <svg className="w-16 h-12" viewBox="0 0 100 70" fill="none">
            <path d="M12 10 H32 C44 10 48 18 48 26 C48 34 42 40 32 40 H22 V60 H12 V10 Z" fill="#007A5A" />
            <path d="M22 20 H30 C35 20 38 22 38 26 C38 30 35 32 30 32 H22 V20 Z" fill="#ffffff" />
            <path d="M28 36 L48 60 H36 L19 40 Z" fill="#007A5A" />
            <path d="M46 60 L62 10 H72 L82 38 L92 10 H102 L86 60 H76 L68 34 L60 60 H46 Z" fill="#1e3a8a" />
          </svg>
        )}
        <div className="text-left">
          <h1 className="text-base sm:text-lg font-black text-[#174A84] tracking-tight uppercase font-sans leading-tight">
            {officialNameEn}
          </h1>
          <p className="text-xs font-bold text-slate-700 font-sans mt-0.5">
            {officialNameAr}
          </p>
        </div>
      </div>

      {/* Right: Registration & Tax Info */}
      <div className="text-right text-[11px] font-mono text-slate-700">
        <div>C.R: <strong className="text-slate-900">{crNumber}</strong></div>
        <div>VAT: <strong className="text-slate-900">{vatNumber}</strong></div>
        <div className="text-[10px] text-slate-500 mt-0.5">Kingdom of Saudi Arabia</div>
      </div>
    </div>
  );

  // Reusable Universal Running Footer
  const RunningFooter = () => (
    <div className="mt-auto pt-3 border-t border-slate-200 text-[10px] text-slate-600" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-y-1 font-mono">
        <span className="flex items-center gap-1">
          <span className="text-sky-600 font-bold">C.R:</span> {corporate.crNumber || crNumber}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-rose-500 font-bold">VAT:</span> {corporate.vatNumber || vatNumber}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-emerald-600 font-bold">Tel:</span> {corporate.mobiles?.[0] || corporate.phone}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-blue-600 font-bold">Email:</span> {corporate.email}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-indigo-600 font-bold">Web:</span> {corporate.website || 'www.rmt-sa.com'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white text-slate-900" dir="ltr">
      {/* Print Stylesheet */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 10mm;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            direction: ltr !important;
            text-align: left !important;
          }
          #commercial-proposal-document {
            direction: ltr !important;
            text-align: left !important;
          }
          .no-print {
            display: none !important;
          }
          .proposal-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 272mm !important;
            page-break-after: always !important;
            break-after: page !important;
            direction: ltr !important;
            text-align: left !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
        }
      `}</style>

      {/* Screen Control Bar */}
      {showControls && (
        <div className="no-print max-w-[210mm] mx-auto mb-5 p-3.5 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg" dir="rtl">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700 shadow-xs"
              >
                <span>← العودة إلى عروض الأسعار</span>
              </button>
            )}
            <span className="font-mono text-emerald-400 font-black text-sm">
              {proposalNo}
            </span>
            <span className="text-xs text-slate-300">
              العرض التجاري المعتمد (Corporate Commercial Proposal - 4 Pages)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGovModal(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Stamp className="w-3.5 h-3.5 text-amber-400" />
              <span>إدارة التواقيع والختم</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#007A5A] hover:bg-[#00664a] text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة العرض (A4 PDF)</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                title="إغلاق المعاينة"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* PRINT CONTAINER */}
      <div id="commercial-proposal-document" className="max-w-[210mm] mx-auto space-y-6 print:space-y-0 text-left font-sans" dir="ltr">
        
        {/* ======================================================== */}
        {/* PAGE 1: EXECUTIVE COVER                                 */}
        {/* ======================================================== */}
        <div className="proposal-page bg-white p-8 sm:p-12 rounded-xl shadow-md border border-slate-200 flex flex-col justify-between min-h-[280mm]">
          <div>
            <Masthead />

            {/* Document Title */}
            <div className="text-center my-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 underline decoration-slate-400 decoration-1 underline-offset-8">
                Commercial Proposal
              </h1>
            </div>

            {/* Proposal Metadata Table */}
            <div className="border border-slate-300 rounded-xs overflow-hidden mb-8 text-xs sm:text-[12.5px]">
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Scope of Work
                </div>
                <div className="col-span-8 p-2.5 text-slate-900 font-medium">
                  {scopeOfWork}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  System Definition
                </div>
                <div className="col-span-8 p-2.5 text-slate-900 font-medium">
                  {systemDefinition}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Project Name
                </div>
                <div className="col-span-8 p-2.5 text-slate-900 font-semibold">
                  {projectName}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Project location
                </div>
                <div className="col-span-8 p-2.5 text-slate-900">
                  {projectLocation}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Clients Name
                </div>
                <div className="col-span-8 p-2.5 text-slate-900 font-bold">
                  {clientName}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Attn. Name
                </div>
                <div className="col-span-8 p-2.5 text-slate-900 font-medium">
                  {attnName}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Proposal #
                </div>
                <div className="col-span-8 p-2.5 text-slate-900 font-mono font-bold text-sky-800">
                  {proposalNo}
                </div>
              </div>
              <div className="grid grid-cols-12 border-b border-slate-200">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Initiated By
                </div>
                <div className="col-span-8 p-2.5 text-slate-900">
                  {initiatedBy}
                </div>
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-4 bg-slate-100/90 font-bold p-2.5 text-slate-800 border-r border-slate-200">
                  Date
                </div>
                <div className="col-span-8 p-2.5 text-slate-900 font-mono">
                  {proposalDate}
                </div>
              </div>
            </div>

            {/* Confidentiality Clause */}
            <div className="mb-8">
              <h2 className="text-base font-bold text-slate-900 mb-2">
                Proposal Confidentiality:
              </h2>
              <p className="text-[10px] leading-relaxed text-slate-700 uppercase font-sans text-justify mb-2">
                THIS DOCUMENT CONTAINS TRADE RESOURCE MAKERS - SANAA AL MUARAD TRADING EST CONFIDENTIAL AND
                PROPRIETARY INFORMATION AND IS SUPPLIED TO ALLOW THE CLIENT/CONCERNED PARTIES TO MAKE AN
                EVALUATION OF RESOURCE MAKERS AS A CANDIDATE FOR THE DELIVERY OF PREVIOUSLY MENTIONED
                SERVICES. THIS DOCUMENT (INCLUDING ANY PART THEREOF) IS NOT TO BE DISCLOSED OR REPRODUCED
                OR DISTRIBUTED IN ANY FORM OR BY ANY MEANS, OR STORED IN A DATABASE OR RETRIEVAL SYSTEM, OR
                TRANSFERRED OUTSIDE YOUR ORGANIZATION WITHOUT PRIOR WRITTEN CONSENT FROM THE
                AUTHORIZED REPRESENTATIVE AT RESOURCE MAKERS C.
              </p>
              <div className="text-[10.5px] font-bold text-slate-800 uppercase">
                © ALL RIGHTS RESERVED TO TRADE RESOURCE MAKERS – DAMMAM / SAUDI ARABIA
              </div>
            </div>

            {/* Key Contact Information Table */}
            <div className="max-w-[420px] mx-auto border border-slate-400 rounded-xs overflow-hidden text-xs">
              <div className="grid grid-cols-5 border-b border-slate-300">
                <div className="col-span-2 bg-slate-100 font-bold p-2 border-r border-slate-300">Name</div>
                <div className="col-span-3 p-2 font-bold text-slate-900">{corporate.engineerName}</div>
              </div>
              <div className="grid grid-cols-5 border-b border-slate-300">
                <div className="col-span-2 bg-slate-100 font-bold p-2 border-r border-slate-300">Position</div>
                <div className="col-span-3 p-2 text-slate-800">{corporate.engineerTitle}</div>
              </div>
              <div className="grid grid-cols-5 border-b border-slate-300">
                <div className="col-span-2 bg-slate-100 font-bold p-2 border-r border-slate-300">E-mail</div>
                <div className="col-span-3 p-2 font-mono text-blue-700">{corporate.engineerEmail}</div>
              </div>
              <div className="grid grid-cols-5 border-b border-slate-300">
                <div className="col-span-2 bg-slate-100 font-bold p-2 border-r border-slate-300">Tel</div>
                <div className="col-span-3 p-2 font-mono text-slate-800">{corporate.phone}</div>
              </div>
              <div className="grid grid-cols-5">
                <div className="col-span-2 bg-slate-100 font-bold p-2 border-r border-slate-300">Mob</div>
                <div className="col-span-3 p-2 font-mono text-slate-800 font-bold">{corporate.mobiles?.[0] || corporate.phone}</div>
              </div>
            </div>
          </div>

          <RunningFooter />
        </div>

        {/* ======================================================== */}
        {/* PAGE 2: BOQ & PRICE SCHEDULE                             */}
        {/* ======================================================== */}
        <div className="proposal-page page-break-before bg-white p-8 sm:p-12 rounded-xl shadow-md border border-slate-200 flex flex-col justify-between min-h-[280mm]">
          <div>
            <Masthead />

            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900 mb-2">
                1.0 Total System Price:
              </h2>
              <div className="text-xs text-slate-800 space-y-2 leading-relaxed">
                <p className="font-semibold">Dear {attnName}.</p>
                <p>
                  Thank you for your inquiry. Referring to your request, we are pleased to submit our commercial proposal for the supply,
                  installation, programming, testing, and commissioning of a complete {systemDefinition} for the {projectName} project in {projectLocation}.
                </p>
                <p>
                  we are pleased to provide you with our quotation. It includes our best pricing, terms, and all required details as listed below.
                </p>
              </div>
            </div>

            {/* Price Schedule Banner */}
            <div className="bg-[#f1f5f9] border-l-4 border-[#1e3a8a] p-2 mb-1">
              <div className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wide">
                1.0 1 {systemDefinition} - PRICE SCHEDULE
              </div>
            </div>
            <div className="text-[10px] text-slate-500 italic mb-3">
              The scope excludes site installation, cable laying, containment works, civil works..
            </div>

            {/* BOQ Table */}
            <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
              <thead>
                <tr className="bg-[#102a43] text-white font-bold text-[10.5px]">
                  <th className="p-2 border border-slate-400 text-center w-10">Item</th>
                  <th className="p-2 border border-slate-400 text-left w-36">Model</th>
                  <th className="p-2 border border-slate-400 text-left">Offered Description</th>
                  <th className="p-2 border border-slate-400 text-center w-12">Unit</th>
                  <th className="p-2 border border-slate-400 text-center w-12">Qty</th>
                  <th className="p-2 border border-slate-400 text-right w-24">Unit Rate<br/>(SAR)</th>
                  <th className="p-2 border border-slate-400 text-right w-24">Amount<br/>(SAR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, idx: number) => (
                  <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="p-1.5 border border-slate-300 text-center text-slate-500 font-mono text-[10px]">
                      {it.itemNo || idx + 1}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-left font-mono font-medium text-slate-800 text-[10.5px]">
                      {it.model}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-left text-slate-900 text-[11px] leading-tight">
                      {it.description}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center text-slate-600 text-[10px]">
                      {it.unit}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-bold text-slate-800 text-[10.5px]">
                      {it.quantity}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-slate-700 text-[11px]">
                      {it.unitRate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono font-bold text-slate-900 text-[11px]">
                      {it.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Totals Summary */}
            <div className="flex justify-end">
              <table className="w-80 border-collapse border border-slate-400 text-xs">
                <tbody>
                  <tr>
                    <td className="p-2 font-bold text-slate-800 border border-slate-300 bg-slate-50">
                      Final Offered Amount - Excl. VAT
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900 border border-slate-300">
                      {subtotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SAR
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-800 border border-slate-300 bg-slate-50">
                      VAT 15%
                    </td>
                    <td className="p-2 text-right font-mono text-slate-700 border border-slate-300">
                      {vat.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SAR
                    </td>
                  </tr>
                  <tr className="bg-[#dbeafe]">
                    <td className="p-2 font-black text-blue-900 border border-slate-300">
                      Final Offered Amount - Incl. VAT
                    </td>
                    <td className="p-2 text-right font-mono font-black text-blue-950 border border-slate-300 text-sm">
                      {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SAR
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <RunningFooter />
        </div>

        {/* ======================================================== */}
        {/* PAGE 3: SCOPE & CONTRACT TERMS                          */}
        {/* ======================================================== */}
        <div className="proposal-page page-break-before bg-white p-8 sm:p-12 rounded-xl shadow-md border border-slate-200 flex flex-col justify-between min-h-[280mm]">
          <div>
            <Masthead />

            <h2 className="text-base font-bold text-slate-900 underline decoration-slate-400 underline-offset-4 mb-4">
              Terms & Conditions:
            </h2>

            {/* Section 1.1: Scope Included */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-900 mb-2">
                1.1 The above Price Includes (by RM):
              </h3>
              <ul className="text-xs text-slate-800 space-y-1.5 list-disc list-inside leading-relaxed text-justify">
                <li>Supply of all equipment listed in the price schedule as a complete CCTV system.</li>
                <li>Delivery of the supplied materials to the project site in {projectLocation}.</li>
                <li>Installation and mounting of the supplied cameras, NVR, storage drives, PoE switches, and cabinets, subject to site readiness.</li>
                <li>Programming and configuration of cameras, recording profiles, storage settings, date/time, users, and remote-viewing readiness.</li>
                <li>System testing and commissioning, recording/playback verification, and final handover.</li>
                <li>Two-year warranty from final handover, subject to manufacturer terms and proper operating conditions.</li>
              </ul>
            </div>

            {/* Section 1.2: Scope Excluded */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-900 mb-2">
                1.2 The above Price excludes (by Client):
              </h3>
              <ul className="text-xs text-slate-800 space-y-1.5 list-disc list-inside leading-relaxed text-justify">
                <li>Quantities are estimated based on the BOQ provided by the Client. Any increase or change shall be treated as a variation order.</li>
                <li>Data, fiber, power, and control cables; connectors; patch panels; accessories; and consumables not specifically listed in the price schedule.</li>
                <li>Power outlets, network points, internet service, static public IP, client switches, monitors, workstations, UPS units, and third-party systems.</li>
              </ul>
            </div>

            {/* Section 2.0: Payment Terms */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-900 mb-2">
                2.0 Payment Terms
              </h3>
              <ul className="text-xs text-slate-800 space-y-1 list-disc list-inside">
                <li>50 % Down payment along with PO.</li>
                <li>45 % Before Delivery.</li>
                <li>5 % After Testing & Commissioning.</li>
              </ul>
            </div>

            {/* Section 2.1: Validity */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-slate-900 mb-2">
                2.1 Proposal Validity:
              </h3>
              <p className="text-xs text-slate-800">
                This proposal is valid for 15 days starting from the issuing date.
              </p>
            </div>
          </div>

          <RunningFooter />
        </div>

        {/* ======================================================== */}
        {/* PAGE 4: NOTES & BOUNDARIES OF TESTING & COMMISSIONING    */}
        {/* ======================================================== */}
        <div className="proposal-page page-break-before bg-white p-8 sm:p-12 rounded-xl shadow-md border border-slate-200 flex flex-col justify-between min-h-[280mm]">
          <div>
            <Masthead />

            <div className="mb-6">
              <h2 className="text-sm font-bold text-slate-900 mb-1">
                2.2 Notes:
              </h2>
              <div className="text-xs font-semibold text-slate-800 mb-3">
                Limits of Testing & Commissioning Scope
              </div>

              <ul className="text-xs text-slate-800 space-y-2 list-disc list-inside leading-relaxed text-justify">
                <li>15% VAT, which is shown separately in the commercial summary.</li>
                <li>Data, fiber, power, and control cables; connectors; patch panels; accessories; and consumables not specifically listed in the price schedule.</li>
                <li>Cable pulling, containment, conduits, trunking, civil works, core cutting, scaffolding, lifts, and electrical works.</li>
                <li>Power outlets, network points, internet service, static public IP, client switches, monitors, workstations, UPS units, and third-party systems.</li>
                <li>Any authority approval, Amn platform certificate, annual maintenance contract, or government fee; these can be quoted separately where applicable.</li>
                <li>Repair or rectification of existing infrastructure, defective cabling, or work performed by others.</li>
              </ul>
            </div>

            {/* Closing & Formal Signatures */}
            <div className="my-10 text-center">
              <p className="text-sm font-semibold text-slate-800 mb-1">
                Please don't hesitate to contact us for any clarification.
              </p>
              <p className="text-base font-bold text-slate-900">
                Best Regards,
              </p>
            </div>

            {/* Official Signature & Company Stamp Area */}
            <div className="max-w-[440px] mx-auto border border-slate-300 rounded-xl p-4 bg-slate-50/50 relative overflow-hidden">
              <div className="text-center font-bold text-xs text-slate-800 mb-1">
                الاعتماد والموافقة الرسمية / Certified Authorization
              </div>
              <div className="text-[10px] text-slate-500 text-center mb-2">
                Eng. Mokhtar Yousef - Projects Manager (م. مختار يوسف)
              </div>

              <div className="h-20 flex items-center justify-center relative">
                {signatures.reviewed || signatures.approved ? (
                  <img
                    src={signatures.reviewed || signatures.approved}
                    alt="Authorized Signature"
                    className="max-h-20 max-w-[160px] object-contain drop-shadow-xs z-10"
                  />
                ) : (
                  <div className="text-gray-300 text-xs italic z-10">
                    بانتظار التوقيع المعتمد (Pending Signature)
                  </div>
                )}

                {signatures.seal && (
                  <img
                    src={signatures.seal}
                    alt="Official Company Seal"
                    className="absolute max-h-20 max-w-[120px] object-contain opacity-85 pointer-events-none right-4"
                  />
                )}
              </div>

              <div className="text-center font-mono text-[9px] text-slate-400 mt-1">
                Sanaa Al Muarad Trading Est. - Official Corporate Seal
              </div>
            </div>
          </div>

          <RunningFooter />
        </div>

      </div>

      {/* Governance Signatures Modal */}
      {showGovModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-5">
              <h3 className="font-black text-slate-900 text-base">
                إدارة التواقيع المعتمدة والأختام الرسمية
              </h3>
              <button
                type="button"
                onClick={() => setShowGovModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <GovernanceSignatures
              onSignatureUpdated={() => {
                loadSignatures();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CommercialProposalPrint;
