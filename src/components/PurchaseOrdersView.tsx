import React, { useState, useMemo } from 'react';
import {
  PurchaseOrder,
  Project,
  SupplierQuotation,
  Supplier,
  CustomerQuotation,
  PricedItemRecord,
  MaterialReceiptRecord,
  DeliveryNote,
  POPaymentRecord,
  User,
} from '../types';
import { isSuperAdmin, hasPermission, evaluatePoApprovalAuthority } from '../utils/rbacUtils';
import { PurchaseOrderDocument } from './PurchaseOrderDocument';
import { PricedItemsLibraryView } from './PricedItemsLibraryView';
import { ReceiveMaterialsModal } from './ReceiveMaterialsModal';
import { CreateDeliveryNoteModal } from './CreateDeliveryNoteModal';
import { DeliveryNoteDocument } from './DeliveryNoteDocument';
import { POPaymentLedgerModal } from './POPaymentLedgerModal';
import { getAllPricedItems } from '../utils/pricedItemsUtils';
import { useSettings } from '../context/SettingsContext';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  FileText,
  Printer,
  Edit3,
  Trash2,
  Building,
  CheckCircle2,
  Clock,
  Send,
  ExternalLink,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  Tag,
  Archive,
  PackageCheck,
  Receipt,
  Truck,
  Layers,
  ArrowUpRight,
  Package,
  AlertCircle,
  Eye,
  Check,
  Sparkles,
  RefreshCw,
  RotateCcw,
  X,
  Box,
  CreditCard,
  DollarSign,
  Lock,
  ShieldCheck,
} from 'lucide-react';

