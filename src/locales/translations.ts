export type Language = 'ar' | 'en';

export interface TranslationDictionary {
  brandName: string;
  brandTagline: string;
  commercialRegistration: string;
  taxNumber: string;
  bankAccount: string;
  copilotBtn: string;
  driveSyncedBtn: string;
  refreshBtn: string;
  priceSearchBtn: string;
  lightMode: string;
  darkMode: string;
  activeProjects: string;
  quotationsPipeline: string;
  marginProfit: string;
  collectionRate: string;
  outOfProjects: string;
  underStudy: string;
  revenueTotal: string;
  collectedFrom: string;
  receivablesRemaining: string;
  viewDetails: string;
  inclVat: string;
  exclVat: string;
  currencySAR: string;

  // Pillars
  pillar1: string;
  pillar2: string;
  pillar3: string;
  pillar4: string;
  pillar5: string;
  pillar6: string;

  // Tabs
  tabDashboard: string;
  tabCashFlow: string;
  tabStatusBreakdown: string;
  tabWorkbench: string;
  tabQuotations: string;
  tabSupplierQuotes: string;
  tabTerms: string;
  tabProjects: string;
  tabProcurementHub: string;
  tabPurchaseOrders: string;
  tabSiteLogistics: string;
  tabThreeWayMatch: string;
  tabInvoices: string;
  tabClientMaster: string;
  tabSettings: string;
  tabAdminRoles: string;
  tabAuditTrail: string;
  tabBackup: string;

  // Logistics & Hubs
  clientDeliveryNotes: string;
  vendorGoodsReceiptNotes: string;
  threeWayMatchGatekeeper: string;
  materialInspectionRequest: string;
  directSiteDelivery: string;
  centralWarehouseDeposit: string;
  vehiclePlate: string;
  driverName: string;
  deliveredBy: string;
  receivedBy: string;
  uninvoiced: string;
  invoiced: string;
  partiallyInvoiced: string;

  // Procurement & Settings Module Headers & Subtitles
  procurementTitle: string;
  procurementSubtitle: string;
  supplierSOA: string;
  newPO: string;
  uploadSupplierQuote: string;
  supplyChainPOs: string;
  systemSettingsTitle: string;
  systemSettingsSubtitle: string;
  tabIdentity: string;
  tabFinancialPolicies: string;
  tabAutoNumbering: string;
  tabNavigationCustom: string;
  tabAppearance: string;
  tabBackupSecurity: string;
  systemHealthCheck: string;

  // Project Disciplines
  fireFighting: string;
  fireAlarm: string;
  hvac: string;
  electrical: string;
  plumbing: string;
  cctv: string;
  bms: string;
  solar: string;
  pava: string;
  drainage: string;
  civil: string;
  mechanical: string;

  // Notifications
  notificationsTitle: string;
  allNotifications: string;
  financeAlerts: string;
  logisticsAlerts: string;
  projectsAlerts: string;
  markAllRead: string;
  noNotifications: string;
  unreadCount: string;

  // Statuses
  wonStatus: string;
  underPricingStatus: string;
  lostStatus: string;
  inProgressStatus: string;
  completedStatus: string;
  paidStatus: string;
  partiallyPaidStatus: string;
  unpaidStatus: string;
  overdueStatus: string;

