import React, { useState, useRef } from 'react';
import { PurchaseOrder, MaterialReceiptRecord, Project, Invoice } from '../types';
import {
  PackageCheck,
  X,
  Upload,
  Sparkles,
  Receipt,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Truck,
  ArrowRight,
  Info,
  Check,
  Layers,
  RotateCcw,
  ArrowLeft,
  Share2,
  Printer,
  ChevronLeft,
  Building,
} from 'lucide-react';

interface ReceiveMaterialsModalProps {
  isOpen: boolean;
  po: PurchaseOrder;
  project?: Project;
  onClose: () => void;
  onSaveReceipt: (poId: string, receipt: MaterialReceiptRecord, updatedPOItems: PurchaseOrder['items']) => void;
  onCreateDeliveryNoteFromReceipt?: (po: PurchaseOrder, receipt: MaterialReceiptRecord) => void;
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
}

export const ReceiveMaterialsModal: React.FC<ReceiveMaterialsModalProps> = ({
  isOpen,
  po,
  project,
  onClose,
  onSaveReceipt,
  onCreateDeliveryNoteFromReceipt,
  onInvoiceToClient,
}) => {
  const [activeMethod, setActiveMethod] = useState<'manual' | 'ai_upload'>('manual');
  const [receiptNumber, setReceiptNumber] = useState(
    `MR-${po.poNumber.replace(/[^a-zA-Z0-9]/g, '')}-${(po.materialReceipts?.length || 0) + 1}`
  );
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierDeliveryNoteNo, setSupplierDeliveryNoteNo] = useState('');
  const [deliveryNoteDate, setDeliveryNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiverName, setReceiverName] = useState('Eng. Mokhtar Yousef');
  const [destinationTag, setDestinationTag] = useState<'direct_site' | 'central_warehouse'>('direct_site');
  const [notes, setNotes] = useState('');

  // AI OCR state
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [docName, setDocName] = useState<string | null>(null);
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null);
  const [aiParsedSuccess, setAiParsedSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Workflow & State Persistence: When saved, keep context and show confirmation router view
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    receipt: MaterialReceiptRecord;
    updatedItems: PurchaseOrder['items'];
  } | null>(null);

  // Per-item receipt tracking: current receipt qty
  // calculate already delivered quantities across previous receipts
  const getAlreadyReceived = (itemId: string, itemDeliveredQty?: number) => {
    if (itemDeliveredQty !== undefined && itemDeliveredQty > 0) return itemDeliveredQty;
    let sum = 0;
    po?.materialReceipts?.forEach((r) => {
      const match = (r.receivedItems || []).find((it) => it.poItemId === itemId);
      if (match) sum += (match.receivedQty || 0);
    });
    return sum;
  };

  const [receivedMap, setReceivedMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    (po?.items || []).forEach((item) => {
      // Default to 0 (unreceived) to prevent false-completion bug
      map[item.id] = 0;
    });
    return map;
  });

  if (!isOpen) return null;

  // Handle AI Upload / Document Parser simulation for Supplier Delivery Notes
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocName(file.name);
    setIsParsingDoc(true);
    setAiParsedSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setDocDataUrl(dataUrl);

      // Simulate AI Parsing of the Supplier Delivery Note
      setTimeout(() => {
        setIsParsingDoc(false);
        // Auto-extract note number & date if possible
        const generatedNoteNo = `DN-${Math.floor(100000 + Math.random() * 900000)}`;
        setSupplierDeliveryNoteNo(generatedNoteNo);

        // Smartly map items & extract quantities from delivery note
        const updatedMap: Record<string, number> = {};
        po.items.forEach((item) => {
          const already = getAlreadyReceived(item.id, item.deliveredQty);
          const remaining = Math.max(0, item.quantity - already);
          // AI maps full remaining or partial based on file
          updatedMap[item.id] = remaining;
        });

        setReceivedMap(updatedMap);
        setAiParsedSuccess(
          `تم استخراج البيانات بنجاح من إشعار التوريد: رقم الإشعار ${generatedNoteNo} وتم مطابقة ${po.items.length} بنود مع أمر الشراء ${po.poNumber}.`
        );
      }, 1200);
    };
    reader.readAsDataURL(file);
  };

  const handleReceiveAllRemaining = () => {
    const updatedMap: Record<string, number> = {};
    po.items.forEach((item) => {
      const already = getAlreadyReceived(item.id, item.deliveredQty);
      updatedMap[item.id] = Math.max(0, item.quantity - already);
    });
    setReceivedMap(updatedMap);
  };

  const handleClearAll = () => {
    const updatedMap: Record<string, number> = {};
    po.items.forEach((item) => {
      updatedMap[item.id] = 0;
    });
    setReceivedMap(updatedMap);
  };

  // Check total receiving now
  const totalReceivingNow = Object.values(receivedMap).reduce((s, q) => s + (Number(q) || 0), 0);

  const processReceiptExecution = (isInvoicedToClient: boolean = false) => {
    if (totalReceivingNow <= 0) {
      alert('يرجى إدخال كمية مستلمة واحدة على الأقل أكبر من الصفر.');
      return null;
    }

    const receivedItemsData = po.items
      .filter((it) => (receivedMap[it.id] || 0) > 0)
      .map((it) => ({
        poItemId: it.id,
        itemNo: it.itemNo,
        description: it.description,
        orderedQty: it.quantity,
        receivedQty: Number(receivedMap[it.id]) || 0,
        unitPrice: it.unitPrice,
        unit: it.unit || 'EA',
      }));

    const receipt: MaterialReceiptRecord = {
      id: `rcpt-${Date.now()}`,
      receiptNumber,
      receiptDate,
      supplierDeliveryNoteNo: supplierDeliveryNoteNo || undefined,
      deliveryNoteDate: deliveryNoteDate || undefined,
      poId: po.id,
      poNumber: po.poNumber,
      projectId: po.projectId,
      projectName: po.projectName,
      vendorName: po.vendorName,
      receivedItems: receivedItemsData,
      receiverName,
      destinationTag,
      notes,
      attachedDocName: docName || undefined,
      attachedDocData: docDataUrl || undefined,
      invoicedToClient: isInvoicedToClient,
      createdAt: new Date().toISOString(),
    };

    // Calculate new deliveredQty and statuses for PO
    const updatedItems = po.items.map((it) => {
      const currentlyReceiving = Number(receivedMap[it.id]) || 0;
      const already = getAlreadyReceived(it.id, it.deliveredQty);
      const newTotalDelivered = already + currentlyReceiving;

      let newStatus: PurchaseOrder['deliveryStatus'] = 'Not yet';
      if (newTotalDelivered >= it.quantity) {
        newStatus = 'Delivered';
      } else if (newTotalDelivered > 0) {
        newStatus = 'Partial Delivered';
      }

      return {
        ...it,
        deliveredQty: newTotalDelivered,
        deliveryStatus: newStatus,
      };
    });

    onSaveReceipt(po.id, receipt, updatedItems);
    setSubmittedReceipt({ receipt, updatedItems });
    return { receipt, updatedItems, receivedItemsData };
  };

  const handleSaveOnly = () => {
    processReceiptExecution(false);
  };

  const handleSaveAndInvoiceClient = () => {
    const res = processReceiptExecution(true);
    if (!res) return;

    if (onInvoiceToClient) {
      onInvoiceToClient({
        projectId: po.projectId,
        receipt: res.receipt,
        itemsToInvoice: res.receivedItemsData.map((ri) => ({
          description: ri.description,
          quantity: ri.receivedQty,
          unit: ri.unit || 'EA',
          unitPrice: Math.round(ri.unitPrice * 1.25),
          sourceItemId: ri.poItemId,
        })),
      });
    }
  };

  const handleResetForAnotherBatch = () => {
    if (!submittedReceipt) return;
    const nextReceiptNum = `MR-${po.poNumber.replace(/[^a-zA-Z0-9]/g, '')}-${(po.materialReceipts?.length || 0) + 2}`;
    setReceiptNumber(nextReceiptNum);
    setSupplierDeliveryNoteNo('');
    setDocName(null);
    setDocDataUrl(null);
    setAiParsedSuccess(null);

    // Recalculate remaining based on updated items
    const newMap: Record<string, number> = {};
    submittedReceipt.updatedItems.forEach((it) => {
      const remaining = Math.max(0, it.quantity - (it.deliveredQty || 0));
      newMap[it.id] = remaining;
    });
    setReceivedMap(newMap);
    setSubmittedReceipt(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#1e3a8a] to-[#152e6f] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold">
              <PackageCheck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">
                  استلام وتوريد المواد من المورد (Receive Materials & Backorder Tracking)
                </h3>
                <span className="bg-blue-500/30 text-blue-100 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {po.poNumber}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                المورد: <span className="font-semibold text-white">{po.vendorName}</span> | المشروع: <span className="font-semibold text-white">{po.projectName}</span>
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

        {/* Confirmation & Routing View (Interface Persistence after execution) */}
        {submittedReceipt ? (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[75vh]">
            {/* Success Banner */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-5 text-right space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-emerald-950">
                    تم تأكيد وحفظ سند استلام المواد بنجاح (Receipt Execution Confirmed)
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    تم تحديث أرصدة أمر الشراء <span className="font-mono font-bold">{po.poNumber}</span> وتوجيه الكميات المستلمة لتكون جاهزة للتسليم للعميل والفوترة.
                  </p>
                </div>
              </div>

              {/* Receipt Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">رقم سند الاستلام</span>
                  <span className="font-mono font-bold text-emerald-900 text-sm">
                    #{submittedReceipt.receipt.receiptNumber}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">تاريخ الاستلام</span>
                  <span className="font-mono font-bold text-slate-800">
                    {submittedReceipt.receipt.receiptDate}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">إشعار تسليم المورد</span>
                  <span className="font-mono font-bold text-blue-900">
                    {submittedReceipt.receipt.supplierDeliveryNoteNo || 'مباشر بالموقع'}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-slate-500 block">الأصناف المستلمة الآن</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {submittedReceipt.receipt.receivedItems.length} بنود (
                    {submittedReceipt.receipt.receivedItems.reduce((s, i) => s + i.receivedQty, 0)} قطعة)
                  </span>
                </div>
              </div>
            </div>

            {/* Backorder Tracking & Remaining Items Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1e3a8a]" />
                  <h5 className="text-xs font-bold text-slate-900">
                    حالة بنود أمر الشراء المتبقية بعد الاستلام (Backorder & Remaining Balance)
                  </h5>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs text-xs">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5 text-center w-12">#</th>
                      <th className="p-2.5">وصف البند</th>
                      <th className="p-2.5 text-center w-24">الكمية بأمر الشراء</th>
                      <th className="p-2.5 text-center w-24 bg-emerald-50 text-emerald-900">المستلم التراكمي</th>
                      <th className="p-2.5 text-center w-24">المتبقي (Backorder)</th>
                      <th className="p-2.5 text-center w-28">حالة البند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submittedReceipt.updatedItems.map((item, idx) => {
                      const delivered = item.deliveredQty || 0;
                      const remaining = Math.max(0, item.quantity - delivered);
                      const isComplete = delivered >= item.quantity;

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                          <td className="p-2.5 text-center font-bold text-slate-500">
                            {item.itemNo || idx + 1}
                          </td>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-900">{item.description}</span>
                          </td>
                          <td className="p-2.5 text-center font-bold font-mono text-slate-700">
                            {item.quantity} {item.unit || 'EA'}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                            {delivered} {item.unit || 'EA'}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">
                            <span className={remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                              {remaining} {item.unit || 'EA'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {isComplete ? (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>مكتمل التوريد</span>
                              </span>
                            ) : delivered > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800">
                                توريد جزئي
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600">
                                قيد الانتظار
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

            {/* Next Workflow Action Cards */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-slate-800">
                الخطوة التالية المتاحة (Next Workflow Actions):
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Create Delivery Note */}
                <button
                  type="button"
                  onClick={() => {
                    if (onCreateDeliveryNoteFromReceipt) {
                      onCreateDeliveryNoteFromReceipt(po, submittedReceipt.receipt);
                    }
                    onClose();
                  }}
                  className="p-4 bg-gradient-to-br from-emerald-600 to-[#007A5A] hover:from-emerald-700 hover:to-[#00664B] text-white rounded-xl text-right space-y-2 shadow-xs transition hover:shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <Truck className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition" />
                    <ChevronLeft className="w-4 h-4 text-emerald-200" />
                  </div>
                  <div>
                    <h6 className="font-bold text-xs">إصدار سند تسليم للعميل</h6>
                    <p className="text-[11px] text-emerald-100 mt-0.5 leading-snug">
                      تجهيز سند تسليم (Delivery Note) بالمواد المستلمة لتسليمها للعميل في الموقع.
                    </p>
                  </div>
                </button>

                {/* 2. Invoice to Client */}
                <button
                  type="button"
                  onClick={() => {
                    if (onInvoiceToClient) {
                      onInvoiceToClient({
                        projectId: po.projectId,
                        receipt: submittedReceipt.receipt,
                        itemsToInvoice: submittedReceipt.receipt.receivedItems.map((ri) => ({
                          description: ri.description,
                          quantity: ri.receivedQty,
                          unit: ri.unit || 'EA',
                          unitPrice: Math.round(ri.unitPrice * 1.25),
                          sourceItemId: ri.poItemId,
                        })),
                      });
                    }
                    onClose();
                  }}
                  className="p-4 bg-gradient-to-br from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white rounded-xl text-right space-y-2 shadow-xs transition hover:shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <Receipt className="w-5 h-5 text-blue-200 group-hover:scale-110 transition" />
                    <ChevronLeft className="w-4 h-4 text-blue-200" />
                  </div>
                  <div>
                    <h6 className="font-bold text-xs">إصدار فاتورة ضريبية للعميل</h6>
                    <p className="text-[11px] text-blue-100 mt-0.5 leading-snug">
                      توليد فاتورة ضريبية مطابقة فوراً بالكميات المستلمة لتحصيل المبالغ.
                    </p>
                  </div>
                </button>

                {/* 3. Receive Another Batch */}
                <button
                  type="button"
                  onClick={handleResetForAnotherBatch}
                  className="p-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-right space-y-2 shadow-xs transition hover:shadow-md cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <RotateCcw className="w-5 h-5 text-[#1e3a8a] group-hover:rotate-180 transition duration-300" />
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <h6 className="font-bold text-xs text-[#1e3a8a]">استلام دفعة إضافية من الأمر</h6>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      تسجيل إشعار استلام جديد لباقي بنود أمر الشراء دون مغادرة الشاشة.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Main Input Form */
          <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[75vh]">
            {/* Method Selector Tabs */}
            <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveMethod('manual')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeMethod === 'manual'
                    ? 'bg-white text-[#1e3a8a] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 text-[#1e3a8a]" />
                <span>إدخال يدوي للكميات المستلمة (Manual Input)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMethod('ai_upload')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeMethod === 'ai_upload'
                    ? 'bg-gradient-to-r from-emerald-600 to-[#007A5A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>رفع إشعار توريد المورد الذكي (AI Delivery Note Upload)</span>
              </button>
            </div>

            {/* AI Upload Section */}
            {activeMethod === 'ai_upload' && (
              <div className="p-5 bg-emerald-50/60 border-2 border-dashed border-emerald-300 rounded-2xl text-center space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    اسحب وأفلت إشعار تسليم المورد (Supplier Delivery Note) أو اضغط للاختيار
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
                    يقوم الذكاء الاصطناعي باستخراج رقم إشعار التوريد، التاريخ، والكميات الموردة فعلياً ومطابقتها مباشرة مع بنود أمر الشراء {po.poNumber}.
                  </p>
                </div>

                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isParsingDoc}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isParsingDoc ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                        <span>جاري فك تشفير وقراءة إشعار التوريد...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>اختر ملف إشعار التوريد (PDF / صورة)</span>
                      </>
                    )}
                  </button>
                </div>

                {aiParsedSuccess && (
                  <div className="bg-white p-3 rounded-xl border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 text-right">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{aiParsedSuccess}</span>
                  </div>
                )}
              </div>
            )}

            {/* Receipt Metadata Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  رقم سند الاستلام الداخلي (Receipt No.)
                </label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-bold text-[#1e3a8a]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  تاريخ الاستلام (Receipt Date)
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  رقم إشعار تسليم المورد (Supplier DN #)
                </label>
                <input
                  type="text"
                  placeholder="مثال: DN-78910"
                  value={supplierDeliveryNoteNo}
                  onChange={(e) => setSupplierDeliveryNoteNo(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-mono font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  المستلم المسؤول في الموقع
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded font-medium text-slate-800"
                />
              </div>
            </div>

            {/* Material Destination Tag Selector */}
            <div className="p-3.5 bg-sky-50/60 dark:bg-slate-800/40 border border-sky-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  وجهة توجيه المواد المستلمة (Material Destination Tag):
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  حدد ما إذا كانت البضاعة موردة مباشرة لموقع المشروع أو مودعة في المستودع المركزي.
                </span>
              </div>
              <div className="inline-flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDestinationTag('direct_site')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    destinationTag === 'direct_site'
                      ? 'bg-[#174A84] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>توريد مباشر لموقع المشروع (Direct Site)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationTag('central_warehouse')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    destinationTag === 'central_warehouse'
                      ? 'bg-[#007A5A] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>إيداع مستودع RMT المركزي (Central Warehouse)</span>
                </button>
              </div>
            </div>

            {/* Items Receiving & Backorder Table */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1e3a8a]" />
                  <h4 className="text-xs font-bold text-slate-900">
                    جدول بنود أمر الشراء وتتبع الاستلام المتبقي (Backorder Tracking)
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReceiveAllRemaining}
                    className="px-2.5 py-1 bg-blue-50 text-[#1e3a8a] hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                  >
                    استلام كامل الكميات المتبقية
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                  >
                    تصفير
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5 text-center w-12">#</th>
                      <th className="p-2.5">وصف البند / الصنف</th>
                      <th className="p-2.5 text-center w-20">الكمية بأمر الشراء</th>
                      <th className="p-2.5 text-center w-20">المستلم سابقاً</th>
                      <th className="p-2.5 text-center w-28 bg-blue-50 text-[#1e3a8a]">
                        المستلم الآن بهذا الإشعار
                      </th>
                      <th className="p-2.5 text-center w-20">المتبقي (Backorder)</th>
                      <th className="p-2.5 text-center w-24">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {po.items.map((item, idx) => {
                      const alreadyReceived = getAlreadyReceived(item.id, item.deliveredQty);
                      const receivingNow = Number(receivedMap[item.id]) || 0;
                      const remainingAfter = Math.max(0, item.quantity - (alreadyReceived + receivingNow));
                      const isFullyDelivered = alreadyReceived + receivingNow >= item.quantity;

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="p-2.5 text-center font-bold text-slate-500">
                            {item.itemNo || idx + 1}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-900 leading-snug">
                              {item.description}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              سعر الشراء: {item.unitPrice.toLocaleString()} SAR / {item.unit || 'EA'}
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-bold font-mono text-slate-800">
                            {item.quantity} {item.unit || 'EA'}
                          </td>
                          <td className="p-2.5 text-center font-bold font-mono text-slate-600">
                            {alreadyReceived}
                          </td>
                          <td className="p-2.5 text-center bg-blue-50/60">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity - alreadyReceived}
                              value={receivedMap[item.id] !== undefined ? receivedMap[item.id] : 0}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setReceivedMap((prev) => ({
                                  ...prev,
                                  [item.id]: val,
                                }));
                              }}
                              className="w-20 p-1.5 text-center bg-white border border-blue-300 rounded font-mono font-black text-blue-900 focus:outline-blue-600 shadow-2xs mx-auto block"
                            />
                          </td>
                          <td className="p-2.5 text-center font-bold font-mono">
                            <span
                              className={
                                remainingAfter > 0 ? 'text-amber-600 font-black' : 'text-emerald-600'
                              }
                            >
                              {remainingAfter}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {isFullyDelivered ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>مكتمل</span>
                              </span>
                            ) : alreadyReceived + receivingNow > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                توريد جزئي
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                غير مستلم
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

            {/* Notes textarea */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ملاحظات الاستلام والفحص الفني (Quality / Inspection Notes)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: البضاعة مطابقة للمواصفات وفي حالة سليمة مع شهادات المنشأ والاختبار..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {submittedReceipt ? (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500">
                سند الاستلام مسجل ومثبت بالنظام. يمكنك إغلاق الشاشة أو الانتقال للإجراء التالي.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                الانتهاء والعودة لقائمة أوامر الشراء
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  إجمالي الأصناف الجاري استلامها:{' '}
                  <strong className="text-slate-900 font-mono font-bold">{totalReceivingNow}</strong> قطعة
                </span>
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
                  onClick={handleSaveOnly}
                  className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#152e6f] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ سند استلام المواد</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndInvoiceClient}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-[#007A5A] hover:from-emerald-700 hover:to-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  title="حفظ الاستلام والانتقال الفوري لإصدار فاتورة مطابقة للعميل"
                >
                  <Receipt className="w-4 h-4" />
                  <span>حفظ وإصدار فاتورة للعميل</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
