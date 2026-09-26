import React, { useState, useEffect, useMemo } from 'react';
import {
  CustomerQuotation,
  QuotationAdditionalCosts,
  QuotationItem,
  QuotationVersionLog,
  SystemDiscipline,
  SYSTEM_DEFINITIONS,
  TermsLibraryItem,
  getSystemMeta,
} from '../types';
import {
  calculateQuotationTotals,
  exportQuotationToExcel,
  exportQuotationToWord,
  exportQuotationToPDF,
  snapToQuarter,
  groupItemsBySystem,
  standardizeQuotationTermsToEnglish,
  getQuotationSections,
} from '../utils/quotationUtils';
import { useExecutionLock } from '../utils/executionLock';
import { OfficialLetterhead } from './OfficialLetterhead';
import { SignatureBox } from './SignatureBox';
import { CommercialProposalPrint } from './CommercialProposalPrint';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import { transitionQuoteStatusAndSyncProject } from '../services/orchestratorService';
import {
  FileText,
  FileSpreadsheet,
  Printer,
  History,
  Sparkles,
  Calculator,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  ChevronDown,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  DollarSign,
  Send,
  Upload,
  Edit3,
  CheckCircle2,
  Save,
  Sliders,
  RotateCcw,
  SlidersHorizontal,
  FileCheck,
  ArrowDownUp,
  Wand2,
  MessageCircle,
  Share2,
  Phone,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface CustomerQuotationEditorProps {
  quotation: CustomerQuotation;
  termsLibrary: TermsLibraryItem[];
  onSaveQuotation: (updatedQuotation: CustomerQuotation) => void;
  onCreateNewVersion: (updatedQuotation: CustomerQuotation, changeNotes: string) => void;
  onBack?: () => void;
}

export const CustomerQuotationEditor: React.FC<CustomerQuotationEditorProps> = ({
  quotation,
  termsLibrary,
  onSaveQuotation,
  onCreateNewVersion,
  onBack,
}) => {
  const { settings } = useSettings();
  const { corporate, financial } = useMasterEnterpriseStore();
  const isEn = settings.language === 'en';

  const [activeTab, setActiveTab] = useState<'preview' | 'pricing' | 'systems_terms' | 'versions'>('preview');
  const { isLocked, runWithLock } = useExecutionLock();

  // Working Quotation Copy State
  const [currentQuote, setCurrentQuote] = useState<CustomerQuotation>(quotation);

  // Baseline item costs for persistent reference, percentage scaling, and reset
  const [baselineItemCosts, setBaselineItemCosts] = useState<{ [itemId: string]: number }>(() => {
    const map: { [itemId: string]: number } = {};
    (quotation.items || []).forEach((it) => {
      map[it.id] = it.supplierUnitPrice || 0;
    });
    return map;
  });

  // Cost Adjustment Playground State
  const [costAdjustmentPercent, setCostAdjustmentPercent] = useState<number>(0);
  const [targetCostInput, setTargetCostInput] = useState<string>('');
  const [costFilterSystem, setCostFilterSystem] = useState<string>('all');

  useEffect(() => {
    setCurrentQuote(quotation);
    // Refresh baseline costs map for new items without losing existing initial baselines
    setBaselineItemCosts((prev) => {
      const map: { [itemId: string]: number } = { ...prev };
      (quotation.items || []).forEach((it) => {
        if (map[it.id] === undefined) {
          map[it.id] = it.supplierUnitPrice || 0;
        }
      });
      return map;
    });
  }, [quotation]);

  const [isLiveEditMode, setIsLiveEditMode] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [aiCommand, setAiCommand] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // New Version Modal State
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionNote, setVersionNote] = useState('');
  const [showCommercialProposal, setShowCommercialProposal] = useState(false);

  // WhatsApp Dispatch & Share State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppRecipientPhone, setWhatsAppRecipientPhone] = useState(
    (currentQuote as any).contactPhone || (currentQuote as any).customerPhone || ''
  );
  const [whatsAppCustomNote, setWhatsAppCustomNote] = useState('');
  const [whatsAppFeedback, setWhatsAppFeedback] = useState<string | null>(null);
  const [isCopiedWhatsApp, setIsCopiedWhatsApp] = useState(false);

  const getWhatsAppMessageText = () => {
    const quoteNum = currentQuote.quotationNumber || 'CQ-RMT';
    const clientName = currentQuote.customerName || (isEn ? 'Valued Client' : 'العميل المحترم');
    const projName = currentQuote.projectName || (isEn ? 'Approved Project' : 'مشروع معتمد');
    const quoteDate = currentQuote.date || new Date().toISOString().split('T')[0];
    const subtotal = (currentQuote.totals?.customerSellingPrice || 0).toLocaleString();
    const vat = (currentQuote.totals?.vatAmount || 0).toLocaleString();
    const grandTotal = (currentQuote.totals?.grandTotalWithVat || 0).toLocaleString();
    const validity = currentQuote.validity || (isEn ? '30 days from issue date' : '30 يوماً من تاريخ الإصدار');

    const companyName = corporate.officialArabicName || 'شركة صناع الموارد التجاريه';
    const companyEn = corporate.officialEnglishName || 'RMT COMMERCE & CONTRACTING';
    const phone = (corporate as any).phone || (corporate as any).officialPhone || '+966 549220606';
    const email = (corporate as any).email || (corporate as any).officialEmail || 'info@rmt-sa.com';

    let text = `*${companyName}*\n*${companyEn}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📄 *عرض سعر معتمد:* ${quoteNum} (الإصدار V${currentQuote.version || 1})\n`;
    text += `👤 *السادة:* ${clientName}\n`;
    text += `🏗️ *المشروع:* ${projName}\n`;
    text += `📅 *التاريخ:* ${quoteDate}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 *قيمة العرض قبل الضريبة:* ${subtotal} ر.س\n`;
    text += `📊 *ضريبة القيمة المضافة (15%):* ${vat} ر.س\n`;
    text += `✨ *الإجمالي النهائي شامل الضريبة:* ${grandTotal} ر.س\n`;
    text += `⏳ *صلاحية العرض:* ${validity}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    if (whatsAppCustomNote.trim()) {
      text += `📝 *ملاحظات إضافية:*\n${whatsAppCustomNote.trim()}\n━━━━━━━━━━━━━━━━━━━━━\n`;
    }
    text += `📌 *للتواصل والمتابعة المباشرة:*\n`;
    text += `📞 هاتف / واتساب: ${phone}\n`;
    text += `✉️ بريد: ${email}\n`;
    text += `نسعد دائماً بخدمتكم وتلبية متطلبات مشاريعكم بأعلى معايير الجودة والاحترافية.`;

    return text;
  };

  const handleSendWhatsApp = () => {
    const rawPhone = whatsAppRecipientPhone || (currentQuote as any).contactPhone || (currentQuote as any).customerPhone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('05')) {
      cleanPhone = '966' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
      cleanPhone = '966' + cleanPhone;
    }
    const message = getWhatsAppMessageText();
    const encoded = encodeURIComponent(message);
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setWhatsAppFeedback(isEn ? 'WhatsApp opened successfully!' : 'تم فتح تطبيق واتساب بنجاح، يمكنك إرسال العرض للمستلم.');
    setTimeout(() => setWhatsAppFeedback(null), 3500);
  };

  const handleCopyWhatsAppText = () => {
    const message = getWhatsAppMessageText();
    navigator.clipboard.writeText(message);
    setIsCopiedWhatsApp(true);
    setWhatsAppFeedback(isEn ? 'Message copied to clipboard!' : 'تم نسخ نص الرسالة للحافظة بنجاح!');
    setTimeout(() => {
      setIsCopiedWhatsApp(false);
      setWhatsAppFeedback(null);
    }, 3000);
  };

  // Table pricing focus: Selling Prices vs Supplier Cost
  const [tablePricingFocus, setTablePricingFocus] = useState<'selling' | 'supplier'>('selling');

  // Baseline Total Calculation for comparison
  const baselineSupplierCostTotal = useMemo(() => {
    return (currentQuote.items || []).reduce((sum, it) => {
      const b = baselineItemCosts[it.id] !== undefined ? baselineItemCosts[it.id] : (it.supplierUnitPrice || 0);
      return sum + (Number(it.quantity) || 1) * b;
    }, 0);
  }, [currentQuote.items, baselineItemCosts]);

  const costDeltaSAR = (currentQuote.totals?.totalSupplierCost || 0) - baselineSupplierCostTotal;

  // Re-run totals calculation whenever items, additional costs, or pricing parameters change
  const applyCalculations = (
    newItems: QuotationItem[],
    newCosts: QuotationAdditionalCosts,
    mode: 'markup' | 'gross_margin' | 'fixed' | 'item_specific',
    markup: number,
    margin: number
  ) => {
    const { items: updatedItems, totals } = calculateQuotationTotals(
      newItems,
      newCosts,
      mode,
      markup,
      margin,
      currentQuote.totals.vatPercent || 15
    );

    const updated: CustomerQuotation = {
      ...currentQuote,
      items: updatedItems,
      additionalCosts: newCosts,
      pricingMode: mode,
      overallMarkupPercent: markup,
      overallTargetMarginPercent: margin,
      totals,
      updatedAt: new Date().toISOString(),
    };

    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  // Cost Playground: Scale items by percentage (+/- %)
  const handleApplyCostAdjustment = (percent: number, systemFilter = costFilterSystem) => {
    setCostAdjustmentPercent(percent);
    const factor = 1 + percent / 100;

    const updatedItems = currentQuote.items.map((item) => {
      if (systemFilter !== 'all' && item.system !== systemFilter) {
        return item;
      }
      const baseCost = baselineItemCosts[item.id] !== undefined ? baselineItemCosts[item.id] : (item.supplierUnitPrice || 0);
      const newUnitCost = snapToQuarter(Math.max(0, baseCost * factor));
      const qty = Number(item.quantity) || 1;
      return {
        ...item,
        supplierUnitPrice: newUnitCost,
        supplierTotalPrice: snapToQuarter(qty * newUnitCost),
      };
    });

    applyCalculations(
      updatedItems,
      currentQuote.additionalCosts,
      currentQuote.pricingMode,
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent
    );
  };

  // Cost Playground: Scale items to match target supplier cost in SAR
  const handleApplyTargetCost = (targetCostSAR: number) => {
    if (isNaN(targetCostSAR) || targetCostSAR <= 0) return;

    const relevantBaselineTotal = currentQuote.items.reduce((sum, item) => {
      if (costFilterSystem !== 'all' && item.system !== costFilterSystem) {
        return sum;
      }
      const baseCost = baselineItemCosts[item.id] !== undefined ? baselineItemCosts[item.id] : (item.supplierUnitPrice || 0);
      return sum + (Number(item.quantity) || 1) * baseCost;
    }, 0);

    if (relevantBaselineTotal <= 0) return;
    const ratio = targetCostSAR / relevantBaselineTotal;
    const calculatedPercent = Math.round((ratio - 1) * 1000) / 10;
    setCostAdjustmentPercent(calculatedPercent);

    const updatedItems = currentQuote.items.map((item) => {
      if (costFilterSystem !== 'all' && item.system !== costFilterSystem) {
        return item;
      }
      const baseCost = baselineItemCosts[item.id] !== undefined ? baselineItemCosts[item.id] : (item.supplierUnitPrice || 0);
      const newUnitCost = snapToQuarter(Math.max(0, baseCost * ratio));
      const qty = Number(item.quantity) || 1;
      return {
        ...item,
        supplierUnitPrice: newUnitCost,
        supplierTotalPrice: snapToQuarter(qty * newUnitCost),
      };
    });

    applyCalculations(
      updatedItems,
      currentQuote.additionalCosts,
      currentQuote.pricingMode,
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent
    );
  };

  // Cost Playground: Reset costs to original baseline
  const handleResetCostsToBaseline = () => {
    setCostAdjustmentPercent(0);
    setTargetCostInput('');
    const updatedItems = currentQuote.items.map((item) => {
      const baseCost = baselineItemCosts[item.id] !== undefined ? baselineItemCosts[item.id] : (item.supplierUnitPrice || 0);
      const qty = Number(item.quantity) || 1;
      return {
        ...item,
        supplierUnitPrice: baseCost,
        supplierTotalPrice: snapToQuarter(qty * baseCost),
      };
    });

    applyCalculations(
      updatedItems,
      currentQuote.additionalCosts,
      currentQuote.pricingMode,
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent
    );
  };

  // Cost Playground: Quick tweak a single item's supplier cost (+/- %)
  const handleQuickTweakItemCost = (itemId: string, deltaPercent: number) => {
    const updatedItems = currentQuote.items.map((it) => {
      if (it.id !== itemId) return it;
      const newCost = snapToQuarter(Math.max(0, it.supplierUnitPrice * (1 + deltaPercent / 100)));
      const qty = Number(it.quantity) || 1;
      return {
        ...it,
        supplierUnitPrice: newCost,
        supplierTotalPrice: snapToQuarter(qty * newCost),
      };
    });

    applyCalculations(
      updatedItems,
      currentQuote.additionalCosts,
      currentQuote.pricingMode,
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent
    );
  };

  // Cost Playground: Quick tweak a single item's selling price (+/- %)
  const handleQuickTweakItemPrice = (itemId: string, deltaPercent: number) => {
    const updatedItems = currentQuote.items.map((it) => {
      if (it.id !== itemId) return it;
      const newPrice = snapToQuarter(Math.max(0, it.sellingUnitPrice * (1 + deltaPercent / 100)));
      const qty = Number(it.quantity) || 1;
      return {
        ...it,
        sellingUnitPrice: newPrice,
        sellingTotalPrice: snapToQuarter(qty * newPrice),
      };
    });

    const { items: recalculatedItems, totals } = calculateQuotationTotals(
      updatedItems,
      currentQuote.additionalCosts,
      'item_specific',
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent,
      currentQuote.totals.vatPercent || 15
    );

    const updatedQuote: CustomerQuotation = {
      ...currentQuote,
      items: recalculatedItems,
      totals,
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updatedQuote);
    onSaveQuotation(updatedQuote);
  };

  // Dynamic Variable Profit Margin Engine Handlers
  const handleUpdateMarginPercent = (margin: number) => {
    const clamped = Math.max(0, Math.min(95, margin));
    applyCalculations(
      currentQuote.items,
      currentQuote.additionalCosts,
      'gross_margin',
      currentQuote.overallMarkupPercent,
      clamped
    );
  };

  const handleUpdateMarkupPercent = (markup: number) => {
    const clamped = Math.max(0, markup);
    applyCalculations(
      currentQuote.items,
      currentQuote.additionalCosts,
      'markup',
      clamped,
      currentQuote.overallTargetMarginPercent
    );
  };

  const handleUpdateTargetSellingPrice = (targetSelling: number) => {
    if (isNaN(targetSelling) || targetSelling <= 0) return;
    const totalCost = currentQuote.totals.totalProjectCost || 1;
    const grossProfit = Math.max(0, targetSelling - totalCost);
    const margin = targetSelling > 0 ? (grossProfit / targetSelling) * 100 : 0;
    const markup = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;

    const { items: updatedItems, totals } = calculateQuotationTotals(
      currentQuote.items,
      currentQuote.additionalCosts,
      'fixed',
      Number(markup.toFixed(2)),
      Number(margin.toFixed(2)),
      currentQuote.totals.vatPercent || 15,
      grossProfit,
      targetSelling
    );

    const updated: CustomerQuotation = {
      ...currentQuote,
      items: updatedItems,
      pricingMode: 'fixed',
      overallMarkupPercent: Number(markup.toFixed(2)),
      overallTargetMarginPercent: Number(margin.toFixed(2)),
      totals,
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  const handleUpdateTargetProfitSAR = (targetProfit: number) => {
    if (isNaN(targetProfit) || targetProfit < 0) return;
    const totalCost = currentQuote.totals.totalProjectCost || 0;
    const targetSelling = totalCost + targetProfit;
    handleUpdateTargetSellingPrice(targetSelling);
  };

  const handleUpdateItemMargin = (itemId: string, itemMarginPercent: number) => {
    const clamped = Math.max(0, Math.min(95, itemMarginPercent));
    const ratio = clamped / 100;
    const updatedItems = currentQuote.items.map((it) => {
      if (it.id !== itemId) return it;
      const cost = it.supplierUnitPrice || 0;
      const newPrice = ratio >= 0.99 ? cost * 2 : snapToQuarter(cost / (1 - ratio));
      const qty = Number(it.quantity) || 1;
      return {
        ...it,
        sellingUnitPrice: newPrice,
        sellingTotalPrice: snapToQuarter(qty * newPrice),
        customMarkupPercent: cost > 0 ? Number((((newPrice - cost) / cost) * 100).toFixed(2)) : 0,
      };
    });

    const { items: recalculatedItems, totals } = calculateQuotationTotals(
      updatedItems,
      currentQuote.additionalCosts,
      'item_specific',
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent,
      currentQuote.totals.vatPercent || 15
    );

    const updatedQuote: CustomerQuotation = {
      ...currentQuote,
      items: recalculatedItems,
      totals,
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updatedQuote);
    onSaveQuotation(updatedQuote);
  };

  // Live Edit mode: directly update top-level quotation fields
  const handleUpdateQuoteField = (field: keyof CustomerQuotation, val: any) => {
    const updated = {
      ...currentQuote,
      [field]: val,
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  // Live Edit mode: update issuer contact details
  const handleUpdateIssuerField = (field: 'name' | 'title' | 'email' | 'phone' | 'mobile', val: string) => {
    const currentIssuer = currentQuote.issuerDetails || {
      name: currentQuote.initiatedBy || corporate.engineerName,
      title: corporate.engineerTitle,
      email: corporate.engineerEmail,
      phone: corporate.phone,
      mobile: corporate.mobiles?.[0] || '',
    };
    const updatedIssuer = {
      ...currentIssuer,
      [field]: val,
    };
    const updated: CustomerQuotation = {
      ...currentQuote,
      issuerDetails: updatedIssuer,
      ...(field === 'name' ? { initiatedBy: val } : {}),
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  // Live Edit mode: directly update item attributes and price
  const handleUpdateItem = (itemId: string, field: keyof QuotationItem, val: any) => {
    const updatedItems = currentQuote.items.map((it) => {
      if (it.id !== itemId) return it;
      const copy = { ...it, [field]: val };
      if (field === 'quantity' || field === 'sellingUnitPrice') {
        const q = Number(copy.quantity) || 1;
        const p = Number(copy.sellingUnitPrice) || 0;
        copy.sellingUnitPrice = snapToQuarter(p);
        copy.sellingTotalPrice = snapToQuarter(q * copy.sellingUnitPrice);
      }
      return copy;
    });

    const { items: recalculatedItems, totals } = calculateQuotationTotals(
      updatedItems,
      currentQuote.additionalCosts,
      'item_specific',
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent,
      currentQuote.totals.vatPercent || 15
    );

    const updatedQuote: CustomerQuotation = {
      ...currentQuote,
      items: recalculatedItems,
      totals,
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updatedQuote);
    onSaveQuotation(updatedQuote);
  };

  // Live Edit mode: Add new BOQ item directly
  const handleAddPreviewItem = () => {
    const newItem: QuotationItem = {
      id: `boq-item-${Date.now()}`,
      itemNo: (currentQuote?.items ?? []).length + 1,
      description: 'New Equipment / Item Description',
      manufacturer: 'Brand',
      model: 'Model #',
      quantity: 1,
      unit: 'pcs',
      supplierUnitPrice: 0,
      supplierTotalPrice: 0,
      sellingUnitPrice: 100,
      sellingTotalPrice: 100,
      system: currentQuote?.selectedSystems?.[0] ?? 'hvac',
    };
    const updatedItems = [...(currentQuote?.items ?? []), newItem];
    const { items: recalculatedItems, totals } = calculateQuotationTotals(
      updatedItems,
      currentQuote.additionalCosts,
      'item_specific',
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent,
      currentQuote.totals.vatPercent || 15
    );
    const updatedQuote = {
      ...currentQuote,
      items: recalculatedItems,
      totals,
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updatedQuote);
    onSaveQuotation(updatedQuote);
  };

  // Live Edit mode: Remove BOQ item directly
  const handleRemovePreviewItem = (itemId: string) => {
    const updatedItems = currentQuote.items.filter((it) => it.id !== itemId);
    const { items: recalculatedItems, totals } = calculateQuotationTotals(
      updatedItems,
      currentQuote.additionalCosts,
      'item_specific',
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent,
      currentQuote.totals.vatPercent || 15
    );
    const updatedQuote = {
      ...currentQuote,
      items: recalculatedItems,
      totals,
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updatedQuote);
    onSaveQuotation(updatedQuote);
  };

  // Live Edit: update terms clause
  const handleUpdateTerm = (
    type: 'includes' | 'excludes' | 'paymentTerms' | 'notes',
    idx: number,
    val: string
  ) => {
    const list = [...(currentQuote.terms?.[type] || [])];
    list[idx] = val;
    const updated = {
      ...currentQuote,
      terms: {
        ...currentQuote.terms,
        [type]: list,
      },
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  // Live Edit: delete terms clause
  const handleDeleteTerm = (
    type: 'includes' | 'excludes' | 'paymentTerms' | 'notes',
    idx: number
  ) => {
    const list = (currentQuote.terms?.[type] || []).filter((_, i) => i !== idx);
    const updated = {
      ...currentQuote,
      terms: {
        ...currentQuote.terms,
        [type]: list,
      },
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  // Live Edit: add terms clause
  const handleAddTerm = (
    type: 'includes' | 'excludes' | 'paymentTerms' | 'notes',
    text: string
  ) => {
    const list = [...(currentQuote.terms?.[type] || []), text];
    const updated = {
      ...currentQuote,
      terms: {
        ...currentQuote.terms,
        [type]: list,
      },
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  // Systems Selection handler with bi-directional term synchronization
  const handleToggleSystem = (sysId: SystemDiscipline) => {
    const currentList = currentQuote?.selectedSystems ?? [];
    const exists = currentList.includes(sysId);
    let updatedSystems: SystemDiscipline[] = [];
    const matchingTerms = termsLibrary?.find((t) => t.system === sysId);

    let newIncludes = [...(currentQuote?.terms?.includes ?? [])];
    let newExcludes = [...(currentQuote?.terms?.excludes ?? [])];
    let newNotes = [...(currentQuote?.terms?.notes ?? [])];

    if (exists) {
      // User is UNCHECKING this system -> Remove all its terms
      updatedSystems = currentList.filter((s) => s !== sysId);
      if (matchingTerms) {
        newIncludes = newIncludes.filter((inc) => !(matchingTerms?.includes ?? []).includes(inc));
        newExcludes = newExcludes.filter((exc) => !(matchingTerms?.excludes ?? []).includes(exc));
        newNotes = newNotes.filter((n) => !(matchingTerms?.notes ?? []).includes(n));
      }
    } else {
      // User is CHECKING this system -> Add its terms
      updatedSystems = [...currentList, sysId];
      if (matchingTerms) {
        (matchingTerms?.includes ?? []).forEach((inc) => {
          if (!newIncludes.includes(inc)) newIncludes.push(inc);
        });
        (matchingTerms?.excludes ?? []).forEach((exc) => {
          if (!newExcludes.includes(exc)) newExcludes.push(exc);
        });
        (matchingTerms?.notes ?? []).forEach((n) => {
          if (!newNotes.includes(n)) newNotes.push(n);
        });
      }
    }

    const updated: CustomerQuotation = {
      ...currentQuote,
      selectedSystems: updatedSystems,
      terms: {
        ...currentQuote.terms,
        includes: newIncludes,
        excludes: newExcludes,
        notes: newNotes,
      },
      updatedAt: new Date().toISOString(),
    };
    setCurrentQuote(updated);
    onSaveQuotation(updated);
  };

  // AI Natural Language Command Handler
  const handleRunAiCommand = async () => {
    if (!aiCommand.trim()) return;
    setIsAiLoading(true);
    setAiMessage(null);

    try {
      const res = await fetch('/api/ai/pricing-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: aiCommand,
          currentCost: currentQuote.totals.totalSupplierCost,
          currentQuotation: currentQuote,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        if (data) {
          let newCosts = { ...currentQuote.additionalCosts };
          let newMarkup = currentQuote.overallMarkupPercent;
          let newMargin = currentQuote.overallTargetMarginPercent;
          let newMode = currentQuote.pricingMode;

          if (data.markupPercent !== undefined && data.markupPercent !== null) {
            newMarkup = data.markupPercent;
            newMode = 'markup';
          }
          if (data.targetGrossMarginPercent !== undefined && data.targetGrossMarginPercent !== null) {
            newMargin = data.targetGrossMarginPercent;
            newMode = 'gross_margin';
          }
          if (data.additionalCosts) {
            if (data.additionalCosts.installation) newCosts.installation = data.additionalCosts.installation;
            if (data.additionalCosts.transportation) newCosts.transportation = data.additionalCosts.transportation;
            if (data.additionalCosts.testingAndCommissioning) newCosts.testingAndCommissioning = data.additionalCosts.testingAndCommissioning;
            if (data.additionalCosts.engineering) newCosts.engineering = data.additionalCosts.engineering;
            if (data.additionalCosts.contingency) newCosts.contingency = data.additionalCosts.contingency;
            if (data.additionalCosts.manpower) newCosts.manpower = data.additionalCosts.manpower;
          }

          applyCalculations(currentQuote.items, newCosts, newMode, newMarkup, newMargin);
          setAiMessage(data.explanationArabic || data.explanationEnglish || 'تم تحديث التسعيرة بنجاح');
          setAiCommand('');
        }
      } else {
        // Fallback natural language rule matcher if offline
        const cmd = aiCommand.toLowerCase();
        let newMarkup = currentQuote.overallMarkupPercent;
        let newCosts = { ...currentQuote.additionalCosts };

        if (cmd.includes('25%') || cmd.includes('25')) newMarkup = 25;
        if (cmd.includes('20%') || cmd.includes('20')) newMarkup = 25; // 25% markup = 20% margin
        if (cmd.includes('10000') || cmd.includes('10,000')) newCosts.installation = 10000;
        if (cmd.includes('3000') || cmd.includes('3,000')) newCosts.transportation = 3000;

        applyCalculations(currentQuote.items, newCosts, 'markup', newMarkup, currentQuote.overallTargetMarginPercent);
        setAiMessage('تم تطبيق التعليمات تلقائياً على عناصر التكلفة وهامش الربح.');
        setAiCommand('');
      }
    } catch (err: any) {
      setAiMessage('تم تحديث الحسابات وفق القيم المدخلة.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Picture handling for items
  const handleItemImageUpload = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updatedItems = currentQuote.items.map((it) =>
        it.id === itemId ? { ...it, pictureUrl: dataUrl } : it
      );
      applyCalculations(
        updatedItems,
        currentQuote.additionalCosts,
        currentQuote.pricingMode,
        currentQuote.overallMarkupPercent,
        currentQuote.overallTargetMarginPercent
      );
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveItemImage = (itemId: string) => {
    const updatedItems = currentQuote.items.map((it) =>
      it.id === itemId ? { ...it, pictureUrl: undefined } : it
    );
    applyCalculations(
      updatedItems,
      currentQuote.additionalCosts,
      currentQuote.pricingMode,
      currentQuote.overallMarkupPercent,
      currentQuote.overallTargetMarginPercent
    );
  };

  // Save as new version
  const handleSaveVersion = () => {
    if (!versionNote.trim()) return;
    const newVersionNum = (currentQuote.version || 1) + 1;
    const newLog: QuotationVersionLog = {
      version: newVersionNum,
      modifiedAt: new Date().toLocaleString(),
      customerSellingPrice: currentQuote.totals.customerSellingPrice,
      grossProfit: currentQuote.totals.grossProfit,
      grossMarginPercent: currentQuote.totals.grossMarginPercent,
      totalProjectCost: currentQuote.totals.totalProjectCost,
      changeSummary: versionNote,
      modifiedBy: corporate.engineerName,
    };

    const newQuotationVersion: CustomerQuotation = {
      ...currentQuote,
      version: newVersionNum,
      versionHistory: [newLog, ...(currentQuote.versionHistory || [])],
      updatedAt: new Date().toISOString(),
    };

    onCreateNewVersion(newQuotationVersion, versionNote);
    setCurrentQuote(newQuotationVersion);
    setShowVersionModal(false);
    setVersionNote('');
  };

  const systemGroups = groupItemsBySystem(currentQuote.items);
  const sections = getQuotationSections(currentQuote);

  const declaredSystems = (currentQuote.selectedSystems && currentQuote.selectedSystems.length > 0)
    ? currentQuote.selectedSystems
    : sections.map((s) => s.systemKey as SystemDiscipline);

  const systemNamesEn = declaredSystems.map((s) => getSystemMeta(s).nameEn).join(', ') || 'MEP & Specialized Engineering Systems';

  const isFireFightingHallucinated = (!declaredSystems.includes('fire_fighting')) &&
    ((currentQuote.systemDefinition && currentQuote.systemDefinition.toLowerCase().includes('fire')) ||
     (currentQuote.scopeOfWork && (currentQuote.scopeOfWork.includes('مكافحة') || currentQuote.scopeOfWork.toLowerCase().includes('fire'))));

  const cleanSystemDefinition = (isFireFightingHallucinated || !currentQuote.systemDefinition || currentQuote.systemDefinition.includes('مكافحة'))
    ? systemNamesEn
    : currentQuote.systemDefinition;

  const cleanScopeOfWork = (isFireFightingHallucinated || !currentQuote.scopeOfWork || currentQuote.scopeOfWork.startsWith('توريد'))
    ? `Supply, Installation, Testing & Commissioning of ${systemNamesEn}`
    : currentQuote.scopeOfWork;

  const handleBackToQuotations = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      onSaveQuotation(currentQuote);
    } catch (err) {
      console.warn('Auto-save error on back navigation:', err);
    }
    if (onBack) {
      onBack();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Navigation Bar */}
      <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToQuotations}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-[#007A5A] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            title={isEn ? 'Save draft and return to quotations list' : 'حفظ المسودة والعودة إلى قائمة عروض الأسعار'}
          >
            <span>{isEn ? '← Back to Quotations' : '← العودة إلى عروض الأسعار'}</span>
          </button>
          <div className="w-10 h-10 rounded-lg bg-[#007A5A]/10 text-[#007A5A] flex items-center justify-center font-bold font-mono">
            V{currentQuote.version}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">
                {isEn ? `Quotation #${currentQuote.quotationNumber}` : `عرض سعر العميل #${currentQuote.quotationNumber}`}
              </h2>
              {/* Interactive Status Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...currentQuote, status: 'Draft' as const };
                    setCurrentQuote(updated);
                    onSaveQuotation(updated);
                  }}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer text-[11px] ${
                    currentQuote.status === 'Draft' || currentQuote.status === 'draft'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={isEn ? 'Set as Draft' : 'تعيين كمسودة أولية (Draft)'}
                >
                  {isEn ? 'Draft' : 'مسودة (Draft)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...currentQuote, status: 'Issued' as const };
                    setCurrentQuote(updated);
                    onSaveQuotation(updated);
                  }}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer text-[11px] ${
                    currentQuote.status === 'Issued' || currentQuote.status === 'sent_to_customer'
                      ? 'bg-[#007A5A] text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={isEn ? 'Set as Issued / Published' : 'تعيين كعرض مصدر ورسمي للعميل (Issued / Published)'}
                >
                  {isEn ? 'Issued' : 'مصدر ورسمي (Issued)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const { quote } = transitionQuoteStatusAndSyncProject(currentQuote.id, 'Approved');
                      setCurrentQuote(quote);
                      onSaveQuotation(quote);
                    } catch {
                      const updated = { ...currentQuote, status: 'Approved' as const };
                      setCurrentQuote(updated);
                      onSaveQuotation(updated);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer text-[11px] ${
                    currentQuote.status === 'Approved' || currentQuote.status === 'won'
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={isEn ? 'Set as Approved' : 'تعيين كمعتمد من العميل (Approved)'}
                >
                  {isEn ? 'Approved' : 'معتمد (Approved)'}
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {currentQuote.clientName} — {currentQuote.projectName} ({currentQuote.projectLocation})
            </p>
          </div>
        </div>

        {/* Export & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Live Edit Mode Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (isLiveEditMode) {
                onSaveQuotation(currentQuote);
                setSaveToast(true);
                setTimeout(() => setSaveToast(false), 3500);
              }
              setIsLiveEditMode(!isLiveEditMode);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition cursor-pointer ${
              isLiveEditMode
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300 animate-pulse font-black'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title={isEn ? 'Click to edit any text or numbers directly' : 'اضغط لتعديل أي كلمة أو رقم أو بند في عرض السعر مباشرة وعند إلغاء التفعيل يتم تثبيت التعديل وحفظه'}
          >
            {isLiveEditMode ? (
              <>
                <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>{isEn ? '💾 Save & Lock' : '💾 حفظ وتثبيت التعديل (Save & Lock)'}</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 text-amber-300" />
                <span>{isEn ? '✏️ Live Edit Mode' : '✏️ وضع التعديل المباشر (Live Edit)'}</span>
              </>
            )}
          </button>

          {/* Commercial Proposal (4 Pages) Corporate Template */}
          <button
            type="button"
            onClick={() => setShowCommercialProposal(true)}
            className="px-3.5 py-2 text-xs font-bold bg-[#102a43] hover:bg-[#1e3a8a] text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            title="معاينة وطباعة العرض التجاري المعتمد (نموذج الـ 4 صفحات الرسمي لمؤسسة صناع الموارد)"
          >
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>{isEn ? 'Commercial Proposal (4 Pages)' : 'العرض التجاري المعتمد (4 صفحات)'}</span>
          </button>

          {/* Word Export Button */}
          <button
            type="button"
            disabled={isLocked('export-word')}
            onClick={() => {
              runWithLock('export-word', async () => {
                await exportQuotationToWord(currentQuote);
              });
            }}
            className={`px-3.5 py-2 text-xs font-bold bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg shadow-xs flex items-center gap-1.5 transition ${
              isLocked('export-word') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Export to authentic Word document with official RMT letterhead"
          >
            <FileText className="w-4 h-4 text-emerald-200" />
            <span>{isLocked('export-word') ? (isEn ? 'Preparing Word...' : 'جاري تجهيز Word...') : (isEn ? '🟢 Export Word (DOCX)' : '🟢 تصدير Word (DOCX)')}</span>
          </button>

          {/* PDF Export Button */}
          <button
            type="button"
            disabled={isLocked('export-pdf')}
            onClick={() => {
              runWithLock('export-pdf', async () => {
                await exportQuotationToPDF(currentQuote);
              });
            }}
            className={`px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition ${
              isLocked('export-pdf') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Print or Save as PDF with exact official letterhead"
          >
            <Printer className="w-4 h-4 text-rose-200" />
            <span>{isLocked('export-pdf') ? (isEn ? 'Preparing PDF...' : 'جاري تجهيز الطباعة...') : (isEn ? '🔴 Export PDF / Print' : '🔴 تصدير PDF / طباعة')}</span>
          </button>

          {/* Excel Export Button */}
          <button
            type="button"
            disabled={isLocked('export-excel')}
            onClick={() => {
              runWithLock('export-excel', async () => {
                exportQuotationToExcel(currentQuote);
              });
            }}
            className={`px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition ${
              isLocked('export-excel') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title="Export to Excel with BOQ & internal costing breakdown"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-200" />
            <span>{isLocked('export-excel') ? (isEn ? 'Preparing Excel...' : 'جاري تجهيز Excel...') : (isEn ? '🔵 Export Excel (XLSX)' : '🔵 تصدير Excel (XLSX)')}</span>
          </button>

          {/* WhatsApp Direct Share Button */}
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            className="px-3.5 py-2 text-xs font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            title="إرسال ملخص العرض وبيانات التسعير مباشرة للعميل عبر الواتساب"
          >
            <MessageCircle className="w-4 h-4 text-white fill-white/20" />
            <span>{isEn ? '🟢 Send via WhatsApp' : '🟢 إرسال عبر واتساب (WhatsApp)'}</span>
          </button>

          {/* Create New Version Button */}
          <button
            type="button"
            onClick={() => setShowVersionModal(true)}
            className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>{isEn ? 'Save as Version' : 'حفظ كإصدار جديد'}</span>
          </button>
        </div>
      </div>

      {/* Save Success Toast */}
      {saveToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-700 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-3 border border-emerald-500">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <div>
            <p className="font-extrabold text-white text-sm">
              {isEn ? 'Changes successfully saved & locked!' : 'تم تثبيت وحفظ التعديلات بنجاح!'}
            </p>
            <p className="text-emerald-100 font-normal text-[11px]">
              {isEn ? 'Calculations, data and exports updated automatically.' : 'تم تحديث البيانات، الحسابات، وصيغ التصدير تلقائياً.'}
            </p>
          </div>
        </div>
      )}

      {/* Dynamic Variable Profit Margin Engine (Interactive Top Bar) */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-[#0B2545] to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-xl border border-slate-700/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white tracking-wide">
                  {isEn ? 'Dynamic Variable Profit Margin Engine' : 'محرك هامش الربح المتغير الفوري'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold">
                  {currentQuote.pricingMode === 'gross_margin'
                    ? (isEn ? 'Gross Margin Mode' : 'وضع هامش الربح %')
                    : currentQuote.pricingMode === 'markup'
                    ? (isEn ? 'Markup Mode' : 'وضع نسبة الإضافة %')
                    : currentQuote.pricingMode === 'fixed'
                    ? (isEn ? 'Target Price Mode' : 'وضع السعر المستهدف')
                    : (isEn ? 'Item-Specific Mode' : 'وضع تسعير البنود')}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {isEn
                  ? 'Adjust your profit margins and selling prices in real-time across all items and export formats.'
                  : 'تعديل مرن ومباشر لهوامش الأرباح وأسعار البيع بنقرة واحدة وفق رغبتك في أي وقت.'}
              </p>
            </div>
          </div>

          {/* Quick Mode Buttons */}
          <div className="flex items-center bg-white/10 p-1 rounded-xl border border-white/15 backdrop-blur-xs text-xs">
            <button
              type="button"
              onClick={() => handleUpdateMarginPercent(currentQuote.overallTargetMarginPercent || 20)}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                currentQuote.pricingMode === 'gross_margin'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              <span>{isEn ? 'Gross Margin %' : 'هامش الربح % (Margin)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleUpdateMarkupPercent(currentQuote.overallMarkupPercent || 25)}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                currentQuote.pricingMode === 'markup'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              <span>{isEn ? 'Markup %' : 'نسبة الإضافة % (Markup)'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Variable Margin Interactive Slider & Input Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Slider & Presets (7 cols) */}
          <div className="lg:col-span-7 space-y-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                {currentQuote.pricingMode === 'gross_margin'
                  ? (isEn ? 'Variable Gross Margin:' : 'تحديد هامش الربح المتغير (Gross Margin):')
                  : (isEn ? 'Variable Markup on Cost:' : 'تحديد نسبة الإضافة على التكلفة (Markup %):')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="95"
                  step="0.5"
                  value={
                    currentQuote.pricingMode === 'gross_margin'
                      ? currentQuote.overallTargetMarginPercent
                      : currentQuote.overallMarkupPercent
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (currentQuote.pricingMode === 'gross_margin') {
                      handleUpdateMarginPercent(val);
                    } else {
                      handleUpdateMarkupPercent(val);
                    }
                  }}
                  className="w-20 px-2 py-1 bg-slate-900 border border-emerald-500/60 rounded-lg text-emerald-300 font-mono font-black text-right text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <span className="font-bold text-emerald-400 font-mono">%</span>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="0"
              max={currentQuote.pricingMode === 'gross_margin' ? 80 : 120}
              step="0.5"
              value={
                currentQuote.pricingMode === 'gross_margin'
                  ? currentQuote.overallTargetMarginPercent
                  : currentQuote.overallMarkupPercent
              }
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                if (currentQuote.pricingMode === 'gross_margin') {
                  handleUpdateMarginPercent(val);
                } else {
                  handleUpdateMarkupPercent(val);
                }
              }}
              className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-700 rounded-lg appearance-none"
            />

            {/* Quick 1-Click Variable Margin Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-bold ml-1">{isEn ? 'Quick Presets:' : 'هوامش سريعة:'}</span>
              {[5, 10, 15, 20, 25, 30, 35, 40, 50].map((preset) => {
                const isSelected =
                  currentQuote.pricingMode === 'gross_margin'
                    ? Math.round(currentQuote.overallTargetMarginPercent) === preset
                    : Math.round(currentQuote.overallMarkupPercent) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      if (currentQuote.pricingMode === 'gross_margin') {
                        handleUpdateMarginPercent(preset);
                      } else {
                        handleUpdateMarkupPercent(preset);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-400 text-slate-950 shadow-sm ring-1 ring-emerald-300'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {preset}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Target Selling / Net Profit Solvers (5 cols) */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-2 bg-white/5 p-3.5 rounded-xl border border-white/10 text-xs">
            <div>
              <label className="block text-[11px] text-slate-300 font-bold mb-1">
                {isEn ? 'Target Selling (SAR)' : 'سعر بيع مستهدف (SAR)'}
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder={currentQuote.totals.customerSellingPrice.toString()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    if (val > 0) handleUpdateTargetSellingPrice(val);
                  }
                }}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val > 0) handleUpdateTargetSellingPrice(val);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-300 font-bold mb-1">
                {isEn ? 'Target Net Profit (SAR)' : 'ربح صافي مستهدف (SAR)'}
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder={currentQuote.totals.grossProfit.toString()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    if (val >= 0) handleUpdateTargetProfitSAR(val);
                  }
                }}
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  if (val >= 0) handleUpdateTargetProfitSAR(val);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-emerald-300 font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-400 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Live KPI Financial Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1 text-center font-mono">
          <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
            <span className="block text-[10px] text-slate-400 font-sans">{isEn ? 'Total Project Cost' : 'التكلفة الإجمالية'}</span>
            <span className="text-xs sm:text-sm font-bold text-slate-200">
              {currentQuote.totals.totalProjectCost.toLocaleString()} SAR
            </span>
          </div>

          <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
            <span className="block text-[10px] text-slate-400 font-sans">{isEn ? 'Selling (excl. VAT)' : 'سعر البيع (قبل الضريبة)'}</span>
            <span className="text-xs sm:text-sm font-black text-emerald-400">
              {currentQuote.totals.customerSellingPrice.toLocaleString()} SAR
            </span>
          </div>

          <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
            <span className="block text-[10px] text-slate-400 font-sans">{isEn ? 'Net Profit' : 'صافي الأرباح'}</span>
            <span className="text-xs sm:text-sm font-black text-amber-300">
              +{currentQuote.totals.grossProfit.toLocaleString()} SAR
            </span>
          </div>

          <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
            <span className="block text-[10px] text-slate-400 font-sans">{isEn ? 'Margin / Markup' : 'الهامش / الإضافة'}</span>
            <span className="text-xs sm:text-sm font-black text-sky-300">
              {currentQuote.totals.grossMarginPercent.toFixed(1)}% / {currentQuote.overallMarkupPercent.toFixed(1)}%
            </span>
          </div>

          <div className="bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-500/40 col-span-2 sm:col-span-1">
            <span className="block text-[10px] text-emerald-300 font-sans">{isEn ? 'Grand Total (with VAT)' : 'الإجمالي مع الضريبة 15%'}</span>
            <span className="text-xs sm:text-sm font-black text-white">
              {currentQuote.totals.grandTotalWithVat.toLocaleString()} SAR
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="no-print flex border-b border-slate-200 text-xs font-bold text-slate-600 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'preview'
              ? 'border-[#007A5A] text-[#007A5A]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isEn ? 'Official Proposal Letterhead' : 'المعاينة الرسمية (Official Proposal Letterhead)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pricing')}
          className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'pricing'
              ? 'border-[#007A5A] text-[#007A5A]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>{isEn ? 'Pricing, Costs & Margins' : 'التسعير وهامش الربح والتكاليف (Pricing & Margins)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('systems_terms')}
          className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'systems_terms'
              ? 'border-[#007A5A] text-[#007A5A]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isEn ? 'Systems & Terms Library' : 'الأنظمة والشروط والأحكام (Systems & Terms Library)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('versions')}
          className={`py-3 px-4 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'versions'
              ? 'border-[#007A5A] text-[#007A5A]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{isEn ? 'Version Control' : 'سجل الإصدارات (Version Control)'}</span>
          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full font-mono text-[10px]">
            {currentQuote.versionHistory?.length || 1}
          </span>
        </button>
      </div>

      {/* TAB 1: OFFICIAL LETTERHEAD PREVIEW (EXACT USER FORMAT) */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          {/* Live Edit Mode Alert Banner */}
          {isLiveEditMode && (
            <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl flex items-center justify-between text-amber-950 text-xs">
              <div className="flex items-center gap-3">
                <Edit3 className="w-5 h-5 text-amber-600 animate-bounce" />
                <div>
                  <p className="font-bold text-sm">وضع التعديل المباشر مفعل الآن (Live Edit Mode Active)</p>
                  <p className="text-amber-800">
                    يمكنك تعديل أي كلمة، رقم، سعر بند، أو شرط مباشرة داخل نموذج عرض السعر أدناه.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSaveQuotation(currentQuote);
                  setIsLiveEditMode(false);
                  setSaveToast(true);
                  setTimeout(() => setSaveToast(false), 3500);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-lg text-xs shadow-xs"
              >
                تثبيت وحفظ التعديلات الآن ✓
              </button>
            </div>
          )}

          <OfficialLetterhead>
            {/* Title */}
            <div className="text-center my-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 underline decoration-slate-400 decoration-1 underline-offset-4">
                Commercial Proposal
              </h1>
            </div>

            {/* Proposal Details Table (Page 1 in user's doc) */}
            <div className="border border-slate-300 rounded-xs overflow-hidden mb-6 text-xs sm:text-sm">
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Scope of Work
                </div>
                <div className="col-span-2 p-2.5 text-slate-900">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.scopeOfWork || cleanScopeOfWork}
                      onChange={(e) => handleUpdateQuoteField('scopeOfWork', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-medium text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    cleanScopeOfWork
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  System Definition
                </div>
                <div className="col-span-2 p-2.5 text-slate-900">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.systemDefinition || cleanSystemDefinition}
                      onChange={(e) => handleUpdateQuoteField('systemDefinition', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-medium text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    cleanSystemDefinition
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Project Name
                </div>
                <div className="col-span-2 p-2.5 text-slate-900 font-semibold">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.projectName}
                      onChange={(e) => handleUpdateQuoteField('projectName', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-bold text-xs focus:ring-1 focus:ring-amber-500 outline-none text-[#007A5A]"
                    />
                  ) : (
                    currentQuote.projectName
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Project location
                </div>
                <div className="col-span-2 p-2.5 text-slate-900">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.projectLocation}
                      onChange={(e) => handleUpdateQuoteField('projectLocation', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.projectLocation
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Clients Name
                </div>
                <div className="col-span-2 p-2.5 text-slate-900 font-semibold">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.clientName}
                      onChange={(e) => handleUpdateQuoteField('clientName', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-semibold text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.clientName
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Attn. Name
                </div>
                <div className="col-span-2 p-2.5 text-slate-900 font-semibold">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.attnName}
                      onChange={(e) => handleUpdateQuoteField('attnName', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-semibold text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.attnName
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Proposal #
                </div>
                <div className="col-span-2 p-2.5 font-mono font-bold text-[#007A5A]">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.quotationNumber}
                      onChange={(e) => handleUpdateQuoteField('quotationNumber', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-mono font-bold text-xs focus:ring-1 focus:ring-amber-500 outline-none text-[#007A5A]"
                    />
                  ) : (
                    currentQuote.quotationNumber
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Initiated By
                </div>
                <div className="col-span-2 p-2.5 text-slate-900">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.initiatedBy || corporate.engineerName}
                      onChange={(e) => handleUpdateQuoteField('initiatedBy', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.initiatedBy || corporate.engineerName
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Date
                </div>
                <div className="col-span-2 p-2.5 text-slate-900 font-mono">
                  {isLiveEditMode ? (
                    <input
                      type="date"
                      value={currentQuote.date}
                      onChange={(e) => handleUpdateQuoteField('date', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-mono text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.date
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3">
                <div className="bg-slate-100/80 font-bold p-2.5 text-slate-700 border-r border-slate-200">
                  Validity
                </div>
                <div className="col-span-2 p-2.5 text-slate-900">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.validity || '15 Days'}
                      onChange={(e) => handleUpdateQuoteField('validity', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.validity || '15 Days'
                  )}
                </div>
              </div>
            </div>

            {/* Proposal Confidentiality Block */}
            <div className="my-6 space-y-2 text-xs text-slate-700">
              <h3 className="font-bold underline text-slate-900 text-sm">
                Proposal Confidentiality:
              </h3>
              <p className="leading-relaxed text-justify text-slate-600">
                THIS DOCUMENT CONTAINS TRADE RESOURCE MAKERS - RESOURCE MAKERS TRADING EST. ({corporate.nameAr}) CONFIDENTIAL
                AND PROPRIETARY INFORMATION AND IS SUPPLIED TO ALLOW THE CLIENT/CONCERNED PARTIES TO MAKE
                AN EVALUATION OF RESOURCE MAKERS AS A CANDIDATE FOR THE DELIVERY OF PREVIOUSLY MENTIONED
                SERVICES. THIS DOCUMENT (INCLUDING ANY PART THEREOF) IS NOT TO BE DISCLOSED OR REPRODUCED
                OR DISTRIBUTED IN ANY FORM OR BY ANY MEANS, OR STORED IN A DATABASE OR RETRIEVAL SYSTEM, OR
                TRANSFERRED OUTSIDE YOUR ORGANIZATION WITHOUT PRIOR WRITTEN CONSENT FROM THE
                AUTHORIZED REPRESENTATIVE AT RESOURCE MAKERS C.
              </p>
              <p className="font-bold text-slate-800 text-[11px] pt-1">
                © ALL RIGHTS RESERVED TO TRADE RESOURCE MAKERS – AL KHOBAR / SAUDI ARABIA
              </p>
            </div>

            {/* Engineer Contact Box - Centered Horizontally in Middle of Page 1 */}
            <div className="border-2 border-[#007A5A]/40 rounded-lg overflow-hidden max-w-lg my-8 mx-auto text-xs shadow-xs bg-white">
              <div className="bg-[#007A5A]/10 px-3 py-1.5 border-b border-[#007A5A]/30 flex items-center justify-between text-[#007A5A] font-bold text-[11px]">
                <span>Contact Person & Proposal Preparation Engineer</span>
                <span>Trade Resource Makers</span>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2 text-slate-700 border-r border-slate-200 flex items-center">
                  Name
                </div>
                <div className="col-span-2 p-2 font-bold text-slate-900">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.issuerDetails?.name ?? currentQuote.initiatedBy ?? corporate.engineerName}
                      onChange={(e) => handleUpdateIssuerField('name', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-bold text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.issuerDetails?.name || currentQuote.initiatedBy || corporate.engineerName
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2 text-slate-700 border-r border-slate-200 flex items-center">
                  Position
                </div>
                <div className="col-span-2 p-2 text-slate-900">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.issuerDetails?.title ?? corporate.engineerTitle}
                      onChange={(e) => handleUpdateIssuerField('title', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.issuerDetails?.title || corporate.engineerTitle
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2 text-slate-700 border-r border-slate-200 flex items-center">
                  E-mail
                </div>
                <div className="col-span-2 p-2 text-sky-700 font-medium">
                  {isLiveEditMode ? (
                    <input
                      type="email"
                      value={currentQuote.issuerDetails?.email ?? corporate.engineerEmail}
                      onChange={(e) => handleUpdateIssuerField('email', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded text-sky-700 font-medium text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.issuerDetails?.email || corporate.engineerEmail
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="bg-slate-100/80 font-bold p-2 text-slate-700 border-r border-slate-200 flex items-center">
                  Tel
                </div>
                <div className="col-span-2 p-2 text-slate-900 font-mono">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.issuerDetails?.phone ?? corporate.phone}
                      onChange={(e) => handleUpdateIssuerField('phone', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-mono text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.issuerDetails?.phone || corporate.phone
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3">
                <div className="bg-slate-100/80 font-bold p-2 text-slate-700 border-r border-slate-200 flex items-center">
                  Mob
                </div>
                <div className="col-span-2 p-2 text-slate-900 font-mono">
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.issuerDetails?.mobile ?? (corporate.mobiles || []).join(' - ')}
                      onChange={(e) => handleUpdateIssuerField('mobile', e.target.value)}
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/50 rounded font-mono text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    currentQuote.issuerDetails?.mobile || (corporate.mobiles || []).slice(0, 2).join(' – ')
                  )}
                </div>
              </div>
            </div>

            <div className="page-break my-8 border-t-2 border-dashed border-slate-200" />

            {/* Page 2: 1.0 Total System Price */}
            <div className="space-y-4 pt-4">
              <h2 className="text-base font-bold text-slate-900">
                1.0 Total System Price:
              </h2>
              <div className="text-xs text-slate-800 space-y-1.5 leading-relaxed">
                <p className="font-semibold">Dear {currentQuote.attnName || 'Valued Client'},</p>
                <p>
                  Thank you for reaching out with your inquiry. Referring to your request for the{' '}
                  <span className="font-semibold">{cleanScopeOfWork}</span> at the project
                  located in <span className="font-semibold">{currentQuote.projectLocation}</span>,
                  we are pleased to provide you with our quotation. It includes our best pricing,
                  terms, and all required details as listed below:
                </p>
              </div>

              {/* BOQ Items Table with Pictures & Positioning */}
              <div className="border border-slate-300 rounded-xs overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5 w-12 text-center border-r border-slate-300">Item</th>
                      <th className="p-2.5 border-r border-slate-300">Description</th>
                      <th className="p-2.5 w-20 text-center border-r border-slate-300">Qty</th>
                      <th className="p-2.5 w-28 text-center border-r border-slate-300">Unit Price (SAR)</th>
                      <th className="p-2.5 w-32 text-right">Total (SAR)</th>
                      {isLiveEditMode && <th className="p-2.5 w-10 text-center">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {sections.map((section, sIdx) => (
                      <React.Fragment key={section.systemKey}>
                        {/* Section Divider Banner */}
                        <tr className="bg-slate-100 font-bold border-y-2 border-slate-300">
                          <td colSpan={isLiveEditMode ? 6 : 5} className="p-2.5 bg-slate-100 text-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs uppercase tracking-wide text-slate-900 font-extrabold">
                                Section {sIdx + 1}: {section.sectionTitleEn}
                              </span>
                              <span className="text-xs text-slate-600 font-bold">
                                {section.sectionTitleAr}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Section Items with isolated sequential numbering */}
                        {section.items.map((item, itemIdx) => {
                          const currentIdx = itemIdx + 1;
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="p-2.5 text-center font-mono font-bold text-slate-500 border-r border-slate-300">
                                {currentIdx}
                              </td>
                              <td className="p-2.5 border-r border-slate-300 space-y-1.5">
                                {isLiveEditMode ? (
                                  <div className="space-y-1.5">
                                    <input
                                      type="text"
                                      value={item.description}
                                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                      className="w-full p-1.5 border border-amber-400 bg-amber-50/40 rounded font-medium text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                                      placeholder="Item Description..."
                                    />
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <input
                                        type="text"
                                        value={item.manufacturer || ''}
                                        onChange={(e) => handleUpdateItem(item.id, 'manufacturer', e.target.value)}
                                        className="p-1 border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-amber-500 outline-none"
                                        placeholder="Brand / Manufacturer"
                                      />
                                      <input
                                        type="text"
                                        value={item.model || ''}
                                        onChange={(e) => handleUpdateItem(item.id, 'model', e.target.value)}
                                        className="p-1 border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-amber-500 outline-none"
                                        placeholder="Model #"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-medium text-slate-900">{item.description}</p>
                                    {(item.manufacturer || item.model) && (
                                      <p className="text-[11px] text-slate-500">
                                        {item.manufacturer && <span>Brand: {item.manufacturer} </span>}
                                        {item.model && <span>| Model: {item.model}</span>}
                                      </p>
                                    )}
                                  </>
                                )}

                                {/* Item Picture Section */}
                                <div className="pt-1 flex items-center gap-2">
                                  {item.pictureUrl ? (
                                    <div className="relative group inline-block border border-slate-300 rounded p-1 bg-white">
                                      <img
                                        src={item.pictureUrl}
                                        alt={item.description}
                                        className="w-16 h-16 object-contain rounded"
                                      />
                                      <div className="no-print absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition rounded">
                                        <label
                                          htmlFor={`replace-img-${item.id}`}
                                          className="p-1 bg-white text-slate-800 rounded text-[10px] cursor-pointer hover:bg-slate-100"
                                          title="Replace Image"
                                        >
                                          Replace
                                        </label>
                                        <input
                                          id={`replace-img-${item.id}`}
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => handleItemImageUpload(item.id, e)}
                                          className="hidden"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveItemImage(item.id)}
                                          className="p-1 bg-red-600 text-white rounded text-[10px] hover:bg-red-700"
                                          title="Delete Image"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="no-print">
                                      <label
                                        htmlFor={`upload-img-${item.id}`}
                                        className="cursor-pointer text-[10px] text-slate-400 hover:text-[#007A5A] flex items-center gap-1 border border-dashed border-slate-300 hover:border-[#007A5A] px-2 py-1 rounded"
                                      >
                                        <ImageIcon className="w-3 h-3" />
                                        <span>+ Add Item Photo (إضافة صورة للبند)</span>
                                      </label>
                                      <input
                                        id={`upload-img-${item.id}`}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleItemImageUpload(item.id, e)}
                                        className="hidden"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 text-center font-mono border-r border-slate-300">
                                {isLiveEditMode ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                                      className="w-14 p-1 text-center font-mono border border-amber-400 bg-amber-50/40 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                    <input
                                      type="text"
                                      value={item.unit || 'pcs'}
                                      onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                                      className="w-10 p-1 text-center font-mono border border-slate-300 rounded text-[11px] focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                  </div>
                                ) : (
                                  `${item.quantity} ${item.unit}`
                                )}
                              </td>
                              <td className="p-2.5 text-center font-mono border-r border-slate-300 text-slate-700">
                                {isLiveEditMode ? (
                                  <input
                                    type="number"
                                    step="0.25"
                                    value={item.sellingUnitPrice}
                                    onChange={(e) => handleUpdateItem(item.id, 'sellingUnitPrice', Number(e.target.value))}
                                    className="w-24 p-1 text-right font-mono font-bold border border-amber-400 bg-amber-50/40 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none text-[#007A5A]"
                                  />
                                ) : (
                                  snapToQuarter(item.sellingUnitPrice).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                {snapToQuarter(item.sellingTotalPrice).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              {isLiveEditMode && (
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePreviewItem(item.id)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Delete Item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {/* Section Subtotal Row */}
                        <tr className="bg-slate-50 font-bold border-b border-slate-300 text-slate-700">
                          <td colSpan={isLiveEditMode ? 4 : 4} className="p-2 text-right border-r border-slate-300 text-xs">
                            Subtotal - {section.sectionTitleEn} (SAR):
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-[#007A5A] text-xs">
                            {snapToQuarter(section.subtotalSellingPrice).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          {isLiveEditMode && <td />}
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
                    {sections.length > 1 && (
                      <tr className="bg-slate-200/80 font-bold border-t border-slate-300">
                        <td colSpan={isLiveEditMode ? 6 : 5} className="p-2 text-slate-800 text-[11px] font-bold uppercase tracking-wider">
                          Executive Financial Summary & Section Breakdown
                        </td>
                      </tr>
                    )}
                    {sections.length > 1 && sections.map((sec, idx) => (
                      <tr key={sec.systemKey} className="bg-slate-50/50 text-xs border-b border-slate-200">
                        <td colSpan={isLiveEditMode ? 4 : 4} className="p-2 text-right border-r border-slate-300 text-slate-700 font-medium">
                          Section {idx + 1}: {sec.sectionTitleEn} ({sec.sectionTitleAr})
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-800">
                          {snapToQuarter(sec.subtotalSellingPrice).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        {isLiveEditMode && <td />}
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={isLiveEditMode ? 4 : 4} className="p-2.5 text-right border-r border-slate-300">
                        Total Subtotal (SAR)
                      </td>
                      <td className="p-2.5 text-right font-mono text-base text-[#007A5A]">
                        {snapToQuarter(currentQuote.totals.customerSellingPrice).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {isLiveEditMode && <td />}
                    </tr>
                    <tr>
                      <td colSpan={isLiveEditMode ? 4 : 4} className="p-2.5 text-right border-r border-slate-300 text-slate-600">
                        Value Added Tax (15% VAT)
                      </td>
                      <td className="p-2.5 text-right font-mono text-sm text-slate-700">
                        {snapToQuarter(currentQuote.totals.vatAmount).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {isLiveEditMode && <td />}
                    </tr>
                    <tr className="bg-emerald-50 text-[#007A5A] text-sm">
                      <td colSpan={isLiveEditMode ? 4 : 4} className="p-2.5 text-right border-r border-slate-300 font-extrabold">
                        Grand Total (SAR)
                      </td>
                      <td className="p-2.5 text-right font-mono font-extrabold text-base text-[#007A5A]">
                        {snapToQuarter(currentQuote.totals.grandTotalWithVat).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      {isLiveEditMode && <td />}
                    </tr>
                  </tfoot>
                </table>

                {/* Add Item Button in Live Edit Mode */}
                {isLiveEditMode && (
                  <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
                    <button
                      type="button"
                      onClick={handleAddPreviewItem}
                      className="text-xs font-bold text-[#007A5A] hover:text-[#0c6b4f] flex items-center justify-center gap-1.5 mx-auto hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة بند جديد إلى جدول الكميات (Add BOQ Item)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Terms & Conditions Block */}
              <div className="pt-4 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#007A5A]"></span>
                    Terms & Conditions (الشروط والأحكام):
                  </h3>
                  {isLiveEditMode && (
                    <button
                      type="button"
                      onClick={() => {
                        const standardized = standardizeQuotationTermsToEnglish(currentQuote.terms);
                        const updated = {
                          ...currentQuote,
                          terms: standardized,
                          updatedAt: new Date().toISOString(),
                        };
                        setCurrentQuote(updated);
                        onSaveQuotation(updated);
                      }}
                      className="text-[11px] font-bold text-[#007A5A] hover:bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1 transition"
                      title="توحيد وترجمة الشروط إلى الإنجليزية الهندسية القياسية"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>توحيد الشروط بالإنجليزية (Standardize English)</span>
                    </button>
                  )}
                </div>

                {/* 1.1 The above Price Includes (by RM) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs">
                      1.1 The above Price Includes (by RM):
                    </h4>
                    {isLiveEditMode && (
                      <button
                        type="button"
                        onClick={() => handleAddTerm('includes', 'Supply scope of work as per approved technical submittal.')}
                        className="text-[11px] font-bold text-[#007A5A] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> إضافة بند مشمول
                      </button>
                    )}
                  </div>
                  {isLiveEditMode ? (
                    <div className="space-y-1.5">
                      {(currentQuote.terms?.includes || []).map((inc, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[#007A5A] font-bold">•</span>
                          <input
                            type="text"
                            value={inc}
                            onChange={(e) => handleUpdateTerm('includes', i, e.target.value)}
                            className="flex-1 p-1.5 border border-amber-400 bg-amber-50/40 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteTerm('includes', i)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="حذف هذا البند"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-1.5 text-slate-700">
                      {(currentQuote.terms?.includes || []).map((inc, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                          <span className="text-[#007A5A] font-black text-sm leading-none mt-0.5">•</span>
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 1.2 The above Price excludes (by Client) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs">
                      1.2 The above Price Excludes (by Client):
                    </h4>
                    {isLiveEditMode && (
                      <button
                        type="button"
                        onClick={() => handleAddTerm('excludes', 'Civil works and penetrations (by Client).')}
                        className="text-[11px] font-bold text-[#007A5A] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> إضافة بند مستثنى
                      </button>
                    )}
                  </div>
                  {isLiveEditMode ? (
                    <div className="space-y-1.5">
                      {(currentQuote.terms?.excludes || []).map((exc, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[#007A5A] font-bold">•</span>
                          <input
                            type="text"
                            value={exc}
                            onChange={(e) => handleUpdateTerm('excludes', i, e.target.value)}
                            className="flex-1 p-1.5 border border-amber-400 bg-amber-50/40 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteTerm('excludes', i)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="حذف هذا البند"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-1.5 text-slate-700">
                      {(currentQuote.terms?.excludes || []).map((exc, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                          <span className="text-[#007A5A] font-black text-sm leading-none mt-0.5">•</span>
                          <span>{exc}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 2.0 Payment Terms */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs">2.0 Payment Terms:</h4>
                    {isLiveEditMode && (
                      <button
                        type="button"
                        onClick={() => handleAddTerm('paymentTerms', '30% Advance payment upon order confirmation.')}
                        className="text-[11px] font-bold text-[#007A5A] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> إضافة شرط دفع
                      </button>
                    )}
                  </div>
                  {isLiveEditMode ? (
                    <div className="space-y-1.5">
                      {(currentQuote.terms?.paymentTerms || []).map((pt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[#007A5A] font-bold">•</span>
                          <input
                            type="text"
                            value={pt}
                            onChange={(e) => handleUpdateTerm('paymentTerms', i, e.target.value)}
                            className="flex-1 p-1.5 border border-amber-400 bg-amber-50/40 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteTerm('paymentTerms', i)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="حذف هذا الشرط"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-1.5 text-slate-700">
                      {(currentQuote.terms?.paymentTerms || []).map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                          <span className="text-[#007A5A] font-black text-sm leading-none mt-0.5">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 2.1 Proposal Validity */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5">
                  <h4 className="font-bold text-slate-900 text-xs">2.1 Proposal Validity:</h4>
                  {isLiveEditMode ? (
                    <input
                      type="text"
                      value={currentQuote.terms?.validity || '15 Days from date of quotation issuance'}
                      onChange={(e) =>
                        handleUpdateQuoteField('terms', {
                          ...currentQuote.terms,
                          validity: e.target.value,
                        })
                      }
                      className="w-full p-1.5 border border-amber-400 bg-amber-50/40 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  ) : (
                    <p className="text-slate-700 text-[11.5px] font-medium pl-3">
                      {currentQuote.terms?.validity || '15 Days from date of quotation issuance'}
                    </p>
                  )}
                </div>

                {/* 2.2 Notes & Assumptions */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs">2.2 Notes & Technical Assumptions:</h4>
                    {isLiveEditMode && (
                      <button
                        type="button"
                        onClick={() => handleAddTerm('notes', 'Prices are quoted in SAR and subject to 15% VAT.')}
                        className="text-[11px] font-bold text-[#007A5A] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> إضافة ملاحظة
                      </button>
                    )}
                  </div>
                  {isLiveEditMode ? (
                    <div className="space-y-1.5">
                      {(currentQuote.terms?.notes || []).map((n, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[#007A5A] font-bold">•</span>
                          <input
                            type="text"
                            value={n}
                            onChange={(e) => handleUpdateTerm('notes', i, e.target.value)}
                            className="flex-1 p-1.5 border border-amber-400 bg-amber-50/40 rounded text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteTerm('notes', i)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="حذف هذه الملاحظة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-1.5 text-slate-700">
                      {(currentQuote.terms?.notes || []).map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed">
                          <span className="text-[#007A5A] font-black text-sm leading-none mt-0.5">•</span>
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-4 text-center text-slate-800 font-semibold">
                  <p>Please don't hesitate to contact us for any clarification.</p>
                  <p className="mt-1 font-bold">Best Regards,</p>
                </div>

                {/* Official Signatures & Acceptance Block */}
                <div className="mt-6 pt-4 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                  <SignatureBox
                    roleKey="projects_manager"
                    personName={currentQuote.initiatedBy || corporate.engineerName}
                    personTitle={corporate.engineerTitle}
                    label="Prepared & Submitted By"
                    placeholderText="توقيع المهندس المسؤول"
                    heightClass="h-14"
                  />
                  <SignatureBox
                    roleKey="general_manager"
                    personName="Executive Management"
                    personTitle={corporate.nameAr}
                    label="Approved By"
                    placeholderText="توقيع الإدارة العامة"
                    heightClass="h-14"
                  />
                  <SignatureBox
                    roleKey={`quote_client_${currentQuote.id}`}
                    personName={currentQuote.attnName || currentQuote.clientName || 'Client Representative'}
                    personTitle="Authorized Client Acceptance & Stamp"
                    label="Client Acceptance & Stamp"
                    placeholderText="توقيع وختم تعميد العميل"
                    heightClass="h-14"
                  />
                </div>
              </div>
            </div>
          </OfficialLetterhead>
        </div>
      )}

      {/* TAB 2: PRICING & MARGIN ANALYSIS (ENGINEERING CORE) */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          {/* AI Pricing Command Bar */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-4 rounded-xl text-white shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                مساعد التسعير الذكي (Natural Language Pricing & Markup AI)
              </h3>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              اكتب أمر التسعير باللغة العربية أو الإنجليزية لتحديث هامش الربح وتكاليف المشروع فوراً
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiCommand}
                onChange={(e) => setAiCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunAiCommand()}
                placeholder='مثال: "سعرها للعميل بزيادة 25%" أو "أبغاها بهامش ربح 20%" أو "ضيف 10,000 تركيب و 3,000 نقل"...'
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                type="button"
                onClick={handleRunAiCommand}
                disabled={isAiLoading}
                className="px-4 py-2 bg-[#007A5A] hover:bg-[#0da077] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isAiLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>تطبيق الأمر</span>
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
              <span className="text-white/60 self-center">أوامر سريعة:</span>
              <button
                type="button"
                onClick={() => setAiCommand('سعرها للعميل بزيادة 25%')}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-emerald-200 border border-white/10"
              >
                "سعرها للعميل بزيادة 25%"
              </button>
              <button
                type="button"
                onClick={() => setAiCommand('أبغاها بهامش ربح 20%')}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-emerald-200 border border-white/10"
              >
                "أبغاها بهامش ربح 20%"
              </button>
              <button
                type="button"
                onClick={() => setAiCommand('ضيف 10,000 تركيب و 3,000 نقل')}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-emerald-200 border border-white/10"
              >
                "ضيف 10,000 تركيب و 3,000 نقل"
              </button>
            </div>

            {aiMessage && (
              <div className="mt-3 p-2 bg-emerald-500/20 border border-emerald-400/30 rounded text-xs text-emerald-100 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>{aiMessage}</span>
              </div>
            )}
          </div>

          {/* Pricing Master KPI Dashboard (User's Exact Formula) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                1. Supplier Cost (تكلفة المورد) [Excl. VAT]
              </span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                {currentQuote.totals.totalSupplierCost.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}{' '}
                <span className="text-xs text-slate-500 font-sans">SAR [Excl. VAT]</span>
              </p>
              <span className="text-[11px] text-slate-400">Total base equipment supply</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                2. Additional Direct Costs (تكاليف إضافية) [Excl. VAT]
              </span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                +{' '}
                {currentQuote.totals.totalAdditionalCosts.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}{' '}
                <span className="text-xs text-slate-500 font-sans">SAR [Excl. VAT]</span>
              </p>
              <span className="text-[11px] text-slate-400">Installation, transport, T&C, etc.</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 shadow-xs">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                = Total Project Cost (إجمالي التكلفة) [Excl. VAT]
              </span>
              <p className="text-xl font-extrabold font-mono text-slate-900 mt-1">
                {currentQuote.totals.totalProjectCost.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}{' '}
                <span className="text-xs text-slate-500 font-sans">SAR [Excl. VAT]</span>
              </p>
              <span className="text-[11px] text-slate-500">Supplier Cost + Additional Costs</span>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border-2 border-emerald-300 shadow-xs">
              <span className="text-[11px] font-bold text-[#007A5A] uppercase tracking-wider flex items-center justify-between">
                <span>Customer Selling Price (سعر البيع) [Excl. VAT]</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200/60 font-mono">
                  {currentQuote.totals.grossMarginPercent.toFixed(1)}% Margin
                </span>
              </span>
              <p className="text-xl font-extrabold font-mono text-[#007A5A] mt-1">
                {currentQuote.totals.customerSellingPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}{' '}
                <span className="text-xs text-emerald-800 font-sans">SAR [Excl. VAT]</span>
              </p>
              <div className="text-[11px] text-emerald-800 font-semibold mt-0.5 flex justify-between">
                <span>Gross Profit (إجمالي الربح) [Excl. VAT]:</span>
                <span className="font-mono">
                  +{currentQuote.totals.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR [Excl. VAT]
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Controls: Mode, Markups, Cost Playground & Additional Costs Inputs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Card 1: Direct Cost Adjustment & Price Scaling Playground */}
            <div className="bg-white p-5 rounded-2xl border-2 border-sky-200 shadow-xs space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {isEn ? 'Cost Control & Price Scaling' : 'التحكم في التكلفة وأسعار الموردين'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isEn ? 'Adjust base costs, apply discounts, or set target' : 'عدّل تكلفة الشراء، العب بالأسعار، وطبّق الخصومات'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetCostsToBaseline}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  title={isEn ? 'Reset to original baseline costs' : 'استعادة التكاليف الأصلية 100%'}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isEn ? 'Reset' : 'إعادة تعيين'}</span>
                </button>
              </div>

              {/* Live Cost Differential Banner */}
              <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">
                    {isEn ? 'Baseline Cost:' : 'التكلفة الأساسية الأصلية:'}
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    {baselineSupplierCostTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">
                    {isEn ? 'Current Cost:' : 'التكلفة الحالية بعد التعديل:'}
                  </span>
                  <span className="font-mono font-bold text-sky-800">
                    {currentQuote.totals.totalSupplierCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-sky-200/60">
                  <span className="text-[11px] font-bold text-slate-700">
                    {isEn ? 'Cost Variance (Diff):' : 'فرق التكلفة (التوفير / الزيادة):'}
                  </span>
                  <span
                    className={`font-mono font-extrabold text-xs ${
                      costDeltaSAR < 0
                        ? 'text-emerald-700'
                        : costDeltaSAR > 0
                        ? 'text-amber-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {costDeltaSAR > 0 ? '+' : ''}
                    {costDeltaSAR.toLocaleString('en-US', { minimumFractionDigits: 2 })} SAR (
                    {costAdjustmentPercent > 0 ? '+' : ''}
                    {costAdjustmentPercent}%)
                  </span>
                </div>
              </div>

              {/* System Filter for Cost Adjustment */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  {isEn ? 'Scope of Cost Adjustment:' : 'نطاق تعديل التكلفة:'}
                </label>
                <select
                  value={costFilterSystem}
                  onChange={(e) => setCostFilterSystem(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-slate-50 font-medium text-slate-800 focus:bg-white"
                >
                  <option value="all">{isEn ? 'All Project Systems (All Items)' : 'كافة أنظمة وبنود المشروع (الكل)'}</option>
                  {(currentQuote.selectedSystems || []).map((sys) => {
                    const def = getSystemMeta(sys);
                    return (
                      <option key={sys} value={sys}>
                        {isEn ? (def?.nameEn ?? sys) : (def?.nameAr ?? sys)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Cost Scaling Slider & Input */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{isEn ? 'Base Cost Scaling %:' : 'نسبة تعديل التكلفة (+ / - %):'}</span>
                  <span
                    className={`font-mono font-bold ${
                      costAdjustmentPercent < 0
                        ? 'text-emerald-700'
                        : costAdjustmentPercent > 0
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {costAdjustmentPercent > 0 ? '+' : ''}
                    {costAdjustmentPercent}%
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    step="0.5"
                    value={costAdjustmentPercent}
                    onChange={(e) => handleApplyCostAdjustment(Number(e.target.value))}
                    className="flex-1 accent-sky-700 cursor-pointer"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={costAdjustmentPercent}
                      onChange={(e) => handleApplyCostAdjustment(Number(e.target.value))}
                      className="w-16 px-1.5 py-1 text-xs border border-slate-300 rounded font-mono text-center font-bold text-slate-800"
                    />
                    <span className="absolute right-1 top-1 text-[10px] text-slate-400 pointer-events-none">%</span>
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  {isEn ? 'Quick Cost Presets:' : 'خيارات سريعة للتكلفة والخصومات:'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyCostAdjustment(-15)}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[11px] font-bold transition cursor-pointer"
                    title={isEn ? '-15% Strong supplier negotiation' : 'خصم تفاوض قوي -15%'}
                  >
                    -15% {isEn ? 'Negotiate' : 'تفاوض'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCostAdjustment(-10)}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[11px] font-bold transition cursor-pointer"
                    title={isEn ? '-10% Supplier discount' : 'خصم مورد -10%'}
                  >
                    -10% {isEn ? 'Discount' : 'خصم'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCostAdjustment(-5)}
                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[11px] font-bold transition cursor-pointer"
                    title={isEn ? '-5% Volume discount' : 'خصم كميات -5%'}
                  >
                    -5% {isEn ? 'Volume' : 'كميات'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCostAdjustment(0)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded text-[11px] font-bold transition cursor-pointer"
                    title={isEn ? '0% Original Base Cost' : 'التكلفة الأصلية (0%)'}
                  >
                    0% {isEn ? 'Original' : 'الأصل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCostAdjustment(5)}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold transition cursor-pointer"
                    title={isEn ? '+5% Shipping & Freight' : '+5% شحن ونولون'}
                  >
                    +5% {isEn ? 'Freight' : 'شحن'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCostAdjustment(10)}
                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold transition cursor-pointer"
                    title={isEn ? '+10% Tariffs / Customs' : '+10% جمارك ورسوم'}
                  >
                    +10% {isEn ? 'Customs' : 'جمارك'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCostAdjustment(20)}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-[11px] font-bold transition cursor-pointer"
                    title={isEn ? '+20% High risk & price volatility' : '+20% مخاطر توريد'}
                  >
                    +20% {isEn ? 'Risk' : 'مخاطر'}
                  </button>
                </div>
              </div>

              {/* Direct Target Cost in SAR Input */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isEn ? 'Set Exact Target Total Cost (SAR):' : 'تحديد إجمالي تكلفة مستهدفة محددة (بالريال):'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={isEn ? 'e.g. 80000' : 'مثال: 85000'}
                    value={targetCostInput}
                    onChange={(e) => setTargetCostInput(e.target.value)}
                    className="flex-1 p-2 text-xs border border-slate-300 rounded-lg font-mono text-right"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyTargetCost(Number(targetCostInput))}
                    className="px-3 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                  >
                    {isEn ? 'Apply Cost' : 'تطبيق التكلفة'}
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Pricing Mode & Markups / Gross Margins */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {isEn ? 'Selling Price & Margin' : 'طريقة احتساب سعر البيع وهامش الربح'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isEn ? 'Configure profit formula and target margins' : 'تحديد هوامش الربح وصيغة التسعير للعميل'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    applyCalculations(
                      currentQuote.items,
                      currentQuote.additionalCosts,
                      'markup',
                      currentQuote.overallMarkupPercent,
                      currentQuote.overallTargetMarginPercent
                    )
                  }
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    currentQuote.pricingMode === 'markup'
                      ? 'border-[#007A5A] bg-emerald-50/60 text-[#007A5A] font-bold shadow-xs ring-1 ring-[#007A5A]/30'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="font-bold text-xs mb-0.5">Markup % ({isEn ? 'Markup' : 'نسبة الزيادة'})</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Cost × (1 + Markup %)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    applyCalculations(
                      currentQuote.items,
                      currentQuote.additionalCosts,
                      'gross_margin',
                      currentQuote.overallMarkupPercent,
                      currentQuote.overallTargetMarginPercent
                    )
                  }
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    currentQuote.pricingMode === 'gross_margin'
                      ? 'border-[#007A5A] bg-emerald-50/60 text-[#007A5A] font-bold shadow-xs ring-1 ring-[#007A5A]/30'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="font-bold text-xs mb-0.5">Gross Margin % ({isEn ? 'Gross Margin' : 'هامش الربح'})</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Cost / (1 - Margin %)
                  </div>
                </button>
              </div>

              {/* Sliders and Numbers */}
              <div className="space-y-4 pt-1">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>{isEn ? 'Markup % (Percentage Markup):' : 'نسبة الزيادة Markup %:'}</span>
                    <span className="font-mono text-[#007A5A] font-bold">
                      {currentQuote.overallMarkupPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={currentQuote.overallMarkupPercent}
                      onChange={(e) =>
                        applyCalculations(
                          currentQuote.items,
                          currentQuote.additionalCosts,
                          'markup',
                          Number(e.target.value),
                          currentQuote.overallTargetMarginPercent
                        )
                      }
                      className="flex-1 accent-[#007A5A] cursor-pointer"
                    />
                    <input
                      type="number"
                      value={currentQuote.overallMarkupPercent}
                      onChange={(e) =>
                        applyCalculations(
                          currentQuote.items,
                          currentQuote.additionalCosts,
                          'markup',
                          Number(e.target.value),
                          currentQuote.overallTargetMarginPercent
                        )
                      }
                      className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-center font-bold"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>{isEn ? 'Target Gross Margin %:' : 'هامش الربح المستهدف Target Gross Margin %:'}</span>
                    <span className="font-mono text-blue-700 font-bold">
                      {currentQuote.overallTargetMarginPercent}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="0.5"
                      value={currentQuote.overallTargetMarginPercent}
                      onChange={(e) =>
                        applyCalculations(
                          currentQuote.items,
                          currentQuote.additionalCosts,
                          'gross_margin',
                          currentQuote.overallMarkupPercent,
                          Number(e.target.value)
                        )
                      }
                      className="flex-1 accent-blue-600 cursor-pointer"
                    />
                    <input
                      type="number"
                      value={currentQuote.overallTargetMarginPercent}
                      onChange={(e) =>
                        applyCalculations(
                          currentQuote.items,
                          currentQuote.additionalCosts,
                          'gross_margin',
                          currentQuote.overallMarkupPercent,
                          Number(e.target.value)
                        )
                      }
                      className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-center font-bold"
                    />
                  </div>
                  {/* Quick Margin Presets in Card */}
                  <div className="flex flex-wrap items-center gap-1 pt-2">
                    <span className="text-[10px] text-slate-400 font-bold ml-1">{isEn ? 'Margin Presets:' : 'خيارات سريعة:'}</span>
                    {[10, 15, 20, 25, 30, 35, 40, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          applyCalculations(
                            currentQuote.items,
                            currentQuote.additionalCosts,
                            'gross_margin',
                            currentQuote.overallMarkupPercent,
                            preset
                          )
                        }
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                          Math.round(currentQuote.overallTargetMarginPercent) === preset
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Additional Direct Project Costs */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {isEn ? 'Additional Project Costs' : 'التكاليف المباشرة والإضافية'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isEn ? 'Installation, transport, T&C, supervision' : 'أجور التركيب، النقل، الاختبار، والعمالة'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {currentQuote.totals.totalAdditionalCosts.toLocaleString()} SAR
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {isEn ? 'Installation Cost' : 'تكلفة التركيب (Installation)'}
                  </label>
                  <input
                    type="number"
                    value={currentQuote.additionalCosts.installation}
                    onChange={(e) =>
                      applyCalculations(
                        currentQuote.items,
                        { ...currentQuote.additionalCosts, installation: Number(e.target.value) },
                        currentQuote.pricingMode,
                        currentQuote.overallMarkupPercent,
                        currentQuote.overallTargetMarginPercent
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {isEn ? 'Transportation' : 'الشحن والنقل (Transportation)'}
                  </label>
                  <input
                    type="number"
                    value={currentQuote.additionalCosts.transportation}
                    onChange={(e) =>
                      applyCalculations(
                        currentQuote.items,
                        { ...currentQuote.additionalCosts, transportation: Number(e.target.value) },
                        currentQuote.pricingMode,
                        currentQuote.overallMarkupPercent,
                        currentQuote.overallTargetMarginPercent
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {isEn ? 'Testing & Commissioning' : 'الاختبار والتشغيل (T&C)'}
                  </label>
                  <input
                    type="number"
                    value={currentQuote.additionalCosts.testingAndCommissioning}
                    onChange={(e) =>
                      applyCalculations(
                        currentQuote.items,
                        { ...currentQuote.additionalCosts, testingAndCommissioning: Number(e.target.value) },
                        currentQuote.pricingMode,
                        currentQuote.overallMarkupPercent,
                        currentQuote.overallTargetMarginPercent
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {isEn ? 'Engineering Supervision' : 'الإشراف الهندسي (Engineering)'}
                  </label>
                  <input
                    type="number"
                    value={currentQuote.additionalCosts.engineering}
                    onChange={(e) =>
                      applyCalculations(
                        currentQuote.items,
                        { ...currentQuote.additionalCosts, engineering: Number(e.target.value) },
                        currentQuote.pricingMode,
                        currentQuote.overallMarkupPercent,
                        currentQuote.overallTargetMarginPercent
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {isEn ? 'Manpower' : 'العمالة الإضافية (Manpower)'}
                  </label>
                  <input
                    type="number"
                    value={currentQuote.additionalCosts.manpower}
                    onChange={(e) =>
                      applyCalculations(
                        currentQuote.items,
                        { ...currentQuote.additionalCosts, manpower: Number(e.target.value) },
                        currentQuote.pricingMode,
                        currentQuote.overallMarkupPercent,
                        currentQuote.overallTargetMarginPercent
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {isEn ? 'Contingency' : 'احتياطي الطوارئ (Contingency)'}
                  </label>
                  <input
                    type="number"
                    value={currentQuote.additionalCosts.contingency}
                    onChange={(e) =>
                      applyCalculations(
                        currentQuote.items,
                        { ...currentQuote.additionalCosts, contingency: Number(e.target.value) },
                        currentQuote.pricingMode,
                        currentQuote.overallMarkupPercent,
                        currentQuote.overallTargetMarginPercent
                      )
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* System-level and Item-level Margin Analysis */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isEn ? 'Item-Level Margin & Cost Analysis' : 'تحليل التكلفة وسعر البيع وهامش الربح على مستوى البنود'}
                </h3>
                <span className="text-[11px] text-slate-500">
                  {tablePricingFocus === 'selling'
                    ? (isEn ? 'Selling Price Mode: Direct control over customer prices and item margins' : 'وضع أسعار البيع: تحكم مباشر في أسعار بيع البنود وهوامش الربح')
                    : (isEn ? 'Supplier Cost Mode: Direct control over unit costs and supplier discounts' : 'وضع أسعار المورد: تحكم مباشر في تكاليف الشراء وخصومات الموردين')}
                </span>
              </div>

              {/* Master Pricing Switcher */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">{isEn ? 'Focus Mode:' : 'جهة التحكم:'}</span>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setTablePricingFocus('selling')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      tablePricingFocus === 'selling'
                        ? 'bg-[#007A5A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏷️ {isEn ? 'Selling Prices' : 'أسعار البيع'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTablePricingFocus('supplier')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      tablePricingFocus === 'supplier'
                        ? 'bg-[#174A84] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏭 {isEn ? 'Supplier Costs' : 'أسعار المورد / التكلفة'}
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">{isEn ? 'Description' : 'الوصف / البند'}</th>
                    <th className="p-2.5 w-16 text-center">{isEn ? 'Qty' : 'الكمية'}</th>
                    <th
                      onClick={() => setTablePricingFocus('supplier')}
                      className={`p-2.5 text-right cursor-pointer transition ${
                        tablePricingFocus === 'supplier'
                          ? 'w-44 bg-sky-100 text-sky-900 font-bold border-r border-sky-300'
                          : 'w-24 text-slate-600'
                      }`}
                      title={isEn ? 'Click to edit supplier costs' : 'انقر لتعديل أسعار المورد'}
                    >
                      {isEn ? 'Supplier Unit' : 'سعر المورد (فردي)'} {tablePricingFocus === 'supplier' && '✏️'}
                    </th>
                    <th className="p-2.5 text-right w-28">{isEn ? 'Supplier Total' : 'إجمالي المورد'}</th>
                    <th
                      onClick={() => setTablePricingFocus('selling')}
                      className={`p-2.5 text-right cursor-pointer transition ${
                        tablePricingFocus === 'selling'
                          ? 'w-44 bg-emerald-100 text-emerald-900 font-bold border-r border-emerald-300'
                          : 'w-24 text-emerald-700'
                      }`}
                      title={isEn ? 'Click to edit selling prices' : 'انقر لتعديل أسعار البيع'}
                    >
                      {isEn ? 'Selling Unit' : 'سعر البيع (فردي)'} {tablePricingFocus === 'selling' && '✏️'}
                    </th>
                    <th className="p-2.5 text-right w-28">{isEn ? 'Selling Total' : 'إجمالي البيع'}</th>
                    <th className="p-2.5 text-right w-24">{isEn ? 'Profit (SAR)' : 'الربح (ريال)'}</th>
                    <th className="p-2.5 text-right w-20">{isEn ? 'Margin %' : 'هامش %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(currentQuote.items || []).map((item, idx) => {
                    const profit = item.sellingTotalPrice - item.supplierTotalPrice;
                    const margin =
                      item.sellingTotalPrice > 0
                        ? (profit / item.sellingTotalPrice) * 100
                        : 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 font-medium text-slate-800">
                          {item.description}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {item.quantity} {item.unit}
                        </td>

                        {/* Supplier Unit Column */}
                        <td className={`p-2 text-right font-mono ${tablePricingFocus === 'supplier' ? 'bg-sky-50/70' : 'text-slate-600'}`}>
                          {tablePricingFocus === 'supplier' ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickTweakItemCost(item.id, -5)}
                                className="px-1 py-0.5 text-[9px] bg-sky-100 hover:bg-sky-200 text-sky-800 rounded font-bold transition cursor-pointer"
                                title={isEn ? 'Decrease cost by 5%' : 'تخفيض التكلفة 5%'}
                              >
                                -5%
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.supplierUnitPrice}
                                onChange={(e) => {
                                  const newCost = Number(e.target.value) || 0;
                                  const updatedItems = [...currentQuote.items];
                                  const updatedItem = { ...updatedItems[idx] };
                                  updatedItem.supplierUnitPrice = newCost;
                                  updatedItem.supplierTotalPrice = Number((updatedItem.quantity * newCost).toFixed(2));
                                  updatedItems[idx] = updatedItem;
                                  applyCalculations(
                                    updatedItems,
                                    currentQuote.additionalCosts,
                                    'item_specific',
                                    currentQuote.overallMarkupPercent,
                                    currentQuote.overallTargetMarginPercent
                                  );
                                }}
                                className="w-20 p-1 text-right font-mono font-bold text-xs border border-sky-400 rounded-lg bg-white text-sky-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuickTweakItemCost(item.id, 5)}
                                className="px-1 py-0.5 text-[9px] bg-sky-100 hover:bg-sky-200 text-sky-800 rounded font-bold transition cursor-pointer"
                                title={isEn ? 'Increase cost by 5%' : 'زيادة التكلفة 5%'}
                              >
                                +5%
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={() => setTablePricingFocus('supplier')}
                              className="cursor-pointer hover:text-sky-700"
                              title={isEn ? 'Click to edit supplier cost' : 'انقر لتعديل تكلفة المورد'}
                            >
                              {item.supplierUnitPrice.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          )}
                        </td>

                        <td className="p-2.5 text-right font-mono text-slate-800 font-medium">
                          {item.supplierTotalPrice.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </td>

                        {/* Selling Unit Column */}
                        <td className={`p-2 text-right font-mono ${tablePricingFocus === 'selling' ? 'bg-emerald-50/70' : 'text-emerald-700 font-medium'}`}>
                          {tablePricingFocus === 'selling' ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickTweakItemPrice(item.id, -5)}
                                className="px-1 py-0.5 text-[9px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold transition cursor-pointer"
                                title={isEn ? 'Decrease price by 5%' : 'تخفيض سعر البيع 5%'}
                              >
                                -5%
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.sellingUnitPrice}
                                onChange={(e) => {
                                  const newPrice = Number(e.target.value) || 0;
                                  const updatedItems = [...currentQuote.items];
                                  const updatedItem = { ...updatedItems[idx] };
                                  updatedItem.sellingUnitPrice = newPrice;
                                  updatedItem.sellingTotalPrice = Number((updatedItem.quantity * newPrice).toFixed(2));
                                  updatedItems[idx] = updatedItem;
                                  applyCalculations(
                                    updatedItems,
                                    currentQuote.additionalCosts,
                                    'item_specific',
                                    currentQuote.overallMarkupPercent,
                                    currentQuote.overallTargetMarginPercent
                                  );
                                }}
                                className="w-20 p-1 text-right font-mono font-bold text-xs border border-emerald-400 rounded-lg bg-white text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuickTweakItemPrice(item.id, 5)}
                                className="px-1 py-0.5 text-[9px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold transition cursor-pointer"
                                title={isEn ? 'Increase price by 5%' : 'زيادة سعر البيع 5%'}
                              >
                                +5%
                              </button>
                            </div>
                          ) : (
                            <span
                              onClick={() => setTablePricingFocus('selling')}
                              className="cursor-pointer hover:text-emerald-900"
                              title={isEn ? 'Click to edit selling price' : 'انقر لتعديل سعر البيع'}
                            >
                              {item.sellingUnitPrice.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          )}
                        </td>

                        <td className="p-2.5 text-right font-mono text-emerald-800 font-bold">
                          {item.sellingTotalPrice.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-emerald-600">
                          +{profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-700">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              max="95"
                              step="0.5"
                              value={margin.toFixed(1)}
                              onChange={(e) => {
                                const newMargin = parseFloat(e.target.value) || 0;
                                handleUpdateItemMargin(item.id, newMargin);
                              }}
                              className="w-16 p-1 text-right font-mono font-bold text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                              title={isEn ? 'Edit item gross margin %' : 'تعديل هامش ربح هذا البند %'}
                            />
                            <span className="text-[10px] text-slate-500 font-bold">%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM SELECTION & TERMS LIBRARY */}
      {activeTab === 'systems_terms' && (
        <div className="space-y-6">
          {/* Multi-System Discipline Selector */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#007A5A]" />
                  <span>تحديد الأنظمة المطلوبة في المشروع (Selected Disciplines)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  اختر نظاماً واحداً أو عدة أنظمة لتضمين شروطها ونطاق عملها تلقائياً في عرض السعر
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {SYSTEM_DEFINITIONS.map((sys) => {
                const isSelected = (currentQuote?.selectedSystems ?? []).includes(sys.id);
                return (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => handleToggleSystem(sys.id)}
                    className={`p-3 rounded-lg border text-left transition flex items-start gap-2.5 ${
                      isSelected
                        ? 'border-[#007A5A] bg-emerald-50 text-[#007A5A] font-bold shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border ${
                        isSelected
                          ? 'bg-[#007A5A] border-[#007A5A] text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <div>
                      <p className="text-xs leading-snug">{sys.nameEn}</p>
                      <p className="text-[11px] opacity-80 font-cairo">{sys.nameAr}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Terms & Conditions Customizer for this Quotation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inclusions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1.1 ما يشمله العرض (Price Includes)
              </h4>
              <div className="space-y-2">
                {(currentQuote.terms?.includes || []).map((inc, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={inc}
                      onChange={(e) => {
                        const updated = [...(currentQuote.terms?.includes || [])];
                        updated[i] = e.target.value;
                        const quote = {
                          ...currentQuote,
                          terms: { ...currentQuote.terms, includes: updated },
                        };
                        setCurrentQuote(quote);
                        onSaveQuotation(quote);
                      }}
                      className="flex-1 text-xs p-2 border border-slate-200 rounded focus:border-[#007A5A] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (currentQuote.terms?.includes || []).filter((_, idx) => idx !== i);
                        const quote = {
                          ...currentQuote,
                          terms: { ...currentQuote.terms, includes: updated },
                        };
                        setCurrentQuote(quote);
                        onSaveQuotation(quote);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const quote = {
                      ...currentQuote,
                      terms: {
                        ...currentQuote.terms,
                        includes: [...(currentQuote.terms?.includes || []), 'New included item.'],
                      },
                    };
                    setCurrentQuote(quote);
                    onSaveQuotation(quote);
                  }}
                  className="text-xs text-[#007A5A] font-semibold flex items-center gap-1 hover:underline pt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة بند مشمول
                </button>
              </div>
            </div>

            {/* Exclusions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1.2 ما لا يشمله العرض (Price Excludes)
              </h4>
              <div className="space-y-2">
                {(currentQuote.terms?.excludes || []).map((exc, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={exc}
                      onChange={(e) => {
                        const updated = [...(currentQuote.terms?.excludes || [])];
                        updated[i] = e.target.value;
                        const quote = {
                          ...currentQuote,
                          terms: { ...currentQuote.terms, excludes: updated },
                        };
                        setCurrentQuote(quote);
                        onSaveQuotation(quote);
                      }}
                      className="flex-1 text-xs p-2 border border-slate-200 rounded focus:border-[#007A5A] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (currentQuote.terms?.excludes || []).filter((_, idx) => idx !== i);
                        const quote = {
                          ...currentQuote,
                          terms: { ...currentQuote.terms, excludes: updated },
                        };
                        setCurrentQuote(quote);
                        onSaveQuotation(quote);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const quote = {
                      ...currentQuote,
                      terms: {
                        ...currentQuote.terms,
                        excludes: [...(currentQuote.terms?.excludes || []), 'New exclusion.'],
                      },
                    };
                    setCurrentQuote(quote);
                    onSaveQuotation(quote);
                  }}
                  className="text-xs text-[#007A5A] font-semibold flex items-center gap-1 hover:underline pt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة استثناء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: VERSION CONTROL (QUOTATION V1, V2, V3...) */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-[#007A5A]" />
                <span>سجل الإصدارات والتعديلات (Quotation Version History)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Never delete approved versions. Track changes between V1, V2, V3 with margins and selling price diff.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowVersionModal(true)}
              className="px-4 py-2 bg-[#007A5A] text-white text-xs font-bold rounded-lg hover:bg-[#0b664d] transition shadow-xs"
            >
              + إنشاء إصدار جديد (Save V{(currentQuote.version || 1) + 1})
            </button>
          </div>

          <div className="space-y-3">
            {(currentQuote.versionHistory || []).map((ver) => (
              <div
                key={ver.version}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex flex-col items-center justify-center font-mono">
                    <span className="text-[10px] text-slate-400">VER</span>
                    <span className="text-base font-extrabold text-[#007A5A]">V{ver.version}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {ver.changeSummary || 'Approved Revision'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Modified at {ver.modifiedAt} by {ver.modifiedBy}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="block text-[10px] text-slate-400">Total Project Cost</span>
                    <span className="font-mono font-bold text-slate-800">
                      {ver.totalProjectCost?.toLocaleString()} SAR
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Customer Selling Price</span>
                    <span className="font-mono font-bold text-[#007A5A]">
                      {ver.customerSellingPrice?.toLocaleString()} SAR
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Gross Margin %</span>
                    <span className="font-mono font-bold text-blue-700">
                      {ver.grossMarginPercent?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Version Dialog */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              حفظ كإصدار جديد (Create Revision V{(currentQuote.version || 1) + 1})
            </h3>
            <p className="text-xs text-slate-500">
              وضح أسباب التعديل (مثل: تعديل كميات العميل، زيادة هامش الربح، أو إضافة تكاليف شحن)
            </p>
            <textarea
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
              placeholder="ملخص التعديل (e.g. Revised margin to 22% and added testing & commissioning cost)..."
              rows={3}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#007A5A] outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVersionModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveVersion}
                className="px-4 py-2 text-xs font-bold bg-[#007A5A] text-white rounded-lg hover:bg-[#0c6b4f]"
              >
                تأكيد وحفظ V{(currentQuote.version || 1) + 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Dispatch Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center font-bold">
                  <MessageCircle className="w-5 h-5 fill-[#25D366]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    {isEn ? 'Send Quotation via WhatsApp' : 'إرسال عرض السعر عبر الواتساب'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {currentQuote.quotationNumber} • {currentQuote.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {whatsAppFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{whatsAppFeedback}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>{isEn ? 'Recipient WhatsApp / Mobile Number:' : 'رقم جوال العميل المستلم (واتساب):'}</span>
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="05XXXXXXXX or +9665XXXXXXXX"
                  value={whatsAppRecipientPhone}
                  onChange={(e) => setWhatsAppRecipientPhone(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {isEn ? 'Leave empty to select contact inside WhatsApp Web / App.' : 'اتركه فارغاً لاختيار جهة الاتصال مباشرة من تطبيق واتساب.'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isEn ? 'Additional Note (Optional):' : 'ملاحظة خاصة بالعرض (اختياري):'}
                </label>
                <input
                  type="text"
                  placeholder={isEn ? 'e.g. Please find the approved quotation with special discount.' : 'مثال: نرفق لكم العرض المعتمد شاملاً التوريد والتركيب والضمان...'}
                  value={whatsAppCustomNote}
                  onChange={(e) => setWhatsAppCustomNote(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{isEn ? 'Message Preview:' : 'معاينة نص الرسالة الرسمية:'}</span>
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppText}
                    className="text-[11px] text-[#007A5A] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{isCopiedWhatsApp ? (isEn ? 'Copied!' : 'تم النسخ!') : (isEn ? 'Copy Text' : 'نسخ النص')}</span>
                  </button>
                </label>
                <div className="bg-slate-900 text-slate-200 p-3 rounded-xl text-[11px] font-mono whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed border border-slate-800 dir-rtl text-right">
                  {getWhatsAppMessageText()}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCopyWhatsAppText}
                className="w-full sm:w-auto px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isEn ? 'Copy Text' : 'نسخ النص'}</span>
              </button>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'إلغاء'}
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="px-4 py-2 text-xs font-bold bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>{isEn ? 'Launch WhatsApp' : 'إرسال عبر تطبيق واتساب'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Commercial Proposal 4-Page Print Modal */}
      {showCommercialProposal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <CommercialProposalPrint
            quotation={currentQuote}
            onClose={() => setShowCommercialProposal(false)}
          />
        </div>
      )}
    </div>
  );
};
