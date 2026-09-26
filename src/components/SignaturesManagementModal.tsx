import React, { useState, useEffect, useRef } from 'react';
import {
  PenTool,
  X,
  Upload,
  Trash2,
  Check,
  Sparkles,
  Plus,
  UserPlus,
  User,
  Briefcase,
  Edit2,
  Save,
  RotateCcw,
  Palette,
  Search,
  CheckCircle2,
  ShieldCheck,
  Stamp,
  Users,
} from 'lucide-react';
import { GovernanceSignatures } from './GovernanceSignatures';
import {
  PersonSignature,
  DEFAULT_SIGNATURE_ROLES,
  getAllPersonSignatures,
  savePersonSignatureRecord,
  deletePersonSignatureRecord,
  removeSignature,
  processSignatureImage,
} from '../utils/signatureStorage';

interface SignaturesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignaturesManagementModal: React.FC<SignaturesManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [personsList, setPersonsList] = useState<PersonSignature[]>([]);
  const [activeTab, setActiveTab] = useState<'governance' | 'registry'>('governance');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // New Person / Draw Signature Modal State
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [activeDrawPersonId, setActiveDrawPersonId] = useState<string | null>(null);

  // Form State for Adding / Editing Person
  const [formData, setFormData] = useState({
    personName: '',
    personTitle: '',
    department: 'إدارة المشاريع والهندسة',
    roleKey: '',
  });

  // Digital Drawing Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState<'#1e40af' | '#0f172a' | '#047857'>('#1e40af'); // Royal Blue default
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);
  const [drawTargetPerson, setDrawTargetPerson] = useState<PersonSignature | null>(null);

  const loadData = () => {
    const list = getAllPersonSignatures();
    setPersonsList(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Canvas Drawing Handlers
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    setHasDrawnStroke(false);
  };

  useEffect(() => {
    if (activeDrawPersonId && canvasRef.current) {
      initCanvas();
    }
  }, [activeDrawPersonId, penColor]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasDrawnStroke(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSaveDrawnSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawTargetPerson || !hasDrawnStroke) return;

    try {
      const rawDataUrl = canvas.toDataURL('image/png');
      const processed = await processSignatureImage(rawDataUrl, {
        makeBackgroundTransparent: true,
        convertToBlueInk: penColor === '#1e40af',
        maxWidth: 400,
        maxHeight: 160,
      });

      const updated: PersonSignature = {
        ...drawTargetPerson,
        signatureImage: processed,
        updatedAt: new Date().toISOString(),
      };

      savePersonSignatureRecord(updated);
      loadData();
      setActiveDrawPersonId(null);
      setDrawTargetPerson(null);
      showToast(`تم حفظ التوقيع الرقمي للشخص (${updated.personName}) بنجاح`);
    } catch (err) {
      console.error('Failed to save drawn signature', err);
    }
  };

  // Image Upload Handler
  const handleFileUpload = async (person: PersonSignature, file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const rawDataUrl = reader.result as string;
      try {
        const processed = await processSignatureImage(rawDataUrl, {
          makeBackgroundTransparent: true,
          convertToBlueInk: true,
          maxWidth: 400,
          maxHeight: 160,
        });

        const updated: PersonSignature = {
          ...person,
          signatureImage: processed,
          updatedAt: new Date().toISOString(),
        };

        savePersonSignatureRecord(updated);
        loadData();
        showToast(`تم تحديث توقيع (${person.personName}) وإزالة الخلفية البيضاء بنجاح`);
      } catch (err) {
        console.error('Error processing signature', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Remove Signature Image
  const handleClearSignatureImage = (person: PersonSignature) => {
    removeSignature(person.roleKey || person.id);
    const updated: PersonSignature = {
      ...person,
      signatureImage: undefined,
      updatedAt: new Date().toISOString(),
    };
    savePersonSignatureRecord(updated);
    loadData();
    showToast(`تم مسح توقيع (${person.personName})`);
  };

  // Handle Delete Person
  const handleDeletePerson = (personId: string, personName: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الشخص (${personName}) من سجل التواقيع؟`)) {
      deletePersonSignatureRecord(personId);
      loadData();
      showToast(`تم حذف الشخص (${personName}) بنجاح`);
    }
  };

  // Handle Add New Person Submit
  const handleSavePersonForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.personName.trim() || !formData.personTitle.trim()) {
      alert('يرجى كتابة اسم الشخص والمنصب / المسمى الوظيفي');
      return;
    }

    if (editingPersonId) {
      const existing = personsList.find((p) => p.id === editingPersonId);
      if (existing) {
        const updated: PersonSignature = {
          ...existing,
          personName: formData.personName.trim(),
          personTitle: formData.personTitle.trim(),
          department: formData.department.trim(),
          updatedAt: new Date().toISOString(),
        };
        savePersonSignatureRecord(updated);
        showToast(`تم تحديث بيانات (${updated.personName}) بنجاح`);
      }
    } else {
      const newId = `person_${Date.now()}`;
      const newPerson: PersonSignature = {
        id: newId,
        roleKey: newId,
        personName: formData.personName.trim(),
        personTitle: formData.personTitle.trim(),
        department: formData.department.trim(),
        isCustom: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      savePersonSignatureRecord(newPerson);
      showToast(`تمت إضافة الشخص (${newPerson.personName}) بنجاح! يمكنك الآن رسم أو رفع توقيعه.`);
    }

    loadData();
    setShowAddPersonModal(false);
    setEditingPersonId(null);
    setFormData({
      personName: '',
      personTitle: '',
      department: 'إدارة المشاريع والهندسة',
      roleKey: '',
    });
  };

  const handleOpenEditPerson = (person: PersonSignature) => {
    setEditingPersonId(person.id);
    setFormData({
      personName: person.personName,
      personTitle: person.personTitle,
      department: person.department || 'إدارة المشاريع والهندسة',
      roleKey: person.roleKey,
    });
    setShowAddPersonModal(true);
  };

  const handleOpenDrawModal = (person: PersonSignature) => {
    setDrawTargetPerson(person);
    setActiveDrawPersonId(person.id);
  };

  const filteredPersons = personsList.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.personName.toLowerCase().includes(q) ||
      p.personTitle.toLowerCase().includes(q) ||
      (p.department && p.department.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-[#0A261D] text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg">
              <PenTool className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white font-cairo">
                  دليل وإدارة التواقيع المعتمدة والأشخاص المفوضين
                </h2>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {personsList.length} شخص مسجل
                </span>
              </div>
              <p className="text-xs text-slate-300">
                إضافة الأشخاص وتوثيق مناصبهم ورسم أو رفع التواقيع وتطبيقها تلقائياً على المستندات الرسمية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl flex items-center gap-2 transition cursor-pointer border-t border-x ${
              activeTab === 'governance'
                ? 'bg-white text-emerald-800 border-slate-200 border-b-white shadow-xs -mb-[1px]'
                : 'text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Stamp className="w-4 h-4 text-amber-500" />
            <span>التواقيع المعتمدة والحوكمة (Strict Governance & Seal)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('registry')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl flex items-center gap-2 transition cursor-pointer border-t border-x ${
              activeTab === 'registry'
                ? 'bg-white text-emerald-800 border-slate-200 border-b-white shadow-xs -mb-[1px]'
                : 'text-slate-500 hover:text-slate-800 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-4 h-4 text-blue-600" />
            <span>سجل الموظفين والمفوضين ({personsList.length})</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Tab 1: Governance & Strict Signatures */}
        {activeTab === 'governance' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <GovernanceSignatures onSignatureUpdated={loadData} />
          </div>
        )}

        {/* Tab 2: Personnel Registry */}
        {activeTab === 'registry' && (
          <>
            {/* Toolbar: Search & Add Person Button */}
            <div className="p-4 sm:p-6 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث بالاسم، المسمى الوظيفي، أو القسم..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl pr-10 pl-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingPersonId(null);
              setFormData({
                personName: '',
                personTitle: '',
                department: 'إدارة المشاريع والهندسة',
                roleKey: '',
              });
              setShowAddPersonModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة شخص وتوقيع جديد</span>
          </button>
        </div>

        {/* People & Signatures Cards Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5 divide-y divide-slate-100">
          {filteredPersons.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              لا يوجد أشخاص يطابقون معايير البحث
            </div>
          ) : (
            filteredPersons.map((person) => {
              const hasSig = !!person.signatureImage;

              return (
                <div
                  key={person.id}
                  className="pt-3.5 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-emerald-500/40 hover:shadow-md transition group"
                >
                  {/* Person Details */}
                  <div className="space-y-1.5 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                          <span>{person.personName}</span>
                          {person.isCustom && (
                            <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              مخصص
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{person.personTitle}</span>
                        </div>
                      </div>
                    </div>

                    {person.department && (
                      <div className="text-[10px] text-slate-500 pr-10">
                        القسم: {person.department}
                      </div>
                    )}
                  </div>

                  {/* Signature Preview Canvas Box */}
                  <div className="flex-1 max-w-xs h-20 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center p-2 relative group/sig shadow-inner">
                    {hasSig ? (
                      <img
                        src={person.signatureImage}
                        alt={person.personName}
                        className="max-h-full max-w-[220px] object-contain filter contrast-125 select-none"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400 text-center leading-tight">
                        لا يوجد توقيع مسجل
                        <br />
                        <span className="text-[9px] text-slate-400">(خط فارغ للتوقيع اليدوي)</span>
                      </span>
                    )}

                    {hasSig && (
                      <button
                        type="button"
                        onClick={() => handleClearSignatureImage(person)}
                        className="absolute top-1 left-1 p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg opacity-0 group-hover/sig:opacity-100 transition cursor-pointer"
                        title="مسح صورة التوقيع"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Actions (Draw / Upload / Edit / Delete) */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-end">
                    {/* Draw with Digital Pen */}
                    <button
                      type="button"
                      onClick={() => handleOpenDrawModal(person)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      title="رسم التوقيع رقمياً بالقلم"
                    >
                      <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                      <span>رسم</span>
                    </button>

                    {/* Upload Scanned Image */}
                    <input
                      type="file"
                      id={`file-${person.id}`}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(person, f);
                      }}
                    />
                    <label
                      htmlFor={`file-${person.id}`}
                      className="cursor-pointer px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs flex items-center gap-1.5 transition active:scale-95"
                      title="رفع صورة ممسوحة ضوئياً"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>رفع</span>
                    </label>

                    {/* Edit Person Data */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditPerson(person)}
                      className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                      title="تعديل الاسم والمنصب"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete Custom Person */}
                    {person.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeletePerson(person.id, person.personName)}
                        className="p-1.5 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                        title="حذف هذا الشخص نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
          </>
        )}

        {/* Modal Footer Note */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-emerald-800 font-medium">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              نظام المعالجة الذكي: يتم تلقائياً تفريغ الخلفيات البيضاء وتحسين حبر التوقيع باللون الأزرق المعتمد للطباعة والتصدير بدقة عالية
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
          >
            تم وإغلاق
          </button>
        </div>
      </div>

      {/* Submodal: Add / Edit Person */}
      {showAddPersonModal && (
        <div
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowAddPersonModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-slate-900">
                  {editingPersonId ? 'تعديل بيانات الشخص المفوض' : 'إضافة شخص مفوض جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPersonModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePersonForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الشخص الثلاثي / الرباعي (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.personName}
                  onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                  placeholder="e.g. م. مختار يوسف / Eng. Mokhtar Yousef"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المنصب / المسمى الوظيفي (Job Title / Position) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.personTitle}
                  onChange={(e) => setFormData({ ...formData, personTitle: e.target.value })}
                  placeholder="e.g. مدير عام المشاريع والمكتب الفني / Projects Manager"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  القسم / الإدارة (Department)
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. إدارة المشاريع والهندسة / الشؤون المالية"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPersonModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingPersonId ? 'حفظ التعديلات' : 'إضافة وتثبيت'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submodal: Digital Pen Signature Pad */}
      {activeDrawPersonId && drawTargetPerson && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setActiveDrawPersonId(null)}
        >
          <div
            className="bg-[#0B1329] border border-slate-700 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PenTool className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-black text-sm text-white">لوحة رسم التوقيع الرقمي</h3>
                  <p className="text-[11px] text-slate-400">
                    توقيع: <span className="text-emerald-400 font-bold">{drawTargetPerson.personName}</span> ({drawTargetPerson.personTitle})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawPersonId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Canvas Options */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px] font-bold">لون الحبر:</span>
                <button
                  type="button"
                  onClick={() => setPenColor('#1e40af')}
                  className={`w-6 h-6 rounded-full bg-blue-700 border-2 transition cursor-pointer ${
                    penColor === '#1e40af' ? 'border-white scale-110 shadow' : 'border-transparent opacity-60'
                  }`}
                  title="أزرق ملكي معتمد"
                />
                <button
                  type="button"
                  onClick={() => setPenColor('#0f172a')}
                  className={`w-6 h-6 rounded-full bg-slate-900 border-2 transition cursor-pointer ${
                    penColor === '#0f172a' ? 'border-white scale-110 shadow' : 'border-transparent opacity-60'
                  }`}
                  title="أسود كلاسيكي"
                />
                <button
                  type="button"
                  onClick={() => setPenColor('#047857')}
                  className={`w-6 h-6 rounded-full bg-emerald-700 border-2 transition cursor-pointer ${
                    penColor === '#047857' ? 'border-white scale-110 shadow' : 'border-transparent opacity-60'
                  }`}
                  title="أخضر رسمي"
                />
              </div>

              <button
                type="button"
                onClick={initCanvas}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>مسح وإعادة الرسم</span>
              </button>
            </div>

            {/* HTML5 Canvas */}
            <div className="bg-white rounded-2xl p-2 border-2 border-slate-700 shadow-inner overflow-hidden cursor-crosshair">
              <canvas
                ref={canvasRef}
                width={440}
                height={180}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-44 bg-slate-50/50 rounded-xl touch-none"
              />
            </div>

            <p className="text-[10px] text-slate-400 text-center">
              ارسم التوقيع باستخدام الماوس أو إصبعك على الشاشات اللمسية، ثم اضغط حفظ
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveDrawPersonId(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={!hasDrawnStroke}
                onClick={handleSaveDrawnSignature}
                className="px-5 py-2 text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
                <span>اعتماد وحفظ التوقيع</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
