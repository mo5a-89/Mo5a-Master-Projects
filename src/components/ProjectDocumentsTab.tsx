import React, { useState, useRef, useEffect } from 'react';
import { Project, SupplierQuotation, ProjectDocument, User as UserType } from '../types';
import { getStoredUser } from '../utils/authService';
import {
  uploadAttachmentToDrive,
  filterAttachmentsByRBAC,
  inferAttachmentCategory,
  AttachmentCategory,
} from '../utils/attachmentPipeline';
import {
  Folder,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Edit2,
  Copy,
  Check,
  Tag,
  Clock,
  User,
  Layers,
  Cloud,
  FileCheck2,
  UploadCloud,
  Camera,
  Truck,
  Receipt,
  ShoppingBag,
} from 'lucide-react';

interface ProjectDocumentsTabProps {
  project: Project;
  supplierQuotations?: SupplierQuotation[];
  onUpdateProjectDocuments?: (projectId: string, documents: ProjectDocument[]) => void;
  onUpdateMasterDriveUrl?: (projectId: string, url: string) => void;
  onViewSupplierQuote?: (supplierQuote: SupplierQuotation) => void;
  onOpenUploadSupplierModal?: (projectId: string) => void;
}

export function normalizeCategoryKey(rawCat?: string): string {
  if (!rawCat) return 'OTHER';
  const c = String(rawCat).toUpperCase().trim();
  switch (c) {
    case 'DRAWINGS':
    case 'TECHNICAL_DRAWING':
    case 'TECHNICAL_DRAWINGS':
      return 'DRAWINGS';
    case 'DELIVERY_NOTES':
    case 'DELIVERY_NOTE':
      return 'DELIVERY_NOTES';
    case 'BOQ':
      return 'BOQ';
    case 'SUBMITTALS':
    case 'SUBMITTAL':
      return 'SUBMITTALS';
    case 'PHOTOS':
    case 'SITE_PHOTO':
    case 'SITE_PHOTOS':
      return 'PHOTOS';
    case 'INVOICES':
    case 'FINANCIAL_INVOICE':
    case 'FINANCIAL_INVOICES':
    case 'INVOICE':
      return 'INVOICES';
    case 'SUPPLIER_QUOTES':
    case 'SUPPLIER_QUOTE':
      return 'SUPPLIER_QUOTES';
    case 'PURCHASE_ORDERS':
    case 'PURCHASE_ORDER':
      return 'PURCHASE_ORDERS';
    case 'ALL':
      return 'ALL';
    default:
      return 'OTHER';
  }
}

