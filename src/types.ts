export type SystemDiscipline =
  | 'fire_fighting'
  | 'fire_alarm'
  | 'hvac'
  | 'electrical'
  | 'plumbing'
  | 'pava'
  | 'cctv'
  | 'mechanical'
  | 'bms'
  | 'solar'
  | 'civil'
  | 'drainage'
  | 'other_mep';

export interface SystemMeta {
  id: SystemDiscipline;
  nameEn: string;
  nameAr: string;
  badgeColor: string;
  iconName: string;
}

export const SYSTEM_DEFINITIONS: SystemMeta[] = [
  { id: 'fire_fighting', nameEn: 'Fire Fighting (UL/FM)', nameAr: 'نظام مكافحة الحريق (UL/FM)', badgeColor: 'bg-red-50 text-red-700 border-red-200', iconName: 'Flame' },
  { id: 'fire_alarm', nameEn: 'Fire Alarm System', nameAr: 'نظام إنذار الحريق المعنون', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200', iconName: 'BellRing' },
  { id: 'hvac', nameEn: 'HVAC & Duct Works', nameAr: 'أنظمة التكييف والتهوية والدكت (HVAC)', badgeColor: 'bg-teal-50 text-teal-700 border-teal-200', iconName: 'Wind' },
  { id: 'electrical', nameEn: 'Electrical & LV Systems', nameAr: 'الأعمال الكهربائية والجهد المنخفض', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200', iconName: 'Zap' },
  { id: 'plumbing', nameEn: 'Plumbing & Water Supply', nameAr: 'أنظمة السباكة والتغذية المائية', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200', iconName: 'Droplets' },
  { id: 'pava', nameEn: 'Low Current & PAVA Evacuation', nameAr: 'التيار الخفيف والنداء الصوتي (PAVA)', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200', iconName: 'Volume2' },
  { id: 'cctv', nameEn: 'CCTV & Security (HCIS)', nameAr: 'كاميرات المراقبة والأنظمة الأمنية (HCIS)', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200', iconName: 'ShieldAlert' },
  { id: 'mechanical', nameEn: 'Mechanical & Pumping Skid', nameAr: 'الميكانيكا والمضخات ومحابس التحكم', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200', iconName: 'Cog' },
  { id: 'bms', nameEn: 'Building Management (BMS)', nameAr: 'أنظمة التحكم وإدارة المباني (BMS)', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', iconName: 'Cpu' },
  { id: 'solar', nameEn: 'Solar PV & Renewable Energy', nameAr: 'أنظمة الطاقة الشمسية الكهروضوئية', badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-200', iconName: 'Sun' },
  { id: 'civil', nameEn: 'Civil & Foundation Works', nameAr: 'الأعمال المدنية والإنشائية والقواعد', badgeColor: 'bg-stone-50 text-stone-700 border-stone-200', iconName: 'Building2' },
  { id: 'drainage', nameEn: 'Sanitary & Drainage Networks', nameAr: 'شبكات الصرف الصحي والمناهل', badgeColor: 'bg-sky-50 text-sky-700 border-sky-200', iconName: 'Droplet' },
  { id: 'other_mep', nameEn: 'Other MEP & Contracting', nameAr: 'أعمال كهروميكانيكية متخصصة أخرى', badgeColor: 'bg-slate-50 text-slate-700 border-slate-200', iconName: 'Wrench' },
];

/**
 * Robust defensive lookup for system metadata.
 * Completely immune to undefined, null, uppercase, or custom string aliases.
 */
export function getSystemMeta(system?: string | null): SystemMeta {
  if (!system) {
    return {
      id: 'other_mep',
      nameEn: 'General MEP Systems',
      nameAr: 'نظام كهروميكانيكي عام',
      badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
      iconName: 'Wrench',
    };
  }
  const clean = String(system).trim().toLowerCase();
  const directMatch = SYSTEM_DEFINITIONS.find((s) => s.id === clean || s.nameEn.toLowerCase() === clean || s.nameAr.toLowerCase() === clean);
  if (directMatch) return directMatch;

  if (clean.includes('bms') || clean.includes('تحكم') || clean.includes('building management') || clean.includes('automation')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'bms')!;
  }
  if (clean.includes('solar') || clean.includes('شمس') || clean.includes('pv') || clean.includes('renewable')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'solar')!;
  }
  if (clean.includes('pava') || clean.includes('voice') || clean.includes('sound') || clean.includes('نداء') || clean.includes('صوت')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'pava')!;
  }
  if (clean.includes('hvac') || clean.includes('تكييف') || clean.includes('تهوية') || clean.includes('duct') || clean.includes('ventilation') || clean.includes('air')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'hvac')!;
  }
  if (clean.includes('drainage') || clean.includes('صرف')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'drainage') || SYSTEM_DEFINITIONS.find((s) => s.id === 'plumbing')!;
  }
  if (clean.includes('plumb') || clean.includes('drain') || clean.includes('sanitary') || clean.includes('سباك') || clean.includes('مياه') || clean.includes('تغذية') || clean.includes('sewage')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'plumbing')!;
  }
  if (clean.includes('fire') && clean.includes('alarm')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'fire_alarm')!;
  }
  if (clean.includes('fire') || clean.includes('حريق') || clean.includes('إطفاء') || clean.includes('اطفاء') || clean.includes('مكافحة')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'fire_fighting')!;
  }
  if (clean.includes('electr') || clean.includes('كهرب') || clean.includes('lighting') || clean.includes('cable') || clean.includes('panel')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'electrical')!;
  }
  if (clean.includes('cctv') || clean.includes('camera') || clean.includes('كامير') || clean.includes('security') || clean.includes('أمن')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'cctv')!;
  }
  if (clean.includes('civil') || clean.includes('مدني') || clean.includes('إنشائ') || clean.includes('خرسانة')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'civil')!;
  }
  if (clean.includes('mech') || clean.includes('ميكانيك')) {
    return SYSTEM_DEFINITIONS.find((s) => s.id === 'mechanical')!;
  }

  return {
    id: 'other_mep',
    nameEn: system,
    nameAr: system,
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    iconName: 'Wrench',
  };
}

