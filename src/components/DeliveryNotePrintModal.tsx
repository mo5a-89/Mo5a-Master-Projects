import React from 'react';
import { DeliveryNote } from '../types';
import { DeliveryNoteDocument } from './DeliveryNoteDocument';
import { X } from 'lucide-react';

interface DeliveryNotePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryNote: DeliveryNote | null;
  onUpdateDeliveryNote?: (dn: DeliveryNote) => void;
  onDeleteDeliveryNote?: (id: string) => void;
  onOpenInvoiceForDN?: (dn: DeliveryNote) => void;
}

export const DeliveryNotePrintModal: React.FC<DeliveryNotePrintModalProps> = ({
  isOpen,
  onClose,
  deliveryNote,
  onUpdateDeliveryNote,
  onDeleteDeliveryNote,
  onOpenInvoiceForDN,
}) => {
  if (!isOpen || !deliveryNote) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in" dir="rtl">
      <div className="bg-slate-100 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 border border-slate-300 space-y-4">
        <div className="flex items-center justify-between no-print border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            معاينة وطباعة سند التسليم #{deliveryNote.dnNumber}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <DeliveryNoteDocument
          deliveryNote={deliveryNote}
          onClose={onClose}
          onUpdateDeliveryNote={onUpdateDeliveryNote}
          onDeleteDeliveryNote={onDeleteDeliveryNote}
          onOpenInvoiceForDN={onOpenInvoiceForDN}
        />
      </div>
    </div>
  );
};
