import React, { useState } from 'react';
import {
  PurchaseOrder,
  SupplierQuotation,
  Supplier,
  Project,
  ItemDeliveryStatus,
  User,
  MaterialReceiptRecord,
  DeliveryNote,
  ThreeWayMatchRecord,
  CustomerQuotation,
  Invoice,
} from '../types';
import { ProcurementSupplyChain } from './ProcurementSupplyChain';
import { ProcurementHub } from './ProcurementHub';
import { SiteLogisticsHub } from './SiteLogisticsHub';
import { ShoppingBag, Truck, GitCompare } from 'lucide-react';

export interface ProcurementManagementViewProps {
  currentUser: User;
  purchaseOrders: PurchaseOrder[];
  supplierQuotations: SupplierQuotation[];
  suppliers: Supplier[];
  projects: Project[];
  deliveryNotes?: DeliveryNote[];
  threeWayMatches?: ThreeWayMatchRecord[];
  customerQuotations?: CustomerQuotation[];
  invoices?: Invoice[];
  initialMode?: 'hub' | 'logistics' | 'supply_chain';
  onOpenNewPO: (projectId?: string, supplierQuoteId?: string) => void;
  onEditPO: (po: PurchaseOrder) => void;
  onUpdatePO?: (updatedPO: PurchaseOrder) => void;
  onDeletePO?: (poId: string) => void;
  onSelectProject?: (projectId: string) => void;
  onUpdateDeliveryStatus?: (poId: string, itemId: string, newStatus: ItemDeliveryStatus, qty?: number) => void;
  onOpenUploadSupplierQuote?: () => void;
  onSelectSupplierQuote?: (quoteId: string) => void;
  onSaveMaterialReceipt?: (poId: string, receipt: MaterialReceiptRecord, updatedPOItems: PurchaseOrder['items']) => void;
  onSaveDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onUpdateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onDeleteDeliveryNote?: (deliveryNoteId: string) => void;
  onOpenCreateInvoiceForDN?: (deliveryNote: DeliveryNote) => void;
  onCreateInvoice?: (invoice: Invoice) => void;
  onUpdateProject?: (project: Project) => void;
  onNavigateTab?: (tab: string) => void;
  onUpdateThreeWayMatch?: (record: ThreeWayMatchRecord) => void;
  onOpenThreeWayModal?: () => void;
}

export const ProcurementManagementView: React.FC<ProcurementManagementViewProps> = (props) => {
  const [viewMode, setViewMode] = useState<'hub' | 'logistics' | 'supply_chain'>(
    props.initialMode || 'logistics'
  );

  return (
    <div className="space-y-4">
      {/* Top Level Pillar View Switcher */}
      <div className="flex flex-wrap items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('logistics')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'logistics'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>اللوجستيات ومحطة التسليم والاستلام (Site Logistics & Material Hub)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('hub')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'hub'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>مركز المشتريات وأوامر الشراء (Procurement Hub)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('supply_chain')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === 'supply_chain'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>سلسلة الإمداد والمناقصات (Supply Chain & RFQ)</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 hidden lg:inline-block font-mono">
          {viewMode === 'logistics'
            ? 'Site Delivery Notes (DN) & Inventory Depletion'
            : viewMode === 'hub'
            ? 'Executive Purchasing & POs'
            : 'Vendor Comparisons & RFQs'}
        </span>
      </div>

      {viewMode === 'logistics' ? (
        <SiteLogisticsHub
          currentUser={props.currentUser}
          projects={props.projects}
          purchaseOrders={props.purchaseOrders}
          deliveryNotes={props.deliveryNotes || []}
          customerQuotations={props.customerQuotations}
          invoices={props.invoices}
          onSaveDeliveryNote={props.onSaveDeliveryNote}
          onUpdateDeliveryNote={props.onUpdateDeliveryNote}
          onDeleteDeliveryNote={props.onDeleteDeliveryNote}
          onSaveMaterialReceipt={props.onSaveMaterialReceipt}
          onSelectProject={props.onSelectProject}
          onOpenCreateInvoiceForDN={props.onOpenCreateInvoiceForDN}
          onCreateInvoice={props.onCreateInvoice}
          onNavigateTab={props.onNavigateTab}
          onUpdateProject={props.onUpdateProject}
        />
      ) : viewMode === 'hub' ? (
        <ProcurementHub {...props} />
      ) : (
        <ProcurementSupplyChain {...props} />
      )}
    </div>
  );
};

export default ProcurementManagementView;
