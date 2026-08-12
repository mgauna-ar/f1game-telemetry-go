import React, { useState } from 'react';
import type { CarDamageData } from '../hooks/useTelemetry';

interface F1CarSchematicProps {
  carDamage: CarDamageData | null;
  hoveredPart?: string | null;
  onHoverPart?: (part: string | null) => void;
}

export const F1CarSchematic: React.FC<F1CarSchematicProps> = ({ carDamage, hoveredPart: externalHovered, onHoverPart }) => {
  const [internalHovered, setInternalHovered] = useState<string | null>(null);
  const activeHover = externalHovered ?? internalHovered;

  const handleMouseEnter = (partName: string) => {
    setInternalHovered(partName);
    onHoverPart?.(partName);
  };

  const handleMouseLeave = () => {
    setInternalHovered(null);
    onHoverPart?.(null);
  };

  // Helper for dynamic heatmap color based on percentage (0..100)
  const getDamageColor = (value: number | undefined) => {
    const val = Math.min(100, Math.max(0, value ?? 0));
    if (val === 0) return 'var(--accent-green, #00ff88)';
    if (val < 25) return '#00f2fe'; // Low / Mild
    if (val < 50) return '#ffcc00'; // Moderate
    if (val < 75) return '#ff7700'; // High
    return '#ff0055'; // Critical / Severe
  };

  const getTyreWearColor = (wear: number | undefined) => {
    const val = Math.min(100, Math.max(0, wear ?? 0));
    if (val >= 75) return '#ff0055';
    if (val >= 50) return '#ff7700';
    if (val >= 25) return '#ffcc00';
    return '#00ff88';
  };

  const flWear = carDamage?.TyresWear[2] ?? 0;
  const frWear = carDamage?.TyresWear[3] ?? 0;
  const rlWear = carDamage?.TyresWear[0] ?? 0;
  const rrWear = carDamage?.TyresWear[1] ?? 0;

  const flDmg = carDamage?.TyresDamage[2] ?? 0;
  const frDmg = carDamage?.TyresDamage[3] ?? 0;
  const rlDmg = carDamage?.TyresDamage[0] ?? 0;
  const rrDmg = carDamage?.TyresDamage[1] ?? 0;

  const flWing = carDamage?.FrontLeftWingDamage ?? 0;
  const frWing = carDamage?.FrontRightWingDamage ?? 0;
  const rearWing = carDamage?.RearWingDamage ?? 0;
  const floor = carDamage?.FloorDamage ?? 0;
  const diffuser = carDamage?.DiffuserDamage ?? 0;
  const sidepod = carDamage?.SidepodDamage ?? 0;
  const engine = Math.max(carDamage?.EngineDamage ?? 0, carDamage?.EngineICEWear ?? 0);
  const gearbox = carDamage?.GearBoxDamage ?? 0;

  const isHovered = (part: string) => activeHover === part;

  const getStrokeWidth = (part: string) => (isHovered(part) ? 2.5 : 1);
  const getFilter = (part: string) => (isHovered(part) ? 'drop-shadow(0px 0px 8px rgba(0, 242, 254, 0.8))' : 'none');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        viewBox="0 0 200 370"
        style={{
          width: '100%',
          maxHeight: '350px',
          filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))',
        }}
      >
        <defs>
          {/* Subtle Cyber Grid Background */}
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
          {/* Glowing gradient for engine */}
          <radialGradient id="engineGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={getDamageColor(engine)} stopOpacity="0.8" />
            <stop offset="100%" stopColor={getDamageColor(engine)} stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* Chassis Shadow Outline */}
        <ellipse cx="100" cy="185" rx="75" ry="160" fill="rgba(0,0,0,0.4)" filter="blur(8px)" />

        {/* --- FRONT WING LEFT --- */}
        <g
          onMouseEnter={() => handleMouseEnter('flWing')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer', transition: 'all 0.2s' }}
          filter={getFilter('flWing')}
        >
          <path
            d="M 32 15 L 94 30 L 94 44 L 32 38 Z"
            fill={getDamageColor(flWing)}
            fillOpacity={isHovered('flWing') ? 0.9 : 0.65}
            stroke={isHovered('flWing') ? '#fff' : 'rgba(255,255,255,0.3)'}
            strokeWidth={getStrokeWidth('flWing')}
          />
          {/* Endplate */}
          <rect x="26" y="10" width="6" height="34" rx="2" fill={getDamageColor(flWing)} stroke="#fff" strokeWidth="0.5" />
        </g>

        {/* --- FRONT WING RIGHT --- */}
        <g
          onMouseEnter={() => handleMouseEnter('frWing')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer', transition: 'all 0.2s' }}
          filter={getFilter('frWing')}
        >
          <path
            d="M 168 15 L 106 30 L 106 44 L 168 38 Z"
            fill={getDamageColor(frWing)}
            fillOpacity={isHovered('frWing') ? 0.9 : 0.65}
            stroke={isHovered('frWing') ? '#fff' : 'rgba(255,255,255,0.3)'}
            strokeWidth={getStrokeWidth('frWing')}
          />
          {/* Endplate */}
          <rect x="168" y="10" width="6" height="34" rx="2" fill={getDamageColor(frWing)} stroke="#fff" strokeWidth="0.5" />
        </g>

        {/* --- NOSE CONE --- */}
        <path
          d="M 100 20 L 110 32 L 108 120 L 92 120 L 90 32 Z"
          fill="#1e293b"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* --- FRONT LEFT WHEEL & SUSPENSION --- */}
        {/* Suspension Wishbone FL */}
        <line x1="92" y1="65" x2="42" y2="60" stroke="#64748b" strokeWidth="2" />
        <line x1="92" y1="85" x2="42" y2="80" stroke="#64748b" strokeWidth="2" />
        <g
          onMouseEnter={() => handleMouseEnter('flTyre')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('flTyre')}
        >
          <rect
            x="18"
            y="48"
            width="24"
            height="48"
            rx="5"
            fill="#0f172a"
            stroke={getTyreWearColor(flWear)}
            strokeWidth={isHovered('flTyre') ? 3 : 2}
          />
          {/* Wear fill bar inside tyre */}
          <rect
            x="22"
            y={48 + 48 * (1 - flWear / 100)}
            width="16"
            height={48 * (flWear / 100)}
            rx="2"
            fill={getTyreWearColor(flWear)}
            fillOpacity="0.75"
          />
          {flDmg > 0 && <circle cx="30" cy="72" r="4" fill="#ff0055" stroke="#fff" strokeWidth="1" />}
        </g>

        {/* --- FRONT RIGHT WHEEL & SUSPENSION --- */}
        {/* Suspension Wishbone FR */}
        <line x1="108" y1="65" x2="158" y2="60" stroke="#64748b" strokeWidth="2" />
        <line x1="108" y1="85" x2="158" y2="80" stroke="#64748b" strokeWidth="2" />
        <g
          onMouseEnter={() => handleMouseEnter('frTyre')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('frTyre')}
        >
          <rect
            x="158"
            y="48"
            width="24"
            height="48"
            rx="5"
            fill="#0f172a"
            stroke={getTyreWearColor(frWear)}
            strokeWidth={isHovered('frTyre') ? 3 : 2}
          />
          {/* Wear fill bar inside tyre */}
          <rect
            x="162"
            y={48 + 48 * (1 - frWear / 100)}
            width="16"
            height={48 * (frWear / 100)}
            rx="2"
            fill={getTyreWearColor(frWear)}
            fillOpacity="0.75"
          />
          {frDmg > 0 && <circle cx="170" cy="72" r="4" fill="#ff0055" stroke="#fff" strokeWidth="1" />}
        </g>

        {/* --- FLOOR EDGES --- */}
        <g
          onMouseEnter={() => handleMouseEnter('floor')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('floor')}
        >
          <path
            d="M 52 140 L 64 135 L 64 245 L 50 240 Z M 148 140 L 136 135 L 136 245 L 150 240 Z"
            fill={getDamageColor(floor)}
            fillOpacity={isHovered('floor') ? 0.85 : 0.45}
            stroke={isHovered('floor') ? '#fff' : 'rgba(255,255,255,0.2)'}
            strokeWidth={getStrokeWidth('floor')}
          />
        </g>

        {/* --- SIDEPODS (LEFT & RIGHT) --- */}
        <g
          onMouseEnter={() => handleMouseEnter('sidepod')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('sidepod')}
        >
          {/* Left Sidepod */}
          <path
            d="M 64 135 L 88 125 L 85 235 L 64 225 Z"
            fill={getDamageColor(sidepod)}
            fillOpacity={isHovered('sidepod') ? 0.9 : 0.6}
            stroke={isHovered('sidepod') ? '#fff' : 'rgba(255,255,255,0.25)'}
            strokeWidth={getStrokeWidth('sidepod')}
          />
          {/* Right Sidepod */}
          <path
            d="M 136 135 L 112 125 L 115 235 L 136 225 Z"
            fill={getDamageColor(sidepod)}
            fillOpacity={isHovered('sidepod') ? 0.9 : 0.6}
            stroke={isHovered('sidepod') ? '#fff' : 'rgba(255,255,255,0.25)'}
            strokeWidth={getStrokeWidth('sidepod')}
          />
        </g>

        {/* --- COCKPIT & HALO --- */}
        <ellipse cx="100" cy="135" rx="14" ry="24" fill="#090d16" stroke="#00f2fe" strokeWidth="1.5" />
        {/* Halo Protection Structure */}
        <path d="M 100 115 L 90 145 M 100 115 L 110 145 M 88 140 L 112 140" stroke="#00f2fe" strokeWidth="2.5" strokeLinecap="round" />

        {/* --- ENGINE & TRANSMISSION BAY --- */}
        <g
          onMouseEnter={() => handleMouseEnter('engine')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('engine')}
        >
          <path
            d="M 85 160 L 115 160 L 112 250 L 88 250 Z"
            fill="url(#engineGlow)"
            stroke={getDamageColor(engine)}
            strokeWidth={isHovered('engine') ? 2 : 1}
          />
          <text x="100" y="200" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.9">
            PU / ICE
          </text>
          <text x="100" y="212" fill={getDamageColor(engine)} fontSize="9" fontWeight="bold" textAnchor="middle">
            {engine}%
          </text>
        </g>

        {/* --- REAR LEFT WHEEL & SUSPENSION --- */}
        <line x1="88" y1="270" x2="42" y2="280" stroke="#64748b" strokeWidth="2.5" />
        <line x1="88" y1="295" x2="42" y2="300" stroke="#64748b" strokeWidth="2.5" />
        <g
          onMouseEnter={() => handleMouseEnter('rlTyre')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('rlTyre')}
        >
          <rect
            x="14"
            y="262"
            width="28"
            height="54"
            rx="6"
            fill="#0f172a"
            stroke={getTyreWearColor(rlWear)}
            strokeWidth={isHovered('rlTyre') ? 3 : 2}
          />
          <rect
            x="18"
            y={262 + 54 * (1 - rlWear / 100)}
            width="20"
            height={54 * (rlWear / 100)}
            rx="3"
            fill={getTyreWearColor(rlWear)}
            fillOpacity="0.75"
          />
          {rlDmg > 0 && <circle cx="28" cy="289" r="4" fill="#ff0055" stroke="#fff" strokeWidth="1" />}
        </g>

        {/* --- REAR RIGHT WHEEL & SUSPENSION --- */}
        <line x1="112" y1="270" x2="158" y2="280" stroke="#64748b" strokeWidth="2.5" />
        <line x1="112" y1="295" x2="158" y2="300" stroke="#64748b" strokeWidth="2.5" />
        <g
          onMouseEnter={() => handleMouseEnter('rrTyre')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('rrTyre')}
        >
          <rect
            x="158"
            y="262"
            width="28"
            height="54"
            rx="6"
            fill="#0f172a"
            stroke={getTyreWearColor(rrWear)}
            strokeWidth={isHovered('rrTyre') ? 3 : 2}
          />
          <rect
            x="162"
            y={262 + 54 * (1 - rrWear / 100)}
            width="20"
            height={54 * (rrWear / 100)}
            rx="3"
            fill={getTyreWearColor(rrWear)}
            fillOpacity="0.75"
          />
          {rrDmg > 0 && <circle cx="172" cy="289" r="4" fill="#ff0055" stroke="#fff" strokeWidth="1" />}
        </g>

        {/* --- DIFFUSER --- */}
        <g
          onMouseEnter={() => handleMouseEnter('diffuser')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('diffuser')}
        >
          <path
            d="M 72 315 L 128 315 L 134 338 L 66 338 Z"
            fill={getDamageColor(diffuser)}
            fillOpacity={isHovered('diffuser') ? 0.9 : 0.55}
            stroke={isHovered('diffuser') ? '#fff' : 'rgba(255,255,255,0.2)'}
            strokeWidth={getStrokeWidth('diffuser')}
          />
          {/* Diffuser strakes */}
          <line x1="88" y1="315" x2="86" y2="338" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
          <line x1="100" y1="315" x2="100" y2="338" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
          <line x1="112" y1="315" x2="114" y2="338" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        </g>

        {/* --- REAR WING --- */}
        <g
          onMouseEnter={() => handleMouseEnter('rearWing')}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer' }}
          filter={getFilter('rearWing')}
        >
          <rect
            x="40"
            y="332"
            width="120"
            height="18"
            rx="3"
            fill={getDamageColor(rearWing)}
            fillOpacity={isHovered('rearWing') ? 0.95 : 0.75}
            stroke={isHovered('rearWing') ? '#fff' : 'rgba(255,255,255,0.3)'}
            strokeWidth={getStrokeWidth('rearWing')}
          />
          {/* Endplates */}
          <rect x="36" y="325" width="6" height="28" rx="2" fill={getDamageColor(rearWing)} stroke="#fff" strokeWidth="0.5" />
          <rect x="158" y="325" width="6" height="28" rx="2" fill={getDamageColor(rearWing)} stroke="#fff" strokeWidth="0.5" />
          <text x="100" y="344" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">
            REAR WING: {rearWing}%
          </text>
        </g>
      </svg>

      {/* Dynamic Hover Tooltip Banner */}
      {activeHover && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            backgroundColor: 'rgba(9, 13, 22, 0.92)',
            border: '1px solid var(--accent-cyan, #00f2fe)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            color: '#fff',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {activeHover === 'flWing' && <span>Front Left Wing: <span style={{ color: getDamageColor(flWing) }}>{flWing}% Damage</span></span>}
          {activeHover === 'frWing' && <span>Front Right Wing: <span style={{ color: getDamageColor(frWing) }}>{frWing}% Damage</span></span>}
          {activeHover === 'flTyre' && <span>FL Tyre: <span style={{ color: getTyreWearColor(flWear) }}>{flWear.toFixed(1)}% Wear</span> | Dmg: {flDmg}%</span>}
          {activeHover === 'frTyre' && <span>FR Tyre: <span style={{ color: getTyreWearColor(frWear) }}>{frWear.toFixed(1)}% Wear</span> | Dmg: {frDmg}%</span>}
          {activeHover === 'rlTyre' && <span>RL Tyre: <span style={{ color: getTyreWearColor(rlWear) }}>{rlWear.toFixed(1)}% Wear</span> | Dmg: {rlDmg}%</span>}
          {activeHover === 'rrTyre' && <span>RR Tyre: <span style={{ color: getTyreWearColor(rrWear) }}>{rrWear.toFixed(1)}% Wear</span> | Dmg: {rrDmg}%</span>}
          {activeHover === 'sidepod' && <span>Sidepod: <span style={{ color: getDamageColor(sidepod) }}>{sidepod}% Damage</span></span>}
          {activeHover === 'floor' && <span>Floor: <span style={{ color: getDamageColor(floor) }}>{floor}% Damage</span></span>}
          {activeHover === 'engine' && <span>Power Unit / ICE: <span style={{ color: getDamageColor(engine) }}>{engine}% Wear</span> | Gearbox: {gearbox}%</span>}
          {activeHover === 'diffuser' && <span>Diffuser: <span style={{ color: getDamageColor(diffuser) }}>{diffuser}% Damage</span></span>}
          {activeHover === 'rearWing' && <span>Rear Wing: <span style={{ color: getDamageColor(rearWing) }}>{rearWing}% Damage</span></span>}
        </div>
      )}
    </div>
  );
};
