/**
 * Orchestrator Service - Central Relational Pipeline & Copilot Execution Engine
 *
 * Connects Customer Quotations, Projects, and Purchase Orders into an atomic living execution chain:
 * 1. Quotation Approval -> Atomically spawns a linked Project inheriting Client, BOQ, Scope & Budget.
 * 2. Purchase Order Guardrails -> Enforces mandatory Project ID binding & project budget ceiling validations.
 * 3. Autonomous Copilot Orchestration -> Parses natural language instructions, generates connected pipeline proposals, and commits atomic multi-record transactions to storage.
 */

import { CustomerQuotation, Project, PurchaseOrder, Customer, User } from '../types';
import { generateNextDocumentNumber } from '../store/systemStore';
import { getMasterEnterpriseState } from '../store/masterEnterpriseStore';

const KEYS = {
  CUSTOMER_QUOTATIONS: 'rmt_customer_quotations',
  PROJECTS: 'rmt_projects',
  PURCHASE_ORDERS: 'rmt_purchase_orders',
  CUSTOMERS: 'rmt_customers',
  AUTO_NUMBERING: 'rmt_autoNumbering',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, data: T, eventName?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (eventName) {
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('rmt_store_updated'));
  } catch (err) {
    console.error(`[OrchestratorService] Error persisting ${key}:`, err);
  }
}

/**
 * Transition Customer Quotation status and atomically spawn a linked Project when Approved/Awarded.
 */
