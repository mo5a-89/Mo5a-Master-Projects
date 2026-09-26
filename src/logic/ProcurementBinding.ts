export const bindSupplierQuotationToPO = (
  selectedSupplierQuote: any,
  suppliersDirectory: any[],
  userEnteredPoData: any
) => {
  // مطابقة المورد الدقيقة بناءً على عرض السعر
  const matchedSupplier = (suppliersDirectory || []).find(
    s => s.id === selectedSupplierQuote.supplierId || s.name === selectedSupplierQuote.supplierName || s.nameAr === selectedSupplierQuote.supplierName
  );

  return {
    ...userEnteredPoData,
    quotationRef: selectedSupplierQuote.quotationNumber || selectedSupplierQuote.quoteNumber || '',
    // إقفال هوية المورد ومنع التغيير اليدوي العشوائي
    vendorName: selectedSupplierQuote.supplierName || matchedSupplier?.name || userEnteredPoData.vendorName || '',
    vendorVatNo: matchedSupplier ? (matchedSupplier.vatNo || matchedSupplier.vatNumber || '') : (selectedSupplierQuote.vatNo || selectedSupplierQuote.vatNumber || userEnteredPoData.vendorVatNo || ''),
    projectId: selectedSupplierQuote.projectId || userEnteredPoData.projectId || '',
    items: (selectedSupplierQuote.items || []).map((item: any, idx: number) => ({
      id: item.id || `po-it-${Date.now()}-${item.itemNo || idx + 1}`,
      itemNo: item.itemNo || idx + 1,
      description: item.description || '',
      quantity: item.quantity || 0,
      unit: item.unit || 'EA',
      unitPrice: item.supplierUnitPrice ?? item.unitPrice ?? 0,
      totalPrice: item.supplierTotalPrice ?? item.totalPrice ?? ((item.quantity || 0) * (item.supplierUnitPrice ?? item.unitPrice ?? 0)),
      deliveryStatus: 'Pending'
    }))
  };
};
