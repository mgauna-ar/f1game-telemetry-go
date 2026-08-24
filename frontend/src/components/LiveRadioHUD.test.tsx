import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LiveRadioHUD } from './LiveRadioHUD';
import { I18nProvider } from '../context/I18nProvider';
import { RADIO_PERSONAS } from '../constants/f1';
import type { UseRadioControllerReturn } from '../hooks/useRadioController';

const mockRadio: UseRadioControllerReturn = {
  radioState: 'idle',
  isRadioEnabled: true,
  setIsRadioEnabled: vi.fn(),
  persona: RADIO_PERSONAS.COLAPINTO,
  setPersona: vi.fn(),
  radioLanguage: 'auto',
  setRadioLanguage: vi.fn(),
  effectiveLanguage: 'es',
  customPrompt: '',
  setCustomPrompt: vi.fn(),
  beepsEnabled: true,
  setBeepsEnabled: vi.fn(),
  filterEnabled: true,
  setFilterEnabled: vi.fn(),
  volume: 0.8,
  setVolume: vi.fn(),
  neuralVoice: '',
  setNeuralVoice: vi.fn(),
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
  driverCallsign: '',
  setDriverCallsign: vi.fn(),
  staticFxEnabled: true,
  setStaticFxEnabled: vi.fn(),
  speechRate: 0,
  setSpeechRate: vi.fn(),
  speechPitch: 0,
  setSpeechPitch: vi.fn(),
  smartDiscretionEnabled: true,
  setSmartDiscretionEnabled: vi.fn(),
  chatterCooldownSeconds: 45,
  setChatterCooldownSeconds: vi.fn(),
  tyreWearWarningPct: 40,
  setTyreWearWarningPct: vi.fn(),
  tyreWearCriticalPct: 75,
  setTyreWearCriticalPct: vi.fn(),
  rivalGapThresholdSec: 1.0,
  setRivalGapThresholdSec: vi.fn(),
  rainHorizonMin: 5,
  setRainHorizonMin: vi.fn(),
  tyreAlertsEnabled: true,
  setTyreAlertsEnabled: vi.fn(),
  thermalAlertsEnabled: true,
  setThermalAlertsEnabled: vi.fn(),
  rivalAlertsEnabled: true,
  setRivalAlertsEnabled: vi.fn(),
  pitWindowAlertsEnabled: true,
  setPitWindowAlertsEnabled: vi.fn(),
  trackAlertsEnabled: true,
  setTrackAlertsEnabled: vi.fn(),
  testRadioTransmission: vi.fn().mockResolvedValue(undefined),
  stopRadio: vi.fn(),
  speakMessage: vi.fn().mockResolvedValue(undefined),
};

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe('LiveRadioHUD Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle standby state with Colapinto flag and PTT key', () => {
    renderWithI18n(<LiveRadioHUD radio={mockRadio} />);

    expect(screen.getByText(/RADIO STANDBY|RADIO EN ESPERA/i)).toBeInTheDocument();
    expect(screen.getByText('🇦🇷')).toBeInTheDocument();
    expect(screen.getByText('Space')).toBeInTheDocument();
  });

  it('renders compact minimized pill when radio is disabled (OFF)', () => {
    const disabledRadio = {
      ...mockRadio,
      isRadioEnabled: false,
    };

    renderWithI18n(<LiveRadioHUD radio={disabledRadio} />);

    const turnOnBtn = screen.getByTitle(/Turn On Radio|Encender Radio/i);
    expect(turnOnBtn).toBeInTheDocument();
    expect(screen.getByText(/Turn On Radio|Encender Radio/i)).toBeInTheDocument();

    fireEvent.click(turnOnBtn);
    expect(mockRadio.setIsRadioEnabled).toHaveBeenCalledWith(true);
  });

  it('renders transmitting state when PTT is active', () => {
    const transmittingRadio = {
      ...mockRadio,
      radioState: 'transmitting' as const,
      lastTranscript: 'Box this lap',
    };

    renderWithI18n(<LiveRadioHUD radio={transmittingRadio} />);

    expect(screen.getByText(/TRANSMITTING|TRANSMITIENDO/i)).toBeInTheDocument();
    expect(screen.getByText(/Box this lap/i)).toBeInTheDocument();
  });

  it('renders speaking state when engineer is speaking', () => {
    const speakingRadio = {
      ...mockRadio,
      radioState: 'speaking' as const,
      lastResponse: 'Copy, boxing this lap.',
    };

    renderWithI18n(<LiveRadioHUD radio={speakingRadio} />);

    expect(screen.getByText(/SPEAKING|HABLANDO/i)).toBeInTheDocument();
    expect(screen.getByText(/"Copy, boxing this lap."/i)).toBeInTheDocument();
  });

  it('turns off radio on power button click', () => {
    renderWithI18n(<LiveRadioHUD radio={mockRadio} />);

    const powerBtn = screen.getByTitle(/Turn Off Radio|Apagar Radio/i);
    fireEvent.click(powerBtn);

    expect(mockRadio.setIsRadioEnabled).toHaveBeenCalledWith(false);
  });

  it('mutes audio volume on volume button click', () => {
    renderWithI18n(<LiveRadioHUD radio={mockRadio} />);

    const muteBtn = screen.getByTitle(/Mute Radio|Silenciar Radio/i);
    fireEvent.click(muteBtn);

    expect(mockRadio.setVolume).toHaveBeenCalledWith(0);
  });

  it('opens and closes settings panel', () => {
    renderWithI18n(<LiveRadioHUD radio={mockRadio} />);

    const settingsBtn = screen.getByTitle(/Radio Settings|Configuración de Radio/i);
    fireEvent.click(settingsBtn);

    expect(screen.getByText(/Franco Colapinto/i)).toBeInTheDocument();
    expect(screen.getByText(/Peter "Bono" Bonnington/i)).toBeInTheDocument();

    const closeBtn = screen.getByTitle(/Close|Cerrar/i);
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Franco Colapinto/i)).not.toBeInTheDocument();
  });
});