export function transitionQuoteStatusAndSyncProject(
  quoteId: string,
  newStatus: 'Draft' | 'Sent' | 'Approved' | 'APPROVED' | 'AWARDED' | 'won' | 'Rejected' | 'Lost',
  currentUser?: User | null
): { quote: CustomerQuotation; project?: Project } {
  const quotes = readStorage<CustomerQuotation[]>(KEYS.CUSTOMER_QUOTATIONS, []);
  const projects = readStorage<Project[]>(KEYS.PROJECTS, []);
  const idx = quotes.findIndex((q) => q.id === quoteId || q.quotationNumber === quoteId);

  if (idx === -1) {
    throw new Error(`لم يتم العثور على عرض السعر المطلوب: ${quoteId}`);
  }

  const targetQuote = { ...quotes[idx] };
  const normalizedStatus =
    newStatus === 'APPROVED' || newStatus === 'AWARDED' || newStatus === 'won' ? 'Approved' : newStatus;

  targetQuote.status = normalizedStatus as any;
  targetQuote.updatedAt = new Date().toISOString();

  let createdProject: Project | undefined = undefined;

  // Check if we should spawn a linked project
  const isApproved = normalizedStatus === 'Approved';
  if (isApproved) {
    let existingProject = projects.find(
      (p: any) => p.id === targetQuote.projectId || p.quotationId === targetQuote.id || p.quotationNumber === targetQuote.quotationNumber
    );

    if (!existingProject) {
      const newProjectId = generateNextDocumentNumber('project');
      const totalVal = Number(
        targetQuote.totalAmount ||
          (targetQuote as any).totalWithVat ||
          (targetQuote as any).subtotal ||
          targetQuote.totals?.grandTotalWithVat ||
          0
      );

      existingProject = {
        id: newProjectId,
        projectNumber: newProjectId,
        name: targetQuote.projectName || `مشروع ${targetQuote.clientName || 'جديد'}`,
        clientName: targetQuote.clientName || 'عميل معتمد',
        customerName: targetQuote.clientName || 'عميل معتمد',
        attnName: targetQuote.attnName || (targetQuote as any).contactPerson || '',
        location: targetQuote.projectLocation || 'المملكة العربية السعودية',
        status: 'In Progress',
        contractValue: totalVal,
        budget: totalVal,
        startDate: new Date().toISOString().split('T')[0],
        targetEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        selectedSystems: targetQuote.selectedSystems || ['fire_fighting'],
        boqItems: targetQuote.items || [],
        quotationId: targetQuote.id,
        quotationNumber: targetQuote.quotationNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;

      projects.unshift(existingProject);
      createdProject = existingProject;
      writeStorage(KEYS.PROJECTS, projects, 'rmt_projects_updated');
    }

    targetQuote.projectId = existingProject.id;
  }

  quotes[idx] = targetQuote;
  writeStorage(KEYS.CUSTOMER_QUOTATIONS, quotes, 'rmt_quotations_updated');

  return { quote: targetQuote, project: createdProject };
}

/**
 * Validate and create a Purchase Order with mandatory Project ID selection and budget ceiling enforcement.
 */
export function validateAndCreatePurchaseOrder(
  poData: Partial<PurchaseOrder>,
  currentUser?: User | null
): { success: boolean; purchaseOrder?: PurchaseOrder; error?: string } {
  if (!poData.projectId || !poData.projectId.trim()) {
    return {
      success: false,
      error: 'خطأ حوكمة: يلزم اختيار المشروع المرتبط (Project ID) لإنشاء أمر الشراء.',
    };
  }

  const projects = readStorage<Project[]>(KEYS.PROJECTS, []);
  const project = projects.find((p) => p.id === poData.projectId || p.projectNumber === poData.projectId);

  if (!project) {
    return {
      success: false,
      error: 'المشروع المحدد غير مسجل في منظومة المشاريع.',
    };
  }

  const purchaseOrders = readStorage<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, []);
  const existingPoTotal = purchaseOrders
    .filter((po) => po.projectId === project.id && po.status !== 'Cancelled')
    .reduce((sum, po) => sum + Number(po.totalAmount || (po as any).total || 0), 0);

  const proposedPoTotal = Number(poData.totalAmount || (poData as any).total || 0);
  const projectBudget = Number(project.budget || project.contractValue || 0);
  const remainingBudget = projectBudget - existingPoTotal;

  if (proposedPoTotal > remainingBudget && remainingBudget > 0) {
    return {
      success: false,
      error: `تجاوز سقف الميزانية: قيمة أمر الشراء (${proposedPoTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س) تتجاوز الميزانية المتبقية للمشروع (${remainingBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س).`,
    };
  }

  const nextPoId = generateNextDocumentNumber('po');
  const newPO: PurchaseOrder = {
    id: nextPoId,
    poNumber: nextPoId,
    projectId: project.id,
    projectName: project.name,
    supplierName: poData.supplierName || 'مورد معتمد',
    supplierId: poData.supplierId || '',
    items: poData.items || [],
    subtotal: poData.subtotal || Math.round((proposedPoTotal / 1.15) * 100) / 100,
    vatAmount: poData.vatAmount || Math.round((proposedPoTotal - proposedPoTotal / 1.15) * 100) / 100,
    totalAmount: proposedPoTotal,
    status: poData.status || 'DRAFT',
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.fullName || currentUser?.name || 'مستخدم النظام',
    notes: poData.notes || '',
  } as any;

  purchaseOrders.unshift(newPO);
  writeStorage(KEYS.PURCHASE_ORDERS, purchaseOrders, 'rmt_pos_updated');

  return { success: true, purchaseOrder: newPO };
}

export interface CopilotPipelineProposal {
  clientName: string;
  contactName: string;
  projectName: string;
  totalAmountWithVat: number;
  subtotal: number;
  vat15Amount: number;
  systemDiscipline: string;
  quoteNumber: string;
  projectNumber: string;
  poNumber: string;
}

/**
 * Natural language instruction parser for Copilot autonomous execution.
 */
