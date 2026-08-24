import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { VoiceCockpitView } from './VoiceCockpitView';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';
import { I18nProvider } from '../context/I18nProvider';

const mockRadio: UseRadioControllerReturn = {
  isRadioEnabled: true,
  setIsRadioEnabled: vi.fn(),
  radioState: 'idle',
  persona: 'bono',
  setPersona: vi.fn(),
  radioLanguage: 'auto',
  effectiveLanguage: 'en',
  setRadioLanguage: vi.fn(),
  driverCallsign: 'Lewis',
  setDriverCallsign: vi.fn(),
  customPrompt: '',
  setCustomPrompt: vi.fn(),
  beepsEnabled: true,
  setBeepsEnabled: vi.fn(),
  filterEnabled: true,
  setFilterEnabled: vi.fn(),
  staticFxEnabled: true,
  setStaticFxEnabled: vi.fn(),
  volume: 0.8,
  setVolume: vi.fn(),
  speechRate: 0,
  setSpeechRate: vi.fn(),
  speechPitch: 0,
  setSpeechPitch: vi.fn(),
  neuralVoice: 'en-GB-RyanNeural',
  setNeuralVoice: vi.fn(),
  smartDiscretionEnabled: true,
  setSmartDiscretionEnabled: vi.fn(),
  chatterCooldownSeconds: 45,
  setChatterCooldownSeconds: vi.fn(),
  triggerPreset: 'immersive',
  applyTriggerPreset: vi.fn(),
  resetTriggerDefaults: vi.fn(),
  tyreAlertsEnabled: true,
  setTyreAlertsEnabled: vi.fn(),
  thermalAlertsEnabled: true,
  setThermalAlertsEnabled: vi.fn(),
  damageAlertsEnabled: true,
  setDamageAlertsEnabled: vi.fn(),
  ersAlertsEnabled: true,
  setErsAlertsEnabled: vi.fn(),
  brakesAlertsEnabled: true,
  setBrakesAlertsEnabled: vi.fn(),
  fuelAlertsEnabled: true,
  setFuelAlertsEnabled: vi.fn(),
  rivalAlertsEnabled: true,
  setRivalAlertsEnabled: vi.fn(),
  pitWindowAlertsEnabled: true,
  setPitWindowAlertsEnabled: vi.fn(),
  trackAlertsEnabled: true,
  setTrackAlertsEnabled: vi.fn(),
  qualyAlertsEnabled: true,
  setQualyAlertsEnabled: vi.fn(),
  flagsPensAlertsEnabled: true,
  setFlagsPensAlertsEnabled: vi.fn(),
  subTyreWear: true,
  setSubTyreWear: vi.fn(),
  subTyrePuncture: true,
  setSubTyrePuncture: vi.fn(),
  subTyreThermal: true,
  setSubTyreThermal: vi.fn(),
  subTyreCold: true,
  setSubTyreCold: vi.fn(),
  subDamageWing: true,
  setSubDamageWing: vi.fn(),
  subDamageFloor: true,
  setSubDamageFloor: vi.fn(),
  subDamageEngine: true,
  setSubDamageEngine: vi.fn(),
  subDamageFaults: true,
  setSubDamageFaults: vi.fn(),
  subErsLow: true,
  setSubErsLow: vi.fn(),
  subEngineTemp: true,
  setSubEngineTemp: vi.fn(),
  subBrakeTemp: true,
  setSubBrakeTemp: vi.fn(),
  subBrakeCold: true,
  setSubBrakeCold: vi.fn(),
  subFuelDelta: true,
  setSubFuelDelta: vi.fn(),
  subUndercut: true,
  setSubUndercut: vi.fn(),
  subPitWindow: true,
  setSubPitWindow: vi.fn(),
  subRivalDefend: true,
  setSubRivalDefend: vi.fn(),
  subRivalAttack: true,
  setSubRivalAttack: vi.fn(),
  subQualyTraffic: true,
  setSubQualyTraffic: vi.fn(),
  subQualyInvalid: true,
  setSubQualyInvalid: vi.fn(),
  subQualyTime: true,
  setSubQualyTime: vi.fn(),
  subQualyElim: true,
  setSubQualyElim: vi.fn(),
  subSafetyCar: true,
  setSubSafetyCar: vi.fn(),
  subRedFlag: true,
  setSubRedFlag: vi.fn(),
  subRain: true,
  setSubRain: vi.fn(),
  subTrackLimits: true,
  setSubTrackLimits: vi.fn(),
  subPenalties: true,
  setSubPenalties: vi.fn(),
  tyreWearWarningPct: 40,
  setTyreWearWarningPct: vi.fn(),
  tyreWearCriticalPct: 75,
  setTyreWearCriticalPct: vi.fn(),
  tyreOverheatC: 115,
  setTyreOverheatC: vi.fn(),
  tyreColdC: 85,
  setTyreColdC: vi.fn(),
  wingDamageWarnPct: 20,
  setWingDamageWarnPct: vi.fn(),
  floorDamageWarnPct: 25,
  setFloorDamageWarnPct: vi.fn(),
  engineWearWarnPct: 70,
  setEngineWearWarnPct: vi.fn(),
  ersLowPct: 15,
  setErsLowPct: vi.fn(),
  engineOverheatC: 125,
  setEngineOverheatC: vi.fn(),
  brakeOverheatC: 900,
  setBrakeOverheatC: vi.fn(),
  brakeColdC: 200,
  setBrakeColdC: vi.fn(),
  fuelDeltaLaps: -0.5,
  setFuelDeltaLaps: vi.fn(),
  undercutGapSec: 2.5,
  setUndercutGapSec: vi.fn(),
  rivalGapThresholdSec: 1.0,
  setRivalGapThresholdSec: vi.fn(),
  rivalAheadGapSec: 1.2,
  setRivalAheadGapSec: vi.fn(),
  qualyCleanAirSec: 4.0,
  setQualyCleanAirSec: vi.fn(),
  cornerCutWarnThreshold: 2,
  setCornerCutWarnThreshold: vi.fn(),
  rainHorizonMin: 5,
  setRainHorizonMin: vi.fn(),
  rainProbPct: 50,
  setRainProbPct: vi.fn(),
  lastTranscript: '',
  lastResponse: 'Box this lap, box box.',
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
  testRadioTransmission: vi.fn(),
  testTriggerAlert: vi.fn(),
  stopRadio: vi.fn(),
  speakMessage: vi.fn(),
};