const ALL_CATEGORY_LABELS: Record<string, { label: string; icon: any; color: string; restrictedToAdmins?: boolean }> = {
  ALL: { label: 'كافة الوثائق المتاحة (All Available)', icon: Folder, color: 'bg-slate-100 text-slate-800' },
  DRAWINGS: { label: 'مخططات تنفيذية (Drawings)', icon: FileCode, color: 'bg-blue-50 text-blue-800 border-blue-200' },
  DELIVERY_NOTES: { label: 'سندات تسليم وإدخال (Delivery Notes)', icon: Truck, color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  BOQ: { label: 'جداول الكميات (BOQ)', icon: FileSpreadsheet, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  SUBMITTALS: { label: 'الاعتمادات الفنية (Submittals)', icon: Layers, color: 'bg-amber-50 text-amber-800 border-amber-200' },
  PHOTOS: { label: 'صور وإثباتات ميدانية (Site Photos)', icon: Camera, color: 'bg-teal-50 text-teal-800 border-teal-200' },
  INVOICES: { label: 'الفواتير والماليات (Invoices)', icon: Receipt, color: 'bg-rose-50 text-rose-800 border-rose-200', restrictedToAdmins: true },
  PURCHASE_ORDERS: { label: 'أوامر الشراء (Purchase Orders)', icon: ShoppingBag, color: 'bg-purple-50 text-purple-800 border-purple-200', restrictedToAdmins: true },
  SUPPLIER_QUOTES: { label: 'تسعيرات الموردين (Supplier Quotes)', icon: FileText, color: 'bg-cyan-50 text-cyan-800 border-cyan-200', restrictedToAdmins: true },
  OTHER: { label: 'ملفات أخرى (Other)', icon: File, color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const ProjectDocumentsTab: React.FC<ProjectDocumentsTabProps> = ({
  project,
  onUpdateProjectDocuments,
  onUpdateMasterDriveUrl,
}) => {
  const [user, setUser] = useState<UserType | null>(() => getStoredUser());

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ProjectDocument | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master Drive Folder Edit State
  const [isEditingMasterDrive, setIsEditingMasterDrive] = useState(false);
  const [masterDriveInput, setMasterDriveInput] = useState(project.masterDriveFolderUrl || '');

  // Form State for Add/Edit
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<AttachmentCategory>('TECHNICAL_DRAWING');
  const [docDriveUrl, setDocDriveUrl] = useState('');
  const [docFileName, setDocFileName] = useState('');
  const [docFileSize, setDocFileSize] = useState('');
  const [docFileType, setDocFileType] = useState<'dwg' | 'pdf' | 'xlsx' | 'docx' | 'zip' | 'other'>('pdf');
  const [docVersion, setDocVersion] = useState('v1.0');
  const [docUploadedBy, setDocUploadedBy] = useState(user?.name || 'Project Engineer');
  const [docLinkedEntityId, setDocLinkedEntityId] = useState('');

  const rawDocuments = project.documents || [];
  // Apply RBAC Masking: Site engineers NEVER see financial invoices or PO attachments
  const permittedDocuments = filterAttachmentsByRBAC(rawDocuments, user);

  // Filter available categories based on RBAC
  const isEngineer = user?.role === 'engineer' || user?.role === 'viewer';
  const categoryLabels = Object.entries(ALL_CATEGORY_LABELS).reduce((acc, [k, v]) => {
    if (isEngineer && v.restrictedToAdmins) {
      return acc;
    }
    acc[k] = v;
    return acc;
  }, {} as typeof ALL_CATEGORY_LABELS);

  // Filtered documents using strict normalized category matching
  const filteredDocs = permittedDocuments.filter((doc) => {
    const normCat = normalizeCategoryKey(doc.category);
    const matchesCat = selectedCategory === 'ALL' || normCat === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (doc.title || doc.name || '').toLowerCase().includes(q) ||
      (doc.fileName || '').toLowerCase().includes(q) ||
      (doc.uploadedBy || '').toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleSaveMasterDrive = () => {
    if (onUpdateMasterDriveUrl) {
      onUpdateMasterDriveUrl(project.id, masterDriveInput.trim());
    }
    setIsEditingMasterDrive(false);
  };

  const handleOpenAddModal = (docToEdit?: ProjectDocument) => {
    if (docToEdit) {
      setEditingDoc(docToEdit);
      setDocTitle(docToEdit.title || docToEdit.name || '');
      setDocCategory(normalizeCategoryKey(docToEdit.category) as any);
      setDocDriveUrl(docToEdit.driveUrl || '');
      setDocFileName(docToEdit.fileName || '');
      setDocFileSize(docToEdit.fileSize || docToEdit.size || '');
      setDocFileType((docToEdit.fileType as any) || 'pdf');
      setDocVersion(docToEdit.version || 'v1.0');
      setDocUploadedBy(docToEdit.uploadedBy || user?.name || 'Project Engineer');
      setDocLinkedEntityId(docToEdit.linkedEntityId || '');
    } else {
      setEditingDoc(null);
      setDocTitle('');
      const defaultCat =
        selectedCategory !== 'ALL'
          ? selectedCategory
          : 'DRAWINGS';
      setDocCategory(defaultCat as any);
      setDocDriveUrl('');
      setDocFileName('');
      setDocFileSize('');
      setDocFileType('pdf');
      setDocVersion('v1.0');
      setDocUploadedBy(user?.name || 'Project Engineer');
      setDocLinkedEntityId('');
    }
    setShowAddDocModal(true);
  };

  const syncDocumentsToStorage = (updatedDocs: ProjectDocument[]) => {
    if (onUpdateProjectDocuments) {
      onUpdateProjectDocuments(project.id, updatedDocs);
    }
    try {
      const rawProjects = localStorage.getItem('rmt_projects');
      if (rawProjects) {
        const projectsList = JSON.parse(rawProjects);
        const updatedProjects = projectsList.map((p: any) =>
          p.id === project.id ? { ...p, documents: updatedDocs } : p
        );
        localStorage.setItem('rmt_projects', JSON.stringify(updatedProjects));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('rmt_projects_updated', { detail: updatedProjects }));
      }
    } catch (err) {
      console.warn('[ProjectDocumentsTab] Error syncing documents to storage:', err);
    }
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setUploadProgressMsg(`جاري رفع الملف "${file.name}" إلى مجلد Google Drive (RMT Project Attachments)...`);

    try {
      // Force active category tab
      const uploadCategory = selectedCategory !== 'ALL' ? selectedCategory : 'OTHER';

      const metadata = await uploadAttachmentToDrive(
        file,
        file.name,
        uploadCategory as any,
        project.id,
        user?.name || 'Project Engineer'
      );

      const newDoc: ProjectDocument = {
        id: metadata.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        name: file.name.replace(/\.[^/.]+$/, ''),
        category: uploadCategory as any,
        driveUrl: metadata.driveUrl,
        fileName: metadata.fileName || file.name,
        fileSize: metadata.fileSize || `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        size: metadata.fileSize || `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        fileType: (file.name.split('.').pop()?.toLowerCase() as any) || 'pdf',
        version: 'v1.0',
        uploadDate: metadata.uploadDate || new Date().toISOString().split('T')[0],
        uploadedAt: metadata.uploadedAt || new Date().toISOString(),
        uploadedBy: metadata.uploadedBy || user?.name || 'Project Engineer',
      };

      const updatedList = [newDoc, ...rawDocuments];
      syncDocumentsToStorage(updatedList);

      setUploadProgressMsg('تم رفع وحفظ الوثيقة السحابية بنجاح!');
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgressMsg('');
      }, 1500);
    } catch (err: any) {
      console.error('File upload error:', err);
      alert(err?.message || 'فشل رفع الملف إلى Google Drive');
      setIsUploading(false);
      setUploadProgressMsg('');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docDriveUrl.trim()) return;

    let updatedList: ProjectDocument[];
    const targetCat = (docCategory || (selectedCategory !== 'ALL' ? selectedCategory : 'OTHER')) as any;

    if (editingDoc) {
      updatedList = rawDocuments.map((d) =>
        d.id === editingDoc.id
          ? {
              ...d,
              title: docTitle.trim(),
              name: docTitle.trim(),
              category: targetCat,
              driveUrl: docDriveUrl.trim(),
              fileName: docFileName.trim() || docTitle.trim(),
              fileSize: docFileSize.trim() || '1.2 MB',
              size: docFileSize.trim() || '1.2 MB',
              fileType: docFileType,
              version: docVersion.trim(),
              uploadedBy: docUploadedBy.trim(),
              linkedEntityId: docLinkedEntityId.trim() || undefined,
            }
          : d
      );
    } else {
      const newDoc: ProjectDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        title: docTitle.trim(),
        name: docTitle.trim(),
        category: targetCat,
        driveUrl: docDriveUrl.trim(),
        fileName: docFileName.trim() || docTitle.trim(),
        fileSize: docFileSize.trim() || '1.2 MB',
        size: docFileSize.trim() || '1.2 MB',
        fileType: docFileType,
        version: docVersion.trim(),
        uploadDate: new Date().toISOString().split('T')[0],
        uploadedAt: new Date().toISOString(),
        uploadedBy: docUploadedBy.trim(),
        linkedEntityId: docLinkedEntityId.trim() || undefined,
      };
      updatedList = [newDoc, ...rawDocuments];
    }

    syncDocumentsToStorage(updatedList);
    setShowAddDocModal(false);
  };

  const handleDeleteDocument = (docId: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا المستند من سجل المشروع؟')) {
      const updatedList = rawDocuments.filter((d) => d.id !== docId);
      syncDocumentsToStorage(updatedList);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getFileIcon = (fileType?: string) => {
    switch (fileType?.toLowerCase()) {
      case 'dwg':
        return <FileCode className="w-5 h-5 text-indigo-600" />;
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
      case 'zip':
      case 'rar':
        return <FileArchive className="w-5 h-5 text-amber-600" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-600" />;
      default:
        return <File className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDirectFileUpload}
        className="hidden"
      />

      {/* 1. Master Google Drive Project Cloud Hub */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
              <Cloud className="w-7 h-7 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">مستودع الوثائق والمرفقات السحابية (RMT Project Attachments Hub)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Google Drive Direct Pipeline
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                تفريغ تلقائي للمرفقات الثقيلة على Google Drive لحماية قاعدة البيانات وحفظ الروابط الوصفية فقط
              </p>
            </div>
          </div>

          {/* Master Drive Link / Button */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {project.masterDriveFolderUrl ? (
              <a
                href={project.masterDriveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Folder className="w-4 h-4 text-emerald-200" />
                <span>فتح مجلد المشروع (Google Drive)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => setIsEditingMasterDrive(!isEditingMasterDrive)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-200" />
              <span>{project.masterDriveFolderUrl ? 'تعديل الرابط' : 'ربط مجلد Google Drive'}</span>
            </button>
          </div>
        </div>

        {/* Upload Progress Banner */}
        {isUploading && (
          <div className="p-3 bg-blue-500/20 border border-blue-400/40 rounded-xl text-xs font-bold text-blue-100 flex items-center gap-2 animate-pulse">
            <UploadCloud className="w-4 h-4 animate-bounce text-blue-300" />
            <span>{uploadProgressMsg}</span>
          </div>
        )}

        {/* Edit Master Drive Folder URL Drawer */}
        {isEditingMasterDrive && (
          <div className="p-3 bg-white/10 rounded-xl border border-white/20 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in">
            <input
              type="url"
              value={masterDriveInput}
              onChange={(e) => setMasterDriveInput(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              className="flex-1 px-3 py-2 bg-white text-slate-900 rounded-lg text-xs font-mono outline-none border border-slate-300 focus:ring-2 focus:ring-blue-400"
              dir="ltr"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveMasterDrive}
                className="flex-1 sm:flex-none px-4 py-2 bg-[#007A5A] hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                حفظ الرابط
              </button>
              <button
                type="button"
                onClick={() => setIsEditingMasterDrive(false)}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Controls & Categories Navigation */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الوثائق، المخططات، أو المهندس..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#007A5A] focus:bg-white transition"
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-[#174A84] hover:bg-[#123a68] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              <span>رفع ملف مباشر إلى Drive</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة رابط سحابي</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {Object.entries(categoryLabels).map(([catKey, catMeta]) => {
            const count = catKey === 'ALL' 
              ? permittedDocuments.length 
              : permittedDocuments.filter((d) => normalizeCategoryKey(d.category) === catKey).length;
            const IconComp = catMeta.icon;
            const isSelected = selectedCategory === catKey;

            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                }`}
              >
                <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                <span>{catMeta.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Documents List Grid */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-3">
          <Folder className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-700">لا توجد وثائق متاحة في هذا التصنيف حالياً</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            قم برفع الملفات والمخططات الهندسية مباشرة ليتم حفظها سحابياً وتوفير روابط وصول آمنة لفريق المشروع.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-[#174A84] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>رفع ملف مباشر</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 bg-[#007A5A] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة رابط سحابي</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const catMeta = ALL_CATEGORY_LABELS[doc.category] || ALL_CATEGORY_LABELS.OTHER;
            const isCopied = copiedId === doc.id;

            return (
              <div
                key={doc.id}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        {getFileIcon(doc.fileType)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1" title={doc.title || doc.name}>
                          {doc.title || doc.name}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400 block">
                          {doc.fileName || doc.title}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catMeta.color}`}>
                      {doc.category}
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>التاريخ:</span>
                      </span>
                      <span className="font-mono text-slate-700">{doc.uploadDate || doc.uploadedAt?.split('T')[0] || '2026-09-24'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>الإصدار / الحجم:</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">
                        {doc.version || 'v1.0'} | {doc.fileSize || doc.size || '1.2 MB'}
                      </span>
                    </div>

                    {doc.uploadedBy && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-slate-500">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>بواسطة:</span>
                        </span>
                        <span className="font-medium text-slate-800">{doc.uploadedBy}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {doc.driveUrl && (
                      <a
                        href={doc.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1e3a8a] border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                        title="فتح المستند في Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>فتح المستند</span>
                      </a>
                    )}

                    {doc.driveUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(doc.driveUrl!, doc.id)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                        title="نسخ الرابط"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {!isEngineer && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(doc)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="تعديل بيانات المستند"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="حذف المستند"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Add / Edit Document Modal */}
      {showAddDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-[#007A5A] rounded-lg">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingDoc ? 'تعديل بيانات الوثيقة السحابية' : 'إضافة وثيقة فنية جديدة (Google Drive)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">حفظ الروابط والبيانات الوصفية دون تحميل ملفات ثقيلة محلياً</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDocModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  عنوان الوثيقة (Document Title) *
                </label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="مثال: مخطط إنذار الحريق المعتمد - الطابق الأرضي"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:border-[#007A5A] focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    تصنيف الوثيقة (Category) *
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:border-[#007A5A] outline-none font-bold text-slate-700"
                  >
                    <option value="DRAWINGS">مخططات تنفيذية (DRAWINGS)</option>
                    <option value="DELIVERY_NOTES">سندات تسليم وإدخال (DELIVERY_NOTES)</option>
                    <option value="BOQ">جداول الكميات (BOQ)</option>
                    <option value="SUBMITTALS">الاعتمادات الفنية (SUBMITTALS)</option>
                    <option value="PHOTOS">صور وإثباتات ميدانية (PHOTOS)</option>
                    {!isEngineer && <option value="INVOICES">الفواتير والماليات (INVOICES)</option>}
                    {!isEngineer && <option value="PURCHASE_ORDERS">أوامر الشراء (PURCHASE_ORDERS)</option>}
                    {!isEngineer && <option value="SUPPLIER_QUOTES">تسعيرات الموردين (SUPPLIER_QUOTES)</option>}
                    <option value="OTHER">ملفات أخرى (OTHER)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    نوع الملف (File Type)
                  </label>
                  <select
                    value={docFileType}
                    onChange={(e) => setDocFileType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:border-[#007A5A] outline-none font-bold text-slate-700 font-mono"
                  >
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="dwg">AutoCAD DWG (.dwg)</option>
                    <option value="xlsx">Excel Sheet (.xlsx)</option>
                    <option value="docx">Word Document (.docx)</option>
                    <option value="zip">Archive ZIP (.zip)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  رابط Google Drive السحابي (Cloud Drive URL) *
                </label>
                <input
                  type="url"
                  required
                  value={docDriveUrl}
                  onChange={(e) => setDocDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:border-[#007A5A] focus:bg-white outline-none font-mono"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    اسم الملف الأصلي
                  </label>
                  <input
                    type="text"
                    value={docFileName}
                    onChange={(e) => setDocFileName(e.target.value)}
                    placeholder="Drawing-01.pdf"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    الحجم التقديري
                  </label>
                  <input
                    type="text"
                    value={docFileSize}
                    onChange={(e) => setDocFileSize(e.target.value)}
                    placeholder="2.4 MB"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    رقم الإصدار (Version)
                  </label>
                  <input
                    type="text"
                    value={docVersion}
                    onChange={(e) => setDocVersion(e.target.value)}
                    placeholder="v1.0"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDocModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#007A5A] hover:bg-[#0c6b4f] text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
                >
                  {editingDoc ? 'حفظ التعديلات' : 'إضافة الوثيقة الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
