import React from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface M5ModeButtonProps {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
}

export const M5ModeButton: React.FC<M5ModeButtonProps> = ({
  isActive,
  onToggle,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isActive ? 'وضع M5 المستقبلي مفعّل (انقر للتبديل)' : 'تفعيل وضع M5 المستقبلي'}
      className={`relative h-10 px-3 rounded-xl flex items-center gap-2 text-xs font-bold transition-all duration-300 select-none cursor-pointer active:scale-95 ${
        isActive
          ? 'backdrop-blur-xl bg-slate-900/80 text-amber-300 border border-amber-400/50 shadow-[inset_0_0_12px_rgba(212,175,55,0.35),0_0_16px_rgba(30,58,138,0.3)] hover:shadow-[inset_0_0_16px_rgba(212,175,55,0.5),0_0_20px_rgba(16,185,129,0.25)]'
          : 'backdrop-blur-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 border border-slate-200 shadow-2xs'
      } ${className}`}
    >
      {/* Subtle Glowing Pulse Dot when Active */}
      {isActive ? (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-r from-amber-400 to-emerald-400" />
        </span>
      ) : (
        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
      )}

      {/* M5 Badge Label */}
      <span className="font-mono tracking-tight font-extrabold flex items-center gap-1">
        <span>M5</span>
        <span className="text-[10px] uppercase font-sans tracking-wide opacity-90 hidden sm:inline">MODE</span>
      </span>

      {/* Subtle Hologram Icon */}
      {isActive ? (
        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
      ) : (
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
      )}
    </button>
  );
};