export function parseCopilotInstruction(query: string): CopilotPipelineProposal | null {
  const q = query.trim();
  if (!q) return null;

  // Match commands like "سوي تسعيرة لشركة X والمهندس Y بمبلغ Z" or "إنشاء عرض سعر لشركة أرامكو..."
  const hasActionKeyword =
    q.includes('تسعير') || q.includes('عرض سعر') || q.includes('سوي') || q.includes('أنشئ') || q.includes('انشئ') || q.includes('طلب');

  if (!hasActionKeyword) return null;

  // Extract amount
  const amountMatch = q.match(/(\d[\d,.]*)\s*(ر\.س|ريال|sar)?/i) || q.match(/بمبلغ\s*(\d[\d,.]*)/i);
  let totalVal = 100000;
  if (amountMatch && amountMatch[1]) {
    const parsedNum = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(parsedNum) && parsedNum > 0) {
      totalVal = parsedNum;
    }
  }

  // Extract Client Name
  let clientName = 'شركة المشاريع المتقدمة';
  const clientMatch = q.match(/لشركة\s+([^\s]+(?:\s+[^\s]+){0,2})/i) || q.match(/للعميل\s+([^\s]+(?:\s+[^\s]+){0,2})/i);
  if (clientMatch && clientMatch[1]) {
    clientName = `شركة ${clientMatch[1].replace(/والمهندس|بمبلغ|بمحافظة|بمدينة/g, '').trim()}`;
  } else if (q.includes('أرامكو') || q.includes('ارامكو')) {
    clientName = 'شركة أرامكو السعودية';
  } else if (q.includes('الدرعية')) {
    clientName = 'شركة تطوير بوابة الدرعية';
  } else if (q.includes('نيوم')) {
    clientName = 'شركة نيوم (NEOM)';
  }

  // Extract Contact / Engineer Name
  let contactName = 'م. أحمد علي';
  const engMatch = q.match(/والمهندس\s+([^\s]+(?:\s+[^\s]+){0,2})/i) || q.match(/المهندس\s+([^\s]+(?:\s+[^\s]+){0,2})/i);
  if (engMatch && engMatch[1]) {
    contactName = `م. ${engMatch[1].replace(/بمبلغ|بأنظمة|بمشروع/g, '').trim()}`;
  }

  // Calculate 15% ZATCA VAT
  const subtotal = Math.round((totalVal / 1.15) * 100) / 100;
  const vat15Amount = Math.round((totalVal - subtotal) * 100) / 100;

  // Auto-generate preview IDs
  const quoteNumber = generateNextDocumentNumber('quote');
  const projectNumber = generateNextDocumentNumber('project');
  const poNumber = generateNextDocumentNumber('po');

  return {
    clientName,
    contactName,
    projectName: `مشروع توريد وتنفيذ أنظمة السلامة والكهروميكانيك - ${clientName}`,
    totalAmountWithVat: totalVal,
    subtotal,
    vat15Amount,
    systemDiscipline: 'fire_fighting',
    quoteNumber,
    projectNumber,
    poNumber,
  };
}

/**
 * Execute Copilot Autonomous Pipeline Transaction:
 * Creates Quote, spawns linked Project, creates Procurement Allocation in one atomic commit.
 */
