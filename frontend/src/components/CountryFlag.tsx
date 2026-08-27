import React from 'react';
import { useI18n } from '../context/I18nContext';

export interface CountryFlagProps {
  countryCode?: string | null;
  className?: string;
  width?: number;
  height?: number;
  showTooltip?: boolean;
  tooltipText?: string;
}

// Crisp, high-detail vector SVGs for all F1 host nations (aspect ratio 4:3 / 640x480)
const SVG_FLAGS: Record<string, React.ReactNode> = {
  // Australia (AU)
  au: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <defs>
        <clipPath id="au-canton"><path d="M0 0h320v240H0z"/></clipPath>
        <clipPath id="au-cross"><path d="M0 0l320 240m0-240L0 240"/></clipPath>
      </defs>
      <path fill="#00008b" d="M0 0h640v480H0z"/>
      {/* Union Jack in canton */}
      <g clipPath="url(#au-canton)">
        <path stroke="#fff" strokeWidth="48" d="M0 0l320 240m0-240L0 240"/>
        <path stroke="#cc0000" strokeWidth="16" d="M0 0l320 240m0-240L0 240" clipPath="url(#au-cross)"/>
        <path stroke="#fff" strokeWidth="80" d="M160 0v240M0 120h320"/>
        <path stroke="#cc0000" strokeWidth="48" d="M160 0v240M0 120h320"/>
      </g>
      {/* Commonwealth Star */}
      <polygon fill="#fff" points="160,300 168,328 196,328 174,346 182,374 160,358 138,374 146,346 124,328 152,328"/>
      {/* Southern Cross */}
      <polygon fill="#fff" points="480,80 484,94 498,94 487,103 491,117 480,109 469,117 473,103 462,94 476,94"/>
      <polygon fill="#fff" points="560,180 564,194 578,194 567,203 571,217 560,209 549,217 553,203 542,194 556,194"/>
      <polygon fill="#fff" points="480,380 484,394 498,394 487,403 491,417 480,409 469,417 473,403 462,394 476,394"/>
      <polygon fill="#fff" points="400,220 404,234 418,234 407,243 411,257 400,249 389,257 393,243 382,234 396,234"/>
      <polygon fill="#fff" points="515,265 518,274 527,274 520,280 523,289 515,284 507,289 510,280 503,274 512,274"/>
    </svg>
  ),

  // France (FR)
  fr: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#002654" d="M0 0h213.3v480H0z"/>
      <path fill="#ffffff" d="M213.3 0h213.4v480H213.3z"/>
      <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
    </svg>
  ),

  // China (CN)
  cn: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ee1c25" d="M0 0h640v480H0z"/>
      <polygon fill="#ffff00" points="100,60 112,98 152,98 120,121 132,159 100,136 68,159 80,121 48,98 88,98"/>
      <polygon fill="#ffff00" points="200,40 205,52 217,52 208,59 211,71 200,64 189,71 192,59 183,52 195,52"/>
      <polygon fill="#ffff00" points="240,80 245,92 257,92 248,99 251,111 240,104 229,111 232,99 223,92 235,92"/>
      <polygon fill="#ffff00" points="240,140 245,152 257,152 248,159 251,171 240,164 229,171 232,159 223,152 235,152"/>
      <polygon fill="#ffff00" points="200,180 205,192 217,192 208,199 211,211 200,204 189,211 192,199 183,192 195,192"/>
    </svg>
  ),

  // Bahrain (BH)
  bh: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ce1126" d="M0 0h640v480H0z"/>
      <path fill="#ffffff" d="M0 0h160l80 48-80 48 80 48-80 48 80 48-80 48 80 48-80 48 80 48-80 48H0z"/>
    </svg>
  ),

  // Spain (ES)
  es: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#c60b1e" d="M0 0h640v120H0zm0 360h640v120H0z"/>
      <path fill="#ffc400" d="M0 120h640v240H0z"/>
      <g transform="translate(140, 200) scale(0.6)">
        <rect x="0" y="0" width="80" height="90" rx="10" fill="#c60b1e"/>
        <circle cx="40" cy="45" r="25" fill="#ffc400"/>
        <rect x="30" y="-20" width="20" height="20" fill="#ffc400"/>
      </g>
    </svg>
  ),

  // Monaco (MC)
  mc: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ce1126" d="M0 0h640v240H0z"/>
      <path fill="#ffffff" d="M0 240h640v240H0z"/>
    </svg>
  ),

  // Canada (CA)
  ca: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ff0000" d="M0 0h160v480H0zm480 0h160v480H480z"/>
      <path fill="#ffffff" d="M160 0h320v480H160z"/>
      {/* Stylized Canadian Maple Leaf */}
      <path fill="#ff0000" d="M320 80l22 45 40-10-15 42 45 15-28 35 30 18-50 15 2 30-46-20-46 20 2-30-50-15 30-18-28-35 45-15-15-42 40 10 22-45v130h-6v45h12v-45h-6z"/>
    </svg>
  ),

  // Great Britain / UK (GB)
  gb: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <clipPath id="gb-all"><path d="M0 0h640v480H0z"/></clipPath>
      <g clipPath="url(#gb-all)">
        <path fill="#012169" d="M0 0h640v480H0z"/>
        <path stroke="#fff" strokeWidth="60" d="M0 0l640 480M640 0L0 480"/>
        <path stroke="#c8102e" strokeWidth="20" d="M0 0l640 480M640 0L0 480"/>
        <path stroke="#fff" strokeWidth="100" d="M320 0v480M0 240h640"/>
        <path stroke="#c8102e" strokeWidth="60" d="M320 0v480M0 240h640"/>
      </g>
    </svg>
  ),

  // Germany (DE)
  de: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#000000" d="M0 0h640v160H0z"/>
      <path fill="#dd0000" d="M0 160h640v160H0z"/>
      <path fill="#ffce00" d="M0 320h640v160H0z"/>
    </svg>
  ),

  // Hungary (HU)
  hu: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ce2939" d="M0 0h640v160H0z"/>
      <path fill="#ffffff" d="M0 160h640v160H0z"/>
      <path fill="#477050" d="M0 320h640v160H0z"/>
    </svg>
  ),

  // Belgium (BE)
  be: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#000000" d="M0 0h213.3v480H0z"/>
      <path fill="#ffd90c" d="M213.3 0h213.4v480H213.3z"/>
      <path fill="#f31830" d="M426.7 0H640v480H426.7z"/>
    </svg>
  ),

  // Italy (IT)
  it: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#009246" d="M0 0h213.3v480H0z"/>
      <path fill="#ffffff" d="M213.3 0h213.4v480H213.3z"/>
      <path fill="#ce2b37" d="M426.7 0H640v480H426.7z"/>
    </svg>
  ),

  // Singapore (SG)
  sg: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ed2939" d="M0 0h640v240H0z"/>
      <path fill="#ffffff" d="M0 240h640v240H0z"/>
      {/* Crescent */}
      <path fill="#ffffff" d="M120 40a80 80 0 1 0 0 160 70 70 0 1 1 0-160z"/>
      {/* 5 Stars */}
      <polygon fill="#ffffff" points="145,70 148,80 158,80 150,86 153,96 145,90 137,96 140,86 132,80 142,80"/>
      <polygon fill="#ffffff" points="175,90 178,100 188,100 180,106 183,116 175,110 167,116 170,106 162,100 172,100"/>
      <polygon fill="#ffffff" points="165,130 168,140 178,140 170,146 173,156 165,150 157,156 160,146 152,140 162,140"/>
      <polygon fill="#ffffff" points="125,130 128,140 138,140 130,146 133,156 125,150 117,156 120,146 112,140 122,140"/>
      <polygon fill="#ffffff" points="115,90 118,100 128,100 120,106 123,116 115,110 107,116 110,106 102,100 112,100"/>
    </svg>
  ),

  // Japan (JP)
  jp: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ffffff" d="M0 0h640v480H0z"/>
      <circle fill="#bc002d" cx="320" cy="240" r="144"/>
    </svg>
  ),

  // United Arab Emirates (AE)
  ae: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#00732f" d="M0 0h640v160H0z"/>
      <path fill="#ffffff" d="M0 160h640v160H0z"/>
      <path fill="#000000" d="M0 320h640v160H0z"/>
      <path fill="#ff0000" d="M0 0h160v480H0z"/>
    </svg>
  ),

  // United States (US)
  us: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      {/* 13 Stripes */}
      {Array.from({ length: 13 }).map((_, i) => (
        <rect key={i} y={(480 / 13) * i} width="640" height={480 / 13 + 0.5} fill={i % 2 === 0 ? '#b22234' : '#ffffff'} />
      ))}
      {/* Blue Canton */}
      <rect x="0" y="0" width="280" height={(480 / 13) * 7} fill="#3c3b6e"/>
      {/* Star Grid Pattern */}
      <g fill="#ffffff" transform="scale(0.8) translate(10, 10)">
        {[30, 70, 110, 150, 190].map((y, rowIdx) =>
          [30, 70, 110, 150, 190, 230, 270].map((x, colIdx) => (
            <polygon key={`${rowIdx}-${colIdx}`} points={`${x},${y - 8} ${x + 2.5},${y - 2} ${x + 8},${y - 2} ${x + 3.5},${y + 2} ${x + 5.5},${y + 8} ${x},${y + 4.5} ${x - 5.5},${y + 8} ${x - 3.5},${y + 2} ${x - 8},${y - 2} ${x - 2.5},${y - 2}`} />
          ))
        )}
      </g>
    </svg>
  ),

  // Brazil (BR)
  br: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#009b3a" d="M0 0h640v480H0z"/>
      <polygon fill="#fedf00" points="320,40 600,240 320,440 40,240"/>
      <circle fill="#002776" cx="320" cy="240" r="105"/>
      <path fill="#ffffff" d="M218 245a105 105 0 0 1 204-10 105 105 0 0 0-204 10z"/>
    </svg>
  ),

  // Austria (AT)
  at: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ed2939" d="M0 0h640v160H0zm0 320h640v160H0z"/>
      <path fill="#ffffff" d="M0 160h640v160H0z"/>
    </svg>
  ),

  // Russia (RU)
  ru: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ffffff" d="M0 0h640v160H0z"/>
      <path fill="#0039a6" d="M0 160h640v160H0z"/>
      <path fill="#d52b1e" d="M0 320h640v160H0z"/>
    </svg>
  ),

  // Mexico (MX)
  mx: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#006847" d="M0 0h213.3v480H0z"/>
      <path fill="#ffffff" d="M213.3 0h213.4v480H213.3z"/>
      <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
      <circle fill="#8b5a2b" cx="320" cy="240" r="28"/>
      <polygon fill="#d4af37" points="320,215 328,230 312,230"/>
    </svg>
  ),

  // Azerbaijan (AZ)
  az: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#00b5e2" d="M0 0h640v160H0z"/>
      <path fill="#ef3340" d="M0 160h640v160H0z"/>
      <path fill="#509e2f" d="M0 320h640v160H0z"/>
      {/* Crescent & Star */}
      <path fill="#ffffff" d="M305 195a45 45 0 1 0 0 90 38 38 0 1 1 0-90z"/>
      <polygon fill="#ffffff" points="340,225 344,233 352,230 348,238 355,244 346,245 346,254 340,248 334,254 334,245 325,244 332,238 328,230 336,233"/>
    </svg>
  ),

  // Vietnam (VN)
  vn: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#da251d" d="M0 0h640v480H0z"/>
      <polygon fill="#ffff00" points="320,110 357,224 477,224 380,295 417,409 320,338 223,409 260,295 163,224 283,224"/>
    </svg>
  ),

  // Netherlands (NL)
  nl: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#ae1c28" d="M0 0h640v160H0z"/>
      <path fill="#ffffff" d="M0 160h640v160H0z"/>
      <path fill="#21468b" d="M0 320h640v160H0z"/>
    </svg>
  ),

  // Portugal (PT)
  pt: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#046a38" d="M0 0h256v480H0z"/>
      <path fill="#da291c" d="M256 0h384v480H256z"/>
      <circle cx="256" cy="240" r="70" fill="#fed100"/>
      <rect x="236" y="215" width="40" height="50" rx="6" fill="#ffffff"/>
      <rect x="246" y="225" width="20" height="30" fill="#002776"/>
    </svg>
  ),

  // Saudi Arabia (SA)
  sa: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#006c35" d="M0 0h640v480H0z"/>
      {/* Stylized script & sword in white */}
      <rect x="180" y="280" width="280" height="12" rx="4" fill="#ffffff"/>
      <polygon fill="#ffffff" points="470,286 450,274 450,298"/>
      <rect x="200" y="270" width="12" height="32" rx="2" fill="#ffffff"/>
      <path fill="#ffffff" d="M220 180h200v40H220z" opacity="0.85"/>
    </svg>
  ),
  // Qatar (QA)
  qa: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#8d1b3d" d="M0 0h640v480H0z"/>
      <path fill="#ffffff" d="M0 0h180l60 26.6-60 26.7 60 26.7-60 26.7 60 26.6-60 26.7 60 26.7-60 26.7 60 26.6-60 26.7 60 26.7-60 26.7 60 26.6-60 26.7H0z"/>
    </svg>
  ),

  // Argentina (AR)
  ar: (
    <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
      <path fill="#74acdf" d="M0 0h640v160H0z"/>
      <path fill="#ffffff" d="M0 160h640v160H0z"/>
      <path fill="#74acdf" d="M0 320h640v160H0z"/>
      {/* Sol de Mayo */}
      <g transform="translate(320, 240)">
        {Array.from({ length: 16 }).map((_, i) => (
          <polygon
            key={i}
            transform={`rotate(${i * 22.5})`}
            points="0,-54 -5,-30 5,-30"
            fill="#f6b40e"
          />
        ))}
        <circle cx="0" cy="0" r="26" fill="#f6b40e" stroke="#853406" strokeWidth="1.5" />
        <circle cx="-8" cy="-4" r="2.5" fill="#853406" />
        <circle cx="8" cy="-4" r="2.5" fill="#853406" />
        <path d="M-8 8 Q 0 14 8 8" stroke="#853406" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="0" cy="2" r="1.5" fill="#853406" />
      </g>
    </svg>
  ),
};

