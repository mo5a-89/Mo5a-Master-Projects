import { SystemDiscipline, QuotationItem, QuotationAdditionalCosts, QuotationTotals, CostRecord, ClientContractPO, ProjectPaymentMilestone, CustomerQuotation } from '../types';

export type DiscreteUnit = 'ea' | 'set' | 'pcs' | 'قطعة' | 'طقم' | 'وحدة' | 'حبة' | 'عدد';

export interface SiteInventoryItem {
  itemId: string;
  description: string;
  quantityOnHand: number;
  unit: string;
  lastReceivedDate: string;
  grnRef: string;
}

export interface DeliveryLogisticsValidation {
  isValid: boolean;
  errors: string[];
}

export interface DeliveryLogisticsPayload {
  deliveryLocation: string;
  recipientName: string;
  recipientPhone?: string;
  dispatchedByName: string;
  driverOrCarrier: string;
  vehiclePlateNo?: string;
}

export type ProjectDocumentCategory = 
  | 'BOQ' 
  | 'DWG_CAD' 
  | 'CONTRACT' 
  | 'SUBMITTAL' 
  | 'SUPPLIER_QUOTE' 
  | 'OTHER';

export interface ProjectDocument {
  id: string;
  title: string;
  category: ProjectDocumentCategory;
  fileName?: string;
  fileSize?: string;
  fileType?: 'dwg' | 'pdf' | 'xlsx' | 'docx' | 'zip' | 'other';
  driveUrl: string;
  version?: string;
  uploadDate: string;
  uploadedBy: string;
  linkedEntityId?: string;
}

export interface SupplierQuotationItem {
  id: string;
  itemNo: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface EnhancedSupplierQuotation {
  id: string;
  projectId?: string;
  projectName?: string;
  supplierName: string;
  quoteNumber: string;
  totalAmount: number;
  issueDate: string;
  validUntil?: string;
  sourceFileName?: string;
  driveUrl?: string;
  itemsCount: number;
  status: 'draft' | 'preserved' | 'converted_to_po';
  poId?: string;
  items?: SupplierQuotationItem[] | QuotationItem[];
}

export interface ProjectFinancialMarginAnalysis {
  contractSellingPrice: number; // Ex VAT
  committedPOCosts: number; // Committed to Suppliers Ex VAT
  incurredSiteExpenses: number; // Actual Logged Costs
  totalActualCost: number; // committedPOCosts + incurredSiteExpenses
  actualProfitAmount: number; // contractSellingPrice - totalActualCost
  actualProfitMarginPercent: number; // (actualProfitAmount / contractSellingPrice) * 100
  advancePaymentReceived: number;
  advancePaymentDeductionRate: number; // percentage (e.g. 10%)
  retentionRate: number; // percentage (e.g. 10%)
  totalRetentionHeld: number;
  netInvoicedAmount: number;
}
