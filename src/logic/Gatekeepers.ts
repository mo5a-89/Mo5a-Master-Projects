// 1. حارس سندات التسليم (Delivery Note Gatekeeper)
export const validateDeliveryNoteSubmission = (
  newDnItems: Array<{ poItemId: string; deliveredQty: number }>,
  targetPo: any,
  existingDeliveryNotes: any[]
): { isValid: boolean; errorMessage?: string } => {
  if (!targetPo || !targetPo.items) {
    return { isValid: true };
  }
  for (const item of newDnItems) {
    const poItem = targetPo.items.find((i: any) => i.id === item.poItemId);
    if (!poItem) {
      return { isValid: false, errorMessage: `البند غير مسجل في أمر الشراء.` };
    }

    // حساب مجموع الكميات المسلمة سابقاً لنفس البند
    const alreadyDelivered = (existingDeliveryNotes || [])
      .filter(dn => dn.poNumber === targetPo.poNumber || dn.projectId === targetPo.projectId)
      .flatMap(dn => dn.items || [])
      .filter((i: any) => (i.sourceItemId || i.poItemId) === item.poItemId)
      .reduce((sum, i) => sum + (Number(i.deliveredQty || i.quantity) || 0), 0);

    const cumulativeQty = alreadyDelivered + Number(item.deliveredQty);

    if (cumulativeQty > poItem.quantity) {
      return {
        isValid: false,
        errorMessage: `مخالفة تشغيلية: الكمية الإجمالية المسلمة (${cumulativeQty}) تتجاوز كمية التعميد المعتمدة (${poItem.quantity}) للبند: ${poItem.description}`
      };
    }
  }
  return { isValid: true };
};

// 2. حارس الفواتير الضريبية والمستخلصات (Invoicing Gatekeeper)
export const validateInvoiceSubmission = (
  newInvoiceItems: Array<{ sourceItemId: string; quantity: number; unitPrice: number }>,
  clientPo: any,
  existingInvoices: any[]
): { isValid: boolean; errorMessage?: string } => {
  if (!clientPo || !clientPo.items) {
    return { isValid: true };
  }
  for (const invItem of newInvoiceItems) {
    const contractItem = clientPo.items.find((i: any) => i.id === invItem.sourceItemId);
    
    // حساب الكميات المفوترة مسبقاً لهذا البند
    const alreadyInvoicedQty = (existingInvoices || [])
      .filter(inv => inv.projectId === clientPo.projectId)
      .flatMap(inv => inv.items || [])
      .filter((i: any) => (i.sourceItemId || i.id) === invItem.sourceItemId)
      .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

    const cumulativeInvoicedQty = alreadyInvoicedQty + Number(invItem.quantity);

    if (contractItem && cumulativeInvoicedQty > contractItem.quantity) {
      return {
        isValid: false,
        errorMessage: `خطأ فوترة: الكمية المفوترة تراكمياً (${cumulativeInvoicedQty}) تتجاوز تعميد العميل الأصلي (${contractItem.quantity}). تم حظر إصدار الفاتورة المزدوجة.`
      };
    }
  }
  return { isValid: true };
};
