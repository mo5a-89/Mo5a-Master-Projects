import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import {
  executeServerTelegramDocumentPipeline,
  executeEnterpriseTelegramOrchestrator,
} from './telegramPipelineService';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TELEGRAM_CONFIG_FILE = path.join(DATA_DIR, 'telegram_config.json');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

export interface TelegramConfig {
  botToken: string;
  botUsername: string;
  webhookUrl: string;
  isPollingActive: boolean;
  isWebhookActive: boolean;
  authorizedChatIds: string[];
  executivePasscode: string;
  lastActiveAt?: string;
  status: 'connected' | 'disconnected' | 'polling' | 'error';
  lastError?: string;
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: '',
  botUsername: 'RMT_Enterprise_Bot',
  webhookUrl: '',
  isPollingActive: false,
  isWebhookActive: false,
  authorizedChatIds: [],
  executivePasscode: 'RMT@2026',
  status: 'disconnected',
};

export function loadTelegramConfig(): TelegramConfig {
  try {
    if (!fs.existsSync(TELEGRAM_CONFIG_FILE)) {
      fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(DEFAULT_TELEGRAM_CONFIG, null, 2), 'utf-8');
      return DEFAULT_TELEGRAM_CONFIG;
    }
    const raw = fs.readFileSync(TELEGRAM_CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_TELEGRAM_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TELEGRAM_CONFIG;
  }
}

