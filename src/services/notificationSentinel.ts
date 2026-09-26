import {
  Invoice,
  Project,
  PurchaseOrder,
  DeliveryNote,
  NotificationItem,
  NotificationCategory,
} from '../types';

export const NOTIFICATION_READ_STORAGE_KEY = 'rmt_notifications_read_keys';

/**
 * Reads the list of persistent read notification IDs from LocalStorage
 */
export function getReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * Persists read notification IDs to LocalStorage
 */
export function saveReadNotificationIds(ids: Set<string> | string[]): void {
  try {
    const arr = Array.isArray(ids) ? ids : Array.from(ids);
    localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to save read notifications state:', e);
  }
}

export interface SentinelParams {
  projects: Project[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
  deliveryNotes?: DeliveryNote[];
}

/**
 * State-reactive Notification Sentinel Engine
 * Generates high-fidelity, real-time alerts across Finance, Logistics, and Projects
 */
export function generateSentinelNotifications(params: SentinelParams): NotificationItem[] {
  const {
    projects = [],
    invoices = [],
    purchaseOrders = [],
    deliveryNotes = [],
  } = params;

  const notifications: NotificationItem[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const readIds = getReadNotificationIds();

  // =========================================================================
  // 1. FINANCE SENTINEL: Overdue & Approaching Invoices + Unbilled DNs
  // =========================================================================
  invoices.forEach((inv) => {
    // Exclude soft-deleted or fully paid
    if (inv.deletedAt) return;
    const isPaid = inv.status === 'Paid' || (inv.paidAmount !== undefined && inv.paidAmount >= inv.grandTotal);
    const remaining =
      inv.remainingAmount !== undefined
        ? inv.remainingAmount
        : Math.max(0, inv.grandTotal - (inv.paidAmount || 0));

    if (!isPaid && remaining > 0 && inv.dueDate) {
      const dueDate = new Date(inv.dueDate);
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // High-Priority Alert: Overdue Invoice
        const daysOver = Math.abs(diffDays);
        notifications.push({
          id: `sentinel-inv-overdue-${inv.id}`,
          title: `فاتورة مستحقة متأخرة التحصيل: ${inv.invoiceNumber}`,
          titleEn: `Overdue Invoice Collection: ${inv.invoiceNumber}`,
          message: `تجاوزت الفاتورة موعد استحقاقها بمقدار ${daysOver} يوم لمشروع "${inv.projectName}". المتبقي: ${remaining.toLocaleString()} ر.س.`,
          messageEn: `Invoice ${inv.invoiceNumber} is overdue by ${daysOver} days for "${inv.projectName}". Remaining: SAR ${remaining.toLocaleString()}.`,
          category: 'finance',
          severity: 'critical',
          timestamp: inv.dueDate || todayStr,
          isRead: readIds.has(`sentinel-inv-overdue-${inv.id}`),
          targetTab: 'invoices',
          targetId: inv.id,
          metadata: {
            amount: remaining,
            daysOverdue: daysOver,
            clientName: inv.customerName,
            projectName: inv.projectName,
            invoiceNumber: inv.invoiceNumber,
          },
        });
      } else if (diffDays <= 7) {
        // Warning Alert: Approaching Invoice Due Date within 7 days
        notifications.push({
          id: `sentinel-inv-approaching-${inv.id}`,
          title: `استحقاق تحصيل وشيك: ${inv.invoiceNumber}`,
          titleEn: `Upcoming Invoice Due Date: ${inv.invoiceNumber}`,
          message: `تستحق الفاتورة خلال ${diffDays} أيام للعميل "${inv.customerName}". القيمة المستحقة: ${remaining.toLocaleString()} ر.س.`,
          messageEn: `Invoice ${inv.invoiceNumber} is due in ${diffDays} days for client "${inv.customerName}". Amount: SAR ${remaining.toLocaleString()}.`,
          category: 'finance',
          severity: 'warning',
          timestamp: inv.dueDate || todayStr,
          isRead: readIds.has(`sentinel-inv-approaching-${inv.id}`),
          targetTab: 'invoices',
          targetId: inv.id,
          metadata: {
            amount: remaining,
            clientName: inv.customerName,
            projectName: inv.projectName,
            invoiceNumber: inv.invoiceNumber,
          },
        });
      }
    }
  });

  // =========================================================================
  // 2. LOGISTICS SENTINEL: Material Deliveries, Stock & Unbilled Delivery Notes
  // =========================================================================
  // A. Pending PO Deliveries (deliveryDate <= today + 5 days)
  purchaseOrders.forEach((po) => {
    if (po.deletedAt) return;
    const isDelivered =
      po.deliveryStatus === 'Delivered' || po.fulfillmentStatus === 'Fully Received';
    const isPartial =
      po.deliveryStatus === 'Partial Delivered' || po.fulfillmentStatus === 'In Delivery / Partial';
    const deliveryDateStr = po.expectedDeliveryDate || po.deliveryDate;
    const vendorDisplayName = po.vendorName || po.supplierName || 'المورد';

    if (!isDelivered && deliveryDateStr) {
      const expDate = new Date(deliveryDateStr);
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        // Delayed PO Delivery
        const daysOver = Math.abs(diffDays);
        notifications.push({
          id: `sentinel-po-delayed-${po.id}`,
          title: `تأخر توريد مواد أمر الشراء: ${po.poNumber}`,
          titleEn: `Delayed Material Delivery: ${po.poNumber}`,
          message: `تأخر المورد "${vendorDisplayName}" عن موعد التوريد المعتمد بمقدار ${daysOver} يوم لمشروع "${po.projectName}".`,
          messageEn: `Supplier "${vendorDisplayName}" is ${daysOver} days late on PO ${po.poNumber} for project "${po.projectName}".`,
          category: 'logistics',
          severity: 'critical',
          timestamp: deliveryDateStr,
          isRead: readIds.has(`sentinel-po-delayed-${po.id}`),
          targetTab: 'purchase_orders',
          targetId: po.id,
          metadata: {
            amount: po.grandTotal,
            supplierName: vendorDisplayName,
            projectName: po.projectName,
            poNumber: po.poNumber,
            daysOverdue: daysOver,
          },
        });
      } else if (diffDays <= 5) {
        // Approaching Delivery within 5 days
        notifications.push({
          id: `sentinel-po-approaching-${po.id}`,
          title: `موعد توريد مواد قريب: ${po.poNumber}`,
          titleEn: `Upcoming Material Arrival: ${po.poNumber}`,
          message: `مجدول وصول شحنة التوريد من المورد "${vendorDisplayName}" خلال ${diffDays} أيام لموقع مشروع "${po.projectName}".`,
          messageEn: `Material arrival scheduled in ${diffDays} days from "${vendorDisplayName}" for project "${po.projectName}".`,
          category: 'logistics',
          severity: 'info',
          timestamp: deliveryDateStr,
          isRead: readIds.has(`sentinel-po-approaching-${po.id}`),
          targetTab: 'purchase_orders',
          targetId: po.id,
          metadata: {
            amount: po.grandTotal,
            supplierName: vendorDisplayName,
            projectName: po.projectName,
            poNumber: po.poNumber,
          },
        });
      }
    }

    if (isPartial) {
      notifications.push({
        id: `sentinel-po-partial-${po.id}`,
        title: `توريد جزئي معلق: ${po.poNumber}`,
        titleEn: `Pending Partial PO Receipt: ${po.poNumber}`,
        message: `تم استلام جزء من بضاعة المورد "${vendorDisplayName}" وبانتظار استكمال باقي البنود المتبقية بالموقع.`,
        messageEn: `Partial shipment received from "${vendorDisplayName}". Awaiting remaining line items.`,
        category: 'logistics',
        severity: 'warning',
        timestamp: po.updatedAt || todayStr,
        isRead: readIds.has(`sentinel-po-partial-${po.id}`),
        targetTab: 'purchase_orders',
        targetId: po.id,
        metadata: {
          supplierName: vendorDisplayName,
          projectName: po.projectName,
          poNumber: po.poNumber,
        },
      });
    }
  });

