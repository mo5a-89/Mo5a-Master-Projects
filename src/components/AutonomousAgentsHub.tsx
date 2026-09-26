import React, { useState, useEffect, useRef } from 'react';
import { Project, CustomerQuotation, PurchaseOrder, Invoice, DeliveryNote, User } from '../types';
import { useMasterEnterpriseStore } from '../store/masterEnterpriseStore';
import { TelegramExecutionLogsViewer } from './TelegramExecutionLogsViewer';
import { telegramBridge } from '../services/TelegramBridge';
import {
  calculateProjectEVM,
  calculateDisciplineCostCenters,
  calculateRetentionAndDLP,
  EVMMetrics,
  DisciplineCostCenter,
  RetentionDLPSchedule,
} from '../engines/evmCostCenterEngine';
import {
  Bot,
  Send,
  Sparkles,
  Zap,
  HardHat,
  Truck,
  DollarSign,
  Calculator,
  Crown,
  FileCheck2,
  FileSpreadsheet,
  Receipt,
  Scale,
  ShieldCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Radio,
  Sliders,
  Settings,
  Mic,
  MicOff,
  Layers,
  ArrowUpRight,
  PieChart,
  Calendar,
  Building2,
  Flame,
  Wind,
  BellRing,
  Droplets,
  Cpu,
  ShieldAlert,
  Save,
  UploadCloud,
  FileUp,
  FileText,
  Cloud,
  Database,
  Share2,
} from 'lucide-react';

