import React, { useState, useMemo } from 'react';
import { Project, CustomerQuotation, DeliveryNote, DeliveryNoteItem, PurchaseOrder, MaterialReceiptRecord } from '../types';
import { getNextDeliveryNoteNumber } from '../utils/invoiceUtils';
import { computeProjectDeliverySummary } from '../utils/deliveryUtils';
import { validateDeliveryNoteSubmission } from '../logic/Gatekeepers';
import { Truck, X, Plus, Package, Check, Calendar, MapPin, User, FileText, Sparkles, Layers } from 'lucide-react';

interface CreateDeliveryNoteModalProps {
  project?: Project;
  allProjects?: Project[];
  activeQuotation?: CustomerQuotation;
  existingDeliveryNotes?: DeliveryNote[];
  prefillPO?: PurchaseOrder;
  prefillReceipt?: MaterialReceiptRecord;
  prefillItems?: Array<{
    sourceItemId: string;
    itemNo?: number;
    description: string;
    unit: string;
    orderedQty: number;
    deliveredQty: number;
    unitPrice?: number;
  }>;
  onClose: () => void;
  onSaveDeliveryNote: (deliveryNote: DeliveryNote) => void;
}

export const CreateDeliveryNoteModal: React.FC<CreateDeliveryNoteModalProps> = ({
  project: initialProject,
  allProjects = [],
  activeQuotation,
  existingDeliveryNotes = [],
  prefillPO,
  prefillReceipt,
  prefillItems,
  onClose,
  onSaveDeliveryNote,
}) => {
  // If no initial project provided, try to find from prefillPO / prefillReceipt or default to first project
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (initialProject?.id) return initialProject.id;
    if (prefillPO?.projectId) return prefillPO.projectId;
    if (prefillReceipt?.projectId) return prefillReceipt.projectId;
    if (allProjects.length > 0) return allProjects[0].id;
    return '';
  });

  const currentProject = useMemo(() => {
    if (initialProject && initialProject.id === selectedProjectId) return initialProject;
    return allProjects.find((p) => p.id === selectedProjectId) || initialProject || {
      id: selectedProjectId || 'prj-default',
      projectNumber: prefillPO?.projectRef || 'PRJ-001',
      name: prefillPO?.projectName || 'مشروع عام',
      customerName: prefillPO?.projectName || 'العميل المعتمد',
      location: 'موقع العميل',
      status: 'Won',
      createdAt: new Date().toISOString(),
    } as Project;
  }, [selectedProjectId, initialProject, allProjects, prefillPO, prefillReceipt]);

  // Compute summary from active quotation if available
  const quotationDeliverySummary = useMemo(() => {
    return computeProjectDeliverySummary(activeQuotation, existingDeliveryNotes);
  }, [activeQuotation, existingDeliveryNotes]);

  // Unified available items list to dispatch
  const unifiedItems = useMemo(() => {
    // 1. If explicit prefill items provided
    if (prefillItems && prefillItems.length > 0) {
      return prefillItems.map((pi, idx) => ({
        itemId: pi.sourceItemId || `item-${idx}`,
        itemNo: pi.itemNo || idx + 1,
        description: pi.description,
        unit: pi.unit || 'EA',
        totalOrderedQty: pi.orderedQty,
        totalDeliveredQty: 0,
        remainingQty: pi.orderedQty,
        defaultDispatchQty: pi.deliveredQty,
        unitPrice: pi.unitPrice || 0,
      }));
    }

    // 2. If prefillReceipt provided (e.g. issued from a material receipt)
    if (prefillReceipt && prefillReceipt.receivedItems && prefillReceipt.receivedItems.length > 0) {
      return prefillReceipt.receivedItems.map((ri, idx) => ({
        itemId: ri.poItemId || `rcpt-it-${idx}`,
        itemNo: ri.itemNo || idx + 1,
        description: ri.description,
        unit: ri.unit || 'EA',
        totalOrderedQty: ri.orderedQty || ri.receivedQty,
        totalDeliveredQty: 0,
        remainingQty: ri.receivedQty,
        defaultDispatchQty: ri.receivedQty,
        unitPrice: ri.unitPrice ? Math.round(ri.unitPrice * 1.25) : 0,
      }));
    }

    // 3. If prefillPO provided (e.g. from PO screen)
    if (prefillPO && prefillPO.items && prefillPO.items.length > 0) {
      return prefillPO.items.map((it, idx) => {
        const received = it.deliveredQty !== undefined ? it.deliveredQty : (prefillPO.deliveryStatus === 'Delivered' ? it.quantity : 0);
        return {
          itemId: it.id || `po-it-${idx}`,
          itemNo: it.itemNo || idx + 1,
          description: it.description,
          unit: it.unit || 'EA',
          totalOrderedQty: it.quantity,
          totalDeliveredQty: 0,
          remainingQty: it.quantity,
          defaultDispatchQty: received > 0 ? received : it.quantity,
          unitPrice: Math.round(it.unitPrice * 1.25),
        };
      });
    }

    // 4. Quotation items if available
    if (quotationDeliverySummary.length > 0) {
      return quotationDeliverySummary.map((qi) => ({
        itemId: qi.itemId,
        itemNo: qi.itemNo,
        description: qi.description,
        unit: qi.unit,
        totalOrderedQty: qi.totalOrderedQty,
        totalDeliveredQty: qi.totalDeliveredQty,
        remainingQty: qi.remainingQty,
        defaultDispatchQty: qi.remainingQty > 0 ? qi.remainingQty : qi.totalOrderedQty,
        unitPrice: 0,
      }));
    }

    // 5. If project has client contract PO items
    if (currentProject.clientContractPO && currentProject.clientContractPO.items.length > 0) {
      return currentProject.clientContractPO.items.map((ci, idx) => ({
        itemId: ci.id || `cpo-${idx}`,
        itemNo: ci.itemNo || idx + 1,
        description: ci.description,
        unit: ci.unit || 'EA',
        totalOrderedQty: ci.quantity,
        totalDeliveredQty: 0,
        remainingQty: ci.quantity,
        defaultDispatchQty: ci.quantity,
        unitPrice: ci.unitPrice || 0,
      }));
    }

    return [];
  }, [prefillItems, prefillReceipt, prefillPO, quotationDeliverySummary, currentProject]);

  const nextDnNumber = useMemo(() => {
    return getNextDeliveryNoteNumber(currentProject, existingDeliveryNotes);
  }, [currentProject, existingDeliveryNotes]);

  const [dnNumber, setDnNumber] = useState(nextDnNumber);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryLocation, setDeliveryLocation] = useState(currentProject.location || 'موقع المشروع الرئيسي');
  const [recipientName, setRecipientName] = useState(currentProject.customerName || '');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [dispatchedByName, setDispatchedByName] = useState('Medhat Al Brahim');
  const [driverOrCarrier, setDriverOrCarrier] = useState('');
  const [vehiclePlateNo, setVehiclePlateNo] = useState('');
  const [notes, setNotes] = useState(() => {
    if (prefillReceipt) {
      return `توريد بموجب استلام مواد من المورد ${prefillReceipt.vendorName || ''} (إشعار #${prefillReceipt.receiptNumber}). يرجى الفحص والمعاينة والتوقيع بالاستلام.`;
    }
    if (prefillPO) {
      return `توريد بموجب أمر شراء رقم ${prefillPO.poNumber}. يرجى الفحص والمعاينة والتوقيع بالاستلام.`;
    }
    return 'يرجى الفحص والمعاينة والتوقيع بالاستلام.';
  });

  // Track items to deliver: Record<itemId, { selected: boolean; qty: number }>
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; qty: number }>>(() => {
    const map: Record<string, { selected: boolean; qty: number }> = {};
    unifiedItems.forEach((item) => {
      map[item.itemId] = {
        selected: item.defaultDispatchQty > 0 || item.remainingQty > 0,
        qty: item.defaultDispatchQty > 0 ? item.defaultDispatchQty : (item.remainingQty > 0 ? item.remainingQty : item.totalOrderedQty),
      };
    });
    return map;
  });

  // Keep selected items in sync if unifiedItems changes
  React.useEffect(() => {
    setSelectedItems((prev) => {
      const map: Record<string, { selected: boolean; qty: number }> = { ...prev };
      unifiedItems.forEach((item) => {
        if (map[item.itemId] === undefined) {
          map[item.itemId] = {
            selected: item.defaultDispatchQty > 0 || item.remainingQty > 0,
            qty: item.defaultDispatchQty > 0 ? item.defaultDispatchQty : item.totalOrderedQty,
          };
        }
      });
      return map;
    });
  }, [unifiedItems]);

  const handleToggleSelectAll = (select: boolean) => {
    const updated: Record<string, { selected: boolean; qty: number }> = {};
    unifiedItems.forEach((it) => {
      updated[it.itemId] = {
        selected: select,
        qty: selectedItems[it.itemId]?.qty || it.defaultDispatchQty || it.totalOrderedQty,
      };
    });
    setSelectedItems(updated);
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        selected: !prev[itemId]?.selected,
      },
    }));
  };

  const handleQtyChange = (itemId: string, qty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        qty: Math.max(0, qty),
      },
    }));
  };

  const handleSave = () => {
    // 1. Mandatory Delivery Logistics Fields Validation
    if (!deliveryLocation || !deliveryLocation.trim()) {
      alert('حقل موقع ومقر التسليم إلزامي لإصدار سند التسليم.');
      return;
    }
    if (!recipientName || !recipientName.trim()) {
      alert('حقل اسم المستلم / ممثل العميل إلزامي لإصدار سند التسليم.');
      return;
    }
    if (!dispatchedByName || !dispatchedByName.trim()) {
      alert('حقل مسؤول التجهيز والتسليم (Dispatched By) إلزامي.');
      return;
    }
    if (!driverOrCarrier.trim() || !vehiclePlateNo.trim() || !recipientPhone.trim()) {
      alert('لا يمكن إصدار سند التسليم دون استيفاء بيانات الناقل، رقم اللوحة، وهاتف المستلم لضمان الحجية القانونية');
      return;
    }

    const itemsToDeliver: DeliveryNoteItem[] = [];
    const discreteUnits = ['ea', 'set', 'pcs', 'قطعة', 'طقم', 'وحدة', 'حبة', 'عدد'];

    for (const summaryItem of unifiedItems) {
      const selection = selectedItems[summaryItem.itemId];
      if (selection && selection.selected && selection.qty > 0) {
        // Enforce discrete unit integer quantity
        const u = (summaryItem.unit || '').trim().toLowerCase();
        if (discreteUnits.includes(u) && !Number.isInteger(Number(selection.qty))) {
          alert(`خطأ: لا يمكن قبول كسور عشرية للوحدة (${summaryItem.unit}) للصنف: ${summaryItem.description}`);
          return;
        }

        const quoteItem = activeQuotation?.items.find((qi) => qi.id === summaryItem.itemId);
        const unitPrice = summaryItem.unitPrice || quoteItem?.sellingUnitPrice || 0;

        itemsToDeliver.push({
          id: `dni-${Date.now()}-${summaryItem.itemId}`,
          sourceItemId: summaryItem.itemId,
          itemNo: summaryItem.itemNo,
          description: summaryItem.description,
          unit: summaryItem.unit,
          orderedQty: summaryItem.totalOrderedQty,
          deliveredQty: selection.qty,
          totalDeliveredSoFar: (summaryItem.totalDeliveredQty || 0) + selection.qty,
          remainingQty: Math.max(0, summaryItem.totalOrderedQty - (summaryItem.totalDeliveredQty + selection.qty)),
          unitPrice,
          totalPrice: unitPrice * selection.qty,
          isInvoiced: false,
        });
      }
    }

    if (itemsToDeliver.length === 0) {
      alert('يرجى تحديد صنف واحد على الأقل للتوريد بكمية أكبر من صفر.');
      return;
    }

    if (prefillPO) {
      const gatekeeper = validateDeliveryNoteSubmission(
        itemsToDeliver.map((it) => ({ poItemId: it.sourceItemId, deliveredQty: it.deliveredQty })),
        prefillPO,
        existingDeliveryNotes
      );
      if (!gatekeeper.isValid) {
        alert(gatekeeper.errorMessage || 'مخالفة تشغيلية: الكمية الإجمالية المسلمة تتجاوز كمية التعميد المعتمدة.');
        return;
      }
    }

    const allDelivered = itemsToDeliver.every((it) => it.remainingQty === 0);

    // Guarantee strictly unique, non-repeating Delivery Note Number
    let finalDnNumber = dnNumber.trim();
    if (!finalDnNumber || existingDeliveryNotes.some((d) => d.dnNumber.toLowerCase() === finalDnNumber.toLowerCase())) {
      finalDnNumber = getNextDeliveryNoteNumber(currentProject, existingDeliveryNotes);
    }

    const newDeliveryNote: DeliveryNote = {
      id: `dn-${Date.now()}`,
      dnNumber: finalDnNumber,
      date,
      projectId: currentProject.id,
      projectName: currentProject.name,
      projectNumber: currentProject.projectNumber,
      customerId: currentProject.customerId,
      customerName: currentProject.customerName,
      deliveryLocation,
      recipientName: recipientName || currentProject.customerName,
      recipientPhone,
      driverOrCarrier,
      vehiclePlateNo,
      status: allDelivered ? 'Delivered' : 'Partial Delivered',
      items: itemsToDeliver,
      invoicedStatus: 'Uninvoiced',
      notes,
      dispatchedByName: dispatchedByName.trim() || 'Medhat Al Brahim',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveDeliveryNote(newDeliveryNote);
    onClose();
  };

  const selectedCount = Object.values(selectedItems).filter((v: { selected: boolean; qty: number }) => v.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#1e3a8a] to-[#152e6f] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">
                  إصدار أمر / سند تسليم بضاعة للعميل (Delivery Note)
                </h3>
                {prefillReceipt && (
                  <span className="bg-emerald-500/30 text-emerald-200 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                    مرتبط بإشعار الاستلام #{prefillReceipt.receiptNumber}
                  </span>
                )}
                {prefillPO && (
                  <span className="bg-blue-500/30 text-blue-200 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                    أمر شراء {prefillPO.poNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                المشروع: <span className="font-semibold text-white">{currentProject.name}</span> ({currentProject.projectNumber}) | العميل: <span className="font-semibold text-white">{currentProject.customerName}</span>
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

        {/* Form Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[75vh]">
          {/* Project Selector (if multiple projects exist and not locked) */}
          {allProjects.length > 1 && !initialProject && (
            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#1e3a8a]" />
                <span className="font-bold text-slate-800">اختر المشروع المستهدف لسند التسليم:</span>
              </div>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="p-1.5 bg-white border border-blue-300 rounded font-semibold text-slate-800 max-w-xs focus:ring-1 focus:ring-blue-500"
              >
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectNumber}) - {p.customerName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Top Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                رقم سند التسليم (Serial No.)
              </label>
              <input
                type="text"
                value={dnNumber}
                onChange={(e) => setDnNumber(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-[#1e3a8a]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                تاريخ التسليم (Date)
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
                اسم المستلم / العميل
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="اسم مهندس الموقع أو المستلم"
                className="w-full p-2 bg-white border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                جوال المستلم
              </label>
              <input
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+966 5..."
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                المسؤول عن التجهيز (Prepared By)
              </label>
              <input
                type="text"
                value={dispatchedByName}
                onChange={(e) => setDispatchedByName(e.target.value)}
                placeholder="Medhat Al Brahim"
                className="w-full p-2 bg-white border border-slate-300 rounded font-semibold text-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                موقع التسليم والتفريغ
              </label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="العنوان وموقع المشروع"
                className="w-full p-2 bg-white border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                السائق / شركة النقل
              </label>
              <input
                type="text"
                value={driverOrCarrier}
                onChange={(e) => setDriverOrCarrier(e.target.value)}
                placeholder="اسم السائق أو الناقل"
                className="w-full p-2 bg-white border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                رقم لوحة الشاحنة
              </label>
              <input
                type="text"
                value={vehiclePlateNo}
                onChange={(e) => setVehiclePlateNo(e.target.value)}
                placeholder="مثال: أ ب ج 1234"
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono"
              />
            </div>
          </div>

          {/* Items Selection Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#007A5A]" />
                <h4 className="text-xs font-bold text-slate-900">
                  تحديد الأصناف والكميات المراد تسليمها للعميل في هذا السند
                </h4>
                <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  تم تحديد ({selectedCount}) من ({unifiedItems.length})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(true)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSelectAll(false)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            {unifiedItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <Package className="w-8 h-8 text-slate-400 mx-auto opacity-70" />
                <p className="text-xs text-slate-600 font-bold">
                  لا توجد بنود مسجلة لهذا المشروع بعد
                </p>
                <p className="text-[11px] text-slate-400">
                  يرجى التأكد من اعتماد عرض سعر أو أمر شراء للمشروع أولاً ليتم جلب الأصناف تلقائياً.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5 text-center w-12">اختيار</th>
                      <th className="p-2.5 text-center w-10">#</th>
                      <th className="p-2.5">وصف البند / الصنف</th>
                      <th className="p-2.5 text-center w-20">الكمية الإجمالية</th>
                      <th className="p-2.5 text-center w-24 bg-emerald-50 text-[#007A5A]">
                        الكمية بهذا السند
                      </th>
                      <th className="p-2.5 text-center w-20">المتبقي للتسليم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {unifiedItems.map((item, idx) => {
                      const selection = selectedItems[item.itemId] || { selected: false, qty: 0 };
                      const remainingAfter = Math.max(
                        0,
                        item.totalOrderedQty - ((item.totalDeliveredQty || 0) + (selection.selected ? selection.qty : 0))
                      );

                      return (
                        <tr
                          key={item.itemId || idx}
                          className={`hover:bg-slate-50 transition ${
                            selection.selected ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={selection.selected}
                              onChange={() => handleToggleItem(item.itemId)}
                              className="w-4 h-4 rounded text-[#007A5A] accent-[#007A5A] cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-500">
                            {item.itemNo || idx + 1}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900 leading-snug">
                              {item.description}
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-bold font-mono text-slate-700">
                            {item.totalOrderedQty} {item.unit}
                          </td>
                          <td className="p-2.5 text-center bg-emerald-50/50">
                            <input
                              type="number"
                              min="0"
                              max={item.totalOrderedQty}
                              disabled={!selection.selected}
                              value={selection.qty}
                              onChange={(e) =>
                                handleQtyChange(item.itemId, parseFloat(e.target.value) || 0)
                              }
                              className="w-20 p-1.5 text-center bg-white border border-emerald-300 rounded font-mono font-black text-emerald-900 focus:outline-emerald-600 shadow-2xs mx-auto block disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </td>
                          <td className="p-2.5 text-center font-bold font-mono">
                            <span
                              className={
                                remainingAfter > 0 ? 'text-amber-600' : 'text-emerald-600'
                              }
                            >
                              {remainingAfter} {item.unit}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              ملاحظات وتعهدات التسليم (Delivery Notes / Terms)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تم تسليم البضاعة بحالة ممتازة وبمطابقة تامة للمواصفات..."
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            سيتم إصدار سند تسليم رسمي مع إمكانية الطباعة والربط المباشر بالفوترة الضريبية.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={selectedCount === 0}
              className="px-5 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>حفظ وتثبيت سند التسليم (Save Delivery Note)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