  // B. Client Delivery Notes Delivered but NOT yet Invoiced (Unbilled DNs)
  deliveryNotes.forEach((dn) => {
    if (dn.deletedAt) return;
    const isDelivered = dn.status === 'Delivered' || dn.status === 'Partial Delivered';
    const isUninvoiced = dn.invoicedStatus === 'Uninvoiced' || !dn.invoicedStatus;

    if (isDelivered && isUninvoiced) {
      notifications.push({
        id: `sentinel-dn-uninvoiced-${dn.id}`,
        title: `سند تسليم مسلم غير مفوتر: ${dn.dnNumber}`,
        titleEn: `Unbilled Client Delivery Note: ${dn.dnNumber}`,
        message: `تم تسليم المواد بموجب السند ${dn.dnNumber} لمشروع "${dn.projectName}" ولم يتم إصدار فاتورة ضريبية للعميل حتى الآن.`,
        messageEn: `Delivery Note ${dn.dnNumber} is marked Delivered for "${dn.projectName}" but has not been invoiced yet.`,
        category: 'logistics',
        severity: 'warning',
        timestamp: dn.date || todayStr,
        isRead: readIds.has(`sentinel-dn-uninvoiced-${dn.id}`),
        targetTab: 'site_logistics',
        targetId: dn.id,
        metadata: {
          clientName: dn.customerName,
          projectName: dn.projectName,
          dnNumber: dn.dnNumber,
        },
      });
    }
  });