export interface QuotationItem {
  id: string;
  itemNo: number;
  description: string;
  manufacturer: string;
  model: string;
  quantity: number;
  unit: string;
  unitMaterialCost?: number;
  unitLaborCost?: number;
  totalCost?: number;
  sellingPrice?: number;
  supplierUnitPrice: number;
  originalSupplierUnitPrice?: number;
  supplierTotalPrice: number;
  customMarkupPercent?: number;
  sellingUnitPrice: number;
  sellingTotalPrice: number;
  system: SystemDiscipline;
  sourceSupplierQuoteId?: string;
  sourceSupplierName?: string;
  pictureUrl?: string; // Support uploaded/changed/removed image
  notes?: string;
}

export interface QuotationAdditionalCosts {
  procurement: number;
  installation: number;
  transportation: number;
  testingAndCommissioning: number;
  testingCommissioning?: number;
  engineering: number;
  manpower: number;
  contingency: number;
  otherDirectCosts: number;
  customs?: number;
  other?: number;
}

export interface QuotationTotals {
  totalSupplierCost: number;
  totalAdditionalCosts: number;
  totalProjectCost: number;
  customerSellingPrice: number;
  grossProfit: number;
  grossMarginPercent: number;
  vatPercent: number;
  vatAmount: number;
  grandTotalWithVat: number;
}

export interface QuotationVersionLog {
  version: number;
  modifiedAt: string;
  customerSellingPrice: number;
  grossProfit: number;
  grossMarginPercent: number;
  totalProjectCost: number;
  changeSummary: string;
  modifiedBy: string;
}

export interface CustomerQuotation {
  id: string;
  projectId: string;
  customerId?: string;
  quotationNumber: string; // e.g. RM012699
  version: number; // e.g. 1 (V1), 2 (V2)
  date: string;
  validity: string;
  status:
    | 'Draft'
    | 'Issued'
    | 'Approved'
    | 'Revised'
    | 'Rejected'
    | 'draft'
    | 'under_review'
    | 'sent_to_customer'
    | 'won'
    | 'lost';
  clientName: string;
  attnName: string;
  projectLocation: string;
  projectName: string;
  scopeOfWork: string;
  systemDefinition: string;
  initiatedBy?: string;
  issuerDetails?: {
    name: string;
    title: string;
    email: string;
    phone: string;
    mobile: string;
  };
  selectedSystems: SystemDiscipline[];
  items: QuotationItem[];
  pricingMode: 'markup' | 'gross_margin' | 'fixed' | 'item_specific';
  overallMarkupPercent: number;
  overallTargetMarginPercent: number;
  fixedAddedProfit?: number;
  additionalCosts: QuotationAdditionalCosts;
  totals: QuotationTotals;
  terms: {
    includes: string[];
    excludes: string[];
    paymentTerms: string[];
    validity: string;
    notes: string[];
  };
  versionHistory?: QuotationVersionLog[];
  sourceSupplierQuotationId?: string;
  sourceSupplierQuotationIds?: string[];
  itemPictures?: Record<string, string>;
  customerName?: string;
  customerQuotationId?: string;
  totalAmount?: number;
  deletedAt?: string; // Soft-delete isolation timestamp
  createdAt: string;
  updatedAt: string;
}

export interface SupplierQuotation {
  id: string;
  projectId: string;
  projectName?: string;
  supplierId?: string;
  supplierName: string;
  quotationNumber: string;
  date: string;
  quoteDate?: string;
  validity: string;
  currency: string;
  systemType: SystemDiscipline;
  rawFileName?: string;
  rawFileType?: string;
  rawTextPreview?: string;
  originalStatus: 'original_kept' | 'reviewed';
  items: QuotationItem[];
  subtotal: number;
  vatPercent: number;
  vatAmount: number;
  totalAmount: number;
  driveUrl?: string;
  sourceFileName?: string;
  status?: 'draft' | 'preserved' | 'converted_to_po';
  poId?: string;
  itemsCount?: number;
  deliveryTime: string;
  paymentTerms: string;
  warranty: string;
  technicalNotes: string[];
  exclusions: string[];
  commercialConditions: string[];
  deletedAt?: string; // Soft-delete isolation timestamp
  createdAt: string;
}

export interface Customer {
  id: string;
  name?: string;
  companyName: string;
  companyNameAr?: string;
  contactPerson: string;
  contactPersonAr?: string;
  attnName?: string;
  position: string;
  mobile: string;
  phone?: string;
  telephone?: string;
  email: string;
  address: string;
  location?: string;
  shortAddress?: string;
  vatNumber?: string;
  vatNo?: string;
  crNumber?: string;
  website?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  accountName?: string;
  accountNumber?: string;
  notes?: string;
  previousProjects?: string[];
  previousQuotations?: string[];
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  nameAr?: string;
  contactPerson: string;
  position?: string;
  mobile: string;
  phone?: string;
  telephone?: string;
  email: string;
  address?: string;
  location?: string;
  shortAddress?: string;
  vatNumber?: string;
  vatNo?: string;
  crNumber?: string;
  website?: string;
  bankName?: string;
  iban?: string;
  swiftCode?: string;
  accountName?: string;
  accountNumber?: string;
  systems: (SystemDiscipline | string)[];
  brands: string[];
  deliveryLeadTimeDays?: number;
  previousQuotations?: string[];
  notes?: string;
  createdAt: string;
}

