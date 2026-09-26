import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Calculator,
  CheckCircle,
  Plus,
  Trash2,
  AlertCircle,
  Percent,
  DollarSign,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Building,
  Layers,
  Sparkles,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Sliders,
  Filter,
} from 'lucide-react';
import {
  Project,
  CustomerQuotation,
  SupplierQuotation,
  QuotationItem,
  SystemDiscipline,
  TermsLibraryItem,
  SYSTEM_DEFINITIONS,
  getSystemMeta,
  QuotationAdditionalCosts,
} from '../types';
import {
  calculateQuotationTotals,
  detectItemSystemDiscipline,
  getNextQuotationNumber,
  snapToQuarter,
} from '../utils/quotationUtils';
import { COMPANY_PROFILE } from '../data/initialData';

interface PrepareCustomerQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  supplierQuotations: SupplierQuotation[];
  existingQuotations?: CustomerQuotation[];
  initialSupplierQuoteId?: string;
  initialSupplierQuoteIds?: string[];
  termsLibrary: TermsLibraryItem[];
  onQuotationIssued: (quotation: CustomerQuotation) => void;
  onOpenQuotationEditor?: (quotationId: string) => void;
}

export const PrepareCustomerQuotationModal: React.FC<
  PrepareCustomerQuotationModalProps
