import React, { useState, useMemo } from 'react';
import {
  CustomerQuotation,
  Project,
  SupplierQuotation,
  Invoice,
  PurchaseOrder,
  SystemDiscipline,
  SYSTEM_DEFINITIONS,
  getSystemMeta,
  User,
} from '../types';
import { isManagementOrSuperAdmin } from '../utils/financialMasking';
import {
  Briefcase,
  FileText,
  TrendingUp,
  Percent,
  Upload,
  CreditCard,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Trophy,
  XCircle,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  ExternalLink,
  Trash2,
  Receipt,
  ShoppingBag,
  Activity,
  Layers,
  Sparkles,
  ArrowDownRight,
  Boxes,
  Truck,
  DollarSign,
  Calendar,
  Edit2,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { ProjectOutcome, getNormalizedProjectStatus } from '../utils/projectStatusUtils';
import { M5LiveMetricsHero } from './m5/M5LiveMetricsHero';
import { M5GlassCard } from './m5/M5GlassCard';
import { DashboardMetrics } from './DashboardMetrics';
import {
  FinancialChartDetailModal,
  FinancialDetailModalData,
  FinancialBreakdownRow,
} from './FinancialChartDetailModal';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';

interface DashboardViewProps {
  currentUser?: User | null;
  projects: Project[];
  customerQuotations: CustomerQuotation[];
  supplierQuotations: SupplierQuotation[];
  invoices?: Invoice[];
  purchaseOrders?: PurchaseOrder[];
  isModernView?: boolean;
  onOpenUploadSupplierModal: () => void;
  onOpenBusinessCardModal: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectQuotation: (quotationId: string) => void;
  onCreateNewProject: () => void;
  onOpenStatusBreakdown?: (filter?: ProjectOutcome | 'all') => void;
  onDeleteCustomerQuotation?: (quotationId: string) => void;
  onDeleteSupplierQuotation?: (supplierQuoteId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  onUpdateProjectName?: (projectId: string, newName: string) => void;
  onNavigateTab?: (tab: string) => void;
}

const SYSTEM_COLORS: Record<string, string> = {
  fire_fighting: '#EF4444',
  fire_alarm: '#F97316',
  electrical: '#F59E0B',
  mechanical: '#3B82F6',
  cctv: '#6366F1',
  plumbing: '#06B6D4',
  civil: '#78716C',
  other_mep: '#10B981',
};

export interface ChartDetailPopupData {
  title: string;
  subtitle: string;
  contractValue: number | string;
  projectCost: number | string;
  netProfit: number | string;
  profitMargin: string;
  executionStatus: string;
  projectId?: string;
  countLabel?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  projects,
  customerQuotations,
  supplierQuotations,
  invoices = [],
  purchaseOrders = [],
  isModernView = false,
  onOpenUploadSupplierModal,
  onOpenBusinessCardModal,
  onSelectProject,
  onSelectQuotation,
  onCreateNewProject,
  onOpenStatusBreakdown,
  onDeleteCustomerQuotation,
  onDeleteSupplierQuotation,
  onDeleteProject,
  onUpdateProjectName,
  onNavigateTab,
}) => {
  const canSeeFinancials = isManagementOrSuperAdmin(currentUser ?? null);
  const [systemFilter, setSystemFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartViewMode, setChartViewMode] = useState<
    'won_projects' | 'all_projects' | 'systems' | 'procurement' | 'tender_status'
  >('tender_status');
  const [popupDetail, setPopupDetail] = useState<FinancialDetailModalData | null>(null);

  // Deletion modal targets (bypassing window.confirm which is blocked in iframes)
  const [deleteCustomerQuoteTarget, setDeleteCustomerQuoteTarget] = useState<CustomerQuotation | null>(null);
  const [deleteSupplierQuoteTarget, setDeleteSupplierQuoteTarget] = useState<SupplierQuotation | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);

  // Inline Project Name Editing State
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectNameValue, setEditingProjectNameValue] = useState<string>('');

  // ==========================================
  // Core Financial & Operational Calculations
  // ==========================================
  // Helper to compute a project's comprehensive financial profile (including VAT where applicable)
  const getProjectFinancials = (p: Project) => {
    const quotes = customerQuotations.filter((q) => q.projectId === p.id);
    const primaryQuote = quotes[0];

    // Revenue (including VAT): from active quotation grandTotalWithVat, or project budget * 1.15 if budget doesn't include VAT
    const revenue =
      quotes.length > 0
        ? quotes.reduce((sum, q) => sum + (q.totals?.grandTotalWithVat || q.totals?.customerSellingPrice * 1.15 || 0), 0)
        : (p.budget ? p.budget * 1.15 : 0);

    // Planned Cost (base cost): from quotation totals or estimated 75% of net revenue
    const netRevenue =
      quotes.length > 0
        ? quotes.reduce((sum, q) => sum + (q.totals?.customerSellingPrice || 0), 0)
        : p.budget || 0;

    const plannedCost =
      quotes.length > 0
        ? quotes.reduce((sum, q) => sum + (q.totals?.totalProjectCost || 0), 0)
        : Math.round(netRevenue * 0.75);

    // Actual Incurred Costs logged in project
    const actualIncurredCost = (p.incurredCosts || []).reduce(
      (sum, c) => sum + (Number(c.amount) || 0),
      0
    );

    // Committed POs for this project (POs already include VAT in grandTotal)
    const committedPOCost = purchaseOrders
      .filter((po) => po.projectId === p.id)
      .reduce((sum, po) => sum + (Number(po.grandTotal) || 0), 0);

    // Tracked total cost so far
    const trackedCost = actualIncurredCost + committedPOCost;

    // Effective Cost: use tracked cost if logged, otherwise baseline planned cost
    const effectiveCost = trackedCost > 0 ? trackedCost : plannedCost;
    const profit = Math.max(0, netRevenue - (trackedCost > 0 ? trackedCost : plannedCost));
    const marginPct = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

    return {
      revenue,
      netRevenue,
      plannedCost,
      actualIncurredCost,
      committedPOCost,
      trackedCost,
      effectiveCost,
      profit,
      marginPct,
      hasQuotes: quotes.length > 0,
      primaryQuote,
    };
  };

  // Comprehensive Project-Based Financial Portfolio Stats (Projects, Costs & Profits)
  const projectFinancialStats = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalActualCosts = 0;

    projects.forEach((p) => {
      const fin = getProjectFinancials(p);
      totalRevenue += fin.revenue;
      totalCost += fin.effectiveCost;
      totalProfit += fin.profit;
      totalActualCosts += fin.actualIncurredCost;
    });

    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      totalActualCosts,
      avgMargin,
    };
  }, [projects, customerQuotations, purchaseOrders]);

  const totalQuotationValue = useMemo(
    () => customerQuotations.reduce((sum, q) => sum + (q.totals?.customerSellingPrice || 0), 0),
    [customerQuotations]
  );

  const totalProjectCost = useMemo(
    () => customerQuotations.reduce((sum, q) => sum + (q.totals?.totalProjectCost || 0), 0),
    [customerQuotations]
  );

  const totalGrossProfit = totalQuotationValue - totalProjectCost;
  const averageGrossMargin = totalQuotationValue > 0 ? (totalGrossProfit / totalQuotationValue) * 100 : 0;

  // Active / Won projects
  const wonProjects = useMemo(
    () => projects.filter((p) => getNormalizedProjectStatus(p.status) === 'Won'),
    [projects]
  );

  const wonProjectsFinancialSummary = useMemo(() => {
    return wonProjects.map((p) => {
      const fin = getProjectFinancials(p);
      const execStatus = p.executionStatus || 'قيد التنفيذ';
      const completion = p.completionPercentage ?? (execStatus === 'تام' ? 100 : 50);
      return {
        id: p.id,
        projectNumber: p.projectNumber,
        name: p.name.length > 16 ? p.name.substring(0, 16) + '...' : p.name,
        fullName: p.name,
        customerName: p.customerName,
        location: p.location,
        revenue: Math.round(fin.revenue),
        cost: Math.round(fin.effectiveCost),
        profit: Math.round(fin.profit),
        marginPct: fin.marginPct.toFixed(1),
        actualCost: Math.round(fin.actualIncurredCost),
        committedPOCost: Math.round(fin.committedPOCost),
        executionStatus: execStatus,
        completionPercentage: completion,
        'قيمة العقد والبيع (Contract Value)': Math.round(fin.revenue),
        'تكلفة المشروع الإجمالية (Project Cost)': Math.round(fin.effectiveCost),
        'صافي ربح المشروع (Net Profit)': Math.round(fin.profit),
      };
    });
  }, [wonProjects, customerQuotations, purchaseOrders]);

  const wonProjectsTotalValue = useMemo(() => {
    return wonProjectsFinancialSummary.reduce((sum, p) => sum + p.revenue, 0);
  }, [wonProjectsFinancialSummary]);

  const wonProjectsTotalCost = useMemo(() => {
    return wonProjectsFinancialSummary.reduce((sum, p) => sum + p.cost, 0);
  }, [wonProjectsFinancialSummary]);

  const wonProjectsTotalProfit = useMemo(() => {
    return Math.max(0, wonProjectsTotalValue - wonProjectsTotalCost);
  }, [wonProjectsTotalValue, wonProjectsTotalCost]);

  const wonProjectsAvgMargin = useMemo(() => {
    return wonProjectsTotalValue > 0 ? (wonProjectsTotalProfit / wonProjectsTotalValue) * 100 : 0;
  }, [wonProjectsTotalValue, wonProjectsTotalProfit]);

  // Invoicing & Collections
  const totalInvoiced = useMemo(
    () => invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
    [invoices]
  );

  const totalCollected = useMemo(() => {
    // Sum all actual payments recorded across all invoices
    const invoicePaymentsTotal = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    // Also include recorded advance payments from projects that might not be tied to an invoice yet
    const standaloneAdvances = projects.reduce((sum, p) => {
      const pAdvance = p.advancePaymentAmount || 0;
      const hasInvoiceForAdvance = invoices.some(inv => inv.projectId === p.id && (inv.paidAmount || 0) >= pAdvance);
      return sum + (hasInvoiceForAdvance ? 0 : pAdvance);
    }, 0);

    return invoicePaymentsTotal + standaloneAdvances;
  }, [projects, invoices]);

  const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
  const totalReceivables = Math.max(0, totalInvoiced - totalCollected);

  // Procurement & PO stats
  const totalPOValue = useMemo(
    () => purchaseOrders.reduce((sum, po) => sum + (po.grandTotal || 0), 0),
    [purchaseOrders]
  );

  // Status breakdown calculations (Won, Under Pricing, Lost)
  const statusStats = useMemo(() => {
    let wonCount = 0;
    let wonValue = 0;
    let pricingCount = 0;
    let pricingValue = 0;
    let lostCount = 0;
    let lostValue = 0;
    let lostWithReasonCount = 0;

    projects.forEach((p) => {
      const outcome = getNormalizedProjectStatus(p.status);
      const quotes = customerQuotations.filter((q) => q.projectId === p.id);
      const val =
        quotes.length > 0
          ? quotes.reduce((sum, q) => sum + (q.totals?.customerSellingPrice || 0), 0)
          : (p.budget || 0);

      if (outcome === 'Won') {
        wonCount++;
        wonValue += val;
      } else if (outcome === 'Lost') {
        lostCount++;
        lostValue += val;
        if (p.lossReason && p.lossReason.trim().length > 0) {
          lostWithReasonCount++;
        }
      } else {
        pricingCount++;
        pricingValue += val;
      }
    });

    const total = projects.length || 1;
    const wonPct = Math.round((wonCount / total) * 100);
    const pricingPct = Math.round((pricingCount / total) * 100);
    const lostPct = Math.max(0, 100 - wonPct - pricingPct);

    return {
      wonCount,
      wonValue,
      wonPct,
      pricingCount,
      pricingValue,
      pricingPct,
      lostCount,
      lostValue,
      lostPct,
      lostWithReasonCount,
      totalProjects: projects.length,
      totalPortfolioValue: wonValue + pricingValue + lostValue,
    };
  }, [projects, customerQuotations]);

  const tenderStatusChartData = useMemo(() => [
    { name: 'فزت بها (Won)', value: statusStats.wonValue || 1, count: statusStats.wonCount, color: '#059669' },
    { name: 'قيد التسعير (Under Pricing)', value: statusStats.pricingValue || 1, count: statusStats.pricingCount, color: '#D97706' },
    { name: 'خسرته (Lost)', value: statusStats.lostValue || 1, count: statusStats.lostCount, color: '#E11D48' },
  ], [statusStats]);

  // ==========================================
  // Chart Data Preparation
  // ==========================================
  
  // 1. Systems Discipline Distribution
  const systemsChartData = useMemo(() => {
    const counts: Record<string, { count: number; value: number; nameAr: string; nameEn: string }> = {};

    SYSTEM_DEFINITIONS.forEach((sys) => {
      counts[sys.id] = { count: 0, value: 0, nameAr: sys.nameAr, nameEn: sys.nameEn };
    });

    customerQuotations.forEach((q) => {
      const sysList = q.selectedSystems && q.selectedSystems.length > 0 ? q.selectedSystems : ['other_mep' as SystemDiscipline];
      const perSysVal = (q.totals?.customerSellingPrice || 0) / sysList.length;

      sysList.forEach((s) => {
        if (!counts[s]) {
          counts[s] = { count: 0, value: 0, nameAr: s, nameEn: s };
        }
        counts[s].count += 1;
        counts[s].value += perSysVal;
      });
    });

    return Object.keys(counts)
      .filter((k) => counts[k].count > 0 || counts[k].value > 0)
      .map((k) => ({
        id: k,
        name: counts[k].nameAr,
        nameEn: counts[k].nameEn,
        value: Math.round(counts[k].value),
        count: counts[k].count,
        color: SYSTEM_COLORS[k] || '#10B981',
      }));
  }, [customerQuotations]);

  // 2. Financial Bar Chart Data (Won Projects vs All Projects)
  const wonProjectsFinancialChartData = useMemo(() => {
    return wonProjectsFinancialSummary.map((p) => ({
      id: p.id,
      name: p.name,
      fullName: p.fullName,
      projectNumber: p.projectNumber,
      client: p.customerName,
      'قيمة العقد والبيع (Contract Value)': p.revenue,
      'تكلفة المشروع الإجمالية (Project Cost)': p.cost,
      'صافي ربح المشروع (Net Profit)': p.profit,
      marginPct: p.marginPct,
      actualCost: p.actualCost,
      committedPOCost: p.committedPOCost,
      executionStatus: p.executionStatus,
      completionPercentage: p.completionPercentage,
    }));
  }, [wonProjectsFinancialSummary]);

  const allProjectsFinancialChartData = useMemo(() => {
    return projects.map((p) => {
      const fin = getProjectFinancials(p);
      const outcome = getNormalizedProjectStatus(p.status);
      const execStatus = p.executionStatus || 'قيد التنفيذ';
      return {
        id: p.id,
        name: p.name.length > 14 ? p.name.substring(0, 14) + '...' : p.name,
        fullName: p.name,
        projectNumber: p.projectNumber,
        client: p.customerName,
        status: outcome,
        'قيمة المشروع (Revenue)': Math.round(fin.revenue),
        'تكلفة المشروع (Cost)': Math.round(fin.effectiveCost),
        'صافي الربح (Profit)': Math.round(fin.profit),
        marginPct: fin.marginPct.toFixed(1),
        executionStatus: execStatus,
      };
    });
  }, [projects, customerQuotations, purchaseOrders]);

  // 3. Procurement & Delivery Status Chart Data
  const procurementStatusData = useMemo(() => {
    let delivered = 0;
    let partial = 0;
    let pending = 0;

    purchaseOrders.forEach((po) => {
      if (po.deliveryStatus === 'Delivered') delivered++;
      else if (po.deliveryStatus === 'Partial Delivered') partial++;
      else pending++;
    });

    return [
      { name: 'تم التوريد بالكامل', value: delivered, color: '#10B981' },
      { name: 'توريد جزئي', value: partial, color: '#F59E0B' },
      { name: 'قيد التوريد / معلق', value: pending, color: '#3B82F6' },
    ].filter((d) => d.value > 0 || purchaseOrders.length === 0);
  }, [purchaseOrders]);

  const procurementOrdersChartData = useMemo(() => {
    const totalIssued = purchaseOrders.length;
    const totalReceived = purchaseOrders.filter(
      (po) => po.deliveryStatus === 'Delivered' || po.fulfillmentStatus === 'Fully Received'
    ).length;
    const partialOrPending = Math.max(0, totalIssued - totalReceived);
    return [
      { name: 'أوامر الشراء المصدرة', value: totalIssued, color: '#1E3A8A' },
      { name: 'أوامر الشراء المستلمة', value: totalReceived, color: '#10B981' },
      { name: 'قيد التوريد / معلق', value: partialOrPending, color: '#F59E0B' },
    ].filter((d) => d.value > 0 || purchaseOrders.length === 0);
  }, [purchaseOrders]);

  const procurementAmountsChartData = useMemo(() => {
    const totalAmount = purchaseOrders.reduce((sum, po) => sum + (po.grandTotal || 0), 0);
    const totalPaid = purchaseOrders.reduce((sum, po) => {
      const paid = po.paidAmount || (po.payments ? po.payments.reduce((pSum, pay) => pSum + (pay.amount || 0), 0) : 0);
      return sum + paid;
    }, 0);
    const totalRemaining = Math.max(0, totalAmount - totalPaid);
    return [
      { name: 'إجمالي أوامر الشراء', value: totalAmount, color: '#1E3A8A' },
      { name: 'المدفوعات للموردين', value: totalPaid, color: '#10B981' },
      { name: 'المبالغ المتبقية', value: totalRemaining, color: '#F59E0B' },
    ].filter((d) => d.value > 0 || purchaseOrders.length === 0);
  }, [purchaseOrders]);

  // Filtered lists
  const filteredQuotations = useMemo(() => {
    return customerQuotations.filter((q) => {
      const quoteSystems = q.selectedSystems || [];
      const matchesSystem =
        systemFilter === 'all' || quoteSystems.includes(systemFilter as SystemDiscipline);
      const matchesSearch =
        q.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSystem && matchesSearch;
    });
  }, [customerQuotations, systemFilter, searchQuery]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const projectSystems = p.systems || p.selectedSystems || [];
      const matchesSystem =
        systemFilter === 'all' || projectSystems.includes(systemFilter as SystemDiscipline);
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.projectNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSystem && matchesSearch;
    });
  }, [projects, systemFilter, searchQuery]);

  // =========================================================================
  // Context-Aware Drilldown Handlers for Financial Charts
  // =========================================================================
  const handleOpenTenderStatusModal = (statusName: string, statusCount: number, statusValue: number, color?: string) => {
    // Find all projects that map to this normalized status
    const matchingProjects = projects.filter((p) => {
      const norm = getNormalizedProjectStatus(p.status);
      const isWon = norm === 'Won';
      const isLost = norm === 'Lost';

      if (statusName.includes('فائزة') || statusName.includes('تمت الترسية') || statusName === 'مشاريع فائزة' || statusName.includes('Won')) {
        return isWon;
      }
      if (statusName.includes('خاسرة') || statusName.includes('مستبعدة') || statusName === 'مشاريع خاسرة' || statusName.includes('Lost')) {
        return isLost;
      }
      // Under study / pricing
      return !isWon && !isLost;
    });

    const totalPortfolioVal = projects.reduce((s, p) => s + getProjectFinancials(p).revenue, 0) || 1;
    const sharePct = Math.round((statusValue / totalPortfolioVal) * 100);

    const breakdownItems: FinancialBreakdownRow[] = matchingProjects.map((p) => {
      const f = getProjectFinancials(p);
      return {
        title: p.name,
        subtitle: `${p.projectNumber || 'بدون رقم'} • ${p.customerName || 'بدون عميل'}`,
        value: `${Math.round(f.revenue).toLocaleString()} SAR [Incl. 15% VAT]`,
        subValue: `تكلفة: ${Math.round(f.effectiveCost).toLocaleString()} SAR [Excl. VAT]`,
        badge: p.executionStatus || 'قيد التنفيذ',
        badgeColor: (statusName.includes('فائزة') || statusName.includes('Won')) ? 'emerald' : (statusName.includes('خاسرة') || statusName.includes('Lost')) ? 'rose' : 'amber',
        onClick: () => {
          setPopupDetail(null);
          onSelectProject(p.id);
        },
      };
    });

    const estCost = Math.round(statusValue * 0.76);
    const estProfit = Math.round(statusValue * 0.24);

    setPopupDetail({
      category: 'tender_status',
      title: `حالة العطاء: ${statusName}`,
      subtitle: `تحليل مالي وميداني شامل لعدد ${statusCount} مشروع مسجل في المنظومة`,
      badge: {
        text: `${statusCount} مشاريع (${sharePct}%)`,
        variant: (statusName.includes('فائزة') || statusName.includes('Won')) ? 'emerald' : (statusName.includes('خاسرة') || statusName.includes('Lost')) ? 'rose' : 'amber',
      },
      metrics: [
        {
          label: 'إجمالي قيمة العطاءات [Excl. VAT]',
          value: `${Math.round(statusValue).toLocaleString()} SAR [Excl. VAT]`,
          sublabel: `تمثل نسبة ${sharePct}% من إجمالي المحفظة المالية`,
          color: 'emerald',
        },
        {
          label: 'عدد المشاريع',
          value: `${statusCount} مشروع`,
          sublabel: `${matchingProjects.length} مشروع مطابق في النظام`,
          color: 'blue',
        },
        {
          label: 'التكلفة التقديرية [Excl. VAT]',
          value: `${estCost.toLocaleString()} SAR [Excl. VAT]`,
          sublabel: 'مبنية على الميزانيات التقديرية والتسعير',
          color: 'amber',
        },
        {
          label: 'العائد الربحي المتوقع [Excl. VAT]',
          value: `${estProfit.toLocaleString()} SAR [Excl. VAT]`,
          sublabel: 'متوسط هامش 24.0%',
          color: 'teal',
        },
      ],
      progressInfo: {
        title: 'نسبة الاستحواذ من إجمالي المحفظة',
        percentage: sharePct,
        color: color || '#059669',
        detail: `${Math.round(statusValue).toLocaleString()} من أصل ${Math.round(totalPortfolioVal).toLocaleString()} SAR [Excl. VAT]`,
      },
      breakdownTitle: `المشاريع المسجلة في حالة (${statusName})`,
      breakdownItems: breakdownItems.length > 0 ? breakdownItems : [
        {
          title: 'لا توجد مشاريع مسجلة حالياً بهذه الحالة',
          subtitle: 'يمكنك إضافة مشاريع جديدة أو تعديل حالات العطاءات',
          value: '0 SAR [Excl. VAT]',
        }
      ],
    });
  };

  const handleOpenWonProjectModal = (projData: any) => {
    const pId = projData.id;
    const realProj = projects.find((p) => p.id === pId);
    const pFin = realProj ? getProjectFinancials(realProj) : null;

    const rev = pFin ? pFin.revenue : (projData.revenue || projData['قيمة العقد والبيع (Contract Value)'] || 0);
    const cost = pFin ? pFin.effectiveCost : (projData.cost || projData['تكلفة المشروع الإجمالية (Project Cost)'] || 0);
    const prof = pFin ? pFin.profit : (projData.profit || projData['صافي ربح المشروع (Net Profit)'] || 0);
    const margin = pFin ? pFin.marginPct.toFixed(1) : (projData.marginPct || '0.0');
    const pName = realProj?.name || projData.fullName || 'مشروع فائز';
    const pNum = realProj?.projectNumber || projData.projectNumber || '—';
    const pClient = realProj?.customerName || projData.customerName || projData.client || 'عميل معتمد';
    const pStatus = realProj?.executionStatus || realProj?.status || projData.executionStatus || 'قيد التنفيذ';

    // Purchase orders associated with this project
    const projPOs = purchaseOrders.filter((po) => po.projectId === pId);
    const totalPOAmt = projPOs.reduce((s, po) => s + (po.grandTotal || po.totalAmount || 0), 0);
    const totalPOPaid = projPOs.reduce((s, po) => s + (po.paidAmount || (po.payments ? po.payments.reduce((sum, pay) => sum + pay.amount, 0) : 0)), 0);
    const totalPORemaining = Math.max(0, totalPOAmt - totalPOPaid);

    const breakdownItems: FinancialBreakdownRow[] = projPOs.length > 0
      ? projPOs.map((po) => {
          const isFullyReceived = po.fulfillmentStatus === 'Fully Received' || po.deliveryStatus === 'Delivered';
          const poPaid = po.paidAmount || (po.payments ? po.payments.reduce((sum, pay) => sum + pay.amount, 0) : 0);
          return {
            title: po.poNumber || `أمر شراء ${po.id ? String(po.id).slice(0, 6) : 'PO'}`,
            subtitle: `المورد: ${po.supplierName || po.vendorName || 'مورد معتمد'} • تاريخ: ${po.date || '—'}`,
            value: `${(po.grandTotal || po.totalAmount || 0).toLocaleString()} SAR [Incl. 15% VAT]`,
            subValue: `مدفوع: ${poPaid.toLocaleString()} SAR [Incl. 15% VAT] • متبقي: ${(Math.max(0, (po.grandTotal || 0) - poPaid)).toLocaleString()} SAR [Incl. 15% VAT]`,
            badge: isFullyReceived ? 'مستلم بالكامل' : 'قيد التوريد',
            badgeColor: isFullyReceived ? 'emerald' : 'amber',
          };
        })
      : (realProj?.systems || realProj?.selectedSystems || []).map((sys, sIdx) => ({
          title: `نظام: ${sys}`,
          subtitle: 'تخصص هندسي كهروميكانيكي معتمد بالمشروع',
          value: 'معتمد ونشط',
          badge: 'نظام معتمد',
          badgeColor: 'blue',
        }));

    setPopupDetail({
      category: 'won_projects',
      title: pName,
      subtitle: `رقم المشروع: ${pNum} • العميل: ${pClient}`,
      badge: {
        text: 'مشروع فائز معتمد',
        variant: 'emerald',
      },
      metrics: [
        {
          label: 'قيمة العقد والبيع [Incl. 15% VAT]',
          value: `${Math.round(rev).toLocaleString()} SAR [Incl. 15% VAT]`,
          sublabel: `صافي البيع قبل الضريبة: ${Math.round(rev / 1.15).toLocaleString()} SAR [Excl. VAT]`,
          color: 'emerald',
        },
        {
          label: 'إجمالي تكلفة المشروع [Excl. VAT]',
          value: `${Math.round(cost).toLocaleString()} SAR [Excl. VAT]`,
          sublabel: `التكلفة الفعلية والمحجوزة بالمشتريات`,
          color: 'amber',
        },
        {
          label: 'صافي الربح المحقق [Excl. VAT]',
          value: `${Math.round(prof).toLocaleString()} SAR [Excl. VAT]`,
          sublabel: `هامش ربح المشروع: ${margin}%`,
          color: 'teal',
        },
        {
          label: 'حالة الإنجاز الميداني',
          value: pStatus,
          sublabel: projPOs.length > 0 ? `${projPOs.length} أوامر شراء (${totalPOAmt.toLocaleString()} SAR [Incl. 15% VAT])` : 'لا توجد أوامر شراء مسجلة بعد',
          color: 'blue',
        },
      ],
      progressInfo: {
        title: 'هامش الربحية للمشروع',
        percentage: Math.min(100, Math.max(0, Number(margin) || 0)),
        color: '#10B981',
        detail: `صافي الربح ${Math.round(prof).toLocaleString()} SAR [Excl. VAT] من أصل إيراد ${Math.round(rev).toLocaleString()} SAR [Incl. 15% VAT]`,
      },
      breakdownTitle: projPOs.length > 0 ? 'أوامر الشراء المرتبطة بالمشروع' : 'الأنظمة والتخصصات الهندسية بالمشروع',
      breakdownItems,
      actionButton: pId
        ? {
            label: 'الانتقال إلى شاشة إدارة المشروع',
            icon: 'project',
            onClick: () => {
              setPopupDetail(null);
              onSelectProject(pId);
            },
          }
        : undefined,
    });
  };

  const handleOpenAllProjectModal = (projData: any) => {
    const pId = projData.id;
    const realProj = projects.find((p) => p.id === pId);
    const pFin = realProj ? getProjectFinancials(realProj) : null;

    const rev = pFin ? pFin.revenue : (projData['قيمة المشروع (Revenue)'] || 0);
    const cost = pFin ? pFin.effectiveCost : (projData['تكلفة المشروع (Cost)'] || 0);
    const prof = pFin ? pFin.profit : (projData['صافي الربح (Profit)'] || 0);
    const margin = pFin ? pFin.marginPct.toFixed(1) : (projData.marginPct || '0.0');
    const pName = realProj?.name || projData.fullName || 'مشروع';
    const pNum = realProj?.projectNumber || projData.projectNumber || '—';
    const pClient = realProj?.customerName || projData.client || 'عميل مسجل';
    const pStatus = realProj?.executionStatus || realProj?.status || projData.executionStatus || 'مسجل';

    const breakdownItems: FinancialBreakdownRow[] = (realProj?.systems || realProj?.selectedSystems || []).map((sys) => ({
      title: `نظام: ${sys}`,
      subtitle: 'تخصص كهروميكانيكي معتمد بالمشروع',
      value: 'معتمد',
      badge: 'نظام نشط',
      badgeColor: 'purple',
    }));

    setPopupDetail({
      category: 'all_projects',
      title: pName,
      subtitle: `رقم المشروع: ${pNum} • العميل: ${pClient}`,
      badge: {
        text: pStatus,
        variant: 'blue',
      },
      metrics: [
        {
          label: 'إيراد المشروع الإجمالي [Incl. 15% VAT]',
          value: `${Math.round(rev).toLocaleString()} SAR [Incl. 15% VAT]`,
          sublabel: 'القيمة المسجلة بالعرض والميزانية',
          color: 'blue',
        },
        {
          label: 'التكلفة التشغيلية [Excl. VAT]',
          value: `${Math.round(cost).toLocaleString()} SAR [Excl. VAT]`,
          sublabel: 'التكلفة المحسوبة للبنود والموردين',
          color: 'amber',
        },
        {
          label: 'صافي الربح التقديري [Excl. VAT]',
          value: `${Math.round(prof).toLocaleString()} SAR [Excl. VAT]`,
          sublabel: `هامش الربح المتوقع: ${margin}%`,
          color: 'emerald',
        },
        {
          label: 'حالة المشروع الحالية',
          value: pStatus,
          sublabel: `تاريخ الإنشاء: ${realProj?.createdAt || 'اليوم'}`,
          color: 'slate',
        },
      ],
      progressInfo: {
        title: 'نسبة هامش الربح',
        percentage: Math.min(100, Math.max(0, Number(margin) || 0)),
        color: '#3B82F6',
        detail: `ربح تقديري ${Math.round(prof).toLocaleString()} SAR [Excl. VAT] بمعدل ${margin}%`,
      },
      breakdownTitle: 'التفاصيل والأنظمة المعتمدة بالمشروع',
      breakdownItems: breakdownItems.length > 0 ? breakdownItems : [
        {
          title: 'الأنظمة العامة للمشروع',
          subtitle: 'أنظمة كهروميكانيكية متكاملة',
          value: 'جاهز للتنفيذ',
          badge: 'MEP',
          badgeColor: 'slate',
        }
      ],
      actionButton: pId
        ? {
            label: 'عرض وتحرير المشروع',
            icon: 'project',
            onClick: () => {
              setPopupDetail(null);
              onSelectProject(pId);
            },
          }
        : undefined,
    });
  };

  const handleOpenSystemModal = (systemName: string, systemCount: number, systemValue: number, color?: string) => {
    // Find all projects that contain this system
    const matchingProjects = projects.filter((p) => (p.systems || p.selectedSystems || []).includes(systemName as any));

    const totalVal = systemsChartData.reduce((s, i) => s + i.value, 0) || 1;
    const pct = Math.round((systemValue / totalVal) * 100);

    const breakdownItems: FinancialBreakdownRow[] = matchingProjects.map((p) => {
      const f = getProjectFinancials(p);
      return {
        title: p.name,
        subtitle: `مشروع ${p.projectNumber || ''} • العميل: ${p.customerName || 'معتمد'}`,
        value: `${Math.round(f.revenue).toLocaleString()} SAR [Incl. 15% VAT]`,
        subValue: `ربح: ${Math.round(f.profit).toLocaleString()} SAR [Excl. VAT]`,
        badge: p.executionStatus || 'قيد التنفيذ',
        badgeColor: 'purple',
        onClick: () => {
          setPopupDetail(null);
          onSelectProject(p.id);
        },
      };
    });

    setPopupDetail({
      category: 'systems',
      title: `التخصص الهندسي: ${systemName}`,
      subtitle: `تحليل تفصيلي لحجم أعمال وعروض أنظمة ${systemName} في المنظومة`,
      badge: {
        text: `${systemCount} عروض (${pct}%)`,
        variant: 'purple',
      },
      metrics: [
        {
          label: 'إجمالي حجم أعمال النظام [Excl. VAT]',
          value: `${Math.round(systemValue).toLocaleString()} SAR [Excl. VAT]`,
          sublabel: `يمثل ${pct}% من إجمالي التخصصات الكهروميكانيكية`,
          color: 'purple',
        },
        {
          label: 'عدد عروض الأسعار والمشاريع',
          value: `${systemCount} عرض / مشروع`,
          sublabel: `${matchingProjects.length} مشروع فعلي يحتوي هذا النظام`,
          color: 'blue',
        },
        {
          label: 'متوسط قيمة النظام بالمشروع [Excl. VAT]',
          value: systemCount > 0 ? `${Math.round(systemValue / systemCount).toLocaleString()} SAR [Excl. VAT]` : '—',
          sublabel: 'حجم العمل المتوسط لكل عطاء',
          color: 'teal',
        },
        {
          label: 'العائد الربحي التقديري [Excl. VAT]',
          value: `${Math.round(systemValue * 0.25).toLocaleString()} SAR [Excl. VAT]`,
          sublabel: 'متوسط هامش أرباح التخصص 25%',
          color: 'emerald',
        },
      ],
      progressInfo: {
        title: 'حصة النظام من حجم الأعمال الكهروميكانيكية',
        percentage: pct,
        color: color || '#8B5CF6',
        detail: `${Math.round(systemValue).toLocaleString()} من أصل ${Math.round(totalVal).toLocaleString()} SAR [Excl. VAT]`,
      },
      breakdownTitle: `المشاريع الحالية التي تتضمن نظام (${systemName})`,
      breakdownItems: breakdownItems.length > 0 ? breakdownItems : [
        {
          title: `لا توجد مشاريع مخصصة بالنظام حالياً`,
          subtitle: 'يمكنك إضافة هذا النظام عند إنشاء عرض تسعير جديد',
          value: '0 SAR [Excl. VAT]',
          badge: 'جديد',
          badgeColor: 'slate',
        }
      ],
    });
  };

  const handleOpenProcurementModal = (clickedLabel: string, clickedVal?: number) => {
    // Total PO calculations
    const totalCount = purchaseOrders.length;
    const totalIssuedAmt = purchaseOrders.reduce((s, po) => s + (po.grandTotal || po.totalAmount || 0), 0);
    const totalPaidAmt = purchaseOrders.reduce((s, po) => {
      const paid = po.paidAmount || (po.payments ? po.payments.reduce((pSum, pay) => pSum + (pay.amount || 0), 0) : 0);
      return s + paid;
    }, 0);
    const totalRemainingAmt = Math.max(0, totalIssuedAmt - totalPaidAmt);
    const receivedCount = purchaseOrders.filter(
      (po) => po.fulfillmentStatus === 'Fully Received' || po.deliveryStatus === 'Delivered'
    ).length;
    const paymentRatePct = totalIssuedAmt > 0 ? Math.round((totalPaidAmt / totalIssuedAmt) * 100) : 0;

    const breakdownItems: FinancialBreakdownRow[] = purchaseOrders.map((po) => {
      const amt = po.grandTotal || po.totalAmount || 0;
      const paid = po.paidAmount || (po.payments ? po.payments.reduce((pSum, pay) => pSum + (pay.amount || 0), 0) : 0);
      const rem = Math.max(0, amt - paid);
      const isReceived = po.fulfillmentStatus === 'Fully Received' || po.deliveryStatus === 'Delivered';
      return {
        title: po.poNumber || `أمر شراء ${po.id ? String(po.id).slice(0, 6) : 'PO'}`,
        subtitle: `المورد: ${po.supplierName || po.vendorName || 'مورد معتمد'} • المشروع: ${po.projectName || 'مشروع عام'}`,
        value: `${amt.toLocaleString()} SAR [Incl. 15% VAT]`,
        subValue: `مدفوع: ${paid.toLocaleString()} SAR [Incl. 15% VAT] • متبقي: ${rem.toLocaleString()} SAR [Incl. 15% VAT]`,
        badge: isReceived ? 'مستلم بالكامل' : 'قيد التوريد',
        badgeColor: isReceived ? 'emerald' : 'amber',
      };
    });

    setPopupDetail({
      category: 'procurement',
      title: `تفاصيل المشتريات والتوريدات: ${clickedLabel}`,
      subtitle: `تحليل مالي وميداني شامل لعدد ${totalCount} أمر شراء صادر مع متابعة المدفوعات والمستحقات للموردين`,
      badge: {
        text: `نسبة السداد: ${paymentRatePct}%`,
        variant: paymentRatePct >= 80 ? 'emerald' : paymentRatePct >= 40 ? 'amber' : 'blue',
      },
      metrics: [
        {
          label: 'عدد أوامر الشراء',
          value: `${totalCount} أوامر`,
          sublabel: `${receivedCount} أوامر مستلمة ميدانياً • ${totalCount - receivedCount} أوامر قيد التوريد`,
          color: 'blue',
        },
        {
          label: 'إجمالي أسعار أوامر الشراء [Incl. 15% VAT]',
          value: `${totalIssuedAmt.toLocaleString()} SAR [Incl. 15% VAT]`,
          sublabel: 'القيمة الكلية المعتمدة للموردين',
          color: 'teal',
        },
        {
          label: 'المبالغ المدفوعة للموردين [Incl. 15% VAT]',
          value: `${totalPaidAmt.toLocaleString()} SAR [Incl. 15% VAT]`,
          sublabel: `نسبة السداد المالي: ${paymentRatePct}%`,
          color: 'emerald',
        },
        {
          label: 'المبالغ المتبقية للموردين [Incl. 15% VAT]',
          value: `${totalRemainingAmt.toLocaleString()} SAR [Incl. 15% VAT]`,
          sublabel: `مستحقات دفعات وتوريدات جارية`,
          color: totalRemainingAmt > 0 ? 'amber' : 'slate',
        },
      ],
      progressInfo: {
        title: 'نسبة سداد مستحقات الموردين',
        percentage: paymentRatePct,
        color: '#10B981',
        detail: `تم سداد ${totalPaidAmt.toLocaleString()} من أصل ${totalIssuedAmt.toLocaleString()} SAR`,
      },
      breakdownTitle: 'قائمة أوامر الشراء والتوريدات التفصيلية',
      breakdownItems: breakdownItems.length > 0 ? breakdownItems : [
        {
          title: 'لا توجد أوامر شراء مسجلة حالياً',
          subtitle: 'يمكنك إنشاء أوامر شراء للمشاريع من تبويب المشتريات',
          value: '0 SAR',
          badge: 'فارغ',
          badgeColor: 'slate',
        }
      ],
    });
  };

  const { companyIdentity, financialPolicies, menuCustomization } = useMasterEnterpriseStore();

  // Top-Level Summary KPI Calculations
  const kpiActiveProjectsList = useMemo(() => {
    return projects.filter((p) => p.status !== 'Lost' && p.status !== 'lost');
  }, [projects]);

  const kpiInProgressCount = useMemo(() => {
    return projects.filter(
      (p) =>
        p.status === 'In Progress' ||
        p.status === 'in_progress' ||
        p.executionStatus === 'قيد التنفيذ' ||
        p.executionStatus === 'جزئي'
    ).length;
  }, [projects]);

  const kpiPendingQuotationsList = useMemo(() => {
    return customerQuotations.filter((q) => {
      const s = String(q.status || '').toLowerCase();
      return s === 'draft' || s === 'under_review' || s === 'sent_to_customer' || s === 'sent';
    });
  }, [customerQuotations]);

  const kpiPendingQuotesTotalValue = useMemo(() => {
    return kpiPendingQuotationsList.reduce((sum, q) => {
      const val = q.totals?.grandTotalWithVat || q.totalAmount || (q.totals?.customerSellingPrice ? q.totals.customerSellingPrice * 1.15 : 0);
      return sum + Number(val || 0);
    }, 0);
  }, [kpiPendingQuotationsList]);

  const kpiPendingQuotesTotalMargin = useMemo(() => {
    return kpiPendingQuotationsList.reduce((sum, q) => sum + Number(q.totals?.grossProfit || 0), 0);
  }, [kpiPendingQuotationsList]);

  const kpiOverdueInvoicesList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return invoices.filter((inv) => {
      if (inv.status === 'Overdue') return true;
      if (inv.remainingAmount && inv.remainingAmount > 0 && inv.dueDate) {
        const d = new Date(inv.dueDate);
        return d < today;
      }
      return false;
    });
  }, [invoices]);

  const kpiOverdueInvoicesTotalAmount = useMemo(() => {
    return kpiOverdueInvoicesList.reduce((sum, inv) => sum + Number(inv.remainingAmount || 0), 0);
  }, [kpiOverdueInvoicesList]);

  const kpiSiteDeliveriesAndInspectionsCount = useMemo(() => {
    const activePOs = purchaseOrders.filter(
      (po) =>
        po.deliveryStatus === 'Partial Delivered' ||
        po.fulfillmentStatus === 'In Delivery / Partial' ||
        po.status === 'Issued' ||
        po.status === 'Approved'
    ).length;
    const activeSiteProjects = projects.filter(
      (p) => p.executionStatus === 'قيد التنفيذ' || (p.completionPercentage !== undefined && p.completionPercentage < 100)
    ).length;
    return activePOs + activeSiteProjects;
  }, [purchaseOrders, projects]);

  return (
    <div className="space-y-6 select-text font-sans p-1 sm:p-2">
      {/* ========================================================================= */}
      {/* 0. RBAC-AWARE TOP-LEVEL SUMMARY KPI WIDGET ROW (SSOT REAL-TIME ENTERPRISE) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Active Projects */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('projects')}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-blue-50/40 dark:from-[#0B1528] dark:via-[#0E1E38] dark:to-[#071324] border border-blue-200/80 dark:border-blue-900/50 p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-300/40 dark:border-blue-700/40">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  {menuCustomization?.projectsLabel || 'المشاريع والعمليات'}
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  المشاريع النشطة والتشغيلية
                </h4>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {kpiActiveProjectsList.length} مشروع
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono tabular-nums">
                {kpiActiveProjectsList.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                مشروع نشط
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                {kpiInProgressCount} قيد التنفيذ
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {projects.length - kpiActiveProjectsList.length} مستبعد / منتهي
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              حالة التشغيل الميداني
            </span>
            <span className="font-semibold text-blue-700 dark:text-blue-300 group-hover:underline flex items-center gap-0.5">
              عرض تفاصيل المشاريع <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Card 2: Pending Quotations */}
        <div
          onClick={() => onNavigateTab && onNavigateTab('quotations')}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-amber-50/40 dark:from-[#0B1528] dark:via-[#1E1908] dark:to-[#0C1322] border border-amber-200/80 dark:border-amber-900/50 p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-300/40 dark:border-amber-700/40">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                  {menuCustomization?.quotationsLabel || 'عروض الأسعار والتسعير'}
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  عروض الأسعار المعلقة والمتابعة
                </h4>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {kpiPendingQuotationsList.length} عرض
            </span>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono tabular-nums">
                {kpiPendingQuotationsList.length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                بانتظار موافقة العميل
              </span>
            </div>
            {canSeeFinancials ? (
              <div className="text-right">
                <span className="text-xs font-black text-amber-700 dark:text-amber-300 block font-mono">
                  {Math.round(kpiPendingQuotesTotalValue).toLocaleString()} SAR
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  هامش مقدر: {Math.round(kpiPendingQuotesTotalMargin).toLocaleString()} SAR
                </span>
              </div>
            ) : (
              <div className="text-right">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                  قيد المراجعة الفنية
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  مواصفات MEP معتمدة
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              متابعة عروض المناقصات
            </span>
            <span className="font-semibold text-amber-700 dark:text-amber-300 group-hover:underline flex items-center gap-0.5">
              فتح جدول العروض <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Card 3: RBAC-Aware - Overdue Invoices (Management) OR Pending Deliveries & Site Inspections (Engineers) */}
        {canSeeFinancials ? (
          <div
            onClick={() => onNavigateTab && onNavigateTab('invoices')}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-rose-50/40 dark:from-[#0B1528] dark:via-[#1F0E14] dark:to-[#0A1220] border border-rose-200/80 dark:border-rose-900/50 p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-300/40 dark:border-rose-700/40">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                    {menuCustomization?.financeLabel || 'المالية والفواتير'}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    الفواتير المستحقة والمتأخرة
                  </h4>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${
                kpiOverdueInvoicesList.length > 0
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              }`}>
                {kpiOverdueInvoicesList.length} فواتير
              </span>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono tabular-nums">
                  {kpiOverdueInvoicesList.length}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  مطالبة متأخرة
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-rose-700 dark:text-rose-300 block font-mono">
                  {Math.round(kpiOverdueInvoicesTotalAmount).toLocaleString()} SAR
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  إجمالي المبالغ واجبة التحصيل
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                متابعة التحصيل المالي
              </span>
              <span className="font-semibold text-rose-700 dark:text-rose-300 group-hover:underline flex items-center gap-0.5">
                إدارة الفواتير والتحصيل <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onNavigateTab && onNavigateTab('site_logistics')}
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-teal-50/40 dark:from-[#0B1528] dark:via-[#071C1E] dark:to-[#091424] border border-teal-200/80 dark:border-teal-900/50 p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-300/40 dark:border-teal-700/40">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                    {menuCustomization?.siteExecutionLabel || 'التنفيذ والمتابعة الميدانية'}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    التوريدات والفحوصات الميدانية
                  </h4>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                {kpiSiteDeliveriesAndInspectionsCount} عملية
              </span>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono tabular-nums">
                  {kpiSiteDeliveriesAndInspectionsCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  شحنة / فحص ميداني
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-300 block">
                  جاهزة للاستلام والتحقق
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  سندات تسليم وجرد موقع
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                متابعة حركة المواد بالموقع
              </span>
              <span className="font-semibold text-teal-700 dark:text-teal-300 group-hover:underline flex items-center gap-0.5">
                فتح سجل الموقع اللوجستي <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. CORE FINANCIAL & OPERATIONAL KPI BENTO CARDS (MODERN LUXURY EXECUTIVE) */}
      {/* ========================================================================= */}
      <DashboardMetrics
        currentUser={currentUser}
        wonProjectsCount={statusStats.wonCount}
        totalProjectsCount={projects.length}
        wonProjectsTotalValue={wonProjectsTotalValue}
        pricingQuotationsCount={statusStats.pricingCount}
        pricingQuotationsValue={statusStats.pricingValue}
        wonProjectsTotalProfit={projectFinancialStats.totalProfit}
        wonProjectsAvgMargin={projectFinancialStats.avgMargin}
        totalInvoiced={totalInvoiced}
        totalCollected={totalCollected}
        collectionRate={collectionRate}
        totalReceivables={totalReceivables}
        projects={projects}
        customerQuotations={customerQuotations}
        purchaseOrders={purchaseOrders}
        invoices={invoices}
        onOpenStatusBreakdown={onOpenStatusBreakdown}
        onOpenWonProjectsDetail={() => setChartViewMode('won_projects')}
        onOpenProfitDetail={() => setChartViewMode('won_projects')}
        onOpenCashCollectionDetail={() => onNavigateTab && onNavigateTab('invoices')}
        onNavigateTab={onNavigateTab}
        onFilterWonProjects={() => setChartViewMode('won_projects')}
      />

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE ENGINEERING & FINANCIAL ANALYTICS (RECHARTS)               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0B1528] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
        {/* Analytics Header & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007A5A] to-[#1E3A8A] text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  التحليل المالي والهندسي للمشاريع (Projects Financial Analytics)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  محدث لحظياً
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                رسوم بيانية تفاعلية لمشاريعك النشطة وتكاليفها وأرباحها وهوامش الربح
              </p>
            </div>
          </div>

          {/* Chart View Mode Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start sm:self-auto text-xs font-bold overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setChartViewMode('tender_status')}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer text-xs font-bold ${
                chartViewMode === 'tender_status'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600'
              }`}
            >
              <PieChartIcon className="w-4 h-4 text-amber-200" />
              <span>حالة العطاءات وتوزيع المشاريع</span>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-mono font-bold">
                {projects.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('won_projects')}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer text-xs font-bold ${
                chartViewMode === 'won_projects'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>المشاريع النشطة (فزت بها)</span>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-mono font-bold">
                {wonProjects.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('all_projects')}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer text-xs font-bold ${
                chartViewMode === 'all_projects'
                  ? 'bg-[#007A5A] text-white shadow-md'
                  : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>تحليل أرباح وتكاليف المشاريع</span>
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('systems')}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer text-xs font-bold ${
                chartViewMode === 'systems'
                  ? 'bg-[#007A5A] text-white shadow-md'
                  : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>توزيع الأنظمة (MEP)</span>
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('procurement')}
              className={`px-3.5 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap cursor-pointer text-xs font-bold ${
                chartViewMode === 'procurement'
                  ? 'bg-[#007A5A] text-white shadow-md'
                  : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>المشتريات والتوريدات</span>
            </button>
          </div>
        </div>

        {/* Charts Container - Standardized Compact Sizing & Layout Across All Tabs */}
        <div>
          {chartViewMode === 'tender_status' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <div className="lg:col-span-5 h-[220px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tenderStatusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      onClick={(entry: any) => {
                        handleOpenTenderStatusModal(entry.name, entry.count || 0, entry.value || 0, entry.color);
                      }}
                    >
                      {tenderStatusChartData.map((entry, idx) => (
                        <Cell key={`tender-cell-${idx}`} fill={entry.color} className="cursor-pointer hover:opacity-80 transition" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderRadius: '12px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '13px',
                        padding: '12px 16px',
                        fontWeight: 'bold',
                      }}
                      formatter={(val: any, name: any, item: any) => [
                        `${Number(val).toLocaleString()} SAR (${item.payload.count} مشاريع)`,
                        item.payload.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="lg:col-span-7 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    تفاصيل وقيم حالات العطاءات والمشاريع
                  </h4>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    إجمالي {projects.length} مشروع
                  </span>
                </div>
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {tenderStatusChartData.map((st, idx) => {
                    const totalVal = tenderStatusChartData.reduce((s, i) => s + i.value, 0) || 1;
                    const pct = Math.round((st.value / totalVal) * 100);
                    return (
                      <div
                        key={`tender-stat-${idx}`}
                        onClick={() => {
                          handleOpenTenderStatusModal(st.name, st.count, st.value, st.color);
                        }}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-slate-50/80 shadow-xs transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: st.color }}
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-sm block group-hover:text-emerald-700 transition">
                              {st.name}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {st.count} مشاريع مسجلة
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {st.value.toLocaleString()} <span className="text-xs text-slate-500 font-sans font-normal">SAR</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            ({pct}%)
                          </span>
                          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition group-hover:-translate-x-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {chartViewMode === 'won_projects' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center bg-emerald-50/30 p-4 rounded-xl border border-emerald-200">
              <div className="lg:col-span-5 h-[220px] w-full flex items-center justify-center">
                {wonProjectsFinancialChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={wonProjectsFinancialChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="صافي ربح المشروع (Net Profit)"
                        onClick={(entry: any) => {
                          const wp = wonProjectsFinancialSummary.find((p) => p.id === entry.id) || entry;
                          handleOpenWonProjectModal(wp);
                        }}
                      >
                        {wonProjectsFinancialChartData.map((entry, idx) => (
                          <Cell
                            key={`won-cell-${idx}`}
                            fill={['#007A5A', '#10B981', '#1E3A8A', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'][idx % 7]}
                            className="cursor-pointer hover:opacity-80 transition"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#0F172A] text-slate-100 p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[220px]">
                                <div className="font-bold text-emerald-400 text-sm border-b border-slate-700 pb-1">
                                  {data.fullName}
                                </div>
                                <div className="flex justify-between items-center text-slate-300 font-mono">
                                  <span>قيمة العقد [Incl. 15% VAT]:</span>
                                  <span className="text-emerald-400 font-bold">{Number(data['قيمة العقد والبيع (Contract Value)']).toLocaleString()} SAR [Incl. 15% VAT]</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-300 font-mono">
                                  <span>صافي الربح [Excl. VAT]:</span>
                                  <span className="text-emerald-300 font-bold">{Number(data['صافي ربح المشروع (Net Profit)']).toLocaleString()} SAR [Excl. VAT]</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-xs text-slate-400">لا توجد مشاريع فائزة بعد</div>
                )}
              </div>

              <div className="lg:col-span-7 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-emerald-200/60">
                  <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                    تفاصيل أرباح وهوامش المشاريع الفائزة [Excl. VAT]
                  </h4>
                  <span className="text-xs font-mono font-semibold text-emerald-800">
                    {wonProjectsFinancialSummary.length} مشاريع فائزة
                  </span>
                </div>
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {wonProjectsFinancialSummary.map((wp, idx) => {
                    const color = ['#007A5A', '#10B981', '#1E3A8A', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'][idx % 7];
                    return (
                      <div
                        key={wp.id}
                        onClick={() => {
                          handleOpenWonProjectModal(wp);
                        }}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50/50 shadow-xs transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-sm block group-hover:text-emerald-700 transition">
                              {wp.fullName}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {wp.projectNumber} • العميل: {wp.customerName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-emerald-700 text-sm">
                            {wp.revenue.toLocaleString()} <span className="text-xs text-slate-500 font-sans font-normal">SAR [Incl. 15% VAT]</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            ({wp.marginPct}%)
                          </span>
                          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition group-hover:-translate-x-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {chartViewMode === 'all_projects' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <div className="lg:col-span-5 h-[220px] w-full flex items-center justify-center">
                {allProjectsFinancialChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allProjectsFinancialChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="صافي الربح (Profit)"
                        onClick={(entry: any) => {
                          handleOpenAllProjectModal(entry);
                        }}
                      >
                        {allProjectsFinancialChartData.map((entry, idx) => (
                          <Cell
                            key={`all-cell-${idx}`}
                            fill={['#007A5A', '#10B981', '#1E3A8A', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'][idx % 7]}
                            className="cursor-pointer hover:opacity-80 transition"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#0F172A] text-slate-100 p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[220px]">
                                <div className="font-bold text-emerald-400 text-sm border-b border-slate-700 pb-1">
                                  {data.fullName}
                                </div>
                                <div className="flex justify-between items-center text-slate-300 font-mono">
                                  <span>الإيراد [Incl. 15% VAT]:</span>
                                  <span className="text-emerald-400 font-bold">{Number(data['قيمة المشروع (Revenue)']).toLocaleString()} SAR [Incl. 15% VAT]</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-300 font-mono">
                                  <span>صافي الربح [Excl. VAT]:</span>
                                  <span className="text-emerald-300 font-bold">{Number(data['صافي الربح (Profit)']).toLocaleString()} SAR [Excl. VAT]</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-xs text-slate-400">لا توجد مشاريع مسجلة بعد</div>
                )}
              </div>

              <div className="lg:col-span-7 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    تفاصيل الإيرادات والتكاليف لكافة المشاريع
                  </h4>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {allProjectsFinancialChartData.length} مشاريع مسجلة
                  </span>
                </div>
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {allProjectsFinancialChartData.map((p, idx) => {
                    const color = ['#007A5A', '#10B981', '#1E3A8A', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'][idx % 7];
                    return (
                      <div
                        key={`all-proj-${p.id || idx}`}
                        onClick={() => {
                          handleOpenAllProjectModal(p);
                        }}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-slate-50/80 shadow-xs transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-sm block group-hover:text-emerald-700 transition">
                              {p.fullName}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {p.projectNumber} • العميل: {p.client}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {Number(p['قيمة المشروع (Revenue)']).toLocaleString()} <span className="text-xs text-slate-500 font-sans font-normal">SAR [Incl. 15% VAT]</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            ({p.marginPct}%)
                          </span>
                          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition group-hover:-translate-x-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {chartViewMode === 'systems' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <div className="lg:col-span-5 h-[220px] w-full flex items-center justify-center">
                {systemsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={systemsChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(entry: any) => {
                          handleOpenSystemModal(entry.name, entry.count || 0, entry.value || 0, entry.color);
                        }}
                      >
                        {systemsChartData.map((entry) => (
                          <Cell key={`cell-${entry.id}`} fill={entry.color} className="cursor-pointer hover:opacity-80 transition" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [`${Number(val).toLocaleString()} SAR`, 'القيمة']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-xs text-slate-400">لا توجد بيانات أنظمة بعد</div>
                )}
              </div>

              <div className="lg:col-span-7 space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    توزيع حجم الأعمال حسب التخصص الكهروميكانيكي
                  </h4>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    {systemsChartData.length} تخصصات مسجلة
                  </span>
                </div>
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {systemsChartData.map((sys) => {
                    const totalVal = systemsChartData.reduce((s, i) => s + i.value, 0) || 1;
                    const pct = Math.round((sys.value / totalVal) * 100);
                    return (
                      <div
                        key={sys.id}
                        onClick={() => {
                          handleOpenSystemModal(sys.name, sys.count, sys.value, sys.color);
                        }}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-slate-50/80 shadow-xs transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: sys.color }}
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-sm block group-hover:text-emerald-700 transition">
                              {sys.name}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              ({sys.count} عروض أسعار)
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {sys.value.toLocaleString()} <span className="text-xs text-slate-500 font-sans font-normal">SAR [Excl. VAT]</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            ({pct}%)
                          </span>
                          <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition group-hover:-translate-x-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {chartViewMode === 'procurement' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Chart 1: Issued vs Received POs */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    أوامر الشراء الصادرة والمستلمة من الموردين
                  </h4>
                  <span className="font-mono text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-md text-[11px] font-bold">
                    عدد الأوامر
                  </span>
                </div>
                <div className="h-[180px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={procurementOrdersChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(entry: any) => {
                          handleOpenProcurementModal(entry.name, entry.value);
                        }}
                      >
                        {procurementOrdersChartData.map((entry, idx) => (
                          <Cell key={`po-ord-${idx}`} fill={entry.color} className="cursor-pointer hover:opacity-80 transition" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '13px',
                          padding: '10px 14px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {procurementOrdersChartData.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        handleOpenProcurementModal(item.name, item.value);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 shadow-xs cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-slate-800 text-xs group-hover:text-emerald-700 transition">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold font-mono text-slate-900 text-sm">{item.value}</span>
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 2: PO Amounts vs Payments vs Remaining */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    مبالغ أوامر الشراء والمدفوعات والمتبقي
                  </h4>
                  <span className="font-mono text-slate-700 bg-slate-200/60 px-2 py-0.5 rounded-md text-[11px] font-bold">
                    ريال سعودي (SAR)
                  </span>
                </div>
                <div className="h-[180px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={procurementAmountsChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(entry: any) => {
                          handleOpenProcurementModal(entry.name, entry.value);
                        }}
                      >
                        {procurementAmountsChartData.map((entry, idx) => (
                          <Cell key={`po-amt-${idx}`} fill={entry.color} className="cursor-pointer hover:opacity-80 transition" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          borderRadius: '12px',
                          border: 'none',
                          color: '#fff',
                          fontSize: '13px',
                          padding: '10px 14px',
                        }}
                        formatter={(val: any) => [`${Number(val).toLocaleString()} SAR [Incl. 15% VAT]`, 'القيمة [Incl. 15% VAT]']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {procurementAmountsChartData.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        handleOpenProcurementModal(item.name, item.value);
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 shadow-xs cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="font-bold text-slate-800 text-xs group-hover:text-emerald-700 transition">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold font-mono text-slate-900 text-xs sm:text-sm">
                          {item.value.toLocaleString()} <span className="text-[10px] text-slate-500 font-sans font-normal">SAR [Incl. 15% VAT]</span>
                        </span>
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PROJECTS STATUS & WIN / LOSS PROGRESSION SECTION                       */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0B1528] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                توزيع وحالات ترسية المشاريع (Projects Win / Loss Breakdown)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {statusStats.totalProjects} مشاريع
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              متابعة دقيقة لمسار ترسية المشاريع بحسب (فزت فيه • قيد التسعير • خسرته) وتوثيق أسباب الخسارة
            </p>
          </div>

          {onOpenStatusBreakdown && (
            <button
              type="button"
              onClick={() => onOpenStatusBreakdown('all')}
              className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition active:scale-95 cursor-pointer self-start sm:self-auto border border-transparent dark:border-slate-700"
            >
              <span>عرض تفاصيل الترسية في صفحة مستقلة</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          )}
        </div>

        {/* Multi-segment Graphical Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>فزت فيه ({statusStats.wonCount}) — {statusStats.wonPct}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>قيد التسعير ({statusStats.pricingCount}) — {statusStats.pricingPct}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>خسرته ({statusStats.lostCount}) — {statusStats.lostPct}%</span>
            </span>
          </div>

          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200 shadow-inner">
            {statusStats.wonPct > 0 && (
              <div
                onClick={() => onOpenStatusBreakdown?.('Won')}
                title={`فزت فيه: ${statusStats.wonCount} مشاريع (${statusStats.wonPct}%)`}
                style={{ width: `${statusStats.wonPct}%` }}
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-l-full flex items-center justify-center text-[9px] font-bold text-white transition-all hover:brightness-110 cursor-pointer"
              >
                {statusStats.wonPct >= 10 && `${statusStats.wonPct}%`}
              </div>
            )}
            {statusStats.pricingPct > 0 && (
              <div
                onClick={() => onOpenStatusBreakdown?.('Under Pricing')}
                title={`قيد التسعير: ${statusStats.pricingCount} مشاريع (${statusStats.pricingPct}%)`}
                style={{ width: `${statusStats.pricingPct}%` }}
                className={`h-full bg-gradient-to-r from-amber-500 to-amber-400 flex items-center justify-center text-[9px] font-bold text-white transition-all hover:brightness-110 cursor-pointer ${
                  statusStats.wonPct === 0 ? 'rounded-l-full' : ''
                } ${statusStats.lostPct === 0 ? 'rounded-r-full' : ''}`}
              >
                {statusStats.pricingPct >= 10 && `${statusStats.pricingPct}%`}
              </div>
            )}
            {statusStats.lostPct > 0 && (
              <div
                onClick={() => onOpenStatusBreakdown?.('Lost')}
                title={`خسرته: ${statusStats.lostCount} مشاريع (${statusStats.lostPct}%)`}
                style={{ width: `${statusStats.lostPct}%` }}
                className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-r-full flex items-center justify-center text-[9px] font-bold text-white transition-all hover:brightness-110 cursor-pointer"
              >
                {statusStats.lostPct >= 10 && `${statusStats.lostPct}%`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SEARCH & SYSTEM FILTER BAR                                            */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Systems Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> النظام:
          </span>
          <button
            type="button"
            onClick={() => setSystemFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
              systemFilter === 'all'
                ? 'bg-[#007A5A] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل (All)
          </button>
          {SYSTEM_DEFINITIONS.map((sys) => (
            <button
              key={sys.id}
              type="button"
              onClick={() => setSystemFilter(sys.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                systemFilter === sys.id
                  ? 'bg-[#007A5A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sys.nameAr}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث في المشاريع، العملاء، الأرقام..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#007A5A]"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MAIN WORKSPACE: CUSTOMER QUOTATIONS & ACTIVE PROJECTS                  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Quotations (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#007A5A]" />
              <span>عروض أسعار العملاء وجداول الكميات (Customer Quotations)</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold">
                {filteredQuotations.length}
              </span>
            </h2>
            <span className="text-xs text-slate-500">
              اضغط على أي عرض لفتحه أو تعديله أو طباعته
            </span>
          </div>

          <div className="space-y-3">
            {filteredQuotations.map((q) => (
              <div
                key={q.id}
                onClick={() => onSelectQuotation(q.id)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-[#007A5A] hover:shadow-md cursor-pointer transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#007A5A] group-hover:underline">
                      {q.quotationNumber}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold">
                      V{q.version}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {q.date}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#007A5A] transition">
                    {q.projectName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    العميل: <span className="font-semibold text-slate-700">{q.clientName}</span> | الموقع: {q.projectLocation || 'المملكة العربية السعودية'}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {(q.selectedSystems || []).map((sys) => {
                      const def = getSystemMeta(sys);
                      return (
                        <span
                          key={sys}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-[#007A5A]"
                        >
                          {def?.nameAr ?? sys}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto gap-2 shrink-0">
                  <div className="text-left sm:text-right space-y-1">
                    <div className="text-xs text-slate-400">سعر البيع للعميل [Excl. VAT]</div>
                    <div className="text-base font-extrabold font-mono text-[#007A5A]">
                      {(q?.totals?.customerSellingPrice ?? 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xs font-sans">SAR [Excl. VAT]</span>
                    </div>
                    <div className="text-xs font-semibold text-teal-700 flex sm:justify-end items-center gap-1">
                      <span>هامش الربح: {canSeeFinancials ? `${(q?.totals?.grossMarginPercent ?? 0).toFixed(1)}%` : '**.*%'}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#007A5A] transition" />
                    </div>
                  </div>

                  {onDeleteCustomerQuotation && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCustomerQuoteTarget(q);
                      }}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="حذف عرض السعر وأرشفة أصنافه المسعرة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Projects List & Preserved Supplier Quotes */}
        <div className="space-y-6">
          {/* Projects Card List */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#1E3A8A]" />
                <span>المشاريع الحالية (Projects)</span>
              </h2>
              <button
                type="button"
                onClick={onCreateNewProject}
                className="text-xs text-[#007A5A] font-bold hover:underline cursor-pointer"
              >
                + جديد
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
              {filteredProjects.map((p) => {
                const outcome = getNormalizedProjectStatus(p.status);
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className="py-3 hover:bg-slate-50 cursor-pointer rounded px-2 -mx-2 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 hover:text-[#007A5A]">
                          {p.name}
                        </h4>
                        <p className="text-[11px] text-slate-500">{p.customerName}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          outcome === 'Won'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : outcome === 'Lost'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {outcome === 'Won' ? 'فزت فيه' : outcome === 'Lost' ? 'خسرته' : 'قيد التسعير'}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-600">
                      <span>الميزانية: {p.budget?.toLocaleString()} SAR [Excl. VAT]</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#007A5A] font-semibold flex items-center gap-0.5">
                          تفاصيل <ChevronRight className="w-3 h-3" />
                        </span>
                        {onDeleteProject && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteProjectTarget(p);
                            }}
                            className="text-slate-300 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="حذف المشروع وجدول الكميات"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preserved Supplier Quotes Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>تسعيرات الموردين المحفوظة الأصلية</span>
              </h3>
              <span className="text-[10px] bg-emerald-100 text-[#007A5A] px-2 py-0.5 rounded font-mono font-bold">
                {supplierQuotations.length} تسعيرة
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              تسعيرات الموردين المعتمدة مع إمكانية حذف أي تسعيرة مع أرشفة أصنافها تلقائياً لبنك الأصناف المسعرة.
            </p>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {(supplierQuotations || []).map((sq) => (
                <div
                  key={sq.id}
                  className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs space-y-1 group"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">{sq.supplierName}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[#007A5A] font-bold">
                        {sq.totalAmount.toLocaleString()} SAR [Excl. VAT]
                      </span>
                      {onDeleteSupplierQuotation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteSupplierQuoteTarget(sq);
                          }}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="حذف تسعيرة المورد وأرشفة أصنافها المسعرة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>{sq.quotationNumber}</span>
                    <span>{sq.items?.length || 0} صنف مستخرج</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Context-Aware Financial Chart Detail Modal */}
      <FinancialChartDetailModal data={popupDetail} onClose={() => setPopupDetail(null)} />

      {/* Delete Customer Quotation Confirmation Modal */}
      {deleteCustomerQuoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تأكيد حذف عرض السعر وجدول الكميات
                </h3>
                <p className="text-xs text-slate-500">
                  حذف العرض مع أرشفة أصنافه المسعرة لبنك الأصناف
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
              <p className="font-bold text-slate-900">
                هل أنت متأكد من رغبتك في حذف عرض السعر التالي؟
              </p>
              <p className="text-sm font-bold text-rose-800 font-mono">
                {deleteCustomerQuoteTarget.quotationNumber} — {deleteCustomerQuoteTarget.projectName}
              </p>
              <p className="text-slate-600">
                العميل: <span className="font-semibold text-slate-800">{deleteCustomerQuoteTarget.customerName || deleteCustomerQuoteTarget.clientName}</span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-rose-200/60">
                سيتم إخفاؤه من قائمة العروض، والاحتفاظ ببيانات كافة الأصناف المسعرة بداخله تلقائياً في صفحة "الأصناف المسعرة" داخل أوامر الشراء للاستفادة منها مستقبلاً.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCustomerQuoteTarget(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCustomerQuotation) {
                    onDeleteCustomerQuotation(deleteCustomerQuoteTarget.id);
                  }
                  setDeleteCustomerQuoteTarget(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>نعم، حذف العرض</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Supplier Quotation Confirmation Modal */}
      {deleteSupplierQuoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تأكيد حذف تسعيرة المورد
                </h3>
                <p className="text-xs text-slate-500">
                  إزالة التسعيرة مع أرشفة أصنافها تلقائياً
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
              <p className="font-bold text-slate-900">
                هل أنت متأكد من رغبتك في حذف تسعيرة المورد التالية؟
              </p>
              <p className="text-sm font-bold text-rose-800">
                {deleteSupplierQuoteTarget.supplierName} — {deleteSupplierQuoteTarget.quotationNumber}
              </p>
              <p className="text-slate-600 font-mono">
                المبلغ: {deleteSupplierQuoteTarget.totalAmount.toLocaleString()} SAR
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-rose-200/60">
                سيتم حذف التسعيرة من القائمة وحفظ وأرشفة كافة الأصناف المسعرة داخل صفحة "الأصناف المسعرة" بأوامر الشراء لاسترجاعها والمقارنة بها لاحقاً.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteSupplierQuoteTarget(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSupplierQuotation) {
                    onDeleteSupplierQuotation(deleteSupplierQuoteTarget.id);
                  }
                  setDeleteSupplierQuoteTarget(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>نعم، حذف التسعيرة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteProjectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 pb-2 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تأكيد حذف المشروع وجدول الكميات
                </h3>
                <p className="text-xs text-slate-500">
                  حذف المشروع وجميع عروضه المسعرة
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
              <p className="font-bold text-slate-900">
                هل أنت متأكد من رغبتك في حذف المشروع التالي؟
              </p>
              <p className="text-sm font-bold text-rose-800">
                {deleteProjectTarget.name}
              </p>
              <p className="text-slate-600">
                العميل: <span className="font-semibold text-slate-800">{deleteProjectTarget.customerName}</span> | الكود:{' '}
                <span className="font-mono">{deleteProjectTarget.projectNumber}</span>
              </p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-rose-200/60">
                سيتم حذف المشروع وعروض الأسعار المرتبطة به، مع أرشفة أصنافه المسعرة تلقائياً داخل صفحة "الأصناف المسعرة".
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteProjectTarget(null)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteProject) {
                    onDeleteProject(deleteProjectTarget.id);
                  }
                  setDeleteProjectTarget(null);
                }}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>نعم، حذف المشروع</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