  // Common Actions & Form Controls
  saveAndApply: string;
  savedSuccessfully: string;
  accessDenied: string;
  superAdminOnly: string;
  cancel: string;
  confirm: string;
  search: string;
  filter: string;
  all: string;
  printDocument: string;
  exportPdf: string;
  exportExcel: string;
  createNew: string;
  edit: string;
  delete: string;
  lockedAuditDoc: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  ar: {
    brandName: 'شركة صناع الموارد التجاريه - RMT',
    brandTagline: 'منظومة المتابعة الذكية وإدارة المشاريع والمشتريات',
    commercialRegistration: 'س.ت: 2050167793',
    taxNumber: 'الرقم الضريبي: 311552664400003',
    bankAccount: 'مصرف الراجحي: SA71 8000 0450 6080 1000 1399 | الحساب المعتمد',
    copilotBtn: 'مساعد RMT الذكي',
    driveSyncedBtn: 'أرشيف 5TB سحابي',
    refreshBtn: 'تحديث المنظومة',
    priceSearchBtn: 'بحث الأسعار',
    lightMode: 'الوضع الفاتح',
    darkMode: 'الوضع الداكن',
    activeProjects: 'المشاريع النشطة والفائزة',
    quotationsPipeline: 'عروض الأسعار قيد الدراسة',
    marginProfit: 'صافي الأرباح وهامش الربحية',
    collectionRate: 'معدل التحصيل والتدفق المالي',
    outOfProjects: 'من أصل {count} مشاريع',
    underStudy: 'عطاءات ومشاريع تحت التسعير',
    revenueTotal: 'قيمة العقود: {value} SAR [شامل 15% ضريبة]',
    collectedFrom: 'تم تحصيل {collected} من إجمالي {invoiced} SAR',
    receivablesRemaining: 'متبقي ذمم مدينة: {value} SAR [شامل الضريبة]',
    viewDetails: 'عرض التفاصيل',
    inclVat: '[شامل 15% ضريبة]',
    exclVat: '[قبل الضريبة]',
    currencySAR: 'ر.س',

    // Pillars
    pillar1: 'الرقابة العليا والسيولة',
    pillar2: 'التسعير ودراسة العطاءات',
    pillar3: 'المشاريع والتنفيذ الميداني',
    pillar4: 'إدارة المشتريات والتوريد اللوجستي',
    pillar5: 'المالية ومراقبة التكاليف',
    pillar6: 'الحوكمة وضبط الصلاحيات',

    // Tabs
    tabDashboard: 'لوحة القيادة التنفيذية',
    tabCashFlow: 'مرقاب التدفقات والسيولة (Sentinel)',
    tabStatusBreakdown: 'تحليل نتائج العطاءات والمنافسات',
    tabWorkbench: 'طاولة التسعير الهندسي',
    tabQuotations: 'عروض الأسعار المعتمدة للعملاء',
    tabSupplierQuotes: 'تسعيرات الموردين المعتمدين',
    tabTerms: 'مكتبة الشروط والمواصفات',
    tabProjects: 'سجل المشاريع والتنفيذ',
    tabProcurementHub: 'إدارة المشتريات وأوامر الشراء',
    tabPurchaseOrders: 'أوامر الشراء الصادرة للموردين',
    tabSiteLogistics: 'إدارة التوريد اللوجستي والمستودعات',
    tabThreeWayMatch: 'المطابقة الثلاثية المعتمدة',
    tabInvoices: 'الفواتير الضريبية والمستخلصات',
    tabClientMaster: 'دليل كبار العملاء والشركات',
    tabSettings: 'إعدادات المنظومة وهوية المؤسسة',
    tabAdminRoles: 'إدارة المستخدمين والصلاحيات',
    tabAuditTrail: 'سجل الرقابة والتدقيق (Audit Trail)',
    tabBackup: 'النسخ الاحتياطي والاسترجاع (PITR)',

    // Logistics & Hubs
    clientDeliveryNotes: 'سندات تسليم العميل (DN)',
    vendorGoodsReceiptNotes: 'محاضر استلام بضاعة الموردين (GRN)',
    threeWayMatchGatekeeper: 'بوابة المطابقة الثلاثية الذكية',
    materialInspectionRequest: 'محضر الفحص والاستلام الموقعي (MIR)',
    directSiteDelivery: 'توريد مباشر لموقع المشروع (Direct Site)',
    centralWarehouseDeposit: 'إيداع مستودع RMT المركزي (Central Warehouse)',
    vehiclePlate: 'رقم اللوحة',
    driverName: 'اسم السائق / الناقل',
    deliveredBy: 'سلم بواسطة',
    receivedBy: 'استلم بواسطة',
    uninvoiced: 'غير مفوتر',
    invoiced: 'مفوتر كلياً',
    partiallyInvoiced: 'مفوتر جزئياً',

    // Procurement & Settings Module Headers & Subtitles
    procurementTitle: 'إدارة المشتريات وأوامر الشراء',
    procurementSubtitle: 'إدارة علاقات الموردين، أوامر الشراء الصادرة، بنك الأسعار وبوابة المطابقة الثلاثية',
    supplierSOA: 'كشف حساب الموردين (SOA)',
    newPO: 'إنشاء أمر شراء جديد',
    uploadSupplierQuote: 'تسجيل تسعيرة مورد',
    supplyChainPOs: 'إدارة المشتريات وسلاسل الإمداد والتوريد',
    systemSettingsTitle: 'مركز إعدادات المنظومة والسيادة المؤسسية',
    systemSettingsSubtitle: 'إدارة الهوية الرسمية، السياسات المالية والضرائب، التسلسل والترقيم التلقائي وتخصيص القوائم والمظهر',
    tabIdentity: '1. الهوية والبيانات الرسمية',
    tabFinancialPolicies: '2. السياسات المالية والهوامش (%)',
    tabAutoNumbering: '3. الترقيم والتسلسل التلقائي',
    tabNavigationCustom: '4. تخصيص القوائم والركائز',
    tabAppearance: '5. المظهر والثيمات والخطوط',
    tabBackupSecurity: '6. الأمان والنسخ الاحتياطي',
    systemHealthCheck: 'فحص سلامة النظام',

    // Project Disciplines
    fireFighting: 'مكافحة الحريق',
    fireAlarm: 'إنذار الحريق',
    hvac: 'التكييف والتهوية',
    electrical: 'الأعمال الكهربائية',
    plumbing: 'الأعمال الصحية والسباكة',
    cctv: 'كاميرات المراقبة والأمن',
    bms: 'التحكم الذكي بالمباني',
    solar: 'الطاقة الشمسية',
    pava: 'النداء الصوتي والإخلاء',
    drainage: 'شبكات الصرف الصحي',
    civil: 'الأعمال المدنية والإنشائية',
    mechanical: 'الأعمال الميكانيكية',

    // Notifications
    notificationsTitle: 'مرقاب التنبيهات الذكي (Notification Sentinel)',
    allNotifications: 'كافة التنبيهات',
    financeAlerts: 'المالية والتحصيل',
    logisticsAlerts: 'التوريد والمستودع',
    projectsAlerts: 'المشاريع والضمانات',
    markAllRead: 'تحديد الكل كمقروء',
    noNotifications: 'لا توجد تنبيهات جديدة حالياً - المنظومة تعمل بانتظام',
    unreadCount: '{count} تنبيه جديد',

    // Statuses
    wonStatus: 'فائز ومعتمد',
    underPricingStatus: 'قيد التسعير والدراسة',
    lostStatus: 'خاسر / معتذر',
    inProgressStatus: 'قيد التنفيذ',
    completedStatus: 'مكتمل ومسلم',
    paidStatus: 'مدفوعة بالكامل',
    partiallyPaidStatus: 'مدفوعة جزئياً',
    unpaidStatus: 'غير مدفوعة',
    overdueStatus: 'متأخرة التحصيل',

    // Common Actions & Form Controls
    saveAndApply: 'حفظ وتطبيق التغييرات',
    savedSuccessfully: 'تم الحفظ وتطبيق الإعدادات بنجاح',
    accessDenied: 'تم رفض الوصول - مخصص للمدير العام فقط',
    superAdminOnly: 'هذا القسم محمي بدرع الأمان ومخصص حصرياً للمدير العام: مختار أبورزق',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    search: 'بحث...',
    filter: 'تصفية',
    all: 'الكل',
    printDocument: 'طباعة المستند الرسمي',
    exportPdf: 'تصدير PDF',
    exportExcel: 'تصدير إكسل (Excel)',
    createNew: 'إنشاء جديد',
    edit: 'تعديل',
    delete: 'حذف',
    lockedAuditDoc: 'المستند مقفل نظامياً ولا يمكن تعديله أو حذفه لوجود حركات مالية أو استلامات فعلية مرتبطة به.',
  },
  en: {
    brandName: 'Resource Makers Trading - RMT',
    brandTagline: 'Smart Project Tracking & Procurement ERP Operating System',
    commercialRegistration: 'CR: 2050167793',
    taxNumber: 'VAT: 311552664400003',
    bankAccount: 'Al Rajhi Bank: SA71 8000 0450 6080 1000 1399 | Official Account',
    copilotBtn: 'RMT Copilot AI',
    driveSyncedBtn: '5TB Drive Synced',
    refreshBtn: 'Refresh System',
    priceSearchBtn: 'Price Search',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    activeProjects: 'Active & Won Projects',
    quotationsPipeline: 'Quotations Pipeline',
    marginProfit: 'Net Margin & Profitability',
    collectionRate: 'Cash Collection & Liquidity',
    outOfProjects: 'Out of {count} projects',
    underStudy: 'Tenders & bids under estimation',
    revenueTotal: 'Contracts: {value} SAR [Incl. 15% VAT]',
    collectedFrom: 'Collected {collected} of {invoiced} SAR',
    receivablesRemaining: 'Receivables: {value} SAR [Incl. VAT]',
    viewDetails: 'View Details',
    inclVat: '[Incl. 15% VAT]',
    exclVat: '[Excl. VAT]',
    currencySAR: 'SAR',

    // Pillars
    pillar1: 'Executive Oversight & Liquidity',
    pillar2: 'Estimating & Tender Workbench',
    pillar3: 'Projects & Field Execution',
    pillar4: 'Procurement & Logistics Hub',
    pillar5: 'Finance & Cost Control',
    pillar6: 'Governance & RBAC Security',

    // Tabs
    tabDashboard: 'Executive Dashboard',
    tabCashFlow: 'Cash Flow Sentinel',
    tabStatusBreakdown: 'Tender Win/Loss Analysis',
    tabWorkbench: 'Engineering Estimation Workbench',
    tabQuotations: 'Approved Customer Quotations',
    tabSupplierQuotes: 'Approved Supplier Quotes',
    tabTerms: 'Specifications & Terms Library',
    tabProjects: 'Project Registry & Execution',
    tabProcurementHub: 'Procurement & PO Hub',
    tabPurchaseOrders: 'Issued Purchase Orders',
    tabSiteLogistics: 'Site Logistics & Material Hub',
    tabThreeWayMatch: 'Three-Way Match Gatekeeper',
    tabInvoices: 'Tax Invoices & Billing',
    tabClientMaster: 'Corporate Key Clients Directory',
    tabSettings: 'System Settings & Branding',
    tabAdminRoles: 'User Management & Permissions',
    tabAuditTrail: 'System Audit Trail',
    tabBackup: 'PITR Backup & Restore',

    // Logistics & Hubs
    clientDeliveryNotes: 'Client Delivery Notes (DN)',
    vendorGoodsReceiptNotes: 'Vendor Goods Receipt Notes (GRN)',
    threeWayMatchGatekeeper: '3-Way Match Gatekeeper',
    materialInspectionRequest: 'Material Inspection Request (MIR)',
    directSiteDelivery: 'Direct Site Delivery (Direct Site)',
    centralWarehouseDeposit: 'Central RMT Warehouse Deposit',
    vehiclePlate: 'Vehicle Plate No',
    driverName: 'Driver / Carrier Name',
    deliveredBy: 'Dispatched By',
    receivedBy: 'Received By',
    uninvoiced: 'Uninvoiced',
    invoiced: 'Fully Invoiced',
    partiallyInvoiced: 'Partially Invoiced',

    // Procurement & Settings Module Headers & Subtitles
    procurementTitle: 'Vendor Procurement & Purchase Orders',
    procurementSubtitle: 'Manage supplier relationships, issued purchase orders, price bank, and 3-way match',
    supplierSOA: 'Supplier SOA',
    newPO: 'New Purchase Order',
    uploadSupplierQuote: 'Upload Supplier Quote',
    supplyChainPOs: 'Supply Chain & Procurement Management',
    systemSettingsTitle: 'System Settings & Corporate Governance',
    systemSettingsSubtitle: 'Corporate identity, financial policies, VAT regulations, auto-numbering, and appearance',
    tabIdentity: '1. Identity & Official Info',
    tabFinancialPolicies: '2. Financial Policies & Margins (%)',
    tabAutoNumbering: '3. Auto-Numbering Engine',
    tabNavigationCustom: '4. Navigation & Pillars',
    tabAppearance: '5. Appearance & Themes',
    tabBackupSecurity: '6. Security & PITR Backup',
    systemHealthCheck: 'System Health Check',

    // Project Disciplines
    fireFighting: 'Fire Fighting System',
    fireAlarm: 'Fire Alarm System',
    hvac: 'HVAC & Ventilation',
    electrical: 'Electrical Works',
    plumbing: 'Plumbing & Sanitary',
    cctv: 'CCTV & Surveillance',
    bms: 'Building Management (BMS)',
    solar: 'Solar PV Energy',
    pava: 'Public Address & Voice Alarm',
    drainage: 'Drainage Systems',
    civil: 'Civil & Structural Works',
    mechanical: 'Mechanical Engineering',

    // Notifications
    notificationsTitle: 'Notification Sentinel',
    allNotifications: 'All Alerts',
    financeAlerts: 'Finance & Billing',
    logisticsAlerts: 'Logistics & Stock',
    projectsAlerts: 'Projects & Warranties',
    markAllRead: 'Mark All as Read',
    noNotifications: 'No active alerts. All operations running smoothly.',
    unreadCount: '{count} new alerts',

    // Statuses
    wonStatus: 'Won & Awarded',
    underPricingStatus: 'Under Pricing & Study',
    lostStatus: 'Lost / Declined',
    inProgressStatus: 'In Progress',
    completedStatus: 'Completed & Delivered',
    paidStatus: 'Fully Paid',
    partiallyPaidStatus: 'Partially Paid',
    unpaidStatus: 'Unpaid',
    overdueStatus: 'Overdue',

    // Common Actions & Form Controls
    saveAndApply: 'Save & Apply Changes',
    savedSuccessfully: 'Settings successfully saved and applied',
    accessDenied: 'Access Denied - Super Admin Only',
    superAdminOnly: 'This section is guarded by the Super-Admin Shield and restricted to: Mokhtar Abu Rizq',
    cancel: 'Cancel',
    confirm: 'Confirm',
    search: 'Search...',
    filter: 'Filter',
    all: 'All',
    printDocument: 'Print Official Document',
    exportPdf: 'Export PDF',
    exportExcel: 'Export Excel',
    createNew: 'Create New',
    edit: 'Edit',
    delete: 'Delete',
    lockedAuditDoc: 'This document is locked by audit controls and cannot be edited or deleted due to existing financial or physical logistics transactions.',
  },
};

export function getTranslation(lang: Language): TranslationDictionary {
  return translations[lang] || translations.ar;
}

export function formatTranslationString(template: string, params: Record<string, string | number>): string {
  let result = template;
  Object.entries(params).forEach(([key, val]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
  });
  return result;
}
