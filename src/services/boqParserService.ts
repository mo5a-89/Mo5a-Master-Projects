/**
 * BOQ Breakdown Engine & Auto-Procurement Dispatch Service
 * 
 * Provides:
 * 1. Line-item decomposition into Supply / Materials (المواد والتوريدات) and Execution / Labor (التركيب والمصنعيات).
 * 2. Automated grouping of material line items by discipline/category.
 * 3. Generation of Draft Purchase Orders (PO) linked to specific projects with status 'DRAFT_PENDING_APPROVAL'.
 * 4. Material budget ceiling validation and auto-numbering.
 */

import { Project, PurchaseOrder, Supplier, User } from '../types';
import { generateNextDocumentNumber } from '../store/systemStore';
import { getMasterEnterpriseState } from '../store/masterEnterpriseStore';

const KEYS = {
  PURCHASE_ORDERS: 'rmt_purchase_orders',
  PROJECTS: 'rmt_projects',
  SUPPLIERS: 'rmt_suppliers',
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
    console.error(`[BOQParserService] Error persisting ${key}:`, err);
  }
}

export interface BOQItemBreakdown {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  materialSupplyCost: number;
  laborExecutionCost: number;
  overheadCost: number;
  profitMarginAmount: number;
  discipline: string;
}

export interface ProjectBOQDecomposition {
  projectId: string;
  projectName: string;
  items: BOQItemBreakdown[];
  totalContractValue: number;
  totalMaterialSupplyBudget: number;
  totalLaborExecutionBudget: number;
  totalOverhead: number;
  totalTargetProfit: number;
}

/**
 * Decomposes a BOQ item into material supply and labor execution cost centers.
 */
export function decomposeBoqLineItem(
  item: any,
  financialPolicies?: { overheadPercentage?: number; profitMarginPercentage?: number }
): BOQItemBreakdown {
  const desc = (item.description || item.name || '').toLowerCase();
  const totalPrice = Number(item.totalPrice || item.amount || (Number(item.quantity || 1) * Number(item.unitPrice || item.rate || 0))) || 0;
  const unitPrice = Number(item.unitPrice || item.rate || (totalPrice / Math.max(1, Number(item.quantity || 1)))) || 0;

  const overheadPct = (financialPolicies?.overheadPercentage ?? 10) / 100;
  const profitPct = (financialPolicies?.profitMarginPercentage ?? 20) / 100;

  // Keyword analysis for supply vs labor split
  const isLaborOnly = desc.includes('تركيب فقط') || desc.includes('مصنعيات فقط') || desc.includes('labor only') || desc.includes('installation only');
  const isSupplyOnly = desc.includes('توريد فقط') || desc.includes('supply only') || desc.includes('مواد فقط');

  let materialRatio = 0.65; // Default 65% materials, 35% labor
  if (isLaborOnly) {
    materialRatio = 0.05;
  } else if (isSupplyOnly) {
    materialRatio = 0.95;
  } else if (desc.includes('مضخ') || desc.includes('pump') || desc.includes('لوح') || desc.includes('panel') || desc.includes('محبس') || desc.includes('valve')) {
    materialRatio = 0.75;
  } else if (desc.includes('اختبار') || desc.includes('تشغيل') || desc.includes('testing') || desc.includes('commissioning')) {
    materialRatio = 0.15;
  }

  const directBaseCost = totalPrice / (1 + overheadPct + profitPct);
  const materialSupplyCost = Math.round(directBaseCost * materialRatio * 100) / 100;
  const laborExecutionCost = Math.round(directBaseCost * (1 - materialRatio) * 100) / 100;
  const overheadCost = Math.round(directBaseCost * overheadPct * 100) / 100;
  const profitMarginAmount = Math.round(directBaseCost * profitPct * 100) / 100;

  let discipline = 'fire_fighting';
  if (desc.includes('كهرب') || desc.includes('electr') || desc.includes('كابل') || desc.includes('cable')) {
    discipline = 'electrical';
  } else if (desc.includes('تكييف') || desc.includes('hvac') || desc.includes('دكت') || desc.includes('duct')) {
    discipline = 'hvac';
  } else if (desc.includes('سباك') || desc.includes('مياه') || desc.includes('plumb') || desc.includes('drain')) {
    discipline = 'plumbing';
  } else if (desc.includes('كامير') || desc.includes('cctv') || desc.includes('أمن') || desc.includes('secur')) {
    discipline = 'cctv';
  }

  return {
    id: item.id || `boq-${Math.random().toString(36).substr(2, 6)}`,
    description: item.description || item.name || 'بند مقايسة معتمد',
    unit: item.unit || 'بند',
    quantity: Number(item.quantity || 1),
    unitPrice,
    totalPrice,
    materialSupplyCost,
    laborExecutionCost,
    overheadCost,
    profitMarginAmount,
    discipline,
  };
}

/**
 * Decomposes all items in a project's BOQ into operational cost centers.
 */
export function decomposeProjectBOQ(project: Project): ProjectBOQDecomposition {
  const store = getMasterEnterpriseState();
  const rawItems = (project as any).boqItems || (project as any).items || [];

  const decomposedItems = rawItems.map((it: any) => decomposeBoqLineItem(it, store.financialPolicies));

  const totalContractValue = decomposedItems.reduce((sum, it) => sum + it.totalPrice, 0);
  const totalMaterialSupplyBudget = decomposedItems.reduce((sum, it) => sum + it.materialSupplyCost, 0);
  const totalLaborExecutionBudget = decomposedItems.reduce((sum, it) => sum + it.laborExecutionCost, 0);
  const totalOverhead = decomposedItems.reduce((sum, it) => sum + it.overheadCost, 0);
  const totalTargetProfit = decomposedItems.reduce((sum, it) => sum + it.profitMarginAmount, 0);

  return {
    projectId: project.id,
    projectName: project.name,
    items: decomposedItems,
    totalContractValue,
    totalMaterialSupplyBudget: totalMaterialSupplyBudget || totalContractValue * 0.6,
    totalLaborExecutionBudget: totalLaborExecutionBudget || totalContractValue * 0.25,
    totalOverhead: totalOverhead || totalContractValue * 0.05,
    totalTargetProfit: totalTargetProfit || totalContractValue * 0.1,
  };
}

