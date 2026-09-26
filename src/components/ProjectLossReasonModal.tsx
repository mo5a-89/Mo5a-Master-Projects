import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { COMMON_LOSS_REASONS } from '../utils/projectStatusUtils';
import { X, AlertCircle, Save, ThumbsDown } from 'lucide-react';

interface ProjectLossReasonModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (projectId: string, reason: string) => void;
}

export const ProjectLossReasonModal: React.FC<ProjectLossReasonModalProps> = ({
  isOpen,
  project,
  onClose,
  onSave,
}) => {
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (project) {
      setReason(project.lossReason || '');
    }
  }, [project]);

  if (!isOpen || !project) return null;

  const handleSelectQuickReason = (quickReason: string) => {
    if (reason.trim()) {
      setReason(`${reason} - ${quickReason}`);
    } else {
      setReason(quickReason);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(project.id, reason.trim());
    onClose();
  };

  return (
    <div
      id="project-loss-reason-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
              <ThumbsDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                تسجيل سبب خسارة المشروع (Loss Reason)
              </h3>
              <p className="text-xs text-slate-500">
                مشروع: <span className="font-semibold text-slate-800">{project.name}</span> ({project.projectNumber})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="bg-red-50/70 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">سيتم تحديد حالة المشروع إلى "خسرته (Lost)"</p>
              <p className="text-red-700/90 text-[11px] mt-0.5">
                تساعد معرفة أسباب الخسارة في تحليل المنافسة وتطوير سياسات التسعير مستقبلاً.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              خيارات سريعة لسبب الخسارة:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_LOSS_REASONS.map((r, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectQuickReason(r)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-200 transition cursor-pointer text-slate-700 text-right"
                >
                  + {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اكتب تفاصيل سبب خسارة المشروع بالتفصيل: *
            </label>
            <textarea
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: كان سعرنا أعلى بنسبة 12% من المنافس، والعميل طلب تخفيض إضافي لم نتمكن من تلبيته بسبب تكلفة المواد..."
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none leading-relaxed text-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              إلغاء (Cancel)
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ وتحديث الحالة (Save & Set Lost)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