> = ({
  isOpen,
  onClose,
  project,
  supplierQuotations,
  existingQuotations = [],
  initialSupplierQuoteId,
  initialSupplierQuoteIds,
  termsLibrary,
  onQuotationIssued,
  onOpenQuotationEditor,
}) => {
  // Filter supplier quotes that belong to this project or available
  const projectSupplierQuotes = supplierQuotations.filter(
    (sq) =>
      sq.projectId === project.id ||
      project.supplierQuotationIds?.includes(sq.id)
  );
  const availableSupplierQuotes =
    projectSupplierQuotes.length > 0 ? projectSupplierQuotes : supplierQuotations;

  // Multi-selection of supplier quotes (Supports merging multiple quotes)
  const [selectedSupplierQuoteIds, setSelectedSupplierQuoteIds] = useState<string[]>(() => {
    if (initialSupplierQuoteIds && initialSupplierQuoteIds.length > 0) {
      return initialSupplierQuoteIds;
    }
    if (initialSupplierQuoteId) {
      return [initialSupplierQuoteId];
    }
    // If project has supplier quotes, select all of them by default so user can merge immediately
    if (availableSupplierQuotes.length > 0) {
      return availableSupplierQuotes.map((sq) => sq.id);
    }
    return [];
  });

  // Per-quote margin configuration: Record<sqId, marginPercent>
  const [quoteMargins, setQuoteMargins] = useState<Record<string, number>>({});

  // Per-quote pricing modes and values: Record<sqId, 'margin' | 'markup' | 'target_selling' | 'profit_amount'> and Record<sqId, number>
  const [quotePricingModes, setQuotePricingModes] = useState<Record<string, 'margin' | 'markup' | 'target_selling' | 'profit_amount'>>({});
  const [quotePricingValues, setQuotePricingValues] = useState<Record<string, number>>({});

  // Table filter to focus on specific supplier quote's items or all
  const [tableFilterQuoteId, setTableFilterQuoteId] = useState<string>('all');

  // System discipline
  const declaredSystemsList: SystemDiscipline[] =
    project.selectedSystems && project.selectedSystems.length > 0
      ? project.selectedSystems
      : project.systems && project.systems.length > 0
      ? project.systems
      : [];

  const defaultSystem: SystemDiscipline = declaredSystemsList[0] || 'hvac';

  const [selectedSystems, setSelectedSystems] = useState<SystemDiscipline[]>(() => {
    if (declaredSystemsList.length > 0) {
      return declaredSystemsList;
    }
    return [defaultSystem];
  });

  const selectedSystem = selectedSystems[0] || defaultSystem;

  // Active items in Bill of Quantities
  const [items, setItems] = useState<QuotationItem[]>([]);

  // Additional direct costs
  const [additionalCosts, setAdditionalCosts] = useState<QuotationAdditionalCosts>({
    procurement: 0,
    installation: 0,
    transportation: 0,
    testingAndCommissioning: 0,
    testingCommissioning: 0,
    engineering: 0,
    manpower: 0,
    contingency: 0,
    otherDirectCosts: 0,
    customs: 0,
    other: 0,
  });

  const [showAdditionalCosts, setShowAdditionalCosts] = useState(false);

  // Pricing controls: Modes: 'per_quote' | 'margin' | 'added_amount' | 'markup' | 'target_selling'
  const [activePricingTab, setActivePricingTab] = useState<
    'per_quote' | 'added_amount' | 'margin' | 'markup' | 'target_selling'
  >(availableSupplierQuotes.length > 1 ? 'per_quote' : 'margin');

  const [targetMarginPercent, setTargetMarginPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rmt_default_margin');
      return saved ? Number(saved) : 20;
    } catch {
      return 20;
    }
  });
  const [markupPercent, setMarkupPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rmt_default_markup');
      return saved ? Number(saved) : 25;
    } catch {
      return 25;
    }
  });
  const [fixedAddedProfit, setFixedAddedProfit] = useState<number>(25000);
  const [targetSellingPriceInput, setTargetSellingPriceInput] =
    useState<number>(0);

  // Terms & Conditions
  const [includes, setIncludes] = useState<string[]>([]);
  const [excludes, setExcludes] = useState<string[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<string[]>([
    '30% دفعة مقدمة عند توقيع العقد وتأكيد أمر الشراء',
    '50% عند توريد المواد والمهمات لموقع المشروع',
    '20% بعد إنهاء التركيبات، الاختبار والتشغيل، والتسليم الابتدائي',
  ]);
  const [validity, setValidity] = useState<string>('15 يوماً من تاريخ إصدار العرض');
  const [warranty, setWarranty] = useState<string>(
    '12 شهراً ضد عيوب الصناعة من تاريخ الاختبار والتشغيل والتسليم'
  );
  const [delivery, setDelivery] = useState<string>(
    'خلال 4-6 أسابيع من تاريخ اعتماد المخططات واستلام الدفعة المقدمة'
  );
  const [notes, setNotes] = useState<string[]>([
    'الأسعار المذكورة بالريال السعودي وتخضع لضريبة القيمة المضافة 15%',
    'الكميات المذكورة تم حصرها استناداً لجدول كميات ومخططات المشروع',
  ]);

  // Issuer contact details configuration
  const [issuerName, setIssuerName] = useState<string>(COMPANY_PROFILE.engineerName || 'Eng. Mokhtar Yousef');
  const [issuerTitle, setIssuerTitle] = useState<string>(COMPANY_PROFILE.engineerTitle || 'Projects & Technical Office Manager');
  const [issuerEmail, setIssuerEmail] = useState<string>(COMPANY_PROFILE.engineerEmail || 'info@rmt-sa.com');
  const [issuerPhone, setIssuerPhone] = useState<string>(COMPANY_PROFILE.phone || '+966 13 898 1234');
  const [issuerMobile, setIssuerMobile] = useState<string>(COMPANY_PROFILE.mobiles?.[0] || '+966 50 123 4567');
  const [showIssuerConfig, setShowIssuerConfig] = useState<boolean>(false);

  // Status for issuance
  const [issueStatus, setIssueStatus] = useState<'issued' | 'draft'>('issued');
  const [scopeOfWork, setScopeOfWork] = useState<string>(
    `توريد وتركيب واختبار وتشغيل نظام ${
      getSystemMeta(selectedSystem)?.nameAr ?? 'المشروع'
    } - ${project?.name ?? ''}`
  );

  // Helper: compute effective markup ratio for an item based on its source supplier quote or global settings
  const getItemEffectiveMargin = (item: QuotationItem): number => {
    if (item.sourceSupplierQuoteId && quoteMargins[item.sourceSupplierQuoteId] !== undefined) {
      return quoteMargins[item.sourceSupplierQuoteId];
    }
    return targetMarginPercent;
  };

  // Re-sync items when selectedSupplierQuoteIds changes
  useEffect(() => {
    const mergedItems: QuotationItem[] = [];
    let globalIndex = 0;

    selectedSupplierQuoteIds.forEach((sqId) => {
      const sq = supplierQuotations.find((s) => s.id === sqId);
      if (sq && Array.isArray(sq.items)) {
        const mode = quotePricingModes[sqId] || 'margin';
        const val = quotePricingValues[sqId] !== undefined ? quotePricingValues[sqId] : (quoteMargins[sqId] !== undefined ? quoteMargins[sqId] : 25);

        const sqCost = sq.items.reduce((s, it) => s + (Number(it.supplierTotalPrice) || (Number(it.quantity || 1) * Number(it.supplierUnitPrice || 0))), 0);

        let quoteSellingTotal = 0;
        if (mode === 'margin') {
          const m = Math.min(95, Math.max(1, val));
          const ratio = m / 100;
          quoteSellingTotal = snapToQuarter(ratio < 0.99 ? sqCost / (1 - ratio) : sqCost * 2);
        } else if (mode === 'markup') {
          const mk = Math.max(0, val);
          quoteSellingTotal = snapToQuarter(sqCost * (1 + mk / 100));
        } else if (mode === 'target_selling') {
          quoteSellingTotal = snapToQuarter(Math.max(sqCost, val));
        } else if (mode === 'profit_amount') {
          const profit = Math.max(0, val);
          quoteSellingTotal = snapToQuarter(sqCost + profit);
        }

        sq.items.forEach((it) => {
          globalIndex++;
          const qty = Number(it.quantity) || 1;
          const uPrice = Number(it.supplierUnitPrice) || 0;
          const tPrice = Number(it.supplierTotalPrice) || snapToQuarter(qty * uPrice);

          const itemSellTotal = sqCost > 0 ? snapToQuarter(tPrice * (quoteSellingTotal / sqCost)) : tPrice;
          const sellUnit = snapToQuarter(itemSellTotal / qty);

          mergedItems.push({
            ...it,
            id: `merged-item-${sq.id}-${it.id || globalIndex}`,
            itemNo: globalIndex,
            sourceSupplierQuoteId: sq.id,
            sourceSupplierName: sq.supplierName,
            quantity: qty,
            supplierUnitPrice: uPrice,
            supplierTotalPrice: tPrice,
            sellingUnitPrice: sellUnit,
            sellingTotalPrice: itemSellTotal,
            system: it.system || selectedSystem,
          });
        });
      }
    });

    setItems(mergedItems);
  }, [selectedSupplierQuoteIds]);

  // Handle toggling quote selection checkbox
  const handleToggleQuoteSelection = (quoteId: string) => {
    setSelectedSupplierQuoteIds((prev) => {
      if (prev.includes(quoteId)) {
        return prev.filter((id) => id !== quoteId);
      } else {
        return [...prev, quoteId];
      }
    });
  };

  // Select all or deselect all quotes
  const handleSelectAllQuotes = () => {
    setSelectedSupplierQuoteIds(availableSupplierQuotes.map((sq) => sq.id));
  };
  const handleDeselectAllQuotes = () => {
    setSelectedSupplierQuoteIds([]);
  };

  // Update margin for a specific supplier quote and recalculate its items (backward compatibility)
  const handleUpdateQuoteMargin = (sqId: string, newMarginPercent: number) => {
    handleUpdateQuotePricing(sqId, 'margin', newMarginPercent);
  };

  // Update independent pricing mode and value for a specific supplier quote
  const handleUpdateQuotePricing = (
    sqId: string,
    mode: 'margin' | 'markup' | 'target_selling' | 'profit_amount',
    val: number
  ) => {
    setQuotePricingModes((prev) => ({ ...prev, [sqId]: mode }));
    setQuotePricingValues((prev) => ({ ...prev, [sqId]: val }));
    if (mode === 'margin') {
      setQuoteMargins((prev) => ({ ...prev, [sqId]: val }));
    }

    const sq = supplierQuotations.find((s) => s.id === sqId);
    if (!sq) return;

    const quoteItems = items.filter((it) => it.sourceSupplierQuoteId === sqId);
    const quoteCost = quoteItems.reduce((s, it) => s + (Number(it.supplierTotalPrice) || 0), 0);

    let quoteSellingTotal = 0;
    if (mode === 'margin') {
      const m = Math.min(95, Math.max(1, val));
      const ratio = m / 100;
      quoteSellingTotal = snapToQuarter(ratio < 0.99 ? quoteCost / (1 - ratio) : quoteCost * 2);
    } else if (mode === 'markup') {
      const mk = Math.max(0, val);
      quoteSellingTotal = snapToQuarter(quoteCost * (1 + mk / 100));
    } else if (mode === 'target_selling') {
      quoteSellingTotal = snapToQuarter(Math.max(quoteCost, val));
    } else if (mode === 'profit_amount') {
      const profit = Math.max(0, val);
      quoteSellingTotal = snapToQuarter(quoteCost + profit);
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.sourceSupplierQuoteId === sqId) {
          const itemCost = Number(item.supplierTotalPrice) || 0;
          const itemSellTotal = quoteCost > 0 ? snapToQuarter(itemCost * (quoteSellingTotal / quoteCost)) : itemCost;
          const qty = Number(item.quantity) || 1;
          const itemSellUnit = snapToQuarter(itemSellTotal / qty);
          return {
            ...item,
            sellingUnitPrice: itemSellUnit,
            sellingTotalPrice: itemSellTotal,
          };
        }
        return item;
      })
    );
  };

  // Load default terms from library based on all selected systems initially
  useEffect(() => {
    let combinedIncludes: string[] = [];
    let combinedExcludes: string[] = [];
    let combinedNotes: string[] = [];

    selectedSystems.forEach((sys) => {
      const lib = termsLibrary.find((t) => t.system === sys);
      if (lib) {
        lib.includes?.forEach((inc) => {
          if (!combinedIncludes.includes(inc)) combinedIncludes.push(inc);
        });
        lib.excludes?.forEach((exc) => {
          if (!combinedExcludes.includes(exc)) combinedExcludes.push(exc);
        });
        lib.notes?.forEach((n) => {
          if (!combinedNotes.includes(n)) combinedNotes.push(n);
        });
      }
    });

    if (combinedIncludes.length > 0) {
      setIncludes(combinedIncludes);
    } else {
      setIncludes([
        `توريد كافة المواد والمعدات المحددة في جدول الكميات أعلاه بأسعارها المعتمدة`,
        `التركيب والتثبيت والتوصيل طبقاً لأصول الصنعة وتعليمات الشركة المصنعة والكود السعودي`,
        `إجراء الاختبارات والتشغيل الميداني (Testing & Commissioning) وإصدار شهادات المعايرة`,
        `تسليم الأعمال والمشروع استشارياً وفق المواصفات والمخططات المعتمدة`,
      ]);
    }

    if (combinedExcludes.length > 0) {
      setExcludes(combinedExcludes);
    } else {
      setExcludes([
        `الأعمال المدنية وفتح الفتحات وإغلاقها وقواعد الخرسانة للمضخات والمعدات`,
        `تمديد الكابلات الكهربائية الرئيسية من لوحة التوزيع الرئيسية (MDB) إلى لوحات التحكم`,
        `رسوم ومصاريف استخراج رخص وتصاريح الدفاع المدني والجهات الحكومية`,
      ]);
    }
  }, [selectedSystems, termsLibrary]);

  // Handle system discipline selection change
  const handleToggleSystem = (sysId: SystemDiscipline) => {
    const exists = selectedSystems.includes(sysId);
    let updatedSystems: SystemDiscipline[] = [];
    const matchingTerms = termsLibrary.find((t) => t.system === sysId);

    let newIncludes = [...includes];
    let newExcludes = [...excludes];
    let newNotes = [...notes];

    if (exists) {
      updatedSystems = selectedSystems.filter((s) => s !== sysId);
      if (matchingTerms) {
        newIncludes = newIncludes.filter((inc) => !matchingTerms.includes.includes(inc));
        newExcludes = newExcludes.filter((exc) => !matchingTerms.excludes.includes(exc));
        newNotes = newNotes.filter((n) => !matchingTerms.notes.includes(n));
      }
    } else {
      updatedSystems = [...selectedSystems, sysId];
      if (matchingTerms) {
        matchingTerms.includes.forEach((inc) => {
          if (!newIncludes.includes(inc)) newIncludes.push(inc);
        });
        matchingTerms.excludes.forEach((exc) => {
          if (!newExcludes.includes(exc)) newExcludes.push(exc);
        });
        matchingTerms.notes.forEach((n) => {
          if (!newNotes.includes(n)) newNotes.push(n);
        });
      }
    }

    setSelectedSystems(updatedSystems);
    setIncludes(newIncludes);
    setExcludes(newExcludes);
    setNotes(newNotes);
  };

  // Financial calculations
  const totalSupplierCost = (items || []).reduce(
    (sum, it) =>
      sum +
      (Number(it.supplierTotalPrice) ||
        (Number(it.quantity) || 0) * (Number(it.supplierUnitPrice) || 0) ||
        0),
    0
  );

  const totalAdditionalCosts = (
    Object.values(additionalCosts || {}) as number[]
  ).reduce((sum, val) => sum + (Number(val) || 0), 0);

  const totalProjectCost = snapToQuarter(totalSupplierCost + totalAdditionalCosts);

  // Derive customer selling price and profit according to active pricing tab
  let customerSellingPrice = 0;
  let grossProfit = 0;
  let calculatedMarginPercent = 0;
  let calculatedMarkupPercent = 0;

  if (activePricingTab === 'per_quote') {
    // Selling price is derived directly from the sum of items' selling prices + additional direct costs
    const totalItemsSelling = items.reduce(
      (sum, it) => sum + (Number(it.sellingTotalPrice) || 0),
      0
    );
    customerSellingPrice = snapToQuarter(totalItemsSelling + totalAdditionalCosts);
    grossProfit = snapToQuarter(customerSellingPrice - totalProjectCost);
    calculatedMarginPercent =
      customerSellingPrice > 0 ? (grossProfit / customerSellingPrice) * 100 : 0;
    calculatedMarkupPercent =
      totalProjectCost > 0 ? (grossProfit / totalProjectCost) * 100 : 0;
  } else if (activePricingTab === 'added_amount') {
    grossProfit = Math.max(0, Number(fixedAddedProfit) || 0);
    customerSellingPrice = snapToQuarter(totalProjectCost + grossProfit);
    calculatedMarginPercent =
      customerSellingPrice > 0 ? (grossProfit / customerSellingPrice) * 100 : 0;
    calculatedMarkupPercent =
      totalProjectCost > 0 ? (grossProfit / totalProjectCost) * 100 : 0;
  } else if (activePricingTab === 'margin') {
    const m = Math.min(95, Math.max(1, Number(targetMarginPercent) || 20));
    const ratio = m / 100;
    customerSellingPrice = snapToQuarter(
      ratio < 0.99 ? totalProjectCost / (1 - ratio) : totalProjectCost * 2
    );
    grossProfit = snapToQuarter(customerSellingPrice - totalProjectCost);
    calculatedMarginPercent = m;
    calculatedMarkupPercent =
      totalProjectCost > 0 ? (grossProfit / totalProjectCost) * 100 : 0;
  } else if (activePricingTab === 'markup') {
    const mk = Math.max(0, Number(markupPercent) || 0);
    customerSellingPrice = snapToQuarter(totalProjectCost * (1 + mk / 100));
    grossProfit = snapToQuarter(customerSellingPrice - totalProjectCost);
    calculatedMarkupPercent = mk;
    calculatedMarginPercent =
      customerSellingPrice > 0 ? (grossProfit / customerSellingPrice) * 100 : 0;
  } else {
    // target_selling
    customerSellingPrice = snapToQuarter(
      Math.max(totalProjectCost, Number(targetSellingPriceInput) || totalProjectCost)
    );
    grossProfit = snapToQuarter(customerSellingPrice - totalProjectCost);
    calculatedMarginPercent =
      customerSellingPrice > 0 ? (grossProfit / customerSellingPrice) * 100 : 0;
    calculatedMarkupPercent =
      totalProjectCost > 0 ? (grossProfit / totalProjectCost) * 100 : 0;
  }

  // Effective markup ratio across the entire quote (used when not in per_quote tab)
  const effectiveMarkupRatio =
    totalProjectCost > 0 ? customerSellingPrice / totalProjectCost : 1.33;

  // Apply global pricing tab changes to items when NOT in per_quote mode
  useEffect(() => {
    if (activePricingTab !== 'per_quote' && items.length > 0 && effectiveMarkupRatio > 0) {
      setItems((prevItems) =>
        prevItems.map((item) => {
          const qty = Number(item.quantity) || 1;
          const uCost = Number(item.supplierUnitPrice) || 0;
          const sellUnit = snapToQuarter(uCost * effectiveMarkupRatio);
          const sellTotal = snapToQuarter(sellUnit * qty);
          return {
            ...item,
            sellingUnitPrice: sellUnit,
            sellingTotalPrice: sellTotal,
          };
        })
      );
    }
  }, [activePricingTab, targetMarginPercent, markupPercent, fixedAddedProfit, targetSellingPriceInput]);

  // VAT and Grand Total
  const vatAmount = snapToQuarter((customerSellingPrice * 15) / 100);
  const grandTotalWithVat = snapToQuarter(customerSellingPrice + vatAmount);

  // BoQ Item actions
  const handleAddItem = () => {
    const defaultQuote = availableSupplierQuotes.find((sq) =>
      selectedSupplierQuoteIds.includes(sq.id)
    ) || availableSupplierQuotes[0];

    const newItem: QuotationItem = {
      id: `item-${Date.now()}`,
      itemNo: items.length + 1,
      description: 'بند جديد',
      manufacturer: 'معتمد',
      model: '',
      quantity: 1,
      unit: 'حبة',
      supplierUnitPrice: 100,
      supplierTotalPrice: 100,
      sellingUnitPrice: snapToQuarter(100 * effectiveMarkupRatio),
      sellingTotalPrice: snapToQuarter(100 * effectiveMarkupRatio),
      system: selectedSystem,
      sourceSupplierQuoteId: defaultQuote?.id,
      sourceSupplierName: defaultQuote?.supplierName,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof QuotationItem,
    value: string | number
  ) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'supplierUnitPrice') {
      const q = Number(field === 'quantity' ? value : item.quantity) || 0;
      const p = Number(field === 'supplierUnitPrice' ? value : item.supplierUnitPrice) || 0;
      item.supplierTotalPrice = snapToQuarter(q * p);

      const margin = getItemEffectiveMargin(item);
      const mRatio = Math.min(0.95, Math.max(0.01, margin / 100));
      const sellUnit = snapToQuarter(p / (1 - mRatio));
      item.sellingUnitPrice = sellUnit;
      item.sellingTotalPrice = snapToQuarter(sellUnit * q);
    }

    updated[index] = item;
    setItems(updated);
  };

  // Direct modification of customer selling unit price per item
  const handleSellingPriceChange = (index: number, newUnitPrice: number) => {
    const snappedUnit = snapToQuarter(newUnitPrice);
    const updated = [...items];
    const item = { ...updated[index] };
    const q = Number(item.quantity) || 1;
    item.sellingUnitPrice = snappedUnit;
    item.sellingTotalPrice = snapToQuarter(snappedUnit * q);
    updated[index] = item;
    setItems(updated);
  };

  // Filtered items for display in the table
  const displayedItems =
    tableFilterQuoteId === 'all'
      ? items
      : items.filter((it) => it.sourceSupplierQuoteId === tableFilterQuoteId);

  // Final Action: Issue Quotation & Link to Project
  const handleIssueQuotation = () => {
    const quoteNum = getNextQuotationNumber(existingQuotations || []);

    const calculatedItems: QuotationItem[] = items.map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const suppCost = Number(item.supplierUnitPrice) || 0;
      const suppTotal = Number(item.supplierTotalPrice) || snapToQuarter(suppCost * qty);

      const finalSellUnit =
        item.sellingUnitPrice != null && item.sellingUnitPrice > 0
          ? item.sellingUnitPrice
          : snapToQuarter(suppCost * effectiveMarkupRatio);
      const finalSellTotal =
        item.sellingTotalPrice != null && item.sellingTotalPrice > 0
          ? item.sellingTotalPrice
          : snapToQuarter(finalSellUnit * qty);

      return {
        ...item,
        itemNo: idx + 1,
        quantity: qty,
        supplierUnitPrice: Number(suppCost.toFixed(2)),
        supplierTotalPrice: Number(suppTotal.toFixed(2)),
        sellingUnitPrice: finalSellUnit,
        sellingTotalPrice: finalSellTotal,
        system: item.system || detectItemSystemDiscipline(item, selectedSystems) || selectedSystem,
      };
    });

    const now = new Date().toISOString();

    const resolvedSystems = selectedSystems.length > 0 ? selectedSystems : [selectedSystem];
    const systemsEn = resolvedSystems.map((s) => getSystemMeta(s)?.nameEn).filter(Boolean).join(', ') || 'MEP Systems';
    const cleanScopeOfWork =
      scopeOfWork && !scopeOfWork.startsWith('توريد') && !scopeOfWork.includes('مكافحة')
        ? scopeOfWork
        : `Supply, Installation, Testing & Commissioning of ${systemsEn}`;

    const newQuotation: CustomerQuotation = {
      id: `quote-${Date.now()}`,
      quotationNumber: quoteNum,
      version: 1,
      date: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      validity: validity || '15 Days',
      status: issueStatus === 'issued' ? 'Issued' : 'Draft',
      projectId: project.id,
      projectName: project.name,
      clientName: project.customerName,
      attnName: project.attnName || 'المهندس المسؤول',
      projectLocation: project.location,
      scopeOfWork: cleanScopeOfWork,
      initiatedBy: issuerName,
      issuerDetails: {
        name: issuerName,
        title: issuerTitle,
        email: issuerEmail,
        phone: issuerPhone,
        mobile: issuerMobile,
      },
      systemDefinition: systemsEn,
      selectedSystems: resolvedSystems,
      items: calculatedItems,
      pricingMode: activePricingTab === 'per_quote' ? 'item_specific' : activePricingTab === 'added_amount' ? 'fixed' : activePricingTab === 'margin' ? 'gross_margin' : 'markup',
      overallMarkupPercent: Number(calculatedMarkupPercent.toFixed(2)),
      overallTargetMarginPercent: Number(calculatedMarginPercent.toFixed(2)),
      fixedAddedProfit: snapToQuarter(grossProfit),
      additionalCosts: additionalCosts,
      totals: {
        totalSupplierCost: snapToQuarter(totalSupplierCost),
        totalAdditionalCosts: snapToQuarter(totalAdditionalCosts),
        totalProjectCost: snapToQuarter(totalProjectCost),
        customerSellingPrice: snapToQuarter(customerSellingPrice),
        grossProfit: snapToQuarter(grossProfit),
        grossMarginPercent: Number(calculatedMarginPercent.toFixed(2)),
        vatPercent: 15,
        vatAmount: snapToQuarter(vatAmount),
        grandTotalWithVat: snapToQuarter(grandTotalWithVat),
      },
      terms: {
        includes: includes.filter(Boolean),
        excludes: excludes.filter(Boolean),
        paymentTerms: paymentTerms.filter(Boolean),
        validity: validity,
        notes: [
          ...notes.filter(Boolean),
          `فترة الضمان: ${warranty}`,
          `مدة التوريد والتنفيذ: ${delivery}`,
        ],
      },
      sourceSupplierQuotationId: selectedSupplierQuoteIds[0] || undefined,
      sourceSupplierQuotationIds: selectedSupplierQuoteIds,
      createdAt: now,
      updatedAt: now,
    };

    onQuotationIssued(newQuotation);
    onClose();

    if (onOpenQuotationEditor) {
      onOpenQuotationEditor(newQuotation.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="prepare-customer-quote-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-slate-50 rounded-2xl max-w-6xl w-full max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#007A5A] text-white rounded-xl shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  تجهيز ودمج تسعيرة العميل المعتمدة (Customer Quotation Builder)
                </h2>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {selectedSupplierQuoteIds.length > 1
                    ? `دمج ${selectedSupplierQuoteIds.length} تسعيرات موردين`
                    : 'تسعيرة مورد معتمدة'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                مشروع: <strong className="text-slate-200">{project.name}</strong> ({project.projectNumber}) — العميل: {project.customerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
          {/* SECTION 0: مصدر التكاليف واختيار تسعيرات الموردين للدمج */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-[#007A5A] rounded-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    تسعيرات الموردين المتاحة للمشروع (Supplier Quotes Source)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    حدد التسعيرات المراد دمجها في عرض السعر مع إمكانية تحديد هامش ربح مستقل لكل تسعيرة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllQuotes}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold transition cursor-pointer"
                >
                  تحديد كافة التسعيرات ({availableSupplierQuotes.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllQuotes}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            {/* Checklist Cards of Supplier Quotes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableSupplierQuotes.map((sq) => {
                const isSelected = selectedSupplierQuoteIds.includes(sq.id);
                const currentMargin =
                  quoteMargins[sq.id] !== undefined
                    ? quoteMargins[sq.id]
                    : targetMarginPercent;

                return (
                  <div
                    key={sq.id}
                    onClick={() => handleToggleQuoteSelection(sq.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-emerald-50/60 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 text-emerald-700">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#007A5A]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {sq.supplierName}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                            #{sq.quotationNumber}
                          </div>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="font-mono text-xs font-bold text-slate-900 block">
                          {Number(sq.totalAmount || sq.subtotal || 0).toLocaleString()} SAR
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {sq.items?.length || 0} بنود
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        تاريخ: {sq.date || 'معتمد'}
                      </span>
                      <span className="font-mono font-semibold px-2 py-0.5 rounded text-[10.5px] bg-emerald-100/70 text-[#007A5A]">
                        هامش الربح: {currentMargin}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 1: التحكم في هامش الربح والتسعير (Interactive Profit Margin Engine) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-[#007A5A] rounded-lg">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    ضبط هامش الربح وتسعير العميل (Profit Margin & Pricing Engine)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    اختر بين ضبط هامش مستقل لكل تسعيرة مورد أو تطبيق هامش موحد
                  </p>
                </div>
              </div>

              {/* Selector for which method to specify */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActivePricingTab('per_quote')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    activePricingTab === 'per_quote'
                      ? 'bg-white text-[#007A5A] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  هامش مستقل لكل تسعيرة ({selectedSupplierQuoteIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivePricingTab('margin')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    activePricingTab === 'margin'
                      ? 'bg-white text-[#007A5A] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نسبة هامش موحدة (%)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePricingTab('markup')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    activePricingTab === 'markup'
                      ? 'bg-white text-[#007A5A] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  نسبة إضافة موحدة (Markup %)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePricingTab('added_amount')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    activePricingTab === 'added_amount'
                      ? 'bg-white text-[#007A5A] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مبلغ ربح إجمالي (SAR)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePricingTab('target_selling')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    activePricingTab === 'target_selling'
                      ? 'bg-white text-[#007A5A] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  سعر بيع مستهدف (SAR)
                </button>
              </div>
            </div>

            {/* Content for Pricing Tab */}
            {activePricingTab === 'per_quote' ? (
              <div className="space-y-4">
                <div className="text-xs text-slate-600 bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex items-center justify-between">
                  <span>
                    💡 يمكنك ضبط طريقة التسعير (هامش ربح، نسبة إضافة، سعر بيع مستهدف، أو مبلغ ربح) لكل تسعيرة مورد بشكل مستقل تماماً. سيتم اعتماد إجمالي المبالغ في عرض السعر.
                  </span>
                  <span className="font-mono font-bold text-blue-900 shrink-0">
                    {selectedSupplierQuoteIds.length} تسعيرات نشطة
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {availableSupplierQuotes
                    .filter((sq) => selectedSupplierQuoteIds.includes(sq.id))
                    .map((sq) => {
                      const quoteItems = items.filter((it) => it.sourceSupplierQuoteId === sq.id);
                      const quoteCost = quoteItems.reduce(
                        (s, it) => s + (Number(it.supplierTotalPrice) || 0),
                        0
                      );
                      const mode = quotePricingModes[sq.id] || 'margin';
                      const val = quotePricingValues[sq.id] !== undefined ? quotePricingValues[sq.id] : (quoteMargins[sq.id] !== undefined ? quoteMargins[sq.id] : 25);

                      const quoteSellingTotal = quoteItems.reduce(
                        (s, it) => s + (Number(it.sellingTotalPrice) || 0),
                        0
                      );
                      const quoteProfit = snapToQuarter(quoteSellingTotal - quoteCost);
                      const quoteMargin = quoteSellingTotal > 0 ? (quoteProfit / quoteSellingTotal) * 100 : 0;
                      const quoteMarkup = quoteCost > 0 ? (quoteProfit / quoteCost) * 100 : 0;

                      return (
                        <div
                          key={sq.id}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                            <div>
                              <div className="font-bold text-xs text-slate-900">
                                {sq.supplierName}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">
                                #{sq.quotationNumber} ({quoteItems.length} بنود)
                              </div>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-700">
                              تكلفة: {quoteCost.toLocaleString()} SAR
                            </span>
                          </div>

                          {/* Pricing Mode Selector per Quote */}
                          <div className="grid grid-cols-4 gap-1 bg-slate-200/70 p-1 rounded-lg text-[10.5px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuotePricing(sq.id, 'margin', val)}
                              className={`py-1 rounded transition cursor-pointer text-center ${
                                mode === 'margin' ? 'bg-white text-[#007A5A] shadow-xs' : 'text-slate-600'
                              }`}
                            >
                              هامش %
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuotePricing(sq.id, 'markup', val)}
                              className={`py-1 rounded transition cursor-pointer text-center ${
                                mode === 'markup' ? 'bg-white text-[#007A5A] shadow-xs' : 'text-slate-600'
                              }`}
                            >
                              إضافة %
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuotePricing(sq.id, 'target_selling', quoteSellingTotal || quoteCost)}
                              className={`py-1 rounded transition cursor-pointer text-center ${
                                mode === 'target_selling' ? 'bg-white text-[#007A5A] shadow-xs' : 'text-slate-600'
                              }`}
                            >
                              سعر مستهدف
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuotePricing(sq.id, 'profit_amount', quoteProfit || 5000)}
                              className={`py-1 rounded transition cursor-pointer text-center ${
                                mode === 'profit_amount' ? 'bg-white text-[#007A5A] shadow-xs' : 'text-slate-600'
                              }`}
                            >
                              مبلغ ربح
                            </button>
                          </div>

                          {/* Input based on mode */}
                          <div className="space-y-1.5">
                            {mode === 'margin' && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">هامش الربح (Margin %):</span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="1"
                                      max="90"
                                      value={val}
                                      onChange={(e) => handleUpdateQuotePricing(sq.id, 'margin', parseFloat(e.target.value) || 0)}
                                      className="w-16 text-center font-mono font-bold bg-white border border-emerald-300 rounded px-1.5 py-0.5 text-xs text-[#007A5A] focus:outline-emerald-500"
                                    />
                                    <span className="font-bold text-emerald-800">%</span>
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min="5"
                                  max="60"
                                  step="1"
                                  value={val}
                                  onChange={(e) => handleUpdateQuotePricing(sq.id, 'margin', parseFloat(e.target.value) || 0)}
                                  className="w-full accent-[#007A5A] h-2 bg-slate-200 rounded-lg cursor-pointer"
                                />
                                <div className="flex items-center justify-between gap-1 pt-1">
                                  {[15, 20, 25, 30, 35].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => handleUpdateQuotePricing(sq.id, 'margin', preset)}
                                      className={`px-2 py-0.5 rounded text-[10.5px] font-mono transition cursor-pointer ${
                                        val === preset
                                          ? 'bg-[#007A5A] text-white font-bold'
                                          : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'
                                      }`}
                                    >
                                      {preset}%
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {mode === 'markup' && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">نسبة الإضافة (Markup %):</span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="1"
                                      max="200"
                                      value={val}
                                      onChange={(e) => handleUpdateQuotePricing(sq.id, 'markup', parseFloat(e.target.value) || 0)}
                                      className="w-16 text-center font-mono font-bold bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs text-amber-800 focus:outline-amber-500"
                                    />
                                    <span className="font-bold text-amber-800">%</span>
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min="5"
                                  max="100"
                                  step="1"
                                  value={val}
                                  onChange={(e) => handleUpdateQuotePricing(sq.id, 'markup', parseFloat(e.target.value) || 0)}
                                  className="w-full accent-amber-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                                />
                              </div>
                            )}

                            {mode === 'target_selling' && (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-slate-700">سعر البيع المستهدف (SAR):</div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="500"
                                    value={val}
                                    onChange={(e) => handleUpdateQuotePricing(sq.id, 'target_selling', parseFloat(e.target.value) || quoteCost)}
                                    className="w-full text-center font-mono font-bold bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs text-purple-900 focus:outline-purple-500"
                                  />
                                  <span className="text-xs text-slate-500 shrink-0">SAR</span>
                                </div>
                              </div>
                            )}

                            {mode === 'profit_amount' && (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-slate-700">مبلغ الربح المستهدف (SAR):</div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    step="500"
                                    value={val}
                                    onChange={(e) => handleUpdateQuotePricing(sq.id, 'profit_amount', parseFloat(e.target.value) || 0)}
                                    className="w-full text-center font-mono font-bold bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs text-emerald-900 focus:outline-emerald-500"
                                  />
                                  <span className="text-xs text-slate-500 shrink-0">SAR</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Financial Result for this quote */}
                          <div className="pt-2 border-t border-slate-200 text-xs space-y-1 bg-white p-2.5 rounded-lg border border-slate-100">
                            <div className="flex justify-between text-slate-600 text-[11px]">
                              <span>الهامش المحقق (Margin %):</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {quoteMargin.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-600 text-[11px]">
                              <span>نسبة الإضافة (Markup):</span>
                              <span className="font-mono font-semibold text-slate-800">
                                {quoteMarkup.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-700">
                              <span>إجمالي بيع بنود هذا المورد:</span>
                              <span className="font-mono font-bold text-emerald-950">
                                {quoteSellingTotal.toLocaleString()} SAR
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-700">
                              <span>صافي ربح هذا المورد:</span>
                              <span className="font-mono font-bold text-[#007A5A]">
                                {quoteProfit.toLocaleString()} SAR
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 space-y-4">
                  {activePricingTab === 'added_amount' && (
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          <span>المبلغ المطلوب إضافته كربح إجمالي للمشروع (SAR):</span>
                        </label>
                        <span className="font-mono text-xs font-bold text-emerald-700">
                          {fixedAddedProfit.toLocaleString()} SAR
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="500"
                          min="0"
                          value={fixedAddedProfit}
                          onChange={(e) => setFixedAddedProfit(parseFloat(e.target.value) || 0)}
                          className="w-48 text-base font-mono font-bold bg-white border border-emerald-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-emerald-500"
                        />
                        <span className="text-xs text-slate-500">
                          يتم توزيع هذا المبلغ المضاف بالتناسب على جميع بنود جدول الكميات.
                        </span>
                      </div>
                    </div>
                  )}

                  {activePricingTab === 'margin' && (
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <Percent className="w-4 h-4 text-blue-600" />
                          <span>نسبة هامش الربح الموحدة (Gross Margin %):</span>
                        </label>
                        <span className="font-mono text-sm font-bold text-blue-700">
                          {targetMarginPercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="70"
                        step="1"
                        value={targetMarginPercent}
                        onChange={(e) => setTargetMarginPercent(parseFloat(e.target.value) || 20)}
                        className="w-full accent-blue-600 h-2 bg-blue-100 rounded-lg cursor-pointer"
                      />
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-slate-500 font-bold ml-1">هوامش سريعة:</span>
                        {[5, 10, 15, 20, 25, 30, 35, 40, 50].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTargetMarginPercent(preset)}
                            className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                              targetMarginPercent === preset
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-400'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activePricingTab === 'markup' && (
                    <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <Percent className="w-4 h-4 text-amber-600" />
                          <span>نسبة الإضافة على التكلفة (Markup on Cost %):</span>
                        </label>
                        <span className="font-mono text-sm font-bold text-amber-700">
                          {markupPercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="1"
                        value={markupPercent}
                        onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 25)}
                        className="w-full accent-amber-600 h-2 bg-amber-100 rounded-lg cursor-pointer"
                      />
                    </div>
                  )}

                  {activePricingTab === 'target_selling' && (
                    <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-2">
                      <label className="text-xs font-bold text-purple-950 block">
                        إجمالي سعر البيع المستهدف للعميل قبل الضريبة (SAR):
                      </label>
                      <input
                        type="number"
                        step="1000"
                        value={targetSellingPriceInput || customerSellingPrice}
                        onChange={(e) =>
                          setTargetSellingPriceInput(parseFloat(e.target.value) || totalProjectCost)
                        }
                        className="w-56 text-base font-mono font-bold bg-white border border-purple-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-purple-500"
                      />
                    </div>
                  )}
                </div>

                {/* Real-time Calculation Summary Card */}
                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 border border-slate-800 shadow-md">
                  <h4 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span>التحليل المالي المباشر</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
                      Live Engine
                    </span>
                  </h4>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>تكلفة المورد للمواد:</span>
                      <span className="font-mono">{totalSupplierCost.toLocaleString()} SAR</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>تكاليف التنفيذ المباشرة:</span>
                      <span className="font-mono">{totalAdditionalCosts.toLocaleString()} SAR</span>
                    </div>
                    <div className="flex justify-between font-bold text-white pt-1.5 border-t border-slate-800">
                      <span>إجمالي تكلفة المشروع:</span>
                      <span className="font-mono">{totalProjectCost.toLocaleString()} SAR</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Financial Matrix Banner */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center bg-slate-900 text-white p-4 rounded-xl">
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">إجمالي تكلفة الموردين</span>
                <strong className="font-mono text-sm text-slate-100">
                  {totalSupplierCost.toLocaleString()} SAR
                </strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">سعر بيع العميل (قبل الضريبة)</span>
                <strong className="font-mono text-base text-emerald-400 font-bold">
                  {customerSellingPrice.toLocaleString()} SAR
                </strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">صافي الربح الإجمالي</span>
                <strong className="font-mono text-sm text-emerald-300 font-bold">
                  {grossProfit.toLocaleString()} SAR ({calculatedMarginPercent.toFixed(1)}%)
                </strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block mb-1">المجموع شاملاً الضريبة 15%</span>
                <strong className="font-mono text-base text-white font-black">
                  {grandTotalWithVat.toLocaleString()} SAR
                </strong>
              </div>
            </div>
          </div>

          {/* SECTION 2: جدول الكميات بأسعاره الفعلية والمدمجة */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#007A5A]" />
                <h3 className="text-sm font-bold text-slate-800">
                  جدول الكميات والتكاليف الفعلية (Bill of Quantities with Actual Costs)
                </h3>
                <span className="bg-emerald-100 text-[#007A5A] text-[11px] font-bold px-2 py-0.5 rounded-full font-mono">
                  {items.length} بنود
                </span>
              </div>

              {/* Filter by supplier quote when multiple quotes merged */}
              <div className="flex items-center gap-2">
                {selectedSupplierQuoteIds.length > 1 && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
                    <button
                      type="button"
                      onClick={() => setTableFilterQuoteId('all')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                        tableFilterQuoteId === 'all'
                          ? 'bg-[#007A5A] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      الكل ({items.length})
                    </button>
                    {availableSupplierQuotes
                      .filter((sq) => selectedSupplierQuoteIds.includes(sq.id))
                      .map((sq) => {
                        const count = items.filter((it) => it.sourceSupplierQuoteId === sq.id).length;
                        return (
                          <button
                            key={sq.id}
                            type="button"
                            onClick={() => setTableFilterQuoteId(sq.id)}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                              tableFilterQuoteId === sq.id
                                ? 'bg-[#007A5A] text-white'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {sq.supplierName.split(' ')[0]} ({count})
                          </button>
                        );
                      })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة بند جديد</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-32">المورد / التسعيرة</th>
                    <th className="py-2.5 px-3 min-w-[220px]">بيان البند والمواصفات (Description)</th>
                    <th className="py-2.5 px-3 w-28">الماركة / الموديل</th>
                    <th className="py-2.5 px-2 w-16 text-center">الكمية</th>
                    <th className="py-2.5 px-2 w-16 text-center">الوحدة</th>
                    <th className="py-2.5 px-3 w-28 text-left bg-amber-50/60 text-amber-900 font-bold">
                      تكلفة المورد (SAR)
                    </th>
                    <th className="py-2.5 px-3 w-28 text-left bg-amber-100/50 text-amber-950 font-bold">
                      إجمالي التكلفة
                    </th>
                    <th className="py-2.5 px-3 w-28 text-left bg-emerald-50/70 text-emerald-900 font-bold">
                      سعر بيع العميل
                    </th>
                    <th className="py-2.5 px-3 w-28 text-left bg-emerald-100/60 text-emerald-950 font-bold">
                      إجمالي البيع
                    </th>
                    <th className="py-2.5 px-2 w-10 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        لا توجد بنود حالياً. حدد تسعيرة مورد من الأعلى أو اضغط "إضافة بند جديد".
                      </td>
                    </tr>
                  ) : (
                    displayedItems.map((item, idx) => {
                      const realIdx = items.indexOf(item);
                      const qty = Number(item.quantity) || 1;
                      const suppCost = Number(item.supplierUnitPrice) || 0;
                      const suppTotal =
                        Number(item.supplierTotalPrice) || snapToQuarter(qty * suppCost);
                      const sellUnit = Number(item.sellingUnitPrice) || snapToQuarter(suppCost * effectiveMarkupRatio);
                      const sellTotal = snapToQuarter(sellUnit * qty);

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                            {realIdx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.sourceSupplierName || 'مورد عام'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                handleItemChange(realIdx, 'description', e.target.value)
                              }
                              className="w-full bg-transparent hover:bg-white focus:bg-white px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-hidden text-slate-800 text-xs font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.manufacturer || item.model || ''}
                              placeholder="الماركة"
                              onChange={(e) =>
                                handleItemChange(realIdx, 'manufacturer', e.target.value)
                              }
                              className="w-full bg-transparent hover:bg-white focus:bg-white px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-hidden text-slate-600 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  realIdx,
                                  'quantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-14 text-center font-mono font-bold bg-transparent hover:bg-white focus:bg-white px-1 py-1 rounded border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-hidden text-slate-900"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={item.unit || 'حبة'}
                              onChange={(e) =>
                                handleItemChange(realIdx, 'unit', e.target.value)
                              }
                              className="w-12 text-center bg-transparent hover:bg-white focus:bg-white px-1 py-1 rounded border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-hidden text-slate-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-left bg-amber-50/30">
                            <input
                              type="number"
                              step="any"
                              value={item.supplierUnitPrice}
                              onChange={(e) =>
                                handleItemChange(
                                  realIdx,
                                  'supplierUnitPrice',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 text-left font-mono font-bold text-amber-900 bg-transparent hover:bg-white focus:bg-white px-2 py-1 rounded border border-transparent hover:border-amber-300 focus:border-amber-500 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-slate-800 bg-amber-100/20">
                            {suppTotal.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2 px-3 text-left bg-emerald-50/50">
                            <input
                              type="number"
                              step="0.25"
                              value={sellUnit}
                              onChange={(e) =>
                                handleSellingPriceChange(
                                  realIdx,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-24 text-left font-mono font-bold text-emerald-900 bg-transparent hover:bg-white focus:bg-white px-2 py-1 rounded border border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:outline-hidden"
                              title="يمكنك تعديل سعر البيع مباشرة لهذا البند (سناب إلى 0.25)"
                            />
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-emerald-950 bg-emerald-100/40">
                            {sellTotal.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(realIdx)}
                              className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="حذف البند"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: التكاليف الإضافية المباشرة للمشروع (Optional Direct Costs) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <div
              onClick={() => setShowAdditionalCosts(!showAdditionalCosts)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  التكاليف الإضافية المباشرة للمشروع (Installation, Logistics & Engineering)
                </h3>
                {totalAdditionalCosts > 0 && (
                  <span className="font-mono text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                    +{totalAdditionalCosts.toLocaleString()} SAR
                  </span>
                )}
              </div>
              <div className="text-slate-400">
                {showAdditionalCosts ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>

            {showAdditionalCosts && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">أجور التركيب والعمالة (SAR)</label>
                  <input
                    type="number"
                    value={additionalCosts.installation || ''}
                    placeholder="0"
                    onChange={(e) =>
                      setAdditionalCosts({
                        ...additionalCosts,
                        installation: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">الشحن والنقل للموقع (SAR)</label>
                  <input
                    type="number"
                    value={additionalCosts.transportation || ''}
                    placeholder="0"
                    onChange={(e) =>
                      setAdditionalCosts({
                        ...additionalCosts,
                        transportation: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">الفحص والتشغيل والتسليم (SAR)</label>
                  <input
                    type="number"
                    value={additionalCosts.testingAndCommissioning ?? additionalCosts.testingCommissioning ?? ''}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setAdditionalCosts({
                        ...additionalCosts,
                        testingAndCommissioning: val,
                        testingCommissioning: val,
                      });
                    }}
                    className="w-full font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">الهندسة والمخططات (SAR)</label>
                  <input
                    type="number"
                    value={additionalCosts.engineering || ''}
                    placeholder="0"
                    onChange={(e) =>
                      setAdditionalCosts({
                        ...additionalCosts,
                        engineering: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 focus:bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: نطاق العمل والشروط التجارية (Commercial Terms) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                نطاق العمل والشروط التجارية (Scope & Commercial Conditions)
              </h3>
              <span className="text-xs text-slate-400">
                تطبق هذه الشروط في نموذج العرض المعتمد الرسمي
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  فترة سريان العرض (Validity):
                </label>
                <input
                  type="text"
                  value={validity}
                  onChange={(e) => setValidity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  مدة التوريد والتنفيذ (Delivery):
                </label>
                <input
                  type="text"
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  فترة الضمان (Warranty):
                </label>
                <input
                  type="text"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-slate-800 text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: بيانات المهندس ومصدر العرض (Quotation Issuer & Engineer Details) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div
              className="border-b border-slate-100 pb-2 flex items-center justify-between cursor-pointer"
              onClick={() => setShowIssuerConfig(!showIssuerConfig)}
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    بيانات المهندس ومصدر العرض (Quotation Issuer Contact Details)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    المسؤول المصدر للعرض الظاهر ببطاقة التواصل في التقرير الرسمي ({issuerName} - {issuerTitle})
                  </p>
                </div>
              </div>
              <div className="text-slate-400">
                {showIssuerConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>

            {showIssuerConfig && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs pt-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">اسم المهندس / المصدر</label>
                  <input
                    type="text"
                    value={issuerName}
                    onChange={(e) => setIssuerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={issuerTitle}
                    onChange={(e) => setIssuerTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={issuerEmail}
                    onChange={(e) => setIssuerEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">رقم الهاتف الثابت</label>
                  <input
                    type="text"
                    value={issuerPhone}
                    onChange={(e) => setIssuerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">رقم الجوال المباشر</label>
                  <input
                    type="text"
                    value={issuerMobile}
                    onChange={(e) => setIssuerMobile(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Issue Quotation & Link to Project */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">حالة الإصدار:</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="issueStatus"
                  value="issued"
                  checked={issueStatus === 'issued'}
                  onChange={() => setIssueStatus('issued')}
                  className="accent-[#007A5A]"
                />
                <span className="font-bold text-emerald-800">معتمد ومصدر رسمي للمشروع</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer mr-3">
                <input
                  type="radio"
                  name="issueStatus"
                  value="draft"
                  checked={issueStatus === 'draft'}
                  onChange={() => setIssueStatus('draft')}
                  className="accent-slate-600"
                />
                <span>مسودة أولية</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleIssueQuotation}
              disabled={items.length === 0}
              className="px-6 py-2.5 bg-[#007A5A] hover:bg-[#00664B] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {selectedSupplierQuoteIds.length > 1
                  ? `إصدار تسعيرة العميل المدمجة (${selectedSupplierQuoteIds.length} تسعيرات) الآن`
                  : 'إصدار تسعيرة العميل وربطها بالمشروع الآن'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
