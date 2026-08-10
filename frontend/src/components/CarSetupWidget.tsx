import React from 'react';
import { Sliders, Wrench, Shield, Disc, CircleDot, Fuel } from 'lucide-react';
import type { CarSetupData } from '../hooks/useTelemetry';

interface CarSetupWidgetProps {
  carSetup: CarSetupData | null;
  driverName?: string;
}

export const CarSetupWidget: React.FC<CarSetupWidgetProps> = ({ carSetup, driverName }) => {
  if (!carSetup) {
    return (
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', marginBottom: '0.75rem' }}>
          <Sliders size={18} /> Car Setup Configuration {driverName ? `(${driverName})` : ''}
        </h3>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          No car setup telemetry received yet for this car.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', margin: 0 }}>
          <Sliders size={18} color="var(--accent-cyan, #00f2fe)" /> Car Setup Configuration {driverName ? `(${driverName})` : ''}
        </h3>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-cyan, #00f2fe)', fontWeight: 600 }}>
          Telemetry Packet #5
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {/* 1. Aerodynamics & Fuel */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Shield size={14} color="#38ef7d" /> Aero & Weight
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Front Wing</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.FrontWing}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rear Wing</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.RearWing}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Fuel size={12} /> Fuel Load
              </span>
              <span className="mono" style={{ fontWeight: 600, color: '#38ef7d' }}>
                {carSetup.FuelLoad !== undefined ? carSetup.FuelLoad.toFixed(1) : '0.0'} kg
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ballast</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.Ballast}</span>
            </div>
          </div>
        </div>

        {/* 2. Transmission & Brakes */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Disc size={14} color="#ff4e50" /> Transmission & Brakes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Diff On-Throttle</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.OnThrottle}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Diff Off-Throttle</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.OffThrottle}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Brake Pressure</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.BrakePressure}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Brake Bias</span>
              <span className="mono" style={{ fontWeight: 600, color: '#ff4e50' }}>{carSetup.BrakeBias}%</span>
            </div>
          </div>
        </div>

        {/* 3. Suspension & ARB */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Wrench size={14} color="#f8d030" /> Suspension & ARB
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F / R Suspension</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.FrontSuspension} / {carSetup.RearSuspension}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F / R Anti-Roll Bar</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.FrontAntiRollBar} / {carSetup.RearAntiRollBar}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F / R Ride Height</span>
              <span className="mono" style={{ fontWeight: 600 }}>{carSetup.FrontSuspensionHeight} / {carSetup.RearSuspensionHeight}</span>
            </div>
          </div>
        </div>

        {/* 4. Geometry & Tyres */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <CircleDot size={14} color="#00f2fe" /> Geometry & Tyres
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F / R Camber</span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {carSetup.FrontCamber !== undefined ? carSetup.FrontCamber.toFixed(2) : '0.00'}° / {carSetup.RearCamber !== undefined ? carSetup.RearCamber.toFixed(2) : '0.00'}°
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F / R Toe</span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {carSetup.FrontToe !== undefined ? carSetup.FrontToe.toFixed(2) : '0.00'}° / {carSetup.RearToe !== undefined ? carSetup.RearToe.toFixed(2) : '0.00'}°
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F / R Tyre PSI</span>
              <span className="mono" style={{ fontWeight: 600, color: '#00f2fe' }}>
                {carSetup.FrontTyrePressure !== undefined ? carSetup.FrontTyrePressure.toFixed(1) : '0.0'} / {carSetup.RearTyrePressure !== undefined ? carSetup.RearTyrePressure.toFixed(1) : '0.0'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