export interface CostRecord {
  id: string;
  projectId: string;
  category:
    | 'materials'
    | 'labor'
    | 'transportation'
    | 'testing'
    | 'subcontractor'
    | 'engineering'
    | 'other';
  description: string;
  amount: number;
  date: string;
  invoiceNumber?: string;
}

export type ProjectDocumentCategory =
  | 'BOQ'
  | 'DWG_CAD'
  | 'CONTRACT'
  | 'SUBMITTAL'
  | 'SUPPLIER_QUOTE'
  | 'OTHER'
  | 'Customer'
  | 'Supplier'
  | 'Quotations'
  | 'Purchase Orders'
  | 'Technical Documents'
  | 'Commercial Documents'
  | 'Reports';

export interface ProjectDocument {
  id: string;
  title?: string;
  name: string;
  category: ProjectDocumentCategory;
  fileName?: string;
  fileSize?: string;
  size?: string;
  fileType?: 'dwg' | 'pdf' | 'xlsx' | 'docx' | 'zip' | 'other' | string;
  driveUrl?: string;
  version?: string;
  uploadDate?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  linkedEntityId?: string;
  isOriginalPreserved?: boolean;
  contentData?: string; // base64 or text preview (legacy fallback)
}

export type ProjectOutcomeStatus = 'Won' | 'Under Pricing' | 'Lost';

export interface AttachedPOFile {
  name: string;
  size: string;
  uploadedAt: string;
  dataUrl?: string; // base64 Data URL for download/preview
  extractedItemsCount?: number;
}

export interface MaterialReceiptRecord {
  id: string;
  receiptNumber: string; // e.g. MR-2026-001
  receiptDate: string;
  receivedDate?: string;
  supplierDeliveryNoteNo?: string;
  deliveryNoteDate?: string;
  poId: string;
  poNumber?: string;
  projectId: string;
  projectName?: string;
  vendorName?: string;
  receivedBy?: string;
  destinationTag?: 'direct_site' | 'central_warehouse'; // [ توريد مباشر لموقع المشروع | إيداع مستودع RMT المركزي ]
  receivedItems: {
    poItemId: string;
    itemNo?: number;
    description: string;
    orderedQty?: number;
    receivedQty: number;
    unitPrice: number;
    unit?: string;
  }[];
  items?: {
    description: string;
    orderedQuantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    unit: string;
    unitPrice: number;
    poItemId: string;
  }[];
  receiverName?: string;
  notes?: string;
  attachedDocName?: string;
  attachedDocData?: string;
  invoicedToClient?: boolean;
  createdAt: string;
}

export interface ClientContractPOItem {
  id: string;
  sourceItemId?: string; // Link to quote item if available
  itemNo: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface ClientContractPO {
  id: string;
  projectId: string;
  clientPONumber: string; // e.g. CPO-ARAMCO-2026-88
  poDate: string;
  contractValue: number;
  vatIncluded: boolean;
  vatAmount?: number;
  grandTotal: number;
  approvedQuantitiesCount?: number;
  items: ClientContractPOItem[];
  fileName?: string;
  attachmentName?: string;
  attachmentData?: string;
  attachmentType?: string;
  notes?: string;
  extractedAt?: string;
  status?: 'Active' | 'Under Review' | 'Superseded';
  createdAt?: string;
}

export interface ProjectPaymentMilestone {
  id: string;
  name: string; // e.g. 'دفعة أولى مقدمة (Advance Payment)', 'دفعة توريد المواد', 'دفعة التركيب والفحص', 'محجوز الضمان (Retention 10%)'
  percentage: number; // e.g. 20, 40, 30, 10
  amount: number;
  isRetention?: boolean;
  status: 'Pending' | 'Invoiced' | 'Paid';
  invoiceId?: string;
  dueDate?: string;
  notes?: string;
}

export interface SiteInventoryItem {
  itemId: string;
  description: string;
  quantityOnHand: number;
  unit: string;
  lastReceivedDate: string;
  grnRef: string;
}

export interface VariationOrder {
  id?: string;
  voNumber: string; // e.g. VO-PRJ-001
  description: string;
  costImpact: number;
  priceImpact: number;
  approvedByClient: boolean;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Under Review';
  submissionDate: string;
  approvalDate?: string;
  notes?: string;
}

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  customerId?: string;
  customerName: string;
  attnName?: string;
  location: string;
  projectType?: 'Supply' | 'Installation' | 'EPC' | 'Testing & Commissioning' | 'Trading';
  selectedSystems?: SystemDiscipline[];
  systems?: SystemDiscipline[];
  status:
    | 'Won'
    | 'Under Pricing'
    | 'Lost'
    | 'Estimation'
    | 'Quoted'
    | 'Awarded'
    | 'In Progress'
    | 'Commissioning'
    | 'Completed'
    | 'On Hold'
    | 'estimation'
    | 'quoted'
    | 'in_progress'
    | string;
  executionStatus?: 'تام' | 'جزئي' | 'قيد التنفيذ'; // مؤشر الإنجاز وحالة التنفيذ
  completionPercentage?: number; // نسبة الإنجاز الفعلي (0 - 100%)
  completionDate?: string; // تاريخ التسليم أو الإنجاز
  handoverNotes?: string; // ملاحظات الاستلام ومحضر التسليم
  retentionPercent?: number; // نسبة محجوز الضمان التعاقدي (مثل 10% retention)
  retentionAmount?: number; // قيمة محجوز الضمان
  retentionStatus?: 'Held' | 'Due' | 'Released'; // محتجز | مستحق الإفراج | تم الإفراج
  advancePaymentAmount?: number; // الدفعة الأولى المستلمة
  advancePaymentDate?: string; // تاريخ الدفعة الأولى
  advancePaymentReceiptNo?: string; // رقم سند/إيصال الدفعة الأولى
  advancePaymentMethod?: 'Bank Transfer' | 'Cheque' | 'Cash'; // طريقة السداد
  advancePaymentReferenceNo?: string; // رقم الحوالة / السند المصرفي
  advancePaymentNotes?: string; // ملاحظات الدفعة الأولى
  advancePaymentAttachmentName?: string; // اسم ملف السند المرفق
  advancePaymentAttachmentData?: string; // بيانات المرفق DataURL
  advancePaymentAttachmentType?: string; // نوع المرفق
  advancePaymentAttachmentSize?: number; // حجم المرفق
  paymentMilestones?: ProjectPaymentMilestone[]; // جدول الدفعات التعاقدية ونسبها
  variationOrders?: VariationOrder[]; // أوامر التغيير والمطالبات الميدانية (Change Orders & Variations)
  lossReason?: string; // سبب خسارة المشروع في حال كان المشروع خاسراً
  startDate?: string;
  targetCompletionDate?: string;
  targetEndDate?: string;
  projectManager?: string;
  supplierQuotationIds?: string[];
  customerQuotationIds?: string[];
  purchaseOrderIds?: string[];
  activeCustomerQuotationId?: string;
  activeQuotationId?: string;
  client?: string;
  contractValue?: number;
  documents?: ProjectDocument[];
  incurredCosts?: CostRecord[];
  siteInventory?: SiteInventoryItem[]; // سجل جرد واستلام المواد الميداني (Site Inventory Ledger)
  budget?: number;
  timelineProgress?: number; // 0 to 100
  clientContractPO?: ClientContractPO; // عقد / أمر شراء العميل المعتمد (Master Reference)
  masterDriveFolderUrl?: string;
  advancePaymentDeductionRate?: number; // e.g., 10%
  retentionRate?: number; // e.g., 10%
  notes?: string;
  createdAt: string;
}