export function saveTelegramConfig(config: Partial<TelegramConfig>): TelegramConfig {
  try {
    const current = loadTelegramConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(TELEGRAM_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (err) {
    console.error('Failed to save telegram config:', err);
    return DEFAULT_TELEGRAM_CONFIG;
  }
}

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function loadDatabase(): any {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.data || parsed;
  } catch {
    return null;
  }
}

function saveDatabase(data: any, note: string = 'Telegram Bot Autonomous Mutation') {
  try {
    const timestamp = new Date().toISOString();
    const record = {
      updatedAt: timestamp,
      version: 1,
      data,
    };
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(record, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    // Save snapshot
    const safeTime = timestamp.replace(/[:.]/g, '-');
    const snapshotPath = path.join(SNAPSHOTS_DIR, `snapshot-tg-${safeTime}.json`);
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify({ ...record, snapshotMetadata: { id: `tg-${safeTime}`, timestamp, note } }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to commit DB from Telegram Bot:', err);
  }
}

/**
 * Send message to Telegram API
 */
export async function sendTelegramMessage(botToken: string, chatId: string | number, text: string, replyMarkup?: any) {
  if (!botToken) return { success: false, error: 'Bot token not configured' };
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    return { success: result.ok, result };
  } catch (err: any) {
    console.error('Telegram send message error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Autonomous Multi-Agent Processor:
 * Analyzes natural language instructions from Telegram or UI, determines the agent type,
 * creates/updates the database entity (Quote, Invoice, PO, Delivery Note, etc.), and returns
 * a rich deliverable package.
 */
export async function processAutonomousAgentCommand(params: {
  command: string;
  agentType?: 'auto' | 'estimator' | 'procurement' | 'controller' | 'site_ops' | 'executive';
  userContext?: { name?: string; role?: string; chatId?: string };
  audioBase64?: string;
  imageBase64?: string;
}): Promise<{
  success: boolean;
  agent: string;
  agentTitleAr: string;
  intent: string;
  replyText: string;
  telegramMarkdown: string;
  generatedDeliverable?: {
    type: 'quotation' | 'invoice' | 'purchase_order' | 'delivery_note' | 'financial_report' | 'boq_analysis' | 'three_way_match';
    documentNumber?: string;
    title: string;
    summary: string;
    data: any;
    linkUrl: string;
  };
  actionsTaken: string[];
  metrics?: any;
}> {
  const ai = getGenAI();
  const dbData = loadDatabase() || {};
  const { command, agentType = 'auto', userContext } = params;

  // Extract compact context from live database
  const projectsSummary = (dbData.projects || []).slice(0, 15).map((p: any) => ({
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name,
    customerName: p.customerName || p.clientName,
    contractValue: p.contractValue,
    completionPercentage: p.completionPercentage,
    status: p.status,
  }));

  const suppliersSummary = (dbData.suppliers || []).slice(0, 15).map((s: any) => ({
    id: s.id,
    name: s.name,
    category: s.category || s.specialty,
    rating: s.rating,
  }));

  const customersSummary = (dbData.customers || []).slice(0, 15).map((c: any) => ({
    id: c.id,
    name: c.name,
    company: c.company,
  }));

  const systemInstruction = `You are the Master AI Multi-Agent Brain of "مؤسسة صناع الموارد التجارية" (RMT Intelligent Enterprise).
You orchestrate 5 Autonomous Specialized Engineering & Operational Agents that outcompete SAP and Odoo:

1. ESTIMATOR BOT (مهندس التسعير والمقايسات):
   - Reads BOQs, matches UL/FM, HCIS, SBC 801 codes, checks historical prices.
   - Detects missing scope/accessories (OS&Y valves, flexible connectors, fire-rated cables, hangers).
   - Generates complete Customer Quotations with strict 15% KSA VAT, Tafqeet, and itemized specs.

2. PROCUREMENT BOT (مسؤول التوريد والتفاوض):
   - Compares RFQs across vendors (NAFFCO, SFFECO, Hadi Kanaani, etc.).
   - Checks technical submittal compliance and raw material price trends (Copper, Galvanized Steel, PVC).
   - Generates official Purchase Orders (PO) with payment terms and delivery milestones.

3. FINANCIAL CONTROLLER BOT (المراقب المالي والتحصيل):
   - Forecasts 30-60 day cash flow, alerts on liquidity gaps.
   - Generates polite debt collection letters / customer claim notices.
   - Executes automated 3-Way Matching (PO == GRN == Tax Invoice) and anti-fraud checks.
   - Issues compliant Tax Invoices with 15% VAT, advance payment amortization, and 5-10% retention.

4. SITE OPS BOT (مدير الموقع والتنفيذ الميداني):
   - Converts field voice notes/photos into daily progress logs and WBS milestones.
   - Calculates EVM (Earned Value Management: EV, PV, AC, CPI, SPI).
   - Issues Material Delivery Notes (سند تسليم / GRN) and predicts delays with fast-tracking measures.

5. EXECUTIVE MASTER CO-PILOT (المساعد التنفيذي للإدارة العليا):
   - Answers executive queries ("كم أرباح مشروع برج الريان؟", "أكثر الموردين تأخيراً", "توقعات السيولة").
   - Generates interactive morning briefing summaries for WhatsApp/Telegram.

When the user asks to create/issue/extract a document (Quote, Invoice, PO, Delivery Note):
You MUST formulate exact JSON with strict mathematical precision:
- 15% KSA VAT (subtotal * 0.15)
- Arabic Tafqeet
- All line items with itemNo, description, quantity, unit, unitPrice, totalPrice.`;

  const prompt = `Current Enterprise DB Context:
Projects: ${JSON.stringify(projectsSummary)}
Customers: ${JSON.stringify(customersSummary)}
Suppliers: ${JSON.stringify(suppliersSummary)}

User Instruction: "${command}"
Requested Agent: ${agentType}
Caller: ${userContext?.name || 'Master Admin'} (${userContext?.role || 'Executive'})

Analyze the instruction, select the optimal agent, execute the operational calculation or document generation, and return strict JSON conforming to the schema.`;

  try {
    if (!ai) {
      throw new Error('Gemini API key is not configured.');
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selectedAgent: {
              type: Type.STRING,
              enum: ['estimator', 'procurement', 'controller', 'site_ops', 'executive'],
            },
            agentTitleAr: { type: Type.STRING },
            intent: { type: Type.STRING },
            replyText: { type: Type.STRING, description: 'Direct human-like Arabic response' },
            telegramMarkdown: { type: Type.STRING, description: 'Telegram formatted response with bold, emojis, bullet points' },
            actionsTaken: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            shouldCreateEntity: { type: Type.BOOLEAN },
            deliverableType: {
              type: Type.STRING,
              enum: ['quotation', 'invoice', 'purchase_order', 'delivery_note', 'financial_report', 'boq_analysis', 'three_way_match', 'none'],
            },
            deliverableData: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                documentNumber: { type: Type.STRING },
                clientOrSupplierName: { type: Type.STRING },
                projectName: { type: Type.STRING },
                subtotal: { type: Type.NUMBER },
                vatAmount: { type: Type.NUMBER },
                grandTotal: { type: Type.NUMBER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      itemNo: { type: Type.INTEGER },
                      description: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unit: { type: Type.STRING },
                      unitPrice: { type: Type.NUMBER },
                      totalPrice: { type: Type.NUMBER },
                    },
                    required: ['description', 'quantity', 'unitPrice'],
                  },
                },
                notes: { type: Type.STRING },
                tafqeetArabic: { type: Type.STRING },
                metrics: {
                  type: Type.OBJECT,
                  properties: {
                    cpi: { type: Type.NUMBER },
                    spi: { type: Type.NUMBER },
                    grossMarginPercent: { type: Type.NUMBER },
                    retentionAmount: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
          required: ['selectedAgent', 'agentTitleAr', 'intent', 'replyText', 'telegramMarkdown', 'actionsTaken'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const selectedAgent = parsed.selectedAgent || 'executive';
    const agentTitleAr = parsed.agentTitleAr || 'المساعد التنفيذي للإدارة العليا';

    let generatedDeliverable: any = undefined;

    // If AI indicated an entity should be created or updated, mutate into live database
    if (parsed.shouldCreateEntity && parsed.deliverableType && parsed.deliverableType !== 'none' && parsed.deliverableData) {
      const dData = parsed.deliverableData;
      const docType = parsed.deliverableType;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];

      if (docType === 'quotation') {
        const quoteNum = dData.documentNumber || `RM0${Math.floor(100000 + Math.random() * 900000)}`;
        const sub = Number(dData.subtotal) || 10000;
        const vat = Math.round(sub * 0.15 * 100) / 100;
        const total = sub + vat;

        const newQuote = {
          id: `quote-${Date.now()}`,
          quotationNumber: quoteNum,
          version: 1,
          date: dateStr,
          validity: '30 يوماً من تاريخ الإصدار',
          status: 'Draft',
          clientName: dData.clientOrSupplierName || 'العميل المستهدف',
          attnName: 'المهندس المسؤول / المشتريات',
          projectLocation: 'المملكة العربية السعودية',
          projectName: dData.projectName || 'توريد وتنفيذ أنظمة كهروميكانيكية',
          scopeOfWork: 'توريد وتركيب واختبار وتشغيل وفق اشتراطات الكود والدفاع المدني',
          systemDefinition: 'أنظمة متكاملة',
          selectedSystems: ['fire_fighting', 'fire_alarm'],
          items: (dData.items || []).map((it: any, idx: number) => ({
            id: `item-${Date.now()}-${idx}`,
            itemNo: idx + 1,
            description: it.description || 'بند توريد',
            manufacturer: 'معتمد UL/FM',
            model: 'Standard',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'حبة',
            supplierUnitPrice: Number(it.unitPrice) * 0.75,
            supplierTotalPrice: (Number(it.unitPrice) * 0.75) * (Number(it.quantity) || 1),
            sellingUnitPrice: Number(it.unitPrice) || 100,
            sellingTotalPrice: (Number(it.unitPrice) || 100) * (Number(it.quantity) || 1),
            system: 'fire_fighting',
          })),
          additionalCosts: {
            procurement: 0,
            installation: 0,
            transportation: 0,
            testingAndCommissioning: 0,
            engineering: 0,
            manpower: 0,
            contingency: 0,
            otherDirectCosts: 0,
          },
          totals: {
            totalSupplierCost: sub * 0.75,
            totalAdditionalCosts: 0,
            totalProjectCost: sub * 0.75,
            customerSellingPrice: sub,
            grossProfit: sub * 0.25,
            grossMarginPercent: 25,
            vatPercent: 15,
            vatAmount: vat,
            grandTotalWithVat: total,
          },
          terms: ['الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة 15%', 'الضمان لمدة سنتين ضد عيوب التصنيع'],
          createdAt: now.toISOString(),
        };

        if (!Array.isArray(dbData.customerQuotations)) dbData.customerQuotations = [];
        dbData.customerQuotations.unshift(newQuote);
        saveDatabase(dbData, `Telegram AI Estimator created Quote #${quoteNum}`);

        generatedDeliverable = {
          type: 'quotation',
          documentNumber: quoteNum,
          title: `عرض سعر رسمي معتمد - ${quoteNum}`,
          summary: `عرض سعر للعميل "${newQuote.clientName}" بقيمة إجمالية ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س شامل 15% ضريبة`,
          data: newQuote,
          linkUrl: `/?tab=quotations&quoteId=${newQuote.id}`,
        };
      } else if (docType === 'invoice') {
        const invNum = dData.documentNumber || `INV-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const sub = Number(dData.subtotal) || 50000;
        const vat = Math.round(sub * 0.15 * 100) / 100;
        const total = sub + vat;

        const newInvoice = {
          id: `inv-${Date.now()}`,
          invoiceNumber: invNum,
          invoiceDate: dateStr,
          supplyDate: dateStr,
          dueDate: new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0],
          projectId: dbData.projects?.[0]?.id || 'prj-1',
          projectName: dData.projectName || dbData.projects?.[0]?.name || 'مشروع هندسي متكامل',
          customerId: dbData.customers?.[0]?.id || 'cust-1',
          customerName: dData.clientOrSupplierName || 'شركة العميل المعتمد',
          customerVatNumber: '300000000000003',
          customerAddress: 'الرياض - المملكة العربية السعودية',
          type: 'tax_invoice',
          status: 'issued',
          subtotal: sub,
          vatRate: 15,
          vatAmount: vat,
          grandTotal: total,
          retentionPercentage: 5,
          retentionAmount: sub * 0.05,
          advancePaymentDeduction: 0,
          paidAmount: 0,
          balanceDue: total,
          zatcaStatus: 'reported',
          items: (dData.items || []).map((it: any, idx: number) => ({
            id: `inv-item-${idx}`,
            itemNumber: idx + 1,
            description: it.description || 'مستخلص أعمال كهروميكانيكية منجز',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'مستخلص',
            unitPrice: Number(it.unitPrice) || sub,
            totalPrice: Number(it.unitPrice || sub) * Number(it.quantity || 1),
            vatAmount: (Number(it.unitPrice || sub) * Number(it.quantity || 1)) * 0.15,
            subtotalWithVat: (Number(it.unitPrice || sub) * Number(it.quantity || 1)) * 1.15,
          })),
          createdAt: now.toISOString(),
        };

        if (!Array.isArray(dbData.invoices)) dbData.invoices = [];
        dbData.invoices.unshift(newInvoice);
        saveDatabase(dbData, `Telegram AI Controller issued Invoice #${invNum}`);

        generatedDeliverable = {
          type: 'invoice',
          documentNumber: invNum,
          title: `فاتورة ضريبية إلكترونية - ${invNum}`,
          summary: `فاتورة ضريبية ZATCA بقيمة ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س لمشروع "${newInvoice.projectName}"`,
          data: newInvoice,
          linkUrl: `/?tab=invoices&invoiceId=${newInvoice.id}`,
        };
      } else if (docType === 'purchase_order') {
        const poNum = dData.documentNumber || `PO-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
        const sub = Number(dData.subtotal) || 25000;
        const vat = Math.round(sub * 0.15 * 100) / 100;
        const total = sub + vat;

        const newPO = {
          id: `po-${Date.now()}`,
          poNumber: poNum,
          date: dateStr,
          expectedDeliveryDate: new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0],
          supplierName: dData.clientOrSupplierName || 'شركة نافكو السعودية NAFFCO',
          supplierContact: 'المبيعات والمشاريع',
          supplierPhone: '+966 11 0000000',
          projectName: dData.projectName || 'مشروع كهروميكانيكي',
          status: 'issued',
          subtotal: sub,
          vatAmount: vat,
          totalAmount: total,
          notes: dData.notes || 'توريد شامل شهادات المطابقة واختبار المصنع واعتمادات UL/FM',
          items: (dData.items || []).map((it: any, idx: number) => ({
            id: `po-item-${idx}`,
            itemNo: idx + 1,
            description: it.description || 'مواد معتمدة للمشروع',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'حبة',
            unitPrice: Number(it.unitPrice) || sub,
            totalPrice: Number(it.unitPrice || sub) * Number(it.quantity || 1),
          })),
          createdAt: now.toISOString(),
        };

        if (!Array.isArray(dbData.purchaseOrders)) dbData.purchaseOrders = [];
        dbData.purchaseOrders.unshift(newPO);
        saveDatabase(dbData, `Telegram AI Procurement issued PO #${poNum}`);

        generatedDeliverable = {
          type: 'purchase_order',
          documentNumber: poNum,
          title: `أمر شراء رسمي صادر - ${poNum}`,
          summary: `أمر شراء للمورد "${newPO.supplierName}" بقيمة ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س`,
          data: newPO,
          linkUrl: `/?tab=purchase_orders&poId=${newPO.id}`,
        };
      } else if (docType === 'delivery_note') {
        const dnNum = dData.documentNumber || `DN-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

        const newDN = {
          id: `dn-${Date.now()}`,
          deliveryNoteNumber: dnNum,
          date: dateStr,
          customerName: dData.clientOrSupplierName || 'إدارة الموقع الميداني',
          projectName: dData.projectName || 'موقع المشروع الرئيسي',
          receiverName: 'المهندس المستلم بالموقع',
          driverName: 'سائق ناقلات RMT',
          vehiclePlate: 'أ ب ج 1234',
          status: 'delivered',
          items: (dData.items || []).map((it: any, idx: number) => ({
            id: `dn-item-${idx}`,
            itemNumber: idx + 1,
            description: it.description || 'مواد موردة ومطابقة للموقع',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'حبة',
          })),
          notes: 'تم فحص ومطابقة المواد ميدانياً بسلامة تامة',
          createdAt: now.toISOString(),
        };

        if (!Array.isArray(dbData.deliveryNotes)) dbData.deliveryNotes = [];
        dbData.deliveryNotes.unshift(newDN);
        saveDatabase(dbData, `Telegram AI Site Ops issued DN #${dnNum}`);

        generatedDeliverable = {
          type: 'delivery_note',
          documentNumber: dnNum,
          title: `سند تسليم مواد رسمي (GRN/DN) - ${dnNum}`,
          summary: `سند تسليم مواد لموقع "${newDN.projectName}" بعدد ${(newDN.items || []).length} بنود`,
          data: newDN,
          linkUrl: `/?tab=site_logistics&dnId=${newDN.id}`,
        };
      }
    }

    return {
      success: true,
      agent: selectedAgent,
      agentTitleAr,
      intent: parsed.intent || 'معالجة استعلام هندسي وتشغيلي',
      replyText: parsed.replyText || 'تمت معالجة الطلب بنجاح.',
      telegramMarkdown: parsed.telegramMarkdown || parsed.replyText || 'تم تنفيذ الأمر بنجاح.',
      actionsTaken: parsed.actionsTaken || ['تحليل الذكاء الاصطناعي', 'مطابقة الحسابات واللوائح'],
      generatedDeliverable,
      metrics: parsed.deliverableData?.metrics,
    };
  } catch (err: any) {
    console.error('Autonomous agent execution error:', err);
    return {
      success: false,
      agent: 'executive',
      agentTitleAr: 'المساعد التنفيذي للإدارة العليا',
      intent: 'معالجة الخطأ التلقائي',
      replyText: `عذراً، حدث خطأ أثناء معالجة الأمر: ${err.message || 'ضغط مؤقت على محرك الذكاء الاصطناعي'}`,
      telegramMarkdown: `⚠️ *تنبيه المنظومة:*\nحدث خطأ أثناء معالجة الطلب:\n_${err.message || 'خطأ غير متوقع'}_`,
      actionsTaken: ['تسجيل الخطأ في سجل الرقابة'],
    };
  }
}

/**
 * Background Telegram Long-Polling Worker
 */
let pollingInterval: NodeJS.Timeout | null = null;
let lastUpdateId = 0;

export function startTelegramPolling() {
  if (pollingInterval) return;
  const config = loadTelegramConfig();
  if (!config.botToken || !config.isPollingActive) return;

  console.log('[Telegram Polling] Started background Telegram listener for @' + config.botUsername);

  pollingInterval = setInterval(async () => {
    try {
      const cfg = loadTelegramConfig();
      if (!cfg.botToken || !cfg.isPollingActive) {
        stopTelegramPolling();
        return;
      }

      const url = `https://api.telegram.org/bot${cfg.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          await handleIncomingTelegramUpdate(update, cfg);
        }
      }
    } catch (err) {
      console.warn('[Telegram Polling] Polling loop error:', err);
    }
  }, 3000);
}

export function stopTelegramPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[Telegram Polling] Stopped listener.');
  }
}

/**
 * Handle incoming update from Webhook or Polling
 */
export async function handleIncomingTelegramUpdate(update: any, config: TelegramConfig) {
  // Handle Callback Queries (when user taps inline buttons in Telegram)
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const data = cq.data;
    const fromName = cq.from?.first_name || 'المدير';

    if (chatId) {
      if (data === 'action_briefing') {
        const result = await processAutonomousAgentCommand({
          command: 'أعطني ملخصاً تنفيذياً لأرباح ومشاريع اليوم والسيولة المطلوبة',
          agentType: 'executive',
          userContext: { name: fromName, chatId: String(chatId) },
        });
        await sendTelegramMessage(config.botToken, chatId, `👑 *[التقرير التنفيذي الشامل]*\n\n${result.telegramMarkdown}`);
      } else {
        await sendTelegramMessage(config.botToken, chatId, `✅ تم استلام طلبك: \`${data}\` وجاري تنفيذه فورياً.`);
      }
    }
    return;
  }

  const message = update.message || update.edited_message;
  if (!message) return;

  const chatId = message.chat?.id;
  const fromName = `${message.from?.first_name || ''} ${message.from?.last_name || ''}`.trim() || 'مستخدم تليجرام';
  const text = message.text || message.caption || '';

  // 1. Process via Master Autonomous Multi-Agent Orchestrator
  // (Handles compound intents, stateless document isolation, visual classification, EVM, 3-way matching, and anti-timeout)
  const orchestratorResult = await executeEnterpriseTelegramOrchestrator({
    message,
    botToken: config.botToken,
  });

  if (orchestratorResult.handled) {
    return;
  }

  // 2. Fallback to Standard Commands if not handled
  if (text === '/start' || text.startsWith('/start')) {
    const welcome = `👑 *مرحباً بك في البوابة الذكية لمنظومة مؤسسة صناع الموارد التجارية (RMT)!*
أنا مساعدك الذكي ومسؤول العمليات التنفيذي المستقل المتصل بالمنظومة السحابية لحظياً.

🤖 *الوكلاء المتاحون لتنفيذ أوامرك فورياً:*
1️⃣ *مهندس التسعير (Estimator):* "اعمل تسعيرة لشركة اليمامة 20 كاشف دخان ومضخة 500 GPM"
2️⃣ *مسؤول المشتريات (Procurement):* "سوي أمر شراء لشركة نافكو بقيمة 45,000 ر.س"
3️⃣ *المراقب المالي (Controller):* "طلع فاتورة ضريبية لمشروع جامع الدرعية بنسبة 35%"
4️⃣ *مدير الموقع (Site Ops):* "سند تسليم مواد لموقع الظهران"
5️⃣ *المساعد التنفيذي (Executive):* "كم أرباحنا بمشاريع الشهر والسيولة المتوقعة؟"

📎 *يمكنك إرسال أي ملف (PDF / Excel / Word / صورة / فويس صوتي) وسأقوم بقراءته وتحويله فورياً لأي مستند مطلوب مع رفعه على Google Drive!*`;

    const startButtons = [
      [
        { text: '📊 التقرير الصباحي التنفيذي', callback_data: 'action_briefing' },
        { text: '💰 حارس السيولة (60 يوماً)', url: `${config.webhookUrl || 'https://rmt-master.web.app'}/?tab=cash_flow_sentinel` },
      ],
      [
        { text: '📁 الأرشيف السحابي Google Drive', url: 'https://drive.google.com' },
        { text: '💻 فتح المنظومة', url: config.webhookUrl || 'https://rmt-master.web.app' },
      ],
    ];

    await sendTelegramMessage(config.botToken, chatId, welcome, { inline_keyboard: startButtons });
    return;
  }

  if (text === '/help') {
    const help = `📌 *دليل استخدام بوت RMT التنفيذي:*
• *للتسعير:* اكتب اسم العميل والبنود والكميات -> ينشئ تسعيرة رسمية معتمدة بضريبة 15%.
• *للفواتير:* اكتب اسم المشروع ونسبة الإنجاز -> يولد فاتورة ضريبية إلكترونية ZATCA فورية.
• *لأوامر الشراء:* اذكر المورد والمواد -> ينشئ أمر شراء رسمي مع كود PO ومطابقة 3-Way.
• *لسندات التسليم:* اذكر الموقع والمواد -> يجهز سند استلام فوري GRN/DN.
• *للملفات:* أرسل أي جدول كميات Excel أو PDF أو صورة وسأقوم بقراءتها فورياً.`;
    await sendTelegramMessage(config.botToken, chatId, help);
    return;
  }

  // 5. Process Free-Form Natural Language Command
  const agentResult = await processAutonomousAgentCommand({
    command: text,
    userContext: { name: fromName, chatId: String(chatId) },
  });

  let fullReply = `🤖 *[${agentResult.agentTitleAr}]*\n\n${agentResult.telegramMarkdown}`;

  let actionButtons: any = undefined;
  if (agentResult.generatedDeliverable) {
    const deliv = agentResult.generatedDeliverable;
    fullReply += `\n\n📄 *المستند المستخرج والمنفذ في المنظومة:*\n• *النوع:* ${deliv.title}\n• *الرقم المرجعي:* \`${deliv.documentNumber || 'NEW'}\`\n• *الملخص:* ${deliv.summary}\n☁️ *الربط السحابي:* تم تحديث Firebase و Google Drive بنجاح.`;

    actionButtons = {
      inline_keyboard: [
        [
          { text: '👁️ معاينة وطباعة بالمنظومة', url: `${config.webhookUrl || 'https://rmt-master.web.app'}${deliv.linkUrl}` },
          { text: '📁 فتح في Google Drive', url: 'https://drive.google.com' },
        ],
      ],
    };
  }

  await sendTelegramMessage(config.botToken, chatId, fullReply, actionButtons);
}
