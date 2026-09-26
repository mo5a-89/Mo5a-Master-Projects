import {
  Customer,
  Supplier,
  Project,
  SupplierQuotation,
  CustomerQuotation,
  PurchaseOrder,
  TermsLibraryItem,
  Invoice,
  DeliveryNote,
  ItemDeliveryStatus,
  ProjectPlan,
  ClientMaster,
  MasterItemLibraryRecord,
  ThreeWayMatchRecord,
  QuotationEstimate,
} from '../types';

export const COMPANY_PROFILE = {
  nameAr: 'شركة صناع الموارد التجارية',
  nameEn: 'RMT - Resource Makers Trading Est.',
  tradeNameEn: 'RMT - Resource Makers Trading Est.',
  crNumber: '2050167793',
  vatNumber: '311552664400003',
  poBox: 'PO BOX 32511 - Saudi Arabia',
  addressEn: 'Kingdom of Saudi Arabia, Dammam, Al Shate Al gharbi',
  addressAr: 'حي الشاطئ الغربي - الدمام - المملكة العربية السعودية',
  phone: '+966 549220606',
  mobiles: ['+966 549220606', '+966 599 7877 93', '+966 573 5080 33'],
  email: 'info@rmt-sa.com',
  website: 'www.rmt-sa.com',
  engineerName: '',
  engineerTitle: 'Projects Manager',
  engineerEmail: '',
  financeDirector: '',
  financeDirectorAr: '',
  financeDirectorTitle: 'Financial Controller & Auditor (المدير المالي والتدقيق)',
  dispatcherName: '',
  dispatcherTitle: 'المسؤول عن التجهيز والتسليم',
  bankName: 'Al Rajhi Bank (مصرف الراجحي)',
  bankIban: 'SA71 8000 0450 6080 1000 1399',
  bankSwift: 'RJHISARI',
  bankAccountName: 'شركة صناع الموارد التجارية (RMT)',
};

export const INITIAL_CLIENT_MASTERS: ClientMaster[] = [];

export const INITIAL_MASTER_ITEM_LIBRARY: MasterItemLibraryRecord[] = [
  {
    id: 'lib-ff-01',
    itemCode: 'FF-EXT-ABC-9KG',
    category: 'fire_fighting',
    description: 'Extinguisher Portable Type 20 Lbs (9 Kgs) Dry Chemical Powder UL Listed',
    descriptionAr: 'طفاية حريق بودرة كيميائية جافة 9 كجم (20 رطل) معتمدة UL/FM',
    manufacturer: 'SFFECO',
    model: 'SF-DC-UL10',
    unit: 'Pcs',
    standardCost: 995,
    suggestedSellingPrice: 1243.75,
    lastPricedDate: '2026-07-15',
    referenceSupplier: 'SFFECO Global',
    specifications: 'UL Listed 20 Lbs ABC Dry Chemical, with heavy duty bracket and gauge',
    isActive: true,
  },
  {
    id: 'lib-ff-02',
    itemCode: 'FF-EXT-CO2-6KG',
    category: 'fire_fighting',
    description: 'Extinguisher Portable Type 15 Lbs (6.80 Kgs) CO2 Gas UL Listed',
    descriptionAr: 'طفاية حريق ثاني أكسيد الكربون CO2 سعة 6.8 كجم (15 رطل) معتمدة UL',
    manufacturer: 'SFFECO',
    model: 'SF-CO2-M15',
    unit: 'Pcs',
    standardCost: 1840,
    suggestedSellingPrice: 2300,
    lastPricedDate: '2026-07-15',
    referenceSupplier: 'SFFECO Global',
    specifications: 'UL Listed Carbon Dioxide for Electrical switchgear rooms and server racks',
    isActive: true,
  },
  {
    id: 'lib-ff-03',
    itemCode: 'FF-CAB-HR-30M',
    category: 'fire_fighting',
    description: 'Hose Reel Cabinet Surface Type 1" x 30 M Synthetic Rubber Hose Red Full Metal Door',
    descriptionAr: 'كابينة بكرة خرطوم إطفاء حريق 1 بوصة × 30 متر تركيب سطحي باب حديد كامل',
    manufacturer: 'SFFECO',
    model: 'SF 600 RSD',
    unit: 'Sets',
    standardCost: 3740,
    suggestedSellingPrice: 4675,
    lastPricedDate: '2026-07-15',
    referenceSupplier: 'SFFECO Global',
    specifications: 'Surface mounted cabinet with jet-spray brass nozzle, 30m grooved rubber hose',
    isActive: true,
  },
  {
    id: 'lib-ff-04',
    itemCode: 'FF-PMP-500GPM',
    category: 'fire_fighting',
    description: 'Fire Pump Set 500 GPM @ 10 Bar Electric + Diesel + Jockey UL/FM Listed Package',
    descriptionAr: 'مجموعة مضخات إطفاء الحريق 500 جالون/دقيقة @ 10 بار (كهرباء + ديزل + جوكي) معتمدة UL/FM',
    manufacturer: 'Patterson / Clarke',
    model: 'HSC-500-140',
    unit: 'Sets',
    standardCost: 85000,
    suggestedSellingPrice: 106250,
    lastPricedDate: '2026-06-01',
    referenceSupplier: 'Saudi Pan Gulf',
    specifications: 'Horizontal Split Case, UL/FM Listed controller panels with automatic transfer switch',
    isActive: true,
  },
  {
    id: 'lib-fa-01',
    itemCode: 'FA-FACP-4LOOP',
    category: 'fire_alarm',
    description: 'Addressable Fire Alarm Control Panel 4-Loop 1000 Points EN54/UL Certified',
    descriptionAr: 'لوحة إنذار حريق معنونة 4 حلقات تسع حتى 1000 نقطة معتمدة EN54/UL',
    manufacturer: 'Notifier / Honeywell',
    model: 'NFS2-640',
    unit: 'Sets',
    standardCost: 14500,
    suggestedSellingPrice: 18125,
    lastPricedDate: '2026-05-15',
    referenceSupplier: 'Honeywell ME',
    specifications: '4-Loop networkable addressable panel with LCD keypad and backup batteries',
    isActive: true,
  },
  {
    id: 'lib-hvac-01',
    itemCode: 'HVAC-FCU-3TR',
    category: 'hvac',
    description: 'Concealed Ducted Fan Coil Unit 3.0 TR with EC Motor and Thermostat',
    descriptionAr: 'وحدة تكييف مخفية (FCU) قدرة 3 طن تبريد بمحرك موفر للطاقة وترموستات رقمي',
    manufacturer: 'Carrier / Zamil',
    model: '42DH-036',
    unit: 'Units',
    standardCost: 3200,
    suggestedSellingPrice: 4000,
    lastPricedDate: '2026-04-10',
    referenceSupplier: 'Zamil Air Conditioners',
    specifications: 'High static fan coil unit with Modbus BMS integration capability',
    isActive: true,
  },
];

