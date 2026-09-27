import React from 'react';
import { Loader2, Mic, Radio } from 'lucide-react';
import type { RadioVisualState } from '../../utils/radioVisuals';

/** The radio's state as an icon: microphone while talking, spinner while thinking, radio otherwise. */
export const RadioStateIcon: React.FC<{ state: RadioVisualState; size?: number; className?: string }> = ({
  state,
  size = 20,
  className,
}) => {
  if (state === 'transmitting') return <Mic size={size} className={className} aria-hidden="true" />;
  if (state === 'processing') {
    return <Loader2 size={size} className={`animate-spin ${className ?? ''}`} aria-hidden="true" />;
  }
  return <Radio size={size} className={className} aria-hidden="true" />;
};
