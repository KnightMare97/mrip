import React, { useState } from 'react';

interface ArtworkPlaceholderProps {
  seed: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Simple deterministic hash from string seed
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export const ArtworkPlaceholder: React.FC<ArtworkPlaceholderProps> = ({
  seed,
  title,
  artist,
  coverUrl,
  size = 'md',
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);
  const hash = hashCode(seed);

  const palettes = [
    { bg1: '#18181b', bg2: '#09090b', accent1: '#f59e0b', accent2: '#b45309', ring: '#27272a' },
    { bg1: '#1c1917', bg2: '#0c0a09', accent1: '#fbbf24', accent2: '#78350f', ring: '#292524' },
    { bg1: '#1e1b24', bg2: '#0f0e13', accent1: '#d97706', accent2: '#451a03', ring: '#2e2839' },
    { bg1: '#171a1d', bg2: '#090a0c', accent1: '#f59e0b', accent2: '#92400e', ring: '#242a30' }
  ];

  const palette = palettes[hash % palettes.length];
  const patternType = hash % 4;

  const sizeClasses = {
    sm: 'w-12 h-12 rounded-lg text-[9px]',
    md: 'w-20 h-20 rounded-xl text-xs',
    lg: 'w-36 h-36 md:w-44 md:h-44 rounded-2xl text-sm',
    xl: 'w-48 h-48 sm:w-60 sm:h-60 rounded-2xl text-base'
  }[size];

  const initials = (title || seed)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  // If live provider artwork is present and not errored, render real cover
  if (coverUrl && !imgError) {
    return (
      <div
        className={`relative overflow-hidden shrink-0 shadow-lg border border-zinc-800/80 select-none bg-zinc-950 ${sizeClasses} ${className}`}
      >
        <img
          src={coverUrl}
          alt={title ? `${title} album cover` : 'Cover'}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={() => setImgError(true)}
          loading="lazy"
        />
        <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-[inherit]" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden shrink-0 shadow-lg border border-zinc-800/80 select-none flex items-center justify-center ${sizeClasses} ${className}`}
      style={{
        background: `radial-gradient(circle at 30% 30%, ${palette.bg1}, ${palette.bg2})`
      }}
      aria-label={title ? `${title} album cover artwork` : 'Album artwork'}
    >
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full opacity-60"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`grad-${hash}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.accent1} stopOpacity="0.7" />
            <stop offset="100%" stopColor={palette.accent2} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {patternType === 0 && (
          <g>
            <circle cx="100" cy="100" r="85" fill="none" stroke={palette.ring} strokeWidth="2" />
            <circle cx="100" cy="100" r="65" fill="none" stroke={palette.ring} strokeWidth="1.5" />
            <circle cx="100" cy="100" r="45" fill="none" stroke={palette.ring} strokeWidth="2" />
            <circle cx="100" cy="100" r="24" fill={palette.bg2} stroke={palette.accent1} strokeWidth="2" />
            <path d="M15 15 L185 185" stroke={`url(#grad-${hash})`} strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="100" r="6" fill={palette.accent1} />
          </g>
        )}

        {patternType === 1 && (
          <g>
            <polygon points="100,25 170,65 170,145 100,185 30,145 30,65" fill="none" stroke={palette.ring} strokeWidth="2" />
            <polygon points="100,25 170,65 100,105 30,65" fill={`url(#grad-${hash})`} opacity="0.4" />
            <line x1="100" y1="105" x2="100" y2="185" stroke={palette.accent1} strokeWidth="2" />
            <line x1="100" y1="105" x2="170" y2="65" stroke={palette.ring} strokeWidth="1.5" />
            <line x1="100" y1="105" x2="30" y2="65" stroke={palette.ring} strokeWidth="1.5" />
          </g>
        )}

        {patternType === 2 && (
          <g>
            <path d="M20 140 Q 100 80, 180 140" fill="none" stroke={palette.accent1} strokeWidth="3" />
            <path d="M20 120 Q 100 60, 180 120" fill="none" stroke={`url(#grad-${hash})`} strokeWidth="2" opacity="0.6" />
            <path d="M20 100 Q 100 40, 180 100" fill="none" stroke={palette.ring} strokeWidth="1.5" />
            <circle cx="100" cy="70" r="18" fill={palette.accent1} opacity="0.85" />
          </g>
        )}

        {patternType === 3 && (
          <g>
            <rect x="55" y="40" width="90" height="120" rx="45" fill="none" stroke={`url(#grad-${hash})`} strokeWidth="3" />
            <ellipse cx="100" cy="100" rx="75" ry="30" fill="none" stroke={palette.ring} strokeWidth="2" transform="rotate(-25 100 100)" />
            <circle cx="60" cy="85" r="8" fill={palette.accent1} />
          </g>
        )}
      </svg>

      {(size === 'sm' || size === 'md') && (
        <span className="relative z-10 font-bold tracking-wider text-amber-400/90 font-mono">
          {initials}
        </span>
      )}

      <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/5 rounded-[inherit]" />
    </div>
  );
};
