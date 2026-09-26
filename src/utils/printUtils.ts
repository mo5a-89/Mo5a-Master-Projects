/**
 * Unified, reliable, and beautifully styled print utility for web & iframe environments.
 * Provides:
 * 1. Direct seamless in-page printing with dedicated print style sheet isolation.
 * 2. Standalone styled print window ("نافذة مستقلة") with pristine A4 proportions,
 *    embedded Tailwind-compatible CSS, Cairo Arabic typography, and strictly constrained logos.
 */

export function executePrint(
  elementId?: string,
  options?: {
    documentTitle?: string;
    onBeforePrint?: () => void;
    onAfterPrint?: () => void;
  }
) {
  options?.onBeforePrint?.();

  const title = options?.documentTitle || document.title || 'مستند رسمي - مؤسسة صناع الموارد للتجاره RMT';

  if (!elementId) {
    try {
      window.print();
    } finally {
      options?.onAfterPrint?.();
    }
    return;
  }

  const target = document.getElementById(elementId);
  if (!target) {
    console.warn(`Print target element with ID "${elementId}" not found.`);
    options?.onAfterPrint?.();
    return;
  }

  // First strategy: Try opening styled standalone print window
  const opened = openPrintWindow(elementId, title, true);
  if (opened) {
    options?.onAfterPrint?.();
    return;
  }

  // Fallback strategy: In-page print isolation
  performInPagePrint(target, title, options?.onAfterPrint);
}

/**
 * Direct In-page print isolation that cleanly prints only the target element
 * without headers, footers, background tabs, or modal backdrop artifacts.
 */
function performInPagePrint(target: HTMLElement, title: string, onAfterPrint?: () => void) {
  const previousTitle = document.title;
  document.title = title;

  const styleId = 'rmt-inpage-print-isolation-style';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  // Target element will be temporarily marked
  target.classList.add('rmt-print-isolated-target');
  document.body.classList.add('rmt-print-in-progress');

  styleEl.innerHTML = `
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
      body.rmt-print-in-progress {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print,
      body.rmt-print-in-progress .no-print,
      body.rmt-print-in-progress .print-modal-container > *:not(.print-modal-content),
      body.rmt-print-in-progress .print-modal-content > .no-print {
        display: none !important;
      }
      .print-container {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      table {
        page-break-inside: auto;
        border-collapse: collapse !important;
        width: 100% !important;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
      .signatures-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 1.5rem;
        display: flex;
        justify-content: space-between;
      }
      .signature-img, .signature-box img, .signatures-block img {
        max-height: 65px !important;
        max-width: 160px !important;
        object-fit: contain !important;
      }
      .company-logo-svg, svg.company-logo-svg, svg[viewBox="0 0 150 100"] {
        max-height: 48px !important;
        max-width: 140px !important;
        height: 48px !important;
        width: auto !important;
        display: inline-block !important;
      }
    }
  `;

  setTimeout(() => {
    try {
      window.print();
    } catch (e) {
      console.warn('In-page window.print failed:', e);
    } finally {
      document.title = previousTitle;
      target.classList.remove('rmt-print-isolated-target');
      document.body.classList.remove('rmt-print-in-progress');
      onAfterPrint?.();
    }
  }, 150);
}

/**
 * Opens a pristine, beautifully formatted print window with strict layout,
 * constrained logo proportions, embedded typography, and complete Tailwind-compatible styling.
 */
