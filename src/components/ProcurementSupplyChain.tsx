import React, { useState, useMemo, useRef } from 'react';
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
} from '../types';
import { isServiceMilestoneItem } from '../services/procurementService';
import {
  ShoppingBag,
  Truck,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  DollarSign,
  Building,
  FileText,
  Calendar,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Package,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Printer,
  Eye,
  Check,
  X,
  Clock,
  AlertTriangle,
  Upload,
  UserCheck,
  FileCheck,
  ArrowRight,
  Maximize2,
  Copy,
  Receipt,
  FileSignature,
} from 'lucide-react';
import { executePrint } from '../utils/printUtils';
import { MobileViewerTopBar } from './MobileViewerTopBar';
import { recordAuditLog } from '../utils/auditLogger';

export interface ProcurementSupplyChainProps {
  currentUser: User;
  purchaseOrders: PurchaseOrder[];
  supplierQuotations: SupplierQuotation[];
  suppliers: Supplier[];
  projects: Project[];
  deliveryNotes?: DeliveryNote[];
  threeWayMatches?: ThreeWayMatchRecord[];
  onOpenNewPO: (projectId?: string, supplierQuoteId?: string) => void;
  onEditPO: (po: PurchaseOrder) => void;
  onUpdatePO?: (updatedPO: PurchaseOrder) => void;
  onSelectProject?: (projectId: string) => void;
  onUpdateDeliveryStatus?: (poId: string, itemId: string, newStatus: ItemDeliveryStatus, qty?: number) => void;
  onOpenUploadSupplierQuote?: () => void;
  onSelectSupplierQuote?: (quoteId: string) => void;
  onSaveMaterialReceipt?: (poId: string, receipt: MaterialReceiptRecord, updatedPOItems: PurchaseOrder['items']) => void;
  onSaveDeliveryNote?: (deliveryNote: DeliveryNote) => void;
  onUpdateThreeWayMatch?: (record: ThreeWayMatchRecord) => void;
  onOpenThreeWayModal?: () => void;
}

interface IntakeItemForm {
  poItemId: string;
  itemNo: number;
  description: string;
  unit: string;
  orderedQty: number;
  deliveredQty: number;
  acceptedQty: number;
  rejectedQty: number;
  unitPrice: number;
  notes: string;
}