const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe('VoiceCockpitView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle persona info and dialogue transcript', () => {
    renderWithI18n(
      <VoiceCockpitView
        radio={mockRadio}
        session={{
          TrackId: 0,
          SessionType: 15,
          Weather: 0,
          TrackTemperature: 30,
          AirTemperature: 22,
          TotalLaps: 58,
          TrackLength: 5303,
          SessionTimeLeft: 3600,
          SessionDuration: 7200,
          SafetyCarStatus: 0,
        }}
        lap={{
          CarPosition: 1,
          CurrentLapNum: 12,
          DriverStatus: 1,
          CurrentLapInvalid: 0,
          Penalties: 0,
          CornerCuttingWarnings: 1,
        } as any}
        carStatus={{
          ActualTyreCompound: 16,
          TyresAgeLaps: 12,
          ERSStoreEnergy: 3200000,
          FuelRemainingLaps: 1.2,
        } as any}
        carDamage={{
          TyresWear: [25, 28, 30, 32],
          FrontLeftWingDamage: 0,
          FrontRightWingDamage: 0,
          FloorDamage: 0,
        } as any}
        telemetry={{
          TyresSurfaceTemperature: [102, 104, 98, 99],
          EngineTemperature: 110,
        } as any}
        connected={true}
      />
    );

    expect(screen.getByText(/Peter "Bono" Bonnington/i)).toBeInTheDocument();
    expect(screen.getByText(/Box this lap, box box/i)).toBeInTheDocument();
    expect(screen.getByText(/RADIO CHANNEL CLEAR • STANDBY/i)).toBeInTheDocument();
    expect(screen.getByText(/12 \/ 58/i)).toBeInTheDocument();
    expect(screen.getByText(/80%/i)).toBeInTheDocument(); // 3.2M / 4M ERS
    expect(screen.getByText(/\+1.2 Laps/i)).toBeInTheDocument();
    expect(screen.getByText(/NOMINAL/i)).toBeInTheDocument();
  });

  it('renders transmitting state when driver is speaking into radio', () => {
    const transmittingRadio = {
      ...mockRadio,
      radioState: 'transmitting' as const,
      lastTranscript: 'How is the gap behind',
    };

    renderWithI18n(
      <VoiceCockpitView
        radio={transmittingRadio}
        session={null}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={false}
      />
    );

    expect(screen.getByText(/TRANSMITTING TO PIT WALL/i)).toBeInTheDocument();
    expect(screen.getByText(/"How is the gap behind..."/i)).toBeInTheDocument();
  });

  it('renders speaking state when engineer replies', () => {
    const speakingRadio = {
      ...mockRadio,
      radioState: 'speaking' as const,
      lastResponse: 'Gap behind is 2.4 seconds to Norris',
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

    expect(screen.getByText(/TRANSMITTING ON RADIO/i)).toBeInTheDocument();
    expect(screen.getByText(/"Gap behind is 2.4 seconds to Norris"/i)).toBeInTheDocument();
  });

  it('handles volume mute, power toggle, and settings button clicks', () => {
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
    expect(mockRadio.setVolume).toHaveBeenCalledWith(0);

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
        session={{
          TrackId: 0,
          SafetyCarStatus: 1, // Full SC
        } as any}
        lap={null}
        carStatus={null}
        carDamage={null}
        telemetry={null}
        connected={true}
      />
    );

    expect(screen.getByText(/SAFETY CAR DEPLOYED — DELTA POSITIVE/i)).toBeInTheDocument();
  });

  it('displays standby panel when disconnected or waiting for session', () => {
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

    expect(screen.getByTestId('voice-cockpit-standby-panel')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for Live Session Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/UDP TELEMETRY BRIDGE/i)).toBeInTheDocument();
  });

  it('displays aero damage when present in an active session', () => {
    renderWithI18n(
      <VoiceCockpitView
        radio={mockRadio}
        session={{
          TrackId: 0,
          TotalLaps: 58,
          SessionType: 15,
        } as any}
        lap={{
          CarPosition: 2,
          CurrentLapNum: 5,
        } as any}
        carStatus={{
          ActualTyreCompound: 16,
          TyresAgeLaps: 5,
        } as any}
        carDamage={{
          TyresWear: [45, 50, 42, 44],
          FrontLeftWingDamage: 35,
          FrontRightWingDamage: 10,
          FloorDamage: 15,
        } as any}
        telemetry={null}
        connected={true}
      />
    );

    expect(screen.getByTestId('voice-cockpit-vitals-grid')).toBeInTheDocument();
    expect(screen.getByText(/Front Wing/i)).toBeInTheDocument();
    expect(screen.getByText(/35% \/ 10%/i)).toBeInTheDocument();
    expect(screen.getByText(/15%/i)).toBeInTheDocument();
  });
});


