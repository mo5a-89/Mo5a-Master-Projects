import { useState } from 'react';
import { ProjectPlanTask } from '../types';

/**
 * تعديل منطق تخطيط المشروع ليبدأ فارغاً ونظيفاً دون توليد تلقائي للأنشطة
 * إيقاف التوليد التلقائي للأنشطة والاعتماد على إدخال المستخدم اليدوي أو عبر زر الاستيراد المخصص
 */
export function useProjectSchedule(initialProjectData?: any) {
  const [tasks, setTasks] = useState<ProjectPlanTask[]>([]);

  const addNewTask = (taskData: Partial<ProjectPlanTask>) => {
    const newTask: ProjectPlanTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      wbsCode: taskData.wbsCode || `1.${tasks.length + 1}`,
      name: taskData.name || 'نشاط جديد',
      assignee: taskData.assignee || 'فريق الموقع',
      durationDays: taskData.durationDays || 10,
      startDate: taskData.startDate || new Date().toISOString().split('T')[0],
      endDate:
        taskData.endDate ||
        new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
      progressPercent: 0,
      status: 'Not Started',
      isMilestone: taskData.isMilestone || false,
      notes: taskData.notes || '',
      ...taskData,
    };
    setTasks((prev) => [...prev, newTask]);
    return newTask;
  };

  const clearSchedule = () => {
    setTasks([]);
  };

  return { tasks, setTasks, addNewTask, clearSchedule };
}
