import { describe, it, expect } from 'vitest';
import { getLocalizedRaceEventDescription, getLocalizedPenaltyTag } from './raceEvents';
import { getTranslation } from '../locales';
import type { FeedEvent, FeedEventCode, FeedEventType, RaceEvent } from '../types/telemetry';
import { PENALTY_TYPES, SAFETY_CAR_STATUS } from '../constants/f1';
import { makeFeedEvent } from '../test/wireFactories';

import { createUnitFormatter } from '../hooks/useUnits';

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
      severity: 'purple',
    };

    expect(getLocalizedRaceEventDescription(ftlpEvt, tEn)).toBe('Lewis Hamilton set the fastest lap (81.345s)');
    expect(getLocalizedRaceEventDescription(ftlpEvt, tEs)).toBe('Lewis Hamilton marcó la vuelta rápida (81.345s)');
  });

  describe('every feed event code', () => {
    const row = (fields: Partial<FeedEvent>): RaceEvent => ({ ...makeFeedEvent(fields), id: 'row', timestamp: Date.now() });

    // A Record over FeedEventCode, so a code the server adds fails to compile until it is covered here.
    const cases: Record<FeedEventCode, { evt: Partial<FeedEvent>; en: string; es: string }> = {
      FTLP: {
        evt: { type: 'fastest_lap', vehicleIdx: 0, driverName: 'Lewis Hamilton', lapTime: 81.345 },
        en: 'Lewis Hamilton set the fastest lap (81.345s)',
        es: 'Lewis Hamilton marcó la vuelta rápida (81.345s)',
      },
      OVTK: {
        evt: { type: 'overtake', vehicleIdx: 3, driverName: 'Charles Leclerc', otherVehicleIdx: 7 },
        en: 'Charles Leclerc overtook Car #8',
        es: 'Charles Leclerc superó a Auto #8',
      },
      PENA: {
        evt: { type: 'penalty', vehicleIdx: 1, driverName: 'Max Verstappen', penaltyType: PENALTY_TYPES.TIME_PENALTY, penaltyTime: 5 },
        en: 'Max Verstappen received a 5s time penalty',
        es: 'Max Verstappen sancionado con 5s de recargo',
      },
      SPTP: {
        evt: { type: 'speed_trap', vehicleIdx: 4, driverName: 'Lando Norris', speed: 331.46 },
        en: 'Lando Norris triggered speed trap at 331.5 km/h',
        es: 'Lando Norris registró 331.5 km/h en la trampa de velocidad',
      },
      RTMT: {
        evt: { type: 'retirement', vehicleIdx: 0 },
        en: 'Car #1 retired from the session',
        es: 'Auto #1 abandonó la sesión',
      },
      DTSV: {
        evt: { type: 'penalty', vehicleIdx: 5, driverName: 'Oscar Piastri' },
        en: 'Oscar Piastri served Drive Through penalty',
        es: 'Oscar Piastri cumplió penalización Pase y Siga',
      },
      SGSV: {
        evt: { type: 'penalty', vehicleIdx: 2 },
        en: 'Car #3 served Stop & Go penalty',
        es: 'Auto #3 cumplió penalización Stop & Go',
      },
      COLL: {
        evt: { type: 'penalty', vehicleIdx: 6, driverName: 'George Russell', otherVehicleIdx: 7, targetDriverName: 'Kimi Antonelli' },
        en: 'Collision between George Russell and Kimi Antonelli',
        es: 'Colisión entre George Russell y Kimi Antonelli',
      },
      RCWN: {
        evt: { type: 'general', vehicleIdx: 8, driverName: 'Franco Colapinto' },
        en: 'Franco Colapinto won the race!',
        es: '¡Franco Colapinto ganó la carrera!',
      },
      TMPT: {
        evt: { type: 'pit', vehicleIdx: 9, driverName: 'Fernando Alonso', lapNum: 12 },
        en: 'Fernando Alonso entered the pit lane',
        es: 'Fernando Alonso ingresó a boxes',
      },
      DSQ: {
        evt: { type: 'penalty', vehicleIdx: 1, driverName: 'Max Verstappen' },
        en: 'Max Verstappen was DISQUALIFIED from the session',
        es: 'Max Verstappen fue DESCALIFICADO de la sesión',
      },
      SCAR: {
        evt: { type: 'flag', safetyCarStatus: SAFETY_CAR_STATUS.FULL },
        en: 'Full Safety Car Deployed',
        es: 'Safety Car desplegado',
      },
      SSTA: { evt: { type: 'general' }, en: 'Session Started', es: 'Sesión Iniciada' },
      SEND: { evt: { type: 'general' }, en: 'Session Ended', es: 'Sesión Finalizada' },
      CHQF: { evt: { type: 'flag' }, en: 'Chequered Flag waved', es: 'Bandera a Cuadros agitada' },
      RDFL: { evt: { type: 'flag' }, en: 'Red Flag deployed!', es: '¡Bandera Roja desplegada!' },
      STLG: { evt: { type: 'general' }, en: 'Start lights countdown active', es: 'Cuenta regresiva del semáforo de largada' },
      LGOT: { evt: { type: 'general' }, en: 'LIGHTS OUT AND AWAY WE GO!', es: '¡SE APAGAN LAS LUCES Y ARRANCA LA CARRERA!' },
    };

    it.each(Object.entries(cases))('localizes %s in EN and ES', (code, { evt, en, es }) => {
      const e = row({ ...evt, eventCode: code as FeedEventCode });
      for (const [t, want] of [[tEn, en], [tEs, es]] as const) {
        const text = getLocalizedRaceEventDescription(e, t);
        expect(text).toBe(want);
        expect(text).not.toMatch(/live\.|\{\w+\}/);
      }
    });

    it.each([
      [SAFETY_CAR_STATUS.FULL, 'Full Safety Car Deployed', 'Safety Car desplegado'],
      [SAFETY_CAR_STATUS.VIRTUAL, 'Virtual Safety Car Deployed', 'Virtual Safety Car desplegado'],
      [SAFETY_CAR_STATUS.FORMATION_LAP, 'Formation Lap In Progress', 'Vuelta de formación en curso'],
      [SAFETY_CAR_STATUS.CLEAR, 'Track Clear (Green Flag)', 'Pista habilitada (bandera verde)'],
      [undefined, 'Track Clear (Green Flag)', 'Pista habilitada (bandera verde)'],
    ])('localizes safety car status %s', (safetyCarStatus, en, es) => {
      const evt = row({ eventCode: 'SCAR', type: 'flag', safetyCarStatus });
      expect(getLocalizedRaceEventDescription(evt, tEn)).toBe(en);
      expect(getLocalizedRaceEventDescription(evt, tEs)).toBe(es);
    });

    it('names a car without an index as an unknown driver', () => {
      const evt = row({ eventCode: 'OVTK', type: 'overtake', driverName: 'Charles Leclerc' });
      expect(getLocalizedRaceEventDescription(evt, tEn)).toBe('Charles Leclerc overtook Unknown driver');
      expect(getLocalizedRaceEventDescription(evt, tEs)).toBe('Charles Leclerc superó a Piloto desconocido');
    });
  });

  describe('feed tags', () => {
    const row = (fields: Partial<FeedEvent>): RaceEvent => ({ ...makeFeedEvent(fields), id: 'row', timestamp: Date.now() });

    const tags: Record<Exclude<FeedEventType, 'penalty'>, [string, string]> = {
      fastest_lap: ['FASTEST LAP', 'VUELTA RÁPIDA'],
      overtake: ['OVERTAKE', 'SOBREPASO'],
      speed_trap: ['SPEED TRAP', 'TRAMPA DE VELOCIDAD'],
      pit: ['PIT', 'BOXES'],
      retirement: ['RETIREMENT', 'ABANDONO'],
      flag: ['FLAG', 'BANDERA'],
      general: ['GENERAL', 'GENERAL'],
    };

    it.each(Object.entries(tags))('localizes the %s tag', (type, [en, es]) => {
      const evt = row({ type: type as FeedEventType });
      expect(getLocalizedPenaltyTag(evt, tEn)).toBe(en);
      expect(getLocalizedPenaltyTag(evt, tEs)).toBe(es);
    });

    it("tags the server's disqualification row as disqualified", () => {
      const evt = row({ eventCode: 'DSQ', type: 'penalty', severity: 'danger', vehicleIdx: 1 });
      expect(getLocalizedPenaltyTag(evt, tEn)).toBe('DISQUALIFIED');
      expect(getLocalizedPenaltyTag(evt, tEs)).toBe('DESCALIFICADO');
    });
  });

  it('writes a speed trap in the unit it is given', () => {
    const evt = makeFeedEvent({ eventCode: 'SPTP', vehicleIdx: 4, driverName: 'Lando Norris', speed: 321.87 });
    const mph = createUnitFormatter({ speed: 'mph', temperature: 'f', clock: '12h' }, tEn, 'en');
    expect(getLocalizedRaceEventDescription(evt, tEn, mph)).toBe('Lando Norris triggered speed trap at 200.0 mph');
  });

  it("translates the server's disqualification row", () => {
    const evt: RaceEvent = {
      id: 'dsq',
      timestamp: Date.now(),
      eventCode: 'DSQ',
      type: 'penalty',
      driverName: 'Max Verstappen',
      vehicleIdx: 1,
      severity: 'danger',
    };

    expect(getLocalizedRaceEventDescription(evt, tEn)).toBe('Max Verstappen was DISQUALIFIED from the session');
    expect(getLocalizedRaceEventDescription(evt, tEs)).toBe('Max Verstappen fue DESCALIFICADO de la sesión');
  });
});