export type ItemDeliveryStatus = 'Delivered' | 'Partial Delivered' | 'Not yet' | 'Pending';

export interface PurchaseOrderItem {
  id: string;
  itemNo: number;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number; // Line discount monetary amount in SAR
  discountPercent?: number; // Line discount percentage (0-100%)
  discountType?: 'amount' | 'percent'; // Type of discount applied
  totalPrice: number; // Net total price after line discount
  deliveryStatus?: ItemDeliveryStatus;
  deliveredQty?: number;
}

export interface POPaymentRecord {
  id: string;
  poId: string;
  paymentDate: string;
  amount: number; // SAR
  paymentMethod: 'Bank Transfer' | 'Cheque' | 'Cash' | 'Letter of Credit' | 'Credit Card' | 'Other';
  referenceNo?: string; // Cheque number / Transfer Ref
  status: 'Paid' | 'Pending Approval' | 'Void';
  notes?: string;
  recordedBy?: string;
  attachmentName?: string;
  attachmentData?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // e.g. PO-2026-509
  date: string; // e.g. 13-Sep-26
  projectId: string;
  projectName: string;
  projectRef: string; // e.g. RM012691 - 01
  deliveryDate: string; // e.g. 10-Nov-26
  expectedDeliveryDate?: string;
  quotationRef: string; // e.g. 1016494
  sourceSupplierQuoteId?: string;

  // Vendor Information
  vendorName: string;
  vendorContactPerson: string;
  vendorPhoneEmail: string;
  vendorAddress: string;
  vendorVatNo: string;
  supplierId?: string;
  supplierName?: string;

  // Financial & Items
  items: PurchaseOrderItem[];
  subtotal: number;
  discount: number;
  totalAfterDiscount: number;
  vatPercent: number; // usually 15
  vatAmount: number;
  grandTotal: number;
  totalAmount?: number;

  // Partial Payments & AP Ledger
  payments?: POPaymentRecord[];
  paidAmount?: number;
  remainingBalance?: number;
  paymentStatus?: 'Unpaid' | 'Partially Paid' | 'Paid in Full';
  fulfillmentStatus?: 'Not Received' | 'In Delivery / Partial' | 'Fully Received' | 'Pending Payment Balance';

  // Commercial & Logistics
  paymentTerms: {
    method: string;
    schedule: string;
    currency: string;
    bankDetails: string;
  };

  deliveryTerms: {
    method: string;
    shipping: string;
    partialShipment: 'Allowed' | 'Not Allowed';
    location: string;
  };

  contractTerms: {
    included: string[];
    excluded: string[];
  };

  notes: string;

  authorization: {
    preparedBy: { name: string; title: string; signatureUrl?: string };
    reviewedBy: { name: string; title: string; signatureUrl?: string };
    approvedBy: { name: string; title: string; signatureUrl?: string };
  };

  approvedBy?: { name: string; title: string; signatureUrl?: string } | string;
  approvedAt?: string;
  approvalComments?: string;
  thresholdLimit?: number;
  approvalStatus?: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected';

  status: 'Draft' | 'Issued' | 'Approved' | 'In Delivery / Partial' | 'Fully Received' | 'Completed' | 'Pending Payment Balance' | 'Cancelled';
  deliveryStatus?: ItemDeliveryStatus;
  materialReceipts?: MaterialReceiptRecord[]; // سجل استلام المواد وإيصالات التوريد
  attachedExcelFile?: AttachedPOFile;
  deletedAt?: string; // Soft-delete isolation timestamp
  createdAt: string;
  updatedAt: string;
}

// Delivery Note (أمر / سند تسليم بضاعة للعميل)
export interface DeliveryNoteItem {
  id: string;
  sourceItemId: string; // original quote or PO item ID
  itemNo: number;
  description: string;
  unit: string;
  orderedQty: number;
  deliveredQty: number; // Qty delivered in this specific note
  totalDeliveredSoFar?: number;
  remainingQty: number;
  unitPrice?: number;
  totalPrice?: number;
  isInvoiced?: boolean;
  notes?: string;
}

