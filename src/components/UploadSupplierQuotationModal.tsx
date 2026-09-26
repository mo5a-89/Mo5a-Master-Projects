import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  FileSpreadsheet,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  Project,
  QuotationItem,
  Supplier,
  SupplierQuotation,
  SystemDiscipline,
  SYSTEM_DEFINITIONS,
} from '../types';
import { useExecutionLock } from '../utils/executionLock';
import { detectItemSystemDiscipline } from '../utils/quotationUtils';

interface UploadSupplierQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  suppliers: Supplier[];
  selectedProjectId?: string;
  onQuotationExtracted: (
    supplierQuote: SupplierQuotation,
    targetProjectId: string,
    proceedToCustomerQuote: boolean
  ) => void;
}

// Helper to extract table rows directly from Excel spreadsheets with high cost precision and metadata detection
function extractFromExcelBuffer(buffer: ArrayBuffer, targetDiscipline?: SystemDiscipline): {
  items: QuotationItem[];
  rawText: string;
  subtotal: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  vatPercent: number;
  supplierName?: string;
  quotationNumber?: string;
  quotationDate?: string;
  validity?: string;
  deliveryTime?: string;
  paymentTerms?: string;
  warranty?: string;
} {
  const wb = XLSX.read(buffer, { type: 'array' });
  let rawText = '';
  const items: QuotationItem[] = [];
  let detectedSupplierName = '';
  let detectedQuotationNumber = '';
  let detectedQuotationDate = '';
  let detectedValidity = '';
  let detectedDeliveryTime = '';
  let detectedPaymentTerms = '';
  let detectedWarranty = '';
  let detectedFooterSubtotal: number | null = null;
  let detectedFooterVat: number | null = null;
  let detectedFooterGrandTotal: number | null = null;
  let detectedFooterVatPercent = 15;

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws);
    rawText += `=== ورقة عمل (Sheet): ${sheetName} ===\n${csv}\n\n`;

    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!rows || rows.length === 0) return;

    // First scan top 30 rows for quotation metadata (Supplier, Quote No, Date, Terms)
    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] ?? '').trim();
        if (!val) continue;
        const lowerVal = val.toLowerCase();

        // Quotation Number detection
        if (
          (lowerVal.includes('quotation') ||
            lowerVal.includes('quote') ||
            lowerVal.includes('ref') ||
            val.includes('رقم العرض') ||
            val.includes('عرض سعر رقم') ||
            val.includes('عرض رقم')) &&
          !detectedQuotationNumber
        ) {
          const nextVal = String(row[c + 1] ?? '').trim();
          if (nextVal && nextVal.length > 2) {
            detectedQuotationNumber = nextVal;
          } else {
            const parts = val.split(/[:：#-]/);
            if (parts.length > 1 && parts[1].trim()) {
              detectedQuotationNumber = parts[1].trim();
            }
          }
        }

        // Supplier / Company detection
        if (
          (lowerVal.includes('company') ||
            lowerVal.includes('supplier') ||
            lowerVal.includes('vendor') ||
            val.includes('شركة') ||
            val.includes('مؤسسة') ||
            val.includes('المورد')) &&
          !detectedSupplierName
        ) {
          const nextVal = String(row[c + 1] ?? '').trim();
          if (nextVal && nextVal.length > 2) {
            detectedSupplierName = nextVal;
          } else if (val.includes('شركة') || val.includes('مؤسسة')) {
            detectedSupplierName = val;
          }
        }

        // Date detection
        if (
          (lowerVal.includes('date') || val.includes('تاريخ') || val.includes('التاريخ')) &&
          !detectedQuotationDate
        ) {
          const nextVal = String(row[c + 1] ?? '').trim();
          if (nextVal && /\d/.test(nextVal)) {
            detectedQuotationDate = nextVal;
          }
        }

        // Delivery Time detection
        if (
          (lowerVal.includes('delivery') || val.includes('التسليم') || val.includes('التوريد') || val.includes('مدة التوريد')) &&
          !detectedDeliveryTime
        ) {
          const nextVal = String(row[c + 1] ?? '').trim();
          if (nextVal) detectedDeliveryTime = nextVal;
        }

        // Payment terms detection
        if (
          (lowerVal.includes('payment') || val.includes('الدفع') || val.includes('شروط الدفع')) &&
          !detectedPaymentTerms
        ) {
          const nextVal = String(row[c + 1] ?? '').trim();
          if (nextVal) detectedPaymentTerms = nextVal;
        }

        // Warranty detection
        if (
          (lowerVal.includes('warranty') || val.includes('الضمان') || val.includes('فترة الضمان')) &&
          !detectedWarranty
        ) {
          const nextVal = String(row[c + 1] ?? '').trim();
          if (nextVal) detectedWarranty = nextVal;
        }
      }
    }

    let headerRowIdx = -1;
    let descCol = -1;
    let qtyCol = -1;
    let unitCol = -1;
    let unitPriceCol = -1;
    let totalCol = -1;
    let makeCol = -1;
    let modelCol = -1;

    for (let r = 0; r < Math.min(rows.length, 80); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const lowerCells = row.map((c) => String(c ?? '').toLowerCase().trim());

      const foundDesc = lowerCells.findIndex(
        (c) =>
          c.includes('desc') ||
          c.includes('item') ||
          c.includes('material') ||
          c.includes('product') ||
          c.includes('particular') ||
          c.includes('scope') ||
          c.includes('equipment') ||
          c.includes('وصف') ||
          c.includes('بيان') ||
          c.includes('صنف') ||
          c.includes('مادة') ||
          c.includes('المادة') ||
          c.includes('اسم المادة') ||
          c.includes('اسم الصنف') ||
          c.includes('البند') ||
          c.includes('المواصفات') ||
          c.includes('تفاصيل')
      );
      const foundPrice = lowerCells.findIndex(
        (c) =>
          c.includes('unit price') ||
          c.includes('unit cost') ||
          c.includes('net price') ||
          c.includes('unit rate') ||
          c.includes('rate') ||
          c.includes('price') ||
          c.includes('cost') ||
          c.includes('سعر') ||
          c.includes('سعر الوحدة') ||
          c.includes('افرادي') ||
          c.includes('إفرادي') ||
          c.includes('السعر الإفرادي') ||
          c.includes('سعر إفرادي') ||
          c.includes('تكلفة') ||
          c.includes('فردي') ||
          c.includes('قيمة الوحدة')
      );
      const foundQty = lowerCells.findIndex(
        (c) =>
          c.includes('qty') ||
          c.includes('quantity') ||
          c.includes('quant') ||
          c.includes('nos') ||
          c.includes('no.') ||
          c.includes('count') ||
          c.includes('كمية') ||
          c.includes('الكمية') ||
          c.includes('العدد') ||
          c.includes('عدد') ||
          c.includes('الكميات')
      );

      if (foundDesc !== -1 && (foundPrice !== -1 || foundQty !== -1)) {
        headerRowIdx = r;
        descCol = foundDesc;
        qtyCol = foundQty !== -1 ? foundQty : -1;
        unitPriceCol = foundPrice !== -1 ? foundPrice : -1;
        unitCol = lowerCells.findIndex(
          (c) =>
            c.includes('unit') ||
            c.includes('uom') ||
            c.includes('وحدة') ||
            c.includes('الوحدة') ||
            c.includes('القياس')
        );
        totalCol = lowerCells.findIndex(
          (c, i) =>
            i !== unitPriceCol &&
            (c.includes('total') ||
              c.includes('amount') ||
              c.includes('اجمالي') ||
              c.includes('إجمالي') ||
              c.includes('الإجمالي') ||
              c.includes('المجموع') ||
              c.includes('مجموع') ||
              c.includes('القيمة'))
        );
        makeCol = lowerCells.findIndex(
          (c) =>
            c.includes('make') ||
            c.includes('brand') ||
            c.includes('manufacturer') ||
            c.includes('vendor') ||
            c.includes('origin') ||
            c.includes('ماركة') ||
            c.includes('المصنع') ||
            c.includes('المصنّع') ||
            c.includes('الشركة المصنعة') ||
            c.includes('بلد المنشأ')
        );
        modelCol = lowerCells.findIndex(
          (c) =>
            c.includes('model') ||
            c.includes('part') ||
            c.includes('code') ||
            c.includes('ref') ||
            c.includes('cat no') ||
            c.includes('موديل') ||
            c.includes('طراز') ||
            c.includes('كود') ||
            c.includes('رمز الصنف') ||
            c.includes('رقم القطعة')
        );
        break;
      }
    }

    // First, scan all rows for explicit summary / footer totals without summing line items
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map((c) => String(c ?? '').toLowerCase().trim()).join(' ');

      // Find numbers in the row
      const rowNumbers = row
        .map((c) => (typeof c === 'number' ? c : parseFloat(String(c ?? '').replace(/[^0-9.-]+/g, ''))))
        .filter((n) => !isNaN(n) && n > 0);

      const maxNumber = rowNumbers.length > 0 ? rowNumbers[rowNumbers.length - 1] : null;

      if (
        (rowStr.includes('subtotal') ||
          rowStr.includes('sub total') ||
          rowStr.includes('المجموع قبل') ||
          rowStr.includes('المجموع الفرعي') ||
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
          lowerDesc === 'total' ||
          lowerDesc === 'subtotal' ||
          lowerDesc === 'vat' ||
          lowerDesc === 'grand total' ||
          lowerDesc.includes('ضريبة القيمة المضافة') ||
          lowerDesc.includes('المجموع الكلي') ||
          lowerDesc.includes('الإجمالي الكلي')
        ) {
          continue;
        }

        const rawQty =
          qtyCol !== -1
            ? parseFloat(String(row[qtyCol]).replace(/[^0-9.-]+/g, ''))
            : 1;
        const qty = !isNaN(rawQty) && rawQty > 0 ? rawQty : 1;

        const rawUnitPrice =
          unitPriceCol !== -1
            ? parseFloat(String(row[unitPriceCol]).replace(/[^0-9.-]+/g, ''))
            : 0;
        const unitPrice = !isNaN(rawUnitPrice) ? rawUnitPrice : 0;

        const rawTotal =
          totalCol !== -1
            ? parseFloat(String(row[totalCol]).replace(/[^0-9.-]+/g, ''))
            : 0;
        const totalPrice =
          !isNaN(rawTotal) && rawTotal > 0 ? rawTotal : Number((qty * unitPrice).toFixed(2));

        const unit =
          unitCol !== -1 && row[unitCol] ? String(row[unitCol]).trim() : 'Pcs';
        const manufacturer =
          makeCol !== -1 && row[makeCol] ? String(row[makeCol]).trim() : '';
        const model =
          modelCol !== -1 && row[modelCol] ? String(row[modelCol]).trim() : '';

        if (descVal.length > 1 && (unitPrice > 0 || totalPrice > 0 || qty > 0)) {
          items.push({
            id: `excel-item-${Date.now()}-${items.length}`,
            itemNo: items.length + 1,
            description: descVal,
            manufacturer,
            model,
            quantity: qty,
            unit,
            supplierUnitPrice: unitPrice,
            supplierTotalPrice: totalPrice,
            sellingUnitPrice: Number((unitPrice * 1.25).toFixed(2)),
            sellingTotalPrice: Number((totalPrice * 1.25).toFixed(2)),
            system: targetDiscipline || detectItemSystemDiscipline({ description: descVal, manufacturer, model }),
            notes: '',
          });
        }
      }
    }
  });

  return {
    items,
    rawText,
    subtotal: detectedFooterSubtotal,
    vatAmount: detectedFooterVat,
    totalAmount: detectedFooterGrandTotal,
    vatPercent: detectedFooterVatPercent,
    supplierName: detectedSupplierName,
    quotationNumber: detectedQuotationNumber,
    quotationDate: detectedQuotationDate,
    validity: detectedValidity,
    deliveryTime: detectedDeliveryTime,
    paymentTerms: detectedPaymentTerms,
    warranty: detectedWarranty,
  };
}

