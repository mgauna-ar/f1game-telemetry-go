import { describe, it, expect } from 'vitest';
import { getLocalizedRaceEventDescription, getLocalizedPenaltyTag } from './raceEvents';
import { getTranslation } from '../locales';
import type { RaceEvent } from '../types/telemetry';
import { SAFETY_CAR_STATUS } from '../constants/f1';

describe('raceEvents utility with i18n', () => {
  const tEn = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
  const tEs = (key: string, params?: Record<string, string | number>) => getTranslation('es', key, params);

  it('formats warning event with track limits infringement in EN and ES', () => {
    const evt: RaceEvent = {
      id: '1',
      timestamp: Date.now(),
      eventCode: 'PENA',
      type: 'penalty',
      driverName: 'LC-Nico.23',
      penaltyType: 5,
      infringementType: 23,
      penaltyTime: 255,
      description: 'fallback',
      severity: 'warning',
    };

    expect(getLocalizedRaceEventDescription(evt, tEn)).toBe('LC-Nico.23 received a warning (Track limits)');
    expect(getLocalizedRaceEventDescription(evt, tEs)).toBe('LC-Nico.23 recibió una advertencia (Límites de pista)');
    expect(getLocalizedPenaltyTag(evt, tEn)).toBe('WARNING');
    expect(getLocalizedPenaltyTag(evt, tEs)).toBe('ADVERTENCIA');
  });

  it('formats time penalty event gracefully without 255s bug', () => {
    const evt: RaceEvent = {
      id: '2',
      timestamp: Date.now(),
      eventCode: 'PENA',
      type: 'penalty',
      driverName: 'Max Verstappen',
      penaltyType: 4,
      infringementType: 6,
      penaltyTime: 5,
      description: 'fallback',
      severity: 'danger',
    };

    expect(getLocalizedRaceEventDescription(evt, tEn)).toBe('Max Verstappen received a 5s time penalty (Corner cutting gained time)');
    expect(getLocalizedRaceEventDescription(evt, tEs)).toBe('Max Verstappen sancionado con 5s de recargo (Corte de curva con ganancia de tiempo)');
    expect(getLocalizedPenaltyTag(evt, tEn)).toBe('5S TIME PENALTY');
    expect(getLocalizedPenaltyTag(evt, tEs)).toBe('5S RECARGO DE TIEMPO');
  });

  it('formats drive through and stop & go penalties', () => {
    const dtEvt: RaceEvent = {
      id: '3',
      timestamp: Date.now(),
      eventCode: 'PENA',
      type: 'penalty',
      driverName: 'Lando Norris',
      penaltyType: 0,
      penaltyTime: 255,
      description: 'fallback',
      severity: 'danger',
    };

    expect(getLocalizedRaceEventDescription(dtEvt, tEn)).toBe('Lando Norris received a Drive Through penalty');
    expect(getLocalizedRaceEventDescription(dtEvt, tEs)).toBe('Lando Norris sancionado con Pase y Siga (Drive Through)');
    expect(getLocalizedPenaltyTag(dtEvt, tEn)).toBe('DRIVE THROUGH');
    expect(getLocalizedPenaltyTag(dtEvt, tEs)).toBe('PASE Y SIGA');
  });

  it('formats overtakes and fastest laps properly in both locales', () => {
    const ovtkEvt: RaceEvent = {
      id: '4',
      timestamp: Date.now(),
      eventCode: 'OVTK',
      type: 'overtake',
      driverName: 'Charles Leclerc',
      targetDriverName: 'Carlos Sainz',
      description: 'fallback',
      severity: 'info',
    };

    expect(getLocalizedRaceEventDescription(ovtkEvt, tEn)).toBe('Charles Leclerc overtook Carlos Sainz');
    expect(getLocalizedRaceEventDescription(ovtkEvt, tEs)).toBe('Charles Leclerc superó a Carlos Sainz');

    const ftlpEvt: RaceEvent = {
      id: '5',
      timestamp: Date.now(),
      eventCode: 'FTLP',
      type: 'fastest_lap',
      driverName: 'Lewis Hamilton',
      lapTime: 81.345,
      description: 'fallback',
      severity: 'purple',
    };

    expect(getLocalizedRaceEventDescription(ftlpEvt, tEn)).toBe('Lewis Hamilton set the fastest lap (81.345s)');
    expect(getLocalizedRaceEventDescription(ftlpEvt, tEs)).toBe('Lewis Hamilton marcó la vuelta rápida (81.345s)');
  });

  describe('rows without a driver', () => {
    const flagEvent = (eventCode: string, description: string, extra: Partial<RaceEvent> = {}): RaceEvent => ({
      id: eventCode,
      timestamp: Date.now(),
      eventCode,
      type: 'flag',
      description,
      severity: 'info',
      ...extra,
    });

    it.each([
      ['SSTA', 'Session Started', 'Session Started', 'Sesión Iniciada'],
      ['SEND', 'Chequered flag — Session complete', 'Session Ended', 'Sesión Finalizada'],
      ['CHQF', 'Chequered Flag waved', 'Chequered Flag waved', 'Bandera a Cuadros agitada'],
      ['RDFL', 'Red Flag deployed!', 'Red Flag deployed!', '¡Bandera Roja desplegada!'],
      ['STLG', 'Start lights countdown active', 'Start lights countdown active', 'Cuenta regresiva del semáforo de largada'],
      ['LGOT', 'LIGHTS OUT AND AWAY WE GO!', 'LIGHTS OUT AND AWAY WE GO!', '¡SE APAGAN LAS LUCES Y ARRANCA LA CARRERA!'],
    ])('translates %s instead of showing its English description', (code, description, en, es) => {
      const evt = flagEvent(code, description);
      expect(getLocalizedRaceEventDescription(evt, tEn)).toBe(en);
      expect(getLocalizedRaceEventDescription(evt, tEs)).toBe(es);
    });

    it.each([
      [SAFETY_CAR_STATUS.FULL, 'Full Safety Car Deployed', 'Safety Car desplegado'],
      [SAFETY_CAR_STATUS.VIRTUAL, 'Virtual Safety Car Deployed', 'Virtual Safety Car desplegado'],
      [SAFETY_CAR_STATUS.FORMATION_LAP, 'Formation Lap In Progress', 'Vuelta de formación en curso'],
      [SAFETY_CAR_STATUS.CLEAR, 'Track Clear (Green Flag)', 'Pista habilitada (bandera verde)'],
    ])('translates safety car status %s', (safetyCarStatus, en, es) => {
      const evt = flagEvent('SCAR', en, { safetyCarStatus });
      expect(getLocalizedRaceEventDescription(evt, tEn)).toBe(en);
      expect(getLocalizedRaceEventDescription(evt, tEs)).toBe(es);
    });

    it('falls back to the description when a safety car row has no status', () => {
      const evt = flagEvent('SCAR', 'Full Safety Car Deployed');
      expect(getLocalizedRaceEventDescription(evt, tEs)).toBe('Full Safety Car Deployed');
    });

    it('falls back to the description for codes it does not know', () => {
      const evt = flagEvent('XXXX', 'Something happened');
      expect(getLocalizedRaceEventDescription(evt, tEs)).toBe('Something happened');
    });
  });

  it("translates the server's disqualification row", () => {
    const evt: RaceEvent = {
      id: 'dsq',
      timestamp: Date.now(),
      eventCode: 'DSQ',
      type: 'penalty',
      driverName: 'Max Verstappen',
      vehicleIdx: 1,
      description: 'Max Verstappen was disqualified from the session',
      severity: 'danger',
    };

    expect(getLocalizedRaceEventDescription(evt, tEn)).toBe('Max Verstappen was DISQUALIFIED from the session');
    expect(getLocalizedRaceEventDescription(evt, tEs)).toBe('Max Verstappen fue DESCALIFICADO de la sesión');
  });
});
