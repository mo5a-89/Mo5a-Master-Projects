import { PurchaseOrder, PurchaseOrderItem } from '../types';
import { COMPANY_PROFILE } from '../data/initialData';
import * as docx from 'docx';
import * as XLSX from 'xlsx';

/**
 * Exports the Purchase Order to an authentic Microsoft Word (.docx) document
 * with exact RMT company header, PO metadata, BOQ items table, financial totals,
 * payment & delivery terms, scope inclusions/exclusions, and executive signatures.
 */
export async function exportPurchaseOrderToWord(po: PurchaseOrder): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    HeadingLevel,
  } = docx;

  const navyBlue = '1E3A8A';
  const tealGreen = '007A5A';
  const slateGray = '475569';
  const lightBg = 'F8FAFC';
  const headerBg = '1E3A8A'; // Navy background for PO header
  const tableHeaderBg = 'F1F5F9';
  const borderGray = 'CBD5E1';

  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
    left: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
    right: { style: BorderStyle.SINGLE, size: 4, color: borderGray },
  };

  // 1. Official Header Table (RM Logo + Company Info)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: navyBlue },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'R',
                    bold: true,
                    size: 38,
                    color: tealGreen,
                    font: 'Arial',
                  }),
                  new TextRun({
                    text: 'M',
                    bold: true,
                    size: 38,
                    color: navyBlue,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'CONTRACTING & MEP SOLUTIONS',
                    bold: true,
                    size: 14,
                    color: slateGray,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'مؤسسة صناع الموارد التجاريه (RESOURCE MAKERS TRADING Est.)',
                    bold: true,
                    size: 22,
                    color: navyBlue,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Kingdom of Saudi Arabia, Dammam, Al Shate Al gharbi\nMob: 0540445582 - 0546255850 | VAT No: 310179638200003',
                    size: 16,
                    color: slateGray,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // 2. PO Meta Information Grid (PO Info vs Vendor Info)
  const poInfoRows = [
    [
      'PO Number:',
      po.poNumber,
      'Vendor Name:',
      po.vendorName,
    ],
    [
      'Date:',
      po.date,
      'Attn / Contact:',
      po.vendorContactPerson || 'N/A',
    ],
    [
      'Project Ref:',
      po.projectRef || po.projectName,
      'Phone / Email:',
      po.vendorPhoneEmail || 'N/A',
    ],
    [
      'Delivery Date:',
      po.deliveryDate || 'As Agreed',
      'Address:',
      po.vendorAddress || 'Saudi Arabia',
    ],
    [
      'Quotation Ref:',
      po.quotationRef || 'N/A',
      'Vendor VAT #:',
      po.vendorVatNo || 'N/A',
    ],
  ].map(
    ([lbl1, val1, lbl2, val2]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: lbl1, bold: true, size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: val1, bold: true, size: 17, color: navyBlue, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: lbl2, bold: true, size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: val2, size: 17, font: 'Arial' })] })],
          }),
        ],
      })
  );

  const poMetaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: poInfoRows,
  });

  // 3. Items BOQ Table
  const boqHeaderRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 7, type: WidthType.PERCENTAGE },
        shading: { fill: tableHeaderBg },
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
        borders: thinBorder,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '#', bold: true, size: 18, font: 'Arial' })] })],
      }),
      new TableCell({
        width: { size: 48, type: WidthType.PERCENTAGE },
        shading: { fill: tableHeaderBg },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        borders: thinBorder,
        children: [new Paragraph({ children: [new TextRun({ text: 'DESCRIPTION & SPECIFICATIONS', bold: true, size: 18, font: 'Arial' })] })],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { fill: tableHeaderBg },
        margins: { top: 100, bottom: 100, left: 80, right: 80 },
        borders: thinBorder,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'QTY', bold: true, size: 18, font: 'Arial' })] })],
      }),
      new TableCell({
        width: { size: 17, type: WidthType.PERCENTAGE },
        shading: { fill: tableHeaderBg },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        borders: thinBorder,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'UNIT PRICE (SAR)', bold: true, size: 18, font: 'Arial' })] })],
      }),
      new TableCell({
        width: { size: 18, type: WidthType.PERCENTAGE },
        shading: { fill: tableHeaderBg },
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        borders: thinBorder,
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL (SAR)', bold: true, size: 18, font: 'Arial' })] })],
      }),
    ],
  });

  const boqItemRows = po.items.map(
    (item, idx) =>
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(item.itemNo || idx + 1), size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: item.description, size: 17, font: 'Arial' }),
                ],
              }),
            ],
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${item.quantity} ${item.unit || 'EA'}`, bold: true, size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }), size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }), bold: true, size: 17, font: 'Arial' })] })],
          }),
        ],
      })
  );

  // Subtotal & Financial rows
  const financialRows: any[] = [
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          shading: { fill: lightBg },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          borders: thinBorder,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'SUBTOTAL (SAR):', bold: true, size: 17, font: 'Arial' })] })],
        }),
        new TableCell({
          shading: { fill: lightBg },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          borders: thinBorder,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: po.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 }), bold: true, size: 17, font: 'Arial' })] })],
        }),
      ],
    }),
  ];

  if (po.discount > 0) {
    financialRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            shading: { fill: lightBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'DISCOUNT (SAR):', bold: true, size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            shading: { fill: lightBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${po.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, size: 17, color: 'DC2626', font: 'Arial' })] })],
          }),
        ],
      })
    );
  }

  financialRows.push(
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          shading: { fill: lightBg },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          borders: thinBorder,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `VAT (${po.vatPercent}%):`, bold: true, size: 17, font: 'Arial' })] })],
        }),
        new TableCell({
          shading: { fill: lightBg },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          borders: thinBorder,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: po.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }), size: 17, font: 'Arial' })] })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          shading: { fill: 'E6F4EA' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          borders: thinBorder,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL WITH VAT (SAR):', bold: true, size: 19, font: 'Arial' })] })],
        }),
        new TableCell({
          shading: { fill: 'E6F4EA' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          borders: thinBorder,
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: po.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }), bold: true, size: 20, color: tealGreen, font: 'Arial' })] })],
        }),
      ],
    })
  );

  const boqTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [boqHeaderRow, ...boqItemRows, ...financialRows],
  });

  // 4. Commercial & Delivery Terms Table
  const termsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Payment Method:', bold: true, size: 16, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: po.paymentTerms.method || 'Bank Transfer', size: 16, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Payment Schedule:', bold: true, size: 16, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: po.paymentTerms.schedule || 'As Agreed', size: 16, font: 'Arial' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Delivery Method:', bold: true, size: 16, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: po.deliveryTerms.method || 'DDP', size: 16, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Shipping / Partial:', bold: true, size: 16, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: `${po.deliveryTerms.shipping || 'Land'} | Partial: ${po.deliveryTerms.partialShipment || 'Allowed'}`, size: 16, font: 'Arial' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'Delivery Location:', bold: true, size: 16, font: 'Arial' })] })],
          }),
          new TableCell({
            columnSpan: 3,
            margins: { top: 70, bottom: 70, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: po.deliveryTerms.location || 'Eastern Province, Saudi Arabia', size: 16, font: 'Arial' })] })],
          }),
        ],
      }),
    ],
  });

  // 5. Contract Terms (Inclusions & Exclusions) Table
  const contractTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'INCLUDED IN PURCHASE ORDER', bold: true, size: 16, color: navyBlue, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ children: [new TextRun({ text: 'EXCLUDED FROM PURCHASE ORDER', bold: true, size: 16, color: 'DC2626', font: 'Arial' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: (po.contractTerms.included || []).map(
              (inc) =>
                new Paragraph({
                  bullet: { level: 0 },
                  children: [new TextRun({ text: inc, size: 16, font: 'Arial' })],
                })
            ),
          }),
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: (po.contractTerms.excluded || []).map(
              (exc) =>
                new Paragraph({
                  bullet: { level: 0 },
                  children: [new TextRun({ text: exc, size: 16, font: 'Arial' })],
                })
            ),
          }),
        ],
      }),
    ],
  });

  // 6. Authorization Table
  const authTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Prepared By', bold: true, size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Reviewed By', bold: true, size: 17, font: 'Arial' })] })],
          }),
          new TableCell({
            width: { size: 33.3, type: WidthType.PERCENTAGE },
            shading: { fill: tableHeaderBg },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: thinBorder,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Approved By', bold: true, size: 17, font: 'Arial' })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({ children: [new TextRun({ text: `Name: ${po.authorization.preparedBy.name}`, bold: true, size: 16, font: 'Arial' })] }),
              new Paragraph({ children: [new TextRun({ text: `Title: ${po.authorization.preparedBy.title}`, size: 15, color: slateGray, font: 'Arial' })] }),
              new Paragraph({ text: '', spacing: { before: 200 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Signature: ________________', size: 15, color: slateGray, font: 'Arial' })] }),
            ],
          }),
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({ children: [new TextRun({ text: `Name: ${po.authorization.reviewedBy.name}`, bold: true, size: 16, font: 'Arial' })] }),
              new Paragraph({ children: [new TextRun({ text: `Title: ${po.authorization.reviewedBy.title}`, size: 15, color: slateGray, font: 'Arial' })] }),
              new Paragraph({ text: '', spacing: { before: 200 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Signature: ________________', size: 15, color: slateGray, font: 'Arial' })] }),
            ],
          }),
          new TableCell({
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            borders: thinBorder,
            children: [
              new Paragraph({ children: [new TextRun({ text: `Name: ${po.authorization.approvedBy.name}`, bold: true, size: 16, font: 'Arial' })] }),
              new Paragraph({ children: [new TextRun({ text: `Title: ${po.authorization.approvedBy.title}`, size: 15, color: slateGray, font: 'Arial' })] }),
              new Paragraph({ text: '', spacing: { before: 200 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Signature: ________________', size: 15, color: slateGray, font: 'Arial' })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 800, bottom: 800, left: 1000, right: 1000 },
          },
        },
        children: [
          headerTable,
          new Paragraph({ text: '', spacing: { before: 150 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: 'PURCHASE ORDER',
                bold: true,
                size: 28,
                color: navyBlue,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 120 } }),
          poMetaTable,
          new Paragraph({ text: '', spacing: { before: 200 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'ITEMS & SPECIFICATIONS:',
                bold: true,
                size: 18,
                color: navyBlue,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 60 } }),
          boqTable,
          new Paragraph({ text: '', spacing: { before: 200 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'COMMERCIAL & LOGISTICS TERMS:',
                bold: true,
                size: 18,
                color: navyBlue,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 60 } }),
          termsTable,
          new Paragraph({ text: '', spacing: { before: 200 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'CONTRACT SCOPE TERMS:',
                bold: true,
                size: 18,
                color: navyBlue,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 60 } }),
          contractTable,
          ...(po.notes
            ? [
                new Paragraph({ text: '', spacing: { before: 120 } }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Notes: ', bold: true, size: 16, font: 'Arial' }),
                    new TextRun({ text: po.notes, size: 16, color: slateGray, font: 'Arial' }),
                  ],
                }),
              ]
            : []),
          new Paragraph({ text: '', spacing: { before: 200 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'AUTHORIZATION & APPROVALS:',
                bold: true,
                size: 18,
                color: navyBlue,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({ text: '', spacing: { before: 60 } }),
          authTable,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 250 },
            children: [
              new TextRun({
                text: 'This Purchase Order is valid only when signed and stamped by authorized personnel.',
                italics: true,
                size: 14,
                color: slateGray,
                font: 'Arial',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Purchase_Order_${po.poNumber}_${(po.vendorName || 'Vendor').replace(/\s+/g, '_')}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Calculates financial totals for a Purchase Order with line-item discounts,
 * gross order adjustments, and 2-decimal tax precision.
 */
export function calculatePOTotals(
  items: PurchaseOrderItem[],
  orderDiscount: number = 0,
  vatPercent: number = 15
) {
  let grossSubtotal = 0;
  let totalLineDiscounts = 0;

  items.forEach((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    const lineGross = qty * price;
    grossSubtotal += lineGross;

    let lineDisc = 0;
    if (it.discountPercent && it.discountPercent > 0) {
      lineDisc = (lineGross * Math.min(100, Math.max(0, it.discountPercent))) / 100;
    } else if (it.discount && it.discount > 0) {
      lineDisc = Math.min(lineGross, it.discount);
    }
    totalLineDiscounts += lineDisc;
  });

  const safeOrderDiscount = Math.max(0, Number(orderDiscount) || 0);
  const totalCombinedDiscount = Math.min(grossSubtotal, totalLineDiscounts + safeOrderDiscount);
  const totalAfterDiscount = Math.max(0, grossSubtotal - totalCombinedDiscount);
  const vatAmount = Number(((totalAfterDiscount * vatPercent) / 100).toFixed(2));
  const grandTotal = Number((totalAfterDiscount + vatAmount).toFixed(2));

  return {
    subtotal: Number(grossSubtotal.toFixed(2)),
    lineDiscounts: Number(totalLineDiscounts.toFixed(2)),
    orderDiscount: Number(safeOrderDiscount.toFixed(2)),
    discount: Number(totalCombinedDiscount.toFixed(2)),
    totalAfterDiscount: Number(totalAfterDiscount.toFixed(2)),
    vatPercent,
    vatAmount,
    grandTotal,
  };
}

/**
 * Generates the next sequential Purchase Order number (e.g. PO-2026-0001)
 */
export function getNextPONumber(existing: PurchaseOrder[], commit: boolean = false): string {
  const currentYear = new Date().getFullYear();
  let cfg: any = { purchaseOrderPrefix: 'PO-', sequenceDigits: 4, seqPO: 1 };
  try {
    const raw = localStorage.getItem('rmt_autoNumbering');
    if (raw) cfg = JSON.parse(raw);
  } catch {}

  let highestSeq = 0;
  if (existing && existing.length > 0) {
    existing.forEach((po) => {
      const match = (po.poNumber || po.id || '').match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > highestSeq) highestSeq = n;
      }
    });
  }

  try {
    const storedPOsRaw = localStorage.getItem('rmt_purchase_orders');
    if (storedPOsRaw) {
      const storedPOs: PurchaseOrder[] = JSON.parse(storedPOsRaw);
      if (Array.isArray(storedPOs)) {
        storedPOs.forEach((po) => {
          const match = (po.poNumber || po.id || '').match(/(\d+)$/);
          if (match) {
            const n = parseInt(match[1], 10);
            if (!isNaN(n) && n > highestSeq) highestSeq = n;
          }
        });
      }
    }
  } catch {}

  const nextSeq = Math.max(highestSeq + 1, Number(cfg.seqPO) || 1);

  if (commit) {
    cfg.seqPO = nextSeq + 1;
    try {
      localStorage.setItem('rmt_autoNumbering', JSON.stringify(cfg));
    } catch {}
  }

  const prefix = cfg.purchaseOrderPrefix || 'PO-';
  const digits = cfg.sequenceDigits || 4;
  return `${prefix}${currentYear}-${String(nextSeq).padStart(digits, '0')}`;
}

/**
 * Parses an Excel file buffer (.xlsx or .xls) to extract Purchase Order items and metadata
 */
export function extractPOItemsFromExcelBuffer(buffer: ArrayBuffer): {
  items: PurchaseOrderItem[];
  vendorName?: string;
  quotationRef?: string;
  rawCount: number;
} {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const items: PurchaseOrderItem[] = [];
    let detectedVendor = '';
    let detectedQuoteRef = '';

    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!rows || rows.length === 0) return;

      let headerRowIdx = -1;
      let descCol = -1;
      let qtyCol = -1;
      let unitCol = -1;
      let priceCol = -1;
      let totalCol = -1;

      for (let r = 0; r < Math.min(rows.length, 35); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;
        const textCells = row.map((c) => String(c ?? '').toLowerCase().trim());

        // Check for vendor or quote reference in header area
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '');
          const lower = val.toLowerCase();
          if ((lower.includes('vendor') || lower.includes('supplier') || lower.includes('المورد') || lower.includes('الموزع')) && c + 1 < row.length) {
            const nextVal = String(row[c + 1] || '').trim();
            if (nextVal && !detectedVendor) detectedVendor = nextVal;
          }
          if ((lower.includes('quotation') || lower.includes('quote ref') || lower.includes('عرض سعر') || lower.includes('مرجع')) && c + 1 < row.length) {
            const nextVal = String(row[c + 1] || '').trim();
            if (nextVal && !detectedQuoteRef) detectedQuoteRef = nextVal;
          }
        }

        const foundDesc = textCells.findIndex(
          (c) =>
            c.includes('desc') ||
            c.includes('item') ||
            c.includes('material') ||
            c.includes('وصف') ||
            c.includes('بيان') ||
            c.includes('صنف') ||
            c.includes('البند')
        );

        const foundPrice = textCells.findIndex(
          (c) =>
            c.includes('unit price') ||
            c.includes('rate') ||
            c.includes('price') ||
            c.includes('سعر') ||
            c.includes('افرادي') ||
            c.includes('إفرادي') ||
            c.includes('تكلفة')
        );

        const foundQty = textCells.findIndex(
          (c) =>
            c.includes('qty') ||
            c.includes('quantity') ||
            c.includes('كمية') ||
            c.includes('العدد')
        );

        if (foundDesc !== -1 && (foundPrice !== -1 || foundQty !== -1)) {
          headerRowIdx = r;
          descCol = foundDesc;
          qtyCol = foundQty;
          priceCol = foundPrice;
          unitCol = textCells.findIndex(
            (c) => c.includes('unit') || c.includes('uom') || c.includes('وحدة')
          );
          totalCol = textCells.findIndex(
            (c, i) =>
              i !== priceCol &&
              (c.includes('total') ||
                c.includes('amount') ||
                c.includes('اجمالي') ||
                c.includes('إجمالي') ||
                c.includes('مجموع'))
          );
          break;
        }
      }

      if (headerRowIdx !== -1 && descCol !== -1) {
        for (let r = headerRowIdx + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;

          const desc = String(row[descCol] || '').trim();
          if (!desc || desc.length < 2) continue;

          // Skip summary or footer rows
          const lowerDesc = desc.toLowerCase();
          if (
            lowerDesc.includes('total') ||
            lowerDesc.includes('subtotal') ||
            lowerDesc.includes('vat') ||
            lowerDesc.includes('ضريبة') ||
            lowerDesc.includes('المجموع') ||
            lowerDesc.includes('terms')
          ) {
            continue;
          }

          let qty = 1;
          if (qtyCol !== -1 && row[qtyCol] !== undefined) {
            const rawQty = parseFloat(String(row[qtyCol]).replace(/[^0-9.-]+/g, ''));
            if (!isNaN(rawQty) && rawQty > 0) qty = rawQty;
          }

          let unit = 'EA';
          if (unitCol !== -1 && row[unitCol]) {
            const rawUnit = String(row[unitCol]).trim();
            if (rawUnit) unit = rawUnit;
          }

          let unitPrice = 0;
          if (priceCol !== -1 && row[priceCol] !== undefined) {
            const rawPrice = parseFloat(String(row[priceCol]).replace(/[^0-9.-]+/g, ''));
            if (!isNaN(rawPrice)) unitPrice = rawPrice;
          }

          let totalPrice = Number((qty * unitPrice).toFixed(2));
          if (totalCol !== -1 && row[totalCol] !== undefined) {
            const rawTotal = parseFloat(String(row[totalCol]).replace(/[^0-9.-]+/g, ''));
            if (!isNaN(rawTotal) && rawTotal > 0) {
              totalPrice = rawTotal;
              if (unitPrice === 0 && qty > 0) {
                unitPrice = Number((totalPrice / qty).toFixed(2));
              }
            }
          }

          items.push({
            id: `po-excel-${Date.now()}-${items.length + 1}`,
            itemNo: items.length + 1,
            description: desc,
            quantity: qty,
            unit,
            unitPrice,
            totalPrice,
          });
        }
      }
    });

    return {
      items,
      vendorName: detectedVendor || undefined,
      quotationRef: detectedQuoteRef || undefined,
      rawCount: items.length,
    };
  } catch (err) {
    console.error('Error parsing Excel PO:', err);
    return { items: [], rawCount: 0 };
  }
}

/**
 * Exports the Purchase Order to a pristine, executive-ready PDF / Print Window
 * replicating the exact layout of the authentic RMT Purchase Order document.
 */
export function exportPurchaseOrderToPDF(po: PurchaseOrder): void {
  const customLogo = typeof window !== 'undefined' ? localStorage.getItem('rmt_company_logo') : null;

  const itemsHtml = po.items
    .map(
      (item, idx) => `
      <tr>
        <td style="text-align: center; vertical-align: middle; padding: 5px 4px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 40px; font-size: 10px;">
          ${item.itemNo || idx + 1}
        </td>
        <td style="text-align: left; vertical-align: middle; padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10.5px; line-height: 1.3; color: #1e293b;">
          ${item.description.replace(/\n/g, '<br/>')}
        </td>
        <td style="text-align: center; vertical-align: middle; padding: 5px 4px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #1e293b; width: 50px; font-size: 10px;">
          ${item.quantity}
        </td>
        <td style="text-align: right; vertical-align: middle; padding: 5px 6px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 11px; color: #334155; width: 95px; white-space: nowrap;">
          <span style="font-size: 9px; color: #64748b; margin-right: 3px;">SAR</span>${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td style="text-align: right; vertical-align: middle; padding: 5px 6px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 11px; font-weight: 700; color: #0f172a; width: 110px; white-space: nowrap;">
          <span style="font-size: 9px; color: #64748b; margin-right: 3px;">SAR</span>${item.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    `
    )
    .join('');

  const isDefaultNote = !po.notes || po.notes.trim().toLowerCase().includes('valid only when signed') || po.notes.trim().toLowerCase().includes('صالح فقط عند التوقيع');
  const customNote = !isDefaultNote ? po.notes : '';

  const includedTermsHtml = (po.contractTerms?.included || [])
    .map((term) => `<li style="margin-bottom: 4px; color: #334155;">• ${term}</li>`)
    .join('');

  const excludedTermsHtml = (po.contractTerms?.excluded || [])
    .map((term) => `<li style="margin-bottom: 4px; color: #334155;">• ${term}</li>`)
    .join('');

  const logoMarkup = customLogo
    ? `<img src="${customLogo}" alt="Logo" style="max-height: 54px; max-width: 160px; object-fit: contain; display: block;" />`
    : `<div class="monogram"><span class="monogram-r">R</span><span class="monogram-m">M</span></div>`;

  const sigPrepared = (typeof window !== 'undefined' ? localStorage.getItem('rmt_sig_prepared') : null) || po.authorization?.preparedBy?.signatureUrl || '';
  const sigReviewed = (typeof window !== 'undefined' ? localStorage.getItem('rmt_sig_reviewed') : null) || po.authorization?.reviewedBy?.signatureUrl || '';
  const sigApproved = (typeof window !== 'undefined' ? localStorage.getItem('rmt_sig_approved') : null) || po.authorization?.approvedBy?.signatureUrl || '';
  const companySeal = (typeof window !== 'undefined' ? localStorage.getItem('rmt_company_seal') : null) || '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Order - ${po.poNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 9mm 9mm 9mm 9mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #000000;
      background: #ffffff;
      font-size: 10.5px;
      line-height: 1.35;
      height: auto !important;
    }

    .print-container {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Top Letterhead */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .monogram {
      font-size: 34px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -2px;
    }
    .monogram-r { color: #007A5A; }
    .monogram-m { color: #1E3A8A; margin-left: -2px; }

    .company-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .company-sub {
      font-size: 10px;
      color: #475569;
      line-height: 1.3;
    }

    /* Dark Blue Banner */
    .po-banner {
      background: #1e3a8a;
      color: #ffffff;
      text-align: center;
      padding: 7px 0;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
      border-radius: 2px;
    }

    /* Metadata Info Grid */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      border: 1px solid #cbd5e1;
    }
    .info-table th {
      background: #007A5A;
      color: #ffffff;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-align: left;
      width: 50%;
    }
    .info-table td {
      vertical-align: top;
      padding: 8px 10px;
      border-right: 1px solid #e2e8f0;
    }
    .info-table td:last-child {
      border-right: none;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 11px;
    }
    .info-label {
      font-weight: 700;
      color: #0f172a;
      width: 110px;
      flex-shrink: 0;
    }
    .info-val {
      color: #334155;
      text-align: right;
      flex-grow: 1;
      word-break: break-word;
    }

    /* Items BOQ Table */
    .boq-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      margin-bottom: 14px;
    }
    .boq-table th {
      background: #1e3a8a;
      color: #ffffff;
      padding: 7px 8px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid #1e3a8a;
    }

    /* Financial Summary Box */
    .totals-container {
      width: 100%;
      display: flex;
      justify-content: flex-end;
      margin-top: -14px;
      margin-bottom: 14px;
    }
    .totals-table {
      width: 320px;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      background: #ffffff;
    }
    .totals-table td {
      padding: 5px 12px;
      font-size: 11.5px;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-label {
      font-weight: 600;
      color: #334155;
    }
    .totals-val {
      text-align: right;
      font-family: monospace;
      font-weight: 700;
      color: #0f172a;
    }
    .grand-total-row {
      background: #007A5A !important;
      color: #ffffff !important;
    }
    .grand-total-row td {
      color: #ffffff !important;
      font-weight: 800 !important;
      font-size: 13px !important;
      padding: 7px 12px !important;
    }

    /* Section Banner */
    .section-banner {
      background: #e2e8f0;
      color: #1e293b;
      padding: 4px 8px;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      text-align: center;
      margin-top: 10px;
      margin-bottom: 6px;
      border: 1px solid #cbd5e1;
    }

    /* Terms & Logistics Table */
    .terms-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .terms-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .term-key {
      font-weight: 700;
      color: #1e293b;
      width: 110px;
      background: #f8fafc;
    }

    /* Contract Terms 2 Columns */
    .contract-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      margin-bottom: 10px;
      font-size: 10.5px;
    }
    .contract-table th {
      background: #f1f5f9;
      color: #1e293b;
      padding: 5px 8px;
      font-weight: 800;
      font-size: 10px;
      text-align: left;
      border: 1px solid #cbd5e1;
    }
    .contract-table td {
      vertical-align: top;
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      width: 50%;
    }
    .contract-list {
      margin: 0;
      padding-left: 0;
      list-style: none;
    }

    /* Authorization Table */
    .auth-banner {
      background: #1e3a8a;
      color: #ffffff;
      padding: 5px 0;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 12px;
      margin-bottom: 0;
    }
    .auth-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      margin-bottom: 12px;
      text-align: center;
    }
    .auth-table th {
      background: #f8fafc;
      color: #3b82f6;
      font-style: italic;
      padding: 6px 4px;
      font-size: 11px;
      border: 1px solid #e2e8f0;
      width: 33.33%;
    }
    .auth-table td {
      padding: 8px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      font-size: 10.5px;
    }
    .sig-space {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 6px;
    }
    .sig-svg {
      max-height: 42px;
      opacity: 0.85;
    }

    .footer-note {
      text-align: center;
      font-size: 9.5px;
      color: #64748b;
      font-style: italic;
      margin-top: 6px;
    }

    @media print {
      @page {
        size: A4 portrait;
        margin: 12mm 10mm 15mm 10mm;
      }
      html, body {
        height: auto !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: 11px !important;
      }
      .no-print { display: none !important; }
      .print-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
      table { page-break-inside: auto; border-collapse: collapse !important; width: 100% !important; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      .signatures-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 1.5rem;
        display: flex;
        justify-content: space-between;
      }
    }
  </style>
</head>
<body>
<div class="print-container">

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: middle; width: 30%;">
        ${logoMarkup}
      </td>
      <td style="vertical-align: top; text-align: right; width: 70%;">
        <div class="company-title">مؤسسة صناع الموارد التجاريه</div>
        <div style="font-size: 11px; font-weight: bold; color: #174A84; margin-bottom: 2px;">RESOURCE MAKERS TRADING Est.</div>
        <div class="company-sub">
          Kingdom of Saudi Arabia, Dammam, Al Shate Al gharbi<br/>
          Phone: +966 549220606 | Email: info@rmt-sa.com<br/>
          CR. NO. 2050167793 &nbsp; VAT NO. 311552664400003
        </div>
      </td>
    </tr>
  </table>

  <!-- Purchase Order Banner -->
  <div class="po-banner">PURCHASE ORDER</div>

  <!-- Info Grid -->
  <table class="info-table">
    <tr>
      <th>PO INFORMATION</th>
      <th>VENDOR INFORMATION</th>
    </tr>
    <tr>
      <td>
        <div class="info-row"><span class="info-label">PO Number</span><span class="info-val" style="font-weight:700; color:#1e3a8a;">${po.poNumber}</span></div>
        <div class="info-row"><span class="info-label">Date</span><span class="info-val">${po.date}</span></div>
        <div class="info-row"><span class="info-label">Project Ref.</span><span class="info-val">${po.projectRef || po.projectName}</span></div>
        <div class="info-row"><span class="info-label">Delivery Date</span><span class="info-val">${po.deliveryDate || 'As agreed'}</span></div>
        <div class="info-row"><span class="info-label">Quotation Ref.</span><span class="info-val">${po.quotationRef || '-'}</span></div>
      </td>
      <td>
        <div class="info-row"><span class="info-label">Vendor Name</span><span class="info-val" style="font-weight:700;">${po.vendorName}</span></div>
        <div class="info-row"><span class="info-label">Contact Person</span><span class="info-val">${po.vendorContactPerson || '-'}</span></div>
        <div class="info-row"><span class="info-label">Phone / Email</span><span class="info-val">${po.vendorPhoneEmail || '-'}</span></div>
        <div class="info-row"><span class="info-label">Vendor Address</span><span class="info-val">${po.vendorAddress || '-'}</span></div>
        <div class="info-row"><span class="info-label">Vendor VAT No.</span><span class="info-val" style="font-family:monospace;">${po.vendorVatNo || '-'}</span></div>
      </td>
    </tr>
  </table>

  <!-- BOQ Table -->
  <table class="boq-table">
    <thead>
      <tr>
        <th style="width: 45px; text-align: center;">Item #</th>
        <th style="text-align: left;">Description / Specifications</th>
        <th style="width: 55px; text-align: center;">Qty</th>
        <th style="width: 95px; text-align: right;">Unit Price</th>
        <th style="width: 110px; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <!-- UNIFIED CLOSING BLOCK: Financial Totals, Terms & Executive Signatures -->
  <div class="signatures-block" style="page-break-inside: avoid !important; break-inside: avoid !important; margin-top: 6px; display: block;">
    
    <!-- Top Row: Financial Summary & Commercial Delivery Notes -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
      <tr>
        <td style="vertical-align: top; width: 55%; padding-right: 10px;">
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; font-size: 10px; color: #475569; line-height: 1.35;">
            <strong style="color: #1e3a8a; display: block; margin-bottom: 2px; font-size: 10.5px;">DELIVERY NOTICE & QUALITY COMPLIANCE</strong>
            <span>All supplied materials must match project specifications, approved submittals, and SASO/Civil Defense codes. Original Delivery Note & ZATCA Tax Invoice required upon handover.</span>
            ${customNote ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; color: #0f172a;"><b>Special Instructions:</b> ${customNote}</div>` : ''}
          </div>
        </td>
        <td style="vertical-align: top; width: 45%;">
          <table class="totals-table" style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; background: #ffffff;">
            <tr>
              <td class="totals-label" style="padding: 4px 8px; font-size: 10.5px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">Subtotal</td>
              <td class="totals-val" style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><span style="font-size: 9px; color: #64748b; margin-right: 3px;">SAR</span>${po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            ${po.discount > 0 ? `
            <tr>
              <td class="totals-label" style="padding: 4px 8px; font-size: 10.5px; font-weight: 600; color: #b91c1c; border-bottom: 1px solid #f1f5f9;">Discount</td>
              <td class="totals-val" style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #b91c1c; border-bottom: 1px solid #f1f5f9;">-<span style="font-size: 9px; margin-right: 3px;">SAR</span>${po.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="totals-label" style="padding: 4px 8px; font-size: 10.5px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">Total after Discount</td>
              <td class="totals-val" style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><span style="font-size: 9px; color: #64748b; margin-right: 3px;">SAR</span>${po.totalAfterDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>` : ''}
            <tr>
              <td class="totals-label" style="padding: 4px 8px; font-size: 10.5px; font-weight: 600; color: #334155; border-bottom: 1px solid #f1f5f9;">VAT / ${po.vatPercent}%</td>
              <td class="totals-val" style="padding: 4px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;"><span style="font-size: 9px; color: #64748b; margin-right: 3px;">SAR</span>${po.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr style="background: #007A5A !important; color: #ffffff !important;">
              <td style="padding: 5px 8px; font-weight: 800; font-size: 11px; color: #ffffff;">GRAND TOTAL</td>
              <td style="padding: 5px 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 12.5px; color: #ffffff;"><span style="font-size: 9.5px; margin-right: 3px; color: #ffffff;">SAR</span>${po.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Middle Row: Payment Terms & Delivery Terms (Side-by-Side 2 Columns) -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 5px; font-size: 10px;">
      <thead>
        <tr>
          <th style="width: 50%; background: #1e3a8a; color: #ffffff; padding: 4px 8px; font-size: 10px; font-weight: 700; text-align: left; letter-spacing: 0.5px; border-right: 1px solid #cbd5e1;">PAYMENT TERMS</th>
          <th style="width: 50%; background: #007A5A; color: #ffffff; padding: 4px 8px; font-size: 10px; font-weight: 700; text-align: left; letter-spacing: 0.5px;">DELIVERY & LOGISTICS</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="vertical-align: top; padding: 5px 8px; border-right: 1px solid #cbd5e1; background: #ffffff;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 700; color: #1e293b; width: 75px;">Method:</span>
              <span style="color: #334155; flex: 1;">${po.paymentTerms.method || 'Bank Transfer'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 700; color: #1e293b; width: 75px;">Schedule:</span>
              <span style="color: #334155; flex: 1;">${po.paymentTerms.schedule || '50% Advance / 50% on Delivery'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 700; color: #1e293b; width: 75px;">Currency:</span>
              <span style="color: #334155; flex: 1;">${po.paymentTerms.currency || 'SAR'}</span>
            </div>
            <div style="margin-top: 2px; font-size: 9.5px; color: #475569; word-break: break-word;">
              <strong>Bank Details:</strong> ${po.paymentTerms.bankDetails || 'Al Inma Bank / Al Rajhi Bank'}
            </div>
          </td>
          <td style="vertical-align: top; padding: 5px 8px; background: #ffffff;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 700; color: #1e293b; width: 95px;">Method / Terms:</span>
              <span style="color: #334155; flex: 1;">${po.deliveryTerms.method || 'DDP'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 700; color: #1e293b; width: 95px;">Shipping / Carrier:</span>
              <span style="color: #334155; flex: 1;">${po.deliveryTerms.shipping || 'Land Transport'} &nbsp;|&nbsp; <b>Partial:</b> ${po.deliveryTerms.partialShipment || 'Allowed'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-weight: 700; color: #1e293b; width: 95px;">Delivery Location:</span>
              <span style="color: #334155; flex: 1;">${po.deliveryTerms.location || 'Eastern Province - Dahran - Block 13'}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Contract Scope: Included & Excluded (Side-by-Side 2 Columns) -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; margin-bottom: 5px; font-size: 9.5px;">
      <thead>
        <tr>
          <th style="width: 50%; background: #f1f5f9; color: #1e293b; padding: 3px 8px; font-size: 9.5px; font-weight: 700; text-align: left; border-right: 1px solid #cbd5e1;">INCLUDED IN CONTRACT</th>
          <th style="width: 50%; background: #f1f5f9; color: #1e293b; padding: 3px 8px; font-size: 9.5px; font-weight: 700; text-align: left;">EXCLUDED FROM CONTRACT</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="vertical-align: top; padding: 4px 8px; border-right: 1px solid #cbd5e1; background: #ffffff;">
            <ul style="margin: 0; padding-left: 12px; list-style-type: disc; line-height: 1.3; color: #334155;">
              ${includedTermsHtml || '<li>Technical datasheets and catalogue submittals for all items.</li><li>Delivery to Dammam Warehouse as scheduled.</li><li>12 months standard warranty against manufacturing defects.</li>'}
            </ul>
          </td>
          <td style="vertical-align: top; padding: 4px 8px; background: #ffffff;">
            <ul style="margin: 0; padding-left: 12px; list-style-type: disc; line-height: 1.3; color: #334155;">
              ${excludedTermsHtml || '<li>Site installation and cabling works.</li><li>Offloading and crane services at site.</li><li>Site civil preparation.</li>'}
            </ul>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Executive Signatures Block: Balanced 3 Columns -->
    <div style="width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #ffffff;">
      <div style="background: #1e3a8a; color: #ffffff; padding: 3px 8px; font-size: 10px; font-weight: 800; text-align: center; letter-spacing: 0.8px; text-transform: uppercase;">
        AUTHORIZATION & EXECUTIVE SIGNATURES (الاعتماد والتفويض الرسمي)
      </div>
      <table style="width: 100%; border-collapse: collapse; text-align: center;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <th style="width: 33.33%; padding: 4px 6px; font-size: 10px; color: #1e3a8a; font-weight: 700; border-right: 1px solid #e2e8f0;">Prepared By (مسؤول المشتريات)</th>
            <th style="width: 33.33%; padding: 4px 6px; font-size: 10px; color: #007A5A; font-weight: 700; border-right: 1px solid #e2e8f0;">Reviewed By (المراجعة المالية)</th>
            <th style="width: 33.34%; padding: 4px 6px; font-size: 10px; color: #0f172a; font-weight: 700;">Approved By (المدير العام / الاعتماد)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="vertical-align: middle; padding: 4px 8px; border-right: 1px solid #e2e8f0; font-size: 10px;">
              <strong style="color: #0f172a; display: block;">${po.authorization?.preparedBy?.name || 'Medhat Al Brahim'}</strong>
              <span style="color: #64748b; font-size: 9px; display: block;">${po.authorization?.preparedBy?.title || 'Procurement Officer'}</span>
              <div style="height: 38px; display: flex; align-items: center; justify-content: center; margin: 2px 0;">
                ${
                  sigPrepared
                    ? `<img src="${sigPrepared}" style="max-height: 36px; max-width: 110px; object-fit: contain;" alt="Signature" />`
                    : `<span style="font-size: 9.5px; color: #94a3b8; font-style: italic;">Pending Signature</span>`
                }
              </div>
              <span style="font-family: monospace; font-size: 8.5px; color: #94a3b8;">Date: ${po.date}</span>
            </td>
            <td style="vertical-align: middle; padding: 4px 8px; border-right: 1px solid #e2e8f0; font-size: 10px;">
              <strong style="color: #0f172a; display: block;">${po.authorization?.reviewedBy?.name || 'Mokhtar Yousef'}</strong>
              <span style="color: #64748b; font-size: 9px; display: block;">${po.authorization?.reviewedBy?.title || 'Projects Manager'}</span>
              <div style="height: 38px; display: flex; align-items: center; justify-content: center; margin: 2px 0;">
                ${
                  sigReviewed
                    ? `<img src="${sigReviewed}" style="max-height: 36px; max-width: 110px; object-fit: contain;" alt="Signature" />`
                    : `<span style="font-size: 9.5px; color: #94a3b8; font-style: italic;">Pending Signature</span>`
                }
              </div>
              <span style="font-family: monospace; font-size: 8.5px; color: #94a3b8;">Date: ${po.date}</span>
            </td>
            <td style="vertical-align: middle; padding: 4px 8px; font-size: 10px; position: relative;">
              <strong style="color: #0f172a; display: block;">${po.authorization?.approvedBy?.name || 'Abdullah Al Moaili'}</strong>
              <span style="color: #64748b; font-size: 9px; display: block;">${po.authorization?.approvedBy?.title || 'General Manager'}</span>
              <div style="height: 38px; display: flex; align-items: center; justify-content: center; margin: 2px 0; position: relative;">
                ${
                  sigApproved
                    ? `<img src="${sigApproved}" style="max-height: 36px; max-width: 110px; object-fit: contain; z-index: 2;" alt="Signature" />`
                    : `<span style="font-size: 9.5px; color: #94a3b8; font-style: italic; z-index: 2;">Pending Signature</span>`
                }
                ${
                  companySeal
                    ? `<img src="${companySeal}" style="max-height: 36px; max-width: 80px; object-fit: contain; position: absolute; right: 0; opacity: 0.85; z-index: 1;" alt="Seal" />`
                    : ''
                }
              </div>
              <span style="font-family: monospace; font-size: 8.5px; color: #94a3b8;">Official Certified Stamp</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Official Bottom Disclaimer -->
    <div style="text-align: center; font-size: 9px; color: #64748b; font-style: italic; margin-top: 4px;">
      This Purchase Order is an authentic binding commercial instrument valid only when certified and signed by authorized personnel.
    </div>

  </div>
</div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  try {
    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
  } catch (err) {
    console.warn('Popup window blocked, falling back to hidden iframe print', err);
  }

  // Fallback: Use hidden iframe for iframe/embedded environments
  try {
    let iframe = document.getElementById('rmt-print-po-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'rmt-print-po-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 500);
    }
  } catch (e) {
    console.error('Failed to trigger print for PO:', e);
  }
}

