import React from 'react';

interface M5CircularProgressRingProps {
  percentage: number;
  label: string;
  sublabel?: string;
  colorType?: 'green' | 'gold' | 'blue' | 'olive';
  size?: number;
  strokeWidth?: number;
  valueDisplay?: string;
  glowId: string;
}

export const M5CircularProgressRing: React.FC<M5CircularProgressRingProps> = ({
  percentage,
  label,
  sublabel,
  colorType = 'green',
  size = 110,
  strokeWidth = 9,
  valueDisplay,
  glowId,
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  // Color mappings adhering strictly to:
  // Deep Navy Blue, Olive Green (Dark/Zaiti), Light Green (Vibrant), Gold, Matte Gray
  const colorMap = {
    green: {
      gradientStart: '#22C55E', // Vibrant Light Green
      gradientEnd: '#10B981',
      glow: 'rgba(34, 197, 94, 0.45)',
      textColor: 'text-emerald-300',
      badgeBg: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
      trackColor: 'rgba(34, 197, 94, 0.12)',
    },
    gold: {
      gradientStart: '#F59E0B', // Gold
      gradientEnd: '#D4AF37',
      glow: 'rgba(212, 175, 55, 0.45)',
      textColor: 'text-amber-300',
      badgeBg: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
      trackColor: 'rgba(212, 175, 55, 0.12)',
    },
    blue: {
      gradientStart: '#38BDF8', // Deep Navy / Cyan accent
      gradientEnd: '#1E40AF',
      glow: 'rgba(56, 189, 248, 0.4)',
      textColor: 'text-sky-300',
      badgeBg: 'bg-sky-500/20 border-sky-400/30 text-sky-300',
      trackColor: 'rgba(30, 64, 175, 0.15)',
    },
    olive: {
      gradientStart: '#65A30D', // Olive Green accent
      gradientEnd: '#365314',
      glow: 'rgba(101, 163, 13, 0.4)',
      textColor: 'text-lime-300',
      badgeBg: 'bg-lime-500/20 border-lime-400/30 text-lime-300',
      trackColor: 'rgba(54, 83, 20, 0.2)',
    },
  };

  const selected = colorMap[colorType];

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-2xl relative group transition-transform duration-300 hover:scale-105">
      {/* 3D Glass Floating Pedestal */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="rotate-[-90deg] transform drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
        >
          <defs>
            <linearGradient id={`grad-${glowId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={selected.gradientStart} />
              <stop offset="100%" stopColor={selected.gradientEnd} />
            </linearGradient>
            <filter id={`glow-${glowId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={selected.gradientStart} floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Background Track (Neumorphic recessed glass depth) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={selected.trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Glowing Animated Progress Stroke */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={`url(#grad-${glowId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter={`url(#glow-${glowId})`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Floating Value with 3D depth */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
          <span
            className={`font-mono font-black text-lg sm:text-xl tracking-tight leading-none ${selected.textColor} drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}
          >
            {valueDisplay ?? `${clamped.toFixed(0)}%`}
          </span>
          <span className="text-[10px] text-slate-300 font-semibold mt-0.5 opacity-90">
            {sublabel}
          </span>
        </div>
      </div>

      {/* Label Badge underneath */}
      <div className="mt-2 text-center">
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-xs ${selected.badgeBg}`}
        >
          {label}
        </span>
      </div>
    </div>
  );
};
