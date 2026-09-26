import React, { useEffect } from 'react';

interface MobileViewerTopBarProps {
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  backButtonText?: string;
}

/**
 * Hook to support hardware back button and browser history navigation.
 * Pushes a dummy history state on mount and triggers onClose when user navigates back.
 */
export const useModalBackDismiss = (onClose?: () => void) => {
  useEffect(() => {
    if (!onClose || typeof window === 'undefined') return;

    window.history.pushState({ modalOpen: true }, '');
    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose]);
};

/**
 * Mobile-friendly persistent top action bar for all document viewers,
 * attachment viewers, reports, and quotation/PO preview modals.
 */
export const MobileViewerTopBar: React.FC<MobileViewerTopBarProps> = ({
  onClose,
  title,
  subtitle,
  actions,
  className = '',
  backButtonText,
}) => {
  // Bind hardware & native browser back navigation
  useModalBackDismiss(onClose);

  return (
    <div
      className={`no-print sticky top-0 z-50 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-md ${className}`}
    >
      {/* Prominent Back / Close Button for Mobile */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-700 transition cursor-pointer"
          title={backButtonText || 'رجوع / إغلاق'}
        >
          <span className="text-lg leading-none select-none">←</span>
          <span className="text-xs sm:text-sm font-bold">{backButtonText || 'رجوع / إغلاق'}</span>
        </button>

        {title && (
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-white leading-tight truncate max-w-[280px]">
              {title}
            </span>
            {subtitle && (
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Middle/Custom Actions (e.g., Print, Manage Signatures, Download) */}
      <div className="flex items-center gap-2">
        {actions}

        {/* Floating High-Visibility Quick Exit (X) Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full active:scale-90 transition cursor-pointer"
          title="إغلاق فوري"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