export const UploadSupplierQuotationModal: React.FC<
  UploadSupplierQuotationModalProps
> = ({
  isOpen,
  onClose,
  projects,
  suppliers,
  selectedProjectId,
  onQuotationExtracted,
}) => {
  const { isLocked, runWithLock } = useExecutionLock();
  const [step, setStep] = useState<'upload' | 'extracting' | 'review'>('upload');
  const [projectId, setProjectId] = useState<string>(
    selectedProjectId || (projects[0]?.id ?? '')
  );

  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localExcelItems, setLocalExcelItems] = useState<QuotationItem[]>([]);

  // Extracted Fields State (Editable by user)
  const [supplierName, setSupplierName] = useState('');
  const [quotationNumber, setQuotationNumber] = useState('');
  const [quotationDate, setQuotationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [validity, setValidity] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const selectedProj = projects.find((p) => p.id === projectId);
  const defaultProjSystem: SystemDiscipline =
    selectedProj?.selectedSystems?.[0] || selectedProj?.systems?.[0] || 'hvac';
  const [systemType, setSystemType] = useState<SystemDiscipline>(defaultProjSystem);

  useEffect(() => {
    if (selectedProj) {
      const s = selectedProj.selectedSystems?.[0] || selectedProj.systems?.[0];
      if (s) {
        setSystemType(s);
      }
    }
  }, [projectId, selectedProj]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [warranty, setWarranty] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [commercialConditions, setCommercialConditions] = useState<string[]>([]);

  // Explicit Footer / Summary Block Figures Extracted from Document
  const [extractedSubtotal, setExtractedSubtotal] = useState<number | null>(null);
  const [extractedVatAmount, setExtractedVatAmount] = useState<number | null>(null);
  const [extractedTotalAmount, setExtractedTotalAmount] = useState<number | null>(null);
  const [extractedVatPercent, setExtractedVatPercent] = useState<number>(15);

  const [items, setItems] = useState<QuotationItem[]>([]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setErrorMsg(null);
    setItems([]);
    setLocalExcelItems([]);
    setExtractedSubtotal(null);
    setExtractedVatAmount(null);
    setExtractedTotalAmount(null);

    const isExcel =
      selectedFile.name.endsWith('.xlsx') ||
      selectedFile.name.endsWith('.xls') ||
      selectedFile.name.endsWith('.csv');

    if (isExcel) {
      try {
        const buffer = await selectedFile.arrayBuffer();
        const extracted = extractFromExcelBuffer(buffer, systemType);
        if (extracted.rawText) {
          setRawText(extracted.rawText);
        }
        if (extracted.supplierName) setSupplierName(extracted.supplierName);
        if (extracted.quotationNumber) setQuotationNumber(extracted.quotationNumber);
        if (extracted.quotationDate) setQuotationDate(extracted.quotationDate);
        if (extracted.validity) setValidity(extracted.validity);
        if (extracted.deliveryTime) setDeliveryTime(extracted.deliveryTime);
        if (extracted.paymentTerms) setPaymentTerms(extracted.paymentTerms);
        if (extracted.warranty) setWarranty(extracted.warranty);

        if (typeof extracted.subtotal === 'number') setExtractedSubtotal(extracted.subtotal);
        if (typeof extracted.vatAmount === 'number') setExtractedVatAmount(extracted.vatAmount);
        if (typeof extracted.totalAmount === 'number') setExtractedTotalAmount(extracted.totalAmount);
        if (typeof extracted.vatPercent === 'number') setExtractedVatPercent(extracted.vatPercent);

        if (extracted.items && extracted.items.length > 0) {
          setLocalExcelItems(extracted.items);
          setItems(extracted.items);
        }
      } catch (err) {
        console.error('Error parsing Excel locally:', err);
      }
    }
  };

  const handleStartExtraction = async () => {
    if (isLocked('supplier-ai-extract')) return;
    if (!file && !rawText.trim() && !fileName) {
      setErrorMsg('يرجى اختيار ملف تسعيرة المورد (PDF، Excel، صورة) أو لصق نص التسعيرة أولاً للبدء بالاستخراج.');
      return;
    }

    await runWithLock('supplier-ai-extract', async () => {
      setStep('extracting');
      setErrorMsg(null);

    const isExcel =
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.csv');

    // Setup 90-second timeout controller for comprehensive multi-page document AI extraction
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      let base64Data = '';
      let mimeType = '';
      let currentLocalItems = [...localExcelItems];

      if (isExcel && file && currentLocalItems.length === 0) {
        try {
          const buffer = await file.arrayBuffer();
          const extracted = extractFromExcelBuffer(buffer, systemType);
          if (extracted.rawText && !rawText) setRawText(extracted.rawText);
          if (extracted.items && extracted.items.length > 0) {
            currentLocalItems = extracted.items;
            setLocalExcelItems(extracted.items);
          }
        } catch (excelErr) {
          console.warn('Excel parse during start extraction:', excelErr);
        }
      }

      if (file && !isExcel) {
        mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64 || '');
          };
          reader.readAsDataURL(file);
        });
      }

      // Determine text payload: prioritize pasted rawText, or complete sheet contents from Excel (up to 500,000 chars)
      let textToSend = rawText ? rawText.slice(0, 500000) : '';
      if (!textToSend && file) {
        textToSend = `File uploaded: ${file.name}`;
      }

      // Call AI endpoint with fallback support
      const response = await fetch('/api/ai/parse-quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          rawText: textToSend,
          fileData: base64Data,
          mimeType: isExcel ? '' : mimeType,
          fileName: fileName || (file ? file.name : 'Uploaded_Quotation.pdf'),
          targetSystemDiscipline: systemType,
        }),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          const d = result.data;
          if (d.supplierName) setSupplierName(d.supplierName);
          if (d.quotationNumber) setQuotationNumber(d.quotationNumber);
          if (d.quotationDate) setQuotationDate(d.quotationDate);
          if (d.validity) setValidity(d.validity);
          if (d.currency) setCurrency(d.currency || 'SAR');
          if (d.deliveryTime) setDeliveryTime(d.deliveryTime);
          if (d.paymentTerms) setPaymentTerms(d.paymentTerms);
          if (d.warranty) setWarranty(d.warranty);
          if (d.technicalNotes?.length) setTechnicalNotes(d.technicalNotes);
          if (d.exclusions?.length) setExclusions(d.exclusions);
          if (d.commercialConditions?.length)
            setCommercialConditions(d.commercialConditions);

          if (typeof d.subtotal === 'number') setExtractedSubtotal(d.subtotal);
          if (typeof d.vatAmount === 'number') setExtractedVatAmount(d.vatAmount);
          if (typeof d.totalAmount === 'number') setExtractedTotalAmount(d.totalAmount);
          if (typeof d.vatPercent === 'number') setExtractedVatPercent(d.vatPercent);

          const extractedList = Array.isArray(d.items) && d.items.length > 0
            ? d.items
            : (Array.isArray(d.lineItems) ? d.lineItems : (Array.isArray(d.materials) ? d.materials : []));

          if (extractedList.length > 0) {
            const mappedItems: QuotationItem[] = extractedList.map(
              (it: any, idx: number) => {
                const qty = Number(it.quantity) || 1;
                const uPrice = Number(it.unitPrice) || Number(it.price) || Number(it.rate) || 0;
                const tPrice = Number(it.totalPrice) || Number(it.amount) || Number((qty * uPrice).toFixed(2));
                return {
                  id: `ai-item-${Date.now()}-${idx}`,
                  itemNo: it.itemNo || idx + 1,
                  description: it.description || it.itemDescription || it.name || 'Quotation Item',
                  manufacturer: it.manufacturer || it.brand || '',
                  model: it.model || it.modelNo || '',
                  quantity: qty,
                  unit: it.unit || 'Pcs',
                  supplierUnitPrice: uPrice,
                  supplierTotalPrice: tPrice,
                  sellingUnitPrice: Number((uPrice * 1.25).toFixed(2)),
                  sellingTotalPrice: Number((tPrice * 1.25).toFixed(2)),
                  system: systemType,
                  notes: it.notes || '',
                };
              }
            );

            // If local Excel parsing found more items or specific items that AI missed, combine them safely
            if (isExcel && currentLocalItems.length > mappedItems.length) {
              setItems(currentLocalItems);
            } else {
              setItems(mappedItems);
            }

            setErrorMsg(null);
            setStep('review');
            return;
          } else if (currentLocalItems.length > 0) {
            setItems(currentLocalItems);
            setErrorMsg(null);
            setStep('review');
            return;
          } else {
            setErrorMsg('تمت قراءة المستند ولكن لم يتم العثور على بنود تسعيرة محددة فيه. يمكنك مراجعة البيانات وإضافة البنود أو إعادة المحاولة.');
            setStep('review');
            return;
          }
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        const userNotice =
          errJson.error ||
          'تشهد خوادم الذكاء الاصطناعي ضغطاً مؤقتاً. يمكنك إعادة المحاولة الآن أو المتابعة للإدخال اليدوي.';
        setErrorMsg(userNotice);
        if (currentLocalItems.length > 0) {
          setItems(currentLocalItems);
          setStep('review');
        } else {
          setStep('upload');
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('Extraction notice or timeout:', err);
      const isTimeout = err?.name === 'AbortError';
      const msg = isTimeout
        ? 'استغرقت عملية الاستخراج وقتاً أطول من المعتاد. يرجى إعادة المحاولة.'
        : 'تعذر الاتصال بالذكاء الاصطناعي حالياً. يرجى إعادة المحاولة.';
      setErrorMsg(msg);
      if (localExcelItems.length > 0) {
        setItems(localExcelItems);
        setStep('review');
      } else {
        setStep('upload');
      }
    }
    });
  };

  const loadSampleDahranQuote = () => {
    setFileName('SFFECO_Dahran_Commercial_Building_Quotation.pdf');
    setSupplierName('SFFECO Global');
    setQuotationNumber('SFF-DHR-8824');
    setQuotationDate('2026-07-15');
    setValidity('15 days');
    setDeliveryTime('6 To 8 weeks');
    setPaymentTerms('30% Down payment along with PO, 70% Upon Delivery.');
    setWarranty('12 Months standard warranty');
    setTechnicalNotes([
      'This item is strictly limited to functional and does not include any programming, reprogramming, or system modifications.',
      'This item does not include repair, replacement, or rectification of any defective, non-compliant devices, during installation.',
      'Prices are based on current market rates and valid for 15 working days, subject to change of the market price.',
    ]);
    setExclusions([
      '15% VAT of the total project price.',
      'Quantities are indicative and estimated based on provided BOQ by the Client.',
    ]);
    setCommercialConditions(['Delivery to site in Dahran.']);
    setItems([
      {
        id: 'item-1',
        itemNo: 1,
        description:
          'Extinguisher. Portable Type. 20 Lbs (9 Kgs). Dry Chemical Powder. SFFECO. Model SF-DC-UL10. UL Listed.',
        manufacturer: 'SFFECO',
        model: 'SF-DC-UL10',
        quantity: 30,
        unit: 'Pcs',
        supplierUnitPrice: 995,
        supplierTotalPrice: 29850,
        sellingUnitPrice: 1243.75,
        sellingTotalPrice: 37312.5,
        system: 'fire_fighting',
        notes: 'UL Listed',
      },
      {
        id: 'item-2',
        itemNo: 2,
        description:
          'Extinguisher. Portable Type. 15 Lbs (6.80 Kgs). CO2. SFFECO. Model SF-CO2-M15. UL Listed.',
        manufacturer: 'SFFECO',
        model: 'SF-CO2-M15',
        quantity: 30,
        unit: 'Pcs',
        supplierUnitPrice: 1840,
        supplierTotalPrice: 55200,
        sellingUnitPrice: 2300,
        sellingTotalPrice: 69000,
        system: 'fire_fighting',
        notes: 'CO2 UL Listed',
      },
      {
        id: 'item-3',
        itemNo: 3,
        description:
          'Hose Reel Cabinet. 1" x 30 M Long Rubber Hose. Surface Type. Back Box Made of Mild Steel. Red Painted. Full Metal Door. SFFECO. Model SF 600 RSD.',
        manufacturer: 'SFFECO',
        model: 'SF 600 RSD',
        quantity: 10,
        unit: 'Pcs',
        supplierUnitPrice: 3740,
        supplierTotalPrice: 37400,
        sellingUnitPrice: 4675,
        sellingTotalPrice: 46750,
        system: 'fire_fighting',
        notes: 'Mild steel surface type',
      },
      {
        id: 'item-4',
        itemNo: 4,
        description:
          'Extinguisher. Automatic Modular Type, with standard accessories. 12 Kg Capacity. Dry Chemical Powder. SFFECO. Model PD 12 Matic.',
        manufacturer: 'SFFECO',
        model: 'PD 12 Matic',
        quantity: 2,
        unit: 'Pcs',
        supplierUnitPrice: 540,
        supplierTotalPrice: 1080,
        sellingUnitPrice: 675,
        sellingTotalPrice: 1350,
        system: 'fire_fighting',
        notes: 'Modular ceiling mounted',
      },
    ]);
    setRawText(`SFFECO GLOBAL - Quotation Ref: SFF-DHR-8824
Date: 15-July-2026
Client: مؤسسة صناع الموارد التجاريه - Resource Makers Trading Est. (RMT)
Project: Commercial Building - Dahran
1. Extinguisher 20 Lbs Dry Chemical Powder SF-DC-UL10 Qty 30 @ 995 SAR
2. Extinguisher 15 Lbs CO2 SF-CO2-M15 Qty 30 @ 1840 SAR
3. Hose Reel Cabinet 1" x 30 M SF 600 RSD Qty 10 @ 3740 SAR
4. Extinguisher Automatic Modular 12 Kg PD 12 Matic Qty 2 @ 540 SAR
Subtotal [Excl. VAT]: 123,530.00 SAR
VAT 15%: 18,529.50 SAR
Total [Incl. 15% VAT]: 142,059.50 SAR. Delivery: 6-8 weeks.`);
    setExtractedSubtotal(123530);
    setExtractedVatAmount(18529.5);
    setExtractedTotalAmount(142059.5);
    setExtractedVatPercent(15);
  };

  // Item modification handlers
  const handleItemChange = (
    index: number,
    field: keyof QuotationItem,
    value: any
  ) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'supplierUnitPrice') {
      const q = Number(item.quantity) || 0;
      const p = Number(item.supplierUnitPrice) || 0;
      item.supplierTotalPrice = Number((q * p).toFixed(2));
    }
    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    const newItem: QuotationItem = {
      id: `manual-item-${Date.now()}`,
      itemNo: items.length + 1,
      description: 'New Equipment Item',
      manufacturer: '',
      model: '',
      quantity: 1,
      unit: 'Pcs',
      supplierUnitPrice: 0,
      supplierTotalPrice: 0,
      sellingUnitPrice: 0,
      sellingTotalPrice: 0,
      system: systemType,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  // STRICT PARSER TOTALS OVERRIDE & RECALCULATION BAN:
  // Strictly mirror extracted footer summary figures with zero recalculation or rounding changes
  const computedItemsSum = items.reduce(
    (sum, it) => sum + (Number(it.supplierTotalPrice) || 0),
    0
  );
  const subtotal =
    extractedSubtotal !== null && extractedSubtotal > 0
      ? extractedSubtotal
      : computedItemsSum;
  const vat =
    extractedVatAmount !== null && extractedVatAmount >= 0
      ? extractedVatAmount
      : Number((subtotal * ((extractedVatPercent || 15) / 100)).toFixed(2));
  const grandTotal =
    extractedTotalAmount !== null && extractedTotalAmount > 0
      ? extractedTotalAmount
      : Number((subtotal + vat).toFixed(2));

  const handleConfirmAndProceed = (proceedToCustomerQuote: boolean) => {
    const supplierQuoteRecord: SupplierQuotation = {
      id: `supp-quote-${Date.now()}`,
      projectId: projectId || projects[0]?.id || 'proj-1',
      supplierName,
      quotationNumber,
      date: quotationDate,
      validity,
      currency,
      systemType,
      rawFileName: fileName || 'Uploaded_Quotation.pdf',
      rawFileType: file?.type || 'application/pdf',
      rawTextPreview: rawText,
      originalStatus: 'original_kept',
      items,
      subtotal,
      vatPercent: 15,
      vatAmount: vat,
      totalAmount: grandTotal,
      deliveryTime,
      paymentTerms,
      warranty,
      technicalNotes,
      exclusions,
      commercialConditions,
      createdAt: new Date().toISOString(),
    };

    onQuotationExtracted(
      supplierQuoteRecord,
      projectId || projects[0]?.id || 'proj-1',
      proceedToCustomerQuote
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#007A5A] to-[#0d5f4e] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
              <Upload className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <span>رفع تسعيرة المورد</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 font-mono">
                  Upload Supplier Quotation
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90">
                PDF, Excel, Word, Image, or Scanned Documents with AI Extraction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Target Project & Target Discipline Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Select Target Project (المشروع المستهدف)
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#007A5A] outline-none"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectNumber} - {p.name} ({p.customerName})
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-slate-500 mt-1">
                    All extracted costs will link to this project's margin analysis.
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Target Discipline (نظام التخصص الهندسي)
                    </label>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      إلزامي للمطابقة
                    </span>
                  </div>
                  <select
                    value={systemType}
                    onChange={(e) => {
                      const newSys = e.target.value as SystemDiscipline;
                      setSystemType(newSys);
                      setItems((prev) => prev.map((it) => ({ ...it, system: newSys })));
                      setLocalExcelItems((prev) => prev.map((it) => ({ ...it, system: newSys })));
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-[#007A5A] outline-none"
                  >
                    {SYSTEM_DEFINITIONS.map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {sys.nameEn} ({sys.nameAr})
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                    تُقفل كافة البنود المستخرجة من هذا الملف مباشرة تحت هذا التخصص الهندسي.
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-[#007A5A] bg-slate-50/50 hover:bg-emerald-50/20 rounded-xl p-8 text-center transition cursor-pointer relative group">
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.webp,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-100/70 text-[#007A5A] flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-800">
                    {fileName ? (
                      <span className="text-[#007A5A] font-bold">{fileName}</span>
                    ) : (
                      'Choose a supplier file or drag & drop here'
                    )}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Supports PDF, Excel (.xlsx/.xls), Word (.docx), Scanned Images (.png, .jpg), or Technical BOQ
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                      <ShieldCheck className="w-3.5 h-3.5" /> Original file will be preserved
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Sample Selector */}
              <div className="flex items-center justify-between text-xs bg-slate-100 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-600 font-medium">
                  Testing quotation conversion?
                </span>
                <button
                  type="button"
                  onClick={loadSampleDahranQuote}
                  className="text-[#007A5A] hover:underline font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Load Dahran Fire Fighting Sample Quotation (123,530 SAR)
                </button>
              </div>

              {/* Paste Text / Notes Box (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Or Paste Quotation Content / Technical BOQ Text Directly:
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste table or pricing text from email, WhatsApp, or supplier portal here..."
                  rows={4}
                  className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#007A5A] outline-none"
                />
              </div>

              {errorMsg && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-2.5 shadow-sm">
                  <div className="flex items-start gap-2.5 text-amber-950 font-semibold">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block text-amber-900 mb-0.5">
                        ملاحظة استخراج الذكاء الاصطناعي
                      </span>
                      <p className="text-amber-800 font-normal">{errorMsg}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/70">
                    <button
                      type="button"
                      onClick={handleStartExtraction}
                      className="px-3 py-1.5 bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg font-bold flex items-center gap-1.5 text-xs transition shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      إعادة المحاولة بالذكاء الاصطناعي (Retry AI)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (localExcelItems.length > 0) setItems(localExcelItems);
                        setStep('review');
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-semibold text-xs transition"
                    >
                      المتابعة للإدخال اليدوي المباشر
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'extracting' && (
            <div className="py-12 px-6 text-center space-y-6">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 border-4 border-emerald-200 rounded-full" />
                <div className="w-16 h-16 border-4 border-[#007A5A] border-t-transparent rounded-full animate-spin absolute inset-0" />
                <Sparkles className="w-6 h-6 text-[#007A5A] absolute inset-0 m-auto animate-pulse" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-800">
                  جاري الاستخراج بالذكاء الاصطناعي...
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  يقوم الذكاء الاصطناعي بقراءة وتدقيق ملف التسعيرة، واستخراج أسماء الموردين، جداول الأصناف، المواصفات، وأسعار التكلفة الصافية.
                </p>
              </div>

              <div className="max-w-sm mx-auto bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 text-right space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>قراءة ملف المستند وتحديد الجداول والبنود</span>
                </div>
                <div className="flex items-center gap-2 text-[#007A5A] font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
                  <span>مطابقة الماركات، الموديلات، والكميات</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                  <span>حساب أسعار التكلفة وإعداد جدول التسعيرة</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (localExcelItems.length > 0) setItems(localExcelItems);
                    setStep('review');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
                >
                  <span>تخطي للإدخال اليدوي المباشر</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              {/* Review Guidance or Capacity Alert Banner */}
              {errorMsg ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 text-xs shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-sm text-amber-900 mb-0.5">
                        ملاحظة المعالجة (AI Service Notice)
                      </span>
                      <p className="text-amber-800 leading-relaxed">{errorMsg}</p>
                      <p className="text-[11px] text-amber-700 mt-1">
                        يمكنك مراجعة وتعديل بنود التسعيرة والأسعار يدوياً أدناه، أو النقر على زر إعادة المحاولة لاستدعاء الذكاء الاصطناعي مجدداً.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartExtraction}
                    className="px-3 py-1.5 bg-[#007A5A] hover:bg-[#006248] active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shrink-0 transition shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    إعادة المحاولة (Retry AI)
                  </button>
                </div>
              ) : items.length > 0 ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-emerald-950 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">
                      تم استخراج {items.length} بنود وتفاصيل التسعيرة بنجاح — راجع وعدّل الحقول قبل الاعتماد:
                    </span>{' '}
                    Review and manually edit every extracted field before using it. Your original file remains securely preserved.
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sky-950 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block">
                        تمت قراءة بيانات المورد من المستند بنجاح:
                      </span>
                      <span>
                        لم يتم التعرف على جدول أصناف منفصل في ملف الـ PDF. يمكنك إضافة البنود والأسعار يدوياً عبر زر "إضافة بند جديد" أو النقر على "إعادة المحاولة بالذكاء الاصطناعي".
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleStartExtraction}
                      className="px-3 py-1.5 bg-[#007A5A] hover:bg-[#006248] text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      إعادة المحاولة (Retry AI)
                    </button>
                  </div>
                </div>
              )}

              {/* Supplier & Header Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    اسم المورد (Supplier Name)
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#007A5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    رقم التسعيرة (Quote #)
                  </label>
                  <input
                    type="text"
                    value={quotationNumber}
                    onChange={(e) => setQuotationNumber(e.target.value)}
                    className="w-full text-xs font-mono px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#007A5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    التاريخ (Date)
                  </label>
                  <input
                    type="date"
                    value={quotationDate}
                    onChange={(e) => setQuotationDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#007A5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    مدة الصلاحية (Validity)
                  </label>
                  <input
                    type="text"
                    value={validity}
                    onChange={(e) => setValidity(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#007A5A] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    نظام التخصص (Discipline)
                  </label>
                  <select
                    value={systemType}
                    onChange={(e) => {
                      const newSys = e.target.value as SystemDiscipline;
                      setSystemType(newSys);
                      setItems((prev) => prev.map((it) => ({ ...it, system: newSys })));
                    }}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#007A5A] outline-none font-semibold text-slate-800"
                  >
                    {SYSTEM_DEFINITIONS.map((sys) => (
                      <option key={sys.id} value={sys.id}>
                        {sys.nameEn} ({sys.nameAr})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    مدة التوريد (Delivery Time)
                  </label>
                  <input
                    type="text"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#007A5A] outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    شروط الدفع (Payment Terms)
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#007A5A] outline-none"
                  />
                </div>
              </div>

              {/* Extracted Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span>جدول بنود التسعيرة والأسعار</span>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
                      {items.length} Items
                    </span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-[#007A5A] hover:bg-emerald-50 px-2 py-1 rounded flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة بند جديد
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Description & Specs</th>
                        <th className="py-2.5 px-2 w-24">Brand / Model</th>
                        <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                        <th className="py-2.5 px-2 w-16 text-center">Unit</th>
                        <th className="py-2.5 px-3 w-32 text-right">
                          <div className="font-bold">Unit Cost (SAR)</div>
                          <div className="text-[10px] text-emerald-700 font-mono font-medium">[Excl. VAT]</div>
                        </th>
                        <th className="py-2.5 px-3 w-32 text-right">
                          <div className="font-bold">Total Cost (SAR)</div>
                          <div className="text-[10px] text-emerald-700 font-mono font-medium">[Excl. VAT]</div>
                        </th>
                        <th className="py-2.5 px-2 w-10 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center bg-slate-50/50">
                            <p className="text-xs text-slate-500 font-medium">
                              لم يتم إدراج أي بنود بعد في جدول الأسعار.
                            </p>
                            <div className="mt-3 flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={handleAddItem}
                                className="px-3.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-[#007A5A] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition"
                              >
                                <Plus className="w-3.5 h-3.5" /> إضافة بند جديد (Add Item)
                              </button>
                              <button
                                type="button"
                                onClick={loadSampleDahranQuote}
                                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition"
                              >
                                <Sparkles className="w-3.5 h-3.5" /> استيراد نموذج بنود تجريبي
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-2 px-3 text-center font-mono text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <textarea
                                value={item.description}
                                onChange={(e) =>
                                  handleItemChange(idx, 'description', e.target.value)
                                }
                                rows={2}
                                className="w-full text-xs p-1 border border-slate-200 rounded focus:border-[#007A5A] outline-none"
                              />
                            </td>
                            <td className="py-2 px-2 space-y-1">
                              <input
                                type="text"
                                value={item.manufacturer}
                                placeholder="Brand"
                                onChange={(e) =>
                                  handleItemChange(idx, 'manufacturer', e.target.value)
                                }
                                className="w-full text-xs p-1 border border-slate-200 rounded outline-none"
                              />
                              <input
                                type="text"
                                value={item.model}
                                placeholder="Model"
                                onChange={(e) =>
                                  handleItemChange(idx, 'model', e.target.value)
                                }
                                className="w-full text-xs p-1 border border-slate-200 rounded outline-none"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(idx, 'quantity', Number(e.target.value))
                                }
                                className="w-14 text-center text-xs p-1 border border-slate-200 rounded outline-none"
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) =>
                                  handleItemChange(idx, 'unit', e.target.value)
                                }
                                className="w-14 text-center text-xs p-1 border border-slate-200 rounded outline-none"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={item.supplierUnitPrice}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'supplierUnitPrice',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-24 text-right text-xs p-1 border border-slate-200 rounded outline-none font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                              {item.supplierTotalPrice.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-red-500 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Subtotal & Totals Summary */}
                <div className="flex justify-end pt-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 w-72 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>إجمالي سعر المورد (Subtotal) <span className="text-[10px] font-mono text-emerald-700 font-bold">[Excl. VAT]</span>:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {subtotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        SAR
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>ضريبة القيمة المضافة <span className="text-[10px] font-mono text-emerald-700 font-bold">[VAT 15%]</span>:</span>
                      <span className="font-mono font-semibold">
                        {vat.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        SAR
                      </span>
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900">
                      <span>الإجمالي شامل الضريبة <span className="text-[10px] font-mono text-emerald-800 font-bold">[Incl. 15% VAT]</span>:</span>
                      <span className="font-mono text-[#007A5A] text-sm">
                        {grandTotal.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        SAR
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {step === 'upload' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel (إلغاء)
              </button>
              <button
                type="button"
                disabled={isLocked('supplier-ai-extract')}
                onClick={handleStartExtraction}
                className={`px-5 py-2.5 text-xs font-bold bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg shadow-sm flex items-center gap-2 transition ${
                  isLocked('supplier-ai-extract') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${isLocked('supplier-ai-extract') ? 'animate-spin' : ''}`} />
                <span>{isLocked('supplier-ai-extract') ? 'جاري الاستخراج بالذكاء الاصطناعي...' : 'استخراج التسعيرة بالذكاء الاصطناعي (Extract Data)'}</span>
              </button>
            </>
          ) : step === 'review' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-upload or edit raw
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmAndProceed(false)}
                  className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition"
                >
                  Save Supplier Quote Only (حفظ فقط)
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAndProceed(true)}
                  className="px-5 py-2.5 text-xs font-bold bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg shadow-md flex items-center gap-2 transition"
                >
                  <span>تسعير للعميل الآن (Price for Customer)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