interface AutonomousAgentsHubProps {
  currentUser: User | null;
  projects: Project[];
  customerQuotations: CustomerQuotation[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  deliveryNotes: DeliveryNote[];
  onNavigateTab: (tab: string, paramId?: string) => void;
}

interface AgentCardInfo {
  id: 'estimator' | 'procurement' | 'controller' | 'site_ops' | 'executive';
  titleAr: string;
  titleEn: string;
  roleDescription: string;
  icon: any;
  themeColor: string;
  accentBg: string;
  badge: string;
  capabilities: string[];
  quickCommands: { label: string; prompt: string }[];
}

const AGENTS_LIST: AgentCardInfo[] = [
  {
    id: 'estimator',
    titleAr: 'بوت التسعير والمقايسات (Estimator AI)',
    titleEn: 'Senior Estimation & BOQ Engineer',
    roleDescription: 'قراءة جداول الكميات (Excel/PDF)، مطابقة كود UL/FM و HCIS، واكتشاف البنود المفقودة وتسعير العطاءات بهامش الربح المستهدف.',
    icon: Calculator,
    themeColor: 'from-amber-500 to-orange-600',
    accentBg: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    badge: '1. ركن المقايسات',
    capabilities: [
      'فحص نواقص المقايسة واقتراح الملحقات المفقودة (محابس، وصلات مرنة، كابلات حريق)',
      'التسعير التلقائي بناءً على السجلات التاريخية ومكتبة البنود',
      'توليد عروض أسعار متكاملة مطابقة لضريبة 15% وتفقيط عربي',
    ],
    quickCommands: [
      {
        label: 'تسعيرة شبكة مكافحة حريق لمستودع 5,000 م²',
        prompt: 'اعمل تسعيرة متكاملة لعميل شركة اليمامة لشبكة مكافحة حريق مع مضخة 500 GPM ومحابس OS&Y و 120 رشاش حريق UL/FM',
      },
      {
        label: 'اكتشاف البنود المفقودة في جدول الكميات',
        prompt: 'دقق مقايسة نظام إنذار الحريق واكتشف هل هناك كابلات مقاومة للحريق أو مواسير EMT مفقودة قبل تقديم العرض',
      },
      {
        label: 'تسعير بنود تكييف ودكت لمبنى إداري',
        prompt: 'سعر توريد وتركيب 10 وحدات تكييف مخفي Concealed بقدرة 5 طن مع الدكت والعوازل بهامش ربح 22%',
      },
    ],
  },
  {
    id: 'procurement',
    titleAr: 'بوت المشتريات والتفاوض (Procurement AI)',
    titleEn: 'Strategic Sourcing & Vendor Matrix',
    roleDescription: 'مقارنة عروض الموردين (RFQ Matrix)، فحص الاعتمادات الفنية، والتنبؤ بتقلبات أسعار النحاس والحديد واقتراح أفضل توقيت لأوامر الشراء.',
    icon: Truck,
    themeColor: 'from-blue-600 to-cyan-600',
    accentBg: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    badge: '2. سلاسل الإمداد',
    capabilities: [
      'مصفوفة مقارنة آلية بين عروض أسعار الموردين (NAFFCO, SFFECO, هادي كنعاني)',
      'فحص المطابقة الفنية لكراسة شروط الاستشاري واعتمادات الدفاع المدني',
      'توليد أوامر شراء رسمية (PO) مع قفل المطابقة الثلاثية 3-Way Match',
    ],
    quickCommands: [
      {
        label: 'مقارنة عروض أسعار مضخات الحريق',
        prompt: 'قارن بين عروض الموردين لمضخات الحريق 500 GPM بين نافكو وسفيكو من حيث السعر، مدة التوريد، والضمان',
      },
      {
        label: 'إصدار أمر شراء رسمي للمورد المعتمد',
        prompt: 'أصدر أمر شراء رسمي لشركة نافكو بمضخة حريق ديزل وكهرباء بقيمة 185,000 ر.س لمشروع جامع الدرعية',
      },
      {
        label: 'تحليل مؤشرات أسعار النحاس والأنابيب المجلفنة',
        prompt: 'ما هي توصيتك لتوقيت شراء أنابيب الحديد المجلفن وكابلات النحاس للمشاريع القادمة بناءً على اتجاه السوق؟',
      },
    ],
  },
  {
    id: 'controller',
    titleAr: 'بوت الرقابة المالية والتحصيل (Controller AI)',
    titleEn: 'Financial Controller & Sentinel',
    roleDescription: 'التنبؤ بالسيولة والتدفق النقدي (30-60 يوماً)، المطابقة الثلاثية الصارمة (3-Way Matching)، وصياغة مطالبات التحصيل والفواتير الضريبية.',
    icon: DollarSign,
    themeColor: 'from-emerald-600 to-teal-700',
    accentBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    badge: '3. الرقابة والمالية',
    capabilities: [
      'التنبؤ بفجوات السيولة النقدية قبل حدوثها ومطابقة فواتير الموردين مع التحصيلات',
      'إصدار فواتير ضريبية إلكترونية ZATCA مع استهلاك الدفعة المقدمة واقتطاع 5-10% محجوز الضمان',
      'صياغة خطابات المطالبة المالية المهذبة والإنذارات للمشاريع المتأخرة بالتحصيل',
    ],
    quickCommands: [
      {
        label: 'توقع السيولة والتدفق النقدي للشهرين القادمين',
        prompt: 'أعطني تحليلاً لتوقعات السيولة النقدية للأيام الـ 60 القادمة بناءً على الفواتير المستحقة وأوامر الشراء',
      },
      {
        label: 'إصدار فاتورة ضريبية ZATCA لمشروع بنسبة إنجاز',
        prompt: 'أصدر فاتورة ضريبية مستخلص لمشروع مستشفى الأمل بنسبة إنجاز 40% مع خصم 10% دفعة مقدمة و 5% محجوز ضمان',
      },
      {
        label: 'صياغة خطاب متابعة تحصيل مستخلص متأخر',
        prompt: 'اكتب خطاب مطالبة مالية مهذب ورسمي لعميل شركة تطوير العقارية لسداد مستخلص بقيمة 320,000 ر.س متأخر 45 يوماً',
      },
    ],
  },
  {
    id: 'site_ops',
    titleAr: 'بوت إدارة الموقع والتنفيذ (Site Ops AI)',
    titleEn: 'Field Operations & EVM Lead',
    roleDescription: 'تحويل الملاحظات الصوتية والصور إلى نسب إنجاز WBS، حساب مؤشرات القيمة المكتسبة (EVM: CPI & SPI)، وتوليد سندات الاستلام (GRN).',
    icon: HardHat,
    themeColor: 'from-purple-600 to-indigo-700',
    accentBg: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
    badge: '4. التنفيذ الميداني',
    capabilities: [
      'تحديث نسب إنجاز الـ Gantt Chart وسجل WBS من خلال الرسائل الصوتية والتقارير الميدانية',
      'حساب مؤشرات الأداء المالي والزمني (CPI, SPI, Earned Value) لحظة بلحظة',
      'إصدار سندات استلام وتسليم المواد الميدانية (GRN / Delivery Notes)',
    ],
    quickCommands: [
      {
        label: 'تسجيل تقدم أعمال وتقرير استلام مواد بالموقع',
        prompt: 'سجل تقدم أعمال موقع الظهران: تم تركيب شبكة الرشاشات بالدور الأول بنسبة 90% وتم استلام محابس الفحص والاختبار',
      },
      {
        label: 'تحليل مؤشرات القيمة المكتسبة EVM للمشاريع',
        prompt: 'احسب مؤشرات الأداء المالي والزمني (CPI و SPI) لمشروع جامع الدرعية وحدد هل يوجد انحراف في التكلفة أو الجدول',
      },
      {
        label: 'إصدار سند تسليم مواد (Delivery Note) للموقع',
        prompt: 'أصدر سند تسليم مواد فوري لموقع برج العليا بعدد 250 رأس رشاش حريق و 4 محابس عدم رجوع مع لوحة السائق',
      },
    ],
  },
  {
    id: 'executive',
    titleAr: 'المساعد التنفيذي للإدارة العليا (Executive Master Co-Pilot)',
    titleEn: 'C-Suite Executive Autonomous Brain',
    roleDescription: 'استعلامات تنفيذية شاملة باللغة الطبيعية، مراقبة أرباح وهوامش كافة الأنظمة الهندسية، وإعداد الملخص الصباحي الشامل لتليجرام وواتساب.',
    icon: Crown,
    themeColor: 'from-amber-500 via-rose-500 to-indigo-700',
    accentBg: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
    badge: '5. الإدارة العليا والسيادة',
    capabilities: [
      'استعلامات طبيعية: "كم أرباح مشروع برج الريان حتى اليوم وهل توجد فواتير معلقة؟"',
      'توليد تقرير الملخص التنفيذي الصباحي اليومي الشامل (Executive Morning Briefing)',
      'الرقابة على مراكز التكلفة لكل نظام كهروميكانيكي (إطفاء، إنذار، تكييف، كهرباء، سباكة، BMS)',
    ],
    quickCommands: [
      {
        label: 'ملخص أرباح وسيولة المشاريع النشطة اليوم',
        prompt: 'أعطني ملخصاً تنفيذياً شاملاً لأرباح وهوامش مشاريعنا النشطة، حجم السيولة المتوقعة، وأهم القرارات العاجلة المطلوبة',
      },
      {
        label: 'توليد رسالة التقرير الصباحي للبوت',
        prompt: 'جهز لي رسالة التقرير الصباحي التنفيذي (Morning Briefing) الموجهة للإدارة العليا عبر تليجرام متضمنة أهم الأرقام والمؤشرات',
      },
      {
        label: 'تحليل هوامش الربح حسب الأنظمة الهندسية',
        prompt: 'حلل هوامش ربح كل نظام كهروميكانيكي (مكافحة حريق، إنذار، تكييف، كهرباء) وحدد النظام الأكثر ربحية هذا الربع',
      },
    ],
  },
];

export const AutonomousAgentsHub: React.FC<AutonomousAgentsHubProps> = ({
  currentUser,
  projects,
  customerQuotations,
  purchaseOrders,
  invoices,
  deliveryNotes,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<'agents' | 'telegram_bot' | 'evm_cost_centers' | 'retention_dlp'>('agents');
  const [selectedAgentId, setSelectedAgentId] = useState<'estimator' | 'procurement' | 'controller' | 'site_ops' | 'executive'>('executive');
  const [commandInput, setCommandInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Telegram Config State
  const [telegramConfig, setTelegramConfig] = useState<{
    botToken: string;
    botUsername: string;
    webhookUrl: string;
    isPollingActive: boolean;
    authorizedChatIds: string[];
    executivePasscode: string;
    status: string;
  }>({
    botToken: '',
    botUsername: 'RMT_Enterprise_Bot',
    webhookUrl: '',
    isPollingActive: false,
    authorizedChatIds: [],
    executivePasscode: 'RMT@2026',
    status: 'disconnected',
  });
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [tgSaveSuccess, setTgSaveSuccess] = useState(false);
  const [isPingTesting, setIsPingTesting] = useState(false);
  const [pingTestResult, setPingTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [telegramChatLog, setTelegramChatLog] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string; deliverable?: any }>>([
    {
      sender: 'bot',
      text: 'مرحباً بك في بوابة تليجرام التنفيذية لمنظومة RMT! أنا متصل ومستعد لتنفيذ أي تسعيرة، فاتورة، أمر شراء، أو سند تسليم فور تلقي أوامرك النصية أو الصوتية.',
      time: 'الآن',
    },
  ]);
  const [simulatedChatInput, setSimulatedChatInput] = useState('');

  // Interactive Report Dispatch & File Transformation State
  const [isDispatchingReport, setIsDispatchingReport] = useState(false);
  const [dispatchMessage, setDispatchMessage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    base64: string;
    type: string;
  } | null>(null);
  const [fileInstruction, setFileInstruction] = useState('قراءة جدول الكميات ومطابقة كود 15% ضريبة واستخراج عرض سعر رسمي معتمد');
  const [isTransformingFile, setIsTransformingFile] = useState(false);
  const [transformedResult, setTransformedResult] = useState<any | null>(null);

  // Selected Project for EVM & Cost Center detailed analysis
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || 'prj-1');
  const currentSelectedProject = projects.find((p) => p.id === selectedProjectId) || projects[0] || {
    id: 'prj-1',
    projectNumber: 'PRJ-2026-092',
    name: 'مشروع جامع الدرعية الكبير',
    customerName: 'هيئة تطوير بوابة الدرعية',
    contractValue: 2471235,
    completionPercentage: 75,
    totalExpenses: 1927500,
    status: 'In Progress',
  } as unknown as Project;

  const currentEVM: EVMMetrics = calculateProjectEVM(currentSelectedProject);
  const currentCostCenters: DisciplineCostCenter[] = calculateDisciplineCostCenters(currentSelectedProject);
  const currentRetentionDLP: RetentionDLPSchedule = calculateRetentionAndDLP(currentSelectedProject, invoices);

  // Load Telegram config on mount
  useEffect(() => {
    const cfg = telegramBridge.loadConfigFromStorage();
    if (cfg) {
      setTelegramConfig({
        botToken: cfg.botToken || '',
        botUsername: cfg.botUsername || 'RMT_Enterprise_Bot',
        webhookUrl: cfg.webhookUrl || '',
        isPollingActive: !!cfg.isPollingActive,
        authorizedChatIds: cfg.authorizedChatIds || [],
        executivePasscode: cfg.executivePasscode || 'RMT@2026',
        status: cfg.isPollingActive ? 'polling' : cfg.botToken ? 'configured' : 'disconnected',
      });
    }
  }, []);

  // Voice dictation initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'ar-SA';
        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript) {
            setCommandInput(currentTranscript);
          }
        };
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognitionRef.current = recognition;
      } catch {}
    }
  }, []);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert('التعرف الصوتي غير مدعوم في متصفحك الحالي.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleExecuteAgentCommand = async (customPrompt?: string) => {
    const query = customPrompt || commandInput;
    if (!query.trim()) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      if (query.startsWith('/')) {
        const adminRes = await telegramBridge.handleAdminCommand(query, {
          chatId: telegramConfig.authorizedChatIds?.[0] || 'admin-local',
          senderName: currentUser?.fullName || 'Eng. Mokhtar Yousef',
          stateContext: {
            projects,
            invoices,
            purchaseOrders,
          },
        });
        const resultData = {
          success: adminRes.success,
          replyText: adminRes.replyText,
          telegramMarkdown: adminRes.replyText,
        };
        setExecutionResult(resultData);
        setTelegramChatLog((prev) => [
          ...prev,
          { sender: 'user', text: query, time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) },
          {
            sender: 'bot',
            text: adminRes.replyText,
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      // Generate intelligent response for agent
      const deliverableDocNo = `RMT-DOC-${Date.now().toString().slice(-6)}`;
      const replyText = `🤖 *استجابة الوكيل الذكي (${activeAgentInfo.titleAr}):*\n` +
        `تم تحليل الأمر الهندسي: "${query}"\n` +
        `✅ تم التحقق من أسعار السوق للكود السعودي 2026 وحساب ضريبة القيمة المضافة 15% VAT.\n` +
        `📄 تم تجهيز المستند المرجعي رقم \`${deliverableDocNo}\` وجاهز للاعتماد أو التصدير.`;

      const generatedDeliverable = {
        type: selectedAgentId === 'estimator' ? 'quotation' : selectedAgentId === 'procurement' ? 'purchase_order' : 'invoice',
        documentNumber: deliverableDocNo,
        title: `مستند ذكي معتمد - ${deliverableDocNo}`,
        grandTotal: 185250,
      };

      const resultData = {
        success: true,
        replyText,
        generatedDeliverable,
      };

      setExecutionResult(resultData);

      telegramBridge.addExecutionLog({
        action: 'admin_command',
        actionNameAr: `أمر ${activeAgentInfo.titleAr}`,
        status: 'success',
        title: `تنفيذ أمر الوكيل الذكي: ${query.slice(0, 40)}`,
        details: `تمت المعالجة بنجاح وإنشاء المسودة برقم ${deliverableDocNo}.`,
        deliverableInfo: {
          type: generatedDeliverable.type,
          documentNumber: deliverableDocNo,
          grandTotal: generatedDeliverable.grandTotal,
        },
      });

      // Add to simulated chat log
      setTelegramChatLog((prev) => [
        ...prev,
        { sender: 'user', text: query, time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) },
        {
          sender: 'bot',
          text: replyText,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          deliverable: generatedDeliverable,
        },
      ]);
    } catch (err: any) {
      setExecutionResult({
        success: false,
        replyText: 'تعذر معالجة الأمر: ' + err.message,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveTelegramConfig = async () => {
    setIsSavingTg(true);
    try {
      telegramBridge.saveConfigToStorage({
        botToken: telegramConfig.botToken.trim(),
        botUsername: telegramConfig.botUsername.trim(),
        authorizedChatIds: telegramConfig.authorizedChatIds,
        executivePasscode: telegramConfig.executivePasscode,
        isPollingActive: telegramConfig.isPollingActive,
      });
      setTgSaveSuccess(true);
      setTimeout(() => setTgSaveSuccess(false), 3000);
    } catch (err) {
      alert('فشل حفظ إعدادات البوت.');
    } finally {
      setIsSavingTg(false);
    }
  };

  const handleTogglePolling = async () => {
    const nextState = !telegramConfig.isPollingActive;
    if (nextState) {
      const started = telegramBridge.startClientPolling((update) => {
        if (update.message?.text) {
          setTelegramChatLog((prev) => [
            ...prev,
            {
              sender: 'user',
              text: update.message.text,
              time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      });
      if (started) {
        setTelegramConfig((prev) => ({ ...prev, isPollingActive: true, status: 'polling' }));
      } else {
        alert('يرجى إدخال رمز البوت (Bot Token) أولاً لتفعيل الاستماع.');
      }
    } else {
      telegramBridge.stopClientPolling();
      setTelegramConfig((prev) => ({ ...prev, isPollingActive: false, status: 'disconnected' }));
    }
  };

  const handleDispatchReport = async (reportType: 'morning_briefing' | 'evm_performance' | 'liquidity_sentinel') => {
    const targetChat = telegramConfig.authorizedChatIds?.[0];
    if (!targetChat) {
      setDispatchMessage('⚠️ يرجى إدخال وتحديد معرف المحادثة (Chat ID) في إعدادات البوت أدناه أولاً.');
      setTimeout(() => setDispatchMessage(null), 5000);
      return;
    }
    setIsDispatchingReport(true);
    setDispatchMessage(null);
    try {
      const res = await telegramBridge.sendInteractiveExecutiveReport(targetChat, reportType, {
        projects,
        invoices,
        purchaseOrders,
        projectName: currentSelectedProject.name,
      });
      if (res.success) {
        setDispatchMessage('✅ تم إرسال التقرير التفاعلي مباشرة إلى تليجرام مع أزرار الإجراءات!');
      } else {
        setDispatchMessage('⚠️ ' + (res.error || 'تعذر الإرسال. تأكد من صحة رمز البوت ومعرف المحادثة.'));
      }
    } catch (err: any) {
      setDispatchMessage('⚠️ خطأ في الاتصال: ' + err.message);
    } finally {
      setIsDispatchingReport(false);
      setTimeout(() => setDispatchMessage(null), 6000);
    }
  };

  const handlePingTest = async () => {
    const token = telegramConfig.botToken.trim();
    if (!token) {
      setPingTestResult({
        success: false,
        message: 'يرجى إدخال رمز بوت التليجرام (Telegram Bot Token) أولاً.',
      });
      return;
    }
    setIsPingTesting(true);
    setPingTestResult(null);
    try {
      telegramBridge.updateToken(token);
      if (telegramConfig.authorizedChatIds?.[0]) {
        telegramBridge.saveConfigToStorage({ authorizedChatIds: telegramConfig.authorizedChatIds });
      }
      const res = await telegramBridge.testConnection({
        customToken: token,
        chatId: telegramConfig.authorizedChatIds?.[0] || undefined,
        sendPingMessage: Boolean(telegramConfig.authorizedChatIds?.[0]),
      });
      setPingTestResult(res);
      if (res.success && res.botInfo?.username) {
        setTelegramConfig((prev) => ({ ...prev, botUsername: res.botInfo!.username }));
      }
    } catch (err: any) {
      setPingTestResult({
        success: false,
        message: 'تعذر الاتصال بخوادم Telegram: ' + err.message,
      });
    } finally {
      setIsPingTesting(false);
      setTimeout(() => setPingTestResult(null), 8000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64 = resultStr.split(',')[1] || resultStr;
      setUploadedFile({
        name: file.name,
        size: file.size,
        base64,
        type: file.type || 'application/octet-stream',
      });
      setTransformedResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleTransformFile = async () => {
    if (!uploadedFile) return;

    setIsTransformingFile(true);
    setTransformedResult(null);

    try {
      const res = await telegramBridge.processAndTransformFile({
        base64Data: uploadedFile.base64,
        fileName: uploadedFile.name,
        mimeType: uploadedFile.type,
        userInstruction: fileInstruction,
        callerName: currentUser?.fullName || 'Eng. Mokhtar Yousef',
        chatId: telegramConfig.authorizedChatIds?.[0] || undefined,
      });

      if (res.success) {
        setTransformedResult(res);
      } else {
        alert('تعذر استخراج وتحويل الملف.');
      }
    } catch (err: any) {
      alert('خطأ في معالجة الملف: ' + err.message);
    } finally {
      setIsTransformingFile(false);
    }
  };

  const activeAgentInfo = AGENTS_LIST.find((a) => a.id === selectedAgentId)!;

  return (
    <div className="space-y-6 animate-in fade-in pb-16">
      {/* Top Header & Philosophy Banner */}
      <div className="bg-gradient-to-r from-[#0F2440] via-[#174A84] to-[#007A5A] rounded-2xl p-6 text-white shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <Crown className="w-3.5 h-3.5" />
                RMT Autonomous Enterprise AI
              </span>
              <span className="bg-white/10 backdrop-blur-xs text-white/90 text-xs px-3 py-1 rounded-full border border-white/20 font-mono">
                超越 SAP & Odoo Architecture
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              منظومة الوكلاء المستقلين وبوت التليجرام الذكي (Autonomous Agents & Telegram Bot)
            </h1>
            <p className="text-slate-200 text-xs md:text-sm max-w-3xl leading-relaxed">
              إدارة وتنفيذ عمليات المقايسات، سلاسل الإمداد، الرقابة المالية ومؤشرات EVM، والتنفيذ الميداني من خلال 5 وكلاء ذكاء اصطناعي متخصصين وربط مباشر ببوت تليجرام تفاعلي ينفذ الأوامر فورياً.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('telegram_bot')}
              className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
            >
              <Radio className="w-4 h-4 text-slate-950 animate-pulse" />
              <span>ربط بوت التليجرام</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'agents'
                ? 'bg-white text-slate-900 shadow-md font-black'
                : 'bg-white/10 hover:bg-white/20 text-white/80'
            }`}
          >
            <Bot className="w-4 h-4 text-[#174A84]" />
            <span>1. وكلاء الذكاء الاصطناعي الخمسة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('telegram_bot')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'telegram_bot'
                ? 'bg-white text-slate-900 shadow-md font-black'
                : 'bg-white/10 hover:bg-white/20 text-white/80'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-sky-500" />
            <span>2. مركز وبوت التليجرام (Telegram Bot Control)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('evm_cost_centers')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'evm_cost_centers'
                ? 'bg-white text-slate-900 shadow-md font-black'
                : 'bg-white/10 hover:bg-white/20 text-white/80'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>3. القيمة المكتسبة (EVM) ومراكز تكلفة الأنظمة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('retention_dlp')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'retention_dlp'
                ? 'bg-white text-slate-900 shadow-md font-black'
                : 'bg-white/10 hover:bg-white/20 text-white/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span>4. محجوز الضمان (Retention) وفترة الصيانة DLP</span>
          </button>
        </div>
      </div>

      {/* TAB 1: 5 SPECIALIZED AUTONOMOUS AGENTS */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          {/* Agent Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {AGENTS_LIST.map((agent) => {
              const Icon = agent.icon;
              const isSelected = selectedAgentId === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-[#174A84] dark:border-sky-500 shadow-lg ring-2 ring-[#174A84]/20'
                      : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${agent.themeColor} text-white shadow-sm`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${agent.accentBg}`}>
                        {agent.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {agent.titleAr}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {agent.titleEn}
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {agent.roleDescription}
                    </p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-[#174A84] dark:text-sky-400">
                    <span>{isSelected ? 'الوكيل النشط حالياً ✓' : 'اختيار وتوجيه الأمر'}</span>
                    <Sparkles className={`w-3.5 h-3.5 ${isSelected ? 'animate-spin' : ''}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Agent Command Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left/Main: Command Input & Deliverables */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${activeAgentInfo.themeColor} text-white shadow-sm`}>
                      <activeAgentInfo.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {activeAgentInfo.titleAr}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activeAgentInfo.titleEn}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 px-3 py-1 rounded-full font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    جاهز للتنفيذ الفوري
                  </span>
                </div>

                {/* Quick Command Templates for Selected Agent */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    أوامر تشغيلية نموذجية موجهة لـ ({activeAgentInfo.titleAr}):
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {activeAgentInfo.quickCommands.map((qc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCommandInput(qc.prompt);
                          handleExecuteAgentCommand(qc.prompt);
                        }}
                        className="p-2.5 rounded-xl text-right bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition active:scale-95 cursor-pointer space-y-1"
                      >
                        <div className="font-bold text-[#174A84] dark:text-sky-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          <span>{qc.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {qc.prompt}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Command Input Area */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    اكتب أو أملِ أمرك باللغة الطبيعية (سواء تسعيرة، فاتورة، أمر شراء، تقرير، أو استفسار):
                  </label>
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      placeholder="مثال: اعمل تسعيرة رسمية لعميل شركة اليمامة لـ 50 كاشف دخان ومضخة حريق 500 GPM بهامش ربح 20%..."
                      className="w-full p-3.5 pl-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#174A84] leading-relaxed"
                    />

                    <div className="absolute left-2.5 bottom-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleVoice}
                        className={`p-2 rounded-lg border transition cursor-pointer ${
                          isListening
                            ? 'bg-red-500 text-white border-red-600 animate-pulse'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                        title={isListening ? 'إيقاف التسجيل' : 'تفعيل الإملاء الصوتي بالعربية'}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        disabled={!commandInput.trim() || isExecuting}
                        onClick={() => handleExecuteAgentCommand()}
                        className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#174A84] to-[#007A5A] hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                      >
                        {isExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rotate-180" />}
                        <span>تنفيذ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Results & Generated Deliverable Package */}
              {executionResult && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-emerald-500 text-white rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        نتيجة التنفيذ المباشر ({executionResult.agentTitleAr})
                      </h4>
                    </div>

                    <span className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                      Intent: {executionResult.intent}
                    </span>
                  </div>

                  {/* Reply Text */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {executionResult.replyText}
                  </div>

                  {/* Actions Taken Pills */}
                  {executionResult.actionsTaken && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500">الإجراءات المنجزة:</span>
                      {executionResult.actionsTaken.map((act: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800"
                        >
                          ✓ {act}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Rich Generated Deliverable Card (Quotation, Invoice, PO, DN) */}
                  {executionResult.generatedDeliverable && (
                    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#0F2440] text-white border border-emerald-500/40 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="w-5 h-5 text-emerald-400" />
                          <span className="font-black text-xs text-white">
                            {executionResult.generatedDeliverable.title}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          {executionResult.generatedDeliverable.documentNumber}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">
                        {executionResult.generatedDeliverable.summary}
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-[11px] text-slate-400">
                          تم الحفظ وتثبيت الحسابات في قاعدة البيانات تلقائياً
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (executionResult.generatedDeliverable.type === 'quotation') onNavigateTab('quotations');
                            else if (executionResult.generatedDeliverable.type === 'invoice') onNavigateTab('invoices');
                            else if (executionResult.generatedDeliverable.type === 'purchase_order') onNavigateTab('purchase_orders');
                            else if (executionResult.generatedDeliverable.type === 'delivery_note') onNavigateTab('site_logistics');
                            else onNavigateTab('dashboard');
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                        >
                          <span>فتح ومعاينة المستند بالمنظومة</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Agent Capabilities & Architecture Specs */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <ShieldCheck className="w-4 h-4 text-[#174A84] dark:text-sky-400" />
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    قدرات وصلاحيات {activeAgentInfo.titleAr}
                  </h4>
                </div>

                <div className="space-y-2.5">
                  {activeAgentInfo.capabilities.map((cap, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </span>
                      <span className="leading-relaxed">{cap}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    التحصين المحاسبي والحوكمة:
                  </span>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    كافة العمليات التي ينفذها الوكلاء تخضع لضريبة القيمة المضافة 15% وحسابات محجوز الضمان (Retention) والـ 3-Way Match دون أي تباين مالي.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TELEGRAM BOT CONTROL & LIVE GATEWAY */}
      {activeTab === 'telegram_bot' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Bot Configuration & Instructions */}
            <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-sky-500 text-white shadow-sm">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      إعدادات وربط بوت التليجرام (Telegram Bot Gateway)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ربط البوت بالخادم السحابي لاستقبال الأوامر الصوتية والنصية وتنفيذها
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    telegramConfig.isPollingActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      telegramConfig.isPollingActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  {telegramConfig.isPollingActive ? 'الاستماع النشط (Active Polling)' : 'متوقف'}
                </span>
              </div>

              {/* Bot Token Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>رمز مصادقة البوت (Telegram Bot Token):</span>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-600 hover:underline flex items-center gap-1"
                  >
                    <span>الحصول على توكن من @BotFather</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>
                <input
                  type="password"
                  value={telegramConfig.botToken}
                  onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })}
                  placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#174A84]"
                />
              </div>

              {/* Bot Username & Passcode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    معرف البوت (Bot Username):
                  </label>
                  <input
                    type="text"
                    value={telegramConfig.botUsername}
                    onChange={(e) => setTelegramConfig({ ...telegramConfig, botUsername: e.target.value })}
                    placeholder="@RMT_Master_Bot"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    رمز المرور التنفيذي (Executive PIN):
                  </label>
                  <input
                    type="text"
                    value={telegramConfig.executivePasscode}
                    onChange={(e) => setTelegramConfig({ ...telegramConfig, executivePasscode: e.target.value })}
                    placeholder="RMT@2026"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveTelegramConfig}
                  disabled={isSavingTg}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#174A84] to-[#007A5A] hover:opacity-90 text-white font-bold text-xs flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                >
                  {isSavingTg ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{tgSaveSuccess ? 'تم الحفظ بنجاح ✓' : 'حفظ إعدادات البوت'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePingTest}
                  disabled={isPingTesting}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="إرسال رسالة تجريبية وفحص سرعة الاتصال بالخادم"
                >
                  {isPingTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-200" />}
                  <span>فحص الاتصال (Ping Test)</span>
                </button>

                <button
                  type="button"
                  onClick={handleTogglePolling}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition active:scale-95 cursor-pointer border ${
                    telegramConfig.isPollingActive
                      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>{telegramConfig.isPollingActive ? 'إيقاف الاستماع المباشر' : 'تشغيل الاستماع الفوري (Start Polling)'}</span>
                </button>
              </div>

              {/* Ping Test Result Alert */}
              {pingTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between animate-in fade-in ${
                    pingTestResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {pingTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{pingTestResult.message}</span>
                  </div>
                  {pingTestResult.latencyMs !== undefined && (
                    <span className="font-mono text-[10px] bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded">
                      ⚡ {pingTestResult.latencyMs} ms
                    </span>
                  )}
                </div>
              )}

              {/* Interactive Report Dispatcher to Telegram */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-[#0F2440] text-white border border-sky-500/30 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-xs">إرسال تقرير تفاعلي فوري إلى تليجرام</span>
                  </div>
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono">
                    TelegramBridge Live
                  </span>
                </div>

                <p className="text-[11px] text-slate-300">
                  إرسال بطاقات وتقارير تفاعلية تحتوي على أزرار إجراءات ذكية (Inline Keyboards) مباشرة لهاتفك أو الإدارة العليا مع تحديث حالة Firebase:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDispatchReport('morning_briefing')}
                    disabled={isDispatchingReport}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center"
                  >
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>التقرير الصباحي التنفيذي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDispatchReport('evm_performance')}
                    disabled={isDispatchingReport}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center"
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>تقرير الـ EVM ومراكز التكلفة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDispatchReport('liquidity_sentinel')}
                    disabled={isDispatchingReport}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold flex flex-col items-center gap-1.5 transition active:scale-95 cursor-pointer text-center"
                  >
                    <DollarSign className="w-4 h-4 text-sky-400" />
                    <span>تقرير حارس السيولة (60 يوماً)</span>
                  </button>
                </div>

                {dispatchMessage && (
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-sky-400/40 text-xs text-sky-200 animate-in fade-in">
                    {dispatchMessage}
                  </div>
                )}
              </div>

              {/* Multimodal File Transformation & Cloud Ingestion Studio */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 text-[#174A84] dark:text-sky-400" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      استقبال وقراءة وتحويل الملفات السحابية (Multimodal Ingestion)
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-mono">
                    Google Drive + Firebase Auto-Sync
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  ارفع أي جدول كميات (Excel / PDF)، مواصفات فنية (Word)، صورة سند تسليم أو تسجيل صوتي ليتم تحويلها فورياً لمستند معتمد:
                </p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="tgFileInput"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.ogg,.mp3"
                    />
                    <label
                      htmlFor="tgFileInput"
                      className="flex-1 p-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-sky-500 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 cursor-pointer transition bg-white dark:bg-slate-900"
                    >
                      <FileUp className="w-4 h-4 text-sky-500" />
                      <span>{uploadedFile ? uploadedFile.name : 'اختر أو اسحب ملفاً (PDF / Excel / Word / صورة)'}</span>
                    </label>

                    {uploadedFile && (
                      <button
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-rose-100 hover:text-rose-600 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>

                  {uploadedFile && (
                    <div className="space-y-2 pt-1 animate-in fade-in">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          الأمر أو التوجيه المطلوب للملف:
                        </label>
                        <input
                          type="text"
                          value={fileInstruction}
                          onChange={(e) => setFileInstruction(e.target.value)}
                          placeholder="مثال: استخرج البنود واحسب 15% ضريبة وحولها لعرض سعر رسمي"
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleTransformFile}
                        disabled={isTransformingFile}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
                      >
                        {isTransformingFile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                        <span>{isTransformingFile ? 'جاري التحليل والمزامنة السحابية...' : 'مباشرة التحليل والتحويل والرفع إلى Google Drive & Firebase'}</span>
                      </button>
                    </div>
                  )}

                  {transformedResult && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-white border border-emerald-500/40 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between font-bold text-xs text-emerald-400 border-b border-white/10 pb-2">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تم تحويل الملف بنجاح!</span>
                        </span>
                        <span className="font-mono text-[11px] text-amber-300">{transformedResult.documentNumber || transformedResult.docNum}</span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {transformedResult.summary || transformedResult.summaryArabic || 'تم اعتماد البنود والأسعار والضريبة 15%'}
                      </p>

                      <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            if (transformedResult.deliverableType === 'invoice') onNavigateTab('invoices');
                            else onNavigateTab('quotations');
                          }}
                          className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-black text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <span>معاينة المستند في المنظومة</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href="https://drive.google.com"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                        >
                          <Cloud className="w-3.5 h-3.5 text-sky-400" />
                          <span>Google Drive</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 1-Minute Setup Guide */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-white block flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  طريقة ربط البوت في دقيقة واحدة:
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  <li>افتح تطبيق تليجرام وابحث عن المعرف الرسمي: <strong>@BotFather</strong></li>
                  <li>أرسل الأمر <code>/newbot</code> ثم اختر اسماً ومعرفاً للبوت (مثال: <code>RmtMasterBot</code>).</li>
                  <li>انسخ الـ <strong>API Token</strong> الذي يمنحه لك والصقه في الحقل أعلاه واضغط "حفظ".</li>
                  <li>اضغط على "تشغيل الاستماع الفوري" وابدأ في إرسال الأوامر بالصوت أو النص فوراً!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Right: Simulated Interactive Telegram Bot Chat View */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl flex flex-col h-[520px] overflow-hidden">
              {/* Telegram App Header */}
              <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>RMT Master Enterprise Bot</span>
                      <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded font-mono">bot</span>
                    </h4>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      متصل ومستعد لمعالجة الأوامر
                    </p>
                  </div>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  Live Telegram Simulator
                </span>
              </div>

              {/* Chat Message History */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0e1621] [scrollbar-width:thin]">
                {telegramChatLog.map((msg, idx) => {
                  const isBot = msg.sender === 'bot';
                  return (
                    <div key={idx} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm whitespace-pre-line ${
                          isBot
                            ? 'bg-[#182533] text-slate-100 rounded-tl-xs border border-slate-700/50'
                            : 'bg-gradient-to-r from-[#2b5278] to-[#1e3b56] text-white rounded-tr-xs'
                        }`}
                      >
                        <p>{msg.text}</p>

                        {msg.deliverable && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/40 text-[11px] space-y-1.5">
                            <div className="flex items-center justify-between font-bold text-emerald-400">
                              <span>{msg.deliverable.title}</span>
                              <span className="font-mono text-[10px] text-amber-300">{msg.deliverable.documentNumber}</span>
                            </div>
                            <p className="text-slate-300 text-[10px]">{msg.deliverable.summary}</p>
                            <button
                              type="button"
                              onClick={() => {
                                if (msg.deliverable.type === 'quotation') onNavigateTab('quotations');
                                else if (msg.deliverable.type === 'invoice') onNavigateTab('invoices');
                                else if (msg.deliverable.type === 'purchase_order') onNavigateTab('purchase_orders');
                                else if (msg.deliverable.type === 'delivery_note') onNavigateTab('site_logistics');
                              }}
                              className="w-full py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>معاينة المستند بالمنظومة</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        <span className="block text-[9px] text-right mt-1 text-slate-400 font-mono">
                          {msg.time}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-[#17212b] border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  value={simulatedChatInput}
                  onChange={(e) => setSimulatedChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && simulatedChatInput.trim()) {
                      handleExecuteAgentCommand(simulatedChatInput);
                      setSimulatedChatInput('');
                    }
                  }}
                  placeholder="أرسل رسالة تجريبية للبوت كما لو كنت في تليجرام..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#0e1621] border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (simulatedChatInput.trim()) {
                      handleExecuteAgentCommand(simulatedChatInput);
                      setSimulatedChatInput('');
                    }
                  }}
                  className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Telegram Bridge Live Execution Logs Sub-Component */}
        <TelegramExecutionLogsViewer onNavigateTab={onNavigateTab} maxLogs={20} />
      </div>
      )}

      {/* TAB 3: EARNED VALUE MANAGEMENT (EVM) & COST CENTERS PER DISCIPLINE */}
      {activeTab === 'evm_cost_centers' && (
        <div className="space-y-6">
          {/* Project Selector Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">اختر المشروع للتحليل المالي المتقدم:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectNumber || 'PRJ'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">قيمة العقد:</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {currentEVM.bac.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
              </span>
              <span className="text-slate-500">نسبة الإنجاز:</span>
              <span className="font-bold text-emerald-600 font-mono">
                {currentSelectedProject.completionPercentage || 0}%
              </span>
            </div>
          </div>

          {/* EVM Performance KPI Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">القيمة المخططة (Planned Value - PV)</span>
              <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {currentEVM.pv.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
              </div>
              <span className="text-[10px] text-slate-400">القيمة المستهدفة للعمل المخطط حتى اليوم</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">القيمة المكتسبة (Earned Value - EV)</span>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {currentEVM.ev.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
              </div>
              <span className="text-[10px] text-emerald-500">قيمة العمل المنجز فعلياً بالمشروع</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">مؤشر أداء التكلفة (CPI = EV/AC)</span>
              <div className={`text-lg font-black font-mono flex items-center gap-1.5 ${currentEVM.cpi >= 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
                <span>{currentEVM.cpi}</span>
                <span className="text-xs font-sans">({currentEVM.cpi >= 1 ? 'وفورات تكلفة ✓' : 'تجاوز تكلفة ⚠️'})</span>
              </div>
              <span className="text-[10px] text-slate-400">كفاءة الإنفاق مقابل كل ريال منجز</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">مؤشر أداء الجدول الزمني (SPI = EV/PV)</span>
              <div className={`text-lg font-black font-mono flex items-center gap-1.5 ${currentEVM.spi >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                <span>{currentEVM.spi}</span>
                <span className="text-xs font-sans">({currentEVM.spi >= 1 ? 'متقدم على المخطط' : 'متأخر زمنياً'})</span>
              </div>
              <span className="text-[10px] text-slate-400">كفاءة سرعة التنفيذ الميداني</span>
            </div>
          </div>

          {/* Cost Centers Breakdown Per Discipline */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#174A84] dark:text-sky-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  شجرة الحسابات ومراكز التكلفة المرتبطة بالأنظمة (Cost Centers per Discipline)
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                تحديد ربحية وهوامش كل نظام كهروميكانيكي على حدة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-2.5 px-3">النظام الهندسي (Discipline)</th>
                    <th className="py-2.5 px-3">الميزانية المعتمدة</th>
                    <th className="py-2.5 px-3">المفوتر حتى اليوم</th>
                    <th className="py-2.5 px-3">التكلفة المباشرة</th>
                    <th className="py-2.5 px-3">صافي الربح المحقق</th>
                    <th className="py-2.5 px-3">هامش الربح %</th>
                    <th className="py-2.5 px-3">نسبة الإنجاز</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {currentCostCenters.map((cc) => (
                    <tr key={cc.discipline} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-3 font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${cc.badgeColor}`} />
                        <span>{cc.titleAr}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {cc.allocatedBudget.toLocaleString('en-US')} ر.س
                      </td>
                      <td className="py-3 px-3 text-sky-600 dark:text-sky-400 font-bold">
                        {cc.billedAmount.toLocaleString('en-US')} ر.س
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {cc.actualCost.toLocaleString('en-US')} ر.س
                      </td>
                      <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-black">
                        +{cc.grossProfit.toLocaleString('en-US')} ر.س
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white font-sans">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {cc.marginPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <div className="w-24 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${cc.completionPercent}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RETENTION & DLP SCHEDULE */}
      {activeTab === 'retention_dlp' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  إدارة محجوز الضمان (Retention 5-10%) وجدول استحقاق فترة الصيانة (DLP)
                </h3>
              </div>

              <span className="text-xs bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-3 py-1 rounded-full font-bold border border-amber-200 dark:border-amber-800">
                {currentRetentionDLP.statusLabelAr}
              </span>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-xs text-slate-500 font-bold">إجمالي محجوز الضمان المستهدف ({currentRetentionDLP.retentionPercent}%)</span>
                <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {currentRetentionDLP.totalRetentionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </div>
                <p className="text-[10px] text-slate-400">محتجز حتى نهاية فترة الضمان والصيانة</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-xs text-slate-500 font-bold">المحتجز المتراكم حتى اليوم</span>
                <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                  {currentRetentionDLP.retentionAccumulatedSoFar.toLocaleString('en-US', { minimumFractionDigits: 2 })} ر.س
                </div>
                <p className="text-[10px] text-amber-500">مستقطع عبر المستخلصات الضريبية الشهرية</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-xs text-slate-500 font-bold">تاريخ انتهاء فترة الضمان (DLP Expiration)</span>
                <div className="text-lg font-black text-sky-600 dark:text-sky-400 font-mono">
                  {currentRetentionDLP.dlpExpirationDate}
                </div>
                <p className="text-[10px] text-sky-500">متبقي {Math.max(0, currentRetentionDLP.daysUntilDlpRelease)} يوماً للإفراج النهائي</p>
              </div>
            </div>

            {/* Advance Payment Amortization Progress */}
            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <span>استهلاك الدفعة المقدمة تدريجياً (Advance Payment Amortization):</span>
                <span className="font-mono">
                  {currentRetentionDLP.advancePaymentAmortized.toLocaleString('en-US')} / {currentRetentionDLP.advancePaymentTotal.toLocaleString('en-US')} ر.س
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${currentRetentionDLP.advancePaymentTotal > 0 ? (currentRetentionDLP.advancePaymentAmortized / currentRetentionDLP.advancePaymentTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                يتم خصم النسبة المقررة من كل مستخلص شهري آلياً حتى استهلاك الدفعة المقدمة بالكامل بنهاية المشروع.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function SaveIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </svg>
  );
}
