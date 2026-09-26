import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  Project,
  SupplierQuotation,
  Supplier,
  AttachedPOFile,
  PricedItemRecord,
  User,
} from '../types';
import { isSuperAdmin, hasPermission } from '../utils/rbacUtils';
import {
  calculatePOTotals,
  getNextPONumber,
  exportPurchaseOrderToPDF,
  extractPOItemsFromExcelBuffer,
} from '../utils/purchaseOrderUtils';
import { getSavedSignature } from '../utils/signatureStorage';
import { bindSupplierQuotationToPO } from '../logic/ProcurementBinding';
import { MobileViewerTopBar, useModalBackDismiss } from './MobileViewerTopBar';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Building,
  Calendar,
  DollarSign,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Printer,
  Sparkles,
  Upload,
  Paperclip,
  FileSpreadsheet,
  Download,
  CheckCircle,
} from 'lucide-react';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (po: PurchaseOrder) => void;
  projects: Project[];
  supplierQuotations: SupplierQuotation[];
  suppliers: Supplier[];
  existingPurchaseOrders: PurchaseOrder[];
  currentUser?: User | null;
  initialPO?: PurchaseOrder | null;
  preselectedProjectId?: string;
  preselectedSupplierQuoteId?: string;
  prefillPricedItem?: PricedItemRecord | null;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  projects,
  supplierQuotations,
  suppliers,
  existingPurchaseOrders,
  currentUser,
  initialPO,
  preselectedProjectId,
  preselectedSupplierQuoteId,
  prefillPricedItem,
}) => {
  const { corporate, financial } = useMasterEnterpriseStore();

  const canApprove = useMemo(() => {
    if (!currentUser) return true;
    if (isSuperAdmin(currentUser)) return true;
    return hasPermission(currentUser, 'canApprovePO');
  }, [currentUser]);

  // Mobile & hardware back button dismiss support
  useModalBackDismiss(onClose);

  // Selected Target Project
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return (
      initialPO?.projectId ||
      preselectedProjectId ||
      projects[0]?.id ||
      ''
    );
  });

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Supplier quotations linked to this project
  const projectSupplierQuotes = supplierQuotations.filter(
    (sq) => sq.projectId === selectedProjectId
  );

  // Form State
  const [poNumber, setPoNumber] = useState<string>(() => {
    return initialPO ? initialPO.poNumber : getNextPONumber(existingPurchaseOrders);
  });

  const [date, setDate] = useState<string>(() => {
    if (initialPO?.date) return initialPO.date;
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${now.getDate()}-${months[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;
  });

  const [projectRef, setProjectRef] = useState<string>(() => {
    return initialPO?.projectRef || activeProject?.projectNumber || 'RM012691 - 01';
  });

  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    return initialPO?.deliveryDate || '10-Nov-26';
  });

  const [quotationRef, setQuotationRef] = useState<string>(() => {
    return initialPO?.quotationRef || '';
  });

  // Vendor Information
  const [vendorName, setVendorName] = useState<string>(() => initialPO?.vendorName || '');
  const [vendorContactPerson, setVendorContactPerson] = useState<string>(() => initialPO?.vendorContactPerson || '');
  const [vendorPhoneEmail, setVendorPhoneEmail] = useState<string>(() => initialPO?.vendorPhoneEmail || '');
  const [vendorAddress, setVendorAddress] = useState<string>(() => initialPO?.vendorAddress || '');
  const [vendorVatNo, setVendorVatNo] = useState<string>(() => initialPO?.vendorVatNo || '');

  // Line items
  const [items, setItems] = useState<PurchaseOrderItem[]>(() => {
    if (initialPO?.items && initialPO.items.length > 0) {
      return initialPO.items.map((it, idx) => ({
        ...it,
        id: it.id || `item-${Date.now()}-${idx + 1}`,
        discount: it.discount || 0,
        discountPercent: it.discountPercent || 0,
        discountType: it.discountType || (it.discountPercent ? 'percent' : 'amount'),
      }));
    }
    return [
      {
        id: `item-${Date.now()}-1`,
        itemNo: 1,
        description: 'Extinguisher. Portable Type. 20 Lbs (9 Kgs). Dry Chemical Powder.\nSFFECO. Model SF-DC-UL10. UL Listed.',
        quantity: 30,
        unit: 'EA',
        unitPrice: 764,
        discount: 0,
        discountPercent: 0,
        discountType: 'amount',
        totalPrice: 22920,
      },
    ];
  });

  const [discount, setDiscount] = useState<number>(() => initialPO?.discount || 0);
  const [status, setStatus] = useState<PurchaseOrder['status']>(() => {
    if (initialPO?.status) return initialPO.status;
    if (!canApprove) return 'Draft';
    return 'Issued';
  });
  const [approvalComments, setApprovalComments] = useState<string>(() => initialPO?.approvalComments || '');
  const [thresholdLimit, setThresholdLimit] = useState<number>(() => initialPO?.thresholdLimit || 50000);

  // Excel Attachment State
  const [attachedExcelFile, setAttachedExcelFile] = useState<AttachedPOFile | undefined>(() => initialPO?.attachedExcelFile);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingExcel(true);
    setExcelSuccessMsg(null);

    try {
      const buffer = await file.arrayBuffer();

      // Read as data URL for persistent download/preview
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const extracted = extractPOItemsFromExcelBuffer(buffer);

      if (extracted.items && extracted.items.length > 0) {
        setItems(extracted.items);
        if (extracted.vendorName && !vendorName) setVendorName(extracted.vendorName);
        if (extracted.quotationRef && !quotationRef) setQuotationRef(extracted.quotationRef);
        setExcelSuccessMsg(
          `تم إرفاق ملف الإكسل "${file.name}" بنجاح واستيراد ${extracted.items.length} بند تلقائياً في جدول أمر الشراء!`
        );
      } else {
        setExcelSuccessMsg(`تم إرفاق ملف الإكسل "${file.name}" بنجاح كمرفق رسمي لأمر الشراء.`);
      }

      setAttachedExcelFile({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        uploadedAt: new Date().toLocaleDateString('en-CA'),
        dataUrl,
        extractedItemsCount: extracted.items.length,
      });
    } catch (err) {
      console.error('Error handling Excel attachment:', err);
      alert('حدث خطأ أثناء قراءة ملف الإكسل.');
    } finally {
      setIsUploadingExcel(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = '';
      }
    }
  };

  // Terms
  const [paymentMethod, setPaymentMethod] = useState<string>(() => initialPO?.paymentTerms.method || 'Bank Transfer');
  const [paymentSchedule, setPaymentSchedule] = useState<string>(() => initialPO?.paymentTerms.schedule || '50% Advance / 50% on Delivery');
  const [paymentCurrency, setPaymentCurrency] = useState<string>(() => initialPO?.paymentTerms.currency || 'SAR');
  const [bankDetails, setBankDetails] = useState<string>(() => {
    if (initialPO?.paymentTerms?.bankDetails) return initialPO.paymentTerms.bankDetails;
    if (vendorName.toLowerCase().includes('kanani') || vendorName.toLowerCase().includes('هادي')) {
      return 'Bank: AL INMA Bank   IBAN: SA65 0500 0068 2028 2549 7000';
    }
    return 'Bank: AL INMA Bank   IBAN: SA65 0500 0068 2028 2549 7000';
  });

  const [deliveryMethod, setDeliveryMethod] = useState<string>(() => initialPO?.deliveryTerms.method || 'DDP');
  const [deliveryShipping, setDeliveryShipping] = useState<string>(() => initialPO?.deliveryTerms.shipping || 'Land Transport');
  const [partialShipment, setPartialShipment] = useState<'Allowed' | 'Not Allowed'>(() => initialPO?.deliveryTerms.partialShipment || 'Allowed');
  const [deliveryLocation, setDeliveryLocation] = useState<string>(() => initialPO?.deliveryTerms.location || 'Eastern Province - Dahran - Block 13');

  // Contract Terms
  const [includedTerms, setIncludedTerms] = useState<string[]>(() => {
    return initialPO?.contractTerms.included || [
      'Supplier shall provide the technical data sheet for each item.',
      'Delivery shall as agreed date to Dammam Warehouse.',
      'Supplier shall provide 12 months warranty from the date of delivery against manufacturing defects.',
    ];
  });

  const [excludedTerms, setExcludedTerms] = useState<string[]>(() => {
    return initialPO?.contractTerms.excluded || [
      'Installation',
      'Unloading at Site',
      'Site Preparation',
    ];
  });

  const [notes, setNotes] = useState<string>(() => initialPO?.notes || 'This Purchase Order is valid only when signed and stamped by authorized personnel.');

  // Authorization
  const [preparedByName, setPreparedByName] = useState<string>(() => initialPO?.authorization.preparedBy.name || 'Medhat Al Brahim');
  const [preparedByTitle, setPreparedByTitle] = useState<string>(() => initialPO?.authorization.preparedBy.title || 'Procurement Officer');
  const [reviewedByName, setReviewedByName] = useState<string>(() => initialPO?.authorization.reviewedBy.name || 'Mokhtar Yousef');
  const [reviewedByTitle, setReviewedByTitle] = useState<string>(() => initialPO?.authorization.reviewedBy.title || 'Projects Manager');
  const [approvedByName, setApprovedByName] = useState<string>(() => initialPO?.authorization.approvedBy.name || 'Abdullah Al Moaili');
  const [approvedByTitle, setApprovedByTitle] = useState<string>(() => initialPO?.authorization.approvedBy.title || 'General Manager');

  // Load from Preselected Supplier Quote
  useEffect(() => {
    if (preselectedSupplierQuoteId && !initialPO) {
      const quote = supplierQuotations.find((sq) => sq.id === preselectedSupplierQuoteId);
      if (quote) {
        populateFromSupplierQuote(quote);
      }
    }
  }, [preselectedSupplierQuoteId]);

  // Load from Priced Item Record (when issued from Priced Items library)
  useEffect(() => {
    if (prefillPricedItem && !initialPO) {
      if (prefillPricedItem.projectId) {
        setSelectedProjectId(prefillPricedItem.projectId);
      }
      setVendorName(prefillPricedItem.supplierName || '');
      setQuotationRef(prefillPricedItem.supplierQuoteNo || prefillPricedItem.quotationNumber || '');
      
      const qty = prefillPricedItem.quantity || 1;
      const price = prefillPricedItem.supplierUnitPrice || 0;

      setItems([
        {
          id: `po-it-${Date.now()}-1`,
          itemNo: 1,
          description: prefillPricedItem.description,
          quantity: qty,
          unit: prefillPricedItem.unit || 'EA',
          unitPrice: price,
          totalPrice: price * qty,
        },
      ]);
    }
  }, [prefillPricedItem]);

  // Handler to populate fields from a Supplier Quotation
  const populateFromSupplierQuote = (sq: SupplierQuotation) => {
    const bound = bindSupplierQuotationToPO(sq, suppliers, {
      vendorName: sq.supplierName,
      quotationRef: sq.quotationNumber,
      projectId: sq.projectId,
      vendorVatNo: (sq as any).vatNumber || (sq as any).vatNo || '',
    });

    setVendorName(bound.vendorName);
    setQuotationRef(bound.quotationRef);
    if (bound.projectId) {
      setSelectedProjectId(bound.projectId);
    }
    if (bound.vendorVatNo) {
      setVendorVatNo(bound.vendorVatNo);
    }

    // Try finding matching supplier in directory for contact info
    const matchedSupplier = suppliers.find(
      (s) => s.id === sq.supplierId || s.name.toLowerCase().includes(sq.supplierName.toLowerCase())
    );

    if (matchedSupplier) {
      setVendorContactPerson(matchedSupplier.contactPerson || '');
      setVendorPhoneEmail(`${matchedSupplier.mobile || ''} - ${matchedSupplier.email || ''}`);
      setVendorAddress(matchedSupplier.address || 'Dammam - King Saud ST');
      setVendorVatNo(matchedSupplier.vatNumber || matchedSupplier.vatNo || bound.vendorVatNo || '310179638200003');
      if (matchedSupplier.name.toLowerCase().includes('kanani') || matchedSupplier.name.toLowerCase().includes('هادي')) {
        setBankDetails('Bank: AL INMA Bank   IBAN: SA65 0500 0068 2028 2549 7000');
      }
    } else if (sq.supplierName.toLowerCase().includes('kanani') || sq.supplierName.toLowerCase().includes('هادي')) {
      setVendorContactPerson('Fayez Ahmed');
      setVendorPhoneEmail('+966506761930 - f.ahmed@hkenani.com');
      setVendorAddress('Contracting Services MEP - ELV - O&M');
      setVendorVatNo('311984726100003');
      setBankDetails('Bank: AL INMA Bank   IBAN: SA65 0500 0068 2028 2549 7000');
    } else {
      setVendorContactPerson('Sales Manager');
      setVendorPhoneEmail('sales@vendor.com');
      setVendorAddress('Dammam, Eastern Province');
      if (!bound.vendorVatNo) {
        setVendorVatNo('310179638200003');
      }
    }

    if (sq.items && sq.items.length > 0) {
      setItems(
        sq.items.map((it, idx) => ({
          id: `po-it-${Date.now()}-${idx}`,
          itemNo: idx + 1,
          description: `${it.description}${it.model ? `\nModel: ${it.model}` : ''}${it.manufacturer ? ` - ${it.manufacturer}` : ''}`,
          quantity: it.quantity,
          unit: it.unit || 'EA',
          unitPrice: it.supplierUnitPrice,
          discount: 0,
          discountPercent: 0,
          discountType: 'amount',
          totalPrice: it.supplierTotalPrice,
        }))
      );
    }
  };

  // Re-calculate financial totals whenever items or discount change
  const totals = calculatePOTotals(items, discount, financial.defaultVat || 15);

  // Line item change handlers
  const handleItemChange = (
    index: number,
    field: keyof PurchaseOrderItem,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      const qty = field === 'quantity' ? Math.max(0, Number(value) || 0) : Math.max(0, Number(item.quantity) || 0);
      const price = field === 'unitPrice' ? Math.max(0, Number(value) || 0) : Math.max(0, Number(item.unitPrice) || 0);
      const gross = qty * price;

      let lineDisc = 0;
      if (field === 'discountPercent' || (item.discountType === 'percent' && field !== 'discount')) {
        const pct = field === 'discountPercent' ? Math.min(100, Math.max(0, Number(value) || 0)) : Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
        lineDisc = Number(((gross * pct) / 100).toFixed(2));
        item.discountPercent = pct;
        item.discount = lineDisc;
        item.discountType = 'percent';
      } else {
        const amt = field === 'discount' ? Math.min(gross, Math.max(0, Number(value) || 0)) : Math.min(gross, Math.max(0, Number(item.discount) || 0));
        lineDisc = amt;
        item.discount = amt;
        item.discountPercent = gross > 0 ? Number(((amt / gross) * 100).toFixed(1)) : 0;
        if (field === 'discount') {
          item.discountType = 'amount';
        }
      }

      item.quantity = qty;
      item.unitPrice = price;
      item.totalPrice = Number(Math.max(0, gross - lineDisc).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `po-it-${Date.now()}`,
        itemNo: prev.length + 1,
        description: '',
        quantity: 1,
        unit: 'EA',
        unitPrice: 0,
        discount: 0,
        discountPercent: 0,
        discountType: 'amount',
        totalPrice: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((it, i) => ({ ...it, itemNo: i + 1 }));
    });
  };

  const handleAddIncludedTerm = () => {
    const text = prompt('أدخل بنداً مشمولاً في نطاق أمر الشراء:');
    if (text?.trim()) {
      setIncludedTerms((prev) => [...prev, text.trim()]);
    }
  };

  const handleAddExcludedTerm = () => {
    const text = prompt('أدخل بنداً مستثنى من نطاق أمر الشراء:');
    if (text?.trim()) {
      setExcludedTerms((prev) => [...prev, text.trim()]);
    }
  };

  const handleSavePO = () => {
    if (!selectedProjectId || !selectedProjectId.trim()) {
      alert('خطأ حوكمة: يلزم اختيار المشروع المرتبط (Project ID) لإنشاء وتوثيق أمر الشراء.');
      return;
    }
    if (!vendorName.trim()) {
      alert('يرجى تحديد أو إدخال اسم الموزع / المورد.');
      return;
    }
    if (items.length === 0) {
      alert('يرجى إدخال بند واحد على الأقل في أمر الشراء.');
      return;
    }

    if (activeProject) {
      const projectBudget = Number(activeProject.budget || activeProject.contractValue || 0);
      const totalPoVal = totals.grandTotal;
      if (projectBudget > 0 && totalPoVal > projectBudget) {
        const confirmOver = confirm(
          `تنبيه حوكمة الميزانية: قيمة أمر الشراء (${totalPoVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س) تتجاوز ميزانية المشروع المعتمدة (${projectBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س).\n\nهل ترغب بالمتابعة وتقييد أمر الشراء بانتظار اعتماد الإدارة العليا؟`
        );
        if (!confirmOver) return;
      }
    }

    const newPO: PurchaseOrder = {
      id: initialPO ? initialPO.id : `po-${Date.now()}`,
      poNumber,
      date,
      projectId: selectedProjectId,
      projectName: activeProject?.name || 'Project',
      projectRef,
      deliveryDate,
      quotationRef,
      vendorName,
      vendorContactPerson,
      vendorPhoneEmail,
      vendorAddress,
      vendorVatNo,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      totalAfterDiscount: totals.totalAfterDiscount,
      vatPercent: totals.vatPercent,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      paymentTerms: {
        method: paymentMethod,
        schedule: paymentSchedule,
        currency: paymentCurrency,
        bankDetails,
      },
      deliveryTerms: {
        method: deliveryMethod,
        shipping: deliveryShipping,
        partialShipment,
        location: deliveryLocation,
      },
      contractTerms: {
        included: includedTerms,
        excluded: excludedTerms,
      },
      notes,
      authorization: {
        preparedBy: { 
          name: preparedByName, 
          title: preparedByTitle,
          signatureUrl: initialPO?.authorization?.preparedBy?.signatureUrl || getSavedSignature('projects_manager') || getSavedSignature(preparedByName.trim())
        },
        reviewedBy: { 
          name: reviewedByName, 
          title: reviewedByTitle,
          signatureUrl: initialPO?.authorization?.reviewedBy?.signatureUrl || getSavedSignature('finance_accounts') || getSavedSignature(reviewedByName.trim())
        },
        approvedBy: { 
          name: approvedByName, 
          title: approvedByTitle,
          signatureUrl: initialPO?.authorization?.approvedBy?.signatureUrl || getSavedSignature('general_manager') || getSavedSignature(approvedByName.trim())
        },
      },
      approvedBy: status === 'Approved' ? {
        name: approvedByName,
        title: approvedByTitle,
        signatureUrl: initialPO?.authorization?.approvedBy?.signatureUrl || getSavedSignature('general_manager') || getSavedSignature(approvedByName.trim())
      } : (initialPO?.approvedBy || undefined),
      approvedAt: status === 'Approved' ? (initialPO?.approvedAt || new Date().toISOString()) : undefined,
      approvalComments: approvalComments.trim() || undefined,
      thresholdLimit,
      approvalStatus: status === 'Approved' ? 'Approved' : (status === 'Draft' ? 'Pending Approval' : 'Draft'),
      status,
      attachedExcelFile,
      createdAt: initialPO?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newPO);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-6">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full min-h-screen sm:min-h-0 sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Sticky Mobile-Friendly Top Action Bar */}
        <MobileViewerTopBar
          title={initialPO ? `تعديل أمر الشراء (${poNumber})` : 'إصدار أمر شراء جديد للموزع'}
          subtitle={initialPO?.vendorName || 'أمر شراء رسمي معتمد للمورد / الموزع'}
          onClose={onClose}
          backButtonText="← العودة إلى أوامر الشراء"
        />

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
          {/* Top Bar: Project & Source Selector */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Project Selection */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                المشروع المخصص (Target Project) *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  const p = projects.find((proj) => proj.id === e.target.value);
                  if (p) setProjectRef(p.projectNumber || p.name);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold focus:ring-1 focus:ring-blue-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.customerName})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Quick Source from Project Supplier Quotations */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                استيراد من تسعيرة مورد بالمشروع
              </label>
              <select
                onChange={(e) => {
                  const quote = supplierQuotations.find((sq) => sq.id === e.target.value);
                  if (quote) populateFromSupplierQuote(quote);
                }}
                defaultValue=""
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- اختر تسعيرة مورد لاستيراد بنودها --</option>
                {projectSupplierQuotes.map((sq) => (
                  <option key={sq.id} value={sq.id}>
                    {sq.supplierName} (#{sq.quotationNumber}) - {sq.totalAmount.toLocaleString()} SAR
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Status & Governance Approval */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600">
                  حالة أمر الشراء (Status) *
                </label>
                {!canApprove && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-sm">
                    مسودة مقترحة (بانتظار الاعتماد)
                  </span>
                )}
              </div>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as PurchaseOrder['status'];
                  if (val === 'Approved' && !canApprove) {
                    alert('تنبيه الحوكمة: ليس لديك صلاحية اعتماد أوامر الشراء (canApprovePO). يمكنك حفظ أمر الشراء كمسودة مقترحة فقط بانتظار اعتماد الإدارة أو مدير المشاريع.');
                    return;
                  }
                  setStatus(val);
                }}
                disabled={!canApprove && status === 'Draft'}
                className={`w-full border rounded-lg p-2 text-xs font-semibold focus:ring-1 focus:ring-blue-500 ${
                  !canApprove ? 'bg-amber-50/60 border-amber-300 text-amber-900 cursor-not-allowed' : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <option value="Draft">مسودة مقترحة (Draft / Proposal)</option>
                {canApprove && (
                  <>
                    <option value="Issued">صادر للموزع (Issued)</option>
                    <option value="Approved">معتمد رسمياً (Approved)</option>
                    <option value="Completed">مكتمل التوريد (Delivered)</option>
                    <option value="Cancelled">ملغى (Cancelled)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Governance Approval Tracking Details (For Authorized PMs / Super Admin) */}
          {canApprove && status === 'Approved' && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  توثيق اعتماد أمر الشراء والحوكمة المالية (PO Governance Approval)
                </span>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  صلاحية اعتماد نشطة
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-blue-800 mb-0.5">
                    ملاحظات وتعليمات الاعتماد (Approval Comments)
                  </label>
                  <input
                    type="text"
                    value={approvalComments}
                    onChange={(e) => setApprovalComments(e.target.value)}
                    placeholder="تمت مطابقة الأسعار والاعتماد الفني وفق الميزانية المعتمدة"
                    className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-800 mb-0.5">
                    الحد المالي الأقصى المعتمد (Threshold Limit SAR)
                  </label>
                  <input
                    type="number"
                    value={thresholdLimit}
                    onChange={(e) => setThresholdLimit(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-blue-200 rounded-lg p-1.5 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* EXCEL PO ATTACHMENT BOX */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-950 flex items-center gap-2">
                    <span>إرفاق واستيراد أمر شراء تم إعداده مسبقاً في الإكسل</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-200 text-emerald-900 font-bold">
                      Excel Attachment
                    </span>
                  </h4>
                  <p className="text-[11px] text-emerald-800/80 mt-0.5">
                    ارفع ملف أمر الشراء (.xlsx أو .xls) ليتم حفظه كمرفق رسمي لأمر الشراء واستخراج جداول البنود والأسعار تلقائياً.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => excelFileInputRef.current?.click()}
                  disabled={isUploadingExcel}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>
                    {isUploadingExcel
                      ? 'جارٍ قراءة الإكسل...'
                      : attachedExcelFile
                      ? 'استبدال ملف الإكسل'
                      : 'إرفاق ملف إكسل لأمر الشراء'}
                  </span>
                </button>
              </div>
            </div>

            {/* Success Message Banner */}
            {excelSuccessMsg && (
              <div className="mt-3 bg-emerald-100/80 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-semibold">{excelSuccessMsg}</span>
              </div>
            )}

            {/* Attached File Preview Card */}
            {attachedExcelFile && (
              <div className="mt-3 bg-white border border-emerald-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>{attachedExcelFile.name}</span>
                      <span className="text-[10px] font-mono font-medium text-slate-500">
                        ({attachedExcelFile.size})
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>تاريخ الإرفاق: {attachedExcelFile.uploadedAt}</span>
                      {attachedExcelFile.extractedItemsCount !== undefined && (
                        <span>• تم استيراد {attachedExcelFile.extractedItemsCount} بند</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {attachedExcelFile.dataUrl && (
                    <a
                      href={attachedExcelFile.dataUrl}
                      download={attachedExcelFile.name}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                      title="تحميل الملف المرفق"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل المرفق</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedExcelFile(undefined);
                      setExcelSuccessMsg(null);
                    }}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="حذف المرفق"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 1: PO Reference & Vendor Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* PO Information */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="font-bold text-xs text-[#1e3a8a] border-b pb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>بيانات أمر الشراء (PO INFORMATION)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">رقم أمر الشراء (PO Number)</label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-[#1e3a8a]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">التاريخ (Date)</label>
                  <input
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">مرجع المشروع (Project Ref.)</label>
                  <input
                    type="text"
                    value={projectRef}
                    onChange={(e) => setProjectRef(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">تاريخ التوريد المتفق عليه (Delivery Date)</label>
                  <input
                    type="text"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">رقم تسعيرة المورد (Quotation Ref.)</label>
                  <input
                    type="text"
                    value={quotationRef}
                    placeholder="e.g. 1016494"
                    onChange={(e) => setQuotationRef(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Vendor Information */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="font-bold text-xs text-[#007A5A] border-b pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building className="w-4 h-4" />
                  <span>بيانات الموزع / المورد (VENDOR INFORMATION)</span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                  اختر من الدليل للتعبئة التلقائية
                </span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">اختر المورد من القائمة المسجلة أو اكتبه (Select Supplier) *</label>
                  <select
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      if (!selectedName) return;
                      const matched = suppliers.find((s) => s.name === selectedName);
                      if (matched) {
                        setVendorName(matched.name);
                        setVendorContactPerson(matched.contactPerson || '');
                        setVendorPhoneEmail(`${matched.mobile || ''} - ${matched.email || ''}`);
                        setVendorAddress(matched.address || 'Dammam - King Saud ST');
                        setVendorVatNo(matched.vatNumber || '310179638200003');
                        if (matched.name.toLowerCase().includes('kanani') || matched.name.toLowerCase().includes('هادي') || matched.notes?.includes('AL INMA')) {
                          setBankDetails('Bank: AL INMA Bank   IBAN: SA65 0500 0068 2028 2549 7000');
                        }
                      } else {
                        setVendorName(selectedName);
                      }
                    }}
                    defaultValue=""
                    className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 mb-2 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="" disabled>-- اختر مورداً من القائمة المسجلة --</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.name}>
                        {sup.name} {sup.nameAr ? `(${sup.nameAr})` : ''}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={vendorName}
                    placeholder="أو اكتب اسم الموزع / المورد هنا..."
                    onChange={(e) => {
                      const val = e.target.value;
                      setVendorName(val);
                      if (val.toLowerCase().includes('kanani') || val.toLowerCase().includes('هادي')) {
                        setBankDetails('Bank: AL INMA Bank   IBAN: SA65 0500 0068 2028 2549 7000');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">الشخص المسؤول (Contact Person)</label>
                    <input
                      type="text"
                      value={vendorContactPerson}
                      placeholder="e.g. BAHAA AL ADMAT"
                      onChange={(e) => setVendorContactPerson(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">الهاتف / البريد (Phone / Email)</label>
                    <input
                      type="text"
                      value={vendorPhoneEmail}
                      placeholder="e.g. 0561450172 - sales@vendor.com"
                      onChange={(e) => setVendorPhoneEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">عنوان الموزع (Vendor Address)</label>
                    <input
                      type="text"
                      value={vendorAddress}
                      placeholder="e.g. Dammam - King Saud ST"
                      onChange={(e) => setVendorAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">الرقم الضريبي للموزع (Vendor VAT No.)</label>
                    <input
                      type="text"
                      value={vendorVatNo}
                      placeholder="e.g. 310179638200003"
                      onChange={(e) => setVendorVatNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Items BOQ Table */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span>جدول المواد والمواصفات (Items & Specifications)</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                  {items.length} بنود
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة بند جديد</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={it.id || idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start"
                >
                  <div className="md:col-span-1 text-center font-bold text-slate-500 pt-2">
                    #{idx + 1}
                  </div>

                  <div className="md:col-span-4">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      الوصف والمواصفات الفنية (Description / Specs)
                    </label>
                    <textarea
                      rows={2}
                      value={it.description}
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                      placeholder="المواصفات الفنية، الموديل، السعة، والاعتمادات (مثل UL Listed)..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-blue-500 font-sans"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">الكمية (Qty)</label>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">سعر الوحدة (Unit Price)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={it.unitPrice}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-right font-mono font-bold pr-7"
                      />
                      <span className="absolute left-2 top-2 text-[10px] text-slate-400">SAR</span>
                    </div>
                  </div>

                  {/* Dedicated PO Line-Item Discount Field (Monetary / Percentage adjustment) */}
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-rose-700">خصم البند (Discount)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextType = it.discountType === 'percent' ? 'amount' : 'percent';
                          handleItemChange(idx, 'discountType', nextType);
                        }}
                        className="text-[9.5px] text-slate-500 hover:text-blue-700 bg-slate-200/80 hover:bg-blue-100 px-1.5 py-0.5 rounded font-bold transition"
                        title="التبديل بين نسبة مئوية % أو مبلغ نقدي بالريال"
                      >
                        {it.discountType === 'percent' ? '% نسبة' : 'SAR مبلغ'}
                      </button>
                    </div>

                    {it.discountType === 'percent' ? (
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={it.discountPercent || ''}
                          placeholder="0"
                          onChange={(e) => handleItemChange(idx, 'discountPercent', e.target.value)}
                          className="w-full bg-white border border-rose-200 focus:border-rose-400 rounded-lg p-1.5 text-xs text-right font-mono font-bold text-rose-700 pr-5"
                        />
                        <span className="absolute left-2 top-2 text-[10px] text-rose-500 font-bold">%</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={it.discount || ''}
                          placeholder="0.00"
                          onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                          className="w-full bg-white border border-rose-200 focus:border-rose-400 rounded-lg p-1.5 text-xs text-right font-mono font-bold text-rose-700 pr-7"
                        />
                        <span className="absolute left-2 top-2 text-[10px] text-rose-500 font-bold">SAR</span>
                      </div>
                    )}
                  </div>

                  {/* Final Total Price after Discount */}
                  <div className="md:col-span-2 flex flex-col items-end justify-between pt-1">
                    <div className="w-full flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700">الإجمالي الصافي</label>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="text-rose-500 hover:text-rose-700 p-1 disabled:opacity-30 transition"
                        title="حذف البند"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="w-full text-right mt-1.5">
                      <span className="font-mono text-xs font-black text-slate-900 bg-white border border-slate-200 px-2 py-1.5 rounded-lg block text-left">
                        {it.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-500 font-sans">SAR</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary Calculation Box */}
            <div className="flex justify-end pt-3">
              <div className="w-96 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span className="font-medium">إجمالي البنود قبل الخصم (Gross Subtotal):</span>
                  <span className="font-mono font-bold text-slate-900">
                    {totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                </div>

                {totals.lineDiscounts > 0 && (
                  <div className="flex justify-between text-rose-700 text-[11.5px]">
                    <span>مجموع خصومات البنود (Line Items Discount):</span>
                    <span className="font-mono font-bold">
                      -{totals.lineDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                  <span className="text-slate-600 font-medium">خصم إضافي على الأمر (Order Discount):</span>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-right font-mono text-rose-700 font-bold"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-slate-800 font-bold pt-1 border-t border-slate-200">
                  <span>الأساس الخاضع للضريبة (Taxable Baseline):</span>
                  <span className="font-mono text-emerald-800">
                    {totals.totalAfterDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                </div>

                <div className="flex justify-between text-slate-700">
                  <span>ضريبة القيمة المضافة (VAT 15%):</span>
                  <span className="font-mono font-bold">
                    {totals.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                </div>

                <div className="flex justify-between py-2 px-3 bg-[#007A5A] text-white rounded-lg font-extrabold text-sm shadow-xs">
                  <span>الإجمالي النهائي الشامل (GRAND TOTAL):</span>
                  <span className="font-mono">
                    {totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Payment & Delivery Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Terms */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="font-bold text-xs text-slate-800 border-b pb-1">
                شروط الدفع (PAYMENT TERMS)
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">طريقة الدفع (Method)</label>
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">جدول الدفع (Schedule)</label>
                <input
                  type="text"
                  value={paymentSchedule}
                  onChange={(e) => setPaymentSchedule(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">بيانات الحساب البنكي (Bank Details)</label>
                <textarea
                  rows={2}
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-[11px] font-mono"
                />
              </div>
            </div>

            {/* Delivery Terms */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="font-bold text-xs text-slate-800 border-b pb-1">
                شروط التوريد والتسليم (DELIVERY TERMS)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">طريقة التسليم (Method)</label>
                  <input
                    type="text"
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">وسيلة الشحن (Shipping)</label>
                  <input
                    type="text"
                    value={deliveryShipping}
                    onChange={(e) => setDeliveryShipping(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">التسليم الجزئي (Partial Shipment)</label>
                <select
                  value={partialShipment}
                  onChange={(e) => setPartialShipment(e.target.value as 'Allowed' | 'Not Allowed')}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-semibold"
                >
                  <option value="Allowed">مسموح به (Allowed)</option>
                  <option value="Not Allowed">غير مسموح به (Not Allowed)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">موقع التسليم (Location)</label>
                <input
                  type="text"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Contract Terms (Included / Excluded) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-xs text-slate-800 border-b pb-1">
              شروط العقد الفنية واللوجستية (CONTRACT TERMS)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Included */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-emerald-800">ما يشمله العقد (INCLUDED)</span>
                  <button
                    type="button"
                    onClick={handleAddIncludedTerm}
                    className="text-[11px] text-emerald-700 hover:underline font-bold"
                  >
                    + إضافة بند
                  </button>
                </div>
                <ul className="space-y-1.5 text-[11px]">
                  {includedTerms.map((t, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-2 bg-white p-1.5 rounded border border-slate-200">
                      <span>• {t}</span>
                      <button
                        type="button"
                        onClick={() => setIncludedTerms((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 text-xs px-1"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Excluded */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-rose-800">ما يستثنيه العقد (EXCLUDED)</span>
                  <button
                    type="button"
                    onClick={handleAddExcludedTerm}
                    className="text-[11px] text-rose-700 hover:underline font-bold"
                  >
                    + إضافة بند
                  </button>
                </div>
                <ul className="space-y-1.5 text-[11px]">
                  {excludedTerms.map((t, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-2 bg-white p-1.5 rounded border border-slate-200">
                      <span>• {t}</span>
                      <button
                        type="button"
                        onClick={() => setExcludedTerms((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 text-xs px-1"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 5: Authorization Signers */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="font-bold text-xs text-slate-800 border-b pb-1">
              الاعتمادات والتواقيع (AUTHORIZATION)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-blue-700 block mb-1">Prepared By</span>
                <input
                  type="text"
                  value={preparedByName}
                  onChange={(e) => setPreparedByName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1 mb-1 font-bold text-xs"
                />
                <input
                  type="text"
                  value={preparedByTitle}
                  onChange={(e) => setPreparedByTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1 text-[11px] text-slate-500"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-blue-700 block mb-1">Reviewed By</span>
                <input
                  type="text"
                  value={reviewedByName}
                  onChange={(e) => setReviewedByName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1 mb-1 font-bold text-xs"
                />
                <input
                  type="text"
                  value={reviewedByTitle}
                  onChange={(e) => setReviewedByTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1 text-[11px] text-slate-500"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-blue-700 block mb-1">Approved By</span>
                <input
                  type="text"
                  value={approvedByName}
                  onChange={(e) => setApprovedByName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1 mb-1 font-bold text-xs"
                />
                <input
                  type="text"
                  value={approvedByTitle}
                  onChange={(e) => setApprovedByTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1 text-[11px] text-slate-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            الإجمالي النهائي: <span className="font-mono font-bold text-[#007A5A] text-sm">{totals.grandTotal.toLocaleString()} SAR</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSavePO}
              className="px-5 py-2 bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>حفظ وإصدار أمر الشراء للموزع</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
