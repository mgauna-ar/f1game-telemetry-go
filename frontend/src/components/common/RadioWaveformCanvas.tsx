import React, { useEffect, useRef, useState } from 'react';
import { getRadioAnalyserNode } from '../../utils/radioAudio';
import { shouldReduceMotion } from '../../utils/motion';
import { canvasRgba, getCssVars } from '../../styles/theme';
import { cx } from '../ui/cx';
import styles from './RadioWaveformCanvas.module.css';

/** Bar colour for each radio state. */
const WAVEFORM_TOKENS = {
  transmitting: '--status-danger',
  speaking: '--status-success',
  processing: '--status-warning',
  idle: '--accent-cyan',
} as const;

export interface RadioWaveformCanvasProps {
  radioState?: 'idle' | 'listening' | 'transmitting' | 'processing' | 'speaking' | string;
  width?: number;
  height?: number;
  barCount?: number;
  gap?: number;
  /** Sizes the canvas (width and height in CSS). */
  className?: string;
  testId?: string;
  fallbackTestId?: string;
  /** Sizes the bar fallback shown when the canvas can't draw. */
  fallbackClassName?: string;
}

export const RadioWaveformCanvas: React.FC<RadioWaveformCanvasProps> = ({
  radioState = 'idle',
  width = 260,
  height = 36,
  barCount = 24,
  gap = 4,
  className,
  testId = 'radio-waveform-canvas',
  fallbackTestId,
  fallbackClassName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasCanvasCtx, setHasCanvasCtx] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setHasCanvasCtx(false);
      return;
    }

    let animId: number;
    const analyser = getRadioAnalyserNode();
    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const isTransmitting = radioState === 'transmitting';
    const isSpeaking = radioState === 'speaking';
    const isProcessing = radioState === 'processing';
    const isAudioReactive = (isTransmitting || isSpeaking) && !!analyser;
    // With reduced motion the idle and thinking pulses hold still; live audio levels still move.
    const reducedMotion = shouldReduceMotion();

    const palette = getCssVars(WAVEFORM_TOKENS);
    const barColor = isTransmitting
      ? palette.transmitting
      : isSpeaking
        ? palette.speaking
        : isProcessing
          ? palette.processing
          : palette.idle;
    const barBase = canvasRgba(ctx, barColor, 0.55);
    const glow = canvasRgba(ctx, barColor, isTransmitting || isSpeaking ? 0.7 : isProcessing ? 0.5 : 0.3);

    const render = () => {
      if (analyser && (isTransmitting || isSpeaking)) {
        analyser.getByteFrequencyData(dataArray);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const totalGapWidth = gap * (barCount - 1);
      const barWidth = Math.max(2, (canvas.width - totalGapWidth) / barCount);

      for (let i = 0; i < barCount; i++) {
        let norm = 0;

        if ((isTransmitting || isSpeaking) && analyser) {
          const binIndex = Math.min(bufferLength - 1, Math.floor((i / barCount) * (bufferLength / 1.5)));
          const rawVal = dataArray[binIndex] || 0;
          norm = rawVal / 255;
        } else if (isProcessing) {
          // Subtle harmonic wave during AI processing
          norm = reducedMotion ? 0.35 : 0.2 + 0.3 * Math.sin(Date.now() / 200 + i * 0.4);
        } else {
          // Subtle idle resting pulse
          norm = reducedMotion ? 0.1 : 0.08 + 0.04 * Math.sin(Date.now() / 600 + i * 0.2);
        }

        const barHeight = Math.max(3, norm * canvas.height * 0.92);
        const x = i * (barWidth + gap);
        const y = canvas.height - barHeight;

        // Gradient & Glow based on radio state
        const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
        gradient.addColorStop(0, barColor);
        gradient.addColorStop(1, barBase);
        ctx.shadowColor = glow;
        ctx.shadowBlur = isTransmitting || isSpeaking ? 8 : 4;

        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, 2);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      if (isAudioReactive || !reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [radioState, barCount, gap]);

  if (!hasCanvasCtx) {
    return (
      <div
        className={cx(styles.fallback, fallbackClassName)}
        data-state={radioState}
        data-testid={fallbackTestId || `${testId}-fallback`}
        aria-hidden="true"
      >
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cx(styles.canvas, className)}
      data-testid={testId}
      aria-hidden="true"
    />
  );
};
