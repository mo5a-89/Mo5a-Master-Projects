import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Project, ClientContractPO, ClientContractPOItem, CustomerQuotation } from '../types';
import {
  Award,
  Upload,
  FileCheck2,
  Sparkles,
  X,
  Check,
  Calendar,
  DollarSign,
  Layers,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';

interface ClientContractPOModalProps {
  isOpen: boolean;
  project: Project;
  quotation?: CustomerQuotation;
  onClose: () => void;
  onSaveContractPO: (projectId: string, contractPO: ClientContractPO) => void;
}

// Helper to extract Excel sheets rows directly if an Excel file is provided
function parseExcelFile(buffer: ArrayBuffer): {
  items: ClientContractPOItem[];
  rawText: string;
  contractValue: number | null;
  vatAmount: number | null;
  grandTotal: number | null;
} {
  const wb = XLSX.read(buffer, { type: 'array' });
  let rawText = '';
  const items: ClientContractPOItem[] = [];
  let detectedFooterSubtotal: number | null = null;
  let detectedFooterVat: number | null = null;
  let detectedFooterGrandTotal: number | null = null;

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws);
    rawText += `=== Sheet: ${sheetName} ===\n${csv}\n\n`;

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length === 0) return;

    let headerRowIdx = -1;
    let descCol = -1;
    let qtyCol = -1;
    let unitPriceCol = -1;
    let unitCol = -1;
    let totalCol = -1;

    for (let r = 0; r < Math.min(rows.length, 25); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const lowerCells = row.map((c) => String(c ?? '').toLowerCase().trim());

      const foundDesc = lowerCells.findIndex(
        (c) =>
          c.includes('desc') ||
          c.includes('item') ||
          c.includes('بند') ||
          c.includes('بيان') ||
          c.includes('وصف') ||
          c.includes('المادة')
      );
      const foundPrice = lowerCells.findIndex(
        (c) =>
          c.includes('unit price') ||
          c.includes('price') ||
          c.includes('rate') ||
          c.includes('سعر') ||
          c.includes('افرادي') ||
          c.includes('إفرادي')
      );
      const foundQty = lowerCells.findIndex(
        (c) =>
          c.includes('qty') ||
          c.includes('quantity') ||
          c.includes('كمية') ||
          c.includes('العدد')
      );

      if (foundDesc !== -1 && (foundPrice !== -1 || foundQty !== -1)) {
        headerRowIdx = r;
        descCol = foundDesc;
        qtyCol = foundQty;
        unitPriceCol = foundPrice;
        unitCol = lowerCells.findIndex((c) => c.includes('unit') || c.includes('وحدة'));
        totalCol = lowerCells.findIndex(
          (c, i) =>
            i !== unitPriceCol &&
            (c.includes('total') || c.includes('amount') || c.includes('اجمالي') || c.includes('إجمالي') || c.includes('مجموع'))
        );
        break;
      }
    }

    // Scan all rows for explicit footer/summary totals without summing individual line items
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((c) => String(c ?? '').toLowerCase().trim()).join(' ');

      const rowNumbers = row
        .map((c) => (typeof c === 'number' ? c : parseFloat(String(c ?? '').replace(/[^0-9.-]+/g, ''))))
        .filter((n) => !isNaN(n) && n > 0);

      const maxNumber = rowNumbers.length > 0 ? rowNumbers[rowNumbers.length - 1] : null;

      if (
        (rowStr.includes('subtotal') ||
          rowStr.includes('sub total') ||
          rowStr.includes('contract value') ||
          rowStr.includes('المجموع قبل') ||
          rowStr.includes('المجموع الفرعي') ||
          rowStr.includes('قيمة العقد') ||
          rowStr.includes('صافي القيمة') ||
          rowStr.includes('الاجمالي قبل')) &&
        maxNumber !== null
      ) {
        detectedFooterSubtotal = maxNumber;
      } else if (
        (rowStr.includes('vat') ||
          rowStr.includes('ضريبة') ||
          rowStr.includes('الضريبة') ||
          rowStr.includes('15%')) &&
        !rowStr.includes('شامل') &&
        maxNumber !== null
      ) {
        detectedFooterVat = maxNumber;
      } else if (
        (rowStr.includes('grand total') ||
          rowStr.includes('total amount') ||
          rowStr.includes('المجموع الكلي') ||
          rowStr.includes('الإجمالي الكلي') ||
          rowStr.includes('الإجمالي العام') ||
          rowStr.includes('المبلغ الإجمالي') ||
          rowStr.includes('شامل الضريبة')) &&
        maxNumber !== null
      ) {
        detectedFooterGrandTotal = maxNumber;
      }
    }

    if (headerRowIdx !== -1 && descCol !== -1) {
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const descVal = String(row[descCol] ?? '').trim();
        if (!descVal) continue;

        const lowerDesc = descVal.toLowerCase();
        if (
          lowerDesc.includes('total') ||
          lowerDesc.includes('subtotal') ||
          lowerDesc.includes('vat') ||
          lowerDesc.includes('المجموع') ||
          lowerDesc.includes('الإجمالي') ||
          lowerDesc.includes('ضريبة')
        ) {
          continue;
        }

        const rawQty = qtyCol !== -1 ? parseFloat(String(row[qtyCol]).replace(/[^0-9.-]+/g, '')) : 1;
        const qty = !isNaN(rawQty) && rawQty > 0 ? rawQty : 1;

        const rawUnitPrice = unitPriceCol !== -1 ? parseFloat(String(row[unitPriceCol]).replace(/[^0-9.-]+/g, '')) : 0;
        const unitPrice = !isNaN(rawUnitPrice) ? rawUnitPrice : 0;

        const rawTotal = totalCol !== -1 ? parseFloat(String(row[totalCol]).replace(/[^0-9.-]+/g, '')) : 0;
        const totalPrice = !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : qty * unitPrice;

        const unit = unitCol !== -1 && row[unitCol] ? String(row[unitCol]).trim() : 'EA';

        if (descVal.length > 1 && (unitPrice > 0 || totalPrice > 0 || qty > 0)) {
          items.push({
            id: `cpo-excel-${Date.now()}-${items.length}`,
            itemNo: items.length + 1,
            description: descVal,
            quantity: qty,
            unit,
            unitPrice,
            totalPrice,
          });
        }
      }
    }
  });

  return {
    items,
    rawText,
    contractValue: detectedFooterSubtotal,
    vatAmount: detectedFooterVat,
    grandTotal: detectedFooterGrandTotal,
  };
}

