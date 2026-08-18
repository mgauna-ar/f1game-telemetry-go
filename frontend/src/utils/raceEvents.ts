import type { RaceEvent } from '../types/telemetry';

export function getLocalizedRaceEventDescription(
  evt: RaceEvent,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (!evt.driverName && evt.description) {
    return evt.description;
  }

  const driver = evt.driverName || 'Driver';
  const target = evt.targetDriverName || 'Car';

  switch (evt.eventCode) {
    case 'PENA': {
      const infringement =
        evt.infringementType !== undefined
          ? t(`live.infringements.${evt.infringementType}`)
          : '';
      const reason =
        infringement && !infringement.startsWith('live.infringements.')
          ? ` (${infringement})`
          : '';

      if (evt.penaltyType === 0) {
        return t('live.events.driveThrough', { driver, reason });
      }
      if (evt.penaltyType === 1) {
        const seconds =
          evt.penaltyTime !== undefined && evt.penaltyTime > 0 && evt.penaltyTime < 255
            ? evt.penaltyTime
            : 10;
        return t('live.events.stopGo', { driver, seconds, reason });
      }
      if (evt.penaltyType === 2) {
        const places =
          evt.placesGained ||
          (evt.penaltyTime !== undefined && evt.penaltyTime > 0 && evt.penaltyTime < 255
            ? evt.penaltyTime
            : 3);
        return t('live.events.gridPenalty', { driver, places, reason });
      }
      if (evt.penaltyType === 3) {
        return t('live.events.penaltyReminder', { driver, reason });
      }
      if (evt.penaltyType === 4) {
        const seconds =
          evt.penaltyTime !== undefined && evt.penaltyTime > 0 && evt.penaltyTime < 255
            ? evt.penaltyTime
            : 5;
        return t('live.events.timePenalty', { driver, seconds, reason });
      }
      if (evt.penaltyType === 5) {
        return t('live.events.warning', { driver, reason });
      }
      if (evt.penaltyType === 6) {
        return t('live.events.disqualified', { driver, reason });
      }
      if (evt.penaltyType === 7) {
        return t('live.events.removedFormation', { driver, reason });
      }
      if (evt.penaltyType === 8) {
        return t('live.events.parkedTooLong', { driver, reason });
      }
      if (evt.penaltyType === 9) {
        return t('live.events.tyreRegulations', { driver, reason });
      }
      if (evt.penaltyType !== undefined && evt.penaltyType >= 10 && evt.penaltyType <= 15) {
        return t('live.events.lapInvalidated', { driver, reason });
      }
      if (evt.penaltyType === 16) {
        return t('live.events.retirement', { driver });
      }
      if (evt.penaltyTime !== undefined && evt.penaltyTime > 0 && evt.penaltyTime < 255) {
        return t('live.events.timePenalty', { driver, seconds: evt.penaltyTime, reason });
      }
      return t('live.events.genericPenalty', { driver, reason });
    }

    case 'OVTK':
      return t('live.events.overtake', { driver, target });

    case 'FTLP': {
      const time = evt.lapTime && evt.lapTime > 0 ? `${evt.lapTime.toFixed(3)}s` : '';
      return t('live.events.fastestLap', { driver, time });
    }

    case 'SPTP': {
      const speed = evt.speed !== undefined ? evt.speed.toFixed(1) : '0.0';
      return t('live.events.speedTrap', { driver, speed });
    }

    case 'TMPT':
      return t('live.events.pitEntry', { driver });

    case 'RTMT':
      return t('live.events.retirement', { driver });

    case 'SSTA':
      return t('live.events.sessionStarted');

    case 'SEND':
      return t('live.events.sessionEnded');

    case 'CHQF':
      return t('live.events.chequeredFlag');

    case 'RCWN':
      return t('live.events.raceWinner', { driver });

    case 'DTSV':
      return t('live.events.driveThroughServed', { driver });

    case 'SGSV':
      return t('live.events.stopGoServed', { driver });

    case 'COLL':
      return t('live.events.collision', { driver, target });

    case 'RDFL':
      return t('live.events.redFlag');

    default:
      return evt.description;
  }
}

export function getLocalizedPenaltyTag(
  evt: RaceEvent,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (evt.type === 'penalty') {
    if (evt.penaltyType === 0) return t('live.penaltyTypes.driveThrough').toUpperCase();
    if (evt.penaltyType === 1) return t('live.penaltyTypes.stopGo').toUpperCase();
    if (evt.penaltyType === 2) return t('live.penaltyTypes.gridPenalty').toUpperCase();
    if (evt.penaltyType === 3) return t('live.penaltyTypes.penaltyReminder').toUpperCase();
    if (evt.penaltyType === 4) {
      if (evt.penaltyTime !== undefined && evt.penaltyTime > 0 && evt.penaltyTime < 255) {
        return `${evt.penaltyTime}S ${t('live.penaltyTypes.timePenalty').toUpperCase()}`;
      }
      return t('live.penaltyTypes.timePenalty').toUpperCase();
    }
    if (evt.penaltyType === 5) return t('live.penaltyTypes.warning').toUpperCase();
    if (evt.penaltyType === 6) return t('live.penaltyTypes.disqualified').toUpperCase();
    if (evt.penaltyType === 7) return t('live.penaltyTypes.removedFormation').toUpperCase();
    if (evt.penaltyType === 8) return t('live.penaltyTypes.parkedTooLong').toUpperCase();
    if (evt.penaltyType === 9) return t('live.penaltyTypes.tyreRegulations').toUpperCase();
    if (evt.penaltyType !== undefined && evt.penaltyType >= 10 && evt.penaltyType <= 15) {
      return t('live.penaltyTypes.lapInvalidated').toUpperCase();
    }
    if (evt.penaltyType === 16) return t('live.penaltyTypes.retired').toUpperCase();
    if (evt.penaltyType === 17) return t('live.penaltyTypes.blackFlagTimer').toUpperCase();
    return t('live.penaltyTypes.penalty').toUpperCase();
  }
  return evt.type.replace('_', ' ').toUpperCase();
}