  // =========================================================================
  // 3. PROJECTS & MILESTONES SENTINEL: 30-Day Completion & Defect Liability (DLP)
  // =========================================================================
  projects.forEach((proj) => {
    const isWonOrActive =
      proj.status === 'Won' ||
      proj.status === 'Awarded' ||
      proj.status === 'In Progress' ||
      proj.status === 'in_progress';

    // A. Milestones & Delivery: Within 30 days while execution is below 80%
    const targetDateStr = proj.targetCompletionDate || proj.targetEndDate || proj.completionDate;
    if (isWonOrActive && targetDateStr) {
      const targetDate = new Date(targetDateStr);
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const completion = proj.completionPercentage || 0;

      if (diffDays < 0 && completion < 100) {
        // Project completion overdue
        const daysOver = Math.abs(diffDays);
        notifications.push({
          id: `sentinel-proj-overdue-${proj.id}`,
          title: `تأخر موعد تسليم المشروع: ${proj.name}`,
          titleEn: `Project Milestone Overdue: ${proj.projectNumber}`,
          message: `تجاوز المشروع موعد التسليم المستهدف منذ ${daysOver} يوم، ونسبة الإنجاز الحالية: ${completion}%.`,
          messageEn: `Project is ${daysOver} days past target completion date with only ${completion}% execution.`,
          category: 'projects',
          severity: 'critical',
          timestamp: targetDateStr,
          isRead: readIds.has(`sentinel-proj-overdue-${proj.id}`),
          targetTab: 'projects',
          targetId: proj.id,
          metadata: {
            projectName: proj.name,
            clientName: proj.customerName,
            completionPercentage: completion,
            daysOverdue: daysOver,
          },
        });
      } else if (diffDays <= 30 && diffDays >= 0 && completion < 80) {
        // Within 30 days while execution is below 80%
        notifications.push({
          id: `sentinel-proj-risk-30d-${proj.id}`,
          title: `تنبيه مخاطر الإنجاز (أقل من 30 يوماً): ${proj.name}`,
          titleEn: `Project Milestone Execution Risk (<30 Days): ${proj.projectNumber}`,
          message: `متبقي ${diffDays} يوم فقط على موعد التسليم النهائي للمشروع ونسبة الإنجاز ${completion}% (أقل من الحد الآمن 80%).`,
          messageEn: `Target completion in ${diffDays} days while progress is only ${completion}% (under 80% threshold).`,
          category: 'projects',
          severity: 'warning',
          timestamp: targetDateStr,
          isRead: readIds.has(`sentinel-proj-risk-30d-${proj.id}`),
          targetTab: 'projects',
          targetId: proj.id,
          metadata: {
            projectName: proj.name,
            clientName: proj.customerName,
            completionPercentage: completion,
          },
        });
      }
    }

    // B. Defect Liability Period (DLP) & Retention Money Release
    // If project is completed (or execution is 100%) and retention is held
    const isCompleted =
      proj.status === 'Completed' ||
      proj.executionStatus === 'تام' ||
      (proj.completionPercentage || 0) >= 100;
    const hasRetention = (proj.retentionAmount || 0) > 0 || (proj.retentionPercent || 0) > 0;
    const retentionStatus = proj.retentionStatus || 'Held';

    if (isCompleted && hasRetention && retentionStatus !== 'Released') {
      const completionDate = proj.completionDate ? new Date(proj.completionDate) : null;
      if (completionDate) {
        // DLP is typically 365 days from completion date
        const dlpEndDate = new Date(completionDate);
        dlpEndDate.setDate(dlpEndDate.getDate() + 365);
        const diffDlpTime = dlpEndDate.getTime() - now.getTime();
        const diffDlpDays = Math.ceil(diffDlpTime / (1000 * 60 * 60 * 24));

        const retentionSAR =
          proj.retentionAmount ||
          ((proj.contractValue || proj.budget || 0) * (proj.retentionPercent || 10)) / 100;

        if (diffDlpDays <= 30 && diffDlpDays >= 0) {
          // DLP Ending Soon: Release Retention Money
          notifications.push({
            id: `sentinel-dlp-release-soon-${proj.id}`,
            title: `استحقاق الإفراج عن محجوز الضمان (DLP): ${proj.name}`,
            titleEn: `DLP Expiration & Retention Release: ${proj.name}`,
            message: `تقترب فترة الصيانة والضمان (DLP) من الانتهاء خلال ${diffDlpDays} يوم. يرجى التنسيق لتحصيل محجوز الضمان بقيمة ${retentionSAR.toLocaleString()} ر.س.`,
            messageEn: `Defect Liability Period (DLP) expires in ${diffDlpDays} days. Prepare to collect retention of SAR ${retentionSAR.toLocaleString()}.`,
            category: 'projects',
            severity: 'info',
            timestamp: dlpEndDate.toISOString().split('T')[0],
            isRead: readIds.has(`sentinel-dlp-release-soon-${proj.id}`),
            targetTab: 'projects',
            targetId: proj.id,
            metadata: {
              projectName: proj.name,
              clientName: proj.customerName,
              retentionAmount: retentionSAR,
            },
          });
        } else if (diffDlpDays < 0 && retentionStatus === 'Held') {
          // DLP Expired - Action Required
          notifications.push({
            id: `sentinel-dlp-due-now-${proj.id}`,
            title: `انتهاء فترة الضمان ومستحق إفراج محجوز الضمان: ${proj.name}`,
            titleEn: `DLP Expired - Retention Release Due: ${proj.name}`,
            message: `انتهت فترة الضمان والصيانة لمشروع "${proj.name}". محجوز الضمان مستحق الإفراج فوراً بقيمة ${retentionSAR.toLocaleString()} ر.س.`,
            messageEn: `DLP has expired for "${proj.name}". Retention of SAR ${retentionSAR.toLocaleString()} is immediately due for release.`,
            category: 'finance',
            severity: 'warning',
            timestamp: todayStr,
            isRead: readIds.has(`sentinel-dlp-due-now-${proj.id}`),
            targetTab: 'projects',
            targetId: proj.id,
            metadata: {
              projectName: proj.name,
              clientName: proj.customerName,
              retentionAmount: retentionSAR,
            },
          });
        }
      }
    }
  });

  // Sort: Critical (4) > Warning (3) > Info (2) > Success (1), then newest timestamp
  const severityScore: Record<string, number> = {
    critical: 4,
    warning: 3,
    info: 2,
    success: 1,
  };

  return notifications.sort((a, b) => {
    const scoreDiff = (severityScore[b.severity] || 0) - (severityScore[a.severity] || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

/**
 * Filter notifications by unified category tabs:
 * 'all' | 'finance' | 'logistics' | 'projects'
 */
export function filterNotificationsByCategory(
  notifications: NotificationItem[],
  categoryFilter: 'all' | 'finance' | 'logistics' | 'projects'
): NotificationItem[] {
  if (categoryFilter === 'all') return notifications;
  return notifications.filter((notif) => {
    if (categoryFilter === 'finance') {
      return notif.category === 'finance' || notif.category === 'invoices';
    }
    if (categoryFilter === 'logistics') {
      return notif.category === 'logistics' || notif.category === 'procurement';
    }
    if (categoryFilter === 'projects') {
      return notif.category === 'projects' || notif.category === 'milestones';
    }
    return notif.category === categoryFilter;
  });
}