export interface DeliveryNote {
  id: string;
  dnNumber: string; // e.g. DN-PRJ088-001
  date: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  sourceQuotationId?: string;
  customerId?: string;
  customerName: string;
  sourcePOId?: string; // Link to incoming/contract PO
  sourcePONumber?: string; // e.g. PO-2026-509
  deliveryLocation: string;
  recipientName: string;
  recipientPhone?: string;
  driverOrCarrier?: string;
  vehiclePlateNo?: string;
  status: 'Delivered' | 'Partial Delivered' | 'Draft';
  items: DeliveryNoteItem[];
  invoicedStatus: 'Uninvoiced' | 'Partially Invoiced' | 'Fully Invoiced';
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  notes?: string;
  receivedBySignature?: string;
  dispatchedByName?: string;
  deletedAt?: string; // Soft-delete isolation timestamp
  createdAt: string;
  updatedAt: string;
}

// Invoicing & Accounting Types (النظام المحاسبي والفوترة)
export interface InvoiceItem {
  id: string;
  sourceItemId?: string; // References QuotationItem or PO Item
  itemNo: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  contractRate?: number; // Official approved Client PO contract rate
  priceSource?: 'client_po' | 'delivery_note' | 'quotation' | 'manual'; // Pricing lineage
  clientPoItemNo?: number; // Item number in Client PO
  deliveryNoteRef?: string;
  isDelivered?: boolean;
}

export interface InvoicePayment {
  id: string;
  receiptNumber?: string; // e.g. RCP-2026-001
  date: string;
  paymentDate?: string;
  amount: number; // Total credited amount against invoice (Cash + Advance deduction)
  amountPaid?: number; // Partial payment amount (سداد جزئي)
  cashCollectedAmount?: number; // Actual cash/bank transfer received
  advanceDeductionCredited?: number; // Amount settled from advance payment balance
  retentionWithheld?: number; // Amount withheld as retention in this payment
  paymentType?: 'cash_collection' | 'advance_settlement' | 'retention_release' | 'combined';
  paymentMethod: 'Bank Transfer' | 'Cash' | 'Cheque' | string;
  referenceNo?: string;
  notes?: string;
  attachmentName?: string;
  attachmentData?: string; // Base64 data URL for voucher / receipt slip
  attachmentType?: string; // MIME type e.g. application/pdf, image/jpeg
  attachmentSize?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // Independent serial per project e.g. INV-PRJ088-001
  date: string;
  dueDate: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  customerId: string;
  customerName: string;
  customerVatNo?: string;
  customerVatNumber?: string;
  customerAddress?: string;
  sourceQuotationId?: string;
  sourceDeliveryNoteIds?: string[];
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  totalAfterDiscount: number;
  vatPercent: number; // 15
  vatAmount: number;
  grandTotal: number; // Gross Invoice Total with VAT

  // Progress Invoicing & Deductions (MEP Contract Progress Claims)
  grossAmount?: number; // إجمالي المستخلص المعتمد
  advanceDeductionRate?: number; // استرداد الدفعة المقدمة نسبة %
  advanceDeductionAmount?: number; // استرداد الدفعة المقدمة قيمة SAR
  retentionRate?: number; // خصم ضمان الأعمال المعتمد بنسبة 5%
  retentionAmount?: number; // قيمة خصم ضمان الأعمال المعتمد SAR
  netReceivable?: number; // الصافي المستحق للمطالبة

  // Advance Payment & Retention Deduction Logic (استقطاعات الدفعة المقدمة ومحجوز الضمان)
  applyAdvanceDeduction?: boolean;
  advanceDeduction?: number; // خصم الدفعة المقدمة المستهلكة من هذه الفاتورة
  advanceDeductionPercent?: number; // نسبة خصم الدفعة المقدمة
  applyRetentionDeduction?: boolean;
  retentionDeduction?: number; // استقطاع محجوز الضمان
  retentionDeductionPercent?: number; // نسبة محجوز الضمان
  netPayableAmount?: number; // الصافي المستحق للمطالبة والتحصيل = grandTotal - advanceDeduction - retentionDeduction

  paidAmount: number; // Total paid/settled against netPayableAmount
  remainingAmount: number; // Remaining collectible = netPayableAmount - paidAmount
  status: 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Overdue';
  payments: InvoicePayment[];

  // ZATCA Phase-2 Base Fields
  qrCodePayload?: string; // Base64 TLV
  invoiceCounterValue?: number; // ICV (Invoice Counter Value)
  previousInvoiceHash?: string; // PIH (Previous Invoice Hash)

  customBarcodeImage?: string; // باركود بديل مرفوع من منصة حكومية
  disableBarcode?: boolean; // خيار تعطيل / إخفاء الباركود من الفاتورة المطبوعة
  notes?: string;
  poReference?: string;
  authorizedModificationNote?: string; // توثيق سبب التعديل المعتمد وصلاحية التعديل
  deletedAt?: string; // Soft-delete isolation timestamp
  createdAt: string;
  updatedAt: string;
}

export interface TermsLibraryItem {
  id: string;
  system?: SystemDiscipline | string;
  category?: 'PAYMENT' | 'WARRANTY_VALIDITY' | 'PROCUREMENT' | 'GENERAL' | string;
  title?: string;
  content?: string;
  appliesTo?: string;
  isDefault?: boolean;
  scope?: string;
  includes?: string[];
  excludes?: string[];
  technicalAssumptions?: string[];
  testingCommissioning?: string[];
  warranty?: string;
  paymentTerms?: string[];
  delivery?: string;
  validity?: string;
  notes?: string[];
}

/**
 * Historical and active record of a priced item across projects,
 * preserved even when quotes are deleted so users can search pricing history.
 */
