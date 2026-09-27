import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Award } from 'lucide-react';
import { getTeamColor } from '../../../constants/f1';
import { cssVar, styleVars } from '../../../styles/theme';
import { TyreCompoundBadge } from '../../common/TyreCompoundBadge';
import { useI18n } from '../../../context/I18nContext';
import { EmptyState } from '../../ui/EmptyState';
import { Panel, PanelHeader } from '../../ui/Panel';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { DriverFilterChips } from '../DriverFilterChips';
import styles from './DegradationCurves.module.css';
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
    <Panel className={styles.panel}>
      <PanelHeader
        icon={<TrendingUp size={18} color="var(--accent-secondary)" />}
        title={t('history.stints.degradation.title')}
        subtitle={t('history.stints.degradation.subtitle')}
        actions={
          <SegmentedControl
            size="xs"
            aria-label={t('history.stints.degradation.filterCompounds')}
            value={selectedCompound}
            onChange={setSelectedCompound}
            options={[
              { value: 'ALL', label: t('history.stints.degradation.allCompounds') },
              ...sessionCompounds.map((comp) => ({
                value: comp,
                label: comp,
                icon: <TyreCompoundBadge compound={comp} />,
              })),
            ]}
          />
        }
      />

      <div className={styles.drivers}>
        <DriverFilterChips
          label={t('history.stints.degradation.filterDrivers')}
          drivers={driverStandings}
          selected={selectedDrivers}
          onToggle={toggleDriver}
          onSelectAll={selectAllDrivers}
          onClear={clearAllDrivers}
          selectAllLabel={t('history.stints.degradation.selectAll')}
          clearLabel={t('history.stints.degradation.clear')}
        />
      </div>

      {/* Degradation rate of each stint */}
      {Object.keys(degradationRates).length > 0 && (
        <div className={styles.rates}>
          <span className={styles.ratesLabel}>
            <Award size={13} aria-hidden="true" /> {t('history.stints.degradation.degRate')}:
          </span>
          {Object.entries(degradationRates).map(([key, slope]) => {
            if (slope === null) return null;
            const [, carIdxStr, , stintIdxStr] = key.split('_');
            const driver = driverStandings.find((d) => String(d.participant.car_index) === carIdxStr);
            const isDegrading = slope > 0;
            const slopeFormatted = Math.abs(slope).toFixed(3);

            return (
              <div
                key={key}
                className={styles.rate}
                style={styleVars({ '--team-color': getTeamColor(driver?.participant.team_id) })}
              >
                <span className={styles.teamDot} aria-hidden="true" />
                <span className={styles.rateDriver}>{driver?.participant.name || `Car #${carIdxStr}`}</span>
                <span className={styles.rateStint}>S{stintIdxStr}:</span>
                <span className={isDegrading ? styles.degrading : styles.improving}>
                  {isDegrading ? `+${slopeFormatted}s/lap` : `-${slopeFormatted}s/lap`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Degradation Chart Container */}
      {degradationData.length === 0 || maxTyreAge === 0 ? (
        <EmptyState title={t('history.stints.degradation.noDegradationData')} />
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={degradationData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={cssVar('--chart-grid')} />
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
                  const driverName =
                    driver?.participant.name || (typeof name === 'string' ? name.split(' ')[0] : 'Driver');
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
                  const teamColor = getTeamColor(d.driver.participant.team_id);

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
    </Panel>
  );
};
