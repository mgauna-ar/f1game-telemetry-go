import React from 'react';

interface F1TelemetryLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  variant?: 'icon' | 'badge' | 'monochrome';
}

export const F1TelemetryLogo: React.FC<F1TelemetryLogoProps> = ({
  size = 28,
  className = '',
  animated = false,
  variant = 'icon',
}) => {
  const isMonochrome = variant === 'monochrome';
  const showBadge = variant === 'badge';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="F1 Telemetry"
      className={`f1-telemetry-logo ${animated ? 'f1-tacho-animated' : ''} ${className}`}
    >
      <defs>
        {/* Background Gradient for Badge Mode */}
        {showBadge && (
          <linearGradient id="tachoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#141721" />
            <stop offset="100%" stopColor="#08090C" />
          </linearGradient>
        )}

        {/* Cyan Low-Rev Gradient */}
        <linearGradient id="tachoCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isMonochrome ? 'currentColor' : '#00F0FF'} />
          <stop offset="100%" stopColor={isMonochrome ? 'currentColor' : '#00A3FF'} />
        </linearGradient>

        {/* Crimson Redline Gradient */}
        <linearGradient id="tachoRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isMonochrome ? 'currentColor' : '#FF4B72'} />
          <stop offset="50%" stopColor={isMonochrome ? 'currentColor' : '#FF1842'} />
          <stop offset="100%" stopColor={isMonochrome ? 'currentColor' : '#C40026'} />
        </linearGradient>

        {/* Glow Filters */}
        {!isMonochrome && (
          <>
            <filter id="tachoCrimsonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="tachoCyanGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </>
        )}
      </defs>

      {/* Optional Badge Backdrop */}
      {showBadge && (
        <rect
          width="64"
          height="64"
          rx="14"
          fill="url(#tachoBgGrad)"
          stroke="rgba(255, 24, 66, 0.35)"
          strokeWidth="1.5"
        />
      )}

      {/* Outer Gauge Base Track Line */}
      <path
        d="M 14 44 A 22 22 0 1 1 50 44"
        stroke={isMonochrome ? 'currentColor' : 'rgba(255, 255, 255, 0.15)'}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Segmented LED Rev Arc (Progressing to Redline) */}
      {/* 1. Low Rev Segment (Cyan) */}
      <path
        d="M 14 44 A 22 22 0 0 1 20 20"
        stroke={isMonochrome ? 'currentColor' : 'url(#tachoCyanGrad)'}
        strokeWidth="5"
        strokeLinecap="round"
        className="f1-tacho-seg1"
        filter={!isMonochrome ? 'url(#tachoCyanGlow)' : undefined}
      />

      {/* 2. Mid Rev Segment (Purple/Magenta) */}
      <path
        d="M 23 17 A 22 22 0 0 1 37 13"
        stroke={isMonochrome ? 'currentColor' : '#B138FF'}
        strokeWidth="5"
        strokeLinecap="round"
        className="f1-tacho-seg2"
      />

      {/* 3. Peak Redline Segment (Crimson) */}
      <path
        d="M 40 14 A 22 22 0 0 1 50 44"
        stroke={isMonochrome ? 'currentColor' : 'url(#tachoRedGrad)'}
        strokeWidth="5.5"
        strokeLinecap="round"
        className="f1-tacho-seg3"
        filter={!isMonochrome ? 'url(#tachoCrimsonGlow)' : undefined}
      />

      {/* Shift Light Peak Spark Points */}
      {!isMonochrome && (
        <>
          <circle
            cx="48"
            cy="22"
            r="1.8"
            fill="#FFFFFF"
            className="f1-tacho-spark"
            filter="url(#tachoCrimsonGlow)"
          />
          <circle cx="49" cy="36" r="1.4" fill="#FF1842" />
        </>
      )}

      {/* Center Dial Hub */}
      <circle
        cx="32"
        cy="35"
        r="4.5"
        fill={isMonochrome ? 'none' : '#141721'}
        stroke={isMonochrome ? 'currentColor' : 'rgba(255, 255, 255, 0.3)'}
        strokeWidth="1.5"
      />

      {/* Sharp Cyan Apex Needle Pointing at Peak Power */}
      <polygon
        points="30,35 34,35 44,18 42,16"
        fill={isMonochrome ? 'currentColor' : 'url(#tachoCyanGrad)'}
        className="f1-tacho-needle"
        filter={!isMonochrome ? 'url(#tachoCyanGlow)' : undefined}
      />
      {!isMonochrome && <circle cx="43" cy="17" r="1.2" fill="#FFFFFF" />}

      {/* Center Hub Pin */}
      <circle
        cx="32"
        cy="35"
        r="2"
        fill={isMonochrome ? 'currentColor' : '#00F0FF'}
      />
    </svg>
  );
};
