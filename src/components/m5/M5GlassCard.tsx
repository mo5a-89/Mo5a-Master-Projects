import React from 'react';

interface M5GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glowEdge?: 'gold' | 'green' | 'blue' | 'olive' | 'none';
  interactive?: boolean;
}

export const M5GlassCard: React.FC<M5GlassCardProps> = ({
  children,
  className = '',
  onClick,
  glowEdge = 'none',
  interactive = false,
}) => {
  const edgeGlowStyles = {
    none: '',
    gold: 'border-t-2 border-t-[#D4AF37] hover:shadow-[0_16px_40px_rgba(212,175,55,0.3)]',
    green: 'border-t-2 border-t-[#22C55E] hover:shadow-[0_16px_40px_rgba(34,197,94,0.3)]',
    blue: 'border-t-2 border-t-[#38BDF8] hover:shadow-[0_16px_40px_rgba(56,189,248,0.3)]',
    olive: 'border-t-2 border-t-[#65A30D] hover:shadow-[0_16px_40px_rgba(101,163,13,0.3)]',
  };

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl backdrop-blur-2xl bg-white/95 dark:bg-[#0B1528]/95 border border-white/90 dark:border-cyan-400/40 shadow-[0_12px_40px_rgba(0,0,0,0.1),inset_0_0_0_2px_rgba(255,255,255,0.9),inset_0_2px_4px_rgba(255,255,255,1)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_0_0_1.5px_rgba(255,255,255,0.2)] transition-all duration-300 ${
        interactive ? 'cursor-pointer hover:-translate-y-1 hover:shadow-2xl active:scale-[0.99]' : ''
      } ${edgeGlowStyles[glowEdge]} ${className}`}
    >
      {/* Crystalline top specular reflection highlight line */}
      <div className="absolute top-0 inset-x-4 h-[2px] bg-gradient-to-r from-transparent via-white dark:via-cyan-300 to-transparent pointer-events-none rounded-t-2xl" />
      {children}
    </div>
  );
};

