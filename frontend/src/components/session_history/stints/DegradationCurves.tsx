import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Filter, Award } from 'lucide-react';
import { TEAM_COLORS } from '../../../constants/f1';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { useI18n } from '../../../context/I18nContext';
import { getCompoundColor, compactTooltipProps, type DriverStintData } from './stintUtils';
import type { DriverStanding } from '../../../types/session';

interface DegradationCurvesProps {
  degradationData: Array<{ tyreAge: number; [key: string]: number | string | null | undefined }>;
  maxTyreAge: number;
  degradationRates: Record<string, number | null>;
  driverStintsData: DriverStintData[];
  driverStandings: DriverStanding[];
  selectedDrivers: Record<number, boolean>;
  toggleDriver: (carIndex: number) => void;
  selectAllDrivers: () => void;
  clearAllDrivers: () => void;
  selectedCompound: string;
  setSelectedCompound: (compound: string) => void;
  sessionCompounds: string[];
  formatLapTime: (ms: number) => string;
}

export const DegradationCurves: React.FC<DegradationCurvesProps> = ({
  degradationData,
  maxTyreAge,
  degradationRates,
  driverStintsData,
  driverStandings,
  selectedDrivers,
  toggleDriver,
  selectAllDrivers,
  clearAllDrivers,
  selectedCompound,
  setSelectedCompound,
  sessionCompounds,
  formatLapTime,
}) => {
  const { t } = useI18n();

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
            <TrendingUp size={18} color="var(--accent-secondary)" />
            {t('history.stints.degradation.title')}
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {t('history.stints.degradation.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Compound Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <button
              className={`nav-tab ${selectedCompound === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCompound('ALL')}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              {t('history.stints.degradation.allCompounds')}
            </button>
            {sessionCompounds.map((comp) => {
              const color = getCompoundColor(comp);
              const isActive = selectedCompound === comp;
              return (
                <button
                  key={comp}
                  onClick={() => setSelectedCompound(comp)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                    backgroundColor: isActive ? `${color}33` : 'rgba(0,0,0,0.3)',
                    color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <TyreCompoundBadge compound={comp} />
                  <span>{comp}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Driver Selection Filter Chips */}
      <div style={{ padding: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={13} /> {t('history.stints.degradation.filterDrivers')}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={selectAllDrivers}
              className="nav-tab"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
            >
              {t('history.stints.degradation.selectAll')}
            </button>
            <button
              onClick={clearAllDrivers}
              className="nav-tab"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
            >
              {t('history.stints.degradation.clear')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {driverStandings.map((driver) => {
            const isSelected = !!selectedDrivers[driver.participant.car_index];
            const teamColor = TEAM_COLORS[driver.participant.team_id] || '#A0A0A0';

            return (
              <button
                key={driver.participant.car_index}
                onClick={() => toggleDriver(driver.participant.car_index)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 9px',
                  borderRadius: '16px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${isSelected ? teamColor : 'rgba(255,255,255,0.1)'}`,
                  background: isSelected ? `${teamColor}22` : 'rgba(0,0,0,0.3)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: teamColor }} />
                <span>{driver.participant.name}</span>
                <span className="mono" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                  #{driver.participant.race_number}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Degradation Rate Slopes Summary Chips */}
      {Object.keys(degradationRates).length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Award size={13} /> {t('history.stints.degradation.degRate')}:
          </span>
          {Object.entries(degradationRates).map(([key, slope]) => {
            if (slope === null) return null;
            const [, carIdxStr, , stintIdxStr] = key.split('_');
            const driver = driverStandings.find((d) => String(d.participant.car_index) === carIdxStr);
            const teamColor = driver ? TEAM_COLORS[driver.participant.team_id] || '#00f2fe' : '#00f2fe';
            const isDegrading = slope > 0;
            const slopeFormatted = Math.abs(slope).toFixed(3);

            return (
              <div
                key={key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${teamColor}66`,
                  fontSize: '0.7rem',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: teamColor }} />
                <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{driver?.participant.name || `Car #${carIdxStr}`}</span>
                <span style={{ color: 'var(--text-muted)' }}>S{stintIdxStr}:</span>
                <span className="mono" style={{ color: isDegrading ? '#ff6b6b' : '#51cf66', fontWeight: 700 }}>
                  {isDegrading ? `+${slopeFormatted}s/lap` : `-${slopeFormatted}s/lap`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Degradation Chart Container */}
      {degradationData.length === 0 || maxTyreAge === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary)' }}>
          {t('history.stints.degradation.noDegradationData')}
        </div>
      ) : (
        <div style={{ width: '100%', height: '420px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={degradationData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="tyreAge"
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickFormatter={(val) => `Age ${val}`}
              />
              <YAxis
                stroke="var(--text-muted)"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={(val) => `${val.toFixed(1)}s`}
              />
              <Tooltip
                {...compactTooltipProps}
                labelFormatter={(age) => `${t('history.stints.degradation.tyreAgeAxis')}: ${age} Laps`}
                formatter={(val, name, item) => {
                  const key = String(item?.dataKey || name);
                  const payload = item?.payload as Record<string, unknown> | undefined;
                  const rawMS = payload ? (payload[`${key}_rawMS`] as number | undefined) : undefined;
                  const comp = payload ? (payload[`${key}_compound`] as string | undefined) : undefined;
                  const lapNum = payload ? (payload[`${key}_lapNum`] as number | undefined) : undefined;
                  const timeStr = rawMS ? formatLapTime(rawMS) : `${val}s`;

                  const [, carIdxStr, , stintIdxStr] = key.split('_');
                  const driver = driverStandings.find((d) => String(d.participant.car_index) === carIdxStr);
                  const driverName = driver?.participant.name || (typeof name === 'string' ? name.split(' ')[0] : 'Driver');
                  const label = `${driverName} (Stint ${stintIdxStr || '1'} • ${comp || 'Tyre'} • Race L${lapNum ?? '?'})`;
                  return [timeStr, label];
                }}
              />
              <Legend />

              {/* Render a line for each driver stint */}
              {driverStintsData
                .filter((d) => selectedDrivers[d.driver.participant.car_index])
                .flatMap((d) => {
                  const carIdx = d.driver.participant.car_index;
                  const teamColor = TEAM_COLORS[d.driver.participant.team_id] || '#00f2fe';

                  return d.stints
                    .filter((s) => selectedCompound === 'ALL' || s.compound === selectedCompound)
                    .map((stint) => {
                      const key = `driver_${carIdx}_stint_${stint.stintIndex}`;
                      const lineName = `${d.driver.participant.name} (S${stint.stintIndex} ${stint.compound.charAt(0)})`;

                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={lineName}
                          stroke={teamColor}
                          strokeWidth={2}
                          strokeDasharray={stint.stintIndex > 1 ? '4 4' : undefined}
                          dot={{ r: 3, fill: getCompoundColor(stint.compound) }}
                          activeDot={{ r: 6 }}
                          connectNulls
                        />
                      );
                    });
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
