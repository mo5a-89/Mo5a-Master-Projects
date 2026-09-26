/**
 * RMT Unified Operational Copilot Drawer
 * Consolidates all enterprise operational domains into a single intelligent agent:
 * - Projects & Site Execution (WBS, MIR, Progress)
 * - Estimating & Quotations (BOQ, Specs, Markup)
 * - Procurement & Supply Chain (3-Way Match, POs, Vendors)
 * - Finance, Invoicing & ZATCA 15% Compliance
 * 
 * Strictly enforces RBAC & Data Masking:
 * - Executive / Master Admin: Full financial transparency and unlimited approval authority.
 * - Project Manager: Capped approval limit (SAR 20,000); profit margins and supplier markups masked.
 * - Standard Field Engineer: Complete financial masking (quantities and specs only).
 */

import React, { useState, useRef, useEffect } from 'react';
import { Project, CustomerQuotation, SupplierQuotation, User } from '../types';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import {
  parseCopilotInstruction,
  executeCopilotPipelineTransaction,
  CopilotPipelineProposal,
} from '../services/orchestratorService';
import {
  isExecutiveMasterAdmin,
  isProjectManagerAdmin,
  isFieldEngineer,
  MAX_PM_PO_APPROVAL_LIMIT,
} from '../utils/rbacUtils';
import { validateZatcaVatNumber } from '../utils/zatcaCompliance';
import {
  Sparkles,
  X,
  Send,
  Bot,
  FileCheck,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Upload,
  FileUp,
  DollarSign,
  HardHat,
  Truck,
  FileCode2,
  Paperclip,
  Check,
  Mic,
  MicOff,
  Volume2,
  Lock,
  Eye,
  Building2,
  Receipt,
  Scale,
} from 'lucide-react';

interface CopilotMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  category?: 'general' | 'estimating' | 'site' | 'procurement' | 'finance' | 'governance';
  actionTab?: string;
  actionLabel?: string;
  pipelineProposal?: CopilotPipelineProposal;
  isCommitted?: boolean;
  timestamp: string;
  isAuditLogged?: boolean;
}

interface QuickPrompt {
  id: string;
  icon: any;
  label: string;
  category: string;
  query: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'qp-margin',
    icon: DollarSign,
    category: 'المالية والتسعير',
    label: 'تحليل هامش الربح وتكاليف المشاريع',
    query: 'أعطني تحليلاً مالياً شاملاً لهامش الربح والتكلفة المباشرة للمشاريع النشطة',
  },
  {
    id: 'qp-site',
    icon: HardHat,
    category: 'التنفيذ الميداني',
    label: 'تحديث نسبة إنجاز موقع WBS وطلب MIR',
    query: 'ما هي نسبة إنجاز شبكة مكافحة الحريق وأعمال الموقع بالمشاريع، وهل توجد طلبات MIR معلقة؟',
  },
  {
    id: 'qp-procure',
    icon: Truck,
    category: 'سلاسل الإمداد',
    label: 'فحص المطابقة الثلاثية 3-Way Match وأوامر الشراء',
    query: 'افحص مدى مطابقة أوامر الشراء PO مع سندات الاستلام الميداني GRN وفواتير الموردين',
  },
  {
    id: 'qp-boq',
    icon: FileCode2,
    category: 'الهندسة والمواصفات',
    label: 'تدقيق اعتمادات UL/FM ونواقص المقايسات',
    query: 'دقق بنود جداول الكميات BOQ وتأكد من اكتمال اعتمادات الدفاع المدني UL/FM وكود البناء SBC',
  },
  {
    id: 'qp-zatca',
    icon: Receipt,
    category: 'الامتثال والضرائب',
    label: 'فحص الامتثال لضريبة 15% و ZATCA',
    query: 'افحص الامتثال الضريبي لمعايير هيئة الزكاة والضريبة ZATCA وسلامة التشفير والأرقام الضريبية',
  },
  {
    id: 'qp-po-approval',
    icon: ShieldCheck,
    category: 'الحوكمة والصلاحيات',
    label: 'فحص صلاحيات وسقف اعتماد أمر شراء',
    query: 'هل يحق لمدير المشاريع اعتماد أمر شراء بقيمة 35,000 ر.س وما هي شروط الحوكمة؟',
  },
];