export interface PricedItemRecord {
  id: string;
  sourceItemId: string;
  itemNo?: number | string;
  description: string;
  quantity?: number;
  unit: string;
  system?: SystemDiscipline | string;
  supplierUnitPrice: number; // Cost from supplier (سعر التكلفة / التوريد)
  supplierTotalPrice?: number;
  customerUnitPrice?: number; // Selling price to customer (سعر البيع)
  customerTotalPrice?: number;
  marginPercent?: number; // Margin %
  supplierId?: string;
  supplierName: string; // اسم المورد
  supplierContactPerson?: string;
  supplierMobile?: string;
  supplierEmail?: string;
  supplierQuoteNo?: string; // رقم تسعيرة المورد
  projectId?: string;
  projectName: string; // اسم المشروع
  projectCode?: string;
  clientName?: string; // اسم العميل
  quotationId?: string;
  quotationNumber?: string; // رقم عرض السعر (e.g., RM012701)
  pricingDate: string; // تاريخ التسعير
  sourceType: 'customer_quotation' | 'supplier_quotation' | 'archived_deleted_quotation';
  status: 'active' | 'archived'; // 'active' if original quote exists, 'archived' if quote was deleted
  notes?: string;
  deletedAt?: string;
}

export const STANDARDIZED_PAYMENT_TERMS = [
  '100% Advance',
  '50% Advance - 50% Before Delivery',
  '50% Advance - 50% After Delivery',
  '30% Advance - 70% After Delivery',
  '30% Advance - 70% Before Delivery',
  '30% Advance - 60% Before Delivery - 10% After Testing',
  '30% Advance - 60% After Delivery - 10% After Testing',
] as const;

export const STANDARDIZED_PAYMENT_TERMS_LABELS: Record<string, string> = {
  '100% Advance': '100% دفعة مقدمة (100% Advance)',
  '50% Advance - 50% Before Delivery': '50% دفعة مقدمة - 50% قبل التوريد (50% Advance - 50% Before Delivery)',
  '50% Advance - 50% After Delivery': '50% دفعة مقدمة - 50% بعد التوريد (50% Advance - 50% After Delivery)',
  '30% Advance - 70% After Delivery': '30% دفعة مقدمة - 70% بعد التوريد (30% Advance - 70% After Delivery)',
  '30% Advance - 70% Before Delivery': '30% دفعة مقدمة - 70% قبل التوريد (30% Advance - 70% Before Delivery)',
  '30% Advance - 60% Before Delivery - 10% After Testing': '30% دفعة مقدمة - 60% قبل التوريد - 10% بعد الفحص والتشغيل (30% Adv - 60% Before Del - 10% Test)',
  '30% Advance - 60% After Delivery - 10% After Testing': '30% دفعة مقدمة - 60% بعد التوريد - 10% بعد الفحص والتشغيل (30% Adv - 60% After Del - 10% Test)',
};

export interface ProjectPlanTask {
  id: string;
  wbsCode: string; // e.g. "1.1", "1.2", "2.1"
  name: string; // Milestone / Activity title
  discipline?: SystemDiscipline | string;
  assignee?: string;
  durationDays: number; // المدة بالأيام
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  progressPercent: number; // 0 - 100%
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Delayed';
  dependencies?: string[];
  isMilestone?: boolean;
  notes?: string;
}

