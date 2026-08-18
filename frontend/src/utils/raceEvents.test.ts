import { describe, it, expect } from 'vitest';
import { getLocalizedRaceEventDescription, getLocalizedPenaltyTag } from './raceEvents';
import { getTranslation } from '../locales';
import type { RaceEvent } from '../types/telemetry';

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
});