// Checkered Racing Flag fallback for unknown / international tracks
const CHECKERED_FLAG = (
  <svg viewBox="0 0 640 480" className="country-flag-svg" aria-hidden="true">
    <rect width="640" height="480" fill="#1e222d"/>
    {/* Checkered pattern */}
    {Array.from({ length: 6 }).map((_, r) =>
      Array.from({ length: 8 }).map((_, c) => (
        <rect
          key={`${r}-${c}`}
          x={c * 80}
          y={r * 80}
          width="80"
          height="80"
          fill={(r + c) % 2 === 0 ? '#f0f3f8' : '#222734'}
        />
      ))
    )}
  </svg>
);

export const CountryFlag: React.FC<CountryFlagProps> = ({
  countryCode,
  className = '',
  width = 18,
  height = 13,
  showTooltip = true,
  tooltipText,
}) => {
  const { t } = useI18n();

  const normalizedCode = countryCode ? countryCode.trim().toLowerCase() : '';
  const hasValidFlag = Boolean(normalizedCode && SVG_FLAGS[normalizedCode]);
  const flagSvg = hasValidFlag ? SVG_FLAGS[normalizedCode] : CHECKERED_FLAG;

  // Resolve localized country name
  const localizedName =
    tooltipText ||
    (hasValidFlag ? t(`common.countries.${normalizedCode}`) : t('common.countries.unknown')) ||
    'International / Unknown';

  return (
    <span
      className={`track-flag-wrapper ${className}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      title={localizedName}
      data-testid="track-country-flag"
      data-country={normalizedCode || 'unknown'}
      role="img"
      aria-label={localizedName}
    >
      <span className="track-flag-box">
        {flagSvg}
      </span>
      {showTooltip && (
        <span className="track-flag-tooltip" role="tooltip">
          {localizedName}
        </span>
      )}
    </span>
  );
};