export interface ProjectPlan {
  id: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  customerName: string;
  startDate: string;
  targetEndDate: string;
  totalDurationDays: number;
  overallProgress: number;
  tasks: ProjectPlanTask[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Authentication & Strict RBAC Types
// ==========================================

export type UserRole = 'admin' | 'pm' | 'procurement' | 'engineer' | 'estimator' | 'accountant' | 'viewer';

export interface RoleConfig {
  id: UserRole;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  badgeClass: string;
  colorHex: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    id: 'admin',
    titleAr: 'مدير النظام التنفيذي (Super Admin)',
    titleEn: 'Super Administrator',
    descriptionAr: 'صلاحيات مطلقة لإدارة المنظومة والمالية وتعديل صلاحيات المستخدمين والاعتمادات.',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    colorHex: '#007A5A',
  },
  pm: {
    id: 'pm',
    titleAr: 'مدير المشاريع (Project Manager)',
    titleEn: 'Project Manager',
    descriptionAr: 'إدارة كاملة للمشاريع والجداول والتسعير واعتماد أوامر الشراء وإصدار الفواتير.',
    badgeClass: 'bg-blue-950/80 text-blue-300 border-blue-500/40',
    colorHex: '#1E3A8A',
  },
  estimator: {
    id: 'estimator',
    titleAr: 'مهندس تسعير ومناقصات (Estimator)',
    titleEn: 'Senior Cost Estimator',
    descriptionAr: 'إعداد مقايسات BOQ، مقارنة عروض أسعار الموردين RFQ، حساب هوامش الربح دون صلاحية التنفيذ الميداني.',
    badgeClass: 'bg-teal-950/80 text-teal-300 border-teal-500/40',
    colorHex: '#0D9488',
  },
  accountant: {
    id: 'accountant',
    titleAr: 'مدير مالي ومحاسب مشاريع (Accountant)',
    titleEn: 'Project Financial Controller',
    descriptionAr: 'إصدار الفواتير الضريبية، متابعة التحصيل والتدفقات النقدية، ومطابقة 3-Way Match للمشتريات.',
    badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
    colorHex: '#4F46E5',
  },
  procurement: {
    id: 'procurement',
    titleAr: 'أخصائي المشتريات والتوريد (Procurement)',
    titleEn: 'Procurement Specialist',
    descriptionAr: 'إدارة تسعيرات الموردين وأوامر الشراء ومتابعة جداول التوريد اللوجستية للموقع.',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    colorHex: '#D97706',
  },
  engineer: {
    id: 'engineer',
    titleAr: 'مهندس موقع وتنفيذ (Site Engineer)',
    titleEn: 'Site / MEP Engineer',
    descriptionAr: 'تحديث تقدم الأعمال الميدانية، ومتابعة سندات استلام المواد وسجل الإنجاز مع حجب الهوامش المالية.',
    badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
    colorHex: '#0891B2',
  },
  viewer: {
    id: 'viewer',
    titleAr: 'مطلع ومدقق (Auditor / Viewer)',
    titleEn: 'Auditor & Viewer',
    descriptionAr: 'صلاحية قراءة واطلاع فقط على المؤشرات والتقارير المعتمدة دون إمكانية التعديل.',
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-600',
    colorHex: '#64748B',
  },
};

export type SystemPermission =
  | 'ESTIMATING_VIEW'
  | 'ESTIMATING_EDIT_RATES'
  | 'ESTIMATING_PROMOTE'
  | 'PROCUREMENT_VIEW'
  | 'PROCUREMENT_CREATE_PO'
  | 'PROCUREMENT_APPROVE_PO'
  | 'FINANCE_VIEW_PROFIT_MARGINS'
  | 'FINANCE_ISSUE_INVOICE'
  | 'FINANCE_AUDIT_APPROVE'
  | 'SYSTEM_ADMIN_USERS'
  | 'SYSTEM_CONFIG_SETTINGS'
  | 'SYSTEM_AUDIT_PURGE';

export interface UserPermissions {
  canAccessAdminPanel: boolean;
  canManageUsers: boolean;
  canEditFinancialMargins: boolean;
  canCreateProject: boolean;
  canDeleteProject: boolean;
  canManageQuotations: boolean;
  canUploadQuotations?: boolean;
  canIssueInvoices: boolean;
  canManageProcurement: boolean;
  canApprovePO: boolean;
  canUpdateFieldExecution: boolean;
  canExportData: boolean;
  canDeleteAdmins?: boolean;
}

export interface MasterAdminConfig {
  email: string;
  role: string;
  canDeleteAdmins: boolean;
}

export const MASTER_ADMINS: MasterAdminConfig[] = [
  { email: "Mok7tar.89@gmail.com", role: "Master Creator", canDeleteAdmins: true }
];

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  switch (role) {
    case 'admin':
      return {
        canAccessAdminPanel: true,
        canManageUsers: true,
        canEditFinancialMargins: true,
        canCreateProject: true,
        canDeleteProject: true,
        canManageQuotations: true,
        canUploadQuotations: true,
        canIssueInvoices: true,
        canManageProcurement: true,
        canApprovePO: true,
        canUpdateFieldExecution: true,
        canExportData: true,
        canDeleteAdmins: true,
      };
    case 'pm':
      return {
        canAccessAdminPanel: true,
        canManageUsers: false,
        canEditFinancialMargins: true,
        canCreateProject: true,
        canDeleteProject: false,
        canManageQuotations: true,
        canUploadQuotations: true,
        canIssueInvoices: true,
        canManageProcurement: true,
        canApprovePO: true,
        canUpdateFieldExecution: true,
        canExportData: true,
      };
    case 'estimator':
      return {
        canAccessAdminPanel: false,
        canManageUsers: false,
        canEditFinancialMargins: true,
        canCreateProject: false,
        canDeleteProject: false,
        canManageQuotations: true,
        canUploadQuotations: true,
        canIssueInvoices: false,
        canManageProcurement: false,
        canApprovePO: false,
        canUpdateFieldExecution: false,
        canExportData: true,
      };
    case 'accountant':
      return {
        canAccessAdminPanel: false,
        canManageUsers: false,
        canEditFinancialMargins: false,
        canCreateProject: false,
        canDeleteProject: false,
        canManageQuotations: false,
        canUploadQuotations: false,
        canIssueInvoices: true,
        canManageProcurement: true,
        canApprovePO: false,
        canUpdateFieldExecution: false,
        canExportData: true,
      };
    case 'procurement':
      return {
        canAccessAdminPanel: false,
        canManageUsers: false,
        canEditFinancialMargins: false,
        canCreateProject: false,
        canDeleteProject: false,
        canManageQuotations: false,
        canUploadQuotations: true,
        canIssueInvoices: false,
        canManageProcurement: true,
        canApprovePO: false,
        canUpdateFieldExecution: false,
        canExportData: true,
      };
    case 'engineer':
      return {
        canAccessAdminPanel: false,
        canManageUsers: false,
        canEditFinancialMargins: false,
        canCreateProject: false,
        canDeleteProject: false,
        canManageQuotations: false,
        canUploadQuotations: false,
        canIssueInvoices: false,
        canManageProcurement: false,
        canApprovePO: false,
        canUpdateFieldExecution: true,
        canExportData: false,
      };
    case 'viewer':
    default:
      return {
        canAccessAdminPanel: false,
        canManageUsers: false,
        canEditFinancialMargins: false,
        canCreateProject: false,
        canDeleteProject: false,
        canManageQuotations: false,
        canUploadQuotations: false,
        canIssueInvoices: false,
        canManageProcurement: false,
        canApprovePO: false,
        canUpdateFieldExecution: false,
        canExportData: true,
      };
  }
}

// ==========================================
// Decoupled Domain Architecture Schemas
// ==========================================

export interface FrameworkContract {
  id: string;
  contractNumber: string;
  title: string;
  startDate: string;
  endDate: string;
  creditLimit: number;
  paymentTermDays: number;
  discountRatePercent?: number;
  isActive: boolean;
}

