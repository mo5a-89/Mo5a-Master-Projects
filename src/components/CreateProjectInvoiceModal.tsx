import React, { useState, useEffect, useMemo } from 'react';
import { Project, CustomerQuotation, DeliveryNote, Invoice, InvoiceItem, PurchaseOrder } from '../types';
import { getNextInvoiceNumber } from '../utils/invoiceUtils';
import { resolvePositiveUnitRate, assertValidInvoicePosting, validateInvoiceForPosting } from '../services/financialPipeline';
import { validateInvoiceSubmission } from '../logic/Gatekeepers';
import { postInvoiceEntry } from '../services/ledgerService';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  Receipt,
  X,
  Check,
  Edit3,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  DollarSign,
  Calendar,
  Truck,
  Layers,
  FileCheck,
  Info,
  Lock,
} from 'lucide-react';

interface CreateProjectInvoiceModalProps {
  project: Project;
  activeQuotation?: CustomerQuotation;
  existingInvoices?: Invoice[];
  deliveryNotes?: DeliveryNote[];
  purchaseOrders?: PurchaseOrder[];
  initialSelectedDeliveryNoteIds?: string[];
  onClose: () => void;
  onSaveInvoice: (invoice: Invoice) => void;
}

export const CreateProjectInvoiceModal: React.FC<CreateProjectInvoiceModalProps> = ({
  project,
  activeQuotation,
  existingInvoices = [],
  deliveryNotes = [],
  purchaseOrders = [],
  initialSelectedDeliveryNoteIds = [],
  onClose,
  onSaveInvoice,
}) => {
  const nextInvoiceNumber = getNextInvoiceNumber(project, existingInvoices);

  // Available delivery notes strictly belonging to this project context
  const projectDeliveryNotes = useMemo(() => {
    return (deliveryNotes || []).filter(
      (dn) =>
        dn.projectId === project.id ||
        (project.projectNumber && dn.projectNumber === project.projectNumber) ||
        (initialSelectedDeliveryNoteIds && initialSelectedDeliveryNoteIds.includes(dn.id))
    );
  }, [deliveryNotes, project.id, project.projectNumber, initialSelectedDeliveryNoteIds]);

  // Selected delivery note IDs for invoicing
  const [selectedDnIds, setSelectedDnIds] = useState<string[]>(() => {
    if (initialSelectedDeliveryNoteIds && initialSelectedDeliveryNoteIds.length > 0) {
      return initialSelectedDeliveryNoteIds;
    }
    // If there are uninvoiced delivery notes for this project, default to none or the single one
    const uninvoiced = projectDeliveryNotes.filter((dn) => dn.invoicedStatus !== 'Fully Invoiced');
    if (uninvoiced.length === 1) {
      return [uninvoiced[0].id];
    }
    return [];
  });

  const [invoiceNumber, setInvoiceNumber] = useState(nextInvoiceNumber);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Calculate default PO / DN reference text
  const computeDefaultPoRef = (dnIds: string[]) => {
    const chosenDns = projectDeliveryNotes.filter((dn) => dnIds.includes(dn.id));
    const dnNumbers = chosenDns.map((dn) => dn.dnNumber).filter(Boolean);
    const parts: string[] = [];

    if (project.clientContractPO?.clientPONumber) {
      parts.push(`أمر شراء: ${project.clientContractPO.clientPONumber}`);
    }

    if (dnNumbers.length === 1) {
      parts.push(`سند تسليم: ${dnNumbers[0]}`);
    } else if (dnNumbers.length > 1) {
      parts.push(`سندات تسليم: ${dnNumbers.join('، ')}`);
    }

    return parts.join(' | ');
  };

  const [poReference, setPoReference] = useState(() => computeDefaultPoRef(selectedDnIds));
  const [notes, setNotes] = useState(
    'شاملة ضريبة القيمة المضافة 15%. يُرجى سداد المبلغ بموجب التحويل البنكي لحساب المؤسسة المعتمد.'
  );

  // Manual Edit Mode toggle
  const [isEditMode, setIsEditMode] = useState(false);

  // Prior invoices lookup for quantity reconciliation & remaining unbilled balance
  const priorInvoices = useMemo(() => {
    return (existingInvoices || []).filter(
      (inv) => inv.projectId === project.id && inv.status !== 'Draft'
    );
  }, [existingInvoices, project.id]);

  const priorBilledQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    priorInvoices.forEach((inv) => {
      (inv.items || []).forEach((invIt) => {
        const k1 = invIt.sourceItemId;
        const k2 = invIt.description ? invIt.description.trim().toLowerCase() : '';
        if (k1) map[k1] = (map[k1] || 0) + (invIt.quantity || 0);
        if (k2) map[k2] = (map[k2] || 0) + (invIt.quantity || 0);
      });
    });
    return map;
  }, [priorInvoices]);

  // Quotation items
  const quoteItems = activeQuotation?.items || [];
  const clientContractPO = project.clientContractPO;
  const hasClientPO = Boolean(clientContractPO && (clientContractPO.contractValue > 0 || clientContractPO.grandTotal > 0));

  // Items State: item state includes selected, qty, unitPrice, description, unit, dnRef, pricing lineage
  interface ItemState {
    id: string;
    sourceItemId: string;
    itemNo: number;
    selected: boolean;
    quantity: number;
    unitPrice: number;
    description: string;
    unit: string;
    contractRate?: number; // Official approved Client PO contract rate
    priceSource: 'client_po' | 'delivery_note' | 'quotation' | 'manual';
    clientPoItemNo?: number;
    originalQuoteRate?: number;
    costPrice?: number;
    deliveryNoteRef?: string;
    isDelivered?: boolean;
  }

  // Master Contract Cap & Prior Billing calculation for fallback scaling
  const masterContractCap = hasClientPO
    ? (clientContractPO!.grandTotal || clientContractPO!.contractValue * 1.15)
    : (activeQuotation?.totals?.grandTotalWithVat || activeQuotation?.totals?.customerSellingPrice || 0);

  const priorBilledGrandTotal = priorInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalBilledRatio = masterContractCap > 0 ? Math.min(1, priorBilledGrandTotal / masterContractCap) : 0;
  const remainingRatio = Math.max(0, 1 - totalBilledRatio);

  // Generate initial items state based on selected Delivery Notes or Quotation with strict Client PO master alignment & prior billing subtraction
  const generateItemsMap = (chosenDnIds: string[]): Record<string, ItemState> => {
    const chosenDns = projectDeliveryNotes.filter((dn) => chosenDnIds.includes(dn.id));
    const map: Record<string, ItemState> = {};

    if (chosenDns.length > 0) {
      // Build items strictly from selected Delivery Notes, aligning unit prices to the Master Client PO
      let itemCounter = 1;

      chosenDns.forEach((dn) => {
        (dn.items || []).forEach((dni) => {
          // Strict relational lookup by sourceItemId or item description against Client PO
          const matchedContractItem = (clientContractPO?.items || []).find(
            (ci) =>
              ci.id === dni.sourceItemId ||
              (ci.sourceItemId && ci.sourceItemId === dni.sourceItemId) ||
              ci.description.trim().toLowerCase() === dni.description.trim().toLowerCase() ||
              (ci.itemNo === dni.itemNo && ci.quantity === dni.orderedQty)
          );

          // Lookup in Quotation by strict sourceItemId
          const matchedQuoteItem = dni.sourceItemId
            ? quoteItems.find((qi) => qi.id === dni.sourceItemId)
            : quoteItems.find(
                (qi) => qi.description.trim().toLowerCase() === dni.description.trim().toLowerCase()
              );

          // Lookup in Purchase Orders for cost tracking
          let matchedCostPrice = matchedQuoteItem?.supplierUnitPrice || 0;
          if (purchaseOrders && purchaseOrders.length > 0) {
            for (const po of purchaseOrders) {
              const poi = (po.items || []).find((pi) => pi.id === dni.sourceItemId);
              if (poi && poi.unitPrice > 0) {
                matchedCostPrice = poi.unitPrice;
                break;
              }
            }
          }

          // Strict Master Contract Pricing Resolution:
          let approvedPrice = 0;
          let priceSource: ItemState['priceSource'] = 'quotation';

          if (matchedContractItem && matchedContractItem.unitPrice > 0) {
            approvedPrice = matchedContractItem.unitPrice;
            priceSource = 'client_po';
          } else if (dni.unitPrice && dni.unitPrice > 0) {
            approvedPrice = dni.unitPrice;
            priceSource = 'delivery_note';
          } else if (matchedQuoteItem && matchedQuoteItem.sellingUnitPrice > 0) {
            approvedPrice = matchedQuoteItem.sellingUnitPrice;
            priceSource = 'quotation';
          } else if (matchedCostPrice > 0) {
            approvedPrice = Math.round(matchedCostPrice * 1.3);
            priceSource = 'manual';
          }

          const normalizedDesc = (dni.description || '').trim();
          const normalizedUnit = (dni.unit || 'EA').trim().toUpperCase();
          const key = dni.sourceItemId
            ? `source-${dni.sourceItemId}`
            : `desc-${encodeURIComponent(normalizedDesc)}-${normalizedUnit}`;

          // Subtract prior billed quantity for this item/source or if DN is already fully invoiced
          const isDnAlreadyBilled = priorInvoices.some(
            (inv) => inv.sourceDeliveryNoteIds && inv.sourceDeliveryNoteIds.includes(dn.id)
          );
          let alreadyBilled = isDnAlreadyBilled
            ? (dni.deliveredQty || 0)
            : (priorBilledQtyMap[dni.sourceItemId || ''] || priorBilledQtyMap[normalizedDesc.toLowerCase()] || priorBilledQtyMap[dni.id || ''] || 0);
          
          let remainingDeliveryQty = Math.max(0, (dni.deliveredQty || 0) - alreadyBilled);
          if (alreadyBilled === 0 && totalBilledRatio > 0 && totalBilledRatio < 1 && priorInvoices.length > 0) {
            remainingDeliveryQty = Number(((dni.deliveredQty || 0) * remainingRatio).toFixed(2));
          }
          if (priorBilledGrandTotal >= masterContractCap) {
            remainingDeliveryQty = 0;
          }

          if (map[key] && map[key].description.trim() === normalizedDesc) {
            map[key].quantity += remainingDeliveryQty;
            if (remainingDeliveryQty > 0) {
              map[key].selected = true;
            }
            if (map[key].deliveryNoteRef && !map[key].deliveryNoteRef?.includes(dn.dnNumber)) {
              map[key].deliveryNoteRef += `، ${dn.dnNumber}`;
            }
          } else {
            map[key] = {
              id: key,
              sourceItemId: dni.sourceItemId || key,
              itemNo: itemCounter++,
              selected: remainingDeliveryQty > 0,
              quantity: remainingDeliveryQty,
              unitPrice: Number(approvedPrice) || 0,
              description: dni.description,
              unit: dni.unit || matchedContractItem?.unit || matchedQuoteItem?.unit || 'EA',
              contractRate: matchedContractItem?.unitPrice,
              priceSource,
              clientPoItemNo: matchedContractItem?.itemNo,
              originalQuoteRate: matchedQuoteItem?.sellingUnitPrice,
              costPrice: matchedCostPrice,
              deliveryNoteRef: dn.dnNumber,
              isDelivered: true,
            };
          }
        });
      });
    } else {
      // Direct Project Invoicing (No Delivery Note Selected)
      if (hasClientPO && clientContractPO?.items && clientContractPO.items.length > 0) {
        clientContractPO.items.forEach((cpi, idx) => {
          const matchedQuoteItem = cpi.sourceItemId
            ? quoteItems.find((qi) => qi.id === cpi.sourceItemId)
            : quoteItems.find(
                (qi) => qi.description.trim().toLowerCase() === cpi.description.trim().toLowerCase()
              );

          const costPrice = matchedQuoteItem?.supplierUnitPrice || 0;
          let alreadyBilled = priorBilledQtyMap[cpi.sourceItemId || ''] || priorBilledQtyMap[cpi.id] || priorBilledQtyMap[cpi.description.trim().toLowerCase()] || 0;
          let remainingQty = Math.max(0, (cpi.quantity || 1) - alreadyBilled);
          
          if (alreadyBilled === 0 && totalBilledRatio > 0 && totalBilledRatio < 1 && priorInvoices.length > 0) {
            remainingQty = Number(((cpi.quantity || 1) * remainingRatio).toFixed(2));
          }
          if (priorBilledGrandTotal >= masterContractCap) {
            remainingQty = 0;
          }

          map[cpi.id] = {
            id: cpi.id,
            sourceItemId: cpi.sourceItemId || cpi.id,
            itemNo: cpi.itemNo || idx + 1,
            selected: remainingQty > 0,
            quantity: remainingQty,
            unitPrice: cpi.unitPrice || 0,
            description: cpi.description,
            unit: cpi.unit || 'EA',
            contractRate: cpi.unitPrice,
            priceSource: 'client_po',
            clientPoItemNo: cpi.itemNo,
            originalQuoteRate: matchedQuoteItem?.sellingUnitPrice,
            costPrice,
            deliveryNoteRef: undefined,
            isDelivered: false,
          };
        });
      } else {
        quoteItems.forEach((it, idx) => {
          let alreadyBilled = priorBilledQtyMap[it.id] || priorBilledQtyMap[it.description.trim().toLowerCase()] || 0;
          let remainingQty = Math.max(0, (it.quantity || 1) - alreadyBilled);

          if (alreadyBilled === 0 && totalBilledRatio > 0 && totalBilledRatio < 1 && priorInvoices.length > 0) {
            remainingQty = Number(((it.quantity || 1) * remainingRatio).toFixed(2));
          }
          if (priorBilledGrandTotal >= masterContractCap) {
            remainingQty = 0;
          }

          map[it.id] = {
            id: it.id,
            sourceItemId: it.id,
            itemNo: it.itemNo || idx + 1,
            selected: remainingQty > 0,
            quantity: remainingQty,
            unitPrice: it.sellingUnitPrice || it.supplierUnitPrice || 0,
            description: it.description,
            unit: it.unit || 'EA',
            contractRate: undefined,
            priceSource: 'quotation',
            originalQuoteRate: it.sellingUnitPrice,
            costPrice: it.supplierUnitPrice,
            deliveryNoteRef: undefined,
            isDelivered: false,
          };
        });
      }
    }

    return map;
  };

  const [itemsState, setItemsState] = useState<Record<string, ItemState>>(() =>
    generateItemsMap(selectedDnIds)
  );

  // When selected Delivery Notes change, update itemsState and poReference
  const handleToggleDn = (dnId: string) => {
    const targetDn = projectDeliveryNotes.find((d) => d.id === dnId);
    if (targetDn?.invoicedStatus === 'Fully Invoiced' && !selectedDnIds.includes(dnId)) {
      alert(`سند التسليم [${targetDn.dnNumber}] مفوتر بالكامل مسبقاً، ولا يمكن فوترته مجدداً لمنع الازدواج المالي.`);
      return;
    }

    setSelectedDnIds((prev) => {
      const next = prev.includes(dnId) ? prev.filter((id) => id !== dnId) : [...prev, dnId];
      setItemsState(generateItemsMap(next));
      setPoReference(computeDefaultPoRef(next));
      return next;
    });
  };

  const handleSelectAllDns = () => {
    // Only select uninvoiced or partially invoiced delivery notes
    const eligibleDns = projectDeliveryNotes.filter((dn) => dn.invoicedStatus !== 'Fully Invoiced');
    if (eligibleDns.length === 0) {
      alert('كافة سندات التسليم مفوترة بالكامل مسبقاً.');
      return;
    }
    const eligibleIds = eligibleDns.map((dn) => dn.id);
    setSelectedDnIds(eligibleIds);
    setItemsState(generateItemsMap(eligibleIds));
    setPoReference(computeDefaultPoRef(eligibleIds));
  };

  const handleClearDns = () => {
    setSelectedDnIds([]);
    setItemsState(generateItemsMap([]));
    setPoReference(computeDefaultPoRef([]));
  };

  const { financial, corporate } = useMasterEnterpriseStore();

  const [discount, setDiscount] = useState<number>(0);
  const [vatPercent, setVatPercent] = useState<number>(financial.defaultVat || 15);

  // Advance Payment & Retention Deductions Configuration
  const projectTotalAdvance = (project.advancePaymentAmount || 0) + ((project as any).advancePayments || []).reduce((sum: number, ap: any) => sum + (ap.amount || 0), 0);
  const [applyAdvanceDeduction, setApplyAdvanceDeduction] = useState<boolean>(() => projectTotalAdvance > 0);
  const [advanceDeductionMode, setAdvanceDeductionMode] = useState<'percent' | 'manual'>('percent');
  const [advanceDeductionPercent, setAdvanceDeductionPercent] = useState<number>(
    project.advancePaymentDeductionRate || financial.defaultAdvance || 10
  );
  const [advanceDeductionManual, setAdvanceDeductionManual] = useState<number>(0);

  const [applyRetentionDeduction, setApplyRetentionDeduction] = useState<boolean>(
    Boolean(project.retentionAmount && project.retentionAmount > 0)
  );
  const [retentionDeductionMode, setRetentionDeductionMode] = useState<'percent' | 'manual'>('percent');
  const [retentionDeductionPercent, setRetentionDeductionPercent] = useState<number>(
    project.retentionRate || project.retentionPercent || financial.defaultRetention || 10
  );
  const [retentionDeductionManual, setRetentionDeductionManual] = useState<number>(0);

  const handleToggleItem = (id: string) => {
    setItemsState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        selected: !prev[id]?.selected,
      },
    }));
  };

  const handleToggleAllItems = (selectAll: boolean) => {
    setItemsState((prev) => {
      const updated: Record<string, ItemState> = {};
      Object.keys(prev).forEach((key) => {
        updated[key] = {
          ...prev[key],
          selected: selectAll,
        };
      });
      return updated;
    });
  };

  const handleItemChange = (id: string, field: keyof ItemState, value: any) => {
    setItemsState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  // Calculations
  const itemsList = Object.values(itemsState);
  const selectedItemsList = itemsList
    .filter((it) => it.selected)
    .map((state) => {
      const qty = state.quantity || 0;
      const price = state.unitPrice || 0;
      const total = qty * price;
      return {
        state,
        total,
      };
    });

  const subtotal = selectedItemsList.reduce((sum, item) => sum + item.total, 0);
  const totalAfterDiscount = Math.max(0, subtotal - discount);
  const vatAmount = (totalAfterDiscount * vatPercent) / 100;
  const grandTotal = totalAfterDiscount + vatAmount;

  // Advance Payment pool and deduction calculations
  const priorAdvanceDeducted = priorInvoices.reduce((sum, inv) => sum + (inv.advanceDeduction || 0), 0);
  const availableAdvanceBalance = Math.max(0, projectTotalAdvance - priorAdvanceDeducted);

  const rawAdvanceDeduction = applyAdvanceDeduction
    ? (advanceDeductionMode === 'percent'
        ? (grandTotal * advanceDeductionPercent) / 100
        : advanceDeductionManual)
    : 0;

  const advanceDeduction = projectTotalAdvance > 0
    ? Math.min(availableAdvanceBalance, rawAdvanceDeduction)
    : rawAdvanceDeduction;

  const rawRetentionDeduction = applyRetentionDeduction
    ? (retentionDeductionMode === 'percent'
        ? (grandTotal * retentionDeductionPercent) / 100
        : retentionDeductionManual)
    : 0;
  const retentionDeduction = rawRetentionDeduction;

  const netPayableAmount = Math.max(0, grandTotal - advanceDeduction - retentionDeduction);

  const unselectedCount = itemsList.length - selectedItemsList.length;

  // Master Contract Metrics & Reconciliation
  const masterContractSubtotal = hasClientPO
    ? (clientContractPO!.contractValue || clientContractPO!.grandTotal / 1.15)
    : (activeQuotation?.totals?.customerSellingPrice || 0);

  const priorBilledSubtotal = priorInvoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);

  const cumulativeGrandTotal = priorBilledGrandTotal + grandTotal;
  const cumulativeSubtotal = priorBilledSubtotal + totalAfterDiscount;
  const remainingContractBalance = Math.max(0, masterContractCap - cumulativeGrandTotal);
  
  const isContractOverrun = hasClientPO && masterContractCap > 0 && cumulativeGrandTotal > (masterContractCap + 1);
  const overrunAmount = isContractOverrun ? cumulativeGrandTotal - masterContractCap : 0;

  // Profit Margin & Financial Tracking
  const totalEstimatedCost = selectedItemsList.reduce((sum, item) => {
    const unitCost = item.state.costPrice || 0;
    return sum + (item.state.quantity * unitCost);
  }, 0);

  const estimatedGrossProfit = totalAfterDiscount - totalEstimatedCost;
  const estimatedGrossMarginPercent = totalAfterDiscount > 0
    ? Math.round((estimatedGrossProfit / totalAfterDiscount) * 100)
    : 0;

  const handleResetItemToContractPrice = (id: string) => {
    const it = itemsState[id];
    if (!it) return;
    const targetPrice = it.contractRate ?? it.originalQuoteRate ?? it.unitPrice;
    setItemsState((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        unitPrice: targetPrice,
        priceSource: it.contractRate ? 'client_po' : 'quotation',
      },
    }));
  };

  const handleSave = () => {
    if (selectedItemsList.length === 0) {
      alert('يرجى تحديد صنف واحد على الأقل لإصدار الفاتورة به.');
      return;
    }

    const invoiceItems: InvoiceItem[] = selectedItemsList.map(({ state, total }, idx) => ({
      id: `inv-it-${Date.now()}-${idx}`,
      sourceItemId: state.sourceItemId,
      itemNo: state.itemNo || idx + 1,
      description: state.description,
      quantity: state.quantity,
      unit: state.unit,
      unitPrice: state.unitPrice,
      totalPrice: total,
      contractRate: state.contractRate,
      priceSource: state.priceSource,
      clientPoItemNo: state.clientPoItemNo,
      deliveryNoteRef: state.deliveryNoteRef,
      isDelivered: state.isDelivered || selectedDnIds.length > 0,
    }));

    // Guarantee strictly unique, non-repeating Tax Invoice Number
    let finalInvoiceNumber = invoiceNumber.trim();
    if (!finalInvoiceNumber || existingInvoices.some((inv) => inv.invoiceNumber.toLowerCase() === finalInvoiceNumber.toLowerCase())) {
      finalInvoiceNumber = getNextInvoiceNumber(project, existingInvoices);
    }

    // Hard Financial Validation Guard: Disallow posting any invoice if totalAmount <= 0
    if (grandTotal <= 0 || subtotal <= 0) {
      alert('خطأ مالي: لا يمكن ترحيل فاتورة بدون قيمة أو بأسعار صفرية. يرجى إدخال أسعار البنود أو تحديد كميات صالحة.');
      return;
    }

    if (project.clientContractPO) {
      const gatekeeper = validateInvoiceSubmission(
        invoiceItems.map((it) => ({
          sourceItemId: it.sourceItemId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        project.clientContractPO,
        existingInvoices
      );
      if (!gatekeeper.isValid) {
        alert(gatekeeper.errorMessage || 'خطأ فوترة: الكمية المفوترة تراكمياً تتجاوز تعميد العميل الأصلي. تم حظر إصدار الفاتورة المزدوجة.');
        return;
      }
    }

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: finalInvoiceNumber,
      date,
      dueDate,
      projectId: project.id,
      projectName: project.name,
      projectNumber: project.projectNumber,
      customerId: project.customerId || 'cust-1',
      customerName: project.customerName,
      customerVatNo:
        activeQuotation?.customerQuotationId ||
        (activeQuotation as any)?.customerVatNo ||
        '300994821100003',
      customerAddress: project.location,
      sourceQuotationId: activeQuotation?.id,
      sourceDeliveryNoteIds: selectedDnIds.length > 0 ? selectedDnIds : undefined,
      items: invoiceItems,
      subtotal,
      discount,
      totalAfterDiscount,
      vatPercent,
      vatAmount,
      grandTotal,
      advanceDeduction: advanceDeduction > 0 ? advanceDeduction : undefined,
      advanceDeductionPercent: applyAdvanceDeduction && advanceDeductionMode === 'percent' ? advanceDeductionPercent : undefined,
      retentionDeduction: retentionDeduction > 0 ? retentionDeduction : undefined,
      retentionDeductionPercent: applyRetentionDeduction && retentionDeductionMode === 'percent' ? retentionDeductionPercent : undefined,
      netPayableAmount: netPayableAmount,
      paidAmount: 0,
      remainingAmount: netPayableAmount,
      status: 'Issued',
      payments: [],
      notes,
      poReference,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Assert validity
    const validation = validateInvoiceForPosting(newInvoice);
    if (!validation.isValid) {
      alert(validation.errors[0] || 'خطأ مالي: لا يمكن ترحيل فاتورة بدون قيمة أو بأسعار صفرية.');
      return;
    }

    // Post to Central General Ledger
    try {
      postInvoiceEntry(newInvoice);
    } catch (ledgerErr) {
      console.warn('[CreateProjectInvoiceModal] Ledger posting notice:', ledgerErr);
    }

    onSaveInvoice(newInvoice);
    onClose();
  };

  const selectedDns = projectDeliveryNotes.filter((dn) => selectedDnIds.includes(dn.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-[#007A5A] to-[#0c6b4f] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">
                  إصدار فاتورة ضريبية للمشروع (Issue Tax Invoice)
                </h3>
                {selectedDnIds.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs font-bold shadow-xs">
                    مرتبطة بـ ({selectedDnIds.length}) سندات تسليم
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                المشروع: <strong>{project.name}</strong> ({project.projectNumber}) | العميل:{' '}
                <strong>{project.customerName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[75vh]">
          {/* Master Client PO & Contract Reconciliation Card */}
          {hasClientPO ? (
            <div className="bg-gradient-to-br from-indigo-50/90 via-slate-50 to-blue-50/70 border border-indigo-200/90 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-700 text-white rounded-xl shadow-xs">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-indigo-950">
                        سقف أمر الشراء المعتمد للمشروع (Master Client PO / Contract)
                      </h4>
                      <span className="font-mono text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded border border-indigo-200">
                        {clientContractPO?.clientPONumber || 'PO-CONTRACT'}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-900/80">
                      يتم اعتماد أسعار البنود الرسمية بموجب أمر الشراء/العقد كمرجع رئيسي وحيد، مع الموازنة التراكمية مع سقف العقد.
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {isContractOverrun ? (
                    <div className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs">
                      <ShieldAlert className="w-4 h-4 text-amber-700" />
                      <span>
                        تنبيه: تجاوز لسقف العقد بمقدار {overrunAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                      </span>
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs">
                      <CheckCircle2 className="w-4 h-4 text-[#007A5A]" />
                      <span>متوافق ومطابق لسقف أمر الشراء المعتمد</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 4-Way Reconciliation KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium">سقف أمر الشراء الإجمالي</div>
                  <div className="font-mono text-sm font-bold text-indigo-950 mt-0.5">
                    {masterContractCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </div>
                  <div className="text-[10px] text-indigo-700/80 mt-0.5 font-mono">
                    بدون ضريبة: {(masterContractCap / 1.15).toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[11px] text-slate-500 font-medium">المفوتر سابقاً (المعتمد)</div>
                  <div className="font-mono text-sm font-bold text-slate-800 mt-0.5">
                    {priorBilledGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    بدون ضريبة: {priorBilledSubtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/30">
                  <div className="text-[11px] text-emerald-800 font-medium">قيمة الفاتورة الحالية</div>
                  <div className="font-mono text-sm font-bold text-[#007A5A] mt-0.5">
                    {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </div>
                  <div className="text-[10px] text-emerald-700/90 mt-0.5 font-mono">
                    بدون ضريبة: {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} | ضريبة 15%: {vatAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs bg-blue-50/30">
                  <div className="text-[11px] text-blue-800 font-medium">المتبقي من سقف العقد</div>
                  <div className="font-mono text-sm font-bold text-blue-900 mt-0.5">
                    {remainingContractBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </div>
                  <div className="text-[10px] text-blue-700/90 mt-0.5 font-mono">
                    بدون ضريبة: {(remainingContractBalance / 1.15).toLocaleString(undefined, { maximumFractionDigits: 0 })} SAR
                  </div>
                </div>
              </div>
            </div>
          ) : (
            activeQuotation && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-slate-600">
                    المرجع التعاقدي: <strong>عرض السعر المعتمد</strong> بقيمة{' '}
                    <strong className="font-mono text-slate-800">
                      {(activeQuotation.totals?.grandTotalWithVat || 0).toLocaleString()} SAR
                    </strong>{' '}
                    (لم يتم تسجيل أمر شراء عميل منفصل بعد).
                  </span>
                </div>
                <div className="text-slate-500 font-mono">
                  المفوتر سابقاً: {priorBilledGrandTotal.toLocaleString()} SAR
                </div>
              </div>
            )
          )}

          {/* Linked Delivery Notes Section */}
          {projectDeliveryNotes.length > 0 && (
            <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <span>ربط سندات التسليم المعتمدة بالفوترة (Link Delivery Notes)</span>
                      {selectedDnIds.length > 0 && (
                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                          تم جلب الكميات والأسعار المعتمدة تلقائياً
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-blue-800">
                      يمكنك اختيار سند تسليم واحد أو جمع عدة سندات تسليم معاً ليتم إدراج أصنافها الموردة وتثبيت أسعار البيع المعتمدة.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllDns}
                    className="px-2.5 py-1 bg-white border border-blue-200 hover:bg-blue-100 text-blue-900 rounded font-semibold text-[11px] cursor-pointer"
                  >
                    تحديد كافة السندات
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDns}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded font-semibold text-[11px] cursor-pointer"
                  >
                    فوترة حسب عرض السعر
                  </button>
                </div>
              </div>

              {/* Delivery Notes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {projectDeliveryNotes.map((dn) => {
                  const isChecked = selectedDnIds.includes(dn.id);
                  const isFullyInvoiced = dn.invoicedStatus === 'Fully Invoiced';

                  return (
                    <div
                      key={dn.id}
                      onClick={() => handleToggleDn(dn.id)}
                      className={`p-3 rounded-xl border transition select-none flex items-start gap-2.5 ${
                        isFullyInvoiced
                          ? 'bg-slate-100/80 border-slate-200 opacity-70 cursor-not-allowed'
                          : isChecked
                          ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs cursor-pointer'
                          : 'bg-white/70 border-slate-200 hover:border-blue-300 hover:bg-white cursor-pointer'
                      }`}
                      title={isFullyInvoiced ? 'سند مفوتر بالكامل ومقفول لمنع الازدواج المالي' : 'اضغط لاختيار السند'}
                    >
                      {isFullyInvoiced ? (
                        <Lock className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 mt-0.5 shrink-0 cursor-pointer"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-xs text-blue-900">
                            {dn.dnNumber}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              isFullyInvoiced
                                ? 'bg-purple-100 text-purple-800 flex items-center gap-1'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isFullyInvoiced && <Lock className="w-2.5 h-2.5" />}
                            {isFullyInvoiced ? 'مفوتر (مقفول 🔒)' : 'جاهز للفوترة ⚡'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
                          <span>{dn.date}</span>
                          <span className="font-bold text-slate-800">
                            {dn.items?.length || 0} بنود موردة
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          المستلم: {dn.recipientName || 'مهندس الموقع'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedDns.length > 0 && (
                <div className="p-2.5 bg-blue-100/70 rounded-lg text-blue-950 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      سيتم ربط الفاتورة بالسندات: <strong>{selectedDns.map((d) => d.dnNumber).join('، ')}</strong> وتحديث حالتها إلى "تمت الفوترة بالكامل".
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Invoice Header Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                رقم الفاتورة (Invoice No.)
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-[#007A5A]"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                رقم تسلسلي خاص ومستقل بهذا المشروع
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                تاريخ الفاتورة (Issue Date)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                تاريخ الاستحقاق (Due Date)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                المرجع / سندات التسليم والتعميد
              </label>
              <input
                type="text"
                value={poReference}
                onChange={(e) => setPoReference(e.target.value)}
                placeholder="e.g. سند تسليم: DN-PRJ088-001"
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-slate-800 font-semibold"
              />
            </div>
          </div>

          {/* Edit Mode Toggle & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                طريقة إعداد بنود الفاتورة:
              </span>
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  !isEditMode
                    ? 'bg-[#007A5A] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>اعتماد الأسعار المعتمدة تلقائياً</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isEditMode
                    ? 'bg-[#1e3a8a] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تحرير وتعديل الأسعار والكميات يدوياً</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleAllItems(true)}
                className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded font-semibold text-[11px] cursor-pointer"
              >
                تحديد كافة الأصناف
              </button>
              <button
                type="button"
                onClick={() => handleToggleAllItems(false)}
                className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded font-semibold text-[11px] cursor-pointer"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>

          {/* Items Checkbox Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>جدول بنود وأصناف الفاتورة الضريبية</span>
                <span className="text-[11px] font-normal text-slate-500">
                  {selectedDnIds.length > 0
                    ? `(الأصناف الموردة بموجب سندات التسليم المحددة بالأسعار المعتمدة)`
                    : `(حدد الأصناف المراد إدراجها بالفاتورة)`}
                </span>
              </h4>

              <div className="text-xs text-slate-600">
                المحدد: <strong className="text-emerald-700 font-mono">{selectedItemsList.length}</strong> / {itemsList.length}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-2.5 text-center w-10">إدراج</th>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">وصف الصنف والمواصفات المعتمدة</th>
                    <th className="p-2.5 text-center w-20">الكمية</th>
                    <th className="p-2.5 text-center w-14">الوحدة</th>
                    <th className="p-2.5 text-center w-40">سعر الوحدة المعتمد (SAR)</th>
                    <th className="p-2.5 text-left w-32">المجموع (SAR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsList.map((state) => {
                    const rowTotal = (state.quantity || 0) * (state.unitPrice || 0);
                    const isPoPrice = state.priceSource === 'client_po';
                    const hasContractRate = state.contractRate !== undefined && state.contractRate > 0;
                    const isPriceModifiedFromContract =
                      hasContractRate && Math.abs(state.unitPrice - (state.contractRate || 0)) > 0.01;

                    return (
                      <tr
                        key={state.id}
                        className={`transition ${
                          state.selected ? 'bg-emerald-50/30' : 'bg-slate-50/50 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={() => handleToggleItem(state.id)}
                            className="w-4 h-4 text-[#007A5A] rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            title="تحديد لإصدار الفاتورة بهذا الصنف"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-500">
                          {state.itemNo}
                        </td>
                        <td className="p-2.5">
                          {isEditMode ? (
                            <textarea
                              rows={2}
                              value={state.description}
                              onChange={(e) => handleItemChange(state.id, 'description', e.target.value)}
                              className="w-full p-1.5 border border-blue-300 rounded text-xs"
                            />
                          ) : (
                            <div>
                              <span className="font-medium text-slate-800 whitespace-pre-line block">
                                {state.description}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {isPoPrice && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-100/90 px-1.5 py-0.5 rounded font-mono">
                                    <FileCheck className="w-3 h-3 text-indigo-700" /> سعر معتمد بأمر الشراء
                                    {state.clientPoItemNo ? ` (#${state.clientPoItemNo})` : ''}
                                  </span>
                                )}
                                {state.deliveryNoteRef && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                                    <Truck className="w-3 h-3" /> سند تسليم: {state.deliveryNoteRef}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {isEditMode ? (
                            <input
                              type="number"
                              min={1}
                              value={state.quantity}
                              onChange={(e) =>
                                handleItemChange(state.id, 'quantity', parseFloat(e.target.value) || 0)
                              }
                              className="w-16 p-1 border border-blue-300 rounded text-center font-mono font-bold"
                            />
                          ) : (
                            <span className="font-mono font-bold text-slate-800">
                              {state.quantity}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-slate-600 font-mono">
                          {state.unit}
                        </td>
                        <td className="p-2.5 text-center">
                          {isEditMode ? (
                            <div className="space-y-1">
                              <input
                                type="number"
                                min={0}
                                value={state.unitPrice}
                                onChange={(e) =>
                                  handleItemChange(state.id, 'unitPrice', parseFloat(e.target.value) || 0)
                                }
                                className="w-24 p-1 border border-blue-300 rounded text-center font-mono font-bold"
                              />
                              {isPriceModifiedFromContract && (
                                <button
                                  type="button"
                                  onClick={() => handleResetItemToContractPrice(state.id)}
                                  className="text-[9.5px] text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 block mx-auto cursor-pointer"
                                  title="استعادة السعر المعتمد في أمر شراء العميل"
                                >
                                  استعادة سعر العقد ({state.contractRate} SAR)
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="font-mono text-slate-800 font-bold">
                                {state.unitPrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              {hasContractRate && state.originalQuoteRate && state.originalQuoteRate !== state.contractRate && (
                                <div className="text-[9.5px] text-slate-400 line-through font-mono">
                                  عرض السعر: {state.originalQuoteRate.toLocaleString()} SAR
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-left font-mono font-bold text-slate-900">
                          {state.selected ? (
                            <span>
                              {rowTotal.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              غير مفوتر (مؤجل)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Profit Margin & Financial Tracking Banner */}
          <div className="bg-gradient-to-r from-slate-50 via-emerald-50/20 to-teal-50/30 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#007A5A] text-white rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">
                  مؤشرات الربحية والتحليل المالي للفاتورة (Profit Margin & Financial Tracking)
                </span>
                <span className="text-[11px] text-slate-500">
                  مقارنة إيراد البيع المعتمد بالتكلفة التقديرية للأصناف المحددة
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">التكلفة التقديرية:</span>
                <span className="font-mono font-bold text-slate-700">
                  {totalEstimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px]">إجمالي الربح التقديري:</span>
                <span className="font-mono font-bold text-[#007A5A]">
                  {estimatedGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-[10px]">نسبة هامش الربح:</span>
                <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                  estimatedGrossMarginPercent >= 20
                    ? 'bg-emerald-100 text-emerald-800'
                    : estimatedGrossMarginPercent > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {estimatedGrossMarginPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Financial Totals Calculation Box & Deductions Controls */}
          <div className="flex flex-wrap items-start justify-between gap-5 pt-2">
            <div className="flex-1 min-w-[320px] max-w-lg space-y-3.5 text-xs">
              {/* Advance & Retention Deductions Configuration Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-[#007A5A]" />
                    <span>استقطاعات وتسويات الفاتورة (Deductions & Apportionments)</span>
                  </span>
                  {availableAdvanceBalance > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-[10.5px]">
                      رصيد دفعة مقدمة متاح: {availableAdvanceBalance.toLocaleString()} SAR
                    </span>
                  )}
                </div>

                {/* Advance Payment Deduction Control */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={applyAdvanceDeduction}
                        onChange={(e) => setApplyAdvanceDeduction(e.target.checked)}
                        className="w-4 h-4 text-[#007A5A] rounded focus:ring-emerald-500"
                      />
                      <span>خصم من الدفعة المقدمة (Advance Payment Deduction)</span>
                    </label>
                    {applyAdvanceDeduction && (
                      <div className="flex items-center gap-1 text-[10.5px]">
                        <button
                          type="button"
                          onClick={() => setAdvanceDeductionMode('percent')}
                          className={`px-2 py-0.5 rounded transition ${
                            advanceDeductionMode === 'percent'
                              ? 'bg-[#007A5A] text-white font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          نسبة مئوية %
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdvanceDeductionMode('manual')}
                          className={`px-2 py-0.5 rounded transition ${
                            advanceDeductionMode === 'manual'
                              ? 'bg-[#007A5A] text-white font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          مبلغ ثابت SAR
                        </button>
                      </div>
                    )}
                  </div>

                  {applyAdvanceDeduction && (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      {advanceDeductionMode === 'percent' ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={advanceDeductionPercent}
                            onChange={(e) => setAdvanceDeductionPercent(parseFloat(e.target.value) || 0)}
                            className="w-20 p-1.5 border border-slate-300 rounded font-mono font-bold text-center"
                          />
                          <span className="text-slate-500 text-[11px]">% من إجمالي الفاتورة شامل الضريبة</span>
                          <span className="font-mono font-bold text-blue-700 mr-auto text-xs">
                            = {advanceDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="number"
                            min={0}
                            value={advanceDeductionManual}
                            onChange={(e) => setAdvanceDeductionManual(parseFloat(e.target.value) || 0)}
                            className="w-32 p-1.5 border border-slate-300 rounded font-mono font-bold"
                          />
                          <span className="text-slate-500 text-[11px]">SAR مستقطع</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Retention Deduction Control */}
                <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={applyRetentionDeduction}
                        onChange={(e) => setApplyRetentionDeduction(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <span>استقطاع محجوز ضمان (Retention / Holdback Deduction)</span>
                    </label>
                    {applyRetentionDeduction && (
                      <div className="flex items-center gap-1 text-[10.5px]">
                        <button
                          type="button"
                          onClick={() => setRetentionDeductionMode('percent')}
                          className={`px-2 py-0.5 rounded transition ${
                            retentionDeductionMode === 'percent'
                              ? 'bg-amber-700 text-white font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          نسبة مئوية %
                        </button>
                        <button
                          type="button"
                          onClick={() => setRetentionDeductionMode('manual')}
                          className={`px-2 py-0.5 rounded transition ${
                            retentionDeductionMode === 'manual'
                              ? 'bg-amber-700 text-white font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          مبلغ ثابت SAR
                        </button>
                      </div>
                    )}
                  </div>

                  {applyRetentionDeduction && (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      {retentionDeductionMode === 'percent' ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={retentionDeductionPercent}
                            onChange={(e) => setRetentionDeductionPercent(parseFloat(e.target.value) || 0)}
                            className="w-20 p-1.5 border border-slate-300 rounded font-mono font-bold text-center"
                          />
                          <span className="text-slate-500 text-[11px]">% محجوز ضمان معتمد</span>
                          <span className="font-mono font-bold text-amber-700 mr-auto text-xs">
                            = {retentionDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="number"
                            min={0}
                            value={retentionDeductionManual}
                            onChange={(e) => setRetentionDeductionManual(parseFloat(e.target.value) || 0)}
                            className="w-32 p-1.5 border border-slate-300 rounded font-mono font-bold"
                          />
                          <span className="text-slate-500 text-[11px]">SAR محجوز</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  ملاحظات وشروط الدفع بالفاتورة
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {unselectedCount > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    تنبيه: تم استثناء {unselectedCount} أصناف من هذه الفاتورة؛ سيتم الاحتفاظ بها تلقائياً كأصناف غير مفوترة (Unbilled) للمطالبة بها لاحقاً.
                  </span>
                </div>
              )}
            </div>

            {/* Summary Box */}
            <div className="w-84 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs shadow-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي (Subtotal):</span>
                <span className="font-mono font-bold text-slate-900">
                  {subtotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} SAR
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>خصم تجاري (Discount):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-24 p-1 bg-white border border-slate-300 rounded font-mono text-right text-xs"
                  />
                  <span className="text-[10px] text-slate-400">SAR</span>
                </div>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>ضريبة القيمة المضافة ({vatPercent}% VAT):</span>
                <span className="font-mono font-bold text-slate-900">
                  {vatAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} SAR
                </span>
              </div>

              <div className="flex justify-between py-1 px-2 bg-slate-200/70 rounded text-slate-800 font-bold text-[11.5px]">
                <span>إجمالي الفاتورة مع الضريبة:</span>
                <span className="font-mono">
                  {grandTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} SAR
                </span>
              </div>

              {advanceDeduction > 0 && (
                <div className="flex justify-between text-blue-700 py-0.5">
                  <span>خصم الدفعة المقدمة:</span>
                  <span className="font-mono font-bold">
                    -{advanceDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                </div>
              )}

              {retentionDeduction > 0 && (
                <div className="flex justify-between text-amber-700 py-0.5">
                  <span>استقطاع محجوز الضمان:</span>
                  <span className="font-mono font-bold">
                    -{retentionDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-xs font-bold bg-[#007A5A] text-white p-2.5 rounded-lg -mx-1">
                <span>صافي المستحق للمطالبة والتحصيل:</span>
                <span className="font-mono text-sm">
                  {netPayableAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} SAR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            سيتم إدراج الفاتورة بالأسعار المعتمدة وربطها بسندات التسليم في كشف حساب العميل.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl font-bold shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>إصدار واعتماد الفاتورة الضريبية</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