export const ClientContractPOModal: React.FC<ClientContractPOModalProps> = ({
  isOpen,
  project,
  quotation,
  onClose,
  onSaveContractPO,
}) => {
  const existingPO = project.clientContractPO;

  const [clientPONumber, setClientPONumber] = useState(
    existingPO?.clientPONumber || `CPO-${project.projectNumber.replace(/[^a-zA-Z0-9]/g, '')}-01`
  );
  const [poDate, setPoDate] = useState(
    existingPO?.poDate || new Date().toISOString().split('T')[0]
  );
  const [contractValue, setContractValue] = useState<number>(
    existingPO?.contractValue || quotation?.totals?.customerSellingPrice || 50000
  );
  const [vatIncluded, setVatIncluded] = useState<boolean>(
    existingPO?.vatIncluded !== undefined ? existingPO.vatIncluded : false
  );
  const [vatAmount, setVatAmount] = useState<number>(
    existingPO?.vatAmount || Math.round((contractValue * 15) / 100)
  );
  const [grandTotal, setGrandTotal] = useState<number>(
    existingPO?.grandTotal || contractValue + Math.round((contractValue * 15) / 100)
  );

  const [items, setItems] = useState<ClientContractPOItem[]>(() => {
    if (existingPO?.items && existingPO.items.length > 0) {
      return existingPO.items;
    }
    if (quotation?.items && quotation.items.length > 0) {
      return quotation.items.map((it, idx) => ({
        id: `cpo-it-${idx + 1}`,
        itemNo: it.itemNo || idx + 1,
        description: it.description,
        quantity: it.quantity || 1,
        unit: it.unit || 'EA',
        unitPrice: it.sellingUnitPrice || it.supplierUnitPrice || 0,
        totalPrice: (it.quantity || 1) * (it.sellingUnitPrice || it.supplierUnitPrice || 0),
      }));
    }
    return [
      {
        id: 'cpo-it-1',
        itemNo: 1,
        description: 'توريد وتركيب أنظمة الإطفاء والإنذار المعتمدة بموجب العقد',
        quantity: 1,
        unit: 'LOT',
        unitPrice: contractValue,
        totalPrice: contractValue,
      },
    ];
  });

  const [notes, setNotes] = useState(existingPO?.notes || '');
  const [attachmentName, setAttachmentName] = useState<string | undefined>(
    existingPO?.attachmentName
  );
  const [attachmentData, setAttachmentData] = useState<string | undefined>(
    existingPO?.attachmentData
  );
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [aiParsedSuccess, setAiParsedSuccess] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const recalculateTotals = (updatedItems: ClientContractPOItem[]) => {
    const sub = updatedItems.reduce((s, it) => s + (Number(it.totalPrice) || 0), 0);
    setContractValue(sub);
    const vat = Math.round((sub * 15) / 100);
    setVatAmount(vat);
    setGrandTotal(sub + vat);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentName(file.name);
    setIsParsingDoc(true);
    setAiParsedSuccess(null);
    setParseError(null);

    const isExcel =
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.name.endsWith('.csv');

    try {
      let base64Data = '';
      let rawText = '';

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const excelRes = parseExcelFile(buffer);
        rawText = excelRes.rawText;
        if (excelRes.items.length > 0) {
          setItems(excelRes.items);
        }
        if (typeof excelRes.contractValue === 'number' && excelRes.contractValue > 0) {
          setContractValue(excelRes.contractValue);
        }
        if (typeof excelRes.vatAmount === 'number' && excelRes.vatAmount >= 0) {
          setVatAmount(excelRes.vatAmount);
        }
        if (typeof excelRes.grandTotal === 'number' && excelRes.grandTotal > 0) {
          setGrandTotal(excelRes.grandTotal);
        }
      } else {
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            setAttachmentData(result);
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64 || '');
          };
          reader.readAsDataURL(file);
        });
      }

      // Send to server-side Gemini AI for comprehensive multi-item BOQ extraction & OCR
      const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      const response = await fetch('/api/ai/parse-client-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          fileData: base64Data,
          mimeType: isExcel ? '' : mimeType,
          fileName: file.name,
          projectName: project.name,
          customerName: project.customerName,
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData?.data) {
          const d = resData.data;
          
          if (d.clientPONumber) {
            setClientPONumber(d.clientPONumber);
          }
          if (d.poDate) {
            setPoDate(d.poDate);
          }
          if (d.notes) {
            setNotes(d.notes);
          }

          let mappedItems: ClientContractPOItem[] = [];
          if (Array.isArray(d.items) && d.items.length > 0) {
            mappedItems = d.items.map((it: any, idx: number) => {
              const q = Number(it.quantity) || 1;
              const up = Number(it.unitPrice) || 0;
              const tp = Number(it.totalPrice) || q * up;
              return {
                id: `cpo-ai-${Date.now()}-${idx}`,
                itemNo: it.itemNo || idx + 1,
                description: String(it.description || '').trim(),
                quantity: q,
                unit: it.unit || 'EA',
                unitPrice: up,
                totalPrice: tp,
              };
            });
            setItems(mappedItems);
          }

          // STRICT PARSER TOTALS OVERRIDE & RECALCULATION BAN:
          // Mirror exact extracted footer figures directly without auto-summation, re-computation, or rounding changes
          const explicitContractVal =
            typeof d.contractValue === 'number' && d.contractValue > 0
              ? Number(d.contractValue)
              : (mappedItems.length > 0 ? mappedItems.reduce((s, it) => s + it.totalPrice, 0) : contractValue);
          setContractValue(explicitContractVal);

          const explicitVat =
            typeof d.vatAmount === 'number' && d.vatAmount >= 0
              ? Number(d.vatAmount)
              : Number(((explicitContractVal * 15) / 100).toFixed(2));
          setVatAmount(explicitVat);

          const explicitGrandTotal =
            typeof d.grandTotal === 'number' && d.grandTotal > 0
              ? Number(d.grandTotal)
              : Number((explicitContractVal + explicitVat).toFixed(2));
          setGrandTotal(explicitGrandTotal);

          setAiParsedSuccess(
            `تم استخراج وتحليل بيانات أمر شراء العميل بواسطة الذكاء الاصطناعي بنجاح! تم استخراج ${mappedItems.length} بنود جدول كميات (BOQ)، رقم التعميد: ${d.clientPONumber || 'معتمد'}، القيمة الإجمالية: ${explicitGrandTotal.toLocaleString()} SAR.`
          );
        }
      } else {
        // Fallback if AI server response had high demand
        const errJson = await response.json().catch(() => ({}));
        setParseError(errJson.error || 'تمت قراءة الملف مبدئياً. يمكنك تعديل أو مراجعة جدول البنود أدناه يدوياً.');
        
        // Extract PO number from filename if obvious
        const match = file.name.match(/(?:PO|PRJ|CPO)[#_\-\s]*([0-9a-zA-Z\-]+)/i);
        if (match && match[0]) {
          setClientPONumber(match[0].replace(/_/g, '-'));
        }
      }
    } catch (err: any) {
      console.error('Error parsing client PO file:', err);
      setParseError('حدث تعذر في الاتصال بخدمة التحليل الذكي. يمكنك إضافة البنود وتعديل القيم يدوياً.');
    } finally {
      setIsParsingDoc(false);
    }
  };

  const handleItemChange = (index: number, field: keyof ClientContractPOItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? Number(value) || 0 : item.quantity;
      const p = field === 'unitPrice' ? Number(value) || 0 : item.unitPrice;
      item.totalPrice = Number((q * p).toFixed(2));
    }
    
    updated[index] = item;
    setItems(updated);
    recalculateTotals(updated);
  };

  const handleAddItem = () => {
    const newItem: ClientContractPOItem = {
      id: `cpo-manual-${Date.now()}`,
      itemNo: items.length + 1,
      description: 'بند جديد في أمر الشراء',
      quantity: 1,
      unit: 'EA',
      unitPrice: 0,
      totalPrice: 0,
    };
    const updated = [...items, newItem];
    setItems(updated);
    recalculateTotals(updated);
  };

  const handleDeleteItem = (index: number) => {
    if (items.length <= 1) {
      alert('يجب أن يحتوي أمر الشراء على بند واحد على الأقل.');
      return;
    }
    const updated = items.filter((_, i) => i !== index).map((it, idx) => ({
      ...it,
      itemNo: idx + 1,
    }));
    setItems(updated);
    recalculateTotals(updated);
  };

  const handleSave = () => {
    if (!clientPONumber.trim()) {
      alert('يرجى إدخال رقم أمر شراء أو عقد العميل.');
      return;
    }

    const contractPO: ClientContractPO = {
      id: existingPO?.id || `cpo-${Date.now()}`,
      projectId: project.id,
      clientPONumber: clientPONumber.trim(),
      poDate,
      contractValue: Number(contractValue) || 0,
      vatIncluded,
      vatAmount: Number(vatAmount) || 0,
      grandTotal: Number(grandTotal) || (Number(contractValue) || 0) + (Number(vatAmount) || 0),
      approvedQuantitiesCount: items.reduce((s, it) => s + (it.quantity || 0), 0),
      items,
      attachmentName,
      attachmentData,
      notes,
      extractedAt: new Date().toISOString(),
      status: 'Active',
    };

    onSaveContractPO(project.id, contractPO);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-6 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#007A5A] to-[#0a5c43] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold shadow-xs">
              <Award className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">
                  اعتماد ورفع أمر شراء / عقد العميل (Client PO & Project Awarding)
                </h3>
                <span className="bg-emerald-500/30 text-emerald-100 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                  المرجع الأساسي للمشروع (Master Reference)
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                المشروع: <span className="font-semibold text-white">{project.name}</span> ({project.projectNumber}) | العميل: <span className="font-semibold text-white">{project.customerName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[75vh]">
          {/* AI Upload Zone */}
          <div className="p-5 bg-emerald-50/70 border-2 border-dashed border-[#007A5A]/40 rounded-2xl text-center space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#007A5A] mx-auto flex items-center justify-center shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                رفع وثيقة أمر شراء العميل أو العقد المعتمد (Upload Client PO / Contract)
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xl mx-auto leading-relaxed">
                يقوم محرك الذكاء الاصطناعي المتقدم بتحليل المستند بالكامل (PDF, صور, Excel) وقراءة جدول الكميات (BOQ) بكافة بنوده، أسعاره، رقم التعميد والقيمة الإجمالية تلقائياً.
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingDoc}
                className="px-5 py-2.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isParsingDoc ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                    <span>جاري تحليل وقراءة وثيقة العقد وجدول الكميات بالذكاء الاصطناعي...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>اختر ملف أمر الشراء / العقد المعتمد (PDF, Excel, صورة)</span>
                  </>
                )}
              </button>
            </div>

            {aiParsedSuccess && (
              <div className="bg-white p-3.5 rounded-xl border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 text-right shadow-xs animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="leading-relaxed">{aiParsedSuccess}</span>
              </div>
            )}

            {parseError && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2 text-right">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Master Contract Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                رقم أمر شراء العميل (Client PO No.) *
              </label>
              <input
                type="text"
                value={clientPONumber}
                onChange={(e) => setClientPONumber(e.target.value)}
                placeholder="مثال: PO#102601143"
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#007A5A] focus:ring-2 focus:ring-[#007A5A]/30 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                تاريخ أمر الشراء / التعميد
              </label>
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#007A5A]/30 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                قيمة العقد بدون ضريبة (Subtotal) <span className="text-[10px] text-emerald-700 font-mono font-bold">[Excl. VAT]</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={contractValue}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setContractValue(val);
                    const vat = Math.round((val * 15) / 100);
                    setVatAmount(vat);
                    setGrandTotal(val + vat);
                  }}
                  className="w-full p-2.5 pl-12 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#007A5A]/30 outline-hidden"
                />
                <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-slate-400">SAR</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                الإجمالي شامل ضريبة 15% (Grand Total) <span className="text-[10px] text-emerald-700 font-mono font-bold">[Incl. 15% VAT]</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={grandTotal}
                  onChange={(e) => setGrandTotal(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 pl-12 bg-white border border-slate-300 rounded-lg font-mono font-bold text-[#007A5A] focus:ring-2 focus:ring-[#007A5A]/30 outline-hidden"
                />
                <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-slate-400">SAR</span>
              </div>
            </div>
          </div>

          {/* Itemized BOQ Table (Editable with Full Add / Delete / Edit capabilities) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#007A5A]" />
                <h4 className="text-xs font-bold text-slate-900">
                  جدول الكميات والبنود المعتمدة تعاقدياً (Itemized Approved BOQ)
                </h4>
                <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-200">
                  {items.length} بنود معتمدة
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#007A5A] border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة بند لجدول الكميات</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 z-10 shadow-xs">
                    <tr>
                      <th className="p-2.5 text-center w-12">#</th>
                      <th className="p-2.5 min-w-[260px]">وصف البند المعتمد</th>
                      <th className="p-2.5 text-center w-24">الكمية</th>
                      <th className="p-2.5 text-center w-20">الوحدة</th>
                      <th className="p-2.5 text-left w-32">
                        <div>سعر الوحدة (SAR)</div>
                        <div className="text-[10px] text-emerald-700 font-mono font-medium">[Excl. VAT]</div>
                      </th>
                      <th className="p-2.5 text-left w-32">
                        <div>الإجمالي (SAR)</div>
                        <div className="text-[10px] text-emerald-700 font-mono font-medium">[Excl. VAT]</div>
                      </th>
                      <th className="p-2.5 text-center w-12">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-2.5 text-center font-bold text-slate-500">
                          {item.itemNo || idx + 1}
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full p-1.5 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#007A5A] rounded font-medium text-slate-900"
                            placeholder="وصف البند..."
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-20 p-1.5 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#007A5A] rounded font-mono font-bold text-slate-800"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-16 p-1.5 text-center bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#007A5A] rounded text-slate-700 font-medium"
                          />
                        </td>
                        <td className="p-2 text-left">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-24 p-1.5 text-left bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#007A5A] rounded font-mono text-slate-700"
                          />
                        </td>
                        <td className="p-2.5 text-left font-mono font-bold text-[#007A5A]">
                          {item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                            title="حذف البند"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              ملاحظات وشروط العقد / أمر الشراء (Contract Notes)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: شروط الدفع 30 يوم من استلام الفاتورة، موقع التسليم الرياض، شروط الاستلام..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#007A5A]/30 outline-hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            {attachmentName && (
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <FileCheck2 className="w-4 h-4" />
                المستند المرفق: <strong className="underline">{attachmentName}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ واعتماد مرجع المشروع (Save Master PO)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
