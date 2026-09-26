import React, { useState } from 'react';
import { PurchaseOrder } from '../types';
import { PurchaseOrderDocument } from './PurchaseOrderDocument';
import { PurchaseOrderPrint } from './PurchaseOrderPrint';
import { Printer, FileText, Eye } from 'lucide-react';
import { exportPurchaseOrderToPDF } from '../utils/purchaseOrderUtils';
import { MobileViewerTopBar, useModalBackDismiss } from './MobileViewerTopBar';

interface PODocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder | null;
  onEdit?: (po: PurchaseOrder) => void;
  onUpdateStatus?: (poId: string, newStatus: PurchaseOrder['status']) => void;
}

export const PODocumentModal: React.FC<PODocumentModalProps> = ({
  isOpen,
  onClose,
  po,
  onEdit,
  onUpdateStatus,
}) => {
  const [viewMode, setViewMode] = useState<'document' | 'print'>('document');

  // Enforce hardware and browser back button support to prevent viewport trapping
  useModalBackDismiss(onClose);

  if (!isOpen || !po) return null;

  const handlePrint = () => {
    exportPurchaseOrderToPDF(po);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 overflow-hidden my-auto min-h-screen sm:min-h-0 sm:max-h-[96vh] flex flex-col">
        {/* Persistent Sticky Mobile-Friendly Top Action Bar */}
        <MobileViewerTopBar
          title={`أمر شراء: ${po.poNumber}`}
          subtitle={`${po.vendorName} • رسمي معتمد`}
          onClose={onClose}
          backButtonText="← العودة إلى أوامر الشراء"
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('document')}
                  className={`px-2 py-1 rounded-md transition font-medium flex items-center gap-1 cursor-pointer ${
                    viewMode === 'document' ? 'bg-[#1e3a8a] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">حركات التوريد</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('print')}
                  className={`px-2 py-1 rounded-md transition font-medium flex items-center gap-1 cursor-pointer ${
                    viewMode === 'print' ? 'bg-[#007A5A] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">معاينة A4</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">طباعة / PDF</span>
              </button>
            </div>
          }
        />

        {/* Modal Scrollable Body */}
        <div className="p-3 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          {viewMode === 'document' ? (
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-xs p-4 sm:p-6 border border-slate-200">
              <PurchaseOrderDocument
                po={po}
                onEdit={onEdit}
                onClose={onClose}
                onUpdateStatus={onUpdateStatus}
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <PurchaseOrderPrint po={po} onClose={onClose} showControls={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