export const ProcurementSupplyChain: React.FC<ProcurementSupplyChainProps> = ({
  currentUser,
  purchaseOrders,
  supplierQuotations,
  suppliers,
  projects,
  deliveryNotes = [],
  threeWayMatches = [],
  onOpenNewPO,
  onEditPO,
  onUpdatePO,
  onSelectProject,
  onOpenUploadSupplierQuote,
  onSelectSupplierQuote,
  onSaveMaterialReceipt,
  onSaveDeliveryNote,
  onUpdateThreeWayMatch,
  onOpenThreeWayModal,
}) => {
  const [activeSection, setActiveSection] = useState<'pos' | 'bidding' | 'logistics'>('logistics');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals state
  const [isNewGRNModalOpen, setIsNewGRNModalOpen] = useState(false);
  const [selectedPOForGRN, setSelectedPOForGRN] = useState<PurchaseOrder | null>(null);
  const [viewingAttachmentReceipt, setViewingAttachmentReceipt] = useState<{
    receipt: MaterialReceiptRecord;
    po: PurchaseOrder;
  } | null>(null);
  const [viewingMIRDoc, setViewingMIRDoc] = useState<{
    receipt: MaterialReceiptRecord;
    po: PurchaseOrder;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New GRN Intake Form State
  const [grnDeliveryNoteNo, setGrnDeliveryNoteNo] = useState('');
  const [grnDeliveryDate, setGrnDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [grnDriverName, setGrnDriverName] = useState('');
  const [grnReceiverName, setGrnReceiverName] = useState(currentUser?.fullName || 'م. مختار يوسف');
  const [grnInspectionResult, setGrnInspectionResult] = useState<'Approved' | 'Approved as Noted' | 'Rejected' | 'Under Inspection'>('Approved');
  const [grnNotes, setGrnNotes] = useState('');
  const [grnAttachedPhotoUrl, setGrnAttachedPhotoUrl] = useState<string | null>(null);
  const [grnAttachedPhotoName, setGrnAttachedPhotoName] = useState<string | null>(null);
  const [grnLineItems, setGrnLineItems] = useState<IntakeItemForm[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Build aggregated site receipts ledger across all purchase orders
  const allReceipts = useMemo(() => {
    const records: Array<{
      receipt: MaterialReceiptRecord;
      po: PurchaseOrder;
      isCleared3Way: boolean;
      clearanceToken?: string;
    }> = [];

    purchaseOrders.forEach((po) => {
      // Find matching 3-way match record if any
      const matchRec = threeWayMatches.find((m) => m.poId === po.id || m.poNumber === po.poNumber);
      const isCleared = matchRec ? !matchRec.isDisbursementBlocked : po.deliveryStatus === 'Delivered';

      if (po.materialReceipts && po.materialReceipts.length > 0) {
        po.materialReceipts.forEach((r) => {
          records.push({
            receipt: r,
            po,
            isCleared3Way: isCleared,
            clearanceToken: `CLR-${po.poNumber.replace(/[^a-zA-Z0-9]/g, '')}-${r.receiptNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
          });
        });
      } else {
        // Fallback: If PO is marked delivered or partial without explicit receipt record, generate synthetic ledger entry
        if (po.deliveryStatus === 'Delivered' || po.deliveryStatus === 'Partial Delivered' || po.fulfillmentStatus === 'Fully Received') {
          records.push({
            receipt: {
              id: `rec-syn-${po.id}`,
              receiptNumber: `GRN-${po.poNumber.replace(/[^a-zA-Z0-9]/g, '')}-01`,
              receiptDate: po.deliveryDate || '2026-09-15',
              supplierDeliveryNoteNo: `DN-${po.vendorName.substring(0, 3).toUpperCase()}-9921`,
              deliveryNoteDate: po.deliveryDate || '2026-09-15',
              poId: po.id,
              poNumber: po.poNumber,
              projectId: po.projectId,
              projectName: po.projectName,
              vendorName: po.vendorName || po.supplierName,
              receivedBy: 'م. مختار يوسف (مدير المشروع)',
              receiverName: 'م. مختار يوسف',
              receivedItems: (po.items || []).map((it) => ({
                poItemId: it.id,
                itemNo: it.itemNo,
                description: it.description,
                orderedQty: it.quantity,
                receivedQty: it.deliveredQty !== undefined ? it.deliveredQty : it.quantity,
                unitPrice: it.unitPrice,
                unit: it.unit || 'Pcs',
              })),
              notes: 'تم استلام وتفريغ المواد بموقع المشروع والمطابقة الفنية مع أمر الشراء.',
              attachedDocName: `سند_تسليم_${po.vendorName}_مختوم.pdf`,
              createdAt: po.createdAt || new Date().toISOString(),
            },
            po,
            isCleared3Way: isCleared,
            clearanceToken: `CLR-${po.poNumber.replace(/[^a-zA-Z0-9]/g, '')}-PASS`,
          });
        }
      }
    });

    return records.sort((a, b) => new Date(b.receipt.receiptDate || b.receipt.createdAt).getTime() - new Date(a.receipt.receiptDate || a.receipt.createdAt).getTime());
  }, [purchaseOrders, threeWayMatches]);

  // Key Procurement & Logistics Statistics
  const stats = useMemo(() => {
    const totalPOs = purchaseOrders.length;
    const totalPOValue = purchaseOrders.reduce((sum, po) => sum + (po.grandTotal || 0), 0);
    const totalPaid = purchaseOrders.reduce((sum, po) => {
      const paid = po.paidAmount || (po.payments ? po.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0);
      return sum + paid;
    }, 0);
    const totalPendingAmount = Math.max(0, totalPOValue - totalPaid);

    const deliveredPOs = purchaseOrders.filter(
      (po) => po.deliveryStatus === 'Delivered' || po.fulfillmentStatus === 'Fully Received'
    ).length;
    const partialPOs = purchaseOrders.filter(
      (po) => po.deliveryStatus === 'Partial Delivered' || po.fulfillmentStatus === 'In Delivery / Partial'
    ).length;
    const pendingDeliveries = Math.max(0, totalPOs - deliveredPOs);

    const totalGRNs = allReceipts.length;
    const clearedGRNs = allReceipts.filter((r) => r.isCleared3Way).length;

    return {
      totalPOs,
      totalPOValue,
      totalPaid,
      totalPendingAmount,
      deliveredPOs,
      partialPOs,
      pendingDeliveries,
      totalGRNs,
      clearedGRNs,
      supplierQuotesCount: supplierQuotations.length,
    };
  }, [purchaseOrders, supplierQuotations, allReceipts]);

  // Filtered Receipts in Logistics Hub
  const filteredReceipts = useMemo(() => {
    return allReceipts.filter(({ receipt, po, isCleared3Way }) => {
      if (projectFilter !== 'all' && po.projectId !== projectFilter) {
        return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'cleared' && !isCleared3Way) return false;
        if (statusFilter === 'pending_clearance' && isCleared3Way) return false;
        if (statusFilter === 'partial' && po.deliveryStatus !== 'Partial Delivered') return false;
        if (statusFilter === 'delivered' && po.deliveryStatus !== 'Delivered') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const poNum = (po.poNumber || '').toLowerCase();
        const recNum = (receipt.receiptNumber || '').toLowerCase();
        const dnNum = (receipt.supplierDeliveryNoteNo || '').toLowerCase();
        const vendor = (po.vendorName || po.supplierName || '').toLowerCase();
        const proj = (po.projectName || '').toLowerCase();
        const itemHit = (receipt.receivedItems || []).some((it) =>
          it.description.toLowerCase().includes(q)
        );
        return poNum.includes(q) || recNum.includes(q) || dnNum.includes(q) || vendor.includes(q) || proj.includes(q) || itemHit;
      }
      return true;
    });
  }, [allReceipts, projectFilter, statusFilter, searchQuery]);

  // Filtered POs for PO section
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (projectFilter !== 'all' && po.projectId !== projectFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          po.poNumber.toLowerCase().includes(q) ||
          po.supplierName?.toLowerCase().includes(q) ||
          po.vendorName?.toLowerCase().includes(q) ||
          (po.projectName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [purchaseOrders, projectFilter, searchQuery]);

  // Initialize new GRN form when a PO is selected
  const handleOpenNewGRNModal = (targetPO?: PurchaseOrder) => {
    const po = targetPO || purchaseOrders[0] || null;
    setSelectedPOForGRN(po);
    if (po) {
      setGrnDeliveryNoteNo(`DN-${po.vendorName ? po.vendorName.substring(0, 3).toUpperCase() : 'VND'}-${Math.floor(10000 + Math.random() * 90000)}`);
      setGrnDeliveryDate(new Date().toISOString().split('T')[0]);
      setGrnDriverName('سائق المورد: محمد عبد الله (شاحنة نقل دباب)');
      setGrnReceiverName(currentUser?.fullName || 'م. مختار يوسف (مهندس الموقع)');
      setGrnInspectionResult('Approved');
      setGrnNotes('تم فحص البنود ظاهرياً ومطابقتها مع المواصفات المعتمدة وشهادات المنشأ.');
      setGrnAttachedPhotoUrl('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80');
      setGrnAttachedPhotoName('سند_تسليم_موقع_مختوم_رسمي.jpg');

      // Populate line items
      const items: IntakeItemForm[] = (po.items || []).map((it) => {
        const alreadyReceived = it.deliveredQty || 0;
        const remaining = Math.max(0, it.quantity - alreadyReceived);
        const defaultDelivered = remaining > 0 ? remaining : it.quantity;
        return {
          poItemId: it.id,
          itemNo: it.itemNo,
          description: it.description,
          unit: it.unit || 'EA',
          orderedQty: it.quantity,
          deliveredQty: defaultDelivered,
          acceptedQty: defaultDelivered,
          rejectedQty: 0,
          unitPrice: it.unitPrice || 0,
          notes: 'مطابق للمواصفة المعتمدة',
        };
      });
      setGrnLineItems(items);
    }
    setIsNewGRNModalOpen(true);
  };

  const handleSelectPOInGRNModal = (poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId) || null;
    setSelectedPOForGRN(po);
    if (po) {
      setGrnDeliveryNoteNo(`DN-${po.vendorName ? po.vendorName.substring(0, 3).toUpperCase() : 'VND'}-${Math.floor(10000 + Math.random() * 90000)}`);
      const items: IntakeItemForm[] = (po.items || []).map((it) => {
        const alreadyReceived = it.deliveredQty || 0;
        const remaining = Math.max(0, it.quantity - alreadyReceived);
        const defaultDelivered = remaining > 0 ? remaining : it.quantity;
        return {
          poItemId: it.id,
          itemNo: it.itemNo,
          description: it.description,
          unit: it.unit || 'EA',
          orderedQty: it.quantity,
          deliveredQty: defaultDelivered,
          acceptedQty: defaultDelivered,
          rejectedQty: 0,
          unitPrice: it.unitPrice || 0,
          notes: 'مطابق للمواصفة المعتمدة',
        };
      });
      setGrnLineItems(items);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setGrnAttachedPhotoUrl(event.target?.result as string);
        setGrnAttachedPhotoName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit and save new GRN / Delivery Note
  const handleSaveGRNSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOForGRN) {
      alert('يرجى اختيار أمر الشراء المرتبط أولاً.');
      return;
    }
    if (!grnDeliveryNoteNo.trim()) {
      alert('يرجى إدخال رقم سند التوريد من المورد.');
      return;
    }

    const receiptId = `mr-${Date.now()}`;
    const nextReceiptNumber = `GRN-${selectedPOForGRN.poNumber.replace(/[^a-zA-Z0-9]/g, '')}-${(selectedPOForGRN.materialReceipts?.length || 0) + 1}`;

    const newReceipt: MaterialReceiptRecord = {
      id: receiptId,
      receiptNumber: nextReceiptNumber,
      receiptDate: grnDeliveryDate,
      receivedDate: grnDeliveryDate,
      supplierDeliveryNoteNo: grnDeliveryNoteNo,
      deliveryNoteDate: grnDeliveryDate,
      poId: selectedPOForGRN.id,
      poNumber: selectedPOForGRN.poNumber,
      projectId: selectedPOForGRN.projectId,
      projectName: selectedPOForGRN.projectName,
      vendorName: selectedPOForGRN.vendorName || selectedPOForGRN.supplierName,
      receivedBy: grnReceiverName,
      receiverName: grnReceiverName,
      notes: `${grnNotes} | الناقل والسائق: ${grnDriverName} | نتيجة الفحص: ${grnInspectionResult}`,
      attachedDocName: grnAttachedPhotoName || 'سند_توريد_موقع.jpg',
      attachedDocData: grnAttachedPhotoUrl || undefined,
      receivedItems: grnLineItems.map((li) => ({
        poItemId: li.poItemId,
        itemNo: li.itemNo,
        description: li.description,
        orderedQty: li.orderedQty,
        receivedQty: li.acceptedQty,
        unitPrice: li.unitPrice,
        unit: li.unit,
      })),
      items: grnLineItems.map((li) => ({
        description: li.description,
        orderedQuantity: li.orderedQty,
        receivedQuantity: li.acceptedQty,
        remainingQuantity: Math.max(0, li.orderedQty - li.acceptedQty),
        unit: li.unit,
        unitPrice: li.unitPrice,
        poItemId: li.poItemId,
      })),
      createdAt: new Date().toISOString(),
    };

    // Calculate updated PO items
    const updatedPOItems = (selectedPOForGRN.items || []).map((poItem) => {
      const intakeMatch = grnLineItems.find((li) => li.poItemId === poItem.id);
      if (intakeMatch) {
        const newTotalDelivered = (poItem.deliveredQty || 0) + intakeMatch.acceptedQty;
        const newDeliveryStatus: ItemDeliveryStatus =
          newTotalDelivered >= poItem.quantity
            ? 'Delivered'
            : newTotalDelivered > 0
            ? 'Partial Delivered'
            : 'Pending';
        return {
          ...poItem,
          deliveredQty: newTotalDelivered,
          deliveryStatus: newDeliveryStatus,
        };
      }
      return poItem;
    });

    const physicalItems = updatedPOItems.filter((it) => !isServiceMilestoneItem(it));
    const allPhysicalDelivered = physicalItems.length > 0
      ? physicalItems.every((it) => (it.deliveredQty || 0) >= it.quantity)
      : updatedPOItems.every((it) => (it.deliveredQty || 0) >= it.quantity);
    const anyPhysicalDelivered = physicalItems.length > 0
      ? physicalItems.some((it) => (it.deliveredQty || 0) > 0)
      : updatedPOItems.some((it) => (it.deliveredQty || 0) > 0);

    const updatedPO: PurchaseOrder = {
      ...selectedPOForGRN,
      items: updatedPOItems,
      materialReceipts: [...(selectedPOForGRN.materialReceipts || []), newReceipt],
      deliveryStatus: allPhysicalDelivered ? 'Delivered' : anyPhysicalDelivered ? 'Partial Delivered' : 'Pending',
      fulfillmentStatus: allPhysicalDelivered ? 'Fully Received' : anyPhysicalDelivered ? 'In Delivery / Partial' : 'Not Received',
      updatedAt: new Date().toISOString(),
    };

    // Save to parent PO
    if (onSaveMaterialReceipt) {
      onSaveMaterialReceipt(selectedPOForGRN.id, newReceipt, updatedPOItems);
    }
    if (onUpdatePO) {
      onUpdatePO(updatedPO);
    }

    // Also create customer delivery note mirror if needed
    if (onSaveDeliveryNote) {
      const newDN: DeliveryNote = {
        id: `dn-${Date.now()}`,
        dnNumber: `DN-${selectedPOForGRN.poNumber.replace(/[^a-zA-Z0-9]/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        date: grnDeliveryDate,
        projectId: selectedPOForGRN.projectId,
        projectName: selectedPOForGRN.projectName,
        projectNumber: selectedPOForGRN.projectRef || 'PRJ-2026',
        customerName: selectedPOForGRN.projectName,
        sourcePOId: selectedPOForGRN.id,
        sourcePONumber: selectedPOForGRN.poNumber,
        deliveryLocation: selectedPOForGRN.deliveryTerms?.location || 'موقع المشروع بالميدان',
        recipientName: grnReceiverName,
        driverOrCarrier: grnDriverName,
        status: allPhysicalDelivered ? 'Delivered' : 'Partial Delivered',
        invoicedStatus: 'Uninvoiced',
        items: grnLineItems.map((li, idx) => ({
          id: `dni-${idx + 1}`,
          sourceItemId: li.poItemId,
          itemNo: li.itemNo,
          description: li.description,
          unit: li.unit,
          orderedQty: li.orderedQty,
          deliveredQty: li.acceptedQty,
          remainingQty: Math.max(0, li.orderedQty - li.acceptedQty),
          unitPrice: li.unitPrice,
          totalPrice: li.acceptedQty * li.unitPrice,
        })),
        notes: `مذكرة استلام واردة من المورد ${selectedPOForGRN.vendorName} بموجب سند رقم ${grnDeliveryNoteNo}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveDeliveryNote(newDN);
    }

    // Auto-create/unblock 3-way match clearance token if accepted
    if (grnInspectionResult === 'Approved' || grnInspectionResult === 'Approved as Noted') {
      handlePushTo3WayMatch(selectedPOForGRN, newReceipt, false);
    }

    recordAuditLog(
      currentUser,
      `تسجيل مذكرة تسليم واستلام موقعية جديدة (${newReceipt.receiptNumber}) لأمر الشراء ${selectedPOForGRN.poNumber}`,
      'MaterialReceiptRecord',
      newReceipt.receiptNumber,
      null,
      newReceipt
    );

    setIsNewGRNModalOpen(false);
    showToast(`تم تسجيل مذكرة التسليم ${newReceipt.receiptNumber} بنجاح وتحديث حالة أمر الشراء.`);
  };

  // Push to 3-Way Match & Clear Disbursement Token
  const handlePushTo3WayMatch = (po: PurchaseOrder, receipt: MaterialReceiptRecord, showFeedback = true) => {
    const totalDeliveredVal = (receipt.receivedItems || []).reduce(
      (sum, it) => sum + (it.receivedQty || 0) * (it.unitPrice || 0),
      0
    );

    const poRef = (po.poNumber || po.id || 'PO').replace(/[^a-zA-Z0-9]/g, '');
    const clearanceToken = `CLR-${poRef}-${Date.now().toString().slice(-4)}`;

    const newMatchRecord: ThreeWayMatchRecord = {
      id: `3way-${po.id}-${receipt.id}`,
      poId: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId || po.vendorName || 'supp-default',
      supplierName: po.vendorName || po.supplierName || 'المورد المعتمد',
      poItemRate: po.items?.[0]?.unitPrice || 1000,
      poQuantity: po.items?.reduce((s, it) => s + it.quantity, 0) || 1,
      poTotalAmount: po.grandTotal || 0,
      grnReceivedQuantity: receipt.receivedItems?.reduce((s, it) => s + (it.receivedQty || 0), 0) || 1,
      supplierInvoiceNumber: receipt.supplierDeliveryNoteNo || `INV-SUPP-${po.poNumber}`,
      supplierInvoiceRate: po.items?.[0]?.unitPrice || 1000,
      supplierInvoiceTotalAmount: po.grandTotal || totalDeliveredVal,
      rateDiscrepancyDelta: 0,
      quantityDiscrepancyDelta: 0,
      totalVarianceSAR: 0,
      matchStatus: 'Passed',
      isDisbursementBlocked: false,
      overrideApprovedBy: currentUser?.fullName || 'م. مختار يوسف (Gatekeeper Cleared)',
      overrideApprovalDate: new Date().toISOString(),
      blockedReason: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateThreeWayMatch) {
      onUpdateThreeWayMatch(newMatchRecord);
    }

    // Persist to local storage
    try {
      const stored = localStorage.getItem('rmt_three_way_matches');
      const existing: ThreeWayMatchRecord[] = stored ? JSON.parse(stored) : [];
      const updatedList = [
        newMatchRecord,
        ...existing.filter((r) => r.poId !== po.id && r.id !== newMatchRecord.id),
      ];
      localStorage.setItem('rmt_three_way_matches', JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('rmt_three_way_matches_updated', { detail: updatedList }));
    } catch (e) {
      console.error('Failed to sync 3-way match record', e);
    }

    // Update PO delivery and fulfillment status
    const updatedPO: PurchaseOrder = {
      ...po,
      deliveryStatus: 'Delivered',
      fulfillmentStatus: 'Fully Received',
      updatedAt: new Date().toISOString(),
    };
    if (onUpdatePO) {
      onUpdatePO(updatedPO);
    }

    recordAuditLog(
      currentUser,
      `منح تصريح الصرف المالي وفك الحظر (3-Way Match Passed) لأمر الشراء ${po.poNumber} بموجب استلام الموقع ${receipt.receiptNumber}`,
      'ThreeWayMatchRecord',
      po.poNumber,
      null,
      newMatchRecord
    );

    if (showFeedback) {
      showToast(`تم اعتماد الاستلام بنجاح وإرسال رمز الإفراج المالي (${clearanceToken}) لحارس المطابقة الثلاثية 3-Way Match.`);
    }
  };

  return (
    <div dir="rtl" className="space-y-5 animate-in fade-in duration-200">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              PILLAR 4 • PROCUREMENT & LOGISTICS HUB
            </span>
            <span className="text-xs text-slate-500 font-bold">
              إدارة سلاسل الإمداد ومذكرات الاستلام الموقعية (GRN/MIR)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-600" />
            <span>منصة المشتريات ومذكرات التسليم والمطابقة الثلاثية (GRN Hub)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل مذكرات الاستلام الميدانية، فحص العينات وتوليد طلبات MIR الاستشارية، وربطها آلياً بنظام المطابقة الثلاثية (3-Way Matching Gatekeeper)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenUploadSupplierQuote && (
            <button
              type="button"
              onClick={onOpenUploadSupplierQuote}
              className="px-3 py-2 text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>رفع تسعيرة مورد</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenNewGRNModal()}
            className="px-4 py-2 text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl transition cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>+ تسجيل مذكرة تسليم موقعية (New Delivery Note / GRN)</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenNewPO()}
            className="px-3.5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>إصدار أمر شراء (PO)</span>
          </button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total POs Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span>إجمالي أوامر الشراء المعتمدة</span>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {stats.totalPOValue.toLocaleString()}
            </div>
            <span className="text-xs font-bold text-slate-500 font-mono">SAR</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>عدد الأوامر:</span>
            <span className="font-bold text-slate-700">{stats.totalPOs} أمر شراء</span>
          </div>
        </div>

        {/* Paid to Suppliers */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span>المدفوعات للموردين</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
              {stats.totalPaid.toLocaleString()}
            </div>
            <span className="text-xs font-bold text-emerald-700 font-mono">SAR</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>نسبة السداد للموردين:</span>
            <span className="font-bold text-emerald-600">
              {stats.totalPOValue > 0 ? Math.round((stats.totalPaid / stats.totalPOValue) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Site Delivery Notes & GRNs */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span>مذكرات الاستلام الموقعي (GRN)</span>
            <Truck className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl sm:text-2xl font-black text-slate-900">
              {stats.totalGRNs} <span className="text-xs text-slate-400 font-normal">سند استلام</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
              ميداني
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>مستلم ومطابق بالموقع:</span>
            <span className="font-bold text-teal-600">{stats.deliveredPOs} أوامر شراء مكتملة</span>
          </div>
        </div>

        {/* 3-Way Match Clearance Status */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold mb-1">
            <span>تصاريح الصرف (3-Way Match)</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-xl sm:text-2xl font-black text-purple-700">
              {stats.clearedGRNs} <span className="text-xs text-slate-400 font-normal">/ {stats.totalGRNs}</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
              مفعل للسداد
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>جاهز للصرف المالي:</span>
            <button
              type="button"
              onClick={onOpenThreeWayModal}
              className="font-bold text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>فتح حارس المطابقة</span>
              <ChevronRight className="w-3 h-3 rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* Module Sub-Tabs (Logistics Hub, POs Sheet, Bidding Comparison) */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('logistics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeSection === 'logistics'
                ? 'bg-gradient-to-l from-emerald-600 to-teal-700 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>جدول التوريد والتسليم للمواقع & GRN Hub ({allReceipts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('pos')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'pos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>سجل أوامر الشراء الشامل ({purchaseOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('bidding')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'bidding'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>مقارنة عروض أسعار الموردين ({supplierQuotations.length})</span>
          </button>
        </div>

        {/* Filter & View Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم السند، المورد، البند..."
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none pl-7 w-48 focus:border-emerald-500 focus:bg-white transition"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
          >
            <option value="all">كافة المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {activeSection === 'logistics' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
            >
              <option value="all">كافة الحالات</option>
              <option value="cleared">مفعل للسداد (Cleared 3-Way)</option>
              <option value="delivered">تم التوريد بالكامل</option>
              <option value="partial">توريد جزئي</option>
              <option value="pending_clearance">قيد التدقيق والفحص</option>
            </select>
          )}

          {activeSection === 'logistics' && (
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                بطاقات
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                جدول
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION: Site Delivery Schedule & GRN/MIR Hub (Main Refactored) */}
      {/* ========================================================= */}
      {activeSection === 'logistics' && (
        <div className="space-y-4">
          {/* Action Callout Bar */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white p-4 rounded-2xl border border-emerald-500/30 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-400">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>سجل استلام وتفريغ المواد الموقعية (Site Receiving Ledger & GRN)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    GATEKEEPER CONNECTED
                  </span>
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  توثيق أرقام سندات التوريد، فحص الكميات المرفوضة والمقبولة، توليد تقارير الفحص الاستشاري MIR، وتفعيل المطابقة الثلاثية لصرف المستحقات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenNewGRNModal()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>+ تسجيل مذكرة تسليم موقعية (New GRN)</span>
              </button>
            </div>
          </div>

          {/* Cards View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredReceipts.length === 0 ? (
                <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                  <Truck className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">لا توجد مذكرات استلام أو سندات توريد مطابقة</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    يمكنك تسجيل مذكرة استلام جديدة وربطها بأمر شراء مفتوح لبدء عملية الفحص والاعتماد الميداني.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenNewGRNModal()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>تسجيل أول مذكرة استلام الآن</span>
                  </button>
                </div>
              ) : (
                filteredReceipts.map(({ receipt, po, isCleared3Way, clearanceToken }) => {
                  const totalDelivered = (receipt.receivedItems || []).reduce((s, it) => s + (it.receivedQty || 0), 0);
                  const totalItemsCount = receipt.receivedItems?.length || 0;

                  return (
                    <div
                      key={receipt.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden"
                    >
                      {/* Card Header */}
                      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                              {receipt.receiptNumber}
                            </span>
                            <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              مرتبط بـ {po.poNumber}
                            </span>
                            {isCleared3Way ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>مستلمة ومطابقة (3-Way Cleared)</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>قيد استكمال الاعتماد</span>
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-black text-slate-900 mt-1">
                            {po.projectName || 'مشروع عام'}
                          </h4>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>المورد: <strong className="text-slate-800">{po.vendorName || po.supplierName}</strong></span>
                            <span>•</span>
                            <span>سند التوريد: <strong className="font-mono text-slate-800">{receipt.supplierDeliveryNoteNo || '—'}</strong></span>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="font-mono text-xs font-bold text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 block">
                            {receipt.receiptDate || receipt.deliveryNoteDate || '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {receipt.receivedBy || 'مهندس الموقع'}
                          </span>
                        </div>
                      </div>

                      {/* Card Body: Itemized Breakdown */}
                      <div className="p-4 space-y-3 flex-1">
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                            البنود المستلمة والمفحوصة بالموقع ({totalItemsCount} أصناف):
                          </span>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                            {(receipt.receivedItems || []).map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {it.itemNo || idx + 1}
                                  </span>
                                  <span className="text-slate-800 font-medium truncate" title={it.description}>
                                    {it.description}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {it.receivedQty} {it.unit || 'EA'}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    مطابق 100%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {receipt.notes && (
                          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-[11px] text-amber-900">
                            <strong>ملاحظات التسليم:</strong> {receipt.notes}
                          </div>
                        )}

                        {clearanceToken && (
                          <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-xl border border-slate-200 font-mono">
                            <span className="text-slate-500 font-sans">رمز تصريح الصرف (Clearance Token):</span>
                            <span className="font-bold text-emerald-700">{clearanceToken}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer: 3 Direct Action Buttons */}
                      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        {/* 1. View Attachment Button */}
                        <button
                          type="button"
                          onClick={() => setViewingAttachmentReceipt({ receipt, po })}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="عرض سند التوريد الورقي وصورة الختم"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>سند التوريد المرفق</span>
                        </button>

                        {/* 2. Generate MIR Button */}
                        <button
                          type="button"
                          onClick={() => setViewingMIRDoc({ receipt, po })}
                          className="px-3 py-1.5 bg-white hover:bg-teal-50 border border-teal-300 text-teal-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="توليد طلب فحص استشاري رسمي (MIR Document)"
                        >
                          <FileSignature className="w-3.5 h-3.5 text-teal-600" />
                          <span>طلب فحص استشاري (MIR)</span>
                        </button>

                        {/* 3. Push to 3-Way Match */}
                        <button
                          type="button"
                          onClick={() => handlePushTo3WayMatch(po, receipt)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                            isCleared3Way
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                              : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white'
                          }`}
                          title="اعتماد الاستلام وفك حظر الفوترة والصرف المالي"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{isCleared3Way ? 'معتمد للفوترة (Passed)' : 'اعتماد للفوترة (3-Way Match)'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">رقم السند (GRN)</th>
                      <th className="py-3 px-4">أمر الشراء المرتبط</th>
                      <th className="py-3 px-4">المشروع المستفيد</th>
                      <th className="py-3 px-4">المورد المعتمد</th>
                      <th className="py-3 px-4">سند المورد</th>
                      <th className="py-3 px-4 text-center">تاريخ الاستلام</th>
                      <th className="py-3 px-4 text-center">حالة الفحص والمطابقة</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceipts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          لا توجد مذكرات استلام مطابقة
                        </td>
                      </tr>
                    ) : (
                      filteredReceipts.map(({ receipt, po, isCleared3Way }) => (
                        <tr key={receipt.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {receipt.receiptNumber}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-700">
                            {po.poNumber}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-bold">
                            {po.projectName}
                          </td>
                          <td className="py-3 px-4 text-slate-800">
                            {po.vendorName || po.supplierName}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            {receipt.supplierDeliveryNoteNo || '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500">
                            {receipt.receiptDate}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isCleared3Way ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                مطابق ومفعل للسداد
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                قيد التدقيق
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingAttachmentReceipt({ receipt, po })}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="عرض المرفق"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewingMIRDoc({ receipt, po })}
                                className="p-1.5 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                                title="توليد MIR"
                              >
                                <FileSignature className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePushTo3WayMatch(po, receipt)}
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="اعتماد للفوترة"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1: Purchase Orders Table View */}
      {/* ========================================================= */}
      {activeSection === 'pos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">رقم أمر الشراء</th>
                  <th className="py-3 px-4">المورد المعتمد</th>
                  <th className="py-3 px-4">المشروع المستفيد</th>
                  <th className="py-3 px-4 text-center">إجمالي القيمة</th>
                  <th className="py-3 px-4 text-center">المسدد</th>
                  <th className="py-3 px-4 text-center">المتبقي</th>
                  <th className="py-3 px-4 text-center">حالة التوريد</th>
                  <th className="py-3 px-4 text-center">موعد التسليم</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      لا توجد أوامر شراء مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    const isDelivered = po.deliveryStatus === 'Delivered';
                    const isPartial = po.deliveryStatus === 'Partial Delivered';
                    const paid = po.paidAmount || (po.payments ? po.payments.reduce((s, p) => s + (p.amount || 0), 0) : 0);
                    const remaining = Math.max(0, po.grandTotal - paid);

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {po.poNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {po.vendorName || po.supplierName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {po.projectName || '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                          {po.grandTotal?.toLocaleString()} SAR
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                          {paid.toLocaleString()} SAR
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-amber-600">
                          {remaining.toLocaleString()} SAR
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isDelivered
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isPartial
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {isDelivered
                              ? 'تم التوريد بالكامل'
                              : isPartial
                              ? 'توريد جزئي'
                              : 'قيد التوريد'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {po.expectedDeliveryDate || po.deliveryDate || 'غير محدد'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenNewGRNModal(po)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg transition cursor-pointer"
                              title="تسجيل مذكرة تسليم لهذا الأمر"
                            >
                              + استلام GRN
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditPO(po)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                            >
                              معاينة / تعديل
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: Supplier Bidding & Quotation Comparison */}
      {/* ========================================================= */}
      {activeSection === 'bidding' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplierQuotations.length === 0 ? (
            <div className="col-span-full p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400">
              لا توجد تسعيرات موردين مسجلة حتى الآن
            </div>
          ) : (
            supplierQuotations.map((sq) => {
              return (
                <div
                  key={sq.id}
                  onClick={() => onSelectSupplierQuote && onSelectSupplierQuote(sq.id)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-xs hover:shadow-md transition cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {sq.quotationNumber}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        {sq.supplierName}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {sq.projectName || 'عام'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-500">إجمالي عرض السعر:</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      {(sq.totalAmount || sq.subtotal || 0).toLocaleString()} SAR
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>عدد البنود: {sq.items?.length || 0}</span>
                    <span>{sq.quoteDate || sq.date || '—'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewPO(sq.projectId, sq.id);
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>تحويل لأمر شراء (Generate PO)</span>
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: Intake Form (+ تسجيل مذكرة تسليم موقعية - New GRN) */}
      {/* ========================================================= */}
      {isNewGRNModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#0F1B33] text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 rounded-2xl border border-emerald-400/30 text-emerald-400">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">
                    تسجيل مذكرة تسليم موقعية جديدة (New Delivery Note / GRN)
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    إثبات استلام وتفريغ الشحنات الميدانية، تفصيل الكميات المقبولة والمرفوضة، وربطها بأمر الشراء
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewGRNModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveGRNSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Linked PO Selector */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <label className="text-xs font-black text-slate-800 block">
                  1. اختيار أمر الشراء المرتبط (Linked Purchase Order):
                </label>
                <select
                  value={selectedPOForGRN?.id || ''}
                  onChange={(e) => handleSelectPOInGRNModal(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 transition"
                  required
                >
                  <option value="" disabled>
                    -- اختر أمر الشراء المعتمد --
                  </option>
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber} • {po.vendorName || po.supplierName} • {po.projectName} ({po.grandTotal?.toLocaleString()} SAR)
                    </option>
                  ))}
                </select>

                {selectedPOForGRN && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs border-t border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[11px]">المشروع:</span>
                      <strong className="text-slate-800">{selectedPOForGRN.projectName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">المورد:</span>
                      <strong className="text-slate-800">{selectedPOForGRN.vendorName || selectedPOForGRN.supplierName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">إجمالي قيمة الأمر:</span>
                      <strong className="font-mono text-emerald-600 font-bold">{selectedPOForGRN.grandTotal?.toLocaleString()} SAR</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    رقم سند التوريد من المورد *
                  </label>
                  <input
                    type="text"
                    value={grnDeliveryNoteNo}
                    onChange={(e) => setGrnDeliveryNoteNo(e.target.value)}
                    placeholder="e.g. DN-SFF-99401"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold outline-none focus:border-emerald-500 focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    تاريخ التوريد الفعلي *
                  </label>
                  <input
                    type="date"
                    value={grnDeliveryDate}
                    onChange={(e) => setGrnDeliveryDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-500 focus:bg-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    اسم السائق / شركة النقل
                  </label>
                  <input
                    type="text"
                    value={grnDriverName}
                    onChange={(e) => setGrnDriverName(e.target.value)}
                    placeholder="اسم السائق ورقم اللوحة"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    المهندس المستلم بالموقع
                  </label>
                  <input
                    type="text"
                    value={grnReceiverName}
                    onChange={(e) => setGrnReceiverName(e.target.value)}
                    placeholder="م. المهندس المستلم"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              {/* Line items breakdown: Ordered, Delivered, Accepted, Rejected */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>تفصيل البنود والكميات المستلمة والمقبولة بالموقع:</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    الكميات المقبولة ستضاف فوراً لسجل الاستلام وتقرير MIR
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">بيان الصنف والمواصفة</th>
                        <th className="py-2.5 px-3 text-center">المطلوب بالـ PO</th>
                        <th className="py-2.5 px-3 text-center">الكمية المسلّمة</th>
                        <th className="py-2.5 px-3 text-center">المقبول (Accepted)</th>
                        <th className="py-2.5 px-3 text-center">المرفوض (Rejected)</th>
                        <th className="py-2.5 px-3">ملاحظات الفحص</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {grnLineItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            اختر أمر شراء لعرض بنوده
                          </td>
                        </tr>
                      ) : (
                        grnLineItems.map((item, idx) => (
                          <tr key={item.poItemId} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">
                              {item.itemNo}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800 max-w-[220px]">
                              <p className="truncate" title={item.description}>
                                {item.description}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                الوحدة: {item.unit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                              {item.orderedQty}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={item.orderedQty * 2}
                                value={item.deliveredQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const updated = [...grnLineItems];
                                  updated[idx].deliveredQty = val;
                                  updated[idx].acceptedQty = Math.max(0, val - updated[idx].rejectedQty);
                                  setGrnLineItems(updated);
                                }}
                                className="w-16 text-center font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg py-1 text-xs focus:bg-white focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={item.deliveredQty}
                                value={item.acceptedQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const updated = [...grnLineItems];
                                  updated[idx].acceptedQty = val;
                                  updated[idx].rejectedQty = Math.max(0, updated[idx].deliveredQty - val);
                                  setGrnLineItems(updated);
                                }}
                                className="w-16 text-center font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg py-1 text-xs focus:bg-white focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={item.deliveredQty}
                                value={item.rejectedQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const updated = [...grnLineItems];
                                  updated[idx].rejectedQty = val;
                                  updated[idx].acceptedQty = Math.max(0, updated[idx].deliveredQty - val);
                                  setGrnLineItems(updated);
                                }}
                                className="w-16 text-center font-mono font-bold text-red-700 bg-red-50 border border-red-300 rounded-lg py-1 text-xs focus:bg-white focus:border-red-500"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={item.notes}
                                onChange={(e) => {
                                  const updated = [...grnLineItems];
                                  updated[idx].notes = e.target.value;
                                  setGrnLineItems(updated);
                                }}
                                placeholder="ملاحظات العينة..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:bg-white focus:border-emerald-500"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Document Photo & Paper Stamp Attachment */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>إرفاق صورة سند التوريد الورقي مع ختم وتوقيع الموقع (Delivery Note Photo & Stamp):</span>
                  </label>
                  <span className="text-[11px] text-slate-500">JPG, PNG, PDF</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 w-full p-4 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-white text-center cursor-pointer transition hover:bg-emerald-50/20 flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">
                      اضغط لاختيار صورة السند المختوم أو سحب الملف هنا
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {grnAttachedPhotoName || 'لم يتم رفع ملف بعد'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {grnAttachedPhotoUrl && (
                    <div className="relative w-36 h-28 rounded-2xl overflow-hidden border border-slate-300 shadow-sm shrink-0 bg-slate-900 flex items-center justify-center group">
                      <img
                        src={grnAttachedPhotoUrl}
                        alt="Scanned Delivery Note"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                        <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded shadow">
                          مختوم ومطابق
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGrnAttachedPhotoUrl(null);
                          setGrnAttachedPhotoName(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes & Inspection Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    قرار الفحص الاستشاري المبدئي
                  </label>
                  <select
                    value={grnInspectionResult}
                    onChange={(e) => setGrnInspectionResult(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
                  >
                    <option value="Approved">معتمد ومطابق 100% (Approved)</option>
                    <option value="Approved as Noted">معتمد مع ملاحظات طفيفة (Approved as Noted)</option>
                    <option value="Under Inspection">قيد الفحص المخبري / الاستشاري (Under Inspection)</option>
                    <option value="Rejected">مرفوض لوجود عيوب أو عدم مطابقة (Rejected)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ملاحظات عامة عن التوريد والتخزين
                  </label>
                  <input
                    type="text"
                    value={grnNotes}
                    onChange={(e) => setGrnNotes(e.target.value)}
                    placeholder="مكان التخزين بالموقع، حالة التغليف..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewGRNModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ واعتماد محضر الاستلام الموقعي (Save & Push GRN)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: View Attachment / Paper Stamp Viewer */}
      {/* ========================================================= */}
      {viewingAttachmentReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl min-h-screen sm:min-h-0 sm:max-h-[90vh] flex flex-col overflow-hidden">
            <MobileViewerTopBar
              title={`سند التوريد المرفق: ${viewingAttachmentReceipt.receipt.supplierDeliveryNoteNo || viewingAttachmentReceipt.receipt.receiptNumber}`}
              subtitle={`${viewingAttachmentReceipt.po.vendorName || viewingAttachmentReceipt.po.supplierName} • أمر شراء ${viewingAttachmentReceipt.po.poNumber}`}
              onClose={() => setViewingAttachmentReceipt(null)}
            />

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">أمر الشراء:</span>
                  <strong className="font-mono text-slate-900">{viewingAttachmentReceipt.po.poNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">المورد:</span>
                  <strong className="text-slate-900">{viewingAttachmentReceipt.po.vendorName || viewingAttachmentReceipt.po.supplierName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">المستلم بالموقع:</span>
                  <strong className="text-slate-900">{viewingAttachmentReceipt.receipt.receivedBy || 'م. الموقع'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">تاريخ السند:</span>
                  <strong className="font-mono text-slate-900">{viewingAttachmentReceipt.receipt.receiptDate}</strong>
                </div>
              </div>

              {/* Scanned Document Image or Simulated Stamp */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-4 min-h-[320px]">
                {viewingAttachmentReceipt.receipt.attachedDocData ? (
                  <img
                    src={viewingAttachmentReceipt.receipt.attachedDocData}
                    alt="Delivery Note Document"
                    className="max-h-[420px] object-contain rounded-xl shadow-lg"
                  />
                ) : (
                  <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-slate-900 space-y-4 border border-slate-300">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <h4 className="font-black text-sm">مؤسسة صناع الموارد للتجارة (RMT)</h4>
                        <span className="text-[11px] text-slate-500">سند استلام بضاعة موقعي معتمد</span>
                      </div>
                      <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        {viewingAttachmentReceipt.receipt.receiptNumber}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p><strong>المشروع:</strong> {viewingAttachmentReceipt.po.projectName}</p>
                      <p><strong>المورد:</strong> {viewingAttachmentReceipt.po.vendorName || viewingAttachmentReceipt.po.supplierName}</p>
                      <p><strong>سند المورد:</strong> {viewingAttachmentReceipt.receipt.supplierDeliveryNoteNo}</p>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-1">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <div className="font-black text-xs text-emerald-900">تم الفحص والاستلام بموقع المشروع</div>
                      <div className="text-[10px] text-emerald-700 font-mono">SITE RECEIVED & QC VERIFIED • {viewingAttachmentReceipt.receipt.receiptDate}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingAttachmentReceipt(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: Printable Material Inspection Request (MIR) Document */}
      {/* ========================================================= */}
      {viewingMIRDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl min-h-screen sm:min-h-0 sm:max-h-[92vh] flex flex-col overflow-hidden my-auto">
            {/* Header & Print Actions */}
            <MobileViewerTopBar
              title={`طلب فحص مواد استشاري (MIR-${viewingMIRDoc.receipt.receiptNumber})`}
              subtitle={`${viewingMIRDoc.po.projectName} • أمر شراء ${viewingMIRDoc.po.poNumber}`}
              onClose={() => setViewingMIRDoc(null)}
              actions={
                <button
                  type="button"
                  onClick={() => executePrint('printable-mir-sheet', { documentTitle: `MIR-${viewingMIRDoc.receipt.receiptNumber}` })}
                  className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">طباعة تقرير MIR</span>
                </button>
              }
            />

            {/* Printable MIR Sheet */}
            <div className="p-8 overflow-y-auto flex-1 bg-white text-slate-900" id="printable-mir-sheet">
              {/* Official Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    مؤسسة صناع الموارد التجارية
                  </h2>
                  <p className="text-xs text-slate-500 font-bold uppercase font-mono">
                    RESOURCE MAKERS TRADING EST. • QC & SITE ENGINEERING DEPT.
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    قسم إدارة الجودة وضبط المواصفات الميدانية (QA / QC)
                  </p>
                </div>

                <div className="text-left">
                  <span className="text-xs font-mono font-black bg-slate-900 text-white px-3 py-1 rounded-lg block">
                    MIR-{viewingMIRDoc.receipt.receiptNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono mt-1 block">
                    تاريخ الفحص: {viewingMIRDoc.receipt.receiptDate}
                  </span>
                </div>
              </div>

              {/* Title */}
              <div className="text-center py-2 mb-6 bg-slate-100 rounded-xl border border-slate-200">
                <h3 className="text-sm font-black text-slate-900">
                  طلب اعتماد وفحص المواد الموردة للموقع (MATERIAL INSPECTION REQUEST - MIR)
                </h3>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 rounded-xl p-4 mb-6 bg-slate-50/50">
                <div>
                  <span className="text-slate-500 block">اسم المشروع (Project Name):</span>
                  <strong className="text-sm text-slate-900">{viewingMIRDoc.po.projectName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">المقاول العام / المورد (Vendor / Supplier):</span>
                  <strong className="text-sm text-slate-900">{viewingMIRDoc.po.vendorName || viewingMIRDoc.po.supplierName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم أمر الشراء (PO Reference):</span>
                  <strong className="font-mono text-slate-900">{viewingMIRDoc.po.poNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم سند التوريد (Delivery Note No):</span>
                  <strong className="font-mono text-slate-900">{viewingMIRDoc.receipt.supplierDeliveryNoteNo || '—'}</strong>
                </div>
              </div>

              {/* Inspection Items Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-200 text-slate-800 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 border-b border-slate-300">#</th>
                      <th className="py-2.5 px-3 border-b border-slate-300">وصف المادة ومطابقة المواصفة</th>
                      <th className="py-2.5 px-3 text-center border-b border-slate-300">الكمية المطلوبة</th>
                      <th className="py-2.5 px-3 text-center border-b border-slate-300">الكمية المسلمة</th>
                      <th className="py-2.5 px-3 text-center border-b border-slate-300">المقبول (Pass)</th>
                      <th className="py-2.5 px-3 text-center border-b border-slate-300">المرفوض (Fail)</th>
                      <th className="py-2.5 px-3 border-b border-slate-300">ملاحظات الجودة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {(viewingMIRDoc.receipt.receivedItems || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-mono text-slate-500 font-bold">{it.itemNo || idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{it.description}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{it.orderedQty || it.receivedQty}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">{it.receivedQty}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">{it.receivedQty}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">0</td>
                        <td className="py-2.5 px-3 text-slate-600">مطابق للاعتماد الفني والمواصفات</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* QA/QC Checklist */}
              <div className="border border-slate-300 rounded-xl p-4 mb-6 space-y-2 bg-slate-50/50 text-xs">
                <h4 className="font-bold text-slate-800">معايير الفحص الميداني (Inspection Checklist):</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>مطابقة المواد مع العينات المعتمدة والـ Submittal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>سلامة التغليف وخلو المواد من الصدمات والتشوهات</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>وجود شهادات المنشأ الأصلية وبطاقات المصنع (Nameplate)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>مطابقة الأبعاد والأقطار والضغوط التشغيلية</span>
                  </div>
                </div>
              </div>

              {/* Signatures & Consultant Approvals */}
              <div className="grid grid-cols-3 gap-4 border border-slate-300 rounded-xl p-4 text-xs">
                <div className="space-y-6">
                  <span className="text-slate-500 block">مهندس الموقع المستلم (Site Engineer):</span>
                  <div className="font-bold text-slate-900">{viewingMIRDoc.receipt.receivedBy || 'م. مختار يوسف'}</div>
                  <div className="text-[10px] text-slate-400 border-t pt-1">التوقيع والختم الموقعي</div>
                </div>

                <div className="space-y-6 border-r pr-4">
                  <span className="text-slate-500 block">مدير إدارة المشاريع (Project Manager):</span>
                  <div className="font-bold text-slate-900">م. مختار أبو رزق</div>
                  <div className="text-[10px] text-slate-400 border-t pt-1">الاعتماد الفني النهائي</div>
                </div>

                <div className="space-y-6 border-r pr-4 bg-emerald-50/50 p-2 rounded-lg">
                  <span className="text-slate-700 font-bold block">اعتماد استشاري المشروع (Consultant):</span>
                  <div className="font-bold text-emerald-900">APPROVED AS COMPLIANT</div>
                  <div className="text-[10px] text-slate-500 border-t pt-1">ختم الاستشاري المعتمد</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => setViewingMIRDoc(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
