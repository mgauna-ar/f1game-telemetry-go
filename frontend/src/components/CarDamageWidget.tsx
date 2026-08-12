import React, { useState } from 'react';
import { ShieldAlert, Disc, Cpu, Wind, AlertTriangle } from 'lucide-react';
import type { CarDamageData } from '../hooks/useTelemetry';
import { F1CarSchematic } from './F1CarSchematic';

interface CarDamageWidgetProps {
  carDamage: CarDamageData | null;
  driverName?: string;
}

export const CarDamageWidget: React.FC<CarDamageWidgetProps> = ({ carDamage, driverName }) => {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  if (!carDamage) {
    return (
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '0.75rem' }}>
          <ShieldAlert size={18} color="var(--accent-cyan, #00f2fe)" /> Car Damage & Tyre Wear {driverName ? `(${driverName})` : ''}
        </h3>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          No damage or wear telemetry received yet for this car.
        </div>
      </div>
    );
  }

  // F1 Telemetry Tyre indexing: 0 = RL, 1 = RR, 2 = FL, 3 = FR
  const tyres = [
    { key: 'FL', partId: 'flTyre', name: 'Front Left', wear: carDamage.TyresWear[2] ?? 0, damage: carDamage.TyresDamage[2] ?? 0, brakeDamage: carDamage.BrakesDamage[2] ?? 0 },
    { key: 'FR', partId: 'frTyre', name: 'Front Right', wear: carDamage.TyresWear[3] ?? 0, damage: carDamage.TyresDamage[3] ?? 0, brakeDamage: carDamage.BrakesDamage[3] ?? 0 },
    { key: 'RL', partId: 'rlTyre', name: 'Rear Left', wear: carDamage.TyresWear[0] ?? 0, damage: carDamage.TyresDamage[0] ?? 0, brakeDamage: carDamage.BrakesDamage[0] ?? 0 },
    { key: 'RR', partId: 'rrTyre', name: 'Rear Right', wear: carDamage.TyresWear[1] ?? 0, damage: carDamage.TyresDamage[1] ?? 0, brakeDamage: carDamage.BrakesDamage[1] ?? 0 },
  ];

  const getWearColor = (wear: number) => {
    if (wear >= 75) return '#ff0055'; // Critical
    if (wear >= 50) return '#ff7700'; // High
    if (wear >= 25) return '#ffcc00'; // Moderate
    return '#00ff88'; // Good
  };

  const getDamageColor = (dmg: number) => {
    if (dmg >= 50) return '#ff0055';
    if (dmg > 0) return '#ffaa00';
    return '#00ff88';
  };

  const aeroItems = [
    { label: 'FL Wing', partId: 'flWing', val: carDamage.FrontLeftWingDamage },
    { label: 'FR Wing', partId: 'frWing', val: carDamage.FrontRightWingDamage },
    { label: 'Rear Wing', partId: 'rearWing', val: carDamage.RearWingDamage },
    { label: 'Floor', partId: 'floor', val: carDamage.FloorDamage },
    { label: 'Diffuser', partId: 'diffuser', val: carDamage.DiffuserDamage },
    { label: 'Sidepod', partId: 'sidepod', val: carDamage.SidepodDamage },
  ];

  const engineItems = [
    { label: 'Engine', partId: 'engine', val: carDamage.EngineDamage },
    { label: 'Gearbox', partId: 'engine', val: carDamage.GearBoxDamage },
    { label: 'ICE', partId: 'engine', val: carDamage.EngineICEWear },
    { label: 'TC (Turbo)', partId: 'engine', val: carDamage.EngineTCWear },
    { label: 'MGU-K', partId: 'engine', val: carDamage.EngineMGUKWear },
    { label: 'MGU-H', partId: 'engine', val: carDamage.EngineMGUHWear },
    { label: 'Energy Store', partId: 'engine', val: carDamage.EngineESWear },
    { label: 'Control Elect.', partId: 'engine', val: carDamage.EngineCEWear },
  ];

  const hasFaults = carDamage.DRSFault > 0 || carDamage.ERSFault > 0 || carDamage.EngineBlown > 0 || carDamage.EngineSeized > 0;

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', margin: 0 }}>
          <ShieldAlert size={18} color="var(--accent-cyan, #00f2fe)" /> Car Damage & Tyre Wear {driverName ? `(${driverName})` : ''}
        </h3>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan, #00f2fe)', fontWeight: 600 }}>
          Live Dynamic Heatmap
        </span>
      </div>

      {/* Fault Alerts Banner if any fault exists */}
      {hasFaults && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 12px',
          marginBottom: '1rem',
          borderRadius: '6px',
          backgroundColor: 'rgba(255, 0, 85, 0.15)',
          border: '1px solid rgba(255, 0, 85, 0.4)',
        }}>
          {carDamage.EngineBlown > 0 && <span style={{ color: '#ff0055', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> ENGINE BLOWN</span>}
          {carDamage.EngineSeized > 0 && <span style={{ color: '#ff0055', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> ENGINE SEIZED</span>}
          {carDamage.DRSFault > 0 && <span style={{ color: '#ffaa00', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> DRS FAULT</span>}
          {carDamage.ERSFault > 0 && <span style={{ color: '#ffaa00', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> ERS FAULT</span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem', alignItems: 'center' }}>
        {/* Left Column: Visual Top-Down F1 Car SVG Diagram (Span 5) */}
        <div style={{ gridColumn: 'span 5', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.04)' }}>
          <F1CarSchematic
            carDamage={carDamage}
            hoveredPart={hoveredPart}
            onHoverPart={setHoveredPart}
          />
        </div>

        {/* Right Column: Detailed Telemetry Cards (Span 7) */}
        <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Tyres Section */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Disc size={14} color="#00f2fe" /> TYRE WEAR & BRAKES
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {tyres.map((tyre) => {
                const wearVal = Math.min(100, Math.max(0, Math.round(tyre.wear)));
                const wearColor = getWearColor(wearVal);
                const isHovered = hoveredPart === tyre.partId;
                return (
                  <div
                    key={tyre.key}
                    onMouseEnter={() => setHoveredPart(tyre.partId)}
                    onMouseLeave={() => setHoveredPart(null)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: isHovered ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isHovered ? 'var(--accent-cyan, #00f2fe)' : wearVal > 50 ? wearColor : 'rgba(255, 255, 255, 0.08)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>{tyre.key} ({tyre.name})</span>
                      <span className="mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: wearColor }}>{wearVal}%</span>
                    </div>
                    
                    {/* Wear Bar */}
                    <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${wearVal}%`, height: '100%', backgroundColor: wearColor, transition: 'width 0.3s ease' }} />
                    </div>

                    {/* Brake Damage line */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span>Brake Wear:</span>
                      <span className="mono" style={{ color: getDamageColor(tyre.brakeDamage) }}>{tyre.brakeDamage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aero Section */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wind size={14} color="#00f2fe" /> AERODYNAMICS & BODYWORK
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
              {aeroItems.map((item) => {
                const isHovered = hoveredPart === item.partId;
                return (
                  <div
                    key={item.label}
                    onMouseEnter={() => setHoveredPart(item.partId)}
                    onMouseLeave={() => setHoveredPart(null)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '4px',
                      backgroundColor: isHovered ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isHovered ? 'var(--accent-cyan, #00f2fe)' : 'rgba(255, 255, 255, 0.06)'}`,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{item.label}</div>
                    <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: getDamageColor(item.val) }}>
                      {item.val}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Engine & Powertrain Section */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={14} color="#00f2fe" /> POWERTRAIN WEAR
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
              {engineItems.map((item, idx) => {
                const isHovered = hoveredPart === item.partId;
                return (
                  <div
                    key={`${item.label}-${idx}`}
                    onMouseEnter={() => setHoveredPart(item.partId)}
                    onMouseLeave={() => setHoveredPart(null)}
                    style={{
                      padding: '5px 6px',
                      borderRadius: '4px',
                      backgroundColor: isHovered ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isHovered ? 'var(--accent-cyan, #00f2fe)' : 'rgba(255, 255, 255, 0.06)'}`,
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </div>
                    <div className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: getDamageColor(item.val) }}>
                      {item.val}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
