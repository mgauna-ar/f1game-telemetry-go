import React, { useEffect, useRef, useState } from 'react';
import { getRadioAnalyserNode } from '../../utils/radioAudio';

export interface RadioWaveformCanvasProps {
  radioState?: 'idle' | 'listening' | 'transmitting' | 'processing' | 'speaking' | string;
  width?: number;
  height?: number;
  barCount?: number;
  gap?: number;
  className?: string;
  testId?: string;
  fallbackTestId?: string;
  fallbackClassName?: string;
}

export const RadioWaveformCanvas: React.FC<RadioWaveformCanvasProps> = ({
  radioState = 'idle',
  width = 260,
  height = 36,
  barCount = 24,
  gap = 4,
  className = 'voice-cockpit-waveform-canvas',
  testId = 'radio-waveform-canvas',
  fallbackTestId,
  fallbackClassName = 'live-radio-equalizer',
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
          norm = 0.2 + 0.3 * Math.sin(Date.now() / 200 + i * 0.4);
        } else {
          // Subtle idle resting pulse
          norm = 0.08 + 0.04 * Math.sin(Date.now() / 600 + i * 0.2);
        }

        const barHeight = Math.max(3, norm * canvas.height * 0.92);
        const x = i * (barWidth + gap);
        const y = canvas.height - barHeight;

        // Gradient & Glow based on radio state
        const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
        if (isTransmitting) {
          gradient.addColorStop(0, '#ef4444');
          gradient.addColorStop(1, '#991b1b');
          ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
        } else if (isSpeaking) {
          gradient.addColorStop(0, '#34d399');
          gradient.addColorStop(1, '#059669');
          ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
        } else if (isProcessing) {
          gradient.addColorStop(0, '#fbbf24');
          gradient.addColorStop(1, '#d97706');
          ctx.shadowColor = 'rgba(245, 158, 11, 0.5)';
        } else {
          gradient.addColorStop(0, '#00f2fe');
          gradient.addColorStop(1, '#0284c7');
          ctx.shadowColor = 'rgba(0, 242, 254, 0.3)';
        }
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

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [radioState, barCount, gap]);

  if (!hasCanvasCtx) {
    return (
      <div className={fallbackClassName} data-testid={fallbackTestId || `${testId}-fallback`}>
        <span className="live-radio-eq-bar" />
        <span className="live-radio-eq-bar" />
        <span className="live-radio-eq-bar" />
        <span className="live-radio-eq-bar" />
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      data-testid={testId}
    />
  );
};
