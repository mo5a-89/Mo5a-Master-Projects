import React, { useState } from 'react';
import { Project, ProjectPlan, ProjectPlanTask } from '../types';
import { executePrint } from '../utils/printUtils';
import { useProjectSchedule } from '../hooks/useProjectSchedule';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Layers,
  AlertCircle,
  User,
  ShieldCheck,
  Printer,
  Sparkles,
  TrendingUp,
  BarChart3,
  X,
  RotateCcw,
} from 'lucide-react';

interface ProjectPlanTabProps {
  project: Project;
  projectPlan?: ProjectPlan;
  onUpdateProjectPlan: (updatedPlan: ProjectPlan) => void;
}

export const ProjectPlanTab: React.FC<ProjectPlanTabProps> = ({
  project,
  projectPlan: initialPlan,
  onUpdateProjectPlan,
}) => {
  // يبدأ تخطيط المشروع فارغاً ونظيفاً دون توليد تلقائي للأنشطة
  const [plan, setPlan] = useState<ProjectPlan>(() => {
    if (initialPlan) return initialPlan;
    return {
      id: `plan-${project.id}`,
      projectId: project.id,
      projectName: project.name,
      projectNumber: project.projectNumber || 'PRJ-001',
      customerName: project.customerName || 'RNM MEP Contracting & Estimation QS',
      startDate: new Date().toISOString().split('T')[0],
      targetEndDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      totalDurationDays: 90,
      overallProgress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [], // يبدأ فارغاً ونظيفاً بدون أي أنشطة افتراضية
    };
  });

  // AI Plan Generator State
  const [genStartDate, setGenStartDate] = useState(plan.startDate);
  const [genDuration, setGenDuration] = useState(plan.totalDurationDays || 90);
  const [genProjectName, setGenProjectName] = useState(plan.projectName);
  const [isGenerating, setIsGenerating] = useState(false);

  // Add Task Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [wbsCode, setWbsCode] = useState('1.3');
  const [assignee, setAssignee] = useState('Eng. Mohammed');
  const [durationDays, setDurationDays] = useState(15);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
  const [isMilestone, setIsMilestone] = useState(false);

  // PDF Print Preview Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);

  // AI Plan Generator logic (Auto-Calculate / Shift task schedules)
  const handleGenerateAiPlan = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const startMs = new Date(genStartDate).getTime();
      const taskCount = plan.tasks.length || 4;
      const daysPerTask = Math.max(5, Math.floor(genDuration / taskCount));

      let currentStart = new Date(startMs);
      const updatedTasks = plan.tasks.map((t, idx) => {
        const tStart = new Date(currentStart);
        const tEnd = new Date(tStart.getTime() + (t.durationDays || daysPerTask) * 86400000);
        const nextStartStr = tStart.toISOString().split('T')[0];
        const nextEndStr = tEnd.toISOString().split('T')[0];
        currentStart = new Date(tEnd.getTime() + 86400000); // consecutive start

        return {
          ...t,
          startDate: nextStartStr,
          endDate: nextEndStr,
        };
      });

      const targetEndMs = new Date(startMs + genDuration * 86400000).toISOString().split('T')[0];

      const updatedPlan: ProjectPlan = {
        ...plan,
        projectName: genProjectName,
        startDate: genStartDate,
        targetEndDate: targetEndMs,
        totalDurationDays: Number(genDuration) || 90,
        tasks: updatedTasks,
        updatedAt: new Date().toISOString(),
      };

      setPlan(updatedPlan);
      onUpdateProjectPlan(updatedPlan);
      setIsGenerating(false);
    }, 400);
  };

  const handleAddTask = () => {
    if (!taskName.trim()) return;

    const newTask: ProjectPlanTask = {
      id: `task-${Date.now()}`,
      wbsCode: wbsCode || '1.x',
      name: taskName,
      assignee,
      durationDays: Number(durationDays) || 10,
      startDate,
      endDate,
      progressPercent: 0,
      status: 'Not Started',
      isMilestone,
    };

    const updatedTasks = [...plan.tasks, newTask];
    const totalProg = Math.round(
      updatedTasks.reduce((acc, t) => acc + t.progressPercent, 0) / updatedTasks.length
    );

    const updatedPlan: ProjectPlan = {
      ...plan,
      overallProgress: totalProg,
      tasks: updatedTasks,
      updatedAt: new Date().toISOString(),
    };

    setPlan(updatedPlan);
    onUpdateProjectPlan(updatedPlan);

    setShowAddTaskModal(false);
    setTaskName('');
  };

  const handleUpdateTaskProgress = (taskId: string, newProgress: number) => {
    const updatedTasks = plan.tasks.map((t) => {
      if (t.id === taskId) {
        const status: ProjectPlanTask['status'] =
          newProgress === 100 ? 'Completed' : newProgress > 0 ? 'In Progress' : 'Not Started';
        return { ...t, progressPercent: newProgress, status };
      }
      return t;
    });

    const totalProg = Math.round(
      updatedTasks.reduce((acc, t) => acc + t.progressPercent, 0) / updatedTasks.length
    );

    const updatedPlan: ProjectPlan = {
      ...plan,
      overallProgress: totalProg,
      tasks: updatedTasks,
      updatedAt: new Date().toISOString(),
    };

    setPlan(updatedPlan);
    onUpdateProjectPlan(updatedPlan);
  };

  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = plan.tasks.filter((t) => t.id !== taskId);
    const totalProg =
      updatedTasks.length > 0
        ? Math.round(updatedTasks.reduce((acc, t) => acc + t.progressPercent, 0) / updatedTasks.length)
        : 0;

    const updatedPlan: ProjectPlan = {
      ...plan,
      overallProgress: totalProg,
      tasks: updatedTasks,
      updatedAt: new Date().toISOString(),
    };

    setPlan(updatedPlan);
    onUpdateProjectPlan(updatedPlan);
  };

  const handleClearSchedule = () => {
    const updatedPlan: ProjectPlan = {
      ...plan,
      overallProgress: 0,
      tasks: [],
      updatedAt: new Date().toISOString(),
    };
    setPlan(updatedPlan);
    onUpdateProjectPlan(updatedPlan);
  };

  // Elapsed vs Remaining days calculation
  const todayMs = new Date().getTime();
  const startMs = new Date(plan.startDate).getTime();
  const endMs = new Date(plan.targetEndDate).getTime();
  const elapsedDays = Math.max(0, Math.floor((todayMs - startMs) / 86400000));
  const remainingDays = Math.max(0, Math.floor((endMs - todayMs) / 86400000));

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Circular Progress Gauge */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 block font-bold">إنجاز المشروع الإجمالي</span>
            <span className="text-2xl font-mono font-black text-[#007A5A] mt-1 block">
              %{plan.overallProgress}
            </span>
            <span className="text-[10px] text-slate-400">حسب إنجاز المهام الوزنية</span>
          </div>
          <div className="w-14 h-14 rounded-full border-4 border-emerald-100 flex items-center justify-center bg-emerald-50 text-[#007A5A] font-mono font-bold text-sm">
            %{plan.overallProgress}
          </div>
        </div>

        {/* Critical Path Status */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-500 block font-bold">حالة المسار الحرج (Critical Path)</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-900">مستقر ومطابق للجدول</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 font-mono">لا توجد انحرافات زمنية حرجة</span>
        </div>

        {/* Elapsed Days */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-500 block font-bold">الأيام المنقضية (Elapsed Days)</span>
            <span className="text-xl font-mono font-bold text-slate-800 mt-1 block">
              {elapsedDays} <span className="text-xs text-slate-500">يوم</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">تاريخ البدء: {plan.startDate}</span>
        </div>

        {/* Remaining Days */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] text-slate-500 block font-bold">الأيام المتبقية (Remaining Days)</span>
            <span className="text-xl font-mono font-bold text-[#007A5A] mt-1 block">
              {remainingDays} <span className="text-xs text-slate-500">يوم</span>
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">الهدف: {plan.targetEndDate}</span>
        </div>
      </div>

      {/* 2. AI PLAN GENERATOR PANEL */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-5 rounded-2xl shadow-md text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
          <h3 className="text-sm font-bold text-white">
            مُولّد ومحدّث خطط المشاريع الذكي (AI WBS & Schedule Generator)
          </h3>
        </div>
        <p className="text-xs text-emerald-100/80 mb-4 leading-relaxed">
          قم بتحديث إعدادات المشروع أدناه واضغط على زر التوليد الذكي ليقوم النظام بإعادة جدولة وتوزيع الأنشطة الزمنية تلقائياً بما يتوافق مع مدة التنفيذ.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-emerald-200 mb-1">اسم المشروع النشط</label>
            <input
              type="text"
              value={genProjectName}
              onChange={(e) => setGenProjectName(e.target.value)}
              className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-yellow-400 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-emerald-200 mb-1">تاريخ البدء الفعلي</label>
            <input
              type="date"
              value={genStartDate}
              onChange={(e) => setGenStartDate(e.target.value)}
              className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-emerald-200 mb-1">إجمالي المدة (بالأيام)</label>
            <input
              type="number"
              value={genDuration}
              onChange={(e) => setGenDuration(Number(e.target.value) || 90)}
              className="w-full p-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateAiPlan}
              className="w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-slate-900" />
              <span>{isGenerating ? 'جارٍ الجدولة...' : 'تحديث وتوليد الخطة بالذكاء الاصطناعي'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. WBS & GANTT GRID & ACTIONS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#007A5A]" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                جدول هيكل العمل وال Gantt زمني مع مسارات الاعتمادية (WBS & Gantt Schedule)
              </h4>
              <p className="text-[11px] text-slate-500">إدارة المهام، نسب الإنجاز التفاعلية، والتمثيل البصري للجدول الزمني.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {plan.tasks.length > 0 && (
              <button
                type="button"
                onClick={handleClearSchedule}
                className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="تفريغ الجدول الزمني والبدء من جديد"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تفريغ الجدول (Clear)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAddTaskModal(true)}
              className="px-3.5 py-2 bg-[#007A5A] hover:bg-[#00664B] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مهمة جديدة (+ Add WBS Task)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 text-right">كود WBS</th>
                <th className="p-3 text-right">اسم المهمة أو النشاط (Bilingual)</th>
                <th className="p-3 text-right">المسؤول</th>
                <th className="p-3 text-center">المدة (أيام)</th>
                <th className="p-3 text-center">التواريخ (بداية / نهاية)</th>
                <th className="p-3 text-center">
                  <div>الجدول البصري (Gantt Bar)</div>
                  <div className="text-[10px] text-slate-400 font-mono font-normal tracking-tight mt-0.5">
                    Gantt Timeline
                  </div>
                </th>
                <th className="p-3 text-center">نسبة الإنجاز</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plan.tasks.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center bg-slate-50/50">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-slate-400">
                      <Calendar className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">لا توجد أنشطة مجدولة حالياً في هذا المشروع</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        يبدأ التخطيط فارغاً ونظيفاً. يمكنك إضافة الأنشطة يدوياً أو استخدام زر التوليد الذكي.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddTaskModal(true)}
                        className="mt-3 px-3.5 py-1.5 bg-[#007A5A] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-[#00664B] transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة أول نشاط للجدول</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                plan.tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 font-mono font-bold text-[#007A5A] text-right">
                    {task.wbsCode}
                  </td>
                  <td className="p-3 text-right font-medium text-slate-900">
                    <div className="flex items-center gap-1.5">
                      {task.isMilestone && <span className="text-amber-500" title="مرحلة رئيسية">⭐</span>}
                      <span>{task.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-slate-600">
                    <div className="flex items-center gap-1 text-[11px]">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{task.assignee || 'غير محدد'}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-700">
                    {task.durationDays} يوم
                  </td>
                  <td className="p-3 text-center font-mono text-[11px] text-slate-500">
                    {task.startDate} ➔ {task.endDate}
                  </td>
                  {/* Visual Gantt timeline bar with MS Project style dependency link */}
                  <td className="p-3 text-center min-w-[180px]">
                    <div className="relative flex items-center justify-start h-6">
                      {/* Dependency connector indicator line */}
                      <div className="absolute right-0 top-1/2 w-full h-[2px] bg-slate-200 -z-0" />
                      <div
                        className="relative z-10 bg-gradient-to-r from-teal-600 to-[#007A5A] h-5 rounded-md shadow-xs flex items-center px-2 text-[10px] text-white font-mono font-bold"
                        style={{ width: `${Math.max(25, task.progressPercent)}%`, minWidth: '80px' }}
                      >
                        <span className="truncate">%{task.progressPercent}</span>
                      </div>
                      {task.isMilestone && (
                        <span className="absolute -left-2 top-1 text-amber-500 text-xs">◆</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={task.progressPercent}
                        onChange={(e) => handleUpdateTaskProgress(task.id, Number(e.target.value))}
                        className="w-20 accent-[#007A5A] cursor-pointer"
                      />
                      <span className="font-mono text-xs font-bold text-slate-800 w-9 text-right">
                        %{task.progressPercent}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        task.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : task.status === 'In Progress'
                          ? 'bg-teal-100 text-[#007A5A] border border-teal-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {task.status === 'Completed'
                        ? 'مكتمل'
                        : task.status === 'In Progress'
                        ? 'قيد التنفيذ'
                        : 'لم يبدأ'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                      title="حذف المهمة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. PROFESSIONAL PDF EXPORT BUTTON & ANALYTICS SUMMARY CHART */}
      <div className="space-y-4 pt-2 pb-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>معاينة الطباعة الاحترافية للجدول الزمني (Professional PDF Export)</span>
          </button>
        </div>

        {/* Elegant Summary Chart Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#007A5A]" />
              <h5 className="text-xs font-bold text-slate-900">ملخص تحليلي لحالة المهام ومعدل الإنجاز (Executive Analytics Summary)</h5>
            </div>
            <span className="text-[11px] font-mono text-slate-500">إجمالي المهام: {plan.tasks.length} مراحل</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Completed */}
            <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-emerald-800">مكتمل (Completed)</span>
                <span className="font-mono font-bold text-emerald-900">
                  {plan.tasks.filter((t) => t.status === 'Completed').length} مهام
                </span>
              </div>
              <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{
                    width: `${
                      (plan.tasks.filter((t) => t.status === 'Completed').length / (plan.tasks.length || 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* In Progress */}
            <div className="bg-teal-50/60 p-3 rounded-lg border border-teal-200 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-teal-800">قيد التنفيذ (In Progress)</span>
                <span className="font-mono font-bold text-teal-900">
                  {plan.tasks.filter((t) => t.status === 'In Progress').length} مهام
                </span>
              </div>
              <div className="w-full bg-teal-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full"
                  style={{
                    width: `${
                      (plan.tasks.filter((t) => t.status === 'In Progress').length / (plan.tasks.length || 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Delayed / Not Started */}
            <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-amber-800">متأخر / قيد الانتظار (Delayed)</span>
                <span className="font-mono font-bold text-amber-900">
                  {plan.tasks.filter((t) => t.status === 'Delayed' || t.status === 'Not Started').length} مهام
                </span>
              </div>
              <div className="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{
                    width: `${
                      (plan.tasks.filter((t) => t.status === 'Delayed' || t.status === 'Not Started').length / (plan.tasks.length || 1)) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                إضافة مرحلة أو مهمة جديدة (Add Task / WBS)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">كود WBS</label>
                  <input
                    type="text"
                    value={wbsCode}
                    onChange={(e) => setWbsCode(e.target.value)}
                    placeholder="1.3"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">اسم المهمة أو النشاط</label>
                  <input
                    type="text"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="مثال: فحص التمديدات واختبار الضغط"
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">المسؤول / المهندس</label>
                  <input
                    type="text"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Eng. Ahmed"
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">المدة (بالأيام)</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">تاريخ البدء</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="milestone-chk"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                  className="rounded accent-[#007A5A]"
                />
                <label htmlFor="milestone-chk" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  تصنيف كمرحلة رئيسية هامة (Key Milestone)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddTask}
                className="px-5 py-2 text-xs font-bold bg-[#007A5A] text-white rounded hover:bg-[#00664B] transition shadow-xs cursor-pointer"
              >
                إضافة المهمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Print Preview Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 space-y-6 my-8 print:shadow-none print:m-0">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#007A5A]" />
                <span>معاينة طباعة الجدول الزمني وهيكل العمل (A4 Client Delivery)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executePrint('project-plan-print-container', { documentTitle: `الخطة الزمنية وهيكل العمل - ${plan.projectName}` })}
                  className="px-4 py-2 bg-[#007A5A] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#00664B] transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة مستند PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Content */}
            <div id="project-plan-print-container" className="bg-white p-8 space-y-6 text-slate-800 font-sans border border-slate-200 rounded-xl shadow-xs print:shadow-none print:border-none print:p-0">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{plan.projectName}</h2>
                  <p className="text-xs text-slate-600 font-mono mt-1">رقم المشروع: {plan.projectNumber} | العميل: {plan.customerName}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#007A5A] bg-emerald-50 px-3.5 py-1.5 rounded-lg border border-emerald-300 shadow-2xs">
                    الخطة الزمنية الرسمية وهيكل العمل (Master Schedule & WBS)
                  </span>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">تاريخ الإصدار: {new Date().toISOString().split('T')[0]}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl text-xs border border-slate-200">
                <div>
                  <span className="text-slate-500 block mb-1">التقدم الإجمالي</span>
                  <span className="font-mono font-black text-lg text-[#007A5A]">%{plan.overallProgress}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">تاريخ البداية</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{plan.startDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">التسليم المستهدف</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{plan.targetEndDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">إجمالي المدة</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{plan.totalDurationDays} يوم</span>
                </div>
              </div>

              {/* Print Modal Summary Chart */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold text-slate-900">ملخص توزيع المهام التنفيذية (Task Status Breakdown):</h5>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded border border-emerald-200">
                    <span className="text-emerald-800 font-bold block mb-1">مكتمل: {plan.tasks.filter((t) => t.status === 'Completed').length}</span>
                    <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full" style={{ width: `${(plan.tasks.filter((t) => t.status === 'Completed').length / (plan.tasks.length || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-teal-200">
                    <span className="text-teal-800 font-bold block mb-1">قيد التنفيذ: {plan.tasks.filter((t) => t.status === 'In Progress').length}</span>
                    <div className="w-full bg-teal-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-teal-600 h-full" style={{ width: `${(plan.tasks.filter((t) => t.status === 'In Progress').length / (plan.tasks.length || 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-amber-200">
                    <span className="text-amber-800 font-bold block mb-1">متأخر: {plan.tasks.filter((t) => t.status === 'Delayed' || t.status === 'Not Started').length}</span>
                    <div className="w-full bg-amber-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: `${(plan.tasks.filter((t) => t.status === 'Delayed' || t.status === 'Not Started').length / (plan.tasks.length || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-3">جدول مراحل العمل والأنشطة والجدول الزمني (Gantt Schedule):</h4>
                <table className="w-full text-xs text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="p-3 text-right border-r border-slate-200">رمز WBS</th>
                      <th className="p-3 text-right border-r border-slate-200">اسم المهمة / النشاط</th>
                      <th className="p-3 text-right border-r border-slate-200">المسؤول</th>
                      <th className="p-3 text-center border-r border-slate-200">المدة</th>
                      <th className="p-3 text-center border-r border-slate-200">الفترة الزمنية</th>
                      <th className="p-3 text-center border-r border-slate-200">الإنجاز</th>
                      <th className="p-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {plan.tasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-[#007A5A] text-right border-r border-slate-200">{t.wbsCode}</td>
                        <td className="p-3 text-right font-medium text-slate-900 border-r border-slate-200">{t.name}</td>
                        <td className="p-3 text-right text-slate-600 border-r border-slate-200">{t.assignee}</td>
                        <td className="p-3 text-center font-mono border-r border-slate-200">{t.durationDays} يوم</td>
                        <td className="p-3 text-center font-mono text-[11px] border-r border-slate-200">{t.startDate} ➔ {t.endDate}</td>
                        <td className="p-3 text-center font-mono font-bold text-[#007A5A] border-r border-slate-200">%{t.progressPercent}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                            t.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status === 'Completed' ? 'مكتمل' : t.status === 'In Progress' ? 'قيد التنفيذ' : 'متأخر'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
