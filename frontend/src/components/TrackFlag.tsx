import React from 'react';
import { CountryFlag } from './CountryFlag';
import { getTrackInfo } from '../constants/f1';

export interface TrackFlagProps {
  track?: number | string | null;
  countryCode?: string | null;
  className?: string;
  width?: number;
  height?: number;
  showTooltip?: boolean;
  showName?: boolean;
  nameClassName?: string;
}

export const TrackFlag: React.FC<TrackFlagProps> = ({
  track,
  countryCode,
  className = '',
  width = 18,
  height = 13,
  showTooltip = true,
  showName = false,
  nameClassName = '',
}) => {
  const trackInfo = getTrackInfo(track);
  const resolvedCountryCode = countryCode || trackInfo?.countryCode || null;
  const displayName = trackInfo?.name || (typeof track === 'string' ? track : `Track #${track ?? '?'}`);

  return (
    <span className={`inline-track-flag-group ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
      <CountryFlag
        countryCode={resolvedCountryCode}
        width={width}
        height={height}
        showTooltip={showTooltip}
      />
      {showName && (
        <span className={nameClassName}>
          {displayName}
        </span>
      )}
    </span>
  );
};
