import { describe, it, expect } from 'vitest';
import {
  isLiveDriverActive,
  filterActiveLiveParticipants,
  isHistoricalDriverActive,
  filterActiveHistoricalParticipants,
} from './driverFilter';
import { RESULT_STATUS, DRIVER_STATUS } from '../constants/f1';
import type { ParticipantData, LapData } from '../types/telemetry';
import type { Participant, Lap } from '../types/session';

describe('driverFilter utility', () => {
  describe('Live Telemetry Filtering', () => {
    const playerParticipant: ParticipantData = {
      Name: 'LC-LEMAC',
      DriverId: 255,
      TeamId: 0,
      RaceNumber: 99,
      AIControlled: 0,
      Nationality: 1,
    };

    const humanFriend: ParticipantData = {
      Name: 'LC-iL.Magno',
      DriverId: 255,
      TeamId: 1,
      RaceNumber: 32,
      AIControlled: 0,
      Nationality: 1,
    };

    const activeAIDriver: ParticipantData = {
      Name: 'Lando Norris',
      DriverId: 10,
      TeamId: 2,
      RaceNumber: 4,
      AIControlled: 1,
      Nationality: 12,
    };

    const inactiveAIDriver: ParticipantData = {
      Name: 'Max Verstappen',
      DriverId: 9,
      TeamId: 0,
      RaceNumber: 1,
      AIControlled: 1,
      Nationality: 5,
    };

    it('always considers local player and human lobby drivers active', () => {
      expect(
        isLiveDriverActive({
          participant: playerParticipant,
          carIndex: 0,
          playerCarIndex: 0,
        })
      ).toBe(true);

      expect(
        isLiveDriverActive({
          participant: humanFriend,
          carIndex: 1,
          playerCarIndex: 0,
        })
      ).toBe(true);
    });

    it('considers AI driver active when on track with valid lap data', () => {
      const activeLap: LapData = {
        CarPosition: 3,
        CurrentLapNum: 5,
        LastLapTimeInMS: 89000,
        CurrentLapTimeInMS: 15000,
        Sector1TimeMSPart: 28000,
        Sector2TimeMSPart: 36000,
        PitStatus: 0,
        CurrentLapInvalid: 0,
        ResultStatus: RESULT_STATUS.ACTIVE,
        DriverStatus: DRIVER_STATUS.ON_TRACK,
        LapDistance: 1200,
      };

      expect(
        isLiveDriverActive({
          participant: activeAIDriver,
          carIndex: 2,
          playerCarIndex: 0,
          lap: activeLap,
        })
      ).toBe(true);
    });

    it('filters out inactive AI placeholder slots with no session activity', () => {
      const inactiveLap: LapData = {
        CarPosition: 0,
        CurrentLapNum: 1,
        LastLapTimeInMS: 0,
        CurrentLapTimeInMS: 0,
        Sector1TimeMSPart: 0,
        Sector2TimeMSPart: 0,
        PitStatus: 0,
        CurrentLapInvalid: 0,
        ResultStatus: RESULT_STATUS.INACTIVE,
        DriverStatus: DRIVER_STATUS.IN_GARAGE,
        LapDistance: -5000,
      };

      expect(
        isLiveDriverActive({
          participant: inactiveAIDriver,
          carIndex: 3,
          playerCarIndex: 0,
          lap: inactiveLap,
        })
      ).toBe(false);
    });

    it('filters array of live participants down to only active drivers and preserves carIndex', () => {
      const participants: ParticipantData[] = [
        playerParticipant,
        humanFriend,
        activeAIDriver,
        inactiveAIDriver,
      ];

      const laps: LapData[] = [
        { CarPosition: 1, CurrentLapNum: 2, LastLapTimeInMS: 89000, CurrentLapTimeInMS: 10000, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, PitStatus: 0, CurrentLapInvalid: 0, ResultStatus: RESULT_STATUS.ACTIVE, DriverStatus: DRIVER_STATUS.FLYING_LAP, LapDistance: 200 },
        { CarPosition: 2, CurrentLapNum: 2, LastLapTimeInMS: 89500, CurrentLapTimeInMS: 11000, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, PitStatus: 0, CurrentLapInvalid: 0, ResultStatus: RESULT_STATUS.ACTIVE, DriverStatus: DRIVER_STATUS.FLYING_LAP, LapDistance: 150 },
        { CarPosition: 3, CurrentLapNum: 2, LastLapTimeInMS: 90000, CurrentLapTimeInMS: 12000, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, PitStatus: 0, CurrentLapInvalid: 0, ResultStatus: RESULT_STATUS.ACTIVE, DriverStatus: DRIVER_STATUS.FLYING_LAP, LapDistance: 100 },
        { CarPosition: 0, CurrentLapNum: 1, LastLapTimeInMS: 0, CurrentLapTimeInMS: 0, Sector1TimeMSPart: 0, Sector2TimeMSPart: 0, PitStatus: 0, CurrentLapInvalid: 0, ResultStatus: RESULT_STATUS.INVALID, DriverStatus: DRIVER_STATUS.IN_GARAGE, LapDistance: -5000 },
      ];

      const result = filterActiveLiveParticipants(participants, laps, 0);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.carIndex)).toEqual([0, 1, 2]);
      expect(result.map((r) => r.participant.Name)).toEqual(['LC-LEMAC', 'LC-iL.Magno', 'Lando Norris']);
    });
  });

  describe('Historical Session Filtering', () => {
    const humanParticipant: Participant = {
      id: 1,
      session_id: 100,
      car_index: 0,
      name: 'LC-LEMAC',
      driver_id: 255,
      team_id: 0,
      race_number: 99,
      ai_controlled: false,
    };

    const aiWithLaps: Participant = {
      id: 2,
      session_id: 100,
      car_index: 1,
      name: 'Max Verstappen',
      driver_id: 9,
      team_id: 0,
      race_number: 1,
      ai_controlled: true,
    };

    const inactiveAI: Participant = {
      id: 3,
      session_id: 100,
      car_index: 2,
      name: 'Lewis Hamilton',
      driver_id: 7,
      team_id: 1,
      race_number: 44,
      ai_controlled: true,
    };

    it('retains human participants even if no laps are completed', () => {
      expect(
        isHistoricalDriverActive({
          participant: humanParticipant,
          driverLaps: [],
        })
      ).toBe(true);
    });

    it('retains AI drivers who completed laps or have telemetry', () => {
      const laps: Lap[] = [
        {
          id: 1,
          session_id: 100,
          car_index: 1,
          lap_number: 1,
          lap_time_ms: 88500,
          sector1_ms: 28000,
          sector2_ms: 36000,
          sector3_ms: 24500,
          is_valid: true,
        },
      ];

      expect(
        isHistoricalDriverActive({
          participant: aiWithLaps,
          driverLaps: laps,
        })
      ).toBe(true);
    });

    it('filters out AI drivers with 0 laps, 0 sectors, and no telemetry in qualifying sessions', () => {
      expect(
        isHistoricalDriverActive({
          participant: inactiveAI,
          driverLaps: [],
          isRaceSession: false,
        })
      ).toBe(false);

      // Even if ai_controlled was corrupted to false, driver_id identifies them as official AI
      const corruptedAI: Participant = {
        id: 4,
        session_id: 100,
        car_index: 3,
        name: 'BORTOLETO',
        driver_id: 161,
        team_id: 9,
        race_number: 5,
        ai_controlled: false,
      };

      expect(
        isHistoricalDriverActive({
          participant: corruptedAI,
          driverLaps: [],
          isRaceSession: false,
        })
      ).toBe(false);
    });

    it('filterActiveHistoricalParticipants filters full grid correctly in qualifying and race', () => {
      const participants: Participant[] = [humanParticipant, aiWithLaps, inactiveAI];
      const laps: Lap[] = [
        {
          id: 1,
          session_id: 100,
          car_index: 0,
          lap_number: 1,
          lap_time_ms: 89393,
          is_valid: true,
        },
        {
          id: 2,
          session_id: 100,
          car_index: 1,
          lap_number: 1,
          lap_time_ms: 88500,
          is_valid: true,
        },
      ];

      const activeQualy = filterActiveHistoricalParticipants(participants, laps, false);
      expect(activeQualy).toHaveLength(2);
      expect(activeQualy.map((p) => p.name)).toEqual(['LC-LEMAC', 'Max Verstappen']);
    });
  });
});