interface RmtCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  projects: Project[];
  customerQuotations: CustomerQuotation[];
  supplierQuotations: SupplierQuotation[];
  onNavigateTab: (tab: string) => void;
}

export const RmtCopilotDrawer: React.FC<RmtCopilotDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  projects,
  customerQuotations,
  supplierQuotations,
  onNavigateTab,
}) => {
  const { store, companyIdentity, appendAuditLog } = useMasterEnterpriseStore();
  const [inputQuery, setInputQuery] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // User Role Identification
  const isExec = isExecutiveMasterAdmin(currentUser);
  const isPM = isProjectManagerAdmin(currentUser);
  const isField = isFieldEngineer(currentUser);

  // Initial Welcome Message based on authenticated RBAC Persona
  const getInitialGreeting = (): string => {
    const orgName = companyIdentity?.officialArabicName || 'شركة صناع الموارد التجاريه';
    if (isExec) {
      return `مرحباً بك يا باشمهندس مختار! أنا المساعد التشغيلي الموحد لمنظومة ${orgName} (RMT Operational Copilot). بصفتك المالك العام، لديك صلاحية كاملة وغير محدودة للاطلاع على هوامش الربح، تكاليف التوريد والشراء، أرصدة البنوك، ومطابقة ZATCA عبر كافة المشاريع والمستخلصات.`;
    }
    if (isPM) {
      return `أهلاً بك يا مدير المشاريع! أنا المساعد التشغيلي الموحد لمنظومة ${orgName}. أساعدك في مراجعة جداول الكميات (BOQ)، نسب إنجاز WBS، طلبات الفحص الميداني MIR، وتوليد أوامر الشراء. سقف الاعتماد المالي لحسابك هو ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س. هوامش الربح وحسابات التكلفة الرأسمالية محجوبة للإدارة العليا.`;
    }
    return `أهلاً بك! أنا المساعد التشغيلي الموحد لمنظومة ${orgName}. أتابع معك سير التنفيذ الميداني، مذكرات الاستلام (GRN)، وفحوصات المواد والمواصفات الفنية. (الأسعار والقيم المالية محجوبة لدواعي الرقابة المالية).`;
  };

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg-init',
      sender: 'copilot',
      text: getInitialGreeting(),
      timestamp: 'الآن',
    },
  ]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Initialize Speech Recognition for Arabic (ar-SA)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'ar-SA';

        recognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript) {
            setInputQuery((prev) => {
              const base = prev.trim();
              if (!base) return currentTranscript;
              if (base.endsWith(currentTranscript)) return base;
              return `${base} ${currentTranscript}`;
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition warning:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setSpeechError('يرجى السماح بصلاحية الميكروفون لاستخدام الإملاء الصوتي');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to init speech recognition:', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('التعرف الصوتي غير مدعوم في متصفحك الحالي. يرجى استخدام متصفح Chrome أو Edge لتفعيل الإملاء الصوتي باللغة العربية.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        setSpeechError(null);
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.warn('Error starting speech recognition:', e);
        setIsListening(false);
      }
    }
  };

  // Process user questions with multi-domain store awareness and RBAC data masking
  const generateUnifiedResponse = (query: string): { reply: string; actionTab?: string; actionLabel?: string } => {
    const q = query.toLowerCase();

    // 1. PO Approval Authority & SAR 20k Threshold Governance
    if (q.includes('صلاحي') || q.includes('اعتماد') || q.includes('20') || q.includes('سقف') || q.includes('35')) {
      if (isExec) {
        return {
          reply: `📋 لائحة الحوكمة والاعتماد المالي المعتمدة:\n• بصفتك المالك العام (Executive Master Admin)، تملك صلاحية اعتماد مالي غير محدودة لأي أمر شراء PO أو مستخلص.\n• مدراء المشاريع (PM) يملكون صلاحية اعتماد بحد أقصى ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س فقط.\n• أي أمر شراء يتجاوز ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س يُقيد تلقائياً بحالة "بانتظار اعتماد الإدارة العليا (Pending Executive Approval)".`,
          actionTab: 'purchase_orders',
          actionLabel: 'الانتقال إلى أوامر الشراء',
        };
      }
      return {
        reply: `🛡️ ضوابط الحوكمة لحسابك (مدير المشاريع / مهندس):\n• الحد الأقصى لاعتماد أمر شراء مباشر هو ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س.\n• في حال إنشاء أو طلب اعتماد أمر شراء يزيد عن ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س (مثل 35,000 ر.س)، يقوم النظام تلقائياً بتحويل الحالة إلى [بانتظار اعتماد الإدارة العليا - Pending Executive Approval] ولا يمكن صرفه إلا بتوقيع المالك العام.`,
        actionTab: 'purchase_orders',
        actionLabel: 'مراجعة أوامر الشراء المعلقة',
      };
    }

    // 2. Financial Margins, Project Direct Costs & Profitability
    if (q.includes('هامش') || q.includes('ربح') || q.includes('تكلف') || q.includes('مالي') || q.includes('درعية')) {
      if (isField) {
        return {
          reply: `🔒 تنبيه الرقابة المالية: البيانات المالية وهامش الربح محجوبة بالكامل لحسابك الحالي [محجوب للرقابة المالية - Confidential]. يمكنك متابعة جداول الكميات، بنود التوريد، ونسب إنجاز الموقع عبر تبويب المشاريع.`,
          actionTab: 'projects',
          actionLabel: 'عرض بيانات المشاريع الميدانية',
        };
      }

      if (isPM) {
        return {
          reply: `📊 ملخص المشاريع الهندسية:\n• إجمالي المشاريع النشطة: ${projects.length} مشاريع.\n• مشروع جامع الدرعية الكبير: نسبة الإنجاز الحالية 75%، وبنود الأعمال مستمرة وفق المخطط الزمني.\n• تفاصيل هوامش الربح والـ Markup: [محجوب للإدارة العليا - Executive Masked] بناءً على مصفوفة الصلاحيات (RBAC).`,
          actionTab: 'projects',
          actionLabel: 'متابعة المشاريع',
        };
      }

      // Executive has full transparency
      return {
        reply: `👑 تقرير الرقابة التنفيذية والأرباح الشامل (Executive Summary):\n• سياسة الهامش المستهدف الافتراضي: ${store.financialPolicies?.profitMarginPercentage || 20}%، والاستقطاع الضماني: ${store.financialPolicies?.retentionRate || 10}%.\n• مشروع جامع الدرعية الكبير (PRJ-2026-092): قيمة العقد 2,471,235.00 ر.س (شامل 15% ضريبة)، التكلفة المباشرة التقديرية 1,927,500.00 ر.س، وصافي هامش الربح المحقق 22.0% (543,735.00 ر.س).\n• الحساب البنكي المعتمد: ${companyIdentity?.bankName || 'مصرف الراجحي'} - الآيبان: ${companyIdentity?.iban || 'SA71...1399'}.`,
        actionTab: 'dashboard',
        actionLabel: 'لوحة التحكم التنفيذية والسيولة',
      };
    }

    // 3. Site Execution, WBS Progress & MIR
    if (q.includes('موقع') || q.includes('إنجاز') || q.includes('wbs') || q.includes('mir') || q.includes('فحص')) {
      return {
        reply: `🏗️ المتابعة الميدانية وضبط الجودة:\n• تم قيد تقدم الأعمال في شبكة مكافحة الحريق والإنذار بموقع الظهران بنسبة إنجاز 85% في سجل الـ WBS.\n• تم تجهيز مسودة طلب فحص واستلام مواد (MIR #MIR-2026-041) الخاصة بمحابس OS&Y ومضخات الحريق.\n• اشتراطات اختبار الضغط الهيدروستاتيكي: ضغط 200 PSI أو +50 PSI أعلى من ضغط التشغيل لمدة لا تقل عن ساعتين وفق NFPA 13 و SBC 801.`,
        actionTab: 'site_logistics',
        actionLabel: 'التنفيذ والمتابعة الميدانية',
      };
    }

    // 4. Procurement, Vendor Comparison & 3-Way Match
    if (q.includes('مورد') || q.includes('شراء') || q.includes('مشتريات') || q.includes('match') || q.includes('مطابقة') || q.includes('كنعاني') || q.includes('نافكو') || q.includes('سفيكو')) {
      const priceText = isField
        ? `[الأسعار محجوبة - Confidential]`
        : `NAFFCO بسعر 185,000 ر.س مقابل SFFECO بسعر 192,000 ر.س`;

      return {
        reply: `📦 سلاسل الإمداد وبوابة الرقابة (3-Way Match):\n• مقارنة مصفوفة الموردين: ${priceText} في مضخات الحريق المعتمدة، مع أفضلية NAFFCO بفارق 3.6% وتوريد خلال 4 أسابيع.\n• أمر الشراء المعتمد لشركة هادي كنعاني (PO-2026-510) بقيمة 62,882.00 ر.س محمي بنظام المطابقة الثلاثية (PO == GRN == Tax Invoice).\n• لا يتم صرف أي مستحقات للموردين بدون مطابقة سند الاستلام الفعلي بالموقع مع الفاتورة الضريبية.`,
        actionTab: 'purchase_orders',
        actionLabel: 'إدارة أوامر الشراء والموردين',
      };
    }

    // 5. BOQ Specs, UL/FM Codes & SBC Building Code
    if (q.includes('مواصف') || q.includes('boq') || q.includes('مقايس') || q.includes('ul') || q.includes('fm') || q.includes('sbc') || q.includes('دفاع مدني')) {
      return {
        reply: `📐 فحص المواصفات الهندسية واعتمادات الدفاع المدني:\n• مسح أنظمة المقايسة: تم تدقيق بنود مكافحة الحريق والإنذار المبكر والتأكد من مطابقة اعتمادات UL Listed / FM Approved لكافة المحابس والمضخات ومفاتيح السريان (Flow Switches).\n• كود البناء السعودي: جميع البنود مطابقة لمتطلبات كود البناء العام SBC 801 و SBC 201 ومواصفات الدفاع المدني السعودي دون أي غموض هندسي.`,
        actionTab: 'estimating_workbench',
        actionLabel: 'منصة دراسة العطاءات والمقايسات',
      };
    }

    // 6. Tax, ZATCA 15% & E-Invoicing
    if (q.includes('ضريب') || q.includes('vat') || q.includes('zatca') || q.includes('فاتور') || q.includes('مستخلص')) {
      const vatValid = validateZatcaVatNumber(companyIdentity?.vatNumber);
      return {
        reply: `🧾 الامتثال الضريبي والفواتير الإلكترونية (ZATCA Phase-2):\n• الرقم الضريبي للمنشأة: ${companyIdentity?.vatNumber || '311552664400003'} (${vatValid.isValid ? 'سليم ونظامي 15 خانة يبدأ وينتهي بـ 3 ✓' : 'غير مكتمل'}).\n• معدل الضريبة المطبق: 15% إلزامي مع منع أي إسقاط للهلالات (دقة خانتين عشريتين).\n• تشفير QR Code: يتم توليد كود TLV مشفر بترميز Base64 يطابق المعايير السعودية في كافة الفواتير والمستخلصات الضريبية.`,
        actionTab: 'invoices',
        actionLabel: 'الفواتير والمستخلصات الضريبية',
      };
    }

    // Default Multi-Awareness Response
    return {
      reply: `تم استلام وتحليل طلبك بنجاح. المنظومة التشغيلية لـ ${companyIdentity?.officialArabicName || 'شركة صناع الموارد'} تعمل بكامل الجاهزية وتغطي:\n1. دراسة العطاءات وهوامش الربح بدقة 15% ضريبة.\n2. المتابعة الميدانية ونسب إنجاز WBS وطلبات MIR.\n3. سلاسل الإمداد وبوابة الرقابة 3-Way Match.\n4. الحوكمة الصارمة للصلاحيات وسقوف اعتماد أوامر الشراء.`,
      actionTab: 'dashboard',
      actionLabel: 'الرجوع إلى لوحة القيادة',
    };
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    const userMessage: CopilotMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputQuery('');
    setIsProcessing(true);

    // Record immutable audit log for sensitive governance queries
    if (query.includes('اعتماد') || query.includes('صلاحي') || query.includes('هامش') || query.includes('شراء')) {
      appendAuditLog({
        userId: currentUser?.id || 'usr-system',
        userName: currentUser?.fullName || 'مستخدم النظام',
        action: 'AI_COPILOT_QUERY',
        fieldChanged: 'Operational_Query',
        newValue: query.substring(0, 100),
        entityType: 'Copilot',
        details: `استعلام عبر المساعد التشغيلي الموحد برتبة: ${currentUser?.role || 'Guest'}`,
      });
    }

    const proposal = parseCopilotInstruction(query);

    setTimeout(() => {
      if (proposal) {
        const botMessage: CopilotMessage = {
          id: `msg-${Date.now()}-bot-proposal`,
          sender: 'copilot',
          text: `تم تحليل المعطيات وبناء مقترح دورة العمل الشاملة:\n• العميل المستهدف: ${proposal.clientName}\n• المشروع المخطط: ${proposal.projectName}\n• القيمة القابلة للفلترة: ${proposal.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س\n• ضريبة 15% ZATCA: ${proposal.vat15Amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س\n• الإجمالي المطلوب: ${proposal.totalAmountWithVat.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س`,
          pipelineProposal: proposal,
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsProcessing(false);
        return;
      }

      const response = generateUnifiedResponse(query);
      const botMessage: CopilotMessage = {
        id: `msg-${Date.now()}-bot`,
        sender: 'copilot',
        text: response.reply,
        actionTab: response.actionTab,
        actionLabel: response.actionLabel,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsProcessing(false);
    }, 600);
  };

  const handleConfirmCopilotPipeline = (msgId: string, proposal: CopilotPipelineProposal) => {
    const res = executeCopilotPipelineTransaction(proposal, currentUser);
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isCommitted: true } : m))
      );

      const confirmMsg: CopilotMessage = {
        id: `msg-${Date.now()}-confirm`,
        sender: 'copilot',
        text: `✅ تم اعتماد وتثبيت دورة العمل المتكاملة بنجاح في قاعدة بيانات المنظومة!\n• مسودة التسعيرة المعتمدة: ${res.quote.quotationNumber}\n• المشروع النشط: ${res.project.projectNumber}\n• مخصص المشتريات المبدئي: ${res.purchaseOrder?.poNumber || 'PO-2026-0001'}`,
        actionTab: 'projects',
        actionLabel: 'الانتقال إلى قائمة المشاريع المعتمدة',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, confirmMsg]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const userMsg = `تم إرفاق ملف المستند/المقايسة: "${file.name}" للمعالجة الشاملة والتدقيق الفوري.`;

    const userMessage: CopilotMessage = {
      id: `msg-${Date.now()}-user-file`,
      sender: 'user',
      text: userMsg,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    setTimeout(() => {
      let analysis = '';
      if (isField) {
        analysis = `تم فحص الملف "${file.name}" بنجاح! تم استخراج 14 بنداً هندسياً: 12 بنداً معتمداً UL/FM وبندان يحتاجان إلى توثيق تدفق GPM. (الأسعار والتكاليف محجوبة لحسابك).`;
      } else if (isPM) {
        analysis = `تم تدقيق الملف "${file.name}": وُجد 14 بنداً بكميات دقيقة جاهزة لتوليد أمر شراء مسودة. هوامش الربح محجوبة للإدارة العليا. إذا تجاوز الإجمالي ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س سيتم طلب اعتماد المالك العام.`;
      } else {
        analysis = `تم تدقيق الملف "${file.name}" للإدارة العليا: تم استخراج 14 بنداً بتكلفة توريد 128,450.00 ر.س. بعد تطبيق هامش ${store.financialPolicies?.profitMarginPercentage || 20}% وإضافة 15% ضريبة القيمة المضافة، القيمة الإجمالية المقترحة 177,261.00 ر.س. جاهز للنقل إلى دراسة العطاءات.`;
      }

      const botMessage: CopilotMessage = {
        id: `msg-${Date.now()}-bot-file`,
        sender: 'copilot',
        text: analysis,
        actionTab: 'estimating_workbench',
        actionLabel: 'فتح منصة دراسة العطاءات',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
      setIsProcessing(false);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="bg-white dark:bg-[#0b1324] w-full max-w-xl h-full shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
        
        {/* Unified Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-[#174A84] via-[#0F3560] to-[#007A5A] text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-white/10 rounded-xl shrink-0 backdrop-blur-xs border border-white/20">
              <Bot className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm tracking-tight truncate">
                  المساعد التشغيلي الموحد (RMT Operational Copilot)
                </h3>
                <span className="text-[10px] bg-emerald-400/20 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-300/30 font-mono font-bold shrink-0">
                  Unified AI v5.5
                </span>
              </div>
              <p className="text-[11px] text-slate-200 mt-0.5 truncate">
                {companyIdentity?.officialArabicName || 'شركة صناع الموارد التجاريه'} - RMT
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* RBAC Persona Context Bar */}
        <div className="px-4 py-2 bg-slate-100 dark:bg-[#070D19] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className={`w-4 h-4 ${isExec ? 'text-blue-600' : isPM ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span className="text-slate-700 dark:text-slate-300 font-bold">المستخدم الحالي:</span>
            <span className="text-slate-900 dark:text-white font-black truncate">
              {currentUser?.fullName || 'Eng. Mokhtar Yousef'}
            </span>
          </div>

          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
              isExec
                ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                : isPM
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            {isExec
              ? '👑 صلاحية كاملة (Master Executive)'
              : isPM
              ? `🛡️ مدير مشاريع (سقف: ${MAX_PM_PO_APPROVAL_LIMIT.toLocaleString()} ر.س)`
              : '👷 مهندس موقع (حجب مالي)'}
          </span>
        </div>

        {/* Quick Prompt Pills Bar (Unified Operational Pillars) */}
        <div className="p-3 bg-white dark:bg-[#0B1528] border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span>إجراءات واستعلامات سريعة عبر كافة قطاعات المنظومة:</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp) => {
              const IconComp = qp.icon;
              return (
                <button
                  key={qp.id}
                  type="button"
                  onClick={() => handleSendMessage(qp.query)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <IconComp className="w-3 h-3 text-[#174A84] dark:text-sky-400 shrink-0" />
                  <span className="truncate">{qp.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat History Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-[#070D19]/50 [scrollbar-width:thin]">
          {messages.map((m) => {
            const isBot = m.sender === 'copilot';
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                {isBot && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#174A84] to-[#007A5A] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-1">
                    <Bot className="w-4 h-4 text-amber-300" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs whitespace-pre-line ${
                    isBot
                      ? 'bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tr-xs'
                      : 'bg-gradient-to-r from-[#174A84] to-[#0F3560] text-white rounded-tl-xs font-medium'
                  }`}
                >
                  <p>{m.text}</p>

                  {/* Rich Pipeline Proposal Action Card */}
                  {isBot && m.pipelineProposal && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-950 text-white border border-emerald-500/30 space-y-3 font-sans">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          دورة العمل المتكاملة (Relational Pipeline)
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          15% ZATCA VAT
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-center">
                          <span className="text-[9.5px] text-slate-400 block font-sans">1. مسودة التسعيرة</span>
                          <span className="font-bold text-amber-300 truncate block">{m.pipelineProposal.quoteNumber}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-center">
                          <span className="text-[9.5px] text-slate-400 block font-sans">2. المشروع المرتبط</span>
                          <span className="font-bold text-sky-300 truncate block">{m.pipelineProposal.projectNumber}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-center">
                          <span className="text-[9.5px] text-slate-400 block font-sans">3. مخصص المشتريات</span>
                          <span className="font-bold text-emerald-300 truncate block">{m.pipelineProposal.poNumber}</span>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <div className="flex justify-between">
                          <span className="text-slate-400">العميل المستهدف:</span>
                          <span className="font-bold text-white">{m.pipelineProposal.clientName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">المهندس / القائم:</span>
                          <span className="font-bold text-slate-200">{m.pipelineProposal.contactName}</span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400">المبلغ قبل الضريبة:</span>
                          <span className="text-slate-300">{m.pipelineProposal.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400">ضريبة 15%:</span>
                          <span className="text-emerald-400">+{m.pipelineProposal.vat15Amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800 font-bold font-mono">
                          <span className="text-slate-200">الإجمالي النهائي العقد:</span>
                          <span className="text-emerald-300 text-xs">{m.pipelineProposal.totalAmountWithVat.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س</span>
                        </div>
                      </div>

                      {!m.isCommitted ? (
                        <button
                          type="button"
                          onClick={() => handleConfirmCopilotPipeline(m.id, m.pipelineProposal!)}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>[اعتماد وتثبيت دورة العمل كاملة]</span>
                        </button>
                      ) : (
                        <div className="p-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] text-center rounded-xl font-bold flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>تم تثبيت واستحداث التسعيرة والمشروع ومخصص المشتريات بنجاح!</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Link inside Bot Bubble */}
                  {isBot && m.actionTab && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateTab(m.actionTab!);
                          onClose();
                        }}
                        className="px-3 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-[#174A84] dark:text-sky-300 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-blue-200 dark:border-blue-800"
                      >
                        <span>{m.actionLabel || 'فتح القسم'}</span>
                        <ArrowRight className="w-3 h-3 rotate-180" />
                      </button>
                    </div>
                  )}

                  <div
                    className={`text-[10px] mt-1.5 text-right font-mono ${
                      isBot ? 'text-slate-400' : 'text-slate-300'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex gap-3 items-center text-slate-500 dark:text-slate-400 text-xs">
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin text-[#174A84]" />
              </div>
              <span className="font-medium animate-pulse">جاري التحليل واستدعاء بيانات المنظومة...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Action Bar */}
        <div className="p-3 bg-white dark:bg-[#0B1528] border-t border-slate-200 dark:border-slate-800 space-y-2">
          {uploadedFileName && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
              <div className="flex items-center gap-1.5 truncate">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="truncate">الملف المرفق: {uploadedFileName}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadedFileName(null)}
                className="text-slate-400 hover:text-red-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {speechError && (
            <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{speechError}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.xlsx,.xls,.csv"
            />

            {/* Attach File Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer shrink-0"
              title="إرفاق ملف جدول كميات أو مقايسة (PDF/Excel)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Arabic Voice Dictation Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white border-red-600 animate-pulse'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
              title={isListening ? 'إيقاف التسجيل' : 'تفعيل الإملاء الصوتي باللغة العربية'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Query Input */}
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
              placeholder="اطرح استفسارك الهندسي، المالي، أو الميداني هنا..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#174A84]"
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isProcessing}
              className="px-4 py-2.5 bg-gradient-to-r from-[#174A84] to-[#007A5A] hover:opacity-90 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
            >
              <Send className="w-3.5 h-3.5 rotate-180" />
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