export const INITIAL_THREE_WAY_MATCHES: ThreeWayMatchRecord[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: "CUST-0001",
    name: "KAMCO.1",
    companyName: "KAMCO.1",
    contactPerson: "KAREEM HAMDI",
    attnName: "KAREEM HAMDI",
    position: "Purchasing & Contracts Manager",
    phone: "0501234567",
    mobile: "0501234567",
    email: "",
    vatNo: "300994821100003",
    vatNumber: "300994821100003",
    location: "DAHRAN",
    address: "Eastern Province - Dahran",
    createdAt: "2026-01-01T08:00:00.000Z",
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: "SUPP-0001",
    name: "HADI KANANI COMPANY",
    nameAr: "شركة هادي كنعاني للمقاولات والتوريدات",
    contactPerson: "Fayez Ahmed",
    position: "Sales & Technical Support Manager",
    phone: "+966506761930",
    mobile: "+966506761930",
    email: "f.ahmed@hkenani.com",
    vatNo: "310179638200003",
    vatNumber: "310179638200003",
    address: "Contracting Services MEP - ELV - O&M",
    systems: [
      "MEP Contracting",
      "Firefighting Systems",
      "ELV Systems",
      "HVAC",
    ],
    brands: [
      "SFFECO",
      "NAFFCO",
    ],
    deliveryLeadTimeDays: 7,
    notes: "المورد الاستراتيجي لأنظمة السلامة ومكافحة الحريق والإنذار المعنون وأنظمة التكييف",
    createdAt: "2026-01-01T08:00:00.000Z",
  },
];

export const INITIAL_TERMS_LIBRARY: TermsLibraryItem[] = [
  {
    id: "TERM-0001",
    title: "شروط الدفع القياسية لعروض الأسعار",
    category: "PAYMENT",
    content: "الدفعة المقدمة 30% عند توقيع العقد/التعميد، 60% دفعات دورية مرتبطة بنسب التوريد والإنجاز الميداني، 10% عند التسليم النهائي والفحص والاختبار.",
    appliesTo: "QUOTATION",
    isDefault: true,
  },
  {
    id: "TERM-0002",
    title: "صلاحية الأسعار والضمان",
    category: "WARRANTY_VALIDITY",
    content: "الأسعار سارية لمدة 30 يوماً من تاريخ تقديم العرض. يشمل العرض ضماناً شاملاً على المواد والأعمال لمدة 12 شهراً من تاريخ التسليم الابتدائي.",
    appliesTo: "QUOTATION",
    isDefault: true,
  },
  {
    id: "TERM-0003",
    title: "شروط أوامر الشراء والتوريد للموقع",
    category: "PROCUREMENT",
    content: "التوريد مطابق للمواصفات الفنية المعتمدة واعتماد الاستشاري. يتم الفحص الميداني عند التسليم، ويتم السداد بعد 30 يوماً من استلام الفاتورة الضريبية وإذن الاستلام المعتمد.",
    appliesTo: "PURCHASE_ORDER",
    isDefault: true,
  },
];

export const INITIAL_SUPPLIER_QUOTATIONS: SupplierQuotation[] = [];

export const INITIAL_CUSTOMER_QUOTATIONS: CustomerQuotation[] = [];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_DELIVERY_NOTES: DeliveryNote[] = [];

export const INITIAL_INVOICES: Invoice[] = [];

export const INITIAL_PROJECT_PLANS: ProjectPlan[] = [];