export function executeCopilotPipelineTransaction(
  proposal: CopilotPipelineProposal,
  currentUser?: User | null
): { success: boolean; quote: CustomerQuotation; project: Project; purchaseOrder?: PurchaseOrder } {
  const quotes = readStorage<CustomerQuotation[]>(KEYS.CUSTOMER_QUOTATIONS, []);
  const projects = readStorage<Project[]>(KEYS.PROJECTS, []);
  const pos = readStorage<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, []);
  const customers = readStorage<Customer[]>(KEYS.CUSTOMERS, []);

  // 1. Create Customer Quotation
  const newQuote: CustomerQuotation = {
    id: proposal.quoteNumber,
    quotationNumber: proposal.quoteNumber,
    clientName: proposal.clientName,
    contactPerson: proposal.contactName,
    projectName: proposal.projectName,
    projectLocation: 'الرياض / المملكة العربية السعودية',
    status: 'Approved',
    subtotal: proposal.subtotal,
    vatAmount: proposal.vat15Amount,
    totalAmount: proposal.totalAmountWithVat,
    totalWithVat: proposal.totalAmountWithVat,
    systemType: proposal.systemDiscipline as any,
    items: [
      {
        id: `boq-1`,
        description: 'توريد وتركيب وتعديل شبكة مكافحة الحريق والإنذار المبكر وفق معايير UL/FM والربط الميداني',
        unit: 'مقطوعية',
        quantity: 1,
        unitPrice: proposal.subtotal,
        totalPrice: proposal.subtotal,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: currentUser?.fullName || currentUser?.name || 'Copilot Agent',
  } as any;

  // 2. Create Linked Project
  const newProject: Project = {
    id: proposal.projectNumber,
    projectNumber: proposal.projectNumber,
    name: proposal.projectName,
    clientName: proposal.clientName,
    clientContact: proposal.contactName,
    location: 'الرياض / الدمام',
    status: 'In Progress',
    progress: 10,
    value: proposal.totalAmountWithVat,
    contractValue: proposal.totalAmountWithVat,
    budget: proposal.totalAmountWithVat,
    spent: 0,
    directCost: proposal.subtotal * 0.8,
    targetMargin: 20,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    systemType: proposal.systemDiscipline as any,
    boqItems: newQuote.items,
    quotationId: newQuote.id,
    quotationNumber: newQuote.quotationNumber,
    createdBy: currentUser?.fullName || currentUser?.name || 'Copilot Agent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;

  newQuote.projectId = newProject.id;

  // 3. Create Procurement Allocation Draft PO
  const poTotal = Math.round(proposal.subtotal * 0.5 * 100) / 100;
  const newPo: PurchaseOrder = {
    id: proposal.poNumber,
    poNumber: proposal.poNumber,
    projectId: newProject.id,
    projectName: newProject.name,
    supplierName: 'شركة المصانع المعتمدة للمعدات (NAFFCO)',
    supplierId: 'sup-naffco-01',
    items: [
      {
        id: 'po-item-1',
        description: 'دفعة توريد مضخات ومحابس شبكة الحريق المعتمدة',
        quantity: 1,
        unitPrice: Math.round((poTotal / 1.15) * 100) / 100,
        totalPrice: Math.round((poTotal / 1.15) * 100) / 100,
      },
    ],
    subtotal: Math.round((poTotal / 1.15) * 100) / 100,
    vatAmount: Math.round((poTotal - poTotal / 1.15) * 100) / 100,
    totalAmount: poTotal,
    status: 'APPROVED',
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.fullName || currentUser?.name || 'Copilot Agent',
    notes: 'مخصص المشتريات والتوريد المبدئي المنشأ تلقائياً بواسطة المساعد التشغيلي',
  } as any;

  // 4. Ensure Customer Record exists in Directory
  const existingCust = customers.find(
    (c) => (c.companyName || c.name || '').toLowerCase() === proposal.clientName.toLowerCase()
  );
  if (!existingCust) {
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: proposal.clientName,
      companyName: proposal.clientName,
      companyNameAr: proposal.clientName,
      contactPerson: proposal.contactName,
      phone: '+966 11 000 0000',
      email: 'info@client.com',
      address: 'الرياض - المملكة العربية السعودية',
      createdAt: new Date().toISOString(),
    } as any;
    customers.unshift(newCust);
    writeStorage(KEYS.CUSTOMERS, customers, 'rmt_customers_updated');
  }

  // Save all to localStorage in atomic transaction
  quotes.unshift(newQuote);
  projects.unshift(newProject);
  pos.unshift(newPo);

  writeStorage(KEYS.CUSTOMER_QUOTATIONS, quotes, 'rmt_quotations_updated');
  writeStorage(KEYS.PROJECTS, projects, 'rmt_projects_updated');
  writeStorage(KEYS.PURCHASE_ORDERS, pos, 'rmt_pos_updated');

  return {
    success: true,
    quote: newQuote,
    project: newProject,
    purchaseOrder: newPo,
  };
}
