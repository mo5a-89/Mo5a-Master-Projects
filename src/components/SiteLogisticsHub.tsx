import React, { useState, useMemo } from 'react';
import {
  DeliveryNote,
  DeliveryNoteItem,
  PurchaseOrder,
  Project,
  User,
  MaterialReceiptRecord,
  CustomerQuotation,
  Invoice,
  InvoiceItem,
} from '../types';
import {
  Truck,
  Package,
  Plus,
  Search,
  Filter,
  FileCheck,
  Printer,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  AlertTriangle,
  FileText,
  Eye,
  Check,
  X,
  ArrowRight,
  DollarSign,
  Scale,
  Receipt,
  User as UserIcon,
  MapPin,
  Phone,
  Car,
  ShieldAlert,
  Send,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { executePrint } from '../utils/printUtils';
import { useSettings } from '../context/SettingsContext';
import { CompanyLogo } from './CompanyHeader';
import { getNextDeliveryNoteNumber, getNextInvoiceNumber } from '../utils/invoiceUtils';

export interface SiteLogisticsHubProps {
  currentUser: User;
  projects: Project[];
  purchaseOrders: PurchaseOrder[];
  deliveryNotes: DeliveryNote[];
  customerQuotations?: CustomerQuotation[];
  invoices?: Invoice[];
  onSaveDeliveryNote?: (dn: DeliveryNote) => void;
  onUpdateDeliveryNote?: (dn: DeliveryNote) => void;
  onDeleteDeliveryNote?: (id: string) => void;
  onSaveMaterialReceipt?: (poId: string, receipt: MaterialReceiptRecord, updatedPOItems: PurchaseOrder['items']) => void;
  onSelectProject?: (projectId: string) => void;
  onOpenCreateInvoiceForDN?: (dn: DeliveryNote) => void;
  onCreateInvoice?: (invoice: Invoice) => void;
  onNavigateTab?: (tab: string) => void;
  onUpdateProject?: (project: Project) => void;
}

export const SiteLogisticsHub: React.FC<SiteLogisticsHubProps> = ({
  currentUser,
  projects = [],
  purchaseOrders = [],
  deliveryNotes = [],
  customerQuotations = [],
  invoices = [],
  onSaveDeliveryNote,
  onUpdateDeliveryNote,
  onDeleteDeliveryNote,
  onSaveMaterialReceipt,
  onSelectProject,
  onOpenCreateInvoiceForDN,
  onCreateInvoice,
  onNavigateTab,
  onUpdateProject,
}) => {
  const { t, settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'delivery_notes' | 'receiving_grn' | 'site_inventory'>('delivery_notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'uninvoiced' | 'invoiced'>('all');

  // Modals state
  const [isNewDNModalOpen, setIsNewDNModalOpen] = useState(false);
  const [isNewGRNModalOpen, setIsNewGRNModalOpen] = useState(false);
  const [selectedDNForView, setSelectedDNForView] = useState<DeliveryNote | null>(null);
  const [selectedDNForInvoice, setSelectedDNForInvoice] = useState<DeliveryNote | null>(null);
  const [printableSlipDN, setPrintableSlipDN] = useState<DeliveryNote | null>(null);
  const [selectedGRNForPrint, setSelectedGRNForPrint] = useState<MaterialReceiptRecord | null>(null);

  // GRN Modal State
  const [grnSelectedPOId, setGrnSelectedPOId] = useState<string>('');
  const [grnReceiptNumber, setGrnReceiptNumber] = useState<string>('');
  const [grnDate, setGrnDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [grnSupplierDN, setGrnSupplierDN] = useState<string>('');
  const [grnReceiverName, setGrnReceiverName] = useState<string>('');
  const [grnDestination, setGrnDestination] = useState<'direct_site' | 'central_warehouse'>('direct_site');
  const [grnQualityStatus, setGrnQualityStatus] = useState<string>('فحص معتمد ومطابق للمواصفات الفنية UL/FM و SASO');
  const [grnStorageLocation, setGrnStorageLocation] = useState<string>('موقع المشروع الميداني');
  const [grnNotes, setGrnNotes] = useState<string>('تمت المعاينة الفنية والمطابقة الموقعية واستلام الأصناف بحالة سليمة.');
  const [grnReceivedQuantities, setGrnReceivedQuantities] = useState<Record<string, number>>({});

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoiceDueDate, setInvoiceDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [invoiceItemRates, setInvoiceItemRates] = useState<Record<string, number>>({});

  // Compute Invoice Financials
  const invoiceFinancials = useMemo(() => {
    if (!selectedDNForInvoice) return { subtotal: 0, vatAmount: 0, grandTotal: 0 };
    let subtotal = 0;
    (selectedDNForInvoice.items || []).forEach((it) => {
      const rate = invoiceItemRates[it.id] !== undefined ? invoiceItemRates[it.id] : (it.unitPrice || 0);
      subtotal += (it.deliveredQty || 0) * rate;
    });
    const vatAmount = Math.round(subtotal * 0.15 * 100) / 100;
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100;
    return { subtotal, vatAmount, grandTotal };
  }, [selectedDNForInvoice, invoiceItemRates]);

  // Selected PO for GRN Intake view
  const [activePOId, setActivePOId] = useState<string>('po-1');
  const currentPO = useMemo(() => {
    return purchaseOrders.find((p) => p.id === activePOId || p.poNumber?.includes('509')) || purchaseOrders[0];
  }, [purchaseOrders, activePOId]);

  // ---------------------------------------------------------------------------
  // INVENTORY & STOCK LEDGER ENGINE
  // Computes Received (GRNs) vs Delivered to Clients (DNs) -> Available On-Hand
  // ---------------------------------------------------------------------------
  const projectInventoryMap = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        itemId: string;
        description: string;
        unit: string;
        contractQty: number;
        receivedFromSuppliers: number;
        deliveredToClient: number;
        onHandStock: number;
        remainingToDeliver: number;
        unitRate: number;
        status: string;
      }>
    >();

    projects.forEach((proj) => {
      const itemsList: Array<{
        itemId: string;
        description: string;
        unit: string;
        contractQty: number;
        receivedFromSuppliers: number;
        deliveredToClient: number;
        onHandStock: number;
        remainingToDeliver: number;
        unitRate: number;
        status: string;
      }> = [];

      // 1. Pull base items from Project Contract PO or Quotations or Project POs
      const contractItems = proj.clientContractPO?.items || [];
      const quote = customerQuotations.find((q) => q.projectId === proj.id || q.projectName === proj.name);
      const quoteItems = quote?.items || [];

      // Unified base item pool
      const baseItems = contractItems.length > 0
        ? contractItems.map((ci) => ({
            id: ci.id,
            description: ci.description,
            unit: ci.unit || 'EA',
            quantity: ci.quantity,
            unitPrice: ci.unitPrice || 0,
          }))
        : quoteItems.length > 0
        ? quoteItems.map((qi: any) => ({
            id: qi.id,
            description: qi.description,
            unit: qi.unit || 'EA',
            quantity: qi.quantity,
            unitPrice: qi.unitRate || qi.unitPrice || 0,
          }))
        : (purchaseOrders.filter((po) => po.projectId === proj.id).flatMap((po) => po.items) || []).map((poi) => ({
            id: poi.id,
            description: poi.description,
            unit: poi.unit || 'EA',
            quantity: poi.quantity,
            unitPrice: poi.unitPrice ? Math.round(poi.unitPrice * 1.25) : 0,
          }));

      // In case project has no contract/quote items yet, fallback to sample items
      const effectiveBaseItems = baseItems.length > 0 ? baseItems : [
        { id: `${proj.id}-it-1`, description: 'شبكة رش آلي ومحابس تحكم معتمدة UL/FM', unit: 'نظام متكامل', quantity: 1, unitPrice: 185000 },
        { id: `${proj.id}-it-2`, description: 'صناديق حريق ستانلس ستيل مع بكرات خراطيم 1 بوصة', unit: 'طقم', quantity: 24, unitPrice: 1200 },
        { id: `${proj.id}-it-3`, description: 'مضخة حريق رئيسية 750 GPM مع لوحة تحكم رقمية', unit: 'مضخة', quantity: 1, unitPrice: 95000 },
      ];

      // Calculate stock for each item
      effectiveBaseItems.forEach((it) => {
        // Calculate received from suppliers for this project & item
        const matchingPOs = purchaseOrders.filter((po) => po.projectId === proj.id || po.projectName === proj.name);
        let receivedFromSuppliers = 0;
        matchingPOs.forEach((po) => {
          (po.materialReceipts || []).forEach((mr) => {
            (mr.receivedItems || []).forEach((ri) => {
              if (
                ri.description?.trim().toLowerCase() === it.description.trim().toLowerCase() ||
                ri.poItemId === it.id
              ) {
                receivedFromSuppliers += ri.receivedQty || 0;
              }
            });
          });
          // Also check item deliveredQty on PO
          po.items.forEach((poi) => {
            if (poi.description?.trim().toLowerCase() === it.description.trim().toLowerCase() || poi.id === it.id) {
              if (poi.deliveredQty !== undefined && poi.deliveredQty > 0) {
                receivedFromSuppliers = Math.max(receivedFromSuppliers, poi.deliveredQty);
              } else if (po.deliveryStatus === 'Delivered') {
                receivedFromSuppliers = Math.max(receivedFromSuppliers, poi.quantity);
              }
            }
          });
        });

        // If no PO receipts found yet, default received to contractQty for demo projects so deliveries can occur
        if (receivedFromSuppliers === 0 && matchingPOs.length === 0) {
          receivedFromSuppliers = it.quantity; // Stock available at warehouse
        }

        // Calculate delivered to client from Delivery Notes for this project & item
        let deliveredToClient = 0;
        deliveryNotes
          .filter((dn) => (dn.projectId === proj.id || dn.projectName === proj.name) && !dn.deletedAt)
          .forEach((dn) => {
            (dn.items || []).forEach((dni) => {
              if (
                dni.description?.trim().toLowerCase() === it.description.trim().toLowerCase() ||
                dni.sourceItemId === it.id
              ) {
                deliveredToClient += dni.deliveredQty || 0;
              }
            });
          });

        const onHandStock = Math.max(0, receivedFromSuppliers - deliveredToClient);
        const remainingToDeliver = Math.max(0, it.quantity - deliveredToClient);

        let status = 'قيد التوريد من المورد';
        if (deliveredToClient >= it.quantity && it.quantity > 0) {
          status = 'مسلّم بالموقع - Delivered On-Site';
        } else if (deliveredToClient > 0) {
          status = 'تسليم جزئي بالموقع';
        } else if (onHandStock > 0) {
          status = 'مستلم ومتاح بالمستودع';
        }

        itemsList.push({
          itemId: it.id,
          description: it.description,
          unit: it.unit,
          contractQty: it.quantity,
          receivedFromSuppliers,
          deliveredToClient,
          onHandStock,
          remainingToDeliver,
          unitRate: it.unitPrice || 0,
          status,
        });
      });

      map.set(proj.id, itemsList);
    });

    return map;
  }, [projects, purchaseOrders, deliveryNotes, customerQuotations]);

  // Filtered Client Delivery Notes
  const filteredDNs = useMemo(() => {
    return deliveryNotes.filter((dn) => {
      if (dn.deletedAt) return false;
      const matchSearch =
        (dn.dnNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dn.projectName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dn.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dn.recipientName || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === 'uninvoiced') {
        return dn.invoicedStatus !== 'Fully Invoiced';
      }
      if (statusFilter === 'invoiced') {
        return dn.invoicedStatus === 'Fully Invoiced';
      }
      return true;
    });
  }, [deliveryNotes, searchQuery, statusFilter]);

  // Logistics KPI Summary
  const kpiStats = useMemo(() => {
    const activeDns = deliveryNotes.filter((dn) => !dn.deletedAt);
    const fullyInvoicedCount = activeDns.filter((dn) => dn.invoicedStatus === 'Fully Invoiced').length;
    const readyForBillingCount = activeDns.length - fullyInvoicedCount;
    const totalDeliveredValue = activeDns.reduce((sum, dn) => {
      const noteTotal = (dn.items || []).reduce((sub, it) => sub + (it.totalPrice || (it.deliveredQty || 0) * (it.unitPrice || 0)), 0);
      return sum + noteTotal;
    }, 0);

    return {
      totalDNs: activeDns.length,
      fullyInvoicedCount,
      readyForBillingCount,
      totalDeliveredValue,
    };
  }, [deliveryNotes]);

  // ---------------------------------------------------------------------------
  // NEW CLIENT DN FORM STATE
  // ---------------------------------------------------------------------------
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => projects[0]?.id || 'prj-1');
  const activeSelectedProject = useMemo(() => {
    return (
      projects.find((p) => p.id === selectedProjectId) ||
      projects[0] || {
        id: selectedProjectId || 'prj-1',
        projectNumber: 'PRJ-2026-001',
        name: 'مشروع التوريد الميداني المعتمد',
        customerName: 'شركة كامكو للمقاولات العامة',
        location: 'موقع الظهران - المنطقة الشرقية',
        status: 'Won',
        createdAt: new Date().toISOString(),
      }
    );
  }, [projects, selectedProjectId]);

  const availableProjectStockItems = useMemo(() => {
    if (!activeSelectedProject) return [];
    return projectInventoryMap.get(activeSelectedProject.id) || [];
  }, [activeSelectedProject, projectInventoryMap]);

  // Input states for New DN
  const [newDnDate, setNewDnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newDnLocation, setNewDnLocation] = useState('');
  const [newDnReceiverName, setNewDnReceiverName] = useState('');
  const [newDnReceiverPhone, setNewDnReceiverPhone] = useState('');
  const [newDnDriverName, setNewDnDriverName] = useState('سائق المؤسسة المعتمد');
  const [newDnVehiclePlate, setNewDnVehiclePlate] = useState('د ص ر 9821');
  const [newDnDispatchedBy, setNewDnDispatchedBy] = useState('Medhat Al Brahim');
  const [newDnNotes, setNewDnNotes] = useState('يرجى الفحص الفني الموقعي ومطابقة الكميات والتوقيع بالاستلام.');
  const [itemQuantitiesToDeliver, setItemQuantitiesToDeliver] = useState<Record<string, number>>({});
  
  // Custom manual delivery items
  const [customDeliveryItems, setCustomDeliveryItems] = useState<Array<{
    id: string;
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>>([]);

  const handleAddCustomDeliveryItem = () => {
    setCustomDeliveryItems((prev) => [
      ...prev,
      {
        id: `custom-item-${Date.now()}-${prev.length + 1}`,
        description: '',
        unit: 'متر طولي (LM)',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleUpdateCustomDeliveryItem = (
    id: string,
    field: 'description' | 'unit' | 'quantity' | 'unitPrice',
    value: any
  ) => {
    setCustomDeliveryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveCustomDeliveryItem = (id: string) => {
    setCustomDeliveryItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Reset form when project changes
  const handleSelectProjectForNewDN = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find((p) => p.id === projId) || activeSelectedProject;
    if (proj) {
      setNewDnLocation(proj.location || 'موقع المشروع الرئيسي');
      setNewDnReceiverName(proj.attnName || proj.customerName || 'المهندس المشرف بالموقع');
    }
    // initialize quantities to 0
    setItemQuantitiesToDeliver({});
  };

  const handleOpenNewDNModal = () => {
    const proj = projects.length > 0 ? (projects.find((p) => p.id === selectedProjectId) || projects[0]) : activeSelectedProject;
    if (proj) {
      setSelectedProjectId(proj.id);
      setNewDnLocation(proj.location || 'موقع المشروع بالمنطقة الشرقية');
      setNewDnReceiverName(proj.attnName || proj.customerName || 'م. أحمد السالم');
      setNewDnReceiverPhone('0501234567');
      setItemQuantitiesToDeliver({});
      setCustomDeliveryItems([]);
    }
    setIsNewDNModalOpen(true);
  };

  const totalStockItemsWithQty = Object.values(itemQuantitiesToDeliver).filter((q) => Number(q) > 0).length;
  const validCustomItems = customDeliveryItems.filter((it) => it.description.trim().length > 0 && Number(it.quantity) > 0);
  const totalDeliverableItemsCount = totalStockItemsWithQty + validCustomItems.length;

  // Submit New Client Delivery Note
  const handleSubmitNewClientDN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSelectedProject) return;

    if (totalDeliverableItemsCount === 0) {
      alert('يرجى تحديد كمية التسليم لبند واحد على الأقل أو إضافة صنف يدوي.');
      return;
    }

    const nextNumber = getNextDeliveryNoteNumber(activeSelectedProject, deliveryNotes);

    // 1. Stock items
    const stockDnItems: DeliveryNoteItem[] = availableProjectStockItems
      .filter((item) => (itemQuantitiesToDeliver[item.itemId] || 0) > 0)
      .map((item, idx) => {
        const qty = Number(itemQuantitiesToDeliver[item.itemId]) || 0;
        const unitPrice = item.unitRate || 0;
        return {
          id: `dni-${Date.now()}-${idx}`,
          sourceItemId: item.itemId,
          itemNo: idx + 1,
          description: item.description,
          unit: item.unit,
          orderedQty: item.contractQty || qty,
          deliveredQty: qty,
          totalDeliveredSoFar: item.deliveredToClient + qty,
          remainingQty: Math.max(0, (item.contractQty || qty) - (item.deliveredToClient + qty)),
          unitPrice,
          totalPrice: qty * unitPrice,
          isInvoiced: false,
          notes: 'تسليم بموجب محضر الفحص الميداني والمطابقة الفنية',
        };
      });

    // 2. Custom manual items
    const customDnItems: DeliveryNoteItem[] = validCustomItems.map((cItem, idx) => {
      const qty = Number(cItem.quantity) || 1;
      const unitPrice = Number(cItem.unitPrice) || 0;
      return {
        id: `dni-custom-${Date.now()}-${idx}`,
        sourceItemId: cItem.id,
        itemNo: stockDnItems.length + idx + 1,
        description: cItem.description.trim(),
        unit: cItem.unit || 'EA',
        orderedQty: qty,
        deliveredQty: qty,
        totalDeliveredSoFar: qty,
        remainingQty: 0,
        unitPrice,
        totalPrice: qty * unitPrice,
        isInvoiced: false,
        notes: 'بند تسليم مباشر للموقع',
      };
    });

    const allDnItems = [...stockDnItems, ...customDnItems];

    const newDeliveryNote: DeliveryNote = {
      id: `dn-${Date.now()}`,
      dnNumber: nextNumber,
      date: newDnDate,
      projectId: activeSelectedProject.id,
      projectName: activeSelectedProject.name,
      projectNumber: activeSelectedProject.projectNumber,
      customerId: activeSelectedProject.customerId || 'cust-1',
      customerName: activeSelectedProject.customerName || 'شركة كامكو للمقاولات',
      deliveryLocation: newDnLocation || activeSelectedProject.location || 'موقع المشروع الرئيسي',
      recipientName: newDnReceiverName || 'مهندس استلام العميل',
      recipientPhone: newDnReceiverPhone,
      driverOrCarrier: newDnDriverName,
      vehiclePlateNo: newDnVehiclePlate,
      dispatchedByName: newDnDispatchedBy,
      status: 'Delivered',
      items: allDnItems,
      invoicedStatus: 'Uninvoiced',
      notes: newDnNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Save DN to parent state
    if (onSaveDeliveryNote) {
      onSaveDeliveryNote(newDeliveryNote);
    }

    // 2. Mark Project execution status & update BOQ status
    if (onUpdateProject) {
      const updatedProject: Project = {
        ...activeSelectedProject,
        executionStatus: 'قيد التنفيذ',
        completionDate: newDnDate,
        handoverNotes: `تم تسليم دفعة مواد بموجب سند التسليم ${nextNumber}`,
      };
      onUpdateProject(updatedProject);
    }

    setIsNewDNModalOpen(false);
    setSelectedDNForView(newDeliveryNote);
  };

  const handleOpenBillingPipelineForDN = (dn: DeliveryNote) => {
    setSelectedDNForInvoice(dn);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setInvoiceDueDate(d.toISOString().split('T')[0]);

    // Pre-populate rates
    const ratesMap: Record<string, number> = {};
    (dn.items || []).forEach((it) => {
      ratesMap[it.id] = it.unitPrice || 0;
    });
    setInvoiceItemRates(ratesMap);
  };

  // Execute Invoice Generation and General Ledger Post
  const handleApproveAndPostInvoice = () => {
    if (!selectedDNForInvoice) return;

    const proj = projects.find((p) => p.id === selectedDNForInvoice.projectId) || {
      id: selectedDNForInvoice.projectId,
      projectNumber: selectedDNForInvoice.projectNumber,
      name: selectedDNForInvoice.projectName,
      customerName: selectedDNForInvoice.customerName,
      location: selectedDNForInvoice.deliveryLocation,
      status: 'Won',
      createdAt: new Date().toISOString(),
    } as Project;

    const nextInvNumber = getNextInvoiceNumber(proj, invoices);

    const invItems: InvoiceItem[] = (selectedDNForInvoice.items || []).map((it, idx) => {
      const rate = invoiceItemRates[it.id] !== undefined ? invoiceItemRates[it.id] : (it.unitPrice || 0);
      const total = (it.deliveredQty || 0) * rate;
      return {
        id: `inv-it-${Date.now()}-${idx}`,
        sourceItemId: it.sourceItemId,
        itemNo: it.itemNo || idx + 1,
        description: it.description,
        quantity: it.deliveredQty,
        unit: it.unit,
        unitPrice: rate,
        totalPrice: total,
        contractRate: rate,
        priceSource: 'delivery_note',
        deliveryNoteRef: selectedDNForInvoice.dnNumber,
        isDelivered: true,
      };
    });

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvNumber,
      date: invoiceDate,
      dueDate: invoiceDueDate,
      projectId: selectedDNForInvoice.projectId,
      projectName: selectedDNForInvoice.projectName,
      projectNumber: selectedDNForInvoice.projectNumber,
      customerId: selectedDNForInvoice.customerId || 'cust-1',
      customerName: selectedDNForInvoice.customerName,
      customerVatNo: '310498721500003',
      customerAddress: selectedDNForInvoice.deliveryLocation,
      sourceDeliveryNoteIds: [selectedDNForInvoice.id],
      items: invItems,
      subtotal: invoiceFinancials.subtotal,
      discount: 0,
      totalAfterDiscount: invoiceFinancials.subtotal,
      vatPercent: 15,
      vatAmount: invoiceFinancials.vatAmount,
      grandTotal: invoiceFinancials.grandTotal,
      paidAmount: 0,
      remainingAmount: invoiceFinancials.grandTotal,
      status: 'Issued',
      payments: [],
      poReference: `سند تسليم رقم: ${selectedDNForInvoice.dnNumber}`,
      notes: `فاتورة ضريبية رسمية مصدرة بموجب سند تسليم المواد الميداني رقم ${selectedDNForInvoice.dnNumber}. مستحقة الدفع بالتحويل البنكي لحساب المؤسسة.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Create Invoice in Central Accounting
    if (onCreateInvoice) {
      onCreateInvoice(newInvoice);
    }

    // 2. Update Delivery Note Status to Fully Invoiced
    const updatedDN: DeliveryNote = {
      ...selectedDNForInvoice,
      invoicedStatus: 'Fully Invoiced',
      linkedInvoiceId: newInvoice.id,
      linkedInvoiceNumber: newInvoice.invoiceNumber,
      updatedAt: new Date().toISOString(),
    };

    if (onUpdateDeliveryNote) {
      onUpdateDeliveryNote(updatedDN);
    }

    setSelectedDNForInvoice(null);
    setPrintableSlipDN(updatedDN);
  };

  // ---------------------------------------------------------------------------
  // NEW SUPPLIER GRN / MIR INTAKE HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenNewGRNModal = (poIdToOpen?: string) => {
    const targetPO = purchaseOrders.find((p) => p.id === (poIdToOpen || activePOId)) || purchaseOrders[0];
    if (targetPO) {
      setGrnSelectedPOId(targetPO.id);
      const existingReceiptCount = (targetPO.materialReceipts || []).length;
      setGrnReceiptNumber(`GRN-${targetPO.poNumber || 'PO'}-${String(existingReceiptCount + 1).padStart(2, '0')}`);
      setGrnDate(new Date().toISOString().split('T')[0]);
      setGrnSupplierDN('');
      setGrnReceiverName(currentUser.fullName || currentUser.name || 'Eng. Mokhtar Yousef');
      setGrnDestination('direct_site');
      setGrnQualityStatus('فحص معتمد ومطابق للمواصفات الفنية UL/FM و SASO');
      setGrnStorageLocation(targetPO.projectName ? `موقع ${targetPO.projectName}` : 'الموقع الميداني للمشروع');
      setGrnNotes('تمت المعاينة الفنية والمطابقة الموقعية واستلام الأصناف بحالة سليمة.');

      const initQtys: Record<string, number> = {};
      (targetPO.items || []).forEach((it) => {
        const remaining = Math.max(0, it.quantity - (it.deliveredQty || 0));
        initQtys[it.id] = remaining;
      });
      setGrnReceivedQuantities(initQtys);
    }
    setIsNewGRNModalOpen(true);
  };

  const handleSelectPOForGRN = (poId: string) => {
    setGrnSelectedPOId(poId);
    const targetPO = purchaseOrders.find((p) => p.id === poId);
    if (targetPO) {
      const existingReceiptCount = (targetPO.materialReceipts || []).length;
      setGrnReceiptNumber(`GRN-${targetPO.poNumber || 'PO'}-${String(existingReceiptCount + 1).padStart(2, '0')}`);
      setGrnStorageLocation(targetPO.projectName ? `موقع ${targetPO.projectName}` : 'الموقع الميداني للمشروع');
      const initQtys: Record<string, number> = {};
      (targetPO.items || []).forEach((it) => {
        const remaining = Math.max(0, it.quantity - (it.deliveredQty || 0));
        initQtys[it.id] = remaining;
      });
      setGrnReceivedQuantities(initQtys);
    }
  };

  const handleSubmitNewGRN = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPO = purchaseOrders.find((p) => p.id === grnSelectedPOId);
    if (!targetPO) return;

    const validItems = (targetPO.items || []).filter(
      (it) => (grnReceivedQuantities[it.id] || 0) > 0
    );

    if (validItems.length === 0) {
      alert('يرجى تحديد كمية مستلمة أكبر من الصفر لبند واحد على الأقل.');
      return;
    }

    const receiptItems = validItems.map((it, idx) => {
      const recQty = Number(grnReceivedQuantities[it.id]) || 0;
      return {
        poItemId: it.id,
        itemNo: it.itemNo || idx + 1,
        description: it.description,
        orderedQty: it.quantity,
        receivedQty: recQty,
        unitPrice: it.unitPrice || 0,
        unit: it.unit || 'EA',
      };
    });

    const newReceipt: MaterialReceiptRecord = {
      id: `mr-${Date.now()}`,
      receiptNumber: grnReceiptNumber || `GRN-${targetPO.poNumber || 'PO'}-${Date.now().toString().slice(-4)}`,
      receiptDate: grnDate,
      receivedDate: grnDate,
      supplierDeliveryNoteNo: grnSupplierDN || `DN-SUP-${Date.now().toString().slice(-4)}`,
      deliveryNoteDate: grnDate,
      poId: targetPO.id,
      poNumber: targetPO.poNumber,
      projectId: targetPO.projectId,
      projectName: targetPO.projectName,
      vendorName: targetPO.supplierName || targetPO.vendorName,
      receivedBy: grnReceiverName,
      destinationTag: grnDestination,
      receivedItems: receiptItems,
      notes: `${grnQualityStatus} | ${grnStorageLocation} | ${grnNotes}`,
      createdAt: new Date().toISOString(),
    };

    const updatedPOItems = (targetPO.items || []).map((it) => {
      const addedQty = Number(grnReceivedQuantities[it.id]) || 0;
      const totalDelivered = (it.deliveredQty || 0) + addedQty;
      return {
        ...it,
        deliveredQty: totalDelivered,
        deliveryStatus:
          totalDelivered >= it.quantity
            ? ('Delivered' as const)
            : totalDelivered > 0
            ? ('Partial Delivered' as const)
            : it.deliveryStatus || ('Pending' as const),
      };
    });

    if (onSaveMaterialReceipt) {
      onSaveMaterialReceipt(targetPO.id, newReceipt, updatedPOItems);
    }

    setIsNewGRNModalOpen(false);
    setSelectedGRNForPrint(newReceipt);
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER & EXECUTIVE SUMMARY                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 border border-teal-200 dark:border-teal-800/40 flex items-center justify-center shadow-xs">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>إدارة التوريد واللوجستيات الميدانية</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300 font-mono font-bold">
                DN to Invoice Engine
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              إصدار سندات تسليم العملاء (DN)، التحقق اللحظي من الرصيد المتوفر بالموقع، والترحيل التلقائي للفوترة الضريبية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleOpenNewGRNModal()}
            className="h-10 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ إنشاء سند استلام مواد (New Supplier GRN / MIR)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">سندات تسليم العملاء (DNs)</span>
            <div className="mt-1 text-lg sm:text-xl lg:text-2xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
              {kpiStats.totalDNs} <span className="text-xs font-sans text-slate-400">سند</span>
            </div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">صادرة ومعتمدة بالموقع</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <FileCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">جاهزة للفوترة الضريبية</span>
            <div className="mt-1 text-lg sm:text-xl lg:text-2xl font-black font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {kpiStats.readyForBillingCount} <span className="text-xs font-sans text-slate-400">سند</span>
            </div>
            <span className="text-[10px] text-amber-600 font-semibold">بانتظار إصدار الفاتورة الضريبية</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">مفوترة بالكامل ومرحلة للدفاتر</span>
            <div className="mt-1 text-lg sm:text-xl lg:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {kpiStats.fullyInvoicedCount} <span className="text-xs font-sans text-slate-400">سند</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">قيود يومية مرحلة للعملاء</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إجمالي قيمة التوريدات المسلمة</span>
            <div className="mt-1 text-lg sm:text-xl lg:text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 tabular-nums">
              {kpiStats.totalDeliveredValue.toLocaleString()} <span className="text-xs font-sans text-slate-400">ر.س</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-semibold">قيمة إجمالية للبضائع الميدانية</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. SUB-TABS NAVIGATION                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('delivery_notes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'delivery_notes'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>سندات تسليم العملاء (Client Delivery Notes - DN)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('site_inventory')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'site_inventory'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>أرصدة الموقع وتتبع الاستهلاك (Site Inventory Ledger)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receiving_grn')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'receiving_grn'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>استلام وفحص توريدات الموردين (Supplier GRN / MIR)</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: CLIENT DELIVERY NOTES (DN) ENGINE                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'delivery_notes' && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم السند، المشروع، العميل، أو المستلم..."
                  className="w-full pr-9 pl-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'all' ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs' : 'text-slate-500'}`}
                >
                  الكل ({deliveryNotes.filter((d) => !d.deletedAt).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('uninvoiced')}
                  className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'uninvoiced' ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-2xs' : 'text-slate-500'}`}
                >
                  جاهز للفوترة
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('invoiced')}
                  className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'invoiced' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs' : 'text-slate-500'}`}
                >
                  تمت الفوترة
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenNewDNModal}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إصدار سند تسليم جديد</span>
            </button>
          </div>

          {/* Delivery Notes Table */}
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">رقم سند التسليم (DN#)</th>
                    <th className="py-3.5 px-4">المشروع المستلم</th>
                    <th className="py-3.5 px-4">العميل المستلم</th>
                    <th className="py-3.5 px-4">تاريخ التسليم</th>
                    <th className="py-3.5 px-4">المستلم والموقع الميداني</th>
                    <th className="py-3.5 px-4">الأصناف المسلمة</th>
                    <th className="py-3.5 px-4">حالة الفوترة الضريبية</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات والترحيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDNs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        لا توجد سندات تسليم تطابق خيارات البحث الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredDNs.map((dn) => {
                      const isFullyInvoiced = dn.invoicedStatus === 'Fully Invoiced';
                      const itemsCount = dn.items?.length || 0;
                      const totalQty = (dn.items || []).reduce((sum, it) => sum + (it.deliveredQty || 0), 0);

                      return (
                        <tr key={dn.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-black text-slate-900 dark:text-white">
                              {dn.dnNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 dark:text-slate-200">{dn.projectName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{dn.projectNumber}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                            {dn.customerName}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">
                            {dn.date}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                            <div className="font-semibold text-teal-800 dark:text-teal-300">{dn.recipientName || 'مهندس العميل'}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400 inline" />
                              <span>{dn.deliveryLocation || 'موقع المشروع'}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {totalQty} <span className="text-[10px] font-sans text-slate-400">وحدة</span>
                            </div>
                            <div className="text-[10px] text-slate-400">{itemsCount} بنود فنية</div>
                          </td>
                          <td className="py-3.5 px-4">
                            {isFullyInvoiced ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>تمت الفوترة ({dn.linkedInvoiceNumber || 'INV'})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>جاهز للفوترة الضريبية</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* 1. Tax Invoicing Action Button */}
                              {!isFullyInvoiced ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenBillingPipelineForDN(dn)}
                                  className="px-2.5 py-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 transition cursor-pointer"
                                  title="ترحيل سند التسليم للفوترة الضريبية وإثبات القيد المحاسبي"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  <span>ترحيل للفوترة الضريبية</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onNavigateTab) onNavigateTab('invoices');
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 hover:bg-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                                  title="عرض الفاتورة الضريبية المرتبطة"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>مفوتر ({dn.linkedInvoiceNumber})</span>
                                </button>
                              )}

                              {/* 2. Print Official Delivery Slip */}
                              <button
                                type="button"
                                onClick={() => setPrintableSlipDN(dn)}
                                className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg transition cursor-pointer"
                                title="طباعة سند التسليم الرسمي بتوقيع الطرفين"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* 3. View Details */}
                              <button
                                type="button"
                                onClick={() => setSelectedDNForView(dn)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                                title="معاينة تفاصيل السند"
                              >
                                <Eye className="w-4 h-4" />
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

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: SITE INVENTORY LEDGER & REAL-TIME DEPLETION TRACKER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'site_inventory' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" />
                  <span>دفتر الأرصدة الميدانية وتتبع استهلاك المواد بالمواقع (Site Inventory Ledger)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  رصيد المواد الفعلي بالموقع = (المستلم من الموردين بمحاضر GRN) - (المسلم للعميل بموجب سندات التسليم DN)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-mono font-bold border border-teal-200 dark:border-teal-800">
                  {projects.length} مشاريع تحت المتابعة
                </span>
              </div>
            </div>

            {/* Inventory Ledger per Project */}
            <div className="space-y-6">
              {projects.map((proj) => {
                const items = projectInventoryMap.get(proj.id) || [];
                const totalContractUnits = items.reduce((sum, it) => sum + it.contractQty, 0);
                const totalDeliveredUnits = items.reduce((sum, it) => sum + it.deliveredToClient, 0);
                const totalOnHandUnits = items.reduce((sum, it) => sum + it.onHandStock, 0);
                const deliveryPct = totalContractUnits > 0 ? Math.min(100, Math.round((totalDeliveredUnits / totalContractUnits) * 100)) : 100;

                return (
                  <div
                    key={proj.id}
                    className="bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden"
                  >
                    {/* Project Header Summary */}
                    <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{proj.name}</h4>
                          <span className="font-mono text-[10px] text-teal-700 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                            {proj.projectNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          العميل: <strong className="text-slate-700 dark:text-slate-300">{proj.customerName}</strong> • الموقع: {proj.location}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">المسلم للعميل</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {totalDeliveredUnits} / {totalContractUnits} وحدة ({deliveryPct}%)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">الرصيد المتاح بالموقع</span>
                          <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                            {totalOnHandUnits} وحدة
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Items Breakdown Table */}
                    <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">م</th>
                            <th className="py-2.5 px-3">الوصف والمواصفات الفنية</th>
                            <th className="py-2.5 px-3">الوحدة</th>
                            <th className="py-2.5 px-3 font-mono text-center">الكمية التعاقدية (BOQ)</th>
                            <th className="py-2.5 px-3 font-mono text-center">المستلم من المورد (GRN)</th>
                            <th className="py-2.5 px-3 font-mono text-center">المسلّم للعميل (DN)</th>
                            <th className="py-2.5 px-3 font-mono text-center">الرصيد المتاح بالموقع (On-Hand)</th>
                            <th className="py-2.5 px-3">حالة البند بالموقع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60">
                          {items.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-4 text-center text-slate-400">
                                لا توجد بنود مسجلة لهذا المشروع بعد.
                              </td>
                            </tr>
                          ) : (
                            items.map((it, idx) => (
                              <tr key={it.itemId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">{it.description}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-500">{it.unit}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-center text-slate-700 dark:text-slate-300">{it.contractQty}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-center text-indigo-600 dark:text-indigo-400">{it.receivedFromSuppliers}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-center text-emerald-600 dark:text-emerald-400">{it.deliveredToClient}</td>
                                <td className="py-2.5 px-3 font-mono font-black text-center">
                                  <span className={`px-2 py-0.5 rounded ${it.onHandStock > 0 ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200' : 'text-slate-400'}`}>
                                    {it.onHandStock}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      it.status.includes('مسلّم بالموقع')
                                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200'
                                        : it.status.includes('تسليم جزئي')
                                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    {it.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: SUPPLIER RECEIVING & INSPECTION (GRN / MIR)           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'receiving_grn' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                اختر أمر الشراء للتفتيش والاستلام:
              </span>
              <select
                value={currentPO?.id || ''}
                onChange={(e) => setActivePOId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer max-w-xs"
              >
                {purchaseOrders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.poNumber || `PO-${p.id}`} — {p.supplierName || 'مورد'} ({p.projectName || 'مشروع'})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs font-mono text-teal-600 dark:text-teal-400 font-bold">
              كود الربط المعتمد: PO-2026-509 (SFFECO Saudi Factory)
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  محاضر الفحص والاستلام الموقعي (MIR / GRN Records)
                </h3>
                <p className="text-xs text-slate-500">
                  سجل الاستلام الفعلي بالموقع لأمر الشراء رقم {currentPO?.poNumber || 'PO-2026-509'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold border border-emerald-200">
                  {currentPO?.materialReceipts?.length || 0} محاضر استلام معتمدة
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenNewGRNModal(currentPO?.id)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ إنشاء سند استلام GRN</span>
                </button>
              </div>
            </div>

            <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم المحضر (GRN#)</th>
                    <th className="py-3 px-4">تاريخ الاستلام</th>
                    <th className="py-3 px-4">إشعار تسليم المورد (Supplier DN)</th>
                    <th className="py-3 px-4">مهندس الاستلام الميداني</th>
                    <th className="py-3 px-4">البنود المستلمة</th>
                    <th className="py-3 px-4">حالة الفحص والمطابقة</th>
                    <th className="py-3 px-4 text-center">طباعة GRN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(currentPO?.materialReceipts || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        لا توجد محاضر استلام مسجلة لأمر الشراء هذا بعد.
                      </td>
                    </tr>
                  ) : (
                    (currentPO?.materialReceipts || []).map((mr) => (
                      <tr key={mr.id} className="hover:bg-slate-50/60">
                        <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white">
                          {mr.receiptNumber || 'MR-PO2026509-1'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {mr.receiptDate || mr.receivedDate || '2026-09-15'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {mr.supplierDeliveryNoteNo || 'SFFECO-DN-8812'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                          {mr.receivedBy || 'Eng. Mokhtar Yousef'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {mr.receivedItems?.length || mr.items?.length || 2} بنود فنية
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>فحص معتمد ومطابق لمواصفات الدفاع المدني UL/FM</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedGRNForPrint(mr)}
                            className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="طباعة محضر الاستلام الرسمي"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL 1: CREATE NEW CLIENT DELIVERY NOTE (WITH LIVE CHECK) */}
      {/* ------------------------------------------------------------- */}
      {isNewDNModalOpen && activeSelectedProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    إنشاء سند تسليم بضاعة للعميل (New Client Delivery Note)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    التحقق اللحظي من توفر الرصيد المخزني الفعلي بالموقع قبل اعتماد التسليم
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewDNModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitNewClientDN} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Row 1: Project & Client Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    اختر المشروع المستلم (Project Selection) *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleSelectProjectForNewDN(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.projectNumber}) — {p.customerName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    العميل المستلم (Client / Buyer)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={activeSelectedProject.customerName || 'شركة كامكو للمقاولات'}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300"
                  />
                </div>
              </div>

              {/* Row 2: Location, Date, Receiver, Driver */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاريخ التسليم الفعلي *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDnDate}
                    onChange={(e) => setNewDnDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    موقع التسليم الميداني *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDnLocation}
                    onChange={(e) => setNewDnLocation(e.target.value)}
                    placeholder="موقع الظهران / برج تجاري"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    اسم المستلم المعتمد بالموقع *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDnReceiverName}
                    onChange={(e) => setNewDnReceiverName(e.target.value)}
                    placeholder="م. أحمد السالم (ممثل العميل)"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    رقم هاتف المستلم بالموقع
                  </label>
                  <input
                    type="text"
                    value={newDnReceiverPhone}
                    onChange={(e) => setNewDnReceiverPhone(e.target.value)}
                    placeholder="050xxxxxxx"
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    اسم السائق / الناقل
                  </label>
                  <input
                    type="text"
                    value={newDnDriverName}
                    onChange={(e) => setNewDnDriverName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    رقم لوحة المركبة / الشاحنة
                  </label>
                  <input
                    type="text"
                    value={newDnVehiclePlate}
                    onChange={(e) => setNewDnVehiclePlate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Items Table with Live Stock & Custom Manual Items */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-teal-600" />
                      <span>بنود المشروع والكميات المسلمة (Delivery Items & Quantities)</span>
                    </label>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      حدد الكميات المسلمة للأصناف المسجلة، أو أضف أصنافاً يدوية مباشرة للتوريد
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomDeliveryItem}
                    className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ إضافة صنف / بند يدوي إضافي</span>
                  </button>
                </div>

                {/* Stock Items Table */}
                {availableProjectStockItems.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2.5 px-3">م</th>
                          <th className="py-2.5 px-3">الوصف والمواصفات الفنية</th>
                          <th className="py-2.5 px-3">الوحدة</th>
                          <th className="py-2.5 px-3 text-center">الكمية التعاقدية</th>
                          <th className="py-2.5 px-3 text-center">الرصيد المتاح بالموقع</th>
                          <th className="py-2.5 px-3 w-36 text-center">الكمية المسلمة *</th>
                          <th className="py-2.5 px-3">حالة التوريد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {availableProjectStockItems.map((item, idx) => {
                          const qty = itemQuantitiesToDeliver[item.itemId] || 0;
                          const hasStock = item.onHandStock > 0;

                          return (
                            <tr
                              key={item.itemId}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                            >
                              <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                {item.description}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{item.unit}</td>
                              <td className="py-2.5 px-3 font-mono text-center text-slate-700 dark:text-slate-300">
                                {item.contractQty}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`font-mono font-bold px-2 py-0.5 rounded border text-[11px] ${
                                  hasStock
                                    ? 'text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 border-teal-200 dark:border-teal-800'
                                    : 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}>
                                  {item.onHandStock} {item.unit}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={qty || ''}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value) || 0);
                                      setItemQuantitiesToDeliver((prev) => ({
                                        ...prev,
                                        [item.itemId]: val,
                                      }));
                                    }}
                                    placeholder="0"
                                    className="w-20 text-center font-mono font-bold py-1 px-2 border rounded-lg text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                                  />
                                  {item.onHandStock > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setItemQuantitiesToDeliver((prev) => ({
                                          ...prev,
                                          [item.itemId]: item.onHandStock,
                                        }));
                                      }}
                                      className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline px-1 cursor-pointer font-bold"
                                      title="ملء بأقصى رصيد متاح"
                                    >
                                      الكل
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                {qty > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>جاهز للتسليم ({qty} {item.unit})</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">غير مشمول بالسند</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Custom Added Items Table */}
                {customDeliveryItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>الأصناف المضافة يدوياً للتسليم المباشر:</span>
                      <span className="text-[11px] text-teal-600 font-mono font-bold">
                        {customDeliveryItems.length} بنود مخصصة
                      </span>
                    </div>

                    <div className="space-y-2">
                      {customDeliveryItems.map((cItem, idx) => (
                        <div
                          key={cItem.id}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/80 rounded-xl items-center"
                        >
                          <div className="sm:col-span-1 text-xs font-mono font-bold text-slate-400 text-center">
                            #{idx + 1}
                          </div>
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              required
                              placeholder="وصف البند / الصنف الفني المورد..."
                              value={cItem.description}
                              onChange={(e) =>
                                handleUpdateCustomDeliveryItem(cItem.id, 'description', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              placeholder="الوحدة (متر/حبة..)"
                              value={cItem.unit}
                              onChange={(e) =>
                                handleUpdateCustomDeliveryItem(cItem.id, 'unit', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              min={1}
                              placeholder="الكمية"
                              value={cItem.quantity}
                              onChange={(e) =>
                                handleUpdateCustomDeliveryItem(cItem.id, 'quantity', Number(e.target.value) || 1)
                              }
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-center"
                            />
                          </div>
                          <div className="sm:col-span-2 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomDeliveryItem(cItem.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                              title="حذف البند المخصص"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {availableProjectStockItems.length === 0 && customDeliveryItems.length === 0 && (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                    <Package className="w-8 h-8 text-slate-400 mx-auto" />
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        لا توجد بنود تعاقدية مسجلة مسبقاً لهذا المشروع
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        يمكنك إضافة بنود التسليم يدوياً لتسجيل سند التسليم مباشرة
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomDeliveryItem}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ إضافة صنف يدوي الآن</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  ملاحظات وشروط التسليم
                </label>
                <textarea
                  rows={2}
                  value={newDnNotes}
                  onChange={(e) => setNewDnNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  إجمالي البنود المحددة للتسليم: <strong className="text-teal-600 dark:text-teal-400 font-mono">{totalDeliverableItemsCount} صنف</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewDNModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={totalDeliverableItemsCount === 0}
                    className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition ${
                      totalDeliverableItemsCount === 0
                        ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>اعتماد وإصدار سند التسليم (Issue DN)</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL 2: DN-TO-BILLING TAX INVOICE & GENERAL LEDGER EFFECT  */}
      {/* ------------------------------------------------------------- */}
      {selectedDNForInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    ترحيل سند تسليم رقم {selectedDNForInvoice.dnNumber} إلى فاتورة ضريبية رسمية
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    التسليم يقود الفوترة: ترحيل فوري للقيود المحاسبية بالدفتر العام لشركة {selectedDNForInvoice.customerName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDNForInvoice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Client & Project Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">العميل المستحق عليه:</span>
                  <strong className="text-slate-900 dark:text-white">{selectedDNForInvoice.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">المشروع:</span>
                  <strong className="text-slate-900 dark:text-white">{selectedDNForInvoice.projectName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">سند التسليم المرجعي:</span>
                  <strong className="font-mono text-teal-600">{selectedDNForInvoice.dnNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">تاريخ التسليم بالموقع:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedDNForInvoice.date}</span>
                </div>
              </div>

              {/* Invoice Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاريخ الفاتورة الضريبية *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    تاريخ استحقاق التحصيل (Due Date) *
                  </label>
                  <input
                    type="date"
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Delivered Items Transferred from DN */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  البنود المسلمة المحولة تلقائياً من سند التسليم للفوترة
                </span>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">م</th>
                        <th className="py-2.5 px-3">الوصف الفني</th>
                        <th className="py-2.5 px-3 text-center">الكمية المسلمة</th>
                        <th className="py-2.5 px-3 text-center">سعر الوحدة التعاقدي (ر.س)</th>
                        <th className="py-2.5 px-3 text-left">الإجمالي الخاضع للضريبة (ر.س)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(selectedDNForInvoice.items || []).map((it, idx) => {
                        const rate = invoiceItemRates[it.id] !== undefined ? invoiceItemRates[it.id] : (it.unitPrice || 0);
                        const lineTotal = (it.deliveredQty || 0) * rate;

                        return (
                          <tr key={it.id || idx}>
                            <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{it.description}</td>
                            <td className="py-2 px-3 font-mono font-bold text-center text-teal-700 dark:text-teal-400">
                              {it.deliveredQty} {it.unit}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                value={rate}
                                onChange={(e) => {
                                  const v = Number(e.target.value) || 0;
                                  setInvoiceItemRates((prev) => ({ ...prev, [it.id]: v }));
                                }}
                                className="w-24 text-center font-mono py-1 px-2 border border-slate-200 dark:border-slate-700 rounded text-xs bg-white dark:bg-slate-800 font-bold"
                              />
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-left text-slate-900 dark:text-white">
                              {lineTotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">المجموع قبل الضريبة (Subtotal):</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">{invoiceFinancials.subtotal.toLocaleString()} ر.س</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">ضريبة القيمة المضافة (15% VAT):</span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200">{invoiceFinancials.vatAmount.toLocaleString()} ر.س</strong>
                  </div>
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-r border-slate-200 dark:border-slate-700 pt-2 sm:pt-0 sm:pr-4">
                  <span className="text-[11px] text-slate-400 font-medium block">صافي الفاتورة الإجمالي شامل الضريبة</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {invoiceFinancials.grandTotal.toLocaleString()} <span className="text-xs font-sans">ر.س</span>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* REQUIREMENT 4: ACCOUNTING & GENERAL LEDGER EFFECT (DOUBLE ENTRY) */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-700/80 shadow-lg space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white tracking-wide">
                      الأثر المالي وقيد اليومية المحاسبي التلقائي (General Ledger Impact)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    KSA GAAP / ZATCA Standard
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  {/* Debit Line */}
                  <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-950/80 rounded text-[10px]">
                        مدين (Debit)
                      </span>
                      <span className="text-slate-200">
                        1101 - حـ/ العملاء - ذمم مدينة ({selectedDNForInvoice.customerName})
                      </span>
                    </div>
                    <span className="font-bold text-emerald-300">
                      {invoiceFinancials.grandTotal.toLocaleString()} ر.س
                    </span>
                  </div>

                  {/* Credit Line 1: Revenue */}
                  <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span className="text-sky-400 font-bold px-1.5 py-0.5 bg-sky-950/80 rounded text-[10px]">
                        دائن (Credit)
                      </span>
                      <span className="text-slate-200">
                        4101 - حـ/ إيرادات المشاريع والتوريدات (Project Revenue)
                      </span>
                    </div>
                    <span className="font-bold text-sky-300">
                      {invoiceFinancials.subtotal.toLocaleString()} ر.س
                    </span>
                  </div>

                  {/* Credit Line 2: VAT Output */}
                  <div className="flex items-center justify-between bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span className="text-sky-400 font-bold px-1.5 py-0.5 bg-sky-950/80 rounded text-[10px]">
                        دائن (Credit)
                      </span>
                      <span className="text-slate-200">
                        2105 - حـ/ ضريبة القيمة المضافة للمخرجات (15% Output VAT)
                      </span>
                    </div>
                    <span className="font-bold text-sky-300">
                      {invoiceFinancials.vatAmount.toLocaleString()} ر.س
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-sans mt-1">
                  التوجيه المحاسبي: إثبات استحقاق فوترة تسليم بضاعة بالموقع بموجب سند التسليم المعتمد رقم{' '}
                  <strong className="text-slate-300">{selectedDNForInvoice.dnNumber}</strong> وتحديث أرصدة العملاء والضريبة فورياً.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <span className="text-xs text-slate-500">
                سيتم تحويل حالة سند التسليم إلى: <strong className="text-emerald-600">تمت الفوترة (Invoiced)</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDNForInvoice(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={handleApproveAndPostInvoice}
                  className="px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>اعتماد وترحيل الفاتورة للدفاتر المحاسبية (Approve & Post)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL 3: OFFICIAL PRINTABLE CLIENT DELIVERY SLIP           */}
      {/* ------------------------------------------------------------- */}
      {printableSlipDN && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Top Bar (No Print) */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                معاينة وطباعة سند التسليم المعتمد: {printableSlipDN.dnNumber}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    executePrint('client-dn-printable-slip', {
                      documentTitle: `سند تسليم بضاعة للعميل - ${printableSlipDN.dnNumber}`,
                    });
                  }}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة السند الرسمي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintableSlipDN(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
              <div
                id="client-dn-printable-slip"
                className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-lg w-full max-w-2xl space-y-6"
                dir="rtl"
              >
                {/* Official Letterhead */}
                <div className="flex items-start justify-between border-b-2 border-[#174A84] pb-4">
                  <div className="flex items-center gap-3">
                    <CompanyLogo className="h-12 w-auto object-contain" />
                    <div>
                      <h2 className="text-base font-black text-[#174A84]">مؤسسة صناع الموارد التجارية</h2>
                      <div className="text-[11px] text-slate-500">RMT - Resources Makers Trading Est.</div>
                      <div className="text-[10px] text-slate-400 font-mono">س.ت: 2050123456 • الرقم الضريبي: 310498721500003</div>
                    </div>
                  </div>

                  <div className="text-left font-mono text-xs">
                    <div className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded font-bold text-center mb-1">
                      سند تسليم بضاعة للعميل
                    </div>
                    <div>رقم السند: <strong>{printableSlipDN.dnNumber}</strong></div>
                    <div className="text-slate-500">التاريخ: {printableSlipDN.date}</div>
                  </div>
                </div>

                {/* Delivery Information Block */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[10px]">العميل المستلم:</span>
                    <strong className="text-sm font-bold text-slate-900">{printableSlipDN.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">المشروع:</span>
                    <strong className="text-sm font-bold text-slate-900">{printableSlipDN.projectName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">موقع التسليم الميداني:</span>
                    <span className="text-slate-800 font-medium">{printableSlipDN.deliveryLocation}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">اسم السائق / رقم اللوحة:</span>
                    <span className="text-slate-800 font-mono">{printableSlipDN.driverOrCarrier || 'سائق المؤسسة'} ({printableSlipDN.vehiclePlateNo || 'د ص ر 9821'})</span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <tr>
                        <th className="py-2.5 px-3">م</th>
                        <th className="py-2.5 px-3">الوصف والمواصفات الفنية للبضاعة</th>
                        <th className="py-2.5 px-3">الوحدة</th>
                        <th className="py-2.5 px-3 text-center">الكمية المسلمة</th>
                        <th className="py-2.5 px-3">حالة المطابقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(printableSlipDN.items || []).map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{it.description}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{it.unit}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-center text-teal-800 text-sm">
                            {it.deliveredQty}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-emerald-700 font-bold">
                            مطابق للمواصفات
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>ملاحظات التسليم:</strong> {printableSlipDN.notes || 'تمت معاينة البضاعة ومطابقة المواصفات الفنية والكميات في الموقع واستلامها بحالة سليمة.'}
                </div>

                {/* DUAL SIGNATURES BLOCK */}
                <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs">
                  {/* Right: Dispatched By */}
                  <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-200">
                    <div className="font-bold text-[#174A84] border-b border-slate-200 pb-1.5 flex items-center justify-between">
                      <span>سُلّم بواسطة (Dispatched By)</span>
                      <span className="text-[10px] text-slate-400">مؤسسة صناع الموارد</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الاسم:</span>
                      <strong>{printableSlipDN.dispatchedByName || 'Medhat Al Brahim'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الصفة:</span>
                      <span>مسؤول المستودع والتوريد الميداني</span>
                    </div>
                    <div className="pt-6">
                      <div className="border-b border-dashed border-slate-400 w-36 mb-1" />
                      <span className="text-[10px] text-slate-400">التوقيع والختم المعتمد</span>
                    </div>
                  </div>

                  {/* Left: Received By */}
                  <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-200">
                    <div className="font-bold text-teal-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                      <span>استُلِم بواسطة (Received By)</span>
                      <span className="text-[10px] text-slate-400">ممثل العميل المعتمد</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الاسم:</span>
                      <strong>{printableSlipDN.recipientName || 'المهندس المشرف بالموقع'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الجهة / الشركة:</span>
                      <span>{printableSlipDN.customerName}</span>
                    </div>
                    <div className="pt-6">
                      <div className="border-b border-dashed border-slate-400 w-36 mb-1" />
                      <span className="text-[10px] text-slate-400">التوقيع وخاتم استلام الموقع</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. MODAL 4: VIEW DELIVERY NOTE DETAILS                         */}
      {/* ------------------------------------------------------------- */}
      {selectedDNForView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  تفاصيل مذكرة التسليم: {selectedDNForView.dnNumber}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintableSlipDN(selectedDNForView)}
                  className="px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة السند</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDNForView(null)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">المشروع:</span>
                  <strong className="text-slate-900 dark:text-white">{selectedDNForView.projectName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">العميل المستلم:</span>
                  <strong className="text-slate-900 dark:text-white">{selectedDNForView.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">موقع التسليم:</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedDNForView.deliveryLocation}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">المستلم:</span>
                  <strong className="text-teal-700 dark:text-teal-400">{selectedDNForView.recipientName}</strong>
                </div>
              </div>

              <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">م</th>
                      <th className="py-2.5 px-3">الوصف والمواصفات</th>
                      <th className="py-2.5 px-3">الوحدة</th>
                      <th className="py-2.5 px-3 font-mono text-center">الكمية المسلمة</th>
                      <th className="py-2.5 px-3 text-left">السعر التقديري (ر.س)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(selectedDNForView.items || []).map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">{it.description}</td>
                        <td className="py-2 px-3 font-mono text-slate-500">{it.unit}</td>
                        <td className="py-2 px-3 font-mono font-bold text-center text-teal-700 dark:text-teal-400">
                          {it.deliveredQty}
                        </td>
                        <td className="py-2 px-3 font-mono text-left text-slate-700 dark:text-slate-300">
                          {((it.deliveredQty || 0) * (it.unitPrice || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedDNForView.invoicedStatus !== 'Fully Invoiced' && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDNForView(null);
                      handleOpenBillingPipelineForDN(selectedDNForView);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>الانتقال لترحيل هذا السند إلى فاتورة ضريبية رسمية</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ------------------------------------------------------------- */}
      {/* 10. MODAL 5: CREATE NEW GOODS RECEIPT NOTE (GRN / MIR)        */}
      {/* ------------------------------------------------------------- */}
      {isNewGRNModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    إنشاء وتسجيل سند استلام وفحص مواد ميداني (New GRN / MIR)
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    توثيق توريدات الموردين بالموقع، تحديث رصيد المستودع الميداني، والتحقق الفني
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewGRNModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmitNewGRN} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* PO Selection & Overview */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  اختر أمر الشراء الصادر للمورد (Target PO) *
                </label>
                <select
                  value={grnSelectedPOId}
                  onChange={(e) => handleSelectPOForGRN(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  {purchaseOrders.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.poNumber || `PO-${po.id}`} — {po.supplierName || 'مورد'} | {po.projectName || 'مشروع'} (قيمة العقد: {po.grandTotal?.toLocaleString() || 0} ر.س)
                    </option>
                  ))}
                </select>
              </div>

              {/* GRN Parameters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    رقم سند الاستلام (GRN #) *
                  </label>
                  <input
                    type="text"
                    required
                    value={grnReceiptNumber}
                    onChange={(e) => setGrnReceiptNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-teal-700 dark:text-teal-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    تاريخ الاستلام الفعلي بالموقع *
                  </label>
                  <input
                    type="date"
                    required
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    رقم إشعار / بوليصة تسليم المورد (Supplier DN #)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: DN-SF-9912"
                    value={grnSupplierDN}
                    onChange={(e) => setGrnSupplierDN(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    مهندس الاستلام الميداني / الفاحص *
                  </label>
                  <input
                    type="text"
                    required
                    value={grnReceiverName}
                    onChange={(e) => setGrnReceiverName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    وجهة ومكان التوريد
                  </label>
                  <select
                    value={grnDestination}
                    onChange={(e) => setGrnDestination(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    <option value="direct_site">توريد مباشر لموقع المشروع (Direct Site)</option>
                    <option value="central_warehouse">إيداع مستودع RMT المركزي (Central Stock)</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    موقع التشوين / التخزين الميداني
                  </label>
                  <input
                    type="text"
                    value={grnStorageLocation}
                    onChange={(e) => setGrnStorageLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    placeholder="مثال: مستودع الموقع الميداني - Zone B"
                  />
                </div>
              </div>

              {/* Items Verification Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    بنود أمر الشراء والكميات المستلمة في هذا المحضر
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const targetPO = purchaseOrders.find((p) => p.id === grnSelectedPOId);
                      if (targetPO) {
                        const allQtys: Record<string, number> = {};
                        (targetPO.items || []).forEach((it) => {
                          const remaining = Math.max(0, it.quantity - (it.deliveredQty || 0));
                          allQtys[it.id] = remaining;
                        });
                        setGrnReceivedQuantities(allQtys);
                      }
                    }}
                    className="text-[11px] font-bold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>استلام كامل الكميات المتبقية</span>
                  </button>
                </div>

                {(() => {
                  const targetPO = purchaseOrders.find((p) => p.id === grnSelectedPOId);
                  const items = targetPO?.items || [];
                  if (items.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                        لا توجد بنود مسجلة في أمر الشراء المحدد.
                      </div>
                    );
                  }

                  return (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">م</th>
                            <th className="py-2.5 px-3">الوصف الفني للبند</th>
                            <th className="py-2.5 px-3 text-center">الوحدة</th>
                            <th className="py-2.5 px-3 text-center">الكمية بأمر الشراء</th>
                            <th className="py-2.5 px-3 text-center">المستلم سابقاً</th>
                            <th className="py-2.5 px-3 text-center">المتبقي</th>
                            <th className="py-2.5 px-3 text-center bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 font-bold">
                              المستلم الآن (GRN Qty)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {items.map((it, idx) => {
                            const prevDelivered = it.deliveredQty || 0;
                            const remaining = Math.max(0, it.quantity - prevDelivered);
                            const currentInput = grnReceivedQuantities[it.id] !== undefined ? grnReceivedQuantities[it.id] : remaining;

                            return (
                              <tr key={it.id || idx} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-mono text-slate-400">{it.itemNo || idx + 1}</td>
                                <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {it.description}
                                </td>
                                <td className="py-2 px-3 font-mono text-center text-slate-500">{it.unit}</td>
                                <td className="py-2 px-3 font-mono text-center font-bold text-slate-700 dark:text-slate-300">
                                  {it.quantity}
                                </td>
                                <td className="py-2 px-3 font-mono text-center text-slate-500">
                                  {prevDelivered}
                                </td>
                                <td className="py-2 px-3 font-mono text-center text-amber-600 font-bold">
                                  {remaining}
                                </td>
                                <td className="py-2 px-3 text-center bg-teal-50/40 dark:bg-teal-950/20">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={remaining > 0 ? remaining : undefined}
                                      value={currentInput}
                                      onChange={(e) => {
                                        const v = Number(e.target.value) || 0;
                                        setGrnReceivedQuantities((prev) => ({
                                          ...prev,
                                          [it.id]: v,
                                        }));
                                      }}
                                      className="w-20 text-center font-mono py-1 px-2 border border-teal-300 dark:border-teal-700 rounded-lg text-xs bg-white dark:bg-slate-800 font-bold text-teal-800 dark:text-teal-300 focus:ring-2 focus:ring-teal-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setGrnReceivedQuantities((prev) => ({
                                          ...prev,
                                          [it.id]: remaining,
                                        }));
                                      }}
                                      className="text-[10px] px-1.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-teal-100 text-slate-600 hover:text-teal-700 font-bold transition cursor-pointer"
                                      title="استلام كامل المتبقي لهذا البند"
                                    >
                                      الكل
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Quality & Inspection Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    نتيجة الفحص الفني والمطابقة الموقعية
                  </label>
                  <input
                    type="text"
                    value={grnQualityStatus}
                    onChange={(e) => setGrnQualityStatus(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ملاحظات الاستلام والمحضر الفني
                  </label>
                  <input
                    type="text"
                    value={grnNotes}
                    onChange={(e) => setGrnNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsNewGRNModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ واعتماد محضر الاستلام الميداني (Issue GRN)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 11. MODAL 6: OFFICIAL PRINTABLE GOODS RECEIPT SLIP (GRN / MIR) */}
      {/* ------------------------------------------------------------- */}
      {selectedGRNForPrint && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Action Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold">
                  محضر فحص واستلام بضائع وتوريدات ميدانية (GRN / MIR #{selectedGRNForPrint.receiptNumber})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    executePrint('grn-official-slip-document', {
                      documentTitle: `محضر استلام بضائع - ${selectedGRNForPrint.receiptNumber}`,
                    });
                  }}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة المحضر الرسمي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedGRNForPrint(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-900">
              <div id="grn-official-slip-document" className="space-y-6 max-w-3xl mx-auto">
                {/* Header Profile */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">مؤسسة صناع الموارد للتجارة</h2>
                    <p className="text-xs text-slate-600">أنظمة ومعدات الإطفاء والإنذار والسلامة ومقاولات الإلكتروميكانيك</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">سجل تجاري: 2050117466 | الرقم الضريبي: 310498721500003</p>
                  </div>
                  <div className="text-left">
                    <span className="inline-block px-3 py-1 bg-teal-800 text-white text-xs font-bold rounded">
                      محضر استلام وتفتيش مواد (GRN)
                    </span>
                    <p className="text-xs font-mono font-bold mt-1 text-slate-800">
                      {selectedGRNForPrint.receiptNumber}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      التاريخ: {selectedGRNForPrint.receiptDate || selectedGRNForPrint.receivedDate}
                    </p>
                  </div>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">المشروع المرتبط:</span>
                    <strong className="text-sm font-bold text-slate-900">{selectedGRNForPrint.projectName || 'مشروع الموقع'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">المورد / المصنع المورد:</span>
                    <strong className="text-sm font-bold text-slate-900">{selectedGRNForPrint.vendorName || 'المورد المعتمد'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">أمر الشراء المرجعي (PO Ref):</span>
                    <strong className="font-mono text-teal-700">{selectedGRNForPrint.poNumber || 'PO-2026-509'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">رقم بوليصة / إشعار تسليم المورد:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedGRNForPrint.supplierDeliveryNoteNo || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">مهندس الاستلام الميداني:</span>
                    <strong className="text-slate-800">{selectedGRNForPrint.receivedBy || 'Eng. Mokhtar Yousef'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">وجهة التوريد:</span>
                    <span className="font-medium text-slate-800">
                      {selectedGRNForPrint.destinationTag === 'central_warehouse'
                        ? 'إيداع مستودع RMT المركزي'
                        : 'توريد مباشر لموقع المشروع'}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="w-full overflow-x-auto rounded-xl border border-slate-300 shadow-xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="py-2.5 px-3">م</th>
                        <th className="py-2.5 px-3">الوصف والمواصفات الفنية للبضاعة</th>
                        <th className="py-2.5 px-3 text-center">الوحدة</th>
                        <th className="py-2.5 px-3 text-center">الكمية المطلوبة (PO)</th>
                        <th className="py-2.5 px-3 text-center bg-teal-100/70 text-teal-900 font-black">الكمية المستلمة</th>
                        <th className="py-2.5 px-3">حالة الفحص والمطابقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(selectedGRNForPrint.receivedItems || selectedGRNForPrint.items || []).map((it: any, idx: number) => (
                        <tr key={it.poItemId || it.id || idx}>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{it.itemNo || idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{it.description}</td>
                          <td className="py-2.5 px-3 font-mono text-center text-slate-600">{it.unit}</td>
                          <td className="py-2.5 px-3 font-mono text-center text-slate-600">{it.orderedQty || it.orderedQuantity || '-'}</td>
                          <td className="py-2.5 px-3 font-mono font-black text-center text-teal-900 text-sm bg-teal-50/50">
                            {it.receivedQty || it.receivedQuantity}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-emerald-700 font-bold">
                            مطابق للمواصفات UL/FM
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>ملاحظات الفحص والاستلام:</strong> {selectedGRNForPrint.notes || 'تمت مطابقة المواصفات الفنية والكميات في الموقع واستلامها بحالة سليمة.'}
                </div>

                {/* DUAL SIGNATURES BLOCK */}
                <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs">
                  {/* Right: Supplier / Driver */}
                  <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                      <span>سُلّم بواسطة (مندوب / سائق المورد)</span>
                      <span className="text-[10px] text-slate-400">{selectedGRNForPrint.vendorName || 'المورد'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الاسم:</span>
                      <div className="border-b border-dashed border-slate-400 w-44 mt-3" />
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">رقم الهوية / الجوال:</span>
                      <div className="border-b border-dashed border-slate-400 w-44 mt-3" />
                    </div>
                    <div className="pt-4">
                      <span className="text-[10px] text-slate-400">التوقيع:</span>
                      <div className="border-b border-dashed border-slate-400 w-44 mt-2" />
                    </div>
                  </div>

                  {/* Left: Site Receiving QA Engineer */}
                  <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-200">
                    <div className="font-bold text-teal-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                      <span>استُلِم وفُحص بواسطة (مهندس الموقع)</span>
                      <span className="text-[10px] text-slate-400">مؤسسة صناع الموارد</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الاسم:</span>
                      <strong>{selectedGRNForPrint.receivedBy || 'Eng. Mokhtar Yousef'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">الصفة:</span>
                      <span>مهندس التوريد والمطابقة الميدانية</span>
                    </div>
                    <div className="pt-4">
                      <span className="text-[10px] text-slate-400">التوقيع والختم الفني:</span>
                      <div className="border-b border-dashed border-slate-400 w-44 mt-2" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteLogisticsHub;
