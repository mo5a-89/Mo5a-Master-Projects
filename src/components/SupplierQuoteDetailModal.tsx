import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  Sparkles,
  Save,
  CheckCircle,
  Percent,
  Calculator,
  Sliders,
  FileText,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SupplierQuotation, QuotationItem, Project } from '../types';
import { executePrint, openPrintPopup } from '../utils/printUtils';
import { CompanyHeader } from './CompanyHeader';
import { MobileViewerTopBar, useModalBackDismiss } from './MobileViewerTopBar';

interface SupplierQuoteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierQuote: SupplierQuotation | null;
  project?: Project | null;
  onSaveQuoteItems?: (quoteId: string, updatedItems: QuotationItem[]) => void;
  onConvertToCustomerQuote: (supplierQuoteId: string, tunedItems: QuotationItem[]) => void;
  onDeleteSupplierQuote?: (quoteId: string) => void;
}

export const SupplierQuoteDetailModal: React.FC<SupplierQuoteDetailModalProps> = ({
  isOpen,
  onClose,
  supplierQuote,
  project,
  onSaveQuoteItems,
  onConvertToCustomerQuote,
}) => {
  // Enforce hardware and native browser back button dismissal
  useModalBackDismiss(onClose);

  // Working copy of items for margin/price tuning (unconditional hook)
  const [items, setItems] = useState<QuotationItem[]>(() => {
    if (!supplierQuote?.items) return [];
    return supplierQuote.items.map((it) => {
      const supPrice = Number(it.supplierUnitPrice) || 0;
      const sellPrice =
        Number(it.sellingUnitPrice) > 0
          ? Number(it.sellingUnitPrice)
          : Number((supPrice * 1.25).toFixed(2)); // default 20% margin / 25% markup
      const qty = Number(it.quantity) || 1;
      return {
        ...it,
        supplierUnitPrice: supPrice,
        supplierTotalPrice: Number((qty * supPrice).toFixed(2)),
        sellingUnitPrice: sellPrice,
        sellingTotalPrice: Number((qty * sellPrice).toFixed(2)),
      };
    });
  });

  // Keep items synced when supplierQuote changes
  useEffect(() => {
    if (supplierQuote?.items) {
      setItems(
        supplierQuote.items.map((it) => {
          const supPrice = Number(it.supplierUnitPrice) || 0;
          const sellPrice =
            Number(it.sellingUnitPrice) > 0
              ? Number(it.sellingUnitPrice)
              : Number((supPrice * 1.25).toFixed(2));
          const qty = Number(it.quantity) || 1;
          return {
            ...it,
            supplierUnitPrice: supPrice,
            supplierTotalPrice: Number((qty * supPrice).toFixed(2)),
            sellingUnitPrice: sellPrice,
            sellingTotalPrice: Number((qty * sellPrice).toFixed(2)),
          };
        })
      );
    }
  }, [supplierQuote?.id, isOpen]);

  const [pricingMode, setPricingMode] = useState<'margin' | 'markup'>('margin');
  const [globalRate, setGlobalRate] = useState<number>(20); // 20% margin default
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Apply uniform margin or markup across all items
  const applyUniformRate = (rate: number, mode: 'margin' | 'markup') => {
    const updated = items.map((it) => {
      const cost = Number(it.supplierUnitPrice) || 0;
      let newSellingUnit = 0;
      if (mode === 'margin') {
        const safeMargin = Math.min(Math.max(rate, 0), 90);
        newSellingUnit = safeMargin >= 100 ? cost : cost / (1 - safeMargin / 100);
      } else {
        newSellingUnit = cost * (1 + rate / 100);
      }
      const qty = Number(it.quantity) || 1;
      const roundedSell = Number(newSellingUnit.toFixed(2));
      return {
        ...it,
        sellingUnitPrice: roundedSell,
        sellingTotalPrice: Number((qty * roundedSell).toFixed(2)),
      };
    });
    setItems(updated);
  };

  // Handle individual item price change
  const handleItemSellingPriceChange = (index: number, val: number) => {
    const updated = [...items];
    const it = { ...updated[index] };
    const qty = Number(it.quantity) || 1;
    it.sellingUnitPrice = val;
    it.sellingTotalPrice = Number((qty * val).toFixed(2));
    updated[index] = it;
    setItems(updated);
  };

  // Financial summary
  const totalCost = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.supplierTotalPrice) || 0), 0),
    [items]
  );
  const totalSelling = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.sellingTotalPrice) || 0), 0),
    [items]
  );
  const totalProfit = totalSelling - totalCost;
  const overallMarginPercent =
    totalSelling > 0 ? (totalProfit / totalSelling) * 100 : 0;
  const overallMarkupPercent =
    totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  const handleSave = () => {
    if (onSaveQuoteItems && supplierQuote) {
      onSaveQuoteItems(supplierQuote.id, items);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  const handleConvert = () => {
    if (supplierQuote) {
      if (onSaveQuoteItems) {
        onSaveQuoteItems(supplierQuote.id, items);
      }
      onConvertToCustomerQuote(supplierQuote.id, items);
      onClose();
    }
  };

  const handlePrint = () => {
    if (!supplierQuote) return;
    executePrint('printable-supplier-quote-detail', {
      documentTitle: `تسعيرة المورد - ${supplierQuote.supplierName} - ${supplierQuote.quotationNumber}`,
    });
  };

  const handleOpenPrintPopup = () => {
    if (!supplierQuote) return;
    openPrintPopup(
      'printable-supplier-quote-detail',
      `تسعيرة المورد - ${supplierQuote.supplierName} - ${supplierQuote.quotationNumber}`
    );
  };

  if (!isOpen || !supplierQuote) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print-modal-container"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div className="bg-white rounded-none sm:rounded-2xl max-w-5xl w-full min-h-screen sm:min-h-0 sm:max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 print-modal-content">
        {/* Sticky Mobile-Friendly Top Action Bar */}
        <MobileViewerTopBar
          title={`تسعيرة مورد: ${supplierQuote.quotationNumber}`}
          subtitle={`${supplierQuote.supplierName} • ${project?.name || 'مرتبط بالمشروع'}`}
          onClose={onClose}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleSave}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  savedSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {savedSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{savedSuccess ? 'تم الحفظ' : 'حفظ'}</span>
              </button>

              <button
                type="button"
                onClick={handleConvert}
                className="px-3 sm:px-4 py-1.5 bg-[#007A5A] hover:bg-[#00664B] active:bg-[#00523C] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                title="تجهيز وتحويل البنود والأسعار إلى عرض سعر عميل رسمي"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden sm:inline">تحويل إلى عرض سعر عميل</span>
                <span className="sm:hidden">تحويل لعرض عميل</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                title="طباعة تفاصيل التسعيرة"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden md:inline">طباعة</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPrintPopup}
                className="hidden lg:flex px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium items-center gap-1 transition cursor-pointer"
                title="فتح في نافذة مستقلة للطباعة الخارجية"
              >
                <span>نافذة مستقلة</span>
              </button>
            </div>
          }
        />

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Global Profit Margin & Markup Quick Tuner Bar (No Print) */}
          <div className="no-print bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-blue-50/50 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#007A5A]" />
                <h3 className="text-sm font-black text-slate-900">
                  لوحة ضبط هوامش الربح وأسعار البيع المقترحة (Margin & Pricing Tuner)
                </h3>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">طريقة التسعير:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-white border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPricingMode('margin');
                      applyUniformRate(globalRate, 'margin');
                    }}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      pricingMode === 'margin'
                        ? 'bg-[#007A5A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    هامش ربح (Gross Margin %)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPricingMode('markup');
                      applyUniformRate(globalRate, 'markup');
                    }}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      pricingMode === 'markup'
                        ? 'bg-[#007A5A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    إضافة على التكلفة (Markup %)
                  </button>
                </div>
              </div>
            </div>

            {/* Margin Slider & Quick Presets */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <span className="text-xs font-bold text-slate-700 min-w-[75px]">
                  {pricingMode === 'margin' ? 'نسبة الهامش:' : 'نسبة الإضافة:'}
                </span>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={globalRate}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setGlobalRate(val);
                    applyUniformRate(val, pricingMode);
                  }}
                  className="flex-1 accent-[#007A5A] cursor-pointer"
                />
                <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={globalRate}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setGlobalRate(val);
                      applyUniformRate(val, pricingMode);
                    }}
                    className="w-12 font-mono font-bold text-sm text-center outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">نسب سريعة:</span>
                {[15, 20, 25, 30, 35].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setGlobalRate(preset);
                      applyUniformRate(preset, pricingMode);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      globalRate === preset
                        ? 'bg-[#007A5A] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Real-Time Financial Impact KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-slate-500 block text-[11px] font-medium">
                إجمالي تكلفة المورد (Supplier Cost)
              </span>
              <div className="mt-1 font-mono font-bold text-slate-900 text-base">
                {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs font-sans text-slate-500">SAR</span>
              </div>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-emerald-700 block text-[11px] font-medium">
                سعر البيع المقترح للعميل (Selling Price)
              </span>
              <div className="mt-1 font-mono font-bold text-emerald-900 text-base">
                {totalSelling.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs font-sans text-emerald-700">SAR</span>
              </div>
            </div>

            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
              <span className="text-blue-700 block text-[11px] font-medium">
                صافي الربح المتوقع (Net Profit)
              </span>
              <div className="mt-1 font-mono font-bold text-blue-900 text-base">
                {totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-xs font-sans text-blue-700">SAR</span>
              </div>
            </div>

            <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-200">
              <span className="text-teal-700 block text-[11px] font-medium">
                هامش الربح المحقق (Achieved Margin)
              </span>
              <div className="mt-1 font-mono font-black text-teal-900 text-base">
                {overallMarginPercent.toFixed(1)}%{' '}
                <span className="text-[11px] font-sans font-medium text-teal-700">
                  (Markup: {overallMarkupPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* 3. Printable & Editable Items Table */}
          <div
            id="printable-supplier-quote-detail"
            className="space-y-4 print:p-0 print:m-0"
          >
            <div className="hidden print:block">
              <CompanyHeader />
              <div className="text-center py-2 border-b-2 border-[#007A5A] mb-4">
                <h1 className="text-lg font-black text-[#174A84]">
                  بيان تسعيرة المورد وتعديل أسعار البيع المقترحة
                </h1>
                <div className="text-xs text-slate-500 mt-1">
                  المورد: {supplierQuote.supplierName} | رقم التسعيرة: {supplierQuote.quotationNumber} | التاريخ: {supplierQuote.date}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  جدول بنود التسعيرة والأسعار الفردية ({items.length} بنود)
                </h4>
                <span className="text-[11px] text-slate-500">
                  (يمكنك تعديل سعر البيع المقترح لأي بند مباشرة في الجدول)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center font-bold">#</th>
                    <th className="p-3 font-bold min-w-[200px]">الوصف والمواصفات الفنية</th>
                    <th className="p-3 font-bold w-24">الماركة / الموديل</th>
                    <th className="p-3 font-bold w-16 text-center">الكمية</th>
                    <th className="p-3 font-bold w-14 text-center">الوحدة</th>
                    <th className="p-3 font-bold w-28 text-left">سعر المورد (SAR)</th>
                    <th className="p-3 font-bold w-28 text-left">إجمالي التكلفة</th>
                    <th className="p-3 font-bold w-36 text-left bg-emerald-50/50">
                      سعر البيع المقترح (SAR)
                    </th>
                    <th className="p-3 font-bold w-32 text-left bg-emerald-50/50">إجمالي البيع</th>
                    <th className="p-3 font-bold w-24 text-center">هامش الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => {
                    const costTotal = Number(it.supplierTotalPrice) || 0;
                    const sellTotal = Number(it.sellingTotalPrice) || 0;
                    const itemProfit = sellTotal - costTotal;
                    const itemMargin = sellTotal > 0 ? (itemProfit / sellTotal) * 100 : 0;

                    return (
                      <tr key={it.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-medium text-slate-900">
                          <div>{it.description}</div>
                          {it.notes && (
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                              {it.notes}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-600 text-[11px]">
                          {it.manufacturer || it.model ? (
                            <div>
                              <span>{it.manufacturer}</span>
                              {it.model && <span className="block text-slate-400">{it.model}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-800">
                          {it.quantity}
                        </td>
                        <td className="p-3 text-center text-slate-500">{it.unit}</td>
                        <td className="p-3 font-mono text-slate-700 text-left font-medium">
                          {(it.supplierUnitPrice || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 font-mono text-slate-800 text-left font-bold">
                          {costTotal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        {/* Editable Selling Unit Price */}
                        <td className="p-2.5 bg-emerald-50/30 text-left">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={it.sellingUnitPrice || ''}
                              onChange={(e) =>
                                handleItemSellingPriceChange(idx, Number(e.target.value) || 0)
                              }
                              className="w-24 text-left font-mono font-bold text-emerald-900 bg-white border border-emerald-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                            />
                          </div>
                        </td>

                        <td className="p-3 font-mono font-bold text-emerald-900 text-left bg-emerald-50/30">
                          {sellTotal.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              itemMargin >= 20
                                ? 'bg-emerald-100 text-emerald-800'
                                : itemMargin >= 10
                                ? 'bg-teal-100 text-teal-800'
                                : itemMargin > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {itemMargin.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={6} className="p-3 text-right text-slate-800">
                      المجموع الإجمالي (Total):
                    </td>
                    <td className="p-3 font-mono text-slate-900 text-left">
                      {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                    <td className="p-3 bg-emerald-100/60 text-right text-emerald-900">
                      إجمالي البيع المقترح:
                    </td>
                    <td className="p-3 font-mono text-emerald-950 text-left bg-emerald-100/60">
                      {totalSelling.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </td>
                    <td className="p-3 text-center text-teal-900 font-mono">
                      +{overallMarginPercent.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 4. Technical Terms & Exclusions Accordion */}
          <div className="no-print border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>الشروط التجارية والفنية للمورد (Commercial & Technical Terms)</span>
              </div>
              {showTechnicalDetails ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">شروط الدفع والتسليم:</span>
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                    الدفع: {supplierQuote.paymentTerms || 'غير محدد'} <br />
                    التسليم: {supplierQuote.deliveryTime || 'غير محدد'} <br />
                    الضمان: {supplierQuote.warranty || 'غير محدد'}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-1">الاستثناءات والملاحظات:</span>
                  <div className="text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100 space-y-1">
                    {supplierQuote.exclusions && supplierQuote.exclusions.length > 0 ? (
                      <ul className="list-disc list-inside space-y-0.5">
                        {supplierQuote.exclusions.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-400">لا توجد استثناءات مسجلة</span>
                    )}
                  </div>
                </div>

                {supplierQuote.rawTextPreview && (
                  <div className="col-span-full">
                    <span className="font-bold text-slate-700 block mb-1">نص التسعيرة الأصلي:</span>
                    <pre className="text-[11px] font-mono bg-slate-900 text-emerald-300 p-3 rounded-lg overflow-x-auto max-h-40">
                      {supplierQuote.rawTextPreview}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">المشروع المستهدف:</span>
            <strong className="text-slate-900 font-bold">{project?.name || 'غير محدد'}</strong>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              إلغاء وإغلاق
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ التعديلات في التسعيرة</span>
            </button>

            <button
              type="button"
              onClick={handleConvert}
              className="px-5 py-2 bg-[#007A5A] hover:bg-[#00664B] active:bg-[#00523C] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>تحويل إلى عرض سعر عميل رسمي الآن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
