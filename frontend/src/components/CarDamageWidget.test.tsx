import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CarDamageWidget } from './CarDamageWidget';
import type { CarDamageData } from '../hooks/useTelemetry';

describe('CarDamageWidget', () => {
  const mockCarDamage: CarDamageData = {
    TyresWear: [15.5, 18.2, 45.0, 78.5], // RL, RR, FL, FR
    TyresDamage: [0, 0, 10, 25],
    BrakesDamage: [5, 5, 15, 30],
    FrontLeftWingDamage: 35,
    FrontRightWingDamage: 0,
    RearWingDamage: 12,
    FloorDamage: 5,
    DiffuserDamage: 0,
    SidepodDamage: 20,
    DRSFault: 0,
    ERSFault: 1,
    GearBoxDamage: 10,
    EngineDamage: 25,
    EngineMGUHWear: 15,
    EngineESWear: 5,
    EngineCEWear: 8,
    EngineICEWear: 30,
    EngineMGUKWear: 12,
    EngineTCWear: 18,
    EngineBlown: 0,
    EngineSeized: 0,
  };

  it('renders placeholder message when carDamage is null', () => {
    render(<CarDamageWidget carDamage={null} driverName="Max Verstappen" />);
    expect(screen.getByText(/No damage or wear telemetry received yet/i)).toBeInTheDocument();
  });

  it('renders tire wear percentages, aero damage, and fault banners correctly', () => {
    render(<CarDamageWidget carDamage={mockCarDamage} driverName="Max Verstappen" />);

    // Driver name header
    expect(screen.getByText(/Car Damage & Tyre Wear \(Max Verstappen\)/i)).toBeInTheDocument();

    // Tire Wear percentages
    expect(screen.getByText('45%')).toBeInTheDocument(); // FL (TyresWear[2])
    expect(screen.getByText('79%')).toBeInTheDocument(); // FR (TyresWear[3])
    expect(screen.getByText('16%')).toBeInTheDocument(); // RL (TyresWear[0])
    expect(screen.getAllByText('18%').length).toBeGreaterThan(0); // RR (TyresWear[1]) & EngineTCWear

    // Aero Damage percentages
    expect(screen.getByText('35%')).toBeInTheDocument(); // FL Wing
    expect(screen.getAllByText('12%').length).toBeGreaterThan(0); // Rear Wing & EngineMGUKWear

    // Fault banner
    expect(screen.getByText(/ERS FAULT/i)).toBeInTheDocument();
  });
});
