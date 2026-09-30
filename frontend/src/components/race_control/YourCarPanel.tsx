import React from 'react';
import { Car } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useSessionStatusStore } from '../../store/useSessionStatusStore';
import { useTelemetryDataStore } from '../../store/useTelemetryDataStore';
import { F1_FORMATS, TRACK_NAMES, getTrackInfo } from '../../constants/f1';
import { VitalTelemetryStrip } from '../cockpit/VitalTelemetryStrip';
import { Panel, PanelHeader } from '../ui/Panel';

interface YourCarPanelProps {
  className?: string;
}

/** Race Control's your-car panel: the voice cockpit's vitals (position, tyres, powertrain, aero) for the player. */
export const YourCarPanel: React.FC<YourCarPanelProps> = ({ className }) => {
  const { t } = useI18n();
  const session = useSessionStatusStore((s) => s.session);
  const packetFormat = useSessionStatusStore((s) => s.packetFormat);
  const lap = useTelemetryDataStore((s) => s.allLaps[s.playerCarIndex] ?? null);
  const carStatus = useTelemetryDataStore((s) => s.allCarStatus[s.playerCarIndex] ?? null);
  const carDamage = useTelemetryDataStore((s) => s.allCarDamage[s.playerCarIndex] ?? null);
  const telemetry = useTelemetryDataStore((s) => s.allTelemetry[s.playerCarIndex] ?? null);
  const telemetry2 = useTelemetryDataStore((s) => s.allTelemetry2[s.playerCarIndex] ?? null);

  const trackId = session?.TrackId;
  const trackName =
    trackId === undefined
      ? t('common.unknownTrack')
      : getTrackInfo(trackId)?.name || TRACK_NAMES[trackId] || t('common.unknownTrack');

  return (
    <Panel className={className} padding="compact" data-testid="race-control-your-car">
      <PanelHeader icon={<Car size={16} />} title={t('live.raceControlView.yourCar')} />
      <VitalTelemetryStrip
        session={session}
        lap={lap}
        carStatus={carStatus}
        carDamage={carDamage}
        telemetry={telemetry}
        telemetry2={telemetry2}
        trackName={trackName}
        is2026={(packetFormat || session?.PacketFormat) === F1_FORMATS.FORMAT_2026}
      />
    </Panel>
  );
};