export interface ClientMaster {
  customerId: string; // Primary Key
  companyName: string;
  companyNameAr: string;
  taxId: string; // 15-digit KSA VAT
  crNumber: string; // 10-digit Commercial Registration
  creditLimit: number; // in SAR
  currentBalance: number; // Outstanding receivables
  paymentTerms: string; // e.g. "30 Days Net", "50% Advance / 50% Handover"
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  frameworkContracts: FrameworkContract[];
  assignedAccountManager?: string;
  status: 'Active' | 'Under Review' | 'Credit Hold' | 'Suspended';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterItemLibraryRecord {
  id: string;
  itemCode: string;
  discipline?: SystemDiscipline;
  category?: string;
  manufacturer?: string;
  model?: string;
  description?: string;
  descriptionEn?: string;
  descriptionAr: string;
  unit: string;
  standardRating?: string;
  pressureClass?: string;
  voltageRating?: string;
  capacityOrFlow?: string;
  certification?: 'UL/FM' | 'SASO' | 'QCD' | 'ISO' | 'HCIS' | 'Standard';
  preferredBrand?: string;
  baseCostSAR?: number;
  standardCost?: number;
  standardMarkupPercent?: number;
  standardSellingPriceSAR?: number;
  suggestedSellingPrice?: number;
  specSummary?: string;
  specifications?: string;
  lastPricedDate?: string;
  referenceSupplier?: string;
  isActive?: boolean;
  isVerifiedRating?: boolean;
}

export interface VendorQuoteBid {
  vendorId: string;
  vendorName: string; // NAFFCO, SFFECO, Hadi Kenani, etc.
  unitPrice: number;
  deliveryLeadTimeDays: number;
  warrantyMonths: number;
  isCompliant: boolean;
  complianceNotes?: string;
}

export interface RFQVendorComparisonItem {
  id: string;
  itemNo: number;
  discipline: SystemDiscipline;
  description: string;
  quantity: number;
  unit: string;
  specRating: string; // UL/FM, 300 PSI, etc.
  targetBudgetUnitPrice: number;
  bids: VendorQuoteBid[];
  selectedVendorId: string;
  selectedVendorPrice: number;
  targetMarkupPercent: number;
  customerSellingPrice: number;
}

export interface QuotationEstimate {
  id: string;
  estimateNumber: string;
  clientMasterId: string; // Foreign Key to ClientMaster
  clientCompanyName: string;
  projectName: string;
  projectLocation: string;
  disciplines: SystemDiscipline[];
  items: RFQVendorComparisonItem[];
  directCostTotal: number;
  additionalCosts: QuotationAdditionalCosts;
  totalCostBasis: number;
  targetMarginPercent: number;
  totalSellingPrice: number;
  vatPercent: number;
  grandTotalWithVat: number;
  status: 'Draft' | 'RFQ Sent' | 'Under Comparison' | 'Approved' | 'Promoted To Project' | 'Rejected';
  promotedProjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWBSMilestone {
  id: string;
  wbsCode: string; // e.g. "1.1", "2.3"
  title: string;
  discipline: SystemDiscipline;
  plannedPercent: number;
  actualPercent: number;
  weightPercent: number; // Contribution to total project
  allocatedBudgetSAR: number;
  actualCostSAR: number;
  startDate: string;
  endDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Delayed';
  submittalStatus?: 'Pending' | 'Approved' | 'Approved As Noted' | 'Rejected';
  inspectionStatus?: 'Pending' | 'Inspected & Passed' | 'Punch List' | 'Failed';
}

export interface ThreeWayMatchRecord {
  id: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  poItemRate: number;
  poQuantity: number;
  poTotalAmount: number;
  grnReceivedQuantity: number;
  supplierInvoiceNumber: string;
  supplierInvoiceRate: number;
  supplierInvoiceTotalAmount: number;
  rateDiscrepancyDelta: number;
  quantityDiscrepancyDelta: number;
  totalVarianceSAR: number;
  matchStatus: 'Passed' | 'Rate Mismatch' | 'Quantity Mismatch' | 'Discrepancy Blocked' | 'Override Approved';
  isDisbursementBlocked: boolean;
  blockedReason?: string;
  overrideApprovedBy?: string;
  overrideApprovalDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectLedger {
  projectId: string;
  contractValueGross: number;
  advancePaymentRatePercent: number; // 10%
  advancePaymentAmount: number;
  advancePaymentSettled: number;
  retentionReservePercent: number; // 10%
  retentionReserveTotalWithheld: number;
  retentionReserveReleased: number;
  totalProgressBilled: number;
  totalCollectionsReceived: number;
  totalSupplierCommitmentsPO: number;
  totalSupplierDisbursementsPaid: number;
  projectNetCashBalance: number;
  projectGrossProfitSAR: number;
  projectGrossMarginPercent: number;
}

export interface ImmutableAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetResource: string;
  entityId?: string;
  previousState?: any;
  newState?: any;
  diffSummary: string;
  ipAddress?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  name?: string;
  avatarUrl?: string;
  role: UserRole;
  department: string;
  jobTitle: string;
  phone?: string;
  password?: string;
  passwordHash?: string;
  isActive: boolean;
  isMasterAdmin?: boolean;
  masterRoleTitle?: string;
  canDeleteAdmins?: boolean;
  permissions?: Partial<UserPermissions> | SystemPermission[];
  systemPermissions?: SystemPermission[];
  createdAt: string;
  lastLogin?: string;
  lastLoginAt?: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: string;
}

// ==========================================
// Smart Notifications Engine Types
// ==========================================

export type NotificationCategory = 'finance' | 'logistics' | 'projects' | 'invoices' | 'milestones' | 'procurement' | 'system';
export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface NotificationItem {
  id: string;
  title: string;
  titleEn?: string;
  message: string;
  messageEn?: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  timestamp: string;
  isRead: boolean;
  targetTab?: string;
  targetId?: string; // Project ID, Invoice ID, PO ID, or DN ID
  metadata?: {
    amount?: number;
    daysOverdue?: number;
    clientName?: string;
    supplierName?: string;
    projectName?: string;
    dnNumber?: string;
    poNumber?: string;
    invoiceNumber?: string;
    completionPercentage?: number;
    retentionAmount?: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetResource: string;
  details?: string;
  ipAddress?: string;
}