export interface AutoProcurementResult {
  generatedPOs: PurchaseOrder[];
  projectMaterialBudget: number;
  totalDraftAmount: number;
  isOverBudget: boolean;
}

/**
 * Automatically groups project materials and generates Draft Purchase Orders (PO) linked to the project.
 */
export function generateAutoProcurementDrafts(
  project: Project,
  suppliers: Supplier[] = [],
  currentUser?: User | null
): AutoProcurementResult {
  const decomposition = decomposeProjectBOQ(project);
  const existingPOs = readStorage<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, []);

  // Filter out existing POs for this project to check budget
  const existingPoTotal = existingPOs
    .filter((po) => po.projectId === project.id && po.status !== 'Cancelled')
    .reduce((sum, po) => sum + Number(po.totalAmount || (po as any).total || 0), 0);

  const availableMaterialBudget = Math.max(0, decomposition.totalMaterialSupplyBudget - existingPoTotal);

  // Group materials by discipline
  const groupedByDiscipline: Record<string, BOQItemBreakdown[]> = {};
  decomposition.items.forEach((it) => {
    if (!groupedByDiscipline[it.discipline]) {
      groupedByDiscipline[it.discipline] = [];
    }
    groupedByDiscipline[it.discipline].push(it);
  });

  const generatedPOs: PurchaseOrder[] = [];
  let accumulatedDraftAmount = 0;

  Object.entries(groupedByDiscipline).forEach(([discKey, items]) => {
    // Find matching supplier
    const matchedSupplier: any =
      suppliers.find(
        (s: any) =>
          (s.category || '').toLowerCase().includes(discKey) ||
          (s.specialty || '').toLowerCase().includes(discKey) ||
          (s.name || '').toLowerCase().includes(discKey)
      ) ||
      suppliers[0] || {
        id: 'sup-naffco-01',
        name: 'شركة نافكو للمعدات الفنية (NAFFCO)',
        companyName: 'NAFFCO Saudi Arabia',
      };

    const nextPoCode = generateNextDocumentNumber('po');
    const itemsSubtotal = items.reduce((sum, it) => sum + it.materialSupplyCost, 0);
    const vat15 = Math.round(itemsSubtotal * 0.15 * 100) / 100;
    const totalAmount = Math.round((itemsSubtotal + vat15) * 100) / 100;

    accumulatedDraftAmount += totalAmount;

    const newDraftPO: PurchaseOrder = {
      id: nextPoCode,
      poNumber: nextPoCode,
      projectId: project.id,
      projectName: project.name,
      supplierName: matchedSupplier.companyName || matchedSupplier.name || 'مورد معتمد',
      supplierId: matchedSupplier.id || 'sup-auto',
      items: items.map((it, idx) => ({
        id: `po-item-${idx + 1}`,
        description: `توريد مواد: ${it.description}`,
        quantity: it.quantity,
        unitPrice: Math.round((it.materialSupplyCost / Math.max(1, it.quantity)) * 100) / 100,
        totalPrice: it.materialSupplyCost,
      })),
      subtotal: itemsSubtotal,
      vatAmount: vat15,
      totalAmount,
      status: 'DRAFT_PENDING_APPROVAL' as any, // 'DRAFT_PENDING_APPROVAL'
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.fullName || currentUser?.name || 'BOQ Auto-Procurement Engine',
      notes: `مسودة أمر شراء منشأة تلقائياً بناءً على تحليل مقايسة المشروع (${project.name}). للتوريد الميداني المعتمد.`,
    } as any;

    generatedPOs.push(newDraftPO);
  });

  const isOverBudget = accumulatedDraftAmount > (availableMaterialBudget || project.contractValue);

  // Persist draft POs into storage
  if (generatedPOs.length > 0) {
    const updatedPOs = [...generatedPOs, ...existingPOs];
    writeStorage(KEYS.PURCHASE_ORDERS, updatedPOs, 'rmt_pos_updated');
  }

  return {
    generatedPOs,
    projectMaterialBudget: decomposition.totalMaterialSupplyBudget,
    totalDraftAmount: accumulatedDraftAmount,
    isOverBudget,
  };
}

/**
 * Approve and dispatch draft POs to suppliers.
 */
export function approveAndDispatchDraftPOs(
  poIds: string[],
  currentUser?: User | null
): { success: boolean; updatedCount: number } {
  const pos = readStorage<PurchaseOrder[]>(KEYS.PURCHASE_ORDERS, []);
  let count = 0;

  const updatedPOs = pos.map((po) => {
    if (poIds.includes(po.id) || poIds.includes(po.poNumber)) {
      count++;
      return {
        ...po,
        status: 'Approved' as const,
        updatedAt: new Date().toISOString(),
        notes: `${po.notes || ''}\n[تم الاعتماد والإرسال للموردين بتاريخ ${new Date().toLocaleDateString('ar-SA')} بواسطة ${currentUser?.fullName || 'المستخدم'}]`.trim(),
      };
    }
    return po;
  });

  if (count > 0) {
    writeStorage(KEYS.PURCHASE_ORDERS, updatedPOs, 'rmt_pos_updated');
  }

  return { success: true, updatedCount: count };
}
