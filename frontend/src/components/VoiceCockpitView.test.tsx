import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VoiceCockpitView } from './VoiceCockpitView';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import { I18nProvider } from '../context/I18nProvider';
import { useRadioSettingsStore } from '../store/useRadioSettingsStore';
import { makeLiveCarDamage, makeLiveCarStatus, makeLiveCarTelemetry2, makeLiveLap, makeLiveSession } from '../test/wireFactories';

const mockRadio: UseRadioControllerReturn = {
  isRadioEnabled: true,
  setIsRadioEnabled: vi.fn(),
  radioState: 'idle',
  persona: 'bono',
  effectiveLanguage: 'en',
  driverCallsign: 'Lewis',
  lastTranscript: null,
  lastResponse: null,
  error: null,
  isPTTActive: false,
  isLearning: false,
  startLearning: vi.fn(),
  cancelLearning: vi.fn(),
  mappedGamepadButton: null,
  setMappedGamepadButton: vi.fn(),
  mappedKey: 'Space',
  setMappedKey: vi.fn(),
  gamepadConnected: false,
  gamepadName: null,
  pttMode: 'hold',
  setPTTMode: vi.fn(),
  globalActive: false,
  globalMapping: null,
  testRadioTransmission: vi.fn().mockResolvedValue(undefined),
  testTriggerAlert: vi.fn().mockResolvedValue(undefined),
  stopRadio: vi.fn(),
  speakMessage: vi.fn().mockResolvedValue(undefined),
  onPTTPress: vi.fn(),
  onPTTRelease: vi.fn().mockResolvedValue(undefined),
};

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe('VoiceCockpitView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRadioSettingsStore.getState().resetStoreToDefaults();
  });

  it('renders hero voice persona badge with active persona', () => {
    renderWithI18n(
      <VoiceCockpitView
        radio={mockRadio}
        session={null}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={true}
      />
    );

    expect(screen.getByTestId('voice-cockpit-container')).toBeInTheDocument();
    expect(screen.getAllByText(/Bono/i).length).toBeGreaterThan(0);
    expect(screen.getByText('🇬🇧')).toBeInTheDocument();
  });

  it('renders speech recognition transcript when transmitting', () => {
    const transmittingRadio = {
      ...mockRadio,
      radioState: 'transmitting' as const,
      lastTranscript: 'What is my gap to the leader?',
    };

    renderWithI18n(
      <VoiceCockpitView
        radio={transmittingRadio}
        session={null}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={true}
      />
    );

    expect(screen.getByText(/What is my gap to the leader\?/i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSMITTING/i)).toBeInTheDocument();
  });

  it('renders engineer response dialogue bubble when speaking', () => {
    const speakingRadio = {
      ...mockRadio,
      radioState: 'speaking' as const,
      lastResponse: 'Gap is 3.2 seconds, you are matching his pace.',
    };

    renderWithI18n(
      <VoiceCockpitView
        radio={speakingRadio}
        session={null}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={true}
      />
    );

    expect(screen.getByText(/Gap is 3.2 seconds, you are matching his pace\./i)).toBeInTheDocument();
    expect(screen.getByText(/TRANSMITTING ON RADIO/i)).toBeInTheDocument();
  });

  it('shows why the last transmission did not get through, over the last pit wall call', () => {
    const radio = {
      ...mockRadio,
      lastResponse: 'Box this lap.',
      error: 'Edge stopped listening while the game was in front.',
    };

    renderWithI18n(
      <VoiceCockpitView
        radio={radio}
        session={null}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={true}
      />
    );

    expect(screen.getByText('Edge stopped listening while the game was in front.')).toBeInTheDocument();
    expect(screen.queryByText(/Box this lap/)).not.toBeInTheDocument();
  });

  it('renders vital telemetry strip with position, lap, tyre, fuel, ERS, and damage', () => {
    const mockSession = makeLiveSession({
      TrackId: 0,
      TotalLaps: 58,
      SafetyCarStatus: 0,
    });

    const mockLap = makeLiveLap({
      CarPosition: 3,
      CurrentLapNum: 14,
    });

    const mockCarStatus = makeLiveCarStatus({
      VisualTyreCompound: 17, // Medium
      TyresAgeLaps: 12,
      FuelRemainingLaps: 1.4,
      ERSStoreEnergy: 2800000,
    });

    const mockCarDamage = makeLiveCarDamage({
      TyresWear: [18.4, 22.1, 15.0, 19.8],
      FrontLeftWingDamage: 5,
      FrontRightWingDamage: 0,
      FloorDamage: 12,
      DiffuserDamage: 0,
    });

    renderWithI18n(
      <VoiceCockpitView
        radio={mockRadio}
        session={mockSession}
        lap={mockLap}
        carStatus={mockCarStatus}
        carDamage={mockCarDamage}
        telemetry={null}
        connected={true}
      />
    );

    // Position P3
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    // Lap 14 / 58
    expect(screen.getByText('14 / 58')).toBeInTheDocument();
    // Compound M
    expect(screen.getByText('M')).toBeInTheDocument();
    // Tyre age 12 L
    expect(screen.getByText('12 L')).toBeInTheDocument();
    // Max tyre wear (22.1% -> 22%)
    expect(screen.getByText(/Peak: 22%/i)).toBeInTheDocument();
    // Wheel arrays are RL, RR, FL, FR: the corners read FL 15%, FR 20%, RL 18%, RR 22%
    const corner = (label: string) => screen.getByText(label, { selector: 'span' }).closest('li');
    expect(corner('FL')).toHaveTextContent('15%');
    expect(corner('FR')).toHaveTextContent('20%');
    expect(corner('RL')).toHaveTextContent('18%');
    expect(corner('RR')).toHaveTextContent('22%');
    // Fuel +1.4 Laps
    expect(screen.getByText('+1.4 Laps')).toBeInTheDocument();
    // ERS 70%
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('renders Active Aero straight mode for 2026 sessions', () => {
    const mockSession = makeLiveSession({
      TrackId: 0,
      TotalLaps: 58,
      SafetyCarStatus: 0,
      PacketFormat: 2026,
    });

    const mockTelemetry2 = makeLiveCarTelemetry2({
      ActiveAeroMode: 1, // Straight mode active
    });

    renderWithI18n(
      <VoiceCockpitView
        radio={mockRadio}
        session={mockSession}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        telemetry2={mockTelemetry2}
        packetFormat={2026}
        connected={true}
      />
    );

    expect(screen.getByText('STRAIGHT AERO')).toBeInTheDocument();
  });

  it('renders quick action control buttons (Mute, Power, Settings)', () => {
    useRadioSettingsStore.setState({ volume: 0.8 });
    renderWithI18n(
      <VoiceCockpitView
        radio={mockRadio}
        session={null}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={true}
      />
    );

    // Mute button
    const muteBtn = screen.getByTestId('voice-cockpit-mute-btn');
    fireEvent.click(muteBtn);
    expect(useRadioSettingsStore.getState().volume).toBe(0);

    // Power button
    const powerBtn = screen.getByTestId('voice-cockpit-power-btn');
    fireEvent.click(powerBtn);
    expect(mockRadio.setIsRadioEnabled).toHaveBeenCalledWith(false);

    // Settings modal button
    const settingsBtn = screen.getByTestId('voice-cockpit-settings-btn');
    fireEvent.click(settingsBtn);
    expect(screen.getByText(/Pit Wall Strategist/i)).toBeInTheDocument();
  });

  it('displays safety car banner when active in session', () => {
    renderWithI18n(
      <VoiceCockpitView
        radio={mockRadio}
        session={makeLiveSession({
          TrackId: 0,
          SafetyCarStatus: 1, // Full SC
        })}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={true}
      />
    );

    expect(screen.getByText(/SAFETY CAR DEPLOYED — DELTA POSITIVE/i)).toBeInTheDocument();
  });
});