export function openPrintWindow(
  elementId: string,
  title: string = 'طباعة المستند الرسمي',
  autoTriggerPrint: boolean = false
): boolean {
  const target = document.getElementById(elementId);
  if (!target) {
    console.warn(`Print target element with ID "${elementId}" not found.`);
    return false;
  }

  // Gather existing link stylesheets and style tags
  let externalLinks = '';
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    externalLinks += link.outerHTML + '\n';
  });

  let inlineStyles = '';
  document.querySelectorAll('style').forEach((st) => {
    // Avoid re-injecting huge or broken stylesheets
    if (st.innerHTML && !st.innerHTML.includes('sourcemappingurl')) {
      inlineStyles += st.innerHTML + '\n';
    }
  });

  const origin = window.location.origin;

  // Open the print window
  let printWin: Window | null = null;
  try {
    printWin = window.open('', '_blank', 'width=1100,height=950,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
  } catch (err) {
    console.warn('window.open blocked:', err);
  }

  if (!printWin) {
    console.warn('Popup window blocked by browser.');
    return false;
  }

  const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <base href="${origin}/">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  ${externalLinks}
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Cairo', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
            cairo: ['Cairo', 'sans-serif'],
            mono: ['JetBrains Mono', 'Courier New', 'monospace']
          },
          colors: {
            rmt: {
              green: '#007A5A',
              darkGreen: '#00664B',
              blue: '#174A84',
              accent: '#00A859'
            }
          }
        }
      }
    }
  </script>
  <style>
    ${inlineStyles}

    /* Core Baseline & Box Model */
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    html, body {
      margin: 0;
      padding: 0;
      background-color: #0f172a;
      color: #0f172a;
      font-family: 'Cairo', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
    }

    /* Strict Proportions for Company Logo - Never allow logo to blow up */
    .company-logo-svg, 
    svg.company-logo-svg, 
    svg[viewBox="0 0 150 100"], 
    img.company-logo, 
    .company-logo,
    svg {
      max-height: 48px !important;
      max-width: 140px !important;
      height: 48px !important;
      width: auto !important;
      display: inline-block !important;
      flex-shrink: 0 !important;
      object-fit: contain !important;
    }

    /* Icon SVGs must remain compact */
    svg:not(.company-logo-svg):not([viewBox="0 0 150 100"]) {
      max-width: 24px !important;
      max-height: 24px !important;
    }

    /* Standalone Preview Container (Simulates real A4 sheet on desktop) */
    .print-page-wrapper {
      padding: 32px 16px 80px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      background: #0f172a;
    }

    .print-sheet {
      width: 100%;
      max-width: 900px;
      background: #ffffff;
      color: #0f172a;
      padding: 40px 48px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
    }

    /* Top Control Bar */
    .top-control-bar {
      position: sticky;
      top: 0;
      z-index: 99999;
      background: #1e293b;
      color: #ffffff;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-b: 1px solid #334155;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
      width: 100%;
    }

    .btn-print-primary {
      background: #007A5A;
      color: #ffffff;
      border: none;
      padding: 10px 24px;
      font-size: 13.5px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: 'Cairo', sans-serif;
      box-shadow: 0 2px 8px rgba(0, 122, 90, 0.4);
      transition: all 0.2s ease;
    }
    .btn-print-primary:hover {
      background: #00664B;
      transform: translateY(-1px);
    }
    .btn-print-primary:active {
      transform: translateY(1px);
    }

    .btn-close {
      background: #334155;
      color: #f1f5f9;
      border: 1px solid #475569;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      transition: background 0.2s ease;
    }
    .btn-close:hover {
      background: #475569;
    }

    /* Force visibility of print-only letterheads & tables in screen preview */
    .print\\:block {
      display: block !important;
    }
    .print\\:flex {
      display: flex !important;
    }

    /* Table Formatting */
    table {
      width: 100%;
      border-collapse: collapse !important;
      margin-top: 12px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }

    /* Clean printing rules */
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
    }

    @media print {
      html, body {
        height: auto !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: 11px !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print, .top-control-bar {
        display: none !important;
      }
      .print-container {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .print-page-wrapper {
        padding: 0 !important;
        background: transparent !important;
        min-height: auto !important;
      }
      .print-sheet {
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        max-width: 100% !important;
        width: 100% !important;
        border-radius: 0 !important;
      }
      table {
        page-break-inside: auto;
        border-collapse: collapse !important;
        width: 100% !important;
      }
      tr, .print-avoid-break, .break-inside-avoid, [data-print-avoid-break] {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
      .signatures-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-top: 1.5rem;
        display: flex;
        justify-content: space-between;
      }
      .signature-img, .signature-box img, .signatures-block img {
        max-height: 65px !important;
        max-width: 160px !important;
        object-fit: contain !important;
      }
    }
  </style>
</head>
<body>
  <!-- Top Action Control Bar -->
  <div class="top-control-bar no-print">
    <div style="display: flex; align-items: center; gap: 14px;">
      <div style="font-size: 14.5px; font-weight: 800; color: #f8fafc; letter-spacing: -0.2px;">
        مؤسسة صناع الموارد للتجاره RMT
      </div>
      <span style="font-size: 12px; color: #94a3b8; border-right: 1px solid #475569; padding-right: 12px;">
        ${title}
      </span>
      <span style="font-size: 11px; color: #10b981; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; rounded: 6px;">
        جاهز للطباعة والتصدير A4
      </span>
    </div>

    <div style="display: flex; align-items: center; gap: 10px;">
      <button class="btn-print-primary" onclick="window.print()">
        <svg style="width: 17px; height: 17px; fill: currentColor;" viewBox="0 0 24 24">
          <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
        </svg>
        <span>طباعة المستند الآن (Print / PDF)</span>
      </button>

      <button class="btn-close" onclick="window.close()">
        إغلاق
      </button>
    </div>
  </div>

  <!-- Simulated A4 Paper Canvas -->
  <div class="print-page-wrapper">
    <div class="print-sheet">
      <div id="print-rendered-content">
        ${target.innerHTML}
      </div>
    </div>
  </div>

  <script>
    ${autoTriggerPrint ? `
      window.addEventListener('load', function() {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 600);
      });
    ` : ''}
  </script>
</body>
</html>
  `;

  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
  return true;
}

// Backward-compatible alias
export const openPrintPopup = openPrintWindow;
