import React from 'react';
import { SupplierQuotation } from '../types';
import {
  FileText,
  Eye,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';

interface SupplierQuoteCardProps {
  supplierQuote: SupplierQuotation;
  projectId?: string;
  onViewSupplierQuote?: (sq: SupplierQuotation) => void;
  onOpenPrepareQuoteModal?: (supplierQuoteId: string) => void;
  onOpenNewPOModal?: (projectId?: string, supplierQuoteId?: string) => void;
  onDeleteSupplierQuote?: (supplierQuoteId: string) => void;
}

export const SupplierQuoteCard: React.FC<SupplierQuoteCardProps> = ({
  supplierQuote,
  projectId,
  onViewSupplierQuote,
  onOpenPrepareQuoteModal,
  onOpenNewPOModal,
  onDeleteSupplierQuote,
}) => {
  const isConvertedToPO = supplierQuote.status === 'converted_to_po' || !!supplierQuote.poId;
  const isPreserved = supplierQuote.status === 'preserved' || supplierQuote.originalStatus === 'original_kept';

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 hover:border-blue-300 transition shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] border border-blue-200 flex items-center justify-center font-bold text-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900">{supplierQuote.supplierName}</span>
              <span className="font-mono text-xs font-bold text-slate-500">#{supplierQuote.quotationNumber}</span>
              
              {/* Status Badge */}
              {isConvertedToPO ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>تم إصدار أمر شراء (PO Issued)</span>
                </span>
              ) : isPreserved ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>محفوظة ومعتمدة</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                  مسودة تسعيرة
                </span>
              )}
            </div>
            
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
              <span>الملف: {supplierQuote.rawFileName || supplierQuote.sourceFileName || 'تسعيرة مورد'}</span>
              <span>•</span>
              <span>({supplierQuote.items?.length || supplierQuote.itemsCount || 0} بنود مستخرجة)</span>
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="font-mono text-xs font-bold text-slate-900 block">
            {supplierQuote.totalAmount.toLocaleString()} SAR
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {supplierQuote.subtotal ? `صافي: ${supplierQuote.subtotal.toLocaleString()} SAR` : 'شامل الضريبة 15%'}
          </span>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {onViewSupplierQuote && (
            <button
              type="button"
              onClick={() => onViewSupplierQuote(supplierQuote)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-700" />
              <span>معاينة</span>
            </button>
          )}

          {onOpenPrepareQuoteModal && (
            <button
              type="button"
              onClick={() => onOpenPrepareQuoteModal(supplierQuote.id)}
              className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-[#007A5A] border border-teal-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#007A5A]" />
              <span>تسعيرة عميل</span>
            </button>
          )}

          {onOpenNewPOModal && (
            <button
              type="button"
              onClick={() => onOpenNewPOModal(projectId || supplierQuote.projectId, supplierQuote.id)}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#1e3a8a]" />
              <span>أمر شراء (PO)</span>
            </button>
          )}

          {supplierQuote.driveUrl && (
            <a
              href={supplierQuote.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 transition"
              title="فتح الملف السحابي في Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Google Drive</span>
            </a>
          )}
        </div>

        {onDeleteSupplierQuote && (
          <button
            type="button"
            onClick={() => onDeleteSupplierQuote(supplierQuote.id)}
            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
            title="حذف تسعيرة المورد"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
