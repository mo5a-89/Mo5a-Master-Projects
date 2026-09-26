import {
  Invoice,
  Project,
  PurchaseOrder,
  NotificationItem,
  ProjectPlan,
} from '../types';

export function generateSmartNotifications(params: {
  projects: Project[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  projectPlans?: ProjectPlan[];
}): NotificationItem[] {
  const { projects = [], invoices = [], purchaseOrders = [], projectPlans = [] } = params;
  const notifications: NotificationItem[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Invoicing & Financial Milestones Engine
  invoices.forEach((inv) => {
    const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.grandTotal - (inv.paidAmount || 0));
    if (remaining > 0) {
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
      if (dueDate) {
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          // Overdue invoice
          notifications.push({
            id: `notif-inv-overdue-${inv.id}`,
            title: `فاتورة مستحقة متأخرة التحصيل: ${inv.invoiceNumber}`,
            titleEn: `Overdue Invoice Collection: ${inv.invoiceNumber}`,
            message: `تجاوزت الفاتورة موعد استحقاقها بمقدار ${Math.abs(diffDays)} يوم لمشروع "${inv.projectName}". المبلغ المتبقي: ${remaining.toLocaleString()} SAR.`,
            category: 'invoices',
            severity: 'critical',
            timestamp: inv.dueDate || todayStr,
            isRead: false,
            targetTab: 'invoices',
            targetId: inv.id,
            metadata: {
              amount: remaining,
              daysOverdue: Math.abs(diffDays),
              clientName: inv.customerName,
              projectName: inv.projectName,
            },
          });
        } else if (diffDays <= 7) {
          // Due soon
          notifications.push({
            id: `notif-inv-due-soon-${inv.id}`,
            title: `استحقاق تحصيل قريب: ${inv.invoiceNumber}`,
            titleEn: `Upcoming Invoice Due Date: ${inv.invoiceNumber}`,
            message: `تستحق الفاتورة خلال ${diffDays} أيام للعميل "${inv.customerName}". القيمة المستحقة: ${remaining.toLocaleString()} SAR.`,
            category: 'invoices',
            severity: 'warning',
            timestamp: inv.dueDate || todayStr,
            isRead: false,
            targetTab: 'invoices',
            targetId: inv.id,
            metadata: {
              amount: remaining,
              clientName: inv.customerName,
              projectName: inv.projectName,
            },
          });
        }
      }
    }
  });

  // 2. Project Delivery Deadlines & Milestones Engine
  projects.forEach((proj) => {
    if (proj.status === 'Won' && proj.targetCompletionDate) {
      const targetDate = new Date(proj.targetCompletionDate);
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const completion = proj.completionPercentage || 0;

      if (diffDays < 0 && completion < 100) {
        // Project Delivery Overdue
        notifications.push({
          id: `notif-proj-overdue-${proj.id}`,
          title: `تجاوز الموعد النهائي للمشروع: ${proj.name}`,
          titleEn: `Project Target Date Passed: ${proj.projectNumber}`,
          message: `المشروع متأخر عن موعد التسليم المستهدف بمقدار ${Math.abs(diffDays)} يوم، نسبة الإنجاز الحالية: ${completion}%.`,
          category: 'milestones',
          severity: 'critical',
          timestamp: proj.targetCompletionDate,
          isRead: false,
          targetTab: 'projects',
          targetId: proj.id,
          metadata: {
            projectName: proj.name,
            clientName: proj.customerName,
            daysOverdue: Math.abs(diffDays),
          },
        });
      } else if (diffDays <= 14 && diffDays >= 0 && completion < 85) {
        // Project Deadline Approaching
        notifications.push({
          id: `notif-proj-approaching-${proj.id}`,
          title: `اقتراب موعد تسليم المشروع: ${proj.name}`,
          titleEn: `Project Milestone Deadline Approaching`,
          message: `متبقي ${diffDays} يوم للوصول للتسليم النهائي لمشروع "${proj.name}" والنسبة المحققة ${completion}%.`,
          category: 'milestones',
          severity: 'warning',
          timestamp: proj.targetCompletionDate,
          isRead: false,
          targetTab: 'projects',
          targetId: proj.id,
          metadata: {
            projectName: proj.name,
            clientName: proj.customerName,
          },
        });
      }
    }
  });

  // 3. Purchase Orders (PO) Release & Material Delivery Schedules Engine
  purchaseOrders.forEach((po) => {
    const isDelivered = po.deliveryStatus === 'Delivered' || po.fulfillmentStatus === 'Fully Received';
    const isPartial = po.deliveryStatus === 'Partial Delivered' || po.fulfillmentStatus === 'In Delivery / Partial';
    const deliveryDateStr = po.expectedDeliveryDate || po.deliveryDate;
    const vendorDisplayName = po.vendorName || po.supplierName || 'المورد';

    if (!isDelivered && deliveryDateStr) {
      const expDate = new Date(deliveryDateStr);
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // Material delivery delayed
        notifications.push({
          id: `notif-po-delayed-${po.id}`,
          title: `تأخر توريد أمر الشراء: ${po.poNumber}`,
          titleEn: `Material Delivery Overdue: ${po.poNumber}`,
          message: `تأخر المورد "${vendorDisplayName}" عن موعد توريد المواد بالموقع المحدد له منذ ${Math.abs(diffDays)} يوم. قيمة الأمر: ${po.grandTotal?.toLocaleString()} SAR.`,
          category: 'procurement',
          severity: 'critical',
          timestamp: deliveryDateStr,
          isRead: false,
          targetTab: 'purchase_orders',
          targetId: po.id,
          metadata: {
            amount: po.grandTotal,
            supplierName: vendorDisplayName,
            projectName: po.projectName,
            daysOverdue: Math.abs(diffDays),
          },
        });
      } else if (diffDays <= 3) {
        // Material delivery due in 3 days
        notifications.push({
          id: `notif-po-upcoming-${po.id}`,
          title: `موعد استلام توريد قريب: ${po.poNumber}`,
          titleEn: `Upcoming Material Delivery Schedule: ${po.poNumber}`,
          message: `مجدول وصول الشحنة من المورد "${vendorDisplayName}" خلال ${diffDays} أيام لموقع مشروع "${po.projectName}".`,
          category: 'procurement',
          severity: 'info',
          timestamp: deliveryDateStr,
          isRead: false,
          targetTab: 'purchase_orders',
          targetId: po.id,
          metadata: {
            amount: po.grandTotal,
            supplierName: vendorDisplayName,
            projectName: po.projectName,
          },
        });
      }
    }

    if (isPartial) {
      notifications.push({
        id: `notif-po-partial-${po.id}`,
        title: `أمر شراء بتوريد جزئي معلق: ${po.poNumber}`,
        titleEn: `Partial Material Delivery Pending: ${po.poNumber}`,
        message: `تم توريد جزء من المواد من المورد "${vendorDisplayName}" وبانتظار استكمال باقي البنود بالموقع.`,
        category: 'procurement',
        severity: 'warning',
        timestamp: po.updatedAt || todayStr,
        isRead: false,
        targetTab: 'purchase_orders',
        targetId: po.id,
        metadata: {
          supplierName: vendorDisplayName,
          projectName: po.projectName,
        },
      });
    }
  });

  // Sort by severity (critical first) then newest timestamp
  const severityScore = {
    critical: 4,
    warning: 3,
    info: 2,
    success: 1,
  };

  return notifications.sort((a, b) => {
    const scoreDiff = severityScore[b.severity] - severityScore[a.severity];
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}