interface PurchaseOrdersViewProps {
  currentUser?: User | null;
  purchaseOrders: PurchaseOrder[];
  projects: Project[];
  supplierQuotations: SupplierQuotation[];
  suppliers: Supplier[];
  customerQuotations?: CustomerQuotation[];
  archivedPricedItems?: PricedItemRecord[];
  deliveryNotes?: DeliveryNote[];
  onCreateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onUpdateDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onDeleteDeliveryNote?: (deliveryNoteId: string) => void;
  onOpenNewPOModal: (projectId?: string, supplierQuoteId?: string) => void;
  onEditPO: (po: PurchaseOrder) => void;
  onDeletePO: (poId: string) => void;
  onUpdateStatus: (poId: string, status: PurchaseOrder['status']) => void;
  onApprovePO?: (po: PurchaseOrder) => void;
  onOpenUploadSupplierModal: () => void;
  onIssuePOWithItem?: (item: PricedItemRecord) => void;
  onSaveMaterialReceipt?: (
    poId: string,
    receipt: MaterialReceiptRecord,
    updatedItems: PurchaseOrder['items']
  ) => void;
  onInvoiceToClient?: (params: {
    projectId: string;
    receipt: MaterialReceiptRecord;
    itemsToInvoice: {
      description: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      sourceItemId: string;
    }[];
  }) => void;
  onOpenCreateInvoiceForDN?: (deliveryNote: DeliveryNote) => void;
  onOpenCreateInvoiceForDNs?: (deliveryNotes: DeliveryNote[]) => void;
  onSavePOPayment?: (poId: string, updatedPO: PurchaseOrder) => void;
  onDeleteMaterialReceipt?: (poId: string, receiptId: string) => void;
  onResetPOReceipts?: (poId: string) => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  currentUser,
  purchaseOrders,
  projects,
  supplierQuotations,
  suppliers,
  customerQuotations = [],
  archivedPricedItems = [],
  deliveryNotes = [],
  onCreateDeliveryNote,
  onUpdateDeliveryNote,
  onDeleteDeliveryNote,
  onOpenNewPOModal,
  onEditPO,
  onDeletePO,
  onUpdateStatus,
  onApprovePO,
  onOpenUploadSupplierModal,
  onIssuePOWithItem,
  onSaveMaterialReceipt,
  onInvoiceToClient,
  onOpenCreateInvoiceForDN,
  onOpenCreateInvoiceForDNs,
  onSavePOPayment,
  onDeleteMaterialReceipt,
  onResetPOReceipts,
}) => {
  const { t, settings } = useSettings();
  const canApprove = useMemo(() => {
    if (!currentUser) return true;
    if (isSuperAdmin(currentUser)) return true;
    return hasPermission(currentUser, 'canApprovePO');
  }, [currentUser]);
  // Navigation Sub-tabs under Supply Chain Master Hub
  const [subTab, setSubTab] = useState<'orders' | 'delivery_notes' | 'delivery_note_materials' | 'priced_items'>('orders');

  // Multi-selection state for Delivery Notes batch invoicing
  const [selectedDnIdsForBatchInvoice, setSelectedDnIdsForBatchInvoice] = useState<string[]>([]);

  // Modal & Document View States
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [viewingDeliveryNote, setViewingDeliveryNote] = useState<DeliveryNote | null>(null);
  const [poForReceiving, setPoForReceiving] = useState<PurchaseOrder | null>(null);
  const [poForLedger, setPoForLedger] = useState<PurchaseOrder | null>(null);
  const [materialReturnPO, setMaterialReturnPO] = useState<PurchaseOrder | null>(null);
  const [deliveryNoteModalConfig, setDeliveryNoteModalConfig] = useState<{
    isOpen: boolean;
    targetProject?: Project;
    prefillPO?: PurchaseOrder;
    prefillReceipt?: MaterialReceiptRecord;
    prefillItems?: Array<{
      sourceItemId: string;
      description: string;
      unit: string;
      orderedQty: number;
      deliveredQty: number;
      unitPrice?: number;
    }>;
  }>({ isOpen: false });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [poToDelete, setPoToDelete] = useState<any | null>(null);
  const [dnToDelete, setDnToDelete] = useState<DeliveryNote | null>(null);

  // Unified Priced Items library across all projects & deleted quotes
  const allPricedItems = useMemo(() => {
    return getAllPricedItems(
      customerQuotations,
      supplierQuotations,
      projects,
      archivedPricedItems
    );
  }, [customerQuotations, supplierQuotations, projects, archivedPricedItems]);

  // Currently viewed PO
  const activePO = purchaseOrders.find((po) => po.id === selectedPOId);

  // Derived "Delivery Note Materials" (Inventory & Backorder items ready for client export)
  const receivedMaterialsInventory = useMemo(() => {
    const list: Array<{
      id: string;
      poId: string;
      poNumber: string;
      poDate: string;
      vendorName: string;
      projectId: string;
      projectName: string;
      projectRef?: string;
      customerName?: string;
      poItemId: string;
      itemNo: number;
      description: string;
      unit: string;
      unitPrice: number;
      poOrderedQty: number;
      totalReceivedQty: number;
      dispatchedToClientQty: number;
      availableForDispatchQty: number;
      receiptsCount: number;
      latestReceiptDate?: string;
    }> = [];

    purchaseOrders.forEach((po) => {
      const proj = projects.find((p) => p.id === po.projectId);
      const customerName = proj?.customerName || po.projectName;

      (po.items || []).forEach((item, idx) => {
        // Calculate total received from all material receipts
        let totalReceived = 0;
        let receiptsCount = 0;
        let latestReceiptDate: string | undefined = undefined;

        (po.materialReceipts || []).forEach((r) => {
          const match = (r.receivedItems || []).find((ri) => ri.poItemId === item.id);
          if (match) {
            totalReceived += match.receivedQty || 0;
            receiptsCount++;
            if (!latestReceiptDate || (r.receiptDate && r.receiptDate > latestReceiptDate)) {
              latestReceiptDate = r.receiptDate;
            }
          }
        });

        // Fallback to item.deliveredQty if no explicit receipt items mapped
        if (totalReceived === 0 && (item.deliveredQty || 0) > 0) {
          totalReceived = item.deliveredQty || 0;
        }

        // Calculate already delivered to client from Delivery Notes for this project
        let dispatchedToClient = 0;
        deliveryNotes
          .filter((dn) => dn.projectId === po.projectId)
          .forEach((dn) => {
            (dn.items || []).forEach((dni) => {
              if (
                dni.sourceItemId === item.id ||
                dni.description.trim().toLowerCase() === item.description.trim().toLowerCase()
              ) {
                dispatchedToClient += dni.deliveredQty || 0;
              }
            });
          });

        const availableForDispatch = Math.max(0, totalReceived - dispatchedToClient);

        if (totalReceived > 0 || (po.materialReceipts && po.materialReceipts.length > 0)) {
          list.push({
            id: `${po.id}-${item.id}-${idx}`,
            poId: po.id,
            poNumber: po.poNumber,
            poDate: po.date,
            vendorName: po.vendorName,
            projectId: po.projectId,
            projectName: po.projectName,
            projectRef: po.projectRef,
            customerName,
            poItemId: item.id,
            itemNo: item.itemNo || idx + 1,
            description: item.description,
            unit: item.unit || 'EA',
            unitPrice: item.unitPrice || 0,
            poOrderedQty: item.quantity,
            totalReceivedQty: totalReceived,
            dispatchedToClientQty: dispatchedToClient,
            availableForDispatchQty: availableForDispatch,
            receiptsCount,
            latestReceiptDate,
          });
        }
      });
    });

    return list;
  }, [purchaseOrders, projects, deliveryNotes]);

  // If a specific PO is selected for document view
  if (activePO) {
    return (
      <>
        <PurchaseOrderDocument
          po={activePO}
          onClose={() => setSelectedPOId(null)}
          onEdit={(po) => {
            setSelectedPOId(null);
            onEditPO(po);
          }}
          onUpdateStatus={onUpdateStatus}
          onOpenReceiveMaterials={(po) => setPoForReceiving(po)}
          onOpenCreateDeliveryNote={(po, receipt) => {
            const proj = projects.find((p) => p.id === po.projectId);
            setDeliveryNoteModalConfig({
              isOpen: true,
              targetProject: proj,
              prefillPO: po,
              prefillReceipt: receipt,
            });
          }}
          onDeleteMaterialReceipt={onDeleteMaterialReceipt}
          onResetPOReceipts={onResetPOReceipts}
        />

        {poForReceiving && (
          <ReceiveMaterialsModal
            isOpen={true}
            po={poForReceiving}
            project={projects.find((p) => p.id === poForReceiving.projectId)}
            onClose={() => setPoForReceiving(null)}
            onSaveReceipt={(poId, receipt, updatedItems) => {
              if (onSaveMaterialReceipt) {
                onSaveMaterialReceipt(poId, receipt, updatedItems);
              }
            }}
            onCreateDeliveryNoteFromReceipt={(po, receipt) => {
              const proj = projects.find((p) => p.id === po.projectId);
              setDeliveryNoteModalConfig({
                isOpen: true,
                targetProject: proj,
                prefillPO: po,
                prefillReceipt: receipt,
              });
            }}
            onInvoiceToClient={(params) => {
              if (onInvoiceToClient) {
                onInvoiceToClient(params);
              }
            }}
          />
        )}

        {deliveryNoteModalConfig.isOpen && (
          <CreateDeliveryNoteModal
            project={deliveryNoteModalConfig.targetProject}
            allProjects={projects}
            prefillPO={deliveryNoteModalConfig.prefillPO}
            prefillReceipt={deliveryNoteModalConfig.prefillReceipt}
            prefillItems={deliveryNoteModalConfig.prefillItems}
            existingDeliveryNotes={deliveryNotes}
            onClose={() => setDeliveryNoteModalConfig({ isOpen: false })}
            onSaveDeliveryNote={(newDN) => {
              if (onCreateDeliveryNote) {
                onCreateDeliveryNote(newDN);
              }
              setDeliveryNoteModalConfig({ isOpen: false });
            }}
          />
        )}
      </>
    );
  }

  // If viewing a specific Delivery Note document
  if (viewingDeliveryNote) {
    return (
      <DeliveryNoteDocument
        deliveryNote={viewingDeliveryNote}
        onClose={() => setViewingDeliveryNote(null)}
        onOpenInvoiceForDN={onOpenCreateInvoiceForDN}
        onDeleteDeliveryNote={(dnId) => {
          if (onDeleteDeliveryNote) {
            onDeleteDeliveryNote(dnId);
          }
          setViewingDeliveryNote(null);
        }}
        onUpdateDeliveryNote={(updatedDN) => {
          if (onUpdateDeliveryNote) {
            onUpdateDeliveryNote(updatedDN);
          }
          setViewingDeliveryNote(updatedDN);
        }}
      />
    );
  }

  // Filtering Logic for Purchase Orders
  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesProject = filterProject === 'all' || po.projectId === filterProject;
    const matchesVendor =
      filterVendor === 'all' ||
      po.vendorName.toLowerCase().includes(filterVendor.toLowerCase()) ||
      po.supplierId === filterVendor;
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'Pending'
        ? po.status === 'Issued' || po.status === 'Approved' || (po.deliveryStatus !== 'Delivered' && po.status !== 'Completed')
        : po.status === filterStatus;
    const matchesSearch =
      searchQuery.trim() === '' ||
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.projectRef && po.projectRef.toLowerCase().includes(searchQuery.toLowerCase())) ||
      po.items.some((i) => i.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesProject && matchesVendor && matchesStatus && matchesSearch;
  });

  // Filtering Logic for Delivery Notes
  const filteredDeliveryNotes = deliveryNotes.filter((dn) => {
    const matchesProject = filterProject === 'all' || dn.projectId === filterProject;
    const matchesSearch =
      searchQuery.trim() === '' ||
      dn.dnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dn.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dn.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dn.recipientName && dn.recipientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (dn.items && dn.items.some((i) => i.description.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesProject && matchesSearch;
  });

  // Filtering Logic for Received Delivery Note Materials
  const filteredMaterials = receivedMaterialsInventory.filter((mat) => {
    const matchesProject = filterProject === 'all' || mat.projectId === filterProject;
    const matchesVendor =
      filterVendor === 'all' || mat.vendorName.toLowerCase().includes(filterVendor.toLowerCase());
    const matchesSearch =
      searchQuery.trim() === '' ||
      mat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mat.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mat.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mat.vendorName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesProject && matchesVendor && matchesSearch;
  });

  // Calculate High-level KPIs
  const totalPOAmount = purchaseOrders.reduce((sum, po) => sum + po.grandTotal, 0);
  const totalDeliveredPOs = purchaseOrders.filter(
    (po) => po.status === 'Completed' || po.deliveryStatus === 'Delivered'
  ).length;
  const totalPendingPOs = purchaseOrders.length - totalDeliveredPOs;
  const totalAvailableMaterialsForDispatch = receivedMaterialsInventory.filter(
    (m) => m.availableForDispatchQty > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Master Tab Navigation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1e3a8a] to-[#152e6f] text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">
                  {t.supplyChainPOs || 'إدارة المشتريات وسلاسل الإمداد والتوريد'}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.procurementSubtitle || 'إصدار أوامر الشراء، استلام وتتبع المواد من الموردين، وإصدار سندات تسليم البضاعة للعملاء'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenUploadSupplierModal}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-[#007A5A] border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs"
              title="استيراد وتفريغ تسعيرة المورد بالذكاء الاصطناعي"
            >
              <Upload className="w-4 h-4 text-[#007A5A]" />
              <span>استيراد تسعيرة مورد (AI)</span>
            </button>

            {/* Global Create Delivery Note Trigger */}
            <button
              type="button"
              onClick={() => {
                setDeliveryNoteModalConfig({
                  isOpen: true,
                  targetProject: projects[0],
                });
              }}
              className="px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-700 hover:to-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Truck className="w-4 h-4 text-teal-200" />
              <span>+ إصدار سند تسليم بضاعة (Delivery Note)</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenNewPOModal()}
              className="px-4 py-2.5 bg-[#1e3a8a] hover:bg-[#152e6f] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ أمر شراء جديد (New PO)</span>
            </button>
          </div>
        </div>

        {/* Master Top-Level Sub-Tabs Navigation */}
        <div className="flex items-center gap-3 py-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('orders')}
            className={`px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-3 ${
              subTab === 'orders'
                ? 'bg-blue-50/90 border-blue-400 text-[#1e3a8a] shadow-xs ring-2 ring-blue-500/10'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/80 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
              subTab === 'orders' ? 'bg-blue-100 text-[#1e3a8a]' : 'bg-slate-100 text-slate-500'
            }`}>
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-xs font-bold">أوامر الشراء للمشاريع <span className="opacity-75 font-normal">(Purchase Orders)</span></span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-2xs ${
                subTab === 'orders' ? 'bg-blue-200/80 text-[#1e3a8a]' : 'bg-slate-100 text-slate-700'
              }`}>
                {purchaseOrders.length}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('delivery_notes')}
            className={`px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-3 ${
              subTab === 'delivery_notes'
                ? 'bg-emerald-50/90 border-emerald-400 text-emerald-900 shadow-xs ring-2 ring-emerald-500/10'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/80 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
              subTab === 'delivery_notes' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-xs font-bold">سندات تسليم العملاء <span className="opacity-75 font-normal">(Delivery Notes Hub)</span></span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-2xs ${
                subTab === 'delivery_notes' ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-100 text-slate-700'
              }`}>
                {deliveryNotes.length}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('delivery_note_materials')}
            className={`px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-3 ${
              subTab === 'delivery_note_materials'
                ? 'bg-indigo-50/90 border-indigo-400 text-indigo-900 shadow-xs ring-2 ring-indigo-500/10'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/80 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
              subTab === 'delivery_note_materials' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
            }`}>
              <Box className="w-5 h-5" />
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-xs font-bold">مواد سندات التسليم والمخزون <span className="opacity-75 font-normal">(Delivery Note Materials)</span></span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-2xs ${
                subTab === 'delivery_note_materials' ? 'bg-indigo-200/80 text-indigo-900' : 'bg-slate-100 text-slate-700'
              }`}>
                {totalAvailableMaterialsForDispatch > 0 ? `${totalAvailableMaterialsForDispatch} جاهز` : '0'}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('priced_items')}
            className={`px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer shrink-0 flex items-center gap-3 ${
              subTab === 'priced_items'
                ? 'bg-purple-50/90 border-purple-400 text-purple-900 shadow-xs ring-2 ring-purple-500/10'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50/80 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
              subTab === 'priced_items' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-500'
            }`}>
              <Tag className="w-5 h-5" />
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-xs font-bold">بنك الأصناف المسعرة <span className="opacity-75 font-normal">(Priced Items Library)</span></span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold shadow-2xs ${
                subTab === 'priced_items' ? 'bg-purple-200/80 text-purple-900' : 'bg-slate-100 text-slate-700'
              }`}>
                {allPricedItems.length}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* 1. PURCHASE ORDERS MASTER TAB */}
      {subTab === 'orders' && (
        <div className="space-y-6">
          {/* KPI Summary Cards - Interactive Filtering */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            <div
              onClick={() => setFilterStatus('all')}
              className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-center gap-3 ${
                filterStatus === 'all'
                  ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي أوامر الشراء</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {purchaseOrders.length} أمر شراء
                </span>
              </div>
            </div>

            <div
              onClick={() => setFilterStatus('all')}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:border-emerald-300 transition select-none"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي قيمة المشتريات</span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  {totalPOAmount.toLocaleString()} <span className="text-xs">SAR</span>
                </span>
              </div>
            </div>

            <div
              onClick={() => setFilterStatus('Completed')}
              className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-center gap-3 ${
                filterStatus === 'Completed'
                  ? 'bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-purple-300 shadow-xs'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">أوامر مكتملة التوريد</span>
                <span className="text-lg font-black text-purple-900 font-mono">
                  {totalDeliveredPOs} أمر
                </span>
              </div>
            </div>

            <div
              onClick={() => setFilterStatus('Pending')}
              className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-center gap-3 ${
                filterStatus === 'Pending'
                  ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">أوامر قيد التوريد / الانتظار</span>
                <span className="text-lg font-black text-amber-900 font-mono">
                  {totalPendingPOs} أمر
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم أمر الشراء، المورد، المشروع، أو اسم الصنف..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">كافة المشاريع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.projectNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">كافة الحالات</option>
                  <option value="Issued">صادر (Issued)</option>
                  <option value="Approved">معتمد (Approved)</option>
                  <option value="Pending">قيد التوريد والانتظار</option>
                  <option value="Completed">مكتمل (Delivered)</option>
                  <option value="Draft">مسودة (Draft)</option>
                </select>
              </div>
            </div>
          </div>

          {/* PO List */}
          {filteredPOs.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">لا توجد أوامر شراء مطابقة للبحث</h3>
              <p className="text-xs text-slate-500">
                يمكنك إنشاء أمر شراء جديد لأي مشروع أو مسح شروط الفلترة.
              </p>
              <button
                type="button"
                onClick={() => onOpenNewPOModal()}
                className="px-4 py-2 bg-[#1e3a8a] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ إنشاء أمر شراء</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPOs.map((po) => {
                const totalItemsCount = po.items?.length || 0;
                const receiptsCount = po.materialReceipts?.length || 0;
                const isDelivered = po.status === 'Completed' || po.deliveryStatus === 'Delivered';

                // Calculate fulfillment percent
                const totalOrderedQty = po.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                const totalDeliveredQty = po.items.reduce((s, i) => s + (Number(i.deliveredQty) || 0), 0);
                const fulfillmentPercent = totalOrderedQty > 0 ? Math.min(100, Math.round((totalDeliveredQty / totalOrderedQty) * 100)) : 0;

                // Payments calculation
                const poPaidAmount = po.paidAmount ?? (po.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                const poGrandTotal = Number(po.grandTotal) || 0;
                const poRemaining = Math.max(0, poGrandTotal - poPaidAmount);
                const isFullyPaid = poPaidAmount >= poGrandTotal && poGrandTotal > 0;
                const isPartiallyPaid = poPaidAmount > 0 && poPaidAmount < poGrandTotal;

                return (
                  <div
                    key={po.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 transition space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold font-mono">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-[#1e3a8a]">
                              {po.poNumber}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                                po.status === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : po.status === 'Completed'
                                  ? 'bg-purple-100 text-purple-800'
                                  : po.status === 'Issued'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {po.status === 'Approved'
                                ? 'معتمد رسمياً'
                                : po.status === 'Completed'
                                ? 'مكتمل التوريد'
                                : po.status === 'Issued'
                                ? 'صادر للموزع'
                                : 'مسودة'}
                            </span>
                            {receiptsCount > 0 && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10.5px] font-bold px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>{receiptsCount} استلام مواد ({fulfillmentPercent}%)</span>
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                isFullyPaid
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : isPartiallyPaid
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isFullyPaid ? 'مسدد للمورد بالكامل ✓' : isPartiallyPaid ? `مسدد جزئياً (${poPaidAmount.toLocaleString()} SAR)` : 'غير مسدد للمورد'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            المورد: <strong className="text-slate-900">{po.vendorName}</strong> | المشروع: <strong className="text-slate-900">{po.projectName}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <span className="text-[11px] text-slate-400 block">الإجمالي الشامل (15% VAT)</span>
                        <span className="text-base font-black text-[#1e3a8a]">
                          {poGrandTotal.toLocaleString()} SAR
                        </span>
                        {poPaidAmount > 0 && (
                          <span className="text-[10px] text-emerald-700 block font-bold">
                            المدفوع: {poPaidAmount.toLocaleString()} | المتبقي: {poRemaining.toLocaleString()} SAR
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dynamic Fulfillment Progress Bar */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          نسبة الإنجاز والتوريد:
                        </span>
                        <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              fulfillmentPercent >= 100
                                ? 'bg-emerald-600'
                                : fulfillmentPercent > 0
                                ? 'bg-blue-600'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${fulfillmentPercent}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {fulfillmentPercent}%
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>المورد: <strong>{totalDeliveredQty}</strong> من <strong>{totalOrderedQty}</strong> وحدة</span>
                        <span>تاريخ الأمر: <strong>{po.date}</strong></span>
                      </div>
                    </div>

                    {/* PO Items Summary Chips */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500 font-medium">الأصناف ({totalItemsCount}):</span>
                        {po.items.slice(0, 3).map((it, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                          >
                            {it.description} ({it.deliveredQty || 0}/{it.quantity} {it.unit || 'EA'})
                          </span>
                        ))}
                        {totalItemsCount > 3 && (
                          <span className="text-slate-400 text-[11px]">
                            +{totalItemsCount - 3} أصناف أخرى...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Toolbar on PO Card */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Receive Materials Button */}
                        <button
                          type="button"
                          onClick={() => setPoForReceiving(po)}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-[#007A5A] hover:from-emerald-700 hover:to-[#00664B] text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <PackageCheck className="w-4 h-4 text-emerald-200" />
                          <span>استلام وتوريد المواد (Receive)</span>
                        </button>

                        {/* 2. Supplier Milestone Ledger Button */}
                        <button
                          type="button"
                          onClick={() => setPoForLedger(po)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                          title="سجل دفعات المورد والمطابقة المحاسبية"
                        >
                          <CreditCard className="w-4 h-4 text-amber-700" />
                          <span>سجل دفعات المورد (Ledger)</span>
                        </button>

                        {/* 3. Create Delivery Note Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const proj = projects.find((p) => p.id === po.projectId);
                            setDeliveryNoteModalConfig({
                              isOpen: true,
                              targetProject: proj,
                              prefillPO: po,
                            });
                          }}
                          className="px-3 py-1.5 bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-300 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer"
                          title="إصدار سند تسليم بضاعة للعميل بموجب بنود أمر الشراء"
                        >
                          <Truck className="w-4 h-4 text-teal-600" />
                          <span>إصدار سند تسليم للعميل</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {po.status === 'Draft' && canApprove && (
                          <button
                            type="button"
                            onClick={() => {
                              const auth = evaluatePoApprovalAuthority(currentUser || null, poGrandTotal);
                              if (!auth.canApprove) {
                                alert(auth.reason || `قيمة أمر الشراء (${poGrandTotal.toLocaleString()} ر.س) تتجاوز سقف اعتماد مدير المشاريع (20,000 ر.س). يتطلب الأمر اعتماد المالك العام.`);
                                return;
                              }
                              if (onApprovePO) {
                                onApprovePO(po);
                              } else {
                                onUpdateStatus(po.id, 'Approved');
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="اعتماد أمر الشراء رسمياً وتفعيل التوريد"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>اعتماد أمر الشراء</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedPOId(po.id)}
                          className="px-3 py-1.5 bg-[#1e3a8a] text-white hover:bg-[#152e6f] rounded-lg font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض المستند والطباعة</span>
                        </button>

                        {totalDeliveredQty > 0 || isDelivered || (po.materialReceipts && po.materialReceipts.length > 0) || po.status === 'Approved' || po.status === 'Issued' || po.status === 'Completed' ? (
                          <span
                            className="px-2.5 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-not-allowed"
                            title="أمر الشراء معتمد رسمياً ومقفل نظامياً. لا يمكن التعديل اليدوي المباشر إلا بموجب أمر تغيير رسمي (Change Order)"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>معتمد ومقفل</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEditPO(po)}
                            className="px-3 py-1.5 bg-blue-50 text-[#1e3a8a] hover:bg-blue-100 border border-blue-200 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                            title="تعديل أمر الشراء والبنود والكميات"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            <span>تعديل</span>
                          </button>
                        )}

                        {onResetPOReceipts && (
                          <button
                            type="button"
                            onClick={() => {
                              setMaterialReturnPO(po);
                            }}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                            title="إعادة ضبط المواد وإرجاع الكميات من المستودع للعميل (أمر الشراء الصادر)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>إعادة ضبط المواد</span>
                          </button>
                        )}

                        {totalDeliveredQty > 0 || isDelivered || (po.materialReceipts && po.materialReceipts.length > 0) ? (
                          <span
                            className="p-1.5 text-slate-300 bg-slate-100 rounded-lg cursor-not-allowed inline-flex items-center justify-center"
                            title="المستند مقفل نظامياً ولا يمكن حذفه لوجود استلامات مواد فعلية مرتبطة به"
                          >
                            <Lock className="w-4 h-4" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPoToDelete(po)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="حذف أمر الشراء"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. DELIVERY NOTES MASTER TAB (Relocated & Consolidated Hub) */}
      {subTab === 'delivery_notes' && (
        <div className="space-y-6">
          {/* KPI Summary Cards for Delivery Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#007A5A] flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي سندات التسليم</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {deliveryNotes.length} سند تسليم
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي القطع الموردة للعملاء</span>
                <span className="text-lg font-black text-[#1e3a8a] font-mono">
                  {deliveryNotes.reduce(
                    (s, dn) => s + (dn.items || []).reduce((is, it) => is + (it.deliveredQty || 0), 0),
                    0
                  )}{' '}
                  <span className="text-xs">قطعة</span>
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">سندات جاهزة للفوترة</span>
                <span className="text-lg font-black text-teal-900 font-mono">
                  {deliveryNotes.filter((dn) => dn.invoicedStatus === 'Uninvoiced' || !dn.invoicedStatus).length} سند
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">سندات تم إصدار فواتيرها</span>
                <span className="text-lg font-black text-purple-900 font-mono">
                  {deliveryNotes.filter((dn) => dn.invoicedStatus === 'Fully Invoiced' || dn.invoicedStatus === 'Partially Invoiced').length} سند
                </span>
              </div>
            </div>
          </div>

          {/* Search & Action Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم سند التسليم، اسم العميل، المشروع، المستلم، أو الأصناف..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Batch Invoicing Action Button */}
              {selectedDnIdsForBatchInvoice.length > 0 && onOpenCreateInvoiceForDNs && (
                <button
                  type="button"
                  onClick={() => {
                    const chosen = deliveryNotes.filter((d) => selectedDnIdsForBatchInvoice.includes(d.id));
                    onOpenCreateInvoiceForDNs(chosen);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer animate-pulse"
                >
                  <Receipt className="w-4 h-4" />
                  <span>إصدار فاتورة ضريبية مجمعة لـ ({selectedDnIdsForBatchInvoice.length}) سندات تسليم</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setDeliveryNoteModalConfig({
                    isOpen: true,
                    targetProject: projects[0],
                  });
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-[#007A5A] hover:from-emerald-700 hover:to-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ إصدار سند تسليم بضاعة جديد</span>
              </button>
            </div>
          </div>

          {/* Delivery Notes Grid */}
          {filteredDeliveryNotes.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <Truck className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">لا توجد سندات تسليم مسجلة</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                سندات تسليم البضاعة تصدر بعد استلام المواد من الموردين لتأكيد تسليمها رسمياً للعميل في موقع المشروع وتوثيق التوقيعات.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeliveryNoteModalConfig({
                    isOpen: true,
                    targetProject: projects[0],
                  });
                }}
                className="px-4 py-2 bg-[#007A5A] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ إصدار سند تسليم الآن</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDeliveryNotes.map((dn) => {
                const totalUnits = (dn.items || []).reduce(
                  (s, it) => s + (it.deliveredQty || 0),
                  0
                );
                const isSelectedForBatch = selectedDnIdsForBatchInvoice.includes(dn.id);

                return (
                  <div
                    key={dn.id}
                    className={`bg-white rounded-xl border p-5 shadow-xs transition space-y-4 flex flex-col justify-between ${
                      isSelectedForBatch
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelectedForBatch}
                            onChange={() => {
                              setSelectedDnIdsForBatchInvoice((prev) =>
                                prev.includes(dn.id)
                                  ? prev.filter((id) => id !== dn.id)
                                  : [...prev, dn.id]
                              );
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer"
                            title="تحديد لجمع هذا السند في فاتورة مجمعة"
                          />
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#007A5A] flex items-center justify-center font-bold shrink-0">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-black text-emerald-900">
                                {dn.dnNumber}
                              </span>

                              {/* Interactive Invoicing Trigger Badge */}
                              {onOpenCreateInvoiceForDN ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenCreateInvoiceForDN(dn)}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                    dn.invoicedStatus === 'Fully Invoiced'
                                      ? 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                                      : dn.invoicedStatus === 'Partially Invoiced'
                                      ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 animate-pulse'
                                  }`}
                                  title="اضغط للانتقال مباشرة لإنشاء الفاتورة بالأسعار والكميات المعتمدة لهذا السند"
                                >
                                  <Receipt className="w-3 h-3" />
                                  <span>
                                    {dn.invoicedStatus === 'Fully Invoiced'
                                      ? 'مفوتر بالكامل ✓'
                                      : dn.invoicedStatus === 'Partially Invoiced'
                                      ? 'مفوتر جزئياً'
                                      : 'جاهز للفوترة ⚡'}
                                  </span>
                                </button>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    dn.invoicedStatus === 'Fully Invoiced' ||
                                    dn.invoicedStatus === 'Partially Invoiced'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {dn.invoicedStatus === 'Fully Invoiced'
                                    ? 'تمت الفوترة بالكامل'
                                    : dn.invoicedStatus === 'Partially Invoiced'
                                    ? 'مفوتر جزئياً'
                                    : 'جاهز للفوترة'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              العميل: <strong className="text-slate-900">{dn.customerName}</strong>
                            </p>
                          </div>
                        </div>

                        <span className="font-mono text-xs text-slate-500">{dn.date}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                        <div>
                          <span className="text-[10px] text-slate-400 block">المشروع</span>
                          <span className="font-semibold text-slate-900">{dn.projectName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">المستلم في الموقع</span>
                          <span className="font-semibold text-slate-900">
                            {dn.recipientName || 'مهندس الموقع'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[10px] text-slate-400 block">موقع التسليم</span>
                          <span className="text-slate-800">{dn.deliveryLocation || 'موقع العميل'}</span>
                        </div>
                      </div>

                      {/* Items Summary */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          الأصناف المسلمة بهذا السند ({dn.items?.length || 0} بنود - {totalUnits} قطعة):
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {dn.items?.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-[11px] bg-emerald-50/40 px-2 py-1 rounded border border-emerald-100"
                            >
                              <span className="text-slate-800 font-medium truncate max-w-[200px]">
                                {it.description}
                              </span>
                              <span className="font-mono font-bold text-emerald-900">
                                {it.deliveredQty} {it.unit || 'EA'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingDeliveryNote(dn)}
                          className="px-3 py-1.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض السند والطباعة والتوقيع</span>
                        </button>

                        {onOpenCreateInvoiceForDN && (
                          <button
                            type="button"
                            onClick={() => onOpenCreateInvoiceForDN(dn)}
                            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                            title="إصدار فاتورة ضريبية لهذا السند بالأسعار المعتمدة"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>
                              {dn.invoicedStatus === 'Fully Invoiced'
                                ? 'عرض / إعادة الفوترة'
                                : 'فوترة السند (إصدار فاتورة)'}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDnToDelete(dn)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="حذف سند التسليم"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. DELIVERY NOTE MATERIALS TAB (Inventory & Backorder items ready for client export) */}
      {subTab === 'delivery_note_materials' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">إجمالي بنود المواد المستلمة</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {receivedMaterialsInventory.length} بند
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">بنود جاهزة للتصدير وسندات التسليم</span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  {totalAvailableMaterialsForDispatch} بند
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1e3a8a] flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-500 block">القطع المتاحة للتسليم الفوري</span>
                <span className="text-lg font-black text-[#1e3a8a] font-mono">
                  {receivedMaterialsInventory.reduce((s, m) => s + m.availableForDispatchQty, 0)}{' '}
                  <span className="text-xs">قطعة</span>
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بوصف المادة، رقم أمر الشراء، المورد، أو اسم المشروع..."
                className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all">كافة المشاريع</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.projectNumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table of Materials */}
          {filteredMaterials.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl space-y-3">
              <Box className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">
                لا توجد مواد مستلمة مسجلة في هذا التبويب
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                عند استلام وتأكيد وصول المواد من الموردين في تبويب "أوامر الشراء"، ستظهر كافة الأصناف والكميات المحققة هنا تلقائياً لتكون جاهزة للتصدير وإصدار سندات التسليم للعملاء.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 text-xs">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">وصف البند / الصنف</th>
                    <th className="p-3">المشروع والعميل</th>
                    <th className="p-3 text-center">أمر الشراء والمورد</th>
                    <th className="p-3 text-center w-24">الكمية المطلوبة</th>
                    <th className="p-3 text-center w-24 bg-emerald-50 text-emerald-900">
                      المستلم المحقق
                    </th>
                    <th className="p-3 text-center w-24">المسلم للعميل</th>
                    <th className="p-3 text-center w-28 bg-indigo-50 text-indigo-900">
                      الرصيد المتاح للتسليم
                    </th>
                    <th className="p-3 text-center w-36">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.map((mat, idx) => {
                    const isReady = mat.availableForDispatchQty > 0;
                    const isFullyDispatched =
                      mat.totalReceivedQty > 0 && mat.availableForDispatchQty === 0;

                    return (
                      <tr key={mat.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-900 block">
                            {mat.description}
                          </span>
                          {mat.latestReceiptDate && (
                            <span className="text-[10px] text-slate-400">
                              آخر استلام: {mat.latestReceiptDate}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-900 block">
                            {mat.projectName}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            العميل: {mat.customerName}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-bold text-[#1e3a8a] block">
                            {mat.poNumber}
                          </span>
                          <span className="text-[10px] text-slate-500">{mat.vendorName}</span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-700">
                          {mat.poOrderedQty} {mat.unit}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">
                          {mat.totalReceivedQty} {mat.unit}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {mat.dispatchedToClientQty} {mat.unit}
                        </td>
                        <td className="p-3 text-center font-mono font-bold bg-indigo-50/50">
                          {isReady ? (
                            <span className="text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-full text-xs font-black">
                              {mat.availableForDispatchQty} {mat.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">0 {mat.unit}</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {isReady ? (
                            <button
                              type="button"
                              onClick={() => {
                                const proj = projects.find((p) => p.id === mat.projectId);
                                setDeliveryNoteModalConfig({
                                  isOpen: true,
                                  targetProject: proj,
                                  prefillItems: [
                                    {
                                      sourceItemId: mat.poItemId,
                                      description: mat.description,
                                      unit: mat.unit,
                                      orderedQty: mat.poOrderedQty,
                                      deliveredQty: mat.availableForDispatchQty,
                                      unitPrice: Math.round(mat.unitPrice * 1.25),
                                    },
                                  ],
                                });
                              }}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-[#007A5A] hover:from-emerald-700 hover:to-[#00664B] text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer mx-auto"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>إصدار سند تسليم</span>
                            </button>
                          ) : isFullyDispatched ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>تم التسليم للعميل بالكامل</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">لا يوجد رصيد متاح</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. PRICED ITEMS LIBRARY TAB */}
      {subTab === 'priced_items' && (
        <PricedItemsLibraryView
          items={allPricedItems}
          projects={projects}
          suppliers={suppliers}
          onIssuePOWithItem={onIssuePOWithItem}
        />
      )}

      {/* Delete Confirmation Modal for PO */}
      {poToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">تأكيد حذف أمر الشراء</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف أمر الشراء رقم{' '}
              <strong className="font-mono text-slate-900">{poToDelete.poNumber}</strong>؟ سيتم حذف
              كافة سجلات استلام المواد المرتبطة بهذا الأمر.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePO(poToDelete.id);
                  setPoToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Delivery Note */}
      {dnToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">تأكيد حذف سند تسليم البضاعة</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف سند التسليم رقم{' '}
              <strong className="font-mono text-slate-900">{dnToDelete.dnNumber}</strong>؟ سيتم إلغاء
              تسجيل تسليم الأصناف للعميل وإعادتها للأرصدة المتاحة.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDnToDelete(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteDeliveryNote) {
                    onDeleteDeliveryNote(dnToDelete.id);
                  }
                  setDnToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Receive Materials Modal */}
      {poForReceiving && (
        <ReceiveMaterialsModal
          isOpen={true}
          po={poForReceiving}
          project={projects.find((p) => p.id === poForReceiving.projectId)}
          onClose={() => setPoForReceiving(null)}
          onSaveReceipt={(poId, receipt, updatedItems) => {
            if (onSaveMaterialReceipt) {
              onSaveMaterialReceipt(poId, receipt, updatedItems);
            }
          }}
          onCreateDeliveryNoteFromReceipt={(po, receipt) => {
            const proj = projects.find((p) => p.id === po.projectId);
            setDeliveryNoteModalConfig({
              isOpen: true,
              targetProject: proj,
              prefillPO: po,
              prefillReceipt: receipt,
            });
          }}
          onInvoiceToClient={(params) => {
            if (onInvoiceToClient) {
              onInvoiceToClient(params);
            }
          }}
        />
      )}

      {/* Standalone Create Delivery Note Modal */}
      {deliveryNoteModalConfig.isOpen && (
        <CreateDeliveryNoteModal
          project={deliveryNoteModalConfig.targetProject}
          allProjects={projects}
          prefillPO={deliveryNoteModalConfig.prefillPO}
          prefillReceipt={deliveryNoteModalConfig.prefillReceipt}
          prefillItems={deliveryNoteModalConfig.prefillItems}
          existingDeliveryNotes={deliveryNotes}
          onClose={() => setDeliveryNoteModalConfig({ isOpen: false })}
          onSaveDeliveryNote={(newDN) => {
            if (onCreateDeliveryNote) {
              onCreateDeliveryNote(newDN);
            }
            setDeliveryNoteModalConfig({ isOpen: false });
          }}
        />
      )}

      {/* Material Return & Issued PO Reset Modal */}
      {materialReturnPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    إعادة ضبط المواد وإرجاع الكميات (أمر الشراء الصادر)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    رقم أمر الشراء: {materialReturnPO.poNumber} | المشروع: {materialReturnPO.projectName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMaterialReturnPO(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>تحديد الكميات المراد إرجاعها من المستودع للعميل:</span>
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  هذه الشاشة تعرض تفاصيل أمر الشراء الصادر وتسمح لك بتحديد الكميات المراد إرجاعها من المستودع وتحديث الأرصدة بدقة.
                </p>
              </div>

              <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5 text-right">البند / الوصف</th>
                      <th className="p-2.5 text-center">الكمية المصدرة</th>
                      <th className="p-2.5 text-center">الكمية المسلمة سابقاً</th>
                      <th className="p-2.5 text-center">الكمية المراد إرجاعها (Return)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {materialReturnPO.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="p-2.5 text-right font-medium text-slate-900">
                          {item.description}
                          <span className="block text-[10px] text-slate-500 font-mono">الوحدة: {item.unit || 'EA'}</span>
                        </td>
                        <td className="p-2.5 text-center font-mono">{item.quantity}</td>
                        <td className="p-2.5 text-center font-mono text-emerald-700 font-bold">{item.deliveredQty || 0}</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max={item.deliveredQty || item.quantity}
                            defaultValue={item.deliveredQty || 0}
                            className="w-20 p-1.5 text-center border border-slate-300 rounded font-mono font-bold bg-white"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setMaterialReturnPO(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetPOReceipts) {
                    onResetPOReceipts(materialReturnPO.id);
                  }
                  setMaterialReturnPO(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تأكيد الإرجاع وتحديث المخزون</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Milestone Payment Ledger Modal */}
      {poForLedger && (
        <POPaymentLedgerModal
          isOpen={Boolean(poForLedger)}
          po={poForLedger}
          onClose={() => setPoForLedger(null)}
          onSavePayment={(poId, updatedPO) => {
            if (onSavePOPayment) {
              onSavePOPayment(poId, updatedPO);
            }
            setPoForLedger(null);
          }}
        />
      )}
    </div>
  );
};
